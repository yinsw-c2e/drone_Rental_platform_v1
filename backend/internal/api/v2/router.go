package v2

import (
	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	v1admin "wurenji-backend/internal/api/v1/admin"
	v1analytics "wurenji-backend/internal/api/v1/analytics"
	v1client "wurenji-backend/internal/api/v1/client"
	v2auth "wurenji-backend/internal/api/v2/auth"
	"wurenji-backend/internal/api/v2/base"
	v2client "wurenji-backend/internal/api/v2/client"
	v2demand "wurenji-backend/internal/api/v2/demand"
	v2dispatch "wurenji-backend/internal/api/v2/dispatch"
	v2home "wurenji-backend/internal/api/v2/home"
	v2me "wurenji-backend/internal/api/v2/me"
	v2notification "wurenji-backend/internal/api/v2/notification"
	v2order "wurenji-backend/internal/api/v2/order"
	v2owner "wurenji-backend/internal/api/v2/owner"
	v2payment "wurenji-backend/internal/api/v2/payment"
	v2pilot "wurenji-backend/internal/api/v2/pilot"
	v2review "wurenji-backend/internal/api/v2/review"
	v2settlement "wurenji-backend/internal/api/v2/settlement"
	v2supply "wurenji-backend/internal/api/v2/supply"
	"wurenji-backend/internal/service"
)

type Handlers struct {
	Base         *base.Handler
	Auth         *v2auth.Handler
	Me           *v2me.Handler
	Home         *v2home.Handler
	Client       *v2client.Handler
	Supply       *v2supply.Handler
	Demand       *v2demand.Handler
	Owner        *v2owner.Handler
	Pilot        *v2pilot.Handler
	Order        *v2order.Handler
	Dispatch     *v2dispatch.Handler
	Payment      *v2payment.Handler
	Settlement   *v2settlement.Handler
	Notification *v2notification.Handler
	Review       *v2review.Handler
	AdminLegacy  *v1admin.Handler
	Analytics    *v1analytics.Handler
	ClientLegacy *v1client.Handler
}

func NewHandlers(authService *service.AuthService, userService *service.UserService, homeService *service.HomeService, clientService *service.ClientService, ownerService *service.OwnerService, droneService *service.DroneService, pilotService *service.PilotService, orderService *service.OrderService, dispatchService *service.DispatchService, flightService *service.FlightService, paymentService *service.PaymentService, settlementService *service.SettlementService, messageService *service.MessageService, reviewService *service.ReviewService, adminHandler *v1admin.Handler, analyticsHandler *v1analytics.Handler, clientLegacyHandler *v1client.Handler) *Handlers {
	return &Handlers{
		Base:         base.NewHandler(),
		Auth:         v2auth.NewHandler(authService, userService),
		Me:           v2me.NewHandler(userService),
		Home:         v2home.NewHandler(homeService),
		Client:       v2client.NewHandler(clientService),
		Supply:       v2supply.NewHandler(clientService),
		Demand:       v2demand.NewHandler(clientService),
		Owner:        v2owner.NewHandler(ownerService, droneService),
		Pilot:        v2pilot.NewHandler(pilotService),
		Order:        v2order.NewHandler(orderService, dispatchService, flightService),
		Dispatch:     v2dispatch.NewHandler(dispatchService, orderService),
		Payment:      v2payment.NewHandler(orderService, paymentService),
		Settlement:   v2settlement.NewHandler(orderService, settlementService),
		Notification: v2notification.NewHandler(messageService),
		Review:       v2review.NewHandler(orderService, reviewService),
		AdminLegacy:  adminHandler,
		Analytics:    analyticsHandler,
		ClientLegacy: clientLegacyHandler,
	}
}

func RegisterRoutes(r *gin.Engine, h *Handlers) {
	api := r.Group("/api/v2")
	api.Use(middleware.TraceIDMiddleware())
	api.Use(middleware.PaginationMiddleware(1, 20, 100))

	api.GET("/status", h.Base.Status)

	authGroup := api.Group("/auth")
	{
		authGroup.POST("/register", h.Auth.Register)
		authGroup.POST("/login", h.Auth.Login)
		authGroup.POST("/refresh-token", h.Auth.RefreshToken)
	}

	authenticated := api.Group("")
	authenticated.Use(middleware.AuthMiddleware())
	{
		authenticated.POST("/auth/logout", h.Auth.Logout)
		authenticated.GET("/me", h.Me.Get)
		authenticated.GET("/me/reviews", h.Review.ListMine)
		authenticated.GET("/home/dashboard", h.Home.GetDashboard)

		clientGroup := authenticated.Group("/client")
		{
			clientGroup.GET("/profile", h.Client.GetProfile)
			clientGroup.PATCH("/profile", h.Client.UpdateProfile)
		}

		supplyGroup := authenticated.Group("/supplies")
		{
			supplyGroup.GET("", h.Supply.List)
			supplyGroup.GET("/:supply_id", h.Supply.Get)
			supplyGroup.POST("/:supply_id/orders", h.Supply.CreateDirectOrder)
		}

		demandGroup := authenticated.Group("/demands")
		{
			demandGroup.POST("", h.Demand.Create)
			demandGroup.GET("/my", h.Demand.ListMine)
			demandGroup.GET("/:demand_id", h.Demand.Get)
			demandGroup.PATCH("/:demand_id", h.Demand.Update)
			demandGroup.POST("/:demand_id/publish", h.Demand.Publish)
			demandGroup.POST("/:demand_id/cancel", h.Demand.Cancel)
			demandGroup.GET("/:demand_id/quotes", h.Demand.ListQuotes)
			demandGroup.POST("/:demand_id/select-provider", h.Demand.SelectProvider)
			demandGroup.POST("/:demand_id/quotes", h.Owner.CreateQuote)
			demandGroup.POST("/:demand_id/candidate", h.Pilot.ApplyDemandCandidate)
			demandGroup.DELETE("/:demand_id/candidate", h.Pilot.WithdrawDemandCandidate)
		}

		ownerGroup := authenticated.Group("/owner")
		{
			ownerGroup.GET("/profile", h.Owner.GetProfile)
			ownerGroup.PUT("/profile", h.Owner.UpdateProfile)
			ownerGroup.GET("/drones", h.Owner.ListDrones)
			ownerGroup.POST("/drones", h.Owner.CreateDrone)
			ownerGroup.GET("/drones/:drone_id", h.Owner.GetDrone)
			ownerGroup.POST("/drones/:drone_id/certifications", h.Owner.SubmitDroneCertification)
			ownerGroup.GET("/supplies", h.Owner.ListSupplies)
			ownerGroup.POST("/supplies", h.Owner.CreateSupply)
			ownerGroup.GET("/supplies/:supply_id", h.Owner.GetSupply)
			ownerGroup.PUT("/supplies/:supply_id", h.Owner.UpdateSupply)
			ownerGroup.PATCH("/supplies/:supply_id/status", h.Owner.UpdateSupplyStatus)
			ownerGroup.GET("/demands/recommended", h.Owner.ListRecommendedDemands)
			ownerGroup.GET("/quotes", h.Owner.ListQuotes)
			ownerGroup.GET("/pilot-bindings", h.Owner.ListPilotBindings)
			ownerGroup.POST("/pilot-bindings", h.Owner.InvitePilotBinding)
			ownerGroup.POST("/pilot-bindings/:binding_id/confirm", h.Owner.ConfirmPilotBinding)
			ownerGroup.POST("/pilot-bindings/:binding_id/reject", h.Owner.RejectPilotBinding)
			ownerGroup.PATCH("/pilot-bindings/:binding_id/status", h.Owner.UpdatePilotBindingStatus)
		}

		pilotGroup := authenticated.Group("/pilot")
		{
			pilotGroup.GET("/profile", h.Pilot.GetProfile)
			pilotGroup.PUT("/profile", h.Pilot.UpsertProfile)
			pilotGroup.PATCH("/availability", h.Pilot.UpdateAvailability)
			pilotGroup.GET("/owner-bindings", h.Pilot.ListOwnerBindings)
			pilotGroup.POST("/owner-bindings", h.Pilot.ApplyOwnerBinding)
			pilotGroup.POST("/owner-bindings/:binding_id/confirm", h.Pilot.ConfirmOwnerBinding)
			pilotGroup.POST("/owner-bindings/:binding_id/reject", h.Pilot.RejectOwnerBinding)
			pilotGroup.PATCH("/owner-bindings/:binding_id/status", h.Pilot.UpdateOwnerBindingStatus)
			pilotGroup.GET("/candidate-demands", h.Pilot.ListCandidateDemands)
			pilotGroup.GET("/dispatch-tasks", h.Pilot.ListDispatchTasks)
			pilotGroup.GET("/flight-records", h.Pilot.ListFlightRecords)
		}

		orderGroup := authenticated.Group("/orders")
		{
			orderGroup.GET("", h.Order.List)
			orderGroup.GET("/:order_id", h.Order.Get)
			orderGroup.POST("/:order_id/provider-confirm", h.Order.ProviderConfirm)
			orderGroup.POST("/:order_id/provider-reject", h.Order.ProviderReject)
			orderGroup.POST("/:order_id/pay", h.Payment.CreateOrderPayment)
			orderGroup.POST("/:order_id/cancel", h.Base.NotImplemented)
			orderGroup.POST("/:order_id/start-preparing", h.Base.NotImplemented)
			orderGroup.POST("/:order_id/start-flight", h.Base.NotImplemented)
			orderGroup.POST("/:order_id/confirm-delivery", h.Base.NotImplemented)
			orderGroup.POST("/:order_id/confirm-receipt", h.Base.NotImplemented)
			orderGroup.GET("/:order_id/monitor", h.Order.Monitor)
			orderGroup.POST("/:order_id/dispatch", h.Order.Dispatch)
			orderGroup.GET("/:order_id/payments", h.Payment.ListOrderPayments)
			orderGroup.GET("/:order_id/refunds", h.Payment.ListOrderRefunds)
			orderGroup.POST("/:order_id/refund", h.Payment.RefundOrder)
			orderGroup.GET("/:order_id/settlement", h.Settlement.GetOrderSettlement)
			orderGroup.GET("/:order_id/disputes", h.Order.ListDisputes)
			orderGroup.POST("/:order_id/disputes", h.Order.CreateDispute)
			orderGroup.POST("/:order_id/reviews", h.Review.CreateOrderReview)
			orderGroup.GET("/:order_id/reviews", h.Review.ListOrderReviews)
		}

		dispatchGroup := authenticated.Group("/dispatch-tasks")
		{
			dispatchGroup.GET("", h.Dispatch.List)
			dispatchGroup.GET("/:dispatch_id", h.Dispatch.Get)
			dispatchGroup.POST("/:dispatch_id/accept", h.Pilot.AcceptDispatchTask)
			dispatchGroup.POST("/:dispatch_id/reject", h.Pilot.RejectDispatchTask)
			dispatchGroup.POST("/:dispatch_id/reassign", h.Dispatch.Reassign)
		}

		flightGroup := authenticated.Group("/flight-records")
		{
			flightGroup.GET("/:flight_id", h.Base.NotImplemented)
			flightGroup.POST("/:flight_id/positions", h.Base.NotImplemented)
			flightGroup.POST("/:flight_id/alerts", h.Base.NotImplemented)
			flightGroup.POST("/:flight_id/complete", h.Base.NotImplemented)
		}

		notificationGroup := authenticated.Group("/notifications")
		{
			notificationGroup.GET("", h.Notification.List)
			notificationGroup.POST("/:notification_id/read", h.Notification.MarkRead)
		}

		conversationGroup := authenticated.Group("/conversations")
		{
			conversationGroup.GET("", h.Base.NotImplemented)
			conversationGroup.GET("/:conversation_id/messages", h.Base.NotImplemented)
		}

		if h.ClientLegacy != nil {
			clientAdminGroup := authenticated.Group("/client/admin/cargo")
			clientAdminGroup.Use(middleware.AdminMiddleware())
			{
				clientAdminGroup.GET("/pending", h.ClientLegacy.AdminListPendingCargoDeclarations)
				clientAdminGroup.POST("/approve/:id", h.ClientLegacy.AdminApproveCargoDeclaration)
				clientAdminGroup.POST("/reject/:id", h.ClientLegacy.AdminRejectCargoDeclaration)
			}
		}

		if h.Analytics != nil {
			analyticsGroup := authenticated.Group("/analytics")
			{
				analyticsGroup.GET("/dashboard/realtime", h.Analytics.GetRealtimeDashboard)
				analyticsGroup.POST("/dashboard/refresh", h.Analytics.RefreshDashboard)
				analyticsGroup.GET("/overview", h.Analytics.GetOverview)
				analyticsGroup.GET("/trends", h.Analytics.GetTrendData)
				analyticsGroup.GET("/daily", h.Analytics.GetDailyStatistics)
				analyticsGroup.GET("/daily/range", h.Analytics.GetDailyStatisticsRange)
				analyticsGroup.GET("/hourly", h.Analytics.GetHourlyMetrics)
				analyticsGroup.GET("/heatmap", h.Analytics.GetHeatmapData)
				analyticsGroup.GET("/regions", h.Analytics.GetRegionStatistics)
				analyticsGroup.GET("/regions/top", h.Analytics.GetTopRegions)
				analyticsGroup.GET("/reports", h.Analytics.GetReportList)
				analyticsGroup.GET("/report/:id", h.Analytics.GetReport)
				analyticsGroup.GET("/report/no/:reportNo", h.Analytics.GetReportByNo)
				analyticsGroup.GET("/report/latest/:type", h.Analytics.GetLatestReport)
				analyticsGroup.POST("/report/generate", h.Analytics.GenerateReport)
				analyticsGroup.DELETE("/report/:id", h.Analytics.DeleteReport)
				analyticsGroup.POST("/admin/daily/generate", h.Analytics.GenerateDailyStatistics)
				analyticsGroup.POST("/admin/job/daily", h.Analytics.TriggerDailyJob)
				analyticsGroup.POST("/admin/job/hourly", h.Analytics.TriggerHourlyJob)
				analyticsGroup.POST("/admin/job/report", h.Analytics.TriggerAutoReportJob)
			}
		}

		if h.AdminLegacy != nil {
			adminGroup := authenticated.Group("/admin")
			adminGroup.Use(middleware.AdminMiddleware())
			{
				adminGroup.GET("/dashboard", h.AdminLegacy.Dashboard)
				adminGroup.GET("/users", h.AdminLegacy.UserList)
				adminGroup.PUT("/users/:id/status", h.AdminLegacy.UpdateUserStatus)
				adminGroup.PUT("/users/:id/verify", h.AdminLegacy.ApproveIDVerification)
				adminGroup.GET("/drones", h.AdminLegacy.DroneList)
				adminGroup.GET("/drones/:id", h.AdminLegacy.GetDroneDetail)
				adminGroup.PUT("/drones/:id/certification", h.AdminLegacy.ApproveDroneCertification)
				adminGroup.PUT("/drones/:id/uom", h.AdminLegacy.ApproveUOMRegistration)
				adminGroup.PUT("/drones/:id/insurance", h.AdminLegacy.ApproveInsurance)
				adminGroup.PUT("/drones/:id/airworthiness", h.AdminLegacy.ApproveAirworthiness)
				adminGroup.GET("/pilots", h.AdminLegacy.PilotList)
				adminGroup.PUT("/pilots/:id/verify", h.AdminLegacy.VerifyPilot)
				adminGroup.PUT("/pilots/:id/criminal-check", h.AdminLegacy.ApprovePilotCriminalCheck)
				adminGroup.PUT("/pilots/:id/health-check", h.AdminLegacy.ApprovePilotHealthCheck)
				adminGroup.GET("/clients", h.AdminLegacy.ClientList)
				adminGroup.PUT("/clients/:id/verify", h.AdminLegacy.VerifyClient)
				adminGroup.GET("/demands", h.AdminLegacy.DemandList)
				adminGroup.GET("/supplies", h.AdminLegacy.SupplyList)
				adminGroup.GET("/orders", h.AdminLegacy.OrderList)
				adminGroup.GET("/orders/anomalies", h.AdminLegacy.OrderAnomalyList)
				adminGroup.GET("/orders/anomalies/summary", h.AdminLegacy.OrderAnomalySummary)
				adminGroup.GET("/dispatch-tasks", h.AdminLegacy.DispatchTaskList)
				adminGroup.GET("/flight-records", h.AdminLegacy.FlightRecordList)
				adminGroup.GET("/migration-audits", h.AdminLegacy.MigrationAuditList)
				adminGroup.GET("/migration-audits/summary", h.AdminLegacy.MigrationAuditSummary)
				adminGroup.GET("/payments", h.AdminLegacy.PaymentList)
			}
		}
	}
}
