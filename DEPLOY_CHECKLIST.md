# 无人机租赁平台 - 部署配置清单

本文件列出系统所有需要配置的第三方服务、API密钥和生产环境配置项。
部署前请逐项确认已完成申请和配置。

---

## 1. 基础服务

### 1.1 MySQL 数据库
- **配置文件**: `backend/config.yaml` -> `database` 部分
- **必要操作**:
  - [ ] 创建数据库: `CREATE DATABASE wurenji CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  - [ ] 创建专用账户（禁止使用root）
  - [ ] 配置 host、port、user、password、dbname

### 1.2 Redis 缓存
- **配置文件**: `backend/config.yaml` -> `redis` 部分
- **用途**: 验证码存储、Token黑名单、会话缓存
- **必要操作**:
  - [ ] 部署 Redis 服务（建议 6.0+）
  - [ ] 设置 Redis 密码
  - [ ] 配置 host、port、password

### 1.3 JWT 密钥
- **配置文件**: `backend/config.yaml` -> `jwt` 部分
- **必要操作**:
  - [ ] 生成随机密钥（至少32字符）: `openssl rand -base64 32`
  - [ ] 配置 access_expire 和 refresh_expire

---

## 2. 短信服务（SMS）

### 2.1 阿里云短信
- **配置文件**: `backend/config.yaml` -> `sms` 部分
- **申请地址**: https://dysms.console.aliyun.com/
- **申请步骤**:
  1. [ ] 注册阿里云账号并完成实名认证
  2. [ ] 进入短信服务控制台
  3. [ ] 申请短信签名（如"无人机租赁平台"）
  4. [ ] 申请短信模板（验证码模板，参数: code, min）
  5. [ ] 创建 AccessKey（建议使用RAM子账户）
- **需要配置**:
  - `sms.provider`: 改为 `aliyun`
  - `sms.sign_name`: 短信签名名称
  - `sms.template_code`: 短信模板Code
  - `sms.aliyun.access_key_id`: AccessKey ID
  - `sms.aliyun.access_key_secret`: AccessKey Secret
- **预计费用**: ~0.045元/条

---

## 3. 支付服务

### 3.1 微信支付
- **配置文件**: `backend/config.yaml` -> `payment.wechat` 部分
- **申请地址**: https://pay.weixin.qq.com/
- **前置条件**: 需要企业营业执照
- **申请步骤**:
  1. [ ] 在微信开放平台注册移动应用 (https://open.weixin.qq.com/)
  2. [ ] 申请微信商户号 (https://pay.weixin.qq.com/)
  3. [ ] 在商户平台绑定AppID
  4. [ ] 设置API密钥（账户中心 -> API安全）
  5. [ ] 下载API证书（如使用APIv3）
  6. [ ] 配置支付回调域名
- **需要配置**:
  - `payment.wechat.app_id`: 开放平台移动应用AppID
  - `payment.wechat.mch_id`: 商户号
  - `payment.wechat.api_key`: API密钥
  - `payment.wechat.cert_path`: 证书路径（APIv3）
  - `payment.wechat.key_path`: 私钥路径（APIv3）
  - `payment.wechat.notify_url`: 回调地址（如 `https://api.yourdomain.com/api/v1/payment/wechat/notify`）
- **移动端配置**:
  - iOS: 在 Xcode 中配置 URL Scheme 为微信 AppID
  - Android: 在 AndroidManifest.xml 中配置微信相关 Activity
- **预计费用**: 0.6% 交易手续费

### 3.2 支付宝
- **配置文件**: `backend/config.yaml` -> `payment.alipay` 部分
- **申请地址**: https://open.alipay.com/
- **前置条件**: 需要企业营业执照
- **申请步骤**:
  1. [ ] 注册支付宝开放平台企业账号
  2. [ ] 创建移动应用
  3. [ ] 申请"APP支付"功能
  4. [ ] 使用密钥生成工具生成RSA2密钥对
  5. [ ] 在开放平台配置应用公钥，获取支付宝公钥
  6. [ ] 配置授权回调地址
- **需要配置**:
  - `payment.alipay.app_id`: 应用ID
  - `payment.alipay.private_key`: 应用私钥（RSA2）
  - `payment.alipay.public_key`: 支付宝公钥
  - `payment.alipay.sandbox`: 生产环境设为 `false`
  - `payment.alipay.notify_url`: 回调地址
- **开发调试**: 可先使用沙箱环境 (https://opendocs.alipay.com/open/02np95)
- **预计费用**: 0.6% 交易手续费

---

## 4. 地图服务

### 4.1 高德地图
- **后端配置**: `backend/config.yaml` -> `amap` 部分
- **移动端配置**: `mobile/.env` -> `AMAP_ANDROID_KEY` / `AMAP_IOS_KEY`
- **申请地址**: https://lbs.amap.com/
- **申请步骤**:
  1. [ ] 注册高德开放平台账号
  2. [ ] 创建应用
  3. [ ] 添加 Web服务 Key（后端地理编码/POI搜索）
  4. [ ] 添加 Android SDK Key（移动端地图显示）
  5. [ ] 添加 iOS SDK Key（移动端地图显示）
  6. [ ] 添加 Web端(JS API) Key（管理后台地图）
- **需要配置**:
  - `amap.api_key`: Web服务 API Key（后端使用）
  - `amap.web_key`: Web端 JS API Key（管理后台使用）
  - `AMAP_ANDROID_KEY`: Android SDK Key（.env）
  - `AMAP_IOS_KEY`: iOS SDK Key（.env）
- **移动端集成**:
  - [ ] 安装: `npm install react-native-amap3d`
  - [ ] Android: 在 AndroidManifest.xml 配置 API Key
  - [ ] iOS: 在 Info.plist 配置 API Key
- **免费额度**: 个人开发者 5000次/天（Web服务API），商用需购买

---

## 5. 推送通知服务

### 5.1 极光推送 (JPush)
- **后端配置**: `backend/config.yaml` -> `push` 部分
- **移动端配置**: `mobile/.env` -> `JPUSH_APP_KEY` / `PUSH_ENABLED`
- **申请地址**: https://www.jiguang.cn/push
- **申请步骤**:
  1. [ ] 注册极光开发者账号
  2. [ ] 创建应用
  3. [ ] 获取 AppKey 和 Master Secret
  4. [ ] Android: 配置应用包名
  5. [ ] iOS: 上传 APNs 推送证书（开发+生产）
- **需要配置**:
  - `push.provider`: 改为 `jpush`
  - `push.jpush.app_key`: 应用 AppKey
  - `push.jpush.master_secret`: Master Secret
  - `JPUSH_APP_KEY`: AppKey（.env）
  - `PUSH_ENABLED`: 改为 `true`（.env）
- **移动端集成**:
  - [ ] 安装: `npm install jpush-react-native jcore-react-native`
  - [ ] Android: 在 build.gradle 配置 JPush
  - [ ] iOS: 启用 Push Notifications capability
- **免费额度**: 免费版支持无限推送（有并发限制）

---

## 6. 第三方登录

### 6.1 微信登录
- **后端配置**: `backend/config.yaml` -> `oauth.wechat` 部分
- **移动端配置**: `mobile/.env` -> `WECHAT_APP_ID`
- **申请地址**: https://open.weixin.qq.com/
- **前置条件**: 需要企业开发者资质
- **申请步骤**:
  1. [ ] 注册微信开放平台开发者账号
  2. [ ] 创建移动应用（需提供应用信息和截图）
  3. [ ] 申请"微信登录"功能
  4. [ ] 获取 AppID 和 AppSecret
  5. [ ] 配置 Bundle ID (iOS) 和 应用签名 (Android)
- **需要配置**:
  - `oauth.wechat.app_id`: 开放平台 AppID
  - `oauth.wechat.app_secret`: 应用 AppSecret
  - `WECHAT_APP_ID`: AppID（.env）
- **移动端集成**:
  - [ ] 安装: `npm install react-native-wechat-lib`
  - [ ] iOS: 配置 URL Scheme、Universal Links
  - [ ] Android: 配置 WXEntryActivity
- **审核周期**: 约 7 个工作日
- **费用**: 开放平台认证费 300元/年

### 6.2 QQ登录
- **后端配置**: `backend/config.yaml` -> `oauth.qq` 部分
- **移动端配置**: `mobile/.env` -> `QQ_APP_ID`
- **申请地址**: https://connect.qq.com/
- **申请步骤**:
  1. [ ] 注册 QQ 互联开发者账号
  2. [ ] 创建移动应用
  3. [ ] 获取 AppID 和 AppKey
  4. [ ] 配置 Bundle ID (iOS) 和 应用签名 (Android)
- **需要配置**:
  - `oauth.qq.app_id`: QQ互联 AppID
  - `oauth.qq.app_key`: QQ互联 AppKey
  - `QQ_APP_ID`: AppID（.env）
- **移动端集成**:
  - [ ] 安装: `npm install react-native-qq` 或同类SDK
  - [ ] iOS: 配置 URL Scheme（tencent + AppID）
  - [ ] Android: 配置 QQ 相关 Activity

---

## 7. 文件存储

### 7.1 本地存储（开发环境）
- **配置文件**: `backend/config.yaml` -> `upload` 部分
- **当前配置**: 本地磁盘 `./uploads` 目录
- **限制**: 仅适合开发测试

### 7.2 云存储（生产环境建议）
- **推荐方案**: 阿里云 OSS / 腾讯云 COS
- **迁移步骤**:
  1. [ ] 创建存储桶（Bucket）
  2. [ ] 配置 CORS 允许客户端直传
  3. [ ] 修改 upload 包支持云存储上传
  4. [ ] 配置 CDN 加速域名
- **预计费用**: 约 0.12元/GB/月（标准存储）

---

## 8. 域名和 SSL

### 8.1 域名配置
- [ ] 注册域名（如 wurenji.com）
- [ ] 备案（中国大陆服务器必须）
- [ ] 配置 DNS 解析
  - `api.wurenji.com` -> 后端API服务器
  - `admin.wurenji.com` -> 管理后台
  - `cdn.wurenji.com` -> CDN（可选）

### 8.2 SSL 证书
- [ ] 申请 SSL 证书（推荐 Let's Encrypt 免费证书）
- [ ] 配置 Nginx 反向代理 + HTTPS
- [ ] 强制 HTTPS 跳转

---

## 9. 配置文件对照表

| 服务 | 后端配置路径 | 移动端配置路径 | 管理后台配置路径 |
|------|-------------|---------------|----------------|
| API地址 | `server.port` | `.env` -> `API_BASE_URL` | `.env` -> `VITE_API_BASE_URL` |
| 数据库 | `database.*` | - | - |
| Redis | `redis.*` | - | - |
| JWT | `jwt.*` | - | - |
| 短信 | `sms.*` | - | - |
| 微信支付 | `payment.wechat.*` | - | - |
| 支付宝 | `payment.alipay.*` | - | - |
| 高德地图 | `amap.*` | `.env` -> `AMAP_*` | - |
| 推送 | `push.*` | `.env` -> `JPUSH_*` | - |
| 微信登录 | `oauth.wechat.*` | `.env` -> `WECHAT_APP_ID` | - |
| QQ登录 | `oauth.qq.*` | `.env` -> `QQ_APP_ID` | - |

---

## 10. 部署检查清单

### 部署前
- [ ] 所有配置文件已从 `.example` 复制并填写
- [ ] `backend/config.yaml` 已通过 `ValidateForProduction()` 验证
- [ ] 数据库已创建并执行 migrations
- [ ] Redis 已部署并设置密码
- [ ] SSL 证书已配置
- [ ] CORS 配置了正确的生产域名

### 部署后
- [ ] 短信验证码发送正常
- [ ] 支付流程完整（创建->支付->回调->状态更新）
- [ ] 推送通知到达测试
- [ ] 第三方登录测试（微信/QQ）
- [ ] 文件上传/下载正常
- [ ] WebSocket 连接正常
- [ ] 地图功能正常（地理编码、POI搜索）
