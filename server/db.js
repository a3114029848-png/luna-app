/**
 * Luna 存储层：SQLite（sql.js —— 纯 WASM，免编译）
 *
 * 说明：better-sqlite3 需要本地编译（Windows 服务器无 VS Build Tools 会失败），
 *       故改用 sql.js（WASM 编译好的二进制，任何平台零编译直接装）。
 * 功能等价：records 表 (user_id, date) 复合主键 + 索引；内存库 + 每次写后 export 落盘。
 *
 * API 均为 async（内部先 await init()）。
 */

const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const DB_FILE = path.join(__dirname, 'data', 'luna.db');
const LEGACY_FILE = path.join(__dirname, 'data', 'records.json');

let db = null;
let _ready = null;

/** 异步初始化：加载 WASM + 打开/建表 + 迁移旧 JSON（迁移内联，避免 countRows/migrateLegacy 递归等待） */
async function init() {
  if (_ready) return _ready;
  _ready = (async () => {
    const SQL = await initSqlJs();
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    db = fs.existsSync(DB_FILE)
      ? new SQL.Database(fs.readFileSync(DB_FILE))
      : new SQL.Database();
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS records (
        user_id TEXT NOT NULL, date TEXT NOT NULL, payload TEXT NOT NULL,
        updated_at TEXT NOT NULL, PRIMARY KEY (user_id, date)
      );
      CREATE INDEX IF NOT EXISTS idx_records_user ON records(user_id);
    `);
    // 迁移旧 JSON（直接查 db，不再调用 countRows/migrateLegacy —— 防止递归死锁）
    try {
      const cnt = db.exec('SELECT COUNT(*) c FROM records');
      const count = cnt.length ? cnt[0].values[0][0] : 0;
      if (count === 0 && fs.existsSync(LEGACY_FILE)) {
        const all = JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf8'));
        const now = new Date().toISOString();
        for (const [userId, dates] of Object.entries(all)) {
          for (const [date, rec] of Object.entries(dates || {})) {
            db.run('INSERT OR REPLACE INTO records (user_id,date,payload,updated_at) VALUES (?,?,?,?)',
              [userId, date, JSON.stringify(rec), now]);
          }
        }
        persist();
        console.log(`✅ SQLite(sql.js)：已从 records.json 迁移 ${count} 条记录`);
      }
    } catch (err) {
      console.warn('⚠️  旧 JSON 迁移失败（跳过）：', err.message);
    }
  })();
  return _ready;
}

/** 落盘：把内存库 export 写入 data/luna.db */
function persist() {
  if (!db) return;
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
}

const countRows = async () => {
  await init();
  const r = db.exec('SELECT COUNT(*) c FROM records');
  return r.length ? r[0].values[0][0] : 0;
};

/** 迁移入口（init 已内联处理；此函数供外部显式调用，幂等） */
async function migrateLegacy() {
  await init();
}

/** UPSERT 单条 dayRecord（合并已有字段） */
async function saveRecord(userId, record) {
  await init();
  if (!record || !record.date) return null;
  const existing = await getRecord(userId, record.date);
  const merged = { ...(existing || {}), ...record };
  db.run(
    'INSERT INTO records (user_id,date,payload,updated_at) VALUES (?,?,?,?) ' +
    'ON CONFLICT(user_id,date) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at',
    [userId, merged.date, JSON.stringify(merged), new Date().toISOString()]
  );
  persist();
  return merged;
}

async function getRecord(userId, date) {
  await init();
  const r = db.exec(`SELECT payload FROM records WHERE user_id='${userId}' AND date='${date}'`);
  if (!r.length || !r[0].values.length) return null;
  return JSON.parse(r[0].values[0][0]);
}

/** 某用户全部记录 → { date: dayRecord } */
async function getRecords(userId) {
  await init();
  const r = db.exec(`SELECT date, payload FROM records WHERE user_id='${userId}' ORDER BY date`);
  if (!r.length) return {};
  const out = {};
  for (const [d, p] of r[0].values) out[d] = JSON.parse(p);
  return out;
}

async function removeRecord(userId, date) {
  await init();
  db.run(`DELETE FROM records WHERE user_id='${userId}' AND date='${date}'`);
  persist();
}

/** 穿戴数据：存到特殊行 date='__health' */
const saveHealth = (userId, health) => saveRecord(userId, { date: '__health', ...health });
const getHealth = (userId) => getRecord(userId, '__health');

function close() { if (db) db.close(); }

module.exports = {
  init, countRows, migrateLegacy,
  saveRecord, getRecord, getRecords, removeRecord,
  saveHealth, getHealth, close,
};
