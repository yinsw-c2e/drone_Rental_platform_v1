package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/go-sql-driver/mysql"
)

func main() {
	db, err := sql.Open("mysql", "root:root@tcp(192.168.3.127:3306)/wurenji?charset=utf8mb4&parseTime=True")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	fmt.Println("=== 无人机数据检查 ===")
	fmt.Println()

	rows, err := db.Query("SELECT id, brand, model, serial_number, availability_status FROM drones ORDER BY id LIMIT 5")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	for rows.Next() {
		var id int
		var brand, model, serialNumber, status string
		rows.Scan(&id, &brand, &model, &serialNumber, &status)

		statusEmoji := "✅"
		if status != "available" {
			statusEmoji = "⚠️"
		}

		fmt.Printf("%s 无人机 #%d: %s %s\n", statusEmoji, id, brand, model)
		fmt.Printf("   SN: %s\n", serialNumber)
		fmt.Printf("   状态: %s\n\n", status)
	}
}
