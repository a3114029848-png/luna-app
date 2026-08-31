/**
 * 步骤3：强制放行 3000（Profile Any）+ 查防火墙状态 + 服务器内测公网 IP
 */
const { execFile } = require('child_process');
const fs = require('fs');
const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
function psEncoded(s) { return 'powershell -NoProfile -EncodedCommand ' + Buffer.from(s, 'utf16le').toString('base64'); }
log('=== step3_fw ' + new Date().toISOString() + ' ===');
const ps = String.raw`
Write-Output "FW_PROFILES:"
Get-NetFirewallProfile | Select-Object Name,Enabled | Format-Table -AutoSize | Out-String -Width 200
Write-Output "RULE_BEFORE:"
Get-NetFirewallRule -DisplayName 'luna3000' -ErrorAction SilentlyContinue | Select-Object DisplayName,Enabled,Profile,Direction,Action | Format-Table -AutoSize | Out-String -Width 200
Write-Output "FORCE_RULE:"
New-NetFirewallRule -DisplayName 'luna3000' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Profile Any -Enabled True -Force | Out-Null
Write-Output "RULE_AFTER:"
Get-NetFirewallRule -DisplayName 'luna3000' -ErrorAction SilentlyContinue | Select-Object DisplayName,Enabled,Profile,Direction,Action | Format-Table -AutoSize | Out-String -Width 200
Write-Output "SELF_PUBLIC:"
try { $r = Invoke-WebRequest http://49.232.49.16:3000/health -UseBasicParsing -TimeoutSec 6; Write-Output ("SELF_PUBLIC_OK=" + $r.Content) } catch { Write-Output ("SELF_PUBLIC_ERR=" + $_.Exception.Message) }
Write-Output "SELF_LOCAL:"
try { $r2 = Invoke-WebRequest http://127.0.0.1:3000/health -UseBasicParsing -TimeoutSec 5; Write-Output ("SELF_LOCAL_OK=" + $r2.Content) } catch { Write-Output ("SELF_LOCAL_ERR=" + $_.Exception.Message) }
`;
execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
  '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16', psEncoded(ps)],
  { timeout: 45000, maxBuffer: 10 * 1024 * 1024 }, (e, out, err) => {
    if (out) { console.log('OUT:\n' + out.slice(0, 3000)); log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 3000)); }
    if (err) { console.log('ERR:\n' + err.slice(0, 300)); log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 300)); }
    console.log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('=== step3 完成 ===');
  });
