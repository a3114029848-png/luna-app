/**
 * 临时：前台运行 index.js 8 秒截获启动输出/报错
 */
const { execFile } = require('child_process');
const fs = require('fs');
const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
log('=== diag4 前台跑 index.js ' + new Date().toISOString() + ' ===');
execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
  '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16',
  'cmd /c "cd /d C:\\luna-server && C:\\nodejs\\node.exe index.js"'],
  { timeout: 9000, maxBuffer: 8 * 1024 * 1024 }, (e, out, err) => {
    if (out) log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 2500));
    if (err) log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 1500));
    log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
    log('=== diag4 完成 ===');
  });
