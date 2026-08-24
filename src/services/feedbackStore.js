/**
 * AI 回答反馈存储（数据飞轮）
 *
 * 目标：把「用户对回答的评价」沉淀下来，形成 反馈 → 标注 → 改进 的闭环。
 * 说明：
 *  - 仅存反馈摘要（text 截断 80 字），不存完整敏感健康内容，符合隐私原则。
 *  - 同一消息重复评价会覆盖，保证只保留最新态度。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@luna_ai_feedback';

export async function getFeedbackAll() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

/**
 * 保存一条反馈
 * @param {{messageId:string, source:string, useful:boolean, text:string}} item
 */
export async function saveFeedback({ messageId, source, useful, text }) {
  try {
    const all = await getFeedbackAll();
    const filtered = all.filter(f => f.messageId !== messageId);
    filtered.push({
      messageId,
      source,        // 'local' | 'knowledge' | 'safety' | 'cloud'
      useful,
      text: (text || '').slice(0, 80),
      createdAt: new Date().toISOString(),
    });
    await AsyncStorage.setItem(KEY, JSON.stringify(filtered));
    return filtered;
  } catch (err) {
    return null;
  }
}

/**
 * 反馈统计（可展示在「我的」页或用于内部评估）
 */
export async function getFeedbackStats() {
  const all = await getFeedbackAll();
  const total = all.length;
  const useful = all.filter(f => f.useful).length;
  const bySource = all.reduce((acc, f) => {
    acc[f.source] = (acc[f.source] || 0) + 1;
    return acc;
  }, {});
  return {
    total,
    usefulRate: total ? Math.round((useful / total) * 100) : 0,
    bySource,
  };
}
