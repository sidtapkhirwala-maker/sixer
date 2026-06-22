-- Run this in the Supabase SQL Editor AFTER the initial migration.
-- dashboard.supabase.com → SQL Editor

-- ── leaderboard_today ──────────────────────────────────────────────────────────
-- Returns the single best run per identity (user_id for auth'd drafters,
-- display_name|ip_hash for guests) submitted today (midnight IST), ordered
-- by sixer_score DESC. Capped at 100 rows.

CREATE OR REPLACE FUNCTION leaderboard_today(p_mode TEXT)
RETURNS TABLE (
  id           UUID,
  display_name TEXT,
  user_id      UUID,
  sixer_score  REAL,
  wins         INTEGER,
  losses       INTEGER,
  tier         TEXT,
  xi           JSONB,
  created_at   TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    sub.id, sub.display_name, sub.user_id,
    sub.sixer_score, sub.wins, sub.losses,
    sub.tier, sub.xi, sub.created_at
  FROM (
    SELECT DISTINCT ON (
      COALESCE(r.user_id::text, r.display_name || '|' || COALESCE(r.ip_hash, ''))
    )
      r.id, r.display_name, r.user_id,
      r.sixer_score, r.wins, r.losses,
      r.tier, r.xi, r.created_at
    FROM public.sixer_runs r
    WHERE r.mode = p_mode
      AND r.created_at >= date_trunc(
            'day',
            now() AT TIME ZONE 'Asia/Kolkata'
          ) AT TIME ZONE 'Asia/Kolkata'
    ORDER BY
      COALESCE(r.user_id::text, r.display_name || '|' || COALESCE(r.ip_hash, '')),
      r.sixer_score DESC,
      r.created_at ASC
  ) sub
  ORDER BY sub.sixer_score DESC, sub.created_at ASC
  LIMIT 100;
$$;

GRANT EXECUTE ON FUNCTION leaderboard_today(TEXT) TO anon, authenticated;


-- ── user_rank ─────────────────────────────────────────────────────────────────
-- Given a specific run_id, returns how many other identities have a higher
-- score in the same mode/scope (1-indexed). Uses the run's own sixer_score
-- for the comparison so the result is meaningful even for non-PB runs.

CREATE OR REPLACE FUNCTION user_rank(p_mode TEXT, p_scope TEXT, p_run_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH target AS (
    SELECT sixer_score
    FROM public.sixer_runs
    WHERE id = p_run_id
  ),
  pool AS (
    SELECT
      MAX(r.sixer_score) AS best_score
    FROM public.sixer_runs r
    WHERE r.mode = p_mode
      AND (
        p_scope != 'today'
        OR r.created_at >= date_trunc(
              'day',
              now() AT TIME ZONE 'Asia/Kolkata'
            ) AT TIME ZONE 'Asia/Kolkata'
      )
    GROUP BY COALESCE(r.user_id::text, r.display_name || '|' || COALESCE(r.ip_hash, ''))
  )
  SELECT (COUNT(*) + 1)::integer
  FROM pool
  WHERE best_score > (SELECT sixer_score FROM target);
$$;

GRANT EXECUTE ON FUNCTION user_rank(TEXT, TEXT, UUID) TO anon, authenticated;