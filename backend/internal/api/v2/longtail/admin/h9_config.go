package admin

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
)

var systemConfigAllowedPrefixes = []string{
	"broadcast.",
	"cancel.",
	"settlement.",
}

type serviceClassPayload struct {
	Code                   *string  `json:"code"`
	DisplayName            *string  `json:"display_name"`
	MTOWMinKG              *float64 `json:"mtow_min_kg"`
	MTOWMaxKG              *float64 `json:"mtow_max_kg"`
	PayloadMinKG           *float64 `json:"payload_min_kg"`
	PayloadMaxKG           *float64 `json:"payload_max_kg"`
	BasePriceCents         *int64   `json:"base_price_cents"`
	PerKMPriceCents        *int64   `json:"per_km_price_cents"`
	PerMinutePriceCents    *int64   `json:"per_minute_price_cents"`
	MinChargeCents         *int64   `json:"min_charge_cents"`
	NightSurchargeRate     *float64 `json:"night_surcharge_rate"`
	PlateauSurchargeRate   *float64 `json:"plateau_surcharge_rate"`
	EmergencySurchargeRate *float64 `json:"emergency_surcharge_rate"`
	IslandSurchargeRate    *float64 `json:"island_surcharge_rate"`
	Status                 *string  `json:"status"`
	SortOrder              *int     `json:"sort_order"`
}

type systemConfigPayload struct {
	Value       string  `json:"value"`
	Description *string `json:"description"`
}

type adminBroadcastRecentItem struct {
	ID                  int64      `json:"id"`
	OrderID             int64      `json:"order_id"`
	Status              string     `json:"status"`
	ServiceClassCode    string     `json:"service_class_code"`
	WeightKG            float64    `json:"weight_kg"`
	EstimatedTotalCents int64      `json:"estimated_total_cents"`
	ExpiresAt           time.Time  `json:"expires_at"`
	GrabbedByUserID     int64      `json:"grabbed_by_user_id"`
	GrabbedAt           *time.Time `json:"grabbed_at"`
	GrabSeconds         *float64   `json:"grab_seconds"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
	OrderNo             string     `json:"order_no,omitempty"`
}

func (h *Handler) ServiceClassList(c *gin.Context) {
	if h.serviceClassRepo == nil {
		response.V2InternalError(c, "service class repository not configured")
		return
	}
	items, err := h.serviceClassRepo.ListAll()
	if err != nil {
		response.V2InternalError(c, err.Error())
		return
	}
	response.Success(c, gin.H{"items": items})
}

func (h *Handler) CreateServiceClass(c *gin.Context) {
	if h.serviceClassRepo == nil {
		response.V2InternalError(c, "service class repository not configured")
		return
	}
	var req serviceClassPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2BadRequest(c, "参数错误")
		return
	}
	item := model.ServiceClass{Status: "active"}
	applyServiceClassPayload(&item, req)
	if strings.TrimSpace(item.Code) == "" || strings.TrimSpace(item.DisplayName) == "" {
		response.V2BadRequest(c, "code/display_name required")
		return
	}
	if err := h.serviceClassRepo.Create(&item); err != nil {
		response.V2InternalError(c, err.Error())
		return
	}
	h.writeAdminLog(c, "pricing", "create_service_class", "service_class", item.ID, item)
	response.Success(c, item)
}

func (h *Handler) UpdateServiceClass(c *gin.Context) {
	if h.serviceClassRepo == nil {
		response.V2InternalError(c, "service class repository not configured")
		return
	}
	id := adminParamID(c)
	if id <= 0 {
		response.V2BadRequest(c, "invalid service class id")
		return
	}
	item, err := h.serviceClassRepo.GetByID(id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		response.V2NotFound(c, "service class not found")
		return
	}
	if err != nil {
		response.V2InternalError(c, err.Error())
		return
	}
	before := *item
	var req serviceClassPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2BadRequest(c, "参数错误")
		return
	}
	applyServiceClassPayload(item, req)
	if strings.TrimSpace(item.Code) == "" || strings.TrimSpace(item.DisplayName) == "" {
		response.V2BadRequest(c, "code/display_name required")
		return
	}
	if serviceClassPriceChanged(before, *item) {
		zap.L().Warn("service class price changed, in-flight orders may keep old breakdown",
			zap.Int64("service_class_id", item.ID),
			zap.String("code", item.Code),
		)
	}
	if err := h.serviceClassRepo.Update(item); err != nil {
		response.V2InternalError(c, err.Error())
		return
	}
	h.writeAdminLog(c, "pricing", "update_service_class", "service_class", item.ID, gin.H{
		"before": before,
		"after":  item,
	})
	response.Success(c, item)
}

func (h *Handler) ArchiveServiceClass(c *gin.Context) {
	if h.serviceClassRepo == nil {
		response.V2InternalError(c, "service class repository not configured")
		return
	}
	id := adminParamID(c)
	if id <= 0 {
		response.V2BadRequest(c, "invalid service class id")
		return
	}
	if err := h.serviceClassRepo.Archive(id); err != nil {
		response.V2InternalError(c, err.Error())
		return
	}
	h.writeAdminLog(c, "pricing", "archive_service_class", "service_class", id, nil)
	response.Success(c, gin.H{"archived": true})
}

func (h *Handler) SystemConfigList(c *gin.Context) {
	if h.systemConfigSvc == nil {
		response.V2InternalError(c, "system config service not configured")
		return
	}
	items, err := h.systemConfigSvc.ListAll()
	if err != nil {
		response.V2InternalError(c, err.Error())
		return
	}
	response.Success(c, gin.H{"items": items})
}

func (h *Handler) GetSystemConfig(c *gin.Context) {
	if h.systemConfigSvc == nil {
		response.V2InternalError(c, "system config service not configured")
		return
	}
	key := strings.TrimSpace(c.Param("key"))
	cfg, err := h.systemConfigSvc.Get(key)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		response.V2NotFound(c, "system config not found")
		return
	}
	if err != nil {
		response.V2InternalError(c, err.Error())
		return
	}
	response.Success(c, cfg)
}

func (h *Handler) UpdateSystemConfig(c *gin.Context) {
	if h.systemConfigSvc == nil {
		response.V2InternalError(c, "system config service not configured")
		return
	}
	key := strings.TrimSpace(c.Param("key"))
	if !systemConfigKeyAllowed(key) {
		response.V2BadRequest(c, "system config key is not allowed")
		return
	}
	var req systemConfigPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2BadRequest(c, "参数错误")
		return
	}
	description := ""
	if req.Description != nil {
		description = *req.Description
	}
	cfg, err := h.systemConfigSvc.Upsert(key, req.Value, description)
	if err != nil {
		response.V2InternalError(c, err.Error())
		return
	}
	h.writeAdminLog(c, "system", "update_system_config", "system_config", cfg.ID, gin.H{
		"key":         key,
		"value":       req.Value,
		"description": description,
	})
	response.Success(c, cfg)
}

func (h *Handler) BroadcastStats(c *gin.Context) {
	if h.broadcastRepo == nil {
		response.V2InternalError(c, "broadcast repository not configured")
		return
	}
	from, to, ok := adminTimeRange(c)
	if !ok {
		return
	}
	stats, err := h.broadcastRepo.StatsBetween(from, to)
	if err != nil {
		response.V2InternalError(c, err.Error())
		return
	}
	response.Success(c, stats)
}

func (h *Handler) BroadcastRecent(c *gin.Context) {
	if h.broadcastRepo == nil {
		response.V2InternalError(c, "broadcast repository not configured")
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	items, err := h.broadcastRepo.ListRecent(limit)
	if err != nil {
		response.V2InternalError(c, err.Error())
		return
	}
	views := make([]adminBroadcastRecentItem, 0, len(items))
	for _, item := range items {
		var grabSeconds *float64
		if item.GrabbedAt != nil {
			value := item.GrabbedAt.Sub(item.CreatedAt).Seconds()
			grabSeconds = &value
		}
		view := adminBroadcastRecentItem{
			ID:                  item.ID,
			OrderID:             item.OrderID,
			Status:              item.Status,
			ServiceClassCode:    item.ServiceClassCode,
			WeightKG:            item.WeightKG,
			EstimatedTotalCents: item.EstimatedTotalCents,
			ExpiresAt:           item.ExpiresAt,
			GrabbedByUserID:     item.GrabbedByUserID,
			GrabbedAt:           item.GrabbedAt,
			GrabSeconds:         grabSeconds,
			CreatedAt:           item.CreatedAt,
			UpdatedAt:           item.UpdatedAt,
		}
		if item.Order != nil {
			view.OrderNo = item.Order.OrderNo
		}
		views = append(views, view)
	}
	response.Success(c, gin.H{"items": views})
}

func applyServiceClassPayload(item *model.ServiceClass, req serviceClassPayload) {
	if req.Code != nil {
		item.Code = strings.TrimSpace(*req.Code)
	}
	if req.DisplayName != nil {
		item.DisplayName = strings.TrimSpace(*req.DisplayName)
	}
	if req.MTOWMinKG != nil {
		item.MTOWMinKG = *req.MTOWMinKG
	}
	if req.MTOWMaxKG != nil {
		item.MTOWMaxKG = *req.MTOWMaxKG
	}
	if req.PayloadMinKG != nil {
		item.PayloadMinKG = *req.PayloadMinKG
	}
	if req.PayloadMaxKG != nil {
		item.PayloadMaxKG = *req.PayloadMaxKG
	}
	if req.BasePriceCents != nil {
		item.BasePriceCents = *req.BasePriceCents
	}
	if req.PerKMPriceCents != nil {
		item.PerKMPriceCents = *req.PerKMPriceCents
	}
	if req.PerMinutePriceCents != nil {
		item.PerMinutePriceCents = *req.PerMinutePriceCents
	}
	if req.MinChargeCents != nil {
		item.MinChargeCents = *req.MinChargeCents
	}
	if req.NightSurchargeRate != nil {
		item.NightSurchargeRate = *req.NightSurchargeRate
	}
	if req.PlateauSurchargeRate != nil {
		item.PlateauSurchargeRate = *req.PlateauSurchargeRate
	}
	if req.EmergencySurchargeRate != nil {
		item.EmergencySurchargeRate = *req.EmergencySurchargeRate
	}
	if req.IslandSurchargeRate != nil {
		item.IslandSurchargeRate = *req.IslandSurchargeRate
	}
	if req.Status != nil {
		item.Status = strings.TrimSpace(*req.Status)
	}
	if req.SortOrder != nil {
		item.SortOrder = *req.SortOrder
	}
}

func serviceClassPriceChanged(before, after model.ServiceClass) bool {
	return before.BasePriceCents != after.BasePriceCents ||
		before.PerKMPriceCents != after.PerKMPriceCents ||
		before.PerMinutePriceCents != after.PerMinutePriceCents ||
		before.MinChargeCents != after.MinChargeCents ||
		before.NightSurchargeRate != after.NightSurchargeRate ||
		before.PlateauSurchargeRate != after.PlateauSurchargeRate ||
		before.EmergencySurchargeRate != after.EmergencySurchargeRate ||
		before.IslandSurchargeRate != after.IslandSurchargeRate
}

func systemConfigKeyAllowed(key string) bool {
	key = strings.TrimSpace(key)
	for _, prefix := range systemConfigAllowedPrefixes {
		if strings.HasPrefix(key, prefix) {
			return true
		}
	}
	return false
}

func adminTimeRange(c *gin.Context) (time.Time, time.Time, bool) {
	now := time.Now()
	from := now.Add(-24 * time.Hour)
	to := now
	if raw := strings.TrimSpace(c.Query("from")); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			response.V2BadRequest(c, "invalid from time")
			return time.Time{}, time.Time{}, false
		}
		from = parsed
	}
	if raw := strings.TrimSpace(c.Query("to")); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			response.V2BadRequest(c, "invalid to time")
			return time.Time{}, time.Time{}, false
		}
		to = parsed
	}
	if !from.Before(to) {
		response.V2BadRequest(c, "from must be before to")
		return time.Time{}, time.Time{}, false
	}
	return from, to, true
}
