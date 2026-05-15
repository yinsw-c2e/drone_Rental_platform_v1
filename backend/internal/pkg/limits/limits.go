package limits

const (
	DefaultPageSize = 20
	MaxPageSize     = 100

	DefaultListPreviewSize = 40

	DefaultPositionHistoryLimit = 100
	MaxPositionHistoryLimit     = 500

	DefaultRouteLimit = 20
	MaxRouteLimit     = 100

	MaxMatchingCandidates = 200
	MaxNearbyLimit        = 100
	MaxRadiusKM           = 200
)

func NormalizePagination(page, pageSize int) (int, int) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = DefaultPageSize
	}
	if pageSize > MaxPageSize {
		pageSize = MaxPageSize
	}
	return page, pageSize
}

func NormalizeLimit(limit, fallback, max int) int {
	if fallback <= 0 {
		fallback = DefaultListPreviewSize
	}
	if max <= 0 {
		max = MaxPageSize
	}
	if limit <= 0 {
		limit = fallback
	}
	if limit > max {
		limit = max
	}
	return limit
}

func NormalizeRadiusKM(radius, fallback float64) float64 {
	if fallback <= 0 {
		fallback = 50
	}
	if radius <= 0 {
		radius = fallback
	}
	if radius > MaxRadiusKM {
		radius = MaxRadiusKM
	}
	return radius
}
