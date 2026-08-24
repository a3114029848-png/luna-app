import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import RecordBottomSheet from '../components/RecordBottomSheet';
import { getCycleProgress } from '../utils/cycleCalculator';

const PHASES = [
  { id: 'period',     label: '月经期', color: '#e63946', bg: '#ffe0e3' },
  { id: 'follicular', label: '卵泡期', color: '#457b9d', bg: '#e6f1fb' },
  { id: 'ovulation',  label: '排卵期', color: '#2a9d8f', bg: '#e1f5ee' },
  { id: 'luteal',     label: '黄体期', color: '#f4a261', bg: '#fff3e0' },
];

// 模拟穿戴设备数据（实际项目从 HealthKit / HUAWEI Health Kit 获取）
const WEARABLE = {
  temperature: '36.8°',
  heartRate:   '72 bpm',
  sleep:       '6.5 h',
  hrv:         '42 ms',
};
//https://github.com/a3114029848-png/luna-app.git
export default function HomeScreen() {
  const { theme } = useTheme();
  const [sheetVisible, setSheetVisible] = useState(false);

  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const dayOfCycle   = 18;   // 实际从 AsyncStorage/后端读取
  const currentPhase = PHASES[3];
  const avgCycle     = 29;
  const daysLeft     = avgCycle - dayOfCycle;
  const progress     = getCycleProgress(dayOfCycle, avgCycle);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: '#f0f7f4' }]}>
      <View style={[s.hdr, { backgroundColor: theme.primary }]}>
        <Text style={s.hdrDate}>{dateStr}</Text>
        <Text style={s.hdrTitle}>今日状态</Text>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* 当前阶段卡片 */}
        <View style={s.card}>
          <Text style={[s.ctitle, { color: theme.primary }]}>当前阶段</Text>
          <View style={[s.phaseBadge, { backgroundColor: currentPhase.bg }]}>
            <View style={[s.phaseDot, { backgroundColor: currentPhase.color }]} />
            <Text style={[s.phaseLabel, { color: currentPhase.color }]}>{currentPhase.label}</Text>
          </View>
          <View style={s.dayRow}>
            <Text style={s.dayNum}>{dayOfCycle}</Text>
            <Text style={s.dayUnit}>天</Text>
          </View>
          <Text style={s.dayDesc}>
            本周期第 {dayOfCycle} 天 · 预计 {daysLeft} 天后来潮（均值 {avgCycle} 天）
          </Text>
          {/* 进度条 */}
          <View style={s.barBg}>
            <View style={[s.barFill, { width: `${progress * 100}%`, backgroundColor: theme.primary }]} />
          </View>
          <View style={s.barLabels}>
            {PHASES.map(p => (
              <Text key={p.id} style={[s.barLabel, { color: p.color }]}>{p.label}</Text>
            ))}
          </View>
        </View>

        {/* 穿戴数据卡片 */}
        <View style={s.card}>
          <Text style={[s.ctitle, { color: theme.primary }]}>穿戴设备数据</Text>
          <View style={s.statsGrid}>
            {[
              { val: WEARABLE.temperature, lbl: '基础体温' },
              { val: WEARABLE.heartRate,   lbl: '静息心率' },
              { val: WEARABLE.sleep,       lbl: '睡眠时长' },
              { val: WEARABLE.hrv,         lbl: 'HRV' },
            ].map(({ val, lbl }) => (
              <View key={lbl} style={[s.statCard, { backgroundColor: theme.light }]}>
                <Text style={[s.statVal, { color: theme.primary }]}>{val}</Text>
                <Text style={s.statLbl}>{lbl}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 今日提示 */}
        <View style={[s.alertCard, { borderLeftColor: theme.primary }]}>
          <Text style={[s.alertTitle, { color: theme.primary }]}>💡 今日提示</Text>
          <Text style={s.alertText}>
            黄体期体温较前两日下降 0.2°C，注意观察是否出现经前症状。
          </Text>
        </View>

        {/* 记录按钮 */}
        <TouchableOpacity
          style={[s.recBtn, { backgroundColor: theme.primary }]}
          onPress={() => setSheetVisible(true)}
        >
          <Text style={s.recBtnText}>＋  记录今日症状</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>

      <RecordBottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSave={(data) => {
          console.log('record saved:', data);
          // TODO: 调用 api.saveRecord(data) 存储到后端
        }}
        date={dateStr}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1 },
  hdr:        { paddingTop: 16, paddingBottom: 24, paddingHorizontal: 16 },
  hdrDate:    { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 4 },
  hdrTitle:   { color: '#fff', fontSize: 20, fontWeight: '600' },
  scroll:     { flex: 1, padding: 14 },
  card:       { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: '#e0ede8' },
  ctitle:     { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  phaseBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, marginBottom: 10 },
  phaseDot:   { width: 8, height: 8, borderRadius: 4 },
  phaseLabel: { fontSize: 13, fontWeight: '500' },
  dayRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 4 },
  dayNum:     { fontSize: 46, fontWeight: '500', color: '#1a1a2e', lineHeight: 54 },
  dayUnit:    { fontSize: 14, color: '#666' },
  dayDesc:    { fontSize: 13, color: '#888', marginBottom: 14 },
  barBg:      { height: 7, backgroundColor: '#e0ede8', borderRadius: 4, overflow: 'hidden', marginBottom: 5 },
  barFill:    { height: 7, borderRadius: 4 },
  barLabels:  { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel:   { fontSize: 9 },
  statsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  statCard:   { flex: 1, minWidth: '45%', borderRadius: 9, padding: 10, alignItems: 'center' },
  statVal:    { fontSize: 20, fontWeight: '500' },
  statLbl:    { fontSize: 11, color: '#888', marginTop: 2 },
  alertCard:  { backgroundColor: '#fff', borderRadius: 11, padding: 13, marginBottom: 10, borderLeftWidth: 3, borderWidth: 0.5, borderColor: '#e0ede8' },
  alertTitle: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  alertText:  { fontSize: 13, color: '#555', lineHeight: 20 },
  recBtn:     { borderRadius: 13, padding: 14, alignItems: 'center', marginTop: 4 },
  recBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
