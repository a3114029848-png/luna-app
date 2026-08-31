/**
 * 临时：服务器清理旧依赖 + npm install(sql.js) + 启动 + 验证
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
        if (err) log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 400));
        log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
        res();
      });
  });
}

(async () => {
  log('=== v3 清理+安装sql.js+启动 ' + new Date().toISOString() + ' ===');

  // 1) 清理旧 node_modules + lock + 重新 npm install（sql.js）
  await ssh(psEncoded(`
$ProgressPreference='SilentlyContinue'
$env:PATH = 'C:/nodejs;' + $env:PATH
Set-Location C:/luna-server
if (Test-Path node_modules) { Remove-Item node_modules -Recurse -Force }
if (Test-Path package-lock.json) { Remove-Item package-lock.json -Force }
npm install --registry=https://registry.npmmirror.com --no-audit --no-fund *> C:/luna-server/npm_install2.log
Write-Output "NPM_EXIT=$LASTEXITCODE"
Write-Output "sqljs=$(Test-Path C:/luna-server/node_modules/sql.js)"
Write-Output "express=$(Test-Path C:/luna-server/node_modules/express)"
Write-Output "dotenv=$(Test-Path C:/luna-server/node_modules/dotenv)"
Write-Output "pdfkit=$(Test-Path C:/luna-server/node_modules/pdfkit)"
  `));

  // 2) 若 install 失败，读日志尾部
  await ssh(psEncoded(`
if (Test-Path C:/luna-server/npm_install2.log) { Get-Content C:/luna-server/npm_install2.log -Tail 15 | Out-String }
  `));

  // 3) 启动 server（后台）
  await ssh(psEncoded(`
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
$p = Start-Process -FilePath C:/nodejs/node.exe -ArgumentList 'index.js' -WorkingDirectory 'C:/luna-server' -RedirectStandardOutput C:/luna-server/server.log -RedirectStandardError C:/luna-server/server.err -WindowStyle Hidden -PassThru
Write-Output "PID=$($p.Id)"
Start-Sleep -Seconds 3
  `));

  // 4) 验证 /health
  await ssh(psEncoded(`
try { (Invoke-WebRequest http://127.0.0.1:3000/health -UseBasicParsing -TimeoutSec 5).Content } catch { Write-Output "HEALTH_ERR: $($_.Exception.Message)" }
  `));

  // 5) Windows 防火墙放行 3000
  await ssh(psEncoded(`
New-NetFirewallRule -Name luna3000 -DisplayName 'Luna 3000' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 3000 -ErrorAction SilentlyContinue
Write-Output "FW_OK"
  `));

  log('=== v3 完成 ===');
})();
