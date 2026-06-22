"""
migrate_to_supabase.py
Migrates sixer.db (SQLite) → Supabase Postgres.

Requirements:
    pip install psycopg2-binary pandas python-dotenv

Environment variable:
    SUPABASE_DB_URL  — Postgres connection string from Supabase dashboard
    e.g. postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres

Usage:
    python migrate_to_supabase.py
"""

import os
import sqlite3
import sys
import time
from math import ceil

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────
SQLITE_PATH  = os.path.join(os.path.dirname(__file__), "sixer.db")
DB_URL       = os.environ.get("SUPABASE_DB_URL")
BATCH_SIZE   = 1000

# ─────────────────────────────────────────────────────────────────────────────
# POSTGRES TABLE DEFINITIONS
# One entry per table: (create_sql, [index_sqls])
# ─────────────────────────────────────────────────────────────────────────────
TABLE_SCHEMAS = {

    "franchises": (
        """
        CREATE TABLE IF NOT EXISTS franchises (
            franchise_id          SERIAL PRIMARY KEY,
            canonical_name        TEXT    NOT NULL UNIQUE,
            short_code            TEXT    NOT NULL,
            primary_color         TEXT    NOT NULL,
            secondary_color       TEXT    NOT NULL,
            all_historical_names  TEXT    NOT NULL,
            active                INTEGER NOT NULL
        )
        """,
        [
            "CREATE INDEX IF NOT EXISTS idx_franchises_name ON franchises(canonical_name)",
        ]
    ),

    "player_seasons": (
        """
        CREATE TABLE IF NOT EXISTS player_seasons (
            id                      SERIAL PRIMARY KEY,
            player_name             TEXT,
            display_name            TEXT,
            season_year             INTEGER,
            team                    TEXT,
            current_franchise       TEXT,
            role                    TEXT,
            matches_played          INTEGER,
            runs_scored             INTEGER,
            balls_faced             INTEGER,
            batting_strike_rate     FLOAT,
            batting_average         FLOAT,
            fours                   INTEGER,
            sixes                   INTEGER,
            wickets_taken           INTEGER,
            balls_bowled            INTEGER,
            runs_conceded           INTEGER,
            bowling_economy         FLOAT,
            bowling_average         FLOAT,
            canonical_franchise     TEXT,
            role_primary            TEXT,
            is_draftable            INTEGER,
            wicketkeeper_override   INTEGER,
            bowling_style_override  TEXT,
            is_overseas             INTEGER DEFAULT 0,
            avg_batting_position    FLOAT
        )
        """,
        [
            """CREATE INDEX IF NOT EXISTS idx_ps_franchise_season_role
               ON player_seasons(canonical_franchise, season_year, role_primary)""",
            "CREATE INDEX IF NOT EXISTS idx_ps_player ON player_seasons(player_name)",
            "CREATE INDEX IF NOT EXISTS idx_ps_season ON player_seasons(season_year)",
        ]
    ),

    "draftable_pool": (
        """
        CREATE TABLE IF NOT EXISTS draftable_pool (
            id                   SERIAL PRIMARY KEY,
            franchise_id         INTEGER REFERENCES franchises(franchise_id),
            season_year          INTEGER NOT NULL,
            role_category        TEXT    NOT NULL,
            player_name          TEXT    NOT NULL,
            display_name         TEXT,
            role_primary         TEXT    NOT NULL,
            season_quality_tier  TEXT    NOT NULL,
            one_line_descriptor  TEXT    NOT NULL,
            player_score         REAL    NOT NULL,
            is_overseas          INTEGER DEFAULT 0,
            avg_batting_position REAL,
            matches_played       INTEGER,
            runs_scored          INTEGER,
            batting_strike_rate  REAL,
            batting_average      REAL,
            wickets_taken        INTEGER,
            bowling_economy      REAL,
            bowling_average      REAL
        )
        """,
        [
            """CREATE INDEX IF NOT EXISTS idx_dp_franchise_season_role
               ON draftable_pool(franchise_id, season_year, role_category)""",
            "CREATE INDEX IF NOT EXISTS idx_dp_season   ON draftable_pool(season_year)",
            "CREATE INDEX IF NOT EXISTS idx_dp_tier     ON draftable_pool(season_quality_tier)",
            "CREATE INDEX IF NOT EXISTS idx_dp_player   ON draftable_pool(player_name)",
        ]
    ),

    "season_highlights": (
        """
        CREATE TABLE IF NOT EXISTS season_highlights (
            id          SERIAL PRIMARY KEY,
            player_name TEXT    NOT NULL,
            season_year INTEGER NOT NULL,
            highlight   TEXT    NOT NULL
        )
        """,
        [
            """CREATE INDEX IF NOT EXISTS idx_sh_player_season
               ON season_highlights(player_name, season_year)""",
        ]
    ),
}

# Migrate in this order so foreign keys resolve correctly
TABLE_ORDER = ["franchises", "player_seasons", "draftable_pool", "season_highlights"]


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def read_sqlite_table(sqlite_conn, table_name):
    """Read full table into a DataFrame. Returns (df, col_names)."""
    df = pd.read_sql_query(f"SELECT * FROM {table_name}", sqlite_conn)
    return df


def pg_col_list(df):
    """Return comma-separated quoted column list, excluding auto-increment 'id'."""
    cols = [c for c in df.columns if c != "id"]
    return ", ".join(f'"{c}"' for c in cols), cols


def insert_batch(pg_cur, table_name, df, cols):
    """Insert a DataFrame slice into Postgres using execute_values."""
    col_str  = ", ".join(f'"{c}"' for c in cols)
    sql      = f'INSERT INTO {table_name} ({col_str}) VALUES %s'
    # Convert DataFrame rows to list of tuples, replacing NaN with None
    records  = [
        tuple(None if pd.isna(v) else v for v in row)
        for row in df[cols].itertuples(index=False, name=None)
    ]
    execute_values(pg_cur, sql, records)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    print("\n========================================")
    print("  SIXER DB → SUPABASE MIGRATION")
    print("========================================")

    # ── Validate env ──────────────────────────────────────────────────────────
    if not DB_URL:
        print("\n  ERROR: SUPABASE_DB_URL environment variable is not set.")
        print("  Add it to a .env file or export it before running:")
        print("    set SUPABASE_DB_URL=postgresql://postgres:PASSWORD@db.XYZ.supabase.co:5432/postgres")
        sys.exit(1)

    if not os.path.exists(SQLITE_PATH):
        print(f"\n  ERROR: SQLite database not found at: {SQLITE_PATH}")
        sys.exit(1)

    print(f"\n  SQLite  : {SQLITE_PATH}")
    print(f"  Postgres: {DB_URL[:40]}...")

    # ── Connect ───────────────────────────────────────────────────────────────
    section("1/4  Connecting")
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    print("  SQLite  : connected")

    pg_conn = psycopg2.connect(DB_URL, connect_timeout=10)
    pg_conn.autocommit = False
    pg_cur  = pg_conn.cursor()
    print("  Postgres: connected")

    # ── Create tables ─────────────────────────────────────────────────────────
    section("2/4  Creating tables and indexes")
    for table in TABLE_ORDER:
        create_sql, index_sqls = TABLE_SCHEMAS[table]
        pg_cur.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
        pg_cur.execute(create_sql)
        for idx_sql in index_sqls:
            pg_cur.execute(idx_sql)
        pg_conn.commit()
        print(f"  {table:<25} — created ({len(index_sqls)} indexes)")

    # ── Migrate data ──────────────────────────────────────────────────────────
    section("3/4  Migrating data")
    sqlite_counts = {}
    pg_counts     = {}

    for table in TABLE_ORDER:
        t0 = time.time()
        print(f"\n  ── {table}")

        df = read_sqlite_table(sqlite_conn, table)
        sqlite_counts[table] = len(df)
        print(f"     SQLite rows : {len(df):,}")

        if df.empty:
            print("     (empty — skipping)")
            pg_counts[table] = 0
            continue

        col_str, cols = pg_col_list(df)
        n_batches = ceil(len(df) / BATCH_SIZE)

        for i in range(n_batches):
            batch = df.iloc[i * BATCH_SIZE : (i + 1) * BATCH_SIZE]
            insert_batch(pg_cur, table, batch, cols)
            pg_conn.commit()
            pct = min(100, (i + 1) / n_batches * 100)
            print(f"     batch {i+1:>3}/{n_batches}  ({pct:.0f}%)", end="\r")

        elapsed = time.time() - t0
        print(f"     Inserted {len(df):,} rows in {elapsed:.1f}s        ")

    # ── Verify row counts ─────────────────────────────────────────────────────
    section("4/4  Verification")
    print(f"  {'Table':<25} {'SQLite':>8}  {'Postgres':>8}  {'Match':>6}")
    print(f"  {'-'*25} {'-'*8}  {'-'*8}  {'-'*6}")

    all_ok = True
    for table in TABLE_ORDER:
        pg_cur.execute(f"SELECT COUNT(*) FROM {table}")
        pg_count = pg_cur.fetchone()[0]
        pg_counts[table] = pg_count
        match = "✓" if pg_count == sqlite_counts[table] else "✗ MISMATCH"
        if match != "✓":
            all_ok = False
        print(f"  {table:<25} {sqlite_counts[table]:>8,}  {pg_count:>8,}  {match:>6}")

    print()
    if all_ok:
        print("  All tables migrated successfully.")
    else:
        print("  WARNING: one or more row counts do not match — check logs above.")

    # ── Close ─────────────────────────────────────────────────────────────────
    sqlite_conn.close()
    pg_cur.close()
    pg_conn.close()

    print("\n========================================")
    print("  Done.")
    print("========================================\n")


if __name__ == "__main__":
    main()
