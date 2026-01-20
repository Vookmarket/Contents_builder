export type ItemStatus = 'new' | 'screened' | 'promoted' | 'ignored' | 'error';
export type MisinfoRisk = 'low' | 'med' | 'high';

export interface IntakeItem {
  item_id: string;
  fetched_at: string; // ISO date string
  source_id: string;
  title: string;
  url: string;
  published_at?: string;
  snippet?: string;
  dedupe_key: string;
  status: ItemStatus;
  notes?: string;
}

export interface ScreeningResult {
  item_id: string;
  animal_score: number;
  policy_score: number;
  urgency: number;
  japan_relevance: number;
  misinformation_risk: MisinfoRisk;
  tags: string[]; // JSON string in DB, array in Code
  summary_30s: string;
  key_points: string[]; // JSON string in DB, array in Code
  model_meta: string;
}

// Full Item with Screening Data
export interface EnrichedItem extends IntakeItem {
  screening?: ScreeningResult;
}
