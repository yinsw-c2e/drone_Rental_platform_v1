package service

import (
	"database/sql"
	"math"
	"strings"
	"testing"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type negotiatedOrderFixture struct {
	db            *gorm.DB
	clientService *ClientService
	ownerService  *OwnerService
	settlementSvc *SettlementService
	clientUser    *model.User
	ownerUser     *model.User
	drone         *model.Drone
	demand        *model.Demand
	quoteA        *model.DemandQuote
	quoteB        *model.DemandQuote
}

func setupNegotiatedOrderFixture(t *testing.T) negotiatedOrderFixture {
	t.Helper()

	db := newServiceTestDB(t,
		&model.User{},
		&model.Client{},
		&model.ClientProfile{},
		&model.OwnerProfile{},
		&model.Pilot{},
		&model.Drone{},
		&model.Demand{},
		&model.DemandQuote{},
		&model.OwnerSupply{},
		&model.Order{},
		&model.OrderTimeline{},
		&model.OrderSnapshot{},
		&model.OrderSettlement{},
		&model.UserWallet{},
		&model.WalletTransaction{},
		&model.PricingConfig{},
		&model.Review{},
		&model.FinanceManualActionRecord{},
	)

	userRepo := repository.NewUserRepo(db)
	clientRepo := repository.NewClientRepo(db)
	roleProfileRepo := repository.NewRoleProfileRepo(db)
	ownerDomainRepo := repository.NewOwnerDomainRepo(db)
	demandDomainRepo := repository.NewDemandDomainRepo(db)
	orderRepo := repository.NewOrderRepo(db)
	droneRepo := repository.NewDroneRepo(db)
	pilotRepo := repository.NewPilotRepo(db)
	artifactRepo := repository.NewOrderArtifactRepo(db)
	settlementRepo := repository.NewSettlementRepo(db)

	orderService := NewOrderService(
		orderRepo,
		droneRepo,
		pilotRepo,
		nil,
		nil,
		clientRepo,
		demandDomainRepo,
		ownerDomainRepo,
		artifactRepo,
		nil,
		zap.NewNop(),
	)
	settlementSvc := NewSettlementService(settlementRepo, orderRepo, zap.NewNop())
	orderService.SetSettlementService(settlementSvc)

	clientService := NewClientService(clientRepo, userRepo, roleProfileRepo, ownerDomainRepo, demandDomainRepo, orderService)
	ownerService := NewOwnerService(userRepo, droneRepo, pilotRepo, roleProfileRepo, ownerDomainRepo, demandDomainRepo)
	ownerService.SetOrderService(orderService)

	now := time.Now().Truncate(time.Second)
	clientUser := &model.User{
		ID:         9101,
		Phone:      "13991010001",
		Nickname:   "议价客户",
		UserType:   "renter",
		IDVerified: "approved",
		Status:     "active",
	}
	ownerUser := &model.User{
		ID:         9102,
		Phone:      "13991010002",
		Nickname:   "议价服务商A",
		UserType:   "drone_owner",
		IDVerified: "approved",
		Status:     "active",
	}
	otherOwnerUser := &model.User{
		ID:         9103,
		Phone:      "13991010003",
		Nickname:   "议价服务商B",
		UserType:   "drone_owner",
		IDVerified: "approved",
		Status:     "active",
	}
	if err := db.Create([]*model.User{clientUser, ownerUser, otherOwnerUser}).Error; err != nil {
		t.Fatalf("create users: %v", err)
	}
	if err := db.Create([]*model.OwnerProfile{
		{UserID: ownerUser.ID, VerificationStatus: "approved", Status: "active", ServiceCity: "佛山"},
		{UserID: otherOwnerUser.ID, VerificationStatus: "approved", Status: "active", ServiceCity: "佛山"},
	}).Error; err != nil {
		t.Fatalf("create owner profiles: %v", err)
	}

	droneA := &model.Drone{
		ID:                    9201,
		OwnerID:               ownerUser.ID,
		Brand:                 "E2E",
		Model:                 "NegotiatedLift-80",
		SerialNumber:          "NEG-DRONE-A",
		MTOWKG:                200,
		MaxPayloadKG:          80,
		MaxLoad:               80,
		Deposit:               0,
		AvailabilityStatus:    "available",
		CertificationStatus:   "approved",
		UOMVerified:           "verified",
		InsuranceVerified:     "verified",
		AirworthinessVerified: "verified",
		City:                  "佛山",
		Latitude:              23.0674,
		Longitude:             113.1263,
	}
	droneB := &model.Drone{
		ID:                    9202,
		OwnerID:               otherOwnerUser.ID,
		Brand:                 "E2E",
		Model:                 "NegotiatedLift-100",
		SerialNumber:          "NEG-DRONE-B",
		MTOWKG:                220,
		MaxPayloadKG:          100,
		MaxLoad:               100,
		Deposit:               0,
		AvailabilityStatus:    "available",
		CertificationStatus:   "approved",
		UOMVerified:           "verified",
		InsuranceVerified:     "verified",
		AirworthinessVerified: "verified",
		City:                  "佛山",
		Latitude:              23.0674,
		Longitude:             113.1263,
	}
	if err := db.Create([]*model.Drone{droneA, droneB}).Error; err != nil {
		t.Fatalf("create drones: %v", err)
	}

	startAt := now.Add(3 * time.Hour)
	endAt := startAt.Add(2 * time.Hour)
	expiresAt := now.Add(24 * time.Hour)
	demand := &model.Demand{
		ID:                         9301,
		DemandNo:                   "DMNEG0001",
		ClientUserID:               clientUser.ID,
		Title:                      "议价单重载吊运验收",
		ServiceType:                "heavy_cargo_lift_transport",
		CargoScene:                 "construction_lifting",
		DepartureAddressSnapshot:   model.JSON(`{"text":"佛山市禅城区起点","latitude":23.0674347,"longitude":113.1263712}`),
		DestinationAddressSnapshot: model.JSON(`{"text":"佛山市南海区终点","latitude":23.0415736,"longitude":113.1390007}`),
		ScheduledStartAt:           &startAt,
		ScheduledEndAt:             &endAt,
		CargoWeightKG:              60,
		BudgetMin:                  100000,
		BudgetMax:                  160000,
		ExpiresAt:                  &expiresAt,
		Status:                     "quoting",
	}
	if err := db.Create(demand).Error; err != nil {
		t.Fatalf("create demand: %v", err)
	}

	quoteA := &model.DemandQuote{
		ID:            9401,
		QuoteNo:       "QTNEG0001",
		DemandID:      demand.ID,
		OwnerUserID:   ownerUser.ID,
		DroneID:       droneA.ID,
		PriceAmount:   123400,
		ExecutionPlan: "使用合规重载无人机完成吊运",
		Status:        "submitted",
	}
	quoteB := &model.DemandQuote{
		ID:            9402,
		QuoteNo:       "QTNEG0002",
		DemandID:      demand.ID,
		OwnerUserID:   otherOwnerUser.ID,
		DroneID:       droneB.ID,
		PriceAmount:   130000,
		ExecutionPlan: "备用报价方案",
		Status:        "submitted",
	}
	if err := db.Create([]*model.DemandQuote{quoteA, quoteB}).Error; err != nil {
		t.Fatalf("create quotes: %v", err)
	}

	return negotiatedOrderFixture{
		db:            db,
		clientService: clientService,
		ownerService:  ownerService,
		settlementSvc: settlementSvc,
		clientUser:    clientUser,
		ownerUser:     ownerUser,
		drone:         droneA,
		demand:        demand,
		quoteA:        quoteA,
		quoteB:        quoteB,
	}
}

func TestSelectProviderCreatesNegotiatedOrderIdempotentlyAndPreservesNullablePilot(t *testing.T) {
	fixture := setupNegotiatedOrderFixture(t)

	first, err := fixture.clientService.SelectProvider(fixture.clientUser.ID, fixture.demand.ID, fixture.quoteA.ID)
	if err != nil {
		t.Fatalf("select provider: %v", err)
	}
	second, err := fixture.clientService.SelectProvider(fixture.clientUser.ID, fixture.demand.ID, fixture.quoteA.ID)
	if err != nil {
		t.Fatalf("select provider again: %v", err)
	}
	if first.OrderID == 0 || second.OrderID != first.OrderID {
		t.Fatalf("expected idempotent order id %d, got %d", first.OrderID, second.OrderID)
	}

	var orderCount int64
	if err := fixture.db.Model(&model.Order{}).
		Where("demand_id = ? AND order_source = ? AND order_mode = ?", fixture.demand.ID, "demand_market", OrderModeNegotiated).
		Count(&orderCount).Error; err != nil {
		t.Fatalf("count negotiated orders: %v", err)
	}
	if orderCount != 1 {
		t.Fatalf("expected one negotiated order, got %d", orderCount)
	}

	var demand model.Demand
	if err := fixture.db.First(&demand, fixture.demand.ID).Error; err != nil {
		t.Fatalf("load demand: %v", err)
	}
	if demand.Status != "converted_to_order" || demand.SelectedQuoteID != fixture.quoteA.ID || demand.SelectedProviderUserID != fixture.ownerUser.ID {
		t.Fatalf("unexpected demand state: status=%s selected_quote=%d selected_provider=%d", demand.Status, demand.SelectedQuoteID, demand.SelectedProviderUserID)
	}

	var selectedQuote model.DemandQuote
	if err := fixture.db.First(&selectedQuote, fixture.quoteA.ID).Error; err != nil {
		t.Fatalf("load selected quote: %v", err)
	}
	if selectedQuote.Status != "selected" {
		t.Fatalf("expected selected quote, got %s", selectedQuote.Status)
	}
	var rejectedQuote model.DemandQuote
	if err := fixture.db.First(&rejectedQuote, fixture.quoteB.ID).Error; err != nil {
		t.Fatalf("load rejected quote: %v", err)
	}
	if rejectedQuote.Status != "rejected" {
		t.Fatalf("expected other quote rejected, got %s", rejectedQuote.Status)
	}

	var order model.Order
	if err := fixture.db.First(&order, first.OrderID).Error; err != nil {
		t.Fatalf("load order: %v", err)
	}
	if order.OrderMode != OrderModeNegotiated || order.OrderSource != "demand_market" || order.Status != "pending_payment" {
		t.Fatalf("unexpected order route/status: mode=%s source=%s status=%s", order.OrderMode, order.OrderSource, order.Status)
	}
	if order.TotalAmount != fixture.quoteA.PriceAmount || order.ProviderUserID != fixture.quoteA.OwnerUserID || order.DroneID != fixture.quoteA.DroneID {
		t.Fatalf("order fields not copied from quote: amount=%d provider=%d drone=%d", order.TotalAmount, order.ProviderUserID, order.DroneID)
	}

	var pilotID sql.NullInt64
	if err := fixture.db.Raw("SELECT pilot_id FROM orders WHERE id = ?", first.OrderID).Scan(&pilotID).Error; err != nil {
		t.Fatalf("scan raw pilot_id: %v", err)
	}
	if pilotID.Valid {
		t.Fatalf("expected pilot_id to remain NULL when no verified pilot exists, got %d", pilotID.Int64)
	}
}

func TestSelectProviderRejectsDifferentQuoteAfterConversion(t *testing.T) {
	fixture := setupNegotiatedOrderFixture(t)

	first, err := fixture.clientService.SelectProvider(fixture.clientUser.ID, fixture.demand.ID, fixture.quoteA.ID)
	if err != nil {
		t.Fatalf("select provider: %v", err)
	}
	_, err = fixture.clientService.SelectProvider(fixture.clientUser.ID, fixture.demand.ID, fixture.quoteB.ID)
	if err == nil || !strings.Contains(err.Error(), "已选定其它报价") {
		t.Fatalf("expected selected-other-quote error, got %v", err)
	}

	var orderCount int64
	if err := fixture.db.Model(&model.Order{}).Where("demand_id = ?", fixture.demand.ID).Count(&orderCount).Error; err != nil {
		t.Fatalf("count orders: %v", err)
	}
	if orderCount != 1 {
		t.Fatalf("expected one order after rejected second selection, got %d", orderCount)
	}
	var order model.Order
	if err := fixture.db.First(&order, first.OrderID).Error; err != nil {
		t.Fatalf("load order: %v", err)
	}
	if order.TotalAmount != fixture.quoteA.PriceAmount {
		t.Fatalf("expected original quote amount to remain, got %d", order.TotalAmount)
	}
}

func TestCreateDemandQuoteRepeatedSubmissionUpdatesExistingQuote(t *testing.T) {
	fixture := setupNegotiatedOrderFixture(t)
	newAmount := int64(135700)

	updated, err := fixture.ownerService.CreateDemandQuote(fixture.ownerUser.ID, fixture.demand.ID, &CreateQuoteInput{
		DroneID:       fixture.drone.ID,
		PriceAmount:   newAmount,
		ExecutionPlan: "更新后的报价方案",
	})
	if err != nil {
		t.Fatalf("update existing quote: %v", err)
	}
	if updated.ID != fixture.quoteA.ID || updated.PriceAmount != newAmount {
		t.Fatalf("expected existing quote update, got id=%d amount=%d", updated.ID, updated.PriceAmount)
	}

	var quoteCount int64
	if err := fixture.db.Model(&model.DemandQuote{}).
		Where("demand_id = ? AND owner_user_id = ?", fixture.demand.ID, fixture.ownerUser.ID).
		Count(&quoteCount).Error; err != nil {
		t.Fatalf("count owner quotes: %v", err)
	}
	if quoteCount != 1 {
		t.Fatalf("expected repeated quote to update in place, got %d rows", quoteCount)
	}
}

func TestNegotiatedOrderSettlementUsesSelectedQuoteAmount(t *testing.T) {
	fixture := setupNegotiatedOrderFixture(t)

	selected, err := fixture.clientService.SelectProvider(fixture.clientUser.ID, fixture.demand.ID, fixture.quoteA.ID)
	if err != nil {
		t.Fatalf("select provider: %v", err)
	}
	settlement, err := fixture.settlementSvc.FinalizeOrderSettlement(selected.OrderID)
	if err != nil {
		t.Fatalf("finalize negotiated order settlement: %v", err)
	}

	if settlement.TotalAmount != fixture.quoteA.PriceAmount || settlement.FinalAmount != fixture.quoteA.PriceAmount {
		t.Fatalf("settlement amount must use selected quote amount, got total=%d final=%d quote=%d", settlement.TotalAmount, settlement.FinalAmount, fixture.quoteA.PriceAmount)
	}
	expectedPlatform := int64(math.Round(float64(fixture.quoteA.PriceAmount) * 0.10))
	expectedInsurance := int64(math.Round(float64(fixture.quoteA.PriceAmount) * 0.05))
	distributable := fixture.quoteA.PriceAmount - expectedPlatform - expectedInsurance
	if settlement.PlatformFee != expectedPlatform || settlement.InsuranceDeduction != expectedInsurance || settlement.PilotFee+settlement.OwnerFee != distributable {
		t.Fatalf("unexpected split: platform=%d insurance=%d pilot=%d owner=%d", settlement.PlatformFee, settlement.InsuranceDeduction, settlement.PilotFee, settlement.OwnerFee)
	}
	if settlement.Status != "settled" {
		t.Fatalf("expected settled settlement, got %s", settlement.Status)
	}
}
