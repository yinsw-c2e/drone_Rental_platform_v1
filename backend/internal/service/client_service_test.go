package service

import (
	"encoding/json"
	"testing"

	"wurenji-backend/internal/model"
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
