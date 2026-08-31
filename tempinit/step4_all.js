/**
 * 步骤4：放行防火墙 + 注册启动计划任务 + 验证全部写文件
 */
const { execFile } = require('child_process');
const fs = require('fs');
const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
function psEncoded(s) { return 'powershell -NoProfile -EncodedCommand ' + Buffer.from(s, 'utf16le').toString('base64'); }
log('=== step4_all ' + new Date().toISOString() + ' ===');
const ps = String.raw`
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800
# 防火墙放行（Profile Any 强制）
New-NetFirewallRule -DisplayName 'luna3000' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Profile Any -Enabled True -Force | Out-Null
# 状态写文件
Get-NetFirewallProfile | Select-Object Name,Enabled | Format-Table -AutoSize | Out-String -Width 200 | Out-File C:/luna-server/fw_status.txt
Get-NetFirewallRule -DisplayName 'luna3000' -ErrorAction SilentlyContinue | Select-Object Enabled,Profile,Direction,Action | Format-Table -AutoSize | Out-String -Width 200 | Out-File -Append C:/luna-server/fw_status.txt
# 计划任务（cmd /c bat，修复版 bat）
$action = New-ScheduledTaskAction -Execute 'C:\Windows\System32\cmd.exe' -Argument '/c C:\luna-server\start_server.bat'
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'luna-server' -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'luna-server'
Start-Sleep -Seconds 9
# 验证写文件
"VERIFY_START" | Out-File C:/luna-server/verify.txt
("NODE_CNT=" + (Get-Process node -ErrorAction SilentlyContinue | Measure-Object).Count) | Out-File -Append C:/luna-server/verify.txt
netstat -ano | findstr ":3000" | Out-File -Append C:/luna-server/verify.txt
$info = Get-ScheduledTaskInfo -TaskName "luna-server"
("LAST_RESULT=" + $info.LastTaskResult) | Out-File -Append C:/luna-server/verify.txt
try { $h = Invoke-WebRequest http://127.0.0.1:3000/health -UseBasicParsing -TimeoutSec 5; ("LOCAL_HEALTH=" + $h.Content) | Out-File -Append C:/luna-server/verify.txt } catch { ("LOCAL_HEALTH_ERR=" + $_.Exception.Message) | Out-File -Append C:/luna-server/verify.txt }
"VERIFY_END" | Out-File -Append C:/luna-server/verify.txt
Write-Output "DONE"
`;
execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
  '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16', psEncoded(ps)],
  { timeout: 50000, maxBuffer: 10 * 1024 * 1024 }, (e, out, err) => {
    if (out) { console.log('OUT:\n' + out.slice(0, 1000)); log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 1000)); }
    if (err) { console.log('ERR:\n' + err.slice(0, 300)); log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 300)); }
    console.log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('=== step4 完成 ===');
  });
