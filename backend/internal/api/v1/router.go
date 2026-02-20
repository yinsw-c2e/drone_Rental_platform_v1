package v1

import (
	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	"wurenji-backend/internal/api/v1/admin"
	"wurenji-backend/internal/api/v1/auth"
	"wurenji-backend/internal/api/v1/demand"
	"wurenji-backend/internal/api/v1/drone"
	"wurenji-backend/internal/api/v1/message"
	"wurenji-backend/internal/api/v1/order"
	"wurenji-backend/internal/api/v1/payment"
	"wurenji-backend/internal/api/v1/review"
	"wurenji-backend/internal/api/v1/user"
	"wurenji-backend/internal/config"
	ws "wurenji-backend/internal/websocket"

	"go.uber.org/zap"
)

type Handlers struct {
	Auth    *auth.Handler
	User    *user.Handler
	Drone   *drone.Handler
	Order   *order.Handler
	Demand  *demand.Handler
	Payment *payment.Handler
	Message *message.Handler
	Review  *review.Handler
	Admin   *admin.Handler
}

func RegisterRoutes(r *gin.Engine, h *Handlers, hub *ws.Hub, cfg *config.Config, logger *zap.Logger) {
	// Static files
	r.Static("/uploads", "./uploads")

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
			droneGroup.GET("/:id", h.Drone.GetByID)
			droneGroup.PUT("/:id", h.Drone.Update)
			droneGroup.DELETE("/:id", h.Drone.Delete)
			droneGroup.POST("/:id/images", h.Drone.UploadImages)
			droneGroup.POST("/:id/certification", h.Drone.SubmitCertification)
			droneGroup.PUT("/:id/availability", h.Drone.UpdateAvailability)
		}

		// Rental Offers
		offerGroup := authenticated.Group("/rental/offer")
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
		{
			orderGroup.POST("", h.Order.Create)
			orderGroup.GET("", h.Order.List)
			orderGroup.GET("/:id", h.Order.GetByID)
			orderGroup.PUT("/:id/accept", h.Order.Accept)
			orderGroup.PUT("/:id/reject", h.Order.Reject)
			orderGroup.PUT("/:id/cancel", h.Order.Cancel)
			orderGroup.PUT("/:id/start", h.Order.Start)
			orderGroup.PUT("/:id/complete", h.Order.Complete)
			orderGroup.GET("/:id/timeline", h.Order.GetTimeline)
		}

		// Payment
		paymentGroup := authenticated.Group("/payment")
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
		adminGroup.PUT("/drones/:id/certification", h.Admin.ApproveDroneCertification)
		adminGroup.GET("/orders", h.Admin.OrderList)
		adminGroup.GET("/payments", h.Admin.PaymentList)
	}
}
