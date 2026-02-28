package location

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/pkg/amap"
	"wurenji-backend/internal/pkg/response"
)

type Handler struct {
	amapService *amap.AmapService
}

func NewHandler(amapService *amap.AmapService) *Handler {
	return &Handler{amapService: amapService}
}

// SearchPOI GET /location/search?keyword=xxx&city=xxx&page=1&page_size=20
func (h *Handler) SearchPOI(c *gin.Context) {
	keyword := c.Query("keyword")
	if keyword == "" {
		response.BadRequest(c, "请输入搜索关键词")
		return
	}
	city := c.Query("city")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	pois, total, err := h.amapService.SearchPOI(keyword, city, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeServerError, "搜索失败: "+err.Error())
		return
	}
	response.Success(c, gin.H{"list": pois, "total": total})
}

// ReverseGeoCode GET /location/regeocode?lng=xxx&lat=xxx
func (h *Handler) ReverseGeoCode(c *gin.Context) {
	lngStr := c.Query("lng")
	latStr := c.Query("lat")
	if lngStr == "" || latStr == "" {
		response.BadRequest(c, "请提供经纬度参数")
		return
	}
	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil {
		response.BadRequest(c, "经度参数格式错误")
		return
	}
	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		response.BadRequest(c, "纬度参数格式错误")
		return
	}

	result, err := h.amapService.ReverseGeoCode(lng, lat)
	if err != nil {
		response.Error(c, response.CodeServerError, "逆地理编码失败: "+err.Error())
		return
	}
	response.Success(c, result)
}

// Nearby GET /location/nearby?lng=xxx&lat=xxx&radius=1000&keyword=xxx
func (h *Handler) Nearby(c *gin.Context) {
	lngStr := c.Query("lng")
	latStr := c.Query("lat")
	if lngStr == "" || latStr == "" {
		response.BadRequest(c, "请提供经纬度参数")
		return
	}
	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil {
		response.BadRequest(c, "经度参数格式错误")
		return
	}
	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		response.BadRequest(c, "纬度参数格式错误")
		return
	}

	radius, _ := strconv.Atoi(c.DefaultQuery("radius", "1000"))
	keyword := c.DefaultQuery("keyword", "")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	pois, total, err := h.amapService.SearchNearby(lng, lat, radius, keyword, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeServerError, "周边搜索失败: "+err.Error())
		return
	}
	response.Success(c, gin.H{"list": pois, "total": total})
}
