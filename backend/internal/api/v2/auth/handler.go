package auth

import (
	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/oauth"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	authService     *service.AuthService
	userService     *service.UserService
	wechatOAuth     *oauth.WeChatOAuth
	wechatMiniOAuth *oauth.WeChatOAuth
	qqOAuth         *oauth.QQOAuth
}

func NewHandler(authService *service.AuthService, userService *service.UserService, wechatOAuth *oauth.WeChatOAuth, wechatMiniOAuth *oauth.WeChatOAuth, qqOAuth *oauth.QQOAuth) *Handler {
	return &Handler{
		authService:     authService,
		userService:     userService,
		wechatOAuth:     wechatOAuth,
		wechatMiniOAuth: wechatMiniOAuth,
		qqOAuth:         qqOAuth,
	}
}

type RegisterRequest struct {
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required,min=6"`
	Nickname string `json:"nickname"`
	Code     string `json:"code" binding:"required,len=6"`
}

type LoginRequest struct {
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password"`
	Code     string `json:"code"`
}

type SendCodeRequest struct {
	Phone string `json:"phone" binding:"required"`
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type authUser struct {
	ID        int64  `json:"id"`
	Phone     string `json:"phone"`
	Nickname  string `json:"nickname"`
	AvatarURL string `json:"avatar_url,omitempty"`
}

func (h *Handler) writeAuthSuccess(c *gin.Context, user *model.User, tokens interface{}) {
	roleSummary, err := h.userService.GetRoleSummary(user.ID)
	if err != nil {
		response.V2InternalError(c, err.Error())
		return
	}

	response.V2Success(c, gin.H{
		"user": authUser{
			ID:        user.ID,
			Phone:     user.Phone,
			Nickname:  user.Nickname,
			AvatarURL: user.AvatarURL,
		},
		"token":        tokens,
		"role_summary": roleSummary,
	})
}

func (h *Handler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid register payload")
		return
	}
	ok, err := h.authService.VerifyCode(req.Phone, req.Code)
	if err != nil || !ok {
		response.V2ValidationError(c, "验证码错误或已过期")
		return
	}

	user, tokens, err := h.authService.Register(req.Phone, req.Password, req.Nickname)
	if err != nil {
		response.V2Conflict(c, err.Error())
		return
	}

	h.writeAuthSuccess(c, user, tokens)
}

func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid login payload")
		return
	}

	var (
		user   *model.User
		tokens interface{}
		err    error
	)
	if req.Code != "" {
		user, tokens, err = h.authService.LoginByCode(req.Phone, req.Code)
	} else if req.Password != "" {
		user, tokens, err = h.authService.Login(req.Phone, req.Password)
	} else {
		response.V2ValidationError(c, "password or code is required")
		return
	}
	if err != nil {
		response.V2Unauthorized(c, err.Error())
		return
	}

	h.writeAuthSuccess(c, user, tokens)
}

func (h *Handler) SendCode(c *gin.Context) {
	var req SendCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "phone is required")
		return
	}
	if err := h.authService.SendCode(req.Phone); err != nil {
		response.V2BadRequest(c, err.Error())
		return
	}
	response.V2Success(c, gin.H{})
}

func (h *Handler) WeChatLogin(c *gin.Context) {
	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "code is required")
		return
	}
	if h.wechatOAuth == nil || !h.wechatOAuth.IsEnabled() {
		response.V2BadRequest(c, "微信登录未配置")
		return
	}

	wxUser, err := h.wechatOAuth.GetUserInfo(req.Code)
	if err != nil {
		response.V2Unauthorized(c, "微信授权失败: "+err.Error())
		return
	}

	user, tokens, err := h.authService.OAuthLogin(wxUser.OpenID, wxUser.UnionID, wxUser.Nickname, wxUser.Avatar, "wechat")
	if err != nil {
		response.V2InternalError(c, err.Error())
		return
	}
	h.writeAuthSuccess(c, user, tokens)
}

func (h *Handler) WeChatMiniLogin(c *gin.Context) {
	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "code is required")
		return
	}
	if h.wechatMiniOAuth == nil || !h.wechatMiniOAuth.IsEnabled() {
		response.V2BadRequest(c, "微信小程序登录未配置")
		return
	}

	wxUser, err := h.wechatMiniOAuth.GetMiniProgramUserInfo(req.Code)
	if err != nil {
		response.V2Unauthorized(c, "微信小程序授权失败: "+err.Error())
		return
	}

	user, tokens, err := h.authService.OAuthLogin(wxUser.OpenID, wxUser.UnionID, wxUser.Nickname, wxUser.Avatar, "wechat")
	if err != nil {
		response.V2InternalError(c, err.Error())
		return
	}
	h.writeAuthSuccess(c, user, tokens)
}

func (h *Handler) QQLogin(c *gin.Context) {
	var req struct {
		AccessToken string `json:"access_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "access_token is required")
		return
	}
	if h.qqOAuth == nil || !h.qqOAuth.IsEnabled() {
		response.V2BadRequest(c, "QQ登录未配置")
		return
	}

	qqUser, err := h.qqOAuth.GetUserInfo(req.AccessToken)
	if err != nil {
		response.V2Unauthorized(c, "QQ授权失败: "+err.Error())
		return
	}

	user, tokens, err := h.authService.OAuthLogin(qqUser.OpenID, "", qqUser.Nickname, qqUser.Avatar, "qq")
	if err != nil {
		response.V2InternalError(c, err.Error())
		return
	}
	h.writeAuthSuccess(c, user, tokens)
}

func (h *Handler) RefreshToken(c *gin.Context) {
	var req RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid refresh token payload")
		return
	}

	tokens, err := h.authService.RefreshToken(req.RefreshToken)
	if err != nil {
		response.V2Unauthorized(c, err.Error())
		return
	}

	response.V2Success(c, tokens)
}

func (h *Handler) Logout(c *gin.Context) {
	accessToken := ""
	authHeader := c.GetHeader("Authorization")
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		accessToken = authHeader[7:]
	}

	var req RefreshTokenRequest
	_ = c.ShouldBindJSON(&req)

	_ = h.authService.Logout(accessToken, req.RefreshToken)
	response.V2Success(c, gin.H{})
}
