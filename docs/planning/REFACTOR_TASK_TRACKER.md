# 无人机货物吊运智慧服务平台 - 功能模块重构任务跟踪

> 基于《无人机货物吊运智慧服务平台开发任务说明书 V1.0 (2026.3.1)》与当前项目的差异分析

## 一、差异分析总结

### 1.1 角色体系差异

| 维度 | 任务说明书要求 | 当前项目状态 | 差距 |
|------|---------------|-------------|------|
| 飞手(Pilot) | 核心角色，持CAAC执照的专业操控人员 | **已实现** (后端API完成) | 需完成移动端 |
| 机主(Drone Owner) | 拥有无人机设备所有权 | **已增强** (UOM/保险/适航认证完成) | 需完成移动端 |
| 业主/货主(Cargo Owner) | 货物吊运需求方 | **已整合** (Client统一模型完成) | 需完成移动端 |
| 管理员(Admin) | 平台管理 | 已有 `admin` | 基本满足 |

### 1.2 功能模块差异

| 模块 | 任务说明书要求 | 当前项目状态 | 优先级 |
|------|---------------|-------------|--------|
| 飞手认证体系 | CAAC执照、无犯罪记录、健康证明、飞行经验 | **后端已完成** | **P0** |
| 机主认证增强 | UOM平台验证、保险证明(≥500万)、设备适航证 | **后端已完成** | **P0** |
| 业主认证 | 信用评估、货物类型声明 | **后端已完成** | **P1** |
| 智能派单系统 | 地理围栏、能力匹配、资质匹配、批量匹配算法 | 简单距离匹配 | **P0** |
| 空域报备系统 | UOM平台对接、飞行区域报备、电子围栏 | 缺失 | **P1** |
| 订单生命周期 | 10个状态节点、装卸流程、轨迹录制 | 基础订单流程 | **P1** |
| 支付分账系统 | 三方分账、实时结算、平台佣金 | 简单支付 | **P1** |
| 信用评价体系 | 多维度信用分(1000分制) | 简单信用分 | **P2** |
| 保险理赔系统 | 强制险种、自动理赔流程 | 缺失 | **P2** |
| 数据分析平台 | 运营看板、智能报表、决策支持 | 缺失 | **P3** |
| 无人机SDK集成 | 大疆/极飞等主流品牌SDK | 缺失 | **P2** |

### 1.3 技术架构差异

| 维度 | 任务说明书要求 | 当前项目状态 | 需调整 |
|------|---------------|-------------|--------|
| 后端语言 | Java/Go | Go | 满足 |
| 移动端 | React Native/Flutter | React Native | 满足 |
| 管理后台 | Vue.js 3 | React | 保持现有 |
| 数据库 | MySQL + PostgreSQL + InfluxDB | MySQL | 可扩展 |
| 消息队列 | RocketMQ/Kafka | 未使用 | 需评估 |

---

## 二、功能模块任务列表

### 阶段一：核心角色重构 (P0 优先级)

#### 任务 1.1：飞手角色数据模型设计与实现
- **状态**: [x] 已完成 (2026-03-01)
- **预期交付**: 
  - 飞手数据表 `pilots`
  - 飞手认证表 `pilot_certifications`
  - 飞手飞行记录表 `pilot_flight_logs`
  - 飞手与无人机绑定表 `pilot_drone_bindings`
- **完成内容**:
  - [x] models.go 新增 Pilot, PilotCertification, PilotFlightLog, PilotDroneBinding 模型
  - [x] User.UserType 增加 pilot 类型支持
  - [x] Order 模型增加 PilotID 字段
  - [x] 数据库迁移文件 005_add_pilot_tables.sql

#### 任务 1.2：飞手注册认证流程开发
- **状态**: [x] 已完成 (2026-03-01)
- **后端任务**:
  - [x] 飞手注册API `/api/v1/pilot/register`
  - [x] CAAC执照上传验证API `/api/v1/pilot/certification`
  - [x] 无犯罪记录证明上传 `/api/v1/pilot/criminal-check`
  - [x] 健康体检证明上传 `/api/v1/pilot/health-check`
  - [x] 飞手资质审核API (管理端待实现)
- **完成内容**:
  - [x] pilot_repo.go - 飞手数据访问层
  - [x] pilot_service.go - 飞手业务逻辑层
  - [x] pilot/handler.go - 飞手API处理器
  - [x] router.go 新增飞手路由组
  - [x] main.go 注册飞手服务
- **API清单**:
  - POST `/api/v1/pilot/register` - 注册成为飞手
  - GET `/api/v1/pilot/profile` - 获取飞手档案
  - PUT `/api/v1/pilot/profile` - 更新飞手档案
  - PUT `/api/v1/pilot/location` - 更新实时位置
  - PUT `/api/v1/pilot/availability` - 更新接单状态
  - GET `/api/v1/pilot/list` - 获取飞手列表
  - GET `/api/v1/pilot/nearby` - 查找附近飞手
  - POST `/api/v1/pilot/certification` - 提交资质证书
  - GET `/api/v1/pilot/certifications` - 获取证书列表
  - POST `/api/v1/pilot/criminal-check` - 提交无犯罪记录
  - POST `/api/v1/pilot/health-check` - 提交健康证明
  - GET `/api/v1/pilot/flight-logs` - 获取飞行记录
  - POST `/api/v1/pilot/flight-log` - 添加飞行记录
  - GET `/api/v1/pilot/flight-stats` - 获取飞行统计
  - GET `/api/v1/pilot/bound-drones` - 获取绑定的无人机
  - POST `/api/v1/pilot/bind-drone` - 绑定无人机
  - DELETE `/api/v1/pilot/unbind/:bindingId` - 解绑无人机
- **移动端任务**:
  - [ ] 飞手注册页面
  - [ ] 资质上传页面
  - [ ] 审核状态展示

#### 任务 1.3：机主认证体系增强
- **状态**: [x] 已完成 (2026-03-02)
- **完成内容**:
  - [x] Drone模型扩展新增UOM平台登记字段
  - [x] Drone模型扩展新增保险信息字段(保额≥500万校验)
  - [x] Drone模型扩展新增适航证书字段
  - [x] Drone模型扩展新增维护记录字段
  - [x] 新增DroneMaintenanceLog维护记录模型
  - [x] 新增DroneInsuranceRecord保险记录模型
  - [x] 数据库迁移文件 006_enhance_drone_certification.sql
  - [x] DroneService新增UOM登记、保险、适航证书、维护记录方法
  - [x] DroneRepo新增维护记录、保险记录查询方法
  - [x] DroneHandler新增6个认证相关API端点
- **新增字段**:
  ```
  drones 表扩展:
  - uom_registration_no (UOM平台登记号)
  - uom_verified (pending/verified/rejected)
  - uom_verified_at
  - uom_registration_doc (登记证明文件)
  - insurance_policy_no (保险单号)
  - insurance_company (保险公司)
  - insurance_coverage (保额，分，≥500万)
  - insurance_expire_date
  - insurance_doc (保险单文件)
  - insurance_verified (pending/verified/rejected)
  - airworthiness_cert_no (适航证书编号)
  - airworthiness_cert_expire (适航证书有效期)
  - airworthiness_cert_doc (适航证书文件)
  - airworthiness_verified (pending/verified/rejected)
  - last_maintenance_date (最近维护日期)
  - next_maintenance_date (下次维护日期)
  - maintenance_records (JSON: 维护记录)
  ```
- **API清单**:
  - POST `/api/v1/drone/:id/uom` - 提交UOM平台登记
  - POST `/api/v1/drone/:id/insurance` - 提交保险信息
  - POST `/api/v1/drone/:id/airworthiness` - 提交适航证书
  - POST `/api/v1/drone/:id/maintenance` - 添加维护记录
  - GET `/api/v1/drone/:id/maintenance` - 获取维护记录
  - GET `/api/v1/drone/:id/cert-status` - 获取认证状态

#### 任务 1.4：业主角色整合与增强
- **状态**: [x] 已完成 (2026-03-02)
- **完成内容**:
  - [x] 新增Client业主/客户统一模型(整合renter和cargo_owner)
  - [x] 新增ClientCreditCheck征信查询记录模型
  - [x] 新增ClientEnterpriseCert企业资质证书模型
  - [x] 新增CargoDeclaration货物申报模型
  - [x] 数据库迁移文件 007_add_client_tables.sql
  - [x] client_repo.go - 业主数据访问层(35+方法)
  - [x] client_service.go - 业主业务逻辑层
  - [x] client/handler.go - 业主API处理器(20+端点)
  - [x] router.go 新增业主路由组
  - [x] main.go 注册业主服务
- **新增数据表**:
  ```
  clients: 业主/客户档案表
  - 支持个人(individual)/企业(enterprise)两种类型
  - 企业信息：公司名称、营业执照、法人、联系人
  - 征信信息：百行征信/芝麻信用评分、平台内部信用分
  - 企业资质：认证状态、行业类别、注册资本、特殊资质
  - 服务偏好：常用货物类型、常用路线
  - 统计信息：订单数、消费金额、评分
  
  client_credit_checks: 征信查询记录表
  - 支持百行征信、芝麻信用、内部查询
  - 记录信用分、风险等级、逾期情况
  
  client_enterprise_certs: 企业资质证书表
  - 支持营业执照、危化品许可、食品经营许可等
  - 证书审核流程
  
  cargo_declarations: 货物申报表
  - 货物类别：普通/贵重/易碎/危险品/生鲜/医疗
  - 特殊货物：危险品UN编号、温控要求、防潮要求
  - 合规检查流程
  ```
- **API清单**:
  - POST `/api/v1/client/register/individual` - 注册个人客户
  - POST `/api/v1/client/register/enterprise` - 注册企业客户
  - GET `/api/v1/client/profile` - 获取客户档案
  - PUT `/api/v1/client/profile` - 更新客户档案
  - GET `/api/v1/client/list` - 获取客户列表
  - GET `/api/v1/client/:id` - 获取指定客户
  - POST `/api/v1/client/credit/check` - 发起征信查询
  - GET `/api/v1/client/credit/history` - 获取征信历史
  - POST `/api/v1/client/enterprise/cert` - 提交企业资质
  - GET `/api/v1/client/enterprise/certs` - 获取企业资质列表
  - POST `/api/v1/client/cargo/declaration` - 创建货物申报
  - GET `/api/v1/client/cargo/declaration/:id` - 获取货物申报详情
  - GET `/api/v1/client/cargo/declarations` - 获取货物申报列表
  - PUT `/api/v1/client/cargo/declaration/:id` - 更新货物申报
  - GET `/api/v1/client/order/eligibility` - 检查下单资格
  - POST `/api/v1/client/admin/approve/:id` - 审批通过客户
  - POST `/api/v1/client/admin/reject/:id` - 拒绝客户
  - POST `/api/v1/client/admin/cert/approve/:id` - 审批企业资质
  - POST `/api/v1/client/admin/cert/reject/:id` - 拒绝企业资质
  - POST `/api/v1/client/admin/cargo/approve/:id` - 审批货物申报
  - POST `/api/v1/client/admin/cargo/reject/:id` - 拒绝货物申报
  - GET `/api/v1/client/admin/pending` - 待审批客户列表
  - GET `/api/v1/client/admin/cargo/pending` - 待审批货物申报

---

### 阶段二：智能匹配与派单系统 (P0 优先级)

#### 任务 2.1：智能匹配引擎重构
- **状态**: [x] 已完成 (2026-03-02)
- **当前问题**: 仅支持简单距离匹配
- **完成内容**:
  - [x] 地理围栏匹配 (5公里范围优先，阶梯扩展至15km/50km)
  - [x] 能力匹配 (货物重量 vs 无人机载荷，70%/90%/100%阈值)
  - [x] 资质匹配 (飞手持照等级、飞行时长、距离能力)
  - [x] 信用匹配 (高信用优先，800/600/400分段)
  - [x] 价格匹配 (预算范围匹配)
  - [x] 时间匹配 (时间窗口，70%阈值)
  - [x] 评分匹配 (飞手+无人机综合评分)
- **多维度评分算法**:
  ```
  距离评分 (25%): 5km以内满分，线性衰减至最大搜索半径
  载荷评分 (15%): ≤70%满分, 70-90%得80%, 90-100%得50%, >100%不合格
  资质评分 (20%): 执照匹配(8分) + 飞行时长(2-6分) + 距离能力(3-6分)
  信用评分 (15%): ≥800得15, ≥600得12, ≥400得7.5, <400不合格
  价格评分 (10%): 预算内满分，按比例衰减
  时间评分 (10%): ≤70%可用时间满分, 70-100%得70%, >100%不合格
  评价评分 (5%): (飞手评分 + 无人机评分) / 2
  总分: 0-100分, 最低40分才能成为候选人
  ```
- **新增文件**:
  - internal/repository/dispatch_repo.go (35+方法)
  - internal/service/dispatch_service.go (多维度匹配算法)

#### 任务 2.2：派单算法实现
- **状态**: [x] 已完成 (2026-03-02)
- **完成内容**:
  - [x] 就近优先原则 (阶梯搜索: 5km → 15km → 50km)
  - [x] 候选人池管理 (最少3个候选人，最多10个)
  - [x] 派单超时处理 (可配置超时时间)
  - [x] 连环派单支持 (顶部候选人通知机制)
- **派单生命周期**:
  ```
  pending → matching → dispatching → assigned → 
  in_progress → completed / cancelled / expired
  ```
- **配置化参数** (dispatch_configs表):
  - 各维度权重可配置
  - 搜索半径可配置 (初始/最大)
  - 超时时间可配置
  - 平台佣金比例可配置
- **新增数据表**:
  ```
  dispatch_tasks: 派单任务表
  - 货物信息、装卸地点、时间窗口、预算约束
  - 任务状态、匹配要求、候选人数量
  
  dispatch_candidates: 派单候选人表
  - 飞手-无人机配对、各维度得分明细
  - 通知状态、响应状态、响应时间
  
  dispatch_configs: 派单配置表
  - 18项可配置参数
  
  dispatch_logs: 派单日志表
  - 任务操作审计追踪
  ```
- **数据库迁移**: migrations/008_add_dispatch_tables.sql

#### 任务 2.3：订单发布模块增强
- **状态**: [x] 已完成 (2026-03-02)
- **完成内容**:
  - [x] 货物信息 (类型、重量、体积、价值、描述)
  - [x] 装卸地点 (GPS定位: 起点/终点经纬度)
  - [x] 时间要求 (预约时间、配送截止时间)
  - [x] 特殊需求 (备注字段)
  - [x] 预算范围设定 (最大预算)
  - [x] 资质要求 (最低执照等级、最低信用分)
- **API处理器**: internal/api/v1/dispatch/handler.go (17个端点)
- **API清单**:
  - **客户端点**:
    - POST `/api/v1/dispatch/task` - 创建派单任务
    - GET `/api/v1/dispatch/task/:id` - 获取任务详情
    - GET `/api/v1/dispatch/tasks` - 获取客户任务列表
    - POST `/api/v1/dispatch/task/:id/cancel` - 取消任务
    - GET `/api/v1/dispatch/task/:id/candidates` - 获取候选人列表
    - GET `/api/v1/dispatch/task/:id/logs` - 获取任务日志
  - **飞手端点**:
    - GET `/api/v1/dispatch/pilot/tasks` - 获取飞手任务列表
    - GET `/api/v1/dispatch/pilot/pending` - 获取待接单任务
    - POST `/api/v1/dispatch/pilot/accept/:taskId` - 接受任务
    - POST `/api/v1/dispatch/pilot/reject/:taskId` - 拒绝任务
  - **管理端点**:
    - POST `/api/v1/dispatch/admin/match/:id` - 手动触发匹配
    - POST `/api/v1/dispatch/admin/process-pending` - 处理待派单任务
    - POST `/api/v1/dispatch/admin/handle-expired` - 处理超时任务
  - **配置端点**:
    - GET `/api/v1/dispatch/config` - 获取派单配置
    - PUT `/api/v1/dispatch/config` - 更新派单配置

---

### 阶段三：订单管理与执行系统 (P1 优先级)

#### 任务 3.1：订单生命周期扩展
- **状态**: [x] 已完成 (2026-03-02)
- **完整状态流程**:
  ```
  created → matching → confirmed → airspace_applying → 
  preparing → loading → flying → monitoring → 
  unloading → completed → reviewed → settled
  ```
- **完成内容**:
  - [x] 空域申请状态 (airspace_status字段)
  - [x] 飞行准备状态 (flight_start_time)
  - [x] 货物装载状态 (loading_confirmed_at/by, cargo_photos)
  - [x] 运输监控状态 (trajectory_id关联)
  - [x] 货物卸载状态 (unloading_confirmed_at/by, delivery_photos, receiver_signature)
  - [x] 结算状态 (settlement_status, settled_at, pilot_amount)
- **订单表扩展字段**:
  ```
  orders 表新增:
  - dispatch_task_id (关联派单任务)
  - airspace_status (空域申请状态)
  - cargo_weight, cargo_volume, cargo_photos (货物信息)
  - loading_confirmed_at/by (装载确认)
  - unloading_confirmed_at/by, delivery_photos, receiver_signature (卸载确认)
  - flight_start_time, flight_end_time (飞行时间)
  - actual_flight_distance, actual_flight_duration (实际飞行数据)
  - max_altitude, avg_speed (飞行参数)
  - trajectory_id (关联轨迹)
  - dest_latitude, dest_longitude, dest_address (目的地)
  - settlement_status, settled_at, pilot_amount, pilot_commission_rate (结算)
  ```
- **数据库迁移**: migrations/009_add_order_execution_tables.sql

#### 任务 3.2：飞行监控模块
- **状态**: [x] 已完成 (2026-03-02)
- **完成内容**:
  - [x] 实时定位追踪 (GPS经纬度、高度、速度、航向)
  - [x] 飞行状态监控 (电量、信号强度、GPS卫星数)
  - [x] 传感器数据 (温度、风速、风向)
  - [x] 电子围栏系统 (禁飞区、限飞区、告警区、自定义围栏)
  - [x] 围栏违规检测与告警
  - [x] 低电量预警 (30%/15%阈值可配置)
  - [x] 高度超限告警、速度超限告警
  - [x] 信号弱告警
  - [x] 告警确认与解决流程
- **新增数据表**:
  ```
  flight_positions: 飞行实时位置记录
  - 位置(经纬度、高度)、飞行状态(速度、航向、垂直速度)
  - 设备状态(电量、信号、GPS卫星数)
  - 传感器数据(温度、风速、风向)
  
  flight_alerts: 飞行告警记录
  - 告警类型(low_battery, geofence, deviation, signal_lost, altitude, speed, weather)
  - 告警级别(info, warning, critical)
  - 触发位置、阈值、实际值
  - 处理状态、确认/解决时间
  
  geofences: 电子围栏定义
  - 围栏类型(no_fly, restricted, alert, custom)
  - 几何类型(circle, polygon)
  - 高度限制、时间限制
  - 违规动作(alert, block, force_land)
  
  geofence_violations: 围栏违规记录
  
  flight_monitor_configs: 飞行监控配置
  - 14项可配置参数(告警阈值、上报间隔等)
  ```
- **新增文件**:
  - internal/repository/flight_repo.go (50+方法)
  - internal/service/flight_service.go (飞行监控服务)
  - internal/api/v1/flight/handler.go (30+API端点)

#### 任务 3.3：轨迹录制与复用
- **状态**: [x] 已完成 (2026-03-02)
- **完成内容**:
  - [x] 固定路线轨迹录制 (开始/停止录制、航点记录)
  - [x] 轨迹统计 (总距离、总时长、最大高度、平均速度)
  - [x] 轨迹简化算法 (Douglas-Peucker算法)
  - [x] 历史轨迹调用 (按订单/按ID查询)
  - [x] 轨迹标记为模板
  - [x] 从轨迹创建路线
  - [x] 路线管理 (私有/共享/公开)
  - [x] 路线评分与使用统计
  - [x] 附近路线查找
  - [x] 多点装卸任务规划 (多站点、时间窗口)
- **新增数据表**:
  ```
  flight_trajectories: 飞行轨迹
  - 起终点信息、统计数据
  - 录制状态、模板标记、使用次数
  
  flight_waypoints: 飞行航点
  - 位置、序号、航点类型
  - 飞行参数、动作参数
  
  saved_routes: 保存的路线模板
  - 起终点、航点数据
  - 适用条件(载荷、天气、时间)
  - 统计(使用次数、成功率、评分)
  - 可见性(private, shared, public)
  
  multi_point_tasks: 多点任务
  - 任务类型(pickup, delivery, mixed)
  - 规划/实际距离和时长
  
  multi_point_task_stops: 多点任务站点
  - 站点类型、位置、联系人
  - 货物信息、时间窗口
  - 确认信息(照片、签名)
  ```
- **API清单** (30个端点):
  - **位置上报**:
    - POST `/api/v1/flight/position` - 上报飞行位置
    - GET `/api/v1/flight/position/:order_id/latest` - 获取最新位置
    - GET `/api/v1/flight/position/:order_id/history` - 获取位置历史
  - **告警管理**:
    - GET `/api/v1/flight/alerts/:order_id` - 获取告警列表
    - GET `/api/v1/flight/alerts/:order_id/active` - 获取活跃告警
    - POST `/api/v1/flight/alert/:alert_id/acknowledge` - 确认告警
    - POST `/api/v1/flight/alert/:alert_id/resolve` - 解决告警
  - **电子围栏**:
    - GET `/api/v1/flight/geofences` - 围栏列表
    - GET `/api/v1/flight/geofence/:id` - 获取围栏详情
    - POST `/api/v1/flight/geofence` - 创建围栏
    - DELETE `/api/v1/flight/geofence/:id` - 删除围栏
  - **轨迹录制**:
    - POST `/api/v1/flight/trajectory/start` - 开始录制
    - POST `/api/v1/flight/trajectory/stop` - 停止录制
    - GET `/api/v1/flight/trajectory/:order_id` - 获取轨迹详情
    - POST `/api/v1/flight/trajectory/:id/template` - 标记为模板
  - **路线管理**:
    - POST `/api/v1/flight/route/from-trajectory` - 从轨迹创建路线
    - GET `/api/v1/flight/routes/mine` - 我的路线
    - GET `/api/v1/flight/routes/public` - 公开路线
    - GET `/api/v1/flight/routes/nearby` - 附近路线
    - GET `/api/v1/flight/route/:id` - 路线详情
    - POST `/api/v1/flight/route/:id/use` - 使用路线
    - POST `/api/v1/flight/route/:id/rate` - 评价路线
    - DELETE `/api/v1/flight/route/:id` - 删除路线
  - **多点任务**:
    - POST `/api/v1/flight/multipoint-task` - 创建多点任务
    - GET `/api/v1/flight/multipoint-task/:id` - 获取任务详情
    - GET `/api/v1/flight/multipoint-task/order/:order_id` - 按订单获取
    - POST `/api/v1/flight/multipoint-task/:id/start` - 开始任务
    - POST `/api/v1/flight/multipoint-task/:id/next` - 下一站点
    - POST `/api/v1/flight/multipoint-task/stop/:stop_id/arrive` - 到达站点
    - POST `/api/v1/flight/multipoint-task/stop/:stop_id/complete` - 完成站点
    - POST `/api/v1/flight/multipoint-task/stop/:stop_id/skip` - 跳过站点
  - **飞行统计**:
    - GET `/api/v1/flight/stats/:order_id` - 获取飞行统计

---

### 阶段四：空域管理与合规系统 (P1 优先级)

> **业务场景说明**：本平台定位为"重载末端物资吊运"，典型作业距离为几百米到 1 公里多的短距一次性吊运。此场景**不涉及航线规划与航线审批**——航线规划/审批是支线干线物流（上百至上千公里远程物流）才需要的。短距吊运只需要向空域管理部门**报备（部分场景甚至不需报备）并申请临时空域**。

#### 任务 4.1：空域管理数据模型
- **状态**: [x] 已完成 (2026-03-02)
- **数据表设计**:
  ```
  airspace_applications:
  - id, order_id, pilot_id
  - flight_plan (JSON: 飞行区域与作业参数，非远程航线规划)
  - start_time, end_time
  - max_altitude, flight_area
  - uom_application_no (UOM申请编号)
  - status (pending/approved/rejected)
  - approval_notes
  - created_at, updated_at
  
  no_fly_zones:
  - id, name, zone_type (airport/military/restricted)
  - coordinates (JSON: 多边形坐标)
  - altitude_limit
  - effective_from, effective_to
  ```

#### 任务 4.2：UOM平台对接准备
- **状态**: [x] 已完成 (2026-03-02)
- **接口预留**:
  - [ ] 飞行计划提交接口
  - [ ] 审批状态查询接口
  - [ ] 实名登记验证接口
- **注**: 实际对接需获取民航局UOM平台API权限

#### 任务 4.3：合规性检查模块
- **状态**: [x] 已完成 (2026-03-02)
- **检查项**:
  - [ ] 实名登记验证
  - [ ] 执照有效性检查
  - [ ] 保险覆盖验证
  - [ ] 设备适航状态
  - [ ] 载荷重量限制

---

### 阶段五：支付结算与分账系统 (P1 优先级)

#### 任务 5.1：分账数据模型
- **状态**: [x] 已完成 (2026-03-02)
- **完成内容**:
  - [x] OrderSettlement 订单结算模型(金额明细+分账明细+参与方+定价参数)
  - [x] UserWallet 用户钱包模型(可用余额/冻结余额/累计收入/累计提现)
  - [x] WalletTransaction 钱包流水模型(收入/提现/冻结/解冻/扣款/退款)
  - [x] WithdrawalRecord 提现记录模型(银行卡/支付宝/微信)
  - [x] PricingConfig 定价配置模型(27项可配置参数)
  - [x] 数据库迁移文件 011_add_settlement_tables.sql
  - [x] settlement_repo.go 数据访问层(30+方法, 事务安全的钱包操作)
- **数据表设计**:
  ```
  order_settlements:
  - id, order_id
  - total_amount (订单总额)
  - platform_fee (平台服务费 5-15%)
  - pilot_fee (飞手劳务费)
  - owner_fee (机主设备费)
  - insurance_fee (保险费)
  - other_fees (JSON: 其他费用明细)
  - pilot_user_id, owner_user_id
  - settlement_status
  - settled_at
  
  user_wallets:
  - id, user_id
  - available_balance (可用余额)
  - frozen_balance (冻结余额)
  - total_income (累计收入)
  - total_withdrawn (累计提现)
  
  withdrawal_records:
  - id, user_id, amount
  - bank_account / alipay / wechat
  - status, processed_at
  ```

#### 任务 5.2：定价模型实现
- **状态**: [x] 已完成 (2026-03-02)
- **完成内容**:
  - [x] 阶梯里程计价 (0-5km/5-15km/15-50km/50km+)
  - [x] 时长费(含免费时长)
  - [x] 阶梯重量计价
  - [x] 难度系数(普通/复杂/危险品/紧急/夜间: 1.0-2.0)
  - [x] 保险费率(普通1%/易碎2%/危险品3%)
  - [x] 高峰溢价(30%)/节假日溢价(50%)/空闲折扣(20%)
  - [x] 27项定价配置参数默认值
- **定价公式**:
  ```
  总费用 = 基础服务费(50-200) + 里程费(5-15元/km) + 
           时长费(2-5元/min) + 重量费(10-50元/10kg) + 
           难度系数(1.0-2.0) + 保险费(货值×1-3%)
  ```
- **动态定价**:
  - [ ] 高峰溢价 (10-30%)
  - [ ] 空闲折扣 (10-20%)
  - [ ] 会员优惠

#### 任务 5.3：分账规则引擎
- **状态**: [x] 已完成 (2026-03-02)
- **完成内容**:
  - [x] settlement_service.go 结算业务逻辑(定价引擎+分账引擎+钱包操作+提现)
  - [x] settlement/handler.go API处理器(24个端点)
  - [x] 路由注册及main.go集成
  - [x] 订单结算(创建/确认/执行/批量处理)
  - [x] 钱包管理(查询/流水/冻结/解冻)
  - [x] 提现流程(申请/审批/拒绝/手续费)
- **API端点**:
  - POST `/api/v1/settlement/calculate-price` - 价格预估
  - POST `/api/v1/settlement/create` - 创建结算
  - GET `/api/v1/settlement/:id` - 结算详情
  - GET `/api/v1/settlement/order/:order_id` - 按订单查结算
  - POST `/api/v1/settlement/:id/confirm` - 确认结算
  - GET `/api/v1/settlement/my` - 我的结算列表
  - GET `/api/v1/settlement/wallet` - 我的钱包
  - GET `/api/v1/settlement/wallet/transactions` - 钱包流水
  - POST `/api/v1/settlement/withdrawal` - 申请提现
  - GET `/api/v1/settlement/withdrawals` - 提现记录
  - POST `/api/v1/settlement/admin/execute/:id` - 执行结算
  - GET `/api/v1/settlement/admin/list` - 全部结算
  - POST `/api/v1/settlement/admin/process-pending` - 批量结算
  - GET `/api/v1/settlement/admin/withdrawals/pending` - 待审核提现
  - POST `/api/v1/settlement/admin/withdrawal/:id/approve` - 通过提现
  - POST `/api/v1/settlement/admin/withdrawal/:id/reject` - 拒绝提现
  - GET `/api/v1/settlement/admin/pricing-configs` - 定价配置
  - PUT `/api/v1/settlement/admin/pricing-config` - 更新配置
- **分账比例** (示例):
  - 平台服务费: 10%
  - 飞手劳务费: 45%
  - 机主设备费: 40%
  - 保险费: 5% (代收代付)

---

### 阶段六：信用评价与风控体系 (P2 优先级)

#### 任务 6.1：多维度信用评分系统
- **状态**: [x] 已完成 (2026-03-02)
- **飞手信用分 (1000分)**:
  - 基础资质: 200分
  - 服务质量: 300分
  - 安全记录: 300分
  - 活跃度: 200分
- **机主信用分 (1000分)**:
  - 设备合规: 250分
  - 服务质量: 300分
  - 履约能力: 250分
  - 合作态度: 200分
- **业主信用分 (1000分)**:
  - 身份认证: 200分
  - 支付能力: 300分
  - 合作态度: 300分
  - 订单质量: 200分
- **完成内容**:
  - [x] CreditScore 信用分模型 (1000分制，按用户类型分维度)
  - [x] CreditScoreLog 信用分变动日志
  - [x] RiskControl 风控记录模型
  - [x] Violation 违规记录模型 (含申诉流程)
  - [x] Blacklist 黑名单模型
  - [x] Deposit 保证金模型
  - [x] 数据库迁移 012_add_credit_control_tables.sql
  - [x] credit_repo.go 仓储层
  - [x] credit_service.go 服务层 (含信用分计算、违规处理、风控检测)
  - [x] credit/handler.go API处理器
  - [x] 路由注册 30+ API端点

#### 任务 6.2：风控机制
- **状态**: [x] 已完成 (2026-03-02)
- **事前风控**: 资质审核、信用评估、保证金
- **事中风控**: 实时监控、异常告警、人工介入
- **事后风控**: 纠纷仲裁、保险理赔、黑名单
- **完成内容**:
  - [x] PreOrderRiskCheck 订单前风控检查
  - [x] 黑名单检查、信用分检查、取消率检查、违规记录检查
  - [x] 风控审核流程 (pending → reviewing → resolved/dismissed)
  - [x] 违规处罚自动执行 (扣分、冻结、拉黑)
  - [x] 申诉流程 (提交申诉 → 审核 → 恢复/驳回)
- **移动端**:
  - [x] credit.ts API服务
  - [x] CreditScoreScreen.tsx 信用分展示页面
  - [x] ViolationListScreen.tsx 违规记录与申诉页面
  - [x] DepositScreen.tsx 保证金管理页面

---

### 阶段七：保险与理赔系统 (P2 优先级)

#### 任务 7.1：保险数据模型
- **状态**: [x] 已完成 (2026-03-02)
- **强制险种**:
  - 第三者责任险 (≥500万)
  - 货物险 (按货值200%)
  - 机身险
  - 飞手意外险
- **完成内容**:
  - [x] InsurancePolicy 保险保单模型 (4种险种支持)
  - [x] InsuranceClaim 理赔记录模型 (6种事故类型)
  - [x] ClaimTimeline 理赔时间线模型
  - [x] InsuranceProduct 保险产品配置模型
  - [x] 数据库迁移 013_add_insurance_tables.sql
  - [x] 初始化4款强制/可选保险产品配置
  - [x] insurance_repo.go 仓储层
  - [x] insurance_service.go 服务层 (含保费计算、理赔流程)

#### 任务 7.2：理赔流程
- **状态**: [x] 已完成 (2026-03-02)
- **流程**: 事故报案 → 现场取证 → 责任认定 → 理赔处理 → 纠纷仲裁
- **完成内容**:
  - [x] 报案流程 (ReportClaim)
  - [x] 证据上传 (UploadEvidence)
  - [x] 开始调查 (StartInvestigation)
  - [x] 责任认定 (DetermineLiability) - 含责任方、责任比例、免赔额计算
  - [x] 核赔通过/拒赔 (ApproveClaim/RejectClaim)
  - [x] 赔付执行 (PayClaim)
  - [x] 结案处理 (CloseClaim)
  - [x] 争议申诉 (DisputeClaim)
  - [x] insurance/handler.go API处理器 (25+ 端点)
  - [x] 路由注册
- **移动端**:
  - [x] insurance.ts API服务
  - [x] InsurancePolicyListScreen.tsx 保单列表页面
  - [x] ClaimListScreen.tsx 理赔列表与详情页面 (含进度条、时间线)

---

### 阶段八：数据分析与决策支持 (P3 优先级)

#### 任务 8.1：运营数据看板
- **状态**: [x] 已完成 (2026-03-02)
- **指标**:
  - 实时订单量、完成率、取消率
  - 运力分布热力图
  - 收入统计分析
  - 用户活跃度
- **完成内容**:
  - [x] DailyStatistics 每日统计模型
  - [x] HourlyMetrics 小时级别实时指标模型
  - [x] RegionStatistics 区域统计模型
  - [x] HeatmapData 热力图数据模型
  - [x] RealtimeDashboard 实时看板缓存模型
  - [x] 数据库迁移 014_add_analytics_tables.sql
  - [x] analytics_repo.go 仓储层 (聚合查询、趋势分析)
  - [x] analytics_service.go 服务层 (实时看板、趋势数据、统计生成)
  - [x] analytics/handler.go API处理器 (25+ 端点)
  - [x] 路由注册
- **API端点**:
  - GET `/api/v1/analytics/dashboard/realtime` - 实时看板
  - POST `/api/v1/analytics/dashboard/refresh` - 刷新缓存
  - GET `/api/v1/analytics/overview` - 数据概览
  - GET `/api/v1/analytics/trends` - 趋势数据
  - GET `/api/v1/analytics/daily` - 每日统计
  - GET `/api/v1/analytics/daily/range` - 日期范围统计
  - GET `/api/v1/analytics/hourly` - 小时指标
  - GET `/api/v1/analytics/heatmap` - 热力图数据
  - GET `/api/v1/analytics/regions` - 区域统计
  - GET `/api/v1/analytics/regions/top` - TOP区域

#### 任务 8.2：智能报表
- **状态**: [x] 已完成 (2026-03-02)
- **功能**: 日报/周报/月报自动生成
- **完成内容**:
  - [x] AnalyticsReport 分析报表模型
  - [x] 报表生成引擎 (汇总计算、订单/收入/用户/飞行/风控分析)
  - [x] 趋势分析与建议生成
  - [x] 环比/同比数据预留
  - [x] 定时任务接口 (每日/小时/自动报表)
- **API端点**:
  - GET `/api/v1/analytics/reports` - 报表列表
  - GET `/api/v1/analytics/report/:id` - 报表详情
  - GET `/api/v1/analytics/report/no/:reportNo` - 按编号查询
  - GET `/api/v1/analytics/report/latest/:type` - 最新报表
  - POST `/api/v1/analytics/report/generate` - 生成报表
  - DELETE `/api/v1/analytics/report/:id` - 删除报表
  - POST `/api/v1/analytics/admin/daily/generate` - 生成每日统计
  - POST `/api/v1/analytics/admin/job/daily` - 触发每日任务
  - POST `/api/v1/analytics/admin/job/hourly` - 触发小时任务
  - POST `/api/v1/analytics/admin/job/report` - 触发自动报表
- **管理后台** (数据看板适合放在Web端，非移动端):
  - [x] admin/src/services/api.ts 新增analytics API方法
  - [x] admin/src/pages/Analytics/AnalyticsDashboard.tsx 运营看板页面
  - [x] admin/src/pages/Analytics/ReportList.tsx 智能报表管理页面
  - [x] admin/src/App.tsx 路由注册

---

### 阶段九：无人机SDK集成 (P2 优先级)

#### 任务 9.1：SDK集成架构设计
- **状态**: [ ] 未开始
- **目标品牌**: 大疆(DJI)、极飞(XAG)
- **功能**: 实时数据获取、飞行任务下发、远程控制、视频回传

---

## 三、前端适配任务

### 移动端阶段一：核心角色适配 (对应后端阶段一)

#### 任务 M1.1：飞手角色入口与注册
- **状态**: [x] 已完成 (2026-03-02)
- **对应后端**: 任务1.1-1.2 (飞手数据模型与认证流程)
- **需开发页面**:
  - [ ] `src/screens/pilot/PilotRegisterScreen.tsx` - 飞手注册页面
  - [ ] `src/screens/pilot/PilotProfileScreen.tsx` - 飞手档案页面
  - [ ] `src/screens/pilot/CertificationUploadScreen.tsx` - 资质证书上传
  - [ ] `src/screens/pilot/FlightLogScreen.tsx` - 飞行记录列表
- **需开发组件**:
  - [ ] `src/components/CertificationCard.tsx` - 证书卡片组件
  - [ ] `src/components/PilotStatusBadge.tsx` - 飞手状态徽章
- **需新增服务**:
  - [ ] `src/services/pilot.ts` - 飞手API服务
- **API对接**:
  - POST `/api/v1/pilot/register` - 注册成为飞手
  - GET `/api/v1/pilot/profile` - 获取飞手档案
  - PUT `/api/v1/pilot/profile` - 更新飞手档案
  - POST `/api/v1/pilot/certification` - 提交资质证书
  - GET `/api/v1/pilot/certifications` - 获取证书列表
  - POST `/api/v1/pilot/criminal-check` - 提交无犯罪记录
  - POST `/api/v1/pilot/health-check` - 提交健康证明
  - GET `/api/v1/pilot/flight-logs` - 获取飞行记录
  - POST `/api/v1/pilot/flight-log` - 添加飞行记录

#### 任务 M1.2：飞手无人机绑定管理
- **状态**: [x] 已完成 (2026-03-02)
- **对应后端**: 任务1.1 (飞手与无人机绑定表)
- **需开发页面**:
  - [ ] `src/screens/pilot/BoundDronesScreen.tsx` - 已绑定无人机列表
  - [ ] `src/screens/pilot/BindDroneScreen.tsx` - 绑定新无人机
- **API对接**:
  - GET `/api/v1/pilot/bound-drones` - 获取绑定的无人机
  - POST `/api/v1/pilot/bind-drone` - 绑定无人机
  - DELETE `/api/v1/pilot/unbind/:bindingId` - 解绑无人机

#### 任务 M1.3：机主认证增强页面
- **状态**: [x] 已完成 (2026-03-02)
- **对应后端**: 任务1.3 (机主认证体系增强)
- **需修改页面**:
  - [ ] `src/screens/drone/AddDroneScreen.tsx` - 增加UOM/保险/适航字段
  - [ ] `src/screens/drone/DroneDetailScreen.tsx` - 显示认证状态
- **需开发页面**:
  - [ ] `src/screens/drone/DroneCertificationScreen.tsx` - 无人机认证详情
  - [ ] `src/screens/drone/MaintenanceLogScreen.tsx` - 维护记录页面
- **API对接**:
  - POST `/api/v1/drone/:id/uom` - 提交UOM平台登记
  - POST `/api/v1/drone/:id/insurance` - 提交保险信息
  - POST `/api/v1/drone/:id/airworthiness` - 提交适航证书
  - POST `/api/v1/drone/:id/maintenance` - 添加维护记录
  - GET `/api/v1/drone/:id/maintenance` - 获取维护记录
  - GET `/api/v1/drone/:id/cert-status` - 获取认证状态

#### 任务 M1.4：业主/客户角色页面
- **状态**: [x] 已完成 (2026-03-02)
- **对应后端**: 任务1.4 (业主角色整合与增强)
- **需开发页面**:
  - [ ] `src/screens/client/ClientRegisterScreen.tsx` - 业主注册页面
  - [ ] `src/screens/client/ClientProfileScreen.tsx` - 业主档案页面
  - [ ] `src/screens/client/EnterpriseCertScreen.tsx` - 企业资质上传
  - [ ] `src/screens/client/CargoDeclarationScreen.tsx` - 货物申报页面
- **需新增服务**:
  - [ ] `src/services/client.ts` - 业主API服务
- **API对接**:
  - POST `/api/v1/client/register/individual` - 注册个人客户
  - POST `/api/v1/client/register/enterprise` - 注册企业客户
  - GET `/api/v1/client/profile` - 获取客户档案
  - PUT `/api/v1/client/profile` - 更新客户档案
  - POST `/api/v1/client/credit/check` - 发起征信查询
  - POST `/api/v1/client/enterprise/cert` - 提交企业资质
  - POST `/api/v1/client/cargo/declaration` - 创建货物申报
  - GET `/api/v1/client/order/eligibility` - 检查下单资格

---

### 移动端阶段二：派单与接单适配 (对应后端阶段二)

#### 任务 M2.1：业主派单页面
- **状态**: [x] 已完成 (2026-03-02)
- **对应后端**: 任务2.1-2.3 (智能匹配与派单系统)
- **需开发页面**:
  - [ ] `src/screens/dispatch/CreateDispatchTaskScreen.tsx` - 创建派单任务
  - [ ] `src/screens/dispatch/DispatchTaskDetailScreen.tsx` - 任务详情
  - [ ] `src/screens/dispatch/MyDispatchTasksScreen.tsx` - 我的派单任务
  - [ ] `src/screens/dispatch/CandidateListScreen.tsx` - 候选人列表
- **需新增服务**:
  - [ ] `src/services/dispatch.ts` - 派单API服务
- **API对接**:
  - POST `/api/v1/dispatch/task` - 创建派单任务
  - GET `/api/v1/dispatch/task/:id` - 获取任务详情
  - GET `/api/v1/dispatch/tasks/client` - 获取业主任务列表
  - POST `/api/v1/dispatch/task/:id/cancel` - 取消任务
  - GET `/api/v1/dispatch/task/:id/candidates` - 获取候选人列表
  - GET `/api/v1/dispatch/task/:id/logs` - 获取任务日志

#### 任务 M2.2：飞手接单大厅
- **状态**: [x] 已完成 (2026-03-02)
- **对应后端**: 任务2.2 (派单算法实现)
- **需开发页面**:
  - [ ] `src/screens/pilot/OrderHallScreen.tsx` - 接单大厅/任务列表
  - [ ] `src/screens/pilot/PendingTaskScreen.tsx` - 待处理任务详情
  - [ ] `src/screens/pilot/MyPilotTasksScreen.tsx` - 我的飞行任务
- **需开发组件**:
  - [ ] `src/components/DispatchTaskCard.tsx` - 派单任务卡片
  - [ ] `src/components/TaskStatusTimeline.tsx` - 任务状态时间线
- **API对接**:
  - GET `/api/v1/dispatch/tasks/pilot` - 获取飞手任务列表
  - GET `/api/v1/dispatch/task/pending` - 获取待接单任务
  - POST `/api/v1/dispatch/candidate/:id/accept` - 接受任务
  - POST `/api/v1/dispatch/candidate/:id/reject` - 拒绝任务

---

### 移动端阶段三：飞行监控与轨迹适配 (对应后端阶段三)

#### 任务 M3.1：飞行位置上报与监控
- **状态**: [x] 已完成 (2026-03-02)
- **对应后端**: 任务3.1-3.2 (订单执行与飞行监控)
- **需开发页面**:
  - [ ] `src/screens/flight/FlightExecutionScreen.tsx` - 飞行执行页面(飞手端)
  - [ ] `src/screens/flight/FlightMonitorScreen.tsx` - 飞行监控页面(业主端)
  - [ ] `src/screens/flight/AlertListScreen.tsx` - 告警列表
- **需开发组件**:
  - [ ] `src/components/FlightMap.tsx` - 飞行地图组件
  - [ ] `src/components/FlightStatusPanel.tsx` - 飞行状态面板
  - [ ] `src/components/AlertBanner.tsx` - 告警横幅
  - [ ] `src/components/BatteryIndicator.tsx` - 电量指示器
- **需新增服务**:
  - [ ] `src/services/flight.ts` - 飞行监控API服务
- **API对接**:
  - POST `/api/v1/flight/position` - 上报飞行位置
  - GET `/api/v1/flight/position/:order_id/latest` - 获取最新位置
  - GET `/api/v1/flight/position/:order_id/history` - 获取位置历史
  - GET `/api/v1/flight/alerts/:order_id` - 获取告警列表
  - GET `/api/v1/flight/alerts/:order_id/active` - 获取活跃告警
  - POST `/api/v1/flight/alert/:alert_id/acknowledge` - 确认告警

#### 任务 M3.2：轨迹录制与回放
- **状态**: [x] 已完成 (2026-03-02)
- **对应后端**: 任务3.3 (轨迹录制与复用)
- **需开发页面**:
  - [ ] `src/screens/flight/TrajectoryRecordScreen.tsx` - 轨迹录制控制
  - [ ] `src/screens/flight/TrajectoryPlaybackScreen.tsx` - 轨迹回放
  - [ ] `src/screens/flight/SavedRoutesScreen.tsx` - 保存的路线列表
  - [ ] `src/screens/flight/RouteDetailScreen.tsx` - 路线详情
- **需开发组件**:
  - [ ] `src/components/TrajectoryMap.tsx` - 轨迹地图组件
  - [ ] `src/components/RouteCard.tsx` - 路线卡片
- **API对接**:
  - POST `/api/v1/flight/trajectory/start` - 开始录制
  - POST `/api/v1/flight/trajectory/stop` - 停止录制
  - GET `/api/v1/flight/trajectory/:order_id` - 获取轨迹详情
  - POST `/api/v1/flight/route/from-trajectory` - 从轨迹创建路线
  - GET `/api/v1/flight/routes/mine` - 我的路线
  - GET `/api/v1/flight/routes/nearby` - 附近路线

#### 任务 M3.3：多点任务执行
- **状态**: [x] 已完成 (2026-03-02)
- **对应后端**: 任务3.3 (多点装卸任务)
- **需开发页面**:
  - [ ] `src/screens/flight/MultiPointTaskScreen.tsx` - 多点任务执行
  - [ ] `src/screens/flight/StopConfirmScreen.tsx` - 站点确认页面
- **需开发组件**:
  - [ ] `src/components/StopListPanel.tsx` - 站点列表面板
  - [ ] `src/components/StopDetailCard.tsx` - 站点详情卡片
- **API对接**:
  - GET `/api/v1/flight/multipoint-task/:id` - 获取多点任务详情
  - POST `/api/v1/flight/multipoint-task/:id/start` - 开始任务
  - POST `/api/v1/flight/multipoint-task/:id/next` - 下一站点
  - POST `/api/v1/flight/multipoint-task/stop/:stop_id/arrive` - 到达站点
  - POST `/api/v1/flight/multipoint-task/stop/:stop_id/complete` - 完成站点

---

### 移动端通用任务

#### 任务 M0.1：导航与角色切换
- **状态**: [ ] 未开始
- **需修改文件**:
  - [ ] `src/navigation/AppNavigator.tsx` - 添加飞手/业主导航栈
  - [ ] `src/navigation/MainNavigator.tsx` - 底部Tab添加角色切换
  - [ ] `src/screens/profile/ProfileScreen.tsx` - 角色切换入口
- **功能说明**:
  - 支持用户在 租客/机主/飞手/业主 角色间切换
  - 不同角色显示不同的底部Tab和功能入口

#### 任务 M0.2：通用组件库扩展
- **状态**: [ ] 未开始
- **需开发组件**:
  - [ ] `src/components/FileUploader.tsx` - 文件上传组件
  - [ ] `src/components/SignaturePad.tsx` - 签名板组件
  - [ ] `src/components/StatusTimeline.tsx` - 状态时间线组件
  - [ ] `src/components/MapMarkerCluster.tsx` - 地图标记聚合
  - [ ] `src/components/PullToRefresh.tsx` - 下拉刷新组件

---

### 管理后台适配 (React)

#### 任务 A1.1：飞手管理模块
- **状态**: [ ] 未开始
- **需开发页面**:
  - 飞手列表页 (含搜索、筛选、分页)
  - 飞手详情页 (档案、证书、飞行记录)
  - 资质审核页 (CAAC执照、无犯罪、健康证明)

#### 任务 A1.2：机主认证审核增强
- **状态**: [ ] 未开始
- **需开发页面**:
  - UOM登记审核
  - 保险信息审核
  - 适航证书审核
  - 维护记录查看

#### 任务 A2.1：派单任务管理
- **状态**: [ ] 未开始
- **需开发页面**:
  - 派单任务列表
  - 任务详情与匹配情况
  - 手动派单操作

#### 任务 A3.1：飞行监控大屏
- **状态**: [ ] 未开始
- **需开发页面**:
  - 实时飞行地图
  - 告警监控面板
  - 围栏管理页面

---

## 四、实施路径建议

### 第一阶段 (1-2个月): 核心角色与匹配系统
1. 完成飞手数据模型设计与实现
2. 完成飞手注册认证流程
3. 增强机主认证体系
4. 重构智能匹配引擎
5. 实现基础派单算法

### 第二阶段 (3-4个月): 订单与空域报备系统
1. 扩展订单生命周期
2. 实现飞行监控模块
3. 开发空域报备管理数据模型
4. 实现合规性检查模块

### 第三阶段 (5-6个月): 支付与信用系统
1. 实现分账数据模型
2. 开发定价模型
3. 实现分账规则引擎
4. 开发信用评分系统

### 第四阶段 (7-8个月): 保险与数据分析
1. 开发保险管理模块
2. 实现理赔流程
3. 开发运营数据看板
4. 无人机SDK集成准备

---

## 五、任务状态说明

- `[ ]` 未开始
- `[~]` 进行中
- `[x]` 已完成
- `[!]` 阻塞/需讨论

---

## 六、更新日志

| 日期 | 更新内容 | 更新人 |
|------|---------|--------|
| 2026-03-01 | 初始版本，完成差异分析和任务规划 | AI Assistant |
| 2026-03-01 | 完成任务1.1: 飞手角色数据模型设计与实现 | AI Assistant |
| 2026-03-01 | 完成任务1.2: 飞手注册认证流程后端API开发 | AI Assistant |
| 2026-03-02 | 完成任务1.3: 机主认证体系增强(UOM登记、保险、适航证书、维护记录) | AI Assistant |
| 2026-03-02 | 完成任务1.4: 业主角色整合与增强(Client模型、征信查询、企业资质、货物申报) | AI Assistant |
| 2026-03-02 | 完成任务2.1: 智能匹配引擎重构(7维度评分算法、阶梯搜索策略) | AI Assistant |
| 2026-03-02 | 完成任务2.2: 派单算法实现(候选人管理、生命周期、配置化参数) | AI Assistant |
| 2026-03-02 | 完成任务2.3: 订单发布模块增强(17个API端点、4张数据表) | AI Assistant |
| 2026-03-02 | 完成任务3.1: 订单生命周期扩展(订单表新增20+字段支持完整执行流程) | AI Assistant |
| 2026-03-02 | 完成任务3.2: 飞行监控模块(实时位置、告警系统、电子围栏、配置化参数) | AI Assistant |
| 2026-03-02 | 完成任务3.3: 轨迹录制与复用(轨迹录制、路线管理、多点任务、30个API端点) | AI Assistant |
| 2026-03-02 | 完成移动端M1.1-M1.4: 飞手/机主/业主全部角色页面与服务层 | AI Assistant |
| 2026-03-02 | 完成移动端M2.1-M2.2: 派单创建/任务列表/飞手接单页面 | AI Assistant |
| 2026-03-02 | 完成移动端M3.1-M3.3: 飞行监控/轨迹记录/多点任务页面与导航集成 | AI Assistant |
| 2026-03-02 | 完成阶段六: 信用评价与风控体系(信用分1000分制、违规管理、风控检测、黑名单、保证金) | AI Assistant |
| 2026-03-02 | 完成阶段七: 保险与理赔系统(4种险种、6步理赔流程、争议申诉) | AI Assistant |
| 2026-03-02 | 完成阶段八: 数据分析与决策支持(实时看板、趋势分析、智能报表、区域统计) | AI Assistant |
| 2026-03-02 | 数据看板迁移至管理后台(admin)，删除移动端看板页面 | AI Assistant |

