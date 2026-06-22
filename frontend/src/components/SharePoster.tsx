import { getHistoricalShortCode } from '@/lib/franchiseHistory'
import type { DraftableCard } from '@/types/draft'

export interface SharePosterProps {
  record: string
  sixerScore: number
  tier: string
  mode: string
  dailyNumber?: number | null
  xi: DraftableCard[]
  bonusesTriggered: string[]
  penaltiesTriggered: string[]
}

// ── Color palette (all hex — html-to-image needs concrete values, not CSS vars) ─

const C = {
  bg:      '#0A0E27',
  card:    '#0F1430',
  border:  'rgba(255,107,26,0.2)',
  saffron: '#FF6B1A',
  pitch:   '#00C896',
  cream:   '#F5F5F0',
  muted:   '#8B8FA8',
  subtle:  '#1F2547',
  amber:   '#F4C430',
  purple:  '#9D71E8',
  red:     '#F43256',
} as const

// Tier letter color (applied to the tier card letter only)
const TIER_LETTER_COLOR: Record<string, string> = {
  S: C.saffron,
  A: C.pitch,  B: C.pitch,
  C: C.amber,  D: C.amber,
  E: C.red,    F: C.red,
}

function roleChipColors(role: string): { bg: string; color: string } {
  switch (role) {
    case 'Top-Order Batter':
    case 'Middle-Order Batter':
    case 'Finisher':            return { bg: C.saffron, color: C.bg }
    case 'Wicketkeeper':        return { bg: C.amber,   color: C.bg }
    case 'Batting All-Rounder':
    case 'Bowling All-Rounder': return { bg: C.purple,  color: C.cream }
    case 'Pace Bowler':
    case 'Spin Bowler':         return { bg: C.pitch,   color: C.bg }
    default:                    return { bg: C.subtle,  color: C.muted }
  }
}

function formatRolePoster(role: string): string {
  switch (role) {
    case 'Top-Order Batter':    return 'TOP'
    case 'Middle-Order Batter': return 'MID'
    case 'Finisher':            return 'FIN'
    case 'Wicketkeeper':        return 'WK'
    case 'Batting All-Rounder': return 'BAT AR'
    case 'Bowling All-Rounder': return 'BWL AR'
    case 'Pace Bowler':         return 'PACE'
    case 'Spin Bowler':         return 'SPIN'
    default:                    return role.slice(0, 4).toUpperCase()
  }
}

function fmtScore(n: number): string {
  return n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

// ── Poster component ──────────────────────────────────────────────────────────

export function SharePoster({ record, sixerScore, tier, mode, dailyNumber, xi, bonusesTriggered, penaltiesTriggered }: SharePosterProps) {
  const is160      = record === '16-0'
  const isDaily    = mode === 'daily'
  const tierColor  = TIER_LETTER_COLOR[tier] ?? C.cream
  const modeLabel  = isDaily
    ? `DAILY${dailyNumber != null ? ` #${dailyNumber}` : ''}`
    : mode === 'criciq' ? 'CRIC IQ' : 'CLASSIC'

  // ── Typography helpers ──────────────────────────────────────────────────────
  const display = (size: number, color: string, extra?: React.CSSProperties): React.CSSProperties => ({
    fontFamily: "'Anton', sans-serif",
    fontSize: size,
    color,
    margin: 0,
    lineHeight: 1,
    ...extra,
  })

  const body = (size: number, color: string, extra?: React.CSSProperties): React.CSSProperties => ({
    fontFamily: "'Inter', sans-serif",
    fontSize: size,
    color,
    margin: 0,
    ...extra,
  })

  const label = (color: string): React.CSSProperties => body(16, color, {
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  })

  // ── Card style ──────────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    flex: 1,
    backgroundColor: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    padding: 24,
    boxSizing: 'border-box' as const,
  }

  return (
    <div
      id="sixer-poster-capture"
      style={{
        width: 1080,
        height: 1350,
        backgroundColor: C.bg,
        boxSizing: 'border-box',
        padding: 60,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        // Reset inherited browser defaults that could bleed in
        fontFamily: "'Inter', sans-serif",
        letterSpacing: 'normal',
      }}
    >
      {/* 1. Headline block */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        {isDaily && (
          <p style={body(18, C.saffron, {
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            marginBottom: 10,
          })}>SIXER DAILY{dailyNumber != null ? ` #${dailyNumber}` : ''}</p>
        )}
        <p style={body(34, C.cream, {
          fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginBottom: 4,
        })}>I BUILT A</p>

        <p style={display(118, C.saffron, {
          letterSpacing: '-0.02em',
          textShadow: '0 0 40px rgba(255,107,26,0.4)',
          textTransform: 'uppercase',
        })}>{record} TEAM</p>

        {is160 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 14 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} style={{ color: C.saffron, fontSize: 22, lineHeight: 1 }}>▲</span>
            ))}
          </div>
        )}
      </div>

      {/* 2. Stats row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 26 }}>
        {/* Sixer Score */}
        <div style={cardStyle}>
          <p style={label(C.cream)}>SIXER SCORE</p>
          <p style={display(54, C.saffron, { fontFeatureSettings: '"tnum"' })}>
            {sixerScore.toFixed(2)}
          </p>
        </div>

        {/* Tier */}
        <div style={cardStyle}>
          <p style={label(C.cream)}>TIER</p>
          <p style={display(68, tierColor)}>{tier}</p>
        </div>

        {/* Mode */}
        <div style={cardStyle}>
          <p style={label(C.cream)}>MODE</p>
          <p style={display(34, C.cream)}>{modeLabel}</p>
        </div>
      </div>

      {/* 3. YOUR XI */}
      <div style={{ marginBottom: 18 }}>
        <p style={body(13, C.muted, {
          fontWeight: 700, letterSpacing: '0.15em',
          textTransform: 'uppercase', marginBottom: 8,
        })}>YOUR XI</p>

        {xi.map((player, i) => {
          const chip = roleChipColors(player.role_primary)
          const code = getHistoricalShortCode(player.franchise_short, player.season_year)
          const name = player.display_name || player.player_name

          return (
            <div
              key={player.id}
              style={{
                display: 'flex', alignItems: 'center', height: 50, gap: 12,
                borderBottom: '1px solid rgba(245,245,240,0.06)',
              }}
            >
              {/* # */}
              <span style={body(25, 'rgba(245,245,240,0.38)', {
                width: 44, textAlign: 'right', flexShrink: 0,
                fontFeatureSettings: '"tnum"',
              })}>{i + 1}</span>

              {/* Name */}
              <span style={body(25, C.cream, {
                flex: 1, overflow: 'hidden', whiteSpace: 'nowrap',
                textOverflow: 'ellipsis', fontWeight: 700,
              })}>{name}</span>

              {/* Role chip */}
              <span style={{
                fontFamily: "'Inter', sans-serif",
                backgroundColor: chip.bg, color: chip.color,
                fontSize: 13, fontWeight: 700,
                padding: '4px 12px', borderRadius: 20, flexShrink: 0,
                textTransform: 'uppercase', letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
              }}>{formatRolePoster(player.role_primary)}</span>

              {/* Franchise · Year */}
              <span style={body(21, 'rgba(245,245,240,0.58)', {
                flexShrink: 0, whiteSpace: 'nowrap',
                fontFeatureSettings: '"tnum"',
              })}>{code}·{player.season_year}</span>

              {/* Overseas ✈ */}
              <span style={{
                fontSize: 18, width: 28, flexShrink: 0, textAlign: 'center',
                color: player.is_overseas ? 'rgba(245,245,240,0.55)' : 'transparent',
              }}>✈</span>

              {/* Player score */}
              <span style={body(25, C.saffron, {
                width: 78, textAlign: 'right', flexShrink: 0,
                fontWeight: 700, fontFeatureSettings: '"tnum"',
              })}>{fmtScore(player.player_score)}</span>
            </div>
          )
        })}
      </div>

      {/* ── Lower region: bonuses + penalties + footer ────────────────────── */}
      {/* flex: 1 fills all remaining space; footer uses marginTop: auto     */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>

        {/* 4. Bonuses (only if triggered) */}
        {bonusesTriggered.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <p style={label(C.pitch)}>BONUSES</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {bonusesTriggered.map(name => (
                <span key={name} style={{
                  fontFamily: "'Inter', sans-serif",
                  backgroundColor: 'rgba(0,200,150,0.15)',
                  border: `1px solid ${C.pitch}`,
                  color: C.pitch, fontSize: 19, fontWeight: 500,
                  padding: '5px 14px', borderRadius: 24,
                  whiteSpace: 'nowrap',
                }}>{name}</span>
              ))}
            </div>
          </div>
        )}

        {/* 5. Penalties (only if triggered) */}
        {penaltiesTriggered.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <p style={label(C.red)}>PENALTIES</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {penaltiesTriggered.map(name => (
                <span key={name} style={{
                  fontFamily: "'Inter', sans-serif",
                  backgroundColor: 'rgba(244,50,86,0.15)',
                  border: `1px solid ${C.red}`,
                  color: C.red, fontSize: 19, fontWeight: 500,
                  padding: '5px 14px', borderRadius: 24,
                  whiteSpace: 'nowrap',
                }}>{name}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer (marginTop: auto pushes it to the bottom of the lower region) ── */}
        <div style={{
          marginTop: 'auto',
          flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          paddingTop: 14,
        }}>
          <div style={{ width: '60%', height: 1, backgroundColor: C.saffron, opacity: 0.45 }} />
          <p style={display(52, C.saffron, { letterSpacing: '0.08em', marginTop: 6 })}>SIXER</p>
          <p style={body(16, 'rgba(245,245,240,0.58)', {
            letterSpacing: '0.1em', fontWeight: 500,
            textTransform: 'uppercase',
          })}>PICK THE XI. CHASE 16-0. SIXER.</p>
          <p style={body(14, 'rgba(245,245,240,0.38)')}>playsixer.vercel.app</p>
        </div>

      </div>

    </div>
  )
}
