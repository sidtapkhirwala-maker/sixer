"""
find_player.py

Quick search for a player by name fragment and see all their seasons.
Usage:
    python find_player.py Dinda
    python find_player.py Pant
    python find_player.py "P Patel"
"""

import sqlite3
import sys

DB_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\sixer\sixer.db"


def search(name_fragment):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Search both tables to find any mention
    cur.execute("""
        SELECT DISTINCT
            ps.player_name,
            ps.season_year,
            ps.canonical_franchise,
            dp.role_category,
            dp.season_quality_tier
        FROM player_seasons ps
        LEFT JOIN draftable_pool dp
          ON ps.player_name = dp.player_name
         AND ps.season_year = dp.season_year
        WHERE ps.player_name LIKE ?
        ORDER BY ps.player_name, ps.season_year
    """, (f"%{name_fragment}%",))

    rows = cur.fetchall()

    if not rows:
        print(f"  No matches for '{name_fragment}'")
    else:
        print(f"  Matches for '{name_fragment}':")
        print(f"  {'Name':<24} {'Year':<6} {'Team':<28} {'Role':<14} {'Tier'}")
        print(f"  {'-'*24} {'-'*6} {'-'*28} {'-'*14} {'-'*10}")
        for name, year, franchise, role, tier in rows:
            in_pool = "✓" if role else "✗ (not draftable)"
            role_str = role or in_pool
            tier_str = tier or "—"
            print(f"  {name:<24} {year:<6} {(franchise or ''):<28} {role_str:<14} {tier_str}")

    conn.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python find_player.py <name_fragment>")
        sys.exit(1)
    search(" ".join(sys.argv[1:]))


   