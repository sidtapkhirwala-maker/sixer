import { motion } from 'framer-motion'

interface SpinButtonProps {
  onClick: () => void
  disabled: boolean
  phase: 'idle' | 'spinning' | 'picking' | 'done'
}

const LABEL: Record<string, string> = {
  idle:     'SPIN',
  spinning: 'SPINNING…',
  picking:  'PICK A PLAYER',
  done:     'DONE',
}

export default function SpinButton({ onClick, disabled, phase }: SpinButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? {} : { scale: 0.96 }}
      className={[
        'relative px-10 py-4 rounded-xl font-display text-xl tracking-wide',
        'transition-all duration-200',
        phase === 'idle'
          ? 'bg-saffron text-navy shadow-[0_0_32px_rgba(255,107,26,0.3)] hover:shadow-[0_0_48px_rgba(255,107,26,0.4)] hover:scale-[1.02]'
          : 'bg-surface text-muted border border-subtle cursor-not-allowed',
      ].join(' ')}
    >
      {LABEL[phase] ?? 'SPIN'}
    </motion.button>
  )
}
