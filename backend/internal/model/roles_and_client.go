package model

import (
	"time"

	"gorm.io/gorm"
)

type Pilot struct {
	ID                    int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID                int64          `gorm:"uniqueIndex;not null" json:"user_id"` // 关联users表
	CAACLicenseNo         string         `gorm:"type:varchar(50);index" json:"caac_license_no"`
	CAACLicenseType       string         `gorm:"type:varchar(30)" json:"caac_license_type"` // VLOS(视距内), BVLOS(超视距), instructor(教员)
	CAACLicenseExpireDate *time.Time     `json:"caac_license_expire_date"`
	CAACLicenseImage      string         `gorm:"type:varchar(500)" json:"caac_license_image"`
	CriminalCheckStatus   string         `gorm:"type:varchar(20);default:pending" json:"criminal_check_status"` // pending, approved, rejected
	CriminalCheckDoc      string         `gorm:"type:varchar(500)" json:"criminal_check_doc"`
	CriminalCheckExpire   *time.Time     `json:"criminal_check_expire"`                                       // 无犯罪记录有效期
	HealthCheckStatus     string         `gorm:"type:varchar(20);default:pending" json:"health_check_status"` // pending, approved, rejected
	HealthCheckDoc        string         `gorm:"type:varchar(500)" json:"health_check_doc"`
	HealthCheckExpire     *time.Time     `json:"health_check_expire"` // 健康证明有效期
	TotalFlightHours      float64        `gorm:"type:decimal(10,2);default:0" json:"total_flight_hours"`
	TotalOrders           int            `gorm:"default:0" json:"total_orders"`
	CompletedOrders       int            `gorm:"default:0" json:"completed_orders"`
	ServiceRating         float64        `gorm:"type:decimal(3,2);default:5.0" json:"service_rating"`
	CreditScore           int            `gorm:"default:500" json:"credit_score"`                             // 飞手信用分，满分1000
	AvailabilityStatus    string         `gorm:"type:varchar(20);default:offline" json:"availability_status"` // online, busy, offline
	CurrentLatitude       float64        `gorm:"type:decimal(10,7)" json:"current_latitude"`
	CurrentLongitude      float64        `gorm:"type:decimal(10,7)" json:"current_longitude"`
	CurrentCity           string         `gorm:"type:varchar(50);index" json:"current_city"`
	ServiceRadius         float64        `gorm:"type:decimal(10,2);default:50" json:"service_radius"`         // 服务范围(公里)
	SpecialSkills         JSON           `gorm:"type:json" json:"special_skills"`                             // 特殊技能: 夜航、山区、应急等
	VerificationStatus    string         `gorm:"type:varchar(20);default:pending" json:"verification_status"` // pending, verified, rejected
	VerificationNote      string         `gorm:"type:text" json:"verification_note"`
	VerifiedAt            *time.Time     `json:"verified_at"`
	CreatedAt             time.Time      `json:"created_at"`
	UpdatedAt             time.Time      `json:"updated_at"`
	DeletedAt             gorm.DeletedAt `gorm:"index" json:"-"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (Pilot) TableName() string {
	return "pilots"
}

// PilotCertification 飞手资质证书
type PilotCertification struct {
	ID               int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	PilotID          int64          `gorm:"index;not null" json:"pilot_id"`
	CertType         string         `gorm:"type:varchar(50);not null" json:"cert_type"` // caac_license, training, emergency, special_operation
	CertName         string         `gorm:"type:varchar(100)" json:"cert_name"`
	CertNo           string         `gorm:"type:varchar(100)" json:"cert_no"`
	IssuingAuthority string         `gorm:"type:varchar(100)" json:"issuing_authority"` // 发证机构
	IssueDate        *time.Time     `json:"issue_date"`
	ExpireDate       *time.Time     `json:"expire_date"`
	CertImage        string         `gorm:"type:varchar(500)" json:"cert_image"`
	Status           string         `gorm:"type:varchar(20);default:pending" json:"status"` // pending, approved, rejected, expired
	ReviewNote       string         `gorm:"type:text" json:"review_note"`
	ReviewedAt       *time.Time     `json:"reviewed_at"`
	ReviewedBy       int64          `json:"reviewed_by"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`

	Pilot *Pilot `gorm:"foreignKey:PilotID" json:"pilot,omitempty"`
}

func (PilotCertification) TableName() string {
	return "pilot_certifications"
}

// PilotFlightLog 飞手飞行记录
type PilotFlightLog struct {
	ID               int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	PilotID          int64     `gorm:"index;not null" json:"pilot_id"`
	OrderID          int64     `gorm:"index" json:"order_id"` // 关联订单，可为空(非平台飞行)
	DroneID          int64     `gorm:"index" json:"drone_id"`
	FlightDate       time.Time `json:"flight_date"`
	FlightDuration   float64   `gorm:"type:decimal(10,2)" json:"flight_duration"` // 飞行时长(分钟)
	FlightDistance   float64   `gorm:"type:decimal(10,2)" json:"flight_distance"` // 飞行距离(公里)
	StartLatitude    float64   `gorm:"type:decimal(10,7)" json:"start_latitude"`
	StartLongitude   float64   `gorm:"type:decimal(10,7)" json:"start_longitude"`
	StartAddress     string    `gorm:"type:varchar(255)" json:"start_address"`
	EndLatitude      float64   `gorm:"type:decimal(10,7)" json:"end_latitude"`
	EndLongitude     float64   `gorm:"type:decimal(10,7)" json:"end_longitude"`
	EndAddress       string    `gorm:"type:varchar(255)" json:"end_address"`
	MaxAltitude      float64   `gorm:"type:decimal(10,2)" json:"max_altitude"`    // 最高飞行高度(米)
	MaxSpeed         float64   `gorm:"type:decimal(10,2)" json:"max_speed"`       // 最高速度(m/s)
	CargoWeight      float64   `gorm:"type:decimal(10,2)" json:"cargo_weight"`    // 载货重量(kg)
	WeatherCondition string    `gorm:"type:varchar(50)" json:"weather_condition"` // 天气状况
	FlightType       string    `gorm:"type:varchar(30)" json:"flight_type"`       // cargo(货运), training(训练), test(测试)
	IncidentReport   string    `gorm:"type:text" json:"incident_report"`          // 异常情况记录
	TrackData        JSON      `gorm:"type:json" json:"track_data"`               // 飞行轨迹数据
	CreatedAt        time.Time `json:"created_at"`

	Pilot *Pilot `gorm:"foreignKey:PilotID" json:"pilot,omitempty"`
	Drone *Drone `gorm:"foreignKey:DroneID" json:"drone,omitempty"`
	Order *Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
}

func (PilotFlightLog) TableName() string {
	return "pilot_flight_logs"
}

// PilotDroneBinding 飞手与无人机绑定关系 (飞手可操作哪些机主的无人机)
type PilotDroneBinding struct {
	ID            int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	PilotID       int64          `gorm:"index;not null" json:"pilot_id"`
	DroneID       int64          `gorm:"index;not null" json:"drone_id"`
	OwnerID       int64          `gorm:"index;not null" json:"owner_id"`                // 机主ID
	BindingType   string         `gorm:"type:varchar(20)" json:"binding_type"`          // permanent(长期), temporary(临时)
	Status        string         `gorm:"type:varchar(20);default:active" json:"status"` // active, expired, revoked
	EffectiveFrom time.Time      `json:"effective_from"`
	EffectiveTo   *time.Time     `json:"effective_to"` // 临时绑定的截止时间
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	Pilot *Pilot `gorm:"foreignKey:PilotID" json:"pilot,omitempty"`
	Drone *Drone `gorm:"foreignKey:DroneID" json:"drone,omitempty"`
	Owner *User  `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
}

func (PilotDroneBinding) TableName() string {
	return "pilot_drone_bindings"
}

type OwnerPilotBinding struct {
	ID          int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	OwnerUserID int64          `gorm:"index:idx_owner_pilot_pair;not null" json:"owner_user_id"`
	PilotUserID int64          `gorm:"index:idx_owner_pilot_pair;not null" json:"pilot_user_id"`
	InitiatedBy string         `gorm:"type:varchar(20);default:owner" json:"initiated_by"`
	Status      string         `gorm:"type:varchar(30);default:pending_confirmation;index" json:"status"`
	IsPriority  bool           `gorm:"default:false" json:"is_priority"`
	Note        string         `gorm:"type:text" json:"note"`
	ConfirmedAt *time.Time     `json:"confirmed_at"`
	DissolvedAt *time.Time     `json:"dissolved_at"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	Owner *User `gorm:"foreignKey:OwnerUserID" json:"owner,omitempty"`
	Pilot *User `gorm:"foreignKey:PilotUserID" json:"pilot,omitempty"`
}

func (OwnerPilotBinding) TableName() string {
	return "owner_pilot_bindings"
}

// ==================== 无人机维护与保险相关模型 ====================

// DroneMaintenanceLog 无人机维护记录
type DroneMaintenanceLog struct {
	ID                  int64      `gorm:"primaryKey;autoIncrement" json:"id"`
	DroneID             int64      `gorm:"index;not null" json:"drone_id"`
	MaintenanceType     string     `gorm:"type:varchar(50)" json:"maintenance_type"` // routine(常规), repair(维修), upgrade(升级)
	MaintenanceDate     time.Time  `json:"maintenance_date"`
	MaintenanceContent  string     `gorm:"type:text" json:"maintenance_content"`
	MaintenanceCost     int64      `json:"maintenance_cost"` // 维护费用(分)
	TechnicianName      string     `gorm:"type:varchar(100)" json:"technician_name"`
	TechnicianCert      string     `gorm:"type:varchar(100)" json:"technician_cert"`
	PartsReplaced       JSON       `gorm:"type:json" json:"parts_replaced"`
	BeforeImages        JSON       `gorm:"type:json" json:"before_images"`
	AfterImages         JSON       `gorm:"type:json" json:"after_images"`
	ReportDoc           string     `gorm:"type:varchar(500)" json:"report_doc"`
	NextMaintenanceDate *time.Time `json:"next_maintenance_date"`
	CreatedAt           time.Time  `json:"created_at"`

	Drone *Drone `gorm:"foreignKey:DroneID" json:"drone,omitempty"`
}

func (DroneMaintenanceLog) TableName() string {
	return "drone_maintenance_logs"
}

// DroneInsuranceRecord 无人机保险记录
type DroneInsuranceRecord struct {
	ID               int64      `gorm:"primaryKey;autoIncrement" json:"id"`
	DroneID          int64      `gorm:"index;not null" json:"drone_id"`
	OwnerID          int64      `gorm:"index;not null" json:"owner_id"`
	InsuranceType    string     `gorm:"type:varchar(50)" json:"insurance_type"` // liability(第三者责任险), cargo(货物险), hull(机身险)
	PolicyNo         string     `gorm:"type:varchar(100);index" json:"policy_no"`
	InsuranceCompany string     `gorm:"type:varchar(100)" json:"insurance_company"`
	CoverageAmount   int64      `json:"coverage_amount"` // 保额(分)
	Premium          int64      `json:"premium"`         // 保费(分)
	EffectiveFrom    *time.Time `json:"effective_from"`
	EffectiveTo      *time.Time `json:"effective_to"`
	PolicyDoc        string     `gorm:"type:varchar(500)" json:"policy_doc"`
	Status           string     `gorm:"type:varchar(20);default:active" json:"status"` // active, expired, cancelled
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`

	Drone *Drone `gorm:"foreignKey:DroneID" json:"drone,omitempty"`
	Owner *User  `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
}

func (DroneInsuranceRecord) TableName() string {
	return "drone_insurance_records"
}

// ==================== 业主/客户相关模型 ====================

// Client 业主档案 - 整合renter和cargo_owner角色
type Client struct {
	ID                  int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID              int64  `gorm:"uniqueIndex;not null" json:"user_id"`
	ClientType          string `gorm:"type:varchar(20);default:individual" json:"client_type"` // individual(个人), enterprise(企业)
	CompanyName         string `gorm:"type:varchar(200)" json:"company_name"`                  // 企业名称
	BusinessLicenseNo   string `gorm:"type:varchar(100);index" json:"business_license_no"`     // 统一社会信用代码
	BusinessLicenseDoc  string `gorm:"type:varchar(500)" json:"business_license_doc"`          // 营业执照照片
	LegalRepresentative string `gorm:"type:varchar(50)" json:"legal_representative"`           // 法定代表人
	ContactPerson       string `gorm:"type:varchar(50)" json:"contact_person"`                 // 联系人
	ContactPhone        string `gorm:"type:varchar(20)" json:"contact_phone"`                  // 联系电话
	ContactEmail        string `gorm:"type:varchar(100)" json:"contact_email"`                 // 联系邮箱

	// ==================== 征信信息 ====================
	CreditProvider      string     `gorm:"type:varchar(50)" json:"credit_provider"`                     // 征信来源: baihang(百行征信), sesame(芝麻信用)
	CreditScore         int        `gorm:"default:600" json:"credit_score"`                             // 外部征信分
	CreditCheckStatus   string     `gorm:"type:varchar(20);default:pending" json:"credit_check_status"` // pending, approved, rejected
	CreditCheckTime     *time.Time `json:"credit_check_time"`
	CreditReportDoc     string     `gorm:"type:varchar(500)" json:"credit_report_doc"` // 征信报告
	PlatformCreditScore int        `gorm:"default:600" json:"platform_credit_score"`   // 平台内部信用分(满分1000)

	// ==================== 企业资质 ====================
	EnterpriseVerified    string     `gorm:"type:varchar(20);default:pending" json:"enterprise_verified"` // pending, verified, rejected
	EnterpriseVerifiedAt  *time.Time `json:"enterprise_verified_at"`
	EnterpriseVerifyNote  string     `gorm:"type:text" json:"enterprise_verify_note"`
	IndustryCategory      string     `gorm:"type:varchar(100)" json:"industry_category"` // 行业类别
	RegistrationCapital   int64      `json:"registration_capital"`                       // 注册资本(分)
	OperatingYears        int        `json:"operating_years"`                            // 经营年限
	SpecialQualifications JSON       `gorm:"type:json" json:"special_qualifications"`    // 特殊资质(如:危化品运输许可等)

	// ==================== 服务偏好 ====================
	PreferredCargoTypes    JSON   `gorm:"type:json" json:"preferred_cargo_types"` // 常用货物类型
	PreferredRoutes        JSON   `gorm:"type:json" json:"preferred_routes"`      // 常用飞行区域/路线模板（兼容历史字段）
	DefaultPickupAddress   string `gorm:"type:varchar(255)" json:"default_pickup_address"`
	DefaultDeliveryAddress string `gorm:"type:varchar(255)" json:"default_delivery_address"`

	// ==================== 统计信息 ====================
	TotalOrders     int     `gorm:"default:0" json:"total_orders"`
	CompletedOrders int     `gorm:"default:0" json:"completed_orders"`
	CancelledOrders int     `gorm:"default:0" json:"cancelled_orders"`
	TotalSpending   int64   `gorm:"default:0" json:"total_spending"`                     // 总消费金额(分)
	AverageRating   float64 `gorm:"type:decimal(3,2);default:5.0" json:"average_rating"` // 被评平均分

	// ==================== 状态信息 ====================
	VerificationStatus string         `gorm:"type:varchar(20);default:pending" json:"verification_status"` // pending, verified, rejected
	VerificationNote   string         `gorm:"type:text" json:"verification_note"`
	VerifiedAt         *time.Time     `json:"verified_at"`
	Status             string         `gorm:"type:varchar(20);default:active" json:"status"` // active, suspended, banned
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (Client) TableName() string {
	return "clients"
}

// ClientCreditCheck 客户征信查询记录
type ClientCreditCheck struct {
	ID            int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ClientID      int64     `gorm:"index;not null" json:"client_id"`
	CheckProvider string    `gorm:"type:varchar(50)" json:"check_provider"` // baihang, sesame, internal
	CheckType     string    `gorm:"type:varchar(30)" json:"check_type"`     // pre_order(订单前查询), periodic(定期查询), manual(人工查询)
	RequestID     string    `gorm:"type:varchar(100)" json:"request_id"`    // 查询请求ID
	CreditScore   int       `json:"credit_score"`
	CreditLevel   string    `gorm:"type:varchar(20)" json:"credit_level"` // excellent, good, fair, poor
	RiskLevel     string    `gorm:"type:varchar(20)" json:"risk_level"`   // low, medium, high
	Overdue       bool      `gorm:"default:false" json:"overdue"`         // 是否有逾期记录
	OverdueAmount int64     `json:"overdue_amount"`                       // 逾期金额(分)
	OverdueCount  int       `json:"overdue_count"`                        // 逾期次数
	ReportSummary JSON      `gorm:"type:json" json:"report_summary"`      // 报告摘要
	RawResponse   JSON      `gorm:"type:json" json:"raw_response"`        // 原始响应数据
	Status        string    `gorm:"type:varchar(20)" json:"status"`       // pending, success, failed
	ErrorMessage  string    `gorm:"type:text" json:"error_message"`
	CostAmount    int64     `json:"cost_amount"` // 查询费用(分)
	CreatedAt     time.Time `json:"created_at"`

	Client *Client `gorm:"foreignKey:ClientID" json:"client,omitempty"`
}

func (ClientCreditCheck) TableName() string {
	return "client_credit_checks"
}

// ClientEnterpriseCert 企业客户资质证书
type ClientEnterpriseCert struct {
	ID               int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	ClientID         int64          `gorm:"index;not null" json:"client_id"`
	CertType         string         `gorm:"type:varchar(50);not null" json:"cert_type"` // business_license(营业执照), hazmat_permit(危化品许可), food_license(食品经营许可)
	CertName         string         `gorm:"type:varchar(100)" json:"cert_name"`
	CertNo           string         `gorm:"type:varchar(100)" json:"cert_no"`
	IssuingAuthority string         `gorm:"type:varchar(100)" json:"issuing_authority"`
	IssueDate        *time.Time     `json:"issue_date"`
	ExpireDate       *time.Time     `json:"expire_date"`
	CertImage        string         `gorm:"type:varchar(500)" json:"cert_image"`
	Status           string         `gorm:"type:varchar(20);default:pending" json:"status"` // pending, approved, rejected, expired
	ReviewNote       string         `gorm:"type:text" json:"review_note"`
	ReviewedAt       *time.Time     `json:"reviewed_at"`
	ReviewedBy       int64          `json:"reviewed_by"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`

	Client *Client `gorm:"foreignKey:ClientID" json:"client,omitempty"`
}

func (ClientEnterpriseCert) TableName() string {
	return "client_enterprise_certs"
}

// CargoDeclaration 货物申报单
type CargoDeclaration struct {
	ID               int64   `gorm:"primaryKey;autoIncrement" json:"id"`
	ClientID         int64   `gorm:"index;not null" json:"client_id"`
	OrderID          *int64  `gorm:"index" json:"order_id"` // 关联订单，可为空
	DeclarationNo    string  `gorm:"type:varchar(50);uniqueIndex" json:"declaration_no"`
	CargoCategory    string  `gorm:"type:varchar(50);not null" json:"cargo_category"` // normal(普通货物), valuable(贵重物品), fragile(易碎品), hazardous(危险品), perishable(生鲜), medical(医疗用品)
	CargoName        string  `gorm:"type:varchar(200);not null" json:"cargo_name"`
	CargoDescription string  `gorm:"type:text" json:"cargo_description"`
	Quantity         int     `gorm:"default:1" json:"quantity"`
	TotalWeight      float64 `gorm:"type:decimal(10,2)" json:"total_weight"` // 总重量(kg)
	Length           float64 `gorm:"type:decimal(10,2)" json:"length"`       // 长(cm)
	Width            float64 `gorm:"type:decimal(10,2)" json:"width"`        // 宽(cm)
	Height           float64 `gorm:"type:decimal(10,2)" json:"height"`       // 高(cm)
	DeclaredValue    int64   `json:"declared_value"`                         // 申报价值(分)

	// ==================== 特殊货物信息 ====================
	IsHazardous          bool    `gorm:"default:false" json:"is_hazardous"`           // 是否危险品
	HazardClass          string  `gorm:"type:varchar(20)" json:"hazard_class"`        // 危险品类别
	UNNumber             string  `gorm:"type:varchar(20)" json:"un_number"`           // UN编号
	HazmatPermitNo       string  `gorm:"type:varchar(100)" json:"hazmat_permit_no"`   // 危化品运输许可证号
	IsTemperatureControl bool    `gorm:"default:false" json:"is_temperature_control"` // 是否需要温控
	TemperatureMin       float64 `gorm:"type:decimal(5,2)" json:"temperature_min"`    // 最低温度要求
	TemperatureMax       float64 `gorm:"type:decimal(5,2)" json:"temperature_max"`    // 最高温度要求
	IsMoistureSensitive  bool    `gorm:"default:false" json:"is_moisture_sensitive"`  // 是否怕潮
	RequiresInsurance    bool    `gorm:"default:false" json:"requires_insurance"`     // 是否需要保价
	InsuranceAmount      int64   `json:"insurance_amount"`                            // 保价金额(分)

	// ==================== 合规检查 ====================
	ComplianceStatus    string     `gorm:"type:varchar(20);default:pending" json:"compliance_status"` // pending, approved, rejected
	ComplianceNote      string     `gorm:"type:text" json:"compliance_note"`
	ComplianceCheckedAt *time.Time `json:"compliance_checked_at"`
	ComplianceCheckedBy int64      `json:"compliance_checked_by"`

	// ==================== 附件 ====================
	CargoImages    JSON `gorm:"type:json" json:"cargo_images"`    // 货物照片
	PackingImages  JSON `gorm:"type:json" json:"packing_images"`  // 包装照片
	SupportingDocs JSON `gorm:"type:json" json:"supporting_docs"` // 证明文件(如危化品证明、检疫证明等)

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Client *Client `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	Order  *Order  `gorm:"foreignKey:OrderID" json:"order,omitempty"`
}

func (CargoDeclaration) TableName() string {
	return "cargo_declarations"
}

// ==================== 智能匹配与派单相关模型 ====================
