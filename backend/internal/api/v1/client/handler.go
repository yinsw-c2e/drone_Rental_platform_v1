package client

import (
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/service"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	clientService *service.ClientService
}

func NewHandler(clientService *service.ClientService) *Handler {
	return &Handler{clientService: clientService}
}

// ==================== 客户注册与档案 ====================

// RegisterIndividual 注册个人客户
// POST /api/v1/client/register/individual
func (h *Handler) RegisterIndividual(c *gin.Context) {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	client, err := h.clientService.RegisterIndividual(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": client})
}

// RegisterEnterprise 注册企业客户
// POST /api/v1/client/register/enterprise
func (h *Handler) RegisterEnterprise(c *gin.Context) {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	var req struct {
		CompanyName        string `json:"company_name" binding:"required"`
		BusinessLicenseNo  string `json:"business_license_no" binding:"required"`
		BusinessLicenseDoc string `json:"business_license_doc" binding:"required"`
		LegalRepresentative string `json:"legal_representative"`
		ContactPerson      string `json:"contact_person"`
		ContactPhone       string `json:"contact_phone"`
		ContactEmail       string `json:"contact_email"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	client, err := h.clientService.RegisterEnterprise(
		userID,
		req.CompanyName,
		req.BusinessLicenseNo,
		req.BusinessLicenseDoc,
		req.LegalRepresentative,
		req.ContactPerson,
		req.ContactPhone,
		req.ContactEmail,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": client})
}

// GetProfile 获取当前客户档案
// GET /api/v1/client/profile
func (h *Handler) GetProfile(c *gin.Context) {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	client, err := h.clientService.GetProfile(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "客户档案不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": client})
}

// GetByID 根据ID获取客户
// GET /api/v1/client/:id
func (h *Handler) GetByID(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	client, err := h.clientService.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "客户不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": client})
}

// UpdateProfile 更新客户档案
// PUT /api/v1/client/profile
func (h *Handler) UpdateProfile(c *gin.Context) {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	client, err := h.clientService.GetProfile(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "客户档案不存在"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	if err := h.clientService.UpdateProfile(client.ID, updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "更新成功"})
}

// List 获取客户列表
// GET /api/v1/client/list
func (h *Handler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	clientType := c.Query("client_type")
	status := c.Query("status")

	clients, total, err := h.clientService.List(page, pageSize, clientType, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      clients,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// ==================== 征信查询 ====================

// RequestCreditCheck 发起征信查询
// POST /api/v1/client/credit/check
func (h *Handler) RequestCreditCheck(c *gin.Context) {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	client, err := h.clientService.GetProfile(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "客户档案不存在"})
		return
	}

	var req struct {
		Provider  string `json:"provider" binding:"required"` // baihang, sesame
		CheckType string `json:"check_type"`                  // pre_order, periodic, manual
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	if req.CheckType == "" {
		req.CheckType = "manual"
	}

	check, err := h.clientService.RequestCreditCheck(client.ID, req.Provider, req.CheckType)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": check})
}

// GetCreditHistory 获取征信查询历史
// GET /api/v1/client/credit/history
func (h *Handler) GetCreditHistory(c *gin.Context) {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	client, err := h.clientService.GetProfile(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "客户档案不存在"})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	checks, err := h.clientService.GetCreditHistory(client.ID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": checks})
}

// ==================== 企业资质 ====================

// SubmitEnterpriseCert 提交企业资质
// POST /api/v1/client/enterprise/cert
func (h *Handler) SubmitEnterpriseCert(c *gin.Context) {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	client, err := h.clientService.GetProfile(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "客户档案不存在"})
		return
	}

	var req struct {
		CertType         string `json:"cert_type" binding:"required"`
		CertName         string `json:"cert_name" binding:"required"`
		CertNo           string `json:"cert_no"`
		IssuingAuthority string `json:"issuing_authority"`
		IssueDate        string `json:"issue_date"`
		ExpireDate       string `json:"expire_date"`
		CertImage        string `json:"cert_image" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	var issueDate, expireDate *time.Time
	if req.IssueDate != "" {
		t, _ := time.Parse("2006-01-02", req.IssueDate)
		issueDate = &t
	}
	if req.ExpireDate != "" {
		t, _ := time.Parse("2006-01-02", req.ExpireDate)
		expireDate = &t
	}

	cert, err := h.clientService.SubmitEnterpriseCert(
		client.ID,
		req.CertType,
		req.CertName,
		req.CertNo,
		req.IssuingAuthority,
		issueDate,
		expireDate,
		req.CertImage,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": cert})
}

// GetEnterpriseCerts 获取企业资质列表
// GET /api/v1/client/enterprise/certs
func (h *Handler) GetEnterpriseCerts(c *gin.Context) {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	client, err := h.clientService.GetProfile(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "客户档案不存在"})
		return
	}

	certs, err := h.clientService.GetEnterpriseCerts(client.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": certs})
}

// ==================== 货物申报 ====================

// CreateCargoDeclaration 创建货物申报
// POST /api/v1/client/cargo/declaration
func (h *Handler) CreateCargoDeclaration(c *gin.Context) {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	client, err := h.clientService.GetProfile(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "客户档案不存在"})
		return
	}

	var req struct {
		CargoCategory        string   `json:"cargo_category" binding:"required"`
		CargoName            string   `json:"cargo_name" binding:"required"`
		CargoDescription     string   `json:"cargo_description"`
		Quantity             int      `json:"quantity"`
		TotalWeight          float64  `json:"total_weight"`
		Length               float64  `json:"length"`
		Width                float64  `json:"width"`
		Height               float64  `json:"height"`
		DeclaredValue        int64    `json:"declared_value"`
		IsHazardous          bool     `json:"is_hazardous"`
		HazardClass          string   `json:"hazard_class"`
		UNNumber             string   `json:"un_number"`
		IsTemperatureControl bool     `json:"is_temperature_control"`
		TemperatureMin       float64  `json:"temperature_min"`
		TemperatureMax       float64  `json:"temperature_max"`
		IsMoistureSensitive  bool     `json:"is_moisture_sensitive"`
		RequiresInsurance    bool     `json:"requires_insurance"`
		InsuranceAmount      int64    `json:"insurance_amount"`
		CargoImages          []string `json:"cargo_images"`
		PackingImages        []string `json:"packing_images"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	decl := &model.CargoDeclaration{
		CargoCategory:        req.CargoCategory,
		CargoName:            req.CargoName,
		CargoDescription:     req.CargoDescription,
		Quantity:             req.Quantity,
		TotalWeight:          req.TotalWeight,
		Length:               req.Length,
		Width:                req.Width,
		Height:               req.Height,
		DeclaredValue:        req.DeclaredValue,
		IsHazardous:          req.IsHazardous,
		HazardClass:          req.HazardClass,
		UNNumber:             req.UNNumber,
		IsTemperatureControl: req.IsTemperatureControl,
		TemperatureMin:       req.TemperatureMin,
		TemperatureMax:       req.TemperatureMax,
		IsMoistureSensitive:  req.IsMoistureSensitive,
		RequiresInsurance:    req.RequiresInsurance,
		InsuranceAmount:      req.InsuranceAmount,
	}

	// 设置图片JSON
	if len(req.CargoImages) > 0 {
		decl.CargoImages = model.JSON(mustMarshal(req.CargoImages))
	}
	if len(req.PackingImages) > 0 {
		decl.PackingImages = model.JSON(mustMarshal(req.PackingImages))
	}

	result, err := h.clientService.CreateCargoDeclaration(client.ID, decl)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// GetCargoDeclaration 获取货物申报详情
// GET /api/v1/client/cargo/declaration/:id
func (h *Handler) GetCargoDeclaration(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	decl, err := h.clientService.GetCargoDeclaration(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "申报单不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": decl})
}

// ListCargoDeclarations 获取货物申报列表
// GET /api/v1/client/cargo/declarations
func (h *Handler) ListCargoDeclarations(c *gin.Context) {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	client, err := h.clientService.GetProfile(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "客户档案不存在"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	declarations, total, err := h.clientService.ListCargoDeclarations(client.ID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      declarations,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// UpdateCargoDeclaration 更新货物申报
// PUT /api/v1/client/cargo/declaration/:id
func (h *Handler) UpdateCargoDeclaration(c *gin.Context) {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	client, err := h.clientService.GetProfile(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "客户档案不存在"})
		return
	}

	declID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var updates model.CargoDeclaration
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	if err := h.clientService.UpdateCargoDeclaration(client.ID, declID, &updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "更新成功"})
}

// ==================== 下单资格检查 ====================

// CheckOrderEligibility 检查下单资格
// GET /api/v1/client/order/eligibility
func (h *Handler) CheckOrderEligibility(c *gin.Context) {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	client, err := h.clientService.GetProfile(userID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"eligible": false,
			"reason":   "客户档案不存在，请先注册",
		})
		return
	}

	eligible, reason := h.clientService.CanPlaceOrder(client.ID)
	c.JSON(http.StatusOK, gin.H{
		"eligible": eligible,
		"reason":   reason,
	})
}

// ==================== 管理员接口 ====================

// AdminApproveClient 管理员审批通过客户
// POST /api/v1/client/admin/approve/:id
func (h *Handler) AdminApproveClient(c *gin.Context) {
	clientID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req struct {
		Note string `json:"note"`
	}
	c.ShouldBindJSON(&req)

	if err := h.clientService.ApproveClient(clientID, req.Note); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "审批通过"})
}

// AdminRejectClient 管理员审批拒绝客户
// POST /api/v1/client/admin/reject/:id
func (h *Handler) AdminRejectClient(c *gin.Context) {
	clientID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req struct {
		Note string `json:"note" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供拒绝原因"})
		return
	}

	if err := h.clientService.RejectClient(clientID, req.Note); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已拒绝"})
}

// AdminApproveEnterpriseCert 管理员审批企业资质
// POST /api/v1/client/admin/cert/approve/:id
func (h *Handler) AdminApproveEnterpriseCert(c *gin.Context) {
	adminID := c.GetInt64("user_id")
	certID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req struct {
		Note string `json:"note"`
	}
	c.ShouldBindJSON(&req)

	if err := h.clientService.ApproveEnterpriseCert(certID, req.Note, adminID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "审批通过"})
}

// AdminRejectEnterpriseCert 管理员拒绝企业资质
// POST /api/v1/client/admin/cert/reject/:id
func (h *Handler) AdminRejectEnterpriseCert(c *gin.Context) {
	adminID := c.GetInt64("user_id")
	certID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req struct {
		Note string `json:"note" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供拒绝原因"})
		return
	}

	if err := h.clientService.RejectEnterpriseCert(certID, req.Note, adminID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已拒绝"})
}

// AdminApproveCargoDeclaration 管理员审批货物申报
// POST /api/v1/client/admin/cargo/approve/:id
func (h *Handler) AdminApproveCargoDeclaration(c *gin.Context) {
	adminID := c.GetInt64("user_id")
	declID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req struct {
		Note string `json:"note"`
	}
	c.ShouldBindJSON(&req)

	if err := h.clientService.ApproveCargoDeclaration(declID, req.Note, adminID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "审批通过"})
}

// AdminRejectCargoDeclaration 管理员拒绝货物申报
// POST /api/v1/client/admin/cargo/reject/:id
func (h *Handler) AdminRejectCargoDeclaration(c *gin.Context) {
	adminID := c.GetInt64("user_id")
	declID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req struct {
		Note string `json:"note" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供拒绝原因"})
		return
	}

	if err := h.clientService.RejectCargoDeclaration(declID, req.Note, adminID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已拒绝"})
}

// AdminListPendingVerification 获取待审批客户列表
// GET /api/v1/client/admin/pending
func (h *Handler) AdminListPendingVerification(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	clients, total, err := h.clientService.ListPendingVerification(page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      clients,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// AdminListPendingCargoDeclarations 获取待审批货物申报列表
// GET /api/v1/client/admin/cargo/pending
func (h *Handler) AdminListPendingCargoDeclarations(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	declarations, total, err := h.clientService.ListPendingCargoDeclarations(page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      declarations,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// 辅助函数
func mustMarshal(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}
