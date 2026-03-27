package v1

import (
	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	"wurenji-backend/internal/api/v1/address"
	"wurenji-backend/internal/api/v1/admin"
	"wurenji-backend/internal/api/v1/airspace"
	"wurenji-backend/internal/api/v1/analytics"
	"wurenji-backend/internal/api/v1/auth"
	"wurenji-backend/internal/api/v1/client"
	"wurenji-backend/internal/api/v1/credit"
	"wurenji-backend/internal/api/v1/demand"
	"wurenji-backend/internal/api/v1/dispatch"
	"wurenji-backend/internal/api/v1/drone"
	"wurenji-backend/internal/api/v1/flight"
	"wurenji-backend/internal/api/v1/insurance"
	"wurenji-backend/internal/api/v1/location"
	"wurenji-backend/internal/api/v1/message"
	"wurenji-backend/internal/api/v1/order"
	"wurenji-backend/internal/api/v1/owner"
	"wurenji-backend/internal/api/v1/payment"
	"wurenji-backend/internal/api/v1/pilot"
	"wurenji-backend/internal/api/v1/review"
	"wurenji-backend/internal/api/v1/settlement"
	"wurenji-backend/internal/api/v1/user"
	"wurenji-backend/internal/config"
	ws "wurenji-backend/internal/websocket"

	"go.uber.org/zap"
)

type Handlers struct {
	Auth       *auth.Handler
	User       *user.Handler
	Drone      *drone.Handler
	Order      *order.Handler
	Demand     *demand.Handler
	Payment    *payment.Handler
	Message    *message.Handler
	Owner      *owner.Handler
	Review     *review.Handler
	Admin      *admin.Handler
	Location   *location.Handler
	Address    *address.Handler
	Pilot      *pilot.Handler
	Client     *client.Handler
	Dispatch   *dispatch.Handler
	Flight     *flight.Handler
	Airspace   *airspace.Handler
	Settlement *settlement.Handler
	Credit     *credit.Handler
	Insurance  *insurance.Handler
	Analytics  *analytics.Handler
}

func RegisterRoutes(r *gin.Engine, h *Handlers, hub *ws.Hub, cfg *config.Config, logger *zap.Logger) {
	// Static files
	r.Static("/uploads", "./uploads")

	// Apple App Site Association（Universal Link 必须）
	r.GET("/.well-known/apple-app-site-association", func(c *gin.Context) {
		c.Header("Content-Type", "application/json")
		c.JSON(200, gin.H{
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
	// Universal Link 落地路径（微信回调会打开此 URL）
	r.GET("/app/*path", func(c *gin.Context) {
		c.String(200, "ok")
	})

	// WebSocket
	r.GET("/ws", ws.HandleWebSocket(hub, cfg, logger))

	api := r.Group("/api/v1")

	// Public routes
	authGroup := api.Group("/auth")
	{
		authGroup.POST("/send-code", h.Auth.SendCode)
		authGroup.POST("/register", h.Auth.Register)
		authGroup.POST("/login", h.Auth.Login)
		authGroup.POST("/refresh-token", h.Auth.RefreshToken)
		authGroup.POST("/wechat-login", h.Auth.WeChatLogin)
		authGroup.POST("/qq-login", h.Auth.QQLogin)
	}

	// Payment callbacks (no auth required)
	api.POST("/payment/wechat/notify", h.Payment.WechatNotify)
	api.POST("/payment/alipay/notify", h.Payment.AlipayNotify)
	api.POST("/payment/mock/callback", h.Payment.MockCallback)

	// Authenticated routes
	authenticated := api.Group("")
	authenticated.Use(middleware.AuthMiddleware())
	{
		authenticated.POST("/auth/logout", h.Auth.Logout)
		authenticated.GET("/me", h.User.GetMe)

		// User
		userGroup := authenticated.Group("/user")
		{
			userGroup.GET("/profile", h.User.GetProfile)
			userGroup.PUT("/profile", h.User.UpdateProfile)
			userGroup.POST("/avatar", h.User.UploadAvatar)
			userGroup.POST("/id-verify", h.User.SubmitIDVerify)
			userGroup.GET("/id-verify/status", h.User.GetIDVerifyStatus)
			userGroup.GET("/:id", h.User.GetPublicProfile)
		}

		// Drone
		droneGroup := authenticated.Group("/drone")
		{
			droneGroup.GET("", h.Drone.List)
			droneGroup.POST("", h.Drone.Create)
			droneGroup.GET("/my", h.Drone.MyDrones)
			droneGroup.GET("/nearby", h.Drone.Nearby)
			droneGroup.POST("/upload", h.Drone.UploadImages) // 通用图片上传，无需 drone ID
			droneGroup.GET("/:id", h.Drone.GetByID)
			droneGroup.PUT("/:id", h.Drone.Update)
			droneGroup.DELETE("/:id", h.Drone.Delete)
			droneGroup.POST("/:id/images", h.Drone.UploadImages)
			droneGroup.POST("/:id/certification", h.Drone.SubmitCertification)
			droneGroup.PUT("/:id/availability", h.Drone.UpdateAvailability)
			// 机主认证增强接口
			droneGroup.POST("/:id/uom", h.Drone.SubmitUOMRegistration)         // UOM平台登记
			droneGroup.POST("/:id/insurance", h.Drone.SubmitInsurance)         // 保险信息
			droneGroup.POST("/:id/airworthiness", h.Drone.SubmitAirworthiness) // 适航证书
			droneGroup.POST("/:id/maintenance", h.Drone.AddMaintenanceLog)     // 添加维护记录
			droneGroup.GET("/:id/maintenance", h.Drone.GetMaintenanceLogs)     // 获取维护记录
			droneGroup.GET("/:id/cert-status", h.Drone.GetCertificationStatus) // 获取认证状态
		}

		// Rental Offers
		offerGroup := authenticated.Group("/rental/offer")
		offerGroup.Use(middleware.FreezeLegacyWriteMiddleware())
		{
			offerGroup.GET("", h.Demand.ListOffers)
			offerGroup.POST("", h.Demand.CreateOffer)
			offerGroup.GET("/my", h.Demand.MyOffers)
			offerGroup.GET("/:id", h.Demand.GetOffer)
			offerGroup.PUT("/:id", h.Demand.UpdateOffer)
			offerGroup.DELETE("/:id", h.Demand.DeleteOffer)
		}

		// Rental Demands
		demandGroup := authenticated.Group("/rental/demand")
		demandGroup.Use(middleware.FreezeLegacyWriteMiddleware())
		{
			demandGroup.GET("", h.Demand.ListDemands)
			demandGroup.POST("", h.Demand.CreateDemand)
			demandGroup.GET("/my", h.Demand.MyDemands)
			demandGroup.GET("/:id", h.Demand.GetDemand)
			demandGroup.PUT("/:id", h.Demand.UpdateDemand)
			demandGroup.DELETE("/:id", h.Demand.DeleteDemand)
			demandGroup.GET("/:id/matches", h.Demand.GetDemandMatches)
		}

		// Cargo Demands
		cargoGroup := authenticated.Group("/cargo")
		cargoGroup.Use(middleware.FreezeLegacyWriteMiddleware())
		{
			cargoGroup.GET("", h.Demand.ListCargos)
			cargoGroup.POST("", h.Demand.CreateCargo)
			cargoGroup.GET("/my", h.Demand.MyCargos)
			cargoGroup.GET("/:id", h.Demand.GetCargo)
			cargoGroup.PUT("/:id", h.Demand.UpdateCargo)
			cargoGroup.DELETE("/:id", h.Demand.DeleteCargo)
			cargoGroup.GET("/:id/matches", h.Demand.GetCargoMatches)
		}

		// Orders
		orderGroup := authenticated.Group("/order")
		orderGroup.Use(middleware.FreezeLegacyWriteMiddleware())
		{
			orderGroup.POST("", h.Order.Create)
			orderGroup.GET("", h.Order.List)
			orderGroup.GET("/:id", h.Order.GetByID)
			orderGroup.PUT("/:id/accept", h.Order.Accept)
			orderGroup.PUT("/:id/reject", h.Order.Reject)
			orderGroup.POST("/:id/provider-confirm", h.Order.ProviderConfirm)
			orderGroup.POST("/:id/provider-reject", h.Order.ProviderReject)
			orderGroup.PUT("/:id/cancel", h.Order.Cancel)
			orderGroup.PUT("/:id/start", h.Order.Start)
			orderGroup.PUT("/:id/complete", h.Order.Complete)
			orderGroup.GET("/:id/timeline", h.Order.GetTimeline)
		}

		// Payment
		paymentGroup := authenticated.Group("/payment")
		paymentGroup.Use(middleware.FreezeLegacyWriteMiddleware())
		{
			paymentGroup.POST("/create", h.Payment.Create)
			paymentGroup.GET("/:id/status", h.Payment.GetStatus)
			paymentGroup.POST("/:id/refund", h.Payment.Refund)
			paymentGroup.GET("/history", h.Payment.History)
		}

		// Message
		messageGroup := authenticated.Group("/message")
		{
			messageGroup.GET("/conversations", h.Message.GetConversations)
			messageGroup.GET("/peer/:peerId", h.Message.GetMessagesByPeer)
			messageGroup.PUT("/peer/:peerId/read", h.Message.MarkReadByPeer)
			messageGroup.GET("/:conversationId", h.Message.GetMessages)
			messageGroup.POST("", h.Message.Send)
			messageGroup.PUT("/:conversationId/read", h.Message.MarkRead)
			messageGroup.GET("/unread-count", h.Message.UnreadCount)
		}

		// Review
		reviewGroup := authenticated.Group("/review")
		{
			reviewGroup.POST("", h.Review.Create)
			reviewGroup.GET("/order/:orderId", h.Review.GetByOrder)
			reviewGroup.GET("/user/:userId", h.Review.GetByUser)
			reviewGroup.GET("/drone/:droneId", h.Review.GetByDrone)
		}

		// Location Service (AMap proxy)
		locationGroup := authenticated.Group("/location")
		{
			locationGroup.GET("/search", h.Location.SearchPOI)
			locationGroup.GET("/regeocode", h.Location.ReverseGeoCode)
			locationGroup.GET("/nearby", h.Location.Nearby)
		}

		// User Addresses
		addressGroup := authenticated.Group("/address")
		{
			addressGroup.GET("", h.Address.List)
			addressGroup.POST("", h.Address.Create)
			addressGroup.PUT("/:id", h.Address.Update)
			addressGroup.DELETE("/:id", h.Address.Delete)
			addressGroup.PUT("/:id/default", h.Address.SetDefault)
		}

		// Pilot 飞手相关接口
		pilotGroup := authenticated.Group("/pilot")
		pilotGroup.Use(middleware.FreezeLegacyWriteMiddleware())
		{
			pilotGroup.POST("/register", h.Pilot.Register)              // 注册成为飞手
			pilotGroup.GET("/profile", h.Pilot.GetProfile)              // 获取飞手档案
			pilotGroup.PUT("/profile", h.Pilot.UpdateProfile)           // 更新飞手档案
			pilotGroup.PUT("/location", h.Pilot.UpdateLocation)         // 更新实时位置
			pilotGroup.PUT("/availability", h.Pilot.UpdateAvailability) // 更新接单状态
			pilotGroup.GET("/owner-bindings", h.Pilot.ListOwnerBindings)
			pilotGroup.POST("/owner-bindings", h.Pilot.ApplyOwnerBinding)
			pilotGroup.POST("/owner-bindings/:binding_id/confirm", h.Pilot.ConfirmOwnerBinding)
			pilotGroup.POST("/owner-bindings/:binding_id/reject", h.Pilot.RejectOwnerBinding)
			pilotGroup.PATCH("/owner-bindings/:binding_id/status", h.Pilot.UpdateOwnerBindingStatus)
			pilotGroup.GET("/candidate-demands", h.Pilot.ListCandidateDemands)
			pilotGroup.GET("/dispatch-tasks", h.Pilot.ListDispatchTasks)
			pilotGroup.GET("/flight-records", h.Pilot.GetFlightRecords)
			pilotGroup.GET("/list", h.Pilot.List)     // 获取飞手列表
			pilotGroup.GET("/nearby", h.Pilot.Nearby) // 查找附近飞手
			pilotGroup.GET("/:id", h.Pilot.GetByID)   // 获取指定飞手信息

			// 资质证书
			pilotGroup.POST("/certification", h.Pilot.SubmitCertification)  // 提交资质证书
			pilotGroup.GET("/certifications", h.Pilot.GetCertifications)    // 获取证书列表
			pilotGroup.POST("/criminal-check", h.Pilot.SubmitCriminalCheck) // 提交无犯罪记录
			pilotGroup.POST("/health-check", h.Pilot.SubmitHealthCheck)     // 提交健康证明
			pilotGroup.POST("/upload-cert", h.Pilot.UploadCertImage)        // 上传证书图片

			// 飞行记录
			pilotGroup.GET("/flight-logs", h.Pilot.GetFlightLogs)   // 获取飞行记录
			pilotGroup.POST("/flight-log", h.Pilot.AddFlightLog)    // 添加飞行记录
			pilotGroup.GET("/flight-stats", h.Pilot.GetFlightStats) // 获取飞行统计

			// 无人机绑定
			pilotGroup.GET("/bound-drones", h.Pilot.GetBoundDrones)      // 获取绑定的无人机
			pilotGroup.POST("/bind-drone", h.Pilot.BindDrone)            // 绑定无人机
			pilotGroup.DELETE("/unbind/:bindingId", h.Pilot.UnbindDrone) // 解绑无人机
		}

		// Client 业主/客户相关接口
		clientGroup := authenticated.Group("/client")
		{
			// 注册
			clientGroup.POST("/register/individual", h.Client.RegisterIndividual) // 注册个人客户
			clientGroup.POST("/register/enterprise", h.Client.RegisterEnterprise) // 注册企业客户

			// 档案管理
			clientGroup.GET("/profile", h.Client.GetProfile)    // 获取客户档案
			clientGroup.PUT("/profile", h.Client.UpdateProfile) // 更新客户档案
			clientGroup.POST("/demands", h.Client.CreateDemand)
			clientGroup.GET("/demands", h.Client.MyDemands)
			clientGroup.GET("/demands/:id", h.Client.GetDemand)
			clientGroup.PATCH("/demands/:id", h.Client.UpdateDemand)
			clientGroup.POST("/demands/:id/publish", h.Client.PublishDemand)
			clientGroup.POST("/demands/:id/cancel", h.Client.CancelDemand)
			clientGroup.GET("/demands/:id/quotes", h.Client.ListDemandQuotes)
			clientGroup.POST("/demands/:id/select-provider", h.Client.SelectProvider)
			clientGroup.GET("/list", h.Client.List)   // 获取客户列表
			clientGroup.GET("/:id", h.Client.GetByID) // 获取指定客户

			// 征信查询
			clientGroup.POST("/credit/check", h.Client.RequestCreditCheck) // 发起征信查询
			clientGroup.GET("/credit/history", h.Client.GetCreditHistory)  // 获取征信历史

			// 企业资质
			clientGroup.POST("/enterprise/cert", h.Client.SubmitEnterpriseCert) // 提交企业资质
			clientGroup.GET("/enterprise/certs", h.Client.GetEnterpriseCerts)   // 获取企业资质列表

			// 货物申报
			clientGroup.POST("/cargo/declaration", h.Client.CreateCargoDeclaration)    // 创建货物申报
			clientGroup.GET("/cargo/declaration/:id", h.Client.GetCargoDeclaration)    // 获取货物申报详情
			clientGroup.GET("/cargo/declarations", h.Client.ListCargoDeclarations)     // 获取货物申报列表
			clientGroup.PUT("/cargo/declaration/:id", h.Client.UpdateCargoDeclaration) // 更新货物申报

			// 下单资格
			clientGroup.GET("/order/eligibility", h.Client.CheckOrderEligibility) // 检查下单资格

			// 管理员接口
			clientGroup.POST("/admin/approve/:id", h.Client.AdminApproveClient)                 // 审批通过客户
			clientGroup.POST("/admin/reject/:id", h.Client.AdminRejectClient)                   // 拒绝客户
			clientGroup.POST("/admin/cert/approve/:id", h.Client.AdminApproveEnterpriseCert)    // 审批企业资质
			clientGroup.POST("/admin/cert/reject/:id", h.Client.AdminRejectEnterpriseCert)      // 拒绝企业资质
			clientGroup.POST("/admin/cargo/approve/:id", h.Client.AdminApproveCargoDeclaration) // 审批货物申报
			clientGroup.POST("/admin/cargo/reject/:id", h.Client.AdminRejectCargoDeclaration)   // 拒绝货物申报
			clientGroup.GET("/admin/pending", h.Client.AdminListPendingVerification)            // 待审批客户列表
			clientGroup.GET("/admin/cargo/pending", h.Client.AdminListPendingCargoDeclarations) // 待审批货物申报
		}

		ownerGroup := authenticated.Group("/owner")
		ownerGroup.Use(middleware.FreezeLegacyWriteMiddleware())
		{
			ownerGroup.GET("/profile", h.Owner.GetProfile)
			ownerGroup.PUT("/profile", h.Owner.UpdateProfile)
			ownerGroup.GET("/drones", h.Owner.ListDrones)
			ownerGroup.POST("/drones", h.Owner.CreateDrone)
			ownerGroup.GET("/drones/:drone_id", h.Owner.GetDrone)
			ownerGroup.GET("/supplies", h.Owner.ListSupplies)
			ownerGroup.POST("/supplies", h.Owner.CreateSupply)
			ownerGroup.GET("/supplies/:supply_id", h.Owner.GetSupply)
			ownerGroup.PATCH("/supplies/:supply_id/status", h.Owner.UpdateSupplyStatus)
			ownerGroup.GET("/demands/recommended", h.Owner.RecommendedDemands)
			ownerGroup.GET("/quotes", h.Owner.ListQuotes)
			ownerGroup.GET("/pilot-bindings", h.Owner.ListPilotBindings)
			ownerGroup.POST("/pilot-bindings", h.Owner.InvitePilotBinding)
			ownerGroup.POST("/pilot-bindings/:binding_id/confirm", h.Owner.ConfirmPilotBinding)
			ownerGroup.POST("/pilot-bindings/:binding_id/reject", h.Owner.RejectPilotBinding)
			ownerGroup.PATCH("/pilot-bindings/:binding_id/status", h.Owner.UpdatePilotBindingStatus)
		}

		authenticated.POST("/demands/:demand_id/quotes", h.Owner.CreateQuote)
		authenticated.POST("/supplies/:supply_id/orders", h.Client.CreateDirectOrder)
		authenticated.POST("/demands/:demand_id/candidate", h.Pilot.ApplyDemandCandidate)
		authenticated.DELETE("/demands/:demand_id/candidate", h.Pilot.WithdrawDemandCandidate)
		authenticated.POST("/dispatch-tasks/:dispatch_id/accept", h.Pilot.AcceptDispatchTask)
		authenticated.POST("/dispatch-tasks/:dispatch_id/reject", h.Pilot.RejectDispatchTask)

		// Dispatch 智能派单相关接口
		dispatchGroup := authenticated.Group("/dispatch")
		dispatchGroup.Use(middleware.FreezeLegacyWriteMiddleware("/api/v1/dispatch/admin/"))
		{
			// 业主端
			dispatchGroup.POST("/task", h.Dispatch.CreateTask)                  // 创建派单任务
			dispatchGroup.GET("/task/:id", h.Dispatch.GetTask)                  // 获取任务详情
			dispatchGroup.GET("/task/no/:taskNo", h.Dispatch.GetTaskByNo)       // 根据编号获取任务
			dispatchGroup.GET("/tasks/client", h.Dispatch.ListClientTasks)      // 获取业主的任务列表
			dispatchGroup.POST("/task/:id/cancel", h.Dispatch.CancelTask)       // 取消任务
			dispatchGroup.GET("/task/:id/candidates", h.Dispatch.GetCandidates) // 获取任务候选人
			dispatchGroup.GET("/task/:id/logs", h.Dispatch.GetTaskLogs)         // 获取任务日志

			// 飞手端
			dispatchGroup.GET("/tasks/pilot", h.Dispatch.ListPilotTasks)              // 获取飞手的任务列表
			dispatchGroup.GET("/task/pending", h.Dispatch.GetPendingTask)             // 获取待处理任务
			dispatchGroup.POST("/candidate/:id/accept", h.Dispatch.AcceptTask)        // 接受任务
			dispatchGroup.POST("/candidate/:id/reject", h.Dispatch.RejectTask)        // 拒绝任务
			dispatchGroup.GET("/task/:id/order", h.Dispatch.GetOrderByTaskID)         // 根据任务ID获取订单
			dispatchGroup.GET("/order/active", h.Dispatch.GetMyActiveOrder)           // 飞手当前执行订单
			dispatchGroup.POST("/order/:id/status", h.Dispatch.UpdateExecutionStatus) // 更新执行状态

			// 管理员/系统
			dispatchGroup.POST("/task/:id/match", h.Dispatch.ManualMatch)              // 手动触发匹配
			dispatchGroup.POST("/admin/process", h.Dispatch.ProcessPendingTasks)       // 处理待派单任务
			dispatchGroup.POST("/admin/handle-expired", h.Dispatch.HandleExpiredTasks) // 处理过期任务
		}

		// Flight 飞行监控相关接口
		flightGroup := authenticated.Group("/flight")
		flightGroup.Use(middleware.FreezeLegacyWriteMiddleware())
		{
			// 位置上报与查询
			flightGroup.POST("/position", h.Flight.ReportPosition)                      // 上报飞行位置
			flightGroup.GET("/position/:order_id/latest", h.Flight.GetLatestPosition)   // 获取最新位置
			flightGroup.GET("/position/:order_id/history", h.Flight.GetPositionHistory) // 获取位置历史

			// 告警管理
			flightGroup.GET("/alerts/:order_id", h.Flight.GetAlerts)                    // 获取订单告警列表
			flightGroup.GET("/alerts/:order_id/active", h.Flight.GetActiveAlerts)       // 获取活跃告警
			flightGroup.POST("/alert/:alert_id/acknowledge", h.Flight.AcknowledgeAlert) // 确认告警
			flightGroup.POST("/alert/:alert_id/resolve", h.Flight.ResolveAlert)         // 解决告警

			// 开发模拟（仅开发测试用）
			flightGroup.POST("/simulate/:order_id", h.Flight.SimulateFlight)

			// 电子围栏
			flightGroup.GET("/geofences", h.Flight.ListGeofences)        // 围栏列表
			flightGroup.GET("/geofence/:id", h.Flight.GetGeofence)       // 获取围栏详情
			flightGroup.POST("/geofence", h.Flight.CreateGeofence)       // 创建围栏
			flightGroup.DELETE("/geofence/:id", h.Flight.DeleteGeofence) // 删除围栏

			// 轨迹录制
			flightGroup.POST("/trajectory/start", h.Flight.StartTrajectory)       // 开始轨迹录制
			flightGroup.POST("/trajectory/stop", h.Flight.StopTrajectory)         // 停止轨迹录制
			flightGroup.GET("/trajectory/:order_id", h.Flight.GetTrajectory)      // 获取轨迹详情
			flightGroup.POST("/trajectory/:id/template", h.Flight.MarkAsTemplate) // 标记为模板

			// 路线管理
			flightGroup.POST("/route/from-trajectory", h.Flight.CreateRouteFromTrajectory) // 从轨迹创建路线
			flightGroup.GET("/routes/mine", h.Flight.ListMyRoutes)                         // 获取我的路线
			flightGroup.GET("/routes/public", h.Flight.ListPublicRoutes)                   // 获取公开路线
			flightGroup.GET("/routes/nearby", h.Flight.FindNearbyRoutes)                   // 查找附近路线
			flightGroup.GET("/route/:id", h.Flight.GetRouteDetail)                         // 获取路线详情
			flightGroup.POST("/route/:id/use", h.Flight.UseRoute)                          // 使用路线
			flightGroup.POST("/route/:id/rate", h.Flight.RateRoute)                        // 评价路线
			flightGroup.DELETE("/route/:id", h.Flight.DeleteRoute)                         // 删除路线

			// 多点任务
			flightGroup.POST("/multipoint-task", h.Flight.CreateMultiPointTask)                    // 创建多点任务
			flightGroup.GET("/multipoint-task/:id", h.Flight.GetMultiPointTask)                    // 获取多点任务详情
			flightGroup.GET("/multipoint-task/order/:order_id", h.Flight.GetMultiPointTaskByOrder) // 根据订单获取
			flightGroup.POST("/multipoint-task/:id/start", h.Flight.StartMultiPointTask)           // 开始多点任务
			flightGroup.POST("/multipoint-task/:id/next", h.Flight.NextStop)                       // 前进到下一站点
			flightGroup.POST("/multipoint-task/stop/:stop_id/arrive", h.Flight.ArriveAtStop)       // 到达站点
			flightGroup.POST("/multipoint-task/stop/:stop_id/complete", h.Flight.CompleteStop)     // 完成站点
			flightGroup.POST("/multipoint-task/stop/:stop_id/skip", h.Flight.SkipStop)             // 跳过站点

			// 飞行统计
			flightGroup.GET("/stats/:order_id", h.Flight.GetFlightStats) // 获取飞行统计
		}

		// Airspace 空域管理与合规相关接口
		airspaceGroup := authenticated.Group("/airspace")
		{
			// 空域申请
			airspaceGroup.POST("/application", h.Airspace.CreateApplication)                    // 创建空域申请
			airspaceGroup.GET("/application/:id", h.Airspace.GetApplication)                    // 获取空域申请详情
			airspaceGroup.GET("/application/order/:order_id", h.Airspace.GetApplicationByOrder) // 根据订单获取
			airspaceGroup.GET("/applications", h.Airspace.ListMyApplications)                   // 获取飞手申请列表
			airspaceGroup.POST("/application/:id/submit", h.Airspace.SubmitForReview)           // 提交审核
			airspaceGroup.POST("/application/:id/cancel", h.Airspace.CancelApplication)         // 取消申请
			airspaceGroup.POST("/application/:id/uom", h.Airspace.SubmitToUOM)                  // 提交UOM平台

			// 禁飞区
			airspaceGroup.GET("/no-fly-zones", h.Airspace.ListNoFlyZones)                  // 禁飞区列表
			airspaceGroup.GET("/no-fly-zone/:id", h.Airspace.GetNoFlyZone)                 // 禁飞区详情
			airspaceGroup.GET("/no-fly-zones/nearby", h.Airspace.FindNearbyNoFlyZones)     // 附近禁飞区
			airspaceGroup.GET("/check-availability", h.Airspace.CheckAirspaceAvailability) // 空域可用性检查

			// 合规检查
			airspaceGroup.POST("/compliance/check", h.Airspace.RunComplianceCheck)       // 执行合规检查
			airspaceGroup.GET("/compliance/check/:id", h.Airspace.GetComplianceCheck)    // 获取检查详情
			airspaceGroup.GET("/compliance/checks", h.Airspace.ListComplianceChecks)     // 获取检查列表
			airspaceGroup.GET("/compliance/latest", h.Airspace.GetLatestComplianceCheck) // 获取最新检查

			// 管理员接口
			airspaceGroup.POST("/admin/review/:id", h.Airspace.ReviewApplication)      // 审核空域申请
			airspaceGroup.GET("/admin/pending", h.Airspace.ListPendingReview)          // 待审核列表
			airspaceGroup.POST("/admin/no-fly-zone", h.Airspace.CreateNoFlyZone)       // 创建禁飞区
			airspaceGroup.DELETE("/admin/no-fly-zone/:id", h.Airspace.DeleteNoFlyZone) // 删除禁飞区
		}

		// Settlement 支付结算与分账相关接口
		settlementGroup := authenticated.Group("/settlement")
		{
			// 定价
			settlementGroup.POST("/calculate-price", h.Settlement.CalculatePrice) // 计算订单价格(预估)

			// 结算
			settlementGroup.POST("/create", h.Settlement.CreateSettlement)             // 创建订单结算
			settlementGroup.GET("/:id", h.Settlement.GetSettlement)                    // 获取结算详情
			settlementGroup.GET("/order/:order_id", h.Settlement.GetSettlementByOrder) // 根据订单获取结算
			settlementGroup.POST("/:id/confirm", h.Settlement.ConfirmSettlement)       // 确认结算
			settlementGroup.GET("/my", h.Settlement.ListMySettlements)                 // 获取我的结算

			// 钱包
			settlementGroup.GET("/wallet", h.Settlement.GetWallet)                          // 获取我的钱包
			settlementGroup.GET("/wallet/transactions", h.Settlement.GetWalletTransactions) // 获取钱包流水

			// 提现
			settlementGroup.POST("/withdrawal", h.Settlement.RequestWithdrawal) // 申请提现
			settlementGroup.GET("/withdrawals", h.Settlement.ListMyWithdrawals) // 获取我的提现记录

			// 管理员接口
			settlementGroup.POST("/admin/execute/:id", h.Settlement.ExecuteSettlement)                  // 执行结算
			settlementGroup.GET("/admin/list", h.Settlement.ListSettlements)                            // 获取所有结算列表
			settlementGroup.POST("/admin/process-pending", h.Settlement.AdminProcessSettlements)        // 批量处理结算
			settlementGroup.GET("/admin/withdrawals/pending", h.Settlement.AdminListPendingWithdrawals) // 待审核提现
			settlementGroup.POST("/admin/withdrawal/:id/approve", h.Settlement.AdminApproveWithdrawal)  // 审批通过提现
			settlementGroup.POST("/admin/withdrawal/:id/reject", h.Settlement.AdminRejectWithdrawal)    // 拒绝提现
			settlementGroup.GET("/admin/pricing-configs", h.Settlement.GetPricingConfigs)               // 获取定价配置
			settlementGroup.PUT("/admin/pricing-config", h.Settlement.UpdatePricingConfig)              // 更新定价配置
		}

		// Credit & Risk Control (信用评价与风控)
		creditGroup := authenticated.Group("/credit")
		{
			// 用户信用分
			creditGroup.GET("/my-score", h.Credit.GetMyCreditScore)        // 获取我的信用分
			creditGroup.GET("/my-logs", h.Credit.GetMyCreditLogs)          // 获取我的信用分变动记录
			creditGroup.GET("/user/:user_id", h.Credit.GetUserCreditScore) // 获取指定用户信用分
			creditGroup.GET("/scores", h.Credit.ListCreditScores)          // 列出信用分列表

			// 违规记录
			creditGroup.GET("/my-violations", h.Credit.GetMyViolations)              // 获取我的违规记录
			creditGroup.GET("/violations", h.Credit.ListViolations)                  // 列出违规记录(管理员)
			creditGroup.GET("/violations/:id", h.Credit.GetViolationDetail)          // 获取违规详情
			creditGroup.POST("/violations", h.Credit.CreateViolation)                // 创建违规记录
			creditGroup.POST("/violations/:id/confirm", h.Credit.ConfirmViolation)   // 确认违规
			creditGroup.POST("/violations/:id/appeal", h.Credit.SubmitAppeal)        // 提交申诉
			creditGroup.POST("/violations/:id/review-appeal", h.Credit.ReviewAppeal) // 审核申诉

			// 风控
			creditGroup.GET("/risk-check", h.Credit.PreOrderRiskCheck)        // 订单前风控检查
			creditGroup.GET("/risks", h.Credit.ListRiskControls)              // 列出风控记录
			creditGroup.GET("/risks/:id", h.Credit.GetRiskControlDetail)      // 获取风控详情
			creditGroup.POST("/risks/:id/review", h.Credit.ReviewRiskControl) // 审核风控

			// 黑名单
			creditGroup.GET("/blacklists", h.Credit.ListBlacklists) // 列出黑名单

			// 保证金
			creditGroup.GET("/my-deposit", h.Credit.GetMyDeposit)  // 获取我的保证金
			creditGroup.GET("/deposits", h.Credit.ListDeposits)    // 列出保证金
			creditGroup.POST("/deposits", h.Credit.RequireDeposit) // 要求缴纳保证金

			// 统计
			creditGroup.GET("/statistics", h.Credit.GetCreditStatistics) // 获取信用风控统计
		}

		// Insurance & Claims (保险与理赔)
		insuranceGroup := authenticated.Group("/insurance")
		{
			// 保险产品
			insuranceGroup.GET("/products", h.Insurance.ListProducts)                   // 获取保险产品列表
			insuranceGroup.GET("/products/mandatory", h.Insurance.GetMandatoryProducts) // 获取强制险产品

			// 保险保单
			insuranceGroup.POST("/purchase", h.Insurance.PurchaseInsurance)             // 购买保险
			insuranceGroup.GET("/my-policies", h.Insurance.GetMyPolicies)               // 获取我的保单
			insuranceGroup.GET("/policies/:id", h.Insurance.GetPolicyDetail)            // 获取保单详情
			insuranceGroup.POST("/policies/:id/activate", h.Insurance.ActivatePolicy)   // 激活保单
			insuranceGroup.GET("/check-mandatory", h.Insurance.CheckMandatoryInsurance) // 检查强制险

			// 理赔报案
			insuranceGroup.POST("/claims/report", h.Insurance.ReportClaim)             // 提交报案
			insuranceGroup.GET("/my-claims", h.Insurance.GetMyClaims)                  // 获取我的理赔
			insuranceGroup.GET("/claims/:id", h.Insurance.GetClaimDetail)              // 获取理赔详情
			insuranceGroup.GET("/claims/:id/timelines", h.Insurance.GetClaimTimelines) // 获取理赔时间线
			insuranceGroup.POST("/claims/:id/evidence", h.Insurance.UploadEvidence)    // 上传证据
			insuranceGroup.POST("/claims/:id/dispute", h.Insurance.DisputeClaim)       // 提交争议申诉

			// 管理员理赔处理
			insuranceGroup.GET("/admin/claims/pending", h.Insurance.AdminListPendingClaims)           // 待处理理赔
			insuranceGroup.POST("/admin/claims/:id/investigate", h.Insurance.AdminStartInvestigation) // 开始调查
			insuranceGroup.POST("/admin/claims/:id/liability", h.Insurance.AdminDetermineLiability)   // 责任认定
			insuranceGroup.POST("/admin/claims/:id/approve", h.Insurance.AdminApproveClaim)           // 核赔通过
			insuranceGroup.POST("/admin/claims/:id/reject", h.Insurance.AdminRejectClaim)             // 拒赔
			insuranceGroup.POST("/admin/claims/:id/pay", h.Insurance.AdminPayClaim)                   // 赔付
			insuranceGroup.POST("/admin/claims/:id/close", h.Insurance.AdminCloseClaim)               // 结案
			insuranceGroup.GET("/admin/statistics", h.Insurance.GetInsuranceStatistics)               // 保险统计
		}

		// Analytics (数据分析与决策支持)
		analyticsGroup := authenticated.Group("/analytics")
		{
			// 实时看板
			analyticsGroup.GET("/dashboard/realtime", h.Analytics.GetRealtimeDashboard) // 获取实时看板
			analyticsGroup.POST("/dashboard/refresh", h.Analytics.RefreshDashboard)     // 刷新看板缓存
			analyticsGroup.GET("/overview", h.Analytics.GetOverview)                    // 获取数据概览

			// 趋势数据
			analyticsGroup.GET("/trends", h.Analytics.GetTrendData) // 获取趋势数据

			// 每日统计
			analyticsGroup.GET("/daily", h.Analytics.GetDailyStatistics)            // 获取每日统计
			analyticsGroup.GET("/daily/range", h.Analytics.GetDailyStatisticsRange) // 获取日期范围统计

			// 小时指标
			analyticsGroup.GET("/hourly", h.Analytics.GetHourlyMetrics) // 获取小时指标

			// 热力图
			analyticsGroup.GET("/heatmap", h.Analytics.GetHeatmapData) // 获取热力图数据

			// 区域统计
			analyticsGroup.GET("/regions", h.Analytics.GetRegionStatistics) // 获取区域统计
			analyticsGroup.GET("/regions/top", h.Analytics.GetTopRegions)   // 获取TOP区域

			// 报表
			analyticsGroup.GET("/reports", h.Analytics.GetReportList)               // 获取报表列表
			analyticsGroup.GET("/report/:id", h.Analytics.GetReport)                // 获取报表详情
			analyticsGroup.GET("/report/no/:reportNo", h.Analytics.GetReportByNo)   // 根据编号获取报表
			analyticsGroup.GET("/report/latest/:type", h.Analytics.GetLatestReport) // 获取最新报表
			analyticsGroup.POST("/report/generate", h.Analytics.GenerateReport)     // 生成报表
			analyticsGroup.DELETE("/report/:id", h.Analytics.DeleteReport)          // 删除报表

			// 管理员接口
			analyticsGroup.POST("/admin/daily/generate", h.Analytics.GenerateDailyStatistics) // 生成每日统计
			analyticsGroup.POST("/admin/job/daily", h.Analytics.TriggerDailyJob)              // 触发每日统计任务
			analyticsGroup.POST("/admin/job/hourly", h.Analytics.TriggerHourlyJob)            // 触发小时指标任务
			analyticsGroup.POST("/admin/job/report", h.Analytics.TriggerAutoReportJob)        // 触发自动报表任务
		}
	}

	// Admin routes
	adminGroup := api.Group("/admin")
	adminGroup.Use(middleware.AuthMiddleware(), middleware.AdminMiddleware())
	{
		adminGroup.GET("/dashboard", h.Admin.Dashboard)
		adminGroup.GET("/users", h.Admin.UserList)
		adminGroup.PUT("/users/:id/status", h.Admin.UpdateUserStatus)
		adminGroup.PUT("/users/:id/verify", h.Admin.ApproveIDVerification)
		adminGroup.GET("/drones", h.Admin.DroneList)
		adminGroup.GET("/drones/:id", h.Admin.GetDroneDetail)
		adminGroup.PUT("/drones/:id/certification", h.Admin.ApproveDroneCertification)
		adminGroup.PUT("/drones/:id/uom", h.Admin.ApproveUOMRegistration)
		adminGroup.PUT("/drones/:id/insurance", h.Admin.ApproveInsurance)
		adminGroup.PUT("/drones/:id/airworthiness", h.Admin.ApproveAirworthiness)
		// 飞手管理
		adminGroup.GET("/pilots", h.Admin.PilotList)
		adminGroup.PUT("/pilots/:id/verify", h.Admin.VerifyPilot)
		adminGroup.PUT("/pilots/:id/criminal-check", h.Admin.ApprovePilotCriminalCheck)
		adminGroup.PUT("/pilots/:id/health-check", h.Admin.ApprovePilotHealthCheck)
		adminGroup.GET("/clients", h.Admin.ClientList)
		adminGroup.PUT("/clients/:id/verify", h.Admin.VerifyClient)
		adminGroup.GET("/demands", h.Admin.DemandList)
		adminGroup.GET("/supplies", h.Admin.SupplyList)
		adminGroup.GET("/orders", h.Admin.OrderList)
		adminGroup.GET("/orders/anomalies", h.Admin.OrderAnomalyList)
		adminGroup.GET("/orders/anomalies/summary", h.Admin.OrderAnomalySummary)
		adminGroup.GET("/dispatch-tasks", h.Admin.DispatchTaskList)
		adminGroup.GET("/flight-records", h.Admin.FlightRecordList)
		adminGroup.GET("/migration-audits", h.Admin.MigrationAuditList)
		adminGroup.GET("/migration-audits/summary", h.Admin.MigrationAuditSummary)
		adminGroup.GET("/payments", h.Admin.PaymentList)
		adminGroup.POST("/demands/handle-expired", h.Admin.HandleExpiredDemands)
		adminGroup.POST("/pilot-bindings/handle-expired", h.Admin.HandleExpiredPilotBindings)
	}
}
