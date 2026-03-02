package service

import (
	"errors"
	"fmt"
	"math"
	"time"

	"go.uber.org/zap"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type SettlementService struct {
	settlementRepo *repository.SettlementRepo
	orderRepo      *repository.OrderRepo
	logger         *zap.Logger
}

func NewSettlementService(settlementRepo *repository.SettlementRepo, orderRepo *repository.OrderRepo, logger *zap.Logger) *SettlementService {
	return &SettlementService{settlementRepo: settlementRepo, orderRepo: orderRepo, logger: logger}
}

// ========== 定价引擎 ==========

// PricingInput 定价输入参数
type PricingInput struct {
	FlightDistance float64 // km
	FlightDuration float64 // 分钟
	CargoWeight    float64 // kg
	CargoValue     int64   // 货物价值(分)
	CargoType      string  // normal, fragile, hazardous
	TaskType       string  // cargo_delivery, agriculture, mapping, inspection, emergency
	IsNightFlight  bool
	IsPeakHour     bool
	IsHoliday      bool
}

// PricingResult 定价结果
type PricingResult struct {
	BaseFee        int64   `json:"base_fee"`
	MileageFee     int64   `json:"mileage_fee"`
	DurationFee    int64   `json:"duration_fee"`
	WeightFee      int64   `json:"weight_fee"`
	DifficultyFee  int64   `json:"difficulty_fee"`
	InsuranceFee   int64   `json:"insurance_fee"`
	SubTotal       int64   `json:"sub_total"`
	SurgePricing   int64   `json:"surge_pricing"`
	TotalAmount    int64   `json:"total_amount"`
	DifficultyFactor float64 `json:"difficulty_factor"`
	InsuranceRate  float64 `json:"insurance_rate"`
}

// CalculatePrice 计算订单价格
func (s *SettlementService) CalculatePrice(input PricingInput) (*PricingResult, error) {
	result := &PricingResult{}

	// 1. 基础服务费
	baseFee, _ := s.settlementRepo.GetPricingConfig("base_fee_default")
	if baseFee == 0 {
		baseFee = 8000 // 默认80元
	}
	result.BaseFee = int64(baseFee)

	// 2. 里程费(阶梯计价)
	result.MileageFee = s.calculateMileageFee(input.FlightDistance)

	// 3. 时长费
	result.DurationFee = s.calculateDurationFee(input.FlightDuration)

	// 4. 重量费
	result.WeightFee = s.calculateWeightFee(input.CargoWeight)

	// 5. 难度系数
	result.DifficultyFactor = s.getDifficultyFactor(input.TaskType, input.IsNightFlight)
	baseCost := result.BaseFee + result.MileageFee + result.DurationFee + result.WeightFee
	if result.DifficultyFactor > 1.0 {
		result.DifficultyFee = int64(float64(baseCost) * (result.DifficultyFactor - 1.0))
	}

	// 6. 保险费
	result.InsuranceRate = s.getInsuranceRate(input.CargoType)
	if input.CargoValue > 0 {
		result.InsuranceFee = int64(float64(input.CargoValue) * result.InsuranceRate)
	}

	// 小计
	result.SubTotal = baseCost + result.DifficultyFee + result.InsuranceFee

	// 7. 高峰/空闲溢价
	result.SurgePricing = s.calculateSurgePricing(result.SubTotal, input.IsPeakHour, input.IsHoliday)

	// 总计
	result.TotalAmount = result.SubTotal + result.SurgePricing
	if result.TotalAmount < 0 {
		result.TotalAmount = result.SubTotal // 防止折扣导致负数
	}

	return result, nil
}

func (s *SettlementService) calculateMileageFee(distanceKm float64) int64 {
	if distanceKm <= 0 {
		return 0
	}
	var fee float64
	rate0_5, _ := s.settlementRepo.GetPricingConfig("mileage_rate_0_5")
	rate5_15, _ := s.settlementRepo.GetPricingConfig("mileage_rate_5_15")
	rate15_50, _ := s.settlementRepo.GetPricingConfig("mileage_rate_15_50")
	rate50plus, _ := s.settlementRepo.GetPricingConfig("mileage_rate_50_plus")
	if rate0_5 == 0 { rate0_5 = 1500 }
	if rate5_15 == 0 { rate5_15 = 1000 }
	if rate15_50 == 0 { rate15_50 = 800 }
	if rate50plus == 0 { rate50plus = 500 }

	if distanceKm <= 5 {
		fee = distanceKm * rate0_5
	} else if distanceKm <= 15 {
		fee = 5*rate0_5 + (distanceKm-5)*rate5_15
	} else if distanceKm <= 50 {
		fee = 5*rate0_5 + 10*rate5_15 + (distanceKm-15)*rate15_50
	} else {
		fee = 5*rate0_5 + 10*rate5_15 + 35*rate15_50 + (distanceKm-50)*rate50plus
	}
	return int64(math.Round(fee))
}

func (s *SettlementService) calculateDurationFee(durationMin float64) int64 {
	freeMin, _ := s.settlementRepo.GetPricingConfig("duration_free_minutes")
	rate, _ := s.settlementRepo.GetPricingConfig("duration_rate")
	if freeMin == 0 { freeMin = 10 }
	if rate == 0 { rate = 300 }

	billableMin := durationMin - freeMin
	if billableMin <= 0 {
		return 0
	}
	return int64(math.Round(billableMin * rate))
}

func (s *SettlementService) calculateWeightFee(weightKg float64) int64 {
	if weightKg <= 0 {
		return 0
	}
	rate0_5, _ := s.settlementRepo.GetPricingConfig("weight_rate_0_5")
	rate5_20, _ := s.settlementRepo.GetPricingConfig("weight_rate_5_20")
	rate20plus, _ := s.settlementRepo.GetPricingConfig("weight_rate_20_plus")
	if rate0_5 == 0 { rate0_5 = 1000 }
	if rate5_20 == 0 { rate5_20 = 3000 }
	if rate20plus == 0 { rate20plus = 5000 }

	var fee float64
	unitWeight := weightKg / 10.0 // 每10kg为计费单位
	if weightKg <= 5 {
		fee = unitWeight * rate0_5
	} else if weightKg <= 20 {
		fee = 0.5*rate0_5 + (unitWeight-0.5)*rate5_20
	} else {
		fee = 0.5*rate0_5 + 1.5*rate5_20 + (unitWeight-2.0)*rate20plus
	}
	return int64(math.Round(fee))
}

func (s *SettlementService) getDifficultyFactor(taskType string, isNight bool) float64 {
	if isNight {
		f, _ := s.settlementRepo.GetPricingConfig("difficulty_night")
		if f == 0 { f = 2.0 }
		return f
	}
	switch taskType {
	case "emergency":
		f, _ := s.settlementRepo.GetPricingConfig("difficulty_emergency")
		if f == 0 { f = 1.8 }
		return f
	case "inspection":
		f, _ := s.settlementRepo.GetPricingConfig("difficulty_complex")
		if f == 0 { f = 1.3 }
		return f
	default:
		return 1.0
	}
}

func (s *SettlementService) getInsuranceRate(cargoType string) float64 {
	switch cargoType {
	case "hazardous":
		r, _ := s.settlementRepo.GetPricingConfig("insurance_rate_hazardous")
		if r == 0 { r = 0.03 }
		return r
	case "fragile":
		r, _ := s.settlementRepo.GetPricingConfig("insurance_rate_fragile")
		if r == 0 { r = 0.02 }
		return r
	default:
		r, _ := s.settlementRepo.GetPricingConfig("insurance_rate_normal")
		if r == 0 { r = 0.01 }
		return r
	}
}

func (s *SettlementService) calculateSurgePricing(subtotal int64, isPeak, isHoliday bool) int64 {
	if isHoliday {
		rate, _ := s.settlementRepo.GetPricingConfig("surge_holiday_rate")
		if rate == 0 { rate = 1.5 }
		return int64(float64(subtotal) * (rate - 1.0))
	}
	if isPeak {
		rate, _ := s.settlementRepo.GetPricingConfig("surge_peak_rate")
		if rate == 0 { rate = 1.3 }
		return int64(float64(subtotal) * (rate - 1.0))
	}
	// 空闲折扣 - 暂时不主动触发
	return 0
}

// ========== 结算引擎 ==========

// CreateSettlement 创建订单结算(订单完成时调用)
func (s *SettlementService) CreateSettlement(orderID int64) (*model.OrderSettlement, error) {
	// 检查是否已存在
	existing, err := s.settlementRepo.GetSettlementByOrder(orderID)
	if err == nil && existing.ID > 0 {
		return existing, nil
	}

	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, errors.New("订单不存在")
	}

	// 获取分账比例
	platformRate := s.getConfigFloat("split_platform_rate", 0.10)
	pilotRate := s.getConfigFloat("split_pilot_rate", 0.45)
	ownerRate := s.getConfigFloat("split_owner_rate", 0.40)
	insuranceRate := s.getConfigFloat("split_insurance_rate", 0.05)

	finalAmount := order.TotalAmount // 单位: 分(数据库中存储的)
	if finalAmount <= 0 {
		return nil, errors.New("订单金额为零")
	}

	// 计算分账金额
	platformFee := int64(math.Round(float64(finalAmount) * platformRate))
	insuranceDeduction := int64(math.Round(float64(finalAmount) * insuranceRate))
	distributable := finalAmount - platformFee - insuranceDeduction
	pilotFee := int64(math.Round(float64(distributable) * (pilotRate / (pilotRate + ownerRate))))
	ownerFee := distributable - pilotFee

	now := time.Now()
	settlement := &model.OrderSettlement{
		SettlementNo:       generateSettlementNo(),
		OrderID:            orderID,
		OrderNo:            order.OrderNo,
		TotalAmount:        finalAmount,
		FinalAmount:        finalAmount,
		PlatformFeeRate:    platformRate,
		PlatformFee:        platformFee,
		PilotFeeRate:       pilotRate,
		PilotFee:           pilotFee,
		OwnerFeeRate:       ownerRate,
		OwnerFee:           ownerFee,
		InsuranceDeduction: insuranceDeduction,
		PilotUserID:        order.PilotID,
		OwnerUserID:        order.OwnerID,
		PayerUserID:        order.RenterID,
		Status:             "calculated",
		CalculatedAt:       &now,
	}

	if err := s.settlementRepo.CreateSettlement(settlement); err != nil {
		return nil, err
	}

	s.logger.Info("Settlement created",
		zap.Int64("order_id", orderID),
		zap.String("settlement_no", settlement.SettlementNo),
		zap.Int64("total", finalAmount),
		zap.Int64("platform_fee", platformFee),
		zap.Int64("pilot_fee", pilotFee),
		zap.Int64("owner_fee", ownerFee),
	)

	return settlement, nil
}

// ConfirmSettlement 确认结算
func (s *SettlementService) ConfirmSettlement(id int64) error {
	settlement, err := s.settlementRepo.GetSettlement(id)
	if err != nil {
		return errors.New("结算记录不存在")
	}
	if settlement.Status != "calculated" {
		return fmt.Errorf("结算状态不正确: %s", settlement.Status)
	}

	now := time.Now()
	settlement.Status = "confirmed"
	settlement.ConfirmedAt = &now
	return s.settlementRepo.UpdateSettlement(settlement)
}

// ExecuteSettlement 执行结算(将金额打入各方钱包)
func (s *SettlementService) ExecuteSettlement(id int64) error {
	settlement, err := s.settlementRepo.GetSettlement(id)
	if err != nil {
		return errors.New("结算记录不存在")
	}
	if settlement.Status != "confirmed" {
		return fmt.Errorf("结算未确认: %s", settlement.Status)
	}

	// 给飞手钱包打入
	if settlement.PilotUserID > 0 && settlement.PilotFee > 0 {
		err := s.settlementRepo.AddWalletIncome(settlement.PilotUserID, settlement.PilotFee,
			settlement.OrderID, settlement.ID, fmt.Sprintf("订单%s飞手劳务费", settlement.OrderNo))
		if err != nil {
			s.logger.Error("Failed to add pilot income", zap.Error(err))
			return fmt.Errorf("飞手入账失败: %w", err)
		}
	}

	// 给机主钱包打入
	if settlement.OwnerUserID > 0 && settlement.OwnerFee > 0 {
		err := s.settlementRepo.AddWalletIncome(settlement.OwnerUserID, settlement.OwnerFee,
			settlement.OrderID, settlement.ID, fmt.Sprintf("订单%s设备使用费", settlement.OrderNo))
		if err != nil {
			s.logger.Error("Failed to add owner income", zap.Error(err))
			return fmt.Errorf("机主入账失败: %w", err)
		}
	}

	now := time.Now()
	settlement.Status = "settled"
	settlement.SettledAt = &now
	settlement.SettledBy = "system"
	s.settlementRepo.UpdateSettlement(settlement)

	s.logger.Info("Settlement executed",
		zap.Int64("settlement_id", id),
		zap.Int64("pilot_fee", settlement.PilotFee),
		zap.Int64("owner_fee", settlement.OwnerFee),
	)

	return nil
}

// ========== 钱包操作 ==========

// GetWallet 获取用户钱包
func (s *SettlementService) GetWallet(userID int64) (*model.UserWallet, error) {
	return s.settlementRepo.GetOrCreateWallet(userID, "general")
}

// GetWalletTransactions 获取钱包流水
func (s *SettlementService) GetWalletTransactions(userID int64, txType string, page, pageSize int) ([]model.WalletTransaction, int64, error) {
	return s.settlementRepo.ListWalletTransactions(userID, txType, page, pageSize)
}

// ========== 提现 ==========

// RequestWithdrawal 申请提现
func (s *SettlementService) RequestWithdrawal(userID int64, amount int64, method string, accountInfo map[string]string) (*model.WithdrawalRecord, error) {
	if amount <= 0 {
		return nil, errors.New("提现金额必须大于0")
	}

	wallet, err := s.settlementRepo.GetOrCreateWallet(userID, "general")
	if err != nil {
		return nil, errors.New("获取钱包失败")
	}
	if wallet.AvailableBalance < amount {
		return nil, fmt.Errorf("余额不足: 可用%.2f元, 申请提现%.2f元", float64(wallet.AvailableBalance)/100, float64(amount)/100)
	}

	// 计算手续费 (暂定0.1%, 最低1元)
	serviceFee := int64(math.Max(100, float64(amount)*0.001))
	actualAmount := amount - serviceFee

	record := &model.WithdrawalRecord{
		WithdrawalNo:   generateWithdrawalNo(),
		UserID:         userID,
		WalletID:       wallet.ID,
		Amount:         amount,
		ServiceFee:     serviceFee,
		ActualAmount:   actualAmount,
		WithdrawMethod: method,
		BankName:       accountInfo["bank_name"],
		BankBranch:     accountInfo["bank_branch"],
		AccountNo:      accountInfo["account_no"],
		AccountName:    accountInfo["account_name"],
		AlipayAccount:  accountInfo["alipay_account"],
		WechatAccount:  accountInfo["wechat_account"],
		Status:         "pending",
	}

	// 冻结余额
	if err := s.settlementRepo.FreezeWalletBalance(userID, amount, "提现冻结"); err != nil {
		return nil, err
	}

	if err := s.settlementRepo.CreateWithdrawal(record); err != nil {
		// 冻结失败回滚
		s.settlementRepo.UnfreezeWalletBalance(userID, amount, "提现创建失败回滚")
		return nil, err
	}

	return record, nil
}

// ApproveWithdrawal 审批通过提现
func (s *SettlementService) ApproveWithdrawal(id, adminID int64) error {
	record, err := s.settlementRepo.GetWithdrawal(id)
	if err != nil {
		return errors.New("提现记录不存在")
	}
	if record.Status != "pending" {
		return fmt.Errorf("提现状态不正确: %s", record.Status)
	}

	now := time.Now()
	record.Status = "processing"
	record.ReviewedBy = adminID
	record.ReviewedAt = &now
	if err := s.settlementRepo.UpdateWithdrawal(record); err != nil {
		return err
	}

	// 模拟转账成功 (实际应接入第三方支付)
	record.Status = "completed"
	record.CompletedAt = &now
	record.ThirdPartyNo = "MOCK_" + record.WithdrawalNo
	s.settlementRepo.UpdateWithdrawal(record)

	// 扣减冻结余额
	s.settlementRepo.DeductFrozenBalance(record.UserID, record.Amount, fmt.Sprintf("提现%s完成", record.WithdrawalNo))

	return nil
}

// RejectWithdrawal 拒绝提现
func (s *SettlementService) RejectWithdrawal(id, adminID int64, reason string) error {
	record, err := s.settlementRepo.GetWithdrawal(id)
	if err != nil {
		return errors.New("提现记录不存在")
	}
	if record.Status != "pending" {
		return fmt.Errorf("提现状态不正确: %s", record.Status)
	}

	now := time.Now()
	record.Status = "rejected"
	record.ReviewedBy = adminID
	record.ReviewedAt = &now
	record.ReviewNotes = reason
	if err := s.settlementRepo.UpdateWithdrawal(record); err != nil {
		return err
	}

	// 解冻余额
	return s.settlementRepo.UnfreezeWalletBalance(record.UserID, record.Amount, fmt.Sprintf("提现%s被拒绝", record.WithdrawalNo))
}

// ========== 查询 ==========

func (s *SettlementService) GetSettlement(id int64) (*model.OrderSettlement, error) {
	return s.settlementRepo.GetSettlement(id)
}

func (s *SettlementService) GetSettlementByOrder(orderID int64) (*model.OrderSettlement, error) {
	return s.settlementRepo.GetSettlementByOrder(orderID)
}

func (s *SettlementService) ListSettlements(status string, page, pageSize int) ([]model.OrderSettlement, int64, error) {
	return s.settlementRepo.ListSettlements(status, page, pageSize)
}

func (s *SettlementService) ListUserSettlements(userID int64, role string, page, pageSize int) ([]model.OrderSettlement, int64, error) {
	return s.settlementRepo.ListUserSettlements(userID, role, page, pageSize)
}

func (s *SettlementService) ListUserWithdrawals(userID int64, page, pageSize int) ([]model.WithdrawalRecord, int64, error) {
	return s.settlementRepo.ListUserWithdrawals(userID, page, pageSize)
}

func (s *SettlementService) ListPendingWithdrawals(page, pageSize int) ([]model.WithdrawalRecord, int64, error) {
	return s.settlementRepo.ListPendingWithdrawals(page, pageSize)
}

func (s *SettlementService) GetAllPricingConfigs() ([]model.PricingConfig, error) {
	return s.settlementRepo.GetAllPricingConfigs()
}

func (s *SettlementService) UpdatePricingConfig(key string, value float64) error {
	return s.settlementRepo.UpdatePricingConfig(key, value)
}

// ========== 批量结算 ==========

// ProcessPendingSettlements 处理待结算(定时任务调用)
func (s *SettlementService) ProcessPendingSettlements() (int, error) {
	settlements, err := s.settlementRepo.ListPendingSettlements()
	if err != nil {
		return 0, err
	}

	count := 0
	for _, settlement := range settlements {
		if err := s.ExecuteSettlement(settlement.ID); err != nil {
			s.logger.Error("Failed to execute settlement",
				zap.Int64("id", settlement.ID),
				zap.Error(err),
			)
			continue
		}
		count++
	}
	return count, nil
}

// ========== Helpers ==========

func (s *SettlementService) getConfigFloat(key string, defaultVal float64) float64 {
	val, err := s.settlementRepo.GetPricingConfig(key)
	if err != nil || val == 0 {
		return defaultVal
	}
	return val
}

func generateSettlementNo() string {
	return fmt.Sprintf("STL%d%04d", time.Now().UnixNano()/1e6, time.Now().Nanosecond()%10000)
}

func generateWithdrawalNo() string {
	return fmt.Sprintf("WD%d%04d", time.Now().UnixNano()/1e6, time.Now().Nanosecond()%10000)
}
