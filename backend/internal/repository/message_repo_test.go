package repository

import (
	"testing"
	"time"

	"wurenji-backend/internal/model"
)

func TestHideConversationHidesOnlyCurrentUserUntilNewMessage(t *testing.T) {
	db := newRepositoryTestDB(t, &model.User{}, &model.Message{}, &model.ConversationUserState{})
	repo := NewMessageRepo(db)
	baseTime := time.Now().Add(-time.Hour).Round(time.Second)

	first := model.Message{
		ConversationID: "conv-1-2",
		SenderID:       2,
		ReceiverID:     1,
		MessageType:    "text",
		Content:        "旧消息",
		IsRead:         false,
		CreatedAt:      baseTime,
	}
	if err := repo.Create(&first); err != nil {
		t.Fatalf("create first message: %v", err)
	}

	beforeHide, err := repo.GetConversations(1)
	if err != nil {
		t.Fatalf("get conversations before hide: %v", err)
	}
	if len(beforeHide) != 1 || beforeHide[0].UnreadCount != 1 {
		t.Fatalf("expected one unread conversation before hide, got %#v", beforeHide)
	}

	if err := repo.HideConversation("conv-1-2", 1); err != nil {
		t.Fatalf("hide conversation: %v", err)
	}

	afterHide, err := repo.GetConversations(1)
	if err != nil {
		t.Fatalf("get conversations after hide: %v", err)
	}
	if len(afterHide) != 0 {
		t.Fatalf("expected current user conversation hidden, got %#v", afterHide)
	}

	peerView, err := repo.GetConversations(2)
	if err != nil {
		t.Fatalf("get peer conversations: %v", err)
	}
	if len(peerView) != 1 {
		t.Fatalf("expected peer conversation to remain visible, got %#v", peerView)
	}

	unread, err := repo.GetUnreadCount(1)
	if err != nil {
		t.Fatalf("get unread count: %v", err)
	}
	if unread != 0 {
		t.Fatalf("expected hide to mark unread messages read, got %d", unread)
	}

	second := model.Message{
		ConversationID: "conv-1-2",
		SenderID:       2,
		ReceiverID:     1,
		MessageType:    "text",
		Content:        "新消息",
		IsRead:         false,
		CreatedAt:      baseTime.Add(time.Minute),
	}
	if err := repo.Create(&second); err != nil {
		t.Fatalf("create second message: %v", err)
	}

	afterNewMessage, err := repo.GetConversations(1)
	if err != nil {
		t.Fatalf("get conversations after new message: %v", err)
	}
	if len(afterNewMessage) != 1 {
		t.Fatalf("expected new message to reveal conversation, got %#v", afterNewMessage)
	}
	if afterNewMessage[0].LastMessage != "新消息" || afterNewMessage[0].UnreadCount != 1 {
		t.Fatalf("unexpected revealed conversation summary: %#v", afterNewMessage[0])
	}
}

func TestGetConversationsWorksWhenHideStateTableMissing(t *testing.T) {
	db := newRepositoryTestDB(t, &model.User{}, &model.Message{})
	repo := NewMessageRepo(db)

	if err := repo.Create(&model.Message{
		ConversationID: "conv-1-2",
		SenderID:       2,
		ReceiverID:     1,
		MessageType:    "text",
		Content:        "还没有隐藏表时也应正常显示",
		CreatedAt:      time.Now().Round(time.Second),
	}); err != nil {
		t.Fatalf("create message: %v", err)
	}

	conversations, err := repo.GetConversations(1)
	if err != nil {
		t.Fatalf("get conversations: %v", err)
	}
	if len(conversations) != 1 {
		t.Fatalf("expected one conversation without hide state table, got %#v", conversations)
	}
}

func TestMarkAsReadClearsUnreadAcrossPeerGroupedConversations(t *testing.T) {
	db := newRepositoryTestDB(t, &model.User{}, &model.Message{}, &model.ConversationUserState{})
	repo := NewMessageRepo(db)
	baseTime := time.Now().Add(-time.Hour).Round(time.Second)

	messages := []model.Message{
		{
			ConversationID: "order-1-16",
			SenderID:       16,
			ReceiverID:     1,
			MessageType:    "text",
			Content:        "订单消息",
			IsRead:         false,
			CreatedAt:      baseTime,
		},
		{
			ConversationID: "chat-1-16",
			SenderID:       16,
			ReceiverID:     1,
			MessageType:    "text",
			Content:        "普通会话",
			IsRead:         false,
			CreatedAt:      baseTime.Add(time.Minute),
		},
	}
	for i := range messages {
		if err := repo.Create(&messages[i]); err != nil {
			t.Fatalf("create message %d: %v", i, err)
		}
	}

	before, err := repo.GetConversations(1)
	if err != nil {
		t.Fatalf("get conversations before mark read: %v", err)
	}
	if len(before) != 1 || before[0].UnreadCount != 2 {
		t.Fatalf("expected grouped unread count 2, got %#v", before)
	}

	if err := repo.MarkAsRead("chat-1-16", 1); err != nil {
		t.Fatalf("mark read: %v", err)
	}

	after, err := repo.GetConversations(1)
	if err != nil {
		t.Fatalf("get conversations after mark read: %v", err)
	}
	if len(after) != 1 || after[0].UnreadCount != 0 {
		t.Fatalf("expected all unread from peer cleared, got %#v", after)
	}
}
