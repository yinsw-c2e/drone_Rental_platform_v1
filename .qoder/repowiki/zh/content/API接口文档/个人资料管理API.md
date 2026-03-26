# 个人资料管理API

<cite>
**本文档引用的文件**
- [backend/internal/api/v2/me/handler.go](file://backend/internal/api/v2/me/handler.go)
- [backend/internal/api/v2/client/handler.go](file://backend/internal/api/v2/client/handler.go)
- [backend/internal/api/v2/owner/handler.go](file://backend/internal/api/v2/owner/handler.go)
- [backend/internal/api/v2/pilot/handler.go](file://backend/internal/api/v2/pilot/handler.go)
- [backend/internal/service/user_service.go](file://backend/internal/service/user_service.go)
- [backend/internal/service/client_service.go](file://backend/internal/service/client_service.go)
- [backend/internal/service/owner_service.go](file://backend/internal/service/owner_service.go)
- [backend/internal/service/pilot_service.go](file://backend/internal/service/pilot_service.go)
- [backend/internal/model/models.go](file://backend/internal/model/models.go)
- [backend/internal/api/v2/common/errors.go](file://backend/internal/api/v2/common/errors.go)
- [backend/internal/pkg/response/response.go](file://backend/internal/pkg/response/response.go)
- [backend/internal/api/v2/router.go](file://backend/internal/api/v2/router.go)
- [backend/internal/api/middleware/auth.go](file://backend/internal/api/middleware/auth.go)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概览](#架构概览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考虑](#性能考虑)
8. [故障排除指南](#故障排除指南)
9. [结论](#结论)

## 简介

个人资料管理API是无人机租赁平台的核心模块之一，负责管理平台内所有用户角色的个人资料信息。该系统支持三种主要角色：Client（客户）、Owner（机主）和Pilot（飞手），每个角色都有独特的资料字段和权限控制。

系统采用分层架构设计，包含API层、业务逻辑层和服务层，确保代码的可维护性和扩展性。所有API请求都经过统一的身份验证和权限控制，确保数据安全和访问控制。

## 项目结构

个人资料管理API位于后端服务的v2版本中，采用按角色组织的模块结构：

```mermaid
graph TB
subgraph "API层"
ME[Me接口]
CLIENT[Client接口]
OWNER[Owner接口]
PILOT[Pilot接口]
end
subgraph "业务逻辑层"
USER_SERVICE[UserService]
CLIENT_SERVICE[ClientService]
OWNER_SERVICE[OwnerService]
PILOT_SERVICE[PilotService]
end
subgraph "数据模型层"
USER_MODEL[User模型]
CLIENT_PROFILE[ClientProfile模型]
OWNER_PROFILE[OwnerProfile模型]
PILOT_PROFILE[PilotProfile模型]
DRONE_MODEL[Drone模型]
end
subgraph "中间件层"
AUTH_MIDDLEWARE[身份验证中间件]
PAGINATION_MIDDLEWARE[分页中间件]
end
ME --> USER_SERVICE
CLIENT --> CLIENT_SERVICE
OWNER --> OWNER_SERVICE
PILOT --> PILOT_SERVICE
USER_SERVICE --> USER_MODEL
CLIENT_SERVICE --> CLIENT_PROFILE
OWNER_SERVICE --> OWNER_PROFILE
PILOT_SERVICE --> PILOT_PROFILE
OWNER_SERVICE --> DRONE_MODEL
AUTH_MIDDLEWARE --> ME
AUTH_MIDDLEWARE --> CLIENT
AUTH_MIDDLEWARE --> OWNER
AUTH_MIDDLEWARE --> PILOT
```

**图表来源**
- [backend/internal/api/v2/router.go:72-282](file://backend/internal/api/v2/router.go#L72-L282)
- [backend/internal/api/v2/me/handler.go:1-28](file://backend/internal/api/v2/me/handler.go#L1-L28)
- [backend/internal/api/v2/client/handler.go:1-57](file://backend/internal/api/v2/client/handler.go#L1-L57)
- [backend/internal/api/v2/owner/handler.go:1-760](file://backend/internal/api/v2/owner/handler.go#L1-L760)
- [backend/internal/api/v2/pilot/handler.go:1-541](file://backend/internal/api/v2/pilot/handler.go#L1-L541)

**章节来源**
- [backend/internal/api/v2/router.go:1-283](file://backend/internal/api/v2/router.go#L1-L283)

## 核心组件

### Me接口 - 初始化数据获取

Me接口为所有已登录用户提供统一的初始化数据获取功能，包括用户基本信息和角色摘要。

**接口定义：**
- 路径：`GET /api/v2/me`
- 权限：需要身份验证
- 功能：返回用户的个人资料和角色权限摘要

**数据结构：**
```mermaid
classDiagram
class MeSummary {
+MeUser user
+RoleSummary role_summary
}
class MeUser {
+int64 id
+string phone
+string nickname
+string avatar_url
}
class RoleSummary {
+bool has_client_role
+bool has_owner_role
+bool has_pilot_role
+bool can_publish_supply
+bool can_accept_dispatch
+bool can_self_execute
}
```

**图表来源**
- [backend/internal/service/user_service.go:12-31](file://backend/internal/service/user_service.go#L12-L31)

### Client角色 - 客户资料管理

Client角色提供完整的客户档案管理功能，包括个人客户和企业客户的差异化管理。

**核心功能：**
- 客户档案查询和更新
- 企业资质管理
- 征信查询和管理
- 货物申报管理

**数据模型：**
```mermaid
classDiagram
class ClientProfileView {
+int64 id
+int64 user_id
+string client_type
+string company_name
+string business_license_no
+string legal_representative
+string contact_person
+string contact_phone
+string contact_email
+string status
+string verification_status
+string enterprise_verified
+string credit_check_status
+int platform_credit_score
+time created_at
+time updated_at
+time verified_at
}
class ClientProfileUpdateInput {
+string* client_type
+string* company_name
+string* business_license_no
+string* business_license_doc
+string* legal_representative
+string* contact_person
+string* contact_phone
+string* contact_email
+string* default_contact_name
+string* default_contact_phone
+string* preferred_city
+string* remark
}
```

**图表来源**
- [backend/internal/service/client_service.go:57-80](file://backend/internal/service/client_service.go#L57-L80)
- [backend/internal/service/client_service.go:42-55](file://backend/internal/service/client_service.go#L42-L55)

### Owner角色 - 机主资料管理

Owner角色提供机主档案管理和无人机供给发布功能。

**核心功能：**
- 机主档案管理
- 无人机管理
- 供给发布和管理
- 飞手绑定管理
- 报价管理

**数据模型：**
```mermaid
classDiagram
class OwnerProfileInput {
+string service_city
+string contact_phone
+string intro
}
class OwnerSupplyInput {
+int64 drone_id
+string title
+string description
+string[] service_types
+string[] cargo_scenes
+json_raw_message service_area_snapshot
+int64 base_price_amount
+string pricing_unit
+json_raw_message pricing_rule
+json_raw_message available_time_slots
+bool* accepts_direct_order
+string status
}
class CreateQuoteInput {
+int64 drone_id
+int64 price_amount
+string execution_plan
}
```

**图表来源**
- [backend/internal/service/owner_service.go:27-31](file://backend/internal/service/owner_service.go#L27-L31)
- [backend/internal/service/owner_service.go:41-60](file://backend/internal/service/owner_service.go#L41-L60)

### Pilot角色 - 飞手资料管理

Pilot角色提供飞手档案管理和任务接取功能。

**核心功能：**
- 飞手档案管理
- 接单状态管理
- 飞手绑定管理
- 候选需求管理
- 派单任务管理
- 飞行记录管理

**数据模型：**
```mermaid
classDiagram
class PilotProfileInput {
+string caac_license_no
+string caac_license_type
+time* caac_license_expire_date
+string caac_license_image
+float64* service_radius
+string[] special_skills
+string current_city
}
class PilotProfileView {
+int64 id
+int64 user_id
+string caac_license_no
+string caac_license_type
+time* caac_license_expire_at
+string caac_license_image
+string verification_status
+string availability_status
+int service_radius_km
+float64 service_radius
+string current_city
+json service_cities
+json special_skills
+json skill_tags
+float64 service_rating
+int credit_score
+time created_at
+time updated_at
}
class RegisterPilotReq {
+string caac_license_no
+string caac_license_type
+time* caac_license_expire_date
+string caac_license_image
+float64 service_radius
+string[] special_skills
}
```

**图表来源**
- [backend/internal/service/pilot_service.go:92-121](file://backend/internal/service/pilot_service.go#L92-L121)
- [backend/internal/service/pilot_service.go:77-85](file://backend/internal/service/pilot_service.go#L77-L85)

**章节来源**
- [backend/internal/service/user_service.go:1-213](file://backend/internal/service/user_service.go#L1-L213)
- [backend/internal/service/client_service.go:1-780](file://backend/internal/service/client_service.go#L1-L780)
- [backend/internal/service/owner_service.go:1-818](file://backend/internal/service/owner_service.go#L1-L818)
- [backend/internal/service/pilot_service.go:1-1519](file://backend/internal/service/pilot_service.go#L1-L1519)

## 架构概览

系统采用分层架构设计，确保关注点分离和代码的可维护性：

```mermaid
sequenceDiagram
participant Client as 客户端
participant API as API层
participant Middleware as 中间件
participant Service as 业务服务层
participant Repository as 数据仓储层
participant Database as 数据库
Client->>API : HTTP请求
API->>Middleware : 身份验证
Middleware->>Middleware : JWT令牌验证
Middleware->>API : 用户信息注入
API->>Service : 业务逻辑调用
Service->>Repository : 数据访问
Repository->>Database : SQL查询
Database-->>Repository : 查询结果
Repository-->>Service : 数据对象
Service-->>API : 业务结果
API-->>Client : JSON响应
```

**图表来源**
- [backend/internal/api/v2/router.go:72-282](file://backend/internal/api/v2/router.go#L72-L282)
- [backend/internal/api/middleware/auth.go:22-61](file://backend/internal/api/middleware/auth.go#L22-L61)

### 错误处理机制

系统实现了统一的错误处理机制，支持多种HTTP状态码和错误类型：

```mermaid
flowchart TD
Start([请求开始]) --> Validate[参数验证]
Validate --> Valid{验证通过?}
Valid --> |否| ParamError[参数错误]
Valid --> |是| Process[业务处理]
Process --> Success{处理成功?}
Success --> |是| SuccessResponse[成功响应]
Success --> |否| ErrorHandler[错误处理]
ErrorHandler --> ErrorType{错误类型判断}
ErrorType --> |记录不存在| NotFound[404未找到]
ErrorType --> |权限不足| Forbidden[403禁止访问]
ErrorType --> |数据库错误| InternalError[500内部错误]
ErrorType --> |冲突| Conflict[409冲突]
ErrorType --> |其他| BadRequest[400错误请求]
ParamError --> End([结束])
NotFound --> End
Forbidden --> End
InternalError --> End
Conflict --> End
BadRequest --> End
SuccessResponse --> End
```

**图表来源**
- [backend/internal/api/v2/common/errors.go:13-35](file://backend/internal/api/v2/common/errors.go#L13-L35)
- [backend/internal/pkg/response/response.go:47-103](file://backend/internal/pkg/response/response.go#L47-L103)

**章节来源**
- [backend/internal/api/v2/common/errors.go:1-36](file://backend/internal/api/v2/common/errors.go#L1-L36)
- [backend/internal/pkg/response/response.go:1-104](file://backend/internal/pkg/response/response.go#L1-L104)

## 详细组件分析

### Me接口实现分析

Me接口作为系统的入口点，提供了统一的用户信息获取功能：

```mermaid
sequenceDiagram
participant Client as 客户端
participant Handler as Me处理器
participant Service as UserService
participant Repo as 数据仓储
participant Model as 数据模型
Client->>Handler : GET /api/v2/me
Handler->>Handler : 从上下文获取用户ID
Handler->>Service : GetMe(userID)
Service->>Repo : GetByID(userID)
Repo->>Model : 查询用户信息
Model-->>Repo : 用户对象
Repo-->>Service : 用户对象
Service->>Service : GetRoleSummary(userID)
Service->>Service : 组装MeSummary
Service-->>Handler : MeSummary
Handler-->>Client : JSON响应
```

**图表来源**
- [backend/internal/api/v2/me/handler.go:19-27](file://backend/internal/api/v2/me/handler.go#L19-L27)
- [backend/internal/service/user_service.go:61-81](file://backend/internal/service/user_service.go#L61-L81)

**章节来源**
- [backend/internal/api/v2/me/handler.go:1-28](file://backend/internal/api/v2/me/handler.go#L1-L28)
- [backend/internal/service/user_service.go:61-147](file://backend/internal/service/user_service.go#L61-L147)

### Client接口实现分析

Client接口提供了完整的客户档案管理功能：

```mermaid
classDiagram
class ClientHandler {
-ClientService clientService
+GetProfile(c) void
+UpdateProfile(c) void
}
class ClientService {
-ClientRepo clientRepo
-UserRepo userRepo
-RoleProfileRepo roleProfileRepo
+GetCurrentProfile(userID) ClientProfileView
+UpdateCurrentProfile(userID, input) ClientProfileView
+RegisterIndividual(userID) Client
+RegisterEnterprise(userID, ...) Client
}
class ClientProfileView {
+int64 id
+int64 user_id
+string client_type
+string company_name
+string business_license_no
+string legal_representative
+string contact_person
+string contact_phone
+string contact_email
+string status
+string verification_status
+string enterprise_verified
+string credit_check_status
+int platform_credit_score
+time created_at
+time updated_at
+time verified_at
}
ClientHandler --> ClientService
ClientService --> ClientProfileView
```

**图表来源**
- [backend/internal/api/v2/client/handler.go:12-18](file://backend/internal/api/v2/client/handler.go#L12-L18)
- [backend/internal/service/client_service.go:24-40](file://backend/internal/service/client_service.go#L24-L40)
- [backend/internal/service/client_service.go:232-247](file://backend/internal/service/client_service.go#L232-L247)

**章节来源**
- [backend/internal/api/v2/client/handler.go:1-57](file://backend/internal/api/v2/client/handler.go#L1-L57)
- [backend/internal/service/client_service.go:232-320](file://backend/internal/service/client_service.go#L232-L320)

### Owner接口实现分析

Owner接口提供了机主的完整管理功能：

```mermaid
sequenceDiagram
participant Client as 客户端
participant Handler as Owner处理器
participant Service as OwnerService
participant DroneService as DroneService
participant Repo as 数据仓储
Client->>Handler : GET /api/v2/owner/profile
Handler->>Handler : 获取用户ID
Handler->>Service : GetProfile(userID)
Service->>Service : ensureOwnerProfile(userID)
Service->>Repo : GetOwnerProfileByUserID(userID)
Repo-->>Service : OwnerProfile
Service-->>Handler : OwnerProfile
Handler-->>Client : JSON响应
Note over Client,DroneService : 无人机认证提交流程
Client->>Handler : POST /api/v2/owner/drones/ : drone_id/certifications
Handler->>Handler : 解析drone_id
Handler->>Handler : 绑定请求体
Handler->>DroneService : SubmitCertification(...)
DroneService->>Repo : 更新认证状态
Repo-->>DroneService : 更新结果
DroneService-->>Handler : 认证状态
Handler-->>Client : JSON响应
```

**图表来源**
- [backend/internal/api/v2/owner/handler.go:29-42](file://backend/internal/api/v2/owner/handler.go#L29-L42)
- [backend/internal/api/v2/owner/handler.go:158-258](file://backend/internal/api/v2/owner/handler.go#L158-L258)

**章节来源**
- [backend/internal/api/v2/owner/handler.go:29-258](file://backend/internal/api/v2/owner/handler.go#L29-L258)
- [backend/internal/service/owner_service.go:82-103](file://backend/internal/service/owner_service.go#L82-L103)

### Pilot接口实现分析

Pilot接口提供了飞手的完整管理功能：

```mermaid
flowchart TD
Start([飞手档案更新]) --> CheckEmpty{检查请求体为空?}
CheckEmpty --> |是| ValidationError[参数验证错误]
CheckEmpty --> |否| ValidateLicense{验证执照信息}
ValidateLicense --> |无效| LicenseError[执照类型错误]
ValidateLicense --> |有效| UpdateProfile[更新档案]
UpdateProfile --> SyncProfile[同步角色档案]
SyncProfile --> Success[更新成功]
ValidationError --> End([结束])
LicenseError --> End
Success --> End
```

**图表来源**
- [backend/internal/api/v2/pilot/handler.go:39-62](file://backend/internal/api/v2/pilot/handler.go#L39-L62)
- [backend/internal/service/pilot_service.go:230-308](file://backend/internal/service/pilot_service.go#L230-L308)

**章节来源**
- [backend/internal/api/v2/pilot/handler.go:24-96](file://backend/internal/api/v2/pilot/handler.go#L24-L96)
- [backend/internal/service/pilot_service.go:218-308](file://backend/internal/service/pilot_service.go#L218-L308)

## 依赖关系分析

系统采用清晰的依赖关系设计，确保模块间的松耦合：

```mermaid
graph TB
subgraph "外部依赖"
GIN[Gin框架]
JWT[JWT库]
GORM[GORM ORM]
REDIS[Redis缓存]
end
subgraph "内部模块"
API[API层]
SERVICE[服务层]
REPOSITORY[仓储层]
MODEL[数据模型]
end
subgraph "中间件"
AUTH[身份验证]
CORS[CORS处理]
LOGGER[日志记录]
PAGINATION[分页处理]
end
GIN --> API
JWT --> AUTH
REDIS --> AUTH
GORM --> REPOSITORY
API --> SERVICE
SERVICE --> REPOSITORY
REPOSITORY --> MODEL
AUTH --> API
CORS --> API
LOGGER --> API
PAGINATION --> API
```

**图表来源**
- [backend/internal/api/middleware/auth.go:1-106](file://backend/internal/api/middleware/auth.go#L1-L106)
- [backend/internal/api/v2/router.go:1-283](file://backend/internal/api/v2/router.go#L1-L283)

### 数据模型关系

```mermaid
erDiagram
USERS {
int64 id PK
string phone UK
string nickname
string avatar_url
string user_type
string id_verified
int credit_score
string status
timestamp created_at
timestamp updated_at
}
CLIENT_PROFILES {
int64 id PK
int64 user_id UK
string status
string default_contact_name
string default_contact_phone
string preferred_city
timestamp created_at
timestamp updated_at
}
OWNER_PROFILES {
int64 id PK
int64 user_id UK
string verification_status
string status
string service_city
string contact_phone
text intro
timestamp created_at
timestamp updated_at
}
PILOT_PROFILES {
int64 id PK
int64 user_id UK
string verification_status
string availability_status
int service_radius_km
json service_cities
json skill_tags
string caac_license_no
timestamp caac_license_expire_at
timestamp created_at
timestamp updated_at
}
DRONES {
int64 id PK
int64 owner_id FK
string brand
string model
string serial_number UK
decimal mtow_kg
decimal max_payload_kg
string certification_status
string availability_status
string uom_verified
string insurance_verified
string airworthiness_verified
timestamp created_at
timestamp updated_at
}
USERS ||--o{ CLIENT_PROFILES : has
USERS ||--o{ OWNER_PROFILES : has
USERS ||--o{ PILOT_PROFILES : has
USERS ||--o{ DRONES : owns
```

**图表来源**
- [backend/internal/model/models.go:9-26](file://backend/internal/model/models.go#L9-L26)
- [backend/internal/model/models.go:32-49](file://backend/internal/model/models.go#L32-L49)
- [backend/internal/model/models.go:51-68](file://backend/internal/model/models.go#L51-L68)
- [backend/internal/model/models.go:70-89](file://backend/internal/model/models.go#L70-L89)
- [backend/internal/model/models.go:91-152](file://backend/internal/model/models.go#L91-L152)

**章节来源**
- [backend/internal/model/models.go:1-200](file://backend/internal/model/models.go#L1-L200)

## 性能考虑

系统在设计时充分考虑了性能优化：

### 缓存策略
- Redis用于JWT令牌黑名单检查
- 分页中间件限制查询范围
- 数据模型预加载减少N+1查询

### 数据库优化
- 合理的索引设计（唯一索引、普通索引）
- 关联查询优化
- 批量操作支持

### API优化
- 统一的响应格式减少前端处理复杂度
- 错误处理标准化
- 请求参数验证提前执行

## 故障排除指南

### 常见问题及解决方案

**身份验证相关问题：**
- 缺少Authorization头部：检查JWT令牌格式
- 令牌格式错误：确保使用Bearer前缀
- 令牌过期：使用刷新令牌获取新令牌
- 令牌被撤销：检查Redis黑名单

**数据访问相关问题：**
- 记录不存在：检查用户ID和资源ID
- 权限不足：验证用户角色和资源所有权
- 数据库连接失败：检查数据库配置和连接池

**业务逻辑相关问题：**
- 参数验证失败：检查请求体格式和必填字段
- 业务规则违反：查看具体的业务约束条件
- 并发冲突：检查事务处理和锁机制

**章节来源**
- [backend/internal/api/middleware/auth.go:22-61](file://backend/internal/api/middleware/auth.go#L22-L61)
- [backend/internal/api/v2/common/errors.go:13-35](file://backend/internal/api/v2/common/errors.go#L13-L35)

## 结论

个人资料管理API系统设计合理，功能完整，具有良好的扩展性和维护性。系统通过清晰的分层架构、统一的错误处理机制和完善的权限控制，为无人机租赁平台提供了稳定可靠的个人资料管理能力。

主要特点包括：
- 支持三种角色的差异化管理
- 完整的CRUD操作支持
- 强大的权限控制机制
- 统一的错误处理和响应格式
- 良好的性能优化设计

未来可以考虑的功能增强包括：资料审核流程的进一步自动化、修改历史记录的详细追踪、多语言支持等。