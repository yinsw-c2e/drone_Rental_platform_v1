package repository

import (
	"fmt"
	"sync/atomic"
	"time"

	"wurenji-backend/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SettlementRepo struct {
	db *gorm.DB
}

type FinanceAnomalyFilter struct {
	Status       string
	Severity     string
	AnomalyType  string
	Source       string
	TargetType   string
	TargetID     int64
	OrderID      int64
	SettlementID int64
	WithdrawalID int64
	UserID       int64
	Keyword      string
}

type FinanceManualActionFilter struct {
	Status       string
	ActionType   string
	TargetType   string
	TargetID     int64
	SettlementID int64
	WithdrawalID int64
	AnomalyID    int64
	AdminID      int64
	Keyword      string
}

type SettlementAmountStats struct {
	Count       int64
	TotalAmount int64
	PlatformFee int64
}

type WithdrawalAmountStats struct {
	Count  int64
	Amount int64
}

var transactionNoSeq uint64

func NewSettlementRepo(db *gorm.DB) *SettlementRepo {
	return &SettlementRepo{db: db}
}

func (r *SettlementRepo) DB() *gorm.DB {
	if r == nil {
		return nil
	}
	return r.db
}

func (r *SettlementRepo) Transaction(fn func(*SettlementRepo) error) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		return fn(NewSettlementRepo(tx))
	})
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

func (r *SettlementRepo) LockSettlementByOrder(orderID int64) (*model.OrderSettlement, error) {
	var s model.OrderSettlement
	err := r.db.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("order_id = ?", orderID).
		First(&s).Error
	return &s, err
}

func (r *SettlementRepo) GetSettlementByNo(no string) (*model.OrderSettlement, error) {
	var s model.OrderSettlement
	err := r.db.Where("settlement_no = ?", no).First(&s).Error
	return &s, err
}

func (r *SettlementRepo) UpdateSettlement(s *model.OrderSettlement) error {
	return r.db.Omit(clause.Associations).Save(s).Error
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

func (r *SettlementRepo) ListSettlementsFiltered(status string, startAt, endAt *time.Time, timeField string, page, pageSize int) ([]model.OrderSettlement, int64, error) {
	var list []model.OrderSettlement
	var total int64
	timeColumn, err := settlementExportTimeColumn(timeField)
	if err != nil {
		return nil, 0, err
	}
	query := r.db.Model(&model.OrderSettlement{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if startAt != nil {
		query = query.Where(timeColumn+" >= ?", *startAt)
	}
	if endAt != nil {
		query = query.Where(timeColumn+" < ?", *endAt)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = query.Preload("Order").Offset((page - 1) * pageSize).Limit(pageSize).Order(timeColumn + " DESC").Find(&list).Error
	return list, total, err
}

func (r *SettlementRepo) ExportSettlements(status string, startAt, endAt *time.Time, timeField string, limit int) ([]model.OrderSettlement, error) {
	var list []model.OrderSettlement
	timeColumn, err := settlementExportTimeColumn(timeField)
	if err != nil {
		return nil, err
	}
	query := r.db.Model(&model.OrderSettlement{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if startAt != nil {
		query = query.Where(timeColumn+" >= ?", *startAt)
	}
	if endAt != nil {
		query = query.Where(timeColumn+" < ?", *endAt)
	}
	if limit > 0 {
		query = query.Limit(limit)
	}
	err = query.Preload("Order").Order(timeColumn + " DESC").Find(&list).Error
	return list, err
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

func (r *SettlementRepo) CountSettlementsByStatus(status string) (int64, error) {
	var count int64
	query := r.db.Model(&model.OrderSettlement{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Count(&count).Error
	return count, err
}

func (r *SettlementRepo) SettledSettlementStats(startAt, endAt time.Time) (SettlementAmountStats, error) {
	var stats SettlementAmountStats
	err := r.db.Model(&model.OrderSettlement{}).
		Select("COUNT(*) AS count, COALESCE(SUM(final_amount), 0) AS total_amount, COALESCE(SUM(platform_fee), 0) AS platform_fee").
		Where("status = ? AND settled_at >= ? AND settled_at < ?", "settled", startAt, endAt).
		Scan(&stats).Error
	return stats, err
}

func (r *SettlementRepo) SumPendingForUser(userID int64) (int64, error) {
	if r == nil || r.db == nil || userID <= 0 {
		return 0, nil
	}
	var total int64
	err := r.db.Model(&model.OrderSettlement{}).
		Where("(pilot_user_id = ? OR owner_user_id = ? OR partial_handover_provider_user_id = ?)", userID, userID, userID).
		Where("status IN ?", []string{"pending", "calculated", "pending_review"}).
		Select("COALESCE(SUM(pilot_fee + owner_fee), 0)").
		Scan(&total).Error
	return total, err
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
		return r.addWalletIncomeTx(tx, userID, amount, orderID, settlementID, description)
	})
}

// AddWalletIncomeInCurrentTx 增加钱包收入，调用方负责外层事务。
func (r *SettlementRepo) AddWalletIncomeInCurrentTx(userID int64, amount int64, orderID, settlementID int64, description string) error {
	return r.addWalletIncomeTx(r.db, userID, amount, orderID, settlementID, description)
}

func (r *SettlementRepo) addWalletIncomeTx(tx *gorm.DB, userID int64, amount int64, orderID, settlementID int64, description string) error {
	var existing model.WalletTransaction
	err := tx.Where(
		"user_id = ? AND related_settlement_id = ? AND type = ? AND description = ?",
		userID,
		settlementID,
		"income",
		description,
	).First(&existing).Error
	if err == nil {
		if existing.Amount != amount || existing.RelatedOrderID != orderID {
			return fmt.Errorf("已存在结算入账流水但金额或订单不一致: settlement_id=%d user_id=%d", settlementID, userID)
		}
		return nil
	}
	if err != gorm.ErrRecordNotFound {
		return err
	}

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

func (r *SettlementRepo) ListWithdrawals(status string, page, pageSize int) ([]model.WithdrawalRecord, int64, error) {
	var list []model.WithdrawalRecord
	var total int64
	query := r.db.Model(&model.WithdrawalRecord{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Preload("User").Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&list).Error
	return list, total, err
}

func (r *SettlementRepo) ListWithdrawalsFiltered(status string, startAt, endAt *time.Time, timeField string, page, pageSize int) ([]model.WithdrawalRecord, int64, error) {
	var list []model.WithdrawalRecord
	var total int64
	timeColumn, err := withdrawalExportTimeColumn(timeField)
	if err != nil {
		return nil, 0, err
	}
	query := r.db.Model(&model.WithdrawalRecord{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if startAt != nil {
		query = query.Where(timeColumn+" >= ?", *startAt)
	}
	if endAt != nil {
		query = query.Where(timeColumn+" < ?", *endAt)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = query.Preload("User").Offset((page - 1) * pageSize).Limit(pageSize).Order(timeColumn + " DESC").Find(&list).Error
	return list, total, err
}

func (r *SettlementRepo) ExportWithdrawals(status string, startAt, endAt *time.Time, timeField string, limit int) ([]model.WithdrawalRecord, error) {
	var list []model.WithdrawalRecord
	timeColumn, err := withdrawalExportTimeColumn(timeField)
	if err != nil {
		return nil, err
	}
	query := r.db.Model(&model.WithdrawalRecord{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if startAt != nil {
		query = query.Where(timeColumn+" >= ?", *startAt)
	}
	if endAt != nil {
		query = query.Where(timeColumn+" < ?", *endAt)
	}
	if limit > 0 {
		query = query.Limit(limit)
	}
	err = query.Preload("User").Order(timeColumn + " DESC").Find(&list).Error
	return list, err
}

func (r *SettlementRepo) CountWithdrawalsByStatus(status string) (int64, error) {
	var count int64
	query := r.db.Model(&model.WithdrawalRecord{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Count(&count).Error
	return count, err
}

func (r *SettlementRepo) WithdrawalStatsByStatus(status, timeField string, startAt, endAt *time.Time) (WithdrawalAmountStats, error) {
	var stats WithdrawalAmountStats
	timeColumn, err := withdrawalExportTimeColumn(timeField)
	if err != nil {
		return stats, err
	}
	query := r.db.Model(&model.WithdrawalRecord{}).
		Select("COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount")
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if startAt != nil {
		query = query.Where(timeColumn+" >= ?", *startAt)
	}
	if endAt != nil {
		query = query.Where(timeColumn+" < ?", *endAt)
	}
	err = query.Scan(&stats).Error
	return stats, err
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

// ========== FinanceAnomalyRecord ==========

func (r *SettlementRepo) CreateFinanceAnomaly(record *model.FinanceAnomalyRecord) error {
	return r.db.Create(record).Error
}

func (r *SettlementRepo) GetFinanceAnomaly(id int64) (*model.FinanceAnomalyRecord, error) {
	var record model.FinanceAnomalyRecord
	err := r.db.Where("id = ?", id).First(&record).Error
	return &record, err
}

func (r *SettlementRepo) UpdateFinanceAnomaly(record *model.FinanceAnomalyRecord) error {
	return r.db.Save(record).Error
}

func (r *SettlementRepo) ListFinanceAnomalies(filter FinanceAnomalyFilter, page, pageSize int) ([]model.FinanceAnomalyRecord, int64, error) {
	var list []model.FinanceAnomalyRecord
	var total int64
	query := r.db.Model(&model.FinanceAnomalyRecord{})
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.Severity != "" {
		query = query.Where("severity = ?", filter.Severity)
	}
	if filter.AnomalyType != "" {
		query = query.Where("anomaly_type = ?", filter.AnomalyType)
	}
	if filter.Source != "" {
		query = query.Where("source = ?", filter.Source)
	}
	if filter.TargetType != "" {
		query = query.Where("target_type = ?", filter.TargetType)
	}
	if filter.TargetID > 0 {
		query = query.Where("target_id = ?", filter.TargetID)
	}
	if filter.OrderID > 0 {
		query = query.Where("order_id = ?", filter.OrderID)
	}
	if filter.SettlementID > 0 {
		query = query.Where("settlement_id = ?", filter.SettlementID)
	}
	if filter.WithdrawalID > 0 {
		query = query.Where("withdrawal_id = ?", filter.WithdrawalID)
	}
	if filter.UserID > 0 {
		query = query.Where("user_id = ?", filter.UserID)
	}
	if filter.Keyword != "" {
		like := "%" + filter.Keyword + "%"
		query = query.Where("anomaly_no LIKE ? OR message LIKE ?", like, like)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&list).Error
	return list, total, err
}

func (r *SettlementRepo) CountFinanceAnomalies(filter FinanceAnomalyFilter) (int64, error) {
	var total int64
	query := r.db.Model(&model.FinanceAnomalyRecord{})
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.Severity != "" {
		query = query.Where("severity = ?", filter.Severity)
	}
	if filter.AnomalyType != "" {
		query = query.Where("anomaly_type = ?", filter.AnomalyType)
	}
	if filter.Source != "" {
		query = query.Where("source = ?", filter.Source)
	}
	if filter.TargetType != "" {
		query = query.Where("target_type = ?", filter.TargetType)
	}
	if filter.TargetID > 0 {
		query = query.Where("target_id = ?", filter.TargetID)
	}
	if filter.OrderID > 0 {
		query = query.Where("order_id = ?", filter.OrderID)
	}
	if filter.SettlementID > 0 {
		query = query.Where("settlement_id = ?", filter.SettlementID)
	}
	if filter.WithdrawalID > 0 {
		query = query.Where("withdrawal_id = ?", filter.WithdrawalID)
	}
	if filter.UserID > 0 {
		query = query.Where("user_id = ?", filter.UserID)
	}
	if filter.Keyword != "" {
		like := "%" + filter.Keyword + "%"
		query = query.Where("anomaly_no LIKE ? OR message LIKE ?", like, like)
	}
	err := query.Count(&total).Error
	return total, err
}

func (r *SettlementRepo) CountResolvedFinanceAnomalies(startAt, endAt time.Time) (int64, error) {
	var total int64
	err := r.db.Model(&model.FinanceAnomalyRecord{}).
		Where("status = ? AND resolved_at >= ? AND resolved_at < ?", "resolved", startAt, endAt).
		Count(&total).Error
	return total, err
}

func (r *SettlementRepo) ResolveFinanceAnomaly(id, adminID int64, note string) (*model.FinanceAnomalyRecord, error) {
	var record model.FinanceAnomalyRecord
	if err := r.db.Where("id = ?", id).First(&record).Error; err != nil {
		return nil, err
	}
	if record.Status == "resolved" {
		return &record, nil
	}

	now := time.Now()
	record.Status = "resolved"
	record.ResolvedBy = adminID
	record.ResolvedAt = &now
	record.ResolutionNote = note
	if err := r.db.Save(&record).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

// ========== FinanceManualActionRecord ==========

func (r *SettlementRepo) CreateFinanceManualAction(record *model.FinanceManualActionRecord) error {
	return r.db.Create(record).Error
}

func (r *SettlementRepo) GetFinanceManualAction(id int64) (*model.FinanceManualActionRecord, error) {
	var record model.FinanceManualActionRecord
	err := r.db.Where("id = ?", id).First(&record).Error
	return &record, err
}

func (r *SettlementRepo) UpdateFinanceManualAction(record *model.FinanceManualActionRecord) error {
	return r.db.Save(record).Error
}

func (r *SettlementRepo) ListFinanceManualActions(filter FinanceManualActionFilter, page, pageSize int) ([]model.FinanceManualActionRecord, int64, error) {
	var list []model.FinanceManualActionRecord
	var total int64
	query := r.db.Model(&model.FinanceManualActionRecord{})
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.ActionType != "" {
		query = query.Where("action_type = ?", filter.ActionType)
	}
	if filter.TargetType != "" {
		query = query.Where("target_type = ?", filter.TargetType)
	}
	if filter.TargetID > 0 {
		query = query.Where("target_id = ?", filter.TargetID)
	}
	if filter.SettlementID > 0 {
		query = query.Where("settlement_id = ?", filter.SettlementID)
	}
	if filter.WithdrawalID > 0 {
		query = query.Where("withdrawal_id = ?", filter.WithdrawalID)
	}
	if filter.AnomalyID > 0 {
		query = query.Where("anomaly_id = ?", filter.AnomalyID)
	}
	if filter.AdminID > 0 {
		query = query.Where("admin_id = ?", filter.AdminID)
	}
	if filter.Keyword != "" {
		like := "%" + filter.Keyword + "%"
		query = query.Where("action_no LIKE ? OR reason LIKE ? OR rollback_note LIKE ?", like, like, like)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&list).Error
	return list, total, err
}

func (r *SettlementRepo) CountFinanceManualActions(filter FinanceManualActionFilter) (int64, error) {
	var total int64
	query := r.db.Model(&model.FinanceManualActionRecord{})
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.ActionType != "" {
		query = query.Where("action_type = ?", filter.ActionType)
	}
	if filter.TargetType != "" {
		query = query.Where("target_type = ?", filter.TargetType)
	}
	if filter.TargetID > 0 {
		query = query.Where("target_id = ?", filter.TargetID)
	}
	if filter.SettlementID > 0 {
		query = query.Where("settlement_id = ?", filter.SettlementID)
	}
	if filter.WithdrawalID > 0 {
		query = query.Where("withdrawal_id = ?", filter.WithdrawalID)
	}
	if filter.AnomalyID > 0 {
		query = query.Where("anomaly_id = ?", filter.AnomalyID)
	}
	if filter.AdminID > 0 {
		query = query.Where("admin_id = ?", filter.AdminID)
	}
	if filter.Keyword != "" {
		like := "%" + filter.Keyword + "%"
		query = query.Where("action_no LIKE ? OR reason LIKE ? OR rollback_note LIKE ?", like, like, like)
	}
	err := query.Count(&total).Error
	return total, err
}

func (r *SettlementRepo) CountRolledBackFinanceManualActions(startAt, endAt time.Time) (int64, error) {
	var total int64
	err := r.db.Model(&model.FinanceManualActionRecord{}).
		Where("status = ? AND rollback_at >= ? AND rollback_at < ?", "rolled_back", startAt, endAt).
		Count(&total).Error
	return total, err
}

// ========== Helpers ==========

func generateTransactionNo() string {
	seq := atomic.AddUint64(&transactionNoSeq, 1) % 1000000
	return fmt.Sprintf("TX%d%06d", time.Now().UnixNano(), seq)
}

func settlementExportTimeColumn(timeField string) (string, error) {
	switch timeField {
	case "", "created_at":
		return "created_at", nil
	case "confirmed_at":
		return "confirmed_at", nil
	case "settled_at":
		return "settled_at", nil
	case "updated_at":
		return "updated_at", nil
	default:
		return "", fmt.Errorf("不支持的结算导出时间字段: %s", timeField)
	}
}

func withdrawalExportTimeColumn(timeField string) (string, error) {
	switch timeField {
	case "", "created_at":
		return "created_at", nil
	case "reviewed_at":
		return "reviewed_at", nil
	case "completed_at":
		return "completed_at", nil
	case "updated_at":
		return "updated_at", nil
	default:
		return "", fmt.Errorf("不支持的提现导出时间字段: %s", timeField)
	}
}
