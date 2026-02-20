package service

import (
	"errors"
	"fmt"

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

func (s *MessageService) GetMessages(conversationID string, page, pageSize int) ([]model.Message, int64, error) {
	return s.messageRepo.GetConversationMessages(conversationID, page, pageSize)
}

func (s *MessageService) MarkAsRead(conversationID string, userID int64) error {
	return s.messageRepo.MarkAsRead(conversationID, userID)
}

func (s *MessageService) GetUnreadCount(userID int64) (int64, error) {
	return s.messageRepo.GetUnreadCount(userID)
}

func makeConversationID(userA, userB int64) string {
	if userA < userB {
		return fmt.Sprintf("%d-%d", userA, userB)
	}
	return fmt.Sprintf("%d-%d", userB, userA)
}
