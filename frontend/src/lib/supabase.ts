import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl) {
  throw new Error('Missing environment variable: VITE_SUPABASE_URL')
}
if (!supabaseAnonKey) {
  throw new Error('Missing environment variable: VITE_SUPABASE_ANON_KEY')
}

export type DraftablePoolRow = {
  id: number
  franchise_id: number
  season_year: number
  role_category: string
  player_name: string
  display_name: string | null
  role_primary: string
  season_quality_tier: string
  one_line_descriptor: string
  player_score: number
  is_overseas: number
  avg_batting_position: number | null
  matches_played: number | null
  runs_scored: number | null
  batting_strike_rate: number | null
  batting_average: number | null
  wickets_taken: number | null
  bowling_economy: number | null
  bowling_average: number | null
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default supabase
