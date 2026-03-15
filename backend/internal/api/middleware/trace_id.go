package middleware

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
)

const traceIDContextKey = "trace_id"

func TraceIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		traceID := c.GetHeader("X-Trace-Id")
		if traceID == "" {
			traceID = fmt.Sprintf("req_%d", time.Now().UnixNano())
		}
		c.Set(traceIDContextKey, traceID)
		c.Writer.Header().Set("X-Trace-Id", traceID)
		c.Next()
	}
}

func GetTraceID(c *gin.Context) string {
	if c == nil {
		return ""
	}
	if value, ok := c.Get(traceIDContextKey); ok {
		if traceID, ok := value.(string); ok {
			return traceID
		}
	}
	return ""
}
