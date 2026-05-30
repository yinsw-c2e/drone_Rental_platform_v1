package wechat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"time"

	"go.uber.org/zap"
)

const defaultAccessTokenEndpoint = "https://api.weixin.qq.com/cgi-bin/token"

type AccessTokenConfig struct {
	AppID         string
	AppSecret     string
	TokenEndpoint string
	HTTPClient    *http.Client
	Logger        *zap.Logger
}

type AccessTokenManager struct {
	appID         string
	appSecret     string
	tokenEndpoint string
	client        *http.Client
	logger        *zap.Logger

	mu        sync.Mutex
	token     string
	expiresAt time.Time
}

type accessTokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	ErrCode     int    `json:"errcode"`
	ErrMsg      string `json:"errmsg"`
}

type APIError struct {
	ErrCode int
	ErrMsg  string
}

func (e *APIError) Error() string {
	if e == nil {
		return ""
	}
	return fmt.Sprintf("wechat api error: errcode=%d errmsg=%s", e.ErrCode, e.ErrMsg)
}

func NewAccessTokenManager(cfg AccessTokenConfig) *AccessTokenManager {
	endpoint := cfg.TokenEndpoint
	if endpoint == "" {
		endpoint = defaultAccessTokenEndpoint
	}
	client := cfg.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	return &AccessTokenManager{
		appID:         cfg.AppID,
		appSecret:     cfg.AppSecret,
		tokenEndpoint: endpoint,
		client:        client,
		logger:        cfg.Logger,
	}
}

func (m *AccessTokenManager) GetAccessToken(ctx context.Context) (string, error) {
	if m == nil {
		return "", errors.New("wechat access token manager is nil")
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.token != "" && time.Now().Before(m.expiresAt) {
		return m.token, nil
	}
	return m.refreshLocked(ctx)
}

func (m *AccessTokenManager) RefreshAccessToken(ctx context.Context) (string, error) {
	if m == nil {
		return "", errors.New("wechat access token manager is nil")
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.refreshLocked(ctx)
}

func (m *AccessTokenManager) refreshLocked(ctx context.Context) (string, error) {
	if m.appID == "" || m.appSecret == "" {
		return "", errors.New("wechat mini app_id/app_secret is required")
	}

	endpoint, err := url.Parse(m.tokenEndpoint)
	if err != nil {
		return "", err
	}
	query := endpoint.Query()
	query.Set("grant_type", "client_credential")
	query.Set("appid", m.appID)
	query.Set("secret", m.appSecret)
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return "", err
	}

	resp, err := m.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("wechat access token http status: %d", resp.StatusCode)
	}

	var payload accessTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", err
	}
	if payload.ErrCode != 0 {
		return "", &APIError{ErrCode: payload.ErrCode, ErrMsg: payload.ErrMsg}
	}
	if payload.AccessToken == "" || payload.ExpiresIn <= 0 {
		return "", errors.New("wechat access token response is incomplete")
	}

	m.token = payload.AccessToken
	m.expiresAt = nextRefreshTime(time.Now(), payload.ExpiresIn)
	if m.logger != nil {
		m.logger.Info("wechat access token refreshed", zap.Time("refresh_after", m.expiresAt))
	}
	return m.token, nil
}

func nextRefreshTime(now time.Time, expiresIn int) time.Time {
	expiresDuration := time.Duration(expiresIn) * time.Second
	refreshAfter := now.Add(expiresDuration - 5*time.Minute)
	if refreshAfter.After(now) {
		return refreshAfter
	}
	return now.Add(expiresDuration / 2)
}
