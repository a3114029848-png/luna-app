/**
 * FIGO（国际妇产科联盟）正常月经参数标准
 * 参考：FIGO AUB 分类系统（2011年更新）
 * 用途：周期异常预警规则判断依据，不作为诊断结论
 */
export const FIGO = {
  // 周期频率（天）
  CYCLE_MIN: 24,
  CYCLE_MAX: 38,

  // 经期持续时长（天）
  DURATION_MAX: 8,

  // 周期规律性：近N期标准差阈值（天）
  REGULARITY_STD_MAX: 9,

  // 触发"建议就医"的最小连续异常周期数
  ALERT_CONSECUTIVE: 2,
};

/**
 * 经血量自评等级（用户记录用，映射到柱状图宽度比例）
 */
export const FLOW_LEVELS = ['无', '点滴', '少量', '适中', '偏多'];
export const FLOW_RATIOS = [0, 0.2, 0.45, 0.65, 0.9];

/**
 * 就医指标配置（影响观察模块的徽章颜色和提示文案）
 */
export const MEDICAL_INDICATORS = [
  {
    id: 'pain',
    label: '腹痛程度',
    icon: 'ti-bolt',
    alertLevel: (trend) => {
      if (!trend || trend.length === 0) return 'normal'; // 无记录不误判
      // 连续2期中度及以上 → 建议就医
      const recent = trend.slice(-2);
      if (recent.every(v => v >= 2)) return 'danger';
      if (recent.some(v => v >= 1)) return 'warning';
      return 'normal';
    },
  },
  {
    id: 'clot',
    label: '血块情况',
    icon: 'ti-droplets',
    alertLevel: (trend) => {
      if (!trend || trend.length === 0) return 'normal'; // 无记录不误判
      if (trend.slice(-1)[0] >= 2) return 'danger';
      if (trend.some(v => v >= 1)) return 'warning';
      return 'normal';
    },
  },
  {
    id: 'imb',
    label: '经间期出血',
    icon: 'ti-alert-triangle',
    // FIGO AUB-E：经间期出血1次即为就医指征
    alertLevel: (trend) => {
      if (!trend || trend.length === 0) return 'normal'; // 无记录不误判
      if (trend.slice(-1)[0] >= 1) return 'danger';
      return 'normal';
    },
    alwaysShowDanger: true,
  },
  {
    id: 'breast',
    label: '乳房胀痛',
    icon: 'ti-ripple',
    alertLevel: (trend) => {
      if (!trend || trend.length === 0) return 'normal'; // 无记录不误判
      if (trend.every(v => v >= 3)) return 'danger';
      if (trend.some(v => v >= 2)) return 'warning';
      return 'normal';
    },
  },
  {
    id: 'temp_biphasic',
    label: '体温双相特征',
    icon: 'ti-temperature',
    alertLevel: (trend) => {
      if (!trend || trend.length === 0) return 'normal'; // 无记录不误判
      // trend 为 boolean[]：true = 当期有双相
      if (trend.every(v => v === true)) return 'normal';
      if (trend.some(v => v === false)) return 'warning';
      return 'normal';
    },
  },
  {
    id: 'mood',
    label: '经前情绪低落',
    icon: 'ti-mood-sad',
    alertLevel: (trend) => {
      if (!trend || trend.length === 0) return 'normal'; // 无记录不误判
      const recent = trend.slice(-2);
      if (recent.every(v => v >= 2) && recent[1] > recent[0]) return 'warning';
      return 'normal';
    },
    note: '连续2期加重建议评估PMS/PMDD',
  },
];

/**
 * 徽章样式映射
 */
export const ALERT_STYLES = {
  normal:  { bg: '#e1f5ee', text: '#0f6e56', icon: 'ti-check',        label: '正常' },
  warning: { bg: '#fff3e0', text: '#854f0b', icon: 'ti-eye',           label: '关注' },
  danger:  { bg: '#ffe0e3', text: '#a32d2d', icon: 'ti-alert-circle',  label: '建议就医' },
};
