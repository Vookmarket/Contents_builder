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
 * トピック生成処理（Promotedアイテムから）
 */
function runTopicGenerationCycle() {
  console.log('Starting Topic Generation Cycle...');
  const topicService = new TopicService();
  topicService.generateTopicsFromPromotedItems();
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
 * メニュー作成 (Spreadsheet Open時)
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Contents Builder')
    .addItem('1. 収集を実行', 'runIntakeCycle')
    .addItem('2. スクリーニング実行', 'runScreeningCycle')
    .addItem('3. テーマ案生成', 'runTopicGenerationCycle')
    .addItem('4. コンテンツ生成 (Shorts)', 'runContentGenerationCycle')
    .addToUi();
}
