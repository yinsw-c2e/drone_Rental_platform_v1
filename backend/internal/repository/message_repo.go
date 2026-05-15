package repository

import (
	"time"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/limits"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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
	page, pageSize = limits.NormalizePagination(page, pageSize)

	query := r.db.Model(&model.Message{}).Where("conversation_id = ?", conversationID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&messages).Error
	return messages, total, err
}

func (r *MessageRepo) HasConversationAccess(conversationID string, userID int64) (bool, error) {
	var count int64
	err := r.db.Model(&model.Message{}).
		Where("conversation_id = ? AND (sender_id = ? OR receiver_id = ?)", conversationID, userID, userID).
		Count(&count).Error
	return count > 0, err
}

func (r *MessageRepo) GetConversations(userID int64) ([]ConversationSummary, error) {
	var results []ConversationSummary
	// MySQL 5.7 compatible query
	// Get latest message for each peer by using a temporary table approach
	err := r.db.Raw(`
		SELECT 
			m.id AS last_message_id,
			m.conversation_id,
			m.content AS last_message,
			m.created_at AS last_time,
				m.message_type AS last_type,
				CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END AS peer_id,
				COALESCE(u.nickname, CONCAT('用户 ', CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END)) AS peer_name,
				COALESCE(u.avatar_url, '') AS peer_avatar_url,
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
			LEFT JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
			ORDER BY m.created_at DESC
		`, userID, userID, userID, userID, userID, userID, userID, userID).Scan(&results).Error
	if err != nil || len(results) == 0 {
		return results, err
	}

	if !r.db.Migrator().HasTable(&model.ConversationUserState{}) {
		return results, nil
	}

	var states []model.ConversationUserState
	if err := r.db.Where("user_id = ? AND hidden_at IS NOT NULL", userID).Find(&states).Error; err != nil {
		return results, nil
	}
	stateByPeer := make(map[int64]model.ConversationUserState, len(states))
	for _, state := range states {
		stateByPeer[state.PeerID] = state
	}

	visible := make([]ConversationSummary, 0, len(results))
	for _, result := range results {
		if state, ok := stateByPeer[result.PeerID]; ok && result.LastMessageID <= state.HiddenBeforeMessageID {
			continue
		}
		visible = append(visible, result)
	}
	return visible, nil
}

type ConversationSummary struct {
	LastMessageID  int64  `json:"-"`
	ConversationID string `json:"conversation_id"`
	LastMessage    string `json:"last_message"`
	LastTime       string `json:"last_time"`
	LastType       string `json:"last_type"`
	PeerID         int64  `json:"peer_id"`
	PeerName       string `json:"peer_name"`
	PeerAvatarURL  string `json:"peer_avatar_url"`
	UnreadCount    int    `json:"unread_count"`
}

func (r *MessageRepo) MarkAsRead(conversationID string, userID int64) error {
	now := time.Now()
	return r.db.Transaction(func(tx *gorm.DB) error {
		var latest model.Message
		if err := tx.
			Where("conversation_id = ? AND (sender_id = ? OR receiver_id = ?)", conversationID, userID, userID).
			Order("id DESC").
			First(&latest).Error; err != nil {
			return err
		}

		peerID := latest.SenderID
		if peerID == userID {
			peerID = latest.ReceiverID
		}
		if peerID <= 0 {
			return gorm.ErrRecordNotFound
		}

		return tx.Model(&model.Message{}).
			Where("receiver_id = ? AND sender_id = ? AND is_read = 0", userID, peerID).
			Updates(map[string]interface{}{"is_read": true, "read_at": now}).Error
	})
}

func (r *MessageRepo) HideConversation(conversationID string, userID int64) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var latest model.Message
		if err := tx.
			Where("conversation_id = ? AND (sender_id = ? OR receiver_id = ?)", conversationID, userID, userID).
			Order("id DESC").
			First(&latest).Error; err != nil {
			return err
		}

		peerID := latest.SenderID
		if peerID == userID {
			peerID = latest.ReceiverID
		}
		if peerID <= 0 {
			return gorm.ErrRecordNotFound
		}

		now := time.Now()
		if err := tx.Model(&model.Message{}).
			Where("conversation_id = ? AND receiver_id = ? AND is_read = 0", conversationID, userID).
			Updates(map[string]interface{}{"is_read": true, "read_at": now}).Error; err != nil {
			return err
		}

		state := model.ConversationUserState{
			UserID:                userID,
			PeerID:                peerID,
			ConversationID:        conversationID,
			HiddenAt:              &now,
			HiddenBeforeMessageID: latest.ID,
		}
		return tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "user_id"}, {Name: "peer_id"}},
			DoUpdates: clause.Assignments(map[string]interface{}{
				"conversation_id":          conversationID,
				"hidden_at":                now,
				"hidden_before_message_id": latest.ID,
				"updated_at":               now,
			}),
		}).Create(&state).Error
	})
}

func (r *MessageRepo) GetUnreadCount(userID int64) (int64, error) {
	var count int64
	err := r.db.Model(&model.Message{}).Where("receiver_id = ? AND is_read = 0", userID).Count(&count).Error
	return count, err
}

func (r *MessageRepo) GetUnreadNotificationCount(userID int64) (int64, error) {
	var count int64
	err := r.db.Model(&model.Message{}).
		Where("receiver_id = ? AND sender_id = ? AND is_read = 0", userID, 0).
		Count(&count).Error
	return count, err
}

func (r *MessageRepo) ListSystemNotifications(userID int64, page, pageSize int) ([]model.Message, int64, error) {
	var messages []model.Message
	var total int64
	page, pageSize = limits.NormalizePagination(page, pageSize)

	query := r.db.Model(&model.Message{}).
		Where("receiver_id = ? AND sender_id = ?", userID, 0)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.
		Order("created_at DESC, id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&messages).Error
	return messages, total, err
}

func (r *MessageRepo) GetNotificationByID(id int64) (*model.Message, error) {
	var message model.Message
	err := r.db.Where("id = ? AND sender_id = ?", id, 0).First(&message).Error
	if err != nil {
		return nil, err
	}
	return &message, nil
}

func (r *MessageRepo) MarkNotificationRead(id, userID int64) error {
	now := time.Now()
	return r.db.Model(&model.Message{}).
		Where("id = ? AND receiver_id = ? AND sender_id = ?", id, userID, 0).
		Updates(map[string]interface{}{"is_read": true, "read_at": now}).Error
}

// GetMessagesByPeer retrieves all messages between two users, regardless of conversation_id format
func (r *MessageRepo) GetMessagesByPeer(userID, peerID int64, page, pageSize int) ([]model.Message, int64, error) {
	var messages []model.Message
	var total int64
	page, pageSize = limits.NormalizePagination(page, pageSize)

	query := r.db.Model(&model.Message{}).Where(
		"(sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)",
		userID, peerID, peerID, userID,
	)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&messages).Error
	return messages, total, err
}

// MarkAsReadByPeer marks all messages from a peer as read
func (r *MessageRepo) MarkAsReadByPeer(userID, peerID int64) error {
	now := time.Now()
	return r.db.Model(&model.Message{}).
		Where("receiver_id = ? AND sender_id = ? AND is_read = 0", userID, peerID).
		Updates(map[string]interface{}{"is_read": true, "read_at": now}).Error
}
