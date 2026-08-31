/**
 * Luna 穿戴数据源（Provider 模式，可插拔）
 *
 * 真实链路（面试可讲）：
 *   穿戴设备 → 系统健康平台（Health Connect / HealthKit）→ 本地同步 wearableStore
 *   → 后端 /api/health-data/sync（SQLite 持久化）→ 指标派生（体温双相 / 周期）
 *
 * Provider 设计：
 *   - 当前默认「模拟 Provider」：无真实硬件，用按周期阶段生成的模拟数据，但数据流是真链路
 *   - 接真实 Android 设备（Health Connect）只需实现下方 healthConnectProvider 并切换 ACTIVE_PROVIDER，
 *     页面（Home / Observation / Profile）调用接口不变，零改动。
 *   - 完整接入步骤见 docs/android-health-connect-guide.md
 */

// ── Provider 选择（模拟 | 真实）────────────────
const ACTIVE_PROVIDER = 'sim'; // 'sim'（默认）| 'healthConnect'（接入真实设备后切换）

/**
 * Health Connect 真实接入 Provider（骨架）
 * 接入时：npm i react-native-health-connect → 按 docs/android-health-connect-guide.md
 *         填充下方方法 → 把 ACTIVE_PROVIDER 改为 'healthConnect'
 */
const healthConnectProvider = {
  /** 系统 Health Connect 是否可用（Android 14+ 内置 / 13- 需装 App） */
  isAvailable: async () => false,
  /** 请求授权（声明读体温/心率/睡眠等记录类型） */
  requestPermission: async () => false,
  /** 读取体温序列 → { 'YYYY-M-D': 36.5 } */
  readTemperatureSeries: async () => ({}),
  /** 读取实时心率/睡眠/HRV → 组装 getLiveData() 的对象 */
  readLiveData: async () => null,
};

let AsyncStorage = null;
try {
  // eslint-disable-next-line global-require
  const mod = require('@react-native-async-storage/async-storage');
  AsyncStorage = (mod && mod.default) ? mod.default : mod;
} catch (err) {
  AsyncStorage = { getItem: async () => null, setItem: async () => {} };
}
const KEY = '@luna_wearable';
const safeGet = async () => (AsyncStorage && typeof AsyncStorage.getItem === 'function' ? AsyncStorage.getItem(KEY) : null);
const safeSet = async (v) => { if (AsyncStorage && typeof AsyncStorage.setItem === 'function') await AsyncStorage.setItem(KEY, v); };

import { getCycleHistory } from './periodStore';

let _connected = false;
let _source = null;       // 'sim-watch'
let _lastSyncAt = null;
let _temperatures = {};   // { 'YYYY-M-D': 36.5 }
let _loaded = false;

/** 今日在周期中的第几天（最近经期开始算起；无记录返回 0） */
function dayOfCycleToday() {
  const h = getCycleHistory();
  if (!h.length) return 0;
  const last = h[h.length - 1];
  const start = new Date(last.startDate + 'T00:00:00'); start.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((today - start) / 86400000) + 1;
}

/** 按周期阶段生成模拟基础体温（排卵后黄体期升高 0.4°C 形成双相） */
export function generateSimTemperature(dayOfCycle) {
  const base = 36.4;
  let offset = 0;
  if (dayOfCycle >= 16) offset = 0.4;        // 黄体期：高温相
  else if (dayOfCycle >= 14) offset = 0.1;   // 排卵过渡
  const jitter = Math.round((Math.random() * 0.08 - 0.04) * 10) / 10;
  return +(base + offset + jitter).toFixed(1);
}

export async function loadWearable() {
  if (_loaded) return getStatus();
  try {
    const raw = await safeGet();
    if (raw) {
      const d = JSON.parse(raw);
      _connected = !!d.connected;
      _source = d.source || null;
      _lastSyncAt = d.lastSyncAt || null;
      _temperatures = d.temperatures || {};
    }
  } catch (err) { /* 保持默认 */ }
  _loaded = true;
  return getStatus();
}

export function getStatus() {
  return {
    connected: _connected,
    source: _source,
    lastSyncAt: _lastSyncAt,
    tempDays: Object.keys(_temperatures).length,
  };
}

async function persist() {
  try {
    await safeSet(JSON.stringify({
      connected: _connected, source: _source, lastSyncAt: _lastSyncAt, temperatures: _temperatures,
    }));
  } catch (err) { /* 写入失败静默 */ }
}

/** 今日体温键 */
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/** 连接/断开（真实设备应在系统层发起 HealthKit/Health 授权） */
export async function toggleConnection() {
  await loadWearable();
  if (!_connected) {
    _connected = true;
    _source = 'sim-watch';
    // 连接即写一条今日基础体温，形成体温序列起点
    _temperatures[todayKey()] = generateSimTemperature(dayOfCycleToday());
    _lastSyncAt = new Date().toISOString();
  } else {
    _connected = false;
    _source = null;
    _lastSyncAt = null;
  }
  await persist();
  return getStatus();
}

/** 每次“心跳同步”追加今日体温（连接状态下调用） */
export function recordTodayTemperature() {
  if (!_connected) return null;
  const key = todayKey();
  const t = generateSimTemperature(dayOfCycleToday());
  _temperatures[key] = t;
  _lastSyncAt = new Date().toISOString();
  persist();
  return t;
}

/** 当前展示用实时数据（连接时返回模拟值，未连接返回 null） */
export function getLiveData() {
  if (!_connected) return null;
  const dc = dayOfCycleToday();
  return {
    temperature: `${generateSimTemperature(dc)}°`,
    heartRate: `${60 + (dc % 20)} bpm`,
    sleep: `${(6 + (dc % 3) * 0.5).toFixed(1)} h`,
    hrv: `${38 + (dc % 12)} ms`,
  };
}

/**
 * 体温双相趋势（近 N 期）：每期窗口内「后半均温 - 前半均温 ≥ 0.3°C」判有双相
 * @param {number} periods
 * @returns {Array<boolean>}
 */
export function getTempBiphasicTrends(periods = 3) {
  const segs = getCycleHistory();
  if (!segs.length) return [];
  const DAY = 86400000;
  const tMs = (d) => { const [y, m, dd] = String(d).split('-').map(Number); return new Date(y, m - 1, dd).getTime(); };
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;

  const out = [];
  segs.forEach((seg, i) => {
    const winStart = tMs(seg.startDate) - 10 * DAY;
    const winEnd = i < segs.length - 1 ? tMs(segs[i + 1].startDate) - DAY : Infinity;
    const pts = Object.keys(_temperatures)
      .map(d => ({ t: tMs(d), v: _temperatures[d] }))
      .filter(p => p.t >= winStart && p.t <= winEnd)
      .sort((a, b) => a.t - b.t);
    if (pts.length < 4) return; // 样本不足不判定
    const split = Math.floor(pts.length * 0.6); // 前 60% 卵泡相 / 后 40% 黄体相
    const diff = avg(pts.slice(split).map(p => p.v)) - avg(pts.slice(0, split).map(p => p.v));
    out.push(diff >= 0.3); // true = 有双相（提示有排卵）
  });
  return out.slice(-periods);
}

export function __setForTest({ connected = false, temperatures = {}, source = null } = {}) {
  _connected = connected; _source = source; _temperatures = temperatures;
  _loaded = true;
}
