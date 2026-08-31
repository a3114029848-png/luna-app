/**
 * 临时：用 schtasks 计划任务注册 luna-server（SYSTEM，开机自启）+ 立即运行 + 验证
 */
const { execFile } = require('child_process');
const fs = require('fs');
const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
function psEncoded(s) { return 'powershell -NoProfile -EncodedCommand ' + Buffer.from(s, 'utf16le').toString('base64'); }
log('=== deploy_schtask ' + new Date().toISOString() + ' ===');
execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
  '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16',
  psEncoded(`
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800
# 防火墙放行 3000（若不存在）
if (-not (Get-NetFirewallRule -DisplayName 'luna3000' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName 'luna3000' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 | Out-Null
  Write-Output "FW_CREATED"
} else { Write-Output "FW_EXISTS" }
# 计划任务：开机自启 + 立即运行（SYSTEM 账户，脱离会话）
schtasks /Create /TN "luna-server" /TR "C:\nodejs\node.exe C:\luna-server\index.js" /SC ONSTART /RU SYSTEM /RL HIGHEST /F
schtasks /Run /TN "luna-server"
Start-Sleep -Seconds 5
Write-Output "NET3000:"
netstat -ano | findstr ":3000"
Write-Output "NET3000_END"
try { $h = Invoke-WebRequest http://127.0.0.1:3000/health -UseBasicParsing -TimeoutSec 5; Write-Output ("HEALTH=" + $h.Content) } catch { Write-Output ("HEALTH_ERR=" + $_.Exception.Message) }
if (Test-Path C:/luna-server/start.err) { $e = Get-Content C:/luna-server/start.err -Tail 5; if ($e) { Write-Output ("ERRLOG=" + ($e -join ' | ')) } }
  `)],
  { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (e, out, err) => {
    if (out) log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 3000));
    if (err) log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 400));
    log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('=== deploy_schtask 完成 ===');
  });
