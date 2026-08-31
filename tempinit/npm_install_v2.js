/**
 * 临时：npm install 输出重定向到服务器文件 + 读取，定位失败原因
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
      { timeout: 400000, maxBuffer: 30 * 1024 * 1024 }, (e, out, err) => {
        if (out) log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 1500));
        if (err) log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 500));
        log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
        res();
      });
  });
}

(async () => {
  log('=== npm install v2 ' + new Date().toISOString() + ' ===');
  await ssh(psEncoded(`
$ProgressPreference='SilentlyContinue'
$env:PATH = 'C:/nodejs;' + $env:PATH
Set-Location C:/luna-server
npm install --registry=https://registry.npmmirror.com --no-audit --no-fund *> C:/luna-server/npm_install.log
Write-Output "NPM_EXIT=$LASTEXITCODE"
  `));
  log('--- 读取 npm_install.log ---');
  await ssh(psEncoded(`
if (Test-Path C:/luna-server/npm_install.log) {
  Get-Content C:/luna-server/npm_install.log -Tail 40 | Out-String
} else { Write-Output "NO_LOG_FILE" }
  `));
  log('=== npm install v2 完成 ===');
})();
