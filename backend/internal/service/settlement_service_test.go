package service

import (
	"bytes"
	"encoding/csv"
	"strings"
	"testing"
	"time"

	"go.uber.org/zap"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

func newSettlementServiceTest(t *testing.T) (*SettlementService, *repository.OrderRepo, *repository.SettlementRepo) {
	t.Helper()

	db := newServiceTestDB(
		t,
		&model.Order{},
		&model.OrderSettlement{},
		&model.PricingConfig{},
		&model.Review{},
		&model.FinanceManualActionRecord{},
	)
	orderRepo := repository.NewOrderRepo(db)
	settlementRepo := repository.NewSettlementRepo(db)
	return NewSettlementService(settlementRepo, orderRepo, zap.NewNop()), orderRepo, settlementRepo
}

func TestCreateSettlementUsesExecutionUserIDs(t *testing.T) {
	service, orderRepo, _ := newSettlementServiceTest(t)

	order := &model.Order{
		OrderNo:             "ORD-SETTLE-USER-001",
		OrderType:           "cargo",
		OrderSource:         "demand_market",
		Status:              "completed",
		TotalAmount:         168000,
		PilotID:             5,
		ExecutorPilotUserID: 16,
		ProviderUserID:      7,
		DroneOwnerUserID:    0,
		OwnerID:             0,
		ClientUserID:        4,
		RenterID:            4,
		CargoWeightKG:       80,
	}
	if err := orderRepo.Create(order); err != nil {
		t.Fatalf("create order: %v", err)
	}

	settlement, err := service.CreateSettlement(order.ID)
	if err != nil {
		t.Fatalf("create settlement: %v", err)
	}

	if settlement.PilotUserID != 16 {
		t.Fatalf("expected pilot_user_id to use executor user 16, got %d", settlement.PilotUserID)
	}
	if settlement.OwnerUserID != 7 {
		t.Fatalf("expected owner_user_id to use provider user 7, got %d", settlement.OwnerUserID)
	}
	if settlement.PayerUserID != 4 {
		t.Fatalf("expected payer_user_id to use client user 4, got %d", settlement.PayerUserID)
	}
	if settlement.PlatformFee != 16800 || settlement.InsuranceDeduction != 8400 {
		t.Fatalf("unexpected platform/insurance fees: %d %d", settlement.PlatformFee, settlement.InsuranceDeduction)
	}
	if settlement.PilotFee != 75600 || settlement.OwnerFee != 67200 {
		t.Fatalf("unexpected split fees: pilot=%d owner=%d", settlement.PilotFee, settlement.OwnerFee)
	}
}

func TestCalculatedSettlementIsRepairedOnRead(t *testing.T) {
	service, orderRepo, settlementRepo := newSettlementServiceTest(t)

	order := &model.Order{
		OrderNo:             "ORD-SETTLE-REPAIR-001",
		OrderType:           "cargo",
		OrderSource:         "demand_market",
		Status:              "completed",
		TotalAmount:         168000,
		PilotID:             5,
		ExecutorPilotUserID: 16,
		ProviderUserID:      7,
		ClientUserID:        4,
		RenterID:            4,
	}
	if err := orderRepo.Create(order); err != nil {
		t.Fatalf("create order: %v", err)
	}
	existing := &model.OrderSettlement{
		SettlementNo: "STL-REPAIR-001",
		OrderID:      order.ID,
		OrderNo:      order.OrderNo,
		TotalAmount:  168000,
		FinalAmount:  168000,
		PilotUserID:  5,
		OwnerUserID:  7,
		PayerUserID:  4,
		Status:       "calculated",
	}
	if err := settlementRepo.CreateSettlement(existing); err != nil {
		t.Fatalf("create existing settlement: %v", err)
	}

	repaired, err := service.GetSettlementByOrder(order.ID)
	if err != nil {
		t.Fatalf("get settlement: %v", err)
	}

	if repaired.ID != existing.ID || repaired.SettlementNo != existing.SettlementNo {
		t.Fatalf("expected repair to keep original identity, got id=%d no=%s", repaired.ID, repaired.SettlementNo)
	}
	if repaired.PilotUserID != 16 {
		t.Fatalf("expected repaired pilot_user_id=16, got %d", repaired.PilotUserID)
	}
	if repaired.PilotFee != 75600 || repaired.OwnerFee != 67200 {
		t.Fatalf("expected repaired split fees, got pilot=%d owner=%d", repaired.PilotFee, repaired.OwnerFee)
	}
}

func TestFinalizeOrderSettlementCreditsWalletsOnce(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.Order{},
		&model.OrderSettlement{},
		&model.UserWallet{},
		&model.WalletTransaction{},
		&model.PricingConfig{},
		&model.Review{},
		&model.FinanceManualActionRecord{},
	)
	orderRepo := repository.NewOrderRepo(db)
	service := NewSettlementService(repository.NewSettlementRepo(db), orderRepo, zap.NewNop())

	order := &model.Order{
		OrderNo:             "ORD-SETTLE-FINALIZE-001",
		OrderType:           "cargo",
		OrderSource:         "demand_market",
		Status:              "completed",
		TotalAmount:         168000,
		ExecutorPilotUserID: 16,
		ProviderUserID:      7,
		ClientUserID:        4,
		RenterID:            4,
	}
	if err := orderRepo.Create(order); err != nil {
		t.Fatalf("create order: %v", err)
	}

	settlement, err := service.FinalizeOrderSettlement(order.ID)
	if err != nil {
		t.Fatalf("finalize settlement: %v", err)
	}
	if settlement.Status != "settled" {
		t.Fatalf("expected settled status, got %s", settlement.Status)
	}

	settlementAgain, err := service.FinalizeOrderSettlement(order.ID)
	if err != nil {
		t.Fatalf("finalize settlement again: %v", err)
	}
	if settlementAgain.ID != settlement.ID || settlementAgain.Status != "settled" {
		t.Fatalf("expected same settled settlement, got %#v", settlementAgain)
	}

	var pilotWallet model.UserWallet
	if err := db.Where("user_id = ?", int64(16)).First(&pilotWallet).Error; err != nil {
		t.Fatalf("load pilot wallet: %v", err)
	}
	if pilotWallet.AvailableBalance != 75600 || pilotWallet.TotalIncome != 75600 {
		t.Fatalf("expected pilot wallet 75600 once, got available=%d income=%d", pilotWallet.AvailableBalance, pilotWallet.TotalIncome)
	}

	var ownerWallet model.UserWallet
	if err := db.Where("user_id = ?", int64(7)).First(&ownerWallet).Error; err != nil {
		t.Fatalf("load owner wallet: %v", err)
	}
	if ownerWallet.AvailableBalance != 67200 || ownerWallet.TotalIncome != 67200 {
		t.Fatalf("expected owner wallet 67200 once, got available=%d income=%d", ownerWallet.AvailableBalance, ownerWallet.TotalIncome)
	}

	var txCount int64
	if err := db.Model(&model.WalletTransaction{}).Where("related_settlement_id = ?", settlement.ID).Count(&txCount).Error; err != nil {
		t.Fatalf("count wallet transactions: %v", err)
	}
	if txCount != 2 {
		t.Fatalf("expected exactly 2 wallet transactions, got %d", txCount)
	}
}

func TestExecuteSettlementIsIdempotentAfterPartialIncome(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.OrderSettlement{},
		&model.UserWallet{},
		&model.WalletTransaction{},
	)
	settlementRepo := repository.NewSettlementRepo(db)
	service := NewSettlementService(settlementRepo, repository.NewOrderRepo(db), zap.NewNop())

	settlement := &model.OrderSettlement{
		SettlementNo:       "STL-IDEMPOTENT-001",
		OrderID:            201,
		OrderNo:            "ORD-IDEMPOTENT-001",
		Status:             "confirmed",
		FinalAmount:        168000,
		PlatformFee:        16800,
		PilotFee:           75600,
		OwnerFee:           67200,
		InsuranceDeduction: 8400,
		PilotUserID:        16,
		OwnerUserID:        7,
		PayerUserID:        4,
	}
	if err := db.Create(settlement).Error; err != nil {
		t.Fatalf("create settlement: %v", err)
	}

	if err := settlementRepo.AddWalletIncome(
		settlement.PilotUserID,
		settlement.PilotFee,
		settlement.OrderID,
		settlement.ID,
		"订单ORD-IDEMPOTENT-001履约服务费",
	); err != nil {
		t.Fatalf("seed partial pilot income: %v", err)
	}

	if err := service.ExecuteSettlement(settlement.ID); err != nil {
		t.Fatalf("execute settlement: %v", err)
	}

	var pilotWallet model.UserWallet
	if err := db.Where("user_id = ?", int64(16)).First(&pilotWallet).Error; err != nil {
		t.Fatalf("load pilot wallet: %v", err)
	}
	if pilotWallet.AvailableBalance != 75600 || pilotWallet.TotalIncome != 75600 {
		t.Fatalf("expected pilot income not duplicated, got %#v", pilotWallet)
	}

	var ownerWallet model.UserWallet
	if err := db.Where("user_id = ?", int64(7)).First(&ownerWallet).Error; err != nil {
		t.Fatalf("load owner wallet: %v", err)
	}
	if ownerWallet.AvailableBalance != 67200 || ownerWallet.TotalIncome != 67200 {
		t.Fatalf("expected owner income credited once, got %#v", ownerWallet)
	}

	var txCount int64
	if err := db.Model(&model.WalletTransaction{}).Where("related_settlement_id = ?", settlement.ID).Count(&txCount).Error; err != nil {
		t.Fatalf("count wallet transactions: %v", err)
	}
	if txCount != 2 {
		t.Fatalf("expected two settlement wallet transactions, got %d", txCount)
	}

	var settled model.OrderSettlement
	if err := db.First(&settled, settlement.ID).Error; err != nil {
		t.Fatalf("load settlement: %v", err)
	}
	if settled.Status != "settled" || settled.SettledAt == nil {
		t.Fatalf("expected settlement marked settled, got %#v", settled)
	}
}

func TestExecuteSettlementConflictRecordsFinanceAnomaly(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.OrderSettlement{},
		&model.UserWallet{},
		&model.WalletTransaction{},
		&model.FinanceAnomalyRecord{},
	)
	settlementRepo := repository.NewSettlementRepo(db)
	service := NewSettlementService(settlementRepo, repository.NewOrderRepo(db), zap.NewNop())

	settlement := &model.OrderSettlement{
		SettlementNo:       "STL-ANOMALY-001",
		OrderID:            301,
		OrderNo:            "ORD-ANOMALY-001",
		Status:             "confirmed",
		FinalAmount:        168000,
		PlatformFee:        16800,
		PilotFee:           75600,
		OwnerFee:           67200,
		InsuranceDeduction: 8400,
		PilotUserID:        16,
		OwnerUserID:        7,
		PayerUserID:        4,
	}
	if err := db.Create(settlement).Error; err != nil {
		t.Fatalf("create settlement: %v", err)
	}

	if err := settlementRepo.AddWalletIncome(
		settlement.PilotUserID,
		1,
		settlement.OrderID,
		settlement.ID,
		"订单ORD-ANOMALY-001履约服务费",
	); err != nil {
		t.Fatalf("seed conflicting pilot income: %v", err)
	}

	err := service.ExecuteSettlement(settlement.ID)
	if err == nil || !strings.Contains(err.Error(), "金额或订单不一致") {
		t.Fatalf("expected conflict error, got %v", err)
	}

	var anomaly model.FinanceAnomalyRecord
	if err := db.Where("settlement_id = ? AND anomaly_type = ?", settlement.ID, "settlement_execute_failed").First(&anomaly).Error; err != nil {
		t.Fatalf("load finance anomaly: %v", err)
	}
	if anomaly.Status != "open" || anomaly.Severity != "critical" || anomaly.TargetType != "settlement" || anomaly.TargetID != settlement.ID {
		t.Fatalf("unexpected anomaly record: %#v", anomaly)
	}
	if !strings.Contains(anomaly.Message, "履约服务入账失败") {
		t.Fatalf("expected anomaly message to include failure context, got %q", anomaly.Message)
	}

	var txCount int64
	if err := db.Model(&model.WalletTransaction{}).Where("related_settlement_id = ?", settlement.ID).Count(&txCount).Error; err != nil {
		t.Fatalf("count wallet transactions: %v", err)
	}
	if txCount != 1 {
		t.Fatalf("expected only seeded conflicting transaction, got %d", txCount)
	}
}

func TestSettlementDisputeResolutionAllowsManualFeeAdjustment(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.Order{},
		&model.OrderSettlement{},
		&model.UserWallet{},
		&model.WalletTransaction{},
		&model.PricingConfig{},
		&model.Review{},
		&model.FinanceManualActionRecord{},
	)
	orderRepo := repository.NewOrderRepo(db)
	service := NewSettlementService(repository.NewSettlementRepo(db), orderRepo, zap.NewNop())

	order := &model.Order{
		OrderNo:             "ORD-SETTLE-DISPUTE-001",
		OrderType:           "cargo",
		OrderSource:         "demand_market",
		Status:              "completed",
		TotalAmount:         168000,
		ExecutorPilotUserID: 16,
		ProviderUserID:      7,
		ClientUserID:        4,
		RenterID:            4,
	}
	if err := orderRepo.Create(order); err != nil {
		t.Fatalf("create order: %v", err)
	}

	settlement, err := service.CreateSettlement(order.ID)
	if err != nil {
		t.Fatalf("create settlement: %v", err)
	}
	disputed, err := service.MarkSettlementDisputed(settlement.ID, 1, "分账金额待复核")
	if err != nil {
		t.Fatalf("mark disputed: %v", err)
	}
	if disputed.Status != "disputed" || !strings.Contains(disputed.Notes, "分账金额待复核") {
		t.Fatalf("unexpected disputed settlement: %#v", disputed)
	}
	if _, err := service.FinalizeSettlement(settlement.ID); err == nil || !strings.Contains(err.Error(), "争议") {
		t.Fatalf("expected disputed settlement to block finalization, got %v", err)
	}

	if _, err := service.ResolveSettlementDispute(settlement.ID, 1, SettlementDisputeResolution{
		Resolution:         "错误合计",
		NextStatus:         "confirmed",
		PlatformFee:        int64Ptr(18000),
		PilotFee:           int64Ptr(80000),
		OwnerFee:           int64Ptr(62000),
		InsuranceDeduction: int64Ptr(9000),
	}); err == nil || !strings.Contains(err.Error(), "合计必须等于实付金额") {
		t.Fatalf("expected invalid fee total error, got %v", err)
	}

	resolved, err := service.ResolveSettlementDispute(settlement.ID, 1, SettlementDisputeResolution{
		Resolution:         "按人工复核分账执行",
		NextStatus:         "confirmed",
		PlatformFee:        int64Ptr(18000),
		PilotFee:           int64Ptr(80000),
		OwnerFee:           int64Ptr(62000),
		InsuranceDeduction: int64Ptr(8000),
	})
	if err != nil {
		t.Fatalf("resolve dispute: %v", err)
	}
	if resolved.Status != "confirmed" || resolved.ConfirmedAt == nil {
		t.Fatalf("expected confirmed settlement, got %#v", resolved)
	}
	if resolved.PlatformFee != 18000 || resolved.PilotFee != 80000 || resolved.OwnerFee != 62000 || resolved.InsuranceDeduction != 8000 {
		t.Fatalf("expected manual fee adjustment, got %#v", resolved)
	}
	if !strings.Contains(resolved.Notes, "按人工复核分账执行") {
		t.Fatalf("expected resolution note, got %q", resolved.Notes)
	}

	finalized, err := service.FinalizeSettlement(settlement.ID)
	if err != nil {
		t.Fatalf("finalize resolved settlement: %v", err)
	}
	if finalized.Status != "settled" {
		t.Fatalf("expected settled status, got %s", finalized.Status)
	}

	var pilotWallet model.UserWallet
	if err := db.Where("user_id = ?", int64(16)).First(&pilotWallet).Error; err != nil {
		t.Fatalf("load pilot wallet: %v", err)
	}
	if pilotWallet.AvailableBalance != 80000 || pilotWallet.TotalIncome != 80000 {
		t.Fatalf("expected adjusted pilot income, got %#v", pilotWallet)
	}
	var ownerWallet model.UserWallet
	if err := db.Where("user_id = ?", int64(7)).First(&ownerWallet).Error; err != nil {
		t.Fatalf("load owner wallet: %v", err)
	}
	if ownerWallet.AvailableBalance != 62000 || ownerWallet.TotalIncome != 62000 {
		t.Fatalf("expected adjusted owner income, got %#v", ownerWallet)
	}
}

func TestResolveSettlementDisputeFeeMismatchRecordsFinanceAnomaly(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.OrderSettlement{},
		&model.FinanceAnomalyRecord{},
	)
	service := NewSettlementService(repository.NewSettlementRepo(db), repository.NewOrderRepo(db), zap.NewNop())

	settlement := &model.OrderSettlement{
		SettlementNo:       "STL-MISMATCH-001",
		OrderID:            401,
		OrderNo:            "ORD-MISMATCH-001",
		Status:             "disputed",
		FinalAmount:        100000,
		PlatformFee:        10000,
		PilotFee:           45000,
		OwnerFee:           40000,
		InsuranceDeduction: 5000,
		PilotUserID:        16,
		OwnerUserID:        7,
		PayerUserID:        4,
	}
	if err := db.Create(settlement).Error; err != nil {
		t.Fatalf("create settlement: %v", err)
	}

	_, err := service.ResolveSettlementDispute(settlement.ID, 1, SettlementDisputeResolution{
		Resolution:         "金额合计测试",
		NextStatus:         "confirmed",
		PlatformFee:        int64Ptr(10000),
		PilotFee:           int64Ptr(45000),
		OwnerFee:           int64Ptr(35000),
		InsuranceDeduction: int64Ptr(5000),
	})
	if err == nil || !strings.Contains(err.Error(), "合计必须等于实付金额") {
		t.Fatalf("expected fee mismatch error, got %v", err)
	}

	var anomaly model.FinanceAnomalyRecord
	if err := db.Where("settlement_id = ? AND anomaly_type = ?", settlement.ID, "settlement_split_mismatch").First(&anomaly).Error; err != nil {
		t.Fatalf("load finance anomaly: %v", err)
	}
	if anomaly.Status != "open" || anomaly.Severity != "warning" || anomaly.Source != "settlement" {
		t.Fatalf("unexpected anomaly record: %#v", anomaly)
	}

	var unchanged model.OrderSettlement
	if err := db.First(&unchanged, settlement.ID).Error; err != nil {
		t.Fatalf("load settlement: %v", err)
	}
	if unchanged.Status != "disputed" || unchanged.OwnerFee != 40000 {
		t.Fatalf("expected settlement unchanged after mismatch, got %#v", unchanged)
	}
}

func TestSettlementDisputeResolveManualActionCanRollback(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.OrderSettlement{},
		&model.FinanceManualActionRecord{},
	)
	service := NewSettlementService(repository.NewSettlementRepo(db), repository.NewOrderRepo(db), zap.NewNop())

	settlement := &model.OrderSettlement{
		SettlementNo:       "STL-ROLLBACK-001",
		OrderID:            501,
		OrderNo:            "ORD-ROLLBACK-001",
		Status:             "disputed",
		FinalAmount:        100000,
		PlatformFee:        10000,
		PilotFee:           45000,
		OwnerFee:           40000,
		InsuranceDeduction: 5000,
		PilotUserID:        16,
		OwnerUserID:        7,
		PayerUserID:        4,
		Notes:              "初始争议",
	}
	if err := db.Create(settlement).Error; err != nil {
		t.Fatalf("create settlement: %v", err)
	}

	resolved, err := service.ResolveSettlementDispute(settlement.ID, 1, SettlementDisputeResolution{
		Resolution:         "人工调整后待执行",
		NextStatus:         "confirmed",
		PlatformFee:        int64Ptr(12000),
		PilotFee:           int64Ptr(43000),
		OwnerFee:           int64Ptr(40000),
		InsuranceDeduction: int64Ptr(5000),
	})
	if err != nil {
		t.Fatalf("resolve dispute: %v", err)
	}
	if resolved.Status != "confirmed" || resolved.PlatformFee != 12000 || resolved.PilotFee != 43000 {
		t.Fatalf("unexpected resolved settlement: %#v", resolved)
	}

	var action model.FinanceManualActionRecord
	if err := db.Where("settlement_id = ? AND action_type = ?", settlement.ID, "settlement_dispute_resolve").First(&action).Error; err != nil {
		t.Fatalf("load manual action: %v", err)
	}

	rolledBack, err := service.RollbackFinanceManualAction(action.ID, 2, "金额录入错误")
	if err != nil {
		t.Fatalf("rollback manual action: %v", err)
	}
	if rolledBack.Status != "rolled_back" || rolledBack.RollbackBy != 2 || rolledBack.RollbackAt == nil {
		t.Fatalf("unexpected rollback record: %#v", rolledBack)
	}

	var restored model.OrderSettlement
	if err := db.First(&restored, settlement.ID).Error; err != nil {
		t.Fatalf("load restored settlement: %v", err)
	}
	if restored.Status != "disputed" || restored.PlatformFee != 10000 || restored.PilotFee != 45000 || restored.Notes != "初始争议" {
		t.Fatalf("expected settlement restored to before snapshot, got %#v", restored)
	}
}

func TestFinanceAnomalyResolveManualActionCanRollback(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.FinanceAnomalyRecord{},
		&model.FinanceManualActionRecord{},
	)
	service := NewSettlementService(repository.NewSettlementRepo(db), repository.NewOrderRepo(db), zap.NewNop())

	anomaly := &model.FinanceAnomalyRecord{
		AnomalyNo:    "FAN-ROLLBACK-001",
		AnomalyType:  "settlement_execute_failed",
		Severity:     "critical",
		Status:       "open",
		Source:       "settlement",
		TargetType:   "settlement",
		TargetID:     9,
		SettlementID: 9,
		Message:      "结算入账失败",
	}
	if err := db.Create(anomaly).Error; err != nil {
		t.Fatalf("create anomaly: %v", err)
	}

	resolved, err := service.ResolveFinanceAnomaly(anomaly.ID, 1, "已人工核对")
	if err != nil {
		t.Fatalf("resolve anomaly: %v", err)
	}
	if resolved.Status != "resolved" || resolved.ResolvedBy != 1 || resolved.ResolutionNote != "已人工核对" {
		t.Fatalf("unexpected resolved anomaly: %#v", resolved)
	}

	var action model.FinanceManualActionRecord
	if err := db.Where("anomaly_id = ? AND action_type = ?", anomaly.ID, "finance_anomaly_resolve").First(&action).Error; err != nil {
		t.Fatalf("load manual action: %v", err)
	}

	if _, err := service.RollbackFinanceManualAction(action.ID, 2, "异常仍需处理"); err != nil {
		t.Fatalf("rollback anomaly resolve: %v", err)
	}

	var reopened model.FinanceAnomalyRecord
	if err := db.First(&reopened, anomaly.ID).Error; err != nil {
		t.Fatalf("load reopened anomaly: %v", err)
	}
	if reopened.Status != "open" || reopened.ResolvedBy != 0 || reopened.ResolvedAt != nil || reopened.ResolutionNote != "" {
		t.Fatalf("expected anomaly reopened, got %#v", reopened)
	}
}

func TestReconciliationCSVExportsFilterByStatusAndDate(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.OrderSettlement{},
		&model.WithdrawalRecord{},
	)
	service := NewSettlementService(repository.NewSettlementRepo(db), repository.NewOrderRepo(db), zap.NewNop())

	inRange := time.Date(2026, 5, 23, 10, 0, 0, 0, time.UTC)
	outOfRange := time.Date(2026, 5, 20, 10, 0, 0, 0, time.UTC)
	if err := db.Create(&model.OrderSettlement{
		SettlementNo:       "STL-EXPORT-1",
		OrderID:            101,
		OrderNo:            "ORD-EXPORT-1",
		Status:             "settled",
		FinalAmount:        198000,
		PlatformFee:        20000,
		PilotFee:           90000,
		OwnerFee:           78000,
		InsuranceDeduction: 10000,
		PilotUserID:        17,
		OwnerUserID:        7,
		PayerUserID:        4,
		CreatedAt:          inRange,
	}).Error; err != nil {
		t.Fatalf("seed settlement: %v", err)
	}
	if err := db.Create(&model.OrderSettlement{
		SettlementNo: "STL-EXPORT-2",
		OrderID:      102,
		OrderNo:      "ORD-EXPORT-2",
		Status:       "calculated",
		FinalAmount:  1000,
		CreatedAt:    inRange,
	}).Error; err != nil {
		t.Fatalf("seed status-filtered settlement: %v", err)
	}
	if err := db.Create(&model.OrderSettlement{
		SettlementNo: "STL-EXPORT-3",
		OrderID:      103,
		OrderNo:      "ORD-EXPORT-3",
		Status:       "settled",
		FinalAmount:  2000,
		CreatedAt:    outOfRange,
	}).Error; err != nil {
		t.Fatalf("seed date-filtered settlement: %v", err)
	}
	settledAt := inRange.Add(4 * time.Hour)
	if err := db.Create(&model.OrderSettlement{
		SettlementNo: "STL-EXPORT-4",
		OrderID:      104,
		OrderNo:      "ORD-EXPORT-4",
		Status:       "settled",
		FinalAmount:  3000,
		PilotFee:     1200,
		OwnerFee:     1100,
		CreatedAt:    outOfRange,
		SettledAt:    &settledAt,
	}).Error; err != nil {
		t.Fatalf("seed settled-at-filtered settlement: %v", err)
	}

	start := time.Date(2026, 5, 23, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 5, 24, 0, 0, 0, 0, time.UTC)
	settlementCSV, err := service.ExportSettlementReconciliationCSV(ReconciliationExportFilter{
		Status:  "settled",
		StartAt: &start,
		EndAt:   &end,
		Limit:   10,
	})
	if err != nil {
		t.Fatalf("export settlement csv: %v", err)
	}
	settlementRows := readCSVRows(t, settlementCSV)
	if len(settlementRows) != 2 {
		t.Fatalf("expected header + 1 settlement row, got %#v", settlementRows)
	}
	if settlementRows[0][1] != "结算单号" || settlementRows[1][1] != "STL-EXPORT-1" || settlementRows[1][7] != "90000" {
		t.Fatalf("unexpected settlement csv rows: %#v", settlementRows)
	}

	settledAtCSV, err := service.ExportSettlementReconciliationCSV(ReconciliationExportFilter{
		Status:    "settled",
		TimeField: "settled_at",
		StartAt:   &start,
		EndAt:     &end,
		Limit:     10,
	})
	if err != nil {
		t.Fatalf("export settlement csv by settled_at: %v", err)
	}
	settledAtRows := readCSVRows(t, settledAtCSV)
	if len(settledAtRows) != 2 || settledAtRows[1][1] != "STL-EXPORT-4" || settledAtRows[1][7] != "1200" {
		t.Fatalf("unexpected settled_at-filtered settlement csv rows: %#v", settledAtRows)
	}
	settlementList, settlementTotal, err := service.ListSettlementsFiltered(ReconciliationExportFilter{
		Status:    "settled",
		TimeField: "settled_at",
		StartAt:   &start,
		EndAt:     &end,
	}, 1, 20)
	if err != nil {
		t.Fatalf("list filtered settlements: %v", err)
	}
	if settlementTotal != 1 || len(settlementList) != 1 || settlementList[0].SettlementNo != "STL-EXPORT-4" {
		t.Fatalf("unexpected filtered settlement list total=%d list=%#v", settlementTotal, settlementList)
	}

	reviewedAt := inRange.Add(time.Hour)
	completedAt := inRange.Add(2 * time.Hour)
	if err := db.Create(&model.WithdrawalRecord{
		WithdrawalNo:   "WD-EXPORT-1",
		UserID:         17,
		WalletID:       1,
		Amount:         20000,
		ServiceFee:     100,
		ActualAmount:   19900,
		WithdrawMethod: "alipay",
		Status:         "completed",
		ReviewedBy:     1,
		ReviewedAt:     &reviewedAt,
		CompletedAt:    &completedAt,
		ThirdPartyNo:   "MOCK-WD-EXPORT-1",
		CreatedAt:      inRange,
	}).Error; err != nil {
		t.Fatalf("seed withdrawal: %v", err)
	}
	if err := db.Create(&model.WithdrawalRecord{
		WithdrawalNo:   "WD-EXPORT-2",
		UserID:         7,
		WalletID:       2,
		Amount:         30000,
		WithdrawMethod: "bank_card",
		Status:         "pending",
		CreatedAt:      inRange,
	}).Error; err != nil {
		t.Fatalf("seed status-filtered withdrawal: %v", err)
	}
	if err := db.Create(&model.WithdrawalRecord{
		WithdrawalNo:   "WD-EXPORT-3",
		UserID:         7,
		WalletID:       2,
		Amount:         30000,
		WithdrawMethod: "bank_card",
		Status:         "completed",
		CreatedAt:      outOfRange,
	}).Error; err != nil {
		t.Fatalf("seed date-filtered withdrawal: %v", err)
	}

	withdrawalCSV, err := service.ExportWithdrawalReconciliationCSV(ReconciliationExportFilter{
		Status:  "completed",
		StartAt: &start,
		EndAt:   &end,
		Limit:   10,
	})
	if err != nil {
		t.Fatalf("export withdrawal csv: %v", err)
	}
	withdrawalRows := readCSVRows(t, withdrawalCSV)
	if len(withdrawalRows) != 2 {
		t.Fatalf("expected header + 1 withdrawal row, got %#v", withdrawalRows)
	}
	if withdrawalRows[0][1] != "提现单号" || withdrawalRows[1][1] != "WD-EXPORT-1" || withdrawalRows[1][7] != "19900" {
		t.Fatalf("unexpected withdrawal csv rows: %#v", withdrawalRows)
	}
	withdrawalList, withdrawalTotal, err := service.ListWithdrawalsFiltered(ReconciliationExportFilter{
		Status:    "completed",
		TimeField: "completed_at",
		StartAt:   &start,
		EndAt:     &end,
	}, 1, 20)
	if err != nil {
		t.Fatalf("list filtered withdrawals: %v", err)
	}
	if withdrawalTotal != 1 || len(withdrawalList) != 1 || withdrawalList[0].WithdrawalNo != "WD-EXPORT-1" {
		t.Fatalf("unexpected filtered withdrawal list total=%d list=%#v", withdrawalTotal, withdrawalList)
	}
}

func TestWithdrawalApproveDeductsFrozenBalanceAtomically(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.UserWallet{},
		&model.WalletTransaction{},
		&model.WithdrawalRecord{},
	)
	service := NewSettlementService(repository.NewSettlementRepo(db), repository.NewOrderRepo(db), zap.NewNop())

	wallet := &model.UserWallet{
		UserID:           16,
		WalletType:       "general",
		AvailableBalance: 100000,
		TotalIncome:      100000,
		Status:           "active",
	}
	if err := db.Create(wallet).Error; err != nil {
		t.Fatalf("create wallet: %v", err)
	}

	record, err := service.RequestWithdrawal(16, 20000, "alipay", map[string]string{
		"alipay_account": " pilot@example.com ",
	})
	if err != nil {
		t.Fatalf("request withdrawal: %v", err)
	}
	if record.Status != "pending" || record.Amount != 20000 || record.ServiceFee != 100 || record.ActualAmount != 19900 {
		t.Fatalf("unexpected withdrawal record: %#v", record)
	}
	if record.AlipayAccount != "pilot@example.com" {
		t.Fatalf("expected trimmed alipay account, got %q", record.AlipayAccount)
	}

	var frozen model.UserWallet
	if err := db.Where("user_id = ?", int64(16)).First(&frozen).Error; err != nil {
		t.Fatalf("load frozen wallet: %v", err)
	}
	if frozen.AvailableBalance != 80000 || frozen.FrozenBalance != 20000 || frozen.TotalFrozen != 20000 {
		t.Fatalf("expected frozen wallet available=80000 frozen=20000 total_frozen=20000, got %#v", frozen)
	}

	if err := service.ApproveWithdrawal(record.ID, 1); err != nil {
		t.Fatalf("approve withdrawal: %v", err)
	}

	var approved model.WithdrawalRecord
	if err := db.First(&approved, record.ID).Error; err != nil {
		t.Fatalf("load approved withdrawal: %v", err)
	}
	if approved.Status != "completed" || approved.ReviewedBy != 1 || approved.CompletedAt == nil || approved.ThirdPartyNo == "" {
		t.Fatalf("unexpected approved withdrawal: %#v", approved)
	}

	var finalWallet model.UserWallet
	if err := db.Where("user_id = ?", int64(16)).First(&finalWallet).Error; err != nil {
		t.Fatalf("load final wallet: %v", err)
	}
	if finalWallet.AvailableBalance != 80000 || finalWallet.FrozenBalance != 0 || finalWallet.TotalWithdrawn != 20000 {
		t.Fatalf("expected approved wallet available=80000 frozen=0 withdrawn=20000, got %#v", finalWallet)
	}

	var txs []model.WalletTransaction
	if err := db.Where("user_id = ?", int64(16)).Order("id ASC").Find(&txs).Error; err != nil {
		t.Fatalf("load wallet transactions: %v", err)
	}
	if len(txs) != 2 || txs[0].Type != "freeze" || txs[1].Type != "deduct" {
		t.Fatalf("expected freeze and deduct transactions, got %#v", txs)
	}
}

func TestWithdrawalRejectUnfreezesBalance(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.UserWallet{},
		&model.WalletTransaction{},
		&model.WithdrawalRecord{},
	)
	service := NewSettlementService(repository.NewSettlementRepo(db), repository.NewOrderRepo(db), zap.NewNop())

	if err := db.Create(&model.UserWallet{
		UserID:           7,
		WalletType:       "general",
		AvailableBalance: 90000,
		TotalIncome:      90000,
		Status:           "active",
	}).Error; err != nil {
		t.Fatalf("create wallet: %v", err)
	}

	record, err := service.RequestWithdrawal(7, 30000, "bank_card", map[string]string{
		"bank_name":    "招商银行",
		"account_no":   "6222000011112222",
		"account_name": "测试服务商",
	})
	if err != nil {
		t.Fatalf("request withdrawal: %v", err)
	}

	if err := service.RejectWithdrawal(record.ID, 1, "账户信息待复核"); err != nil {
		t.Fatalf("reject withdrawal: %v", err)
	}

	var rejected model.WithdrawalRecord
	if err := db.First(&rejected, record.ID).Error; err != nil {
		t.Fatalf("load rejected withdrawal: %v", err)
	}
	if rejected.Status != "rejected" || rejected.ReviewedBy != 1 || rejected.ReviewNotes != "账户信息待复核" {
		t.Fatalf("unexpected rejected withdrawal: %#v", rejected)
	}

	var wallet model.UserWallet
	if err := db.Where("user_id = ?", int64(7)).First(&wallet).Error; err != nil {
		t.Fatalf("load wallet: %v", err)
	}
	if wallet.AvailableBalance != 90000 || wallet.FrozenBalance != 0 || wallet.TotalWithdrawn != 0 {
		t.Fatalf("expected rejected wallet restored, got %#v", wallet)
	}
}

func TestWithdrawalValidation(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.UserWallet{},
		&model.WalletTransaction{},
		&model.WithdrawalRecord{},
	)
	service := NewSettlementService(repository.NewSettlementRepo(db), repository.NewOrderRepo(db), zap.NewNop())
	if err := db.Create(&model.UserWallet{
		UserID:           16,
		WalletType:       "general",
		AvailableBalance: 100000,
		Status:           "active",
	}).Error; err != nil {
		t.Fatalf("create wallet: %v", err)
	}

	cases := []struct {
		name        string
		amount      int64
		method      string
		accountInfo map[string]string
		want        string
	}{
		{name: "too small", amount: 100, method: "alipay", accountInfo: map[string]string{"alipay_account": "a@example.com"}, want: "最低提现"},
		{name: "unknown method", amount: 1000, method: "cash", accountInfo: nil, want: "不支持"},
		{name: "missing bank name", amount: 1000, method: "bank_card", accountInfo: map[string]string{"account_no": "1", "account_name": "张三"}, want: "银行名称"},
		{name: "missing alipay", amount: 1000, method: "alipay", accountInfo: nil, want: "支付宝账号"},
		{name: "missing wechat", amount: 1000, method: "wechat", accountInfo: nil, want: "微信账号"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := service.RequestWithdrawal(16, tc.amount, tc.method, tc.accountInfo)
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("expected error containing %q, got %v", tc.want, err)
			}
		})
	}

	var wallet model.UserWallet
	if err := db.Where("user_id = ?", int64(16)).First(&wallet).Error; err != nil {
		t.Fatalf("load wallet: %v", err)
	}
	if wallet.AvailableBalance != 100000 || wallet.FrozenBalance != 0 {
		t.Fatalf("validation should not change wallet, got %#v", wallet)
	}
}

func TestFinanceOperationsOverviewAggregatesRiskQueues(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.OrderSettlement{},
		&model.WithdrawalRecord{},
		&model.FinanceAnomalyRecord{},
		&model.FinanceManualActionRecord{},
	)
	service := NewSettlementService(repository.NewSettlementRepo(db), repository.NewOrderRepo(db), zap.NewNop())
	now := time.Date(2026, 5, 24, 10, 30, 0, 0, time.Local)
	todaySettledAt := now.Add(-time.Hour)
	yesterday := now.AddDate(0, 0, -1)

	settlements := []model.OrderSettlement{
		{SettlementNo: "STL-OVERVIEW-PENDING", OrderID: 9001, Status: "pending"},
		{SettlementNo: "STL-OVERVIEW-CALCULATED", OrderID: 9002, Status: "calculated"},
		{SettlementNo: "STL-OVERVIEW-CONFIRMED", OrderID: 9003, Status: "confirmed"},
		{SettlementNo: "STL-OVERVIEW-DISPUTED", OrderID: 9004, Status: "disputed"},
		{SettlementNo: "STL-OVERVIEW-SETTLED-TODAY", OrderID: 9005, Status: "settled", FinalAmount: 100000, PlatformFee: 10000, SettledAt: &todaySettledAt},
		{SettlementNo: "STL-OVERVIEW-SETTLED-OLD", OrderID: 9006, Status: "settled", FinalAmount: 990000, PlatformFee: 99000, SettledAt: &yesterday},
	}
	if err := db.Create(&settlements).Error; err != nil {
		t.Fatalf("seed settlements: %v", err)
	}

	withdrawals := []model.WithdrawalRecord{
		{WithdrawalNo: "WD-OVERVIEW-PENDING", UserID: 1, WalletID: 1, Amount: 50000, Status: "pending", WithdrawMethod: "bank_card"},
		{WithdrawalNo: "WD-OVERVIEW-COMPLETED", UserID: 2, WalletID: 2, Amount: 30000, Status: "completed", WithdrawMethod: "alipay", CompletedAt: &todaySettledAt},
		{WithdrawalNo: "WD-OVERVIEW-REJECTED", UserID: 3, WalletID: 3, Amount: 10000, Status: "rejected", WithdrawMethod: "wechat", ReviewedAt: &todaySettledAt},
		{WithdrawalNo: "WD-OVERVIEW-OLD", UserID: 4, WalletID: 4, Amount: 80000, Status: "completed", WithdrawMethod: "alipay", CompletedAt: &yesterday},
	}
	if err := db.Create(&withdrawals).Error; err != nil {
		t.Fatalf("seed withdrawals: %v", err)
	}

	anomalies := []model.FinanceAnomalyRecord{
		{AnomalyNo: "FAN-OVERVIEW-CRITICAL", AnomalyType: "settlement_execute_failed", Severity: "critical", Status: "open", Source: "settlement", TargetType: "settlement", TargetID: 1, Message: "critical open"},
		{AnomalyNo: "FAN-OVERVIEW-WARNING", AnomalyType: "settlement_split_mismatch", Severity: "warning", Status: "open", Source: "reconciliation", TargetType: "settlement", TargetID: 2, Message: "warning open"},
		{AnomalyNo: "FAN-OVERVIEW-RESOLVED", AnomalyType: "withdrawal_reject_failed", Severity: "warning", Status: "resolved", Source: "withdrawal", TargetType: "withdrawal", TargetID: 3, Message: "resolved today", ResolvedAt: &todaySettledAt},
		{AnomalyNo: "FAN-OVERVIEW-OLD", AnomalyType: "withdrawal_reject_failed", Severity: "warning", Status: "resolved", Source: "withdrawal", TargetType: "withdrawal", TargetID: 4, Message: "resolved old", ResolvedAt: &yesterday},
	}
	if err := db.Create(&anomalies).Error; err != nil {
		t.Fatalf("seed anomalies: %v", err)
	}

	actions := []model.FinanceManualActionRecord{
		{ActionNo: "FMA-OVERVIEW-APPLIED", ActionType: "settlement_dispute_mark", Status: "applied", TargetType: "settlement", TargetID: 1},
		{ActionNo: "FMA-OVERVIEW-ROLLBACK", ActionType: "settlement_dispute_mark", Status: "rolled_back", TargetType: "settlement", TargetID: 2, RollbackAt: &todaySettledAt},
		{ActionNo: "FMA-OVERVIEW-OLD", ActionType: "settlement_dispute_mark", Status: "rolled_back", TargetType: "settlement", TargetID: 3, RollbackAt: &yesterday},
	}
	if err := db.Create(&actions).Error; err != nil {
		t.Fatalf("seed manual actions: %v", err)
	}

	overview, err := service.GetFinanceOperationsOverview(now)
	if err != nil {
		t.Fatalf("overview: %v", err)
	}

	if overview.Settlement.Pending != 1 || overview.Settlement.Calculated != 1 || overview.Settlement.Confirmed != 1 || overview.Settlement.Disputed != 1 {
		t.Fatalf("unexpected settlement queue counts: %#v", overview.Settlement)
	}
	if overview.Settlement.SettledToday != 1 || overview.Settlement.TotalSettledAmountToday != 100000 || overview.Settlement.TotalPlatformFeeToday != 10000 {
		t.Fatalf("unexpected settled today stats: %#v", overview.Settlement)
	}
	if overview.Withdrawal.Pending != 1 || overview.Withdrawal.PendingAmount != 50000 || overview.Withdrawal.CompletedToday != 1 || overview.Withdrawal.RejectedToday != 1 {
		t.Fatalf("unexpected withdrawal stats: %#v", overview.Withdrawal)
	}
	if overview.Anomaly.Open != 2 || overview.Anomaly.CriticalOpen != 1 || overview.Anomaly.WarningOpen != 1 || overview.Anomaly.ResolvedToday != 1 {
		t.Fatalf("unexpected anomaly stats: %#v", overview.Anomaly)
	}
	if overview.ManualAction.Applied != 1 || overview.ManualAction.RolledBackToday != 1 {
		t.Fatalf("unexpected manual action stats: %#v", overview.ManualAction)
	}
}

func int64Ptr(value int64) *int64 {
	return &value
}

func readCSVRows(t *testing.T, content []byte) [][]string {
	t.Helper()
	rows, err := csv.NewReader(bytes.NewReader(content)).ReadAll()
	if err != nil {
		t.Fatalf("read csv: %v\n%s", err, string(content))
	}
	return rows
}
