package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"

	"wurenji-backend/internal/config"
	"wurenji-backend/internal/model"
	jwtpkg "wurenji-backend/internal/pkg/jwt"
	"wurenji-backend/internal/pkg/sms"
	"wurenji-backend/internal/repository"
)

type AuthService struct {
	userRepo   *repository.UserRepo
	rds        *redis.Client
	smsService *sms.SMSService
	cfg        *config.Config
	logger     *zap.Logger
}

func NewAuthService(userRepo *repository.UserRepo, rds *redis.Client, smsService *sms.SMSService, cfg *config.Config, logger *zap.Logger) *AuthService {
	return &AuthService{userRepo: userRepo, rds: rds, smsService: smsService, cfg: cfg, logger: logger}
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
	if err := s.userRepo.Create(user); err != nil {
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
		if err := s.userRepo.Create(user); err != nil {
			return nil, nil, err
		}
	}

	if user.Status != "active" {
		return nil, nil, errors.New("账号已被禁用")
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

	return jwtpkg.GenerateTokenPair(claims.UserID, claims.UserType, s.cfg.JWT.Secret, s.cfg.JWT.AccessExpire, s.cfg.JWT.RefreshExpire)
}
