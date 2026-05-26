package service

import (
	"testing"
	"time"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

func seedPricingServiceClasses(t *testing.T) *PricingService {
	t.Helper()
	db := newServiceTestDB(t, &model.ServiceClass{})
	items := []model.ServiceClass{
		{
			Code: "light_heavy", DisplayName: "轻型重载", MTOWMinKG: 150, MTOWMaxKG: 300,
			PayloadMinKG: 50, PayloadMaxKG: 80, BasePriceCents: 60000, PerKMPriceCents: 8000,
			PerMinutePriceCents: 1200, MinChargeCents: 80000, NightSurchargeRate: 0.20,
			PlateauSurchargeRate: 0.15, IslandSurchargeRate: 0.20, EmergencySurchargeRate: 0.30,
			Status: "active", SortOrder: 10,
		},
		{
			Code: "medium_heavy", DisplayName: "中型重载", MTOWMinKG: 300, MTOWMaxKG: 600,
			PayloadMinKG: 80, PayloadMaxKG: 150, BasePriceCents: 90000, PerKMPriceCents: 12000,
			PerMinutePriceCents: 1600, MinChargeCents: 120000, NightSurchargeRate: 0.20,
			PlateauSurchargeRate: 0.15, IslandSurchargeRate: 0.20, EmergencySurchargeRate: 0.30,
			Status: "active", SortOrder: 20,
		},
		{
			Code: "super_heavy", DisplayName: "超重载", MTOWMinKG: 600,
			PayloadMinKG: 150, PayloadMaxKG: 0, BasePriceCents: 150000, PerKMPriceCents: 20000,
			PerMinutePriceCents: 2500, MinChargeCents: 200000, NightSurchargeRate: 0.20,
			PlateauSurchargeRate: 0.15, IslandSurchargeRate: 0.20, EmergencySurchargeRate: 0.30,
			Status: "active", SortOrder: 30,
		},
	}
	if err := db.Create(&items).Error; err != nil {
		t.Fatalf("seed service classes: %v", err)
	}
	return NewPricingService(repository.NewServiceClassRepo(db))
}

func TestPricingEstimateCoversServiceClassesAndScenes(t *testing.T) {
	pricing := seedPricingServiceClasses(t)
	scenes := []string{"power_grid", "plateau", "emergency"}
	classes := []struct {
		code   string
		weight float64
	}{
		{code: "light_heavy", weight: 56},
		{code: "medium_heavy", weight: 120},
		{code: "super_heavy", weight: 220},
	}

	for _, class := range classes {
		for _, scene := range scenes {
			t.Run(class.code+"_"+scene, func(t *testing.T) {
				estimate, err := pricing.Estimate(PricingEstimateInput{
					Origin:           PricingPoint{Latitude: 23.0109, Longitude: 113.1227, Address: "佛山禅城电力仓"},
					Destination:      PricingPoint{Latitude: 23.0374, Longitude: 113.1428, Address: "佛山南海履约点"},
					CargoWeightKG:    class.weight,
					ScheduledStartAt: time.Date(2026, 5, 26, 10, 0, 0, 0, time.Local),
					ServiceClassCode: class.code,
					CargoScene:       scene,
				})
				if err != nil {
					t.Fatalf("estimate failed: %v", err)
				}
				if estimate.ServiceClassCode != class.code {
					t.Fatalf("expected class %s, got %s", class.code, estimate.ServiceClassCode)
				}
				if estimate.DistanceM <= 0 || estimate.EstimatedDurationMin <= 0 {
					t.Fatalf("expected positive distance and duration: %#v", estimate)
				}
				if estimate.TotalEstimatedCents < estimate.MinChargeCents {
					t.Fatalf("total below minimum: total=%d min=%d", estimate.TotalEstimatedCents, estimate.MinChargeCents)
				}
				if scene == "plateau" && len(estimate.Surcharges) != 1 {
					t.Fatalf("expected plateau surcharge, got %#v", estimate.Surcharges)
				}
				if scene == "emergency" && len(estimate.Surcharges) != 1 {
					t.Fatalf("expected emergency surcharge, got %#v", estimate.Surcharges)
				}
			})
		}
	}
}

func TestPricingServiceListServiceClasses(t *testing.T) {
	pricing := seedPricingServiceClasses(t)
	items, err := pricing.ListServiceClasses()
	if err != nil {
		t.Fatalf("list service classes failed: %v", err)
	}
	if len(items) != 3 {
		t.Fatalf("expected 3 service classes, got %d", len(items))
	}
	if items[0].Code != "light_heavy" || items[1].Code != "medium_heavy" || items[2].Code != "super_heavy" {
		t.Fatalf("unexpected service class order: %#v", items)
	}
	if items[0].DisplayName == "" || items[0].PayloadMinKG <= 0 {
		t.Fatalf("expected display fields for mini-program cards: %#v", items[0])
	}
}

func TestPricingEstimateAppliesNightSurchargeAndMinimum(t *testing.T) {
	pricing := seedPricingServiceClasses(t)
	dayEstimate, err := pricing.Estimate(PricingEstimateInput{
		Origin:           PricingPoint{Latitude: 23.0109, Longitude: 113.1227},
		Destination:      PricingPoint{Latitude: 23.0110, Longitude: 113.1228},
		CargoWeightKG:    56,
		ScheduledStartAt: time.Date(2026, 5, 26, 10, 30, 0, 0, time.Local),
		ServiceClassCode: "light_heavy",
		CargoScene:       "power_grid",
	})
	if err != nil {
		t.Fatalf("estimate failed: %v", err)
	}
	if dayEstimate.MinChargeAdjustmentCents <= 0 {
		t.Fatalf("expected short trip minimum adjustment, got %d", dayEstimate.MinChargeAdjustmentCents)
	}
	if dayEstimate.TotalEstimatedCents != dayEstimate.MinChargeCents {
		t.Fatalf("expected total to equal min charge, total=%d min=%d", dayEstimate.TotalEstimatedCents, dayEstimate.MinChargeCents)
	}

	nightEstimate, err := pricing.Estimate(PricingEstimateInput{
		Origin:           PricingPoint{Latitude: 23.0109, Longitude: 113.1227},
		Destination:      PricingPoint{Latitude: 23.0110, Longitude: 113.1228},
		CargoWeightKG:    56,
		ScheduledStartAt: time.Date(2026, 5, 26, 23, 30, 0, 0, time.Local),
		ServiceClassCode: "light_heavy",
		CargoScene:       "power_grid",
	})
	if err != nil {
		t.Fatalf("night estimate failed: %v", err)
	}
	if len(nightEstimate.Surcharges) != 1 || nightEstimate.Surcharges[0].Code != "night" {
		t.Fatalf("expected night surcharge, got %#v", nightEstimate.Surcharges)
	}
}

func TestPricingEstimateRejectsInvalidInput(t *testing.T) {
	pricing := seedPricingServiceClasses(t)
	_, err := pricing.Estimate(PricingEstimateInput{
		Origin:           PricingPoint{Latitude: 23.0109, Longitude: 113.1227},
		Destination:      PricingPoint{Latitude: 23.0374, Longitude: 113.1428},
		CargoWeightKG:    10,
		ScheduledStartAt: time.Date(2026, 5, 26, 10, 0, 0, 0, time.Local),
		ServiceClassCode: "light_heavy",
	})
	if err == nil {
		t.Fatal("expected low weight to fail")
	}

	_, err = pricing.Estimate(PricingEstimateInput{
		Origin:           PricingPoint{Latitude: 23.0109, Longitude: 113.1227},
		Destination:      PricingPoint{Latitude: 23.0374, Longitude: 113.1428},
		CargoWeightKG:    220,
		ScheduledStartAt: time.Date(2026, 5, 26, 10, 0, 0, 0, time.Local),
		ServiceClassCode: "medium_heavy",
	})
	if err == nil {
		t.Fatal("expected overweight class selection to fail")
	}
}
