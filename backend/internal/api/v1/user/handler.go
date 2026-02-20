package user

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/pkg/upload"
	"wurenji-backend/internal/service"
)

type Handler struct {
	userService   *service.UserService
	uploadService *upload.UploadService
}

func NewHandler(userService *service.UserService, uploadService *upload.UploadService) *Handler {
	return &Handler{userService: userService, uploadService: uploadService}
}

func (h *Handler) GetProfile(c *gin.Context) {
	userID := middleware.GetUserID(c)
	user, err := h.userService.GetProfile(userID)
	if err != nil {
		response.Error(c, response.CodeNotFound, "用户不存在")
		return
	}
	response.Success(c, user)
}

type UpdateProfileReq struct {
	Nickname string `json:"nickname"`
	UserType string `json:"user_type"`
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req UpdateProfileReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if err := h.userService.UpdateProfile(userID, req.Nickname, "", req.UserType); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) UploadAvatar(c *gin.Context) {
	userID := middleware.GetUserID(c)
	file, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "请选择文件")
		return
	}

	url, err := h.uploadService.SaveFile(file, "avatar")
	if err != nil {
		response.Error(c, response.CodeUploadError, err.Error())
		return
	}

	h.userService.UpdateProfile(userID, "", url, "")
	response.Success(c, gin.H{"url": url})
}

type IDVerifyReq struct {
	IDCardNo string `json:"id_card_no" binding:"required"`
}

func (h *Handler) SubmitIDVerify(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req IDVerifyReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "身份证号不能为空")
		return
	}
	if err := h.userService.SubmitIDVerification(userID, req.IDCardNo); err != nil {
		response.Error(c, response.CodeParamError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) GetIDVerifyStatus(c *gin.Context) {
	userID := middleware.GetUserID(c)
	user, err := h.userService.GetProfile(userID)
	if err != nil {
		response.Error(c, response.CodeNotFound, "用户不存在")
		return
	}
	response.Success(c, gin.H{"status": user.IDVerified})
}

func (h *Handler) GetPublicProfile(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	user, err := h.userService.GetPublicProfile(id)
	if err != nil {
		response.Error(c, response.CodeNotFound, "用户不存在")
		return
	}
	response.Success(c, user)
}
