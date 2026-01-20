class TopicService {
  constructor() {
    this.intakeRepo = new IntakeQueueRepo();
    this.screeningRepo = new ScreeningRepo();
    this.topicRepo = new TopicBacklogRepo();
    this.geminiService = new GeminiService();
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
