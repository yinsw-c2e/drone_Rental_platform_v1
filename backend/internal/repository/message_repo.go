package repository

import (
	"wurenji-backend/internal/model"

	"gorm.io/gorm"
)

type MessageRepo struct {
	db *gorm.DB
}

func NewMessageRepo(db *gorm.DB) *MessageRepo {
	return &MessageRepo{db: db}
}

func (r *MessageRepo) Create(msg *model.Message) error {
	return r.db.Create(msg).Error
}

func (r *MessageRepo) GetConversationMessages(conversationID string, page, pageSize int) ([]model.Message, int64, error) {
	var messages []model.Message
	var total int64

	query := r.db.Model(&model.Message{}).Where("conversation_id = ?", conversationID)
	query.Count(&total)
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&messages).Error
	return messages, total, err
}

func (r *MessageRepo) GetConversations(userID int64) ([]ConversationSummary, error) {
	var results []ConversationSummary
	// MySQL 5.7 compatible query
	// Get latest message for each peer by using a temporary table approach
	err := r.db.Raw(`
		SELECT 
			m.conversation_id,
			m.content AS last_message,
			m.created_at AS last_time,
			m.message_type AS last_type,
			CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END AS peer_id,
			(SELECT COUNT(*) FROM messages 
			 WHERE receiver_id = ? AND sender_id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END 
			 AND is_read = 0) AS unread_count
		FROM messages m
		INNER JOIN (
			SELECT 
				MAX(id) as max_id
			FROM messages
			WHERE sender_id = ? OR receiver_id = ?
			GROUP BY CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END
		) latest ON m.id = latest.max_id
		ORDER BY m.created_at DESC
	`, userID, userID, userID, userID, userID, userID).Scan(&results).Error
	return results, err
}

type ConversationSummary struct {
	ConversationID string `json:"conversation_id"`
	LastMessage    string `json:"last_message"`
	LastTime       string `json:"last_time"`
	LastType       string `json:"last_type"`
	PeerID         int64  `json:"peer_id"`
	UnreadCount    int    `json:"unread_count"`
}

func (r *MessageRepo) MarkAsRead(conversationID string, userID int64) error {
	return r.db.Model(&model.Message{}).
		Where("conversation_id = ? AND receiver_id = ? AND is_read = 0", conversationID, userID).
		Updates(map[string]interface{}{"is_read": true, "read_at": gorm.Expr("NOW()")}).Error
}

func (r *MessageRepo) GetUnreadCount(userID int64) (int64, error) {
	var count int64
	err := r.db.Model(&model.Message{}).Where("receiver_id = ? AND is_read = 0", userID).Count(&count).Error
	return count, err
}

// GetMessagesByPeer retrieves all messages between two users, regardless of conversation_id format
func (r *MessageRepo) GetMessagesByPeer(userID, peerID int64, page, pageSize int) ([]model.Message, int64, error) {
	var messages []model.Message
	var total int64

	query := r.db.Model(&model.Message{}).Where(
		"(sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)",
		userID, peerID, peerID, userID,
	)
	query.Count(&total)
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&messages).Error
	return messages, total, err
}

// MarkAsReadByPeer marks all messages from a peer as read
func (r *MessageRepo) MarkAsReadByPeer(userID, peerID int64) error {
	return r.db.Model(&model.Message{}).
		Where("receiver_id = ? AND sender_id = ? AND is_read = 0", userID, peerID).
		Updates(map[string]interface{}{"is_read": true, "read_at": gorm.Expr("NOW()")}).Error
}
