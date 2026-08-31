import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, SafeAreaView,
  Modal, TextInput,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { getUser, loadUser, saveUser } from '../services/userStore';
import { getCycleHistory, loadAll } from '../services/periodStore';

const SETTINGS = [
  { id: 'watch',        label: '健康数据授权', sub: 'Apple Watch 已连接', type: 'toggle' },
  { id: 'notification', label: '通知提醒',      sub: '', type: 'toggle' },
  { id: 'privacy',       label: '隐私与数据',    sub: '数据仅存本机', type: 'arrow' },
  { id: 'about',         label: '关于 Luna',    sub: 'v1.0.0', type: 'arrow' },
];

// 隐私与数据声明
const PRIVACY_TEXT = `· 数据本地存储：你的经期记录、症状与设置仅保存在本机（AsyncStorage），默认不上传任何服务器。
· 最小化收集：不收集姓名、身份证、手机号等可识别身份信息（昵称仅本机显示）。
· 数据用途：仅用于周期阶段推算、就医指标分析与就诊摘要生成，不做任何其他用途。
· 数据控制：可随时在「日历」删除任意一天的记录；卸载应用将清除本地数据。
· 云端（待接入）：若未来启用后端同步，需你的明确授权，并采用加密传输。
· 安全边界：Luna 是健康管理工具，不构成医疗诊断；重要健康问题请咨询医生。`;

// 关于 Luna 声明
const ABOUT_TEXT = `Luna v1.0.0 · 经期健康管理 + 就医衔接

· 基于 React Native 的本地优先应用，数据默认不出设备。
· 周期阶段推算：FIGO（国际妇产科联盟）标准 + 你的真实记录，透明可溯源。
· 就医指标：参考 FIGO AUB 分类系统（2011）与妇产科循证共识。
· AI 助手：数据类问题走本地规则引擎，开放问答走云端（可关闭/待后端代理）。

免责声明：本应用所有内容仅为健康科普参考，不构成医疗诊断、处方或治疗建议。
如出现剧烈腹痛、大量出血等紧急情况，请立即就医。`;

export default function ProfileScreen() {
  const { theme, changeTheme, presets } = useTheme();
  const [toggles, setToggles] = useState({ watch: true, notification: true });
  const [user, setUser] = useState(getUser());
  const [, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);

  // 编辑弹窗
  const [editVisible, setEditVisible] = useState(false);
  const [nickname, setNickname] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [avgCycle, setAvgCycle] = useState('28');

  // 信息弹窗（隐私 / 关于）
  const [infoType, setInfoType] = useState(null); // 'privacy' | 'about' | null

  useEffect(() => {
    loadUser().then(u => { setUser(u); });
    loadAll().then(() => refresh());
  }, []);

  const toggleSwitch = (id) => setToggles(prev => ({ ...prev, [id]: !prev[id] }));

  const openEdit = () => {
    setNickname(user.nickname || '');
    setBirthYear(user.birthYear ? String(user.birthYear) : '');
    setAvgCycle(String(user.avgCycle || 28));
    setEditVisible(true);
  };

  const saveProfile = async () => {
    await saveUser({
      nickname: nickname.trim(),
      birthYear: birthYear.trim() ? Number(birthYear.trim()) : '',
      avgCycle: Number(avgCycle) || 28,
    });
    setUser(getUser());
    setEditVisible(false);
  };

  const onSettingPress = (item) => {
    if (item.type !== 'arrow') return;
    setInfoType(item.id === 'privacy' ? 'privacy' : 'about');
  };

  const cycleCount = getCycleHistory().length;

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
          <Text style={s.userName}>{user.nickname || '未设置昵称'}</Text>
          <Text style={s.userSub}>
            周期平均 {user.avgCycle || 28} 天 · 已记录 {cycleCount} 个周期
            {user.birthYear ? ` · ${user.birthYear} 年生` : ''}
          </Text>
          <TouchableOpacity
            style={[s.editBtn, { borderColor: theme.mid, backgroundColor: theme.light }]}
            onPress={openEdit}
          >
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
            <TouchableOpacity
              key={item.id}
              style={[s.settingRow, i < SETTINGS.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: '#e0ede8' }]}
              onPress={() => onSettingPress(item)}
              activeOpacity={item.type === 'arrow' ? 0.6 : 1}
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
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* 编辑个人信息弹窗 */}
      <Modal transparent animationType="slide" visible={editVisible} onRequestClose={() => setEditVisible(false)}>
        <View style={s.modalRoot}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setEditVisible(false)} />
          <View style={[s.sheet, { borderTopColor: theme.mid }]}>
            <View style={s.handle} />
            <Text style={[s.sheetTitle, { color: theme.primary }]}>编辑个人信息</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.fieldLabel}>昵称</Text>
              <TextInput
                style={[s.input, { borderColor: theme.mid }]}
                placeholder="怎么称呼你？（仅本机显示）"
                placeholderTextColor="#aaa"
                value={nickname}
                onChangeText={setNickname}
              />
              <Text style={s.fieldLabel}>出生年份</Text>
              <TextInput
                style={[s.input, { borderColor: theme.mid }]}
                placeholder="如 2002"
                placeholderTextColor="#aaa"
                keyboardType="number-pad"
                value={birthYear}
                onChangeText={setBirthYear}
              />
              <Text style={s.fieldLabel}>平均周期（天）</Text>
              <TextInput
                style={[s.input, { borderColor: theme.mid }]}
                placeholder="如 28"
                placeholderTextColor="#aaa"
                keyboardType="number-pad"
                value={avgCycle}
                onChangeText={setAvgCycle}
              />
              <Text style={s.fieldTip}>平均周期仅用于推算参考，可随记录逐渐修正。</Text>
              <TouchableOpacity style={[s.saveBtn, { backgroundColor: theme.primary }]} onPress={saveProfile}>
                <Text style={s.saveBtnText}>保存</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 隐私 / 关于 信息弹窗 */}
      <Modal transparent animationType="fade" visible={infoType !== null} onRequestClose={() => setInfoType(null)}>
        <View style={s.modalRoot}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setInfoType(null)} />
          <View style={[s.sheet, { borderTopColor: theme.mid }]}>
            <View style={s.handle} />
            <Text style={[s.sheetTitle, { color: theme.primary }]}>
              {infoType === 'privacy' ? '隐私与数据' : '关于 Luna'}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.infoText}>
                {infoType === 'privacy' ? PRIVACY_TEXT : ABOUT_TEXT}
              </Text>
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: theme.light }]}
                onPress={() => setInfoType(null)}
              >
                <Text style={[s.saveBtnText, { color: theme.primary }]}>关闭</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  modalRoot:    { flex: 1, justifyContent: 'flex-end' },
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:        { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '80%' },
  handle:       { width: 34, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 14 },
  sheetTitle:   { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  fieldLabel:   { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 10 },
  input:        { borderWidth: 0.5, borderRadius: 9, padding: 10, fontSize: 14, color: '#222' },
  fieldTip:     { fontSize: 11, color: '#999', marginTop: 6, lineHeight: 16 },
  saveBtn:      { borderRadius: 13, padding: 13, alignItems: 'center', marginTop: 18 },
  saveBtnText:  { color: '#fff', fontSize: 15, fontWeight: '600' },
  infoText:     { fontSize: 13, color: '#444', lineHeight: 22 },
});
