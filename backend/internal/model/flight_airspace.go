package model

import (
	"time"

	"gorm.io/gorm"
)

type FlightRecord struct {
	ID                   int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	FlightNo             string         `gorm:"type:varchar(50);uniqueIndex;not null" json:"flight_no"`
	OrderID              int64          `gorm:"index;not null" json:"order_id"`
	DispatchTaskID       *int64         `gorm:"index" json:"dispatch_task_id"`
	PilotUserID          int64          `gorm:"index" json:"pilot_user_id"`
	DroneID              int64          `gorm:"index;not null" json:"drone_id"`
	TakeoffAt            *time.Time     `json:"takeoff_at"`
	LandingAt            *time.Time     `json:"landing_at"`
	TotalDurationSeconds int            `gorm:"default:0" json:"total_duration_seconds"`
	TotalDistanceM       float64        `gorm:"type:decimal(12,2);default:0" json:"total_distance_m"`
	MaxAltitudeM         float64        `gorm:"type:decimal(10,2);default:0" json:"max_altitude_m"`
	Status               string         `gorm:"type:varchar(20);default:pending;index" json:"status"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`

	Order        *Order              `gorm:"foreignKey:OrderID" json:"order,omitempty"`
	DispatchTask *FormalDispatchTask `gorm:"foreignKey:DispatchTaskID" json:"dispatch_task,omitempty"`
	Pilot        *User               `gorm:"foreignKey:PilotUserID" json:"pilot,omitempty"`
	Drone        *Drone              `gorm:"foreignKey:DroneID" json:"drone,omitempty"`
}

func (FlightRecord) TableName() string {
	return "flight_records"
}

// FlightPosition 飞行实时位置记录
type FlightPosition struct {
	ID             int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	FlightRecordID *int64 `gorm:"index" json:"flight_record_id"`
	OrderID        int64  `gorm:"index;not null" json:"order_id"`
	DroneID        int64  `gorm:"index;not null" json:"drone_id"`
	PilotID        int64  `json:"pilot_id"`

	// 位置信息
	Latitude  float64 `gorm:"type:decimal(10,7);not null" json:"latitude"`
	Longitude float64 `gorm:"type:decimal(10,7);not null" json:"longitude"`
	Altitude  int     `gorm:"default:0" json:"altitude"` // 高度(米)

	// 飞行状态
	Speed         int `gorm:"default:0" json:"speed"`          // 速度(米/秒x100)
	Heading       int `gorm:"default:0" json:"heading"`        // 航向角(度, 0-360)
	VerticalSpeed int `gorm:"default:0" json:"vertical_speed"` // 垂直速度(米/秒x100)

	// 设备状态
	BatteryLevel   int `gorm:"default:100" json:"battery_level"`   // 电池电量(%)
	SignalStrength int `gorm:"default:100" json:"signal_strength"` // 信号强度(%)
	GPSSatellites  int `gorm:"default:0" json:"gps_satellites"`    // GPS卫星数

	// 传感器数据
	Temperature   *int `json:"temperature"`    // 环境温度(摄氏度x10)
	WindSpeed     *int `json:"wind_speed"`     // 风速(米/秒x10)
	WindDirection *int `json:"wind_direction"` // 风向(度)

	RecordedAt time.Time `gorm:"not null" json:"recorded_at"`
	CreatedAt  time.Time `json:"created_at"`

	FlightRecord *FlightRecord `gorm:"foreignKey:FlightRecordID" json:"flight_record,omitempty"`
	Order        *Order        `gorm:"foreignKey:OrderID" json:"order,omitempty"`
	Drone        *Drone        `gorm:"foreignKey:DroneID" json:"drone,omitempty"`
}

func (FlightPosition) TableName() string {
	return "flight_positions"
}

// FlightAlert 飞行告警记录
type FlightAlert struct {
	ID             int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	FlightRecordID *int64 `gorm:"index" json:"flight_record_id"`
	OrderID        int64  `gorm:"index;not null" json:"order_id"`
	DroneID        int64  `gorm:"index;not null" json:"drone_id"`
	PilotID        int64  `json:"pilot_id"`

	AlertType  string `gorm:"type:varchar(50);not null" json:"alert_type"`  // low_battery, geofence, deviation, signal_lost, altitude, speed, weather
	AlertLevel string `gorm:"type:varchar(20);not null" json:"alert_level"` // info, warning, critical
	AlertCode  string `gorm:"type:varchar(50)" json:"alert_code"`

	// 告警详情
	Title       string `gorm:"type:varchar(200);not null" json:"title"`
	Description string `gorm:"type:text" json:"description"`

	// 触发位置
	Latitude  *float64 `gorm:"type:decimal(10,7)" json:"latitude"`
	Longitude *float64 `gorm:"type:decimal(10,7)" json:"longitude"`
	Altitude  *int     `json:"altitude"`

	// 阈值信息
	ThresholdValue string `gorm:"type:varchar(50)" json:"threshold_value"`
	ActualValue    string `gorm:"type:varchar(50)" json:"actual_value"`

	// 处理状态
	Status         string     `gorm:"type:varchar(20);default:active" json:"status"` // active, acknowledged, resolved, dismissed
	AcknowledgedAt *time.Time `json:"acknowledged_at"`
	AcknowledgedBy int64      `json:"acknowledged_by"`
	ResolvedAt     *time.Time `json:"resolved_at"`
	ResolutionNote string     `gorm:"type:text" json:"resolution_note"`

	TriggeredAt time.Time `gorm:"not null" json:"triggered_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	FlightRecord *FlightRecord `gorm:"foreignKey:FlightRecordID" json:"flight_record,omitempty"`
	Order        *Order        `gorm:"foreignKey:OrderID" json:"order,omitempty"`
	Drone        *Drone        `gorm:"foreignKey:DroneID" json:"drone,omitempty"`
}

func (FlightAlert) TableName() string {
	return "flight_alerts"
}

// Geofence 电子围栏定义
type Geofence struct {
	ID        int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string `gorm:"type:varchar(100);not null" json:"name"`
	FenceType string `gorm:"type:varchar(30);not null" json:"fence_type"` // no_fly, restricted, alert, custom

	// 区域定义
	GeometryType    string   `gorm:"type:varchar(20);not null" json:"geometry_type"` // circle, polygon
	CenterLatitude  *float64 `gorm:"type:decimal(10,7)" json:"center_latitude"`
	CenterLongitude *float64 `gorm:"type:decimal(10,7)" json:"center_longitude"`
	Radius          *int     `json:"radius"` // 半径(米)
	Coordinates     JSON     `gorm:"type:json" json:"coordinates"`

	// 高度限制
	MinAltitude int `gorm:"default:0" json:"min_altitude"`
	MaxAltitude int `gorm:"default:500" json:"max_altitude"`

	// 时间限制
	EffectiveFrom    *time.Time `json:"effective_from"`
	EffectiveTo      *time.Time `json:"effective_to"`
	TimeRestrictions JSON       `gorm:"type:json" json:"time_restrictions"`

	// 来源信息
	Source     string `gorm:"type:varchar(50);default:system" json:"source"`
	ExternalID string `gorm:"type:varchar(100)" json:"external_id"`

	// 规则
	ViolationAction string `gorm:"type:varchar(30);default:alert" json:"violation_action"` // alert, block, force_land
	AlertDistance   int    `gorm:"default:100" json:"alert_distance"`

	Description string    `gorm:"type:text" json:"description"`
	Status      string    `gorm:"type:varchar(20);default:active" json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (Geofence) TableName() string {
	return "geofences"
}

// GeofenceViolation 围栏违规记录
type GeofenceViolation struct {
	ID            int64 `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderID       int64 `gorm:"index;not null" json:"order_id"`
	DroneID       int64 `gorm:"index;not null" json:"drone_id"`
	GeofenceID    int64 `gorm:"index;not null" json:"geofence_id"`
	FlightAlertID int64 `json:"flight_alert_id"`

	ViolationType string `gorm:"type:varchar(30);not null" json:"violation_type"` // entered, exited, altitude

	// 违规位置
	Latitude  float64 `gorm:"type:decimal(10,7);not null" json:"latitude"`
	Longitude float64 `gorm:"type:decimal(10,7);not null" json:"longitude"`
	Altitude  *int    `json:"altitude"`

	ActionTaken string `gorm:"type:varchar(30)" json:"action_taken"`

	ViolatedAt time.Time `gorm:"not null" json:"violated_at"`
	CreatedAt  time.Time `json:"created_at"`

	Order    *Order    `gorm:"foreignKey:OrderID" json:"order,omitempty"`
	Geofence *Geofence `gorm:"foreignKey:GeofenceID" json:"geofence,omitempty"`
}

func (GeofenceViolation) TableName() string {
	return "geofence_violations"
}

// ==================== 轨迹录制相关模型 ====================

// FlightTrajectory 飞行轨迹
type FlightTrajectory struct {
	ID      int64 `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderID int64 `gorm:"index" json:"order_id"`
	DroneID int64 `gorm:"index;not null" json:"drone_id"`
	PilotID int64 `gorm:"index" json:"pilot_id"`

	TrajectoryNo string `gorm:"type:varchar(30);uniqueIndex;not null" json:"trajectory_no"`
	Name         string `gorm:"type:varchar(100)" json:"name"`
	Description  string `gorm:"type:text" json:"description"`

	// 起终点信息
	StartLatitude  float64 `gorm:"type:decimal(10,7);not null" json:"start_latitude"`
	StartLongitude float64 `gorm:"type:decimal(10,7);not null" json:"start_longitude"`
	StartAddress   string  `gorm:"type:varchar(255)" json:"start_address"`
	EndLatitude    float64 `gorm:"type:decimal(10,7);not null" json:"end_latitude"`
	EndLongitude   float64 `gorm:"type:decimal(10,7);not null" json:"end_longitude"`
	EndAddress     string  `gorm:"type:varchar(255)" json:"end_address"`

	// 轨迹统计
	TotalDistance int `gorm:"default:0" json:"total_distance"` // 总距离(米)
	TotalDuration int `gorm:"default:0" json:"total_duration"` // 总时长(秒)
	WaypointCount int `gorm:"default:0" json:"waypoint_count"`
	MaxAltitude   int `gorm:"default:0" json:"max_altitude"`
	AvgAltitude   int `gorm:"default:0" json:"avg_altitude"`
	AvgSpeed      int `gorm:"default:0" json:"avg_speed"` // 米/秒x100

	// 轨迹数据
	WaypointsData JSON `gorm:"type:json" json:"waypoints_data"`

	// 状态
	RecordingStatus string     `gorm:"type:varchar(20);default:recording" json:"recording_status"` // recording, completed, failed
	StartedAt       time.Time  `gorm:"not null" json:"started_at"`
	EndedAt         *time.Time `json:"ended_at"`

	// 复用信息
	IsTemplate bool `gorm:"default:false" json:"is_template"`
	UseCount   int  `gorm:"default:0" json:"use_count"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Order *Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
	Drone *Drone `gorm:"foreignKey:DroneID" json:"drone,omitempty"`
	Pilot *Pilot `gorm:"foreignKey:PilotID" json:"pilot,omitempty"`
}

func (FlightTrajectory) TableName() string {
	return "flight_trajectories"
}

// FlightWaypoint 飞行航点
type FlightWaypoint struct {
	ID           int64 `gorm:"primaryKey;autoIncrement" json:"id"`
	TrajectoryID int64 `gorm:"index;not null" json:"trajectory_id"`
	SequenceNo   int   `gorm:"not null" json:"sequence_no"`

	// 位置
	Latitude  float64 `gorm:"type:decimal(10,7);not null" json:"latitude"`
	Longitude float64 `gorm:"type:decimal(10,7);not null" json:"longitude"`
	Altitude  int     `gorm:"default:0" json:"altitude"`

	// 航点类型
	WaypointType string `gorm:"type:varchar(20);default:normal" json:"waypoint_type"` // start, normal, hover, action, end

	// 飞行参数
	Speed   *int `json:"speed"`
	Heading *int `json:"heading"`

	// 动作
	ActionType     string `gorm:"type:varchar(30)" json:"action_type"` // hover, photo, video_start, video_stop
	ActionParam    JSON   `gorm:"type:json" json:"action_param"`
	ActionDuration int    `gorm:"default:0" json:"action_duration"` // 动作持续时间(秒)

	RecordedAt time.Time `gorm:"not null" json:"recorded_at"`

	Trajectory *FlightTrajectory `gorm:"foreignKey:TrajectoryID" json:"trajectory,omitempty"`
}

func (FlightWaypoint) TableName() string {
	return "flight_waypoints"
}

// SavedRoute 保存的路线模板
type SavedRoute struct {
	ID                 int64 `gorm:"primaryKey;autoIncrement" json:"id"`
	OwnerID            int64 `gorm:"index;not null" json:"owner_id"`
	PilotID            int64 `gorm:"index" json:"pilot_id"`
	SourceTrajectoryID int64 `json:"source_trajectory_id"`

	RouteNo     string `gorm:"type:varchar(30);uniqueIndex;not null" json:"route_no"`
	Name        string `gorm:"type:varchar(100);not null" json:"name"`
	Description string `gorm:"type:text" json:"description"`

	// 起终点
	StartLatitude  float64 `gorm:"type:decimal(10,7);not null" json:"start_latitude"`
	StartLongitude float64 `gorm:"type:decimal(10,7);not null" json:"start_longitude"`
	StartAddress   string  `gorm:"type:varchar(255)" json:"start_address"`
	EndLatitude    float64 `gorm:"type:decimal(10,7);not null" json:"end_latitude"`
	EndLongitude   float64 `gorm:"type:decimal(10,7);not null" json:"end_longitude"`
	EndAddress     string  `gorm:"type:varchar(255)" json:"end_address"`

	// 路线特征
	TotalDistance       int `gorm:"default:0" json:"total_distance"`
	EstimatedDuration   int `gorm:"default:0" json:"estimated_duration"`
	WaypointCount       int `gorm:"default:0" json:"waypoint_count"`
	RecommendedAltitude int `gorm:"default:100" json:"recommended_altitude"`

	// 航点数据
	Waypoints JSON `gorm:"type:json;not null" json:"waypoints"`

	// 适用条件
	MinPayload          int  `gorm:"default:0" json:"min_payload"`
	MaxPayload          *int `json:"max_payload"`
	WeatherRestrictions JSON `gorm:"type:json" json:"weather_restrictions"`
	TimeRestrictions    JSON `gorm:"type:json" json:"time_restrictions"`

	// 统计
	UseCount          int        `gorm:"default:0" json:"use_count"`
	SuccessRate       float64    `gorm:"type:decimal(5,2);default:100.00" json:"success_rate"`
	AvgActualDuration *int       `json:"avg_actual_duration"`
	LastUsedAt        *time.Time `json:"last_used_at"`

	// 评价
	Rating      float64 `gorm:"type:decimal(3,2);default:5.00" json:"rating"`
	RatingCount int     `gorm:"default:0" json:"rating_count"`

	// 状态
	Visibility string `gorm:"type:varchar(20);default:private" json:"visibility"` // private, shared, public
	Status     string `gorm:"type:varchar(20);default:active" json:"status"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Owner *User  `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	Pilot *Pilot `gorm:"foreignKey:PilotID" json:"pilot,omitempty"`
}

func (SavedRoute) TableName() string {
	return "saved_routes"
}

// ==================== 多点任务相关模型 ====================

// MultiPointTask 多点任务
type MultiPointTask struct {
	ID      int64 `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderID int64 `gorm:"index;not null" json:"order_id"`

	TaskNo   string `gorm:"type:varchar(30);uniqueIndex;not null" json:"task_no"`
	TaskType string `gorm:"type:varchar(20);not null" json:"task_type"` // pickup, delivery, mixed

	// 总体信息
	TotalPoints       int `gorm:"default:0" json:"total_points"`
	CompletedPoints   int `gorm:"default:0" json:"completed_points"`
	CurrentPointIndex int `gorm:"default:0" json:"current_point_index"`

	// 规划信息
	PlannedDistance int `gorm:"default:0" json:"planned_distance"`
	PlannedDuration int `gorm:"default:0" json:"planned_duration"`
	ActualDistance  int `gorm:"default:0" json:"actual_distance"`
	ActualDuration  int `gorm:"default:0" json:"actual_duration"`

	// 状态
	Status      string     `gorm:"type:varchar(20);default:pending" json:"status"` // pending, in_progress, completed, failed
	StartedAt   *time.Time `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Order *Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
}

func (MultiPointTask) TableName() string {
	return "multi_point_tasks"
}

// MultiPointTaskStop 多点任务站点
type MultiPointTaskStop struct {
	ID         int64 `gorm:"primaryKey;autoIncrement" json:"id"`
	TaskID     int64 `gorm:"index;not null" json:"task_id"`
	SequenceNo int   `gorm:"not null" json:"sequence_no"`

	// 站点类型
	StopType string `gorm:"type:varchar(20);not null" json:"stop_type"` // pickup, delivery, transfer

	// 位置信息
	Latitude     float64 `gorm:"type:decimal(10,7);not null" json:"latitude"`
	Longitude    float64 `gorm:"type:decimal(10,7);not null" json:"longitude"`
	Address      string  `gorm:"type:varchar(255)" json:"address"`
	ContactName  string  `gorm:"type:varchar(50)" json:"contact_name"`
	ContactPhone string  `gorm:"type:varchar(20)" json:"contact_phone"`

	// 货物信息
	CargoDescription string `gorm:"type:varchar(255)" json:"cargo_description"`
	CargoWeight      int    `gorm:"default:0" json:"cargo_weight"`
	CargoAction      string `gorm:"type:varchar(20)" json:"cargo_action"` // load, unload

	// 时间窗口
	ExpectedArrival *time.Time `json:"expected_arrival"`
	TimeWindowStart *time.Time `json:"time_window_start"`
	TimeWindowEnd   *time.Time `json:"time_window_end"`

	// 实际执行
	ActualArrival   *time.Time `json:"actual_arrival"`
	ActualDeparture *time.Time `json:"actual_departure"`
	DwellDuration   int        `gorm:"default:0" json:"dwell_duration"` // 停留时长(秒)

	// 确认信息
	ConfirmationPhotos    JSON       `gorm:"type:json" json:"confirmation_photos"`
	ConfirmationSignature string     `gorm:"type:varchar(500)" json:"confirmation_signature"`
	ConfirmedAt           *time.Time `json:"confirmed_at"`
	ConfirmedBy           string     `gorm:"type:varchar(50)" json:"confirmed_by"`

	// 状态
	Status     string `gorm:"type:varchar(20);default:pending" json:"status"` // pending, arrived, in_progress, completed, skipped
	SkipReason string `gorm:"type:varchar(255)" json:"skip_reason"`
	Notes      string `gorm:"type:text" json:"notes"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Task *MultiPointTask `gorm:"foreignKey:TaskID" json:"task,omitempty"`
}

func (MultiPointTaskStop) TableName() string {
	return "multi_point_task_stops"
}

// FlightMonitorConfig 飞行监控配置
type FlightMonitorConfig struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ConfigKey   string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"config_key"`
	ConfigValue string    `gorm:"type:varchar(255);not null" json:"config_value"`
	ConfigType  string    `gorm:"type:varchar(20);default:string" json:"config_type"` // string, int, float, bool
	Description string    `gorm:"type:varchar(255)" json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (FlightMonitorConfig) TableName() string {
	return "flight_monitor_configs"
}

// ========== 阶段四：空域管理与合规系统 ==========

// AirspaceApplication 空域申请
type AirspaceApplication struct {
	ID      int64 `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderID int64 `gorm:"index" json:"order_id"`
	PilotID int64 `gorm:"index;not null" json:"pilot_id"`
	DroneID int64 `gorm:"index" json:"drone_id"`

	// 飞行计划
	FlightPlanName string `gorm:"type:varchar(200);not null" json:"flight_plan_name"`
	FlightPurpose  string `gorm:"type:varchar(50);not null" json:"flight_purpose"`  // cargo_delivery, agriculture, mapping, inspection, training, emergency, other
	FlightType     string `gorm:"type:varchar(30);default:VLOS" json:"flight_type"` // VLOS(视距内), BVLOS(超视距), EVLOS(扩展视距)

	// 飞行区域与作业参数
	DepartureLatitude  float64 `gorm:"type:decimal(10,7);not null" json:"departure_latitude"`
	DepartureLongitude float64 `gorm:"type:decimal(10,7);not null" json:"departure_longitude"`
	DepartureAddress   string  `gorm:"type:varchar(255)" json:"departure_address"`
	ArrivalLatitude    float64 `gorm:"type:decimal(10,7);not null" json:"arrival_latitude"`
	ArrivalLongitude   float64 `gorm:"type:decimal(10,7);not null" json:"arrival_longitude"`
	ArrivalAddress     string  `gorm:"type:varchar(255)" json:"arrival_address"`
	Waypoints          JSON    `gorm:"type:json" json:"waypoints"`   // 途经点/绕飞点 [{lat,lng,alt}]
	FlightArea         JSON    `gorm:"type:json" json:"flight_area"` // 飞行区域多边形

	// 飞行参数
	PlannedAltitude   int     `gorm:"not null" json:"planned_altitude"`             // 计划飞行高度(米)
	MaxAltitude       int     `gorm:"not null" json:"max_altitude"`                 // 最大飞行高度(米)
	PlannedSpeed      float64 `gorm:"type:decimal(6,2)" json:"planned_speed"`       // 计划飞行速度(m/s)
	EstimatedDistance float64 `gorm:"type:decimal(10,2)" json:"estimated_distance"` // 预计距离(米)
	EstimatedDuration int     `json:"estimated_duration"`                           // 预计时长(秒)
	CargoWeight       float64 `gorm:"type:decimal(10,2)" json:"cargo_weight"`       // 载货重量(kg)

	// 时间窗口
	PlannedStartTime time.Time `gorm:"not null" json:"planned_start_time"`
	PlannedEndTime   time.Time `gorm:"not null" json:"planned_end_time"`

	// UOM平台对接
	UOMApplicationNo string     `gorm:"type:varchar(100);index" json:"uom_application_no"` // UOM平台申请编号
	UOMSubmittedAt   *time.Time `json:"uom_submitted_at"`
	UOMResponseAt    *time.Time `json:"uom_response_at"`
	UOMApprovalCode  string     `gorm:"type:varchar(100)" json:"uom_approval_code"` // UOM审批许可号

	// 审批状态
	Status        string     `gorm:"type:varchar(30);default:draft" json:"status"` // draft, pending_review, submitted_to_uom, approved, rejected, expired, cancelled
	ReviewedBy    int64      `json:"reviewed_by"`
	ReviewedAt    *time.Time `json:"reviewed_at"`
	ReviewNotes   string     `gorm:"type:text" json:"review_notes"`
	RejectionCode string     `gorm:"type:varchar(50)" json:"rejection_code"`

	// 合规检查结果
	ComplianceCheckID int64  `json:"compliance_check_id"`
	CompliancePassed  bool   `gorm:"default:false" json:"compliance_passed"`
	ComplianceNotes   string `gorm:"type:text" json:"compliance_notes"`

	// 附件
	FlightPlanDoc  string `gorm:"type:varchar(500)" json:"flight_plan_doc"`
	SupportingDocs JSON   `gorm:"type:json" json:"supporting_docs"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Relations
	Pilot *Pilot `gorm:"foreignKey:PilotID" json:"pilot,omitempty"`
	Drone *Drone `gorm:"foreignKey:DroneID" json:"drone,omitempty"`
	Order *Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
}

func (AirspaceApplication) TableName() string {
	return "airspace_applications"
}

// NoFlyZone 禁飞区/限飞区定义
type NoFlyZone struct {
	ID       int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	Name     string `gorm:"type:varchar(200);not null" json:"name"`
	ZoneType string `gorm:"type:varchar(30);not null" json:"zone_type"` // airport, military, restricted, temporary, nature_reserve, government

	// 区域定义
	GeometryType    string   `gorm:"type:varchar(20);not null" json:"geometry_type"` // circle, polygon
	CenterLatitude  *float64 `gorm:"type:decimal(10,7)" json:"center_latitude"`
	CenterLongitude *float64 `gorm:"type:decimal(10,7)" json:"center_longitude"`
	Radius          *int     `json:"radius"`                       // 半径(米), 适用于circle
	Coordinates     JSON     `gorm:"type:json" json:"coordinates"` // 多边形顶点坐标

	// 高度限制
	MinAltitude int `gorm:"default:0" json:"min_altitude"`
	MaxAltitude int `gorm:"default:0" json:"max_altitude"` // 0表示全高度禁飞

	// 生效时间
	EffectiveFrom *time.Time `json:"effective_from"`
	EffectiveTo   *time.Time `json:"effective_to"`
	IsPermanent   bool       `gorm:"default:false" json:"is_permanent"`

	// 来源信息
	Source     string `gorm:"type:varchar(50);default:caac" json:"source"` // caac, military, local_gov, platform
	ExternalID string `gorm:"type:varchar(100)" json:"external_id"`
	Authority  string `gorm:"type:varchar(200)" json:"authority"` // 管理机构

	// 限制规则
	RestrictionLevel  string `gorm:"type:varchar(30);default:no_fly" json:"restriction_level"` // no_fly, restricted, caution
	AllowedWithPermit bool   `gorm:"default:false" json:"allowed_with_permit"`
	PermitAuthority   string `gorm:"type:varchar(200)" json:"permit_authority"`

	Description string    `gorm:"type:text" json:"description"`
	Status      string    `gorm:"type:varchar(20);default:active" json:"status"` // active, inactive, expired
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (NoFlyZone) TableName() string {
	return "no_fly_zones"
}

// ComplianceCheck 合规性检查记录
type ComplianceCheck struct {
	ID                    int64 `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderID               int64 `gorm:"index" json:"order_id"`
	PilotID               int64 `gorm:"index;not null" json:"pilot_id"`
	DroneID               int64 `gorm:"index;not null" json:"drone_id"`
	AirspaceApplicationID int64 `gorm:"index" json:"airspace_application_id"`

	// 检查触发
	TriggerType string `gorm:"type:varchar(30);not null" json:"trigger_type"`     // pre_flight, airspace_apply, periodic, manual
	CheckedBy   string `gorm:"type:varchar(30);default:system" json:"checked_by"` // system, admin

	// 总体结果
	OverallResult string `gorm:"type:varchar(20);not null" json:"overall_result"` // passed, failed, warning, pending
	TotalItems    int    `gorm:"default:0" json:"total_items"`
	PassedItems   int    `gorm:"default:0" json:"passed_items"`
	FailedItems   int    `gorm:"default:0" json:"failed_items"`
	WarningItems  int    `gorm:"default:0" json:"warning_items"`

	// 各项检查结果摘要
	PilotCompliance    string `gorm:"type:varchar(20)" json:"pilot_compliance"` // passed, failed, warning
	DroneCompliance    string `gorm:"type:varchar(20)" json:"drone_compliance"`
	CargoCompliance    string `gorm:"type:varchar(20)" json:"cargo_compliance"`
	AirspaceCompliance string `gorm:"type:varchar(20)" json:"airspace_compliance"`
	WeatherCompliance  string `gorm:"type:varchar(20)" json:"weather_compliance"`

	Notes     string     `gorm:"type:text" json:"notes"`
	ExpiresAt *time.Time `json:"expires_at"` // 检查结果有效期
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`

	// Relations
	Items []ComplianceCheckItem `gorm:"foreignKey:ComplianceCheckID" json:"items,omitempty"`
	Pilot *Pilot                `gorm:"foreignKey:PilotID" json:"pilot,omitempty"`
	Drone *Drone                `gorm:"foreignKey:DroneID" json:"drone,omitempty"`
}

func (ComplianceCheck) TableName() string {
	return "compliance_checks"
}

// ComplianceCheckItem 合规性检查明细项
type ComplianceCheckItem struct {
	ID                int64 `gorm:"primaryKey;autoIncrement" json:"id"`
	ComplianceCheckID int64 `gorm:"index;not null" json:"compliance_check_id"`

	// 检查项定义
	Category    string `gorm:"type:varchar(30);not null" json:"category"`    // pilot, drone, cargo, airspace, weather
	CheckCode   string `gorm:"type:varchar(50);not null" json:"check_code"`  // pilot_license, pilot_id_verified, drone_insurance, cargo_weight, etc.
	CheckName   string `gorm:"type:varchar(100);not null" json:"check_name"` // 检查项中文名称
	Description string `gorm:"type:varchar(255)" json:"description"`

	// 检查结果
	Result        string `gorm:"type:varchar(20);not null" json:"result"`        // passed, failed, warning, skipped
	Severity      string `gorm:"type:varchar(20);default:error" json:"severity"` // error, warning, info
	ExpectedValue string `gorm:"type:varchar(255)" json:"expected_value"`
	ActualValue   string `gorm:"type:varchar(255)" json:"actual_value"`
	Message       string `gorm:"type:text" json:"message"` // 检查结果说明

	// 元数据
	IsRequired bool `gorm:"default:true" json:"is_required"` // 是否为必须通过项
	IsBlocking bool `gorm:"default:true" json:"is_blocking"` // 失败是否阻断

	CreatedAt time.Time `json:"created_at"`
}

func (ComplianceCheckItem) TableName() string {
	return "compliance_check_items"
}

// ============================================================
// ==================== 阶段五：支付结算与分账 ====================
// ============================================================
