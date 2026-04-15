package flight

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/gin-gonic/gin/binding"

	"wurenji-backend/internal/api/middleware"
	v2common "wurenji-backend/internal/api/v2/common"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	flightService *service.FlightService
	orderService  *service.OrderService
}

func NewHandler(flightService *service.FlightService, orderService *service.OrderService) *Handler {
	return &Handler{
		flightService: flightService,
		orderService:  orderService,
	}
}

func (h *Handler) Get(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	record, order, ok := h.loadAuthorizedFlightRecord(c, userID, "")
	if !ok {
		return
	}

	positions, err := h.flightService.GetPositionsByFlightRecord(record.ID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	alerts, err := h.flightService.GetAlertsByFlightRecord(record.ID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	stats, err := h.flightService.GetFlightStats(order.ID)
	if err != nil && err != gorm.ErrRecordNotFound {
		v2common.HandleServiceError(c, err)
		return
	}

	response.V2Success(c, gin.H{
		"flight_record":   buildFlightRecordSummary(record),
		"order":           buildFlightOrderSummary(order),
		"positions":       buildPositionList(positions),
		"alerts":          buildAlertList(alerts),
		"latest_position": buildLatestPosition(positions),
		"alert_count":     len(alerts),
		"position_count":  len(positions),
		"flight_stats":    stats,
	})
}

func (h *Handler) ReportPosition(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	record, order, ok := h.loadAuthorizedFlightRecord(c, userID, "pilot")
	if !ok {
		return
	}

	var req struct {
		Latitude       *float64   `json:"latitude" binding:"required"`
		Longitude      *float64   `json:"longitude" binding:"required"`
		Altitude       int        `json:"altitude"`
		Speed          int        `json:"speed"`
		Heading        int        `json:"heading"`
		VerticalSpeed  int        `json:"vertical_speed"`
		BatteryLevel   int        `json:"battery_level"`
		SignalStrength int        `json:"signal_strength"`
		GPSSatellites  int        `json:"gps_satellites"`
		Temperature    *int       `json:"temperature"`
		WindSpeed      *int       `json:"wind_speed"`
		WindDirection  *int       `json:"wind_direction"`
		RecordedAt     *time.Time `json:"recorded_at"`
	}
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		response.V2ValidationError(c, "invalid flight position payload")
		return
	}

	pos, alerts, err := h.flightService.ReportPosition(&service.ReportPositionRequest{
		OrderID:        record.OrderID,
		DroneID:        record.DroneID,
		PilotID:        order.PilotID,
		Latitude:       *req.Latitude,
		Longitude:      *req.Longitude,
		Altitude:       req.Altitude,
		Speed:          req.Speed,
		Heading:        req.Heading,
		VerticalSpeed:  req.VerticalSpeed,
		BatteryLevel:   req.BatteryLevel,
		SignalStrength: req.SignalStrength,
		GPSSatellites:  req.GPSSatellites,
		Temperature:    req.Temperature,
		WindSpeed:      req.WindSpeed,
		WindDirection:  req.WindDirection,
		RecordedAt:     req.RecordedAt,
	})
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	response.V2Success(c, gin.H{
		"flight_record_id": record.ID,
		"position":         buildPositionSummary(pos),
		"alerts":           buildAlertList(alerts),
	})
}

func (h *Handler) ReportAlert(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	record, order, ok := h.loadAuthorizedFlightRecord(c, userID, "pilot")
	if !ok {
		return
	}

	var req struct {
		AlertType      string     `json:"alert_type" binding:"required"`
		AlertLevel     string     `json:"alert_level" binding:"required"`
		AlertCode      string     `json:"alert_code"`
		Title          string     `json:"title" binding:"required"`
		Description    string     `json:"description"`
		Latitude       *float64   `json:"latitude"`
		Longitude      *float64   `json:"longitude"`
		Altitude       *int       `json:"altitude"`
		ThresholdValue string     `json:"threshold_value"`
		ActualValue    string     `json:"actual_value"`
		TriggeredAt    *time.Time `json:"triggered_at"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid flight alert payload")
		return
	}

	alert, err := h.flightService.CreateManualAlert(&service.CreateFlightAlertInput{
		FlightRecordID: record.ID,
		OrderID:        record.OrderID,
		DroneID:        record.DroneID,
		PilotID:        order.PilotID,
		AlertType:      req.AlertType,
		AlertLevel:     req.AlertLevel,
		AlertCode:      req.AlertCode,
		Title:          req.Title,
		Description:    req.Description,
		Latitude:       req.Latitude,
		Longitude:      req.Longitude,
		Altitude:       req.Altitude,
		ThresholdValue: req.ThresholdValue,
		ActualValue:    req.ActualValue,
		TriggeredAt:    req.TriggeredAt,
	})
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	response.V2Success(c, gin.H{
		"flight_record_id": record.ID,
		"alert":            buildAlertSummary(alert),
	})
}

func (h *Handler) Complete(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	record, order, ok := h.loadAuthorizedFlightRecord(c, userID, "pilot")
	if !ok {
		return
	}

	if record.Status != "completed" {
		switch order.Status {
		case "in_transit":
			if err := h.orderService.ConfirmDelivery(userID, order.ID); err != nil {
				v2common.HandleServiceError(c, err)
				return
			}
		case "delivered", "completed":
		default:
			response.V2BadRequest(c, "订单当前状态不允许完成飞行记录")
			return
		}
	}

	completedRecord, err := h.flightService.CompleteFlightRecord(record.ID, nil)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	updatedOrder, err := h.orderService.GetAuthorizedOrder(order.ID, userID, "pilot")
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	response.V2Success(c, gin.H{
		"flight_record": buildFlightRecordSummary(completedRecord),
		"order":         buildFlightOrderSummary(updatedOrder),
	})
}

func (h *Handler) loadAuthorizedFlightRecord(c *gin.Context, userID int64, role string) (*model.FlightRecord, *model.Order, bool) {
	flightID, ok := parseFlightID(c)
	if !ok {
		return nil, nil, false
	}

	record, err := h.flightService.GetFlightRecordByID(flightID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return nil, nil, false
	}

	order, err := h.orderService.GetAuthorizedOrder(record.OrderID, userID, role)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return nil, nil, false
	}

	return record, order, true
}

func parseFlightID(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("flight_id"), 10, 64)
	if err != nil || id <= 0 {
		response.V2ValidationError(c, "invalid flight_id")
		return 0, false
	}
	return id, true
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

func buildFlightOrderSummary(order *model.Order) gin.H {
	if order == nil {
		return nil
	}
	return gin.H{
		"id":                     order.ID,
		"order_no":               order.OrderNo,
		"title":                  order.Title,
		"status":                 order.Status,
		"order_source":           order.OrderSource,
		"execution_mode":         order.ExecutionMode,
		"needs_dispatch":         order.NeedsDispatch,
		"service_address":        order.ServiceAddress,
		"dest_address":           order.DestAddress,
		"provider_user_id":       order.ProviderUserID,
		"executor_pilot_user_id": order.ExecutorPilotUserID,
	}
}

func buildPositionSummary(pos *model.FlightPosition) gin.H {
	if pos == nil {
		return nil
	}
	return gin.H{
		"id":               pos.ID,
		"flight_record_id": pos.FlightRecordID,
		"order_id":         pos.OrderID,
		"drone_id":         pos.DroneID,
		"pilot_id":         pos.PilotID,
		"latitude":         pos.Latitude,
		"longitude":        pos.Longitude,
		"altitude":         pos.Altitude,
		"speed":            pos.Speed,
		"heading":          pos.Heading,
		"vertical_speed":   pos.VerticalSpeed,
		"battery_level":    pos.BatteryLevel,
		"signal_strength":  pos.SignalStrength,
		"gps_satellites":   pos.GPSSatellites,
		"temperature":      pos.Temperature,
		"wind_speed":       pos.WindSpeed,
		"wind_direction":   pos.WindDirection,
		"recorded_at":      pos.RecordedAt,
		"created_at":       pos.CreatedAt,
	}
}

func buildPositionList(positions []model.FlightPosition) []gin.H {
	items := make([]gin.H, 0, len(positions))
	for i := range positions {
		items = append(items, buildPositionSummary(&positions[i]))
	}
	return items
}

func buildLatestPosition(positions []model.FlightPosition) gin.H {
	if len(positions) == 0 {
		return nil
	}
	return buildPositionSummary(&positions[len(positions)-1])
}

func buildAlertSummary(alert *model.FlightAlert) gin.H {
	if alert == nil {
		return nil
	}
	return gin.H{
		"id":               alert.ID,
		"flight_record_id": alert.FlightRecordID,
		"order_id":         alert.OrderID,
		"drone_id":         alert.DroneID,
		"pilot_id":         alert.PilotID,
		"alert_type":       alert.AlertType,
		"alert_level":      alert.AlertLevel,
		"alert_code":       alert.AlertCode,
		"title":            alert.Title,
		"description":      alert.Description,
		"latitude":         alert.Latitude,
		"longitude":        alert.Longitude,
		"altitude":         alert.Altitude,
		"threshold_value":  alert.ThresholdValue,
		"actual_value":     alert.ActualValue,
		"status":           alert.Status,
		"acknowledged_at":  alert.AcknowledgedAt,
		"acknowledged_by":  alert.AcknowledgedBy,
		"resolved_at":      alert.ResolvedAt,
		"resolution_note":  alert.ResolutionNote,
		"triggered_at":     alert.TriggeredAt,
		"created_at":       alert.CreatedAt,
		"updated_at":       alert.UpdatedAt,
	}
}

func buildAlertList(alerts []model.FlightAlert) []gin.H {
	items := make([]gin.H, 0, len(alerts))
	for i := range alerts {
		items = append(items, buildAlertSummary(&alerts[i]))
	}
	return items
}
