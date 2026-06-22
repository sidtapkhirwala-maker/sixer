"""
apply_display_names.py
Backfills display_name in player_seasons from people.csv.
Run BEFORE build_draftable_pool.py so display_name flows through.
"""
import sqlite3
import csv
import os

DB_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\sixer\sixer.db"
PEOPLE_CSV = r"C:\Users\SiddharthTapkhirwala\Desktop\sixer\people.csv"

def load_name_map():
    """Returns { cricsheet_short_name: full_name }"""
    name_map = {}
    with open(PEOPLE_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Cricsheet's people.csv has columns: identifier, name, unique_name, key_*
            # The "name" field is the full readable name (e.g. "Virat Kohli")
            # The form used in deliveries is typically "name" itself or a short form
            short = (row.get("unique_name") or row.get("name") or "").strip()
            full = (row.get("name") or "").strip()
            if short and full:
                name_map[short] = full
    return name_map

def ensure_column(cur):
    cur.execute("PRAGMA table_info(player_seasons)")
    existing = {row[1] for row in cur.fetchall()}
    if "display_name" not in existing:
        cur.execute("ALTER TABLE player_seasons ADD COLUMN display_name TEXT")
        print("  Added column: display_name")
    else:
        print("  Column exists: display_name")

def apply_names(cur, name_map):
    # Get all unique player_names in the DB
    cur.execute("SELECT DISTINCT player_name FROM player_seasons")
    db_names = [r[0] for r in cur.fetchall()]

    updated = 0
    missing = []
    for short in db_names:
        full = name_map.get(short)
        if full and full != short:
            cur.execute(
                "UPDATE player_seasons SET display_name = ? WHERE player_name = ?",
                (full, short)
            )
            updated += cur.rowcount
        else:
            # Either name_map had no entry, or short == full already
            # Fallback: use the short name as the display name
            cur.execute(
                "UPDATE player_seasons SET display_name = ? WHERE player_name = ?",
                (short, short)
            )
            if not full:
                missing.append(short)

    return updated, missing

if __name__ == "__main__":
    print("\n========================================")
    print("  APPLY DISPLAY NAMES")
    print("========================================\n")

    print(f"  Using DB: {DB_PATH}")
    print(f"  Using people.csv: {PEOPLE_CSV}")
    print(f"  Both exist: {os.path.exists(DB_PATH) and os.path.exists(PEOPLE_CSV)}\n")

    name_map = load_name_map()
    print(f"Loaded {len(name_map):,} short → full name mappings.\n")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    ensure_column(cur)
    updated, missing = apply_names(cur, name_map)
    conn.commit()

    print(f"\n  Rows with display_name set: (run a SELECT to verify)")
    print(f"  Distinct names looked up: {len(set(missing) | set(name_map.keys()))}")
    print(f"  Names not found in people.csv (fell back to short form): {len(missing)}")

    # Spot-check
    print("\nSpot-check:")
    samples = ["V Kohli", "JJ Bumrah", "AC Gilchrist", "RT Ponting",
               "BB McCullum", "Rashid Khan", "MS Dhoni", "AB de Villiers"]
    for short in samples:
        cur.execute("SELECT DISTINCT display_name FROM player_seasons WHERE player_name = ?", (short,))
        row = cur.fetchone()
        if row:
            print(f"  {short:<20} → {row[0]}")
        else:
            print(f"  {short:<20} → (not in DB)")

    if missing:
        print(f"\n  Sample of {min(20, len(missing))} names without a full-name mapping:")
        for n in sorted(missing)[:20]:
            print(f"    {n}")

    conn.close()
    print("\nDone.\n")