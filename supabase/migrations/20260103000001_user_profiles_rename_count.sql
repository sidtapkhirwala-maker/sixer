-- Adds an explicit rename counter to replace the fragile updated_at > created_at heuristic.
-- DEFAULT 0 means all existing users start with no cooldown on their first rename.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS rename_count INTEGER NOT NULL DEFAULT 0;

-- ── Optional backfill ─────────────────────────────────────────────────────────
-- Set rename_count = 1 for users whose updated_at is more than 60 seconds after
-- created_at, which indicates they likely renamed before this column was added.
-- Skip if your user base is empty or too small to need it.

-- UPDATE public.user_profiles
-- SET rename_count = 1
-- WHERE EXTRACT(EPOCH FROM (updated_at - created_at)) > 60
--   AND rename_count = 0;
