package model

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID            int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	Phone         string         `gorm:"type:varchar(20);uniqueIndex" json:"phone"`
	PasswordHash  string         `gorm:"type:varchar(255)" json:"-"`
	Nickname      string         `gorm:"type:varchar(50)" json:"nickname"`
	AvatarURL     string         `gorm:"type:varchar(500)" json:"avatar_url"`
	UserType      string         `gorm:"type:varchar(20);default:renter" json:"user_type"` // pilot, drone_owner, renter, cargo_owner, admin
	IDCardNo      string         `gorm:"type:varchar(255)" json:"-"`
	IDVerified    string         `gorm:"type:varchar(20);default:pending" json:"id_verified"` // pending, approved, rejected
	CreditScore   int            `gorm:"default:100" json:"credit_score"`
	Status        string         `gorm:"type:varchar(20);default:active" json:"status"` // active, suspended, banned
	WechatOpenID  string         `gorm:"type:varchar(100);index" json:"-"`
	WechatUnionID string         `gorm:"type:varchar(100);index" json:"-"`
	QQOpenID      string         `gorm:"type:varchar(100);index" json:"-"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

func (User) TableName() string {
	return "users"
}

type ClientProfile struct {
	ID                  int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID              int64          `gorm:"uniqueIndex;not null" json:"user_id"`
	Status              string         `gorm:"type:varchar(20);default:active;index" json:"status"`
	DefaultContactName  string         `gorm:"type:varchar(50)" json:"default_contact_name"`
	DefaultContactPhone string         `gorm:"type:varchar(20)" json:"default_contact_phone"`
	PreferredCity       string         `gorm:"type:varchar(50);index" json:"preferred_city"`
	Remark              string         `gorm:"type:text" json:"remark"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (ClientProfile) TableName() string {
	return "client_profiles"
}

type OwnerProfile struct {
	ID                 int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID             int64          `gorm:"uniqueIndex;not null" json:"user_id"`
	VerificationStatus string         `gorm:"type:varchar(20);default:pending;index" json:"verification_status"`
	Status             string         `gorm:"type:varchar(20);default:active;index" json:"status"`
	ServiceCity        string         `gorm:"type:varchar(50);index" json:"service_city"`
	ContactPhone       string         `gorm:"type:varchar(20)" json:"contact_phone"`
	Intro              string         `gorm:"type:text" json:"intro"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (OwnerProfile) TableName() string {
	return "owner_profiles"
}

type PilotProfile struct {
	ID                  int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID              int64          `gorm:"uniqueIndex;not null" json:"user_id"`
	VerificationStatus  string         `gorm:"type:varchar(20);default:pending;index" json:"verification_status"`
	AvailabilityStatus  string         `gorm:"type:varchar(20);default:offline;index" json:"availability_status"`
	ServiceRadiusKM     int            `gorm:"default:50" json:"service_radius_km"`
	ServiceCities       JSON           `gorm:"type:json" json:"service_cities"`
	SkillTags           JSON           `gorm:"type:json" json:"skill_tags"`
	CAACLicenseNo       string         `gorm:"type:varchar(50);index" json:"caac_license_no"`
	CAACLicenseExpireAt *time.Time     `json:"caac_license_expire_at"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (PilotProfile) TableName() string {
	return "pilot_profiles"
}

type Drone struct {
	ID                  int64   `gorm:"primaryKey;autoIncrement" json:"id"`
	OwnerID             int64   `gorm:"index;not null" json:"owner_id"`
	Brand               string  `gorm:"type:varchar(100)" json:"brand"`
	Model               string  `gorm:"type:varchar(100)" json:"model"`
	SerialNumber        string  `gorm:"type:varchar(100);uniqueIndex" json:"serial_number"`
	MTOWKG              float64 `gorm:"column:mtow_kg;type:decimal(10,2)" json:"mtow_kg"`
	MaxPayloadKG        float64 `gorm:"column:max_payload_kg;type:decimal(10,2)" json:"max_payload_kg"`
	MaxLoad             float64 `gorm:"type:decimal(10,2)" json:"max_load"`
	MaxFlightTime       int     `json:"max_flight_time"`
	MaxDistance         float64 `gorm:"type:decimal(10,2)" json:"max_distance"`
	Features            JSON    `gorm:"type:json" json:"features"`
	Images              JSON    `gorm:"type:json" json:"images"`
	CertificationStatus string  `gorm:"type:varchar(20);default:pending" json:"certification_status"`
	CertificationDocs   JSON    `gorm:"type:json" json:"certification_docs"`
	DailyPrice          int64   `json:"daily_price"`
	HourlyPrice         int64   `json:"hourly_price"`
	Deposit             int64   `json:"deposit"`
	Latitude            float64 `gorm:"type:decimal(10,7)" json:"latitude"`
	Longitude           float64 `gorm:"type:decimal(10,7)" json:"longitude"`
	Address             string  `gorm:"type:varchar(255)" json:"address"`
	City                string  `gorm:"type:varchar(50);index" json:"city"`
	AvailabilityStatus  string  `gorm:"type:varchar(20);default:available" json:"availability_status"` // available, rented, maintenance, offline
	Rating              float64 `gorm:"type:decimal(3,2);default:0" json:"rating"`
	OrderCount          int     `gorm:"default:0" json:"order_count"`
	Description         string  `gorm:"type:text" json:"description"`

	// ==================== UOM平台登记信息 ====================
	UOMRegistrationNo  string     `gorm:"type:varchar(100);index" json:"uom_registration_no"`   // UOM平台登记号
	UOMVerified        string     `gorm:"type:varchar(20);default:pending" json:"uom_verified"` // pending, verified, rejected
	UOMVerifiedAt      *time.Time `json:"uom_verified_at"`
	UOMRegistrationDoc string     `gorm:"type:varchar(500)" json:"uom_registration_doc"` // UOM登记证明文件

	// ==================== 保险信息 ====================
	InsurancePolicyNo   string     `gorm:"type:varchar(100)" json:"insurance_policy_no"`               // 保险单号
	InsuranceCompany    string     `gorm:"type:varchar(100)" json:"insurance_company"`                 // 保险公司
	InsuranceCoverage   int64      `json:"insurance_coverage"`                                         // 保额(分)，要求≥500万
	InsuranceExpireDate *time.Time `json:"insurance_expire_date"`                                      // 保险到期日
	InsuranceDoc        string     `gorm:"type:varchar(500)" json:"insurance_doc"`                     // 保险单文件
	InsuranceVerified   string     `gorm:"type:varchar(20);default:pending" json:"insurance_verified"` // pending, verified, rejected

	// ==================== 适航证书 ====================
	AirworthinessCertNo     string     `gorm:"type:varchar(100)" json:"airworthiness_cert_no"`                 // 适航证书编号
	AirworthinessCertExpire *time.Time `json:"airworthiness_cert_expire"`                                      // 适航证书有效期
	AirworthinessCertDoc    string     `gorm:"type:varchar(500)" json:"airworthiness_cert_doc"`                // 适航证书文件
	AirworthinessVerified   string     `gorm:"type:varchar(20);default:pending" json:"airworthiness_verified"` // pending, verified, rejected

	// ==================== 维护记录 ====================
	LastMaintenanceDate *time.Time `json:"last_maintenance_date"`                // 最近维护日期
	NextMaintenanceDate *time.Time `json:"next_maintenance_date"`                // 下次维护日期
	MaintenanceRecords  JSON       `gorm:"type:json" json:"maintenance_records"` // 维护记录历史

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Owner *User `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
}

func (Drone) TableName() string {
	return "drones"
}

const (
	HeavyLiftMinMTOWKG    = 150.0
	HeavyLiftMinPayloadKG = 50.0
)

func (d *Drone) EffectivePayloadKG() float64 {
	if d == nil {
		return 0
	}
	if d.MaxPayloadKG > 0 {
		return d.MaxPayloadKG
	}
	return d.MaxLoad
}

func (d *Drone) MeetsHeavyLiftThreshold() bool {
	if d == nil {
		return false
	}
	return d.MTOWKG >= HeavyLiftMinMTOWKG && d.EffectivePayloadKG() >= HeavyLiftMinPayloadKG
}

func (d *Drone) EligibleForMarketplace() bool {
	if d == nil {
		return false
	}
	if !d.MeetsHeavyLiftThreshold() {
		return false
	}
	if d.AvailabilityStatus != "available" {
		return false
	}
	if d.CertificationStatus != "approved" {
		return false
	}
	if d.UOMVerified != "verified" {
		return false
	}
	if d.InsuranceVerified != "verified" {
		return false
	}
	if d.AirworthinessVerified != "verified" {
		return false
	}
	return true
}

type RentalOffer struct {
	ID            int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	DroneID       int64          `gorm:"index;not null" json:"drone_id"`
	OwnerID       int64          `gorm:"index;not null" json:"owner_id"`
	Title         string         `gorm:"type:varchar(200);not null" json:"title"`
	Description   string         `gorm:"type:text" json:"description"`
	ServiceType   string         `gorm:"type:varchar(30)" json:"service_type"` // rental, aerial_photo, logistics, agriculture
	AvailableFrom time.Time      `json:"available_from"`
	AvailableTo   time.Time      `json:"available_to"`
	Latitude      float64        `gorm:"type:decimal(10,7)" json:"latitude"`
	Longitude     float64        `gorm:"type:decimal(10,7)" json:"longitude"`
	Address       string         `gorm:"type:varchar(255)" json:"address"`
	ServiceRadius float64        `gorm:"type:decimal(10,2)" json:"service_radius"`
	PriceType     string         `gorm:"type:varchar(20)" json:"price_type"` // hourly, daily, fixed
	Price         int64          `json:"price"`
	Status        string         `gorm:"type:varchar(20);default:active" json:"status"`
	Views         int            `gorm:"default:0" json:"views"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	Drone *Drone `gorm:"foreignKey:DroneID" json:"drone,omitempty"`
	Owner *User  `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
}

func (RentalOffer) TableName() string {
	return "rental_offers"
}

type OwnerSupply struct {
	ID                  int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	SupplyNo            string         `gorm:"type:varchar(50);uniqueIndex" json:"supply_no"`
	OwnerUserID         int64          `gorm:"index;not null" json:"owner_user_id"`
	DroneID             int64          `gorm:"index;not null" json:"drone_id"`
	Title               string         `gorm:"type:varchar(200);not null" json:"title"`
	Description         string         `gorm:"type:text" json:"description"`
	ServiceTypes        JSON           `gorm:"type:json" json:"service_types"`
	CargoScenes         JSON           `gorm:"type:json" json:"cargo_scenes"`
	ServiceAreaSnapshot JSON           `gorm:"type:json" json:"service_area_snapshot"`
	MTOWKG              float64        `gorm:"column:mtow_kg;type:decimal(10,2)" json:"mtow_kg"`
	MaxPayloadKG        float64        `gorm:"column:max_payload_kg;type:decimal(10,2)" json:"max_payload_kg"`
	MaxRangeKM          float64        `gorm:"column:max_range_km;type:decimal(10,2)" json:"max_range_km"`
	BasePriceAmount     int64          `json:"base_price_amount"`
	PricingUnit         string         `gorm:"type:varchar(20)" json:"pricing_unit"`
	PricingRule         JSON           `gorm:"type:json" json:"pricing_rule"`
	AvailableTimeSlots  JSON           `gorm:"type:json" json:"available_time_slots"`
	AcceptsDirectOrder  bool           `gorm:"default:true" json:"accepts_direct_order"`
	Status              string         `gorm:"type:varchar(20);default:draft;index" json:"status"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`

	Owner *User  `gorm:"foreignKey:OwnerUserID" json:"owner,omitempty"`
	Drone *Drone `gorm:"foreignKey:DroneID" json:"drone,omitempty"`
}

func (OwnerSupply) TableName() string {
	return "owner_supplies"
}

type RentalDemand struct {
	ID               int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	RenterID         int64          `gorm:"index;not null" json:"renter_id"`
	ClientID         int64          `gorm:"index" json:"client_id"`
	DemandType       string         `gorm:"type:varchar(30)" json:"demand_type"`
	Title            string         `gorm:"type:varchar(200);not null" json:"title"`
	Description      string         `gorm:"type:text" json:"description"`
	RequiredFeatures JSON           `gorm:"type:json" json:"required_features"`
	RequiredLoad     float64        `gorm:"type:decimal(10,2)" json:"required_load"`
	Latitude         float64        `gorm:"type:decimal(10,7)" json:"latitude"`
	Longitude        float64        `gorm:"type:decimal(10,7)" json:"longitude"`
	Address          string         `gorm:"type:varchar(255)" json:"address"`
	City             string         `gorm:"type:varchar(50);index" json:"city"`
	StartTime        time.Time      `json:"start_time"`
	EndTime          time.Time      `json:"end_time"`
	BudgetMin        int64          `json:"budget_min"`
	BudgetMax        int64          `json:"budget_max"`
	Status           string         `gorm:"type:varchar(20);default:active" json:"status"`
	Urgency          string         `gorm:"type:varchar(20);default:medium" json:"urgency"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`

	Renter *User `gorm:"foreignKey:RenterID" json:"renter,omitempty"`
}

func (RentalDemand) TableName() string {
	return "rental_demands"
}

type CargoDemand struct {
	ID                  int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	PublisherID         int64          `gorm:"index;not null" json:"publisher_id"`
	ClientID            int64          `gorm:"index" json:"client_id"`
	CargoType           string         `gorm:"type:varchar(30)" json:"cargo_type"` // package, equipment, material, other
	CargoWeight         float64        `gorm:"type:decimal(10,2)" json:"cargo_weight"`
	CargoSize           JSON           `gorm:"type:json" json:"cargo_size"`
	CargoDescription    string         `gorm:"type:text" json:"cargo_description"`
	PickupLatitude      float64        `gorm:"type:decimal(10,7)" json:"pickup_latitude"`
	PickupLongitude     float64        `gorm:"type:decimal(10,7)" json:"pickup_longitude"`
	PickupAddress       string         `gorm:"type:varchar(255)" json:"pickup_address"`
	DeliveryLatitude    float64        `gorm:"type:decimal(10,7)" json:"delivery_latitude"`
	DeliveryLongitude   float64        `gorm:"type:decimal(10,7)" json:"delivery_longitude"`
	DeliveryAddress     string         `gorm:"type:varchar(255)" json:"delivery_address"`
	Distance            float64        `gorm:"type:decimal(10,2)" json:"distance"`
	PickupTime          time.Time      `json:"pickup_time"`
	DeliveryDeadline    *time.Time     `json:"delivery_deadline"`
	OfferedPrice        int64          `json:"offered_price"`
	SpecialRequirements string         `gorm:"type:text" json:"special_requirements"`
	Images              JSON           `gorm:"type:json" json:"images"`
	Status              string         `gorm:"type:varchar(20);default:active" json:"status"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`

	Publisher *User `gorm:"foreignKey:PublisherID" json:"publisher,omitempty"`
}

func (CargoDemand) TableName() string {
	return "cargo_demands"
}

type Demand struct {
	ID                         int64      `gorm:"primaryKey;autoIncrement" json:"id"`
	DemandNo                   string     `gorm:"type:varchar(50);uniqueIndex" json:"demand_no"`
	ClientUserID               int64      `gorm:"index;not null" json:"client_user_id"`
	Title                      string     `gorm:"type:varchar(200);not null" json:"title"`
	ServiceType                string     `gorm:"type:varchar(50);not null" json:"service_type"`
	CargoScene                 string     `gorm:"type:varchar(50);not null" json:"cargo_scene"`
	Description                string     `gorm:"type:text" json:"description"`
	DepartureAddressSnapshot   JSON       `gorm:"type:json" json:"departure_address_snapshot"`
	DestinationAddressSnapshot JSON       `gorm:"type:json" json:"destination_address_snapshot"`
	ServiceAddressSnapshot     JSON       `gorm:"type:json" json:"service_address_snapshot"`
	ScheduledStartAt           *time.Time `json:"scheduled_start_at"`
	ScheduledEndAt             *time.Time `json:"scheduled_end_at"`
	CargoWeightKG              float64    `gorm:"type:decimal(10,2)" json:"cargo_weight_kg"`
	CargoVolumeM3              float64    `gorm:"type:decimal(10,3)" json:"cargo_volume_m3"`
	CargoType                  string     `gorm:"type:varchar(50)" json:"cargo_type"`
	CargoSpecialRequirements   string     `gorm:"type:text" json:"cargo_special_requirements"`
	EstimatedTripCount         int        `gorm:"default:1" json:"estimated_trip_count"`
	CargoSnapshot              JSON       `gorm:"type:json" json:"cargo_snapshot"`
	BudgetMin                  int64      `json:"budget_min"`
	BudgetMax                  int64      `json:"budget_max"`
	AllowsPilotCandidate       bool       `gorm:"default:false" json:"allows_pilot_candidate"`
	SelectedQuoteID            int64      `json:"selected_quote_id"`
	SelectedProviderUserID     int64      `json:"selected_provider_user_id"`
	ExpiresAt                  *time.Time `json:"expires_at"`
	Status                     string     `gorm:"type:varchar(30);default:draft;index" json:"status"`
	CreatedAt                  time.Time  `json:"created_at"`
	UpdatedAt                  time.Time  `json:"updated_at"`

	Client *User `gorm:"foreignKey:ClientUserID" json:"client,omitempty"`
}

func (Demand) TableName() string {
	return "demands"
}

type DemandQuote struct {
	ID              int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	QuoteNo         string    `gorm:"type:varchar(50);uniqueIndex" json:"quote_no"`
	DemandID        int64     `gorm:"index;not null" json:"demand_id"`
	OwnerUserID     int64     `gorm:"index;not null" json:"owner_user_id"`
	DroneID         int64     `gorm:"index;not null" json:"drone_id"`
	PriceAmount     int64     `json:"price_amount"`
	PricingSnapshot JSON      `gorm:"type:json" json:"pricing_snapshot"`
	ExecutionPlan   string    `gorm:"type:text" json:"execution_plan"`
	Status          string    `gorm:"type:varchar(20);default:submitted;index" json:"status"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`

	Demand *Demand `gorm:"foreignKey:DemandID" json:"demand,omitempty"`
	Owner  *User   `gorm:"foreignKey:OwnerUserID" json:"owner,omitempty"`
	Drone  *Drone  `gorm:"foreignKey:DroneID" json:"drone,omitempty"`
}

func (DemandQuote) TableName() string {
	return "demand_quotes"
}

type DemandCandidatePilot struct {
	ID                   int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	DemandID             int64     `gorm:"index;not null" json:"demand_id"`
	PilotUserID          int64     `gorm:"index;not null" json:"pilot_user_id"`
	Status               string    `gorm:"type:varchar(20);default:active;index" json:"status"`
	AvailabilitySnapshot JSON      `gorm:"type:json" json:"availability_snapshot"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`

	Demand *Demand `gorm:"foreignKey:DemandID" json:"demand,omitempty"`
	Pilot  *User   `gorm:"foreignKey:PilotUserID" json:"pilot,omitempty"`
}

func (DemandCandidatePilot) TableName() string {
	return "demand_candidate_pilots"
}

type MatchingLog struct {
	ID             int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	DemandID       int64     `gorm:"index;not null" json:"demand_id"`
	ActorType      string    `gorm:"type:varchar(20);not null" json:"actor_type"`
	ActionType     string    `gorm:"type:varchar(30);not null" json:"action_type"`
	ResultSnapshot JSON      `gorm:"type:json" json:"result_snapshot"`
	CreatedAt      time.Time `json:"created_at"`

	Demand *Demand `gorm:"foreignKey:DemandID" json:"demand,omitempty"`
}

func (MatchingLog) TableName() string {
	return "matching_logs"
}

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
	PreferredRoutes        JSON   `gorm:"type:json" json:"preferred_routes"`      // 常用路线
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

	// 航线规划
	DepartureLatitude  float64 `gorm:"type:decimal(10,7);not null" json:"departure_latitude"`
	DepartureLongitude float64 `gorm:"type:decimal(10,7);not null" json:"departure_longitude"`
	DepartureAddress   string  `gorm:"type:varchar(255)" json:"departure_address"`
	ArrivalLatitude    float64 `gorm:"type:decimal(10,7);not null" json:"arrival_latitude"`
	ArrivalLongitude   float64 `gorm:"type:decimal(10,7);not null" json:"arrival_longitude"`
	ArrivalAddress     string  `gorm:"type:varchar(255)" json:"arrival_address"`
	Waypoints          JSON    `gorm:"type:json" json:"waypoints"`   // 航线途经点 [{lat,lng,alt}]
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

// OrderSettlement 订单结算记录
type OrderSettlement struct {
	ID           int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	SettlementNo string `gorm:"type:varchar(50);uniqueIndex;not null" json:"settlement_no"`
	OrderID      int64  `gorm:"uniqueIndex;not null" json:"order_id"`
	OrderNo      string `gorm:"type:varchar(30)" json:"order_no"`

	// ==================== 金额明细 ====================
	TotalAmount    int64 `json:"total_amount"`    // 订单总额(分)
	BaseFee        int64 `json:"base_fee"`        // 基础服务费(分)
	MileageFee     int64 `json:"mileage_fee"`     // 里程费(分)
	DurationFee    int64 `json:"duration_fee"`    // 时长费(分)
	WeightFee      int64 `json:"weight_fee"`      // 重量费(分)
	DifficultyFee  int64 `json:"difficulty_fee"`  // 难度附加费(分)
	InsuranceFee   int64 `json:"insurance_fee"`   // 保险费(分)
	SurgePricing   int64 `json:"surge_pricing"`   // 溢价/折扣(分, 正为溢价负为折扣)
	CouponDiscount int64 `json:"coupon_discount"` // 优惠券折扣(分)
	FinalAmount    int64 `json:"final_amount"`    // 最终支付金额(分)

	// ==================== 分账明细 ====================
	PlatformFeeRate    float64 `gorm:"type:decimal(5,4)" json:"platform_fee_rate"` // 平台费率
	PlatformFee        int64   `json:"platform_fee"`                               // 平台服务费(分)
	PilotFeeRate       float64 `gorm:"type:decimal(5,4)" json:"pilot_fee_rate"`    // 飞手分成比例
	PilotFee           int64   `json:"pilot_fee"`                                  // 飞手劳务费(分)
	OwnerFeeRate       float64 `gorm:"type:decimal(5,4)" json:"owner_fee_rate"`    // 机主分成比例
	OwnerFee           int64   `json:"owner_fee"`                                  // 机主设备费(分)
	InsuranceDeduction int64   `json:"insurance_deduction"`                        // 保险费代扣(分)

	// ==================== 参与方 ====================
	PilotUserID int64 `gorm:"index" json:"pilot_user_id"`
	OwnerUserID int64 `gorm:"index" json:"owner_user_id"`
	PayerUserID int64 `gorm:"index" json:"payer_user_id"` // 付款方(业主)

	// ==================== 定价参数 ====================
	FlightDistance   float64 `gorm:"type:decimal(10,2)" json:"flight_distance"`              // 飞行距离(km)
	FlightDuration   float64 `gorm:"type:decimal(10,2)" json:"flight_duration"`              // 飞行时长(分钟)
	CargoWeight      float64 `gorm:"type:decimal(10,2)" json:"cargo_weight"`                 // 货物重量(kg)
	DifficultyFactor float64 `gorm:"type:decimal(3,1);default:1.0" json:"difficulty_factor"` // 难度系数(1.0-2.0)
	CargoValue       int64   `json:"cargo_value"`                                            // 货物申报价值(分)
	InsuranceRate    float64 `gorm:"type:decimal(5,4)" json:"insurance_rate"`                // 保险费率

	// ==================== 状态管理 ====================
	Status       string     `gorm:"type:varchar(20);default:pending" json:"status"` // pending, calculated, confirmed, settled, disputed
	CalculatedAt *time.Time `json:"calculated_at"`
	ConfirmedAt  *time.Time `json:"confirmed_at"`
	SettledAt    *time.Time `json:"settled_at"`
	SettledBy    string     `gorm:"type:varchar(20)" json:"settled_by"` // system, admin
	Notes        string     `gorm:"type:text" json:"notes"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Order *Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
}

func (OrderSettlement) TableName() string {
	return "order_settlements"
}

// UserWallet 用户钱包
type UserWallet struct {
	ID               int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID           int64     `gorm:"uniqueIndex;not null" json:"user_id"`
	WalletType       string    `gorm:"type:varchar(20);default:general" json:"wallet_type"` // general, pilot, owner
	AvailableBalance int64     `gorm:"default:0" json:"available_balance"`                  // 可用余额(分)
	FrozenBalance    int64     `gorm:"default:0" json:"frozen_balance"`                     // 冻结余额(分)
	TotalIncome      int64     `gorm:"default:0" json:"total_income"`                       // 累计收入(分)
	TotalWithdrawn   int64     `gorm:"default:0" json:"total_withdrawn"`                    // 累计提现(分)
	TotalFrozen      int64     `gorm:"default:0" json:"total_frozen"`                       // 累计冻结(分)
	Status           string    `gorm:"type:varchar(20);default:active" json:"status"`       // active, frozen, closed
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (UserWallet) TableName() string {
	return "user_wallets"
}

// WalletTransaction 钱包流水记录
type WalletTransaction struct {
	ID                  int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	TransactionNo       string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"transaction_no"`
	WalletID            int64     `gorm:"index;not null" json:"wallet_id"`
	UserID              int64     `gorm:"index;not null" json:"user_id"`
	Type                string    `gorm:"type:varchar(30);not null" json:"type"` // income, withdraw, freeze, unfreeze, deduct, refund
	Amount              int64     `json:"amount"`                                // 交易金额(分, 正为收入负为支出)
	BalanceBefore       int64     `json:"balance_before"`                        // 交易前余额(分)
	BalanceAfter        int64     `json:"balance_after"`                         // 交易后余额(分)
	RelatedOrderID      int64     `gorm:"index" json:"related_order_id"`
	RelatedSettlementID int64     `gorm:"index" json:"related_settlement_id"`
	Description         string    `gorm:"type:varchar(255)" json:"description"`
	CreatedAt           time.Time `json:"created_at"`
}

func (WalletTransaction) TableName() string {
	return "wallet_transactions"
}

// WithdrawalRecord 提现记录
type WithdrawalRecord struct {
	ID           int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	WithdrawalNo string `gorm:"type:varchar(50);uniqueIndex;not null" json:"withdrawal_no"`
	UserID       int64  `gorm:"index;not null" json:"user_id"`
	WalletID     int64  `gorm:"index;not null" json:"wallet_id"`
	Amount       int64  `json:"amount"`        // 提现金额(分)
	ServiceFee   int64  `json:"service_fee"`   // 手续费(分)
	ActualAmount int64  `json:"actual_amount"` // 实际到账(分)

	// 收款方式
	WithdrawMethod string `gorm:"type:varchar(20);not null" json:"withdraw_method"` // bank_card, alipay, wechat
	BankName       string `gorm:"type:varchar(50)" json:"bank_name"`
	BankBranch     string `gorm:"type:varchar(100)" json:"bank_branch"`
	AccountNo      string `gorm:"type:varchar(255)" json:"account_no"` // 加密存储
	AccountName    string `gorm:"type:varchar(50)" json:"account_name"`
	AlipayAccount  string `gorm:"type:varchar(100)" json:"alipay_account"`
	WechatAccount  string `gorm:"type:varchar(100)" json:"wechat_account"`

	// 状态
	Status       string     `gorm:"type:varchar(20);default:pending" json:"status"` // pending, processing, completed, rejected, failed
	ReviewedBy   int64      `json:"reviewed_by"`
	ReviewedAt   *time.Time `json:"reviewed_at"`
	ReviewNotes  string     `gorm:"type:varchar(255)" json:"review_notes"`
	CompletedAt  *time.Time `json:"completed_at"`
	ThirdPartyNo string     `gorm:"type:varchar(100)" json:"third_party_no"` // 第三方转账流水号
	FailReason   string     `gorm:"type:varchar(255)" json:"fail_reason"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (WithdrawalRecord) TableName() string {
	return "withdrawal_records"
}

// PricingConfig 定价配置
type PricingConfig struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ConfigKey   string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"config_key"`
	ConfigValue float64   `gorm:"type:decimal(10,4)" json:"config_value"`
	Unit        string    `gorm:"type:varchar(20)" json:"unit"`
	Description string    `gorm:"type:varchar(255)" json:"description"`
	Category    string    `gorm:"type:varchar(30)" json:"category"` // base, mileage, duration, weight, difficulty, insurance, split, surge
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (PricingConfig) TableName() string {
	return "pricing_configs"
}

// ============================================================
// ==================== 阶段六：信用评价与风控 ====================
// ============================================================

// CreditScore 用户信用分 (1000分制)
type CreditScore struct {
	ID       int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID   int64  `gorm:"uniqueIndex;not null" json:"user_id"`
	UserType string `gorm:"type:varchar(20);not null" json:"user_type"` // pilot, owner, client

	// ==================== 总分 ====================
	TotalScore int    `gorm:"default:600" json:"total_score"`                     // 总信用分 0-1000
	ScoreLevel string `gorm:"type:varchar(20);default:normal" json:"score_level"` // excellent(>=800), good(>=700), normal(>=600), poor(>=400), bad(<400)

	// ==================== 飞手维度 (pilot) ====================
	PilotQualification int `gorm:"default:0" json:"pilot_qualification"` // 基础资质分 0-200
	PilotService       int `gorm:"default:0" json:"pilot_service"`       // 服务质量分 0-300
	PilotSafety        int `gorm:"default:0" json:"pilot_safety"`        // 安全记录分 0-300
	PilotActivity      int `gorm:"default:0" json:"pilot_activity"`      // 活跃度分 0-200

	// ==================== 机主维度 (owner) ====================
	OwnerCompliance  int `gorm:"default:0" json:"owner_compliance"`  // 设备合规分 0-250
	OwnerService     int `gorm:"default:0" json:"owner_service"`     // 服务质量分 0-300
	OwnerFulfillment int `gorm:"default:0" json:"owner_fulfillment"` // 履约能力分 0-250
	OwnerAttitude    int `gorm:"default:0" json:"owner_attitude"`    // 合作态度分 0-200

	// ==================== 业主/客户维度 (client) ====================
	ClientIdentity     int `gorm:"default:0" json:"client_identity"`      // 身份认证分 0-200
	ClientPayment      int `gorm:"default:0" json:"client_payment"`       // 支付能力分 0-300
	ClientAttitude     int `gorm:"default:0" json:"client_attitude"`      // 合作态度分 0-300
	ClientOrderQuality int `gorm:"default:0" json:"client_order_quality"` // 订单质量分 0-200

	// ==================== 统计数据 ====================
	TotalOrders     int        `gorm:"default:0" json:"total_orders"`                        // 总订单数
	CompletedOrders int        `gorm:"default:0" json:"completed_orders"`                    // 完成订单数
	CancelledOrders int        `gorm:"default:0" json:"cancelled_orders"`                    // 取消订单数
	DisputeOrders   int        `gorm:"default:0" json:"dispute_orders"`                      // 纠纷订单数
	AverageRating   float64    `gorm:"type:decimal(3,2);default:5.00" json:"average_rating"` // 平均评分
	TotalReviews    int        `gorm:"default:0" json:"total_reviews"`                       // 评价总数
	PositiveReviews int        `gorm:"default:0" json:"positive_reviews"`                    // 好评数
	NegativeReviews int        `gorm:"default:0" json:"negative_reviews"`                    // 差评数
	ViolationCount  int        `gorm:"default:0" json:"violation_count"`                     // 违规次数
	LastViolationAt *time.Time `json:"last_violation_at"`

	// ==================== 状态 ====================
	IsFrozen          bool       `gorm:"default:false" json:"is_frozen"` // 是否冻结
	FrozenReason      string     `gorm:"type:varchar(255)" json:"frozen_reason"`
	FrozenAt          *time.Time `json:"frozen_at"`
	IsBlacklisted     bool       `gorm:"default:false" json:"is_blacklisted"` // 是否黑名单
	BlacklistedReason string     `gorm:"type:varchar(255)" json:"blacklisted_reason"`
	BlacklistedAt     *time.Time `json:"blacklisted_at"`

	LastCalculatedAt *time.Time `json:"last_calculated_at"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (CreditScore) TableName() string {
	return "credit_scores"
}

// CreditScoreLog 信用分变动日志
type CreditScoreLog struct {
	ID              int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID          int64     `gorm:"index;not null" json:"user_id"`
	ChangeType      string    `gorm:"type:varchar(30);not null" json:"change_type"` // order_complete, review_received, violation, bonus, penalty, recalculate
	ChangeReason    string    `gorm:"type:varchar(255)" json:"change_reason"`
	Dimension       string    `gorm:"type:varchar(30)" json:"dimension"` // qualification, service, safety, activity, compliance, fulfillment, attitude, identity, payment, order_quality
	ScoreBefore     int       `json:"score_before"`
	ScoreAfter      int       `json:"score_after"`
	ScoreChange     int       `json:"score_change"` // 正为增加，负为减少
	RelatedOrderID  int64     `gorm:"index" json:"related_order_id"`
	RelatedReviewID int64     `gorm:"index" json:"related_review_id"`
	OperatorID      int64     `json:"operator_id"`                           // 0表示系统自动
	OperatorType    string    `gorm:"type:varchar(20)" json:"operator_type"` // system, admin, auto
	Notes           string    `gorm:"type:text" json:"notes"`
	CreatedAt       time.Time `json:"created_at"`
}

func (CreditScoreLog) TableName() string {
	return "credit_score_logs"
}

// RiskControl 风控记录
type RiskControl struct {
	ID       int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	RiskNo   string `gorm:"type:varchar(50);uniqueIndex;not null" json:"risk_no"`
	UserID   int64  `gorm:"index;not null" json:"user_id"`
	UserType string `gorm:"type:varchar(20)" json:"user_type"`
	OrderID  int64  `gorm:"index" json:"order_id"`

	// 风控类型
	RiskPhase string `gorm:"type:varchar(20);not null" json:"risk_phase"`    // pre(事前), during(事中), post(事后)
	RiskType  string `gorm:"type:varchar(30);not null" json:"risk_type"`     // identity_fraud, payment_risk, behavior_abnormal, dispute, violation, blacklist
	RiskLevel string `gorm:"type:varchar(20);default:low" json:"risk_level"` // low, medium, high, critical
	RiskScore int    `gorm:"default:0" json:"risk_score"`                    // 风险评分 0-100

	// 风控详情
	TriggerRule string `gorm:"type:varchar(100)" json:"trigger_rule"` // 触发规则
	TriggerData string `gorm:"type:text" json:"trigger_data"`         // 触发数据(JSON)
	Description string `gorm:"type:text" json:"description"`

	// 处理状态
	Status       string     `gorm:"type:varchar(20);default:pending" json:"status"` // pending, reviewing, resolved, dismissed
	Action       string     `gorm:"type:varchar(30)" json:"action"`                 // none, warn, freeze, blacklist, block_order, require_deposit
	ActionDetail string     `gorm:"type:text" json:"action_detail"`
	ReviewedBy   int64      `json:"reviewed_by"`
	ReviewedAt   *time.Time `json:"reviewed_at"`
	ReviewNotes  string     `gorm:"type:text" json:"review_notes"`
	ResolvedAt   *time.Time `json:"resolved_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	User  *User  `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Order *Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
}

func (RiskControl) TableName() string {
	return "risk_controls"
}

// Violation 违规记录
type Violation struct {
	ID          int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	ViolationNo string `gorm:"type:varchar(50);uniqueIndex;not null" json:"violation_no"`
	UserID      int64  `gorm:"index;not null" json:"user_id"`
	UserType    string `gorm:"type:varchar(20)" json:"user_type"`
	OrderID     int64  `gorm:"index" json:"order_id"`

	// 违规类型
	ViolationType  string `gorm:"type:varchar(30);not null" json:"violation_type"`       // cancel_abuse, no_show, delay, damage, fraud, unsafe_flight, policy_violation
	ViolationLevel string `gorm:"type:varchar(20);default:minor" json:"violation_level"` // minor(轻微), moderate(中等), serious(严重), critical(重大)
	Description    string `gorm:"type:text" json:"description"`
	Evidence       string `gorm:"type:text" json:"evidence"` // 证据(JSON: 图片/视频/日志)

	// 处罚
	Penalty        string `gorm:"type:varchar(30)" json:"penalty"` // warning, score_deduct, freeze_temp, freeze_perm, blacklist
	PenaltyDetail  string `gorm:"type:text" json:"penalty_detail"`
	ScoreDeduction int    `gorm:"default:0" json:"score_deduction"` // 扣除信用分
	FreezeDays     int    `gorm:"default:0" json:"freeze_days"`     // 冻结天数
	FineAmount     int64  `gorm:"default:0" json:"fine_amount"`     // 罚款金额(分)

	// 申诉
	AppealStatus     string     `gorm:"type:varchar(20);default:none" json:"appeal_status"` // none, pending, approved, rejected
	AppealContent    string     `gorm:"type:text" json:"appeal_content"`
	AppealAt         *time.Time `json:"appeal_at"`
	AppealReviewedBy int64      `json:"appeal_reviewed_by"`
	AppealReviewedAt *time.Time `json:"appeal_reviewed_at"`
	AppealResult     string     `gorm:"type:text" json:"appeal_result"`

	// 状态
	Status      string     `gorm:"type:varchar(20);default:pending" json:"status"` // pending, confirmed, appealing, revoked
	ConfirmedBy int64      `json:"confirmed_by"`
	ConfirmedAt *time.Time `json:"confirmed_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	User  *User  `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Order *Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
}

func (Violation) TableName() string {
	return "violations"
}

// Blacklist 黑名单
type Blacklist struct {
	ID                 int64      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID             int64      `gorm:"uniqueIndex;not null" json:"user_id"`
	UserType           string     `gorm:"type:varchar(20)" json:"user_type"`
	BlacklistType      string     `gorm:"type:varchar(20);default:permanent" json:"blacklist_type"` // temporary, permanent
	Reason             string     `gorm:"type:text;not null" json:"reason"`
	RelatedViolationID int64      `gorm:"index" json:"related_violation_id"`
	ExpireAt           *time.Time `json:"expire_at"` // 临时黑名单到期时间
	AddedBy            int64      `json:"added_by"`
	AddedAt            time.Time  `json:"added_at"`
	RemovedBy          int64      `json:"removed_by"`
	RemovedAt          *time.Time `json:"removed_at"`
	RemovedReason      string     `gorm:"type:varchar(255)" json:"removed_reason"`
	IsActive           bool       `gorm:"default:true" json:"is_active"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (Blacklist) TableName() string {
	return "blacklists"
}

// Deposit 保证金
type Deposit struct {
	ID        int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	DepositNo string `gorm:"type:varchar(50);uniqueIndex;not null" json:"deposit_no"`
	UserID    int64  `gorm:"index;not null" json:"user_id"`
	UserType  string `gorm:"type:varchar(20)" json:"user_type"` // pilot, owner, client

	// 金额
	RequiredAmount int64 `json:"required_amount"` // 应缴金额(分)
	PaidAmount     int64 `json:"paid_amount"`     // 已缴金额(分)
	FrozenAmount   int64 `json:"frozen_amount"`   // 冻结金额(分, 用于赔付)
	RefundedAmount int64 `json:"refunded_amount"` // 已退还金额(分)

	// 状态
	Status     string     `gorm:"type:varchar(20);default:pending" json:"status"` // pending, paid, partial, frozen, refunding, refunded
	PaidAt     *time.Time `json:"paid_at"`
	RefundedAt *time.Time `json:"refunded_at"`
	PaymentID  int64      `json:"payment_id"` // 关联支付记录

	// 原因
	RequireReason string `gorm:"type:varchar(255)" json:"require_reason"` // 要求缴纳原因
	RefundReason  string `gorm:"type:varchar(255)" json:"refund_reason"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (Deposit) TableName() string {
	return "deposits"
}

// ============================================================
// ==================== 阶段七：保险与理赔系统 ====================
// ============================================================

// InsurancePolicy 保险保单
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
