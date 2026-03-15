package common

import (
	"testing"

	"wurenji-backend/internal/model"
)

func TestSafeJSONValueReturnsStructuredValue(t *testing.T) {
	value := SafeJSONValue(model.JSON(`{"text":"广东省佛山市南海区","radius":100}`))
	m, ok := value.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", value)
	}
	if m["text"] != "广东省佛山市南海区" {
		t.Fatalf("unexpected text: %#v", m["text"])
	}
}

func TestSafeJSONValueToleratesInvalidJSON(t *testing.T) {
	value := SafeJSONValue(model.JSON([]byte("{invalid-json")))
	s, ok := value.(string)
	if !ok {
		t.Fatalf("expected string fallback, got %T", value)
	}
	if s == "" {
		t.Fatal("expected non-empty fallback string")
	}
}
