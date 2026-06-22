import { useRef, useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { Share2 } from 'lucide-react'
import Layout from '@/components/layout/Layout'
import { calculateScore } from '@/lib/scoring'
import { sortXI } from '@/lib/sortXI'
import { formatRoleShort } from '@/lib/roles'
import { useAuth } from '@/hooks/useAuth'
import supabase from '@/lib/supabase'
import GuestNameModal from '@/components/GuestNameModal'
import { SharePosterModal } from '@/components/SharePosterModal'
import { generateDailyShareText } from '@/lib/dailyShare'
import type { DraftableCard, DraftMode } from '@/types/draft'

interface LocationState {
  picks: DraftableCard[]
  mode: DraftMode
  // present when mode === 'daily'
  dailySeedDate?: string
  dailyNumber?: number
}

interface RunResult {
  run_id: string
  sixer_score: number
  wins: number
  losses: number
  tier: string
  is_personal_best: boolean
  previous_best: number | null
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error' | 'already_submitted'

function submissionKey(picks: DraftableCard[]): string {
  return 'sxr_' + picks.map(p => `${p.player_name}|${p.season_year}`).sort().join(',')
}

// Strips ugly floating-point tails: 95.41000000001 → "95.4"
function formatScore(score: number): string {
  const rounded = Math.round(score * 100) / 100
  return rounded.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

const TIER_COLOR: Record<string, string> = {
  S: 'text-saffron',
  A: 'text-pitch',
  B: 'text-pitch',
  C: 'text-cream',
  D: 'text-muted',
  E: 'text-muted',
  F: 'text-muted',
}

const TIER_RECORD_COLOR: Record<string, string> = {
  S: 'text-saffron',
  A: 'text-pitch',
  B: 'text-pitch',
  C: 'text-cream',
  D: 'text-cream',
  E: 'text-muted',
  F: 'text-muted',
}

interface ScoreLineProps {
  label: string
  value: string
  valueClass?: string
}
function ScoreLine({ label, value, valueClass = 'text-cream' }: ScoreLineProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-xs text-muted tracking-wide">{label}</span>
      <span className={`font-mono text-sm ${valueClass}`}>{value}</span>
    </div>
  )
}

export default function Results() {
  const location = useLocation()
  const state    = location.state as LocationState | null

  const { user, loading: authLoading } = useAuth()

  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle')
  const [userName, setUserName]         = useState<string | null>(null)
  const [showGuestModal, setShowGuestModal] = useState(false)
  const [runResult, setRunResult]       = useState<RunResult | null>(null)
  const [submitError, setSubmitError]   = useState<string | null>(null)
  const hasSubmitted = useRef(false)

  const [posterOpen, setPosterOpen]       = useState(false)
  const [hasAutoOpened, setHasAutoOpened] = useState(false)
  const [countdown,    setCountdown]      = useState('')
  const [gridCopied,   setGridCopied]     = useState(false)

  // ── Resolve display name for submission ─────────────────────────────────────
  useEffect(() => {
    if (authLoading || !state?.picks) return

    if (user) {
      supabase
        .from('user_profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.display_name) {
            setUserName(data.display_name)
          } else {
            // Signed in but no profile yet — fall back to guest flow
            const cached = localStorage.getItem('sixer_guest_name')
            if (cached) setUserName(cached)
            else setShowGuestModal(true)
          }
        })
    } else {
      const cached = localStorage.getItem('sixer_guest_name')
      if (cached) setUserName(cached)
      else setShowGuestModal(true)
    }
  }, [authLoading, user, state?.picks])

  // ── Auto-submit when name is resolved ────────────────────────────────────────
  useEffect(() => {
    if (!userName || hasSubmitted.current || !state?.picks) return
    hasSubmitted.current = true
    doSubmit(userName)
  }, [userName, state?.picks])

  // ── Daily countdown to midnight IST ─────────────────────────────────────────
  useEffect(() => {
    if (state?.mode !== 'daily') return
    function tick() {
      const now     = Date.now()
      const istNow  = new Date(now + 5.5 * 60 * 60 * 1000)
      const istMid  = new Date(
        istNow.getFullYear(), istNow.getMonth(), istNow.getDate() + 1,
        0, 0, 0, 0,
      )
      const msLeft  = istMid.getTime() - istNow.getTime()
      const h = Math.floor(msLeft / 3_600_000)
      const m = Math.floor((msLeft % 3_600_000) / 60_000)
      const s = Math.floor((msLeft % 60_000) / 1_000)
      setCountdown(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [state?.mode])

  // ── Auto-open poster once per session, 400ms after picks are available ───────
  const picksReady = !!state?.picks
  useEffect(() => {
    if (hasAutoOpened || !picksReady) return
    const t = setTimeout(() => {
      setPosterOpen(true)
      setHasAutoOpened(true)
    }, 400)
    return () => clearTimeout(t)
  }, [hasAutoOpened, picksReady])

  async function doSubmit(name: string) {
    if (!state?.picks) return

    // Client-side dedupe: return cached result if this XI was already submitted this session
    const key = submissionKey(state.picks)
    const cached = sessionStorage.getItem(key)
    if (cached) {
      setRunResult(JSON.parse(cached) as RunResult)
      setSubmitStatus('success')
      return
    }

    setSubmitStatus('submitting')
    const isDaily = state.mode === 'daily'
    const { data, error } = await supabase.functions.invoke('submit_run', {
      body: {
        xi:               state.picks,
        mode:             state.mode,
        display_name:     name,
        ...(isDaily && {
          is_daily:        true,
          daily_seed_date: state.dailySeedDate,
        }),
      },
    })

    // 409 = server-side dedupe (client cache was cleared but run already exists)
    if (error && (error as { context?: { status?: number } }).context?.status === 409) {
      setSubmitStatus('already_submitted')
      return
    }

    if (error || (data as { error?: string } | null)?.error) {
      setSubmitError((data as { error?: string } | null)?.error ?? error?.message ?? 'Unknown error')
      setSubmitStatus('error')
      return
    }

    sessionStorage.setItem(key, JSON.stringify(data))
    setRunResult(data as RunResult)
    setSubmitStatus('success')
  }

  function handleGuestName(name: string) {
    localStorage.setItem('sixer_guest_name', name)
    setShowGuestModal(false)
    setUserName(name)
  }

  function handleRetry() {
    if (!userName) return
    hasSubmitted.current = false
    setSubmitError(null)
    setSubmitStatus('idle')
    hasSubmitted.current = true
    doSubmit(userName)
  }

  // ── Guard ────────────────────────────────────────────────────────────────────
  if (!state?.picks || state.picks.length === 0) {
    return (
      <Layout>
        <div className="max-w-[720px] mx-auto px-4 py-16 text-center">
          <p className="font-display text-3xl text-muted mb-6">No draft found.</p>
          <Link to="/" className="font-body text-saffron hover:underline">
            Go home and start a draft →
          </Link>
        </div>
      </Layout>
    )
  }

  const { picks } = state
  const breakdown   = calculateScore(picks)
  const tierColor   = TIER_COLOR[breakdown.tier] ?? 'text-cream'
  const recordColor = TIER_RECORD_COLOR[breakdown.tier] ?? 'text-cream'
  const sortedPicks = sortXI(picks)
  const isDaily     = state.mode === 'daily'

  async function handleShareGrid() {
    const text = generateDailyShareText({
      dailyNumber: state?.dailyNumber ?? 1,
      record:      `${breakdown.wins}–${breakdown.losses}`,
      sixerScore:  breakdown.sixerScore,
      tier:        breakdown.tier,
      xi:          sortedPicks,
    })

    // Mobile: use native share sheet (WhatsApp, iMessage, etc.)
    // Desktop: copy to clipboard directly — navigator.share exists on desktop Chrome too
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    if (isMobile && navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(text)
      setGridCopied(true)
      setTimeout(() => setGridCopied(false), 2000)
    } catch {
      // clipboard unavailable (e.g. non-https) — nothing to do
    }
  }

  return (
    <Layout>
      {showGuestModal && <GuestNameModal onConfirm={handleGuestName} />}

      <div className="max-w-[720px] mx-auto px-4 py-12 md:py-20">
        <div className="flex flex-col gap-10">

          {/* ── HERO: record ── */}
          <section className="flex flex-col items-center gap-3 text-center">
            <p className="font-mono text-xs text-muted uppercase tracking-widest">Season Record</p>
            <p className={`font-display text-[88px] md:text-[120px] leading-none tabular-nums ${recordColor}`}>
              {breakdown.wins}–{breakdown.losses}
            </p>
            <p className="font-body text-sm text-muted">over 16 matches</p>

            <div className="flex items-center gap-3 mt-2">
              <span className="font-body text-sm text-muted">Sixer Score</span>
              <span className={`font-display text-2xl ${tierColor}`}>
                {formatScore(breakdown.sixerScore)}
              </span>
              <span className={`font-display text-2xl ${tierColor} opacity-50`}>·</span>
              <span className={`font-display text-2xl ${tierColor}`}>
                Tier {breakdown.tier}
              </span>
            </div>
          </section>

          {/* ── Score breakdown ── */}
          <section className="bg-surface rounded-xl border border-subtle p-6 flex flex-col gap-3">
            <p className="font-mono text-xs text-muted uppercase tracking-widest">Breakdown</p>
            <ScoreLine label="RAW SCORE"  value={formatScore(breakdown.rawScore)} />
            <ScoreLine label="BONUSES"    value={`+${breakdown.totalBonus}`}        valueClass="text-pitch" />
            <ScoreLine label="PENALTIES"  value={String(breakdown.totalPenalty)}    valueClass="text-saffron" />
            <div className="border-t border-subtle pt-3">
              <ScoreLine
                label="SIXER SCORE"
                value={formatScore(breakdown.sixerScore)}
                valueClass="text-cream font-bold"
              />
            </div>
          </section>

          {/* ── Active bonuses ── */}
          {breakdown.bonuses.some(b => b.triggered) && (
            <section>
              <p className="font-mono text-xs text-muted uppercase tracking-widest mb-3">Bonuses Earned</p>
              <div className="flex flex-col gap-2">
                {breakdown.bonuses.filter(b => b.triggered).map(b => (
                  <div
                    key={b.name}
                    className="flex items-center justify-between bg-pitch/5 border border-pitch/30 rounded-lg px-4 py-2"
                  >
                    <span className="font-body text-sm text-cream">{b.name}</span>
                    <span className="font-display text-lg text-pitch">+{b.points}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Active penalties ── */}
          {breakdown.penalties.some(p => p.triggered) && (
            <section>
              <p className="font-mono text-xs text-muted uppercase tracking-widest mb-3">Penalties Applied</p>
              <div className="flex flex-col gap-2">
                {breakdown.penalties.filter(p => p.triggered).map(p => (
                  <div
                    key={p.name}
                    className="flex items-center justify-between bg-saffron/5 border border-saffron/30 rounded-lg px-4 py-2"
                  >
                    <span className="font-body text-sm text-cream">{p.name}</span>
                    <span className="font-display text-lg text-saffron">{p.points}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Your XI ── */}
          <section>
            <p className="font-mono text-xs text-muted uppercase tracking-widest mb-3">Your XI</p>
            <div className="flex flex-col gap-1.5">
              {sortedPicks.map((card, i) => (
                <div
                  key={card.id}
                  className="flex items-center gap-3 bg-surface rounded-lg px-4 py-2.5"
                >
                  <span className="font-mono text-xs text-muted w-5 text-right shrink-0">{i + 1}</span>
                  <span className="font-body text-sm text-cream flex-1 min-w-0 truncate">
                    {card.display_name || card.player_name}
                  </span>
                  <span className="font-mono text-[10px] text-muted bg-subtle px-1.5 py-0.5 rounded shrink-0 hidden sm:inline">
                    {formatRoleShort(card.role_primary)}
                  </span>
                  <span className="font-mono text-[10px] text-muted/60 shrink-0 tabular-nums hidden sm:inline">
                    {card.franchise_short} · {card.season_year}
                  </span>
                  <span className="font-mono text-xs text-cream shrink-0 tabular-nums w-12 text-right">
                    {formatScore(card.player_score)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ── CTAs ── */}
          <section className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
            <button
              type="button"
              onClick={() => setPosterOpen(true)}
              className={[
                'inline-flex items-center justify-center px-8 py-3 rounded-lg',
                'border border-cream/40 text-cream font-display text-xl',
                'hover:border-cream hover:bg-cream/5 transition-all duration-200',
              ].join(' ')}
            >
              VIEW POSTER
            </button>

            {isDaily && (
              <>
                <button
                  type="button"
                  onClick={() => void handleShareGrid()}
                  className={[
                    'inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg',
                    'border border-pitch/60 text-pitch font-display text-xl',
                    'hover:border-pitch hover:bg-pitch/5 transition-all duration-200',
                  ].join(' ')}
                >
                  <Share2 size={18} />
                  {gridCopied ? 'COPIED!' : 'SHARE GRID'}
                </button>
                <div className="text-xs md:text-sm text-cream/70 mt-4">
                  <div className="font-bold tracking-widest text-cream/80 mb-2">
                    SHARE GRID KEY
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>🟪 9.0+ · Elite</span>
                    <span>🟩 7.0–9.0 · Strong</span>
                    <span>🟨 5.0–7.0 · Solid</span>
                    <span>🟥 Below 5.0 · Weak</span>
                  </div>
                </div>
              </>
            )}

            {isDaily ? (
              <div className="inline-flex flex-col items-center justify-center px-8 py-3 rounded-lg border border-subtle text-muted font-body text-sm">
                <span className="font-display text-base text-muted">COME BACK TOMORROW</span>
                <span className="font-mono text-xs text-muted/60 tabular-nums mt-0.5">
                  Next daily in {countdown}
                </span>
              </div>
            ) : (
              <Link
                to={`/draft?mode=${state.mode}`}
                className={[
                  'inline-flex items-center justify-center px-8 py-3 rounded-lg',
                  'bg-saffron text-navy font-display text-xl',
                  'hover:shadow-[0_0_32px_rgba(255,107,26,0.3)] hover:scale-[1.02]',
                  'transition-all duration-200',
                ].join(' ')}
              >
                DRAFT AGAIN
              </Link>
            )}

            <Link
              to="/"
              className="inline-flex items-center justify-center px-8 py-3 rounded-lg border border-subtle text-muted font-body text-sm hover:border-muted hover:text-cream transition-colors"
            >
              Home
            </Link>
          </section>

          {/* ── Leaderboards submission status ── */}
          <section className="flex flex-col items-center gap-2 text-center min-h-[40px]">
            {submitStatus === 'submitting' && (
              <p className="font-body text-xs text-muted animate-pulse">
                Saving to Leaderboards…
              </p>
            )}

            {submitStatus === 'success' && runResult && (
              <>
                {runResult.is_personal_best ? (
                  <p className="font-body text-sm text-pitch">
                    {runResult.previous_best === null
                      ? 'Score saved to Leaderboards.'
                      : `New personal best! Previous: ${formatScore(runResult.previous_best)}`}
                  </p>
                ) : (
                  <p className="font-body text-sm text-muted">
                    Your best is still {formatScore(runResult.previous_best!)} — run saved.
                  </p>
                )}
                <Link
                  to={isDaily
                    ? `/leaderboard?tab=daily&highlight=${runResult.run_id}`
                    : `/leaderboard?highlight=${runResult.run_id}&mode=${state.mode}`}
                  className={[
                    'inline-flex items-center justify-center px-6 py-3 rounded-lg mt-1',
                    'border border-saffron text-cream font-body text-sm font-bold uppercase tracking-wider',
                    'hover:bg-saffron hover:text-navy transition-colors duration-150',
                  ].join(' ')}
                >
                  VIEW LEADERBOARDS →
                </Link>
              </>
            )}

            {submitStatus === 'already_submitted' && (
              <>
                <p className="font-body text-xs text-muted">
                  Already saved to Leaderboards.
                </p>
                <Link
                  to="/leaderboard"
                  className={[
                    'inline-flex items-center justify-center px-6 py-3 rounded-lg mt-1',
                    'border border-saffron text-cream font-body text-sm font-bold uppercase tracking-wider',
                    'hover:bg-saffron hover:text-navy transition-colors duration-150',
                  ].join(' ')}
                >
                  VIEW LEADERBOARDS →
                </Link>
              </>
            )}

            {submitStatus === 'error' && (
              <>
                <p className="font-body text-xs text-muted">
                  Couldn't save — {submitError}
                </p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="font-body text-xs text-saffron hover:underline"
                >
                  RETRY
                </button>
              </>
            )}
          </section>

        </div>
      </div>
      <SharePosterModal
        isOpen={posterOpen}
        onClose={() => setPosterOpen(false)}
        record={`${breakdown.wins}–${breakdown.losses}`}
        sixerScore={breakdown.sixerScore}
        tier={breakdown.tier}
        mode={state.mode}
        dailyNumber={state.dailyNumber}
        xi={sortedPicks}
        bonusesTriggered={breakdown.bonuses.filter(b => b.triggered).map(b => b.name)}
        penaltiesTriggered={breakdown.penalties.filter(p => p.triggered).map(p => p.name)}
      />
    </Layout>
  )
}
