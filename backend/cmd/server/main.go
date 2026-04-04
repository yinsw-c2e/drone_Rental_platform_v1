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
	addresshandler "wurenji-backend/internal/api/v1/address"
	"wurenji-backend/internal/api/v1/admin"
	airspacehandler "wurenji-backend/internal/api/v1/airspace"
	analyticshandler "wurenji-backend/internal/api/v1/analytics"
	"wurenji-backend/internal/api/v1/auth"
	clienthandler "wurenji-backend/internal/api/v1/client"
	credithandler "wurenji-backend/internal/api/v1/credit"
	"wurenji-backend/internal/api/v1/demand"
	dispatchhandler "wurenji-backend/internal/api/v1/dispatch"
	"wurenji-backend/internal/api/v1/drone"
	flighthandler "wurenji-backend/internal/api/v1/flight"
	insurancehandler "wurenji-backend/internal/api/v1/insurance"
	locationhandler "wurenji-backend/internal/api/v1/location"
	"wurenji-backend/internal/api/v1/message"
	"wurenji-backend/internal/api/v1/order"
	ownerhandler "wurenji-backend/internal/api/v1/owner"
	paymenthandler "wurenji-backend/internal/api/v1/payment"
	pilothandler "wurenji-backend/internal/api/v1/pilot"
	"wurenji-backend/internal/api/v1/review"
	settlementhandler "wurenji-backend/internal/api/v1/settlement"
	"wurenji-backend/internal/api/v1/user"
	v2 "wurenji-backend/internal/api/v2"
	"wurenji-backend/internal/config"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/amap"
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
	orderArtifactRepo := repository.NewOrderArtifactRepo(db)
	reviewRepo := repository.NewReviewRepo(db)
	matchingRepo := repository.NewMatchingRepo(db)
	addressRepo := repository.NewAddressRepo(db)
	pilotRepo := repository.NewPilotRepo(db)
	clientRepo := repository.NewClientRepo(db)
	roleProfileRepo := repository.NewRoleProfileRepo(db)
	dispatchRepo := repository.NewDispatchRepo(db)
	demandDomainRepo := repository.NewDemandDomainRepo(db)
	ownerDomainRepo := repository.NewOwnerDomainRepo(db)
	flightRepo := repository.NewFlightRepo(db)
	migrationRepo := repository.NewMigrationRepo(db)
	airspaceRepo := repository.NewAirspaceRepo(db)
	settlementRepo := repository.NewSettlementRepo(db)
	creditRepo := repository.NewCreditRepository(db)
	insuranceRepo := repository.NewInsuranceRepository(db)
	analyticsRepo := repository.NewAnalyticsRepository(db)

	contractRepo := repository.NewContractRepo(db)

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
	authService := service.NewAuthService(userRepo, clientRepo, roleProfileRepo, rds, smsService, cfg, zapLogger)
	userService := service.NewUserService(userRepo, clientRepo, roleProfileRepo, droneRepo, pilotRepo)
	droneService := service.NewDroneService(droneRepo, roleProfileRepo, ownerDomainRepo)
	ownerService := service.NewOwnerService(userRepo, droneRepo, pilotRepo, roleProfileRepo, ownerDomainRepo, demandDomainRepo)
	orderService := service.NewOrderService(orderRepo, droneRepo, pilotRepo, demandRepo, paymentRepo, clientRepo, demandDomainRepo, ownerDomainRepo, orderArtifactRepo, cfg, zapLogger)
	demandService := service.NewDemandService(demandRepo, clientRepo)
	matchingService := service.NewMatchingService(matchingRepo, demandRepo, droneRepo, clientRepo, ownerDomainRepo, demandDomainRepo, zapLogger)
	paymentService := service.NewPaymentService(paymentRepo, orderRepo, droneRepo, pilotRepo, orderArtifactRepo, paymentProvider, zapLogger)
	messageService := service.NewMessageService(messageRepo)
	eventService := service.NewEventService(messageService, pushService, zapLogger)
	reviewService := service.NewReviewService(reviewRepo, droneRepo, orderRepo)
	addressService := service.NewAddressService(addressRepo)
	pilotService := service.NewPilotService(pilotRepo, userRepo, roleProfileRepo, orderRepo, ownerDomainRepo, demandDomainRepo, dispatchRepo, flightRepo, zapLogger)
	clientService := service.NewClientService(clientRepo, userRepo, roleProfileRepo, ownerDomainRepo, demandDomainRepo, orderService)
	dispatchService := service.NewDispatchService(dispatchRepo, pilotRepo, droneRepo, clientRepo, orderRepo, ownerDomainRepo, demandDomainRepo, orderArtifactRepo, zapLogger)
	flightService := service.NewFlightService(flightRepo, orderRepo, pilotRepo, zapLogger)
	homeService := service.NewHomeService(userService, clientService, ownerService, pilotService, orderService, demandDomainRepo)
	operationsService := service.NewOperationsService(migrationRepo, orderRepo)
	airspaceService := service.NewAirspaceService(airspaceRepo, pilotRepo, droneRepo, orderRepo, zapLogger)
	settlementService := service.NewSettlementService(settlementRepo, orderRepo, zapLogger)
	creditService := service.NewCreditService(creditRepo)
	insuranceService := service.NewInsuranceService(insuranceRepo, zapLogger)
	analyticsService := service.NewAnalyticsService(analyticsRepo)
	contractService := service.NewContractService(contractRepo, orderRepo, userRepo, cfg)

	ownerService.SetMatchingService(matchingService)
	ownerService.SetEventService(eventService)
	pilotService.SetMatchingService(matchingService)
	pilotService.SetDispatchService(dispatchService)
	pilotService.SetFlightService(flightService)
	pilotService.SetEventService(eventService)
	clientService.SetMatchingService(matchingService)
	clientService.SetEventService(eventService)
	paymentService.SetDispatchService(dispatchService)
	paymentService.SetEventService(eventService)
	orderService.SetEventService(eventService)
	dispatchService.SetEventService(eventService)
	droneService.SetEventService(eventService)

	// Init AMap service
	amapService := amap.NewAmapService(cfg.Amap.APIKey, zapLogger)

	// Init handlers
	handlers := &v1.Handlers{
		Auth:       auth.NewHandler(authService, wechatOAuth, qqOAuth),
		User:       user.NewHandler(userService, uploadService),
		Drone:      drone.NewHandler(droneService, uploadService),
		Owner:      ownerhandler.NewHandler(ownerService, droneService),
		Order:      order.NewHandler(orderService),
		Demand:     demand.NewHandler(demandService, matchingService),
		Payment:    paymenthandler.NewHandler(paymentService),
		Message:    message.NewHandler(messageService),
		Review:     review.NewHandler(reviewService),
		Admin:      admin.NewHandler(userService, droneService, orderService, operationsService, paymentService, pilotService, clientService, ownerService, dispatchService, flightService),
		Location:   locationhandler.NewHandler(amapService),
		Address:    addresshandler.NewHandler(addressService),
		Pilot:      pilothandler.NewHandler(pilotService, uploadService),
		Client:     clienthandler.NewHandler(clientService),
		Dispatch:   dispatchhandler.NewHandler(dispatchService, clientService, pilotService, orderRepo, orderArtifactRepo, demandDomainRepo, ownerDomainRepo),
		Flight:     flighthandler.NewHandler(flightService, pilotService),
		Airspace:   airspacehandler.NewHandler(airspaceService),
		Settlement: settlementhandler.NewHandler(settlementService),
		Credit:     credithandler.NewHandler(creditService),
		Insurance:  insurancehandler.NewHandler(insuranceService),
		Analytics:  analyticshandler.NewHandler(analyticsService),
	}
	v2Handlers := v2.NewHandlers(authService, userService, homeService, clientService, ownerService, droneService, pilotService, orderService, dispatchService, flightService, paymentService, settlementService, messageService, reviewService, handlers.Admin, handlers.Analytics, handlers.Client)
	v2Handlers.Order.SetContractService(contractService)
	clientService.SetContractService(contractService)
	orderService.SetContractService(contractService)

	// Setup Gin
	gin.SetMode(cfg.Server.Mode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.CORSMiddleware())
	r.Use(middleware.LoggerMiddleware(zapLogger))

	// Register routes
	v1.RegisterRoutes(r, handlers, hub, cfg, zapLogger)
	v2.RegisterRoutes(r, v2Handlers)

	// Start server
	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	zapLogger.Info("Server starting", zap.String("addr", addr))
	if err := r.Run(addr); err != nil {
		zapLogger.Fatal("Server failed to start", zap.Error(err))
	}
}

func initDatabase(cfg *config.Config) (*gorm.DB, error) {
	db, err := gorm.Open(mysql.Open(cfg.Database.DSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	// 设置连接池参数
	sqlDB.SetMaxIdleConns(cfg.Database.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.Database.MaxOpenConns)

	// 显式设置连接字符集
	_, err = sqlDB.Exec("SET NAMES utf8mb4")
	if err != nil {
		return nil, fmt.Errorf("failed to set charset: %w", err)
	}

	return db, nil
}

func autoMigrate(db *gorm.DB) {
	db.AutoMigrate(
		&model.User{},
		&model.ClientProfile{},
		&model.OwnerProfile{},
		&model.PilotProfile{},
		&model.Drone{},
		&model.RentalOffer{},
		&model.OwnerSupply{},
		&model.RentalDemand{},
		&model.CargoDemand{},
		&model.Demand{},
		&model.DemandQuote{},
		&model.DemandCandidatePilot{},
		&model.MatchingLog{},
		&model.Order{},
		&model.OrderTimeline{},
		&model.OrderSnapshot{},
		&model.Payment{},
		&model.Refund{},
		&model.DisputeRecord{},
		&model.Message{},
		&model.Review{},
		&model.MatchingRecord{},
		&model.SystemConfig{},
		&model.AdminLog{},
		&model.MigrationEntityMapping{},
		&model.MigrationAuditRecord{},
		&model.UserAddress{},
		// 飞手相关表
		&model.Pilot{},
		&model.PilotCertification{},
		&model.PilotFlightLog{},
		&model.PilotDroneBinding{},
		&model.OwnerPilotBinding{},
		// 无人机维护与保险表
		&model.DroneMaintenanceLog{},
		&model.DroneInsuranceRecord{},
		// 业主/客户相关表
		&model.Client{},
		&model.ClientCreditCheck{},
		&model.ClientEnterpriseCert{},
		&model.CargoDeclaration{},
		// 派单相关表
		&model.DispatchTask{},
		&model.DispatchCandidate{},
		&model.DispatchConfig{},
		&model.DispatchLog{},
		&model.FormalDispatchTask{},
		&model.FormalDispatchLog{},
		// 飞行监控相关表
		&model.FlightRecord{},
		&model.FlightPosition{},
		&model.FlightAlert{},
		&model.Geofence{},
		&model.GeofenceViolation{},
		// 轨迹与路线相关表
		&model.FlightTrajectory{},
		&model.FlightWaypoint{},
		&model.SavedRoute{},
		// 多点任务相关表
		&model.MultiPointTask{},
		&model.MultiPointTaskStop{},
		&model.FlightMonitorConfig{},
		// 空域管理与合规相关表
		&model.AirspaceApplication{},
		&model.NoFlyZone{},
		&model.ComplianceCheck{},
		&model.ComplianceCheckItem{},
		// 支付结算与分账相关表
		&model.OrderSettlement{},
		&model.UserWallet{},
		&model.WalletTransaction{},
		&model.WithdrawalRecord{},
		&model.PricingConfig{},
		// 信用评价与风控相关表
		&model.CreditScore{},
		&model.CreditScoreLog{},
		&model.RiskControl{},
		&model.Violation{},
		&model.Blacklist{},
		&model.Deposit{},
		// 保险与理赔相关表
		&model.InsurancePolicy{},
		&model.InsuranceClaim{},
		&model.ClaimTimeline{},
		&model.InsuranceProduct{},
		// 数据分析与报表相关表
		&model.DailyStatistics{},
		&model.HourlyMetrics{},
		&model.RegionStatistics{},
		&model.AnalyticsReport{},
		&model.HeatmapData{},
		&model.RealtimeDashboard{},
	)
}
