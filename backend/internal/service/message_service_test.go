package service

import (
	"strings"
	"testing"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

func TestListConversationsFiltersSystemConversation(t *testing.T) {
	db := newServiceTestDB(t, &model.Message{})
	service := NewMessageService(repository.NewMessageRepo(db))

	if _, err := service.SendConversationSystemMessage(1, 2, "订单更新", "订单已进入待支付", map[string]interface{}{"order_id": 9}); err != nil {
		t.Fatalf("send conversation system message: %v", err)
	}
	if _, err := service.SendMessage(3, 1, "text", "你好，我可以接单", nil); err != nil {
		t.Fatalf("send peer message: %v", err)
	}
	if _, err := service.SendSystemNotification(1, "system", "系统提醒", "这里是一条系统通知", nil); err != nil {
		t.Fatalf("send system notification: %v", err)
	}

	conversations, total, err := service.ListConversations(1, 1, 20)
	if err != nil {
		t.Fatalf("list conversations: %v", err)
	}
	if total != 2 {
		t.Fatalf("expected only peer conversations to remain, got total=%d", total)
	}
	for _, conversation := range conversations {
		if conversation.PeerID <= 0 {
			t.Fatalf("expected filtered conversation to have peer id, got %#v", conversation)
		}
		if IsSystemConversationID(conversation.ConversationID) {
			t.Fatalf("expected system conversation to be filtered out, got %#v", conversation)
		}
	}
}

func TestSendConversationSystemMessageStoresSystemGeneratedFlag(t *testing.T) {
	db := newServiceTestDB(t, &model.Message{})
	service := NewMessageService(repository.NewMessageRepo(db))

	msg, err := service.SendConversationSystemMessage(5, 8, "支付成功", "订单已支付", map[string]interface{}{"order_id": 12})
	if err != nil {
		t.Fatalf("send conversation system message: %v", err)
	}

	var stored model.Message
	if err := db.First(&stored, msg.ID).Error; err != nil {
		t.Fatalf("reload stored message: %v", err)
	}
	if !strings.Contains(string(stored.ExtraData), "\"system_generated\":true") {
		t.Fatalf("expected extra data to contain system_generated flag, got %s", string(stored.ExtraData))
	}

	if _, _, err := service.GetMessagesForUser(99, makeConversationID(5, 8), 1, 20); err == nil {
		t.Fatal("expected unauthorized user to be denied conversation access")
	}
}
