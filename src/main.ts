import { Config } from './config/Config';
import { GeminiService } from './services/GeminiService';

/**
 * 収集トリガー（例: 07:30, 12:30, 19:30）
 */
function runIntakeCycle() {
  console.log('Starting Intake Cycle...');
  // TODO: Implement FetchService and call it here
}

/**
 * スクリーニング処理（JobQueueまたは新着アイテムから）
 */
function runScreeningCycle() {
  console.log('Starting Screening Cycle...');
  const gemini = new GeminiService();
  // TODO: Implement Screening logic
}

/**
 * メニュー作成 (Spreadsheet Open時)
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Contents Builder')
    .addItem('今すぐ収集を実行', 'runIntakeCycle')
    .addItem('スクリーニング実行', 'runScreeningCycle')
    .addToUi();
}

// グローバルスコープに公開するために必要（clasp/GASの仕様）
// @ts-ignore
global.runIntakeCycle = runIntakeCycle;
// @ts-ignore
global.runScreeningCycle = runScreeningCycle;
// @ts-ignore
global.onOpen = onOpen;
