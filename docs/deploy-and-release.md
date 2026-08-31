# Luna · 部署后端到公网 + 发布完整版 APK

> 目标：让其他人也能完整使用 Luna（AI 云端 + RAG + PDF + 云同步 + 各自独立数据）。
> 架构：`Luna App（Android）` ↔ `公网后端 server/（Express + SQLite + DeepSeek 代理）`

---

## 一、总体流程

```
① 云服务器部署 server/  →  ② 客户端 BASE_URL 改公网地址  →  ③ 打 release APK  →  ④ 分发
```

---

## 二、Windows Server 2022 实测版（方案 B，本次已跑通 ✅ 2026-08-31）

> 本次用腾讯云轻量 **Windows Server 2022**（2核2G）实际部署成功，公网 `http://49.232.49.16:3000` 全链路验证通过。
> 相比 Linux 方案：**无需编译 better-sqlite3**（改用 sql.js），**进程常驻用计划任务**（非 PM2），**防火墙是 Windows 防火墙 + 云安全组双层**。

### ① 开通服务器 + 放行端口（腾讯云控制台）
- 轻量应用服务器 → 防火墙 → 添加规则：**22**（SSH，TCP）+ **3000**（后端，TCP，来源 0.0.0.0/0）
- 拿到公网 IP（如 49.232.49.16）+ 管理员密码

### ② 打通 SSH（OpenSSH Server）
- Windows 自带 OpenSSH Server；若未启动：管理员 PowerShell 执行 `Start-Service sshd`
- 免密登录：把本机公钥写到服务器 `C:\ProgramData\ssh\administrators_authorized_keys`
- **私钥权限必须收紧**（否则报 `UNPROTECTED PRIVATE KEY FILE`）：
  ```bat
  icacls "luna_using.pem" /inheritance:r /grant "%USERNAME%:R" /grant "SYSTEM:R"
  ```
- 连接测试：`ssh -i luna_using.pem Administrator@公网IP`

### ③ 装 Node.js（zip 免安装）
- 无编译器、不想装 MSI → 下 node zip 解压到 `C:\nodejs`（含 npm）；本次 v20.18.1

### ④ 上传代码 + 装依赖（⚠️ 关键：选 sql.js）
- 本机：`scp -r server/ Administrator@IP:C:/luna-server`（排除 node_modules/data/.env）
- 依赖：`cd C:\luna-server && npm install`
  - ⚠️ **不要用 better-sqlite3**：需 VS Build Tools 编译，服务器没有会 `gyp ERR! find VS`
  - ✅ 已改用 **sql.js**（纯 WASM 零编译，package.json 已锁定 `sql.js@^1.12.0`）
- 配环境变量：把 `.env.example` 复制为 `.env` 填 `DEEPSEEK_API_KEY`

### ⑤ 进程常驻（计划任务，非 PM2）
> ⚠️ SSH 会话内 `Start-Process` 起的进程会随会话结束被杀——必须用计划任务（SYSTEM，开机自启）。

1. 写启动脚本 `C:\luna-server\start_server.bat`（**必须 cd 到正确目录**，否则 .env 读不到）：
   ```bat
   @echo off
   cd /d C:\luna-server
   "C:\nodejs\node.exe" index.js >> C:\luna-server\service.log 2>&1
   ```
   > ⚠️ 用 Node/PowerShell 生成 bat 时，反斜杠会被 JS 转义吞掉（`\l`→`l`、`\n`→换行）→ 必须用 `String.raw` 构造 + 写完后 `type` 验证内容。

2. 注册计划任务（**计划任务不能直接执行 .bat**，需 `cmd.exe /c`）：
   ```powershell
   $action    = New-ScheduledTaskAction -Execute 'C:\Windows\System32\cmd.exe' -Argument '/c C:\luna-server\start_server.bat'
   $trigger   = New-ScheduledTaskTrigger -AtStartup
   $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
   Register-ScheduledTask -TaskName 'luna-server' -Action $action -Trigger $trigger -Principal $principal -Force
   Start-ScheduledTask -TaskName 'luna-server'
   ```
   - 验证：`schtasks /Query /TN luna-server /V` → `LastTaskResult=267009`（=运行中）

### ⑥ 放行防火墙（Windows 防火墙 + 云安全组双层）
- Windows 防火墙（服务器上）：
  ```powershell
  New-NetFirewallRule -DisplayName 'luna3000' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Profile Any -Enabled True -Force
  ```
- 云安全组：腾讯云控制台放行 3000（见①）
- **排查口诀**：公网 `TIMEOUT` = 云安全组没放行；`ECONNREFUSED` = Windows 防火墙拦（RST）

### ⑦ 验证（全链路）
```bash
# 本机测公网
curl http://IP:3000/health          # {"ok":true,"name":"luna-server"}
curl -X POST http://IP:3000/api/records -H "Content-Type: application/json" -d '{"userId":"t","record":{"date":"2026-8-31","type":"period"}}'
curl http://IP:3000/api/records/t   # 读回
# AI 对话（需 .env 有真实 Key）
curl -X POST http://IP:3000/api/ai/chat -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"你好"}]}'
```
> 本次实测：/health 200、records 写读 ✅、AI chat 200（deepseek-v4-flash）✅、跨 SSH 会话常驻 ✅

### ⑧ 运维命令
- 重启后端：`schtasks /End /TN luna-server` + `Start-ScheduledTask -TaskName luna-server`
- 看日志：`type C:\luna-server\service.log`；改代码后重启计划任务即可生效

---

## 三、方案 A（Linux）：部署后端到云服务器（约 30 分钟）

### 1. 准备服务器
- 推荐：2 核 2G 内存，Ubuntu 22.04 / Debian 12，**开放 3000 端口**（或 80/443 走反代）
- 国内云：阿里云/腾讯云轻量服务器（约 几十元/月）

### 2. 服务器上执行
```bash
# ① 装 Node 18+ 与构建工具（better-sqlite3 需编译）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs build-essential python3

# ② 装 PM2（进程守护）
sudo npm i -g pm2

# ③ 上传 server/ 代码到服务器（不含 node_modules/、data/、.env）
#    本地执行：scp -r d:\Luna\server user@服务器IP:/srv/luna-server
#    （若没有服务器，可先用 git 仓库 clone server 目录）

# ④ 安装依赖 + 配置环境变量
cd /srv/luna-server
npm install                       # 会编译 better-sqlite3
cp .env.example .env
nano .env                         # 填入 DEEPSEEK_API_KEY=sk-xxx

# ⑤ 启动（PM2 守护 + 开机自启）
pm2 start index.js --name luna-server
pm2 save && pm2 startup
```

### 3. 验证
```bash
curl http://服务器IP:3000/health     # 应返回 {"ok":true,"name":"luna-server"}
curl -X POST http://服务器IP:3000/api/records \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","record":{"date":"2026-8-31","type":"period"}}'
```

### 4. 强烈建议加 HTTPS（健康数据必须加密）
```bash
# 用 nginx 反向代理 + 免费证书（Let's Encrypt）
sudo apt install nginx certbot python3-certbot-nginx
# nginx 配置：server_name api.你的域名.com; proxy_pass http://127.0.0.1:3000;
sudo certbot --nginx -d api.你的域名.com
# 之后客户端 BASE_URL 用 https://api.你的域名.com/api
```

---

## 四、第二步：改客户端 BASE_URL

`src/services/api.js`（**已改为 `__DEV__` 自动切换，无需手改**）：
```js
// release 走公网，开发构建走本地（真机 adb reverse）
export const BASE_URL = __DEV__
  ? 'http://127.0.0.1:3000/api'
  : 'http://49.232.49.16:3000/api';   // ← 改成你的公网地址
```
> 若用域名 + HTTPS：`https://api.你的域名.com/api`（生产推荐；当前为 IP 直连，健康数据建议尽快上 HTTPS）。

---

## 五、第三步：打 release APK

### 方式 A：快速发给朋友（当前即可，用 debug 签名）
当前 `android/app/build.gradle` 的 `release` 已配置用 `debug.keystore` 签名——**能装、能测**，但不适合上架。
```bash
cd d:\Luna\android
.\gradlew assembleRelease
# 产物：android\app\build\outputs\apk\release\app-release.apk
```

### 方式 B：正式签名（上架 / 正式发布）
```bash
# ① 生成正式 keystore（密码务必自己保管，勿提交 Git）
keytool -genkey -v -keystore release.keystore -alias luna -keyalg RSA -keysize 2048 -validity 10000

# ② android/app/build.gradle 配置正式签名
#   signingConfigs { release { storeFile file('release.keystore') storePassword '***'
#                              keyAlias 'luna' keyPassword '***' } }
#   buildTypes { release { signingConfig signingConfigs.release ... } }

# ③ 重新构建
.\gradlew assembleRelease
```
> `release.keystore` 与密码**不要提交 Git**（加入 .gitignore）。

---

## 六、第四步：分发

- **微信（本次采用）**：⚠️ 微信会拦截 `.apk`（自动改后缀）→ **打成 zip 发**：
  - 产物目录 `D:\Luna\dist\`：`Luna-v1.0.apk` + `安装说明.txt` → `Compress-Archive` 打成 `Luna-微信安装包.zip`（27MB）
  - 对方：下载 → 解压得 apk → 安装（Android 提示「未知来源」→ 允许）
- **小范围**：APK 直接发网盘/蓝奏云（Android 允许侧载安装）
- **测试分发**：Firebase App Distribution（免费，扫码安装）、Diawi
- **正式上架**：Google Play（$25 开发者号）/ 国内华为小米应用市场（需开发者认证 + 资质）

---

## 七、多用户说明（已实现）

- `App.js` 已改用 `getDeviceUserId()`：每台设备首次启动生成**匿名随机 userId**（存 AsyncStorage），
  云同步按 userId 隔离 → **每人数据独立，不互相覆盖**，且不采集身份信息
- 若要"换手机登录"同一账号 → 需账号体系（邮箱注册登录），当前为设备级（隐私优先）

---

## 八、安全清单（发布前必查）

- [x] DeepSeek Key 只在服务器 `.env`（客户端无 Key；`server/.env` 已 gitignore）
- [x] Windows 防火墙放行 3000（`New-NetFirewallRule luna3000 -Profile Any`）+ 云安全组放行 3000
- [x] 进程常驻用计划任务（`schtasks` luna-server，SYSTEM + ONSTART 开机自启）
- [ ] 后端走 **HTTPS**（健康数据加密传输；当前为 IP 明文，多人使用建议尽快上）
- [x] `server/data/`、`*.db`、release keystore 不入库
- [x] 个人求职文档已 gitignore（`/*.md` 白名单 README/skill），推送前 `git status` 复核
- [ ] 后端生产环境建议加简单鉴权/限流（当前为演示级，多人使用需补）
