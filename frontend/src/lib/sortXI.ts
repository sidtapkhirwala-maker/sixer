import type { DraftableCard } from '@/types/draft'
import { isKeeper } from '@/lib/roles'

export function sortXI(picks: DraftableCard[]): DraftableCard[] {
  const keepers    = picks.filter(p => isKeeper(p))
    .sort((a, b) => (a.avg_batting_position ?? 99) - (b.avg_batting_position ?? 99))
  const nonKeepers = picks.filter(p => !isKeeper(p))
    .sort((a, b) => (a.avg_batting_position ?? 99) - (b.avg_batting_position ?? 99))

  const result: DraftableCard[] = []
  let ki = 0, ni = 0
  while (ki < keepers.length || ni < nonKeepers.length) {
    if (ki >= keepers.length) {
      result.push(nonKeepers[ni++])
    } else if (ni >= nonKeepers.length) {
      result.push(keepers[ki++])
    } else {
      const kPos = keepers[ki].avg_batting_position ?? 99
      const nPos = nonKeepers[ni].avg_batting_position ?? 99
      if (kPos <= nPos) result.push(keepers[ki++])
      else              result.push(nonKeepers[ni++])
    }
  }
  return result
}
