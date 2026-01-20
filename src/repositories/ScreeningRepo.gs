/**
 * スクリーニング結果のリポジトリ
 * @extends {SheetBase}
 */
class ScreeningRepo extends SheetBase {
  constructor() {
    super(Config.SHEETS.SCREENING, 'item_id');
  }

  /**
   * スクリーニング結果を保存する
   * @param {Object} screeningResult
   */
  saveResult(screeningResult) {
    // 既存データのチェックはSheetBaseのadd/updateに任せるが、
    // 基本はItem 1つにつき1行なのでaddでよい（再スクリーニングの場合はupdateが必要だが、今回は新規のみ想定）
    
    // データ変換（配列やオブジェクトをJSON文字列に）はSheetBaseで行われる
    // ただし、明示的な変換が必要な場合もあるので確認
    
    // 重複チェック（簡易）
    const existing = this.getAll().find(r => r.item_id === screeningResult.item_id);
    if (existing) {
      this.update(screeningResult.item_id, screeningResult);
    } else {
      this.add(screeningResult);
    }
  }
}
