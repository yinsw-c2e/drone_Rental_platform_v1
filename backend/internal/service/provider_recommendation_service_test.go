package service

import (
	"fmt"
	"slices"
	"testing"
	"time"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"

	"gorm.io/gorm"
)

func TestProviderRecommendationAppliesHardFilters(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.User{},
		&model.OwnerProfile{},
		&model.Drone{},
		&model.OwnerSupply{},
		&model.Order{},
		&model.Review{},
		&model.Demand{},
		&model.DemandQuote{},
	)

	client := &model.User{ID: 9001, Phone: "13900009001", Nickname: "推荐客户", Status: "active"}
	eligible := seedRecommendationProvider(t, db, recommendationProviderSeed{
		UserID:       9101,
		Nickname:     "南海重载服务商",
		DroneID:      9201,
		MaxPayloadKG: 120,
		MaxDistance:  30,
		Latitude:     23.0410,
		Longitude:    113.1430,
		Scene:        "power_grid",
		RangeKM:      25,
		Certified:    true,
	})
	seedRecommendationProvider(t, db, recommendationProviderSeed{
		UserID:       9102,
		Nickname:     "载重不足服务商",
		DroneID:      9202,
		MaxPayloadKG: 45,
		MaxDistance:  30,
		Latitude:     23.0410,
		Longitude:    113.1430,
		Scene:        "power_grid",
		RangeKM:      25,
		Certified:    true,
	})
	seedRecommendationProvider(t, db, recommendationProviderSeed{
		UserID:       9103,
		Nickname:     "距离过远服务商",
		DroneID:      9203,
		MaxPayloadKG: 120,
		MaxDistance:  10,
		Latitude:     23.9000,
		Longitude:    113.9000,
		Scene:        "power_grid",
		RangeKM:      10,
		Certified:    true,
	})
	seedRecommendationProvider(t, db, recommendationProviderSeed{
		UserID:       9104,
		Nickname:     "资质缺失服务商",
		DroneID:      9204,
		MaxPayloadKG: 120,
		MaxDistance:  30,
		Latitude:     23.0410,
		Longitude:    113.1430,
		Scene:        "power_grid",
		RangeKM:      25,
		Certified:    false,
	})
	if err := db.Create(client).Error; err != nil {
		t.Fatalf("seed client: %v", err)
	}

	now := time.Now()
	completedAt := now.Add(-24 * time.Hour)
	order := &model.Order{
		OrderNo:        "OD-REC-001",
		OrderType:      "cargo",
		ClientUserID:   client.ID,
		ProviderUserID: eligible.ID,
		DroneID:        9201,
		Status:         "completed",
		CompletedAt:    &completedAt,
		CreatedAt:      completedAt.Add(-2 * time.Hour),
		UpdatedAt:      completedAt,
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("seed order: %v", err)
	}
	if err := db.Create(&model.Review{
		OrderID:    order.ID,
		ReviewerID: client.ID,
		RevieweeID: eligible.ID,
		TargetType: "user",
		TargetID:   eligible.ID,
		Rating:     5,
		Content:    "响应稳定",
	}).Error; err != nil {
		t.Fatalf("seed review: %v", err)
	}

	svc := NewProviderRecommendationService(repository.NewProviderRecommendationRepo(db))
	items, total, err := svc.ListRecommendations(ProviderRecommendationQuery{
		ClientUserID:    client.ID,
		OriginLatitude:  23.0410,
		OriginLongitude: 113.1430,
		CargoScene:      "power_grid",
		CargoWeightKG:   80,
	}, 1, 20)
	if err != nil {
		t.Fatalf("ListRecommendations() error = %v", err)
	}
	if total != 1 || len(items) != 1 {
		t.Fatalf("expected only one eligible provider, got total=%d len=%d items=%#v", total, len(items), items)
	}

	got := items[0]
	if got.ProviderUserID != eligible.ID {
		t.Fatalf("expected eligible provider %d, got %d", eligible.ID, got.ProviderUserID)
	}
	if got.MaxPayloadKG < 120 {
		t.Fatalf("expected max payload from certified drone, got %.1f", got.MaxPayloadKG)
	}
	if got.DistanceKM == nil || *got.DistanceKM > 0.1 {
		t.Fatalf("expected near-origin distance, got %#v", got.DistanceKM)
	}
	if !slices.Contains(got.MatchedScenes, "power_grid") {
		t.Fatalf("expected matched scene power_grid, got %#v", got.MatchedScenes)
	}
	if got.CompletedOrders30D != 1 {
		t.Fatalf("expected recent completed order stat 1, got %d", got.CompletedOrders30D)
	}
	if got.Rating == nil || *got.Rating != 5 || got.RatingCount != 1 {
		t.Fatalf("expected rating 5 from provider review, got rating=%#v count=%d", got.Rating, got.RatingCount)
	}
	if got.Score <= 0 {
		t.Fatalf("expected positive recommendation score, got %d", got.Score)
	}
}

func TestProviderRecommendationKeywordDoesNotMatchSupplyTestCode(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.User{},
		&model.OwnerProfile{},
		&model.Drone{},
		&model.OwnerSupply{},
		&model.Order{},
		&model.Review{},
		&model.DemandQuote{},
	)

	client := &model.User{ID: 9201, Phone: "13900009201", Nickname: "搜索客户", Status: "active"}
	provider := seedRecommendationProvider(t, db, recommendationProviderSeed{
		UserID:       9202,
		Nickname:     "测试服务商",
		DroneID:      9203,
		MaxPayloadKG: 120,
		MaxDistance:  30,
		Latitude:     23.0410,
		Longitude:    113.1430,
		Scene:        "power_grid",
		RangeKM:      25,
		Certified:    true,
	})
	if err := db.Create(client).Error; err != nil {
		t.Fatalf("seed client: %v", err)
	}
	if err := db.Model(&model.OwnerSupply{}).
		Where("owner_user_id = ?", provider.ID).
		Update("title", "CODXTEST 佛山中型重载吊运供给").Error; err != nil {
		t.Fatalf("seed supply title with test code: %v", err)
	}

	svc := NewProviderRecommendationService(repository.NewProviderRecommendationRepo(db))
	items, total, err := svc.ListRecommendations(ProviderRecommendationQuery{
		ClientUserID:    client.ID,
		OriginLatitude:  23.0410,
		OriginLongitude: 113.1430,
		CargoScene:      "power_grid",
		CargoWeightKG:   80,
		Keyword:         "X",
	}, 1, 20)
	if err != nil {
		t.Fatalf("ListRecommendations() error = %v", err)
	}
	if total != 0 || len(items) != 0 {
		t.Fatalf("expected keyword X to exclude provider when only supply title matches, got total=%d len=%d items=%#v", total, len(items), items)
	}
}

func TestProviderInvitationIsIdempotentAndReopensInactiveStatuses(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.User{},
		&model.OwnerProfile{},
		&model.Demand{},
		&model.DemandProviderInvitation{},
	)

	client := &model.User{ID: 9301, Phone: "13900009301", Nickname: "邀请客户", Status: "active"}
	provider := &model.User{ID: 9302, Phone: "13900009302", Nickname: "被邀请服务商", Status: "active"}
	demand := &model.Demand{
		ID:           9303,
		DemandNo:     "DM-INVITE-001",
		ClientUserID: client.ID,
		Title:        "定向邀请测试需求",
		ServiceType:  "heavy_cargo_lift_transport",
		CargoScene:   "power_grid",
		Status:       "published",
	}
	if err := db.Create([]*model.User{client, provider}).Error; err != nil {
		t.Fatalf("seed users: %v", err)
	}
	if err := db.Create(&model.OwnerProfile{
		UserID:             provider.ID,
		VerificationStatus: "approved",
		Status:             "active",
		ServiceCity:        "佛山",
	}).Error; err != nil {
		t.Fatalf("seed provider profile: %v", err)
	}
	if err := db.Create(demand).Error; err != nil {
		t.Fatalf("seed demand: %v", err)
	}

	svc := NewProviderRecommendationService(repository.NewProviderRecommendationRepo(db))
	first, err := svc.InviteProvider(client.ID, demand.ID, ProviderInviteInput{
		ProviderUserID: provider.ID,
		Message:        "希望你看一下这单",
	})
	if err != nil {
		t.Fatalf("InviteProvider() first error = %v", err)
	}
	if first.Status != "pending_quote" || first.Message != "希望你看一下这单" {
		t.Fatalf("unexpected first invitation: %#v", first)
	}

	second, err := svc.InviteProvider(client.ID, demand.ID, ProviderInviteInput{
		ProviderUserID: provider.ID,
		Message:        "重复邀请不应覆盖活跃邀请",
	})
	if err != nil {
		t.Fatalf("InviteProvider() second error = %v", err)
	}
	if second.ID != first.ID || second.Status != "pending_quote" || second.Message != first.Message {
		t.Fatalf("expected active invitation to be reused, first=%#v second=%#v", first, second)
	}

	if err := db.Model(&model.DemandProviderInvitation{}).
		Where("id = ?", first.ID).
		Updates(map[string]interface{}{"status": "expired", "message": "已过期"}).Error; err != nil {
		t.Fatalf("expire invitation: %v", err)
	}

	reopened, err := svc.InviteProvider(client.ID, demand.ID, ProviderInviteInput{
		ProviderUserID: provider.ID,
		Message:        "请重新报价",
	})
	if err != nil {
		t.Fatalf("InviteProvider() reopen error = %v", err)
	}
	if reopened.ID != first.ID || reopened.Status != "pending_quote" || reopened.Message != "请重新报价" {
		t.Fatalf("expected expired invitation to reopen, got %#v", reopened)
	}
}

func TestOwnerServiceCreateDemandQuoteMarksProviderInvitationQuoted(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.User{},
		&model.OwnerProfile{},
		&model.PilotProfile{},
		&model.Drone{},
		&model.Pilot{},
		&model.Demand{},
		&model.DemandQuote{},
		&model.DemandProviderInvitation{},
	)

	now := time.Now()
	client := &model.User{ID: 9401, Phone: "13900009401", Nickname: "报价客户", Status: "active"}
	provider := &model.User{ID: 9402, Phone: "13900009402", Nickname: "报价服务商", Status: "active"}
	if err := db.Create([]*model.User{client, provider}).Error; err != nil {
		t.Fatalf("seed users: %v", err)
	}
	if err := db.Create(&model.OwnerProfile{
		UserID:             provider.ID,
		VerificationStatus: "approved",
		Status:             "active",
		ServiceCity:        "佛山",
	}).Error; err != nil {
		t.Fatalf("seed provider profile: %v", err)
	}
	drone := &model.Drone{
		ID:                    9403,
		OwnerID:               provider.ID,
		Brand:                 "DJI",
		Model:                 "Agras T50",
		SerialNumber:          "QUOTE-INVITE-DRONE-001",
		MTOWKG:                200,
		MaxPayloadKG:          120,
		MaxDistance:           30,
		AvailabilityStatus:    "available",
		CertificationStatus:   "approved",
		UOMVerified:           "verified",
		InsuranceVerified:     "verified",
		AirworthinessVerified: "verified",
	}
	if err := db.Create(drone).Error; err != nil {
		t.Fatalf("seed drone: %v", err)
	}
	if err := db.Create(&model.Pilot{
		UserID:             provider.ID,
		VerificationStatus: "verified",
		AvailabilityStatus: "online",
	}).Error; err != nil {
		t.Fatalf("seed provider executor profile: %v", err)
	}
	expiresAt := now.Add(24 * time.Hour)
	demand := &model.Demand{
		ID:            9404,
		DemandNo:      "DM-QUOTE-INVITE-001",
		ClientUserID:  client.ID,
		Title:         "报价后邀请状态测试",
		ServiceType:   "heavy_cargo_lift_transport",
		CargoScene:    "power_grid",
		CargoWeightKG: 80,
		Status:        "published",
		ExpiresAt:     &expiresAt,
		CreatedAt:     now.Add(-time.Hour),
	}
	if err := db.Create(demand).Error; err != nil {
		t.Fatalf("seed demand: %v", err)
	}
	invitation := &model.DemandProviderInvitation{
		DemandID:       demand.ID,
		ClientUserID:   client.ID,
		ProviderUserID: provider.ID,
		Status:         "pending_quote",
		Message:        "请报价",
	}
	if err := db.Create(invitation).Error; err != nil {
		t.Fatalf("seed invitation: %v", err)
	}

	ownerService := NewOwnerService(
		repository.NewUserRepo(db),
		repository.NewDroneRepo(db),
		repository.NewPilotRepo(db),
		repository.NewRoleProfileRepo(db),
		repository.NewOwnerDomainRepo(db),
		repository.NewDemandDomainRepo(db),
	)
	quote, err := ownerService.CreateDemandQuote(provider.ID, demand.ID, &CreateQuoteInput{
		DroneID:       drone.ID,
		PriceAmount:   168000,
		ExecutionPlan: "认证无人机执行，按现场条件确认吊点",
	})
	if err != nil {
		t.Fatalf("CreateDemandQuote() error = %v", err)
	}
	if quote == nil || quote.OwnerUserID != provider.ID {
		t.Fatalf("expected quote from provider, got %#v", quote)
	}

	var got model.DemandProviderInvitation
	if err := db.First(&got, invitation.ID).Error; err != nil {
		t.Fatalf("reload invitation: %v", err)
	}
	if got.Status != "quoted" {
		t.Fatalf("expected invitation status quoted, got %s", got.Status)
	}
}

type recommendationProviderSeed struct {
	UserID       int64
	Nickname     string
	DroneID      int64
	MaxPayloadKG float64
	MaxDistance  float64
	Latitude     float64
	Longitude    float64
	Scene        string
	RangeKM      float64
	Certified    bool
}

func seedRecommendationProvider(t *testing.T, db *gorm.DB, seed recommendationProviderSeed) *model.User {
	t.Helper()

	user := &model.User{
		ID:       seed.UserID,
		Phone:    fmt.Sprintf("139%08d", seed.UserID),
		Nickname: seed.Nickname,
		UserType: "drone_owner",
		Status:   "active",
	}
	profile := &model.OwnerProfile{
		UserID:             seed.UserID,
		VerificationStatus: "approved",
		Status:             "active",
		ServiceCity:        "佛山",
		Intro:              seed.Nickname + "，提供认证重载无人机吊运服务",
	}
	certificationStatus := "pending"
	uomVerified := "pending"
	insuranceVerified := "pending"
	airworthinessVerified := "pending"
	if seed.Certified {
		certificationStatus = "approved"
		uomVerified = "verified"
		insuranceVerified = "verified"
		airworthinessVerified = "verified"
	}
	drone := &model.Drone{
		ID:                    seed.DroneID,
		OwnerID:               seed.UserID,
		Brand:                 "DJI",
		Model:                 "Agras T50",
		SerialNumber:          fmt.Sprintf("REC-DRONE-%d", seed.UserID),
		MTOWKG:                200,
		MaxPayloadKG:          seed.MaxPayloadKG,
		MaxDistance:           seed.MaxDistance,
		Latitude:              seed.Latitude,
		Longitude:             seed.Longitude,
		City:                  "佛山",
		AvailabilityStatus:    "available",
		CertificationStatus:   certificationStatus,
		UOMVerified:           uomVerified,
		InsuranceVerified:     insuranceVerified,
		AirworthinessVerified: airworthinessVerified,
	}
	supply := &model.OwnerSupply{
		SupplyNo:           fmt.Sprintf("REC-SP-%d", seed.UserID),
		OwnerUserID:        seed.UserID,
		DroneID:            seed.DroneID,
		Title:              seed.Nickname + "能力档案",
		ServiceTypes:       model.JSON(`["heavy_cargo_lift_transport"]`),
		CargoScenes:        model.JSON(`["` + seed.Scene + `"]`),
		MTOWKG:             200,
		MaxPayloadKG:       seed.MaxPayloadKG,
		MaxRangeKM:         seed.RangeKM,
		AcceptsDirectOrder: false,
		Status:             "active",
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("seed user %d: %v", seed.UserID, err)
	}
	if err := db.Create(profile).Error; err != nil {
		t.Fatalf("seed profile %d: %v", seed.UserID, err)
	}
	if err := db.Create(drone).Error; err != nil {
		t.Fatalf("seed drone %d: %v", seed.DroneID, err)
	}
	if err := db.Create(supply).Error; err != nil {
		t.Fatalf("seed supply %d: %v", seed.UserID, err)
	}
	return user
}
