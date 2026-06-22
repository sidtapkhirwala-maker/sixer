"""
test_smart_xi.py
Run a 'skilled human' XI through the engine to verify A/B tier is reachable.
"""

from season_engine import evaluate_xi

smart_xi = [
    # 1. Jos Buttler 2022 (RR) — Orange Cap, opener
    {"player_name": "JC Buttler", "season_year": 2022, "role_primary": "Top-Order Batter", "role_category": "Batter",
     "franchise": "RR", "country": "England", "is_wicketkeeper": False,
     "runs_scored": 863, "matches_played": 17, "batting_strike_rate": 149.05, "batting_average": 57.53,
     "fours": 83, "sixes": 45, "balls_faced": 579,
     "wickets_taken": 0, "bowling_average": None, "bowling_economy": None, "overs_bowled": 0.0},

    # 2. KL Rahul 2020 (KXIP) — Orange Cap, captain
    {"player_name": "KL Rahul", "season_year": 2020, "role_primary": "Top-Order Batter", "role_category": "Batter",
     "franchise": "KXIP", "country": "India", "is_wicketkeeper": False,
     "runs_scored": 670, "matches_played": 14, "batting_strike_rate": 129.34, "batting_average": 55.83,
     "fours": 58, "sixes": 23, "balls_faced": 518,
     "wickets_taken": 0, "bowling_average": None, "bowling_economy": None, "overs_bowled": 0.0},

    # 3. Virat Kohli 2016 (RCB) — peak season
    {"player_name": "V Kohli", "season_year": 2016, "role_primary": "Top-Order Batter", "role_category": "Batter",
     "franchise": "RCB", "country": "India", "is_wicketkeeper": False,
     "runs_scored": 973, "matches_played": 16, "batting_strike_rate": 152.03, "batting_average": 81.08,
     "fours": 83, "sixes": 38, "balls_faced": 640,
     "wickets_taken": 0, "bowling_average": None, "bowling_economy": None, "overs_bowled": 0.0},

    # 4. AB de Villiers 2016 (RCB) — middle order
    {"player_name": "AB de Villiers", "season_year": 2016, "role_primary": "Middle-Order Batter", "role_category": "Batter",
     "franchise": "RCB", "country": "South Africa", "is_wicketkeeper": False,
     "runs_scored": 687, "matches_played": 16, "batting_strike_rate": 168.79, "batting_average": 52.84,
     "fours": 57, "sixes": 37, "balls_faced": 407,
     "wickets_taken": 0, "bowling_average": None, "bowling_economy": None, "overs_bowled": 0.0},

    # 5. Hardik Pandya 2022 (GT) — batting AR, captain
    {"player_name": "HH Pandya", "season_year": 2022, "role_primary": "Batting All-Rounder", "role_category": "All-Rounder",
     "franchise": "GT", "country": "India", "is_wicketkeeper": False,
     "runs_scored": 487, "matches_played": 15, "batting_strike_rate": 131.27, "batting_average": 44.27,
     "fours": 49, "sixes": 12, "balls_faced": 371,
     "wickets_taken": 8, "bowling_average": 27.25, "bowling_economy": 7.28, "overs_bowled": 30.0},

    # 6. Sunil Narine 2018 (KKR) — bowling AR, opener-batter
    {"player_name": "SP Narine", "season_year": 2018, "role_primary": "Bowling All-Rounder", "role_category": "All-Rounder",
     "franchise": "KKR", "country": "West Indies", "is_wicketkeeper": False,
     "runs_scored": 357, "matches_played": 16, "batting_strike_rate": 189.89, "batting_average": 25.50,
     "fours": 39, "sixes": 17, "balls_faced": 188,
     "wickets_taken": 17, "bowling_average": 25.0, "bowling_economy": 7.05, "overs_bowled": 60.0},

    # 7. MS Dhoni 2018 (CSK) — comeback season WK-finisher
    {"player_name": "MS Dhoni", "season_year": 2018, "role_primary": "Wicketkeeper", "role_category": "Wicketkeeper",
     "franchise": "CSK", "country": "India", "is_wicketkeeper": True,
     "runs_scored": 455, "matches_played": 16, "batting_strike_rate": 150.66, "batting_average": 75.83,
     "fours": 22, "sixes": 30, "balls_faced": 302,
     "wickets_taken": 0, "bowling_average": None, "bowling_economy": None, "overs_bowled": 0.0},

    # 8. Jasprit Bumrah 2020 (MI) — death-overs king
    {"player_name": "JJ Bumrah", "season_year": 2020, "role_primary": "Pace Bowler", "role_category": "Bowler",
     "franchise": "MI", "country": "India", "is_wicketkeeper": False,
     "runs_scored": 56, "matches_played": 15, "batting_strike_rate": 114.29, "batting_average": 14.00,
     "fours": 4, "sixes": 2, "balls_faced": 49,
     "wickets_taken": 27, "bowling_average": 14.48, "bowling_economy": 6.73, "overs_bowled": 57.0},

    # 9. Bhuvneshwar Kumar 2017 (SRH) — Purple Cap, swing bowler
    {"player_name": "B Kumar", "season_year": 2017, "role_primary": "Pace Bowler", "role_category": "Bowler",
     "franchise": "SRH", "country": "India", "is_wicketkeeper": False,
     "runs_scored": 34, "matches_played": 14, "batting_strike_rate": 106.25, "batting_average": 11.33,
     "fours": 3, "sixes": 1, "balls_faced": 32,
     "wickets_taken": 26, "bowling_average": 14.19, "bowling_economy": 7.05, "overs_bowled": 52.0},

    # 10. Rashid Khan 2020 (SRH) — elite spin
    {"player_name": "Rashid Khan", "season_year": 2020, "role_primary": "Spin Bowler", "role_category": "Bowler",
     "franchise": "SRH", "country": "Afghanistan", "is_wicketkeeper": False,
     "runs_scored": 35, "matches_played": 16, "batting_strike_rate": 116.67, "batting_average": 17.50,
     "fours": 2, "sixes": 3, "balls_faced": 30,
     "wickets_taken": 20, "bowling_average": 17.20, "bowling_economy": 5.37, "overs_bowled": 64.0},

    # 11. Yuzvendra Chahal 2022 (RR) — Purple Cap, leg-spinner
    {"player_name": "YS Chahal", "season_year": 2022, "role_primary": "Spin Bowler", "role_category": "Bowler",
     "franchise": "RR", "country": "India", "is_wicketkeeper": False,
     "runs_scored": 18, "matches_played": 17, "batting_strike_rate": 100.00, "batting_average": 9.00,
     "fours": 1, "sixes": 1, "balls_faced": 18,
     "wickets_taken": 27, "bowling_average": 19.51, "bowling_economy": 7.75, "overs_bowled": 68.0},
]

result = evaluate_xi(smart_xi)

print(f"\n{'='*60}")
print("  SMART HUMAN XI")
print(f"{'='*60}\n")

print(f"Sixer Score:   {result['sixer_score']} / 110")
print(f"Record:        {result['wins']}-{result['losses']}")
print(f"Tier:          {result['tier']}")
print(f"Raw team:      {result['raw_team_score']}")
print(f"Style bonus:   +{result['style_bonus']} ({result['style_triggered']})")
print(f"Penalty:       -{result['structural_penalty']} ({[t[0] for t in result['structural_triggered']]})")

print("\nPlayer scores:")
for ps in result['player_scores']:
    print(f"  {ps['player']:<22} {ps['season']}  {ps['role']:<14}  {ps['score']:>5.2f}")