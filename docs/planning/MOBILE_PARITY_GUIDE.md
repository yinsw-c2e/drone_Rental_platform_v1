# 移动端(React Native)与小程序对齐任务指导书

> 一次性发给 Codex 的工作说明书。Codex 按 Phase 顺序推进,每完成一个里程碑按第 6 节格式回报。

## 1. 背景与目标

仓库根: `/Users/yinswc2e/Code/drone_Rental_platform_v1`

- `mini-program/` — **真源**。Taro + React + TS,微信小程序为主。过去两个月经历了"双端模式"重构(customer/provider)和大量业务收口。
- `mobile/` — **本次对齐目标**。React Native 0.84 + RN-Web + React Navigation v7 + Redux Toolkit。文件结构与小程序大体平行,但落后约 13 个 feature commit。
- `admin/`、`backend/` — 不在本次任务范围。后端能力已就绪,mobile 直接用,不必碰。

**目标**:把小程序近期所有非微信平台专有的改动移植到 mobile,达成功能、文案、视觉、状态机的"一致"。允许的不一致:UI 组件细节(Taro 视图 vs RN 视图)、推送实现路径(订阅消息 vs JPush)、登录原语(wx.login vs react-native-wechat-lib)。

## 2. 工作原则

1. **mini-program 是真源**。每个任务的第一动作:打开对应 mini-program 文件,理解它做什么、为什么这么做,再做 RN 等价实现。不要凭印象重写。
2. **不要改后端**。后端能力(`role_summary` / `preferred_mode` / `/admin/providers` 等)都已就绪,API 契约不变。如发现 mobile 调到的接口不存在或 schema 不对,先 grep `backend/internal/api/v2/router.go` 确认路径再排查 mobile 调用方,不要去改后端。
3. **平台特定例外**(下面这些**不要**机械搬运):
   - **微信订阅消息**(`Taro.requestSubscribeMessage`、`mini-program/src/constants/subscribeTemplates.ts`、`/wechat-subscribe/*` 调用) —— 这是小程序独占能力。RN 端走 `jpush-react-native`(已装),在同一业务时机用 JPush 推送实现"端外通知"等价场景。
   - **微信自定义 TabBar**(`mini-program/src/custom-tab-bar/`) —— RN 用 `@react-navigation/bottom-tabs` 实现,视觉对齐即可。
   - **Taro.login → wechatMiniLogin** —— RN 用 `react-native-wechat-lib` 的 `sendAuthRequest` → 后端 `/auth/wechat-login`(注意:**不是** `wechat-mini-login`)。这两条登录路径后端是分开的。
4. **Taro API 一律映射成 RN 等价**:

   | Taro | RN 等价 |
   |---|---|
   | `Taro.showToast` | 用 `mobile/src/utils` 里已有 toast helper(若没有,新建一个基于 `ToastAndroid` + iOS Alert 的薄封装) |
   | `Taro.showLoading/hideLoading` | 自封 Loading Modal 组件,或用 `react-native-modal` |
   | `Taro.showModal({title, content, confirmText, showCancel})` | `Alert.alert(title, content, [{text:cancel}, {text:confirm, onPress}])` |
   | `Taro.navigateTo / switchTab / redirectTo / navigateBack` | `navigation.navigate / navigation.reset / navigation.replace / navigation.goBack` |
   | `Taro.getStorageSync / setStorageSync` | **异步** `AsyncStorage.getItem / setItem` —— 同步读取的逻辑必须改造成 useEffect 加载 |
   | `Taro.getSystemInfoSync` / `Taro.getMenuButtonBoundingClientRect` | `Dimensions.get('window')` + `useSafeAreaInsets()`;胶囊按钮位置概念在 RN 不存在,直接用安全区顶距 |
   | `useRouter().params` | `route.params`(来自 `@react-navigation/native`) |
   | `<View/Text/Image/ScrollView/Input/Button>` (Taro) | 同名 RN 组件,但 `Input → TextInput`,`Button` 通常用 `Pressable + Text` 自封 |
5. **状态层 1:1 对齐**。`authSlice`、`roleSlice`、`utils/roleSummary.ts`、`utils/preferredMode.ts`、`utils/wechatLogin.ts` 这一层应在两端代码逻辑**等价可对照**,只有存储 API(Taro Storage vs AsyncStorage)和登录原语(wx.login vs WeChat SDK)有差异。
6. **类型 + 视觉 + 文案三同步**。每改一个 screen,顺手核:文案是否照搬了小程序("我要吊运 / 我要接单"等术语)、tag/颜色是否一致、empty/loading 态文案是否一致。
7. **每完成一个里程碑**(下方分阶段),跑一次 `npx tsc --noEmit` 和 `npm run lint`,确保不打破现有构建。

## 3. 项目结构对照

| mini-program | mobile | 备注 |
|---|---|---|
| `src/pages/<area>/<page>/index.tsx` | `src/screens/<area>/<Page>Screen.tsx` | 命名规则:Page → PageScreen,文件夹大小写遵循 mobile 现状(`auth/`、`haul/`、`provider/` 已存在) |
| `src/components/AssignmentModal/` | `src/components/AssignmentModal.tsx` | 改派/抢单弹窗,**mobile 目前完全缺失**,需要新建 |
| `src/components/haul/` | `src/components/haul/` | 已存在,补差 |
| `src/services/*.ts` | `src/services/*.ts` | 一对一对应,API 路径不能动 |
| `src/store/slices/{auth,role,providerPresence}Slice.ts` | `src/store/slices/{auth,role}Slice.ts` | **providerPresence 缺失**,需要新建 |
| `src/utils/{roleSummary,wechatLogin,preferredMode,errorMessage,tabBar}.ts` | `src/utils/` | roleSummary 已存在(可能旧),wechatLogin/preferredMode/tabBar 等需要补 |
| `src/hooks/useProviderPresence.ts` | `src/hooks/`(目录可能不存在,自建) | 服务商在线/离线心跳 hook |
| `src/constants/subscribeTemplates.ts` | **不需要**(微信专有) | RN 端用 push 的 JPush 模板,见 `services/push.ts` |
| `src/custom-tab-bar/` | `src/navigation/AppNavigator.tsx` 的 BottomTabs | 视觉对齐,不要硬搬 |
| `src/app.config.ts`(分包/页面注册) | `src/navigation/AppNavigator.tsx` 路由表 | RN 没有分包概念,但每个新页都要在 AppNavigator 注册 |

## 4. 分阶段任务清单

### Phase 0 — 准入

**P0.1 确认 mobile 能起来 & 现状可见**
- `cd mobile && npm install`(先确认锁文件兼容,不行就 `--legacy-peer-deps`)
- `npm run web` 起 RN-Web 看到登录页/首页,确认改造基线可视化(真机构建留到上线前)。
- `npx tsc --noEmit` 必须先全绿。如果有遗留报错先记账(不要在本任务里隐藏)。

**P0.2 锁定 mini-program 参考快照**
- 用 `git log --oneline mini-program/` 看最新 10 个 commit,标注哪些已经在 mobile 复刻、哪些没。本任务以 mini-program 的 HEAD 为参照。

### Phase 1 — 状态层基础(必须先做完)

> 这一层是后面所有页面的依赖。先这一层全绿,后续每个页面 port 才有意义。

**T1.1 移植 `utils/roleSummary.ts`**
- 参考:`mini-program/src/utils/roleSummary.ts`
- 目标:把 mobile 同名文件改成与小程序 API 完全一致(允许 import 不同)
- 验收:`mobile/src/utils/roleSummary.ts` 导出函数集合 = 小程序版的导出集合,逐函数 typecheck 通过

**T1.2 升级 `store/slices/authSlice.ts`**
- 参考:`mini-program/src/store/slices/authSlice.ts`
- 当前 mobile 版缺少 `roleSummary` 字段、`setMeSummary`、`markMeInitialized`、storage 持久化
- 改造要点:
  - 字段补齐(`user / roleSummary / accessToken / refreshToken / isAuthenticated / meInitialized`)
  - 把 Taro storage 全部换成 `AsyncStorage`,但**注意 AsyncStorage 是异步的** —— initialState 不能同步读盘。改造成:initialState 为空,起一个 `bootstrapAuth` thunk 在 App 启动时读盘并 dispatch `setCredentials`/`setMeSummary`
  - 持久化 key 与小程序保持名字一致:`haul_auth_token` / `haul_auth_user`
- 验收:`/me` 接口返回的 role_summary 能进 store;App 重启后状态能恢复

**T1.3 新建 `store/slices/providerPresenceSlice.ts`**
- 参考:`mini-program/src/store/slices/providerPresenceSlice.ts`
- 用途:服务商在线/离线/心跳态,被 ProviderWorkbench 和派单弹窗使用

**T1.4 新建 `utils/preferredMode.ts`**
- 参考:`mini-program/src/utils/preferredMode.ts`
- 要点:RN 版本要异步 —— 先 `AsyncStorage.getItem('haul_auth_token')` 看是否登录,登录了才调 `authService.setPreferredMode(mode)`。失败 catch 后只 console.warn,不阻塞主流程

**T1.5 服务层 `services/auth.ts` 补 `setPreferredMode`**
- 与小程序同样 POST `/user/preferred-mode` { mode }
- 验收:typecheck 通过,grep 调用方为 0(下一阶段会接)

**T1.6 适配 `utils/wechatLogin.ts`**
- 参考:`mini-program/src/utils/wechatLogin.ts`
- ⚠ RN 这里实现路径不同:用 `react-native-wechat-lib` 的 `sendAuthRequest({scope:'snsapi_userinfo', state:'haul'})` 拿 code → 调后端 `/auth/wechat-login`(注意:**不是** mini-login)
- 成功后同样 dispatch `setHaulRoleMode` + `setCredentials` + 调 `syncPreferredModeWithBackend(mode)`
- 验收:函数签名与小程序一致,内部实现差异接受
- ⚠ **不要硬编码 universal link 或 wechatAppId** —— 从 `mobile/src/constants/index.ts` 的 `THIRD_PARTY_LOGIN` 读取,该常量从 `.env` 注入

**里程碑检查 M1**:跑 typecheck;mock 一次成功的 `/me` 响应,确认 `roleSummary` 落进 store。

### Phase 2 — 双端入口三屏

> 这一层决定了用户能不能选 mode、登录、注册。是用户进入应用的第一组屏幕。

**T2.1 `ModeSelectionScreen.tsx`**
- 参考:`mini-program/src/pages/auth/mode-selection/index.tsx`
- 关键行为:
  - 两张大卡:`我要吊运`(badge:推荐)/ `我要接单`,选中后调 `setHaulRoleMode` + `syncPreferredModeWithBackend`
  - 已登录直接跳首页(`Tab Home`)
  - 底部三个按钮:`微信一键登录` / `手机号登录` / `注册`
  - 顶部品牌区(logo + "重载吊运 / 无人机吊运服务平台")
- 资源:`mobile/src/assets/haul/` 应已有 `logo_haul_square.png`、`ill_mode_customer_lift.png`、`ill_mode_provider_order.png`、`icon_wechat.png` 等,确认齐全
- 验收:UI 与小程序视觉对齐,角色切换会写 redux + AsyncStorage + 后端(已登录时)

**T2.2 `LoginScreen.tsx`**
- 参考:`mini-program/src/pages/auth/login/index.tsx`
- 关键行为:
  - 接收 `route.params.roleMode`,同步到 redux
  - 手机号/密码 + 短信验证码两种走法(`finishLogin` 后 `canEnterMode` 校验)
  - 登录成功:`setHaulRoleMode` + `setCredentials` + `syncPreferredModeWithBackend(mode)` + `navigation.reset` 到 Tab
  - 失败友好提示用 `friendlyErrorMessage`
- ⚠ 当前 mobile 版较大(比小程序多),很可能是早期 UI 比较啰嗦。**不要直接覆盖**,先 diff 出"小程序有但 mobile 没"的逻辑(quickLogin、finishLogin、canEnterMode 校验、preferredMode 同步),只补这些,UI 保留 mobile 现有视觉风格
- 验收:三种登录路径(密码 / 验证码 / 微信)都能跑通

**T2.3 `RegisterScreen.tsx`**
- 参考:`mini-program/src/pages/auth/register/index.tsx`
- 关键行为:
  - **强制短信验证**(最新 commit `cc645e1` 的核心改动):用户必须先点"发送验证码"、输入验证码,才能提交注册
  - 60 秒倒计时,使用 `setInterval` 实现
  - 成功后:`setCredentials` + `syncPreferredModeWithBackend(routeRoleMode || 'customer')`
  - 如果 `routeRoleMode === 'provider'`,redirect 到 ProviderOnboarding;否则跳 Home
- ⚠ **注意 `register()` 参数顺序**: mobile 版是 `(phone, password, code, nickname?)`,与小程序 `(phone, password, nickname?, code)` **不同**,移植 mini-program 调用时要调整参数顺序
- 验收:无验证码不能注册成功;provider 角色注册完自动入 onboarding

**里程碑检查 M2**:RN-Web 起来,过一遍 mode-selection → 三种登录 → 注册 → 跳到 Home 的链路,redux devtools 看 store 状态正确。

### Phase 3 — 双端首页与入驻

**T3.1 `screens/haul/CustomerHaulHomeScreen.tsx`**
- 参考:`mini-program/src/pages/home/CustomerHaulHome.tsx`
- 关键内容:首屏地址栏、快捷下单卡片、服务市场入口、近期订单
- 最近改动:`6a29093 修复客户吊运首页地址和下单体验`、`02a4d02 完善服务商工作台和订单履约入口`
- 验收:首页一屏内能看到地址、下单入口、市场入口三块

**T3.2 `screens/haul/ProviderWorkbenchScreen.tsx`**(可能新建)
- 参考:`mini-program/src/pages/home/ProviderWorkbench.tsx` + `.scss`
- 内容:服务商工作台 —— 在线/离线开关、抢单流、当前任务、收益快照
- 依赖:`hooks/useProviderPresence`(配合 T1.3 的 slice)
- 派单弹窗:`AssignmentModal`(下一任务)

**T3.3 `components/AssignmentModal.tsx`**(新建)
- 参考:`mini-program/src/components/AssignmentModal/index.tsx` + `.scss`
- 内容:派单/改派弹窗,显示订单概要 + 倒计时 + 接单/拒单按钮
- 关联后端机制:多轮重发(commit `54cfd99`)、超时排除(commit `475ed30`)
- 验收:派单到来时弹窗自动弹出,接单/拒单各有对应 API 调用并反映到 UI

**T3.4 `ProviderOnboardingScreen.tsx`**
- 参考:`mini-program/src/pages/provider/onboarding/index.tsx`
- 当前 mobile 版 UI 比较啰嗦。要点:对齐"资质审核三步(资产 / 执行 / 整体)"的 status meta + headerCopy + 下一步动作按钮
- 验收:头部 status tag + 三步流程 + 行动按钮三块,与小程序口径一致

**里程碑检查 M3**:用 mock role_summary(customer-only / provider-pending / provider-approved 三档),看首页跳转和工作台显隐都正确。

### Phase 4 — 业务页面对齐(逐主题)

> 每个主题独立成"小任务",完成一个就提交一个 commit。

**T4.1 个人中心**
- `profile/index` 主页、`profile/owner/index` 机主子页、`profile/pilot/index` 飞手子页、`edit-profile/index`
- 参考小程序对应路径
- 注意 `e479f30 清理 TabBar、资料页和图标样式` 这个 commit 的视觉收口

**T4.2 需求**(customer 侧)
- `demand/list`、`demand/detail`、`demand/quote`、`publish/demand`、`publish/quick-order`
- 关注 `d05f89b 完善议价需求报价和能力提示`

**T4.3 供给/服务市场**(provider 侧)
- `supply/list`、`supply/detail`、`publish/supply`、`market/index`

**T4.4 订单履约**
- `orders/index`(列表)、`orders/detail`(详情)、`orders/contract`(合同)、`orders/anomaly-list`(异常)
- `orders/live` 注意 `ae06ba8 降级订单实时页并按状态停止轮询` —— 按状态停止轮询的逻辑要带上
- `fulfillment/hub`、`fulfillment/safety-check`、`after-sale/index`、`review/index`

**T4.5 支付与结算**
- `payment/index`
- `settlement/wallet`、`settlement/withdrawal`、`settlement/withdrawal-list`

**T4.6 资质与合规**
- `certification`、`verification`、`compliance`、`credit/deposit`、`credit/violation`、`credit/score`

**T4.7 无人机/飞手**
- `drone/{add,edit,detail,maintenance,nearby}`
- `pilot/{register,workbench,bind-drone}`、`owner/bind-pilot`

**T4.8 飞行/空域**
- `flight/{records,multi-point,trajectory,monitor}`
- `airspace/index`、`airspace/no-fly`

**T4.9 消息**
- `messages/index`、`chat/index`

**T4.10 地址**
- `address/book` —— `4040547 重写地址选择页并补充地址服务兜底` 这是大改,小心 port
- `map-picker/index` —— RN 用 `react-native-amap3d`(已装),与小程序 `<map>` 不一样,要做适配
- `cargo/{accept,detail,list}` 货物申报

**T4.11 货物申报**
- `publish/cargo`(创建)、`cargo/detail`(查看 + 审核结果)

**T4.12 客户实体**
- `client/profile`、`client/register`(个人 vs 企业)

> 每个主题完成后,核对小程序对应文件,确认逻辑全覆盖,跑 typecheck。

### Phase 5 — 推送(平台特定 / 不机械搬运)

**T5.1 JPush 通道对齐 mini-program 业务时机**
- 不要去复刻 `subscribeTemplates.ts`。改为:列出小程序里**在哪些业务时机**调用了 `requestSubscribeMessage`(grep `requestSubscribeMessage`),mobile 端在同一时机走 `mobile/src/services/push.ts` 调 JPush 注册/上报 deviceId 到 `/user/push-device` 类接口。
- 后端的 `MessageService` 已经有统一推送接口,RN 端只负责注册 device + 接消息时显示。
- 验收:订单状态变更、派单成功、结算落账等场景,能在系统通知栏看到 JPush 通知。

### Phase 6 — 文案 + 视觉收口

**T6.1 全局清理"开发者视角"等术语**
- 参考 commit `fb5aa31`,grep 整个 mobile 仓库的 `"开发者"、"调试"` 等遗留字眼,与小程序最终文案对齐
- 派单 hint 文案修正

**T6.2 TabBar 与图标对齐**
- 与小程序 `custom-tab-bar/assets/` 对照,确认 `mobile/src/assets/tabbar/` 图标齐全且尺寸正确
- AppNavigator 的 BottomTabs:文字、激活色、未激活色、字号 与小程序对齐

### Phase 7 — 收尾

**T7.1 跑全套 typecheck + lint + jest**
- `cd mobile && npx tsc --noEmit && npm run lint && npm test -- --passWithNoTests`
- 全绿才能提交 PR

**T7.2 RN-Web 冒烟**
- `npm run web`,过一遍:mode-selection → 三登录 → 注册 → home(双端) → onboarding(provider) → 至少一个下单链路
- 截图存档

**T7.3(可选)真机构建**
- 参考 `220d2ca 固化真机构建脚本和部署说明`,核对 mobile 端是否有等价文档,如果缺,顺手补 `mobile/docs/BUILD.md`

## 5. 全局禁忌

- ❌ 不要改 `backend/`、`admin/`、`mini-program/` 任何文件,除非是修一个 mini-program 真源 bug 顺带影响 mobile 实现的情况(此时先说出来,等用户确认)
- ❌ 不要把 `Taro.xxx` 留在 mobile 代码里
- ❌ 不要在没看小程序参照文件的情况下"凭印象"写 mobile 实现
- ❌ 不要为了快把异步 storage 强行同步化(`getItem` 没有 sync 版本,只能用 thunk / useEffect)
- ❌ 不要扩展后端 schema 或加新接口
- ❌ 不要硬编码任何 AppID、Universal Link、密钥;从 `.env` / `constants` 读

## 6. 报告格式(每完成一个 Phase 给一次汇报)

```
### Phase N 完成
- 已 port 文件: <list>
- 新建文件: <list>
- 跳过文件及原因: <list>(例如:平台专有)
- typecheck: pass / fail (附错误)
- lint: pass / fail
- RN-Web 冒烟: 截图路径
- 仍未解的问题: <list>(列阻塞点,等回复)
```

## 7. 优先级建议

如果你时间有限,按这个权重做:**Phase 1 > Phase 2 > Phase 3 > Phase 4 内 4.1/4.4/4.5 > Phase 6**。Phase 5 推送可以在所有页面对齐后再统一做。

---

> 接收方应:
> 1. 先把 Phase 0 跑通,确认基线
> 2. 严格按 Phase 1→2→3→4 顺序推进,每个里程碑检查后再前进
> 3. 中途遇到"小程序里没有但用户感觉应该有"的功能,**不要自创**,先停下来确认
> 4. 每完成一个 Phase 在终端输出报告
