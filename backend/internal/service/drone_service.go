package service

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type DroneService struct {
	droneRepo       *repository.DroneRepo
	roleProfileRepo *repository.RoleProfileRepo
	ownerDomainRepo *repository.OwnerDomainRepo
	eventService    *EventService
}

func NewDroneService(
	droneRepo *repository.DroneRepo,
	roleProfileRepo *repository.RoleProfileRepo,
	ownerDomainRepo *repository.OwnerDomainRepo,
) *DroneService {
	return &DroneService{
		droneRepo:       droneRepo,
		roleProfileRepo: roleProfileRepo,
		ownerDomainRepo: ownerDomainRepo,
	}
}

func (s *DroneService) SetEventService(eventService *EventService) {
	s.eventService = eventService
}

func (s *DroneService) Create(drone *model.Drone) error {
	if drone == nil {
		return errors.New("无人机参数不能为空")
	}

	s.normalizeCapacityFields(drone)

	db := s.droneRepo.DB()
	if db == nil {
		return errors.New("无人机仓储未初始化")
	}

	return db.Transaction(func(tx *gorm.DB) error {
		droneRepo := repository.NewDroneRepo(tx)
		if err := droneRepo.Create(drone); err != nil {
			return err
		}
		if s.ownerDomainRepo != nil {
			if err := repository.NewOwnerDomainRepo(tx).SyncSupplyCapabilityByDrone(drone); err != nil {
				return err
			}
		}
		if s.roleProfileRepo == nil || drone.OwnerID == 0 {
			return nil
		}
		roleProfileRepo := repository.NewRoleProfileRepo(tx)
		return roleProfileRepo.EnsureOwnerProfile(&model.OwnerProfile{
			UserID:             drone.OwnerID,
			VerificationStatus: "pending",
			Status:             "active",
			ServiceCity:        drone.City,
		})
	})
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
	s.normalizeCapacityFields(drone)

	// 保留不可变字段，防止前端传零值覆盖
	drone.OwnerID = existing.OwnerID
	drone.CreatedAt = existing.CreatedAt

	// 核心字段变更时重置审核状态，防止通过审核后篡改关键参数
	coreFieldChanged := existing.Brand != drone.Brand ||
		existing.Model != drone.Model ||
		existing.SerialNumber != drone.SerialNumber ||
		existing.MTOWKG != drone.MTOWKG ||
		existing.MaxPayloadKG != drone.MaxPayloadKG
	if coreFieldChanged && existing.CertificationStatus == "approved" {
		drone.CertificationStatus = "pending"
	}

	db := s.droneRepo.DB()
	if db == nil {
		return s.droneRepo.Update(drone)
	}

	return db.Transaction(func(tx *gorm.DB) error {
		droneRepo := repository.NewDroneRepo(tx)
		if err := droneRepo.Update(drone); err != nil {
			return err
		}
		if s.ownerDomainRepo != nil {
			return repository.NewOwnerDomainRepo(tx).SyncSupplyCapabilityByDrone(drone)
		}
		return nil
	})
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
	db := s.droneRepo.DB()
	if db == nil {
		return s.droneRepo.UpdateFields(droneID, map[string]interface{}{"availability_status": status})
	}

	return db.Transaction(func(tx *gorm.DB) error {
		droneRepo := repository.NewDroneRepo(tx)
		if err := droneRepo.UpdateFields(droneID, map[string]interface{}{"availability_status": status}); err != nil {
			return err
		}
		if s.ownerDomainRepo != nil {
			existing.AvailabilityStatus = status
			return repository.NewOwnerDomainRepo(tx).SyncSupplyCapabilityByDrone(existing)
		}
		return nil
	})
}

func (s *DroneService) SubmitCertification(userID, droneID int64, docs model.JSON) error {
	existing, err := s.droneRepo.GetByID(droneID)
	if err != nil {
		return err
	}
	if existing.OwnerID != userID {
		return errors.New("无权操作此无人机")
	}
	return s.updateCertificationDrivenSupplyStatus(droneID, map[string]interface{}{
		"certification_docs":   docs,
		"certification_status": "pending",
	})
}

func (s *DroneService) ApproveCertification(droneID int64, approved bool) error {
	status := "approved"
	if !approved {
		status = "rejected"
	}
	if err := s.updateCertificationDrivenSupplyStatus(droneID, map[string]interface{}{"certification_status": status}); err != nil {
		return err
	}
	s.notifyDroneQualificationResult(droneID, "drone_certification_reviewed", "无人机资质审核结果", approved, "无人机资质审核已通过。", "无人机资质审核未通过，请检查后重新提交。")
	return nil
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
	return s.updateCertificationDrivenSupplyStatus(droneID, map[string]interface{}{
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
	if err := s.updateCertificationDrivenSupplyStatus(droneID, fields); err != nil {
		return err
	}
	s.notifyDroneQualificationResult(droneID, "drone_uom_reviewed", "UOM 登记审核结果", approved, "UOM 登记已审核通过。", "UOM 登记审核未通过，请检查后重新提交。")
	return nil
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

	return s.updateCertificationDrivenSupplyStatus(droneID, map[string]interface{}{
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
	if err := s.updateCertificationDrivenSupplyStatus(droneID, map[string]interface{}{"insurance_verified": status}); err != nil {
		return err
	}
	s.notifyDroneQualificationResult(droneID, "drone_insurance_reviewed", "保险审核结果", approved, "无人机保险审核已通过。", "无人机保险审核未通过，请检查后重新提交。")
	return nil
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
	return s.updateCertificationDrivenSupplyStatus(droneID, map[string]interface{}{
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
	if err := s.updateCertificationDrivenSupplyStatus(droneID, map[string]interface{}{"airworthiness_verified": status}); err != nil {
		return err
	}
	s.notifyDroneQualificationResult(droneID, "drone_airworthiness_reviewed", "适航审核结果", approved, "无人机适航审核已通过。", "无人机适航审核未通过，请检查后重新提交。")
	return nil
}

func (s *DroneService) normalizeCapacityFields(drone *model.Drone) {
	if drone == nil {
		return
	}
	if drone.MaxPayloadKG <= 0 && drone.MaxLoad > 0 {
		drone.MaxPayloadKG = drone.MaxLoad
	}
	if drone.MaxLoad <= 0 && drone.MaxPayloadKG > 0 {
		drone.MaxLoad = drone.MaxPayloadKG
	}
}

func (s *DroneService) updateCertificationDrivenSupplyStatus(droneID int64, fields map[string]interface{}) error {
	db := s.droneRepo.DB()
	if db == nil {
		return s.droneRepo.UpdateFields(droneID, fields)
	}

	return db.Transaction(func(tx *gorm.DB) error {
		droneRepo := repository.NewDroneRepo(tx)
		if err := droneRepo.UpdateFields(droneID, fields); err != nil {
			return err
		}
		if s.ownerDomainRepo != nil {
			drone, err := droneRepo.GetByID(droneID)
			if err != nil {
				return err
			}
			s.normalizeCapacityFields(drone)
			return repository.NewOwnerDomainRepo(tx).SyncSupplyCapabilityByDrone(drone)
		}
		return nil
	})
}

func (s *DroneService) notifyDroneQualificationResult(droneID int64, eventType, title string, approved bool, successContent, rejectedContent string) {
	if s.eventService == nil {
		return
	}
	drone, err := s.droneRepo.GetByID(droneID)
	if err != nil || drone == nil {
		return
	}
	s.normalizeCapacityFields(drone)
	content := successContent
	if !approved {
		content = rejectedContent
	}
	s.eventService.NotifyDroneQualification(drone, eventType, title, content)
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
