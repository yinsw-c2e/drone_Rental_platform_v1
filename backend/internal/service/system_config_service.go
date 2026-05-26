package service

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"

	"wurenji-backend/internal/model"
)

type SystemConfigService struct {
	db *gorm.DB
}

func NewSystemConfigService(db *gorm.DB) *SystemConfigService {
	return &SystemConfigService{db: db}
}

func (s *SystemConfigService) ListAll() ([]model.SystemConfig, error) {
	var items []model.SystemConfig
	if s == nil || s.db == nil {
		return items, nil
	}
	err := s.db.Order("config_key ASC").Find(&items).Error
	return items, err
}

func (s *SystemConfigService) Get(key string) (*model.SystemConfig, error) {
	if s == nil || s.db == nil {
		return nil, gorm.ErrInvalidDB
	}
	var cfg model.SystemConfig
	err := s.db.Where("config_key = ?", strings.TrimSpace(key)).First(&cfg).Error
	return &cfg, err
}

func (s *SystemConfigService) Upsert(key, value, description string) (*model.SystemConfig, error) {
	if s == nil || s.db == nil {
		return nil, gorm.ErrInvalidDB
	}
	key = strings.TrimSpace(key)
	var cfg model.SystemConfig
	err := s.db.Where("config_key = ?", key).First(&cfg).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		cfg = model.SystemConfig{
			ConfigKey:   key,
			ConfigValue: strings.TrimSpace(value),
			Description: strings.TrimSpace(description),
			UpdatedAt:   time.Now(),
		}
		return &cfg, s.db.Create(&cfg).Error
	}
	if err != nil {
		return nil, err
	}
	cfg.ConfigValue = strings.TrimSpace(value)
	if strings.TrimSpace(description) != "" {
		cfg.Description = strings.TrimSpace(description)
	}
	cfg.UpdatedAt = time.Now()
	return &cfg, s.db.Save(&cfg).Error
}

func (s *SystemConfigService) GetBool(key string, fallback bool) bool {
	raw := s.getValue(key)
	if raw == "" {
		return fallback
	}
	value, err := strconv.ParseBool(strings.ToLower(raw))
	if err != nil {
		return fallback
	}
	return value
}

func (s *SystemConfigService) GetInt(key string, fallback int) int {
	raw := s.getValue(key)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return value
}

func (s *SystemConfigService) GetFloat(key string, fallback float64) float64 {
	raw := s.getValue(key)
	if raw == "" {
		return fallback
	}
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return fallback
	}
	return value
}

func (s *SystemConfigService) getValue(key string) string {
	if s == nil || s.db == nil || strings.TrimSpace(key) == "" {
		return ""
	}
	var cfg model.SystemConfig
	if err := s.db.Where("config_key = ?", strings.TrimSpace(key)).First(&cfg).Error; err != nil {
		return ""
	}
	return strings.TrimSpace(cfg.ConfigValue)
}
