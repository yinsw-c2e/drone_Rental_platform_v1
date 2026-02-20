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

	// 查询用户
	var phone, passwordHash, nickname string
	err = db.QueryRow("SELECT phone, password_hash, nickname FROM users WHERE phone = ?", "13800138000").
		Scan(&phone, &passwordHash, &nickname)
	if err != nil {
		log.Fatal("查询用户失败:", err)
	}

	fmt.Printf("用户: %s (%s)\n", nickname, phone)
	fmt.Printf("密码哈希: %s\n", passwordHash)

	// 测试密码
	testPassword := "password123"
	err = bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(testPassword))
	if err != nil {
		fmt.Printf("❌ 密码验证失败: %v\n", err)

		// 重新生成正确的密码哈希
		fmt.Println("\n生成新的密码哈希...")
		newHash, _ := bcrypt.GenerateFromPassword([]byte(testPassword), bcrypt.DefaultCost)
		fmt.Printf("新哈希: %s\n", string(newHash))

		// 更新数据库
		_, err = db.Exec("UPDATE users SET password_hash = ? WHERE phone = ?", string(newHash), phone)
		if err != nil {
			fmt.Printf("更新失败: %v\n", err)
		} else {
			fmt.Println("✅ 密码已重置为: password123")
		}
	} else {
		fmt.Println("✅ 密码验证成功！")
	}
}
