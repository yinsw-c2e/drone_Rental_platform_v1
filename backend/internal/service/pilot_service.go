package service

import (
	"encoding/json"
	"errors"
	"time"

	"go.uber.org/zap"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
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
	CAACLicenseNo   string     `json:"caac_license_no" binding:"required"`
	CAACLicenseType string     `json:"caac_license_type" binding:"required"` // VLOS, BVLOS, instructor
	CAACLicenseExpireDate *time.Time `json:"caac_license_expire_date"`
	CAACLicenseImage string    `json:"caac_license_image" binding:"required"`
	ServiceRadius   float64    `json:"service_radius"`
	SpecialSkills   []string   `json:"special_skills"`
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
	return s.pilotRepo.GetFlightLogsByPilotID(pilotID, page, pageSize)
}

// GetFlightStats 获取飞行统计
func (s *PilotService) GetFlightStats(pilotID int64) (map[string]interface{}, error) {
	totalHours, totalDistance, totalFlights, err := s.pilotRepo.GetFlightStatsByPilotID(pilotID)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"total_flight_hours":    totalHours,
		"total_flight_distance": totalDistance,
		"total_flights":         totalFlights,
	}, nil
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
