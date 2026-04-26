
import sqlite3
import os

db_path = "backend/test.db"
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("--- Document Failures ---")
    cursor.execute("SELECT id, filename, status, error_message FROM documents WHERE status = 'failed' ORDER BY id DESC LIMIT 5")
    rows = cursor.fetchall()
    for row in rows:
        print(f"ID: {row[0]}, File: {row[1]}, Status: {row[2]}, Error: {row[3]}")
    
    print("\n--- Recent Deals (Pipeline Logs) ---")
    cursor.execute("SELECT id, deal_name, stage, validation_errors, pipeline_log FROM deals ORDER BY id DESC LIMIT 5")
    rows = cursor.fetchall()
    for row in rows:
        print(f"ID: {row[0]}, Name: {row[1]}, Stage: {row[2]}, Errors: {row[3]}, Log: {row[4]}")
    
    conn.close()
