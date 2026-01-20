class DeepResearchService {
  constructor() {
    this.intakeRepo = new IntakeQueueRepo();
    this.evidenceRepo = new EvidenceIndexRepo();
    this.fetchService = new FetchService();
    this.geminiService = new GeminiService();
    this.outputsRepo = new OutputsRepo();
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
        this.conductResearch(item);
        Utilities.sleep(3000); 
      } catch (e) {
        console.error(`Error in deep research for ${item.item_id}:`, e);
      }
    });
  }

  /**
   * 1つのアイテムに対するリサーチ実行
   * @param {Object} item
   */
  conductResearch(item) {
    // 1. 調査計画の策定
    console.log('  -> Planning research...');
    const plan = this.planResearch(item);
    console.log(`  -> Generated ${plan.queries.length} search queries.`);

    // 2. 追加情報の収集
    console.log('  -> Collecting additional info...');
    let relatedArticles = [];
    plan.queries.forEach(query => {
      const articles = this.fetchService.fetchByQuery(query);
      // 上位3件程度を採用
      relatedArticles = relatedArticles.concat(articles.slice(0, 3));
      Utilities.sleep(1000);
    });
    console.log(`  -> Collected ${relatedArticles.length} related articles.`);

    // 3. 情報の統合とレポート作成
    console.log('  -> Synthesizing report...');
    const reportMarkdown = this.verifyAndSynthesize(item, relatedArticles, plan);

    // 4. 保存
    console.log('  -> Saving report...');
    const reportUrl = this.saveReport(item, reportMarkdown);
    
    // Outputsに記録
    this.outputsRepo.add({
      topic_id: item.item_id, // item_id を topic_id として扱う（簡易実装）
      md_evidence_url: reportUrl,
      generated_at: new Date().toISOString()
    });

    console.log(`  -> Deep Research Completed. Report: ${reportUrl}`);
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
   * 統合レポートの作成
   * @param {Object} item
   * @param {Object[]} relatedArticles
   * @param {Object} plan
   * @returns {string} Markdown
   */
  verifyAndSynthesize(item, relatedArticles, plan) {
    const relatedText = relatedArticles.map(a => `- ${a.title} (${a.url}): ${a.snippet}`).join('\n');
    
    const systemPrompt = `
あなたは編集長です。
「元の記事」と、追加調査で得られた「関連情報」を突き合わせ、
情報の正確性、多面性、不足情報の補完状況をまとめた「リサーチレポート」をMarkdown形式で作成してください。

構成案:
# リサーチレポート: {記事タイトル}

## 1. 概要
記事の要約。

## 2. 検証結果 (Fact Check)
元の記事の主張と、関連情報との整合性。
- 一致している点
- 矛盾または相違がある点
- 未確認の点

## 3. 多面的な視点
- 異なる立場からの見解
- 過去の経緯や背景

## 4. 参考文献
- 一次ソース候補
- 参照した記事一覧
`;

    const userPrompt = `
Original Article:
Title: ${item.title}
Snippet: ${item.snippet}

Research Plan:
Focus: ${plan.focus_points.join(', ')}

Collected Related Info:
${relatedText}
`;

    return this.geminiService.generateContent(
      Config.GEMINI.MODEL_GENERATION,
      systemPrompt,
      userPrompt
    );
  }

  /**
   * レポートをDriveに保存
   * @param {Object} item
   * @param {string} markdown
   * @returns {string} URL
   */
  saveReport(item, markdown) {
    // ContentServiceのsaveToDriveロジックと重複するが、今回は簡易的に再実装または共通化
    // ここでは簡易実装
    const folders = DriveApp.getFoldersByName(Config.DRIVE.ROOT_FOLDER_NAME);
    let rootFolder;
    if (folders.hasNext()) {
      rootFolder = folders.next();
    } else {
      rootFolder = DriveApp.createFolder(Config.DRIVE.ROOT_FOLDER_NAME);
    }

    const today = new Date().toISOString().slice(0, 10);
    // item_id を使ってフォルダ作成
    const folderName = `${today}__research-${item.item_id.substring(0, 8)}`;
    
    let folder;
    const subFolders = rootFolder.getFoldersByName(folderName);
    if (subFolders.hasNext()) {
      folder = subFolders.next();
    } else {
      folder = rootFolder.createFolder(folderName);
    }

    const file = folder.createFile('01_research_report.md', markdown, MimeType.PLAIN_TEXT);
    return file.getUrl();
  }
}
