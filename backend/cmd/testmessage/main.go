package main

import (
	"fmt"
	"log"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

type Message struct {
	ID             int64  `gorm:"primaryKey"`
	ConversationID string `gorm:"column:conversation_id"`
	SenderID       int64  `gorm:"column:sender_id"`
	ReceiverID     int64  `gorm:"column:receiver_id"`
	Content        string
	IsRead         int
	CreatedAt      string `gorm:"column:created_at"`
}

func main() {
	dsn := "root:root@tcp(192.168.3.127:3306)/wurenji?charset=utf8mb4&parseTime=True&loc=Local"
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("数据库连接失败:", err)
	}

	// 测试用户ID (假设当前登录用户是王五 user_id=4)
	userID := int64(4)
	peerID := int64(2) // 张三

	fmt.Printf("查询用户 %d 和 %d 之间的消息:\n\n", userID, peerID)

	var messages []Message
	err = db.Where(
		"(sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)",
		userID, peerID, peerID, userID,
	).Order("created_at DESC").Find(&messages).Error

	if err != nil {
		log.Printf("查询失败: %v\n", err)
		return
	}

	fmt.Printf("找到 %d 条消息:\n", len(messages))
	for _, msg := range messages {
		fmt.Printf("  ID: %d, From: %d -> To: %d, Content: %s\n",
			msg.ID, msg.SenderID, msg.ReceiverID, msg.Content)
	}

	// 检查所有消息
	fmt.Println("\n\n数据库中所有消息:")
	var allMessages []Message
	db.Find(&allMessages)
	for _, msg := range allMessages {
		fmt.Printf("  ID: %d, ConvID: %s, From: %d -> To: %d, Content: %s\n",
			msg.ID, msg.ConversationID, msg.SenderID, msg.ReceiverID, msg.Content)
	}
}
