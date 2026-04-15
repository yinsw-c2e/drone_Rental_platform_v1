package model

import (
	"time"

	"gorm.io/gorm"
)

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
