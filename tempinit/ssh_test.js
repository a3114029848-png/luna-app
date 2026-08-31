/**
 * 临时：SSH 连接 Windows 服务器测试（结果写日志）
 * 用法：node tempinit/ssh_test.js → tempinit/ssh_deploy_log.txt
 */
const { execFile } = require('child_process');
const fs = require('fs');

const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };

log('=== ' + new Date().toISOString() + ' ===');
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
const CMD = 'echo CONNECT_OK && whoami && ver && where node 2>nul & node -v 2>nul';

execFile(SSH, [
  '-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no',
  '-o', 'UserKnownHostsFile=NUL', '-o', 'ConnectTimeout=10',
  'Administrator@49.232.49.16', CMD,
], { timeout: 20000 }, (err, stdout, stderr) => {
  log('EXIT: ' + (err ? (err.code !== undefined ? err.code : err.message) : 0));
  if (stdout) log('OUT: ' + stdout.replace(/\r?\n/g, ' | '));
  if (stderr) log('ERR: ' + stderr.replace(/\r?\n/g, ' | '));
  log('=== done ===');
});
