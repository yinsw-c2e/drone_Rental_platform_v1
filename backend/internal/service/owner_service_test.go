package service

import (
	"strings"
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

func TestOwnerServiceFormalProviderOperationsRequireApprovedAssetProvider(t *testing.T) {
	db := newServiceTestDB(t,
		&model.User{},
		&model.OwnerProfile{},
		&model.Drone{},
		&model.Pilot{},
		&model.Demand{},
		&model.DemandQuote{},
		&model.OwnerSupply{},
		&model.OwnerPilotBinding{},
	)

	userRepo := repository.NewUserRepo(db)
	droneRepo := repository.NewDroneRepo(db)
	pilotRepo := repository.NewPilotRepo(db)
	roleProfileRepo := repository.NewRoleProfileRepo(db)
	ownerDomainRepo := repository.NewOwnerDomainRepo(db)
	demandDomainRepo := repository.NewDemandDomainRepo(db)
	ownerService := NewOwnerService(userRepo, droneRepo, pilotRepo, roleProfileRepo, ownerDomainRepo, demandDomainRepo)

	pendingProvider := &model.User{ID: 1201, Phone: "13800001201", Nickname: "待审核服务商", Status: "active"}
	executorUser := &model.User{ID: 1202, Phone: "13800001202", Nickname: "执行人员", Status: "active"}
	if err := db.Create(pendingProvider).Error; err != nil {
		t.Fatalf("create pending provider: %v", err)
	}
	if err := db.Create(executorUser).Error; err != nil {
		t.Fatalf("create executor user: %v", err)
	}
	if err := db.Create(&model.OwnerProfile{
		ID:                 1301,
		UserID:             pendingProvider.ID,
		VerificationStatus: "pending",
		Status:             "active",
	}).Error; err != nil {
		t.Fatalf("create owner profile: %v", err)
	}
	if err := db.Create(&model.Pilot{
		ID:                 1401,
		UserID:             executorUser.ID,
		VerificationStatus: "verified",
		AvailabilityStatus: "online",
	}).Error; err != nil {
		t.Fatalf("create executor profile: %v", err)
	}
	if err := db.Create(&model.Drone{
		ID:                    1501,
		OwnerID:               pendingProvider.ID,
		Brand:                 "DJI",
		Model:                 "Pending",
		SerialNumber:          "PENDING-DRONE-01",
		CertificationStatus:   "pending",
		UOMVerified:           "pending",
		InsuranceVerified:     "pending",
		AirworthinessVerified: "pending",
		AvailabilityStatus:    "available",
	}).Error; err != nil {
		t.Fatalf("create pending drone: %v", err)
	}
	if err := db.Create(&model.OwnerSupply{
		ID:              1601,
		SupplyNo:        "SPPENDING0001",
		OwnerUserID:     pendingProvider.ID,
		DroneID:         1501,
		Title:           "不应泄漏的服务",
		Status:          "draft",
		PricingUnit:     "per_trip",
		BasePriceAmount: 10000,
	}).Error; err != nil {
		t.Fatalf("create pending supply: %v", err)
	}
	if err := db.Create(&model.DemandQuote{
		ID:          1701,
		QuoteNo:     "QTPENDING0001",
		DemandID:    1801,
		OwnerUserID: pendingProvider.ID,
		DroneID:     1501,
		PriceAmount: 10000,
		Status:      "submitted",
	}).Error; err != nil {
		t.Fatalf("create pending quote: %v", err)
	}
	if err := db.Create(&model.OwnerPilotBinding{
		ID:          1901,
		OwnerUserID: pendingProvider.ID,
		PilotUserID: executorUser.ID,
		Status:      "active",
		InitiatedBy: "owner",
	}).Error; err != nil {
		t.Fatalf("create binding: %v", err)
	}

	assertGate := func(label string, err error) {
		t.Helper()
		if err == nil {
			t.Fatalf("%s expected provider gate error", label)
		}
		if !strings.Contains(err.Error(), "设备能力审核") {
			t.Fatalf("%s expected device capability gate error, got %v", label, err)
		}
	}

	_, _, err := ownerService.ListMySupplies(pendingProvider.ID, "", 1, 20)
	assertGate("list supplies", err)

	_, err = ownerService.GetSupply(pendingProvider.ID, 1601)
	assertGate("get supply", err)

	_, err = ownerService.CreateSupply(pendingProvider.ID, nil)
	assertGate("create supply", err)

	_, _, err = ownerService.ListMyQuotes(pendingProvider.ID, "", 1, 20)
	assertGate("list quotes", err)

	_, _, err = ownerService.ListPilotBindings(pendingProvider.ID, "", 1, 20)
	assertGate("list bindings", err)

	_, err = ownerService.InvitePilotBinding(pendingProvider.ID, executorUser.ID, false, "")
	assertGate("invite binding", err)
}

func TestOwnerServiceListRecommendedDemandsSortsByOwnerSupplyDistance(t *testing.T) {
	now := time.Now()
	db := newServiceTestDB(t,
		&model.User{},
		&model.Drone{},
		&model.OwnerSupply{},
		&model.Demand{},
	)

	ownerUser := &model.User{ID: 1101, Phone: "13800001101", Nickname: "距离测试机主", Status: "active"}
	clientUser := &model.User{ID: 1102, Phone: "13800001102", Nickname: "距离测试客户", Status: "active"}
	if err := db.Create(ownerUser).Error; err != nil {
		t.Fatalf("create owner user: %v", err)
	}
	if err := db.Create(clientUser).Error; err != nil {
		t.Fatalf("create client user: %v", err)
	}

	drone := &model.Drone{
		ID:                    2101,
		OwnerID:               ownerUser.ID,
		Brand:                 "DJI",
		Model:                 "FC30",
		SerialNumber:          "DIST-DRONE-01",
		MTOWKG:                180,
		MaxPayloadKG:          80,
		MaxDistance:           12,
		MaxFlightTime:         24,
		Latitude:              22.7200,
		Longitude:             114.2500,
		AvailabilityStatus:    "available",
		CertificationStatus:   "approved",
		UOMVerified:           "verified",
		InsuranceVerified:     "verified",
		AirworthinessVerified: "verified",
	}
	if err := db.Create(drone).Error; err != nil {
		t.Fatalf("create drone: %v", err)
	}
	supply := &model.OwnerSupply{
		ID:                 7101,
		SupplyNo:           "SPDIST0001",
		OwnerUserID:        ownerUser.ID,
		DroneID:            drone.ID,
		Title:              "龙岗重载供给",
		ServiceTypes:       model.JSON(`["heavy_cargo_lift_transport"]`),
		CargoScenes:        model.JSON(`["power_grid"]`),
		MTOWKG:             180,
		MaxPayloadKG:       80,
		MaxRangeKM:         15,
		BasePriceAmount:    80000,
		PricingUnit:        "per_trip",
		AcceptsDirectOrder: true,
		Status:             "active",
	}
	if err := db.Create(supply).Error; err != nil {
		t.Fatalf("create supply: %v", err)
	}

	expiresAt := now.Add(24 * time.Hour)
	nearDemand := &model.Demand{
		ID:                       3101,
		DemandNo:                 "DMDIST0001",
		ClientUserID:             clientUser.ID,
		Title:                    "近距离需求",
		ServiceType:              "heavy_cargo_lift_transport",
		CargoScene:               "power_grid",
		DepartureAddressSnapshot: model.JSON(`{"text":"近点","latitude":22.7210,"longitude":114.2510}`),
		CargoWeightKG:            60,
		BudgetMax:                100000,
		ExpiresAt:                &expiresAt,
		Status:                   "published",
		CreatedAt:                now.Add(-3 * time.Hour),
	}
	farDemand := &model.Demand{
		ID:                       3102,
		DemandNo:                 "DMDIST0002",
		ClientUserID:             clientUser.ID,
		Title:                    "远距离需求",
		ServiceType:              "heavy_cargo_lift_transport",
		CargoScene:               "power_grid",
		DepartureAddressSnapshot: model.JSON(`{"text":"远点","latitude":22.9200,"longitude":114.4500}`),
		CargoWeightKG:            60,
		BudgetMax:                100000,
		ExpiresAt:                &expiresAt,
		Status:                   "published",
		CreatedAt:                now.Add(-1 * time.Hour),
	}
	if err := db.Create([]*model.Demand{farDemand, nearDemand}).Error; err != nil {
		t.Fatalf("create demands: %v", err)
	}

	ownerService := NewOwnerService(
		repository.NewUserRepo(db),
		repository.NewDroneRepo(db),
		repository.NewPilotRepo(db),
		repository.NewRoleProfileRepo(db),
		repository.NewOwnerDomainRepo(db),
		repository.NewDemandDomainRepo(db),
	)

	demands, total, err := ownerService.ListRecommendedDemands(ownerUser.ID, 1, 20, RecommendedDemandQuery{
		ServiceType: "heavy_cargo_lift_transport",
		Sort:        "distance",
	})
	if err != nil {
		t.Fatalf("ListRecommendedDemands() error = %v", err)
	}
	if total != 1 || len(demands) != 1 {
		t.Fatalf("expected only in-range demand, got total=%d len=%d", total, len(demands))
	}
	if demands[0].ID != nearDemand.ID {
		t.Fatalf("expected nearest demand first, got %d", demands[0].ID)
	}

	metrics, err := ownerService.GetRecommendedDemandMetrics(ownerUser.ID, []model.Demand{*nearDemand, *farDemand})
	if err != nil {
		t.Fatalf("GetRecommendedDemandMetrics() error = %v", err)
	}
	nearMetric := metrics[nearDemand.ID]
	farMetric := metrics[farDemand.ID]
	if nearMetric.DistanceKM == nil || farMetric.DistanceKM == nil {
		t.Fatalf("expected both demands to have distance metrics, got %#v %#v", nearMetric, farMetric)
	}
	if *nearMetric.DistanceKM >= *farMetric.DistanceKM {
		t.Fatalf("expected near distance %.2f to be smaller than far %.2f", *nearMetric.DistanceKM, *farMetric.DistanceKM)
	}
	if nearMetric.MatchedSupplyID != supply.ID || nearMetric.MatchedDroneID != drone.ID {
		t.Fatalf("expected matched supply/drone ids, got %#v", nearMetric)
	}
	if nearMetric.ServiceRangeKM == nil || *nearMetric.ServiceRangeKM != 12 {
		t.Fatalf("expected conservative service range 12km, got %#v", nearMetric.ServiceRangeKM)
	}
	if nearMetric.ServiceCoverageStatus != "in_range" {
		t.Fatalf("expected near demand in range, got %#v", nearMetric)
	}
	if nearMetric.EstimatedArrivalMin == nil || *nearMetric.EstimatedArrivalMin != 1 {
		t.Fatalf("expected near demand estimated arrival 1 minute, got %#v", nearMetric.EstimatedArrivalMin)
	}
	if farMetric.ServiceCoverageStatus != "out_of_range" {
		t.Fatalf("expected far demand out of range, got %#v", farMetric)
	}
	if farMetric.EstimatedArrivalMin != nil {
		t.Fatalf("expected far demand to omit estimated arrival when out of range, got %#v", farMetric.EstimatedArrivalMin)
	}
}

func TestOwnerServiceListRecommendedDemandsFallsBackToDroneDistance(t *testing.T) {
	now := time.Now()
	db := newServiceTestDB(t,
		&model.User{},
		&model.Drone{},
		&model.OwnerSupply{},
		&model.Demand{},
	)

	ownerUser := &model.User{ID: 1201, Phone: "13800001201", Nickname: "无供给服务商", Status: "active"}
	clientUser := &model.User{ID: 1202, Phone: "13800001202", Nickname: "客户", Status: "active"}
	if err := db.Create([]*model.User{ownerUser, clientUser}).Error; err != nil {
		t.Fatalf("create users: %v", err)
	}
	drone := &model.Drone{
		ID:                    2201,
		OwnerID:               ownerUser.ID,
		Brand:                 "E2E",
		Model:                 "HeavyLift",
		SerialNumber:          "DIST-DRONE-FALLBACK",
		MTOWKG:                180,
		MaxPayloadKG:          80,
		MaxDistance:           30,
		MaxFlightTime:         60,
		Latitude:              23.0674,
		Longitude:             113.1264,
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
	nearDemand := &model.Demand{
		ID:                     3201,
		DemandNo:               "DMDISTFALLBACK1",
		ClientUserID:           clientUser.ID,
		Title:                  "佛山近距离需求",
		ServiceType:            "heavy_cargo_lift_transport",
		CargoScene:             "power_grid",
		ServiceAddressSnapshot: model.JSON(`{"text":"佛山近点","latitude":23.0678,"longitude":113.1270}`),
		CargoWeightKG:          60,
		BudgetMax:              100000,
		ExpiresAt:              &expiresAt,
		Status:                 "published",
		CreatedAt:              now.Add(-2 * time.Hour),
	}
	farDemand := &model.Demand{
		ID:                     3202,
		DemandNo:               "DMDISTFALLBACK2",
		ClientUserID:           clientUser.ID,
		Title:                  "长沙远距离需求",
		ServiceType:            "heavy_cargo_lift_transport",
		CargoScene:             "power_grid",
		ServiceAddressSnapshot: model.JSON(`{"text":"长沙远点","latitude":28.2391,"longitude":112.8739}`),
		CargoWeightKG:          60,
		BudgetMax:              100000,
		ExpiresAt:              &expiresAt,
		Status:                 "published",
		CreatedAt:              now.Add(-1 * time.Hour),
	}
	if err := db.Create([]*model.Demand{farDemand, nearDemand}).Error; err != nil {
		t.Fatalf("create demands: %v", err)
	}

	ownerService := NewOwnerService(
		repository.NewUserRepo(db),
		repository.NewDroneRepo(db),
		repository.NewPilotRepo(db),
		repository.NewRoleProfileRepo(db),
		repository.NewOwnerDomainRepo(db),
		repository.NewDemandDomainRepo(db),
	)

	demands, total, err := ownerService.ListRecommendedDemands(ownerUser.ID, 1, 20, RecommendedDemandQuery{
		ServiceType: "heavy_cargo_lift_transport",
		Sort:        "distance",
	})
	if err != nil {
		t.Fatalf("ListRecommendedDemands() error = %v", err)
	}
	if total != 1 || len(demands) != 1 || demands[0].ID != nearDemand.ID {
		t.Fatalf("expected only near demand from drone fallback, total=%d demands=%#v", total, demands)
	}

	metrics, err := ownerService.GetRecommendedDemandMetrics(ownerUser.ID, []model.Demand{*nearDemand, *farDemand})
	if err != nil {
		t.Fatalf("GetRecommendedDemandMetrics() error = %v", err)
	}
	nearMetric := metrics[nearDemand.ID]
	farMetric := metrics[farDemand.ID]
	if nearMetric.DistanceKM == nil || nearMetric.ServiceCoverageStatus != "in_range" || nearMetric.MatchedDroneID != drone.ID {
		t.Fatalf("expected near demand in range through drone fallback, got %#v", nearMetric)
	}
	if farMetric.DistanceKM == nil || farMetric.ServiceCoverageStatus != "out_of_range" {
		t.Fatalf("expected far demand to be measured but out of range, got %#v", farMetric)
	}
}
