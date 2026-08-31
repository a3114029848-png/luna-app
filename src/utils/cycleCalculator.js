/**
 * 周期阶段推算工具
 *
 * 数据来源：用户手动标记的经期开始/结束日期
 * 推算逻辑：
 *   - 月经期    = 用户标记出血日（实测）
 *   - 排卵期    = 经期第1天 + (平均周期 - 14天)，前后各1天
 *   - 黄体期    = 排卵期结束后 → 预测来潮前1天
 *   - 预测经期  = 上次第1天 + 平均周期（虚线显示）
 *
 * 注意：推算结果仅供参考，误差取决于已记录的周期数
 */

import { FIGO } from '../constants/medicalThresholds';

/**
 * 根据历史经期记录计算平均周期长度
 * @param {Array<{startDate: string}>} cycleHistory - 历史周期数组，按时间正序
 * @returns {number} 平均周期天数（不足2期时返回默认28天）
 */
export function calcAverageCycle(cycleHistory) {
  if (!cycleHistory || cycleHistory.length < 2) return 28;

  const lengths = [];
  for (let i = 1; i < cycleHistory.length; i++) {
    const prev = new Date(cycleHistory[i - 1].startDate);
    const curr = new Date(cycleHistory[i].startDate);
    const diff = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
    if (diff > 10 && diff < 60) lengths.push(diff); // 过滤异常值
  }

  if (lengths.length === 0) return 28;
  return Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
}

/**
 * 获取指定日期所处的周期阶段
 * @param {Date} date - 目标日期
 * @param {Date} lastPeriodStart - 最近一次经期开始日
 * @param {number} periodDuration - 最近一次经期持续天数
 * @param {number} avgCycle - 平均周期长度
 * @returns {'period'|'follicular'|'ovulation'|'luteal'|'predicted'|null}
 */
export function getPhaseForDate(date, lastPeriodStart, periodDuration, avgCycle) {
  // 规范到当天 00:00，避免「当前时刻」造成 dayOfCycle 偏移（当天记录应 = 第 1 天）
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  const start = new Date(lastPeriodStart); start.setHours(0, 0, 0, 0);
  const dayOfCycle = Math.round((d - start) / (1000 * 60 * 60 * 24)) + 1;

  // 月经期（实测）
  if (dayOfCycle >= 1 && dayOfCycle <= periodDuration) return 'period';

  // 排卵期窗口（均值 - 14天，前后1天）
  const ovulationDay = avgCycle - 14;
  if (dayOfCycle >= ovulationDay - 1 && dayOfCycle <= ovulationDay + 1) return 'ovulation';

  // 黄体期
  if (dayOfCycle > ovulationDay + 1 && dayOfCycle < avgCycle) return 'luteal';

  // 预测经期（下一周期）
  if (dayOfCycle >= avgCycle && dayOfCycle <= avgCycle + periodDuration - 1) return 'predicted';

  // 卵泡期（留白，不特别标注）
  return 'follicular';
}

/**
 * 生成当前周期进度条数据（0～1）
 * @param {number} dayOfCycle - 本周期第几天
 * @param {number} avgCycle - 平均周期长度
 * @returns {number} 进度比例
 */
export function getCycleProgress(dayOfCycle, avgCycle) {
  return Math.min(dayOfCycle / avgCycle, 1);
}

/**
 * 计算周期标准差（判断规律性）
 * @param {number[]} cycleLengths - 各期周期长度数组
 * @returns {number}
 */
export function calcStdDev(cycleLengths) {
  if (cycleLengths.length < 2) return 0;
  const mean = cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length;
  const variance = cycleLengths.reduce((a, b) => a + (b - mean) ** 2, 0) / cycleLengths.length;
  return Math.sqrt(variance);
}

/**
 * 异常预警规则（基于 FIGO 标准，返回提示信息）
 * @param {number[]} recentCycles - 最近几期的周期长度
 * @returns {Array<{type:'danger'|'warning', message:string}>}
 */
export function checkAlerts(recentCycles) {
  const alerts = [];
  if (!recentCycles || recentCycles.length < 2) return alerts;

  const recent2 = recentCycles.slice(-2);

  // 周期频率异常
  if (recent2.every(c => c < FIGO.CYCLE_MIN)) {
    alerts.push({ type: 'danger', message: `连续${recent2.length}期周期 <${FIGO.CYCLE_MIN} 天（FIGO 定义频发），建议就医` });
  } else if (recent2.every(c => c > FIGO.CYCLE_MAX)) {
    alerts.push({ type: 'danger', message: `连续${recent2.length}期周期 >${FIGO.CYCLE_MAX} 天（FIGO 定义稀发），建议就医` });
  }

  // 周期规律性
  const std = calcStdDev(recentCycles);
  if (std > FIGO.REGULARITY_STD_MAX) {
    alerts.push({ type: 'warning', message: `近期周期波动较大（标准差 ${std.toFixed(1)} 天），建议持续记录` });
  }

  return alerts;
}

/**
 * 生成指定月份的「每日阶段/预测」map（算法推算，与用户手动标记分离）
 * 用于日历：无手动标记的日期自动显示排卵/黄体浅色点，预测经期显示虚线。
 * @param {number} year - 年份
 * @param {number} month - 月份（1-12）
 * @param {Array<{startDate:string,endDate:string}>} cycleHistory - 经期段（时间正序）
 * @param {number} avgCycle - 平均周期（天）
 * @returns {Object} { 'YYYY-M-D': 'period'|'follicular'|'ovulation'|'luteal'|'predicted' }
 */
export function getMonthPhaseMap(year, month, cycleHistory, avgCycle) {
  const key = (y, m, d) => `${y}-${m}-${d}`;
  const norm = dt => { const x = new Date(dt); x.setHours(0, 0, 0, 0); return x; };
  const DAY = 86400000;
  const daysInMonth = new Date(year, month, 0).getDate();
  const map = {};
  const segs = cycleHistory || [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = norm(new Date(year, month - 1, d));
    // 找该天之前最近的经期段（作为推算基准；段开始日在日期之后则停止）
    let last = null;
    for (const seg of segs) {
      const s = norm(new Date(seg.startDate + 'T00:00:00'));
      if (s <= date) last = seg;
      else break;
    }
    if (!last) continue; // 该天之前无经期记录 → 不推算
    const start = norm(new Date(last.startDate + 'T00:00:00'));
    const dur = Math.round((norm(new Date(last.endDate + 'T00:00:00')) - start) / DAY) + 1;
    map[key(year, month, d)] = getPhaseForDate(date, start, dur, avgCycle);
  }
  return map;
}
