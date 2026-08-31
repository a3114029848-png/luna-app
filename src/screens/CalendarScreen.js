import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Modal, SafeAreaView, Image, TextInput,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { launchImageLibrary } from 'react-native-image-picker';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { getAllDayRecords, getCycleHistory, loadAll, saveDayRecord, removeDayRecord } from '../services/periodStore';
import { calcAverageCycle, getMonthPhaseMap } from '../utils/cycleCalculator';
import { requestOpenRecord } from '../services/uiBridge';

const DAYS_CN = ['日', '一', '二', '三', '四', '五', '六'];

// 渲染映射（含历史数据兼容：ovulation/luteal 是旧版手动标记，保留显示色）
const DAY_TYPES = [
  { id: 'period',    label: '月经期',   color: '#ffe0e3', text: '#a32d2d' },
  { id: 'abnormal',  label: '异常出血', color: '#ffe8cc', text: '#a05e03' },
  { id: 'ovulation', label: '排卵期',   color: '#e1f5ee', text: '#0f6e56' },
  { id: 'luteal',    label: '黄体期',   color: '#fff3e0', text: '#854f0b' },
  { id: 'normal',    label: '清除标记', color: '#fff',    text: '#333' },
];

// 手动可标记的「事实」类型（排卵/黄体由算法自动推算，不再提供手动标记）
const EDIT_TYPES = [
  { id: 'period',   label: '月经期',   color: '#ffe0e3', text: '#a32d2d' },
  { id: 'abnormal', label: '异常出血', color: '#ffe8cc', text: '#a05e03' },
  { id: 'normal',   label: '清除标记', color: '#fff',    text: '#333' },
];

// 算法自动阶段的浅色圆点
const AUTO_DOT_COLOR = { ovulation: '#2a9d8f', luteal: '#f4a261' };

export default function CalendarScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();

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
  const [clotVal, setClotVal]         = useState(null);
  const [moodVal, setMoodVal]         = useState(2);
  const [noteVal, setNoteVal]         = useState('');
  const [images, setImages]           = useState([]);

  // 数据持久化闭环：聚焦时加载并刷新（今日/观察记录后切回本页能看到最新标记）
  const [, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  useFocusEffect(useCallback(() => { loadAll().then(refresh); }, []));
  const dayData = getAllDayRecords();
  // 算法推算：整月每日阶段（排卵/黄体/预测经期），与用户手动标记分离
  const history = getCycleHistory();
  const avgCycle = calcAverageCycle(history);
  const phaseMap = getMonthPhaseMap(curYear, curMonth, history, avgCycle);

  const key = (y, m, d) => `${y}-${m}-${d}`;
  const kOf = (day) => key(curYear, curMonth, day);
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
    const data = dayData[kOf(day)] || {};
    setEditType(data.abnormal ? 'abnormal' : (data.type || 'normal'));
    setFlowVal(data.flow ?? 2);
    setPainVal(data.pain_level ?? data.pain ?? 0);
    setClotVal(data.clot ?? null);
    setMoodVal(data.mood ?? 2);
    setNoteVal(data.note || '');
    setImages(Array.isArray(data.images) ? data.images : []);
    setEditVisible(true);
  };

  // 多模态：从相册选择图片（存 URI 到 dayRecord.images）
  const pickImage = () => {
    launchImageLibrary({ mediaType: 'photo', selectionLimit: 3 }, (res) => {
      if (res.didCancel || res.errorCode) return;
      const uris = (res.assets || []).map(a => a.uri).filter(Boolean);
      setImages(prev => [...prev, ...uris]);
    });
  };

  const saveEdit = async () => {
    const k = key(curYear, curMonth, editDay);
    if (editType === 'normal') {
      await removeDayRecord(k);
    } else if (editType === 'abnormal') {
      // 异常出血：日历橙色标记；清掉经期标记（异常出血不算经期，不参与周期推算）
      await saveDayRecord({
        date: k, abnormal: 'abnormal', type: undefined,
        pain_level: painVal, clot: clotVal, mood: moodVal, note: noteVal, images,
      });
    } else {
      await saveDayRecord({
        date: k, type: editType, abnormal: undefined,
        flow: flowVal, pain_level: painVal, clot: clotVal,
        mood: moodVal, note: noteVal, images,
      });
    }
    refresh();
    setEditVisible(false);
  };

  // 引导：去「今日」做完整 6 组问诊式记录（今日页聚焦时自动打开记录弹窗）
  const goFullRecord = () => {
    requestOpenRecord();
    setEditVisible(false);
    navigation.navigate('今日');
  };

  const getCellStyle = (day) => {
    const data = dayData[kOf(day)];
    // 手动标记优先：异常出血橙色、经期/历史阶段按色
    if (data) {
      if (data.abnormal) return { backgroundColor: '#ffe8cc', borderColor: '#f4a261', borderWidth: 1 };
      const t = DAY_TYPES.find(x => x.id === data.type);
      if (t) return { backgroundColor: t.color };
      return {};
    }
    // 无手动标记 → 算法推算叠加：预测经期虚线红框
    const phase = phaseMap[day];
    if (phase === 'predicted') return { borderColor: '#e63946', borderWidth: 1.5, borderStyle: 'dashed' };
    return {};
  };
  const getCellTextColor = (day) => {
    const data = dayData[kOf(day)];
    if (!data) return '#222';
    if (data.abnormal) return '#a05e03';
    const t = DAY_TYPES.find(x => x.id === data.type);
    return t ? t.text : '#222';
  };
  // 自动阶段浅色圆点（仅无手动标记的日期）
  const getAutoDot = (day) => {
    if (dayData[kOf(day)]) return null;
    const phase = phaseMap[day];
    return (phase === 'ovulation' || phase === 'luteal') ? AUTO_DOT_COLOR[phase] : null;
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
                  day && kOf(day) === todayKey && { borderWidth: 2, borderColor: theme.primary },
                ]}
                onPress={() => day && openEdit(day)}
                disabled={!day}
              >
                <View style={s.cellInner}>
                  <Text style={{ fontSize: 13, color: day ? getCellTextColor(day) : 'transparent' }}>
                    {day || 0}
                  </Text>
                  {day && getAutoDot(day) && (
                    <View style={[s.autoDot, { backgroundColor: getAutoDot(day) }]} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.legend}>
            <View style={s.legItem}>
              <View style={[s.legDot, { backgroundColor: '#ffe0e3' }]} />
              <Text style={s.legLabel}>月经期</Text>
            </View>
            <View style={s.legItem}>
              <View style={[s.legDot, { backgroundColor: '#ffe8cc', borderWidth: 1, borderColor: '#f4a261' }]} />
              <Text style={s.legLabel}>异常出血</Text>
            </View>
            <View style={s.legItem}>
              <View style={[s.legDot, { borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#e63946' }]} />
              <Text style={s.legLabel}>预测经期</Text>
            </View>
            <View style={s.legItem}>
              <View style={[s.legDot, { backgroundColor: '#2a9d8f' }]} />
              <Text style={s.legLabel}>排卵/黄体(自动)</Text>
            </View>
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
        <View style={s.modalRoot}>
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
        </View>
      </Modal>

      {/* 日编辑面板 */}
      <Modal transparent animationType="slide" visible={editVisible} onRequestClose={() => setEditVisible(false)}>
        <View style={s.modalRoot}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setEditVisible(false)} />
          <View style={s.editSheet}>
          <View style={s.handle} />
          <Text style={[s.editTitle, { color: theme.primary }]}>
            编辑 {curYear}/{curMonth}/{editDay}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={s.sectionLabel}>标记类型</Text>
          <View style={s.typeRow}>
            {EDIT_TYPES.map(t => (
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
          {editType === 'abnormal' && (
            <View style={[s.abnTip, { backgroundColor: '#fff3e0' }]}>
              <Text style={s.abnTipText}>异常出血（经间期/性交后）是妇科就诊的重要指征，建议记录并告知医生。它不会计入经期周期推算。</Text>
            </View>
          )}

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

          <Text style={s.sectionLabel}>是否有血块</Text>
          <View style={s.ynRow}>
            {[true, false].map(v => (
              <TouchableOpacity
                key={String(v)}
                style={[s.ynBtn, clotVal === v && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                onPress={() => setClotVal(v)}
              >
                <Text style={[s.ynBtnText, clotVal === v && { color: '#fff' }]}>{v ? '有血块' : '无血块'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.sectionLabel}>情绪：{['很差', '较差', '一般', '良好', '很好'][moodVal]}</Text>
          <Slider
            style={{ width: '100%' }}
            minimumValue={0} maximumValue={4} step={1}
            value={moodVal}
            minimumTrackTintColor={theme.primary}
            thumbTintColor={theme.primary}
            onValueChange={setMoodVal}
          />

          <Text style={s.sectionLabel}>自定义备注</Text>
          <TextInput
            style={[s.noteInput, { borderColor: theme.mid }]}
            placeholder="压力、饮食、其他不适等补充信息…"
            placeholderTextColor="#aaa"
            multiline
            value={noteVal}
            onChangeText={setNoteVal}
          />

          <Text style={s.sectionLabel}>图片记录（多模态）</Text>
          <View style={s.imgRow}>
            {images.map((uri, i) => (
              <View key={i} style={s.imgWrap}>
                <Image source={{ uri }} style={s.imgThumb} />
                <TouchableOpacity
                  style={s.imgDel}
                  onPress={() => setImages(prev => prev.filter((_, j) => j !== i))}
                >
                  <Text style={s.imgDelText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={[s.imgAdd, { borderColor: theme.mid }]} onPress={pickImage}>
              <Text style={{ color: theme.primary, fontSize: 22, lineHeight: 24 }}>＋</Text>
              <Text style={s.imgAddText}>添加图片</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[s.saveBtn, { backgroundColor: theme.primary }]} onPress={saveEdit}>
            <Text style={s.saveBtnText}>保存</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.fullRecordLink, { backgroundColor: theme.light }]} onPress={goFullRecord}>
            <Text style={[s.fullRecordLinkText, { color: theme.primary }]}>📋 需要完整记录？去「今日」做 6 组问诊式记录</Text>
          </TouchableOpacity>
          </ScrollView>
        </View>
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
  cellInner:   { alignItems: 'center', justifyContent: 'center', flex: 1 },
  autoDot:     { width: 6, height: 6, borderRadius: 3, marginTop: 1 },
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
  modalRoot:   { flex: 1, justifyContent: 'flex-end' },
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
  editSheet:   { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '88%' },
  editTitle:   { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  sectionLabel:{ fontSize: 13, color: '#555', marginBottom: 4, marginTop: 10 },
  typeRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip:    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  typeChipText:{ fontSize: 13, fontWeight: '500' },
  abnTip:      { borderRadius: 8, padding: 8, marginTop: 8 },
  abnTipText:  { fontSize: 11, color: '#854f0b', lineHeight: 16 },
  saveBtn:     { borderRadius: 13, padding: 13, alignItems: 'center', marginTop: 18 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  fullRecordLink:    { marginTop: 12, padding: 10, borderRadius: 9, alignItems: 'center' },
  fullRecordLinkText:{ fontSize: 12, fontWeight: '500' },
  ynRow:       { flexDirection: 'row', gap: 8 },
  ynBtn:       { flex: 1, padding: 9, borderRadius: 9, borderWidth: 1, borderColor: '#e0ede8', alignItems: 'center', backgroundColor: '#f0f7f4' },
  ynBtnText:   { fontSize: 13, color: '#555' },
  noteInput:   { borderWidth: 0.5, borderRadius: 9, padding: 10, fontSize: 13, minHeight: 64, textAlignVertical: 'top', color: '#222' },
  imgRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  imgWrap:     { position: 'relative' },
  imgThumb:    { width: 64, height: 64, borderRadius: 8, backgroundColor: '#eee' },
  imgDel:      { position: 'absolute', top: -6, right: -6, backgroundColor: '#e63946', width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  imgDelText:  { color: '#fff', fontSize: 12, lineHeight: 16 },
  imgAdd:      { width: 64, height: 64, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  imgAddText:  { fontSize: 10, color: '#888', marginTop: 2 },
});
