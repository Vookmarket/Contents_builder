/**
 * 記事の信頼性を評価するクラス
 */
class ReliabilityEvaluator {
  constructor() {
    this.geminiService = new GeminiService();
    
    // メディア信頼度マスタ
    this.MEDIA_RELIABILITY = {
      // 一次ソース（政府・公的機関）
      'env.go.jp': 50,
      'maff.go.jp': 50,
      'mhlw.go.jp': 50,
      'cas.go.jp': 50,
      'e-gov.go.jp': 50,
      'elaws.e-gov.go.jp': 50,
      'e-stat.go.jp': 50,
      
      // 大手メディア
      'nhk.or.jp': 45,
      'asahi.com': 42,
      'yomiuri.co.jp': 42,
      'mainichi.jp': 40,
      'nikkei.com': 42,
      'sankei.com': 40,
      'jiji.com': 40,
      'kyodo.co.jp': 40,
      
      // 集約サイト・ポータル
      'yahoo.co.jp': 35,
      'news.google.com': 30,
      
      // 地方紙・専門メディア
      'chunichi.co.jp': 38,
      'hokkaido-np.co.jp': 38,
      
      // デフォルト
      'default': 20
    };
  }

  /**
   * 記事の信頼性スコアを算出
   * @param {Object} article
   * @returns {number} 0-100のスコア
   */
  evaluate(article) {
    // 既にスコアがある場合（一次ソースなど）はそれを使用
    if (article.reliability_score && article.reliability_score > 0) {
      return article.reliability_score;
    }

    const baseScore = this.getBaseScore(article.url, article.source_type);
    const sourceBonus = this.getSourceBonus(article.source_type);
    const clarityBonus = this.getClarityBonus(article);

    const totalScore = Math.min(100, baseScore + sourceBonus + clarityBonus);
    
    console.log(`  [Reliability] ${article.title}: ${totalScore} (base:${baseScore}, source:${sourceBonus}, clarity:${clarityBonus})`);
    
    return totalScore;
  }

  /**
   * URLからメディアの基礎スコアを取得
   * @param {string} url
   * @param {string} sourceType
   * @returns {number}
   */
  getBaseScore(url, sourceType) {
    if (!url) return this.MEDIA_RELIABILITY['default'];

    // 一次ソースは最高スコア
    if (sourceType === 'official' || sourceType === 'law' || sourceType === 'statistics') {
      return 50;
    }

    try {
      const domain = new URL(url).hostname.replace('www.', '');
      
      // 完全一致
      if (this.MEDIA_RELIABILITY[domain]) {
        return this.MEDIA_RELIABILITY[domain];
      }
      
      // 部分一致（例: news.yahoo.co.jp → yahoo.co.jp）
      for (const key in this.MEDIA_RELIABILITY) {
        if (domain.includes(key)) {
          return this.MEDIA_RELIABILITY[key];
        }
      }
      
      return this.MEDIA_RELIABILITY['default'];
    } catch (e) {
      console.warn(`Invalid URL: ${url}`);
      return this.MEDIA_RELIABILITY['default'];
    }
  }

  /**
   * ソースタイプによるボーナス
   * @param {string} sourceType
   * @returns {number}
   */
  getSourceBonus(sourceType) {
    switch (sourceType) {
      case 'official':
      case 'law':
      case 'statistics':
        return 30; // 一次ソース
      case 'news':
        return 10; // 二次ソースだが報道メディア
      default:
        return 0;
    }
  }

  /**
   * 記事の根拠明確度をGeminiで評価
   * @param {Object} article
   * @returns {number}
   */
  getClarityBonus(article) {
    // 一次ソースは評価不要（既に高スコア）
    if (article.source_type === 'official' || article.source_type === 'law' || article.source_type === 'statistics') {
      return 20;
    }

    // snippetがない場合は評価不可
    if (!article.snippet) {
      return 0;
    }

    const systemPrompt = `
あなたは情報の信頼性を評価する専門家です。
以下の記事の抜粋について、主張の根拠が明確に示されているかを評価してください。

評価基準:
- 数値や日付が具体的に示されている
- 情報源（一次ソース）が明記されている
- 専門家の実名コメントがある
- 統計データや調査結果が引用されている

0点: 根拠が全く示されていない、主観的な意見のみ
10点: ある程度の情報はあるが、曖昧
20点: 具体的な数値・日付・情報源が明示されている

JSON Schema:
{
  "score": number,  // 0, 10, 20 のいずれか
  "reason": string  // 評価理由（簡潔に）
}
`;
    const userPrompt = `Title: ${article.title}\n\nSnippet: ${article.snippet}`;

    try {
      const result = this.geminiService.generateJson(
        Config.GEMINI.MODEL_SCREENING, // Flashで十分
        systemPrompt,
        userPrompt
      );
      return result.score || 0;
    } catch (e) {
      console.warn(`Clarity evaluation failed for ${article.title}:`, e);
      return 0; // エラー時はボーナスなし
    }
  }
}
