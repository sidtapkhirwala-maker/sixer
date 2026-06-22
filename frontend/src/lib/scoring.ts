import type { BonusEntry, PenaltyEntry, ScoreBreakdown } from '@/types/draft'
import type { DraftableCard } from '@/types/draft'
import {
  isKeeper, isSpinner, isPacer, isAllRounder,
  isFinisher, isTopOrderBatter,
  countBattingSide, countBowlingSide,
} from '@/lib/roles'

function scoreToRecord(score: number): { wins: number; losses: number } {
  if (score >= 110) return { wins: 16, losses: 0 }
  if (score >= 107) return { wins: 15, losses: 1 }
  if (score >= 104) return { wins: 14, losses: 2 }
  if (score >= 101) return { wins: 13, losses: 3 }
  if (score >= 98)  return { wins: 12, losses: 4 }
  if (score >= 94)  return { wins: 11, losses: 5 }
  if (score >= 90)  return { wins: 10, losses: 6 }
  if (score >= 86)  return { wins: 9,  losses: 7 }
  if (score >= 82)  return { wins: 8,  losses: 8 }
  if (score >= 77)  return { wins: 7,  losses: 9 }
  if (score >= 72)  return { wins: 6,  losses: 10 }
  if (score >= 67)  return { wins: 5,  losses: 11 }
  if (score >= 62)  return { wins: 4,  losses: 12 }
  if (score >= 57)  return { wins: 3,  losses: 13 }
  if (score >= 51)  return { wins: 2,  losses: 14 }
  if (score >= 45)  return { wins: 1,  losses: 15 }
  return { wins: 0, losses: 16 }
}

function scoreToTier(score: number): string {
  if (score >= 110) return 'S'
  if (score >= 104) return 'A'
  if (score >= 94)  return 'B'
  if (score >= 82)  return 'C'
  if (score >= 67)  return 'D'
  if (score >= 51)  return 'E'
  return 'F'
}

export function calculateScore(picks: DraftableCard[], mode: string = 'classic'): ScoreBreakdown {
  const rawScore = picks.reduce((sum, c) => sum + c.player_score, 0)

  // ── Bonuses ──────────────────────────────────────────────────────────────
  const allLocal = picks.every(c => !c.is_overseas)

  const spinnerCount = picks.filter(isSpinner).length
  const pacerCount   = picks.filter(isPacer).length
  const arCount      = picks.filter(isAllRounder).length
  const completeAttack = spinnerCount >= 2 && pacerCount >= 2 && arCount >= 2

  const tierStackCount = picks.filter(c => c.player_score >= 9.0).length

  const powerHittersCount = picks.filter(c =>
    (c.role_category === 'Batter' || c.role_category === 'Wicketkeeper' || c.role_category === 'All-Rounder') &&
    (c.batting_strike_rate ?? 0) >= 175
  ).length

  const deathSpecialistsCount = picks.filter(c =>
    c.role_primary === 'Pace Bowler' &&
    c.bowling_economy !== null &&
    c.bowling_economy <= 7.0
  ).length

  const spinners = picks.filter(isSpinner)
  const spinnerWickets = spinners.reduce((s, c) => s + (c.wickets_taken ?? 0), 0)

  const twinAnchorCount = picks.filter(c =>
    c.role_primary === 'Top-Order Batter' &&
    c.batting_average !== null &&
    c.batting_average >= 50
  ).length

  const bonuses: BonusEntry[] = [
    { name: 'LOCAL XI',           points: 2, triggered: allLocal },
    { name: 'COMPLETE ATTACK',    points: 4, triggered: completeAttack },
    { name: 'TIER STACK',         points: 2, triggered: tierStackCount >= 7 },
    { name: 'POWER HITTERS',      points: 3, triggered: powerHittersCount >= 3 },
    { name: 'DEATH SPECIALISTS',  points: 2, triggered: deathSpecialistsCount >= 2 },
    { name: 'SPIN TWINS',         points: 2, triggered: spinners.length >= 2 && spinnerWickets >= 35 },
    { name: 'TWIN ANCHORS',       points: 2, triggered: twinAnchorCount >= 2 },
  ]
  const rawBonus = bonuses.filter(b => b.triggered).reduce((s, b) => s + b.points, 0)
  const totalBonus = Math.min(15, rawBonus)

  // ── Penalties ─────────────────────────────────────────────────────────────
  const hasKeeper  = picks.some(isKeeper)
  const hasSpinner = picks.some(isSpinner)
  const hasPacer   = picks.some(isPacer)

  const battingCount  = countBattingSide(picks)
  const bowlingCount  = countBowlingSide(picks)
  const finisherCount = picks.filter(isFinisher).length
  const anchorCount   = picks.filter(isTopOrderBatter).length

  const penalties: PenaltyEntry[] = [
    { name: 'NO KEEPER',        points: -10, triggered: !hasKeeper },
    { name: 'NO SPINNER',       points: -5,  triggered: !hasSpinner },
    { name: 'NO PACER',         points: -5,  triggered: !hasPacer },
    { name: 'NO ALL-ROUNDER',   points: -5,  triggered: arCount === 0 },
    { name: 'THIN BATTING',     points: -8,  triggered: battingCount < 6 },
    { name: 'LIGHT ON BOWLING', points: -10, triggered: bowlingCount < 5 },
    { name: 'BOUNDARY RIDERS',  points: -10, triggered: finisherCount >= 5 },
    { name: 'PURE ANCHORS',     points: -5,  triggered: anchorCount >= 5 },
  ]
  const rawPenalty = penalties.filter(p => p.triggered).reduce((s, p) => s + p.points, 0)
  const totalPenalty = Math.max(-35, rawPenalty)

  // Classic multiplier 0.956522 chosen so raw 115 → final 110.0 (16-0 threshold).
  // Adjust this to retune Classic ceiling without touching the SCORE_TO_RECORD curve.
  const MODE_MULTIPLIER: Record<string, number> = {
    classic: 0.956522,
    criciq:  1.00,
    daily:   1.00,
  }
  const multiplier = MODE_MULTIPLIER[mode] ?? 1.00
  const sixerScore = Math.max(
    0,
    Math.round((rawScore + totalBonus + totalPenalty) * multiplier * 100) / 100
  )
  const record = scoreToRecord(sixerScore)

  return {
    rawScore,
    bonuses,
    penalties,
    totalBonus,
    totalPenalty,
    sixerScore,
    wins: record.wins,
    losses: record.losses,
    tier: scoreToTier(sixerScore),
  }
}
