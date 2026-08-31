/**
 * 临时验证：wearableStore（模拟穿戴设备 + 体温双相）
 *   - 未连接 getLiveData 返回 null
 *   - 连接后 getLiveData 有数据
 *   - getTempBiphasicTrends：黄体期均温 - 卵泡期均温 ≥0.3 → true
 * 用法：node tempinit/verify_wearable.js
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const babel = require('@babel/core');

const ROOT = path.join(__dirname, '..');
let passed = 0, failed = 0;
const check = (n, c, e = '') => { if (c) { passed++; console.log(`  ✅ ${n}`); } else { failed++; console.log(`  ❌ ${n} ${e}`); } };

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luna-wear-'));
for (const rel of [
  'src/services/wearableStore.js',
  'src/services/periodStore.js',
  'src/utils/cycleCalculator.js',
  'src/constants/medicalThresholds.js',
]) {
  const outPath = path.join(tmpDir, rel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, babel.transformFileSync(path.join(ROOT, rel), { presets: ['@babel/preset-env'] }).code);
}
const store = require(path.join(tmpDir, 'src/services/wearableStore.js'));
const period = require(path.join(tmpDir, 'src/services/periodStore.js'));

// ── 1. 连接状态 ──
console.log('=== 1. 连接状态 ===');
store.__setForTest({ connected: false });
check('未连接 getLiveData → null', store.getLiveData() === null);
store.__setForTest({ connected: true });
const live = store.getLiveData();
check('连接后 getLiveData 有温度/心率', !!live && !!live.temperature && !!live.heartRate);
check('温度格式 xx.x°', /^\d+\.\d°$/.test(live.temperature));

// ── 2. 体温双相判定 ──
console.log('\n=== 2. getTempBiphasicTrends ===');
period.__setRecordsForTest({
  '2026-6-1': { type: 'period' }, '2026-6-2': { type: 'period' }, '2026-6-3': { type: 'period' },
});
// 窗口 = 5-22 ~ 无限；前 3 条卵泡相 ~36.4，后 3 条黄体相 ~36.8 → 有双相
store.__setForTest({ connected: true, temperatures: {
  '2026-5-24': 36.4, '2026-5-26': 36.3, '2026-5-28': 36.5,
  '2026-6-5': 36.8, '2026-6-7': 36.9, '2026-6-9': 36.8,
} });
const t = store.getTempBiphasicTrends();
check('有双相 → [true]', Array.isArray(t) && t.length === 1 && t[0] === true, JSON.stringify(t));

// 无双相：前后温差 ~0.07 <0.3
store.__setForTest({ temperatures: {
  '2026-5-24': 36.5, '2026-5-26': 36.4, '2026-5-28': 36.5,
  '2026-6-5': 36.5, '2026-6-7': 36.6, '2026-6-9': 36.5,
} });
const t2 = store.getTempBiphasicTrends();
check('无双相 → [false]', Array.isArray(t2) && t2[0] === false, JSON.stringify(t2));

// 样本不足（<4）→ 不判定（空数组）
store.__setForTest({ temperatures: { '2026-5-24': 36.4, '2026-5-26': 36.3 } });
check('样本不足 → 空数组', store.getTempBiphasicTrends().length === 0);

console.log(`\n结果：${passed} 通过 / ${failed} 失败`);
process.exit(failed ? 1 : 0);
