package owner

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	ownerService *service.OwnerService
	droneService *service.DroneService
}

func NewHandler(ownerService *service.OwnerService, droneService *service.DroneService) *Handler {
	return &Handler{ownerService: ownerService, droneService: droneService}
}

func (h *Handler) GetProfile(c *gin.Context) {
	userID := middleware.GetUserID(c)
	profile, err := h.ownerService.GetProfile(userID)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, profile)
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req service.OwnerProfileInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	profile, err := h.ownerService.UpdateProfile(userID, &req)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, profile)
}

func (h *Handler) ListDrones(c *gin.Context) {
	userID := middleware.GetUserID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	drones, total, err := h.ownerService.ListMyDrones(userID, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, drones, total, page, pageSize)
}

func (h *Handler) CreateDrone(c *gin.Context) {
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

func (h *Handler) GetDrone(c *gin.Context) {
	userID := middleware.GetUserID(c)
	droneID, _ := strconv.ParseInt(c.Param("drone_id"), 10, 64)
	drone, err := h.ownerService.GetOwnedDrone(userID, droneID)
	if err != nil {
		response.Error(c, response.CodeForbidden, err.Error())
		return
	}
	response.Success(c, drone)
}

func (h *Handler) ListSupplies(c *gin.Context) {
	userID := middleware.GetUserID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")
	supplies, total, err := h.ownerService.ListMySupplies(userID, status, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, supplies, total, page, pageSize)
}

func (h *Handler) CreateSupply(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req service.OwnerSupplyInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	supply, err := h.ownerService.CreateSupply(userID, &req)
	if err != nil {
		response.Error(c, response.CodeParamError, err.Error())
		return
	}
	response.Success(c, supply)
}

func (h *Handler) GetSupply(c *gin.Context) {
	userID := middleware.GetUserID(c)
	supplyID, _ := strconv.ParseInt(c.Param("supply_id"), 10, 64)
	supply, err := h.ownerService.GetSupply(userID, supplyID)
	if err != nil {
		response.Error(c, response.CodeNotFound, err.Error())
		return
	}
	response.Success(c, supply)
}

func (h *Handler) UpdateSupplyStatus(c *gin.Context) {
	userID := middleware.GetUserID(c)
	supplyID, _ := strconv.ParseInt(c.Param("supply_id"), 10, 64)
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	supply, err := h.ownerService.UpdateSupplyStatus(userID, supplyID, req.Status)
	if err != nil {
		response.Error(c, response.CodeParamError, err.Error())
		return
	}
	response.Success(c, supply)
}

func (h *Handler) RecommendedDemands(c *gin.Context) {
	userID := middleware.GetUserID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	demands, total, err := h.ownerService.ListRecommendedDemands(userID, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, demands, total, page, pageSize)
}

func (h *Handler) CreateQuote(c *gin.Context) {
	userID := middleware.GetUserID(c)
	demandID, _ := strconv.ParseInt(c.Param("demand_id"), 10, 64)
	var req service.CreateQuoteInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	quote, err := h.ownerService.CreateDemandQuote(userID, demandID, &req)
	if err != nil {
		response.Error(c, response.CodeParamError, err.Error())
		return
	}
	response.Success(c, quote)
}

func (h *Handler) ListQuotes(c *gin.Context) {
	userID := middleware.GetUserID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")
	quotes, total, err := h.ownerService.ListMyQuotes(userID, status, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, quotes, total, page, pageSize)
}

func (h *Handler) ListPilotBindings(c *gin.Context) {
	userID := middleware.GetUserID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")
	bindings, total, err := h.ownerService.ListPilotBindings(userID, status, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, bindings, total, page, pageSize)
}

func (h *Handler) InvitePilotBinding(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req struct {
		PilotUserID int64  `json:"pilot_user_id" binding:"required"`
		IsPriority  bool   `json:"is_priority"`
		Note        string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	binding, err := h.ownerService.InvitePilotBinding(userID, req.PilotUserID, req.IsPriority, req.Note)
	if err != nil {
		response.Error(c, response.CodeParamError, err.Error())
		return
	}
	response.Success(c, binding)
}

func (h *Handler) ConfirmPilotBinding(c *gin.Context) {
	userID := middleware.GetUserID(c)
	bindingID, _ := strconv.ParseInt(c.Param("binding_id"), 10, 64)
	binding, err := h.ownerService.ConfirmPilotBinding(userID, bindingID)
	if err != nil {
		response.Error(c, response.CodeParamError, err.Error())
		return
	}
	response.Success(c, binding)
}

func (h *Handler) RejectPilotBinding(c *gin.Context) {
	userID := middleware.GetUserID(c)
	bindingID, _ := strconv.ParseInt(c.Param("binding_id"), 10, 64)
	binding, err := h.ownerService.RejectPilotBinding(userID, bindingID)
	if err != nil {
		response.Error(c, response.CodeParamError, err.Error())
		return
	}
	response.Success(c, binding)
}

func (h *Handler) UpdatePilotBindingStatus(c *gin.Context) {
	userID := middleware.GetUserID(c)
	bindingID, _ := strconv.ParseInt(c.Param("binding_id"), 10, 64)
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	binding, err := h.ownerService.UpdatePilotBindingStatus(userID, bindingID, req.Status)
	if err != nil {
		response.Error(c, response.CodeParamError, err.Error())
		return
	}
	response.Success(c, binding)
}
