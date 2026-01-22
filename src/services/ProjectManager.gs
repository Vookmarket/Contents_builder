class ProjectManager {
  constructor() {
    this.topicRepo = new TopicBacklogRepo();
  }

  /**
   * トピック専用のプロジェクトスプレッドシートを作成・初期化する
   * 既存のシートがある場合は再利用する
   * @param {Object} topic
   * @returns {string} Spreadsheet URL
   */
  createProject(topic) {
    const outputsRepo = new OutputsRepo();
    
    // 既存のプロジェクトシートを検索
    const existingUrl = this.findExistingProjectUrl(topic.topic_id);
    if (existingUrl) {
      console.log(`Reusing existing project spreadsheet: ${existingUrl}`);
      
      // OutputsRepoに記録がない場合は追加
      const existing = outputsRepo.getAll().find(o => o.topic_id === topic.topic_id);
      if (!existing) {
        outputsRepo.add({
          topic_id: topic.topic_id,
          project_sheet_url: existingUrl,
          research_status: 'pending',
          generated_at: new Date().toISOString()
        });
      }
      
      return existingUrl;
    }

    console.log(`Creating new project spreadsheet for topic: ${topic.title_working}`);

    // 1. フォルダ作成/取得
    // 現在のスプレッドシートと同じ階層に保存する
    const activeSs = SpreadsheetApp.getActiveSpreadsheet();
    const activeFile = DriveApp.getFileById(activeSs.getId());
    const parents = activeFile.getParents();
    let parentFolder;
    if (parents.hasNext()) {
      parentFolder = parents.next();
    } else {
      // 親がない（ルート）場合はルートを使用
      parentFolder = DriveApp.getRootFolder();
    }

    // 親フォルダ内に出力用フォルダを探す
    const folders = parentFolder.getFoldersByName(Config.DRIVE.ROOT_FOLDER_NAME);
    let rootFolder;
    if (folders.hasNext()) rootFolder = folders.next();
    else rootFolder = parentFolder.createFolder(Config.DRIVE.ROOT_FOLDER_NAME);

    const today = new Date().toISOString().slice(0, 10);
    const folderName = `${today}_${topic.title_working.substring(0, 20)}`; // 長すぎるとエラーになるかも
    const projectFolder = rootFolder.createFolder(folderName);

    // 2. スプレッドシート作成
    const ss = SpreadsheetApp.create(`Project_${topic.title_working}`);
    const file = DriveApp.getFileById(ss.getId());
    file.moveTo(projectFolder);

    // 3. シート初期化
    this.initSheet(ss, '00_Overview', ['Property', 'Value']);
    this.initSheet(ss, '01_Research', [
      'source_url', 'title', 'published_at', 'summary', 'source_type', 
      'reliability_score', 'bias_indicator', 'fact_check_status', 
      'stakeholder', 'key_claims', 'notes'
    ]);
    this.initSheet(ss, '02_Analysis', ['category', 'item', 'content', 'sources']);
    this.initSheet(ss, '03_Drafts', ['type', 'title_proposal', 'content_body', 'status']);
    this.initSheet(ss, '04_FactCheck', [
      'claim_text', 'claim_value', 'source_value', 'match_status', 'source_url'
    ]);
    this.initSheet(ss, '05_Timeline', [
      'date', 'event', 'source_url', 'category'
    ]);

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

  /**
   * 既存のプロジェクトシートURLを検索
   * @param {string} topicId
   * @returns {string|null} Spreadsheet URL or null
   */
  findExistingProjectUrl(topicId) {
    // 1. OutputsRepoをチェック
    const outputsRepo = new OutputsRepo();
    const record = outputsRepo.getAll().find(o => o.topic_id === topicId);
    if (record && record.project_sheet_url) {
      // URLが有効かチェック
      try {
        SpreadsheetApp.openByUrl(record.project_sheet_url);
        return record.project_sheet_url;
      } catch (e) {
        console.warn(`Recorded URL is invalid for ${topicId}. Searching in Drive...`);
      }
    }

    // 2. Drive内を検索（出力フォルダ内）
    try {
      const folder = this.getOutputFolder();
      const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
      
      while (files.hasNext()) {
        const file = files.next();
        try {
          const ss = SpreadsheetApp.open(file);
          const overviewSheet = ss.getSheetByName('00_Overview');
          
          if (overviewSheet) {
            const data = overviewSheet.getRange('A:B').getValues();
            const idRow = data.find(row => row[0] === 'Topic ID');
            
            if (idRow && idRow[1] === topicId) {
              console.log(`Found existing project sheet in Drive: ${file.getName()}`);
              return ss.getUrl();
            }
          }
        } catch (e) {
          // スキップ
          console.warn(`Could not check file: ${file.getName()}`);
        }
      }
    } catch (e) {
      console.warn('Could not search Drive for existing projects:', e);
    }

    return null;
  }

  /**
   * 出力フォルダを取得または作成
   * @returns {GoogleAppsScript.Drive.Folder}
   */
  getOutputFolder() {
    const activeSs = SpreadsheetApp.getActiveSpreadsheet();
    const activeFile = DriveApp.getFileById(activeSs.getId());
    const parents = activeFile.getParents();
    let parentFolder;
    
    if (parents.hasNext()) {
      parentFolder = parents.next();
    } else {
      parentFolder = DriveApp.getRootFolder();
    }

    const folders = parentFolder.getFoldersByName(Config.DRIVE.ROOT_FOLDER_NAME);
    if (folders.hasNext()) {
      return folders.next();
    } else {
      return parentFolder.createFolder(Config.DRIVE.ROOT_FOLDER_NAME);
    }
  }

  /**
   * 完了または失敗したプロジェクトシートを削除
   * @param {boolean} includeCompleted completed状態のものも削除するか
   * @returns {number} 削除した件数
   */
  cleanupOldProjects(includeCompleted = true) {
    const outputsRepo = new OutputsRepo();
    const allOutputs = outputsRepo.getAll();
    
    let targetStatuses = ['failed'];
    if (includeCompleted) {
      targetStatuses.push('completed');
    }
    
    const targetTopics = allOutputs.filter(o => 
      targetStatuses.includes(o.research_status) && o.project_sheet_url
    );
    
    let count = 0;
    targetTopics.forEach(output => {
      try {
        const ss = SpreadsheetApp.openByUrl(output.project_sheet_url);
        const file = DriveApp.getFileById(ss.getId());
        file.setTrashed(true);
        count++;
        console.log(`Trashed project: ${output.topic_id}`);
      } catch (e) {
        console.warn(`Could not trash project ${output.topic_id}:`, e);
      }
    });
    
    return count;
  }

  /**
   * 指定したトピックのプロジェクトシートを削除
   * @param {string} topicId
   * @returns {boolean} 削除成功したか
   */
  deleteProject(topicId) {
    const outputsRepo = new OutputsRepo();
    const record = outputsRepo.getAll().find(o => o.topic_id === topicId);
    
    if (!record || !record.project_sheet_url) {
      console.log(`No project sheet found for ${topicId}`);
      return false;
    }
    
    try {
      const ss = SpreadsheetApp.openByUrl(record.project_sheet_url);
      const file = DriveApp.getFileById(ss.getId());
      file.setTrashed(true);
      console.log(`Deleted project sheet for ${topicId}`);
      return true;
    } catch (e) {
      console.error(`Failed to delete project sheet for ${topicId}:`, e);
      return false;
    }
  }
}
