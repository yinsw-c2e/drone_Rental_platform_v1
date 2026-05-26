package provider

import (
	"errors"
	"strconv"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	v2common "wurenji-backend/internal/api/v2/common"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	broadcastService *service.BroadcastService
}

func NewHandler(broadcastService *service.BroadcastService) *Handler {
	return &Handler{broadcastService: broadcastService}
}

type presenceRequest struct {
	Latitude               float64  `json:"latitude"`
	Longitude              float64  `json:"longitude"`
	AcceptedServiceClasses []string `json:"accepted_service_classes"`
	MaxRadiusKM            float64  `json:"max_radius_km"`
}

type declineAssignmentRequest struct {
	Reason string `json:"reason"`
}

func (h *Handler) Online(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	var req presenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid provider presence payload")
		return
	}
	presence, err := h.broadcastService.SetOnline(userID, service.ProviderPresenceInput(req))
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildPresenceResponse(presence))
}

func (h *Handler) Heartbeat(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	var req presenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid provider heartbeat payload")
		return
	}
	presence, err := h.broadcastService.Heartbeat(userID, service.ProviderPresenceInput(req))
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildPresenceResponse(presence))
}

func (h *Handler) Offline(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}
	if err := h.broadcastService.SetOffline(userID); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, gin.H{"online": false})
}

func (h *Handler) MeStats(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}
	response.V2Success(c, h.broadcastService.GetProviderStats(userID))
}

func (h *Handler) ListBroadcasts(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	limit := parseProviderLimit(c.Query("limit"), 50)
	items, err := h.broadcastService.ListOpenForProvider(userID, limit)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, gin.H{"items": buildBroadcastViews(items)})
}

func (h *Handler) GrabBroadcast(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}
	broadcastID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || broadcastID <= 0 {
		response.V2ValidationError(c, "invalid broadcast id")
		return
	}

	order, err := h.broadcastService.Grab(broadcastID, userID)
	if err != nil {
		if errors.Is(err, service.ErrBroadcastConflict) {
			response.V2Conflict(c, err.Error())
			return
		}
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, gin.H{
		"order": buildOrderSummary(order),
	})
}

func (h *Handler) ListAssignments(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	limit := parseProviderLimit(c.Query("limit"), 50)
	items, err := h.broadcastService.ListPendingAssignmentsForProvider(userID, limit)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, gin.H{"items": buildAssignmentViews(items)})
}

func (h *Handler) AcceptAssignment(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}
	assignmentID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || assignmentID <= 0 {
		response.V2ValidationError(c, "invalid assignment id")
		return
	}

	order, err := h.broadcastService.AcceptAssignment(assignmentID, userID)
	if err != nil {
		if errors.Is(err, service.ErrBroadcastConflict) {
			response.V2Conflict(c, err.Error())
			return
		}
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, gin.H{"order": buildOrderSummary(order)})
}

func (h *Handler) DeclineAssignment(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}
	assignmentID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || assignmentID <= 0 {
		response.V2ValidationError(c, "invalid assignment id")
		return
	}

	var req declineAssignmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req = declineAssignmentRequest{}
	}
	if err := h.broadcastService.DeclineAssignment(assignmentID, userID, req.Reason); err != nil {
		if errors.Is(err, service.ErrBroadcastConflict) {
			response.V2Conflict(c, err.Error())
			return
		}
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, gin.H{"declined": true})
}

func buildPresenceResponse(presence *model.ProviderPresence) gin.H {
	if presence == nil {
		return nil
	}
	return gin.H{
		"user_id":                  presence.UserID,
		"online":                   presence.Online,
		"last_latitude":            presence.LastLatitude,
		"last_longitude":           presence.LastLongitude,
		"last_heartbeat_at":        presence.LastHeartbeatAt,
		"accepted_service_classes": presence.AcceptedServiceClasses,
		"max_radius_km":            presence.MaxRadiusKM,
		"status":                   presence.Status,
	}
}

func buildBroadcastViews(items []service.ProviderBroadcastView) []gin.H {
	result := make([]gin.H, 0, len(items))
	for i := range items {
		item := items[i]
		if item.Broadcast == nil {
			continue
		}
		result = append(result, gin.H{
			"id":                    item.Broadcast.ID,
			"order_id":              item.Broadcast.OrderID,
			"service_class_code":    item.Broadcast.ServiceClassCode,
			"weight_kg":             item.Broadcast.WeightKG,
			"estimated_total_cents": item.Broadcast.EstimatedTotalCents,
			"status":                item.Broadcast.Status,
			"origin_latitude":       item.Broadcast.OriginLatitude,
			"origin_longitude":      item.Broadcast.OriginLongitude,
			"distance_km":           item.DistanceKM,
			"remaining_seconds":     item.RemainingSeconds,
			"expires_at":            item.Broadcast.ExpiresAt,
			"order":                 buildOrderSummary(item.Order),
		})
	}
	return result
}

func buildAssignmentViews(items []service.ProviderAssignmentView) []gin.H {
	result := make([]gin.H, 0, len(items))
	for i := range items {
		item := items[i]
		if item.Assignment == nil {
			continue
		}
		result = append(result, gin.H{
			"id":                 item.Assignment.ID,
			"broadcast_id":       item.Assignment.BroadcastID,
			"order_id":           item.Assignment.OrderID,
			"provider_user_id":   item.Assignment.ProviderUserID,
			"attempt_seq":        item.Assignment.AttemptSeq,
			"status":             item.Assignment.Status,
			"distance_km":        item.Assignment.DistanceKM,
			"score":              item.Assignment.Score,
			"accept_deadline_at": item.Assignment.AcceptDeadlineAt,
			"remaining_seconds":  item.RemainingSeconds,
			"broadcast":          buildBroadcastSummary(item.Broadcast),
			"order":              buildOrderSummary(item.Order),
		})
	}
	return result
}

func buildBroadcastSummary(broadcast *model.OrderBroadcast) gin.H {
	if broadcast == nil {
		return nil
	}
	return gin.H{
		"id":                    broadcast.ID,
		"order_id":              broadcast.OrderID,
		"service_class_code":    broadcast.ServiceClassCode,
		"weight_kg":             broadcast.WeightKG,
		"estimated_total_cents": broadcast.EstimatedTotalCents,
		"status":                broadcast.Status,
		"origin_latitude":       broadcast.OriginLatitude,
		"origin_longitude":      broadcast.OriginLongitude,
		"expires_at":            broadcast.ExpiresAt,
	}
}

func buildOrderSummary(order *model.Order) gin.H {
	if order == nil {
		return nil
	}
	return gin.H{
		"id":                     order.ID,
		"order_no":               order.OrderNo,
		"title":                  order.Title,
		"order_source":           order.OrderSource,
		"order_mode":             order.OrderMode,
		"service_class_code":     order.ServiceClassCode,
		"status":                 order.Status,
		"service_address":        order.ServiceAddress,
		"dest_address":           order.DestAddress,
		"cargo_weight_kg":        order.CargoWeightKG,
		"estimated_distance_m":   order.EstimatedDistanceM,
		"estimated_duration_min": order.EstimatedDurationMin,
		"total_amount":           order.TotalAmount,
		"reserved_start_at":      order.ReservedStartAt,
		"grabbed_by_user_id":     order.GrabbedByUserID,
		"grabbed_at":             order.GrabbedAt,
		"created_at":             order.CreatedAt,
		"updated_at":             order.UpdatedAt,
	}
}

func parseProviderLimit(raw string, fallback int) int {
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return fallback
	}
	if value > 200 {
		return 200
	}
	return value
}
