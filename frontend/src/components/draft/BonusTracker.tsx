import { AlertTriangle } from 'lucide-react'
import type { DraftableCard } from '@/types/draft'
import {
  isKeeper, isSpinner, isPacer, isAllRounder,
  isFinisher, isTopOrderBatter,
  countBattingSide, countBowlingSide,
} from '@/lib/roles'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'

interface BonusTrackerProps {
  xi: DraftableCard[]
}

type BonusProgress = {
  current: number
  target: number
  met: boolean
  detail?: string
}

type BonusDef = {
  name: string
  value: number
  description: string
  progress: (xi: DraftableCard[]) => BonusProgress
  isImpossible: (xi: DraftableCard[]) => boolean
}

type PenaltyStatus = 'active' | 'at-risk' | 'clear'

type PenaltyDef = {
  name: string
  value: number
  description: string
  status: (xi: DraftableCard[]) => PenaltyStatus
  detail?: (xi: DraftableCard[]) => string
}

function remaining(xi: DraftableCard[]): number {
  return 11 - xi.length
}

const BONUSES: BonusDef[] = [
  {
    name: 'Local XI',
    value: 2,
    description:
      'Trigger: every player in your XI is Indian (not overseas).\nReward: +2 to your team score.',
    progress: (xi) => {
      const local = xi.filter(p => !p.is_overseas).length
      return { current: local, target: 11, met: local === 11 && xi.length === 11 }
    },
    isImpossible: (xi) => xi.some(p => p.is_overseas),
  },
  {
    name: 'Complete Attack',
    value: 4,
    description:
      'Trigger: your XI has at least 2 spin bowlers, 2 pace bowlers, and 2 all-rounders.\nReward: +4 to your team score.',
    progress: (xi) => {
      const sp = xi.filter(isSpinner).length
      const pc = xi.filter(isPacer).length
      const ar = xi.filter(isAllRounder).length
      return {
        current: Math.min(Math.min(sp, pc, ar), 2),
        target: 2,
        met: sp >= 2 && pc >= 2 && ar >= 2,
        detail: `${sp}/2 spn · ${pc}/2 pce · ${ar}/2 ar`,
      }
    },
    isImpossible: (xi) => {
      const sp = xi.filter(isSpinner).length
      const pc = xi.filter(isPacer).length
      const ar = xi.filter(isAllRounder).length
      const needed = Math.max(0, 2 - sp) + Math.max(0, 2 - pc) + Math.max(0, 2 - ar)
      return needed > remaining(xi)
    },
  },
  {
    name: 'Tier Stack',
    value: 2,
    description:
      'Trigger: 7 or more of your picks have a player score of 9.0 or higher (Legendary tier).\nReward: +2 to your team score.',
    progress: (xi) => {
      const elite = xi.filter(p => (p.player_score ?? 0) >= 9.0).length
      return { current: Math.min(elite, 7), target: 7, met: elite >= 7 }
    },
    isImpossible: (xi) => {
      const elite = xi.filter(p => (p.player_score ?? 0) >= 9.0).length
      return (7 - elite) > remaining(xi)
    },
  },
  {
    name: 'Power Hitters',
    value: 3,
    description:
      'Trigger: at least 3 batters, wicketkeepers, or all-rounders in your XI have a season batting strike rate of 175 or higher.\nReward: +3 to your team score.',
    progress: (xi) => {
      const hitters = xi.filter(p =>
        (p.role_category === 'Batter' || p.role_category === 'Wicketkeeper' || p.role_category === 'All-Rounder') &&
        (p.batting_strike_rate ?? 0) >= 175
      ).length
      return { current: Math.min(hitters, 3), target: 3, met: hitters >= 3 }
    },
    isImpossible: (xi) => {
      const hitters = xi.filter(p =>
        (p.role_category === 'Batter' || p.role_category === 'Wicketkeeper' || p.role_category === 'All-Rounder') &&
        (p.batting_strike_rate ?? 0) >= 175
      ).length
      return (3 - hitters) > remaining(xi)
    },
  },
  {
    name: 'Death Specialists',
    value: 2,
    description:
      'Trigger: at least 2 pace bowlers in your XI have a season bowling economy of 7.0 or lower.\nReward: +2 to your team score.',
    progress: (xi) => {
      const death = xi.filter(p =>
        p.role_primary === 'Pace Bowler' &&
        p.bowling_economy != null &&
        p.bowling_economy <= 7.0
      ).length
      return { current: Math.min(death, 2), target: 2, met: death >= 2 }
    },
    isImpossible: (xi) => {
      const death = xi.filter(p =>
        p.role_primary === 'Pace Bowler' &&
        p.bowling_economy != null &&
        p.bowling_economy <= 7.0
      ).length
      return (2 - death) > remaining(xi)
    },
  },
  {
    name: 'Spin Twins',
    value: 2,
    description:
      'Trigger: at least 2 spin bowlers in your XI, and their combined wickets taken across the season is 35 or higher.\nReward: +2 to your team score.',
    progress: (xi) => {
      const spinners = xi.filter(isSpinner)
      const wickets = spinners.reduce((sum, p) => sum + (p.wickets_taken ?? 0), 0)
      return {
        current: Math.min(wickets, 35),
        target: 35,
        met: spinners.length >= 2 && wickets >= 35,
        detail: `${spinners.length}/2 spinners · ${wickets} wkts`,
      }
    },
    isImpossible: (xi) => {
      const spinners = xi.filter(isSpinner).length
      return (2 - spinners) > remaining(xi)
    },
  },
  {
    name: 'Twin Anchors',
    value: 2,
    description:
      'Trigger: 2 or more top-order batters in your XI with a season batting average of 50 or higher.\nReward: +2 to your team score.',
    progress: (xi) => {
      const count = xi.filter(p =>
        p.role_primary === 'Top-Order Batter' &&
        p.batting_average != null &&
        p.batting_average >= 50
      ).length
      return {
        current: Math.min(count, 2),
        target: 2,
        met: count >= 2,
        detail: `${count}/2 top-order avg ≥50`,
      }
    },
    isImpossible: (xi) => {
      const count = xi.filter(p =>
        p.role_primary === 'Top-Order Batter' &&
        p.batting_average != null &&
        p.batting_average >= 50
      ).length
      return (2 - count) > remaining(xi)
    },
  },
]

function noXStatus(condition: boolean, len: number): PenaltyStatus {
  if (len === 11 && condition) return 'active'
  if (len > 0 && len < 11 && condition) return 'at-risk'
  return 'clear'
}

const PENALTIES: PenaltyDef[] = [
  {
    name: 'No Keeper',
    value: 10,
    description: 'Trigger: no wicketkeeper in your XI when all 11 slots are filled. Penalty: -10.',
    status: (xi) => noXStatus(!xi.some(isKeeper), xi.length),
    detail: () => 'Pick a wicketkeeper to clear',
  },
  {
    name: 'No Spinner',
    value: 5,
    description: 'Trigger: no spin bowler in your XI. Penalty: -5.',
    status: (xi) => noXStatus(!xi.some(isSpinner), xi.length),
    detail: () => 'Pick a spin bowler to clear',
  },
  {
    name: 'No Pacer',
    value: 5,
    description: 'Trigger: no pace bowler in your XI. Penalty: -5.',
    status: (xi) => noXStatus(!xi.some(isPacer), xi.length),
    detail: () => 'Pick a pace bowler to clear',
  },
  {
    name: 'No All-Rounder',
    value: 5,
    description: 'Trigger: no all-rounder in your XI. Penalty: -5.',
    status: (xi) => noXStatus(!xi.some(isAllRounder), xi.length),
    detail: () => 'Pick an all-rounder to clear',
  },
  {
    name: 'Thin Batting',
    value: 8,
    description: 'Trigger: fewer than 6 batters, wicketkeepers, or all-rounders in your XI. Penalty: -8.',
    status: (xi) => noXStatus(countBattingSide(xi) < 6, xi.length),
    detail: (xi) => `Only ${countBattingSide(xi)} bat-capable players`,
  },
  {
    name: 'Light on Bowling',
    value: 10,
    description: 'Trigger: fewer than 5 bowlers or all-rounders in your XI. Penalty: -10.',
    status: (xi) => (xi.length === 11 && countBowlingSide(xi) < 5) ? 'active' : 'clear',
    detail: (xi) => `Only ${countBowlingSide(xi)} bowling options`,
  },
  {
    name: 'Boundary Riders',
    value: 10,
    description: 'Trigger: 5 or more finishers in your XI. Penalty: -10.',
    status: (xi) => (xi.length === 11 && xi.filter(isFinisher).length >= 5) ? 'active' : 'clear',
    detail: (xi) => `${xi.filter(isFinisher).length} finishers stacked`,
  },
  {
    name: 'Pure Anchors',
    value: 5,
    description: 'Trigger: 5 or more top-order batters in your XI. Penalty: -5.',
    status: (xi) => (xi.length === 11 && xi.filter(isTopOrderBatter).length >= 5) ? 'active' : 'clear',
    detail: (xi) => `${xi.filter(isTopOrderBatter).length} anchors stacked`,
  },
]

// Exported so XIPanel can compute trackerSubtext without duplicating the math
export function computeTrackerSummary(xi: DraftableCard[]): {
  bonusesMet: number
  net: number
} {
  const bonusResults = BONUSES.map(b => ({ def: b, prog: b.progress(xi) }))
  const penaltyResults = PENALTIES.map(p => ({ st: p.status(xi), def: p }))

  const rawBonus = bonusResults
    .filter(({ prog }) => prog.met)
    .reduce((s, { def }) => s + def.value, 0)
  const totalBonus = Math.min(15, rawBonus)
  const totalPenaltyRaw = penaltyResults
    .filter(({ st }) => st === 'active')
    .reduce((s, { def }) => s + def.value, 0)
  const totalPenalty = Math.min(35, totalPenaltyRaw)

  return {
    bonusesMet: bonusResults.filter(({ prog }) => prog.met).length,
    net: totalBonus - totalPenalty,
  }
}

export default function BonusTracker({ xi }: BonusTrackerProps) {
  const liveBonuses = BONUSES.filter(b => !b.isImpossible(xi))
  const deadBonuses = BONUSES.filter(b => b.isImpossible(xi))

  const penaltyResults = PENALTIES.map(p => ({ def: p, st: p.status(xi) }))
  const visiblePenalties = penaltyResults.filter(({ st }) => st !== 'clear')

  return (
    <div className="px-4 pb-4">

      {/* ── Bonus Progress ──────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-saffron flex-shrink-0" />
        <span className="font-body font-bold uppercase tracking-wider text-[10px] text-muted">
          Bonus Progress
        </span>
      </div>

      <TooltipProvider delayDuration={200}>
        <div className="space-y-3">
          {/* Live bonuses */}
          {liveBonuses.map(def => {
            const prog = def.progress(xi)
            const pct = Math.min(100, (prog.current / prog.target) * 100)
            const detail = prog.detail ?? `${prog.current}/${prog.target}`
            return (
              <Tooltip key={def.name}>
                <TooltipTrigger asChild>
                  <div className="cursor-default">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] leading-none ${prog.met ? 'text-saffron' : 'text-muted'}`}>
                          {prog.met ? '●' : '○'}
                        </span>
                        <span className={`font-body font-bold uppercase tracking-wide text-xs ${prog.met ? 'text-cream' : 'text-muted'}`}>
                          {def.name}
                        </span>
                      </div>
                      <span className={`font-body font-bold text-xs ${prog.met ? 'text-saffron' : 'text-muted'}`}>
                        +{def.value}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-black/20 mt-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-pitch transition-[width] duration-300 ease-out"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="font-body text-[10px] text-muted mt-1">{detail}</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  collisionPadding={8}
                  className="max-w-[220px] bg-surface border border-subtle text-cream text-xs font-body p-3 rounded-lg shadow-lg whitespace-pre-line"
                >
                  {def.description}
                </TooltipContent>
              </Tooltip>
            )
          })}

          {/* Divider before dead bonuses */}
          {deadBonuses.length > 0 && liveBonuses.length > 0 && (
            <div className="border-t border-subtle my-1" />
          )}

          {/* Dead (impossible) bonuses */}
          {deadBonuses.map(def => {
            const prog = def.progress(xi)
            const pct = Math.min(100, (prog.current / prog.target) * 100)
            return (
              <Tooltip key={def.name}>
                <TooltipTrigger asChild>
                  <div className="opacity-40 cursor-default">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] leading-none text-muted">○</span>
                        <span className="font-body font-bold uppercase tracking-wide text-xs text-muted line-through">
                          {def.name}
                        </span>
                      </div>
                      <span className="font-body font-bold text-xs text-muted line-through">
                        +{def.value}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-black/20 mt-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-muted/30 transition-[width] duration-300 ease-out"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="font-body text-[10px] text-muted mt-1">Bonus no longer reachable</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  collisionPadding={8}
                  className="max-w-[220px] bg-surface border border-subtle text-cream text-xs font-body p-3 rounded-lg shadow-lg whitespace-pre-line"
                >
                  {def.description}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        {/* ── Penalties ───────────────────────────────────────────── */}
        <div className="border-t border-subtle my-4" />

        <div className="flex items-center gap-1.5 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F43256] flex-shrink-0" />
          <span className="font-body font-bold uppercase tracking-wider text-[10px] text-muted">
            Penalties
          </span>
        </div>

        {visiblePenalties.length === 0 ? (
          <p className="font-body text-xs text-pitch">No penalties — clean XI.</p>
        ) : (
          <div className="space-y-2">
            {visiblePenalties.map(({ def, st }) => {
              const colorCls = st === 'active' ? 'text-[#F43256]' : 'text-[#F4C430]'
              const detailStr = def.detail?.(xi)
              return (
                <Tooltip key={def.name}>
                  <TooltipTrigger asChild>
                    <div className="cursor-default">
                      <div className="flex items-center justify-between">
                        <div className={`flex items-center gap-1.5 ${colorCls}`}>
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                          <span className="font-body font-bold uppercase tracking-wide text-xs">
                            {def.name}
                          </span>
                        </div>
                        <span className={`font-body font-bold text-xs ${colorCls}`}>
                          -{def.value}
                        </span>
                      </div>
                      {detailStr && (
                        <p className="font-body text-[10px] text-muted mt-0.5 ml-[18px]">{detailStr}</p>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="left"
                    collisionPadding={8}
                    className="max-w-[220px] bg-surface border border-subtle text-cream text-xs font-body p-3 rounded-lg shadow-lg"
                  >
                    {def.description}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        )}
      </TooltipProvider>


    </div>
  )
}
