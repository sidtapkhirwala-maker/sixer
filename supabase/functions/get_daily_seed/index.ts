import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Update to the actual launch date so daily_number starts at 1 on launch day.
const DAILY_START_DATE = "2026-06-22"

function getISTDate(): string {
  const now = new Date()
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
  return ist.toISOString().slice(0, 10) // "YYYY-MM-DD"
}

function dayNumber(seedDate: string): number {
  const startMs = new Date(DAILY_START_DATE).getTime()
  const dateMs  = new Date(seedDate).getTime()
  return Math.max(1, Math.floor((dateMs - startMs) / (24 * 60 * 60 * 1000)) + 1)
}

async function generatePairs(
  dateStr: string,
  pool: { franchise_id: number; season_year: number }[],
): Promise<{ franchise_id: number; season_year: number }[]> {
  const pairs: { franchise_id: number; season_year: number }[] = []
  for (let i = 0; i < 11; i++) {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${dateStr}|${i}`),
    )
    const uint32 = new DataView(buf).getUint32(0, false)
    pairs.push(pool[uint32 % pool.length])
  }
  return pairs
}

// Per-instance in-memory cache — keyed on IST date
let cacheDate: string | null = null
let cachePairs: { franchise_id: number; season_year: number }[] | null = null
let cacheDailyNum: number | null = null

function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", ...extra },
  })
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "GET") return json({ error: "GET only" }, 405)

  const today = getISTDate()

  if (cacheDate === today && cachePairs) {
    return json(
      { seed_date: today, pairs: cachePairs, daily_number: cacheDailyNum },
      200,
      { "Cache-Control": "public, max-age=300" },
    )
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Paginate full pool — ORDER BY is critical for determinism
  let allRows: { franchise_id: number; season_year: number }[] = []
  let offset = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from("draftable_pool")
      .select("franchise_id, season_year")
      .order("franchise_id", { ascending: true })
      .order("season_year", { ascending: true })
      .range(offset, offset + PAGE - 1)

    if (error) return json({ error: "Pool load failed" }, 500)
    if (!data || data.length === 0) break
    allRows = allRows.concat(data as typeof allRows)
    if (data.length < PAGE) break
    offset += PAGE
  }

  if (allRows.length === 0) return json({ error: "Empty pool" }, 500)

  // Deduplicate to distinct (franchise_id, season_year) pairs, preserving sort order
  const seen = new Set<string>()
  const pool: { franchise_id: number; season_year: number }[] = []
  for (const row of allRows) {
    const key = `${row.franchise_id}_${row.season_year}`
    if (!seen.has(key)) {
      seen.add(key)
      pool.push(row)
    }
  }

  const pairs     = await generatePairs(today, pool)
  const dailyNum  = dayNumber(today)

  cacheDate     = today
  cachePairs    = pairs
  cacheDailyNum = dailyNum

  return json(
    { seed_date: today, pairs, daily_number: dailyNum },
    200,
    { "Cache-Control": "public, max-age=300" },
  )
})
