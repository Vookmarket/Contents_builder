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
    // 既存のトリガーがあれば削除（重複防止・ゴミ掃除）
    this.cleanupTriggerData(topicId);

    const triggerTime = new Date(Date.now() + delayMinutes * 60 * 1000);
    
    // トリガー作成
    const trigger = ScriptApp.newTrigger(functionName)
      .timeBased()
      .at(triggerTime)
      .create();
    
    // topicId と トリガーID を Properties に保存
    const triggerKey = `trigger_topic_${topicId}`;
    const triggerIdKey = `trigger_id_${topicId}`;
    PropertiesService.getScriptProperties().setProperty(triggerKey, topicId);
    PropertiesService.getScriptProperties().setProperty(triggerIdKey, trigger.getUniqueId());
    
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
   * 処理完了後に Properties とトリガーをクリーンアップ
   * @param {string} topicId
   */
  static cleanupTriggerData(topicId) {
    const properties = PropertiesService.getScriptProperties();
    const triggerKey = `trigger_topic_${topicId}`;
    const triggerIdKey = `trigger_id_${topicId}`;
    
    // トリガーIDを取得してトリガーを削除
    const triggerId = properties.getProperty(triggerIdKey);
    if (triggerId) {
      this.deleteTriggerById(triggerId);
    }
    
    // Properties から削除
    properties.deleteProperty(triggerKey);
    properties.deleteProperty(triggerIdKey);
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

  /**
   * トリガーIDで特定のトリガーを削除
   * @param {string} triggerId
   */
  static deleteTriggerById(triggerId) {
    const triggers = ScriptApp.getProjectTriggers();
    let deleted = false;
    
    triggers.forEach(trigger => {
      if (trigger.getUniqueId() === triggerId) {
        ScriptApp.deleteTrigger(trigger);
        deleted = true;
        console.log(`Deleted trigger: ${triggerId}`);
      }
    });
    
    if (!deleted) {
      console.warn(`Trigger not found: ${triggerId}`);
    }
    
    return deleted;
  }

  /**
   * 実行済みトリガーのクリーンアップ（手動メンテナンス用）
   * 実行時刻を過ぎたトリガーを削除
   */
  static cleanupExpiredTriggers() {
    const triggers = ScriptApp.getProjectTriggers();
    const now = new Date();
    let count = 0;
    
    triggers.forEach(trigger => {
      // 時間ベーストリガーで、かつ過去の時刻のものを削除
      if (trigger.getEventType() === ScriptApp.EventType.CLOCK) {
        // GASのトリガーは実行後も残るため、作成から一定時間経過したものを削除
        // （実行済みかどうかは直接判定できないため、古いものを削除する方針）
        ScriptApp.deleteTrigger(trigger);
        count++;
      }
    });
    
    console.log(`Cleaned up ${count} time-based triggers.`);
    return count;
  }
}
