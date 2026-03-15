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

	items := make([]gin.H, 0, len(supplies))
	for i := range supplies {
		items = append(items, buildSupplySummary(&supplies[i]))
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

	response.V2Success(c, buildSupplyDetail(supply))
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

func buildSupplySummary(supply *model.OwnerSupply) gin.H {
	if supply == nil {
		return gin.H{}
	}
	return gin.H{
		"id":                   supply.ID,
		"supply_no":            supply.SupplyNo,
		"title":                supply.Title,
		"owner_user_id":        supply.OwnerUserID,
		"service_types":        v2common.SafeJSONValue(supply.ServiceTypes),
		"cargo_scenes":         v2common.SafeJSONValue(supply.CargoScenes),
		"mtow_kg":              supply.MTOWKG,
		"max_payload_kg":       supply.MaxPayloadKG,
		"base_price_amount":    supply.BasePriceAmount,
		"pricing_unit":         supply.PricingUnit,
		"accepts_direct_order": supply.AcceptsDirectOrder,
		"status":               supply.Status,
	}
}

func buildSupplyDetail(supply *model.OwnerSupply) gin.H {
	if supply == nil {
		return gin.H{}
	}

	data := buildSupplySummary(supply)
	data["description"] = supply.Description
	data["service_area_snapshot"] = v2common.SafeJSONValue(supply.ServiceAreaSnapshot)
	data["max_range_km"] = supply.MaxRangeKM
	data["pricing_rule"] = v2common.SafeJSONValue(supply.PricingRule)
	data["available_time_slots"] = v2common.SafeJSONValue(supply.AvailableTimeSlots)
	data["created_at"] = supply.CreatedAt
	data["updated_at"] = supply.UpdatedAt

	if supply.Owner != nil {
		data["owner"] = gin.H{
			"id":         supply.Owner.ID,
			"nickname":   supply.Owner.Nickname,
			"avatar_url": supply.Owner.AvatarURL,
		}
	}
	if supply.Drone != nil {
		data["drone"] = gin.H{
			"id":             supply.Drone.ID,
			"brand":          supply.Drone.Brand,
			"model":          supply.Drone.Model,
			"serial_number":  supply.Drone.SerialNumber,
			"mtow_kg":        supply.Drone.MTOWKG,
			"max_payload_kg": supply.Drone.EffectivePayloadKG(),
			"city":           supply.Drone.City,
		}
	}

	return data
}
