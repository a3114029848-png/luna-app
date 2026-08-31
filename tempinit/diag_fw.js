/**
 * 临时：诊断 Windows 防火墙状态 + 服务器内部访问公网 IP
 */
const { execFile } = require('child_process');
const fs = require('fs');
const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
function psEncoded(s) { return 'powershell -NoProfile -EncodedCommand ' + Buffer.from(s, 'utf16le').toString('base64'); }
log('=== diag_fw ' + new Date().toISOString() + ' ===');
execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
  '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16',
  psEncoded(`
Write-Output "FW_PROFILES:"
Get-NetFirewallProfile | Select-Object Name,Enabled | Format-Table -AutoSize | Out-String
Write-Output "FW_LUNA:"
Get-NetFirewallRule -DisplayName 'luna3000' -ErrorAction SilentlyContinue | Select-Object DisplayName,Enabled,Profile,Direction,Action | Format-Table -AutoSize | Out-String
Write-Output "SELF_PUBLIC:"
try { $r = Invoke-WebRequest http://49.232.49.16:3000/health -UseBasicParsing -TimeoutSec 6; Write-Output ("SELF_PUBLIC_OK=" + $r.Content) } catch { Write-Output ("SELF_PUBLIC_ERR=" + $_.Exception.Message) }
Write-Output "SELF_LOCAL:"
try { $r2 = Invoke-WebRequest http://127.0.0.1:3000/health -UseBasicParsing -TimeoutSec 5; Write-Output ("SELF_LOCAL_OK=" + $r2.Content) } catch { Write-Output ("SELF_LOCAL_ERR=" + $_.Exception.Message) }
Write-Output "IPCONFIG:"
ipconfig | findstr /i "IPv4"
  `)],
  { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (e, out, err) => {
    if (out) log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 3500));
    if (err) log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 400));
    log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('=== diag_fw 完成 ===');
  });
