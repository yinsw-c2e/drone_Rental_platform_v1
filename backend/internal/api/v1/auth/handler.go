package auth

import (
	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/pkg/oauth"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	authService *service.AuthService
	wechatOAuth *oauth.WeChatOAuth
	qqOAuth     *oauth.QQOAuth
}

func NewHandler(authService *service.AuthService, wechatOAuth *oauth.WeChatOAuth, qqOAuth *oauth.QQOAuth) *Handler {
	return &Handler{authService: authService, wechatOAuth: wechatOAuth, qqOAuth: qqOAuth}
}

type SendCodeReq struct {
	Phone string `json:"phone" binding:"required"`
}

func (h *Handler) SendCode(c *gin.Context) {
	var req SendCodeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "手机号不能为空")
		return
	}
	if err := h.authService.SendCode(req.Phone); err != nil {
		response.Error(c, response.CodeSMSError, err.Error())
		return
	}
	response.Success(c, nil)
}

type RegisterReq struct {
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required,min=6"`
	Nickname string `json:"nickname"`
	Code     string `json:"code" binding:"required"`
}

func (h *Handler) Register(c *gin.Context) {
	var req RegisterReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	ok, err := h.authService.VerifyCode(req.Phone, req.Code)
	if err != nil || !ok {
		response.Error(c, response.CodeVerifyCodeError, "验证码错误")
		return
	}

	user, tokens, err := h.authService.Register(req.Phone, req.Password, req.Nickname)
	if err != nil {
		response.Error(c, response.CodeAlreadyExists, err.Error())
		return
	}

	response.Success(c, gin.H{
		"user":  user,
		"token": tokens,
	})
}

type LoginReq struct {
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password"`
	Code     string `json:"code"`
}

func (h *Handler) Login(c *gin.Context) {
	var req LoginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	var (
		user     interface{}
		tokens   interface{}
		loginErr error
	)

	if req.Code != "" {
		user, tokens, loginErr = h.authService.LoginByCode(req.Phone, req.Code)
	} else if req.Password != "" {
		user, tokens, loginErr = h.authService.Login(req.Phone, req.Password)
	} else {
		response.BadRequest(c, "请提供密码或验证码")
		return
	}

	if loginErr != nil {
		response.Error(c, response.CodeUnauthorized, loginErr.Error())
		return
	}

	response.Success(c, gin.H{
		"user":  user,
		"token": tokens,
	})
}

type RefreshReq struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

func (h *Handler) RefreshToken(c *gin.Context) {
	var req RefreshReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "refresh_token不能为空")
		return
	}

	tokens, err := h.authService.RefreshToken(req.RefreshToken)
	if err != nil {
		response.Unauthorized(c, err.Error())
		return
	}
	response.Success(c, tokens)
}

func (h *Handler) Logout(c *gin.Context) {
	// 从Header中获取access token
	accessToken := ""
	authHeader := c.GetHeader("Authorization")
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		accessToken = authHeader[7:]
	}

	// 从请求体中获取refresh token
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	c.ShouldBindJSON(&req)

	_ = h.authService.Logout(accessToken, req.RefreshToken)
	response.Success(c, nil)
}

// WeChatLogin 微信登录
func (h *Handler) WeChatLogin(c *gin.Context) {
	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "code不能为空")
		return
	}

	if h.wechatOAuth == nil || !h.wechatOAuth.IsEnabled() {
		response.Error(c, response.CodeParamError, "微信登录未配置")
		return
	}

	// 通过code获取微信用户信息
	wxUser, err := h.wechatOAuth.GetUserInfo(req.Code)
	if err != nil {
		response.Error(c, response.CodeUnauthorized, "微信授权失败: "+err.Error())
		return
	}

	// 使用第三方登录信息进行登录或注册
	user, tokens, err := h.authService.OAuthLogin(wxUser.OpenID, wxUser.UnionID, wxUser.Nickname, wxUser.Avatar, "wechat")
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}

	response.Success(c, gin.H{
		"user":  user,
		"token": tokens,
	})
}

// QQLogin QQ登录
func (h *Handler) QQLogin(c *gin.Context) {
	var req struct {
		AccessToken string `json:"access_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "access_token不能为空")
		return
	}

	if h.qqOAuth == nil || !h.qqOAuth.IsEnabled() {
		response.Error(c, response.CodeParamError, "QQ登录未配置")
		return
	}

	// 通过access_token获取QQ用户信息
	qqUser, err := h.qqOAuth.GetUserInfo(req.AccessToken)
	if err != nil {
		response.Error(c, response.CodeUnauthorized, "QQ授权失败: "+err.Error())
		return
	}

	// 使用第三方登录信息进行登录或注册
	user, tokens, err := h.authService.OAuthLogin(qqUser.OpenID, "", qqUser.Nickname, qqUser.Avatar, "qq")
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}

	response.Success(c, gin.H{
		"user":  user,
		"token": tokens,
	})
}
