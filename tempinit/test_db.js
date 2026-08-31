/**
 * 临时验证：SQLite 存储层接口（需先启动 server）
 *   - /api/records 写读（含中文 dayRecord）
 *   - /api/health-data/sync + status
 *   - /api/export
 * 用法：node tempinit/test_db.js
 */
const http = require('http');
function req(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({
      host: '127.0.0.1', port: 3000, path, method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
    }, res => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    r.on('error', e => resolve({ status: 0, body: e.message }));
    if (data) r.write(data);
    r.end();
  });
}
(async () => {
  const uid = 'test-sqlite-user';

  const h = await req('GET', '/api/health');
  console.log('HEALTH:', h.status, h.body.slice(0, 60));

  const post = await req('POST', '/api/records', { userId: uid, record: { date: '2026-8-31', type: 'period', flow: 3, pain_level: 2, clot: true, mood: 1 } });
  console.log('POST records:', post.status, post.body);

  const get = await req('GET', `/api/records/${uid}`);
  console.log('GET records:', get.status, get.body.slice(0, 200));

  const sync = await req('POST', '/api/health-data/sync', { userId: uid, source: 'test-watch', records: { temperature: 36.8 } });
  console.log('POST health sync:', sync.status, sync.body);

  const st = await req('GET', `/api/health-data/status/${uid}`);
  console.log('GET health status:', st.status, st.body);

  const ex = await req('POST', `/api/export/${uid}`);
  console.log('POST export:', ex.status, ex.body);
})();
