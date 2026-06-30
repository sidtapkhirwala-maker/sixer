// SYNC NOTE: Scoring mirrors frontend/src/lib/scoring.ts calculateScore().
// Any change to bonus/penalty rules in scoring.ts must be applied here too.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// ── Profanity blocklist ────────────────────────────────────────────────────────
const BLOCKED = [
  "fuck","shit","bitch","asshole","cunt","dick","pussy","cock","piss","whore","slut","bastard",
  "nazi","hitler","nigger","nigga","faggot","retard","tranny",
  "chutiya","bhenchod","madarchod","gandu","randi","lund","gaand","haramzada",
]

function isProfane(name: string): boolean {
  const n = name.toLowerCase()
    .replace(/0/g,"o").replace(/1/g,"i").replace(/3/g,"e")
    .replace(/4/g,"a").replace(/5/g,"s").replace(/\s+/g,"")
  return BLOCKED.some(t => n.includes(t))
}

// ── Role helpers (mirror of frontend/src/lib/roles.ts) ────────────────────────
type P = {
  player_name: string
  display_name: string | null
  season_year: number
  franchise_id: number
  role_primary: string
  role_category: string
  is_overseas: number | boolean
  avg_batting_position: number | null
  batting_strike_rate: number | null
  batting_average: number | null
  bowling_economy: number | null
  wickets_taken: number | null
  player_score: number
  is_wicketkeeper: boolean | null
}

const isKeeper         = (p: P) => p.role_category === "Wicketkeeper" || p.role_primary === "Wicketkeeper" || p.is_wicketkeeper === true
const isSpinner        = (p: P) => p.role_primary === "Spin Bowler"
const isPacer          = (p: P) => p.role_primary === "Pace Bowler"
const isAllRounder     = (p: P) => p.role_category === "All-Rounder"
const isBatter         = (p: P) => p.role_category === "Batter"
const isFinisher       = (p: P) => p.role_primary === "Finisher"
const isTopOrderBatter = (p: P) => p.role_primary === "Top-Order Batter"
const countBattingSide = (xi: P[]) => xi.filter(p => isBatter(p) || isKeeper(p) || isAllRounder(p)).length
const countBowlingSide = (xi: P[]) => xi.filter(p => isSpinner(p) || isPacer(p) || isAllRounder(p)).length

// ── Scoring (mirror of calculateScore in frontend/src/lib/scoring.ts) ─────────
function scoreToRecord(s: number) {
  if (s >= 110) return { wins: 16, losses: 0 }
  if (s >= 107) return { wins: 15, losses: 1 }
  if (s >= 104) return { wins: 14, losses: 2 }
  if (s >= 101) return { wins: 13, losses: 3 }
  if (s >= 98)  return { wins: 12, losses: 4 }
  if (s >= 94)  return { wins: 11, losses: 5 }
  if (s >= 90)  return { wins: 10, losses: 6 }
  if (s >= 86)  return { wins: 9,  losses: 7 }
  if (s >= 82)  return { wins: 8,  losses: 8 }
  if (s >= 77)  return { wins: 7,  losses: 9 }
  if (s >= 72)  return { wins: 6,  losses: 10 }
  if (s >= 67)  return { wins: 5,  losses: 11 }
  if (s >= 62)  return { wins: 4,  losses: 12 }
  if (s >= 57)  return { wins: 3,  losses: 13 }
  if (s >= 51)  return { wins: 2,  losses: 14 }
  if (s >= 45)  return { wins: 1,  losses: 15 }
  return { wins: 0, losses: 16 }
}

function scoreToTier(s: number) {
  if (s >= 110) return "S"
  if (s >= 104) return "A"
  if (s >= 94)  return "B"
  if (s >= 82)  return "C"
  if (s >= 67)  return "D"
  if (s >= 51)  return "E"
  return "F"
}

function computeScore(xi: P[], mode: string) {
  const rawTeamScore          = xi.reduce((s, p) => s + p.player_score, 0)
  const allLocal          = xi.every(p => !p.is_overseas)
  const spinnerCount      = xi.filter(isSpinner).length
  const pacerCount        = xi.filter(isPacer).length
  const arCount           = xi.filter(isAllRounder).length
  const tierStackCount    = xi.filter(p => p.player_score >= 9.0).length
  const powerHittersCount = xi.filter(p =>
    (p.role_category === "Batter" || p.role_category === "Wicketkeeper" || p.role_category === "All-Rounder") &&
    (p.batting_strike_rate ?? 0) >= 175
  ).length
  const deathSpecCount = xi.filter(p =>
    p.role_primary === "Pace Bowler" && p.bowling_economy !== null && Math.round(p.bowling_economy * 100) / 100 <= 7.0
  ).length
  const spinners       = xi.filter(isSpinner)
  const spinnerWickets = spinners.reduce((s, p) => s + (p.wickets_taken ?? 0), 0)
  const twinAnchorCount = xi.filter(p =>
    (p.role_primary === "Top-Order Batter" || isKeeper(p)) &&
    p.batting_average !== null &&
    p.batting_average >= 50
  ).length

  const bonuses = [
    { points: 2, triggered: allLocal },
    { points: 4, triggered: spinnerCount >= 2 && pacerCount >= 2 && arCount >= 2 },
    { points: 2, triggered: tierStackCount >= 7 },
    { points: 3, triggered: powerHittersCount >= 3 },
    { points: 2, triggered: deathSpecCount >= 2 },
    { points: 2, triggered: spinners.length >= 2 && spinnerWickets >= 35 },
    { points: 2, triggered: twinAnchorCount >= 2 },
  ]
  const totalBonus = Math.min(15, bonuses.filter(b => b.triggered).reduce((s, b) => s + b.points, 0))

  const hasKeeper     = xi.some(isKeeper)
  const hasSpinner    = xi.some(isSpinner)
  const hasPacer      = xi.some(isPacer)
  const battingCount  = countBattingSide(xi)
  const bowlingCount  = countBowlingSide(xi)
  const finisherCount = xi.filter(isFinisher).length
  const anchorCount   = xi.filter(isTopOrderBatter).length

  const penalties = [
    { points: -10, triggered: !hasKeeper },
    { points: -5,  triggered: !hasSpinner },
    { points: -5,  triggered: !hasPacer },
    { points: -5,  triggered: arCount === 0 },
    { points: -8,  triggered: battingCount < 6 },
    { points: -10, triggered: bowlingCount < 5 },
    { points: -10, triggered: finisherCount >= 5 },
    { points: -5,  triggered: anchorCount >= 5 },
  ]
  const totalPenalty = Math.max(-35, penalties.filter(p => p.triggered).reduce((s, p) => s + p.points, 0))

  // Classic multiplier 0.956522 chosen so raw 115 → final 110.0 (16-0 threshold).
  // Adjust this to retune Classic ceiling without touching the SCORE_TO_RECORD curve.
  const MODE_MULTIPLIER: Record<string, number> = {
    classic: 0.956522,
    criciq:  1.00,
    daily:   1.00,
  }
  const multiplier = MODE_MULTIPLIER[mode] ?? 1.00
  const sixerScore = Math.max(0, Math.round((rawTeamScore + totalBonus + totalPenalty) * multiplier * 100) / 100)
  const record     = scoreToRecord(sixerScore)
  return { sixerScore, rawTeamScore, totalBonus, totalPenalty, wins: record.wins, losses: record.losses, tier: scoreToTier(sixerScore) }
}

// ── IST date helper ────────────────────────────────────────────────────────────
function getISTDate(): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  return ist.toISOString().slice(0, 10)
}

// ── Response helper ────────────────────────────────────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

// ── Main handler ───────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const body = await req.json()
    const { xi, mode, display_name } = body
    const is_daily: boolean         = body.is_daily === true
    const daily_seed_date: string | null = is_daily ? String(body.daily_seed_date ?? '') : null

    // ── Validate inputs ──────────────────────────────────────────────────────
    if (!Array.isArray(xi) || xi.length !== 11) {
      return json({ error: "XI must have exactly 11 players." }, 400)
    }
    if (!mode || typeof mode !== "string") {
      return json({ error: "Invalid mode." }, 400)
    }
    if (typeof display_name !== "string") {
      return json({ error: "display_name required." }, 400)
    }
    const name = display_name.trim()
    if (name.length < 2 || name.length > 24) {
      return json({ error: "Name must be 2–24 characters." }, 400)
    }
    if (!/^[a-zA-Z0-9 ._-]+$/.test(name)) {
      return json({ error: "Name contains invalid characters." }, 400)
    }
    if (isProfane(name)) {
      return json({ error: "Name not allowed." }, 400)
    }

    // ── Resolve user identity ────────────────────────────────────────────────
    let userId: string | null = null
    const authHeader = req.headers.get("Authorization")
    if (authHeader?.startsWith("Bearer ")) {
      const { data } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
      userId = data.user?.id ?? null
    }

    // ── Require sign-in for all submissions ──────────────────────────────────
    if (!userId) {
      return json({ error: 'auth_required', message: 'Sign in to submit your score.' }, 401)
    }

    // ── Rate limiting (40/hr per user) ───────────────────────────────────────
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
    const { count } = await supabaseAdmin
      .from("sixer_runs")
      .select("id", { count: "exact", head: true })
      .gt("created_at", oneHourAgo)
      .eq("user_id", userId)

    if ((count ?? 0) >= 40) {
      return json({ error: "Too many submissions. Try again later." }, 429)
    }

    // ── Daily: date check + duplicate guard ──────────────────────────────────
    if (is_daily) {
      const todayIST = getISTDate()
      if (daily_seed_date !== todayIST) {
        return json({ error: "Submission is for a different date." }, 400)
      }

      const { data: existingDaily } = await supabaseAdmin
        .from("sixer_runs")
        .select("id")
        .eq("user_id", userId)
        .eq("daily_seed_date", todayIST)
        .eq("is_daily", true)
        .maybeSingle()

      if (existingDaily) {
        return json({
          error: "Already submitted today's daily.",
          existing_run_id: (existingDaily as { id: string }).id,
        }, 409)
      }
    }

    // ── Look up authoritative player data ────────────────────────────────────
    const playerNames = xi.map((p: { player_name: string }) => p.player_name)
    const { data: dbRows, error: dbErr } = await supabaseAdmin
      .from("draftable_pool")
      .select("player_name, display_name, season_year, franchise_id, player_score, role_primary, role_category, is_overseas, avg_batting_position, batting_strike_rate, batting_average, bowling_economy, wickets_taken")
      .in("player_name", playerNames)

    if (dbErr || !dbRows) {
      return json({ error: "Failed to verify players." }, 500)
    }

    const resolvedXi: P[] = []
    for (const submitted of xi) {
      const match = (dbRows as P[]).find(
        r => r.player_name === submitted.player_name && r.season_year === submitted.season_year
      )
      if (!match) {
        return json({ error: `Player not found: ${submitted.player_name} (${submitted.season_year})` }, 400)
      }
      resolvedXi.push(match)
    }

    // ── Look up franchise short codes ─────────────────────────────────────────
    const franchiseIds = [...new Set(resolvedXi.map(p => p.franchise_id))]
    const { data: franchiseRows } = await supabaseAdmin
      .from("franchises")
      .select("franchise_id, short_code")
      .in("franchise_id", franchiseIds)
    const franchiseShortMap = new Map<number, string>()
    if (franchiseRows) {
      for (const f of franchiseRows as { franchise_id: number; short_code: string }[]) {
        franchiseShortMap.set(f.franchise_id, f.short_code)
      }
    }

    // ── Guard: no duplicate players ───────────────────────────────────────────
    const uniquePlayerNames = new Set(resolvedXi.map(p => p.player_name))
    if (uniquePlayerNames.size !== 11) {
      return json({ error: "XI must have 11 distinct players." }, 400)
    }

    // ── Server-side dedupe: same XI within 60 seconds ────────────────────────
    const sixtySecondsAgo   = new Date(Date.now() - 60_000).toISOString()
    const submittedSignature = resolvedXi
      .map(p => `${p.player_name}|${p.season_year}`)
      .sort()
      .join(",")

    const { data: recentRuns } = await supabaseAdmin
      .from("sixer_runs")
      .select("xi")
      .eq("user_id", userId)
      .eq("mode", mode)
      .gt("created_at", sixtySecondsAgo)

    if (recentRuns) {
      for (const run of recentRuns) {
        const xiArray = (run as { xi: { player_name: string; season_year: number }[] }).xi
        const existingSignature = xiArray
          .map((p: { player_name: string; season_year: number }) => `${p.player_name}|${p.season_year}`)
          .sort()
          .join(",")
        if (existingSignature === submittedSignature) {
          return json({
            error: "Duplicate submission",
            message: "This XI was just submitted. Skipping.",
          }, 409)
        }
      }
    }

    // ── Server-side score computation ─────────────────────────────────────────
    const { sixerScore, rawTeamScore, totalBonus, totalPenalty, wins, losses, tier } = computeScore(resolvedXi, mode)

    // ── Personal best check ───────────────────────────────────────────────────
    // Daily runs are unique per user per day — always a "PB" for that slot
    let previousBest: number | null = null
    let isPersonalBest = true

    if (!is_daily) {
      const { data: bestRow } = await supabaseAdmin
        .from("sixer_runs")
        .select("sixer_score")
        .eq("user_id", userId)
        .eq("mode", mode)
        .eq("is_personal_best", true)
        .maybeSingle()

      if (bestRow) {
        previousBest   = (bestRow as { sixer_score: number }).sixer_score
        isPersonalBest = sixerScore > previousBest
      }

      // ── Unmark old personal best before inserting new one ──────────────────
      if (isPersonalBest && bestRow) {
        await supabaseAdmin
          .from("sixer_runs")
          .update({ is_personal_best: false })
          .eq("user_id", userId)
          .eq("mode", mode)
          .eq("is_personal_best", true)
      }
    }

    // ── Insert run ────────────────────────────────────────────────────────────
    const xiSnapshot = resolvedXi.map(p => ({
      player_name:          p.player_name,
      display_name:         p.display_name,
      role_primary:         p.role_primary,
      role_category:        p.role_category,
      is_overseas:          !!p.is_overseas,
      player_score:         p.player_score,
      avg_batting_position: p.avg_batting_position ?? null,
      season_year:          p.season_year,
      franchise_short:      franchiseShortMap.get(p.franchise_id) ?? null,
    }))

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("sixer_runs")
      .insert({
        user_id:            userId,
        is_guest:           false,
        display_name:       name,
        ip_hash:            null,
        mode,
        sixer_score:        sixerScore,
        raw_team_score:      rawTeamScore,
        style_bonus:        totalBonus,
        structural_penalty: totalPenalty,
        wins,
        losses,
        tier,
        xi:                 xiSnapshot,
        is_personal_best:   isPersonalBest,
        is_daily:           is_daily,
        daily_seed_date:    daily_seed_date,
      })
      .select("id")
      .single()

    if (insertErr || !inserted) {
      console.error("Insert error:", insertErr)
      return json({ error: "Failed to save run." }, 500)
    }

    return json({
      run_id:          (inserted as { id: string }).id,
      sixer_score:     sixerScore,
      wins,
      losses,
      tier,
      is_personal_best: isPersonalBest,
      previous_best:   previousBest,
    })

  } catch (err) {
    console.error("Unexpected error:", err)
    return json({ error: "Unexpected server error." }, 500)
  }
})
