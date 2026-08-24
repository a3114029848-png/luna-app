import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { chatStream } from '../services/api';
import { useTheme } from '../theme/ThemeContext';

const QUICK_QUESTIONS = ['痛经原因', '周期不规律怎么办', '黄体期情绪波动', '何时需要就医'];

const INIT_MSG = {
  id: '0', role: 'ai',
  text: '你好，我是 Luna AI 助手。我基于妇产科循证医学文献回答问题，但不替代医生诊断。有什么想了解的吗？',
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
    const aiMsg   = { id: (Date.now() + 1).toString(), role: 'ai', text: '' };

    setMessages(prev => [...prev, userMsg, aiMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));
      await chatStream([...history, { role: 'user', content: text }], (chunk) => {
        setMessages(prev => prev.map(m =>
          m.id === aiMsg.id ? { ...m, text: m.text + chunk } : m
        ));
      });
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === aiMsg.id ? { ...m, text: '网络异常，请稍后重试。' } : m
      ));
    } finally {
      setLoading(false);
    }
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
            <Text style={[s.bubbleText, { color: item.role === 'user' ? '#fff' : '#222' }]}>
              {item.text || (loading ? '…' : '')}
            </Text>
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
  quickRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12, paddingBottom: 4 },
  quickChip:  { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 0.5 },
  quickText:  { fontSize: 12, fontWeight: '500' },
  inputRow:   { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#e0ede8' },
  input:      { flex: 1, borderWidth: 0.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#222', maxHeight: 100 },
  sendBtn:    { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sendIcon:   { color: '#fff', fontSize: 18, fontWeight: '600' },
});
