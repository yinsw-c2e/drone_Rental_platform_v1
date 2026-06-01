package push

import (
	"context"
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	"wurenji-backend/internal/pkg/push"
	"wurenji-backend/internal/pkg/response"
)

type Handler struct {
	pushService     push.PushService
	serverMode      string
	wechatSubscribe WeChatSubscribeGrantRecorder
}

type WeChatSubscribeGrantRecorder interface {
	GrantAcceptedTemplates(ctx context.Context, userID int64, templateIDs []string) (int, error)
	SendEvent(ctx context.Context, userID int64, eventType string, dataCtx map[string]interface{}) error
}

func NewHandler(pushService push.PushService, serverMode string, wechatSubscribe WeChatSubscribeGrantRecorder) *Handler {
	return &Handler{
		pushService:     pushService,
		serverMode:      serverMode,
		wechatSubscribe: wechatSubscribe,
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

type wechatSubscribeRequest struct {
	AcceptedTemplateIDs []string `json:"accepted_template_ids"`
}

type wechatSubscribeDevTriggerRequest struct {
	EventType string                 `json:"event_type" binding:"required"`
	Extras    map[string]interface{} `json:"extras"`
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

func (h *Handler) GrantWeChatSubscribe(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	var req wechatSubscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid request body")
		return
	}
	if len(req.AcceptedTemplateIDs) > 20 {
		response.V2ValidationError(c, "accepted_template_ids is too large")
		return
	}
	if h.wechatSubscribe == nil {
		response.V2Success(c, gin.H{
			"granted": 0,
			"enabled": false,
		})
		return
	}

	granted, err := h.wechatSubscribe.GrantAcceptedTemplates(c.Request.Context(), userID, req.AcceptedTemplateIDs)
	if err != nil {
		response.V2InternalError(c, err.Error())
		return
	}
	response.V2Success(c, gin.H{
		"granted": granted,
		"enabled": true,
	})
}

// DevTriggerWeChatSubscribe 仅在非 release 模式下可用，按事件类型直接触发一次
// WeChatSubscribeService.SendEvent，用于联调"实际能发出去 / 用户能收到"。
// 当前用户即收件人；事件类型必须在 WeChat 订阅消息白名单内。
func (h *Handler) DevTriggerWeChatSubscribe(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}
	if h.serverMode == "release" {
		response.V2Forbidden(c, "dev trigger is disabled in release mode")
		return
	}
	if h.wechatSubscribe == nil {
		response.V2BadRequest(c, "wechat subscribe service not configured")
		return
	}

	var req wechatSubscribeDevTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "event_type is required")
		return
	}
	if req.Extras == nil {
		req.Extras = map[string]interface{}{}
	}
	req.Extras["event_type"] = req.EventType
	if _, ok := req.Extras["title"]; !ok {
		req.Extras["title"] = "[dev] 订阅消息触发测试"
	}
	if _, ok := req.Extras["content"]; !ok {
		req.Extras["content"] = "由开发者诊断页触发的一次 SendEvent 调用"
	}

	if err := h.wechatSubscribe.SendEvent(c.Request.Context(), userID, req.EventType, req.Extras); err != nil {
		response.V2InternalError(c, err.Error())
		return
	}
	response.V2Success(c, gin.H{
		"triggered":  true,
		"user_id":    userID,
		"event_type": req.EventType,
		"note":       "若 push.provider=mock 看后端日志 [MOCK]；若真模式去微信「服务通知」查收",
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
