/**
 * 临时：用 PS 数组重写 bat + type 验证 + 手动执行验证 + 注册任务 + 验证
 */
const { execFile } = require('child_process');
const fs = require('fs');
const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
function psEncoded(s) { return 'powershell -NoProfile -EncodedCommand ' + Buffer.from(s, 'utf16le').toString('base64'); }
log('=== svc4 ' + new Date().toISOString() + ' ===');
const ps = [
"Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue",
"Start-Sleep -Milliseconds 600",
'Write-Output "OLD_BAT_SIZE:"',
'if (Test-Path C:/luna-server/start_server.bat) { (Get-Item C:/luna-server/start_server.bat).Length } else { Write-Output "MISSING" }',
'Write-Output "REWRITE_BAT:"',
'$lines = @(',
"  '@echo off',",
"  'cd /d C:\luna-server',",
"  '\"C:\nodejs\node.exe\" index.js >> C:\luna-server\service.log 2>&1'",
')',
"Set-Content -Path C:\luna-server\start_server.bat -Value $lines -Encoding Ascii",
'Write-Output "BAT_SIZE_AFTER:"',
'(Get-Item C:/luna-server/start_server.bat).Length',
'Write-Output "BAT_TYPE:"',
'cmd /c type C:\luna-server\start_server.bat',
'Write-Output "BAT_END"',
'Write-Output "MANUAL_BAT:"',
'$m = Start-Process cmd.exe -ArgumentList "/c C:\luna-server\start_server.bat" -PassThru -WindowStyle Hidden',
"Start-Sleep -Seconds 6",
'Write-Output ("M_EXITED=" + $m.HasExited + " NODE_CNT=" + (Get-Process node -ErrorAction SilentlyContinue | Measure-Object).Count)',
'netstat -ano | findstr ":3000"',
'Write-Output "SLOG1:"',
'if (Test-Path C:/luna-server/service.log) { Get-Content C:/luna-server/service.log -Tail 8 } else { Write-Output "NO_LOG" }',
"Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue",
"Start-Sleep -Milliseconds 600",
'Write-Output "REG_TASK:"',
"$action = New-ScheduledTaskAction -Execute 'C:\Windows\System32\cmd.exe' -Argument '/c C:\luna-server\start_server.bat'",
"$trigger = New-ScheduledTaskTrigger -AtStartup",
"$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest",
"Register-ScheduledTask -TaskName 'luna-server' -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null",
'Write-Output "TASK_OK"',
"Start-ScheduledTask -TaskName 'luna-server'",
"Start-Sleep -Seconds 8",
'Write-Output ("NODE_CNT2=" + (Get-Process node -ErrorAction SilentlyContinue | Measure-Object).Count)',
'netstat -ano | findstr ":3000"',
'$info = Get-ScheduledTaskInfo -TaskName "luna-server"',
'Write-Output ("LAST_RESULT=" + $info.LastTaskResult)',
'try { $h = Invoke-WebRequest http://127.0.0.1:3000/health -UseBasicParsing -TimeoutSec 5; Write-Output ("LOCAL_HEALTH=" + $h.Content) } catch { Write-Output ("LOCAL_HEALTH_ERR=" + $_.Exception.Message) }',
'Write-Output "SLOG2:"',
'if (Test-Path C:/luna-server/service.log) { Get-Content C:/luna-server/service.log -Tail 8 } else { Write-Output "NO_LOG2" }'
].join('\n');
execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
  '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16', psEncoded(ps)],
  { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (e, out, err) => {
    if (out) { console.log('OUT:\n' + out.slice(0, 3000)); log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 3000)); }
    if (err) { console.log('ERR:\n' + err.slice(0, 500)); log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 500)); }
    console.log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('=== svc4 完成 ===');
  });
