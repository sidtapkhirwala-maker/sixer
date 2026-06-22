import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import SlimLayout from '@/components/layout/SlimLayout'
import SlotMachine from '@/components/draft/SlotMachine'
import CardList from '@/components/draft/CardList'
import XIPanel from '@/components/draft/XIPanel'
import XIPanelMobile from '@/components/draft/XIPanelMobile'
import SoftWarnings from '@/components/draft/SoftWarnings'
import RoundCounter from '@/components/draft/RoundCounter'
import CalculatingOverlay from '@/components/draft/CalculatingOverlay'
import { useDraftQueries } from '@/hooks/useDraftQueries'
import FilterChips, { type FilterKey } from '@/components/draft/FilterChips'
import { isValidFranchiseYear, getHistoricalShortCode } from '@/lib/franchiseHistory'
import supabase from '@/lib/supabase'
import type { DraftMode, DraftPhase, DraftableCard, ValidCombo } from '@/types/draft'

type UIDraftPhase = 'pre-spin' | 'spinning' | 'selecting'

interface FranchiseInfo {
  short_code: string
  active: boolean
}

interface DisplayCombo {
  name: string
  year: string
}

const SPIN_TICKS        = 9
const LIFELINE_TICKS    = 6
const SPIN_ANIMATION_MS = 1600  // reel animation 1.5s + 100ms buffer

export default function Draft() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const mode = (searchParams.get('mode') as DraftMode | null) ?? 'classic'

  const { validCombos, loading, error, loadCards } = useDraftQueries()

  // ── Franchise lookup map ─────────────────────────────────────────────────
  const [franchiseMap, setFranchiseMap] = useState<Map<number, FranchiseInfo>>(new Map())
  const [franchisesLoading, setFranchisesLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('franchises')
      .select('franchise_id, short_code, active')
      .then(({ data, error: e }) => {
        if (e || !data) {
          console.error('Franchise lookup failed:', e?.message)
          setFranchisesLoading(false)
          return
        }
        const map = new Map<number, FranchiseInfo>()
        for (const f of data as { franchise_id: number; short_code: string; active: boolean }[]) {
          map.set(f.franchise_id, { short_code: f.short_code, active: f.active })
        }
        setFranchiseMap(map)
        setFranchisesLoading(false)
      })
  }, [])

  // ── Filter + enrich validCombos ──────────────────────────────────────────
  const filteredCombos = useMemo<ValidCombo[]>(() => {
    if (franchiseMap.size === 0) return []
    const result: ValidCombo[] = []
    for (const c of validCombos) {
      const f = franchiseMap.get(c.franchise_id)
      if (!f) {
        console.error(`Unknown franchise_id ${c.franchise_id} — skipping combo`)
        continue
      }
      if (!isValidFranchiseYear(f.short_code, c.season_year)) continue
      result.push({ ...c, franchise_name: f.short_code, franchise_short: f.short_code })
    }
    console.log(
      'FILTERED_COMBOS',
      result.length,
      Array.from(new Set(result.map(c => c.franchise_short))).sort(),
    )
    return result
  }, [validCombos, franchiseMap])

  // ── Draft state ──────────────────────────────────────────────────────────
  const [uiPhase, setUiPhase]             = useState<UIDraftPhase>('pre-spin')
  const [phase, setPhase]                 = useState<DraftPhase>('idle')
  const [roundIndex, setRoundIndex]       = useState(0)
  const [pickedPlayers, setPickedPlayers] = useState<DraftableCard[]>([])
  const [currentCombo, setCurrentCombo]  = useState<ValidCombo | null>(null)
  const [currentCards, setCurrentCards]  = useState<DraftableCard[]>([])
  const [displayCombo, setDisplayCombo]  = useState<DisplayCombo>({ name: '???', year: '????' })
  const [spinningFranchise, setSpinningFranchise] = useState(false)
  const [spinningYear, setSpinningYear]           = useState(false)
  const [lifelines, setLifelines]         = useState({ franchise: 1, year: 1 })
  const [usedComboKeys, setUsedComboKeys] = useState<Set<string>>(new Set())
  const [showCalculating, setShowCalculating] = useState(false)
  const [rerollMessage, setRerollMessage] = useState<string | null>(null)
  const [filter, setFilter]               = useState<FilterKey>('ALL')
  const [searchQuery, setSearchQuery]     = useState('')

  const spinningRef = useRef(false)

  // Overseas cap: max 4 overseas players
  const overseasCount = pickedPlayers.filter(p => p.is_overseas).length

  // ── Derived pools for animation cycling ─────────────────────────────────
  const allShorts = useMemo(() => filteredCombos.map(c => c.franchise_short!), [filteredCombos])
  const allYears  = useMemo(() => filteredCombos.map(c => String(c.season_year)), [filteredCombos])

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
          (card.display_name ?? '').toLowerCase().includes(q) ||
          card.player_name.toLowerCase().includes(q)
        )
      })
  }, [currentCards, filter, searchQuery])

  function pickRandomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
  }

  function getAvailableCombos(exclude: Set<string>): ValidCombo[] {
    const av = filteredCombos.filter(c => !exclude.has(`${c.franchise_id}_${c.season_year}`))
    return av.length > 0 ? av : filteredCombos
  }

  function showRerollError(msg: string) {
    setRerollMessage(msg)
    setTimeout(() => setRerollMessage(null), 2500)
  }

  // ── Spin animation ───────────────────────────────────────────────────────
  // Sets the settled value immediately so the Drum can build its reel strip,
  // then waits for the CSS animation to finish before resolving.
  const runSpinAnimation = useCallback((
    finalName: string,
    finalYear: string,
    axis: 'both' | 'franchise' | 'year',
    _ticks: number,
  ): Promise<void> => {
    return new Promise(resolve => {
      setDisplayCombo(prev => ({
        name: (axis === 'franchise' || axis === 'both') ? finalName : prev.name,
        year: (axis === 'year'      || axis === 'both') ? finalYear : prev.year,
      }))
      if (axis === 'franchise' || axis === 'both') setSpinningFranchise(true)
      if (axis === 'year'      || axis === 'both') setSpinningYear(true)

      setTimeout(() => {
        setSpinningFranchise(false)
        setSpinningYear(false)
        resolve()
      }, SPIN_ANIMATION_MS)
    })
  }, [])

  // ── Core spin ────────────────────────────────────────────────────────────
  const doSpin = useCallback(async (
    opts?: { keepFranchise?: boolean; keepYear?: boolean; ticks?: number }
  ) => {
    if (spinningRef.current || filteredCombos.length === 0) return

    spinningRef.current = true
    setPhase('spinning')
    setCurrentCards([])
    setUiPhase('spinning')

    const available = getAvailableCombos(usedComboKeys)
    const ticks = opts?.ticks ?? SPIN_TICKS

    let combo: ValidCombo
    let axis: 'both' | 'franchise' | 'year' = 'both'

    if (opts?.keepYear && currentCombo) {
      const sameYear = available.filter(
        c => c.season_year === currentCombo.season_year &&
             c.franchise_id !== currentCombo.franchise_id
      )
      if (sameYear.length === 0) {
        spinningRef.current = false
        setPhase('picking')
        showRerollError('No valid team reroll available')
        return
      }
      combo = pickRandomItem(sameYear)
      axis = 'franchise'
    } else if (opts?.keepFranchise && currentCombo) {
      const sameFranchise = available.filter(
        c => c.franchise_id === currentCombo.franchise_id &&
             c.season_year !== currentCombo.season_year
      )
      if (sameFranchise.length === 0) {
        spinningRef.current = false
        setPhase('picking')
        showRerollError('No valid year reroll available')
        return
      }
      combo = pickRandomItem(sameFranchise)
      axis = 'year'
    } else {
      combo = pickRandomItem(available)
    }

    const short = getHistoricalShortCode(combo.franchise_short!, combo.season_year)
    console.log('SPIN_SETTLED', short, combo.season_year)
    await runSpinAnimation(short, String(combo.season_year), axis, ticks)
    setCurrentCombo(combo)

    try {
      const cards = await loadCards(combo.franchise_id, combo.season_year, short)
      setCurrentCards(cards)
      setPhase('picking')
      setUiPhase('selecting')
    } catch {
      setPhase('idle')
      setUiPhase('pre-spin')
    } finally {
      spinningRef.current = false
    }
  }, [filteredCombos, usedComboKeys, currentCombo, runSpinAnimation, loadCards])

  // ── Lifelines ────────────────────────────────────────────────────────────
  const handleRerollFranchise = useCallback(() => {
    if (lifelines.franchise <= 0 || phase !== 'picking') return
    setLifelines(l => ({ ...l, franchise: l.franchise - 1 }))
    doSpin({ keepYear: true, ticks: LIFELINE_TICKS })
  }, [lifelines.franchise, phase, doSpin])

  const handleRerollYear = useCallback(() => {
    if (lifelines.year <= 0 || phase !== 'picking') return
    setLifelines(l => ({ ...l, year: l.year - 1 }))
    doSpin({ keepFranchise: true, ticks: LIFELINE_TICKS })
  }, [lifelines.year, phase, doSpin])

  // ── Instant pick ─────────────────────────────────────────────────────────
  const handleCardClick = useCallback((card: DraftableCard) => {
    if (!currentCombo) return

    const newPicks = [...pickedPlayers, card]
    setPickedPlayers(newPicks)

    const newUsed = new Set(usedComboKeys)
    newUsed.add(`${currentCombo.franchise_id}_${currentCombo.season_year}`)
    setUsedComboKeys(newUsed)

    const newRound = roundIndex + 1
    setRoundIndex(newRound)

    if (newRound >= 11) {
      setPhase('done')
      setShowCalculating(true)
      setTimeout(() => {
        navigate('/results', { state: { picks: newPicks, mode } })
      }, 2600)
    } else {
      // Return to pre-spin — user clicks SPIN again for next round
      setPhase('idle')
      setUiPhase('pre-spin')
      setCurrentCards([])
      setCurrentCombo(null)
      setDisplayCombo({ name: '???', year: '????' })
      setFilter('ALL')
      setSearchQuery('')
    }
  }, [currentCombo, pickedPlayers, usedComboKeys, roundIndex, navigate, mode])

  // ── Render guards ────────────────────────────────────────────────────────
  if (loading || franchisesLoading) {
    return (
      <SlimLayout>
        <div className="flex-1 flex items-center justify-center">
          <p className="font-body text-muted animate-pulse">Loading draft data…</p>
        </div>
      </SlimLayout>
    )
  }

  if (error) {
    return (
      <SlimLayout>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <p className="font-display text-2xl text-saffron">Something went wrong</p>
          <p className="font-body text-sm text-muted">{error}</p>
        </div>
      </SlimLayout>
    )
  }

  const modeLabel = mode === 'criciq' ? 'CRICIQ' : 'CLASSIC'
  const modeColor = mode === 'criciq' ? 'text-pitch border-pitch' : 'text-saffron border-saffron'

  return (
    <SlimLayout>
      <CalculatingOverlay visible={showCalculating} />

      <div className="flex-1 flex gap-8 px-4 lg:px-12 py-6 w-full pb-24 lg:pb-6">

        {/* ── Center column: ~42% on desktop ── */}
        <div className="flex-1 flex flex-col gap-6 min-w-0 lg:flex-none lg:w-[42%]">

          {/* Top bar — always visible */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <RoundCounter round={roundIndex + 1} />
            <span className={`font-mono text-xs border rounded-full px-2 py-0.5 ${modeColor}`}>
              {modeLabel}
            </span>
          </div>

          {/* ── PRE-SPIN / SPINNING: centered hero layout ── */}
          {(uiPhase === 'pre-spin' || uiPhase === 'spinning') && (
            <div className="flex flex-col items-center gap-8 py-8">
              {uiPhase === 'pre-spin' && (
                <div className="text-center">
                  <p className="font-body font-bold text-3xl text-cream mb-2">
                    Spin to reveal your draft pick
                  </p>
                  <p className="font-body text-base text-muted">
                    Land on a franchise × season combo, then choose one player from the resulting pool.
                  </p>
                </div>
              )}

              <SlotMachine
                mode="expanded"
                preSpin={uiPhase === 'pre-spin'}
                franchiseName={displayCombo.name}
                year={displayCombo.year}
                spinningFranchise={spinningFranchise}
                spinningYear={spinningYear}
                allFranchises={allShorts}
                allYears={allYears}
              />

              {uiPhase === 'pre-spin' && (
                <div className="flex flex-col items-center gap-3">
                  <motion.button
                    onClick={() => doSpin()}
                    whileTap={{ scale: 0.97 }}
                    animate={{
                      boxShadow: [
                        '0 0 20px rgba(255,107,26,0.2)',
                        '0 0 40px rgba(255,107,26,0.5)',
                        '0 0 20px rgba(255,107,26,0.2)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="bg-saffron text-navy px-12 py-4 rounded-lg font-body font-bold uppercase text-2xl"
                  >
                    SPIN
                  </motion.button>
                  <p className="font-body text-sm text-muted">Click to reveal this round's spin</p>
                </div>
              )}
            </div>
          )}

          {/* ── SELECTING: sticky collapsed header + player list ── */}
          {uiPhase === 'selecting' && (
            <>
              <div className="sticky top-[56px] md:top-[60px] z-20 bg-navy pt-2 pb-3 shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
                <SlotMachine
                  mode="collapsed"
                  preSpin={false}
                  franchiseName={displayCombo.name}
                  year={displayCombo.year}
                  spinningFranchise={spinningFranchise}
                  spinningYear={spinningYear}
                  allFranchises={allShorts}
                  allYears={allYears}
                  franchiseLifelines={lifelines.franchise}
                  yearLifelines={lifelines.year}
                  onRerollFranchise={handleRerollFranchise}
                  onRerollYear={handleRerollYear}
                />

                {rerollMessage && (
                  <p className="font-body text-xs text-muted mt-2">{rerollMessage}</p>
                )}

                {/* Filter chips + search input */}
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

                {/* Live count */}
                {currentCards.length > 0 && (
                  <p className="font-body text-xs text-muted mt-2">
                    {visibleCards.length} player{visibleCards.length !== 1 ? 's' : ''} available
                  </p>
                )}
              </div>

              <SoftWarnings picks={pickedPlayers} />

              <CardList
                cards={visibleCards}
                mode={mode}
                onPick={handleCardClick}
                visible={phase === 'picking'}
                pickedPlayerNames={pickedPlayers.map(p => p.player_name)}
                overseasCount={overseasCount}
              />
            </>
          )}
        </div>

        {/* ── Desktop XI panel ── */}
        <XIPanel picks={pickedPlayers} uiPhase={uiPhase} />
      </div>

      <XIPanelMobile picks={pickedPlayers} />
    </SlimLayout>
  )
}
