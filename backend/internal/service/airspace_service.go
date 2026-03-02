package service

import (
	"fmt"
	"time"

	"go.uber.org/zap"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type AirspaceService struct {
	airspaceRepo *repository.AirspaceRepo
	pilotRepo    *repository.PilotRepo
	droneRepo    *repository.DroneRepo
	orderRepo    *repository.OrderRepo
	logger       *zap.Logger
}

func NewAirspaceService(
	airspaceRepo *repository.AirspaceRepo,
	pilotRepo *repository.PilotRepo,
	droneRepo *repository.DroneRepo,
	orderRepo *repository.OrderRepo,
	logger *zap.Logger,
) *AirspaceService {
	return &AirspaceService{
		airspaceRepo: airspaceRepo,
		pilotRepo:    pilotRepo,
		droneRepo:    droneRepo,
		orderRepo:    orderRepo,
		logger:       logger,
	}
}

// ========== Airspace Applications ==========

func (s *AirspaceService) CreateApplication(app *model.AirspaceApplication) error {
	app.Status = "draft"
	return s.airspaceRepo.CreateApplication(app)
}

func (s *AirspaceService) GetApplication(id int64) (*model.AirspaceApplication, error) {
	return s.airspaceRepo.GetApplicationByID(id)
}

func (s *AirspaceService) GetApplicationByOrder(orderID int64) (*model.AirspaceApplication, error) {
	return s.airspaceRepo.GetApplicationByOrderID(orderID)
}

func (s *AirspaceService) ListPilotApplications(pilotID int64, page, pageSize int) ([]model.AirspaceApplication, int64, error) {
	return s.airspaceRepo.ListByPilot(pilotID, page, pageSize)
}

func (s *AirspaceService) ListPendingReview(page, pageSize int) ([]model.AirspaceApplication, int64, error) {
	return s.airspaceRepo.ListPendingReview(page, pageSize)
}

// SubmitForReview 提交空域申请进入审核
func (s *AirspaceService) SubmitForReview(id int64, pilotID int64) error {
	app, err := s.airspaceRepo.GetApplicationByID(id)
	if err != nil {
		return fmt.Errorf("申请不存在")
	}
	if app.PilotID != pilotID {
		return fmt.Errorf("无权操作此申请")
	}
	if app.Status != "draft" {
		return fmt.Errorf("当前状态不允许提交审核")
	}

	// Run compliance check before submitting
	check, err := s.RunComplianceCheck(app.PilotID, app.DroneID, app.OrderID, app.ID, "airspace_apply")
	if err != nil {
		s.logger.Warn("合规检查执行失败", zap.Error(err))
	}

	if check != nil {
		if err := s.airspaceRepo.SetComplianceResult(id, check.ID, check.OverallResult == "passed", check.Notes); err != nil {
			s.logger.Warn("更新合规检查结果失败", zap.Error(err))
		}
		if check.OverallResult == "failed" {
			return fmt.Errorf("合规检查未通过，请先解决以下问题: %s", check.Notes)
		}
	}

	return s.airspaceRepo.UpdateStatus(id, "pending_review", 0, "")
}

// ReviewApplication 管理员审核空域申请
func (s *AirspaceService) ReviewApplication(id int64, adminID int64, approved bool, notes string) error {
	app, err := s.airspaceRepo.GetApplicationByID(id)
	if err != nil {
		return fmt.Errorf("申请不存在")
	}
	if app.Status != "pending_review" {
		return fmt.Errorf("当前状态不允许审核")
	}

	status := "approved"
	if !approved {
		status = "rejected"
	}
	return s.airspaceRepo.UpdateStatus(id, status, adminID, notes)
}

// SubmitToUOM 提交到UOM平台（预留接口）
func (s *AirspaceService) SubmitToUOM(id int64) error {
	app, err := s.airspaceRepo.GetApplicationByID(id)
	if err != nil {
		return fmt.Errorf("申请不存在")
	}
	if app.Status != "approved" && app.Status != "pending_review" {
		return fmt.Errorf("当前状态不允许提交UOM")
	}

	// Generate mock UOM application number (will be replaced with real UOM API)
	uomNo := fmt.Sprintf("UOM-%d-%d", time.Now().Unix(), id)
	s.logger.Info("模拟提交UOM平台", zap.String("uom_no", uomNo), zap.Int64("app_id", id))

	return s.airspaceRepo.UpdateUOMInfo(id, uomNo)
}

// HandleUOMCallback 处理UOM平台回调（预留接口）
func (s *AirspaceService) HandleUOMCallback(uomNo string, approved bool, approvalCode string) error {
	// This would be called by a webhook from UOM platform
	// For now, we simulate by looking up the application
	s.logger.Info("收到UOM回调", zap.String("uom_no", uomNo), zap.Bool("approved", approved))

	// Find application by UOM number and update
	// In real implementation, we'd query by uom_application_no
	return nil
}

// CancelApplication 取消空域申请
func (s *AirspaceService) CancelApplication(id int64, pilotID int64) error {
	app, err := s.airspaceRepo.GetApplicationByID(id)
	if err != nil {
		return fmt.Errorf("申请不存在")
	}
	if app.PilotID != pilotID {
		return fmt.Errorf("无权操作此申请")
	}
	if app.Status == "completed" || app.Status == "cancelled" {
		return fmt.Errorf("当前状态不允许取消")
	}
	return s.airspaceRepo.UpdateStatus(id, "cancelled", 0, "用户取消")
}

// ========== No-Fly Zones ==========

func (s *AirspaceService) CreateNoFlyZone(zone *model.NoFlyZone) error {
	return s.airspaceRepo.CreateNoFlyZone(zone)
}

func (s *AirspaceService) GetNoFlyZone(id int64) (*model.NoFlyZone, error) {
	return s.airspaceRepo.GetNoFlyZoneByID(id)
}

func (s *AirspaceService) UpdateNoFlyZone(zone *model.NoFlyZone) error {
	return s.airspaceRepo.UpdateNoFlyZone(zone)
}

func (s *AirspaceService) DeleteNoFlyZone(id int64) error {
	return s.airspaceRepo.DeleteNoFlyZone(id)
}

func (s *AirspaceService) ListNoFlyZones(zoneType, status string, page, pageSize int) ([]model.NoFlyZone, int64, error) {
	return s.airspaceRepo.ListNoFlyZones(zoneType, status, page, pageSize)
}

func (s *AirspaceService) FindNearbyNoFlyZones(lat, lng float64, radiusMeters float64) ([]model.NoFlyZone, error) {
	return s.airspaceRepo.FindNearbyNoFlyZones(lat, lng, radiusMeters)
}

// CheckAirspaceAvailability 检查指定位置空域可用性
func (s *AirspaceService) CheckAirspaceAvailability(lat, lng float64, altitude int) (*AirspaceCheckResult, error) {
	result := &AirspaceCheckResult{
		Available:    true,
		Restrictions: []NoFlyZoneInfo{},
	}

	zones, err := s.airspaceRepo.CheckNoFlyZoneConflict(lat, lng, altitude)
	if err != nil {
		return nil, err
	}

	for _, z := range zones {
		info := NoFlyZoneInfo{
			ID:               z.ID,
			Name:             z.Name,
			ZoneType:         z.ZoneType,
			RestrictionLevel: z.RestrictionLevel,
			AllowedWithPermit: z.AllowedWithPermit,
		}
		result.Restrictions = append(result.Restrictions, info)
		if z.RestrictionLevel == "no_fly" {
			result.Available = false
		}
	}

	return result, nil
}

type AirspaceCheckResult struct {
	Available    bool            `json:"available"`
	Restrictions []NoFlyZoneInfo `json:"restrictions"`
}

type NoFlyZoneInfo struct {
	ID               int64  `json:"id"`
	Name             string `json:"name"`
	ZoneType         string `json:"zone_type"`
	RestrictionLevel string `json:"restriction_level"`
	AllowedWithPermit bool  `json:"allowed_with_permit"`
}

// ========== Compliance Check Engine ==========

// RunComplianceCheck 执行全面合规性检查
func (s *AirspaceService) RunComplianceCheck(pilotID, droneID, orderID, airspaceAppID int64, triggerType string) (*model.ComplianceCheck, error) {
	check := &model.ComplianceCheck{
		PilotID:               pilotID,
		DroneID:               droneID,
		OrderID:               orderID,
		AirspaceApplicationID: airspaceAppID,
		TriggerType:           triggerType,
		CheckedBy:             "system",
		OverallResult:         "pending",
	}

	var items []model.ComplianceCheckItem

	// 1. Pilot compliance checks
	pilotItems := s.checkPilotCompliance(pilotID)
	items = append(items, pilotItems...)

	// 2. Drone compliance checks
	droneItems := s.checkDroneCompliance(droneID)
	items = append(items, droneItems...)

	// 3. Cargo compliance checks (if order exists)
	if orderID > 0 {
		cargoItems := s.checkCargoCompliance(orderID, droneID)
		items = append(items, cargoItems...)
	}

	// 4. Airspace compliance checks (if airspace app exists)
	if airspaceAppID > 0 {
		airspaceItems := s.checkAirspaceCompliance(airspaceAppID)
		items = append(items, airspaceItems...)
	}

	// Calculate results
	var totalItems, passedItems, failedItems, warningItems int
	var pilotResult, droneResult, cargoResult, airspaceResult string
	pilotPassed, dronePassed, cargoPassed, airspacePassed := true, true, true, true

	for i := range items {
		totalItems++
		switch items[i].Result {
		case "passed":
			passedItems++
		case "failed":
			failedItems++
			if items[i].IsBlocking {
				switch items[i].Category {
				case "pilot":
					pilotPassed = false
				case "drone":
					dronePassed = false
				case "cargo":
					cargoPassed = false
				case "airspace":
					airspacePassed = false
				}
			}
		case "warning":
			warningItems++
		}
	}

	pilotResult = boolToResult(pilotPassed)
	droneResult = boolToResult(dronePassed)
	cargoResult = boolToResult(cargoPassed)
	airspaceResult = boolToResult(airspacePassed)

	overallResult := "passed"
	if failedItems > 0 {
		overallResult = "failed"
	} else if warningItems > 0 {
		overallResult = "warning"
	}

	check.TotalItems = totalItems
	check.PassedItems = passedItems
	check.FailedItems = failedItems
	check.WarningItems = warningItems
	check.OverallResult = overallResult
	check.PilotCompliance = pilotResult
	check.DroneCompliance = droneResult
	check.CargoCompliance = cargoResult
	check.AirspaceCompliance = airspaceResult

	// Notes summary
	if failedItems > 0 {
		check.Notes = fmt.Sprintf("合规检查未通过: %d项失败, %d项警告 (共%d项)", failedItems, warningItems, totalItems)
	} else if warningItems > 0 {
		check.Notes = fmt.Sprintf("合规检查通过(有警告): %d项警告 (共%d项)", warningItems, totalItems)
	} else {
		check.Notes = fmt.Sprintf("合规检查全部通过: %d项", totalItems)
	}

	// Expiry: 24 hours
	expiry := time.Now().Add(24 * time.Hour)
	check.ExpiresAt = &expiry

	// Save to DB
	if err := s.airspaceRepo.CreateComplianceCheck(check); err != nil {
		return nil, err
	}

	// Associate items with check ID
	for i := range items {
		items[i].ComplianceCheckID = check.ID
	}
	if err := s.airspaceRepo.CreateComplianceCheckItems(items); err != nil {
		s.logger.Warn("保存合规检查明细失败", zap.Error(err))
	}

	check.Items = items
	return check, nil
}

func (s *AirspaceService) GetComplianceCheck(id int64) (*model.ComplianceCheck, error) {
	return s.airspaceRepo.GetComplianceCheckByID(id)
}

func (s *AirspaceService) ListComplianceChecks(pilotID, droneID int64, page, pageSize int) ([]model.ComplianceCheck, int64, error) {
	return s.airspaceRepo.ListComplianceChecks(pilotID, droneID, page, pageSize)
}

func (s *AirspaceService) GetLatestComplianceCheck(pilotID, droneID int64) (*model.ComplianceCheck, error) {
	return s.airspaceRepo.GetLatestComplianceCheck(pilotID, droneID)
}

// ========== Internal compliance check methods ==========

func (s *AirspaceService) checkPilotCompliance(pilotID int64) []model.ComplianceCheckItem {
	var items []model.ComplianceCheckItem

	pilot, err := s.pilotRepo.GetByID(pilotID)
	if err != nil {
		items = append(items, model.ComplianceCheckItem{
			Category: "pilot", CheckCode: "pilot_exists", CheckName: "飞手身份验证",
			Result: "failed", Severity: "error", Message: "飞手信息不存在",
			IsRequired: true, IsBlocking: true,
		})
		return items
	}

	// 1. Real-name verification
	result := "passed"
	msg := "飞手已完成实名认证"
	if pilot.VerificationStatus != "verified" {
		result = "failed"
		msg = fmt.Sprintf("飞手实名认证状态: %s，需要完成实名认证", pilot.VerificationStatus)
	}
	items = append(items, model.ComplianceCheckItem{
		Category: "pilot", CheckCode: "pilot_id_verified", CheckName: "实名认证验证",
		Result: result, Severity: "error", ActualValue: pilot.VerificationStatus,
		ExpectedValue: "verified", Message: msg, IsRequired: true, IsBlocking: true,
	})

	// 2. License validity
	result = "passed"
	msg = fmt.Sprintf("持有%s执照", pilot.CAACLicenseType)
	if pilot.CAACLicenseNo == "" {
		result = "failed"
		msg = "未上传飞行执照"
	} else if pilot.CAACLicenseExpireDate != nil && pilot.CAACLicenseExpireDate.Before(time.Now()) {
		result = "failed"
		msg = fmt.Sprintf("飞行执照已过期(%s)", pilot.CAACLicenseExpireDate.Format("2006-01-02"))
	}
	items = append(items, model.ComplianceCheckItem{
		Category: "pilot", CheckCode: "pilot_license", CheckName: "飞行执照有效性",
		Result: result, Severity: "error", ActualValue: pilot.CAACLicenseNo,
		Message: msg, IsRequired: true, IsBlocking: true,
	})

	// 3. Criminal check
	result = "warning"
	msg = "未提交无犯罪记录证明"
	if pilot.CriminalCheckStatus == "approved" {
		result = "passed"
		msg = "无犯罪记录证明已通过审核"
	} else if pilot.CriminalCheckStatus == "pending" {
		result = "warning"
		msg = "无犯罪记录证明审核中"
	}
	items = append(items, model.ComplianceCheckItem{
		Category: "pilot", CheckCode: "pilot_criminal", CheckName: "无犯罪记录证明",
		Result: result, Severity: "warning", ActualValue: pilot.CriminalCheckStatus,
		Message: msg, IsRequired: false, IsBlocking: false,
	})

	// 4. Health check
	result = "warning"
	msg = "未提交健康体检证明"
	if pilot.HealthCheckStatus == "approved" {
		result = "passed"
		msg = "健康体检证明已通过审核"
	} else if pilot.HealthCheckStatus == "pending" {
		result = "warning"
		msg = "健康体检证明审核中"
	}
	items = append(items, model.ComplianceCheckItem{
		Category: "pilot", CheckCode: "pilot_health", CheckName: "健康体检证明",
		Result: result, Severity: "warning", ActualValue: pilot.HealthCheckStatus,
		Message: msg, IsRequired: false, IsBlocking: false,
	})

	return items
}

func (s *AirspaceService) checkDroneCompliance(droneID int64) []model.ComplianceCheckItem {
	var items []model.ComplianceCheckItem

	drone, err := s.droneRepo.GetByID(droneID)
	if err != nil {
		items = append(items, model.ComplianceCheckItem{
			Category: "drone", CheckCode: "drone_exists", CheckName: "无人机信息验证",
			Result: "failed", Severity: "error", Message: "无人机信息不存在",
			IsRequired: true, IsBlocking: true,
		})
		return items
	}

	// 1. UOM registration
	result := "passed"
	msg := "UOM平台登记已验证"
	if drone.UOMVerified == "verified" {
		// OK
	} else if drone.UOMVerified == "pending" {
		result = "warning"
		msg = "UOM平台登记待审核"
	} else {
		result = "failed"
		msg = "未完成UOM平台实名登记"
	}
	items = append(items, model.ComplianceCheckItem{
		Category: "drone", CheckCode: "drone_uom", CheckName: "UOM平台实名登记",
		Result: result, Severity: "error", ActualValue: drone.UOMVerified,
		ExpectedValue: "verified", Message: msg, IsRequired: true, IsBlocking: true,
	})

	// 2. Insurance coverage (>= 500万)
	result = "passed"
	msg = fmt.Sprintf("保额 %.0f万元", float64(drone.InsuranceCoverage)/100/10000)
	minCoverage := int64(500 * 10000 * 100) // 500万，单位分
	if drone.InsuranceVerified != "verified" {
		result = "failed"
		msg = "保险信息未验证"
	} else if drone.InsuranceCoverage < minCoverage {
		result = "failed"
		msg = fmt.Sprintf("保额不足: %.0f万元，最低要求500万元", float64(drone.InsuranceCoverage)/100/10000)
	} else if drone.InsuranceExpireDate != nil && drone.InsuranceExpireDate.Before(time.Now()) {
		result = "failed"
		msg = fmt.Sprintf("保险已过期(%s)", drone.InsuranceExpireDate.Format("2006-01-02"))
	}
	items = append(items, model.ComplianceCheckItem{
		Category: "drone", CheckCode: "drone_insurance", CheckName: "第三者责任险",
		Result: result, Severity: "error",
		ExpectedValue: "≥500万", ActualValue: fmt.Sprintf("%.0f万", float64(drone.InsuranceCoverage)/100/10000),
		Message: msg, IsRequired: true, IsBlocking: true,
	})

	// 3. Airworthiness certificate
	result = "passed"
	msg = "适航证书有效"
	if drone.AirworthinessVerified != "verified" {
		result = "failed"
		msg = "适航证书未验证"
	} else if drone.AirworthinessCertExpire != nil && drone.AirworthinessCertExpire.Before(time.Now()) {
		result = "failed"
		msg = fmt.Sprintf("适航证书已过期(%s)", drone.AirworthinessCertExpire.Format("2006-01-02"))
	}
	items = append(items, model.ComplianceCheckItem{
		Category: "drone", CheckCode: "drone_airworthiness", CheckName: "适航证书",
		Result: result, Severity: "error", ActualValue: drone.AirworthinessVerified,
		Message: msg, IsRequired: true, IsBlocking: true,
	})

	// 4. Maintenance status
	result = "passed"
	msg = "维护状态正常"
	if drone.NextMaintenanceDate != nil && drone.NextMaintenanceDate.Before(time.Now()) {
		result = "warning"
		msg = fmt.Sprintf("设备已超过预定维护日期(%s)，建议尽快维护", drone.NextMaintenanceDate.Format("2006-01-02"))
	}
	items = append(items, model.ComplianceCheckItem{
		Category: "drone", CheckCode: "drone_maintenance", CheckName: "设备维护状态",
		Result: result, Severity: "warning", Message: msg,
		IsRequired: false, IsBlocking: false,
	})

	return items
}

func (s *AirspaceService) checkCargoCompliance(orderID, droneID int64) []model.ComplianceCheckItem {
	var items []model.ComplianceCheckItem

	drone, err := s.droneRepo.GetByID(droneID)
	if err != nil {
		return items
	}

	// 从派单任务或货运需求获取货物重量
	cargoWeight := s.airspaceRepo.GetCargoWeightByOrderID(orderID)

	// 1. Weight limit check
	result := "passed"
	msg := "货物重量在载荷范围内"
	if cargoWeight > 0 && drone.MaxLoad > 0 {
		loadRatio := cargoWeight / drone.MaxLoad
		if loadRatio > 1.0 {
			result = "failed"
			msg = fmt.Sprintf("货物重量(%.1fkg)超过无人机最大载荷(%.1fkg)", cargoWeight, drone.MaxLoad)
		} else if loadRatio > 0.9 {
			result = "warning"
			msg = fmt.Sprintf("货物重量(%.1fkg)接近无人机最大载荷(%.1fkg)的90%%", cargoWeight, drone.MaxLoad)
		}
	} else if cargoWeight == 0 {
		result = "warning"
		msg = "未获取到货物重量信息，请确认货物信息已填写"
	}
	items = append(items, model.ComplianceCheckItem{
		Category: "cargo", CheckCode: "cargo_weight", CheckName: "载荷重量检查",
		Result: result, Severity: "error",
		ExpectedValue: fmt.Sprintf("≤%.1fkg", drone.MaxLoad),
		ActualValue:   fmt.Sprintf("%.1fkg", cargoWeight),
		Message: msg, IsRequired: true, IsBlocking: result == "failed",
	})

	return items
}

func (s *AirspaceService) checkAirspaceCompliance(airspaceAppID int64) []model.ComplianceCheckItem {
	var items []model.ComplianceCheckItem

	app, err := s.airspaceRepo.GetApplicationByID(airspaceAppID)
	if err != nil {
		return items
	}

	// 1. Check departure point against no-fly zones
	departureZones, err := s.airspaceRepo.CheckNoFlyZoneConflict(app.DepartureLatitude, app.DepartureLongitude, app.MaxAltitude)
	result := "passed"
	msg := "起飞点不在禁飞区内"
	if err == nil && len(departureZones) > 0 {
		for _, z := range departureZones {
			if z.RestrictionLevel == "no_fly" {
				result = "failed"
				msg = fmt.Sprintf("起飞点位于禁飞区「%s」内", z.Name)
				break
			}
		}
		if result == "passed" {
			result = "warning"
			msg = fmt.Sprintf("起飞点位于限飞区「%s」内，可能需要额外许可", departureZones[0].Name)
		}
	}
	items = append(items, model.ComplianceCheckItem{
		Category: "airspace", CheckCode: "airspace_departure", CheckName: "起飞点空域检查",
		Result: result, Severity: "error", Message: msg,
		IsRequired: true, IsBlocking: result == "failed",
	})

	// 2. Check arrival point against no-fly zones
	arrivalZones, err := s.airspaceRepo.CheckNoFlyZoneConflict(app.ArrivalLatitude, app.ArrivalLongitude, app.MaxAltitude)
	result = "passed"
	msg = "降落点不在禁飞区内"
	if err == nil && len(arrivalZones) > 0 {
		for _, z := range arrivalZones {
			if z.RestrictionLevel == "no_fly" {
				result = "failed"
				msg = fmt.Sprintf("降落点位于禁飞区「%s」内", z.Name)
				break
			}
		}
		if result == "passed" {
			result = "warning"
			msg = fmt.Sprintf("降落点位于限飞区「%s」内，可能需要额外许可", arrivalZones[0].Name)
		}
	}
	items = append(items, model.ComplianceCheckItem{
		Category: "airspace", CheckCode: "airspace_arrival", CheckName: "降落点空域检查",
		Result: result, Severity: "error", Message: msg,
		IsRequired: true, IsBlocking: result == "failed",
	})

	// 3. Altitude check
	result = "passed"
	msg = fmt.Sprintf("计划高度%dm符合要求", app.MaxAltitude)
	if app.MaxAltitude > 120 {
		result = "warning"
		msg = fmt.Sprintf("计划最大高度%dm超过120m，需要获得空域管理部门批准", app.MaxAltitude)
	}
	if app.MaxAltitude > 500 {
		result = "failed"
		msg = fmt.Sprintf("计划最大高度%dm超过500m安全上限", app.MaxAltitude)
	}
	items = append(items, model.ComplianceCheckItem{
		Category: "airspace", CheckCode: "airspace_altitude", CheckName: "飞行高度检查",
		Result: result, Severity: "error",
		ExpectedValue: "≤120m(无需批准)", ActualValue: fmt.Sprintf("%dm", app.MaxAltitude),
		Message: msg, IsRequired: true, IsBlocking: result == "failed",
	})

	// 4. Time window check
	result = "passed"
	msg = "飞行时间窗口合理"
	now := time.Now()
	if app.PlannedStartTime.Before(now) {
		result = "warning"
		msg = "计划起飞时间已过去"
	}
	duration := app.PlannedEndTime.Sub(app.PlannedStartTime)
	if duration > 4*time.Hour {
		result = "warning"
		msg = fmt.Sprintf("飞行时间窗口(%s)超过4小时，请确认是否合理", duration)
	}
	items = append(items, model.ComplianceCheckItem{
		Category: "airspace", CheckCode: "airspace_time", CheckName: "飞行时间窗口检查",
		Result: result, Severity: "warning", Message: msg,
		IsRequired: false, IsBlocking: false,
	})

	return items
}

func boolToResult(passed bool) string {
	if passed {
		return "passed"
	}
	return "failed"
}
