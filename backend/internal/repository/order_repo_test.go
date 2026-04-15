package repository

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"wurenji-backend/internal/model"
)

func newRepositoryTestDB(t *testing.T, models ...interface{}) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(models...); err != nil {
		t.Fatalf("auto migrate test tables: %v", err)
	}
	return db
}

func TestUnsupportedOrderOptionalColumnOmissions(t *testing.T) {
	omissions := unsupportedOrderOptionalColumnOmissions(func(column string) bool {
		switch column {
		case "flight_start_time", "unloading_confirmed_at":
			return true
		default:
			return false
		}
	})

	expectedMissing := map[string]bool{
		"FlightEndTime":          true,
		"flight_end_time":        true,
		"LoadingConfirmedAt":     true,
		"loading_confirmed_at":   true,
		"LoadingConfirmedBy":     true,
		"loading_confirmed_by":   true,
		"UnloadingConfirmedBy":   true,
		"unloading_confirmed_by": true,
	}

	if len(omissions) != len(expectedMissing) {
		t.Fatalf("expected %d omissions, got %d: %#v", len(expectedMissing), len(omissions), omissions)
	}

	for _, item := range omissions {
		if !expectedMissing[item] {
			t.Fatalf("unexpected omission: %s (all=%#v)", item, omissions)
		}
	}
}

func TestFindReusableDirectSupplyOrderReturnsEarliestActiveMatch(t *testing.T) {
	db := newRepositoryTestDB(t, &model.Order{})
	repo := NewOrderRepo(db)
	now := time.Now().Round(time.Second)

	seed := []*model.Order{
		{
			OrderNo:        "ORD-dup-1",
			OrderType:      "cargo",
			OrderSource:    "supply_direct",
			SourceSupplyID: 10,
			RenterID:       4,
			ServiceType:    "heavy_cargo_lift_transport",
			StartTime:      now.Add(24 * time.Hour),
			EndTime:        now.Add(26 * time.Hour),
			ServiceAddress: "佛山市禅城区起点",
			DestAddress:    "佛山市南海区终点",
			TotalAmount:    198000,
			Status:         "pending_provider_confirmation",
			CreatedAt:      now.Add(-5 * time.Minute),
			UpdatedAt:      now.Add(-5 * time.Minute),
		},
		{
			OrderNo:        "ORD-dup-2",
			OrderType:      "cargo",
			OrderSource:    "supply_direct",
			SourceSupplyID: 10,
			RenterID:       4,
			ServiceType:    "heavy_cargo_lift_transport",
			StartTime:      now.Add(24 * time.Hour),
			EndTime:        now.Add(26 * time.Hour),
			ServiceAddress: "佛山市禅城区起点",
			DestAddress:    "佛山市南海区终点",
			TotalAmount:    198000,
			Status:         "pending_payment",
			CreatedAt:      now.Add(-2 * time.Minute),
			UpdatedAt:      now.Add(-2 * time.Minute),
		},
		{
			OrderNo:        "ORD-cancelled",
			OrderType:      "cargo",
			OrderSource:    "supply_direct",
			SourceSupplyID: 10,
			RenterID:       4,
			ServiceType:    "heavy_cargo_lift_transport",
			StartTime:      now.Add(24 * time.Hour),
			EndTime:        now.Add(26 * time.Hour),
			ServiceAddress: "佛山市禅城区起点",
			DestAddress:    "佛山市南海区终点",
			TotalAmount:    198000,
			Status:         "cancelled",
			CreatedAt:      now.Add(-1 * time.Minute),
			UpdatedAt:      now.Add(-1 * time.Minute),
		},
	}

	for _, item := range seed {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("seed order %s: %v", item.OrderNo, err)
		}
	}

	order, err := repo.FindReusableDirectSupplyOrder(DirectOrderReuseLookup{
		SourceSupplyID: 10,
		RenterID:       4,
		ServiceType:    "heavy_cargo_lift_transport",
		StartTime:      seed[0].StartTime,
		EndTime:        seed[0].EndTime,
		ServiceAddress: seed[0].ServiceAddress,
		DestAddress:    seed[0].DestAddress,
		TotalAmount:    198000,
		CreatedAfter:   now.Add(-10 * time.Minute),
	})
	if err != nil {
		t.Fatalf("find reusable order: %v", err)
	}
	if order == nil {
		t.Fatal("expected reusable order, got nil")
	}
	if order.OrderNo != "ORD-dup-1" {
		t.Fatalf("expected earliest active duplicate, got %s", order.OrderNo)
	}
}
