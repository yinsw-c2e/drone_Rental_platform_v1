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

	fmt.Println("=== 修复无人机状态 ===")
	fmt.Println()

	// 查询所有需要修复的无人机
	query := `
		SELECT DISTINCT
			d.id,
			d.brand,
			d.model,
			d.availability_status,
			COUNT(o.id) as active_order_count
		FROM drones d
		LEFT JOIN orders o ON d.id = o.drone_id AND o.status IN ('accepted', 'paid', 'in_progress')
		GROUP BY d.id
		HAVING (active_order_count > 0 AND d.availability_status != 'rented')
			OR (active_order_count = 0 AND d.availability_status = 'rented')
	`

	rows, err := db.Query(query)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fixed := 0

	for rows.Next() {
		var droneID, activeOrderCount int
		var brand, model, currentStatus string

		err := rows.Scan(&droneID, &brand, &model, &currentStatus, &activeOrderCount)
		if err != nil {
			log.Printf("扫描行失败: %v", err)
			continue
		}

		newStatus := "available"
		if activeOrderCount > 0 {
			newStatus = "rented"
		}

		fmt.Printf("修复无人机 #%d (%s %s): %s -> %s\n", droneID, brand, model, currentStatus, newStatus)

		// 更新状态
		_, err = db.Exec("UPDATE drones SET availability_status = ? WHERE id = ?", newStatus, droneID)
		if err != nil {
			log.Printf("更新失败: %v", err)
			continue
		}

		fixed++
	}

	fmt.Printf("\n✅ 成功修复 %d 台无人机的状态\n", fixed)

	// 再次验证
	fmt.Println("\n=== 验证修复结果 ===\n")

	verifyQuery := `
		SELECT 
			d.id,
			d.brand,
			d.model,
			d.availability_status,
			COUNT(o.id) as active_order_count
		FROM drones d
		LEFT JOIN orders o ON d.id = o.drone_id AND o.status IN ('accepted', 'paid', 'in_progress')
		WHERE d.owner_id IN (2, 3, 6, 7)
		GROUP BY d.id
		ORDER BY d.id
	`

	rows2, err := db.Query(verifyQuery)
	if err != nil {
		log.Fatal(err)
	}
	defer rows2.Close()

	for rows2.Next() {
		var droneID, activeOrderCount int
		var brand, model, status string

		rows2.Scan(&droneID, &brand, &model, &status, &activeOrderCount)

		statusEmoji := "✅"
		if (activeOrderCount > 0 && status != "rented") || (activeOrderCount == 0 && status == "rented") {
			statusEmoji = "❌"
		}

		fmt.Printf("%s 无人机 #%d: %s %s (状态: %s, 活跃订单: %d)\n",
			statusEmoji, droneID, brand, model, status, activeOrderCount)
	}
}
