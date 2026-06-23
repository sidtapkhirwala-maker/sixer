import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Plane } from 'lucide-react'
import Layout from '@/components/layout/Layout'
import supabase from '@/lib/supabase'
import { sortXIByRole } from '@/lib/sortXI'
import { formatRoleShort } from '@/lib/roles'
import { roleChipCls } from '@/components/leaderboard/XIGrid'
import { getHistoricalShortCode } from '@/lib/franchiseHistory'

// Daily #1 = 2026-06-22 launch date
const DAILY_LAUNCH = '2026-06-22'

function getDailyNumber(seedDate: string): number {
  const launch = new Date(DAILY_LAUNCH).getTime()
  const date   = new Date(seedDate).getTime()
  return Math.floor((date - launch) / 86_400_000) + 1
}

function fmtScore(score: number): string {
  const r = Math.round(score * 100) / 100
  return r.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface XiEntry {
  player_name:          string
  display_name:         string | null
  role_primary:         string
  is_overseas:          boolean
  player_score:         number
  avg_batting_position: number | null
  season_year?:         number
  franchise_short?:     string | null
}

interface SixerRun {
  id:               string
  display_name:     string
  mode:             string
  sixer_score:      number
  wins:             number
  losses:           number
  tier:             string
  xi:               XiEntry[]
  is_daily:         boolean
  daily_seed_date:  string | null
}

const TIER_COLOR: Record<string, string> = {
  S: 'text-saffron',
  A: 'text-pitch',  B: 'text-pitch',
  C: 'text-cream',  D: 'text-cream',
  E: 'text-muted',  F: 'text-muted',
}

export default function RunView() {
  const { run_id } = useParams<{ run_id: string }>()
  const [run,      setRun]      = useState<SixerRun | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!run_id || !UUID_REGEX.test(run_id)) {
      setNotFound(true)
      setLoading(false)
      return
    }

    supabase
      .from('sixer_runs')
      .select('id, display_name, mode, sixer_score, wins, losses, tier, xi, is_daily, daily_seed_date')
      .eq('id', run_id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true)
        else setRun(data as SixerRun)
        setLoading(false)
      })
  }, [run_id])

  // SEO meta tags — set on mount, restore title on unmount
  useEffect(() => {
    if (!run) return

    const pageTitle = `${run.display_name}'s Sixer XI — ${run.wins}-${run.losses}`
    document.title = pageTitle

    function setMeta(key: string, content: string, attr: 'property' | 'name' = 'property') {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key)
        document.head.appendChild(el)
      }
      el.content = content
    }

    setMeta('og:title',       `${run.display_name}'s Sixer XI`)
    setMeta('og:description',
      `I built a ${run.wins}-${run.losses} team on Sixer. Sixer Score ${fmtScore(run.sixer_score)} · Tier ${run.tier}. Pick the XI. Chase 16-0.`)
    setMeta('og:image',  'https://playsixer.vercel.app/og-default.png')
    setMeta('og:url',    `https://playsixer.vercel.app/run/${run_id}`)
    setMeta('twitter:card', 'summary_large_image', 'name')

    return () => { document.title = 'Sixer' }
  }, [run, run_id])

  if (loading) {
    return (
      <Layout>
        <div className="max-w-[720px] mx-auto px-4 py-16 flex flex-col gap-4 animate-pulse">
          <div className="h-8 bg-subtle rounded w-64 mx-auto" />
          <div className="h-6 bg-subtle rounded w-32 mx-auto" />
          <div className="h-40 bg-subtle rounded" />
          <div className="h-64 bg-subtle rounded" />
        </div>
      </Layout>
    )
  }

  if (notFound || !run) {
    return (
      <Layout>
        <div className="max-w-[720px] mx-auto px-4 py-16 text-center">
          <p className="font-display text-3xl text-muted mb-6">Run not found.</p>
          <Link to="/" className="font-body text-saffron hover:underline">← Back to home</Link>
        </div>
      </Layout>
    )
  }

  const isDaily  = run.is_daily
  const dailyNum = isDaily && run.daily_seed_date ? getDailyNumber(run.daily_seed_date) : null
  const modeLabel = isDaily
    ? `Sixer Daily${dailyNum != null ? ` #${dailyNum}` : ''}`
    : run.mode === 'criciq' ? 'Sixer · CricIQ' : 'Sixer · Classic'

  const tierColor = TIER_COLOR[run.tier] ?? 'text-cream'
  const sortedXi  = sortXIByRole(run.xi)

  return (
    <Layout>
      <div className="max-w-[720px] mx-auto px-4 py-12 md:py-20">
        <div className="flex flex-col gap-10">

          {/* 1. Header */}
          <section className="flex flex-col items-center gap-2 text-center">
            <p className="font-display text-2xl md:text-3xl text-cream uppercase tracking-wide">
              {run.display_name}&apos;s Sixer XI
            </p>
            <span className="font-mono text-xs text-muted bg-subtle px-3 py-1 rounded-full uppercase tracking-widest">
              {modeLabel}
            </span>
          </section>

          {/* 2. Record hero */}
          <section className="flex flex-col items-center gap-3 text-center">
            <p className="font-mono text-xs text-muted uppercase tracking-widest">Season Record</p>
            <p className={`font-display text-[80px] md:text-[110px] leading-none tabular-nums ${tierColor}`}>
              {run.wins}–{run.losses}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <span className="font-body text-sm text-muted">Sixer Score</span>
              <span className={`font-display text-2xl ${tierColor}`}>{fmtScore(run.sixer_score)}</span>
              <span className={`font-display text-2xl ${tierColor} opacity-50`}>&middot;</span>
              <span className={`font-display text-2xl ${tierColor}`}>Tier {run.tier}</span>
            </div>
          </section>

          {/* 3. XI list */}
          <section>
            <p className="font-mono text-xs text-muted uppercase tracking-widest mb-3">The XI</p>
            <div className="flex flex-col gap-1.5">
              {sortedXi.map((player, i) => {
                const name = player.display_name ?? player.player_name
                const franchiseLine = player.franchise_short && player.season_year
                  ? `${getHistoricalShortCode(player.franchise_short, player.season_year)} · ${player.season_year}`
                  : '—'
                return (
                  <div
                    key={player.player_name}
                    className="flex items-center gap-3 bg-surface rounded-lg px-4 py-2.5"
                  >
                    <span className="font-mono text-xs text-muted w-5 text-right shrink-0">{i + 1}</span>
                    {player.is_overseas
                      ? <Plane size={10} className="text-muted/60 shrink-0" />
                      : <span className="w-[10px] shrink-0" />
                    }
                    <span className="font-body text-sm text-cream flex-1 min-w-0 truncate">{name}</span>
                    <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded shrink-0 ${roleChipCls(player.role_primary)}`}>
                      {formatRoleShort(player.role_primary)}
                    </span>
                    <span className="font-mono text-[10px] text-muted/60 shrink-0 tabular-nums hidden sm:inline">
                      {franchiseLine}
                    </span>
                    <span className="font-mono text-xs text-cream shrink-0 tabular-nums w-12 text-right">
                      {fmtScore(player.player_score)}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

          {/* 5. CTA */}
          <section className="flex justify-center">
            <Link
              to="/"
              className={[
                'inline-flex items-center justify-center px-8 py-3 rounded-lg',
                'bg-saffron text-navy font-display text-xl',
                'hover:shadow-[0_0_32px_rgba(255,107,26,0.3)] hover:scale-[1.02]',
                'transition-all duration-200',
              ].join(' ')}
            >
              DRAFT YOUR OWN XI
            </Link>
          </section>

        </div>
      </div>
    </Layout>
  )
}
