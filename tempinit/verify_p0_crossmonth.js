/**
 * 临时验证脚本：getCycleSummaries 跨月经期段的日期比较（P0-3 修复验证）
 *
 * 旧实现用无前导零日期键字符串比较（d >= '2026-9-29' && d <= '2026-10-2'），
 * 字典序下 '2026-10-x' 全部 < '2026-9-29' → 跨月经期段的流量统计会漏掉整个 10 月。
 * 修复后改用时间戳比较，应正确聚合 4 天流量。
 *
 * 用法：node tempinit/verify_p0_crossmonth.js
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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luna-p0-'));
const outPath = path.join(tmpDir, 'periodStore.js');
const code = babel.transformFileSync(srcFile, { presets: ['@babel/preset-env'] }).code;
fs.writeFileSync(outPath, code);
const store = require(outPath);

// ── 跨月经期段：2026-09-29 ~ 2026-10-02（4 天）──
store.__setRecordsForTest({
  '2026-9-29': { type: 'period', flow: 3 },
  '2026-9-30': { type: 'period', flow: 4 },
  '2026-10-1': { type: 'period', flow: 2 },
  '2026-10-2': { type: 'period', flow: 1 },
  // 段外干扰：9 月初的普通症状记录（不应计入该段流量）
  '2026-9-5':  { type: 'normal', flow: 4 },
  '2026-10-20':{ type: 'normal', flow: 4 },
});

console.log('=== getCycleSummaries（跨月经期段流量聚合）===');
const summaries = store.getCycleSummaries(6);
check('识别为 1 段（4 天）', summaries.length === 1, JSON.stringify(summaries));
check('periodDays = 4', summaries[0].periodDays === 4, JSON.stringify(summaries[0]));
// 段内 flow = [3,4,2,1] 均值 2.5 → round = 3
check('flowLevel = 3（含 10 月两天）', summaries[0].flowLevel === 3, JSON.stringify(summaries[0]));
check('cycleDays = null（仅一段，无下段）', summaries[0].cycleDays === null, JSON.stringify(summaries[0]));

console.log(`\n结果：${passed} 通过 / ${failed} 失败`);
process.exit(failed ? 1 : 0);
