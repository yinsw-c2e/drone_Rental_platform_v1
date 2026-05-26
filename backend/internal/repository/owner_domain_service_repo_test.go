package repository

import (
	"testing"
	"time"

	"wurenji-backend/internal/model"
)

func TestOwnerDomainRepoGetMarketplaceSupplyStatsAggregatesOrdersAndReviews(t *testing.T) {
	db := newRepositoryTestDB(
		t,
		&model.User{},
		&model.Drone{},
		&model.OwnerSupply{},
		&model.Order{},
		&model.Review{},
	)

	owner := &model.User{ID: 101, Phone: "13900000101", Nickname: "真实统计服务商", Status: "active"}
	client := &model.User{ID: 102, Phone: "13900000102", Nickname: "真实统计客户", Status: "active"}
	if err := db.Create([]*model.User{owner, client}).Error; err != nil {
		t.Fatalf("seed users: %v", err)
	}

	drone := &model.Drone{
		ID:                    201,
		OwnerID:               owner.ID,
		Brand:                 "DJI",
		Model:                 "FC30",
		SerialNumber:          "STATS-DRONE-01",
		MTOWKG:                180,
		MaxPayloadKG:          80,
		AvailabilityStatus:    "available",
		CertificationStatus:   "approved",
		UOMVerified:           "verified",
		InsuranceVerified:     "verified",
		AirworthinessVerified: "verified",
	}
	if err := db.Create(drone).Error; err != nil {
		t.Fatalf("seed drone: %v", err)
	}

	supply := &model.OwnerSupply{
		ID:                 301,
		SupplyNo:           "SPSTATS0001",
		OwnerUserID:        owner.ID,
		DroneID:            drone.ID,
		Title:              "真实统计供给",
		ServiceTypes:       model.JSON(`["heavy_cargo_lift_transport"]`),
		CargoScenes:        model.JSON(`["power_grid"]`),
		MTOWKG:             180,
		MaxPayloadKG:       80,
		MaxRangeKM:         15,
		BasePriceAmount:    88000,
		PricingUnit:        "per_trip",
		AcceptsDirectOrder: true,
		Status:             "active",
		Drone:              drone,
		Owner:              owner,
	}
	if err := db.Create(supply).Error; err != nil {
		t.Fatalf("seed supply: %v", err)
	}

	now := time.Now()
	confirmedA := now.Add(-57 * time.Minute)
	confirmedB := now.Add(-27 * time.Minute)
	completedAt := now.Add(-10 * time.Minute)
	orders := []*model.Order{
		{
			OrderNo:             "ODSTATS0001",
			OrderType:           "cargo",
			SourceSupplyID:      supply.ID,
			DroneID:             drone.ID,
			ProviderUserID:      owner.ID,
			ClientUserID:        client.ID,
			Status:              "completed",
			ProviderConfirmedAt: &confirmedA,
			CompletedAt:         &completedAt,
			CreatedAt:           now.Add(-60 * time.Minute),
		},
		{
			OrderNo:             "ODSTATS0002",
			OrderType:           "cargo",
			SourceSupplyID:      supply.ID,
			DroneID:             drone.ID,
			ProviderUserID:      owner.ID,
			ClientUserID:        client.ID,
			Status:              "pending_dispatch",
			ProviderConfirmedAt: &confirmedB,
			CreatedAt:           now.Add(-30 * time.Minute),
		},
		{
			OrderNo:        "ODSTATS0003",
			OrderType:      "cargo",
			SourceSupplyID: supply.ID,
			DroneID:        drone.ID,
			ProviderUserID: owner.ID,
			ClientUserID:   client.ID,
			Status:         "cancelled",
			CreatedAt:      now.Add(-20 * time.Minute),
		},
	}
	if err := db.Create(orders).Error; err != nil {
		t.Fatalf("seed orders: %v", err)
	}

	reviews := []*model.Review{
		{OrderID: orders[0].ID, ReviewerID: client.ID, RevieweeID: owner.ID, TargetType: "user", TargetID: owner.ID, Rating: 5, Content: "准时"},
		{OrderID: orders[1].ID, ReviewerID: client.ID, RevieweeID: owner.ID, TargetType: "user", TargetID: owner.ID, Rating: 4, Content: "稳定"},
		{OrderID: orders[1].ID, ReviewerID: client.ID, RevieweeID: drone.ID, TargetType: "drone", TargetID: drone.ID, Rating: 3, Content: "备用评分"},
	}
	if err := db.Create(reviews).Error; err != nil {
		t.Fatalf("seed reviews: %v", err)
	}

	stats, err := NewOwnerDomainRepo(db).GetMarketplaceSupplyStats([]model.OwnerSupply{*supply})
	if err != nil {
		t.Fatalf("GetMarketplaceSupplyStats() error = %v", err)
	}
	got := stats[supply.ID]
	if got.TotalOrderCount != 2 {
		t.Fatalf("expected cancelled order to be excluded from total, got %d", got.TotalOrderCount)
	}
	if got.CompletedOrderCount != 1 {
		t.Fatalf("expected completed order count 1, got %d", got.CompletedOrderCount)
	}
	if got.ResponseSampleCount != 2 || got.AverageResponseSeconds != 180 {
		t.Fatalf("expected average response 180s from 2 samples, got samples=%d avg=%d", got.ResponseSampleCount, got.AverageResponseSeconds)
	}
	if got.Rating != 4.5 || got.RatingCount != 2 || got.RatingSource != "provider_reviews" {
		t.Fatalf("expected provider rating 4.5 from 2 reviews, got %#v", got)
	}
}
