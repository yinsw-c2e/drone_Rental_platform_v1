package push

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"go.uber.org/zap"
)

// PushService 推送通知服务接口
type PushService interface {
	// PushToUser 推送消息给指定用户
	PushToUser(userID int64, title, content string, extras map[string]string) error
	// PushToAll 推送消息给所有用户
	PushToAll(title, content string, extras map[string]string) error
	// RegisterDevice 注册设备（绑定用户ID和RegistrationID）
	RegisterDevice(userID int64, registrationID, platform string) error
}

// ============================================================
// JPush 极光推送实现
// ============================================================

// JPushConfig 极光推送配置
type JPushConfig struct {
	AppKey       string
	MasterSecret string
	Enabled      bool
}

// JPushService 极光推送服务
type JPushService struct {
	config JPushConfig
	client *http.Client
	logger *zap.Logger
}

// NewJPushService 创建极光推送服务
func NewJPushService(config JPushConfig, logger *zap.Logger) *JPushService {
	return &JPushService{
		config: config,
		client: &http.Client{Timeout: 10 * time.Second},
		logger: logger,
	}
}

// IsEnabled 检查推送服务是否启用
func (s *JPushService) IsEnabled() bool {
	return s.config.Enabled && s.config.AppKey != "" && s.config.MasterSecret != ""
}

// PushToUser 推送给指定用户（通过alias）
func (s *JPushService) PushToUser(userID int64, title, content string, extras map[string]string) error {
	if !s.IsEnabled() {
		s.logger.Info("jpush disabled, skip push",
			zap.Int64("user_id", userID),
			zap.String("title", title),
		)
		return nil
	}

	alias := fmt.Sprintf("user_%d", userID)
	payload := map[string]interface{}{
		"platform": "all",
		"audience": map[string]interface{}{
			"alias": []string{alias},
		},
		"notification": map[string]interface{}{
			"alert": content,
			"android": map[string]interface{}{
				"alert":  content,
				"title":  title,
				"extras": extras,
			},
			"ios": map[string]interface{}{
				"alert": map[string]string{
					"title": title,
					"body":  content,
				},
				"sound":  "default",
				"extras": extras,
			},
		},
		"options": map[string]interface{}{
			"time_to_live": 86400, // 24小时
		},
	}

	return s.sendPush(payload)
}

// PushToAll 推送给所有用户
func (s *JPushService) PushToAll(title, content string, extras map[string]string) error {
	if !s.IsEnabled() {
		s.logger.Info("jpush disabled, skip broadcast",
			zap.String("title", title),
		)
		return nil
	}

	payload := map[string]interface{}{
		"platform": "all",
		"audience": "all",
		"notification": map[string]interface{}{
			"alert": content,
			"android": map[string]interface{}{
				"alert":  content,
				"title":  title,
				"extras": extras,
			},
			"ios": map[string]interface{}{
				"alert": map[string]string{
					"title": title,
					"body":  content,
				},
				"sound":  "default",
				"extras": extras,
			},
		},
	}

	return s.sendPush(payload)
}

// RegisterDevice 注册设备（将用户ID设置为alias）
func (s *JPushService) RegisterDevice(userID int64, registrationID, platform string) error {
	if !s.IsEnabled() {
		s.logger.Info("jpush disabled, skip device registration",
			zap.Int64("user_id", userID),
			zap.String("registration_id", registrationID),
		)
		return nil
	}

	alias := fmt.Sprintf("user_%d", userID)

	// 设置alias
	payload := map[string]interface{}{
		"alias": alias,
	}

	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("https://device.jpush.cn/v3/devices/%s", registrationID)

	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request failed: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Basic "+s.authHeader())

	resp, err := s.client.Do(req)
	if err != nil {
		s.logger.Error("jpush register device failed", zap.Error(err))
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		respBody, _ := io.ReadAll(resp.Body)
		s.logger.Error("jpush register device error",
			zap.Int("status", resp.StatusCode),
			zap.String("body", string(respBody)),
		)
		return fmt.Errorf("jpush error: status %d", resp.StatusCode)
	}

	s.logger.Info("jpush device registered",
		zap.Int64("user_id", userID),
		zap.String("alias", alias),
	)
	return nil
}

// sendPush 发送推送请求
func (s *JPushService) sendPush(payload map[string]interface{}) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload failed: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.jpush.cn/v3/push", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request failed: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Basic "+s.authHeader())

	resp, err := s.client.Do(req)
	if err != nil {
		s.logger.Error("jpush request failed", zap.Error(err))
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		s.logger.Error("jpush push failed",
			zap.Int("status", resp.StatusCode),
			zap.String("body", string(respBody)),
		)
		return fmt.Errorf("jpush error: status %d, body: %s", resp.StatusCode, string(respBody))
	}

	s.logger.Info("jpush push success", zap.String("response", string(respBody)))
	return nil
}

// authHeader 生成JPush Basic Auth Header
func (s *JPushService) authHeader() string {
	auth := s.config.AppKey + ":" + s.config.MasterSecret
	return base64.StdEncoding.EncodeToString([]byte(auth))
}

// ============================================================
// Mock推送实现（开发环境）
// ============================================================

// MockPushService Mock推送服务
type MockPushService struct {
	logger *zap.Logger
}

// NewMockPushService 创建Mock推送服务
func NewMockPushService(logger *zap.Logger) *MockPushService {
	return &MockPushService{logger: logger}
}

func (m *MockPushService) PushToUser(userID int64, title, content string, extras map[string]string) error {
	m.logger.Info("[MOCK PUSH] to user",
		zap.Int64("user_id", userID),
		zap.String("title", title),
		zap.String("content", content),
		zap.Any("extras", extras),
	)
	fmt.Printf("[MOCK PUSH] User=%d Title=%s Content=%s\n", userID, title, content)
	return nil
}

func (m *MockPushService) PushToAll(title, content string, extras map[string]string) error {
	m.logger.Info("[MOCK PUSH] broadcast",
		zap.String("title", title),
		zap.String("content", content),
	)
	fmt.Printf("[MOCK PUSH] Broadcast Title=%s Content=%s\n", title, content)
	return nil
}

func (m *MockPushService) RegisterDevice(userID int64, registrationID, platform string) error {
	m.logger.Info("[MOCK PUSH] register device",
		zap.Int64("user_id", userID),
		zap.String("registration_id", registrationID),
		zap.String("platform", platform),
	)
	return nil
}

// ============================================================
// 订单推送通知辅助函数
// ============================================================

// NotifyOrderStatusChange 订单状态变更通知
func NotifyOrderStatusChange(pushSvc PushService, userID int64, orderNo, status string) {
	statusMap := map[string]string{
		"accepted":    "您的订单已被接单",
		"rejected":    "您的订单已被拒绝",
		"paid":        "订单支付成功",
		"in_progress": "订单服务已开始",
		"completed":   "订单已完成，欢迎评价",
		"cancelled":   "订单已取消",
		"refunded":    "退款已处理",
	}

	content := statusMap[status]
	if content == "" {
		content = "订单状态已更新"
	}

	extras := map[string]string{
		"type":     "order_status",
		"order_no": orderNo,
		"status":   status,
	}

	_ = pushSvc.PushToUser(userID, "订单通知", content, extras)
}

// NotifyNewMessage 新消息通知
func NotifyNewMessage(pushSvc PushService, receiverID int64, senderName, content string) {
	extras := map[string]string{
		"type": "new_message",
	}

	displayContent := content
	if len(displayContent) > 50 {
		displayContent = displayContent[:50] + "..."
	}

	_ = pushSvc.PushToUser(receiverID, senderName+"发来消息", displayContent, extras)
}

// NotifyVerificationResult 实名认证结果通知
func NotifyVerificationResult(pushSvc PushService, userID int64, approved bool) {
	title := "实名认证通知"
	content := "您的实名认证已通过"
	if !approved {
		content = "您的实名认证未通过，请重新提交"
	}

	extras := map[string]string{
		"type": "verification",
	}

	_ = pushSvc.PushToUser(userID, title, content, extras)
}
