package oauth

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"go.uber.org/zap"
)

// OAuthUserInfo 第三方登录返回的用户信息
type OAuthUserInfo struct {
	OpenID   string `json:"open_id"`
	UnionID  string `json:"union_id"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
	Gender   int    `json:"gender"`   // 0-未知 1-男 2-女
	Platform string `json:"platform"` // wechat, qq
}

// OAuthProvider 第三方登录接口
type OAuthProvider interface {
	// GetUserInfo 通过授权码获取用户信息
	GetUserInfo(code string) (*OAuthUserInfo, error)
}

// ============================================================
// 微信登录
// ============================================================

// WeChatOAuthConfig 微信OAuth配置
type WeChatOAuthConfig struct {
	AppID     string
	AppSecret string
}

// WeChatOAuth 微信OAuth实现
type WeChatOAuth struct {
	config WeChatOAuthConfig
	client *http.Client
	logger *zap.Logger
}

// NewWeChatOAuth 创建微信OAuth实例
func NewWeChatOAuth(config WeChatOAuthConfig, logger *zap.Logger) *WeChatOAuth {
	return &WeChatOAuth{
		config: config,
		client: &http.Client{Timeout: 10 * time.Second},
		logger: logger,
	}
}

// IsEnabled 检查微信OAuth是否已配置
func (w *WeChatOAuth) IsEnabled() bool {
	return w.config.AppID != "" && w.config.AppSecret != ""
}

// GetUserInfo 微信授权登录获取用户信息
// 流程：code -> access_token + openid -> 用户信息
func (w *WeChatOAuth) GetUserInfo(code string) (*OAuthUserInfo, error) {
	// Step 1: 用code换取access_token
	tokenURL := fmt.Sprintf(
		"https://api.weixin.qq.com/sns/oauth2/access_token?appid=%s&secret=%s&code=%s&grant_type=authorization_code",
		w.config.AppID, w.config.AppSecret, code,
	)

	tokenResp, err := w.client.Get(tokenURL)
	if err != nil {
		w.logger.Error("wechat get access_token failed", zap.Error(err))
		return nil, fmt.Errorf("get access_token failed: %w", err)
	}
	defer tokenResp.Body.Close()

	tokenBody, err := io.ReadAll(tokenResp.Body)
	if err != nil {
		return nil, fmt.Errorf("read token response failed: %w", err)
	}

	var tokenResult struct {
		AccessToken  string `json:"access_token"`
		ExpiresIn    int    `json:"expires_in"`
		RefreshToken string `json:"refresh_token"`
		OpenID       string `json:"openid"`
		UnionID      string `json:"unionid"`
		ErrCode      int    `json:"errcode"`
		ErrMsg       string `json:"errmsg"`
	}

	if err := json.Unmarshal(tokenBody, &tokenResult); err != nil {
		return nil, fmt.Errorf("parse token response failed: %w", err)
	}

	if tokenResult.ErrCode != 0 {
		return nil, fmt.Errorf("wechat token error: %d %s", tokenResult.ErrCode, tokenResult.ErrMsg)
	}

	// Step 2: 用access_token和openid获取用户信息
	userURL := fmt.Sprintf(
		"https://api.weixin.qq.com/sns/userinfo?access_token=%s&openid=%s",
		tokenResult.AccessToken, tokenResult.OpenID,
	)

	userResp, err := w.client.Get(userURL)
	if err != nil {
		w.logger.Error("wechat get userinfo failed", zap.Error(err))
		return nil, fmt.Errorf("get userinfo failed: %w", err)
	}
	defer userResp.Body.Close()

	userBody, err := io.ReadAll(userResp.Body)
	if err != nil {
		return nil, fmt.Errorf("read userinfo response failed: %w", err)
	}

	var userResult struct {
		OpenID   string `json:"openid"`
		UnionID  string `json:"unionid"`
		Nickname string `json:"nickname"`
		HeadURL  string `json:"headimgurl"`
		Sex      int    `json:"sex"`
		ErrCode  int    `json:"errcode"`
		ErrMsg   string `json:"errmsg"`
	}

	if err := json.Unmarshal(userBody, &userResult); err != nil {
		return nil, fmt.Errorf("parse userinfo response failed: %w", err)
	}

	if userResult.ErrCode != 0 {
		return nil, fmt.Errorf("wechat userinfo error: %d %s", userResult.ErrCode, userResult.ErrMsg)
	}

	return &OAuthUserInfo{
		OpenID:   userResult.OpenID,
		UnionID:  userResult.UnionID,
		Nickname: userResult.Nickname,
		Avatar:   userResult.HeadURL,
		Gender:   userResult.Sex,
		Platform: "wechat",
	}, nil
}

// ============================================================
// QQ登录
// ============================================================

// QQOAuthConfig QQ OAuth配置
type QQOAuthConfig struct {
	AppID  string
	AppKey string
}

// QQOAuth QQ OAuth实现
type QQOAuth struct {
	config QQOAuthConfig
	client *http.Client
	logger *zap.Logger
}

// NewQQOAuth 创建QQ OAuth实例
func NewQQOAuth(config QQOAuthConfig, logger *zap.Logger) *QQOAuth {
	return &QQOAuth{
		config: config,
		client: &http.Client{Timeout: 10 * time.Second},
		logger: logger,
	}
}

// IsEnabled 检查QQ OAuth是否已配置
func (q *QQOAuth) IsEnabled() bool {
	return q.config.AppID != "" && q.config.AppKey != ""
}

// GetUserInfo QQ授权登录获取用户信息
// 流程：access_token(客户端获取) -> openid -> 用户信息
func (q *QQOAuth) GetUserInfo(accessToken string) (*OAuthUserInfo, error) {
	// Step 1: 获取openid
	openIDURL := fmt.Sprintf(
		"https://graph.qq.com/oauth2.0/me?access_token=%s&fmt=json",
		url.QueryEscape(accessToken),
	)

	openIDResp, err := q.client.Get(openIDURL)
	if err != nil {
		q.logger.Error("qq get openid failed", zap.Error(err))
		return nil, fmt.Errorf("get openid failed: %w", err)
	}
	defer openIDResp.Body.Close()

	openIDBody, err := io.ReadAll(openIDResp.Body)
	if err != nil {
		return nil, fmt.Errorf("read openid response failed: %w", err)
	}

	var openIDResult struct {
		ClientID string `json:"client_id"`
		OpenID   string `json:"openid"`
		Error    int    `json:"error"`
		ErrorMsg string `json:"error_description"`
	}

	if err := json.Unmarshal(openIDBody, &openIDResult); err != nil {
		return nil, fmt.Errorf("parse openid response failed: %w", err)
	}

	if openIDResult.Error != 0 {
		return nil, fmt.Errorf("qq openid error: %d %s", openIDResult.Error, openIDResult.ErrorMsg)
	}

	// Step 2: 获取用户信息
	userURL := fmt.Sprintf(
		"https://graph.qq.com/user/get_user_info?access_token=%s&oauth_consumer_key=%s&openid=%s&fmt=json",
		url.QueryEscape(accessToken), q.config.AppID, openIDResult.OpenID,
	)

	userResp, err := q.client.Get(userURL)
	if err != nil {
		q.logger.Error("qq get userinfo failed", zap.Error(err))
		return nil, fmt.Errorf("get userinfo failed: %w", err)
	}
	defer userResp.Body.Close()

	userBody, err := io.ReadAll(userResp.Body)
	if err != nil {
		return nil, fmt.Errorf("read userinfo response failed: %w", err)
	}

	var userResult struct {
		Ret      int    `json:"ret"`
		Msg      string `json:"msg"`
		Nickname string `json:"nickname"`
		Avatar   string `json:"figureurl_qq_2"` // 100x100头像
		Gender   string `json:"gender"`
	}

	if err := json.Unmarshal(userBody, &userResult); err != nil {
		return nil, fmt.Errorf("parse userinfo response failed: %w", err)
	}

	if userResult.Ret != 0 {
		return nil, fmt.Errorf("qq userinfo error: %d %s", userResult.Ret, userResult.Msg)
	}

	gender := 0
	if userResult.Gender == "男" {
		gender = 1
	} else if userResult.Gender == "女" {
		gender = 2
	}

	return &OAuthUserInfo{
		OpenID:   openIDResult.OpenID,
		Nickname: userResult.Nickname,
		Avatar:   userResult.Avatar,
		Gender:   gender,
		Platform: "qq",
	}, nil
}
