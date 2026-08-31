/**
 * 临时：服务器 npm install（用 EncodedCommand 正确执行）
 */
const { execFile } = require('child_process');
const fs = require('fs');

const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';

function psEncoded(s) {
  return 'powershell -NoProfile -EncodedCommand ' + Buffer.from(s, 'utf16le').toString('base64');
}

function ssh(cmd) {
  return new Promise((res) => {
    execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
      '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16', cmd],
      { timeout: 300000, maxBuffer: 30 * 1024 * 1024 }, (e, out, err) => {
        if (out) log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 1800));
        if (err) log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 800));
        log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
        res();
      });
  });
}

(async () => {
  log('=== npm install (PS 修复版) ' + new Date().toISOString() + ' ===');
  await ssh(psEncoded(`
$ProgressPreference='SilentlyContinue'
$env:PATH = 'C:/nodejs;' + $env:PATH
Set-Location C:/luna-server
npm install --registry=https://registry.npmmirror.com --no-audit --no-fund 2>&1 | Out-String
  `));
  // 检查关键依赖
  await ssh(psEncoded(`
Write-Output "bsqlite=$(Test-Path C:/luna-server/node_modules/better-sqlite3)"
Write-Output "express=$(Test-Path C:/luna-server/node_modules/express)"
Write-Output "pdfkit=$(Test-Path C:/luna-server/node_modules/pdfkit)"
Write-Output "dotenv=$(Test-Path C:/luna-server/node_modules/dotenv)"
  `));
  log('=== npm install 完成 ===');
})();
