package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestRateLimitMiddlewareBlocksAfterLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)

	current := time.Date(2026, 4, 14, 10, 0, 0, 0, time.UTC)
	router := gin.New()
	router.Use(rateLimitMiddlewareWithClock(2, time.Minute, func() time.Time {
		return current
	}))
	router.GET("/api/v2/orders", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	for i := 0; i < 2; i++ {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v2/orders", nil)
		router.ServeHTTP(recorder, req)
		if recorder.Code != http.StatusOK {
			t.Fatalf("expected request %d to pass, got %d", i+1, recorder.Code)
		}
	}

	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v2/orders", nil)
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusTooManyRequests {
		t.Fatalf("expected third request to be rate limited, got %d", recorder.Code)
	}

	current = current.Add(time.Minute + time.Second)
	recorder = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/v2/orders", nil)
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected limiter to reset after window, got %d", recorder.Code)
	}
}

func TestRateLimitMiddlewareSkipsStaticAndOptions(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(rateLimitMiddlewareWithClock(1, time.Minute, time.Now))
	router.GET("/uploads/demo.png", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	router.OPTIONS("/api/v2/orders", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	for i := 0; i < 2; i++ {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/uploads/demo.png", nil)
		router.ServeHTTP(recorder, req)
		if recorder.Code != http.StatusOK {
			t.Fatalf("expected static request %d to skip limiter, got %d", i+1, recorder.Code)
		}
	}

	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "/api/v2/orders", nil)
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected options request to skip limiter, got %d", recorder.Code)
	}
}
