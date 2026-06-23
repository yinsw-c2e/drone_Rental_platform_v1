package provider_recommendation

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
	"wurenji-backend/internal/service"
)

func TestListReturnsProviderRecommendations(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := newProviderRecommendationAPITestDB(
		t,
		&model.User{},
		&model.OwnerProfile{},
		&model.Drone{},
		&model.OwnerSupply{},
		&model.Order{},
		&model.Review{},
		&model.Demand{},
		&model.DemandQuote{},
	)

	client := &model.User{ID: 9401, Phone: "13900009401", Nickname: "推荐接口客户", Status: "active"}
	provider := seedProviderRecommendationAPIProvider(t, db, providerRecommendationAPISeed{
		UserID:       9501,
		Nickname:     "佛山认证重载服务商",
		DroneID:      9601,
		MaxPayloadKG: 120,
		MaxDistance:  30,
		Latitude:     23.0410,
		Longitude:    113.1430,
		Scene:        "power_grid",
		RangeKM:      25,
	})
	if err := db.Create(client).Error; err != nil {
		t.Fatalf("seed client: %v", err)
	}
	if err := db.Create(&model.Review{
		OrderID:    1,
		ReviewerID: client.ID,
		RevieweeID: provider.ID,
		TargetType: "user",
		TargetID:   provider.ID,
		Rating:     5,
		Content:    "稳定",
	}).Error; err != nil {
		t.Fatalf("seed review: %v", err)
	}

	handler := NewHandler(service.NewProviderRecommendationService(repository.NewProviderRecommendationRepo(db)))
	status, payload := callProviderRecommendationListAPI(
		handler,
		client.ID,
		"/api/v2/providers/recommended?origin_latitude=23.041&origin_longitude=113.143&cargo_scene=power_grid&cargo_weight_kg=80&page=1&page_size=20",
	)

	if status != http.StatusOK {
		t.Fatalf("expected status 200, got %d payload=%#v", status, payload)
	}
	if payload["code"] != "OK" {
		t.Fatalf("expected OK envelope, got %#v", payload)
	}
	data, ok := payload["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected data object, got %#v", payload["data"])
	}
	items, ok := data["items"].([]interface{})
	if !ok || len(items) != 1 {
		t.Fatalf("expected one recommendation item, got %#v", data["items"])
	}
	item, ok := items[0].(map[string]interface{})
	if !ok {
		t.Fatalf("expected recommendation object, got %#v", items[0])
	}
	if got := int64(item["provider_user_id"].(float64)); got != provider.ID {
		t.Fatalf("expected provider %d, got %d", provider.ID, got)
	}
	if item["provider_name"] != "佛山认证重载服务商" {
		t.Fatalf("expected provider name, got %#v", item["provider_name"])
	}
	if item["max_payload_kg"].(float64) < 120 {
		t.Fatalf("expected max payload, got %#v", item["max_payload_kg"])
	}
	if item["rating"].(float64) != 5 || item["rating_count"].(float64) != 1 {
		t.Fatalf("expected rating fields, got %#v", item)
	}
	if item["score"].(float64) <= 0 {
		t.Fatalf("expected positive score, got %#v", item["score"])
	}
	if _, ok := item["score_reasons"].([]interface{}); !ok {
		t.Fatalf("expected score_reasons array, got %#v", item["score_reasons"])
	}
	meta, ok := payload["meta"].(map[string]interface{})
	if !ok || meta["total"].(float64) != 1 {
		t.Fatalf("expected total meta 1, got %#v", payload["meta"])
	}
}

func TestListReturnsProviderInvitationStateForDemand(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := newProviderRecommendationAPITestDB(
		t,
		&model.User{},
		&model.OwnerProfile{},
		&model.Drone{},
		&model.OwnerSupply{},
		&model.Order{},
		&model.Review{},
		&model.Demand{},
		&model.DemandQuote{},
		&model.DemandProviderInvitation{},
	)

	client := &model.User{ID: 9411, Phone: "13900009411", Nickname: "邀请态客户", Status: "active"}
	provider := seedProviderRecommendationAPIProvider(t, db, providerRecommendationAPISeed{
		UserID:       9511,
		Nickname:     "已邀请服务商",
		DroneID:      9611,
		MaxPayloadKG: 120,
		MaxDistance:  30,
		Latitude:     23.0410,
		Longitude:    113.1430,
		Scene:        "power_grid",
		RangeKM:      25,
	})
	demand := &model.Demand{
		ID:           9412,
		DemandNo:     "DM-API-INV-STATE-001",
		ClientUserID: client.ID,
		Title:        "推荐列表邀请态测试需求",
		ServiceType:  "heavy_cargo_lift_transport",
		CargoScene:   "power_grid",
		Status:       "published",
	}
	if err := db.Create(client).Error; err != nil {
		t.Fatalf("seed client: %v", err)
	}
	if err := db.Create(demand).Error; err != nil {
		t.Fatalf("seed demand: %v", err)
	}
	invitation := &model.DemandProviderInvitation{
		DemandID:       demand.ID,
		ClientUserID:   client.ID,
		ProviderUserID: provider.ID,
		Status:         model.DemandProviderInvitationStatusPendingQuote,
		Message:        "请报价",
	}
	if err := db.Create(invitation).Error; err != nil {
		t.Fatalf("seed invitation: %v", err)
	}

	handler := NewHandler(service.NewProviderRecommendationService(repository.NewProviderRecommendationRepo(db)))
	status, payload := callProviderRecommendationListAPI(
		handler,
		client.ID,
		fmt.Sprintf("/api/v2/providers/recommended?demand_id=%d&origin_latitude=23.041&origin_longitude=113.143&cargo_scene=power_grid&cargo_weight_kg=80&page=1&page_size=20", demand.ID),
	)

	if status != http.StatusOK {
		t.Fatalf("expected status 200, got %d payload=%#v", status, payload)
	}
	data, ok := payload["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected data object, got %#v", payload["data"])
	}
	items, ok := data["items"].([]interface{})
	if !ok || len(items) != 1 {
		t.Fatalf("expected one recommendation item, got %#v", data["items"])
	}
	item, ok := items[0].(map[string]interface{})
	if !ok {
		t.Fatalf("expected recommendation object, got %#v", items[0])
	}
	if got := item["invitation_status"]; got != model.DemandProviderInvitationStatusPendingQuote {
		t.Fatalf("expected invitation status pending_quote, got %#v", got)
	}
	if got := int64(item["invitation_id"].(float64)); got != invitation.ID {
		t.Fatalf("expected invitation id %d, got %d", invitation.ID, got)
	}
}

func TestListRejectsInvalidRecommendationQuery(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewHandler(service.NewProviderRecommendationService(repository.NewProviderRecommendationRepo(newProviderRecommendationAPITestDB(t, &model.User{}, &model.OwnerProfile{}, &model.Drone{}, &model.OwnerSupply{}))))

	status, payload := callProviderRecommendationListAPI(
		handler,
		9401,
		"/api/v2/providers/recommended?origin_latitude=120&origin_longitude=113.143&cargo_weight_kg=80",
	)

	if status != http.StatusBadRequest {
		t.Fatalf("expected bad request, got %d payload=%#v", status, payload)
	}
	if payload["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected validation error, got %#v", payload)
	}
}

func TestInviteCreatesProviderInvitation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := newProviderRecommendationAPITestDB(
		t,
		&model.User{},
		&model.OwnerProfile{},
		&model.Drone{},
		&model.OwnerSupply{},
		&model.Demand{},
		&model.DemandProviderInvitation{},
	)

	client := &model.User{ID: 9701, Phone: "13900009701", Nickname: "邀请接口客户", Status: "active"}
	provider := seedProviderRecommendationAPIProvider(t, db, providerRecommendationAPISeed{
		UserID:       9702,
		Nickname:     "可邀请服务商",
		DroneID:      9703,
		MaxPayloadKG: 120,
		MaxDistance:  30,
		Latitude:     23.0410,
		Longitude:    113.1430,
		Scene:        "power_grid",
		RangeKM:      25,
	})
	demand := &model.Demand{
		ID:           9704,
		DemandNo:     "DM-API-INVITE-001",
		ClientUserID: client.ID,
		Title:        "邀请接口测试需求",
		ServiceType:  "heavy_cargo_lift_transport",
		CargoScene:   "power_grid",
		Status:       "published",
	}
	if err := db.Create(client).Error; err != nil {
		t.Fatalf("seed client: %v", err)
	}
	if err := db.Create(demand).Error; err != nil {
		t.Fatalf("seed demand: %v", err)
	}

	handler := NewHandler(service.NewProviderRecommendationService(repository.NewProviderRecommendationRepo(db)))
	status, payload := callProviderInvitationAPI(
		handler,
		client.ID,
		demand.ID,
		fmt.Sprintf(`{"provider_user_id":%d,"message":"希望你看一下这单"}`, provider.ID),
	)

	if status != http.StatusOK {
		t.Fatalf("expected status 200, got %d payload=%#v", status, payload)
	}
	data, ok := payload["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected data object, got %#v", payload["data"])
	}
	if data["status"] != "pending_quote" {
		t.Fatalf("expected pending_quote, got %#v", data)
	}
	if int64(data["demand_id"].(float64)) != demand.ID || int64(data["provider_user_id"].(float64)) != provider.ID {
		t.Fatalf("unexpected invitation ids: %#v", data)
	}
}

func callProviderRecommendationListAPI(handler *Handler, userID int64, url string) (int, map[string]interface{}) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("user_id", userID)
	c.Set("user_type", "client")
	c.Set("page", 1)
	c.Set("page_size", 20)
	c.Request = httptest.NewRequest(http.MethodGet, url, nil)
	handler.List(c)

	var payload map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &payload)
	return w.Code, payload
}

func callProviderInvitationAPI(handler *Handler, userID int64, demandID int64, body string) (int, map[string]interface{}) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("user_id", userID)
	c.Set("user_type", "client")
	c.Params = gin.Params{{Key: "demand_id", Value: fmt.Sprintf("%d", demandID)}}
	c.Request = httptest.NewRequest(
		http.MethodPost,
		fmt.Sprintf("/api/v2/demands/%d/provider-invitations", demandID),
		bytes.NewBufferString(body),
	)
	c.Request.Header.Set("Content-Type", "application/json")
	handler.Invite(c)

	var payload map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &payload)
	return w.Code, payload
}

func newProviderRecommendationAPITestDB(t *testing.T, models ...interface{}) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(models...); err != nil {
		t.Fatalf("auto migrate test tables: %v", err)
	}
	return db
}

type providerRecommendationAPISeed struct {
	UserID       int64
	Nickname     string
	DroneID      int64
	MaxPayloadKG float64
	MaxDistance  float64
	Latitude     float64
	Longitude    float64
	Scene        string
	RangeKM      float64
}

func seedProviderRecommendationAPIProvider(t *testing.T, db *gorm.DB, seed providerRecommendationAPISeed) *model.User {
	t.Helper()

	user := &model.User{
		ID:       seed.UserID,
		Phone:    fmt.Sprintf("139%08d", seed.UserID),
		Nickname: seed.Nickname,
		UserType: "drone_owner",
		Status:   "active",
	}
	profile := &model.OwnerProfile{
		UserID:             seed.UserID,
		VerificationStatus: "approved",
		Status:             "active",
		ServiceCity:        "佛山",
		Intro:              "认证重载服务商",
	}
	drone := &model.Drone{
		ID:                    seed.DroneID,
		OwnerID:               seed.UserID,
		Brand:                 "DJI",
		Model:                 "Agras T50",
		SerialNumber:          fmt.Sprintf("REC-API-DRONE-%d", seed.UserID),
		MTOWKG:                200,
		MaxPayloadKG:          seed.MaxPayloadKG,
		MaxDistance:           seed.MaxDistance,
		Latitude:              seed.Latitude,
		Longitude:             seed.Longitude,
		City:                  "佛山",
		AvailabilityStatus:    "available",
		CertificationStatus:   "approved",
		UOMVerified:           "verified",
		InsuranceVerified:     "verified",
		AirworthinessVerified: "verified",
	}
	supply := &model.OwnerSupply{
		SupplyNo:           fmt.Sprintf("REC-API-SP-%d", seed.UserID),
		OwnerUserID:        seed.UserID,
		DroneID:            seed.DroneID,
		Title:              "能力档案",
		ServiceTypes:       model.JSON(`["heavy_cargo_lift_transport"]`),
		CargoScenes:        model.JSON(`["` + seed.Scene + `"]`),
		MTOWKG:             200,
		MaxPayloadKG:       seed.MaxPayloadKG,
		MaxRangeKM:         seed.RangeKM,
		AcceptsDirectOrder: false,
		Status:             "active",
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("seed provider user: %v", err)
	}
	if err := db.Create(profile).Error; err != nil {
		t.Fatalf("seed provider profile: %v", err)
	}
	if err := db.Create(drone).Error; err != nil {
		t.Fatalf("seed provider drone: %v", err)
	}
	if err := db.Create(supply).Error; err != nil {
		t.Fatalf("seed provider supply: %v", err)
	}
	return user
}
