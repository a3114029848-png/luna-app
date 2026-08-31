import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import RecordBottomSheet from '../components/RecordBottomSheet';
import { getCycleProgress, calcAverageCycle, getPhaseForDate } from '../utils/cycleCalculator';
import { getCycleHistory, saveDayRecord, fmtKeyFromCN, loadAll } from '../services/periodStore';
import { consumeOpenRecord } from '../services/uiBridge';

const DAY_MS = 1000 * 60 * 60 * 24;

const PHASES = [
  { id: 'period',     label: '月经期', color: '#e63946', bg: '#ffe0e3' },
  { id: 'follicular', label: '卵泡期', color: '#457b9d', bg: '#e6f1fb' },
  { id: 'ovulation',  label: '排卵期', color: '#2a9d8f', bg: '#e1f5ee' },
  { id: 'luteal',     label: '黄体期', color: '#f4a261', bg: '#fff3e0' },
];

// 今日提示：由「当前阶段」派生（基于真实经期记录推算），不编造体温等不存在的数据
const PHASE_TIPS = {
  period:     '你正处于月经期（实测）。建议记录经血量、腹痛与血块情况，帮助观察本次经期是否正常。',
  follicular: '你正处于卵泡期。此阶段精力通常较充沛，适合安排运动与重要事项，也可为下一周期做准备。',
  ovulation:  '你正处于排卵期（推测）。此阶段为易孕期，如有备孕或避孕需求请注意。',
  luteal:     '你正处于黄体期。部分人会出现经前情绪波动或乳房胀痛，可在记录里随手记下趋势，便于就医时参考。',
  predicted:  '按你的周期规律，预计近期可能来潮。留意身体信号，来潮后记得在「日历」标记或在「今日」记录。',
};

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
  const [, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);

  // 数据持久化闭环：聚焦时加载统一存储层并刷新（记录/日历编辑后切回本页能看到最新阶段）
  useFocusEffect(useCallback(() => {
    loadAll().then(refresh);
    // 跨页引导：日历请求「打开今日完整记录弹窗」→ 本页聚焦时消费并打开
    if (consumeOpenRecord()) setSheetVisible(true);
  }, []));

  const today = new Date();
  const today0 = new Date(); today0.setHours(0, 0, 0, 0); // 当天 00:00，用于精确推算
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  // 从统一存储层读取真实经期记录，推算阶段（不再硬编码）
  const history = getCycleHistory();
  const avgCycle = calcAverageCycle(history);
  const last = history[history.length - 1];
  const lastStart = last ? new Date(last.startDate + 'T00:00:00') : null;
  const periodDuration = last
    ? Math.round((new Date(last.endDate + 'T00:00:00') - lastStart) / DAY_MS) + 1
    : 5;
  const dayOfCycle = lastStart ? Math.round((today0 - lastStart) / DAY_MS) + 1 : 0;
  const phaseId = lastStart ? getPhaseForDate(today0, lastStart, periodDuration, avgCycle) : null;
  const currentPhase = PHASES.find(p => p.id === phaseId) || PHASES[0];
  const daysLeft = Math.max(avgCycle - dayOfCycle, 0);
  const progress = dayOfCycle > 0 ? getCycleProgress(dayOfCycle, avgCycle) : 0;

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
          {last ? (
            <>
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
            </>
          ) : (
            <View style={{ paddingVertical: 8 }}>
              <Text style={{ fontSize: 14, color: '#555', lineHeight: 22 }}>
                还没有经期记录。点击下方「记录今日症状」，标记「经期出血」即可开始推算你的周期阶段。
              </Text>
            </View>
          )}
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

        {/* 今日提示：由当前阶段派生（真实记录推算，不编造体温等假数据） */}
        <View style={[s.alertCard, { borderLeftColor: theme.primary }]}>
          <Text style={[s.alertTitle, { color: theme.primary }]}>💡 今日提示</Text>
          <Text style={s.alertText}>
            {last
              ? (PHASE_TIPS[phaseId] || PHASE_TIPS.follicular)
              : '还没有经期记录。点击「记录今日症状」标记「经期出血」，Luna 会基于你的真实记录推算周期并给出每日提示。'}
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
          // 数据持久化闭环：写入统一存储层（AsyncStorage），刷新不丢
          const patch = {
            date: fmtKeyFromCN(data.date),
            ...(data.values || {}),
          };
          // 出血类型 → 日历标记的事实分层：
          //   经期出血 → 月经期（period）；异常出血（经间期/性交后）→ 橙色 abnormal 标记，
          //   且清掉日历可能标过的 period（异常出血不算经期，避免污染周期推算）
          const b = data.values?.bleed_type;
          if (b === '经期出血') {
            patch.type = 'period';
            patch.abnormal = undefined;      // 清异常标记
          } else if (b === '经间期出血') {
            patch.abnormal = 'imb';          // 异常出血标记（日历橙色）
            patch.type = undefined;          // 清 period（saveDayRecord 删除 undefined 键）
          } else if (b === '性交后出血') {
            patch.abnormal = 'postcoital';
            patch.type = undefined;
          } else if (b === '无出血') {
            patch.abnormal = undefined;      // 明确无异常 → 清异常标记
            patch.type = undefined;          // 明确今天没来月经 → 清经期标记（日历红色消失）
          }
          saveDayRecord(patch).then(refresh);
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
