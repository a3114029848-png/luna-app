/**
 * 临时：轻量 SSH 测试 + 重试 svc2（输出到 stdout 便于观察）
 */
const { execFile } = require('child_process');
const fs = require('fs');
const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
function psEncoded(s) { return 'powershell -NoProfile -EncodedCommand ' + Buffer.from(s, 'utf16le').toString('base64'); }
log('=== svc2_retry ' + new Date().toISOString() + ' ===');
const ps = [
'Write-Output "SSH_OK"',
"Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue",
"Start-Sleep -Milliseconds 800",
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
const t0 = Date.now();
execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
  '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16', psEncoded(ps)],
  { timeout: 45000, maxBuffer: 10 * 1024 * 1024 }, (e, out, err) => {
    log('ELAPSED=' + (Date.now() - t0) + 'ms');
    if (out) { console.log('OUT:\n' + out.slice(0, 3000)); log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 3000)); }
    if (err) { console.log('ERR:\n' + err.slice(0, 500)); log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 500)); }
    console.log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('=== svc2_retry 完成 ===');
  });
