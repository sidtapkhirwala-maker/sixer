"""
build_sixer_db.py
Processes Cricsheet IPL JSON match files into a clean SQLite database for Sixer.
Usage: python build_sixer_db.py
"""

import os
import json
import sqlite3
import csv
import math
from collections import defaultdict

# ─────────────────────────────────────────────
# CONFIG — adjust these paths if needed
# ─────────────────────────────────────────────
DATA_DIR    = r"C:\Users\SiddharthTapkhirwala\Desktop\Sixer - The Game\Data"
PEOPLE_CSV  = os.path.join(DATA_DIR, "people.csv")
DB_PATH     = os.path.join(DATA_DIR, "sixer.db")

# ─────────────────────────────────────────────
# FRANCHISE REBRAND MAP
# Maps old/variant names → canonical current name
# ─────────────────────────────────────────────
FRANCHISE_MAP = {
    # Delhi
    "Delhi Daredevils":                     "Delhi Capitals",
    "Delhi Capitals":                       "Delhi Capitals",
    # Punjab
    "Kings XI Punjab":                      "Punjab Kings",
    "Punjab Kings":                         "Punjab Kings",
    # Hyderabad
    "Deccan Chargers":                      "Sunrisers Hyderabad",
    "Sunrisers Hyderabad":                  "Sunrisers Hyderabad",
    # Mumbai
    "Mumbai Indians":                       "Mumbai Indians",
    # Chennai
    "Chennai Super Kings":                  "Chennai Super Kings",
    # Kolkata
    "Kolkata Knight Riders":                "Kolkata Knight Riders",
    # Rajasthan
    "Rajasthan Royals":                     "Rajasthan Royals",
    # Bangalore
    "Royal Challengers Bangalore":          "Royal Challengers Bengaluru",
    "Royal Challengers Bengaluru":          "Royal Challengers Bengaluru",
    # Kochi / Pune / Gujarat — defunct or short-lived
    "Kochi Tuskers Kerala":                 "Kochi Tuskers Kerala",
    "Pune Warriors":                        "Pune Warriors",
    "Rising Pune Supergiant":               "Rising Pune Supergiant",
    "Rising Pune Supergiants":              "Rising Pune Supergiant",
    "Gujarat Lions":                        "Gujarat Lions",
    "Lucknow Super Giants":                 "Lucknow Super Giants",
    "Gujarat Titans":                       "Gujarat Titans",
}

def canonical_team(name: str) -> str:
    """Return the canonical (current) franchise name."""
    return FRANCHISE_MAP.get(name, name)


# ─────────────────────────────────────────────
# LOAD people.csv  →  { identifier: full_name }
# ─────────────────────────────────────────────
def load_people(path: str) -> dict:
    people = {}
    if not os.path.exists(path):
        print(f"  [WARNING] people.csv not found at {path} — player IDs will be used as names.")
        return people
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Cricsheet people.csv columns: identifier, name  (sometimes: key_cricinfo etc.)
            identifier = row.get("identifier") or row.get("key_cricsheet") or ""
            name       = row.get("name") or ""
            if identifier and name:
                people[identifier.strip()] = name.strip()
    print(f"  Loaded {len(people):,} player mappings from people.csv")
    return people


# ─────────────────────────────────────────────
# ACCUMULATOR  —  keyed by (player_id, season, team_name_in_file)
# ─────────────────────────────────────────────
def empty_stats():
    return {
        "matches":         set(),   # match filenames, to count unique matches
        "runs_scored":     0,
        "balls_faced":     0,
        "fours":           0,
        "sixes":           0,
        "dismissals":      0,
        "wickets_taken":   0,
        "balls_bowled":    0,
        "runs_conceded":   0,
    }


def process_files(data_dir: str, people: dict):
    """Walk all JSON files and accumulate per (player, season, team) stats."""
    stats = defaultdict(empty_stats)   # key: (player_id, season, team_raw)

    json_files = [f for f in os.listdir(data_dir) if f.lower().endswith(".json")]
    total = len(json_files)
    print(f"\nFound {total} JSON files to process...\n")

    processed = 0
    skipped   = 0

    for idx, filename in enumerate(sorted(json_files), 1):
        filepath = os.path.join(data_dir, filename)

        # Progress every 50 files
        if idx % 50 == 0 or idx == total:
            print(f"  [{idx}/{total}] Processing {filename}...")

        try:
            with open(filepath, encoding="utf-8") as f:
                match = json.load(f)

            info    = match.get("info", {})
            innings = match.get("innings", [])

            # ── Season ──────────────────────────────────────────
            dates = info.get("dates", [])
            if not dates:
                print(f"  [WARNING] No dates in {filename} — skipping.")
                skipped += 1
                continue
            season_year = int(str(dates[0])[:4])

            # ── Team rosters per match ───────────────────────────
            # players dict: { team_name: [player_id, ...] }
            players_info = info.get("players", {})

            # Build reverse map: player_id → team_name (for this match)
            player_team = {}
            for team_name, player_list in players_info.items():
                for pid in player_list:
                    player_team[pid] = team_name

            # ── Mark all listed players as having played this match ──
            for pid, team_name in player_team.items():
                key = (pid, season_year, team_name)
                stats[key]["matches"].add(filename)

            # ── Walk deliveries ──────────────────────────────────
            for inning in innings:
                batting_team  = inning.get("team", "")
                overs_data    = inning.get("overs", [])

                for over in overs_data:
                    deliveries = over.get("deliveries", [])
                    for delivery in deliveries:
                        batter  = delivery.get("batter", "")
                        bowler  = delivery.get("bowler", "")
                        runs_d  = delivery.get("runs", {})

                        batter_runs  = runs_d.get("batter", 0)
                        extras_runs  = runs_d.get("extras", 0)
                        # runs charged to bowler = batter runs + extras
                        # (but wides/no-balls don't count as a legal delivery for batter)
                        extras_detail = delivery.get("extras", {})
                        is_wide    = "wides"    in extras_detail
                        is_noball  = "noballs"  in extras_detail

                        # ── BATTER stats ─────────────────────────
                        if batter and batting_team:
                            b_key = (batter, season_year, batting_team)
                            stats[b_key]["runs_scored"] += batter_runs
                            if not is_wide:          # wides don't count as a ball faced
                                stats[b_key]["balls_faced"] += 1
                            if batter_runs == 4:
                                stats[b_key]["fours"] += 1
                            if batter_runs == 6:
                                stats[b_key]["sixes"] += 1

                        # ── BOWLER stats ─────────────────────────
                        bowling_team = ""
                        # Determine bowling team from player_team map
                        if bowler in player_team:
                            bowling_team = player_team[bowler]

                        if bowler and bowling_team:
                            bw_key = (bowler, season_year, bowling_team)
                            # Runs conceded = batter runs + extras (except byes/legbyes which aren't charged to bowler)
                            byes     = extras_detail.get("byes",    0)
                            legbyes  = extras_detail.get("legbyes", 0)
                            runs_charged = batter_runs + extras_runs - byes - legbyes
                            stats[bw_key]["runs_conceded"] += runs_charged
                            if not is_wide and not is_noball:
                                stats[bw_key]["balls_bowled"] += 1

                        # ── WICKET stats ──────────────────────────
                        wickets = delivery.get("wickets", [])
                        for w in wickets:
                            kind = w.get("kind", "")
                            # run outs are not credited to bowler
                            if kind not in ("run out", "obstructing the field", "retired hurt", "retired out"):
                                if bowler and bowling_team:
                                    stats[(bowler, season_year, bowling_team)]["wickets_taken"] += 1
                            # batter dismissal
                            dismissed = w.get("player_out", "")
                            if dismissed and batting_team:
                                stats[(dismissed, season_year, batting_team)]["dismissals"] += 1

            processed += 1

        except Exception as e:
            print(f"  [WARNING] Skipping {filename} due to error: {e}")
            skipped += 1
            continue

    print(f"\n  Done. Processed: {processed}  |  Skipped: {skipped}\n")
    return stats


# ─────────────────────────────────────────────
# INFER ROLE
# ─────────────────────────────────────────────
def infer_role(runs, balls_faced, wickets, balls_bowled):
    is_batter = balls_faced >= 20 or runs >= 100
    is_bowler = balls_bowled >= 30 or wickets >= 3
    if is_batter and is_bowler:
        return "all-rounder"
    elif is_bowler:
        return "bowler"
    else:
        return "batter"


# ─────────────────────────────────────────────
# BUILD DATABASE
# ─────────────────────────────────────────────
def build_db(stats: dict, people: dict, db_path: str):
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"  Removed existing database at {db_path}")

    conn = sqlite3.connect(db_path)
    cur  = conn.cursor()

    cur.execute("""
        CREATE TABLE player_seasons (
            id                    INTEGER PRIMARY KEY AUTOINCREMENT,
            player_name           TEXT    NOT NULL,
            season_year           INTEGER NOT NULL,
            team                  TEXT    NOT NULL,
            current_franchise     TEXT    NOT NULL,
            role                  TEXT    NOT NULL,
            matches_played        INTEGER NOT NULL DEFAULT 0,
            runs_scored           INTEGER NOT NULL DEFAULT 0,
            balls_faced           INTEGER NOT NULL DEFAULT 0,
            batting_strike_rate   REAL,
            batting_average       REAL,
            fours                 INTEGER NOT NULL DEFAULT 0,
            sixes                 INTEGER NOT NULL DEFAULT 0,
            wickets_taken         INTEGER NOT NULL DEFAULT 0,
            balls_bowled          INTEGER NOT NULL DEFAULT 0,
            runs_conceded         INTEGER NOT NULL DEFAULT 0,
            bowling_economy       REAL,
            bowling_average       REAL
        )
    """)

    rows = []
    for (pid, season, team_raw), s in stats.items():
        player_name      = people.get(pid, pid)   # fall back to ID if not found
        matches_played   = len(s["matches"])
        runs_scored      = s["runs_scored"]
        balls_faced      = s["balls_faced"]
        fours            = s["fours"]
        sixes            = s["sixes"]
        dismissals       = s["dismissals"]
        wickets_taken    = s["wickets_taken"]
        balls_bowled     = s["balls_bowled"]
        runs_conceded    = s["runs_conceded"]

        batting_sr  = round(runs_scored / balls_faced * 100, 2) if balls_faced  > 0 else None
        batting_avg = round(runs_scored / dismissals,        2) if dismissals   > 0 else None
        overs_bowled = balls_bowled / 6
        bowl_econ   = round(runs_conceded / overs_bowled,    2) if overs_bowled > 0 else None
        bowl_avg    = round(runs_conceded / wickets_taken,   2) if wickets_taken > 0 else None

        role             = infer_role(runs_scored, balls_faced, wickets_taken, balls_bowled)
        current_franchise = canonical_team(team_raw)

        rows.append((
            player_name, season, team_raw, current_franchise, role,
            matches_played, runs_scored, balls_faced,
            batting_sr, batting_avg,
            fours, sixes,
            wickets_taken, balls_bowled, runs_conceded,
            bowl_econ, bowl_avg,
        ))

    cur.executemany("""
        INSERT INTO player_seasons (
            player_name, season_year, team, current_franchise, role,
            matches_played, runs_scored, balls_faced,
            batting_strike_rate, batting_average,
            fours, sixes,
            wickets_taken, balls_bowled, runs_conceded,
            bowling_economy, bowling_average
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, rows)

    # Helpful indexes for game queries
    cur.execute("CREATE INDEX idx_player    ON player_seasons(player_name)")
    cur.execute("CREATE INDEX idx_season    ON player_seasons(season_year)")
    cur.execute("CREATE INDEX idx_franchise ON player_seasons(current_franchise)")

    conn.commit()
    conn.close()
    print(f"  Database written to: {db_path}  ({len(rows):,} rows)\n")
    return rows


# ─────────────────────────────────────────────
# SUMMARY STATS
# ─────────────────────────────────────────────
def print_summary(db_path: str):
    conn = sqlite3.connect(db_path)
    cur  = conn.cursor()

    cur.execute("SELECT COUNT(DISTINCT player_name) FROM player_seasons")
    total_players = cur.fetchone()[0]

    cur.execute("SELECT COUNT(DISTINCT season_year) FROM player_seasons")
    total_seasons = cur.fetchone()[0]

    cur.execute("""
        SELECT player_name, SUM(runs_scored) AS total_runs
        FROM player_seasons
        GROUP BY player_name
        ORDER BY total_runs DESC
        LIMIT 5
    """)
    top5 = cur.fetchall()

    cur.execute("""
        SELECT player_name, SUM(wickets_taken) AS total_wkts
        FROM player_seasons
        GROUP BY player_name
        ORDER BY total_wkts DESC
        LIMIT 5
    """)
    top5_bowlers = cur.fetchall()

    conn.close()

    print("=" * 50)
    print("  SUMMARY")
    print("=" * 50)
    print(f"  Total unique players : {total_players:,}")
    print(f"  Total seasons covered: {total_seasons}")
    print()
    print("  Top 5 run-scorers (all time):")
    for i, (name, runs) in enumerate(top5, 1):
        print(f"    {i}. {name:<30} {runs:>6} runs")
    print()
    print("  Top 5 wicket-takers (all time):")
    for i, (name, wkts) in enumerate(top5_bowlers, 1):
        print(f"    {i}. {name:<30} {wkts:>4} wickets")
    print("=" * 50)


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
if __name__ == "__main__":
    print("\n========================================")
    print("  SIXER DB BUILDER")
    print("========================================\n")

    print("Step 1/3 — Loading player name mappings...")
    people = load_people(PEOPLE_CSV)

    print("\nStep 2/3 — Processing match files...")
    stats = process_files(DATA_DIR, people)

    print("Step 3/3 — Writing SQLite database...")
    build_db(stats, people, DB_PATH)

    print_summary(DB_PATH)
    print("\n  All done! Your database is ready at:")
    print(f"  {DB_PATH}\n")
