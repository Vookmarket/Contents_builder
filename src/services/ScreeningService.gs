class ScreeningService {
  constructor() {
    this.intakeRepo = new IntakeQueueRepo();
    this.screeningRepo = new ScreeningRepo();
    this.geminiService = new GeminiService();
  }

  /**
   * 未処理アイテムをスクリーニングする
   * @param {number} limit
   */
  processQueue(limit = 10) {
    const items = this.intakeRepo.getUnprocessedItems(limit);
    console.log(`Starting screening for ${items.length} items...`);

    items.forEach(item => {
      try {
        console.log(`Screening item: ${item.title}`);
        const result = this.analyzeItem(item);
        
        // 結果保存
        this.screeningRepo.saveResult(result);
        
        // ステータス更新
        let newStatus = 'screened';
        if (result.misinformation_risk === Config.THRESHOLDS.HIGH_MISINFO_RISK) {
          newStatus = 'ignored'; // 高リスクは除外
        } else if ((result.animal_score + result.policy_score) >= Config.THRESHOLDS.PROMOTION_SCORE) {
          newStatus = 'promoted';
        }
        
        this.intakeRepo.update(item.item_id, { status: newStatus });
        console.log(`  -> Done. Status: ${newStatus}`);
        
        // レート制限回避のためのSleep (必要に応じて調整)
        Utilities.sleep(1000);

      } catch (e) {
        console.error(`Error screening item ${item.item_id}:`, e);
        this.intakeRepo.update(item.item_id, { status: 'error', notes: String(e) });
      }
    });
  }

  /**
   * Geminiで分析を実行
   * @param {Object} item
   * @returns {Object} ScreeningResult
   */
  analyzeItem(item) {
    const systemPrompt = `
あなたは動物福祉、環境問題、政治に詳しい専門アナリストです。
入力されたニュース記事（タイトル・抜粋）を分析し、以下の基準で評価・分類してください。
出力は必ずJSON形式で行ってください。

評価基準:
- animal_score (0-5): 動物に関連する度合い。5が直接的、0が無関係。
- policy_score (0-5): 政治、法律、行政、経済活動に関連する度合い。5が法改正や行政処分など、0が単なる話題。
- urgency (0-5): 緊急性。
- japan_relevance (0-5): 日本国内への関連度。5が国内問題、0が海外のみ。
- misinformation_risk (low/med/high): 誤情報、煽り、科学的根拠の欠如のリスク。
- tags: 関連するタグ（例: 動物福祉, 畜産, 法改正, 感染症, 愛護動物, 野生動物, ペット産業, etc.）
- summary_30s: 30秒で読める要約（日本語）。
- key_points: 重要なポイント（箇条書き配列）。
- model_meta: 使用したAIモデル名など。

JSON Schema:
{
  "animal_score": number,
  "policy_score": number,
  "urgency": number,
  "japan_relevance": number,
  "misinformation_risk": "low" | "med" | "high",
  "tags": string[],
  "summary_30s": string,
  "key_points": string[],
  "notes": string
}
`;

    const userPrompt = `
Title: ${item.title}
Source: ${item.url}
Snippet: ${item.snippet}
Date: ${item.published_at}
`;

    const json = this.geminiService.generateJson(
      Config.GEMINI.MODEL_SCREENING,
      systemPrompt,
      userPrompt
    );

    // item_id を付与して返す
    return {
      item_id: item.item_id,
      ...json,
      tags: JSON.stringify(json.tags), // シート保存用に文字列化（SheetBaseで自動対応も可だが明示的に）
      key_points: JSON.stringify(json.key_points),
      model_meta: `${Config.GEMINI.MODEL_SCREENING} / ${Config.GEMINI.PROMPT_VERSION}`
    };
  }
}
