package auth

import (
	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	authService *service.AuthService
}

func NewHandler(authService *service.AuthService) *Handler {
	return &Handler{authService: authService}
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
