import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, SafeAreaView } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const SETTINGS = [
  { id: 'watch',        label: '健康数据授权', sub: 'Apple Watch 已连接', type: 'toggle' },
  { id: 'notification', label: '通知提醒',      sub: '', type: 'toggle' },
  { id: 'privacy',       label: '隐私与数据',    sub: '', type: 'arrow' },
  { id: 'about',         label: '关于 Luna',    sub: 'v1.0.0', type: 'arrow' },
];

export default function ProfileScreen() {
  const { theme, changeTheme, presets } = useTheme();
  const [toggles, setToggles] = useState({ watch: true, notification: true });

  const toggleSwitch = (id) => setToggles(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: '#f0f7f4' }]}>
      <View style={[s.hdr, { backgroundColor: theme.primary }]}>
        <Text style={s.hdrTitle}>我的</Text>
      </View>

      <ScrollView style={s.scroll}>
        <View style={[s.card, { alignItems: 'center', paddingVertical: 22 }]}>
          <View style={[s.avatar, { backgroundColor: theme.light, borderColor: theme.primary }]}>
            <Text style={{ fontSize: 26 }}>👤</Text>
          </View>
          <Text style={s.userName}>用户昵称</Text>
          <Text style={s.userSub}>周期平均 28 天 · 已记录 6 个周期</Text>
          <TouchableOpacity style={[s.editBtn, { borderColor: theme.mid, backgroundColor: theme.light }]}>
            <Text style={[s.editBtnText, { color: theme.primary }]}>编辑个人信息</Text>
          </TouchableOpacity>
        </View>

        <View style={s.card}>
          <Text style={[s.ctitle, { color: theme.primary }]}>主题颜色</Text>
          <View style={s.colorRow}>
            {presets.map(p => (
              <TouchableOpacity
                key={p.id}
                onPress={() => changeTheme(p)}
                style={[
                  s.colorDot,
                  { backgroundColor: p.primary },
                  theme.id === p.id && s.colorDotActive,
                ]}
              />
            ))}
          </View>
          <Text style={s.themeLabel}>{theme.label}</Text>
        </View>

        <View style={s.card}>
          {SETTINGS.map((item, i) => (
            <View
              key={item.id}
              style={[s.settingRow, i < SETTINGS.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: '#e0ede8' }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.settingLabel}>{item.label}</Text>
                {item.sub ? <Text style={s.settingSub}>{item.sub}</Text> : null}
              </View>
              {item.type === 'toggle' ? (
                <Switch
                  value={toggles[item.id]}
                  onValueChange={() => toggleSwitch(item.id)}
                  trackColor={{ false: '#e0ede8', true: theme.primary }}
                  thumbColor="#fff"
                />
              ) : (
                <Text style={{ color: '#ccc', fontSize: 18 }}>›</Text>
              )}
            </View>
          ))}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1 },
  hdr:          { paddingTop: 16, paddingBottom: 22, paddingHorizontal: 16 },
  hdrTitle:     { color: '#fff', fontSize: 20, fontWeight: '600' },
  scroll:       { flex: 1, padding: 14 },
  card:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: '#e0ede8' },
  ctitle:       { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  avatar:       { width: 68, height: 68, borderRadius: 34, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  userName:     { fontSize: 16, fontWeight: '600', color: '#1a1a2e', marginBottom: 3 },
  userSub:      { fontSize: 12, color: '#888', marginBottom: 12 },
  editBtn:      { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 9, borderWidth: 0.5 },
  editBtnText:  { fontSize: 12, fontWeight: '500' },
  colorRow:     { flexDirection: 'row', gap: 10, marginBottom: 8 },
  colorDot:     { width: 26, height: 26, borderRadius: 13 },
  colorDotActive:{ borderWidth: 3, borderColor: '#1a1a2e' },
  themeLabel:   { fontSize: 12, color: '#888' },
  settingRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  settingLabel: { fontSize: 14, color: '#222' },
  settingSub:   { fontSize: 11, color: '#999', marginTop: 1 },
});
