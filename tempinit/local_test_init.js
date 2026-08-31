/** 临时：测 server/db.js init 是否 resolve（带超时） */
const storage = require('d:\\Luna\\server\\db.js');
storage.init().then(() => {
  console.log('INIT_RESOLVED');
  process.exit(0);
}).catch(e => {
  console.log('INIT_REJECT: ' + e.message);
  process.exit(1);
});
setTimeout(() => { console.log('INIT_HANG (5s 未完成)'); process.exit(2); }, 5000);
