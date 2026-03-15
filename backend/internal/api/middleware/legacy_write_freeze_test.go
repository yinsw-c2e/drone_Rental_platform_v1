package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestFreezeLegacyWriteMiddlewareBlocksMutations(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	group := router.Group("/api/v1/order")
	group.Use(FreezeLegacyWriteMiddleware())
	group.POST("/create", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/order/create", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected status 403, got %d", recorder.Code)
	}

	var payload struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if payload.Code != 403 {
		t.Fatalf("expected response code 403, got %d", payload.Code)
	}
	if payload.Message == "" {
		t.Fatal("expected forbidden message to be present")
	}
}

func TestFreezeLegacyWriteMiddlewareAllowsReads(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	group := router.Group("/api/v1/order")
	group.Use(FreezeLegacyWriteMiddleware())
	group.GET("/list", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/order/list", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
}

func TestFreezeLegacyWriteMiddlewareAllowsBypassPrefix(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	group := router.Group("/api/v1/dispatch")
	group.Use(FreezeLegacyWriteMiddleware("/api/v1/dispatch/admin/"))
	group.POST("/admin/retry", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/dispatch/admin/retry", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected bypassed request to succeed, got %d", recorder.Code)
	}
}
