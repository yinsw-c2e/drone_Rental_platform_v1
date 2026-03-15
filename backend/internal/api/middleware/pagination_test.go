package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestPaginationMiddlewareUsesDefaultsAndCapsPageSize(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(PaginationMiddleware(1, 20, 50))
	router.GET("/items", func(c *gin.Context) {
		page, pageSize := GetPagination(c)
		c.JSON(http.StatusOK, gin.H{
			"page":      page,
			"page_size": pageSize,
		})
	})

	req := httptest.NewRequest(http.MethodGet, "/items?page=-1&page_size=999", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
	if body := recorder.Body.String(); body != "{\"page\":1,\"page_size\":50}" {
		t.Fatalf("unexpected body: %s", body)
	}
}

func TestGetPaginationNilContext(t *testing.T) {
	page, pageSize := GetPagination(nil)
	if page != 1 || pageSize != 20 {
		t.Fatalf("expected default pagination 1/20, got %d/%d", page, pageSize)
	}
}
