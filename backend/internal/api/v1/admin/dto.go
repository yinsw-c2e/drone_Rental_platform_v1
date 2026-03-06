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

	// 平台认证状态
	CertificationStatus string  `json:"certification_status"`
	AvailabilityStatus  string  `json:"availability_status"`
	Rating              float64 `json:"rating"`
	OrderCount          int     `json:"order_count"`

	// UOM平台登记
	UOMRegistrationNo  string     `json:"uom_registration_no"`
	UOMVerified        string     `json:"uom_verified"`
	UOMVerifiedAt      *time.Time `json:"uom_verified_at"`
	UOMRegistrationDoc string     `json:"uom_registration_doc"`

	// 保险信息
	InsurancePolicyNo   string     `json:"insurance_policy_no"`
	InsuranceCompany    string     `json:"insurance_company"`
	InsuranceCoverage   int64      `json:"insurance_coverage"`
	InsuranceExpireDate *time.Time `json:"insurance_expire_date"`
	InsuranceDoc        string     `json:"insurance_doc"`
	InsuranceVerified   string     `json:"insurance_verified"`

	// 适航证书
	AirworthinessCertNo     string     `json:"airworthiness_cert_no"`
	AirworthinessCertExpire *time.Time `json:"airworthiness_cert_expire"`
	AirworthinessCertDoc    string     `json:"airworthiness_cert_doc"`
	AirworthinessVerified   string     `json:"airworthiness_verified"`

	// 机主信息（精简版）
	OwnerID       int64  `json:"owner_id"`
	OwnerNickname string `json:"owner_nickname"`
	OwnerPhone    string `json:"owner_phone"`
	OwnerAvatar   string `json:"owner_avatar"`

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
		// UOM
		UOMRegistrationNo:  drone.UOMRegistrationNo,
		UOMVerified:        drone.UOMVerified,
		UOMVerifiedAt:      drone.UOMVerifiedAt,
		UOMRegistrationDoc: drone.UOMRegistrationDoc,
		// 保险
		InsurancePolicyNo:   drone.InsurancePolicyNo,
		InsuranceCompany:    drone.InsuranceCompany,
		InsuranceCoverage:   drone.InsuranceCoverage,
		InsuranceExpireDate: drone.InsuranceExpireDate,
		InsuranceDoc:        drone.InsuranceDoc,
		InsuranceVerified:   drone.InsuranceVerified,
		// 适航
		AirworthinessCertNo:     drone.AirworthinessCertNo,
		AirworthinessCertExpire: drone.AirworthinessCertExpire,
		AirworthinessCertDoc:    drone.AirworthinessCertDoc,
		AirworthinessVerified:   drone.AirworthinessVerified,
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

