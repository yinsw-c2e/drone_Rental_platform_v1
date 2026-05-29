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

type OrderBroadcastExclusion struct {
	ID             int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderID        int64     `gorm:"uniqueIndex:uk_broadcast_exclusion_order_provider;index;not null" json:"order_id"`
	BroadcastID    int64     `gorm:"index;not null" json:"broadcast_id"`
	ProviderUserID int64     `gorm:"uniqueIndex:uk_broadcast_exclusion_order_provider;index;not null" json:"provider_user_id"`
	Reason         string    `gorm:"type:varchar(64);not null;default:''" json:"reason"`
	CreatedAt      time.Time `json:"created_at"`
}

func (OrderBroadcastExclusion) TableName() string {
	return "order_broadcast_exclusions"
}

type BroadcastAssignment struct {
	ID               int64      `gorm:"primaryKey;autoIncrement" json:"id"`
	BroadcastID      int64      `gorm:"index;not null" json:"broadcast_id"`
	OrderID          int64      `gorm:"index;not null" json:"order_id"`
	ProviderUserID   int64      `gorm:"index;not null" json:"provider_user_id"`
	AttemptSeq       int        `gorm:"not null" json:"attempt_seq"`
	Status           string     `gorm:"type:varchar(20);default:pending_accept;index" json:"status"`
	DistanceKM       float64    `gorm:"type:decimal(8,2)" json:"distance_km"`
	Score            float64    `gorm:"type:decimal(8,4)" json:"score"`
	AcceptDeadlineAt time.Time  `gorm:"index;not null" json:"accept_deadline_at"`
	RespondedAt      *time.Time `json:"responded_at"`
	DeclineReason    string     `gorm:"type:varchar(255)" json:"decline_reason"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`

	Broadcast *OrderBroadcast `gorm:"foreignKey:BroadcastID" json:"broadcast,omitempty"`
	Order     *Order          `gorm:"foreignKey:OrderID" json:"order,omitempty"`
}

func (BroadcastAssignment) TableName() string {
	return "broadcast_assignments"
}
