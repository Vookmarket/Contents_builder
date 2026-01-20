/**
 * 収集キューのリポジトリ
 * @extends {SheetBase}
 */
class IntakeQueueRepo extends SheetBase {
  constructor() {
    super(Config.SHEETS.INTAKE_QUEUE, 'item_id');
  }

  /**
   * 重複チェックを行い、新規アイテムのみ追加する
   * @param {Object[]} items
   * @returns {number} 追加件数
   */
  addNewItems(items) {
    if (items.length === 0) return 0;

    const existingItems = this.getAll();
    const existingKeys = new Set(existingItems.map(item => item.dedupe_key));
    
    let addedCount = 0;
    const sheet = this.getSheet();
    let headers = this.getHeaders(sheet);
    
    // ヘッダーがまだない場合
    if (headers.length === 0 && items.length > 0) {
      headers = Object.keys(items[0]);
      sheet.appendRow(headers);
    }

    const rowsToAdd = [];

    items.forEach(item => {
      if (!existingKeys.has(item.dedupe_key)) {
        // 重複なし
        item.item_id = item.item_id || Utilities.getUuid(); // ID生成
        item.status = 'new';
        rowsToAdd.push(this.mapObjToRow(headers, item));
        existingKeys.add(item.dedupe_key); // 同一バッチ内の重複も防ぐ
        addedCount++;
      }
    });

    if (rowsToAdd.length > 0) {
      // 一括追加
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rowsToAdd.length, headers.length).setValues(rowsToAdd);
    }

    return addedCount;
  }

  /**
   * ステータスが new のアイテムを取得
   * @param {number} limit
   * @returns {Object[]}
   */
  getUnprocessedItems(limit = 20) {
    const all = this.getAll();
    return all.filter(item => item.status === 'new').slice(0, limit);
  }
}
