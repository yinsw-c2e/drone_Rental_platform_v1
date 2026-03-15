package service

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

const (
	homeDashboardServiceType = "heavy_cargo_lift_transport"
	homeOrderScanLimit       = 100
	homeDemandScanLimit      = 100
)

var homeInProgressStatuses = map[string]bool{
	"in_progress":       true,
	"confirmed":         true,
	"airspace_applying": true,
	"airspace_approved": true,
	"loading":           true,
	"preparing":         true,
	"assigned":          true,
	"in_transit":        true,
	"delivered":         true,
}

var homeCompletedStatuses = map[string]bool{
	"completed": true,
	"delivered": true,
}

type HomeDashboard struct {
	RoleSummary      RoleSummary           `json:"role_summary"`
	Summary          HomeDashboardSummary  `json:"summary"`
	MarketTotals     HomeDashboardTotals   `json:"market_totals"`
	RoleViews        HomeDashboardRoleView `json:"role_views"`
	InProgressOrders []HomeOrderCard       `json:"in_progress_orders"`
	MarketFeed       []HomeFeedItem        `json:"market_feed"`
}

type HomeDashboardSummary struct {
	InProgressOrderCount int   `json:"in_progress_order_count"`
	TodayOrderCount      int   `json:"today_order_count"`
	TodayIncomeAmount    int64 `json:"today_income_amount"`
	AlertCount           int   `json:"alert_count"`
}

type HomeDashboardTotals struct {
	SupplyCount int64 `json:"supply_count"`
	DemandCount int64 `json:"demand_count"`
}

type HomeDashboardRoleView struct {
	Client HomeClientDashboard `json:"client"`
	Owner  HomeOwnerDashboard  `json:"owner"`
	Pilot  HomePilotDashboard  `json:"pilot"`
}

type HomeClientDashboard struct {
	OpenDemandCount                       int64 `json:"open_demand_count"`
	QuotedDemandCount                     int64 `json:"quoted_demand_count"`
	PendingProviderConfirmationOrderCount int64 `json:"pending_provider_confirmation_order_count"`
	PendingPaymentOrderCount              int64 `json:"pending_payment_order_count"`
	InProgressOrderCount                  int64 `json:"in_progress_order_count"`
}

type HomeOwnerDashboard struct {
	RecommendedDemandCount                int64 `json:"recommended_demand_count"`
	ActiveSupplyCount                     int64 `json:"active_supply_count"`
	PendingQuoteCount                     int64 `json:"pending_quote_count"`
	PendingProviderConfirmationOrderCount int64 `json:"pending_provider_confirmation_order_count"`
	PendingDispatchOrderCount             int64 `json:"pending_dispatch_order_count"`
}

type HomePilotDashboard struct {
	PendingResponseDispatchCount int64 `json:"pending_response_dispatch_count"`
	CandidateDemandCount         int64 `json:"candidate_demand_count"`
	ActiveDispatchCount          int64 `json:"active_dispatch_count"`
	RecentFlightCount            int64 `json:"recent_flight_count"`
}

type HomeOrderCard struct {
	ID          int64     `json:"id"`
	OrderNo     string    `json:"order_no"`
	Title       string    `json:"title"`
	Status      string    `json:"status"`
	TotalAmount int64     `json:"total_amount"`
	CreatedAt   time.Time `json:"created_at"`
}

type HomeFeedItem struct {
	ObjectType string `json:"object_type"`
	ObjectID   int64  `json:"object_id"`
	Badge      string `json:"badge"`
	Title      string `json:"title"`
	Subtitle   string `json:"subtitle"`
}

type HomeService struct {
	userService      *UserService
	clientService    *ClientService
	ownerService     *OwnerService
	pilotService     *PilotService
	orderService     *OrderService
	demandDomainRepo *repository.DemandDomainRepo
}

func NewHomeService(
	userService *UserService,
	clientService *ClientService,
	ownerService *OwnerService,
	pilotService *PilotService,
	orderService *OrderService,
	demandDomainRepo *repository.DemandDomainRepo,
) *HomeService {
	return &HomeService{
		userService:      userService,
		clientService:    clientService,
		ownerService:     ownerService,
		pilotService:     pilotService,
		orderService:     orderService,
		demandDomainRepo: demandDomainRepo,
	}
}

func (s *HomeService) GetDashboard(userID int64) (*HomeDashboard, error) {
	roleSummary, err := s.userService.GetRoleSummary(userID)
	if err != nil {
		return nil, err
	}

	allOrders, _, err := s.orderService.ListOrders(userID, "", "", 1, homeOrderScanLimit)
	if err != nil {
		return nil, err
	}
	summary := buildHomeSummary(allOrders)
	inProgressOrders := buildHomeOrderCards(allOrders, 3)

	supplies, supplyTotal, err := s.clientService.ListMarketplaceSupplies(SupplyMarketQuery{
		ServiceType: homeDashboardServiceType,
	}, 1, 2)
	if err != nil {
		return nil, err
	}
	demands, demandTotal, err := s.demandDomainRepo.ListRecommendedDemands(1, 4)
	if err != nil {
		return nil, err
	}

	dashboard := &HomeDashboard{
		RoleSummary: *roleSummary,
		Summary:     summary,
		MarketTotals: HomeDashboardTotals{
			SupplyCount: supplyTotal,
			DemandCount: demandTotal,
		},
		RoleViews: HomeDashboardRoleView{},
		MarketFeed: append(
			buildSupplyFeedItems(supplies),
			buildDemandFeedItems(demands)...,
		),
		InProgressOrders: inProgressOrders,
	}

	if roleSummary.HasClientRole {
		view, err := s.buildClientDashboard(userID)
		if err != nil {
			return nil, err
		}
		dashboard.RoleViews.Client = *view
	}
	if roleSummary.HasOwnerRole {
		view, err := s.buildOwnerDashboard(userID)
		if err != nil {
			return nil, err
		}
		dashboard.RoleViews.Owner = *view
	}
	if roleSummary.HasPilotRole {
		view, err := s.buildPilotDashboard(userID)
		if err != nil {
			return nil, err
		}
		dashboard.RoleViews.Pilot = *view
	}

	return dashboard, nil
}

func (s *HomeService) buildClientDashboard(userID int64) (*HomeClientDashboard, error) {
	demands, _, err := s.clientService.ListMyDemands(userID, "", 1, homeDemandScanLimit)
	if err != nil {
		return nil, err
	}
	demandIDs := make([]int64, 0, len(demands))
	for i := range demands {
		demandIDs = append(demandIDs, demands[i].ID)
	}
	statsByDemand, err := s.clientService.GetDemandStats(demandIDs)
	if err != nil {
		return nil, err
	}

	view := &HomeClientDashboard{}
	for i := range demands {
		status := strings.ToLower(strings.TrimSpace(demands[i].Status))
		if status == "published" || status == "quoting" {
			view.OpenDemandCount++
		}
		if status == "published" || status == "quoting" || status == "selected" {
			if stats := statsByDemand[demands[i].ID]; stats.QuoteCount > 0 {
				view.QuotedDemandCount++
			}
		}
	}

	orders, _, err := s.orderService.ListOrders(userID, "client", "", 1, homeOrderScanLimit)
	if err != nil {
		return nil, err
	}
	for i := range orders {
		status := normalizeHomeStatus(orders[i].Status)
		if status == "pending_provider_confirmation" {
			view.PendingProviderConfirmationOrderCount++
		}
		if status == "pending_payment" {
			view.PendingPaymentOrderCount++
		}
		if homeInProgressStatuses[status] {
			view.InProgressOrderCount++
		}
	}

	return view, nil
}

func (s *HomeService) buildOwnerDashboard(userID int64) (*HomeOwnerDashboard, error) {
	view := &HomeOwnerDashboard{}

	_, recommendedTotal, err := s.ownerService.ListRecommendedDemands(userID, 1, 1)
	if err != nil {
		return nil, err
	}
	view.RecommendedDemandCount = recommendedTotal

	_, activeSupplyTotal, err := s.ownerService.ListMySupplies(userID, "active", 1, 1)
	if err != nil {
		return nil, err
	}
	view.ActiveSupplyCount = activeSupplyTotal

	_, pendingQuoteTotal, err := s.ownerService.ListMyQuotes(userID, "submitted", 1, 1)
	if err != nil {
		return nil, err
	}
	view.PendingQuoteCount = pendingQuoteTotal

	orders, _, err := s.orderService.ListOrders(userID, "owner", "", 1, homeOrderScanLimit)
	if err != nil {
		return nil, err
	}
	for i := range orders {
		if normalizeHomeStatus(orders[i].Status) == "pending_provider_confirmation" {
			view.PendingProviderConfirmationOrderCount++
		}
		if normalizeHomeStatus(orders[i].Status) == "pending_dispatch" {
			view.PendingDispatchOrderCount++
		}
	}

	return view, nil
}

func (s *HomeService) buildPilotDashboard(userID int64) (*HomePilotDashboard, error) {
	view := &HomePilotDashboard{}

	_, pendingResponseTotal, err := s.pilotService.ListDispatchTasks(userID, "pending_response", 1, 1)
	if err != nil {
		return nil, err
	}
	view.PendingResponseDispatchCount = pendingResponseTotal

	_, candidateDemandTotal, err := s.pilotService.ListCandidateDemands(userID, 1, 1)
	if err != nil {
		return nil, err
	}
	view.CandidateDemandCount = candidateDemandTotal

	_, acceptedTotal, err := s.pilotService.ListDispatchTasks(userID, "accepted", 1, 1)
	if err != nil {
		return nil, err
	}
	_, executingTotal, err := s.pilotService.ListDispatchTasks(userID, "executing", 1, 1)
	if err != nil {
		return nil, err
	}
	view.ActiveDispatchCount = acceptedTotal + executingTotal

	_, flightTotal, err := s.pilotService.ListFlightRecords(userID, 1, 1)
	if err != nil {
		return nil, err
	}
	view.RecentFlightCount = flightTotal

	return view, nil
}

func buildHomeSummary(orders []model.Order) HomeDashboardSummary {
	todayKey := formatHomeDayKey(time.Now())
	summary := HomeDashboardSummary{}

	for i := range orders {
		status := normalizeHomeStatus(orders[i].Status)
		if homeInProgressStatuses[status] {
			summary.InProgressOrderCount++
			if isHomeAlertOrder(&orders[i]) {
				summary.AlertCount++
			}
		}

		if formatHomeDayKey(orders[i].CreatedAt) == todayKey {
			summary.TodayOrderCount++
			if homeCompletedStatuses[status] {
				summary.TodayIncomeAmount += orders[i].TotalAmount
			}
		}
	}

	return summary
}

func buildHomeOrderCards(orders []model.Order, limit int) []HomeOrderCard {
	if limit <= 0 {
		limit = 3
	}
	items := make([]HomeOrderCard, 0, limit)
	for i := range orders {
		if !homeInProgressStatuses[normalizeHomeStatus(orders[i].Status)] {
			continue
		}
		items = append(items, HomeOrderCard{
			ID:          orders[i].ID,
			OrderNo:     orders[i].OrderNo,
			Title:       orders[i].Title,
			Status:      orders[i].Status,
			TotalAmount: orders[i].TotalAmount,
			CreatedAt:   orders[i].CreatedAt,
		})
		if len(items) >= limit {
			break
		}
	}
	return items
}

func buildSupplyFeedItems(supplies []model.OwnerSupply) []HomeFeedItem {
	items := make([]HomeFeedItem, 0, len(supplies))
	for i := range supplies {
		subtitle := fmt.Sprintf("%s · 最大吊重 %.0fkg", homeSupplyAreaText(&supplies[i]), supplies[i].MaxPayloadKG)
		items = append(items, HomeFeedItem{
			ObjectType: "supply",
			ObjectID:   supplies[i].ID,
			Badge:      "供给",
			Title:      supplies[i].Title,
			Subtitle:   subtitle,
		})
	}
	return items
}

func buildDemandFeedItems(demands []model.Demand) []HomeFeedItem {
	items := make([]HomeFeedItem, 0, len(demands))
	for i := range demands {
		items = append(items, HomeFeedItem{
			ObjectType: "demand",
			ObjectID:   demands[i].ID,
			Badge:      "需求",
			Title:      demands[i].Title,
			Subtitle: fmt.Sprintf("%s · 预算¥%.0f-%.0f",
				homeDemandAddressText(&demands[i]),
				float64(demands[i].BudgetMin)/100,
				float64(demands[i].BudgetMax)/100,
			),
		})
	}
	return items
}

func normalizeHomeStatus(status string) string {
	return strings.ToLower(strings.TrimSpace(status))
}

func isHomeAlertOrder(order *model.Order) bool {
	if order == nil || order.CreatedAt.IsZero() {
		return false
	}
	return time.Since(order.CreatedAt) >= 6*time.Hour
}

func formatHomeDayKey(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Format("2006-01-02")
}

func homeSupplyAreaText(supply *model.OwnerSupply) string {
	if supply == nil {
		return "服务区域待完善"
	}
	if supply.Drone != nil && strings.TrimSpace(supply.Drone.City) != "" {
		return strings.TrimSpace(supply.Drone.City)
	}

	type serviceArea struct {
		Text string `json:"text"`
		City string `json:"city"`
	}
	var payload serviceArea
	if len(supply.ServiceAreaSnapshot) > 0 {
		_ = json.Unmarshal(supply.ServiceAreaSnapshot, &payload)
	}
	switch {
	case strings.TrimSpace(payload.Text) != "":
		return strings.TrimSpace(payload.Text)
	case strings.TrimSpace(payload.City) != "":
		return strings.TrimSpace(payload.City)
	default:
		return "服务区域待完善"
	}
}

func homeDemandAddressText(demand *model.Demand) string {
	if demand == nil {
		return "作业地点待完善"
	}
	for _, snapshot := range []model.JSON{
		demand.ServiceAddressSnapshot,
		demand.DepartureAddressSnapshot,
		demand.DestinationAddressSnapshot,
	} {
		if text := extractHomeAddressText(snapshot); text != "" {
			return text
		}
	}
	return "作业地点待完善"
}

func extractHomeAddressText(snapshot model.JSON) string {
	if len(snapshot) == 0 {
		return ""
	}
	var payload struct {
		Text     string `json:"text"`
		Address  string `json:"address"`
		City     string `json:"city"`
		District string `json:"district"`
	}
	_ = json.Unmarshal(snapshot, &payload)

	switch {
	case strings.TrimSpace(payload.Text) != "":
		return strings.TrimSpace(payload.Text)
	case strings.TrimSpace(payload.Address) != "":
		return strings.TrimSpace(payload.Address)
	case strings.TrimSpace(payload.City) != "" && strings.TrimSpace(payload.District) != "":
		return strings.TrimSpace(payload.City) + " " + strings.TrimSpace(payload.District)
	case strings.TrimSpace(payload.City) != "":
		return strings.TrimSpace(payload.City)
	default:
		return ""
	}
}
