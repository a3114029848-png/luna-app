// ════════════════════════════════════════════════════════
// DeepSeek 云端直连（本地 Demo / 面试验证用）
//
// ⚠️ 安全警告：
//   1. 把 API Key 写进客户端 App 会随包分发而泄露，仅限本地真机验证 / 面试演示。
//   2. 提交 Git / 上架前，必须改为「后端持有 Key 的代理」方式（见 README）。
//   3. Key 无效会返回 401，账号无余额会返回 402，可用下方错误信息排查。
// ════════════════════════════════════════════════════════
const DEEPSEEK_API_KEY = '你的api密钥'; // TODO: 填入你的 DeepSeek API Key
const DEEPSEEK_BASE = 'https://api.deepseek.com';
const DEEPSEEK_MODEL = 'deepseek-chat';

/**
 * DeepSeek 流式对话（OpenAI 兼容 SSE 格式）
 *
 * ⚠️ 重要：必须用 XMLHttpRequest 实现，不能用 fetch + res.body.getReader()。
 *   因为 React Native 的 fetch 不暴露 res.body（body 为 undefined），
 *   电脑 Node 能跑、真机必报 "cannot read property 'getReader' of undefined"。
 *   方案：XHR 在 readyState=3（LOADING）时增量读取 responseText 并解析 SSE。
 *
 * @param {Array<{role:string, content:string}>} messages
 * @param {(chunk:string)=>void} onChunk
 * @returns {Promise<void>}
 */
export const deepseekChatStream = (messages, onChunk) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${DEEPSEEK_BASE}/chat/completions`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${DEEPSEEK_API_KEY}`);
    xhr.timeout = 60000;

    let buffer = '';    // 未处理完的文本缓冲
    let lastIndex = 0;  // 上次已处理的位置

    // 增量解析 SSE：只处理新增文本
    const flush = () => {
      const text = xhr.responseText || '';
      if (text.length <= lastIndex) return;
      buffer += text.slice(lastIndex);
      lastIndex = text.length;

      const lines = buffer.split('\n');
      buffer = lines.pop(); // 保留最后可能不完整的行
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) onChunk(delta);
        } catch (_) { /* 忽略不完整行 */ }
      }
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState >= 3) {
        try { flush(); } catch (_) {}
      }
      if (xhr.readyState === 4) {
        try { flush(); } catch (_) {}
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          const body = (xhr.responseText || '').slice(0, 150);
          reject(new Error(`DeepSeek ${xhr.status}: ${body}`));
        }
      }
    };
    xhr.onerror = () => reject(new Error('Network request failed'));
    xhr.ontimeout = () => reject(new Error('Request timeout'));

    xhr.send(JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 512,
    }));
  });
};

// 替换为你的 Node.js 服务地址
const BASE_URL = 'https://your-backend.com/api';

const request = async (endpoint, options = {}) => {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
};

/**
 * AI 对话（流式响应）
 * @param {Array<{role:string, content:string}>} messages
 * @param {(chunk:string)=>void} onChunk
 */
export const chatStream = async (messages, onChunk) => {
  const res = await fetch(`${BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    chunk.split('\n').filter(Boolean).forEach(line => {
      if (line.startsWith('data:')) {
        try { onChunk(JSON.parse(line.slice(5)).text); } catch {}
      }
    });
  }
};

// ── 经期记录相关 ──────────────────────────────────────
export const saveRecord      = (data)   => request('/records', { method: 'POST', body: JSON.stringify(data) });
export const getRecords      = (userId) => request(`/records/${userId}`);
export const getCycleHistory = (userId) => request(`/cycles/${userId}`);
export const exportReport    = (userId) => request(`/export/${userId}`, { method: 'POST' });

// ── 穿戴设备数据同步 ──────────────────────────────────
export const syncHealthData = (userId, source, records) =>
  request('/health-data/sync', {
    method: 'POST',
    body: JSON.stringify({ userId, source, records }),
  });

export const getSyncStatus = (userId) => request(`/health-data/status/${userId}`);
