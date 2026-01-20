class DeepResearchService {
  constructor() {
    this.intakeRepo = new IntakeQueueRepo();
    this.fetchService = new FetchService();
    this.geminiService = new GeminiService();
    this.projectManager = new ProjectManager();
    this.primarySourceService = new PrimarySourceService();
  }

  /**
   * Promotedアイテムに対してDeep Researchを実行する（トリガー登録版）
   * @param {number} limit
   * @param {number} delayMinutes トリガー実行までの待機時間（分）
   */
  processPromotedItems(limit = 5, delayMinutes = 3) {
    const allIntake = this.intakeRepo.getAll();
    const targets = allIntake.filter(item => item.status === 'promoted').slice(0, limit);
    
    console.log(`Scheduling Deep Research for ${targets.length} items...`);

    targets.forEach((item, index) => {
      try {
        console.log(`Scheduling: ${item.title}`);
        
        // プロジェクトスプシの準備
        const pseudoTopic = {
          topic_id: item.item_id,
          title_working: item.title,
          angle: 'Auto-Research',
          target_media: '[]'
        };
        const projectUrl = this.projectManager.createProject(pseudoTopic);
        
        // トリガー登録（各アイテムを少しずつずらす）
        const delay = delayMinutes + (index * 0.5); // 30秒ずつずらす
        TriggerManager.createDelayedTriggerForTopic('runDeepResearchForTopic', delay, pseudoTopic.topic_id);
        
        console.log(`  -> Scheduled in ${delay} minutes.`);
        
      } catch (e) {
        console.error(`Error scheduling deep research for ${item.item_id}:`, e);
      }
    });
    
    console.log(`All triggers scheduled. Research will start in ${delayMinutes} minutes.`);
  }

  /**
   * 単一トピックに対するDeep Researchを実行（トリガーから呼ばれる・排他制御付き）
   * @param {string} topicId
   */
  static runForTopic(topicId) {
    const lock = LockService.getScriptLock();
    const outputsRepo = new OutputsRepo();
    
    try {
      // ロック取得試行（30秒まで待機）
      if (!lock.tryLock(30000)) {
        console.warn(`[Triggered] Lock acquisition failed for ${topicId}. Skipping.`);
        return;
      }
      
      // ステータス確認
      const currentStatus = outputsRepo.getResearchStatus(topicId);
      if (currentStatus !== 'pending') {
        console.log(`[Triggered] Topic ${topicId} is already ${currentStatus}. Skipping.`);
        lock.releaseLock();
        return;
      }
      
      // ステータスを processing に変更
      outputsRepo.updateResearchStatus(topicId, 'processing');
      lock.releaseLock(); // 早期解放（他のトピックを処理可能に）
      
      console.log(`[Triggered] Starting Deep Research for topic: ${topicId}`);
      
      const service = new DeepResearchService();
      const intakeRepo = new IntakeQueueRepo();
      const item = intakeRepo.getAll().find(i => i.item_id === topicId);
      
      if (!item) {
        console.error(`Item not found: ${topicId}`);
        outputsRepo.updateResearchStatus(topicId, 'failed');
        TriggerManager.cleanupTriggerData(topicId);
        return;
      }
      
      // 調査実行
      service.conductResearch(item, topicId);
      
      // 完了
      outputsRepo.updateResearchStatus(topicId, 'completed');
      TriggerManager.cleanupTriggerData(topicId);
      console.log(`[Triggered] Deep Research completed for: ${topicId}`);
      
    } catch (e) {
      console.error(`[Triggered] Error in deep research for ${topicId}:`, e);
      outputsRepo.updateResearchStatus(topicId, 'failed');
      TriggerManager.cleanupTriggerData(topicId);
      if (lock.hasLock()) lock.releaseLock();
    }
  }

  /**
   * 1つのアイテムに対するリサーチ実行（拡張版）
   * @param {Object} item
   * @param {string} topicId
   */
  conductResearch(item, topicId) {
    // 1. 一次ソースの収集
    console.log('  -> Step 1: Collecting primary sources...');
    const primaryQueries = this.primarySourceService.generatePrimaryQueries(item);
    const primarySources = [];
    primaryQueries.forEach(query => {
      const sources = this.primarySourceService.collect(query);
      primarySources.push(...sources);
      Utilities.sleep(1000);
    });
    console.log(`  -> Collected ${primarySources.length} primary sources.`);

    // 2. 二次ソース（ニュース記事）の収集
    console.log('  -> Step 2: Planning research for news articles...');
    const plan = this.planResearch(item);
    console.log(`  -> Generated ${plan.queries.length} search queries.`);
    
    const newsArticles = [];
    plan.queries.forEach(query => {
      const articles = this.fetchService.fetchByQuery(query, 3);
      articles.forEach(a => {
        a.source_type = 'news';
        a.bias_indicator = 'unknown';
      });
      newsArticles.push(...articles);
      Utilities.sleep(1000);
    });
    console.log(`  -> Collected ${newsArticles.length} news articles.`);

    // 3. プロジェクトシートへの保存
    console.log('  -> Step 3: Saving to project sheet...');
    const allArticles = [...primarySources, ...newsArticles];
    this.saveToProjectSheet(topicId, allArticles);
    
    console.log(`  -> Deep Research Completed (${allArticles.length} sources total).`);
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
   * プロジェクトシートへの保存（拡張版）
   * @param {string} topicId
   * @param {Object[]} articles
   */
  saveToProjectSheet(topicId, articles) {
    const sheet = this.projectManager.getProjectSheet(topicId, '01_Research');
    if (!sheet) {
      console.warn(`Project sheet 01_Research not found for ${topicId}`);
      return;
    }

    // 列構造: source_url, title, published_at, summary, source_type, 
    //         reliability_score, bias_indicator, fact_check_status, stakeholder, key_claims, notes
    const rows = articles.map(a => [
      a.url,
      a.title,
      a.published_at || new Date().toISOString(),
      a.snippet,
      a.source_type || 'news',
      a.reliability_score || 0,
      a.bias_indicator || 'unknown',
      a.fact_check_status || 'unverified',
      a.stakeholder || '',
      '', // key_claims (未抽出)
      'Auto-collected'
    ]);

    if (rows.length > 0) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
  }
}
