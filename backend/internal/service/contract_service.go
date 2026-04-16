package service

import (
	"bytes"
	"errors"
	"fmt"
	"html/template"
	"time"

	"gorm.io/gorm"

	"wurenji-backend/internal/config"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type ContractService struct {
	contractRepo *repository.ContractRepo
	orderRepo    *repository.OrderRepo
	userRepo     *repository.UserRepo
	eventService *EventService
	cfg          *config.Config
}

func NewContractService(
	contractRepo *repository.ContractRepo,
	orderRepo *repository.OrderRepo,
	userRepo *repository.UserRepo,
	cfg *config.Config,
) *ContractService {
	return &ContractService{
		contractRepo: contractRepo,
		orderRepo:    orderRepo,
		userRepo:     userRepo,
		cfg:          cfg,
	}
}

func (s *ContractService) SetEventService(eventService *EventService) {
	s.eventService = eventService
}

// ─── 合同编号生成 ────────────────────────────────────────

func generateContractNo() string {
	return fmt.Sprintf("CT%s%04d", time.Now().Format("20060102150405"), time.Now().Nanosecond()%10000)
}

// ─── 合同模板数据 ────────────────────────────────────────

type contractTemplateData struct {
	ContractNo         string
	Title              string
	ClientName         string
	ClientPhone        string
	ProviderName       string
	ProviderPhone      string
	ServiceDescription string
	ServiceAddress     string
	ScheduledStart     string
	ScheduledEnd       string
	CargoWeightKG      float64
	EstimatedTripCount int
	ContractAmount     string
	PlatformCommission string
	ProviderAmount     string
	CommissionRate     float64
	SignDate           string
}

var contractHTMLTemplate = template.Must(template.New("contract").Parse(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:20px;color:#333;line-height:1.8;font-size:14px}
h1{text-align:center;font-size:20px;margin-bottom:6px}
.contract-no{text-align:center;color:#666;font-size:12px;margin-bottom:24px}
h2{font-size:16px;margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:6px}
table{width:100%;border-collapse:collapse;margin:12px 0}
td{padding:8px 12px;border:1px solid #ddd}
td:first-child{width:30%;background:#f8f8f8;font-weight:600}
.sign-area{margin-top:32px;display:flex;justify-content:space-between}
.sign-box{width:45%;border:1px solid #ddd;border-radius:8px;padding:16px}
.sign-box h3{margin:0 0 8px;font-size:14px}
.sign-box p{margin:4px 0;font-size:13px;color:#666}
.footer{margin-top:24px;text-align:center;font-size:12px;color:#999}
</style>
</head>
<body>
<h1>无人机重载吊运服务合同</h1>
<p class="contract-no">合同编号：{{.ContractNo}}</p>

<h2>一、合同双方</h2>
<table>
<tr><td>甲方（委托方）</td><td>{{.ClientName}}（{{.ClientPhone}}）</td></tr>
<tr><td>乙方（服务方）</td><td>{{.ProviderName}}（{{.ProviderPhone}}）</td></tr>
</table>

<h2>二、服务内容</h2>
<table>
<tr><td>服务项目</td><td>{{.Title}}</td></tr>
<tr><td>服务说明</td><td>{{.ServiceDescription}}</td></tr>
<tr><td>服务地址</td><td>{{.ServiceAddress}}</td></tr>
<tr><td>预约开始时间</td><td>{{.ScheduledStart}}</td></tr>
<tr><td>预约结束时间</td><td>{{.ScheduledEnd}}</td></tr>
<tr><td>货物重量</td><td>{{printf "%.2f" .CargoWeightKG}} kg</td></tr>
<tr><td>预计架次</td><td>{{.EstimatedTripCount}} 架次</td></tr>
</table>

<h2>三、费用条款</h2>
<table>
<tr><td>合同总金额</td><td>¥ {{.ContractAmount}}</td></tr>
<tr><td>平台服务费（{{printf "%.0f" .CommissionRate}}%）</td><td>¥ {{.PlatformCommission}}</td></tr>
<tr><td>乙方实际到账</td><td>¥ {{.ProviderAmount}}</td></tr>
</table>

<h2>四、双方权利与义务</h2>
<p>1. 甲方应在约定时间前完成支付，并确保作业现场满足飞行安全条件。</p>
<p>2. 乙方应按约定时间和地点提供无人机吊运服务，确保设备适航、飞手持证上岗。</p>
<p>3. 因天气、空域管制等不可抗力因素导致无法作业的，双方协商调整时间或退款。</p>
<p>4. 作业过程中因乙方设备故障导致的货物损失，由乙方承担赔偿责任。</p>
<p>5. 因甲方提供的货物信息不实（超重、危险品等）导致的安全事故，由甲方承担责任。</p>
<p>6. 如乙方安排非本人飞手执行设备作业，乙方应确保执行飞手具备合法资质并已确认设备操作责任声明；因执行飞手操作不当造成的设备、货物或第三方损失，由乙方先行承担对外责任后再按内部约定追偿。</p>

<h2>五、违约责任</h2>
<p>1. 甲方在服务开始前 24 小时内取消订单的，需支付合同金额 20% 作为违约金。</p>
<p>2. 乙方无故未按时提供服务的，需退还全部费用并支付合同金额 20% 作为违约金。</p>
<p>3. 争议通过平台客服协调，协调不成的，由平台所在地人民法院管辖。</p>

<h2>六、签署</h2>
<div class="sign-area">
<div class="sign-box">
<h3>甲方（委托方）</h3>
<p>姓名：{{.ClientName}}</p>
<p>日期：<span id="client-sign-date">待签署</span></p>
</div>
<div class="sign-box">
<h3>乙方（服务方）</h3>
<p>姓名：{{.ProviderName}}</p>
<p>日期：<span id="provider-sign-date">待签署</span></p>
</div>
</div>

<p class="footer">本合同通过无人机服务平台电子签署，具有同等法律效力。签署日期：{{.SignDate}}</p>
</body>
</html>
`))

// ─── 核心方法 ─────────────────────────────────────────

// GenerateContractForOrder 为订单自动生成合同（在 SelectProvider 成功后调用）
func (s *ContractService) GenerateContractForOrder(orderID int64) (*model.OrderContract, error) {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, errors.New("订单不存在")
	}

	// 检查是否已有合同
	existing, err := s.contractRepo.GetByOrderID(orderID)
	if err == nil && existing.ID > 0 {
		return existing, nil
	}

	clientUser, err := s.userRepo.GetByID(order.ClientUserID)
	if err != nil {
		return nil, errors.New("甲方用户不存在")
	}
	providerUser, err := s.userRepo.GetByID(order.ProviderUserID)
	if err != nil {
		return nil, errors.New("乙方用户不存在")
	}

	contractNo := generateContractNo()
	commissionRate := float64(s.cfg.Payment.CommissionRate)

	// 从订单快照构建合同核心数据
	contractAmount := order.TotalAmount
	commission := order.PlatformCommission
	ownerAmount := order.OwnerAmount

	serviceDesc := order.Title
	serviceAddr := order.ServiceAddress
	if order.DestAddress != "" {
		serviceAddr += " → " + order.DestAddress
	}

	var startAt, endAt *time.Time
	var startStr, endStr string
	if !order.StartTime.IsZero() {
		st := order.StartTime
		startAt = &st
		startStr = order.StartTime.Format("2006-01-02 15:04")
	}
	if !order.EndTime.IsZero() {
		et := order.EndTime
		endAt = &et
		endStr = order.EndTime.Format("2006-01-02 15:04")
	}

	var cargoWeight float64
	var tripCount int = 1
	// 从需求快照获取货物信息
	if order.Demand != nil {
		cargoWeight = order.Demand.CargoWeightKG
		if order.Demand.EstimatedTripCount > 0 {
			tripCount = order.Demand.EstimatedTripCount
		}
		if order.Demand.Description != "" {
			serviceDesc = order.Demand.Description
		}
	}

	// 生成合同 HTML
	data := contractTemplateData{
		ContractNo:         contractNo,
		Title:              order.Title,
		ClientName:         clientUser.Nickname,
		ClientPhone:        maskPhone(clientUser.Phone),
		ProviderName:       providerUser.Nickname,
		ProviderPhone:      maskPhone(providerUser.Phone),
		ServiceDescription: serviceDesc,
		ServiceAddress:     serviceAddr,
		ScheduledStart:     startStr,
		ScheduledEnd:       endStr,
		CargoWeightKG:      cargoWeight,
		EstimatedTripCount: tripCount,
		ContractAmount:     formatCentToYuan(contractAmount),
		PlatformCommission: formatCentToYuan(commission),
		ProviderAmount:     formatCentToYuan(ownerAmount),
		CommissionRate:     commissionRate,
		SignDate:           time.Now().Format("2006-01-02"),
	}

	var htmlBuf bytes.Buffer
	if err := contractHTMLTemplate.Execute(&htmlBuf, data); err != nil {
		return nil, fmt.Errorf("合同模板渲染失败: %w", err)
	}

	contract := &model.OrderContract{
		ContractNo:         contractNo,
		OrderID:            order.ID,
		OrderNo:            order.OrderNo,
		TemplateKey:        "heavy_cargo_standard",
		ClientUserID:       order.ClientUserID,
		ProviderUserID:     order.ProviderUserID,
		Title:              "无人机重载吊运服务合同",
		ServiceDescription: serviceDesc,
		ServiceAddress:     serviceAddr,
		ScheduledStartAt:   startAt,
		ScheduledEndAt:     endAt,
		CargoWeightKG:      cargoWeight,
		EstimatedTripCount: tripCount,
		ContractAmount:     contractAmount,
		PlatformCommission: commission,
		ProviderAmount:     ownerAmount,
		Status:             "pending",
		ContractHTML:       htmlBuf.String(),
	}

	if err := s.contractRepo.Create(contract); err != nil {
		return nil, fmt.Errorf("合同保存失败: %w", err)
	}
	return contract, nil
}

// GenerateContractForOrderTx 在事务中为订单生成合同
func (s *ContractService) GenerateContractForOrderTx(tx *gorm.DB, order *model.Order) (*model.OrderContract, error) {
	if order == nil {
		return nil, errors.New("订单不能为空")
	}

	contractRepo := repository.NewContractRepo(tx)

	// 检查是否已有合同
	existing, err := contractRepo.GetByOrderID(order.ID)
	if err == nil && existing.ID > 0 {
		return existing, nil
	}

	clientUser, err := s.userRepo.GetByID(order.ClientUserID)
	if err != nil {
		return nil, errors.New("甲方用户不存在")
	}
	providerUser, err := s.userRepo.GetByID(order.ProviderUserID)
	if err != nil {
		return nil, errors.New("乙方用户不存在")
	}

	contractNo := generateContractNo()
	commissionRate := float64(s.cfg.Payment.CommissionRate)

	contractAmount := order.TotalAmount
	commission := order.PlatformCommission
	ownerAmount := order.OwnerAmount

	serviceDesc := order.Title
	serviceAddr := order.ServiceAddress
	if order.DestAddress != "" {
		serviceAddr += " → " + order.DestAddress
	}

	var startAt, endAt *time.Time
	var startStr, endStr string
	if !order.StartTime.IsZero() {
		st := order.StartTime
		startAt = &st
		startStr = order.StartTime.Format("2006-01-02 15:04")
	}
	if !order.EndTime.IsZero() {
		et := order.EndTime
		endAt = &et
		endStr = order.EndTime.Format("2006-01-02 15:04")
	}

	var cargoWeight float64
	var tripCount int = 1
	if order.Demand != nil {
		cargoWeight = order.Demand.CargoWeightKG
		if order.Demand.EstimatedTripCount > 0 {
			tripCount = order.Demand.EstimatedTripCount
		}
		if order.Demand.Description != "" {
			serviceDesc = order.Demand.Description
		}
	}

	data := contractTemplateData{
		ContractNo:         contractNo,
		Title:              order.Title,
		ClientName:         clientUser.Nickname,
		ClientPhone:        maskPhone(clientUser.Phone),
		ProviderName:       providerUser.Nickname,
		ProviderPhone:      maskPhone(providerUser.Phone),
		ServiceDescription: serviceDesc,
		ServiceAddress:     serviceAddr,
		ScheduledStart:     startStr,
		ScheduledEnd:       endStr,
		CargoWeightKG:      cargoWeight,
		EstimatedTripCount: tripCount,
		ContractAmount:     formatCentToYuan(contractAmount),
		PlatformCommission: formatCentToYuan(commission),
		ProviderAmount:     formatCentToYuan(ownerAmount),
		CommissionRate:     commissionRate,
		SignDate:           time.Now().Format("2006-01-02"),
	}

	var htmlBuf bytes.Buffer
	if err := contractHTMLTemplate.Execute(&htmlBuf, data); err != nil {
		return nil, fmt.Errorf("合同模板渲染失败: %w", err)
	}

	contract := &model.OrderContract{
		ContractNo:         contractNo,
		OrderID:            order.ID,
		OrderNo:            order.OrderNo,
		TemplateKey:        "heavy_cargo_standard",
		ClientUserID:       order.ClientUserID,
		ProviderUserID:     order.ProviderUserID,
		Title:              "无人机重载吊运服务合同",
		ServiceDescription: serviceDesc,
		ServiceAddress:     serviceAddr,
		ScheduledStartAt:   startAt,
		ScheduledEndAt:     endAt,
		CargoWeightKG:      cargoWeight,
		EstimatedTripCount: tripCount,
		ContractAmount:     contractAmount,
		PlatformCommission: commission,
		ProviderAmount:     ownerAmount,
		Status:             "pending",
		ContractHTML:       htmlBuf.String(),
	}

	if err := contractRepo.Create(contract); err != nil {
		return nil, fmt.Errorf("合同保存失败: %w", err)
	}
	return contract, nil
}

// SignContract 签署合同
func (s *ContractService) SignContract(contractID, userID int64) (*model.OrderContract, error) {
	contract, err := s.contractRepo.GetByID(contractID)
	if err != nil {
		return nil, errors.New("合同不存在")
	}

	now := time.Now()
	updates := map[string]interface{}{"updated_at": now}

	if userID == contract.ClientUserID {
		if contract.ClientSignedAt != nil {
			return contract, nil // 已签署
		}
		updates["client_signed_at"] = &now
		if contract.ProviderSignedAt != nil {
			updates["status"] = "fully_signed"
		} else {
			updates["status"] = "client_signed"
		}
	} else if userID == contract.ProviderUserID {
		if contract.ProviderSignedAt != nil {
			return contract, nil
		}
		updates["provider_signed_at"] = &now
		if contract.ClientSignedAt != nil {
			updates["status"] = "fully_signed"
		} else {
			updates["status"] = "provider_signed"
		}
	} else {
		return nil, errors.New("无权签署此合同")
	}

	if err := s.contractRepo.UpdateFields(contract.ID, updates); err != nil {
		return nil, fmt.Errorf("合同签署失败: %w", err)
	}

	updatedContract, err := s.contractRepo.GetByID(contract.ID)
	if err != nil {
		return nil, err
	}
	s.afterContractSigned(updatedContract, userID)
	return updatedContract, nil
}

// SignContractByOrder 通过订单ID签署合同
func (s *ContractService) SignContractByOrder(orderID, userID int64) (*model.OrderContract, error) {
	contract, err := s.contractRepo.GetByOrderID(orderID)
	if err != nil {
		return nil, errors.New("该订单暂无合同")
	}
	return s.SignContract(contract.ID, userID)
}

// ProviderAutoSign 机主确认订单时自动签署合同（在事务中调用）
func (s *ContractService) ProviderAutoSign(tx *gorm.DB, orderID, providerUserID int64) error {
	contractRepo := repository.NewContractRepo(tx)
	contract, err := contractRepo.GetByOrderID(orderID)
	if err != nil {
		// 无合同则跳过
		return nil
	}
	if contract.ProviderSignedAt != nil {
		return nil
	}

	now := time.Now()
	updates := map[string]interface{}{
		"provider_signed_at": &now,
		"updated_at":         now,
	}
	if contract.ClientSignedAt != nil {
		updates["status"] = "fully_signed"
	} else {
		updates["status"] = "provider_signed"
	}
	if err := contractRepo.UpdateFields(contract.ID, updates); err != nil {
		return err
	}
	note := "服务方已签署合同，待客户确认"
	if updates["status"] == "fully_signed" {
		note = "双方已完成合同签署，待客户支付"
	}
	return repository.NewOrderRepo(tx).AddTimeline(&model.OrderTimeline{
		OrderID:      orderID,
		Status:       "pending_payment",
		Note:         note,
		OperatorID:   providerUserID,
		OperatorType: "owner",
	})
}

// GetContractByOrder 获取订单合同
func (s *ContractService) GetContractByOrder(orderID int64) (*model.OrderContract, error) {
	return s.contractRepo.GetByOrderID(orderID)
}

// ─── 工具函数 ─────────────────────────────────────────

func maskPhone(phone string) string {
	if len(phone) < 7 {
		return phone
	}
	return phone[:3] + "****" + phone[len(phone)-4:]
}

func formatCentToYuan(cent int64) string {
	yuan := float64(cent) / 100.0
	return fmt.Sprintf("%.2f", yuan)
}

func (s *ContractService) afterContractSigned(contract *model.OrderContract, userID int64) {
	if contract == nil || s.orderRepo == nil {
		return
	}

	order, err := s.orderRepo.GetByID(contract.OrderID)
	if err != nil || order == nil {
		return
	}

	operatorType := "client"
	if userID == contract.ProviderUserID {
		operatorType = "owner"
	}

	note := "合同签署状态已更新"
	switch contract.Status {
	case "client_signed":
		note = "客户已签署合同，待服务方签署"
	case "provider_signed":
		note = "服务方已签署合同，待客户签署"
	case "fully_signed":
		note = "双方已完成合同签署，待客户支付"
	}

	_ = s.orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      contract.OrderID,
		Status:       "pending_payment",
		Note:         note,
		OperatorID:   userID,
		OperatorType: operatorType,
	})

	if s.eventService == nil {
		return
	}

	switch contract.Status {
	case "client_signed":
		s.eventService.NotifyContractClientSigned(order)
	case "provider_signed":
		s.eventService.NotifyContractProviderSigned(order)
	case "fully_signed":
		s.eventService.NotifyContractFullySigned(order)
	}
}
