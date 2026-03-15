package response

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestV2SuccessListUsesPaginationAndTraceID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.GET("/items", func(c *gin.Context) {
		c.Set("trace_id", "trace-test-123")
		c.Set("page", 2)
		c.Set("page_size", 15)
		V2SuccessList(c, []string{"a", "b"}, 9)
	})

	req := httptest.NewRequest(http.MethodGet, "/items", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode payload: %v", err)
	}

	if payload["code"] != V2CodeOK {
		t.Fatalf("expected code %s, got %v", V2CodeOK, payload["code"])
	}
	if payload["trace_id"] != "trace-test-123" {
		t.Fatalf("expected trace id to be propagated, got %v", payload["trace_id"])
	}

	meta, ok := payload["meta"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected meta block, got %T", payload["meta"])
	}
	if meta["page"] != float64(2) || meta["page_size"] != float64(15) || meta["total"] != float64(9) {
		t.Fatalf("unexpected page meta: %#v", meta)
	}
}

func TestV2UnauthorizedUsesV2Envelope(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.GET("/secure", func(c *gin.Context) {
		c.Set("trace_id", "trace-auth-1")
		V2Unauthorized(c, "missing token")
	})

	req := httptest.NewRequest(http.MethodGet, "/secure", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", recorder.Code)
	}

	var payload V2Envelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode envelope: %v", err)
	}
	if payload.Code != V2CodeUnauthorized {
		t.Fatalf("expected unauthorized code, got %s", payload.Code)
	}
	if payload.TraceID != "trace-auth-1" {
		t.Fatalf("expected trace id trace-auth-1, got %s", payload.TraceID)
	}
}
