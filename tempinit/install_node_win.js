/**
 * 临时：通过 SSH 在 Windows 服务器安装 Node.js（下载 zip 解压 + PATH）
 * 结果写 tempinit/ssh_deploy_log.txt
 */
const { execFile } = require('child_process');
const fs = require('fs');

const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };

const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
const HOST = 'Administrator@49.232.49.16';

function ssh(cmd) {
  return new Promise((resolve) => {
    log('>>> ' + cmd.slice(0, 100));
    execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=NUL', '-o', 'ConnectTimeout=15', HOST, cmd],
      { timeout: 150000, maxBuffer: 20 * 1024 * 1024 }, (e, out, err) => {
        if (out) log('OUT: ' + out.replace(/\r?\n/g, ' | '));
        if (err) log('ERR: ' + err.replace(/\r?\n/g, ' | '));
        log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
        resolve();
      });
  });
}

// PowerShell 脚本 → Base64（EncodedCommand 避开引号/转义问题）
function psEncoded(script) {
  const b = Buffer.from(script, 'utf16le').toString('base64');
  return 'powershell -NoProfile -EncodedCommand ' + b;
}

(async () => {
  log('=== 安装 Node.js ' + new Date().toISOString() + ' ===');
  await ssh(psEncoded(`
$ProgressPreference='SilentlyContinue'
$ErrorActionPreference='Stop'
$u='https://nodejs.org/dist/v20.18.1/node-v20.18.1-win-x64.zip'
Invoke-WebRequest -Uri $u -OutFile C:\node.zip
Expand-Archive -Path C:\node.zip -DestinationPath C:\ -Force
if (Test-Path C:\nodejs) { Remove-Item C:\nodejs -Recurse -Force }
Move-Item C:\node-v20.18.1-win-x64 C:\nodejs
& C:\nodejs\node.exe -v
& C:\nodejs\npm.cmd -v
  `));
  await ssh('setx PATH "%PATH%;C:\\nodejs"');
  // 验证 Node 是否可用（独立会话用完整路径）
  await ssh(psEncoded(`
$exists = Test-Path C:\nodejs\node.exe
Write-Output "NODE_EXISTS=$exists"
if ($exists) { & C:\nodejs\node.exe -v; & C:\nodejs\npm.cmd -v }
  `));
  log('=== Node 安装步骤完成 ===');
})();
