-- Run this in the Supabase SQL editor (dashboard.supabase.com → SQL Editor)

-- ── user_profiles ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id      UUID  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT  NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT display_name_length CHECK (char_length(display_name) BETWEEN 2 AND 24),
  CONSTRAINT display_name_chars  CHECK (display_name ~ '^[a-zA-Z0-9 ._-]+$')
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read"         ON public.user_profiles FOR SELECT USING (true);
CREATE POLICY "Own insert"          ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own update"          ON public.user_profiles FOR UPDATE USING (auth.uid() = user_id);

-- ── sixer_runs ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sixer_runs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name        TEXT        NOT NULL,
  ip_hash             TEXT,
  mode                TEXT        NOT NULL,
  sixer_score         REAL        NOT NULL,
  raw_team_score      REAL        NOT NULL,
  style_bonus         INTEGER     NOT NULL,
  structural_penalty  INTEGER     NOT NULL,
  wins                INTEGER     NOT NULL,
  losses              INTEGER     NOT NULL,
  tier                TEXT        NOT NULL,
  xi                  JSONB       NOT NULL,
  is_personal_best    BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sixer_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read"   ON public.sixer_runs FOR SELECT USING (true);
-- Inserts are handled exclusively via the submit_run Edge Function (service role key).
-- Direct anon/user inserts are intentionally blocked to prevent score tampering.

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS sixer_runs_user_id_idx         ON public.sixer_runs (user_id);
CREATE INDEX IF NOT EXISTS sixer_runs_sixer_score_idx     ON public.sixer_runs (sixer_score DESC);
CREATE INDEX IF NOT EXISTS sixer_runs_created_at_idx    ON public.sixer_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS sixer_runs_mode_score_idx      ON public.sixer_runs (mode, sixer_score DESC);
