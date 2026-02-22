package main

import (
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	password := "password123"

	// 生成新的hash (使用DefaultCost = 10)
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		panic(err)
	}

	fmt.Printf("生成的 Hash: %s\n", string(hash))
	fmt.Printf("长度: %d\n\n", len(string(hash)))

	// 验证
	err = bcrypt.CompareHashAndPassword(hash, []byte(password))
	if err != nil {
		fmt.Printf("验证失败: %v\n", err)
	} else {
		fmt.Println("验证成功！")
	}

	// 测试SQL中的hash
	sqlHash := "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
	fmt.Printf("\nSQL Hash: %s\n", sqlHash)
	fmt.Printf("长度: %d\n\n", len(sqlHash))

	err = bcrypt.CompareHashAndPassword([]byte(sqlHash), []byte(password))
	if err != nil {
		fmt.Printf("SQL Hash验证失败: %v\n", err)
	} else {
		fmt.Println("SQL Hash验证成功！")
	}

	// 常用的Laravel bcrypt hash for "password123"
	laravelHash := "$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi"
	fmt.Printf("\nLaravel Hash: %s\n", laravelHash)
	fmt.Printf("长度: %d\n\n", len(laravelHash))

	err = bcrypt.CompareHashAndPassword([]byte(laravelHash), []byte(password))
	if err != nil {
		fmt.Printf("Laravel Hash验证失败: %v\n", err)
	} else {
		fmt.Println("Laravel Hash验证成功！")
	}
}
