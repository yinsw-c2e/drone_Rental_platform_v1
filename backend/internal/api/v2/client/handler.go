package client

import (
	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	v2common "wurenji-backend/internal/api/v2/common"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	clientService *service.ClientService
}

func NewHandler(clientService *service.ClientService) *Handler {
	return &Handler{clientService: clientService}
}

func (h *Handler) GetProfile(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	profile, err := h.clientService.GetCurrentProfile(userID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	response.V2Success(c, profile)
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	var req service.ClientProfileUpdateInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid client profile payload")
		return
	}

	profile, err := h.clientService.UpdateCurrentProfile(userID, &req)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	response.V2Success(c, profile)
}
