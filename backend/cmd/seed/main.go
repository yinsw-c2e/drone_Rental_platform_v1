package main

import (
	"fmt"
	"log"
	"os"
	"strings"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"wurenji-backend/internal/config"
)

func main() {
	// Load config
	cfgPath := "config.yaml"
	if envPath := os.Getenv("CONFIG_PATH"); envPath != "" {
		cfgPath = envPath
	}

	cfg, err := config.LoadConfig(cfgPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to database
	db, err := gorm.Open(mysql.Open(cfg.Database.DSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}

	// Read SQL file
	sqlBytes, err := os.ReadFile("migrations/002_seed_data.sql")
	if err != nil {
		log.Fatalf("Failed to read SQL file: %v", err)
	}

	// Split SQL statements more intelligently
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

	// Execute SQL statements one by one
	fmt.Println("开始执行数据初始化...")
	successCount := 0
	failCount := 0
	for i, stmt := range statements {
		// Skip USE statement
		if strings.HasPrefix(strings.ToUpper(strings.TrimSpace(stmt)), "USE ") {
			continue
		}

		// Skip SELECT statements (they are just for display)
		if strings.HasPrefix(strings.ToUpper(strings.TrimSpace(stmt)), "SELECT ") {
			continue
		}

		if err := db.Exec(stmt).Error; err != nil {
			fmt.Printf("⚠️  Statement %d failed: %v\n", i+1, err)
			if len(stmt) > 300 {
				fmt.Printf("   Statement: %s...\n", stmt[:300])
			} else {
				fmt.Printf("   Statement: %s\n", stmt)
			}
			failCount++
		} else {
			successCount++
			// Print successful operations
			firstLine := strings.Split(stmt, "\n")[0]
			firstLine = strings.TrimSpace(firstLine)
			if len(firstLine) > 80 {
				firstLine = firstLine[:80] + "..."
			}
			if strings.Contains(strings.ToUpper(firstLine), "INSERT INTO") {
				fmt.Printf("✓ %s\n", firstLine)
			}
		}
	}

	fmt.Printf("\n✅ 数据初始化完成！成功: %d, 失败: %d\n", successCount, failCount)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
