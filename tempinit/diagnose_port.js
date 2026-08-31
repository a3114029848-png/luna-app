/**
 * 临时：服务器诊断——node 进程 + 3000 监听地址 + 防火墙规则
 */
const { execFile } = require('child_process');
const fs = require('fs');
const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
function psEncoded(s) { return 'powershell -NoProfile -EncodedCommand ' + Buffer.from(s, 'utf16le').toString('base64'); }
log('=== diagnose_port ' + new Date().toISOString() + ' ===');
execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
  '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16',
  psEncoded(`
Write-Output "NODE_PROCS:"
Get-Process node -ErrorAction SilentlyContinue | Select-Object Id,StartTime | Format-Table -AutoSize | Out-String
Write-Output "NET3000:"
netstat -ano | findstr ":3000"
Write-Output "NET3000_END"
Write-Output "FW_RULE:"
Get-NetFirewallRule -DisplayName 'luna3000' -ErrorAction SilentlyContinue | Select-Object DisplayName,Enabled,Direction,Action | Format-Table -AutoSize | Out-String
Write-Output "ENV_FILE:"
if (Test-Path C:/luna-server/.env) { $c = Get-Content C:/luna-server/.env; foreach($l in $c){ if($l -match '^[A-Z_]+='){ Write-Output (($l -split '=')[0] + "=SET") } } } else { Write-Output ".env_MISSING" }
Write-Output "STARTLOG_TAIL:"
if (Test-Path C:/luna-server/start.log) { Get-Content C:/luna-server/start.log -Tail 5 }
Write-Output "STARTERR_TAIL:"
if (Test-Path C:/luna-server/start.err) { Get-Content C:/luna-server/start.err -Tail 5 }
  `)],
  { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (e, out, err) => {
    if (out) log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 3000));
    if (err) log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 400));
    log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('=== diagnose_port 完成 ===');
  });
