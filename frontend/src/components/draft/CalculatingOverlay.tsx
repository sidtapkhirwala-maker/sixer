import { motion, AnimatePresence } from 'framer-motion'

interface CalculatingOverlayProps {
  visible: boolean
}

const DOTS = ['●', '●●', '●●●']

export default function CalculatingOverlay({ visible }: CalculatingOverlayProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-navy flex flex-col items-center justify-center gap-8"
        >
          {/* Pulsing logo */}
          <motion.p
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="font-display text-7xl md:text-9xl select-none"
          >
            <span className="text-cream">SIX</span>
            <span className="text-saffron">ER</span>
          </motion.p>

          {/* Dot loader */}
          <div className="flex gap-3">
            {DOTS.map((dot, i) => (
              <motion.span
                key={i}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
                className="font-mono text-saffron text-xl"
              >
                {dot}
              </motion.span>
            ))}
          </div>

          <p className="font-body text-muted text-sm tracking-widest uppercase">
            Calculating your score…
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
