package base

import (
	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/pkg/response"
)

type Handler struct{}

func NewHandler() *Handler {
	return &Handler{}
}

func (h *Handler) Status(c *gin.Context) {
	response.V2Success(c, gin.H{
		"version": "v2",
		"status":  "ready",
	})
}

func (h *Handler) NotImplemented(c *gin.Context) {
	response.V2NotImplemented(c, "v2 endpoint skeleton is ready but the business handler is not implemented yet")
}
