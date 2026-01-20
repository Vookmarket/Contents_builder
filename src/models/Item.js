/**
 * @typedef {'new' | 'screened' | 'promoted' | 'ignored' | 'error'} ItemStatus
 */

/**
 * @typedef {'low' | 'med' | 'high'} MisinfoRisk
 */

/**
 * @typedef {Object} IntakeItem
 * @property {string} item_id
 * @property {string} fetched_at ISO date string
 * @property {string} source_id
 * @property {string} title
 * @property {string} url
 * @property {string} [published_at]
 * @property {string} [snippet]
 * @property {string} dedupe_key
 * @property {ItemStatus} status
 * @property {string} [notes]
 */

/**
 * @typedef {Object} ScreeningResult
 * @property {string} item_id
 * @property {number} animal_score
 * @property {number} policy_score
 * @property {number} urgency
 * @property {number} japan_relevance
 * @property {MisinfoRisk} misinformation_risk
 * @property {string[]} tags
 * @property {string} summary_30s
 * @property {string[]} key_points
 * @property {string} model_meta
 */

/**
 * @typedef {IntakeItem & { screening?: ScreeningResult }} EnrichedItem
 */
