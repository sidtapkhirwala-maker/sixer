"""
find_db_names.py
For each unmatched spinner/keeper, searches the DB for the closest name
and prints the likely correct mapping so apply_overrides.py can be patched.
Usage: python find_db_names.py
"""

import sqlite3
import os

DB_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\Sixer - The Game\Data\sixer.db"

# ── Names not found in DB from apply_overrides.py output ─────────────────────

UNMATCHED_SPINNERS = [
    "A Tye", "AM Mishra", "Abhinav Manohar", "Aiden Markram",
    "Anil Kumble", "Ankeet Chavan", "Axar Patel", "Ben Stokes",
    "Daniel Christian", "Daniel Vettori", "Darshan Nalkande",
    "Deepak Chahar", "Deepak Hooda", "Dilshan Madushanka",
    "Glenn Maxwell", "Glenn Phillips", "Gurkeerat Mann", "Hardik Pandya",
    "Irfan Pathan", "Ish Sodhi", "Jacob Oram", "Joe Root", "Karn Sharma",
    "Karun Nair", "Kedar Jadhav", "Kevon Cooper", "Krishnappa Gowtham",
    "Krunal Pandya", "Maheesh Theekshana", "Mahipal Lomror",
    "Marlon Samuels", "Mayank Agarwal", "Michael Bracewell",
    "Mitchell Santner", "Moeen Ali", "Mujeeb ur Rahman",
    "Muttiah Muralitharan", "Pawan Negi", "Piyush Chawla",
    "Pragyan Ojha", "Pravin Tambe", "Prayas Ray Barman",
    "Rahul Chahar", "Rahul Sharma", "Rahul Tewatia",
    "Ravichandran Ashwin", "Ravindra Jadeja", "Rishi Dhawan",
    "Riyan Parag", "Sai Kishore", "Sai Sudharsan", "Shadab Khan",
    "Shams Mulani", "Shreyas Gopal", "Sunil Narine", "Suraj Randiv",
    "Tabraiz Shamsi", "Varun Chakravarthy", "Vijay Shankar",
    "Wanindu de Silva", "Yusuf Pathan", "Yuzvendra Chahal",
    "Jayant Yadav", "Kona Bharat", "Tanmay Agarwal", "Vijay Zol",
    "Rishi Dhawan", "Gurkeerat Singh", "DT Christian", "IS Sodhi",
    "T Shamsi", "KH Pandya", "HH Pandya", "K Gowtham",
    "Vijay Shankar", "S Gopal",
]

UNMATCHED_KEEPERS = [
    "Adam Gilchrist", "Brendon McCullum", "C Gautam",
    "Devon Conway", "Dinesh Karthik", "Heinrich Klaasen",
    "Jitesh Sharma", "Jonny Bairstow", "Jos Buttler",
    "Kumar Sangakkara", "Mahendra Singh Dhoni", "Manvinder Bisla",
    "Naman Ojha", "Narayan Jagadeesan", "Parthiv Patel",
    "Phil Salt", "Prabhsimran Singh", "Quinton de Kock",
    "Rishabh Pant", "Robin Uthappa", "Sanju Samson",
    "Sheldon Jackson", "Tim Seifert", "Upendra Yadav",
    "Ravi Teja", "Paul Valthaty", "Nikhil Naik",
    "Q de Kock", "WP Saha",
]

def find_candidates(cur, name):
    """
    Try progressively looser searches to find the DB name.
    1. Exact last-name match (last word of the full name)
    2. First initial + last name fragments
    """
    parts = name.split()
    candidates = set()

    # Search by last name
    last = parts[-1]
    cur.execute("SELECT DISTINCT player_name FROM player_seasons WHERE player_name LIKE ?",
                (f"%{last}%",))
    candidates.update(r[0] for r in cur.fetchall())

    # Search by first name / initials too if last name gave nothing
    if not candidates and len(parts) > 1:
        first = parts[0]
        cur.execute("SELECT DISTINCT player_name FROM player_seasons WHERE player_name LIKE ?",
                    (f"%{first}%",))
        candidates.update(r[0] for r in cur.fetchall())

    return sorted(candidates)

if __name__ == "__main__":
    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    print("\n" + "=" * 65)
    print("  SPINNER NAME MAPPINGS")
    print("=" * 65)
    for name in sorted(set(UNMATCHED_SPINNERS)):
        candidates = find_candidates(cur, name)
        if len(candidates) == 1:
            print(f"  {name:<35} → {candidates[0]}")
        elif len(candidates) > 1:
            print(f"  {name:<35} → MULTIPLE: {candidates}")
        else:
            print(f"  {name:<35} → NOT FOUND")

    print("\n" + "=" * 65)
    print("  KEEPER NAME MAPPINGS")
    print("=" * 65)
    for name in sorted(set(UNMATCHED_KEEPERS)):
        candidates = find_candidates(cur, name)
        if len(candidates) == 1:
            print(f"  {name:<35} → {candidates[0]}")
        elif len(candidates) > 1:
            print(f"  {name:<35} → MULTIPLE: {candidates}")
        else:
            print(f"  {name:<35} → NOT FOUND")

    conn.close()
