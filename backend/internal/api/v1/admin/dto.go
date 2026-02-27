package admin

import (
	"time"
	"wurenji-backend/internal/model"
)

// DroneDTO 无人机数据传输对象（用于管理后台）
type DroneDTO struct {
	// 基本信息
	ID           int64   `json:"id"`
	Brand        string  `json:"brand"`
	Model        string  `json:"model"`
	SerialNumber string  `json:"serial_number"`
	Description  string  `json:"description"`
	
	// 性能参数
	MaxLoad       float64 `json:"max_load"`
	MaxFlightTime int     `json:"max_flight_time"`
	MaxDistance   float64 `json:"max_distance"`
	
	// 价格信息
	DailyPrice  int64 `json:"daily_price"`
	HourlyPrice int64 `json:"hourly_price"`
	Deposit     int64 `json:"deposit"`
	
	// 位置信息
	City    string `json:"city"`
	Address string `json:"address"`
	
	// 状态信息
	CertificationStatus string  `json:"certification_status"`
	AvailabilityStatus  string  `json:"availability_status"`
	Rating              float64 `json:"rating"`
	OrderCount          int     `json:"order_count"`
	
	// 机主信息（精简版）
	OwnerID       int64  `json:"owner_id"`
	OwnerNickname string `json:"owner_nickname"` // 只传递昵称
	OwnerPhone    string `json:"owner_phone"`    // 只传递手机号（管理员可见）
	OwnerAvatar   string `json:"owner_avatar"`   // 只传递头像
	
	// 时间戳
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UserSimpleDTO 用户简化信息（用于嵌套在其他对象中）
type UserSimpleDTO struct {
	ID       int64  `json:"id"`
	Nickname string `json:"nickname"`
	Phone    string `json:"phone"`
	Avatar   string `json:"avatar_url"`
}

// ToDroneDTO 将 model.Drone 转换为 DroneDTO
func ToDroneDTO(drone *model.Drone, owner *model.User) *DroneDTO {
	dto := &DroneDTO{
		ID:                  drone.ID,
		Brand:               drone.Brand,
		Model:               drone.Model,
		SerialNumber:        drone.SerialNumber,
		Description:         drone.Description,
		MaxLoad:             drone.MaxLoad,
		MaxFlightTime:       drone.MaxFlightTime,
		MaxDistance:         drone.MaxDistance,
		DailyPrice:          drone.DailyPrice,
		HourlyPrice:         drone.HourlyPrice,
		Deposit:             drone.Deposit,
		City:                drone.City,
		Address:             drone.Address,
		CertificationStatus: drone.CertificationStatus,
		AvailabilityStatus:  drone.AvailabilityStatus,
		Rating:              drone.Rating,
		OrderCount:          drone.OrderCount,
		OwnerID:             drone.OwnerID,
		CreatedAt:           drone.CreatedAt,
		UpdatedAt:           drone.UpdatedAt,
	}
	
	// 如果提供了 owner 信息，填充机主信息
	if owner != nil {
		dto.OwnerNickname = owner.Nickname
		dto.OwnerPhone = owner.Phone
		dto.OwnerAvatar = owner.AvatarURL
	}
	
	return dto
}

// ToDroneDTOList 批量转换
func ToDroneDTOList(drones []model.Drone, owners map[int64]*model.User) []*DroneDTO {
	dtoList := make([]*DroneDTO, 0, len(drones))
	for i := range drones {
		owner := owners[drones[i].OwnerID]
		dtoList = append(dtoList, ToDroneDTO(&drones[i], owner))
	}
	return dtoList
}

