import { motion } from 'framer-motion'
import { Plane } from 'lucide-react'
import type { DraftableCard, DraftMode } from '@/types/draft'
import { isKeeper, isPacer, isSpinner, ROLE_PRIMARY } from '@/lib/roles'

interface CardRowProps {
  card: DraftableCard
  index: number
  mode: DraftMode
  alreadyDrafted: boolean
  overseasBlocked: boolean
  onPick: (card: DraftableCard) => void
}

interface StatBlock {
  label: string
  value: string
}

function fmt(val: number | null | undefined, decimals = 0): string {
  if (val == null || isNaN(val)) return '—'
  return decimals > 0 ? val.toFixed(decimals) : String(Math.round(val))
}

// 3-block stat row for non-AR cards (batters, bowlers, keepers)
function getStatBlocks(card: DraftableCard): StatBlock[] {
  if (isPacer(card) || isSpinner(card)) {
    return [
      { label: 'WKTS', value: fmt(card.wickets_taken) },
      { label: 'ECON', value: fmt(card.bowling_economy, 2) },
      { label: 'AVG',  value: fmt(card.bowling_average, 1) },
    ]
  }
  return [
    { label: 'RUNS', value: fmt(card.runs_scored) },
    { label: 'SR',   value: fmt(card.batting_strike_rate, 1) },
    { label: 'AVG',  value: fmt(card.batting_average, 1) },
  ]
}

// Two rows of 3 for all-rounders: [topRow, bottomRow]
function getArStatRows(card: DraftableCard): [StatBlock[], StatBlock[]] {
  const batting: StatBlock[] = [
    { label: 'RUNS', value: fmt(card.runs_scored) },
    { label: 'SR',   value: fmt(card.batting_strike_rate, 1) },
    { label: 'AVG',  value: fmt(card.batting_average, 1) },
  ]
  const bowling: StatBlock[] = [
    { label: 'WKTS', value: fmt(card.wickets_taken) },
    { label: 'ECON', value: fmt(card.bowling_economy, 2) },
    { label: 'AVG',  value: fmt(card.bowling_average, 1) },
  ]
  // Batting AR: batting discipline is primary (top row)
  return card.role_primary === ROLE_PRIMARY.BATTING_AR
    ? [batting, bowling]
    : [bowling, batting]
}

function getRoleChipCls(rolePrimary: string): string {
  switch (rolePrimary) {
    case 'Top-Order Batter':
    case 'Middle-Order Batter':
    case 'Finisher':
      return 'text-saffron bg-saffron/10'
    case 'Wicketkeeper':
      return 'text-[#F4C430] bg-[#F4C430]/10'
    case 'Pace Bowler':
    case 'Spin Bowler':
      return 'text-pitch bg-pitch/10'
    case 'Batting All-Rounder':
    case 'Bowling All-Rounder':
      return 'text-[#9D71E8] bg-[#9D71E8]/10'
    default:
      return 'text-muted bg-subtle'
  }
}

export default function CardRow({ card, index, mode, alreadyDrafted, overseasBlocked, onPick }: CardRowProps) {
  const isClassic  = mode === 'classic'
  const isDisabled = alreadyDrafted || overseasBlocked
  const keeper     = isKeeper(card)
  const isAR       = card.role_primary === ROLE_PRIMARY.BATTING_AR ||
                     card.role_primary === ROLE_PRIMARY.BOWLING_AR

  const statBlocks = (isClassic && !isAR) ? getStatBlocks(card) : []
  const arRows     = (isClassic && isAR)  ? getArStatRows(card) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: index * 0.04 }}
      className="group"
    >
      <button
        onClick={() => { if (!isDisabled) onPick(card) }}
        disabled={isDisabled}
        className={[
          // Mobile: tighter padding; md+: original spacing (desktop unchanged)
          'w-full flex items-center gap-3 md:gap-5 px-3 md:px-5 py-2.5 md:py-4 rounded-lg border text-left',
          'transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-saffron',
          isDisabled
            ? 'border-subtle bg-surface/20 opacity-40 cursor-not-allowed'
            : 'border-subtle bg-surface hover:border-saffron/60 hover:bg-surface/80 active:scale-[0.99]',
        ].join(' ')}
      >
        {/* ── LEFT: name + role chip + franchise + stats ───────────────── */}
        <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center md:gap-8">

          <div className="flex-1 min-w-0">
            {/* Mobile: name + chip on same line. Desktop: stacked (md:block restores flow) */}
            <div className="flex items-center gap-2 md:block">
              <p className="font-body font-bold text-base text-cream leading-tight truncate flex-1 min-w-0">
                {card.display_name || card.player_name}
              </p>
              <span className={`inline-block shrink-0 md:mt-1 font-body font-bold text-xs px-2 py-0.5 rounded-md ${getRoleChipCls(card.role_primary)}`}>
                {card.role_primary}
              </span>
            </div>

            {/* Classic mode: franchise + compact mobile stats on one line */}
            {isClassic && (
              <div className="flex items-baseline justify-between gap-2 mt-0.5 md:block">
                <p className="font-body text-xs text-muted whitespace-nowrap">
                  {card.franchise_short} · {card.season_year}
                </p>

                {/* Non-AR: 3 compact stat chips, mobile only */}
                {statBlocks.length > 0 && (
                  <div className="flex items-center gap-x-2 md:hidden">
                    {statBlocks.map(({ label, value }) => (
                      <span key={label} className="font-mono text-[10px] text-cream/70 tabular-nums whitespace-nowrap">
                        {value}<span className="text-muted/60 ml-0.5">{label}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* AR: two compact stat rows, mobile only */}
                {arRows && (
                  <div className="flex flex-col items-end gap-px md:hidden">
                    {arRows.map((row, ri) => (
                      <div key={ri} className="flex items-center gap-x-2">
                        {row.map(({ label, value }) => (
                          <span key={label} className="font-mono text-[10px] text-cream/70 tabular-nums whitespace-nowrap">
                            {value}<span className="text-muted/60 ml-0.5">{label}</span>
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop: non-AR — single row of 3 stats (unchanged) */}
          {statBlocks.length > 0 && (
            <div className="hidden md:flex items-end gap-4 shrink-0">
              {statBlocks.map(({ label, value }) => (
                <div key={label} className="flex flex-col items-center gap-0.5">
                  <span className="font-mono text-base font-semibold text-cream tabular-nums">
                    {value}
                  </span>
                  <span className="font-body text-xs text-muted uppercase tracking-wide">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Desktop: AR — two rows of 3 stats (unchanged) */}
          {arRows && (
            <div className="hidden md:flex flex-col gap-3 shrink-0">
              {arRows.map((row, ri) => (
                <div key={ri} className="flex items-end gap-4">
                  {row.map(({ label, value }) => (
                    <div key={label} className="flex flex-col items-center gap-0.5">
                      <span className="font-body font-bold text-sm text-cream tabular-nums">
                        {value}
                      </span>
                      <span className="font-body text-[9px] text-muted uppercase tracking-wide">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: WK badge / overseas / status badges (unchanged) ───── */}
        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          {keeper && (
            <span className="font-mono text-[10px] text-[#F4C430] bg-[#F4C430]/15 px-1.5 py-0.5 rounded">
              WK
            </span>
          )}
          {card.is_overseas && (
            <Plane size={12} className="text-saffron" />
          )}
          {alreadyDrafted && (
            <span className="font-mono text-[10px] text-muted/60">DRAFTED</span>
          )}
          {overseasBlocked && !alreadyDrafted && (
            <span className="font-mono text-[10px] text-saffron/70 flex items-center gap-0.5">
              CAP <Plane size={10} />
            </span>
          )}
          {!isDisabled && (
            <span className="font-body text-xs text-saffron opacity-0 group-hover:opacity-100 transition-opacity duration-100">
              →
            </span>
          )}
        </div>
      </button>
    </motion.div>
  )
}
