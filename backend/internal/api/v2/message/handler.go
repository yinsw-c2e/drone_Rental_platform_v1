package message

import (
	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	v2common "wurenji-backend/internal/api/v2/common"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/repository"
	"wurenji-backend/internal/service"
)

type Handler struct {
	messageService *service.MessageService
}

func NewHandler(messageService *service.MessageService) *Handler {
	return &Handler{messageService: messageService}
}

func (h *Handler) ListConversations(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	page, pageSize := middleware.GetPagination(c)
	conversations, total, err := h.messageService.ListConversations(userID, page, pageSize)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	items := make([]gin.H, 0, len(conversations))
	for i := range conversations {
		items = append(items, buildConversationSummary(&conversations[i]))
	}
	response.V2SuccessList(c, items, total)
}

func (h *Handler) ListMessages(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	conversationID := c.Param("conversation_id")
	if conversationID == "" {
		response.V2ValidationError(c, "invalid conversation_id")
		return
	}

	page, pageSize := middleware.GetPagination(c)
	messages, total, err := h.messageService.GetMessagesForUser(userID, conversationID, page, pageSize)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	items := make([]gin.H, 0, len(messages))
	for i := range messages {
		items = append(items, buildMessageSummary(&messages[i]))
	}
	response.V2SuccessList(c, items, total)
}

func buildConversationSummary(conversation *repository.ConversationSummary) gin.H {
	if conversation == nil {
		return gin.H{}
	}
	return gin.H{
		"conversation_id": conversation.ConversationID,
		"last_message":    conversation.LastMessage,
		"last_time":       conversation.LastTime,
		"last_type":       conversation.LastType,
		"peer_id":         conversation.PeerID,
		"unread_count":    conversation.UnreadCount,
	}
}

func buildMessageSummary(message *model.Message) gin.H {
	if message == nil {
		return gin.H{}
	}
	return gin.H{
		"id":              message.ID,
		"conversation_id": message.ConversationID,
		"sender_id":       message.SenderID,
		"receiver_id":     message.ReceiverID,
		"message_type":    message.MessageType,
		"content":         message.Content,
		"extra_data":      message.ExtraData,
		"is_read":         message.IsRead,
		"read_at":         message.ReadAt,
		"created_at":      message.CreatedAt,
	}
}
