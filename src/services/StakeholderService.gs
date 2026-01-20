class StakeholderService {
  constructor() {
    this.topicRepo = new TopicBacklogRepo();
    this.evidenceRepo = new EvidenceIndexRepo();
    this.stakeholderRepo = new StakeholderMapRepo();
    this.geminiService = new GeminiService();
  }

  /**
   * ドラフト状態のトピックに対してステークホルダー分析を行う
   * @param {number} limit
   */
  analyzeStakeholdersForDraftTopics(limit = 3) {
    // 本当は 'researching' ステータスなどを設けるべきだが、今回は draft から抽出
    const topics = this.topicRepo.getByStatus('draft').slice(0, limit);
    console.log(`Analyzing stakeholders for ${topics.length} topics...`);

    topics.forEach(topic => {
      try {
        console.log(`Analyzing Topic: ${topic.title_working}`);
        
        // 関連するEvidenceを取得（トピックに紐付いたitem_id経由で引く必要があるが、
        // 現状の簡易実装ではTopicに紐付くEvidenceを直接引けないため、
        // Topic生成時に使った lead_item_ids を使う）
        
        let leadItemIds = [];
        try {
          leadItemIds = JSON.parse(topic.lead_item_ids || '[]');
        } catch (e) {
          console.warn('Failed to parse lead_item_ids');
        }

        // 関連するEvidenceを集める
        let contextText = `Topic: ${topic.title_working}\nAngle: ${topic.angle}\n\nRelated Evidence/Claims:\n`;
        
        leadItemIds.forEach(itemId => {
          const evidences = this.evidenceRepo.getByItemId(itemId);
          evidences.forEach(ev => {
            contextText += `- Claim: ${ev.claim_text} (Source: ${ev.evidence_source})\n`;
          });
        });

        // Geminiで分析
        const stakeholders = this.extractStakeholders(contextText);
        
        // 保存
        if (stakeholders.length > 0) {
          stakeholders.forEach(s => {
            s.topic_id = topic.topic_id;
            this.stakeholderRepo.add(s);
          });
          console.log(`  -> Saved ${stakeholders.length} stakeholders.`);
        } else {
          console.log('  -> No stakeholders found.');
        }
        
        // ステータス更新はしない（次のコンテンツ生成で使うため）
        
        Utilities.sleep(2000);

      } catch (e) {
        console.error(`Error analyzing topic ${topic.topic_id}:`, e);
      }
    });
  }

  /**
   * Geminiでステークホルダーを抽出
   * @param {string} contextText
   * @returns {Object[]}
   */
  extractStakeholders(contextText) {
    const systemPrompt = `
あなたは政治アナリストです。
提供されたトピックと関連情報（主張・根拠）から、この問題に関わる主要な「ステークホルダー（利害関係者）」を抽出・分析してください。
政治的な対立構造や協力関係を明らかにするために、以下の情報を特定してください。

カテゴリ例: 行政, 政党, 業界団体, 企業, 研究者, NGO, 市民団体, 国際機関, その他

JSON Schema:
{
  "stakeholders": [
    {
      "stakeholder_name": string, // 具体的な組織名や人物名
      "category": string,
      "interest": string, // 利害・関心（何を守りたいか、何を得たいか）
      "stance": "賛成" | "反対" | "中立" | "慎重" | "推進" | "分裂", 
      "reference_url": string // 根拠となるURLがあれば（今回は空でよい）
    }
  ]
}
`;
    const userPrompt = `
Context:
${contextText}
`;

    const json = this.geminiService.generateJson(
      Config.GEMINI.MODEL_GENERATION, // 分析・推論なのでProを使用
      systemPrompt,
      userPrompt
    );

    return json.stakeholders || [];
  }
}
