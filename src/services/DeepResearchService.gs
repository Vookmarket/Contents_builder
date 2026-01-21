class DeepResearchService {
  constructor() {
    this.intakeRepo = new IntakeQueueRepo();
    this.fetchService = new FetchService();
    this.geminiService = new GeminiService();
    this.projectManager = new ProjectManager();
    this.primarySourceService = new PrimarySourceService();
    this.timelineService = new TimelineService();
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
   * 1つのアイテムに対するリサーチ実行（Phase 4: 多面的視点対応版）
   * @param {Object} item
   * @param {string} topicId
   */
  conductResearch(item, topicId) {
    // 1. 一次ソースの収集（既存の一次ソース収集サービス）
    console.log('  -> Step 1: Collecting primary sources...');
    const primaryQueries = this.primarySourceService.generatePrimaryQueries(item);
    const primarySources = [];
    primaryQueries.forEach(query => {
      const sources = this.primarySourceService.collect(query);
      primarySources.push(...sources);
      Utilities.sleep(1000);
    });
    console.log(`  -> Collected ${primarySources.length} primary sources.`);

    // 2. 多面的視点での調査計画生成
    console.log('  -> Step 2: Planning multi-perspective research...');
    const plan = this.planResearch(item);
    console.log('  -> Generated queries for 4 perspectives (pro/con/neutral/primary).');

    // 3. 推進派の意見収集
    console.log('  -> Step 3a: Collecting pro-perspective articles...');
    const proArticles = this.fetchService.fetchByQuery(plan.queries_pro, 3);
    proArticles.forEach(a => {
      a.source_type = 'news';
      a.bias_indicator = 'pro';
    });
    console.log(`  -> Collected ${proArticles.length} pro-perspective articles.`);
    Utilities.sleep(1000);

    // 4. 反対派の意見収集
    console.log('  -> Step 3b: Collecting con-perspective articles...');
    const conArticles = this.fetchService.fetchByQuery(plan.queries_con, 3);
    conArticles.forEach(a => {
      a.source_type = 'news';
      a.bias_indicator = 'con';
    });
    console.log(`  -> Collected ${conArticles.length} con-perspective articles.`);
    Utilities.sleep(1000);

    // 5. 中立的分析の収集
    console.log('  -> Step 3c: Collecting neutral-perspective articles...');
    const neutralArticles = this.fetchService.fetchByQuery(plan.queries_neutral, 3);
    neutralArticles.forEach(a => {
      a.source_type = 'news';
      a.bias_indicator = 'neutral';
    });
    console.log(`  -> Collected ${neutralArticles.length} neutral-perspective articles.`);
    Utilities.sleep(1000);

    // 6. 追加の一次ソース収集（計画生成されたクエリから）
    console.log('  -> Step 3d: Collecting additional primary sources...');
    const additionalPrimary = this.fetchService.fetchByQuery(plan.queries_primary, 3);
    additionalPrimary.forEach(a => {
      a.source_type = a.source_type || 'official'; // 既存のsource_typeを維持、なければofficial
      a.bias_indicator = 'neutral'; // 一次ソースは中立
    });
    console.log(`  -> Collected ${additionalPrimary.length} additional primary sources.`);
    Utilities.sleep(1000);

    // 7. 信頼性評価
    console.log('  -> Step 4: Evaluating reliability...');
    const evaluator = new ReliabilityEvaluator();
    const allArticles = [...primarySources, ...proArticles, ...conArticles, ...neutralArticles, ...additionalPrimary];
    allArticles.forEach(article => {
      article.reliability_score = evaluator.evaluate(article);
      Utilities.sleep(500); // Gemini API レート制限対策
    });
    console.log(`  -> Reliability evaluation completed.`);

    // 8. プロジェクトシートへの保存
    console.log('  -> Step 5: Saving to project sheet...');
    this.saveToProjectSheet(topicId, allArticles);
    
    // 9. ファクトチェック実行
    console.log('  -> Step 6: Fact checking...');
    const factCheckService = new FactCheckService();
    factCheckService.verify(item, topicId);

    // 10. 時系列分析実行 (Phase 6)
    console.log('  -> Step 7: Analyzing timeline...');
    this.timelineService.analyze(topicId, plan);
    
    // 視点別の集計をログ出力
    const stats = {
      total: allArticles.length,
      pro: proArticles.length,
      con: conArticles.length,
      neutral: neutralArticles.length,
      primary: primarySources.length + additionalPrimary.length
    };
    console.log(`  -> Deep Research Completed: Total=${stats.total}, Pro=${stats.pro}, Con=${stats.con}, Neutral=${stats.neutral}, Primary=${stats.primary}`);
  }

  /**
   * 調査計画の生成（Phase 4: 多面的視点対応）
   * @param {Object} item
   * @returns {Object} { queries_pro: string, queries_con: string, queries_neutral: string, queries_primary: string, focus_points: string[] }
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
        Config.GEMINI.MODEL_GENERATION, // Proを使用
        systemPrompt,
        userPrompt
      );
      
      // レスポンス検証（フォールバック対策）
      if (!result.queries_pro || !result.queries_con || !result.queries_neutral || !result.queries_primary || !result.queries_timeline) {
        console.warn('Incomplete response from Gemini, using fallback.');
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
   * @param {Object} item
   * @returns {Object}
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
