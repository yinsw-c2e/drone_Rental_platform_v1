package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"sort"
	"strconv"
	"strings"
	"time"

	"go.uber.org/zap"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"wurenji-backend/internal/config"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
	"wurenji-backend/internal/service"
)

type OrderComparison struct {
	Role           string   `json:"role"`
	LegacyTotal    int64    `json:"legacy_total"`
	V2Total        int64    `json:"v2_total"`
	LegacyOrderNos []string `json:"legacy_order_nos"`
	V2OrderNos     []string `json:"v2_order_nos"`
	MissingInV2    []string `json:"missing_in_v2"`
	ExtraInV2      []string `json:"extra_in_v2"`
}

type DispatchComparison struct {
	LegacyTaskPoolTotal int64    `json:"legacy_task_pool_total"`
	V2FormalTotal       int64    `json:"v2_formal_total"`
	LegacyTaskNos       []string `json:"legacy_task_nos"`
	V2DispatchNos       []string `json:"v2_dispatch_nos"`
	Note                string   `json:"note"`
}

type FlightStatsComparison struct {
	LegacyTotalFlights  int64   `json:"legacy_total_flights"`
	LegacyTotalHours    float64 `json:"legacy_total_hours"`
	LegacyTotalDistance float64 `json:"legacy_total_distance"`
	LegacyMaxAltitude   float64 `json:"legacy_max_altitude"`
	V2TotalFlights      int64   `json:"v2_total_flights"`
	V2TotalHours        float64 `json:"v2_total_hours"`
	V2TotalDistance     float64 `json:"v2_total_distance"`
	V2MaxAltitude       float64 `json:"v2_max_altitude"`
}

type HomeComparison struct {
	NewSummary             service.HomeDashboardSummary `json:"new_summary"`
	NewClientView          service.HomeClientDashboard  `json:"new_client_view"`
	NewOwnerView           service.HomeOwnerDashboard   `json:"new_owner_view"`
	NewPilotView           service.HomePilotDashboard   `json:"new_pilot_view"`
	LegacyClientOrderTotal int64                        `json:"legacy_client_order_total"`
	LegacyOwnerOrderTotal  int64                        `json:"legacy_owner_order_total"`
	LegacyPilotTaskTotal   int64                        `json:"legacy_pilot_task_total"`
	Note                   string                       `json:"note"`
}

type UserParityReport struct {
	UserID           int64                  `json:"user_id"`
	Nickname         string                 `json:"nickname"`
	Phone            string                 `json:"phone"`
	RoleSummary      service.RoleSummary    `json:"role_summary"`
	Home             *HomeComparison        `json:"home,omitempty"`
	OrderComparisons []OrderComparison      `json:"order_comparisons,omitempty"`
	Dispatch         *DispatchComparison    `json:"dispatch,omitempty"`
	FlightStats      *FlightStatsComparison `json:"flight_stats,omitempty"`
	Warnings         []string               `json:"warnings,omitempty"`
}

type parityContext struct {
	userService     *service.UserService
	clientService   *service.ClientService
	ownerService    *service.OwnerService
	pilotService    *service.PilotService
	orderService    *service.OrderService
	dispatchService *service.DispatchService
	homeService     *service.HomeService
	userRepo        *repository.UserRepo
	orderRepo       *repository.OrderRepo
	pilotRepo       *repository.PilotRepo
}

func main() {
	configPath := flag.String("config", "config.yaml", "配置文件路径")
	userIDsRaw := flag.String("user-ids", "", "指定用户 ID，逗号分隔")
	limit := flag.Int("limit", 3, "未指定用户时，自动抽样的用户数量")
	flag.Parse()

	cfg, err := config.LoadConfig(*configPath)
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}
	db, err := gorm.Open(mysql.Open(cfg.Database.DSN()), &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormlogger.Silent),
	})
	if err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("获取数据库连接失败: %v", err)
	}
	defer sqlDB.Close()

	ctx := buildParityContext(db)
	missingTables, err := detectMissingV2Tables(db)
	if err != nil {
		log.Fatalf("检查 v2 表结构失败: %v", err)
	}
	userIDs, err := resolveUserIDs(ctx.userService, *userIDsRaw, *limit)
	if err != nil {
		log.Fatalf("解析用户范围失败: %v", err)
	}

	var reports []UserParityReport
	for _, userID := range userIDs {
		report, err := buildUserParityReport(ctx, userID)
		if err != nil {
			reports = append(reports, UserParityReport{
				UserID:   userID,
				Warnings: []string{err.Error()},
			})
			continue
		}
		reports = append(reports, *report)
	}

	output, err := json.MarshalIndent(map[string]interface{}{
		"generated_at":         time.Now().Format(time.RFC3339),
		"missing_v2_tables":    missingTables,
		"missing_v2_table_cnt": len(missingTables),
		"user_count":           len(reports),
		"reports":              reports,
	}, "", "  ")
	if err != nil {
		log.Fatalf("输出 JSON 失败: %v", err)
	}
	fmt.Println(string(output))
}

func buildParityContext(db *gorm.DB) *parityContext {
	logger := zap.NewNop()

	userRepo := repository.NewUserRepo(db)
	droneRepo := repository.NewDroneRepo(db)
	orderRepo := repository.NewOrderRepo(db)
	demandRepo := repository.NewDemandRepo(db)
	paymentRepo := repository.NewPaymentRepo(db)
	clientRepo := repository.NewClientRepo(db)
	roleProfileRepo := repository.NewRoleProfileRepo(db)
	dispatchRepo := repository.NewDispatchRepo(db)
	demandDomainRepo := repository.NewDemandDomainRepo(db)
	ownerDomainRepo := repository.NewOwnerDomainRepo(db)
	orderArtifactRepo := repository.NewOrderArtifactRepo(db)
	pilotRepo := repository.NewPilotRepo(db)
	flightRepo := repository.NewFlightRepo(db)

	userService := service.NewUserService(userRepo, clientRepo, roleProfileRepo, droneRepo, pilotRepo)
	ownerService := service.NewOwnerService(userRepo, droneRepo, pilotRepo, roleProfileRepo, ownerDomainRepo, demandDomainRepo)
	orderService := service.NewOrderService(orderRepo, droneRepo, pilotRepo, demandRepo, paymentRepo, clientRepo, demandDomainRepo, ownerDomainRepo, orderArtifactRepo, &config.Config{}, logger)
	clientService := service.NewClientService(clientRepo, userRepo, roleProfileRepo, ownerDomainRepo, demandDomainRepo, orderService)
	dispatchService := service.NewDispatchService(dispatchRepo, pilotRepo, droneRepo, clientRepo, orderRepo, ownerDomainRepo, demandDomainRepo, orderArtifactRepo, logger)
	flightService := service.NewFlightService(flightRepo, orderRepo, pilotRepo, logger)
	pilotService := service.NewPilotService(pilotRepo, userRepo, roleProfileRepo, orderRepo, ownerDomainRepo, demandDomainRepo, dispatchRepo, flightRepo, logger)
	pilotService.SetFlightService(flightService)
	homeService := service.NewHomeService(userService, clientService, ownerService, pilotService, orderService, demandDomainRepo)

	return &parityContext{
		userService:     userService,
		clientService:   clientService,
		ownerService:    ownerService,
		pilotService:    pilotService,
		orderService:    orderService,
		dispatchService: dispatchService,
		homeService:     homeService,
		userRepo:        userRepo,
		orderRepo:       orderRepo,
		pilotRepo:       pilotRepo,
	}
}

func resolveUserIDs(userService *service.UserService, raw string, limit int) ([]int64, error) {
	if strings.TrimSpace(raw) != "" {
		var ids []int64
		for _, item := range strings.Split(raw, ",") {
			value, err := strconv.ParseInt(strings.TrimSpace(item), 10, 64)
			if err != nil {
				return nil, err
			}
			ids = append(ids, value)
		}
		return ids, nil
	}
	users, _, err := userService.ListUsers(1, limit, map[string]interface{}{"status": "active"})
	if err != nil {
		return nil, err
	}
	var ids []int64
	for _, user := range users {
		ids = append(ids, user.ID)
	}
	return ids, nil
}

func buildUserParityReport(ctx *parityContext, userID int64) (*UserParityReport, error) {
	user, err := ctx.userRepo.GetByID(userID)
	if err != nil {
		return nil, err
	}
	roleSummary, err := ctx.userService.GetRoleSummary(userID)
	if err != nil {
		return nil, err
	}

	report := &UserParityReport{
		UserID:      user.ID,
		Nickname:    user.Nickname,
		Phone:       user.Phone,
		RoleSummary: *roleSummary,
	}

	homeDashboard, err := ctx.homeService.GetDashboard(userID)
	if err != nil {
		report.Warnings = append(report.Warnings, "home dashboard compare failed: "+err.Error())
	} else {
		report.Home = &HomeComparison{
			NewSummary:    homeDashboard.Summary,
			NewClientView: homeDashboard.RoleViews.Client,
			NewOwnerView:  homeDashboard.RoleViews.Owner,
			NewPilotView:  homeDashboard.RoleViews.Pilot,
			Note:          "legacy 侧仍保留混合对象语义，因此首页对比主要看数量和角色视图，不强制逐字段完全一致。",
		}
	}

	if roleSummary.HasClientRole {
		comparison, err := compareOrders(ctx.orderRepo, ctx.orderService, userID, "client")
		if err != nil {
			report.Warnings = append(report.Warnings, "client order compare failed: "+err.Error())
		} else {
			report.OrderComparisons = append(report.OrderComparisons, *comparison)
			if report.Home != nil {
				report.Home.LegacyClientOrderTotal = comparison.LegacyTotal
			}
		}
	}
	if roleSummary.HasOwnerRole {
		comparison, err := compareOrders(ctx.orderRepo, ctx.orderService, userID, "owner")
		if err != nil {
			report.Warnings = append(report.Warnings, "owner order compare failed: "+err.Error())
		} else {
			report.OrderComparisons = append(report.OrderComparisons, *comparison)
			if report.Home != nil {
				report.Home.LegacyOwnerOrderTotal = comparison.LegacyTotal
			}
		}
	}
	if roleSummary.HasPilotRole {
		comparison, err := compareOrders(ctx.orderRepo, ctx.orderService, userID, "pilot")
		if err != nil {
			report.Warnings = append(report.Warnings, "pilot order compare failed: "+err.Error())
		} else {
			report.OrderComparisons = append(report.OrderComparisons, *comparison)
		}

		pilot, err := ctx.pilotService.GetByUserID(userID)
		if err != nil {
			report.Warnings = append(report.Warnings, "pilot profile missing: "+err.Error())
			return report, nil
		}

		dispatchComparison, err := compareDispatch(ctx.dispatchService, ctx.pilotService, pilot.ID, userID)
		if err != nil {
			report.Warnings = append(report.Warnings, "dispatch compare failed: "+err.Error())
		} else {
			report.Dispatch = dispatchComparison
			if report.Home != nil {
				report.Home.LegacyPilotTaskTotal = dispatchComparison.LegacyTaskPoolTotal
			}
		}

		flightComparison, err := compareFlightStats(ctx.pilotRepo, ctx.pilotService, pilot.ID)
		if err != nil {
			report.Warnings = append(report.Warnings, "flight stats compare failed: "+err.Error())
		} else {
			report.FlightStats = flightComparison
		}
	}

	return report, nil
}

func detectMissingV2Tables(db *gorm.DB) ([]string, error) {
	required := []string{
		"client_profiles",
		"owner_profiles",
		"pilot_profiles",
		"owner_supplies",
		"demands",
		"dispatch_tasks",
		"flight_records",
		"migration_audit_records",
	}
	var missing []string
	for _, table := range required {
		if !db.Migrator().HasTable(table) {
			missing = append(missing, table)
		}
	}
	sort.Strings(missing)
	return missing, nil
}

func compareOrders(orderRepo *repository.OrderRepo, orderService *service.OrderService, userID int64, role string) (*OrderComparison, error) {
	legacyOrders, legacyTotal, err := orderRepo.ListByUser(userID, role, "", 1, 100)
	if err != nil {
		return nil, err
	}
	newOrders, newTotal, err := orderService.ListOrders(userID, role, "", 1, 100)
	if err != nil {
		return nil, err
	}

	legacyNos := collectOrderNos(legacyOrders)
	v2Nos := collectOrderNos(newOrders)

	return &OrderComparison{
		Role:           role,
		LegacyTotal:    legacyTotal,
		V2Total:        newTotal,
		LegacyOrderNos: legacyNos,
		V2OrderNos:     v2Nos,
		MissingInV2:    diffStrings(legacyNos, v2Nos),
		ExtraInV2:      diffStrings(v2Nos, legacyNos),
	}, nil
}

func compareDispatch(dispatchService *service.DispatchService, pilotService *service.PilotService, legacyPilotID, pilotUserID int64) (*DispatchComparison, error) {
	legacyTasks, legacyTotal, err := dispatchService.ListPilotTasks(legacyPilotID, 1, 100, "")
	if err != nil {
		return nil, err
	}
	newTasks, newTotal, err := pilotService.ListDispatchTasks(pilotUserID, "", 1, 100)
	if err != nil {
		return nil, err
	}

	var legacyNos []string
	for _, item := range legacyTasks {
		legacyNos = append(legacyNos, item.TaskNo)
	}
	var newNos []string
	for _, item := range newTasks {
		newNos = append(newNos, item.DispatchNo)
	}
	sort.Strings(legacyNos)
	sort.Strings(newNos)

	return &DispatchComparison{
		LegacyTaskPoolTotal: legacyTotal,
		V2FormalTotal:       newTotal,
		LegacyTaskNos:       legacyNos,
		V2DispatchNos:       newNos,
		Note:                "legacy 侧为任务池对象，v2 为正式派单对象；该对比用于观察切流前后任务量和编号分布，不要求一一等值。",
	}, nil
}

func compareFlightStats(pilotRepo *repository.PilotRepo, pilotService *service.PilotService, legacyPilotID int64) (*FlightStatsComparison, error) {
	legacyHours, legacyDistance, legacyFlights, legacyMaxAltitude, err := pilotRepo.GetFlightStatsByPilotID(legacyPilotID)
	if err != nil {
		return nil, err
	}
	newStats, err := pilotService.GetFlightStats(legacyPilotID)
	if err != nil {
		return nil, err
	}

	return &FlightStatsComparison{
		LegacyTotalFlights:  legacyFlights,
		LegacyTotalHours:    legacyHours,
		LegacyTotalDistance: legacyDistance,
		LegacyMaxAltitude:   legacyMaxAltitude,
		V2TotalFlights:      toInt64(newStats["total_flights"]),
		V2TotalHours:        toFloat64(newStats["total_hours"]),
		V2TotalDistance:     toFloat64(newStats["total_distance"]),
		V2MaxAltitude:       toFloat64(newStats["max_altitude"]),
	}, nil
}

func collectOrderNos(orders []model.Order) []string {
	result := make([]string, 0, len(orders))
	for _, order := range orders {
		result = append(result, order.OrderNo)
	}
	sort.Strings(result)
	return result
}

func diffStrings(left, right []string) []string {
	rightSet := map[string]bool{}
	for _, item := range right {
		rightSet[item] = true
	}
	var diff []string
	for _, item := range left {
		if !rightSet[item] {
			diff = append(diff, item)
		}
	}
	sort.Strings(diff)
	return diff
}

func toFloat64(value interface{}) float64 {
	switch v := value.(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int64:
		return float64(v)
	case int:
		return float64(v)
	default:
		return 0
	}
}

func toInt64(value interface{}) int64 {
	switch v := value.(type) {
	case int64:
		return v
	case int:
		return int64(v)
	case float64:
		return int64(v)
	default:
		return 0
	}
}
