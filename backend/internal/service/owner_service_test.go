package service

import (
	"testing"
	"time"

	"go.uber.org/zap"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

func TestOwnerServiceGetWorkbenchAggregatesRestartWorkbenchSlices(t *testing.T) {
	now := time.Now()
	db := newServiceTestDB(t,
		&model.User{},
		&model.OwnerProfile{},
		&model.Drone{},
		&model.Pilot{},
		&model.Demand{},
		&model.DemandQuote{},
		&model.DemandCandidatePilot{},
		&model.OwnerSupply{},
		&model.Order{},
	)

	userRepo := repository.NewUserRepo(db)
	droneRepo := repository.NewDroneRepo(db)
	pilotRepo := repository.NewPilotRepo(db)
	roleProfileRepo := repository.NewRoleProfileRepo(db)
	ownerDomainRepo := repository.NewOwnerDomainRepo(db)
	demandDomainRepo := repository.NewDemandDomainRepo(db)
	orderRepo := repository.NewOrderRepo(db)

	ownerService := NewOwnerService(userRepo, droneRepo, pilotRepo, roleProfileRepo, ownerDomainRepo, demandDomainRepo)
	orderService := NewOrderService(orderRepo, droneRepo, pilotRepo, nil, nil, nil, demandDomainRepo, ownerDomainRepo, nil, nil, zap.NewNop())
	ownerService.SetOrderService(orderService)

	ownerUser := &model.User{
		ID:       1001,
		Phone:    "13800000001",
		Nickname: "机主A",
		Status:   "active",
	}
	clientUser := &model.User{
		ID:       1002,
		Phone:    "13800000002",
		Nickname: "客户B",
		Status:   "active",
	}
	if err := db.Create(ownerUser).Error; err != nil {
		t.Fatalf("create owner user: %v", err)
	}
	if err := db.Create(clientUser).Error; err != nil {
		t.Fatalf("create client user: %v", err)
	}

	drone := &model.Drone{
		ID:                    2001,
		OwnerID:               ownerUser.ID,
		Brand:                 "DJI",
		Model:                 "FlyCart 30",
		SerialNumber:          "FC30-OWNER-01",
		MTOWKG:                180,
		MaxPayloadKG:          60,
		MaxDistance:           25,
		City:                  "佛山",
		AvailabilityStatus:    "available",
		CertificationStatus:   "approved",
		UOMVerified:           "verified",
		InsuranceVerified:     "verified",
		AirworthinessVerified: "verified",
	}
	if err := db.Create(drone).Error; err != nil {
		t.Fatalf("create drone: %v", err)
	}

	expiresAt := now.Add(24 * time.Hour)
	demand := &model.Demand{
		ID:                     3001,
		DemandNo:               "DMTEST0001",
		ClientUserID:           clientUser.ID,
		Title:                  "山区建材吊运",
		ServiceType:            "heavy_cargo_lift_transport",
		CargoScene:             "mountain_agriculture",
		ServiceAddressSnapshot: model.JSON(`{"text":"佛山市禅城区测试地址"}`),
		BudgetMin:              120000,
		BudgetMax:              180000,
		ExpiresAt:              &expiresAt,
		Status:                 "published",
		CreatedAt:              now.Add(-2 * time.Hour),
		UpdatedAt:              now.Add(-2 * time.Hour),
	}
	if err := db.Create(demand).Error; err != nil {
		t.Fatalf("create demand: %v", err)
	}

	quote := &model.DemandQuote{
		ID:          4001,
		QuoteNo:     "QTTEST0001",
		DemandID:    demand.ID,
		OwnerUserID: ownerUser.ID,
		DroneID:     drone.ID,
		PriceAmount: 150000,
		Status:      "submitted",
	}
	if err := db.Create(quote).Error; err != nil {
		t.Fatalf("create quote: %v", err)
	}

	candidate := &model.DemandCandidatePilot{
		ID:          5001,
		DemandID:    demand.ID,
		PilotUserID: 9001,
		Status:      "active",
	}
	if err := db.Create(candidate).Error; err != nil {
		t.Fatalf("create candidate: %v", err)
	}

	providerOrder := &model.Order{
		ID:               6001,
		OrderNo:          "ODTEST0001",
		OrderType:        "cargo",
		OrderSource:      "direct_market",
		DroneID:          drone.ID,
		OwnerID:          ownerUser.ID,
		RenterID:         clientUser.ID,
		ClientUserID:     clientUser.ID,
		ProviderUserID:   ownerUser.ID,
		DroneOwnerUserID: ownerUser.ID,
		Title:            "直达单待机主确认",
		ServiceAddress:   "佛山起点",
		DestAddress:      "佛山终点",
		TotalAmount:      88000,
		Status:           "pending_provider_confirmation",
		CreatedAt:        now.Add(-90 * time.Minute),
		UpdatedAt:        now.Add(-90 * time.Minute),
	}
	dispatchOrder := &model.Order{
		ID:               6002,
		OrderNo:          "ODTEST0002",
		OrderType:        "cargo",
		OrderSource:      "demand_market",
		DroneID:          drone.ID,
		OwnerID:          ownerUser.ID,
		RenterID:         clientUser.ID,
		ClientUserID:     clientUser.ID,
		ProviderUserID:   ownerUser.ID,
		DroneOwnerUserID: ownerUser.ID,
		Title:            "待安排执行",
		ServiceAddress:   "南海作业点",
		DestAddress:      "顺德交付点",
		TotalAmount:      128000,
		Status:           "pending_dispatch",
		CreatedAt:        now.Add(-45 * time.Minute),
		UpdatedAt:        now.Add(-45 * time.Minute),
	}
	if err := db.Create(providerOrder).Error; err != nil {
		t.Fatalf("create provider confirmation order: %v", err)
	}
	if err := db.Create(dispatchOrder).Error; err != nil {
		t.Fatalf("create pending dispatch order: %v", err)
	}

	draftSupply := &model.OwnerSupply{
		ID:                 7001,
		SupplyNo:           "SPTEST0001",
		OwnerUserID:        ownerUser.ID,
		DroneID:            drone.ID,
		Title:              "草稿供给",
		ServiceTypes:       model.JSON(`["heavy_cargo_lift_transport"]`),
		CargoScenes:        model.JSON(`["mountain_agriculture"]`),
		BasePriceAmount:    99000,
		PricingUnit:        "per_trip",
		AcceptsDirectOrder: true,
		Status:             "draft",
		CreatedAt:          now.Add(-30 * time.Minute),
		UpdatedAt:          now.Add(-30 * time.Minute),
	}
	if err := db.Create(draftSupply).Error; err != nil {
		t.Fatalf("create draft supply: %v", err)
	}

	workbench, err := ownerService.GetWorkbench(ownerUser.ID)
	if err != nil {
		t.Fatalf("get workbench: %v", err)
	}
	if workbench == nil {
		t.Fatal("expected workbench view")
	}

	if workbench.Summary.RecommendedDemandCount != 1 {
		t.Fatalf("expected 1 recommended demand, got %d", workbench.Summary.RecommendedDemandCount)
	}
	if workbench.Summary.PendingQuoteCount != 1 {
		t.Fatalf("expected 1 pending quote, got %d", workbench.Summary.PendingQuoteCount)
	}
	if workbench.Summary.PendingProviderConfirmationOrderCount != 1 {
		t.Fatalf("expected 1 pending provider confirmation order, got %d", workbench.Summary.PendingProviderConfirmationOrderCount)
	}
	if workbench.Summary.PendingDispatchOrderCount != 1 {
		t.Fatalf("expected 1 pending dispatch order, got %d", workbench.Summary.PendingDispatchOrderCount)
	}
	if workbench.Summary.DraftSupplyCount != 1 {
		t.Fatalf("expected 1 draft supply, got %d", workbench.Summary.DraftSupplyCount)
	}

	if len(workbench.RecommendedDemands) != 1 {
		t.Fatalf("expected 1 recommended demand item, got %d", len(workbench.RecommendedDemands))
	}
	if workbench.RecommendedDemands[0].QuoteCount != 1 {
		t.Fatalf("expected demand quote count 1, got %d", workbench.RecommendedDemands[0].QuoteCount)
	}
	if workbench.RecommendedDemands[0].CandidatePilotCount != 1 {
		t.Fatalf("expected candidate count 1, got %d", workbench.RecommendedDemands[0].CandidatePilotCount)
	}
	if workbench.RecommendedDemands[0].ServiceAddressText != "佛山市禅城区测试地址" {
		t.Fatalf("expected service address text to be preserved, got %q", workbench.RecommendedDemands[0].ServiceAddressText)
	}

	if len(workbench.PendingProviderConfirmationOrders) != 1 || workbench.PendingProviderConfirmationOrders[0].ID != providerOrder.ID {
		t.Fatalf("expected provider confirmation order %d in workbench", providerOrder.ID)
	}
	if len(workbench.PendingDispatchOrders) != 1 || workbench.PendingDispatchOrders[0].ID != dispatchOrder.ID {
		t.Fatalf("expected pending dispatch order %d in workbench", dispatchOrder.ID)
	}
	if len(workbench.DraftSupplies) != 1 {
		t.Fatalf("expected 1 draft supply item, got %d", len(workbench.DraftSupplies))
	}
	if workbench.DraftSupplies[0].DroneBrand != "DJI" || workbench.DraftSupplies[0].DroneModel != "FlyCart 30" {
		t.Fatalf("expected draft supply to preload drone summary, got %+v", workbench.DraftSupplies[0])
	}

	profile, err := roleProfileRepo.GetOwnerProfileByUserID(ownerUser.ID)
	if err != nil {
		t.Fatalf("expected owner profile to be auto-created: %v", err)
	}
	if profile.ContactPhone != ownerUser.Phone {
		t.Fatalf("expected owner contact phone %q, got %q", ownerUser.Phone, profile.ContactPhone)
	}
	if profile.ServiceCity != drone.City {
		t.Fatalf("expected owner service city %q, got %q", drone.City, profile.ServiceCity)
	}
}
