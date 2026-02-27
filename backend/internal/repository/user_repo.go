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

