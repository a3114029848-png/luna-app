/**
 * 临时：上传 server/ 代码到 Windows 服务器（scp，排除 node_modules/data）
 * 1) 创建 C:/luna-server 目录  2) scp 上传文件  3) 验证
 */
const { execFile } = require('child_process');
const fs = require('fs');

const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };

const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const SCP = 'C:\\WINDOWS\\System32\\OpenSSH\\scp.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
const HOST = 'Administrator@49.232.49.16';
const COMMON = ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL'];

function ssh(cmd) {
  return new Promise((res) => {
    execFile(SSH, [...COMMON, '-o', 'ConnectTimeout=15', HOST, cmd], { timeout: 60000, maxBuffer: 5 * 1024 * 1024 },
      (e, out, err) => {
        if (out) log('SSH OUT: ' + out.replace(/\r?\n/g, ' | '));
        if (err) log('SSH ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 300));
        log('SSH EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
        res();
      });
  });
}

const FILES = [
  'server/index.js', 'server/db.js', 'server/medicalKB.js',
  'server/package.json',
  'server/.env.example', 'server/.env',
];

function scpAll() {
  return new Promise((res) => {
    log('=== scp 上传 ' + FILES.length + ' 个文件 ===');
    execFile(SCP, [...COMMON, '-o', 'ConnectTimeout=15', ...FILES.map(f => 'd:\\Luna\\' + f), HOST + ':C:/luna-server/'],
      { timeout: 90000, maxBuffer: 5 * 1024 * 1024 }, (e, out, err) => {
        if (out) log('SCP OUT: ' + out.replace(/\r?\n/g, ' | '));
        if (err) log('SCP ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 300));
        log('SCP EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
        res();
      });
  });
}

(async () => {
  log('=== 上传 server 到 Windows 服务器 ' + new Date().toISOString() + ' ===');
  await ssh('powershell -NoProfile -Command "New-Item -ItemType Directory -Force -Path C:/luna-server | Out-Null; Get-ChildItem C:/luna-server | Measure-Object | Select-Object -ExpandProperty Count"');
  await scpAll();
  await ssh('powershell -NoProfile -Command "Get-ChildItem C:/luna-server -Name"');
  log('=== 上传步骤完成 ===');
})();
