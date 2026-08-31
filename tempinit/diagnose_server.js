/**
 * 临时：读服务器 server.log/server.err 诊断启动失败原因
 */
const { execFile } = require('child_process');
const fs = require('fs');
const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
function psEncoded(s) { return 'powershell -NoProfile -EncodedCommand ' + Buffer.from(s, 'utf16le').toString('base64'); }
log('=== diagnose server ' + new Date().toISOString() + ' ===');
execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
  '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16',
  psEncoded(`
Write-Output "--- processes ---"
Get-Process node -ErrorAction SilentlyContinue | Select-Object Id,StartTime | Format-Table | Out-String
Write-Output "--- server.log ---"
if (Test-Path C:/luna-server/server.log) { Get-Content C:/luna-server/server.log -Tail 30 | Out-String } else { Write-Output NO_LOG }
Write-Output "--- server.err ---"
if (Test-Path C:/luna-server/server.err) { Get-Content C:/luna-server/server.err -Tail 40 | Out-String } else { Write-Output NO_ERR }
Write-Output "--- port 3000 ---"
netstat -ano | findstr :3000
  `)],
  { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }, (e, out, err) => {
    if (out) log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 2500));
    if (err) log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 400));
    log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
  });
