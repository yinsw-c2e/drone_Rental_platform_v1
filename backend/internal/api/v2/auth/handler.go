package auth

import (
	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	authService *service.AuthService
	userService *service.UserService
}

func NewHandler(authService *service.AuthService, userService *service.UserService) *Handler {
	return &Handler{
		authService: authService,
		userService: userService,
	}
}

type RegisterRequest struct {
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required,min=6"`
	Nickname string `json:"nickname"`
}

type LoginRequest struct {
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password"`
	Code     string `json:"code"`
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

func (h *Handler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid register payload")
		return
	}

	user, tokens, err := h.authService.Register(req.Phone, req.Password, req.Nickname)
	if err != nil {
		response.V2Conflict(c, err.Error())
		return
	}

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
