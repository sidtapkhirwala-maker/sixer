import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur  = conn.cursor()

cur.execute("""
    UPDATE draftable_pool
    SET role_category   = 'All-Rounder',
        is_wicketkeeper = FALSE
    WHERE player_name = 'Abhishek Sharma'
""")
print("draftable_pool rows updated:", cur.rowcount)

# Also fix player_seasons so the source data is consistent
cur.execute("""
    UPDATE player_seasons
    SET wicketkeeper_override = 0,
        role_primary          = 'Batting All-Rounder'
    WHERE player_name = 'Abhishek Sharma'
""")
print("player_seasons rows updated:", cur.rowcount)

conn.commit()
conn.close()
print("Done.")
