package service

import (
	"context"
	"fmt"
	"time"

	"go.uber.org/zap"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/push"
)

type EventService struct {
	messageService         *MessageService
	pushService            push.PushService
	wechatSubscribeService WeChatSubscribeEventSender
	logger                 *zap.Logger
}

var pushEventAllowlist = map[string]struct{}{
	"direct_order_created":            {},
	"direct_order_confirmed":          {},
	"direct_order_rejected":           {},
	"contract_client_signed":          {},
	"contract_provider_signed":        {},
	"contract_fully_signed":           {},
	"demand_quote_submitted":          {},
	"demand_selected":                 {},
	"demand_cancelled":                {},
	"order_paid":                      {},
	"order_cancelled":                 {},
	"order_preparing":                 {},
	"order_in_transit":                {},
	"order_delivered":                 {},
	"order_completed":                 {},
	"settlement_settled":              {},
	"broadcast_auto_assigned":         {},
	"broadcast_auto_assign_timeout":   {},
	"broadcast_auto_assign_exhausted": {},
	"dispatch_created":                {},
	"dispatch_accepted":               {},
	"dispatch_reassigned":             {},
	"dispatch_manual_required":        {},
	"pilot_verification_result":       {},
	"drone_certification_reviewed":    {},
	"drone_uom_reviewed":              {},
	"drone_insurance_reviewed":        {},
	"drone_airworthiness_reviewed":    {},
}

func NewEventService(messageService *MessageService, pushService push.PushService, logger *zap.Logger) *EventService {
	return &EventService{
		messageService: messageService,
		pushService:    pushService,
		logger:         logger,
	}
}

func (s *EventService) SetWeChatSubscribeService(wechatSubscribeService WeChatSubscribeEventSender) {
	if s == nil {
		return
	}
	s.wechatSubscribeService = wechatSubscribeService
}

func (s *EventService) NotifyDemandQuoteSubmitted(demand *model.Demand, quote *model.DemandQuote) {
	if demand == nil || quote == nil {
		return
	}
	s.notifyUsers([]int64{demand.ClientUserID}, "demand_quote_submitted", "收到新报价",
		fmt.Sprintf("需求“%s”收到新的服务商报价。", fallbackTitle(demand.Title, demand.DemandNo, "需求")),
		map[string]interface{}{
			"demand_id":              demand.ID,
			"demand_no":              demand.DemandNo,
			"quote_id":               quote.ID,
			"quote_no":               quote.QuoteNo,
			"owner_user_id":          quote.OwnerUserID,
			"price_amount":           quote.PriceAmount,
			"status":                 quote.Status,
			"business_type":          "demand_quote",
			"service_type":           demand.ServiceType,
			"allows_pilot_candidate": demand.AllowsPilotCandidate,
		},
	)
}

func (s *EventService) NotifyDemandCancelled(demand *model.Demand, ownerUserIDs []int64) {
	if demand == nil {
		return
	}
	s.notifyUsers(ownerUserIDs, "demand_cancelled", "需求已取消",
		fmt.Sprintf("客户已取消需求“%s”。", fallbackTitle(demand.Title, demand.DemandNo, "需求")),
		map[string]interface{}{
			"demand_id":     demand.ID,
			"demand_no":     demand.DemandNo,
			"business_type": "demand",
			"status":        demand.Status,
		},
	)
}

func (s *EventService) NotifyDemandExpired(demand *model.Demand) {
	if demand == nil {
		return
	}
	s.notifyUsers([]int64{demand.ClientUserID}, "demand_expired", "需求已过期",
		fmt.Sprintf("需求“%s”已过期并自动关闭。", fallbackTitle(demand.Title, demand.DemandNo, "需求")),
		map[string]interface{}{
			"demand_id":     demand.ID,
			"demand_no":     demand.DemandNo,
			"business_type": "demand",
			"status":        demand.Status,
		},
	)
}

func (s *EventService) NotifyDemandSelected(demand *model.Demand, quote *model.DemandQuote, orderID int64, orderNo string) {
	if demand == nil || quote == nil {
		return
	}
	s.notifyUsers([]int64{quote.OwnerUserID}, "demand_selected", "报价已被选中",
		fmt.Sprintf("需求“%s”已选中您的方案，并生成订单。", fallbackTitle(demand.Title, demand.DemandNo, "需求")),
		map[string]interface{}{
			"demand_id":     demand.ID,
			"demand_no":     demand.DemandNo,
			"quote_id":      quote.ID,
			"quote_no":      quote.QuoteNo,
			"order_id":      orderID,
			"order_no":      orderNo,
			"business_type": "order",
		},
	)
}

func (s *EventService) NotifyDirectOrderCreated(order *model.Order) {
	if order == nil {
		return
	}
	providerUserID := order.ProviderUserID
	if providerUserID == 0 {
		providerUserID = order.OwnerID
	}
	s.notifyUsers([]int64{providerUserID}, "direct_order_created", "新直达订单待确认",
		fmt.Sprintf("订单“%s”已提交，待您确认是否承接。", fallbackTitle(order.Title, order.OrderNo, "订单")),
		map[string]interface{}{
			"order_id":      order.ID,
			"order_no":      order.OrderNo,
			"order_source":  order.OrderSource,
			"status":        order.Status,
			"business_type": "order",
		},
	)
}

func (s *EventService) NotifyBroadcastAutoAssigned(order *model.Order, providerUserID int64, deadline time.Time) {
	if order == nil || providerUserID <= 0 {
		return
	}
	s.notifyUsers([]int64{providerUserID}, "broadcast_auto_assigned", "收到自动指派订单",
		fmt.Sprintf("订单“%s”已自动指派给您，请在时窗内确认是否承接。", fallbackTitle(order.Title, order.OrderNo, "订单")),
		map[string]interface{}{
			"order_id":           order.ID,
			"order_no":           order.OrderNo,
			"order_source":       order.OrderSource,
			"order_mode":         order.OrderMode,
			"status":             order.Status,
			"accept_deadline_at": deadline,
			"business_type":      "broadcast_assignment",
		},
	)
}

func (s *EventService) NotifyBroadcastAutoAssignTimeoutForProvider(providerUserID int64, orderID int64) {
	if providerUserID <= 0 || orderID <= 0 {
		return
	}
	s.notifyUsers([]int64{providerUserID}, "broadcast_auto_assign_timeout", "自动指派已超时",
		"您未在时窗内确认自动指派订单，系统已继续匹配其他服务商。",
		map[string]interface{}{
			"order_id":      orderID,
			"business_type": "broadcast_assignment",
		},
	)
}

func (s *EventService) NotifyBroadcastAutoAssignExhausted(order *model.Order) {
	if order == nil {
		return
	}
	s.notifyUsers(orderClientReceivers(order), "broadcast_auto_assign_exhausted", "暂未匹配到服务商",
		fmt.Sprintf("订单“%s”附近暂无可承接服务商，平台将继续关注运力情况。", fallbackTitle(order.Title, order.OrderNo, "订单")),
		map[string]interface{}{
			"order_id":      order.ID,
			"order_no":      order.OrderNo,
			"order_source":  order.OrderSource,
			"order_mode":    order.OrderMode,
			"status":        order.Status,
			"business_type": "broadcast_assignment",
		},
	)
}

func (s *EventService) NotifyDirectOrderConfirmed(order *model.Order) {
	if order == nil {
		return
	}
	providerUserID := orderProviderUserID(order)
	clientRecipients := orderClientReceivers(order)
	s.notifyUsers(orderClientReceivers(order), "direct_order_confirmed", "直达订单已确认",
		fmt.Sprintf("订单“%s”已由服务商确认，请先查看合同签署状态，再继续下一步。", fallbackTitle(order.Title, order.OrderNo, "订单")),
		map[string]interface{}{
			"order_id":      order.ID,
			"order_no":      order.OrderNo,
			"order_source":  order.OrderSource,
			"status":        order.Status,
			"business_type": "order",
		},
	)
	for _, clientUserID := range clientRecipients {
		s.notifyConversation(providerUserID, clientUserID, "direct_order_confirmed", "直达订单已确认",
			fmt.Sprintf("订单“%s”已由服务商确认，请先查看合同签署状态，再继续下一步。", fallbackTitle(order.Title, order.OrderNo, "订单")),
			map[string]interface{}{
				"order_id":      order.ID,
				"order_no":      order.OrderNo,
				"order_source":  order.OrderSource,
				"status":        order.Status,
				"business_type": "order",
			},
		)
	}
}

func (s *EventService) NotifyContractClientSigned(order *model.Order) {
	if order == nil {
		return
	}
	providerUserID := orderProviderUserID(order)
	if providerUserID <= 0 {
		return
	}
	title := "客户已签署合同"
	content := fmt.Sprintf("订单“%s”客户已完成签署，请尽快确认合同。", fallbackTitle(order.Title, order.OrderNo, "订单"))
	payload := map[string]interface{}{
		"order_id":        order.ID,
		"order_no":        order.OrderNo,
		"status":          order.Status,
		"contract_status": "client_signed",
		"business_type":   "contract",
		"order_source":    order.OrderSource,
	}
	s.notifyUsers([]int64{providerUserID}, "contract_client_signed", title, content, payload)
	for _, clientUserID := range orderClientReceivers(order) {
		s.notifyConversation(clientUserID, providerUserID, "contract_client_signed", title, content, payload)
	}
}

func (s *EventService) NotifyContractProviderSigned(order *model.Order) {
	if order == nil {
		return
	}
	title := "服务方已签署合同"
	content := fmt.Sprintf("订单“%s”服务方已完成签署，请确认合同后再继续支付。", fallbackTitle(order.Title, order.OrderNo, "订单"))
	payload := map[string]interface{}{
		"order_id":        order.ID,
		"order_no":        order.OrderNo,
		"status":          order.Status,
		"contract_status": "provider_signed",
		"business_type":   "contract",
		"order_source":    order.OrderSource,
	}
	clientRecipients := orderClientReceivers(order)
	s.notifyUsers(clientRecipients, "contract_provider_signed", title, content, payload)
	providerUserID := orderProviderUserID(order)
	for _, clientUserID := range clientRecipients {
		s.notifyConversation(providerUserID, clientUserID, "contract_provider_signed", title, content, payload)
	}
}

func (s *EventService) NotifyContractFullySigned(order *model.Order) {
	if order == nil {
		return
	}
	orderTitle := fallbackTitle(order.Title, order.OrderNo, "订单")
	clientRecipients := orderClientReceivers(order)
	providerUserID := orderProviderUserID(order)
	clientPayload := map[string]interface{}{
		"order_id":        order.ID,
		"order_no":        order.OrderNo,
		"status":          order.Status,
		"contract_status": "fully_signed",
		"business_type":   "contract",
		"order_source":    order.OrderSource,
		"next_action":     "pay",
	}
	providerPayload := map[string]interface{}{
		"order_id":        order.ID,
		"order_no":        order.OrderNo,
		"status":          order.Status,
		"contract_status": "fully_signed",
		"business_type":   "contract",
		"order_source":    order.OrderSource,
		"next_action":     "wait_client_payment",
	}

	s.notifyUsers(clientRecipients, "contract_fully_signed", "合同已全部签署",
		fmt.Sprintf("订单“%s”已完成双方签署，现在可以支付了。", orderTitle),
		clientPayload,
	)
	if providerUserID > 0 {
		s.notifyUsers([]int64{providerUserID}, "contract_fully_signed", "合同已全部签署",
			fmt.Sprintf("订单“%s”已完成双方签署，待客户支付。", orderTitle),
			providerPayload,
		)
	}
	for _, clientUserID := range clientRecipients {
		s.notifyConversation(providerUserID, clientUserID, "contract_fully_signed", "合同已全部签署",
			fmt.Sprintf("订单“%s”已完成双方签署，现在可以支付了。", orderTitle),
			clientPayload,
		)
	}
}

func (s *EventService) NotifyDirectOrderRejected(order *model.Order) {
	if order == nil {
		return
	}
	s.notifyUsers(orderClientReceivers(order), "direct_order_rejected", "直达订单已被拒绝",
		fmt.Sprintf("订单“%s”已被服务商拒绝，请重新选择服务方案。", fallbackTitle(order.Title, order.OrderNo, "订单")),
		map[string]interface{}{
			"order_id":      order.ID,
			"order_no":      order.OrderNo,
			"order_source":  order.OrderSource,
			"status":        order.Status,
			"reject_reason": order.ProviderRejectReason,
			"business_type": "order",
		},
	)
}

func (s *EventService) NotifyOrderPaid(order *model.Order) {
	if order == nil {
		return
	}
	clientUserID := orderPrimaryClientUserID(order)
	providerUserID := orderProviderUserID(order)
	recipients := uniqueUserIDs(order.ProviderUserID, order.OwnerID)
	s.notifyUsers(recipients, "order_paid", "订单已支付",
		fmt.Sprintf("订单“%s”已完成支付，请准备执行。", fallbackTitle(order.Title, order.OrderNo, "订单")),
		map[string]interface{}{
			"order_id":      order.ID,
			"order_no":      order.OrderNo,
			"status":        order.Status,
			"order_source":  order.OrderSource,
			"business_type": "order",
		},
	)
	s.notifyConversation(clientUserID, providerUserID, "order_paid", "订单已支付",
		fmt.Sprintf("订单“%s”已完成支付，请准备执行。", fallbackTitle(order.Title, order.OrderNo, "订单")),
		map[string]interface{}{
			"order_id":      order.ID,
			"order_no":      order.OrderNo,
			"status":        order.Status,
			"order_source":  order.OrderSource,
			"business_type": "order",
		},
	)
}

func (s *EventService) NotifyOrderStatusChanged(order *model.Order, eventType, title, content string) {
	if order == nil {
		return
	}
	recipients := uniqueUserIDs(orderClientReceivers(order)...)
	if order.ProviderUserID > 0 {
		recipients = uniqueUserIDs(append(recipients, order.ProviderUserID)...)
	}
	if executorUserID := orderExecutorUserID(order); executorUserID > 0 {
		recipients = uniqueUserIDs(append(recipients, executorUserID)...)
	}
	s.notifyUsers(recipients, eventType, title, content, map[string]interface{}{
		"order_id":      order.ID,
		"order_no":      order.OrderNo,
		"status":        order.Status,
		"order_source":  order.OrderSource,
		"business_type": "order",
	})

	providerUserID := orderProviderUserID(order)
	clientUserIDs := orderClientReceivers(order)
	pilotUserID := orderExecutorUserID(order)
	payload := map[string]interface{}{
		"order_id":      order.ID,
		"order_no":      order.OrderNo,
		"status":        order.Status,
		"order_source":  order.OrderSource,
		"business_type": "order",
	}
	switch eventType {
	case "order_preparing", "order_in_transit", "order_delivered":
		for _, clientUserID := range clientUserIDs {
			s.notifyConversation(providerUserID, clientUserID, eventType, title, content, payload)
		}
		if pilotUserID > 0 && providerUserID > 0 && pilotUserID != providerUserID {
			s.notifyConversation(pilotUserID, providerUserID, eventType, title, content, payload)
		}
	case "order_completed":
		for _, clientUserID := range clientUserIDs {
			s.notifyConversation(clientUserID, providerUserID, eventType, title, content, payload)
		}
	case "order_cancelled":
		if order.CancelBy == "client" {
			for _, clientUserID := range clientUserIDs {
				s.notifyConversation(clientUserID, providerUserID, eventType, title, content, payload)
			}
		} else {
			for _, clientUserID := range clientUserIDs {
				s.notifyConversation(providerUserID, clientUserID, eventType, title, content, payload)
			}
		}
	}
}

func (s *EventService) NotifySettlementSettled(order *model.Order, settlement *model.OrderSettlement) {
	if order == nil || settlement == nil {
		return
	}

	orderTitle := fallbackTitle(order.Title, order.OrderNo, "订单")
	basePayload := map[string]interface{}{
		"order_id":        order.ID,
		"order_no":        order.OrderNo,
		"settlement_id":   settlement.ID,
		"settlement_no":   settlement.SettlementNo,
		"status":          settlement.Status,
		"final_amount":    settlement.FinalAmount,
		"platform_fee":    settlement.PlatformFee,
		"pilot_fee":       settlement.PilotFee,
		"owner_fee":       settlement.OwnerFee,
		"business_type":   "settlement",
		"settlement_type": "order_income",
	}

	for _, clientUserID := range orderClientReceivers(order) {
		payload := cloneExtras(basePayload)
		payload["role"] = "payer"
		payload["next_action"] = "order"
		s.notifyUsers([]int64{clientUserID}, "settlement_settled", "订单结算已完成",
			fmt.Sprintf("订单“%s”已完成结算，服务方收入已入账。", orderTitle),
			payload,
		)
	}

	if settlement.PilotUserID > 0 && settlement.PilotUserID == settlement.OwnerUserID {
		payload := cloneExtras(basePayload)
		incomeAmount := settlement.PilotFee + settlement.OwnerFee
		payload["role"] = "provider"
		payload["income_amount"] = incomeAmount
		payload["next_action"] = "wallet"
		s.notifyUsers([]int64{settlement.PilotUserID}, "settlement_settled", "结算收入已入账",
			fmt.Sprintf("订单“%s”结算收入%s已入账，可在钱包查看。", orderTitle, formatAmountFen(incomeAmount)),
			payload,
		)
		return
	}

	if settlement.PilotUserID > 0 {
		payload := cloneExtras(basePayload)
		payload["role"] = "pilot"
		payload["income_amount"] = settlement.PilotFee
		payload["next_action"] = "wallet"
		s.notifyUsers([]int64{settlement.PilotUserID}, "settlement_settled", "履约服务费已入账",
			fmt.Sprintf("订单“%s”履约服务费%s已入账，可在钱包查看。", orderTitle, formatAmountFen(settlement.PilotFee)),
			payload,
		)
	}

	if settlement.OwnerUserID > 0 {
		payload := cloneExtras(basePayload)
		payload["role"] = "owner"
		payload["income_amount"] = settlement.OwnerFee
		payload["next_action"] = "wallet"
		s.notifyUsers([]int64{settlement.OwnerUserID}, "settlement_settled", "设备服务费已入账",
			fmt.Sprintf("订单“%s”设备服务费%s已入账，可在钱包查看。", orderTitle, formatAmountFen(settlement.OwnerFee)),
			payload,
		)
	}
}

func (s *EventService) NotifyDispatchCreated(task *model.FormalDispatchTask, order *model.Order) {
	if task == nil {
		return
	}
	orderNo := ""
	orderID := task.OrderID
	if order != nil {
		orderNo = order.OrderNo
		orderID = order.ID
	}
	s.notifyUsers([]int64{task.TargetPilotUserID}, "dispatch_created", "收到履约任务",
		fmt.Sprintf("您收到履约任务 %s，请尽快响应。", fallbackTitle(task.DispatchNo, fmt.Sprintf("%d", task.ID), "履约任务")),
		map[string]interface{}{
			"dispatch_task_id": task.ID,
			"dispatch_no":      task.DispatchNo,
			"order_id":         orderID,
			"order_no":         orderNo,
			"dispatch_source":  task.DispatchSource,
			"status":           task.Status,
			"business_type":    "dispatch",
		},
	)
	providerUserID := int64(0)
	if order != nil {
		providerUserID = orderProviderUserID(order)
	}
	if providerUserID == 0 {
		providerUserID = task.ProviderUserID
	}
	s.notifyConversation(providerUserID, task.TargetPilotUserID, "dispatch_created", "收到履约任务",
		fmt.Sprintf("您收到履约任务 %s，请尽快响应。", fallbackTitle(task.DispatchNo, fmt.Sprintf("%d", task.ID), "履约任务")),
		map[string]interface{}{
			"dispatch_task_id": task.ID,
			"dispatch_no":      task.DispatchNo,
			"order_id":         orderID,
			"order_no":         orderNo,
			"dispatch_source":  task.DispatchSource,
			"status":           task.Status,
			"business_type":    "dispatch",
		},
	)
}

func (s *EventService) NotifyDispatchAccepted(task *model.FormalDispatchTask, order *model.Order) {
	if task == nil {
		return
	}
	recipients := []int64{}
	if order != nil {
		recipients = append(recipients, order.ProviderUserID)
		recipients = append(recipients, orderClientReceivers(order)...)
	}
	s.notifyUsers(recipients, "dispatch_accepted", "履约任务已确认",
		fmt.Sprintf("履约任务 %s 已被服务商确认。", fallbackTitle(task.DispatchNo, fmt.Sprintf("%d", task.ID), "履约任务")),
		map[string]interface{}{
			"dispatch_task_id": task.ID,
			"dispatch_no":      task.DispatchNo,
			"order_id":         task.OrderID,
			"order_no":         orderNoOrEmpty(order),
			"status":           task.Status,
			"business_type":    "dispatch",
		},
	)
	providerUserID := orderProviderUserID(order)
	s.notifyConversation(task.TargetPilotUserID, providerUserID, "dispatch_accepted", "履约任务已确认",
		fmt.Sprintf("履约任务 %s 已被服务商确认。", fallbackTitle(task.DispatchNo, fmt.Sprintf("%d", task.ID), "履约任务")),
		map[string]interface{}{
			"dispatch_task_id": task.ID,
			"dispatch_no":      task.DispatchNo,
			"order_id":         task.OrderID,
			"order_no":         orderNoOrEmpty(order),
			"status":           task.Status,
			"business_type":    "dispatch",
		},
	)
	for _, clientUserID := range orderClientReceivers(order) {
		s.notifyConversation(providerUserID, clientUserID, "dispatch_assigned", "订单已进入履约安排",
			fmt.Sprintf("订单“%s”已进入履约安排，您可以在订单详情跟进进度。", fallbackTitle(orderTitleOrEmpty(order), orderNoOrEmpty(order), "订单")),
			map[string]interface{}{
				"dispatch_task_id": task.ID,
				"dispatch_no":      task.DispatchNo,
				"order_id":         task.OrderID,
				"order_no":         orderNoOrEmpty(order),
				"status":           task.Status,
				"business_type":    "dispatch",
			},
		)
	}
}

func (s *EventService) NotifyDispatchReassigned(order *model.Order, newTask *model.FormalDispatchTask, reason string) {
	if order == nil || newTask == nil {
		return
	}
	s.notifyUsers([]int64{order.ProviderUserID}, "dispatch_reassigned", "履约安排已更新",
		fmt.Sprintf("订单“%s”触发履约安排更新，系统已重新生成履约任务。", fallbackTitle(order.Title, order.OrderNo, "订单")),
		map[string]interface{}{
			"order_id":         order.ID,
			"order_no":         order.OrderNo,
			"dispatch_task_id": newTask.ID,
			"dispatch_no":      newTask.DispatchNo,
			"dispatch_source":  newTask.DispatchSource,
			"reason":           reason,
			"business_type":    "dispatch",
		},
	)
}

func (s *EventService) NotifyDispatchManualRequired(order *model.Order, reason string) {
	if order == nil {
		return
	}
	s.notifyUsers([]int64{order.ProviderUserID}, "dispatch_manual_required", "履约安排需人工处理",
		fmt.Sprintf("订单“%s”当前无人可自动接单，请您手动处理。", fallbackTitle(order.Title, order.OrderNo, "订单")),
		map[string]interface{}{
			"order_id":      order.ID,
			"order_no":      order.OrderNo,
			"status":        order.Status,
			"reason":        reason,
			"business_type": "dispatch",
		},
	)
}

func (s *EventService) NotifyBindingInvitation(binding *model.OwnerPilotBinding) {
	if binding == nil {
		return
	}
	s.notifyUsers([]int64{binding.PilotUserID}, "pilot_binding_invitation", "收到服务协作邀请",
		"有服务商向您发起了协作邀请，请尽快确认。",
		map[string]interface{}{
			"binding_id":    binding.ID,
			"owner_user_id": binding.OwnerUserID,
			"pilot_user_id": binding.PilotUserID,
			"status":        binding.Status,
			"initiated_by":  binding.InitiatedBy,
			"business_type": "pilot_binding",
		},
	)
}

func (s *EventService) NotifyBindingApplication(binding *model.OwnerPilotBinding) {
	if binding == nil {
		return
	}
	s.notifyUsers([]int64{binding.OwnerUserID}, "pilot_binding_application", "收到服务协作申请",
		"有服务商向您发起了协作申请，请尽快处理。",
		map[string]interface{}{
			"binding_id":    binding.ID,
			"owner_user_id": binding.OwnerUserID,
			"pilot_user_id": binding.PilotUserID,
			"status":        binding.Status,
			"initiated_by":  binding.InitiatedBy,
			"business_type": "pilot_binding",
		},
	)
}

func (s *EventService) NotifyBindingStatus(binding *model.OwnerPilotBinding) {
	if binding == nil {
		return
	}
	title := "绑定关系状态已更新"
	content := "绑定关系状态发生变更。"
	switch binding.Status {
	case "active":
		title = "绑定关系已生效"
		content = "服务协作关系已生效。"
	case "rejected":
		title = "绑定请求被拒绝"
		content = "绑定请求已被拒绝。"
	case "expired":
		title = "绑定请求已过期"
		content = "绑定请求超时未响应，已自动过期。"
	case "paused":
		title = "绑定关系已暂停"
		content = "绑定关系已暂停。"
	case "dissolved":
		title = "绑定关系已解除"
		content = "绑定关系已解除。"
	}
	recipients := uniqueUserIDs(binding.OwnerUserID, binding.PilotUserID)
	s.notifyUsers(recipients, "pilot_binding_status_changed", title, content, map[string]interface{}{
		"binding_id":    binding.ID,
		"owner_user_id": binding.OwnerUserID,
		"pilot_user_id": binding.PilotUserID,
		"status":        binding.Status,
		"initiated_by":  binding.InitiatedBy,
		"business_type": "pilot_binding",
	})
}

func (s *EventService) NotifyPilotVerification(pilotUserID int64, approved bool, note string) {
	title := "服务资质审核结果"
	content := "您的服务资质已审核通过。"
	if !approved {
		content = "您的服务资质审核未通过，请查看原因并重新提交。"
	}
	s.notifyUsers([]int64{pilotUserID}, "pilot_verification_result", title, content, map[string]interface{}{
		"pilot_user_id": pilotUserID,
		"approved":      approved,
		"note":          note,
		"business_type": "qualification",
	})
}

func (s *EventService) NotifyDroneQualification(drone *model.Drone, eventType, title, content string) {
	if drone == nil {
		return
	}
	s.notifyUsers([]int64{drone.OwnerID}, eventType, title, content, map[string]interface{}{
		"drone_id":      drone.ID,
		"serial_number": drone.SerialNumber,
		"cert_status":   drone.CertificationStatus,
		"uom_verified":  drone.UOMVerified,
		"insurance":     drone.InsuranceVerified,
		"airworthiness": drone.AirworthinessVerified,
		"business_type": "qualification",
	})
}

func (s *EventService) notifyUsers(userIDs []int64, eventType, title, content string, extras map[string]interface{}) {
	if s == nil {
		return
	}
	for _, userID := range uniqueUserIDs(userIDs...) {
		if userID <= 0 {
			continue
		}
		payload := cloneExtras(extras)
		payload["event_type"] = eventType
		payload["title"] = title

		if s.messageService != nil {
			if _, err := s.messageService.SendSystemNotification(userID, "system", title, content, payload); err != nil && s.logger != nil {
				s.logger.Warn("send system notification failed", zap.Int64("user_id", userID), zap.String("event_type", eventType), zap.Error(err))
			}
		}
		if s.pushService != nil && shouldSendPushEvent(eventType) {
			if err := s.pushService.PushToUser(userID, title, content, stringifyExtras(payload)); err != nil && s.logger != nil {
				s.logger.Warn("push notification failed", zap.Int64("user_id", userID), zap.String("event_type", eventType), zap.Error(err))
			}
		}
		if s.wechatSubscribeService != nil && ShouldSendWeChatSubscribeEvent(eventType) {
			wechatPayload := cloneExtras(payload)
			wechatPayload["content"] = content
			if err := s.wechatSubscribeService.SendEvent(context.Background(), userID, eventType, wechatPayload); err != nil && s.logger != nil {
				s.logger.Warn("wechat subscribe notification failed", zap.Int64("user_id", userID), zap.String("event_type", eventType), zap.Error(err))
			}
		}
	}
}

func shouldSendPushEvent(eventType string) bool {
	_, ok := pushEventAllowlist[eventType]
	return ok
}

func (s *EventService) notifyConversation(senderID, receiverID int64, eventType, title, content string, extras map[string]interface{}) {
	if s == nil || s.messageService == nil {
		return
	}
	if senderID <= 0 || receiverID <= 0 || senderID == receiverID {
		return
	}

	payload := cloneExtras(extras)
	payload["event_type"] = eventType
	payload["title"] = title
	if _, err := s.messageService.SendConversationSystemMessage(senderID, receiverID, title, content, payload); err != nil && s.logger != nil {
		s.logger.Warn("send conversation system message failed",
			zap.Int64("sender_id", senderID),
			zap.Int64("receiver_id", receiverID),
			zap.String("event_type", eventType),
			zap.Error(err),
		)
	}
}

func uniqueUserIDs(ids ...int64) []int64 {
	seen := make(map[int64]struct{}, len(ids))
	result := make([]int64, 0, len(ids))
	for _, id := range ids {
		if id <= 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result
}

func stringifyExtras(extras map[string]interface{}) map[string]string {
	if len(extras) == 0 {
		return map[string]string{}
	}
	result := make(map[string]string, len(extras))
	for key, value := range extras {
		result[key] = fmt.Sprint(value)
	}
	return result
}

func cloneExtras(extras map[string]interface{}) map[string]interface{} {
	if len(extras) == 0 {
		return make(map[string]interface{})
	}
	result := make(map[string]interface{}, len(extras))
	for key, value := range extras {
		result[key] = value
	}
	return result
}

func fallbackTitle(title, fallback, kind string) string {
	if title != "" {
		return title
	}
	if fallback != "" {
		return fallback
	}
	return kind
}

func orderClientReceivers(order *model.Order) []int64 {
	if order == nil {
		return nil
	}
	return uniqueUserIDs(order.ClientUserID, order.RenterID)
}

func orderPrimaryClientUserID(order *model.Order) int64 {
	if order == nil {
		return 0
	}
	if order.ClientUserID > 0 {
		return order.ClientUserID
	}
	return order.RenterID
}

func orderProviderUserID(order *model.Order) int64 {
	if order == nil {
		return 0
	}
	if order.ProviderUserID > 0 {
		return order.ProviderUserID
	}
	if order.OwnerID > 0 {
		return order.OwnerID
	}
	return order.DroneOwnerUserID
}

func orderExecutorUserID(order *model.Order) int64 {
	if order == nil {
		return 0
	}
	if order.ExecutorPilotUserID > 0 {
		return order.ExecutorPilotUserID
	}
	return orderProviderUserID(order)
}

func orderNoOrEmpty(order *model.Order) string {
	if order == nil {
		return ""
	}
	return order.OrderNo
}

func orderTitleOrEmpty(order *model.Order) string {
	if order == nil {
		return ""
	}
	return order.Title
}
