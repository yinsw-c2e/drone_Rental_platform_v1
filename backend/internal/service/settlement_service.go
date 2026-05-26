package service

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

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
	BaseFee          int64   `json:"base_fee"`
	MileageFee       int64   `json:"mileage_fee"`
	DurationFee      int64   `json:"duration_fee"`
	WeightFee        int64   `json:"weight_fee"`
	DifficultyFee    int64   `json:"difficulty_fee"`
	InsuranceFee     int64   `json:"insurance_fee"`
	SubTotal         int64   `json:"sub_total"`
	SurgePricing     int64   `json:"surge_pricing"`
	TotalAmount      int64   `json:"total_amount"`
	DifficultyFactor float64 `json:"difficulty_factor"`
	InsuranceRate    float64 `json:"insurance_rate"`
}

type SettlementDisputeResolution struct {
	Resolution         string
	NextStatus         string
	PlatformFee        *int64
	PilotFee           *int64
	OwnerFee           *int64
	InsuranceDeduction *int64
}

type ReconciliationExportFilter struct {
	Status    string
	TimeField string
	StartAt   *time.Time
	EndAt     *time.Time
	Limit     int
}

type FinanceAnomalyInput struct {
	AnomalyType  string
	Severity     string
	Source       string
	TargetType   string
	TargetID     int64
	OrderID      int64
	SettlementID int64
	WithdrawalID int64
	UserID       int64
	Message      string
	Detail       interface{}
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

type FinanceManualActionInput struct {
	ActionType     string
	TargetType     string
	TargetID       int64
	SettlementID   int64
	WithdrawalID   int64
	AnomalyID      int64
	AdminID        int64
	Reason         string
	BeforeSnapshot interface{}
	AfterSnapshot  interface{}
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

type FinanceOperationsOverview struct {
	Settlement   FinanceSettlementOverview   `json:"settlement"`
	Withdrawal   FinanceWithdrawalOverview   `json:"withdrawal"`
	Anomaly      FinanceAnomalyOverview      `json:"anomaly"`
	ManualAction FinanceManualActionOverview `json:"manual_action"`
	UpdatedAt    time.Time                   `json:"updated_at"`
}

type FinanceSettlementOverview struct {
	Pending                 int64 `json:"pending"`
	Calculated              int64 `json:"calculated"`
	Confirmed               int64 `json:"confirmed"`
	Disputed                int64 `json:"disputed"`
	SettledToday            int64 `json:"settled_today"`
	TotalSettledAmountToday int64 `json:"total_settled_amount_today"`
	TotalPlatformFeeToday   int64 `json:"total_platform_fee_today"`
}

type FinanceWithdrawalOverview struct {
	Pending        int64 `json:"pending"`
	CompletedToday int64 `json:"completed_today"`
	RejectedToday  int64 `json:"rejected_today"`
	PendingAmount  int64 `json:"pending_amount"`
}

type FinanceAnomalyOverview struct {
	Open          int64 `json:"open"`
	CriticalOpen  int64 `json:"critical_open"`
	WarningOpen   int64 `json:"warning_open"`
	ResolvedToday int64 `json:"resolved_today"`
}

type FinanceManualActionOverview struct {
	Applied         int64 `json:"applied"`
	RolledBackToday int64 `json:"rolled_back_today"`
}

type settlementRollbackSnapshot struct {
	ID                 int64      `json:"id"`
	SettlementNo       string     `json:"settlement_no"`
	OrderID            int64      `json:"order_id"`
	OrderNo            string     `json:"order_no"`
	FinalAmount        int64      `json:"final_amount"`
	PlatformFee        int64      `json:"platform_fee"`
	PilotFee           int64      `json:"pilot_fee"`
	OwnerFee           int64      `json:"owner_fee"`
	InsuranceDeduction int64      `json:"insurance_deduction"`
	PilotUserID        int64      `json:"pilot_user_id"`
	OwnerUserID        int64      `json:"owner_user_id"`
	PayerUserID        int64      `json:"payer_user_id"`
	Status             string     `json:"status"`
	ConfirmedAt        *time.Time `json:"confirmed_at"`
	SettledAt          *time.Time `json:"settled_at"`
	SettledBy          string     `json:"settled_by"`
	Notes              string     `json:"notes"`
}

type anomalyRollbackSnapshot struct {
	ID             int64      `json:"id"`
	AnomalyNo      string     `json:"anomaly_no"`
	AnomalyType    string     `json:"anomaly_type"`
	Severity       string     `json:"severity"`
	Status         string     `json:"status"`
	Source         string     `json:"source"`
	TargetType     string     `json:"target_type"`
	TargetID       int64      `json:"target_id"`
	OrderID        int64      `json:"order_id"`
	SettlementID   int64      `json:"settlement_id"`
	WithdrawalID   int64      `json:"withdrawal_id"`
	UserID         int64      `json:"user_id"`
	Message        string     `json:"message"`
	ResolvedBy     int64      `json:"resolved_by"`
	ResolvedAt     *time.Time `json:"resolved_at"`
	ResolutionNote string     `json:"resolution_note"`
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
	if rate0_5 == 0 {
		rate0_5 = 1500
	}
	if rate5_15 == 0 {
		rate5_15 = 1000
	}
	if rate15_50 == 0 {
		rate15_50 = 800
	}
	if rate50plus == 0 {
		rate50plus = 500
	}

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
	if freeMin == 0 {
		freeMin = 10
	}
	if rate == 0 {
		rate = 300
	}

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
	if rate0_5 == 0 {
		rate0_5 = 1000
	}
	if rate5_20 == 0 {
		rate5_20 = 3000
	}
	if rate20plus == 0 {
		rate20plus = 5000
	}

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
		if f == 0 {
			f = 2.0
		}
		return f
	}
	switch taskType {
	case "emergency":
		f, _ := s.settlementRepo.GetPricingConfig("difficulty_emergency")
		if f == 0 {
			f = 1.8
		}
		return f
	case "inspection":
		f, _ := s.settlementRepo.GetPricingConfig("difficulty_complex")
		if f == 0 {
			f = 1.3
		}
		return f
	default:
		return 1.0
	}
}

func (s *SettlementService) getInsuranceRate(cargoType string) float64 {
	switch cargoType {
	case "hazardous":
		r, _ := s.settlementRepo.GetPricingConfig("insurance_rate_hazardous")
		if r == 0 {
			r = 0.03
		}
		return r
	case "fragile":
		r, _ := s.settlementRepo.GetPricingConfig("insurance_rate_fragile")
		if r == 0 {
			r = 0.02
		}
		return r
	default:
		r, _ := s.settlementRepo.GetPricingConfig("insurance_rate_normal")
		if r == 0 {
			r = 0.01
		}
		return r
	}
}

func (s *SettlementService) calculateSurgePricing(subtotal int64, isPeak, isHoliday bool) int64 {
	if isHoliday {
		rate, _ := s.settlementRepo.GetPricingConfig("surge_holiday_rate")
		if rate == 0 {
			rate = 1.5
		}
		return int64(float64(subtotal) * (rate - 1.0))
	}
	if isPeak {
		rate, _ := s.settlementRepo.GetPricingConfig("surge_peak_rate")
		if rate == 0 {
			rate = 1.3
		}
		return int64(float64(subtotal) * (rate - 1.0))
	}
	// 空闲折扣 - 暂时不主动触发
	return 0
}

// ========== 结算引擎 ==========

// CreateSettlement 创建订单结算(订单完成时调用)
func (s *SettlementService) CreateSettlement(orderID int64) (*model.OrderSettlement, error) {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, errors.New("订单不存在")
	}

	expected, err := s.calculateOrderSettlement(order)
	if err != nil {
		return nil, err
	}

	existing, err := s.settlementRepo.GetSettlementByOrder(orderID)
	if err == nil && existing.ID > 0 {
		if s.refreshMutableSettlement(existing, expected) {
			if err := s.settlementRepo.UpdateSettlement(existing); err != nil {
				return nil, err
			}
			s.logger.Info("Settlement recalculated",
				zap.Int64("order_id", orderID),
				zap.Int64("settlement_id", existing.ID),
				zap.Int64("pilot_user_id", existing.PilotUserID),
				zap.Int64("owner_user_id", existing.OwnerUserID),
			)
		}
		return existing, nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	settlement := expected
	settlement.SettlementNo = generateSettlementNo()
	if err := s.settlementRepo.CreateSettlement(settlement); err != nil {
		return nil, err
	}

	s.logger.Info("Settlement created",
		zap.Int64("order_id", orderID),
		zap.String("settlement_no", settlement.SettlementNo),
		zap.Int64("total", settlement.FinalAmount),
		zap.Int64("platform_fee", settlement.PlatformFee),
		zap.Int64("pilot_fee", settlement.PilotFee),
		zap.Int64("owner_fee", settlement.OwnerFee),
	)

	return settlement, nil
}

func (s *SettlementService) calculateOrderSettlement(order *model.Order) (*model.OrderSettlement, error) {
	if order == nil || order.ID == 0 {
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
	pilotUserID, ownerUserID, payerUserID := resolveSettlementParticipants(order)

	return &model.OrderSettlement{
		OrderID:            order.ID,
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
		PilotUserID:        pilotUserID,
		OwnerUserID:        ownerUserID,
		PayerUserID:        payerUserID,
		FlightDistance:     float64(order.ActualFlightDistance),
		FlightDuration:     float64(order.ActualFlightDuration),
		CargoWeight:        order.CargoWeightKG,
		DifficultyFactor:   1,
		Status:             "calculated",
		CalculatedAt:       &now,
	}, nil
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
	var settlement *model.OrderSettlement
	if err := s.settlementRepo.Transaction(func(txRepo *repository.SettlementRepo) error {
		current, err := txRepo.GetSettlement(id)
		if err != nil {
			return errors.New("结算记录不存在")
		}
		settlement = current
		if current.Status == "settled" {
			return nil
		}
		if current.Status != "confirmed" {
			return fmt.Errorf("结算未确认: %s", current.Status)
		}

		// 给履约服务方钱包入账。仓储层按结算单、用户和描述做幂等保护，避免重试重复入账。
		if current.PilotUserID > 0 && current.PilotFee > 0 {
			err := txRepo.AddWalletIncome(current.PilotUserID, current.PilotFee,
				current.OrderID, current.ID, fmt.Sprintf("订单%s履约服务费", current.OrderNo))
			if err != nil {
				s.logger.Error("Failed to add pilot income", zap.Error(err))
				return fmt.Errorf("履约服务入账失败: %w", err)
			}
		}

		// 给设备服务方钱包入账。和履约服务入账放在同一事务内，避免只入一侧账。
		if current.OwnerUserID > 0 && current.OwnerFee > 0 {
			err := txRepo.AddWalletIncome(current.OwnerUserID, current.OwnerFee,
				current.OrderID, current.ID, fmt.Sprintf("订单%s设备服务费", current.OrderNo))
			if err != nil {
				s.logger.Error("Failed to add owner income", zap.Error(err))
				return fmt.Errorf("设备服务入账失败: %w", err)
			}
		}

		now := time.Now()
		current.Status = "settled"
		current.SettledAt = &now
		current.SettledBy = "system"
		if err := txRepo.UpdateSettlement(current); err != nil {
			return err
		}
		settlement = current
		return nil
	}); err != nil {
		s.recordSettlementFinanceAnomaly("settlement_execute_failed", "critical", id, settlement, err, nil)
		return err
	}

	s.logger.Info("Settlement executed",
		zap.Int64("settlement_id", id),
		zap.Int64("pilot_fee", settlement.PilotFee),
		zap.Int64("owner_fee", settlement.OwnerFee),
	)

	return nil
}

// FinalizeOrderSettlement 确认并执行订单结算，用于订单完成后的钱包入账闭环。
func (s *SettlementService) FinalizeOrderSettlement(orderID int64) (*model.OrderSettlement, error) {
	settlement, err := s.CreateSettlement(orderID)
	if err != nil {
		return nil, err
	}
	return s.FinalizeSettlement(settlement.ID)
}

// FinalizeSettlement 确认并执行一张结算单；已入账时直接返回，避免重复入账。
func (s *SettlementService) FinalizeSettlement(id int64) (*model.OrderSettlement, error) {
	settlement, err := s.GetSettlement(id)
	if err != nil {
		return nil, errors.New("结算记录不存在")
	}
	if settlement.Status == "settled" {
		return settlement, nil
	}
	if settlement.Status == "disputed" {
		return nil, fmt.Errorf("结算存在争议: %s", settlement.SettlementNo)
	}
	if settlement.Status == "" || settlement.Status == "pending" || settlement.Status == "calculated" {
		if err := s.ConfirmSettlement(settlement.ID); err != nil {
			return nil, err
		}
	}
	if err := s.ExecuteSettlement(settlement.ID); err != nil {
		return nil, err
	}
	return s.settlementRepo.GetSettlement(settlement.ID)
}

// MarkSettlementDisputed 将未入账结算标记为争议，阻止自动/手动入账。
func (s *SettlementService) MarkSettlementDisputed(id, adminID int64, reason string) (*model.OrderSettlement, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, errors.New("请填写争议原因")
	}

	var settlement *model.OrderSettlement
	if err := s.settlementRepo.Transaction(func(txRepo *repository.SettlementRepo) error {
		current, err := txRepo.GetSettlement(id)
		if err != nil {
			return errors.New("结算记录不存在")
		}
		if current.Status == "settled" {
			return errors.New("已入账结算不能标记争议")
		}
		if current.Status == "disputed" {
			return errors.New("结算已处于争议状态")
		}

		before := snapshotSettlement(current)
		current.Status = "disputed"
		current.Notes = appendSettlementNote(current.Notes, adminID, "标记争议", reason)
		if err := txRepo.UpdateSettlement(current); err != nil {
			return err
		}
		if err := txRepo.CreateFinanceManualAction(newFinanceManualAction(FinanceManualActionInput{
			ActionType:     "settlement_dispute_mark",
			TargetType:     "settlement",
			TargetID:       current.ID,
			SettlementID:   current.ID,
			AdminID:        adminID,
			Reason:         reason,
			BeforeSnapshot: before,
			AfterSnapshot:  snapshotSettlement(current),
		})); err != nil {
			return err
		}
		settlement = current
		return nil
	}); err != nil {
		return nil, err
	}
	return settlement, nil
}

// ResolveSettlementDispute 解除争议；可选手工调整分账金额，随后回到 calculated/confirmed 等待执行。
func (s *SettlementService) ResolveSettlementDispute(id, adminID int64, input SettlementDisputeResolution) (*model.OrderSettlement, error) {
	input.Resolution = strings.TrimSpace(input.Resolution)
	if input.Resolution == "" {
		return nil, errors.New("请填写处理结论")
	}
	input.NextStatus = strings.TrimSpace(input.NextStatus)
	if input.NextStatus == "" {
		input.NextStatus = "calculated"
	}
	if input.NextStatus != "calculated" && input.NextStatus != "confirmed" {
		return nil, errors.New("争议处理后状态只能为 calculated 或 confirmed")
	}

	var settlement *model.OrderSettlement
	if err := s.settlementRepo.Transaction(func(txRepo *repository.SettlementRepo) error {
		current, err := txRepo.GetSettlement(id)
		if err != nil {
			return errors.New("结算记录不存在")
		}
		settlement = current
		if current.Status != "disputed" {
			return fmt.Errorf("结算未处于争议状态: %s", current.Status)
		}

		before := snapshotSettlement(current)
		if err := applySettlementFeeAdjustment(current, input); err != nil {
			return err
		}

		now := time.Now()
		current.Status = input.NextStatus
		if input.NextStatus == "confirmed" {
			current.ConfirmedAt = &now
		} else {
			current.ConfirmedAt = nil
		}
		current.SettledAt = nil
		current.SettledBy = ""
		current.Notes = appendSettlementNote(current.Notes, adminID, "解除争议", input.Resolution)
		if err := txRepo.UpdateSettlement(current); err != nil {
			return err
		}
		if err := txRepo.CreateFinanceManualAction(newFinanceManualAction(FinanceManualActionInput{
			ActionType:     "settlement_dispute_resolve",
			TargetType:     "settlement",
			TargetID:       current.ID,
			SettlementID:   current.ID,
			AdminID:        adminID,
			Reason:         input.Resolution,
			BeforeSnapshot: before,
			AfterSnapshot:  snapshotSettlement(current),
		})); err != nil {
			return err
		}
		settlement = current
		return nil
	}); err != nil {
		if strings.Contains(err.Error(), "合计必须等于实付金额") {
			s.recordSettlementFinanceAnomaly("settlement_split_mismatch", "warning", id, settlement, err, map[string]interface{}{
				"admin_id":             adminID,
				"next_status":          input.NextStatus,
				"platform_fee":         input.PlatformFee,
				"pilot_fee":            input.PilotFee,
				"owner_fee":            input.OwnerFee,
				"insurance_deduction":  input.InsuranceDeduction,
				"resolution_truncated": truncateString(input.Resolution, 120),
			})
		}
		return nil, err
	}
	return settlement, nil
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
	accountInfo = normalizeWithdrawalAccount(accountInfo)
	method, err := validateWithdrawalRequest(amount, method, accountInfo)
	if err != nil {
		return nil, err
	}

	var record *model.WithdrawalRecord
	if err := s.settlementRepo.Transaction(func(txRepo *repository.SettlementRepo) error {
		wallet, err := txRepo.GetOrCreateWallet(userID, "general")
		if err != nil {
			return errors.New("获取钱包失败")
		}
		if wallet.AvailableBalance < amount {
			return fmt.Errorf("余额不足: 可用%.2f元, 申请提现%.2f元", float64(wallet.AvailableBalance)/100, float64(amount)/100)
		}

		// 计算手续费 (暂定0.1%, 最低1元)
		serviceFee := int64(math.Max(100, float64(amount)*0.001))
		actualAmount := amount - serviceFee
		if actualAmount <= 0 {
			return errors.New("提现金额不足以覆盖手续费")
		}

		record = &model.WithdrawalRecord{
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

		if err := txRepo.FreezeWalletBalance(userID, amount, fmt.Sprintf("提现%s冻结", record.WithdrawalNo)); err != nil {
			return err
		}

		return txRepo.CreateWithdrawal(record)
	}); err != nil {
		return nil, err
	}
	return record, nil
}

// ApproveWithdrawal 审批通过提现
func (s *SettlementService) ApproveWithdrawal(id, adminID int64) error {
	var record *model.WithdrawalRecord
	if err := s.settlementRepo.Transaction(func(txRepo *repository.SettlementRepo) error {
		current, err := txRepo.GetWithdrawal(id)
		if err != nil {
			return errors.New("提现记录不存在")
		}
		record = current
		if record.Status != "pending" {
			return fmt.Errorf("提现状态不正确: %s", record.Status)
		}

		now := time.Now()
		if err := txRepo.DeductFrozenBalance(record.UserID, record.Amount, fmt.Sprintf("提现%s完成", record.WithdrawalNo)); err != nil {
			return err
		}

		record.Status = "completed"
		record.ReviewedBy = adminID
		record.ReviewedAt = &now
		record.CompletedAt = &now
		record.ThirdPartyNo = "MOCK_" + record.WithdrawalNo
		return txRepo.UpdateWithdrawal(record)
	}); err != nil {
		s.recordWithdrawalFinanceAnomaly("withdrawal_approve_failed", "critical", id, record, err, map[string]interface{}{
			"admin_id": adminID,
		})
		return err
	}
	return nil
}

// RejectWithdrawal 拒绝提现
func (s *SettlementService) RejectWithdrawal(id, adminID int64, reason string) error {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return errors.New("请填写驳回原因")
	}

	var record *model.WithdrawalRecord
	if err := s.settlementRepo.Transaction(func(txRepo *repository.SettlementRepo) error {
		current, err := txRepo.GetWithdrawal(id)
		if err != nil {
			return errors.New("提现记录不存在")
		}
		record = current
		if record.Status != "pending" {
			return fmt.Errorf("提现状态不正确: %s", record.Status)
		}

		now := time.Now()
		if err := txRepo.UnfreezeWalletBalance(record.UserID, record.Amount, fmt.Sprintf("提现%s被拒绝", record.WithdrawalNo)); err != nil {
			return err
		}

		record.Status = "rejected"
		record.ReviewedBy = adminID
		record.ReviewedAt = &now
		record.ReviewNotes = reason
		return txRepo.UpdateWithdrawal(record)
	}); err != nil {
		s.recordWithdrawalFinanceAnomaly("withdrawal_reject_failed", "warning", id, record, err, map[string]interface{}{
			"admin_id": adminID,
			"reason":   reason,
		})
		return err
	}
	return nil
}

// ========== 查询 ==========

func (s *SettlementService) GetSettlement(id int64) (*model.OrderSettlement, error) {
	return s.settlementRepo.GetSettlement(id)
}

func (s *SettlementService) GetSettlementByOrder(orderID int64) (*model.OrderSettlement, error) {
	settlement, err := s.settlementRepo.GetSettlementByOrder(orderID)
	if err != nil {
		return nil, err
	}
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return settlement, nil
	}
	expected, err := s.calculateOrderSettlement(order)
	if err != nil {
		return settlement, nil
	}
	if s.refreshMutableSettlement(settlement, expected) {
		if err := s.settlementRepo.UpdateSettlement(settlement); err != nil {
			return nil, err
		}
	}
	return settlement, nil
}

func (s *SettlementService) ListSettlements(status string, page, pageSize int) ([]model.OrderSettlement, int64, error) {
	return s.settlementRepo.ListSettlements(status, page, pageSize)
}

func (s *SettlementService) ListSettlementsFiltered(filter ReconciliationExportFilter, page, pageSize int) ([]model.OrderSettlement, int64, error) {
	filter = normalizeReconciliationExportFilter(filter)
	return s.settlementRepo.ListSettlementsFiltered(filter.Status, filter.StartAt, filter.EndAt, filter.TimeField, page, pageSize)
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

func (s *SettlementService) ListWithdrawals(status string, page, pageSize int) ([]model.WithdrawalRecord, int64, error) {
	return s.settlementRepo.ListWithdrawals(status, page, pageSize)
}

func (s *SettlementService) GetWithdrawal(id int64) (*model.WithdrawalRecord, error) {
	return s.settlementRepo.GetWithdrawal(id)
}

func (s *SettlementService) ListWithdrawalsFiltered(filter ReconciliationExportFilter, page, pageSize int) ([]model.WithdrawalRecord, int64, error) {
	filter = normalizeReconciliationExportFilter(filter)
	return s.settlementRepo.ListWithdrawalsFiltered(filter.Status, filter.StartAt, filter.EndAt, filter.TimeField, page, pageSize)
}

func (s *SettlementService) ExportSettlementReconciliationCSV(filter ReconciliationExportFilter) ([]byte, error) {
	filter = normalizeReconciliationExportFilter(filter)
	rows, err := s.settlementRepo.ExportSettlements(filter.Status, filter.StartAt, filter.EndAt, filter.TimeField, filter.Limit)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)
	if err := writer.Write([]string{
		"结算ID",
		"结算单号",
		"订单ID",
		"订单号",
		"状态",
		"实付金额(分)",
		"平台服务费(分)",
		"履约服务费(分)",
		"设备服务费(分)",
		"保险代扣(分)",
		"履约服务方用户ID",
		"设备服务方用户ID",
		"付款用户ID",
		"创建时间",
		"确认时间",
		"入账时间",
		"入账方式",
		"备注",
	}); err != nil {
		return nil, err
	}
	for _, row := range rows {
		if err := writer.Write([]string{
			fmt.Sprintf("%d", row.ID),
			row.SettlementNo,
			fmt.Sprintf("%d", row.OrderID),
			row.OrderNo,
			row.Status,
			fmt.Sprintf("%d", row.FinalAmount),
			fmt.Sprintf("%d", row.PlatformFee),
			fmt.Sprintf("%d", row.PilotFee),
			fmt.Sprintf("%d", row.OwnerFee),
			fmt.Sprintf("%d", row.InsuranceDeduction),
			fmt.Sprintf("%d", row.PilotUserID),
			fmt.Sprintf("%d", row.OwnerUserID),
			fmt.Sprintf("%d", row.PayerUserID),
			formatCSVTime(&row.CreatedAt),
			formatCSVTime(row.ConfirmedAt),
			formatCSVTime(row.SettledAt),
			row.SettledBy,
			row.Notes,
		}); err != nil {
			return nil, err
		}
	}
	writer.Flush()
	return buf.Bytes(), writer.Error()
}

func (s *SettlementService) ExportWithdrawalReconciliationCSV(filter ReconciliationExportFilter) ([]byte, error) {
	filter = normalizeReconciliationExportFilter(filter)
	rows, err := s.settlementRepo.ExportWithdrawals(filter.Status, filter.StartAt, filter.EndAt, filter.TimeField, filter.Limit)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)
	if err := writer.Write([]string{
		"提现ID",
		"提现单号",
		"用户ID",
		"状态",
		"提现方式",
		"提现金额(分)",
		"手续费(分)",
		"实际到账(分)",
		"审核人ID",
		"审核时间",
		"完成时间",
		"第三方流水号",
		"审核备注",
		"失败原因",
		"创建时间",
	}); err != nil {
		return nil, err
	}
	for _, row := range rows {
		if err := writer.Write([]string{
			fmt.Sprintf("%d", row.ID),
			row.WithdrawalNo,
			fmt.Sprintf("%d", row.UserID),
			row.Status,
			row.WithdrawMethod,
			fmt.Sprintf("%d", row.Amount),
			fmt.Sprintf("%d", row.ServiceFee),
			fmt.Sprintf("%d", row.ActualAmount),
			fmt.Sprintf("%d", row.ReviewedBy),
			formatCSVTime(row.ReviewedAt),
			formatCSVTime(row.CompletedAt),
			row.ThirdPartyNo,
			row.ReviewNotes,
			row.FailReason,
			formatCSVTime(&row.CreatedAt),
		}); err != nil {
			return nil, err
		}
	}
	writer.Flush()
	return buf.Bytes(), writer.Error()
}

func (s *SettlementService) GetAllPricingConfigs() ([]model.PricingConfig, error) {
	return s.settlementRepo.GetAllPricingConfigs()
}

func (s *SettlementService) UpdatePricingConfig(key string, value float64) error {
	return s.settlementRepo.UpdatePricingConfig(key, value)
}

// ========== 财务异常 ==========

func (s *SettlementService) RecordFinanceAnomaly(input FinanceAnomalyInput) (*model.FinanceAnomalyRecord, error) {
	input = normalizeFinanceAnomalyInput(input)
	if input.AnomalyType == "" {
		return nil, errors.New("异常类型不能为空")
	}
	if input.Message == "" {
		return nil, errors.New("异常说明不能为空")
	}

	rawDetail := []byte("null")
	if input.Detail != nil {
		raw, err := json.Marshal(input.Detail)
		if err != nil {
			return nil, fmt.Errorf("异常详情序列化失败: %w", err)
		}
		rawDetail = raw
	}

	record := &model.FinanceAnomalyRecord{
		AnomalyNo:    generateFinanceAnomalyNo(),
		AnomalyType:  input.AnomalyType,
		Severity:     input.Severity,
		Status:       "open",
		Source:       input.Source,
		TargetType:   input.TargetType,
		TargetID:     input.TargetID,
		OrderID:      input.OrderID,
		SettlementID: input.SettlementID,
		WithdrawalID: input.WithdrawalID,
		UserID:       input.UserID,
		Message:      input.Message,
		Detail:       model.JSON(rawDetail),
	}
	if err := s.settlementRepo.CreateFinanceAnomaly(record); err != nil {
		return nil, err
	}
	return record, nil
}

func (s *SettlementService) ListFinanceAnomalies(filter FinanceAnomalyFilter, page, pageSize int) ([]model.FinanceAnomalyRecord, int64, error) {
	filter = normalizeFinanceAnomalyFilter(filter)
	return s.settlementRepo.ListFinanceAnomalies(repository.FinanceAnomalyFilter{
		Status:       filter.Status,
		Severity:     filter.Severity,
		AnomalyType:  filter.AnomalyType,
		Source:       filter.Source,
		TargetType:   filter.TargetType,
		TargetID:     filter.TargetID,
		OrderID:      filter.OrderID,
		SettlementID: filter.SettlementID,
		WithdrawalID: filter.WithdrawalID,
		UserID:       filter.UserID,
		Keyword:      filter.Keyword,
	}, normalizePage(page), normalizePageSize(pageSize))
}

func (s *SettlementService) ResolveFinanceAnomaly(id, adminID int64, note string) (*model.FinanceAnomalyRecord, error) {
	note = strings.TrimSpace(note)
	if note == "" {
		return nil, errors.New("请填写处理说明")
	}
	var record *model.FinanceAnomalyRecord
	if err := s.settlementRepo.Transaction(func(txRepo *repository.SettlementRepo) error {
		current, err := txRepo.GetFinanceAnomaly(id)
		if err != nil {
			return err
		}
		if current.Status == "resolved" {
			record = current
			return nil
		}

		before := snapshotFinanceAnomaly(current)
		now := time.Now()
		current.Status = "resolved"
		current.ResolvedBy = adminID
		current.ResolvedAt = &now
		current.ResolutionNote = note
		if err := txRepo.UpdateFinanceAnomaly(current); err != nil {
			return err
		}
		if err := txRepo.CreateFinanceManualAction(newFinanceManualAction(FinanceManualActionInput{
			ActionType:     "finance_anomaly_resolve",
			TargetType:     "finance_anomaly",
			TargetID:       current.ID,
			SettlementID:   current.SettlementID,
			WithdrawalID:   current.WithdrawalID,
			AnomalyID:      current.ID,
			AdminID:        adminID,
			Reason:         note,
			BeforeSnapshot: before,
			AfterSnapshot:  snapshotFinanceAnomaly(current),
		})); err != nil {
			return err
		}
		record = current
		return nil
	}); err != nil {
		return nil, err
	}
	return record, nil
}

func (s *SettlementService) ListFinanceManualActions(filter FinanceManualActionFilter, page, pageSize int) ([]model.FinanceManualActionRecord, int64, error) {
	filter = normalizeFinanceManualActionFilter(filter)
	return s.settlementRepo.ListFinanceManualActions(repository.FinanceManualActionFilter{
		Status:       filter.Status,
		ActionType:   filter.ActionType,
		TargetType:   filter.TargetType,
		TargetID:     filter.TargetID,
		SettlementID: filter.SettlementID,
		WithdrawalID: filter.WithdrawalID,
		AnomalyID:    filter.AnomalyID,
		AdminID:      filter.AdminID,
		Keyword:      filter.Keyword,
	}, normalizePage(page), normalizePageSize(pageSize))
}

func (s *SettlementService) GetFinanceOperationsOverview(now time.Time) (*FinanceOperationsOverview, error) {
	if now.IsZero() {
		now = time.Now()
	}
	localNow := now.In(time.Local)
	startOfDay := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 0, 0, 0, 0, localNow.Location())
	endOfDay := startOfDay.AddDate(0, 0, 1)

	overview := &FinanceOperationsOverview{UpdatedAt: now}

	var err error
	if overview.Settlement.Pending, err = s.settlementRepo.CountSettlementsByStatus("pending"); err != nil {
		return nil, fmt.Errorf("统计待计算结算失败: %w", err)
	}
	if overview.Settlement.Calculated, err = s.settlementRepo.CountSettlementsByStatus("calculated"); err != nil {
		return nil, fmt.Errorf("统计已计算结算失败: %w", err)
	}
	if overview.Settlement.Confirmed, err = s.settlementRepo.CountSettlementsByStatus("confirmed"); err != nil {
		return nil, fmt.Errorf("统计待入账结算失败: %w", err)
	}
	if overview.Settlement.Disputed, err = s.settlementRepo.CountSettlementsByStatus("disputed"); err != nil {
		return nil, fmt.Errorf("统计争议结算失败: %w", err)
	}
	settledToday, err := s.settlementRepo.SettledSettlementStats(startOfDay, endOfDay)
	if err != nil {
		return nil, fmt.Errorf("统计今日结算失败: %w", err)
	}
	overview.Settlement.SettledToday = settledToday.Count
	overview.Settlement.TotalSettledAmountToday = settledToday.TotalAmount
	overview.Settlement.TotalPlatformFeeToday = settledToday.PlatformFee

	pendingWithdrawal, err := s.settlementRepo.WithdrawalStatsByStatus("pending", "", nil, nil)
	if err != nil {
		return nil, fmt.Errorf("统计待审核提现失败: %w", err)
	}
	overview.Withdrawal.Pending = pendingWithdrawal.Count
	overview.Withdrawal.PendingAmount = pendingWithdrawal.Amount
	completedWithdrawal, err := s.settlementRepo.WithdrawalStatsByStatus("completed", "completed_at", &startOfDay, &endOfDay)
	if err != nil {
		return nil, fmt.Errorf("统计今日完成提现失败: %w", err)
	}
	overview.Withdrawal.CompletedToday = completedWithdrawal.Count
	rejectedWithdrawal, err := s.settlementRepo.WithdrawalStatsByStatus("rejected", "reviewed_at", &startOfDay, &endOfDay)
	if err != nil {
		return nil, fmt.Errorf("统计今日驳回提现失败: %w", err)
	}
	overview.Withdrawal.RejectedToday = rejectedWithdrawal.Count

	if overview.Anomaly.Open, err = s.settlementRepo.CountFinanceAnomalies(repository.FinanceAnomalyFilter{Status: "open"}); err != nil {
		return nil, fmt.Errorf("统计未处理财务异常失败: %w", err)
	}
	if overview.Anomaly.CriticalOpen, err = s.settlementRepo.CountFinanceAnomalies(repository.FinanceAnomalyFilter{Status: "open", Severity: "critical"}); err != nil {
		return nil, fmt.Errorf("统计严重财务异常失败: %w", err)
	}
	if overview.Anomaly.WarningOpen, err = s.settlementRepo.CountFinanceAnomalies(repository.FinanceAnomalyFilter{Status: "open", Severity: "warning"}); err != nil {
		return nil, fmt.Errorf("统计警告财务异常失败: %w", err)
	}
	if overview.Anomaly.ResolvedToday, err = s.settlementRepo.CountResolvedFinanceAnomalies(startOfDay, endOfDay); err != nil {
		return nil, fmt.Errorf("统计今日处理财务异常失败: %w", err)
	}

	if overview.ManualAction.Applied, err = s.settlementRepo.CountFinanceManualActions(repository.FinanceManualActionFilter{Status: "applied"}); err != nil {
		return nil, fmt.Errorf("统计生效人工处理失败: %w", err)
	}
	if overview.ManualAction.RolledBackToday, err = s.settlementRepo.CountRolledBackFinanceManualActions(startOfDay, endOfDay); err != nil {
		return nil, fmt.Errorf("统计今日回滚人工处理失败: %w", err)
	}

	return overview, nil
}

func (s *SettlementService) RollbackFinanceManualAction(id, adminID int64, note string) (*model.FinanceManualActionRecord, error) {
	note = strings.TrimSpace(note)
	if note == "" {
		return nil, errors.New("请填写回滚原因")
	}

	var action *model.FinanceManualActionRecord
	if err := s.settlementRepo.Transaction(func(txRepo *repository.SettlementRepo) error {
		currentAction, err := txRepo.GetFinanceManualAction(id)
		if err != nil {
			return errors.New("人工处理记录不存在")
		}
		if currentAction.Status != "applied" {
			return fmt.Errorf("人工处理记录状态不允许回滚: %s", currentAction.Status)
		}

		switch currentAction.TargetType {
		case "settlement":
			if err := rollbackSettlementManualAction(txRepo, currentAction); err != nil {
				return err
			}
		case "finance_anomaly":
			if err := rollbackFinanceAnomalyManualAction(txRepo, currentAction); err != nil {
				return err
			}
		default:
			return fmt.Errorf("不支持回滚目标类型: %s", currentAction.TargetType)
		}

		now := time.Now()
		currentAction.Status = "rolled_back"
		currentAction.RollbackBy = adminID
		currentAction.RollbackAt = &now
		currentAction.RollbackNote = note
		if err := txRepo.UpdateFinanceManualAction(currentAction); err != nil {
			return err
		}
		action = currentAction
		return nil
	}); err != nil {
		return nil, err
	}
	return action, nil
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

func (s *SettlementService) recordSettlementFinanceAnomaly(anomalyType, severity string, settlementID int64, settlement *model.OrderSettlement, cause error, extra map[string]interface{}) {
	detail := map[string]interface{}{
		"error":         cause.Error(),
		"settlement_id": settlementID,
	}
	input := FinanceAnomalyInput{
		AnomalyType:  anomalyType,
		Severity:     severity,
		Source:       "settlement",
		TargetType:   "settlement",
		TargetID:     settlementID,
		SettlementID: settlementID,
		Message:      truncateString(cause.Error(), 255),
		Detail:       mergeFinanceAnomalyDetail(detail, extra),
	}
	if settlement != nil {
		input.OrderID = settlement.OrderID
		input.UserID = firstPositiveInt64(settlement.PilotUserID, settlement.OwnerUserID, settlement.PayerUserID)
		detail["settlement_no"] = settlement.SettlementNo
		detail["order_id"] = settlement.OrderID
		detail["order_no"] = settlement.OrderNo
		detail["status"] = settlement.Status
		detail["pilot_user_id"] = settlement.PilotUserID
		detail["owner_user_id"] = settlement.OwnerUserID
		detail["payer_user_id"] = settlement.PayerUserID
		detail["final_amount"] = settlement.FinalAmount
		detail["platform_fee"] = settlement.PlatformFee
		detail["pilot_fee"] = settlement.PilotFee
		detail["owner_fee"] = settlement.OwnerFee
		detail["insurance_deduction"] = settlement.InsuranceDeduction
	}
	s.recordFinanceAnomaly(input)
}

func (s *SettlementService) recordWithdrawalFinanceAnomaly(anomalyType, severity string, withdrawalID int64, record *model.WithdrawalRecord, cause error, extra map[string]interface{}) {
	detail := map[string]interface{}{
		"error":         cause.Error(),
		"withdrawal_id": withdrawalID,
	}
	input := FinanceAnomalyInput{
		AnomalyType:  anomalyType,
		Severity:     severity,
		Source:       "withdrawal",
		TargetType:   "withdrawal",
		TargetID:     withdrawalID,
		WithdrawalID: withdrawalID,
		Message:      truncateString(cause.Error(), 255),
		Detail:       mergeFinanceAnomalyDetail(detail, extra),
	}
	if record != nil {
		input.UserID = record.UserID
		detail["withdrawal_no"] = record.WithdrawalNo
		detail["user_id"] = record.UserID
		detail["wallet_id"] = record.WalletID
		detail["amount"] = record.Amount
		detail["service_fee"] = record.ServiceFee
		detail["actual_amount"] = record.ActualAmount
		detail["withdraw_method"] = record.WithdrawMethod
		detail["status"] = record.Status
	}
	s.recordFinanceAnomaly(input)
}

func (s *SettlementService) recordFinanceAnomaly(input FinanceAnomalyInput) {
	if _, err := s.RecordFinanceAnomaly(input); err != nil {
		s.logger.Warn("Failed to record finance anomaly",
			zap.String("anomaly_type", input.AnomalyType),
			zap.String("target_type", input.TargetType),
			zap.Int64("target_id", input.TargetID),
			zap.Error(err),
		)
	}
}

func mergeFinanceAnomalyDetail(base, extra map[string]interface{}) map[string]interface{} {
	for key, value := range extra {
		base[key] = value
	}
	return base
}

func normalizeFinanceAnomalyInput(input FinanceAnomalyInput) FinanceAnomalyInput {
	input.AnomalyType = strings.TrimSpace(input.AnomalyType)
	input.Severity = strings.TrimSpace(input.Severity)
	input.Source = strings.TrimSpace(input.Source)
	input.TargetType = strings.TrimSpace(input.TargetType)
	input.Message = strings.TrimSpace(input.Message)
	if input.Severity == "" {
		input.Severity = "warning"
	}
	if input.Source == "" {
		input.Source = "finance"
	}
	if input.TargetType == "" {
		input.TargetType = "finance"
	}
	return input
}

func normalizeFinanceAnomalyFilter(filter FinanceAnomalyFilter) FinanceAnomalyFilter {
	filter.Status = strings.TrimSpace(filter.Status)
	filter.Severity = strings.TrimSpace(filter.Severity)
	filter.AnomalyType = strings.TrimSpace(filter.AnomalyType)
	filter.Source = strings.TrimSpace(filter.Source)
	filter.TargetType = strings.TrimSpace(filter.TargetType)
	filter.Keyword = strings.TrimSpace(filter.Keyword)
	return filter
}

func newFinanceManualAction(input FinanceManualActionInput) *model.FinanceManualActionRecord {
	input = normalizeFinanceManualActionInput(input)
	return &model.FinanceManualActionRecord{
		ActionNo:       generateFinanceManualActionNo(),
		ActionType:     input.ActionType,
		Status:         "applied",
		TargetType:     input.TargetType,
		TargetID:       input.TargetID,
		SettlementID:   input.SettlementID,
		WithdrawalID:   input.WithdrawalID,
		AnomalyID:      input.AnomalyID,
		AdminID:        input.AdminID,
		Reason:         input.Reason,
		BeforeSnapshot: mustJSONSnapshot(input.BeforeSnapshot),
		AfterSnapshot:  mustJSONSnapshot(input.AfterSnapshot),
	}
}

func normalizeFinanceManualActionInput(input FinanceManualActionInput) FinanceManualActionInput {
	input.ActionType = strings.TrimSpace(input.ActionType)
	input.TargetType = strings.TrimSpace(input.TargetType)
	input.Reason = strings.TrimSpace(input.Reason)
	if input.TargetType == "" {
		input.TargetType = "finance"
	}
	return input
}

func normalizeFinanceManualActionFilter(filter FinanceManualActionFilter) FinanceManualActionFilter {
	filter.Status = strings.TrimSpace(filter.Status)
	filter.ActionType = strings.TrimSpace(filter.ActionType)
	filter.TargetType = strings.TrimSpace(filter.TargetType)
	filter.Keyword = strings.TrimSpace(filter.Keyword)
	return filter
}

func snapshotSettlement(settlement *model.OrderSettlement) settlementRollbackSnapshot {
	if settlement == nil {
		return settlementRollbackSnapshot{}
	}
	return settlementRollbackSnapshot{
		ID:                 settlement.ID,
		SettlementNo:       settlement.SettlementNo,
		OrderID:            settlement.OrderID,
		OrderNo:            settlement.OrderNo,
		FinalAmount:        settlement.FinalAmount,
		PlatformFee:        settlement.PlatformFee,
		PilotFee:           settlement.PilotFee,
		OwnerFee:           settlement.OwnerFee,
		InsuranceDeduction: settlement.InsuranceDeduction,
		PilotUserID:        settlement.PilotUserID,
		OwnerUserID:        settlement.OwnerUserID,
		PayerUserID:        settlement.PayerUserID,
		Status:             settlement.Status,
		ConfirmedAt:        settlement.ConfirmedAt,
		SettledAt:          settlement.SettledAt,
		SettledBy:          settlement.SettledBy,
		Notes:              settlement.Notes,
	}
}

func snapshotFinanceAnomaly(record *model.FinanceAnomalyRecord) anomalyRollbackSnapshot {
	if record == nil {
		return anomalyRollbackSnapshot{}
	}
	return anomalyRollbackSnapshot{
		ID:             record.ID,
		AnomalyNo:      record.AnomalyNo,
		AnomalyType:    record.AnomalyType,
		Severity:       record.Severity,
		Status:         record.Status,
		Source:         record.Source,
		TargetType:     record.TargetType,
		TargetID:       record.TargetID,
		OrderID:        record.OrderID,
		SettlementID:   record.SettlementID,
		WithdrawalID:   record.WithdrawalID,
		UserID:         record.UserID,
		Message:        record.Message,
		ResolvedBy:     record.ResolvedBy,
		ResolvedAt:     record.ResolvedAt,
		ResolutionNote: record.ResolutionNote,
	}
}

func mustJSONSnapshot(value interface{}) model.JSON {
	raw, err := json.Marshal(value)
	if err != nil {
		raw = []byte("null")
	}
	return model.JSON(raw)
}

func decodeSettlementSnapshot(raw model.JSON) (settlementRollbackSnapshot, error) {
	var snapshot settlementRollbackSnapshot
	if err := json.Unmarshal(raw, &snapshot); err != nil {
		return settlementRollbackSnapshot{}, err
	}
	return snapshot, nil
}

func decodeAnomalySnapshot(raw model.JSON) (anomalyRollbackSnapshot, error) {
	var snapshot anomalyRollbackSnapshot
	if err := json.Unmarshal(raw, &snapshot); err != nil {
		return anomalyRollbackSnapshot{}, err
	}
	return snapshot, nil
}

func rollbackSettlementManualAction(txRepo *repository.SettlementRepo, action *model.FinanceManualActionRecord) error {
	settlementID := firstPositiveInt64(action.SettlementID, action.TargetID)
	current, err := txRepo.GetSettlement(settlementID)
	if err != nil {
		return errors.New("结算记录不存在")
	}
	if current.Status == "settled" {
		return errors.New("已入账结算不能自动回滚人工处理")
	}

	before, err := decodeSettlementSnapshot(action.BeforeSnapshot)
	if err != nil {
		return fmt.Errorf("处理前快照损坏: %w", err)
	}
	after, err := decodeSettlementSnapshot(action.AfterSnapshot)
	if err != nil {
		return fmt.Errorf("处理后快照损坏: %w", err)
	}
	if !settlementSnapshotMatches(current, after) {
		return errors.New("结算已发生后续变更，不能自动回滚")
	}

	applySettlementSnapshot(current, before)
	if err := txRepo.UpdateSettlement(current); err != nil {
		return err
	}
	action.RollbackSnapshot = mustJSONSnapshot(snapshotSettlement(current))
	return nil
}

func rollbackFinanceAnomalyManualAction(txRepo *repository.SettlementRepo, action *model.FinanceManualActionRecord) error {
	anomalyID := firstPositiveInt64(action.AnomalyID, action.TargetID)
	current, err := txRepo.GetFinanceAnomaly(anomalyID)
	if err != nil {
		return errors.New("财务异常记录不存在")
	}

	before, err := decodeAnomalySnapshot(action.BeforeSnapshot)
	if err != nil {
		return fmt.Errorf("处理前快照损坏: %w", err)
	}
	after, err := decodeAnomalySnapshot(action.AfterSnapshot)
	if err != nil {
		return fmt.Errorf("处理后快照损坏: %w", err)
	}
	if !anomalySnapshotMatches(current, after) {
		return errors.New("财务异常已发生后续变更，不能自动回滚")
	}

	applyAnomalySnapshot(current, before)
	if err := txRepo.UpdateFinanceAnomaly(current); err != nil {
		return err
	}
	action.RollbackSnapshot = mustJSONSnapshot(snapshotFinanceAnomaly(current))
	return nil
}

func settlementSnapshotMatches(current *model.OrderSettlement, snapshot settlementRollbackSnapshot) bool {
	if current == nil {
		return false
	}
	return current.ID == snapshot.ID &&
		current.Status == snapshot.Status &&
		current.PlatformFee == snapshot.PlatformFee &&
		current.PilotFee == snapshot.PilotFee &&
		current.OwnerFee == snapshot.OwnerFee &&
		current.InsuranceDeduction == snapshot.InsuranceDeduction &&
		timePtrEqual(current.ConfirmedAt, snapshot.ConfirmedAt) &&
		timePtrEqual(current.SettledAt, snapshot.SettledAt) &&
		current.SettledBy == snapshot.SettledBy &&
		current.Notes == snapshot.Notes
}

func anomalySnapshotMatches(current *model.FinanceAnomalyRecord, snapshot anomalyRollbackSnapshot) bool {
	if current == nil {
		return false
	}
	return current.ID == snapshot.ID &&
		current.Status == snapshot.Status &&
		current.ResolvedBy == snapshot.ResolvedBy &&
		current.ResolutionNote == snapshot.ResolutionNote
}

func applySettlementSnapshot(current *model.OrderSettlement, snapshot settlementRollbackSnapshot) {
	current.PlatformFee = snapshot.PlatformFee
	current.PilotFee = snapshot.PilotFee
	current.OwnerFee = snapshot.OwnerFee
	current.InsuranceDeduction = snapshot.InsuranceDeduction
	current.Status = snapshot.Status
	current.ConfirmedAt = snapshot.ConfirmedAt
	current.SettledAt = snapshot.SettledAt
	current.SettledBy = snapshot.SettledBy
	current.Notes = snapshot.Notes
}

func applyAnomalySnapshot(current *model.FinanceAnomalyRecord, snapshot anomalyRollbackSnapshot) {
	current.Status = snapshot.Status
	current.ResolvedBy = snapshot.ResolvedBy
	current.ResolvedAt = snapshot.ResolvedAt
	current.ResolutionNote = snapshot.ResolutionNote
}

func timePtrEqual(left, right *time.Time) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return left.Equal(*right)
}

func normalizePage(page int) int {
	if page <= 0 {
		return 1
	}
	return page
}

func normalizePageSize(pageSize int) int {
	if pageSize <= 0 {
		return 20
	}
	if pageSize > 100 {
		return 100
	}
	return pageSize
}

func generateFinanceAnomalyNo() string {
	return fmt.Sprintf("FAN%d", time.Now().UnixNano())
}

func generateFinanceManualActionNo() string {
	return fmt.Sprintf("FMA%d", time.Now().UnixNano())
}

func truncateString(value string, limit int) string {
	if limit <= 0 || len(value) <= limit {
		return value
	}
	return value[:limit]
}

func normalizeWithdrawalAccount(accountInfo map[string]string) map[string]string {
	normalized := make(map[string]string, len(accountInfo))
	for key, value := range accountInfo {
		normalized[key] = strings.TrimSpace(value)
	}
	return normalized
}

func validateWithdrawalRequest(amount int64, method string, accountInfo map[string]string) (string, error) {
	if amount <= 0 {
		return "", errors.New("提现金额必须大于0")
	}
	if amount <= 100 {
		return "", errors.New("最低提现金额为2元")
	}

	method = strings.ToLower(strings.TrimSpace(method))
	switch method {
	case "bank_card":
		if accountInfo["bank_name"] == "" {
			return "", errors.New("请输入银行名称")
		}
		if accountInfo["account_no"] == "" {
			return "", errors.New("请输入银行卡号")
		}
		if accountInfo["account_name"] == "" {
			return "", errors.New("请输入持卡人姓名")
		}
	case "alipay":
		if accountInfo["alipay_account"] == "" {
			return "", errors.New("请输入支付宝账号")
		}
	case "wechat":
		if accountInfo["wechat_account"] == "" {
			return "", errors.New("请输入微信账号")
		}
	default:
		return "", errors.New("不支持的提现方式")
	}
	return method, nil
}

func normalizeReconciliationExportFilter(filter ReconciliationExportFilter) ReconciliationExportFilter {
	filter.Status = strings.TrimSpace(filter.Status)
	filter.TimeField = strings.TrimSpace(filter.TimeField)
	if filter.Limit <= 0 {
		filter.Limit = 5000
	}
	if filter.Limit > 50000 {
		filter.Limit = 50000
	}
	return filter
}

func formatCSVTime(value *time.Time) string {
	if value == nil || value.IsZero() {
		return ""
	}
	return value.Format(time.RFC3339)
}

func resolveSettlementParticipants(order *model.Order) (pilotUserID, ownerUserID, payerUserID int64) {
	if order == nil {
		return 0, 0, 0
	}

	pilotUserID = firstPositiveInt64(order.ExecutorPilotUserID)
	if pilotUserID == 0 && order.ExecutionMode == "self_execute" {
		pilotUserID = firstPositiveInt64(order.ProviderUserID, order.OwnerID, order.DroneOwnerUserID)
	}
	if pilotUserID == 0 {
		pilotUserID = firstPositiveInt64(order.ProviderUserID, order.OwnerID, order.DroneOwnerUserID)
	}

	ownerUserID = firstPositiveInt64(order.DroneOwnerUserID, order.ProviderUserID, order.OwnerID)
	payerUserID = firstPositiveInt64(order.ClientUserID, order.RenterID, order.ClientID)
	return pilotUserID, ownerUserID, payerUserID
}

func firstPositiveInt64(values ...int64) int64 {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 0
}

func applySettlementFeeAdjustment(settlement *model.OrderSettlement, input SettlementDisputeResolution) error {
	if settlement == nil {
		return errors.New("结算记录不存在")
	}

	changed := false
	applyNonNegative := func(target *int64, value *int64, fieldName string) error {
		if value == nil {
			return nil
		}
		if *value < 0 {
			return fmt.Errorf("%s不能为负数", fieldName)
		}
		*target = *value
		changed = true
		return nil
	}
	if err := applyNonNegative(&settlement.PlatformFee, input.PlatformFee, "平台服务费"); err != nil {
		return err
	}
	if err := applyNonNegative(&settlement.PilotFee, input.PilotFee, "履约服务费"); err != nil {
		return err
	}
	if err := applyNonNegative(&settlement.OwnerFee, input.OwnerFee, "设备服务费"); err != nil {
		return err
	}
	if err := applyNonNegative(&settlement.InsuranceDeduction, input.InsuranceDeduction, "保险代扣"); err != nil {
		return err
	}
	if !changed {
		return nil
	}

	feeTotal := settlement.PlatformFee + settlement.PilotFee + settlement.OwnerFee + settlement.InsuranceDeduction
	if feeTotal != settlement.FinalAmount {
		return fmt.Errorf("分账金额合计必须等于实付金额: 合计%d, 实付%d", feeTotal, settlement.FinalAmount)
	}
	return nil
}

func appendSettlementNote(existing string, adminID int64, action, detail string) string {
	note := fmt.Sprintf("%s admin#%d %s: %s", time.Now().Format("2006-01-02 15:04:05"), adminID, action, detail)
	existing = strings.TrimSpace(existing)
	if existing == "" {
		return note
	}
	return existing + "\n" + note
}

func (s *SettlementService) refreshMutableSettlement(existing, expected *model.OrderSettlement) bool {
	if existing == nil || expected == nil {
		return false
	}
	if existing.Status != "" && existing.Status != "pending" && existing.Status != "calculated" {
		return false
	}

	changed := false
	assignInt64 := func(target *int64, value int64) {
		if *target != value {
			*target = value
			changed = true
		}
	}
	assignFloat64 := func(target *float64, value float64) {
		if *target != value {
			*target = value
			changed = true
		}
	}
	assignString := func(target *string, value string) {
		if *target != value {
			*target = value
			changed = true
		}
	}

	assignString(&existing.OrderNo, expected.OrderNo)
	assignInt64(&existing.TotalAmount, expected.TotalAmount)
	assignInt64(&existing.FinalAmount, expected.FinalAmount)
	assignFloat64(&existing.PlatformFeeRate, expected.PlatformFeeRate)
	assignInt64(&existing.PlatformFee, expected.PlatformFee)
	assignFloat64(&existing.PilotFeeRate, expected.PilotFeeRate)
	assignInt64(&existing.PilotFee, expected.PilotFee)
	assignFloat64(&existing.OwnerFeeRate, expected.OwnerFeeRate)
	assignInt64(&existing.OwnerFee, expected.OwnerFee)
	assignInt64(&existing.InsuranceDeduction, expected.InsuranceDeduction)
	assignInt64(&existing.PilotUserID, expected.PilotUserID)
	assignInt64(&existing.OwnerUserID, expected.OwnerUserID)
	assignInt64(&existing.PayerUserID, expected.PayerUserID)
	assignFloat64(&existing.FlightDistance, expected.FlightDistance)
	assignFloat64(&existing.FlightDuration, expected.FlightDuration)
	assignFloat64(&existing.CargoWeight, expected.CargoWeight)
	assignFloat64(&existing.DifficultyFactor, expected.DifficultyFactor)

	if existing.CalculatedAt == nil && expected.CalculatedAt != nil {
		existing.CalculatedAt = expected.CalculatedAt
		changed = true
	}
	if existing.Status == "" {
		existing.Status = "calculated"
		changed = true
	}
	return changed
}

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
