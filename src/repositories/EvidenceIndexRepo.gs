/**
 * 根拠・証拠データのリポジトリ
 */
class EvidenceIndexRepo {
  constructor() {
    this.db = new SheetAccess(Config.SHEETS.EVIDENCE_INDEX, 'claim_id');
  }

  /**
   * 特定のアイテムに関連するEvidenceを取得
   * @param {string} itemId 
   * @returns {Object[]}
   */
  getByItemId(itemId) {
    const all = this.db.getAll();
    return all.filter(ev => ev.related_item_id === itemId);
  }
  
  /**
   * リストを一括保存
   * @param {Object[]} evidences
   */
  addAll(evidences) {
    if (!evidences || evidences.length === 0) return;
    
    // 既存チェックは簡易的に省略（上書き更新はIDが必要だが、今回は新規追加メイン）
    // 必要なら既存IDリストを取得してfilterする
    
    const sheet = this.db.getSheet();
    let headers = this.db.getHeaders(sheet);
    if (headers.length === 0) {
       headers = Object.keys(evidences[0]);
       sheet.appendRow(headers);
    }
    
    // 1件ずつaddしているが、量が多い場合はmapObjToRowしてsetValuesすべき
    evidences.forEach(ev => {
      ev.claim_id = ev.claim_id || Utilities.getUuid();
      this.db.add(ev);
    });
  }
}
