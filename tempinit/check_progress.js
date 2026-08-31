/**
 * 临时：检查服务器 npm install 进度（node_modules 是否在生成）
 */
const { execFile } = require('child_process');
const fs = require('fs');
const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
log('=== check progress ' + new Date().toISOString() + ' ===');
execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
  '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16',
  'powershell -NoProfile -Command "$p=Test-Path C:/luna-server/node_modules; Write-Output NODEMODULES=$p; if($p){ $n=(Get-ChildItem C:/luna-server/node_modules -Directory -ErrorAction SilentlyContinue).Count; Write-Output DIRS=$n; $b=Test-Path C:/luna-server/node_modules/better-sqlite3; Write-Output BSQLITE=$b }; Get-Process node -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count"'],
  { timeout: 30000, maxBuffer: 5 * 1024 * 1024 }, (e, out, err) => {
    if (out) log('OUT: ' + out.replace(/\r?\n/g, ' | '));
    if (err) log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 200));
    log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
  });
