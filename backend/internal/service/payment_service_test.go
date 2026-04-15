package service

import (
	"encoding/json"
	"testing"
)

func TestNormalizePaymentMethod(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{name: "mock", input: "mock", want: "mock"},
		{name: "wechat upper", input: " WeChat ", want: "wechat"},
		{name: "alipay", input: "alipay", want: "alipay"},
		{name: "invalid", input: "bank", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := normalizePaymentMethod(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("expected %s, got %s", tt.want, got)
			}
		})
	}
}

func TestBuildCreatePaymentResult(t *testing.T) {
	tests := []struct {
		method                 string
		wantAutoComplete       bool
		wantRequiresExternalCB bool
		wantDeferred           bool
	}{
		{method: "mock", wantAutoComplete: true, wantRequiresExternalCB: false, wantDeferred: false},
		{method: "wechat", wantAutoComplete: false, wantRequiresExternalCB: true, wantDeferred: true},
		{method: "alipay", wantAutoComplete: false, wantRequiresExternalCB: true, wantDeferred: true},
	}

	for _, tt := range tests {
		t.Run(tt.method, func(t *testing.T) {
			result, err := buildCreatePaymentResult(tt.method, "PAY_TEST_001")
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result.PaymentNo != "PAY_TEST_001" {
				t.Fatalf("expected payment no to stay aligned, got %s", result.PaymentNo)
			}

			var payload map[string]interface{}
			if err := json.Unmarshal([]byte(result.PayParams), &payload); err != nil {
				t.Fatalf("failed to parse pay params: %v", err)
			}

			if payload["method"] != tt.method {
				t.Fatalf("expected method %s, got %#v", tt.method, payload["method"])
			}
			if payload["payment_no"] != "PAY_TEST_001" {
				t.Fatalf("expected payment_no PAY_TEST_001, got %#v", payload["payment_no"])
			}
			if payload["auto_complete"] != tt.wantAutoComplete {
				t.Fatalf("expected auto_complete=%v, got %#v", tt.wantAutoComplete, payload["auto_complete"])
			}
			if payload["requires_external_callback"] != tt.wantRequiresExternalCB {
				t.Fatalf("expected requires_external_callback=%v, got %#v", tt.wantRequiresExternalCB, payload["requires_external_callback"])
			}

			_, hasDeferred := payload["deferred"]
			if hasDeferred != tt.wantDeferred {
				t.Fatalf("expected deferred presence=%v, got %v", tt.wantDeferred, hasDeferred)
			}
		})
	}
}
