package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"wurenji-backend/internal/config"
	"wurenji-backend/internal/model"
	jwtpkg "wurenji-backend/internal/pkg/jwt"
	"wurenji-backend/internal/pkg/sms"
	"wurenji-backend/internal/repository"
)

type AuthService struct {
	userRepo        *repository.UserRepo
	clientRepo      *repository.ClientRepo
	roleProfileRepo *repository.RoleProfileRepo
	rds             *redis.Client
	smsService      *sms.SMSService
	cfg             *config.Config
	logger          *zap.Logger
}

func NewAuthService(userRepo *repository.UserRepo, clientRepo *repository.ClientRepo, roleProfileRepo *repository.RoleProfileRepo, rds *redis.Client, smsService *sms.SMSService, cfg *config.Config, logger *zap.Logger) *AuthService {
	return &AuthService{
		userRepo:        userRepo,
		clientRepo:      clientRepo,
		roleProfileRepo: roleProfileRepo,
		rds:             rds,
		smsService:      smsService,
		cfg:             cfg,
		logger:          logger,
	}
}

// ensureDefaultClientProfile 默认创建个人客户档案，避免新用户再走一次初始化流程。
func (s *AuthService) ensureDefaultClientProfile(user *model.User) error {
	if user == nil || user.ID == 0 {
		return nil
	}
	if user.UserType == "admin" {
		return nil
	}

	if s.clientRepo != nil {
		_, err := s.clientRepo.GetByUserID(user.ID)
		if err == nil {
			goto ensureV2
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		if err := s.clientRepo.Create(&model.Client{
			UserID:              user.ID,
			ClientType:          "individual",
			PlatformCreditScore: 600,
			Status:              "active",
		}); err != nil {
			return err
		}
	}

ensureV2:
	if s.roleProfileRepo == nil {
		return nil
	}

	defaultContactName := user.Nickname
	if defaultContactName == "" {
		defaultContactName = user.Phone
	}

	return s.roleProfileRepo.EnsureClientProfile(&model.ClientProfile{
		UserID:              user.ID,
		Status:              "active",
		DefaultContactName:  defaultContactName,
		DefaultContactPhone: user.Phone,
	})
}

func (s *AuthService) SendCode(phone string) error {
	ctx := context.Background()
	key := fmt.Sprintf("sms:code:%s", phone)

	// Rate limit: 1 code per minute
	ttl, _ := s.rds.TTL(ctx, key).Result()
	if ttl > 4*time.Minute {
		return errors.New("请稍后再试，验证码发送过于频繁")
	}

	code := sms.GenerateCode()
	if err := s.rds.Set(ctx, key, code, 5*time.Minute).Err(); err != nil {
		return fmt.Errorf("failed to cache code: %w", err)
	}

	return s.smsService.SendCode(phone, code)
}

func (s *AuthService) VerifyCode(phone, code string) (bool, error) {
	ctx := context.Background()
	key := fmt.Sprintf("sms:code:%s", phone)

	cached, err := s.rds.Get(ctx, key).Result()
	if err == redis.Nil {
		return false, errors.New("验证码已过期")
	}
	if err != nil {
		return false, err
	}

	if cached != code {
		return false, errors.New("验证码错误")
	}

	s.rds.Del(ctx, key)
	return true, nil
}

func (s *AuthService) Register(phone, password, nickname string) (*model.User, *jwtpkg.TokenPair, error) {
	exists, err := s.userRepo.ExistsByPhone(phone)
	if err != nil {
		return nil, nil, err
	}
	if exists {
		return nil, nil, errors.New("该手机号已注册")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, nil, err
	}

	user := &model.User{
		Phone:        phone,
		PasswordHash: string(hash),
		Nickname:     nickname,
		UserType:     "renter",
		Status:       "active",
	}
	if err := s.createUserWithDefaultProfiles(user); err != nil {
		return nil, nil, err
	}

	tokens, err := jwtpkg.GenerateTokenPair(user.ID, user.UserType, s.cfg.JWT.Secret, s.cfg.JWT.AccessExpire, s.cfg.JWT.RefreshExpire)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

func (s *AuthService) Login(phone, password string) (*model.User, *jwtpkg.TokenPair, error) {
	user, err := s.userRepo.GetByPhone(phone)
	if err != nil {
		return nil, nil, errors.New("账号或密码错误")
	}

	if user.Status != "active" {
		return nil, nil, errors.New("账号已被禁用")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, nil, errors.New("账号或密码错误")
	}
	if err := s.ensureDefaultClientProfile(user); err != nil {
		s.logger.Warn("补齐默认客户档案失败", zap.Int64("user_id", user.ID), zap.Error(err))
	}

	tokens, err := jwtpkg.GenerateTokenPair(user.ID, user.UserType, s.cfg.JWT.Secret, s.cfg.JWT.AccessExpire, s.cfg.JWT.RefreshExpire)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

func (s *AuthService) LoginByCode(phone, code string) (*model.User, *jwtpkg.TokenPair, error) {
	ok, err := s.VerifyCode(phone, code)
	if err != nil || !ok {
		return nil, nil, errors.New("验证码错误")
	}

	user, err := s.userRepo.GetByPhone(phone)
	if err != nil {
		// Auto register
		user = &model.User{
			Phone:    phone,
			Nickname: "用户" + phone[len(phone)-4:],
			UserType: "renter",
			Status:   "active",
		}
		if err := s.createUserWithDefaultProfiles(user); err != nil {
			return nil, nil, err
		}
	}

	if user.Status != "active" {
		return nil, nil, errors.New("账号已被禁用")
	}
	if err := s.ensureDefaultClientProfile(user); err != nil {
		s.logger.Warn("补齐默认客户档案失败", zap.Int64("user_id", user.ID), zap.Error(err))
	}

	tokens, err := jwtpkg.GenerateTokenPair(user.ID, user.UserType, s.cfg.JWT.Secret, s.cfg.JWT.AccessExpire, s.cfg.JWT.RefreshExpire)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

func (s *AuthService) RefreshToken(refreshToken string) (*jwtpkg.TokenPair, error) {
	claims, err := jwtpkg.ParseToken(refreshToken, s.cfg.JWT.Secret)
	if err != nil {
		return nil, errors.New("refresh token无效")
	}

	// 检查refresh token是否已被加入黑名单
	if s.IsTokenBlacklisted(refreshToken) {
		return nil, errors.New("refresh token已失效")
	}

	return jwtpkg.GenerateTokenPair(claims.UserID, claims.UserType, s.cfg.JWT.Secret, s.cfg.JWT.AccessExpire, s.cfg.JWT.RefreshExpire)
}

// Logout 将token加入黑名单
func (s *AuthService) Logout(accessToken, refreshToken string) error {
	ctx := context.Background()

	// 将access token加入黑名单，过期时间与token原始过期时间一致
	if accessToken != "" {
		claims, err := jwtpkg.ParseToken(accessToken, s.cfg.JWT.Secret)
		if err == nil {
			ttl := time.Until(claims.ExpiresAt.Time)
			if ttl > 0 {
				key := fmt.Sprintf("token:blacklist:%s", accessToken)
				s.rds.Set(ctx, key, "1", ttl)
			}
		}
	}

	// 将refresh token加入黑名单
	if refreshToken != "" {
		claims, err := jwtpkg.ParseToken(refreshToken, s.cfg.JWT.Secret)
		if err == nil {
			ttl := time.Until(claims.ExpiresAt.Time)
			if ttl > 0 {
				key := fmt.Sprintf("token:blacklist:%s", refreshToken)
				s.rds.Set(ctx, key, "1", ttl)
			}
		}
	}

	return nil
}

// IsTokenBlacklisted 检查token是否在黑名单中
func (s *AuthService) IsTokenBlacklisted(token string) bool {
	ctx := context.Background()
	key := fmt.Sprintf("token:blacklist:%s", token)
	_, err := s.rds.Get(ctx, key).Result()
	return err == nil // key存在说明在黑名单中
}

// OAuthLogin 第三方登录（微信/QQ）
// 如果openID对应用户已存在则登录，否则自动注册
func (s *AuthService) OAuthLogin(openID, unionID, nickname, avatar, platform string) (*model.User, *jwtpkg.TokenPair, error) {
	var user *model.User
	var err error

	// 根据平台查找已绑定的用户
	switch platform {
	case "wechat":
		user, err = s.userRepo.GetByWechatOpenID(openID)
	case "qq":
		user, err = s.userRepo.GetByQQOpenID(openID)
	default:
		return nil, nil, fmt.Errorf("不支持的登录平台: %s", platform)
	}

	if err != nil {
		// 用户不存在，自动注册
		if nickname == "" {
			nickname = platform + "用户"
		}
		user = &model.User{
			Nickname:  nickname,
			AvatarURL: avatar,
			UserType:  "renter",
			Status:    "active",
		}
		switch platform {
		case "wechat":
			user.WechatOpenID = openID
			user.WechatUnionID = unionID
		case "qq":
			user.QQOpenID = openID
		}

		if err := s.createUserWithDefaultProfiles(user); err != nil {
			return nil, nil, fmt.Errorf("创建用户失败: %w", err)
		}
	}

	if user.Status != "active" {
		return nil, nil, errors.New("账号已被禁用")
	}
	if err := s.ensureDefaultClientProfile(user); err != nil {
		s.logger.Warn("补齐默认客户档案失败", zap.Int64("user_id", user.ID), zap.Error(err))
	}

	tokens, err := jwtpkg.GenerateTokenPair(user.ID, user.UserType, s.cfg.JWT.Secret, s.cfg.JWT.AccessExpire, s.cfg.JWT.RefreshExpire)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

func (s *AuthService) createUserWithDefaultProfiles(user *model.User) error {
	if user == nil {
		return errors.New("用户参数不能为空")
	}

	db := s.userRepo.DB()
	if db == nil {
		return errors.New("用户仓储未初始化")
	}

	return db.Transaction(func(tx *gorm.DB) error {
		userRepo := repository.NewUserRepo(tx)
		clientRepo := repository.NewClientRepo(tx)
		roleProfileRepo := repository.NewRoleProfileRepo(tx)

		if err := userRepo.Create(user); err != nil {
			return err
		}

		tempService := &AuthService{
			userRepo:        userRepo,
			clientRepo:      clientRepo,
			roleProfileRepo: roleProfileRepo,
			rds:             s.rds,
			smsService:      s.smsService,
			cfg:             s.cfg,
			logger:          s.logger,
		}
		return tempService.ensureDefaultClientProfile(user)
	})
}
