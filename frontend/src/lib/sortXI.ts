import type { DraftableCard } from '@/types/draft'
import { isKeeper } from '@/lib/roles'

// Role-primary proxy sort for XIs read from sixer_runs.xi JSONB snapshots
// (which historically lack avg_batting_position). When avg_batting_position
// IS present on every player (newer runs), the precise position wins.
const ROLE_BATTING_ORDER: Record<string, number> = {
  'Top-Order Batter':     1,
  'Wicketkeeper':         3,
  'Middle-Order Batter':  4,
  'Batting All-Rounder':  5,
  'Bowling All-Rounder':  6,
  'Finisher':             7,
  'Spin Bowler':          9,
  'Pace Bowler':         10,
}

type SortableXi = {
  player_name: string
  role_primary: string
  role_category?: string
  avg_batting_position?: number | null
}

export function sortXIByRole<T extends SortableXi>(xi: T[]): T[] {
  return [...xi].sort((a, b) => {
    if (a.avg_batting_position != null && b.avg_batting_position != null) {
      return a.avg_batting_position - b.avg_batting_position
    }
    const aRank = ROLE_BATTING_ORDER[a.role_primary] ?? 11
    const bRank = ROLE_BATTING_ORDER[b.role_primary] ?? 11
    return aRank - bRank
  })
}

export function sortXI(picks: DraftableCard[]): DraftableCard[] {
  const keepers    = picks.filter(p => isKeeper(p))
    .sort((a, b) => (a.avg_batting_position ?? 99) - (b.avg_batting_position ?? 99))
  const nonKeepers = picks.filter(p => !isKeeper(p))
    .sort((a, b) => (a.avg_batting_position ?? 99) - (b.avg_batting_position ?? 99))

  const result: DraftableCard[] = []
  let ki = 0, ni = 0
  while (ki < keepers.length || ni < nonKeepers.length) {
    if (ki >= keepers.length) {
      result.push(nonKeepers[ni++])
    } else if (ni >= nonKeepers.length) {
      result.push(keepers[ki++])
    } else {
      const kPos = keepers[ki].avg_batting_position ?? 99
      const nPos = nonKeepers[ni].avg_batting_position ?? 99
      if (kPos <= nPos) result.push(keepers[ki++])
      else              result.push(nonKeepers[ni++])
    }
  }
  return result
}
