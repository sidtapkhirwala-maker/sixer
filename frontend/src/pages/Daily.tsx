import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import SlimLayout from '@/components/layout/SlimLayout'
import SlotMachine from '@/components/draft/SlotMachine'
import CardList from '@/components/draft/CardList'
import XIPanel from '@/components/draft/XIPanel'
import XIPanelMobile from '@/components/draft/XIPanelMobile'
import SoftWarnings from '@/components/draft/SoftWarnings'
import RoundCounter from '@/components/draft/RoundCounter'
import CalculatingOverlay from '@/components/draft/CalculatingOverlay'
import FilterChips from '@/components/draft/FilterChips'
import { getHistoricalShortCode } from '@/lib/franchiseHistory'
import { useAuth } from '@/hooks/useAuth'
import supabase from '@/lib/supabase'
import { signInWithGoogle } from '@/lib/auth'
import type { FilterKey } from '@/components/draft/FilterChips'
import type { DraftableCard, DraftPhase } from '@/types/draft'
import type { DraftablePoolRow } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SeedPair { franchise_id: number; season_year: number }

interface DailySeed {
  seed_date: string
  pairs: SeedPair[]
  daily_number: number
}

type PageState = 'loading' | 'guest' | 'already_played' | 'error' | 'draft'
type UIDraftPhase = 'pre-spin' | 'spinning' | 'selecting'

// ── Helpers ────────────────────────────────────────────────────────────────────

function rowToCard(row: DraftablePoolRow, franchiseShort: string): DraftableCard {
  return {
    id:                   row.id,
    franchise_id:         row.franchise_id,
    franchise_short:      franchiseShort,
    season_year:          row.season_year,
    player_name:          row.player_name,
    display_name:         row.display_name ?? row.player_name,
    role_primary:         row.role_primary,
    role_category:        row.role_category,
    season_quality_tier:  row.season_quality_tier,
    one_line_descriptor:  row.one_line_descriptor,
    player_score:         row.player_score,
    is_overseas:          row.is_overseas === 1,
    avg_batting_position: row.avg_batting_position,
    matches_played:       row.matches_played,
    runs_scored:          row.runs_scored,
    batting_strike_rate:  row.batting_strike_rate,
    batting_average:      row.batting_average,
    wickets_taken:        row.wickets_taken,
    bowling_economy:      row.bowling_economy,
    bowling_average:      row.bowling_average,
  }
}

const SPIN_ANIMATION_MS = 1600

// ── Component ──────────────────────────────────────────────────────────────────

export default function Daily() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  // ── Page phase ───────────────────────────────────────────────────────────────
  const [pageState,          setPageState]          = useState<PageState>('loading')
  const [seed,               setSeed]               = useState<DailySeed | null>(null)
  const [alreadyPlayedRunId, setAlreadyPlayedRunId] = useState<string | null>(null)
  const [loadError,          setLoadError]          = useState<string | null>(null)
  const [franchiseMap,       setFranchiseMap]       = useState<Map<number, string>>(new Map())

  // ── Draft state ──────────────────────────────────────────────────────────────
  const [uiPhase,         setUiPhase]         = useState<UIDraftPhase>('pre-spin')
  const [phase,           setPhase]           = useState<DraftPhase>('idle')
  const [roundIndex,      setRoundIndex]      = useState(0)
  const [pickedPlayers,   setPickedPlayers]   = useState<DraftableCard[]>([])
  const [currentCards,    setCurrentCards]    = useState<DraftableCard[]>([])
  const [displayCombo,    setDisplayCombo]    = useState({ name: '???', year: '????' })
  const [spinningFranch,  setSpinningFranch]  = useState(false)
  const [spinningYear,    setSpinningYear]    = useState(false)
  const [filter,          setFilter]          = useState<FilterKey>('ALL')
  const [searchQuery,     setSearchQuery]     = useState('')
  const [showCalculating, setShowCalculating] = useState(false)
  const spinningRef = useRef(false)

  // ── Initialise: fetch seed + already-played check ────────────────────────────
  useEffect(() => {
    if (authLoading) return

    async function init() {
      // 1. Fetch today's seed
      const { data: seedData, error: seedErr } = await supabase.functions.invoke<DailySeed>(
        'get_daily_seed', { method: 'GET' }
      )
      if (seedErr || !seedData?.pairs?.length) {
        setLoadError("Couldn't load today's daily challenge.")
        setPageState('error')
        return
      }
      setSeed(seedData)

      // 2. Gate: guests cannot play daily
      if (!user) {
        setPageState('guest')
        return
      }

      // 3. Server-side already-played check (source of truth — no localStorage)
      const { data: existing } = await supabase
        .from('sixer_runs')
        .select('id')
        .eq('user_id', user.id)
        .eq('daily_seed_date', seedData.seed_date)
        .eq('is_daily', true)
        .maybeSingle()

      if (existing) {
        setAlreadyPlayedRunId((existing as { id: string }).id)
        setPageState('already_played')
        return
      }

      // 4. Load franchise map (franchise_id → short_code)
      const { data: franchises } = await supabase
        .from('franchises')
        .select('franchise_id, short_code')

      if (franchises) {
        const map = new Map<number, string>()
        for (const f of franchises as { franchise_id: number; short_code: string }[]) {
          map.set(f.franchise_id, f.short_code)
        }
        setFranchiseMap(map)
      }

      setPageState('draft')
    }

    void init()
  }, [authLoading, user])

  // ── Derived animation pools ───────────────────────────────────────────────────
  const allShorts = useMemo(() => {
    if (!seed) return []
    return seed.pairs.map(p => {
      const sc = franchiseMap.get(p.franchise_id) ?? '???'
      return getHistoricalShortCode(sc, p.season_year)
    })
  }, [seed, franchiseMap])

  const allYears = useMemo(() =>
    seed?.pairs.map(p => String(p.season_year)) ?? []
  , [seed])

  const visibleCards = useMemo(() => {
    return currentCards
      .filter(card => {
        if (filter === 'ALL') return true
        if (filter === 'BAT') return card.role_category === 'Batter'
        if (filter === 'BWL') return card.role_category === 'Bowler'
        if (filter === 'AR')  return card.role_category === 'All-Rounder'
        if (filter === 'WK')  return card.role_category === 'Wicketkeeper'
        return true
      })
      .filter(card => {
        if (!searchQuery.trim()) return true
        const q = searchQuery.toLowerCase()
        return (
          card.display_name.toLowerCase().includes(q) ||
          card.player_name.toLowerCase().includes(q)
        )
      })
  }, [currentCards, filter, searchQuery])

  const overseasCount = pickedPlayers.filter(p => p.is_overseas).length

  // ── Spin animation ────────────────────────────────────────────────────────────
  const runSpinAnimation = useCallback((finalName: string, finalYear: string): Promise<void> => {
    return new Promise(resolve => {
      setDisplayCombo({ name: finalName, year: finalYear })
      setSpinningFranch(true)
      setSpinningYear(true)
      setTimeout(() => {
        setSpinningFranch(false)
        setSpinningYear(false)
        resolve()
      }, SPIN_ANIMATION_MS)
    })
  }, [])

  // ── Reveal (daily equivalent of doSpin) ──────────────────────────────────────
  const doReveal = useCallback(async () => {
    if (spinningRef.current || !seed || franchiseMap.size === 0) return

    spinningRef.current = true
    setPhase('spinning')
    setCurrentCards([])
    setUiPhase('spinning')

    const pair  = seed.pairs[roundIndex]
    const sc    = franchiseMap.get(pair.franchise_id)
    if (!sc) {
      spinningRef.current = false
      setPhase('idle')
      setUiPhase('pre-spin')
      return
    }
    const short = getHistoricalShortCode(sc, pair.season_year)

    await runSpinAnimation(short, String(pair.season_year))

    try {
      const { data, error } = await supabase
        .from('draftable_pool')
        .select('*')
        .eq('franchise_id', pair.franchise_id)
        .eq('season_year', pair.season_year)

      if (error) throw new Error(error.message)
      const cards = ((data as DraftablePoolRow[]) ?? []).map(r => rowToCard(r, short))
      setCurrentCards(cards)
      setPhase('picking')
      setUiPhase('selecting')
    } catch {
      setPhase('idle')
      setUiPhase('pre-spin')
    } finally {
      spinningRef.current = false
    }
  }, [seed, franchiseMap, roundIndex, runSpinAnimation])

  // ── Card pick ─────────────────────────────────────────────────────────────────
  const handleCardClick = useCallback((card: DraftableCard) => {
    const newPicks  = [...pickedPlayers, card]
    const newRound  = roundIndex + 1
    setPickedPlayers(newPicks)
    setRoundIndex(newRound)

    if (newRound >= 11) {
      setPhase('done')
      setShowCalculating(true)
      setTimeout(() => {
        navigate('/results', {
          state: {
            picks:          newPicks,
            mode:           'daily',
            dailySeedDate:  seed!.seed_date,
            dailyNumber:    seed!.daily_number,
          },
        })
      }, 2600)
    } else {
      setPhase('idle')
      setUiPhase('pre-spin')
      setCurrentCards([])
      setDisplayCombo({ name: '???', year: '????' })
      setFilter('ALL')
      setSearchQuery('')
    }
  }, [pickedPlayers, roundIndex, navigate, seed])

  // ── Render: loading ───────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <SlimLayout>
        <div className="flex-1 flex items-center justify-center">
          <p className="font-body text-muted animate-pulse">Loading today's daily…</p>
        </div>
      </SlimLayout>
    )
  }

  if (pageState === 'error') {
    return (
      <SlimLayout>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="font-display text-2xl text-saffron">Something went wrong</p>
          <p className="font-body text-sm text-muted">{loadError}</p>
          <Link to="/" className="font-body text-sm text-saffron hover:underline">← Home</Link>
        </div>
      </SlimLayout>
    )
  }

  // ── Render: guest sign-in wall ───────────────────────────────────────────────
  if (pageState === 'guest') {
    return (
      <SlimLayout>
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
            <Lock className="w-16 h-16 text-saffron" />
            <div>
              <p className="font-mono text-xs text-saffron uppercase tracking-widest mb-2">
                Today's Challenge
              </p>
              <h1 className="font-display text-5xl text-saffron">
                SIXER DAILY #{seed?.daily_number ?? '—'}
              </h1>
            </div>
            <p className="font-body text-sm text-muted leading-relaxed max-w-sm">
              Daily Mode is a ranked, once-per-day challenge. Same XI constraints for every player
              worldwide. Sign in with Google to play today's draft and appear on the daily leaderboard.
            </p>
            <ul className="text-left w-full flex flex-col gap-2">
              {[
                'One play per day',
                'Pure memory mode — no player stats shown',
                'Same 11 picks for everyone · resets at midnight IST',
              ].map(rule => (
                <li key={rule} className="flex items-start gap-2 font-body text-sm text-cream">
                  <span className="text-pitch mt-0.5 shrink-0">•</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => { void signInWithGoogle() }}
              className="w-full bg-saffron text-navy font-display text-xl px-8 py-4 rounded-lg hover:opacity-90 transition-opacity"
            >
              SIGN IN WITH GOOGLE TO PLAY
            </button>
            <Link to="/" className="font-body text-sm text-muted hover:text-cream transition-colors">
              Or play Classic or CricIQ as a guest
            </Link>
          </div>
        </div>
      </SlimLayout>
    )
  }

  // ── Render: already played ────────────────────────────────────────────────────
  if (pageState === 'already_played') {
    return (
      <SlimLayout>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 text-center max-w-sm mx-auto">
          <span className="font-mono text-xs text-pitch border border-pitch/30 rounded-full px-3 py-1 uppercase tracking-widest">
            Sixer Daily #{seed?.daily_number}
          </span>
          <p className="font-display text-3xl text-cream">You've already played today</p>
          <p className="font-body text-sm text-muted leading-relaxed">
            Come back after midnight IST for a new challenge.
          </p>
          <div className="flex flex-col gap-3 w-full">
            {alreadyPlayedRunId && (
              <Link
                to={`/leaderboard?tab=daily&highlight=${alreadyPlayedRunId}`}
                className="flex items-center justify-center px-6 py-3 rounded-lg bg-pitch text-navy font-display text-lg hover:opacity-90 transition-opacity"
              >
                VIEW MY RESULT
              </Link>
            )}
            <Link to="/" className="font-body text-sm text-muted hover:text-cream transition-colors">
              ← Back to Home
            </Link>
          </div>
        </div>
      </SlimLayout>
    )
  }

  // ── Render: draft ─────────────────────────────────────────────────────────────
  return (
    <SlimLayout>
      <CalculatingOverlay visible={showCalculating} />

      <div className="flex-1 flex gap-8 px-4 lg:px-12 py-6 w-full pb-24 lg:pb-6">

        {/* Center column */}
        <div className="flex-1 flex flex-col gap-6 min-w-0 lg:flex-none lg:w-[42%]">

          {/* Top bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <RoundCounter round={roundIndex + 1} />
            <span className="font-mono text-xs border rounded-full px-2 py-0.5 text-pitch border-pitch">
              DAILY #{seed?.daily_number}
            </span>
          </div>

          {/* Pre-spin / spinning */}
          {(uiPhase === 'pre-spin' || uiPhase === 'spinning') && (
            <div className="flex flex-col items-center gap-8 py-8">
              {uiPhase === 'pre-spin' && (
                <div className="text-center">
                  <p className="font-body font-bold text-3xl text-cream mb-2">
                    Reveal today's pick
                  </p>
                  <p className="font-body text-base text-muted">
                    Same XI for everyone today. No lifelines. Pure cricket IQ.
                  </p>
                </div>
              )}

              <SlotMachine
                mode="expanded"
                preSpin={uiPhase === 'pre-spin'}
                franchiseName={displayCombo.name}
                year={displayCombo.year}
                spinningFranchise={spinningFranch}
                spinningYear={spinningYear}
                allFranchises={allShorts}
                allYears={allYears}
              />

              {uiPhase === 'pre-spin' && (
                <div className="flex flex-col items-center gap-3">
                  <motion.button
                    onClick={() => void doReveal()}
                    whileTap={{ scale: 0.97 }}
                    animate={{
                      boxShadow: [
                        '0 0 20px rgba(0,200,150,0.2)',
                        '0 0 40px rgba(0,200,150,0.5)',
                        '0 0 20px rgba(0,200,150,0.2)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="bg-pitch text-navy px-12 py-4 rounded-lg font-body font-bold uppercase text-2xl"
                  >
                    REVEAL
                  </motion.button>
                  <p className="font-body text-sm text-muted">Round {roundIndex + 1} of 11</p>
                </div>
              )}
            </div>
          )}

          {/* Selecting */}
          {uiPhase === 'selecting' && (
            <>
              <div className="sticky top-[56px] md:top-[60px] z-20 bg-navy pt-2 pb-3 shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
                {/* Collapsed slot — no lifeline props → reroll buttons hidden */}
                <SlotMachine
                  mode="collapsed"
                  preSpin={false}
                  franchiseName={displayCombo.name}
                  year={displayCombo.year}
                  spinningFranchise={spinningFranch}
                  spinningYear={spinningYear}
                  allFranchises={allShorts}
                  allYears={allYears}
                />

                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  <FilterChips active={filter} onChange={setFilter} />
                  <input
                    type="text"
                    placeholder="Search players..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="bg-surface border border-subtle rounded-full px-4 py-2 text-sm font-body text-cream placeholder:text-muted focus:outline-none focus:border-saffron transition-colors min-w-[160px]"
                  />
                </div>

                {currentCards.length > 0 && (
                  <p className="font-body text-xs text-muted mt-2">
                    {visibleCards.length} player{visibleCards.length !== 1 ? 's' : ''} available
                  </p>
                )}
              </div>

              <SoftWarnings picks={pickedPlayers} />

              <CardList
                cards={visibleCards}
                mode="criciq"
                onPick={handleCardClick}
                visible={phase === 'picking'}
                pickedPlayerNames={pickedPlayers.map(p => p.player_name)}
                overseasCount={overseasCount}
              />
            </>
          )}
        </div>

        {/* Desktop XI panel */}
        <XIPanel picks={pickedPlayers} uiPhase={uiPhase} />
      </div>

      <XIPanelMobile picks={pickedPlayers} />
    </SlimLayout>
  )
}
