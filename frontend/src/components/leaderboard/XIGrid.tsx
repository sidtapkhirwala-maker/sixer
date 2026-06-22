import { Plane } from 'lucide-react'
import { formatRoleShort } from '@/lib/roles'

// ── Shared types ───────────────────────────────────────────────────────────────

export interface XiEntry {
  player_name: string
  display_name: string | null
  season_year?: number
  franchise_short?: string | null
  role_primary: string
  is_overseas: boolean
  player_score: number
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

export function formatScore(score: number): string {
  const rounded = Math.round(score * 100) / 100
  return rounded.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

export function roleChipCls(rolePrimary: string): string {
  switch (rolePrimary) {
    case 'Top-Order Batter':
    case 'Middle-Order Batter':
    case 'Finisher':            return 'text-saffron bg-saffron/10'
    case 'Wicketkeeper':        return 'text-[#F4C430] bg-[#F4C430]/10'
    case 'Pace Bowler':
    case 'Spin Bowler':         return 'text-pitch bg-pitch/10'
    case 'Batting All-Rounder':
    case 'Bowling All-Rounder': return 'text-[#9D71E8] bg-[#9D71E8]/10'
    default:                    return 'text-muted bg-subtle'
  }
}

// ── XI grid (expandable XI list used by Leaderboard and Profile) ───────────────

export function XIGrid({ xi }: { xi: XiEntry[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 px-8 py-4 bg-navy/60 border-b border-subtle">
      {xi.map((p, i) => (
        <div key={p.player_name} className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[10px] text-muted w-4 shrink-0 text-right">{i + 1}</span>
          {p.is_overseas && <Plane size={9} className="text-muted/60 shrink-0" />}
          <span className="font-body text-xs text-cream flex-1 min-w-0 truncate">
            {p.display_name ?? p.player_name}
          </span>
          <span className={`font-mono text-[9px] px-1 py-0.5 rounded shrink-0 ${roleChipCls(p.role_primary)}`}>
            {formatRoleShort(p.role_primary)}
          </span>
          {(p.franchise_short || p.season_year) && (
            <span className="font-mono text-[9px] text-muted/50 shrink-0 hidden sm:inline tabular-nums">
              {[p.franchise_short, p.season_year].filter(Boolean).join(' · ')}
            </span>
          )}
          <span className="font-mono text-[10px] text-cream shrink-0 tabular-nums w-10 text-right">
            {formatScore(p.player_score)}
          </span>
        </div>
      ))}
    </div>
  )
}
