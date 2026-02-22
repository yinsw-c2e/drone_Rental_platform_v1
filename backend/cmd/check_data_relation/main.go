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

	fmt.Println("=== 供给与无人机关系检查 ===")
	fmt.Println()

	// 查询供给及其关联的无人机和机主信息
	query := `
		SELECT 
			ro.id as offer_id,
			ro.title as offer_title,
			ro.owner_id,
			u.nickname as owner_name,
			ro.drone_id,
			d.brand,
			d.model,
			d.serial_number
		FROM rental_offers ro
		LEFT JOIN users u ON ro.owner_id = u.id
		LEFT JOIN drones d ON ro.drone_id = d.id
		ORDER BY ro.id
	`

	rows, err := db.Query(query)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fmt.Println("供给ID | 供给标题 | 机主ID | 机主 | 无人机ID | 无人机")
	fmt.Println(strings.Repeat("-", 80))

	for rows.Next() {
		var offerID, ownerID, droneID int
		var offerTitle, ownerName, brand, model, sn sql.NullString

		err := rows.Scan(&offerID, &offerTitle, &ownerID, &ownerName, &droneID, &brand, &model, &sn)
		if err != nil {
			log.Printf("扫描行失败: %v", err)
			continue
		}

		droneInfo := "未关联"
		if brand.Valid && model.Valid {
			droneInfo = fmt.Sprintf("%s %s", brand.String, model.String)
		}

		fmt.Printf("%d | %s | %d | %s | %d | %s\n",
			offerID,
			getString(offerTitle),
			ownerID,
			getString(ownerName),
			droneID,
			droneInfo)
	}

	fmt.Println()
	fmt.Println("=== 统计信息 ===")

	// 统计每个机主的无人机和供给数量
	statsQuery := `
		SELECT 
			u.id,
			u.nickname,
			COUNT(DISTINCT d.id) as drone_count,
			COUNT(DISTINCT ro.id) as offer_count
		FROM users u
		LEFT JOIN drones d ON u.id = d.owner_id
		LEFT JOIN rental_offers ro ON u.id = ro.owner_id
		WHERE u.user_type IN ('drone_owner', 'both')
		GROUP BY u.id, u.nickname
		HAVING drone_count > 0 OR offer_count > 0
		ORDER BY u.id
	`

	rows2, err := db.Query(statsQuery)
	if err != nil {
		log.Fatal(err)
	}
	defer rows2.Close()

	fmt.Println("\n机主 | 无人机数量 | 供给数量")
	fmt.Println(strings.Repeat("-", 40))

	for rows2.Next() {
		var userID, droneCount, offerCount int
		var nickname string

		rows2.Scan(&userID, &nickname, &droneCount, &offerCount)
		fmt.Printf("%s | %d台 | %d个\n", nickname, droneCount, offerCount)
	}
}

func getString(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return "N/A"
}
