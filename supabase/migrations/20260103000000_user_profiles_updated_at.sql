-- Run in Supabase SQL Editor after the initial migration.

-- Add updated_at to user_profiles for 30-day rename cooldown tracking.
-- DEFAULT NOW() seeds all existing rows with the current timestamp so the
-- first rename is always allowed (updated_at == created_at at creation time).

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── Optional trigger (recommended) ───────────────────────────────────────────
-- Auto-bumps updated_at on every UPDATE so we never forget to set it manually.
-- The Edge Function also sets it explicitly as a belt-and-suspenders measure.

CREATE OR REPLACE FUNCTION touch_user_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION touch_user_profiles_updated_at();
