/**
 * 临时：手动验证 bat + Register-ScheduledTask 注册常驻任务 + 验证
 */
const { execFile } = require('child_process');
const fs = require('fs');
const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
function psEncoded(s) { return 'powershell -NoProfile -EncodedCommand ' + Buffer.from(s, 'utf16le').toString('base64'); }
log('=== deploy_svc2 ' + new Date().toISOString() + ' ===');
const ps = [
"Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue",
"Start-Sleep -Milliseconds 800",
'Write-Output "BAT_CONTENT:"',
"Get-Content C:/luna-server/start_server.bat",
'Write-Output "MANUAL_RUN:"',
'$m = Start-Process cmd.exe -ArgumentList "/c C:\luna-server\start_server.bat" -PassThru -WindowStyle Hidden',
"Start-Sleep -Seconds 6",
'Write-Output ("MANUAL_EXITED=" + $m.HasExited)',
'Write-Output ("NODE_CNT=" + (Get-Process node -ErrorAction SilentlyContinue | Measure-Object).Count)',
'netstat -ano | findstr ":3000"',
'Write-Output "SERVICE_LOG_T:"',
'if (Test-Path C:/luna-server/service.log) { Get-Content C:/luna-server/service.log -Tail 10 } else { Write-Output "NO_LOG" }',
'Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue',
"Start-Sleep -Milliseconds 500",
'Write-Output "REGISTER_TASK:"',
"$action = New-ScheduledTaskAction -Execute 'C:\luna-server\start_server.bat'",
"$trigger = New-ScheduledTaskTrigger -AtStartup",
"$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest",
"Register-ScheduledTask -TaskName 'luna-server' -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null",
'Write-Output "TASK_REGISTERED"',
"Start-ScheduledTask -TaskName 'luna-server'",
"Start-Sleep -Seconds 7",
'Write-Output ("NODE_CNT2=" + (Get-Process node -ErrorAction SilentlyContinue | Measure-Object).Count)',
'Write-Output "NET2:"',
'netstat -ano | findstr ":3000"',
'Write-Output "NET2_END"',
'$info = Get-ScheduledTaskInfo -TaskName "luna-server"',
'Write-Output ("LAST_RESULT=" + $info.LastTaskResult + " LAST_RUN=" + $info.LastRunTime)',
'try { $h = Invoke-WebRequest http://127.0.0.1:3000/health -UseBasicParsing -TimeoutSec 5; Write-Output ("LOCAL_HEALTH=" + $h.Content) } catch { Write-Output ("LOCAL_HEALTH_ERR=" + $_.Exception.Message) }',
'Write-Output "SERVICE_LOG_2:"',
'if (Test-Path C:/luna-server/service.log) { Get-Content C:/luna-server/service.log -Tail 10 } else { Write-Output "NO_LOG2" }'
].join('\n');
execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
  '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16', psEncoded(ps)],
  { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (e, out, err) => {
    if (out) log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 4000));
    if (err) log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 400));
    log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('=== deploy_svc2 完成 ===');
  });
