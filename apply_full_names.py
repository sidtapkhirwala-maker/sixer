"""
apply_full_names.py
Applies the hand-curated display name mapping from display_names.json
to player_seasons. Run BEFORE build_draftable_pool.py so display_name
flows through into the draftable_pool.
"""

import json
import sqlite3
import os

DB_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\sixer\sixer.db"
JSON_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\sixer\display_names.json"


def ensure_column(cur):
    cur.execute("PRAGMA table_info(player_seasons)")
    existing = {row[1] for row in cur.fetchall()}
    if "display_name" not in existing:
        cur.execute("ALTER TABLE player_seasons ADD COLUMN display_name TEXT")
        print("  Added column: display_name")
    else:
        print("  Column already exists: display_name")


def apply_names(cur, mapping):
    """Update display_name for every player in the mapping.
    Returns (rows_updated, names_in_mapping_not_in_db)."""
    cur.execute("SELECT DISTINCT player_name FROM player_seasons")
    db_names = {r[0] for r in cur.fetchall()}

    updated = 0
    missing_in_db = []

    for short, full in mapping.items():
        if short not in db_names:
            missing_in_db.append(short)
            continue
        cur.execute(
            "UPDATE player_seasons SET display_name = ? WHERE player_name = ?",
            (full, short)
        )
        updated += cur.rowcount

    # For everyone NOT in the mapping, fall back to short form
    cur.execute("""
        UPDATE player_seasons
        SET display_name = player_name
        WHERE display_name IS NULL OR display_name = ''
    """)
    fallback_count = cur.rowcount

    return updated, missing_in_db, fallback_count


def verify(cur):
    print("\n" + "=" * 60)
    print("  SPOT-CHECK (15 star players)")
    print("=" * 60)
    samples = [
        ("V Kohli", 2016), ("JJ Bumrah", 2020), ("MS Dhoni", 2013),
        ("RA Jadeja", 2021), ("HH Pandya", 2018), ("KL Rahul", 2020),
        ("RG Sharma", 2020), ("AB de Villiers", 2016), ("AC Gilchrist", 2008),
        ("RT Ponting", 2008), ("AD Russell", 2019), ("SP Narine", 2024),
        ("Rashid Khan", 2020), ("JC Buttler", 2022), ("GJ Maxwell", 2021),
    ]
    for name, year in samples:
        cur.execute("""
            SELECT player_name, display_name
            FROM player_seasons
            WHERE player_name = ? AND season_year = ?
            LIMIT 1
        """, (name, year))
        row = cur.fetchone()
        if row:
            print(f"  {row[0]:25} → {row[1]}")
        else:
            print(f"  {name:25} → NOT FOUND")

    # Count
    cur.execute("""
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN display_name IS NULL OR display_name = '' THEN 1 ELSE 0 END) AS empty,
            SUM(CASE WHEN display_name = player_name THEN 1 ELSE 0 END) AS same_as_short,
            SUM(CASE WHEN display_name != player_name THEN 1 ELSE 0 END) AS expanded
        FROM player_seasons
    """)
    total, empty, same, expanded = cur.fetchone()
    print(f"\n  Total rows:          {total:,}")
    print(f"  display_name empty:  {empty}")
    print(f"  Same as short form:  {same:,}")
    print(f"  Expanded to full:    {expanded:,}")


if __name__ == "__main__":
    print("\n========================================")
    print("  APPLY FULL DISPLAY NAMES")
    print("========================================\n")

    print(f"  Using DB: {DB_PATH}")
    print(f"  Using JSON: {JSON_PATH}")
    print(f"  Both exist: {os.path.exists(DB_PATH) and os.path.exists(JSON_PATH)}\n")

    if not (os.path.exists(DB_PATH) and os.path.exists(JSON_PATH)):
        raise SystemExit("Missing file. Aborting.")

    with open(JSON_PATH, encoding="utf-8") as f:
        mapping = json.load(f)
    print(f"Loaded {len(mapping)} short → full name mappings.\n")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print("Step 1/2 — Ensuring column exists...")
    ensure_column(cur)

    print("\nStep 2/2 — Applying display names...")
    updated, missing_in_db, fallback_count = apply_names(cur, mapping)
    print(f"  Rows updated with mapped name: {updated:,}")
    print(f"  Rows filled with fallback (short form): {fallback_count}")
    if missing_in_db:
        print(f"\n  Names in JSON but not in DB ({len(missing_in_db)}):")
        for n in missing_in_db[:15]:
            print(f"    {n}")
        if len(missing_in_db) > 15:
            print(f"    ... and {len(missing_in_db) - 15} more")

    conn.commit()
    verify(cur)
    conn.close()

    print("\n========================================")
    print("  Done.")
    print("========================================\n")