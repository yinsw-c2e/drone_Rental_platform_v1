package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/pkg/response"
)

func FreezeLegacyWriteMiddleware(bypassPrefixes ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			c.Next()
			return
		}

		path := c.Request.URL.Path
		for _, prefix := range bypassPrefixes {
			if prefix != "" && strings.HasPrefix(path, prefix) {
				c.Next()
				return
			}
		}

		response.Forbidden(c, "api v1 写入已冻结，请使用 /api/v2 对应入口")
		c.Abort()
	}
}
