"""
classify_roles.py
Classifies each player-season in sixer.db into a draft role.
Adds columns: role_primary, is_draftable, wicketkeeper_override,
              bowling_style_override, avg_batting_position
Usage: python classify_roles.py
"""

import sqlite3
import os
import json
import random
from collections import defaultdict

DB_PATH  = r"C:\Users\SiddharthTapkhirwala\Desktop\sixer\sixer.db"
DATA_DIR = r"C:\Users\SiddharthTapkhirwala\Desktop\sixer"
JSON_DIR = r"C:\Users\SiddharthTapkhirwala\Desktop\sixer\Data" 

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Compute avg batting position from Cricsheet JSONs
# avg_batting_position[player_id][season_year] = mean position across all innings
# ─────────────────────────────────────────────────────────────────────────────
def compute_batting_positions(data_dir):
    """
    Returns: { (player_name, season_year): avg_batting_position (float) }
    Keyed by the raw batter name string from JSON deliveries (e.g. 'PP Shaw'),
    which matches player_name in player_seasons directly.
    Batting position = order in which a batter first appeared in an innings (1-indexed).
    """
    # accumulator: (pid, season) → [list of positions]
    positions = defaultdict(list)

    json_files = sorted(f for f in os.listdir(data_dir) if f.lower().endswith(".json"))
    total = len(json_files)
    if total < 100:
        raise RuntimeError(
            f"Only {total} JSON files found in {data_dir}. "
            f"Expected ~1,000+ IPL match JSONs. Check the path passed to "
            f"compute_batting_positions() — should point at the Data\\ subfolder."
    )
    print(f"  Scanning {total} JSON files for batting positions...")

    for idx, filename in enumerate(json_files, 1):
        if idx % 200 == 0 or idx == total:
            print(f"    [{idx}/{total}] {filename}")
        try:
            with open(os.path.join(data_dir, filename), encoding="utf-8") as f:
                match = json.load(f)

            dates = match.get("info", {}).get("dates", [])
            if not dates:
                continue
            season_year = int(str(dates[0])[:4])

            for inning in match.get("innings", []):
                batting_team = inning.get("team", "")
                # Track order of first appearance in this innings
                seen_order   = {}   # player_id → position (1-indexed)
                for over in inning.get("overs", []):
                    for delivery in over.get("deliveries", []):
                        batter = delivery.get("batter", "")
                        if batter and batter not in seen_order:
                            seen_order[batter] = len(seen_order) + 1

                for pid, pos in seen_order.items():
                    positions[(pid, season_year)].append(pos)

        except Exception as e:
            print(f"  [WARNING] Skipping {filename}: {e}")
            continue

    # Average across all innings that season
    result = {}
    for (pid, season), pos_list in positions.items():
        result[(pid, season)] = sum(pos_list) / len(pos_list)

    print(f"  Computed batting positions for {len(result):,} (player, season) pairs.\n")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Add new columns to player_seasons
# ─────────────────────────────────────────────────────────────────────────────
def add_columns(cur):
    cur.execute("PRAGMA table_info(player_seasons)")
    existing = {row[1] for row in cur.fetchall()}

    new_cols = [
        ("role_primary",            "TEXT"),
        ("is_draftable",            "INTEGER"),   # 0/1
        ("wicketkeeper_override",   "INTEGER DEFAULT 0"),
        ("bowling_style_override",  "TEXT"),
        ("avg_batting_position",    "REAL"),
    ]
    for col, col_type in new_cols:
        if col not in existing:
            cur.execute(f"ALTER TABLE player_seasons ADD COLUMN {col} {col_type}")
            print(f"  Added column: {col}")
        else:
            print(f"  Column already exists (will overwrite): {col}")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Classify every row
# ─────────────────────────────────────────────────────────────────────────────
def classify(cur, batting_positions):
    """
    Classifies every player_seasons row into a role_primary.
    batting_positions: { (player_name, season_year): avg_batting_position }
    """
    cur.execute("SELECT id, player_name, season_year, matches_played, "
                "balls_faced, batting_strike_rate, batting_average, "
                "balls_bowled, wickets_taken, runs_scored "
                "FROM player_seasons")
    rows = cur.fetchall()
    print(f"  Classifying {len(rows):,} rows...")

    updates = []
    for (row_id, player_name, season, matches, balls_faced, bat_sr,
         bat_avg, balls_bowled, wickets, runs) in rows:

        bat_sr      = bat_sr      or 0.0
        bat_avg     = bat_avg     or 0.0
        balls_faced = balls_faced or 0
        balls_bowled= balls_bowled or 0
        wickets     = wickets     or 0
        runs        = runs        or 0
        matches     = matches     or 0

        # Look up avg batting position directly by player_name + season.
        # The batting_positions dict is keyed by the raw batter string from
        # JSON deliveries, which matches player_name in player_seasons exactly
        # (both come from the same Cricsheet "batter" field / people.csv name).
        # Using the people.csv identifier as the key was wrong — the JSONs use
        # names, not identifiers, in their delivery objects.
        avg_pos = batting_positions.get((player_name, season))
        # Fallback: approximate from runs-per-match (higher → top order)
        if avg_pos is None:
            rpm = runs / matches if matches > 0 else 0
            if rpm >= 35:
                avg_pos = 2.5
            elif rpm >= 20:
                avg_pos = 4.5
            else:
                avg_pos = 6.5

        # ── CLASSIFICATION ────────────────────────────────────────────────────
        # Threshold summary:
        #   Top-Order / Middle-Order : balls_faced >= 60  (need a real sample)
        #   Finisher                 : balls_faced >= 30  (lower — they bat late,
        #                              face fewer balls by design e.g. Dhoni)
        #   Pure bowler              : balls_bowled >= 24, balls_faced < 30
        #   All-rounder              : balls_bowled >= 24, balls_faced >= 30

        def position_role(avg_pos, balls_faced, bat_sr):
            """
            Return a batter role based on avg batting position and balls faced.
            Finisher threshold is intentionally lower (30 balls) to capture
            genuine late-order impact players who face fewer deliveries.
            Returns None if the sample is truly insufficient to classify.
            """
            if avg_pos <= 3.0:
                return "Top-Order Batter"
            elif avg_pos <= 5.0 and balls_faced >= 60:
                return "Middle-Order Batter"
            elif avg_pos > 5.0 and balls_faced >= 30:
                # Late-order batter with meaningful contribution → Finisher
                return "Finisher"
            elif avg_pos <= 5.0 and balls_faced >= 30:
                # Mid-order but lighter sample — still classify rather than drop
                return "Middle-Order Batter"
            else:
                return None   # truly insufficient

        # 1. Insufficient sample
        if matches < 3:
            role       = "Insufficient Sample"
            draftable  = 0

        # 2. Pure batter  (bowled < 24 balls)
        elif balls_bowled < 24:
            r = position_role(avg_pos, balls_faced, bat_sr)
            if r:
                role = r
            else:
                role = "Insufficient Sample"
            draftable = 1 if role != "Insufficient Sample" else 0

        # 3. Pure bowler  (bowled >= 24 balls AND batted < 48 balls)
        elif balls_bowled >= 24 and balls_faced < 48:
            role      = "Pace Bowler"   # bowling_style_override corrects spinners
            draftable = 1

        # 4. All-rounder  (bowled >= 24 AND faced >= 48)
        elif (
            matches > 0
            and balls_bowled / matches >=8
            and balls_faced / matches >= 5
            and balls_bowled >= 48
            and balls_faced >= 48
        ):
            wpg = wickets / matches if matches > 0 else 0
            if wpg >= 0.7:
                role = "Bowling All-Rounder"
            else:
                role = "Batting All-Rounder"
            draftable = 1

               # 5. Tweener — some bowling, some batting, neither threshold met
        else:
            # Bowler-priority guard: if they bowled meaningfully but didn't
            # bat enough per match to be an AR, classify as Bowler first.
            # This catches specialist bowlers who batted 30+ balls (≥1 ball
            # per match average) — without it, they get routed to Finisher
            # via position_role and lose their bowling identity.
            if balls_bowled >= 24 and (
                matches == 0 or balls_faced / matches < 5
            ):
                role      = "Pace Bowler"
                draftable = 1
            else:
                r = position_role(avg_pos, balls_faced, bat_sr)
                if r:
                    role      = r
                    draftable = 1
                elif balls_bowled >= 24:
                    role      = "Pace Bowler"
                    draftable = 1
                else:
                    role      = "Insufficient Sample"
                    draftable = 0
        updates.append((role, draftable, avg_pos, row_id))

    cur.executemany("""
        UPDATE player_seasons
        SET role_primary = ?, is_draftable = ?, avg_batting_position = ?
        WHERE id = ?
    """, updates)
    print(f"  Updated {len(updates):,} rows.\n")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Load people.csv for name → ID reverse map
# ─────────────────────────────────────────────────────────────────────────────
def load_people_reverse(data_dir):
    """Returns { full_name: identifier }"""
    import csv
    path = os.path.join(data_dir, "people.csv")
    reverse = {}
    if not os.path.exists(path):
        return reverse
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            identifier = row.get("identifier") or row.get("key_cricsheet") or ""
            name       = row.get("name") or ""
            if identifier and name:
                reverse[name.strip()] = identifier.strip()
    return reverse


# ─────────────────────────────────────────────────────────────────────────────
# VERIFICATION PRINTS
# ─────────────────────────────────────────────────────────────────────────────
def verify(cur):

    # ── 1. Role distribution ─────────────────────────────────────────────────
    print("=" * 65)
    print("  ROLE DISTRIBUTION (all seasons)")
    print("=" * 65)
    cur.execute("""
        SELECT role_primary, COUNT(*) AS cnt,
               SUM(is_draftable) AS draftable_cnt
        FROM player_seasons
        GROUP BY role_primary
        ORDER BY cnt DESC
    """)
    rows = cur.fetchall()
    total = sum(r[1] for r in rows)
    print(f"  {'Role':<28} {'Rows':>6}  {'Draftable':>9}  {'% of total':>10}")
    print(f"  {'-'*28} {'-'*6}  {'-'*9}  {'-'*10}")
    for role, cnt, draft in rows:
        pct = cnt / total * 100
        draft = draft or 0
        print(f"  {(role or 'NULL'):<28} {cnt:>6}  {draft:>9}  {pct:>9.1f}%")
    print(f"  {'TOTAL':<28} {total:>6}")

    # ── 2. IPL 2023 franchise squad roles ────────────────────────────────────
    print("\n" + "=" * 65)
    print("  2023 SQUAD ROLES — MAJOR FRANCHISES")
    print("=" * 65)

    franchises_2023 = [
        "Mumbai Indians", "Chennai Super Kings", "Royal Challengers Bengaluru",
        "Kolkata Knight Riders", "Delhi Capitals", "Sunrisers Hyderabad",
        "Rajasthan Royals", "Punjab Kings",
    ]
    for franchise in franchises_2023:
        cur.execute("""
            SELECT player_name, role_primary, matches_played,
                   runs_scored, wickets_taken, is_draftable
            FROM player_seasons
            WHERE season_year = 2023 AND canonical_franchise = ?
            ORDER BY role_primary, runs_scored DESC
        """, (franchise,))
        players = cur.fetchall()
        if not players:
            continue
        print(f"\n  ── {franchise} ({''.join(w[0] for w in franchise.split()[:2])}) ─────────────────────────────")
        print(f"  {'Player':<28} {'Role':<26} {'M':>3} {'Runs':>5} {'Wkts':>5} {'Draft':>6}")
        print(f"  {'-'*28} {'-'*26} {'-'*3} {'-'*5} {'-'*5} {'-'*6}")
        for name, role, m, runs, wkts, draft in players:
            draft_str = "✓" if draft else "–"
            print(f"  {name:<28} {(role or '?'):<26} {m:>3} {runs:>5} {wkts:>5} {draft_str:>6}")

    # ── 3. Sample of "Insufficient Sample" rows ───────────────────────────────
    print("\n" + "=" * 65)
    print("  10 RANDOM 'Insufficient Sample' ROWS (verify < 3 matches)")
    print("=" * 65)
    cur.execute("""
        SELECT player_name, season_year, canonical_franchise,
               matches_played, balls_faced, balls_bowled, runs_scored
        FROM player_seasons
        WHERE role_primary = 'Insufficient Sample'
        ORDER BY RANDOM()
        LIMIT 10
    """)
    rows = cur.fetchall()
    print(f"  {'Player':<28} {'Season':>6}  {'Franchise':<32} {'M':>3} {'BF':>4} {'BB':>4} {'Runs':>5}")
    print(f"  {'-'*28} {'-'*6}  {'-'*32} {'-'*3} {'-'*4} {'-'*4} {'-'*5}")
    for name, season, franchise, m, bf, bb, runs in rows:
        print(f"  {name:<28} {season:>6}  {(franchise or '?'):<32} {m:>3} {bf:>4} {bb:>4} {runs:>5}")

    # ── Bonus: total draftable count ──────────────────────────────────────────
    cur.execute("SELECT COUNT(*) FROM player_seasons WHERE is_draftable = 1")
    draftable = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM player_seasons")
    total_rows = cur.fetchone()[0]
    print(f"\n  Total draftable player-seasons : {draftable:,} / {total_rows:,}")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n========================================")
    print("  CLASSIFY ROLES")
    print("========================================\n")

    if not os.path.exists(DB_PATH):
        print(f"  ERROR: sixer.db not found at:\n  {DB_PATH}")
        raise SystemExit(1)

    print("Step 1/4 — Loading people.csv reverse map...")
    people_reverse = load_people_reverse(DATA_DIR)
    print(f"  Loaded {len(people_reverse):,} name → ID mappings.\n")

    print("Step 2/4 — Computing avg batting positions from JSONs...")
    batting_positions = compute_batting_positions(JSON_DIR)

    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    print("Step 3/4 — Adding columns to player_seasons...")
    add_columns(cur)
    print()

    print("Step 4/4 — Classifying roles...")
    classify(cur, batting_positions)

    conn.commit()

    print("Running verification...\n")
    verify(cur)

    conn.close()
    print("\n========================================")
    print("  Done.")
    print("========================================\n")
