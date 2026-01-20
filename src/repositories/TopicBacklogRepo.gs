/**
 * トピックバックログのリポジトリ
 * @extends {SheetBase}
 */
class TopicBacklogRepo extends SheetBase {
  constructor() {
    super(Config.SHEETS.TOPIC_BACKLOG, 'topic_id');
  }

  /**
   * ステータス指定でトピックを取得
   * @param {string} status 
   * @returns {Object[]}
   */
  getByStatus(status) {
    const all = this.getAll();
    return all.filter(topic => topic.status === status);
  }
}
