package repository

import (
	"os"
	"strings"
	"testing"
)

func TestPilotNearbyQueryDoesNotFilterJoinedProfileColumnsInHaving(t *testing.T) {
	content, err := os.ReadFile("pilot_repo.go")
	if err != nil {
		t.Fatal(err)
	}
	source := string(content)

	if strings.Contains(source, "HAVING"+" distance") {
		t.Fatal("FindNearby must not filter distance/service radius in HAVING; MySQL can reject joined profile columns there")
	}
	if !strings.Contains(source, "resolved_service_radius_km") || !strings.Contains(source, "WHERE distance <= ? AND distance <= resolved_service_radius_km") {
		t.Fatal("FindNearby should filter computed distance and service radius in the outer query")
	}
}
