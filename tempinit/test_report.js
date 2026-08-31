/**
 * 临时测试：验证后端 /api/report 生成 PDF（Node 直发，避开 PowerShell 中文编码问题）
 * 用法：node tempinit/test_report.js
 */
const http = require('http');

const reportData = {
  generatedAt: '2026-08-30T00:00:00.000Z',
  avgCycle: 29,
  summaries: [
    { label: '第1期', cycleDays: 29, periodDays: 5, flowLevel: 3 },
    { label: '第2期', cycleDays: 27, periodDays: 6, flowLevel: 2 },
    { label: '第3期', cycleDays: 31, periodDays: 5, flowLevel: 2 },
  ],
  alerts: [{ type: 'warning', message: '近期周期波动较大（标准差 9.5 天），建议持续记录' }],
  indicators: {
    pain: { trend: [0, 1, 2], level: 'warning' },
    clot: { trend: [0, 2, 1], level: 'danger' },
    imb: { trend: [0, 0, 1], level: 'danger' },
    breast: { trend: [1, 1, 1], level: 'normal' },
    temp_biphasic: { trend: [true, true], level: 'normal' },
    mood: { trend: [0, 2, 3], level: 'warning' },
  },
};

const body = JSON.stringify({ reportData });
const req = http.request(
  {
    host: 'localhost',
    port: 3000,
    path: '/api/report',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  },
  (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', () => {
      console.log('status:', res.statusCode);
      console.log('body:', data.slice(0, 200));
    });
  }
);
req.write(body);
req.end();
