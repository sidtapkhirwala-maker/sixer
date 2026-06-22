import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import XISlot from './XISlot'
import BonusTracker, { computeTrackerSummary } from './BonusTracker'
import { sortXI } from '@/lib/sortXI'
import type { DraftableCard } from '@/types/draft'

interface XIPanelProps {
  picks: DraftableCard[]
  uiPhase: 'pre-spin' | 'spinning' | 'selecting'
}

function getXiSubtext(uiPhase: 'pre-spin' | 'spinning' | 'selecting', picksLen: number): string {
  if (picksLen >= 11) return '11 / 11 picked · running your season…'
  if (uiPhase === 'selecting' || uiPhase === 'spinning') {
    return `${picksLen} / 11 picked · select a player to fill slot #${picksLen + 1}`
  }
  return `${picksLen} / 11 picked · spin to start round ${picksLen + 1}`
}

function getTrackerSubtext(picks: DraftableCard[]): string {
  const { bonusesMet, net } = computeTrackerSummary(picks)
  const netStr = net > 0 ? `+${net}` : net < 0 ? String(net) : '±0'
  return `${bonusesMet} bonus${bonusesMet === 1 ? '' : 'es'} active · net ${netStr}`
}

export default function XIPanel({ picks, uiPhase }: XIPanelProps) {
  const sorted = sortXI(picks)
  const nextEmptySlot = picks.length < 11 ? picks.length : -1
  const [trackerOpen, setTrackerOpen] = useState(false)

  return (
    // `grow` makes the aside fill remaining flex width; no `self-start` so it
    // stretches to the full height of the left column — giving the sticky child
    // enough room to actually stick as the user scrolls through the player list.
    <aside className="hidden lg:block grow">
      <div className="sticky top-[80px] max-h-[calc(100vh-100px)] overflow-y-auto bg-surface rounded-xl border border-subtle">

        {/* ── Header — always visible ── */}
        <div className="px-4 pt-4 pb-3 border-b border-subtle">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-lg text-cream leading-none">
                {trackerOpen ? 'BONUS TRACKER' : 'YOUR XI'}
              </p>
              <p className="font-body text-sm text-muted mt-1">
                {trackerOpen
                  ? getTrackerSubtext(picks)
                  : getXiSubtext(uiPhase, picks.length)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTrackerOpen(prev => !prev)}
              className={[
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full',
                'font-body font-bold uppercase tracking-wider text-[10px]',
                'border transition-colors flex-shrink-0',
                trackerOpen
                  ? 'bg-saffron text-navy border-saffron'
                  : 'bg-surface text-cream border-subtle hover:border-saffron hover:text-saffron',
              ].join(' ')}
              aria-expanded={trackerOpen}
            >
              <span>{trackerOpen ? 'BACK TO XI' : 'BONUS TRACKER'}</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform ${trackerOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* ── Body: XI slots OR tracker — never both ── */}
        <div className="w-full">
          <AnimatePresence mode="wait">
            {trackerOpen ? (
              <motion.div
                key="tracker"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="w-full pt-4"
              >
                <BonusTracker xi={picks} />
              </motion.div>
            ) : (
              <motion.div
                key="xi"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="w-full"
              >
              {/* Slot list — border-b on each row handles separation */}
              <div className="flex flex-col">
                {Array.from({ length: 11 }, (_, i) => {
                  const card = sorted[i] ?? null
                  return (
                    <motion.div
                      key={card ? `${card.player_name}-${card.season_year}` : `empty-${i}`}
                      layout
                      layoutId={card ? `pick-${card.player_name}-${card.season_year}` : undefined}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                    >
                      <XISlot index={i} card={card} isNext={i === nextEmptySlot} isLast={i === 10} />
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </aside>
  )
}
