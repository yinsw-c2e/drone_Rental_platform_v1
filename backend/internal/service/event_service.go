package service

import (
	"fmt"

	"go.uber.org/zap"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/push"
)

type EventService struct {
	messageService *MessageService
	pushService    push.PushService
	logger         *zap.Logger
}

func NewEventService(messageService *MessageService, pushService push.PushService, logger *zap.Logger) *EventService {
	return &EventService{
		messageService: messageService,
		pushService:    pushService,
		logger:         logger,
	}
}

func (s *EventService) NotifyDemandQuoteSubmitted(demand *model.Demand, quote *model.DemandQuote) {
	if demand == nil || quote == nil {
		return
	}
	s.notifyUsers([]int64{demand.ClientUserID}, "demand_quote_submitted", "收到新报价",
		fmt.Sprintf("需求“%s”收到新的机主报价。", fallbackTitle(demand.Title, demand.DemandNo, "需求")),
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

func (s *EventService) NotifyDirectOrderConfirmed(order *model.Order) {
	if order == nil {
		return
	}
	providerUserID := orderProviderUserID(order)
	clientRecipients := orderClientReceivers(order)
	s.notifyUsers(orderClientReceivers(order), "direct_order_confirmed", "直达订单已确认",
		fmt.Sprintf("订单“%s”已由机主确认，请尽快完成支付。", fallbackTitle(order.Title, order.OrderNo, "订单")),
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
			fmt.Sprintf("订单“%s”已由机主确认，请尽快完成支付。", fallbackTitle(order.Title, order.OrderNo, "订单")),
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

func (s *EventService) NotifyDirectOrderRejected(order *model.Order) {
	if order == nil {
		return
	}
	s.notifyUsers(orderClientReceivers(order), "direct_order_rejected", "直达订单已被拒绝",
		fmt.Sprintf("订单“%s”已被机主拒绝，请重新选择供给。", fallbackTitle(order.Title, order.OrderNo, "订单")),
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
	s.notifyUsers([]int64{task.TargetPilotUserID}, "dispatch_created", "收到正式派单",
		fmt.Sprintf("您收到正式派单 %s，请尽快响应。", fallbackTitle(task.DispatchNo, fmt.Sprintf("%d", task.ID), "派单")),
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
	s.notifyConversation(providerUserID, task.TargetPilotUserID, "dispatch_created", "收到正式派单",
		fmt.Sprintf("您收到正式派单 %s，请尽快响应。", fallbackTitle(task.DispatchNo, fmt.Sprintf("%d", task.ID), "派单")),
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
	s.notifyUsers(recipients, "dispatch_accepted", "正式派单已接受",
		fmt.Sprintf("正式派单 %s 已被飞手接受。", fallbackTitle(task.DispatchNo, fmt.Sprintf("%d", task.ID), "派单")),
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
	s.notifyConversation(task.TargetPilotUserID, providerUserID, "dispatch_accepted", "正式派单已接受",
		fmt.Sprintf("正式派单 %s 已被飞手接受。", fallbackTitle(task.DispatchNo, fmt.Sprintf("%d", task.ID), "派单")),
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
		s.notifyConversation(providerUserID, clientUserID, "dispatch_assigned", "订单已安排执行飞手",
			fmt.Sprintf("订单“%s”已安排飞手执行，您可以在订单详情跟进进度。", fallbackTitle(orderTitleOrEmpty(order), orderNoOrEmpty(order), "订单")),
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
	s.notifyUsers([]int64{order.ProviderUserID}, "dispatch_reassigned", "派单已自动重派",
		fmt.Sprintf("订单“%s”触发自动重派，系统已向新的飞手发起正式派单。", fallbackTitle(order.Title, order.OrderNo, "订单")),
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
	s.notifyUsers([]int64{order.ProviderUserID}, "dispatch_manual_required", "派单需人工处理",
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
	s.notifyUsers([]int64{binding.PilotUserID}, "pilot_binding_invitation", "收到机主绑定邀请",
		"有机主向您发起了绑定邀请，请尽快确认。",
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
	s.notifyUsers([]int64{binding.OwnerUserID}, "pilot_binding_application", "收到飞手绑定申请",
		"有飞手向您发起了绑定申请，请尽快处理。",
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
		content = "机主与飞手的绑定关系已生效。"
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
	title := "飞手资质审核结果"
	content := "您的飞手资质已审核通过。"
	if !approved {
		content = "您的飞手资质审核未通过，请查看原因并重新提交。"
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
		if s.pushService != nil {
			if err := s.pushService.PushToUser(userID, title, content, stringifyExtras(payload)); err != nil && s.logger != nil {
				s.logger.Warn("push notification failed", zap.Int64("user_id", userID), zap.String("event_type", eventType), zap.Error(err))
			}
		}
	}
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
