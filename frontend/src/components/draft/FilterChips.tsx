export type FilterKey = 'ALL' | 'BAT' | 'BWL' | 'AR' | 'WK'

interface FilterChipsProps {
  active: FilterKey
  onChange: (next: FilterKey) => void
}

const CHIPS: { key: FilterKey; label: string; activeCls: string }[] = [
  { key: 'ALL', label: 'ALL', activeCls: 'bg-saffron text-navy' },
  { key: 'BAT', label: 'BAT', activeCls: 'bg-saffron text-navy' },
  { key: 'BWL', label: 'BWL', activeCls: 'bg-pitch text-navy' },
  { key: 'AR',  label: 'AR',  activeCls: 'bg-[#9D71E8] text-white' },
  { key: 'WK',  label: 'WK',  activeCls: 'bg-saffron text-navy' },
]

export default function FilterChips({ active, onChange }: FilterChipsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {CHIPS.map(({ key, label, activeCls }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={[
            'font-body font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-full transition-colors duration-150',
            active === key
              ? activeCls
              : 'bg-surface text-muted border border-subtle hover:border-muted',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
