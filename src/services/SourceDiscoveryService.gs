class SourceDiscoveryService {
  constructor() {
    this.sourceRepo = new SourceRegistryRepo();
    this.geminiService = new GeminiService();
  }

  /**
   * テーマに基づいて収集先を自動検出し登録する
   * @param {string} theme ユーザー入力テーマ
   * @returns {number} 登録数
   */
  discoverAndRegister(theme) {
    if (!theme) return 0;
    
    console.log(`Discovering sources for theme: ${theme}`);

    // 1. Geminiによるキーワード拡張（2段階）
    const keywords = this.expandKeywords(theme);
    console.log(`Base keywords: ${keywords.base_keywords.join(', ')}`);
    console.log(`Policy keywords: ${keywords.policy_keywords.join(', ')}`);

    // 2. RSS URLの生成
    const sources = this.generateSources(theme, keywords);

    // 3. 重複チェックと保存
    let addedCount = 0;
    const existingUrls = new Set(this.sourceRepo.getActiveSources().map(s => s.url));

    sources.forEach(source => {
      if (!existingUrls.has(source.url)) {
        this.sourceRepo.add(source);
        existingUrls.add(source.url);
        addedCount++;
        console.log(`  -> Added source: ${source.name}`);
      }
    });

    return addedCount;
  }

  /**
   * Geminiで関連キーワードを2段階で抽出
   * @param {string} theme
   * @returns {Object} { base_keywords: string[], policy_keywords: string[] }
   */
  expandKeywords(theme) {
    const systemPrompt = `
あなたは情報収集のプロフェッショナルです。
入力されたテーマについて、以下の2種類のキーワードを生成してください:

1. ベースキーワード（1〜2個）: テーマそのものや関連トレンド
   - 目的: 時事問題や新しいトレンドを逃さない
   - 例: 「動物愛護」「保護猫」
   
2. 政策焦点キーワード（3〜4個）: テーマ + 法律・政治・経済の複合検索
   - 目的: 法改正、行政、統計など、政策性の高い記事を狙い撃ち
   - Google検索演算子を使った複合クエリを生成
   - 例: 
     - 「動物愛護 AND (法律 OR 改正 OR 政策)」
     - 「動物愛護 AND (統計 OR 調査 OR 報告)」
     - 「動物愛護 AND (省庁 OR 自治体 OR 行政)」

JSON Schema:
{
  "base_keywords": string[],      // 1-2個
  "policy_keywords": string[]     // 3-4個、AND/OR演算子を含む
}
`;
    const userPrompt = `Theme: ${theme}`;

    try {
      const json = this.geminiService.generateJson(
        Config.GEMINI.MODEL_SCREENING,
        systemPrompt,
        userPrompt
      );
      return {
        base_keywords: json.base_keywords || [theme],
        policy_keywords: json.policy_keywords || []
      };
    } catch (e) {
      console.error('Keyword expansion failed:', e);
      return {
        base_keywords: [theme],
        policy_keywords: []
      };
    }
  }

  /**
   * キーワードからRSSソースオブジェクトを生成（ハイブリッド戦略）
   * @param {string} theme
   * @param {Object} keywords { base_keywords: string[], policy_keywords: string[] }
   * @returns {Object[]}
   */
  generateSources(theme, keywords) {
    const sources = [];

    // ベースキーワード: 直近1日（トレンド重視）
    keywords.base_keywords.forEach(kw => {
      const encodedKw = encodeURIComponent(kw);
      const url = `https://news.google.com/rss/search?q=${encodedKw}+when:1d&hl=ja&gl=JP&ceid=JP:ja`;
      
      sources.push({
        source_id: Utilities.getUuid(),
        name: `[Base] ${kw}`,
        type: 'RSS',
        url: url,
        fetch_freq: 'daily',
        lang: 'ja',
        reliability_base: 3,
        enabled: 'TRUE',
        memo: `Base keyword for theme: ${theme}`
      });
    });

    // 政策焦点キーワード: 過去1週間（政策性重視、やや広く）
    keywords.policy_keywords.forEach(kw => {
      const encodedKw = encodeURIComponent(kw);
      const url = `https://news.google.com/rss/search?q=${encodedKw}+when:7d&hl=ja&gl=JP&ceid=JP:ja`;
      
      sources.push({
        source_id: Utilities.getUuid(),
        name: `[Policy] ${kw}`,
        type: 'RSS',
        url: url,
        fetch_freq: 'daily',
        lang: 'ja',
        reliability_base: 4, // 政策焦点は信頼度を少し高く設定
        enabled: 'TRUE',
        memo: `Policy keyword for theme: ${theme}`
      });
    });

    return sources;
  }
}
