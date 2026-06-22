"""
verify_data.py
Opens sixer.db and prints specific lookups to verify data accuracy.
Usage: python verify_data.py
"""

import sqlite3
import os

DB_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\Sixer - The Game\Data\sixer.db"

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def section(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)

def na(val, suffix="", decimals=None):
    """Format a value nicely; show N/A for None."""
    if val is None:
        return "N/A"
    if decimals is not None:
        return f"{val:.{decimals}f}{suffix}"
    return f"{val}{suffix}"

def print_player_row(row, cur):
    """Pretty-print a single player_seasons row by column name."""
    cols = [d[0] for d in cur.description]
    d    = dict(zip(cols, row))
    print(f"  Player          : {d.get('player_name', '?')}")
    print(f"  Season          : {d.get('season_year', '?')}")
    print(f"  Team (that year): {d.get('team', '?')}")
    print(f"  Franchise       : {d.get('current_franchise', '?')}")
    print(f"  Role            : {d.get('role', '?')}")
    print(f"  Matches Played  : {d.get('matches_played', 0)}")
    print()
    print(f"  ── BATTING ──────────────────────────────")
    print(f"  Runs Scored     : {d.get('runs_scored', 0)}")
    print(f"  Balls Faced     : {d.get('balls_faced', 0)}")
    print(f"  Strike Rate     : {na(d.get('batting_strike_rate'), decimals=2)}")
    print(f"  Average         : {na(d.get('batting_average'),     decimals=2)}")
    print(f"  Fours           : {d.get('fours', 0)}")
    print(f"  Sixes           : {d.get('sixes', 0)}")
    print()
    print(f"  ── BOWLING ──────────────────────────────")
    print(f"  Wickets Taken   : {d.get('wickets_taken', 0)}")
    print(f"  Balls Bowled    : {d.get('balls_bowled', 0)}")
    print(f"  Runs Conceded   : {d.get('runs_conceded', 0)}")
    print(f"  Economy         : {na(d.get('bowling_economy'),  decimals=2)}")
    print(f"  Bowling Average : {na(d.get('bowling_average'),  decimals=2)}")

def fuzzy_player_rows(cur, name_fragment, season=None):
    """
    Search for a player using a LIKE match on player_name.
    Returns all matching rows (optionally filtered by season).
    Also prints a warning if multiple distinct names matched.
    """
    if season:
        cur.execute("""
            SELECT * FROM player_seasons
            WHERE player_name LIKE ? AND season_year = ?
            ORDER BY season_year
        """, (f"%{name_fragment}%", season))
    else:
        cur.execute("""
            SELECT * FROM player_seasons
            WHERE player_name LIKE ?
            ORDER BY season_year DESC
        """, (f"%{name_fragment}%",))

    rows = cur.fetchall()
    if not rows:
        return []

    # Warn if multiple distinct names came back
    cols       = [d[0] for d in cur.description]
    name_col   = cols.index("player_name")
    found_names = list(dict.fromkeys(r[name_col] for r in rows))  # preserve order, dedupe
    if len(found_names) > 1:
        print(f"  [NOTE] Multiple players matched '{name_fragment}': {found_names}")
        print(f"         Showing all of them.\n")
    return rows


# ─────────────────────────────────────────────
# CHECKS
# ─────────────────────────────────────────────

def check_1_kohli_2016(cur):
    section("1. Virat Kohli — IPL 2016")
    rows = fuzzy_player_rows(cur, "Kohli", season=2016)
    if not rows:
        print("  !! No rows found. Check player name in DB.")
        # Helper: show what 'Kohli' maps to
        cur.execute("SELECT DISTINCT player_name FROM player_seasons WHERE player_name LIKE '%Kohli%'")
        alts = cur.fetchall()
        if alts:
            print(f"  Players with 'Kohli' in name: {[r[0] for r in alts]}")
        return
    for row in rows:
        print_player_row(row, cur)


def check_2_gayle_2011(cur):
    section("2. Chris Gayle — IPL 2011")
    rows = fuzzy_player_rows(cur, "Gayle", season=2011)
    if not rows:
        print("  !! No rows found.")
        cur.execute("SELECT DISTINCT player_name FROM player_seasons WHERE player_name LIKE '%Gayle%'")
        alts = cur.fetchall()
        if alts:
            print(f"  Players with 'Gayle' in name: {[r[0] for r in alts]}")
        return
    for row in rows:
        print_player_row(row, cur)


def check_3_symonds_2008(cur):
    section("3. Andrew Symonds — IPL 2008")
    rows = fuzzy_player_rows(cur, "Symonds", season=2008)
    if not rows:
        print("  !! No rows found.")
        cur.execute("SELECT DISTINCT player_name FROM player_seasons WHERE player_name LIKE '%Symonds%'")
        alts = cur.fetchall()
        if alts:
            print(f"  Players with 'Symonds' in name: {[r[0] for r in alts]}")
        return
    for row in rows:
        print_player_row(row, cur)


def check_4_top10_batters_2023(cur):
    section("4. Top 10 Run-Scorers — IPL 2023")
    cur.execute("""
        SELECT player_name, current_franchise, runs_scored, balls_faced,
               batting_strike_rate, batting_average, fours, sixes, matches_played
        FROM player_seasons
        WHERE season_year = 2023
        ORDER BY runs_scored DESC
        LIMIT 10
    """)
    rows = cur.fetchall()
    if not rows:
        print("  !! No data found for 2023.")
        return
    print(f"  {'#':<3} {'Player':<28} {'Team':<32} {'Runs':>5} {'BF':>5} {'SR':>7} {'Avg':>7} {'4s':>4} {'6s':>4} {'M':>3}")
    print(f"  {'-'*3} {'-'*28} {'-'*32} {'-'*5} {'-'*5} {'-'*7} {'-'*7} {'-'*4} {'-'*4} {'-'*3}")
    for i, (name, team, runs, bf, sr, avg, fours, sixes, matches) in enumerate(rows, 1):
        print(f"  {i:<3} {name:<28} {team:<32} {runs:>5} {bf:>5} {na(sr,decimals=1):>7} {na(avg,decimals=1):>7} {fours:>4} {sixes:>4} {matches:>3}")


def check_5_top10_bowlers_2024(cur):
    section("5. Top 10 Wicket-Takers — IPL 2024")
    cur.execute("""
        SELECT player_name, current_franchise, wickets_taken, balls_bowled,
               runs_conceded, bowling_economy, bowling_average, matches_played
        FROM player_seasons
        WHERE season_year = 2024
        ORDER BY wickets_taken DESC
        LIMIT 10
    """)
    rows = cur.fetchall()
    if not rows:
        print("  !! No data found for 2024.")
        return
    print(f"  {'#':<3} {'Player':<28} {'Team':<32} {'Wkts':>5} {'BB':>5} {'RC':>5} {'Econ':>6} {'BWAvg':>7} {'M':>3}")
    print(f"  {'-'*3} {'-'*28} {'-'*32} {'-'*5} {'-'*5} {'-'*5} {'-'*6} {'-'*7} {'-'*3}")
    for i, (name, team, wkts, bb, rc, econ, bwavg, matches) in enumerate(rows, 1):
        print(f"  {i:<3} {name:<28} {team:<32} {wkts:>5} {bb:>5} {rc:>5} {na(econ,decimals=2):>6} {na(bwavg,decimals=1):>7} {matches:>3}")


def check_6_narine_last5(cur):
    section("6. Sunil Narine — Last 5 Seasons (Batting + Bowling)")
    rows = fuzzy_player_rows(cur, "Narine")
    if not rows:
        print("  !! No rows found.")
        cur.execute("SELECT DISTINCT player_name FROM player_seasons WHERE player_name LIKE '%Narine%'")
        alts = cur.fetchall()
        if alts:
            print(f"  Players with 'Narine' in name: {[r[0] for r in alts]}")
        return

    # rows already sorted DESC by season; take last 5
    rows = rows[:5]
    cols = [d[0] for d in cur.description]

    # Header
    print(f"  {'Season':<8} {'Team':<32} {'M':>3}  {'Runs':>5} {'BF':>5} {'SR':>7} {'Avg':>7} {'4s':>4} {'6s':>4}  {'Wkts':>5} {'BB':>5} {'RC':>5} {'Econ':>6} {'BWAvg':>7}")
    print(f"  {'-'*8} {'-'*32} {'-'*3}  {'-'*5} {'-'*5} {'-'*7} {'-'*7} {'-'*4} {'-'*4}  {'-'*5} {'-'*5} {'-'*5} {'-'*6} {'-'*7}")
    for row in rows:
        d = dict(zip(cols, row))
        print(
            f"  {d['season_year']:<8} {d['current_franchise']:<32} {d['matches_played']:>3}  "
            f"{d['runs_scored']:>5} {d['balls_faced']:>5} {na(d['batting_strike_rate'],decimals=1):>7} "
            f"{na(d['batting_average'],decimals=1):>7} {d['fours']:>4} {d['sixes']:>4}  "
            f"{d['wickets_taken']:>5} {d['balls_bowled']:>5} {d['runs_conceded']:>5} "
            f"{na(d['bowling_economy'],decimals=2):>6} {na(d['bowling_average'],decimals=1):>7}"
        )


def check_7_unique_players(cur):
    section("7. Total Unique Players in Database")
    cur.execute("SELECT COUNT(DISTINCT player_name) FROM player_seasons")
    count = cur.fetchone()[0]
    print(f"  Unique players: {count:,}")


def check_8_total_rows(cur):
    section("8. Total (Player, Season) Rows")
    cur.execute("SELECT COUNT(*) FROM player_seasons")
    total = cur.fetchone()[0]
    cur.execute("SELECT COUNT(DISTINCT season_year) FROM player_seasons")
    seasons = cur.fetchone()[0]
    cur.execute("SELECT MIN(season_year), MAX(season_year) FROM player_seasons")
    min_yr, max_yr = cur.fetchone()
    print(f"  Total rows       : {total:,}")
    print(f"  Seasons covered  : {seasons}  ({min_yr} – {max_yr})")


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print("\n========================================")
    print("  SIXER DB — DATA VERIFICATION")
    print("========================================")

    if not os.path.exists(DB_PATH):
        print(f"\n  ERROR: Database not found at:\n  {DB_PATH}")
        print("  Run build_sixer_db.py first.\n")
        raise SystemExit(1)

    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    check_1_kohli_2016(cur)
    check_2_gayle_2011(cur)
    check_3_symonds_2008(cur)
    check_4_top10_batters_2023(cur)
    check_5_top10_bowlers_2024(cur)
    check_6_narine_last5(cur)
    check_7_unique_players(cur)
    check_8_total_rows(cur)

    conn.close()

    print("\n" + "=" * 60)
    print("  Verification complete.")
    print("=" * 60 + "\n")
