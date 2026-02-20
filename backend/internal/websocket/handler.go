package websocket

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"wurenji-backend/internal/config"
	jwtpkg "wurenji-backend/internal/pkg/jwt"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
}

func HandleWebSocket(hub *Hub, cfg *config.Config, logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Authenticate via query parameter
		token := c.Query("token")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
			return
		}

		claims, err := jwtpkg.ParseToken(token, cfg.JWT.Secret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			logger.Error("websocket upgrade failed", zap.Error(err))
			return
		}

		client := &Client{
			hub:    hub,
			conn:   conn,
			userID: claims.UserID,
			send:   make(chan []byte, 256),
		}

		hub.register <- client

		go client.WritePump()
		go client.ReadPump()

		logger.Info("websocket connected",
			zap.Int64("user_id", claims.UserID),
			zap.String("remote_addr", c.Request.RemoteAddr),
		)

		_ = strconv.FormatInt(claims.UserID, 10)
	}
}
