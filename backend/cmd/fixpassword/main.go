package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/go-sql-driver/mysql"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	// 连接数据库
	dsn := "root:root@tcp(192.168.3.127:3306)/wurenji?charset=utf8mb4&parseTime=True&loc=Local"
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}
	defer db.Close()

	// 测试连接
	if err := db.Ping(); err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}
	fmt.Println("✅ 数据库连接成功")

	// 新密码
	password := "password123"

	// 生成新的hash
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("生成hash失败: %v", err)
	}

	fmt.Printf("\n新生成的password123 hash: %s\n", string(hash))

	// 验证hash
	err = bcrypt.CompareHashAndPassword(hash, []byte(password))
	if err != nil {
		fmt.Printf("❌ Hash验证失败: %v\n", err)
	} else {
		fmt.Println("✅ Hash验证成功！")
	}

	// 更新所有测试用户的密码
	result, err := db.Exec("UPDATE users SET password_hash = ? WHERE phone LIKE '138000000%'", string(hash))
	if err != nil {
		log.Fatalf("更新密码失败: %v", err)
	}

	affected, _ := result.RowsAffected()
	fmt.Printf("\n✅ 成功更新 %d 个用户的密码\n", affected)

	// 验证更新后的用户
	fmt.Println("\n=== 验证更新后的用户 ===")
	rows, err := db.Query("SELECT id, phone, nickname, user_type, password_hash FROM users WHERE phone LIKE '138000000%' ORDER BY id LIMIT 4")
	if err != nil {
		log.Fatalf("查询用户失败: %v", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id int
		var phone, nickname, userType, passwordHash string
		err := rows.Scan(&id, &phone, &nickname, &userType, &passwordHash)
		if err != nil {
			log.Printf("扫描行失败: %v", err)
			continue
		}

		fmt.Printf("\n用户 #%d: %s (%s)\n", id, phone, nickname)
		fmt.Printf("  类型: %s\n", userType)
		fmt.Printf("  Hash: %s...\n", passwordHash[:30])

		// 测试密码验证
		err = bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password))
		if err != nil {
			fmt.Printf("  ❌ 密码验证失败: %v\n", err)
		} else {
			fmt.Printf("  ✅ 密码验证成功！\n")
		}
	}

	fmt.Println("\n=== 修复完成 ===")
	fmt.Println("所有测试账号密码已重置为: password123")
}
