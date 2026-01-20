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

    // 1. Geminiによるキーワード拡張
    const keywords = this.expandKeywords(theme);
    console.log(`Expanded keywords: ${keywords.join(', ')}`);

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
   * Geminiで関連キーワード・組織を抽出
   * @param {string} theme
   * @returns {string[]}
   */
  expandKeywords(theme) {
    const systemPrompt = `
あなたは情報収集のプロフェッショナルです。
入力された「テーマ」について、Googleニュースで網羅的に情報を収集するための「検索キーワード」を5つ挙げて下さい。
以下の観点を含めてください：
1. テーマそのもののキーワード
2. 関連する省庁・公的機関・業界団体名（例: "環境省", "日本獣医師会"）
3. 具体的な法律名や制度名
4. 対立軸や論点（例: "数値規制", "アニマルウェルフェア"）

JSON Schema:
{
  "keywords": string[]
}
`;
    const userPrompt = `Theme: ${theme}`;

    try {
      const json = this.geminiService.generateJson(
        Config.GEMINI.MODEL_SCREENING, // Flashで十分
        systemPrompt,
        userPrompt
      );
      return json.keywords || [theme];
    } catch (e) {
      console.error('Keyword expansion failed:', e);
      return [theme];
    }
  }

  /**
   * キーワードからRSSソースオブジェクトを生成
   * @param {string} theme
   * @param {string[]} keywords
   * @returns {Object[]}
   */
  generateSources(theme, keywords) {
    const sources = [];

    keywords.forEach(kw => {
      // Google News RSS (JP)
      const encodedKw = encodeURIComponent(kw);
      const url = `https://news.google.com/rss/search?q=${encodedKw}+when:1d&hl=ja&gl=JP&ceid=JP:ja`;
      
      sources.push({
        source_id: Utilities.getUuid(),
        name: `Auto: ${kw} (${theme})`,
        type: 'RSS',
        url: url,
        fetch_freq: 'daily',
        lang: 'ja',
        reliability_base: 3,
        enabled: 'TRUE',
        memo: `Generated for theme: ${theme}`
      });
    });

    return sources;
  }
}
