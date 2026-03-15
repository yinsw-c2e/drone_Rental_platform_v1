package settlement

import (
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
	orderService      *service.OrderService
	settlementService *service.SettlementService
}

func NewHandler(orderService *service.OrderService, settlementService *service.SettlementService) *Handler {
	return &Handler{
		orderService:      orderService,
		settlementService: settlementService,
	}
}

func (h *Handler) GetOrderSettlement(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	orderID, err := strconv.ParseInt(c.Param("order_id"), 10, 64)
	if err != nil || orderID <= 0 {
		response.V2ValidationError(c, "invalid order_id")
		return
	}

	order, err := h.orderService.GetAuthorizedOrder(orderID, userID, "")
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	settlement, err := h.settlementService.GetSettlementByOrder(orderID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) && order.Status == "completed" {
			settlement, err = h.settlementService.CreateSettlement(orderID)
		}
		if err != nil {
			v2common.HandleServiceError(c, err)
			return
		}
	}

	response.V2Success(c, buildSettlementSummary(settlement))
}

func buildSettlementSummary(settlement *model.OrderSettlement) gin.H {
	if settlement == nil {
		return nil
	}
	return gin.H{
		"id":                  settlement.ID,
		"settlement_no":       settlement.SettlementNo,
		"order_id":            settlement.OrderID,
		"order_no":            settlement.OrderNo,
		"total_amount":        settlement.TotalAmount,
		"final_amount":        settlement.FinalAmount,
		"platform_fee_rate":   settlement.PlatformFeeRate,
		"platform_fee":        settlement.PlatformFee,
		"pilot_fee_rate":      settlement.PilotFeeRate,
		"pilot_fee":           settlement.PilotFee,
		"owner_fee_rate":      settlement.OwnerFeeRate,
		"owner_fee":           settlement.OwnerFee,
		"insurance_deduction": settlement.InsuranceDeduction,
		"pilot_user_id":       settlement.PilotUserID,
		"owner_user_id":       settlement.OwnerUserID,
		"payer_user_id":       settlement.PayerUserID,
		"flight_distance":     settlement.FlightDistance,
		"flight_duration":     settlement.FlightDuration,
		"cargo_weight":        settlement.CargoWeight,
		"difficulty_factor":   settlement.DifficultyFactor,
		"cargo_value":         settlement.CargoValue,
		"insurance_rate":      settlement.InsuranceRate,
		"status":              settlement.Status,
		"calculated_at":       settlement.CalculatedAt,
		"confirmed_at":        settlement.ConfirmedAt,
		"settled_at":          settlement.SettledAt,
		"settled_by":          settlement.SettledBy,
		"notes":               settlement.Notes,
		"created_at":          settlement.CreatedAt,
		"updated_at":          settlement.UpdatedAt,
	}
}
