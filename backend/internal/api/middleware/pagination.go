package middleware

import (
	"strconv"

	"github.com/gin-gonic/gin"
)

const (
	pageContextKey     = "page"
	pageSizeContextKey = "page_size"
)

func PaginationMiddleware(defaultPage, defaultPageSize, maxPageSize int) gin.HandlerFunc {
	if defaultPage <= 0 {
		defaultPage = 1
	}
	if defaultPageSize <= 0 {
		defaultPageSize = 20
	}
	if maxPageSize < defaultPageSize {
		maxPageSize = defaultPageSize
	}

	return func(c *gin.Context) {
		page := parsePositiveInt(c.Query("page"), defaultPage)
		pageSize := parsePositiveInt(c.Query("page_size"), defaultPageSize)
		if pageSize > maxPageSize {
			pageSize = maxPageSize
		}

		c.Set(pageContextKey, page)
		c.Set(pageSizeContextKey, pageSize)
		c.Next()
	}
}

func GetPagination(c *gin.Context) (int, int) {
	if c == nil {
		return 1, 20
	}

	page := 1
	pageSize := 20
	if value, ok := c.Get(pageContextKey); ok {
		if v, ok := value.(int); ok && v > 0 {
			page = v
		}
	}
	if value, ok := c.Get(pageSizeContextKey); ok {
		if v, ok := value.(int); ok && v > 0 {
			pageSize = v
		}
	}
	return page, pageSize
}

func parsePositiveInt(raw string, fallback int) int {
	if fallback <= 0 {
		fallback = 1
	}
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}
