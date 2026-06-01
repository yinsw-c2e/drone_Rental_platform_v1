package service

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"go.uber.org/zap"

	"wurenji-backend/internal/config"
	"wurenji-backend/internal/model"
	wechatpkg "wurenji-backend/internal/pkg/wechat"
)

type WeChatSubscribeSender interface {
	Send(ctx context.Context, msg wechatpkg.SubscribeMessage) error
}

type WeChatSubscribeGrantStore interface {
	Grant(ctx context.Context, userID int64, templateID string, count int) error
	TryConsume(ctx context.Context, userID int64, templateID string) (bool, error)
}

type WeChatSubscribeUserStore interface {
	GetByID(id int64) (*model.User, error)
}

type WeChatSubscribeEventSender interface {
	SendEvent(ctx context.Context, userID int64, eventType string, dataCtx map[string]interface{}) error
}

type WeChatSubscribeService struct {
	userStore  WeChatSubscribeUserStore
	grantStore WeChatSubscribeGrantStore
	sender     WeChatSubscribeSender
	cfg        config.WeChatSubscribeConfig
	logger     *zap.Logger
}

var weChatSubscribeEventAllowlist = map[string]struct{}{
	"direct_order_created":            {},
	"direct_order_confirmed":          {},
	"demand_quote_submitted":          {},
	"demand_selected":                 {},
	"demand_cancelled":                {},
	"order_paid":                      {},
	"order_cancelled":                 {},
	"order_in_transit":                {},
	"order_delivered":                 {},
	"order_completed":                 {},
	"settlement_settled":              {},
	"broadcast_auto_assigned":         {},
	"broadcast_auto_assign_exhausted": {},
	"dispatch_created":                {},
	"pilot_verification_result":       {},
}

func NewWeChatSubscribeService(userStore WeChatSubscribeUserStore, grantStore WeChatSubscribeGrantStore, sender WeChatSubscribeSender, cfg config.WeChatSubscribeConfig, logger *zap.Logger) *WeChatSubscribeService {
	return &WeChatSubscribeService{
		userStore:  userStore,
		grantStore: grantStore,
		sender:     sender,
		cfg:        cfg,
		logger:     logger,
	}
}

func ShouldSendWeChatSubscribeEvent(eventType string) bool {
	_, ok := weChatSubscribeEventAllowlist[eventType]
	return ok
}

func (s *WeChatSubscribeService) SendEvent(ctx context.Context, userID int64, eventType string, dataCtx map[string]interface{}) error {
	if s == nil || !s.cfg.Enabled || !ShouldSendWeChatSubscribeEvent(eventType) {
		return nil
	}
	tpl, ok := s.cfg.Templates[eventType]
	if !ok || strings.TrimSpace(tpl.TemplateID) == "" {
		return nil
	}
	if s.userStore == nil || s.grantStore == nil || s.sender == nil {
		return nil
	}

	user, err := s.userStore.GetByID(userID)
	if err != nil || user == nil || strings.TrimSpace(user.WechatOpenID) == "" {
		return nil
	}

	subscribeData := BuildWeChatSubscribeData(tpl.Data, dataCtx)
	if len(subscribeData) == 0 {
		return nil
	}

	consumed, err := s.grantStore.TryConsume(ctx, userID, tpl.TemplateID)
	if err != nil {
		return err
	}
	if !consumed {
		return nil
	}

	msg := wechatpkg.SubscribeMessage{
		ToUser:     strings.TrimSpace(user.WechatOpenID),
		TemplateID: strings.TrimSpace(tpl.TemplateID),
		Page:       renderSubscribePage(tpl.Page, dataCtx),
		Data:       subscribeData,
	}
	return s.sender.Send(ctx, msg)
}

func (s *WeChatSubscribeService) GrantAcceptedTemplates(ctx context.Context, userID int64, templateIDs []string) (int, error) {
	if s == nil || !s.cfg.Enabled || s.grantStore == nil {
		return 0, nil
	}
	if s.userStore != nil {
		user, err := s.userStore.GetByID(userID)
		if err != nil || user == nil || strings.TrimSpace(user.WechatOpenID) == "" {
			return 0, nil
		}
	}

	seen := make(map[string]struct{}, len(templateIDs))
	granted := 0
	for _, templateID := range templateIDs {
		templateID = strings.TrimSpace(templateID)
		if templateID == "" {
			continue
		}
		if _, ok := seen[templateID]; ok {
			continue
		}
		seen[templateID] = struct{}{}
		if err := s.grantStore.Grant(ctx, userID, templateID, 1); err != nil {
			return granted, err
		}
		granted++
	}
	return granted, nil
}

func BuildWeChatSubscribeData(mapping map[string]string, dataCtx map[string]interface{}) map[string]wechatpkg.SubscribeDataValue {
	if len(mapping) == 0 {
		return map[string]wechatpkg.SubscribeDataValue{}
	}
	result := make(map[string]wechatpkg.SubscribeDataValue, len(mapping))
	for field, source := range mapping {
		field = strings.TrimSpace(field)
		if field == "" {
			continue
		}
		value := resolveSubscribeValue(strings.TrimSpace(source), dataCtx)
		if value == "" {
			continue
		}
		result[field] = wechatpkg.SubscribeDataValue{Value: value}
	}
	return result
}

func resolveSubscribeValue(source string, dataCtx map[string]interface{}) string {
	if source == "" {
		return ""
	}
	if strings.HasPrefix(source, "literal:") {
		return strings.TrimPrefix(source, "literal:")
	}
	if strings.HasPrefix(source, "amount:") {
		return formatSubscribeAmount(valueFromContext(strings.TrimPrefix(source, "amount:"), dataCtx))
	}
	if strings.HasPrefix(source, "time:") {
		return formatSubscribeTime(valueFromContext(strings.TrimPrefix(source, "time:"), dataCtx))
	}
	return stringifySubscribeValue(valueFromContext(source, dataCtx))
}

func valueFromContext(key string, dataCtx map[string]interface{}) interface{} {
	if dataCtx == nil {
		return nil
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return nil
	}
	if value, ok := dataCtx[key]; ok {
		return value
	}
	return nil
}

func stringifySubscribeValue(value interface{}) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return strings.TrimSpace(v)
	case time.Time:
		return v.Format("2006-01-02 15:04")
	case *time.Time:
		if v == nil {
			return ""
		}
		return v.Format("2006-01-02 15:04")
	case bool:
		if v {
			return "是"
		}
		return "否"
	default:
		return strings.TrimSpace(fmt.Sprint(v))
	}
}

func formatSubscribeAmount(value interface{}) string {
	text := stringifySubscribeValue(value)
	if text == "" {
		return ""
	}
	var cents int64
	if _, err := fmt.Sscan(text, &cents); err != nil {
		return text
	}
	return fmt.Sprintf("%.2f元", float64(cents)/100)
}

func formatSubscribeTime(value interface{}) string {
	return stringifySubscribeValue(value)
}

func renderSubscribePage(page string, dataCtx map[string]interface{}) string {
	page = strings.TrimSpace(page)
	if page == "" || dataCtx == nil {
		return page
	}
	for key, value := range dataCtx {
		placeholder := "{" + key + "}"
		if !strings.Contains(page, placeholder) {
			continue
		}
		page = strings.ReplaceAll(page, placeholder, url.QueryEscape(stringifySubscribeValue(value)))
	}
	return page
}

type MockWeChatSubscribeService struct {
	logger *zap.Logger
}

func NewMockWeChatSubscribeService(logger *zap.Logger) *MockWeChatSubscribeService {
	return &MockWeChatSubscribeService{logger: logger}
}

func (m *MockWeChatSubscribeService) SendEvent(ctx context.Context, userID int64, eventType string, dataCtx map[string]interface{}) error {
	if m != nil && m.logger != nil {
		m.logger.Info("[MOCK] 订阅消息下发记录",
			zap.Int64("user_id", userID),
			zap.String("event_type", eventType),
			zap.Any("data", dataCtx),
		)
	}
	fmt.Printf("[MOCK] WeChat Subscribe User=%d Event=%s\n", userID, eventType)
	return nil
}

func (m *MockWeChatSubscribeService) GrantAcceptedTemplates(ctx context.Context, userID int64, templateIDs []string) (int, error) {
	if m != nil && m.logger != nil {
		m.logger.Info("[MOCK] 订阅消息授权记录",
			zap.Int64("user_id", userID),
			zap.Strings("template_ids", templateIDs),
		)
	}
	return len(templateIDs), nil
}
