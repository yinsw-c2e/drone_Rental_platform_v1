# API端到端测试

<cite>
**本文档引用的文件**
- [openapi-v2.yaml](file://backend/docs/openapi-v2.yaml)
- [main.go](file://backend/cmd/server/main.go)
- [router.go](file://backend/internal/api/v1/router.go)
- [router.go](file://backend/internal/api/v2/router.go)
- [auth.go](file://backend/internal/api/middleware/auth.go)
- [pagination.go](file://backend/internal/api/middleware/pagination.go)
- [logger.go](file://backend/internal/api/middleware/logger.go)
- [response.go](file://backend/internal/pkg/response/response.go)
- [v2.go](file://backend/internal/pkg/response/v2.go)
- [jwt.go](file://backend/internal/pkg/jwt/jwt.go)
- [handler.go](file://backend/internal/api/v2/auth/handler.go)
- [handler.go](file://backend/internal/api/v2/me/handler.go)
- [handler.go](file://backend/internal/api/v2/order/handler.go)
- [TEST_CHECKLIST.md](file://TEST_CHECKLIST.md)
- [DEMO_ACCOUNTS.md](file://DEMO_ACCOUNTS.md)
</cite>

## 目录
1. [引言](#引言)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概览](#架构概览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考虑](#性能考虑)
8. [故障排除指南](#故障排除指南)
9. [结论](#结论)
10. [附录](#附录)

## 引言

本文档为无人机租赁平台的API接口创建了完整的端到端测试指南。基于OpenAPI规范和现有的检查工具，详细说明了API测试的完整流程和策略。该平台采用Go语言开发，使用Gin框架构建RESTful API，支持v1和v2两个版本的API接口。

平台的核心业务包括无人机租赁、飞手管理、订单执行、支付结算、信用评价等多个模块，通过统一的API接口为移动端应用、管理后台和第三方系统提供服务。

## 项目结构

无人机租赁平台采用分层架构设计，主要分为以下层次：

```mermaid
graph TB
subgraph "表现层"
Mobile[移动应用]
Admin[管理后台]
Web[Web界面]
end
subgraph "API层"
V1[v1路由层]
V2[v2路由层]
Middleware[中间件层]
end
subgraph "业务逻辑层"
Services[业务服务层]
Handlers[处理器层]
end
subgraph "数据访问层"
Repositories[仓储层]
Database[(数据库)]
end
subgraph "基础设施"
Redis[(Redis缓存)]
SMS[短信服务]
Payment[支付网关]
end
Mobile --> V2
Admin --> V1
Web --> V1
V1 --> Handlers
V2 --> Handlers
Handlers --> Services
Services --> Repositories
Repositories --> Database
Services --> Redis
Services --> SMS
Services --> Payment
Middleware --> V1
Middleware --> V2
```

**图表来源**
- [main.go:52-266](file://backend/cmd/server/main.go#L52-L266)
- [router.go:58-634](file://backend/internal/api/v1/router.go#L58-L634)
- [router.go:72-283](file://backend/internal/api/v2/router.go#L72-L283)

**章节来源**
- [main.go:1-390](file://backend/cmd/server/main.go#L1-L390)
- [router.go:1-634](file://backend/internal/api/v1/router.go#L1-L634)
- [router.go:1-283](file://backend/internal/api/v2/router.go#L1-L283)

## 核心组件

### API版本管理

平台同时支持v1和v2两个版本的API接口，通过不同的路由前缀进行区分：

- **v1 API**: 位于 `/api/v1` 路径，包含完整的传统接口
- **v2 API**: 位于 `/api/v2` 路径，提供精简化的接口版本

### 中间件体系

系统实现了完整的中间件栈来处理认证、授权、日志记录等横切关注点：

```mermaid
flowchart TD
Request[HTTP请求] --> CORS[CORS中间件]
CORS --> Logger[日志中间件]
Logger --> Auth[认证中间件]
Auth --> Admin[管理员中间件]
Admin --> Pagination[分页中间件]
Pagination --> Handler[业务处理器]
Handler --> Response[响应处理]
Response --> End[HTTP响应]
Auth --> |令牌验证失败| Unauthorized[401未授权]
Admin --> |权限不足| Forbidden[403禁止访问]
```

**图表来源**
- [auth.go:22-73](file://backend/internal/api/middleware/auth.go#L22-L73)
- [pagination.go:14-36](file://backend/internal/api/middleware/pagination.go#L14-L36)
- [logger.go:10-31](file://backend/internal/api/middleware/logger.go#L10-L31)

### 响应格式标准化

系统提供了两套响应格式标准：

- **v1响应格式**: 使用统一的Response结构体
- **v2响应格式**: 使用带追踪ID的V2Envelope结构体

**章节来源**
- [auth.go:1-106](file://backend/internal/api/middleware/auth.go#L1-L106)
- [pagination.go:1-71](file://backend/internal/api/middleware/pagination.go#L1-L71)
- [logger.go:1-32](file://backend/internal/api/middleware/logger.go#L1-L32)
- [response.go:1-104](file://backend/internal/pkg/response/response.go#L1-L104)
- [v2.go:1-141](file://backend/internal/pkg/response/v2.go#L1-L141)

## 架构概览

### API路由架构

```mermaid
graph TB
subgraph "v2 API架构"
V2Root[/api/v2] --> Status[状态检查]
V2Root --> Auth[认证模块]
V2Root --> Authenticated[认证后路由]
Authenticated --> Me[用户信息]
Authenticated --> Client[客户模块]
Authenticated --> Supply[供给模块]
Authenticated --> Demand[需求模块]
Authenticated --> Owner[机主模块]
Authenticated --> Pilot[飞手模块]
Authenticated --> Order[订单模块]
Authenticated --> Dispatch[派单模块]
Authenticated --> Payment[支付模块]
Authenticated --> Settlement[结算模块]
Authenticated --> Notification[通知模块]
Authenticated --> Review[评价模块]
end
subgraph "v1 API架构"
V1Root[/api/v1] --> Public[公共路由]
V1Root --> AuthenticatedV1[认证后路由]
AuthenticatedV1 --> User[用户模块]
AuthenticatedV1 --> Drone[无人机模块]
AuthenticatedV1 --> OrderV1[订单模块]
AuthenticatedV1 --> PaymentV1[支付模块]
AuthenticatedV1 --> Message[消息模块]
AuthenticatedV1 --> ReviewV1[评价模块]
AuthenticatedV1 --> PilotV1[飞手模块]
AuthenticatedV1 --> ClientV1[客户模块]
AuthenticatedV1 --> DispatchV1[派单模块]
AuthenticatedV1 --> Flight[飞行模块]
AuthenticatedV1 --> Airspace[空域模块]
AuthenticatedV1 --> SettlementV1[结算模块]
AuthenticatedV1 --> Credit[信用模块]
AuthenticatedV1 --> Insurance[保险模块]
AuthenticatedV1 --> Analytics[分析模块]
end
```

**图表来源**
- [router.go:72-283](file://backend/internal/api/v2/router.go#L72-L283)
- [router.go:58-634](file://backend/internal/api/v1/router.go#L58-L634)

### 认证流程

```mermaid
sequenceDiagram
participant Client as 客户端
participant Auth as 认证处理器
participant JWT as JWT服务
participant Redis as Redis缓存
participant User as 用户服务
Client->>Auth : POST /api/v2/auth/login
Auth->>Auth : 验证用户名密码
Auth->>JWT : 生成访问令牌
JWT-->>Auth : 访问令牌 + 刷新令牌
Auth->>User : 获取用户角色摘要
User-->>Auth : 角色摘要信息
Auth->>Redis : 检查令牌黑名单
Redis-->>Auth : 令牌状态
Auth-->>Client : 返回令牌和用户信息
Note over Client,Redis : 访问受保护资源时携带令牌
Client->>Auth : GET /api/v2/me
Auth->>JWT : 验证访问令牌
JWT-->>Auth : 令牌有效
Auth->>Redis : 检查令牌黑名单
Redis-->>Auth : 令牌有效
Auth->>User : 获取用户信息
User-->>Auth : 用户信息
Auth-->>Client : 返回用户信息
```

**图表来源**
- [handler.go:77-118](file://backend/internal/api/v2/auth/handler.go#L77-L118)
- [jwt.go:27-67](file://backend/internal/pkg/jwt/jwt.go#L27-L67)
- [auth.go:22-61](file://backend/internal/api/middleware/auth.go#L22-L61)

**章节来源**
- [router.go:72-283](file://backend/internal/api/v2/router.go#L72-L283)
- [handler.go:1-149](file://backend/internal/api/v2/auth/handler.go#L1-L149)
- [jwt.go:1-87](file://backend/internal/pkg/jwt/jwt.go#L1-L87)

## 详细组件分析

### 订单处理组件

订单处理是平台的核心业务组件，涵盖了从需求创建到订单完成的完整生命周期：

```mermaid
stateDiagram-v2
[*] --> 需求创建
需求创建 --> 需求发布
需求发布 --> 报价生成
报价生成 --> 选择供应商
选择供应商 --> 直达订单
选择供应商 --> 市场订单
直达订单 --> 订单确认
市场订单 --> 匹配中
匹配中 --> 供应商确认
供应商确认 --> 订单确认
订单确认 --> 支付
支付 --> 执行中
执行中 --> 完成
执行中 --> 争议
争议 --> 结算
完成 --> 结算
结算 --> [*]
```

**图表来源**
- [handler.go:32-80](file://backend/internal/api/v2/order/handler.go#L32-L80)

#### 订单状态管理

订单状态流转遵循严格的业务规则，每个状态转换都经过完整的验证和授权检查：

| 状态 | 描述 | 触发条件 | 权限要求 |
|------|------|----------|----------|
| 需求创建 | 创建需求草稿 | 客户身份 | 客户 |
| 需求发布 | 发布需求 | 需求完善 | 客户 |
| 报价生成 | 机主报价 | 有合适无人机 | 机主 |
| 选择供应商 | 客户选择报价 | 选择最优报价 | 客户 |
| 直达订单 | 直接下单 | 机主确认 | 客户 |
| 市场订单 | 市场匹配 | 系统匹配 | 系统 |
| 订单确认 | 供应商确认 | 机主确认 | 机主 |
| 支付 | 客户支付 | 支付完成 | 客户 |
| 执行中 | 飞手执行 | 飞手接单 | 飞手 |
| 完成 | 订单完成 | 任务完成 | 客户/飞手 |
| 争议 | 发生争议 | 争议产生 | 任意方 |
| 结算 | 资金结算 | 订单完成 | 系统 |

**章节来源**
- [handler.go:1-763](file://backend/internal/api/v2/order/handler.go#L1-L763)

### 认证与授权组件

系统实现了多层次的安全防护机制：

```mermaid
classDiagram
class AuthMiddleware {
+AuthMiddleware() gin.HandlerFunc
+SetTokenBlacklistRedis(redis.Client)
-validateToken(token) Claims
-checkBlacklist(token) bool
}
class JWTService {
+GenerateTokenPair(userID, userType) TokenPair
+ParseToken(tokenStr, secret) Claims
-generateAccessToken(payload) string
-generateRefreshToken(payload) string
}
class AdminMiddleware {
+AdminMiddleware() gin.HandlerFunc
-checkAdminPermission() bool
}
class ResponseHandler {
+V2Success(data) Response
+V2Error(code, message) Response
+V2Unauthorized(message) Response
+V2Forbidden(message) Response
}
AuthMiddleware --> JWTService : 使用
AuthMiddleware --> ResponseHandler : 返回
AdminMiddleware --> ResponseHandler : 返回
```

**图表来源**
- [auth.go:22-73](file://backend/internal/api/middleware/auth.go#L22-L73)
- [jwt.go:27-67](file://backend/internal/pkg/jwt/jwt.go#L27-L67)
- [v2.go:39-109](file://backend/internal/pkg/response/v2.go#L39-L109)

#### 分页处理组件

系统提供了灵活的分页处理机制，支持默认值和最大值限制：

```mermaid
flowchart TD
Request[请求参数] --> ParsePage[解析page参数]
Request --> ParsePageSize[解析page_size参数]
ParsePage --> CheckPage{参数有效?}
CheckPage --> |否| DefaultPage[使用默认值1]
CheckPage --> |是| ValidatePage[验证正整数]
ValidatePage --> ValidPage[返回有效页码]
ParsePageSize --> CheckPageSize{参数有效?}
CheckPageSize --> |否| DefaultPageSize[使用默认值20]
CheckPageSize --> |是| ValidatePageSize[验证正整数]
ValidatePageSize --> MaxLimit[检查最大值限制]
MaxLimit --> ValidPageSize[返回有效页大小]
DefaultPage --> Combine[组合参数]
ValidPage --> Combine
DefaultPageSize --> Combine
ValidPageSize --> Combine
Combine --> Next[传递给处理器]
```

**图表来源**
- [pagination.go:14-36](file://backend/internal/api/middleware/pagination.go#L14-L36)

**章节来源**
- [auth.go:1-106](file://backend/internal/api/middleware/auth.go#L1-L106)
- [jwt.go:1-87](file://backend/internal/pkg/jwt/jwt.go#L1-L87)
- [pagination.go:1-71](file://backend/internal/api/middleware/pagination.go#L1-L71)
- [v2.go:1-141](file://backend/internal/pkg/response/v2.go#L1-L141)

## 依赖关系分析

### 服务依赖图

```mermaid
graph TB
subgraph "外部依赖"
MySQL[(MySQL数据库)]
RedisDB[(Redis缓存)]
SMS[短信服务]
Payment[支付网关]
AMap[高德地图API]
end
subgraph "核心服务"
AuthService[认证服务]
UserService[用户服务]
OrderService[订单服务]
DroneService[无人机服务]
PilotService[飞手服务]
OwnerService[机主服务]
ClientService[客户服务]
DispatchService[派单服务]
FlightService[飞行服务]
PaymentService[支付服务]
SettlementService[结算服务]
MessageService[消息服务]
ReviewService[评价服务]
end
subgraph "数据访问"
UserRepository[用户仓储]
OrderRepository[订单仓储]
DroneRepository[无人机仓储]
PilotRepository[飞手仓储]
OwnerRepository[机主仓储]
ClientRepository[客户仓储]
DispatchRepository[派单仓储]
FlightRepository[飞行仓储]
PaymentRepository[支付仓储]
SettlementRepository[结算仓储]
end
AuthService --> UserRepository
OrderService --> OrderRepository
DroneService --> DroneRepository
PilotService --> PilotRepository
OwnerService --> OwnerRepository
ClientService --> ClientRepository
DispatchService --> DispatchRepository
FlightService --> FlightRepository
PaymentService --> PaymentRepository
SettlementService --> SettlementRepository
AuthService --> RedisDB
OrderService --> MySQL
DroneService --> MySQL
PilotService --> MySQL
OwnerService --> MySQL
ClientService --> MySQL
DispatchService --> MySQL
FlightService --> MySQL
PaymentService --> MySQL
SettlementService --> MySQL
OrderService --> PaymentService
OrderService --> DispatchService
DispatchService --> PilotService
DispatchService --> FlightService
PaymentService --> Payment
AuthService --> SMS
```

**图表来源**
- [main.go:109-219](file://backend/cmd/server/main.go#L109-L219)
- [main.go:224-247](file://backend/cmd/server/main.go#L224-L247)

### API契约测试

基于OpenAPI规范，系统实现了完整的API契约测试：

```mermaid
sequenceDiagram
participant Test as 测试工具
participant OpenAPI as OpenAPI规范
participant API as API服务器
participant Validator as 验证器
Test->>OpenAPI : 加载API规范
OpenAPI->>Test : 返回接口定义
Test->>API : 发送HTTP请求
API->>Validator : 验证请求格式
Validator->>API : 验证通过
API->>API : 执行业务逻辑
API->>Validator : 验证响应格式
Validator->>API : 验证通过
API->>Test : 返回响应
Test->>Test : 生成测试报告
```

**图表来源**
- [openapi-v2.yaml:29-800](file://backend/docs/openapi-v2.yaml#L29-L800)

**章节来源**
- [openapi-v2.yaml:1-1058](file://backend/docs/openapi-v2.yaml#L1-L1058)
- [main.go:109-219](file://backend/cmd/server/main.go#L109-L219)

## 性能考虑

### 并发测试策略

系统支持高并发场景下的API测试：

1. **负载测试**: 使用JMeter或Gatling进行压力测试
2. **并发测试**: 模拟多用户同时操作的场景
3. **性能基准**: 建立API响应时间基准线
4. **资源监控**: 监控CPU、内存、数据库连接使用情况

### 缓存策略

```mermaid
flowchart TD
Request[API请求] --> CacheCheck{缓存命中?}
CacheCheck --> |是| ReturnCache[返回缓存数据]
CacheCheck --> |否| ProcessRequest[处理请求]
ProcessRequest --> UpdateCache[更新缓存]
UpdateCache --> ReturnData[返回数据]
ReturnCache --> End[结束]
ReturnData --> End
```

**图表来源**
- [auth.go:40-48](file://backend/internal/api/middleware/auth.go#L40-L48)

## 故障排除指南

### 常见错误场景

| 错误类型 | 错误代码 | 触发原因 | 解决方案 |
|----------|----------|----------|----------|
| 未授权访问 | 401 | 缺少或无效的认证令牌 | 重新登录获取新令牌 |
| 权限不足 | 403 | 用户权限不足 | 检查用户角色和权限 |
| 参数错误 | 400 | 请求参数格式错误 | 检查OpenAPI规范 |
| 服务器错误 | 500 | 服务器内部错误 | 查看日志文件 |
| 资源不存在 | 404 | 请求的资源不存在 | 检查资源ID |

### 日志分析

系统提供了详细的日志记录机制：

```mermaid
flowchart TD
Request[HTTP请求] --> LogStart[开始记录]
LogStart --> Process[处理请求]
Process --> Response[生成响应]
Response --> LogEnd[结束记录]
LogStart --> Fields[记录字段]
Fields --> Path[请求路径]
Fields --> Method[请求方法]
Fields --> IP[客户端IP]
Fields --> Query[查询参数]
Fields --> Latency[处理耗时]
Fields --> Status[响应状态]
LogEnd --> Export[导出日志]
Export --> Analysis[分析日志]
```

**图表来源**
- [logger.go:10-31](file://backend/internal/api/middleware/logger.go#L10-L31)

**章节来源**
- [logger.go:1-32](file://backend/internal/api/middleware/logger.go#L1-L32)
- [response.go:55-85](file://backend/internal/pkg/response/response.go#L55-L85)
- [v2.go:84-109](file://backend/internal/pkg/response/v2.go#L84-L109)

## 结论

无人机租赁平台的API测试体系涵盖了从基础认证授权到复杂业务流程的全方位测试策略。通过结合OpenAPI规范、中间件安全机制、标准化响应格式和完善的日志监控，确保了API接口的可靠性、安全性和性能。

建议在实际测试中重点关注：
1. **认证流程测试**: 确保JWT令牌的有效性和安全性
2. **业务流程测试**: 验证完整的订单生命周期
3. **并发性能测试**: 模拟高并发场景
4. **错误处理测试**: 验证异常情况的处理
5. **数据一致性测试**: 确保业务数据的准确性

## 附录

### 测试数据管理

平台提供了完整的测试数据管理机制：

- **演示账号**: 基于阶段10验收的演示账号
- **测试环境**: 隔离的测试数据库和缓存
- **数据清理**: 自动化的测试数据清理机制
- **环境配置**: 支持多环境配置管理

### 回归测试策略

```mermaid
flowchart LR
Build[构建新版本] --> UnitTest[单元测试]
UnitTest --> IntegrationTest[集成测试]
IntegrationTest --> APIContractTest[API契约测试]
APIContractTest --> RegressionTest[回归测试]
RegressionTest --> AcceptanceTest[验收测试]
AcceptanceTest --> Deploy[部署]
UnitTest --> Fix[修复缺陷]
IntegrationTest --> Fix
APIContractTest --> Fix
RegressionTest --> Fix
AcceptanceTest --> Fix
Fix --> UnitTest
```

**图表来源**
- [TEST_CHECKLIST.md:9-448](file://TEST_CHECKLIST.md#L9-L448)

### Postman使用指南

1. **导入OpenAPI**: 在Postman中导入openapi-v2.yaml文件
2. **配置环境变量**: 设置BASE_URL、TOKEN等环境变量
3. **创建集合**: 按模块创建API测试集合
4. **编写测试脚本**: 为关键接口编写断言脚本
5. **运行测试**: 执行完整的测试套件

**章节来源**
- [TEST_CHECKLIST.md:1-448](file://TEST_CHECKLIST.md#L1-L448)
- [DEMO_ACCOUNTS.md:1-116](file://DEMO_ACCOUNTS.md#L1-L116)