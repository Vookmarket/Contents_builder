/**
 * 生成物管理のリポジトリ
 * @extends {SheetBase}
 */
class OutputsRepo extends SheetBase {
  constructor() {
    super(Config.SHEETS.OUTPUTS, 'topic_id');
  }
}
