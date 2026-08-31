/**
 * 临时验证脚本：B 阶段——异常出血标记 + 事实/阶段分层（数据层）
 *   - getMonthPhaseMap：按经期段推算整月阶段（排卵/黄体/预测经期）
 *   - saveDayRecord undefined 删除语义
 *   - 异常出血（经间期/性交后）→ abnormal 标记 + 清 period，不参与周期推算
 *   - imb 指标识别 abnormal
 *
 * 用法：node tempinit/verify_p0_abnormal.js
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const babel = require('@babel/core');

const ROOT = path.join(__dirname, '..');
let passed = 0, failed = 0;
const check = (n, c, e = '') => { if (c) { passed++; console.log(`  ✅ ${n}`); } else { failed++; console.log(`  ❌ ${n} ${e}`); } };

// 转译 periodStore + cycleCalculator + medicalThresholds 到同一临时目录（保持相对路径）
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luna-abn-'));
for (const rel of [
  'src/services/periodStore.js',
  'src/utils/cycleCalculator.js',
  'src/constants/medicalThresholds.js',
]) {
  const outPath = path.join(tmpDir, rel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, babel.transformFileSync(path.join(ROOT, rel), { presets: ['@babel/preset-env'] }).code);
}
const store = require(path.join(tmpDir, 'src/services/periodStore.js'));
const { getMonthPhaseMap } = require(path.join(tmpDir, 'src/utils/cycleCalculator.js'));

(async () => {
  // ── 1. getMonthPhaseMap：3 段经期（每段 3 天）→ 推算 6 月每日阶段 ──
  console.log('=== 1. getMonthPhaseMap（算法阶段推算）===');
  store.__setRecordsForTest({
    '2026-5-27': { type: 'period' }, '2026-5-28': { type: 'period' }, '2026-5-29': { type: 'period' },
    '2026-6-25': { type: 'period' }, '2026-6-26': { type: 'period' }, '2026-6-27': { type: 'period' },
    '2026-7-24': { type: 'period' }, '2026-7-25': { type: 'period' }, '2026-7-26': { type: 'period' },
  });
  const history = store.getCycleHistory(); // 3 段
  const avg = 29; // (29+29)/2
  const map = getMonthPhaseMap(2026, 6, history, avg);
  check('6-9 排卵期（day14）', map['2026-6-9'] === 'ovulation', map['2026-6-9']);
  check('6-12 黄体期', map['2026-6-12'] === 'luteal', map['2026-6-12']);
  check('6-24 预测经期', map['2026-6-24'] === 'predicted', map['2026-6-24']);
  check('6-25 月经期（手动段重叠）', map['2026-6-25'] === 'period', map['2026-6-25']);
  check('6-28 卵泡期', map['2026-6-28'] === 'follicular', map['2026-6-28']);

  // ── 2. saveDayRecord undefined 删除语义 ──
  console.log('\n=== 2. saveDayRecord undefined 删除语义 ===');
  store.__setRecordsForTest({ '2026-8-1': { type: 'period', flow: 3 } });
  await store.saveDayRecord({ date: '2026-8-1', type: undefined });
  check('type: undefined 删除已有 type', store.getDayRecord('2026-8-1').type === undefined);
  check('其他字段保留（flow=3）', store.getDayRecord('2026-8-1').flow === 3);

  // ── 3. 异常出血 → abnormal 标记 + 不参与经期段 ──
  console.log('\n=== 3. 异常出血（经间期/性交后）===');
  store.__setRecordsForTest({});
  const p1 = { date: '2026-8-10', bleed_type: '经间期出血', abnormal: 'imb', type: undefined };
  await store.saveDayRecord(p1);
  check('abnormal=imb 已保存', store.getDayRecord('2026-8-10').abnormal === 'imb');
  check('异常出血天不计入经期段', !store.getCycleHistory().some(s => s.startDate === '2026-08-10'));

  // 先有日历 period，再记录异常出血 → period 被清
  store.__setRecordsForTest({ '2026-8-10': { type: 'period' } });
  await store.saveDayRecord({ date: '2026-8-10', bleed_type: '经间期出血', abnormal: 'imb', type: undefined });
  check('异常出血清掉日历 period', store.getDayRecord('2026-8-10').type === undefined);
  check('该天不再构成经期段', store.getCycleHistory().length === 0);

  // 性交后出血同样处理
  store.__setRecordsForTest({});
  await store.saveDayRecord({ date: '2026-8-15', bleed_type: '性交后出血', abnormal: 'postcoital', type: undefined });
  check('性交后出血 → abnormal=postcoital', store.getDayRecord('2026-8-15').abnormal === 'postcoital');

  // ── 4. imb 指标识别 abnormal ──
  console.log('\n=== 4. imb 指标识别 abnormal ===');
  store.__setRecordsForTest({
    '2026-8-1':  { type: 'period' },
    '2026-8-5':  { type: 'normal', abnormal: 'imb' },
  });
  const t = store.getIndicatorTrendsData();
  check('imb 趋势识别 abnormal=imb', Array.isArray(t.imb) && t.imb.length === 1 && t.imb[0] === 1, JSON.stringify(t.imb));

  console.log(`\n结果：${passed} 通过 / ${failed} 失败`);
  process.exit(failed ? 1 : 0);
})();
