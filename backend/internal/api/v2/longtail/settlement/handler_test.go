package settlement

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
	"wurenji-backend/internal/service"
)

func newFinanceAuditTestHandler(t *testing.T) (*Handler, *gorm.DB) {
	t.Helper()

	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.OrderSettlement{},
		&model.FinanceManualActionRecord{},
		&model.AdminLog{},
	); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	orderRepo := repository.NewOrderRepo(db)
	settlementRepo := repository.NewSettlementRepo(db)
	migrationRepo := repository.NewMigrationRepo(db)
	settlementService := service.NewSettlementService(settlementRepo, orderRepo, zap.NewNop())
	opsService := service.NewOperationsService(migrationRepo, orderRepo)

	return NewHandler(settlementService, opsService), db
}

func TestFinanceAdminRouteWritesAuditLog(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler, db := newFinanceAuditTestHandler(t)

	settlement := &model.OrderSettlement{
		SettlementNo:       "STL-AUDIT-001",
		OrderID:            91,
		OrderNo:            "ORD-AUDIT-001",
		FinalAmount:        10000,
		PlatformFee:        1000,
		PilotFee:           4500,
		OwnerFee:           4000,
		InsuranceDeduction: 500,
		PilotUserID:        16,
		OwnerUserID:        7,
		PayerUserID:        4,
		Status:             "calculated",
	}
	if err := db.Create(settlement).Error; err != nil {
		t.Fatalf("create settlement: %v", err)
	}

	router := gin.New()
	router.POST("/settlements/:id/dispute", func(c *gin.Context) {
		c.Set("user_id", int64(99))
		handler.MarkSettlementDisputed(c)
	})

	reqBody := bytes.NewBufferString(`{"reason":"audit smoke"}`)
	req := httptest.NewRequest(http.MethodPost, "/settlements/1/dispute", reqBody)
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var log model.AdminLog
	if err := db.Where(
		"module = ? AND action = ? AND target_type = ? AND target_id = ?",
		"finance",
		"mark_settlement_disputed",
		"settlement",
		settlement.ID,
	).First(&log).Error; err != nil {
		t.Fatalf("load admin log: %v", err)
	}
	if log.AdminID != 99 {
		t.Fatalf("expected admin_id=99, got %d", log.AdminID)
	}

	var details map[string]interface{}
	if err := json.Unmarshal(log.Details, &details); err != nil {
		t.Fatalf("decode details: %v", err)
	}
	if details["reason"] != "audit smoke" || details["settlement_no"] != "STL-AUDIT-001" {
		t.Fatalf("unexpected log details: %#v", details)
	}
}
