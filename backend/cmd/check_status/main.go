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

	fmt.Println("=== 无人机与供给状态对比 ===")
	fmt.Println()

	query := `
		SELECT 
			d.id as drone_id,
			d.brand,
			d.model,
			d.serial_number,
			d.availability_status as drone_status,
			ro.id as offer_id,
			ro.title as offer_title,
			ro.status as offer_status,
			COUNT(o.id) as active_order_count
		FROM drones d
		LEFT JOIN rental_offers ro ON d.id = ro.drone_id
		LEFT JOIN orders o ON d.id = o.drone_id AND o.status IN ('accepted', 'paid', 'in_progress')
		WHERE d.owner_id IN (2, 3, 6, 7)
		GROUP BY d.id, ro.id
		ORDER BY d.id, ro.id
	`

	rows, err := db.Query(query)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	currentDroneID := 0

	for rows.Next() {
		var droneID, offerID int
		var brand, model, sn, droneStatus string
		var offerTitle, offerStatus sql.NullString
		var activeOrderCount int

		err := rows.Scan(&droneID, &brand, &model, &sn, &droneStatus, &offerID, &offerTitle, &offerStatus, &activeOrderCount)
		if err != nil {
			log.Printf("扫描行失败: %v", err)
			continue
		}

		if droneID != currentDroneID {
			if currentDroneID != 0 {
				fmt.Println()
			}
			currentDroneID = droneID

			fmt.Printf("【无人机 #%d】%s %s (SN: %s)\n", droneID, brand, model, sn)
			fmt.Printf("  ├─ 无人机状态: %s\n", droneStatus)
			fmt.Printf("  ├─ 进行中订单数: %d\n", activeOrderCount)

			// 判断状态是否合理
			statusOK := "✅"
			if activeOrderCount > 0 && droneStatus != "rented" {
				statusOK = "❌ 状态不一致！有订单但状态不是rented"
			} else if activeOrderCount == 0 && droneStatus == "rented" {
				statusOK = "⚠️  状态可能过时！无订单但状态是rented"
			}
			fmt.Printf("  ├─ 状态检查: %s\n", statusOK)
		}

		if offerTitle.Valid {
			fmt.Printf("  └─ 供给: %s (状态: %s)\n", offerTitle.String, getString(offerStatus))
		}
	}

	fmt.Println("\n\n=== 建议的状态同步逻辑 ===")
	fmt.Println("1. 当创建订单时，将无人机状态改为 'rented'")
	fmt.Println("2. 当订单完成/取消时，检查是否还有其他进行中订单：")
	fmt.Println("   - 如果没有 → 将无人机状态改回 'available'")
	fmt.Println("   - 如果有 → 保持 'rented'")
	fmt.Println("3. 供给状态独立管理（机主可以随时暂停/关闭供给）")
}

func getString(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return "无"
}
