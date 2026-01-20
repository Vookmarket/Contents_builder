/**
 * ステークホルダーマップのリポジトリ
 */
class StakeholderMapRepo {
  constructor() {
    this.db = new SheetAccess(Config.SHEETS.STAKEHOLDER_MAP, 'topic_id');
  }

  /**
   * 委譲メソッド: add
   */
  add(item) {
    this.db.add(item);
  }

  /**
   * トピックIDで検索
   * @param {string} topicId
   * @returns {Object[]}
   */
  getByTopicId(topicId) {
    const all = this.db.getAll();
    return all.filter(s => s.topic_id === topicId);
  }
}
