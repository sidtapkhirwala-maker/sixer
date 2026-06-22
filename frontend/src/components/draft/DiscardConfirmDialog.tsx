import { motion, AnimatePresence } from 'framer-motion'
import type { DraftableCard } from '@/types/draft'

interface DiscardConfirmDialogProps {
  card: DraftableCard | null
  onConfirm: () => void
  onCancel: () => void
}

export default function DiscardConfirmDialog({ card, onConfirm, onCancel }: DiscardConfirmDialogProps) {
  return (
    <AnimatePresence>
      {card && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-navy/80 backdrop-blur-sm"
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto bg-surface border border-subtle rounded-2xl p-6 max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <p className="font-body text-xs text-muted uppercase tracking-widest mb-1">
                Drafting
              </p>
              <p className="font-display text-2xl text-cream mb-1 leading-tight">
                {card.display_name || card.player_name}
              </p>
              <p className="font-body text-sm text-muted mb-1">
                {card.role_primary} · {card.season_quality_tier} tier
              </p>
              <p className="font-body text-sm text-muted/70 italic mb-6 leading-snug">
                {card.one_line_descriptor}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 py-3 rounded-lg border border-subtle text-muted font-body text-sm hover:border-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  className="flex-1 py-3 rounded-lg bg-saffron text-navy font-display text-lg hover:shadow-[0_0_24px_rgba(255,107,26,0.3)] transition-all"
                >
                  DRAFT
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
