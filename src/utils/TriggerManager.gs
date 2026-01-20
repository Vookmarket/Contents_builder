/**
 * トリガー管理クラス
 */
class TriggerManager {
  /**
   * 時限トリガーを作成
   * @param {string} functionName 実行する関数名
   * @param {number} delayMinutes 何分後に実行するか
   * @param {Object} args 引数（PropertiesServiceに保存）
   */
  static createDelayedTrigger(functionName, delayMinutes, args = {}) {
    const triggerTime = new Date(Date.now() + delayMinutes * 60 * 1000);
    
    // 引数をPropertiesServiceに一時保存
    const triggerKey = `trigger_${Utilities.getUuid()}`;
    PropertiesService.getScriptProperties().setProperty(triggerKey, JSON.stringify(args));
    
    // トリガー作成
    ScriptApp.newTrigger(functionName)
      .timeBased()
      .at(triggerTime)
      .create();
    
    console.log(`Trigger created: ${functionName} at ${triggerTime.toISOString()}`);
    return triggerKey;
  }

  /**
   * 全てのトリガーを削除
   */
  static deleteAllTriggers() {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
    console.log(`Deleted ${triggers.length} triggers.`);
  }

  /**
   * 特定の関数名のトリガーのみ削除
   * @param {string} functionName
   */
  static deleteTriggersByFunction(functionName) {
    const triggers = ScriptApp.getProjectTriggers();
    let count = 0;
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === functionName) {
        ScriptApp.deleteTrigger(trigger);
        count++;
      }
    });
    console.log(`Deleted ${count} triggers for ${functionName}.`);
  }
}
