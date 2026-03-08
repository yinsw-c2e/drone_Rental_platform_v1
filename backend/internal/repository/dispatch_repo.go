package repository

import (
	"fmt"
	"time"
	"wurenji-backend/internal/model"

	"gorm.io/gorm"
)

type DispatchRepo struct {
	db *gorm.DB
}

func NewDispatchRepo(db *gorm.DB) *DispatchRepo {
	return &DispatchRepo{db: db}
}

// ==================== 派单任务 CRUD ====================

func (r *DispatchRepo) CreateTask(task *model.DispatchTask) error {
	return r.db.Create(task).Error
}

func (r *DispatchRepo) GetTaskByID(id int64) (*model.DispatchTask, error) {
	var task model.DispatchTask
	err := r.db.First(&task, id).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *DispatchRepo) GetTaskByNo(taskNo string) (*model.DispatchTask, error) {
	var task model.DispatchTask
	err := r.db.Where("task_no = ?", taskNo).First(&task).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *DispatchRepo) UpdateTask(task *model.DispatchTask) error {
	return r.db.Save(task).Error
}

func (r *DispatchRepo) UpdateTaskStatus(id int64, status string) error {
	return r.db.Model(&model.DispatchTask{}).Where("id = ?", id).Update("status", status).Error
}

func (r *DispatchRepo) UpdateTaskFields(id int64, fields map[string]interface{}) error {
	return r.db.Model(&model.DispatchTask{}).Where("id = ?", id).Updates(fields).Error
}

// ==================== 派单任务查询 ====================

func (r *DispatchRepo) ListPendingTasks(limit int) ([]model.DispatchTask, error) {
	var tasks []model.DispatchTask
	query := r.db.Where("status IN ?", []string{"pending", "matching"}).
		Where("(dispatch_deadline IS NULL OR dispatch_deadline > ?)", time.Now()).
		Order("priority DESC, created_at ASC")

	if limit > 0 {
		query = query.Limit(limit)
	}

	err := query.Find(&tasks).Error
	return tasks, err
}

func (r *DispatchRepo) ListTasksByClient(clientID int64, page, pageSize int, status string) ([]model.DispatchTask, int64, error) {
	var tasks []model.DispatchTask
	var total int64

	query := r.db.Model(&model.DispatchTask{}).Where("client_id = ?", clientID)
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).
		Order("created_at DESC").Find(&tasks).Error; err != nil {
		return nil, 0, err
	}

	return tasks, total, nil
}

func (r *DispatchRepo) ListTasksByPilot(pilotID int64, page, pageSize int, status string) ([]model.DispatchTask, int64, error) {
	var tasks []model.DispatchTask
	var total int64

	query := r.db.Model(&model.DispatchTask{}).Where("assigned_pilot_id = ?", pilotID)
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).
		Order("created_at DESC").Find(&tasks).Error; err != nil {
		return nil, 0, err
	}

	return tasks, total, nil
}

func (r *DispatchRepo) GetExpiredTasks() ([]model.DispatchTask, error) {
	var tasks []model.DispatchTask
	err := r.db.Where("status IN ?", []string{"pending", "matching", "dispatching"}).
		Where("dispatch_deadline IS NOT NULL AND dispatch_deadline < ?", time.Now()).
		Find(&tasks).Error
	return tasks, err
}

// ==================== 派单候选人 ====================

func (r *DispatchRepo) CreateCandidate(candidate *model.DispatchCandidate) error {
	return r.db.Create(candidate).Error
}

func (r *DispatchRepo) BatchCreateCandidates(candidates []model.DispatchCandidate) error {
	if len(candidates) == 0 {
		return nil
	}
	return r.db.Create(&candidates).Error
}

// DeletePendingCandidatesByTask 删除该任务中 pending/notified 状态的候选人（重新匹配前清除旧数据，防止重复）
func (r *DispatchRepo) DeletePendingCandidatesByTask(taskID int64) {
	r.db.Where("task_id = ? AND status IN ?", taskID, []string{"pending", "notified"}).Delete(&model.DispatchCandidate{})
}

func (r *DispatchRepo) GetCandidateByID(id int64) (*model.DispatchCandidate, error) {
	var candidate model.DispatchCandidate
	err := r.db.Preload("Pilot").Preload("Drone").First(&candidate, id).Error
	if err != nil {
		return nil, err
	}
	return &candidate, nil
}

func (r *DispatchRepo) GetCandidatesByTask(taskID int64) ([]model.DispatchCandidate, error) {
	var candidates []model.DispatchCandidate
	err := r.db.Where("task_id = ?", taskID).
		Order("total_score DESC").Find(&candidates).Error
	return candidates, err
}

func (r *DispatchRepo) GetTopCandidate(taskID int64) (*model.DispatchCandidate, error) {
	var candidate model.DispatchCandidate
	err := r.db.Where("task_id = ? AND status = ?", taskID, "pending").
		Order("total_score DESC").First(&candidate).Error
	if err != nil {
		return nil, err
	}
	return &candidate, nil
}

func (r *DispatchRepo) UpdateCandidateStatus(id int64, status string) error {
	updates := map[string]interface{}{
		"status": status,
	}
	if status == "notified" {
		now := time.Now()
		updates["notified_at"] = &now
	} else if status == "accepted" || status == "rejected" || status == "timeout" {
		now := time.Now()
		updates["responded_at"] = &now
	}
	return r.db.Model(&model.DispatchCandidate{}).Where("id = ?", id).Updates(updates).Error
}

func (r *DispatchRepo) DeleteCandidatesByTask(taskID int64) error {
	return r.db.Where("task_id = ?", taskID).Delete(&model.DispatchCandidate{}).Error
}

func (r *DispatchRepo) GetPendingCandidateByPilot(pilotID int64) (*model.DispatchCandidate, error) {
	var candidate model.DispatchCandidate
	err := r.db.Where("pilot_id = ? AND status IN ?", pilotID, []string{"pending", "notified"}).
		First(&candidate).Error
	if err != nil {
		return nil, err
	}
	return &candidate, nil
}

// ListCandidatesByPilot 获取飞手的候选任务列表（含任务信息）
func (r *DispatchRepo) ListCandidatesByPilot(pilotID int64, page, pageSize int) ([]map[string]interface{}, int64, error) {
	var total int64
	if err := r.db.Model(&model.DispatchCandidate{}).Where("pilot_id = ?", pilotID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	rows, err := r.db.Raw(`
		SELECT
			dc.id, dc.task_id, dc.pilot_id, dc.drone_id, dc.owner_id,
			dc.total_score, dc.distance, dc.quoted_price,
			dc.status, dc.notified_at, dc.responded_at, dc.response_note,
			dc.created_at,
			dt.task_no, dt.task_type, dt.cargo_weight, dt.cargo_category,
			dt.pickup_address, dt.delivery_address,
			dt.pickup_latitude as pickup_lat, dt.pickup_longitude as pickup_lng,
			dt.delivery_latitude as delivery_lat, dt.delivery_longitude as delivery_lng,
			dt.required_pickup_time as expected_pickup_time,
			dt.dispatch_deadline, dt.status as task_status,
			dt.priority
		FROM dispatch_candidates dc
		JOIN dispatch_tasks dt ON dc.task_id = dt.id
		WHERE dc.pilot_id = ?
		ORDER BY dc.created_at DESC
		LIMIT ? OFFSET ?`, pilotID, pageSize, offset).Rows()
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	cols, _ := rows.Columns()
	var result []map[string]interface{}
	for rows.Next() {
		vals := make([]interface{}, len(cols))
		ptrs := make([]interface{}, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			continue
		}
		row := make(map[string]interface{})
		for i, col := range cols {
			val := vals[i]
			if b, ok := val.([]byte); ok {
				row[col] = string(b)
			} else {
				row[col] = val
			}
		}
		result = append(result, row)
	}
	return result, total, nil
}

// ==================== 查找可用飞手和无人机 ====================

// FindAvailablePilotDronePairs 查找可用的飞手-无人机组合
func (r *DispatchRepo) FindAvailablePilotDronePairs(lat, lng, radiusKM float64, minLoad float64, licenseType string) ([]PilotDronePair, error) {
	distanceExpr := `(6371 * acos(cos(radians(?)) * cos(radians(p.current_latitude)) * cos(radians(p.current_longitude) - radians(?)) + sin(radians(?)) * sin(radians(p.current_latitude))))`

	query := `
		SELECT 
			p.id as pilot_id,
			p.user_id as pilot_user_id,
			p.caac_license_type,
			p.total_flight_hours,
			p.service_rating as pilot_rating,
			p.credit_score as pilot_credit_score,
			p.current_latitude as pilot_latitude,
			p.current_longitude as pilot_longitude,
			d.id as drone_id,
			d.owner_id,
			d.max_load,
			d.max_flight_time,
			d.max_distance,
			d.rating as drone_rating,
			d.hourly_price,
			d.daily_price,
			d.latitude as drone_latitude,
			d.longitude as drone_longitude,
			` + distanceExpr + ` as distance
		FROM pilots p
		INNER JOIN pilot_drone_bindings pdb ON p.id = pdb.pilot_id AND pdb.status = 'active'
		INNER JOIN drones d ON pdb.drone_id = d.id
		WHERE p.availability_status = 'online'
		AND p.verification_status = 'verified'
		AND d.availability_status = 'available'
		AND d.certification_status = 'approved'
		AND d.uom_verified = 'verified'
		AND d.insurance_verified = 'verified'
		AND d.max_load >= ?
		AND ` + distanceExpr + ` < ?
	`

	args := []interface{}{lat, lng, lat, minLoad, lat, lng, lat, radiusKM}

	if licenseType != "" {
		query += " AND p.caac_license_type = ?"
		args = append(args, licenseType)
	}

	query += " ORDER BY distance ASC LIMIT 50"

	var pairs []PilotDronePair
	err := r.db.Raw(query, args...).Scan(&pairs).Error
	return pairs, err
}

// PilotDronePair 飞手-无人机组合
type PilotDronePair struct {
	PilotID          int64   `json:"pilot_id"`
	PilotUserID      int64   `json:"pilot_user_id"`
	CAACLicenseType  string  `json:"caac_license_type"`
	TotalFlightHours float64 `json:"total_flight_hours"`
	PilotRating      float64 `json:"pilot_rating"`
	PilotCreditScore int     `json:"pilot_credit_score"`
	PilotLatitude    float64 `json:"pilot_latitude"`
	PilotLongitude   float64 `json:"pilot_longitude"`
	DroneID          int64   `json:"drone_id"`
	OwnerID          int64   `json:"owner_id"`
	MaxLoad          float64 `json:"max_load"`
	MaxFlightTime    int     `json:"max_flight_time"`
	MaxDistance      float64 `json:"max_distance"`
	DroneRating      float64 `json:"drone_rating"`
	HourlyPrice      int64   `json:"hourly_price"`
	DailyPrice       int64   `json:"daily_price"`
	DroneLatitude    float64 `json:"drone_latitude"`
	DroneLongitude   float64 `json:"drone_longitude"`
	Distance         float64 `json:"distance"`
}

// ==================== 派单配置 ====================

func (r *DispatchRepo) GetConfig(key string) (string, error) {
	var config model.DispatchConfig
	err := r.db.Where("config_key = ?", key).First(&config).Error
	if err != nil {
		return "", err
	}
	return config.ConfigValue, nil
}

func (r *DispatchRepo) SetConfig(key, value, configType, description string) error {
	return r.db.Save(&model.DispatchConfig{
		ConfigKey:   key,
		ConfigValue: value,
		ConfigType:  configType,
		Description: description,
	}).Error
}

func (r *DispatchRepo) GetAllConfigs() ([]model.DispatchConfig, error) {
	var configs []model.DispatchConfig
	err := r.db.Find(&configs).Error
	return configs, err
}

// ==================== 派单日志 ====================

func (r *DispatchRepo) CreateLog(log *model.DispatchLog) error {
	return r.db.Create(log).Error
}

func (r *DispatchRepo) GetLogsByTask(taskID int64) ([]model.DispatchLog, error) {
	var logs []model.DispatchLog
	err := r.db.Where("task_id = ?", taskID).Order("created_at DESC").Find(&logs).Error
	return logs, err
}

// ==================== 生成任务编号 ====================

func (r *DispatchRepo) GenerateTaskNo() string {
	return fmt.Sprintf("DT%s%06d", time.Now().Format("20060102150405"), time.Now().UnixNano()%1000000)
}

// ==================== 统计 ====================

func (r *DispatchRepo) GetTaskStatsByClient(clientID int64) (map[string]int64, error) {
	stats := make(map[string]int64)

	var results []struct {
		Status string
		Count  int64
	}

	err := r.db.Model(&model.DispatchTask{}).
		Select("status, count(*) as count").
		Where("client_id = ?", clientID).
		Group("status").
		Scan(&results).Error

	if err != nil {
		return nil, err
	}

	for _, r := range results {
		stats[r.Status] = r.Count
	}

	return stats, nil
}

func (r *DispatchRepo) GetTaskStatsByPilot(pilotID int64) (map[string]int64, error) {
	stats := make(map[string]int64)

	var results []struct {
		Status string
		Count  int64
	}

	err := r.db.Model(&model.DispatchTask{}).
		Select("status, count(*) as count").
		Where("assigned_pilot_id = ?", pilotID).
		Group("status").
		Scan(&results).Error

	if err != nil {
		return nil, err
	}

	for _, r := range results {
		stats[r.Status] = r.Count
	}

	return stats, nil
}
