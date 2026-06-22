"""
backfill_draftable_pool_stats.py
Adds and populates player stat columns in draftable_pool by joining player_seasons.

Requirements:
    pip install psycopg2-binary python-dotenv

Environment variable:
    SUPABASE_DB_URL  — Postgres connection string

Usage:
    python backfill_draftable_pool_stats.py
"""

import os
import sys
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.environ.get("SUPABASE_DB_URL")


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def add_column_safe(cur, table, column, col_type):
    """Add a column if it doesn't already exist. Safe to run twice."""
    try:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        return True   # added
    except psycopg2.errors.DuplicateColumn:
        cur.connection.rollback()
        return False  # already existed


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — ADD COLUMNS
# ─────────────────────────────────────────────────────────────────────────────
NEW_COLUMNS = [
    ("matches_played",      "INTEGER"),
    ("runs_scored",         "INTEGER"),
    ("batting_average",     "FLOAT"),
    ("batting_strike_rate", "FLOAT"),
    ("wickets_taken",       "INTEGER"),
    ("bowling_average",     "FLOAT"),
    ("bowling_economy",     "FLOAT"),
    ("is_wicketkeeper",     "BOOLEAN DEFAULT FALSE"),
]

def add_columns(conn):
    section("1/5  Adding columns to draftable_pool")
    cur = conn.cursor()
    for col, col_type in NEW_COLUMNS:
        added = add_column_safe(cur, "draftable_pool", col, col_type)
        status = "added" if added else "already exists"
        print(f"  {col:<28} — {status}")
        conn.commit()
    cur.close()


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — BACKFILL STATS  (single UPDATE … FROM join)
# ─────────────────────────────────────────────────────────────────────────────
def backfill_stats(conn):
    section("2/5  Backfilling stats from player_seasons")
    cur = conn.cursor()

    # Join key:
    #   draftable_pool.player_name  = player_seasons.player_name
    #   draftable_pool.season_year  = player_seasons.season_year
    #   draftable_pool.franchise_id = franchises.franchise_id
    #                               → franchises.canonical_name
    #                               = player_seasons.canonical_franchise
    #
    # The draftable_pool was built from player_seasons so this join
    # should be 1-to-1 for every row.

    sql = """
        UPDATE draftable_pool dp
        SET
            matches_played      = ps.matches_played,
            runs_scored         = ps.runs_scored,
            batting_average     = ps.batting_average,
            batting_strike_rate = ps.batting_strike_rate,
            wickets_taken       = ps.wickets_taken,
            bowling_average     = ps.bowling_average,
            bowling_economy     = ps.bowling_economy,
            is_wicketkeeper     = (
                ps.role_primary = 'Wicketkeeper'
                OR ps.wicketkeeper_override = 1
            )
        FROM player_seasons ps
        JOIN franchises f
          ON f.canonical_name = ps.canonical_franchise
        WHERE dp.player_name = ps.player_name
          AND dp.season_year  = ps.season_year
          AND dp.franchise_id = f.franchise_id
    """

    cur.execute(sql)
    updated = cur.rowcount
    conn.commit()
    print(f"  Rows updated: {updated:,}")

    # Check how many rows are still NULL after the join
    cur.execute("""
        SELECT COUNT(*) FROM draftable_pool
        WHERE matches_played IS NULL
    """)
    null_count = cur.fetchone()[0]
    if null_count > 0:
        print(f"  WARNING: {null_count} rows still have NULL matches_played after join.")
        print("  These likely have a franchise_id mismatch. Investigating...")
        cur.execute("""
            SELECT dp.player_name, dp.season_year, dp.franchise_id,
                   dp.role_category
            FROM draftable_pool dp
            WHERE dp.matches_played IS NULL
            LIMIT 10
        """)
        for row in cur.fetchall():
            print(f"    {row}")
    else:
        print("  All rows populated — no NULLs in matches_played.")

    cur.close()


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — CREATE INDEX
# ─────────────────────────────────────────────────────────────────────────────
def create_index(conn):
    section("3/5  Creating composite index")
    cur = conn.cursor()
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_dp_franchise_season
        ON draftable_pool(franchise_id, season_year)
    """)
    conn.commit()
    print("  Index idx_dp_franchise_season — created (or already exists)")
    cur.close()


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — VERIFY
# ─────────────────────────────────────────────────────────────────────────────
def verify(conn):
    section("4/5  Verification queries")
    cur = conn.cursor()

    # ── 5 random rows ────────────────────────────────────────────────────────
    print("\n  ── 5 random rows (all new columns)")
    cur.execute("""
        SELECT player_name, season_year, role_category,
               matches_played, runs_scored,
               ROUND(batting_average::numeric,    2) AS bat_avg,
               ROUND(batting_strike_rate::numeric, 2) AS bat_sr,
               wickets_taken,
               ROUND(bowling_average::numeric,    2) AS bowl_avg,
               ROUND(bowling_economy::numeric,    2) AS bowl_econ,
               is_wicketkeeper
        FROM draftable_pool
        ORDER BY RANDOM()
        LIMIT 5
    """)
    _print_rows(cur)

    # ── Virat Kohli 2016 ─────────────────────────────────────────────────────
    print("\n  ── Virat Kohli 2016 (expect: runs=973, avg=81.08, sr=152.03, m=16)")
    cur.execute("""
        SELECT player_name, season_year,
               matches_played, runs_scored,
               ROUND(batting_average::numeric,    2) AS bat_avg,
               ROUND(batting_strike_rate::numeric, 2) AS bat_sr,
               wickets_taken, is_wicketkeeper
        FROM draftable_pool
        WHERE player_name = 'V Kohli' AND season_year = 2016
    """)
    _print_rows(cur)

    # ── Jasprit Bumrah 2020 ──────────────────────────────────────────────────
    print("\n  ── Jasprit Bumrah 2020 (expect: wkts=27, avg≈14.96, econ≈6.73)")
    cur.execute("""
        SELECT player_name, season_year,
               matches_played, wickets_taken,
               ROUND(bowling_average::numeric, 2) AS bowl_avg,
               ROUND(bowling_economy::numeric, 2) AS bowl_econ,
               runs_scored, is_wicketkeeper
        FROM draftable_pool
        WHERE player_name = 'JJ Bumrah' AND season_year = 2020
    """)
    _print_rows(cur)

    # ── MS Dhoni 2013 ────────────────────────────────────────────────────────
    print("\n  ── MS Dhoni 2013 CSK (expect: is_wicketkeeper=true)")
    cur.execute("""
        SELECT player_name, season_year,
               matches_played, runs_scored,
               ROUND(batting_average::numeric, 2) AS bat_avg,
               ROUND(batting_strike_rate::numeric, 2) AS bat_sr,
               is_wicketkeeper
        FROM draftable_pool
        WHERE player_name = 'MS Dhoni' AND season_year = 2013
    """)
    _print_rows(cur)

    # ── NULL batting stats count ──────────────────────────────────────────────
    print("\n  ── NULL batting stats (should be mostly pure bowlers)")
    cur.execute("""
        SELECT role_category, COUNT(*) AS null_batting_rows
        FROM draftable_pool
        WHERE batting_strike_rate IS NULL
        GROUP BY role_category
        ORDER BY null_batting_rows DESC
    """)
    rows = cur.fetchall()
    print(f"  {'Role':<20} {'Rows with NULL batting SR':>24}")
    print(f"  {'-'*20} {'-'*24}")
    for role, cnt in rows:
        print(f"  {role:<20} {cnt:>24,}")

    cur.close()


def _print_rows(cur):
    """Print query results with column headers."""
    if cur.description is None:
        print("  (no results)")
        return
    cols = [d[0] for d in cur.description]
    rows = cur.fetchall()
    if not rows:
        print("  (no rows returned)")
        return
    col_widths = [max(len(str(c)), max((len(str(r[i] or "")) for r in rows), default=0))
                  for i, c in enumerate(cols)]
    header = "  " + "  ".join(str(c).ljust(col_widths[i]) for i, c in enumerate(cols))
    divider = "  " + "  ".join("-" * w for w in col_widths)
    print(header)
    print(divider)
    for row in rows:
        print("  " + "  ".join(str(v or "").ljust(col_widths[i]) for i, v in enumerate(row)))


# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
def summary(conn):
    section("5/5  Final summary")
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM draftable_pool")
    total = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM draftable_pool WHERE matches_played IS NOT NULL")
    populated = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM draftable_pool WHERE is_wicketkeeper = TRUE")
    keepers = cur.fetchone()[0]

    cur.execute("""
        SELECT season_quality_tier, COUNT(*)
        FROM draftable_pool
        GROUP BY season_quality_tier
        ORDER BY season_quality_tier
    """)
    tiers = cur.fetchall()

    print(f"  Total rows          : {total:,}")
    print(f"  Rows with stats     : {populated:,}  ({populated/total*100:.1f}%)")
    print(f"  Wicketkeeper rows   : {keepers:,}")
    print()
    print(f"  {'Tier':<12} {'Count':>6}")
    print(f"  {'-'*12} {'-'*6}")
    for tier, cnt in tiers:
        print(f"  {tier:<12} {cnt:>6,}")

    cur.close()


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    print("\n========================================")
    print("  BACKFILL DRAFTABLE POOL STATS")
    print("========================================")

    if not DB_URL:
        print("\n  ERROR: SUPABASE_DB_URL is not set.")
        print("  Add it to a .env file:")
        print("  SUPABASE_DB_URL=postgresql://postgres:PASSWORD@db.XYZ.supabase.co:5432/postgres")
        sys.exit(1)

    print(f"\n  Connecting to: {DB_URL[:45]}...")
    conn = psycopg2.connect(DB_URL, connect_timeout=10)
    conn.autocommit = False
    print("  Connected.")

    add_columns(conn)
    backfill_stats(conn)
    create_index(conn)
    verify(conn)
    summary(conn)

    conn.close()
    print("\n========================================")
    print("  Done.")
    print("========================================\n")


if __name__ == "__main__":
    main()
