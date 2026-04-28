package anomaly

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	orderAnomalyService *service.OrderAnomalyService
}

func NewHandler(orderAnomalyService *service.OrderAnomalyService) *Handler {
	return &Handler{orderAnomalyService: orderAnomalyService}
}

func (h *Handler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	page, pageSize := middleware.GetPagination(c)
	role := strings.TrimSpace(c.Query("role"))
	filters := parseAnomalyFilters(c)

	items, total, err := h.orderAnomalyService.ListForUser(userID, role, page, pageSize, filters)
	if err != nil {
		response.V2InternalError(c, err.Error())
		return
	}

	result := make([]gin.H, 0, len(items))
	for i := range items {
		item := items[i]
		result = append(result, gin.H{
			"order_id":            item.OrderID,
			"order_no":            item.OrderNo,
			"title":               item.Title,
			"status":              item.Status,
			"stage_label":         service.BuildAnomalyStageLabel(item.Status),
			"order_source":        item.OrderSource,
			"dispatch_task_id":    item.DispatchTaskID,
			"provider_nickname":   item.ProviderNickname,
			"client_nickname":     item.ClientNickname,
			"anomaly_type":        item.AnomalyType,
			"severity":            item.Severity,
			"message":             item.Message,
			"updated_at":          item.UpdatedAt,
			"stalled_text":        formatStalledText(item.UpdatedAt),
			"recommended_action":  service.BuildAnomalyRecommendedAction(item.AnomalyType),
		})
	}

	response.V2SuccessList(c, result, total)
}

func (h *Handler) Summary(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	role := strings.TrimSpace(c.Query("role"))
	filters := parseAnomalyFilters(c)
	summary, err := h.orderAnomalyService.SummaryForUser(userID, role, filters)
	if err != nil {
		response.V2InternalError(c, err.Error())
		return
	}
	response.V2Success(c, summary)
}

func parseAnomalyFilters(c *gin.Context) map[string]interface{} {
	filters := make(map[string]interface{})
	if anomalyType := strings.TrimSpace(c.Query("anomaly_type")); anomalyType != "" {
		filters["anomaly_type"] = anomalyType
	}
	if severity := strings.TrimSpace(c.Query("severity")); severity != "" {
		filters["severity"] = severity
	}
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		filters["status"] = status
	}
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		filters["keyword"] = keyword
	}
	if rawOrderID := strings.TrimSpace(c.Query("order_id")); rawOrderID != "" {
		if orderID, err := strconv.ParseInt(rawOrderID, 10, 64); err == nil && orderID > 0 {
			filters["order_id"] = orderID
		}
	}
	return filters
}

func formatStalledText(updatedAt time.Time) string {
	if updatedAt.IsZero() {
		return ""
	}
	duration := time.Since(updatedAt)
	if duration < time.Hour {
		return "最近 1 小时内更新"
	}
	hours := int(duration.Hours())
	if hours < 24 {
		return fmt.Sprintf("已停滞约 %d 小时", hours)
	}
	return fmt.Sprintf("已停滞约 %d 天", hours/24)
}
