package service

import (
	"testing"
	"time"

	"wurenji-backend/internal/model"
)

func TestBuildHomeSummaryCountsTodayIncomeAndAlerts(t *testing.T) {
	now := time.Now()
	inProgressCreatedAt := now.Add(-7 * time.Hour)
	completedCreatedAt := now.Add(-2 * time.Hour)
	yesterday := now.Add(-24 * time.Hour)

	orders := []model.Order{
		{Status: "assigned", CreatedAt: inProgressCreatedAt, TotalAmount: 1000},
		{Status: "completed", CreatedAt: completedCreatedAt, TotalAmount: 2500},
		{Status: "completed", CreatedAt: yesterday, TotalAmount: 9000},
	}

	summary := buildHomeSummary(orders)

	if summary.InProgressOrderCount != 1 {
		t.Fatalf("expected 1 in-progress order, got %d", summary.InProgressOrderCount)
	}
	if summary.AlertCount != 1 {
		t.Fatalf("expected 1 alert order, got %d", summary.AlertCount)
	}
	if summary.TodayOrderCount != 2 {
		t.Fatalf("expected 2 today orders, got %d", summary.TodayOrderCount)
	}
	if summary.TodayIncomeAmount != 2500 {
		t.Fatalf("expected today income 2500, got %d", summary.TodayIncomeAmount)
	}
}

func TestHomeSupplyAreaTextFallsBackToSnapshot(t *testing.T) {
	supply := &model.OwnerSupply{
		ServiceAreaSnapshot: model.JSON(`{"city":"佛山","text":"广东省佛山市禅城区"}`),
	}
	if got := homeSupplyAreaText(supply); got != "广东省佛山市禅城区" {
		t.Fatalf("expected snapshot text, got %s", got)
	}

	supply.Drone = &model.Drone{City: "广州"}
	if got := homeSupplyAreaText(supply); got != "广州" {
		t.Fatalf("expected drone city to win, got %s", got)
	}
}

func TestHomeDemandAddressTextPrefersServiceAddress(t *testing.T) {
	demand := &model.Demand{
		ServiceAddressSnapshot:     model.JSON(`{"text":"佛山市禅城区祖庙街道"}`),
		DepartureAddressSnapshot:   model.JSON(`{"text":"起运点"}`),
		DestinationAddressSnapshot: model.JSON(`{"text":"送达点"}`),
	}
	if got := homeDemandAddressText(demand); got != "佛山市禅城区祖庙街道" {
		t.Fatalf("expected service address text, got %s", got)
	}
}
