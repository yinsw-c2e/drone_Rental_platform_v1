package address

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	addressService *service.AddressService
}

func NewHandler(addressService *service.AddressService) *Handler {
	return &Handler{addressService: addressService}
}

type CreateAddressReq struct {
	Label     string  `json:"label"`
	Name      string  `json:"name"`
	Address   string  `json:"address" binding:"required"`
	Province  string  `json:"province"`
	City      string  `json:"city"`
	District  string  `json:"district"`
	Latitude  float64 `json:"latitude" binding:"required"`
	Longitude float64 `json:"longitude" binding:"required"`
	IsDefault bool    `json:"is_default"`
}

type UpdateAddressReq struct {
	Label     *string  `json:"label"`
	Name      *string  `json:"name"`
	Address   *string  `json:"address"`
	Province  *string  `json:"province"`
	City      *string  `json:"city"`
	District  *string  `json:"district"`
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
	IsDefault *bool    `json:"is_default"`
}

// List GET /address
func (h *Handler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)
	addresses, err := h.addressService.List(userID)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, addresses)
}

// Create POST /address
func (h *Handler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req CreateAddressReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	addr := &model.UserAddress{
		UserID:    userID,
		Label:     req.Label,
		Name:      req.Name,
		Address:   req.Address,
		Province:  req.Province,
		City:      req.City,
		District:  req.District,
		Latitude:  req.Latitude,
		Longitude: req.Longitude,
		IsDefault: req.IsDefault,
	}

	if err := h.addressService.Create(addr); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, addr)
}

// Update PUT /address/:id
func (h *Handler) Update(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的地址ID")
		return
	}

	var req UpdateAddressReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	updates := make(map[string]interface{})
	if req.Label != nil {
		updates["label"] = *req.Label
	}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Address != nil {
		updates["address"] = *req.Address
	}
	if req.Province != nil {
		updates["province"] = *req.Province
	}
	if req.City != nil {
		updates["city"] = *req.City
	}
	if req.District != nil {
		updates["district"] = *req.District
	}
	if req.Latitude != nil {
		updates["latitude"] = *req.Latitude
	}
	if req.Longitude != nil {
		updates["longitude"] = *req.Longitude
	}
	if req.IsDefault != nil {
		updates["is_default"] = *req.IsDefault
	}

	if err := h.addressService.Update(id, userID, updates); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

// Delete DELETE /address/:id
func (h *Handler) Delete(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的地址ID")
		return
	}

	if err := h.addressService.Delete(id, userID); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

// SetDefault PUT /address/:id/default
func (h *Handler) SetDefault(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的地址ID")
		return
	}

	if err := h.addressService.SetDefault(id, userID); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}
