package review

import (
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	v2common "wurenji-backend/internal/api/v2/common"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	orderService  *service.OrderService
	reviewService *service.ReviewService
}

func NewHandler(orderService *service.OrderService, reviewService *service.ReviewService) *Handler {
	return &Handler{
		orderService:  orderService,
		reviewService: reviewService,
	}
}

func (h *Handler) CreateOrderReview(c *gin.Context) {
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

	var req struct {
		TargetUserID int64  `json:"target_user_id" binding:"required"`
		TargetRole   string `json:"target_role" binding:"required"`
		Rating       int    `json:"rating" binding:"required"`
		Content      string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid review payload")
		return
	}
	if req.Rating < 1 || req.Rating > 5 {
		response.V2ValidationError(c, "rating must be between 1 and 5")
		return
	}
	if req.TargetUserID == userID {
		response.V2ValidationError(c, "cannot review yourself")
		return
	}
	if !isAllowedReviewTarget(order, req.TargetUserID, req.TargetRole) {
		response.V2ValidationError(c, "target user is not a participant of this order")
		return
	}

	review := &model.Review{
		OrderID:    order.ID,
		ReviewerID: userID,
		RevieweeID: req.TargetUserID,
		ReviewType: deriveReviewType(order, userID, req.TargetRole),
		TargetType: "user",
		TargetID:   req.TargetUserID,
		Rating:     req.Rating,
		Content:    req.Content,
	}
	if err := h.reviewService.CreateReview(review); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildReviewSummary(review, req.TargetRole))
}

func (h *Handler) ListOrderReviews(c *gin.Context) {
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
	if _, err := h.orderService.GetAuthorizedOrder(orderID, userID, ""); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	reviews, err := h.reviewService.GetByOrder(orderID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	items := make([]gin.H, 0, len(reviews))
	for i := range reviews {
		items = append(items, buildReviewSummary(&reviews[i], inferTargetRole(&reviews[i])))
	}
	response.V2Success(c, gin.H{"items": items})
}

func (h *Handler) ListMine(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}
	page, pageSize := middleware.GetPagination(c)

	reviews, total, err := h.reviewService.ListByReviewer(userID, page, pageSize)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	items := make([]gin.H, 0, len(reviews))
	for i := range reviews {
		items = append(items, buildReviewSummary(&reviews[i], inferTargetRole(&reviews[i])))
	}
	response.V2SuccessList(c, items, total)
}

func buildReviewSummary(review *model.Review, targetRole string) gin.H {
	if review == nil {
		return nil
	}
	return gin.H{
		"id":               review.ID,
		"order_id":         review.OrderID,
		"reviewer_user_id": review.ReviewerID,
		"target_user_id":   review.TargetID,
		"target_role":      targetRole,
		"rating":           review.Rating,
		"content":          review.Content,
		"created_at":       review.CreatedAt,
		"updated_at":       review.UpdatedAt,
	}
}

func deriveReviewType(order *model.Order, reviewerID int64, targetRole string) string {
	sourceRole := resolveParticipantRole(order, reviewerID)
	if sourceRole != "" && targetRole != "" {
		return sourceRole + "_to_" + targetRole
	}
	return "user_to_user"
}

func inferTargetRole(review *model.Review) string {
	switch review.ReviewType {
	case "renter_to_owner":
		return "owner"
	case "owner_to_renter":
		return "client"
	case "renter_to_drone":
		return "drone"
	default:
		if parts := strings.Split(review.ReviewType, "_to_"); len(parts) == 2 && parts[1] != "" {
			return parts[1]
		}
		return "user"
	}
}

func isAllowedReviewTarget(order *model.Order, targetUserID int64, targetRole string) bool {
	if order == nil || targetUserID <= 0 {
		return false
	}
	switch targetRole {
	case "client":
		return targetUserID == order.ClientUserID || targetUserID == order.RenterID
	case "owner":
		return targetUserID == order.ProviderUserID || targetUserID == order.OwnerID || targetUserID == order.DroneOwnerUserID
	case "pilot":
		return targetUserID == order.ExecutorPilotUserID
	default:
		return false
	}
}

func resolveParticipantRole(order *model.Order, userID int64) string {
	if order == nil || userID <= 0 {
		return ""
	}
	if userID == order.ClientUserID || userID == order.RenterID {
		return "client"
	}
	if userID == order.ProviderUserID || userID == order.OwnerID || userID == order.DroneOwnerUserID {
		return "owner"
	}
	if userID == order.ExecutorPilotUserID {
		return "pilot"
	}
	if order.Pilot != nil && order.Pilot.UserID == userID {
		return "pilot"
	}
	return ""
}
