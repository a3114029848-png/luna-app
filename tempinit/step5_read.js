/**
 * 步骤5：SSH 读取服务器验证文件 verify.txt + fw_status.txt
 */
const { execFile } = require('child_process');
const fs = require('fs');
const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
function psEncoded(s) { return 'powershell -NoProfile -EncodedCommand ' + Buffer.from(s, 'utf16le').toString('base64'); }
log('=== step5_read ' + new Date().toISOString() + ' ===');
const ps = String.raw`
Write-Output "=== VERIFY ==="
if (Test-Path C:/luna-server/verify.txt) { Get-Content C:/luna-server/verify.txt } else { Write-Output "NO_VERIFY" }
Write-Output "=== FW_STATUS ==="
if (Test-Path C:/luna-server/fw_status.txt) { Get-Content C:/luna-server/fw_status.txt } else { Write-Output "NO_FW" }
`;
execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
  '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16', psEncoded(ps)],
  { timeout: 40000, maxBuffer: 10 * 1024 * 1024 }, (e, out, err) => {
    if (out) { console.log('OUT:\n' + out.slice(0, 3000)); log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 3000)); }
    if (err) { console.log('ERR:\n' + err.slice(0, 300)); log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 300)); }
    console.log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('=== step5 完成 ===');
  });
