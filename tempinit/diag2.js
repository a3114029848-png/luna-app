/**
 * 临时：诊断 plan task + 手动前台启动 server 看真实输出
 */
const { execFile } = require('child_process');
const fs = require('fs');
const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
function psEncoded(s) { return 'powershell -NoProfile -EncodedCommand ' + Buffer.from(s, 'utf16le').toString('base64'); }
log('=== diag2 ' + new Date().toISOString() + ' ===');
execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
  '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16',
  psEncoded(`
Write-Output "SCHTASK_QUERY:"
schtasks /Query /TN "luna-server" /V /FO LIST | findstr /i "状态 Status LastRun Last Result"
Write-Output "NODE_BEFORE:"
(Get-Process node -ErrorAction SilentlyContinue | Measure-Object).Count
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800
# 手动前台启动（重定向到文件）
$p = Start-Process C:/nodejs/node.exe -ArgumentList 'index.js' -WorkingDirectory 'C:/luna-server' -RedirectStandardOutput C:/luna-server/run.log -RedirectStandardError C:/luna-server/run.err -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 6
Write-Output ("PID=" + $p.Id + " EXITED=" + $p.HasExited)
Write-Output "NODE_AFTER:"
(Get-Process node -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Output "NET3000:"
netstat -ano | findstr ":3000"
Write-Output "NET3000_END"
try { $h = Invoke-WebRequest http://127.0.0.1:3000/health -UseBasicParsing -TimeoutSec 5; Write-Output ("HEALTH=" + $h.Content) } catch { Write-Output ("HEALTH_ERR=" + $_.Exception.Message) }
Write-Output "RUNLOG:"
if (Test-Path C:/luna-server/run.log) { Get-Content C:/luna-server/run.log -Tail 10 }
Write-Output "RUNERR:"
if (Test-Path C:/luna-server/run.err) { Get-Content C:/luna-server/run.err -Tail 10 }
  `)],
  { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (e, out, err) => {
    if (out) log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 3500));
    if (err) log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 400));
    log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('=== diag2 完成 ===');
  });
