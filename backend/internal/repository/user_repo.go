package repository

import (
	"wurenji-backend/internal/model"

	"gorm.io/gorm"
)

type UserRepo struct {
	db *gorm.DB
}

func NewUserRepo(db *gorm.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) DB() *gorm.DB {
	return r.db
}

func (r *UserRepo) Create(user *model.User) error {
	return r.db.Create(user).Error
}

func (r *UserRepo) GetByID(id int64) (*model.User, error) {
	var user model.User
	err := r.db.Where("id = ?", id).First(&user).Error
	return &user, err
}

func (r *UserRepo) GetByPhone(phone string) (*model.User, error) {
	var user model.User
	err := r.db.Where("phone = ?", phone).First(&user).Error
	return &user, err
}

func (r *UserRepo) Update(user *model.User) error {
	return r.db.Save(user).Error
}

func (r *UserRepo) UpdateFields(id int64, fields map[string]interface{}) error {
	return r.db.Model(&model.User{}).Where("id = ?", id).Updates(fields).Error
}

func (r *UserRepo) List(page, pageSize int, filters map[string]interface{}) ([]model.User, int64, error) {
	var users []model.User
	var total int64

	query := r.db.Model(&model.User{})
	for k, v := range filters {
		// 伪 key "__keyword": 在 phone / nickname 上做 LIKE 模糊搜索,供管理端搜索框使用。
		if k == "__keyword" {
			if kw, ok := v.(string); ok && kw != "" {
				like := "%" + kw + "%"
				query = query.Where("phone LIKE ? OR nickname LIKE ?", like, like)
			}
			continue
		}
		query = query.Where(k+" = ?", v)
	}

	query.Count(&total)
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&users).Error
	return users, total, err
}

func (r *UserRepo) ExistsByPhone(phone string) (bool, error) {
	var count int64
	err := r.db.Model(&model.User{}).Where("phone = ?", phone).Count(&count).Error
	return count > 0, err
}

func (r *UserRepo) GetByWechatOpenID(openID string) (*model.User, error) {
	var user model.User
	err := r.db.Where("wechat_open_id = ?", openID).First(&user).Error
	return &user, err
}

func (r *UserRepo) GetByWechatUnionID(unionID string) (*model.User, error) {
	var user model.User
	err := r.db.Where("wechat_union_id = ?", unionID).First(&user).Error
	return &user, err
}

func (r *UserRepo) GetByQQOpenID(openID string) (*model.User, error) {
	var user model.User
	err := r.db.Where("qq_open_id = ?", openID).First(&user).Error
	return &user, err
}

// GetByIDs 批量查询用户（用于 DTO 转换）
func (r *UserRepo) GetByIDs(ids []int64) (map[int64]*model.User, error) {
	var users []model.User
	err := r.db.Where("id IN ?", ids).Find(&users).Error
	if err != nil {
		return nil, err
	}

	// 转换为 map 方便查找
	userMap := make(map[int64]*model.User, len(users))
	for i := range users {
		userMap[users[i].ID] = &users[i]
	}
	return userMap, nil
}

// UpdateUserType 更新用户类型
func (r *UserRepo) UpdateUserType(userID int64, userType string) error {
	return r.db.Model(&model.User{}).Where("id = ?", userID).Update("user_type", userType).Error
}

// UpdatePreferredMode 更新用户在小程序选择的意向身份(customer/provider)。
func (r *UserRepo) UpdatePreferredMode(userID int64, mode string) error {
	return r.db.Model(&model.User{}).Where("id = ?", userID).Update("preferred_mode", mode).Error
}

// ListProviderCandidates 分页查询"服务商候选用户":
// 任何已建立机主资料/飞手资料/已持有无人机的用户都视为候选。
// 与 role_summary.provider 口径保持一致(只要任一来源命中即纳入)。
func (r *UserRepo) ListProviderCandidates(page, pageSize int) ([]model.User, int64, error) {
	var users []model.User
	var total int64

	subquery := `(
		SELECT user_id FROM owner_profiles WHERE deleted_at IS NULL
		UNION
		SELECT user_id FROM pilot_profiles WHERE deleted_at IS NULL
		UNION
		SELECT user_id FROM pilots WHERE deleted_at IS NULL
		UNION
		SELECT DISTINCT owner_id AS user_id FROM drones WHERE deleted_at IS NULL AND owner_id > 0
	)`

	base := r.db.Model(&model.User{}).
		Where("deleted_at IS NULL").
		Where("id IN (SELECT user_id FROM "+subquery+" AS provider_candidates)")

	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []model.User{}, 0, nil
	}
	if err := base.Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&users).Error; err != nil {
		return nil, 0, err
	}
	return users, total, nil
}
