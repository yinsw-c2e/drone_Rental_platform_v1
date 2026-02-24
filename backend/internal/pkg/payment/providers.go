package payment

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ============================================================
// 微信支付 Provider
// ============================================================

// WeChatPayConfig 微信支付配置
type WeChatPayConfig struct {
	AppID     string
	MchID     string
	APIKey    string
	NotifyURL string
}

// WeChatPayment 微信支付实现
type WeChatPayment struct {
	config WeChatPayConfig
	client *http.Client
	logger *zap.Logger
}

// NewWeChatPayment 创建微信支付实例
func NewWeChatPayment(config WeChatPayConfig, logger *zap.Logger) *WeChatPayment {
	return &WeChatPayment{
		config: config,
		client: &http.Client{Timeout: 30 * time.Second},
		logger: logger,
	}
}

func (w *WeChatPayment) CreatePayment(orderNo string, amount int64, description string) (*PaymentResult, error) {
	// 生成预支付订单参数
	nonceStr := uuid.New().String()[:32]
	paymentNo := fmt.Sprintf("WX_%d_%s", time.Now().UnixMilli(), uuid.New().String()[:8])

	// 构建统一下单参数（APP支付）
	params := map[string]string{
		"appid":            w.config.AppID,
		"mch_id":           w.config.MchID,
		"nonce_str":        nonceStr,
		"body":             description,
		"out_trade_no":     orderNo,
		"total_fee":        fmt.Sprintf("%d", amount),
		"spbill_create_ip": "127.0.0.1",
		"notify_url":       w.config.NotifyURL,
		"trade_type":       "APP",
	}

	// 签名
	params["sign"] = w.sign(params)

	w.logger.Info("wechat payment created",
		zap.String("order_no", orderNo),
		zap.Int64("amount", amount),
		zap.String("payment_no", paymentNo),
	)

	// 构建客户端调起支付所需的参数
	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	appParams := map[string]string{
		"appid":     w.config.AppID,
		"partnerid": w.config.MchID,
		"prepayid":  paymentNo, // 生产环境应从微信API返回
		"package":   "Sign=WXPay",
		"noncestr":  nonceStr,
		"timestamp": timestamp,
	}
	appParams["sign"] = w.sign(appParams)

	payParamsJSON, _ := json.Marshal(appParams)

	return &PaymentResult{
		PaymentNo: paymentNo,
		PayParams: string(payParamsJSON),
	}, nil
}

func (w *WeChatPayment) QueryPayment(paymentNo string) (*PaymentStatus, error) {
	w.logger.Info("wechat query payment", zap.String("payment_no", paymentNo))

	// 生产环境应调用微信查询订单接口
	// https://api.mch.weixin.qq.com/pay/orderquery
	return &PaymentStatus{
		PaymentNo:    paymentNo,
		Status:       "pending",
		ThirdPartyNo: "",
	}, nil
}

func (w *WeChatPayment) Refund(paymentNo string, amount int64) (*RefundResult, error) {
	refundNo := fmt.Sprintf("WXR_%d_%s", time.Now().UnixMilli(), uuid.New().String()[:8])

	w.logger.Info("wechat refund",
		zap.String("payment_no", paymentNo),
		zap.Int64("amount", amount),
		zap.String("refund_no", refundNo),
	)

	// 生产环境应调用微信退款接口
	// https://api.mch.weixin.qq.com/secapi/pay/refund
	return &RefundResult{
		RefundNo: refundNo,
		Status:   "processing",
	}, nil
}

// sign 微信支付MD5签名
func (w *WeChatPayment) sign(params map[string]string) string {
	var keys []string
	for k := range params {
		if k != "sign" && params[k] != "" {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)

	var buf strings.Builder
	for _, k := range keys {
		buf.WriteString(k)
		buf.WriteString("=")
		buf.WriteString(params[k])
		buf.WriteString("&")
	}
	buf.WriteString("key=")
	buf.WriteString(w.config.APIKey)

	hash := md5.Sum([]byte(buf.String()))
	return strings.ToUpper(hex.EncodeToString(hash[:]))
}

// ============================================================
// 支付宝 Provider
// ============================================================

// AlipayConfig 支付宝配置
type AlipayConfig struct {
	AppID      string
	PrivateKey string
	PublicKey  string
	Sandbox    bool
	NotifyURL  string
}

// AlipayPayment 支付宝支付实现
type AlipayPayment struct {
	config AlipayConfig
	client *http.Client
	logger *zap.Logger
}

// NewAlipayPayment 创建支付宝支付实例
func NewAlipayPayment(config AlipayConfig, logger *zap.Logger) *AlipayPayment {
	return &AlipayPayment{
		config: config,
		client: &http.Client{Timeout: 30 * time.Second},
		logger: logger,
	}
}

func (a *AlipayPayment) CreatePayment(orderNo string, amount int64, description string) (*PaymentResult, error) {
	paymentNo := fmt.Sprintf("ALI_%d_%s", time.Now().UnixMilli(), uuid.New().String()[:8])

	// 构建支付宝APP支付请求参数
	bizContent := map[string]interface{}{
		"out_trade_no": orderNo,
		"total_amount": fmt.Sprintf("%.2f", float64(amount)/100),
		"subject":      description,
		"product_code": "QUICK_MSECURITY_PAY",
	}

	bizContentJSON, _ := json.Marshal(bizContent)

	timestamp := time.Now().Format("2006-01-02 15:04:05")
	params := url.Values{}
	params.Set("app_id", a.config.AppID)
	params.Set("method", "alipay.trade.app.pay")
	params.Set("charset", "utf-8")
	params.Set("sign_type", "RSA2")
	params.Set("timestamp", timestamp)
	params.Set("version", "1.0")
	params.Set("notify_url", a.config.NotifyURL)
	params.Set("biz_content", string(bizContentJSON))

	// 生产环境应使用RSA2签名
	// params.Set("sign", a.rsaSign(params))

	a.logger.Info("alipay payment created",
		zap.String("order_no", orderNo),
		zap.Int64("amount", amount),
		zap.String("payment_no", paymentNo),
	)

	payParams := map[string]string{
		"order_string": params.Encode(),
		"payment_no":   paymentNo,
	}
	payParamsJSON, _ := json.Marshal(payParams)

	return &PaymentResult{
		PaymentNo: paymentNo,
		PayParams: string(payParamsJSON),
	}, nil
}

func (a *AlipayPayment) QueryPayment(paymentNo string) (*PaymentStatus, error) {
	a.logger.Info("alipay query payment", zap.String("payment_no", paymentNo))

	// 生产环境应调用支付宝查询接口
	// alipay.trade.query
	return &PaymentStatus{
		PaymentNo:    paymentNo,
		Status:       "pending",
		ThirdPartyNo: "",
	}, nil
}

func (a *AlipayPayment) Refund(paymentNo string, amount int64) (*RefundResult, error) {
	refundNo := fmt.Sprintf("ALIR_%d_%s", time.Now().UnixMilli(), uuid.New().String()[:8])

	a.logger.Info("alipay refund",
		zap.String("payment_no", paymentNo),
		zap.Int64("amount", amount),
		zap.String("refund_no", refundNo),
	)

	// 生产环境应调用支付宝退款接口
	// alipay.trade.refund
	return &RefundResult{
		RefundNo: refundNo,
		Status:   "processing",
	}, nil
}

// ============================================================
// 支付Provider工厂函数
// ============================================================

// NewPaymentProvider 根据支付方式创建对应的Provider
func NewPaymentProvider(method string, wechatCfg *WeChatPayConfig, alipayCfg *AlipayConfig, logger *zap.Logger) PaymentProvider {
	switch method {
	case "wechat":
		if wechatCfg != nil && wechatCfg.AppID != "" {
			return NewWeChatPayment(*wechatCfg, logger)
		}
	case "alipay":
		if alipayCfg != nil && alipayCfg.AppID != "" {
			return NewAlipayPayment(*alipayCfg, logger)
		}
	}
	// 默认返回Mock
	return NewMockPayment(logger)
}

// VerifyWeChatCallback 验证微信支付回调签名
func VerifyWeChatCallback(body []byte, apiKey string) (map[string]string, error) {
	// 生产环境应解析微信XML回调数据并验证签名
	// 这里提供接口框架，具体实现需要根据微信文档完成
	_ = body
	_ = apiKey
	return nil, fmt.Errorf("wechat callback verification not implemented - requires production API key")
}

// VerifyAlipayCallback 验证支付宝回调签名
func VerifyAlipayCallback(params url.Values, publicKey string) (map[string]string, error) {
	// 生产环境应验证支付宝RSA2签名
	// 这里提供接口框架，具体实现需要根据支付宝文档完成
	_ = params
	_ = publicKey
	return nil, fmt.Errorf("alipay callback verification not implemented - requires production keys")
}

// unused import guard
var _ = io.ReadAll
