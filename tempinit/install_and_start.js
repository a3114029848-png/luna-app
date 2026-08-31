/**
 * 临时：服务器上 npm install + 启动 Luna server + 验证 + 放行 3000
 */
const { execFile } = require('child_process');
const fs = require('fs');

const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };

const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
const HOST = 'Administrator@49.232.49.16';
const COMMON = ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL'];

function ssh(cmd) {
  return new Promise((res) => {
    execFile(SSH, [...COMMON, '-o', 'ConnectTimeout=15', HOST, cmd], { timeout: 300000, maxBuffer: 20 * 1024 * 1024 },
      (e, out, err) => {
        if (out) log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 1500));
        if (err) log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 800));
        log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
        res();
      });
  });
}

(async () => {
  log('=== npm install + 启动 ' + new Date().toISOString() + ' ===');

  // 1) npm install（国内镜像）
  log('--- [1/5] npm install ---');
  await ssh('cd /d C:\\luna-server && C:\\nodejs\\npm.cmd install --registry=https://registry.npmmirror.com --no-audit --no-fund 2>&1 | findstr /i "added error ERR failed"');
  // 2) 检查 better-sqlite3 是否装成功
  log('--- [2/5] 检查依赖 ---');
  await ssh('powershell -NoProfile -Command "Test-Path C:/luna-server/node_modules/better-sqlite3; Test-Path C:/luna-server/node_modules/express; Test-Path C:/luna-server/node_modules/pdfkit"');
  // 3) 启动 server（后台进程）
  log('--- [3/5] 启动 server ---');
  await ssh('powershell -NoProfile -Command "Start-Process -FilePath C:/nodejs/node.exe -ArgumentList \'index.js\' -WorkingDirectory \'C:/luna-server\' -RedirectStandardOutput C:/luna-server/server.log -RedirectStandardError C:/luna-server/server.err -WindowStyle Hidden; Write-Output STARTED"');
  // 4) 验证 /health
  log('--- [4/5] 验证 /health ---');
  await ssh('powershell -NoProfile -Command "Start-Sleep -Seconds 3; try { (Invoke-WebRequest http://127.0.0.1:3000/health -UseBasicParsing -TimeoutSec 5).Content } catch { $_.Exception.Message }"');
  // 5) Windows 防火墙放行 3000
  log('--- [5/5] 放行 3000 ---');
  await ssh('powershell -NoProfile -Command "New-NetFirewallRule -Name luna3000 -DisplayName \'Luna 3000\' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 3000 -ErrorAction SilentlyContinue; Write-Output FW_OK"');

  log('=== 部署步骤完成 ===');
})();
