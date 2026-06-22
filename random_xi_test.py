"""
test_16_0_difficulty.py

Measures how rare a 16-0 finish is across random legal XIs.

Two modes:
  1. UNIFORM — XIs drawn uniformly from the draftable pool (every player
     equally likely). Models a maximally chaotic user.
  2. WEIGHTED — XIs drawn with bias toward higher PlayerScores. Models
     a user who recognizes and picks elite players.

Both respect:
  - Role composition (1 WK, 4 batters, 2 spinners, 2 pacers, 2 ARs)
  - Max 4 overseas players
  - No duplicate player names

PlayerScores are cached once at startup, not recomputed in the hot loop.
"""

import sqlite3
import random
import argparse
import time
from collections import Counter
from season_engine import evaluate_xi, compute_player_score

DB_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\sixer\sixer.db"

N_XIS = 5000
MAX_OVERSEAS = 4
COMPOSITION = {
    "wicketkeeper": 1,
    "batter": 4,
    "spinner": 2,
    "pacer": 2,
    "all_rounder": 2,
}


def fetch_all_draftable(conn):
    """Pull every draftable player-season with the fields we need."""
    cur = conn.cursor()
    cur.execute("""
        SELECT
            dp.player_name, dp.display_name, dp.season_year,
            dp.role_primary, dp.role_category, dp.season_quality_tier,
            ps.canonical_franchise,
            ps.runs_scored, ps.matches_played, ps.batting_strike_rate,
            ps.batting_average, ps.fours, ps.sixes, ps.balls_faced,
            ps.wickets_taken, ps.bowling_average, ps.bowling_economy,
            ps.balls_bowled, ps.wicketkeeper_override,
            ps.avg_batting_position, ps.is_overseas
        FROM draftable_pool dp
        JOIN player_seasons ps
          ON dp.player_name = ps.player_name
         AND dp.season_year = ps.season_year
    """)
    pool = []
    for row in cur.fetchall():
        (name, display_name, year, role_pri, role_cat, tier, franchise,
         runs, matches, bat_sr, bat_avg, fours, sixes, balls_faced,
         wickets, bowl_avg, bowl_econ, balls_bowled, wk_override,
         avg_bat_pos, is_overseas) = row
        pool.append({
            "player_name": name,
            "display_name": display_name or name,
            "season_year": year,
            "role_primary": role_pri,
            "role_category": role_cat,
            "season_quality_tier": tier,
            "franchise": franchise or "",
            "is_overseas": bool(is_overseas),
            "is_wicketkeeper": bool(wk_override) or (role_pri == "Wicketkeeper"),
            "runs_scored": runs or 0,
            "matches_played": matches or 0,
            "batting_strike_rate": bat_sr or 0.0,
            "batting_average": bat_avg,
            "fours": fours or 0,
            "sixes": sixes or 0,
            "balls_faced": balls_faced or 0,
            "wickets_taken": wickets or 0,
            "bowling_average": bowl_avg,
            "bowling_economy": bowl_econ,
            "overs_bowled": (balls_bowled or 0) / 6.0,
            "avg_batting_position": avg_bat_pos,
        })
    return pool


def precompute_scores(pool):
    """
    Compute and cache each player's PlayerScore exactly once.
    Stored on the dict as '_score' so the hot loop can read it directly
    instead of recomputing thousands of percentile ranks per pick.
    """
    for p in pool:
        p["_score"] = compute_player_score(p)


def build_role_pools(pool):
    """Bucket every draftable player into exactly one role pool."""
    pools = {
        "wicketkeeper": [],
        "batter": [],
        "all_rounder": [],
        "spinner": [],
        "pacer": [],
    }
    for p in pool:
        role_pri = p["role_primary"]
        role_cat = p["role_category"]
        is_wk = p["is_wicketkeeper"]
        if is_wk or role_cat == "Wicketkeeper":
            pools["wicketkeeper"].append(p)
        elif role_cat == "Batter":
            pools["batter"].append(p)
        elif role_cat == "All-Rounder":
            pools["all_rounder"].append(p)
        elif role_pri == "Spin Bowler":
            pools["spinner"].append(p)
        elif role_pri == "Pace Bowler":
            pools["pacer"].append(p)
    return pools


def build_xi(pools, rng, mode="uniform", max_overseas=MAX_OVERSEAS):
    """
    Build one random XI respecting composition + cap + no duplicates.

    mode='uniform'   → every player in role pool equally likely
    mode='weighted'  → higher cached PlayerScore = higher pick probability

    Assumes each player dict has a '_score' key (set by precompute_scores).
    """
    xi = []
    used_names = set()
    overseas_count = 0

    # Fill rarer roles first so the cap doesn't accidentally exhaust them
    ordered_slots = sorted(
        COMPOSITION.items(),
        key=lambda kv: len(pools.get(kv[0], []))
    )

    for slot_name, count in ordered_slots:
        for _ in range(count):
            available = [
                p for p in pools[slot_name]
                if p["player_name"] not in used_names
                and (not p["is_overseas"] or overseas_count < max_overseas)
            ]
            if not available:
                return None

            if mode == "uniform":
                pick = rng.choice(available)
            elif mode == "weighted":
                # Cached score — no recomputation in the hot loop
                weights = [max(p["_score"], 0.1) ** 2 for p in available]
                pick = rng.choices(available, weights=weights, k=1)[0]
            else:
                raise ValueError(f"Unknown mode: {mode}")

            used_names.add(pick["player_name"])
            if pick["is_overseas"]:
                overseas_count += 1
            xi.append(pick)

    return xi


def run_test(pool, mode, n_xis):
    """Generate n XIs in given mode and report 16-0 rate + score distribution."""
    pools = build_role_pools(pool)
    rng = random.Random()

    results = []
    record_counts = Counter()
    tier_counts = Counter()
    failed = 0

    t0 = time.time()
    for i in range(n_xis):
        xi = build_xi(pools, rng, mode=mode)
        if xi is None:
            failed += 1
            continue
        result = evaluate_xi(xi)
        results.append(result)
        record_counts[(result["wins"], result["losses"])] += 1
        tier_counts[result["tier"]] += 1

        # Progress indicator every 1000 XIs
        if (i + 1) % 1000 == 0:
            elapsed = time.time() - t0
            rate = (i + 1) / elapsed
            print(f"    {i+1:>5} / {n_xis}   ({rate:.0f} XIs/s)")

    elapsed = time.time() - t0
    successful = len(results)

    print(f"\n{'='*70}")
    print(f"  MODE: {mode.upper()}  ({successful} XIs in {elapsed:.1f}s, {failed} failed)")
    print(f"{'='*70}\n")

    # Headline: 16-0 rate
    sixteen_oh = record_counts.get((16, 0), 0)
    pct_sixteen = 100 * sixteen_oh / successful if successful else 0
    print(f"  ★ 16-0 RATE: {sixteen_oh} / {successful} = {pct_sixteen:.2f}%")
    if sixteen_oh > 0:
        print(f"    (1 in every {round(successful / sixteen_oh):,} XIs)")
    else:
        print(f"    (none observed — rate is <1 in {successful:,})")

    # Score statistics
    scores = [r["sixer_score"] for r in results]
    print(f"\n  SCORE STATS")
    print(f"    Min:    {min(scores)}")
    print(f"    Max:    {max(scores)}")
    print(f"    Mean:   {sum(scores)/len(scores):.1f}")
    print(f"    Median: {sorted(scores)[len(scores)//2]}")

    # Tier distribution
    print(f"\n  TIER DISTRIBUTION")
    for tier in ["S", "A", "B", "C", "D", "E", "F"]:
        cnt = tier_counts.get(tier, 0)
        pct = 100 * cnt / successful if successful else 0
        bar = "█" * int(pct / 2)
        print(f"    {tier}: {cnt:>5}  ({pct:>5.1f}%)  {bar}")

    # Record distribution
    print(f"\n  RECORD DISTRIBUTION")
    print(f"    {'Record':<8}{'Count':>8}{'Pct':>8}")
    for record in sorted(record_counts.keys(), key=lambda x: -x[0]):
        w, l = record
        cnt = record_counts[record]
        pct = 100 * cnt / successful if successful else 0
        bar = "█" * int(pct / 2)
        print(f"    {w:>2}-{l:<3}{cnt:>10}{pct:>7.1f}%  {bar}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["uniform", "weighted", "both"],
                        default="both",
                        help="Sampling mode")
    parser.add_argument("--n", type=int, default=N_XIS,
                        help=f"Number of XIs to generate (default: {N_XIS})")
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PATH)
    try:
        print(f"\nLoading draftable pool...")
        pool = fetch_all_draftable(conn)
        print(f"  Loaded {len(pool):,} player-seasons")

        print(f"Pre-computing player scores...")
        t0 = time.time()
        precompute_scores(pool)
        print(f"  Cached {len(pool):,} scores in {time.time()-t0:.2f}s")

        if args.mode in ("uniform", "both"):
            print(f"\nRunning UNIFORM mode ({args.n} XIs)...")
            run_test(pool, "uniform", args.n)
        if args.mode in ("weighted", "both"):
            print(f"\nRunning WEIGHTED mode ({args.n} XIs)...")
            run_test(pool, "weighted", args.n)
    finally:
        conn.close()


if __name__ == "__main__":
    main()