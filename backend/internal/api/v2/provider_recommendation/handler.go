package provider_recommendation

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	v2common "wurenji-backend/internal/api/v2/common"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	recommendationService *service.ProviderRecommendationService
}

func NewHandler(recommendationService *service.ProviderRecommendationService) *Handler {
	return &Handler{recommendationService: recommendationService}
}

func (h *Handler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}
	if h == nil || h.recommendationService == nil {
		response.V2InternalError(c, "provider recommendation service unavailable")
		return
	}

	query, ok := bindRecommendationQuery(c, userID)
	if !ok {
		return
	}
	page, pageSize := middleware.GetPagination(c)
	items, total, err := h.recommendationService.ListRecommendations(query, page, pageSize)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	response.V2SuccessList(c, buildRecommendationList(items), total)
}

func (h *Handler) Invite(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}
	if h == nil || h.recommendationService == nil {
		response.V2InternalError(c, "provider recommendation service unavailable")
		return
	}

	demandID, err := strconv.ParseInt(c.Param("demand_id"), 10, 64)
	if err != nil || demandID <= 0 {
		response.V2ValidationError(c, "invalid demand_id")
		return
	}

	var req service.ProviderInviteInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid provider invitation payload")
		return
	}

	result, err := h.recommendationService.InviteProvider(userID, demandID, req)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, result)
}

func bindRecommendationQuery(c *gin.Context, userID int64) (service.ProviderRecommendationQuery, bool) {
	query := service.ProviderRecommendationQuery{
		ClientUserID: userID,
		CargoScene:   c.Query("cargo_scene"),
		Keyword:      c.Query("keyword"),
	}

	if raw := c.Query("demand_id"); raw != "" {
		value, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || value <= 0 {
			response.V2ValidationError(c, "invalid demand_id")
			return query, false
		}
		query.DemandID = value
	}
	if raw := c.Query("cargo_weight_kg"); raw != "" {
		value, err := strconv.ParseFloat(raw, 64)
		if err != nil || value < 0 {
			response.V2ValidationError(c, "invalid cargo_weight_kg")
			return query, false
		}
		query.CargoWeightKG = value
	}

	originLatRaw := c.Query("origin_latitude")
	originLngRaw := c.Query("origin_longitude")
	if (originLatRaw == "") != (originLngRaw == "") {
		response.V2ValidationError(c, "origin latitude and longitude must be provided together")
		return query, false
	}
	if originLatRaw != "" {
		latitude, err := strconv.ParseFloat(originLatRaw, 64)
		if err != nil || latitude < -90 || latitude > 90 {
			response.V2ValidationError(c, "invalid origin_latitude")
			return query, false
		}
		longitude, err := strconv.ParseFloat(originLngRaw, 64)
		if err != nil || longitude < -180 || longitude > 180 {
			response.V2ValidationError(c, "invalid origin_longitude")
			return query, false
		}
		query.OriginLatitude = latitude
		query.OriginLongitude = longitude
	}

	return query, true
}

func buildRecommendationList(items []service.ProviderRecommendation) []gin.H {
	result := make([]gin.H, 0, len(items))
	for _, item := range items {
		data := gin.H{
			"provider_user_id":         item.ProviderUserID,
			"provider_name":            item.ProviderName,
			"avatar_url":               item.AvatarURL,
			"intro":                    item.Intro,
			"service_city":             item.ServiceCity,
			"distance_km":              item.DistanceKM,
			"service_radius_km":        item.ServiceRadiusKM,
			"matched_scenes":           item.MatchedScenes,
			"max_payload_kg":           item.MaxPayloadKG,
			"drone_count":              item.DroneCount,
			"drone_id":                 item.DroneID,
			"drone_label":              item.DroneLabel,
			"rating":                   item.Rating,
			"rating_count":             item.RatingCount,
			"completed_orders_30d":     item.CompletedOrders30D,
			"average_response_seconds": item.AverageResponseSeconds,
			"has_previous_cooperation": item.HasPreviousCooperation,
			"score":                    item.Score,
			"score_reasons":            item.ScoreReasons,
		}
		if item.InvitationID > 0 {
			data["invitation_id"] = item.InvitationID
			data["invitation_status"] = item.InvitationStatus
		}
		result = append(result, data)
	}
	return result
}
