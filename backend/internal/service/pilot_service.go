package service

import (
	"encoding/json"
	"errors"
	"math"
	"strings"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

const (
	maxSegmentGapSeconds = 120.0
	maxSegmentSpeedMPS   = 60.0
)

type PilotService struct {
	pilotRepo        *repository.PilotRepo
	userRepo         *repository.UserRepo
	roleProfileRepo  *repository.RoleProfileRepo
	orderRepo        *repository.OrderRepo
	ownerDomainRepo  *repository.OwnerDomainRepo
	demandDomainRepo *repository.DemandDomainRepo
	dispatchRepo     *repository.DispatchRepo
	flightRepo       *repository.FlightRepo
	matchingService  *MatchingService
	dispatchService  *DispatchService
	flightService    *FlightService
	eventService     *EventService
	logger           *zap.Logger
}

func NewPilotService(
	pilotRepo *repository.PilotRepo,
	userRepo *repository.UserRepo,
	roleProfileRepo *repository.RoleProfileRepo,
	orderRepo *repository.OrderRepo,
	ownerDomainRepo *repository.OwnerDomainRepo,
	demandDomainRepo *repository.DemandDomainRepo,
	dispatchRepo *repository.DispatchRepo,
	flightRepo *repository.FlightRepo,
	logger *zap.Logger,
) *PilotService {
	return &PilotService{
		pilotRepo:        pilotRepo,
		userRepo:         userRepo,
		roleProfileRepo:  roleProfileRepo,
		orderRepo:        orderRepo,
		ownerDomainRepo:  ownerDomainRepo,
		demandDomainRepo: demandDomainRepo,
		dispatchRepo:     dispatchRepo,
		flightRepo:       flightRepo,
		logger:           logger,
	}
}

func (s *PilotService) SetMatchingService(matchingService *MatchingService) {
	s.matchingService = matchingService
}

func (s *PilotService) SetDispatchService(dispatchService *DispatchService) {
	s.dispatchService = dispatchService
}

func (s *PilotService) SetFlightService(flightService *FlightService) {
	s.flightService = flightService
}

func (s *PilotService) SetEventService(eventService *EventService) {
	s.eventService = eventService
}

// RegisterPilotReq 飞手注册请求
type RegisterPilotReq struct {
	CAACLicenseNo         string     `json:"caac_license_no" binding:"required"`
	CAACLicenseType       string     `json:"caac_license_type" binding:"required"` // VLOS, BVLOS, instructor
	CAACLicenseExpireDate *time.Time `json:"caac_license_expire_date"`
	CAACLicenseImage      string     `json:"caac_license_image" binding:"required"`
	ServiceRadius         float64    `json:"service_radius"`
	SpecialSkills         []string   `json:"special_skills"`
}

type PilotBindingApplyInput struct {
	OwnerUserID int64  `json:"owner_user_id"`
	Note        string `json:"note"`
}

type PilotProfileInput struct {
	CAACLicenseNo         string     `json:"caac_license_no"`
	CAACLicenseType       string     `json:"caac_license_type"`
	CAACLicenseExpireDate *time.Time `json:"caac_license_expire_date"`
	CAACLicenseImage      string     `json:"caac_license_image"`
	ServiceRadius         *float64   `json:"service_radius"`
	SpecialSkills         []string   `json:"special_skills"`
	CurrentCity           string     `json:"current_city"`
}

type PilotProfileView struct {
	ID                  int64                 `json:"id"`
	UserID              int64                 `json:"user_id"`
	CAACLicenseNo       string                `json:"caac_license_no"`
	CAACLicenseType     string                `json:"caac_license_type"`
	CAACLicenseExpireAt *time.Time            `json:"caac_license_expire_at,omitempty"`
	CAACLicenseImage    string                `json:"caac_license_image,omitempty"`
	VerificationStatus  string                `json:"verification_status"`
	AvailabilityStatus  string                `json:"availability_status"`
	ServiceRadiusKM     int                   `json:"service_radius_km"`
	ServiceRadius       float64               `json:"service_radius"`
	CurrentCity         string                `json:"current_city,omitempty"`
	ServiceCities       model.JSON            `json:"service_cities,omitempty"`
	SpecialSkills       model.JSON            `json:"special_skills,omitempty"`
	SkillTags           model.JSON            `json:"skill_tags,omitempty"`
	ServiceRating       float64               `json:"service_rating"`
	CreditScore         int                   `json:"credit_score"`
	Eligibility         *PilotEligibilityView `json:"eligibility,omitempty"`
	CreatedAt           time.Time             `json:"created_at"`
	UpdatedAt           time.Time             `json:"updated_at"`
}

type PilotEligibilityBlocker struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type PilotEligibilityView struct {
	Tier                  string                    `json:"tier"`
	Label                 string                    `json:"label"`
	CanApplyCandidate     bool                      `json:"can_apply_candidate"`
	CanAcceptDispatch     bool                      `json:"can_accept_dispatch"`
	CanStartExecution     bool                      `json:"can_start_execution"`
	CanUpdateAvailability bool                      `json:"can_update_availability"`
	RecommendedNextStep   string                    `json:"recommended_next_step"`
	Blockers              []PilotEligibilityBlocker `json:"blockers"`
}

type PilotDemandStats struct {
	QuoteCount          int64 `json:"quote_count"`
	CandidatePilotCount int64 `json:"candidate_pilot_count"`
}

// Register 注册飞手档案
func (s *PilotService) Register(userID int64, req *RegisterPilotReq) (*model.Pilot, error) {
	// 检查用户是否存在
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, errors.New("用户不存在")
	}

	// 检查是否已经注册为飞手
	exists, err := s.pilotRepo.ExistsByUserID(userID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errors.New("您已注册为飞手，请勿重复注册")
	}

	// 验证执照类型
	validTypes := map[string]bool{"VLOS": true, "BVLOS": true, "instructor": true}
	if !validTypes[req.CAACLicenseType] {
		return nil, errors.New("无效的执照类型")
	}

	// 设置默认服务范围
	serviceRadius := req.ServiceRadius
	if serviceRadius <= 0 {
		serviceRadius = 50 // 默认50公里
	}

	// 创建飞手档案
	pilot := &model.Pilot{
		UserID:                userID,
		CAACLicenseNo:         req.CAACLicenseNo,
		CAACLicenseType:       req.CAACLicenseType,
		CAACLicenseExpireDate: req.CAACLicenseExpireDate,
		CAACLicenseImage:      req.CAACLicenseImage,
		ServiceRadius:         serviceRadius,
		CreditScore:           500, // 初始信用分
		VerificationStatus:    "pending",
		AvailabilityStatus:    "offline",
	}

	// 处理特殊技能
	if len(req.SpecialSkills) > 0 {
		pilot.SpecialSkills = model.JSON(mustMarshalJSON(req.SpecialSkills))
	}

	db := s.pilotRepo.DB()
	if db == nil {
		return nil, errors.New("飞手仓储未初始化")
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		pilotRepo := repository.NewPilotRepo(tx)
		userRepo := repository.NewUserRepo(tx)
		roleProfileRepo := repository.NewRoleProfileRepo(tx)

		if err := pilotRepo.Create(pilot); err != nil {
			return err
		}
		if err := userRepo.UpdateFields(userID, map[string]interface{}{"user_type": "pilot"}); err != nil {
			return err
		}

		tempService := &PilotService{
			pilotRepo:       pilotRepo,
			userRepo:        userRepo,
			roleProfileRepo: roleProfileRepo,
			logger:          s.logger,
		}
		return tempService.ensurePilotProfile(userID, req)
	}); err != nil {
		return nil, err
	}

	// 重新加载用户信息
	pilot.User = user
	return pilot, nil
}

// GetByID 根据ID获取飞手信息
func (s *PilotService) GetByID(id int64) (*model.Pilot, error) {
	return s.pilotRepo.GetByID(id)
}

// GetByUserID 根据用户ID获取飞手信息
func (s *PilotService) GetByUserID(userID int64) (*model.Pilot, error) {
	return s.pilotRepo.GetByUserID(userID)
}

func (s *PilotService) GetCurrentProfile(userID int64) (*PilotProfileView, error) {
	pilot, err := s.GetByUserID(userID)
	if err != nil {
		return nil, errors.New("飞手档案不存在")
	}
	profile, err := s.ensurePilotRoleProfileByUserID(userID)
	if err != nil {
		return nil, err
	}
	return buildPilotProfileView(pilot, profile), nil
}

func (s *PilotService) UpsertCurrentProfile(userID int64, input *PilotProfileInput) (*PilotProfileView, error) {
	if input == nil {
		return nil, errors.New("飞手档案参数不能为空")
	}

	pilot, err := s.GetByUserID(userID)
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		if input.CAACLicenseNo == "" || input.CAACLicenseType == "" || input.CAACLicenseImage == "" {
			return nil, errors.New("首次创建飞手档案需填写执照编号、执照类型和执照图片")
		}
		req := &RegisterPilotReq{
			CAACLicenseNo:         input.CAACLicenseNo,
			CAACLicenseType:       input.CAACLicenseType,
			CAACLicenseExpireDate: input.CAACLicenseExpireDate,
			CAACLicenseImage:      input.CAACLicenseImage,
			SpecialSkills:         input.SpecialSkills,
		}
		if input.ServiceRadius != nil {
			req.ServiceRadius = *input.ServiceRadius
		}
		created, createErr := s.Register(userID, req)
		if createErr != nil {
			return nil, createErr
		}
		if input.CurrentCity != "" {
			_ = s.UpdateProfile(created.ID, map[string]interface{}{"current_city": input.CurrentCity})
		}
		profile, profileErr := s.ensurePilotRoleProfileByUserID(userID)
		if profileErr != nil {
			return nil, profileErr
		}
		created, _ = s.GetByUserID(userID)
		return buildPilotProfileView(created, profile), nil
	}

	updates := map[string]interface{}{}
	if input.CAACLicenseNo != "" {
		updates["caac_license_no"] = input.CAACLicenseNo
	}
	if input.CAACLicenseType != "" {
		validTypes := map[string]bool{"VLOS": true, "BVLOS": true, "instructor": true}
		if !validTypes[input.CAACLicenseType] {
			return nil, errors.New("无效的执照类型")
		}
		updates["caac_license_type"] = input.CAACLicenseType
	}
	if input.CAACLicenseExpireDate != nil {
		updates["caac_license_expire_date"] = input.CAACLicenseExpireDate
	}
	if input.CAACLicenseImage != "" {
		updates["caac_license_image"] = input.CAACLicenseImage
	}
	if input.ServiceRadius != nil && *input.ServiceRadius > 0 {
		updates["service_radius"] = *input.ServiceRadius
	}
	if len(input.SpecialSkills) > 0 {
		updates["special_skills"] = model.JSON(mustMarshalJSON(input.SpecialSkills))
	}
	if input.CurrentCity != "" {
		updates["current_city"] = input.CurrentCity
	}

	if err := s.UpdateProfile(pilot.ID, updates); err != nil {
		return nil, err
	}

	updatedPilot, err := s.GetByUserID(userID)
	if err != nil {
		return nil, err
	}
	profile, err := s.ensurePilotRoleProfileByUserID(userID)
	if err != nil {
		return nil, err
	}
	return buildPilotProfileView(updatedPilot, profile), nil
}

// UpdateProfile 更新飞手档案
func (s *PilotService) UpdateProfile(pilotID int64, fields map[string]interface{}) error {
	// 不允许直接更新的字段
	delete(fields, "id")
	delete(fields, "user_id")
	delete(fields, "verification_status")
	delete(fields, "credit_score")
	delete(fields, "total_flight_hours")
	delete(fields, "total_orders")
	delete(fields, "completed_orders")

	if len(fields) == 0 {
		return nil
	}
	db := s.pilotRepo.DB()
	if db == nil {
		return errors.New("飞手仓储未初始化")
	}
	return db.Transaction(func(tx *gorm.DB) error {
		pilotRepo := repository.NewPilotRepo(tx)
		roleProfileRepo := repository.NewRoleProfileRepo(tx)
		tempService := &PilotService{
			pilotRepo:       pilotRepo,
			roleProfileRepo: roleProfileRepo,
		}
		if err := pilotRepo.UpdateFields(pilotID, fields); err != nil {
			return err
		}
		pilot, err := pilotRepo.GetByID(pilotID)
		if err != nil {
			return err
		}
		return tempService.syncPilotRoleProfile(pilot)
	})
}

// UpdateLocation 更新飞手实时位置
func (s *PilotService) UpdateLocation(pilotID int64, lat, lng float64, city string) error {
	return s.pilotRepo.UpdateLocation(pilotID, lat, lng, city)
}

// UpdateAvailability 更新接单状态
func (s *PilotService) UpdateAvailability(pilotID int64, status string) error {
	validStatus := map[string]bool{"online": true, "busy": true, "offline": true}
	if !validStatus[status] {
		return errors.New("无效的状态")
	}

	// 检查飞手是否已认证
	pilot, err := s.pilotRepo.GetByID(pilotID)
	if err != nil {
		return err
	}
	if pilot.VerificationStatus != "verified" && status == "online" {
		return errors.New("飞手资质尚未审核通过，无法上线接单")
	}

	db := s.pilotRepo.DB()
	if db == nil {
		return errors.New("飞手仓储未初始化")
	}
	return db.Transaction(func(tx *gorm.DB) error {
		pilotRepo := repository.NewPilotRepo(tx)
		roleProfileRepo := repository.NewRoleProfileRepo(tx)
		tempService := &PilotService{
			pilotRepo:       pilotRepo,
			roleProfileRepo: roleProfileRepo,
		}
		if err := pilotRepo.UpdateAvailability(pilotID, status); err != nil {
			return err
		}
		updatedPilot, err := pilotRepo.GetByID(pilotID)
		if err != nil {
			return err
		}
		return tempService.syncPilotRoleProfile(updatedPilot)
	})
}

func (s *PilotService) ListOwnerBindings(pilotUserID int64, status string, page, pageSize int) ([]model.OwnerPilotBinding, int64, error) {
	if s.ownerDomainRepo == nil {
		return nil, 0, errors.New("绑定仓储未初始化")
	}
	if _, err := s.GetByUserID(pilotUserID); err != nil {
		return nil, 0, errors.New("飞手档案不存在")
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	return s.ownerDomainRepo.ListBindingsByPilot(pilotUserID, status, page, pageSize)
}

func (s *PilotService) ApplyOwnerBinding(pilotUserID int64, input *PilotBindingApplyInput) (*model.OwnerPilotBinding, error) {
	if s.ownerDomainRepo == nil {
		return nil, errors.New("绑定仓储未初始化")
	}
	if input == nil || input.OwnerUserID == 0 {
		return nil, errors.New("机主用户不能为空")
	}
	if input.OwnerUserID == pilotUserID {
		return nil, errors.New("不能申请绑定自己")
	}
	if _, err := s.GetByUserID(pilotUserID); err != nil {
		return nil, errors.New("请先注册飞手身份")
	}
	if _, err := s.userRepo.GetByID(input.OwnerUserID); err != nil {
		return nil, errors.New("机主用户不存在")
	}
	if s.roleProfileRepo != nil {
		if _, err := s.roleProfileRepo.GetOwnerProfileByUserID(input.OwnerUserID); err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, errors.New("对方尚未具备机主身份")
			}
			return nil, err
		}
	}

	latest, err := s.ownerDomainRepo.GetLatestBindableRecord(input.OwnerUserID, pilotUserID)
	if err == nil && latest != nil {
		switch latest.Status {
		case "active", "paused":
			return nil, errors.New("已存在合作关系，请直接调整绑定状态")
		case "pending_confirmation":
			return nil, errors.New("已存在待确认绑定关系")
		}
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	binding := &model.OwnerPilotBinding{
		OwnerUserID: input.OwnerUserID,
		PilotUserID: pilotUserID,
		InitiatedBy: "pilot",
		Status:      "pending_confirmation",
		Note:        input.Note,
	}
	if err := s.ownerDomainRepo.CreateBinding(binding); err != nil {
		return nil, err
	}
	if s.eventService != nil {
		s.eventService.NotifyBindingApplication(binding)
	}
	return binding, nil
}

func (s *PilotService) ConfirmOwnerBinding(pilotUserID, bindingID int64) (*model.OwnerPilotBinding, error) {
	return s.handleOwnerBindingResponse(pilotUserID, bindingID, true)
}

func (s *PilotService) RejectOwnerBinding(pilotUserID, bindingID int64) (*model.OwnerPilotBinding, error) {
	return s.handleOwnerBindingResponse(pilotUserID, bindingID, false)
}

func (s *PilotService) UpdateOwnerBindingStatus(pilotUserID, bindingID int64, status string) (*model.OwnerPilotBinding, error) {
	if s.ownerDomainRepo == nil {
		return nil, errors.New("绑定仓储未初始化")
	}
	valid := map[string]bool{"active": true, "paused": true, "dissolved": true}
	if !valid[status] {
		return nil, errors.New("无效的绑定状态")
	}

	binding, err := s.ownerDomainRepo.GetBindingByID(bindingID)
	if err != nil {
		return nil, errors.New("绑定关系不存在")
	}
	if binding.PilotUserID != pilotUserID {
		return nil, errors.New("无权操作该绑定关系")
	}

	switch status {
	case "active":
		if binding.Status != "paused" {
			return nil, errors.New("仅暂停中的绑定可恢复为 active")
		}
		now := time.Now()
		if err := s.ownerDomainRepo.UpdateBindingFields(binding.ID, map[string]interface{}{
			"status":       "active",
			"confirmed_at": &now,
			"updated_at":   now,
		}); err != nil {
			return nil, err
		}
	case "paused":
		if binding.Status != "active" {
			return nil, errors.New("仅 active 绑定可暂停")
		}
		if err := s.ownerDomainRepo.UpdateBindingFields(binding.ID, map[string]interface{}{
			"status":     "paused",
			"updated_at": time.Now(),
		}); err != nil {
			return nil, err
		}
	case "dissolved":
		if binding.Status != "active" && binding.Status != "paused" {
			return nil, errors.New("当前绑定状态不能解除")
		}
		now := time.Now()
		if err := s.ownerDomainRepo.UpdateBindingFields(binding.ID, map[string]interface{}{
			"status":       "dissolved",
			"dissolved_at": &now,
			"updated_at":   now,
		}); err != nil {
			return nil, err
		}
	}
	updated, err := s.ownerDomainRepo.GetBindingByID(bindingID)
	if err != nil {
		return nil, err
	}
	if s.eventService != nil {
		s.eventService.NotifyBindingStatus(updated)
	}
	return updated, nil
}

func (s *PilotService) ListCandidateDemands(pilotUserID int64, page, pageSize int) ([]model.Demand, int64, error) {
	if s.demandDomainRepo == nil {
		return nil, 0, errors.New("需求域仓储未初始化")
	}
	if _, err := s.GetByUserID(pilotUserID); err != nil {
		return nil, 0, errors.New("飞手档案不存在")
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	return s.demandDomainRepo.ListCandidateDemands(page, pageSize)
}

func (s *PilotService) GetDemandStats(demandIDs []int64) (map[int64]PilotDemandStats, error) {
	result := make(map[int64]PilotDemandStats)
	if s.demandDomainRepo == nil || len(demandIDs) == 0 {
		return result, nil
	}

	quoteCounts, err := s.demandDomainRepo.CountQuotesByDemandIDs(demandIDs)
	if err != nil {
		return nil, err
	}
	candidateCounts, err := s.demandDomainRepo.CountActiveCandidatesByDemandIDs(demandIDs)
	if err != nil {
		return nil, err
	}

	for _, demandID := range demandIDs {
		result[demandID] = PilotDemandStats{
			QuoteCount:          quoteCounts[demandID],
			CandidatePilotCount: candidateCounts[demandID],
		}
	}
	return result, nil
}

func (s *PilotService) ApplyDemandCandidate(pilotUserID, demandID int64) (*model.DemandCandidatePilot, error) {
	if s.demandDomainRepo == nil {
		return nil, errors.New("需求域仓储未初始化")
	}
	pilot, err := s.GetByUserID(pilotUserID)
	if err != nil {
		return nil, errors.New("请先注册飞手身份")
	}
	profile, err := s.ensurePilotRoleProfileByUserID(pilotUserID)
	if err != nil {
		return nil, err
	}
	eligibility := buildPilotEligibilityView(pilot, profile)
	if eligibility == nil || !eligibility.CanApplyCandidate {
		if blocker := firstPilotEligibilityBlocker(eligibility); blocker != nil {
			return nil, errors.New(blocker.Message)
		}
		return nil, errors.New("当前飞手资格未就绪，暂不能报名候选")
	}

	demand, err := s.demandDomainRepo.GetDemandByID(demandID)
	if err != nil {
		return nil, errors.New("需求不存在")
	}
	if demand.ServiceType != defaultDemandServiceType {
		return nil, errors.New("当前需求不属于本平台可报名类型")
	}
	if !demand.AllowsPilotCandidate {
		return nil, errors.New("当前需求未开放飞手候选报名")
	}
	if demand.Status != "published" && demand.Status != "quoting" {
		return nil, errors.New("当前需求状态不允许报名候选")
	}
	if demand.ExpiresAt != nil && demand.ExpiresAt.Before(time.Now()) {
		return nil, errors.New("当前需求已过期")
	}

	snapshot := s.buildDemandCandidateSnapshot(pilot, profile)

	existing, err := s.demandDomainRepo.GetDemandCandidateByDemandAndPilot(demandID, pilotUserID)
	if err == nil && existing != nil {
		switch existing.Status {
		case "active":
			return nil, errors.New("您已报名该需求候选")
		case "converted":
			return nil, errors.New("该候选记录已进入后续派单流程")
		default:
			if err := s.demandDomainRepo.UpdateDemandCandidateFields(existing.ID, map[string]interface{}{
				"status":                "active",
				"availability_snapshot": snapshot,
				"updated_at":            time.Now(),
			}); err != nil {
				return nil, err
			}
			if s.matchingService != nil {
				_ = s.matchingService.SyncDemandCandidatePool(demandID, "pilot", pilotUserID)
			}
			return s.demandDomainRepo.GetDemandCandidateByDemandAndPilot(demandID, pilotUserID)
		}
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	candidate := &model.DemandCandidatePilot{
		DemandID:             demandID,
		PilotUserID:          pilotUserID,
		Status:               "active",
		AvailabilitySnapshot: snapshot,
	}
	if err := s.demandDomainRepo.CreateDemandCandidate(candidate); err != nil {
		return nil, err
	}
	if s.matchingService != nil {
		_ = s.matchingService.SyncDemandCandidatePool(demandID, "pilot", pilotUserID)
	}
	return candidate, nil
}

func (s *PilotService) WithdrawDemandCandidate(pilotUserID, demandID int64) (*model.DemandCandidatePilot, error) {
	if s.demandDomainRepo == nil {
		return nil, errors.New("需求域仓储未初始化")
	}
	if _, err := s.GetByUserID(pilotUserID); err != nil {
		return nil, errors.New("请先注册飞手身份")
	}

	candidate, err := s.demandDomainRepo.GetDemandCandidateByDemandAndPilot(demandID, pilotUserID)
	if err != nil {
		return nil, errors.New("当前需求不存在有效候选报名")
	}
	if candidate.Status != "active" {
		return nil, errors.New("当前候选状态不可取消报名")
	}
	if err := s.demandDomainRepo.UpdateDemandCandidateFields(candidate.ID, map[string]interface{}{
		"status":     "withdrawn",
		"updated_at": time.Now(),
	}); err != nil {
		return nil, err
	}
	if s.matchingService != nil {
		_ = s.matchingService.SyncDemandCandidatePool(demandID, "pilot", pilotUserID)
	}
	return s.demandDomainRepo.GetDemandCandidateByDemandAndPilot(demandID, pilotUserID)
}

func (s *PilotService) ListDispatchTasks(pilotUserID int64, status string, page, pageSize int) ([]model.FormalDispatchTask, int64, error) {
	if s.dispatchRepo == nil {
		return nil, 0, errors.New("派单仓储未初始化")
	}
	if _, err := s.GetByUserID(pilotUserID); err != nil {
		return nil, 0, errors.New("飞手档案不存在")
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	return s.dispatchRepo.ListFormalTasksByPilot(pilotUserID, status, page, pageSize)
}

func (s *PilotService) AcceptDispatchTask(pilotUserID, dispatchID int64) (*model.FormalDispatchTask, error) {
	if s.dispatchService != nil {
		return s.dispatchService.AcceptFormalTask(dispatchID, pilotUserID)
	}
	if s.dispatchRepo == nil {
		return nil, errors.New("派单仓储未初始化")
	}

	pilot, err := s.GetByUserID(pilotUserID)
	if err != nil {
		return nil, errors.New("请先注册飞手身份")
	}
	if pilot.VerificationStatus != "verified" {
		return nil, errors.New("飞手资质尚未审核通过，不能接受正式派单")
	}

	db := s.dispatchRepo.DB()
	if db == nil {
		return nil, errors.New("派单仓储未初始化")
	}

	var result *model.FormalDispatchTask
	err = db.Transaction(func(tx *gorm.DB) error {
		dispatchRepo := repository.NewDispatchRepo(tx)
		task, err := dispatchRepo.GetFormalTaskByID(dispatchID)
		if err != nil {
			return errors.New("正式派单不存在")
		}
		if task.TargetPilotUserID != pilotUserID {
			return errors.New("无权响应该正式派单")
		}
		if task.Status == "accepted" || task.Status == "executing" || task.Status == "finished" {
			result = task
			return nil
		}
		if task.Status != "pending_response" {
			return errors.New("当前正式派单状态不允许接受")
		}

		now := time.Now()
		if err := dispatchRepo.UpdateFormalTaskFields(task.ID, map[string]interface{}{
			"status":       "accepted",
			"responded_at": &now,
			"updated_at":   now,
		}); err != nil {
			return err
		}
		if err := dispatchRepo.CreateFormalLog(&model.FormalDispatchLog{
			DispatchTaskID: task.ID,
			ActionType:     "accepted",
			OperatorUserID: pilotUserID,
			Note:           "飞手已接受正式派单",
		}); err != nil {
			return err
		}
		if s.orderRepo != nil {
			orderRepo := repository.NewOrderRepo(tx)
			if err := orderRepo.UpdateFields(task.OrderID, map[string]interface{}{
				"dispatch_task_id":       task.ID,
				"executor_pilot_user_id": pilotUserID,
				"pilot_id":               pilot.ID,
			}); err != nil {
				return err
			}
			if err := orderRepo.AddTimeline(&model.OrderTimeline{
				OrderID:      task.OrderID,
				Status:       "dispatch_accepted",
				Note:         "飞手已接受正式派单",
				OperatorID:   pilotUserID,
				OperatorType: "pilot",
			}); err != nil {
				return err
			}
		}

		result, err = dispatchRepo.GetFormalTaskByID(dispatchID)
		return err
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (s *PilotService) RejectDispatchTask(pilotUserID, dispatchID int64, reason string) (*model.FormalDispatchTask, error) {
	if s.dispatchService != nil {
		return s.dispatchService.RejectFormalTask(dispatchID, pilotUserID, reason)
	}
	if s.dispatchRepo == nil {
		return nil, errors.New("派单仓储未初始化")
	}
	if _, err := s.GetByUserID(pilotUserID); err != nil {
		return nil, errors.New("请先注册飞手身份")
	}

	db := s.dispatchRepo.DB()
	if db == nil {
		return nil, errors.New("派单仓储未初始化")
	}

	var result *model.FormalDispatchTask
	err := db.Transaction(func(tx *gorm.DB) error {
		dispatchRepo := repository.NewDispatchRepo(tx)
		task, err := dispatchRepo.GetFormalTaskByID(dispatchID)
		if err != nil {
			return errors.New("正式派单不存在")
		}
		if task.TargetPilotUserID != pilotUserID {
			return errors.New("无权响应该正式派单")
		}
		if task.Status == "rejected" || task.Status == "expired" {
			result = task
			return nil
		}
		if task.Status != "pending_response" {
			return errors.New("当前正式派单状态不允许拒绝")
		}

		now := time.Now()
		fields := map[string]interface{}{
			"status":       "rejected",
			"responded_at": &now,
			"updated_at":   now,
		}
		if reason != "" {
			fields["reason"] = reason
		}
		if err := dispatchRepo.UpdateFormalTaskFields(task.ID, fields); err != nil {
			return err
		}
		if err := dispatchRepo.CreateFormalLog(&model.FormalDispatchLog{
			DispatchTaskID: task.ID,
			ActionType:     "rejected",
			OperatorUserID: pilotUserID,
			Note:           reason,
		}); err != nil {
			return err
		}
		if s.orderRepo != nil {
			orderRepo := repository.NewOrderRepo(tx)
			note := "飞手拒绝正式派单"
			if reason != "" {
				note += ": " + reason
			}
			if err := orderRepo.AddTimeline(&model.OrderTimeline{
				OrderID:      task.OrderID,
				Status:       "dispatch_rejected",
				Note:         note,
				OperatorID:   pilotUserID,
				OperatorType: "pilot",
			}); err != nil {
				return err
			}
		}

		result, err = dispatchRepo.GetFormalTaskByID(dispatchID)
		return err
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (s *PilotService) ListFlightRecords(pilotUserID int64, page, pageSize int) ([]model.FlightRecord, int64, error) {
	if s.flightRepo == nil {
		return nil, 0, errors.New("飞行仓储未初始化")
	}
	pilot, err := s.GetByUserID(pilotUserID)
	if err != nil {
		return nil, 0, errors.New("飞手档案不存在")
	}
	if s.flightService != nil {
		if err := s.flightService.SyncPilotFulfillmentRecords(pilot.ID); err != nil {
			return nil, 0, err
		}
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	return s.flightRepo.ListFlightRecordsByPilot(pilotUserID, page, pageSize)
}

// List 获取飞手列表
func (s *PilotService) List(page, pageSize int, filters map[string]interface{}) ([]model.Pilot, int64, error) {
	return s.pilotRepo.List(page, pageSize, filters)
}

// FindNearby 查找附近在线飞手
func (s *PilotService) FindNearby(lat, lng, radiusKM float64, limit int) ([]model.Pilot, error) {
	if radiusKM <= 0 {
		radiusKM = 50
	}
	if limit <= 0 {
		limit = 20
	}
	return s.pilotRepo.FindNearby(lat, lng, radiusKM, limit)
}

// ==================== 资质证书管理 ====================

// SubmitCertificationReq 提交证书请求
type SubmitCertificationReq struct {
	CertType         string     `json:"cert_type" binding:"required"` // caac_license, training, emergency, special_operation
	CertName         string     `json:"cert_name"`
	CertNo           string     `json:"cert_no"`
	IssuingAuthority string     `json:"issuing_authority"`
	IssueDate        *time.Time `json:"issue_date"`
	ExpireDate       *time.Time `json:"expire_date"`
	CertImage        string     `json:"cert_image" binding:"required"`
}

// SubmitCertification 提交资质证书
func (s *PilotService) SubmitCertification(pilotID int64, req *SubmitCertificationReq) (*model.PilotCertification, error) {
	// 验证证书类型
	validTypes := map[string]bool{
		"caac_license":      true,
		"training":          true,
		"emergency":         true,
		"special_operation": true,
	}
	if !validTypes[req.CertType] {
		return nil, errors.New("无效的证书类型")
	}

	cert := &model.PilotCertification{
		PilotID:          pilotID,
		CertType:         req.CertType,
		CertName:         req.CertName,
		CertNo:           req.CertNo,
		IssuingAuthority: req.IssuingAuthority,
		IssueDate:        req.IssueDate,
		ExpireDate:       req.ExpireDate,
		CertImage:        req.CertImage,
		Status:           "pending",
	}

	if err := s.pilotRepo.CreateCertification(cert); err != nil {
		return nil, err
	}
	return cert, nil
}

// GetCertifications 获取飞手所有证书
func (s *PilotService) GetCertifications(pilotID int64) ([]model.PilotCertification, error) {
	return s.pilotRepo.GetCertificationsByPilotID(pilotID)
}

// SubmitCriminalCheck 提交无犯罪记录证明
func (s *PilotService) SubmitCriminalCheck(pilotID int64, docURL string, expireDate *time.Time) error {
	return s.pilotRepo.UpdateFields(pilotID, map[string]interface{}{
		"criminal_check_doc":    docURL,
		"criminal_check_expire": expireDate,
		"criminal_check_status": "pending",
	})
}

// SubmitHealthCheck 提交健康体检证明
func (s *PilotService) SubmitHealthCheck(pilotID int64, docURL string, expireDate *time.Time) error {
	return s.pilotRepo.UpdateFields(pilotID, map[string]interface{}{
		"health_check_doc":    docURL,
		"health_check_expire": expireDate,
		"health_check_status": "pending",
	})
}

// ==================== 管理端审核功能 ====================

// VerifyPilot 审核飞手资质
func (s *PilotService) VerifyPilot(pilotID int64, approved bool, note string) error {
	status := "verified"
	if !approved {
		status = "rejected"
	}

	now := time.Now()
	fields := map[string]interface{}{
		"verification_status": status,
		"verification_note":   note,
	}
	if approved {
		fields["verified_at"] = &now
	}

	db := s.pilotRepo.DB()
	if db == nil {
		return errors.New("飞手仓储未初始化")
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		pilotRepo := repository.NewPilotRepo(tx)
		roleProfileRepo := repository.NewRoleProfileRepo(tx)
		tempService := &PilotService{
			pilotRepo:       pilotRepo,
			roleProfileRepo: roleProfileRepo,
		}
		if err := pilotRepo.UpdateFields(pilotID, fields); err != nil {
			return err
		}
		pilot, err := pilotRepo.GetByID(pilotID)
		if err != nil {
			return err
		}
		return tempService.syncPilotRoleProfile(pilot)
	}); err != nil {
		return err
	}

	if s.eventService != nil {
		pilot, err := s.pilotRepo.GetByID(pilotID)
		if err == nil && pilot != nil {
			s.eventService.NotifyPilotVerification(pilot.UserID, approved, note)
		}
	}
	return nil
}

// ApproveCriminalCheck 审核无犯罪记录
func (s *PilotService) ApproveCriminalCheck(pilotID int64, approved bool) error {
	status := "approved"
	if !approved {
		status = "rejected"
	}
	return s.pilotRepo.UpdateFields(pilotID, map[string]interface{}{
		"criminal_check_status": status,
	})
}

// ApproveHealthCheck 审核健康证明
func (s *PilotService) ApproveHealthCheck(pilotID int64, approved bool) error {
	status := "approved"
	if !approved {
		status = "rejected"
	}
	return s.pilotRepo.UpdateFields(pilotID, map[string]interface{}{
		"health_check_status": status,
	})
}

// ApproveCertification 审核资质证书
func (s *PilotService) ApproveCertification(certID int64, approved bool, note string, reviewerID int64) error {
	status := "approved"
	if !approved {
		status = "rejected"
	}
	return s.pilotRepo.UpdateCertificationStatus(certID, status, note, reviewerID)
}

// ListPendingCertifications 获取待审核证书列表
func (s *PilotService) ListPendingCertifications(page, pageSize int) ([]model.PilotCertification, int64, error) {
	return s.pilotRepo.ListPendingCertifications(page, pageSize)
}

// ListPendingPilots 获取待审核飞手列表
func (s *PilotService) ListPendingPilots(page, pageSize int) ([]model.Pilot, int64, error) {
	return s.pilotRepo.List(page, pageSize, map[string]interface{}{
		"verification_status": "pending",
	})
}

// ==================== 飞行记录 ====================

// AddFlightLog 添加飞行记录
func (s *PilotService) AddFlightLog(log *model.PilotFlightLog) error {
	if err := s.pilotRepo.CreateFlightLog(log); err != nil {
		return err
	}

	// 更新飞手飞行小时数
	if log.FlightDuration > 0 {
		hours := log.FlightDuration / 60 // 转换为小时
		s.pilotRepo.UpdateFlightHours(log.PilotID, hours)
	}

	return nil
}

// GetFlightLogs 获取飞行记录
func (s *PilotService) GetFlightLogs(pilotID int64, page, pageSize int) ([]model.PilotFlightLog, int64, error) {
	if s.flightService != nil {
		if err := s.flightService.SyncPilotFulfillmentRecords(pilotID); err != nil {
			return nil, 0, err
		}
	}

	fulfillmentLogs, err := s.buildFulfillmentFlightLogs(pilotID)
	if err != nil {
		return nil, 0, err
	}

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	start := (page - 1) * pageSize
	if start >= len(fulfillmentLogs) {
		return []model.PilotFlightLog{}, int64(len(fulfillmentLogs)), nil
	}
	end := start + pageSize
	if end > len(fulfillmentLogs) {
		end = len(fulfillmentLogs)
	}
	return fulfillmentLogs[start:end], int64(len(fulfillmentLogs)), nil
}

// GetFlightStats 获取飞行统计
func (s *PilotService) GetFlightStats(pilotID int64) (map[string]interface{}, error) {
	if s.flightService != nil {
		if err := s.flightService.SyncPilotFulfillmentRecords(pilotID); err != nil {
			return nil, err
		}
	}

	pilot, err := s.pilotRepo.GetByID(pilotID)
	if err != nil {
		return nil, err
	}

	totalHours, totalDistance, totalFlights, maxAltitude, err := s.flightRepo.GetPilotFulfillmentStats(pilot.UserID)
	if err != nil {
		return nil, err
	}
	avgDuration := 0.0
	if totalFlights > 0 {
		avgDuration = (totalHours * 60) / float64(totalFlights)
	}
	return map[string]interface{}{
		"total_flights":         totalFlights,
		"total_hours":           totalHours,
		"total_distance":        totalDistance,
		"avg_duration":          avgDuration,
		"max_altitude":          maxAltitude,
		"total_flight_hours":    totalHours,
		"total_flight_distance": totalDistance,
	}, nil
}

func (s *PilotService) buildFulfillmentFlightLogs(pilotID int64) ([]model.PilotFlightLog, error) {
	pilot, err := s.pilotRepo.GetByID(pilotID)
	if err != nil {
		return nil, err
	}

	rows, err := s.flightRepo.ListPilotFulfillmentFlights(pilot.UserID)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return []model.PilotFlightLog{}, nil
	}

	logs := make([]model.PilotFlightLog, 0, len(rows))
	for _, row := range rows {
		flightDate := row.OrderUpdatedAt
		if row.LandingAt != nil {
			flightDate = *row.LandingAt
		} else if row.TakeoffAt != nil {
			flightDate = *row.TakeoffAt
		}

		incidentNote := "由履约飞行记录自动生成"
		if row.RecordStatus == "aborted" {
			incidentNote = "由履约飞行记录自动生成（飞行中止）"
		}

		logs = append(logs, model.PilotFlightLog{
			ID:             -row.FlightRecordID,
			PilotID:        pilotID,
			OrderID:        row.OrderID,
			FlightDate:     flightDate,
			FlightDuration: float64(row.TotalDurationSeconds) / 60.0,
			FlightDistance: row.TotalDistanceM / 1000.0,
			StartAddress:   row.ServiceAddress,
			EndAddress:     row.DestAddress,
			MaxAltitude:    row.MaxAltitudeM,
			FlightType:     "cargo",
			CreatedAt:      row.OrderUpdatedAt,
			IncidentReport: incidentNote,
		})
	}

	return logs, nil
}

func calcFlightMetricsFromPositions(positions []model.FlightPosition) (durationSec int64, distanceMeters float64, maxAltitude int) {
	if len(positions) == 0 {
		return 0, 0, 0
	}

	for _, p := range positions {
		if p.Altitude > maxAltitude {
			maxAltitude = p.Altitude
		}
	}

	for i := 1; i < len(positions); i++ {
		prev := positions[i-1]
		cur := positions[i]
		dt := cur.RecordedAt.Sub(prev.RecordedAt).Seconds()
		if dt <= 0 || dt > maxSegmentGapSeconds {
			continue
		}
		dist := haversineMeters(prev.Latitude, prev.Longitude, cur.Latitude, cur.Longitude)
		if dt > 0 && (dist/dt) > maxSegmentSpeedMPS {
			continue
		}
		durationSec += int64(dt)
		distanceMeters += dist
	}

	if durationSec > 0 || len(positions) < 2 {
		return durationSec, distanceMeters, maxAltitude
	}

	// 开发态模拟飞行的点位跨度会比真实遥测更大，严格阈值可能把所有航段都过滤掉。
	// 当严格模式一段都没算出来时，退回到更宽松的二次计算，避免监控概览长期显示为 0。
	for i := 1; i < len(positions); i++ {
		prev := positions[i-1]
		cur := positions[i]
		dt := cur.RecordedAt.Sub(prev.RecordedAt).Seconds()
		if dt <= 0 || dt > maxSegmentGapSeconds {
			continue
		}
		dist := haversineMeters(prev.Latitude, prev.Longitude, cur.Latitude, cur.Longitude)
		durationSec += int64(dt)
		distanceMeters += dist
	}

	return durationSec, distanceMeters, maxAltitude
}

func haversineMeters(lat1, lng1, lat2, lng2 float64) float64 {
	const earthRadius = 6371000.0
	toRad := math.Pi / 180.0
	dLat := (lat2 - lat1) * toRad
	dLng := (lng2 - lng1) * toRad
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*toRad)*math.Cos(lat2*toRad)*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadius * c
}

// ==================== 飞手-无人机绑定 ====================

// BindDrone 绑定无人机
func (s *PilotService) BindDrone(pilotID, droneID, ownerID int64, bindingType string, effectiveTo *time.Time) error {
	db := s.pilotRepo.DB()
	if db == nil {
		return errors.New("飞手仓储未初始化")
	}

	return db.Transaction(func(tx *gorm.DB) error {
		pilotRepo := repository.NewPilotRepo(tx)
		pilot, err := pilotRepo.GetByID(pilotID)
		if err != nil {
			return err
		}

		bound, err := pilotRepo.CheckBinding(pilotID, droneID)
		if err != nil {
			return err
		}
		if bound {
			return errors.New("该无人机已绑定")
		}

		binding := &model.PilotDroneBinding{
			PilotID:       pilotID,
			DroneID:       droneID,
			OwnerID:       ownerID,
			BindingType:   bindingType,
			Status:        "active",
			EffectiveFrom: time.Now(),
			EffectiveTo:   effectiveTo,
		}
		if err := pilotRepo.CreateBinding(binding); err != nil {
			return err
		}

		note := "synced_from_legacy_pilot_drone_binding"
		if bindingType != "" {
			note += ":" + bindingType
		}
		return repository.NewOwnerDomainRepo(tx).EnsureActiveBinding(ownerID, pilot.UserID, note, time.Now())
	})
}

// GetBoundDrones 获取飞手绑定的无人机
func (s *PilotService) GetBoundDrones(pilotID int64) ([]model.PilotDroneBinding, error) {
	return s.pilotRepo.GetBindingsByPilotID(pilotID)
}

// CheckDroneAccess 检查飞手是否有权操作某无人机
func (s *PilotService) CheckDroneAccess(pilotID, droneID int64) (bool, error) {
	return s.pilotRepo.CheckBinding(pilotID, droneID)
}

// UnbindDrone 解除无人机绑定
func (s *PilotService) UnbindDrone(bindingID int64) error {
	db := s.pilotRepo.DB()
	if db == nil {
		return errors.New("飞手仓储未初始化")
	}

	return db.Transaction(func(tx *gorm.DB) error {
		pilotRepo := repository.NewPilotRepo(tx)
		binding, err := pilotRepo.GetBindingByID(bindingID)
		if err != nil {
			return err
		}
		if err := pilotRepo.RevokeBinding(bindingID); err != nil {
			return err
		}

		remaining, err := pilotRepo.CountActiveBindingsByOwnerAndPilot(binding.OwnerID, binding.PilotID, bindingID)
		if err != nil {
			return err
		}
		if remaining > 0 {
			return nil
		}

		pilot, err := pilotRepo.GetByID(binding.PilotID)
		if err != nil {
			return err
		}

		return repository.NewOwnerDomainRepo(tx).DissolveBinding(binding.OwnerID, pilot.UserID, time.Now())
	})
}

// ==================== 辅助函数 ====================

func mustMarshalJSON(v interface{}) []byte {
	data, _ := json.Marshal(v)
	return data
}

func (s *PilotService) ensurePilotProfile(userID int64, req *RegisterPilotReq) error {
	if s.roleProfileRepo == nil || userID == 0 || req == nil {
		return nil
	}

	profile := &model.PilotProfile{
		UserID:              userID,
		VerificationStatus:  "pending",
		AvailabilityStatus:  "offline",
		ServiceRadiusKM:     int(math.Round(req.ServiceRadius)),
		CAACLicenseNo:       req.CAACLicenseNo,
		CAACLicenseExpireAt: req.CAACLicenseExpireDate,
	}
	if profile.ServiceRadiusKM <= 0 {
		profile.ServiceRadiusKM = 50
	}
	if len(req.SpecialSkills) > 0 {
		profile.SkillTags = model.JSON(mustMarshalJSON(req.SpecialSkills))
	}

	return s.roleProfileRepo.EnsurePilotProfile(profile)
}

func (s *PilotService) ensurePilotRoleProfileByUserID(userID int64) (*model.PilotProfile, error) {
	if s.roleProfileRepo == nil {
		return nil, errors.New("飞手档案仓储未初始化")
	}

	profile, err := s.roleProfileRepo.GetPilotProfileByUserID(userID)
	if err == nil && profile != nil {
		return profile, nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	pilot, err := s.pilotRepo.GetByUserID(userID)
	if err != nil {
		return nil, errors.New("请先注册飞手身份")
	}
	if err := s.syncPilotRoleProfile(pilot); err != nil {
		return nil, err
	}
	return s.roleProfileRepo.GetPilotProfileByUserID(userID)
}

func (s *PilotService) syncPilotRoleProfile(pilot *model.Pilot) error {
	if s.roleProfileRepo == nil || pilot == nil {
		return nil
	}

	profile := &model.PilotProfile{
		UserID:              pilot.UserID,
		VerificationStatus:  pilot.VerificationStatus,
		AvailabilityStatus:  pilot.AvailabilityStatus,
		ServiceRadiusKM:     int(math.Round(pilot.ServiceRadius)),
		CAACLicenseNo:       pilot.CAACLicenseNo,
		CAACLicenseExpireAt: pilot.CAACLicenseExpireDate,
	}
	if profile.ServiceRadiusKM <= 0 {
		profile.ServiceRadiusKM = 50
	}
	profile.ServiceCities = model.JSON(mustMarshalJSON([]string{}))
	if pilot.CurrentCity != "" {
		profile.ServiceCities = model.JSON(mustMarshalJSON([]string{pilot.CurrentCity}))
	}
	profile.SkillTags = model.JSON(mustMarshalJSON([]string{}))
	if len(pilot.SpecialSkills) > 0 {
		profile.SkillTags = model.JSON(append([]byte(nil), pilot.SpecialSkills...))
	}

	if err := s.roleProfileRepo.EnsurePilotProfile(profile); err != nil {
		return err
	}

	updates := map[string]interface{}{
		"verification_status":    pilot.VerificationStatus,
		"availability_status":    pilot.AvailabilityStatus,
		"service_radius_km":      profile.ServiceRadiusKM,
		"caac_license_no":        pilot.CAACLicenseNo,
		"caac_license_expire_at": pilot.CAACLicenseExpireDate,
		"service_cities":         profile.ServiceCities,
		"skill_tags":             profile.SkillTags,
		"updated_at":             time.Now(),
	}

	return s.roleProfileRepo.DB().Model(&model.PilotProfile{}).
		Where("user_id = ?", pilot.UserID).
		Updates(updates).Error
}

func (s *PilotService) handleOwnerBindingResponse(pilotUserID, bindingID int64, approve bool) (*model.OwnerPilotBinding, error) {
	if s.ownerDomainRepo == nil {
		return nil, errors.New("绑定仓储未初始化")
	}

	binding, err := s.ownerDomainRepo.GetBindingByID(bindingID)
	if err != nil {
		return nil, errors.New("绑定关系不存在")
	}
	if binding.PilotUserID != pilotUserID {
		return nil, errors.New("无权操作该绑定关系")
	}
	if binding.InitiatedBy != "owner" || binding.Status != "pending_confirmation" {
		return nil, errors.New("当前绑定关系不允许该操作")
	}

	now := time.Now()
	updates := map[string]interface{}{"updated_at": now}
	if approve {
		updates["status"] = "active"
		updates["confirmed_at"] = &now
	} else {
		updates["status"] = "rejected"
	}
	if err := s.ownerDomainRepo.UpdateBindingFields(binding.ID, updates); err != nil {
		return nil, err
	}
	updated, err := s.ownerDomainRepo.GetBindingByID(binding.ID)
	if err != nil {
		return nil, err
	}
	if s.eventService != nil {
		s.eventService.NotifyBindingStatus(updated)
	}
	return updated, nil
}

func (s *PilotService) buildDemandCandidateSnapshot(pilot *model.Pilot, profile *model.PilotProfile) model.JSON {
	snapshot := map[string]interface{}{
		"pilot_user_id":       0,
		"verification_status": "",
		"availability_status": "",
		"service_radius_km":   0,
		"service_city":        "",
		"caac_license_type":   "",
		"service_rating":      0.0,
		"credit_score":        0,
		"generated_at":        time.Now(),
	}

	if pilot != nil {
		snapshot["pilot_user_id"] = pilot.UserID
		snapshot["verification_status"] = pilot.VerificationStatus
		snapshot["availability_status"] = pilot.AvailabilityStatus
		snapshot["service_radius_km"] = int(math.Round(pilot.ServiceRadius))
		snapshot["service_city"] = pilot.CurrentCity
		snapshot["caac_license_type"] = pilot.CAACLicenseType
		snapshot["service_rating"] = pilot.ServiceRating
		snapshot["credit_score"] = pilot.CreditScore
	}
	if profile != nil {
		if profile.VerificationStatus != "" {
			snapshot["verification_status"] = profile.VerificationStatus
		}
		if profile.AvailabilityStatus != "" {
			snapshot["availability_status"] = profile.AvailabilityStatus
		}
		if profile.ServiceRadiusKM > 0 {
			snapshot["service_radius_km"] = profile.ServiceRadiusKM
		}
	}

	return model.JSON(mustMarshalJSON(snapshot))
}

func buildPilotProfileView(pilot *model.Pilot, profile *model.PilotProfile) *PilotProfileView {
	if pilot == nil {
		return nil
	}

	view := &PilotProfileView{
		ID:                  pilot.ID,
		UserID:              pilot.UserID,
		CAACLicenseNo:       pilot.CAACLicenseNo,
		CAACLicenseType:     pilot.CAACLicenseType,
		CAACLicenseExpireAt: pilot.CAACLicenseExpireDate,
		CAACLicenseImage:    pilot.CAACLicenseImage,
		VerificationStatus:  pilot.VerificationStatus,
		AvailabilityStatus:  pilot.AvailabilityStatus,
		ServiceRadius:       pilot.ServiceRadius,
		CurrentCity:         pilot.CurrentCity,
		SpecialSkills:       pilot.SpecialSkills,
		ServiceRating:       pilot.ServiceRating,
		CreditScore:         pilot.CreditScore,
		CreatedAt:           pilot.CreatedAt,
		UpdatedAt:           pilot.UpdatedAt,
	}

	if profile != nil {
		view.ServiceRadiusKM = profile.ServiceRadiusKM
		view.ServiceCities = profile.ServiceCities
		view.SkillTags = profile.SkillTags
		if view.VerificationStatus == "" {
			view.VerificationStatus = profile.VerificationStatus
		}
		if view.AvailabilityStatus == "" {
			view.AvailabilityStatus = profile.AvailabilityStatus
		}
	} else {
		view.ServiceRadiusKM = int(math.Round(pilot.ServiceRadius))
	}
	view.Eligibility = buildPilotEligibilityView(pilot, profile)

	return view
}

func buildPilotEligibilityView(pilot *model.Pilot, profile *model.PilotProfile) *PilotEligibilityView {
	if pilot == nil {
		return nil
	}

	blockers := make([]PilotEligibilityBlocker, 0)
	missingBasics := false
	if strings.TrimSpace(pilot.CAACLicenseNo) == "" {
		missingBasics = true
		blockers = append(blockers, PilotEligibilityBlocker{
			Code:    "pilot_license_no_required",
			Message: "先补齐执照编号，才能参与候选报名和后续派单。",
		})
	}
	if strings.TrimSpace(pilot.CAACLicenseType) == "" {
		missingBasics = true
		blockers = append(blockers, PilotEligibilityBlocker{
			Code:    "pilot_license_type_required",
			Message: "先补齐执照类型，平台才能识别你的可执行范围。",
		})
	}
	if strings.TrimSpace(pilot.CAACLicenseImage) == "" {
		missingBasics = true
		blockers = append(blockers, PilotEligibilityBlocker{
			Code:    "pilot_license_image_required",
			Message: "先上传执照图片，平台才能进入飞手审核流程。",
		})
	}

	status := normalizePilotVerificationStatus(pilot.VerificationStatus, profile)
	switch status {
	case "rejected":
		blockers = append(blockers, PilotEligibilityBlocker{
			Code:    "pilot_verification_rejected",
			Message: "飞手认证未通过，请补充资料后重新提交。",
		})
	case "pending":
		blockers = append(blockers, PilotEligibilityBlocker{
			Code:    "pilot_dispatch_requires_verification",
			Message: "当前可先报名低风险候选需求；正式派单需等待飞手认证通过。",
		})
	case "unverified":
		blockers = append(blockers, PilotEligibilityBlocker{
			Code:    "pilot_verification_pending_submission",
			Message: "先提交飞手认证资料，之后才能进入候选需求和正式派单流程。",
		})
	}

	canApplyCandidate := !missingBasics && status != "rejected" && status != "unverified"
	canAcceptDispatch := status == "verified"
	canStartExecution := status == "verified"
	canUpdateAvailability := status == "verified"

	tier := "profile_setup"
	label := "待补齐飞手资料"
	nextStep := "先补齐执照编号、执照类型和证照图片。"

	switch {
	case status == "rejected":
		tier = "needs_resubmission"
		label = "待重新提交"
		nextStep = "根据审核反馈补充资料后重新提交。"
	case canAcceptDispatch && isPilotAvailableForDispatch(pilot.AvailabilityStatus):
		tier = "dispatch_ready"
		label = "正式派单就绪"
		nextStep = "当前已可接受正式派单，也可以直接进入执行任务。"
	case canAcceptDispatch:
		tier = "verified_offline"
		label = "认证已通过"
		nextStep = "把接单状态切到“接单中”，系统才会把你纳入正式派单池。"
	case canApplyCandidate:
		tier = "candidate_ready"
		label = "候选报名就绪"
		nextStep = "现在可以先浏览并报名候选需求，正式派单会在认证通过后开放。"
	case missingBasics:
		tier = "profile_setup"
		label = "待补齐飞手资料"
		nextStep = "先补齐执照编号、执照类型和证照图片。"
	default:
		tier = "verification_pending"
		label = "等待飞手认证"
		nextStep = "先提交飞手认证资料，之后可报名候选需求。"
	}

	return &PilotEligibilityView{
		Tier:                  tier,
		Label:                 label,
		CanApplyCandidate:     canApplyCandidate,
		CanAcceptDispatch:     canAcceptDispatch,
		CanStartExecution:     canStartExecution,
		CanUpdateAvailability: canUpdateAvailability,
		RecommendedNextStep:   nextStep,
		Blockers:              blockers,
	}
}

func normalizePilotVerificationStatus(status string, profile *model.PilotProfile) string {
	status = strings.TrimSpace(strings.ToLower(status))
	switch status {
	case "verified", "approved":
		return "verified"
	case "pending":
		return "pending"
	case "rejected":
		return "rejected"
	}
	if profile != nil {
		switch strings.TrimSpace(strings.ToLower(profile.VerificationStatus)) {
		case "verified", "approved":
			return "verified"
		case "pending":
			return "pending"
		case "rejected":
			return "rejected"
		}
	}
	return "unverified"
}

func isPilotAvailableForDispatch(status string) bool {
	switch strings.TrimSpace(strings.ToLower(status)) {
	case "online", "available":
		return true
	default:
		return false
	}
}

func firstPilotEligibilityBlocker(view *PilotEligibilityView) *PilotEligibilityBlocker {
	if view == nil || len(view.Blockers) == 0 {
		return nil
	}
	return &view.Blockers[0]
}
