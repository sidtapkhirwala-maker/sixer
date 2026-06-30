"""
find_best_xi.py

Find the highest-scoring valid XI by random search.

Unlike random_target_xi.py, which hunts for a specific record, this
script samples many random valid XIs and tracks the single highest
Sixer Score it has seen, including all bonuses and penalties.

Honors IPL rules:
  - Max 4 overseas players per XI (hard cap)
  - No duplicate player names

This is a Monte Carlo search, not exhaustive optimization. With enough
attempts (50k-100k+) it converges very close to the true theoretical
maximum, because high-scoring XIs cluster heavily around the top
~50-100 player-seasons.

Cards display the player's commonly-used name (display_name) rather
than the Cricsheet short form (player_name).

Usage:
    python find_best_xi.py                    # 50,000 attempts (default)
    python find_best_xi.py --attempts 200000  # longer search
    python find_best_xi.py --seed 42          # reproducible
    python find_best_xi.py --progress 5000    # print best-so-far every N
"""

import sqlite3
import random
import argparse
import time
from season_engine import evaluate_xi, compute_player_score

DB_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\sixer\sixer.db"

# ═════════════════════════════════════════════════════════════════
# EDIT THESE
# ═════════════════════════════════════════════════════════════════

MIN_PLAYER_SCORE = 10      # weakest player allowed (raise = faster, narrower)
MAX_PLAYER_SCORE = 11.0     # strongest player allowed
MAX_OVERSEAS = 4            # IPL rule: max 4 foreigners per XI
DEFAULT_ATTEMPTS = 10000    # search budget
PROGRESS_EVERY = 2500       # print best-so-far every N attempts

# ═════════════════════════════════════════════════════════════════

COMPOSITION = {
    "wicketkeeper": 1,
    "batter": 4,
    "spinner": 2,
    "pacer": 2,
    "all_rounder": 2,
}


def fetch_all_draftable(conn):
    """Pull every draftable player-season with stats and metadata."""
    cur = conn.cursor()
    cur.execute("""
        SELECT
            dp.id, dp.player_name, dp.display_name, dp.season_year,
            dp.role_primary, dp.role_category, dp.season_quality_tier,
            ps.canonical_franchise,
            ps.runs_scored, ps.matches_played, ps.batting_strike_rate,
            ps.batting_average, ps.fours, ps.sixes, ps.balls_faced,
            ps.wickets_taken, ps.bowling_average, ps.bowling_economy,
            ps.balls_bowled, ps.wicketkeeper_override,
            ps.avg_batting_position,
            ps.is_overseas
        FROM draftable_pool dp
        JOIN player_seasons ps
          ON dp.player_name = ps.player_name
         AND dp.season_year = ps.season_year
    """)

    pool = []
    for row in cur.fetchall():
        (dp_id, name, display_name, year, role_pri, role_cat, tier, franchise,
         runs, matches, bat_sr, bat_avg, fours, sixes, balls_faced,
         wickets, bowl_avg, bowl_econ, balls_bowled, wk_override,
         avg_bat_pos, is_overseas) = row

        pool.append({
            "dp_id": dp_id,
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


def build_role_pools(pool, min_score, max_score):
    """Bucket players by role within the score range."""
    pools = {
        "wicketkeeper": [],
        "batter": [],
        "all_rounder": [],
        "spinner": [],
        "pacer": [],
    }

    for p in pool:
        score = compute_player_score(p)
        if score < min_score or score > max_score:
            continue
        p["_player_score"] = score

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


def build_random_xi(pools, rng, max_overseas=MAX_OVERSEAS):
    """
    Build one random XI honoring composition + overseas cap + no
    duplicate player names.
    """
    xi = []
    used_names = set()
    overseas_count = 0

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
            pick = rng.choice(available)
            used_names.add(pick["player_name"])
            if pick["is_overseas"]:
                overseas_count += 1
            xi.append(pick)

    return xi


def search_best_xi(pools, rng, max_attempts, progress_every):
    """
    Run max_attempts random XI builds, return the best one found by
    Sixer Score. Prints progress as it finds new best XIs.
    """
    best_xi = None
    best_result = None
    best_score = -1.0
    failed_builds = 0
    start = time.time()
    last_progress = start

    print(f"\nSearching {max_attempts:,} random XIs for the highest "
          f"Sixer Score...\n")

    for attempt in range(1, max_attempts + 1):
        xi = build_random_xi(pools, rng)
        if xi is None:
            failed_builds += 1
            continue

        result = evaluate_xi(xi)
        score = result["sixer_score"]

        if score > best_score:
            best_score = score
            best_xi = xi
            best_result = result
            elapsed = time.time() - start
            print(f"  [{attempt:>7,}] new best: {score:>6.2f}  "
                  f"({result['wins']}-{result['losses']}, "
                  f"tier {result['tier']})  "
                  f"@ {elapsed:>5.1f}s")

        if attempt % progress_every == 0 and time.time() - last_progress > 2:
            elapsed = time.time() - start
            rate = attempt / elapsed
            print(f"  [{attempt:>7,}] best so far: {best_score:.2f}  "
                  f"({rate:>5.0f} XIs/sec)")
            last_progress = time.time()

    elapsed = time.time() - start
    print(f"\nSearch done in {elapsed:.1f}s "
          f"({max_attempts/elapsed:.0f} XIs/sec). "
          f"{failed_builds} failed builds.")

    return best_xi, best_result


def order_xi_as_lineup(xi):
    """Sort XI into T20 batting/bowling lineup order."""
    def bat_pos(p):
        return p.get("avg_batting_position") or 99

    role_pri = lambda p: p["role_primary"]
    used = set()

    def take(predicate):
        picks = [p for p in xi if predicate(p) and id(p) not in used]
        for p in picks:
            used.add(id(p))
        return picks

    keeper = take(lambda p: p["is_wicketkeeper"] or p["role_category"] == "Wicketkeeper")
    batters = take(lambda p: p["role_category"] == "Batter")
    batting_ar = take(lambda p: role_pri(p) == "Batting All-Rounder")
    bowling_ar = take(lambda p: role_pri(p) == "Bowling All-Rounder")
    spinners = take(lambda p: role_pri(p) == "Spin Bowler")
    pacers = take(lambda p: role_pri(p) == "Pace Bowler")

    top_and_middle = sorted(
        batters + keeper,
        key=lambda p: (bat_pos(p), -p["_player_score"])
    )
    bowlers = sorted(spinners + pacers, key=lambda p: -p["_player_score"])
    all_rounders = batting_ar + bowling_ar

    return top_and_middle + all_rounders + bowlers


def print_xi(xi):
    print(f"\n{'='*96}")
    print(f"  BEST XI FOUND")
    print(f"{'='*96}")

    lineup = order_xi_as_lineup(xi)
    overseas_count = sum(1 for p in xi if p["is_overseas"])
    indian_count = 11 - overseas_count
    print(f"  Squad: {indian_count} Indian, {overseas_count} Overseas "
          f"(cap {MAX_OVERSEAS})\n")

    print(f"  {'#':<3}{'Player':<28}{'Year':<6}{'Franchise':<22}"
          f"{'Role':<22}{'O/S':<5}{'Score'}")
    print(f"  {'-'*94}")

    for position_num, p in enumerate(lineup, start=1):
        franchise = (p["franchise"] or "")[:20]
        role = p["role_primary"][:20]
        wk_marker = " (WK)" if p["is_wicketkeeper"] and p["role_category"] != "Wicketkeeper" else ""
        name_display = (p["display_name"] + wk_marker)[:26]
        score = p.get("_player_score", 0)
        os_flag = "OS" if p["is_overseas"] else "IND"
        print(f"  {position_num:<3}{name_display:<28}{p['season_year']:<6}"
              f"{franchise:<22}{role:<22}{os_flag:<5}{score:>5.2f}")


def print_result(result):
    print(f"\n{'='*96}")
    print(f"  SCORE BREAKDOWN")
    print(f"{'='*96}\n")
    print(f"  Sixer Score:   {result['sixer_score']}")
    print(f"  Record:        {result['wins']}-{result['losses']}")
    print(f"  Tier:          {result['tier']}")
    print(f"  Raw team:      {result['raw_team_score']}")
    print(f"  Style bonus:   +{result['style_bonus']}  "
          f"({len(result['style_triggered'])} triggered)")
    for s in result["style_triggered"]:
        print(f"    + {s}")
    print(f"  Penalties:     -{result['structural_penalty']}")
    for name, mag in result["structural_triggered"]:
        print(f"    {mag:+d} {name}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=None,
                        help="Random seed for reproducibility")
    parser.add_argument("--attempts", type=int, default=DEFAULT_ATTEMPTS,
                        help=f"Number of random XIs to try "
                             f"(default {DEFAULT_ATTEMPTS:,})")
    parser.add_argument("--progress", type=int, default=PROGRESS_EVERY,
                        help="Print progress every N attempts")
    args = parser.parse_args()

    rng = random.Random(args.seed) if args.seed is not None else random.Random()
    conn = sqlite3.connect(DB_PATH)
    try:
        pool = fetch_all_draftable(conn)
        pools = build_role_pools(pool, MIN_PLAYER_SCORE, MAX_PLAYER_SCORE)

        print(f"Player range: {MIN_PLAYER_SCORE} <= PlayerScore "
              f"<= {MAX_PLAYER_SCORE}")
        print(f"Foreigner cap: {MAX_OVERSEAS}")
        print(f"Role pool sizes:")
        for k, v in pools.items():
            overseas_in_pool = sum(1 for p in v if p["is_overseas"])
            print(f"  {k:<14} {len(v)} players  "
                  f"({overseas_in_pool} overseas)")

        for slot, count in COMPOSITION.items():
            if len(pools[slot]) < count:
                print(f"\n⚠️  Not enough {slot}s in pool "
                      f"(need {count}, have {len(pools[slot])})")
                print(f"    Lower MIN_PLAYER_SCORE to widen the pool.")
                return

        best_xi, best_result = search_best_xi(
            pools, rng, args.attempts, args.progress
        )

        if best_xi is None:
            print("\n⚠️  No valid XI found. Try lowering MIN_PLAYER_SCORE.")
            return

        print_xi(best_xi)
        print_result(best_result)

    finally:
        conn.close()


if __name__ == "__main__":
    main()