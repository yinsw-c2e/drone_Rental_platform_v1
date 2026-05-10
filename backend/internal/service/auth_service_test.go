package service

import (
	"strings"
	"testing"

	"go.uber.org/zap"

	"wurenji-backend/internal/config"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

func newOAuthTestAuthService(t *testing.T) *AuthService {
	t.Helper()

	db := newServiceTestDB(t, &model.User{}, &model.Client{}, &model.ClientProfile{})
	return NewAuthService(
		repository.NewUserRepo(db),
		repository.NewClientRepo(db),
		repository.NewRoleProfileRepo(db),
		nil,
		nil,
		&config.Config{
			JWT: config.JWTConfig{
				Secret:        "test-jwt-secret-for-auth-service-oauth-login",
				AccessExpire:  3600,
				RefreshExpire: 7200,
			},
		},
		zap.NewNop(),
	)
}

func TestOAuthLoginCreatesUniquePhoneForWechatUsersWithoutMobile(t *testing.T) {
	authService := newOAuthTestAuthService(t)
	db := authService.userRepo.DB()

	if err := db.Create(&model.User{
		Phone:        "",
		Nickname:     "历史微信用户",
		UserType:     "renter",
		Status:       "active",
		WechatOpenID: "old-openid",
	}).Error; err != nil {
		t.Fatalf("seed legacy OAuth user: %v", err)
	}

	user, tokens, err := authService.OAuthLogin("new-openid", "", "", "", "wechat")
	if err != nil {
		t.Fatalf("OAuthLogin() error = %v", err)
	}
	if tokens == nil || tokens.AccessToken == "" {
		t.Fatalf("expected token pair")
	}
	if user.Phone == "" {
		t.Fatalf("expected synthetic phone for OAuth-created user")
	}
	if !strings.HasPrefix(user.Phone, "wx_") {
		t.Fatalf("expected wx_ synthetic phone, got %q", user.Phone)
	}
	if len(user.Phone) > 20 {
		t.Fatalf("synthetic phone exceeds varchar(20): %q", user.Phone)
	}
	if user.IDVerified != "unverified" {
		t.Fatalf("expected OAuth-created user to start unverified, got %q", user.IDVerified)
	}
}

func TestOAuthLoginReusesWechatUserByUnionID(t *testing.T) {
	authService := newOAuthTestAuthService(t)
	db := authService.userRepo.DB()

	legacy := &model.User{
		Phone:         "",
		Nickname:      "已有微信用户",
		UserType:      "renter",
		Status:        "active",
		WechatOpenID:  "web-openid",
		WechatUnionID: "same-union",
	}
	if err := db.Create(legacy).Error; err != nil {
		t.Fatalf("seed legacy WeChat user: %v", err)
	}

	user, _, err := authService.OAuthLogin("mini-openid", "same-union", "", "", "wechat")
	if err != nil {
		t.Fatalf("OAuthLogin() error = %v", err)
	}
	if user.ID != legacy.ID {
		t.Fatalf("expected existing user %d, got %d", legacy.ID, user.ID)
	}

	var count int64
	if err := db.Model(&model.User{}).Count(&count).Error; err != nil {
		t.Fatalf("count users: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one reused user, got %d", count)
	}
}
