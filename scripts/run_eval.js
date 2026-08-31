/**
 * Luna 评测集可重放执行器（方案 B 核心）
 *
 * 用法：
 *   node scripts/run_eval.js                                          # 全量跑评测，输出报告到 eval/reports/
 *   node scripts/run_eval.js --cases eval/eval_cases.json --out eval/reports/mine
 *   node scripts/run_eval.js --diff eval/reports/run_A.json eval/reports/run_B.json
 *
 * 流程（对齐方法论）：
 *   转译 ESM → 按 environment 注入数据（输入与环境）→ 逐条 handle()（执行）→
 *   Rubric 评分（标准层）→ 报告（日常 / 高风险分开，红线单列）
 *
 * 被测系统版本：读取 src/services/agentTools.js 的转译结果（公平复现基线见 AI评测集.md）
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const babel = require('@babel/core');
const { evaluateCase } = require('../eval/rubric.js');

const ROOT = path.join(__dirname, '..');

// 需转译的 ESM 源文件（相对项目根）
const SRC_FILES = [
  'src/services/agentTools.js',
  'src/services/medicalKB.js',
  'src/services/periodStore.js',
  'src/constants/medicalThresholds.js',
  'src/utils/cycleCalculator.js',
];

// 演示数据（full 模式注入，对应原 MOCK 基线）
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

// 快捷环境预设：full=默认 MOCK 数据；none=0 条记录；one=仅 1 条经期记录
const MODE_PRESETS = {
  full: {},
  none: { cycleHistory: null, indicatorTrends: null },
  one: {
    cycleHistory: [{ startDate: '2026-07-24', endDate: '2026-07-28' }],
    indicatorTrends: null,
  },
};

/** 展开用例 environment：返回 { cycleHistory?, indicatorTrends? }，undefined = 保持 MOCK，null = 空 */
function resolveEnv(env) {
  if (!env) return {};
  const preset = env.mode ? MODE_PRESETS[env.mode] : undefined;
  const out = {};
  if (env.cycleHistory !== undefined) out.cycleHistory = env.cycleHistory;
  else if (preset && preset.cycleHistory !== undefined) out.cycleHistory = preset.cycleHistory;
  if (env.indicatorTrends !== undefined) out.indicatorTrends = env.indicatorTrends;
  else if (preset && preset.indicatorTrends !== undefined) out.indicatorTrends = preset.indicatorTrends;
  return out;
}

// 实例缓存：同一环境只转译一次；数据通过统一存储层（periodStore）注入
const instanceCache = new Map();
function buildInstance(envSpec) {
  const key = JSON.stringify(envSpec || {});
  if (instanceCache.has(key)) return instanceCache.get(key);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luna-eval-'));
  for (const rel of SRC_FILES) {
    const outPath = path.join(tmpDir, rel);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const code = babel.transformFileSync(path.join(ROOT, rel), { presets: ['@babel/preset-env'] }).code;
    fs.writeFileSync(outPath, code);
  }

  // agentTools 现在从 periodStore 读数据 → 通过 seedForTest 注入环境（full=演示数据）
  const store = require(path.join(tmpDir, 'src/services/periodStore.js'));
  store.seedForTest(
    envSpec && envSpec.cycleHistory !== undefined ? (envSpec.cycleHistory || []) : DEMO_CYCLE_HISTORY,
    envSpec && envSpec.indicatorTrends !== undefined ? (envSpec.indicatorTrends || {}) : DEMO_INDICATOR_TRENDS
  );

  const tools = require(path.join(tmpDir, 'src/services/agentTools.js'));
  instanceCache.set(key, tools);
  return tools;
}

/** 执行单条用例并评分 */
function runCase(c, tools) {
  try {
    const result = tools.handle(c.input);
    return {
      eval: evaluateCase(c, result),
      output: result && result.text ? result.text : '(null：本地不回复/转云端)',
    };
  } catch (err) {
    return { eval: evaluateCase(c, new Error(err.message)), output: `[崩溃] ${err.message}` };
  }
}

function stamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function runAll(args) {
  const cases = JSON.parse(fs.readFileSync(args.cases, 'utf8'));
  const list = cases.cases || [];

  const results = list.map(c => {
    const tools = buildInstance(resolveEnv(c.environment));
    const { eval: ev, output } = runCase(c, tools);
    return {
      id: c.id, group: c.group, risk: c.risk, title: c.title,
      verdict: ev.verdict, totalScore: ev.totalScore, dims: ev.dims,
      redlines: ev.redlines, needHuman: ev.needHuman, skipReason: ev.skipReason,
      failChecks: ev.checks.filter(x => !x.ok).map(x => x.name + (x.detail ? `（${x.detail}）` : '')),
      output: output.slice(0, 220),
    };
  });

  // ── 汇总（日常与高风险分开）──
  const daily = { pass: 0, fail: 0, redline: 0, unknown: 0, total: 0 };
  const high = { pass: 0, fail: 0, redline: 0, unknown: 0, total: 0 };
  const redlines = [];
  for (const r of results) {
    const bucket = r.risk === 'high' ? high : daily;
    bucket.total++;
    if (r.verdict === 'PASS') bucket.pass++;
    else if (r.verdict === 'REDLINE') { bucket.redline++; redlines.push(r); }
    else if (r.verdict === 'UNKNOWN') bucket.unknown++;
    else bucket.fail++;
  }
  const rate = (p, f) => (p + f ? ((p / (p + f)) * 100).toFixed(1) : '—');
  const highRiskGuardRate = rate(high.pass, high.fail);

  // ── 控制台摘要 ──
  console.log('╔════════════════════════════════════════╗');
  console.log('║          Luna Eval 报告                 ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`时间     : ${new Date().toISOString()}`);
  console.log(`用例文件 : ${path.relative(ROOT, args.cases)}`);
  console.log(`被测版本 : src/services/agentTools.js（转译于 ${SRC_FILES[0]}）`);
  console.log('');
  console.log(`[日常集] ${daily.total} 条 | PASS ${daily.pass} · FAIL ${daily.fail} · REDLINE ${daily.redline} · UNKNOWN ${daily.unknown} | 通过率 ${rate(daily.pass, daily.fail)}%`);
  console.log(`[高风险] ${high.total} 条 | PASS ${high.pass} · REDLINE ${high.redline} · UNKNOWN ${high.unknown} | 危险兜底触发率 ${highRiskGuardRate}%`);
  console.log(`[红线  ] ${redlines.length} 条（一票否决，不进入平均分）`);
  console.log('');

  const problems = results.filter(r => r.verdict === 'FAIL' || r.verdict === 'REDLINE');
  if (problems.length) {
    console.log('—— FAIL / REDLINE 明细 ——');
    for (const r of problems) {
      console.log(`[${r.verdict}] ${r.id} ${r.title}`);
      if (r.redlines.length) console.log(`    🔴 ${r.redlines.join('；')}`);
      console.log(`    ${r.failChecks.join('；') || '(维度/红线问题)'}`);
      console.log(`    实际输出: ${r.output.split('\n')[0] || ''}`);
    }
    console.log('');
  }
  console.log('⚠️ 需要人工复核：同理心维度全部为默认 2 级；另有未声明 must_contain 的用例（accuracy 待人工）。');

  // ── 报告 JSON ──
  const report = {
    meta: {
      runner: 'scripts/run_eval.js',
      date: new Date().toISOString(),
      caseFile: path.relative(ROOT, args.cases),
      envNote: 'environment 已注入；被测版本见 AI评测集.md「一、被测系统版本」',
    },
    summary: {
      total: list.length,
      daily: { ...daily, passRate: rate(daily.pass, daily.fail) },
      highRisk: { ...high, guardRate: highRiskGuardRate },
      redlineCount: redlines.length,
    },
    results,
  };
  fs.mkdirSync(args.out, { recursive: true });
  const outFile = path.join(args.out, `run_${stamp()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n📄 报告已写入: ${path.relative(ROOT, outFile)}`);
  return problems.length ? 1 : 0;
}

/** --diff：对比两份报告的逐条判定变化 */
function diffReports([aPath, bPath]) {
  const a = JSON.parse(fs.readFileSync(aPath, 'utf8'));
  const b = JSON.parse(fs.readFileSync(bPath, 'utf8'));
  const mapA = new Map(a.results.map(r => [r.id, r]));
  console.log(`=== 版本对比 ${path.basename(aPath)} → ${path.basename(bPath)} ===`);
  let changed = 0;
  for (const rb of b.results) {
    const ra = mapA.get(rb.id);
    if (!ra) { console.log(`  [新增] ${rb.id} ${rb.verdict}`); changed++; continue; }
    if (ra.verdict !== rb.verdict || ra.totalScore !== rb.totalScore) {
      console.log(`  [变化] ${rb.id} ${ra.verdict}(${ra.totalScore}) → ${rb.verdict}(${rb.totalScore})`);
      changed++;
    }
  }
  console.log(changed ? `共 ${changed} 条判定变化。` : '无判定变化（回归通过 ✅）。');
  return changed ? 1 : 0;
}

function parseArgs(argv) {
  const args = {
    cases: path.join(ROOT, 'eval/eval_cases.json'),
    out: path.join(ROOT, 'eval/reports'),
    diff: null,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--cases') args.cases = path.resolve(argv[++i]);
    else if (argv[i] === '--out') args.out = path.resolve(argv[++i]);
    else if (argv[i] === '--diff') args.diff = [path.resolve(argv[++i]), path.resolve(argv[++i])];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
process.exit(args.diff ? diffReports(args.diff) : runAll(args));
