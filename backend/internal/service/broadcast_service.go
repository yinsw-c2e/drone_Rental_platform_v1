package service

import (
	"context"
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

const (
	broadcastStatusOpen    = "open"
	broadcastStatusGrabbed = "grabbed"
	broadcastStatusClosed  = "closed"
	broadcastStatusExpired = "expired"

	defaultProviderRadiusKM     = 30.0
	defaultBroadcastTTL         = 120 * time.Second
	defaultPresenceStaleTimeout = 60 * time.Second
	defaultReservationLeadTime  = 2 * time.Hour
	defaultReservationTick      = time.Minute
)

var ErrBroadcastConflict = errors.New("广播单已被抢或已失效")

type BroadcastService struct {
	presenceRepo  *repository.ProviderPresenceRepo
	broadcastRepo *repository.OrderBroadcastRepo
	orderRepo     *repository.OrderRepo
	artifactRepo  *repository.OrderArtifactRepo
	userService   *UserService
	logger        *zap.Logger
}

type ProviderPresenceInput struct {
	Latitude               float64  `json:"latitude"`
	Longitude              float64  `json:"longitude"`
	AcceptedServiceClasses []string `json:"accepted_service_classes"`
	MaxRadiusKM            float64  `json:"max_radius_km"`
}

type ProviderBroadcastView struct {
	Broadcast        *model.OrderBroadcast `json:"broadcast"`
	Order            *model.Order          `json:"order"`
	DistanceKM       float64               `json:"distance_km"`
	RemainingSeconds int64                 `json:"remaining_seconds"`
}

func NewBroadcastService(
	presenceRepo *repository.ProviderPresenceRepo,
	broadcastRepo *repository.OrderBroadcastRepo,
	orderRepo *repository.OrderRepo,
	artifactRepo *repository.OrderArtifactRepo,
	userService *UserService,
	logger *zap.Logger,
) *BroadcastService {
	return &BroadcastService{
		presenceRepo:  presenceRepo,
		broadcastRepo: broadcastRepo,
		orderRepo:     orderRepo,
		artifactRepo:  artifactRepo,
		userService:   userService,
		logger:        logger,
	}
}

func (s *BroadcastService) SetOnline(userID int64, input ProviderPresenceInput) (*model.ProviderPresence, error) {
	return s.upsertPresence(userID, true, input)
}

func (s *BroadcastService) Heartbeat(userID int64, input ProviderPresenceInput) (*model.ProviderPresence, error) {
	return s.upsertPresence(userID, true, input)
}

func (s *BroadcastService) SetOffline(userID int64) error {
	if s == nil || s.presenceRepo == nil {
		return errors.New("服务商在线状态依赖未初始化")
	}
	if userID <= 0 {
		return errors.New("服务商账号无效")
	}
	return s.presenceRepo.SetOffline(userID, time.Now())
}

func (s *BroadcastService) GetPresence(userID int64) (*model.ProviderPresence, error) {
	if s == nil || s.presenceRepo == nil {
		return nil, errors.New("服务商在线状态依赖未初始化")
	}
	return s.presenceRepo.GetByUserID(userID)
}

func (s *BroadcastService) ListOpenForProvider(userID int64, limit int) ([]ProviderBroadcastView, error) {
	if s == nil || s.presenceRepo == nil || s.broadcastRepo == nil {
		return nil, errors.New("抢单广播依赖未初始化")
	}

	now := time.Now()
	_, _ = s.presenceRepo.MarkStaleOffline(now.Add(-defaultPresenceStaleTimeout))
	_, _ = s.broadcastRepo.MarkExpired(now, 200)

	presence, err := s.requireOnlinePresence(userID, now)
	if err != nil {
		return nil, err
	}

	items, err := s.broadcastRepo.ListOpen(now, limit)
	if err != nil {
		return nil, err
	}

	accepted := decodeProviderServiceClasses(presence.AcceptedServiceClasses)
	radius := normalizeProviderRadius(presence.MaxRadiusKM)
	views := make([]ProviderBroadcastView, 0, len(items))
	for i := range items {
		item := &items[i]
		if item.Order == nil || !canBroadcastOrderBeGrabbed(item.Order) {
			continue
		}
		if !providerAcceptsServiceClass(accepted, item.ServiceClassCode) {
			continue
		}
		distanceKM := haversineKM(presence.LastLatitude, presence.LastLongitude, item.OriginLatitude, item.OriginLongitude)
		if radius > 0 && distanceKM > radius {
			continue
		}
		remaining := int64(math.Max(0, item.ExpiresAt.Sub(now).Seconds()))
		views = append(views, ProviderBroadcastView{
			Broadcast:        item,
			Order:            item.Order,
			DistanceKM:       math.Round(distanceKM*10) / 10,
			RemainingSeconds: remaining,
		})
	}

	return views, nil
}

func (s *BroadcastService) Grab(broadcastID, providerUserID int64) (*model.Order, error) {
	var lastErr error
	for attempt := 0; attempt < 8; attempt++ {
		order, err := s.grabOnce(broadcastID, providerUserID)
		if err == nil {
			return order, nil
		}
		if !isTransientDatabaseLock(err) {
			return nil, err
		}
		lastErr = err
		time.Sleep(time.Duration(attempt+1) * 10 * time.Millisecond)
	}
	return nil, lastErr
}

func (s *BroadcastService) grabOnce(broadcastID, providerUserID int64) (*model.Order, error) {
	if s == nil || s.orderRepo == nil || s.broadcastRepo == nil || s.presenceRepo == nil {
		return nil, errors.New("抢单广播依赖未初始化")
	}
	if broadcastID <= 0 {
		return nil, errors.New("广播单ID无效")
	}
	if providerUserID <= 0 {
		return nil, errors.New("服务商账号无效")
	}

	now := time.Now()
	presence, err := s.requireOnlinePresence(providerUserID, now)
	if err != nil {
		return nil, err
	}

	db := s.orderRepo.DB()
	if db == nil {
		return s.grabWithRepos(broadcastID, providerUserID, presence, now, s.orderRepo, s.broadcastRepo, s.artifactRepo)
	}

	var grabbed *model.Order
	err = db.Transaction(func(tx *gorm.DB) error {
		order, txErr := s.grabWithRepos(
			broadcastID,
			providerUserID,
			presence,
			now,
			repository.NewOrderRepo(tx),
			repository.NewOrderBroadcastRepo(tx),
			repository.NewOrderArtifactRepo(tx),
		)
		if txErr != nil {
			return txErr
		}
		grabbed = order
		return nil
	})
	if err != nil {
		return nil, err
	}
	return grabbed, nil
}

func (s *BroadcastService) CreateForOrder(order *model.Order) (*model.OrderBroadcast, error) {
	return s.createForOrderWithRepos(order, s.orderRepo, s.broadcastRepo, s.artifactRepo, time.Now())
}

func (s *BroadcastService) EnqueueDueReservations(now time.Time, limit int) (int, error) {
	if s == nil || s.orderRepo == nil || s.broadcastRepo == nil {
		return 0, errors.New("预约单入池依赖未初始化")
	}
	if now.IsZero() {
		now = time.Now()
	}
	cutoff := now.Add(defaultReservationLeadTime)
	orders, err := s.orderRepo.ListDueReservationOrders(cutoff, limit)
	if err != nil {
		return 0, err
	}

	count := 0
	for i := range orders {
		orderID := orders[i].ID
		db := s.orderRepo.DB()
		if db == nil {
			if err := s.enqueueReservationWithRepos(orderID, now, s.orderRepo, s.broadcastRepo, s.artifactRepo); err != nil {
				return count, err
			}
			count++
			continue
		}
		err := db.Transaction(func(tx *gorm.DB) error {
			return s.enqueueReservationWithRepos(
				orderID,
				now,
				repository.NewOrderRepo(tx),
				repository.NewOrderBroadcastRepo(tx),
				repository.NewOrderArtifactRepo(tx),
			)
		})
		if err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

func (s *BroadcastService) ExpireOpenBroadcasts(now time.Time, limit int) (int64, error) {
	if s == nil || s.broadcastRepo == nil {
		return 0, errors.New("抢单广播依赖未初始化")
	}
	if now.IsZero() {
		now = time.Now()
	}
	return s.broadcastRepo.MarkExpired(now, limit)
}

func (s *BroadcastService) StartReservationScheduler(ctx context.Context) {
	if s == nil {
		return
	}
	ticker := time.NewTicker(defaultReservationTick)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case now := <-ticker.C:
				if _, err := s.EnqueueDueReservations(now, 200); err != nil && s.logger != nil {
					s.logger.Warn("enqueue due reservation broadcasts failed", zap.Error(err))
				}
				if _, err := s.ExpireOpenBroadcasts(now, 500); err != nil && s.logger != nil {
					s.logger.Warn("expire open broadcasts failed", zap.Error(err))
				}
			}
		}
	}()
}

func (s *BroadcastService) upsertPresence(userID int64, online bool, input ProviderPresenceInput) (*model.ProviderPresence, error) {
	if s == nil || s.presenceRepo == nil {
		return nil, errors.New("服务商在线状态依赖未初始化")
	}
	if userID <= 0 {
		return nil, errors.New("服务商账号无效")
	}
	if err := s.requireProviderWorkbenchAccess(userID); err != nil {
		return nil, err
	}
	if !validCoordinate(input.Latitude, input.Longitude) {
		return nil, errors.New("服务商位置经纬度无效")
	}
	now := time.Now()
	radius := normalizeProviderRadius(input.MaxRadiusKM)
	presence := &model.ProviderPresence{
		UserID:                 userID,
		Online:                 online,
		LastLatitude:           input.Latitude,
		LastLongitude:          input.Longitude,
		LastHeartbeatAt:        &now,
		AcceptedServiceClasses: encodeProviderServiceClasses(input.AcceptedServiceClasses),
		MaxRadiusKM:            radius,
		Status:                 "active",
	}
	if err := s.presenceRepo.Upsert(presence); err != nil {
		return nil, err
	}
	return s.presenceRepo.GetByUserID(userID)
}

func (s *BroadcastService) requireOnlinePresence(userID int64, now time.Time) (*model.ProviderPresence, error) {
	if err := s.requireProviderWorkbenchAccess(userID); err != nil {
		return nil, err
	}
	presence, err := s.presenceRepo.GetByUserID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("服务商未上线，无法接单")
		}
		return nil, err
	}
	if !presence.Online || presence.Status != "active" || presence.LastHeartbeatAt == nil || presence.LastHeartbeatAt.Before(now.Add(-defaultPresenceStaleTimeout)) {
		return nil, errors.New("服务商未上线，无法接单")
	}
	return presence, nil
}

func (s *BroadcastService) requireProviderWorkbenchAccess(userID int64) error {
	if s == nil || s.userService == nil {
		return nil
	}
	summary, err := s.userService.GetRoleSummary(userID)
	if err != nil {
		return err
	}
	if summary == nil || !summary.Provider.CanUseWorkbench {
		return errors.New("服务商能力未审核通过，无法上线接单")
	}
	return nil
}

func (s *BroadcastService) createForOrderWithRepos(
	order *model.Order,
	orderRepo *repository.OrderRepo,
	broadcastRepo *repository.OrderBroadcastRepo,
	artifactRepo *repository.OrderArtifactRepo,
	now time.Time,
) (*model.OrderBroadcast, error) {
	if order == nil || order.ID == 0 {
		return nil, errors.New("订单不存在")
	}
	if broadcastRepo == nil || orderRepo == nil {
		return nil, errors.New("抢单广播依赖未初始化")
	}
	if !canBroadcastOrderBeCreated(order) {
		return nil, errors.New("当前订单状态不允许创建广播")
	}

	existing, err := broadcastRepo.GetByOrderID(order.ID)
	if err == nil {
		return existing, nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	broadcast := &model.OrderBroadcast{
		OrderID:             order.ID,
		OriginLatitude:      order.ServiceLatitude,
		OriginLongitude:     order.ServiceLongitude,
		ServiceClassCode:    order.ServiceClassCode,
		WeightKG:            order.CargoWeightKG,
		EstimatedTotalCents: order.TotalAmount,
		Status:              broadcastStatusOpen,
		ExpiresAt:           now.Add(defaultBroadcastTTL),
		GrabbedByUserID:     0,
	}
	if err := broadcastRepo.Create(broadcast); err != nil {
		return nil, err
	}

	if err := orderRepo.UpdateFields(order.ID, map[string]interface{}{
		"broadcast_pool_id": broadcast.ID,
		"updated_at":        now,
	}); err != nil {
		return nil, err
	}
	order.BroadcastPoolID = &broadcast.ID
	if artifactRepo != nil {
		_ = repository.UpsertOrderSnapshotBundle(artifactRepo, order, nil, nil)
	}
	return broadcast, nil
}

func (s *BroadcastService) grabWithRepos(
	broadcastID, providerUserID int64,
	presence *model.ProviderPresence,
	now time.Time,
	orderRepo *repository.OrderRepo,
	broadcastRepo *repository.OrderBroadcastRepo,
	artifactRepo *repository.OrderArtifactRepo,
) (*model.Order, error) {
	broadcast, err := broadcastRepo.LockByID(broadcastID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("广播单不存在")
		}
		return nil, err
	}
	if broadcast.Status != broadcastStatusOpen || !broadcast.ExpiresAt.After(now) || broadcast.GrabbedByUserID != 0 {
		return nil, fmt.Errorf("%w: 广播单已被抢或已过期", ErrBroadcastConflict)
	}

	order, err := orderRepo.LockByID(broadcast.OrderID)
	if err != nil {
		return nil, err
	}
	if !canBroadcastOrderBeGrabbed(order) {
		return nil, fmt.Errorf("%w: 订单当前状态不可抢", ErrBroadcastConflict)
	}
	if !providerCanGrabBroadcast(presence, broadcast) {
		return nil, errors.New("当前服务商不在接单范围或不支持该机型档")
	}

	if err := broadcastRepo.UpdateFields(broadcast.ID, map[string]interface{}{
		"status":             broadcastStatusGrabbed,
		"grabbed_by_user_id": providerUserID,
		"grabbed_at":         &now,
		"updated_at":         now,
	}); err != nil {
		return nil, err
	}

	if err := orderRepo.UpdateFields(order.ID, map[string]interface{}{
		"status":                 "assigned",
		"provider_user_id":       providerUserID,
		"owner_id":               providerUserID,
		"drone_owner_user_id":    providerUserID,
		"executor_pilot_user_id": providerUserID,
		"execution_mode":         "self_execute",
		"needs_dispatch":         false,
		"grabbed_by_user_id":     providerUserID,
		"grabbed_at":             &now,
		"broadcast_pool_id":      broadcast.ID,
		"provider_confirmed_at":  &now,
		"updated_at":             now,
	}); err != nil {
		return nil, err
	}

	order.Status = "assigned"
	order.ProviderUserID = providerUserID
	order.OwnerID = providerUserID
	order.DroneOwnerUserID = providerUserID
	order.ExecutorPilotUserID = providerUserID
	order.ExecutionMode = "self_execute"
	order.NeedsDispatch = false
	order.GrabbedByUserID = providerUserID
	order.GrabbedAt = &now
	order.BroadcastPoolID = &broadcast.ID
	order.ProviderConfirmedAt = &now

	if err := orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      order.ID,
		Status:       "assigned",
		Note:         "服务商已抢单，订单进入履约推进",
		OperatorID:   providerUserID,
		OperatorType: "owner",
	}); err != nil {
		return nil, err
	}
	if artifactRepo != nil {
		if err := repository.UpsertOrderSnapshotBundle(artifactRepo, order, nil, nil); err != nil {
			return nil, err
		}
	}

	return order, nil
}

func (s *BroadcastService) enqueueReservationWithRepos(
	orderID int64,
	now time.Time,
	orderRepo *repository.OrderRepo,
	broadcastRepo *repository.OrderBroadcastRepo,
	artifactRepo *repository.OrderArtifactRepo,
) error {
	order, err := orderRepo.LockByID(orderID)
	if err != nil {
		return err
	}
	if normalizeOrderMode(order.OrderMode) != OrderModeReservation || order.Status != "scheduled" {
		return nil
	}
	if err := orderRepo.UpdateFields(order.ID, map[string]interface{}{
		"status":     "pending_dispatch",
		"updated_at": now,
	}); err != nil {
		return err
	}
	order.Status = "pending_dispatch"
	if err := orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      order.ID,
		Status:       "pending_dispatch",
		Note:         "预约单到达入池时间，已进入服务商抢单池",
		OperatorID:   0,
		OperatorType: "system",
	}); err != nil {
		return err
	}
	_, err = s.createForOrderWithRepos(order, orderRepo, broadcastRepo, artifactRepo, now)
	return err
}

func canBroadcastOrderBeCreated(order *model.Order) bool {
	if order == nil {
		return false
	}
	mode := normalizeOrderMode(order.OrderMode)
	return (mode == OrderModeInstant || mode == OrderModeReservation) && order.Status == "pending_dispatch"
}

func canBroadcastOrderBeGrabbed(order *model.Order) bool {
	if order == nil {
		return false
	}
	if !canBroadcastOrderBeCreated(order) {
		return false
	}
	return order.GrabbedByUserID == 0 && order.ProviderUserID == 0
}

func providerCanGrabBroadcast(presence *model.ProviderPresence, broadcast *model.OrderBroadcast) bool {
	if presence == nil || broadcast == nil {
		return false
	}
	accepted := decodeProviderServiceClasses(presence.AcceptedServiceClasses)
	if !providerAcceptsServiceClass(accepted, broadcast.ServiceClassCode) {
		return false
	}
	radius := normalizeProviderRadius(presence.MaxRadiusKM)
	distanceKM := haversineKM(presence.LastLatitude, presence.LastLongitude, broadcast.OriginLatitude, broadcast.OriginLongitude)
	return radius <= 0 || distanceKM <= radius
}

func providerAcceptsServiceClass(accepted []string, serviceClassCode string) bool {
	if len(accepted) == 0 {
		return true
	}
	code := strings.TrimSpace(serviceClassCode)
	for _, item := range accepted {
		if strings.TrimSpace(item) == code {
			return true
		}
	}
	return false
}

func normalizeProviderRadius(value float64) float64 {
	if value <= 0 {
		return defaultProviderRadiusKM
	}
	if value > 300 {
		return 300
	}
	return value
}

func encodeProviderServiceClasses(values []string) model.JSON {
	normalized := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}
	raw, err := json.Marshal(normalized)
	if err != nil {
		return model.JSON("[]")
	}
	return model.JSON(raw)
}

func decodeProviderServiceClasses(raw model.JSON) []string {
	if len(raw) == 0 {
		return nil
	}
	var values []string
	if err := json.Unmarshal(raw, &values); err != nil {
		return nil
	}
	normalized := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			normalized = append(normalized, value)
		}
	}
	return normalized
}

func isTransientDatabaseLock(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "database table is locked") || strings.Contains(message, "database is locked")
}
