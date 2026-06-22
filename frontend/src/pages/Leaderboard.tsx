import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Star } from 'lucide-react'
import Layout from '@/components/layout/Layout'
import { useAuth } from '@/hooks/useAuth'
import supabase from '@/lib/supabase'
import { signInWithGoogle } from '@/lib/auth'
import { XIGrid, formatScore, type XiEntry } from '@/components/leaderboard/XIGrid'

// ── Types ──────────────────────────────────────────────────────────────────────

interface LeaderboardRow {
  id: string
  display_name: string
  user_id: string | null
  sixer_score: number
  wins: number
  losses: number
  tier: string
  xi: XiEntry[]
  created_at: string
}

type TimeScope = 'today' | 'daily' | 'all_time'
type LbMode = 'classic' | 'criciq'

interface DailyMeta { seed_date: string; daily_number: number }

function getTodayIST(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const TIER_BADGE: Record<string, string> = {
  S: 'bg-saffron text-navy',
  A: 'bg-saffron/30 text-saffron',
  B: 'bg-pitch/30 text-pitch',
  C: 'bg-amber-500/30 text-amber-400',
  D: 'bg-muted/20 text-muted',
  E: 'bg-muted/20 text-muted',
  F: 'bg-red-500/30 text-red-400',
}

function tierBadgeCls(tier: string): string {
  return TIER_BADGE[tier] ?? 'bg-muted/20 text-muted'
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3 px-4 border-b border-subtle animate-pulse">
          <div className="w-6 h-3 bg-surface rounded shrink-0" />
          <div className="flex-1 h-3 bg-surface rounded" />
          <div className="w-14 h-3 bg-surface rounded shrink-0 hidden sm:block" />
          <div className="w-14 h-3 bg-surface rounded shrink-0" />
          <div className="w-8 h-5 bg-surface rounded shrink-0 hidden md:block" />
          <div className="w-3.5 h-3 bg-surface rounded shrink-0" />
        </div>
      ))}
    </>
  )
}

interface RowItemProps {
  row: LeaderboardRow
  rank: number | string
  isHighlighted: boolean
  isAnchor: boolean
  isExpanded: boolean
  onToggle: () => void
}

function RowItem({ row, rank, isHighlighted, isAnchor, isExpanded, onToggle }: RowItemProps) {
  const special = isHighlighted || isAnchor

  return (
    <div
      id={`row-${row.id}`}
      className={[
        'cursor-pointer select-none border-b border-l-[3px] transition-colors duration-150',
        special
          ? 'border-b-subtle border-l-saffron bg-saffron/10'
          : 'border-b-subtle border-l-transparent hover:bg-surface/40',
      ].join(' ')}
      onClick={onToggle}
    >
      <div className="flex items-center gap-3 py-3 px-4">
        <span className="font-mono text-xs text-muted w-6 shrink-0 text-right tabular-nums">
          {rank}
        </span>

        <span className="font-body text-sm text-cream flex-1 min-w-0 flex items-center gap-1.5">
          <span className="truncate">{row.display_name}</span>
          {row.user_id && <Star size={9} className="text-muted fill-muted shrink-0" />}
          {special && (
            <span className="font-mono text-[9px] text-saffron bg-saffron/20 px-1.5 py-0.5 rounded shrink-0">
              YOU
            </span>
          )}
        </span>

        <span className="font-mono text-xs text-cream shrink-0 tabular-nums hidden sm:inline w-14">
          {row.wins}–{row.losses}
        </span>

        <span className="font-mono text-sm text-cream shrink-0 tabular-nums w-14 text-right">
          {formatScore(row.sixer_score)}
        </span>

        <span className={`font-display text-xs px-1.5 py-0.5 rounded shrink-0 hidden md:inline w-8 text-center ${tierBadgeCls(row.tier)}`}>
          {row.tier}
        </span>

        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-muted"
        >
          <ChevronDown size={14} />
        </motion.span>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <XIGrid xi={row.xi} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TabBtn({
  active, onClick, children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'font-body text-xs uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors duration-150',
        active
          ? 'bg-saffron/10 border-saffron text-saffron'
          : 'border-subtle text-muted hover:border-muted hover:text-cream',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Leaderboard() {
  const [searchParams] = useSearchParams()
  const highlightRunId = searchParams.get('highlight')
  const urlMode        = searchParams.get('mode')
  const urlTab         = searchParams.get('tab')

  const [timeScope, setTimeScope]         = useState<TimeScope>(urlTab === 'daily' ? 'daily' : 'today')
  const [mode, setMode]                   = useState<LbMode>(urlMode === 'criciq' ? 'criciq' : 'classic')
  const [dailyMeta, setDailyMeta]         = useState<DailyMeta | null>(null)
  const [rows, setRows]                   = useState<LeaderboardRow[]>([])
  const [loading, setLoading]             = useState(true)
  const [fetchError, setFetchError]       = useState(false)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [anchorRow, setAnchorRow]         = useState<LeaderboardRow | null>(null)
  const [userRankNum, setUserRankNum]     = useState<number | null>(null)
  const [noUserRun, setNoUserRun]         = useState(false)

  const { user } = useAuth()
  const didScrollRef = useRef(false)

  // ── Load rows ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setRows([])
    setFetchError(false)
    setAnchorRow(null)
    didScrollRef.current = false

    async function load() {
      let data: LeaderboardRow[] | null = null
      let hasError = false

      if (timeScope === 'today') {
        const res = await supabase.rpc('leaderboard_today', { p_mode: mode })
        if (res.error) hasError = true
        else data = res.data as LeaderboardRow[]
      } else if (timeScope === 'daily') {
        // Fetch seed meta first for the header
        const { data: seedData } = await supabase.functions.invoke<DailyMeta>(
          'get_daily_seed', { method: 'GET' }
        )
        if (seedData) setDailyMeta(seedData)

        const todayIST = seedData?.seed_date ?? getTodayIST()
        const res = await supabase
          .from('sixer_runs')
          .select('id, display_name, user_id, sixer_score, wins, losses, tier, xi, created_at')
          .eq('is_daily', true)
          .eq('daily_seed_date', todayIST)
          .order('sixer_score', { ascending: false })
          .limit(100)
        if (res.error) hasError = true
        else data = res.data as LeaderboardRow[]
      } else {
        const res = await supabase
          .from('sixer_runs')
          .select('id, display_name, user_id, sixer_score, wins, losses, tier, xi, created_at')
          .eq('mode', mode)
          .eq('is_personal_best', true)
          .order('sixer_score', { ascending: false })
          .limit(100)
        if (res.error) hasError = true
        else data = res.data as LeaderboardRow[]
      }

      if (cancelled) return
      if (hasError) { setFetchError(true); setLoading(false); return }
      setRows(data ?? [])
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [timeScope, mode])

  // ── Anchor row: user's own run for current scope/mode, if not in top 100 ─────
  useEffect(() => {
    setAnchorRow(null)
    setNoUserRun(false)
    if (!user || loading) return

    const todayIST = getTodayIST()
    const base = supabase
      .from('sixer_runs')
      .select('id, display_name, user_id, sixer_score, wins, losses, tier, xi, created_at')
      .eq('user_id', user.id)

    let q
    if (timeScope === 'daily') {
      q = base.eq('is_daily', true).eq('daily_seed_date', todayIST)
    } else if (timeScope === 'today') {
      const parts = todayIST.split('-')
      const midnightUtc = new Date(
        Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) - 5.5 * 60 * 60 * 1000
      ).toISOString()
      q = base.eq('mode', mode).gte('created_at', midnightUtc)
    } else {
      q = base.eq('mode', mode).eq('is_personal_best', true)
    }

    q.order('sixer_score', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const run = data as LeaderboardRow | null
        if (!run) { setNoUserRun(true); return }
        // In top 100 already — highlight there, no anchor needed
        setAnchorRow(rows.some(r => r.id === run.id) ? null : run)
      })
  }, [user, timeScope, mode, rows, loading])

  // ── User rank for anchor row (shown when user is outside top 100) ─────────────
  useEffect(() => {
    setUserRankNum(null)
    if (!anchorRow) return

    if (timeScope === 'daily') {
      const todayIST = getTodayIST()
      supabase
        .from('sixer_runs')
        .select('id', { count: 'exact', head: true })
        .eq('is_daily', true)
        .eq('daily_seed_date', todayIST)
        .gt('sixer_score', anchorRow.sixer_score)
        .then(({ count }) => setUserRankNum(typeof count === 'number' ? count + 1 : null))
    } else {
      supabase
        .rpc('user_rank', { p_mode: mode, p_scope: timeScope, p_run_id: anchorRow.id })
        .then(({ data }) => setUserRankNum(typeof data === 'number' ? data : null))
    }
  }, [anchorRow, timeScope, mode])

  // ── Scroll highlighted row into view (once per data load) ────────────────────
  useEffect(() => {
    if (!highlightRunId || loading || didScrollRef.current) return
    const el = document.getElementById(`row-${highlightRunId}`)
    if (!el) return
    didScrollRef.current = true
    requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }, [highlightRunId, rows, loading])

  function toggleRow(id: string) {
    setExpandedRowId(prev => (prev === id ? null : id))
  }

  const showAnchor = !loading && !fetchError && !!anchorRow

  return (
    <Layout>
      <div className="max-w-[840px] mx-auto px-4 py-12">

        {/* Page header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-pitch inline-block shrink-0" />
          <span className="font-body text-xs text-pitch uppercase tracking-widest">LEADERBOARD</span>
        </div>
        <h1 className="font-display text-5xl text-cream mb-2">LEADERBOARDS</h1>
        <p className="font-body text-base text-muted mb-8">
          The highest-scoring XIs. One entry per drafter.
        </p>

        {/* Scope + mode tabs */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div className="flex gap-2">
            <TabBtn active={timeScope === 'today'}    onClick={() => setTimeScope('today')}>Today</TabBtn>
            <TabBtn active={timeScope === 'daily'}    onClick={() => setTimeScope('daily')}>Daily</TabBtn>
            <TabBtn active={timeScope === 'all_time'} onClick={() => setTimeScope('all_time')}>All Time</TabBtn>
          </div>
          {timeScope !== 'daily' && (
            <div className="flex gap-2">
              <TabBtn active={mode === 'classic'} onClick={() => setMode('classic')}>Classic</TabBtn>
              <TabBtn active={mode === 'criciq'}  onClick={() => setMode('criciq')}>Cric IQ</TabBtn>
            </div>
          )}
        </div>

        {/* Daily header */}
        {timeScope === 'daily' && dailyMeta && (
          <div className="mb-4">
            <p className="font-display text-xl text-cream">
              DAILY #{dailyMeta.daily_number}
            </p>
            <p className="font-body text-xs text-muted mt-0.5">
              {new Date(dailyMeta.seed_date + 'T00:00:00').toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric',
              })} · Resets at midnight IST
            </p>
          </div>
        )}

        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 pb-2 border-b border-subtle">
          <span className="font-mono text-[10px] text-muted uppercase tracking-widest w-6 shrink-0 text-right">#</span>
          <span className="font-mono text-[10px] text-muted uppercase tracking-widest flex-1">NAME</span>
          <span className="font-mono text-[10px] text-muted uppercase tracking-widest shrink-0 hidden sm:inline w-14">RECORD</span>
          <span className="font-mono text-[10px] text-muted uppercase tracking-widest shrink-0 w-14 text-right">SCORE</span>
          <span className="font-mono text-[10px] text-muted uppercase tracking-widest shrink-0 hidden md:inline w-8 text-center">TIER</span>
          <span className="w-3.5 shrink-0" />
        </div>

        {/* Table body */}
        <div>
          {loading && <SkeletonRows />}

          {!loading && fetchError && (
            <div className="py-16 text-center">
              <p className="font-body text-sm text-muted">
                Couldn't load the leaderboard. Try refreshing.
              </p>
            </div>
          )}

          {!loading && !fetchError && rows.length === 0 && (
            <div className="py-16 text-center flex flex-col items-center gap-4">
              <p className="font-body text-sm text-muted">
                {timeScope === 'today'
                  ? 'No runs submitted today yet.'
                  : timeScope === 'daily'
                  ? "No one has played today's daily yet."
                  : 'No runs yet. The leaderboard is waiting.'}
              </p>
              {timeScope === 'daily' ? (
                user ? (
                  <Link to="/daily" className="font-body text-sm text-saffron hover:underline">
                    Play today's daily →
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => { void signInWithGoogle() }}
                    className="font-body text-sm text-saffron hover:underline"
                  >
                    Sign in to play daily →
                  </button>
                )
              ) : (
                <Link
                  to={`/draft?mode=${mode}`}
                  className="font-body text-sm text-saffron hover:underline"
                >
                  Draft your XI →
                </Link>
              )}
            </div>
          )}

          {!loading && !fetchError && rows.map((row, idx) => {
            const isHighlighted =
              (!!highlightRunId && row.id === highlightRunId) ||
              (!highlightRunId && !!user && row.user_id === user.id)
            return (
              <RowItem
                key={row.id}
                row={row}
                rank={idx + 1}
                isHighlighted={isHighlighted}
                isAnchor={false}
                isExpanded={expandedRowId === row.id}
                onToggle={() => toggleRow(row.id)}
              />
            )
          })}

          {/* Anchor row for drafters outside top 100 */}
          {showAnchor && anchorRow && (
            <>
              <div className="flex items-center gap-2 py-2 px-4">
                <div className="flex-1 border-t border-dashed border-subtle" />
                <span className="font-mono text-[10px] text-muted/50 shrink-0 px-2">
                  {userRankNum != null ? `YOUR RANK: #${userRankNum}` : '···'}
                </span>
                <div className="flex-1 border-t border-dashed border-subtle" />
              </div>
              <RowItem
                row={anchorRow}
                rank={userRankNum ?? '?'}
                isHighlighted={false}
                isAnchor={true}
                isExpanded={expandedRowId === anchorRow.id}
                onToggle={() => toggleRow(anchorRow.id)}
              />
            </>
          )}
        </div>

        {/* CTA when signed-in user has no run for current scope/mode */}
        {!loading && !fetchError && user && noUserRun && rows.length > 0 && (
          <div className="py-6 text-center flex flex-col items-center gap-2 border-t border-dashed border-subtle mt-2">
            <p className="font-body text-xs text-muted">
              {timeScope === 'daily'
                ? "You haven't played today's daily yet."
                : `You haven't played ${mode === 'criciq' ? 'Cric IQ' : 'Classic'} ${timeScope === 'today' ? 'today' : 'yet'}.`}
            </p>
            <Link
              to={timeScope === 'daily' ? '/daily' : `/draft?mode=${mode}`}
              className="font-body text-sm text-saffron hover:underline"
            >
              {timeScope === 'daily' ? "Play today's daily →" : 'Play now →'}
            </Link>
          </div>
        )}

        {/* Footer note */}
        {!loading && !fetchError && rows.length > 0 && (
          <p className="font-body text-xs text-muted/50 text-center mt-6">
            {timeScope === 'today'  ? 'Resets at midnight IST · ' : ''}
            {timeScope === 'daily'  ? 'One run per player per day · ' : ''}
            {timeScope !== 'daily'  ? 'One entry per drafter · Best run only' : 'Same XI for everyone'}
          </p>
        )}

      </div>
    </Layout>
  )
}
