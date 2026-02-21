package main

import (
	"fmt"
	"log"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

type Order struct {
	ID                 int64  `gorm:"primaryKey;autoIncrement"`
	OrderNo            string `gorm:"type:varchar(50);uniqueIndex;not null"`
	OrderType          string `gorm:"type:varchar(20)"`
	OfferID            int64  `gorm:"index"`
	DroneID            int64  `gorm:"index;not null"`
	OwnerID            int64  `gorm:"index;not null"`
	RenterID           int64  `gorm:"index;not null"`
	Title              string `gorm:"type:varchar(200)"`
	ServiceType        string `gorm:"type:varchar(20)"`
	StartTime          time.Time
	EndTime            time.Time
	Latitude           float64
	Longitude          float64
	Address            string `gorm:"type:varchar(200)"`
	TotalAmount        int64
	PlatformRate       float64
	PlatformCommission int64
	ActualAmount       int64
	Deposit            int64
	Status             string `gorm:"type:varchar(20);index"`
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type OrderTimeline struct {
	ID           int64  `gorm:"primaryKey;autoIncrement"`
	OrderID      int64  `gorm:"index;not null"`
	Status       string `gorm:"type:varchar(20)"`
	Note         string `gorm:"type:text"`
	OperatorID   int64
	OperatorType string `gorm:"type:varchar(20)"`
	CreatedAt    time.Time
}

type Payment struct {
	ID            int64  `gorm:"primaryKey;autoIncrement"`
	PaymentNo     string `gorm:"type:varchar(50);uniqueIndex;not null"`
	OrderID       int64  `gorm:"index;not null"`
	UserID        int64  `gorm:"index;not null"`
	PaymentType   string `gorm:"type:varchar(20)"`
	PaymentMethod string `gorm:"type:varchar(20)"`
	Amount        int64
	Status        string `gorm:"type:varchar(20)"`
	ThirdPartyNo  string `gorm:"type:varchar(100)"`
	PaidAt        *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type Message struct {
	ID             int64  `gorm:"primaryKey;autoIncrement"`
	ConversationID string `gorm:"type:varchar(50);index;not null"`
	SenderID       int64  `gorm:"index;not null"`
	ReceiverID     int64  `gorm:"index;not null"`
	MessageType    string `gorm:"type:varchar(20)"`
	Content        string `gorm:"type:text"`
	IsRead         int
	ReadAt         *time.Time
	CreatedAt      time.Time
}

func main() {
	// 连接数据库
	dsn := "root:root@tcp(192.168.3.127:3306)/wurenji?charset=utf8mb4&parseTime=True&loc=Local"
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("数据库连接失败:", err)
	}

	fmt.Println("为管理员账号(user_id=1)添加测试订单...\n")

	// 订单1：进行中
	now := time.Now()
	twoDaysAgo := now.AddDate(0, 0, -2)
	oneDayAgo := now.AddDate(0, 0, -1)

	order1 := Order{
		OrderNo:            "ORD202602240006",
		OrderType:          "rental",
		OfferID:            2,
		DroneID:            2,
		OwnerID:            2,
		RenterID:           1,
		Title:              "大疆Air 2S 整机租赁",
		ServiceType:        "rental",
		StartTime:          time.Date(2026, 2, 25, 0, 0, 0, 0, time.Local),
		EndTime:            time.Date(2026, 2, 27, 23, 59, 59, 0, time.Local),
		Latitude:           39.915140,
		Longitude:          116.403960,
		Address:            "北京市东城区王府井",
		TotalAmount:        105000,
		PlatformRate:       10.00,
		PlatformCommission: 10500,
		ActualAmount:       94500,
		Deposit:            70000,
		Status:             "in_progress",
		CreatedAt:          twoDaysAgo,
		UpdatedAt:          now,
	}

	if err := db.Create(&order1).Error; err != nil {
		log.Printf("❌ 插入订单1失败: %v\n", err)
	} else {
		fmt.Printf("✅ 订单1插入成功 (ID: %d)\n", order1.ID)

		// 添加时间线
		timelines := []OrderTimeline{
			{OrderID: order1.ID, Status: "created", Note: "订单创建", OperatorID: 1, OperatorType: "renter", CreatedAt: twoDaysAgo},
			{OrderID: order1.ID, Status: "accepted", Note: "机主接单", OperatorID: 2, OperatorType: "owner", CreatedAt: twoDaysAgo},
			{OrderID: order1.ID, Status: "paid", Note: "支付成功", OperatorID: 1, OperatorType: "renter", CreatedAt: twoDaysAgo},
			{OrderID: order1.ID, Status: "in_progress", Note: "订单进行中", OperatorID: 2, OperatorType: "owner", CreatedAt: twoDaysAgo},
		}
		db.Create(&timelines)

		// 添加支付记录
		paidAt := twoDaysAgo
		payment1 := Payment{
			PaymentNo:     "PAY202602240006",
			OrderID:       order1.ID,
			UserID:        1,
			PaymentType:   "order",
			PaymentMethod: "wechat",
			Amount:        105000,
			Status:        "paid",
			ThirdPartyNo:  "WX2026022412345678",
			PaidAt:        &paidAt,
			CreatedAt:     twoDaysAgo,
			UpdatedAt:     twoDaysAgo,
		}
		db.Create(&payment1)
	}

	// 订单2：已支付
	order2 := Order{
		OrderNo:            "ORD202602250007",
		OrderType:          "rental_offer",
		OfferID:            3,
		DroneID:            3,
		OwnerID:            3,
		RenterID:           1,
		Title:              "Mini 3 Pro 轻便航拍",
		ServiceType:        "rental",
		StartTime:          time.Date(2026, 3, 1, 10, 0, 0, 0, time.Local),
		EndTime:            time.Date(2026, 3, 1, 15, 0, 0, 0, time.Local),
		Latitude:           31.230390,
		Longitude:          121.473700,
		Address:            "上海市黄浦区南京东路",
		TotalAmount:        20000,
		PlatformRate:       10.00,
		PlatformCommission: 2000,
		ActualAmount:       18000,
		Deposit:            50000,
		Status:             "paid",
		CreatedAt:          oneDayAgo,
		UpdatedAt:          now,
	}

	if err := db.Create(&order2).Error; err != nil {
		log.Printf("❌ 插入订单2失败: %v\n", err)
	} else {
		fmt.Printf("✅ 订单2插入成功 (ID: %d)\n", order2.ID)

		// 添加时间线
		timelines2 := []OrderTimeline{
			{OrderID: order2.ID, Status: "created", Note: "订单创建", OperatorID: 1, OperatorType: "renter", CreatedAt: oneDayAgo},
			{OrderID: order2.ID, Status: "accepted", Note: "机主接单", OperatorID: 3, OperatorType: "owner", CreatedAt: oneDayAgo},
			{OrderID: order2.ID, Status: "paid", Note: "支付成功", OperatorID: 1, OperatorType: "renter", CreatedAt: oneDayAgo},
		}
		db.Create(&timelines2)

		// 添加支付记录
		paidAt2 := oneDayAgo
		payment2 := Payment{
			PaymentNo:     "PAY202602250007",
			OrderID:       order2.ID,
			UserID:        1,
			PaymentType:   "order",
			PaymentMethod: "alipay",
			Amount:        20000,
			Status:        "paid",
			ThirdPartyNo:  "ALI2026022512345678",
			PaidAt:        &paidAt2,
			CreatedAt:     oneDayAgo,
			UpdatedAt:     oneDayAgo,
		}
		db.Create(&payment2)
	}

	// 添加消息
	// conversation_id 格式: "小ID-大ID"（与 message_service.go 的 makeConversationID 一致）
	readAt := twoDaysAgo
	messages := []Message{
		{ConversationID: "1-2", SenderID: 2, ReceiverID: 1, MessageType: "text", Content: "您好，管理员，您的订单已接受，欢迎体验！", IsRead: 1, ReadAt: &readAt, CreatedAt: twoDaysAgo},
		{ConversationID: "1-2", SenderID: 1, ReceiverID: 2, MessageType: "text", Content: "谢谢！我会按时取机的", IsRead: 1, ReadAt: &readAt, CreatedAt: twoDaysAgo},
		{ConversationID: "1-3", SenderID: 3, ReceiverID: 1, MessageType: "text", Content: "感谢您的预订！期待为您服务", IsRead: 1, ReadAt: &readAt, CreatedAt: oneDayAgo},
	}
	db.Create(&messages)

	fmt.Println("\n✨ 完成！已为管理员账号添加 2 条测试订单")
}
