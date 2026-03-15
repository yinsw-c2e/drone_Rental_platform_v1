package repository

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"gorm.io/gorm"

	"wurenji-backend/internal/model"
)

type DemandDomainRepo struct {
	db *gorm.DB
}

func NewDemandDomainRepo(db *gorm.DB) *DemandDomainRepo {
	return &DemandDomainRepo{db: db}
}

func (r *DemandDomainRepo) DB() *gorm.DB {
	return r.db
}

func LegacyDemandNo(legacyType string, legacyID int64) string {
	switch legacyType {
	case "rental_demand":
		return fmt.Sprintf("DMRLEGACY%010d", legacyID)
	case "cargo_demand":
		return fmt.Sprintf("DMCLEGACY%010d", legacyID)
	default:
		return fmt.Sprintf("DMLEGACY%010d", legacyID)
	}
}

func (r *DemandDomainRepo) GetDemandByDemandNo(demandNo string) (*model.Demand, error) {
	var demand model.Demand
	err := r.db.Where("demand_no = ?", demandNo).First(&demand).Error
	if err != nil {
		return nil, err
	}
	return &demand, nil
}

func (r *DemandDomainRepo) GetDemandByID(id int64) (*model.Demand, error) {
	var demand model.Demand
	err := r.db.Where("id = ?", id).First(&demand).Error
	if err != nil {
		return nil, err
	}
	return &demand, nil
}

func (r *DemandDomainRepo) ResolveDemandIDByLegacy(legacyType string, legacyID int64) (int64, error) {
	demand, err := r.GetDemandByDemandNo(LegacyDemandNo(legacyType, legacyID))
	if err != nil {
		return 0, err
	}
	return demand.ID, nil
}

func (r *DemandDomainRepo) UpsertDemand(demand *model.Demand) error {
	if demand == nil || demand.DemandNo == "" {
		return nil
	}

	var existing model.Demand
	err := r.db.Where("demand_no = ?", demand.DemandNo).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return r.db.Create(demand).Error
	}
	if err != nil {
		return err
	}

	demand.ID = existing.ID
	return r.db.Save(demand).Error
}

func (r *DemandDomainRepo) MarkDemandCancelled(demandNo string) error {
	if demandNo == "" {
		return nil
	}
	return r.db.Model(&model.Demand{}).
		Where("demand_no = ?", demandNo).
		Updates(map[string]interface{}{"status": "cancelled"}).Error
}

func (r *DemandDomainRepo) CreateMatchingLog(log *model.MatchingLog) error {
	if log == nil {
		return nil
	}
	return r.db.Create(log).Error
}

func BuildDemandFromLegacyRental(demand *model.RentalDemand) *model.Demand {
	if demand == nil {
		return nil
	}

	startAt := demand.StartTime
	endAt := demand.EndTime
	expiresAt := demand.EndTime
	if expiresAt.IsZero() {
		expiresAt = demand.StartTime.Add(24 * time.Hour)
	}

	return &model.Demand{
		DemandNo:     LegacyDemandNo("rental_demand", demand.ID),
		ClientUserID: demand.RenterID,
		Title:        fallbackString(demand.Title, "历史需求"),
		ServiceType:  "heavy_cargo_lift_transport",
		CargoScene:   "other_heavy_lift",
		Description:  demand.Description,
		ServiceAddressSnapshot: mustJSONPayload(map[string]interface{}{
			"text":      demand.Address,
			"latitude":  demand.Latitude,
			"longitude": demand.Longitude,
			"city":      demand.City,
		}),
		ScheduledStartAt:         ptrTime(startAt),
		ScheduledEndAt:           ptrTime(endAt),
		CargoWeightKG:            demand.RequiredLoad,
		CargoVolumeM3:            0,
		CargoType:                fallbackString(normalizeLegacyDemandType(demand.DemandType), "legacy_rental"),
		CargoSpecialRequirements: "",
		EstimatedTripCount:       1,
		CargoSnapshot: mustJSONPayload(map[string]interface{}{
			"legacy_source_type": "rental_demand",
			"legacy_source_id":   demand.ID,
			"required_features":  demand.RequiredFeatures,
			"urgency":            demand.Urgency,
			"address":            demand.Address,
			"city":               demand.City,
		}),
		BudgetMin:            demand.BudgetMin,
		BudgetMax:            demand.BudgetMax,
		AllowsPilotCandidate: false,
		ExpiresAt:            ptrTime(expiresAt),
		Status:               mapLegacyDemandStatus(demand.Status),
		CreatedAt:            demand.CreatedAt,
		UpdatedAt:            demand.UpdatedAt,
	}
}

func BuildDemandFromLegacyCargo(cargo *model.CargoDemand) *model.Demand {
	if cargo == nil {
		return nil
	}

	startAt := cargo.PickupTime
	endAt := cargo.PickupTime.Add(2 * time.Hour)
	if cargo.DeliveryDeadline != nil && !cargo.DeliveryDeadline.IsZero() {
		endAt = *cargo.DeliveryDeadline
	}
	expiresAt := endAt

	return &model.Demand{
		DemandNo:     LegacyDemandNo("cargo_demand", cargo.ID),
		ClientUserID: cargo.PublisherID,
		Title:        fallbackString(buildLegacyCargoTitle(cargo), "历史货运需求"),
		ServiceType:  "heavy_cargo_lift_transport",
		CargoScene:   "other_heavy_lift",
		Description:  cargo.CargoDescription,
		DepartureAddressSnapshot: mustJSONPayload(map[string]interface{}{
			"text":      cargo.PickupAddress,
			"latitude":  cargo.PickupLatitude,
			"longitude": cargo.PickupLongitude,
		}),
		DestinationAddressSnapshot: mustJSONPayload(map[string]interface{}{
			"text":      cargo.DeliveryAddress,
			"latitude":  cargo.DeliveryLatitude,
			"longitude": cargo.DeliveryLongitude,
		}),
		ScheduledStartAt:         ptrTime(startAt),
		ScheduledEndAt:           ptrTime(endAt),
		CargoWeightKG:            cargo.CargoWeight,
		CargoVolumeM3:            cargoVolumeM3(cargo.CargoSize),
		CargoType:                fallbackString(cargo.CargoType, "legacy_cargo"),
		CargoSpecialRequirements: cargo.SpecialRequirements,
		EstimatedTripCount:       1,
		CargoSnapshot: mustJSONPayload(map[string]interface{}{
			"legacy_source_type": "cargo_demand",
			"legacy_source_id":   cargo.ID,
			"cargo_size":         cargo.CargoSize,
			"distance_km":        cargo.Distance,
			"images":             cargo.Images,
			"pickup_address":     cargo.PickupAddress,
			"delivery_address":   cargo.DeliveryAddress,
		}),
		BudgetMin:            cargo.OfferedPrice,
		BudgetMax:            cargo.OfferedPrice,
		AllowsPilotCandidate: false,
		ExpiresAt:            ptrTime(expiresAt),
		Status:               mapLegacyDemandStatus(cargo.Status),
		CreatedAt:            cargo.CreatedAt,
		UpdatedAt:            cargo.UpdatedAt,
	}
}

func BuildMatchingLogFromLegacyRecord(demandID int64, legacyRecord *model.MatchingRecord) *model.MatchingLog {
	if demandID == 0 || legacyRecord == nil {
		return nil
	}

	actionType := "recommend_owner"
	if legacyRecord.Status == "viewed" {
		actionType = "quote_rank"
	}

	return &model.MatchingLog{
		DemandID:   demandID,
		ActorType:  "system",
		ActionType: actionType,
		ResultSnapshot: mustJSONPayload(map[string]interface{}{
			"legacy_matching_record_id": legacyRecord.ID,
			"legacy_demand_type":        legacyRecord.DemandType,
			"legacy_supply_id":          legacyRecord.SupplyID,
			"legacy_supply_type":        legacyRecord.SupplyType,
			"match_score":               legacyRecord.MatchScore,
			"match_reason":              legacyRecord.MatchReason,
			"legacy_status":             legacyRecord.Status,
		}),
		CreatedAt: legacyRecord.CreatedAt,
	}
}

func BuildMatchingLogSnapshot(records []model.MatchingRecord, radiusKM float64, legacyType string, legacyID int64) model.JSON {
	items := make([]map[string]interface{}, 0, len(records))
	for _, record := range records {
		items = append(items, map[string]interface{}{
			"legacy_matching_record_id": record.ID,
			"legacy_supply_id":          record.SupplyID,
			"legacy_supply_type":        record.SupplyType,
			"match_score":               record.MatchScore,
			"status":                    record.Status,
			"match_reason":              record.MatchReason,
		})
	}

	return mustJSONPayload(map[string]interface{}{
		"legacy_source_type": legacyType,
		"legacy_source_id":   legacyID,
		"radius_km":          radiusKM,
		"matches":            items,
	})
}

func mapLegacyDemandStatus(status string) string {
	switch strings.ToLower(status) {
	case "", "active", "open":
		return "published"
	case "quoting", "matching", "matched":
		return "quoting"
	case "selected":
		return "selected"
	case "ordered", "converted", "completed":
		return "converted_to_order"
	case "expired":
		return "expired"
	case "cancelled", "canceled", "closed", "deleted":
		return "cancelled"
	default:
		return "published"
	}
}

func normalizeLegacyDemandType(demandType string) string {
	if demandType == "" {
		return "legacy_rental"
	}
	return demandType
}

func buildLegacyCargoTitle(cargo *model.CargoDemand) string {
	if cargo == nil {
		return ""
	}
	if cargo.CargoDescription != "" {
		return cargo.CargoDescription
	}
	if cargo.CargoType != "" {
		return cargo.CargoType + "吊运需求"
	}
	return "货物吊运需求"
}

func cargoVolumeM3(size model.JSON) float64 {
	if len(size) == 0 {
		return 0
	}
	var payload map[string]float64
	if err := json.Unmarshal(size, &payload); err != nil {
		return 0
	}
	length := payload["length"]
	width := payload["width"]
	height := payload["height"]
	if length <= 0 || width <= 0 || height <= 0 {
		return 0
	}
	return math.Round((length*width*height/1000000)*1000) / 1000
}

func ptrTime(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	return &t
}

func fallbackString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func mustJSONPayload(v interface{}) model.JSON {
	data, _ := json.Marshal(v)
	return model.JSON(data)
}
