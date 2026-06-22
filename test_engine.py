"""
test_engine.py
Run the GOAT XI through the new engine to verify the top end of the curve.
"""

from season_engine import evaluate_xi

goat_xi = [
    {"player_name": "V Kohli", "season_year": 2016, "role_primary": "Top-Order Batter", "role_category": "Batter",
     "franchise": "RCB", "country": "India", "is_wicketkeeper": False,
     "runs_scored": 973, "matches_played": 16, "batting_strike_rate": 152.03, "batting_average": 81.08,
     "fours": 83, "sixes": 38, "balls_faced": 640,
     "wickets_taken": 0, "bowling_average": None, "bowling_economy": None, "overs_bowled": 0.0},

    {"player_name": "AB de Villiers", "season_year": 2016, "role_primary": "Middle-Order Batter", "role_category": "Batter",
     "franchise": "RCB", "country": "South Africa", "is_wicketkeeper": False,
     "runs_scored": 687, "matches_played": 16, "batting_strike_rate": 168.79, "batting_average": 52.84,
     "fours": 57, "sixes": 37, "balls_faced": 407,
     "wickets_taken": 0, "bowling_average": None, "bowling_economy": None, "overs_bowled": 0.0},

    {"player_name": "CH Gayle", "season_year": 2011, "role_primary": "Top-Order Batter", "role_category": "Batter",
     "franchise": "RCB", "country": "West Indies", "is_wicketkeeper": False,
     "runs_scored": 608, "matches_played": 12, "batting_strike_rate": 183.13, "batting_average": 67.55,
     "fours": 57, "sixes": 44, "balls_faced": 332,
     "wickets_taken": 8, "bowling_average": 21.62, "bowling_economy": 6.68, "overs_bowled": 30.5},

    {"player_name": "AD Russell", "season_year": 2019, "role_primary": "Batting All-Rounder", "role_category": "All-Rounder",
     "franchise": "KKR", "country": "West Indies", "is_wicketkeeper": False,
     "runs_scored": 514, "matches_played": 14, "batting_strike_rate": 204.81, "batting_average": 51.40,
     "fours": 31, "sixes": 52, "balls_faced": 251,
     "wickets_taken": 11, "bowling_average": 25.09, "bowling_economy": 9.51, "overs_bowled": 29.0},

    {"player_name": "HH Pandya", "season_year": 2022, "role_primary": "Batting All-Rounder", "role_category": "All-Rounder",
     "franchise": "GT", "country": "India", "is_wicketkeeper": False,
     "runs_scored": 487, "matches_played": 15, "batting_strike_rate": 131.27, "batting_average": 44.27,
     "fours": 49, "sixes": 12, "balls_faced": 371,
     "wickets_taken": 8, "bowling_average": 27.25, "bowling_economy": 7.28, "overs_bowled": 30.0},

    {"player_name": "RA Jadeja", "season_year": 2020, "role_primary": "Bowling All-Rounder", "role_category": "All-Rounder",
     "franchise": "CSK", "country": "India", "is_wicketkeeper": False,
     "runs_scored": 232, "matches_played": 14, "batting_strike_rate": 171.85, "batting_average": 46.40,
     "fours": 22, "sixes": 11, "balls_faced": 135,
     "wickets_taken": 6, "bowling_average": 36.50, "bowling_economy": 8.75, "overs_bowled": 25.0},

    {"player_name": "MS Dhoni", "season_year": 2013, "role_primary": "Wicketkeeper", "role_category": "Wicketkeeper",
     "franchise": "CSK", "country": "India", "is_wicketkeeper": True,
     "runs_scored": 461, "matches_played": 18, "batting_strike_rate": 162.89, "batting_average": 41.91,
     "fours": 38, "sixes": 25, "balls_faced": 283,
     "wickets_taken": 0, "bowling_average": None, "bowling_economy": None, "overs_bowled": 0.0},

    {"player_name": "JJ Bumrah", "season_year": 2020, "role_primary": "Pace Bowler", "role_category": "Bowler",
     "franchise": "MI", "country": "India", "is_wicketkeeper": False,
     "runs_scored": 56, "matches_played": 15, "batting_strike_rate": 114.29, "batting_average": 14.00,
     "fours": 4, "sixes": 2, "balls_faced": 49,
     "wickets_taken": 27, "bowling_average": 14.48, "bowling_economy": 6.73, "overs_bowled": 57.0},

    {"player_name": "SL Malinga", "season_year": 2013, "role_primary": "Pace Bowler", "role_category": "Bowler",
     "franchise": "MI", "country": "Sri Lanka", "is_wicketkeeper": False,
     "runs_scored": 39, "matches_played": 17, "batting_strike_rate": 102.63, "batting_average": 19.50,
     "fours": 3, "sixes": 2, "balls_faced": 38,
     "wickets_taken": 20, "bowling_average": 19.00, "bowling_economy": 6.40, "overs_bowled": 63.0},

    {"player_name": "Rashid Khan", "season_year": 2020, "role_primary": "Spin Bowler", "role_category": "Bowler",
     "franchise": "SRH", "country": "Afghanistan", "is_wicketkeeper": False,
     "runs_scored": 35, "matches_played": 16, "batting_strike_rate": 116.67, "batting_average": 17.50,
     "fours": 2, "sixes": 3, "balls_faced": 30,
     "wickets_taken": 20, "bowling_average": 17.20, "bowling_economy": 5.37, "overs_bowled": 64.0},

    {"player_name": "YS Chahal", "season_year": 2016, "role_primary": "Spin Bowler", "role_category": "Bowler",
     "franchise": "RCB", "country": "India", "is_wicketkeeper": False,
     "runs_scored": 12, "matches_played": 13, "batting_strike_rate": 92.31, "batting_average": 6.00,
     "fours": 1, "sixes": 0, "balls_faced": 13,
     "wickets_taken": 21, "bowling_average": 18.62, "bowling_economy": 8.15, "overs_bowled": 49.2},
]

result = evaluate_xi(goat_xi)

print(f"Sixer Score: {result['sixer_score']} / 110")
print(f"Record: {result['wins']}-{result['losses']}")
print(f"Tier: {result['tier']}")
print(f"Raw team: {result['raw_team_score']}")
print(f"Style bonus: +{result['style_bonus']} ({result['style_triggered']})")
print(f"Penalty: -{result['structural_penalty']} ({[t[0] for t in result['structural_triggered']]})")
print("\nPlayer scores:")
for ps in result['player_scores']:
    print(f"  {ps['player']:<22} {ps['season']}  {ps['role']:<14}  {ps['score']:>5.2f}")