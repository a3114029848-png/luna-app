/**
 * 临时：前台运行 server 捕获报错 + 测 sql.js/db.js
 */
const { execFile } = require('child_process');
const fs = require('fs');

const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';

function psEncoded(s) { return 'powershell -NoProfile -EncodedCommand ' + Buffer.from(s, 'utf16le').toString('base64'); }
function ssh(cmd) {
  return new Promise((res) => {
    execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
      '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16', cmd],
      { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (e, out, err) => {
        if (out) log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 2200));
        if (err) log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 500));
        log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
        res();
      });
  });
}

(async () => {
  log('=== diagnose2 ' + new Date().toISOString() + ' ===');
  // 1) sql.js 是否能加载
  await ssh(psEncoded(`
$o = & C:/nodejs/node.exe -e "const i=require('sql.js');i().then(()=>console.log('SQLJS_OK')).catch(e=>console.log('SQLJS_ERR',e.message))" 2>&1 | Out-String
Write-Output $o
  `));
  // 2) db.js init + 写读
  await ssh(psEncoded(`
Set-Location C:/luna-server
$o = & C:/nodejs/node.exe -e "const db=require('./db');db.init().then(async()=>{console.log('DB_INIT_OK');await db.saveRecord('t','2026-8-31',{type:'period'});console.log('SAVE_OK');const r=await db.getRecords('t');console.log('READ='+JSON.stringify(r));}).catch(e=>console.log('DB_ERR',e.stack))" 2>&1 | Out-String
Write-Output $o
  `));
  // 3) 前台跑 index.js 5 秒看启动日志/报错
  await ssh(psEncoded(`
Set-Location C:/luna-server
$job = Start-Job { Set-Location C:/luna-server; & C:/nodejs/node.exe index.js 2>&1 }
Start-Sleep -Seconds 6
Receive-Job $job -Keep | Out-String
Stop-Job $job -ErrorAction SilentlyContinue
Remove-Job $job -Force -ErrorAction SilentlyContinue
  `));
  log('=== diagnose2 完成 ===');
})();
