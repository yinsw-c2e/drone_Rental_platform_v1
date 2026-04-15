package model

import (
	"time"

	"gorm.io/gorm"
)

type Order struct {
	ID                     int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderNo                string         `gorm:"type:varchar(30);uniqueIndex;not null" json:"order_no"`
	OrderType              string         `gorm:"type:varchar(20);not null" json:"order_type"` // rental, cargo
	RelatedID              int64          `json:"related_id"`
	OrderSource            string         `gorm:"type:varchar(30);default:demand_market;index" json:"order_source"`
	DemandID               int64          `gorm:"index" json:"demand_id"`
	SourceSupplyID         int64          `gorm:"index" json:"source_supply_id"`
	DroneID                int64          `gorm:"index" json:"drone_id"`
	OwnerID                int64          `gorm:"index" json:"owner_id"`
	PilotID                int64          `gorm:"index" json:"pilot_id"` // 飞手ID
	RenterID               int64          `gorm:"index" json:"renter_id"`
	ClientID               int64          `gorm:"index" json:"client_id"`
	ClientUserID           int64          `gorm:"index" json:"client_user_id"`
	ProviderUserID         int64          `gorm:"index" json:"provider_user_id"`
	DroneOwnerUserID       int64          `gorm:"index" json:"drone_owner_user_id"`
	ExecutorPilotUserID    int64          `gorm:"index" json:"executor_pilot_user_id"`
	DispatchTaskID         *int64         `gorm:"index" json:"dispatch_task_id"`
	NeedsDispatch          bool           `gorm:"default:false;index" json:"needs_dispatch"`
	ExecutionMode          string         `gorm:"type:varchar(30);default:self_execute;index" json:"execution_mode"`
	Title                  string         `gorm:"type:varchar(200)" json:"title"`
	ServiceType            string         `gorm:"type:varchar(30)" json:"service_type"`
	StartTime              time.Time      `json:"start_time"`
	EndTime                time.Time      `json:"end_time"`
	ServiceLatitude        float64        `gorm:"type:decimal(10,7)" json:"service_latitude"`
	ServiceLongitude       float64        `gorm:"type:decimal(10,7)" json:"service_longitude"`
	ServiceAddress         string         `gorm:"type:varchar(255)" json:"service_address"`
	DestLatitude           *float64       `gorm:"type:decimal(10,7)" json:"dest_latitude"`
	DestLongitude          *float64       `gorm:"type:decimal(10,7)" json:"dest_longitude"`
	DestAddress            string         `gorm:"type:varchar(255)" json:"dest_address"`
	TotalAmount            int64          `json:"total_amount"`
	PlatformCommissionRate float64        `gorm:"type:decimal(5,2)" json:"platform_commission_rate"`
	PlatformCommission     int64          `json:"platform_commission"`
	OwnerAmount            int64          `json:"owner_amount"`
	DepositAmount          int64          `json:"deposit_amount"`
	Status                 string         `gorm:"type:varchar(40);default:created" json:"status"`
	FlightStartTime        *time.Time     `json:"flight_start_time"`
	FlightEndTime          *time.Time     `json:"flight_end_time"`
	AirspaceStatus         string         `gorm:"type:varchar(20);default:not_required" json:"airspace_status"`
	LoadingConfirmedAt     *time.Time     `json:"loading_confirmed_at"`
	LoadingConfirmedBy     int64          `json:"loading_confirmed_by"`
	UnloadingConfirmedAt   *time.Time     `json:"unloading_confirmed_at"`
	UnloadingConfirmedBy   int64          `json:"unloading_confirmed_by"`
	ActualFlightDistance   int            `json:"actual_flight_distance"`
	ActualFlightDuration   int            `json:"actual_flight_duration"`
	MaxAltitude            int            `json:"max_altitude"`
	AvgSpeed               int            `json:"avg_speed"`
	TrajectoryID           *int64         `gorm:"index" json:"trajectory_id"`
	ProviderConfirmedAt    *time.Time     `json:"provider_confirmed_at"`
	ProviderRejectedAt     *time.Time     `json:"provider_rejected_at"`
	ProviderRejectReason   string         `gorm:"type:text" json:"provider_reject_reason"`
	PaidAt                 *time.Time     `json:"paid_at"`
	CompletedAt            *time.Time     `json:"completed_at"`
	CancelReason           string         `gorm:"type:text" json:"cancel_reason"`
	CancelBy               string         `gorm:"type:varchar(20)" json:"cancel_by"`
	CreatedAt              time.Time      `json:"created_at"`
	UpdatedAt              time.Time      `json:"updated_at"`
	DeletedAt              gorm.DeletedAt `gorm:"index" json:"-"`

	Demand *Demand `gorm:"foreignKey:DemandID" json:"demand,omitempty"`
	Drone  *Drone  `gorm:"foreignKey:DroneID" json:"drone,omitempty"`
	Owner  *User   `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	Pilot  *Pilot  `gorm:"foreignKey:PilotID" json:"pilot,omitempty"`
	Renter *User   `gorm:"foreignKey:RenterID" json:"renter,omitempty"`

	// 虚拟字段：是否已评件（不存储在数据库）
	Reviewed bool `gorm:"-" json:"reviewed"`
}

func (Order) TableName() string {
	return "orders"
}

type OrderTimeline struct {
	ID           int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderID      int64     `gorm:"index;not null" json:"order_id"`
	Status       string    `gorm:"type:varchar(40)" json:"status"`
	Note         string    `gorm:"type:text" json:"note"`
	OperatorID   int64     `json:"operator_id"`
	OperatorType string    `gorm:"type:varchar(20)" json:"operator_type"` // owner, renter, system, admin
	CreatedAt    time.Time `json:"created_at"`
}

func (OrderTimeline) TableName() string {
	return "order_timelines"
}

type OrderSnapshot struct {
	ID           int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderID      int64     `gorm:"uniqueIndex:idx_order_snapshot_type;not null" json:"order_id"`
	SnapshotType string    `gorm:"type:varchar(30);uniqueIndex:idx_order_snapshot_type;not null" json:"snapshot_type"`
	SnapshotData JSON      `gorm:"type:json" json:"snapshot_data"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`

	Order *Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
}

func (OrderSnapshot) TableName() string {
	return "order_snapshots"
}

type Payment struct {
	ID            int64      `gorm:"primaryKey;autoIncrement" json:"id"`
	PaymentNo     string     `gorm:"type:varchar(50);uniqueIndex;not null" json:"payment_no"`
	OrderID       int64      `gorm:"index;not null" json:"order_id"`
	UserID        int64      `gorm:"index;not null" json:"user_id"`
	PaymentType   string     `gorm:"type:varchar(20)" json:"payment_type"`   // order, deposit, refund, withdrawal
	PaymentMethod string     `gorm:"type:varchar(20)" json:"payment_method"` // wechat, alipay, mock
	Amount        int64      `json:"amount"`
	Status        string     `gorm:"type:varchar(20);default:pending" json:"status"` // pending, paid, failed, refunded
	ThirdPartyNo  string     `gorm:"type:varchar(100)" json:"third_party_no"`
	PaidAt        *time.Time `json:"paid_at"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

func (Payment) TableName() string {
	return "payments"
}

type Refund struct {
	ID        int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	RefundNo  string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"refund_no"`
	OrderID   int64     `gorm:"index;not null" json:"order_id"`
	PaymentID int64     `gorm:"uniqueIndex;not null" json:"payment_id"`
	Amount    int64     `json:"amount"`
	Reason    string    `gorm:"type:text" json:"reason"`
	Status    string    `gorm:"type:varchar(20);default:pending;index" json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Order   *Order   `gorm:"foreignKey:OrderID" json:"order,omitempty"`
	Payment *Payment `gorm:"foreignKey:PaymentID" json:"payment,omitempty"`
}

func (Refund) TableName() string {
	return "refunds"
}

type DisputeRecord struct {
	ID              int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderID         int64          `gorm:"index;not null" json:"order_id"`
	InitiatorUserID int64          `gorm:"index;not null" json:"initiator_user_id"`
	DisputeType     string         `gorm:"type:varchar(30);not null" json:"dispute_type"`
	Status          string         `gorm:"type:varchar(20);default:open;index" json:"status"`
	Summary         string         `gorm:"type:text" json:"summary"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`

	Order     *Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
	Initiator *User  `gorm:"foreignKey:InitiatorUserID" json:"initiator,omitempty"`
}

func (DisputeRecord) TableName() string {
	return "dispute_records"
}

type Message struct {
	ID             int64      `gorm:"primaryKey;autoIncrement" json:"id"`
	ConversationID string     `gorm:"type:varchar(50);index;not null" json:"conversation_id"`
	SenderID       int64      `gorm:"index;not null" json:"sender_id"`
	ReceiverID     int64      `gorm:"index;not null" json:"receiver_id"`
	MessageType    string     `gorm:"type:varchar(20);default:text" json:"message_type"` // text, image, location, order
	Content        string     `gorm:"type:text" json:"content"`
	ExtraData      JSON       `gorm:"type:json" json:"extra_data"`
	IsRead         bool       `gorm:"default:false" json:"is_read"`
	ReadAt         *time.Time `json:"read_at"`
	CreatedAt      time.Time  `json:"created_at"`
}

func (Message) TableName() string {
	return "messages"
}

type Review struct {
	ID         int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderID    int64     `gorm:"index;not null" json:"order_id"`
	ReviewerID int64     `gorm:"index;not null" json:"reviewer_id"`
	RevieweeID int64     `gorm:"index;not null" json:"reviewee_id"`
	ReviewType string    `gorm:"type:varchar(30)" json:"review_type"` // owner_to_renter, renter_to_owner, renter_to_drone
	TargetType string    `gorm:"type:varchar(20)" json:"target_type"` // user, drone
	TargetID   int64     `gorm:"index" json:"target_id"`
	Rating     int       `gorm:"type:tinyint" json:"rating"`
	Content    string    `gorm:"type:text" json:"content"`
	Images     JSON      `gorm:"type:json" json:"images"`
	Tags       JSON      `gorm:"type:json" json:"tags"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func (Review) TableName() string {
	return "reviews"
}

type MatchingRecord struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	DemandID    int64     `gorm:"index;not null" json:"demand_id"`
	DemandType  string    `gorm:"type:varchar(30);not null" json:"demand_type"` // rental_demand, cargo_demand
	SupplyID    int64     `gorm:"index" json:"supply_id"`
	SupplyType  string    `gorm:"type:varchar(30)" json:"supply_type"` // drone, rental_offer
	MatchScore  int       `json:"match_score"`
	MatchReason JSON      `gorm:"type:json" json:"match_reason"`
	Status      string    `gorm:"type:varchar(20);default:recommended" json:"status"` // recommended, viewed, contacted, ordered, expired
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (MatchingRecord) TableName() string {
	return "matching_records"
}

type SystemConfig struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ConfigKey   string    `gorm:"type:varchar(100);uniqueIndex;not null" json:"config_key"`
	ConfigValue string    `gorm:"type:text" json:"config_value"`
	Description string    `gorm:"type:varchar(255)" json:"description"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (SystemConfig) TableName() string {
	return "system_configs"
}

type AdminLog struct {
	ID         int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	AdminID    int64     `gorm:"index;not null" json:"admin_id"`
	Action     string    `gorm:"type:varchar(50)" json:"action"`
	Module     string    `gorm:"type:varchar(50)" json:"module"`
	TargetType string    `gorm:"type:varchar(50)" json:"target_type"`
	TargetID   int64     `json:"target_id"`
	Details    JSON      `gorm:"type:json" json:"details"`
	IPAddress  string    `gorm:"type:varchar(50)" json:"ip_address"`
	CreatedAt  time.Time `json:"created_at"`
}

func (AdminLog) TableName() string {
	return "admin_logs"
}

type MigrationEntityMapping struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	LegacyTable string    `gorm:"type:varchar(100);not null;index:idx_migration_entity_legacy,priority:1" json:"legacy_table"`
	LegacyID    string    `gorm:"type:varchar(100);not null;index:idx_migration_entity_legacy,priority:2" json:"legacy_id"`
	NewTable    string    `gorm:"type:varchar(100);not null;index:idx_migration_entity_new,priority:1" json:"new_table"`
	NewID       string    `gorm:"type:varchar(100);not null;index:idx_migration_entity_new,priority:2" json:"new_id"`
	MappingType string    `gorm:"type:varchar(20);default:migrated;index" json:"mapping_type"`
	MappingNote string    `gorm:"type:varchar(255)" json:"mapping_note"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (MigrationEntityMapping) TableName() string {
	return "migration_entity_mappings"
}

type MigrationAuditRecord struct {
	ID               int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	AuditStage       string    `gorm:"type:varchar(50);not null;index" json:"audit_stage"`
	LegacyTable      string    `gorm:"type:varchar(100);not null;index:idx_migration_audit_legacy,priority:1" json:"legacy_table"`
	LegacyID         string    `gorm:"type:varchar(100);not null;default:'';index:idx_migration_audit_legacy,priority:2" json:"legacy_id"`
	RelatedTable     string    `gorm:"type:varchar(100);not null;default:'';index:idx_migration_audit_related,priority:1" json:"related_table"`
	RelatedID        string    `gorm:"type:varchar(100);not null;default:'';index:idx_migration_audit_related,priority:2" json:"related_id"`
	IssueType        string    `gorm:"type:varchar(50);not null;index" json:"issue_type"`
	Severity         string    `gorm:"type:varchar(20);not null;default:warning;index" json:"severity"`
	IssueMessage     string    `gorm:"type:text;not null" json:"issue_message"`
	PayloadJSON      JSON      `gorm:"type:json" json:"payload_json"`
	ResolutionStatus string    `gorm:"type:varchar(20);not null;default:open;index" json:"resolution_status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (MigrationAuditRecord) TableName() string {
	return "migration_audit_records"
}

type CountBucket struct {
	Key   string `json:"key"`
	Count int64  `json:"count"`
}

type MigrationAuditSummary struct {
	Total         int64         `json:"total"`
	OpenCount     int64         `json:"open_count"`
	ResolvedCount int64         `json:"resolved_count"`
	CriticalCount int64         `json:"critical_count"`
	WarningCount  int64         `json:"warning_count"`
	InfoCount     int64         `json:"info_count"`
	ByIssueType   []CountBucket `json:"by_issue_type"`
	ByStage       []CountBucket `json:"by_stage"`
}

type OrderAnomaly struct {
	OrderID          int64      `json:"order_id"`
	OrderNo          string     `json:"order_no"`
	Title            string     `json:"title"`
	Status           string     `json:"status"`
	OrderSource      string     `json:"order_source"`
	ExecutionMode    string     `json:"execution_mode"`
	NeedsDispatch    bool       `json:"needs_dispatch"`
	DispatchTaskID   *int64     `json:"dispatch_task_id"`
	ProviderUserID   int64      `json:"provider_user_id"`
	ClientUserID     int64      `json:"client_user_id"`
	ProviderNickname string     `json:"provider_nickname"`
	ClientNickname   string     `json:"client_nickname"`
	AnomalyType      string     `json:"anomaly_type"`
	Severity         string     `json:"severity"`
	Message          string     `json:"message"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	CompletedAt      *time.Time `json:"completed_at"`
}

type OrderAnomalySummary struct {
	Total         int64         `json:"total"`
	CriticalCount int64         `json:"critical_count"`
	WarningCount  int64         `json:"warning_count"`
	ByAnomalyType []CountBucket `json:"by_anomaly_type"`
	ByOrderStatus []CountBucket `json:"by_order_status"`
}

// UserAddress 用户常用地址
type UserAddress struct {
	ID        int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    int64          `gorm:"index;not null" json:"user_id"`
	Label     string         `gorm:"type:varchar(20)" json:"label"` // 家/公司/自定义标签
	Name      string         `gorm:"type:varchar(100)" json:"name"` // POI名称
	Address   string         `gorm:"type:varchar(255);not null" json:"address"`
	Province  string         `gorm:"type:varchar(50)" json:"province"`
	City      string         `gorm:"type:varchar(50)" json:"city"`
	District  string         `gorm:"type:varchar(50)" json:"district"`
	Latitude  float64        `gorm:"type:decimal(10,7)" json:"latitude"`
	Longitude float64        `gorm:"type:decimal(10,7)" json:"longitude"`
	IsDefault bool           `gorm:"default:false" json:"is_default"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (UserAddress) TableName() string {
	return "user_addresses"
}

// ==================== 飞手相关模型 ====================

// Pilot 飞手档案 - 关联到users表的飞手专业信息
