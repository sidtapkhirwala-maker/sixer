"""
season_engine.py

PlayerScore-based deterministic engine for Sixer.

Architecture:
  1. PlayerScore (0-10) per player, percentile-based within role
  2. Raw TeamScore (0-110) = sum of PlayerScores
  3. Style bonuses (+0 to +10)
  4. Structural penalties (0 to -35)
  5. Final Sixer Score = clamped 0-110
  6. Record + Tier derived from Sixer Score
"""

import json
import os
import hashlib
from typing import List, Dict, Tuple
from collections import Counter

LOOKUPS_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\sixer\player_score_lookups.json"

# ─────────────────────────────────────────────────────────────────────
# LOAD CALIBRATED PERCENTILE LOOKUPS
# ─────────────────────────────────────────────────────────────────────

with open(LOOKUPS_PATH, "r") as f:
    _LOOKUPS = json.load(f)

_BATTER = _LOOKUPS["batter"]
_BOWLER = _LOOKUPS["bowler"]

# ─────────────────────────────────────────────────────────────────────
# ERA NORMALISATION
# ─────────────────────────────────────────────────────────────────────

# League-average batting SR by season (from player_seasons data)
ERA_BASELINES_SR = {
    2008: 130.63, 2009: 118.58, 2010: 128.47, 2011: 121.69,
    2012: 124.32, 2013: 123.17, 2014: 130.14, 2015: 132.74,
    2016: 132.58, 2017: 134.72, 2018: 139.24, 2019: 135.40,
    2020: 132.80, 2021: 127.64, 2022: 135.08, 2023: 143.00,
    2024: 152.19, 2025: 154.41, 2026: 157.60,
}

def _percentile_rank(value, sorted_list, invert=False):
    """
    Return percentile rank (0-1) of value in sorted_list.
    Applies a gentle S-curve to stretch top and bottom ends.
    If invert=True, lower values get higher rank.
    """
    if not sorted_list or value is None:
        return 0.0
    n = len(sorted_list)
    below = sum(1 for x in sorted_list if x < value)
    rank = below / n
    if invert:
        rank = 1.0 - rank
    # S-curve: median (0.5) stays at 0.5; elite (0.95) becomes ~0.98; weak (0.05) becomes ~0.02
    if rank >= 0.5:
        return 0.5 + 0.5 * ((rank - 0.5) * 2) ** 0.6
    else:
        return 0.5 - 0.5 * ((0.5 - rank) * 2) ** 0.6


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


# ─────────────────────────────────────────────────────────────────────
# 1. PLAYER SCORE
# ─────────────────────────────────────────────────────────────────────

def batting_subscore(runs, sr, bat_avg):
    """Returns 0-10 batting subscore."""
    avg_pct = _percentile_rank(bat_avg, _BATTER["avg"]) if bat_avg else 0.0
    sr_pct = _percentile_rank(sr, _BATTER["sr"]) if sr else 0.0
    runs_pct = _percentile_rank(runs, _BATTER["runs"]) if runs else 0.0
     # Baseline percentile-based score
    base = 10.0 * (0.20 * avg_pct + 0.35 * sr_pct + 0.45 * runs_pct)

    # Absolute-threshold bonuses (additive, capped at +1.5)
    runs_bonus = 0.0
    if runs >= 900:
        runs_bonus = 1           # 900+ runs = once-in-a-decade season
    elif runs >= 750:
        runs_bonus = 0.6           # 750+ = elite season
    elif runs >= 600:
        runs_bonus = 0.15           # 600+ = very strong season

    avg_bonus = 0.0
    if bat_avg and bat_avg >= 70:
        avg_bonus = 0.2
    elif bat_avg and bat_avg >= 55:
        avg_bonus = 0.1

    # Cap at 11
    return min(base + runs_bonus + avg_bonus, 11.0)


def bowling_subscore(wickets, bowl_avg, bowl_econ):
    """Returns 0-11 bowling subscore.

    Percentile baseline + absolute-threshold bonuses that mirror the batting
    subscore. Volume and absolute quality of bowling earn additive boosts
    above what percentile rank alone captures, letting peak bowling seasons
    (Bumrah 2020, Malinga 2011, Rashid 2020) reach Legendary territory.
    """
    econ_pct = _percentile_rank(bowl_econ, _BOWLER["econ"], invert=True) if bowl_econ else 0.0
    avg_pct = _percentile_rank(bowl_avg, _BOWLER["avg"], invert=True) if bowl_avg else 0.0
    wkts_pct = _percentile_rank(wickets, _BOWLER["wkts"]) if wickets else 0.0

    # Baseline percentile-based score
    base = 10.0 * (0.35 * econ_pct + 0.20 * avg_pct + 0.45 * wkts_pct)

    # Absolute-threshold bonuses (additive)
    wkts_bonus = 0.0
    if wickets >= 30:
        wkts_bonus = 1           # 30+ wickets = once-in-a-decade haul
    elif wickets >= 25:
        wkts_bonus = 0.6           # 25+ = elite (Purple Cap territory)
    elif wickets >= 20:
        wkts_bonus = 0.15           # 20+ = very strong season

    econ_bonus = 0.0
    if bowl_econ and bowl_econ <= 6.5:
        econ_bonus = 0.2           # Sub-6.5 economy = exceptional
    elif bowl_econ and bowl_econ <= 7.0:
        econ_bonus = 0.1          # Sub-7.0 = very good

    # Cap at 11
    return min(base + wkts_bonus + econ_bonus, 11.0)


def compute_player_score(player):
    """
    Compute PlayerScore (0-10+) for a single player-season.

    - Batters & Wicketkeepers: scored on batting (avg/SR/runs + threshold bonuses)
    - Bowlers: scored on bowling (econ/avg/wickets + threshold bonuses)
    - All-Rounders: primary skill + meaningful secondary skill bonus + versatility bonus
                    Capped at 10.0 — relies on batting_subscore/bowling_subscore
                    already including threshold bonuses so peak ARs can reach Legendary.

    Note: scores can exceed 10 by design when threshold bonuses fire on truly
    transcendent seasons (Kohli 2016, Bumrah 2020, etc.). The cap of 10 on ARs
    keeps specialists at the very top, but the threshold bonuses below the cap
    are what let ARs reach Legendary tier at all.
    """
    role_cat = player.get("role_category", "")
    role_pri = player.get("role_primary", "")

    runs = player.get("runs_scored") or 0
    bat_avg = player.get("batting_average")
    bat_sr = player.get("batting_strike_rate")
    wickets = player.get("wickets_taken") or 0
    bowl_avg = player.get("bowling_average")
    bowl_econ = player.get("bowling_economy")

    # Batters & Wicketkeepers — scored purely on batting
    if role_cat in ("Batter", "Wicketkeeper"):
        return batting_subscore(runs, bat_sr, bat_avg)

    # Bowlers — scored purely on bowling
    if role_cat == "Bowler":
        return bowling_subscore(wickets, bowl_avg, bowl_econ)

    if role_cat == "All-Rounder":
        bat = batting_subscore(runs, bat_sr, bat_avg)
        bowl = bowling_subscore(wickets, bowl_avg, bowl_econ)

        primary = max(bat, bowl)
        secondary = min(bat, bowl)

        # Skill bonus: secondary above 5.0 contributes (was 6.0)
        skill_excess = max(secondary - 5.0, 0)
        skill_bonus = skill_excess * 0.25  # was 0.15

        # Versatility bonus: tiered, not binary
        if bat >= 7.5 and bowl >= 7.5:
            versatility_bonus = 0.2   # elite both ways
        elif bat >= 7.0 and bowl >= 7.0:
            versatility_bonus = 0.2   # strong both ways
        elif bat >= 6.0 and bowl >= 6.0:
            versatility_bonus = 0.2  # competent both ways
        else:
            versatility_bonus = 0.0

        raw_score = primary + skill_bonus + versatility_bonus

        # Soft cap: if secondary is genuinely weak (<5.5), cap at Excellent
        if secondary < 5.5:
            return min(raw_score, 10)

        return min(raw_score, 11.0)

        # Fallback for unknown role categories
        return 0.0     

def tier_from_player_score(score):
    """
    Map a PlayerScore (0-10) to a quality tier label.
    Thresholds chosen so:
      - Legendary = top ~5% (score >= 9.0)
      - Excellent = next ~15% (8.0 - 8.99)
      - Good      = next ~25% (6.5 - 7.99)
      - Average   = middle ~35% (4.5 - 6.49)
      - Poor      = bottom ~20% (below 4.5)
    """
    if score >= 9.0:
        return "Legendary"
    if score >= 8.0:
        return "Excellent"
    if score >= 6.5:
        return "Good"
    if score >= 4.5:
        return "Average"
    return "Poor"

# ─────────────────────────────────────────────────────────────────────
# 2. RAW TEAM SCORE
# ─────────────────────────────────────────────────────────────────────

def compute_raw_team_score(xi):
    """Sum of PlayerScores across XI, max 110."""
    return sum(compute_player_score(p) for p in xi)


# ─────────────────────────────────────────────────────────────────────
# 3. STYLE BONUSES (positive narrative)
# ─────────────────────────────────────────────────────────────────────

def compute_style_bonuses(xi):
    """Returns (total_bonus, list of triggered (name, value) tuples)."""
    triggered = []
    bonus = 0

    role_pris   = [p.get("role_primary", "") for p in xi]
    n_spinners  = sum(1 for rp in role_pris if rp == "Spin Bowler")
    n_pacers    = sum(1 for rp in role_pris if rp == "Pace Bowler")
    n_arounders = sum(1 for p in xi if p.get("role_category") == "All-Rounder")

    # Bonus 1: Local XI — all 11 players are domestic (not overseas)
    if all(not p.get("is_overseas", False) for p in xi):
        bonus += 2
        triggered.append(("Local XI", 2))

    # Bonus 2: Complete Attack — 2+ spinners, 2+ pacers, 2+ all-rounders
    if n_spinners >= 2 and n_pacers >= 2 and n_arounders >= 2:
        bonus += 4
        triggered.append(("Complete Attack", 4))

    # Bonus 3: Tier Stack — 7+ Legendary players (PlayerScore >= 9.0)
    # Recomputed fresh so this stays in sync if the score formula changes.
    legendary_count = sum(1 for p in xi if compute_player_score(p) >= 9.0)
    if legendary_count >= 7:
        bonus += 2
        triggered.append(("Tier Stack", 2))

    # Bonus 4: Power Hitters — 3+ eligible batters/keepers/ARs with batting SR >= 175
    power_hitter_roles = ("Batter", "Wicketkeeper", "All-Rounder")
    power_hitters = sum(
        1 for p in xi
        if p.get("role_category") in power_hitter_roles
        and (p.get("batting_strike_rate") or 0) >= 175
    )
    if power_hitters >= 3:
        bonus += 3
        triggered.append(("Power Hitters", 3))

    # Bonus 5: Death Specialists — 2+ pace bowlers with bowling economy <= 7.0
    death_specialists = sum(
        1 for p in xi
        if p.get("role_primary") == "Pace Bowler"
        and p.get("bowling_economy") is not None
        and p["bowling_economy"] <= 7.0
    )
    if death_specialists >= 2:
        bonus += 2
        triggered.append(("Death Specialists", 2))

    # Bonus 6: Spin Twins — 2+ spinners with combined wickets_taken >= 35
    spinners = [p for p in xi if p.get("role_primary") == "Spin Bowler"]
    spinner_wickets = sum(p.get("wickets_taken") or 0 for p in spinners)
    if len(spinners) >= 2 and spinner_wickets >= 35:
        bonus += 2
        triggered.append(("Spin Twins", 2))

    # Bonus 7: Twin Anchors — 2+ top-order batters with batting average >= 50
    twin_anchor_count = sum(
        1 for p in xi
        if p.get("role_primary") == "Top-Order Batter"
        and p.get("batting_average") is not None
        and p["batting_average"] >= 50
    )
    if twin_anchor_count >= 2:
        bonus += 2
        triggered.append(("Twin Anchors", 2))

    # Cap at +15
    if bonus > 15:
        bonus = 15

    return bonus, triggered


# ─────────────────────────────────────────────────────────────────────
# 4. STRUCTURAL PENALTIES (negative narrative)
# ─────────────────────────────────────────────────────────────────────

def compute_structural_penalties(xi):
    """
    Stackable structural penalties for broken XIs.
    Returns (total_penalty, list of triggered penalty names with magnitudes).
    """
    triggered = []
    penalty = 0

    role_cats = [p.get("role_category", "") for p in xi]
    role_pris = [p.get("role_primary", "") for p in xi]

    n_keepers = sum(1 for p in xi if p.get("is_wicketkeeper") or p.get("role_category") == "Wicketkeeper")
    n_spinners = sum(1 for p in role_pris if p == "Spin Bowler")
    n_pacers = sum(1 for p in role_pris if p == "Pace Bowler")

    n_batters = sum(1 for rc in role_cats if rc == "Batter")
    n_bowlers = sum(1 for rc in role_cats if rc == "Bowler")
    n_arounders = sum(1 for rc in role_cats if rc == "All-Rounder")

    # Batting side strength = batters + keepers + ARs (anyone who bats)
    batting_side_count = n_batters + n_keepers + n_arounders

    # Bowling options = bowlers + ARs (anyone who bowls meaningfully)
    bowling_side_count = n_bowlers + n_arounders

    # Role-distribution counts (for stacking penalties)
    top_order_count = sum(1 for p in role_pris if p == "Top-Order Batter")
    finisher_count = sum(1 for p in role_pris if p == "Finisher")

    # Penalty: No Keeper
    if n_keepers == 0:
        penalty += 10
        triggered.append(("No Keeper", -10))

    # Penalty: No Spinner (only if we have role_primary data)
    if any(role_pris) and n_spinners == 0:
        penalty += 5
        triggered.append(("No Spinner", -5))

    # Penalty: No Pacer
    if any(role_pris) and n_pacers == 0:
        penalty += 5
        triggered.append(("No Pacer", -5))

    # Penalty: No All-Rounder
    if n_arounders == 0:
        penalty += 5
        triggered.append(("No All-Rounder", -5))

    # Penalty: Thin Batting (fewer than 6 batters/keepers/ARs)
    if batting_side_count < 6:
        penalty += 8
        triggered.append(("Thin Batting", -8))

    # Penalty: Light on Bowling — fewer than 5 bowling options (cricket floor for 20 overs)
    if bowling_side_count < 5:
        penalty += 10
        triggered.append(("Light on Bowling", -10))

    # Penalty: Boundary Riders — 5+ specialist finishers stacked
    if finisher_count >= 5:
        penalty += 10
        triggered.append(("Boundary Riders", -10))

    # Penalty: Pure Anchors — 5+ specialist top-order batters stacked
    if top_order_count >= 5:
        penalty += 5
        triggered.append(("Pure Anchors", -5))

    # Cap total penalty at -35
    if penalty > 35:
        penalty = 35

    return penalty, triggered


# ─────────────────────────────────────────────────────────────────────
# 5. SIXER SCORE → RECORD + TIER
# ─────────────────────────────────────────────────────────────────────

# 16-0 anchored at 110. Gaps start at 3 at the top and widen to 6
# toward the bottom. Anything below 45 collapses to 0-16.
SCORE_TO_RECORD = [
    (110, (16, 0)),
    (107, (15, 1)),
    (104, (14, 2)),
    (101, (13, 3)),
    (98,  (12, 4)),
    (94,  (11, 5)),
    (90,  (10, 6)),
    (86,  (9, 7)),
    (82,  (8, 8)),
    (77,  (7, 9)),
    (72,  (6, 10)),
    (67,  (5, 11)),
    (62,  (4, 12)),
    (57,  (3, 13)),
    (51,  (2, 14)),
    (45,  (1, 15)),
    (0,   (0, 16)),
]

def score_to_record(score):
    """Returns (wins, losses) tuple given a sixer score."""
    for threshold, record in SCORE_TO_RECORD:
        if score >= threshold:
            return record
    return (0, 16)


def tier_from_score(score, wins, losses):
    """Map score → tier letter. Aligned to new curve with
    0-16 floor below score 45."""
    if score >= 110: return "S"
    if score >= 104: return "A"
    if score >= 94:  return "B"
    if score >= 82:  return "C"
    if score >= 67:  return "D"
    if score >= 51:  return "E"
    return "F"


# ─────────────────────────────────────────────────────────────────────
# 6. DETERMINISTIC TIE-BREAK FOR BORDERLINE SCORES
# ─────────────────────────────────────────────────────────────────────

def _xi_hash_fraction(xi):
    """SHA256-based deterministic [0, 1) value from XI."""
    key_parts = []
    for p in sorted(xi, key=lambda x: (x.get("player_name", ""), x.get("season_year", 0))):
        key_parts.append(f"{p.get('player_name', '')}-{p.get('season_year', '')}")
    key_str = "|".join(key_parts)
    digest = hashlib.sha256(key_str.encode("utf-8")).hexdigest()
    return (int(digest[:8], 16) % 1_000_000) / 1_000_000.0


# ─────────────────────────────────────────────────────────────────────
# 7. EVALUATE XI
# ─────────────────────────────────────────────────────────────────────

def evaluate_xi(xi, mode='classic'):
    """
    Master entry point. Given an XI of 11 player dicts, return:
        wins, losses, sixer_score, tier, breakdown
    """
    # Per-player scores
    player_scores = [compute_player_score(p) for p in xi]
    raw_team_score = sum(player_scores)

    # Bonuses and penalties
    style_bonus, style_triggered = compute_style_bonuses(xi)
    penalty, penalty_triggered = compute_structural_penalties(xi)

    # Classic multiplier 0.956522 chosen so raw 115 → final 110.0 (16-0 threshold).
    # Adjust this to retune Classic ceiling without touching the SCORE_TO_RECORD curve.
    MODE_MULTIPLIER = {
        'classic': 0.956522,
        'criciq':  1.00,
        'daily':   1.00,
    }
    multiplier = MODE_MULTIPLIER.get(mode, 1.00)

    # Final score: apply multiplier, then deterministic fractional shift for ties
    raw_final = raw_team_score + style_bonus - penalty
    fraction_shift = (_xi_hash_fraction(xi) - 0.5) * 0.5  # ±0.25
    final_score = max(0, round((raw_final * multiplier + fraction_shift) * 100) / 100)

    # Derive record and tier
    wins, losses = score_to_record(final_score)
    tier = tier_from_score(final_score, wins, losses)

    return {
        "wins": wins,
        "losses": losses,
        "sixer_score": final_score,
        "tier": tier,
        "raw_team_score": round(raw_team_score, 2),
        "style_bonus": style_bonus,
        "style_triggered": style_triggered,
        "structural_penalty": penalty,
        "structural_triggered": penalty_triggered,
        "player_scores": [
            {
                "player": p.get("player_name", ""),
                "season": p.get("season_year", ""),
                "role": p.get("role_category", ""),
                "score": round(s, 2),
            }
            for p, s in zip(xi, player_scores)
        ],
    }