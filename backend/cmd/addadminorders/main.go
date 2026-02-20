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
	sqlBytes, err := ioutil.ReadFile("migrations/003_add_admin_orders.sql")
	if err != nil {
		log.Fatal("读取SQL文件失败:", err)
	}

	// Split SQL statements intelligently
	sqlContent := string(sqlBytes)
	lines := strings.Split(sqlContent, "\n")

	var currentStmt strings.Builder
	var statements []string

	for _, line := range lines {
		trimmedLine := strings.TrimSpace(line)

		// Skip comments and empty lines at the start
		if currentStmt.Len() == 0 && (trimmedLine == "" || strings.HasPrefix(trimmedLine, "--")) {
			continue
		}

		// Add line to current statement
		currentStmt.WriteString(line)
		currentStmt.WriteString("\n")

		// End of statement
		if strings.HasSuffix(trimmedLine, ";") {
			stmt := strings.TrimSpace(currentStmt.String())
			if stmt != "" && !strings.HasPrefix(stmt, "--") {
				statements = append(statements, stmt)
			}
			currentStmt.Reset()
		}
	}

	fmt.Printf("共解析出 %d 条SQL语句\n\n", len(statements))

	// 执行每条语句
	successCount := 0
	for i, stmt := range statements {
		// Show preview
		preview := stmt
		if len(preview) > 100 {
			preview = preview[:100] + "..."
		}
		fmt.Printf("[%d/%d] 执行: %s\n", i+1, len(statements), preview)

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
}
