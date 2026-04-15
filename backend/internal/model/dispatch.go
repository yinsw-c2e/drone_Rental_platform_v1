package model

import (
	"time"

	"gorm.io/gorm"
)

// DispatchTask 旧派单任务池对象（保留现有 v1 匹配/候选流程）
type DispatchTask struct {
	ID            int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	TaskNo        string `gorm:"type:varchar(50);uniqueIndex;not null" json:"task_no"`
	OrderID       int64  `gorm:"index" json:"order_id"`        // 关联订单
	CargoDemandID int64  `gorm:"index" json:"cargo_demand_id"` // 关联货运需求
	ClientID      int64  `gorm:"index;not null" json:"client_id"`
	TaskType      string `gorm:"type:varchar(30);not null" json:"task_type"`     // instant(即时), scheduled(预约), batch(批量)
	Priority      int    `gorm:"default:5" json:"priority"`                      // 1-10, 10最高优先级
	Status        string `gorm:"type:varchar(30);default:pending" json:"status"` // pending, matching, dispatching, assigned, cancelled, expired

	// ==================== 货物信息 ====================
	CargoWeight     float64 `gorm:"type:decimal(10,2)" json:"cargo_weight"` // 货物重量(kg)
	CargoVolume     float64 `gorm:"type:decimal(10,2)" json:"cargo_volume"` // 货物体积(立方厘米)
	CargoCategory   string  `gorm:"type:varchar(50)" json:"cargo_category"` // 货物类别
	IsHazardous     bool    `gorm:"default:false" json:"is_hazardous"`
	RequiresSpecial JSON    `gorm:"type:json" json:"requires_special"` // 特殊要求: 温控、防震等

	// ==================== 位置信息 ====================
	PickupLatitude    float64 `gorm:"type:decimal(10,7)" json:"pickup_latitude"`
	PickupLongitude   float64 `gorm:"type:decimal(10,7)" json:"pickup_longitude"`
	PickupAddress     string  `gorm:"type:varchar(255)" json:"pickup_address"`
	DeliveryLatitude  float64 `gorm:"type:decimal(10,7)" json:"delivery_latitude"`
	DeliveryLongitude float64 `gorm:"type:decimal(10,7)" json:"delivery_longitude"`
	DeliveryAddress   string  `gorm:"type:varchar(255)" json:"delivery_address"`
	FlightDistance    float64 `gorm:"type:decimal(10,2)" json:"flight_distance"` // 飞行距离(km)

	// ==================== 时间约束 ====================
	RequiredPickupTime   *time.Time `json:"required_pickup_time"`   // 要求取货时间
	RequiredDeliveryTime *time.Time `json:"required_delivery_time"` // 要求送达时间
	TimeWindowStart      *time.Time `json:"time_window_start"`      // 时间窗口开始
	TimeWindowEnd        *time.Time `json:"time_window_end"`        // 时间窗口结束
	DispatchDeadline     *time.Time `json:"dispatch_deadline"`      // 派单截止时间

	// ==================== 预算约束 ====================
	BudgetMin    int64 `json:"budget_min"`    // 最低预算(分)
	BudgetMax    int64 `json:"budget_max"`    // 最高预算(分)
	OfferedPrice int64 `json:"offered_price"` // 业主出价(分)

	// ==================== 匹配要求 ====================
	RequiredLicenseType string  `gorm:"type:varchar(30)" json:"required_license_type"` // 要求的执照类型: VLOS, BVLOS
	MinPilotRating      float64 `gorm:"type:decimal(3,2)" json:"min_pilot_rating"`     // 飞手最低评分
	MinDroneRating      float64 `gorm:"type:decimal(3,2)" json:"min_drone_rating"`     // 无人机最低评分
	MinCreditScore      int     `json:"min_credit_score"`                              // 最低信用分

	// ==================== 派单结果 ====================
	AssignedPilotID *int64     `gorm:"index" json:"assigned_pilot_id"`
	AssignedDroneID *int64     `gorm:"index" json:"assigned_drone_id"`
	AssignedOwnerID *int64     `gorm:"index" json:"assigned_owner_id"` // 机主ID
	AssignedAt      *time.Time `json:"assigned_at"`
	FinalPrice      int64      `json:"final_price"`                    // 最终成交价(分)
	MatchScore      int        `json:"match_score"`                    // 匹配得分
	MatchDetails    JSON       `gorm:"type:json" json:"match_details"` // 匹配详情

	// ==================== 匹配尝试统计 ====================
	MatchAttempts int        `gorm:"default:0" json:"match_attempts"` // 匹配尝试次数
	MaxAttempts   int        `gorm:"default:3" json:"max_attempts"`   // 最大尝试次数
	LastMatchTime *time.Time `json:"last_match_time"`
	FailReason    string     `gorm:"type:text" json:"fail_reason"` // 失败原因

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Client *Client `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	Pilot  *Pilot  `gorm:"foreignKey:AssignedPilotID" json:"pilot,omitempty"`
	Drone  *Drone  `gorm:"foreignKey:AssignedDroneID" json:"drone,omitempty"`
}

func (DispatchTask) TableName() string {
	return "dispatch_pool_tasks"
}

// DispatchCandidate 旧派单候选人（对应任务池候选）
type DispatchCandidate struct {
	ID      int64 `gorm:"primaryKey;autoIncrement" json:"id"`
	TaskID  int64 `gorm:"index;not null" json:"task_id"`
	PilotID int64 `gorm:"index;not null" json:"pilot_id"`
	DroneID int64 `gorm:"index;not null" json:"drone_id"`
	OwnerID int64 `gorm:"index;not null" json:"owner_id"`

	// ==================== 综合评分 ====================
	TotalScore int `json:"total_score"` // 综合得分(0-100)

	// ==================== 各维度得分 ====================
	DistanceScore      int `json:"distance_score"`      // 距离得分(0-25)
	LoadScore          int `json:"load_score"`          // 载荷匹配得分(0-15)
	QualificationScore int `json:"qualification_score"` // 资质匹配得分(0-20)
	CreditScore        int `json:"credit_score"`        // 信用得分(0-15)
	PriceScore         int `json:"price_score"`         // 价格得分(0-10)
	TimeScore          int `json:"time_score"`          // 时间匹配得分(0-10)
	RatingScore        int `json:"rating_score"`        // 服务评分得分(0-5)

	// ==================== 详细数据 ====================
	Distance      float64 `gorm:"type:decimal(10,2)" json:"distance"` // 距离(km)
	EstimatedTime int     `json:"estimated_time"`                     // 预计完成时间(分钟)
	QuotedPrice   int64   `json:"quoted_price"`                       // 报价(分)

	// ==================== 状态 ====================
	Status       string     `gorm:"type:varchar(20);default:pending" json:"status"` // pending, notified, accepted, rejected, timeout
	NotifiedAt   *time.Time `json:"notified_at"`
	RespondedAt  *time.Time `json:"responded_at"`
	ResponseNote string     `gorm:"type:text" json:"response_note"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Task  *DispatchTask `gorm:"foreignKey:TaskID" json:"task,omitempty"`
	Pilot *Pilot        `gorm:"foreignKey:PilotID" json:"pilot,omitempty"`
	Drone *Drone        `gorm:"foreignKey:DroneID" json:"drone,omitempty"`
}

func (DispatchCandidate) TableName() string {
	return "dispatch_pool_candidates"
}

// DispatchConfig 旧任务池匹配配置
type DispatchConfig struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ConfigKey   string    `gorm:"type:varchar(100);uniqueIndex;not null" json:"config_key"`
	ConfigValue string    `gorm:"type:text" json:"config_value"`
	ConfigType  string    `gorm:"type:varchar(20)" json:"config_type"` // int, float, string, json
	Description string    `gorm:"type:varchar(255)" json:"description"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (DispatchConfig) TableName() string {
	return "dispatch_pool_configs"
}

// DispatchLog 旧任务池日志
type DispatchLog struct {
	ID        int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	TaskID    int64     `gorm:"index;not null" json:"task_id"`
	Action    string    `gorm:"type:varchar(50)" json:"action"`     // created, matching_started, candidate_found, notified, accepted, rejected, assigned, cancelled
	ActorType string    `gorm:"type:varchar(20)" json:"actor_type"` // system, pilot, client, admin
	ActorID   int64     `json:"actor_id"`
	Details   JSON      `gorm:"type:json" json:"details"`
	CreatedAt time.Time `json:"created_at"`
}

func (DispatchLog) TableName() string {
	return "dispatch_pool_logs"
}

// FormalDispatchTask 正式派单任务。用于表达“某订单发给某个飞手的一次正式执行指令”。
type FormalDispatchTask struct {
	ID                int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	DispatchNo        string         `gorm:"type:varchar(50);uniqueIndex;not null" json:"dispatch_no"`
	OrderID           int64          `gorm:"index;not null" json:"order_id"`
	ProviderUserID    int64          `gorm:"index;not null" json:"provider_user_id"`
	TargetPilotUserID int64          `gorm:"index;not null" json:"target_pilot_user_id"`
	DispatchSource    string         `gorm:"type:varchar(30);not null;index" json:"dispatch_source"`
	RetryCount        int            `gorm:"default:0" json:"retry_count"`
	Status            string         `gorm:"type:varchar(20);default:pending_response;index" json:"status"`
	Reason            string         `gorm:"type:text" json:"reason"`
	SentAt            *time.Time     `json:"sent_at"`
	RespondedAt       *time.Time     `json:"responded_at"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`

	Order       *Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
	Provider    *User  `gorm:"foreignKey:ProviderUserID" json:"provider,omitempty"`
	TargetPilot *User  `gorm:"foreignKey:TargetPilotUserID" json:"target_pilot,omitempty"`
}

func (FormalDispatchTask) TableName() string {
	return "dispatch_tasks"
}

// FormalDispatchLog 正式派单日志
type FormalDispatchLog struct {
	ID             int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	DispatchTaskID int64     `gorm:"index;not null" json:"dispatch_task_id"`
	ActionType     string    `gorm:"type:varchar(30);not null" json:"action_type"`
	OperatorUserID int64     `gorm:"index" json:"operator_user_id"`
	Note           string    `gorm:"type:text" json:"note"`
	CreatedAt      time.Time `json:"created_at"`

	DispatchTask *FormalDispatchTask `gorm:"foreignKey:DispatchTaskID" json:"dispatch_task,omitempty"`
	Operator     *User               `gorm:"foreignKey:OperatorUserID" json:"operator,omitempty"`
}

func (FormalDispatchLog) TableName() string {
	return "dispatch_logs"
}

// ==================== 飞行监控相关模型 ====================

// FlightRecord 订单履约飞行记录。每条记录表示一个订单执行过程中的独立架次。
