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
