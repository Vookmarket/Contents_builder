/**
 * 初期セットアップ（シート作成・データ投入）
 */
function runSetup() {
  const setupService = new SetupService();
  setupService.setupAll();
  SpreadsheetApp.getUi().alert('Setup Completed. Please refresh the spreadsheet.');
}

/**
 * 収集トリガー（例: 07:30, 12:30, 19:30）
 */
function runIntakeCycle() {
  console.log('Starting Intake Cycle...');
  const fetchService = new FetchService();
  fetchService.fetchAll();
}

/**
 * スクリーニング処理（JobQueueまたは新着アイテムから）
 */
function runScreeningCycle() {
  console.log('Starting Screening Cycle...');
  const screeningService = new ScreeningService();
  // 1回の実行で処理する件数上限
  screeningService.processQueue(10);
}

/**
 * 深掘り調査（一次ソース収集）
 */
function runEvidenceCollectionCycle() {
  console.log('Starting Evidence Collection Cycle...');
  const evidenceService = new EvidenceService();
  evidenceService.processPromotedItems(5);
}

/**
 * トピック生成処理（Promotedアイテムから）
 */
function runTopicGenerationCycle() {
  console.log('Starting Topic Generation Cycle...');
  const topicService = new TopicService();
  topicService.generateTopicsFromPromotedItems();
}

/**
 * ステークホルダー分析（ドラフトトピックから）
 */
function runStakeholderAnalysisCycle() {
  console.log('Starting Stakeholder Analysis Cycle...');
  const stakeholderService = new StakeholderService();
  stakeholderService.analyzeStakeholdersForDraftTopics();
}

/**
 * コンテンツ生成処理（トピックから台本生成）
 */
function runContentGenerationCycle() {
  console.log('Starting Content Generation Cycle...');
  const contentService = new ContentService();
  contentService.generateContentsForPendingTopics();
}

/**
 * 新規収集テーマの追加（自動Source生成）
 */
function addCollectionTheme() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '新規テーマの追加',
    '収集したいテーマを入力してください（例: 動物愛護法の改正）',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() == ui.Button.OK) {
    const theme = response.getResponseText();
    if (theme) {
      ui.alert(`テーマ「${theme}」に関連する収集先を検索・登録します...`);
      const service = new SourceDiscoveryService();
      const count = service.discoverAndRegister(theme);
      ui.alert(`${count} 件の収集先を登録しました。`);
    }
  }
}

/**
 * メニュー作成 (Spreadsheet Open時)
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Contents Builder')
    .addItem('0. 初期セットアップ', 'runSetup')
    .addSeparator()
    .addItem('➕ 収集テーマの追加', 'addCollectionTheme')
    .addSeparator()
    .addItem('1. 収集を実行', 'runIntakeCycle')
    .addItem('2. スクリーニング実行', 'runScreeningCycle')
    .addItem('3. 一次ソース調査', 'runEvidenceCollectionCycle')
    .addItem('4. テーマ案生成', 'runTopicGenerationCycle')
    .addItem('5. ステークホルダー分析', 'runStakeholderAnalysisCycle')
    .addItem('6. コンテンツ生成 (Shorts)', 'runContentGenerationCycle')
    .addToUi();
}
