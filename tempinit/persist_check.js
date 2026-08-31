/**
 * 公网 AI chat 测试 + 服务器 node 进程持久性检查（写文件避免吞输出）
 */
const { execFile } = require('child_process');
const fs = require('fs');
const LOG = 'd:\\Luna\\tempinit\\ssh_deploy_log.txt';
const log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n'); } catch (e) {} };
const SSH = 'C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe';
const KEY = 'D:\\Luna_homework\\luna_using.pem';
function psEncoded(s) { return 'powershell -NoProfile -EncodedCommand ' + Buffer.from(s, 'utf16le').toString('base64'); }

// 1) 本机公网测 AI chat
const http = require('http');
const body = JSON.stringify({ messages: [{ role: 'user', content: '你好，用一句话介绍自己' }] });
const req = http.request({ host: '49.232.49.16', port: 3000, path: '/api/ai/chat', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => { console.log('AI_STATUS=' + res.statusCode + ' BODY=' + data.slice(0, 500)); doSsh(); });
});
req.on('error', (e) => { console.log('AI_ERR=' + e.message); doSsh(); });
req.end(body);

function doSsh() {
  log('=== persist_check ' + new Date().toISOString() + ' ===');
  const ps = String.raw`
Write-Output "=== PERSIST ==="
("NODE_CNT=" + (Get-Process node -ErrorAction SilentlyContinue | Measure-Object).Count) | Out-File C:/luna-server/persist.txt
Get-Process node -ErrorAction SilentlyContinue | Select-Object Id,StartTime | Format-Table -AutoSize | Out-String -Width 200 | Out-File -Append C:/luna-server/persist.txt
netstat -ano | findstr ":3000" | Out-File -Append C:/luna-server/persist.txt
Write-Output "PERSIST_DONE"
`;
  execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
    '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16', psEncoded(ps)],
    { timeout: 40000, maxBuffer: 10 * 1024 * 1024 }, (e, out, err) => {
      if (out) { console.log('OUT:\n' + out.slice(0, 800)); log('OUT: ' + out.replace(/\r?\n/g, ' | ').slice(0, 800)); }
      if (err) { console.log('ERR:\n' + err.slice(0, 200)); log('ERR: ' + err.replace(/\r?\n/g, ' | ').slice(0, 200)); }
      console.log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
      log('EXIT: ' + (e ? (e.code !== undefined ? e.code : e.message) : 0));
      // 再读 persist.txt
      const ps2 = String.raw`
Get-Content C:/luna-server/persist.txt
`;
      execFile(SSH, ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL',
        '-o', 'ConnectTimeout=15', 'Administrator@49.232.49.16', psEncoded(ps2)],
        { timeout: 40000, maxBuffer: 10 * 1024 * 1024 }, (e2, out2, err2) => {
          if (out2) { console.log('PERSIST_FILE:\n' + out2.slice(0, 1500)); log('PFILE: ' + out2.replace(/\r?\n/g, ' | ').slice(0, 1500)); }
          console.log('=== persist_check 完成 ===');
          log('=== persist_check 完成 ===');
        });
    });
}
