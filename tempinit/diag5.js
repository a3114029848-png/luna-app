/**
 * 临时：启动 server（输出重定向到文件）+ 报告进程状态 + 读文件
 */
const { execFile } = require('child_process');
const fs = require('fs');
const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
function psEncoded(s) { return 'powershell -NoProfile -EncodedCommand ' + Buffer.from(s, 'utf16le').toString('base64'); }
function ssh(cmd) {
  return new Promise((res) => {
    execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
      '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16', cmd],
      { timeout: 40000, maxBuffer: 10 * 1024 * 1024 }, (e, out, err) => {
        if (out) log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 2000));
        if (err) log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 400));
        log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
        res();
      });
  });
}

(async () => {
  log('=== diag5 启动+读文件 ' + new Date().toISOString() + ' ===');
  // 1) 启动 server（Redirect 到文件）并报告进程状态
  await ssh(psEncoded(`
Set-Location C:/luna-server
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
$p = Start-Process C:/nodejs/node.exe -ArgumentList 'index.js' -WorkingDirectory 'C:/luna-server' -RedirectStandardOutput C:/luna-server/start.log -RedirectStandardError C:/luna-server/start.err -PassThru
Start-Sleep -Seconds 5
Write-Output "PID=$($p.Id) EXITED=$($p.HasExited)"
  `));
  // 2) 读 start.log 和 start.err
  await ssh(psEncoded(`
Write-Output "===== start.log ====="
if (Test-Path C:/luna-server/start.log) { Get-Content C:/luna-server/start.log -Tail 20 | Out-String } else { Write-Output NO_LOG }
Write-Output "===== start.err ====="
if (Test-Path C:/luna-server/start.err) { Get-Content C:/luna-server/start.err -Tail 40 | Out-String } else { Write-Output NO_ERR }
  `));
  log('=== diag5 完成 ===');
})();
