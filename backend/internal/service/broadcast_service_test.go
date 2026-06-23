package service

import (
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

func newBroadcastTestService(t *testing.T) (*BroadcastService, *gormDBHandles) {
	t.Helper()
	db := newServiceTestDB(
		t,
		&model.ProviderPresence{},
		&model.OrderBroadcast{},
		&model.OrderBroadcastExclusion{},
		&model.BroadcastAssignment{},
		&model.Order{},
		&model.OrderTimeline{},
		&model.OrderSnapshot{},
		&model.Review{},
		&model.SystemConfig{},
		&model.OrderSettlement{},
	)
	_ = db.Exec("PRAGMA busy_timeout = 5000").Error
	handles := &gormDBHandles{
		orderRepo:      repository.NewOrderRepo(db),
		presenceRepo:   repository.NewProviderPresenceRepo(db),
		broadcastRepo:  repository.NewOrderBroadcastRepo(db),
		assignmentRepo: repository.NewBroadcastAssignmentRepo(db),
		artifactRepo:   repository.NewOrderArtifactRepo(db),
		settlementRepo: repository.NewSettlementRepo(db),
	}
	return NewBroadcastService(handles.presenceRepo, handles.broadcastRepo, handles.assignmentRepo, handles.orderRepo, handles.artifactRepo, nil, zap.NewNop()), handles
}

type gormDBHandles struct {
	orderRepo      *repository.OrderRepo
	presenceRepo   *repository.ProviderPresenceRepo
	broadcastRepo  *repository.OrderBroadcastRepo
	assignmentRepo *repository.BroadcastAssignmentRepo
	artifactRepo   *repository.OrderArtifactRepo
	settlementRepo *repository.SettlementRepo
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

func TestBroadcastExclusionFiltersListAndGrab(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	order := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-EXCLUDE", "light_heavy", 22.5431, 114.0579, 168000)
	broadcast, err := service.CreateForOrder(order)
	if err != nil {
		t.Fatalf("create broadcast: %v", err)
	}
	if err := handles.broadcastRepo.ExcludeProvider(order.ID, broadcast.ID, 7007, "provider_cancel"); err != nil {
		t.Fatalf("exclude provider: %v", err)
	}
	seedProviderPresence(t, service, 7007, 22.5432, 114.0580, []string{"light_heavy"}, 20)
	seedProviderPresence(t, service, 7008, 22.5432, 114.0580, []string{"light_heavy"}, 20)

	views, err := service.ListOpenForProvider(7007, 20)
	if err != nil {
		t.Fatalf("list excluded provider broadcasts: %v", err)
	}
	if len(views) != 0 {
		t.Fatalf("expected excluded provider to see no broadcasts, got %#v", views)
	}
	if _, err := service.Grab(broadcast.ID, 7007); !errors.Is(err, ErrBroadcastConflict) || !errors.Is(err, ErrBroadcastPreviouslyCancelled) {
		t.Fatalf("expected excluded provider grab conflict, got %v", err)
	}

	views, err = service.ListOpenForProvider(7008, 20)
	if err != nil {
		t.Fatalf("list allowed provider broadcasts: %v", err)
	}
	if len(views) != 1 || views[0].Broadcast.ID != broadcast.ID {
		t.Fatalf("expected allowed provider to see broadcast %d, got %#v", broadcast.ID, views)
	}
	if _, err := service.Grab(broadcast.ID, 7008); err != nil {
		t.Fatalf("allowed provider grab: %v", err)
	}
}

func TestListPendingAssignmentsForProviderSkipsCancelledOrders(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	providerUserID := int64(7007)
	now := time.Now()

	activeOrder := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-ASSIGN-ACTIVE", "light_heavy", 22.5431, 114.0579, 168000)
	activeBroadcast := &model.OrderBroadcast{
		OrderID:             activeOrder.ID,
		OriginLatitude:      activeOrder.ServiceLatitude,
		OriginLongitude:     activeOrder.ServiceLongitude,
		ServiceClassCode:    activeOrder.ServiceClassCode,
		WeightKG:            activeOrder.CargoWeightKG,
		EstimatedTotalCents: activeOrder.TotalAmount,
		Status:              broadcastStatusAutoAssigning,
		ExpiresAt:           now.Add(-10 * time.Second),
	}
	if err := handles.broadcastRepo.Create(activeBroadcast); err != nil {
		t.Fatalf("create active broadcast: %v", err)
	}
	if err := handles.assignmentRepo.Create(&model.BroadcastAssignment{
		BroadcastID:      activeBroadcast.ID,
		OrderID:          activeOrder.ID,
		ProviderUserID:   providerUserID,
		AttemptSeq:       1,
		Status:           assignmentStatusPendingAccept,
		AcceptDeadlineAt: now.Add(time.Minute),
	}); err != nil {
		t.Fatalf("create active assignment: %v", err)
	}

	cancelledOrder := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-ASSIGN-CANCELLED", "light_heavy", 22.5431, 114.0579, 168000)
	if err := handles.orderRepo.UpdateFields(cancelledOrder.ID, map[string]interface{}{"status": "cancelled"}); err != nil {
		t.Fatalf("cancel order: %v", err)
	}
	cancelledBroadcast := &model.OrderBroadcast{
		OrderID:             cancelledOrder.ID,
		OriginLatitude:      cancelledOrder.ServiceLatitude,
		OriginLongitude:     cancelledOrder.ServiceLongitude,
		ServiceClassCode:    cancelledOrder.ServiceClassCode,
		WeightKG:            cancelledOrder.CargoWeightKG,
		EstimatedTotalCents: cancelledOrder.TotalAmount,
		Status:              broadcastStatusAutoAssigning,
		ExpiresAt:           now.Add(time.Minute),
	}
	if err := handles.broadcastRepo.Create(cancelledBroadcast); err != nil {
		t.Fatalf("create cancelled broadcast: %v", err)
	}
	if err := handles.assignmentRepo.Create(&model.BroadcastAssignment{
		BroadcastID:      cancelledBroadcast.ID,
		OrderID:          cancelledOrder.ID,
		ProviderUserID:   providerUserID,
		AttemptSeq:       1,
		Status:           assignmentStatusPendingAccept,
		AcceptDeadlineAt: now.Add(time.Minute),
	}); err != nil {
		t.Fatalf("create cancelled assignment: %v", err)
	}

	views, err := service.ListPendingAssignmentsForProvider(providerUserID, 10)
	if err != nil {
		t.Fatalf("list pending assignments: %v", err)
	}
	if len(views) != 1 || views[0].Order == nil || views[0].Order.ID != activeOrder.ID {
		t.Fatalf("expected only active order assignment, got %#v", views)
	}
}

func TestBroadcastGrabConflictReasonSentinels(t *testing.T) {
	tests := []struct {
		name  string
		setup func(t *testing.T, handles *gormDBHandles, order *model.Order, broadcast *model.OrderBroadcast)
		want  error
	}{
		{
			name: "locked by auto assignment",
			setup: func(t *testing.T, handles *gormDBHandles, _ *model.Order, broadcast *model.OrderBroadcast) {
				t.Helper()
				if err := handles.broadcastRepo.UpdateFields(broadcast.ID, map[string]interface{}{
					"status": broadcastStatusAutoAssigning,
				}); err != nil {
					t.Fatalf("set auto assigning: %v", err)
				}
			},
			want: ErrBroadcastLockedByAssign,
		},
		{
			name: "taken by other provider",
			setup: func(t *testing.T, handles *gormDBHandles, _ *model.Order, broadcast *model.OrderBroadcast) {
				t.Helper()
				now := time.Now()
				if err := handles.broadcastRepo.UpdateFields(broadcast.ID, map[string]interface{}{
					"status":             broadcastStatusGrabbed,
					"grabbed_by_user_id": int64(7999),
					"grabbed_at":         &now,
				}); err != nil {
					t.Fatalf("set grabbed: %v", err)
				}
			},
			want: ErrBroadcastTakenByOther,
		},
		{
			name: "order status invalid",
			setup: func(t *testing.T, handles *gormDBHandles, order *model.Order, _ *model.OrderBroadcast) {
				t.Helper()
				if err := handles.orderRepo.UpdateFields(order.ID, map[string]interface{}{
					"status": "assigned",
				}); err != nil {
					t.Fatalf("set order assigned: %v", err)
				}
			},
			want: ErrBroadcastStatusInvalid,
		},
		{
			name: "previously cancelled",
			setup: func(t *testing.T, handles *gormDBHandles, order *model.Order, broadcast *model.OrderBroadcast) {
				t.Helper()
				if err := handles.broadcastRepo.ExcludeProvider(order.ID, broadcast.ID, 7801, "provider_cancel"); err != nil {
					t.Fatalf("exclude provider: %v", err)
				}
			},
			want: ErrBroadcastPreviouslyCancelled,
		},
	}

	for idx, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service, handles := newBroadcastTestService(t)
			order := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-CONFLICT-REASON-"+string(rune('A'+idx)), "light_heavy", 22.5431, 114.0579, 168000)
			broadcast, err := service.CreateForOrder(order)
			if err != nil {
				t.Fatalf("create broadcast: %v", err)
			}
			seedProviderPresence(t, service, 7801, 22.5432, 114.0580, []string{"light_heavy"}, 20)
			tt.setup(t, handles, order, broadcast)

			_, err = service.Grab(broadcast.ID, 7801)
			if !errors.Is(err, ErrBroadcastConflict) {
				t.Fatalf("expected ErrBroadcastConflict, got %v", err)
			}
			if !errors.Is(err, tt.want) {
				t.Fatalf("expected reason %v, got %v", tt.want, err)
			}
		})
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
			if errors.Is(err, ErrBroadcastConflict) {
				conflicts++
				return
			}
			conflicts++
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

func TestAutoAssignPicksNearestEligibleProvider(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	order := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-AUTO-NEAR", "light_heavy", 22.5431, 114.0579, 168000)
	broadcast, err := service.CreateForOrder(order)
	if err != nil {
		t.Fatalf("create broadcast: %v", err)
	}
	seedProviderPresence(t, service, 7101, 22.5432, 114.0580, []string{"light_heavy"}, 30)
	seedProviderPresence(t, service, 7102, 22.5531, 114.0679, []string{"light_heavy"}, 30)
	seedProviderPresence(t, service, 7103, 22.6031, 114.1179, []string{"light_heavy"}, 30)

	if err := service.AttemptAutoAssign(broadcast.ID); err != nil {
		t.Fatalf("attempt auto assign: %v", err)
	}
	assignment, err := handles.assignmentRepo.GetActiveByBroadcast(broadcast.ID)
	if err != nil {
		t.Fatalf("load active assignment: %v", err)
	}
	if assignment.ProviderUserID != 7101 || assignment.AttemptSeq != 1 {
		t.Fatalf("expected nearest provider 7101 attempt 1, got %#v", assignment)
	}
	updated, err := handles.broadcastRepo.GetByID(broadcast.ID)
	if err != nil {
		t.Fatalf("reload broadcast: %v", err)
	}
	if updated.Status != broadcastStatusAutoAssigning {
		t.Fatalf("expected auto_assigning broadcast, got %s", updated.Status)
	}
	if updated.ExpiresAt.Before(assignment.AcceptDeadlineAt.Add(-time.Second)) || updated.ExpiresAt.After(assignment.AcceptDeadlineAt.Add(time.Second)) {
		t.Fatalf("expected broadcast deadline to follow assignment deadline, broadcast=%s assignment=%s", updated.ExpiresAt, assignment.AcceptDeadlineAt)
	}
}

func TestAutoAssignWindowKeepsBroadcastOpenDuringPublicCountdown(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	now := time.Now()
	order := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-AUTO-PUBLIC-WINDOW", "light_heavy", 22.5431, 114.0579, 168000)
	broadcast := &model.OrderBroadcast{
		OrderID:             order.ID,
		OriginLatitude:      order.ServiceLatitude,
		OriginLongitude:     order.ServiceLongitude,
		ServiceClassCode:    order.ServiceClassCode,
		WeightKG:            order.CargoWeightKG,
		EstimatedTotalCents: order.TotalAmount,
		Status:              broadcastStatusOpen,
		ExpiresAt:           now.Add(defaultBroadcastTTL),
		CreatedAt:           now,
		UpdatedAt:           now,
	}
	if err := handles.broadcastRepo.Create(broadcast); err != nil {
		t.Fatalf("create broadcast: %v", err)
	}

	fortyEightSecondsLater := now.Add(48 * time.Second)
	candidates, err := handles.broadcastRepo.ListAwaitingAutoAssign(
		fortyEightSecondsLater,
		fortyEightSecondsLater.Add(service.autoAssignTriggerLead()),
		20,
	)
	if err != nil {
		t.Fatalf("list auto assign candidates: %v", err)
	}
	if len(candidates) != 0 {
		t.Fatalf("expected public countdown to keep broadcast open after 48s, got %d candidates", len(candidates))
	}
}

func TestDispatchStateElapsedUsesLatestBroadcastWindow(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	now := time.Now()
	oldOrderCreatedAt := now.Add(-8 * time.Minute)
	latestBroadcastCreatedAt := now.Add(-15 * time.Second)
	order := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-DISPATCH-STATE-REDISPATCH", "light_heavy", 22.5431, 114.0579, 168000)
	if err := handles.orderRepo.UpdateFields(order.ID, map[string]interface{}{
		"created_at": oldOrderCreatedAt,
		"updated_at": oldOrderCreatedAt,
	}); err != nil {
		t.Fatalf("age order: %v", err)
	}
	order.CreatedAt = oldOrderCreatedAt
	oldBroadcast := &model.OrderBroadcast{
		OrderID:             order.ID,
		OriginLatitude:      order.ServiceLatitude,
		OriginLongitude:     order.ServiceLongitude,
		ServiceClassCode:    order.ServiceClassCode,
		WeightKG:            order.CargoWeightKG,
		EstimatedTotalCents: order.TotalAmount,
		Status:              broadcastStatusExpired,
		ExpiresAt:           now.Add(-time.Minute),
		CreatedAt:           oldOrderCreatedAt,
	}
	if err := handles.broadcastRepo.Create(oldBroadcast); err != nil {
		t.Fatalf("create old broadcast: %v", err)
	}
	latestBroadcast := &model.OrderBroadcast{
		OrderID:             order.ID,
		OriginLatitude:      order.ServiceLatitude,
		OriginLongitude:     order.ServiceLongitude,
		ServiceClassCode:    order.ServiceClassCode,
		WeightKG:            order.CargoWeightKG,
		EstimatedTotalCents: order.TotalAmount,
		Status:              broadcastStatusOpen,
		ExpiresAt:           now.Add(105 * time.Second),
		CreatedAt:           latestBroadcastCreatedAt,
	}
	if err := handles.broadcastRepo.Create(latestBroadcast); err != nil {
		t.Fatalf("create latest broadcast: %v", err)
	}

	state, err := service.GetDispatchState(order, now)
	if err != nil {
		t.Fatalf("get dispatch state: %v", err)
	}
	if state.ElapsedSeconds < 10 || state.ElapsedSeconds > 20 {
		t.Fatalf("expected elapsed from latest broadcast, got %d", state.ElapsedSeconds)
	}
	if state.EstimatedWaitSeconds < 100 || state.EstimatedWaitSeconds > 110 {
		t.Fatalf("expected wait from latest broadcast, got %d", state.EstimatedWaitSeconds)
	}
}

func TestBroadcastSchedulerTickUsesDefaultAndSystemConfig(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	config := NewSystemConfigService(handles.broadcastRepo.DB())
	service.SetSystemConfigService(config)

	if got := service.schedulerTick(); got != 15*time.Second {
		t.Fatalf("expected default scheduler tick 15s, got %s", got)
	}
	if _, err := config.Upsert("broadcast.scheduler.tick_seconds", "10", "test scheduler tick"); err != nil {
		t.Fatalf("upsert scheduler tick: %v", err)
	}
	if got := service.schedulerTick(); got != 10*time.Second {
		t.Fatalf("expected configured scheduler tick 10s, got %s", got)
	}
	if _, err := config.Upsert("broadcast.scheduler.tick_seconds", "-1", "invalid scheduler tick"); err != nil {
		t.Fatalf("upsert invalid scheduler tick: %v", err)
	}
	if got := service.schedulerTick(); got != 15*time.Second {
		t.Fatalf("expected invalid scheduler tick to fall back to 15s, got %s", got)
	}
}

func TestAutoAssignSkipsProviderWithMismatchedServiceClass(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	order := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-AUTO-CLASS", "light_heavy", 22.5431, 114.0579, 168000)
	broadcast, err := service.CreateForOrder(order)
	if err != nil {
		t.Fatalf("create broadcast: %v", err)
	}
	seedProviderPresence(t, service, 7201, 22.5432, 114.0580, []string{"medium_heavy"}, 30)
	seedProviderPresence(t, service, 7202, 22.5531, 114.0679, []string{"light_heavy"}, 30)

	if err := service.AttemptAutoAssign(broadcast.ID); err != nil {
		t.Fatalf("attempt auto assign: %v", err)
	}
	assignment, err := handles.assignmentRepo.GetActiveByBroadcast(broadcast.ID)
	if err != nil {
		t.Fatalf("load active assignment: %v", err)
	}
	if assignment.ProviderUserID != 7202 {
		t.Fatalf("expected matching provider 7202, got %#v", assignment)
	}
}

func TestAutoAssignAcceptCompletesGrab(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	order := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-AUTO-ACCEPT", "light_heavy", 22.5431, 114.0579, 168000)
	order.PriceBreakdownJSON = model.JSON(`{"total_estimated_cents":168000,"source":"h2"}`)
	if err := handles.orderRepo.UpdateFields(order.ID, map[string]interface{}{"price_breakdown_json": order.PriceBreakdownJSON}); err != nil {
		t.Fatalf("update price breakdown: %v", err)
	}
	broadcast, err := service.CreateForOrder(order)
	if err != nil {
		t.Fatalf("create broadcast: %v", err)
	}
	seedProviderPresence(t, service, 7301, 22.5432, 114.0580, []string{"light_heavy"}, 30)
	if err := service.AttemptAutoAssign(broadcast.ID); err != nil {
		t.Fatalf("attempt auto assign: %v", err)
	}
	assignment, err := handles.assignmentRepo.GetActiveByBroadcast(broadcast.ID)
	if err != nil {
		t.Fatalf("load active assignment: %v", err)
	}

	accepted, err := service.AcceptAssignment(assignment.ID, 7301)
	if err != nil {
		t.Fatalf("accept assignment: %v", err)
	}
	if accepted.Status != "assigned" || accepted.ProviderUserID != 7301 {
		t.Fatalf("expected assigned order for provider 7301, got %#v", accepted)
	}
	if accepted.TotalAmount != 168000 || string(accepted.PriceBreakdownJSON) != `{"total_estimated_cents":168000,"source":"h2"}` {
		t.Fatalf("auto assignment accept must not reprice, got amount=%d breakdown=%s", accepted.TotalAmount, string(accepted.PriceBreakdownJSON))
	}
	reloadedAssignment, err := handles.assignmentRepo.LockByID(assignment.ID)
	if err != nil {
		t.Fatalf("reload assignment: %v", err)
	}
	if reloadedAssignment.Status != assignmentStatusAccepted {
		t.Fatalf("expected accepted assignment, got %s", reloadedAssignment.Status)
	}
	updatedBroadcast, err := handles.broadcastRepo.GetByID(broadcast.ID)
	if err != nil {
		t.Fatalf("reload broadcast: %v", err)
	}
	if updatedBroadcast.Status != broadcastStatusGrabbed || updatedBroadcast.GrabbedByUserID != 7301 {
		t.Fatalf("expected grabbed broadcast, got %#v", updatedBroadcast)
	}
}

func TestAutoAssignDeclineTriggersNextAttempt(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	order := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-AUTO-DECLINE", "light_heavy", 22.5431, 114.0579, 168000)
	broadcast, err := service.CreateForOrder(order)
	if err != nil {
		t.Fatalf("create broadcast: %v", err)
	}
	seedProviderPresence(t, service, 7401, 22.5432, 114.0580, []string{"light_heavy"}, 30)
	seedProviderPresence(t, service, 7402, 22.5531, 114.0679, []string{"light_heavy"}, 30)
	if err := service.AttemptAutoAssign(broadcast.ID); err != nil {
		t.Fatalf("attempt auto assign: %v", err)
	}
	first, err := handles.assignmentRepo.GetActiveByBroadcast(broadcast.ID)
	if err != nil {
		t.Fatalf("load first assignment: %v", err)
	}
	if first.ProviderUserID != 7401 {
		t.Fatalf("expected first provider 7401, got %#v", first)
	}

	if err := service.DeclineAssignment(first.ID, 7401, "暂不方便承接"); err != nil {
		t.Fatalf("decline assignment: %v", err)
	}
	excluded, err := handles.broadcastRepo.IsProviderExcluded(order.ID, broadcast.ID, 7401)
	if err != nil {
		t.Fatalf("check declined provider exclusion: %v", err)
	}
	if !excluded {
		t.Fatalf("expected declined provider 7401 to be excluded from order %d", order.ID)
	}
	var declineExclusion model.OrderBroadcastExclusion
	if err := handles.broadcastRepo.DB().
		Where("order_id = ? AND provider_user_id = ?", order.ID, 7401).
		First(&declineExclusion).Error; err != nil {
		t.Fatalf("load decline exclusion: %v", err)
	}
	if declineExclusion.ExpiresAt != nil {
		t.Fatalf("expected decline exclusion to be permanent, got expires_at=%v", declineExclusion.ExpiresAt)
	}
	second, err := handles.assignmentRepo.GetActiveByBroadcast(broadcast.ID)
	if err != nil {
		t.Fatalf("load second assignment: %v", err)
	}
	if second.ProviderUserID != 7402 || second.AttemptSeq != 2 {
		t.Fatalf("expected second provider 7402 attempt 2, got %#v", second)
	}
}

func TestAutoAssignExpiresAfterMaxAttempts(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	order := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-AUTO-MAX", "light_heavy", 22.5431, 114.0579, 168000)
	broadcast, err := service.CreateForOrder(order)
	if err != nil {
		t.Fatalf("create broadcast: %v", err)
	}
	seedProviderPresence(t, service, 7501, 22.5432, 114.0580, []string{"light_heavy"}, 30)
	seedProviderPresence(t, service, 7502, 22.5531, 114.0679, []string{"light_heavy"}, 30)
	seedProviderPresence(t, service, 7503, 22.5631, 114.0779, []string{"light_heavy"}, 30)

	for _, providerUserID := range []int64{7501, 7502, 7503} {
		if err := service.AttemptAutoAssign(broadcast.ID); err != nil {
			t.Fatalf("attempt auto assign before decline %d: %v", providerUserID, err)
		}
		assignment, err := handles.assignmentRepo.GetActiveByBroadcast(broadcast.ID)
		if err != nil {
			t.Fatalf("load assignment for provider %d: %v", providerUserID, err)
		}
		if assignment.ProviderUserID != providerUserID {
			t.Fatalf("expected provider %d, got %#v", providerUserID, assignment)
		}
		if err := service.DeclineAssignment(assignment.ID, providerUserID, "拒绝"); err != nil {
			t.Fatalf("decline provider %d: %v", providerUserID, err)
		}
	}

	updated, err := handles.broadcastRepo.GetByID(broadcast.ID)
	if err != nil {
		t.Fatalf("reload broadcast: %v", err)
	}
	if updated.Status != broadcastStatusExpired {
		t.Fatalf("expected expired broadcast after max attempts, got %s", updated.Status)
	}
	var updatedOrder model.Order
	if err := handles.orderRepo.DB().First(&updatedOrder, order.ID).Error; err != nil {
		t.Fatalf("reload order: %v", err)
	}
	if updatedOrder.Status != "dispatch_failed" {
		t.Fatalf("expected order dispatch_failed after max attempts, got %s", updatedOrder.Status)
	}
	attempts, err := handles.assignmentRepo.ListAttempts(broadcast.ID)
	if err != nil {
		t.Fatalf("list attempts: %v", err)
	}
	if len(attempts) != defaultAutoAssignMaxAttempts {
		t.Fatalf("expected %d attempts, got %d", defaultAutoAssignMaxAttempts, len(attempts))
	}
	if attempts[len(attempts)-1].Status != assignmentStatusDeclined {
		t.Fatalf("expected last assignment declined, got %s", attempts[len(attempts)-1].Status)
	}
}

func TestAutoAssignAcceptDeadlinePassedTransitionsToExpiredAssignment(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	now := time.Now()
	order := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-AUTO-EXPIRE", "light_heavy", 22.5431, 114.0579, 168000)
	broadcast, err := service.CreateForOrder(order)
	if err != nil {
		t.Fatalf("create broadcast: %v", err)
	}
	seedProviderPresence(t, service, 7601, 22.5432, 114.0580, []string{"light_heavy"}, 30)
	seedProviderPresence(t, service, 7602, 22.5531, 114.0679, []string{"light_heavy"}, 30)
	assignment := &model.BroadcastAssignment{
		BroadcastID:      broadcast.ID,
		OrderID:          order.ID,
		ProviderUserID:   7601,
		AttemptSeq:       1,
		Status:           assignmentStatusPendingAccept,
		AcceptDeadlineAt: now.Add(-time.Second),
	}
	if err := handles.assignmentRepo.Create(assignment); err != nil {
		t.Fatalf("create overdue assignment: %v", err)
	}
	if err := handles.broadcastRepo.UpdateFields(broadcast.ID, map[string]interface{}{
		"status": broadcastStatusAutoAssigning,
	}); err != nil {
		t.Fatalf("set auto assigning: %v", err)
	}

	count, err := service.ExpireOverdueAssignments(now, 20)
	if err != nil {
		t.Fatalf("expire overdue assignments: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one expired assignment, got %d", count)
	}
	expired, err := handles.assignmentRepo.LockByID(assignment.ID)
	if err != nil {
		t.Fatalf("reload expired assignment: %v", err)
	}
	if expired.Status != assignmentStatusExpired {
		t.Fatalf("expected expired assignment, got %s", expired.Status)
	}
	excluded, err := handles.broadcastRepo.IsProviderExcluded(order.ID, broadcast.ID, 7601)
	if err != nil {
		t.Fatalf("check timeout provider exclusion: %v", err)
	}
	if !excluded {
		t.Fatalf("expected timed-out provider 7601 to be excluded from broadcast %d", broadcast.ID)
	}
	var timeoutExclusion model.OrderBroadcastExclusion
	if err := handles.broadcastRepo.DB().
		Where("order_id = ? AND provider_user_id = ?", order.ID, 7601).
		First(&timeoutExclusion).Error; err != nil {
		t.Fatalf("load timeout exclusion: %v", err)
	}
	if timeoutExclusion.ExpiresAt == nil || !timeoutExclusion.ExpiresAt.After(now.Add(2*service.autoAssignAcceptWindow())) {
		t.Fatalf("expected timeout exclusion to have short expiry, got %#v", timeoutExclusion.ExpiresAt)
	}
	next, err := handles.assignmentRepo.GetActiveByBroadcast(broadcast.ID)
	if err != nil {
		t.Fatalf("load next assignment: %v", err)
	}
	if next.ProviderUserID != 7602 || next.AttemptSeq != 2 {
		t.Fatalf("expected provider 7602 attempt 2, got %#v", next)
	}
}

func TestBroadcastExclusionTimeoutExpiresAndDeclinePersists(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	order := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-EXCLUSION-TTL", "light_heavy", 22.5431, 114.0579, 168000)
	broadcast, err := service.CreateForOrder(order)
	if err != nil {
		t.Fatalf("create broadcast: %v", err)
	}

	timeoutExpiresAt := time.Now().Add(time.Minute)
	if err := handles.broadcastRepo.ExcludeProvider(order.ID, broadcast.ID, 7701, "assignment_timeout", &timeoutExpiresAt); err != nil {
		t.Fatalf("exclude timed-out provider: %v", err)
	}
	excluded, err := handles.broadcastRepo.IsProviderExcluded(order.ID, broadcast.ID, 7701)
	if err != nil {
		t.Fatalf("check active timeout exclusion: %v", err)
	}
	if !excluded {
		t.Fatalf("expected timeout exclusion to match before expiry")
	}

	expiredAt := time.Now().Add(-time.Minute)
	if err := handles.broadcastRepo.DB().
		Model(&model.OrderBroadcastExclusion{}).
		Where("order_id = ? AND provider_user_id = ?", order.ID, 7701).
		Update("expires_at", &expiredAt).Error; err != nil {
		t.Fatalf("expire timeout exclusion: %v", err)
	}
	excluded, err = handles.broadcastRepo.IsProviderExcluded(order.ID, broadcast.ID, 7701)
	if err != nil {
		t.Fatalf("check expired timeout exclusion: %v", err)
	}
	if excluded {
		t.Fatalf("expected timeout exclusion to stop matching after expiry")
	}

	if err := handles.broadcastRepo.ExcludeProvider(order.ID, broadcast.ID, 7702, "assignment_declined"); err != nil {
		t.Fatalf("exclude declined provider: %v", err)
	}
	excluded, err = handles.broadcastRepo.IsProviderExcluded(order.ID, broadcast.ID, 7702)
	if err != nil {
		t.Fatalf("check permanent decline exclusion: %v", err)
	}
	if !excluded {
		t.Fatalf("expected decline exclusion to keep matching")
	}
}

func TestAutoAssignTimeoutExclusionIsBroadcastScoped(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	order := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-EXCLUSION-SCOPE", "light_heavy", 22.5431, 114.0579, 168000)
	broadcast, err := service.CreateForOrder(order)
	if err != nil {
		t.Fatalf("create broadcast: %v", err)
	}
	seedProviderPresence(t, service, 7703, 22.5432, 114.0580, []string{"light_heavy"}, 30)

	timeoutExpiresAt := time.Now().Add(time.Minute)
	if err := handles.broadcastRepo.ExcludeProvider(order.ID, broadcast.ID, 7703, "assignment_timeout", &timeoutExpiresAt); err != nil {
		t.Fatalf("exclude timed-out provider: %v", err)
	}
	if _, ok, err := service.selectAutoAssignCandidate(broadcast, order, map[int64]struct{}{}, time.Now(), handles.broadcastRepo); err != nil {
		t.Fatalf("select candidate for timed-out broadcast: %v", err)
	} else if ok {
		t.Fatalf("expected timeout exclusion to block the original broadcast")
	}

	nextBroadcast := *broadcast
	nextBroadcast.ID = broadcast.ID + 1000
	candidate, ok, err := service.selectAutoAssignCandidate(&nextBroadcast, order, map[int64]struct{}{}, time.Now(), handles.broadcastRepo)
	if err != nil {
		t.Fatalf("select candidate for next broadcast: %v", err)
	}
	if !ok || candidate.presence.UserID != 7703 {
		t.Fatalf("expected provider 7703 to be eligible for next broadcast, got ok=%v candidate=%#v", ok, candidate)
	}

	if err := handles.broadcastRepo.ExcludeProvider(order.ID, nextBroadcast.ID, 7703, "assignment_declined"); err != nil {
		t.Fatalf("exclude declined provider: %v", err)
	}
	if _, ok, err := service.selectAutoAssignCandidate(&nextBroadcast, order, map[int64]struct{}{}, time.Now(), handles.broadcastRepo); err != nil {
		t.Fatalf("select candidate after decline: %v", err)
	} else if ok {
		t.Fatalf("expected permanent decline exclusion to block follow-up broadcasts")
	}
}

func TestRedispatchOrderClearsPreviousRoundExclusionsAndCreatesNewBroadcast(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	order := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-REDISPATCH", "light_heavy", 22.5431, 114.0579, 168000)
	order.PriceBreakdownJSON = model.JSON(`{"source":"test","matching_radius_km":30,"total_estimated_cents":168000}`)
	if err := handles.orderRepo.UpdateFields(order.ID, map[string]interface{}{
		"price_breakdown_json": order.PriceBreakdownJSON,
	}); err != nil {
		t.Fatalf("update price breakdown: %v", err)
	}
	oldBroadcast, err := service.CreateForOrder(order)
	if err != nil {
		t.Fatalf("create original broadcast: %v", err)
	}
	timeoutProviderID := int64(7801)
	declinedProviderID := int64(7802)
	seedProviderPresence(t, service, timeoutProviderID, 22.8581, 114.0579, []string{"light_heavy"}, 60)
	seedProviderPresence(t, service, declinedProviderID, 22.5432, 114.0580, []string{"light_heavy"}, 60)

	timeoutExpiresAt := time.Now().Add(time.Minute)
	if err := handles.broadcastRepo.ExcludeProvider(order.ID, oldBroadcast.ID, timeoutProviderID, "assignment_timeout", &timeoutExpiresAt); err != nil {
		t.Fatalf("exclude timeout provider: %v", err)
	}
	if err := handles.broadcastRepo.ExcludeProvider(order.ID, oldBroadcast.ID, declinedProviderID, "assignment_declined"); err != nil {
		t.Fatalf("exclude declined provider: %v", err)
	}
	if err := handles.broadcastRepo.UpdateFields(oldBroadcast.ID, map[string]interface{}{"status": broadcastStatusExpired}); err != nil {
		t.Fatalf("expire original broadcast: %v", err)
	}
	if err := handles.orderRepo.UpdateFields(order.ID, map[string]interface{}{"status": "dispatch_failed"}); err != nil {
		t.Fatalf("mark dispatch failed: %v", err)
	}
	order.Status = "dispatch_failed"

	result, err := service.RedispatchOrder(order.ID, RedispatchOrderOptions{
		PriceBumpPercent: 10,
		RadiusBumpKM:     10,
	})
	if err != nil {
		t.Fatalf("redispatch order: %v", err)
	}
	if result.Broadcast.ID == oldBroadcast.ID {
		t.Fatalf("expected redispatch to create a new broadcast row")
	}
	if result.Broadcast.Status != broadcastStatusOpen || result.Broadcast.EstimatedTotalCents != 184800 {
		t.Fatalf("unexpected redispatch broadcast: %#v", result.Broadcast)
	}
	if result.Order.Status != "pending_dispatch" || result.Order.TotalAmount != 184800 {
		t.Fatalf("expected order to return pending_dispatch with bumped price, got status=%s amount=%d", result.Order.Status, result.Order.TotalAmount)
	}
	if result.MatchingRadiusKM != 40 {
		t.Fatalf("expected matching radius 40km, got %.1f", result.MatchingRadiusKM)
	}

	var timeoutCount int64
	if err := handles.broadcastRepo.DB().Model(&model.OrderBroadcastExclusion{}).
		Where("order_id = ? AND reason = ?", order.ID, "assignment_timeout").
		Count(&timeoutCount).Error; err != nil {
		t.Fatalf("count timeout exclusions: %v", err)
	}
	if timeoutCount != 0 {
		t.Fatalf("expected timeout exclusions to be cleared, got %d", timeoutCount)
	}
	declinedExcluded, err := handles.broadcastRepo.IsProviderExcluded(order.ID, result.Broadcast.ID, declinedProviderID)
	if err != nil {
		t.Fatalf("check declined exclusion: %v", err)
	}
	if declinedExcluded {
		t.Fatalf("expected declined provider to be eligible after redispatch")
	}
	timeoutExcluded, err := handles.broadcastRepo.IsProviderExcluded(order.ID, result.Broadcast.ID, timeoutProviderID)
	if err != nil {
		t.Fatalf("check timeout exclusion: %v", err)
	}
	if timeoutExcluded {
		t.Fatalf("expected timed-out provider to be eligible after redispatch")
	}
	views, err := service.ListOpenForProvider(declinedProviderID, 20)
	if err != nil {
		t.Fatalf("list redispatch broadcast for declined provider: %v", err)
	}
	if len(views) != 1 || views[0].Broadcast.ID != result.Broadcast.ID {
		t.Fatalf("expected declined provider to see redispatch broadcast %d, got %#v", result.Broadcast.ID, views)
	}

	candidate, ok, err := service.selectAutoAssignCandidate(result.Broadcast, result.Order, map[int64]struct{}{}, time.Now(), handles.broadcastRepo)
	if err != nil {
		t.Fatalf("select redispatch candidate: %v", err)
	}
	if !ok || candidate.presence.UserID != declinedProviderID {
		t.Fatalf("expected declined provider to be eligible for redispatch after price/radius bump, got ok=%v candidate=%#v", ok, candidate)
	}
}

func TestRedispatchOrderRejectsNonDispatchFailedStatus(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	order := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-REDISPATCH-BAD-STATE", "light_heavy", 22.5431, 114.0579, 168000)

	_, err := service.RedispatchOrder(order.ID, RedispatchOrderOptions{PriceBumpPercent: 10})
	if !errors.Is(err, ErrBroadcastConflict) || !errors.Is(err, ErrBroadcastStatusInvalid) {
		t.Fatalf("expected status invalid broadcast conflict, got %v", err)
	}
}

func TestRedispatchOrderCountAccumulatesAndCapsFourthAttempt(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	config := NewSystemConfigService(handles.orderRepo.DB())
	service.SetSystemConfigService(config)
	if _, err := config.Upsert("broadcast.redispatch.cooldown_seconds", "0", "disable cooldown for count test"); err != nil {
		t.Fatalf("set cooldown config: %v", err)
	}
	order := seedRedispatchableOrder(t, handles.orderRepo, "WRJ-H3-REDISPATCH-COUNT", 100000, `{"matching_radius_km":30}`)

	for want := 1; want <= defaultRedispatchMaxCountPerOrder; want++ {
		if _, err := service.RedispatchOrder(order.ID, RedispatchOrderOptions{PriceBumpPercent: 10}); err != nil {
			t.Fatalf("redispatch attempt %d: %v", want, err)
		}
		if got := redispatchCountForOrder(t, handles.orderRepo, order.ID); got != want {
			t.Fatalf("expected redispatch_count=%d, got %d", want, got)
		}
		markOrderDispatchFailed(t, handles.orderRepo, order.ID)
	}

	_, err := service.RedispatchOrder(order.ID, RedispatchOrderOptions{PriceBumpPercent: 10})
	if !errors.Is(err, ErrBroadcastConflict) || !errors.Is(err, ErrRedispatchCapped) {
		t.Fatalf("expected capped broadcast conflict on fourth attempt, got %v", err)
	}
}

func TestRedispatchOrderCooldownRateLimitsAndAllowsAfterWindow(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	order := seedRedispatchableOrder(
		t,
		handles.orderRepo,
		"WRJ-H3-REDISPATCH-COOLDOWN",
		100000,
		`{"matching_radius_km":30,"redispatch_count":1,"redispatch_last_at":"`+time.Now().Format(time.RFC3339)+`"}`,
	)

	_, err := service.RedispatchOrder(order.ID, RedispatchOrderOptions{RadiusBumpKM: 10})
	if !errors.Is(err, ErrBroadcastConflict) || !errors.Is(err, ErrRedispatchRateLimited) {
		t.Fatalf("expected rate limited broadcast conflict, got %v", err)
	}
	if !strings.Contains(err.Error(), "秒后再试") {
		t.Fatalf("expected remaining seconds in rate limit message, got %v", err)
	}
	if got := redispatchCountForOrder(t, handles.orderRepo, order.ID); got != 1 {
		t.Fatalf("rate-limited attempt must not increment count, got %d", got)
	}

	oldLastAt := time.Now().Add(-2 * time.Minute).Format(time.RFC3339)
	if err := handles.orderRepo.UpdateFields(order.ID, map[string]interface{}{
		"price_breakdown_json": model.JSON(`{"matching_radius_km":30,"redispatch_count":1,"redispatch_last_at":"` + oldLastAt + `"}`),
	}); err != nil {
		t.Fatalf("move last redispatch time back: %v", err)
	}
	if _, err := service.RedispatchOrder(order.ID, RedispatchOrderOptions{RadiusBumpKM: 10}); err != nil {
		t.Fatalf("redispatch after cooldown: %v", err)
	}
	if got := redispatchCountForOrder(t, handles.orderRepo, order.ID); got != 2 {
		t.Fatalf("expected count to increment after cooldown, got %d", got)
	}
}

func TestRedispatchOrderMaxCountZeroDisablesCap(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	config := NewSystemConfigService(handles.orderRepo.DB())
	service.SetSystemConfigService(config)
	if _, err := config.Upsert("broadcast.redispatch.max_count_per_order", "0", "disable max count for test"); err != nil {
		t.Fatalf("set max count config: %v", err)
	}
	if _, err := config.Upsert("broadcast.redispatch.cooldown_seconds", "0", "disable cooldown for test"); err != nil {
		t.Fatalf("set cooldown config: %v", err)
	}
	order := seedRedispatchableOrder(t, handles.orderRepo, "WRJ-H3-REDISPATCH-NO-CAP", 100000, `{"matching_radius_km":30,"redispatch_count":99}`)

	if _, err := service.RedispatchOrder(order.ID, RedispatchOrderOptions{PriceBumpPercent: 10}); err != nil {
		t.Fatalf("redispatch with max_count=0: %v", err)
	}
	if got := redispatchCountForOrder(t, handles.orderRepo, order.ID); got != 100 {
		t.Fatalf("expected redispatch_count to continue from 99 to 100, got %d", got)
	}
}

func TestAutoAssignRespectsDisabledConfig(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	service.SetSystemConfigService(NewSystemConfigService(handles.orderRepo.DB()))
	if err := handles.orderRepo.DB().Create(&model.SystemConfig{
		ConfigKey:   "broadcast.auto_assign.enabled",
		ConfigValue: "false",
		Description: "test disabled auto assign",
	}).Error; err != nil {
		t.Fatalf("create system config: %v", err)
	}
	if service.shouldAutoAssign() {
		t.Fatalf("expected disabled auto assign config")
	}

	order := seedBroadcastOrder(t, handles.orderRepo, "WRJ-H3-AUTO-DISABLED", "light_heavy", 22.5431, 114.0579, 168000)
	broadcast, err := service.CreateForOrder(order)
	if err != nil {
		t.Fatalf("create broadcast: %v", err)
	}
	seedProviderPresence(t, service, 7701, 22.5432, 114.0580, []string{"light_heavy"}, 30)
	if err := service.AttemptAutoAssign(broadcast.ID); err != nil {
		t.Fatalf("attempt auto assign disabled: %v", err)
	}
	if _, err := handles.assignmentRepo.GetActiveByBroadcast(broadcast.ID); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected no active assignment when disabled, got err=%v", err)
	}
}

func TestGetProviderStatsAggregates(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	providerUserID := int64(7007)
	now := time.Now()
	todayCompletedAt := time.Date(now.Year(), now.Month(), now.Day(), 9, 0, 0, 0, now.Location())
	historyCompletedAt := todayCompletedAt.AddDate(0, 0, -2)
	orders := []*model.Order{
		{
			OrderNo:        "WRJ-H8-STATS-001",
			OrderType:      "cargo",
			OrderSource:    OrderModeInstant,
			OrderMode:      OrderModeInstant,
			ServiceType:    defaultDemandServiceType,
			ProviderUserID: providerUserID,
			Status:         "completed",
			TotalAmount:    5200,
			CompletedAt:    &todayCompletedAt,
		},
		{
			OrderNo:        "WRJ-H8-STATS-002",
			OrderType:      "cargo",
			OrderSource:    OrderModeInstant,
			OrderMode:      OrderModeInstant,
			ServiceType:    defaultDemandServiceType,
			ProviderUserID: providerUserID,
			Status:         "completed",
			TotalAmount:    7300,
			CompletedAt:    &todayCompletedAt,
		},
		{
			OrderNo:        "WRJ-H8-STATS-003",
			OrderType:      "cargo",
			OrderSource:    OrderModeInstant,
			OrderMode:      OrderModeInstant,
			ServiceType:    defaultDemandServiceType,
			ProviderUserID: providerUserID,
			Status:         "completed",
			TotalAmount:    9900,
			CompletedAt:    &historyCompletedAt,
		},
	}
	for _, order := range orders {
		if err := handles.orderRepo.Create(order); err != nil {
			t.Fatalf("create stats order %s: %v", order.OrderNo, err)
		}
	}

	stats := service.GetProviderStats(providerUserID)
	if stats.TodayOrderCount != 2 {
		t.Fatalf("expected today_order_count=2, got %d", stats.TodayOrderCount)
	}
	if stats.TodayIncomeCents != 12500 {
		t.Fatalf("expected today_income_cents=12500, got %d", stats.TodayIncomeCents)
	}
	if stats.TotalCompletedOrders != 3 {
		t.Fatalf("expected total_completed_orders=3, got %d", stats.TotalCompletedOrders)
	}
	if stats.Rating != nil || stats.CompletionRate != nil {
		t.Fatalf("expected empty rating/completion without user service, got %#v", stats)
	}
}

func TestGetProviderStatsIncludesPendingSettlement(t *testing.T) {
	service, handles := newBroadcastTestService(t)
	providerUserID := int64(7007)
	service.SetSettlementService(NewSettlementService(handles.settlementRepo, handles.orderRepo, zap.NewNop()))

	settlements := []*model.OrderSettlement{
		{
			SettlementNo: "SET-H8-PENDING-001",
			OrderID:      9001,
			OrderNo:      "WRJ-H8-PENDING-001",
			PilotUserID:  providerUserID,
			PilotFee:     5000,
			Status:       "pending",
		},
		{
			SettlementNo: "SET-H8-SETTLED-001",
			OrderID:      9002,
			OrderNo:      "WRJ-H8-SETTLED-001",
			PilotUserID:  providerUserID,
			PilotFee:     3000,
			Status:       "settled",
		},
	}
	for _, settlement := range settlements {
		if err := handles.settlementRepo.CreateSettlement(settlement); err != nil {
			t.Fatalf("create settlement %s: %v", settlement.SettlementNo, err)
		}
	}

	stats := service.GetProviderStats(providerUserID)
	if stats.PendingSettlementCents != 5000 {
		t.Fatalf("expected pending_settlement_cents=5000, got %d", stats.PendingSettlementCents)
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

func seedRedispatchableOrder(t *testing.T, orderRepo *repository.OrderRepo, orderNo string, amount int64, priceBreakdownJSON string) *model.Order {
	t.Helper()
	order := seedBroadcastOrder(t, orderRepo, orderNo, "light_heavy", 22.5431, 114.0579, amount)
	if strings.TrimSpace(priceBreakdownJSON) == "" {
		priceBreakdownJSON = `{"matching_radius_km":30}`
	}
	if err := orderRepo.UpdateFields(order.ID, map[string]interface{}{
		"status":               "dispatch_failed",
		"price_breakdown_json": model.JSON(priceBreakdownJSON),
	}); err != nil {
		t.Fatalf("make order redispatchable: %v", err)
	}
	order.Status = "dispatch_failed"
	order.PriceBreakdownJSON = model.JSON(priceBreakdownJSON)
	return order
}

func markOrderDispatchFailed(t *testing.T, orderRepo *repository.OrderRepo, orderID int64) {
	t.Helper()
	if err := orderRepo.UpdateFields(orderID, map[string]interface{}{"status": "dispatch_failed"}); err != nil {
		t.Fatalf("mark order dispatch_failed: %v", err)
	}
}

func redispatchCountForOrder(t *testing.T, orderRepo *repository.OrderRepo, orderID int64) int {
	t.Helper()
	order, err := orderRepo.GetByID(orderID)
	if err != nil {
		t.Fatalf("reload order: %v", err)
	}
	return readRedispatchMeta(order).count
}

func seedProviderPresence(t *testing.T, service *BroadcastService, userID int64, lat, lng float64, serviceClasses []string, radiusKM float64) {
	t.Helper()
	if _, err := service.SetOnline(userID, ProviderPresenceInput{
		Latitude:               lat,
		Longitude:              lng,
		AcceptedServiceClasses: serviceClasses,
		MaxRadiusKM:            radiusKM,
	}); err != nil {
		t.Fatalf("set provider %d online: %v", userID, err)
	}
}
