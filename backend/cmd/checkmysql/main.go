package main

import (
	"fmt"
	"log"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func main() {
	dsn := "root:root@tcp(192.168.3.127:3306)/wurenji?charset=utf8mb4&parseTime=True&loc=Local"
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("数据库连接失败:", err)
	}

	var version string
	db.Raw("SELECT VERSION()").Scan(&version)
	fmt.Printf("MySQL 版本: %s\n", version)

	// 测试 GetConversations SQL
	fmt.Println("\n测试 GetConversations 查询...")

	type Result struct {
		ConversationID string
		LastMessage    string
		LastTime       string
		PeerID         int64
	}

	var results []Result
	err = db.Raw(`
		SELECT 
			conversation_id,
			content as last_message,
			created_at as last_time,
			CASE WHEN sender_id = 4 THEN receiver_id ELSE sender_id END AS peer_id
		FROM messages
		WHERE sender_id = 4 OR receiver_id = 4
		ORDER BY created_at DESC
		LIMIT 10
	`).Scan(&results).Error

	if err != nil {
		fmt.Printf("简单查询错误: %v\n", err)
	} else {
		fmt.Printf("简单查询成功，返回 %d 条\n", len(results))
		for _, r := range results {
			fmt.Printf("  ConvID: %s, Peer: %d, Msg: %s\n", r.ConversationID, r.PeerID, r.LastMessage[:min(20, len(r.LastMessage))])
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
