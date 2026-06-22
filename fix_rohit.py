import sqlite3

DB_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\Sixer - The Game\Data\sixer.db"

conn = sqlite3.connect(DB_PATH)
cur  = conn.cursor()

# Rohit is not a keeper — fix his role back to Top-Order Batter
cur.execute("""
    UPDATE player_seasons
    SET wicketkeeper_override = 0,
        role_primary = 'Top-Order Batter'
    WHERE player_name = 'RG Sharma'
""")
print(f"Rows updated: {cur.rowcount}")

conn.commit()
conn.close()
print("Done.")
