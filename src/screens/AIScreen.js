import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { deepseekChatStream, chatStreamViaProxy } from '../services/api';
import { handle as handleLocal } from '../services/agentTools';
import { saveFeedback } from '../services/feedbackStore';
import { useTheme } from '../theme/ThemeContext';

// 云端 LLM 的 system prompt（安全边界，与 AI产品设计.md 对齐）
const SYSTEM_PROMPT =
  '你是 Luna 的 AI 健康助手，服务对象是记录经期与症状的女性。\n' +
  '必须遵守：\n' +
  '1. 你不是医生，不能诊断，不能开药；涉及健康判断时，以"以上为健康科普参考，不构成医疗诊断"结尾。\n' +
  '2. 涉及剧烈腹痛、大量出血、疑似怀孕/宫外孕/流产等紧急或诊断性问题，必须引导立即就医，不得猜测性回答。\n' +
  '3. 医学信息必须标注来源，格式为相关句末「（来源：XXX）」，来源仅限可信标准（如 FIGO 标准、公开指南、通用科普共识）；严禁编造来源（如捏造研究/文献/年份）；无法确认来源时标注「（通用建议）」。\n' +
  '4. 回答简洁、可落地、有同理心，不要堆砌术语。\n' +
  '5. 可以使用用户提供的周期/症状数据，但只能做描述与提醒，不得下"你得病了"类结论。';

const QUICK_QUESTIONS = ['我的周期正常吗', '什么时候排卵', '就医指标怎么看', '生成就诊摘要'];

const INIT_MSG = {
  id: '0', role: 'ai',
  text: '你好，我是 Luna AI 助手。我可以基于你的周期记录和 FIGO 就医指标，直接为你做分析（标「本地分析」）；也可以回答通用健康问题（不替代医生诊断）。试试点下面的问题吧。',
};

export default function AIScreen() {
  const { theme } = useTheme();
  const [messages, setMessages] = useState([INIT_MSG]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const listRef = useRef(null);

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { id: Date.now().toString(), role: 'user', text };

    // 1) 本地 Agent 工具层：能基于你的数据/规则/知识库回答的问题，不经过云端 LLM
    const local = handleLocal(text);
    if (local) {
      const source = local.intent === 'dangerous' ? 'safety'
        : local.intent === 'knowledge' ? 'knowledge'
        : 'local';
      setMessages(prev => [...prev, userMsg, {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: local.text,
        source,
        feedback: null,
      }]);
      setInput('');
      return;
    }

    // 2) 云端流式对话
    const aiMsg   = { id: (Date.now() + 1).toString(), role: 'ai', text: '', source: 'cloud', feedback: null };
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
        { role: 'user', content: text },
      ];
      // 优先走后端代理（Key 在服务端，安全）；后端不可用则降级本地直连（仅开发）
      try {
        await chatStreamViaProxy(history, (chunk) => {
          setMessages(prev => prev.map(m =>
            m.id === aiMsg.id ? { ...m, text: m.text + chunk } : m
          ));
        });
      } catch (proxyErr) {
        await deepseekChatStream(history, (chunk) => {
          setMessages(prev => prev.map(m =>
            m.id === aiMsg.id ? { ...m, text: m.text + chunk } : m
          ));
        });
      }
    } catch (e) {
      setMessages(prev => prev.map(m =>
        m.id === aiMsg.id ? { ...m, text: `⚠️ 云端请求失败：${e.message || '请稍后重试'}。本地分析与知识库仍可用。` } : m
      ));
    } finally {
      setLoading(false);
    }
  };

  // 反馈闭环：用户评价 → 本地持久化（数据飞轮）
  const rateFeedback = (id, useful, item) => {
    setMessages(prev => prev.map(m =>
      m.id === id ? { ...m, feedback: useful ? 'up' : 'down' } : m
    ));
    saveFeedback({ messageId: id, source: item.source, useful, text: item.text });
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: '#f0f7f4' }]}>
      <View style={[s.hdr, { backgroundColor: theme.primary }]}>
        <Text style={s.hdrTitle}>AI 助手</Text>
        <View style={s.badge}>
          <Text style={s.badgeText}>参考 FIGO 及妇产科循证文献</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, gap: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
        renderItem={({ item }) => (
          <View style={[
            s.bubble,
            item.role === 'user'
              ? [s.userBubble, { backgroundColor: theme.primary }]
              : [s.aiBubble, { borderColor: theme.mid }],
          ]}>
            {item.role === 'ai' && item.source === 'local' && (
              <View style={s.localBadge}>
                <Text style={s.localBadgeText}>本地分析</Text>
              </View>
            )}
            {item.role === 'ai' && item.source === 'knowledge' && (
              <View style={[s.localBadge, s.kbBadge]}>
                <Text style={[s.localBadgeText, s.kbBadgeText]}>知识库</Text>
              </View>
            )}
            {item.role === 'ai' && item.source === 'safety' && (
              <View style={[s.localBadge, s.safetyBadge]}>
                <Text style={[s.localBadgeText, s.safetyBadgeText]}>安全提示</Text>
              </View>
            )}
            <Text style={[s.bubbleText, { color: item.role === 'user' ? '#fff' : '#222' }]}>
              {item.text || (loading ? '…' : '')}
            </Text>
            {item.role === 'ai' && (
              <View style={s.fbRow}>
                <TouchableOpacity
                  style={[s.fbBtn, item.feedback === 'up' && s.fbBtnOn]}
                  onPress={() => rateFeedback(item.id, true, item)}
                >
                  <Text style={[s.fbBtnText, item.feedback === 'up' && s.fbBtnTextOn]}>👍 有用</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.fbBtn, item.feedback === 'down' && s.fbBtnOn]}
                  onPress={() => rateFeedback(item.id, false, item)}
                >
                  <Text style={[s.fbBtnText, item.feedback === 'down' && s.fbBtnTextOn]}>👎 没用</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />

      <View style={s.quickRow}>
        {QUICK_QUESTIONS.map(q => (
          <TouchableOpacity
            key={q}
            style={[s.quickChip, { backgroundColor: theme.light, borderColor: theme.mid }]}
            onPress={() => sendMessage(q)}
          >
            <Text style={[s.quickText, { color: theme.primary }]}>{q}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.inputRow}>
          <TextInput
            style={[s.input, { borderColor: theme.mid }]}
            placeholder="输入健康问题…"
            placeholderTextColor="#aaa"
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: theme.primary, opacity: loading ? 0.6 : 1 }]}
            onPress={() => sendMessage(input)}
            disabled={loading}
          >
            <Text style={s.sendIcon}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1 },
  hdr:        { paddingTop: 16, paddingBottom: 18, paddingHorizontal: 16 },
  hdrTitle:   { color: '#fff', fontSize: 20, fontWeight: '600', marginBottom: 6 },
  badge:      { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText:  { color: '#fff', fontSize: 11 },
  bubble:     { maxWidth: '85%', borderRadius: 15, padding: 12 },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  aiBubble:   { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 0.5, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  localBadge: { alignSelf: 'flex-start', backgroundColor: '#e6f1fb', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4 },
  localBadgeText: { fontSize: 10, color: '#2a5d8f', fontWeight: '600' },
  kbBadge: { backgroundColor: '#e1f5ee' },
  kbBadgeText: { color: '#0f6e56' },
  safetyBadge: { backgroundColor: '#ffe0e3' },
  safetyBadgeText: { color: '#a32d2d' },
  fbRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  fbBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 0.5, borderColor: '#d5e3dd', backgroundColor: '#f7fbf9' },
  fbBtnOn: { backgroundColor: '#e1f5ee', borderColor: '#9fd4bd' },
  fbBtnText: { fontSize: 11, color: '#777' },
  fbBtnTextOn: { color: '#0f6e56', fontWeight: '600' },
  quickRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12, paddingBottom: 4 },
  quickChip:  { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 0.5 },
  quickText:  { fontSize: 12, fontWeight: '500' },
  inputRow:   { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#e0ede8' },
  input:      { flex: 1, borderWidth: 0.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#222', maxHeight: 100 },
  sendBtn:    { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sendIcon:   { color: '#fff', fontSize: 18, fontWeight: '600' },
});
