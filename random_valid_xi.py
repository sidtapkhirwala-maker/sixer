"""
random_valid_xi.py

Generate a random XI from sixer.db that meets structural constraints:
  - At least 2 Legendary-tier players
  - At least 1 wicketkeeper
  - At least 4 specialist batters (or Batter + Wicketkeeper combined)
  - At least 3 specialist bowlers
  - At least 1 all-rounder
  - 11 players total

Then runs it through the season engine.

Usage:
    python random_valid_xi.py
    python random_valid_xi.py --seed 42        # reproducible single XI
    python random_valid_xi.py --attempts 50    # more retries (default 100)
    python random_valid_xi.py --batch 200      # batch mode: 200 valid XIs
"""

import sqlite3
import random
import argparse
from collections import Counter
from season_engine import evaluate_xi

DB_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\sixer\sixer.db"

# Composition constraints
MIN_LEGENDARY = 2
MIN_KEEPERS = 1
MIN_BATTERS = 4   # batters + keepers count toward this
MIN_BOWLERS = 3
MIN_ARS = 1
TOTAL = 11


def fetch_all_draftable(conn):
    """Pull every draftable player-season with the stats needed."""
    cur = conn.cursor()
    cur.execute("""
        SELECT
            dp.id,
            dp.player_name,
            dp.season_year,
            dp.role_primary,
            dp.role_category,
            dp.season_quality_tier,
            ps.canonical_franchise,
            ps.runs_scored,
            ps.matches_played,
            ps.batting_strike_rate,
            ps.batting_average,
            ps.fours,
            ps.sixes,
            ps.balls_faced,
            ps.wickets_taken,
            ps.bowling_average,
            ps.bowling_economy,
            ps.balls_bowled,
            ps.wicketkeeper_override
        FROM draftable_pool dp
        JOIN player_seasons ps
          ON dp.player_name = ps.player_name
         AND dp.season_year = ps.season_year
    """)

    rows = cur.fetchall()
    pool = []
    for row in rows:
        (dp_id, player_name, season_year, role_primary, role_category,
         tier, franchise,
         runs_scored, matches_played, bat_sr, bat_avg,
         fours, sixes, balls_faced,
         wickets_taken, bowl_avg, bowl_econ, balls_bowled,
         wk_override, is_overseas,) = row

        pool.append({
            "dp_id": dp_id,
            "player_name": player_name,
            "season_year": season_year,
            "role_primary": role_primary,
            "role_category": role_category,
            "season_quality_tier": tier,
            "franchise": franchise or "",
            "is_overseas": bool(is_overseas),
            "is_wicketkeeper": bool(wk_override) or (role_primary == "Wicketkeeper"),
            "runs_scored": runs_scored or 0,
            "matches_played": matches_played or 0,
            "batting_strike_rate": bat_sr or 0.0,
            "batting_average": bat_avg,
            "fours": fours or 0,
            "sixes": sixes or 0,
            "balls_faced": balls_faced or 0,
            "wickets_taken": wickets_taken or 0,
            "bowling_average": bowl_avg,
            "bowling_economy": bowl_econ,
            "overs_bowled": (balls_bowled or 0) / 6.0,
        })
    return pool


def build_constrained_xi(pool, rng):
    """
    Build a random XI satisfying composition constraints.
    Strategy: fill required slots first (Legendary, WK, Batters, Bowlers, AR),
    then fill remaining spots randomly from anyone left.
    Returns: list of 11 player dicts, or None if impossible.
    """
    legendaries = [p for p in pool if p["season_quality_tier"] == "Legendary"]
    keepers     = [p for p in pool if p["is_wicketkeeper"]]
    batters     = [p for p in pool if p["role_category"] == "Batter"]
    bowlers     = [p for p in pool if p["role_category"] == "Bowler"]
    arounders   = [p for p in pool if p["role_category"] == "All-Rounder"]

    picked_ids = set()
    xi = []

    def pick_from(candidates, n):
        available = [p for p in candidates if p["dp_id"] not in picked_ids]
        if len(available) < n:
            return None
        chosen = rng.sample(available, n)
        for p in chosen:
            picked_ids.add(p["dp_id"])
            xi.append(p)
        return chosen

    if pick_from(legendaries, MIN_LEGENDARY) is None:
        return None

    have_keeper = any(p["is_wicketkeeper"] for p in xi)
    if not have_keeper:
        if pick_from(keepers, 1) is None:
            return None

    current_batting = sum(1 for p in xi if p["role_category"] in ("Batter", "Wicketkeeper"))
    need = MIN_BATTERS - current_batting
    if need > 0:
        bat_pool = batters + [k for k in keepers if k not in xi]
        if pick_from(bat_pool, need) is None:
            return None

    current_bowlers = sum(1 for p in xi if p["role_category"] == "Bowler")
    need = MIN_BOWLERS - current_bowlers
    if need > 0:
        if pick_from(bowlers, need) is None:
            return None

    current_ars = sum(1 for p in xi if p["role_category"] == "All-Rounder")
    need = MIN_ARS - current_ars
    if need > 0:
        if pick_from(arounders, need) is None:
            return None

    remaining = TOTAL - len(xi)
    if remaining > 0:
        leftover = [p for p in pool if p["dp_id"] not in picked_ids]
        if len(leftover) < remaining:
            return None
        for p in rng.sample(leftover, remaining):
            picked_ids.add(p["dp_id"])
            xi.append(p)

    return xi


def print_xi(xi):
    print(f"\n{'='*78}")
    print(f"  YOUR XI")
    print(f"{'='*78}\n")
    print(f"  {'#':<3}{'Player':<24}{'Year':<6}{'Franchise':<28}{'Role':<14}{'Tier'}")
    print(f"  {'-'*3}{'-'*24}{'-'*6}{'-'*28}{'-'*14}{'-'*10}")
    for i, p in enumerate(xi, 1):
        wk = " [WK]" if p["is_wicketkeeper"] and p["role_category"] != "Wicketkeeper" else ""
        franchise = p["franchise"][:26]
        print(f"  {i:<3}{p['player_name']+wk:<24}{p['season_year']:<6}"
              f"{franchise:<28}{p['role_category']:<14}{p['season_quality_tier']}")


def print_result(result):
    print(f"\n{'='*78}")
    print(f"  RESULT")
    print(f"{'='*78}\n")
    print(f"  Sixer Score:   {result['sixer_score']} / 110")
    print(f"  Record:        {result['wins']}-{result['losses']}")
    print(f"  Tier:          {result['tier']}")
    print(f"  Raw team:      {result['raw_team_score']}")
    print(f"  Style bonus:   +{result['style_bonus']}")
    for name, value in result["style_triggered"]:
        print(f"    +{value} {name}")
    print(f"  Penalties:     -{result['structural_penalty']}")
    for name, mag in result["structural_triggered"]:
        print(f"    {mag:+d} {name}")

    print(f"\n  Player scores:")
    for ps in result["player_scores"]:
        print(f"    {ps['player']:<22} {ps['season']}  ({ps['role']:<13}) {ps['score']:>5.2f}")


def run_batch(pool, rng, batch_size, attempts_per_xi):
    """Generate batch_size valid XIs and report distribution stats."""
    scores = []
    records = []
    tiers = []
    bonus_counter = Counter()
    penalty_counter = Counter()
    failed = 0

    for i in range(batch_size):
        xi = None
        for _ in range(attempts_per_xi):
            xi = build_constrained_xi(pool, rng)
            if xi is not None and len(xi) == 11:
                break
        if xi is None or len(xi) != 11:
            failed += 1
            continue

        result = evaluate_xi(xi)
        scores.append(result["sixer_score"])
        records.append((result["wins"], result["losses"]))
        tiers.append(result["tier"])

        for name, _ in result["style_triggered"]:
            bonus_counter[name] += 1
        for name, _ in result["structural_triggered"]:
            penalty_counter[name] += 1

        if (i + 1) % 25 == 0:
            print(f"  ...generated {i+1}/{batch_size}")

    print(f"\n{'='*78}")
    print(f"  BATCH RESULTS — {len(scores)} valid XIs (failed: {failed})")
    print(f"{'='*78}\n")

    if not scores:
        print("  No valid XIs generated.")
        return

    scores_sorted = sorted(scores)
    n = len(scores_sorted)
    median = scores_sorted[n // 2]
    p10 = scores_sorted[int(n * 0.10)]
    p90 = scores_sorted[int(n * 0.90)]
    mean = sum(scores) / n

    print(f"  Score distribution:")
    print(f"    min:    {min(scores):.1f}")
    print(f"    p10:    {p10:.1f}")
    print(f"    median: {median:.1f}")
    print(f"    mean:   {mean:.1f}")
    print(f"    p90:    {p90:.1f}")
    print(f"    max:    {max(scores):.1f}")

    print(f"\n  Tier distribution:")
    tier_counter = Counter(tiers)
    for tier in ["S", "A", "B", "C", "D", "E", "F"]:
        count = tier_counter.get(tier, 0)
        pct = 100 * count / n
        bar = "█" * int(pct / 2)
        print(f"    {tier}: {count:>4} ({pct:>5.1f}%) {bar}")

    print(f"\n  Record distribution (top 10):")
    record_counter = Counter([f"{w}-{l}" for w, l in records])
    for rec, count in record_counter.most_common(10):
        pct = 100 * count / n
        print(f"    {rec:<6} {count:>4} ({pct:>5.1f}%)")

    print(f"\n  Bonus trigger rate:")
    for name, count in bonus_counter.most_common():
        pct = 100 * count / n
        print(f"    {name:<22} {count:>4} ({pct:>5.1f}%)")
    if not bonus_counter:
        print("    (none triggered)")

    print(f"\n  Penalty trigger rate:")
    for name, count in penalty_counter.most_common():
        pct = 100 * count / n
        print(f"    {name:<22} {count:>4} ({pct:>5.1f}%)")
    if not penalty_counter:
        print("    (none triggered)")

    sixteen_zero = sum(1 for w, l in records if w == 16 and l == 0)
    print(f"\n  16-0 hit rate: {sixteen_zero}/{n} ({100*sixteen_zero/n:.2f}%)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=None,
                        help="Random seed for reproducibility.")
    parser.add_argument("--attempts", type=int, default=100,
                        help="Max attempts to build a valid XI (default 100).")
    parser.add_argument("--batch", type=int, default=0,
                        help="If >0, generate N valid XIs and print distribution stats.")
    args = parser.parse_args()

    rng = random.Random(args.seed) if args.seed is not None else random.Random()

    conn = sqlite3.connect(DB_PATH)
    try:
        pool = fetch_all_draftable(conn)
        print(f"Loaded {len(pool)} draftable player-seasons from sixer.db")

        if args.batch > 0:
            run_batch(pool, rng, args.batch, args.attempts)
            return

        xi = None
        for _ in range(args.attempts):
            xi = build_constrained_xi(pool, rng)
            if xi is not None and len(xi) == 11:
                break

        if xi is None or len(xi) != 11:
            print(f"\n⚠️  Could not build a valid XI in {args.attempts} attempts.")
            print("    Constraints may be too strict for this pool. Try relaxing.")
            return

        print_xi(xi)
        result = evaluate_xi(xi)
        print_result(result)

    finally:
        conn.close()


if __name__ == "__main__":
    main()