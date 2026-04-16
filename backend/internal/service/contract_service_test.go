package service

import (
	"bytes"
	"strings"
	"testing"
	"time"

	"wurenji-backend/internal/config"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

func TestGenerateContractForOrderCreatesContractAndIncludesTrustClause(t *testing.T) {
	db := newServiceTestDB(t, &model.User{}, &model.Order{}, &model.OrderContract{}, &model.OrderTimeline{})

	userRepo := repository.NewUserRepo(db)
	orderRepo := repository.NewOrderRepo(db)
	contractRepo := repository.NewContractRepo(db)

	client := &model.User{ID: 201, Phone: "13800000201", Nickname: "客户甲", Status: "active"}
	provider := &model.User{ID: 202, Phone: "13800000202", Nickname: "机主乙", Status: "active"}
	if err := userRepo.Create(client); err != nil {
		t.Fatalf("create client: %v", err)
	}
	if err := userRepo.Create(provider); err != nil {
		t.Fatalf("create provider: %v", err)
	}

	startAt := time.Date(2026, 4, 16, 9, 0, 0, 0, time.Local)
	endAt := startAt.Add(3 * time.Hour)
	order := &model.Order{
		OrderNo:            "ORD202604150001",
		OrderType:          "cargo",
		OrderSource:        "supply_direct",
		ClientUserID:       client.ID,
		ProviderUserID:     provider.ID,
		Title:              "海岛补给吊运",
		ServiceAddress:     "珠海码头",
		DestAddress:        "桂山岛补给点",
		StartTime:          startAt,
		EndTime:            endAt,
		TotalAmount:        128000,
		PlatformCommission: 12800,
		OwnerAmount:        115200,
		Status:             "pending_payment",
	}
	if err := orderRepo.Create(order); err != nil {
		t.Fatalf("create order: %v", err)
	}

	service := NewContractService(contractRepo, orderRepo, userRepo, &config.Config{
		Payment: config.PaymentConfig{CommissionRate: 10},
	})

	contract, err := service.GenerateContractForOrder(order.ID)
	if err != nil {
		t.Fatalf("generate contract: %v", err)
	}
	if contract == nil || contract.OrderID != order.ID {
		t.Fatalf("expected contract for order %d, got %#v", order.ID, contract)
	}
	if !strings.Contains(contract.ContractHTML, "执行飞手具备合法资质并已确认设备操作责任声明") {
		t.Fatalf("expected trust clause in contract html, got %s", contract.ContractHTML)
	}
}

func TestProviderAutoSignMarksContractFullySignedAfterClientSign(t *testing.T) {
	db := newServiceTestDB(t, &model.User{}, &model.Order{}, &model.OrderContract{}, &model.OrderTimeline{})

	userRepo := repository.NewUserRepo(db)
	orderRepo := repository.NewOrderRepo(db)
	contractRepo := repository.NewContractRepo(db)

	client := &model.User{ID: 211, Phone: "13800000211", Nickname: "客户乙", Status: "active"}
	provider := &model.User{ID: 212, Phone: "13800000212", Nickname: "机主丙", Status: "active"}
	if err := userRepo.Create(client); err != nil {
		t.Fatalf("create client: %v", err)
	}
	if err := userRepo.Create(provider); err != nil {
		t.Fatalf("create provider: %v", err)
	}

	order := &model.Order{
		OrderNo:            "ORD202604150002",
		OrderType:          "cargo",
		OrderSource:        "demand_market",
		ClientUserID:       client.ID,
		ProviderUserID:     provider.ID,
		Title:              "山区物资吊运",
		ServiceAddress:     "韶关山脚仓",
		DestAddress:        "山顶作业点",
		TotalAmount:        98000,
		PlatformCommission: 9800,
		OwnerAmount:        88200,
		Status:             "paid",
	}
	if err := orderRepo.Create(order); err != nil {
		t.Fatalf("create order: %v", err)
	}

	service := NewContractService(contractRepo, orderRepo, userRepo, &config.Config{
		Payment: config.PaymentConfig{CommissionRate: 10},
	})

	contract, err := service.GenerateContractForOrder(order.ID)
	if err != nil {
		t.Fatalf("generate contract: %v", err)
	}
	signedByClient, err := service.SignContractByOrder(order.ID, client.ID)
	if err != nil {
		t.Fatalf("client sign contract: %v", err)
	}
	if signedByClient.ClientSignedAt == nil {
		t.Fatalf("expected client to be signed, got %#v", signedByClient)
	}
	if strings.Contains(signedByClient.ContractHTML, `<span id="client-sign-date">待签署</span>`) {
		t.Fatalf("expected client sign date to refresh in contract html, got %s", signedByClient.ContractHTML)
	}
	if !strings.Contains(signedByClient.ContractHTML, `<span id="provider-sign-date">待签署</span>`) {
		t.Fatalf("expected provider sign date to remain pending before auto sign, got %s", signedByClient.ContractHTML)
	}

	if err := service.ProviderAutoSign(db, order.ID, provider.ID); err != nil {
		t.Fatalf("provider auto sign: %v", err)
	}

	reloaded, err := contractRepo.GetByID(contract.ID)
	if err != nil {
		t.Fatalf("reload contract: %v", err)
	}
	if reloaded.ProviderSignedAt == nil {
		t.Fatalf("expected provider signed at to be filled, got %#v", reloaded)
	}
	if reloaded.Status != "fully_signed" {
		t.Fatalf("expected fully signed status, got %s", reloaded.Status)
	}
	if strings.Contains(reloaded.ContractHTML, `<span id="provider-sign-date">待签署</span>`) {
		t.Fatalf("expected provider sign date to refresh in contract html, got %s", reloaded.ContractHTML)
	}
	if strings.Contains(reloaded.ContractHTML, "待双方完成签署后生效") {
		t.Fatalf("expected effective date footer after both sides signed, got %s", reloaded.ContractHTML)
	}
}

func TestGetContractByOrderRefreshesLegacyPendingSignPlaceholders(t *testing.T) {
	db := newServiceTestDB(t, &model.User{}, &model.Order{}, &model.OrderContract{})

	userRepo := repository.NewUserRepo(db)
	orderRepo := repository.NewOrderRepo(db)
	contractRepo := repository.NewContractRepo(db)

	client := &model.User{ID: 221, Phone: "13800000221", Nickname: "客户丙", Status: "active"}
	provider := &model.User{ID: 222, Phone: "13800000222", Nickname: "机主丁", Status: "active"}
	if err := userRepo.Create(client); err != nil {
		t.Fatalf("create client: %v", err)
	}
	if err := userRepo.Create(provider); err != nil {
		t.Fatalf("create provider: %v", err)
	}

	order := &model.Order{
		OrderNo:            "ORD202604150003",
		OrderType:          "cargo",
		OrderSource:        "supply_direct",
		ClientUserID:       client.ID,
		ProviderUserID:     provider.ID,
		Title:              "景区设备吊装",
		ServiceAddress:     "山脚集合点",
		DestAddress:        "景区山顶",
		TotalAmount:        56000,
		PlatformCommission: 5600,
		OwnerAmount:        50400,
		Status:             "completed",
	}
	if err := orderRepo.Create(order); err != nil {
		t.Fatalf("create order: %v", err)
	}

	service := NewContractService(contractRepo, orderRepo, userRepo, &config.Config{
		Payment: config.PaymentConfig{CommissionRate: 10},
	})

	contract, err := service.GenerateContractForOrder(order.ID)
	if err != nil {
		t.Fatalf("generate contract: %v", err)
	}

	clientSignedAt := time.Date(2026, 4, 15, 10, 30, 0, 0, time.Local)
	providerSignedAt := clientSignedAt.Add(45 * time.Minute)
	if err := contractRepo.UpdateFields(contract.ID, map[string]interface{}{
		"client_signed_at":   &clientSignedAt,
		"provider_signed_at": &providerSignedAt,
		"status":             "fully_signed",
		"updated_at":         providerSignedAt,
	}); err != nil {
		t.Fatalf("seed signed contract: %v", err)
	}

	refreshed, err := service.GetContractByOrder(order.ID)
	if err != nil {
		t.Fatalf("get contract by order: %v", err)
	}
	if strings.Contains(refreshed.ContractHTML, `<span id="client-sign-date">待签署</span>`) ||
		strings.Contains(refreshed.ContractHTML, `<span id="provider-sign-date">待签署</span>`) {
		t.Fatalf("expected stale placeholders to be refreshed, got %s", refreshed.ContractHTML)
	}
	if !strings.Contains(refreshed.ContractHTML, "生效日期：2026-04-15") {
		t.Fatalf("expected effective date in refreshed contract html, got %s", refreshed.ContractHTML)
	}
}

func TestGenerateContractPDFDownloadTokenRoundTrip(t *testing.T) {
	service := NewContractService(nil, nil, nil, &config.Config{
		JWT: config.JWTConfig{Secret: "12345678901234567890123456789012"},
	})

	token, expiresAt, err := service.GenerateContractPDFDownloadToken(88, 66)
	if err != nil {
		t.Fatalf("generate download token: %v", err)
	}
	if token == "" {
		t.Fatalf("expected non-empty token")
	}
	if expiresAt.Before(time.Now()) {
		t.Fatalf("expected future expiresAt, got %v", expiresAt)
	}

	userID, orderID, err := service.ParseContractPDFDownloadToken(token)
	if err != nil {
		t.Fatalf("parse download token: %v", err)
	}
	if userID != 66 || orderID != 88 {
		t.Fatalf("unexpected token payload: user=%d order=%d", userID, orderID)
	}
}

func TestBuildContractPDFByOrderProducesPDFBytes(t *testing.T) {
	if _, err := resolveContractPDFFontPath(); err != nil {
		t.Skipf("skip pdf generation test: %v", err)
	}

	db := newServiceTestDB(t, &model.User{}, &model.Order{}, &model.OrderContract{})

	userRepo := repository.NewUserRepo(db)
	orderRepo := repository.NewOrderRepo(db)
	contractRepo := repository.NewContractRepo(db)

	client := &model.User{ID: 231, Phone: "13800000231", Nickname: "客户丁", Status: "active"}
	provider := &model.User{ID: 232, Phone: "13800000232", Nickname: "机主戊", Status: "active"}
	if err := userRepo.Create(client); err != nil {
		t.Fatalf("create client: %v", err)
	}
	if err := userRepo.Create(provider); err != nil {
		t.Fatalf("create provider: %v", err)
	}

	order := &model.Order{
		OrderNo:            "ORD202604150004",
		OrderType:          "cargo",
		OrderSource:        "supply_direct",
		ClientUserID:       client.ID,
		ProviderUserID:     provider.ID,
		Title:              "山地设备紧急转运",
		ServiceAddress:     "仓储基地",
		DestAddress:        "山顶施工点",
		TotalAmount:        76000,
		PlatformCommission: 7600,
		OwnerAmount:        68400,
		Status:             "completed",
	}
	if err := orderRepo.Create(order); err != nil {
		t.Fatalf("create order: %v", err)
	}

	service := NewContractService(contractRepo, orderRepo, userRepo, &config.Config{
		JWT:     config.JWTConfig{Secret: "12345678901234567890123456789012"},
		Payment: config.PaymentConfig{CommissionRate: 10},
	})

	contract, err := service.GenerateContractForOrder(order.ID)
	if err != nil {
		t.Fatalf("generate contract: %v", err)
	}
	clientSignedAt := time.Date(2026, 4, 15, 11, 0, 0, 0, time.Local)
	if err := contractRepo.UpdateFields(contract.ID, map[string]interface{}{
		"client_signed_at": &clientSignedAt,
		"status":           "client_signed",
		"updated_at":       clientSignedAt,
	}); err != nil {
		t.Fatalf("seed signed contract: %v", err)
	}

	pdfBytes, refreshedContract, err := service.BuildContractPDFByOrder(order.ID)
	if err != nil {
		t.Fatalf("build contract pdf: %v", err)
	}
	if refreshedContract == nil || refreshedContract.ID == 0 {
		t.Fatalf("expected refreshed contract in pdf build")
	}
	if len(pdfBytes) == 0 {
		t.Fatalf("expected non-empty pdf bytes")
	}
	if !bytes.HasPrefix(pdfBytes, []byte("%PDF")) {
		t.Fatalf("expected PDF header, got %q", pdfBytes[:4])
	}
}
