package service

import "testing"

func TestDetectSensitiveContent(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		category string
	}{
		{name: "phone", content: "我的电话是 13900001234", category: "phone"},
		{name: "email", content: "联系邮箱 demo@example.com", category: "email"},
		{name: "wechat", content: "加我微信 vx:chenfei007", category: "wechat"},
		{name: "qq", content: "QQ 1234567", category: "qq"},
		{name: "link", content: "请看 https://example.com", category: "external_link"},
		{name: "safe text", content: "订单签署完成后我会在平台内继续跟进。", category: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			violation := detectSensitiveContent(tt.content)
			if tt.category == "" {
				if violation != nil {
					t.Fatalf("expected no violation, got %+v", violation)
				}
				return
			}
			if violation == nil {
				t.Fatalf("expected violation category %s, got nil", tt.category)
			}
			if violation.Category != tt.category {
				t.Fatalf("expected category %s, got %s", tt.category, violation.Category)
			}
		})
	}
}
