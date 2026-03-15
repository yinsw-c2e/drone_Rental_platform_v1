package order

import (
	"encoding/json"
	"errors"
	"strconv"

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
}

func NewHandler(orderService *service.OrderService, dispatchService *service.DispatchService, flightService *service.FlightService) *Handler {
	return &Handler{
		orderService:    orderService,
		dispatchService: dispatchService,
		flightService:   flightService,
	}
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

func parseOrderID(c *gin.Context) (int64, bool) {
	orderID, err := strconv.ParseInt(c.Param("order_id"), 10, 64)
	if err != nil || orderID <= 0 {
		response.V2ValidationError(c, "invalid order_id")
		return 0, false
	}
	return orderID, true
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
		"client":                 buildUserSummary(order.Renter, fallbackPositive(order.ClientUserID, order.RenterID), "client"),
		"provider":               buildUserSummary(order.Owner, fallbackPositive(order.ProviderUserID, order.OwnerID), "owner"),
		"executor":               buildExecutorSummary(order, nil),
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
		items = append(items, gin.H{
			"id":             payments[i].ID,
			"payment_no":     payments[i].PaymentNo,
			"payment_type":   payments[i].PaymentType,
			"payment_method": payments[i].PaymentMethod,
			"amount":         payments[i].Amount,
			"status":         payments[i].Status,
			"paid_at":        payments[i].PaidAt,
			"created_at":     payments[i].CreatedAt,
		})
	}
	return items
}

func buildRefunds(refunds []model.Refund) []gin.H {
	items := make([]gin.H, 0, len(refunds))
	for i := range refunds {
		items = append(items, gin.H{
			"id":         refunds[i].ID,
			"refund_no":  refunds[i].RefundNo,
			"payment_id": refunds[i].PaymentID,
			"amount":     refunds[i].Amount,
			"reason":     refunds[i].Reason,
			"status":     refunds[i].Status,
			"created_at": refunds[i].CreatedAt,
			"updated_at": refunds[i].UpdatedAt,
		})
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
		result = append(result, gin.H{
			"id":            items[i].ID,
			"status":        items[i].Status,
			"note":          items[i].Note,
			"operator_id":   items[i].OperatorID,
			"operator_type": items[i].OperatorType,
			"created_at":    items[i].CreatedAt,
		})
	}
	return result
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
