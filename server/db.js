/**
 * Luna 存储层：SQLite（better-sqlite3）
 *
 * 取代原「轻量 JSON 文件」（data/records.json）：
 *   - 真正的数据库：关系表 + 主键 + 索引 + 事务
 *   - users  表：用户
 *   - records 表：按 (user_id, date) 唯一，payload 存 dayRecord JSON（含 __health 特殊行）
 *
 * 迁移：启动时若 DB 为空且存在旧 records.json，一次性导入（幂等）。
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_FILE = path.join(__dirname, 'data', 'luna.db');
const LEGACY_FILE = path.join(__dirname, 'data', 'records.json');

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

// ── Schema ───────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS records (
    user_id    TEXT NOT NULL,
    date       TEXT NOT NULL,
    payload    TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, date)
  );
  CREATE INDEX IF NOT EXISTS idx_records_user ON records(user_id);
`);

const countRows = () => db.prepare('SELECT COUNT(*) c FROM records').get().c;

/** 迁移旧 JSON：DB 无记录且存在 records.json → 一次性导入（幂等） */
function migrateLegacy() {
  if (countRows() > 0 || !fs.existsSync(LEGACY_FILE)) return;
  try {
    const all = JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf8'));
    const ins = db.prepare(
      'INSERT OR REPLACE INTO records (user_id, date, payload, updated_at) VALUES (?,?,?,?)'
    );
    db.transaction(() => {
      for (const [userId, dates] of Object.entries(all)) {
        for (const [date, rec] of Object.entries(dates || {})) {
          ins.run(userId, date, JSON.stringify(rec), new Date().toISOString());
        }
      }
    })();
    console.log(`✅ SQLite：已从 records.json 迁移 ${countRows()} 条记录`);
  } catch (err) {
    console.warn('⚠️  旧 JSON 迁移失败（跳过）：', err.message);
  }
}

/** UPSERT 单条 dayRecord（合并已有字段） */
function saveRecord(userId, record) {
  if (!record || !record.date) return null;
  const existing = getRecord(userId, record.date);
  const merged = { ...(existing || {}), ...record };
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO records (user_id, date, payload, updated_at) VALUES (?,?,?,?)
    ON CONFLICT(user_id, date) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at
  `).run(userId, merged.date, JSON.stringify(merged), now);
  return merged;
}

function getRecord(userId, date) {
  const row = db.prepare('SELECT payload FROM records WHERE user_id=? AND date=?').get(userId, date);
  return row ? JSON.parse(row.payload) : null;
}

/** 某用户全部记录 → { date: dayRecord } */
function getRecords(userId) {
  const rows = db.prepare('SELECT date, payload FROM records WHERE user_id=? ORDER BY date').all(userId);
  const out = {};
  for (const r of rows) out[r.date] = JSON.parse(r.payload);
  return out;
}

function removeRecord(userId, date) {
  db.prepare('DELETE FROM records WHERE user_id=? AND date=?').run(userId, date);
}

/** 穿戴数据：存到特殊行 date='__health' */
function saveHealth(userId, health) {
  return saveRecord(userId, { date: '__health', ...health });
}
function getHealth(userId) {
  return getRecord(userId, '__health');
}

function close() { db.close(); }

module.exports = {
  db, countRows, migrateLegacy,
  saveRecord, getRecord, getRecords, removeRecord,
  saveHealth, getHealth, close,
};
