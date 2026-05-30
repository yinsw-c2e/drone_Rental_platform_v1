package wechat

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestAccessTokenManagerCachesAndRefreshes(t *testing.T) {
	var calls int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("grant_type") != "client_credential" {
			t.Fatalf("unexpected grant_type: %s", r.URL.Query().Get("grant_type"))
		}
		if r.URL.Query().Get("appid") != "app-id" || r.URL.Query().Get("secret") != "app-secret" {
			t.Fatalf("unexpected credentials in query")
		}
		call := atomic.AddInt32(&calls, 1)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token": "token-" + string(rune('0'+call)),
			"expires_in":   7200,
		})
	}))
	defer server.Close()

	manager := NewAccessTokenManager(AccessTokenConfig{
		AppID:         "app-id",
		AppSecret:     "app-secret",
		TokenEndpoint: server.URL,
		HTTPClient:    server.Client(),
	})

	token, err := manager.GetAccessToken(context.Background())
	if err != nil {
		t.Fatalf("first token: %v", err)
	}
	if token != "token-1" {
		t.Fatalf("expected token-1, got %s", token)
	}
	token, err = manager.GetAccessToken(context.Background())
	if err != nil {
		t.Fatalf("cached token: %v", err)
	}
	if token != "token-1" || atomic.LoadInt32(&calls) != 1 {
		t.Fatalf("expected cached token, token=%s calls=%d", token, calls)
	}

	manager.mu.Lock()
	manager.expiresAt = time.Now().Add(-time.Second)
	manager.mu.Unlock()

	token, err = manager.GetAccessToken(context.Background())
	if err != nil {
		t.Fatalf("refreshed token: %v", err)
	}
	if token != "token-2" || atomic.LoadInt32(&calls) != 2 {
		t.Fatalf("expected refreshed token, token=%s calls=%d", token, calls)
	}
}
