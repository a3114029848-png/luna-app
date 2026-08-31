/**
 * 临时：服务器重启 server（修复版 db.js）+ 验证 health + records 写读
 */
const { execFile } = require('child_process');
const fs = require('fs');
const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
function psEncoded(s) { return 'powershell -NoProfile -EncodedCommand ' + Buffer.from(s, 'utf16le').toString('base64'); }
log('=== deploy_final ' + new Date().toISOString() + ' ===');
execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
  '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16',
  psEncoded(`
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800
$p = Start-Process C:/nodejs/node.exe -ArgumentList 'index.js' -WorkingDirectory 'C:/luna-server' -RedirectStandardOutput C:/luna-server/start.log -RedirectStandardError C:/luna-server/start.err -PassThru
Start-Sleep -Seconds 4
Write-Output "PID=$($p.Id) EXITED=$($p.HasExited)"
try { $h = Invoke-WebRequest http://127.0.0.1:3000/health -UseBasicParsing -TimeoutSec 5; Write-Output ("HEALTH=" + $h.Content) } catch { Write-Output ("HEALTH_ERR=" + $_.Exception.Message) }
try {
  $body = '{\"userId\":\"deploy-test\",\"record\":{\"date\":\"2026-8-31\",\"type\":\"period\",\"flow\":3}}'
  $r = Invoke-RestMethod -Uri http://127.0.0.1:3000/api/records -Method Post -ContentType 'application/json' -Body $body
  Write-Output ("SAVE=" + ($r | ConvertTo-Json -Compress))
  $g = Invoke-RestMethod -Uri http://127.0.0.1:3000/api/records/deploy-test
  Write-Output ("READ=" + ($g.records.'2026-8-31' | ConvertTo-Json -Compress))
} catch { Write-Output ("REC_ERR=" + $_.Exception.Message) }
if (Test-Path C:/luna-server/start.err) { $e = Get-Content C:/luna-server/start.err -Tail 8; if ($e) { Write-Output ("ERRLOG=" + ($e -join ' | ')) } }
  `)],
  { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (e, out, err) => {
    if (out) log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 2000));
    if (err) log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 400));
    log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('=== deploy_final 完成 ===');
  });
