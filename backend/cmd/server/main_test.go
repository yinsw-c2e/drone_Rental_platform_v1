package main

import (
	"context"
	"database/sql"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	_ "github.com/mattn/go-sqlite3"
)

func TestRegisterHealthRoutesHealthzReturnsOK(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	sqlDB := newHealthTestSQLiteDB(t)
	defer sqlDB.Close()

	registerHealthRoutes(router, sqlDB, redis.NewClient(&redis.Options{Addr: "127.0.0.1:1"}))

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 from /healthz, got %d", recorder.Code)
	}
	body := recorder.Body.String()
	if !strings.Contains(body, `"status":"ok"`) {
		t.Fatalf("expected /healthz body to contain ok status, got %s", body)
	}
}

func TestRegisterHealthRoutesReadyzReturnsReadyWhenDependenciesHealthy(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	sqlDB := newHealthTestSQLiteDB(t)
	defer sqlDB.Close()

	registerHealthRoutes(router, sqlDB, redis.NewClient(&redis.Options{
		Addr:   "fake-redis:6379",
		Dialer: healthyRedisDialer,
	}))

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 from /readyz, got %d with body %s", recorder.Code, recorder.Body.String())
	}
	body := recorder.Body.String()
	if !strings.Contains(body, `"status":"ready"`) {
		t.Fatalf("expected ready status, got %s", body)
	}
	if !strings.Contains(body, `"database":"ok"`) || !strings.Contains(body, `"redis":"ok"`) {
		t.Fatalf("expected dependency status ok, got %s", body)
	}
}

func TestRegisterHealthRoutesReadyzReturnsDegradedWhenRedisUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	sqlDB := newHealthTestSQLiteDB(t)
	defer sqlDB.Close()

	registerHealthRoutes(router, sqlDB, redis.NewClient(&redis.Options{
		Addr:         "fake-redis:6379",
		DialTimeout:  200 * time.Millisecond,
		ReadTimeout:  200 * time.Millisecond,
		WriteTimeout: 200 * time.Millisecond,
		Dialer:       failingRedisDialer,
	}))

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 from /readyz when redis is unavailable, got %d with body %s", recorder.Code, recorder.Body.String())
	}
	body := recorder.Body.String()
	if !strings.Contains(body, `"status":"degraded"`) {
		t.Fatalf("expected degraded status, got %s", body)
	}
	if !strings.Contains(body, `"database":"ok"`) || !strings.Contains(body, `"redis":"error"`) {
		t.Fatalf("expected database ok and redis error, got %s", body)
	}
}

func newHealthTestSQLiteDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite3", "file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.Ping(); err != nil {
		t.Fatalf("ping sqlite db: %v", err)
	}
	return db
}

func healthyRedisDialer(context.Context, string, string) (net.Conn, error) {
	clientConn, serverConn := net.Pipe()
	go func() {
		defer serverConn.Close()
		_ = serverConn.SetDeadline(time.Now().Add(2 * time.Second))
		buf := make([]byte, 256)
		_, _ = serverConn.Read(buf)
		_, _ = serverConn.Write([]byte("+PONG\r\n"))
	}()
	return clientConn, nil
}

func failingRedisDialer(context.Context, string, string) (net.Conn, error) {
	return nil, errors.New("redis unavailable")
}
