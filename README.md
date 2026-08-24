# Luna — 经期健康管理 App

基于 React Native 开发，聚焦周期异常预警与就医衔接的经期健康管理应用。

## 项目结构

```
Luna/
├── App.js                          # 入口文件
├── package.json
├── src/
│   ├── theme/
│   │   └── ThemeContext.js         # 主题管理（5套配色，含 AsyncStorage 持久化）
│   ├── navigation/
│   │   └── AppNavigator.js         # 底部导航（今日/日历/观察/AI/我的）
│   ├── components/
│   │   └── RecordBottomSheet.js    # 记录弹窗（基于妇科临床问诊要素设计）
│   ├── screens/
│   │   ├── HomeScreen.js           # 今日：周期阶段、穿戴数据、异常提示
│   │   ├── CalendarScreen.js       # 日历：年月快速跳转、日编辑、客观统计
│   │   ├── ObservationScreen.js    # 观察：周期/经血量/时长趋势 + 就医指标追踪
│   │   ├── AIScreen.js             # AI 助手：流式对话，接入自建后端
│   │   └── ProfileScreen.js        # 我的：主题切换、健康数据授权
│   ├── services/
│   │   └── api.js                  # 后端 API 封装（AI对话/记录/穿戴数据同步）
│   ├── utils/
│   │   └── cycleCalculator.js      # 周期阶段推算、FIGO异常预警规则
│   └── constants/
│       └── medicalThresholds.js    # FIGO医学阈值、就医指标配置
```

## 核心设计原则

1. **周期阶段推算透明化**：所有阶段（排卵期/黄体期等）均基于用户手动记录的经期日期 + 历史平均周期计算得出，非黑箱判断，详见 `utils/cycleCalculator.js` 注释。

2. **异常判断仅供参考，不做诊断**：所有阈值参考 FIGO（国际妇产科联盟）标准，UI文案统一使用"建议就医/建议关注"而非确定性诊断用语。

3. **日历模块不做主观评判**：本月概览只展示用户实际记录的客观数字（经期天数、已记录天数），不给出"正常/异常"结论，避免引发用户焦虑。

4. **记录分组遵循临床问诊优先级**：出血情况 > 疼痛 > 内分泌 > 凝血 > 用药 > 主观感受，对齐医生实际问诊逻辑。

## 环境要求

- Node.js ≥ 22
- JDK 17（Amazon Corretto 17 推荐）
- Android Studio（含 Android SDK / Virtual Device）

## 安装步骤

```bash
npm install
```

## 运行

```bash
# 终端1：启动 Metro
npm start

# 终端2：编译运行到 Android
npm run android
```

## 待接入项（TODO）

- [ ] `services/api.js` 中 `BASE_URL` 替换为实际后端地址
- [ ] `HomeScreen.js` 穿戴数据接入 HealthKit（iOS）/ HUAWEI Health Kit（安卓）
- [ ] `CalendarScreen.js` / `ObservationScreen.js` 数据源从模拟数据切换为 AsyncStorage + 后端同步
- [ ] `AIScreen.js` 后端需实现基于医学文献知识库的 RAG 检索逻辑
- [ ] 导出 PDF 复诊报告功能的具体实现（建议使用 `react-native-html-to-pdf` 或后端生成）
