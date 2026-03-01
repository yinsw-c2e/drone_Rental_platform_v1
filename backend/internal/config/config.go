package config

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/viper"
)

// ============================================================
// 主配置结构
// ============================================================

// Config 应用配置主结构
type Config struct {
	Server    ServerConfig    `mapstructure:"server"`
	Database  DatabaseConfig  `mapstructure:"database"`
	Redis     RedisConfig     `mapstructure:"redis"`
	JWT       JWTConfig       `mapstructure:"jwt"`
	Upload    UploadConfig    `mapstructure:"upload"`
	SMS       SMSConfig       `mapstructure:"sms"`
	Payment   PaymentConfig   `mapstructure:"payment"`
	Amap      AmapConfig      `mapstructure:"amap"`
	WebSocket WebSocketConfig `mapstructure:"websocket"`
	Log       LogConfig       `mapstructure:"log"`
	CORS      CORSConfig      `mapstructure:"cors"`
	Push      PushConfig      `mapstructure:"push"`
	OAuth     OAuthConfig     `mapstructure:"oauth"`
}

// ============================================================
// 服务器配置
// ============================================================

// ServerConfig 服务器基础配置
type ServerConfig struct {
	Port int    `mapstructure:"port"` // 服务端口
	Mode string `mapstructure:"mode"` // 运行模式: debug, release, test
}

// Validate 验证服务器配置
func (s *ServerConfig) Validate() error {
	if s.Port < 1 || s.Port > 65535 {
		return errors.New("server.port must be between 1 and 65535")
	}
	validModes := []string{"debug", "release", "test"}
	for _, m := range validModes {
		if s.Mode == m {
			return nil
		}
	}
	return fmt.Errorf("server.mode must be one of: %v", validModes)
}

// ============================================================
// 数据库配置
// ============================================================

// DatabaseConfig MySQL数据库配置
type DatabaseConfig struct {
	Host         string `mapstructure:"host"`           // 数据库地址
	Port         int    `mapstructure:"port"`           // 数据库端口
	User         string `mapstructure:"user"`           // 用户名
	Password     string `mapstructure:"password"`       // 密码
	DBName       string `mapstructure:"dbname"`         // 数据库名
	Charset      string `mapstructure:"charset"`        // 字符集
	MaxIdleConns int    `mapstructure:"max_idle_conns"` // 最大空闲连接数
	MaxOpenConns int    `mapstructure:"max_open_conns"` // 最大打开连接数
}

// DSN 生成数据库连接字符串
func (d *DatabaseConfig) DSN() string {
	// 添加更多参数确保UTF-8字符正确处理
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=%s&parseTime=True&loc=Local&collation=utf8mb4_unicode_ci&interpolateParams=true",
		d.User, d.Password, d.Host, d.Port, d.DBName, d.Charset)
}

// Validate 验证数据库配置
func (d *DatabaseConfig) Validate() error {
	if d.Host == "" {
		return errors.New("database.host is required")
	}
	if d.Port < 1 || d.Port > 65535 {
		return errors.New("database.port must be between 1 and 65535")
	}
	if d.User == "" {
		return errors.New("database.user is required")
	}
	if d.DBName == "" {
		return errors.New("database.dbname is required")
	}
	return nil
}

// ============================================================
// Redis配置
// ============================================================

// RedisConfig Redis缓存配置
type RedisConfig struct {
	Host     string `mapstructure:"host"`     // Redis地址
	Port     int    `mapstructure:"port"`     // Redis端口
	Password string `mapstructure:"password"` // 密码（可为空）
	DB       int    `mapstructure:"db"`       // 数据库编号
}

// Addr 生成Redis连接地址
func (r *RedisConfig) Addr() string {
	return fmt.Sprintf("%s:%d", r.Host, r.Port)
}

// Validate 验证Redis配置
func (r *RedisConfig) Validate() error {
	if r.Host == "" {
		return errors.New("redis.host is required")
	}
	if r.Port < 1 || r.Port > 65535 {
		return errors.New("redis.port must be between 1 and 65535")
	}
	if r.DB < 0 || r.DB > 15 {
		return errors.New("redis.db must be between 0 and 15")
	}
	return nil
}

// ============================================================
// JWT配置
// ============================================================

// JWTConfig JWT认证配置
type JWTConfig struct {
	Secret        string `mapstructure:"secret"`         // JWT签名密钥
	AccessExpire  int    `mapstructure:"access_expire"`  // Access Token过期时间（秒）
	RefreshExpire int    `mapstructure:"refresh_expire"` // Refresh Token过期时间（秒）
}

// Validate 验证JWT配置
func (j *JWTConfig) Validate() error {
	if j.Secret == "" {
		return errors.New("jwt.secret is required")
	}
	if len(j.Secret) < 32 {
		return errors.New("jwt.secret should be at least 32 characters for security")
	}
	// 检查是否使用了示例密钥
	if strings.Contains(strings.ToLower(j.Secret), "change-in-production") ||
		strings.Contains(strings.ToLower(j.Secret), "example") {
		return errors.New("jwt.secret appears to be a placeholder, please set a secure secret")
	}
	if j.AccessExpire <= 0 {
		return errors.New("jwt.access_expire must be positive")
	}
	if j.RefreshExpire <= 0 {
		return errors.New("jwt.refresh_expire must be positive")
	}
	if j.RefreshExpire <= j.AccessExpire {
		return errors.New("jwt.refresh_expire should be greater than jwt.access_expire")
	}
	return nil
}

// ============================================================
// 文件上传配置
// ============================================================

// UploadConfig 文件上传配置
type UploadConfig struct {
	MaxSize     int      `mapstructure:"max_size"`     // 单文件最大大小（MB）
	SavePath    string   `mapstructure:"save_path"`    // 文件存储路径
	AllowedExts []string `mapstructure:"allowed_exts"` // 允许的文件扩展名
}

// Validate 验证上传配置
func (u *UploadConfig) Validate() error {
	if u.MaxSize <= 0 {
		return errors.New("upload.max_size must be positive")
	}
	if u.SavePath == "" {
		return errors.New("upload.save_path is required")
	}
	if len(u.AllowedExts) == 0 {
		return errors.New("upload.allowed_exts cannot be empty")
	}
	return nil
}

// ============================================================
// 短信服务配置
// ============================================================

// SMSConfig 短信服务配置
type SMSConfig struct {
	Provider     string     `mapstructure:"provider"`      // 短信服务商: mock, aliyun, tencent
	SignName     string     `mapstructure:"sign_name"`     // 短信签名
	TemplateCode string     `mapstructure:"template_code"` // 短信模板ID
	Aliyun       AliyunSMS  `mapstructure:"aliyun"`        // 阿里云短信配置
	Tencent      TencentSMS `mapstructure:"tencent"`       // 腾讯云短信配置
}

// AliyunSMS 阿里云短信配置
type AliyunSMS struct {
	AccessKeyID     string `mapstructure:"access_key_id"`     // AccessKey ID
	AccessKeySecret string `mapstructure:"access_key_secret"` // AccessKey Secret
	RegionID        string `mapstructure:"region_id"`         // 区域ID
}

// TencentSMS 腾讯云短信配置
type TencentSMS struct {
	SecretID  string `mapstructure:"secret_id"`  // SecretId
	SecretKey string `mapstructure:"secret_key"` // SecretKey
	SDKAppID  string `mapstructure:"sdk_app_id"` // SDK AppID
}

// Validate 验证短信配置
func (s *SMSConfig) Validate() error {
	validProviders := []string{"mock", "aliyun", "tencent"}
	found := false
	for _, p := range validProviders {
		if s.Provider == p {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("sms.provider must be one of: %v", validProviders)
	}

	// 根据provider验证对应配置
	switch s.Provider {
	case "aliyun":
		if s.Aliyun.AccessKeyID == "" || s.Aliyun.AccessKeySecret == "" {
			return errors.New("aliyun sms requires access_key_id and access_key_secret")
		}
	case "tencent":
		if s.Tencent.SecretID == "" || s.Tencent.SecretKey == "" {
			return errors.New("tencent sms requires secret_id and secret_key")
		}
	}
	return nil
}

// ============================================================
// 支付配置
// ============================================================

// PaymentConfig 支付配置
type PaymentConfig struct {
	CommissionRate int          `mapstructure:"commission_rate"` // 平台佣金比例（百分比）
	WeChat         WeChatConfig `mapstructure:"wechat"`          // 微信支付配置
	Alipay         AlipayConfig `mapstructure:"alipay"`          // 支付宝配置
}

// WeChatConfig 微信支付配置
type WeChatConfig struct {
	AppID     string `mapstructure:"app_id"`     // 应用ID
	MchID     string `mapstructure:"mch_id"`     // 商户号
	APIKey    string `mapstructure:"api_key"`    // API密钥
	CertPath  string `mapstructure:"cert_path"`  // 证书路径
	KeyPath   string `mapstructure:"key_path"`   // 私钥路径
	NotifyURL string `mapstructure:"notify_url"` // 回调地址
}

// AlipayConfig 支付宝配置
type AlipayConfig struct {
	AppID      string `mapstructure:"app_id"`      // 应用ID
	PrivateKey string `mapstructure:"private_key"` // 应用私钥
	PublicKey  string `mapstructure:"public_key"`  // 支付宝公钥
	Sandbox    bool   `mapstructure:"sandbox"`     // 是否沙箱环境
	NotifyURL  string `mapstructure:"notify_url"`  // 回调地址
}

// Validate 验证支付配置
func (p *PaymentConfig) Validate() error {
	if p.CommissionRate < 0 || p.CommissionRate > 100 {
		return errors.New("payment.commission_rate must be between 0 and 100")
	}
	return nil
}

// IsWeChatEnabled 检查微信支付是否已配置
func (p *PaymentConfig) IsWeChatEnabled() bool {
	return p.WeChat.AppID != "" && p.WeChat.MchID != "" && p.WeChat.APIKey != ""
}

// IsAlipayEnabled 检查支付宝是否已配置
func (p *PaymentConfig) IsAlipayEnabled() bool {
	return p.Alipay.AppID != "" && p.Alipay.PrivateKey != "" && p.Alipay.PublicKey != ""
}

// ============================================================
// 高德地图配置
// ============================================================

// AmapConfig 高德地图配置
type AmapConfig struct {
	APIKey string `mapstructure:"api_key"` // Web服务API Key
	WebKey string `mapstructure:"web_key"` // Web端JS API Key
}

// IsEnabled 检查高德地图是否已配置
func (a *AmapConfig) IsEnabled() bool {
	return a.APIKey != ""
}

// ============================================================
// WebSocket配置
// ============================================================

// WebSocketConfig WebSocket配置
type WebSocketConfig struct {
	MaxMessageSize int `mapstructure:"max_message_size"` // 单条消息最大大小（字节）
	WriteWait      int `mapstructure:"write_wait"`       // 写入超时（秒）
	PongWait       int `mapstructure:"pong_wait"`        // Pong响应超时（秒）
	PingPeriod     int `mapstructure:"ping_period"`      // Ping发送间隔（秒）
}

// Validate 验证WebSocket配置
func (w *WebSocketConfig) Validate() error {
	if w.MaxMessageSize <= 0 {
		return errors.New("websocket.max_message_size must be positive")
	}
	if w.PingPeriod >= w.PongWait {
		return errors.New("websocket.ping_period must be less than pong_wait")
	}
	return nil
}

// ============================================================
// 日志配置
// ============================================================

// LogConfig 日志配置
type LogConfig struct {
	Level      string `mapstructure:"level"`       // 日志级别: debug, info, warn, error
	Output     string `mapstructure:"output"`      // 输出方式: console, file, both
	FilePath   string `mapstructure:"file_path"`   // 日志文件路径
	MaxSize    int    `mapstructure:"max_size"`    // 单文件最大大小（MB）
	MaxAge     int    `mapstructure:"max_age"`     // 保留天数
	MaxBackups int    `mapstructure:"max_backups"` // 最大备份数
}

// ============================================================
// CORS配置
// ============================================================

// CORSConfig 跨域配置
type CORSConfig struct {
	AllowedOrigins []string `mapstructure:"allowed_origins"` // 允许的域名
	AllowedMethods []string `mapstructure:"allowed_methods"` // 允许的HTTP方法
	AllowedHeaders []string `mapstructure:"allowed_headers"` // 允许的请求头
}

// ============================================================
// 推送服务配置
// ============================================================

// PushConfig 推送服务配置
type PushConfig struct {
	Provider string   `mapstructure:"provider"` // 推送服务商: mock, jpush
	JPush    JPushCfg `mapstructure:"jpush"`    // 极光推送配置
}

// JPushCfg 极光推送配置
type JPushCfg struct {
	AppKey       string `mapstructure:"app_key"`       // 应用Key
	MasterSecret string `mapstructure:"master_secret"` // Master Secret
}

// IsJPushEnabled 检查极光推送是否已配置
func (p *PushConfig) IsJPushEnabled() bool {
	return p.Provider == "jpush" && p.JPush.AppKey != "" && p.JPush.MasterSecret != ""
}

// ============================================================
// 第三方登录配置
// ============================================================

// OAuthConfig 第三方登录配置
type OAuthConfig struct {
	WeChat WeChatOAuthCfg `mapstructure:"wechat"` // 微信登录配置
	QQ     QQOAuthCfg     `mapstructure:"qq"`     // QQ登录配置
}

// WeChatOAuthCfg 微信OAuth配置
type WeChatOAuthCfg struct {
	AppID     string `mapstructure:"app_id"`     // 应用ID
	AppSecret string `mapstructure:"app_secret"` // 应用密钥
}

// QQOAuthCfg QQ OAuth配置
type QQOAuthCfg struct {
	AppID  string `mapstructure:"app_id"`  // 应用ID
	AppKey string `mapstructure:"app_key"` // 应用Key
}

// IsWeChatEnabled 检查微信登录是否已配置
func (o *OAuthConfig) IsWeChatEnabled() bool {
	return o.WeChat.AppID != "" && o.WeChat.AppSecret != ""
}

// IsQQEnabled 检查QQ登录是否已配置
func (o *OAuthConfig) IsQQEnabled() bool {
	return o.QQ.AppID != "" && o.QQ.AppKey != ""
}

// ============================================================
// 配置加载和验证
// ============================================================

// AppConfig 全局配置实例
var AppConfig *Config

// LoadConfig 加载配置文件
func LoadConfig(path string) (*Config, error) {
	viper.SetConfigFile(path)
	viper.SetConfigType("yaml")

	// 支持环境变量覆盖
	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	if err := viper.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("failed to read config: %w", err)
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	AppConfig = &cfg
	return &cfg, nil
}

// Validate 验证所有配置项
func (c *Config) Validate() error {
	if err := c.Server.Validate(); err != nil {
		return fmt.Errorf("server config error: %w", err)
	}
	if err := c.Database.Validate(); err != nil {
		return fmt.Errorf("database config error: %w", err)
	}
	if err := c.Redis.Validate(); err != nil {
		return fmt.Errorf("redis config error: %w", err)
	}
	if err := c.JWT.Validate(); err != nil {
		return fmt.Errorf("jwt config error: %w", err)
	}
	if err := c.Upload.Validate(); err != nil {
		return fmt.Errorf("upload config error: %w", err)
	}
	if err := c.SMS.Validate(); err != nil {
		return fmt.Errorf("sms config error: %w", err)
	}
	if err := c.Payment.Validate(); err != nil {
		return fmt.Errorf("payment config error: %w", err)
	}
	if err := c.WebSocket.Validate(); err != nil {
		return fmt.Errorf("websocket config error: %w", err)
	}
	return nil
}

// ValidateForProduction 生产环境配置验证（更严格）
func (c *Config) ValidateForProduction() error {
	// 先执行基础验证
	if err := c.Validate(); err != nil {
		return err
	}

	// 生产环境必须使用release模式
	if c.Server.Mode != "release" {
		return errors.New("production must use release mode")
	}

	// 生产环境不能使用mock短信
	if c.SMS.Provider == "mock" {
		return errors.New("production must not use mock sms provider")
	}

	// 生产环境必须配置支付
	if !c.Payment.IsWeChatEnabled() && !c.Payment.IsAlipayEnabled() {
		return errors.New("production must have at least one payment method configured")
	}

	return nil
}

// PrintConfigStatus 打印配置状态（用于启动时检查）
func (c *Config) PrintConfigStatus() {
	fmt.Println("========================================")
	fmt.Println("配置加载状态")
	fmt.Println("========================================")
	fmt.Printf("运行模式: %s\n", c.Server.Mode)
	fmt.Printf("服务端口: %d\n", c.Server.Port)
	fmt.Printf("数据库: %s@%s:%d/%s\n", c.Database.User, c.Database.Host, c.Database.Port, c.Database.DBName)
	fmt.Printf("Redis: %s:%d DB%d\n", c.Redis.Host, c.Redis.Port, c.Redis.DB)
	fmt.Printf("短信服务: %s\n", c.SMS.Provider)
	fmt.Printf("微信支付: %s\n", boolToStatus(c.Payment.IsWeChatEnabled()))
	fmt.Printf("支付宝: %s\n", boolToStatus(c.Payment.IsAlipayEnabled()))
	fmt.Printf("高德地图: %s\n", boolToStatus(c.Amap.IsEnabled()))
	fmt.Printf("推送服务: %s (%s)\n", boolToStatus(c.Push.IsJPushEnabled()), c.Push.Provider)
	fmt.Printf("微信登录: %s\n", boolToStatus(c.OAuth.IsWeChatEnabled()))
	fmt.Printf("QQ登录: %s\n", boolToStatus(c.OAuth.IsQQEnabled()))
	fmt.Println("========================================")
}

func boolToStatus(enabled bool) string {
	if enabled {
		return "已配置"
	}
	return "未配置"
}

// EnsureUploadDir 确保上传目录存在
func (c *Config) EnsureUploadDir() error {
	return os.MkdirAll(c.Upload.SavePath, 0755)
}
