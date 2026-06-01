# 微信订阅消息测试 Runbook

## 三层测试矩阵

| Layer | 内容 | 谁来跑 | 当前状态 |
|---|---|---|---|
| **L1 后端链路** | EventService → WeChatSubscribeService → grant → sender 整条调用链 | **完全自动化** | ✅ 已写集成测试 |
| **L2 前端授权** | 4 个业务入口的 `wx.requestSubscribeMessage` 弹窗能拉起 + 后端额度入库 | 必须真机 tap | 🟡 已提供集中诊断页 |
| **L3 真发微信** | 用户在微信「服务通知」里能真收到 | 必须真机 + 真模板 | 🟡 已提供 dev-trigger 端点 |

---

## L1：后端链路（一行命令）

```bash
cd backend
go test -v -run 'WeChatSubscribe' ./internal/service/... ./internal/pkg/wechat/... ./internal/repository/...
```

覆盖 5 个集成子用例 + 4 个单元用例：
- happy path：openid + grant + 白名单事件 → sender 收到正确 payload（含模板 ID / openid / data 映射）
- 无授权额度 → sender 不被调用
- 事件不在白名单 → sender 不被调用
- 用户无 openid → sender 不被调用
- subscribe 配置 disabled → 即使有额度也不发
- GrantAcceptedTemplates 去重 + 多次累加
- access_token 缓存 + 自动刷新
- 40001/42001 token 失效自动重试
- TryConsume 并发原子性

任何环节断了上面就会红。

---

## L2 + L3：用集中诊断页（推荐路径）

### 一次性微信侧准备（不可绕过）

1. 微信公众平台 → 你的小程序 → **功能 → 订阅消息**
2. 申请 1～7 个公共模板。最小可测：`order_paid`、`pilot_verification_result`、`direct_order_confirmed` 三个常用的。
3. 记下每个 template_id 和模板要求的字段名（如 `thing1` / `character_string2` / `amount3` 等）
4. **开发 → 开发管理 → 服务器域名 + IP 白名单**：把 cpolar 当前出口 IP（或线上 server IP）加进去。否则 `cgi-bin/token` 拿不到，整条链路死在第一步。

### 后端配置（编辑你本地的 `backend/config.yaml`）

```yaml
push:
  provider: mock          # L2 阶段建议先用 mock，看日志验证；L3 阶段切真
oauth:
  wechat_mini:
    app_id: "你的小程序 appid"
    app_secret: "**别提交**"    # 走环境变量更稳妥
wechat:
  subscribe:
    enabled: true
    templates:
      order_paid:
        template_id: "你申请到的 tmpl_id"
        page: "pages/orders/detail/index?orderId={order_id}"
        data:
          thing1: title
          character_string2: order_no
      pilot_verification_result:
        template_id: "你申请到的 tmpl_id"
        page: "pages/profile/index"
        data:
          thing1: title
          thing2: content
```

`data` 字段映射规则：键 = 微信模板字段名；值 = 后端 dataCtx 里的 key。前缀语法：
- `literal:xxx`：字面量
- `amount:cents`：字段是分（int），渲染为「12.34元」
- `time:paid_at`：字段是 time.Time，渲染为「2026-05-30 10:20」

填了 template_id 的事件才会真发；没填的静默跳过。

### 前端配置

编辑 `mini-program/src/constants/subscribeTemplates.ts`：

```ts
export const WECHAT_SUBSCRIBE_TEMPLATES = {
  directOrderCreated: '',                           // ← 这里填真 template_id
  directOrderConfirmed: '<your_tmpl_id_confirmed>',
  orderPaid: '<your_tmpl_id_paid>',
  settlementSettled: '',
  broadcastAutoAssigned: '',
  dispatchCreated: '',
  pilotVerificationResult: '<your_tmpl_id_pilot>',
};
```

空串会被 `compactTemplateIds` 自动过滤，但完全没填就拉不起任何授权框。

### 重编小程序

```bash
cd mini-program
npm run build:weapp:e2e   # 用 cpolar URL
```

### 用诊断页一次性跑完 L2

1. 微信开发者工具打开 dist/ → 用真机调试或 IDE 模拟器
2. 任意账号登录
3. 进设置页 → 滚到底「诊断信息」section → 点「订阅消息诊断」
4. 上方 4 个模板组按钮挨个点：
   - **客户下单模板组**：模拟设置开关/快单/服务市场入口
   - **服务商工作台模板组**：模拟工作台上线入口
   - **飞手资质模板组**：模拟飞手注册入口
   - **设置开关（全量）**：模拟设置页通知开关
5. 每个按钮点了应该弹微信原生授权框。点「允许」后日志区显示「全部接受 N/N」。

L2 通过 = 日志区四组都是绿色「全部接受」。任意组：
- 「模板组为空」→ 该组对应的 template_id 没填
- 「一个都没接受」→ template_id 与微信后台不一致（最常见原因）/ 用户点了"拒绝"
- 「调用 requestSubscribe 失败」→ 看 toast 报错；可能是 wx.requestSubscribeMessage 配置不对

### 用诊断页跑 L3（真发到手机）

前提：L2 已通过（账号已有授权额度）+ 后端 `push.provider != mock`（mock 模式只会打日志不发真消息）。

1. 同一个诊断页，下半部分「Layer 3 · 后端触发 SendEvent」
2. 选事件类型（默认 order_paid）
3. extras 默认 `{"order_id": 1, "order_no": "DEV-TEST"}`，按你配的模板 `data` 字段映射改
   - 比如你的 `order_paid.data` 里有 `amount3: amount:income_amount`，就要加 `"income_amount": 12345`
4. 点「触发后端 SendEvent」
5. 日志区显示「已发送」后，**打开手机微信，找「服务通知」**，应该有一条新通知

L3 通过 = 手机微信收到了模板对应的通知。失败的常见原因：
- 收不到 + 后端日志 `wechat subscribe rejected by user (43101)` → 账号没授权或额度已耗尽，回到 L2 重新拉一次授权
- 收不到 + 后端日志 `wechat subscribe template data mismatch (47003)` → extras 字段映射对不上模板要求，去模板详情核对字段名
- 收不到 + 没任何日志 → 检查 `wechat.subscribe.enabled` 是 true 吗？事件类型在白名单吗？
- 后端日志 `wechat access token http status: 5xx` → IP 白名单没生效

---

## 上线 checklist

- [ ] `backend/config.yaml` 的 `push.provider` 不是 `mock`
- [ ] `wechat.subscribe.enabled: true`
- [ ] 至少配齐 1 个真 template_id
- [ ] `oauth.wechat_mini.app_id` / `app_secret` 已填且不在 git 里
- [ ] 微信公众平台已加 server 出口 IP 到白名单
- [ ] 微信公众平台已加 cpolar / 生产域名到 request 合法域名
- [ ] 前端 `subscribeTemplates.ts` 对应 template_id 已填
- [ ] 真机至少跑通一次 L3（手机微信收到一条）
- [ ] dev-trigger 端点已确认在 release 模式被 `403`（gin mode = release 时禁用）

---

## API 参考

### `POST /api/v2/push/wechat-subscribe`
小程序端授权后上报，用于累加额度。已在 4 个入口自动调用，无需手动。

```json
{ "accepted_template_ids": ["tmpl_xxx", "tmpl_yyy"] }
```

### `POST /api/v2/push/wechat-subscribe/dev-trigger`（仅 debug/test mode）
直接触发一次 SendEvent，绕过业务流程。

```json
{
  "event_type": "order_paid",
  "extras": { "order_id": 1, "order_no": "DEV-TEST" }
}
```

返回 `{ "triggered": true, ... }`。release 模式返回 403。
