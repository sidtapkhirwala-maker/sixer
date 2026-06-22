"""
build_season_highlights.py
Creates and populates the season_highlights table in sixer.db.
Usage: python build_season_highlights.py
"""

import sqlite3
import os

DB_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\Sixer - The Game\Data\sixer.db"

# ─────────────────────────────────────────────────────────────────────────────
# ALL HIGHLIGHTS  (12 curated + 30 user-verified = 42 total)
# player_name must match exactly as stored in player_seasons
# ─────────────────────────────────────────────────────────────────────────────
HIGHLIGHTS = [
    # ── 12 originally curated ────────────────────────────────────────────────
    ("V Kohli",         2016, "4 centuries and 7 fifties — 973 runs at 81 average, the greatest IPL batting season ever."),
    ("CH Gayle",        2013, "175* off 66 balls vs Pune Warriors — the highest individual T20 score in history, finishing with 708 runs."),
    ("SR Watson",       2008, "472 runs and 17 wickets as Player of the Tournament — Rajasthan's engine in their shock title win."),
    ("MS Dhoni",        2010, "Captained CSK to their first IPL title with ice-cool finishing throughout the campaign."),
    ("JJ Bumrah",       2020, "27 wickets with an economy under 7 — the most complete fast-bowling season in IPL history."),
    ("SP Narine",       2018, "Reinvented as a pinch-hitting opener with 357 runs at SR 189 plus 17 wickets — changed IPL thinking."),
    ("Rashid Khan",     2019, "Economy of 6.41 across 15 matches — the best by any spinner in the modern IPL era."),
    ("AD Russell",      2019, "510 runs at SR 204 plus 11 wickets — arguably the most destructive all-round season ever played."),
    ("RR Pant",         2018, "684 runs at age 20 — the youngest player to lead Delhi's batting order across a full season."),
    ("JC Buttler",      2022, "863 runs with 4 centuries — single-handedly carried Rajasthan to the final and the Orange Cap."),
    ("F du Plessis",    2023, "730 runs while captaining RCB at age 38 — vintage technique defying every expectation."),
    ("Shubman Gill",    2023, "Orange Cap with 890 runs including three centuries, powering Gujarat Titans to the title."),

    # ── Batting masterclasses ────────────────────────────────────────────────
    ("CH Gayle",        2011, "608 runs in 12 innings at SR 183 — including the then-fastest IPL century, reshaping T20 opening."),
    ("DA Warner",       2016, "Orange Cap with 848 runs while captaining SRH to their maiden and only IPL title."),
    ("SR Tendulkar",    2010, "Won the Orange Cap with 618 runs as MI captain — the only season he topped the run charts."),
    ("SE Marsh",        2008, "Inaugural Orange Cap winner with 616 runs at an average of 68 — set the template for IPL openers."),
    ("MJ Hayden",       2009, "493 runs at SR 144 in the South Africa edition, popularising the Mongoose bat."),
    ("CH Gayle",        2012, "733 runs at SR 160 with 59 sixes — peak Universe Boss carnage for RCB."),
    ("KL Rahul",        2020, "Orange Cap with 670 runs as captain including a brilliant 132* vs RCB."),
    ("RD Gaikwad",      2021, "Orange Cap with 635 runs as a breakout star, helping CSK lift their fourth title."),
    ("V Kohli",         2024, "Orange Cap again at age 35 with 741 runs — defying time with elegance and hunger."),
    ("AB de Villiers",  2016, "687 runs at SR 168 — formed the most feared batting partnership in IPL history with Kohli."),
    ("SP Narine",       2024, "488 runs at SR 180 as opener plus 17 wickets — the complete player in KKR's title-winning run."),
    ("B Sai Sudharsan", 2025, "Won the Orange Cap as a young opener, announcing himself as the next great Indian batting star."),

    # ── Bowling dominance ────────────────────────────────────────────────────
    ("DJ Bravo",        2013, "Purple Cap with 32 wickets in 18 matches — the gold standard for death-overs bowling."),
    ("B Kumar",         2017, "Back-to-back Purple Cap with 26 wickets — masterful swing with the new ball and death yorkers."),
    ("HV Patel",        2021, "32 wickets equalling Bravo's record — deadly slower balls made him unplayable at the death."),
    ("SL Malinga",      2011, "28 wickets and the Purple Cap — redefined T20 death bowling with his slingy yorkers."),
    ("Rashid Khan",     2020, "20 wickets at an economy of 5.37 — the most unhittable spinner in T20 cricket that season."),
    ("SP Narine",       2012, "24 wickets at an economy of 5.47 — the X-factor that won KKR their first title."),
    ("YS Chahal",       2022, "Purple Cap with 27 wickets including a hat-trick, propelling RR to the final."),
    ("Mohammed Siraj",  2023, "19 wickets as RCB's powerplay enforcer — ruthless with the new ball all campaign."),
    ("MM Sharma",       2023, "27 wickets as a death-overs specialist at age 34 — one of IPL's great comeback seasons."),

    # ── All-round brilliance ──────────────────────────────────────────────────
    ("HH Pandya",       2022, "487 runs and 8 wickets as captain — led Gujarat Titans to the title in their debut season."),
]

# ─────────────────────────────────────────────────────────────────────────────
# BUILD TABLE
# ─────────────────────────────────────────────────────────────────────────────
def build(conn):
    cur = conn.cursor()

    cur.execute("DROP TABLE IF EXISTS season_highlights")
    cur.execute("""
        CREATE TABLE season_highlights (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            player_name TEXT    NOT NULL,
            season_year INTEGER NOT NULL,
            highlight   TEXT    NOT NULL
        )
    """)
    cur.execute("CREATE INDEX idx_sh_player ON season_highlights(player_name)")
    cur.execute("CREATE INDEX idx_sh_season ON season_highlights(season_year)")

    cur.executemany("""
        INSERT INTO season_highlights (player_name, season_year, highlight)
        VALUES (?, ?, ?)
    """, HIGHLIGHTS)

    conn.commit()
    return len(HIGHLIGHTS)


# ─────────────────────────────────────────────────────────────────────────────
# PRINT ALL ENTRIES
# ─────────────────────────────────────────────────────────────────────────────
def print_all(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT player_name, season_year, highlight
        FROM season_highlights
        ORDER BY season_year, player_name
    """)
    rows = cur.fetchall()

    print(f"\n{'='*70}")
    print(f"  ALL SEASON HIGHLIGHTS ({len(rows)} entries)")
    print(f"{'='*70}")
    current_year = None
    for name, year, highlight in rows:
        if year != current_year:
            print(f"\n  ── {year} {'─'*55}")
            current_year = year
        print(f"  {name:<28}  {highlight}")

    # Cross-reference: which highlights have a matching player_seasons row
    print(f"\n{'='*70}")
    print("  PLAYER MATCH CHECK (are names in player_seasons?)")
    print(f"{'='*70}")
    cur.execute("SELECT DISTINCT player_name FROM player_seasons")
    db_names = {r[0] for r in cur.fetchall()}

    for name, year, _ in HIGHLIGHTS:
        status = "✓" if name in db_names else "✗ NOT IN DB"
        print(f"  {status}  {name} ({year})")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n========================================")
    print("  BUILD SEASON HIGHLIGHTS")
    print("========================================\n")

    if not os.path.exists(DB_PATH):
        print(f"  ERROR: sixer.db not found at:\n  {DB_PATH}")
        raise SystemExit(1)

    conn = sqlite3.connect(DB_PATH)
    count = build(conn)
    print(f"  Inserted {count} highlights.")
    print_all(conn)
    conn.close()

    print("\n========================================")
    print("  Done.")
    print("========================================\n")
