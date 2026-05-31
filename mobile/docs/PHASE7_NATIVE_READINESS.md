# Phase 7 Native Readiness

## Build Readiness Summary

| 项 | 结果 | 备注 |
| --- | --- | --- |
| T7.0 baseline | 通过 | `npx tsc --noEmit`、`npx jest --runInBand`、`npm run lint` 均为 exit 0；lint 当前为 0 errors / 106 warnings |
| wechat-lib patch | 已清理 | 旧 patch 含大量 `android/build` 产物，并夹带 1 个真实源码 diff；已重新生成干净 patch，只保留 `WeChatModule.java` 的 `getName()` 改动 |
| `npm install` postinstall | 通过 | `patch-package` 成功应用 `react-native-amap3d@3.2.4` 和 `react-native-wechat-lib@1.1.27` |
| Android clean | 通过 | `mobile/android ./gradlew clean` 成功 |
| Android debug build | 通过 | `mobile/android ./gradlew assembleDebug` 成功，日志见 `/tmp/android_build.log` |
| iOS pod install | 通过 | 卸载遗留 `jcore-react-native` 后，`JPush 6.0.0` 自带的 `JCore 5.4.0` 接管，`pod install` 成功 |

## 配置文件与环境变量审计

| 项 | 文件位置 | 是否存在 | 是否非空 | 备注 |
| --- | --- | --- | --- | --- |
| WECHAT_APP_ID | `mobile/.env` | 是 | 是 | 真机微信登录必需；仅确认配置存在，未验证开放平台配置有效性 |
| WECHAT_UNIVERSAL_LINK | `mobile/.env` | 否 | 否 | iOS 微信登录必需；需要从微信开放平台 iOS Universal Link 配置获取，并写入 `.env` |
| JPUSH_APP_KEY | `mobile/.env` | 是 | 是 | 真机端外通知必需；Android manifest placeholder 已接入，iOS pods 已能解析 JPush/JCore |
| API_BASE_URL | `mobile/.env` | 是 | 是 | API 通信必需；当前为开发环境地址，真机可用性依赖该地址在设备网络中可访问 |
| Android signing config | `mobile/android/app/build.gradle` + `~/.gradle/gradle.properties` | 部分 | 部分 | debug keystore 已配置；release 当前仍使用 debug signing，且 `~/.gradle/gradle.properties` 缺失 release keystore 参数，正式 release 构建前需补生产签名 |
| iOS signing | `mobile/ios/WurenjiMobile.xcodeproj/project.pbxproj` | 是 | 是 | 已有 `DEVELOPMENT_TEAM`、bundle id 和 iPhone Developer identity；仍需在 Xcode/Apple Developer 中确认真机 profile 与 entitlements |
| amap key (高德) | `mobile/.env`、`mobile/android/gradle.properties`、`mobile/ios/WurenjiMobile/Info.plist` | 是 | 是 | Android/iOS key 均有配置入口；本轮仅确认存在，未验证高德控制台包名/bundle id 授权 |

## Native Build Notes

- Android 已成功进入并完成 `assembleDebug`，没有卡在 Gradle 同步、依赖解析、JPush、amap3d、wechat-lib 或 signing 配置。
- Android build 中出现第三方库 warning，包括 D8 stack map table warning、deprecated API warning、`librnupdate.so` / `libAMapSDK_MAP_v9_8_3.so` strip warning；这些未阻塞 debug 包构建。
- iOS `pod install` 已通过——`jcore-react-native` 卸载后 `JPush 6.0.0` 自带的 JCore 5.x 接管，无冲突。

## 真机验证待办

### 登录链路

- [ ] 装包到 Android 真机
- [ ] mode-selection 选「我要吊运」→ 微信一键登录 → 跳首页
- [ ] mode-selection 选「我要接单」→ 注册新账号(短信码必填)→ 跳 ProviderOnboarding
- [ ] 退出 → 用注册的账号密码登录 → 跳首页
- [ ] App 杀掉重开 → 看是否自动登录(bootstrapAuth 生效)

### 双端切换

- [ ] customer 模式首页能看见地址栏、市场、近期订单
- [ ] provider 模式首页能看见工作台、上线开关、附近订单卡片(下线态)
- [ ] 服务商上线 → 附近订单出现派单 → 看 AssignmentModal 弹窗
- [ ] AssignmentModal 接受 → 跳 OrderDetail;拒绝 → 弹窗消失

### 推送

- [ ] 真机后端推一条订单状态变更通知 → 通知栏看到
- [ ] 点击通知 → 跳到对应 OrderDetail / DispatchTaskDetail / Wallet
- [ ] App 在前台时收通知 → 应静默(只有 click 才路由)
- [ ] App 未登录时收通知 → 点击 → 登录后自动跳目标页(postAuthRedirect)

### 心跳生命周期(Phase 3 修过)

- [ ] 服务商上线后切到其他 tab → 心跳应停(看 backend log)
- [ ] App 切后台 → 心跳应停
- [ ] App 回前台 → 心跳应恢复

### 主流程

- [ ] 客户下单 → 跳 OrderLive → 看实时进度 → 进入终态(delivered)后轮询自动停
- [ ] 客户付款 → 走完支付 → 订单状态翻 paid
- [ ] 提现:bank_card 走通(真实姓名必填),alipay/wechat 走通(无真实姓名)
- [ ] 提现金额 < 2 元应被拦截

### 已知不在范围

- ReviewScreen 评价对象 fallback 缺(Codex 已标记,真机看是否实际阻断)
- iOS 真机构建未跑；本轮只跑到 `pod install`，该步骤已通过
