"""
build_draftable_pool.py

Creates the game-facing draftable_pool table in sixer.db.

Tiers are now derived directly from PlayerScore (computed by season_engine.py)
so there's one source of truth for player quality.

Usage:
    python build_draftable_pool.py
"""

import os
import sqlite3
from collections import defaultdict

# Import from your engine so tiers stay in sync
from season_engine import compute_player_score, tier_from_player_score

DB_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\sixer\sixer.db"


# ─────────────────────────────────────────────────────────────────────────────
# ROLE CATEGORY MAPPING
# ─────────────────────────────────────────────────────────────────────────────

def map_role_category(role_primary):
    if role_primary in ("Top-Order Batter", "Middle-Order Batter", "Finisher"):
        return "Batter"
    elif role_primary == "Wicketkeeper":
        return "Wicketkeeper"
    elif role_primary in ("Spin Bowler", "Pace Bowler"):
        return "Bowler"
    elif role_primary in ("Batting All-Rounder", "Bowling All-Rounder"):
        return "All-Rounder"
    return None


# ─────────────────────────────────────────────────────────────────────────────
# ONE-LINE DESCRIPTOR  (unchanged — keeps both batting & bowling averages)
# ─────────────────────────────────────────────────────────────────────────────

def make_descriptor(row_dict, role_category):
    runs = row_dict.get("runs_scored") or 0
    sr = row_dict.get("batting_strike_rate")
    bat_avg = row_dict.get("batting_average")
    sixes = row_dict.get("sixes") or 0
    wickets = row_dict.get("wickets_taken") or 0
    economy = row_dict.get("bowling_economy")
    bowl_avg = row_dict.get("bowling_average")
    matches = row_dict.get("matches_played") or 0
    balls_b = row_dict.get("balls_bowled") or 0

    def fmt(val, dp=1):
        return f"{val:.{dp}f}" if val is not None else "—"

    if role_category == "Batter":
        parts = [f"{runs} runs"]
        if sr is not None:
            parts.append(f"SR {fmt(sr)}")
        if bat_avg is not None:
            parts.append(f"avg {fmt(bat_avg)}")
        if sixes > 0:
            parts.append(f"{sixes} sixes")
        return " | ".join(parts)

    elif role_category == "Wicketkeeper":
        parts = [f"{runs} runs"]
        if sr is not None:
            parts.append(f"SR {fmt(sr)}")
        if bat_avg is not None:
            parts.append(f"avg {fmt(bat_avg)}")
        return " | ".join(parts)

    elif role_category == "Bowler":
        overs = balls_b / 6.0 if balls_b else 0.0
        parts = [f"{wickets} wkts"]
        if economy is not None:
            parts.append(f"econ {fmt(economy)}")
        if bowl_avg is not None:
            parts.append(f"avg {fmt(bowl_avg)}")
        if overs > 0:
            parts.append(f"{overs:.1f} ovs")
        return " | ".join(parts)

    elif role_category == "All-Rounder":
        bat_part = f"{runs} runs"
        if sr is not None:
            bat_part += f" SR {fmt(sr)}"
        if bat_avg is not None:
            bat_part += f" avg {fmt(bat_avg)}"
        bowl_part = f"{wickets} wkts"
        if economy is not None:
            bowl_part += f" econ {fmt(economy)}"
        if bowl_avg is not None:
            bowl_part += f" avg {fmt(bowl_avg)}"
        return f"{bat_part} | {bowl_part}"

    return f"{matches} matches"


# ─────────────────────────────────────────────────────────────────────────────
# BUILD TABLE
# ─────────────────────────────────────────────────────────────────────────────

def build_pool(conn):
    cur = conn.cursor()

    cur.execute("DROP TABLE IF EXISTS draftable_pool")
    cur.execute("""
        CREATE TABLE draftable_pool (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            franchise_id INTEGER,
            season_year INTEGER NOT NULL,
            role_category TEXT NOT NULL,
            player_name TEXT NOT NULL,
            display_name TEXT,
            role_primary TEXT NOT NULL,
            season_quality_tier TEXT NOT NULL,
            one_line_descriptor TEXT NOT NULL,
            player_score REAL NOT NULL,
            is_overseas INTEGER DEFAULT 0,
            avg_batting_position REAL,
            matches_played INTEGER,
            runs_scored INTEGER,
            batting_strike_rate REAL,
            batting_average REAL,
            wickets_taken INTEGER,
            bowling_economy REAL,   
            bowling_average REAL,
            FOREIGN KEY (franchise_id) REFERENCES franchises(franchise_id)
        )
    """)

    # Fetch all draftable rows
    cur.execute("""
        SELECT
            ps.id,
            f.franchise_id,
            ps.season_year,
            ps.player_name,
            ps.role_primary,
            ps.runs_scored,
            ps.balls_faced,
            ps.batting_strike_rate,
            ps.batting_average,
            ps.fours,
            ps.sixes,
            ps.wickets_taken,
            ps.balls_bowled,
            ps.runs_conceded,
            ps.bowling_economy,
            ps.bowling_average,
            ps.matches_played,
            ps.is_overseas,
            ps.display_name,
            ps.wicketkeeper_override,
            ps.avg_batting_position
        FROM player_seasons ps
        LEFT JOIN franchises f
          ON ps.canonical_franchise = f.canonical_name
        WHERE ps.is_draftable = 1
        ORDER BY ps.season_year, ps.player_name
    """)

    cols = [d[0] for d in cur.description]
    all_rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    print(f"  Fetched {len(all_rows):,} draftable player-season rows.")

    insert_rows = []
    for row in all_rows:
        role_cat = map_role_category(row["role_primary"])
        if role_cat is None:
            continue

        # Build the player dict the engine expects
        player_dict = {
            "role_primary": row["role_primary"],
            "role_category": role_cat,
            "is_wicketkeeper": bool(row.get("wicketkeeper_override")) or (row["role_primary"] == "Wicketkeeper"),
            "runs_scored": row.get("runs_scored") or 0,
            "matches_played": row.get("matches_played") or 0,
            "batting_strike_rate": row.get("batting_strike_rate") or 0.0,
            "batting_average": row.get("batting_average"),
            "wickets_taken": row.get("wickets_taken") or 0,
            "bowling_average": row.get("bowling_average"),
            "is_overseas": bool(row.get("is_overseas", 0)),
            "bowling_economy": row.get("bowling_economy"),
        }

        # Compute PlayerScore and tier from the engine
        score = compute_player_score(player_dict)
        tier = tier_from_player_score(score)
        descriptor = make_descriptor(row, role_cat)

        insert_rows.append((
            row["franchise_id"],
            row["season_year"],
            role_cat,
            row["player_name"],
            row.get("display_name") or row["player_name"],
            row["role_primary"],
            tier,
            descriptor,
            1 if row.get("is_overseas") else 0,
            round(score, 2),
            row.get("avg_batting_position"),
            row.get("matches_played"),
            row.get("runs_scored"),
            row.get("batting_strike_rate"),
            row.get("batting_average"),
            row.get("wickets_taken"),
            row.get("bowling_economy"),
            row.get("bowling_average"),
        ))

    cur.executemany("""
        INSERT INTO draftable_pool
              (franchise_id, season_year, role_category, player_name, display_name,
             role_primary, season_quality_tier, one_line_descriptor, is_overseas, player_score, avg_batting_position,
             matches_played, runs_scored, batting_strike_rate, batting_average,
             wickets_taken, bowling_economy, bowling_average)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, insert_rows)

    cur.execute("CREATE INDEX idx_dp_season ON draftable_pool(season_year)")
    cur.execute("CREATE INDEX idx_dp_franchise ON draftable_pool(franchise_id)")
    cur.execute("CREATE INDEX idx_dp_role ON draftable_pool(role_category)")
    cur.execute("CREATE INDEX idx_dp_tier ON draftable_pool(season_quality_tier)")
    cur.execute("CREATE INDEX idx_dp_score ON draftable_pool(player_score)")

    conn.commit()
    print(f"  Inserted {len(insert_rows):,} rows into draftable_pool.\n")
    return len(insert_rows)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n========================================")
    print(" BUILD DRAFTABLE POOL")
    print("========================================\n")

    if not os.path.exists(DB_PATH):
        print(f" ERROR: sixer.db not found at:\n  {DB_PATH}")
        raise SystemExit(1)

    conn = sqlite3.connect(DB_PATH)
    print("Building draftable_pool table...")
    total = build_pool(conn)
    print(f" Total rows: {total:,}")

    cur = conn.cursor()
    print("\nTier distribution:")
    cur.execute("""
        SELECT season_quality_tier, role_category, COUNT(*)
        FROM draftable_pool
        GROUP BY season_quality_tier, role_category
        ORDER BY
            CASE season_quality_tier
                WHEN 'Legendary' THEN 1
                WHEN 'Excellent' THEN 2
                WHEN 'Good' THEN 3
                WHEN 'Average' THEN 4
                WHEN 'Poor' THEN 5
            END,
            role_category
    """)
    print(f"  {'Tier':<12} {'Role':<16} {'Count':>6}")
    print(f"  {'-'*12} {'-'*16} {'-'*6}")
    for tier, rc, cnt in cur.fetchall():
        print(f"  {tier:<12} {rc:<16} {cnt:>6}")

    # Sanity check on a few known players
    print("\nSpot-check known players:")
    cur.execute("""
        SELECT player_name, season_year, role_primary, season_quality_tier, player_score
        FROM draftable_pool
        WHERE player_name IN ('V Kohli', 'JJ Bumrah', 'AD Russell', 'SP Narine', 'MS Dhoni')
          AND season_year IN (2013, 2016, 2018, 2019, 2020)
        ORDER BY player_name, season_year
    """)
    print(f"  {'Player':<20} {'Year':<6} {'Role':<22} {'Tier':<12} {'Score'}")
    for name, year, role, tier, score in cur.fetchall():
        print(f"  {name:<20} {year:<6} {role:<22} {tier:<12} {score:.2f}")

    conn.close()
    print("\n========================================")
    print(" Done.")
    print("========================================\n")