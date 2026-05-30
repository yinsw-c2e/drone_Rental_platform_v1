package wechat

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

type testTokenProvider struct {
	token        string
	refreshToken string
	refreshes    int32
}

func (p *testTokenProvider) GetAccessToken(ctx context.Context) (string, error) {
	return p.token, nil
}

func (p *testTokenProvider) RefreshAccessToken(ctx context.Context) (string, error) {
	atomic.AddInt32(&p.refreshes, 1)
	return p.refreshToken, nil
}

func TestSubscribeClientSendsMessageBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("access_token") != "token" {
			t.Fatalf("unexpected access token: %s", r.URL.Query().Get("access_token"))
		}
		var msg SubscribeMessage
		if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		if msg.ToUser != "openid" || msg.TemplateID != "tmpl" || msg.Page != "pages/orders/detail/index?orderId=12" {
			t.Fatalf("unexpected message: %#v", msg)
		}
		if msg.Data["thing1"].Value != "订单已支付" || msg.Data["character_string2"].Value != "ORD001" {
			t.Fatalf("unexpected data: %#v", msg.Data)
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"errcode": 0, "errmsg": "ok"})
	}))
	defer server.Close()

	client := NewSubscribeClient(SubscribeClientConfig{
		Endpoint:      server.URL,
		HTTPClient:    server.Client(),
		TokenProvider: &testTokenProvider{token: "token", refreshToken: "token"},
	})
	err := client.Send(context.Background(), SubscribeMessage{
		ToUser:     "openid",
		TemplateID: "tmpl",
		Page:       "pages/orders/detail/index?orderId=12",
		Data: map[string]SubscribeDataValue{
			"thing1":            {Value: "订单已支付"},
			"character_string2": {Value: "ORD001"},
		},
	})
	if err != nil {
		t.Fatalf("send subscribe: %v", err)
	}
}

func TestSubscribeClientRefreshesTokenOnExpiredCode(t *testing.T) {
	var calls int32
	provider := &testTokenProvider{token: "old-token", refreshToken: "new-token"}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		call := atomic.AddInt32(&calls, 1)
		if call == 1 {
			if r.URL.Query().Get("access_token") != "old-token" {
				t.Fatalf("first call should use old token")
			}
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"errcode": 40001, "errmsg": "invalid credential"})
			return
		}
		if r.URL.Query().Get("access_token") != "new-token" {
			t.Fatalf("retry should use new token, got %s", r.URL.Query().Get("access_token"))
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"errcode": 0, "errmsg": "ok"})
	}))
	defer server.Close()

	client := NewSubscribeClient(SubscribeClientConfig{
		Endpoint:      server.URL,
		HTTPClient:    server.Client(),
		TokenProvider: provider,
	})
	err := client.Send(context.Background(), SubscribeMessage{
		ToUser:     "openid",
		TemplateID: "tmpl",
		Data:       map[string]SubscribeDataValue{"thing1": {Value: "测试"}},
	})
	if err != nil {
		t.Fatalf("send subscribe: %v", err)
	}
	if atomic.LoadInt32(&provider.refreshes) != 1 || atomic.LoadInt32(&calls) != 2 {
		t.Fatalf("expected one refresh and two calls, refreshes=%d calls=%d", provider.refreshes, calls)
	}
}
