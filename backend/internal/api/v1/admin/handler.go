package admin

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	userService     *service.UserService
	droneService    *service.DroneService
	orderService    *service.OrderService
	opsService      *service.OperationsService
	paymentService  *service.PaymentService
	pilotService    *service.PilotService
	clientService   *service.ClientService
	ownerService    *service.OwnerService
	dispatchService *service.DispatchService
	flightService   *service.FlightService
}

func NewHandler(
	userService *service.UserService,
	droneService *service.DroneService,
	orderService *service.OrderService,
	opsService *service.OperationsService,
	paymentService *service.PaymentService,
	pilotService *service.PilotService,
	clientService *service.ClientService,
	ownerService *service.OwnerService,
	dispatchService *service.DispatchService,
	flightService *service.FlightService,
) *Handler {
	return &Handler{
		userService:     userService,
		droneService:    droneService,
		orderService:    orderService,
		opsService:      opsService,
		paymentService:  paymentService,
		pilotService:    pilotService,
		clientService:   clientService,
		ownerService:    ownerService,
		dispatchService: dispatchService,
		flightService:   flightService,
	}
}

func (h *Handler) Dashboard(c *gin.Context) {
	stats, _ := h.orderService.GetStatistics()
	_, userTotal, _ := h.userService.ListUsers(1, 1, nil)
	_, droneTotal, _ := h.droneService.List(1, 1, nil)

	response.Success(c, gin.H{
		"order_stats": stats,
		"user_total":  userTotal,
		"drone_total": droneTotal,
	})
}

func (h *Handler) UserList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filters := make(map[string]interface{})
	if ut := c.Query("user_type"); ut != "" {
		filters["user_type"] = ut
	}
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}
	users, total, err := h.userService.ListUsers(page, pageSize, filters)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, users, total, page, pageSize)
}

func (h *Handler) UpdateUserStatus(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if err := h.userService.UpdateUserStatus(id, req.Status); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) ApproveIDVerification(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req struct {
		Approved bool `json:"approved"`
	}
	c.ShouldBindJSON(&req)
	if err := h.userService.ApproveIDVerification(id, req.Approved); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) DroneList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filters := make(map[string]interface{})
	if cs := c.Query("certification_status"); cs != "" {
		filters["certification_status"] = cs
	}

	// 1. 查询无人机列表
	drones, total, err := h.droneService.List(page, pageSize, filters)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}

	// 2. 收集所有的 owner_id
	ownerIDs := make([]int64, 0, len(drones))
	for i := range drones {
		ownerIDs = append(ownerIDs, drones[i].OwnerID)
	}

	// 3. 批量查询用户信息（只查一次数据库）
	owners, err := h.userService.GetByIDs(ownerIDs)
	if err != nil {
		// 如果查询用户失败，也不影响无人机列表返回
		// 只是不会显示机主信息
		owners = make(map[int64]*model.User)
	}

	// 4. 转换为 DTO
	dtoList := ToDroneDTOList(drones, owners)

	response.SuccessWithPage(c, dtoList, total, page, pageSize)
}

func (h *Handler) ApproveDroneCertification(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req struct {
		Approved bool `json:"approved"`
	}
	c.ShouldBindJSON(&req)
	if err := h.droneService.ApproveCertification(id, req.Approved); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) GetDroneDetail(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	drone, err := h.droneService.GetByID(id)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	owners, _ := h.userService.GetByIDs([]int64{drone.OwnerID})
	owner := owners[drone.OwnerID]
	response.Success(c, ToDroneDTO(drone, owner))
}

func (h *Handler) ApproveUOMRegistration(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req struct {
		Approved bool `json:"approved"`
	}
	c.ShouldBindJSON(&req)
	if err := h.droneService.ApproveUOMRegistration(id, req.Approved); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) ApproveInsurance(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req struct {
		Approved bool `json:"approved"`
	}
	c.ShouldBindJSON(&req)
	if err := h.droneService.ApproveInsurance(id, req.Approved); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) ApproveAirworthiness(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req struct {
		Approved bool `json:"approved"`
	}
	c.ShouldBindJSON(&req)
	if err := h.droneService.ApproveAirworthiness(id, req.Approved); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) OrderList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filters := make(map[string]interface{})
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}
	orders, total, err := h.orderService.AdminListOrders(page, pageSize, filters)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, orders, total, page, pageSize)
}

func (h *Handler) DemandList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filters := map[string]interface{}{}
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}
	if keyword := c.Query("keyword"); keyword != "" {
		filters["keyword"] = keyword
	}
	if cargoScene := c.Query("cargo_scene"); cargoScene != "" {
		filters["cargo_scene"] = cargoScene
	}
	items, total, err := h.clientService.AdminListDemands(page, pageSize, filters)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) SupplyList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filters := map[string]interface{}{}
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}
	if keyword := c.Query("keyword"); keyword != "" {
		filters["keyword"] = keyword
	}
	if cargoScene := c.Query("cargo_scene"); cargoScene != "" {
		filters["cargo_scene"] = cargoScene
	}
	items, total, err := h.ownerService.AdminListSupplies(page, pageSize, filters)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) DispatchTaskList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filters := map[string]interface{}{}
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}
	if keyword := c.Query("keyword"); keyword != "" {
		filters["keyword"] = keyword
	}
	if source := c.Query("dispatch_source"); source != "" {
		filters["dispatch_source"] = source
	}
	items, total, err := h.dispatchService.AdminListFormalTasks(page, pageSize, filters)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) FlightRecordList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filters := map[string]interface{}{}
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}
	if keyword := c.Query("keyword"); keyword != "" {
		filters["keyword"] = keyword
	}
	items, total, err := h.flightService.AdminListFlightRecords(page, pageSize, filters)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) PaymentList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	payments, total, err := h.paymentService.AdminList(page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, payments, total, page, pageSize)
}

func (h *Handler) MigrationAuditList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filters := map[string]interface{}{}
	if severity := c.Query("severity"); severity != "" {
		filters["severity"] = severity
	}
	if resolutionStatus := c.Query("resolution_status"); resolutionStatus != "" {
		filters["resolution_status"] = resolutionStatus
	}
	if issueType := c.Query("issue_type"); issueType != "" {
		filters["issue_type"] = issueType
	}
	if auditStage := c.Query("audit_stage"); auditStage != "" {
		filters["audit_stage"] = auditStage
	}
	if keyword := c.Query("keyword"); keyword != "" {
		filters["keyword"] = keyword
	}
	items, total, err := h.opsService.AdminListMigrationAudits(page, pageSize, filters)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) MigrationAuditSummary(c *gin.Context) {
	summary, err := h.opsService.AdminGetMigrationAuditSummary()
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, summary)
}

func (h *Handler) OrderAnomalyList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filters := map[string]interface{}{}
	if anomalyType := c.Query("anomaly_type"); anomalyType != "" {
		filters["anomaly_type"] = anomalyType
	}
	if severity := c.Query("severity"); severity != "" {
		filters["severity"] = severity
	}
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}
	if keyword := c.Query("keyword"); keyword != "" {
		filters["keyword"] = keyword
	}
	items, total, err := h.opsService.AdminListOrderAnomalies(page, pageSize, filters)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) OrderAnomalySummary(c *gin.Context) {
	summary, err := h.opsService.AdminGetOrderAnomalySummary()
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, summary)
}

func (h *Handler) HandleExpiredDemands(c *gin.Context) {
	processed, err := h.clientService.CloseExpiredDemands(100)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, gin.H{"processed": processed})
}

func (h *Handler) HandleExpiredPilotBindings(c *gin.Context) {
	processed, err := h.ownerService.ExpirePendingBindings(100)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, gin.H{"processed": processed})
}

// ==================== 飞手管理 ====================

func (h *Handler) PilotList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filters := make(map[string]interface{})
	if vs := c.Query("verification_status"); vs != "" {
		filters["verification_status"] = vs
	}
	pilots, total, err := h.pilotService.List(page, pageSize, filters)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	// 批量读取用户信息
	userIDs := make([]int64, 0, len(pilots))
	for i := range pilots {
		userIDs = append(userIDs, pilots[i].UserID)
	}
	users, _ := h.userService.GetByIDs(userIDs)
	type PilotDTO struct {
		ID                  int64   `json:"id"`
		UserID              int64   `json:"user_id"`
		Nickname            string  `json:"nickname"`
		Phone               string  `json:"phone"`
		CAACLicenseNo       string  `json:"caac_license_no"`
		CAACLicenseType     string  `json:"caac_license_type"`
		CAACLicenseImage    string  `json:"caac_license_image"`
		CriminalCheckStatus string  `json:"criminal_check_status"`
		CriminalCheckDoc    string  `json:"criminal_check_doc"`
		HealthCheckStatus   string  `json:"health_check_status"`
		HealthCheckDoc      string  `json:"health_check_doc"`
		VerificationStatus  string  `json:"verification_status"`
		VerificationNote    string  `json:"verification_note"`
		ServiceRadius       float64 `json:"service_radius"`
		TotalOrders         int     `json:"total_orders"`
		ServiceRating       float64 `json:"service_rating"`
		CreatedAt           string  `json:"created_at"`
	}
	dtoList := make([]PilotDTO, 0, len(pilots))
	for i := range pilots {
		dto := PilotDTO{
			ID:                  pilots[i].ID,
			UserID:              pilots[i].UserID,
			CAACLicenseNo:       pilots[i].CAACLicenseNo,
			CAACLicenseType:     pilots[i].CAACLicenseType,
			CAACLicenseImage:    pilots[i].CAACLicenseImage,
			CriminalCheckStatus: pilots[i].CriminalCheckStatus,
			CriminalCheckDoc:    pilots[i].CriminalCheckDoc,
			HealthCheckStatus:   pilots[i].HealthCheckStatus,
			HealthCheckDoc:      pilots[i].HealthCheckDoc,
			VerificationStatus:  pilots[i].VerificationStatus,
			VerificationNote:    pilots[i].VerificationNote,
			ServiceRadius:       pilots[i].ServiceRadius,
			TotalOrders:         pilots[i].TotalOrders,
			ServiceRating:       pilots[i].ServiceRating,
			CreatedAt:           pilots[i].CreatedAt.Format("2006-01-02 15:04:05"),
		}
		if u, ok := users[pilots[i].UserID]; ok {
			dto.Nickname = u.Nickname
			dto.Phone = u.Phone
		}
		dtoList = append(dtoList, dto)
	}
	response.SuccessWithPage(c, dtoList, total, page, pageSize)
}

func (h *Handler) VerifyPilot(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req struct {
		Approved bool   `json:"approved"`
		Note     string `json:"note"`
	}
	c.ShouldBindJSON(&req)
	if err := h.pilotService.VerifyPilot(id, req.Approved, req.Note); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) ApprovePilotCriminalCheck(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req struct {
		Approved bool `json:"approved"`
	}
	c.ShouldBindJSON(&req)
	if err := h.pilotService.ApproveCriminalCheck(id, req.Approved); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) ApprovePilotHealthCheck(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req struct {
		Approved bool `json:"approved"`
	}
	c.ShouldBindJSON(&req)
	if err := h.pilotService.ApproveHealthCheck(id, req.Approved); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

// ClientList 客户列表
func (h *Handler) ClientList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	clientType := c.Query("client_type")     // individual / enterprise
	status := c.Query("verification_status") // pending / verified / rejected

	clients, total, err := h.clientService.List(page, pageSize, clientType, status)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, clients, total, page, pageSize)
}

// VerifyClient 客户审核（通过 / 拒绝）
func (h *Handler) VerifyClient(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req struct {
		Approved bool   `json:"approved"`
		Note     string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, response.CodeParamError, "参数错误")
		return
	}
	var err error
	if req.Approved {
		err = h.clientService.ApproveClient(id, req.Note)
	} else {
		err = h.clientService.RejectClient(id, req.Note)
	}
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}
