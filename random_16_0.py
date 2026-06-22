"""
random_16_0.py

Generate random XIs that hit a target record, by capping the range of
player quality used.

Honors IPL rules:
  - Max 4 overseas players per XI (hard cap)
  - No duplicate player names (a player can only be in your XI once,
    regardless of which season they're drafted from)

Cards display the player's commonly-used name (display_name) rather than
the Cricsheet short form (player_name).

Requires:
  - `is_overseas` column in player_seasons (run apply_nationality.py)
  - `display_name` column in player_seasons (run apply_full_names.py)
"""

import sqlite3
import random
import argparse
from collections import Counter
from season_engine import evaluate_xi, compute_player_score

DB_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\sixer\sixer.db"

# ═════════════════════════════════════════════════════════════════
# EDIT THESE
# ═════════════════════════════════════════════════════════════════

TARGET_WINS = 14            # the record you want (0 to 16)
MIN_PLAYER_SCORE = 6      # weakest player allowed (0.0 = no min)
MAX_PLAYER_SCORE = 10       # strongest player allowed (10.0 = no cap)
MAX_OVERSEAS = 4            # IPL rule: max 4 foreigners per XI

# ═════════════════════════════════════════════════════════════════

MAX_ATTEMPTS = 1000

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
            "player_name": name,                          # internal join key
            "display_name": display_name or name,         # what we show users
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
    """Bucket players by role, only including those in the score range.
    Each player belongs to exactly one pool (if/elif)."""
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
    Build one random XI with proper composition.
    Enforces:
      - No duplicate player names (Bumrah 2020 blocks Bumrah 2024)
      - At most `max_overseas` foreign players
    Returns None if a legal XI cannot be built from the current pools.
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
        # Pick players one at a time — cap state changes mid-slot
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


def find_target_xi(pools, rng, target_wins, max_attempts):
    """Build candidate XIs until one matches target record."""
    for attempt in range(1, max_attempts + 1):
        xi = build_random_xi(pools, rng)
        if xi is None:
            return None, None, attempt
        result = evaluate_xi(xi)
        if result["wins"] == target_wins:
            return xi, result, attempt
    return None, None, max_attempts


def order_xi_as_lineup(xi):
    """Return the XI as a flat list of 11 unique players, sorted in
    T20 batting/bowling lineup order:
      1. Specialist batters (sorted by batting position, then score)
      2. Wicketkeeper(s) — slot in by batting position
      3. All-rounders (batting AR before bowling AR)
      4. Bowlers (spinners + pacers, by score)
    Every player appears exactly once.
    """
    def bat_pos(p):
        return p.get("avg_batting_position") or 99

    role_pri = lambda p: p["role_primary"]
    used = set()

    def take(predicate):
        picks = [p for p in xi if predicate(p) and id(p) not in used]
        for p in picks:
            used.add(id(p))
        return picks

    # Claim keeper FIRST — they often satisfy both keeper and batter
    # predicates; claiming first prevents double-counting downstream.
    keeper = take(lambda p: p["is_wicketkeeper"] or p["role_category"] == "Wicketkeeper")

    # Specialist batters (excluding the keeper, who is now claimed)
    batters = take(lambda p: p["role_category"] == "Batter")

    # All-rounders, split by primary
    batting_ar = take(lambda p: role_pri(p) == "Batting All-Rounder")
    bowling_ar = take(lambda p: role_pri(p) == "Bowling All-Rounder")

    # Bowlers
    spinners = take(lambda p: role_pri(p) == "Spin Bowler")
    pacers = take(lambda p: role_pri(p) == "Pace Bowler")

    # Build the batting order: specialist batters + keeper, sorted by bat_pos
    top_and_middle = sorted(
        batters + keeper,
        key=lambda p: (bat_pos(p), -p["_player_score"])
    )

    # Bowlers sorted by score descending (best first)
    bowlers = sorted(spinners + pacers, key=lambda p: -p["_player_score"])

    # All-rounders: batting ARs come first (they bat higher), then bowling ARs
    all_rounders = batting_ar + bowling_ar

    # Final flat lineup
    lineup = top_and_middle + all_rounders + bowlers
    return lineup


def print_xi(xi):
    print(f"\n{'='*96}")
    print(f"  YOUR XI")
    print(f"{'='*96}")

    lineup = order_xi_as_lineup(xi)

    overseas_count = sum(1 for p in xi if p["is_overseas"])
    indian_count = 11 - overseas_count
    print(f"  Squad: {indian_count} Indian, {overseas_count} Overseas (cap {MAX_OVERSEAS})\n")

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

    # Sanity guard: print a warning if the lineup somehow has duplicates
    seen_names = [p["player_name"] for p in lineup]
    if len(set(seen_names)) != len(lineup):
        print(f"\n  ⚠ Duplicate detected: {len(lineup)} rows, {len(set(seen_names))} unique players")

def print_result(result, attempts, target_wins):
    print(f"\n{'='*96}")
    print(f"  RESULT  (took {attempts} attempts to find a {target_wins}-{16-target_wins} XI)")
    print(f"{'='*96}\n")
    print(f"  Sixer Score:   {result['sixer_score']} / 110")
    print(f"  Record:        {result['wins']}-{result['losses']}")
    print(f"  Tier:          {result['tier']}")
    print(f"  Raw team:      {result['raw_team_score']}")
    print(f"  Style bonus:   +{result['style_bonus']}  ({len(result['style_triggered'])} triggered)")
    for s in result["style_triggered"]:
        print(f"    + {s}")
    print(f"  Penalties:     -{result['structural_penalty']}")
    for name, mag in result["structural_triggered"]:
        print(f"    {mag:+d} {name}")


def run_single(pool, rng):
    pools = build_role_pools(pool, MIN_PLAYER_SCORE, MAX_PLAYER_SCORE)
    print(f"\nTarget: {TARGET_WINS}-{16-TARGET_WINS} record")
    print(f"Player range: {MIN_PLAYER_SCORE} <= PlayerScore <= {MAX_PLAYER_SCORE}")
    print(f"Foreigner cap: {MAX_OVERSEAS}")
    print(f"Role pool sizes:")
    for k, v in pools.items():
        overseas_in_pool = sum(1 for p in v if p["is_overseas"])
        print(f"  {k:<14} {len(v)} players  ({overseas_in_pool} overseas)")

    for slot, count in COMPOSITION.items():
        if len(pools[slot]) < count:
            print(f"\n⚠️  Not enough {slot}s in pool (need {count}, have {len(pools[slot])})")
            print(f"    Widen the range: lower MIN_PLAYER_SCORE or raise MAX_PLAYER_SCORE.")
            return

    print(f"\nSearching for a {TARGET_WINS}-{16-TARGET_WINS} XI (max {MAX_ATTEMPTS} attempts)...")
    xi, result, attempts = find_target_xi(pools, rng, TARGET_WINS, MAX_ATTEMPTS)

    if xi is None:
        print(f"\n⚠️  Couldn't find a {TARGET_WINS}-{16-TARGET_WINS} XI in {attempts} attempts.")
        if TARGET_WINS <= 3:
            print(f"    For low records: lower MAX_PLAYER_SCORE further (currently {MAX_PLAYER_SCORE})")
        elif TARGET_WINS >= 14:
            print(f"    For high records: raise MIN_PLAYER_SCORE (currently {MIN_PLAYER_SCORE})")
        else:
            print(f"    Try a different range. Current: [{MIN_PLAYER_SCORE}, {MAX_PLAYER_SCORE}]")
        return

    print_xi(xi)
    print_result(result, attempts, TARGET_WINS)


def run_batch(pool, rng, n):
    pools = build_role_pools(pool, MIN_PLAYER_SCORE, MAX_PLAYER_SCORE)
    print(f"\nTarget: {TARGET_WINS}-{16-TARGET_WINS} record")
    print(f"Player range: {MIN_PLAYER_SCORE} <= PlayerScore <= {MAX_PLAYER_SCORE}")
    print(f"Foreigner cap: {MAX_OVERSEAS}")
    print(f"Generating {n} XIs...")
    for k, v in pools.items():
        print(f"  {k:<14} {len(v)} players")

    score_total = 0
    attempts_total = 0
    failed = 0
    bonus_count = Counter()
    overseas_dist = Counter()
    pick_count = Counter()                              # NEW — most-picked display names

    for i in range(n):
        xi, result, attempts = find_target_xi(pools, rng, TARGET_WINS, MAX_ATTEMPTS)
        attempts_total += attempts
        if xi is None:
            failed += 1
            continue
        score_total += result["sixer_score"]
        overseas_dist[sum(1 for p in xi if p["is_overseas"])] += 1
        for b in result["style_triggered"]:
            bonus_count[b] += 1
        for p in xi:
            pick_count[p["display_name"]] += 1

    successful = n - failed
    if failed:
        print(f"\n⚠️  {failed} of {n} XIs failed.")
    if successful == 0:
        return

    print(f"\n{'='*60}")
    print(f"  BATCH OF {successful} {TARGET_WINS}-{16-TARGET_WINS} XIs")
    print(f"{'='*60}\n")
    print(f"  Avg Sixer Score: {score_total / successful:.1f}")
    print(f"  Avg attempts:    {attempts_total / n:.1f}")

    print("\n  OVERSEAS DISTRIBUTION")
    print("  " + "-" * 56)
    for ov in sorted(overseas_dist):
        pct = (overseas_dist[ov] / successful) * 100
        print(f"  {ov} overseas: {overseas_dist[ov]:>4} ({pct:>5.1f}%)")

    if bonus_count:
        print("\n  BONUSES TRIGGERED")
        print("  " + "-" * 56)
        for name, cnt in bonus_count.most_common():
            pct = (cnt / successful) * 100
            print(f"  {name:<22} {cnt:>4} ({pct:>5.1f}%)")

    print("\n  TOP 15 MOST-PICKED PLAYERS")            # NEW
    print("  " + "-" * 56)
    for name, cnt in pick_count.most_common(15):
        pct = (cnt / successful) * 100
        print(f"  {name:<28} {cnt:>4} ({pct:>5.1f}%)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--batch", type=int, default=0)
    args = parser.parse_args()

    rng = random.Random(args.seed) if args.seed is not None else random.Random()
    conn = sqlite3.connect(DB_PATH)
    try:
        pool = fetch_all_draftable(conn)
        if args.batch > 0:
            run_batch(pool, rng, args.batch)
        else:
            run_single(pool, rng)
    finally:
        conn.close()


if __name__ == "__main__":
    main()