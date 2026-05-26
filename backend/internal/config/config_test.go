package config

import (
	"strings"
	"testing"
)

func validProductionConfig() Config {
	return Config{
		Server: ServerConfig{Port: 8080, Mode: "release"},
		Database: DatabaseConfig{
			Host: "127.0.0.1", Port: 3306, User: "root", DBName: "wurenji", Charset: "utf8mb4",
		},
		Redis: RedisConfig{Host: "127.0.0.1", Port: 6379},
		JWT: JWTConfig{
			Secret:       "prod-secret-with-more-than-thirty-two-chars",
			AccessExpire: 7200, RefreshExpire: 604800,
		},
		Upload: UploadConfig{MaxSize: 5, SavePath: "./uploads", AllowedExts: []string{".png"}},
		SMS: SMSConfig{
			Provider: "aliyun",
			Aliyun:   AliyunSMS{AccessKeyID: "ak", AccessKeySecret: "sk"},
		},
		Payment: PaymentConfig{
			CommissionRate: 10,
			WeChat:         WeChatConfig{AppID: "app", MchID: "mch", APIKey: "key"},
		},
		WebSocket: WebSocketConfig{MaxMessageSize: 4096, WriteWait: 10, PongWait: 60, PingPeriod: 54},
	}
}

func TestValidateForProductionRejectsMockPayments(t *testing.T) {
	cfg := validProductionConfig()
	cfg.Payment.AllowMock = true

	err := cfg.ValidateForProduction()
	if err == nil {
		t.Fatal("expected production mock payment error, got nil")
	}
	if !strings.Contains(err.Error(), "mock payments") {
		t.Fatalf("expected mock payment error, got %v", err)
	}
}
