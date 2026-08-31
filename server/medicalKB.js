/**
 * Luna 服务端医学知识库 + 多策略检索（可溯源 RAG 最小闭环）
 *
 * 设计：
 *   - 权威知识条目带「来源」（仅限 server/index.js 的 MEDICAL_SOURCES 白名单）
 *   - 检索 = 关键词命中 + 字符 bigram Jaccard 相似度（无需外部 embedding，零重依赖）
 *   - 命中条目由 /api/ai/chat 注入 LLM 上下文 → 回答基于权威条目 + 强制来源
 *
 * 边界：所有条目为健康科普参考，不构成医疗诊断。
 */

const KB = [
  { id: 'kb_dysmenorrhea', title: '痛经（经期下腹疼痛）',
    keywords: ['痛经', '肚子疼', '腹痛', '经期疼', '疼得', '止痛'],
    content: '原发性痛经是经期常见的下腹痉挛性疼痛，通常持续 1~3 天，可尝试热敷、适度运动、规律作息，必要时在医生指导下使用止痛药。若疼痛严重影响生活、或随周期逐年加重，需排查子宫内膜异位症等，建议就医。',
    source: '通用妇产科健康科普共识' },
  { id: 'kb_imb', title: '经间期出血（非经期出血）',
    keywords: ['经间期出血', '排卵期出血', '非经期出血', '两次月经之间', '点滴出血'],
    content: '经间期出血属于 FIGO 分类中的 AUB-E（排卵功能障碍相关出血），按本项目内置规则出现 1 次即为就医指征。建议记录出血日期与量，就诊时主动告知医生。',
    source: 'FIGO AUB 分类系统（2011）；Luna 内置医学规则' },
  { id: 'kb_irregular', title: '周期不规律（月经不调）',
    keywords: ['周期不规律', '周期紊乱', '月经不调', '不规律', '推迟', '提前', '紊乱'],
    content: '按 FIGO 标准，正常周期长度 24~38 天；周期波动标准差较大（本项目阈值 >9 天）提示不规律。偶发波动不必焦虑；若连续多期明显偏离（<24 天或 >38 天），建议持续记录并咨询医生。',
    source: 'FIGO AUB 分类系统（2011）；Luna 内置医学规则' },
  { id: 'kb_flow', title: '经血量（多/少）',
    keywords: ['经血量', '月经量', '量多', '量大', '量少', '血多', '血少', '贫血'],
    content: '经血量主观分五级：无/点滴/少量/适中/偏多。长期「偏多」或自觉较以往明显增多，需警惕缺铁性贫血，建议就医评估血常规与铁蛋白；「点滴/少量」伴随周期改变也应记录观察。',
    source: 'Luna 内置分级；通用妇产科健康科普共识' },
  { id: 'kb_clot', title: '血块',
    keywords: ['血块', '有血块', '大血块', '血块多'],
    content: '偶发小血块多为正常凝血变化，可观察记录。若持续出现较多或较大血块（按项目内置规则近一期明显偏多即建议就医），就诊时告知医生（与异常子宫出血相关）。',
    source: 'Luna 内置指标 clot；通用妇产科健康科普共识' },
  { id: 'kb_pms', title: '经前综合征（PMS/PMDD）',
    keywords: ['黄体期', '情绪', '心情', '低落', '暴躁', '易怒', '经前', 'pms', 'pmdd'],
    content: '经前综合征（PMS）在黄体期较常见，表现为情绪波动、烦躁、乏力等。若连续多期情绪问题加重并影响生活，建议评估是否属 PMS/PMDD，并持续记录症状趋势。',
    source: 'Luna 内置指标 mood；通用妇产科健康科普共识' },
  { id: 'kb_exercise', title: '经期可以运动吗',
    keywords: ['运动', '健身', '跑步', '锻炼', '游泳', '瑜伽'],
    content: '经期可进行适度运动（散步、瑜伽、轻度有氧等），有助缓解不适；避免过度剧烈运动。若运动后出血量明显增多或不适加重，应暂停并观察。',
    source: '通用妇产科健康科普共识' },
  { id: 'kb_bcp', title: '短效避孕药 / 调经用药',
    keywords: ['避孕药', '短效避孕', '吃药', '调经', '激素', '优思明', '达英'],
    content: '短效避孕药除避孕外也可用于调经、缓解痛经等，但属处方药，需医生评估后使用，不可自行长期服用。用药情况请在记录中如实登记。',
    source: 'Luna 内置用药分组；通用妇产科健康科普共识' },
  { id: 'kb_galactorrhea', title: '非哺乳期泌乳 / 乳头溢液',
    keywords: ['泌乳', '溢乳', '乳头', '溢液', '奶水'],
    content: '非哺乳期出现泌乳是高泌乳素血症的常见筛查指标，属内分泌相关就医信号。项目内置规则将其标为「需重点关注」，建议尽快就医告知医生。',
    source: 'Luna 内置规则；通用妇产科健康科普共识' },
  { id: 'kb_hirsutism', title: '痤疮 / 多毛等内分泌信号',
    keywords: ['多毛', '体毛', '毛发', '痤疮', '痘痘', '痘痘加重'],
    content: '痤疮加重、多毛等可能提示内分泌相关变化（如与多囊卵巢综合征相关）。建议持续记录，若同时伴随周期异常，建议咨询医生。',
    source: 'Luna 内置内分泌分组；通用妇产科健康科普共识' },
  { id: 'kb_bbt', title: '基础体温与排卵',
    keywords: ['体温', '基础体温', '双相', '体温低', '排卵监测', '温度'],
    content: '基础体温出现双相变化通常提示本周期有排卵迹象；若长期记录均无双相，可结合其他信号持续观察（本项目 temp_biphasic 指标）。',
    source: 'Luna 内置指标 temp_biphasic；通用妇产科健康科普共识' },
  { id: 'kb_when_see_doctor', title: '什么时候需要就医',
    keywords: ['就医', '看医生', '去医院', '什么时候去医院', '严重', '去检查', '复查'],
    content: '出现以下情况建议及时就医：剧烈腹痛或大量出血（紧急请立即就医）；连续多期周期明显异常（<24 天或 >38 天）；经间期出血、非哺乳期泌乳、异常多毛等信号。就医前可在 App 生成「就诊摘要」帮助医生快速了解情况。',
    source: 'FIGO AUB 分类系统（2011）；Luna 内置预警规则' },
  { id: 'kb_pcos', title: '多囊卵巢综合征（PCOS）信号',
    keywords: ['多囊', 'pcos', '不排卵', '长痘', '多毛加重', '肥胖'],
    content: '多囊卵巢综合征（PCOS）常见信号：周期稀发/不规律、痤疮增多、多毛、肥胖等，诊断需医生结合激素与超声。若周期长期稀发（>35 天）伴上述表现，建议就医评估。',
    source: '中国妇产科学相关诊疗共识；通用妇产科健康科普共识' },
  { id: 'kb_endometriosis', title: '子宫内膜异位症',
    keywords: ['子宫内膜异位', '内异症', '痛经加重', '进行性痛经', '同房痛', '不孕'],
    content: '子宫内膜异位症常见表现：痛经逐年加重、经期下腹疼痛、同房痛、不孕等，确诊需医生评估。若痛经随周期逐年加重并影响生活，建议就医。',
    source: '通用妇产科健康科普共识' },
  { id: 'kb_aub', title: '异常子宫出血（AUB）概述',
    keywords: ['异常子宫出血', 'aub', '出血不止', '经期长', '经期超8天', '非经期出血'],
    content: '异常子宫出血（AUB）按 FIGO 分类（PALM-COEIN）涵盖：周期频率、规律性、经期时长（>8 天）、经量等异常。反复或持续异常出血应记录并就医评估原因。',
    source: 'FIGO AUB 分类系统（2011）' },
  { id: 'kb_anemia', title: '经量多与贫血',
    keywords: ['贫血', '头晕', '乏力', '面色苍白', '缺铁', '铁蛋白'],
    content: '长期经量过多可能引起缺铁性贫血，表现为头晕、乏力、面色苍白等。若长期「偏多」并伴上述症状，建议就医查血常规/铁蛋白，并关注经量。',
    source: '通用妇产科健康科普共识' },
  { id: 'kb_ovulation_symptoms', title: '排卵期症状',
    keywords: ['排卵', '拉丝', '白带拉丝', '排卵痛', '下腹坠胀', '易孕期'],
    content: '排卵期常见信号：白带增多呈拉丝状、单侧下腹轻微坠胀/刺痛（排卵痛）、基础体温双相。这些是正常生理表现，可用于辅助判断易孕期。',
    source: '通用妇产科健康科普共识' },
  { id: 'kb_emergency_contraception', title: '紧急避孕药',
    keywords: ['紧急避孕', '事后药', '毓婷', '金毓婷'],
    content: '紧急避孕药（如左炔诺孕酮类）用于无保护同房后 72 小时内补救，越早效果越好，但失败率高于短效避孕，且可能引起撤退性出血、周期紊乱，不宜常规使用。',
    source: '通用妇产科健康科普共识' },
  { id: 'kb_discharge', title: '白带 / 阴道分泌物',
    keywords: ['白带', '分泌物', '异味', '瘙痒', '豆腐渣', '发黄'],
    content: '白带随周期有正常变化（排卵期增多拉丝）。若出现异味、颜色异常、瘙痒、量显著增多等，可能提示阴道炎等感染，建议就医检查，勿自行用药。',
    source: '通用妇产科健康科普共识' },
  { id: 'kb_early_pregnancy_bleeding', title: '妊娠相关出血警示',
    keywords: ['怀孕', '早孕', '验孕', '着床出血', '停经后出血', '宫外孕'],
    content: '停经后出现阴道出血、尤其伴腹痛，需警惕妊娠相关异常（如异位妊娠）。本项目对疑似怀孕/宫外孕类问题强制走安全兜底——请立即就医，切勿自行判断。',
    source: '通用妇产科健康科普共识；Luna 安全兜底规则' },
  { id: 'kb_perimenopause', title: '围绝经期 / 更年期月经变化',
    keywords: ['更年期', '围绝经期', '绝经', '月经乱', '潮热', '40多岁'],
    content: '围绝经期（通常 45~55 岁）月经可出现周期变长、经量变化等。若出现大量出血或周期异常持续，仍需就医评估（排除器质性病变），不可简单归因于更年期。',
    source: '通用妇产科健康科普共识' },
];

/** 字符 bigram 集合（用于相似度） */
function bigrams(str) {
  const s = String(str || '').toLowerCase().replace(/\s+/g, '');
  const set = new Set();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * 多策略检索：关键词命中 + 字符 bigram 相似度，返回 top-k 条目
 * @param {string} input
 * @param {number} k
 * @returns {Array<{id,title,content,source}>}
 */
function searchKB(input, k = 2) {
  const t = String(input || '').toLowerCase();
  if (!t.trim()) return [];
  const inBi = bigrams(t);
  const scored = KB.map(item => {
    let kwHits = 0;
    for (const kw of item.keywords) if (t.includes(kw.toLowerCase())) kwHits++;
    const sim = jaccard(inBi, bigrams(item.title + ' ' + item.keywords.join(' ') + ' ' + item.content.slice(0, 120)));
    const score = kwHits * 3 + sim;
    return { item, score };
  }).filter(x => x.score > 0.6)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map(x => x.item);
}

module.exports = { KB, searchKB };
