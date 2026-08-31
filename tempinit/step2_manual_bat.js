/**
 * 步骤2：手动执行 start_server.bat 验证能否拉起 server
 */
const { execFile } = require('child_process');
const fs = require('fs');
const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
function psEncoded(s) { return 'powershell -NoProfile -EncodedCommand ' + Buffer.from(s, 'utf16le').toString('base64'); }
log('=== step2_manual_bat ' + new Date().toISOString() + ' ===');
const ps = String.raw`
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800
Remove-Item C:/luna-server/service.log -ErrorAction SilentlyContinue
Write-Output "MANUAL_BAT_RUN:"
$m = Start-Process cmd.exe -ArgumentList "/c C:\luna-server\start_server.bat" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 6
Write-Output ("M_EXITED=" + $m.HasExited)
Write-Output ("NODE_CNT=" + (Get-Process node -ErrorAction SilentlyContinue | Measure-Object).Count)
Write-Output "NET3000:"
netstat -ano | findstr ":3000"
Write-Output "NET3000_END"
try { $h = Invoke-WebRequest http://127.0.0.1:3000/health -UseBasicParsing -TimeoutSec 5; Write-Output ("LOCAL_HEALTH=" + $h.Content) } catch { Write-Output ("LOCAL_HEALTH_ERR=" + $_.Exception.Message) }
Write-Output "SLOG:"
if (Test-Path C:/luna-server/service.log) { Get-Content C:/luna-server/service.log -Tail 8 } else { Write-Output "NO_LOG" }
`;
execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
  '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16', psEncoded(ps)],
  { timeout: 45000, maxBuffer: 10 * 1024 * 1024 }, (e, out, err) => {
    if (out) { console.log('OUT:\n' + out.slice(0, 2500)); log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 2500)); }
    if (err) { console.log('ERR:\n' + err.slice(0, 300)); log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 300)); }
    console.log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('=== step2 完成 ===');
  });
