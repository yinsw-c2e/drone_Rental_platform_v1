package main

import (
	"os"
	"strings"
	"testing"
)

func TestServerKeepsV1FallbackWhileV2RegressionIsNotGreen(t *testing.T) {
	content, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatal(err)
	}
	source := string(content)

	for _, marker := range []string{"v1.RegisterRoutes", "v2.RegisterRoutes"} {
		if !strings.Contains(source, marker) {
			t.Fatalf("server main must keep %s registered during the v2 convergence window", marker)
		}
	}
}
