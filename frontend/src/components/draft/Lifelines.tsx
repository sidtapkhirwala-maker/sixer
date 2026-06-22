import { RefreshCw } from 'lucide-react'

interface LifelinesProps {
  franchiseRemaining: number
  yearRemaining: number
  onRerollFranchise: () => void
  onRerollYear: () => void
  disabled: boolean
}

interface LifelineBtnProps {
  label: string
  remaining: number
  onClick: () => void
  disabled: boolean
}

function LifelineBtn({ label, remaining, onClick, disabled }: LifelineBtnProps) {
  const available = remaining > 0 && !disabled
  return (
    <button
      onClick={onClick}
      disabled={!available}
      className={[
        'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-body transition-all duration-150',
        available
          ? 'border-pitch text-pitch hover:bg-pitch/10'
          : 'border-subtle text-muted/40 cursor-not-allowed',
      ].join(' ')}
    >
      <RefreshCw size={13} />
      <span>{label}</span>
      <span
        className={[
          'font-mono text-xs rounded-full w-5 h-5 flex items-center justify-center',
          available ? 'bg-pitch/20 text-pitch' : 'bg-subtle text-muted/40',
        ].join(' ')}
      >
        {remaining}
      </span>
    </button>
  )
}

export default function Lifelines({
  franchiseRemaining,
  yearRemaining,
  onRerollFranchise,
  onRerollYear,
  disabled,
}: LifelinesProps) {
  return (
    <div className="flex gap-2 flex-wrap justify-center">
      <LifelineBtn
        label="New team"
        remaining={franchiseRemaining}
        onClick={onRerollFranchise}
        disabled={disabled}
      />
      <LifelineBtn
        label="New year"
        remaining={yearRemaining}
        onClick={onRerollYear}
        disabled={disabled}
      />
    </div>
  )
}
