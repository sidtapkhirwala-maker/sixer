"""
apply_overrides.py
Sets bowling_style_override = 'Spin Bowler' for known spinners and
wicketkeeper_override = 1 + role_primary = 'Wicketkeeper' for known keepers.
Run AFTER classify_roles.py.
Usage: python apply_overrides.py
"""

import sqlite3
import os

DB_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\sixer\sixer.db"

# ─────────────────────────────────────────────────────────────────────────────
# 200 KNOWN IPL SPINNERS  (player_name as stored in player_seasons)
# Covers off-break, left-arm orthodox, leg-spin, left-arm wrist, carrom ball
# ─────────────────────────────────────────────────────────────────────────────
SPINNERS = [
    # ── Leg-spin ─────────────────────────────────────────────────────────────
    "YS Chahal",        # RCB / RR
    "A Zampa",          # RR
    "AU Rashid",        # SRH
    "SK Warne",         # RR 2008–2011
    "PP Ojha",          # DC / MI / SRH
    "A Mishra",         # DC / SRH / MI  (AM Mishra)
    "Imran Tahir",      # CSK
    "KP Appanna",       # RCB / DC
    "PP Chawla",        # KKR / CSK / MI
    "KV Sharma",        # RCB / SRH
    "KS Sharma",        # SRH / MI / RCB  (Karn Sharma)
    "K Yadav",          # RR / DC
    "M Markande",       # MI / DC
    "S Gopal",          # RR / SRH  (Shreyas Gopal)
    "Suyash Sharma",    # KKR
    "RK Bhui",          # SRH
    "Noor Ahmad",       # GT / CSK
    "Ravi Bishnoi",     # PBKS / LSG
    "R Parag",          # RR
    "Mayank Dagar",     # SRH
    "A Manohar",        # GT  (Abhinav Manohar)
    "K Kartikeya",      # MI — left-arm wrist
    "Kuldeep Yadav",    # KKR / DC — left-arm wrist
    "CV Varun",         # KKR — mystery spin
    "M Theekshana",     # CSK — off-spin
    "R Sai Kishore",    # GT  (Sai Kishore)
    "M Ashwin",         # PBKS / RR — off-break
    "R Ashwin",         # PBKS / RR / CSK / DC
    "Harbhajan Singh",  # MI / CSK
    "SP Narine",        # KKR — mystery off-spin
    "A Kumble",         # RCB — leg-spin
    "M Muralitharan",   # CSK — off-spin
    "DL Vettori",       # RCB — left-arm orthodox
    "RA Jadeja",        # CSK / RR — left-arm orthodox
    "AR Patel",         # PBKS / DC / GT  (Axar Patel)
    "Washington Sundar",# RCB / SRH
    "Shahbaz Ahmed",    # RCB / SRH — left-arm orthodox
    "MJ Santner",       # CSK — left-arm orthodox
    "Parvez Rasool",    # PBKS — off-break
    "S Randiv",         # SRH — off-spin
    "PWH de Silva",     # RCB — off-spin
    "D Madushanka",     # CSK  (Dilshan Madushanka)
    "KM Jadhav",        # RCB / CSK — off-break
    "Harpreet Brar",    # PBKS — left-arm orthodox
    "Sikandar Raza",    # PBKS — off-break
    "GJ Maxwell",       # PBKS / RCB — off-break
    "MM Ali",           # SRH / CSK — off-break
    "MG Bracewell",     # RCB — off-break
    "AK Markram",       # SRH — off-break
    "Shakib Al Hasan",  # KKR — left-arm orthodox
    "YK Pathan",        # KKR / RR — off-break  (Yusuf Pathan)
    "PV Tambe",         # RR — leg-spin  (Pravin Tambe)
    "AA Chavan",        # MI — left-arm orthodox  (Ankeet Chavan)
    "SB Jakati",        # RCB — left-arm orthodox
    "Rashid Khan",      # SRH — leg-spin
    "R Tewatia",        # GT / RR — leg-spin  (Rahul Tewatia)
    "K Gowtham",        # CSK / RR / PBKS — off-break
    "KK Nair",          # KKR / PBKS — occasional off-break  (Karun Nair)
    "KK Cooper",        # RR — off-break  (Kevon Cooper)
    "JDP Oram",         # CSK — off-break  (Jacob Oram)
    "Bipul Sharma",     # PBKS — left-arm orthodox
    "Mujeeb Ur Rahman", # PBKS / MI — off-break / mystery
    "Abhishek Sharma",  # SRH — left-arm orthodox
    "Lalit Yadav",      # DC — off-break
    "SN Khan",          # DC — left-arm orthodox
    "SZ Mulani",        # MI — left-arm orthodox  (Shams Mulani)
    "Tanush Kotian",    # MI — off-break
    "H Sharma",         # RCB — leg-spin
    "KH Pandya",        # MI / LSG — left-arm orthodox  (Krunal)
    "DJ Hooda",         # PBKS / LSG / MI — off-break  (Deepak Hooda)
    "Shashank Singh",   # PBKS — off-break (minimal)
    "Shivam Sharma",    # PBKS — left-arm orthodox
    "KC Cariappa",      # KKR — leg-spin
    "KS Bharat",        # SRH — occasional  (Kona Bharat)
    "MN Samuels",       # PWI — off-break
    "JP Duminy",        # MI — off-break
    "GD Phillips",      # SRH — off-break (minor)
    "JE Root",          # RR — occasional off-break
    "MA Agarwal",       # PBKS / SRH — off-break (very minor)
    "Naman Dhir",       # MI — off-break
    "Kartik Tyagi",     # SRH — off-break (minor)
    "Sanvir Singh",     # SRH — left-arm orthodox
    "DG Nalkande",      # GT — off-break  (Darshan Nalkande)
    "MK Lomror",        # RCB / RR — left-arm orthodox
    "P Ray Barman",     # RCB — leg-spin  (Prayas Ray Barman)
    "P Negi",           # DC / KKR / RCB — left-arm orthodox  (Pawan Negi)
    "J Yadav",          # MI — off-break  (Jayant Yadav)
    "IS Sodhi",         # — leg-spin
    "T Shamsi",         # RCB — left-arm wrist
    "P Suyal",          # MI — left-arm orthodox
    "RD Chahar",        # MI / PBKS — leg-spin  (Rahul Chahar)
    "R Sharma",         # PWI / MI — leg-spin  (Rahul Sharma)
    "VH Zol",           # — leg-spin  (Vijay Zol)
    "Gurkeerat Singh",  # RCB — off-break
    "P Negi",           # duplicate guard (Pawan Negi)
    "Anmolpreet Singh", # SRH — occasional
    "V Viyaskanth",      # SRH — occasional
    "S Kaushik",        # SRH — occasional (Shivil Kaushik)
    "M Kartik",         # (Murali Kartik) — off-break
    "S Nadeem",         # SRH — left-arm orthodox (Shahbaz Nadeem)
    "AJ Hosein",        # SRH — off-break (Akeal Hosein)
    "BAW Mendis",        # SRH — off-break (Ajantha Mendis)
    "Iqbal Abdulla",     # SRH — off-break 
    "GB Hogg",          # SRH — off-break (Brad Hogg)
    "DS Rathi",       # SRH — off-break (Digvesh Rathi)
    "J Botha",            # SRH — off-break  (Johan Botha)
    "AM Ghazanfar",          # SRH — off-break (Allah Ghazanfar)"

]

# Deduplicate while preserving order
SPINNERS = list(dict.fromkeys(s.strip() for s in SPINNERS if s.strip()))

# ─────────────────────────────────────────────────────────────────────────────
# 100 KNOWN IPL WICKETKEEPERS
# ─────────────────────────────────────────────────────────────────────────────
WICKETKEEPERS = [
    # ── Active / recent ──────────────────────────────────────────────────────
    "MS Dhoni",         # CSK — all time
    "KD Karthik",       # KKR / RCB — keeper-batter
    "SV Samson",        # RR — keeper-batter
    "KL Rahul",         # PBKS / LSG — occasional keeper
    "Ishan Kishan",     # MI — keeper-batter
    "RR Pant",          # DC — keeper-batter  (Rishabh Pant)
    "WP Saha",          # CSK / SRH / PBKS / GT
    "Q de Kock",        # MI / LSG  (Quinton de Kock)
    "JC Buttler",       # RR — keeper-batter
    "H Klaasen",        # SRH — keeper-batter
    "Rahmanullah Gurbaz",# KKR — keeper-batter
    "DP Conway",        # CSK — keeper-batter
    "Anuj Rawat",       # RCB — keeper
    "Dhruv Jurel",      # RR — keeper-batter
    "JM Sharma",        # PBKS — keeper-batter  (Jitesh Sharma)
    "Vishnu Vinod",     # MI — keeper
    "N Jagadeesan",     # CSK / KKR — keeper-batter
    "P Simran Singh",   # PBKS — keeper-batter  (Prabhsimran)
    "Liton Das",        # KKR — keeper
    "KS Bharat",        # SRH — keeper  (Kona Bharat)
    "PD Salt",          # DC — keeper-batter  (Phil Salt)
    # ── Historical ───────────────────────────────────────────────────────────
    "AC Gilchrist",     # DCH — legendary keeper
    "KC Sangakkara",    # DCH — keeper-batter
    "BB McCullum",      # KKR — keeper-batter
    "MS Bisla",         # KKR / RCB — keeper
    "PA Patel",         # MI / RR / SRH — keeper-batter
    "NV Ojha",          # DCH / SRH / MI — keeper  (Naman Ojha)
    "CM Gautam",        # RCB / KKR — keeper
    "AB de Villiers",   # RCB — occasional keeper
    "MN van Wyk",       # DCH — keeper
    "RV Uthappa",       # KKR / CSK / RR — keeper-batter
    "MJ Guptill",       # SRH — keeper occasionally
    "JM Bairstow",      # SRH — keeper-batter
    "AS Roy",           # KKR — keeper-batter
    "Swapnil Singh",    # RR — keeper
    "DB Ravi Teja",     # SRH — keeper  (Ravi Teja)
    "TM Dilshan",       # DC — occasional keeper
    "NS Naik",          # MI — keeper  (Nikhil Naik)
    "TL Seifert",       # KKR — keeper  (Tim Seifert)
    "SP Jackson",       # KKR — keeper  (Sheldon Jackson)
]

# Deduplicate
WICKETKEEPERS = list(dict.fromkeys(w.strip() for w in WICKETKEEPERS if w.strip()))


# ─────────────────────────────────────────────────────────────────────────────
# APPLY OVERRIDES
# ─────────────────────────────────────────────────────────────────────────────

def apply_spinner_overrides(cur, spinners):
    """
    For each known spinner:
    - Set bowling_style_override = 'Spin Bowler'
    - Update role_primary: any row currently 'Pace Bowler' → 'Spin Bowler'
      Also update all-rounders to preserve their all-rounder tag but note
      spin style in bowling_style_override only (role stays Batting/Bowling AR)
    Returns count of rows updated.
    """
    total = 0
    for name in spinners:
        # Always set the style override
        cur.execute("""
            UPDATE player_seasons
            SET bowling_style_override = 'Spin Bowler'
            WHERE player_name = ?
        """, (name,))

        # Only flip role if currently classified as Pace Bowler
        cur.execute("""
            UPDATE player_seasons
            SET role_primary = 'Spin Bowler'
            WHERE player_name = ? AND role_primary = 'Pace Bowler'
        """, (name,))
        total += cur.rowcount

    return total


def apply_keeper_overrides(cur, keepers):
    """
    For each known keeper:
    - Set wicketkeeper_override = 1
    - Set role_primary = 'Wicketkeeper' regardless of current role
      (a keeper who bats well is still listed as Wicketkeeper for draft purposes)
    Returns count of rows updated.
    """
    total = 0
    for name in keepers:
        cur.execute("""
            UPDATE player_seasons
            SET wicketkeeper_override = 1,
                role_primary = 'Wicketkeeper'
            WHERE player_name = ?
        """, (name,))
        total += cur.rowcount

    return total


# ─────────────────────────────────────────────────────────────────────────────
# VERIFICATION
# ─────────────────────────────────────────────────────────────────────────────

def verify(cur):
    # ── Role distribution after overrides ────────────────────────────────────
    print("\n" + "=" * 60)
    print("  ROLE DISTRIBUTION (after overrides)")
    print("=" * 60)
    cur.execute("""
        SELECT role_primary, COUNT(*) AS cnt,
               SUM(is_draftable) AS draftable
        FROM player_seasons
        GROUP BY role_primary
        ORDER BY cnt DESC
    """)
    rows = cur.fetchall()
    total = sum(r[1] for r in rows)
    print(f"  {'Role':<28} {'Rows':>6}  {'Draftable':>9}")
    print(f"  {'-'*28} {'-'*6}  {'-'*9}")
    for role, cnt, draft in rows:
        draft = draft or 0
        print(f"  {(role or 'NULL'):<28} {cnt:>6}  {draft:>9}")
    print(f"  {'TOTAL':<28} {total:>6}")

    # ── Spinner spot-check: key names ────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  SPINNER SPOT-CHECK (last 3 seasons each)")
    print("=" * 60)
    spot_spinners = [
        "YS Chahal", "SP Narine", "RA Jadeja", "AR Patel",
        "Kuldeep Yadav", "R Ashwin", "CV Varun", "AU Rashid",
        "Ravi Bishnoi", "Washington Sundar",
    ]
    for name in spot_spinners:
        cur.execute("""
            SELECT player_name, season_year, role_primary,
                   bowling_style_override, wickets_taken, balls_bowled
            FROM player_seasons
            WHERE player_name = ?
            ORDER BY season_year DESC LIMIT 3
        """, (name,))
        rows = cur.fetchall()
        if rows:
            for r in rows:
                print(f"  {r[0]:<28} {r[1]}  {r[2]:<20} style={r[3] or 'none':<12} wkts={r[4]}  BB={r[5]}")
        else:
            print(f"  {name:<28} — NOT FOUND IN DB")

    # ── Keeper spot-check ─────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  KEEPER SPOT-CHECK")
    print("=" * 60)
    spot_keepers = [
        "MS Dhoni", "KD Karthik", "SV Samson", "Ishan Kishan",
        "RP Pant", "WP Saha", "JC Buttler", "H Klaasen",
        "AC Gilchrist", "BB McCullum", "PA Patel", "RV Uthappa",
        "JM Bairstow", "PD Salt",
    ]
    for name in spot_keepers:
        cur.execute("""
            SELECT player_name, season_year, role_primary,
                   wicketkeeper_override, matches_played, runs_scored
            FROM player_seasons
            WHERE player_name = ?
            ORDER BY season_year DESC LIMIT 2
        """, (name,))
        rows = cur.fetchall()
        if rows:
            for r in rows:
                print(f"  {r[0]:<28} {r[1]}  {r[2]:<20} wk={r[3]}  M={r[4]}  runs={r[5]}")
        else:
            print(f"  {name:<28} — NOT FOUND IN DB")

    # ── Names in list but not in DB (helps catch name mismatches) ────────────
    print("\n" + "=" * 60)
    print("  NAMES IN SPINNER LIST NOT FOUND IN DB")
    print("=" * 60)
    cur.execute("SELECT DISTINCT player_name FROM player_seasons")
    db_names = {r[0] for r in cur.fetchall()}

    missing_spinners = [s for s in SPINNERS if s not in db_names]
    if missing_spinners:
        for name in sorted(missing_spinners):
            print(f"  SPINNER NOT IN DB: {name}")
    else:
        print("  All spinner names matched.")

    print("\n" + "=" * 60)
    print("  NAMES IN KEEPER LIST NOT FOUND IN DB")
    print("=" * 60)
    missing_keepers = [k for k in WICKETKEEPERS if k not in db_names]
    if missing_keepers:
        for name in sorted(missing_keepers):
            print(f"  KEEPER NOT IN DB: {name}")
    else:
        print("  All keeper names matched.")

    # ── Final draftable count ─────────────────────────────────────────────────
    cur.execute("SELECT COUNT(*) FROM player_seasons WHERE is_draftable = 1")
    print(f"\n  Total draftable rows: {cur.fetchone()[0]:,}")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n========================================")
    print("  APPLY SPINNER + KEEPER OVERRIDES")
    print("========================================\n")

    if not os.path.exists(DB_PATH):
        print(f"  ERROR: sixer.db not found at:\n  {DB_PATH}")
        raise SystemExit(1)

    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    print(f"Spinner list: {len(SPINNERS)} unique names")
    print(f"Keeper list : {len(WICKETKEEPERS)} unique names\n")

    print("Step 1/2 — Applying spinner overrides...")
    spin_updated = apply_spinner_overrides(cur, SPINNERS)
    print(f"  Rows flipped to Spin Bowler: {spin_updated}")

    print("\nStep 2/2 — Applying keeper overrides...")
    keep_updated = apply_keeper_overrides(cur, WICKETKEEPERS)
    print(f"  Rows updated as Wicketkeeper: {keep_updated}")

    conn.commit()

    print("\nRunning verification...")
    verify(cur)

    conn.close()
    print("\n========================================")
    print("  Done.")
    print("========================================\n")
