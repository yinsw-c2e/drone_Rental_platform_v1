package websocket

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

type Hub struct {
	clients    map[int64]*Client
	broadcast  chan *WSMessage
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
	logger     *zap.Logger
}

type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	userID int64
	send   chan []byte
}

type WSMessage struct {
	Type      string      `json:"type"` // chat, order_update, system, matching
	Data      interface{} `json:"data"`
	Timestamp int64       `json:"timestamp"`
	TargetID  int64       `json:"-"` // target user ID, 0 for broadcast
}

func NewHub(logger *zap.Logger) *Hub {
	return &Hub{
		clients:    make(map[int64]*Client),
		broadcast:  make(chan *WSMessage, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		logger:     logger,
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			// Close existing connection for same user
			if existing, ok := h.clients[client.userID]; ok {
				close(existing.send)
				existing.conn.Close()
			}
			h.clients[client.userID] = client
			h.mu.Unlock()
			h.logger.Info("client connected", zap.Int64("user_id", client.userID))

		case client := <-h.unregister:
			h.mu.Lock()
			if existing, ok := h.clients[client.userID]; ok && existing == client {
				delete(h.clients, client.userID)
				close(client.send)
			}
			h.mu.Unlock()
			h.logger.Info("client disconnected", zap.Int64("user_id", client.userID))

		case msg := <-h.broadcast:
			data, _ := json.Marshal(msg)
			if msg.TargetID > 0 {
				// Send to specific user
				h.mu.RLock()
				if client, ok := h.clients[msg.TargetID]; ok {
					select {
					case client.send <- data:
					default:
						close(client.send)
						delete(h.clients, msg.TargetID)
					}
				}
				h.mu.RUnlock()
			} else {
				// Broadcast to all
				h.mu.RLock()
				for _, client := range h.clients {
					select {
					case client.send <- data:
					default:
						close(client.send)
						delete(h.clients, client.userID)
					}
				}
				h.mu.RUnlock()
			}
		}
	}
}

// SendToUser sends a message to a specific user
func (h *Hub) SendToUser(userID int64, msgType string, data interface{}) {
	h.broadcast <- &WSMessage{
		Type:      msgType,
		Data:      data,
		Timestamp: time.Now().Unix(),
		TargetID:  userID,
	}
}

// Broadcast sends a message to all connected users
func (h *Hub) Broadcast(msgType string, data interface{}) {
	h.broadcast <- &WSMessage{
		Type:      msgType,
		Data:      data,
		Timestamp: time.Now().Unix(),
	}
}

// IsOnline checks if a user is connected
func (h *Hub) IsOnline(userID int64) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	_, ok := h.clients[userID]
	return ok
}

// OnlineCount returns the number of connected clients
func (h *Hub) OnlineCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}
