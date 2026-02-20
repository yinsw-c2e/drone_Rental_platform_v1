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
		log.Fatal(err)
	}
	defer db.Close()

	// 测试密码
	testPassword := "password123"
	newHash, err := bcrypt.GenerateFromPassword([]byte(testPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal("生成密码哈希失败:", err)
	}

	fmt.Printf("重置所有测试用户的密码为: %s\n", testPassword)
	fmt.Printf("新密码哈希: %s\n\n", string(newHash))

	// 更新所有测试用户
	phones := []string{
		"13800138000", "13800138001", "13800138002", "13800138003",
		"13800138004", "13800138005", "13800138006", "13800138007",
	}

	for _, phone := range phones {
		result, err := db.Exec("UPDATE users SET password_hash = ? WHERE phone = ?", string(newHash), phone)
		if err != nil {
			fmt.Printf("❌ 更新 %s 失败: %v\n", phone, err)
			continue
		}

		affected, _ := result.RowsAffected()
		if affected > 0 {
			fmt.Printf("✅ 已重置 %s 的密码\n", phone)
		} else {
			fmt.Printf("⚠️  用户 %s 不存在\n", phone)
		}
	}

	fmt.Println("\n✨ 所有用户密码重置完成！")
	fmt.Println("现在可以使用任意测试账号登录，密码都是: password123")
}
