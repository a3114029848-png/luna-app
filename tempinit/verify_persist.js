/**
 * 临时验证：periodStore「保存 → loadAll 不丢数据」闭环（对应真机数据联动丢失 bug）
 * 用法：node tempinit/verify_persist.js
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const babel = require('@babel/core');

const ROOT = path.join(__dirname, '..');
let passed = 0, failed = 0;
const check = (n, c, e = '') => { if (c) { passed++; console.log(`  ✅ ${n}`); } else { failed++; console.log(`  ❌ ${n} ${e}`); } };

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luna-persist-'));
const outPath = path.join(tmpDir, 'periodStore.js');
fs.writeFileSync(outPath, babel.transformFileSync(path.join(ROOT, 'src/services/periodStore.js'), { presets: ['@babel/preset-env'] }).code);
const store = require(outPath);

(async () => {
  // 1. 保存今天记录（经期）
  await store.saveDayRecord({ date: '2026-8-30', type: 'period', flow: 3, pain_level: 1 });
  check('保存后内存有记录', !!store.getDayRecord('2026-8-30'));

  // 2. 模拟「切页 loadAll」：从 AsyncStorage 重新加载
  await store.loadAll();
  check('loadAll 后数据保留（不丢失）', !!store.getDayRecord('2026-8-30'));
  check('loadAll 后 getCycleHistory 有经期段', store.getCycleHistory().length === 1, JSON.stringify(store.getCycleHistory()));

  // 3. 再保存第二段经期，再 loadAll，应两段
  await store.saveDayRecord({ date: '2026-7-24', type: 'period', flow: 2 });
  await store.loadAll();
  check('两段经期都保留', store.getCycleHistory().length === 2, JSON.stringify(store.getCycleHistory()));

  // 4. 今日「当前阶段」应可推算（最后一段 2026-8-30 → 月经期）
  const history = store.getCycleHistory();
  const last = history[history.length - 1];
  check('最后一段是今天（月经期）', last && last.startDate === '2026-08-30', JSON.stringify(last));

  // 5. 云同步钩子：onLoad 返回远端也不丢本地
  store.setCloudSyncHooks({
    onLoad: async () => ({ '2026-8-1': { type: 'period' } }), // 远端只有旧数据
  });
  await store.loadAll();
  check('远端合并后本地今天记录仍在（本地优先）', !!store.getDayRecord('2026-8-30'));
  check('远端补缺（8-1 被补入）', !!store.getDayRecord('2026-8-1'));

  console.log(`\n结果：${passed} 通过 / ${failed} 失败`);
  process.exit(failed ? 1 : 0);
})();
