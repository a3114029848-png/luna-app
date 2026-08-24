import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Modal, TextInput,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useTheme } from '../theme/ThemeContext';

/**
 * 记录分组配置
 * 按妇科问诊优先级排序：出血情况 > 疼痛 > 内分泌 > 凝血 > 用药 > 主观感受
 */
const RECORD_GROUPS = [
  {
    id: 'bleeding',
    groupLabel: '出血情况（医生最优先关注）',
    groupColor: '#e63946',
    items: [
      {
        id: 'bleed_type',
        label: '出血类型',
        icon: '💧',
        type: 'chips',
        options: ['无出血', '经期出血', '经间期出血', '性交后出血'],
        dangerOptions: ['经间期出血', '性交后出血'], // 选中时显示警示
      },
      {
        id: 'flow',
        label: '经血量',
        icon: '🔴',
        type: 'slider',
        min: 0, max: 4, step: 1,
        labels: ['无', '点滴', '少量', '适中', '偏多'],
      },
      {
        id: 'color',
        label: '血色',
        icon: '🎨',
        type: 'chips',
        options: ['鲜红', '暗红', '咖啡色', '粉色'],
      },
      {
        id: 'clot',
        label: '是否有血块',
        icon: '🔵',
        type: 'yesno',
        yesLabel: '有血块',
        noLabel: '无血块',
      },
    ],
  },
  {
    id: 'pain',
    groupLabel: '疼痛（影响诊断方向）',
    groupColor: '#d4537e',
    items: [
      {
        id: 'pain_level',
        label: '腹痛 / 痛经',
        icon: '⚡',
        type: 'slider',
        min: 0, max: 4, step: 1,
        labels: ['无', '轻微', '中度', '较重', '剧烈'],
      },
      {
        id: 'pain_location',
        label: '疼痛位置',
        icon: '📍',
        type: 'chips',
        options: ['下腹正中', '腰骶部', '单侧下腹', '放射至腿'],
      },
      {
        id: 'painkiller',
        label: '是否服用止痛药',
        icon: '💊',
        type: 'yesno',
        yesLabel: '是（记录药名）',
        noLabel: '否',
      },
      {
        id: 'breast_pain',
        label: '乳房胀痛',
        icon: '🫧',
        type: 'slider',
        min: 0, max: 4, step: 1,
        labels: ['无', '轻微', '中度', '较重', '严重'],
      },
    ],
  },
  {
    id: 'endocrine',
    groupLabel: '内分泌相关（PCOS / 泌乳素筛查）',
    groupColor: '#457b9d',
    items: [
      {
        id: 'acne',
        label: '痤疮今日变化',
        icon: '✨',
        type: 'chips',
        options: ['无变化', '略有加重', '明显加重', '有所好转'],
      },
      {
        id: 'hirsutism',
        label: '是否注意到异常多毛',
        icon: '🔍',
        type: 'yesno',
        yesLabel: '是',
        noLabel: '否',
      },
      {
        id: 'galactorrhea',
        label: '乳头溢液 / 泌乳',
        icon: '⚠️',
        type: 'yesno',
        yesLabel: '是（需重点关注）',
        noLabel: '否',
        dangerOnYes: true,
        dangerText: '泌乳是高泌乳素血症常见筛查指标，建议就医告知医生',
      },
    ],
  },
  {
    id: 'coagulation',
    groupLabel: '凝血相关（AUB-C 排查）',
    groupColor: '#9b5de5',
    items: [
      {
        id: 'coag_signs',
        label: '异常瘀伤 / 鼻出血 / 牙龈出血',
        icon: '🩹',
        type: 'chips',
        options: ['均无', '异常瘀伤', '鼻出血', '牙龈出血'],
        note: '出现2项以上建议就诊时主动告知医生（FIGO AUB-C 标准）',
      },
    ],
  },
  {
    id: 'medication',
    groupLabel: '用药记录（医生必问）',
    groupColor: '#1a6b5a',
    items: [
      {
        id: 'meds',
        label: '今日用药',
        icon: '💊',
        type: 'chips_multi',
        options: ['无用药', '短效避孕药', '止痛药', '孕激素类', '抗生素', '其他'],
      },
      {
        id: 'meds_note',
        label: '药名 / 剂量补充',
        icon: '📝',
        type: 'text',
        placeholder: '例：布洛芬 400mg，饭后服用',
      },
    ],
  },
  {
    id: 'subjective',
    groupLabel: '主观感受（辅助参考）',
    groupColor: '#888',
    items: [
      {
        id: 'mood',
        label: '情绪',
        icon: '🌤',
        type: 'slider',
        min: 0, max: 4, step: 1,
        labels: ['很差', '较差', '一般', '良好', '很好'],
      },
      {
        id: 'energy',
        label: '精力',
        icon: '⚡',
        type: 'slider',
        min: 0, max: 4, step: 1,
        labels: ['精疲力竭', '疲惫', '一般', '充沛', '旺盛'],
      },
      {
        id: 'sleep',
        label: '睡眠质量',
        icon: '🌙',
        type: 'slider',
        min: 0, max: 4, step: 1,
        labels: ['很差', '较差', '一般', '良好', '很好'],
      },
      {
        id: 'note',
        label: '补充信息',
        icon: '📝',
        type: 'text',
        placeholder: '记录其他特殊情况、压力、饮食变化等……',
      },
    ],
  },
];

export default function RecordBottomSheet({ visible, onClose, onSave, date }) {
  const { theme } = useTheme();
  const [values, setValues] = useState({});
  const [expandedGroup, setExpandedGroup] = useState('bleeding');

  const setVal = (id, val) => setValues(prev => ({ ...prev, [id]: val }));
  const getVal = (id) => values[id];

  const handleSave = () => {
    onSave({ date, values, timestamp: new Date().toISOString() });
    setValues({});
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose} />
      <View style={[s.sheet, { borderTopColor: theme.mid }]}>
        <View style={[s.handle, { backgroundColor: theme.mid }]} />
        <Text style={[s.sheetTitle, { color: theme.primary }]}>
          记录今日症状 · {date}
        </Text>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {RECORD_GROUPS.map(group => (
            <View key={group.id}>
              {/* 分组标签 */}
              <TouchableOpacity
                style={[s.groupHeader, { backgroundColor: group.groupColor }]}
                onPress={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
              >
                <Text style={s.groupLabel}>{group.groupLabel}</Text>
                <Text style={{ color: '#fff', fontSize: 12 }}>
                  {expandedGroup === group.id ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>

              {expandedGroup === group.id && group.items.map(item => (
                <View key={item.id} style={s.itemWrap}>
                  <View style={s.itemHeader}>
                    <Text style={s.itemIcon}>{item.icon}</Text>
                    <Text style={s.itemLabel}>{item.label}</Text>
                  </View>

                  {/* 滑块 */}
                  {item.type === 'slider' && (
                    <View style={[s.panel, { backgroundColor: theme.light }]}>
                      <Slider
                        style={{ width: '100%' }}
                        minimumValue={item.min}
                        maximumValue={item.max}
                        step={item.step}
                        value={getVal(item.id) ?? Math.floor(item.max / 2)}
                        minimumTrackTintColor={theme.primary}
                        thumbTintColor={theme.primary}
                        onValueChange={v => setVal(item.id, v)}
                      />
                      <View style={s.sliderLabs}>
                        {item.labels.map((l, i) => (
                          <Text key={i} style={[
                            s.sliderLab,
                            getVal(item.id) === i && { color: theme.primary, fontWeight: '600' },
                          ]}>{l}</Text>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* 单选 chips */}
                  {item.type === 'chips' && (
                    <View style={[s.panel, { backgroundColor: theme.light }]}>
                      <View style={s.chipRow}>
                        {item.options.map(opt => {
                          const isDanger = item.dangerOptions?.includes(opt);
                          const selected = getVal(item.id) === opt;
                          return (
                            <TouchableOpacity
                              key={opt}
                              style={[
                                s.chip,
                                selected && { backgroundColor: isDanger ? '#e63946' : theme.primary, borderColor: isDanger ? '#e63946' : theme.primary },
                              ]}
                              onPress={() => setVal(item.id, opt)}
                            >
                              <Text style={[s.chipText, selected && { color: '#fff' }]}>{opt}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {item.dangerOptions?.includes(getVal(item.id)) && (
                        <View style={s.warnBox}>
                          <Text style={s.warnText}>经间期出血或性交后出血是妇科就诊的重要指征，建议尽快咨询医生</Text>
                        </View>
                      )}
                      {item.note && (
                        <Text style={s.noteText}>{item.note}</Text>
                      )}
                    </View>
                  )}

                  {/* 多选 chips */}
                  {item.type === 'chips_multi' && (
                    <View style={[s.panel, { backgroundColor: theme.light }]}>
                      <View style={s.chipRow}>
                        {item.options.map(opt => {
                          const selected = (getVal(item.id) || []).includes(opt);
                          return (
                            <TouchableOpacity
                              key={opt}
                              style={[s.chip, selected && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                              onPress={() => {
                                const cur = getVal(item.id) || [];
                                setVal(item.id, selected ? cur.filter(v => v !== opt) : [...cur, opt]);
                              }}
                            >
                              <Text style={[s.chipText, selected && { color: '#fff' }]}>{opt}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* 是/否 */}
                  {item.type === 'yesno' && (
                    <View style={[s.panel, { backgroundColor: theme.light }]}>
                      <View style={s.ynRow}>
                        {[item.yesLabel, item.noLabel].map((label, i) => {
                          const isYes = i === 0;
                          const selected = isYes ? getVal(item.id) === true : getVal(item.id) === false;
                          return (
                            <TouchableOpacity
                              key={label}
                              style={[s.ynBtn, selected && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                              onPress={() => setVal(item.id, isYes)}
                            >
                              <Text style={[s.ynText, selected && { color: '#fff' }]}>{label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {item.dangerOnYes && getVal(item.id) === true && (
                        <View style={s.warnBox}>
                          <Text style={s.warnText}>{item.dangerText}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* 文本输入 */}
                  {item.type === 'text' && (
                    <View style={[s.panel, { backgroundColor: theme.light }]}>
                      <TextInput
                        style={[s.textInput, { borderColor: theme.mid }]}
                        placeholder={item.placeholder}
                        placeholderTextColor="#aaa"
                        multiline
                        numberOfLines={3}
                        value={getVal(item.id) || ''}
                        onChangeText={v => setVal(item.id, v)}
                      />
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))}

          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: theme.primary }]}
            onPress={handleSave}
          >
            <Text style={s.saveBtnText}>保存记录</Text>
          </TouchableOpacity>
          <View style={{ height: 16 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)' },
  sheet:       { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%', borderTopWidth: 0.5, flex: 0 },
  handle:      { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', margin: 14 },
  sheetTitle:  { fontSize: 15, fontWeight: '600', paddingHorizontal: 16, marginBottom: 10 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, marginTop: 4 },
  groupLabel:  { color: '#fff', fontSize: 11, fontWeight: '500', flex: 1 },
  itemWrap:    { paddingHorizontal: 14, paddingTop: 10 },
  itemHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  itemIcon:    { fontSize: 16 },
  itemLabel:   { fontSize: 13, color: '#222', fontWeight: '500' },
  panel:       { borderRadius: 10, padding: 12, marginBottom: 4 },
  sliderLabs:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  sliderLab:   { fontSize: 10, color: '#999', textAlign: 'center', flex: 1 },
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:        { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 0.5, borderColor: '#c8e0d8', backgroundColor: '#fff' },
  chipText:    { fontSize: 12, color: '#3a5a52' },
  ynRow:       { flexDirection: 'row', gap: 8 },
  ynBtn:       { flex: 1, padding: 8, borderRadius: 8, borderWidth: 0.5, borderColor: '#c8e0d8', backgroundColor: '#fff', alignItems: 'center' },
  ynText:      { fontSize: 12, color: '#555' },
  textInput:   { borderWidth: 0.5, borderRadius: 9, padding: 10, fontSize: 13, color: '#222', minHeight: 80, textAlignVertical: 'top' },
  warnBox:     { backgroundColor: '#fff3e0', borderRadius: 7, padding: 8, marginTop: 8 },
  warnText:    { fontSize: 11, color: '#854f0b', lineHeight: 16 },
  noteText:    { fontSize: 11, color: '#888', marginTop: 6, lineHeight: 16 },
  saveBtn:     { borderRadius: 13, padding: 14, alignItems: 'center', marginHorizontal: 14, marginTop: 16 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
