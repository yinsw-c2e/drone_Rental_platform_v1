package v2

import (
	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	v2anomaly "wurenji-backend/internal/api/v2/anomaly"
	v2auth "wurenji-backend/internal/api/v2/auth"
	"wurenji-backend/internal/api/v2/base"
	v2client "wurenji-backend/internal/api/v2/client"
	v2demand "wurenji-backend/internal/api/v2/demand"
	v2dispatch "wurenji-backend/internal/api/v2/dispatch"
	v2flight "wurenji-backend/internal/api/v2/flight"
	v2home "wurenji-backend/internal/api/v2/home"
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
	v2me "wurenji-backend/internal/api/v2/me"
	v2message "wurenji-backend/internal/api/v2/message"
	v2notification "wurenji-backend/internal/api/v2/notification"
	v2order "wurenji-backend/internal/api/v2/order"
	v2owner "wurenji-backend/internal/api/v2/owner"
	v2payment "wurenji-backend/internal/api/v2/payment"
	v2pilot "wurenji-backend/internal/api/v2/pilot"
	v2push "wurenji-backend/internal/api/v2/push"
	v2review "wurenji-backend/internal/api/v2/review"
	v2settlement "wurenji-backend/internal/api/v2/settlement"
	v2supply "wurenji-backend/internal/api/v2/supply"
	"wurenji-backend/internal/pkg/oauth"
	pushpkg "wurenji-backend/internal/pkg/push"
	uploadpkg "wurenji-backend/internal/pkg/upload"
	"wurenji-backend/internal/service"
)

type Handlers struct {
	Base         *base.Handler
	Auth         *v2auth.Handler
	Me           *v2me.Handler
	Home         *v2home.Handler
	Anomaly      *v2anomaly.Handler
	Client       *v2client.Handler
	Supply       *v2supply.Handler
	Demand       *v2demand.Handler
	Owner        *v2owner.Handler
	Pilot        *v2pilot.Handler
	Order        *v2order.Handler
	Dispatch     *v2dispatch.Handler
	Flight       *v2flight.Handler
	Message      *v2message.Handler
	Payment      *v2payment.Handler
	Settlement   *v2settlement.Handler
	Notification *v2notification.Handler
	Push         *v2push.Handler
	Review       *v2review.Handler
	Longtail     *LongtailHandlers
}

type LongtailHandlers struct {
	User       *longuser.Handler
	Drone      *longdrone.Handler
	Demand     *longdemand.Handler
	Order      *longorder.Handler
	Payment    *longpayment.Handler
	Message    *longmessage.Handler
	Review     *longreview.Handler
	Location   *longlocation.Handler
	Address    *longaddress.Handler
	Pilot      *longpilot.Handler
	Client     *longclient.Handler
	Dispatch   *longdispatch.Handler
	Flight     *longflight.Handler
	Airspace   *longairspace.Handler
	Settlement *longsettlement.Handler
	Credit     *longcredit.Handler
	Insurance  *longinsurance.Handler
	Analytics  *longanalytics.Handler
	Admin      *longadmin.Handler
	Owner      *longowner.Handler
}

func NewHandlers(authService *service.AuthService, userService *service.UserService, homeService *service.HomeService, orderAnomalyService *service.OrderAnomalyService, clientService *service.ClientService, ownerService *service.OwnerService, droneService *service.DroneService, pilotService *service.PilotService, orderService *service.OrderService, dispatchService *service.DispatchService, flightService *service.FlightService, paymentService *service.PaymentService, settlementService *service.SettlementService, messageService *service.MessageService, reviewService *service.ReviewService, pushService pushpkg.PushService, uploadService *uploadpkg.UploadService, wechatOAuth *oauth.WeChatOAuth, wechatMiniOAuth *oauth.WeChatOAuth, qqOAuth *oauth.QQOAuth, serverMode string, longtail *LongtailHandlers) *Handlers {
	return &Handlers{
		Base:         base.NewHandler(),
		Auth:         v2auth.NewHandler(authService, userService, wechatOAuth, wechatMiniOAuth, qqOAuth),
		Me:           v2me.NewHandler(userService),
		Home:         v2home.NewHandler(homeService),
		Anomaly:      v2anomaly.NewHandler(orderAnomalyService),
		Client:       v2client.NewHandler(clientService),
		Supply:       v2supply.NewHandler(clientService),
		Demand:       v2demand.NewHandler(clientService),
		Owner:        v2owner.NewHandler(ownerService, droneService),
		Pilot:        v2pilot.NewHandler(pilotService, uploadService),
		Order:        v2order.NewHandler(orderService, dispatchService, flightService),
		Dispatch:     v2dispatch.NewHandler(dispatchService, orderService),
		Flight:       v2flight.NewHandler(flightService, orderService),
		Message:      v2message.NewHandler(messageService),
		Payment:      v2payment.NewHandler(orderService, paymentService),
		Settlement:   v2settlement.NewHandler(orderService, settlementService),
		Notification: v2notification.NewHandler(messageService),
		Push:         v2push.NewHandler(pushService, serverMode),
		Review:       v2review.NewHandler(orderService, reviewService),
		Longtail:     longtail,
	}
}

func RegisterRoutes(r *gin.Engine, h *Handlers) {
	api := r.Group("/api/v2")
	api.Use(middleware.TraceIDMiddleware())
	api.Use(middleware.PaginationMiddleware(1, 20, 100))

	api.GET("/status", h.Base.Status)
	api.GET("/orders/:order_id/contract/pdf", h.Order.DownloadContractPDF)

	authGroup := api.Group("/auth")
	{
		authGroup.POST("/send-code", h.Auth.SendCode)
		authGroup.POST("/register", h.Auth.Register)
		authGroup.POST("/login", h.Auth.Login)
		authGroup.POST("/refresh-token", h.Auth.RefreshToken)
		authGroup.POST("/wechat-login", h.Auth.WeChatLogin)
		authGroup.POST("/wechat-mini-login", h.Auth.WeChatMiniLogin)
		authGroup.POST("/qq-login", h.Auth.QQLogin)
	}

	if h.Longtail != nil {
		if h.Longtail.Payment != nil {
			api.POST("/payment/wechat/notify", h.Longtail.Payment.WechatNotify)
			api.POST("/payment/alipay/notify", h.Longtail.Payment.AlipayNotify)
			api.POST("/payment/mock/callback", h.Longtail.Payment.MockCallback)
		}
		if h.Longtail.Airspace != nil {
			airspacePublicGroup := api.Group("/airspace")
			{
				airspacePublicGroup.GET("/no-fly-zones", h.Longtail.Airspace.ListNoFlyZones)
				airspacePublicGroup.GET("/no-fly-zone/:id", h.Longtail.Airspace.GetNoFlyZone)
				airspacePublicGroup.GET("/no-fly-zones/nearby", h.Longtail.Airspace.FindNearbyNoFlyZones)
				airspacePublicGroup.GET("/check-availability", h.Longtail.Airspace.CheckAirspaceAvailability)
			}
		}
	}

	authenticated := api.Group("")
	authenticated.Use(middleware.AuthMiddleware())
	{
		lt := h.Longtail
		authenticated.POST("/auth/logout", h.Auth.Logout)
		authenticated.GET("/me", h.Me.Get)
		authenticated.GET("/me/reviews", h.Review.ListMine)
		authenticated.GET("/home/dashboard", h.Home.GetDashboard)
		authenticated.GET("/order-anomalies", h.Anomaly.List)
		authenticated.GET("/order-anomalies/summary", h.Anomaly.Summary)

		clientGroup := authenticated.Group("/client")
		{
			clientGroup.GET("/profile", h.Client.GetProfile)
			clientGroup.GET("/eligibility", h.Client.GetEligibility)
			clientGroup.PATCH("/profile", h.Client.UpdateProfile)
			if lt != nil && lt.Client != nil {
				clientGroup.POST("/register/individual", lt.Client.RegisterIndividual)
				clientGroup.POST("/register/enterprise", lt.Client.RegisterEnterprise)
				clientGroup.PUT("/profile", lt.Client.UpdateProfile)
				clientGroup.POST("/demands", lt.Client.CreateDemand)
				clientGroup.GET("/demands", lt.Client.MyDemands)
				clientGroup.GET("/demands/:id", lt.Client.GetDemand)
				clientGroup.PATCH("/demands/:id", lt.Client.UpdateDemand)
				clientGroup.POST("/demands/:id/publish", lt.Client.PublishDemand)
				clientGroup.POST("/demands/:id/cancel", lt.Client.CancelDemand)
				clientGroup.GET("/demands/:id/quotes", lt.Client.ListDemandQuotes)
				clientGroup.POST("/demands/:id/select-provider", lt.Client.SelectProvider)
				clientGroup.GET("/list", lt.Client.List)
				clientGroup.GET("/:id", lt.Client.GetByID)
				clientGroup.POST("/credit/check", lt.Client.RequestCreditCheck)
				clientGroup.GET("/credit/history", lt.Client.GetCreditHistory)
				clientGroup.POST("/enterprise/cert", lt.Client.SubmitEnterpriseCert)
				clientGroup.GET("/enterprise/certs", lt.Client.GetEnterpriseCerts)
				clientGroup.POST("/cargo/declaration", lt.Client.CreateCargoDeclaration)
				clientGroup.GET("/cargo/declaration/:id", lt.Client.GetCargoDeclaration)
				clientGroup.GET("/cargo/declarations", lt.Client.ListCargoDeclarations)
				clientGroup.PUT("/cargo/declaration/:id", lt.Client.UpdateCargoDeclaration)
				clientGroup.GET("/order/eligibility", lt.Client.CheckOrderEligibility)
				clientGroup.POST("/admin/approve/:id", lt.Client.AdminApproveClient)
				clientGroup.POST("/admin/reject/:id", lt.Client.AdminRejectClient)
				clientGroup.POST("/admin/cert/approve/:id", lt.Client.AdminApproveEnterpriseCert)
				clientGroup.POST("/admin/cert/reject/:id", lt.Client.AdminRejectEnterpriseCert)
				clientGroup.POST("/admin/cargo/approve/:id", lt.Client.AdminApproveCargoDeclaration)
				clientGroup.POST("/admin/cargo/reject/:id", lt.Client.AdminRejectCargoDeclaration)
				clientGroup.GET("/admin/pending", lt.Client.AdminListPendingVerification)
				clientGroup.GET("/admin/cargo/pending", lt.Client.AdminListPendingCargoDeclarations)
			}
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
			demandGroup.GET("", h.Demand.ListMarketplace)
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
			ownerGroup.GET("/workbench", h.Owner.GetWorkbench)
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
			if lt != nil && lt.Pilot != nil {
				pilotGroup.POST("/register", lt.Pilot.Register)
			}
			pilotGroup.GET("/profile", h.Pilot.GetProfile)
			pilotGroup.PUT("/profile", h.Pilot.UpsertProfile)
			pilotGroup.POST("/upload-cert", h.Pilot.UploadCertImage)
			pilotGroup.POST("/certifications", h.Pilot.SubmitCertification)
			pilotGroup.GET("/certifications", h.Pilot.ListCertifications)
			pilotGroup.POST("/criminal-check", h.Pilot.SubmitCriminalCheck)
			pilotGroup.POST("/health-check", h.Pilot.SubmitHealthCheck)
			pilotGroup.PATCH("/availability", h.Pilot.UpdateAvailability)
			pilotGroup.GET("/owner-bindings", h.Pilot.ListOwnerBindings)
			pilotGroup.POST("/owner-bindings", h.Pilot.ApplyOwnerBinding)
			pilotGroup.POST("/owner-bindings/:binding_id/confirm", h.Pilot.ConfirmOwnerBinding)
			pilotGroup.POST("/owner-bindings/:binding_id/reject", h.Pilot.RejectOwnerBinding)
			pilotGroup.PATCH("/owner-bindings/:binding_id/status", h.Pilot.UpdateOwnerBindingStatus)
			pilotGroup.GET("/candidate-demands", h.Pilot.ListCandidateDemands)
			pilotGroup.GET("/dispatch-tasks", h.Pilot.ListDispatchTasks)
			pilotGroup.GET("/flight-records", h.Pilot.ListFlightRecords)
			if lt != nil && lt.Pilot != nil {
				pilotGroup.PUT("/location", lt.Pilot.UpdateLocation)
				pilotGroup.PUT("/availability", lt.Pilot.UpdateAvailability)
				pilotGroup.GET("/list", lt.Pilot.List)
				pilotGroup.GET("/nearby", lt.Pilot.Nearby)
				pilotGroup.GET("/:id", lt.Pilot.GetByID)
				pilotGroup.POST("/certification", lt.Pilot.SubmitCertification)
				pilotGroup.GET("/flight-logs", lt.Pilot.GetFlightLogs)
				pilotGroup.POST("/flight-log", lt.Pilot.AddFlightLog)
				pilotGroup.GET("/flight-stats", lt.Pilot.GetFlightStats)
				pilotGroup.GET("/bound-drones", lt.Pilot.GetBoundDrones)
				pilotGroup.POST("/bind-drone", lt.Pilot.BindDrone)
				pilotGroup.DELETE("/unbind/:bindingId", lt.Pilot.UnbindDrone)
			}
		}

		if lt != nil && lt.User != nil {
			userGroup := authenticated.Group("/user")
			{
				userGroup.GET("/profile", lt.User.GetProfile)
				userGroup.PUT("/profile", lt.User.UpdateProfile)
				userGroup.POST("/avatar", lt.User.UploadAvatar)
				userGroup.POST("/id-verify", lt.User.SubmitIDVerify)
				userGroup.GET("/id-verify/status", lt.User.GetIDVerifyStatus)
				userGroup.GET("/:id", lt.User.GetPublicProfile)
			}
		}

		if lt != nil && lt.Drone != nil {
			droneGroup := authenticated.Group("/drone")
			{
				droneGroup.GET("", lt.Drone.List)
				droneGroup.POST("", lt.Drone.Create)
				droneGroup.GET("/my", lt.Drone.MyDrones)
				droneGroup.GET("/nearby", lt.Drone.Nearby)
				droneGroup.POST("/upload", lt.Drone.UploadImages)
				droneGroup.GET("/:id", lt.Drone.GetByID)
				droneGroup.PUT("/:id", lt.Drone.Update)
				droneGroup.DELETE("/:id", lt.Drone.Delete)
				droneGroup.POST("/:id/images", lt.Drone.UploadImages)
				droneGroup.POST("/:id/certification", lt.Drone.SubmitCertification)
				droneGroup.PUT("/:id/availability", lt.Drone.UpdateAvailability)
				droneGroup.POST("/:id/uom", lt.Drone.SubmitUOMRegistration)
				droneGroup.POST("/:id/insurance", lt.Drone.SubmitInsurance)
				droneGroup.POST("/:id/airworthiness", lt.Drone.SubmitAirworthiness)
				droneGroup.POST("/:id/maintenance", lt.Drone.AddMaintenanceLog)
				droneGroup.GET("/:id/maintenance", lt.Drone.GetMaintenanceLogs)
				droneGroup.GET("/:id/cert-status", lt.Drone.GetCertificationStatus)
			}
		}

		if lt != nil && lt.Demand != nil {
			offerGroup := authenticated.Group("/rental/offer")
			{
				offerGroup.GET("", lt.Demand.ListOffers)
				offerGroup.POST("", lt.Demand.CreateOffer)
				offerGroup.GET("/my", lt.Demand.MyOffers)
				offerGroup.GET("/:id", lt.Demand.GetOffer)
				offerGroup.PUT("/:id", lt.Demand.UpdateOffer)
				offerGroup.DELETE("/:id", lt.Demand.DeleteOffer)
			}

			rentalDemandGroup := authenticated.Group("/rental/demand")
			{
				rentalDemandGroup.GET("", lt.Demand.ListDemands)
				rentalDemandGroup.POST("", lt.Demand.CreateDemand)
				rentalDemandGroup.GET("/my", lt.Demand.MyDemands)
				rentalDemandGroup.GET("/:id", lt.Demand.GetDemand)
				rentalDemandGroup.PUT("/:id", lt.Demand.UpdateDemand)
				rentalDemandGroup.DELETE("/:id", lt.Demand.DeleteDemand)
				rentalDemandGroup.GET("/:id/matches", lt.Demand.GetDemandMatches)
			}

			cargoGroup := authenticated.Group("/cargo")
			{
				cargoGroup.GET("", lt.Demand.ListCargos)
				cargoGroup.POST("", lt.Demand.CreateCargo)
				cargoGroup.GET("/my", lt.Demand.MyCargos)
				cargoGroup.GET("/:id", lt.Demand.GetCargo)
				cargoGroup.PUT("/:id", lt.Demand.UpdateCargo)
				cargoGroup.DELETE("/:id", lt.Demand.DeleteCargo)
				cargoGroup.GET("/:id/matches", lt.Demand.GetCargoMatches)
			}
		}

		orderGroup := authenticated.Group("/orders")
		{
			orderGroup.GET("", h.Order.List)
			orderGroup.GET("/:order_id", h.Order.Get)
			orderGroup.POST("/:order_id/provider-confirm", h.Order.ProviderConfirm)
			orderGroup.POST("/:order_id/provider-reject", h.Order.ProviderReject)
			orderGroup.POST("/:order_id/pay", h.Payment.CreateOrderPayment)
			orderGroup.POST("/:order_id/cancel", h.Order.Cancel)
			orderGroup.POST("/:order_id/start-preparing", h.Order.StartPreparing)
			orderGroup.POST("/:order_id/start-flight", h.Order.StartFlight)
			orderGroup.POST("/:order_id/confirm-delivery", h.Order.ConfirmDelivery)
			orderGroup.POST("/:order_id/confirm-receipt", h.Order.ConfirmReceipt)
			orderGroup.POST("/:order_id/execution-status", h.Order.UpdateExecutionStatus)
			orderGroup.GET("/:order_id/monitor", h.Order.Monitor)
			orderGroup.GET("/:order_id/dev-flight-simulation", h.Order.GetDevelopmentFlightSimulation)
			orderGroup.POST("/:order_id/dev-flight-simulation/start", h.Order.StartDevelopmentFlightSimulation)
			orderGroup.POST("/:order_id/dev-flight-simulation/stop", h.Order.StopDevelopmentFlightSimulation)
			orderGroup.GET("/:order_id/timeline", h.Order.Timeline)
			orderGroup.POST("/:order_id/dispatch", h.Order.Dispatch)
			orderGroup.GET("/:order_id/payments", h.Payment.ListOrderPayments)
			orderGroup.GET("/:order_id/refunds", h.Payment.ListOrderRefunds)
			orderGroup.POST("/:order_id/refund", h.Payment.RefundOrder)
			orderGroup.GET("/:order_id/settlement", h.Settlement.GetOrderSettlement)
			orderGroup.GET("/:order_id/disputes", h.Order.ListDisputes)
			orderGroup.POST("/:order_id/disputes", h.Order.CreateDispute)
			orderGroup.POST("/:order_id/reviews", h.Review.CreateOrderReview)
			orderGroup.GET("/:order_id/reviews", h.Review.ListOrderReviews)
			orderGroup.GET("/:order_id/contract", h.Order.GetContract)
			orderGroup.POST("/:order_id/contract/sign", h.Order.SignContract)
			orderGroup.GET("/:order_id/contract/pdf-download", h.Order.GetContractPDFDownloadInfo)
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
			flightGroup.GET("/:flight_id", h.Flight.Get)
			flightGroup.POST("/:flight_id/positions", h.Flight.ReportPosition)
			flightGroup.POST("/:flight_id/alerts", h.Flight.ReportAlert)
			flightGroup.POST("/:flight_id/complete", h.Flight.Complete)
		}

		notificationGroup := authenticated.Group("/notifications")
		{
			notificationGroup.GET("", h.Notification.List)
			notificationGroup.POST("/:notification_id/read", h.Notification.MarkRead)
		}

		pushGroup := authenticated.Group("/push")
		{
			pushGroup.POST("/device", h.Push.RegisterDevice)
			pushGroup.POST("/test", h.Push.SendTest)
		}

		conversationGroup := authenticated.Group("/conversations")
		{
			conversationGroup.GET("", h.Message.ListConversations)
			conversationGroup.GET("/:conversation_id/messages", h.Message.ListMessages)
			conversationGroup.POST("/:conversation_id/read", h.Message.MarkRead)
			conversationGroup.DELETE("/:conversation_id", h.Message.DeleteConversation)
		}

		if lt != nil && lt.Order != nil {
			orderLegacyGroup := authenticated.Group("/order")
			{
				orderLegacyGroup.POST("", lt.Order.Create)
				orderLegacyGroup.GET("", lt.Order.List)
				orderLegacyGroup.GET("/:id", lt.Order.GetByID)
				orderLegacyGroup.PUT("/:id/accept", lt.Order.Accept)
				orderLegacyGroup.PUT("/:id/reject", lt.Order.Reject)
				orderLegacyGroup.POST("/:id/provider-confirm", lt.Order.ProviderConfirm)
				orderLegacyGroup.POST("/:id/provider-reject", lt.Order.ProviderReject)
				orderLegacyGroup.PUT("/:id/cancel", lt.Order.Cancel)
				orderLegacyGroup.PUT("/:id/start", lt.Order.Start)
				orderLegacyGroup.PUT("/:id/complete", lt.Order.Complete)
				orderLegacyGroup.GET("/:id/timeline", lt.Order.GetTimeline)
			}
		}

		if lt != nil && lt.Payment != nil {
			paymentLegacyGroup := authenticated.Group("/payment")
			{
				paymentLegacyGroup.POST("/create", lt.Payment.Create)
				paymentLegacyGroup.GET("/:id/status", lt.Payment.GetStatus)
				paymentLegacyGroup.POST("/:id/refund", lt.Payment.Refund)
				paymentLegacyGroup.GET("/history", lt.Payment.History)
			}
		}

		if lt != nil && lt.Message != nil {
			messageLegacyGroup := authenticated.Group("/message")
			{
				messageLegacyGroup.GET("/conversations", lt.Message.GetConversations)
				messageLegacyGroup.GET("/peer/:peerId", lt.Message.GetMessagesByPeer)
				messageLegacyGroup.PUT("/peer/:peerId/read", lt.Message.MarkReadByPeer)
				messageLegacyGroup.GET("/:conversationId", lt.Message.GetMessages)
				messageLegacyGroup.POST("", lt.Message.Send)
				messageLegacyGroup.PUT("/:conversationId/read", lt.Message.MarkRead)
				messageLegacyGroup.GET("/unread-count", lt.Message.UnreadCount)
			}
		}

		if lt != nil && lt.Review != nil {
			reviewLegacyGroup := authenticated.Group("/review")
			{
				reviewLegacyGroup.POST("", lt.Review.Create)
				reviewLegacyGroup.GET("/order/:orderId", lt.Review.GetByOrder)
				reviewLegacyGroup.GET("/user/:userId", lt.Review.GetByUser)
				reviewLegacyGroup.GET("/drone/:droneId", lt.Review.GetByDrone)
			}
		}

		if lt != nil && lt.Location != nil {
			locationGroup := authenticated.Group("/location")
			{
				locationGroup.GET("/search", lt.Location.SearchPOI)
				locationGroup.GET("/regeocode", lt.Location.ReverseGeoCode)
				locationGroup.GET("/nearby", lt.Location.Nearby)
			}
		}

		if lt != nil && lt.Address != nil {
			addressGroup := authenticated.Group("/address")
			{
				addressGroup.GET("", lt.Address.List)
				addressGroup.POST("", lt.Address.Create)
				addressGroup.PUT("/:id", lt.Address.Update)
				addressGroup.DELETE("/:id", lt.Address.Delete)
				addressGroup.PUT("/:id/default", lt.Address.SetDefault)
			}
		}

		if lt != nil && lt.Dispatch != nil {
			dispatchLegacyGroup := authenticated.Group("/dispatch")
			{
				dispatchLegacyGroup.POST("/task", lt.Dispatch.CreateTask)
				dispatchLegacyGroup.GET("/task/:id", lt.Dispatch.GetTask)
				dispatchLegacyGroup.GET("/task/no/:taskNo", lt.Dispatch.GetTaskByNo)
				dispatchLegacyGroup.GET("/tasks/client", lt.Dispatch.ListClientTasks)
				dispatchLegacyGroup.POST("/task/:id/cancel", lt.Dispatch.CancelTask)
				dispatchLegacyGroup.GET("/task/:id/candidates", lt.Dispatch.GetCandidates)
				dispatchLegacyGroup.GET("/task/:id/logs", lt.Dispatch.GetTaskLogs)
				dispatchLegacyGroup.GET("/tasks/pilot", lt.Dispatch.ListPilotTasks)
				dispatchLegacyGroup.GET("/task/pending", lt.Dispatch.GetPendingTask)
				dispatchLegacyGroup.POST("/candidate/:id/accept", lt.Dispatch.AcceptTask)
				dispatchLegacyGroup.POST("/candidate/:id/reject", lt.Dispatch.RejectTask)
				dispatchLegacyGroup.GET("/task/:id/order", lt.Dispatch.GetOrderByTaskID)
				dispatchLegacyGroup.GET("/order/active", lt.Dispatch.GetMyActiveOrder)
				dispatchLegacyGroup.POST("/order/:id/status", lt.Dispatch.UpdateExecutionStatus)
				dispatchLegacyGroup.POST("/task/:id/match", lt.Dispatch.ManualMatch)
				dispatchLegacyGroup.POST("/admin/process", lt.Dispatch.ProcessPendingTasks)
				dispatchLegacyGroup.POST("/admin/handle-expired", lt.Dispatch.HandleExpiredTasks)
			}
		}

		if lt != nil && lt.Flight != nil {
			flightLegacyGroup := authenticated.Group("/flight")
			{
				flightLegacyGroup.POST("/position", lt.Flight.ReportPosition)
				flightLegacyGroup.GET("/position/:order_id/latest", lt.Flight.GetLatestPosition)
				flightLegacyGroup.GET("/position/:order_id/history", lt.Flight.GetPositionHistory)
				flightLegacyGroup.GET("/alerts/:order_id", lt.Flight.GetAlerts)
				flightLegacyGroup.GET("/alerts/:order_id/active", lt.Flight.GetActiveAlerts)
				flightLegacyGroup.POST("/alert/:alert_id/acknowledge", lt.Flight.AcknowledgeAlert)
				flightLegacyGroup.POST("/alert/:alert_id/resolve", lt.Flight.ResolveAlert)
				flightLegacyGroup.POST("/simulate/:order_id", lt.Flight.SimulateFlight)
				flightLegacyGroup.GET("/geofences", lt.Flight.ListGeofences)
				flightLegacyGroup.GET("/geofence/:id", lt.Flight.GetGeofence)
				flightLegacyGroup.POST("/geofence", lt.Flight.CreateGeofence)
				flightLegacyGroup.DELETE("/geofence/:id", lt.Flight.DeleteGeofence)
				flightLegacyGroup.POST("/trajectory/start", lt.Flight.StartTrajectory)
				flightLegacyGroup.POST("/trajectory/stop", lt.Flight.StopTrajectory)
				flightLegacyGroup.GET("/trajectory/:order_id", lt.Flight.GetTrajectory)
				flightLegacyGroup.POST("/trajectory/:id/template", lt.Flight.MarkAsTemplate)
				flightLegacyGroup.POST("/route/from-trajectory", lt.Flight.CreateRouteFromTrajectory)
				flightLegacyGroup.GET("/routes/mine", lt.Flight.ListMyRoutes)
				flightLegacyGroup.GET("/routes/public", lt.Flight.ListPublicRoutes)
				flightLegacyGroup.GET("/routes/nearby", lt.Flight.FindNearbyRoutes)
				flightLegacyGroup.GET("/route/:id", lt.Flight.GetRouteDetail)
				flightLegacyGroup.POST("/route/:id/use", lt.Flight.UseRoute)
				flightLegacyGroup.POST("/route/:id/rate", lt.Flight.RateRoute)
				flightLegacyGroup.DELETE("/route/:id", lt.Flight.DeleteRoute)
				flightLegacyGroup.POST("/multipoint-task", lt.Flight.CreateMultiPointTask)
				flightLegacyGroup.GET("/multipoint-task/:id", lt.Flight.GetMultiPointTask)
				flightLegacyGroup.GET("/multipoint-task/order/:order_id", lt.Flight.GetMultiPointTaskByOrder)
				flightLegacyGroup.POST("/multipoint-task/:id/start", lt.Flight.StartMultiPointTask)
				flightLegacyGroup.POST("/multipoint-task/:id/next", lt.Flight.NextStop)
				flightLegacyGroup.POST("/multipoint-task/stop/:stop_id/arrive", lt.Flight.ArriveAtStop)
				flightLegacyGroup.POST("/multipoint-task/stop/:stop_id/complete", lt.Flight.CompleteStop)
				flightLegacyGroup.POST("/multipoint-task/stop/:stop_id/skip", lt.Flight.SkipStop)
				flightLegacyGroup.GET("/stats/:order_id", lt.Flight.GetFlightStats)
			}
		}

		if lt != nil && lt.Airspace != nil {
			airspaceGroup := authenticated.Group("/airspace")
			{
				airspaceGroup.POST("/application", lt.Airspace.CreateApplication)
				airspaceGroup.GET("/application/:id", lt.Airspace.GetApplication)
				airspaceGroup.GET("/application/order/:order_id", lt.Airspace.GetApplicationByOrder)
				airspaceGroup.GET("/applications", lt.Airspace.ListMyApplications)
				airspaceGroup.POST("/application/:id/submit", lt.Airspace.SubmitForReview)
				airspaceGroup.POST("/application/:id/cancel", lt.Airspace.CancelApplication)
				airspaceGroup.POST("/application/:id/uom", lt.Airspace.SubmitToUOM)
				airspaceGroup.POST("/compliance/check", lt.Airspace.RunComplianceCheck)
				airspaceGroup.GET("/compliance/check/:id", lt.Airspace.GetComplianceCheck)
				airspaceGroup.GET("/compliance/checks", lt.Airspace.ListComplianceChecks)
				airspaceGroup.GET("/compliance/latest", lt.Airspace.GetLatestComplianceCheck)
				airspaceGroup.POST("/admin/review/:id", lt.Airspace.ReviewApplication)
				airspaceGroup.GET("/admin/pending", lt.Airspace.ListPendingReview)
				airspaceGroup.POST("/admin/no-fly-zone", lt.Airspace.CreateNoFlyZone)
				airspaceGroup.DELETE("/admin/no-fly-zone/:id", lt.Airspace.DeleteNoFlyZone)
			}
		}

		if lt != nil && lt.Settlement != nil {
			settlementGroup := authenticated.Group("/settlement")
			{
				settlementGroup.POST("/calculate-price", lt.Settlement.CalculatePrice)
				settlementGroup.POST("/create", lt.Settlement.CreateSettlement)
				settlementGroup.GET("/:id", lt.Settlement.GetSettlement)
				settlementGroup.GET("/order/:order_id", lt.Settlement.GetSettlementByOrder)
				settlementGroup.POST("/:id/confirm", lt.Settlement.ConfirmSettlement)
				settlementGroup.GET("/my", lt.Settlement.ListMySettlements)
				settlementGroup.GET("/wallet", lt.Settlement.GetWallet)
				settlementGroup.GET("/wallet/transactions", lt.Settlement.GetWalletTransactions)
				settlementGroup.POST("/withdrawal", lt.Settlement.RequestWithdrawal)
				settlementGroup.GET("/withdrawals", lt.Settlement.ListMyWithdrawals)
				settlementGroup.POST("/admin/execute/:id", lt.Settlement.ExecuteSettlement)
				settlementGroup.GET("/admin/list", lt.Settlement.ListSettlements)
				settlementGroup.POST("/admin/process-pending", lt.Settlement.AdminProcessSettlements)
				settlementGroup.GET("/admin/withdrawals/pending", lt.Settlement.AdminListPendingWithdrawals)
				settlementGroup.POST("/admin/withdrawal/:id/approve", lt.Settlement.AdminApproveWithdrawal)
				settlementGroup.POST("/admin/withdrawal/:id/reject", lt.Settlement.AdminRejectWithdrawal)
				settlementGroup.GET("/admin/pricing-configs", lt.Settlement.GetPricingConfigs)
				settlementGroup.PUT("/admin/pricing-config", lt.Settlement.UpdatePricingConfig)
			}
		}

		if lt != nil && lt.Credit != nil {
			creditGroup := authenticated.Group("/credit")
			{
				creditGroup.GET("/my-score", lt.Credit.GetMyCreditScore)
				creditGroup.GET("/my-logs", lt.Credit.GetMyCreditLogs)
				creditGroup.GET("/user/:user_id", lt.Credit.GetUserCreditScore)
				creditGroup.GET("/scores", lt.Credit.ListCreditScores)
				creditGroup.GET("/my-violations", lt.Credit.GetMyViolations)
				creditGroup.GET("/violations", lt.Credit.ListViolations)
				creditGroup.GET("/violations/:id", lt.Credit.GetViolationDetail)
				creditGroup.POST("/violations", lt.Credit.CreateViolation)
				creditGroup.POST("/violations/:id/confirm", lt.Credit.ConfirmViolation)
				creditGroup.POST("/violations/:id/appeal", lt.Credit.SubmitAppeal)
				creditGroup.POST("/violations/:id/review-appeal", lt.Credit.ReviewAppeal)
				creditGroup.GET("/risk-check", lt.Credit.PreOrderRiskCheck)
				creditGroup.GET("/risks", lt.Credit.ListRiskControls)
				creditGroup.GET("/risks/:id", lt.Credit.GetRiskControlDetail)
				creditGroup.POST("/risks/:id/review", lt.Credit.ReviewRiskControl)
				creditGroup.GET("/blacklists", lt.Credit.ListBlacklists)
				creditGroup.GET("/my-deposit", lt.Credit.GetMyDeposit)
				creditGroup.GET("/deposits", lt.Credit.ListDeposits)
				creditGroup.POST("/deposits", lt.Credit.RequireDeposit)
				creditGroup.GET("/statistics", lt.Credit.GetCreditStatistics)
			}
		}

		if lt != nil && lt.Insurance != nil {
			insuranceGroup := authenticated.Group("/insurance")
			{
				insuranceGroup.GET("/products", lt.Insurance.ListProducts)
				insuranceGroup.GET("/products/mandatory", lt.Insurance.GetMandatoryProducts)
				insuranceGroup.POST("/purchase", lt.Insurance.PurchaseInsurance)
				insuranceGroup.GET("/my-policies", lt.Insurance.GetMyPolicies)
				insuranceGroup.GET("/policies/:id", lt.Insurance.GetPolicyDetail)
				insuranceGroup.POST("/policies/:id/activate", lt.Insurance.ActivatePolicy)
				insuranceGroup.GET("/check-mandatory", lt.Insurance.CheckMandatoryInsurance)
				insuranceGroup.POST("/claims/report", lt.Insurance.ReportClaim)
				insuranceGroup.GET("/my-claims", lt.Insurance.GetMyClaims)
				insuranceGroup.GET("/claims/:id", lt.Insurance.GetClaimDetail)
				insuranceGroup.GET("/claims/:id/timelines", lt.Insurance.GetClaimTimelines)
				insuranceGroup.POST("/claims/:id/evidence", lt.Insurance.UploadEvidence)
				insuranceGroup.POST("/claims/:id/dispute", lt.Insurance.DisputeClaim)
				insuranceGroup.GET("/admin/claims/pending", lt.Insurance.AdminListPendingClaims)
				insuranceGroup.POST("/admin/claims/:id/investigate", lt.Insurance.AdminStartInvestigation)
				insuranceGroup.POST("/admin/claims/:id/liability", lt.Insurance.AdminDetermineLiability)
				insuranceGroup.POST("/admin/claims/:id/approve", lt.Insurance.AdminApproveClaim)
				insuranceGroup.POST("/admin/claims/:id/reject", lt.Insurance.AdminRejectClaim)
				insuranceGroup.POST("/admin/claims/:id/pay", lt.Insurance.AdminPayClaim)
				insuranceGroup.POST("/admin/claims/:id/close", lt.Insurance.AdminCloseClaim)
				insuranceGroup.GET("/admin/statistics", lt.Insurance.GetInsuranceStatistics)
			}
		}

		if lt != nil && lt.Analytics != nil {
			analyticsGroup := authenticated.Group("/analytics")
			{
				analyticsGroup.GET("/dashboard/realtime", lt.Analytics.GetRealtimeDashboard)
				analyticsGroup.POST("/dashboard/refresh", lt.Analytics.RefreshDashboard)
				analyticsGroup.GET("/overview", lt.Analytics.GetOverview)
				analyticsGroup.GET("/trends", lt.Analytics.GetTrendData)
				analyticsGroup.GET("/daily", lt.Analytics.GetDailyStatistics)
				analyticsGroup.GET("/daily/range", lt.Analytics.GetDailyStatisticsRange)
				analyticsGroup.GET("/hourly", lt.Analytics.GetHourlyMetrics)
				analyticsGroup.GET("/heatmap", lt.Analytics.GetHeatmapData)
				analyticsGroup.GET("/regions", lt.Analytics.GetRegionStatistics)
				analyticsGroup.GET("/regions/top", lt.Analytics.GetTopRegions)
				analyticsGroup.GET("/reports", lt.Analytics.GetReportList)
				analyticsGroup.GET("/report/:id", lt.Analytics.GetReport)
				analyticsGroup.GET("/report/no/:reportNo", lt.Analytics.GetReportByNo)
				analyticsGroup.GET("/report/latest/:type", lt.Analytics.GetLatestReport)
				analyticsGroup.POST("/report/generate", lt.Analytics.GenerateReport)
				analyticsGroup.DELETE("/report/:id", lt.Analytics.DeleteReport)
				analyticsGroup.POST("/admin/daily/generate", lt.Analytics.GenerateDailyStatistics)
				analyticsGroup.POST("/admin/job/daily", lt.Analytics.TriggerDailyJob)
				analyticsGroup.POST("/admin/job/hourly", lt.Analytics.TriggerHourlyJob)
				analyticsGroup.POST("/admin/job/report", lt.Analytics.TriggerAutoReportJob)
			}
		}

		if lt != nil && lt.Admin != nil {
			adminGroup := authenticated.Group("/admin")
			adminGroup.Use(middleware.AdminMiddleware())
			{
				adminGroup.GET("/dashboard", lt.Admin.Dashboard)
				adminGroup.GET("/users", lt.Admin.UserList)
				adminGroup.PUT("/users/:id/status", lt.Admin.UpdateUserStatus)
				adminGroup.PUT("/users/:id/verify", lt.Admin.ApproveIDVerification)
				adminGroup.GET("/drones", lt.Admin.DroneList)
				adminGroup.GET("/drones/:id", lt.Admin.GetDroneDetail)
				adminGroup.PUT("/drones/:id/certification", lt.Admin.ApproveDroneCertification)
				adminGroup.PUT("/drones/:id/uom", lt.Admin.ApproveUOMRegistration)
				adminGroup.PUT("/drones/:id/insurance", lt.Admin.ApproveInsurance)
				adminGroup.PUT("/drones/:id/airworthiness", lt.Admin.ApproveAirworthiness)
				adminGroup.GET("/pilots", lt.Admin.PilotList)
				adminGroup.PUT("/pilots/:id/verify", lt.Admin.VerifyPilot)
				adminGroup.PUT("/pilots/:id/criminal-check", lt.Admin.ApprovePilotCriminalCheck)
				adminGroup.PUT("/pilots/:id/health-check", lt.Admin.ApprovePilotHealthCheck)
				adminGroup.GET("/clients", lt.Admin.ClientList)
				adminGroup.PUT("/clients/:id/verify", lt.Admin.VerifyClient)
				adminGroup.GET("/demands", lt.Admin.DemandList)
				adminGroup.GET("/supplies", lt.Admin.SupplyList)
				adminGroup.GET("/orders", lt.Admin.OrderList)
				adminGroup.GET("/orders/anomalies", lt.Admin.OrderAnomalyList)
				adminGroup.GET("/orders/anomalies/summary", lt.Admin.OrderAnomalySummary)
				adminGroup.GET("/dispatch-tasks", lt.Admin.DispatchTaskList)
				adminGroup.GET("/flight-records", lt.Admin.FlightRecordList)
				adminGroup.GET("/migration-audits", lt.Admin.MigrationAuditList)
				adminGroup.GET("/migration-audits/summary", lt.Admin.MigrationAuditSummary)
				adminGroup.GET("/payments", lt.Admin.PaymentList)
				adminGroup.POST("/demands/handle-expired", lt.Admin.HandleExpiredDemands)
				adminGroup.POST("/pilot-bindings/handle-expired", lt.Admin.HandleExpiredPilotBindings)
				lt.Admin.RegisterExtendedRoutes(adminGroup)
			}
		}
	}
}
