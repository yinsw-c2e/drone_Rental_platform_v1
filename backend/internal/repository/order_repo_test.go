package repository

import "testing"

func TestNormalizeOrderNullableFieldsPilotIDZeroToNil(t *testing.T) {
	fields := map[string]interface{}{
		"pilot_id": int64(0),
		"status":   "pending_dispatch",
	}
	normalized := normalizeOrderNullableFields(fields)
	if value, ok := normalized["pilot_id"]; !ok || value != nil {
		t.Fatalf("expected pilot_id to be nil, got %#v", normalized["pilot_id"])
	}
}

func TestNormalizeOrderNullableFieldsPilotIDPositivePreserved(t *testing.T) {
	fields := map[string]interface{}{
		"pilot_id": int64(16),
	}
	normalized := normalizeOrderNullableFields(fields)
	if value := normalized["pilot_id"]; value != int64(16) {
		t.Fatalf("expected pilot_id=16, got %#v", value)
	}
}
