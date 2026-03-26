# 移动端减负改版执行规划

## 1. 文档目的

本文件用于把当前“移动端不好找、层级偏深、心智负担偏重”的问题

它的用途有三个：

1. 作为本轮改版的单一真相源，避免不同模型各自发挥
2. 作为任务拆分清单，方便把编码工作分发给其他模型
3. 作为后续 review 基线，判断实现是否跑偏

本轮工作只针对移动端信息架构、导航落地页、首页与“我的”页减负，不处理后端领域模型重构。

## 2. 当前基线快照

基线时间：`2026-03-26 21:00:33 CST`

仓库状态：

- 仓库路径：`/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1`
- 当前分支：`main`
- 当前提交：`d5f6dffb0289dafa122c908895b0cc207a40224e`
- 当前工作区：`clean`

当前版本关键事实：

- 底部导航当前为 `首页 / 市场 / 履约 / 消息 / 我的`
- Native 入口在 [MainNavigator.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/navigation/MainNavigator.tsx#L122)
- Web 预览手工维护了一套等价 Tab 逻辑，在 [index.web.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/index.web.tsx#L275) 与 [index.web.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/index.web.tsx#L534)
- 首页主文件为 [HomeScreen.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/screens/home/HomeScreen.tsx)
- 市场落地页当前为 [MarketHubScreen.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/screens/market/MarketHubScreen.tsx)
- 履约落地页当前为 [FulfillmentHubScreen.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/screens/fulfillment/FulfillmentHubScreen.tsx)
- “我的”主文件为 [ProfileScreen.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/screens/profile/ProfileScreen.tsx)

## 3. 本轮改版目标

本轮不是做大规模视觉翻新，而是降低首次使用和日常使用时的认知负荷。

要达成的结果只有四个：

1. 用户进入 Tab 后先看到内容，而不是先看到解释页或目录页
2. 首页只回答“现在最该处理什么”，不再承担业务百科和总控台角色
3. 用户不需要先理解“供给 / 履约 / 候选 / 驾驶舱”等内部术语，才能找到入口
4. 高频动作的入口数量减少，但带上下文的深链入口仍保留

## 4. 本轮冻结决策

以下决策在本轮中视为冻结，其他模型不得自行改动方向。

### 4.1 顶层导航冻结为 5 个一级 Tab

继续保留 5 个一级 Tab：

- `首页`
- `市场`
- `进度`
- `消息`
- `我的`

说明：

- 用户可见文案把当前 `履约` 改成 `进度`
- 内部 route key 可以继续保留 `Orders`，不强制重命名，以降低改动面

### 4.2 页面对象边界继续保持

沿用现有业务文档的对象边界，不允许为了“看起来简单”而重新混页：

- `需求`
- `供给`
- `订单`
- `派单任务`
- `飞行记录`

约束：

- 订单列表仍然只展示订单
- 需求列表仍然只展示需求
- 派单任务仍然只展示派单任务
- 首页可以聚合“待办”，但不能把对象语义搞乱

### 4.3 本轮不改后端契约

本轮默认不新增后端接口、不修改 API v2 契约、不修改数据库结构。

如果某个任务必须依赖后端新能力，执行模型必须先停下并回报，不允许擅自扩大范围。

### 4.4 先减法，再重做

优先顺序固定如下：

1. 去掉重复和解释性内容
2. 把 Tab 落地页改成内容页
3. 再做局部新结构

不要一上来全量重做所有页面。

### 4.5 Native 与 Web 必须同步

任何涉及底部导航、Tab 标签、Tab 落地组件的改动，必须同时更新：

- [MainNavigator.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/navigation/MainNavigator.tsx)
- [index.web.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/index.web.tsx)

只改其中一端视为未完成。

## 5. 当前问题定位

### 5.1 首页当前是“角色驱动”，不是“任务驱动”

[HomeScreen.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/screens/home/HomeScreen.tsx#L324) 先要求用户切角色，再用不同角色拼接 Hero、指标、待办、快捷入口、进行中任务、市场 Feed。

实际问题：

- 用户先被迫理解自己现在站在哪个角色视图里
- 进入首页后同时看到 5 段内容，信息层过多
- 同一个动作会在 Hero、待办、快捷入口、列表页中重复出现

### 5.2 市场和履约当前是“目录页”

[MarketHubScreen.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/screens/market/MarketHubScreen.tsx#L62) 本质是在列动作卡。

[FulfillmentHubScreen.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/screens/fulfillment/FulfillmentHubScreen.tsx#L63) 也是在列动作卡。

实际问题：

- 用户点进 Tab 后没有马上看到真实内容
- 产生“我又进入了一层菜单”的体感
- 用户需要先理解“这里是做什么的”，再去点目标页面

### 5.3 “我的”页暴露了太多系统概念

[ProfileScreen.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/screens/profile/ProfileScreen.tsx#L493) 现在顺序是：

- Hero 资料卡
- 账号卡
- 身份卡
- 能力卡
- 快捷入口

实际问题：

- 这更像运营后台视角，不像普通用户视角
- “身份”和“能力”是系统模型，不是大多数用户的日常目标
- 用户真正高频的 `我的订单 / 我的需求 / 设置` 被淹没

### 5.4 同一入口在多个地方重复出现

`我的订单` 在多个页面都有入口，包括：

- 首页 Hero
- 首页待办
- 首页快捷入口
- 履约 Tab
- 我的页快捷入口

这会让用户“到处都能进，但每次都要重新想从哪进”。

### 5.5 文案仍然带有设计者语言

当前页面中仍有大量业务设计用语：

- `驾驶舱`
- `撮合`
- `履约`
- `候选`
- `供给`
- `正式派单`

这些词不是都要删除，但在主文案里应该退后，把“我要找服务 / 我要看进度 / 我要处理任务”放到前面。

## 6. 本轮目标信息架构

### 6.1 一级 Tab 职责

| Tab | 核心问题 | 默认内容 |
|-----|----------|----------|
| 首页 | 我现在最该做什么 | 今日待办 + 进行中任务 |
| 市场 | 我去哪里找服务或机会 | 需求/服务内容列表 |
| 进度 | 成交后的事情进展到哪了 | 订单列表 |
| 消息 | 谁联系了我、系统提醒了什么 | 会话和通知 |
| 我的 | 账号、资料、常用个人入口 | 精简资料与设置 |

### 6.2 首页目标结构

首页固定压缩为 4 层：

1. 简洁头部摘要
2. `今天优先处理`
3. `进行中`
4. `常用动作`

明确删除：

- 市场 Feed
- 大段解释性 Hero 文案
- 大块指标矩阵

### 6.3 市场页目标结构

市场页目标是“内容优先”，不是“入口优先”。

目标结构：

1. 顶部切换：`看需求 / 看服务`
2. 一条很短的上下文说明
3. 列表内容
4. 一个主操作按钮

说明：

- 本轮不要求重做所有详情页
- 本轮重点是让 Tab 首屏看到真实内容

### 6.4 进度页目标结构

进度页直接落在订单列表上。

允许保留的次级入口：

- 机主：`正式派单`
- 飞手：`飞手任务`
- 飞手：`飞行记录`

但这些入口只能作为次级工具入口，不允许再成为 Tab 首屏主内容。

### 6.5 我的页目标结构

“我的”页首屏最多只保留：

- 基本资料
- 我的订单
- 我的需求
- 我的供给
- 实名认证
- 设置

`身份卡 / 能力卡` 不在首屏强展示，可下沉到二级页或折叠区。

## 7. 文案统一规则

本轮所有新增或改写文案，遵循以下规则。

### 7.1 优先使用用户语言

| 系统语言 | UI 主文案建议 |
|----------|----------------|
| 履约 | 进度 |
| 驾驶舱 | 首页 / 今日概览 |
| 供给市场 | 可用服务 |
| 需求市场 | 公开需求 |
| 发布供给 | 上架服务 |
| 发布需求 | 发布任务 |
| 候选需求 | 可报名任务 |
| 正式派单 | 派给飞手 |

### 7.2 可以保留专业词，但不能占据主位

允许在以下位置继续保留专业词：

- 二级说明文案
- 状态标签
- 详情页标题
- 后台或调度相关入口

不建议在首页主标题和一级导航上继续强调这些词。

## 8. 执行顺序

本轮固定分两段执行：

### 8.1 Sprint A：必须完成

这一段是低风险高收益项，优先落地：

- UX-00 基线冻结与 tag
- UX-01 把 `履约` 改为 `进度`，并让 Tab 直达订单列表
- UX-02 首页减负
- UX-03 “我的”页减负
- UX-05 文案统一与重复入口收敛
- UX-06 回归与验收文档更新

### 8.2 Sprint B：建议完成

这一段收益高，但改动面更大：

- UX-04 市场页内容化

如果 Sprint A 做完后体感已经明显改善，可以先停在 A，再评估是否继续做 B。

## 9. 任务切片

以下任务卡可直接交给其他模型执行。

---

### UX-00 基线冻结与版本回退准备

目标：

- 给当前版本留下明确回退点
- 把本文件视为后续执行基线

允许改动：

- 无代码改动
- 可新增 tag

执行要求：

1. 在开始任何 UI 改动前先创建 tag
2. tag 命名统一使用：`ui-before-ux-simplification-20260326`
3. 若不想立刻 push，可先本地创建

验收标准：

- 当前版本可以被明确回退
- 所有执行模型都以本文件为准

建议命令：

```bash
cd /Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1
git tag -a ui-before-ux-simplification-20260326 -m "Before mobile UX simplification round"
git push origin ui-before-ux-simplification-20260326
```

回退方式：

```bash
cd /Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1
git checkout -b restore/ui-before-ux-simplification ui-before-ux-simplification-20260326
```

说明：

- 仓库里已有类似 tag：`ui-before-home-redesign`、`ui-before-login-redesign`、`ui-before-theme-system`
- 本次建议使用新的专用 tag，不复用旧 tag

---

### UX-01 进度 Tab 直达订单列表

目标：

- 用户点击 `进度` 后直接看到订单列表
- 减少一层中转

主要文件：

- [MainNavigator.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/navigation/MainNavigator.tsx)
- [index.web.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/index.web.tsx)
- [OrderListScreen.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/screens/order/OrderListScreen.tsx)

可选读取文件：

- [FulfillmentHubScreen.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/screens/fulfillment/FulfillmentHubScreen.tsx)

具体要求：

1. `Orders` Tab 的可见标签改为 `进度`
2. `Orders` Tab 的 component 从 `FulfillmentHubScreen` 切到 `OrderListScreen`
3. Web 预览中同样把 `Orders` Tab 落地内容切到 `OrderListScreen`
4. `OrderListScreen` 顶部或列表上方增加轻量工具入口
5. 机主看到 `正式派单`
6. 飞手看到 `飞手任务`、`飞行记录`
7. 这些工具入口只能是次级入口，不允许重新做成目录页

明确不要做：

- 不要在本任务里重写订单卡片结构
- 不要删除 `FulfillmentHubScreen.tsx` 文件
- 不要修改后端接口

验收标准：

- 点击底部 `进度`，第一屏是订单列表
- Web 和 Native 行为一致
- 机主与飞手仍可从 `进度` 页进入各自执行工具

建议验证：

```bash
cd /Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile
npx tsc --noEmit
npm run web:build
```

---

### UX-02 首页减负

目标：

- 首页从“驾驶舱”改为“今天该做什么”
- 信息层数减少

主要文件：

- [HomeScreen.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/screens/home/HomeScreen.tsx)

设计冻结点：

1. 角色切换本轮允许保留，但降级为视图筛选器
2. 保留 `待办` 与 `进行中` 两个核心区域
3. 删除市场 Feed 区块
4. Hero 改成简洁摘要，不再保留大块指标矩阵
5. 快捷入口最多保留 4 个
6. 首页不要再用 `驾驶舱` 作为主文案

实现建议：

1. 保留现有数据源 `homeService.getDashboard()`
2. 缩短 Hero 文案，只保留一句摘要和一个主操作
3. 将 `紧急待办` 改成 `今天优先处理`
4. 继续保留 `进行中任务`
5. 直接移除 `feedConfig` 相关渲染
6. 如果 `quickActions` 与待办重复明显，优先删除重复项

明确不要做：

- 不要新建后端 dashboard 字段
- 不要在本任务里重做订单详情
- 不要把首页再次变成新的多模块门户

验收标准：

- 首页首屏主要信息控制在 3 到 4 段
- 用户无需下滑很多屏即可看到今天待办
- 首页不再出现独立市场 Feed 区块

建议验证：

- 多角色账号：首页仍可正常切换
- 单角色账号：首页不会出现空白 Tab
- “我的订单”等上下文跳转仍然正确

---

### UX-03 “我的”页减负

目标：

- 把“我的”首屏变成普通用户能快速理解的页面

主要文件：

- [ProfileScreen.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/screens/profile/ProfileScreen.tsx)

设计冻结点：

1. Hero 资料卡保留
2. 首屏只强调高频入口
3. `账号卡 / 身份卡 / 能力卡` 不再全部强展示在首屏
4. `退出登录` 继续保留在底部

推荐结构：

1. Hero 资料卡
2. 常用入口
3. 账号与安全
4. 可选折叠区：身份与能力

常用入口首屏建议保留：

- 我的订单
- 我的需求
- 我的供给
- 实名认证
- 设置

如果角色不存在：

- 不补空占位卡
- 只展示当前账号真正可用的入口

明确不要做：

- 不要删掉底层统计获取逻辑，除非首屏完全不再使用
- 不要在本任务里重做子档案页
- 不要引入多级设置菜单

验收标准：

- 用户首屏能在 3 秒内看出“订单在哪、设置在哪”
- 首屏不再出现整屏系统概念解释
- 原有档案链路仍可从二级入口进入

---

### UX-04 市场页内容化

说明：

这是 Sprint B 任务，优先级低于 UX-01/02/03。

目标：

- 市场 Tab 首屏看到真实内容，而不是动作卡目录

推荐文件所有权：

- [MarketHubScreen.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/screens/market/MarketHubScreen.tsx)
- 如必须扩展，可只读 [DemandListScreen.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/screens/demand/DemandListScreen.tsx)

设计冻结点：

1. 市场页首屏必须展示内容流
2. 顶部使用 `看需求 / 看服务` 或同义结构
3. 默认视图：
   - 客户：优先 `看服务`
   - 机主：优先 `看需求`
   - 飞手：优先 `看需求`
4. 主操作按钮只保留一个
5. 原本的“边界提醒”和“大段解释”不再作为主内容

技术约束：

- 优先复用现有列表能力
- 如果现有 API 不足以支撑真正的双列表聚合，不要强行新造复杂数据层
- 可先把 `MarketHubScreen` 改造成“轻内容页 + 单个默认列表入口 + 一个主按钮”的过渡方案

过渡方案允许：

- 顶部切换器
- 当前模式下的内容预览卡
- 一个进入完整列表的显性按钮

但不允许继续是纯目录页。

验收标准：

- 用户进入 `市场` 后，第一眼能看到真实需求或服务内容
- 不再需要先点击“需求市场 / 供给市场”这种二级目录卡，才能看到主要内容

---

### UX-05 文案统一与重复入口收敛

目标：

- 在不打断现有主链路的前提下，减少重复入口和设计者话语

主要文件：

- [HomeScreen.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/screens/home/HomeScreen.tsx)
- [MarketHubScreen.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/screens/market/MarketHubScreen.tsx)
- [FulfillmentHubScreen.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/screens/fulfillment/FulfillmentHubScreen.tsx)
- [ProfileScreen.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/screens/profile/ProfileScreen.tsx)
- [MainNavigator.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/navigation/MainNavigator.tsx)
- [index.web.tsx](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile/src/index.web.tsx)

执行规则：

1. `履约` 改成 `进度`
2. 首页不再突出 `驾驶舱`
3. 主文案优先使用 `任务 / 服务 / 进度 / 飞手任务`
4. 保留上下文深链，不保留泛化重复入口

允许保留的深链：

- 首页待办里的“去付款”
- 首页待办里的“查看进行中订单”
- 订单详情里的监控入口

建议去掉或弱化的重复入口：

- 首页 Hero 泛泛的 `我的订单`
- 多处重复出现的相同总入口

验收标准：

- 同一个目标动作不再在同一屏被重复暴露 3 次以上
- 用户可见主文案明显更口语化

---

### UX-06 回归与验收文档更新

目标：

- 把本轮减负改版的验收方式固定下来

主要文件：

- [MOBILE_REGRESSION_ACCEPTANCE.md](/Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/MOBILE_REGRESSION_ACCEPTANCE.md)
- 如有必要，可回写本文件的“阶段结论”

必补内容：

1. 底部 `进度` Tab 的新预期
2. 首页不再验证市场 Feed，而改成验证简洁待办结构
3. “我的”页首屏的高频入口验收
4. 若市场页已内容化，补齐新的截图点位

验收标准：

- 其他模型或人工测试人员可以按文档独立回归
- 文档能准确反映本轮改动后页面结构

## 10. 并行与串行规则

### 10.1 可并行任务

以下组合可以并行：

- `UX-02 首页减负`
- `UX-03 我的页减负`

原因：

- 文件几乎不重叠

### 10.2 必须串行任务

以下任务必须串行：

1. `UX-00` 先于一切
2. `UX-01` 先于 `UX-06`
3. `UX-02` 与 `UX-05` 串行
4. `UX-04` 最好在 `UX-01/02/03` 稳定后再做

原因：

- `UX-05` 会改文案和入口，容易与页面结构任务冲突
- `UX-04` 若提前做，容易拉大范围

## 11. 建议的交接顺序

建议把任务分给其他模型时，按下面顺序发出：

1. 模型 A：执行 `UX-01`
2. 模型 B：执行 `UX-02`
3. 模型 C：执行 `UX-03`
4. 由统筹方合并并检查冲突
5. 模型 D：执行 `UX-05`
6. 若继续推进，再让模型 E 执行 `UX-04`
7. 最后执行 `UX-06`

## 12. 统一 Review 清单

后续 review 时，一律按本清单判断是否通过。

### 12.1 导航层

- `MainNavigator` 与 `index.web` 是否同步
- `进度` 是否已经直达订单列表
- 是否还存在多余的中转目录页

### 12.2 首页

- 首屏是否明显比旧版更短
- 是否去掉了独立市场 Feed
- 是否仍保留上下文明确的待办跳转
- 是否没有新增新的解释性大段文案

### 12.3 我的页

- 高频入口是否上收到了首屏
- 系统概念是否已经下沉或弱化
- 用户是否能快速找到设置与认证

### 12.4 文案

- 是否仍在主标题中大量使用 `驾驶舱 / 履约 / 撮合`
- 是否把用户文案改成过度口语，导致专业含义丢失
- 是否存在同一对象多种叫法混用

### 12.5 风险控制

- 是否修改了不在本轮范围内的详情页逻辑
- 是否引入了新的接口依赖
- 是否破坏了订单、需求、派单任务的对象边界

## 13. 交给其他模型时的统一约束

每次交给其他模型做代码任务时，统一附带以下约束：

1. 先读本文件再动代码
2. 只改分配给自己的文件，不主动扩 scope
3. 不改后端、不改数据库、不新造接口
4. 任何涉及 Tab 的改动，必须同步修改 Native 与 Web
5. 不要删除旧页面文件，除非本任务明确要求
6. 提交前至少运行：

```bash
cd /Users/yinsw1994/myproject/drone_rental_platform/drone_Rental_platform_v1/mobile
npx tsc --noEmit
npm run web:build
```

## 14. 建议给执行模型的任务提示词模板

以下模板可以直接发给其他模型。

### 14.1 UX-01 模板

```text
请按 MOBILE_UX_SIMPLIFICATION_EXECUTION_PLAN.md 执行 UX-01。
只修改 MainNavigator.tsx、index.web.tsx、OrderListScreen.tsx。
目标是把底部“履约”改成“进度”，并让 Orders Tab 直达订单列表，同时给机主/飞手补轻量工具入口。
不要改后端，不要删除 FulfillmentHubScreen.tsx，不要扩展到其他页面。
完成后请说明改了哪些文件、为什么这样做，并给出验证结果。
```

### 14.2 UX-02 模板

```text
请按 MOBILE_UX_SIMPLIFICATION_EXECUTION_PLAN.md 执行 UX-02。
你只负责 HomeScreen.tsx。
目标是：首页减负，保留待办和进行中，删除市场 Feed，缩短 Hero，减少重复入口。
不要新建接口，不要重写详情页，不要顺手改其他 screen。
完成后请说明删掉了哪些信息层、保留了哪些上下文深链，并给出验证结果。
```

### 14.3 UX-03 模板

```text
请按 MOBILE_UX_SIMPLIFICATION_EXECUTION_PLAN.md 执行 UX-03。
你只负责 ProfileScreen.tsx。
目标是：把“我的”页首屏改成高频入口优先，弱化账号卡/身份卡/能力卡的强展示。
不要改子档案页，不要改后端，不要新增多级设置结构。
完成后请说明首屏保留了什么、下沉了什么，并给出验证结果。
```

### 14.4 UX-04 模板

```text
请按 MOBILE_UX_SIMPLIFICATION_EXECUTION_PLAN.md 执行 UX-04。
你主要负责 MarketHubScreen.tsx，必要时只读 DemandListScreen.tsx。
目标是让市场 Tab 首屏看到真实内容，而不是目录动作卡。
如果现有数据源不足，请做过渡型内容页，但不允许继续保留纯目录页。
不要改后端，不要把任务扩大成全站市场重构。
完成后请说明采用了哪种内容化策略、用了哪些现有数据源，并给出验证结果。
```

## 15. 本轮完成定义

当且仅当满足以下条件，才算这一轮减负改版完成：

1. `进度` Tab 直达订单列表
2. 首页不再承担市场 Feed 和大块说明职责
3. “我的”页首屏显著更短、更聚焦
4. Native 与 Web 表现一致
5. 文案与入口数量明显收敛
6. 回归验收文档已经同步

如果只完成视觉调整、但导航层和信息架构没有变化，不算完成。
