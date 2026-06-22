-- Sixer Daily: schema additions
ALTER TABLE sixer_runs
  ADD COLUMN IF NOT EXISTS daily_seed_date DATE,
  ADD COLUMN IF NOT EXISTS is_daily BOOLEAN NOT NULL DEFAULT FALSE;

-- One daily per signed-in user per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_sixer_runs_daily_user
  ON sixer_runs (user_id, daily_seed_date)
  WHERE is_daily = TRUE AND user_id IS NOT NULL;

-- One daily per guest identity (ip_hash) per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_sixer_runs_daily_guest
  ON sixer_runs (ip_hash, daily_seed_date)
  WHERE is_daily = TRUE AND user_id IS NULL;

-- Fast daily leaderboard lookup
CREATE INDEX IF NOT EXISTS idx_sixer_runs_daily_lookup
  ON sixer_runs (daily_seed_date, sixer_score DESC)
  WHERE is_daily = TRUE;
