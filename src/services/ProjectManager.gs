class ProjectManager {
  constructor() {
    this.topicRepo = new TopicBacklogRepo();
  }

  /**
   * トピック専用のプロジェクトスプレッドシートを作成・初期化する
   * @param {Object} topic
   * @returns {string} Spreadsheet URL
   */
  createProject(topic) {
    // 既存チェック（簡易）：TopicBacklogにURLがあればそれを使う
    // （※本来はTopicBacklogにproject_urlカラムを追加すべきだが、今回はOutputsRepoを使うか、Topicのnotesに書くか。
    // ここではTopicBacklog自体には書き込まず、Outputsに記録する形をとるか？
    // いや、Topicと1対1ならTopicBacklogに持たせるのが自然。
    // 今回は topic.project_url があると仮定して進めるか、OutputsRepo で管理するか。
    // 設計書に従い、TopicBacklogに project_url を持たせる前提で進めるが、
    // Repoにはまだそのカラム定義がないため、動的に追加されることを期待するか、OutputsRepoを使う。）
    
    // 安全策：OutputsRepoで管理する
    const outputsRepo = new OutputsRepo();
    const existing = outputsRepo.getAll().find(o => o.topic_id === topic.topic_id);
    if (existing && existing.project_sheet_url) {
      console.log(`Project spreadsheet already exists: ${existing.project_sheet_url}`);
      return existing.project_sheet_url;
    }

    console.log(`Creating project spreadsheet for topic: ${topic.title_working}`);

    // 1. フォルダ作成/取得
    const folders = DriveApp.getFoldersByName(Config.DRIVE.ROOT_FOLDER_NAME);
    let rootFolder;
    if (folders.hasNext()) rootFolder = folders.next();
    else rootFolder = DriveApp.createFolder(Config.DRIVE.ROOT_FOLDER_NAME);

    const today = new Date().toISOString().slice(0, 10);
    const folderName = `${today}_${topic.title_working.substring(0, 20)}`; // 長すぎるとエラーになるかも
    const projectFolder = rootFolder.createFolder(folderName);

    // 2. スプレッドシート作成
    const ss = SpreadsheetApp.create(`Project_${topic.title_working}`);
    const file = DriveApp.getFileById(ss.getId());
    file.moveTo(projectFolder);

    // 3. シート初期化
    this.initSheet(ss, '00_Overview', ['Property', 'Value']);
    this.initSheet(ss, '01_Research', ['source_url', 'title', 'published_at', 'summary', 'key_claims', 'reliability', 'notes']);
    this.initSheet(ss, '02_Analysis', ['category', 'item', 'content', 'sources']);
    this.initSheet(ss, '03_Drafts', ['type', 'title_proposal', 'content_body', 'status']);

    // デフォルトの「シート1」を削除
    const defaultSheet = ss.getSheetByName('シート1');
    if (defaultSheet) ss.deleteSheet(defaultSheet);

    // 4. Overviewへの基本情報書き込み
    const overviewSheet = ss.getSheetByName('00_Overview');
    overviewSheet.appendRow(['Topic ID', topic.topic_id]);
    overviewSheet.appendRow(['Title', topic.title_working]);
    overviewSheet.appendRow(['Created At', new Date().toISOString()]);
    overviewSheet.appendRow(['Angle', topic.angle]);

    const url = ss.getUrl();
    
    // 5. URL記録 (OutputsRepo)
    outputsRepo.add({
      topic_id: topic.topic_id,
      project_sheet_url: url,
      research_status: 'pending',
      generated_at: new Date().toISOString()
    });

    console.log(`Project created: ${url}`);
    
    // 6. スプレッドシート準備完了待機
    Utilities.sleep(2000); // 2秒待機
    
    return url;
  }

  /**
   * 指定名のシートを作成・ヘッダー設定
   */
  initSheet(ss, name, headers) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
    }
    return sheet;
  }

  /**
   * プロジェクトスプシの特定シートを取得
   * @param {string} topicId
   * @param {string} sheetName
   * @returns {GoogleAppsScript.Spreadsheet.Sheet|null}
   */
  getProjectSheet(topicId, sheetName) {
    const outputsRepo = new OutputsRepo();
    const record = outputsRepo.getAll().find(o => o.topic_id === topicId);
    if (!record || !record.project_sheet_url) return null;

    try {
      const ss = SpreadsheetApp.openByUrl(record.project_sheet_url);
      return ss.getSheetByName(sheetName);
    } catch (e) {
      console.error(`Failed to open project sheet for ${topicId}:`, e);
      return null;
    }
  }
}
