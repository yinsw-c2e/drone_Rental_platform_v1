package service

import (
	"strings"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type OrderAnomalyService struct {
	orderRepo *repository.OrderRepo
}

func NewOrderAnomalyService(orderRepo *repository.OrderRepo) *OrderAnomalyService {
	return &OrderAnomalyService{orderRepo: orderRepo}
}

func (s *OrderAnomalyService) ListForUser(userID int64, role string, page, pageSize int, filters map[string]interface{}) ([]model.OrderAnomaly, int64, error) {
	return s.orderRepo.ListUserOrderAnomalies(userID, normalizeAnomalyRole(role), page, pageSize, filters)
}

func (s *OrderAnomalyService) SummaryForUser(userID int64, role string, filters map[string]interface{}) (*model.OrderAnomalySummary, error) {
	return s.orderRepo.GetUserOrderAnomalySummary(userID, normalizeAnomalyRole(role), filters)
}

func normalizeAnomalyRole(role string) string {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "client", "owner", "pilot":
		return strings.ToLower(strings.TrimSpace(role))
	default:
		return ""
	}
}

func BuildAnomalyRecommendedAction(anomalyType string) string {
	switch strings.ToLower(strings.TrimSpace(anomalyType)) {
	case "stalled_pending_dispatch":
		return "请优先联系平台或机主处理派单，避免订单继续长时间停滞。"
	case "execution_without_dispatch_task":
		return "请先补齐正式派单记录，再继续推进执行、飞行或交付。"
	case "provider_rejected_missing_reason":
		return "请补充拒单原因，便于对方与平台判断后续处理。"
	case "missing_source_supply", "missing_demand_source":
		return "请联系平台核对订单来源信息，避免后续追溯、合同或结算受影响。"
	case "completed_missing_timestamp":
		return "请尽快补录完成时间，避免影响结算、评价和运营统计。"
	default:
		return "请打开订单详情查看异常上下文，并尽快处理当前问题。"
	}
}

func BuildAnomalyStageLabel(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "pending_provider_confirmation":
		return "待机主确认"
	case "pending_payment":
		return "待客户支付"
	case "pending_dispatch":
		return "待派单"
	case "assigned":
		return "已分配执行"
	case "preparing", "loading":
		return "准备中"
	case "airspace_applying":
		return "申请空域中"
	case "airspace_approved":
		return "空域已批准"
	case "in_transit":
		return "运输中"
	case "delivered":
		return "待签收"
	case "completed":
		return "已完成"
	case "provider_rejected":
		return "机主已拒绝"
	default:
		if strings.TrimSpace(status) == "" {
			return "订单处理中"
		}
		return status
	}
}
