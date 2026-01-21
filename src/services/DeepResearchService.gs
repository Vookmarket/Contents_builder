class DeepResearchService {
  constructor() {
    this.intakeRepo = new IntakeQueueRepo();
    this.fetchService = new FetchService();
    this.geminiService = new GeminiService();
    this.projectManager = new ProjectManager();
    this.primarySourceService = new PrimarySourceService();
    this.timelineService = new TimelineService();
    this.outputsRepo = new OutputsRepo();
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
        this.projectManager.createProject(pseudoTopic);
        
        // トリガー登録（各アイテムを少しずつずらす）
        const delay = delayMinutes + (index * 2); // 2分ずつずらす
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
   * ステップ実行パターン (Step 1 -> Step 2 -> Step 3)
   * @param {string} topicId
   */
  static runForTopic(topicId) {
    const lock = LockService.getScriptLock();
    const outputsRepo = new OutputsRepo();
    const service = new DeepResearchService();
    
    try {
      if (!lock.tryLock(30000)) {
        console.warn(`[Triggered] Lock acquisition failed for ${topicId}. Skipping.`);
        return;
      }
      
      const currentStatus = outputsRepo.getResearchStatus(topicId);
      console.log(`[Triggered] Topic ${topicId} status: ${currentStatus}`);

      // ステップ分岐
      if (currentStatus === 'pending') {
        // Step 1: Collection
        outputsRepo.updateResearchStatus(topicId, 'processing_collected'); // 先に更新してロック解放
        lock.releaseLock();
        
        console.log(`[Step 1] Starting Collection for ${topicId}`);
        service.executeStep1_Collection(topicId);
        
        // 次のステップを予約
        TriggerManager.createDelayedTriggerForTopic('runDeepResearchForTopic', 1, topicId);
        console.log(`[Step 1] Completed. Next step scheduled.`);

      } else if (currentStatus === 'processing_collected') {
        // Step 2: Evaluation
        outputsRepo.updateResearchStatus(topicId, 'processing_evaluated');
        lock.releaseLock();

        console.log(`[Step 2] Starting Evaluation for ${topicId}`);
        service.executeStep2_Evaluation(topicId);
        
        // 次のステップを予約
        TriggerManager.createDelayedTriggerForTopic('runDeepResearchForTopic', 1, topicId);
        console.log(`[Step 2] Completed. Next step scheduled.`);

      } else if (currentStatus === 'processing_evaluated') {
        // Step 3: Analysis
        outputsRepo.updateResearchStatus(topicId, 'processing_analyzing'); // 仮ステータス
        lock.releaseLock();

        console.log(`[Step 3] Starting Analysis for ${topicId}`);
        service.executeStep3_Analysis(topicId);
        
        // 完了
        outputsRepo.updateResearchStatus(topicId, 'completed');
        TriggerManager.cleanupTriggerData(topicId);
        console.log(`[Step 3] Completed. All Done.`);

      } else if (currentStatus === 'completed') {
        console.log('Already completed.');
        lock.releaseLock();
        TriggerManager.cleanupTriggerData(topicId);
      } else {
        console.log(`Unknown or processing status: ${currentStatus}`);
        lock.releaseLock();
      }
      
    } catch (e) {
      console.error(`[Triggered] Error in deep research for ${topicId}:`, e);
      // エラー時は failed にせず、再試行できるようにそのままにするか、あるいは failed にするか要検討
      // 今回は failed にしてループを防ぐ
      outputsRepo.updateResearchStatus(topicId, 'failed');
      TriggerManager.cleanupTriggerData(topicId);
      if (lock.hasLock()) lock.releaseLock();
    }
  }

  /**
   * Step 1: 情報収集と保存
   * @param {string} topicId 
   */
  executeStep1_Collection(topicId) {
    const intakeRepo = new IntakeQueueRepo();
    const item = intakeRepo.getAll().find(i => i.item_id === topicId);
    if (!item) throw new Error(`Item not found: ${topicId}`);

    // 1. 一次ソースの収集
    console.log('  -> Step 1a: Collecting primary sources...');
    const primaryQueries = this.primarySourceService.generatePrimaryQueries(item);
    const primarySources = [];
    primaryQueries.forEach(query => {
      const sources = this.primarySourceService.collect(query);
      primarySources.push(...sources);
      Utilities.sleep(1000);
    });

    // 2. 調査計画生成
    console.log('  -> Step 1b: Planning multi-perspective research...');
    const plan = this.planResearch(item);
    
    // 3-6. 記事収集
    const fetchAndTag = (queries, type, bias) => {
        const articles = this.fetchService.fetchByQuery(queries, 3);
        articles.forEach(a => {
            a.source_type = type;
            a.bias_indicator = bias;
            a.reliability_score = ''; // 未評価
        });
        return articles;
    };

    const proArticles = fetchAndTag(plan.queries_pro, 'news', 'pro');
    Utilities.sleep(1000);
    const conArticles = fetchAndTag(plan.queries_con, 'news', 'con');
    Utilities.sleep(1000);
    const neutralArticles = fetchAndTag(plan.queries_neutral, 'news', 'neutral');
    Utilities.sleep(1000);
    const additionalPrimary = fetchAndTag(plan.queries_primary, 'official', 'neutral');

    const allArticles = [...primarySources, ...proArticles, ...conArticles, ...neutralArticles, ...additionalPrimary];
    
    // 保存 (reliability_score は空のまま)
    console.log(`  -> Saving ${allArticles.length} articles to sheet...`);
    this.saveToProjectSheet(topicId, allArticles);
    
    // Plan情報を一時保存（Step 3で使うためPropertiesServiceなどを使う手もあるが、今回は再生成か、シートから読むか）
    // Timeline分析のためにPlanが必要だが、Step 3で再生成しても良いし、IntakeQueueのnotesなどに保存しても良い。
    // 今回はシンプルに、Step 3でも planResearch を呼ぶ（冪等性が高いのでOK）
  }

  /**
   * Step 2: 信頼性評価
   * @param {string} topicId 
   */
  executeStep2_Evaluation(topicId) {
    const sheet = this.projectManager.getProjectSheet(topicId, '01_Research');
    if (!sheet) throw new Error('Research sheet not found');

    const rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) {
      console.log('No articles to evaluate.');
      return;
    }

    const headers = rows[0];
    const reliabilityIndex = headers.indexOf('reliability_score');
    const urlIndex = headers.indexOf('source_url');
    const titleIndex = headers.indexOf('title');
    const snippetIndex = headers.indexOf('summary');

    if (reliabilityIndex === -1) throw new Error('Column reliability_score not found');

    const evaluator = new ReliabilityEvaluator();
    
    // ヘッダーを除く行を走査
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const score = row[reliabilityIndex];
      
      // スコアが空、または0の場合に評価実行
      if (score === '' || score === 0 || score === '0') {
        const article = {
          url: row[urlIndex],
          title: row[titleIndex],
          snippet: row[snippetIndex]
        };
        
        try {
          console.log(`  -> Evaluating: ${article.title.substring(0, 20)}...`);
          const newScore = evaluator.evaluate(article);
          sheet.getRange(i + 1, reliabilityIndex + 1).setValue(newScore);
          Utilities.sleep(800); // レート制限対策
        } catch (e) {
          console.error(`Failed to evaluate row ${i+1}`, e);
        }
      }
    }
  }

  /**
   * Step 3: 分析（ファクトチェック・時系列）
   * @param {string} topicId 
   */
  executeStep3_Analysis(topicId) {
    const intakeRepo = new IntakeQueueRepo();
    const item = intakeRepo.getAll().find(i => i.item_id === topicId);
    if (!item) throw new Error(`Item not found: ${topicId}`);

    // ファクトチェック
    console.log('  -> Step 3a: Fact checking...');
    const factCheckService = new FactCheckService();
    factCheckService.verify(item, topicId);

    // 時系列分析
    console.log('  -> Step 3b: Analyzing timeline...');
    // Planを再生成（軽量なのでOK）
    const plan = this.planResearch(item); 
    this.timelineService.analyze(topicId, plan);
  }

  /**
   * 調査計画の生成
   * @param {Object} item
   * @returns {Object} 
   */
  planResearch(item) {
    const systemPrompt = `
あなたは調査ジャーナリストです。
以下の記事について、多面的に情報を収集するため、異なる視点からの検索クエリを生成してください。

【重要】記事のテーマに応じて、以下4種類のクエリを生成してください：

1. **推進派・賛成派の意見を探すクエリ**
   - この問題に対して前向き・賛成の立場を取る意見を探すためのキーワード
   - 例: 「動物愛護法 改正 必要性」「ペット業界 規制強化 賛成」

2. **反対派・慎重派の意見を探すクエリ**
   - この問題に対して慎重・反対の立場を取る意見を探すためのキーワード
   - 例: 「動物愛護法 改正 懸念」「ペット業界 規制 負担」

3. **中立的な分析・解説を探すクエリ**
   - 客観的な分析や専門家の解説を探すためのキーワード
   - 例: 「動物愛護法 改正 影響分析」「ペット業界 現状 課題」

4. **一次ソースを探すクエリ**
   - 政府機関、法令、統計など公式情報を探すためのキーワード
   - site:演算子を活用してください
   - 例: 「動物愛護管理法 site:env.go.jp」「ペット統計 site:e-stat.go.jp」

5. **時系列・背景を探すクエリ**
   - この問題の経緯、過去の法改正、歴史的背景を探すためのキーワード
   - 過去1年以上の期間を検索対象とするため、汎用的なキーワードを含めてください
   - 例: 「動物愛護法 改正 経緯」「ペット 規制 歴史」

JSON Schema:
{
  "queries_pro": string,      // 推進派クエリ
  "queries_con": string,      // 反対派クエリ
  "queries_neutral": string,  // 中立クエリ
  "queries_primary": string,  // 一次ソースクエリ
  "queries_timeline": string, // 時系列クエリ
  "focus_points": string[]    // 何を確認しようとしているか
}
`;
    const userPrompt = `Title: ${item.title}\nSnippet: ${item.snippet}`;

    try {
      const result = this.geminiService.generateJson(
        Config.GEMINI.MODEL_GENERATION, 
        systemPrompt,
        userPrompt
      );
      
      if (!result.queries_pro || !result.queries_con) {
        return this._getFallbackPlan(item);
      }
      return result;
    } catch (e) {
      console.warn('Research planning failed, using fallback.', e);
      return this._getFallbackPlan(item);
    }
  }

  /**
   * フォールバック用の調査計画生成
   * @private
   */
  _getFallbackPlan(item) {
    const baseKeyword = item.title.split(/[\s　]/)[0] || item.title;
    return {
      queries_pro: `${baseKeyword} 必要`,
      queries_con: `${baseKeyword} 懸念`,
      queries_neutral: `${baseKeyword} 分析`,
      queries_primary: `${baseKeyword} site:go.jp`,
      queries_timeline: `${baseKeyword} 経緯 歴史`,
      focus_points: ['基本情報の確認']
    };
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

    // 列構造に合わせる
    const rows = articles.map(a => [
      a.url,
      a.title,
      a.published_at || new Date().toISOString(),
      a.snippet,
      a.source_type || 'news',
      a.reliability_score || '', // 空文字で保存
      a.bias_indicator || 'unknown',
      a.fact_check_status || 'unverified',
      a.stakeholder || '',
      '', 
      'Auto-collected'
    ]);

    if (rows.length > 0) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
  }
}
