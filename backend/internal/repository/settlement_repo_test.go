package repository

import (
	"testing"

	"wurenji-backend/internal/model"
)

func TestReverseWalletIncomeCreatesTraceableNegativeTransaction(t *testing.T) {
	db := newRepositoryTestDB(t, &model.UserWallet{}, &model.WalletTransaction{})
	repo := NewSettlementRepo(db)

	if err := repo.AddWalletIncome(47, 108400, 88, 36, "订单收入"); err != nil {
		t.Fatalf("add income: %v", err)
	}
	var original model.WalletTransaction
	if err := db.Where("user_id = ? AND type = ?", int64(47), "income").First(&original).Error; err != nil {
		t.Fatalf("load original income: %v", err)
	}

	if err := repo.ReverseWalletIncome(47, original.ID, 108400, 88, 36, "订单退款冲正"); err != nil {
		t.Fatalf("reverse income: %v", err)
	}
	if err := repo.ReverseWalletIncome(47, original.ID, 108400, 88, 36, "订单退款冲正"); err != nil {
		t.Fatalf("repeat reverse income should be idempotent: %v", err)
	}

	var txs []model.WalletTransaction
	if err := db.Where("user_id = ?", int64(47)).Order("id ASC").Find(&txs).Error; err != nil {
		t.Fatalf("list wallet tx: %v", err)
	}
	if len(txs) != 2 {
		t.Fatalf("expected income + one reversal, got %#v", txs)
	}
	if txs[1].Type != "income_reversal" || txs[1].Amount != -108400 || txs[1].RelatedTransactionID != original.ID {
		t.Fatalf("unexpected reversal tx: %#v", txs[1])
	}

	var wallet model.UserWallet
	if err := db.Where("user_id = ?", int64(47)).First(&wallet).Error; err != nil {
		t.Fatalf("load wallet: %v", err)
	}
	if wallet.AvailableBalance != 0 || wallet.TotalIncome != 0 {
		t.Fatalf("expected wallet balance/income to return to zero, got %#v", wallet)
	}
}
