package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

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
	longaddress "wurenji-backend/internal/api/v2/longtail/address"
	longadmin "wurenji-backend/internal/api/v2/longtail/admin"
	longairspace "wurenji-backend/internal/api/v2/longtail/airspace"
	longanalytics "wurenji-backend/internal/api/v2/longtail/analytics"
	longclient "wurenji-backend/internal/api/v2/longtail/client"
	longcredit "wurenji-backend/internal/api/v2/longtail/credit"
	longdemand "wurenji-backend/internal/api/v2/longtail/demand"
	longdispatch "wurenji-backend/internal/api/v2/longtail/dispatch"
	longdrone "wurenji-backend/internal/api/v2/longtail/drone"
	longflight "wurenji-backend/internal/api/v2/longtail/flight"
	longinsurance "wurenji-backend/internal/api/v2/longtail/insurance"
	longlocation "wurenji-backend/internal/api/v2/longtail/location"
	longmessage "wurenji-backend/internal/api/v2/longtail/message"
	longorder "wurenji-backend/internal/api/v2/longtail/order"
	longowner "wurenji-backend/internal/api/v2/longtail/owner"
	longpayment "wurenji-backend/internal/api/v2/longtail/payment"
	longpilot "wurenji-backend/internal/api/v2/longtail/pilot"
	longreview "wurenji-backend/internal/api/v2/longtail/review"
	longsettlement "wurenji-backend/internal/api/v2/longtail/settlement"
	longuser "wurenji-backend/internal/api/v2/longtail/user"
	"wurenji-backend/internal/config"
	"wurenji-backend/internal/pkg/amap"
	"wurenji-backend/internal/pkg/oauth"
	paymentpkg "wurenji-backend/internal/pkg/payment"
	"wurenji-backend/internal/pkg/push"
	"wurenji-backend/internal/pkg/sms"
	"wurenji-backend/internal/pkg/upload"
	wechatpkg "wurenji-backend/internal/pkg/wechat"
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
	sqlDB, err := db.DB()
	if err != nil {
		zapLogger.Fatal("Failed to unwrap database connection", zap.Error(err))
	}

	// Schema changes are managed by backend/migrations. Keep GORM AutoMigrate out of
	// the server startup path so it cannot rewrite existing indexes or foreign keys.
	zapLogger.Info("Skipping GORM auto migration; use backend/migrations for schema changes")

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
	serviceClassRepo := repository.NewServiceClassRepo(db)
	providerPresenceRepo := repository.NewProviderPresenceRepo(db)
	orderBroadcastRepo := repository.NewOrderBroadcastRepo(db)
	broadcastAssignmentRepo := repository.NewBroadcastAssignmentRepo(db)
	wechatSubscribeRepo := repository.NewWeChatSubscribeRepo(db)

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

	var wechatSubscribeService interface {
		service.WeChatSubscribeEventSender
		GrantAcceptedTemplates(ctx context.Context, userID int64, templateIDs []string) (int, error)
	}
	if cfg.WeChat.Subscribe.Enabled {
		if cfg.Push.Provider == "mock" {
			wechatSubscribeService = service.NewMockWeChatSubscribeService(zapLogger)
			zapLogger.Info("Using mock WeChat subscribe service")
		} else if cfg.OAuth.IsWeChatMiniEnabled() {
			accessTokenManager := wechatpkg.NewAccessTokenManager(wechatpkg.AccessTokenConfig{
				AppID:     cfg.OAuth.WeChatMini.AppID,
				AppSecret: cfg.OAuth.WeChatMini.AppSecret,
				Logger:    zapLogger,
			})
			subscribeClient := wechatpkg.NewSubscribeClient(wechatpkg.SubscribeClientConfig{
				TokenProvider: accessTokenManager,
				Logger:        zapLogger,
			})
			wechatSubscribeService = service.NewWeChatSubscribeService(userRepo, wechatSubscribeRepo, subscribeClient, cfg.WeChat.Subscribe, zapLogger)
			zapLogger.Info("WeChat subscribe service initialized")
		} else {
			zapLogger.Warn("WeChat subscribe enabled but mini program OAuth is not configured")
		}
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

	var wechatMiniOAuth *oauth.WeChatOAuth
	if cfg.OAuth.IsWeChatMiniEnabled() {
		wechatMiniOAuth = oauth.NewWeChatOAuth(oauth.WeChatOAuthConfig{
			AppID:     cfg.OAuth.WeChatMini.AppID,
			AppSecret: cfg.OAuth.WeChatMini.AppSecret,
		}, zapLogger)
		zapLogger.Info("WeChat Mini Program OAuth initialized")
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
	pricingService := service.NewPricingService(serviceClassRepo)
	systemConfigService := service.NewSystemConfigService(db)
	broadcastService := service.NewBroadcastService(providerPresenceRepo, orderBroadcastRepo, broadcastAssignmentRepo, orderRepo, orderArtifactRepo, userService, zapLogger)
	demandService := service.NewDemandService(demandRepo, clientRepo)
	matchingService := service.NewMatchingService(matchingRepo, demandRepo, droneRepo, clientRepo, ownerDomainRepo, demandDomainRepo, zapLogger)
	paymentService := service.NewPaymentService(paymentRepo, orderRepo, droneRepo, pilotRepo, orderArtifactRepo, paymentProvider, zapLogger)
	paymentService.SetAllowMockPayments(cfg.Payment.AllowMock)
	messageService := service.NewMessageService(messageRepo)
	messageService.SetCreditRepository(creditRepo)
	eventService := service.NewEventService(messageService, pushService, zapLogger)
	if wechatSubscribeService != nil {
		eventService.SetWeChatSubscribeService(wechatSubscribeService)
	}
	reviewService := service.NewReviewService(reviewRepo, droneRepo, orderRepo)
	addressService := service.NewAddressService(addressRepo)
	pilotService := service.NewPilotService(pilotRepo, userRepo, roleProfileRepo, orderRepo, ownerDomainRepo, demandDomainRepo, dispatchRepo, flightRepo, zapLogger)
	clientService := service.NewClientService(clientRepo, userRepo, roleProfileRepo, ownerDomainRepo, demandDomainRepo, orderService)
	dispatchService := service.NewDispatchService(dispatchRepo, pilotRepo, droneRepo, clientRepo, orderRepo, ownerDomainRepo, demandDomainRepo, orderArtifactRepo, zapLogger)
	flightService := service.NewFlightService(flightRepo, orderRepo, pilotRepo, zapLogger)
	homeService := service.NewHomeService(userService, clientService, ownerService, pilotService, orderService, demandDomainRepo)
	orderAnomalyService := service.NewOrderAnomalyService(orderRepo)
	operationsService := service.NewOperationsService(migrationRepo, orderRepo)
	airspaceService := service.NewAirspaceService(airspaceRepo, pilotRepo, droneRepo, orderRepo, zapLogger)
	settlementService := service.NewSettlementService(settlementRepo, orderRepo, zapLogger)
	creditService := service.NewCreditService(creditRepo)
	insuranceService := service.NewInsuranceService(insuranceRepo, zapLogger)
	analyticsService := service.NewAnalyticsService(analyticsRepo)
	contractService := service.NewContractService(contractRepo, orderRepo, userRepo, cfg)

	ownerService.SetMatchingService(matchingService)
	ownerService.SetEventService(eventService)
	ownerService.SetOrderService(orderService)
	pilotService.SetMatchingService(matchingService)
	pilotService.SetDispatchService(dispatchService)
	pilotService.SetFlightService(flightService)
	pilotService.SetEventService(eventService)
	clientService.SetMatchingService(matchingService)
	clientService.SetEventService(eventService)
	clientService.SetAirspaceService(airspaceService)
	paymentService.SetDispatchService(dispatchService)
	paymentService.SetEventService(eventService)
	paymentService.SetContractRepo(contractRepo)
	settlementService.SetPaymentRepo(paymentRepo)
	settlementService.SetBroadcastRepo(orderBroadcastRepo)
	settlementService.SetSystemConfigService(systemConfigService)
	orderService.SetEventService(eventService)
	orderService.SetPricingService(pricingService)
	orderService.SetBroadcastService(broadcastService)
	orderService.SetSettlementService(settlementService)
	orderService.SetCreditService(creditService)
	orderService.SetSystemConfigService(systemConfigService)
	broadcastService.SetSystemConfigService(systemConfigService)
	broadcastService.SetEventService(eventService)
	broadcastService.SetSettlementService(settlementService)
	dispatchService.SetEventService(eventService)
	droneService.SetEventService(eventService)
	contractService.SetEventService(eventService)

	// Init AMap service
	amapService := amap.NewAmapService(cfg.Amap.APIKey, zapLogger)
	flightService.SetAmapService(amapService)

	// Keep v1 mounted as a runtime fallback until the full v2 regression suite is
	// green against the current service process.
	legacyHandlers := &v1.Handlers{
		Auth:       auth.NewHandler(authService, wechatOAuth, wechatMiniOAuth, qqOAuth),
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

	// Init v2 handlers. Longtail handlers cover domains that previously only had
	// old-shaped routes, now also mounted under /api/v2.
	longtailHandlers := &v2.LongtailHandlers{
		User:       longuser.NewHandler(userService, uploadService),
		Drone:      longdrone.NewHandler(droneService, uploadService),
		Owner:      longowner.NewHandler(ownerService, droneService),
		Order:      longorder.NewHandler(orderService),
		Demand:     longdemand.NewHandler(demandService, matchingService),
		Payment:    longpayment.NewHandler(paymentService),
		Message:    longmessage.NewHandler(messageService),
		Review:     longreview.NewHandler(reviewService),
		Admin:      longadmin.NewHandler(userService, droneService, orderService, operationsService, paymentService, pilotService, clientService, ownerService, dispatchService, flightService, settlementService, airspaceService, creditService, insuranceService, reviewService, contractService),
		Location:   longlocation.NewHandler(amapService),
		Address:    longaddress.NewHandler(addressService),
		Pilot:      longpilot.NewHandler(pilotService, uploadService),
		Client:     longclient.NewHandler(clientService),
		Dispatch:   longdispatch.NewHandler(dispatchService, clientService, pilotService, orderRepo, orderArtifactRepo, demandDomainRepo, ownerDomainRepo),
		Flight:     longflight.NewHandler(flightService, pilotService),
		Airspace:   longairspace.NewHandler(airspaceService),
		Settlement: longsettlement.NewHandler(settlementService, operationsService),
		Credit:     longcredit.NewHandler(creditService),
		Insurance:  longinsurance.NewHandler(insuranceService),
		Analytics:  longanalytics.NewHandler(analyticsService),
	}
	longtailHandlers.Admin.SetH9Dependencies(serviceClassRepo, orderBroadcastRepo, systemConfigService)
	v2Handlers := v2.NewHandlers(authService, userService, homeService, orderAnomalyService, clientService, ownerService, droneService, pilotService, orderService, dispatchService, flightService, pricingService, broadcastService, paymentService, settlementService, messageService, reviewService, pushService, wechatSubscribeService, uploadService, wechatOAuth, wechatMiniOAuth, qqOAuth, cfg.Server.Mode, longtailHandlers)
	v2Handlers.Order.SetContractService(contractService)
	clientService.SetContractService(contractService)
	orderService.SetContractService(contractService)
	broadcastService.StartReservationScheduler(context.Background())

	// Setup Gin
	gin.SetMode(cfg.Server.Mode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.CORSMiddlewareWithConfig(
		cfg.CORS.AllowedOrigins,
		cfg.CORS.AllowedMethods,
		cfg.CORS.AllowedHeaders,
	))
	r.Use(middleware.LoggerMiddleware(zapLogger))
	r.Use(middleware.RateLimitMiddleware(180, time.Minute))
	registerHealthRoutes(r, sqlDB, rds)

	// Register routes
	v1.RegisterRoutes(r, legacyHandlers, hub, cfg, zapLogger)
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
		Logger: logger.New(
			log.New(os.Stdout, "[gorm] ", log.LstdFlags),
			logger.Config{
				SlowThreshold:             300 * time.Millisecond,
				LogLevel:                  logger.Warn,
				IgnoreRecordNotFoundError: true,
				Colorful:                  false,
			},
		),
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

func registerTopLevelRoutes(r *gin.Engine, hub *ws.Hub, cfg *config.Config, logger *zap.Logger) {
	r.Static("/uploads", "./uploads")

	r.GET("/.well-known/apple-app-site-association", func(c *gin.Context) {
		c.Header("Content-Type", "application/json")
		c.JSON(http.StatusOK, gin.H{
			"applinks": gin.H{
				"apps": []string{},
				"details": []gin.H{
					{
						"appIDs": []string{"Y63CMZRDV9.com.yinswc2e.wurenji"},
						"paths":  []string{"/app/*"},
					},
				},
			},
		})
	})
	r.GET("/app/*path", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})
	r.GET("/ws", ws.HandleWebSocket(hub, cfg, logger))
}

func registerHealthRoutes(r *gin.Engine, sqlDB *sql.DB, rds *redis.Client) {
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	r.GET("/readyz", func(c *gin.Context) {
		components := gin.H{
			"database": "ok",
			"redis":    "ok",
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		statusCode := http.StatusOK
		if err := sqlDB.PingContext(ctx); err != nil {
			components["database"] = "error"
			statusCode = http.StatusServiceUnavailable
		}

		if err := rds.Ping(ctx).Err(); err != nil {
			components["redis"] = "error"
			statusCode = http.StatusServiceUnavailable
		}

		c.JSON(statusCode, gin.H{
			"status":     map[int]string{http.StatusOK: "ready", http.StatusServiceUnavailable: "degraded"}[statusCode],
			"time":       time.Now().Format(time.RFC3339),
			"components": components,
		})
	})
}
