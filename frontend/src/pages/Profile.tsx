import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil, Check, X, ChevronDown } from 'lucide-react'
import Layout from '@/components/layout/Layout'
import { useAuth } from '@/hooks/useAuth'
import supabase from '@/lib/supabase'
import { signInWithGoogle, signOut } from '@/lib/auth'
import { XIGrid, formatScore, type XiEntry } from '@/components/leaderboard/XIGrid'

// ── Types ──────────────────────────────────────────────────────────────────────

interface RunSummary {
  id: string
  mode: string
  sixer_score: number
  wins: number
  losses: number
  tier: string
  is_personal_best: boolean
  created_at: string
}

interface RecentRun extends RunSummary {
  xi: XiEntry[]
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TIER_ORDER = ['S', 'A', 'B', 'C', 'D', 'E', 'F']

const TIER_BADGE: Record<string, string> = {
  S: 'bg-saffron text-navy', A: 'bg-saffron/30 text-saffron',
  B: 'bg-pitch/30 text-pitch', C: 'bg-amber-500/30 text-amber-400',
  D: 'bg-muted/20 text-muted', E: 'bg-muted/20 text-muted',
  F: 'bg-red-500/30 text-red-400',
}

const TIER_BAR_COLORS: Record<string, string> = {
  S: 'bg-saffron', A: 'bg-saffron/60', B: 'bg-pitch/80',
  C: 'bg-amber-500/80', D: 'bg-muted/60', E: 'bg-muted/30', F: 'bg-red-500/60',
}

// Text colors for tier letters on a dark page background (not inside a chip).
// TIER_BADGE has 'text-navy' for S because that's for text ON a saffron chip;
// here we need the accent color itself so it reads against the navy page.
const TIER_LEGEND_COLORS: Record<string, string> = {
  S: 'text-saffron', A: 'text-saffron', B: 'text-pitch',
  C: 'text-amber-400', D: 'text-muted', E: 'text-muted', F: 'text-red-400',
}

const AVATAR_COLORS = [
  'bg-saffron text-navy', 'bg-pitch text-navy', 'bg-[#9D71E8] text-white',
  'bg-[#F4C430] text-navy', 'bg-amber-500 text-navy', 'bg-sky-500 text-white',
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function avatarColor(userId: string): string {
  const hash = [...userId].reduce((s, c) => s + c.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function relativeDate(isoStr: string): string {
  const diffH = (Date.now() - new Date(isoStr).getTime()) / (1000 * 60 * 60)
  if (diffH < 1) return 'just now'
  if (diffH < 24) return `${Math.floor(diffH)}h ago`
  if (diffH < 48) return 'yesterday'
  if (diffH < 168) return `${Math.floor(diffH / 24)}d ago`
  return new Date(isoStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function memberSince(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

// ── Guest teaser ───────────────────────────────────────────────────────────────

function GuestView() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm border border-saffron/30 rounded-xl bg-surface p-8 flex flex-col items-center gap-5 text-center">
        <div className="w-16 h-16 rounded-full bg-saffron/10 border border-saffron/30 flex items-center justify-center">
          <span className="font-display text-2xl text-saffron">?</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="font-display text-xl text-cream">Sign in to see your profile</p>
          <p className="font-body text-sm text-muted leading-relaxed">
            Your play history and lifetime stats, all in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => signInWithGoogle()}
          className={[
            'w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg',
            'bg-saffron text-navy font-body font-bold text-sm uppercase tracking-wider',
            'hover:bg-saffron/90 transition-colors',
          ].join(' ')}
        >
          Sign in with Google
        </button>
        <Link
          to="/leaderboard"
          className="font-body text-xs text-muted hover:text-saffron transition-colors"
        >
          View Leaderboards →
        </Link>
      </div>
    </div>
  )
}

// ── Page shell ─────────────────────────────────────────────────────────────────

export default function Profile() {
  const { user, loading: authLoading } = useAuth()

  if (authLoading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-saffron border-t-transparent animate-spin" />
        </div>
      </Layout>
    )
  }

  if (!user) {
    return <Layout><GuestView /></Layout>
  }

  return (
    <Layout>
      <SignedInProfile userId={user.id} userCreatedAt={user.created_at ?? ''} />
    </Layout>
  )
}

// ── Signed-in profile ─────────────────────────────────────────────────────────

function SignedInProfile({ userId, userCreatedAt }: { userId: string; userCreatedAt: string }) {
  const navigate = useNavigate()

  const [allRuns,    setAllRuns]    = useState<RunSummary[]>([])
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([])
  const [displayName,       setDisplayName]       = useState('')
  const [profileCreatedAt,  setProfileCreatedAt]  = useState('')
  const [dataLoading, setDataLoading] = useState(true)
  const [expandedId,  setExpandedId]  = useState<string | null>(null)

  // Account deletion state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting,        setDeleting]        = useState(false)
  const [deleteError,     setDeleteError]     = useState<string | null>(null)
  const [deleteSuccess,   setDeleteSuccess]   = useState(false)

  // Name-edit state
  const [editing,        setEditing]        = useState(false)
  const [editVal,        setEditVal]        = useState('')
  const [editError,      setEditError]      = useState<string | null>(null)
  const [editNextAllowed,setEditNextAllowed] = useState<string | null>(null)
  const [editSaving,     setEditSaving]     = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const [allRes, recentRes, profileRes] = await Promise.all([
        supabase
          .from('sixer_runs')
          .select('id, mode, sixer_score, wins, losses, tier, is_personal_best, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('sixer_runs')
          .select('id, mode, sixer_score, wins, losses, tier, xi, created_at, is_personal_best')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('user_profiles')
          .select('display_name, updated_at, created_at')
          .eq('user_id', userId)
          .single(),
      ])
      setAllRuns((allRes.data ?? []) as RunSummary[])
      setRecentRuns((recentRes.data ?? []) as RecentRun[])
      if (profileRes.data) {
        const p = profileRes.data as { display_name: string; updated_at: string; created_at: string }
        setDisplayName(p.display_name)
        setProfileCreatedAt(p.created_at)
      }
      setDataLoading(false)
    }
    load()
  }, [userId])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  async function handleRename() {
    if (!editVal.trim() || editSaving) return
    setEditSaving(true)
    setEditError(null)
    setEditNextAllowed(null)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    const { data, error } = await supabase.functions.invoke('update_display_name', {
      body: { new_name: editVal.trim() },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })

    if (error) {
      let body: { error?: string; next_allowed?: string } = {}
      try { body = JSON.parse(error.message) } catch { /* noop */ }
      const status = (error as unknown as { context?: { status?: number } }).context?.status
      if (status === 429 && body.next_allowed) {
        setEditNextAllowed(body.next_allowed)
        setEditError(`Rename available ${relativeDate(body.next_allowed)}.`)
      } else {
        setEditError(body.error ?? 'Something went wrong.')
      }
    } else if ((data as { ok?: boolean } | null)?.ok) {
      setDisplayName((data as { display_name: string }).display_name)
      setEditing(false)
      setEditVal('')
    } else {
      setEditError('Something went wrong.')
    }

    setEditSaving(false)
  }

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    setDeleteError(null)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) {
      setDeleteError('Not signed in.')
      setDeleting(false)
      return
    }

    const { data, error } = await supabase.functions.invoke('delete_account', {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (error || !(data as { success?: boolean } | null)?.success) {
      let body: { error?: string; step?: string } = {}
      try { body = JSON.parse(error?.message ?? '{}') } catch { /* noop */ }
      const step = body.step ? ` (step: ${body.step})` : ''
      setDeleteError((body.error ?? 'Deletion failed.') + step)
      setDeleting(false)
      return
    }

    setDeleteSuccess(true)
    // Brief confirmation pause, then sign out and navigate home
    setTimeout(() => {
      void signOut().then(() => navigate('/'))
    }, 1500)
  }

  // ── Derived stats ────────────────────────────────────────────────────────────

  const totalPlays   = allRuns.length
  const bestScore    = totalPlays > 0 ? Math.max(...allRuns.map(r => r.sixer_score)) : null
  const bestTier     = TIER_ORDER.find(t => allRuns.some(r => r.tier === t)) ?? null
  const totalWins    = allRuns.reduce((s, r) => s + r.wins, 0)
  const totalLosses  = allRuns.reduce((s, r) => s + r.losses, 0)
  const classicRuns  = allRuns.filter(r => r.mode === 'classic')
  const criciqRuns   = allRuns.filter(r => r.mode === 'criciq')
  const dailyRuns    = allRuns.filter(r => r.mode === 'daily')
  const classicBest  = classicRuns.length > 0 ? Math.max(...classicRuns.map(r => r.sixer_score)) : null
  const criciqBest   = criciqRuns.length > 0  ? Math.max(...criciqRuns.map(r => r.sixer_score))  : null
  const dailyBest    = dailyRuns.length > 0   ? Math.max(...dailyRuns.map(r => r.sixer_score))   : null
  const tierCounts   = TIER_ORDER.map(t => ({ tier: t, count: allRuns.filter(r => r.tier === t).length }))

  if (dataLoading) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-10 flex flex-col gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-xl bg-surface animate-pulse" />
        ))}
      </div>
    )
  }

  const avatarCls = avatarColor(userId)
  const initial   = displayName?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="max-w-[680px] mx-auto px-4 py-10 flex flex-col gap-8">

      {/* ── Header strip ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-5">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center font-display text-2xl shrink-0 ${avatarCls}`}>
          {initial}
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={inputRef}
                value={editVal}
                onChange={e => { setEditVal(e.target.value); setEditError(null) }}
                onKeyDown={e => {
                  if (e.key === 'Enter') void handleRename()
                  if (e.key === 'Escape') { setEditing(false); setEditError(null) }
                }}
                maxLength={24}
                className={[
                  'font-body text-base text-cream bg-surface border rounded px-2 py-1 w-40 outline-none',
                  editError ? 'border-red-500/60' : 'border-subtle focus:border-saffron/60',
                  'transition-colors',
                ].join(' ')}
              />
              <button
                type="button"
                onClick={() => void handleRename()}
                disabled={editSaving}
                aria-label="Save name"
                className="text-pitch hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                <Check size={16} />
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setEditError(null) }}
                aria-label="Cancel"
                className="text-muted hover:text-cream transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-display text-xl text-cream truncate">{displayName}</span>
              <button
                type="button"
                onClick={() => { setEditVal(displayName); setEditing(true); setEditError(null) }}
                aria-label="Edit display name"
                className="text-muted hover:text-saffron transition-colors shrink-0"
              >
                <Pencil size={12} />
              </button>
            </div>
          )}

          {editError && (
            <p className="font-body text-[11px] text-red-400">{editError}</p>
          )}
          {editNextAllowed && !editError && (
            <p className="font-body text-[11px] text-muted">
              Next rename:{' '}
              {new Date(editNextAllowed).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
          )}

          <div className="flex items-center gap-3 mt-0.5">
            <span className="font-body text-xs text-muted">
              Member since {memberSince(profileCreatedAt || userCreatedAt)}
            </span>
            {totalPlays > 0 && (
              <span className="font-mono text-xs text-muted/60 tabular-nums">
                {totalPlays} {totalPlays === 1 ? 'draft' : 'drafts'}
              </span>
            )}
          </div>
        </div>
      </div>

      {totalPlays === 0 ? (
        /* ── No plays yet ──────────────────────────────────────────────── */
        <div className="border border-subtle rounded-xl bg-surface p-8 flex flex-col items-center gap-4 text-center">
          <p className="font-display text-xl text-cream">No drafts yet</p>
          <p className="font-body text-sm text-muted leading-relaxed">
            Play your first draft and your stats will appear here.
          </p>
          <Link
            to="/"
            className="bg-saffron text-navy font-display text-base px-8 py-3 rounded-lg hover:opacity-90 transition-opacity"
          >
            START DRAFTING
          </Link>
        </div>
      ) : (
        <>
          {/* ── Stats grid ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCell label="BEST SCORE" value={bestScore !== null ? formatScore(bestScore) : '—'} mono />
            <StatCell
              label="BEST TIER"
              value={bestTier ?? '—'}
              chipCls={bestTier ? (TIER_BADGE[bestTier] ?? '') : ''}
            />
            <StatCell label="TOTAL WINS"   value={String(totalWins)}   mono />
            <StatCell label="TOTAL LOSSES" value={String(totalLosses)} mono />
          </div>

          {/* ── Mode breakdown ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ModeCard label="CLASSIC" plays={classicRuns.length} best={classicBest} accentCls="border-saffron/40" />
            <ModeCard label="CRIC IQ" plays={criciqRuns.length}  best={criciqBest}  accentCls="border-pitch/40"   />
            <ModeCard label="DAILY"   plays={dailyRuns.length}   best={dailyBest}   accentCls="border-[#9D71E8]/40" />
          </div>

          {/* ── Tier distribution ───────────────────────────────────────────── */}
          {totalPlays > 1 && (
            <div className="flex flex-col gap-3">
              <p className="font-body text-xs uppercase tracking-widest text-muted">Tier distribution</p>
              <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
                {tierCounts
                  .filter(tc => tc.count > 0)
                  .map(tc => (
                    <div
                      key={tc.tier}
                      title={`${tc.tier}: ${tc.count}`}
                      className={`${TIER_BAR_COLORS[tc.tier] ?? 'bg-muted/30'} rounded-full transition-all`}
                      style={{ flex: tc.count }}
                    />
                  ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {tierCounts.filter(tc => tc.count > 0).map(tc => {
                  const colorCls = TIER_LEGEND_COLORS[tc.tier] ?? 'text-muted'
                  return (
                    <span key={tc.tier} className="font-mono text-[10px] text-muted tabular-nums">
                      <span className={`font-display ${colorCls}`}>{tc.tier}</span>
                      {' '}{tc.count}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Recent runs ─────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-0 border border-subtle rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-subtle bg-surface/50">
              <p className="font-body text-xs uppercase tracking-widest text-muted">Recent drafts</p>
            </div>
            {recentRuns.map(run => (
              <RecentRunRow
                key={run.id}
                run={run}
                isExpanded={expandedId === run.id}
                onToggle={() => setExpandedId(expandedId === run.id ? null : run.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Danger zone ───────────────────────────────────────────────────── */}
      <div className="border-t border-red-500/30 pt-6 flex flex-col gap-4">
        <p className="font-body text-xs font-bold uppercase tracking-widest text-[#F43256]">
          Danger zone
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <p className="font-body text-sm text-muted leading-relaxed flex-1">
            Permanently delete your Sixer account and profile. Your past leaderboard entries will
            remain but will be attributed to "[deleted user]". This cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="shrink-0 px-5 py-2.5 rounded-lg bg-[#F43256] text-cream font-body font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity"
          >
            Delete account
          </button>
        </div>
      </div>

      <DeleteModal
        displayName={displayName}
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setDeleteError(null) }}
        deleting={deleting}
        deleteError={deleteError}
        deleteSuccess={deleteSuccess}
        onConfirm={() => void handleDelete()}
      />

    </div>
  )
}

// ── StatCell ──────────────────────────────────────────────────────────────────

function StatCell({ label, value, mono, chipCls }: {
  label: string
  value: string
  mono?: boolean
  chipCls?: string
}) {
  return (
    <div className="bg-surface border border-subtle rounded-xl p-4 flex flex-col gap-1.5">
      <p className="font-body text-[10px] uppercase tracking-widest text-muted">{label}</p>
      {chipCls ? (
        <span className={`font-display text-xl px-2 py-0.5 rounded self-start ${chipCls}`}>{value}</span>
      ) : (
        <p className={`${mono ? 'font-mono' : 'font-display'} text-xl text-cream`}>{value}</p>
      )}
    </div>
  )
}

// ── ModeCard ──────────────────────────────────────────────────────────────────

function ModeCard({ label, plays, best, accentCls }: {
  label: string
  plays: number
  best: number | null
  accentCls: string
}) {
  return (
    <div className={`bg-surface border-2 ${accentCls} rounded-xl p-4 flex flex-col gap-2`}>
      <p className="font-display text-sm text-cream">{label}</p>
      {plays === 0 ? (
        <p className="font-body text-xs text-muted">No drafts yet.</p>
      ) : (
        <div className="flex items-baseline gap-4">
          <div className="flex flex-col gap-0.5">
            <p className="font-mono text-[10px] text-muted uppercase tracking-wider">Drafts</p>
            <p className="font-mono text-xl text-cream tabular-nums">{plays}</p>
          </div>
          {best !== null && (
            <div className="flex flex-col gap-0.5">
              <p className="font-mono text-[10px] text-muted uppercase tracking-wider">Best</p>
              <p className="font-mono text-xl text-cream tabular-nums">{formatScore(best)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── RecentRunRow ──────────────────────────────────────────────────────────────

function RecentRunRow({
  run, isExpanded, onToggle,
}: {
  run: RecentRun
  isExpanded: boolean
  onToggle: () => void
}) {
  const tierCls = TIER_BADGE[run.tier] ?? 'bg-muted/20 text-muted'

  return (
    <div
      className="border-b border-subtle last:border-b-0 cursor-pointer select-none hover:bg-surface/40 transition-colors"
      onClick={onToggle}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="font-mono text-[10px] text-muted uppercase tracking-wider w-14 shrink-0">
          {run.mode === 'daily' ? 'Daily' : run.mode === 'criciq' ? 'Cric IQ' : 'Classic'}
        </span>

        <span className="flex-1 min-w-0 flex items-center gap-1.5">
          {run.is_personal_best && (
            <span className="font-mono text-[9px] text-pitch bg-pitch/10 px-1 py-0.5 rounded shrink-0">PB</span>
          )}
          <span className="font-mono text-xs text-muted tabular-nums hidden sm:inline">
            {run.wins}–{run.losses}
          </span>
        </span>

        <span className="font-mono text-sm text-cream tabular-nums shrink-0 w-14 text-right">
          {formatScore(run.sixer_score)}
        </span>

        <span className={`font-display text-xs px-1.5 py-0.5 rounded shrink-0 hidden md:inline w-8 text-center ${tierCls}`}>
          {run.tier}
        </span>

        <span className="font-mono text-[10px] text-muted tabular-nums shrink-0 w-16 text-right">
          {relativeDate(run.created_at)}
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
            <XIGrid xi={run.xi} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── DeleteModal ───────────────────────────────────────────────────────────────

function DeleteModal({
  displayName,
  isOpen,
  onClose,
  deleting,
  deleteError,
  deleteSuccess,
  onConfirm,
}: {
  displayName:   string
  isOpen:        boolean
  onClose:       () => void
  deleting:      boolean
  deleteError:   string | null
  deleteSuccess: boolean
  onConfirm:     () => void
}) {
  const [confirmText, setConfirmText] = useState('')

  useEffect(() => {
    if (!isOpen) setConfirmText('')
  }, [isOpen])

  const canDelete = confirmText.toLowerCase() === displayName.toLowerCase() && !deleting && !deleteSuccess

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0F1430] border border-red-500/40 rounded-xl p-6 flex flex-col gap-5">
        <h2 className="font-display text-2xl text-cream">Delete your account?</h2>

        <p className="font-body text-sm text-cream/80 leading-relaxed">
          This will permanently delete your profile, sign you out, and anonymize your leaderboard
          entries. This cannot be undone.
        </p>

        {deleteSuccess ? (
          <p className="font-body text-sm text-pitch text-center py-2 animate-pulse">
            Account deleted. Signing you out…
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <p className="font-body text-xs text-muted">
                Type <span className="font-mono text-cream">{displayName}</span> to confirm:
              </p>
              <input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={displayName}
                disabled={deleting}
                className={[
                  'font-body text-sm text-cream bg-surface border rounded px-3 py-2 outline-none',
                  'border-subtle focus:border-red-500/60 transition-colors disabled:opacity-50',
                ].join(' ')}
              />
            </div>

            {deleteError && (
              <p className="font-body text-sm text-red-400">{deleteError}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-lg border border-subtle text-cream font-body font-bold text-sm uppercase tracking-wider hover:border-cream transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={!canDelete}
                className="flex-1 py-2.5 rounded-lg bg-[#F43256] text-cream font-body font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
