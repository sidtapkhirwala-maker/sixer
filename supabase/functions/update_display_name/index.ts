import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { isProfane } from "../_shared/profanity.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  try {
    const { new_name } = await req.json()

    // ── Validate input ────────────────────────────────────────────────────────
    const trimmed = (new_name ?? "").toString().trim()
    if (trimmed.length < 2 || trimmed.length > 24) {
      return json({ error: "Name must be 2–24 characters." }, 400)
    }
    if (!/^[a-zA-Z0-9 ._-]+$/.test(trimmed)) {
      return json({ error: "Name contains invalid characters." }, 400)
    }
    if (isProfane(trimmed)) {
      return json({ error: "Name not allowed." }, 400)
    }

    // ── Auth check ────────────────────────────────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Sign in required." }, 401)
    }
    const { data: userData } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
    const userId = userData.user?.id
    if (!userId) return json({ error: "Sign in required." }, 401)

    // ── Cooldown check ────────────────────────────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("display_name, updated_at, rename_count")
      .eq("user_id", userId)
      .single()

    if (!profile) return json({ error: "Profile not found." }, 404)

    const renameCount = (profile as { rename_count: number }).rename_count ?? 0
    const updated     = new Date((profile as { updated_at: string }).updated_at).getTime()

    if (renameCount > 0) {
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
      const nextAllowed  = updated + thirtyDaysMs
      if (Date.now() < nextAllowed) {
        return json({
          error:        "Rename cooldown active.",
          next_allowed: new Date(nextAllowed).toISOString(),
        }, 429)
      }
    }

    // ── Update user_profiles ──────────────────────────────────────────────────
    // Set updated_at explicitly; the trigger also bumps it as a safeguard.
    const { error: profileErr } = await supabaseAdmin
      .from("user_profiles")
      .update({
        display_name: trimmed,
        updated_at:   new Date().toISOString(),
        rename_count: renameCount + 1,
      })
      .eq("user_id", userId)

    if (profileErr) return json({ error: "Failed to update profile." }, 500)

    // ── Backfill historical runs ──────────────────────────────────────────────
    const { error: runsErr } = await supabaseAdmin
      .from("sixer_runs")
      .update({ display_name: trimmed })
      .eq("user_id", userId)

    if (runsErr) {
      return json({
        error:   "Profile updated but historical runs couldn't be renamed.",
        warning: true,
      }, 500)
    }

    return json({
      ok:                  true,
      display_name:        trimmed,
      next_rename_allowed: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })

  } catch (err) {
    console.error("update_display_name error:", err)
    return json({ error: "Unexpected server error." }, 500)
  }
})
