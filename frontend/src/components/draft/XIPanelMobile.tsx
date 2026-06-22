import { useRef, useState } from 'react'
import { ChevronUp } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import XISlot from './XISlot'
import BonusTracker, { computeTrackerSummary } from './BonusTracker'
import type { DraftableCard } from '@/types/draft'

function getTrackerSubtext(picks: DraftableCard[]): string {
  const { bonusesMet, net } = computeTrackerSummary(picks)
  const netStr = net > 0 ? `+${net}` : net < 0 ? String(net) : '±0'
  return `${bonusesMet} bonus${bonusesMet === 1 ? '' : 'es'} · net ${netStr}`
}

export default function XIPanelMobile({ picks }: { picks: DraftableCard[] }) {
  const [expanded, setExpanded] = useState(false)
  const [trackerOpen, setTrackerOpen] = useState(false)
  const touchStartY = useRef(0)

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (e.changedTouches[0].clientY - touchStartY.current > 50) setExpanded(false)
  }

  return (
    <>
      {/* Backdrop — tap to close, z below panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="backdrop"
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[39]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setExpanded(false)}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-navy border-t border-subtle">
        {/* Header — always visible; swipe-down or tap chevron to collapse */}
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
          onClick={() => setExpanded(v => !v)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-center gap-3 min-w-0">
            <p className="font-display text-base text-cream leading-none shrink-0">
              {trackerOpen ? 'BONUS TRACKER' : 'YOUR XI'}
            </p>
            <span className="font-mono text-xs text-muted truncate">
              {trackerOpen ? getTrackerSubtext(picks) : `${picks.length}/11`}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setTrackerOpen(v => !v) }}
              className={[
                'inline-flex items-center px-2.5 py-1 rounded-full',
                'font-body font-bold uppercase tracking-wider text-[10px]',
                'border transition-colors',
                trackerOpen
                  ? 'bg-saffron text-navy border-saffron'
                  : 'bg-surface text-cream border-subtle hover:border-saffron hover:text-saffron',
              ].join(' ')}
            >
              {trackerOpen ? 'YOUR XI' : 'BONUSES'}
            </button>
            {/* Chevron rotates 180deg when expanded (up→down = close indicator) */}
            <ChevronUp
              size={16}
              className={`text-muted transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </div>
        </div>

        {/* Expanded content — capped at 70vh minus header (~3.5rem), scrollable */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              key="content"
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 3.5rem)' }}>
                <AnimatePresence mode="wait">
                  {trackerOpen ? (
                    <motion.div
                      key="tracker"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="w-full pt-4 pb-4"
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
                    >
                      <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-1">
                        {Array.from({ length: 11 }, (_, i) => (
                          <XISlot
                            key={i}
                            index={i}
                            card={picks[i] ?? null}
                            isNext={i === picks.length && picks.length < 11}
                            isLast={i === 10}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
