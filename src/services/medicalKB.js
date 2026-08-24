/**
 * Luna 本地 RAG 知识库（轻量版）
 *
 * 目标：让通用健康问答也能「可溯源、可离线」——先在本知识库检索，
 *       命中则返回带「依据来源」的回答；未命中才转发云端 LLM。
 *
 * 说明：
 *  - 这是最小化落地（关键词检索 + 人工整理条目），并非完整向量检索；
 *    后续可替换为向量库 / 后端 RAG。
 *  - 所有条目为健康科普参考，不构成医疗诊断。
 *  - 医学依据来源保持保守标注：FIGO 公开标准 / 项目内置规则 / 通用科普共识。
 */

export const MEDICAL_KB = [
  {
    id: 'kb_dysmenorrhea',
    title: '痛经（经期下腹疼痛）',
    keywords: ['痛经', '肚子疼', '腹痛', '经期疼', '肚子痛', '疼得'],
    content:
      '原发性痛经是经期常见的下腹痉挛性疼痛，通常持续 1~3 天。\n' +
      '可尝试：热敷下腹、适度运动、规律作息；必要时在医生指导下使用止痛药。\n' +
      '若疼痛严重影响生活、或随周期逐年加重，建议就医评估（需排查子宫内膜异位症等）。',
    source: '通用妇产科健康科普共识',
  },
  {
    id: 'kb_imb',
    title: '经间期出血',
    keywords: ['经间期出血', '排卵期出血', '非经期出血', '两次月经之间', '点滴出血'],
    content:
      '经间期出血属于 FIGO 分类中的 AUB-E（排卵功能障碍相关出血），' +
      '按本项目内置规则，出现 1 次即为就医指征。\n建议记录出血日期与量，并在就诊时主动告知医生。',
    source: 'FIGO AUB 分类系统（2011）；项目内置规则 medicalThresholds.js',
  },
  {
    id: 'kb_irregular',
    title: '周期不规律（月经不调）',
    keywords: ['周期不规律', '周期紊乱', '月经不调', '不规律', '推迟', '提前', '紊乱'],
    content:
      '按 FIGO 标准，正常周期长度为 24~38 天；周期波动标准差较大（本项目阈值 >9 天）提示不规律。\n' +
      '偶发一两次波动不必焦虑；若连续多期明显偏离（如 <24 天或 >38 天），建议持续记录并咨询医生。',
    source: 'FIGO AUB 分类系统（2011）；项目内置规则 medicalThresholds.js',
  },
  {
    id: 'kb_flow',
    title: '经血量（月经量多/量少）',
    keywords: ['经血量', '月经量', '量多', '量大', '量少', '血多', '血少'],
    content:
      '经血量主观自评分五级：无 / 点滴 / 少量 / 适中 / 偏多（见项目内置分级）。\n' +
      '若长期「偏多」或自觉经量较以往明显增多，需警惕贫血等问题，建议就医评估；' +
      '「点滴/少量」若伴随周期改变也应记录并观察。',
    source: '项目内置分级 FLOW_LEVELS（medicalThresholds.js）；通用妇产科健康科普共识',
  },
  {
    id: 'kb_clot',
    title: '血块',
    keywords: ['血块', '有血块', '大血块', '血块多'],
    content:
      '偶发小血块多为正常凝血变化，可先观察记录。\n' +
      '若持续出现较多或较大血块（按项目内置规则，近一期明显偏多即建议就医），' +
      '建议就诊时告知医生（与异常子宫出血相关）。',
    source: '项目内置指标 clot（medicalThresholds.js）；通用妇产科健康科普共识',
  },
  {
    id: 'kb_pms',
    title: '黄体期情绪 / 经前综合征（PMS）',
    keywords: ['黄体期', '情绪', '心情', '低落', '暴躁', '易怒', '经前', 'pms', 'pmdd'],
    content:
      '经前综合征（PMS）在黄体期较常见，表现为情绪波动、烦躁、乏力等。\n' +
      '若连续多期情绪问题加重并影响生活，建议评估是否属 PMS / PMDD，并持续记录症状趋势（项目内置 mood 指标）。',
    source: '项目内置指标 mood（medicalThresholds.js）；通用妇产科健康科普共识',
  },
  {
    id: 'kb_exercise',
    title: '经期可以运动吗',
    keywords: ['运动', '健身', '跑步', '锻炼', '游泳', '瑜伽'],
    content:
      '经期可以进行适度运动（散步、瑜伽、轻度有氧等），有助于缓解不适。\n' +
      '建议避免过度剧烈运动；若运动后出血量明显增多或不适加重，应暂停并观察。',
    source: '通用妇产科健康科普共识',
  },
  {
    id: 'kb_bcp',
    title: '短效避孕药 / 调经用药',
    keywords: ['避孕药', '短效避孕', '吃药', '调经', '激素', '优思明', '达英'],
    content:
      '短效避孕药除避孕外，也可用于调经、缓解痛经等，但属于处方药，' +
      '需由医生评估后使用，不可自行长期服用。用药情况请在记录中如实登记（项目内置用药分组）。',
    source: '项目内置用药分组（RecordBottomSheet）；通用妇产科健康科普共识',
  },
  {
    id: 'kb_galactorrhea',
    title: '非哺乳期泌乳 / 乳头溢液',
    keywords: ['泌乳', '溢乳', '乳头', '溢液', '奶水'],
    content:
      '非哺乳期出现泌乳是高泌乳素血症的常见筛查指标，属于内分泌相关就医信号。\n' +
      '项目内置规则将其标为「需重点关注」，建议尽快就医告知医生。',
    source: '项目内置规则（RecordBottomSheet dangerText）；通用妇产科健康科普共识',
  },
  {
    id: 'kb_hirsutism',
    title: '痤疮 / 多毛等内分泌信号',
    keywords: ['多毛', '体毛', '毛发', '痤疮', '痘痘'],
    content:
      '痤疮加重、多毛等可能提示内分泌相关变化（如与 PCOS 相关）。\n' +
      '建议持续记录（项目内置内分泌分组），若同时伴随周期异常，建议咨询医生。',
    source: '项目内置内分泌分组（RecordBottomSheet）；通用妇产科健康科普共识',
  },
  {
    id: 'kb_bbt',
    title: '基础体温与排卵',
    keywords: ['体温', '基础体温', '双相', '体温低', '排卵监测'],
    content:
      '基础体温出现双相变化通常提示本周期有排卵迹象。\n' +
      '若长期记录均无双相，可结合其他信号持续观察（项目内置 temp_biphasic 指标）。',
    source: '项目内置指标 temp_biphasic（medicalThresholds.js）；通用妇产科健康科普共识',
  },
  {
    id: 'kb_when_see_doctor',
    title: '什么时候需要就医',
    keywords: ['就医', '看医生', '去医院', '什么时候去医院', '严重', '去检查'],
    content:
      '出现以下情况建议及时就医：\n' +
      '· 剧烈腹痛或大量出血（紧急情况请立即就医）\n' +
      '· 连续多期周期明显异常（<24 天或 >38 天）\n' +
      '· 经间期出血、非哺乳期泌乳、异常多毛等内分泌信号\n' +
      '· 就医前，可先在本 App 生成「就诊摘要」，帮助医生快速了解你的情况。',
    source: 'FIGO AUB 分类系统（2011）；项目内置预警规则',
  },
];

/**
 * 关键词检索知识库
 * @param {string} input 用户输入
 * @returns {object|null} 命中条目（含 id/title/content/source）
 */
export function searchKB(input) {
  const t = (input || '').toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const item of MEDICAL_KB) {
    let score = 0;
    for (const kw of item.keywords) {
      if (t.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore > 0 ? best : null;
}
