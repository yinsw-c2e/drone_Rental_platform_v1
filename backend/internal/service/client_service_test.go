package service

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

func TestBuildClientEligibilityViewAllowsVerifiedPersonalUser(t *testing.T) {
	client := &model.Client{
		Status:              "active",
		PlatformCreditScore: 620,
	}
	user := &model.User{
		Status:     "active",
		IDVerified: "approved",
	}

	view := buildClientEligibilityView(client, user)
	if view == nil {
		t.Fatal("expected eligibility view")
	}
	if !view.Eligible || !view.CanPublishDemand || !view.CanCreateDirectOrder {
		t.Fatalf("expected verified personal user to be fully eligible, got %#v", view)
	}
	if !view.IdentityVerified {
		t.Fatal("expected identity to be verified")
	}
	if !view.EnterpriseUpgradeOptional {
		t.Fatal("expected enterprise upgrade to stay optional")
	}
	if len(view.Blockers) != 0 {
		t.Fatalf("expected no blockers, got %#v", view.Blockers)
	}
}

func TestBuildClientEligibilityViewBlocksPendingIdentityEvenIfLegacyClientVerified(t *testing.T) {
	client := &model.Client{
		Status:              "active",
		VerificationStatus:  "verified",
		PlatformCreditScore: 620,
	}
	user := &model.User{
		Status:     "active",
		IDVerified: "pending",
	}

	view := buildClientEligibilityView(client, user)
	if view == nil {
		t.Fatal("expected eligibility view")
	}
	if view.Eligible || view.CanPublishDemand || view.CanCreateDirectOrder {
		t.Fatalf("expected pending identity to block actions, got %#v", view)
	}
	if len(view.Blockers) == 0 {
		t.Fatal("expected blockers")
	}
	if view.Blockers[0].Code != "identity_verification_required" {
		t.Fatalf("expected first blocker to be identity verification, got %#v", view.Blockers[0])
	}
}

func TestBuildClientProfileViewUsesIdentityStatusAndExpandedFields(t *testing.T) {
	preferredCargoTypes, err := json.Marshal([]string{"电网建设", "海岛给养"})
	if err != nil {
		t.Fatalf("marshal preferred cargo types: %v", err)
	}

	client := &model.Client{
		ID:                     9,
		UserID:                 18,
		ClientType:             "individual",
		ContactPerson:          "张三",
		ContactPhone:           "13800000000",
		ContactEmail:           "client@example.com",
		CreditScore:            710,
		CreditCheckStatus:      "approved",
		PlatformCreditScore:    680,
		EnterpriseVerified:     "pending",
		VerificationStatus:     "verified",
		PreferredCargoTypes:    model.JSON(preferredCargoTypes),
		DefaultPickupAddress:   "广州南沙码头",
		DefaultDeliveryAddress: "珠海横琴仓库",
		TotalOrders:            7,
		CompletedOrders:        5,
		CancelledOrders:        1,
		TotalSpending:          258000,
		AverageRating:          4.8,
		Status:                 "active",
	}
	roleProfile := &model.ClientProfile{
		DefaultContactName:  "调度联系人",
		DefaultContactPhone: "13900000000",
		PreferredCity:       "广州",
		Remark:              "优先沿海运输",
	}
	user := &model.User{
		Status:     "active",
		IDVerified: "approved",
	}

	view := buildClientProfileView(client, roleProfile, user)
	if view == nil {
		t.Fatal("expected profile view")
	}
	if view.VerificationStatus != "approved" || view.IdentityVerificationStatus != "approved" {
		t.Fatalf("expected identity-based verification status, got %#v", view)
	}
	if view.ClientVerificationStatus != "verified" {
		t.Fatalf("expected legacy client verification status to be preserved, got %s", view.ClientVerificationStatus)
	}
	if len(view.PreferredCargoTypes) != 2 {
		t.Fatalf("expected preferred cargo types to decode, got %#v", view.PreferredCargoTypes)
	}
	if view.DefaultPickupAddress != "广州南沙码头" || view.DefaultDeliveryAddress != "珠海横琴仓库" {
		t.Fatalf("expected default addresses to be present, got %#v / %#v", view.DefaultPickupAddress, view.DefaultDeliveryAddress)
	}
	if view.Eligibility == nil || !view.Eligibility.CanCreateDirectOrder {
		t.Fatalf("expected embedded eligibility to be ready, got %#v", view.Eligibility)
	}
}

func TestGetCurrentProfileUsesLiveDemandAndOrderStats(t *testing.T) {
	db := newServiceTestDB(t, &model.User{}, &model.Client{}, &model.ClientProfile{}, &model.Order{}, &model.Demand{})
	svc := NewClientService(
		repository.NewClientRepo(db),
		repository.NewUserRepo(db),
		repository.NewRoleProfileRepo(db),
		nil,
		repository.NewDemandDomainRepo(db),
		nil,
	)

	user := &model.User{
		ID:         41,
		Phone:      "13800000041",
		Nickname:   "客户统计样本",
		UserType:   "client",
		Status:     "active",
		IDVerified: "approved",
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := db.Create(&model.Client{
		UserID:              user.ID,
		ClientType:          "individual",
		VerificationStatus:  "verified",
		PlatformCreditScore: 600,
		TotalOrders:         0,
		CompletedOrders:     0,
		TotalSpending:       0,
		Status:              "active",
	}).Error; err != nil {
		t.Fatalf("seed stale client profile: %v", err)
	}
	if err := db.Create(&model.ClientProfile{UserID: user.ID, Status: "active"}).Error; err != nil {
		t.Fatalf("seed client role profile: %v", err)
	}

	paidAt := time.Now()
	orders := []model.Order{
		{OrderNo: "WRJ-LIVE-001", OrderType: "cargo", RenterID: user.ID, ClientUserID: user.ID, Status: "completed", TotalAmount: 120000, PaidAt: &paidAt},
		{OrderNo: "WRJ-LIVE-002", OrderType: "cargo", RenterID: user.ID, ClientUserID: user.ID, Status: "pending_dispatch", TotalAmount: 80000, PaidAt: &paidAt},
		{OrderNo: "WRJ-LIVE-003", OrderType: "cargo", RenterID: user.ID, ClientUserID: user.ID, Status: "cancelled", TotalAmount: 99000},
	}
	if err := db.Create(&orders).Error; err != nil {
		t.Fatalf("seed orders: %v", err)
	}
	demands := []model.Demand{
		{DemandNo: "DM-LIVE-001", ClientUserID: user.ID, Title: "电网塔材吊运", ServiceType: "cargo", CargoScene: "电网建设", Status: "quoting"},
		{DemandNo: "DM-LIVE-002", ClientUserID: user.ID, Title: "海岛给养", ServiceType: "cargo", CargoScene: "海岛补给", Status: "draft"},
	}
	if err := db.Create(&demands).Error; err != nil {
		t.Fatalf("seed demands: %v", err)
	}

	view, err := svc.GetCurrentProfile(user.ID)
	if err != nil {
		t.Fatalf("GetCurrentProfile() error = %v", err)
	}
	if view.DemandCount != 2 {
		t.Fatalf("expected live demand count 2, got %d", view.DemandCount)
	}
	if view.TotalOrders != 3 || view.CompletedOrders != 1 || view.CancelledOrders != 1 {
		t.Fatalf("expected live order stats 3/1/1, got %d/%d/%d", view.TotalOrders, view.CompletedOrders, view.CancelledOrders)
	}
	if view.TotalSpending != 200000 {
		t.Fatalf("expected paid spending 200000, got %d", view.TotalSpending)
	}
}

func TestValidateAddressAirspaceRejectsAddressWithoutCoordinates(t *testing.T) {
	svc := &ClientService{airspaceService: &AirspaceService{}}

	err := svc.validateAddressAirspace("起点地址", addressSnapshotPayload{
		Text: "佛山市禅城区祖庙街道测试地址",
	})
	if err == nil {
		t.Fatal("expected missing coordinate address to be rejected")
	}
	if !strings.Contains(err.Error(), "缺少有效坐标") {
		t.Fatalf("expected missing coordinate error, got %v", err)
	}
}
