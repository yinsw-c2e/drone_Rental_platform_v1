package model

import (
	"time"
)

type ProviderPresence struct {
	ID                     int64      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID                 int64      `gorm:"uniqueIndex;not null" json:"user_id"`
	Online                 bool       `gorm:"default:false;index" json:"online"`
	LastLatitude           float64    `gorm:"type:decimal(10,7)" json:"last_latitude"`
	LastLongitude          float64    `gorm:"type:decimal(10,7)" json:"last_longitude"`
	LastHeartbeatAt        *time.Time `gorm:"index" json:"last_heartbeat_at"`
	AcceptedServiceClasses JSON       `gorm:"type:json" json:"accepted_service_classes"`
	MaxRadiusKM            float64    `gorm:"type:decimal(8,2);default:30" json:"max_radius_km"`
	Status                 string     `gorm:"type:varchar(20);default:active;index" json:"status"`
	CreatedAt              time.Time  `json:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at"`
}

func (ProviderPresence) TableName() string {
	return "provider_presences"
}
