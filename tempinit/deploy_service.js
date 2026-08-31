/**
 * 临时：schtasks + start_server.bat（cd 到正确目录）常驻启动 luna-server + 完整验证
 */
const { execFile } = require('child_process');
const fs = require('fs');
const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
function psEncoded(s) { return 'powershell -NoProfile -EncodedCommand ' + Buffer.from(s, 'utf16le').toString('base64'); }
log('=== deploy_service ' + new Date().toISOString() + ' ===');
const ps = [
"Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue",
"Start-Sleep -Milliseconds 800",
"$bat = @'",
"@echo off",
"cd /d C:\luna-server",
'"C:\nodejs\node.exe" index.js >> C:\luna-server\service.log 2>&1',
"'@",
"Set-Content -Path C:\luna-server\start_server.bat -Value $bat -Encoding Ascii",
'Write-Output "BAT_WRITTEN"',
'schtasks /Create /F /TN "luna-server" /TR "C:\luna-server\start_server.bat" /SC ONSTART /RU SYSTEM /RL HIGHEST',
'schtasks /Run /TN "luna-server"',
"Start-Sleep -Seconds 7",
'Write-Output ("NODE_COUNT=" + (Get-Process node -ErrorAction SilentlyContinue | Measure-Object).Count)',
'Write-Output "NET3000:"',
'netstat -ano | findstr ":3000"',
'Write-Output "NET3000_END"',
'try { $h = Invoke-WebRequest http://127.0.0.1:3000/health -UseBasicParsing -TimeoutSec 5; Write-Output ("LOCAL_HEALTH=" + $h.Content) } catch { Write-Output ("LOCAL_HEALTH_ERR=" + $_.Exception.Message) }',
'Write-Output "SCHTASK_LAST:"',
'schtasks /Query /TN "luna-server" /V /FO LIST | findstr /i "Result Status"',
'Write-Output "SERVICE_LOG:"',
'if (Test-Path C:/luna-server/service.log) { Get-Content C:/luna-server/service.log -Tail 10 } else { Write-Output "NO_SERVICE_LOG" }'
].join('\n');
execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
  '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16', psEncoded(ps)],
  { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (e, out, err) => {
    if (out) log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 3500));
    if (err) log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 400));
    log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('=== deploy_service 完成 ===');
  });
