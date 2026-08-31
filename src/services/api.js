// ════════════════════════════════════════════════════════
// Luna 云端 API 层
//
// 安全架构（2026-08-30）：
//   - 推荐走后端代理 `server/`（DeepSeek Key 只存服务端，客户端不接触）
//   - `deepseekChatStream` 保留为「无后端时的本地直连 fallback」（仅开发）
//
// BASE_URL 配置：
//   - 真机（推荐）：经 adb reverse 走 USB 直连电脑，使用 http://127.0.0.1:3000/api
//     （建立转发：adb reverse tcp:3000 tcp:3000；USB 断开/重启后需重设）
//   - Android 模拟器：http://10.0.2.2:3000/api
export const BASE_URL = 'http://127.0.0.1:3000/api';

// 本地直连 DeepSeek（仅开发 fallback；生产必须走后端代理）
// ⚠️ 安全（2026-08-30）：Key 只存在 server/.env，客户端代码不得写死。
//     确需本地直连时，通过 deepseekChatStream(messages, onChunk, { apiKey }) 临时传入（仅限本地调试）。
const DEEPSEEK_BASE = 'https://api.deepseek.com';
const DEEPSEEK_MODEL = 'deepseek-chat';

// ── 通用 SSE 流式请求（XHR，React Native 兼容：RN fetch 不暴露 res.body）──
const sseStreamRequest = (url, body, headers, onChunk) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    Object.entries(headers || {}).forEach(([k, v]) => xhr.setRequestHeader(k, v));
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
          else if (json.error) reject(new Error(json.error));
        } catch (_) { /* 忽略不完整行 */ }
      }
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState >= 3) { try { flush(); } catch (_) {} }
      if (xhr.readyState === 4) {
        try { flush(); } catch (_) {}
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`API ${xhr.status}: ${(xhr.responseText || '').slice(0, 150)}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network request failed'));
    xhr.ontimeout = () => reject(new Error('Request timeout'));

    xhr.send(JSON.stringify(body));
  });
};

/** AI 对话 · 后端代理（推荐，生产安全：Key 在服务端） */
export const chatStreamViaProxy = (messages, onChunk) =>
  sseStreamRequest(`${BASE_URL}/ai/chat`, { messages }, {}, onChunk);

/** AI 对话 · 本地直连 DeepSeek（仅开发 fallback；Key 需临时传入，不得写死在客户端） */
export const deepseekChatStream = (messages, onChunk, { apiKey } = {}) => {
  if (!apiKey) {
    return Promise.reject(
      new Error('DeepSeek Key 仅在服务端（server/.env）。请使用后端代理，或本地调试时传入 apiKey。')
    );
  }
  return sseStreamRequest(
    `${DEEPSEEK_BASE}/chat/completions`,
    {
      model: DEEPSEEK_MODEL,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 512,
    },
    { Authorization: `Bearer ${apiKey}` },
    onChunk
  );
};

const request = async (endpoint, options = {}) => {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
};

/** 兼容别名：AI 对话默认走后端代理 */
export const chatStream = chatStreamViaProxy;

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
