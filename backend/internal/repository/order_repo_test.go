package repository

import (
	"database/sql"
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

	omitted := map[string]bool{}
	for _, item := range omissions {
		omitted[item] = true
	}

	expectedCount := (len(orderOptionalColumns()) - 2) * 2
	if len(omissions) != expectedCount {
		t.Fatalf("expected %d omissions, got %d: %#v", expectedCount, len(omissions), omissions)
	}

	for _, present := range []string{"FlightStartTime", "flight_start_time", "UnloadingConfirmedAt", "unloading_confirmed_at"} {
		if omitted[present] {
			t.Fatalf("did not expect available column to be omitted: %s (all=%#v)", present, omissions)
		}
	}

	for _, missing := range []string{"FlightEndTime", "flight_end_time", "OrderMode", "order_mode", "PriceBreakdownJSON", "price_breakdown_json", "LoadingConfirmedBy", "loading_confirmed_by"} {
		if !omitted[missing] {
			t.Fatalf("expected missing optional column to be omitted: %s (all=%#v)", missing, omissions)
		}
	}
}

func TestUpdatePreservesNullableOrderReferences(t *testing.T) {
	db := newRepositoryTestDB(t, &model.Order{})
	repo := NewOrderRepo(db)
	now := time.Now().Round(time.Second)

	orderNo := "ORD-null-ref-update"
	if err := db.Exec(`
			INSERT INTO orders (
				order_no, order_type, order_mode, order_source,
				client_user_id, service_type,
				start_time, end_time, service_address, dest_address,
				total_amount, status, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, orderNo, "cargo", "instant", "instant", 46, "heavy_cargo_lift_transport", now, now.Add(time.Hour), "佛山市禅城区起点", "佛山市南海区终点", 108400, "pending_dispatch", now, now).Error; err != nil {
		t.Fatalf("insert order with nullable refs: %v", err)
	}
	var order model.Order
	if err := db.Where("order_no = ?", orderNo).First(&order).Error; err != nil {
		t.Fatalf("reload seeded order: %v", err)
	}

	var loaded model.Order
	if err := db.First(&loaded, order.ID).Error; err != nil {
		t.Fatalf("load order: %v", err)
	}
	if loaded.DroneID != 0 || loaded.OwnerID != 0 || loaded.PilotID != 0 || loaded.RenterID != 0 {
		t.Fatalf("expected Go zero values for SQL NULL refs, got drone=%d owner=%d pilot=%d renter=%d", loaded.DroneID, loaded.OwnerID, loaded.PilotID, loaded.RenterID)
	}
	loaded.Status = "cancelled"
	loaded.CancelReason = "客户取消"
	loaded.CancelBy = "client"
	if err := repo.Update(&loaded); err != nil {
		t.Fatalf("update order: %v", err)
	}

	var droneID, ownerID, pilotID, renterID sql.NullInt64
	var clientRequestID sql.NullString
	var status, cancelReason, cancelBy string
	row := db.Raw("SELECT drone_id, owner_id, pilot_id, renter_id, client_request_id, status, cancel_reason, cancel_by FROM orders WHERE id = ?", order.ID).Row()
	if err := row.Scan(&droneID, &ownerID, &pilotID, &renterID, &clientRequestID, &status, &cancelReason, &cancelBy); err != nil {
		t.Fatalf("scan updated refs: %v", err)
	}
	if droneID.Valid || ownerID.Valid || pilotID.Valid || renterID.Valid {
		t.Fatalf("expected SQL NULL refs after update, got drone=%#v owner=%#v pilot=%#v renter=%#v", droneID, ownerID, pilotID, renterID)
	}
	if clientRequestID.Valid {
		t.Fatalf("expected SQL NULL client_request_id after update, got %#v", clientRequestID)
	}
	if status != "cancelled" || cancelReason != "客户取消" || cancelBy != "client" {
		t.Fatalf("expected cancel fields to persist, got status=%q reason=%q by=%q", status, cancelReason, cancelBy)
	}
}

func TestOrderNullableForeignKeyColumnsIncludeAllSchemaFKs(t *testing.T) {
	got := map[string]bool{}
	for _, column := range nullableOrderForeignKeyColumns() {
		got[column] = true
	}
	for _, column := range []string{"drone_id", "owner_id", "pilot_id", "renter_id"} {
		if !got[column] {
			t.Fatalf("expected nullable foreign key column %s to be normalized/omitted, got %#v", column, got)
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
