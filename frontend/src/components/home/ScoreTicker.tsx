import { motion } from 'framer-motion'

const ENTRIES = [
  { team: 'CHENNAI',   score: '246/5', scoreClass: 'text-saffron' },
  { team: 'BENGALURU', score: '263/5', scoreClass: 'text-pitch'   },
  { team: 'HYDERABAD', score: '277/3', scoreClass: 'text-saffron' },
  { team: 'MUMBAI',    score: '235/9', scoreClass: 'text-pitch'   },
  { team: 'RAJASTHAN', score: '217/7', scoreClass: 'text-saffron' },
  { team: 'PUNJAB',    score: '262/2', scoreClass: 'text-pitch'   },
  { team: 'KOLKATA',   score: '232/2', scoreClass: 'text-saffron' },
  { team: 'DELHI',     score: '231/4', scoreClass: 'text-pitch'   },
]

function TickerContent() {
  return (
    <span className="inline-flex items-center">
      {ENTRIES.map((entry, i) => (
        <span key={i} className="inline-flex items-center">
          <span className="font-body text-sm text-cream tracking-wide px-1">
            {entry.team}
          </span>
          <span className={`font-mono text-sm ${entry.scoreClass} px-1`}>
            {entry.score}
          </span>
          <span className="font-mono text-sm text-muted px-3">·</span>
        </span>
      ))}
    </span>
  )
}

export default function ScoreTicker() {
  return (
    <div className="w-full border-t border-b border-subtle bg-navy overflow-hidden h-10 flex items-center">
      <motion.div
        className="flex whitespace-nowrap"
        animate={{ x: ['0%', '-50%'] }}
        transition={{
          duration: 40,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        <TickerContent />
        <TickerContent />
      </motion.div>
    </div>
  )
}
