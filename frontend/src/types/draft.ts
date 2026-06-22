export type DraftMode = 'classic' | 'criciq' | 'daily'

export type DraftPhase = 'idle' | 'spinning' | 'picking' | 'done'

export interface Franchise {
  id: number
  name: string
  short_name: string
}

export interface ValidCombo {
  franchise_id: number
  season_year: number
  franchise_name?: string
  franchise_short?: string
}

export interface DraftableCard {
  id: number
  franchise_id: number
  franchise_short: string   // short code e.g. "RCB", set after franchise map loads
  season_year: number
  player_name: string
  display_name: string
  role_primary: string
  role_category: string
  season_quality_tier: string
  one_line_descriptor: string
  player_score: number
  is_overseas: boolean
  avg_batting_position: number | null
  matches_played: number | null
  runs_scored: number | null
  batting_strike_rate: number | null
  batting_average: number | null
  wickets_taken: number | null
  bowling_economy: number | null
  bowling_average: number | null
}

export interface BonusEntry {
  name: string
  points: number
  triggered: boolean
}

export interface PenaltyEntry {
  name: string
  points: number
  triggered: boolean
}

export interface ScoreBreakdown {
  rawScore: number
  bonuses: BonusEntry[]
  penalties: PenaltyEntry[]
  totalBonus: number
  totalPenalty: number
  sixerScore: number
  wins: number
  losses: number
  tier: string
}
