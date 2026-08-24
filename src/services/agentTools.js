/**
 * Luna 本地 Agent 工具层
 *
 * 目标：让 AI 助手具备「工具调用」能力，而非纯闲聊 ——
 *   1. 识别用户意图（周期分析 / 阶段查询 / 指标趋势 / 就诊摘要 / 危险问题）
 *   2. 调用本地数据工具（FIGO 周期规则引擎 / 就医指标），基于用户数据生成回答
 *   3. 危险问题走安全兜底，不让 LLM 自由发挥
 *   4. 其余问题才转发到云端 chatStream
 *
 * 数据源说明：当前为模拟数据（MOCK_*），TODO：切换为 AsyncStorage + 后端同步
 * 边界声明：所有回答仅为健康参考，不构成医疗诊断。
 */

import { FIGO, MEDICAL_INDICATORS, ALERT_STYLES } from '../constants/medicalThresholds';
import {
  calcAverageCycle,
  checkAlerts,
  getPhaseForDate,
  calcStdDev,
} from '../utils/cycleCalculator';
import { searchKB } from './medicalKB';

// ─────────────────────────────────────────────
// 模拟数据源（TODO: 改为从 AsyncStorage / 后端读取真实数据）
// ─────────────────────────────────────────────
const MOCK_CYCLE_HISTORY = [
  { startDate: '2026-04-28', endDate: '2026-05-02' },
  { startDate: '2026-05-27', endDate: '2026-05-31' },
  { startDate: '2026-06-25', endDate: '2026-06-30' },
  { startDate: '2026-07-24', endDate: '2026-07-28' },
];

const MOCK_INDICATOR_TRENDS = {
  pain:          [0, 1, 2],   // 连续2期中度及以上 → danger
  clot:          [0, 2, 1],   // 最近1期偏多 → danger
  imb:           [0, 0, 1],   // 经间期出血1次 → danger（FIGO AUB-E）
  breast:        [1, 1, 1],   // 非持续3级 → normal
  temp_biphasic: [true, true, false], // 出现非双相 → warning
  mood:          [0, 2, 3],   // 连续2期加重 → warning
};

// 阶段中文名映射（与 HomeScreen PHASES 保持一致）
const PHASE_LABELS = {
  period:     '月经期',
  follicular: '卵泡期',
  ovulation:  '排卵期',
  luteal:     '黄体期',
  predicted:  '预测经期（本次可能推迟）',
};

const DAY_MS = 1000 * 60 * 60 * 24;
const dstr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / DAY_MS);
const daysSince = (a) => Math.round((Date.now() - new Date(a)) / DAY_MS);

// ─────────────────────────────────────────────
// 数据读取（后续替换为真实数据源）
// ─────────────────────────────────────────────
export function getCycleHistory() {
  // TODO: 从 AsyncStorage / 后端读取，替换 MOCK_CYCLE_HISTORY
  return MOCK_CYCLE_HISTORY;
}

export function getIndicatorTrendsData() {
  // TODO: 从 RecordBottomSheet 保存的记录聚合，替换 MOCK_INDICATOR_TRENDS
  return MOCK_INDICATOR_TRENDS;
}

// 由历史经期计算各期周期长度（相邻开始日间隔）
function computeCycleLengths(history) {
  const lengths = [];
  for (let i = 1; i < history.length; i++) {
    const len = daysBetween(history[i - 1].startDate, history[i].startDate);
    if (len > 10 && len < 60) lengths.push(len);
  }
  return lengths;
}

// 最近一次经期持续天数
function lastPeriodDuration(history) {
  const last = history[history.length - 1];
  return daysBetween(last.startDate, last.endDate) + 1;
}

// ─────────────────────────────────────────────
// 工具 1：周期分析（基于 FIGO 规则引擎）
// ─────────────────────────────────────────────
export function analyzeCycles() {
  const history = getCycleHistory();
  const lengths = computeCycleLengths(history);
  const avg = calcAverageCycle(history);
  const std = calcStdDev(lengths);
  const alerts = checkAlerts(lengths);

  const lines = [
    `📊 周期分析（基于你最近 ${history.length} 次经期记录，FIGO 国际标准）`,
    `· 平均周期：${avg} 天（FIGO 正常范围 ${FIGO.CYCLE_MIN}~${FIGO.CYCLE_MAX} 天）`,
    `· 周期波动（标准差）：${std.toFixed(1)} 天${std > FIGO.REGULARITY_STD_MAX ? '，超出正常阈值' : ''}`,
  ];
  if (alerts.length) {
    alerts.forEach(a => lines.push(`· ${a.message}`));
  } else {
    lines.push('· 近期周期处于 FIGO 正常范围内，未触发异常预警 ✅');
  }
  lines.push('\n⚠️ 以上仅为健康参考，不构成医疗诊断。');

  return { intent: 'cycle_analysis', text: lines.join('\n'), data: { avg, std, alerts } };
}

// ─────────────────────────────────────────────
// 工具 2：周期阶段查询
// ─────────────────────────────────────────────
export function getPhaseSummary() {
  const history = getCycleHistory();
  const last = history[history.length - 1];
  const avg = calcAverageCycle(history);
  const phase = getPhaseForDate(new Date(), last.startDate, lastPeriodDuration(history), avg);
  const dayOfCycle = daysSince(last.startDate) + 1;

  const text =
    `🗓 当前周期阶段\n` +
    `· 今天是本周期第 ${dayOfCycle} 天（上次经期 ${last.startDate} 开始）\n` +
    `· 当前阶段：${PHASE_LABELS[phase] || phase}\n` +
    (phase === 'predicted'
      ? `· 按平均周期 ${avg} 天推算，你已超过预期来潮日，可留意身体信号；若明显推迟，建议结合记录咨询医生\n`
      : `· 平均周期 ${avg} 天，推算基于你的历史记录（非黑箱）\n`) +
    `\n⚠️ 推算仅供参考，误差取决于已记录的周期数。`;

  return { intent: 'phase', text, data: { phase, dayOfCycle, avg } };
}

// ─────────────────────────────────────────────
// 工具 3：就医指标趋势解读
// ─────────────────────────────────────────────
export function getIndicatorTrends() {
  const trends = getIndicatorTrendsData();
  const rows = MEDICAL_INDICATORS.map(cfg => {
    const trend = trends[cfg.id];
    const level = cfg.alertLevel(trend);
    const style = ALERT_STYLES[level];
    return `· ${cfg.label}：${style.label}`;
  });

  const text =
    `🩺 就医指标追踪（近 3 期）\n` +
    rows.join('\n') +
    `\n\n📌 解读：标为「建议就医」的指标建议在下次就诊时主动告知医生；「关注」项建议持续记录观察。` +
    `\n⚠️ 以上仅为健康参考，不构成医疗诊断。`;

  return { intent: 'indicators', text, data: { rows } };
}

// ─────────────────────────────────────────────
// 工具 4：生成就诊摘要（结构化给医生看）
// ─────────────────────────────────────────────
export function generateVisitSummary() {
  const history = getCycleHistory();
  const lengths = computeCycleLengths(history);
  const avg = calcAverageCycle(history);
  const std = calcStdDev(lengths);
  const alerts = checkAlerts(lengths);
  const trends = getIndicatorTrendsData();

  // 收集达到「建议就医」的指标
  const dangerItems = MEDICAL_INDICATORS.filter(cfg => {
    const level = cfg.alertLevel(trends[cfg.id]);
    return level === 'danger';
  }).map(cfg => cfg.label);

  const text =
    `📋 就诊摘要（可提供给医生参考）\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `【周期概况】近 ${history.length} 期，平均 ${avg} 天，波动标准差 ${std.toFixed(1)} 天\n` +
    (alerts.length ? `【周期预警】${alerts.map(a => a.message).join('；')}\n` : '【周期预警】无\n') +
    `【需主动告知】${dangerItems.length ? dangerItems.join('、') : '暂无（可在就诊时补充近期记录）'}\n` +
    `【记录完整性】最近一次记录：${history[history.length - 1].startDate} 起\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `⚠️ 本摘要由记录自动汇总，供就诊参考，不替代医生面诊。`;

  return { intent: 'visit_summary', text, data: { avg, std, dangerItems } };
}

// ─────────────────────────────────────────────
// 安全兜底：危险 / 诊断类问题，禁止 LLM 自由发挥
// ─────────────────────────────────────────────
const DANGEROUS_KEYWORDS = [
  '怀孕', '宫外孕', '流产', '癌症', '肿瘤', '恶性', '大出血', '出血不止',
  '是不是得了', '能治好吗', '会死', '绝症', '癌症吗',
];

export function safetyFallback() {
  return {
    intent: 'dangerous',
    text:
      `⚠️ 你提到的问题可能涉及需要专业医疗判断的情况。Luna 无法进行诊断，请务必：\n` +
      `1. 尽快咨询妇产科医生或前往正规医院就诊\n` +
      `2. 若出现剧烈腹痛、大量出血等紧急症状，请立即就医\n` +
      `3. 就诊时带上 Luna 里的周期记录与症状记录，可帮助医生更快了解情况\n\n` +
      `我是健康管理工具，不替代医生。希望你尽快得到专业帮助。`,
  };
}

// ─────────────────────────────────────────────
// 工具 5：本地知识库检索（可溯源 RAG 最小落地）
// ─────────────────────────────────────────────
export function retrieveKnowledge(input) {
  const hit = searchKB(input);
  if (!hit) return null;
  return {
    intent: 'knowledge',
    kbId: hit.id,
    text:
      `📚 ${hit.title}\n` +
      `${hit.content}\n\n` +
      `📎 依据来源：${hit.source}\n` +
      `⚠️ 以上为健康科普参考，不构成医疗诊断。`,
  };
}

// ─────────────────────────────────────────────
// 意图识别（规则引擎，先本地拦截）
// ─────────────────────────────────────────────
export function detectIntent(input) {
  const t = (input || '').toLowerCase();

  if (DANGEROUS_KEYWORDS.some(k => t.includes(k))) return 'dangerous';

  // 定义 / 求助类问题（什么是…、…怎么办、…怎么缓解等）：优先走知识库，避免被工具关键词误拦截
  if (/什么是|是什么|啥是|什么叫|怎么回事|怎么理解|是什么意思|怎么缓解|怎么办|有什么办法|怎么处理|怎么改善|怎么调理|能不能|该不该|要不要/.test(t)) {
    return 'knowledge';
  }

  if (/周期|规律|正常吗|异常|频发|稀发|预警|波动|准/.test(t)) return 'cycle_analysis';
  if (/阶段|排卵|黄体|卵泡|月经期|什么时候来|哪天/.test(t)) return 'phase';
  if (/指标|趋势|腹痛|血块|经间期出血|乳房|体温|情绪|痛经/.test(t)) return 'indicators';
  if (/就诊|医生|报告|摘要|看医生|问诊/.test(t)) return 'visit_summary';

  return 'general';
}

// ─────────────────────────────────────────────
// 主入口：本地能处理则返回结果，否则返回 null（交给云端 LLM）
// ─────────────────────────────────────────────
export function handle(input) {
  const intent = detectIntent(input);
  switch (intent) {
    case 'dangerous':      return safetyFallback();
    case 'cycle_analysis': return analyzeCycles();
    case 'phase':          return getPhaseSummary();
    case 'indicators':     return getIndicatorTrends();
    case 'visit_summary':  return generateVisitSummary();
    default: {
      // 通用问题：先查本地知识库（可溯源），未命中才交给云端 LLM
      const kb = retrieveKnowledge(input);
      return kb || null;
    }
  }
}
