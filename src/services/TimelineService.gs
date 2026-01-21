class TimelineService {
  constructor() {
    this.fetchService = new FetchService();
    this.geminiService = new GeminiService();
    this.projectManager = new ProjectManager();
  }

  /**
   * 時系列分析を実行
   * @param {string} topicId
   * @param {Object} plan 調査計画（queries_timelineを含む）
   */
  analyze(topicId, plan) {
    console.log(`Starting Timeline Analysis for ${topicId}...`);
    
    // 1. 過去記事の収集
    const timelineQuery = plan.queries_timeline || plan.queries_neutral; // フォールバック
    console.log(`  -> Fetching past articles with query: "${timelineQuery}"`);
    
    // Google News (when:1y)
    const pastArticles = this.fetchService.fetchByQuery(timelineQuery, 10, '1y');
    
    // 法令検索 (site:elaws.e-gov.go.jp)
    // クエリからキーワードのみ抽出して法令検索用クエリを作成
    const keywords = timelineQuery.replace(/経緯|歴史|背景/g, '').trim();
    const lawQuery = `${keywords} site:elaws.e-gov.go.jp`;
    const lawArticles = this.fetchService.fetchByQuery(lawQuery, 5);

    const allArticles = [...pastArticles, ...lawArticles];
    console.log(`  -> Collected ${allArticles.length} articles for timeline analysis.`);

    if (allArticles.length === 0) {
      console.warn('  -> No articles found for timeline analysis.');
      return;
    }

    // 2. Geminiによるイベント抽出
    console.log('  -> Extracting key events using Gemini...');
    const events = this.extractEvents(allArticles);
    console.log(`  -> Extracted ${events.length} events.`);

    // 3. シートへの保存
    if (events.length > 0) {
      this.saveEvents(topicId, events);
      console.log('  -> Saved events to 05_Timeline sheet.');
    }
  }

  /**
   * 記事群から重要イベントを抽出
   * @param {Object[]} articles
   * @returns {Object[]}
   */
  extractEvents(articles) {
    // 記事の要約リストを作成（トークン節約のため各記事100文字程度に制限）
    const articlesText = articles.map((a, i) => {
      const date = a.published_at ? a.published_at.substring(0, 10) : 'Unknown Date';
      return `[${i+1}] Date:${date} Title:${a.title} Snippet:${a.snippet.substring(0, 100)}`;
    }).join('\n\n');

    const systemPrompt = `
あなたは調査ジャーナリストです。
提供されたニュース記事群から、このトピックに関連する重要な出来事を時系列で抽出してください。

【抽出基準】
- 法改正、施行、閣議決定
- 重大な事件、事故、摘発
- 重要な統計発表、報告書公開
- 大規模なデモ、署名活動、判決
- 日付が特定できるものを優先してください

【除外基準】
- 単なる意見記事やコラム
- 日付が不明瞭なもの（「最近」「数年前」など）
- トピックと関連性が低いもの

JSON Schema:
{
  "events": [
    {
      "date": "YYYY-MM-DD", // 日付 (不明な場合は "YYYY-MM" または "YYYY")
      "event": string,      // 出来事の内容 (簡潔に)
      "category": "law" | "incident" | "policy" | "statistics" | "other",
      "source_index": number // 元記事の番号 [1]など
    }
  ]
}
`;
    
    // コンテキスト制限を考慮し、最大文字数を制限
    const truncatedText = articlesText.substring(0, 15000); 

    try {
      const result = this.geminiService.generateJson(
        Config.GEMINI.MODEL_GENERATION,
        systemPrompt,
        truncatedText
      );

      // 結果にURLを紐付け
      return result.events.map(evt => {
        const article = articles[evt.source_index - 1];
        return {
          ...evt,
          source_url: article ? article.url : ''
        };
      });

    } catch (e) {
      console.error('Error extracting events:', e);
      return [];
    }
  }

  /**
   * 05_Timeline シートへ保存
   * @param {string} topicId
   * @param {Object[]} events
   */
  saveEvents(topicId, events) {
    const sheet = this.projectManager.getProjectSheet(topicId, '05_Timeline');
    if (!sheet) {
      console.warn(`Project sheet 05_Timeline not found for ${topicId}`);
      return;
    }

    // 日付順にソート
    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    // ヘッダー: date, event, source_url, category
    const rows = events.map(e => [
      e.date,
      e.event,
      e.source_url,
      e.category
    ]);

    if (rows.length > 0) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
  }
}
