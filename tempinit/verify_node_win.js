/**
 * 临时：验证 Windows 服务器 Node 是否已装（正斜杠路径，避开反斜杠转义）
 */
const { execFile } = require('child_process');
const fs = require('fs');

const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';

function psEncoded(s) {
  return 'powershell -NoProfile -EncodedCommand ' + Buffer.from(s, 'utf16le').toString('base64');
}

log('=== verify node ' + new Date().toISOString() + ' ===');
execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no',
  '-o', 'UserKnownHostsFile=NUL', '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16',
  psEncoded(`
$exists = Test-Path C:/nodejs/node.exe
Write-Output "NODE_EXISTS=$exists"
if ($exists) { & C:/nodejs/node.exe -v; & C:/nodejs/npm.cmd -v } else { Write-Output "NEED_INSTALL" }
  `)],
  { timeout: 60000, maxBuffer: 5 * 1024 * 1024 }, (e, out, err) => {
    if (out) log('OUT: ' + out.replace(/\r?\n/g, ' | '));
    if (err) log('ERR: ' + err.slice(0, 300));
    log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
  });
