package push

import (
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	"wurenji-backend/internal/pkg/push"
	"wurenji-backend/internal/pkg/response"
)

type Handler struct {
	pushService push.PushService
	serverMode  string
}

func NewHandler(pushService push.PushService, serverMode string) *Handler {
	return &Handler{
		pushService: pushService,
		serverMode:  serverMode,
	}
}

type testPushRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

type registerDeviceRequest struct {
	RegistrationID string `json:"registration_id"`
	Platform       string `json:"platform"`
}

func (h *Handler) SendTest(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	if h.serverMode == "release" {
		response.V2Forbidden(c, "push test endpoint is disabled in release mode")
		return
	}

	var req testPushRequest
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			response.V2ValidationError(c, "invalid request body")
			return
		}
	}

	provider, enabled := h.providerStatus()
	if !enabled {
		response.V2Conflict(c, "real push is not enabled in current environment")
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = "Android 推送测试"
	}

	content := strings.TrimSpace(req.Content)
	if content == "" {
		content = "这是一条来自 /api/v2/push/test 的测试推送，用于验证 Android 真推送链路。"
	}

	alias := fmt.Sprintf("user_%d", userID)
	extras := map[string]string{
		"type":       "push_test",
		"event_type": "push_test",
		"user_id":    fmt.Sprintf("%d", userID),
		"alias":      alias,
	}

	if err := h.pushService.PushToUser(userID, title, content, extras); err != nil {
		response.V2InternalError(c, err.Error())
		return
	}

	response.V2Success(c, gin.H{
		"sent":     true,
		"provider": provider,
		"user_id":  userID,
		"alias":    alias,
		"title":    title,
		"content":  content,
	})
}

func (h *Handler) RegisterDevice(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	var req registerDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid request body")
		return
	}

	registrationID := strings.TrimSpace(req.RegistrationID)
	if registrationID == "" {
		response.V2ValidationError(c, "registration_id is required")
		return
	}

	platform := strings.TrimSpace(req.Platform)
	if platform == "" {
		platform = "android"
	}

	provider, enabled := h.providerStatus()
	if !enabled {
		response.V2Conflict(c, "real push is not enabled in current environment")
		return
	}

	if err := h.pushService.RegisterDevice(userID, registrationID, platform); err != nil {
		response.V2InternalError(c, err.Error())
		return
	}

	alias := fmt.Sprintf("user_%d", userID)
	response.V2Success(c, gin.H{
		"bound":           true,
		"provider":        provider,
		"user_id":         userID,
		"registration_id": registrationID,
		"platform":        platform,
		"alias":           alias,
	})
}

func (h *Handler) providerStatus() (string, bool) {
	switch svc := h.pushService.(type) {
	case *push.JPushService:
		return "jpush", svc.IsEnabled()
	case *push.MockPushService:
		return "mock", false
	case nil:
		return "none", false
	default:
		return "custom", true
	}
}
