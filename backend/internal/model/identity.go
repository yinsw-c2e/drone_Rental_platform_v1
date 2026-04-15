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
