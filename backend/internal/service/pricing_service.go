package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

const (
	defaultCruiseSpeedKMH       = 60.0
	defaultHandlingReserveMin   = 15.0
	pricePrecisionDistanceScale = 10.0
)

type PricingPoint struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Address   string  `json:"address,omitempty"`
}

type PricingEstimateInput struct {
	Origin           PricingPoint `json:"origin"`
	Destination      PricingPoint `json:"destination"`
	CargoWeightKG    float64      `json:"cargo_weight_kg"`
	ScheduledStartAt time.Time    `json:"scheduled_start_at"`
	ServiceClassCode string       `json:"service_class_code,omitempty"`
	CargoScene       string       `json:"cargo_scene,omitempty"`
}

type PricingSurcharge struct {
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Rate        float64 `json:"rate"`
	AmountCents int64   `json:"amount_cents"`
}

type PricingEstimate struct {
	ServiceClassCode         string             `json:"service_class_code"`
	ServiceClassName         string             `json:"service_class_name"`
	CargoWeightKG            float64            `json:"cargo_weight_kg"`
	DistanceKM               float64            `json:"distance_km"`
	DistanceM                int                `json:"distance_m"`
	EstimatedDurationMin     int                `json:"estimated_duration_min"`
	BasePriceCents           int64              `json:"base_price_cents"`
	DistanceFeeCents         int64              `json:"distance_fee_cents"`
	DurationFeeCents         int64              `json:"duration_fee_cents"`
	Surcharges               []PricingSurcharge `json:"surcharges"`
	MinChargeCents           int64              `json:"min_charge_cents"`
	MinChargeAdjustmentCents int64              `json:"min_charge_adjustment_cents"`
	TotalEstimatedCents      int64              `json:"total_estimated_cents"`
	PriceBreakdownJSON       model.JSON         `json:"price_breakdown_json"`
}

type PricingService struct {
	serviceClassRepo *repository.ServiceClassRepo
	cruiseSpeedKMH   float64
	handlingReserve  float64
}

func NewPricingService(serviceClassRepo *repository.ServiceClassRepo) *PricingService {
	return &PricingService{
		serviceClassRepo: serviceClassRepo,
		cruiseSpeedKMH:   defaultCruiseSpeedKMH,
		handlingReserve:  defaultHandlingReserveMin,
	}
}

func (s *PricingService) ListServiceClasses() ([]model.ServiceClass, error) {
	if s == nil || s.serviceClassRepo == nil {
		return nil, errors.New("计价服务未初始化")
	}
	return s.serviceClassRepo.ListActive()
}

func (s *PricingService) Estimate(input PricingEstimateInput) (*PricingEstimate, error) {
	if s == nil || s.serviceClassRepo == nil {
		return nil, errors.New("计价服务未初始化")
	}
	if err := validatePricingInput(input); err != nil {
		return nil, err
	}

	serviceClass, err := s.resolveServiceClass(input)
	if err != nil {
		return nil, err
	}
	if serviceClass.PayloadMaxKG > 0 && input.CargoWeightKG > serviceClass.PayloadMaxKG {
		return nil, fmt.Errorf("货物重量 %.2fkg 超出当前机型档 %s 的承载上限 %.2fkg", input.CargoWeightKG, serviceClass.DisplayName, serviceClass.PayloadMaxKG)
	}

	distanceKM := haversineKM(input.Origin.Latitude, input.Origin.Longitude, input.Destination.Latitude, input.Destination.Longitude)
	distanceKM = math.Round(distanceKM*pricePrecisionDistanceScale) / pricePrecisionDistanceScale
	durationMin := int(math.Ceil((distanceKM / s.cruiseSpeedKMH * 60) + s.handlingReserve))
	if durationMin < int(math.Ceil(s.handlingReserve)) {
		durationMin = int(math.Ceil(s.handlingReserve))
	}

	baseFee := serviceClass.BasePriceCents
	distanceFee := int64(math.Round(distanceKM * float64(serviceClass.PerKMPriceCents)))
	durationFee := int64(durationMin) * serviceClass.PerMinutePriceCents
	subtotal := baseFee + distanceFee + durationFee

	surcharges := buildPricingSurcharges(serviceClass, input, subtotal)
	surchargeTotal := int64(0)
	for _, item := range surcharges {
		surchargeTotal += item.AmountCents
	}

	total := subtotal + surchargeTotal
	minAdjustment := int64(0)
	if total < serviceClass.MinChargeCents {
		minAdjustment = serviceClass.MinChargeCents - total
		total = serviceClass.MinChargeCents
	}

	estimate := &PricingEstimate{
		ServiceClassCode:         serviceClass.Code,
		ServiceClassName:         serviceClass.DisplayName,
		CargoWeightKG:            input.CargoWeightKG,
		DistanceKM:               distanceKM,
		DistanceM:                int(math.Round(distanceKM * 1000)),
		EstimatedDurationMin:     durationMin,
		BasePriceCents:           baseFee,
		DistanceFeeCents:         distanceFee,
		DurationFeeCents:         durationFee,
		Surcharges:               surcharges,
		MinChargeCents:           serviceClass.MinChargeCents,
		MinChargeAdjustmentCents: minAdjustment,
		TotalEstimatedCents:      total,
	}
	estimate.PriceBreakdownJSON = buildPricingBreakdownJSON(estimate, input)
	return estimate, nil
}

func (s *PricingService) resolveServiceClass(input PricingEstimateInput) (*model.ServiceClass, error) {
	if code := strings.TrimSpace(input.ServiceClassCode); code != "" {
		serviceClass, err := s.serviceClassRepo.GetActiveByCode(code)
		if err != nil {
			return nil, fmt.Errorf("机型档不存在或已停用: %s", code)
		}
		return serviceClass, nil
	}

	items, err := s.serviceClassRepo.ListActive()
	if err != nil {
		return nil, err
	}
	for i := range items {
		item := items[i]
		if item.PayloadMaxKG <= 0 || input.CargoWeightKG <= item.PayloadMaxKG {
			return &item, nil
		}
	}
	return nil, errors.New("未找到可承载该重量的机型档")
}

func validatePricingInput(input PricingEstimateInput) error {
	if !validCoordinate(input.Origin.Latitude, input.Origin.Longitude) {
		return errors.New("起点经纬度无效")
	}
	if !validCoordinate(input.Destination.Latitude, input.Destination.Longitude) {
		return errors.New("终点经纬度无效")
	}
	if input.CargoWeightKG < model.HeavyLiftMinPayloadKG {
		return fmt.Errorf("货物重量不能低于 %.0fkg", model.HeavyLiftMinPayloadKG)
	}
	return nil
}

func validCoordinate(lat, lng float64) bool {
	return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat == 0 && lng == 0)
}

func buildPricingSurcharges(serviceClass *model.ServiceClass, input PricingEstimateInput, subtotal int64) []PricingSurcharge {
	items := make([]PricingSurcharge, 0, 3)
	if isNightTime(input.ScheduledStartAt) && serviceClass.NightSurchargeRate > 0 {
		items = append(items, pricingSurcharge("night", "夜间服务费", serviceClass.NightSurchargeRate, subtotal))
	}

	scene := strings.ToLower(strings.TrimSpace(input.CargoScene))
	switch {
	case strings.Contains(scene, "plateau") || strings.Contains(scene, "highland") || strings.Contains(input.CargoScene, "高原"):
		if serviceClass.PlateauSurchargeRate > 0 {
			items = append(items, pricingSurcharge("plateau", "高原服务费", serviceClass.PlateauSurchargeRate, subtotal))
		}
	case strings.Contains(scene, "island") || strings.Contains(input.CargoScene, "海岛"):
		if serviceClass.IslandSurchargeRate > 0 {
			items = append(items, pricingSurcharge("island", "海岛服务费", serviceClass.IslandSurchargeRate, subtotal))
		}
	case strings.Contains(scene, "emergency") || strings.Contains(input.CargoScene, "应急"):
		if serviceClass.EmergencySurchargeRate > 0 {
			items = append(items, pricingSurcharge("emergency", "应急服务费", serviceClass.EmergencySurchargeRate, subtotal))
		}
	}
	return items
}

func pricingSurcharge(code, name string, rate float64, subtotal int64) PricingSurcharge {
	return PricingSurcharge{
		Code:        code,
		Name:        name,
		Rate:        rate,
		AmountCents: int64(math.Round(float64(subtotal) * rate)),
	}
}

func isNightTime(value time.Time) bool {
	if value.IsZero() {
		value = time.Now()
	}
	hour := value.Hour()
	return hour >= 22 || hour < 6
}

func buildPricingBreakdownJSON(estimate *PricingEstimate, input PricingEstimateInput) model.JSON {
	if estimate == nil {
		return model.JSON("null")
	}
	raw, err := json.Marshal(map[string]interface{}{
		"origin":                      input.Origin,
		"destination":                 input.Destination,
		"cargo_scene":                 input.CargoScene,
		"scheduled_start_at":          input.ScheduledStartAt,
		"service_class_code":          estimate.ServiceClassCode,
		"distance_km":                 estimate.DistanceKM,
		"distance_m":                  estimate.DistanceM,
		"estimated_duration_min":      estimate.EstimatedDurationMin,
		"base_price_cents":            estimate.BasePriceCents,
		"distance_fee_cents":          estimate.DistanceFeeCents,
		"duration_fee_cents":          estimate.DurationFeeCents,
		"surcharges":                  estimate.Surcharges,
		"min_charge_cents":            estimate.MinChargeCents,
		"min_charge_adjustment_cents": estimate.MinChargeAdjustmentCents,
		"total_estimated_cents":       estimate.TotalEstimatedCents,
	})
	if err != nil {
		return model.JSON("null")
	}
	return model.JSON(raw)
}
