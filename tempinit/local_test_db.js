/** 临时：本地测 db.js(sql.js) init/读写/迁移 */
const db = require('d:\\Luna\\server\\db.js');
(async () => {
  console.log('starting init...');
  await db.init();
  console.log('INIT_OK, count=' + (await db.countRows()));
  await db.saveRecord('local-test', '2026-8-31', { type: 'period', flow: 3 });
  const r = await db.getRecords('local-test');
  console.log('READ_OK ' + JSON.stringify(r));
  console.log('ALL_DONE');
})().catch(e => { console.error('TEST_ERR', e.stack); process.exit(1); });
