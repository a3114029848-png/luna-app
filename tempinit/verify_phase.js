/**
 * 临时验证：getPhaseForDate 日期规范化后，当天记录应判定为「月经期」
 * 用法：node tempinit/verify_phase.js
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const babel = require('@babel/core');

const ROOT = path.join(__dirname, '..');
let passed = 0, failed = 0;
const check = (n, c, e = '') => { if (c) { passed++; console.log(`  ✅ ${n}`); } else { failed++; console.log(`  ❌ ${n} ${e}`); } };

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luna-phase-'));
for (const rel of [
  'src/utils/cycleCalculator.js',
  'src/constants/medicalThresholds.js',
]) {
  const outPath = path.join(tmpDir, rel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, babel.transformFileSync(path.join(ROOT, rel), { presets: ['@babel/preset-env'] }).code);
}
const { getPhaseForDate } = require(path.join(tmpDir, 'src/utils/cycleCalculator.js'));

const DAY = 86400000;
const today0 = new Date(); today0.setHours(0, 0, 0, 0);

// 场景1：今天开始经期（periodDuration=1）→ 月经期
check('今天记录第1天 → 月经期', getPhaseForDate(today0, today0, 1, 28) === 'period');

// 场景2：昨天开始经期（periodDuration=2），今天第2天 → 月经期
const yesterday = new Date(today0.getTime() - DAY);
check('经期第2天 → 月经期', getPhaseForDate(today0, yesterday, 2, 28) === 'period');

// 场景3：经期结束（第3天，periodDuration=2）→ 非月经期（卵泡期）
check('经期结束后 → 非月经期', getPhaseForDate(today0, new Date(today0.getTime() - 2 * DAY), 2, 28) !== 'period');

// 场景4：带时刻的 Date 也不影响（当天 14:00 记录 → 仍月经期）
const today14 = new Date(today0.getTime() + 14 * 3600000);
check('当天下午记录（带时刻）→ 仍月经期', getPhaseForDate(today14, today0, 1, 28) === 'period');

console.log(`\n结果：${passed} 通过 / ${failed} 失败`);
process.exit(failed ? 1 : 0);
