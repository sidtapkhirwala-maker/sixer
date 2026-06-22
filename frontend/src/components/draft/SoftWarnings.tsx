import { AlertCircle } from 'lucide-react'
import type { DraftableCard } from '@/types/draft'
import { isTopOrderBatter, isKeeper, isSpinner, isPacer, isAllRounder } from '@/lib/roles'

interface SoftWarningsProps {
  picks: DraftableCard[]
}

export default function SoftWarnings({ picks }: SoftWarningsProps) {
  const warnings: string[] = []
  const count = picks.length

  // Warning 1: No top-order batter (triggers at 7+ picks)
  if (count >= 7 && !picks.some(isTopOrderBatter)) {
    warnings.push('No top-order batter yet')
  }

  // Warning 2: No wicketkeeper (triggers at 8+ picks)
  if (count >= 8 && !picks.some(isKeeper)) {
    warnings.push('No wicketkeeper drafted')
  }

  // Warning 3: Fewer than 4 bowling roles (triggers at 9+ picks)
  if (count >= 9) {
    const bowlingRolesCount = picks.filter(c =>
      isSpinner(c) || isPacer(c) || isAllRounder(c)
    ).length
    if (bowlingRolesCount < 4) {
      warnings.push('Fewer than 4 bowlers')
    }
  }

  if (warnings.length === 0) return null

  return (
    <div className="flex flex-col gap-2 pt-3 mt-6 border-t border-subtle">
      {warnings.map(w => (
        <div key={w} className="flex items-center gap-2 text-muted">
          <AlertCircle size={14} className="shrink-0" />
          <p className="font-body text-sm">{w}</p>
        </div>
      ))}
    </div>
  )
}
