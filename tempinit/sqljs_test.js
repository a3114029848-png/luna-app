/** 临时：测 sql.js 参数绑定 */
const initSqlJs = require('d:\\Luna\\server\\node_modules\\sql.js');
initSqlJs().then(SQL => {
  const d = new SQL.Database();
  d.run('CREATE TABLE t(a TEXT, b TEXT)');
  d.run('INSERT INTO t VALUES (?,?)', ['x', 'y']);
  console.log('ROWS1=' + JSON.stringify(d.exec('SELECT * FROM t')));
  // 试试 exec 直接插
  d.run("INSERT INTO t VALUES ('a','b')");
  console.log('ROWS2=' + JSON.stringify(d.exec('SELECT * FROM t')));
  // UPSERT
  d.run('CREATE TABLE r(user_id TEXT, date TEXT, payload TEXT, PRIMARY KEY(user_id,date))');
  d.run("INSERT INTO r VALUES ('u','2026-8-31','{}') ON CONFLICT(user_id,date) DO UPDATE SET payload=excluded.payload");
  console.log('ROWS3=' + JSON.stringify(d.exec('SELECT * FROM r')));
}).catch(e => console.error('ERR', e));
