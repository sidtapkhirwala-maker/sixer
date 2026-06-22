import type { DraftableCard } from '@/types/draft'

// EXACT database values. Do not modify these.
export const ROLE_PRIMARY = {
  TOP_ORDER_BATTER:    'Top-Order Batter',
  MIDDLE_ORDER_BATTER: 'Middle-Order Batter',
  FINISHER:            'Finisher',
  WICKETKEEPER:        'Wicketkeeper',
  SPIN_BOWLER:         'Spin Bowler',
  PACE_BOWLER:         'Pace Bowler',
  BATTING_AR:          'Batting All-Rounder',
  BOWLING_AR:          'Bowling All-Rounder',
} as const

export const ROLE_CATEGORY = {
  BATTER:       'Batter',
  BOWLER:       'Bowler',
  ALL_ROUNDER:  'All-Rounder',
  WICKETKEEPER: 'Wicketkeeper',
} as const

// Role test functions — ALL use exact string match against database values
export function isKeeper(c: DraftableCard): boolean {
  return c.role_category === ROLE_CATEGORY.WICKETKEEPER ||
         c.role_primary === ROLE_PRIMARY.WICKETKEEPER
}

export function isSpinner(c: DraftableCard): boolean {
  return c.role_primary === ROLE_PRIMARY.SPIN_BOWLER
}

export function isPacer(c: DraftableCard): boolean {
  return c.role_primary === ROLE_PRIMARY.PACE_BOWLER
}

export function isAllRounder(c: DraftableCard): boolean {
  return c.role_category === ROLE_CATEGORY.ALL_ROUNDER
}

export function isBatter(c: DraftableCard): boolean {
  // True for all batter roles (top-order, middle-order, finisher)
  // But NOT keepers or all-rounders
  return c.role_category === ROLE_CATEGORY.BATTER
}

export function isTopOrderBatter(c: DraftableCard): boolean {
  return c.role_primary === ROLE_PRIMARY.TOP_ORDER_BATTER
}

export function isFinisher(c: DraftableCard): boolean {
  return c.role_primary === ROLE_PRIMARY.FINISHER
}

export function formatRoleShort(rolePrimary: string): string {
  switch (rolePrimary) {
    case 'Top-Order Batter':    return 'Top-Order'
    case 'Middle-Order Batter': return 'Middle-Order'
    case 'Finisher':            return 'Finisher'
    case 'Wicketkeeper':        return 'Wicketkeeper'
    case 'Pace Bowler':         return 'Pace'
    case 'Spin Bowler':         return 'Spin'
    case 'Batting All-Rounder': return 'Batting AR'
    case 'Bowling All-Rounder': return 'Bowling AR'
    default:                    return rolePrimary
  }
}

// Counts the "batting side" — anyone who bats meaningfully:
// batters + wicketkeepers + all-rounders
export function countBattingSide(picks: DraftableCard[]): number {
  return picks.filter(c => isBatter(c) || isKeeper(c) || isAllRounder(c)).length
}

// Counts the "bowling side" — anyone who bowls meaningfully:
// pace bowlers + spin bowlers + all-rounders
export function countBowlingSide(picks: DraftableCard[]): number {
  return picks.filter(c => isSpinner(c) || isPacer(c) || isAllRounder(c)).length
}
