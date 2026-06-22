import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import CardRow from './CardRow'
import type { DraftableCard, DraftMode } from '@/types/draft'

interface CardListProps {
  cards: DraftableCard[]
  mode: DraftMode
  onPick: (card: DraftableCard) => void
  visible: boolean
  pickedPlayerNames: string[]
  overseasCount: number
}

function seededShuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = (i * 1013) % (i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export default function CardList({
  cards, mode, onPick, visible, pickedPlayerNames, overseasCount,
}: CardListProps) {
  const pickedSet = useMemo(() => new Set(pickedPlayerNames), [pickedPlayerNames])

  const displayCards = useMemo(() => {
    if (mode === 'criciq') return seededShuffle(cards)
    return [...cards].sort((a, b) => b.player_score - a.player_score)
  }, [cards, mode])

  return (
    <AnimatePresence>
      {visible && cards.length === 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="font-body text-sm text-muted/60 px-1 py-4"
        >
          No players match your filter.
        </motion.p>
      )}
      {visible && cards.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-1.5 md:gap-2 max-w-[640px]"
        >
          {displayCards.map((card, i) => (
            <CardRow
              key={card.id}
              card={card}
              index={i}
              mode={mode}
              alreadyDrafted={pickedSet.has(card.player_name)}
              overseasBlocked={overseasCount >= 4 && card.is_overseas}
              onPick={onPick}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
