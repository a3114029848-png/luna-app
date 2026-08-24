import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, Alert,
} from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { FIGO, MEDICAL_INDICATORS, ALERT_STYLES } from '../constants/medicalThresholds';
import { checkAlerts } from '../utils/cycleCalculator';

// 模拟近三期数据（实际项目从后端 / AsyncStorage 读取）
const CYCLE_DATA = [
  { label: '第1期', cycleDays: 29, periodDays: 5, flowLevel: 2 },
  { label: '第2期', cycleDays: 27, periodDays: 6, flowLevel: 3 },
  { label: '第3期', cycleDays: 31, periodDays: 5, flowLevel: 1 },
];

const FLOW_LABELS = ['无', '点滴', '少量', '适中', '偏多'];
const FLOW_RATIOS = [0, 0.25, 0.45, 0.65, 0.85];

// 就医指标近三期趋势模拟数据（实际来自 RecordBottomSheet 保存的记录）
const INDICATOR_TRENDS = {
  pain:          [0, 1, 0],
  clot:          [0, 2, 1],
  imb:           [0, 0, 1],
  breast:        [1, 1, 1],
  temp_biphasic: [true, true, true],
  mood:          [0, 2, 3],
};

function LineChart({ data, yMin, yMax, color, width = 300, height = 110, warnLine }) {
  const padL = 34, padB = 22, padT = 14, padR = 14;
  const W = width - padL - padR;
  const H = height - padT - padB;
  const n = data.length;

  const xPos = i => padL + (i / (n - 1)) * W;
  const yPos = v => padT + H - ((v - yMin) / (yMax - yMin)) * H;

  const points = data.map((d, i) => `${xPos(i)},${yPos(d.val)}`).join(' ');

  return (
    <Svg width={width} height={height}>
      {[yMin, Math.round((yMin + yMax) / 2), yMax].map(v => (
        <Line key={v} x1={padL} y1={yPos(v)} x2={width - padR} y2={yPos(v)}
          stroke="#e0ede8" strokeWidth="1" strokeDasharray="4,4" />
      ))}
      {warnLine != null && (
        <Line x1={padL} y1={yPos(warnLine)} x2={width - padR} y2={yPos(warnLine)}
          stroke="#e63946" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
      )}
      {[yMin, yMax].map(v => (
        <SvgText key={v} x={padL - 4} y={yPos(v) + 4} textAnchor="end" fontSize="10" fill="#9bb">{v}</SvgText>
      ))}
      <Polyline points={points} fill="none" stroke={color} strokeWidth="2.5" />
      {data.map((d, i) => (
        <React.Fragment key={i}>
          <Circle cx={xPos(i)} cy={yPos(d.val)} r="4" fill={color} />
          <SvgText x={xPos(i)} y={yPos(d.val) - 8} textAnchor="middle" fontSize="11" fill={color} fontWeight="bold">
            {d.val}{d.unit || ''}
          </SvgText>
          <SvgText x={xPos(i)} y={height - 4} textAnchor="middle" fontSize="10" fill="#999">{d.label}</SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
}

function FlowBarChart({ data, theme }) {
  return (
    <View style={{ marginVertical: 4 }}>
      {data.map((d, i) => (
        <View key={i} style={s.flowRow}>
          <Text style={s.flowLabel}>{d.label}</Text>
          <View style={s.flowBarBg}>
            <View style={[s.flowBarFill, {
              width: `${FLOW_RATIOS[d.flowLevel] * 100}%`,
              backgroundColor: d.flowLevel >= 4 ? '#e63946' : theme.primary,
            }]} />
          </View>
          <Text style={s.flowVal}>{FLOW_LABELS[d.flowLevel]}</Text>
        </View>
      ))}
    </View>
  );
}

function IndicatorRow({ config, trend }) {
  const level = config.alertLevel(trend);
  const style = ALERT_STYLES[level];

  const trendDots = trend.map((v, i) => {
    const isLast = i === trend.length - 1;
    let color = '#c8e0d8';
    if (typeof v === 'boolean') color = v ? '#1a6b5a' : '#e63946';
    else if (v >= 3) color = '#e63946';
    else if (v >= 1) color = '#f4a261';
    return <View key={i} style={[s.trendDot, { backgroundColor: color, width: isLast ? 28 : 20 }]} />;
  });

  return (
    <View style={s.indRow}>
      <View style={[s.indIcon, { backgroundColor: style.bg }]}>
        <Text style={{ fontSize: 14 }}>●</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={s.indName}>{config.label}</Text>
          <View style={[s.badge, { backgroundColor: style.bg }]}>
            <Text style={[s.badgeText, { color: style.text }]}>{style.label}</Text>
          </View>
        </View>
        <View style={s.trendRow}>
          {trendDots}
        </View>
        {config.note && level !== 'normal' && (
          <Text style={s.indDesc}>{config.note}</Text>
        )}
      </View>
    </View>
  );
}

export default function ObservationScreen() {
  const { theme } = useTheme();
  const [tab, setTab] = useState(0);

  const cycleChartData  = CYCLE_DATA.map(d => ({ val: d.cycleDays, label: d.label }));
  const periodChartData = CYCLE_DATA.map(d => ({ val: d.periodDays, label: d.label }));

  const cycleLengths = CYCLE_DATA.map(d => d.cycleDays);
  const alerts = checkAlerts(cycleLengths);
  const avgCycle = Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length);

  const handleExport = () => {
    Alert.alert('导出复诊报告', '报告将包含近三期周期数据及就医指标汇总，是否生成 PDF？', [
      { text: '取消', style: 'cancel' },
      { text: '确认导出', onPress: () => console.log('export triggered') },
    ]);
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: '#f0f7f4' }]}>
      <View style={[s.hdr, { backgroundColor: theme.primary }]}>
        <Text style={s.hdrTitle}>观察</Text>
        <Text style={s.hdrSub}>近三期周期综合对比 · 就医指标追踪</Text>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.tabs}>
          {['3 期对比', '6 期趋势'].map((label, i) => (
            <TouchableOpacity
              key={i}
              style={[s.tabBtn, tab === i && { backgroundColor: theme.primary, borderColor: theme.primary }]}
              onPress={() => setTab(i)}
            >
              <Text style={[s.tabText, tab === i && { color: '#fff' }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ① 月经周期长度 */}
        <View style={s.card}>
          <Text style={[s.ctitle, { color: theme.primary }]}>月经周期长度（天）</Text>
          <LineChart data={cycleChartData} yMin={20} yMax={40} color={theme.primary} warnLine={FIGO.CYCLE_MAX} />
          <View style={[s.rangeTip, { backgroundColor: theme.light }]}>
            <Text style={[s.rangeTipText, { color: theme.primary }]}>
              FIGO 正常范围：{FIGO.CYCLE_MIN}–{FIGO.CYCLE_MAX} 天，本期平均 {avgCycle} 天
            </Text>
          </View>
          {alerts.map((a, i) => (
            <View key={i} style={[s.rangeTip, { backgroundColor: a.type === 'danger' ? '#ffe0e3' : '#fff3e0', marginTop: 6 }]}>
              <Text style={{ fontSize: 12, color: a.type === 'danger' ? '#a32d2d' : '#854f0b' }}>{a.message}</Text>
            </View>
          ))}
        </View>

        {/* ② 经血量对比 */}
        <View style={s.card}>
          <Text style={[s.ctitle, { color: theme.primary }]}>经血量对比（用户自评）</Text>
          <FlowBarChart data={CYCLE_DATA} theme={theme} />
          <View style={[s.rangeTip, { backgroundColor: '#f0f7f4' }]}>
            <Text style={{ fontSize: 12, color: '#666' }}>
              经血量为主观自评，无绝对量化标准，建议关注趋势变化而非单次数值
            </Text>
          </View>
        </View>

        {/* ③ 经期持续时长 */}
        <View style={s.card}>
          <Text style={[s.ctitle, { color: theme.primary }]}>经期持续时长（天）</Text>
          <LineChart data={periodChartData} yMin={0} yMax={10} color="#f4a261" warnLine={FIGO.DURATION_MAX} />
          <View style={[s.rangeTip, { backgroundColor: '#fff3e0' }]}>
            <Text style={{ fontSize: 12, color: '#854f0b' }}>
              FIGO 正常范围：≤{FIGO.DURATION_MAX} 天
            </Text>
          </View>
        </View>

        {/* ④ 就医指标追踪 */}
        <View style={s.card}>
          <Text style={[s.ctitle, { color: theme.primary }]}>就医关键指标 · 近三期变化</Text>
          {MEDICAL_INDICATORS.map(config => (
            <IndicatorRow
              key={config.id}
              config={config}
              trend={INDICATOR_TRENDS[config.id] || []}
            />
          ))}
        </View>

        {/* ⑤ 导出复诊报告 */}
        <View style={s.card}>
          <Text style={[s.ctitle, { color: theme.primary }]}>生成复诊报告</Text>
          <Text style={s.exportDesc}>
            报告包含近三期周期数据、经血量、持续时长及就医指标汇总，可直接交给医生参考。
          </Text>
          <TouchableOpacity style={[s.exportBtn, { borderColor: theme.mid }]} onPress={handleExport}>
            <Text style={[s.exportBtnText, { color: theme.primary }]}>↓  导出 PDF 复诊报告</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1 },
  hdr:         { paddingTop: 16, paddingBottom: 20, paddingHorizontal: 16 },
  hdrTitle:    { color: '#fff', fontSize: 20, fontWeight: '600' },
  hdrSub:      { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 2 },
  scroll:      { flex: 1, padding: 14 },
  tabs:        { flexDirection: 'row', gap: 6, marginBottom: 10 },
  tabBtn:      { flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: 'center', borderWidth: 0.5, borderColor: '#e0ede8', backgroundColor: '#f0f7f4' },
  tabText:     { fontSize: 12, fontWeight: '500', color: '#888' },
  card:        { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: '#e0ede8' },
  ctitle:      { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
  rangeTip:    { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  rangeTipText:{ fontSize: 12 },
  flowRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  flowLabel:   { fontSize: 11, color: '#888', width: 34 },
  flowBarBg:   { flex: 1, height: 12, backgroundColor: '#f0f7f4', borderRadius: 5, overflow: 'hidden' },
  flowBarFill: { height: 12, borderRadius: 5 },
  flowVal:     { fontSize: 11, color: '#1a6b5a', width: 34, fontWeight: '500' },
  indRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#f0f7f4' },
  indIcon:     { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  indName:     { fontSize: 13, fontWeight: '500', color: '#222' },
  badge:       { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
  badgeText:   { fontSize: 10, fontWeight: '500' },
  trendRow:    { flexDirection: 'row', gap: 4, marginTop: 6, alignItems: 'center' },
  trendDot:    { height: 8, borderRadius: 3 },
  indDesc:     { fontSize: 11, color: '#888', marginTop: 4, lineHeight: 16 },
  exportDesc:  { fontSize: 12, color: '#888', lineHeight: 18, marginBottom: 10 },
  exportBtn:   { borderWidth: 0.5, borderRadius: 11, padding: 12, alignItems: 'center' },
  exportBtnText:{ fontSize: 13, fontWeight: '500' },
});
