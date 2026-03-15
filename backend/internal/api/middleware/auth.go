package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"

	"wurenji-backend/internal/config"
	jwtpkg "wurenji-backend/internal/pkg/jwt"
	"wurenji-backend/internal/pkg/response"
)

// tokenBlacklistChecker 用于检查token黑名单的Redis客户端
var tokenBlacklistRedis *redis.Client

// SetTokenBlacklistRedis 设置用于黑名单检查的Redis客户端
func SetTokenBlacklistRedis(rds *redis.Client) {
	tokenBlacklistRedis = rds
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			unauthorized(c, "missing authorization header")
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			unauthorized(c, "invalid authorization format")
			c.Abort()
			return
		}

		tokenStr := parts[1]

		// 检查token是否在黑名单中
		if tokenBlacklistRedis != nil {
			key := "token:blacklist:" + tokenStr
			if _, err := tokenBlacklistRedis.Get(c.Request.Context(), key).Result(); err == nil {
				unauthorized(c, "token has been revoked")
				c.Abort()
				return
			}
		}

		claims, err := jwtpkg.ParseToken(tokenStr, config.AppConfig.JWT.Secret)
		if err != nil {
			unauthorized(c, "invalid or expired token")
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("user_type", claims.UserType)
		c.Next()
	}
}

func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		userType, exists := c.Get("user_type")
		if !exists || userType != "admin" {
			forbidden(c, "admin access required")
			c.Abort()
			return
		}
		c.Next()
	}
}

func unauthorized(c *gin.Context, message string) {
	if strings.HasPrefix(c.Request.URL.Path, "/api/v2") {
		response.V2Unauthorized(c, message)
		return
	}
	response.Unauthorized(c, message)
}

func forbidden(c *gin.Context, message string) {
	if strings.HasPrefix(c.Request.URL.Path, "/api/v2") {
		response.V2Forbidden(c, message)
		return
	}
	response.Forbidden(c, message)
}

func GetUserID(c *gin.Context) int64 {
	userID, exists := c.Get("user_id")
	if !exists {
		return 0
	}
	return userID.(int64)
}

func GetUserType(c *gin.Context) string {
	userType, exists := c.Get("user_type")
	if !exists {
		return ""
	}
	return userType.(string)
}
