import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

interface ModeCTAProps {
  mode: 'classic' | 'criciq'
}

export default function ModeCTA({ mode }: ModeCTAProps) {
  const isClassic = mode === 'classic'

  const label       = isClassic ? 'CLASSIC' : 'CRICIQ'
  const description = isClassic
    ? 'Stats visible. Pick the legends you know.'
    : 'No stats. Pure cricket knowledge.'
  const borderClass = isClassic ? 'border-saffron' : 'border-pitch'
  const accentClass = isClassic ? 'text-saffron'   : 'text-pitch'
  const glowClass   = isClassic
    ? 'hover:shadow-[0_0_32px_rgba(255,107,26,0.2)]'
    : 'hover:shadow-[0_0_32px_rgba(0,200,150,0.2)]'

  return (
    <Link
      to={`/draft?mode=${mode}`}
      className={[
        'relative flex flex-col justify-center',
        'bg-surface border-2 rounded-2xl',
        borderClass,
        'px-6 py-8 cursor-pointer',
        'transition-all duration-200',
        'hover:scale-[1.02]',
        glowClass,
        'w-full md:w-[280px] min-h-[160px]',
      ].join(' ')}
    >
      <ArrowRight
        className={`absolute top-4 right-4 w-5 h-5 ${accentClass}`}
      />
      <span className={`font-display text-4xl leading-none ${accentClass}`}>
        {label}
      </span>
      <span className="font-body text-sm text-muted mt-2">{description}</span>
    </Link>
  )
}
