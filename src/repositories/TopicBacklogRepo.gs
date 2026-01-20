/**
 * トピックバックログのリポジトリ
 */
class TopicBacklogRepo {
  constructor() {
    this.db = new SheetAccess(Config.SHEETS.TOPIC_BACKLOG, 'topic_id');
  }

  /**
   * 委譲メソッド: add
   */
  add(item) {
    this.db.add(item);
  }

  /**
   * 委譲メソッド: update
   */
  update(id, partial) {
    this.db.update(id, partial);
  }

  /**
   * ステータス指定でトピックを取得
   * @param {string} status 
   * @returns {Object[]}
   */
  getByStatus(status) {
    const all = this.db.getAll();
    return all.filter(topic => topic.status === status);
  }
}
