interface RoundCounterProps {
  round: number   // 1-based display (roundIndex + 1)
  total?: number
}

export default function RoundCounter({ round, total = 11 }: RoundCounterProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={[
              'w-2 h-2 rounded-full transition-colors duration-300',
              i < round - 1 ? 'bg-saffron' : i === round - 1 ? 'bg-cream' : 'bg-subtle',
            ].join(' ')}
          />
        ))}
      </div>
      <span className="font-mono text-xs text-muted tabular-nums">
        {round} / {total}
      </span>
    </div>
  )
}
