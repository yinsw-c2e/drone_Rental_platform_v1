package model

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID           int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	Phone        string         `gorm:"type:varchar(20);uniqueIndex;not null" json:"phone"`
	PasswordHash string         `gorm:"type:varchar(255)" json:"-"`
	Nickname     string         `gorm:"type:varchar(50)" json:"nickname"`
	AvatarURL    string         `gorm:"type:varchar(500)" json:"avatar_url"`
	UserType     string         `gorm:"type:varchar(20);default:renter" json:"user_type"` // drone_owner, renter, cargo_owner, admin
	IDCardNo     string         `gorm:"type:varchar(255)" json:"-"`
	IDVerified   string         `gorm:"type:varchar(20);default:pending" json:"id_verified"` // pending, approved, rejected
	CreditScore  int            `gorm:"default:100" json:"credit_score"`
	Status       string         `gorm:"type:varchar(20);default:active" json:"status"` // active, suspended, banned
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

func (User) TableName() string {
	return "users"
}

type Drone struct {
	ID                  int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	OwnerID             int64          `gorm:"index;not null" json:"owner_id"`
	Brand               string         `gorm:"type:varchar(100)" json:"brand"`
	Model               string         `gorm:"type:varchar(100)" json:"model"`
	SerialNumber        string         `gorm:"type:varchar(100);uniqueIndex" json:"serial_number"`
	MaxLoad             float64        `gorm:"type:decimal(10,2)" json:"max_load"`
	MaxFlightTime       int            `json:"max_flight_time"`
	MaxDistance         float64        `gorm:"type:decimal(10,2)" json:"max_distance"`
	Features            JSON           `gorm:"type:json" json:"features"`
	Images              JSON           `gorm:"type:json" json:"images"`
	CertificationStatus string         `gorm:"type:varchar(20);default:pending" json:"certification_status"`
	CertificationDocs   JSON           `gorm:"type:json" json:"certification_docs"`
	DailyPrice          int64          `json:"daily_price"`
	HourlyPrice         int64          `json:"hourly_price"`
	Deposit             int64          `json:"deposit"`
	Latitude            float64        `gorm:"type:decimal(10,7)" json:"latitude"`
	Longitude           float64        `gorm:"type:decimal(10,7)" json:"longitude"`
	Address             string         `gorm:"type:varchar(255)" json:"address"`
	City                string         `gorm:"type:varchar(50);index" json:"city"`
	AvailabilityStatus  string         `gorm:"type:varchar(20);default:available" json:"availability_status"` // available, rented, maintenance, offline
	Rating              float64        `gorm:"type:decimal(3,2);default:0" json:"rating"`
	OrderCount          int            `gorm:"default:0" json:"order_count"`
	Description         string         `gorm:"type:text" json:"description"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`

	Owner *User `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
}

func (Drone) TableName() string {
	return "drones"
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

type RentalDemand struct {
	ID               int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	RenterID         int64          `gorm:"index;not null" json:"renter_id"`
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

type Order struct {
	ID                     int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderNo                string         `gorm:"type:varchar(30);uniqueIndex;not null" json:"order_no"`
	OrderType              string         `gorm:"type:varchar(20);not null" json:"order_type"` // rental, cargo
	RelatedID              int64          `json:"related_id"`
	DroneID                int64          `gorm:"index" json:"drone_id"`
	OwnerID                int64          `gorm:"index" json:"owner_id"`
	RenterID               int64          `gorm:"index" json:"renter_id"`
	Title                  string         `gorm:"type:varchar(200)" json:"title"`
	ServiceType            string         `gorm:"type:varchar(30)" json:"service_type"`
	StartTime              time.Time      `json:"start_time"`
	EndTime                time.Time      `json:"end_time"`
	ServiceLatitude        float64        `gorm:"type:decimal(10,7)" json:"service_latitude"`
	ServiceLongitude       float64        `gorm:"type:decimal(10,7)" json:"service_longitude"`
	ServiceAddress         string         `gorm:"type:varchar(255)" json:"service_address"`
	TotalAmount            int64          `json:"total_amount"`
	PlatformCommissionRate float64        `gorm:"type:decimal(5,2)" json:"platform_commission_rate"`
	PlatformCommission     int64          `json:"platform_commission"`
	OwnerAmount            int64          `json:"owner_amount"`
	DepositAmount          int64          `json:"deposit_amount"`
	Status                 string         `gorm:"type:varchar(20);default:created" json:"status"`
	CancelReason           string         `gorm:"type:text" json:"cancel_reason"`
	CancelBy               string         `gorm:"type:varchar(20)" json:"cancel_by"`
	CreatedAt              time.Time      `json:"created_at"`
	UpdatedAt              time.Time      `json:"updated_at"`
	DeletedAt              gorm.DeletedAt `gorm:"index" json:"-"`

	Drone  *Drone `gorm:"foreignKey:DroneID" json:"drone,omitempty"`
	Owner  *User  `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	Renter *User  `gorm:"foreignKey:RenterID" json:"renter,omitempty"`
}

func (Order) TableName() string {
	return "orders"
}

type OrderTimeline struct {
	ID           int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderID      int64     `gorm:"index;not null" json:"order_id"`
	Status       string    `gorm:"type:varchar(20)" json:"status"`
	Note         string    `gorm:"type:text" json:"note"`
	OperatorID   int64     `json:"operator_id"`
	OperatorType string    `gorm:"type:varchar(20)" json:"operator_type"` // owner, renter, system, admin
	CreatedAt    time.Time `json:"created_at"`
}

func (OrderTimeline) TableName() string {
	return "order_timelines"
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
