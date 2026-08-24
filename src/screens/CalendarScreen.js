import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Modal, SafeAreaView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useTheme } from '../theme/ThemeContext';

const DAYS_CN = ['日', '一', '二', '三', '四', '五', '六'];

const DAY_TYPES = [
  { id: 'period',    label: '月经期', color: '#ffe0e3', text: '#a32d2d' },
  { id: 'ovulation', label: '排卵期', color: '#e1f5ee', text: '#0f6e56' },
  { id: 'luteal',    label: '黄体期', color: '#fff3e0', text: '#854f0b' },
  { id: 'normal',    label: '清除标记', color: '#fff',  text: '#333' },
];

export default function CalendarScreen() {
  const { theme } = useTheme();

  const today = new Date();
  const [curYear, setCurYear]   = useState(today.getFullYear());
  const [curMonth, setCurMonth] = useState(today.getMonth() + 1);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerYear, setPickerYear]       = useState(curYear);

  const [editVisible, setEditVisible] = useState(false);
  const [editDay, setEditDay]         = useState(null);
  const [editType, setEditType]       = useState('normal');
  const [flowVal, setFlowVal]         = useState(2);
  const [painVal, setPainVal]         = useState(0);

  // 实际项目：从 AsyncStorage / 后端读取，key格式 "y-m-d"
  const [dayData, setDayData] = useState({
    '2025-7-2': { type: 'period' }, '2025-7-3': { type: 'period' },
    '2025-7-4': { type: 'period' }, '2025-7-5': { type: 'period' },
    '2025-7-13': { type: 'ovulation' }, '2025-7-14': { type: 'ovulation' },
    '2025-7-19': { type: 'luteal' }, '2025-7-20': { type: 'luteal' },
    '2025-7-21': { type: 'luteal' }, '2025-7-22': { type: 'luteal' },
  });

  const key = (y, m, d) => `${y}-${m}-${d}`;
  const firstDay = new Date(curYear, curMonth - 1, 1).getDay();
  const daysInMonth = new Date(curYear, curMonth, 0).getDate();
  const todayKey = key(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const shiftMonth = (delta) => {
    let m = curMonth + delta, y = curYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    setCurMonth(m); setCurYear(y);
  };

  const openPicker = () => { setPickerYear(curYear); setPickerVisible(true); };

  const jumpToMonth = (m) => {
    setCurYear(pickerYear); setCurMonth(m);
    setPickerVisible(false);
  };

  const openEdit = (day) => {
    setEditDay(day);
    const data = dayData[key(curYear, curMonth, day)];
    setEditType(data?.type || 'normal');
    setFlowVal(data?.flow ?? 2);
    setPainVal(data?.pain ?? 0);
    setEditVisible(true);
  };

  const saveEdit = () => {
    const k = key(curYear, curMonth, editDay);
    setDayData(prev => {
      const next = { ...prev };
      if (editType === 'normal') delete next[k];
      else next[k] = { type: editType, flow: flowVal, pain: painVal };
      return next;
    });
    setEditVisible(false);
  };

  const getCellStyle = (day) => {
    const data = dayData[key(curYear, curMonth, day)];
    if (!data) return {};
    const t = DAY_TYPES.find(x => x.id === data.type) || DAY_TYPES[3];
    return { backgroundColor: t.color };
  };
  const getCellTextColor = (day) => {
    const data = dayData[key(curYear, curMonth, day)];
    if (!data) return '#222';
    const t = DAY_TYPES.find(x => x.id === data.type) || DAY_TYPES[3];
    return t.text;
  };

  // 本月客观统计（不做正常/异常判断）
  const monthStats = () => {
    let periodDays = 0, recorded = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const data = dayData[key(curYear, curMonth, d)];
      if (data) { recorded++; if (data.type === 'period') periodDays++; }
    }
    return { periodDays, recorded };
  };
  const { periodDays, recorded } = monthStats();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: '#f0f7f4' }]}>
      <View style={[s.hdr, { backgroundColor: theme.primary }]}>
        <Text style={s.hdrTitle}>日历</Text>
        <Text style={s.hdrSub}>点击年月可快速跳转，点击日期可编辑</Text>
      </View>

      <ScrollView style={s.scroll}>
        <View style={s.card}>
          <View style={s.navRow}>
            <TouchableOpacity style={[s.ymBtn, { backgroundColor: theme.light }]} onPress={openPicker}>
              <Text style={s.ymText}>{curYear}年 {curMonth}月</Text>
              <Text style={{ color: theme.primary, fontSize: 12 }}>▾</Text>
            </TouchableOpacity>
            <View style={s.arrBtns}>
              <TouchableOpacity style={[s.arrBtn, { backgroundColor: theme.light }]} onPress={() => shiftMonth(-1)}>
                <Text style={{ color: theme.primary, fontSize: 16 }}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.arrBtn, { backgroundColor: theme.light }]} onPress={() => shiftMonth(1)}>
                <Text style={{ color: theme.primary, fontSize: 16 }}>›</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.wkRow}>
            {DAYS_CN.map(d => <Text key={d} style={s.wkLbl}>{d}</Text>)}
          </View>

          <View style={s.daysGrid}>
            {cells.map((day, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  s.dayCell,
                  day ? getCellStyle(day) : { opacity: 0 },
                  day && key(curYear, curMonth, day) === todayKey && { borderWidth: 2, borderColor: theme.primary },
                ]}
                onPress={() => day && openEdit(day)}
                disabled={!day}
              >
                <Text style={{ fontSize: 13, color: day ? getCellTextColor(day) : 'transparent' }}>
                  {day || 0}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.legend}>
            {DAY_TYPES.slice(0, 3).map(t => (
              <View key={t.id} style={s.legItem}>
                <View style={[s.legDot, { backgroundColor: t.color }]} />
                <Text style={s.legLabel}>{t.label}</Text>
              </View>
            ))}
            <View style={s.legItem}>
              <View style={[s.legDot, { borderWidth: 1.5, borderColor: theme.primary }]} />
              <Text style={s.legLabel}>今天</Text>
            </View>
          </View>
        </View>

        {/* 本月记录 - 仅客观数据，不做判断 */}
        <View style={s.card}>
          <Text style={[s.ctitle, { color: theme.primary }]}>本月记录</Text>
          <View style={s.statsRow}>
            <View style={[s.statCard, { backgroundColor: theme.light }]}>
              <Text style={[s.statVal, { color: theme.primary }]}>{periodDays}</Text>
              <Text style={s.statLbl}>经期天数</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: theme.light }]}>
              <Text style={[s.statVal, { color: theme.primary }]}>{recorded}</Text>
              <Text style={s.statLbl}>已记录天数</Text>
            </View>
          </View>
          <View style={{ marginTop: 10 }}>
            {periodDays > 0 && (
              <View style={s.factRow}>
                <View style={[s.factDot, { backgroundColor: '#e63946' }]} />
                <Text style={s.factText}>本月记录月经期 {periodDays} 天</Text>
              </View>
            )}
            {recorded === 0 && (
              <View style={s.factRow}>
                <View style={[s.factDot, { backgroundColor: '#ccc' }]} />
                <Text style={s.factText}>本月暂无记录，点击日期可添加</Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* 年月选择器 */}
      <Modal transparent animationType="slide" visible={pickerVisible} onRequestClose={() => setPickerVisible(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setPickerVisible(false)} />
        <View style={s.pickerSheet}>
          <View style={s.handle} />
          <Text style={s.pickerTitle}>选择年月</Text>
          <View style={s.yearRow}>
            <View style={s.yearNav}>
              <TouchableOpacity style={[s.yearBtn, { backgroundColor: theme.light }]} onPress={() => setPickerYear(y => y - 1)}>
                <Text style={{ color: theme.primary, fontSize: 16 }}>‹</Text>
              </TouchableOpacity>
              <Text style={s.yearNum}>{pickerYear}</Text>
              <TouchableOpacity style={[s.yearBtn, { backgroundColor: theme.light }]} onPress={() => setPickerYear(y => y + 1)}>
                <Text style={{ color: theme.primary, fontSize: 16 }}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.monthsGrid}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
              const isCur = pickerYear === curYear && m === curMonth;
              const isToday = pickerYear === today.getFullYear() && m === today.getMonth() + 1;
              return (
                <TouchableOpacity
                  key={m}
                  style={[
                    s.moBtn,
                    isCur && { backgroundColor: theme.primary, borderColor: theme.primary },
                    !isCur && isToday && { borderColor: theme.primary },
                  ]}
                  onPress={() => jumpToMonth(m)}
                >
                  <Text style={[s.moText, isCur && { color: '#fff', fontWeight: '600' }, !isCur && isToday && { color: theme.primary }]}>
                    {m}月
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* 日编辑面板 */}
      <Modal transparent animationType="slide" visible={editVisible} onRequestClose={() => setEditVisible(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setEditVisible(false)} />
        <View style={s.editSheet}>
          <View style={s.handle} />
          <Text style={[s.editTitle, { color: theme.primary }]}>
            编辑 {curYear}/{curMonth}/{editDay}
          </Text>

          <Text style={s.sectionLabel}>周期阶段</Text>
          <View style={s.typeRow}>
            {DAY_TYPES.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[
                  s.typeChip,
                  { backgroundColor: t.color, borderColor: t.text + '55' },
                  editType === t.id && { borderColor: t.text, borderWidth: 2 },
                ]}
                onPress={() => setEditType(t.id)}
              >
                <Text style={[s.typeChipText, { color: t.text }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {editType === 'period' && (
            <>
              <Text style={s.sectionLabel}>经血量：{['无', '点滴', '少量', '适中', '偏多'][flowVal]}</Text>
              <Slider
                style={{ width: '100%' }}
                minimumValue={0} maximumValue={4} step={1}
                value={flowVal}
                minimumTrackTintColor={theme.primary}
                thumbTintColor={theme.primary}
                onValueChange={setFlowVal}
              />
            </>
          )}

          <Text style={s.sectionLabel}>腹痛程度：{['无', '轻微', '中度', '较重', '剧烈'][painVal]}</Text>
          <Slider
            style={{ width: '100%' }}
            minimumValue={0} maximumValue={4} step={1}
            value={painVal}
            minimumTrackTintColor={theme.primary}
            thumbTintColor={theme.primary}
            onValueChange={setPainVal}
          />

          <TouchableOpacity style={[s.saveBtn, { backgroundColor: theme.primary }]} onPress={saveEdit}>
            <Text style={s.saveBtnText}>保存</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1 },
  hdr:         { paddingTop: 16, paddingBottom: 22, paddingHorizontal: 16 },
  hdrTitle:    { color: '#fff', fontSize: 20, fontWeight: '600' },
  hdrSub:      { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 2 },
  scroll:      { flex: 1, padding: 14 },
  card:        { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: '#e0ede8' },
  ctitle:      { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  navRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  ymBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9 },
  ymText:      { fontSize: 15, fontWeight: '500', color: '#1a1a2e' },
  arrBtns:     { flexDirection: 'row', gap: 6 },
  arrBtn:      { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  wkRow:       { flexDirection: 'row', marginBottom: 3 },
  wkLbl:       { flex: 1, textAlign: 'center', fontSize: 11, color: '#999', fontWeight: '500', paddingVertical: 3 },
  daysGrid:    { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell:     { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, marginBottom: 2 },
  legend:      { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  legItem:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legDot:      { width: 11, height: 11, borderRadius: 3 },
  legLabel:    { fontSize: 11, color: '#555' },
  statsRow:    { flexDirection: 'row', gap: 8 },
  statCard:    { flex: 1, borderRadius: 9, padding: 10, alignItems: 'center' },
  statVal:     { fontSize: 21, fontWeight: '500' },
  statLbl:     { fontSize: 11, color: '#888', marginTop: 2 },
  factRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 6 },
  factDot:     { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  factText:    { fontSize: 13, color: '#444', lineHeight: 20 },
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18 },
  handle:      { width: 34, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 14 },
  pickerTitle: { fontSize: 15, fontWeight: '500', color: '#1a1a2e', marginBottom: 14 },
  yearRow:     { flexDirection: 'row', justifyContent: 'center', marginBottom: 14 },
  yearNav:     { flexDirection: 'row', alignItems: 'center', gap: 16 },
  yearBtn:     { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  yearNum:     { fontSize: 17, fontWeight: '500', color: '#1a1a2e' },
  monthsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  moBtn:       { width: '22.5%', paddingVertical: 10, borderRadius: 9, alignItems: 'center', borderWidth: 0.5, borderColor: '#e0ede8', backgroundColor: '#fff' },
  moText:      { fontSize: 13, color: '#333' },
  editSheet:   { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18 },
  editTitle:   { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  sectionLabel:{ fontSize: 13, color: '#555', marginBottom: 4, marginTop: 10 },
  typeRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip:    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  typeChipText:{ fontSize: 13, fontWeight: '500' },
  saveBtn:     { borderRadius: 13, padding: 13, alignItems: 'center', marginTop: 18 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
