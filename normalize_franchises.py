"""
normalize_franchises.py
Creates a franchises table in sixer.db and normalises the player_seasons
"team" column into a new "canonical_franchise" column.
Usage: python normalize_franchises.py
"""

import sqlite3
import os

DB_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\Sixer - The Game\Data\sixer.db"

# ─────────────────────────────────────────────────────────────────────────────
# FRANCHISE DEFINITIONS
# Each entry:  (canonical_name, short_code, primary_color, secondary_color,
#               [historical_names, ...], active)
# The canonical_name itself is always included as a historical name implicitly.
# ─────────────────────────────────────────────────────────────────────────────
FRANCHISES = [
    # ── Active franchises ────────────────────────────────────────────────────
    (
        "Mumbai Indians", "MI",
        "#004BA0", "#D1AB3E",
        ["Mumbai Indians"],
        True,
    ),
    (
        "Chennai Super Kings", "CSK",
        "#FFFF00", "#1F4E79",
        ["Chennai Super Kings"],
        True,
    ),
    (
        "Royal Challengers Bengaluru", "RCB",
        "#DA1818", "#000000",
        ["Royal Challengers Bengaluru", "Royal Challengers Bangalore"],
        True,
    ),
    (
        "Kolkata Knight Riders", "KKR",
        "#3A225D", "#B3A123",
        ["Kolkata Knight Riders"],
        True,
    ),
    (
        "Delhi Capitals", "DC",
        "#17449B", "#EF1B23",
        ["Delhi Capitals", "Delhi Daredevils"],
        True,
    ),
    (
        "Sunrisers Hyderabad", "SRH",
        "#FF822A", "#000000",
        ["Sunrisers Hyderabad"],
        True,
    ),
    (
        "Rajasthan Royals", "RR",
        "#254AA5", "#FF69B4",
        ["Rajasthan Royals"],
        True,
    ),
    (
        "Punjab Kings", "PBKS",
        "#ED1C24", "#DCDDDF",
        ["Punjab Kings", "Kings XI Punjab"],
        True,
    ),
    (
        "Lucknow Super Giants", "LSG",
        "#A72056", "#FFCC00",
        ["Lucknow Super Giants"],
        True,
    ),
    (
        "Gujarat Titans", "GT",
        "#1B2951", "#B3A123",
        ["Gujarat Titans"],
        True,
    ),
    # ── Inactive / defunct ───────────────────────────────────────────────────
    (
        "Deccan Chargers", "DCH",
        "#1B2951", "#C0C0C0",
        ["Deccan Chargers"],
        False,
    ),
    (
        "Pune Warriors India", "PWI",
        "#6F2DA8", "#FFD700",
        ["Pune Warriors India", "Pune Warriors"],
        False,
    ),
    (
        "Kochi Tuskers Kerala", "KTK",
        "#F7A800", "#8B0000",
        ["Kochi Tuskers Kerala"],
        False,
    ),
    (
        "Gujarat Lions", "GL",
        "#E8472A", "#1D2D5E",
        ["Gujarat Lions"],
        False,
    ),
    (
        "Rising Pune Supergiant", "RPS",
        "#6F2DA8", "#FFD700",
        ["Rising Pune Supergiant", "Rising Pune Supergiants"],
        False,
    ),
]

# ─────────────────────────────────────────────────────────────────────────────
# Build flat lookup:  any historical name  →  canonical_name
# ─────────────────────────────────────────────────────────────────────────────
def build_lookup(franchises):
    lookup = {}
    for canonical, short, pc, sc, hist_names, active in franchises:
        for name in hist_names:
            lookup[name.strip()] = canonical
        # Also ensure canonical itself maps to itself even if not in hist_names
        lookup[canonical.strip()] = canonical
    return lookup


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Create & populate franchises table
# ─────────────────────────────────────────────────────────────────────────────
def create_franchises_table(cur, franchises):
    cur.execute("DROP TABLE IF EXISTS franchises")
    cur.execute("""
        CREATE TABLE franchises (
            franchise_id        INTEGER PRIMARY KEY AUTOINCREMENT,
            canonical_name      TEXT    NOT NULL UNIQUE,
            short_code          TEXT    NOT NULL,
            primary_color       TEXT    NOT NULL,
            secondary_color     TEXT    NOT NULL,
            all_historical_names TEXT   NOT NULL,
            active              INTEGER NOT NULL  -- 1 = active, 0 = defunct
        )
    """)

    rows = []
    for canonical, short, pc, sc, hist_names, active in franchises:
        # Deduplicate & preserve order
        seen = {}
        for n in hist_names:
            seen[n.strip()] = None
        seen[canonical.strip()] = None          # canonical always last if not already present
        all_names = ", ".join(seen.keys())
        rows.append((canonical, short, pc, sc, all_names, int(active)))

    cur.executemany("""
        INSERT INTO franchises
            (canonical_name, short_code, primary_color, secondary_color,
             all_historical_names, active)
        VALUES (?, ?, ?, ?, ?, ?)
    """, rows)

    print(f"  Inserted {len(rows)} franchises into franchises table.")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Add canonical_franchise column to player_seasons & populate it
# ─────────────────────────────────────────────────────────────────────────────
def add_canonical_column(cur, lookup):
    # Add column if it doesn't already exist
    cur.execute("PRAGMA table_info(player_seasons)")
    existing_cols = {row[1] for row in cur.fetchall()}
    if "canonical_franchise" not in existing_cols:
        cur.execute("ALTER TABLE player_seasons ADD COLUMN canonical_franchise TEXT")
        print("  Added column 'canonical_franchise' to player_seasons.")
    else:
        print("  Column 'canonical_franchise' already exists — will overwrite values.")

    # Fetch all distinct team values present in the table
    cur.execute("SELECT DISTINCT team FROM player_seasons")
    teams = [row[0] for row in cur.fetchall()]

    mapped   = 0
    unmapped = []
    for team in teams:
        canonical = lookup.get(team.strip()) if team else None
        if canonical:
            cur.execute(
                "UPDATE player_seasons SET canonical_franchise = ? WHERE team = ?",
                (canonical, team)
            )
            mapped += 1
        else:
            unmapped.append(team)

    # Null out anything that wasn't mapped (e.g. stale values from re-runs)
    cur.execute(
        "UPDATE player_seasons SET canonical_franchise = NULL WHERE team NOT IN ({})".format(
            ",".join("?" * len(teams))
        ),
        teams,
    )

    print(f"  Mapped   : {mapped} distinct team names")
    if unmapped:
        print(f"  UNMAPPED : {unmapped}")
    else:
        print("  Unmapped : none")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Verification prints
# ─────────────────────────────────────────────────────────────────────────────
def verify(cur):
    # ── A. All franchises with historical names ──────────────────────────────
    print("\n" + "=" * 70)
    print("  FRANCHISE REGISTRY")
    print("=" * 70)
    cur.execute("""
        SELECT franchise_id, canonical_name, short_code,
               primary_color, secondary_color, all_historical_names, active
        FROM franchises
        ORDER BY active DESC, canonical_name
    """)
    rows = cur.fetchall()
    for fid, name, code, pc, sc, hist, active in rows:
        status = "ACTIVE" if active else "defunct"
        print(f"  [{fid:>2}] {code:<5}  {name:<30}  {pc}  {sc}  [{status}]")
        # Only print historical names if there's more than one
        alt_names = [n.strip() for n in hist.split(",") if n.strip() != name]
        if alt_names:
            print(f"        Also known as: {', '.join(alt_names)}")

    # ── B. NULL canonical_franchise rows ────────────────────────────────────
    print("\n" + "=" * 70)
    print("  NULL canonical_franchise CHECK")
    print("=" * 70)
    cur.execute("""
        SELECT COUNT(*) FROM player_seasons WHERE canonical_franchise IS NULL
    """)
    null_count = cur.fetchone()[0]
    if null_count == 0:
        print("  ✓ All rows mapped — 0 NULLs.")
    else:
        print(f"  !! {null_count} rows have NULL canonical_franchise.")
        cur.execute("""
            SELECT DISTINCT team, COUNT(*) as cnt
            FROM player_seasons
            WHERE canonical_franchise IS NULL
            GROUP BY team
            ORDER BY cnt DESC
        """)
        for team, cnt in cur.fetchall():
            print(f"     Unmapped team: '{team}'  ({cnt} rows)")

    # ── C. Season counts per franchise ──────────────────────────────────────
    print("\n" + "=" * 70)
    print("  SEASONS IN DATA PER FRANCHISE")
    print("=" * 70)
    cur.execute("""
        SELECT
            ps.canonical_franchise,
            f.short_code,
            COUNT(DISTINCT ps.season_year)  AS seasons,
            MIN(ps.season_year)             AS first_season,
            MAX(ps.season_year)             AS last_season,
            COUNT(*)                        AS total_rows
        FROM player_seasons ps
        LEFT JOIN franchises f ON ps.canonical_franchise = f.canonical_name
        WHERE ps.canonical_franchise IS NOT NULL
        GROUP BY ps.canonical_franchise
        ORDER BY first_season, ps.canonical_franchise
    """)
    rows = cur.fetchall()
    print(f"  {'Franchise':<32} {'Code':<6} {'Seasons':>7}  {'First':>6}  {'Last':>6}  {'Rows':>6}")
    print(f"  {'-'*32} {'-'*6} {'-'*7}  {'-'*6}  {'-'*6}  {'-'*6}")
    for name, code, seasons, first, last, rows_count in rows:
        code = code or "?"
        print(f"  {name:<32} {code:<6} {seasons:>7}  {first:>6}  {last:>6}  {rows_count:>6}")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n========================================")
    print("  NORMALIZE FRANCHISES")
    print("========================================\n")

    if not os.path.exists(DB_PATH):
        print(f"  ERROR: sixer.db not found at:\n  {DB_PATH}")
        raise SystemExit(1)

    lookup = build_lookup(FRANCHISES)
    print(f"  Lookup table built: {len(lookup)} name variants → canonical names\n")

    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    print("Step 1/2 — Creating franchises table...")
    create_franchises_table(cur, FRANCHISES)

    print("\nStep 2/2 — Populating canonical_franchise in player_seasons...")
    add_canonical_column(cur, lookup)

    conn.commit()

    print("\nRunning verification...")
    verify(cur)

    conn.close()
    print("\n========================================")
    print("  Done.")
    print("========================================\n")
