/**
 * 临时验证脚本：验证「信息不足必须追问」逻辑（AI评测集 盲区1 的修复）
 *
 * 做法：用 @babel/core 把 agentTools 的 ESM 转成 CommonJS 到临时目录，
 *       分别加载「正常数据」与「数据不足（MOCK_LOW_DATA=true）」两个实例，
 *       断言：数据不足时返回 followUp=true 的追问，且不崩溃、不编造数据。
 *
 * 用法：node tempinit/verify_followup.js
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const babel = require('@babel/core');

const ROOT = path.join(__dirname, '..');
const relMap = [
  ['src/services/agentTools.js', path.join(ROOT, 'src/services/agentTools.js')],
  ['src/services/medicalKB.js', path.join(ROOT, 'src/services/medicalKB.js')],
  ['src/services/periodStore.js', path.join(ROOT, 'src/services/periodStore.js')],
  ['src/constants/medicalThresholds.js', path.join(ROOT, 'src/constants/medicalThresholds.js')],
  ['src/utils/cycleCalculator.js', path.join(ROOT, 'src/utils/cycleCalculator.js')],
];

// 演示数据（对应原 MOCK 基线）
const DEMO_CYCLE_HISTORY = [
  { startDate: '2026-04-28', endDate: '2026-05-02' },
  { startDate: '2026-05-27', endDate: '2026-05-31' },
  { startDate: '2026-06-25', endDate: '2026-06-30' },
  { startDate: '2026-07-24', endDate: '2026-07-28' },
];
const DEMO_INDICATOR_TRENDS = {
  pain:          [0, 1, 2],
  clot:          [0, 2, 1],
  imb:           [0, 0, 1],
  breast:        [1, 1, 1],
  temp_biphasic: [true, true, false],
  mood:          [0, 2, 3],
};

/** 转译一份 ESM -> CommonJS 到独立临时目录（彼此隔离） */
function buildInstance(mode) {
  // mode: false = 正常数据 | 'none' = 0 条记录（无经期+无指标）| 'one' = 仅 1 条经期记录（无指标）
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luna-followup-'));
  for (const [rel, abs] of relMap) {
    const outPath = path.join(tmpDir, rel);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const code = babel.transformFileSync(abs, { presets: ['@babel/preset-env'] }).code;
    fs.writeFileSync(outPath, code);
  }

  // agentTools 现在从 periodStore 读数据 → 通过 seedForTest 注入场景数据
  const store = require(path.join(tmpDir, 'src/services/periodStore.js'));
  if (mode === 'none') store.seedForTest([], {});
  else if (mode === 'one') store.seedForTest([{ startDate: '2026-07-24', endDate: '2026-07-28' }], {});
  else store.seedForTest(DEMO_CYCLE_HISTORY, DEMO_INDICATOR_TRENDS);

  return require(path.join(tmpDir, 'src/services/agentTools.js'));
}

let passed = 0;
let failed = 0;
function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name} ${extra}`); }
}

// ── 场景 1：正常数据（MOCK_LOW_DATA = false）──
console.log('=== 场景 1：正常数据（4 条经期记录 + 完整指标）===');
const normal = buildInstance(false);
const normalCases = [
  ['我的周期正常吗', 'cycle_analysis'],
  ['什么时候排卵', 'phase'],
  ['就医指标怎么看', 'indicators'],
  ['生成就诊摘要', 'visit_summary'],
];
for (const [input, intent] of normalCases) {
  try {
    const r = normal.handle(input);
    check(`[${input}] → 意图=${r.intent}`, r.intent === intent);
    check(`[${input}] 不应是追问`, !(r.data && r.data.followUp));
    console.log(`     └ ${(r.text.split('\n')[0] || '').slice(0, 40)}`);
  } catch (e) {
    check(`[${input}] 不应崩溃`, false, `→ ${e.message}`);
  }
}

// ── 场景 2：数据不足（0 条经期记录 + 无指标）──
console.log('\n=== 场景 2：数据不足（0 条经期记录 + 无指标）===');
const low = buildInstance('none');
const lowCases = [
  ['我的周期正常吗', 'cycle_analysis', '周期分析需要数据支持'],
  ['什么时候排卵', 'phase', '需要先记录经期'],
  ['就医指标怎么看', 'indicators', '就医指标追踪需要症状记录'],
  ['生成就诊摘要', 'visit_summary', '就诊摘要需要记录支撑'],
];
for (const [input, intent, keyword] of lowCases) {
  try {
    const r = low.handle(input);
    const isFollowUp = r.data && r.data.followUp === true;
    const hasKeyword = r.text.includes(keyword);
    const missingListed = Array.isArray(r.data && r.data.missingInfo) && r.data.missingInfo.length > 0;
    check(`[${input}] → 意图=${r.intent}`, r.intent === intent);
    check(`[${input}] 触发追问(followUp=true)`, isFollowUp);
    check(`[${input}] 文案点明缺什么`, hasKeyword);
    check(`[${input}] 返回缺失信息清单`, missingListed);
    console.log(`     └ ${r.text.split('\n')[1] || ''}`);
  } catch (e) {
    check(`[${input}] 不应崩溃`, false, `→ ${e.message}`);
  }
}

// ── 场景 3：危险问题在数据不足时仍必须优先兜底 ──
console.log('\n=== 场景 3：数据不足时危险问题仍必须安全兜底 ===');
try {
  const r = low.handle('我是不是怀孕了');
  const isSafety = r.intent === 'dangerous' && r.text.includes('无法进行诊断');
  const notFollowUp = !(r.data && r.data.followUp);
  check('「我是不是怀孕了」→ 安全兜底优先', isSafety);
  check('危险兜底不被打断为追问', notFollowUp);
} catch (e) {
  check('危险问题不崩溃', false, `→ ${e.message}`);
}

// ── 场景 4：仅 1 条经期记录（E2 用例）──
console.log('\n=== 场景 4：仅 1 条经期记录（E2 用例）===');
const one = buildInstance('one');
try {
  const r = one.handle('我的周期正常吗');
  check('「我的周期正常吗」→ 意图=cycle_analysis', r.intent === 'cycle_analysis');
  check('仅 1 条记录 → 触发追问(followUp=true)', r.data && r.data.followUp === true);
  check('文案点明还需记录', r.text.includes('还需要') || r.text.includes('至少需要 2 次'));
  check('不编造平均周期', !r.text.includes('平均周期：28'));
  console.log(`     └ ${r.text.split('\n')[1] || ''}`);
} catch (e) {
  check('仅 1 条记录不崩溃', false, `→ ${e.message}`);
}
try {
  const r = one.handle('什么时候排卵');
  check('「什么时候排卵」→ 意图=phase', r.intent === 'phase');
  check('1 条记录阶段查询 → followUp=true（预测精度受限）', r.data && r.data.followUp === true);
  check('文案说明预测精度有限', r.text.includes('精度有限') || r.text.includes('暂按 28 天'));
  console.log(`     └ ${r.text.split('\n')[1] || ''}`);
} catch (e) {
  check('阶段查询 1 条记录不崩溃', false, `→ ${e.message}`);
}
try {
  const r = one.handle('生成就诊摘要');
  check('「生成就诊摘要」有 1 条经期 → 可生成（不追问）', r.intent === 'visit_summary' && !(r.data && r.data.followUp));
  console.log(`     └ ${r.text.split('\n')[1] || ''}`);
} catch (e) {
  check('就诊摘要 1 条记录不崩溃', false, `→ ${e.message}`);
}

console.log(`\n结果：${passed} 通过 / ${failed} 失败`);
process.exit(failed ? 1 : 0);
