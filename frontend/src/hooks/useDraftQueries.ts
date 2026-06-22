import { useState, useEffect, useCallback } from 'react'
import supabase from '@/lib/supabase'
import type { DraftablePoolRow } from '@/lib/supabase'
import type { DraftableCard, ValidCombo } from '@/types/draft'

const MIN_SQUAD_SIZE = 6

function rowToCard(row: DraftablePoolRow, franchiseShort: string): DraftableCard {
  return {
    id: row.id,
    franchise_id: row.franchise_id,
    franchise_short: franchiseShort,
    season_year: row.season_year,
    player_name: row.player_name,
    display_name: row.display_name ?? row.player_name,
    role_primary: row.role_primary,
    role_category: row.role_category,
    season_quality_tier: row.season_quality_tier,
    one_line_descriptor: row.one_line_descriptor,
    player_score: row.player_score,
    is_overseas: row.is_overseas === 1,
    avg_batting_position: row.avg_batting_position,
    matches_played: row.matches_played,
    runs_scored: row.runs_scored,
    batting_strike_rate: row.batting_strike_rate,
    batting_average: row.batting_average,
    wickets_taken: row.wickets_taken,
    bowling_economy: row.bowling_economy,
    bowling_average: row.bowling_average,
  }
}

export function useDraftQueries() {
  const [validCombos, setValidCombos] = useState<ValidCombo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadStartupData() {
      try {
        let allRows: { franchise_id: number; season_year: number }[] = []
        let offset = 0
        const pageSize = 1000

        while (true) {
          const { data, error: cError } = await supabase
            .from('draftable_pool')
            .select('franchise_id, season_year')
            .range(offset, offset + pageSize - 1)

          if (cError) throw new Error(cError.message)
          if (!data || data.length === 0) break

          allRows = allRows.concat(data as { franchise_id: number; season_year: number }[])
          if (data.length < pageSize) break
          offset += pageSize
        }

        const countMap = new Map<string, number>()
        const rowMap   = new Map<string, { franchise_id: number; season_year: number }>()

        for (const row of allRows) {
          const key = `${row.franchise_id}_${row.season_year}`
          countMap.set(key, (countMap.get(key) ?? 0) + 1)
          if (!rowMap.has(key)) rowMap.set(key, row)
        }

        const combos: ValidCombo[] = []
        for (const [key, count] of countMap) {
          if (count < MIN_SQUAD_SIZE) continue
          const row = rowMap.get(key)!
          combos.push({
            franchise_id: row.franchise_id,
            season_year: row.season_year,
          })
        }

        if (!cancelled) {
          setValidCombos(combos)
          console.log(
            'VALID_COMBOS_FROM_HOOK',
            combos.length,
            Array.from(new Set(combos.map(c => c.franchise_id))).length,
            Array.from(new Set(combos.map(c => c.franchise_id))).sort(),
          )
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load draft data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadStartupData()
    return () => { cancelled = true }
  }, [])

  const loadCards = useCallback(async (
    franchise_id: number,
    season_year: number,
    franchiseShort: string,
  ): Promise<DraftableCard[]> => {
    const { data, error } = await supabase
      .from('draftable_pool')
      .select('*')
      .eq('franchise_id', franchise_id)
      .eq('season_year', season_year)

    if (error) throw new Error(error.message)
    return ((data as DraftablePoolRow[]) ?? []).map(r => rowToCard(r, franchiseShort))
  }, [])

  return { validCombos, loading, error, loadCards }
}
