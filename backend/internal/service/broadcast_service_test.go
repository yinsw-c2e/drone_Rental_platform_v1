package service

import (
	"errors"
	"sync"
	"testing"
	"time"

	"go.uber.org/zap"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

func newBroadcastTestService(t *testing.T) (*BroadcastService, *gormDBHandles) {
	t.Helper()
	db := newServiceTestDB(
		t,
		&model.ProviderPresence{},
		&model.OrderBroadcast{},
		&model.Order{},
		&model.OrderTimeline{},
		&model.OrderSnapshot{},
		&model.Review{},
	)
	_ = db.Exec("PRAGMA busy_timeout = 5000").Error
	handles := &gormDBHandles{
		orderRepo:     repository.NewOrderRepo(db),
		presenceRepo:  repository.NewProviderPresenceRepo(db),
		broadcastRepo: repository.NewOrderBroadcastRepo(db),
		artifactRepo:  repository.NewOrderArtifactRepo(db),
	}
	return NewBroadcastService(handles.presenceRepo, handles.broadcastRepo, handles.orderRepo, handles.artifactRepo, nil, zap.NewNop()), handles
}

type gormDBHandles struct {
	orderRepo     *repository.OrderRepo
	presenceRepo  *repository.ProviderPresenceRepo
	broadcastRepo *repository.OrderBroadcastRepo
	artifactRepo  *repository.OrderArtifactRepo
}

func TestBroadcastGrabAssignsOrderWithoutRepricing(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	start := time.Now().Add(30 * time.Minute)
	order := &model.Order{
		OrderNo:              "WRJ-H3-GRAB-001",
		OrderType:            "cargo",
		OrderSource:          OrderModeInstant,
		OrderMode:            OrderModeInstant,
		ServiceClassCode:     "light_heavy",
		Title:                "即时吊运抢单",
		ServiceType:          defaultDemandServiceType,
		CargoWeightKG:        80,
		StartTime:            start,
		EndTime:              start.Add(time.Hour),
		ServiceLatitude:      22.5431,
		ServiceLongitude:     114.0579,
		ServiceAddress:       "深圳市龙岗区坂田仓库",
		DestAddress:          "深圳市坪山区施工点",
		TotalAmount:          168000,
		PriceBreakdownJSON:   model.JSON(`{"total_estimated_cents":168000}`),
		Status:               "pending_dispatch",
		EstimatedDistanceM:   18000,
		EstimatedDurationMin: 45,
	}
	if err := handles.orderRepo.Create(order); err != nil {
		t.Fatalf("create order: %v", err)
	}
	broadcast, err := service.CreateForOrder(order)
	if err != nil {
		t.Fatalf("create broadcast: %v", err)
	}
	if _, err := service.SetOnline(7007, ProviderPresenceInput{
		Latitude:               22.5440,
		Longitude:              114.0585,
		AcceptedServiceClasses: []string{"light_heavy"},
		MaxRadiusKM:            20,
	}); err != nil {
		t.Fatalf("set online: %v", err)
	}

	grabbed, err := service.Grab(broadcast.ID, 7007)
	if err != nil {
		t.Fatalf("grab broadcast: %v", err)
	}
	if grabbed.Status != "assigned" {
		t.Fatalf("expected assigned order, got %s", grabbed.Status)
	}
	if grabbed.ProviderUserID != 7007 || grabbed.OwnerID != 7007 || grabbed.GrabbedByUserID != 7007 {
		t.Fatalf("expected provider fields to be assigned, got %#v", grabbed)
	}
	if grabbed.TotalAmount != 168000 || string(grabbed.PriceBreakdownJSON) != `{"total_estimated_cents":168000}` {
		t.Fatalf("grab must not recalculate price, got amount=%d breakdown=%s", grabbed.TotalAmount, string(grabbed.PriceBreakdownJSON))
	}

	updatedBroadcast, err := handles.broadcastRepo.GetByID(broadcast.ID)
	if err != nil {
		t.Fatalf("reload broadcast: %v", err)
	}
	if updatedBroadcast.Status != "grabbed" || updatedBroadcast.GrabbedByUserID != 7007 || updatedBroadcast.GrabbedAt == nil {
		t.Fatalf("expected grabbed broadcast, got %#v", updatedBroadcast)
	}

	var timelines []model.OrderTimeline
	if err := handles.orderRepo.DB().Where("order_id = ? AND status = ?", order.ID, "assigned").Find(&timelines).Error; err != nil {
		t.Fatalf("query timelines: %v", err)
	}
	if len(timelines) != 1 {
		t.Fatalf("expected one assigned timeline, got %#v", timelines)
	}
}

func TestListOpenForProviderFiltersByRadiusAndServiceClass(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	now := time.Now()
	nearOrder := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-LIST-NEAR", "light_heavy", 22.5431, 114.0579, 80000)
	farOrder := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-LIST-FAR", "light_heavy", 23.5431, 115.0579, 90000)
	otherClassOrder := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-LIST-OTHER", "medium_heavy", 22.5441, 114.0589, 120000)
	for _, order := range []*model.Order{nearOrder, farOrder, otherClassOrder} {
		if _, err := service.createForOrderWithRepos(order, handles.orderRepo, handles.broadcastRepo, handles.artifactRepo, now); err != nil {
			t.Fatalf("create broadcast for %s: %v", order.OrderNo, err)
		}
	}
	if _, err := service.SetOnline(7007, ProviderPresenceInput{
		Latitude:               22.5430,
		Longitude:              114.0580,
		AcceptedServiceClasses: []string{"light_heavy"},
		MaxRadiusKM:            10,
	}); err != nil {
		t.Fatalf("set online: %v", err)
	}

	views, err := service.ListOpenForProvider(7007, 50)
	if err != nil {
		t.Fatalf("list open broadcasts: %v", err)
	}
	if len(views) != 1 || views[0].Order.OrderNo != nearOrder.OrderNo {
		t.Fatalf("expected only nearby matching class order, got %#v", views)
	}
}

func TestConcurrentGrabAllowsOnlyOneProvider(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	order := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-CONCURRENT", "light_heavy", 22.5431, 114.0579, 168000)
	broadcast, err := service.CreateForOrder(order)
	if err != nil {
		t.Fatalf("create broadcast: %v", err)
	}

	for i := 0; i < 50; i++ {
		userID := int64(8000 + i)
		if _, err := service.SetOnline(userID, ProviderPresenceInput{
			Latitude:               22.5431,
			Longitude:              114.0579,
			AcceptedServiceClasses: []string{"light_heavy"},
			MaxRadiusKM:            30,
		}); err != nil {
			t.Fatalf("set online %d: %v", userID, err)
		}
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	successes := 0
	conflicts := 0
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, err := service.Grab(broadcast.ID, int64(8000+i))
			mu.Lock()
			defer mu.Unlock()
			if err == nil {
				successes++
				return
			}
			if errors.Is(err, ErrBroadcastConflict) || err != nil {
				conflicts++
			}
		}(i)
	}
	wg.Wait()

	if successes != 1 {
		t.Fatalf("expected exactly one successful grab, got successes=%d conflicts=%d", successes, conflicts)
	}
	updated, err := handles.broadcastRepo.GetByID(broadcast.ID)
	if err != nil {
		t.Fatalf("reload broadcast: %v", err)
	}
	if updated.Status != "grabbed" || updated.GrabbedByUserID == 0 {
		t.Fatalf("expected grabbed broadcast after concurrency test, got %#v", updated)
	}
}

func TestEnqueueDueReservationsMovesScheduledOrderIntoBroadcastPool(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	reservedAt := time.Now().Add(90 * time.Minute)
	order := &model.Order{
		OrderNo:              "WRJ-H3-RESERVATION",
		OrderType:            "cargo",
		OrderSource:          OrderModeReservation,
		OrderMode:            OrderModeReservation,
		ServiceClassCode:     "medium_heavy",
		ServiceType:          defaultDemandServiceType,
		CargoWeightKG:        120,
		StartTime:            reservedAt,
		EndTime:              reservedAt.Add(time.Hour),
		ReservedStartAt:      &reservedAt,
		ServiceLatitude:      22.5431,
		ServiceLongitude:     114.0579,
		TotalAmount:          188000,
		Status:               "scheduled",
		EstimatedDistanceM:   16000,
		EstimatedDurationMin: 42,
	}
	if err := handles.orderRepo.Create(order); err != nil {
		t.Fatalf("create reservation order: %v", err)
	}

	count, err := service.EnqueueDueReservations(time.Now(), 20)
	if err != nil {
		t.Fatalf("enqueue due reservations: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one reservation enqueued, got %d", count)
	}
	updated, err := handles.orderRepo.GetByID(order.ID)
	if err != nil {
		t.Fatalf("reload order: %v", err)
	}
	if updated.Status != "pending_dispatch" || updated.BroadcastPoolID == nil {
		t.Fatalf("expected reservation to enter broadcast pool, got %#v", updated)
	}
	broadcast, err := handles.broadcastRepo.GetByOrderID(order.ID)
	if err != nil {
		t.Fatalf("load broadcast: %v", err)
	}
	if broadcast.Status != "open" || broadcast.EstimatedTotalCents != order.TotalAmount {
		t.Fatalf("unexpected reservation broadcast: %#v", broadcast)
	}
}

func seedBroadcastOrder(t *testing.T, orderRepo *repository.OrderRepo, orderNo, serviceClass string, lat, lng float64, amount int64) *model.Order {
	t.Helper()
	now := time.Now().Add(30 * time.Minute)
	order := &model.Order{
		OrderNo:              orderNo,
		OrderType:            "cargo",
		OrderSource:          OrderModeInstant,
		OrderMode:            OrderModeInstant,
		ServiceClassCode:     serviceClass,
		ServiceType:          defaultDemandServiceType,
		CargoWeightKG:        80,
		StartTime:            now,
		EndTime:              now.Add(time.Hour),
		ServiceLatitude:      lat,
		ServiceLongitude:     lng,
		ServiceAddress:       "起点",
		DestAddress:          "终点",
		TotalAmount:          amount,
		PriceBreakdownJSON:   model.JSON(`{"source":"test"}`),
		Status:               "pending_dispatch",
		EstimatedDistanceM:   10000,
		EstimatedDurationMin: 30,
	}
	if err := orderRepo.Create(order); err != nil {
		t.Fatalf("create order %s: %v", orderNo, err)
	}
	return order
}
