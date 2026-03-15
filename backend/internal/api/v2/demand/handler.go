package demand

import (
	"encoding/json"
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

func (h *Handler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	var req service.ClientDemandInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid demand payload")
		return
	}

	demand, err := h.clientService.CreateDemand(userID, &req)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	summary, err := h.buildDemandDetail(userID, demand)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, summary)
}

func (h *Handler) Update(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	demandID, ok := parseDemandID(c)
	if !ok {
		return
	}

	var req service.ClientDemandInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid demand payload")
		return
	}

	demand, err := h.clientService.UpdateDemand(userID, demandID, &req)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	summary, err := h.buildDemandDetail(userID, demand)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, summary)
}

func (h *Handler) Publish(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	demandID, ok := parseDemandID(c)
	if !ok {
		return
	}

	demand, err := h.clientService.PublishDemand(userID, demandID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	summary, err := h.buildDemandDetail(userID, demand)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, summary)
}

func (h *Handler) Cancel(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	demandID, ok := parseDemandID(c)
	if !ok {
		return
	}

	demand, err := h.clientService.CancelDemand(userID, demandID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	summary, err := h.buildDemandDetail(userID, demand)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, summary)
}

func (h *Handler) ListMine(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	page, pageSize := middleware.GetPagination(c)
	status := c.Query("status")

	demands, total, err := h.clientService.ListMyDemands(userID, status, page, pageSize)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	items, err := h.buildDemandSummaries(userID, demands)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	response.V2SuccessList(c, items, total)
}

func (h *Handler) Get(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	demandID, ok := parseDemandID(c)
	if !ok {
		return
	}

	demand, err := h.clientService.GetDemandDetail(userID, demandID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	detail, err := h.buildDemandDetail(userID, demand)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, detail)
}

func (h *Handler) ListQuotes(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	demandID, ok := parseDemandID(c)
	if !ok {
		return
	}

	quotes, err := h.clientService.ListDemandQuotes(userID, demandID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	items := make([]gin.H, 0, len(quotes))
	for i := range quotes {
		items = append(items, buildQuoteSummary(&quotes[i]))
	}

	response.V2Success(c, gin.H{"items": items})
}

func (h *Handler) SelectProvider(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	demandID, ok := parseDemandID(c)
	if !ok {
		return
	}

	var req struct {
		QuoteID int64 `json:"quote_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid select provider payload")
		return
	}

	result, err := h.clientService.SelectProvider(userID, demandID, req.QuoteID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	response.V2Success(c, result)
}

func parseDemandID(c *gin.Context) (int64, bool) {
	demandID, err := strconv.ParseInt(c.Param("demand_id"), 10, 64)
	if err != nil || demandID <= 0 {
		response.V2ValidationError(c, "invalid demand_id")
		return 0, false
	}
	return demandID, true
}

func (h *Handler) buildDemandSummaries(userID int64, demands []model.Demand) ([]gin.H, error) {
	items := make([]gin.H, 0, len(demands))
	if len(demands) == 0 {
		return items, nil
	}

	demandIDs := make([]int64, 0, len(demands))
	for i := range demands {
		demandIDs = append(demandIDs, demands[i].ID)
	}
	stats, err := h.clientService.GetDemandStats(demandIDs)
	if err != nil {
		return nil, err
	}

	for i := range demands {
		viewerState, stateErr := h.clientService.GetDemandViewerState(userID, demands[i].ID)
		if stateErr != nil {
			return nil, stateErr
		}
		items = append(items, buildDemandSummary(&demands[i], stats[demands[i].ID], viewerState))
	}
	return items, nil
}

func (h *Handler) buildDemandDetail(userID int64, demand *model.Demand) (gin.H, error) {
	if demand == nil {
		return gin.H{}, nil
	}
	stats, err := h.clientService.GetDemandStats([]int64{demand.ID})
	if err != nil {
		return nil, err
	}
	viewerState, err := h.clientService.GetDemandViewerState(userID, demand.ID)
	if err != nil {
		return nil, err
	}
	return buildDemandDetail(demand, stats[demand.ID], viewerState), nil
}

func buildDemandSummary(demand *model.Demand, stats service.DemandStats, viewerState *service.DemandViewerState) gin.H {
	if demand == nil {
		return gin.H{}
	}
	data := gin.H{
		"id":                     demand.ID,
		"demand_no":              demand.DemandNo,
		"client_user_id":         demand.ClientUserID,
		"title":                  demand.Title,
		"status":                 demand.Status,
		"service_type":           demand.ServiceType,
		"cargo_scene":            demand.CargoScene,
		"service_address_text":   resolveDemandAddressText(demand),
		"scheduled_start_at":     demand.ScheduledStartAt,
		"scheduled_end_at":       demand.ScheduledEndAt,
		"budget_min":             demand.BudgetMin,
		"budget_max":             demand.BudgetMax,
		"allows_pilot_candidate": demand.AllowsPilotCandidate,
		"quote_count":            stats.QuoteCount,
		"candidate_pilot_count":  stats.CandidatePilotCount,
	}
	if viewerState != nil {
		if viewerState.MyQuote != nil {
			data["my_quote"] = buildQuoteSummary(viewerState.MyQuote)
		}
		if viewerState.MyCandidate != nil {
			data["my_candidate"] = gin.H{
				"id":            viewerState.MyCandidate.ID,
				"pilot_user_id": viewerState.MyCandidate.PilotUserID,
				"status":        viewerState.MyCandidate.Status,
				"created_at":    viewerState.MyCandidate.CreatedAt,
				"updated_at":    viewerState.MyCandidate.UpdatedAt,
			}
		}
	}
	return data
}

func buildDemandDetail(demand *model.Demand, stats service.DemandStats, viewerState *service.DemandViewerState) gin.H {
	data := buildDemandSummary(demand, stats, viewerState)
	data["description"] = demand.Description
	data["departure_address"] = demand.DepartureAddressSnapshot
	data["destination_address"] = demand.DestinationAddressSnapshot
	data["service_address"] = demand.ServiceAddressSnapshot
	data["cargo_weight_kg"] = demand.CargoWeightKG
	data["cargo_volume_m3"] = demand.CargoVolumeM3
	data["cargo_type"] = demand.CargoType
	data["cargo_special_requirements"] = demand.CargoSpecialRequirements
	data["estimated_trip_count"] = demand.EstimatedTripCount
	data["selected_quote_id"] = demand.SelectedQuoteID
	data["selected_provider_user_id"] = demand.SelectedProviderUserID
	data["expires_at"] = demand.ExpiresAt
	data["created_at"] = demand.CreatedAt
	data["updated_at"] = demand.UpdatedAt
	return data
}

func buildQuoteSummary(quote *model.DemandQuote) gin.H {
	if quote == nil {
		return gin.H{}
	}

	data := gin.H{
		"id":             quote.ID,
		"quote_no":       quote.QuoteNo,
		"demand_id":      quote.DemandID,
		"owner_user_id":  quote.OwnerUserID,
		"price_amount":   quote.PriceAmount,
		"status":         quote.Status,
		"created_at":     quote.CreatedAt,
		"execution_plan": quote.ExecutionPlan,
	}
	if quote.Owner != nil {
		data["owner"] = gin.H{
			"id":         quote.Owner.ID,
			"nickname":   quote.Owner.Nickname,
			"avatar_url": quote.Owner.AvatarURL,
		}
	}
	if quote.Drone != nil {
		data["drone"] = gin.H{
			"id":             quote.Drone.ID,
			"brand":          quote.Drone.Brand,
			"model":          quote.Drone.Model,
			"serial_number":  quote.Drone.SerialNumber,
			"mtow_kg":        quote.Drone.MTOWKG,
			"max_payload_kg": quote.Drone.EffectivePayloadKG(),
		}
	}
	return data
}

func resolveDemandAddressText(demand *model.Demand) string {
	if demand == nil {
		return ""
	}
	for _, snapshot := range []model.JSON{
		demand.ServiceAddressSnapshot,
		demand.DepartureAddressSnapshot,
		demand.DestinationAddressSnapshot,
	} {
		if text := extractAddressText(snapshot); text != "" {
			return text
		}
	}
	return ""
}

func extractAddressText(snapshot model.JSON) string {
	if len(snapshot) == 0 {
		return ""
	}
	var payload struct {
		Text string `json:"text"`
	}
	if err := json.Unmarshal(snapshot, &payload); err != nil {
		return ""
	}
	return payload.Text
}
