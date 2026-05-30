package repository

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"wurenji-backend/internal/model"
)

func TestWeChatSubscribeRepoTryConsumeIsAtomic(t *testing.T) {
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("unwrap db: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	if err := db.AutoMigrate(&model.WechatSubscribeGrant{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	repo := NewWeChatSubscribeRepo(db)
	if err := repo.Grant(context.Background(), 10, "tmpl", 5); err != nil {
		t.Fatalf("grant: %v", err)
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	successes := 0
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ok, err := repo.TryConsume(context.Background(), 10, "tmpl")
			if err != nil {
				t.Errorf("consume: %v", err)
				return
			}
			if ok {
				mu.Lock()
				successes++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	if successes != 5 {
		t.Fatalf("expected 5 successful consumes, got %d", successes)
	}
	ok, err := repo.TryConsume(context.Background(), 10, "tmpl")
	if err != nil {
		t.Fatalf("final consume: %v", err)
	}
	if ok {
		t.Fatalf("expected no remaining grants")
	}
}
