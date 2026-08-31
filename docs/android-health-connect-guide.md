# Luna · Android 穿戴设备接入指南（Health Connect）

> 目标：把真实手环/手表（华为/小米/三星/OPPO 等）的体温、心率、睡眠等数据接入 Luna。
> 架构：Luna 的 `src/services/wearableStore.js` 采用 **Provider 模式**——当前跑"模拟 Provider"，
> 接真实设备只需实现/启用 `healthConnectProvider`，**页面零改动**（HomeScreen / ObservationScreen / ProfileScreen 调用的接口不变）。

---

## 一、原理（数据如何到 App）

```
手环/手表 ──①同步──> Health Connect（手机系统健康库）
                          │ ②App 请求授权读取
                          ▼
                     Luna App（healthConnectProvider）
                          │ ③本地缓存 + 上报后端
                          ▼
                   SQLite（server）→ 指标派生（体温双相/周期）
```

Health Connect 是 Google 的**跨品牌统一健康平台**（Android 14+ 系统内置；Android 13- 从 Play 商店安装 "Health Connect" App）。
华为/小米等手环在各自"运动健康"App 里开启"同步到 Health Connect"后，数据即可被 App 统一读取，**无需为每个品牌单独接 SDK**。

---

## 二、前提条件

1. **手机**：Android 14+（内置 Health Connect）；或 Android 13- 安装 "Health Connect" 应用（realme RMX3161 属此类，需先装）
2. **设备**：支持同步到 Health Connect 的手环/手表
   - 华为：华为运动健康 → 设置 → 数据分享 → 同步到 Health Connect
   - 小米：小米运动健康（支持 Health Connect 导出版本）
   - 三星/OPPO：系统自带支持
3. **RN 原生依赖**：`react-native-health-connect`（需要时再装，装后需重编原生 `npm run android`）

---

## 三、接入步骤（有设备后执行）

### 1. 安装依赖
```bash
cd d:\Luna
npm install react-native-health-connect
# 权限配置参考官方 README（AndroidManifest 权限 + 模块配置）
```

### 2. AndroidManifest 声明（android/app/src/main/AndroidManifest.xml）
```xml
<uses-permission android:name="android.permission.health.READ_HEART_RATE"/>
<uses-permission android:name="android.permission.health.READ_SLEEP"/>
<uses-permission android:name="android.permission.health.READ_TEMPERATURE"/>
<uses-permission android:name="android.permission.health.READ_STEPS"/>
```
> 体温数据在 Health Connect 中可能以 Body Temperature 记录提供（部分设备/地区有差异）。

### 3. 实现 healthConnectProvider（src/services/wearableStore.js 内的骨架）
```js
const healthConnectProvider = {
  // 1) 检查系统是否可用（Health Connect 是否安装/可访问）
  isAvailable: async () => { /* HealthConnect.isAvailable() */ return false; },

  // 2) 请求授权（声明要读的记录类型）
  requestPermission: async () => {
    /* await HealthConnect.requestPermission([...读类型]) */ return false;
  },

  // 3) 读取体温序列（按日期），返回 { 'YYYY-M-D': 36.5 }
  readTemperatureSeries: async () => {
    /* const recs = await HealthConnect.readRecords(
         { recordType: 'BodyTemperature', timeRangeFilter: {...} });
       return 组装成 { 'YYYY-M-D': 温度 } */
    return {};
  },

  // 4) 读取心率/睡眠等 → 组装 getLiveData() 需要的对象
  readLiveData: async () => { /* ... */ return null; },
};

// 启用真实 provider（接入完成后）：
// const ACTIVE_PROVIDER = 'healthConnect'; // 原 'sim'
```

### 4. 在 wearableStore 启用
- 把 `ACTIVE_PROVIDER` 从 `'sim'` 改为 `'healthConnect'`
- `getLiveData()` / `getTempBiphasicTrends()` / `getStatus()` 内部改为从 `healthConnectProvider` 取数（页面无感）
- ProfileScreen「健康数据授权」开关即触发 `requestPermission` + 开始读取

### 5. 真机验证
1. 手机装 Health Connect，手环同步数据进去
2. 重编安装 App（`npm run android`）
3. 我的页开「健康数据授权」→ 授权 Health Connect → 今日页出现真实体温/心率
4. 连续几天 → 观察页「体温双相」真实判定

---

## 四、与模拟 Provider 的关系

| Provider | 用途 | 状态 |
|---|---|---|
| `sim`（SimProvider） | 无设备时演示完整链路（体温双相/连接状态/云端同步） | **当前默认** |
| `healthConnect` | 真实 Android 设备接入 | 骨架已预留，按本指南填充 |

两者共享同一对外接口，切换只改 `ACTIVE_PROVIDER` 一处 + provider 内部实现，**页面与指标派生零改动**。

---

## 五、常见问题

- **Health Connect 提示不可用**：Android 13- 需先装 "Health Connect" App；或设备不支持
- **授权后读不到体温**：确认手环在"运动健康"里开启了同步到 Health Connect，且 App 请求了 `BodyTemperature` 记录类型
- **RN 编译报错**：`react-native-health-connect` 需要 Android 编译环境（本机已有），`cd android && ./gradlew` 或 `npm run android` 重编
- **隐私**：Health Connect 授权是系统级、可随时撤销；Luna 遵循"数据仅用于周期/指标分析，不上传无关数据"
