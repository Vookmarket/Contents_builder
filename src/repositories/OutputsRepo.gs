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

  /**
   * 特定トピックの research_status を更新
   * @param {string} topicId
   * @param {string} status "pending", "processing", "completed", "failed"
   */
  updateResearchStatus(topicId, status) {
    const all = this.getAll();
    const target = all.find(o => o.topic_id === topicId);
    if (target) {
      target.research_status = status;
      this.db.update(topicId, target);
    }
  }

  /**
   * 特定トピックの status を取得
   * @param {string} topicId
   * @returns {string|null}
   */
  getResearchStatus(topicId) {
    const all = this.getAll();
    const target = all.find(o => o.topic_id === topicId);
    return target ? target.research_status : null;
  }
}
