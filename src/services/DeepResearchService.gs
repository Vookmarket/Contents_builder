class DeepResearchService {
  constructor() {
    this.intakeRepo = new IntakeQueueRepo();
    this.fetchService = new FetchService();
    this.geminiService = new GeminiService();
    this.projectManager = new ProjectManager();
  }

  /**
   * Promotedアイテムに対してDeep Researchを実行する
   * @param {number} limit
   */
  processPromotedItems(limit = 1) { // 処理が重いのでデフォルトは少なめに
    const allIntake = this.intakeRepo.getAll();
    const targets = allIntake.filter(item => item.status === 'promoted').slice(0, limit);
    
    console.log(`Starting Deep Research for ${targets.length} items...`);

    targets.forEach(item => {
      try {
        console.log(`Researching: ${item.title}`);
        
        // プロジェクトスプシの準備
        // (Topic化前なので item_id を topic_id として扱う)
        const pseudoTopic = {
          topic_id: item.item_id,
          title_working: item.title,
          angle: 'Auto-Research',
          target_media: '[]'
        };
        const projectUrl = this.projectManager.createProject(pseudoTopic);
        
        this.conductResearch(item, pseudoTopic.topic_id);
        
        // 完了後のステータス更新などは省略
        
        Utilities.sleep(3000); 
      } catch (e) {
        console.error(`Error in deep research for ${item.item_id}:`, e);
      }
    });
  }

  /**
   * 1つのアイテムに対するリサーチ実行
   * @param {Object} item
   * @param {string} topicId
   */
  conductResearch(item, topicId) {
    // 1. 調査計画の策定
    console.log('  -> Planning research...');
    const plan = this.planResearch(item);
    console.log(`  -> Generated ${plan.queries.length} search queries.`);

    // 2. 追加情報の収集
    console.log('  -> Collecting additional info...');
    let relatedArticles = [];
    plan.queries.forEach(query => {
      const articles = this.fetchService.fetchByQuery(query);
      relatedArticles = relatedArticles.concat(articles.slice(0, 3));
      Utilities.sleep(1000);
    });
    console.log(`  -> Collected ${relatedArticles.length} related articles.`);

    // 3. プロジェクトシートへの保存
    console.log('  -> Saving to project sheet...');
    this.saveToProjectSheet(topicId, relatedArticles);
    
    console.log(`  -> Deep Research Completed.`);
  }

  /**
   * 調査計画の生成
   * @param {Object} item
   * @returns {Object} { queries: string[], focus_points: string[] }
   */
  planResearch(item) {
    const systemPrompt = `
あなたは調査ジャーナリストです。
ニュース記事のタイトルと概要から、この記事の信憑性を検証し、背景理解を深めるために
「追加調査すべき検索キーワード」を3つ挙げて下さい。
特に、一次ソース（法令、統計、公式発表）や、対立する視点を探すためのキーワードを含めてください。

JSON Schema:
{
  "queries": string[],
  "focus_points": string[] // 何を確認しようとしているか
}
`;
    const userPrompt = `Title: ${item.title}\nSnippet: ${item.snippet}`;

    try {
      return this.geminiService.generateJson(
        Config.GEMINI.MODEL_GENERATION, // Proを使用
        systemPrompt,
        userPrompt
      );
    } catch (e) {
      console.warn('Research planning failed, using fallback.');
      return { queries: [item.title], focus_points: [] };
    }
  }

  /**
   * プロジェクトシートへの保存
   * @param {string} topicId
   * @param {Object[]} articles
   */
  saveToProjectSheet(topicId, articles) {
    const sheet = this.projectManager.getProjectSheet(topicId, '01_Research');
    if (!sheet) {
      console.warn(`Project sheet 01_Research not found for ${topicId}`);
      return;
    }

    const rows = articles.map(a => [
      a.url,
      a.title,
      a.published_at || new Date().toISOString(),
      a.snippet,
      '', // key_claims (未抽出)
      '', // reliability
      'Auto-collected'
    ]);

    if (rows.length > 0) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
  }
}
