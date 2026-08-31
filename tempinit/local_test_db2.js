/** 临时：细粒度测 db.js saveRecord/getRecord/getRecords/countRows */
const db = require('d:\\Luna\\server\\db.js');
(async () => {
  await db.init();
  const before = await db.countRows();
  console.log('BEFORE_COUNT=' + before);
  const saved = await db.saveRecord('local-test', { date: '2026-8-31', type: 'period', flow: 3 });
  console.log('SAVED=' + JSON.stringify(saved));
  const after = await db.countRows();
  console.log('AFTER_COUNT=' + after);
  const one = await db.getRecord('local-test', '2026-8-31');
  console.log('GETONE=' + JSON.stringify(one));
  const all = await db.getRecords('local-test');
  console.log('GETALL=' + JSON.stringify(all));
})().catch(e => { console.error('ERR', e.stack); process.exit(1); });
