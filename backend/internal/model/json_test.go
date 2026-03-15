package model

import "testing"

func TestJSONScanCopiesDriverBytes(t *testing.T) {
	source := []byte(`{"type":"client","value":1}`)

	var raw JSON
	if err := raw.Scan(source); err != nil {
		t.Fatalf("scan failed: %v", err)
	}

	copy(source, []byte(`{"type":"broken","value":9}`))

	if got := string(raw); got != `{"type":"client","value":1}` {
		t.Fatalf("expected scanned JSON to stay stable, got %q", got)
	}
}
