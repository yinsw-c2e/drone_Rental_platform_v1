package common

import (
	"errors"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"wurenji-backend/internal/pkg/response"
)

func HandleServiceError(c *gin.Context, err error) {
	if err == nil {
		return
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		response.V2NotFound(c, err.Error())
		return
	}

	message := err.Error()
	switch {
	case strings.Contains(message, "不存在"):
		response.V2NotFound(c, message)
	case strings.Contains(message, "无权"), strings.Contains(message, "未授权"):
		response.V2Forbidden(c, message)
	case strings.Contains(message, "未初始化"), strings.Contains(message, "数据库"):
		response.V2InternalError(c, message)
	case strings.Contains(message, "已存在"), strings.Contains(message, "已转为订单"), strings.Contains(message, "不可重复"):
		response.V2Conflict(c, message)
	default:
		response.V2BadRequest(c, message)
	}
}
