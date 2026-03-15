package notification

import (
	"encoding/json"
	"strconv"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	v2common "wurenji-backend/internal/api/v2/common"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	messageService *service.MessageService
}

func NewHandler(messageService *service.MessageService) *Handler {
	return &Handler{messageService: messageService}
}

func (h *Handler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}
	page, pageSize := middleware.GetPagination(c)

	notifications, total, err := h.messageService.ListNotifications(userID, page, pageSize)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	unreadCount, err := h.messageService.GetUnreadNotificationCount(userID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	items := make([]gin.H, 0, len(notifications))
	for i := range notifications {
		items = append(items, buildNotificationSummary(&notifications[i]))
	}
	response.V2SuccessWithMeta(c, gin.H{"items": items}, gin.H{
		"page":         page,
		"page_size":    pageSize,
		"total":        total,
		"unread_count": unreadCount,
	})
}

func (h *Handler) MarkRead(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	notificationID, err := strconv.ParseInt(c.Param("notification_id"), 10, 64)
	if err != nil || notificationID <= 0 {
		response.V2ValidationError(c, "invalid notification_id")
		return
	}

	if err := h.messageService.MarkNotificationRead(notificationID, userID); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, gin.H{"notification_id": notificationID, "is_read": true})
}

func buildNotificationSummary(message *model.Message) gin.H {
	if message == nil {
		return nil
	}
	extras := make(map[string]interface{})
	if len(message.ExtraData) > 0 {
		_ = json.Unmarshal(message.ExtraData, &extras)
	}
	return gin.H{
		"id":              message.ID,
		"conversation_id": message.ConversationID,
		"message_type":    message.MessageType,
		"content":         message.Content,
		"extra_data":      extras,
		"is_read":         message.IsRead,
		"read_at":         message.ReadAt,
		"created_at":      message.CreatedAt,
	}
}
