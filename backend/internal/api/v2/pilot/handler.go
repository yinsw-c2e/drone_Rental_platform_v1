package pilot

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
	pilotService *service.PilotService
}

func NewHandler(pilotService *service.PilotService) *Handler {
	return &Handler{pilotService: pilotService}
}

func (h *Handler) GetProfile(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	profile, err := h.pilotService.GetCurrentProfile(userID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, profile)
}

func (h *Handler) UpsertProfile(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	var req service.PilotProfileInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid pilot profile payload")
		return
	}
	if req.CAACLicenseType == "" && req.CAACLicenseNo == "" && req.CAACLicenseImage == "" && req.ServiceRadius == nil && len(req.SpecialSkills) == 0 && req.CurrentCity == "" {
		response.V2ValidationError(c, "empty pilot profile payload")
		return
	}

	profile, err := h.pilotService.UpsertCurrentProfile(userID, &req)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, profile)
}

func (h *Handler) UpdateAvailability(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	var req struct {
		AvailabilityStatus string `json:"availability_status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid availability payload")
		return
	}

	if err := h.pilotService.UpdateAvailability(pilot.ID, req.AvailabilityStatus); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	profile, err := h.pilotService.GetCurrentProfile(userID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, profile)
}

func (h *Handler) ListOwnerBindings(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	page, pageSize := middleware.GetPagination(c)
	status := c.Query("status")

	bindings, total, err := h.pilotService.ListOwnerBindings(userID, status, page, pageSize)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	items := make([]gin.H, 0, len(bindings))
	for i := range bindings {
		items = append(items, buildOwnerBindingSummary(&bindings[i]))
	}
	response.V2SuccessList(c, items, total)
}

func (h *Handler) ApplyOwnerBinding(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	var req service.PilotBindingApplyInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid owner binding payload")
		return
	}

	binding, err := h.pilotService.ApplyOwnerBinding(userID, &req)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildOwnerBindingSummary(binding))
}

func (h *Handler) ConfirmOwnerBinding(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	bindingID, ok := parseBindingID(c)
	if !ok {
		return
	}

	binding, err := h.pilotService.ConfirmOwnerBinding(userID, bindingID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildOwnerBindingSummary(binding))
}

func (h *Handler) RejectOwnerBinding(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	bindingID, ok := parseBindingID(c)
	if !ok {
		return
	}

	binding, err := h.pilotService.RejectOwnerBinding(userID, bindingID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildOwnerBindingSummary(binding))
}

func (h *Handler) UpdateOwnerBindingStatus(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	bindingID, ok := parseBindingID(c)
	if !ok {
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid owner binding status payload")
		return
	}

	binding, err := h.pilotService.UpdateOwnerBindingStatus(userID, bindingID, req.Status)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildOwnerBindingSummary(binding))
}

func (h *Handler) ListCandidateDemands(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	page, pageSize := middleware.GetPagination(c)
	demands, total, err := h.pilotService.ListCandidateDemands(userID, page, pageSize)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	demandIDs := make([]int64, 0, len(demands))
	for i := range demands {
		demandIDs = append(demandIDs, demands[i].ID)
	}
	stats, err := h.pilotService.GetDemandStats(demandIDs)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	items := make([]gin.H, 0, len(demands))
	for i := range demands {
		items = append(items, buildCandidateDemandSummary(&demands[i], stats[demands[i].ID]))
	}
	response.V2SuccessList(c, items, total)
}

func (h *Handler) ApplyDemandCandidate(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	demandID, ok := parseDemandID(c)
	if !ok {
		return
	}

	candidate, err := h.pilotService.ApplyDemandCandidate(userID, demandID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildCandidateSummary(candidate))
}

func (h *Handler) WithdrawDemandCandidate(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	demandID, ok := parseDemandID(c)
	if !ok {
		return
	}

	candidate, err := h.pilotService.WithdrawDemandCandidate(userID, demandID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildCandidateSummary(candidate))
}

func (h *Handler) ListDispatchTasks(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	page, pageSize := middleware.GetPagination(c)
	status := c.Query("status")

	tasks, total, err := h.pilotService.ListDispatchTasks(userID, status, page, pageSize)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	items := make([]gin.H, 0, len(tasks))
	for i := range tasks {
		items = append(items, buildDispatchSummary(&tasks[i]))
	}
	response.V2SuccessList(c, items, total)
}

func (h *Handler) AcceptDispatchTask(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	dispatchID, ok := parseDispatchID(c)
	if !ok {
		return
	}

	task, err := h.pilotService.AcceptDispatchTask(userID, dispatchID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildDispatchSummary(task))
}

func (h *Handler) RejectDispatchTask(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	dispatchID, ok := parseDispatchID(c)
	if !ok {
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid dispatch reject payload")
		return
	}

	task, err := h.pilotService.RejectDispatchTask(userID, dispatchID, req.Reason)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildDispatchSummary(task))
}

func (h *Handler) ListFlightRecords(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	page, pageSize := middleware.GetPagination(c)
	records, total, err := h.pilotService.ListFlightRecords(userID, page, pageSize)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	items := make([]gin.H, 0, len(records))
	for i := range records {
		items = append(items, buildFlightRecordSummary(&records[i]))
	}
	response.V2SuccessList(c, items, total)
}

func parseBindingID(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("binding_id"), 10, 64)
	if err != nil || id <= 0 {
		response.V2ValidationError(c, "invalid binding_id")
		return 0, false
	}
	return id, true
}

func parseDemandID(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("demand_id"), 10, 64)
	if err != nil || id <= 0 {
		response.V2ValidationError(c, "invalid demand_id")
		return 0, false
	}
	return id, true
}

func parseDispatchID(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("dispatch_id"), 10, 64)
	if err != nil || id <= 0 {
		response.V2ValidationError(c, "invalid dispatch_id")
		return 0, false
	}
	return id, true
}

func buildOwnerBindingSummary(binding *model.OwnerPilotBinding) gin.H {
	if binding == nil {
		return gin.H{}
	}
	data := gin.H{
		"id":            binding.ID,
		"owner_user_id": binding.OwnerUserID,
		"pilot_user_id": binding.PilotUserID,
		"initiated_by":  binding.InitiatedBy,
		"status":        binding.Status,
		"is_priority":   binding.IsPriority,
		"note":          binding.Note,
		"confirmed_at":  binding.ConfirmedAt,
		"dissolved_at":  binding.DissolvedAt,
		"created_at":    binding.CreatedAt,
		"updated_at":    binding.UpdatedAt,
	}
	if binding.Owner != nil {
		data["owner"] = gin.H{
			"id":         binding.Owner.ID,
			"nickname":   binding.Owner.Nickname,
			"avatar_url": binding.Owner.AvatarURL,
		}
	}
	return data
}

func buildCandidateDemandSummary(demand *model.Demand, stats service.PilotDemandStats) gin.H {
	if demand == nil {
		return gin.H{}
	}
	return gin.H{
		"id":                     demand.ID,
		"demand_no":              demand.DemandNo,
		"title":                  demand.Title,
		"status":                 demand.Status,
		"service_type":           demand.ServiceType,
		"cargo_scene":            demand.CargoScene,
		"service_address_text":   extractPilotAddressText(demand.ServiceAddressSnapshot, demand.DepartureAddressSnapshot, demand.DestinationAddressSnapshot),
		"scheduled_start_at":     demand.ScheduledStartAt,
		"scheduled_end_at":       demand.ScheduledEndAt,
		"budget_min":             demand.BudgetMin,
		"budget_max":             demand.BudgetMax,
		"allows_pilot_candidate": demand.AllowsPilotCandidate,
		"quote_count":            stats.QuoteCount,
		"candidate_pilot_count":  stats.CandidatePilotCount,
	}
}

func buildCandidateSummary(candidate *model.DemandCandidatePilot) gin.H {
	if candidate == nil {
		return gin.H{}
	}
	return gin.H{
		"id":                    candidate.ID,
		"demand_id":             candidate.DemandID,
		"pilot_user_id":         candidate.PilotUserID,
		"status":                candidate.Status,
		"availability_snapshot": candidate.AvailabilitySnapshot,
		"created_at":            candidate.CreatedAt,
		"updated_at":            candidate.UpdatedAt,
	}
}

func buildDispatchSummary(task *model.FormalDispatchTask) gin.H {
	if task == nil {
		return gin.H{}
	}
	data := gin.H{
		"id":                   task.ID,
		"dispatch_no":          task.DispatchNo,
		"order_id":             task.OrderID,
		"status":               task.Status,
		"dispatch_source":      task.DispatchSource,
		"target_pilot_user_id": task.TargetPilotUserID,
		"retry_count":          task.RetryCount,
		"reason":               task.Reason,
		"sent_at":              task.SentAt,
		"responded_at":         task.RespondedAt,
		"created_at":           task.CreatedAt,
		"updated_at":           task.UpdatedAt,
	}
	if task.Order != nil {
		data["order"] = gin.H{
			"id":                     task.Order.ID,
			"order_no":               task.Order.OrderNo,
			"order_source":           task.Order.OrderSource,
			"status":                 task.Order.Status,
			"needs_dispatch":         task.Order.NeedsDispatch,
			"execution_mode":         task.Order.ExecutionMode,
			"provider_user_id":       task.Order.ProviderUserID,
			"executor_pilot_user_id": task.Order.ExecutorPilotUserID,
			"title":                  task.Order.Title,
		}
	}
	return data
}

func buildFlightRecordSummary(record *model.FlightRecord) gin.H {
	if record == nil {
		return gin.H{}
	}
	data := gin.H{
		"id":                     record.ID,
		"flight_no":              record.FlightNo,
		"order_id":               record.OrderID,
		"dispatch_task_id":       record.DispatchTaskID,
		"status":                 record.Status,
		"takeoff_at":             record.TakeoffAt,
		"landing_at":             record.LandingAt,
		"total_duration_seconds": record.TotalDurationSeconds,
		"total_distance_m":       record.TotalDistanceM,
		"max_altitude_m":         record.MaxAltitudeM,
		"created_at":             record.CreatedAt,
		"updated_at":             record.UpdatedAt,
	}
	if record.Order != nil {
		data["order"] = gin.H{
			"id":       record.Order.ID,
			"order_no": record.Order.OrderNo,
			"title":    record.Order.Title,
			"status":   record.Order.Status,
		}
	}
	return data
}

func extractPilotAddressText(candidates ...model.JSON) string {
	for _, snapshot := range candidates {
		if len(snapshot) == 0 {
			continue
		}
		var payload struct {
			Text string `json:"text"`
		}
		if err := json.Unmarshal(snapshot, &payload); err == nil && payload.Text != "" {
			return payload.Text
		}
	}
	return ""
}
