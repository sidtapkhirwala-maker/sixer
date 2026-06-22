import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCcw } from 'lucide-react'

interface SlotMachineProps {
  mode: 'expanded' | 'collapsed'
  preSpin: boolean
  franchiseName: string
  year: string
  spinningFranchise: boolean
  spinningYear: boolean
  allFranchises: string[]
  allYears: string[]
  // Collapsed mode only
  franchiseLifelines?: number
  yearLifelines?: number
  onRerollFranchise?: () => void
  onRerollYear?: () => void
}

interface DrumProps {
  value: string
  isSpinning: boolean
  accent?: boolean
  pool: string[]
  delay?: number
  preSpin?: boolean
}

const ITEM_H    = 96  // px — one item fills the entire h-24 viewport
const REEL_COUNT = 22

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function buildReel(finalValue: string, pool: string[]): string[] {
  const src = pool.length > 0 ? pool : [finalValue]
  const items: string[] = Array.from({ length: REEL_COUNT }, () => pickRandom(src))
  items.push(finalValue)
  return items
}

function Drum({ value, isSpinning, accent = false, pool, delay = 0, preSpin = false }: DrumProps) {
  const [reel, setReel]           = useState<string[]>([value])
  const [animating, setAnimating] = useState(false)
  const prevSpinning              = useRef(false)

  useEffect(() => {
    if (isSpinning && !prevSpinning.current) {
      setReel(buildReel(value, pool))
      setAnimating(true)
    }
    prevSpinning.current = isSpinning
  }, [isSpinning, value, pool])

  const totalItems = reel.length
  const finalY     = -(totalItems - 1) * ITEM_H

  const textCls = (v: string) =>
    v.length > 6 ? 'text-2xl md:text-3xl' : 'text-3xl md:text-5xl'

  const borderCls = isSpinning
    ? (accent ? 'border-saffron/60' : 'border-pitch/60')
    : (accent ? 'border-saffron'    : 'border-pitch')

  return (
    <div
      className={[
        'relative flex items-center justify-center',
        'bg-surface border-2 rounded-xl overflow-hidden h-24',
        borderCls,
        'transition-colors duration-300',
      ].join(' ')}
    >
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-navy/40 via-transparent to-navy/40 z-10" />

      {animating ? (
        <motion.div
          className="absolute top-0 left-0 w-full will-change-transform"
          style={{ filter: 'blur(0.5px)' }}
          animate={{ y: [0, finalY - 8, finalY] }}
          transition={{
            duration: 1.5,
            delay: delay / 1000,
            times: [0, 0.92, 1],
            ease: [0.22, 1, 0.36, 1],
          }}
          onAnimationComplete={() => setAnimating(false)}
        >
          {reel.map((item, i) => (
            <div key={i} className="flex items-center justify-center" style={{ height: ITEM_H }}>
              <span className={['font-display leading-none select-none px-2', accent ? 'text-saffron' : 'text-cream', textCls(item)].join(' ')}>
                {item}
              </span>
            </div>
          ))}
        </motion.div>
      ) : preSpin ? (
        <span className="font-body text-sm text-muted/50 italic select-none">awaiting spin</span>
      ) : (
        <span className={['font-display leading-none select-none px-2', accent ? 'text-saffron' : 'text-cream', textCls(value)].join(' ')}>
          {value}
        </span>
      )}
    </div>
  )
}

export default function SlotMachine({
  mode,
  preSpin,
  franchiseName,
  year,
  spinningFranchise,
  spinningYear,
  allFranchises,
  allYears,
  franchiseLifelines = 0,
  yearLifelines = 0,
  onRerollFranchise,
  onRerollYear,
}: SlotMachineProps) {

  // ── EXPANDED MODE ─────────────────────────────────────────────────────────
  if (mode === 'expanded') {
    return (
      <div className="flex flex-col items-center gap-2 w-full">
        <div className="grid grid-cols-2 gap-3 w-full max-w-[540px]">
          <div className="flex flex-col gap-1">
            <p className="font-mono text-[10px] text-saffron uppercase tracking-widest text-center">
              Franchise
            </p>
            <Drum
              value={franchiseName}
              isSpinning={spinningFranchise}
              accent
              pool={allFranchises}
              delay={0}
              preSpin={preSpin}
            />
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-mono text-[10px] text-pitch uppercase tracking-widest text-center">
              Season
            </p>
            <Drum
              value={year}
              isSpinning={spinningYear}
              pool={allYears}
              delay={80}
              preSpin={preSpin}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── COLLAPSED MODE ────────────────────────────────────────────────────────
  const isSpinning = spinningFranchise || spinningYear
  const teamCanReroll = franchiseLifelines > 0 && !isSpinning
  const yearCanReroll = yearLifelines      > 0 && !isSpinning

  return (
    <div className="flex items-center gap-2 flex-wrap">

      {/* TEAM: entire pill + icon wrapped in one button */}
      <button
        onClick={onRerollFranchise}
        disabled={!teamCanReroll}
        className={[
          'flex items-center gap-2 px-3 py-1.5 rounded-full border bg-navy transition-colors',
          spinningFranchise
            ? 'border-saffron animate-pulse cursor-default'
            : teamCanReroll
              ? 'border-saffron/60 hover:bg-saffron/10 cursor-pointer'
              : 'border-saffron/30 opacity-40 cursor-not-allowed',
        ].join(' ')}
        aria-label="Reroll team"
      >
        <span className="font-mono text-[10px] text-muted uppercase tracking-wide">TEAM</span>
        <span className="text-muted/40 select-none">|</span>
        <span className="font-body font-bold text-base text-cream">
          {spinningFranchise ? '···' : franchiseName}
        </span>
        <RotateCcw size={12} className={teamCanReroll ? 'text-saffron ml-1' : 'text-saffron/30 ml-1'} />
      </button>

      <span className="text-muted/40 text-sm select-none">—</span>

      {/* SEASON: entire pill + icon wrapped in one button */}
      <button
        onClick={onRerollYear}
        disabled={!yearCanReroll}
        className={[
          'flex items-center gap-2 px-3 py-1.5 rounded-full border bg-navy transition-colors',
          spinningYear
            ? 'border-pitch animate-pulse cursor-default'
            : yearCanReroll
              ? 'border-pitch/60 hover:bg-pitch/10 cursor-pointer'
              : 'border-pitch/30 opacity-40 cursor-not-allowed',
        ].join(' ')}
        aria-label="Reroll year"
      >
        <span className="font-mono text-[10px] text-muted uppercase tracking-wide">SEASON</span>
        <span className="text-muted/40 select-none">|</span>
        <span className="font-body font-bold text-base text-cream">
          {spinningYear ? '···' : year}
        </span>
        <RotateCcw size={12} className={yearCanReroll ? 'text-pitch ml-1' : 'text-pitch/30 ml-1'} />
      </button>
    </div>
  )
}
