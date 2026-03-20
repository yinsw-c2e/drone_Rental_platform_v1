package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"time"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

type DispatchService struct {
	dispatchRepo      *repository.DispatchRepo
	pilotRepo         *repository.PilotRepo
	droneRepo         *repository.DroneRepo
	clientRepo        *repository.ClientRepo
	orderRepo         *repository.OrderRepo
	ownerDomainRepo   *repository.OwnerDomainRepo
	demandDomainRepo  *repository.DemandDomainRepo
	orderArtifactRepo *repository.OrderArtifactRepo
	eventService      *EventService
	logger            *zap.Logger
	config            *DispatchServiceConfig
}

// DispatchServiceConfig 派单服务配置
type DispatchServiceConfig struct {
	DefaultRadiusKM        float64 // 默认匹配半径
	ExtendedRadiusKM       float64 // 扩展匹配半径
	MaxRadiusKM            float64 // 最大匹配半径
	BatchWindowSeconds     int     // 批量匹配时间窗口
	ResponseTimeoutSeconds int     // 候选人响应超时
	MaxCandidatesPerTask   int     // 每个任务最大候选人数
	MinMatchScore          int     // 最低匹配分数

	// 得分权重
	DistanceScoreWeight      int
	LoadScoreWeight          int
	QualificationScoreWeight int
	CreditScoreWeight        int
	PriceScoreWeight         int
	TimeScoreWeight          int
	RatingScoreWeight        int
}

func NewDispatchService(
	dispatchRepo *repository.DispatchRepo,
	pilotRepo *repository.PilotRepo,
	droneRepo *repository.DroneRepo,
	clientRepo *repository.ClientRepo,
	orderRepo *repository.OrderRepo,
	ownerDomainRepo *repository.OwnerDomainRepo,
	demandDomainRepo *repository.DemandDomainRepo,
	orderArtifactRepo *repository.OrderArtifactRepo,
	logger *zap.Logger,
) *DispatchService {
	// 默认配置
	config := &DispatchServiceConfig{
		DefaultRadiusKM:          5,
		ExtendedRadiusKM:         15,
		MaxRadiusKM:              50,
		BatchWindowSeconds:       3,
		ResponseTimeoutSeconds:   30,
		MaxCandidatesPerTask:     10,
		MinMatchScore:            20,
		DistanceScoreWeight:      25,
		LoadScoreWeight:          15,
		QualificationScoreWeight: 20,
		CreditScoreWeight:        15,
		PriceScoreWeight:         10,
		TimeScoreWeight:          10,
		RatingScoreWeight:        5,
	}

	return &DispatchService{
		dispatchRepo:      dispatchRepo,
		pilotRepo:         pilotRepo,
		droneRepo:         droneRepo,
		clientRepo:        clientRepo,
		orderRepo:         orderRepo,
		ownerDomainRepo:   ownerDomainRepo,
		demandDomainRepo:  demandDomainRepo,
		orderArtifactRepo: orderArtifactRepo,
		logger:            logger,
		config:            config,
	}
}

func (s *DispatchService) SetEventService(eventService *EventService) {
	s.eventService = eventService
}

func (s *DispatchService) AdminListFormalTasks(page, pageSize int, filters map[string]interface{}) ([]model.FormalDispatchTask, int64, error) {
	if s.dispatchRepo == nil {
		return nil, 0, errors.New("正式派单仓储未初始化")
	}
	return s.dispatchRepo.AdminListFormalTasks(page, pageSize, filters)
}

const maxFormalDispatchRetries = 3

type dispatchPilotOption struct {
	PilotUserID     int64
	Source          string
	Reason          string
	SortWeight      int
	Distance        float64
	BindingPriority bool
}

// LoadConfigFromDB 从数据库加载配置
func (s *DispatchService) LoadConfigFromDB() error {
	configs, err := s.dispatchRepo.GetAllConfigs()
	if err != nil {
		return err
	}

	for _, cfg := range configs {
		switch cfg.ConfigKey {
		case "matching_radius_km":
			if v, err := strconv.ParseFloat(cfg.ConfigValue, 64); err == nil {
				s.config.DefaultRadiusKM = v
			}
		case "matching_extended_radius_km":
			if v, err := strconv.ParseFloat(cfg.ConfigValue, 64); err == nil {
				s.config.ExtendedRadiusKM = v
			}
		case "matching_max_radius_km":
			if v, err := strconv.ParseFloat(cfg.ConfigValue, 64); err == nil {
				s.config.MaxRadiusKM = v
			}
		case "batch_window_seconds":
			if v, err := strconv.Atoi(cfg.ConfigValue); err == nil {
				s.config.BatchWindowSeconds = v
			}
		case "candidate_response_timeout_seconds":
			if v, err := strconv.Atoi(cfg.ConfigValue); err == nil {
				s.config.ResponseTimeoutSeconds = v
			}
		case "max_candidates_per_task":
			if v, err := strconv.Atoi(cfg.ConfigValue); err == nil {
				s.config.MaxCandidatesPerTask = v
			}
		case "min_match_score":
			if v, err := strconv.Atoi(cfg.ConfigValue); err == nil {
				s.config.MinMatchScore = v
			}
		case "distance_score_weight":
			if v, err := strconv.Atoi(cfg.ConfigValue); err == nil {
				s.config.DistanceScoreWeight = v
			}
		case "load_score_weight":
			if v, err := strconv.Atoi(cfg.ConfigValue); err == nil {
				s.config.LoadScoreWeight = v
			}
		case "qualification_score_weight":
			if v, err := strconv.Atoi(cfg.ConfigValue); err == nil {
				s.config.QualificationScoreWeight = v
			}
		case "credit_score_weight":
			if v, err := strconv.Atoi(cfg.ConfigValue); err == nil {
				s.config.CreditScoreWeight = v
			}
		case "price_score_weight":
			if v, err := strconv.Atoi(cfg.ConfigValue); err == nil {
				s.config.PriceScoreWeight = v
			}
		case "time_score_weight":
			if v, err := strconv.Atoi(cfg.ConfigValue); err == nil {
				s.config.TimeScoreWeight = v
			}
		case "rating_score_weight":
			if v, err := strconv.Atoi(cfg.ConfigValue); err == nil {
				s.config.RatingScoreWeight = v
			}
		}
	}

	return nil
}

// ==================== 创建派单任务 ====================

// CreateTask 创建派单任务
func (s *DispatchService) CreateTask(clientID int64, req *CreateTaskRequest) (*model.DispatchTask, error) {
	// 验证客户
	client, err := s.clientRepo.GetByID(clientID)
	if err != nil {
		return nil, errors.New("客户不存在")
	}

	if client.VerificationStatus != "verified" {
		return nil, errors.New("客户资质审核未通过，请等待审核完成后再创建任务")
	}

	if client.PlatformCreditScore < 300 {
		return nil, errors.New("信用分过低，暂时无法下单")
	}

	// 计算飞行距离
	flightDistance := haversineDistance(
		req.PickupLatitude, req.PickupLongitude,
		req.DeliveryLatitude, req.DeliveryLongitude,
	)

	task := &model.DispatchTask{
		TaskNo:              s.dispatchRepo.GenerateTaskNo(),
		ClientID:            clientID,
		TaskType:            req.TaskType,
		Priority:            req.Priority,
		Status:              "pending",
		CargoWeight:         req.CargoWeight,
		CargoVolume:         req.CargoVolume,
		CargoCategory:       req.CargoCategory,
		IsHazardous:         req.IsHazardous,
		PickupLatitude:      req.PickupLatitude,
		PickupLongitude:     req.PickupLongitude,
		PickupAddress:       req.PickupAddress,
		DeliveryLatitude:    req.DeliveryLatitude,
		DeliveryLongitude:   req.DeliveryLongitude,
		DeliveryAddress:     req.DeliveryAddress,
		FlightDistance:      flightDistance,
		BudgetMin:           req.BudgetMin,
		BudgetMax:           req.BudgetMax,
		OfferedPrice:        req.OfferedPrice,
		RequiredLicenseType: req.RequiredLicenseType,
		MinPilotRating:      req.MinPilotRating,
		MinDroneRating:      req.MinDroneRating,
		MinCreditScore:      req.MinCreditScore,
		MaxAttempts:         3,
	}

	// 设置时间约束
	if req.RequiredPickupTime != nil {
		task.RequiredPickupTime = req.RequiredPickupTime
	}
	if req.RequiredDeliveryTime != nil {
		task.RequiredDeliveryTime = req.RequiredDeliveryTime
	}

	// 设置派单截止时间（默认30分钟）
	deadline := time.Now().Add(30 * time.Minute)
	task.DispatchDeadline = &deadline

	if err := s.dispatchRepo.CreateTask(task); err != nil {
		return nil, err
	}

	// 记录日志
	s.logAction(task.ID, "created", "client", clientID, map[string]interface{}{
		"task_no": task.TaskNo,
	})

	return task, nil
}

// CreateTaskRequest 创建任务请求
type CreateTaskRequest struct {
	TaskType             string     `json:"task_type"`
	Priority             int        `json:"priority"`
	CargoWeight          float64    `json:"cargo_weight"`
	CargoVolume          float64    `json:"cargo_volume"`
	CargoCategory        string     `json:"cargo_category"`
	IsHazardous          bool       `json:"is_hazardous"`
	PickupLatitude       float64    `json:"pickup_latitude"`
	PickupLongitude      float64    `json:"pickup_longitude"`
	PickupAddress        string     `json:"pickup_address"`
	DeliveryLatitude     float64    `json:"delivery_latitude"`
	DeliveryLongitude    float64    `json:"delivery_longitude"`
	DeliveryAddress      string     `json:"delivery_address"`
	RequiredPickupTime   *time.Time `json:"required_pickup_time"`
	RequiredDeliveryTime *time.Time `json:"required_delivery_time"`
	BudgetMin            int64      `json:"budget_min"`
	BudgetMax            int64      `json:"budget_max"`
	OfferedPrice         int64      `json:"offered_price"`
	RequiredLicenseType  string     `json:"required_license_type"`
	MinPilotRating       float64    `json:"min_pilot_rating"`
	MinDroneRating       float64    `json:"min_drone_rating"`
	MinCreditScore       int        `json:"min_credit_score"`
}

// ==================== 智能匹配算法 ====================

// MatchTask 为任务寻找匹配的飞手-无人机组合
func (s *DispatchService) MatchTask(taskID int64) ([]model.DispatchCandidate, error) {
	task, err := s.dispatchRepo.GetTaskByID(taskID)
	if err != nil {
		return nil, errors.New("任务不存在")
	}

	if task.Status != "pending" && task.Status != "matching" {
		return nil, errors.New("任务状态不允许匹配")
	}

	// 更新任务状态
	s.dispatchRepo.UpdateTaskStatus(taskID, "matching")
	s.logAction(taskID, "matching_started", "system", 0, nil)

	// 清除旧的候选人
	s.dispatchRepo.DeleteCandidatesByTask(taskID)

	// 分层匹配策略
	var candidates []model.DispatchCandidate
	seenPilots := make(map[int64]bool) // 防止同一飞手因多半径被重复加入
	radiusLevels := []float64{s.config.DefaultRadiusKM, s.config.ExtendedRadiusKM, s.config.MaxRadiusKM}

	for _, radius := range radiusLevels {
		pairs, err := s.dispatchRepo.FindAvailablePilotDronePairs(
			task.PickupLatitude,
			task.PickupLongitude,
			radius,
			task.CargoWeight,
			task.RequiredLicenseType,
		)
		if err != nil {
			s.logger.Error("查找飞手-无人机组合失败", zap.Error(err))
			continue
		}

		for _, pair := range pairs {
			// 跳过已加入候选人列表的飞手（防止多半径重复）
			if seenPilots[pair.PilotID] {
				continue
			}
			candidate := s.scorePair(task, &pair)
			if candidate.TotalScore >= s.config.MinMatchScore {
				seenPilots[pair.PilotID] = true
				candidates = append(candidates, candidate)
			}
		}

		// 如果找到足够的候选人，停止扩大搜索范围
		if len(candidates) >= s.config.MaxCandidatesPerTask {
			break
		}
	}

	if len(candidates) == 0 {
		s.dispatchRepo.UpdateTaskFields(taskID, map[string]interface{}{
			"status":          "pending",
			"fail_reason":     "未找到合适的飞手和无人机",
			"match_attempts":  task.MatchAttempts + 1,
			"last_match_time": time.Now(),
		})
		return nil, errors.New("未找到合适的飞手和无人机")
	}

	// 按得分排序并截取
	sortCandidatesByScore(candidates)
	if len(candidates) > s.config.MaxCandidatesPerTask {
		candidates = candidates[:s.config.MaxCandidatesPerTask]
	}

	// 设置任务ID并保存（先清理该任务未响应的旧候选人，防止重复匹配产生重复记录）
	for i := range candidates {
		candidates[i].TaskID = taskID
	}
	s.dispatchRepo.DeletePendingCandidatesByTask(taskID)

	if err := s.dispatchRepo.BatchCreateCandidates(candidates); err != nil {
		return nil, err
	}

	// 更新任务状态
	s.dispatchRepo.UpdateTaskFields(taskID, map[string]interface{}{
		"status":          "dispatching",
		"match_attempts":  task.MatchAttempts + 1,
		"last_match_time": time.Now(),
	})

	s.logAction(taskID, "candidate_found", "system", 0, map[string]interface{}{
		"candidate_count": len(candidates),
	})

	return candidates, nil
}

// scorePair 计算飞手-无人机组合的匹配得分
func (s *DispatchService) scorePair(task *model.DispatchTask, pair *repository.PilotDronePair) model.DispatchCandidate {
	candidate := model.DispatchCandidate{
		PilotID:  pair.PilotID,
		DroneID:  pair.DroneID,
		OwnerID:  pair.OwnerID,
		Distance: pair.Distance,
		Status:   "pending",
	}

	// 1. 距离得分 (0-25分) - 5公里内满分，超过逐渐递减
	if pair.Distance <= 5 {
		candidate.DistanceScore = s.config.DistanceScoreWeight
	} else if pair.Distance <= 15 {
		candidate.DistanceScore = int(float64(s.config.DistanceScoreWeight) * (1 - (pair.Distance-5)/30))
	} else {
		candidate.DistanceScore = int(float64(s.config.DistanceScoreWeight) * (1 - pair.Distance/s.config.MaxRadiusKM))
	}
	if candidate.DistanceScore < 0 {
		candidate.DistanceScore = 0
	}

	// 2. 载荷匹配得分 (0-15分)
	loadRatio := task.CargoWeight / pair.MaxLoad
	if loadRatio <= 0.7 {
		candidate.LoadScore = s.config.LoadScoreWeight // 载荷余量充足
	} else if loadRatio <= 0.9 {
		candidate.LoadScore = int(float64(s.config.LoadScoreWeight) * 0.8)
	} else if loadRatio <= 1.0 {
		candidate.LoadScore = int(float64(s.config.LoadScoreWeight) * 0.5)
	} else {
		candidate.LoadScore = 0 // 超载
	}

	// 3. 资质匹配得分 (0-20分)
	qualScore := 0
	// 执照类型匹配
	if task.RequiredLicenseType == "" || pair.CAACLicenseType == task.RequiredLicenseType {
		qualScore += 8
	} else if pair.CAACLicenseType == "BVLOS" && task.RequiredLicenseType == "VLOS" {
		qualScore += 8 // 超视距执照可以执行视距内任务
	}
	// 飞行经验
	if pair.TotalFlightHours >= 500 {
		qualScore += 6
	} else if pair.TotalFlightHours >= 100 {
		qualScore += 4
	} else if pair.TotalFlightHours >= 50 {
		qualScore += 2
	}
	// 飞行距离能力（FlightDistance为0时直接给满分）
	if task.FlightDistance <= 0 || pair.MaxDistance >= task.FlightDistance*1.5 {
		qualScore += 6
	} else if pair.MaxDistance >= task.FlightDistance {
		qualScore += 3
	}
	candidate.QualificationScore = min(qualScore, s.config.QualificationScoreWeight)

	// 4. 信用得分 (0-15分)
	if pair.PilotCreditScore >= 800 {
		candidate.CreditScore = s.config.CreditScoreWeight
	} else if pair.PilotCreditScore >= 600 {
		candidate.CreditScore = int(float64(s.config.CreditScoreWeight) * 0.8)
	} else if pair.PilotCreditScore >= 400 {
		candidate.CreditScore = int(float64(s.config.CreditScoreWeight) * 0.5)
	} else {
		candidate.CreditScore = 0
	}

	// 5. 价格得分 (0-10分) - 基于估算价格与预算的匹配度
	estimatedPrice := s.estimatePrice(task, pair)
	candidate.QuotedPrice = estimatedPrice
	if task.BudgetMax > 0 {
		if estimatedPrice <= task.BudgetMin {
			candidate.PriceScore = s.config.PriceScoreWeight
		} else if estimatedPrice <= task.BudgetMax {
			priceRatio := float64(estimatedPrice-task.BudgetMin) / float64(task.BudgetMax-task.BudgetMin)
			candidate.PriceScore = int(float64(s.config.PriceScoreWeight) * (1 - priceRatio*0.5))
		} else {
			candidate.PriceScore = 0
		}
	} else {
		candidate.PriceScore = s.config.PriceScoreWeight / 2
	}

	// 6. 时间匹配得分 (0-10分) - 基于预计完成时间
	estimatedMinutes := int(pair.Distance/0.5 + task.FlightDistance/0.5 + 15) // 简化估算
	candidate.EstimatedTime = estimatedMinutes
	if task.RequiredDeliveryTime != nil {
		availableMinutes := int(time.Until(*task.RequiredDeliveryTime).Minutes())
		if estimatedMinutes <= int(float64(availableMinutes)*0.7) {
			candidate.TimeScore = s.config.TimeScoreWeight
		} else if estimatedMinutes <= availableMinutes {
			candidate.TimeScore = int(float64(s.config.TimeScoreWeight) * 0.7)
		} else {
			candidate.TimeScore = 0
		}
	} else {
		candidate.TimeScore = s.config.TimeScoreWeight / 2
	}

	// 7. 服务评分得分 (0-5分)
	avgRating := (pair.PilotRating + pair.DroneRating) / 2
	candidate.RatingScore = int(avgRating)
	if candidate.RatingScore > s.config.RatingScoreWeight {
		candidate.RatingScore = s.config.RatingScoreWeight
	}

	// 计算总分
	candidate.TotalScore = candidate.DistanceScore + candidate.LoadScore +
		candidate.QualificationScore + candidate.CreditScore +
		candidate.PriceScore + candidate.TimeScore + candidate.RatingScore

	return candidate
}

// estimatePrice 估算价格
func (s *DispatchService) estimatePrice(task *model.DispatchTask, pair *repository.PilotDronePair) int64 {
	// 基础价格公式: 起步费 + 里程费 + 重量费
	baseFee := int64(5000)                           // 起步费50元
	distanceFee := int64(task.FlightDistance * 1000) // 10元/公里
	weightFee := int64(task.CargoWeight * 500)       // 5元/公斤

	// 难度系数
	difficultyMultiplier := 1.0
	if task.IsHazardous {
		difficultyMultiplier = 1.5
	}

	totalFee := int64(float64(baseFee+distanceFee+weightFee) * difficultyMultiplier)
	return totalFee
}

// ==================== 派单流程 ====================

// NotifyTopCandidate 通知最优候选人
func (s *DispatchService) NotifyTopCandidate(taskID int64) (*model.DispatchCandidate, error) {
	candidate, err := s.dispatchRepo.GetTopCandidate(taskID)
	if err != nil {
		return nil, errors.New("没有可用的候选人")
	}

	// 更新候选人状态
	s.dispatchRepo.UpdateCandidateStatus(candidate.ID, "notified")

	s.logAction(taskID, "notified", "system", 0, map[string]interface{}{
		"candidate_id": candidate.ID,
		"pilot_id":     candidate.PilotID,
	})

	// TODO: 发送推送通知给飞手

	return candidate, nil
}

// AcceptTask 飞手接受任务
func (s *DispatchService) AcceptTask(candidateID int64, pilotID int64) error {
	candidate, err := s.dispatchRepo.GetCandidateByID(candidateID)
	if err != nil {
		return errors.New("候选人记录不存在")
	}

	if candidate.PilotID != pilotID {
		return errors.New("无权操作此任务")
	}

	if candidate.Status != "notified" {
		return errors.New("任务状态不允许接受")
	}

	task, err := s.dispatchRepo.GetTaskByID(candidate.TaskID)
	if err != nil {
		return errors.New("任务不存在")
	}

	if task.Status != "dispatching" {
		return errors.New("任务已被分配或取消")
	}

	// 更新候选人状态
	s.dispatchRepo.UpdateCandidateStatus(candidateID, "accepted")

	// 更新任务
	now := time.Now()
	matchDetails, _ := json.Marshal(map[string]interface{}{
		"distance_score":      candidate.DistanceScore,
		"load_score":          candidate.LoadScore,
		"qualification_score": candidate.QualificationScore,
		"credit_score":        candidate.CreditScore,
		"price_score":         candidate.PriceScore,
		"time_score":          candidate.TimeScore,
		"rating_score":        candidate.RatingScore,
	})

	s.dispatchRepo.UpdateTaskFields(task.ID, map[string]interface{}{
		"status":            "assigned",
		"assigned_pilot_id": candidate.PilotID,
		"assigned_drone_id": candidate.DroneID,
		"assigned_owner_id": candidate.OwnerID,
		"assigned_at":       &now,
		"final_price":       candidate.QuotedPrice,
		"match_score":       candidate.TotalScore,
		"match_details":     string(matchDetails),
	})

	// 拒绝其他候选人
	candidates, _ := s.dispatchRepo.GetCandidatesByTask(task.ID)
	for _, c := range candidates {
		if c.ID != candidateID && c.Status == "pending" {
			s.dispatchRepo.UpdateCandidateStatus(c.ID, "rejected")
		}
	}

	s.logAction(task.ID, "accepted", "pilot", pilotID, map[string]interface{}{
		"candidate_id": candidateID,
	})

	return nil
}

// RejectTask 飞手拒绝任务
func (s *DispatchService) RejectTask(candidateID int64, pilotID int64, reason string) error {
	candidate, err := s.dispatchRepo.GetCandidateByID(candidateID)
	if err != nil {
		return errors.New("候选人记录不存在")
	}

	if candidate.PilotID != pilotID {
		return errors.New("无权操作此任务")
	}

	if candidate.Status != "notified" {
		return errors.New("任务状态不允许拒绝")
	}

	// 更新候选人状态
	s.dispatchRepo.UpdateCandidateStatus(candidateID, "rejected")

	s.logAction(candidate.TaskID, "rejected", "pilot", pilotID, map[string]interface{}{
		"candidate_id": candidateID,
		"reason":       reason,
	})

	// 尝试通知下一个候选人
	s.NotifyTopCandidate(candidate.TaskID)

	return nil
}

func (s *DispatchService) EnsureOrderDispatch(orderID int64) (*model.FormalDispatchTask, error) {
	if s.dispatchRepo == nil || s.orderRepo == nil {
		return nil, errors.New("正式派单依赖未初始化")
	}

	db := s.dispatchRepo.DB()
	if db == nil {
		return nil, errors.New("派单仓储未初始化")
	}

	var created *model.FormalDispatchTask
	var createdNew bool
	err := db.Transaction(func(tx *gorm.DB) error {
		dispatchRepo := repository.NewDispatchRepo(tx)
		orderRepo := repository.NewOrderRepo(tx)
		pilotRepo := repository.NewPilotRepo(tx)
		ownerRepo := repository.NewOwnerDomainRepo(tx)
		demandRepo := repository.NewDemandDomainRepo(tx)
		artifactRepo := repository.NewOrderArtifactRepo(tx)

		task, isNew, err := s.ensureOrderDispatchWithRepos(orderID, dispatchRepo, orderRepo, pilotRepo, ownerRepo, demandRepo, artifactRepo)
		if err != nil {
			return err
		}
		created = task
		createdNew = isNew
		return nil
	})
	if err != nil {
		return nil, err
	}
	if createdNew && created != nil && s.eventService != nil {
		if order, err := s.orderRepo.GetByID(created.OrderID); err == nil && order != nil {
			s.eventService.NotifyDispatchCreated(created, order)
		}
	}
	return created, nil
}

func (s *DispatchService) AcceptFormalTask(dispatchID, pilotUserID int64) (*model.FormalDispatchTask, error) {
	if s.dispatchRepo == nil || s.orderRepo == nil || s.pilotRepo == nil {
		return nil, errors.New("正式派单依赖未初始化")
	}

	db := s.dispatchRepo.DB()
	if db == nil {
		return nil, errors.New("派单仓储未初始化")
	}

	var result *model.FormalDispatchTask
	var accepted bool
	err := db.Transaction(func(tx *gorm.DB) error {
		dispatchRepo := repository.NewDispatchRepo(tx)
		orderRepo := repository.NewOrderRepo(tx)
		pilotRepo := repository.NewPilotRepo(tx)
		artifactRepo := repository.NewOrderArtifactRepo(tx)

		pilot, err := pilotRepo.GetByUserID(pilotUserID)
		if err != nil {
			return errors.New("请先注册飞手身份")
		}
		if pilot.VerificationStatus != "verified" {
			return errors.New("飞手资质尚未审核通过，不能接受正式派单")
		}

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

		order, err := orderRepo.GetByID(task.OrderID)
		if err != nil {
			return errors.New("订单不存在")
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
		accepted = true
		if err := orderRepo.UpdateFields(task.OrderID, map[string]interface{}{
			"status":                 "assigned",
			"dispatch_task_id":       task.ID,
			"executor_pilot_user_id": pilotUserID,
			"pilot_id":               pilot.ID,
			"execution_mode":         mapDispatchSourceToExecutionMode(task.DispatchSource),
			"needs_dispatch":         true,
			"updated_at":             now,
		}); err != nil {
			return err
		}
		order.Status = "assigned"
		order.DispatchTaskID = &task.ID
		order.ExecutorPilotUserID = pilotUserID
		order.PilotID = pilot.ID
		order.ExecutionMode = mapDispatchSourceToExecutionMode(task.DispatchSource)
		order.NeedsDispatch = true
		if err := orderRepo.AddTimeline(&model.OrderTimeline{
			OrderID:      task.OrderID,
			Status:       "assigned",
			Note:         "飞手已接受正式派单，订单进入已分配",
			OperatorID:   pilotUserID,
			OperatorType: "pilot",
		}); err != nil {
			return err
		}
		if artifactRepo != nil {
			if err := repository.UpsertOrderSnapshotBundle(artifactRepo, order, nil, nil); err != nil {
				return err
			}
		}

		result, err = dispatchRepo.GetFormalTaskByID(dispatchID)
		return err
	})
	if err != nil {
		return nil, err
	}
	if accepted && result != nil && s.eventService != nil {
		if order, err := s.orderRepo.GetByID(result.OrderID); err == nil && order != nil {
			s.eventService.NotifyDispatchAccepted(result, order)
		}
	}

	return result, nil
}

func (s *DispatchService) RejectFormalTask(dispatchID, pilotUserID int64, reason string) (*model.FormalDispatchTask, error) {
	return s.completeFormalTaskAndReassign(dispatchID, pilotUserID, "rejected", reason)
}

func (s *DispatchService) ReportFormalTaskException(dispatchID, operatorUserID int64, note string) (*model.FormalDispatchTask, error) {
	return s.completeFormalTaskAndReassign(dispatchID, operatorUserID, "exception", note)
}

func (s *DispatchService) completeFormalTaskAndReassign(dispatchID, operatorUserID int64, terminalStatus, note string) (*model.FormalDispatchTask, error) {
	if s.dispatchRepo == nil || s.orderRepo == nil {
		return nil, errors.New("正式派单依赖未初始化")
	}

	db := s.dispatchRepo.DB()
	if db == nil {
		return nil, errors.New("派单仓储未初始化")
	}

	var result *model.FormalDispatchTask
	var stateChanged bool
	var reassignedTask *model.FormalDispatchTask
	var manualFallback bool
	var affectedOrderID int64
	var terminalReason string
	err := db.Transaction(func(tx *gorm.DB) error {
		dispatchRepo := repository.NewDispatchRepo(tx)
		orderRepo := repository.NewOrderRepo(tx)
		pilotRepo := repository.NewPilotRepo(tx)
		ownerRepo := repository.NewOwnerDomainRepo(tx)
		demandRepo := repository.NewDemandDomainRepo(tx)
		artifactRepo := repository.NewOrderArtifactRepo(tx)

		task, err := dispatchRepo.GetFormalTaskByID(dispatchID)
		if err != nil {
			return errors.New("正式派单不存在")
		}
		if operatorUserID != 0 && task.TargetPilotUserID != operatorUserID && task.ProviderUserID != operatorUserID {
			return errors.New("无权操作该正式派单")
		}
		if task.Status == "rejected" || task.Status == "expired" || task.Status == "exception" {
			result = task
			return nil
		}
		if task.Status != "pending_response" && task.Status != "accepted" {
			return errors.New("当前正式派单状态不允许该操作")
		}
		if terminalStatus == "rejected" && task.Status != "pending_response" {
			return errors.New("已接受的正式派单不能再直接拒绝，请走异常回退")
		}
		if terminalStatus == "expired" && task.Status != "pending_response" {
			return errors.New("仅待响应中的正式派单允许超时回退")
		}

		order, err := orderRepo.GetByID(task.OrderID)
		if err != nil {
			return errors.New("订单不存在")
		}
		affectedOrderID = order.ID

		now := time.Now()
		fields := map[string]interface{}{
			"status":       terminalStatus,
			"responded_at": &now,
			"updated_at":   now,
		}
		if note != "" {
			fields["reason"] = note
		}
		if err := dispatchRepo.UpdateFormalTaskFields(task.ID, fields); err != nil {
			return err
		}
		if err := dispatchRepo.CreateFormalLog(&model.FormalDispatchLog{
			DispatchTaskID: task.ID,
			ActionType:     terminalStatus,
			OperatorUserID: operatorUserID,
			Note:           note,
		}); err != nil {
			return err
		}
		stateChanged = true
		if err := orderRepo.UpdateFields(task.OrderID, map[string]interface{}{
			"status":           "pending_dispatch",
			"dispatch_task_id": task.ID,
			"updated_at":       now,
		}); err != nil {
			return err
		}
		order.Status = "pending_dispatch"
		order.DispatchTaskID = &task.ID
		timelineNote := buildDispatchTerminalNote(terminalStatus, note)
		operatorType := "pilot"
		if terminalStatus == "expired" {
			operatorType = "system"
		} else if operatorUserID == task.ProviderUserID {
			operatorType = "owner"
		}
		if err := orderRepo.AddTimeline(&model.OrderTimeline{
			OrderID:      task.OrderID,
			Status:       "pending_dispatch",
			Note:         timelineNote,
			OperatorID:   operatorUserID,
			OperatorType: operatorType,
		}); err != nil {
			return err
		}

		nextTask, err := s.reassignOrderAfterTerminalTask(order, task, dispatchRepo, orderRepo, pilotRepo, ownerRepo, demandRepo, artifactRepo)
		if err != nil {
			return err
		}
		terminalReason = buildDispatchTerminalNote(terminalStatus, note)
		if nextTask != nil {
			reassignedTask = nextTask
			result = nextTask
			return nil
		}
		manualFallback = true

		result, err = dispatchRepo.GetFormalTaskByID(dispatchID)
		if err != nil {
			result = task
			return nil
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if stateChanged && s.eventService != nil && affectedOrderID > 0 {
		if order, err := s.orderRepo.GetByID(affectedOrderID); err == nil && order != nil {
			if reassignedTask != nil && reassignedTask.ID != dispatchID {
				s.eventService.NotifyDispatchCreated(reassignedTask, order)
				s.eventService.NotifyDispatchReassigned(order, reassignedTask, terminalReason)
			} else if manualFallback {
				s.eventService.NotifyDispatchManualRequired(order, terminalReason)
			}
		}
	}

	return result, nil
}

// CancelTask 取消任务
func (s *DispatchService) CancelTask(taskID int64, clientID int64, reason string) error {
	task, err := s.dispatchRepo.GetTaskByID(taskID)
	if err != nil {
		return errors.New("任务不存在")
	}

	if task.ClientID != clientID {
		return errors.New("无权操作此任务")
	}

	if task.Status == "assigned" || task.Status == "completed" {
		return errors.New("任务已分配或完成，无法取消")
	}

	s.dispatchRepo.UpdateTaskFields(taskID, map[string]interface{}{
		"status":      "cancelled",
		"fail_reason": reason,
	})

	s.logAction(taskID, "cancelled", "client", clientID, map[string]interface{}{
		"reason": reason,
	})

	return nil
}

// ==================== 查询接口 ====================

func (s *DispatchService) GetTask(taskID int64) (*model.DispatchTask, error) {
	return s.dispatchRepo.GetTaskByID(taskID)
}

func (s *DispatchService) GetCandidateByID(candidateID int64) (*model.DispatchCandidate, error) {
	return s.dispatchRepo.GetCandidateByID(candidateID)
}

func (s *DispatchService) UpdateTaskOrderID(taskID int64, orderID int64) {
	s.dispatchRepo.UpdateTaskFields(taskID, map[string]interface{}{"order_id": orderID})
}

func (s *DispatchService) GetTaskByNo(taskNo string) (*model.DispatchTask, error) {
	return s.dispatchRepo.GetTaskByNo(taskNo)
}

func (s *DispatchService) ListClientTasks(clientID int64, page, pageSize int, status string) ([]model.DispatchTask, int64, error) {
	return s.dispatchRepo.ListTasksByClient(clientID, page, pageSize, status)
}

func (s *DispatchService) ListPilotTasks(pilotID int64, page, pageSize int, status string) ([]model.DispatchTask, int64, error) {
	return s.dispatchRepo.ListTasksByPilot(pilotID, page, pageSize, status)
}

// ListCandidatesForPilot 获取飞手的候选任务列表（包含任务详情）
func (s *DispatchService) ListCandidatesForPilot(pilotID int64, page, pageSize int) ([]map[string]interface{}, int64, error) {
	return s.dispatchRepo.ListCandidatesByPilot(pilotID, page, pageSize)
}

func (s *DispatchService) GetCandidates(taskID int64) ([]model.DispatchCandidate, error) {
	return s.dispatchRepo.GetCandidatesByTask(taskID)
}

func (s *DispatchService) GetPendingTaskForPilot(pilotID int64) (*model.DispatchCandidate, error) {
	return s.dispatchRepo.GetPendingCandidateByPilot(pilotID)
}

func (s *DispatchService) GetTaskLogs(taskID int64) ([]model.DispatchLog, error) {
	return s.dispatchRepo.GetLogsByTask(taskID)
}

func (s *DispatchService) GetFormalTask(dispatchID int64) (*model.FormalDispatchTask, error) {
	if s.dispatchRepo == nil {
		return nil, errors.New("正式派单依赖未初始化")
	}
	return s.dispatchRepo.GetFormalTaskByID(dispatchID)
}

func (s *DispatchService) ListFormalTasksByProvider(providerUserID int64, status string, page, pageSize int) ([]model.FormalDispatchTask, int64, error) {
	if s.dispatchRepo == nil {
		return nil, 0, errors.New("正式派单依赖未初始化")
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	return s.dispatchRepo.ListFormalTasksByProvider(providerUserID, status, page, pageSize)
}

func (s *DispatchService) ListFormalTasksByPilot(pilotUserID int64, status string, page, pageSize int) ([]model.FormalDispatchTask, int64, error) {
	if s.dispatchRepo == nil {
		return nil, 0, errors.New("正式派单依赖未初始化")
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	return s.dispatchRepo.ListFormalTasksByPilot(pilotUserID, status, page, pageSize)
}

func (s *DispatchService) ListFormalTasksByOrder(orderID int64) ([]model.FormalDispatchTask, error) {
	if s.dispatchRepo == nil {
		return nil, errors.New("正式派单依赖未初始化")
	}
	return s.dispatchRepo.ListFormalTasksByOrder(orderID)
}

func (s *DispatchService) GetCurrentFormalTaskByOrder(orderID int64) (*model.FormalDispatchTask, error) {
	if s.dispatchRepo == nil {
		return nil, errors.New("正式派单依赖未初始化")
	}
	task, err := s.dispatchRepo.GetActiveFormalTaskByOrder(orderID)
	if err == nil {
		return task, nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return s.dispatchRepo.GetFormalTaskByOrderID(orderID)
	}
	return nil, err
}

func (s *DispatchService) ListFormalLogs(dispatchID int64) ([]model.FormalDispatchLog, error) {
	if s.dispatchRepo == nil {
		return nil, errors.New("正式派单依赖未初始化")
	}
	return s.dispatchRepo.ListFormalLogsByDispatchTask(dispatchID)
}

func (s *DispatchService) ManualDispatchOrder(orderID, providerUserID int64, dispatchMode string, targetPilotUserID int64, reason string) (*model.FormalDispatchTask, error) {
	if s.dispatchRepo == nil || s.orderRepo == nil || s.pilotRepo == nil {
		return nil, errors.New("正式派单依赖未初始化")
	}
	db := s.dispatchRepo.DB()
	if db == nil {
		return nil, errors.New("派单仓储未初始化")
	}

	var result *model.FormalDispatchTask
	var affectedOrderID int64
	var selfExecute bool
	err := db.Transaction(func(tx *gorm.DB) error {
		dispatchRepo := repository.NewDispatchRepo(tx)
		orderRepo := repository.NewOrderRepo(tx)
		pilotRepo := repository.NewPilotRepo(tx)
		ownerRepo := repository.NewOwnerDomainRepo(tx)
		demandRepo := repository.NewDemandDomainRepo(tx)
		artifactRepo := repository.NewOrderArtifactRepo(tx)

		order, task, isSelf, err := s.manualDispatchOrderWithRepos(orderID, providerUserID, dispatchMode, targetPilotUserID, reason, dispatchRepo, orderRepo, pilotRepo, ownerRepo, demandRepo, artifactRepo)
		if err != nil {
			return err
		}
		affectedOrderID = order.ID
		result = task
		selfExecute = isSelf
		return nil
	})
	if err != nil {
		return nil, err
	}

	if s.eventService != nil && affectedOrderID > 0 {
		if order, err := s.orderRepo.GetByID(affectedOrderID); err == nil && order != nil {
			if !selfExecute && result != nil {
				s.eventService.NotifyDispatchCreated(result, order)
			}
		}
	}

	return result, nil
}

func (s *DispatchService) ReassignFormalTask(dispatchID, providerUserID int64, dispatchMode string, targetPilotUserID int64, reason string) (*model.FormalDispatchTask, error) {
	if s.dispatchRepo == nil || s.orderRepo == nil || s.pilotRepo == nil {
		return nil, errors.New("正式派单依赖未初始化")
	}
	db := s.dispatchRepo.DB()
	if db == nil {
		return nil, errors.New("派单仓储未初始化")
	}

	var result *model.FormalDispatchTask
	var affectedOrderID int64
	var manualReason string
	err := db.Transaction(func(tx *gorm.DB) error {
		dispatchRepo := repository.NewDispatchRepo(tx)
		orderRepo := repository.NewOrderRepo(tx)
		pilotRepo := repository.NewPilotRepo(tx)
		ownerRepo := repository.NewOwnerDomainRepo(tx)
		demandRepo := repository.NewDemandDomainRepo(tx)
		artifactRepo := repository.NewOrderArtifactRepo(tx)

		task, err := dispatchRepo.GetFormalTaskByID(dispatchID)
		if err != nil {
			return errors.New("正式派单不存在")
		}
		order, err := orderRepo.GetByID(task.OrderID)
		if err != nil {
			return errors.New("订单不存在")
		}
		if order.ProviderUserID != providerUserID && order.OwnerID != providerUserID && order.DroneOwnerUserID != providerUserID {
			return errors.New("无权重派该订单")
		}
		if task.Status == "finished" || task.Status == "executing" {
			return errors.New("已完成或执行中的派单不能重派")
		}
		if order.Status == "in_transit" || order.Status == "delivered" || order.Status == "completed" {
			return errors.New("订单已进入执行阶段，不能重派")
		}

		now := time.Now()
		manualReason = firstNonEmpty(reason, "机主手动重派")
		if task.Status != "rejected" && task.Status != "expired" && task.Status != "exception" {
			if err := dispatchRepo.UpdateFormalTaskFields(task.ID, map[string]interface{}{
				"status":       "exception",
				"responded_at": &now,
				"reason":       manualReason,
				"updated_at":   now,
			}); err != nil {
				return err
			}
		}
		if err := dispatchRepo.CreateFormalLog(&model.FormalDispatchLog{
			DispatchTaskID: task.ID,
			ActionType:     "reassign",
			OperatorUserID: providerUserID,
			Note:           manualReason,
		}); err != nil {
			return err
		}
		if err := orderRepo.UpdateFields(order.ID, map[string]interface{}{
			"status":                 "pending_dispatch",
			"needs_dispatch":         true,
			"dispatch_task_id":       task.ID,
			"executor_pilot_user_id": 0,
			"pilot_id":               0,
			"updated_at":             now,
		}); err != nil {
			return err
		}
		order.Status = "pending_dispatch"
		order.NeedsDispatch = true
		order.DispatchTaskID = &task.ID
		order.ExecutorPilotUserID = 0
		order.PilotID = 0
		if err := orderRepo.AddTimeline(&model.OrderTimeline{
			OrderID:      order.ID,
			Status:       "pending_dispatch",
			Note:         "机主发起手动重派",
			OperatorID:   providerUserID,
			OperatorType: "owner",
		}); err != nil {
			return err
		}

		updatedOrder, newTask, _, err := s.manualDispatchOrderWithRepos(order.ID, providerUserID, dispatchMode, targetPilotUserID, manualReason, dispatchRepo, orderRepo, pilotRepo, ownerRepo, demandRepo, artifactRepo)
		if err != nil {
			return err
		}
		affectedOrderID = updatedOrder.ID
		result = newTask
		return nil
	})
	if err != nil {
		return nil, err
	}

	if s.eventService != nil && affectedOrderID > 0 {
		if order, err := s.orderRepo.GetByID(affectedOrderID); err == nil && order != nil {
			if result != nil {
				s.eventService.NotifyDispatchCreated(result, order)
				s.eventService.NotifyDispatchReassigned(order, result, manualReason)
			}
		}
	}

	return result, nil
}

// ==================== 后台任务处理 ====================

// ProcessPendingTasks 处理待派单任务（由定时任务调用）
func (s *DispatchService) ProcessPendingTasks() error {
	tasks, err := s.dispatchRepo.ListPendingTasks(50)
	if err != nil {
		return err
	}

	for _, task := range tasks {
		if task.MatchAttempts >= task.MaxAttempts {
			// 超过最大尝试次数
			s.dispatchRepo.UpdateTaskFields(task.ID, map[string]interface{}{
				"status":      "expired",
				"fail_reason": "超过最大匹配尝试次数",
			})
			continue
		}

		_, err := s.MatchTask(task.ID)
		if err != nil {
			s.logger.Warn("匹配任务失败", zap.Int64("task_id", task.ID), zap.Error(err))
			continue
		}

		// 通知最优候选人
		_, err = s.NotifyTopCandidate(task.ID)
		if err != nil {
			s.logger.Warn("通知候选人失败", zap.Int64("task_id", task.ID), zap.Error(err))
		}
	}

	if s.orderRepo != nil {
		orders, _, err := s.orderRepo.List(1, 100, map[string]interface{}{
			"status":         "pending_dispatch",
			"needs_dispatch": true,
		})
		if err != nil {
			return err
		}
		for i := range orders {
			if _, err := s.EnsureOrderDispatch(orders[i].ID); err != nil && s.logger != nil {
				s.logger.Warn("自动派单失败", zap.Int64("order_id", orders[i].ID), zap.Error(err))
			}
		}
	}

	return nil
}

// HandleExpiredTasks 处理过期任务
func (s *DispatchService) HandleExpiredTasks() error {
	tasks, err := s.dispatchRepo.GetExpiredTasks()
	if err != nil {
		return err
	}

	for _, task := range tasks {
		s.dispatchRepo.UpdateTaskFields(task.ID, map[string]interface{}{
			"status":      "expired",
			"fail_reason": "派单超时",
		})
		s.logAction(task.ID, "expired", "system", 0, nil)
	}

	expiredBefore := time.Now().Add(-time.Duration(s.config.ResponseTimeoutSeconds) * time.Second)
	formalTasks, err := s.dispatchRepo.ListExpiredFormalTasks(expiredBefore, 100)
	if err != nil {
		return err
	}
	for _, task := range formalTasks {
		if _, err := s.completeFormalTaskAndReassign(task.ID, 0, "expired", "正式派单响应超时"); err != nil && s.logger != nil {
			s.logger.Warn("处理正式派单超时失败", zap.Int64("dispatch_task_id", task.ID), zap.Error(err))
		}
	}

	return nil
}

// ==================== 辅助方法 ====================

func (s *DispatchService) logAction(taskID int64, action, actorType string, actorID int64, details map[string]interface{}) {
	detailsJSON, _ := json.Marshal(details)
	s.dispatchRepo.CreateLog(&model.DispatchLog{
		TaskID:    taskID,
		Action:    action,
		ActorType: actorType,
		ActorID:   actorID,
		Details:   model.JSON(detailsJSON),
	})
}

func haversineDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371 // 地球半径(km)
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

func sortCandidatesByScore(candidates []model.DispatchCandidate) {
	for i := 0; i < len(candidates); i++ {
		for j := i + 1; j < len(candidates); j++ {
			if candidates[j].TotalScore > candidates[i].TotalScore {
				candidates[i], candidates[j] = candidates[j], candidates[i]
			}
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (s *DispatchService) ensureOrderDispatchWithRepos(
	orderID int64,
	dispatchRepo *repository.DispatchRepo,
	orderRepo *repository.OrderRepo,
	pilotRepo *repository.PilotRepo,
	ownerRepo *repository.OwnerDomainRepo,
	demandRepo *repository.DemandDomainRepo,
	artifactRepo *repository.OrderArtifactRepo,
) (*model.FormalDispatchTask, bool, error) {
	order, err := orderRepo.GetByID(orderID)
	if err != nil {
		return nil, false, errors.New("订单不存在")
	}
	if order.Status != "pending_dispatch" || !order.NeedsDispatch {
		return nil, false, nil
	}
	if existing, err := dispatchRepo.GetActiveFormalTaskByOrder(order.ID); err == nil && existing != nil {
		return existing, false, nil
	}

	history, err := dispatchRepo.ListFormalTasksByOrder(order.ID)
	if err != nil {
		return nil, false, err
	}
	excluded := buildExcludedPilotSet(history)
	nextRetry := len(history)
	if nextRetry >= maxFormalDispatchRetries {
		task, err := s.markOrderManualDispatchRequired(order, dispatchRepo, orderRepo, artifactRepo, "自动重派次数已达上限，需机主手动处理")
		return task, false, err
	}

	options, err := s.collectDispatchPilotOptions(order, excluded, ownerRepo, demandRepo, pilotRepo)
	if err != nil {
		return nil, false, err
	}
	if len(options) == 0 {
		task, err := s.markOrderManualDispatchRequired(order, dispatchRepo, orderRepo, artifactRepo, "当前无可用飞手，需机主手动处理")
		return task, false, err
	}

	selected := options[0]
	now := time.Now()
	task := &model.FormalDispatchTask{
		DispatchNo:        dispatchRepo.GenerateDispatchNo(),
		OrderID:           order.ID,
		ProviderUserID:    order.ProviderUserID,
		TargetPilotUserID: selected.PilotUserID,
		DispatchSource:    selected.Source,
		RetryCount:        nextRetry,
		Status:            "pending_response",
		Reason:            selected.Reason,
		SentAt:            &now,
	}
	if err := dispatchRepo.CreateFormalTask(task); err != nil {
		return nil, false, err
	}
	if err := dispatchRepo.CreateFormalLog(&model.FormalDispatchLog{
		DispatchTaskID: task.ID,
		ActionType:     "created",
		OperatorUserID: 0,
		Note:           selected.Reason,
	}); err != nil {
		return nil, false, err
	}
	if nextRetry > 0 {
		if err := dispatchRepo.CreateFormalLog(&model.FormalDispatchLog{
			DispatchTaskID: task.ID,
			ActionType:     "reassign",
			OperatorUserID: 0,
			Note:           fmt.Sprintf("自动重派第 %d 次", nextRetry),
		}); err != nil {
			return nil, false, err
		}
	}
	if err := orderRepo.UpdateFields(order.ID, map[string]interface{}{
		"dispatch_task_id": task.ID,
		"execution_mode":   mapDispatchSourceToExecutionMode(selected.Source),
		"updated_at":       now,
	}); err != nil {
		return nil, false, err
	}
	order.DispatchTaskID = &task.ID
	order.ExecutionMode = mapDispatchSourceToExecutionMode(selected.Source)
	if err := orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      order.ID,
		Status:       "pending_dispatch",
		Note:         fmt.Sprintf("已向飞手发起正式派单：%s", selected.Reason),
		OperatorID:   0,
		OperatorType: "system",
	}); err != nil {
		return nil, false, err
	}
	if artifactRepo != nil {
		if err := repository.UpsertOrderSnapshotBundle(artifactRepo, order, nil, nil); err != nil {
			return nil, false, err
		}
	}

	return task, true, nil
}

func (s *DispatchService) reassignOrderAfterTerminalTask(
	order *model.Order,
	terminalTask *model.FormalDispatchTask,
	dispatchRepo *repository.DispatchRepo,
	orderRepo *repository.OrderRepo,
	pilotRepo *repository.PilotRepo,
	ownerRepo *repository.OwnerDomainRepo,
	demandRepo *repository.DemandDomainRepo,
	artifactRepo *repository.OrderArtifactRepo,
) (*model.FormalDispatchTask, error) {
	if order == nil {
		return nil, nil
	}
	nextTask, _, err := s.ensureOrderDispatchWithRepos(order.ID, dispatchRepo, orderRepo, pilotRepo, ownerRepo, demandRepo, artifactRepo)
	if err != nil {
		return nil, err
	}
	if nextTask == nil && terminalTask != nil {
		if err := dispatchRepo.CreateFormalLog(&model.FormalDispatchLog{
			DispatchTaskID: terminalTask.ID,
			ActionType:     "reassign",
			OperatorUserID: 0,
			Note:           "无可用替补飞手，订单回退待人工处理",
		}); err != nil {
			return nil, err
		}
	}
	return nextTask, nil
}

func (s *DispatchService) markOrderManualDispatchRequired(
	order *model.Order,
	dispatchRepo *repository.DispatchRepo,
	orderRepo *repository.OrderRepo,
	artifactRepo *repository.OrderArtifactRepo,
	note string,
) (*model.FormalDispatchTask, error) {
	if order == nil {
		return nil, nil
	}
	now := time.Now()
	if err := orderRepo.UpdateFields(order.ID, map[string]interface{}{
		"status":     "pending_dispatch",
		"updated_at": now,
	}); err != nil {
		return nil, err
	}
	order.Status = "pending_dispatch"
	latestTimeline, err := orderRepo.GetLatestTimeline(order.ID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	shouldAddTimeline := latestTimeline == nil || latestTimeline.Status != "pending_dispatch" || latestTimeline.Note != note
	if shouldAddTimeline {
		if err := orderRepo.AddTimeline(&model.OrderTimeline{
			OrderID:      order.ID,
			Status:       "pending_dispatch",
			Note:         note,
			OperatorID:   0,
			OperatorType: "system",
		}); err != nil {
			return nil, err
		}
	}
	if artifactRepo != nil {
		if err := repository.UpsertOrderSnapshotBundle(artifactRepo, order, nil, nil); err != nil {
			return nil, err
		}
	}
	return nil, nil
}

func buildExcludedPilotSet(history []model.FormalDispatchTask) map[int64]bool {
	excluded := make(map[int64]bool, len(history))
	for _, item := range history {
		if item.TargetPilotUserID == 0 {
			continue
		}
		switch item.Status {
		case "rejected", "expired", "exception", "accepted", "executing", "finished", "pending_response":
			excluded[item.TargetPilotUserID] = true
		}
	}
	return excluded
}

func (s *DispatchService) collectDispatchPilotOptions(
	order *model.Order,
	excluded map[int64]bool,
	ownerRepo *repository.OwnerDomainRepo,
	demandRepo *repository.DemandDomainRepo,
	pilotRepo *repository.PilotRepo,
) ([]dispatchPilotOption, error) {
	options := make([]dispatchPilotOption, 0)
	seen := make(map[int64]bool)

	addOption := func(option dispatchPilotOption) {
		if option.PilotUserID == 0 || excluded[option.PilotUserID] || seen[option.PilotUserID] {
			return
		}
		seen[option.PilotUserID] = true
		options = append(options, option)
	}

	if ownerRepo != nil {
		bindings, _, err := ownerRepo.ListBindingsByOwner(order.ProviderUserID, "active", 1, 100)
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		for _, binding := range bindings {
			if pilotRepo != nil {
				pilot, err := pilotRepo.GetByUserID(binding.PilotUserID)
				if err != nil || pilot == nil || pilot.VerificationStatus != "verified" || pilot.AvailabilityStatus != "online" {
					continue
				}
			}
			reason := "优先指派绑定飞手"
			if binding.IsPriority {
				reason = "优先指派重点绑定飞手"
			}
			addOption(dispatchPilotOption{
				PilotUserID:     binding.PilotUserID,
				Source:          "bound_pilot",
				Reason:          reason,
				BindingPriority: binding.IsPriority,
			})
		}
	}

	if order.DemandID > 0 && demandRepo != nil {
		candidates, err := demandRepo.ListActiveDemandCandidatesByDemand(order.DemandID)
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		for _, candidate := range candidates {
			if pilotRepo != nil {
				pilot, err := pilotRepo.GetByUserID(candidate.PilotUserID)
				if err != nil || pilot == nil || pilot.VerificationStatus != "verified" || pilot.AvailabilityStatus != "online" {
					continue
				}
			}
			addOption(dispatchPilotOption{
				PilotUserID: candidate.PilotUserID,
				Source:      "candidate_pool",
				Reason:      "优先触达该需求的候选飞手",
			})
		}
	}

	if pilotRepo != nil {
		nearbyPilots, err := pilotRepo.FindNearby(order.ServiceLatitude, order.ServiceLongitude, s.config.MaxRadiusKM, 50)
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		for _, pilot := range nearbyPilots {
			addOption(dispatchPilotOption{
				PilotUserID: pilot.UserID,
				Source:      "general_pool",
				Reason:      "扩展到普通飞手池自动派单",
				Distance:    haversineDistance(order.ServiceLatitude, order.ServiceLongitude, pilot.CurrentLatitude, pilot.CurrentLongitude),
			})
		}
	}

	sortDispatchPilotOptions(options)
	return options, nil
}

func sortDispatchPilotOptions(options []dispatchPilotOption) {
	priorityOf := func(source string) int {
		switch source {
		case "bound_pilot":
			return 0
		case "candidate_pool":
			return 1
		default:
			return 2
		}
	}
	for i := 0; i < len(options); i++ {
		for j := i + 1; j < len(options); j++ {
			left := options[i]
			right := options[j]
			swap := false
			if priorityOf(right.Source) < priorityOf(left.Source) {
				swap = true
			} else if priorityOf(right.Source) == priorityOf(left.Source) {
				if right.Source == "bound_pilot" && right.BindingPriority && !left.BindingPriority {
					swap = true
				} else if right.Source == "general_pool" && right.Distance < left.Distance {
					swap = true
				}
			}
			if swap {
				options[i], options[j] = options[j], options[i]
			}
		}
	}
}

func mapDispatchSourceToExecutionMode(source string) string {
	if source == "bound_pilot" {
		return "bound_pilot"
	}
	return "dispatch_pool"
}

func buildDispatchTerminalNote(status, note string) string {
	base := "正式派单已结束"
	switch status {
	case "rejected":
		base = "飞手拒绝正式派单"
	case "expired":
		base = "正式派单已超时"
	case "exception":
		base = "正式派单出现异常"
	}
	if note == "" {
		return base
	}
	return base + "：" + note
}

func (s *DispatchService) manualDispatchOrderWithRepos(
	orderID, providerUserID int64,
	dispatchMode string,
	targetPilotUserID int64,
	reason string,
	dispatchRepo *repository.DispatchRepo,
	orderRepo *repository.OrderRepo,
	pilotRepo *repository.PilotRepo,
	ownerRepo *repository.OwnerDomainRepo,
	demandRepo *repository.DemandDomainRepo,
	artifactRepo *repository.OrderArtifactRepo,
) (*model.Order, *model.FormalDispatchTask, bool, error) {
	order, err := orderRepo.GetByID(orderID)
	if err != nil {
		return nil, nil, false, errors.New("订单不存在")
	}
	if order.ProviderUserID != providerUserID && order.OwnerID != providerUserID && order.DroneOwnerUserID != providerUserID {
		return nil, nil, false, errors.New("无权派发该订单")
	}
	if order.Status != "pending_dispatch" {
		return nil, nil, false, errors.New("当前订单状态不允许发起派单")
	}

	dispatchMode = normalizeManualDispatchMode(dispatchMode)
	if dispatchMode == "" {
		return nil, nil, false, errors.New("无效的派单方式")
	}

	if dispatchMode == "self_execute" {
		pilot, err := pilotRepo.GetByUserID(providerUserID)
		if err != nil || pilot == nil {
			return nil, nil, false, errors.New("机主尚未具备可执行的飞手身份")
		}
		if pilot.VerificationStatus != "verified" {
			return nil, nil, false, errors.New("机主飞手资质尚未审核通过，不能自执行")
		}

		now := time.Now()
		if err := orderRepo.UpdateFields(order.ID, map[string]interface{}{
			"status":                 "assigned",
			"needs_dispatch":         false,
			"dispatch_task_id":       nil,
			"executor_pilot_user_id": providerUserID,
			"pilot_id":               pilot.ID,
			"execution_mode":         "self_execute",
			"updated_at":             now,
		}); err != nil {
			return nil, nil, false, err
		}
		order.Status = "assigned"
		order.NeedsDispatch = false
		order.DispatchTaskID = nil
		order.ExecutorPilotUserID = providerUserID
		order.PilotID = pilot.ID
		order.ExecutionMode = "self_execute"
		if err := orderRepo.AddTimeline(&model.OrderTimeline{
			OrderID:      order.ID,
			Status:       "assigned",
			Note:         firstNonEmpty(reason, "机主选择自执行，订单进入已分配"),
			OperatorID:   providerUserID,
			OperatorType: "owner",
		}); err != nil {
			return nil, nil, false, err
		}
		if artifactRepo != nil {
			if err := repository.UpsertOrderSnapshotBundle(artifactRepo, order, nil, nil); err != nil {
				return nil, nil, false, err
			}
		}
		return order, nil, true, nil
	}

	if existing, err := dispatchRepo.GetActiveFormalTaskByOrder(order.ID); err == nil && existing != nil {
		return nil, nil, false, errors.New("当前订单已有生效中的正式派单，请使用重派接口")
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, false, err
	}

	option, err := s.selectManualDispatchOption(order, dispatchMode, targetPilotUserID, ownerRepo, demandRepo, pilotRepo)
	if err != nil {
		return nil, nil, false, err
	}

	now := time.Now()
	history, err := dispatchRepo.ListFormalTasksByOrder(order.ID)
	if err != nil {
		return nil, nil, false, err
	}
	task := &model.FormalDispatchTask{
		DispatchNo:        dispatchRepo.GenerateDispatchNo(),
		OrderID:           order.ID,
		ProviderUserID:    order.ProviderUserID,
		TargetPilotUserID: option.PilotUserID,
		DispatchSource:    option.Source,
		RetryCount:        len(history),
		Status:            "pending_response",
		Reason:            firstNonEmpty(reason, option.Reason),
		SentAt:            &now,
	}
	if err := dispatchRepo.CreateFormalTask(task); err != nil {
		return nil, nil, false, err
	}
	if err := dispatchRepo.CreateFormalLog(&model.FormalDispatchLog{
		DispatchTaskID: task.ID,
		ActionType:     "created",
		OperatorUserID: providerUserID,
		Note:           firstNonEmpty(reason, option.Reason),
	}); err != nil {
		return nil, nil, false, err
	}
	if err := dispatchRepo.CreateFormalLog(&model.FormalDispatchLog{
		DispatchTaskID: task.ID,
		ActionType:     "manual_dispatch",
		OperatorUserID: providerUserID,
		Note:           fmt.Sprintf("机主手动派单，方式=%s", dispatchMode),
	}); err != nil {
		return nil, nil, false, err
	}
	if err := orderRepo.UpdateFields(order.ID, map[string]interface{}{
		"dispatch_task_id": task.ID,
		"needs_dispatch":   true,
		"execution_mode":   mapDispatchSourceToExecutionMode(option.Source),
		"updated_at":       now,
	}); err != nil {
		return nil, nil, false, err
	}
	order.DispatchTaskID = &task.ID
	order.NeedsDispatch = true
	order.ExecutionMode = mapDispatchSourceToExecutionMode(option.Source)
	if err := orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      order.ID,
		Status:       "pending_dispatch",
		Note:         fmt.Sprintf("机主手动派单：%s", firstNonEmpty(reason, option.Reason)),
		OperatorID:   providerUserID,
		OperatorType: "owner",
	}); err != nil {
		return nil, nil, false, err
	}
	if artifactRepo != nil {
		if err := repository.UpsertOrderSnapshotBundle(artifactRepo, order, nil, nil); err != nil {
			return nil, nil, false, err
		}
	}

	created, err := dispatchRepo.GetFormalTaskByID(task.ID)
	if err != nil {
		return order, task, false, nil
	}
	return order, created, false, nil
}

func (s *DispatchService) selectManualDispatchOption(
	order *model.Order,
	dispatchMode string,
	targetPilotUserID int64,
	ownerRepo *repository.OwnerDomainRepo,
	demandRepo *repository.DemandDomainRepo,
	pilotRepo *repository.PilotRepo,
) (*dispatchPilotOption, error) {
	if order == nil {
		return nil, errors.New("订单不存在")
	}

	options, err := s.collectDispatchPilotOptions(order, map[int64]bool{}, ownerRepo, demandRepo, pilotRepo)
	if err != nil {
		return nil, err
	}
	filtered := make([]dispatchPilotOption, 0, len(options))
	for _, option := range options {
		if dispatchMode != option.Source {
			continue
		}
		if targetPilotUserID > 0 && option.PilotUserID != targetPilotUserID {
			continue
		}
		filtered = append(filtered, option)
	}
	if len(filtered) == 0 {
		switch dispatchMode {
		case "bound_pilot":
			return nil, errors.New("未找到可用的绑定飞手")
		case "candidate_pool":
			return nil, errors.New("未找到可用的候选飞手")
		default:
			return nil, errors.New("未找到可用的普通飞手")
		}
	}
	return &filtered[0], nil
}

func normalizeManualDispatchMode(mode string) string {
	switch mode {
	case "self_execute", "bound_pilot", "candidate_pool", "general_pool":
		return mode
	default:
		return ""
	}
}
