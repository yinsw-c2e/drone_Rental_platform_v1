package service

import (
	"math"
	"testing"
	"time"

	"wurenji-backend/internal/model"
)

func TestCalculateDirectOrderAmountPerTripAndPerKG(t *testing.T) {
	trips := 2
	weight := 3.5
	perTripSupply := &model.OwnerSupply{BasePriceAmount: 12000, PricingUnit: "per_trip"}
	perKGSupply := &model.OwnerSupply{BasePriceAmount: 800, PricingUnit: "per_kg"}

	tripAmount, err := calculateDirectOrderAmount(perTripSupply, &DirectOrderInput{EstimatedTripCount: &trips})
	if err != nil {
		t.Fatalf("unexpected per_trip error: %v", err)
	}
	if tripAmount != 24000 {
		t.Fatalf("expected per_trip amount 24000, got %d", tripAmount)
	}

	kgAmount, err := calculateDirectOrderAmount(perKGSupply, &DirectOrderInput{
		EstimatedTripCount: &trips,
		CargoWeightKG:      &weight,
	})
	if err != nil {
		t.Fatalf("unexpected per_kg error: %v", err)
	}
	if kgAmount != 5600 {
		t.Fatalf("expected per_kg amount 5600, got %d", kgAmount)
	}
}

func TestCalculateDirectOrderAmountPerHourAndPerKM(t *testing.T) {
	start := time.Date(2026, 3, 15, 9, 0, 0, 0, time.Local)
	end := start.Add(3 * time.Hour)
	lat1, lng1 := 23.0215, 113.1214
	lat2, lng2 := 23.0290, 113.1340

	perHourSupply := &model.OwnerSupply{BasePriceAmount: 5000, PricingUnit: "per_hour"}
	perKMSupply := &model.OwnerSupply{BasePriceAmount: 1200, PricingUnit: "per_km"}

	hourAmount, err := calculateDirectOrderAmount(perHourSupply, &DirectOrderInput{
		ScheduledStartAt: &start,
		ScheduledEndAt:   &end,
	})
	if err != nil {
		t.Fatalf("unexpected per_hour error: %v", err)
	}
	if hourAmount != 15000 {
		t.Fatalf("expected per_hour amount 15000, got %d", hourAmount)
	}

	kmAmount, err := calculateDirectOrderAmount(perKMSupply, &DirectOrderInput{
		DepartureAddress:   &AddressSnapshotInput{Text: "起点", Latitude: &lat1, Longitude: &lng1},
		DestinationAddress: &AddressSnapshotInput{Text: "终点", Latitude: &lat2, Longitude: &lng2},
	})
	if err != nil {
		t.Fatalf("unexpected per_km error: %v", err)
	}
	expected := int64(math.Round(float64(perKMSupply.BasePriceAmount) * haversineKM(lat1, lng1, lat2, lng2)))
	if kmAmount != expected {
		t.Fatalf("expected per_km amount %d, got %d", expected, kmAmount)
	}
}

func TestResolveDirectOrderHelpers(t *testing.T) {
	start := time.Date(2026, 3, 15, 10, 0, 0, 0, time.Local)
	end := start
	lat1, lng1 := 23.0, 113.0
	lat2, lng2 := 24.0, 114.0

	input := &DirectOrderInput{
		ServiceAddress:     &AddressSnapshotInput{Text: "服务点", Latitude: &lat1, Longitude: &lng1},
		DepartureAddress:   &AddressSnapshotInput{Text: "起运点", Latitude: &lat2, Longitude: &lng2},
		DestinationAddress: &AddressSnapshotInput{Text: "送达点", Latitude: &lat2, Longitude: &lng2},
		ScheduledStartAt:   &start,
		ScheduledEndAt:     &end,
	}

	if !hasDirectOrderPrimaryAddress(input) {
		t.Fatal("expected primary address to exist")
	}
	text, lat, lng := resolveDirectOrderPrimaryAddress(input)
	if text != "服务点" || lat != lat1 || lng != lng1 {
		t.Fatalf("expected service address to win, got %s %.2f %.2f", text, lat, lng)
	}

	destText, _, _ := resolveDirectOrderDestination(input)
	if destText != "送达点" {
		t.Fatalf("expected destination address, got %s", destText)
	}

	startAt, endAt := resolveDirectOrderSchedule(input)
	if !endAt.After(startAt) {
		t.Fatal("expected schedule helper to normalize zero-length time window")
	}
	if endAt.Sub(startAt) != 2*time.Hour {
		t.Fatalf("expected normalized duration 2h, got %s", endAt.Sub(startAt))
	}
}
