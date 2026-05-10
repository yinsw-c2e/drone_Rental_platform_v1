package service

import (
	"testing"

	"wurenji-backend/internal/model"
)

func floatPtr(v float64) *float64 {
	return &v
}

func TestApplyDemandInputCalculatesCargoVolumeFromDimensions(t *testing.T) {
	demand := &model.Demand{}

	err := applyDemandInput(demand, &ClientDemandInput{
		CargoWeightKG: floatPtr(120),
		CargoLengthCM: floatPtr(200),
		CargoWidthCM:  floatPtr(150),
		CargoHeightCM: floatPtr(100),
	})
	if err != nil {
		t.Fatalf("apply demand input: %v", err)
	}

	if demand.CargoWeightKG != 120 {
		t.Fatalf("expected weight 120kg, got %v", demand.CargoWeightKG)
	}
	if demand.CargoLengthCM != 200 || demand.CargoWidthCM != 150 || demand.CargoHeightCM != 100 {
		t.Fatalf("unexpected dimensions: %.2f x %.2f x %.2f", demand.CargoLengthCM, demand.CargoWidthCM, demand.CargoHeightCM)
	}
	if demand.CargoVolumeM3 != 3 {
		t.Fatalf("expected auto volume 3m3, got %v", demand.CargoVolumeM3)
	}
}

func TestApplyDemandInputRejectsNegativeCargoDimensions(t *testing.T) {
	demand := &model.Demand{}

	err := applyDemandInput(demand, &ClientDemandInput{
		CargoLengthCM: floatPtr(-1),
		CargoWidthCM:  floatPtr(150),
		CargoHeightCM: floatPtr(100),
	})
	if err == nil {
		t.Fatal("expected negative cargo dimension to fail")
	}
}
