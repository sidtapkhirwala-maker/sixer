import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Lock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import supabase from '@/lib/supabase'
import { signInWithGoogle } from '@/lib/auth'

function getTodayIST(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

const BASE_CLS = [
  'relative flex flex-col justify-center',
  'bg-surface rounded-2xl',
  'px-6 py-8',
  'transition-all duration-200',
  'w-full md:w-[280px] min-h-[160px]',
].join(' ')

export default function DailyCTA() {
  const { user, loading: authLoading } = useAuth()
  const [dailyNumber,   setDailyNumber]   = useState<number | null>(null)
  const [alreadyPlayed, setAlreadyPlayed] = useState(false)
  const [alreadyRunId,  setAlreadyRunId]  = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return // wait for auth to settle before querying DB

    supabase.functions
      .invoke<{ daily_number: number; seed_date: string }>('get_daily_seed', { method: 'GET' })
      .then(({ data }) => {
        if (!data) return
        if (data.daily_number) setDailyNumber(data.daily_number)
        if (!user) return // guests have no server-side play state to check

        // Server is source of truth — no localStorage
        supabase
          .from('sixer_runs')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_daily', true)
          .eq('daily_seed_date', data.seed_date)
          .maybeSingle()
          .then(({ data: run }) => {
            if (run) {
              setAlreadyPlayed(true)
              setAlreadyRunId((run as { id: string }).id)
            }
          })
      })
  }, [authLoading, user])

  const label = dailyNumber !== null ? `DAILY #${dailyNumber}` : 'DAILY'

  // ── Guest: locked — clicking opens Google OAuth (standard /auth/callback flow) ─
  if (!user) {
    return (
      <button
        type="button"
        onClick={() => {
          void signInWithGoogle()
        }}
        className={[
          BASE_CLS,
          'border-2 border-dashed border-saffron/50 text-left cursor-pointer opacity-90',
          'hover:opacity-100 hover:border-saffron/80 hover:shadow-[0_0_24px_rgba(255,107,26,0.2)]',
        ].join(' ')}
      >
        <CalendarDays className="absolute top-4 right-4 w-5 h-5 text-saffron/50" />
        <span className="font-mono text-[10px] text-saffron/70 uppercase tracking-widest mb-2">
          Today's Challenge
        </span>
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-saffron shrink-0" />
          <span className="font-display text-4xl leading-none text-saffron">{label}</span>
        </div>
        <span className="font-body text-sm text-cream/60 mt-2">
          Sign in to unlock the daily challenge
        </span>
      </button>
    )
  }

  // ── Signed-in: already played today ───────────────────────────────────────
  if (alreadyPlayed) {
    return (
      <Link
        to={`/leaderboard?tab=daily${alreadyRunId ? `&highlight=${alreadyRunId}` : ''}`}
        className={[
          BASE_CLS,
          'border-2 border-pitch/50 cursor-pointer opacity-75',
          'hover:scale-[1.02] hover:opacity-90',
        ].join(' ')}
      >
        <span className="font-display text-4xl leading-none text-pitch/70">{label}</span>
        <span className="font-body text-sm text-muted mt-2">You've played today.</span>
        <span className="font-mono text-xs text-pitch mt-3 uppercase tracking-wider">
          View today's result →
        </span>
      </Link>
    )
  }

  // ── Signed-in: not played yet ──────────────────────────────────────────────
  return (
    <Link
      to="/daily"
      className={[
        BASE_CLS,
        'border-2 border-pitch cursor-pointer',
        'hover:scale-[1.02] hover:shadow-[0_0_32px_rgba(0,200,150,0.3)]',
      ].join(' ')}
    >
      <CalendarDays className="absolute top-4 right-4 w-5 h-5 text-pitch" />
      <span className="font-mono text-[10px] text-pitch uppercase tracking-widest mb-2">
        Today's Challenge
      </span>
      <span className="font-display text-4xl leading-none text-pitch">{label}</span>
      <span className="font-body text-sm text-muted mt-2">One shot. Same XI for everyone.</span>
    </Link>
  )
}
