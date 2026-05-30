package service

import (
	"testing"
	"time"
)

func TestBuildWeChatSubscribeData(t *testing.T) {
	paidAt := time.Date(2026, 5, 30, 10, 20, 0, 0, time.Local)
	data := BuildWeChatSubscribeData(map[string]string{
		"thing1":            "title",
		"character_string2": "order_no",
		"amount3":           "amount:income_amount",
		"time4":             "time:paid_at",
		"thing5":            "literal:平台通知",
	}, map[string]interface{}{
		"title":         "订单已支付",
		"order_no":      "ORD202605300001",
		"income_amount": int64(12345),
		"paid_at":       paidAt,
	})

	if data["thing1"].Value != "订单已支付" {
		t.Fatalf("unexpected title: %s", data["thing1"].Value)
	}
	if data["character_string2"].Value != "ORD202605300001" {
		t.Fatalf("unexpected order_no: %s", data["character_string2"].Value)
	}
	if data["amount3"].Value != "123.45元" {
		t.Fatalf("unexpected amount: %s", data["amount3"].Value)
	}
	if data["time4"].Value != "2026-05-30 10:20" {
		t.Fatalf("unexpected time: %s", data["time4"].Value)
	}
	if data["thing5"].Value != "平台通知" {
		t.Fatalf("unexpected literal: %s", data["thing5"].Value)
	}
}
