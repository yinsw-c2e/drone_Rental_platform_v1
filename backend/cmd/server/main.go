package main

import (
	"fmt"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"go.uber.org/zap"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"wurenji-backend/internal/api/middleware"
	v1 "wurenji-backend/internal/api/v1"
	"wurenji-backend/internal/api/v1/admin"
	"wurenji-backend/internal/api/v1/auth"
	"wurenji-backend/internal/api/v1/demand"
	"wurenji-backend/internal/api/v1/drone"
	"wurenji-backend/internal/api/v1/message"
	"wurenji-backend/internal/api/v1/order"
	paymenthandler "wurenji-backend/internal/api/v1/payment"
	"wurenji-backend/internal/api/v1/review"
	"wurenji-backend/internal/api/v1/user"
	"wurenji-backend/internal/config"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/oauth"
	paymentpkg "wurenji-backend/internal/pkg/payment"
	"wurenji-backend/internal/pkg/push"
	"wurenji-backend/internal/pkg/sms"
	"wurenji-backend/internal/pkg/upload"
	"wurenji-backend/internal/repository"
	"wurenji-backend/internal/service"
	ws "wurenji-backend/internal/websocket"
)

func main() {
	// Load config
	cfgPath := "config.yaml"
	if envPath := os.Getenv("CONFIG_PATH"); envPath != "" {
		cfgPath = envPath
	}

	cfg, err := config.LoadConfig(cfgPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Validate config
	if err := cfg.Validate(); err != nil {
		log.Fatalf("Config validation failed: %v", err)
	}

	// Print config status
	cfg.PrintConfigStatus()

	// Ensure upload directory exists
	if err := cfg.EnsureUploadDir(); err != nil {
		log.Fatalf("Failed to create upload directory: %v", err)
	}

	// Init logger
	var zapLogger *zap.Logger
	if cfg.Server.Mode == "debug" {
		zapLogger, _ = zap.NewDevelopment()
	} else {
		zapLogger, _ = zap.NewProduction()
	}
	defer zapLogger.Sync()

	// Init database
	db, err := initDatabase(cfg)
	if err != nil {
		zapLogger.Fatal("Failed to connect database", zap.Error(err))
	}

	// Auto migrate
	autoMigrate(db)

	// Init Redis
	rds := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Addr(),
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})

	// Init WebSocket Hub
	hub := ws.NewHub(zapLogger)
	go hub.Run()

	// 设置token黑名单Redis
	middleware.SetTokenBlacklistRedis(rds)

	// Init repositories
	userRepo := repository.NewUserRepo(db)
	droneRepo := repository.NewDroneRepo(db)
	orderRepo := repository.NewOrderRepo(db)
	demandRepo := repository.NewDemandRepo(db)
	messageRepo := repository.NewMessageRepo(db)
	paymentRepo := repository.NewPaymentRepo(db)
	reviewRepo := repository.NewReviewRepo(db)
	matchingRepo := repository.NewMatchingRepo(db)

	// Init pkg services
	smsService := sms.NewSMSService(cfg.SMS.Provider, zapLogger)
	// 配置阿里云短信参数
	if cfg.SMS.Provider == "aliyun" {
		smsService.WithAliyunConfig(
			cfg.SMS.Aliyun.AccessKeyID,
			cfg.SMS.Aliyun.AccessKeySecret,
			cfg.SMS.SignName,
			cfg.SMS.TemplateCode,
		)
	}
	uploadService := upload.NewUploadService(cfg.Upload.SavePath, cfg.Upload.MaxSize, cfg.Upload.AllowedExts)
	paymentProvider := paymentpkg.NewMockPayment(zapLogger)

	// Init push service
	var pushService push.PushService
	if cfg.Push.IsJPushEnabled() {
		pushService = push.NewJPushService(push.JPushConfig{
			AppKey:       cfg.Push.JPush.AppKey,
			MasterSecret: cfg.Push.JPush.MasterSecret,
			Enabled:      true,
		}, zapLogger)
		zapLogger.Info("JPush push service initialized")
	} else {
		pushService = push.NewMockPushService(zapLogger)
		zapLogger.Info("Using mock push service")
	}
	// pushService 变量保留用于后续订单状态推送等场景
	_ = pushService

	// Init OAuth providers
	var wechatOAuth *oauth.WeChatOAuth
	if cfg.OAuth.IsWeChatEnabled() {
		wechatOAuth = oauth.NewWeChatOAuth(oauth.WeChatOAuthConfig{
			AppID:     cfg.OAuth.WeChat.AppID,
			AppSecret: cfg.OAuth.WeChat.AppSecret,
		}, zapLogger)
		zapLogger.Info("WeChat OAuth initialized")
	}

	var qqOAuth *oauth.QQOAuth
	if cfg.OAuth.IsQQEnabled() {
		qqOAuth = oauth.NewQQOAuth(oauth.QQOAuthConfig{
			AppID:  cfg.OAuth.QQ.AppID,
			AppKey: cfg.OAuth.QQ.AppKey,
		}, zapLogger)
		zapLogger.Info("QQ OAuth initialized")
	}

	// Init business services
	authService := service.NewAuthService(userRepo, rds, smsService, cfg, zapLogger)
	userService := service.NewUserService(userRepo)
	droneService := service.NewDroneService(droneRepo)
	orderService := service.NewOrderService(orderRepo, droneRepo, demandRepo, cfg, zapLogger)
	demandService := service.NewDemandService(demandRepo)
	matchingService := service.NewMatchingService(matchingRepo, demandRepo, droneRepo, zapLogger)
	paymentService := service.NewPaymentService(paymentRepo, orderRepo, paymentProvider, zapLogger)
	messageService := service.NewMessageService(messageRepo)
	reviewService := service.NewReviewService(reviewRepo, droneRepo, orderRepo)

	// Init handlers
	handlers := &v1.Handlers{
		Auth:    auth.NewHandler(authService, wechatOAuth, qqOAuth),
		User:    user.NewHandler(userService, uploadService),
		Drone:   drone.NewHandler(droneService, uploadService),
		Order:   order.NewHandler(orderService),
		Demand:  demand.NewHandler(demandService, matchingService),
		Payment: paymenthandler.NewHandler(paymentService),
		Message: message.NewHandler(messageService),
		Review:  review.NewHandler(reviewService),
		Admin:   admin.NewHandler(userService, droneService, orderService, paymentService),
	}

	// Setup Gin
	gin.SetMode(cfg.Server.Mode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.CORSMiddleware())
	r.Use(middleware.LoggerMiddleware(zapLogger))

	// Register routes
	v1.RegisterRoutes(r, handlers, hub, cfg, zapLogger)

	// Start server
	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	zapLogger.Info("Server starting", zap.String("addr", addr))
	if err := r.Run(addr); err != nil {
		zapLogger.Fatal("Server failed to start", zap.Error(err))
	}
}

func initDatabase(cfg *config.Config) (*gorm.DB, error) {
	db, err := gorm.Open(mysql.Open(cfg.Database.DSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxIdleConns(cfg.Database.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.Database.MaxOpenConns)

	return db, nil
}

func autoMigrate(db *gorm.DB) {
	db.AutoMigrate(
		&model.User{},
		&model.Drone{},
		&model.RentalOffer{},
		&model.RentalDemand{},
		&model.CargoDemand{},
		&model.Order{},
		&model.OrderTimeline{},
		&model.Payment{},
		&model.Message{},
		&model.Review{},
		&model.MatchingRecord{},
		&model.SystemConfig{},
		&model.AdminLog{},
	)
}
