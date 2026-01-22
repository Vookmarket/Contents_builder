/**
 * 一次ソース（公的機関・法令・統計）収集サービス
 */
class PrimarySourceService {
  constructor() {
    this.fetchService = new FetchService();
    this.geminiService = new GeminiService();
  }

  /**
   * 一次ソースを包括的に収集（簡素化版）
   * @param {string} query ベースとなる検索クエリ
   * @returns {Object[]} 収集した一次ソース記事
   */
  collect(query) {
    console.log(`Collecting primary sources for: ${query}`);
    
    const results = [];
    
    // タイムアウト対策: 最も重要な政府機関のみに絞る
    // 1. 政府機関プレスリリース（最重要サイトのみ）
    results.push(...this.collectGovernmentReleases(query));
    
    // 2. 法令情報（件数削減）
    results.push(...this.collectLegalInfo(query));
    
    // 3. 統計データはスキップ（処理時間短縮のため）
    // results.push(...this.collectStatistics(query));
    
    console.log(`Collected ${results.length} primary sources.`);
    return results;
  }

  /**
   * 政府機関のプレスリリースを収集
   * @param {string} query
   * @returns {Object[]}
   */
  collectGovernmentReleases(query) {
    const results = [];
    // タイムアウト対策: サイト数を削減
    const sites = [
      'env.go.jp',        // 環境省（最重要）
      'maff.go.jp'        // 農林水産省
    ];

    sites.forEach(site => {
      try {
        const siteQuery = `site:${site} プレスリリース ${query}`;
        const articles = this.fetchService.fetchByQuery(siteQuery, 1); // 各サイト1件まで
        
        articles.forEach(article => {
          article.source_type = 'official';
          article.reliability_score = 95; // 政府機関は高信頼
          article.bias_indicator = 'neutral';
        });
        
        results.push(...articles);
        Utilities.sleep(500); // レート制限対策（短縮）
      } catch (e) {
        console.warn(`Failed to fetch from ${site}:`, e);
      }
    });

    return results;
  }

  /**
   * 法令情報を収集
   * @param {string} query
   * @returns {Object[]}
   */
  collectLegalInfo(query) {
    const results = [];
    
    try {
      // e-Gov法令検索（件数削減）
      const legalQuery = `site:elaws.e-gov.go.jp ${query}`;
      const articles = this.fetchService.fetchByQuery(legalQuery, 1);
      
      articles.forEach(article => {
        article.source_type = 'law';
        article.reliability_score = 100; // 法令は最高信頼
        article.bias_indicator = 'neutral';
        article.snippet = this.extractLegalSummary(article);
      });
      
      results.push(...articles);
    } catch (e) {
      console.warn('Failed to fetch legal info:', e);
    }

    return results;
  }

  /**
   * 統計データを収集
   * @param {string} query
   * @returns {Object[]}
   */
  collectStatistics(query) {
    const results = [];
    
    try {
      // e-Stat（政府統計ポータル）
      const statQuery = `site:e-stat.go.jp ${query}`;
      const articles = this.fetchService.fetchByQuery(statQuery, 2);
      
      articles.forEach(article => {
        article.source_type = 'statistics';
        article.reliability_score = 95;
        article.bias_indicator = 'neutral';
      });
      
      results.push(...articles);
    } catch (e) {
      console.warn('Failed to fetch statistics:', e);
    }

    return results;
  }

  /**
   * 法令ページから要約を抽出（Gemini使用）
   * @param {Object} article
   * @returns {string}
   */
  extractLegalSummary(article) {
    if (!article.snippet) return '';
    
    // 簡易版: snippetをそのまま使用
    // 将来的にはGeminiで法令の条文を要約可能
    return article.snippet;
  }

  /**
   * 一次ソースの検索クエリを生成（Gemini使用・簡素化版）
   * @param {Object} item 元記事
   * @returns {string[]} 一次ソース検索用クエリ
   */
  generatePrimaryQueries(item) {
    const systemPrompt = `
あなたは調査ジャーナリストです。
ニュース記事のタイトルと概要から、この記事の信憑性を検証するために
参照すべき「一次ソース」（政府発表、法令）を探すための
最も重要な検索キーワードを1つだけ生成してください。

例:
- 「環境省 動物愛護 統計 2024」
- 「動物愛護管理法 改正」

JSON Schema:
{
  "queries": string[]  // 1つの検索クエリ
}
`;
    const userPrompt = `Title: ${item.title}\nSnippet: ${item.snippet}`;

    try {
      const result = this.geminiService.generateJson(
        Config.GEMINI.MODEL_GENERATION,
        systemPrompt,
        userPrompt
      );
      return result.queries || [];
    } catch (e) {
      console.warn('Failed to generate primary queries, using fallback.');
      return [`${item.title} 政府`]; // フォールバックも1つに
    }
  }
}
