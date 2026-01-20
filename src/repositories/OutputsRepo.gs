/**
 * 生成物管理のリポジトリ
 */
class OutputsRepo {
  constructor() {
    this.db = new SheetAccess(Config.SHEETS.OUTPUTS, 'topic_id');
  }

  /**
   * 委譲メソッド: add
   */
  add(item) {
    this.db.add(item);
  }

  /**
   * 委譲メソッド: getAll
   */
  getAll() {
    return this.db.getAll();
  }
}
