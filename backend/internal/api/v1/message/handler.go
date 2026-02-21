package message

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
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

type SendMessageReq struct {
	ReceiverID  int64      `json:"receiver_id" binding:"required"`
	MessageType string     `json:"message_type"`
	Content     string     `json:"content" binding:"required"`
	ExtraData   model.JSON `json:"extra_data"`
}

func (h *Handler) Send(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req SendMessageReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if req.MessageType == "" {
		req.MessageType = "text"
	}
	msg, err := h.messageService.SendMessage(userID, req.ReceiverID, req.MessageType, req.Content, req.ExtraData)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, msg)
}

func (h *Handler) GetConversations(c *gin.Context) {
	userID := middleware.GetUserID(c)
	conversations, err := h.messageService.GetConversations(userID)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, conversations)
}

func (h *Handler) GetMessages(c *gin.Context) {
	conversationID := c.Param("conversationId")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	messages, total, err := h.messageService.GetMessages(conversationID, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, messages, total, page, pageSize)
}

func (h *Handler) MarkRead(c *gin.Context) {
	userID := middleware.GetUserID(c)
	conversationID := c.Param("conversationId")
	if err := h.messageService.MarkAsRead(conversationID, userID); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) UnreadCount(c *gin.Context) {
	userID := middleware.GetUserID(c)
	count, err := h.messageService.GetUnreadCount(userID)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, gin.H{"count": count})
}

// GetMessagesByPeer retrieves all messages between current user and a peer
func (h *Handler) GetMessagesByPeer(c *gin.Context) {
	userID := middleware.GetUserID(c)
	peerID, err := strconv.ParseInt(c.Param("peerId"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的用户ID")
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	messages, total, err := h.messageService.GetMessagesByPeer(userID, peerID, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, messages, total, page, pageSize)
}

// MarkReadByPeer marks all messages from a peer as read
func (h *Handler) MarkReadByPeer(c *gin.Context) {
	userID := middleware.GetUserID(c)
	peerID, err := strconv.ParseInt(c.Param("peerId"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的用户ID")
		return
	}
	if err := h.messageService.MarkAsReadByPeer(userID, peerID); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}
