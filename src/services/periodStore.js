/**
 * Luna 统一存储层（数据持久化闭环核心）
 *
 * 职责：
 *   - 以「天」为粒度持久化经期/症状记录（AsyncStorage），刷新不丢
 *   - 提供同步读内存接口，供 agentTools.handle()（同步）与各界面直接使用
 *   - 从「按天记录」派生：经期段 getCycleHistory() / 指标趋势 getIndicatorTrendsData()
 *
 * 数据模型（dayRecord，键 = 'YYYY-M-D' 无前导零，与日历一致）：
 *   { date, type('period'|'ovulation'|'luteal'|'normal'), bleed_type, flow,
 *     color, clot, pain_level, pain_location, painkiller, breast_pain,
 *     acne, hirsutism, galactorrhea, coag_signs, meds, meds_note,
 *     mood, energy, sleep, note }
 *
 * 派生说明：
 *   - 经期段：所有 type='period' 的连续天合并为一段 {startDate,endDate}（ISO 'YYYY-MM-DD'，兼容 cycleCalculator）
 *   - 指标趋势：按「经期段周期窗口」分桶聚合（窗口 = 段开始-10天 ~ 下段开始-1天）；
 *     每个指标取该窗口代表值（pain/breast 均值、clot/imb 最大值、mood 反向后均值）
 */

// RN AsyncStorage；Node（评测/单测）环境自动降级为内存 mock，保证派生逻辑可被 Node 直接验证
// ⚠️ 必须处理 Metro/Babel 的 default 导出 interop：import X 取 default，裸 require 可能返回 {default}，
//    否则 persist/loadAll 里 getItem/setItem 为 undefined → 静默失败 → 切页 loadAll 清空内存（数据丢失）
let AsyncStorage = null;
try {
  // eslint-disable-next-line global-require
  const mod = require('@react-native-async-storage/async-storage');
  AsyncStorage = (mod && mod.default) ? mod.default : mod;
} catch (err) {
  // 降级：内存持久化 mock（Node 单测/评测用，可验证「保存 → loadAll 不丢数据」闭环）
  let _mem = null;
  AsyncStorage = {
    getItem: async () => _mem,
    setItem: async (_k, v) => { _mem = v; },
  };
}

// 安全访问：AsyncStorage 不可用时返回 null，绝不抛出（避免 loadAll 覆盖内存缓存）
const safeGetItem = async () => (
  AsyncStorage && typeof AsyncStorage.getItem === 'function' ? AsyncStorage.getItem(KEY) : null
);
const safeSetItem = async (val) => {
  if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
    await AsyncStorage.setItem(KEY, val);
  }
};

const KEY = '@luna_period_records';

// 内存缓存（同步读）：{ 'YYYY-M-D': dayRecord }
let _cache = {};

// 测试/演示 override（评测脚本注入用；生产不要调用）
let _override = null;

// 云同步钩子（由上层注入，如 api.js 的后端同步；后端不可用时静默跳过）
let _syncHooks = null; // { onSaved: (record)=>Promise, onLoad: ()=>Promise<records对象> }
export function setCloudSyncHooks(hooks) {
  _syncHooks = hooks;
}

// ── 日期工具 ─────────────────────────────────
const pad2 = n => String(n).padStart(2, '0');

/** Date → 'YYYY-M-D'（无前导零，作为 dayRecord 键） */
export function fmtKey(dt) {
  return `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
}

/** 'YYYY年M月D日' → 'YYYY-M-D'（RecordBottomSheet 收到的日期格式） */
export function fmtKeyFromCN(str) {
  const m = String(str || '').match(/(\d+)年(\d+)月(\d+)日/);
  return m ? `${m[1]}-${+m[2]}-${+m[3]}` : String(str);
}

/** Date → 'YYYY-MM-DD'（ISO 有前导零，经期段输出用，兼容 cycleCalculator） */
export function fmtISO(dt) {
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/** 'YYYY-M-D' 或 'YYYY-MM-DD' → 毫秒时间戳（手动拆分，避免混合格式被 Invalid Date） */
const parseMs = d => {
  const [y, m, day] = String(d).split('-').map(Number);
  return new Date(y, m - 1, day).getTime();
};

export const todayKey = () => fmtKey(new Date());
export const todayISO = () => fmtISO(new Date());

// ── 生命周期：App 启动时 hydrate ──────────────
export async function loadAll() {
  try {
    const raw = await safeGetItem();
    _cache = raw ? JSON.parse(raw) : {};
  } catch (err) {
    _cache = {};
  }
  // 云同步：拉取远端记录，合并到本地（本地优先，远端补缺）
  if (_syncHooks && _syncHooks.onLoad) {
    try {
      const remote = await _syncHooks.onLoad();
      if (remote && typeof remote === 'object') {
        _cache = { ...remote, ..._cache };
      }
    } catch (err) {
      /* 后端不可用：仅用本地数据 */
    }
  }
  return _cache;
}

// ── 写操作（乐观更新内存 + 异步落盘）───────────
export async function saveDayRecord(record) {
  const date = record.date || todayKey();
  const merged = { ...(_cache[date] || {}), ...record, date };
  // 值为 undefined 的键视为「删除该字段」（如：异常出血时清掉日历标过的 type='period'）
  for (const k of Object.keys(record)) {
    if (record[k] === undefined) delete merged[k];
  }
  _cache[date] = merged;
  await persist();
  // 云同步：上报到后端（fire-and-forget，失败静默）
  if (_syncHooks && _syncHooks.onSaved) {
    try {
      await _syncHooks.onSaved(_cache[date]);
    } catch (err) {
      /* 后端不可用：仅本地保存 */
    }
  }
  return _cache[date];
}

export async function removeDayRecord(date) {
  delete _cache[date];
  await persist();
}

async function persist() {
  try {
    await safeSetItem(JSON.stringify(_cache));
  } catch (err) {
    /* 写入失败静默（内存仍可用） */
  }
}

// ── 读操作（同步，供 handle / 界面直接调用）───
export function getDayRecord(date) {
  return _cache[date] || null;
}

export function getAllDayRecords() {
  return _cache;
}

// ── 派生：经期段列表 ─────────────────────────
export function getCycleHistory() {
  if (_override) return _override.cycleHistory;
  const days = Object.keys(_cache)
    .filter(d => _cache[d].type === 'period')
    .sort((a, b) => parseMs(a) - parseMs(b));

  const segs = [];
  let start = null;
  let prev = null;
  for (const d of days) {
    const t = parseMs(d);
    if (start === null) start = t;
    else if (t - prev !== 86400000) {
      segs.push({ startDate: fmtISO(new Date(start)), endDate: fmtISO(new Date(prev)) });
      start = t;
    }
    prev = t;
  }
  if (start !== null) segs.push({ startDate: fmtISO(new Date(start)), endDate: fmtISO(new Date(prev)) });
  return segs;
}

// ── 派生：就医指标趋势（近 N 期，按经期段窗口分桶）──
export function getIndicatorTrendsData(periods = 3) {
  if (_override) return _override.indicatorTrends;
  const segs = getCycleHistory();
  if (!segs.length) return {};

  const records = Object.keys(_cache)
    .map(d => ({ ..._cache[d], date: d }))
    .sort((a, b) => parseMs(a.date) - parseMs(b.date));

  // 每段窗口：本段 start-10 天 ~ 下段 start-1 天（最后一段到无限）
  const buildTrend = (pick) => segs.map((seg, i) => {
    const winStart = parseMs(seg.startDate) - 10 * 86400000;
    const winEnd = i < segs.length - 1 ? parseMs(segs[i + 1].startDate) - 86400000 : Infinity;
    const inWin = records.filter(r => {
      const t = parseMs(r.date);
      return t >= winStart && t <= winEnd;
    });
    return pick(inWin);
  }).filter(v => v !== null && v !== undefined).slice(-periods);

  const avgNum = (w, field) => {
    const ns = w.map(r => r[field]).filter(v => v !== undefined && v !== null);
    return ns.length ? Math.round(ns.reduce((a, b) => a + b, 0) / ns.length) : null;
  };
  const anyOf = (w, test) => {
    const hit = w.filter(r => r[test] !== undefined && r[test] !== null);
    return hit.length ? (hit.some(r => r[test]) ? 1 : 0) : null;
  };

  return {
    pain:   buildTrend(w => avgNum(w, 'pain_level')),
    clot:   buildTrend(w => {
      const cs = w.filter(r => r.clot !== undefined && r.clot !== null);
      return cs.length ? (cs.some(r => r.clot === true || r.clot === 1 || r.clot === '是' || r.clot === '有血块') ? 1 : 0) : null;
    }),
    imb:    buildTrend(w => {
      const bs = w.filter(r =>
        (r.bleed_type !== undefined && r.bleed_type !== null) ||
        (r.abnormal !== undefined && r.abnormal !== null));
      return bs.length ? (bs.some(r => r.bleed_type === '经间期出血' || r.abnormal === 'imb') ? 1 : 0) : null;
    }),
    breast: buildTrend(w => avgNum(w, 'breast_pain')),
    // 基础体温双相：暂无数据源（待穿戴设备接入），保持空趋势（alertLevel 空数组→normal，不误判）
    temp_biphasic: [],
    mood:   buildTrend(w => {
      const ns = w.map(r => r.mood).filter(v => v !== undefined && v !== null);
      // RecordBottomSheet mood：0=很差…4=很好；指标语义为「经前低落」越大越低 → 反向
      return ns.length ? Math.round(ns.reduce((a, b) => a + (4 - b), 0) / ns.length) : null;
    }),
  };
}

// ── 派生：近 N 期周期汇总（观察页 / 导出报告用）──
export function getCycleSummaries(periods = 6) {
  const all = getCycleHistory();
  const segs = all.slice(-periods);
  const offset = all.length - segs.length;
  const records = getAllDayRecords();

  return segs.map((seg, i) => {
    const sMs = parseMs(seg.startDate);
    const eMs = parseMs(seg.endDate);
    // 用时间戳比较，避免无前导零日期键（'2026-10-1'）按字典序比较出错（'2026-9-30' > '2026-10-1'）
    const flowVals = Object.keys(records)
      .filter(d => { const t = parseMs(d); return t >= sMs && t <= eMs; })
      .map(d => records[d].flow)
      .filter(v => v !== undefined && v !== null);
    // 最后一段没有「下一段」→ 周期长度未知（null，由展示层兜底）
    const cycleDays = i + 1 < segs.length
      ? Math.round((parseMs(segs[i + 1].startDate) - parseMs(seg.startDate)) / 86400000)
      : null;
    return {
      label: `第${offset + i + 1}期`,
      cycleDays,
      periodDays: Math.round((parseMs(seg.endDate) - parseMs(seg.startDate)) / 86400000) + 1,
      flowLevel: flowVals.length ? Math.round(flowVals.reduce((a, b) => a + b, 0) / flowVals.length) : 2,
    };
  });
}

// ── 评测 / Demo 注入（生产不要调用）────────────
export function seedForTest(cycleHistory, indicatorTrends) {
  _override = { cycleHistory, indicatorTrends };
}

export function clearOverride() {
  _override = null;
}

// ── 测试钩子（仅单测：直接注入 dayRecords，走真实派生逻辑）──
export function __setRecordsForTest(records) {
  _cache = records || {};
  _override = null;
}
