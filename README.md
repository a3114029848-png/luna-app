# Luna — 经期健康管理 App

一款适用于个人的经期管理 app，兼具简洁、科学、隐私。

基于 React Native 开发，聚焦周期异常预警与就医衔接的经期健康管理应用。

> 求职方向：AI 产品经理 ｜ 应届（硕士在读）
> 联系：a3114029848@163.com ｜ GitHub：github.com/a3114029848-png

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

## 后端代理 + 云同步（推荐，生产安全）

> 2026-08-30 新增：DeepSeek Key 移到服务端 `server/`，客户端不再持有 Key；记录支持云端备份与启动拉取合并。

**启动后端：**

```bash
cd server
# 首次：复制 .env.example 为 .env 并填入 DEEPSEEK_API_KEY
npm install
npm start   # 默认 http://localhost:3000，启动时打印真机可用的局域网地址
```

**客户端连接（`src/services/api.js` 的 `BASE_URL`）：**
- Android 模拟器：`http://10.0.2.2:3000/api`（默认已是）
- 真机：改为电脑局域网 IP（`npm start` 时会打印 `LAN (真机用): http://<IP>:3000/api`）

**安全架构：**
- DeepSeek Key 只存在 `server/.env`，客户端 App 永不接触
- AI 对话：客户端 `chatStreamViaProxy` → 后端 `/api/ai/chat` → DeepSeek（SSE 透传）
- 后端不可用时，客户端自动降级本地直连（`deepseekChatStream`，仅开发）
- 记录云同步：保存后自动上报（`POST /api/records`），启动时拉取合并（本地优先，远端补缺）

**后端接口：** `POST /api/ai/chat`（SSE）· `POST/GET /api/records(/:userId)` · `GET /api/cycles/:userId` · `POST /api/export/:userId` · `POST/GET /api/health-data/sync|status/:userId`

---

## 本地 AI Demo 快速跑通（DeepSeek 直连）

> ⚠️ 仅用于本地真机验证 / 面试演示。API Key 写在客户端会随包分发，**禁止提交 Git / 上架**，生产必须改为后端持有 Key 的代理。

1. 打开 `src/services/api.js`，把 `DEEPSEEK_API_KEY` 改成你自己的 DeepSeek API Key
2. 真机（USB 连接）：
   - 终端1：`npm start`
   - 终端2：`npm run android`
3. 手机需可联网。到 AI 页输入知识库未覆盖的问题（如「经期可以吃止痛药吗」），即可看到 DeepSeek 流式回答
4. 常见错误排查：
   - `DeepSeek 401`：Key 无效或未填写
   - `DeepSeek 402`：账号余额不足，需到 DeepSeek 开放平台充值
   - 本地能力（周期分析 / 知识库 / 安全提示）不依赖网络，断网仍可用

## 待接入项（TODO）

- [x] `services/api.js` 的 `BASE_URL` 指向本地后端（`server/`，2026-08-30）；模拟器默认 `10.0.2.2:3000/api`，真机改局域网 IP
- [ ] `HomeScreen.js` 穿戴数据接入 HealthKit（iOS）/ HUAWEI Health Kit（安卓）
- [x] `CalendarScreen.js` / `ObservationScreen.js` / `HomeScreen.js` / AI 数据源切换为本地持久化（`src/services/periodStore.js` + AsyncStorage，2026-08-29）
- [x] `AIScreen.js` 云端走后端代理（Key 在服务端，2026-08-30）；医学文献 RAG 知识库仍待接
- [ ] 导出 PDF 复诊报告功能的具体实现（建议使用 `react-native-html-to-pdf` 或后端生成）
