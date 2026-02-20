package main

import (
	"fmt"
	"log"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"wurenji-backend/internal/config"
)

type TableCount struct {
	TableName string
	Count     int64
}

func main() {
	// Load config
	cfgPath := "config.yaml"
	cfg, err := config.LoadConfig(cfgPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to database
	db, err := gorm.Open(mysql.Open(cfg.Database.DSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}

	tables := []string{
		"users", "drones", "rental_offers", "rental_demands",
		"cargo_demands", "orders", "order_timelines", "payments",
		"messages", "reviews", "matching_records", "system_configs", "admin_logs",
	}

	fmt.Println("\n====== 数据库表统计 ======")
	var total int64
	for _, table := range tables {
		var count int64
		db.Table(table).Count(&count)
		fmt.Printf("%-20s: %d 条\n", table, count)
		total += count
	}
	fmt.Printf("%-20s: %d 条\n", "总计", total)
	fmt.Println("========================\n")
}
