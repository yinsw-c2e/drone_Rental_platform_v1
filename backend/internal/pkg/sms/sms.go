package sms

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"strings"
	"time"

	openapi "github.com/alibabacloud-go/darabonba-openapi/v2/client"
	dypnsapi20170525 "github.com/alibabacloud-go/dypnsapi-20170525/v3/client"
	util "github.com/alibabacloud-go/tea-utils/v2/service"
	"github.com/alibabacloud-go/tea/tea"
	credential "github.com/aliyun/credentials-go/credentials"
	"go.uber.org/zap"
)

type SMSService struct {
	provider        string
	logger          *zap.Logger
	signName        string
	templateCode    string
	accessKeyID     string
	accessKeySecret string
}

func NewSMSService(provider string, logger *zap.Logger) *SMSService {
	return &SMSService{
		provider: provider,
		logger:   logger,
	}
}

// WithAliyunConfig 配置阿里云短信参数
func (s *SMSService) WithAliyunConfig(accessKeyID, accessKeySecret, signName, templateCode string) *SMSService {
	s.accessKeyID = accessKeyID
	s.accessKeySecret = accessKeySecret
	s.signName = signName
	s.templateCode = templateCode
	return s
}

func (s *SMSService) SendCode(phone, code string) error {
	switch s.provider {
	case "aliyun":
		return s.aliyunSend(phone, code)
	case "mock":
		return s.mockSend(phone, code)
	default:
		return s.mockSend(phone, code)
	}
}

// createAliyunClient 创建阿里云短信客户端
func (s *SMSService) createAliyunClient() (*dypnsapi20170525.Client, error) {
	config := new(credential.Config).
		SetType("access_key").
		SetAccessKeyId(s.accessKeyID).
		SetAccessKeySecret(s.accessKeySecret)

	akCredential, err := credential.NewCredential(config)
	if err != nil {
		return nil, err
	}

	clientConfig := &openapi.Config{
		Credential: akCredential,
		Endpoint:   tea.String("dypnsapi.aliyuncs.com"),
	}

	return dypnsapi20170525.NewClient(clientConfig)
}

// aliyunSend 使用阿里云发送短信验证码
func (s *SMSService) aliyunSend(phone, code string) error {
	client, err := s.createAliyunClient()
	if err != nil {
		s.logger.Error("failed to create aliyun sms client", zap.Error(err))
		return err
	}

	// 构建模板参数 {"code":"123456","min":"5"}
	templateParam := fmt.Sprintf("{\"code\":\"%s\",\"min\":\"5\"}", code)

	request := &dypnsapi20170525.SendSmsVerifyCodeRequest{
		PhoneNumber:   tea.String(phone),
		SignName:      tea.String(s.signName),
		TemplateCode:  tea.String(s.templateCode),
		TemplateParam: tea.String(templateParam),
	}

	runtime := &util.RuntimeOptions{}

	resp, err := client.SendSmsVerifyCodeWithOptions(request, runtime)
	if err != nil {
		s.logger.Error("failed to send aliyun sms",
			zap.String("phone", phone),
			zap.Error(err))
		return s.handleAliyunError(err)
	}

	// 检查响应状态
	if resp.Body != nil && resp.Body.Code != nil && *resp.Body.Code != "OK" {
		errMsg := fmt.Sprintf("aliyun sms error: code=%s, message=%s",
			tea.StringValue(resp.Body.Code),
			tea.StringValue(resp.Body.Message))
		s.logger.Error(errMsg, zap.String("phone", phone))
		return fmt.Errorf(errMsg)
	}

	s.logger.Info("aliyun sms sent successfully",
		zap.String("phone", phone),
		zap.String("code", code),
		zap.String("request_id", tea.StringValue(resp.Body.RequestId)))

	return nil
}

// handleAliyunError 处理阿里云SDK错误
func (s *SMSService) handleAliyunError(err error) error {
	if sdkErr, ok := err.(*tea.SDKError); ok {
		s.logger.Error("aliyun sdk error",
			zap.String("message", tea.StringValue(sdkErr.Message)),
			zap.String("data", tea.StringValue(sdkErr.Data)))

		// 尝试解析诊断信息
		var data interface{}
		d := json.NewDecoder(strings.NewReader(tea.StringValue(sdkErr.Data)))
		if err := d.Decode(&data); err == nil {
			if m, ok := data.(map[string]interface{}); ok {
				if recommend, ok := m["Recommend"]; ok {
					s.logger.Info("aliyun error recommendation", zap.Any("recommend", recommend))
				}
			}
		}

		return fmt.Errorf("aliyun sms error: %s", tea.StringValue(sdkErr.Message))
	}
	return err
}

func (s *SMSService) mockSend(phone, code string) error {
	s.logger.Info("mock SMS sent", zap.String("phone", phone), zap.String("code", code))
	fmt.Printf("[MOCK SMS] Phone: %s, Code: %s\n", phone, code)
	return nil
}

// GenerateCode 生成6位数字验证码
func GenerateCode() string {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	return fmt.Sprintf("%06d", r.Intn(1000000))
}
