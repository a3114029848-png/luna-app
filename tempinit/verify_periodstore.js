/**
 * 临时验证脚本：验证 periodStore 派生逻辑（数据持久化闭环核心）
 *   - getCycleHistory()：连续 period 天 → 经期段合并
 *   - getIndicatorTrendsData()：按经期段窗口聚合症状指标
 *   - getCycleSummaries()：周期长度/经期时长/流量汇总
 *
 * 做法：Babel 转译 periodStore（Node 自动降级 AsyncStorage 为 mock），
 *       __setRecordsForTest 注入 dayRecords 走真实派生逻辑。
 *
 * 用法：node tempinit/verify_periodstore.js
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const babel = require('@babel/core');

const ROOT = path.join(__dirname, '..');
const srcFile = path.join(ROOT, 'src/services/periodStore.js');

let passed = 0;
let failed = 0;
function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name} ${extra}`); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luna-store-'));
const outPath = path.join(tmpDir, 'periodStore.js');
const code = babel.transformFileSync(srcFile, { presets: ['@babel/preset-env'] }).code;
fs.writeFileSync(outPath, code);
const store = require(outPath);

// ── 测试数据：3 段经期（每段 3 天）+ 症状记录 ──
store.__setRecordsForTest({
  // 段1：2026-05-27 ~ 05-29
  '2026-5-27': { type: 'period', flow: 3, pain_level: 2, clot: '是', breast_pain: 1, mood: 2 },
  '2026-5-28': { type: 'period', pain_level: 1, mood: 3 },
  '2026-5-29': { type: 'period', flow: 3 },
  // 段2：2026-06-25 ~ 06-27
  '2026-6-25': { type: 'period', flow: 2, pain_level: 0, breast_pain: 2, mood: 1 },
  '2026-6-26': { type: 'period', pain_level: 2, clot: '无', mood: 4 },
  '2026-6-27': { type: 'period' },
  // 段3：2026-07-24 ~ 07-26
  '2026-7-24': { type: 'period', flow: 3, pain_level: 3, clot: '是', breast_pain: 1, mood: 0, bleed_type: '经间期出血' },
  '2026-7-25': { type: 'period', pain_level: 2, mood: 1 },
  '2026-7-26': { type: 'period' },
});

// ── 1. 经期段合并 ──
console.log('=== 1. getCycleHistory（经期段合并）===');
const history = store.getCycleHistory();
check('合并为 3 段', history.length === 3, JSON.stringify(history));
check('段1 起止正确', eq(history[0], { startDate: '2026-05-27', endDate: '2026-05-29' }), JSON.stringify(history[0]));
check('段2 起止正确', eq(history[1], { startDate: '2026-06-25', endDate: '2026-06-27' }), JSON.stringify(history[1]));
check('段3 起止正确', eq(history[2], { startDate: '2026-07-24', endDate: '2026-07-26' }), JSON.stringify(history[2]));

// ── 2. 指标趋势聚合 ──
console.log('\n=== 2. getIndicatorTrendsData（按段窗口聚合）===');
const trends = store.getIndicatorTrendsData();
console.log(`     pain=${JSON.stringify(trends.pain)} clot=${JSON.stringify(trends.clot)} imb=${JSON.stringify(trends.imb)}`);
console.log(`     breast=${JSON.stringify(trends.breast)} mood=${JSON.stringify(trends.mood)} temp=${JSON.stringify(trends.temp_biphasic)}`);
check('pain 每段均值', eq(trends.pain, [2, 1, 3]), JSON.stringify(trends.pain));
check('clot 有血块=1/无=0', eq(trends.clot, [1, 0, 1]), JSON.stringify(trends.clot));
check('imb 经间期出血=1（仅段3有记录）', eq(trends.imb, [1]), JSON.stringify(trends.imb));
check('breast 每段均值', eq(trends.breast, [1, 2, 1]), JSON.stringify(trends.breast));
check('mood 反向后均值', eq(trends.mood, [2, 2, 4]), JSON.stringify(trends.mood));
check('temp_biphasic 无数据源为空', eq(trends.temp_biphasic, []), JSON.stringify(trends.temp_biphasic));

// ── 3. 周期汇总 ──
console.log('\n=== 3. getCycleSummaries（周期长度/经期时长/流量）===');
const sums = store.getCycleSummaries(3);
console.log(`     ${JSON.stringify(sums)}`);
check('第1期 周期29天/经期3天/流量3', eq(sums[0], { label: '第1期', cycleDays: 29, periodDays: 3, flowLevel: 3 }), JSON.stringify(sums[0]));
check('第2期 周期29天/经期3天/流量2', eq(sums[1], { label: '第2期', cycleDays: 29, periodDays: 3, flowLevel: 2 }), JSON.stringify(sums[1]));
check('最后一段周期长度未知(null)', sums[2].cycleDays === null, JSON.stringify(sums[2]));
check('第3期 经期3天/流量3', sums[2].periodDays === 3 && sums[2].flowLevel === 3, JSON.stringify(sums[2]));

// ── 4. 空数据 → 追问语义 ──
console.log('\n=== 4. 空数据边界 ===');
store.__setRecordsForTest({});
check('无记录时 getCycleHistory 为空', eq(store.getCycleHistory(), []));
check('无记录时 getIndicatorTrendsData 为空对象', eq(store.getIndicatorTrendsData(), {}));
check('无记录时 getCycleSummaries 为空', eq(store.getCycleSummaries(), []));

console.log(`\n结果：${passed} 通过 / ${failed} 失败`);
process.exit(failed ? 1 : 0);
