package home

import (
	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	v2common "wurenji-backend/internal/api/v2/common"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	homeService *service.HomeService
}

func NewHandler(homeService *service.HomeService) *Handler {
	return &Handler{homeService: homeService}
}

func (h *Handler) GetDashboard(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	dashboard, err := h.homeService.GetDashboard(userID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	response.V2Success(c, dashboard)
}
