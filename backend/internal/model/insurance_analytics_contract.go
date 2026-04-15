package model

import (
	"time"

	"gorm.io/gorm"
)

type InsurancePolicy struct {
	ID       int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	PolicyNo string `gorm:"type:varchar(50);uniqueIndex;not null" json:"policy_no"` // 保单号

	// ==================== 保单类型 ====================
	PolicyType     string `gorm:"type:varchar(30);not null" json:"policy_type"`              // liability(第三者责任险), cargo(货物险), hull(机身险), accident(飞手意外险)
	PolicyCategory string `gorm:"type:varchar(20);default:mandatory" json:"policy_category"` // mandatory(强制), optional(可选)

	// ==================== 投保人信息 ====================
	HolderID     int64  `gorm:"index;not null" json:"holder_id"`              // 投保人ID (用户ID)
	HolderType   string `gorm:"type:varchar(20);not null" json:"holder_type"` // pilot, owner, client
	HolderName   string `gorm:"type:varchar(50)" json:"holder_name"`          // 投保人姓名
	HolderIDCard string `gorm:"type:varchar(50)" json:"holder_id_card"`       // 投保人身份证号(加密)
	HolderPhone  string `gorm:"type:varchar(20)" json:"holder_phone"`         // 投保人电话

	// ==================== 被保险标的 ====================
	InsuredType  string `gorm:"type:varchar(20)" json:"insured_type"`  // drone, cargo, person
	InsuredID    int64  `gorm:"index" json:"insured_id"`               // 被保险标的ID (无人机ID/订单ID等)
	InsuredName  string `gorm:"type:varchar(100)" json:"insured_name"` // 被保险标的名称
	InsuredValue int64  `json:"insured_value"`                         // 标的价值(分)

	// ==================== 保险金额与费用 ====================
	CoverageAmount   int64   `json:"coverage_amount"`                       // 保险金额/保额(分)
	DeductibleAmount int64   `json:"deductible_amount"`                     // 免赔额(分)
	PremiumRate      float64 `gorm:"type:decimal(8,6)" json:"premium_rate"` // 费率
	Premium          int64   `json:"premium"`                               // 保费(分)

	// ==================== 保险公司信息 ====================
	InsurerCode      string `gorm:"type:varchar(20)" json:"insurer_code"`       // 保险公司代码
	InsurerName      string `gorm:"type:varchar(100)" json:"insurer_name"`      // 保险公司名称
	InsuranceProduct string `gorm:"type:varchar(100)" json:"insurance_product"` // 保险产品名称

	// ==================== 保险期限 ====================
	EffectiveFrom time.Time `json:"effective_from"` // 保险起期
	EffectiveTo   time.Time `json:"effective_to"`   // 保险止期
	InsuranceDays int       `json:"insurance_days"` // 保险天数

	// ==================== 状态管理 ====================
	Status        string     `gorm:"type:varchar(20);default:pending" json:"status"`        // pending, active, expired, cancelled, claimed
	PaymentStatus string     `gorm:"type:varchar(20);default:unpaid" json:"payment_status"` // unpaid, paid, refunded
	PaymentID     int64      `json:"payment_id"`                                            // 支付记录ID
	PaidAt        *time.Time `json:"paid_at"`

	// ==================== 附加信息 ====================
	CoverageScope string `gorm:"type:text" json:"coverage_scope"` // 保障范围(JSON)
	Exclusions    string `gorm:"type:text" json:"exclusions"`     // 免责条款(JSON)
	SpecialTerms  string `gorm:"type:text" json:"special_terms"`  // 特别约定
	Attachments   string `gorm:"type:text" json:"attachments"`    // 附件(JSON: 电子保单等)

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (InsurancePolicy) TableName() string {
	return "insurance_policies"
}

// InsuranceClaim 保险理赔
type InsuranceClaim struct {
	ID      int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	ClaimNo string `gorm:"type:varchar(50);uniqueIndex;not null" json:"claim_no"` // 理赔单号

	// ==================== 关联信息 ====================
	PolicyID int64  `gorm:"index;not null" json:"policy_id"`   // 关联保单ID
	PolicyNo string `gorm:"type:varchar(50)" json:"policy_no"` // 保单号
	OrderID  int64  `gorm:"index" json:"order_id"`             // 关联订单ID

	// ==================== 报案人信息 ====================
	ClaimantID    int64  `gorm:"index;not null" json:"claimant_id"` // 报案人ID
	ClaimantName  string `gorm:"type:varchar(50)" json:"claimant_name"`
	ClaimantPhone string `gorm:"type:varchar(20)" json:"claimant_phone"`

	// ==================== 事故信息 ====================
	IncidentType        string    `gorm:"type:varchar(30);not null" json:"incident_type"` // crash(坠机), collision(碰撞), cargo_damage(货损), cargo_loss(货物丢失), personal_injury(人身伤害), third_party(第三方损失)
	IncidentTime        time.Time `json:"incident_time"`                                  // 事故发生时间
	IncidentLocation    string    `gorm:"type:varchar(255)" json:"incident_location"`     // 事故地点
	IncidentLat         float64   `gorm:"type:decimal(10,6)" json:"incident_lat"`
	IncidentLng         float64   `gorm:"type:decimal(10,6)" json:"incident_lng"`
	IncidentDescription string    `gorm:"type:text" json:"incident_description"` // 事故描述

	// ==================== 损失信息 ====================
	LossType      string `gorm:"type:varchar(30)" json:"loss_type"` // property(财产), personal(人身), both(两者)
	EstimatedLoss int64  `json:"estimated_loss"`                    // 预估损失(分)
	ActualLoss    int64  `json:"actual_loss"`                       // 实际损失(分)

	// ==================== 理赔金额 ====================
	ClaimAmount    int64 `json:"claim_amount"`    // 索赔金额(分)
	ApprovedAmount int64 `json:"approved_amount"` // 核定金额(分)
	DeductedAmount int64 `json:"deducted_amount"` // 免赔额扣除(分)
	PaidAmount     int64 `json:"paid_amount"`     // 实际赔付(分)

	// ==================== 证据材料 ====================
	EvidenceFiles  string `gorm:"type:text" json:"evidence_files"`         // 证据文件(JSON: 图片/视频)
	PoliceReport   string `gorm:"type:varchar(255)" json:"police_report"`  // 交警/公安报案回执
	MedicalReport  string `gorm:"type:varchar(255)" json:"medical_report"` // 医疗证明
	RepairQuote    string `gorm:"type:varchar(255)" json:"repair_quote"`   // 维修报价单
	OtherDocuments string `gorm:"type:text" json:"other_documents"`        // 其他证明材料(JSON)

	// ==================== 责任认定 ====================
	LiabilityRatio  float64 `gorm:"type:decimal(5,2)" json:"liability_ratio"` // 责任比例 0-100%
	LiabilityParty  string  `gorm:"type:varchar(30)" json:"liability_party"`  // pilot, owner, client, third_party, force_majeure
	LiabilityReason string  `gorm:"type:text" json:"liability_reason"`        // 责任认定理由

	// ==================== 流程状态 ====================
	Status      string `gorm:"type:varchar(20);default:reported" json:"status"` // reported(已报案), investigating(调查中), liability_determined(责任认定), approved(核赔通过), rejected(拒赔), paid(已赔付), closed(已结案), disputed(争议中)
	CurrentStep string `gorm:"type:varchar(30)" json:"current_step"`            // report, evidence, liability, approve, pay, close

	// ==================== 时间节点 ====================
	ReportedAt     time.Time  `json:"reported_at"`     // 报案时间
	InvestigatedAt *time.Time `json:"investigated_at"` // 调查完成时间
	DeterminedAt   *time.Time `json:"determined_at"`   // 责任认定时间
	ApprovedAt     *time.Time `json:"approved_at"`     // 核赔时间
	PaidAt         *time.Time `json:"paid_at"`         // 赔付时间
	ClosedAt       *time.Time `json:"closed_at"`       // 结案时间

	// ==================== 处理人员 ====================
	InvestigatorID int64 `json:"investigator_id"` // 调查员ID
	AdjusterID     int64 `json:"adjuster_id"`     // 核赔员ID
	ApproverID     int64 `json:"approver_id"`     // 审批人ID

	// ==================== 备注 ====================
	InvestigationNotes string `gorm:"type:text" json:"investigation_notes"` // 调查备注
	AdjustmentNotes    string `gorm:"type:text" json:"adjustment_notes"`    // 核赔备注
	RejectReason       string `gorm:"type:text" json:"reject_reason"`       // 拒赔原因

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Policy *InsurancePolicy `gorm:"foreignKey:PolicyID" json:"policy,omitempty"`
	Order  *Order           `gorm:"foreignKey:OrderID" json:"order,omitempty"`
}

func (InsuranceClaim) TableName() string {
	return "insurance_claims"
}

// ClaimTimeline 理赔时间线
type ClaimTimeline struct {
	ID           int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ClaimID      int64     `gorm:"index;not null" json:"claim_id"`
	Action       string    `gorm:"type:varchar(50);not null" json:"action"` // report, upload_evidence, investigate, determine_liability, approve, reject, pay, appeal, close
	Description  string    `gorm:"type:varchar(255)" json:"description"`
	OperatorID   int64     `json:"operator_id"`
	OperatorType string    `gorm:"type:varchar(20)" json:"operator_type"` // system, user, adjuster, admin
	OperatorName string    `gorm:"type:varchar(50)" json:"operator_name"`
	Attachments  string    `gorm:"type:text" json:"attachments"` // 附件(JSON)
	Remark       string    `gorm:"type:text" json:"remark"`
	CreatedAt    time.Time `json:"created_at"`
}

func (ClaimTimeline) TableName() string {
	return "claim_timelines"
}

// InsuranceProduct 保险产品配置
type InsuranceProduct struct {
	ID          int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	ProductCode string `gorm:"type:varchar(30);uniqueIndex;not null" json:"product_code"`
	ProductName string `gorm:"type:varchar(100);not null" json:"product_name"`
	PolicyType  string `gorm:"type:varchar(30);not null" json:"policy_type"` // liability, cargo, hull, accident
	InsurerCode string `gorm:"type:varchar(20)" json:"insurer_code"`
	InsurerName string `gorm:"type:varchar(100)" json:"insurer_name"`

	// 费率配置
	BasePremiumRate float64 `gorm:"type:decimal(8,6)" json:"base_premium_rate"` // 基础费率
	MinPremium      int64   `json:"min_premium"`                                // 最低保费(分)
	MaxCoverage     int64   `json:"max_coverage"`                               // 最高保额(分)
	MinCoverage     int64   `json:"min_coverage"`                               // 最低保额(分)
	DeductibleRate  float64 `gorm:"type:decimal(5,4)" json:"deductible_rate"`   // 免赔率
	MinDeductible   int64   `json:"min_deductible"`                             // 最低免赔额(分)

	// 保障配置
	CoverageScope string `gorm:"type:text" json:"coverage_scope"` // 保障范围(JSON)
	Exclusions    string `gorm:"type:text" json:"exclusions"`     // 免责条款(JSON)

	// 状态
	IsMandatory bool `gorm:"default:false" json:"is_mandatory"` // 是否强制
	IsActive    bool `gorm:"default:true" json:"is_active"`
	SortOrder   int  `gorm:"default:0" json:"sort_order"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (InsuranceProduct) TableName() string {
	return "insurance_products"
}

// ============================================================
// ==================== 阶段八：数据分析与决策支持 ====================
// ============================================================

// DailyStatistics 每日统计数据
type DailyStatistics struct {
	ID       int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	StatDate time.Time `gorm:"type:date;uniqueIndex;not null" json:"stat_date"` // 统计日期

	// ==================== 订单统计 ====================
	TotalOrders      int     `gorm:"default:0" json:"total_orders"`                        // 总订单数
	NewOrders        int     `gorm:"default:0" json:"new_orders"`                          // 新建订单数
	CompletedOrders  int     `gorm:"default:0" json:"completed_orders"`                    // 完成订单数
	CancelledOrders  int     `gorm:"default:0" json:"cancelled_orders"`                    // 取消订单数
	InProgressOrders int     `gorm:"default:0" json:"in_progress_orders"`                  // 进行中订单数
	CompletionRate   float64 `gorm:"type:decimal(5,2);default:0" json:"completion_rate"`   // 完成率(%)
	CancellationRate float64 `gorm:"type:decimal(5,2);default:0" json:"cancellation_rate"` // 取消率(%)

	// ==================== 收入统计 ====================
	TotalRevenue   int64 `gorm:"default:0" json:"total_revenue"`    // 总收入(分)
	PlatformFee    int64 `gorm:"default:0" json:"platform_fee"`     // 平台服务费(分)
	PilotIncome    int64 `gorm:"default:0" json:"pilot_income"`     // 飞手收入(分)
	OwnerIncome    int64 `gorm:"default:0" json:"owner_income"`     // 机主收入(分)
	InsuranceFee   int64 `gorm:"default:0" json:"insurance_fee"`    // 保险费(分)
	AvgOrderAmount int64 `gorm:"default:0" json:"avg_order_amount"` // 平均订单金额(分)

	// ==================== 用户统计 ====================
	TotalUsers   int `gorm:"default:0" json:"total_users"`   // 总用户数
	NewUsers     int `gorm:"default:0" json:"new_users"`     // 新增用户数
	ActiveUsers  int `gorm:"default:0" json:"active_users"`  // 活跃用户数
	NewPilots    int `gorm:"default:0" json:"new_pilots"`    // 新增飞手数
	NewOwners    int `gorm:"default:0" json:"new_owners"`    // 新增机主数
	NewClients   int `gorm:"default:0" json:"new_clients"`   // 新增业主数
	OnlinePilots int `gorm:"default:0" json:"online_pilots"` // 在线飞手数

	// ==================== 运力统计 ====================
	TotalDrones     int `gorm:"default:0" json:"total_drones"`     // 总无人机数
	AvailableDrones int `gorm:"default:0" json:"available_drones"` // 可用无人机数
	BusyDrones      int `gorm:"default:0" json:"busy_drones"`      // 忙碌无人机数
	TotalPilots     int `gorm:"default:0" json:"total_pilots"`     // 总飞手数
	AvailablePilots int `gorm:"default:0" json:"available_pilots"` // 可接单飞手数

	// ==================== 飞行统计 ====================
	TotalFlights     int     `gorm:"default:0" json:"total_flights"`                         // 总飞行次数
	TotalFlightHours float64 `gorm:"type:decimal(10,2);default:0" json:"total_flight_hours"` // 总飞行时长(小时)
	TotalDistance    float64 `gorm:"type:decimal(10,2);default:0" json:"total_distance"`     // 总飞行距离(公里)
	TotalCargoWeight float64 `gorm:"type:decimal(10,2);default:0" json:"total_cargo_weight"` // 总货运重量(公斤)
	AvgFlightTime    float64 `gorm:"type:decimal(10,2);default:0" json:"avg_flight_time"`    // 平均飞行时长(分钟)

	// ==================== 风控统计 ====================
	AlertsTriggered int `gorm:"default:0" json:"alerts_triggered"` // 触发告警数
	ViolationsCount int `gorm:"default:0" json:"violations_count"` // 违规数
	ClaimsCount     int `gorm:"default:0" json:"claims_count"`     // 理赔数
	DisputesCount   int `gorm:"default:0" json:"disputes_count"`   // 纠纷数

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (DailyStatistics) TableName() string {
	return "daily_statistics"
}

// HourlyMetrics 小时级别实时指标
type HourlyMetrics struct {
	ID         int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	MetricTime time.Time `gorm:"index;not null" json:"metric_time"` // 指标时间(整点)

	// 订单指标
	NewOrders       int `gorm:"default:0" json:"new_orders"`
	CompletedOrders int `gorm:"default:0" json:"completed_orders"`
	CancelledOrders int `gorm:"default:0" json:"cancelled_orders"`

	// 收入指标
	Revenue int64 `gorm:"default:0" json:"revenue"`

	// 运力指标
	OnlinePilots    int `gorm:"default:0" json:"online_pilots"`
	AvailableDrones int `gorm:"default:0" json:"available_drones"`
	ActiveFlights   int `gorm:"default:0" json:"active_flights"`

	// 用户指标
	ActiveUsers int `gorm:"default:0" json:"active_users"`
	NewUsers    int `gorm:"default:0" json:"new_users"`

	CreatedAt time.Time `json:"created_at"`
}

func (HourlyMetrics) TableName() string {
	return "hourly_metrics"
}

// RegionStatistics 区域统计数据
type RegionStatistics struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	StatDate    time.Time `gorm:"type:date;index;not null" json:"stat_date"`
	RegionCode  string    `gorm:"type:varchar(20);index;not null" json:"region_code"` // 区域编码(省/市)
	RegionName  string    `gorm:"type:varchar(50)" json:"region_name"`
	RegionLevel string    `gorm:"type:varchar(20)" json:"region_level"` // province, city, district

	// 订单统计
	TotalOrders     int   `gorm:"default:0" json:"total_orders"`
	CompletedOrders int   `gorm:"default:0" json:"completed_orders"`
	Revenue         int64 `gorm:"default:0" json:"revenue"`

	// 运力统计
	TotalDrones int `gorm:"default:0" json:"total_drones"`
	TotalPilots int `gorm:"default:0" json:"total_pilots"`

	// 用户统计
	TotalClients int `gorm:"default:0" json:"total_clients"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (RegionStatistics) TableName() string {
	return "region_statistics"
}

// AnalyticsReport 分析报表
type AnalyticsReport struct {
	ID         int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	ReportNo   string `gorm:"type:varchar(50);uniqueIndex;not null" json:"report_no"`
	ReportType string `gorm:"type:varchar(20);not null" json:"report_type"` // daily, weekly, monthly, quarterly, yearly, custom
	ReportName string `gorm:"type:varchar(100);not null" json:"report_name"`

	// 报表周期
	PeriodStart time.Time `json:"period_start"`
	PeriodEnd   time.Time `json:"period_end"`

	// 报表内容
	Summary         string `gorm:"type:text" json:"summary"`          // 概要(JSON)
	OrderAnalysis   string `gorm:"type:text" json:"order_analysis"`   // 订单分析(JSON)
	RevenueAnalysis string `gorm:"type:text" json:"revenue_analysis"` // 收入分析(JSON)
	UserAnalysis    string `gorm:"type:text" json:"user_analysis"`    // 用户分析(JSON)
	FlightAnalysis  string `gorm:"type:text" json:"flight_analysis"`  // 飞行分析(JSON)
	RiskAnalysis    string `gorm:"type:text" json:"risk_analysis"`    // 风控分析(JSON)
	RegionAnalysis  string `gorm:"type:text" json:"region_analysis"`  // 区域分析(JSON)
	TrendAnalysis   string `gorm:"type:text" json:"trend_analysis"`   // 趋势分析(JSON)
	Recommendations string `gorm:"type:text" json:"recommendations"`  // 建议(JSON)

	// 对比数据
	PreviousPeriodComparison string `gorm:"type:text" json:"previous_period_comparison"` // 环比(JSON)
	YearOverYearComparison   string `gorm:"type:text" json:"year_over_year_comparison"`  // 同比(JSON)

	// 附件
	Attachments string `gorm:"type:text" json:"attachments"` // 附件(JSON: PDF/Excel导出)

	// 状态
	Status      string     `gorm:"type:varchar(20);default:generating" json:"status"`   // generating, completed, failed
	GeneratedBy string     `gorm:"type:varchar(20);default:system" json:"generated_by"` // system, admin
	GeneratedAt *time.Time `json:"generated_at"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (AnalyticsReport) TableName() string {
	return "analytics_reports"
}

// HeatmapData 热力图数据
type HeatmapData struct {
	ID       int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	DataType string    `gorm:"type:varchar(30);index;not null" json:"data_type"` // order_density, drone_distribution, pilot_distribution, demand_hotspot
	StatDate time.Time `gorm:"type:date;index;not null" json:"stat_date"`

	// 位置信息
	Latitude  float64 `gorm:"type:decimal(10,7);not null" json:"latitude"`
	Longitude float64 `gorm:"type:decimal(10,7);not null" json:"longitude"`
	GridKey   string  `gorm:"type:varchar(30);index" json:"grid_key"` // 网格编号

	// 数值
	Value int `gorm:"default:0" json:"value"` // 热度值
	Count int `gorm:"default:0" json:"count"` // 数量

	CreatedAt time.Time `json:"created_at"`
}

func (HeatmapData) TableName() string {
	return "heatmap_data"
}

// RealtimeDashboard 实时看板数据缓存
type RealtimeDashboard struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	MetricKey   string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"metric_key"`
	MetricValue string    `gorm:"type:text" json:"metric_value"` // JSON格式的指标值
	UpdatedAt   time.Time `json:"updated_at"`
}

func (RealtimeDashboard) TableName() string {
	return "realtime_dashboard"
}

// ─── 合同签约 ────────────────────────────────────────────

type OrderContract struct {
	ID                 int64      `gorm:"primaryKey;autoIncrement" json:"id"`
	ContractNo         string     `gorm:"type:varchar(50);uniqueIndex" json:"contract_no"`
	OrderID            int64      `gorm:"index;not null" json:"order_id"`
	OrderNo            string     `gorm:"type:varchar(30)" json:"order_no"`
	TemplateKey        string     `gorm:"type:varchar(50);default:heavy_cargo_standard" json:"template_key"`
	ClientUserID       int64      `gorm:"not null" json:"client_user_id"`
	ProviderUserID     int64      `gorm:"not null" json:"provider_user_id"`
	Title              string     `gorm:"type:varchar(200)" json:"title"`
	ServiceDescription string     `gorm:"type:text" json:"service_description"`
	ServiceAddress     string     `gorm:"type:text" json:"service_address"`
	ScheduledStartAt   *time.Time `json:"scheduled_start_at"`
	ScheduledEndAt     *time.Time `json:"scheduled_end_at"`
	CargoWeightKG      float64    `gorm:"type:decimal(10,2)" json:"cargo_weight_kg"`
	EstimatedTripCount int        `gorm:"default:1" json:"estimated_trip_count"`
	ContractAmount     int64      `json:"contract_amount"`
	PlatformCommission int64      `json:"platform_commission"`
	ProviderAmount     int64      `json:"provider_amount"`
	Status             string     `gorm:"type:varchar(20);default:pending" json:"status"`
	ClientSignedAt     *time.Time `json:"client_signed_at"`
	ProviderSignedAt   *time.Time `json:"provider_signed_at"`
	ContractHTML       string     `gorm:"type:mediumtext" json:"contract_html"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

func (OrderContract) TableName() string {
	return "order_contracts"
}
