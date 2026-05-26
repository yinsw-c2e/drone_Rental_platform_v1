package supply

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	v2common "wurenji-backend/internal/api/v2/common"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	clientService *service.ClientService
}

func NewHandler(clientService *service.ClientService) *Handler {
	return &Handler{clientService: clientService}
}

func (h *Handler) List(c *gin.Context) {
	page, pageSize := middleware.GetPagination(c)

	query := service.SupplyMarketQuery{
		Region:      c.Query("region"),
		Keyword:     c.Query("keyword"),
		CargoScene:  c.Query("cargo_scene"),
		ServiceType: c.Query("service_type"),
	}

	if raw := c.Query("min_payload_kg"); raw != "" {
		value, err := strconv.ParseFloat(raw, 64)
		if err != nil || value < 0 {
			response.V2ValidationError(c, "invalid min_payload_kg")
			return
		}
		query.MinPayloadKG = value
	}
	if raw := c.Query("accepts_direct_order"); raw != "" {
		value, err := strconv.ParseBool(raw)
		if err != nil {
			response.V2ValidationError(c, "invalid accepts_direct_order")
			return
		}
		query.AcceptsDirectOrder = &value
	}

	supplies, total, err := h.clientService.ListMarketplaceSupplies(query, page, pageSize)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	stats, err := h.clientService.GetMarketplaceSupplyStats(supplies)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	items := make([]gin.H, 0, len(supplies))
	for i := range supplies {
		items = append(items, buildSupplySummary(&supplies[i], stats[supplies[i].ID]))
	}

	response.V2SuccessList(c, items, total)
}

func (h *Handler) Get(c *gin.Context) {
	supplyID, err := strconv.ParseInt(c.Param("supply_id"), 10, 64)
	if err != nil || supplyID <= 0 {
		response.V2ValidationError(c, "invalid supply_id")
		return
	}

	supply, err := h.clientService.GetMarketplaceSupplyDetail(supplyID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	stats, err := h.clientService.GetMarketplaceSupplyStats([]model.OwnerSupply{*supply})
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	response.V2Success(c, buildSupplyDetail(supply, stats[supply.ID]))
}

func (h *Handler) CreateDirectOrder(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	supplyID, err := strconv.ParseInt(c.Param("supply_id"), 10, 64)
	if err != nil || supplyID <= 0 {
		response.V2ValidationError(c, "invalid supply_id")
		return
	}

	var req service.DirectOrderInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid direct order payload")
		return
	}

	result, err := h.clientService.CreateDirectSupplyOrder(userID, supplyID, &req)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	response.V2Success(c, result)
}

func buildSupplySummary(supply *model.OwnerSupply, stats service.SupplyMarketStats) gin.H {
	if supply == nil {
		return gin.H{}
	}
	data := gin.H{
		"id":                    supply.ID,
		"supply_no":             supply.SupplyNo,
		"title":                 supply.Title,
		"owner_user_id":         supply.OwnerUserID,
		"service_types":         v2common.SafeJSONValue(supply.ServiceTypes),
		"cargo_scenes":          v2common.SafeJSONValue(supply.CargoScenes),
		"mtow_kg":               supply.MTOWKG,
		"max_payload_kg":        supply.MaxPayloadKG,
		"base_price_amount":     supply.BasePriceAmount,
		"pricing_unit":          supply.PricingUnit,
		"accepts_direct_order":  supply.AcceptsDirectOrder,
		"status":                supply.Status,
		"service_area_snapshot": v2common.SafeJSONValue(supply.ServiceAreaSnapshot),
		"max_range_km":          supply.MaxRangeKM,
		"updated_at":            supply.UpdatedAt,
	}
	if supply.Owner != nil {
		data["owner"] = gin.H{
			"id":         supply.Owner.ID,
			"nickname":   supply.Owner.Nickname,
			"avatar_url": supply.Owner.AvatarURL,
		}
	}
	if supply.Drone != nil {
		data["drone"] = buildSupplyDroneSummary(supply.Drone)
	}
	data["stats"] = buildSupplyStatsSummary(stats)
	return data
}

func buildSupplyDetail(supply *model.OwnerSupply, stats service.SupplyMarketStats) gin.H {
	if supply == nil {
		return gin.H{}
	}

	data := buildSupplySummary(supply, stats)
	data["description"] = supply.Description
	data["service_area_snapshot"] = v2common.SafeJSONValue(supply.ServiceAreaSnapshot)
	data["max_range_km"] = supply.MaxRangeKM
	data["pricing_rule"] = v2common.SafeJSONValue(supply.PricingRule)
	data["available_time_slots"] = v2common.SafeJSONValue(supply.AvailableTimeSlots)
	data["created_at"] = supply.CreatedAt
	data["updated_at"] = supply.UpdatedAt

	return data
}

func buildSupplyStatsSummary(stats service.SupplyMarketStats) gin.H {
	data := gin.H{
		"total_order_count":     stats.TotalOrderCount,
		"completed_order_count": stats.CompletedOrderCount,
	}
	if stats.ResponseSampleCount > 0 {
		data["average_response_seconds"] = stats.AverageResponseSeconds
		data["response_sample_count"] = stats.ResponseSampleCount
	}
	if stats.RatingCount > 0 {
		data["rating"] = stats.Rating
		data["rating_count"] = stats.RatingCount
		data["rating_source"] = stats.RatingSource
	}
	return data
}

func buildSupplyDroneSummary(drone *model.Drone) gin.H {
	if drone == nil {
		return gin.H{}
	}
	return gin.H{
		"id":                        drone.ID,
		"brand":                     drone.Brand,
		"model":                     drone.Model,
		"serial_number":             drone.SerialNumber,
		"mtow_kg":                   drone.MTOWKG,
		"max_payload_kg":            drone.EffectivePayloadKG(),
		"max_distance":              drone.MaxDistance,
		"max_flight_time":           drone.MaxFlightTime,
		"latitude":                  drone.Latitude,
		"longitude":                 drone.Longitude,
		"address":                   drone.Address,
		"city":                      drone.City,
		"availability_status":       drone.AvailabilityStatus,
		"certification_status":      drone.CertificationStatus,
		"uom_verified":              drone.UOMVerified,
		"insurance_verified":        drone.InsuranceVerified,
		"airworthiness_verified":    drone.AirworthinessVerified,
		"insurance_expire_date":     drone.InsuranceExpireDate,
		"airworthiness_cert_expire": drone.AirworthinessCertExpire,
	}
}
