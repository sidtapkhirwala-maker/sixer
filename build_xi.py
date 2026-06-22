"""
build_xi.py

Build and test an XI by specifying player_name + season_year.
Pulls stats from sixer.db automatically.

Supports multiple input formats:
    ("Kohli", 2016)              # surname only — uses LIKE
    ("RG Sharma", 2019)          # initials + surname — disambiguates
    ("Kohli", 2016, "RCB")       # add franchise hint to disambiguate
    ("V Kohli", 2016, "exact")   # exact match (no wildcards)

Usage:
    1. Edit the XI_PICKS list below.
    2. Run: python build_xi.py
"""

import sqlite3
from season_engine import evaluate_xi

DB_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\sixer\sixer.db"

# ─────────────────────────────────────────────────────────────
# EDIT THIS LIST — 11 picks for your XI.
# Formats:
#   ("Kohli", 2016)                # name fragment + year
#   ("RG Sharma", 2019)            # specific initials to disambiguate
#   ("Sharma", 2019, "MI")         # franchise hint
#   ("V Kohli", 2016, "exact")     # exact name match
# ─────────────────────────────────────────────────────────────

XI_PICKS = [
    ("Tripathi", 2017),
    ("Markande", 2018),
    ("Agarwal", 2015),
    ("R Dhawan", 2014),
    ("Henriques", 2013),
    ("Morris", 2019),
    ("Dinda", 2014),
    ("Saha", 2022),
    ("PA Patel", 2016),
    ("Kohli", 2016),
    ("Pant", 2019),
]


def search_candidates(conn, name, year, franchise_hint=None, exact=False):
    """
    Return all draftable_pool matches for a (name, year) pick.
    Returns: list of dicts with full stats.
    """
    cur = conn.cursor()

    if exact:
        name_clause = "ps.player_name = ?"
        name_value = name
    else:
        name_clause = "ps.player_name LIKE ?"
        name_value = f"%{name}%"

    franchise_clause = ""
    params = [name_value, year]
    if franchise_hint:
        franchise_clause = "AND (ps.canonical_franchise LIKE ? OR ps.canonical_franchise LIKE ?)"
        params.extend([f"%{franchise_hint}%", f"{franchise_hint}%"])

    query = f"""
        SELECT
            ps.player_name,
            ps.season_year,
            dp.role_primary,
            dp.role_category,
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
        FROM player_seasons ps
        JOIN draftable_pool dp
          ON ps.player_name = dp.player_name
         AND ps.season_year = dp.season_year
        WHERE {name_clause}
          AND ps.season_year = ?
          {franchise_clause}
        ORDER BY ps.player_name
    """

    cur.execute(query, params)
    rows = cur.fetchall()
    return [_row_to_player(row) for row in rows]


def search_suggestions(conn, name, year):
    """
    Find near-matches when a pick fails: same surname, different year or initials.
    Returns: list of (player_name, season_year, franchise, role) tuples.
    """
    cur = conn.cursor()
    cur.execute("""
        SELECT DISTINCT
            ps.player_name,
            ps.season_year,
            ps.canonical_franchise,
            dp.role_category
        FROM player_seasons ps
        JOIN draftable_pool dp
          ON ps.player_name = dp.player_name
         AND ps.season_year = dp.season_year
        WHERE ps.player_name LIKE ?
        ORDER BY
            CASE WHEN ps.season_year = ? THEN 0 ELSE 1 END,
            ps.player_name,
            ps.season_year
        LIMIT 8
    """, (f"%{name}%", year))
    return cur.fetchall()


def _row_to_player(row):
    """Convert a SQL row into the player dict the engine expects."""
    (player_name, season_year, role_primary, role_category,
     franchise, runs_scored, matches_played, bat_sr, bat_avg,
     fours, sixes, balls_faced, wickets_taken,
     bowl_avg, bowl_econ, balls_bowled, wk_override) = row

    return {
        "player_name": player_name,
        "season_year": season_year,
        "role_primary": role_primary,
        "role_category": role_category,
        "franchise": franchise or "",
        "country": "",
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
    }


def parse_pick(pick):
    """
    Normalise a pick tuple into (name, year, franchise_hint, exact_flag).
    Supports:
        (name, year)
        (name, year, "franchise")
        (name, year, "exact")
    """
    if len(pick) == 2:
        name, year = pick
        return name, year, None, False
    elif len(pick) == 3:
        name, year, modifier = pick
        if modifier == "exact":
            return name, year, None, True
        else:
            return name, year, modifier, False
    else:
        raise ValueError(f"Invalid pick format: {pick}")


def resolve_pick(conn, pick):
    """
    Try to resolve a single pick to exactly one player.
    Returns: (player_dict or None, error_message or None)
    """
    name, year, franchise_hint, exact = parse_pick(pick)
    candidates = search_candidates(conn, name, year, franchise_hint, exact)

    if len(candidates) == 1:
        return candidates[0], None

    if len(candidates) == 0:
        return None, "not_found"

    # Multiple matches → ambiguous
    return None, ("ambiguous", candidates)


def print_suggestions_block(conn, name, year):
    """Print near-matches for a not-found pick."""
    suggestions = search_suggestions(conn, name, year)
    if not suggestions:
        print(f"      No close matches found.")
        return
    print(f"      Did you mean:")
    for s_name, s_year, s_franchise, s_role in suggestions:
        marker = ""
        if s_year != year:
            marker = " ← different year"
        franchise_str = f"({s_franchise})" if s_franchise else ""
        print(f"        • (\"{s_name}\", {s_year})  {franchise_str}  [{s_role}]{marker}")


def print_ambiguous_block(name, year, candidates):
    """Print all candidates when multiple matches exist for a name fragment."""
    print(f"      Multiple matches — be more specific:")
    for c in candidates:
        franchise_str = f"({c['franchise']})" if c['franchise'] else ""
        print(f"        • (\"{c['player_name']}\", {c['season_year']})  {franchise_str}  [{c['role_category']}]")
    print(f"      Tip: use exact initials e.g. (\"RG Sharma\", {year})")
    print(f"           or add franchise hint e.g. (\"{name}\", {year}, \"MI\")")


def main():
    conn = sqlite3.connect(DB_PATH)
    try:
        xi = []
        errors = []  # list of (pick, error_type, error_data)

        for pick in XI_PICKS:
            player, error = resolve_pick(conn, pick)
            if player is not None:
                xi.append(player)
            else:
                errors.append((pick, error))

        # Handle errors
        if errors:
            print("⚠️  Could not resolve all picks:\n")
            for pick, error in errors:
                name, year, _, _ = parse_pick(pick)
                if error == "not_found":
                    print(f"  ✗ (\"{name}\", {year}) — not found.")
                    print_suggestions_block(conn, name, year)
                elif isinstance(error, tuple) and error[0] == "ambiguous":
                    _, candidates = error
                    print(f"  ⚠ (\"{name}\", {year}) — {len(candidates)} matches:")
                    print_ambiguous_block(name, year, candidates)
                print()

            print(f"Found {len(xi)} / 11 players. Fix the picks above and re-run.\n")
            return

        if len(xi) != 11:
            print(f"⚠️  Got {len(xi)} players, need exactly 11. Aborting.")
            return

        # All good — run the engine
        result = evaluate_xi(xi)

        print(f"\n{'='*60}")
        print(f"  YOUR XI")
        print(f"{'='*60}\n")
        for i, ps in enumerate(result['player_scores'], 1):
            print(f"  {i:>2}. {ps['player']:<22} {ps['season']}  "
                  f"({ps['role']:<13}) {ps['score']:>5.2f}")

        print(f"\n{'='*60}")
        print(f"  RESULT")
        print(f"{'='*60}\n")
        print(f"  Sixer Score:   {result['sixer_score']} / 110")
        print(f"  Record:        {result['wins']}-{result['losses']}")
        print(f"  Tier:          {result['tier']}")
        print(f"  Raw team:      {result['raw_team_score']}")
        print(f"  Style bonus:   +{result['style_bonus']}")
        for s in result['style_triggered']:
            print(f"    + {s}")
        print(f"  Penalties:     -{result['structural_penalty']}")
        for name, mag in result['structural_triggered']:
            print(f"    {mag:+d} {name}")

    finally:
        conn.close()


if __name__ == "__main__":
    main()