package middleware

import (
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/pkg/response"
)

type rateLimitWindow struct {
	start time.Time
	count int
}

func RateLimitMiddleware(limit int, window time.Duration) gin.HandlerFunc {
	return rateLimitMiddlewareWithClock(limit, window, time.Now)
}

func rateLimitMiddlewareWithClock(limit int, window time.Duration, nowFn func() time.Time) gin.HandlerFunc {
	if limit <= 0 || window <= 0 {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	var (
		mu      sync.Mutex
		windows = make(map[string]*rateLimitWindow)
	)

	return func(c *gin.Context) {
		if shouldSkipRateLimit(c) {
			c.Next()
			return
		}

		now := nowFn()
		key := buildRateLimitKey(c)

		mu.Lock()
		for clientKey, bucket := range windows {
			if now.Sub(bucket.start) >= window*2 {
				delete(windows, clientKey)
			}
		}

		bucket, ok := windows[key]
		if !ok || now.Sub(bucket.start) >= window {
			bucket = &rateLimitWindow{start: now, count: 0}
			windows[key] = bucket
		}
		bucket.count++
		count := bucket.count
		resetAt := bucket.start.Add(window)
		mu.Unlock()

		remaining := limit - count
		if remaining < 0 {
			remaining = 0
		}
		c.Header("X-RateLimit-Limit", strconv.Itoa(limit))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(resetAt.Unix(), 10))

		if count > limit {
			rateLimitExceeded(c)
			c.Abort()
			return
		}

		c.Next()
	}
}

func buildRateLimitKey(c *gin.Context) string {
	if userID := GetUserID(c); userID > 0 {
		return "user:" + strconv.FormatInt(userID, 10)
	}
	return "ip:" + c.ClientIP()
}

func shouldSkipRateLimit(c *gin.Context) bool {
	if c == nil || c.Request == nil {
		return true
	}
	if c.Request.Method == http.MethodOptions {
		return true
	}

	path := c.Request.URL.Path
	return strings.HasPrefix(path, "/uploads") ||
		strings.HasPrefix(path, "/.well-known") ||
		strings.HasPrefix(path, "/app/") ||
		path == "/ws"
}

func rateLimitExceeded(c *gin.Context) {
	message := "too many requests, please retry later"
	if strings.HasPrefix(c.Request.URL.Path, "/api/v2") {
		response.V2Error(c, http.StatusTooManyRequests, "TOO_MANY_REQUESTS", message)
		return
	}
	c.JSON(http.StatusTooManyRequests, response.Response{
		Code:      http.StatusTooManyRequests,
		Message:   message,
		Timestamp: time.Now().Unix(),
	})
}
