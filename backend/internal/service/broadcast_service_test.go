package service

import (
	"errors"
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
	next, err := handles.assignmentRepo.GetActiveByBroadcast(broadcast.ID)
	if err != nil {
		t.Fatalf("load next assignment: %v", err)
	}
	if next.ProviderUserID != 7602 || next.AttemptSeq != 2 {
		t.Fatalf("expected provider 7602 attempt 2, got %#v", next)
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
	if stats.Rating != 4.5 || stats.CompletionRate != 1.0 {
		t.Fatalf("expected default rating/completion, got %#v", stats)
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
