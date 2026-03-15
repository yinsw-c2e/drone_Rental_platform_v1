package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	"wurenji-backend/internal/config"
)

type migrationFile struct {
	path   string
	name   string
	prefix int
}

func main() {
	configPath := flag.String("config", "config.yaml", "配置文件路径")
	dir := flag.String("dir", "migrations", "SQL 迁移目录")
	from := flag.Int("from", 0, "起始迁移编号（含）")
	to := flag.Int("to", 0, "结束迁移编号（含），0 表示不限制")
	include := flag.String("include", "", "仅执行指定编号，逗号分隔，例如 901,911")
	dryRun := flag.Bool("dry-run", false, "仅打印将执行的文件，不真正执行")
	flag.Parse()

	cfg, err := config.LoadConfig(*configPath)
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	files, err := collectMigrationFiles(*dir, *from, *to, parseIncludeSet(*include))
	if err != nil {
		log.Fatalf("读取迁移目录失败: %v", err)
	}
	if len(files) == 0 {
		log.Fatalf("未找到符合条件的 SQL 文件，dir=%s", *dir)
	}

	fmt.Println("将按以下顺序执行迁移:")
	for _, file := range files {
		fmt.Printf("  - %03d %s\n", file.prefix, file.name)
	}
	if *dryRun {
		fmt.Println("dry-run 模式，不执行 SQL。")
		return
	}

	db, err := gorm.Open(mysql.Open(cfg.Database.DSN()), &gorm.Config{})
	if err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("获取底层数据库连接失败: %v", err)
	}
	defer sqlDB.Close()

	for _, file := range files {
		fmt.Printf("\n==> 执行 %s\n", file.name)
		content, err := os.ReadFile(file.path)
		if err != nil {
			log.Fatalf("读取迁移文件失败 %s: %v", file.name, err)
		}
		statements := splitSQLStatements(string(content))
		if len(statements) == 0 {
			fmt.Printf("    跳过，未解析到可执行语句\n")
			continue
		}
		for idx, stmt := range statements {
			fmt.Printf("    [%d/%d] %s\n", idx+1, len(statements), previewSQL(stmt))
			if err := db.Exec(stmt).Error; err != nil {
				log.Fatalf("执行失败 %s 第 %d 条语句: %v", file.name, idx+1, err)
			}
		}
		fmt.Printf("    完成 %s，共执行 %d 条语句\n", file.name, len(statements))
	}

	fmt.Println("\n全部迁移执行完成。")
}

func collectMigrationFiles(dir string, from, to int, include map[int]bool) ([]migrationFile, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var files []migrationFile
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		prefix, ok := parsePrefix(entry.Name())
		if !ok {
			continue
		}
		if len(include) > 0 {
			if !include[prefix] {
				continue
			}
		} else {
			if prefix < from {
				continue
			}
			if to > 0 && prefix > to {
				continue
			}
		}
		files = append(files, migrationFile{
			path:   filepath.Join(dir, entry.Name()),
			name:   entry.Name(),
			prefix: prefix,
		})
	}

	sort.Slice(files, func(i, j int) bool {
		if files[i].prefix == files[j].prefix {
			return files[i].name < files[j].name
		}
		return files[i].prefix < files[j].prefix
	})
	return files, nil
}

func parsePrefix(name string) (int, bool) {
	parts := strings.SplitN(name, "_", 2)
	if len(parts) == 0 {
		return 0, false
	}
	value, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, false
	}
	return value, true
}

func parseIncludeSet(raw string) map[int]bool {
	result := map[int]bool{}
	if strings.TrimSpace(raw) == "" {
		return result
	}
	for _, item := range strings.Split(raw, ",") {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		value, err := strconv.Atoi(item)
		if err != nil {
			continue
		}
		result[value] = true
	}
	return result
}

func splitSQLStatements(content string) []string {
	var statements []string
	var current strings.Builder
	inSingle := false
	inDouble := false
	inBacktick := false
	inLineComment := false
	inBlockComment := false
	runes := []rune(content)

	for i := 0; i < len(runes); i++ {
		ch := runes[i]
		var next rune
		if i+1 < len(runes) {
			next = runes[i+1]
		}

		if inLineComment {
			if ch == '\n' {
				inLineComment = false
			}
			continue
		}
		if inBlockComment {
			if ch == '*' && next == '/' {
				inBlockComment = false
				i++
			}
			continue
		}

		if !inSingle && !inDouble && !inBacktick {
			if ch == '-' && next == '-' {
				inLineComment = true
				i++
				continue
			}
			if ch == '#' {
				inLineComment = true
				continue
			}
			if ch == '/' && next == '*' {
				inBlockComment = true
				i++
				continue
			}
		}

		switch ch {
		case '\'':
			if !inDouble && !inBacktick && !isEscaped(runes, i) {
				inSingle = !inSingle
			}
		case '"':
			if !inSingle && !inBacktick && !isEscaped(runes, i) {
				inDouble = !inDouble
			}
		case '`':
			if !inSingle && !inDouble {
				inBacktick = !inBacktick
			}
		case ';':
			if !inSingle && !inDouble && !inBacktick {
				stmt := strings.TrimSpace(current.String())
				if stmt != "" {
					statements = append(statements, stmt)
				}
				current.Reset()
				continue
			}
		}

		current.WriteRune(ch)
	}

	if tail := strings.TrimSpace(current.String()); tail != "" {
		statements = append(statements, tail)
	}
	return statements
}

func isEscaped(runes []rune, idx int) bool {
	backslashes := 0
	for i := idx - 1; i >= 0 && runes[i] == '\\'; i-- {
		backslashes++
	}
	return backslashes%2 == 1
}

func previewSQL(stmt string) string {
	stmt = strings.Join(strings.Fields(stmt), " ")
	if len(stmt) <= 100 {
		return stmt
	}
	return stmt[:100] + "..."
}
