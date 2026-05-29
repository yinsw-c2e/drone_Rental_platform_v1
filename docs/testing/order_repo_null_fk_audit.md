# OrderRepo NULL / Zero-Value Update Audit

Date: 2026-05-29

## 1. model.Order 字段与真实 orders schema 对照

真实外键约束来自本地 `INFORMATION_SCHEMA.KEY_COLUMN_USAGE`：

- `drone_id -> drones(id)`, nullable
- `owner_id -> users(id)`, nullable
- `pilot_id -> pilots(id)`, nullable
- `renter_id -> users(id)`, nullable

| 字段 | Go 类型 | DB 列 | DB nullable | FK | 风险 |
| --- | --- | --- | --- | --- | --- |
| ID | int64 | id | NO | - | 低 |
| OrderNo | string | order_no | NO | - | 低 |
| OrderType | string | order_type | NO | - | 低 |
| RelatedID | int64 | related_id | YES | - | 中：NULL 会读成 0 |
| OrderSource | string | order_source | YES | - | 低 |
| OrderMode | string | order_mode | NO | - | 低 |
| ClientRequestID | string | client_request_id | YES | unique | 中：空串会击穿 nullable unique |
| ServiceClassCode | string | service_class_code | NO | - | 低 |
| DemandID | int64 | demand_id | YES | - | 中：NULL 会读成 0 |
| SourceSupplyID | int64 | source_supply_id | YES | - | 中：NULL 会读成 0 |
| DroneID | int64 | drone_id | YES | drones(id) | P0：1452 外键风险 |
| OwnerID | int64 | owner_id | YES | users(id) | P0：1452 外键风险 |
| PilotID | int64 | pilot_id | YES | pilots(id) | P0：1452 外键风险 |
| RenterID | int64 | renter_id | YES | users(id) | P0：1452 外键风险 |
| ClientID | int64 | client_id | YES | - | 中：NULL 会读成 0 |
| ClientUserID | int64 | client_user_id | YES | - | 中：NULL 会读成 0 |
| ProviderUserID | int64 | provider_user_id | YES | - | 中：NULL 会读成 0 |
| DroneOwnerUserID | int64 | drone_owner_user_id | YES | - | 中：NULL 会读成 0 |
| ExecutorPilotUserID | int64 | executor_pilot_user_id | YES | - | 中：NULL 会读成 0 |
| DispatchTaskID | *int64 | dispatch_task_id | YES | - | 低：指针保留 NULL |
| NeedsDispatch | bool | needs_dispatch | YES | - | 低 |
| ExecutionMode | string | execution_mode | YES | - | 低 |
| Title | string | title | YES | - | 低 |
| ServiceType | string | service_type | YES | - | 低 |
| CargoWeightKG | float64 | cargo_weight_kg | NO | - | 低 |
| CargoVolumeM3 | float64 | cargo_volume_m3 | NO | - | 低 |
| CargoLengthCM | float64 | cargo_length_cm | NO | - | 低 |
| CargoWidthCM | float64 | cargo_width_cm | NO | - | 低 |
| CargoHeightCM | float64 | cargo_height_cm | NO | - | 低 |
| StartTime | time.Time | start_time | YES | - | 中：NULL 会读成零时间 |
| EndTime | time.Time | end_time | YES | - | 中：NULL 会读成零时间 |
| ServiceLatitude | float64 | service_latitude | YES | - | 中：NULL 会读成 0 |
| ServiceLongitude | float64 | service_longitude | YES | - | 中：NULL 会读成 0 |
| ServiceAddress | string | service_address | YES | - | 低 |
| DestLatitude | *float64 | dest_latitude | YES | - | 低：指针保留 NULL |
| DestLongitude | *float64 | dest_longitude | YES | - | 低：指针保留 NULL |
| DestAddress | string | dest_address | YES | - | 低 |
| EstimatedDistanceM | int | estimated_distance_m | NO | - | 低 |
| EstimatedDurationMin | int | estimated_duration_min | NO | - | 低 |
| PriceBreakdownJSON | JSON | price_breakdown_json | YES | - | 低 |
| BroadcastPoolID | *int64 | broadcast_pool_id | YES | - | 低：指针保留 NULL |
| ReservedStartAt | *time.Time | reserved_start_at | YES | - | 低：指针保留 NULL |
| GrabbedAt | *time.Time | grabbed_at | YES | - | 低：指针保留 NULL |
| GrabbedByUserID | int64 | grabbed_by_user_id | NO | - | 低 |
| TotalAmount | int64 | total_amount | YES | - | 中：NULL 会读成 0 |
| PlatformCommissionRate | float64 | platform_commission_rate | YES | - | 中：NULL 会读成 0 |
| PlatformCommission | int64 | platform_commission | YES | - | 中：NULL 会读成 0 |
| OwnerAmount | int64 | owner_amount | YES | - | 中：NULL 会读成 0 |
| DepositAmount | int64 | deposit_amount | YES | - | 中：NULL 会读成 0 |
| Status | string | status | YES | - | 低 |
| FlightStartTime | *time.Time | flight_start_time | YES | - | 低：指针保留 NULL |
| FlightEndTime | *time.Time | flight_end_time | YES | - | 低：指针保留 NULL |
| AirspaceStatus | string | airspace_status | YES | - | 低 |
| LoadingConfirmedAt | *time.Time | loading_confirmed_at | YES | - | 低：指针保留 NULL |
| LoadingConfirmedBy | int64 | loading_confirmed_by | YES | - | 中：NULL 会读成 0 |
| UnloadingConfirmedAt | *time.Time | unloading_confirmed_at | YES | - | 低：指针保留 NULL |
| UnloadingConfirmedBy | int64 | unloading_confirmed_by | YES | - | 中：NULL 会读成 0 |
| ActualFlightDistance | int | actual_flight_distance | YES | - | 中：NULL 会读成 0 |
| ActualFlightDuration | int | actual_flight_duration | YES | - | 中：NULL 会读成 0 |
| MaxAltitude | int | max_altitude | YES | - | 中：NULL 会读成 0 |
| AvgSpeed | int | avg_speed | YES | - | 中：NULL 会读成 0 |
| TrajectoryID | *int64 | trajectory_id | YES | - | 低：指针保留 NULL |
| ProviderConfirmedAt | *time.Time | provider_confirmed_at | YES | - | 低：指针保留 NULL |
| ProviderRejectedAt | *time.Time | provider_rejected_at | YES | - | 低：指针保留 NULL |
| ProviderRejectReason | string | provider_reject_reason | YES | - | 低 |
| PaidAt | *time.Time | paid_at | YES | - | 低：指针保留 NULL |
| CompletedAt | *time.Time | completed_at | YES | - | 低：指针保留 NULL |
| CancelReason | string | cancel_reason | YES | - | 低 |
| CancelBy | string | cancel_by | YES | - | 低 |
| CreatedAt | time.Time | created_at | YES | - | 低 |
| UpdatedAt | time.Time | updated_at | YES | - | 低 |
| DeletedAt | gorm.DeletedAt | deleted_at | YES | - | 低：GORM nullable 类型 |

## 2. 高危字段结论

`DB nullable + Go 非指针零值类型 + 有 FK 约束` 的字段只有四个：

| 字段 | DB 列 | 约束 | 风险等级 | 修法 |
| --- | --- | --- | --- | --- |
| DroneID | drone_id | drones(id) | P0 | `OrderRepo.Create/Update` 零值 omit；`UpdateFields` 0 -> NULL |
| OwnerID | owner_id | users(id) | P0 | 同上 |
| PilotID | pilot_id | pilots(id) | P0 | 同上 |
| RenterID | renter_id | users(id) | P0 | 同上 |

附带处理：`client_request_id` 虽然不是 FK，但它是 nullable unique；空字符串会在测试库和部分 SQL 方言中变成唯一键冲突，因此一并按“空即 NULL”处理。

## 3. repository 写入调用点排查

扫描命令：

```bash
rg -n "\.Save\(|\.Updates\(|Update\(" backend/internal/repository
```

### 全字段 Save / 近似全字段 Save

| 调用点 | 现状 | 风险等级 | 建议/本次处理 |
| --- | --- | --- | --- |
| `repository/order_repo.go:109` | `OrderRepo.Update` 全字段 `Save` | P0 | 本次集中封装 nullable FK omit |
| `repository/order_repo.go:39` | `OrderRepo.Create` 全字段 `Create` | P1 | 本次集中封装 nullable FK omit 和空 `client_request_id` omit |
| `repository/user_repo.go:38` | `Save(user)` | P1 | 非本次订单链路；后续按 nullable FK schema 单独审 |
| `repository/dispatch_repo.go:51` | `Save(task)` | P1 | 非本次订单链路；后续按 nullable FK schema 单独审 |
| `repository/demand_repo.go:34/150/199` | `Save(offer/demand/cargo)` | P1 | 非本次订单链路；后续按 nullable FK schema 单独审 |
| `repository/pilot_repo.go:53/193` | `Save(pilot/cert)` | P1 | 非本次订单链路；后续按 nullable FK schema 单独审 |
| `repository/analytics_repo.go:37/64/105/166` | `Save(...)` | P1 | 非本次订单链路；后续按 nullable FK schema 单独审 |
| `repository/owner_domain_service_repo.go:322` | `Save(supply)` | P1 | 非本次订单链路；后续按 nullable FK schema 单独审 |
| `repository/insurance_repo.go:47/145/256` | `Save(policy/claim/product)` | P1 | 非本次订单链路；后续按 nullable FK schema 单独审 |
| `repository/service_class_repo.go:59` | `Save(item)` | P1 | 非本次订单链路；后续按 nullable FK schema 单独审 |
| `repository/owner_domain_repo.go:76` | `Save(supply)` | P1 | 非本次订单链路；后续按 nullable FK schema 单独审 |
| `repository/airspace_repo.go:37/138` | `Save(app/zone)` | P1 | 非本次订单链路；后续按 nullable FK schema 单独审 |
| `repository/settlement_repo.go:107` | `Omit(clause.Associations).Save(s)` | P2 | 已避免 association，但仍是字段全量；后续按 settlement schema 审 |
| `repository/settlement_repo.go:252/297/331/363/394/451/604/715/734` | `Save(wallet/record/...)` | P1 | 非本次订单链路；后续按 nullable FK schema 单独审 |
| `repository/client_repo.go:48/252` | `Save(client/decl)` | P1 | 非本次订单链路；后续按 nullable FK schema 单独审 |
| `repository/flight_repo.go:77` | `Omit(clause.Associations).Save(record)` | P2 | 已避免 association，但仍是字段全量；后续按 flight schema 审 |
| `repository/flight_repo.go:215/427/693/789/901/957` | `Save(alert/fence/traj/route/task/stop)` | P1 | 非本次订单链路；后续按 nullable FK schema 单独审 |
| `repository/credit_repo.go:51/206/277/356/437` | `Save(score/risk/violation/blacklist/deposit)` | P1 | 非本次订单链路；后续按 nullable FK schema 单独审 |
| `repository/drone_repo.go:33` | `Omit("created_at").Save(drone)` | P2 | 有字段 omit，但仍非白名单；后续按 drone schema 审 |
| `repository/payment_repo.go:38` | `Save(payment)` | P1 | 非本次订单链路；后续按 nullable FK schema 单独审 |
| `repository/order_artifact_repo.go:57` | `Save(refund)` | P1 | 非本次订单链路；后续按 nullable FK schema 单独审 |
| `repository/demand_domain_repo.go:80` | `Save(demand)` | P1 | 非本次订单链路；后续按 nullable FK schema 单独审 |
| `repository/demand_domain_client_repo.go:25` | `Save(demand)` | P1 | 非本次订单链路；后续按 nullable FK schema 单独审 |

### scoped Updates / Update

`Model(...).Updates(map/fields)`、`Update("col", value)`、`UpdateFields(...)` 都是字段级写入，不属于本次“读全量 struct 后 Save 全字段”的 1452 主风险。订单相关的 `OrderRepo.UpdateFields` 已在本次加了 nullable FK 0 -> NULL 归一化，避免调用方 map 写 0。

## 4. 选型

选择方案 C：保留 `model.Order` 当前类型，在 `OrderRepo` 层集中处理 nullable FK 零值 omit / map 更新归一化。

理由：

- 方案 A 把所有 nullable FK 改成指针最干净，但会波及大量业务判断、JSON 响应、前端字段假设，当前 E2E 修复风险过大。
- 方案 B 逐个调用点手写 omit 容易漏，未来新增 FK 仍会踩。
- 方案 C 以最小改动覆盖当前所有 `OrderRepo.Create/Update/UpdateFields` 高危路径，并用单测锁住四个真实 FK 列。
