/**
 * 収集キューのリポジトリ
 */
class IntakeQueueRepo {
  constructor() {
    this.db = new SheetAccess(Config.SHEETS.INTAKE_QUEUE, 'item_id');
  }

  /**
   * 委譲メソッド: getAll
   */
  getAll() {
    return this.db.getAll();
  }

  /**
   * 委譲メソッド: update
   */
  update(id, partial) {
    return this.db.update(id, partial);
  }

  /**
   * 重複チェックを行い、新規アイテムのみ追加する
   * @param {Object[]} items
   * @returns {number} 追加件数
   */
  addNewItems(items) {
    if (items.length === 0) return 0;

    const existingItems = this.db.getAll();
    const existingKeys = new Set(existingItems.map(item => item.dedupe_key));
    
    let addedCount = 0;
    const sheet = this.db.getSheet();
    let headers = this.db.getHeaders(sheet);
    
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
        rowsToAdd.push(this.db.mapObjToRow(headers, item));
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
    const all = this.db.getAll();
    return all.filter(item => item.status === 'new').slice(0, limit);
  }
}
