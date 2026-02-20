package demand

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	demandService   *service.DemandService
	matchingService *service.MatchingService
}

func NewHandler(demandService *service.DemandService, matchingService *service.MatchingService) *Handler {
	return &Handler{demandService: demandService, matchingService: matchingService}
}

// === Rental Offers ===

func (h *Handler) CreateOffer(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var offer model.RentalOffer
	if err := c.ShouldBindJSON(&offer); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	offer.OwnerID = userID
	if err := h.demandService.CreateOffer(&offer); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, offer)
}

func (h *Handler) GetOffer(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	offer, err := h.demandService.GetOffer(id)
	if err != nil {
		response.Error(c, response.CodeNotFound, "供给不存在")
		return
	}
	response.Success(c, offer)
}

func (h *Handler) UpdateOffer(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var offer model.RentalOffer
	if err := c.ShouldBindJSON(&offer); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	offer.ID = id
	if err := h.demandService.UpdateOffer(&offer); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) DeleteOffer(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if err := h.demandService.DeleteOffer(id); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) ListOffers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filters := make(map[string]interface{})
	if st := c.Query("service_type"); st != "" {
		filters["service_type"] = st
	}
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	} else {
		filters["status"] = "active"
	}
	offers, total, err := h.demandService.ListOffers(page, pageSize, filters)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, offers, total, page, pageSize)
}

func (h *Handler) MyOffers(c *gin.Context) {
	userID := middleware.GetUserID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	offers, total, err := h.demandService.ListMyOffers(userID, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, offers, total, page, pageSize)
}

// === Rental Demands ===

func (h *Handler) CreateDemand(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var demand model.RentalDemand
	if err := c.ShouldBindJSON(&demand); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	demand.RenterID = userID
	if err := h.demandService.CreateDemand(&demand); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}

	// Trigger matching
	go h.matchingService.MatchRentalDemand(demand.ID, 50)

	response.Success(c, demand)
}

func (h *Handler) GetDemand(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	demand, err := h.demandService.GetDemand(id)
	if err != nil {
		response.Error(c, response.CodeNotFound, "需求不存在")
		return
	}
	response.Success(c, demand)
}

func (h *Handler) UpdateDemand(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var demand model.RentalDemand
	if err := c.ShouldBindJSON(&demand); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	demand.ID = id
	if err := h.demandService.UpdateDemand(&demand); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) DeleteDemand(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if err := h.demandService.DeleteDemand(id); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) ListDemands(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filters := make(map[string]interface{})
	if dt := c.Query("demand_type"); dt != "" {
		filters["demand_type"] = dt
	}
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	} else {
		filters["status"] = "active"
	}
	demands, total, err := h.demandService.ListDemands(page, pageSize, filters)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, demands, total, page, pageSize)
}

func (h *Handler) MyDemands(c *gin.Context) {
	userID := middleware.GetUserID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	demands, total, err := h.demandService.ListMyDemands(userID, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, demands, total, page, pageSize)
}

func (h *Handler) GetDemandMatches(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	matches, err := h.matchingService.GetMatches(id, "rental_demand")
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, matches)
}

// === Cargo Demands ===

func (h *Handler) CreateCargo(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var cargo model.CargoDemand
	if err := c.ShouldBindJSON(&cargo); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	cargo.PublisherID = userID
	if err := h.demandService.CreateCargo(&cargo); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}

	go h.matchingService.MatchCargoDemand(cargo.ID, 50)

	response.Success(c, cargo)
}

func (h *Handler) GetCargo(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	cargo, err := h.demandService.GetCargo(id)
	if err != nil {
		response.Error(c, response.CodeNotFound, "货运需求不存在")
		return
	}
	response.Success(c, cargo)
}

func (h *Handler) UpdateCargo(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var cargo model.CargoDemand
	if err := c.ShouldBindJSON(&cargo); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	cargo.ID = id
	if err := h.demandService.UpdateCargo(&cargo); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) DeleteCargo(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if err := h.demandService.DeleteCargo(id); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) ListCargos(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filters := make(map[string]interface{})
	if ct := c.Query("cargo_type"); ct != "" {
		filters["cargo_type"] = ct
	}
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	} else {
		filters["status"] = "active"
	}
	cargos, total, err := h.demandService.ListCargos(page, pageSize, filters)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, cargos, total, page, pageSize)
}

func (h *Handler) MyCargos(c *gin.Context) {
	userID := middleware.GetUserID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	cargos, total, err := h.demandService.ListMyCargos(userID, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, cargos, total, page, pageSize)
}

func (h *Handler) GetCargoMatches(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	matches, err := h.matchingService.GetMatches(id, "cargo_demand")
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, matches)
}
