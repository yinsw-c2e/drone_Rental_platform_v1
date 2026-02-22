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

	fmt.Println("=== 完整的数据一致性检查 ===")
	fmt.Println()

	// 查询测试用户A（机主2）的详细数据
	query := `
		SELECT 
			u.id as user_id,
			u.nickname,
			d.id as drone_id,
			d.brand,
			d.model,
			d.availability_status as drone_status,
			ro.id as offer_id,
			ro.title as offer_title,
			ro.status as offer_status,
			COUNT(DISTINCT o.id) as active_order_count,
			GROUP_CONCAT(DISTINCT o.id ORDER BY o.id) as order_ids,
			GROUP_CONCAT(DISTINCT o.status ORDER BY o.id) as order_statuses
		FROM users u
		INNER JOIN drones d ON u.id = d.owner_id
		LEFT JOIN rental_offers ro ON d.id = ro.drone_id
		LEFT JOIN orders o ON d.id = o.drone_id AND o.status IN ('accepted', 'paid', 'in_progress')
		WHERE u.id = 2
		GROUP BY u.id, d.id, ro.id
		ORDER BY d.id, ro.id
	`

	rows, err := db.Query(query)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fmt.Println("用户: 测试用户A (ID: 2)")
	fmt.Println(strings.Repeat("=", 80))

	currentDroneID := int64(0)

	for rows.Next() {
		var userID, droneID int64
		var nickname, brand, model, droneStatus string
		var offerID sql.NullInt64
		var offerTitle, offerStatus, orderIDs, orderStatuses sql.NullString
		var activeOrderCount int

		err := rows.Scan(&userID, &nickname, &droneID, &brand, &model, &droneStatus,
			&offerID, &offerTitle, &offerStatus, &activeOrderCount, &orderIDs, &orderStatuses)
		if err != nil {
			log.Printf("扫描行失败: %v", err)
			continue
		}

		if droneID != currentDroneID {
			if currentDroneID != 0 {
				fmt.Println()
			}
			currentDroneID = droneID

			fmt.Printf("\n📱 无人机 #%d: %s %s\n", droneID, brand, model)
			fmt.Printf("   状态: %s\n", droneStatus)
			fmt.Printf("   活跃订单数: %d\n", activeOrderCount)

			if activeOrderCount > 0 {
				fmt.Printf("   订单ID: %s\n", getString(orderIDs))
				fmt.Printf("   订单状态: %s\n", getString(orderStatuses))
			}

			// 状态一致性检查
			expectedStatus := "available"
			if activeOrderCount > 0 {
				expectedStatus = "rented"
			}

			if droneStatus != expectedStatus {
				fmt.Printf("   ❌ 状态不一致！应该是: %s\n", expectedStatus)
			} else {
				fmt.Printf("   ✅ 状态正确\n")
			}
		}

		if offerID.Valid {
			fmt.Printf("   └─ 供给 #%d: %s\n", offerID.Int64, getString(offerTitle))
			fmt.Printf("      供给状态: %s\n", getString(offerStatus))

			// 建议的供给状态
			if activeOrderCount > 0 {
				fmt.Printf("      💡 建议: 供给状态可以保持 'active'（机主可随时暂停）\n")
			}
		}
	}

	fmt.Println("\n\n" + strings.Repeat("=", 80))
	fmt.Println("=== 问题分析 ===")
	fmt.Println()
	fmt.Println("1. 无人机状态（availability_status）：")
	fmt.Println("   - 反映无人机是否可接新订单")
	fmt.Println("   - 有活跃订单时自动变为 'rented'")
	fmt.Println("   - 无活跃订单时自动恢复为 'available'")
	fmt.Println()
	fmt.Println("2. 供给状态（rental_offers.status）：")
	fmt.Println("   - 反映供给本身是否开放接单")
	fmt.Println("   - 'active': 进行中，接受新订单")
	fmt.Println("   - 'paused': 暂停，不接受新订单")
	fmt.Println("   - 'closed': 已关闭")
	fmt.Println()
	fmt.Println("3. 两者关系：")
	fmt.Println("   - 无人机 'rented' 时，新订单应该被拒绝（即使供给是 'active'）")
	fmt.Println("   - 供给 'paused' 或 'closed' 时，不接受新订单（即使无人机是 'available'）")
	fmt.Println("   - 最终规则：只有当无人机='available' 且 供给='active' 时才能下单")
	fmt.Println()
	fmt.Println("4. 前端显示建议：")
	fmt.Println("   - '我的无人机'列表：显示无人机状态（可用/已出租/维护中）")
	fmt.Println("   - '我的供给'列表：显示供给状态（进行中/已暂停/已关闭）")
	fmt.Println("   - 供给详情页：同时显示无人机状态和供给状态")
}

func getString(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return "无"
}
