package demand

import (
	"testing"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/service"
)

func TestBuildQuoteSummaryIncludesProviderDecisionStats(t *testing.T) {
	rating := 4.8
	quote := &model.DemandQuote{
		ID:          11,
		QuoteNo:     "QT-PROVIDER-STATS",
		DemandID:    22,
		OwnerUserID: 33,
		PriceAmount: 220000,
		Status:      "submitted",
		Owner: &model.User{
			ID:       33,
			Nickname: "稳达吊运",
		},
		Drone: &model.Drone{
			ID:           44,
			Brand:        "DJI",
			Model:        "FlyCart",
			MaxPayloadKG: 80,
		},
	}
	stats := map[int64]service.DemandQuoteProviderStats{
		33: {
			Recent30DCompletedOrders: 89,
			AvgResponseSeconds:       720,
			PreferredScenes:          []string{"power_grid", "mountain_agriculture"},
			Rating:                   &rating,
			RatingCount:              127,
		},
	}

	summary := buildQuoteSummaryWithProviderStats(quote, stats)
	owner, ok := summary["owner"].(gin.H)
	if !ok {
		t.Fatalf("expected owner summary, got %#v", summary["owner"])
	}
	if owner["recent_30d_completed_orders"] != 89 {
		t.Fatalf("expected recent orders, got %#v", owner)
	}
	if owner["avg_response_seconds"] != 720 {
		t.Fatalf("expected avg response, got %#v", owner)
	}
	if owner["rating"] != rating || owner["rating_count"] != 127 {
		t.Fatalf("expected rating stats, got %#v", owner)
	}
	scenes, ok := owner["preferred_scenes"].([]string)
	if !ok || len(scenes) != 2 || scenes[0] != "power_grid" {
		t.Fatalf("expected preferred scenes, got %#v", owner["preferred_scenes"])
	}
}
