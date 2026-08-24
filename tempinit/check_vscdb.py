import sqlite3, json, sys

db = r'C:\Users\vincent\AppData\Roaming\Code\User\globalStorage\state.vscdb'
conn = sqlite3.connect(db)
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]
print("Tables:", tables)

for t in tables:
    cur.execute(f"SELECT sql FROM sqlite_master WHERE name='{t}'")
    row = cur.fetchone()
    print(f"\n--- {t} ---")
    print(row[0] if row else "?")

# 尝试查找扩展相关的键
for t in tables:
    try:
        cur.execute(f"PRAGMA table_info({t})")
        cols = [c[1] for c in cur.fetchall()]
        if 'key' in cols and 'value' in cols:
            cur.execute(f"SELECT key, value FROM {t} WHERE key LIKE '%extension%' OR key LIKE '%disable%'")
            for k, v in cur.fetchall():
                print(f"\n[{t}] KEY: {k}")
                print("  VALUE:", v[:2000] if v else v)
    except Exception as e:
        pass

conn.close()
