package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"strings"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func main() {
	// 连接数据库
	dsn := "root:root@tcp(192.168.3.127:3306)/wurenji?charset=utf8mb4&parseTime=True&loc=Local"
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("数据库连接失败:", err)
	}

	sqlDB, _ := db.DB()
	defer sqlDB.Close()

	// 读取 SQL 文件
	sqlBytes, err := ioutil.ReadFile("migrations/004_fix_conversation_id.sql")
	if err != nil {
		log.Fatal("读取SQL文件失败:", err)
	}

	// 按行分割，跳过注释和空行，执行每个UPDATE语句
	lines := strings.Split(string(sqlBytes), "\n")
	var currentStmt strings.Builder
	var statements []string

	for _, line := range lines {
		trimmedLine := strings.TrimSpace(line)

		// 跳过注释和空行
		if trimmedLine == "" || strings.HasPrefix(trimmedLine, "--") || strings.HasPrefix(trimmedLine, "/*") {
			continue
		}

		currentStmt.WriteString(line)
		currentStmt.WriteString("\n")

		// 语句结束
		if strings.HasSuffix(trimmedLine, ";") {
			stmt := strings.TrimSpace(currentStmt.String())
			if stmt != "" && (strings.HasPrefix(stmt, "UPDATE") || strings.HasPrefix(stmt, "SET")) {
				statements = append(statements, stmt)
			}
			currentStmt.Reset()
		}
	}

	fmt.Printf("共解析出 %d 条UPDATE语句\n\n", len(statements))

	// 执行每条语句
	successCount := 0
	for i, stmt := range statements {
		fmt.Printf("[%d/%d] 执行: %s\n", i+1, len(statements), stmt[:min(80, len(stmt))])

		result := db.Exec(stmt)
		if result.Error != nil {
			fmt.Printf("  ❌ 失败: %v\n", result.Error)
		} else {
			affected := result.RowsAffected
			fmt.Printf("  ✅ 成功，影响 %d 行\n", affected)
			successCount++
		}
	}

	fmt.Printf("\n执行完成！成功: %d/%d\n", successCount, len(statements))

	// 验证结果
	fmt.Println("\n验证修复结果...")
	var count int64
	db.Raw("SELECT COUNT(*) FROM messages WHERE conversation_id LIKE 'conv\\_%' ESCAPE '\\'").Scan(&count)
	fmt.Printf("  剩余旧格式记录数: %d (应为0)\n", count)

	db.Raw("SELECT COUNT(*) FROM messages WHERE conversation_id REGEXP '^[0-9]+-[0-9]+$' AND CAST(SUBSTRING_INDEX(conversation_id, '-', 1) AS UNSIGNED) > CAST(SUBSTRING_INDEX(conversation_id, '-', -1) AS UNSIGNED)").Scan(&count)
	fmt.Printf("  顺序错误记录数: %d (应为0)\n", count)

	fmt.Println("\n当前 conversation_id 列表:")
	var ids []string
	db.Raw("SELECT DISTINCT conversation_id FROM messages ORDER BY conversation_id").Scan(&ids)
	for _, id := range ids {
		fmt.Printf("  - %s\n", id)
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
