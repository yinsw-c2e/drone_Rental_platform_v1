package main

import (
	"database/sql"
	"fmt"
	"log"
	"strings"

	_ "github.com/go-sql-driver/mysql"
)

func main() {
	db, err := sql.Open("mysql", "root:root@tcp(192.168.3.127:3306)/wurenji?charset=utf8mb4&parseTime=True")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	fmt.Println("=== 完整数据同步脚本 ===")
	fmt.Println()

	// 1. 显示当前所有无人机和订单的状态
	fmt.Println("【步骤1】检查当前数据状态")
	fmt.Println(strings.Repeat("=", 80))

	checkQuery := `
		SELECT 
			d.id,
			d.brand,
			d.model,
			d.serial_number,
			d.availability_status,
			COUNT(o.id) as active_order_count
		FROM drones d
		LEFT JOIN orders o ON d.id = o.drone_id AND o.status IN ('accepted', 'paid', 'in_progress')
		GROUP BY d.id
		ORDER BY d.id
	`

	rows, err := db.Query(checkQuery)
	if err != nil {
		log.Fatal(err)
	}

	needFix := []struct {
		id             int
		brand          string
		model          string
		currentStatus  string
		expectedStatus string
	}{}

	for rows.Next() {
		var id, activeCount int
		var brand, model, sn, status string
		rows.Scan(&id, &brand, &model, &sn, &status, &activeCount)

		expected := "available"
		if activeCount > 0 {
			expected = "rented"
		}

		statusIcon := "✅"
		if status != expected {
			statusIcon = "❌"
			needFix = append(needFix, struct {
				id             int
				brand          string
				model          string
				currentStatus  string
				expectedStatus string
			}{id, brand, model, status, expected})
		}

		fmt.Printf("%s 无人机 #%d: %s %s (当前: %s, 活跃订单: %d)\n",
			statusIcon, id, brand, model, status, activeCount)
	}
	rows.Close()

	if len(needFix) == 0 {
		fmt.Println("\n✅ 所有数据状态一致，无需修复！")
		return
	}

	// 2. 修复不一致的数据
	fmt.Println("\n【步骤2】修复数据")
	fmt.Println(strings.Repeat("=", 80))

	for _, item := range needFix {
		fmt.Printf("修复无人机 #%d (%s %s): %s → %s\n",
			item.id, item.brand, item.model, item.currentStatus, item.expectedStatus)

		_, err := db.Exec("UPDATE drones SET availability_status = ? WHERE id = ?",
			item.expectedStatus, item.id)
		if err != nil {
			log.Printf("  ❌ 修复失败: %v", err)
		} else {
			fmt.Printf("  ✅ 修复成功\n")
		}
	}

	// 3. 验证修复结果
	fmt.Println("\n【步骤3】验证修复结果")
	fmt.Println(strings.Repeat("=", 80))

	rows2, err := db.Query(checkQuery)
	if err != nil {
		log.Fatal(err)
	}
	defer rows2.Close()

	allCorrect := true
	for rows2.Next() {
		var id, activeCount int
		var brand, model, sn, status string
		rows2.Scan(&id, &brand, &model, &sn, &status, &activeCount)

		expected := "available"
		if activeCount > 0 {
			expected = "rented"
		}

		statusIcon := "✅"
		if status != expected {
			statusIcon = "❌"
			allCorrect = false
		}

		fmt.Printf("%s 无人机 #%d: %s %s (状态: %s, 活跃订单: %d)\n",
			statusIcon, id, brand, model, status, activeCount)
	}

	fmt.Println()
	if allCorrect {
		fmt.Println("🎉 所有数据已修复完成！")
	} else {
		fmt.Println("⚠️  仍有数据不一致，请检查！")
	}

	// 4. 显示按用户统计的数据
	fmt.Println("\n【步骤4】用户数据统计")
	fmt.Println(strings.Repeat("=", 80))

	statsQuery := `
		SELECT 
			u.id,
			u.nickname,
			COUNT(DISTINCT d.id) as drone_count,
			COUNT(DISTINCT CASE WHEN d.availability_status = 'available' THEN d.id END) as available_count,
			COUNT(DISTINCT CASE WHEN d.availability_status = 'rented' THEN d.id END) as rented_count,
			COUNT(DISTINCT ro.id) as offer_count,
			COUNT(DISTINCT o.id) as active_order_count
		FROM users u
		LEFT JOIN drones d ON u.id = d.owner_id
		LEFT JOIN rental_offers ro ON d.id = ro.drone_id AND ro.status = 'active'
		LEFT JOIN orders o ON d.id = o.drone_id AND o.status IN ('accepted', 'paid', 'in_progress')
		WHERE u.user_type IN ('drone_owner', 'both')
		GROUP BY u.id
		HAVING drone_count > 0
		ORDER BY u.id
	`

	rows3, _ := db.Query(statsQuery)
	defer rows3.Close()

	fmt.Println()
	for rows3.Next() {
		var uid int
		var nickname string
		var droneCount, availCount, rentedCount, offerCount, orderCount int

		rows3.Scan(&uid, &nickname, &droneCount, &availCount, &rentedCount, &offerCount, &orderCount)

		fmt.Printf("👤 %s (ID:%d)\n", nickname, uid)
		fmt.Printf("   无人机: %d 台 (可用:%d, 已租:%d)\n", droneCount, availCount, rentedCount)
		fmt.Printf("   供给: %d 个, 活跃订单: %d 个\n", offerCount, orderCount)
		fmt.Println()
	}
}
