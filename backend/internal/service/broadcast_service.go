package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

const (
	broadcastStatusOpen          = "open"
	broadcastStatusGrabbed       = "grabbed"
	broadcastStatusClosed        = "closed"
	broadcastStatusExpired       = "expired"
	broadcastStatusAutoAssigning = "auto_assigning"

	assignmentStatusPendingAccept = "pending_accept"
	assignmentStatusAccepted      = "accepted"
	assignmentStatusDeclined      = "declined"
	assignmentStatusExpired       = "expired"
	assignmentStatusSuperseded    = "superseded"

	defaultProviderRadiusKM     = 30.0
	defaultBroadcastTTL         = 120 * time.Second
	defaultPresenceStaleTimeout = 60 * time.Second
	defaultReservationLeadTime  = 2 * time.Hour
	defaultReservationTick      = time.Minute

	defaultAutoAssignEnabled          = true
	defaultAutoAssignTriggerLead      = 90 * time.Second
	defaultAutoAssignAcceptWindow     = 60 * time.Second
	defaultAutoAssignMaxAttempts      = 3
	defaultAutoAssignDistanceWeight   = 0.6
	defaultAutoAssignRatingWeight     = 0.2
	defaultAutoAssignCompletionWeight = 0.2

	defaultRedispatchBumpPercent      = 10.0
	defaultRedispatchRadiusBumpKM     = 10.0
	defaultRedispatchRadiusMaxKM      = 50.0
	defaultRedispatchMaxCountPerOrder = 3
	defaultRedispatchCooldownSeconds  = 60
	redispatchMatchingRadiusJSONKey   = "matching_radius_km"
	redispatchLegacyRadiusJSONKey     = "redispatch_matching_radius_km"
	redispatchPriceBumpCentsJSONKey   = "redispatch_price_bump_cents"
	redispatchPriceBumpPercentJSONKey = "redispatch_price_bump_percent"
	redispatchCountJSONKey            = "redispatch_count"
	redispatchLastAtJSONKey           = "redispatch_last_at"
)

var (
	ErrBroadcastConflict            = errors.New("该派单已被其他服务商抢单或已失效")
	ErrBroadcastLockedByAssign      = errors.New("broadcast_locked_by_assign")
	ErrBroadcastTakenByOther        = errors.New("broadcast_taken")
	ErrBroadcastStatusInvalid       = errors.New("broadcast_status_invalid")
	ErrBroadcastPreviouslyCancelled = errors.New("broadcast_previously_cancelled")
	ErrRedispatchRateLimited        = errors.New("redispatch_rate_limited")
	ErrRedispatchCapped             = errors.New("redispatch_capped")
	ErrProviderNotSelfExecutable    = errors.New("provider_not_self_executable")
)

type broadcastConflictReasonError struct {
	reason  error
	message string
}

func (e broadcastConflictReasonError) Error() string {
	if strings.TrimSpace(e.message) == "" {
		return ErrBroadcastConflict.Error()
	}
	return fmt.Sprintf("%s: %s", ErrBroadcastConflict.Error(), e.message)
}

func (e broadcastConflictReasonError) Unwrap() []error {
	if e.reason == nil {
		return []error{ErrBroadcastConflict}
	}
	return []error{ErrBroadcastConflict, e.reason}
}

func newBroadcastConflictError(reason error, message string) error {
	return broadcastConflictReasonError{reason: reason, message: message}
}

type BroadcastService struct {
	presenceRepo        *repository.ProviderPresenceRepo
	broadcastRepo       *repository.OrderBroadcastRepo
	assignmentRepo      *repository.BroadcastAssignmentRepo
	orderRepo           *repository.OrderRepo
	artifactRepo        *repository.OrderArtifactRepo
	userService         *UserService
	settlementService   *SettlementService
	systemConfigService *SystemConfigService
	eventService        *EventService
	logger              *zap.Logger
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

type ProviderAssignmentView struct {
	Assignment       *model.BroadcastAssignment `json:"assignment"`
	Broadcast        *model.OrderBroadcast      `json:"broadcast"`
	Order            *model.Order               `json:"order"`
	RemainingSeconds int64                      `json:"remaining_seconds"`
}

type DispatchState struct {
	OnlineProvidersCount int   `json:"online_providers_count"`
	ElapsedSeconds       int64 `json:"elapsed_seconds"`
	EstimatedWaitSeconds int64 `json:"estimated_wait_seconds"`
	TriedProvidersCount  int   `json:"tried_providers_count"`
}

type ProviderStats struct {
	Rating                 *float64 `json:"rating"`
	CompletionRate         *float64 `json:"completion_rate"`
	TodayOrderCount        int      `json:"today_order_count"`
	TodayIncomeCents       int64    `json:"today_income_cents"`
	TotalCompletedOrders   int      `json:"total_completed_orders"`
	PendingSettlementCents int64    `json:"pending_settlement_cents"`
}

type RedispatchOrderOptions struct {
	PriceBumpPercent float64 `json:"price_bump_percent"`
	PriceBumpCents   int64   `json:"price_bump_cents"`
	RadiusBumpKM     float64 `json:"radius_bump_km"`
	OperatorUserID   int64   `json:"operator_user_id"`
}

type RedispatchOrderResult struct {
	Order            *model.Order          `json:"order"`
	Broadcast        *model.OrderBroadcast `json:"broadcast"`
	PriceBumpCents   int64                 `json:"price_bump_cents"`
	MatchingRadiusKM float64               `json:"matching_radius_km"`
}

func NewBroadcastService(
	presenceRepo *repository.ProviderPresenceRepo,
	broadcastRepo *repository.OrderBroadcastRepo,
	assignmentRepo *repository.BroadcastAssignmentRepo,
	orderRepo *repository.OrderRepo,
	artifactRepo *repository.OrderArtifactRepo,
	userService *UserService,
	logger *zap.Logger,
) *BroadcastService {
	return &BroadcastService{
		presenceRepo:   presenceRepo,
		broadcastRepo:  broadcastRepo,
		assignmentRepo: assignmentRepo,
		orderRepo:      orderRepo,
		artifactRepo:   artifactRepo,
		userService:    userService,
		logger:         logger,
	}
}

func (s *BroadcastService) SetSystemConfigService(systemConfigService *SystemConfigService) {
	if s != nil {
		s.systemConfigService = systemConfigService
	}
}

func (s *BroadcastService) SetEventService(eventService *EventService) {
	if s != nil {
		s.eventService = eventService
	}
}

func (s *BroadcastService) SetSettlementService(settlementService *SettlementService) {
	if s != nil {
		s.settlementService = settlementService
	}
}

func (s *BroadcastService) GetProviderStats(userID int64) *ProviderStats {
	stats := &ProviderStats{}
	if s == nil || userID <= 0 {
		return stats
	}
	if s.userService != nil {
		stats.Rating = s.userService.GetProviderRatingNullable(userID)
		stats.CompletionRate = s.userService.GetProviderCompletionRateNullable(userID)
	}
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	if s.orderRepo != nil {
		if count, legacyGrossIncome, err := s.orderRepo.CountTodayProviderOrders(userID, today); err == nil {
			stats.TodayOrderCount = count
			if s.userService == nil {
				stats.TodayIncomeCents = legacyGrossIncome
			}
		}
		if completed, err := s.orderRepo.CountCompletedProviderOrders(userID); err == nil {
			stats.TotalCompletedOrders = completed
		}
	}
	if s.userService != nil {
		if income, err := s.userService.GetTodayProviderIncomeCents(userID, today); err == nil {
			stats.TodayIncomeCents = income
		}
	}
	if s.settlementService != nil {
		if pending, err := s.settlementService.GetPendingAmountForUser(userID); err == nil {
			stats.PendingSettlementCents = pending
		}
	}
	return stats
}

func (s *BroadcastService) GetDispatchState(order *model.Order, now time.Time) (*DispatchState, error) {
	state := &DispatchState{}
	if order == nil {
		return state, nil
	}
	if now.IsZero() {
		now = time.Now()
	}
	if !order.CreatedAt.IsZero() && now.After(order.CreatedAt) {
		state.ElapsedSeconds = int64(now.Sub(order.CreatedAt).Seconds())
	}
	if s == nil || s.broadcastRepo == nil {
		return state, nil
	}

	broadcast, err := s.broadcastRepo.GetByOrderID(order.ID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return state, nil
		}
		return nil, err
	}
	if broadcast.ExpiresAt.After(now) && (broadcast.Status == broadcastStatusOpen || broadcast.Status == broadcastStatusAutoAssigning) {
		state.EstimatedWaitSeconds = int64(broadcast.ExpiresAt.Sub(now).Seconds())
	}

	if s.presenceRepo != nil {
		presences, err := s.presenceRepo.ListOnlineSince(now.Add(-s.presenceStaleTimeout()))
		if err != nil {
			return nil, err
		}
		for i := range presences {
			if s.providerCanGrabBroadcast(&presences[i], broadcast, order) {
				state.OnlineProvidersCount++
			}
		}
	}

	if s.assignmentRepo != nil {
		tried, err := s.assignmentRepo.CountDistinctProviders(order.ID, broadcast.ID)
		if err != nil {
			return nil, err
		}
		state.TriedProvidersCount = int(tried)
	}
	return state, nil
}

func (s *BroadcastService) shouldAutoAssign() bool {
	if s == nil || s.systemConfigService == nil {
		return defaultAutoAssignEnabled
	}
	return s.systemConfigService.GetBool("broadcast.auto_assign.enabled", defaultAutoAssignEnabled)
}

func (s *BroadcastService) broadcastTTL() time.Duration {
	seconds := int(defaultBroadcastTTL.Seconds())
	if s != nil && s.systemConfigService != nil {
		seconds = s.systemConfigService.GetInt("broadcast.ttl_seconds", seconds)
	}
	if seconds <= 0 {
		seconds = int(defaultBroadcastTTL.Seconds())
	}
	return time.Duration(seconds) * time.Second
}

func (s *BroadcastService) presenceStaleTimeout() time.Duration {
	seconds := int(defaultPresenceStaleTimeout.Seconds())
	if s != nil && s.systemConfigService != nil {
		seconds = s.systemConfigService.GetInt("broadcast.presence.stale_timeout_seconds", seconds)
	}
	if seconds <= 0 {
		seconds = int(defaultPresenceStaleTimeout.Seconds())
	}
	return time.Duration(seconds) * time.Second
}

func (s *BroadcastService) reservationLeadTime() time.Duration {
	seconds := int(defaultReservationLeadTime.Seconds())
	if s != nil && s.systemConfigService != nil {
		seconds = s.systemConfigService.GetInt("broadcast.reservation.lead_time_seconds", seconds)
	}
	if seconds <= 0 {
		seconds = int(defaultReservationLeadTime.Seconds())
	}
	return time.Duration(seconds) * time.Second
}

func (s *BroadcastService) autoAssignTriggerLead() time.Duration {
	seconds := int(defaultAutoAssignTriggerLead.Seconds())
	if s != nil && s.systemConfigService != nil {
		seconds = s.systemConfigService.GetInt("broadcast.auto_assign.trigger_lead_seconds", seconds)
	}
	if seconds <= 0 {
		seconds = int(defaultAutoAssignTriggerLead.Seconds())
	}
	return time.Duration(seconds) * time.Second
}

func (s *BroadcastService) autoAssignAcceptWindow() time.Duration {
	seconds := int(defaultAutoAssignAcceptWindow.Seconds())
	if s != nil && s.systemConfigService != nil {
		seconds = s.systemConfigService.GetInt("broadcast.auto_assign.accept_window_seconds", seconds)
	}
	if seconds <= 0 {
		seconds = int(defaultAutoAssignAcceptWindow.Seconds())
	}
	return time.Duration(seconds) * time.Second
}

func (s *BroadcastService) autoAssignMaxAttempts() int {
	value := defaultAutoAssignMaxAttempts
	if s != nil && s.systemConfigService != nil {
		value = s.systemConfigService.GetInt("broadcast.auto_assign.max_attempts", value)
	}
	if value <= 0 {
		value = defaultAutoAssignMaxAttempts
	}
	if value > 20 {
		value = 20
	}
	return value
}

func (s *BroadcastService) autoAssignWeights() (float64, float64, float64) {
	distance := defaultAutoAssignDistanceWeight
	rating := defaultAutoAssignRatingWeight
	completion := defaultAutoAssignCompletionWeight
	if s != nil && s.systemConfigService != nil {
		distance = s.systemConfigService.GetFloat("broadcast.auto_assign.weight_distance", distance)
		rating = s.systemConfigService.GetFloat("broadcast.auto_assign.weight_rating", rating)
		completion = s.systemConfigService.GetFloat("broadcast.auto_assign.weight_completion", completion)
	}
	if distance < 0 {
		distance = 0
	}
	if rating < 0 {
		rating = 0
	}
	if completion < 0 {
		completion = 0
	}
	return distance, rating, completion
}

func (s *BroadcastService) redispatchBumpPercentDefault() float64 {
	value := defaultRedispatchBumpPercent
	if s != nil && s.systemConfigService != nil {
		value = s.systemConfigService.GetFloat("broadcast.redispatch.bump_percent_default", value)
	}
	if value <= 0 {
		value = defaultRedispatchBumpPercent
	}
	return value
}

func (s *BroadcastService) RedispatchBumpPercentDefault() float64 {
	return s.redispatchBumpPercentDefault()
}

func (s *BroadcastService) redispatchRadiusBumpKMDefault() float64 {
	value := defaultRedispatchRadiusBumpKM
	if s != nil && s.systemConfigService != nil {
		value = s.systemConfigService.GetFloat("broadcast.redispatch.radius_bump_km_default", value)
	}
	if value <= 0 {
		value = defaultRedispatchRadiusBumpKM
	}
	return value
}

func (s *BroadcastService) RedispatchRadiusBumpKMDefault() float64 {
	return s.redispatchRadiusBumpKMDefault()
}

func (s *BroadcastService) redispatchRadiusMaxKM() float64 {
	value := defaultRedispatchRadiusMaxKM
	if s != nil && s.systemConfigService != nil {
		value = s.systemConfigService.GetFloat("broadcast.redispatch.radius_max_km", value)
	}
	if value <= 0 {
		value = defaultRedispatchRadiusMaxKM
	}
	return value
}

func (s *BroadcastService) redispatchMaxCountPerOrder() int {
	value := defaultRedispatchMaxCountPerOrder
	if s != nil && s.systemConfigService != nil {
		value = s.systemConfigService.GetInt("broadcast.redispatch.max_count_per_order", value)
	}
	return value
}

func (s *BroadcastService) redispatchCooldown() time.Duration {
	seconds := defaultRedispatchCooldownSeconds
	if s != nil && s.systemConfigService != nil {
		seconds = s.systemConfigService.GetInt("broadcast.redispatch.cooldown_seconds", seconds)
	}
	if seconds <= 0 {
		return 0
	}
	return time.Duration(seconds) * time.Second
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
		return nil, errors.New("抢单服务暂不可用")
	}

	now := time.Now()
	_, _ = s.presenceRepo.MarkStaleOffline(now.Add(-s.presenceStaleTimeout()))
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
		matchingRadius := s.orderMatchingRadiusKM(item.Order)
		if matchingRadius > 0 && distanceKM > matchingRadius {
			continue
		}
		excluded, err := s.broadcastRepo.IsProviderExcluded(item.OrderID, item.ID, userID)
		if err != nil {
			return nil, err
		}
		if excluded {
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
		return nil, errors.New("抢单服务暂不可用")
	}
	if broadcastID <= 0 {
		return nil, errors.New("派单记录无效")
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
		return s.grabWithRepos(broadcastID, providerUserID, presence, now, s.orderRepo, s.broadcastRepo, s.artifactRepo, false)
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
			false,
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

func (s *BroadcastService) RedispatchOrder(orderID int64, opts RedispatchOrderOptions) (*RedispatchOrderResult, error) {
	if s == nil || s.orderRepo == nil || s.broadcastRepo == nil {
		return nil, errors.New("抢单服务暂不可用")
	}
	if orderID <= 0 {
		return nil, errors.New("订单ID无效")
	}
	now := time.Now()
	db := s.orderRepo.DB()
	if db == nil {
		return s.redispatchOrderWithRepos(orderID, opts, now, s.orderRepo, s.broadcastRepo, s.artifactRepo)
	}

	var result *RedispatchOrderResult
	err := db.Transaction(func(tx *gorm.DB) error {
		item, txErr := s.redispatchOrderWithRepos(
			orderID,
			opts,
			now,
			repository.NewOrderRepo(tx),
			repository.NewOrderBroadcastRepo(tx),
			repository.NewOrderArtifactRepo(tx),
		)
		if txErr != nil {
			return txErr
		}
		result = item
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (s *BroadcastService) EnqueueDueReservations(now time.Time, limit int) (int, error) {
	if s == nil || s.orderRepo == nil || s.broadcastRepo == nil {
		return 0, errors.New("预约单入池依赖未初始化")
	}
	if now.IsZero() {
		now = time.Now()
	}
	cutoff := now.Add(s.reservationLeadTime())
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
		return 0, errors.New("抢单服务暂不可用")
	}
	if now.IsZero() {
		now = time.Now()
	}
	return s.broadcastRepo.MarkExpired(now, limit)
}

func (s *BroadcastService) AttemptAutoAssign(broadcastID int64) error {
	if !s.shouldAutoAssign() {
		return nil
	}
	if s == nil || s.broadcastRepo == nil || s.assignmentRepo == nil || s.orderRepo == nil || s.presenceRepo == nil {
		return errors.New("自动指派依赖未初始化")
	}
	if broadcastID <= 0 {
		return errors.New("派单记录无效")
	}

	now := time.Now()
	db := s.broadcastRepo.DB()
	if db == nil {
		outcome, err := s.attemptAutoAssignWithRepos(broadcastID, now, s.orderRepo, s.broadcastRepo, s.assignmentRepo)
		s.notifyAutoAssignOutcome(outcome)
		return err
	}

	var outcome autoAssignOutcome
	err := db.Transaction(func(tx *gorm.DB) error {
		result, txErr := s.attemptAutoAssignWithRepos(
			broadcastID,
			now,
			repository.NewOrderRepo(tx),
			repository.NewOrderBroadcastRepo(tx),
			repository.NewBroadcastAssignmentRepo(tx),
		)
		outcome = result
		return txErr
	})
	if err == nil {
		s.notifyAutoAssignOutcome(outcome)
	}
	return err
}

func (s *BroadcastService) AcceptAssignment(assignmentID, providerUserID int64) (*model.Order, error) {
	if s == nil || s.assignmentRepo == nil || s.broadcastRepo == nil || s.orderRepo == nil {
		return nil, errors.New("自动指派依赖未初始化")
	}
	if assignmentID <= 0 {
		return nil, errors.New("自动指派ID无效")
	}
	if providerUserID <= 0 {
		return nil, errors.New("服务商账号无效")
	}

	now := time.Now()
	db := s.assignmentRepo.DB()
	if db == nil {
		return s.acceptAssignmentWithRepos(assignmentID, providerUserID, now, s.orderRepo, s.broadcastRepo, s.assignmentRepo, s.artifactRepo)
	}

	var accepted *model.Order
	err := db.Transaction(func(tx *gorm.DB) error {
		order, txErr := s.acceptAssignmentWithRepos(
			assignmentID,
			providerUserID,
			now,
			repository.NewOrderRepo(tx),
			repository.NewOrderBroadcastRepo(tx),
			repository.NewBroadcastAssignmentRepo(tx),
			repository.NewOrderArtifactRepo(tx),
		)
		if txErr != nil {
			return txErr
		}
		accepted = order
		return nil
	})
	if err != nil {
		return nil, err
	}
	return accepted, nil
}

func (s *BroadcastService) DeclineAssignment(assignmentID, providerUserID int64, reason string) error {
	if s == nil || s.assignmentRepo == nil || s.broadcastRepo == nil {
		return errors.New("自动指派依赖未初始化")
	}
	if assignmentID <= 0 {
		return errors.New("自动指派ID无效")
	}
	if providerUserID <= 0 {
		return errors.New("服务商账号无效")
	}

	now := time.Now()
	var broadcastID int64
	db := s.assignmentRepo.DB()
	if db == nil {
		var err error
		broadcastID, err = s.declineAssignmentWithRepos(assignmentID, providerUserID, reason, now, s.broadcastRepo, s.assignmentRepo)
		if err != nil {
			return err
		}
		return s.AttemptAutoAssign(broadcastID)
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		id, txErr := s.declineAssignmentWithRepos(
			assignmentID,
			providerUserID,
			reason,
			now,
			repository.NewOrderBroadcastRepo(tx),
			repository.NewBroadcastAssignmentRepo(tx),
		)
		if txErr != nil {
			return txErr
		}
		broadcastID = id
		return nil
	})
	if err != nil {
		return err
	}
	return s.AttemptAutoAssign(broadcastID)
}

func (s *BroadcastService) ExpireOverdueAssignments(now time.Time, limit int) (int64, error) {
	if s == nil || s.assignmentRepo == nil || s.broadcastRepo == nil {
		return 0, errors.New("自动指派依赖未初始化")
	}
	if now.IsZero() {
		now = time.Now()
	}

	items, err := s.assignmentRepo.ListOverduePending(now, limit)
	if err != nil {
		return 0, err
	}

	var count int64
	for _, item := range items {
		assignmentID := item.ID
		var broadcastID int64
		var timeoutProviderID int64
		db := s.assignmentRepo.DB()
		if db == nil {
			id, providerID, expired, expireErr := s.expireAssignmentWithRepos(assignmentID, now, s.broadcastRepo, s.assignmentRepo)
			if expireErr != nil {
				return count, expireErr
			}
			if !expired {
				continue
			}
			broadcastID = id
			timeoutProviderID = providerID
		} else {
			err = db.Transaction(func(tx *gorm.DB) error {
				id, providerID, expired, txErr := s.expireAssignmentWithRepos(
					assignmentID,
					now,
					repository.NewOrderBroadcastRepo(tx),
					repository.NewBroadcastAssignmentRepo(tx),
				)
				if txErr != nil {
					return txErr
				}
				if expired {
					broadcastID = id
					timeoutProviderID = providerID
				}
				return nil
			})
			if err != nil {
				return count, err
			}
			if broadcastID == 0 {
				continue
			}
		}
		count++
		if s.eventService != nil {
			s.eventService.NotifyBroadcastAutoAssignTimeoutForProvider(timeoutProviderID, item.OrderID)
		}
		if err := s.AttemptAutoAssign(broadcastID); err != nil {
			return count, err
		}
	}

	return count, nil
}

func (s *BroadcastService) ListPendingAssignmentsForProvider(providerUserID int64, limit int) ([]ProviderAssignmentView, error) {
	if s == nil || s.assignmentRepo == nil {
		return nil, errors.New("自动指派依赖未初始化")
	}
	if providerUserID <= 0 {
		return nil, errors.New("服务商账号无效")
	}
	if err := s.requireProviderWorkbenchAccess(providerUserID); err != nil {
		return nil, err
	}
	now := time.Now()
	items, err := s.assignmentRepo.ListPendingByProvider(providerUserID, now, limit)
	if err != nil {
		return nil, err
	}
	views := make([]ProviderAssignmentView, 0, len(items))
	for i := range items {
		item := &items[i]
		remaining := int64(math.Max(0, item.AcceptDeadlineAt.Sub(now).Seconds()))
		views = append(views, ProviderAssignmentView{
			Assignment:       item,
			Broadcast:        item.Broadcast,
			Order:            item.Order,
			RemainingSeconds: remaining,
		})
	}
	return views, nil
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
				if s.shouldAutoAssign() {
					triggerLead := s.autoAssignTriggerLead()
					candidates, err := s.broadcastRepo.ListAwaitingAutoAssign(now, now.Add(triggerLead), 200)
					if err != nil && s.logger != nil {
						s.logger.Warn("list auto assign broadcasts failed", zap.Error(err))
					}
					for _, candidate := range candidates {
						if err := s.AttemptAutoAssign(candidate.ID); err != nil && s.logger != nil {
							s.logger.Warn("attempt auto assign failed", zap.Int64("broadcast_id", candidate.ID), zap.Error(err))
						}
					}
					if _, err := s.ExpireOverdueAssignments(now, 200); err != nil && s.logger != nil {
						s.logger.Warn("expire overdue broadcast assignments failed", zap.Error(err))
					}
				}
				if _, err := s.ExpireOpenBroadcasts(now, 500); err != nil && s.logger != nil {
					s.logger.Warn("expire open broadcasts failed", zap.Error(err))
				}
			}
		}
	}()
}

type autoAssignCandidate struct {
	presence   model.ProviderPresence
	distanceKM float64
	score      float64
}

type autoAssignOutcome struct {
	order          *model.Order
	providerUserID int64
	deadline       time.Time
	exhausted      bool
}

func (s *BroadcastService) attemptAutoAssignWithRepos(
	broadcastID int64,
	now time.Time,
	orderRepo *repository.OrderRepo,
	broadcastRepo *repository.OrderBroadcastRepo,
	assignmentRepo *repository.BroadcastAssignmentRepo,
) (autoAssignOutcome, error) {
	var outcome autoAssignOutcome
	broadcast, err := broadcastRepo.LockByID(broadcastID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return outcome, errors.New("派单记录不存在")
		}
		return outcome, err
	}
	if broadcast.Status != broadcastStatusOpen {
		return outcome, nil
	}
	if !broadcast.ExpiresAt.After(now) {
		if err := broadcastRepo.UpdateFields(broadcast.ID, map[string]interface{}{
			"status":     broadcastStatusExpired,
			"updated_at": now,
		}); err != nil {
			return outcome, err
		}
		return outcome, nil
	}

	order, err := orderRepo.LockByID(broadcast.OrderID)
	if err != nil {
		return outcome, err
	}
	if !canBroadcastOrderBeGrabbed(order) {
		if err := broadcastRepo.UpdateFields(broadcast.ID, map[string]interface{}{
			"status":     broadcastStatusExpired,
			"updated_at": now,
		}); err != nil {
			return outcome, err
		}
		return outcome, nil
	}

	attempts, err := assignmentRepo.ListAttempts(broadcast.ID)
	if err != nil {
		return outcome, err
	}
	if len(attempts) >= s.autoAssignMaxAttempts() {
		if err := s.expireBroadcastWithTimeline(orderRepo, broadcastRepo, order, broadcast.ID, now, "服务商运力紧张，订单自动指派失败", true); err != nil {
			return outcome, err
		}
		outcome.order = order
		outcome.exhausted = true
		return outcome, nil
	}

	attempted := make(map[int64]struct{}, len(attempts))
	for _, attempt := range attempts {
		attempted[attempt.ProviderUserID] = struct{}{}
	}
	candidate, ok, err := s.selectAutoAssignCandidate(broadcast, order, attempted, now, broadcastRepo)
	if err != nil {
		return outcome, err
	}
	if !ok {
		if err := s.expireBroadcastWithTimeline(orderRepo, broadcastRepo, order, broadcast.ID, now, "附近暂无可指派的服务商", true); err != nil {
			return outcome, err
		}
		outcome.order = order
		outcome.exhausted = true
		return outcome, nil
	}

	deadline := now.Add(s.autoAssignAcceptWindow())
	assignment := &model.BroadcastAssignment{
		BroadcastID:      broadcast.ID,
		OrderID:          broadcast.OrderID,
		ProviderUserID:   candidate.presence.UserID,
		AttemptSeq:       len(attempts) + 1,
		Status:           assignmentStatusPendingAccept,
		DistanceKM:       math.Round(candidate.distanceKM*100) / 100,
		Score:            math.Round(candidate.score*10000) / 10000,
		AcceptDeadlineAt: deadline,
	}
	if err := assignmentRepo.Create(assignment); err != nil {
		return outcome, err
	}
	if err := broadcastRepo.UpdateFields(broadcast.ID, map[string]interface{}{
		"status":     broadcastStatusAutoAssigning,
		"updated_at": now,
	}); err != nil {
		return outcome, err
	}
	if err := orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      order.ID,
		Status:       "auto_assigning",
		Note:         fmt.Sprintf("已向服务商 %d 自动指派，等待响应", candidate.presence.UserID),
		OperatorID:   0,
		OperatorType: "system",
	}); err != nil {
		return outcome, err
	}

	outcome.order = order
	outcome.providerUserID = candidate.presence.UserID
	outcome.deadline = deadline
	return outcome, nil
}

func (s *BroadcastService) acceptAssignmentWithRepos(
	assignmentID, providerUserID int64,
	now time.Time,
	orderRepo *repository.OrderRepo,
	broadcastRepo *repository.OrderBroadcastRepo,
	assignmentRepo *repository.BroadcastAssignmentRepo,
	artifactRepo *repository.OrderArtifactRepo,
) (*model.Order, error) {
	assignment, err := assignmentRepo.LockByID(assignmentID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("自动指派不存在")
		}
		return nil, err
	}
	if assignment.ProviderUserID != providerUserID {
		return nil, fmt.Errorf("%w: 自动指派不属于当前服务商", ErrBroadcastConflict)
	}
	if assignment.Status != assignmentStatusPendingAccept {
		return nil, fmt.Errorf("%w: 自动指派已失效", ErrBroadcastConflict)
	}
	if !assignment.AcceptDeadlineAt.After(now) {
		_ = assignmentRepo.UpdateFields(assignment.ID, map[string]interface{}{
			"status":       assignmentStatusExpired,
			"responded_at": now,
			"updated_at":   now,
		})
		return nil, fmt.Errorf("%w: 接单确认已超时", ErrBroadcastConflict)
	}

	if err := assignmentRepo.UpdateFields(assignment.ID, map[string]interface{}{
		"status":       assignmentStatusAccepted,
		"responded_at": now,
		"updated_at":   now,
	}); err != nil {
		return nil, err
	}
	order, err := s.grabWithRepos(assignment.BroadcastID, providerUserID, nil, now, orderRepo, broadcastRepo, artifactRepo, true)
	if err != nil {
		return nil, err
	}
	if err := assignmentRepo.SupersedeOtherPending(assignment.BroadcastID, assignment.ID, now); err != nil {
		return nil, err
	}
	return order, nil
}

func (s *BroadcastService) declineAssignmentWithRepos(
	assignmentID, providerUserID int64,
	reason string,
	now time.Time,
	broadcastRepo *repository.OrderBroadcastRepo,
	assignmentRepo *repository.BroadcastAssignmentRepo,
) (int64, error) {
	assignment, err := assignmentRepo.LockByID(assignmentID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, errors.New("自动指派不存在")
		}
		return 0, err
	}
	if assignment.ProviderUserID != providerUserID {
		return 0, fmt.Errorf("%w: 自动指派不属于当前服务商", ErrBroadcastConflict)
	}
	if assignment.Status != assignmentStatusPendingAccept {
		return 0, fmt.Errorf("%w: 自动指派已失效", ErrBroadcastConflict)
	}
	reason = strings.TrimSpace(reason)
	if len(reason) > 255 {
		reason = reason[:255]
	}
	if err := assignmentRepo.UpdateFields(assignment.ID, map[string]interface{}{
		"status":         assignmentStatusDeclined,
		"decline_reason": reason,
		"responded_at":   now,
		"updated_at":     now,
	}); err != nil {
		return 0, err
	}
	if err := broadcastRepo.ExcludeProvider(assignment.OrderID, assignment.BroadcastID, assignment.ProviderUserID, "assignment_declined"); err != nil {
		return 0, err
	}
	if err := broadcastRepo.UpdateFields(assignment.BroadcastID, map[string]interface{}{
		"status":     broadcastStatusOpen,
		"expires_at": now.Add(s.autoAssignAcceptWindow()),
		"updated_at": now,
	}); err != nil {
		return 0, err
	}
	return assignment.BroadcastID, nil
}

func (s *BroadcastService) expireAssignmentWithRepos(
	assignmentID int64,
	now time.Time,
	broadcastRepo *repository.OrderBroadcastRepo,
	assignmentRepo *repository.BroadcastAssignmentRepo,
) (int64, int64, bool, error) {
	assignment, err := assignmentRepo.LockByID(assignmentID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, 0, false, nil
		}
		return 0, 0, false, err
	}
	if assignment.Status != assignmentStatusPendingAccept || assignment.AcceptDeadlineAt.After(now) {
		return 0, 0, false, nil
	}
	if err := assignmentRepo.UpdateFields(assignment.ID, map[string]interface{}{
		"status":       assignmentStatusExpired,
		"responded_at": now,
		"updated_at":   now,
	}); err != nil {
		return 0, 0, false, err
	}
	timeoutExclusionExpiresAt := now.Add(s.autoAssignAcceptWindow() * 3)
	if err := broadcastRepo.ExcludeProvider(
		assignment.OrderID,
		assignment.BroadcastID,
		assignment.ProviderUserID,
		"assignment_timeout",
		&timeoutExclusionExpiresAt,
	); err != nil {
		return 0, 0, false, err
	}
	if err := broadcastRepo.UpdateFields(assignment.BroadcastID, map[string]interface{}{
		"status":     broadcastStatusOpen,
		"expires_at": now.Add(s.autoAssignAcceptWindow()),
		"updated_at": now,
	}); err != nil {
		return 0, 0, false, err
	}
	return assignment.BroadcastID, assignment.ProviderUserID, true, nil
}

func (s *BroadcastService) redispatchOrderWithRepos(
	orderID int64,
	opts RedispatchOrderOptions,
	now time.Time,
	orderRepo *repository.OrderRepo,
	broadcastRepo *repository.OrderBroadcastRepo,
	artifactRepo *repository.OrderArtifactRepo,
) (*RedispatchOrderResult, error) {
	if orderRepo == nil || broadcastRepo == nil {
		return nil, errors.New("抢单服务暂不可用")
	}
	order, err := orderRepo.LockByID(orderID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("订单不存在")
		}
		return nil, err
	}
	if order.Status != "dispatch_failed" {
		return nil, newBroadcastConflictError(ErrBroadcastStatusInvalid, "订单当前状态不可重发")
	}
	if order.ProviderUserID != 0 || order.GrabbedByUserID != 0 {
		return nil, newBroadcastConflictError(ErrBroadcastStatusInvalid, "订单已被服务商接单，无法重发")
	}
	if err := s.enforceRedispatchGuards(order, now); err != nil {
		return nil, err
	}

	priceBumpCents, matchingRadiusKM, err := s.resolveRedispatchAdjustments(order, opts)
	if err != nil {
		return nil, err
	}
	newTotalAmount := order.TotalAmount + priceBumpCents
	if newTotalAmount < 0 {
		newTotalAmount = 0
	}
	commission := int64(math.Round(float64(newTotalAmount) * order.PlatformCommissionRate / 100))
	ownerAmount := newTotalAmount - commission
	priceBreakdown := s.buildRedispatchPriceBreakdown(order, newTotalAmount, priceBumpCents, matchingRadiusKM, opts.PriceBumpPercent, now)

	if err := broadcastRepo.DeleteTimeoutExclusionsByOrder(order.ID); err != nil {
		return nil, err
	}

	broadcast := &model.OrderBroadcast{
		OrderID:             order.ID,
		OriginLatitude:      order.ServiceLatitude,
		OriginLongitude:     order.ServiceLongitude,
		ServiceClassCode:    order.ServiceClassCode,
		WeightKG:            order.CargoWeightKG,
		EstimatedTotalCents: newTotalAmount,
		Status:              broadcastStatusOpen,
		ExpiresAt:           now.Add(s.broadcastTTL()),
		GrabbedByUserID:     0,
	}
	if err := broadcastRepo.Create(broadcast); err != nil {
		return nil, err
	}

	if err := orderRepo.UpdateFields(order.ID, map[string]interface{}{
		"status":                 "pending_dispatch",
		"total_amount":           newTotalAmount,
		"platform_commission":    commission,
		"owner_amount":           ownerAmount,
		"price_breakdown_json":   priceBreakdown,
		"broadcast_pool_id":      broadcast.ID,
		"provider_user_id":       int64(0),
		"owner_id":               int64(0),
		"drone_owner_user_id":    int64(0),
		"executor_pilot_user_id": int64(0),
		"grabbed_by_user_id":     int64(0),
		"grabbed_at":             nil,
		"provider_confirmed_at":  nil,
		"updated_at":             now,
	}); err != nil {
		return nil, err
	}

	order.Status = "pending_dispatch"
	order.TotalAmount = newTotalAmount
	order.PlatformCommission = commission
	order.OwnerAmount = ownerAmount
	order.PriceBreakdownJSON = priceBreakdown
	order.BroadcastPoolID = &broadcast.ID
	order.ProviderUserID = 0
	order.OwnerID = 0
	order.DroneOwnerUserID = 0
	order.ExecutorPilotUserID = 0
	order.GrabbedByUserID = 0
	order.GrabbedAt = nil
	order.ProviderConfirmedAt = nil
	order.UpdatedAt = now

	operatorType := "system"
	if opts.OperatorUserID > 0 {
		operatorType = "client"
	}
	if err := orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      order.ID,
		Status:       "pending_dispatch",
		Note:         buildRedispatchTimelineNote(priceBumpCents, matchingRadiusKM),
		OperatorID:   opts.OperatorUserID,
		OperatorType: operatorType,
	}); err != nil {
		return nil, err
	}
	if artifactRepo != nil {
		_ = repository.UpsertOrderSnapshotBundle(artifactRepo, order, nil, nil)
	}

	return &RedispatchOrderResult{
		Order:            order,
		Broadcast:        broadcast,
		PriceBumpCents:   priceBumpCents,
		MatchingRadiusKM: matchingRadiusKM,
	}, nil
}

func (s *BroadcastService) expireBroadcastWithTimeline(
	orderRepo *repository.OrderRepo,
	broadcastRepo *repository.OrderBroadcastRepo,
	order *model.Order,
	broadcastID int64,
	now time.Time,
	note string,
	markDispatchFailed bool,
) error {
	if err := broadcastRepo.UpdateFields(broadcastID, map[string]interface{}{
		"status":     broadcastStatusExpired,
		"updated_at": now,
	}); err != nil {
		return err
	}
	if order == nil {
		return nil
	}
	if markDispatchFailed && order.Status == "pending_dispatch" && order.ProviderUserID == 0 && order.GrabbedByUserID == 0 {
		if err := orderRepo.UpdateFields(order.ID, map[string]interface{}{
			"status":     "dispatch_failed",
			"updated_at": now,
		}); err != nil {
			return err
		}
		order.Status = "dispatch_failed"
	}
	return orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      order.ID,
		Status:       "broadcast_expired",
		Note:         note,
		OperatorID:   0,
		OperatorType: "system",
	})
}

func (s *BroadcastService) resolveRedispatchAdjustments(order *model.Order, opts RedispatchOrderOptions) (int64, float64, error) {
	if opts.PriceBumpPercent < 0 || opts.PriceBumpCents < 0 || opts.RadiusBumpKM < 0 {
		return 0, 0, errors.New("重发调整参数必须大于等于0")
	}
	if opts.PriceBumpPercent == 0 && opts.PriceBumpCents == 0 && opts.RadiusBumpKM == 0 {
		return 0, 0, errors.New("请至少选择加价或扩大半径")
	}

	priceBumpCents := opts.PriceBumpCents
	if opts.PriceBumpPercent > 0 && order != nil && order.TotalAmount > 0 {
		priceBumpCents += int64(math.Round(float64(order.TotalAmount) * opts.PriceBumpPercent / 100))
	}

	matchingRadiusKM := s.orderMatchingRadiusKM(order)
	if opts.RadiusBumpKM > 0 {
		matchingRadiusKM += opts.RadiusBumpKM
	}
	maxRadius := s.redispatchRadiusMaxKM()
	if maxRadius > 0 && matchingRadiusKM > maxRadius {
		matchingRadiusKM = maxRadius
	}
	if matchingRadiusKM <= 0 {
		matchingRadiusKM = defaultProviderRadiusKM
	}
	return priceBumpCents, matchingRadiusKM, nil
}

type redispatchMeta struct {
	count  int
	lastAt time.Time
}

func (s *BroadcastService) enforceRedispatchGuards(order *model.Order, now time.Time) error {
	meta := readRedispatchMeta(order)
	if maxCount := s.redispatchMaxCountPerOrder(); maxCount > 0 && meta.count >= maxCount {
		return newBroadcastConflictError(ErrRedispatchCapped, "重发次数已达上限，请取消订单后重新下单")
	}

	cooldown := s.redispatchCooldown()
	if cooldown <= 0 || meta.lastAt.IsZero() {
		return nil
	}
	elapsed := now.Sub(meta.lastAt)
	if elapsed >= cooldown {
		return nil
	}
	remaining := int(math.Ceil((cooldown - elapsed).Seconds()))
	if remaining <= 0 {
		remaining = 1
	}
	return newBroadcastConflictError(ErrRedispatchRateLimited, fmt.Sprintf("操作过于频繁，请 %d 秒后再试", remaining))
}

func (s *BroadcastService) buildRedispatchPriceBreakdown(order *model.Order, totalAmount int64, priceBumpCents int64, matchingRadiusKM float64, priceBumpPercent float64, now time.Time) model.JSON {
	breakdown := decodePriceBreakdownJSON(nil)
	if order != nil {
		breakdown = decodePriceBreakdownJSON(order.PriceBreakdownJSON)
	}
	meta := redispatchMetaFromBreakdown(breakdown)
	breakdown["total_estimated_cents"] = totalAmount
	breakdown[redispatchMatchingRadiusJSONKey] = math.Round(matchingRadiusKM*10) / 10
	if priceBumpCents > 0 {
		breakdown[redispatchPriceBumpCentsJSONKey] = priceBumpCents
	}
	if priceBumpPercent > 0 {
		breakdown[redispatchPriceBumpPercentJSONKey] = priceBumpPercent
	}
	breakdown[redispatchCountJSONKey] = meta.count + 1
	breakdown[redispatchLastAtJSONKey] = now.Format(time.RFC3339)
	raw, err := json.Marshal(breakdown)
	if err != nil {
		return model.JSON("null")
	}
	return model.JSON(raw)
}

func readRedispatchMeta(order *model.Order) redispatchMeta {
	if order == nil {
		return redispatchMeta{}
	}
	return redispatchMetaFromBreakdown(decodePriceBreakdownJSON(order.PriceBreakdownJSON))
}

func redispatchMetaFromBreakdown(breakdown map[string]interface{}) redispatchMeta {
	meta := redispatchMeta{}
	if count, ok := numericJSONField(breakdown, redispatchCountJSONKey); ok && count > 0 {
		meta.count = int(math.Floor(count))
	}
	if lastAt, ok := timeJSONField(breakdown, redispatchLastAtJSONKey); ok {
		meta.lastAt = lastAt
	}
	return meta
}

func (s *BroadcastService) orderMatchingRadiusKM(order *model.Order) float64 {
	radius := defaultProviderRadiusKM
	if order != nil {
		breakdown := decodePriceBreakdownJSON(order.PriceBreakdownJSON)
		if value, ok := numericJSONField(breakdown, redispatchMatchingRadiusJSONKey); ok && value > 0 {
			radius = value
		} else if value, ok := numericJSONField(breakdown, redispatchLegacyRadiusJSONKey); ok && value > 0 {
			radius = value
		}
	}
	maxRadius := s.redispatchRadiusMaxKM()
	if maxRadius > 0 && radius > maxRadius {
		return maxRadius
	}
	return radius
}

func decodePriceBreakdownJSON(raw model.JSON) map[string]interface{} {
	breakdown := map[string]interface{}{}
	text := strings.TrimSpace(string(raw))
	if text == "" || text == "null" {
		return breakdown
	}
	if err := json.Unmarshal([]byte(text), &breakdown); err != nil {
		return map[string]interface{}{}
	}
	return breakdown
}

func numericJSONField(values map[string]interface{}, key string) (float64, bool) {
	if len(values) == 0 {
		return 0, false
	}
	switch value := values[key].(type) {
	case float64:
		return value, true
	case float32:
		return float64(value), true
	case int:
		return float64(value), true
	case int64:
		return float64(value), true
	case json.Number:
		parsed, err := value.Float64()
		return parsed, err == nil
	case string:
		parsed, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
		return parsed, err == nil
	default:
		return 0, false
	}
}

func timeJSONField(values map[string]interface{}, key string) (time.Time, bool) {
	if len(values) == 0 {
		return time.Time{}, false
	}
	raw, ok := values[key]
	if !ok || raw == nil {
		return time.Time{}, false
	}
	switch value := raw.(type) {
	case time.Time:
		return value, !value.IsZero()
	case string:
		text := strings.TrimSpace(value)
		if text == "" {
			return time.Time{}, false
		}
		for _, layout := range []string{time.RFC3339Nano, time.RFC3339, "2006-01-02 15:04:05"} {
			parsed, err := time.Parse(layout, text)
			if err == nil {
				return parsed, true
			}
		}
	}
	return time.Time{}, false
}

func buildRedispatchTimelineNote(priceBumpCents int64, matchingRadiusKM float64) string {
	parts := []string{"客户主动重发订单"}
	if priceBumpCents > 0 {
		parts = append(parts, fmt.Sprintf("加价¥%.2f", float64(priceBumpCents)/100))
	}
	if matchingRadiusKM > 0 {
		parts = append(parts, fmt.Sprintf("匹配半径%.1fkm", matchingRadiusKM))
	}
	return strings.Join(parts, "，")
}

func (s *BroadcastService) selectAutoAssignCandidate(broadcast *model.OrderBroadcast, order *model.Order, attempted map[int64]struct{}, now time.Time, broadcastRepo *repository.OrderBroadcastRepo) (autoAssignCandidate, bool, error) {
	if s == nil || s.presenceRepo == nil {
		return autoAssignCandidate{}, false, errors.New("服务商在线状态依赖未初始化")
	}
	presences, err := s.presenceRepo.ListOnlineSince(now.Add(-s.presenceStaleTimeout()))
	if err != nil {
		return autoAssignCandidate{}, false, err
	}

	candidates := make([]autoAssignCandidate, 0, len(presences))
	for _, presence := range presences {
		if _, exists := attempted[presence.UserID]; exists {
			continue
		}
		accepted := decodeProviderServiceClasses(presence.AcceptedServiceClasses)
		if !providerAcceptsServiceClass(accepted, broadcast.ServiceClassCode) {
			continue
		}
		radius := normalizeProviderRadius(presence.MaxRadiusKM)
		matchingRadius := s.orderMatchingRadiusKM(order)
		distanceKM := haversineKM(presence.LastLatitude, presence.LastLongitude, broadcast.OriginLatitude, broadcast.OriginLongitude)
		if radius > 0 && distanceKM > radius {
			continue
		}
		if matchingRadius > 0 && distanceKM > matchingRadius {
			continue
		}
		candidates = append(candidates, autoAssignCandidate{
			presence:   presence,
			distanceKM: distanceKM,
		})
	}
	if len(candidates) == 0 {
		return autoAssignCandidate{}, false, nil
	}

	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].distanceKM == candidates[j].distanceKM {
			return candidates[i].presence.UserID < candidates[j].presence.UserID
		}
		return candidates[i].distanceKM < candidates[j].distanceKM
	})

	distanceWeight, ratingWeight, completionWeight := s.autoAssignWeights()
	best := autoAssignCandidate{}
	found := false
	maxChecked := len(candidates)
	if maxChecked > 5 {
		maxChecked = 5
	}
	for i := 0; i < maxChecked; i++ {
		candidate := candidates[i]
		if broadcastRepo != nil {
			excluded, err := broadcastRepo.IsProviderExcluded(broadcast.OrderID, broadcast.ID, candidate.presence.UserID)
			if err != nil {
				return autoAssignCandidate{}, false, err
			}
			if excluded {
				continue
			}
		}
		if err := s.requireProviderSelfExecutableAccess(candidate.presence.UserID); err != nil {
			continue
		}
		radius := normalizeProviderRadius(candidate.presence.MaxRadiusKM)
		distanceScore := 0.0
		if radius > 0 {
			distanceScore = math.Max(0, 1-candidate.distanceKM/radius)
		}
		ratingScore := 0.9
		completionScore := 1.0
		if s.userService != nil {
			ratingScore = math.Max(0, math.Min(1, s.userService.GetProviderRating(candidate.presence.UserID)/5.0))
			completionScore = math.Max(0, math.Min(1, s.userService.GetProviderCompletionRate(candidate.presence.UserID)))
		}
		candidate.score = distanceWeight*distanceScore + ratingWeight*ratingScore + completionWeight*completionScore
		if !found || candidate.score > best.score || (candidate.score == best.score && candidate.presence.UserID < best.presence.UserID) {
			best = candidate
			found = true
		}
	}
	return best, found, nil
}

func (s *BroadcastService) notifyAutoAssignOutcome(outcome autoAssignOutcome) {
	if s == nil || s.eventService == nil || outcome.order == nil {
		return
	}
	if outcome.exhausted {
		s.eventService.NotifyBroadcastAutoAssignExhausted(outcome.order)
		return
	}
	if outcome.providerUserID > 0 {
		s.eventService.NotifyBroadcastAutoAssigned(outcome.order, outcome.providerUserID, outcome.deadline)
	}
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
	if !presence.Online || presence.Status != "active" || presence.LastHeartbeatAt == nil || presence.LastHeartbeatAt.Before(now.Add(-s.presenceStaleTimeout())) {
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

func (s *BroadcastService) requireProviderSelfExecutableAccess(userID int64) error {
	if s == nil || s.userService == nil {
		return nil
	}
	summary, err := s.userService.GetRoleSummary(userID)
	if err != nil {
		return err
	}
	// CanSelfExecute 由 UserService 基于合规无人机和履约执行人资质统一计算。
	if summary == nil || !summary.Provider.CanSelfExecute {
		return ErrProviderNotSelfExecutable
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
		return nil, errors.New("抢单服务暂不可用")
	}
	if !canBroadcastOrderBeCreated(order) {
		return nil, errors.New("当前订单状态不支持发起派单")
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
		ExpiresAt:           now.Add(s.broadcastTTL()),
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
	skipPresenceCheck bool,
) (*model.Order, error) {
	broadcast, err := broadcastRepo.LockByID(broadcastID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("派单记录不存在")
		}
		return nil, err
	}
	acceptableStatus := broadcast.Status == broadcastStatusOpen || (skipPresenceCheck && broadcast.Status == broadcastStatusAutoAssigning)
	if !skipPresenceCheck && broadcast.Status == broadcastStatusAutoAssigning {
		return nil, newBroadcastConflictError(ErrBroadcastLockedByAssign, "该订单正在匹配服务商")
	}
	if broadcast.GrabbedByUserID != 0 || broadcast.Status == broadcastStatusGrabbed {
		return nil, newBroadcastConflictError(ErrBroadcastTakenByOther, "该订单已被其他服务商抢单")
	}
	if !acceptableStatus || (!skipPresenceCheck && !broadcast.ExpiresAt.After(now)) {
		return nil, newBroadcastConflictError(ErrBroadcastStatusInvalid, "派单已过期或状态已变化")
	}

	order, err := orderRepo.LockByID(broadcast.OrderID)
	if err != nil {
		return nil, err
	}
	if !canBroadcastOrderBeGrabbed(order) {
		return nil, newBroadcastConflictError(ErrBroadcastStatusInvalid, "订单当前状态不可抢")
	}
	excluded, err := broadcastRepo.IsProviderExcluded(broadcast.OrderID, broadcast.ID, providerUserID)
	if err != nil {
		return nil, err
	}
	if excluded {
		return nil, newBroadcastConflictError(ErrBroadcastPreviouslyCancelled, "已取消过该订单，不能再次抢单")
	}
	if err := s.requireProviderSelfExecutableAccess(providerUserID); err != nil {
		return nil, err
	}
	if !skipPresenceCheck && !s.providerCanGrabBroadcast(presence, broadcast, order) {
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

func (s *BroadcastService) providerCanGrabBroadcast(presence *model.ProviderPresence, broadcast *model.OrderBroadcast, order *model.Order) bool {
	if presence == nil || broadcast == nil {
		return false
	}
	accepted := decodeProviderServiceClasses(presence.AcceptedServiceClasses)
	if !providerAcceptsServiceClass(accepted, broadcast.ServiceClassCode) {
		return false
	}
	radius := normalizeProviderRadius(presence.MaxRadiusKM)
	distanceKM := haversineKM(presence.LastLatitude, presence.LastLongitude, broadcast.OriginLatitude, broadcast.OriginLongitude)
	if radius > 0 && distanceKM > radius {
		return false
	}
	matchingRadius := s.orderMatchingRadiusKM(order)
	return matchingRadius <= 0 || distanceKM <= matchingRadius
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
