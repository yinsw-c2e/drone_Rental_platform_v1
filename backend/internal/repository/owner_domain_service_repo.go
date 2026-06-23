package repository

import (
	"math"
	"sort"
	"strings"
	"time"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/limits"
)

type SupplyMarketStats struct {
	TotalOrderCount        int64
	CompletedOrderCount    int64
	AverageResponseSeconds int64
	ResponseSampleCount    int64
	Rating                 float64
	RatingCount            int64
	RatingSource           string
}

type supplyWithDistance struct {
	supply   model.OwnerSupply
	distance float64
}

func hasMarketCoordinate(lat, lng float64) bool {
	return lat >= -90 && lat <= 90 &&
		lng >= -180 && lng <= 180 &&
		!(lat == 0 && lng == 0)
}

func haversineKM(lat1, lng1, lat2, lng2 float64) float64 {
	const earthRadiusKM = 6371.0
	toRad := func(value float64) float64 { return value * math.Pi / 180 }
	dLat := toRad(lat2 - lat1)
	dLng := toRad(lng2 - lng1)
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(toRad(lat1))*math.Cos(toRad(lat2))*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * earthRadiusKM * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

func supplyRangeKM(supply model.OwnerSupply) float64 {
	if supply.MaxRangeKM > 0 {
		return supply.MaxRangeKM
	}
	if supply.Drone != nil && supply.Drone.MaxDistance > 0 {
		return supply.Drone.MaxDistance
	}
	return 0
}

func supplyDistanceFromOrigin(supply model.OwnerSupply, originLat, originLng float64) (float64, bool) {
	if supply.Drone == nil || !hasMarketCoordinate(supply.Drone.Latitude, supply.Drone.Longitude) {
		return 0, false
	}
	return haversineKM(originLat, originLng, supply.Drone.Latitude, supply.Drone.Longitude), true
}

func regionSearchTerms(region string) []string {
	trimmed := strings.TrimSpace(region)
	if trimmed == "" {
		return nil
	}
	seen := map[string]struct{}{}
	terms := make([]string, 0, 3)
	add := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" {
			return
		}
		if _, ok := seen[value]; ok {
			return
		}
		seen[value] = struct{}{}
		terms = append(terms, value)
	}

	add(trimmed)
	short := strings.TrimSuffix(trimmed, "市")
	short = strings.TrimPrefix(short, "广东省")
	short = strings.TrimSuffix(short, "市")
	add(short)
	return terms
}

func (r *OwnerDomainRepo) ListMarketplaceSupplies(region, keyword, cargoScene, serviceType string, minPayloadKG float64, acceptsDirectOrder *bool, originLat, originLng float64, page, pageSize int) ([]model.OwnerSupply, int64, error) {
	var supplies []model.OwnerSupply
	var total int64
	page, pageSize = limits.NormalizePagination(page, pageSize)
	useOriginCoordinate := hasMarketCoordinate(originLat, originLng)

	query := r.db.Model(&model.OwnerSupply{}).
		Joins("JOIN drones ON drones.id = owner_supplies.drone_id AND drones.deleted_at IS NULL").
		Where("owner_supplies.status = ?", "active").
		Where("owner_supplies.mtow_kg >= ? AND owner_supplies.max_payload_kg >= ?", model.HeavyLiftMinMTOWKG, model.HeavyLiftMinPayloadKG).
		Where("drones.availability_status = ?", "available").
		Where("drones.certification_status = ?", "approved").
		Where("drones.uom_verified = ?", "verified").
		Where("drones.insurance_verified = ?", "verified").
		Where("drones.airworthiness_verified = ?", "verified")

	if terms := regionSearchTerms(region); len(terms) > 0 && !useOriginCoordinate {
		conditions := make([]string, 0, len(terms))
		values := make([]interface{}, 0, len(terms)*2)
		for _, term := range terms {
			conditions = append(conditions, "(drones.city LIKE ? OR CAST(owner_supplies.service_area_snapshot AS CHAR) LIKE ?)")
			like := "%" + term + "%"
			values = append(values, like, like)
		}
		query = query.Where(strings.Join(conditions, " OR "), values...)
	}
	if trimmed := strings.TrimSpace(keyword); trimmed != "" {
		like := "%" + trimmed + "%"
		query = query.Where(
			`(
				owner_supplies.title LIKE ? OR
				owner_supplies.supply_no LIKE ? OR
				CAST(owner_supplies.cargo_scenes AS CHAR) LIKE ? OR
				CAST(owner_supplies.service_area_snapshot AS CHAR) LIKE ? OR
				drones.city LIKE ? OR
				drones.brand LIKE ? OR
				drones.model LIKE ? OR
				drones.serial_number LIKE ?
			)`,
			like, like, like, like, like, like, like, like,
		)
	}
	if trimmed := strings.TrimSpace(cargoScene); trimmed != "" {
		query = query.Where("JSON_CONTAINS(owner_supplies.cargo_scenes, JSON_ARRAY(?))", trimmed)
	}
	if trimmed := strings.TrimSpace(serviceType); trimmed != "" {
		query = query.Where("JSON_CONTAINS(owner_supplies.service_types, JSON_ARRAY(?))", trimmed)
	}
	if minPayloadKG > 0 {
		query = query.Where("owner_supplies.max_payload_kg >= ?", minPayloadKG)
	}
	if acceptsDirectOrder != nil {
		query = query.Where("owner_supplies.accepts_direct_order = ?", *acceptsDirectOrder)
	}

	if useOriginCoordinate {
		var candidates []model.OwnerSupply
		if err := query.
			Preload("Drone").
			Preload("Owner").
			Order("owner_supplies.updated_at DESC, owner_supplies.id DESC").
			Find(&candidates).Error; err != nil {
			return nil, 0, err
		}

		filtered := make([]supplyWithDistance, 0, len(candidates))
		for _, supply := range candidates {
			distance, ok := supplyDistanceFromOrigin(supply, originLat, originLng)
			if !ok {
				continue
			}
			rangeKM := supplyRangeKM(supply)
			if rangeKM <= 0 || distance > rangeKM {
				continue
			}
			filtered = append(filtered, supplyWithDistance{supply: supply, distance: distance})
		}
		sort.SliceStable(filtered, func(i, j int) bool {
			if math.Abs(filtered[i].distance-filtered[j].distance) > 0.001 {
				return filtered[i].distance < filtered[j].distance
			}
			if !filtered[i].supply.UpdatedAt.Equal(filtered[j].supply.UpdatedAt) {
				return filtered[i].supply.UpdatedAt.After(filtered[j].supply.UpdatedAt)
			}
			return filtered[i].supply.ID > filtered[j].supply.ID
		})

		total = int64(len(filtered))
		start := (page - 1) * pageSize
		if start >= len(filtered) {
			return []model.OwnerSupply{}, total, nil
		}
		end := start + pageSize
		if end > len(filtered) {
			end = len(filtered)
		}
		supplies = make([]model.OwnerSupply, 0, end-start)
		for _, item := range filtered[start:end] {
			supplies = append(supplies, item.supply)
		}
		return supplies, total, nil
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.
		Preload("Drone").
		Preload("Owner").
		Order("owner_supplies.updated_at DESC, owner_supplies.id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&supplies).Error
	return supplies, total, err
}

func (r *OwnerDomainRepo) GetMarketplaceSupplyByID(id int64) (*model.OwnerSupply, error) {
	var supply model.OwnerSupply
	err := r.db.Model(&model.OwnerSupply{}).
		Joins("JOIN drones ON drones.id = owner_supplies.drone_id AND drones.deleted_at IS NULL").
		Preload("Drone").
		Preload("Owner").
		Where("owner_supplies.id = ?", id).
		Where("owner_supplies.status = ?", "active").
		Where("owner_supplies.mtow_kg >= ? AND owner_supplies.max_payload_kg >= ?", model.HeavyLiftMinMTOWKG, model.HeavyLiftMinPayloadKG).
		Where("drones.availability_status = ?", "available").
		Where("drones.certification_status = ?", "approved").
		Where("drones.uom_verified = ?", "verified").
		Where("drones.insurance_verified = ?", "verified").
		Where("drones.airworthiness_verified = ?", "verified").
		First(&supply).Error
	if err != nil {
		return nil, err
	}
	return &supply, nil
}

func (r *OwnerDomainRepo) GetMarketplaceSupplyStats(supplies []model.OwnerSupply) (map[int64]SupplyMarketStats, error) {
	result := make(map[int64]SupplyMarketStats, len(supplies))
	if len(supplies) == 0 {
		return result, nil
	}

	supplyIDs := make([]int64, 0, len(supplies))
	ownerIDs := make([]int64, 0, len(supplies))
	droneIDs := make([]int64, 0, len(supplies))
	ownerBySupply := make(map[int64]int64, len(supplies))
	droneBySupply := make(map[int64]int64, len(supplies))
	seenSupply := make(map[int64]struct{}, len(supplies))
	seenOwner := make(map[int64]struct{}, len(supplies))
	seenDrone := make(map[int64]struct{}, len(supplies))

	for i := range supplies {
		supply := supplies[i]
		if supply.ID <= 0 {
			continue
		}
		if _, ok := seenSupply[supply.ID]; !ok {
			supplyIDs = append(supplyIDs, supply.ID)
			seenSupply[supply.ID] = struct{}{}
			result[supply.ID] = SupplyMarketStats{}
		}
		if supply.OwnerUserID > 0 {
			ownerBySupply[supply.ID] = supply.OwnerUserID
			if _, ok := seenOwner[supply.OwnerUserID]; !ok {
				ownerIDs = append(ownerIDs, supply.OwnerUserID)
				seenOwner[supply.OwnerUserID] = struct{}{}
			}
		}
		if supply.DroneID > 0 {
			droneBySupply[supply.ID] = supply.DroneID
			if _, ok := seenDrone[supply.DroneID]; !ok {
				droneIDs = append(droneIDs, supply.DroneID)
				seenDrone[supply.DroneID] = struct{}{}
			}
		}
	}
	if len(supplyIDs) == 0 {
		return result, nil
	}

	var orders []model.Order
	if err := r.db.
		Select("source_supply_id, status, created_at, provider_confirmed_at").
		Where("source_supply_id IN ?", supplyIDs).
		Find(&orders).Error; err != nil {
		return nil, err
	}
	responseTotals := make(map[int64]int64, len(supplyIDs))
	for i := range orders {
		order := orders[i]
		if order.SourceSupplyID <= 0 {
			continue
		}
		stats := result[order.SourceSupplyID]
		status := strings.TrimSpace(strings.ToLower(order.Status))
		if status != "cancelled" && status != "refunded" {
			stats.TotalOrderCount++
		}
		if status == "completed" {
			stats.CompletedOrderCount++
		}
		if order.ProviderConfirmedAt != nil && !order.CreatedAt.IsZero() && order.ProviderConfirmedAt.After(order.CreatedAt) {
			responseTotals[order.SourceSupplyID] += int64(order.ProviderConfirmedAt.Sub(order.CreatedAt).Seconds())
			stats.ResponseSampleCount++
		}
		result[order.SourceSupplyID] = stats
	}
	for supplyID, totalSeconds := range responseTotals {
		stats := result[supplyID]
		if stats.ResponseSampleCount > 0 {
			stats.AverageResponseSeconds = int64(math.Round(float64(totalSeconds) / float64(stats.ResponseSampleCount)))
			result[supplyID] = stats
		}
	}

	ownerRatings, err := r.loadSupplyRatings("user", ownerIDs)
	if err != nil {
		return nil, err
	}
	droneRatings, err := r.loadSupplyRatings("drone", droneIDs)
	if err != nil {
		return nil, err
	}
	for _, supplyID := range supplyIDs {
		stats := result[supplyID]
		if ownerRating, ok := ownerRatings[ownerBySupply[supplyID]]; ok && ownerRating.RatingCount > 0 {
			stats.Rating = ownerRating.Rating
			stats.RatingCount = ownerRating.RatingCount
			stats.RatingSource = "provider_reviews"
		} else if droneRating, ok := droneRatings[droneBySupply[supplyID]]; ok && droneRating.RatingCount > 0 {
			stats.Rating = droneRating.Rating
			stats.RatingCount = droneRating.RatingCount
			stats.RatingSource = "drone_reviews"
		}
		result[supplyID] = stats
	}

	return result, nil
}

func (r *OwnerDomainRepo) loadSupplyRatings(targetType string, targetIDs []int64) (map[int64]SupplyMarketStats, error) {
	result := make(map[int64]SupplyMarketStats, len(targetIDs))
	if len(targetIDs) == 0 {
		return result, nil
	}

	var rows []struct {
		TargetID    int64
		Rating      float64
		RatingCount int64
	}
	if err := r.db.Model(&model.Review{}).
		Select("target_id, COALESCE(AVG(rating), 0) AS rating, COUNT(*) AS rating_count").
		Where("target_type = ? AND target_id IN ? AND rating > 0", targetType, targetIDs).
		Group("target_id").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[row.TargetID] = SupplyMarketStats{
			Rating:      math.Round(row.Rating*10) / 10,
			RatingCount: row.RatingCount,
		}
	}
	return result, nil
}

func (r *OwnerDomainRepo) ListSuppliesByOwner(ownerUserID int64, status string, page, pageSize int) ([]model.OwnerSupply, int64, error) {
	var supplies []model.OwnerSupply
	var total int64
	page, pageSize = limits.NormalizePagination(page, pageSize)

	query := r.db.Model(&model.OwnerSupply{}).Where("owner_user_id = ?", ownerUserID)
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.
		Preload("Drone").
		Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&supplies).Error
	return supplies, total, err
}

func (r *OwnerDomainRepo) AdminListSupplies(page, pageSize int, filters map[string]interface{}) ([]model.OwnerSupply, int64, error) {
	var supplies []model.OwnerSupply
	var total int64
	page, pageSize = limits.NormalizePagination(page, pageSize)

	query := r.db.Model(&model.OwnerSupply{}).
		Joins("LEFT JOIN drones ON drones.id = owner_supplies.drone_id AND drones.deleted_at IS NULL").
		Joins("LEFT JOIN users ON users.id = owner_supplies.owner_user_id")

	if status, ok := filters["status"].(string); ok && strings.TrimSpace(status) != "" {
		query = query.Where("owner_supplies.status = ?", strings.TrimSpace(status))
	}
	if cargoScene, ok := filters["cargo_scene"].(string); ok && strings.TrimSpace(cargoScene) != "" {
		query = query.Where("JSON_CONTAINS(owner_supplies.cargo_scenes, JSON_ARRAY(?))", strings.TrimSpace(cargoScene))
	}
	if keyword, ok := filters["keyword"].(string); ok && strings.TrimSpace(keyword) != "" {
		like := "%" + strings.TrimSpace(keyword) + "%"
		query = query.Where(`
			owner_supplies.supply_no LIKE ? OR
			owner_supplies.title LIKE ? OR
			drones.serial_number LIKE ? OR
			drones.model LIKE ? OR
			users.nickname LIKE ?
		`, like, like, like, like, like)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.
		Preload("Drone").
		Preload("Owner").
		Order("owner_supplies.updated_at DESC, owner_supplies.id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&supplies).Error
	return supplies, total, err
}

func (r *OwnerDomainRepo) GetSupplyByIDAndOwner(id, ownerUserID int64) (*model.OwnerSupply, error) {
	var supply model.OwnerSupply
	err := r.db.
		Preload("Drone").
		Where("id = ? AND owner_user_id = ?", id, ownerUserID).
		First(&supply).Error
	if err != nil {
		return nil, err
	}
	return &supply, nil
}

func (r *OwnerDomainRepo) CreateSupply(supply *model.OwnerSupply) error {
	if supply == nil {
		return nil
	}
	return r.db.Create(supply).Error
}

func (r *OwnerDomainRepo) UpdateSupply(supply *model.OwnerSupply) error {
	if supply == nil {
		return nil
	}
	return r.db.Save(supply).Error
}

func (r *OwnerDomainRepo) UpdateSupplyFields(id int64, fields map[string]interface{}) error {
	if id == 0 || len(fields) == 0 {
		return nil
	}
	return r.db.Model(&model.OwnerSupply{}).Where("id = ?", id).Updates(fields).Error
}

func (r *OwnerDomainRepo) ListBindingsByOwner(ownerUserID int64, status string, page, pageSize int) ([]model.OwnerPilotBinding, int64, error) {
	var bindings []model.OwnerPilotBinding
	var total int64
	page, pageSize = limits.NormalizePagination(page, pageSize)

	query := r.db.Model(&model.OwnerPilotBinding{}).Where("owner_user_id = ?", ownerUserID)
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.
		Preload("Pilot").
		Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&bindings).Error
	return bindings, total, err
}

func (r *OwnerDomainRepo) GetBindingByID(id int64) (*model.OwnerPilotBinding, error) {
	var binding model.OwnerPilotBinding
	err := r.db.Preload("Pilot").Preload("Owner").Where("id = ?", id).First(&binding).Error
	if err != nil {
		return nil, err
	}
	return &binding, nil
}

func (r *OwnerDomainRepo) CreateBinding(binding *model.OwnerPilotBinding) error {
	if binding == nil {
		return nil
	}
	return r.db.Create(binding).Error
}

func (r *OwnerDomainRepo) UpdateBindingFields(id int64, fields map[string]interface{}) error {
	if id == 0 || len(fields) == 0 {
		return nil
	}
	return r.db.Model(&model.OwnerPilotBinding{}).Where("id = ?", id).Updates(fields).Error
}

func (r *OwnerDomainRepo) ListExpiredPendingBindings(cutoff time.Time, limit int) ([]model.OwnerPilotBinding, error) {
	if limit <= 0 {
		limit = 100
	}
	var bindings []model.OwnerPilotBinding
	err := r.db.
		Where("status = ?", "pending_confirmation").
		Where("created_at <= ?", cutoff).
		Order("created_at ASC, id ASC").
		Limit(limit).
		Find(&bindings).Error
	return bindings, err
}

type RecommendedDemandQuery struct {
	ServiceType string
	Region      string
	CargoScene  string
	MinWeightKG float64
	MaxWeightKG float64
	StartFrom   *time.Time
	StartTo     *time.Time
	Sort        string
}

func (r *DemandDomainRepo) ListRecommendedDemands(filter RecommendedDemandQuery, page, pageSize int) ([]model.Demand, int64, error) {
	var demands []model.Demand
	var total int64
	page, pageSize = limits.NormalizePagination(page, pageSize)

	query := r.db.Model(&model.Demand{}).
		Where("status IN ?", []string{"published", "quoting"}).
		Where("(expires_at IS NULL OR expires_at > ?)", time.Now())

	if trimmed := strings.TrimSpace(filter.ServiceType); trimmed != "" {
		query = query.Where("service_type = ?", trimmed)
	}
	if trimmed := strings.TrimSpace(filter.Region); trimmed != "" {
		like := "%" + trimmed + "%"
		query = query.Where(
			`(
				title LIKE ? OR
				CAST(service_address_snapshot AS CHAR) LIKE ? OR
				CAST(departure_address_snapshot AS CHAR) LIKE ? OR
				CAST(destination_address_snapshot AS CHAR) LIKE ?
			)`,
			like, like, like, like,
		)
	}
	if trimmed := strings.TrimSpace(filter.CargoScene); trimmed != "" {
		query = query.Where("cargo_scene = ?", trimmed)
	}
	if filter.MinWeightKG > 0 {
		query = query.Where("cargo_weight_kg >= ?", filter.MinWeightKG)
	}
	if filter.MaxWeightKG > 0 {
		query = query.Where("cargo_weight_kg <= ?", filter.MaxWeightKG)
	}
	if filter.StartFrom != nil {
		query = query.Where("scheduled_start_at >= ?", *filter.StartFrom)
	}
	if filter.StartTo != nil {
		query = query.Where("scheduled_start_at < ?", *filter.StartTo)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	orderBy := "created_at DESC, id DESC"
	switch strings.TrimSpace(filter.Sort) {
	case "price":
		orderBy = "CASE WHEN budget_min > 0 THEN budget_min WHEN budget_max > 0 THEN budget_max ELSE 9223372036854775807 END ASC, created_at DESC, id DESC"
	case "latest", "created_at", "distance":
		orderBy = "created_at DESC, id DESC"
	}

	err := query.
		Order(orderBy).
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&demands).Error
	return demands, total, err
}

func (r *DemandDomainRepo) GetQuoteByDemandAndOwner(demandID, ownerUserID int64) (*model.DemandQuote, error) {
	var quote model.DemandQuote
	err := r.db.Where("demand_id = ? AND owner_user_id = ?", demandID, ownerUserID).
		Order("id DESC").
		First(&quote).Error
	if err != nil {
		return nil, err
	}
	return &quote, nil
}

func (r *DemandDomainRepo) ListQuotesByOwner(ownerUserID int64, status string, page, pageSize int) ([]model.DemandQuote, int64, error) {
	var quotes []model.DemandQuote
	var total int64
	page, pageSize = limits.NormalizePagination(page, pageSize)

	query := r.db.Model(&model.DemandQuote{}).Where("owner_user_id = ?", ownerUserID)
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.
		Preload("Demand").
		Preload("Drone").
		Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&quotes).Error
	return quotes, total, err
}
