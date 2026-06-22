import sqlite3, json, os

DB_PATH  = r"C:\Users\SiddharthTapkhirwala\Desktop\Sixer - The Game\Data\sixer.db"
DATA_DIR = r"C:\Users\SiddharthTapkhirwala\Desktop\Sixer - The Game\Data"

# ── 1. What's in the DB for Shaw ─────────────────────────────
print("=== DB rows for Shaw ===")
conn = sqlite3.connect(DB_PATH)
cur  = conn.cursor()
cur.execute("""
    SELECT player_name, season_year, avg_batting_position,
           balls_faced, runs_scored, matches_played, role_primary
    FROM player_seasons
    WHERE player_name LIKE '%Shaw%'
    ORDER BY season_year
""")
for r in cur.fetchall():
    print(r)
conn.close()

# ── 2. What the 2023 JSONs say about his actual positions ────
print("\n=== Raw 2023 innings positions for any 'Shaw' ===")
for filename in sorted(os.listdir(DATA_DIR)):
    if not filename.endswith(".json"):
        continue
    try:
        with open(os.path.join(DATA_DIR, filename), encoding="utf-8") as f:
            match = json.load(f)
        dates = match.get("info", {}).get("dates", ["0"])
        if str(dates[0])[:4] != "2023":
            continue
        for inn in match.get("innings", []):
            seen = {}
            for ov in inn.get("overs", []):
                for d in ov.get("deliveries", []):
                    b = d.get("batter", "")
                    if b not in seen:
                        seen[b] = len(seen) + 1
            for pid, pos in seen.items():
                if "shaw" in pid.lower() or "shaw" in pid.lower():
                    print(f"  file={filename}  team={inn.get('team')}  pid={pid!r}  position={pos}")
    except Exception as e:
        print(f"  ERROR {filename}: {e}")

# ── 3. Check people.csv for Shaw entries ─────────────────────
print("\n=== people.csv entries for Shaw ===")
import csv
with open(os.path.join(DATA_DIR, "people.csv"), newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        if "shaw" in row.get("name","").lower():
            print(dict(row))
