/**
 * 步骤1：重写 bat（PS 数组）+ type 验证内容
 */
const { execFile } = require('child_process');
const fs = require('fs');
const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
function psEncoded(s) { return 'powershell -NoProfile -EncodedCommand ' + Buffer.from(s, 'utf16le').toString('base64'); }
log('=== step1_rewrite_bat ' + new Date().toISOString() + ' ===');
const ps = [
'Write-Output "NODE_EXE_EXISTS:"',
'Test-Path C:/nodejs/node.exe',
'Write-Output "LUNASERVER_DIR:"',
'Test-Path C:/luna-server',
'Write-Output "WRITE_BAT:"',
'$lines = @(',
"  '@echo off',",
"  'cd /d C:\luna-server',",
"  '\"C:\nodejs\node.exe\" index.js >> C:\luna-server\service.log 2>&1'",
')',
"Set-Content -Path C:\luna-server\start_server.bat -Value $lines -Encoding Ascii",
'Write-Output "BAT_SIZE:"',
'(Get-Item C:/luna-server/start_server.bat).Length',
'Write-Output "BAT_TYPE:"',
'cmd /c type C:\luna-server\start_server.bat',
'Write-Output "BAT_TYPE_END"'
].join('\n');
execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
  '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16', psEncoded(ps)],
  { timeout: 45000, maxBuffer: 10 * 1024 * 1024 }, (e, out, err) => {
    if (out) { console.log('OUT:\n' + out.slice(0, 2000)); log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 2000)); }
    if (err) { console.log('ERR:\n' + err.slice(0, 300)); log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 300)); }
    console.log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('=== step1 完成 ===');
  });
