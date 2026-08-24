import sqlite3, json, shutil, os, time

db = r'C:\Users\vincent\AppData\Roaming\Code\User\globalStorage\state.vscdb'
backup = db + '.bak_before_gradle_disable'

# 1. 备份
shutil.copy2(db, backup)
print("已备份到:", backup)

conn = sqlite3.connect(db)
cur = conn.cursor()

key = 'extensionsEnablement/disabled'
value = json.dumps([{"id": "vscjava.vscode-gradle"}])

# 2. 先看现有的 disabled 值（如果有）
cur.execute("SELECT value FROM ItemTable WHERE key=?", (key,))
row = cur.fetchone()
print("现有 disabled 值:", row[0].decode('utf-8', errors='replace') if row and row[0] else "(无)")

# 3. 写入（如果已有则合并，避免覆盖其他被禁扩展）
existing = []
if row and row[0]:
    try:
        existing = json.loads(row[0])
        if not isinstance(existing, list):
            existing = []
    except Exception:
        existing = []

ids = {e.get('id') if isinstance(e, dict) else e for e in existing}
if 'vscjava.vscode-gradle' not in ids:
    existing.append({"id": "vscjava.vscode-gradle"})

new_value = json.dumps(existing)
cur.execute("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)", (key, new_value.encode('utf-8')))
conn.commit()
print("已写入:", key, "=", new_value)

# 4. 验证
cur.execute("SELECT value FROM ItemTable WHERE key=?", (key,))
check = cur.fetchone()
print("验证读回:", check[0].decode('utf-8', errors='replace') if check and check[0] else "(无)")
conn.close()
print("完成")
