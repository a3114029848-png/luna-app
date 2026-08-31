/**
 * Luna 后端服务（AI 代理 + 记录云同步）
 *
 * 职责：
 *  1. AI 代理：客户端不持有 DeepSeek Key，统一走后端转发（SSE 流式）
 *  2. 记录云同步：按 userId 保存/读取经期记录（轻量 JSON 文件存储，Demo 够用）
 *
 * 启动：
 *    cd server
 *    cp .env.example .env   # 填入 DEEPSEEK_API_KEY
 *    npm install
 *    npm start              # 默认 3000 端口
 *
 * 客户端连接地址：
 *   - 模拟器：http://10.0.2.2:3000/api
 *   - 真机  ：http://<电脑局域网IP>:3000/api（启动时会打印 LAN 地址）
 *
 * ⚠️ 安全说明：DeepSeek Key 仅存在服务端 .env，客户端 App 永不接触。
 */

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const PDFDocument = require('pdfkit');

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;

// ── 存储层：SQLite（sql.js，纯 WASM 免编译；Windows 服务器无编译环境）──
// 注意：初始化是异步的（加载 WASM），app.listen 在文件底部 storage.init().then() 中执行
const storage = require('./db');

// ── 服务端医学知识库（可溯源 RAG）──
const { searchKB } = require('./medicalKB');

// ── AI 代理（后端持有 Key，SSE 透传 DeepSeek）──
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE = 'https://api.deepseek.com';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

// 可信医学来源白名单（防止 LLM 编造来源；回答只能引用以下来源）
const MEDICAL_SOURCES = [
  'FIGO AUB 分类系统（2011）',
  '世界卫生组织（WHO）经期健康相关指南',
  '中国妇产科学相关诊疗共识',
  '通用妇产科健康科普共识',
  'Luna 内置医学规则（基于 FIGO，如周期 24~38 天）',
];

// 引用规则（作为 system 注入，保证「可溯源」且不幻觉来源）
const SOURCE_RULE = {
  role: 'system',
  content:
    '引用规则：\n' +
    '- 涉及医学事实或数据时，必须标注来源，格式为相关句末「（来源：XXX）」。\n' +
    '- 允许引用的来源仅限以下白名单：\n' +
    '  · ' + MEDICAL_SOURCES.join('\n  · ') + '\n' +
    '- 严禁编造来源（如捏造“某研究”“某文献”“某年发表”等不存在的内容）。\n' +
    '- 若无法对应到白名单来源，则标注「（通用建议）」，不得虚构引用。',
};

// 给对话注入：引用规则 + RAG 检索到的权威知识条目（放在最前，作为全局约束）
function augmentMessages(messages) {
  const arr = Array.isArray(messages) ? messages : [];
  // RAG：取最后一条用户消息检索知识库，命中则注入权威条目（回答基于条目 + 强制来源）
  const lastUser = [...arr].reverse().find(m => m.role === 'user');
  const hits = lastUser ? searchKB(lastUser.content, 2) : [];
  const ragBlock = hits.length
    ? [{
        role: 'system',
        content:
          '以下是刚从 Luna 权威医学知识库检索到的相关条目。回答必须优先基于这些条目作答，' +
          '可引用其「来源」；不要编造条目之外的数据或研究。若条目未覆盖用户问题，按通用原则回答并标注「（通用建议）」：\n\n' +
          hits.map(h => `【${h.title}】（来源：${h.source}）\n${h.content}`).join('\n\n'),
      }]
    : [];
  return [SOURCE_RULE, ...ragBlock, ...arr];
}

app.post('/api/ai/chat', async (req, res) => {
  const { messages } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages required' });
  }
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured on server (.env)' });
  }

  // 设置 SSE 响应头（客户端用 XHR 增量解析）
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const upstream = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: augmentMessages(messages),
        stream: true,
        temperature: 0.7,
        max_tokens: 512,
      }),
    });

    if (!upstream.ok) {
      const body = await upstream.text();
      res.write(`data: ${JSON.stringify({ error: `DeepSeek ${upstream.status}: ${body.slice(0, 150)}` })}\n\n`);
      return res.end();
    }

    // 透传 DeepSeek 的 OpenAI 兼容 SSE（客户端复用 XHR 解析）
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ── 记录云同步（SQLite sql.js）────────────────
app.post('/api/records', async (req, res) => {
  const { userId, record } = req.body || {};
  if (!userId || !record || !record.date) {
    return res.status(400).json({ error: 'userId & record{date} required' });
  }
  const merged = await storage.saveRecord(userId, record);
  res.json({ ok: true, date: merged.date });
});

app.get('/api/records/:userId', async (req, res) => {
  res.json({ records: await storage.getRecords(req.params.userId) });
});

app.get('/api/cycles/:userId', async (req, res) => {
  res.json({ records: await storage.getRecords(req.params.userId) });
});

app.post('/api/export/:userId', async (req, res) => {
  const records = await storage.getRecords(req.params.userId);
  res.json({
    userId: req.params.userId,
    recordCount: Object.keys(records).length,
    exportedAt: new Date().toISOString(),
  });
});

// ── 穿戴设备数据同步 ─────────────────────────
app.post('/api/health-data/sync', async (req, res) => {
  const { userId, source, records } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });
  await storage.saveHealth(userId, { source, records, syncedAt: new Date().toISOString() });
  res.json({ ok: true });
});

app.get('/api/health-data/status/:userId', async (req, res) => {
  const h = await storage.getHealth(req.params.userId);
  res.json({ synced: !!h, source: h ? h.source : null, syncedAt: h ? h.syncedAt : null });
});

// ── PDF 复诊报告生成 ─────────────────────────
const REPORT_DIR = path.join(__dirname, 'data', 'reports');

function registerFont(doc) {
  // 中文字体：优先环境变量指定，否则用 Windows 系统黑体
  const fontPath = process.env.PDF_FONT_PATH || 'C:\\Windows\\Fonts\\simhei.ttf';
  try {
    doc.registerFont('CJK', fontPath);
    return true;
  } catch (err) {
    console.warn('⚠️  中文字体加载失败（' + fontPath + '），PDF 中文可能显示为方框');
    return false;
  }
}

function generatePdf(reportData, outPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42 });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);
    const hasCJK = registerFont(doc);
    const F = () => (hasCJK ? 'CJK' : 'Helvetica');

    const M = 42;
    const W = doc.page.width - M * 2;
    const C = {
      dark: '#1a2b28', text: '#37423f', muted: '#7a8a85',
      primary: '#1a6b5a', line: '#ccd8d3',
      danger: '#a32d2d', warning: '#8a5a00', normal: '#0f6e56',
    };

    // ── 数值 → 可读文案 ──
    const FLOW = ['无', '点滴', '少量', '适中', '偏多'];
    const PAIN = ['无', '轻微', '中度', '较重', '剧烈'];
    const BREAST = ['无', '轻微', '中度', '较重', '严重'];
    const MOOD = ['无低落', '轻度低落', '中度低落', '较明显低落', '明显低落'];
    const pick = (arr, v) => (v === undefined || v === null || v < 0 || v >= arr.length) ? '—' : arr[v];
    const CLOT = v => (v >= 2 ? '较多' : v >= 1 ? '有' : '无');
    const IMB = v => (v >= 1 ? '有' : '无');
    const TEMP = v => (v === true ? '有双相' : v === false ? '无双相' : '—');
    const STATUS_LABEL = { normal: '正常', warning: '关注', danger: '建议就医' };
    const META = {
      pain:          { label: '腹痛程度',     fmt: v => pick(PAIN, v) },
      clot:          { label: '血块情况',     fmt: v => CLOT(v) },
      imb:           { label: '经间期出血',   fmt: v => IMB(v) },
      breast:        { label: '乳房胀痛',     fmt: v => pick(BREAST, v) },
      temp_biphasic: { label: '体温双相特征', fmt: v => TEMP(v) },
      mood:          { label: '经前情绪低落', fmt: v => pick(MOOD, v) },
    };

    const rule = () => {
      doc.strokeColor(C.line).lineWidth(0.8).moveTo(M, doc.y).lineTo(M + W, doc.y).stroke();
    };
    const section = (text) => {
      doc.moveDown(0.6);
      doc.font(F()).fontSize(12).fillColor(C.primary).text(text);
      doc.moveDown(0.25);
    };

    // ── 标题（简洁，非横幅）──
    doc.font(F()).fontSize(17).fillColor(C.dark).text('Luna 周期复诊报告', { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(9).fillColor(C.muted)
      .text(`生成日期：${new Date(reportData.generatedAt || Date.now()).toLocaleString('zh-CN')} · 数据由你的记录自动汇总`, { align: 'center' });
    doc.moveDown(0.5);
    rule();
    doc.moveDown(0.2);

    // ── 一、周期概况 ──
    const summaries = (reportData.summaries || []).slice(-3);
    const last = summaries[summaries.length - 1] || null;
    section('一、周期概况');
    doc.font(F()).fontSize(10).fillColor(C.text);
    doc.text(
      `平均周期：${reportData.avgCycle ?? '—'} 天（FIGO 正常范围 24~38 天）　|　` +
      `已记录：${(reportData.summaries || []).length} 期　|　` +
      `最近经期：${last ? `${last.periodDays} 天（经血 ${pick(FLOW, last.flowLevel)}）` : '暂无'}`
    );
    doc.moveDown(0.3);
    summaries.forEach(s => {
      doc.text(`  · ${s.label}：周期 ${s.cycleDays ?? '—'} 天 · 经期 ${s.periodDays} 天 · 经血量 ${pick(FLOW, s.flowLevel)}`);
    });

    // ── 二、周期预警 ──
    const alerts = reportData.alerts || [];
    section('二、周期预警');
    doc.font(F()).fontSize(10);
    if (!alerts.length) {
      doc.fillColor(C.normal).text('  近期周期处于 FIGO 正常范围内，未触发异常预警。');
    } else {
      alerts.forEach(a => {
        doc.fillColor(a.type === 'danger' ? C.danger : C.warning)
          .text(`  ${a.type === 'danger' ? '⚠' : '◐'} ${a.message}`);
      });
    }

    // ── 三、就医关键指标（近三期变化）──
    const inds = reportData.indicators || {};
    section('三、就医关键指标（近三期变化）');
    doc.font(F()).fontSize(10);
    Object.keys(META).forEach(k => {
      const it = inds[k] || {};
      const meta = META[k];
      const trend = Array.isArray(it.trend) ? it.trend : [];
      const level = it.level && STATUS_LABEL[it.level] ? it.level : (trend.length ? 'normal' : '');
      const recent = trend.slice(-3);
      const desc = recent.length ? recent.map(v => meta.fmt(v)).join(' → ') : '暂无记录';
      const st = level ? `　[${STATUS_LABEL[level]}]` : '';
      doc.fillColor(level === 'danger' ? C.danger : level === 'warning' ? C.warning : C.text)
        .text(`  ${meta.label}：${desc}${st}`);
      doc.moveDown(0.05);
    });

    // ── 免责声明 ──
    doc.moveDown(0.9);
    rule();
    doc.moveDown(0.3);
    doc.font(F()).fontSize(8).fillColor(C.muted).text(
      '免责声明：本报告由 Luna 根据用户记录自动汇总生成，仅供就医参考，不构成医疗诊断、处方或治疗建议。请携带原始记录咨询专业医生。',
      { align: 'center', width: W }
    );

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

app.post('/api/report', async (req, res) => {
  const { reportData } = req.body || {};
  if (!reportData || typeof reportData !== 'object') {
    return res.status(400).json({ error: 'reportData required' });
  }
  try {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    const filename = `luna-report-${Date.now()}.pdf`;
    const outPath = path.join(REPORT_DIR, filename);
    await generatePdf(reportData, outPath);
    res.json({ url: `http://${req.get('host')}/api/report/download/${filename}` });
  } catch (err) {
    res.status(500).json({ error: `PDF generation failed: ${err.message}` });
  }
});

app.get('/api/report/download/:file', (req, res) => {
  const file = path.join(REPORT_DIR, path.basename(req.params.file));
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'report not found' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(file)}"`);
  fs.createReadStream(file).pipe(res);
});

// ── 健康检查 ────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ ok: true, name: 'luna-server', time: new Date().toISOString() });
});

// ── 启动：SQLite(sql.js) 异步初始化完成后监听 ──
storage.init().then(() => {
  app.listen(PORT, () => {
    console.log(`Luna server running on http://localhost:${PORT}`);
    // 打印局域网地址，供真机连接
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`  LAN (真机用): http://${net.address}:${PORT}/api`);
        }
      }
    }
    if (!DEEPSEEK_API_KEY) {
      console.warn('⚠️  DEEPSEEK_API_KEY 未配置，AI 代理将返回错误（请复制 .env.example 为 .env 并填入）');
    }
  });
}).catch(err => {
  console.error('❌ 存储初始化失败：', err.message);
  process.exit(1);
});
