package pilot

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/pkg/upload"
	"wurenji-backend/internal/service"
)

type Handler struct {
	pilotService  *service.PilotService
	uploadService *upload.UploadService
}

func NewHandler(pilotService *service.PilotService, uploadService *upload.UploadService) *Handler {
	return &Handler{
		pilotService:  pilotService,
		uploadService: uploadService,
	}
}

// Register 注册成为飞手
func (h *Handler) Register(c *gin.Context) {
	userID := c.GetInt64("user_id")

	var req service.RegisterPilotReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	pilot, err := h.pilotService.Register(userID, &req)
	if err != nil {
		response.Error(c, response.CodeParamError, err.Error())
		return
	}

	response.Success(c, pilot)
}

// GetProfile 获取飞手个人档案
func (h *Handler) GetProfile(c *gin.Context) {
	userID := c.GetInt64("user_id")

	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		response.Error(c, response.CodeNotFound, "飞手档案不存在")
		return
	}

	response.Success(c, pilot)
}

// GetByID 根据ID获取飞手信息
func (h *Handler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	pilot, err := h.pilotService.GetByID(id)
	if err != nil {
		response.Error(c, response.CodeNotFound, "飞手不存在")
		return
	}

	response.Success(c, pilot)
}

// UpdateProfile 更新飞手档案
func (h *Handler) UpdateProfile(c *gin.Context) {
	userID := c.GetInt64("user_id")

	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		response.Error(c, response.CodeNotFound, "飞手档案不存在")
		return
	}

	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := h.pilotService.UpdateProfile(pilot.ID, req); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}

	response.Success(c, nil)
}

// UpdateLocation 更新实时位置
func (h *Handler) UpdateLocation(c *gin.Context) {
	userID := c.GetInt64("user_id")

	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		response.Error(c, response.CodeNotFound, "飞手档案不存在")
		return
	}

	var req struct {
		Latitude  float64 `json:"latitude" binding:"required"`
		Longitude float64 `json:"longitude" binding:"required"`
		City      string  `json:"city"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := h.pilotService.UpdateLocation(pilot.ID, req.Latitude, req.Longitude, req.City); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}

	response.Success(c, nil)
}

// UpdateAvailability 更新接单状态
func (h *Handler) UpdateAvailability(c *gin.Context) {
	userID := c.GetInt64("user_id")

	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		response.Error(c, response.CodeNotFound, "飞手档案不存在")
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"` // online, busy, offline
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := h.pilotService.UpdateAvailability(pilot.ID, req.Status); err != nil {
		response.Error(c, response.CodeParamError, err.Error())
		return
	}

	response.Success(c, nil)
}

// List 获取飞手列表
func (h *Handler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	filters := make(map[string]interface{})
	if status := c.Query("verification_status"); status != "" {
		filters["verification_status"] = status
	}
	if city := c.Query("city"); city != "" {
		filters["current_city"] = city
	}
	if licenseType := c.Query("license_type"); licenseType != "" {
		filters["caac_license_type"] = licenseType
	}

	pilots, total, err := h.pilotService.List(page, pageSize, filters)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}

	response.Success(c, gin.H{
		"list":  pilots,
		"total": total,
		"page":  page,
	})
}

// Nearby 查找附近飞手
func (h *Handler) Nearby(c *gin.Context) {
	lat, _ := strconv.ParseFloat(c.Query("latitude"), 64)
	lng, _ := strconv.ParseFloat(c.Query("longitude"), 64)
	radius, _ := strconv.ParseFloat(c.DefaultQuery("radius", "50"), 64)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	if lat == 0 || lng == 0 {
		response.BadRequest(c, "请提供位置信息")
		return
	}

	pilots, err := h.pilotService.FindNearby(lat, lng, radius, limit)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}

	response.Success(c, pilots)
}

// ==================== 资质证书 ====================

// SubmitCertification 提交资质证书
func (h *Handler) SubmitCertification(c *gin.Context) {
	userID := c.GetInt64("user_id")

	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		response.Error(c, response.CodeNotFound, "飞手档案不存在")
		return
	}

	var req service.SubmitCertificationReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	cert, err := h.pilotService.SubmitCertification(pilot.ID, &req)
	if err != nil {
		response.Error(c, response.CodeParamError, err.Error())
		return
	}

	response.Success(c, cert)
}

// GetCertifications 获取我的证书列表
func (h *Handler) GetCertifications(c *gin.Context) {
	userID := c.GetInt64("user_id")

	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		response.Error(c, response.CodeNotFound, "飞手档案不存在")
		return
	}

	certs, err := h.pilotService.GetCertifications(pilot.ID)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}

	response.Success(c, certs)
}

// SubmitCriminalCheck 提交无犯罪记录证明
func (h *Handler) SubmitCriminalCheck(c *gin.Context) {
	userID := c.GetInt64("user_id")

	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		response.Error(c, response.CodeNotFound, "飞手档案不存在")
		return
	}

	var req struct {
		DocURL     string     `json:"doc_url" binding:"required"`
		ExpireDate *time.Time `json:"expire_date"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := h.pilotService.SubmitCriminalCheck(pilot.ID, req.DocURL, req.ExpireDate); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}

	response.Success(c, nil)
}

// SubmitHealthCheck 提交健康体检证明
func (h *Handler) SubmitHealthCheck(c *gin.Context) {
	userID := c.GetInt64("user_id")

	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		response.Error(c, response.CodeNotFound, "飞手档案不存在")
		return
	}

	var req struct {
		DocURL     string     `json:"doc_url" binding:"required"`
		ExpireDate *time.Time `json:"expire_date"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := h.pilotService.SubmitHealthCheck(pilot.ID, req.DocURL, req.ExpireDate); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}

	response.Success(c, nil)
}

// UploadCertImage 上传证书图片
func (h *Handler) UploadCertImage(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "请选择文件")
		return
	}

	url, err := h.uploadService.SaveFile(file, "certifications")
	if err != nil {
		response.Error(c, response.CodeParamError, err.Error())
		return
	}

	response.Success(c, gin.H{"url": url})
}

// ==================== 飞行记录 ====================

// GetFlightLogs 获取飞行记录
func (h *Handler) GetFlightLogs(c *gin.Context) {
	userID := c.GetInt64("user_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		response.Error(c, response.CodeNotFound, "飞手档案不存在")
		return
	}

	logs, total, err := h.pilotService.GetFlightLogs(pilot.ID, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}

	response.Success(c, gin.H{
		"list":  logs,
		"total": total,
		"page":  page,
	})
}

// GetFlightStats 获取飞行统计
func (h *Handler) GetFlightStats(c *gin.Context) {
	userID := c.GetInt64("user_id")

	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		response.Error(c, response.CodeNotFound, "飞手档案不存在")
		return
	}

	stats, err := h.pilotService.GetFlightStats(pilot.ID)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}

	response.Success(c, stats)
}

// AddFlightLog 添加飞行记录 (手动录入)
func (h *Handler) AddFlightLog(c *gin.Context) {
	userID := c.GetInt64("user_id")

	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		response.Error(c, response.CodeNotFound, "飞手档案不存在")
		return
	}

	var req struct {
		DroneID          int64      `json:"drone_id"`
		FlightDate       time.Time  `json:"flight_date" binding:"required"`
		FlightDuration   float64    `json:"flight_duration" binding:"required"` // 分钟
		FlightDistance   float64    `json:"flight_distance"`
		StartLatitude    float64    `json:"start_latitude"`
		StartLongitude   float64    `json:"start_longitude"`
		StartAddress     string     `json:"start_address"`
		EndLatitude      float64    `json:"end_latitude"`
		EndLongitude     float64    `json:"end_longitude"`
		EndAddress       string     `json:"end_address"`
		MaxAltitude      float64    `json:"max_altitude"`
		CargoWeight      float64    `json:"cargo_weight"`
		WeatherCondition string     `json:"weather_condition"`
		FlightType       string     `json:"flight_type"`
		IncidentReport   string     `json:"incident_report"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	log := &model.PilotFlightLog{
		PilotID:          pilot.ID,
		DroneID:          req.DroneID,
		FlightDate:       req.FlightDate,
		FlightDuration:   req.FlightDuration,
		FlightDistance:   req.FlightDistance,
		StartLatitude:    req.StartLatitude,
		StartLongitude:   req.StartLongitude,
		StartAddress:     req.StartAddress,
		EndLatitude:      req.EndLatitude,
		EndLongitude:     req.EndLongitude,
		EndAddress:       req.EndAddress,
		MaxAltitude:      req.MaxAltitude,
		CargoWeight:      req.CargoWeight,
		WeatherCondition: req.WeatherCondition,
		FlightType:       req.FlightType,
		IncidentReport:   req.IncidentReport,
	}

	if err := h.pilotService.AddFlightLog(log); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}

	response.Success(c, log)
}

// ==================== 无人机绑定 ====================

// GetBoundDrones 获取绑定的无人机
func (h *Handler) GetBoundDrones(c *gin.Context) {
	userID := c.GetInt64("user_id")

	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		response.Error(c, response.CodeNotFound, "飞手档案不存在")
		return
	}

	bindings, err := h.pilotService.GetBoundDrones(pilot.ID)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}

	response.Success(c, bindings)
}

// BindDrone 绑定无人机
func (h *Handler) BindDrone(c *gin.Context) {
	userID := c.GetInt64("user_id")

	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		response.Error(c, response.CodeNotFound, "飞手档案不存在")
		return
	}

	var req struct {
		DroneID     int64      `json:"drone_id" binding:"required"`
		OwnerID     int64      `json:"owner_id" binding:"required"`
		BindingType string     `json:"binding_type"` // permanent, temporary
		EffectiveTo *time.Time `json:"effective_to"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if req.BindingType == "" {
		req.BindingType = "permanent"
	}

	if err := h.pilotService.BindDrone(pilot.ID, req.DroneID, req.OwnerID, req.BindingType, req.EffectiveTo); err != nil {
		response.Error(c, response.CodeParamError, err.Error())
		return
	}

	response.Success(c, nil)
}

// UnbindDrone 解绑无人机
func (h *Handler) UnbindDrone(c *gin.Context) {
	bindingIDStr := c.Param("bindingId")
	bindingID, err := strconv.ParseInt(bindingIDStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的绑定ID")
		return
	}

	if err := h.pilotService.UnbindDrone(bindingID); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}

	response.Success(c, nil)
}
