import { Plane } from 'lucide-react'
import type { DraftableCard } from '@/types/draft'

interface XISlotProps {
  index: number
  card: DraftableCard | null
  isNext: boolean
  isLast: boolean
}

interface RoleChip {
  abbr: string
  cls: string
}

function getRoleChip(rolePrimary: string): RoleChip {
  switch (rolePrimary) {
    case 'Top-Order Batter':
    case 'Middle-Order Batter':
    case 'Finisher':
      return { abbr: 'BAT', cls: 'text-saffron bg-saffron/10' }
    case 'Wicketkeeper':
      return { abbr: 'WK',  cls: 'text-[#F4C430] bg-[#F4C430]/10' }
    case 'Pace Bowler':
      return { abbr: 'PCE', cls: 'text-pitch bg-pitch/10' }
    case 'Spin Bowler':
      return { abbr: 'SPN', cls: 'text-pitch bg-pitch/10' }
    case 'Batting All-Rounder':
    case 'Bowling All-Rounder':
      return { abbr: 'AR',  cls: 'text-[#9D71E8] bg-[#9D71E8]/10' }
    default:
      return { abbr: '—',   cls: 'text-muted bg-subtle' }
  }
}

export default function XISlot({ index, card, isNext, isLast }: XISlotProps) {
  const chip = card ? getRoleChip(card.role_primary) : null

  return (
    <div
      className={[
        'flex items-center justify-between gap-3 px-4 py-3',
        isLast ? '' : 'border-b border-subtle',
        card ? 'bg-surface' : 'bg-surface/30',
      ].join(' ')}
    >
      {/* LEFT GROUP: slot# + name + role chip + franchise·year + overseas */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="font-body text-sm text-muted w-6 shrink-0 text-right">
          {index + 1}
        </span>

        {card ? (
          <>
            <span className="font-body font-bold text-base text-cream min-w-0 truncate">
              {card.display_name}
            </span>
            <span className={`font-body font-bold text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-md shrink-0 ${chip!.cls}`}>
              {chip!.abbr}
            </span>
            <span className="font-body text-xs text-muted shrink-0">
              {card.franchise_short} · {card.season_year}
            </span>
            {card.is_overseas && (
              <Plane size={11} className="text-saffron shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="font-body text-base text-muted/40">—</span>
            {isNext && (
              <span className="font-body font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md text-saffron bg-saffron/10 shrink-0">
                NEXT
              </span>
            )}
          </>
        )}
      </div>

      {/* RIGHT: full role_primary text — hidden on mobile (XIPanel only shows at lg+) */}
      {card ? (
        <span className="hidden lg:inline font-body text-xs text-muted italic shrink-0">
          {card.role_primary}
        </span>
      ) : (
        <span />
      )}
    </div>
  )
}
