package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type V2Envelope struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
	Meta    interface{} `json:"meta,omitempty"`
	TraceID string      `json:"trace_id"`
}

type V2ListData struct {
	Items interface{} `json:"items"`
}

type V2PageMeta struct {
	Page     int   `json:"page"`
	PageSize int   `json:"page_size"`
	Total    int64 `json:"total"`
}

const (
	V2CodeOK             = "OK"
	V2CodeBadRequest     = "BAD_REQUEST"
	V2CodeValidation     = "VALIDATION_ERROR"
	V2CodeUnauthorized   = "UNAUTHORIZED"
	V2CodeForbidden      = "FORBIDDEN"
	V2CodeNotFound       = "NOT_FOUND"
	V2CodeConflict       = "CONFLICT"
	V2CodeNotImplemented = "NOT_IMPLEMENTED"
	V2CodeInternalError  = "INTERNAL_ERROR"
)

func V2Success(c *gin.Context, data interface{}) {
	V2SuccessWithMeta(c, data, nil)
}

func V2SuccessWithMeta(c *gin.Context, data interface{}, meta interface{}) {
	c.JSON(http.StatusOK, V2Envelope{
		Code:    V2CodeOK,
		Message: "success",
		Data:    data,
		Meta:    meta,
		TraceID: getV2TraceID(c),
	})
}

func V2SuccessList(c *gin.Context, items interface{}, total int64) {
	page, pageSize := getV2Pagination(c)
	V2SuccessWithMeta(c, V2ListData{Items: items}, V2PageMeta{
		Page:     page,
		PageSize: pageSize,
		Total:    total,
	})
}

func V2Error(c *gin.Context, httpStatus int, code, message string) {
	if code == "" {
		code = V2CodeInternalError
	}
	if message == "" {
		message = "error"
	}
	c.JSON(httpStatus, V2Envelope{
		Code:    code,
		Message: message,
		TraceID: getV2TraceID(c),
	})
}

func V2BadRequest(c *gin.Context, message string) {
	V2Error(c, http.StatusBadRequest, V2CodeBadRequest, message)
}

func V2ValidationError(c *gin.Context, message string) {
	V2Error(c, http.StatusBadRequest, V2CodeValidation, message)
}

func V2Unauthorized(c *gin.Context, message string) {
	V2Error(c, http.StatusUnauthorized, V2CodeUnauthorized, message)
}

func V2Forbidden(c *gin.Context, message string) {
	V2Error(c, http.StatusForbidden, V2CodeForbidden, message)
}

func V2NotFound(c *gin.Context, message string) {
	V2Error(c, http.StatusNotFound, V2CodeNotFound, message)
}

func V2Conflict(c *gin.Context, message string) {
	V2Error(c, http.StatusConflict, V2CodeConflict, message)
}

func V2NotImplemented(c *gin.Context, message string) {
	if message == "" {
		message = "endpoint not implemented"
	}
	V2Error(c, http.StatusNotImplemented, V2CodeNotImplemented, message)
}

func V2InternalError(c *gin.Context, message string) {
	V2Error(c, http.StatusInternalServerError, V2CodeInternalError, message)
}

func getV2TraceID(c *gin.Context) string {
	if c == nil {
		return ""
	}
	if value, ok := c.Get("trace_id"); ok {
		if traceID, ok := value.(string); ok {
			return traceID
		}
	}
	return ""
}

func getV2Pagination(c *gin.Context) (int, int) {
	page := 1
	pageSize := 20
	if c == nil {
		return page, pageSize
	}
	if value, ok := c.Get("page"); ok {
		if v, ok := value.(int); ok && v > 0 {
			page = v
		}
	}
	if value, ok := c.Get("page_size"); ok {
		if v, ok := value.(int); ok && v > 0 {
			pageSize = v
		}
	}
	return page, pageSize
}
