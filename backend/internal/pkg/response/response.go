package response

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type Response struct {
	Code      int         `json:"code"`
	Message   string      `json:"message"`
	Data      interface{} `json:"data,omitempty"`
	Timestamp int64       `json:"timestamp"`
}

type PageData struct {
	List     interface{} `json:"list"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
}

func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code:      0,
		Message:   "success",
		Data:      data,
		Timestamp: time.Now().Unix(),
	})
}

func SuccessWithPage(c *gin.Context, list interface{}, total int64, page, pageSize int) {
	c.JSON(http.StatusOK, Response{
		Code:    0,
		Message: "success",
		Data: PageData{
			List:     list,
			Total:    total,
			Page:     page,
			PageSize: pageSize,
		},
		Timestamp: time.Now().Unix(),
	})
}

func Error(c *gin.Context, code int, message string) {
	c.JSON(http.StatusOK, Response{
		Code:      code,
		Message:   message,
		Timestamp: time.Now().Unix(),
	})
}

func Unauthorized(c *gin.Context, message string) {
	c.JSON(http.StatusUnauthorized, Response{
		Code:      401,
		Message:   message,
		Timestamp: time.Now().Unix(),
	})
}

func Forbidden(c *gin.Context, message string) {
	c.JSON(http.StatusForbidden, Response{
		Code:      403,
		Message:   message,
		Timestamp: time.Now().Unix(),
	})
}

func BadRequest(c *gin.Context, message string) {
	c.JSON(http.StatusOK, Response{
		Code:      400,
		Message:   message,
		Timestamp: time.Now().Unix(),
	})
}

func ServerError(c *gin.Context, message string) {
	c.JSON(http.StatusInternalServerError, Response{
		Code:      500,
		Message:   message,
		Timestamp: time.Now().Unix(),
	})
}

// Common error codes
const (
	CodeSuccess         = 0
	CodeParamError      = 1001
	CodeUnauthorized    = 1002
	CodeForbidden       = 1003
	CodeNotFound        = 1004
	CodeAlreadyExists   = 1005
	CodeServerError     = 2001
	CodeDBError         = 2002
	CodeRedisError      = 2003
	CodeSMSError        = 3001
	CodePaymentError    = 3002
	CodeUploadError     = 3003
	CodeVerifyCodeError = 4001
	CodeOrderError      = 5001
)
