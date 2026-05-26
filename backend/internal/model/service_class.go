package model

import "time"

type ServiceClass struct {
	ID                     int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	Code                   string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"code"`
	DisplayName            string    `gorm:"type:varchar(80);not null" json:"display_name"`
	MTOWMinKG              float64   `gorm:"column:mtow_min_kg;type:decimal(10,2)" json:"mtow_min_kg"`
	MTOWMaxKG              float64   `gorm:"column:mtow_max_kg;type:decimal(10,2)" json:"mtow_max_kg"`
	PayloadMinKG           float64   `gorm:"column:payload_min_kg;type:decimal(10,2)" json:"payload_min_kg"`
	PayloadMaxKG           float64   `gorm:"column:payload_max_kg;type:decimal(10,2)" json:"payload_max_kg"`
	BasePriceCents         int64     `json:"base_price_cents"`
	PerKMPriceCents        int64     `gorm:"column:per_km_price_cents" json:"per_km_price_cents"`
	PerMinutePriceCents    int64     `json:"per_minute_price_cents"`
	MinChargeCents         int64     `json:"min_charge_cents"`
	NightSurchargeRate     float64   `gorm:"type:decimal(6,4);default:0" json:"night_surcharge_rate"`
	PlateauSurchargeRate   float64   `gorm:"type:decimal(6,4);default:0" json:"plateau_surcharge_rate"`
	EmergencySurchargeRate float64   `gorm:"type:decimal(6,4);default:0" json:"emergency_surcharge_rate"`
	IslandSurchargeRate    float64   `gorm:"type:decimal(6,4);default:0" json:"island_surcharge_rate"`
	Status                 string    `gorm:"type:varchar(20);default:active;index" json:"status"`
	SortOrder              int       `gorm:"default:0;index" json:"sort_order"`
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`
}

func (ServiceClass) TableName() string {
	return "service_classes"
}
