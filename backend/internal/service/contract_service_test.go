package service

import (
	"strings"
	"testing"
	"time"

	"wurenji-backend/internal/config"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

func TestGenerateContractForOrderCreatesContractAndIncludesTrustClause(t *testing.T) {
	db := newServiceTestDB(t, &model.User{}, &model.Order{}, &model.OrderContract{})

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
	db := newServiceTestDB(t, &model.User{}, &model.Order{}, &model.OrderContract{})

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
}
