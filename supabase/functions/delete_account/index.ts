import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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
  if (req.method !== "POST")    return json({ error: "Method not allowed." }, 405)

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
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

    // ── Step 1: anonymize sixer_runs ─────────────────────────────────────────
    // Preserve leaderboard integrity — do NOT hard-delete runs. Null out the
    // user_id, overwrite display_name with a tombstone, and mark as guest so
    // callers can filter them out if needed.
    const { error: runsErr } = await supabaseAdmin
      .from("sixer_runs")
      .update({
        user_id:      null,
        display_name: "[deleted user]",
        is_guest:     true,
      })
      .eq("user_id", userId)

    if (runsErr) {
      console.error("delete_account step 1 error:", runsErr)
      return json({ error: "Failed to anonymize runs.", step: "anonymize_runs" }, 500)
    }

    // ── Step 2: delete user_profiles row ─────────────────────────────────────
    const { error: profileErr } = await supabaseAdmin
      .from("user_profiles")
      .delete()
      .eq("user_id", userId)

    if (profileErr) {
      console.error("delete_account step 2 error:", profileErr)
      return json({ error: "Failed to delete profile.", step: "delete_profile" }, 500)
    }

    // ── Step 3: delete auth.users row ────────────────────────────────────────
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authErr) {
      console.error("delete_account step 3 error:", authErr)
      return json({ error: "Failed to delete auth account.", step: "delete_auth" }, 500)
    }

    return json({ success: true })

  } catch (err) {
    console.error("delete_account unexpected error:", err)
    return json({ error: "Unexpected server error." }, 500)
  }
})
