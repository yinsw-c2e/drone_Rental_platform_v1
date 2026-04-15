package sms

import (
	"encoding/json"
	"fmt"
	"strings"

	openapi "github.com/alibabacloud-go/darabonba-openapi/v2/client"
	dypnsapi "github.com/alibabacloud-go/dypnsapi-20170525/v3/client"
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

func (s *SMSService) IsAliyun() bool {
	return s.provider == "aliyun"
}

func (s *SMSService) SendCode(phone, code string) error {
	switch s.provider {
	case "aliyun":
		return s.aliyunSend(phone, code)
	default:
		return s.mockSend(phone, code)
	}
}

func (s *SMSService) CheckCode(phone, code string) (bool, error) {
	if s.provider != "aliyun" {
		return true, nil
	}
	client, err := s.createAliyunClient()
	if err != nil {
		return false, err
	}
	request := &dypnsapi.CheckSmsVerifyCodeRequest{
		PhoneNumber: tea.String(phone),
		VerifyCode:  tea.String(code),
	}
	resp, err := client.CheckSmsVerifyCodeWithOptions(request, &util.RuntimeOptions{})
	if err != nil {
		return false, s.handleAliyunError(err)
	}
	if resp.Body == nil || resp.Body.Model == nil {
		return false, fmt.Errorf("empty response")
	}
	return tea.StringValue(resp.Body.Model.VerifyResult) == "PASS", nil
}

func (s *SMSService) createAliyunClient() (*dypnsapi.Client, error) {
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
	return dypnsapi.NewClient(clientConfig)
}

func (s *SMSService) aliyunSend(phone, code string) error {
	client, err := s.createAliyunClient()
	if err != nil {
		s.logger.Error("failed to create aliyun sms client", zap.Error(err))
		return err
	}
	request := &dypnsapi.SendSmsVerifyCodeRequest{
		PhoneNumber:      tea.String(phone),
		SignName:         tea.String(s.signName),
		TemplateCode:     tea.String(s.templateCode),
		TemplateParam:    tea.String(`{"code":"##code##","min":"5"}`),
		CodeLength:       tea.Int64(6),
		ValidTime:        tea.Int64(300),
		ReturnVerifyCode: tea.Bool(false),
	}
	resp, err := client.SendSmsVerifyCodeWithOptions(request, &util.RuntimeOptions{})
	if err != nil {
		s.logger.Error("failed to send aliyun sms", zap.String("phone", phone), zap.Error(err))
		return s.handleAliyunError(err)
	}
	if resp.Body != nil && resp.Body.Code != nil && *resp.Body.Code != "OK" {
		errMsg := fmt.Sprintf("aliyun sms error: code=%s, message=%s",
			tea.StringValue(resp.Body.Code), tea.StringValue(resp.Body.Message))
		s.logger.Error(errMsg, zap.String("phone", phone))
			return fmt.Errorf("%s", errMsg)
	}
	s.logger.Info("aliyun sms sent", zap.String("phone", phone), zap.String("request_id", tea.StringValue(resp.Body.RequestId)))
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

func GenerateCode() string {
	return "123456"
}
