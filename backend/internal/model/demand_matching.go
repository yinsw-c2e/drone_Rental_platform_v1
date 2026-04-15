package model

import (
	"time"

	"gorm.io/gorm"
)

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
