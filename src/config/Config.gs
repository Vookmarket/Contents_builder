/**
 * アプリケーション設定
 * @type {Object}
 */
const Config = {
  GEMINI: {
    MODEL_SCREENING: 'gemini-3-flash',
    MODEL_GENERATION: 'gemini-3-pro',
    API_VERSION: 'v1beta',
    PROMPT_VERSION: 'p-2026-01-20-01',
  },
  SHEETS: {
    SOURCE_REGISTRY: 'SourceRegistry',
    INTAKE_QUEUE: 'IntakeQueue',
    SCREENING: 'Screening',
    TOPIC_BACKLOG: 'TopicBacklog',
    EVIDENCE_INDEX: 'EvidenceIndex',
    STAKEHOLDER_MAP: 'StakeholderMap',
    OUTPUTS: 'Outputs',
    RUN_LOGS: 'RunLogs',
    TRIGGER_REGISTRY: 'TriggerRegistry',
    JOB_QUEUE: 'JobQueue',
  },
  THRESHOLDS: {
    PROMOTION_SCORE: 7, // animal_score + policy_score
    HIGH_MISINFO_RISK: 'high',
  },
  DRIVE: {
    ROOT_FOLDER_NAME: 'ContentsBuilder_Output', // 初回作成用
  },
};
