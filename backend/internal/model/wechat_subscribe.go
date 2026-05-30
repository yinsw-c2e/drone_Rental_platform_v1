package model

import "time"

type WechatSubscribeGrant struct {
	ID             int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID         int64     `gorm:"uniqueIndex:uk_wechat_subscribe_user_template;not null" json:"user_id"`
	TemplateID     string    `gorm:"uniqueIndex:uk_wechat_subscribe_user_template;type:varchar(128);not null" json:"template_id"`
	RemainingCount int       `gorm:"not null;default:0" json:"remaining_count"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (WechatSubscribeGrant) TableName() string {
	return "wechat_subscribe_grants"
}
