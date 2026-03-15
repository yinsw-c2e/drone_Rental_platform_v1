package me

import (
	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	userService *service.UserService
}

func NewHandler(userService *service.UserService) *Handler {
	return &Handler{userService: userService}
}

func (h *Handler) Get(c *gin.Context) {
	userID := middleware.GetUserID(c)
	me, err := h.userService.GetMe(userID)
	if err != nil {
		response.V2NotFound(c, "user not found")
		return
	}
	response.V2Success(c, me)
}
