package order

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"sort"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"wurenji-backend/internal/api/middleware"
	v2common "wurenji-backend/internal/api/v2/common"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	orderService    *service.OrderService
	dispatchService *service.DispatchService
	flightService   *service.FlightService
	contractService *service.ContractService
}

type aggregatedOrderTimelineEvent struct {
	EventID      string    `json:"event_id"`
	SourceType   string    `json:"source_type"`
	SourceID     int64     `json:"source_id"`
	EventType    string    `json:"event_type"`
	Title        string    `json:"title"`
	Description  string    `json:"description,omitempty"`
	Status       string    `json:"status,omitempty"`
	OccurredAt   time.Time `json:"occurred_at"`
	OperatorID   int64     `json:"operator_id,omitempty"`
	OperatorType string    `json:"operator_type,omitempty"`
	Payload      gin.H     `json:"payload,omitempty"`
}

func NewHandler(orderService *service.OrderService, dispatchService *service.DispatchService, flightService *service.FlightService) *Handler {
	return &Handler{
		orderService:    orderService,
		dispatchService: dispatchService,
		flightService:   flightService,
	}
}

func (h *Handler) SetContractService(cs *service.ContractService) {
	h.contractService = cs
}

func (h *Handler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	page, pageSize := middleware.GetPagination(c)
	role := c.DefaultQuery("role", "client")
	status := c.Query("status")

	orders, total, err := h.orderService.ListOrders(userID, role, status, page, pageSize)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	items := make([]gin.H, 0, len(orders))
	for i := range orders {
		items = append(items, buildOrderSummary(&orders[i]))
	}
	response.V2SuccessList(c, items, total)
}

func (h *Handler) Get(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	orderID, ok := parseOrderID(c)
	if !ok {
		return
	}

	order, err := h.orderService.GetAuthorizedOrder(orderID, userID, "")
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	detail, err := h.buildOrderDetail(order)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, detail)
}

func (h *Handler) ProviderConfirm(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	orderID, ok := parseOrderID(c)
	if !ok {
		return
	}

	if err := h.orderService.ProviderConfirmOrder(orderID, userID); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	order, err := h.orderService.GetAuthorizedOrder(orderID, userID, "owner")
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildOrderSummary(order))
}

func (h *Handler) ProviderReject(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	orderID, ok := parseOrderID(c)
	if !ok {
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid provider reject payload")
		return
	}

	if err := h.orderService.ProviderRejectOrder(orderID, userID, req.Reason); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	order, err := h.orderService.GetAuthorizedOrder(orderID, userID, "owner")
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildOrderSummary(order))
}

func (h *Handler) Cancel(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	orderID, ok := parseOrderID(c)
	if !ok {
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil && !errors.Is(err, io.EOF) {
		response.V2ValidationError(c, "invalid cancel payload")
		return
	}

	order, err := h.orderService.GetAuthorizedOrder(orderID, userID, "")
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	role := h.resolveOrderActorRole(c, order, userID)
	if role == "" {
		response.V2Forbidden(c, "无权操作此订单")
		return
	}

	if err := h.orderService.CancelOrder(orderID, userID, req.Reason, role); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	updated, err := h.orderService.GetAuthorizedOrder(orderID, userID, "")
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildOrderSummary(updated))
}

func (h *Handler) Dispatch(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	orderID, ok := parseOrderID(c)
	if !ok {
		return
	}

	var req struct {
		DispatchMode      string `json:"dispatch_mode" binding:"required"`
		TargetPilotUserID int64  `json:"target_pilot_user_id"`
		Reason            string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid dispatch payload")
		return
	}

	task, err := h.dispatchService.ManualDispatchOrder(orderID, userID, req.DispatchMode, req.TargetPilotUserID, req.Reason)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	order, err := h.orderService.GetAuthorizedOrder(orderID, userID, "owner")
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	response.V2Success(c, gin.H{
		"order":         buildOrderSummary(order),
		"dispatch_task": buildDispatchTaskSummary(task),
	})
}

func (h *Handler) StartPreparing(c *gin.Context) {
	h.advanceExecutionStage(c, func(userID int64, orderID int64) error {
		return h.orderService.StartPreparing(userID, orderID)
	}, false)
}

func (h *Handler) StartFlight(c *gin.Context) {
	h.advanceExecutionStage(c, func(userID int64, orderID int64) error {
		return h.orderService.StartFlight(userID, orderID)
	}, true)
}

func (h *Handler) ConfirmDelivery(c *gin.Context) {
	h.advanceExecutionStage(c, func(userID int64, orderID int64) error {
		return h.orderService.ConfirmDelivery(userID, orderID)
	}, true)
}

func (h *Handler) Monitor(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	orderID, ok := parseOrderID(c)
	if !ok {
		return
	}

	order, err := h.orderService.GetAuthorizedOrder(orderID, userID, "")
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	monitor, err := h.buildOrderMonitor(order)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, monitor)
}

func (h *Handler) Timeline(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	orderID, ok := parseOrderID(c)
	if !ok {
		return
	}

	order, err := h.orderService.GetAuthorizedOrder(orderID, userID, "")
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	timeline, err := h.buildOrderTimelinePayload(order)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, timeline)
}

func (h *Handler) GetDevelopmentFlightSimulation(c *gin.Context) {
	order, ok := h.loadAuthorizedPilotDevelopmentOrder(c)
	if !ok {
		return
	}

	state, err := h.flightService.InspectDevelopmentSimulation(order)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, state)
}

func (h *Handler) StartDevelopmentFlightSimulation(c *gin.Context) {
	order, ok := h.loadAuthorizedPilotDevelopmentOrder(c)
	if !ok {
		return
	}

	var req struct {
		ResetExistingData  *bool `json:"reset_existing_data"`
		InjectSampleAlerts *bool `json:"inject_sample_alerts"`
	}
	if err := c.ShouldBindJSON(&req); err != nil && err != io.EOF {
		response.V2ValidationError(c, "invalid development simulation payload")
		return
	}

	options := service.DevelopmentFlightSimulationOptions{}
	if req.ResetExistingData != nil {
		options.ResetExistingData = *req.ResetExistingData
	}
	if req.InjectSampleAlerts != nil {
		options.InjectSampleAlerts = *req.InjectSampleAlerts
	} else {
		options.InjectSampleAlerts = true
	}

	state, err := h.flightService.StartDevelopmentSimulation(order, options)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, state)
}

func (h *Handler) StopDevelopmentFlightSimulation(c *gin.Context) {
	order, ok := h.loadAuthorizedPilotDevelopmentOrder(c)
	if !ok {
		return
	}

	state, err := h.flightService.StopDevelopmentSimulation(order.ID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, state)
}

func (h *Handler) CreateDispute(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	orderID, ok := parseOrderID(c)
	if !ok {
		return
	}

	var req struct {
		DisputeType string `json:"dispute_type"`
		Summary     string `json:"summary" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid dispute payload")
		return
	}

	record, err := h.orderService.CreateDispute(orderID, userID, req.DisputeType, req.Summary)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, gin.H{
		"id":                record.ID,
		"order_id":          record.OrderID,
		"initiator_user_id": record.InitiatorUserID,
		"dispute_type":      record.DisputeType,
		"status":            record.Status,
		"summary":           record.Summary,
		"created_at":        record.CreatedAt,
		"updated_at":        record.UpdatedAt,
	})
}

func (h *Handler) ListDisputes(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	orderID, ok := parseOrderID(c)
	if !ok {
		return
	}
	if _, err := h.orderService.GetAuthorizedOrder(orderID, userID, ""); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	disputes, err := h.orderService.ListDisputesByOrder(orderID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	response.V2Success(c, gin.H{"items": buildDisputeList(disputes)})
}

func (h *Handler) buildOrderDetail(order *model.Order) (gin.H, error) {
	payments, err := h.orderService.ListPaymentsByOrder(order.ID)
	if err != nil {
		return nil, err
	}
	refunds, err := h.orderService.ListRefundsByOrder(order.ID)
	if err != nil {
		return nil, err
	}
	disputes, err := h.orderService.ListDisputesByOrder(order.ID)
	if err != nil {
		return nil, err
	}
	snapshots, err := h.orderService.ListSnapshotsByOrder(order.ID)
	if err != nil {
		return nil, err
	}
	timeline, err := h.orderService.GetTimeline(order.ID)
	if err != nil {
		return nil, err
	}

	currentDispatch, err := h.dispatchService.GetCurrentFormalTaskByOrder(order.ID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	dispatchHistory, err := h.dispatchService.ListFormalTasksByOrder(order.ID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	data := buildOrderSummary(order)
	data["source_info"] = gin.H{
		"order_source":     order.OrderSource,
		"demand_id":        nullableInt64(order.DemandID),
		"source_supply_id": nullableInt64(order.SourceSupplyID),
		"snapshots":        buildSnapshotMap(snapshots),
	}
	data["participants"] = gin.H{
		"client":   buildUserSummary(order.Renter, order.ClientUserID, "client"),
		"provider": buildUserSummary(order.Owner, order.ProviderUserID, "owner"),
		"executor": buildExecutorSummary(order, currentDispatch),
	}
	data["current_dispatch"] = buildDispatchTaskSummary(currentDispatch)
	data["dispatch_history"] = buildDispatchTaskList(dispatchHistory)
	data["financial_summary"] = buildFinancialSummary(order, payments, refunds)
	data["payments"] = buildPayments(payments)
	data["refunds"] = buildRefunds(refunds)
	data["disputes"] = buildDisputeList(disputes)
	data["dispute_count"] = len(disputes)
	data["timeline"] = buildTimelineList(timeline)
	return data, nil
}

func (h *Handler) buildOrderMonitor(order *model.Order) (gin.H, error) {
	var (
		currentDispatch *model.FormalDispatchTask
		latestRecord    *model.FlightRecord
		activeRecord    *model.FlightRecord
		latestPosition  *model.FlightPosition
		flightStats     map[string]interface{}
	)

	var err error
	currentDispatch, err = h.dispatchService.GetCurrentFormalTaskByOrder(order.ID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	activeRecord, err = h.flightService.GetActiveFlightRecordByOrder(order.ID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	latestRecord, err = h.flightService.GetLatestFlightRecordByOrder(order.ID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	latestPosition, err = h.flightService.GetLatestPosition(order.ID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	positions, err := h.flightService.GetPositionHistory(order.ID, 20)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	activeAlerts, err := h.flightService.GetActiveAlerts(order.ID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	flightRecords, err := h.flightService.ListFlightRecordsByOrder(order.ID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	flightStats, err = h.flightService.GetFlightStats(order.ID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	timeline, err := h.orderService.GetTimeline(order.ID)
	if err != nil {
		return nil, err
	}

	return gin.H{
		"order":                buildOrderSummary(order),
		"current_dispatch":     buildDispatchTaskSummary(currentDispatch),
		"active_flight_record": buildFlightRecordSummary(activeRecord),
		"latest_flight_record": buildFlightRecordSummary(latestRecord),
		"latest_position":      buildPositionSummary(latestPosition),
		"recent_positions":     buildPositionList(positions),
		"active_alerts":        buildAlertList(activeAlerts),
		"flight_records":       buildFlightRecordList(flightRecords),
		"flight_stats":         flightStats,
		"timeline":             buildTimelineList(timeline),
	}, nil
}

func (h *Handler) buildOrderTimelinePayload(order *model.Order) (gin.H, error) {
	payments, err := h.orderService.ListPaymentsByOrder(order.ID)
	if err != nil {
		return nil, err
	}
	refunds, err := h.orderService.ListRefundsByOrder(order.ID)
	if err != nil {
		return nil, err
	}
	timeline, err := h.orderService.GetTimeline(order.ID)
	if err != nil {
		return nil, err
	}
	dispatchHistory, err := h.dispatchService.ListFormalTasksByOrder(order.ID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	flightRecords, err := h.flightService.ListFlightRecordsByOrder(order.ID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	return gin.H{
		"order": buildOrderSummary(order),
		"items": buildAggregatedOrderTimeline(timeline, payments, refunds, dispatchHistory, flightRecords),
	}, nil
}

func parseOrderID(c *gin.Context) (int64, bool) {
	orderID, err := strconv.ParseInt(c.Param("order_id"), 10, 64)
	if err != nil || orderID <= 0 {
		response.V2ValidationError(c, "invalid order_id")
		return 0, false
	}
	return orderID, true
}

func (h *Handler) loadAuthorizedPilotDevelopmentOrder(c *gin.Context) (*model.Order, bool) {
	if gin.Mode() == gin.ReleaseMode {
		response.V2Forbidden(c, "测试飞行模拟仅在非生产环境开放")
		return nil, false
	}

	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return nil, false
	}

	orderID, ok := parseOrderID(c)
	if !ok {
		return nil, false
	}

	order, err := h.orderService.GetAuthorizedOrder(orderID, userID, "pilot")
	if err != nil {
		v2common.HandleServiceError(c, err)
		return nil, false
	}
	return order, true
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
		"demand_id":              nullableInt64(order.DemandID),
		"source_supply_id":       nullableInt64(order.SourceSupplyID),
		"status":                 order.Status,
		"needs_dispatch":         order.NeedsDispatch,
		"execution_mode":         order.ExecutionMode,
		"provider_user_id":       nullableInt64(order.ProviderUserID),
		"executor_pilot_user_id": nullableInt64(order.ExecutorPilotUserID),
		"dispatch_task_id":       order.DispatchTaskID,
		"service_type":           order.ServiceType,
		"service_address":        order.ServiceAddress,
		"dest_address":           order.DestAddress,
		"start_time":             order.StartTime,
		"end_time":               order.EndTime,
		"total_amount":           order.TotalAmount,
		"paid_at":                order.PaidAt,
		"provider_confirmed_at":  order.ProviderConfirmedAt,
		"provider_rejected_at":   order.ProviderRejectedAt,
		"provider_reject_reason": order.ProviderRejectReason,
		"cancel_reason":          order.CancelReason,
		"cancel_by":              order.CancelBy,
		"client":                 buildUserSummary(order.Renter, fallbackPositive(order.ClientUserID, order.RenterID), "client"),
		"provider":               buildUserSummary(order.Owner, fallbackPositive(order.ProviderUserID, order.OwnerID), "owner"),
		"executor":               buildExecutorSummary(order, nil),
		"drone_id":               nullableInt64(order.DroneID),
		"drone":                  buildDroneSummary(order.Drone),
		"created_at":             order.CreatedAt,
		"updated_at":             order.UpdatedAt,
	}
}

func fallbackPositive(values ...int64) int64 {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 0
}

func buildDroneSummary(drone *model.Drone) gin.H {
	if drone == nil {
		return nil
	}
	return gin.H{
		"id":                  drone.ID,
		"brand":               drone.Brand,
		"model":               drone.Model,
		"serial_number":       drone.SerialNumber,
		"mtow_kg":             drone.MTOWKG,
		"max_payload_kg":      drone.MaxPayloadKG,
		"availability_status": drone.AvailabilityStatus,
	}
}

func buildUserSummary(user *model.User, fallbackID int64, role string) gin.H {
	if user == nil && fallbackID == 0 {
		return nil
	}
	result := gin.H{
		"user_id": fallbackID,
		"role":    role,
	}
	if user != nil {
		result["user_id"] = user.ID
		result["nickname"] = user.Nickname
		result["avatar_url"] = user.AvatarURL
		result["phone"] = user.Phone
	}
	return result
}

func buildExecutorSummary(order *model.Order, task *model.FormalDispatchTask) gin.H {
	if order == nil {
		return nil
	}
	if order.ExecutionMode == "self_execute" {
		return buildUserSummary(order.Owner, order.ProviderUserID, "pilot")
	}
	if task != nil && task.TargetPilot != nil {
		return buildUserSummary(task.TargetPilot, task.TargetPilot.ID, "pilot")
	}
	if order.ExecutorPilotUserID > 0 {
		return gin.H{
			"user_id": order.ExecutorPilotUserID,
			"role":    "pilot",
		}
	}
	return nil
}

func buildDispatchTaskSummary(task *model.FormalDispatchTask) gin.H {
	if task == nil {
		return nil
	}
	return gin.H{
		"id":                   task.ID,
		"dispatch_no":          task.DispatchNo,
		"order_id":             task.OrderID,
		"provider_user_id":     task.ProviderUserID,
		"target_pilot_user_id": task.TargetPilotUserID,
		"dispatch_source":      task.DispatchSource,
		"retry_count":          task.RetryCount,
		"status":               task.Status,
		"reason":               task.Reason,
		"sent_at":              task.SentAt,
		"responded_at":         task.RespondedAt,
		"provider":             buildUserSummary(task.Provider, task.ProviderUserID, "owner"),
		"target_pilot":         buildUserSummary(task.TargetPilot, task.TargetPilotUserID, "pilot"),
		"created_at":           task.CreatedAt,
		"updated_at":           task.UpdatedAt,
	}
}

func buildDispatchTaskList(tasks []model.FormalDispatchTask) []gin.H {
	items := make([]gin.H, 0, len(tasks))
	for i := range tasks {
		items = append(items, buildDispatchTaskSummary(&tasks[i]))
	}
	return items
}

func buildFlightRecordSummary(record *model.FlightRecord) gin.H {
	if record == nil {
		return nil
	}
	return gin.H{
		"id":                     record.ID,
		"flight_no":              record.FlightNo,
		"order_id":               record.OrderID,
		"dispatch_task_id":       record.DispatchTaskID,
		"pilot_user_id":          record.PilotUserID,
		"drone_id":               record.DroneID,
		"status":                 record.Status,
		"takeoff_at":             record.TakeoffAt,
		"landing_at":             record.LandingAt,
		"total_duration_seconds": record.TotalDurationSeconds,
		"total_distance_m":       record.TotalDistanceM,
		"max_altitude_m":         record.MaxAltitudeM,
		"created_at":             record.CreatedAt,
		"updated_at":             record.UpdatedAt,
	}
}

func buildFlightRecordList(records []model.FlightRecord) []gin.H {
	items := make([]gin.H, 0, len(records))
	for i := range records {
		items = append(items, buildFlightRecordSummary(&records[i]))
	}
	return items
}

func buildPositionSummary(pos *model.FlightPosition) gin.H {
	if pos == nil {
		return nil
	}
	return gin.H{
		"id":               pos.ID,
		"flight_record_id": pos.FlightRecordID,
		"order_id":         pos.OrderID,
		"latitude":         pos.Latitude,
		"longitude":        pos.Longitude,
		"altitude":         pos.Altitude,
		"speed":            pos.Speed,
		"heading":          pos.Heading,
		"battery_level":    pos.BatteryLevel,
		"signal_strength":  pos.SignalStrength,
		"recorded_at":      pos.RecordedAt,
	}
}

func buildPositionList(positions []model.FlightPosition) []gin.H {
	items := make([]gin.H, 0, len(positions))
	for i := range positions {
		items = append(items, buildPositionSummary(&positions[i]))
	}
	return items
}

func buildAlertList(alerts []model.FlightAlert) []gin.H {
	items := make([]gin.H, 0, len(alerts))
	for i := range alerts {
		items = append(items, gin.H{
			"id":               alerts[i].ID,
			"flight_record_id": alerts[i].FlightRecordID,
			"order_id":         alerts[i].OrderID,
			"alert_type":       alerts[i].AlertType,
			"alert_level":      alerts[i].AlertLevel,
			"title":            alerts[i].Title,
			"description":      alerts[i].Description,
			"status":           alerts[i].Status,
			"triggered_at":     alerts[i].TriggeredAt,
		})
	}
	return items
}

func buildPayments(payments []model.Payment) []gin.H {
	items := make([]gin.H, 0, len(payments))
	for i := range payments {
		items = append(items, buildPaymentSummary(&payments[i]))
	}
	return items
}

func buildRefunds(refunds []model.Refund) []gin.H {
	items := make([]gin.H, 0, len(refunds))
	for i := range refunds {
		items = append(items, buildRefundSummary(&refunds[i]))
	}
	return items
}

func buildDisputeList(disputes []model.DisputeRecord) []gin.H {
	items := make([]gin.H, 0, len(disputes))
	for i := range disputes {
		items = append(items, gin.H{
			"id":                disputes[i].ID,
			"order_id":          disputes[i].OrderID,
			"initiator_user_id": disputes[i].InitiatorUserID,
			"dispute_type":      disputes[i].DisputeType,
			"status":            disputes[i].Status,
			"summary":           disputes[i].Summary,
			"created_at":        disputes[i].CreatedAt,
			"updated_at":        disputes[i].UpdatedAt,
		})
	}
	return items
}

func buildFinancialSummary(order *model.Order, payments []model.Payment, refunds []model.Refund) gin.H {
	paidAmount := int64(0)
	paidCount := 0
	for i := range payments {
		if payments[i].Status == "paid" || payments[i].Status == "refunded" {
			paidAmount += payments[i].Amount
			paidCount++
		}
	}
	refundedAmount := int64(0)
	refundCount := 0
	for i := range refunds {
		if refunds[i].Status == "" || refunds[i].Status == "pending" || refunds[i].Status == "success" || refunds[i].Status == "completed" {
			refundedAmount += refunds[i].Amount
		}
		refundCount++
	}
	return gin.H{
		"total_amount":           order.TotalAmount,
		"deposit_amount":         order.DepositAmount,
		"platform_commission":    order.PlatformCommission,
		"owner_amount":           order.OwnerAmount,
		"paid_amount":            paidAmount,
		"paid_count":             paidCount,
		"refunded_amount":        refundedAmount,
		"refund_count":           refundCount,
		"provider_reject_reason": order.ProviderRejectReason,
	}
}

func buildTimelineList(items []model.OrderTimeline) []gin.H {
	result := make([]gin.H, 0, len(items))
	for i := range items {
		result = append(result, buildTimelineSummary(&items[i]))
	}
	return result
}

func buildPaymentSummary(payment *model.Payment) gin.H {
	if payment == nil {
		return nil
	}
	return gin.H{
		"id":             payment.ID,
		"payment_no":     payment.PaymentNo,
		"payment_type":   payment.PaymentType,
		"payment_method": payment.PaymentMethod,
		"amount":         payment.Amount,
		"status":         payment.Status,
		"paid_at":        payment.PaidAt,
		"created_at":     payment.CreatedAt,
	}
}

func buildRefundSummary(refund *model.Refund) gin.H {
	if refund == nil {
		return nil
	}
	return gin.H{
		"id":         refund.ID,
		"refund_no":  refund.RefundNo,
		"payment_id": refund.PaymentID,
		"amount":     refund.Amount,
		"reason":     refund.Reason,
		"status":     refund.Status,
		"created_at": refund.CreatedAt,
		"updated_at": refund.UpdatedAt,
	}
}

func buildTimelineSummary(item *model.OrderTimeline) gin.H {
	if item == nil {
		return nil
	}
	return gin.H{
		"id":            item.ID,
		"status":        item.Status,
		"note":          item.Note,
		"operator_id":   item.OperatorID,
		"operator_type": item.OperatorType,
		"created_at":    item.CreatedAt,
	}
}

func buildAggregatedOrderTimeline(
	timelineItems []model.OrderTimeline,
	payments []model.Payment,
	refunds []model.Refund,
	dispatchTasks []model.FormalDispatchTask,
	flightRecords []model.FlightRecord,
) []aggregatedOrderTimelineEvent {
	events := make([]aggregatedOrderTimelineEvent, 0, len(timelineItems)+len(payments)+len(refunds)+(len(dispatchTasks)*2)+(len(flightRecords)*2))

	for i := range timelineItems {
		title := timelineItems[i].Note
		if title == "" {
			title = orderTimelineEventTitle(timelineItems[i].Status)
		}
		events = append(events, aggregatedOrderTimelineEvent{
			EventID:      fmt.Sprintf("timeline-%d", timelineItems[i].ID),
			SourceType:   "order_timeline",
			SourceID:     timelineItems[i].ID,
			EventType:    "order_status_changed",
			Title:        title,
			Description:  timelineItems[i].Status,
			Status:       timelineItems[i].Status,
			OccurredAt:   timelineItems[i].CreatedAt,
			OperatorID:   timelineItems[i].OperatorID,
			OperatorType: timelineItems[i].OperatorType,
			Payload:      buildTimelineSummary(&timelineItems[i]),
		})
	}

	for i := range payments {
		occurredAt := payments[i].CreatedAt
		if payments[i].PaidAt != nil {
			occurredAt = *payments[i].PaidAt
		}
		events = append(events, aggregatedOrderTimelineEvent{
			EventID:     fmt.Sprintf("payment-%d", payments[i].ID),
			SourceType:  "payment",
			SourceID:    payments[i].ID,
			EventType:   "payment_" + payments[i].Status,
			Title:       paymentEventTitle(payments[i].Status),
			Description: fmt.Sprintf("支付方式：%s，金额：%d 分", payments[i].PaymentMethod, payments[i].Amount),
			Status:      payments[i].Status,
			OccurredAt:  occurredAt,
			Payload:     buildPaymentSummary(&payments[i]),
		})
	}

	for i := range refunds {
		events = append(events, aggregatedOrderTimelineEvent{
			EventID:     fmt.Sprintf("refund-%d", refunds[i].ID),
			SourceType:  "refund",
			SourceID:    refunds[i].ID,
			EventType:   "refund_" + refunds[i].Status,
			Title:       refundEventTitle(refunds[i].Status),
			Description: refunds[i].Reason,
			Status:      refunds[i].Status,
			OccurredAt:  refunds[i].CreatedAt,
			Payload:     buildRefundSummary(&refunds[i]),
		})
	}

	for i := range dispatchTasks {
		payload := buildDispatchTaskSummary(&dispatchTasks[i])
		sentAt := dispatchTasks[i].CreatedAt
		if dispatchTasks[i].SentAt != nil {
			sentAt = *dispatchTasks[i].SentAt
		}
		events = append(events, aggregatedOrderTimelineEvent{
			EventID:    fmt.Sprintf("dispatch-sent-%d", dispatchTasks[i].ID),
			SourceType: "dispatch_task",
			SourceID:   dispatchTasks[i].ID,
			EventType:  "dispatch_sent",
			Title:      "已发起派单",
			Description: fmt.Sprintf(
				"派单方式：%s",
				dispatchTasks[i].DispatchSource,
			),
			Status:     dispatchTasks[i].Status,
			OccurredAt: sentAt,
			Payload:    payload,
		})
		if dispatchTasks[i].RespondedAt != nil {
			events = append(events, aggregatedOrderTimelineEvent{
				EventID:     fmt.Sprintf("dispatch-response-%d", dispatchTasks[i].ID),
				SourceType:  "dispatch_task",
				SourceID:    dispatchTasks[i].ID,
				EventType:   "dispatch_" + dispatchTasks[i].Status,
				Title:       dispatchTimelineTitle(dispatchTasks[i].Status),
				Description: dispatchTasks[i].Reason,
				Status:      dispatchTasks[i].Status,
				OccurredAt:  *dispatchTasks[i].RespondedAt,
				Payload:     payload,
			})
		}
	}

	for i := range flightRecords {
		payload := buildFlightRecordSummary(&flightRecords[i])
		if flightRecords[i].TakeoffAt != nil {
			events = append(events, aggregatedOrderTimelineEvent{
				EventID:     fmt.Sprintf("flight-takeoff-%d", flightRecords[i].ID),
				SourceType:  "flight_record",
				SourceID:    flightRecords[i].ID,
				EventType:   "flight_takeoff",
				Title:       "无人机已起飞",
				Description: flightRecords[i].FlightNo,
				Status:      flightRecords[i].Status,
				OccurredAt:  *flightRecords[i].TakeoffAt,
				Payload:     payload,
			})
		}
		if flightRecords[i].LandingAt != nil {
			events = append(events, aggregatedOrderTimelineEvent{
				EventID:     fmt.Sprintf("flight-landing-%d", flightRecords[i].ID),
				SourceType:  "flight_record",
				SourceID:    flightRecords[i].ID,
				EventType:   "flight_landing",
				Title:       "飞行架次已完成",
				Description: flightRecords[i].FlightNo,
				Status:      flightRecords[i].Status,
				OccurredAt:  *flightRecords[i].LandingAt,
				Payload:     payload,
			})
			continue
		}
		if flightRecords[i].TakeoffAt == nil {
			events = append(events, aggregatedOrderTimelineEvent{
				EventID:     fmt.Sprintf("flight-created-%d", flightRecords[i].ID),
				SourceType:  "flight_record",
				SourceID:    flightRecords[i].ID,
				EventType:   "flight_record_created",
				Title:       "飞行记录已创建",
				Description: flightRecords[i].FlightNo,
				Status:      flightRecords[i].Status,
				OccurredAt:  flightRecords[i].CreatedAt,
				Payload:     payload,
			})
		}
	}

	sort.SliceStable(events, func(i, j int) bool {
		if events[i].OccurredAt.Equal(events[j].OccurredAt) {
			return events[i].EventID > events[j].EventID
		}
		return events[i].OccurredAt.After(events[j].OccurredAt)
	})

	return events
}

func orderTimelineEventTitle(status string) string {
	switch status {
	case "pending_payment":
		return "订单待支付"
	case "paid":
		return "订单已支付"
	case "pending_dispatch":
		return "订单待派单"
	case "assigned":
		return "订单已分配"
	case "preparing", "loading":
		return "订单准备中"
	case "in_transit":
		return "订单执行中"
	case "delivered":
		return "订单已投送"
	case "completed":
		return "订单已完成"
	case "cancelled":
		return "订单已取消"
	default:
		return "订单状态更新"
	}
}

func paymentEventTitle(status string) string {
	switch status {
	case "paid":
		return "支付成功"
	case "failed":
		return "支付失败"
	case "refunded":
		return "支付已退款"
	default:
		return "支付单已创建"
	}
}

func refundEventTitle(status string) string {
	switch status {
	case "success", "completed":
		return "退款已完成"
	case "failed":
		return "退款失败"
	default:
		return "退款处理中"
	}
}

func dispatchTimelineTitle(status string) string {
	switch status {
	case "accepted":
		return "飞手已接受派单"
	case "rejected":
		return "飞手已拒绝派单"
	case "expired":
		return "派单已过期"
	case "cancelled":
		return "派单已取消"
	default:
		return "派单状态更新"
	}
}

func buildSnapshotMap(snapshots []model.OrderSnapshot) gin.H {
	result := gin.H{}
	for i := range snapshots {
		if len(snapshots[i].SnapshotData) == 0 {
			result[snapshots[i].SnapshotType] = gin.H{}
			continue
		}
		var payload interface{}
		if err := json.Unmarshal(snapshots[i].SnapshotData, &payload); err != nil {
			result[snapshots[i].SnapshotType] = string(snapshots[i].SnapshotData)
			continue
		}
		result[snapshots[i].SnapshotType] = payload
	}
	return result
}

func nullableInt64(value int64) interface{} {
	if value == 0 {
		return nil
	}
	return value
}

func normalizeOrderActorRole(userType string) string {
	switch userType {
	case "owner", "drone_owner":
		return "owner"
	case "pilot":
		return "pilot"
	case "client", "renter", "cargo_owner":
		return "client"
	default:
		return ""
	}
}

func (h *Handler) resolveOrderActorRole(c *gin.Context, order *model.Order, userID int64) string {
	if preferred := normalizeOrderActorRole(middleware.GetUserType(c)); preferred != "" && h.orderService.CanAccessOrder(order, userID, preferred) {
		return preferred
	}

	for _, role := range []string{"client", "owner", "pilot"} {
		if h.orderService.CanAccessOrder(order, userID, role) {
			return role
		}
	}
	return ""
}

func (h *Handler) advanceExecutionStage(c *gin.Context, action func(userID int64, orderID int64) error, syncFlight bool) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	orderID, ok := parseOrderID(c)
	if !ok {
		return
	}

	if err := action(userID, orderID); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	if syncFlight && h.flightService != nil {
		if err := h.flightService.SyncOrderFlightRecord(orderID); err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			v2common.HandleServiceError(c, err)
			return
		}
	}

	order, err := h.orderService.GetAuthorizedOrder(orderID, userID, "")
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	response.V2Success(c, buildOrderSummary(order))
}

func (h *Handler) UpdateExecutionStatus(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	orderID, ok := parseOrderID(c)
	if !ok {
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid execution status payload")
		return
	}

	if err := h.orderService.UpdateExecutionStatus(userID, orderID, req.Status); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	response.V2Success(c, gin.H{"status": req.Status})
}

func (h *Handler) ConfirmReceipt(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	orderID, ok := parseOrderID(c)
	if !ok {
		return
	}

	if err := h.orderService.ConfirmReceipt(userID, orderID); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	response.V2Success(c, gin.H{"message": "已确认签收"})
}

// ─── 合同 API ─────────────────────────────────────────

// GetContract 获取订单关联合同
func (h *Handler) GetContract(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	orderID, ok := parseOrderID(c)
	if !ok {
		return
	}

	// 权限检查
	if _, err := h.orderService.GetAuthorizedOrder(orderID, userID, ""); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	if h.contractService == nil {
		response.V2Error(c, 500, "INTERNAL_ERROR", "合同服务未初始化")
		return
	}

	contract, err := h.contractService.GetContractByOrder(orderID)
	if err != nil {
		response.V2Error(c, 404, "NOT_FOUND", "该订单暂无合同")
		return
	}

	response.V2Success(c, buildContractResponse(contract))
}

// SignContract 签署订单合同
func (h *Handler) SignContract(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	orderID, ok := parseOrderID(c)
	if !ok {
		return
	}

	if _, err := h.orderService.GetAuthorizedOrder(orderID, userID, ""); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	if h.contractService == nil {
		response.V2Error(c, 500, "INTERNAL_ERROR", "合同服务未初始化")
		return
	}

	contract, err := h.contractService.SignContractByOrder(orderID, userID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	response.V2Success(c, buildContractResponse(contract))
}

// GetContractPDFDownloadInfo 获取合同 PDF 下载链接
func (h *Handler) GetContractPDFDownloadInfo(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	orderID, ok := parseOrderID(c)
	if !ok {
		return
	}

	if _, err := h.orderService.GetAuthorizedOrder(orderID, userID, ""); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	if h.contractService == nil {
		response.V2Error(c, 500, "INTERNAL_ERROR", "合同服务未初始化")
		return
	}

	contract, err := h.contractService.GetContractByOrder(orderID)
	if err != nil {
		response.V2Error(c, 404, "NOT_FOUND", "该订单暂无合同")
		return
	}

	token, expiresAt, err := h.contractService.GenerateContractPDFDownloadToken(orderID, userID)
	if err != nil {
		response.V2Error(c, 500, "INTERNAL_ERROR", err.Error())
		return
	}

	filename := service.BuildContractPDFFilename(contract)
	downloadURL := fmt.Sprintf(
		"%s/api/v2/orders/%d/contract/pdf?download_token=%s",
		requestBaseURL(c),
		orderID,
		url.QueryEscape(token),
	)

	response.V2Success(c, gin.H{
		"filename":     filename,
		"download_url": downloadURL,
		"expires_at":   expiresAt,
	})
}

// DownloadContractPDF 下载订单合同 PDF
func (h *Handler) DownloadContractPDF(c *gin.Context) {
	orderID, ok := parseOrderID(c)
	if !ok {
		return
	}

	if h.contractService == nil {
		response.V2Error(c, 500, "INTERNAL_ERROR", "合同服务未初始化")
		return
	}

	downloadToken := c.Query("download_token")
	if downloadToken == "" {
		response.V2Unauthorized(c, "missing contract download token")
		return
	}

	userID, tokenOrderID, err := h.contractService.ParseContractPDFDownloadToken(downloadToken)
	if err != nil {
		response.V2Unauthorized(c, err.Error())
		return
	}
	if tokenOrderID != orderID {
		response.V2Forbidden(c, "合同下载链接与订单不匹配")
		return
	}

	if _, err := h.orderService.GetAuthorizedOrder(orderID, userID, ""); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	pdfBytes, contract, err := h.contractService.BuildContractPDFByOrder(orderID)
	if err != nil {
		response.V2Error(c, 500, "PDF_EXPORT_FAILED", err.Error())
		return
	}

	filename := service.BuildContractPDFFilename(contract)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", service.BuildContractPDFFilenameHeader(filename))
	c.Header("Content-Length", strconv.Itoa(len(pdfBytes)))
	c.Header("Cache-Control", "private, max-age=60")
	c.Data(200, "application/pdf", pdfBytes)
}

func buildContractResponse(c *model.OrderContract) gin.H {
	if c == nil {
		return nil
	}
	return gin.H{
		"id":                  c.ID,
		"contract_no":         c.ContractNo,
		"order_id":            c.OrderID,
		"order_no":            c.OrderNo,
		"title":               c.Title,
		"status":              c.Status,
		"client_user_id":      c.ClientUserID,
		"provider_user_id":    c.ProviderUserID,
		"contract_amount":     c.ContractAmount,
		"platform_commission": c.PlatformCommission,
		"provider_amount":     c.ProviderAmount,
		"client_signed_at":    c.ClientSignedAt,
		"provider_signed_at":  c.ProviderSignedAt,
		"contract_html":       c.ContractHTML,
		"created_at":          c.CreatedAt,
		"updated_at":          c.UpdatedAt,
	}
}

func requestBaseURL(c *gin.Context) string {
	scheme := c.GetHeader("X-Forwarded-Proto")
	if scheme == "" {
		if c.Request.TLS != nil {
			scheme = "https"
		} else {
			scheme = "http"
		}
	}

	host := c.GetHeader("X-Forwarded-Host")
	if host == "" {
		host = c.Request.Host
	}

	return fmt.Sprintf("%s://%s", scheme, host)
}
