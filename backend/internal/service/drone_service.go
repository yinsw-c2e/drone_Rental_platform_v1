package service

import (
	"errors"
	"time"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type DroneService struct {
	droneRepo *repository.DroneRepo
}

func NewDroneService(droneRepo *repository.DroneRepo) *DroneService {
	return &DroneService{droneRepo: droneRepo}
}

func (s *DroneService) Create(drone *model.Drone) error {
	return s.droneRepo.Create(drone)
}

func (s *DroneService) GetByID(id int64) (*model.Drone, error) {
	return s.droneRepo.GetByID(id)
}

func (s *DroneService) Update(userID int64, drone *model.Drone) error {
	existing, err := s.droneRepo.GetByID(drone.ID)
	if err != nil {
		return err
	}
	if existing.OwnerID != userID {
		return errors.New("无权修改此无人机")
	}
	return s.droneRepo.Update(drone)
}

func (s *DroneService) Delete(userID, droneID int64) error {
	existing, err := s.droneRepo.GetByID(droneID)
	if err != nil {
		return err
	}
	if existing.OwnerID != userID {
		return errors.New("无权删除此无人机")
	}
	return s.droneRepo.Delete(droneID)
}

func (s *DroneService) ListByOwner(ownerID int64, page, pageSize int) ([]model.Drone, int64, error) {
	return s.droneRepo.ListByOwner(ownerID, page, pageSize)
}

func (s *DroneService) List(page, pageSize int, filters map[string]interface{}) ([]model.Drone, int64, error) {
	return s.droneRepo.List(page, pageSize, filters)
}

func (s *DroneService) FindNearby(lat, lng, radius float64, page, pageSize int) ([]model.Drone, int64, error) {
	if radius <= 0 {
		radius = 50 // default 50km
	}
	return s.droneRepo.FindNearby(lat, lng, radius, page, pageSize)
}

func (s *DroneService) UpdateAvailability(userID, droneID int64, status string) error {
	existing, err := s.droneRepo.GetByID(droneID)
	if err != nil {
		return err
	}
	if existing.OwnerID != userID {
		return errors.New("无权操作此无人机")
	}
	return s.droneRepo.UpdateFields(droneID, map[string]interface{}{"availability_status": status})
}

func (s *DroneService) SubmitCertification(userID, droneID int64, docs model.JSON) error {
	existing, err := s.droneRepo.GetByID(droneID)
	if err != nil {
		return err
	}
	if existing.OwnerID != userID {
		return errors.New("无权操作此无人机")
	}
	return s.droneRepo.UpdateFields(droneID, map[string]interface{}{
		"certification_docs":   docs,
		"certification_status": "pending",
	})
}

func (s *DroneService) ApproveCertification(droneID int64, approved bool) error {
	status := "approved"
	if !approved {
		status = "rejected"
	}
	return s.droneRepo.UpdateFields(droneID, map[string]interface{}{"certification_status": status})
}

// ==================== UOM平台登记 ====================

// SubmitUOMRegistrationReq UOM登记请求
type SubmitUOMRegistrationReq struct {
	RegistrationNo  string `json:"registration_no" binding:"required"`
	RegistrationDoc string `json:"registration_doc" binding:"required"`
}

// SubmitUOMRegistration 提交UOM平台登记
func (s *DroneService) SubmitUOMRegistration(userID, droneID int64, req *SubmitUOMRegistrationReq) error {
	existing, err := s.droneRepo.GetByID(droneID)
	if err != nil {
		return err
	}
	if existing.OwnerID != userID {
		return errors.New("无权操作此无人机")
	}
	return s.droneRepo.UpdateFields(droneID, map[string]interface{}{
		"uom_registration_no":  req.RegistrationNo,
		"uom_registration_doc": req.RegistrationDoc,
		"uom_verified":         "pending",
	})
}

// ApproveUOMRegistration 审核UOM登记 (管理端)
func (s *DroneService) ApproveUOMRegistration(droneID int64, approved bool) error {
	status := "verified"
	fields := map[string]interface{}{"uom_verified": status}
	if !approved {
		status = "rejected"
		fields["uom_verified"] = status
	} else {
		now := time.Now()
		fields["uom_verified_at"] = &now
	}
	return s.droneRepo.UpdateFields(droneID, fields)
}

// ==================== 保险信息 ====================

// SubmitInsuranceReq 保险信息请求
type SubmitInsuranceReq struct {
	PolicyNo         string     `json:"policy_no" binding:"required"`
	InsuranceCompany string     `json:"insurance_company" binding:"required"`
	CoverageAmount   int64      `json:"coverage_amount" binding:"required"` // 保额(分)，要求≥500万=50000000分
	ExpireDate       *time.Time `json:"expire_date" binding:"required"`
	InsuranceDoc     string     `json:"insurance_doc" binding:"required"`
}

// SubmitInsurance 提交保险信息
func (s *DroneService) SubmitInsurance(userID, droneID int64, req *SubmitInsuranceReq) error {
	existing, err := s.droneRepo.GetByID(droneID)
	if err != nil {
		return err
	}
	if existing.OwnerID != userID {
		return errors.New("无权操作此无人机")
	}

	// 检查保额是否满足要求 (≥500万)
	minCoverage := int64(50000000) // 500万分
	if req.CoverageAmount < minCoverage {
		return errors.New("第三者责任险保额必须≥500万元")
	}

	return s.droneRepo.UpdateFields(droneID, map[string]interface{}{
		"insurance_policy_no":   req.PolicyNo,
		"insurance_company":     req.InsuranceCompany,
		"insurance_coverage":    req.CoverageAmount,
		"insurance_expire_date": req.ExpireDate,
		"insurance_doc":         req.InsuranceDoc,
		"insurance_verified":    "pending",
	})
}

// ApproveInsurance 审核保险信息 (管理端)
func (s *DroneService) ApproveInsurance(droneID int64, approved bool) error {
	status := "verified"
	if !approved {
		status = "rejected"
	}
	return s.droneRepo.UpdateFields(droneID, map[string]interface{}{"insurance_verified": status})
}

// ==================== 适航证书 ====================

// SubmitAirworthinessReq 适航证书请求
type SubmitAirworthinessReq struct {
	CertNo     string     `json:"cert_no" binding:"required"`
	ExpireDate *time.Time `json:"expire_date" binding:"required"`
	CertDoc    string     `json:"cert_doc" binding:"required"`
}

// SubmitAirworthiness 提交适航证书
func (s *DroneService) SubmitAirworthiness(userID, droneID int64, req *SubmitAirworthinessReq) error {
	existing, err := s.droneRepo.GetByID(droneID)
	if err != nil {
		return err
	}
	if existing.OwnerID != userID {
		return errors.New("无权操作此无人机")
	}
	return s.droneRepo.UpdateFields(droneID, map[string]interface{}{
		"airworthiness_cert_no":     req.CertNo,
		"airworthiness_cert_expire": req.ExpireDate,
		"airworthiness_cert_doc":    req.CertDoc,
		"airworthiness_verified":    "pending",
	})
}

// ApproveAirworthiness 审核适航证书 (管理端)
func (s *DroneService) ApproveAirworthiness(droneID int64, approved bool) error {
	status := "verified"
	if !approved {
		status = "rejected"
	}
	return s.droneRepo.UpdateFields(droneID, map[string]interface{}{"airworthiness_verified": status})
}

// ==================== 维护记录 ====================

// AddMaintenanceReq 添加维护记录请求
type AddMaintenanceReq struct {
	MaintenanceType     string     `json:"maintenance_type" binding:"required"` // routine, repair, upgrade
	MaintenanceDate     time.Time  `json:"maintenance_date" binding:"required"`
	MaintenanceContent  string     `json:"maintenance_content"`
	MaintenanceCost     int64      `json:"maintenance_cost"`
	TechnicianName      string     `json:"technician_name"`
	TechnicianCert      string     `json:"technician_cert"`
	PartsReplaced       []string   `json:"parts_replaced"`
	BeforeImages        []string   `json:"before_images"`
	AfterImages         []string   `json:"after_images"`
	ReportDoc           string     `json:"report_doc"`
	NextMaintenanceDate *time.Time `json:"next_maintenance_date"`
}

// AddMaintenanceLog 添加维护记录
func (s *DroneService) AddMaintenanceLog(userID, droneID int64, req *AddMaintenanceReq) (*model.DroneMaintenanceLog, error) {
	existing, err := s.droneRepo.GetByID(droneID)
	if err != nil {
		return nil, err
	}
	if existing.OwnerID != userID {
		return nil, errors.New("无权操作此无人机")
	}

	log := &model.DroneMaintenanceLog{
		DroneID:             droneID,
		MaintenanceType:     req.MaintenanceType,
		MaintenanceDate:     req.MaintenanceDate,
		MaintenanceContent:  req.MaintenanceContent,
		MaintenanceCost:     req.MaintenanceCost,
		TechnicianName:      req.TechnicianName,
		TechnicianCert:      req.TechnicianCert,
		ReportDoc:           req.ReportDoc,
		NextMaintenanceDate: req.NextMaintenanceDate,
	}

	if err := s.droneRepo.CreateMaintenanceLog(log); err != nil {
		return nil, err
	}

	// 更新无人机的维护日期
	updates := map[string]interface{}{
		"last_maintenance_date": req.MaintenanceDate,
	}
	if req.NextMaintenanceDate != nil {
		updates["next_maintenance_date"] = req.NextMaintenanceDate
	}
	s.droneRepo.UpdateFields(droneID, updates)

	return log, nil
}

// GetMaintenanceLogs 获取维护记录
func (s *DroneService) GetMaintenanceLogs(droneID int64, page, pageSize int) ([]model.DroneMaintenanceLog, int64, error) {
	return s.droneRepo.GetMaintenanceLogs(droneID, page, pageSize)
}

// ==================== 综合认证状态检查 ====================

// GetCertificationStatus 获取无人机综合认证状态
func (s *DroneService) GetCertificationStatus(droneID int64) (map[string]interface{}, error) {
	drone, err := s.droneRepo.GetByID(droneID)
	if err != nil {
		return nil, err
	}

	// 检查各项认证是否完整
	isFullyVerified := drone.CertificationStatus == "approved" &&
		drone.UOMVerified == "verified" &&
		drone.InsuranceVerified == "verified" &&
		drone.AirworthinessVerified == "verified"

	// 检查保险是否过期
	insuranceValid := drone.InsuranceExpireDate != nil && drone.InsuranceExpireDate.After(time.Now())

	// 检查适航证书是否过期
	airworthinessValid := drone.AirworthinessCertExpire != nil && drone.AirworthinessCertExpire.After(time.Now())

	return map[string]interface{}{
		"drone_id":               droneID,
		"basic_certification":    drone.CertificationStatus,
		"uom_verified":           drone.UOMVerified,
		"insurance_verified":     drone.InsuranceVerified,
		"insurance_valid":        insuranceValid,
		"insurance_expire_date":  drone.InsuranceExpireDate,
		"insurance_coverage":     drone.InsuranceCoverage,
		"airworthiness_verified": drone.AirworthinessVerified,
		"airworthiness_valid":    airworthinessValid,
		"airworthiness_expire":   drone.AirworthinessCertExpire,
		"is_fully_certified":     isFullyVerified && insuranceValid && airworthinessValid,
		"can_accept_orders":      isFullyVerified && insuranceValid && airworthinessValid && drone.AvailabilityStatus == "available",
	}, nil
}
