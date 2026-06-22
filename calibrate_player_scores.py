"""
calibrate_player_scores.py

Compute percentile distributions of player stats by role, save to JSON.
Run this once whenever your draftable_pool changes.

Used by season_engine.py for the percentile-based PlayerScore calculation.
"""

import sqlite3
import json

DB_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\sixer\sixer.db"
OUTPUT_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\sixer\player_score_lookups.json"


def build_distributions():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Pull all draftable rows with the stats we need
    cur.execute("""
        SELECT
            dp.role_category,
            dp.role_primary,
            ps.runs_scored,
            ps.batting_average,
            ps.batting_strike_rate,
            ps.wickets_taken,
            ps.bowling_average,
            ps.bowling_economy,
            ps.balls_bowled
        FROM draftable_pool dp
        JOIN player_seasons ps
          ON dp.player_name = ps.player_name
         AND dp.season_year = ps.season_year
    """)

    rows = cur.fetchall()
    conn.close()

    print(f"Calibrating against {len(rows)} player-seasons")
    print()

    # Per-role stat lists
    batter_stats = {"avg": [], "sr": [], "runs": []}
    bowler_stats = {"econ": [], "avg": [], "wkts": []}

    for row in rows:
        (role_cat, role_pri,
         runs, bat_avg, bat_sr,
         wkts, bowl_avg, bowl_econ, balls_bowled) = row

        # Batting stats: from anyone who batted meaningfully
        if role_cat in ("Batter", "Wicketkeeper", "All-Rounder"):
            if bat_avg is not None and runs and runs > 0:
                batter_stats["avg"].append(bat_avg)
            if bat_sr is not None and runs and runs > 0:
                batter_stats["sr"].append(bat_sr)
            if runs is not None:
                batter_stats["runs"].append(runs)

        # Bowling stats: from anyone who bowled meaningfully
        if role_cat in ("Bowler", "All-Rounder"):
            if bowl_econ is not None and bowl_econ > 0:
                bowler_stats["econ"].append(bowl_econ)
            if bowl_avg is not None and bowl_avg > 0:
                bowler_stats["avg"].append(bowl_avg)
            if wkts is not None and wkts > 0:
                bowler_stats["wkts"].append(wkts)

    # Sort distributions for fast percentile lookups
    for stat_list in batter_stats.values():
        stat_list.sort()
    for stat_list in bowler_stats.values():
        stat_list.sort()

    lookups = {
        "batter": batter_stats,
        "bowler": bowler_stats,
    }

    with open(OUTPUT_PATH, "w") as f:
        json.dump(lookups, f)

    # Helper for printing percentiles
    def pct(sorted_list, p):
        if not sorted_list:
            return 0.0
        k = (len(sorted_list) - 1) * (p / 100)
        f = int(k)
        c = min(f + 1, len(sorted_list) - 1)
        return sorted_list[f] + (sorted_list[c] - sorted_list[f]) * (k - f) if f != c else sorted_list[f]

    print("Distribution sizes:")
    print(f"  Batting SR samples:    {len(batter_stats['sr'])}")
    print(f"  Batting avg samples:   {len(batter_stats['avg'])}")
    print(f"  Batting runs samples:  {len(batter_stats['runs'])}")
    print(f"  Bowling econ samples:  {len(bowler_stats['econ'])}")
    print(f"  Bowling avg samples:   {len(bowler_stats['avg'])}")
    print(f"  Bowling wkts samples:  {len(bowler_stats['wkts'])}")

    print("\nBatting SR percentiles:")
    print(f"  p5:   {pct(batter_stats['sr'], 5):.2f}")
    print(f"  p50:  {pct(batter_stats['sr'], 50):.2f}")
    print(f"  p95:  {pct(batter_stats['sr'], 95):.2f}")

    print("\nBatting average percentiles:")
    print(f"  p5:   {pct(batter_stats['avg'], 5):.2f}")
    print(f"  p50:  {pct(batter_stats['avg'], 50):.2f}")
    print(f"  p95:  {pct(batter_stats['avg'], 95):.2f}")

    print("\nBowling economy percentiles (lower = better):")
    print(f"  p5:   {pct(bowler_stats['econ'], 5):.2f}")
    print(f"  p50:  {pct(bowler_stats['econ'], 50):.2f}")
    print(f"  p95:  {pct(bowler_stats['econ'], 95):.2f}")

    print(f"\nSaved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_distributions()