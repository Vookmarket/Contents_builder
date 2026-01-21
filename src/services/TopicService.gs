class TopicService {
  constructor() {
    this.intakeRepo = new IntakeQueueRepo();
    this.screeningRepo = new ScreeningRepo();
    this.topicRepo = new TopicBacklogRepo();
    this.geminiService = new GeminiService();
    this.outputsRepo = new OutputsRepo();
    this.projectManager = new ProjectManager();
  }

  /**
   * Deep Research完了済みのアイテムから、高度なトピックを生成する (Phase 7)
   * @param {number} limit
   */
  generateTopicsFromDeepResearch(limit = 3) {
    const completedResearch = this.outputsRepo.getAll()
      .filter(o => o.research_status === 'completed')
      .slice(0, limit);

    console.log(`Generating topics from ${completedResearch.length} completed researches...`);

    completedResearch.forEach(output => {
      try {
        // 既にTopicBacklogに存在するか確認（重複防止）
        const existingTopic = this.topicRepo.getById(output.topic_id);
        if (existingTopic && existingTopic.status !== 'draft') {
          console.log(`Topic ${output.topic_id} already exists and processed. Skipping.`);
          return;
        }

        console.log(`Processing Topic ID: ${output.topic_id}`);
        const context = this._getResearchContext(output.topic_id);
        
        if (!context) {
          console.warn(`No context data found for ${output.topic_id}`);
          return;
        }

        const topics = this.analyzeAndCreateTopicsEnhanced(context);

        topics.forEach(topic => {
          // 既存があれば更新、なければ追加
          if (existingTopic) {
             this.topicRepo.update(output.topic_id, {
               ...topic,
               status: 'draft',
               updated_at: new Date().toISOString()
             });
             console.log(`  -> Updated topic: ${topic.title_working}`);
          } else {
             topic.topic_id = output.topic_id; // IDを引き継ぐ
             topic.created_at = new Date().toISOString();
             topic.status = 'draft';
             this.topicRepo.add(topic);
             console.log(`  -> Created topic: ${topic.title_working}`);
          }
        });

      } catch (e) {
        console.error(`Error generating topic for ${output.topic_id}:`, e);
      }
    });
  }

  /**
   * プロジェクトシートからコンテキスト情報を取得
   * @private
   */
  _getResearchContext(topicId) {
    // 1. Research Sheet (記事データ)
    const researchSheet = this.projectManager.getProjectSheet(topicId, '01_Research');
    if (!researchSheet) return null;
    
    // ヘッダー取得とデータマッピング（簡易実装）
    const rRows = researchSheet.getDataRange().getValues();
    const rHeaders = rRows[0];
    const rData = rRows.slice(1).map(row => {
      const obj = {};
      rHeaders.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });

    // 信頼性が高い、またはバイアスが明確な記事を抽出
    const keyArticles = rData
      .filter(d => d.reliability_score >= 30) // 足切り
      .slice(0, 10)
      .map(d => `- [${d.bias_indicator}] ${d.title} (${d.source_type})`);

    // 2. Timeline Sheet (時系列データ)
    const timelineSheet = this.projectManager.getProjectSheet(topicId, '05_Timeline');
    let timelineEvents = [];
    if (timelineSheet) {
      const tRows = timelineSheet.getDataRange().getValues();
      if (tRows.length > 1) {
        const tHeaders = tRows[0];
        const tData = tRows.slice(1).map(row => {
          const obj = {};
          tHeaders.forEach((h, i) => obj[h] = row[i]);
          return obj;
        });
        timelineEvents = tData.map(d => `- ${d.date}: ${d.event} (${d.category})`);
      }
    }

    return {
      topicId,
      articles: keyArticles.join('\n'),
      timeline: timelineEvents.join('\n')
    };
  }

  /**
   * Geminiで高度なテーマ案を生成
   * @param {Object} context
   * @returns {Object[]}
   */
  analyzeAndCreateTopicsEnhanced(context) {
    const systemPrompt = `
あなたはニュース編集長です。
Deep Researchによって収集された詳細な情報（記事、時系列）を元に、
YouTubeやNoteで発信すべき「今週の注目テーマ」を企画してください。

【重要】
- 単なるニュース紹介ではなく、「なぜ今語るべきか」「どのような対立構造があるか」を深掘りしてください。
- 時系列情報から「文脈（コンテキスト）」を読み取り、解説の切り口（Angle）を提案してください。

JSON Schema:
{
  "topics": [
    {
      "title_working": string, // キャッチーな仮タイトル
      "angle": string,         // 企画の切り口（例: 「法改正の裏側」「賛成派vs反対派の全貌」）
      "target_media": string[], // ["short", "long", "note"]
      "priority": number,      // 1-5
      "lead_item_ids": string[], // 空配列でOK（後で紐付け）
      "notes": string          // 企画のポイント・メモ
    }
  ]
}
`;
    
    const userPrompt = `
Key Articles:
${context.articles}

Timeline / Context:
${context.timeline}
`;

    try {
      const json = this.geminiService.generateJson(
        Config.GEMINI.MODEL_GENERATION,
        systemPrompt,
        userPrompt
      );

      return json.topics.map(t => ({
          ...t,
          target_media: JSON.stringify(t.target_media),
          lead_item_ids: JSON.stringify(t.lead_item_ids || [])
      }));
    } catch (e) {
      console.error('Gemini generation failed:', e);
      return [];
    }
  }

  /**
   * Promotedアイテムから新しいトピックを生成する
   */
  generateTopicsFromPromotedItems() {
    // intakeQueueからpromotedかつ未処理(topic化されていない)のものを探すロジックが必要だが
    // 簡易的に IntakeQueue で promoted のものを取得し、TopicBacklog に紐付いていないものを探す
    // または、IntakeQueueに 'topic_created' ステータスを追加するのが良い
    // ここでは「直近のpromotedアイテム」を取得して、まとめてテーマ生成するアプローチをとる

    const allIntake = this.intakeRepo.getAll();
    const promotedItems = allIntake.filter(item => item.status === 'promoted');

    if (promotedItems.length === 0) {
      console.log('No promoted items found for topic generation.');
      return;
    }

    // すでにトピック化済みのアイテムを除外するロジックは今回省略（冪等性注意）
    // 実際には IntakeQueue.notes に "Topic: ID" を書くか、中間テーブルが必要
    
    // 直近5件を使ってテーマを1つ生成する（デモ用）
    const targetItems = promotedItems.slice(0, 5);
    
    console.log(`Generating topic from ${targetItems.length} items...`);
    const topics = this.analyzeAndCreateTopics(targetItems);

    topics.forEach(topic => {
      // 保存
      topic.created_at = new Date().toISOString();
      topic.status = 'draft';
      this.topicRepo.add(topic);
      console.log(`  -> Created topic: ${topic.title_working}`);
      
      // 使用したアイテムのステータス更新などは省略
    });
  }

  /**
   * Geminiでテーマ案を生成
   * @param {Object[]} items
   * @returns {Object[]}
   */
  analyzeAndCreateTopics(items) {
    const itemsText = items.map(item => `- ${item.title} (${item.url})`).join('\n');

    const systemPrompt = `
あなたはニュース編集長です。以下の注目ニュース記事（タイトル一覧）から、
YouTubeやNoteで発信すべき「今週の注目テーマ」を企画してください。
動物×政治の観点から、深く解説すべきテーマを1つまたは複数提案してください。

JSON Schema:
{
  "topics": [
    {
      "topic_id": string (UUID),
      "title_working": string,
      "angle": "速報" | "解説" | "論点整理",
      "target_media": string[], // ["short", "long", "note"]
      "priority": number (1-5),
      "lead_item_ids": string[] // 関連する記事のURLまたはID
    }
  ]
}
`;
    
    const userPrompt = `
News Items:
${itemsText}
`;

    const json = this.geminiService.generateJson(
      Config.GEMINI.MODEL_GENERATION, // 生成能力の高いモデルを使用
      systemPrompt,
      userPrompt
    );

    return json.topics.map(t => ({
        ...t,
        target_media: JSON.stringify(t.target_media),
        lead_item_ids: JSON.stringify(t.lead_item_ids)
    }));
  }
}
