package service

import (
	"encoding/json"
	"errors"
	"math"
	"time"

	"go.uber.org/zap"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

const (
	maxSegmentGapSeconds = 120.0
	maxSegmentSpeedMPS   = 60.0
)

type PilotService struct {
	pilotRepo *repository.PilotRepo
	userRepo  *repository.UserRepo
	logger    *zap.Logger
}

func NewPilotService(pilotRepo *repository.PilotRepo, userRepo *repository.UserRepo, logger *zap.Logger) *PilotService {
	return &PilotService{
		pilotRepo: pilotRepo,
		userRepo:  userRepo,
		logger:    logger,
	}
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

	if err := s.pilotRepo.Create(pilot); err != nil {
		return nil, err
	}

	// 更新用户类型为飞手
	if err := s.userRepo.UpdateFields(userID, map[string]interface{}{"user_type": "pilot"}); err != nil {
		s.logger.Warn("Failed to update user type", zap.Error(err))
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
	return s.pilotRepo.UpdateFields(pilotID, fields)
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

	return s.pilotRepo.UpdateAvailability(pilotID, status)
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

	return s.pilotRepo.UpdateFields(pilotID, fields)
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
	logs, total, err := s.pilotRepo.GetFlightLogsByPilotID(pilotID, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	if total > 0 {
		return logs, total, nil
	}

	autoLogs, err := s.buildAutoFlightLogs(pilotID)
	if err != nil {
		return nil, 0, err
	}
	if len(autoLogs) == 0 {
		return logs, total, nil
	}

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	start := (page - 1) * pageSize
	if start >= len(autoLogs) {
		return []model.PilotFlightLog{}, int64(len(autoLogs)), nil
	}
	end := start + pageSize
	if end > len(autoLogs) {
		end = len(autoLogs)
	}
	return autoLogs[start:end], int64(len(autoLogs)), nil
}

// GetFlightStats 获取飞行统计
func (s *PilotService) GetFlightStats(pilotID int64) (map[string]interface{}, error) {
	autoLogs, err := s.buildAutoFlightLogs(pilotID)
	if err != nil {
		return nil, err
	}
	if len(autoLogs) > 0 {
		totalFlights := len(autoLogs)
		totalMinutes := 0.0
		totalDistance := 0.0
		maxAltitude := 0.0
		for _, log := range autoLogs {
			totalMinutes += log.FlightDuration
			totalDistance += log.FlightDistance
			if log.MaxAltitude > maxAltitude {
				maxAltitude = log.MaxAltitude
			}
		}
		totalHours := totalMinutes / 60.0
		avgDuration := 0.0
		if totalFlights > 0 {
			avgDuration = totalMinutes / float64(totalFlights)
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

	totalHours, totalDistance, totalFlights, maxAltitude, err := s.pilotRepo.GetFlightStatsByPilotID(pilotID)
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

func (s *PilotService) buildAutoFlightLogs(pilotID int64) ([]model.PilotFlightLog, error) {
	seeds, err := s.pilotRepo.ListCompletedOrderFlightSeedsByPilotID(pilotID)
	if err != nil {
		return nil, err
	}
	if len(seeds) == 0 {
		return []model.PilotFlightLog{}, nil
	}

	logs := make([]model.PilotFlightLog, 0, len(seeds))
	for _, seed := range seeds {
		positions, err := s.pilotRepo.ListFlightPositionsByOrderID(seed.OrderID)
		if err != nil {
			return nil, err
		}
		durationSec, distanceMeters, maxAlt := calcFlightMetricsFromPositions(positions)

		// 订单端显式起降时间作为兜底，仅在同时存在时才使用，避免把“已完成到结算”的长间隔算入飞行时长。
		if durationSec == 0 && seed.FlightStartAt != nil && seed.FlightEndAt != nil && seed.FlightEndAt.After(*seed.FlightStartAt) {
			durationSec = int64(seed.FlightEndAt.Sub(*seed.FlightStartAt).Seconds())
		}

		task, err := s.pilotRepo.FindDispatchTaskForOrder(
			pilotID,
			seed.OrderID,
			seed.DispatchTaskID,
			seed.ServiceAddress,
			seed.OrderCreatedAt,
		)
		if err != nil {
			return nil, err
		}

		distanceKM := distanceMeters / 1000.0
		if task != nil && task.FlightDistance > 0 {
			distanceKM = task.FlightDistance
		}

		startAddress := seed.ServiceAddress
		endAddress := seed.DestAddress
		if task != nil {
			if task.PickupAddress != "" {
				startAddress = task.PickupAddress
			}
			if task.DeliveryAddress != "" {
				endAddress = task.DeliveryAddress
			}
		}

		flightDate := seed.OrderUpdatedAt
		if seed.FlightEndAt != nil {
			flightDate = *seed.FlightEndAt
		} else if seed.FlightStartAt != nil {
			flightDate = *seed.FlightStartAt
		}

		logs = append(logs, model.PilotFlightLog{
			ID:             -seed.OrderID,
			PilotID:        pilotID,
			OrderID:        seed.OrderID,
			FlightDate:     flightDate,
			FlightDuration: float64(durationSec) / 60.0,
			FlightDistance: distanceKM,
			StartAddress:   startAddress,
			EndAddress:     endAddress,
			MaxAltitude:    float64(maxAlt),
			FlightType:     "cargo",
			CreatedAt:      seed.OrderUpdatedAt,
			IncidentReport: "由订单执行与飞行监控数据自动生成",
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
	// 检查是否已绑定
	bound, err := s.pilotRepo.CheckBinding(pilotID, droneID)
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

	return s.pilotRepo.CreateBinding(binding)
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
	return s.pilotRepo.RevokeBinding(bindingID)
}

// ==================== 辅助函数 ====================

func mustMarshalJSON(v interface{}) []byte {
	data, _ := json.Marshal(v)
	return data
}
