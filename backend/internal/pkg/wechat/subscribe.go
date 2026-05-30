package wechat

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"go.uber.org/zap"
)

const defaultSubscribeSendEndpoint = "https://api.weixin.qq.com/cgi-bin/message/subscribe/send"

type AccessTokenProvider interface {
	GetAccessToken(ctx context.Context) (string, error)
	RefreshAccessToken(ctx context.Context) (string, error)
}

type SubscribeClientConfig struct {
	Endpoint      string
	HTTPClient    *http.Client
	TokenProvider AccessTokenProvider
	Logger        *zap.Logger
}

type SubscribeClient struct {
	endpoint      string
	client        *http.Client
	tokenProvider AccessTokenProvider
	logger        *zap.Logger
}

type SubscribeDataValue struct {
	Value string `json:"value"`
}

type SubscribeMessage struct {
	ToUser     string                        `json:"touser"`
	TemplateID string                        `json:"template_id"`
	Page       string                        `json:"page,omitempty"`
	Data       map[string]SubscribeDataValue `json:"data"`
}

type subscribeResponse struct {
	ErrCode int    `json:"errcode"`
	ErrMsg  string `json:"errmsg"`
}

func NewSubscribeClient(cfg SubscribeClientConfig) *SubscribeClient {
	endpoint := cfg.Endpoint
	if endpoint == "" {
		endpoint = defaultSubscribeSendEndpoint
	}
	client := cfg.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	return &SubscribeClient{
		endpoint:      endpoint,
		client:        client,
		tokenProvider: cfg.TokenProvider,
		logger:        cfg.Logger,
	}
}

func (c *SubscribeClient) Send(ctx context.Context, msg SubscribeMessage) error {
	if c == nil {
		return errors.New("wechat subscribe client is nil")
	}
	if c.tokenProvider == nil {
		return errors.New("wechat access token provider is required")
	}
	token, err := c.tokenProvider.GetAccessToken(ctx)
	if err != nil {
		return err
	}
	err = c.sendWithToken(ctx, token, msg)
	if apiErr, ok := err.(*APIError); ok && (apiErr.ErrCode == 40001 || apiErr.ErrCode == 42001) {
		if c.logger != nil {
			c.logger.Warn("wechat access token expired, refreshing", zap.Int("errcode", apiErr.ErrCode))
		}
		token, refreshErr := c.tokenProvider.RefreshAccessToken(ctx)
		if refreshErr != nil {
			return refreshErr
		}
		return c.sendWithToken(ctx, token, msg)
	}
	return err
}

func (c *SubscribeClient) sendWithToken(ctx context.Context, token string, msg SubscribeMessage) error {
	if msg.ToUser == "" || msg.TemplateID == "" {
		return errors.New("wechat subscribe touser/template_id is required")
	}

	endpoint, err := url.Parse(c.endpoint)
	if err != nil {
		return err
	}
	query := endpoint.Query()
	query.Set("access_token", token)
	endpoint.RawQuery = query.Encode()

	body, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint.String(), bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("wechat subscribe http status: %d", resp.StatusCode)
	}

	var payload subscribeResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return err
	}
	if payload.ErrCode == 0 {
		return nil
	}

	apiErr := &APIError{ErrCode: payload.ErrCode, ErrMsg: payload.ErrMsg}
	switch payload.ErrCode {
	case 43101:
		if c.logger != nil {
			c.logger.Info("wechat subscribe rejected by user", zap.String("template_id", msg.TemplateID), zap.Int("errcode", payload.ErrCode))
		}
		return nil
	case 47003:
		if c.logger != nil {
			c.logger.Warn("wechat subscribe template data mismatch", zap.String("template_id", msg.TemplateID), zap.Int("errcode", payload.ErrCode), zap.String("errmsg", payload.ErrMsg))
		}
		return nil
	default:
		if c.logger != nil {
			c.logger.Warn("wechat subscribe send failed", zap.String("template_id", msg.TemplateID), zap.Int("errcode", payload.ErrCode), zap.String("errmsg", payload.ErrMsg))
		}
		return apiErr
	}
}
