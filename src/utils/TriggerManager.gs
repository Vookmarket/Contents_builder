/**
 * トリガー管理クラス
 */
class TriggerManager {
  /**
   * 時限トリガーを作成（topicId 専用）
   * @param {string} functionName 実行する関数名
   * @param {number} delayMinutes 何分後に実行するか
   * @param {string} topicId 処理対象のtopic_id
   */
  static createDelayedTriggerForTopic(functionName, delayMinutes, topicId) {
    const triggerTime = new Date(Date.now() + delayMinutes * 60 * 1000);
    
    // topicId を key にして Properties に保存
    const triggerKey = `trigger_topic_${topicId}`;
    PropertiesService.getScriptProperties().setProperty(triggerKey, topicId);
    
    // トリガー作成
    ScriptApp.newTrigger(functionName)
      .timeBased()
      .at(triggerTime)
      .create();
    
    console.log(`Trigger created: ${functionName} for ${topicId} at ${triggerTime.toISOString()}`);
    return triggerKey;
  }

  /**
   * トリガー実行時に全てのpending topic を取得
   * @returns {string[]} topic_id のリスト
   */
  static getPendingTopics() {
    const properties = PropertiesService.getScriptProperties();
    const allKeys = properties.getKeys();
    const topicIds = allKeys
      .filter(key => key.startsWith('trigger_topic_'))
      .map(key => properties.getProperty(key));
    
    return topicIds;
  }

  /**
   * 処理完了後に Properties をクリーンアップ
   * @param {string} topicId
   */
  static cleanupTriggerData(topicId) {
    const triggerKey = `trigger_topic_${topicId}`;
    PropertiesService.getScriptProperties().deleteProperty(triggerKey);
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
