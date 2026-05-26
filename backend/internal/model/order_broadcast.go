package model

import "time"

type OrderBroadcast struct {
	ID                  int64      `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderID             int64      `gorm:"uniqueIndex;not null" json:"order_id"`
	OriginLatitude      float64    `gorm:"type:decimal(10,7);index" json:"origin_latitude"`
	OriginLongitude     float64    `gorm:"type:decimal(10,7);index" json:"origin_longitude"`
	ServiceClassCode    string     `gorm:"type:varchar(50);index" json:"service_class_code"`
	WeightKG            float64    `gorm:"type:decimal(10,2)" json:"weight_kg"`
	EstimatedTotalCents int64      `json:"estimated_total_cents"`
	Status              string     `gorm:"type:varchar(20);default:open;index" json:"status"`
	ExpiresAt           time.Time  `gorm:"index" json:"expires_at"`
	GrabbedByUserID     int64      `gorm:"index" json:"grabbed_by_user_id"`
	GrabbedAt           *time.Time `json:"grabbed_at"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`

	Order *Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
}

func (OrderBroadcast) TableName() string {
	return "order_broadcasts"
}
