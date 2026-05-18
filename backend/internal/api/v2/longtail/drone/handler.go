package drone

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/pkg/upload"
	"wurenji-backend/internal/service"
)

type Handler struct {
	droneService  *service.DroneService
	uploadService *upload.UploadService
}

func NewHandler(droneService *service.DroneService, uploadService *upload.UploadService) *Handler {
	return &Handler{droneService: droneService, uploadService: uploadService}
}

func (h *Handler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var drone model.Drone
	if err := c.ShouldBindJSON(&drone); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	drone.OwnerID = userID
	if err := h.droneService.Create(&drone); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, drone)
}

func (h *Handler) GetByID(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	drone, err := h.droneService.GetByID(id)
	if err != nil {
		response.Error(c, response.CodeNotFound, "无人机不存在")
		return
	}
	response.Success(c, drone)
}

func (h *Handler) Update(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var drone model.Drone
	if err := c.ShouldBindJSON(&drone); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	drone.ID = id
	if err := h.droneService.Update(userID, &drone); err != nil {
		response.Error(c, response.CodeForbidden, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) Delete(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if err := h.droneService.Delete(userID, id); err != nil {
		response.Error(c, response.CodeForbidden, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filters := make(map[string]interface{})
	if city := c.Query("city"); city != "" {
		filters["city"] = city
	}
	if status := c.Query("availability_status"); status != "" {
		filters["availability_status"] = status
	}
	drones, total, err := h.droneService.List(page, pageSize, filters)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, drones, total, page, pageSize)
}

func (h *Handler) MyDrones(c *gin.Context) {
	userID := middleware.GetUserID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	drones, total, err := h.droneService.ListByOwner(userID, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, drones, total, page, pageSize)
}

func (h *Handler) Nearby(c *gin.Context) {
	lat, _ := strconv.ParseFloat(c.Query("lat"), 64)
	lng, _ := strconv.ParseFloat(c.Query("lng"), 64)
	radius, _ := strconv.ParseFloat(c.DefaultQuery("radius", "50"), 64)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	drones, total, err := h.droneService.FindNearby(lat, lng, radius, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, drones, total, page, pageSize)
}

func (h *Handler) UploadImages(c *gin.Context) {
	form, err := c.MultipartForm()
	if err != nil {
		response.BadRequest(c, "请选择文件")
		return
	}
	files := form.File["files"]
	var urls []string
	for _, file := range files {
		url, err := h.uploadService.SaveFile(file, "drone")
		if err != nil {
			continue
		}
		urls = append(urls, url)
	}
	response.Success(c, gin.H{"urls": urls})
}

func (h *Handler) SubmitCertification(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var req struct {
		Docs model.JSON `json:"docs"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if err := h.droneService.SubmitCertification(userID, id, req.Docs); err != nil {
		response.Error(c, response.CodeForbidden, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) UpdateAvailability(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if err := h.droneService.UpdateAvailability(userID, id, req.Status); err != nil {
		response.Error(c, response.CodeForbidden, err.Error())
		return
	}
	response.Success(c, nil)
}

// ==================== UOM平台登记 ====================

// SubmitUOMRegistration 提交UOM平台登记
func (h *Handler) SubmitUOMRegistration(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var req service.SubmitUOMRegistrationReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	if err := h.droneService.SubmitUOMRegistration(userID, id, &req); err != nil {
		response.Error(c, response.CodeForbidden, err.Error())
		return
	}
	response.Success(c, nil)
}

// ==================== 保险信息 ====================

// SubmitInsurance 提交保险信息
func (h *Handler) SubmitInsurance(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var req service.SubmitInsuranceReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	if err := h.droneService.SubmitInsurance(userID, id, &req); err != nil {
		response.Error(c, response.CodeParamError, err.Error())
		return
	}
	response.Success(c, nil)
}

// ==================== 适航证书 ====================

// SubmitAirworthiness 提交适航证书
func (h *Handler) SubmitAirworthiness(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var req service.SubmitAirworthinessReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	if err := h.droneService.SubmitAirworthiness(userID, id, &req); err != nil {
		response.Error(c, response.CodeForbidden, err.Error())
		return
	}
	response.Success(c, nil)
}

// ==================== 维护记录 ====================

// AddMaintenanceLog 添加维护记录
func (h *Handler) AddMaintenanceLog(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var req service.AddMaintenanceReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	log, err := h.droneService.AddMaintenanceLog(userID, id, &req)
	if err != nil {
		response.Error(c, response.CodeForbidden, err.Error())
		return
	}
	response.Success(c, log)
}

// GetMaintenanceLogs 获取维护记录
func (h *Handler) GetMaintenanceLogs(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	logs, total, err := h.droneService.GetMaintenanceLogs(id, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, logs, total, page, pageSize)
}

// ==================== 认证状态 ====================

// GetCertificationStatus 获取无人机综合认证状态
func (h *Handler) GetCertificationStatus(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	status, err := h.droneService.GetCertificationStatus(id)
	if err != nil {
		response.Error(c, response.CodeNotFound, err.Error())
		return
	}
	response.Success(c, status)
}
