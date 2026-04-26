import sqlite3
import os

db_path = 'backend/test.db'
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
    # Try alternate path
    db_path = 'backend/app/test.db'

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM properties LIMIT 5;")
    rows = cursor.fetchall()
    for row in rows:
        print(f"ID: {row[0]}, Name: {row[1]}")
    conn.close()
else:
    print("Database file not found.")
