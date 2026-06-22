"""
apply_nationality.py
Sets is_overseas = 1 for known foreign players.
Run AFTER classify_roles.py AND apply_overrides.py, BEFORE build_draftable_pool.py.
Usage: python apply_nationality.py
"""

import sqlite3
import os

DB_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\sixer\sixer.db"

# ─────────────────────────────────────────────────────────────────────────────
# OVERSEAS PLAYERS (Cricsheet short-form names)
# Anyone NOT in this list is treated as Indian (the default).
# ─────────────────────────────────────────────────────────────────────────────
OVERSEAS_PLAYERS = [
    # ── Australia ────────────────────────────────────────────────────────────
    "AC Gilchrist", "ML Hayden", "RT Ponting", "SR Watson", "SK Warne",
    "A Symonds", "BJ Hodge", "MEK Hussey", "DJ Hussey", "BJ Haddin",
    "CL White", "DE Bollinger", "B Lee", "NW Bracken", "PM Siddle",
    "MG Johnson", "SE Marsh", "DS Lehmann", "JR Hopes", "RJ Harris",
    "BR Laughlin", "MJ Clarke", "AJ Finch", "CJ McKay", "XJ Doherty",
    "DT Christian", "TD Paine", "LA Pomersbach", "DA Warner", "AC Blizzard",
    "DP Nannes", "AC Voges", "MA Starc", "SPD Smith", "PJ Cummins",
    "JR Hazlewood", "JP Faulkner", "GJ Maxwell", "MP Stoinis", "SW Tait",
    "CA Lynn", "NM Coulter-Nile", "B Stanlake", "JP Behrendorff", "AJ Tye",
    "AC Agar", "AJ Turner", "A Zampa", "DJM Short", "TH David",
    "KW Richardson", "AT Carey", "JA Richardson", "BR McDermott", "MR Marsh",
    "M Labuschagne", "RP Meredith", "MW Short", "JR Fraser-McGurk", "S Randiv", "V Viyaskanth",
    "CD Green", "JP Inglis", "AT Hardie", "XC Bartlett", "SH Johnson", "J Theron",
    "MJ Owen", "C Connolly", "TM Head", "BW Hilfenhaus", "HF Gurney", "MN van Wyk",
    "BJ Dwarshuis", "CJ Ferguson", "M Klinger", "NJ Rimmington",
    "C Green", "MC Henriques", "DR Sams", "SA Abbott", "NM McAndrew",
    "UT Khawaja", "CT Bancroft", "MJ Lumb", "BJ Rohrer", "JJ van der Wath",
    "AB McDonald", "MG Neser", "JA Burns", "BR Dunk", "JW Hastings", "C Green", "BCJ Cutting",
    "AM Ghazanfar", "GB Hogg", "CJ Green", "J Fraser-McGurk", "KT Maphaka", "SO Hetmyer", "TS Mills",

    # ── England ──────────────────────────────────────────────────────────────
    "KP Pietersen", "A Flintoff", "PD Collingwood", "OA Shah", "AD Mascarenhas",
    "SCJ Broad", "GP Swann", "SR Patel", "LJ Wright", "RS Bopara",
    "CT Tremlett", "SJ Harmison", "RJ Sidebottom", "MJ Prior", "JC Tredwell",
    "TS Mills", "JC Buttler", "BA Stokes", "JM Bairstow", "EJG Morgan",
    "CR Woakes", "DJ Willey", "LE Plunkett", "SW Billings", "JJ Roy",
    "AD Hales", "MM Ali", "AU Rashid", "DJ Malan", "TK Curran",
    "SM Curran", "JC Archer", "MA Wood", "LS Livingstone", "HC Brook",
    "PD Salt", "JG Bethell", "BM Duckett", "JE Overton", "JL Smith",
    "WG Jacks", "RJW Topley", "BA Carse", "DA Payne", "CJ Jordan", "SS Cottrell",
    "CJ Kieswetter", "T Banton", "RJ Gleeson", "LA Carseldine", "R McLaren", "DJ Jacobs",

    # ── South Africa ─────────────────────────────────────────────────────────
    "GC Smith", "HH Gibbs", "JH Kallis", "M Ntini", "DW Steyn", "BJ Rohrer",
    "CK Langeveldt", "J Botha", "JP Duminy", "RJ Peterson", "JA Morkel",
    "M Morkel", "M de Lange", "LL Tsotsobe", "WD Parnell", "RE Levi",
    "RR Rossouw", "DA Miller", "RM McLaren", "F Behardien", "Imran Tahir",
    "CA Ingram", "AB de Villiers", "F du Plessis", "K Rabada", "CH Morris",
    "Q de Kock", "D Pretorius", "KJ Abbott", "VD Philander", "H Klaasen",
    "AL Phehlukwayo", "HE van der Dussen", "L Ngidi", "T Shamsi",
    "M Jansen", "PWA Mulder", "T Stubbs", "D Brevis", "LG Pretorius",
    "D Ferreira", "MP Breetzke", "N Burger", "K Maphaka", "G Coetzee",
    "A Nortje", "RK Kleinveldt", "R Theron", "BE Hendricks",
    "H Viljoen", "D Olivier", "C Bosch", "ST Jayasuriya", "HM Amla", "RD Rickelton",

    # ── West Indies ──────────────────────────────────────────────────────────
    "CH Gayle", "DJ Bravo", "KA Pollard", "LMP Simmons", "DR Smith",
    "JE Taylor", "FH Edwards", "SJ Benn", "DJG Sammy", "MN Samuels",
    "DR Smith", "AB Barath", "RR Sarwan", "B Nash", "R Rampaul",
    "KK Cooper", "K Santokie", "SP Narine", "AD Russell", "E Lewis",
    "CR Brathwaite", "R Powell", "FA Allen", "FH Allen","JO Holder",
    "AJ Hosein", "R Shepherd", "S Rutherford", "SSJ Brooks",
    "S Joseph", "N Pooran", "OC McCoy", "AS Joseph", "B Jacobs",
    "DM Bravo", "AR Nurse", "S Badree", "OF Smith", "D Drakes",
    "K Paul", "O Thomas", "J Charles", "Azhar Mahmood", "SM Harwood",

    # ── New Zealand ──────────────────────────────────────────────────────────
    "BB McCullum", "SP Fleming", "SB Styris", "JD Ryder", "JDP Oram",
    "DL Vettori", "KD Mills", "LRPL Taylor", "CJ Anderson", "TG Southee",
    "MJ McClenaghan", "L Ronchi", "KS Williamson", "TA Boult", "MJ Guptill",
    "C Munro", "TWM Latham", "AF Milne", "LH Ferguson", "JDS Neesham",
    "IS Sodhi", "C de Grandhomme", "TD Astle", "R Ravindra", "GD Phillips", "E Malinga",
    "W O'Rourke", "KA Jamieson", "MJ Henry", "DJ Mitchell", "AB McDonald", "TR Birt",
    "NL McCullum", "SC Kuggeleijn", "TL Seifert", "FH Allen", "DP Conway", "GHS Garton",
    "MG Bracewell", "HK Bennett", "JEC Franklin", "N Wagner", "JL Pattinson", "AK Markram", "SE Rutherford", "PBB Rajapaksa", "MJ Santner","GJ Bailey", "SM Pollock",

    # ── Sri Lanka ────────────────────────────────────────────────────────────
    "ST Jayasuriya", "DPMD Jayawardene", "KC Sangakkara", "M Muralitharan",
    "SL Malinga", "WPUJC Vaas", "TM Dilshan", "BAW Mendis", "AD Mathews",
    "KMDN Kulasekara", "MF Maharoof", "HMRKB Herath", "LPC Silva",
    "NLTC Perera", "SMSM Senanayake", "MDKJ Perera", "PVD Chameera",
    "RAS Lakmal", "PADLR Sandakan", "MD Shanaka", "PWH de Silva",
    "M Pathirana", "P Nissanka", "Kamindu Mendis", "BKG Mendis",
    "M Theekshana", "CBRLS Kumara", "DM de Silva", "DRL Chandimal",
    "WU Tharanga", "K Dananjaya", "SP Prasanna", "I Udana",

    # ── Afghanistan ──────────────────────────────────────────────────────────
    "Rashid Khan", "Mohammad Nabi", "Mujeeb Ur Rahman", "Noor Ahmad",
    "Rahmanullah Gurbaz", "Karim Janat", "Azmatullah Omarzai",
    "Sediqullah Atal", "Fazalhaq Farooqi", "Naveen-ul-Haq",
    "Qais Ahmad", "Fareed Ahmad", "Waqar Salamkheil",

    # ── Bangladesh ───────────────────────────────────────────────────────────
    "Mushfiqur Rahim", "Mahmudullah", "Tamim Iqbal", "Shakib Al Hasan",
    "Mustafizur Rahman", "Taskin Ahmed", "Liton Das", "B Muzarbani",

    # ── Pakistan (pre-2009 only) ─────────────────────────────────────────────
    "Shoaib Akhtar", "Shahid Afridi", "Sohail Tanvir", "Kamran Akmal",
    "Umar Gul", "Shoaib Malik", "Younis Khan", "Mohammad Hafeez",
    "Imran Nazir", "Iftikhar Anjum", "Danish Kaneria", "SE Bond",

    # ── Other / Associate nations ────────────────────────────────────────────
    "Sikandar Raza", "J Little", "PR Stirling", "GH Dockrell",
    "WB Rankin", "RN ten Doeschate", "T van der Gugten", "D Wiese",
    "JN Frylinck",
]

# Deduplicate
OVERSEAS_PLAYERS = list(dict.fromkeys(s.strip() for s in OVERSEAS_PLAYERS if s.strip()))


# ─────────────────────────────────────────────────────────────────────────────
# ADD COLUMN
# ─────────────────────────────────────────────────────────────────────────────

def ensure_column(cur):
    cur.execute("PRAGMA table_info(player_seasons)")
    existing = {row[1] for row in cur.fetchall()}
    if "is_overseas" not in existing:
        cur.execute("ALTER TABLE player_seasons ADD COLUMN is_overseas INTEGER DEFAULT 0")
        print("  Added column: is_overseas")
    else:
        print("  Column already exists: is_overseas")


# ─────────────────────────────────────────────────────────────────────────────
# APPLY NATIONALITY
# ─────────────────────────────────────────────────────────────────────────────

def apply_nationality(cur, overseas):
    # First reset everyone to Indian (idempotent)
    cur.execute("UPDATE player_seasons SET is_overseas = 0")

    total = 0
    for name in overseas:
        cur.execute("""
            UPDATE player_seasons
            SET is_overseas = 1
            WHERE player_name = ?
        """, (name,))
        total += cur.rowcount

    return total


# ─────────────────────────────────────────────────────────────────────────────
# VERIFICATION
# ─────────────────────────────────────────────────────────────────────────────

def verify(cur):
    print("\n" + "=" * 60)
    print("  NATIONALITY DISTRIBUTION")
    print("=" * 60)
    cur.execute("""
        SELECT
            CASE WHEN is_overseas = 1 THEN 'Overseas' ELSE 'Indian' END AS nationality,
            COUNT(*) AS cnt,
            SUM(is_draftable) AS draftable
        FROM player_seasons
        GROUP BY is_overseas
        ORDER BY nationality
    """)
    rows = cur.fetchall()
    for nat, cnt, draft in rows:
        print(f"  {nat:<12} rows={cnt:>6}  draftable={draft or 0:>6}")

    # Sample check
    print("\n" + "=" * 60)
    print("  SPOT-CHECK (recent stars)")
    print("=" * 60)
    checks = [
        ("V Kohli",       2016, 0),  # expected Indian
        ("JJ Bumrah",     2020, 0),  # expected Indian
        ("MS Dhoni",      2013, 0),  # expected Indian
        ("RA Jadeja",     2021, 0),  # expected Indian
        ("AD Russell",    2019, 1),  # expected Overseas
        ("JC Buttler",    2022, 1),  # expected Overseas
        ("Rashid Khan",   2020, 1),  # expected Overseas
        ("SP Narine",     2024, 1),  # expected Overseas
        ("KS Williamson", 2018, 1),  # expected Overseas
        ("AB de Villiers",2016, 1),  # expected Overseas
    ]
    for name, year, expected in checks:
        cur.execute("""
            SELECT is_overseas FROM player_seasons
            WHERE player_name = ? AND season_year = ? LIMIT 1
        """, (name, year))
        row = cur.fetchone()
        if row is None:
            print(f"  {name:<22} {year}  — NOT FOUND")
        else:
            actual = row[0] or 0
            mark = "✓" if actual == expected else "✗ MISMATCH"
            label = "Overseas" if actual else "Indian"
            print(f"  {name:<22} {year}  {label:<10} {mark}")

    # Names in list not found in DB
    print("\n" + "=" * 60)
    print("  NAMES IN OVERSEAS LIST NOT FOUND IN DB")
    print("=" * 60)
    cur.execute("SELECT DISTINCT player_name FROM player_seasons")
    db_names = {r[0] for r in cur.fetchall()}
    missing = [n for n in OVERSEAS_PLAYERS if n not in db_names]
    if missing:
        for name in sorted(missing):
            print(f"  NOT IN DB: {name}")
        print(f"\n  ({len(missing)} of {len(OVERSEAS_PLAYERS)} list entries had no matching player)")
    else:
        print("  All overseas names matched.")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n========================================")
    print("  APPLY NATIONALITY")
    print("========================================\n")

    print(f"  Using DB: {DB_PATH}")
    print(f"  DB exists: {os.path.exists(DB_PATH)}\n")

    if not os.path.exists(DB_PATH):
        raise SystemExit(1)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print(f"Overseas list: {len(OVERSEAS_PLAYERS)} unique names\n")

    print("Step 1/2 — Ensuring column exists...")
    ensure_column(cur)

    print("\nStep 2/2 — Applying nationality...")
    flipped = apply_nationality(cur, OVERSEAS_PLAYERS)
    print(f"  Rows flipped to Overseas: {flipped}")

    conn.commit()

    print("\nRunning verification...")
    verify(cur)

    conn.close()
    print("\n========================================")
    print("  Done.")
    print("========================================\n")