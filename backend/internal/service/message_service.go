package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type MessageService struct {
	messageRepo *repository.MessageRepo
}

func NewMessageService(messageRepo *repository.MessageRepo) *MessageService {
	return &MessageService{messageRepo: messageRepo}
}

func (s *MessageService) SendMessage(senderID, receiverID int64, msgType, content string, extraData model.JSON) (*model.Message, error) {
	if senderID == receiverID {
		return nil, errors.New("不能发送消息给自己")
	}

	conversationID := makeConversationID(senderID, receiverID)
	msg := &model.Message{
		ConversationID: conversationID,
		SenderID:       senderID,
		ReceiverID:     receiverID,
		MessageType:    msgType,
		Content:        content,
		ExtraData:      extraData,
	}

	if err := s.messageRepo.Create(msg); err != nil {
		return nil, err
	}
	return msg, nil
}

func (s *MessageService) GetConversations(userID int64) ([]repository.ConversationSummary, error) {
	return s.messageRepo.GetConversations(userID)
}

func (s *MessageService) ListConversations(userID int64, page, pageSize int) ([]repository.ConversationSummary, int64, error) {
	conversations, err := s.messageRepo.GetConversations(userID)
	if err != nil {
		return nil, 0, err
	}

	filtered := make([]repository.ConversationSummary, 0, len(conversations))
	for _, conversation := range conversations {
		if conversation.PeerID <= 0 || IsSystemConversationID(conversation.ConversationID) {
			continue
		}
		filtered = append(filtered, conversation)
	}

	total := int64(len(filtered))
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	start := (page - 1) * pageSize
	if start >= len(filtered) {
		return []repository.ConversationSummary{}, total, nil
	}
	end := start + pageSize
	if end > len(filtered) {
		end = len(filtered)
	}
	return filtered[start:end], total, nil
}

func (s *MessageService) GetMessages(conversationID string, page, pageSize int) ([]model.Message, int64, error) {
	return s.messageRepo.GetConversationMessages(conversationID, page, pageSize)
}

func (s *MessageService) GetMessagesForUser(userID int64, conversationID string, page, pageSize int) ([]model.Message, int64, error) {
	allowed, err := s.messageRepo.HasConversationAccess(conversationID, userID)
	if err != nil {
		return nil, 0, err
	}
	if !allowed {
		return nil, 0, errors.New("无权查看该会话")
	}
	return s.messageRepo.GetConversationMessages(conversationID, page, pageSize)
}

func (s *MessageService) MarkAsRead(conversationID string, userID int64) error {
	return s.messageRepo.MarkAsRead(conversationID, userID)
}

func (s *MessageService) GetUnreadCount(userID int64) (int64, error) {
	return s.messageRepo.GetUnreadCount(userID)
}

func (s *MessageService) GetUnreadNotificationCount(userID int64) (int64, error) {
	return s.messageRepo.GetUnreadNotificationCount(userID)
}

func (s *MessageService) ListNotifications(userID int64, page, pageSize int) ([]model.Message, int64, error) {
	return s.messageRepo.ListSystemNotifications(userID, page, pageSize)
}

func (s *MessageService) MarkNotificationRead(notificationID, userID int64) error {
	notification, err := s.messageRepo.GetNotificationByID(notificationID)
	if err != nil {
		return err
	}
	if notification.ReceiverID != userID {
		return errors.New("无权操作该通知")
	}
	return s.messageRepo.MarkNotificationRead(notificationID, userID)
}

func (s *MessageService) GetMessagesByPeer(userID, peerID int64, page, pageSize int) ([]model.Message, int64, error) {
	return s.messageRepo.GetMessagesByPeer(userID, peerID, page, pageSize)
}

func (s *MessageService) MarkAsReadByPeer(userID, peerID int64) error {
	return s.messageRepo.MarkAsReadByPeer(userID, peerID)
}

func (s *MessageService) SendSystemNotification(receiverID int64, msgType, title, content string, extras map[string]interface{}) (*model.Message, error) {
	if receiverID <= 0 {
		return nil, errors.New("接收用户不能为空")
	}
	if msgType == "" {
		msgType = "system"
	}
	if content == "" {
		return nil, errors.New("通知内容不能为空")
	}

	if extras == nil {
		extras = make(map[string]interface{})
	}
	if title != "" {
		extras["title"] = title
	}

	payload, err := json.Marshal(extras)
	if err != nil {
		return nil, err
	}

	msg := &model.Message{
		ConversationID: makeSystemConversationID(receiverID),
		SenderID:       0,
		ReceiverID:     receiverID,
		MessageType:    msgType,
		Content:        content,
		ExtraData:      model.JSON(payload),
	}

	if err := s.messageRepo.Create(msg); err != nil {
		return nil, err
	}
	return msg, nil
}

func (s *MessageService) SendConversationSystemMessage(senderID, receiverID int64, title, content string, extras map[string]interface{}) (*model.Message, error) {
	if senderID <= 0 || receiverID <= 0 {
		return nil, errors.New("会话双方不能为空")
	}
	if senderID == receiverID {
		return nil, errors.New("系统消息需要关联另一方会话")
	}
	if content == "" {
		return nil, errors.New("消息内容不能为空")
	}

	if extras == nil {
		extras = make(map[string]interface{})
	}
	if title != "" {
		extras["title"] = title
	}
	extras["system_generated"] = true

	payload, err := json.Marshal(extras)
	if err != nil {
		return nil, err
	}

	msg := &model.Message{
		ConversationID: makeConversationID(senderID, receiverID),
		SenderID:       senderID,
		ReceiverID:     receiverID,
		MessageType:    "system",
		Content:        content,
		ExtraData:      model.JSON(payload),
	}
	if err := s.messageRepo.Create(msg); err != nil {
		return nil, err
	}
	return msg, nil
}

func makeConversationID(userA, userB int64) string {
	if userA < userB {
		return fmt.Sprintf("%d-%d", userA, userB)
	}
	return fmt.Sprintf("%d-%d", userB, userA)
}

func makeSystemConversationID(userID int64) string {
	return fmt.Sprintf("system-%d", userID)
}

func IsSystemConversationID(conversationID string) bool {
	return strings.HasPrefix(conversationID, "system-")
}
