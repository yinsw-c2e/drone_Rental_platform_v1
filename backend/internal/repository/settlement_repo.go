package repository

import (
	"fmt"
	"time"

	"wurenji-backend/internal/model"

	"gorm.io/gorm"
)

type SettlementRepo struct {
	db *gorm.DB
}

func NewSettlementRepo(db *gorm.DB) *SettlementRepo {
	return &SettlementRepo{db: db}
}

// ========== OrderSettlement ==========

func (r *SettlementRepo) CreateSettlement(s *model.OrderSettlement) error {
	return r.db.Create(s).Error
}

func (r *SettlementRepo) GetSettlement(id int64) (*model.OrderSettlement, error) {
	var s model.OrderSettlement
	err := r.db.Preload("Order").Where("id = ?", id).First(&s).Error
	return &s, err
}

func (r *SettlementRepo) GetSettlementByOrder(orderID int64) (*model.OrderSettlement, error) {
	var s model.OrderSettlement
	err := r.db.Where("order_id = ?", orderID).First(&s).Error
	return &s, err
}

func (r *SettlementRepo) GetSettlementByNo(no string) (*model.OrderSettlement, error) {
	var s model.OrderSettlement
	err := r.db.Where("settlement_no = ?", no).First(&s).Error
	return &s, err
}

func (r *SettlementRepo) UpdateSettlement(s *model.OrderSettlement) error {
	return r.db.Save(s).Error
}

func (r *SettlementRepo) ListSettlements(status string, page, pageSize int) ([]model.OrderSettlement, int64, error) {
	var list []model.OrderSettlement
	var total int64
	query := r.db.Model(&model.OrderSettlement{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	query.Count(&total)
	err := query.Preload("Order").Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&list).Error
	return list, total, err
}

func (r *SettlementRepo) ListUserSettlements(userID int64, role string, page, pageSize int) ([]model.OrderSettlement, int64, error) {
	var list []model.OrderSettlement
	var total int64
	query := r.db.Model(&model.OrderSettlement{})
	switch role {
	case "pilot":
		query = query.Where("pilot_user_id = ?", userID)
	case "owner":
		query = query.Where("owner_user_id = ?", userID)
	case "payer":
		query = query.Where("payer_user_id = ?", userID)
	default:
		query = query.Where("pilot_user_id = ? OR owner_user_id = ? OR payer_user_id = ?", userID, userID, userID)
	}
	query.Count(&total)
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&list).Error
	return list, total, err
}

func (r *SettlementRepo) ListPendingSettlements() ([]model.OrderSettlement, error) {
	var list []model.OrderSettlement
	err := r.db.Where("status = ?", "confirmed").Order("created_at ASC").Find(&list).Error
	return list, err
}

// ========== UserWallet ==========

func (r *SettlementRepo) GetOrCreateWallet(userID int64, walletType string) (*model.UserWallet, error) {
	var w model.UserWallet
	err := r.db.Where("user_id = ? AND wallet_type = ?", userID, walletType).First(&w).Error
	if err == gorm.ErrRecordNotFound {
		w = model.UserWallet{
			UserID:     userID,
			WalletType: walletType,
			Status:     "active",
		}
		if err := r.db.Create(&w).Error; err != nil {
			return nil, err
		}
		return &w, nil
	}
	return &w, err
}

func (r *SettlementRepo) GetWallet(userID int64) (*model.UserWallet, error) {
	var w model.UserWallet
	err := r.db.Where("user_id = ? AND wallet_type = ?", userID, "general").First(&w).Error
	return &w, err
}

func (r *SettlementRepo) UpdateWallet(w *model.UserWallet) error {
	return r.db.Save(w).Error
}

// AddWalletIncome 增加钱包收入(事务安全)
func (r *SettlementRepo) AddWalletIncome(userID int64, amount int64, orderID, settlementID int64, description string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		wallet, err := r.getOrCreateWalletTx(tx, userID, "general")
		if err != nil {
			return err
		}
		if wallet.Status != "active" {
			return fmt.Errorf("钱包状态异常: %s", wallet.Status)
		}

		balanceBefore := wallet.AvailableBalance
		wallet.AvailableBalance += amount
		wallet.TotalIncome += amount
		if err := tx.Save(wallet).Error; err != nil {
			return err
		}

		txRecord := &model.WalletTransaction{
			TransactionNo:       generateTransactionNo(),
			WalletID:            wallet.ID,
			UserID:              userID,
			Type:                "income",
			Amount:              amount,
			BalanceBefore:       balanceBefore,
			BalanceAfter:        wallet.AvailableBalance,
			RelatedOrderID:      orderID,
			RelatedSettlementID: settlementID,
			Description:         description,
		}
		return tx.Create(txRecord).Error
	})
}

// FreezeWalletBalance 冻结余额(用于提现)
func (r *SettlementRepo) FreezeWalletBalance(userID int64, amount int64, description string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		wallet, err := r.getOrCreateWalletTx(tx, userID, "general")
		if err != nil {
			return err
		}
		if wallet.AvailableBalance < amount {
			return fmt.Errorf("余额不足: 可用%d, 需冻结%d", wallet.AvailableBalance, amount)
		}

		balanceBefore := wallet.AvailableBalance
		wallet.AvailableBalance -= amount
		wallet.FrozenBalance += amount
		wallet.TotalFrozen += amount
		if err := tx.Save(wallet).Error; err != nil {
			return err
		}

		txRecord := &model.WalletTransaction{
			TransactionNo: generateTransactionNo(),
			WalletID:      wallet.ID,
			UserID:        userID,
			Type:          "freeze",
			Amount:        -amount,
			BalanceBefore: balanceBefore,
			BalanceAfter:  wallet.AvailableBalance,
			Description:   description,
		}
		return tx.Create(txRecord).Error
	})
}

// UnfreezeWalletBalance 解冻余额(提现失败时)
func (r *SettlementRepo) UnfreezeWalletBalance(userID int64, amount int64, description string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		wallet, err := r.getOrCreateWalletTx(tx, userID, "general")
		if err != nil {
			return err
		}
		if wallet.FrozenBalance < amount {
			return fmt.Errorf("冻结余额不足")
		}

		balanceBefore := wallet.AvailableBalance
		wallet.AvailableBalance += amount
		wallet.FrozenBalance -= amount
		if err := tx.Save(wallet).Error; err != nil {
			return err
		}

		txRecord := &model.WalletTransaction{
			TransactionNo: generateTransactionNo(),
			WalletID:      wallet.ID,
			UserID:        userID,
			Type:          "unfreeze",
			Amount:        amount,
			BalanceBefore: balanceBefore,
			BalanceAfter:  wallet.AvailableBalance,
			Description:   description,
		}
		return tx.Create(txRecord).Error
	})
}

// DeductFrozenBalance 扣减冻结余额(提现成功时)
func (r *SettlementRepo) DeductFrozenBalance(userID int64, amount int64, description string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		wallet, err := r.getOrCreateWalletTx(tx, userID, "general")
		if err != nil {
			return err
		}
		if wallet.FrozenBalance < amount {
			return fmt.Errorf("冻结余额不足")
		}

		wallet.FrozenBalance -= amount
		wallet.TotalWithdrawn += amount
		if err := tx.Save(wallet).Error; err != nil {
			return err
		}

		txRecord := &model.WalletTransaction{
			TransactionNo: generateTransactionNo(),
			WalletID:      wallet.ID,
			UserID:        userID,
			Type:          "deduct",
			Amount:        -amount,
			BalanceBefore: wallet.AvailableBalance,
			BalanceAfter:  wallet.AvailableBalance,
			Description:   description,
		}
		return tx.Create(txRecord).Error
	})
}

func (r *SettlementRepo) getOrCreateWalletTx(tx *gorm.DB, userID int64, walletType string) (*model.UserWallet, error) {
	var w model.UserWallet
	err := tx.Where("user_id = ? AND wallet_type = ?", userID, walletType).First(&w).Error
	if err == gorm.ErrRecordNotFound {
		w = model.UserWallet{UserID: userID, WalletType: walletType, Status: "active"}
		if err := tx.Create(&w).Error; err != nil {
			return nil, err
		}
		return &w, nil
	}
	return &w, err
}

// ListWalletTransactions 查询钱包流水
func (r *SettlementRepo) ListWalletTransactions(userID int64, txType string, page, pageSize int) ([]model.WalletTransaction, int64, error) {
	var list []model.WalletTransaction
	var total int64
	query := r.db.Model(&model.WalletTransaction{}).Where("user_id = ?", userID)
	if txType != "" {
		query = query.Where("type = ?", txType)
	}
	query.Count(&total)
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&list).Error
	return list, total, err
}

// ========== WithdrawalRecord ==========

func (r *SettlementRepo) CreateWithdrawal(w *model.WithdrawalRecord) error {
	return r.db.Create(w).Error
}

func (r *SettlementRepo) GetWithdrawal(id int64) (*model.WithdrawalRecord, error) {
	var w model.WithdrawalRecord
	err := r.db.Where("id = ?", id).First(&w).Error
	return &w, err
}

func (r *SettlementRepo) UpdateWithdrawal(w *model.WithdrawalRecord) error {
	return r.db.Save(w).Error
}

func (r *SettlementRepo) ListUserWithdrawals(userID int64, page, pageSize int) ([]model.WithdrawalRecord, int64, error) {
	var list []model.WithdrawalRecord
	var total int64
	query := r.db.Model(&model.WithdrawalRecord{}).Where("user_id = ?", userID)
	query.Count(&total)
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&list).Error
	return list, total, err
}

func (r *SettlementRepo) ListPendingWithdrawals(page, pageSize int) ([]model.WithdrawalRecord, int64, error) {
	var list []model.WithdrawalRecord
	var total int64
	query := r.db.Model(&model.WithdrawalRecord{}).Where("status = ?", "pending")
	query.Count(&total)
	err := query.Preload("User").Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at ASC").Find(&list).Error
	return list, total, err
}

// ========== PricingConfig ==========

func (r *SettlementRepo) GetPricingConfig(key string) (float64, error) {
	var cfg model.PricingConfig
	err := r.db.Where("config_key = ? AND is_active = ?", key, true).First(&cfg).Error
	if err != nil {
		return 0, err
	}
	return cfg.ConfigValue, nil
}

func (r *SettlementRepo) GetPricingConfigsByCategory(category string) ([]model.PricingConfig, error) {
	var configs []model.PricingConfig
	err := r.db.Where("category = ? AND is_active = ?", category, true).Find(&configs).Error
	return configs, err
}

func (r *SettlementRepo) GetAllPricingConfigs() ([]model.PricingConfig, error) {
	var configs []model.PricingConfig
	err := r.db.Where("is_active = ?", true).Order("category, config_key").Find(&configs).Error
	return configs, err
}

func (r *SettlementRepo) UpdatePricingConfig(key string, value float64) error {
	return r.db.Model(&model.PricingConfig{}).Where("config_key = ?", key).Update("config_value", value).Error
}

// ========== Helpers ==========

func generateTransactionNo() string {
	return fmt.Sprintf("TX%d%04d", time.Now().UnixNano()/1e6, time.Now().Nanosecond()%10000)
}
