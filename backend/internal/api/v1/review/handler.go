package review

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	reviewService *service.ReviewService
}

func NewHandler(reviewService *service.ReviewService) *Handler {
	return &Handler{reviewService: reviewService}
}

func (h *Handler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var review model.Review
	if err := c.ShouldBindJSON(&review); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	review.ReviewerID = userID
	if err := h.reviewService.CreateReview(&review); err != nil {
		response.Error(c, response.CodeParamError, err.Error())
		return
	}
	response.Success(c, review)
}

func (h *Handler) GetByOrder(c *gin.Context) {
	orderID, _ := strconv.ParseInt(c.Param("orderId"), 10, 64)
	reviews, err := h.reviewService.GetByOrder(orderID)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, reviews)
}

func (h *Handler) GetByUser(c *gin.Context) {
	userID, _ := strconv.ParseInt(c.Param("userId"), 10, 64)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	reviews, total, err := h.reviewService.ListByTarget("user", userID, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, reviews, total, page, pageSize)
}

func (h *Handler) GetByDrone(c *gin.Context) {
	droneID, _ := strconv.ParseInt(c.Param("droneId"), 10, 64)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	reviews, total, err := h.reviewService.ListByTarget("drone", droneID, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, reviews, total, page, pageSize)
}
