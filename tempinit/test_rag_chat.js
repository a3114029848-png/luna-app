/**
 * 临时验证：/api/ai/chat 的 RAG 注入（真实调用 DeepSeek，需 server/.env 有 Key）
 * 用法：node tempinit/test_rag_chat.js
 */
const http = require('http');
const question = '我最近两次月经之间有点滴出血，要紧吗？怎么处理？';
const body = JSON.stringify({ messages: [{ role: 'user', content: question }] });
const req = http.request({
  host: '127.0.0.1', port: 3000, path: '/api/ai/chat', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
}, res => {
  let buf = '', out = '';
  res.on('data', c => {
    buf += c;
    const lines = buf.split('\n'); buf = lines.pop();
    for (const ln of lines) {
      const t = ln.trim();
      if (!t.startsWith('data:')) continue;
      const p = t.slice(5).trim();
      if (p === '[DONE]') continue;
      try {
        const j = JSON.parse(p);
        const d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
        if (d) out += d;
        if (j.error) console.log('UPSTREAM ERR:', j.error);
      } catch (e) { /* ignore */ }
    }
  });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('问:', question);
    console.log('答:', out);
  });
});
req.on('error', e => console.log('ERR:', e.message));
req.write(body); req.end();
