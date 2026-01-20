class EvidenceService {
  constructor() {
    this.intakeRepo = new IntakeQueueRepo();
    this.evidenceRepo = new EvidenceIndexRepo();
    this.geminiService = new GeminiService();
  }

  /**
   * Promotedアイテムに対して深掘り調査を行う
   * @param {number} limit
   */
  processPromotedItems(limit = 5) {
    const allIntake = this.intakeRepo.getAll();
    // promoted かつ まだ evidence がない（または調査フラグがない）ものを対象とすべきだが
    // 今回は簡易的に promoted の中から未調査のものを探す（実装省略：毎回実行すると重複するので注意）
    // デモ用として「直近のpromotedアイテム」を対象にする
    
    const targets = allIntake.filter(item => item.status === 'promoted').slice(0, limit);
    console.log(`Starting deep research for ${targets.length} items...`);

    targets.forEach(item => {
      try {
        console.log(`Researching: ${item.title}`);
        
        // 1. 本文取得
        const html = this.fetchHtml(item.url);
        if (!html) {
          console.warn(`  -> Failed to fetch HTML for ${item.url}`);
          return;
        }

        // 2. 分析 (Claims & Evidence Extraction)
        const analysis = this.analyzeContent(item, html);
        
        // 3. 保存
        if (analysis.evidences && analysis.evidences.length > 0) {
          this.evidenceRepo.addAll(analysis.evidences);
          console.log(`  -> Saved ${analysis.evidences.length} evidences.`);
        } else {
          console.log('  -> No significant evidence found.');
        }

        // 4. ステータス更新（調査済みフラグなど。今回は省略）
        
        Utilities.sleep(2000); // Rate limit

      } catch (e) {
        console.error(`Error researching item ${item.item_id}:`, e);
      }
    });
  }

  /**
   * HTML取得と簡易クリーニング
   * @param {string} url
   * @returns {string|null}
   */
  fetchHtml(url) {
    try {
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (response.getResponseCode() !== 200) return null;
      
      let html = response.getContentText();
      // Script, Styleタグの除去
      html = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
      html = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "");
      // タグ除去してテキスト化（長すぎる場合は切り詰め）
      let text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return text.substring(0, 10000); // Geminiへの入力制限考慮 (Flashならもっといけるが安全策)
    } catch (e) {
      console.warn(`Fetch error: ${e.message}`);
      return null;
    }
  }

  /**
   * Geminiで主張と根拠を抽出
   * @param {Object} item
   * @param {string} contentText
   * @returns {Object} { evidences: [] }
   */
  analyzeContent(item, contentText) {
    const systemPrompt = `
あなたはファクトチェッカーです。
ニュース記事の本文から、記事内の主要な「主張（Claims）」と、
その根拠として示されている「情報源（Evidence Candidates）」を抽出してください。
特に、以下の「一次ソース」への言及やリンクがあれば優先して抽出してください。
- 法令、条約、政府公式発表
- 学術論文、統計データ
- 業界団体の公式声明

JSON Schema:
{
  "evidences": [
    {
      "claim_text": string, // 記事内の主張
      "evidence_type": "law" | "statistics" | "paper" | "statement" | "news" | "other",
      "evidence_source": string, // 情報源の名前やURL（もしあれば）
      "primary_flag": boolean, // 一次ソースかどうか
      "confidence": "A" | "B" | "C", // 信頼度
      "evidence_notes": string
    }
  ]
}
`;
    const userPrompt = `
Title: ${item.title}
URL: ${item.url}
Content:
${contentText}
`;

    const json = this.geminiService.generateJson(
      Config.GEMINI.MODEL_SCREENING, // 分析にはFlashで十分か、精度重視ならPro
      systemPrompt,
      userPrompt
    );
    
    // item_id を付与
    const evidences = (json.evidences || []).map(ev => ({
      related_item_id: item.item_id,
      ...ev
    }));

    return { evidences };
  }
}
