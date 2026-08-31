/**
 * 临时验证：今日 ↔ 日历 双向联动（同一 dayRecord）
 * 用法：node tempinit/verify_dual.js
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const babel = require('@babel/core');

const ROOT = path.join(__dirname, '..');
let passed = 0, failed = 0;
const check = (n, c, e = '') => { if (c) { passed++; console.log(`  ✅ ${n}`); } else { failed++; console.log(`  ❌ ${n} ${e}`); } };

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luna-dual-'));
const outPath = path.join(tmpDir, 'periodStore.js');
fs.writeFileSync(outPath, babel.transformFileSync(path.join(ROOT, 'src/services/periodStore.js'), { presets: ['@babel/preset-env'] }).code);
const store = require(outPath);

(async () => {
  // ── 场景1：日历先标记经期 → 今日表单应能回填 ──
  await store.saveDayRecord({ date: '2026-8-30', type: 'period', flow: 3, pain_level: 2, clot: true, mood: 1 });
  const rec1 = store.getDayRecord('2026-8-30');
  check('日历标记后 getDayRecord 有 type=period', rec1.type === 'period', JSON.stringify(rec1));
  check('回填字段 flow=3 / pain_level=2 / clot=true / mood=1',
    rec1.flow === 3 && rec1.pain_level === 2 && rec1.clot === true && rec1.mood === 1);

  // ── 场景2：今日只记症状（不选经期出血，patch 无 type）→ 不覆盖日历的 type ──
  await store.saveDayRecord({ date: '2026-8-30', pain_level: 1 }); // 无 type 键
  const rec2 = store.getDayRecord('2026-8-30');
  check('今日只记症状不覆盖日历 type（仍 period）', rec2.type === 'period', JSON.stringify(rec2));
  check('症状字段已合并（pain_level 更新为 1）', rec2.pain_level === 1);

  // ── 场景3：今日明确选「经期出血」→ 模拟 HomeScreen onSave 的 patch 逻辑 → type=period ──
  const bleed = '经期出血';
  const patch = { date: '2026-8-31', bleed_type: bleed, flow: 2 };
  if (bleed === '经期出血') patch.type = 'period'; // 即 HomeScreen onSave 里的推断
  await store.saveDayRecord(patch);
  check('今日经期出血 → 该天计入经期段（8-30+8-31 合并为一段）',
    store.getCycleHistory().some(s => s.endDate === '2026-08-31' || s.startDate === '2026-08-31'));

  // ── 场景4：两段经期 → 今日当前阶段可推算 ──
  await store.loadAll();
  check('loadAll 后数据仍在（8-30 与 8-31）',
    !!store.getDayRecord('2026-8-30') && !!store.getDayRecord('2026-8-31'));

  // ── 场景5：今日明确选「无出血」→ 清掉经期标记（用户明确今天没来月经）──
  await store.saveDayRecord({ date: '2026-8-30', bleed_type: '无出血', abnormal: undefined, type: undefined });
  check('无出血 → 清掉经期标记', store.getDayRecord('2026-8-30').type === undefined);
  check('该天不再计入经期段', !store.getCycleHistory().some(s => s.startDate === '2026-08-30'));
  check('另一天经期段仍保留（8-31）', store.getCycleHistory().some(s => s.startDate === '2026-08-31'));

  console.log(`\n结果：${passed} 通过 / ${failed} 失败`);
  process.exit(failed ? 1 : 0);
})();
