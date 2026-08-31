# Luna · 部署后端到公网 + 发布完整版 APK

> 目标：让其他人也能完整使用 Luna（AI 云端 + RAG + PDF + 云同步 + 各自独立数据）。
> 架构：`Luna App（Android）` ↔ `公网后端 server/（Express + SQLite + DeepSeek 代理）`

---

## 一、总体流程

```
① 云服务器部署 server/  →  ② 客户端 BASE_URL 改公网地址  →  ③ 打 release APK  →  ④ 分发
```

---

## 二、第一步：部署后端到云服务器（约 30 分钟）

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

## 三、第二步：改客户端 BASE_URL

`src/services/api.js`：
```js
// 发布版改成公网地址（开发时用 127.0.0.1:3000 / 10.0.2.2:3000）
export const BASE_URL = 'https://api.你的域名.com/api';
```
> 也可用 IP：`http://服务器IP:3000/api`（不推荐，明文 + 需手动信任证书）。

---

## 四、第三步：打 release APK

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

## 五、第四步：分发

- **小范围**：APK 直接发微信/网盘/蓝奏云（Android 允许侧载安装）
- **测试分发**：Firebase App Distribution（免费，扫码安装）、Diawi
- **正式上架**：Google Play（$25 开发者号）/ 国内华为小米应用市场（需开发者认证 + 资质）

---

## 六、多用户说明（已实现）

- `App.js` 已改用 `getDeviceUserId()`：每台设备首次启动生成**匿名随机 userId**（存 AsyncStorage），
  云同步按 userId 隔离 → **每人数据独立，不互相覆盖**，且不采集身份信息
- 若要"换手机登录"同一账号 → 需账号体系（邮箱注册登录），当前为设备级（隐私优先）

---

## 七、安全清单（发布前必查）

- [ ] DeepSeek Key 只在服务器 `.env`（客户端无 Key；`server/.env` 已 gitignore）
- [ ] 后端走 **HTTPS**（健康数据加密传输）
- [ ] `server/data/`、`*.db`、release keystore 不入库
- [ ] 个人求职文档已 gitignore（`/*.md` 白名单 README/skill），推送前 `git status` 复核
- [ ] 后端生产环境建议加简单鉴权/限流（当前为演示级，多人使用需补）
