package repository

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"wurenji-backend/internal/model"
)

type OwnerDomainRepo struct {
	db *gorm.DB
}

func NewOwnerDomainRepo(db *gorm.DB) *OwnerDomainRepo {
	return &OwnerDomainRepo{db: db}
}

func (r *OwnerDomainRepo) DB() *gorm.DB {
	return r.db
}

func LegacySupplyNo(offerID int64) string {
	return fmt.Sprintf("SPLEGACY%010d", offerID)
}

func (r *OwnerDomainRepo) GetSupplyBySupplyNo(supplyNo string) (*model.OwnerSupply, error) {
	var supply model.OwnerSupply
	err := r.db.Where("supply_no = ?", supplyNo).First(&supply).Error
	if err != nil {
		return nil, err
	}
	return &supply, nil
}

func (r *OwnerDomainRepo) GetPreferredSupplyByOwnerDrone(ownerUserID, droneID int64) (*model.OwnerSupply, error) {
	var supply model.OwnerSupply
	err := r.db.
		Where("owner_user_id = ? AND drone_id = ?", ownerUserID, droneID).
		Order("CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END").
		Order("updated_at DESC").
		First(&supply).Error
	if err != nil {
		return nil, err
	}
	return &supply, nil
}

func (r *OwnerDomainRepo) GetSupplyByID(id int64) (*model.OwnerSupply, error) {
	var supply model.OwnerSupply
	err := r.db.Where("id = ?", id).First(&supply).Error
	if err != nil {
		return nil, err
	}
	return &supply, nil
}

func (r *OwnerDomainRepo) UpsertSupply(supply *model.OwnerSupply) error {
	if supply == nil || supply.SupplyNo == "" {
		return nil
	}

	var existing model.OwnerSupply
	err := r.db.Where("supply_no = ?", supply.SupplyNo).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return r.db.Create(supply).Error
	}
	if err != nil {
		return err
	}

	supply.ID = existing.ID
	return r.db.Save(supply).Error
}

func (r *OwnerDomainRepo) CloseSupplyBySupplyNo(supplyNo string) error {
	if supplyNo == "" {
		return nil
	}
	return r.db.Model(&model.OwnerSupply{}).
		Where("supply_no = ?", supplyNo).
		Updates(map[string]interface{}{"status": "closed"}).Error
}

func (r *OwnerDomainRepo) SyncSupplyCapabilityByDrone(drone *model.Drone) error {
	if drone == nil {
		return nil
	}

	updates := map[string]interface{}{
		"mtow_kg":        drone.MTOWKG,
		"max_payload_kg": drone.EffectivePayloadKG(),
		"max_range_km":   drone.MaxDistance,
		"updated_at":     time.Now(),
	}

	if err := r.db.Model(&model.OwnerSupply{}).
		Where("drone_id = ? AND deleted_at IS NULL", drone.ID).
		Updates(updates).Error; err != nil {
		return err
	}

	if drone.EligibleForMarketplace() {
		return r.reactivateLegacySupplyIfEligible(drone)
	}

	return r.db.Model(&model.OwnerSupply{}).
		Where("drone_id = ? AND deleted_at IS NULL AND status = ?", drone.ID, "active").
		Update("status", "paused").Error
}

func (r *OwnerDomainRepo) reactivateLegacySupplyIfEligible(drone *model.Drone) error {
	if drone == nil {
		return nil
	}

	return r.db.Exec(`
		UPDATE owner_supplies os
		JOIN rental_offers ro
		  ON os.supply_no = CONCAT('SPLEGACY', LPAD(ro.id, 10, '0'))
		SET os.status = 'active',
		    os.updated_at = ?
		WHERE os.drone_id = ?
		  AND os.deleted_at IS NULL
		  AND os.status = 'paused'
		  AND ro.deleted_at IS NULL
		  AND ro.status = 'active'
	`, time.Now(), drone.ID).Error
}

func (r *OwnerDomainRepo) GetLatestBindableRecord(ownerUserID, pilotUserID int64) (*model.OwnerPilotBinding, error) {
	var binding model.OwnerPilotBinding
	err := r.db.
		Where("owner_user_id = ? AND pilot_user_id = ? AND status IN ?", ownerUserID, pilotUserID, []string{"pending_confirmation", "active", "paused"}).
		Order("id DESC").
		First(&binding).Error
	if err != nil {
		return nil, err
	}
	return &binding, nil
}

func (r *OwnerDomainRepo) EnsureActiveBinding(ownerUserID, pilotUserID int64, note string, confirmedAt time.Time) error {
	if ownerUserID == 0 || pilotUserID == 0 {
		return nil
	}

	existing, err := r.GetLatestBindableRecord(ownerUserID, pilotUserID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return r.db.Create(&model.OwnerPilotBinding{
			OwnerUserID: ownerUserID,
			PilotUserID: pilotUserID,
			InitiatedBy: "owner",
			Status:      "active",
			IsPriority:  false,
			Note:        note,
			ConfirmedAt: &confirmedAt,
		}).Error
	}
	if err != nil {
		return err
	}

	updates := map[string]interface{}{
		"initiated_by": "owner",
		"status":       "active",
		"dissolved_at": nil,
	}
	if note != "" {
		updates["note"] = note
	}
	if confirmedAt.IsZero() {
		now := time.Now()
		updates["confirmed_at"] = &now
	} else {
		updates["confirmed_at"] = &confirmedAt
	}

	return r.db.Model(&model.OwnerPilotBinding{}).Where("id = ?", existing.ID).Updates(updates).Error
}

func (r *OwnerDomainRepo) DissolveBinding(ownerUserID, pilotUserID int64, dissolvedAt time.Time) error {
	if ownerUserID == 0 || pilotUserID == 0 {
		return nil
	}

	existing, err := r.GetLatestBindableRecord(ownerUserID, pilotUserID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}

	if dissolvedAt.IsZero() {
		dissolvedAt = time.Now()
	}

	return r.db.Model(&model.OwnerPilotBinding{}).
		Where("id = ?", existing.ID).
		Updates(map[string]interface{}{
			"status":       "dissolved",
			"dissolved_at": &dissolvedAt,
		}).Error
}

func BuildOwnerSupplyFromLegacyOffer(offer *model.RentalOffer, drone *model.Drone) *model.OwnerSupply {
	if offer == nil {
		return nil
	}

	supply := &model.OwnerSupply{
		SupplyNo:     LegacySupplyNo(offer.ID),
		OwnerUserID:  offer.OwnerID,
		DroneID:      offer.DroneID,
		Title:        offer.Title,
		Description:  offer.Description,
		ServiceTypes: mustJSON([]string{"heavy_cargo_lift_transport"}),
		CargoScenes:  mustJSON([]string{}),
		ServiceAreaSnapshot: mustJSON(map[string]interface{}{
			"address":           offer.Address,
			"latitude":          offer.Latitude,
			"longitude":         offer.Longitude,
			"service_radius_km": offer.ServiceRadius,
		}),
		MTOWKG:             0,
		BasePriceAmount:    offer.Price,
		PricingUnit:        mapLegacyPricingUnit(offer.PriceType),
		PricingRule:        mustJSON(buildLegacyPricingRule(offer)),
		AvailableTimeSlots: buildLegacyAvailableTimeSlots(offer),
		AcceptsDirectOrder: offer.Status == "active",
		Status:             mapLegacySupplyStatus(offer, drone),
		CreatedAt:          offer.CreatedAt,
		UpdatedAt:          offer.UpdatedAt,
		DeletedAt:          offer.DeletedAt,
	}

	if drone != nil {
		supply.MTOWKG = drone.MTOWKG
		supply.MaxPayloadKG = drone.EffectivePayloadKG()
		supply.MaxRangeKM = drone.MaxDistance
		if area := buildLegacyServiceAreaSnapshot(offer, drone); area != nil {
			supply.ServiceAreaSnapshot = mustJSON(area)
		}
	}

	return supply
}

func mapLegacyPricingUnit(priceType string) string {
	switch priceType {
	case "hourly":
		return "per_hour"
	case "daily", "fixed":
		return "per_trip"
	default:
		return "per_trip"
	}
}

func buildLegacyPricingRule(offer *model.RentalOffer) map[string]interface{} {
	if offer == nil {
		return map[string]interface{}{}
	}
	return map[string]interface{}{
		"legacy_offer_id":     offer.ID,
		"legacy_service_type": offer.ServiceType,
		"legacy_price_type":   offer.PriceType,
	}
}

func buildLegacyAvailableTimeSlots(offer *model.RentalOffer) model.JSON {
	if offer == nil || offer.AvailableFrom.IsZero() || offer.AvailableTo.IsZero() {
		return mustJSON([]map[string]interface{}{})
	}
	return mustJSON([]map[string]interface{}{
		{
			"start_at": offer.AvailableFrom.Format(time.DateTime),
			"end_at":   offer.AvailableTo.Format(time.DateTime),
		},
	})
}

func buildLegacyServiceAreaSnapshot(offer *model.RentalOffer, drone *model.Drone) map[string]interface{} {
	if offer == nil {
		return nil
	}
	area := map[string]interface{}{
		"address":           offer.Address,
		"latitude":          offer.Latitude,
		"longitude":         offer.Longitude,
		"service_radius_km": offer.ServiceRadius,
	}
	if drone != nil && drone.City != "" {
		area["city"] = drone.City
	}
	return area
}

func mapLegacySupplyStatus(offer *model.RentalOffer, drone *model.Drone) string {
	if offer == nil {
		return "draft"
	}
	if offer.DeletedAt.Valid {
		return "closed"
	}

	switch offer.Status {
	case "active":
		if droneEligibleForMarketplace(drone) {
			return "active"
		}
		return "paused"
	case "inactive", "paused", "offline", "maintenance":
		return "paused"
	case "closed":
		return "closed"
	default:
		return "draft"
	}
}

func legacyDroneEligibleForSupply(drone *model.Drone) bool {
	return droneEligibleForMarketplace(drone)
}

func droneEligibleForMarketplace(drone *model.Drone) bool {
	if drone == nil {
		return false
	}
	return drone.EligibleForMarketplace()
}

func mustJSON(v interface{}) model.JSON {
	data, _ := json.Marshal(v)
	return model.JSON(data)
}
