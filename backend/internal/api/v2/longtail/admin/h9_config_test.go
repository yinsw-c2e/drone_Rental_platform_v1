package admin

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"wurenji-backend/internal/api/middleware"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/repository"
	"wurenji-backend/internal/service"
)

func newH9AdminTestRouter(t *testing.T, userType string) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.ServiceClass{},
		&model.SystemConfig{},
		&model.Order{},
		&model.OrderBroadcast{},
		&model.AdminLog{},
	); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	orderRepo := repository.NewOrderRepo(db)
	handler := NewHandler(nil, nil, nil, service.NewOperationsService(repository.NewMigrationRepo(db), orderRepo), nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)
	handler.SetH9Dependencies(repository.NewServiceClassRepo(db), repository.NewOrderBroadcastRepo(db), service.NewSystemConfigService(db))

	router := gin.New()
	group := router.Group("/api/v2/admin")
	group.Use(func(c *gin.Context) {
		c.Set("user_id", int64(99))
		c.Set("user_type", userType)
		c.Next()
	})
	group.Use(middleware.AdminMiddleware())
	handler.RegisterExtendedRoutes(group)
	return router, db
}

func TestAdminServiceClassUpdatePersistsNewPrice(t *testing.T) {
	router, db := newH9AdminTestRouter(t, "admin")
	item := &model.ServiceClass{
		Code:                "light_heavy",
		DisplayName:         "轻型吊运",
		PayloadMinKG:        0,
		PayloadMaxKG:        100,
		BasePriceCents:      12000,
		PerKMPriceCents:     1000,
		PerMinutePriceCents: 100,
		MinChargeCents:      12000,
		Status:              "active",
	}
	if err := db.Create(item).Error; err != nil {
		t.Fatalf("create service class: %v", err)
	}

	req := httptest.NewRequest(http.MethodPut, "/api/v2/admin/service-classes/1", bytes.NewBufferString(`{"base_price_cents":15000}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	var updated model.ServiceClass
	if err := db.First(&updated, item.ID).Error; err != nil {
		t.Fatalf("load updated service class: %v", err)
	}
	if updated.BasePriceCents != 15000 {
		t.Fatalf("expected base_price_cents=15000, got %d", updated.BasePriceCents)
	}
}

func TestAdminSystemConfigRejectsForeignKey(t *testing.T) {
	router, db := newH9AdminTestRouter(t, "admin")
	req := httptest.NewRequest(http.MethodPut, "/api/v2/admin/system-configs/foreign.key", bytes.NewBufferString(`{"value":"1"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", rec.Code, rec.Body.String())
	}
	var count int64
	if err := db.Model(&model.SystemConfig{}).Where("config_key = ?", "foreign.key").Count(&count).Error; err != nil {
		t.Fatalf("count system config: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected foreign key rejected without insert, got count=%d", count)
	}
}

func TestAdminBroadcastStatsAggregatesCorrectly(t *testing.T) {
	router, db := newH9AdminTestRouter(t, "admin")
	now := time.Now().UTC()
	grabbedAt := now.Add(-20 * time.Minute).Add(10 * time.Second)
	items := []model.OrderBroadcast{
		{
			OrderID:             1001,
			OriginLatitude:      22.54,
			OriginLongitude:     114.05,
			ServiceClassCode:    "light_heavy",
			WeightKG:            60,
			EstimatedTotalCents: 18800,
			Status:              "grabbed",
			ExpiresAt:           now.Add(time.Hour),
			GrabbedByUserID:     7007,
			GrabbedAt:           &grabbedAt,
			CreatedAt:           now.Add(-20 * time.Minute),
		},
		{
			OrderID:             1002,
			OriginLatitude:      22.54,
			OriginLongitude:     114.05,
			ServiceClassCode:    "light_heavy",
			WeightKG:            60,
			EstimatedTotalCents: 18800,
			Status:              "expired",
			ExpiresAt:           now.Add(-time.Minute),
			CreatedAt:           now.Add(-15 * time.Minute),
		},
		{
			OrderID:             1003,
			OriginLatitude:      22.54,
			OriginLongitude:     114.05,
			ServiceClassCode:    "light_heavy",
			WeightKG:            60,
			EstimatedTotalCents: 18800,
			Status:              "auto_assigning",
			ExpiresAt:           now.Add(time.Minute),
			CreatedAt:           now.Add(-10 * time.Minute),
		},
	}
	if err := db.Create(&items).Error; err != nil {
		t.Fatalf("create broadcasts: %v", err)
	}

	url := "/api/v2/admin/broadcasts/stats?from=" + now.Add(-time.Hour).UTC().Format(time.RFC3339) + "&to=" + now.Add(time.Hour).UTC().Format(time.RFC3339)
	req := httptest.NewRequest(http.MethodGet, url, nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	var envelope response.Response
	if err := json.Unmarshal(rec.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	raw, _ := json.Marshal(envelope.Data)
	var stats repository.BroadcastStats
	if err := json.Unmarshal(raw, &stats); err != nil {
		t.Fatalf("decode stats: %v", err)
	}
	if stats.TotalBroadcasts != 3 || stats.GrabbedCount != 1 || stats.ExpiredCount != 1 || stats.AutoAssignedCount != 1 {
		t.Fatalf("unexpected stats counts: %#v", stats)
	}
	if stats.AvgGrabSeconds != 10 {
		t.Fatalf("expected avg_grab_seconds=10, got %v", stats.AvgGrabSeconds)
	}
	if int(stats.UnmatchedRatePct*10) != 333 {
		t.Fatalf("expected unmatched rate about 33.3, got %v", stats.UnmatchedRatePct)
	}
}

func TestAdminH9RoutesRejectNonAdmin(t *testing.T) {
	router, _ := newH9AdminTestRouter(t, "provider")
	cases := []struct {
		method string
		path   string
		body   string
	}{
		{method: http.MethodGet, path: "/api/v2/admin/service-classes"},
		{method: http.MethodPut, path: "/api/v2/admin/system-configs/broadcast.auto_assign.enabled", body: `{"value":"false"}`},
		{method: http.MethodGet, path: "/api/v2/admin/broadcasts/stats"},
	}
	for _, tc := range cases {
		req := httptest.NewRequest(tc.method, tc.path, bytes.NewBufferString(tc.body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("%s %s expected 403, got %d body=%s", tc.method, tc.path, rec.Code, rec.Body.String())
		}
	}
}
