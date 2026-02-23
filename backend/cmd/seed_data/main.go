package main

import (
	"fmt"
	"log"
	"math/rand"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	"wurenji-backend/internal/config"
	"wurenji-backend/internal/model"
)

var cities = []string{"北京", "上海", "广州", "深圳", "杭州", "成都", "西安", "武汉"}

// 北京、上海、广州、深圳、杭州、成都、西安、武汉的大致坐标范围
var cityCoords = map[string][4]float64{
	"北京": {39.8, 40.0, 116.2, 116.6},
	"上海": {31.1, 31.4, 121.3, 121.6},
	"广州": {23.0, 23.3, 113.1, 113.5},
	"深圳": {22.5, 22.7, 113.8, 114.2},
	"杭州": {30.1, 30.4, 120.0, 120.4},
	"成都": {30.5, 30.8, 104.0, 104.2},
	"西安": {34.2, 34.4, 108.8, 109.1},
	"武汉": {30.5, 30.7, 114.2, 114.5},
}

var droneModels = []struct {
	Brand    string
	Model    string
	Load     float64
	Time     int
	Distance float64
	Daily    int64
	Hourly   int64
	Deposit  int64
}{
	{"DJI", "Mavic 3", 0.9, 46, 30.0, 50000, 8000, 200000},
	{"DJI", "Air 2S", 0.6, 31, 18.5, 35000, 7000, 150000},
	{"DJI", "Mini 3 Pro", 0.25, 34, 25.0, 25000, 5000, 80000},
	{"DJI", "Phantom 4 Pro", 1.5, 30, 7.0, 40000, 6000, 180000},
	{"大疆", "经纬 M300 RTK", 2.7, 55, 15.0, 120000, 15000, 700000},
	{"大疆", "御 2 专业版", 0.9, 31, 10.0, 45000, 7500, 190000},
	{"极飞", "P80 2022款", 40.0, 22, 3.0, 80000, 12000, 500000},
	{"极飞", "V40 2023款", 16.0, 18, 2.5, 60000, 10000, 400000},
}

var serviceTypes = []string{"rental", "aerial_photo", "cargo", "agriculture"}
var features = []string{"4K摄像", "夜视功能", "避障系统", "智能跟随", "长续航", "防水", "热成像"}

func main() {
	rand.Seed(time.Now().UnixNano())

	cfg, err := config.LoadConfig("config.yaml")
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	db, err := gorm.Open(mysql.Open(cfg.Database.DSN()), &gorm.Config{})
	if err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}

	log.Println("开始创建测试数据...")

	// 1. 创建用户（更多用户）
	users := createUsers(db, 20)
	log.Printf("创建了 %d 个用户", len(users))

	// 2. 创建无人机（更多分布在各个城市）
	drones := createDrones(db, users, 50)
	log.Printf("创建了 %d 架无人机", len(drones))

	// 3. 创建租赁供给
	offers := createOffers(db, drones, 60)
	log.Printf("创建了 %d 个供给", len(offers))

	// 4. 创建租赁需求
	demands := createDemands(db, users, 30)
	log.Printf("创建了 %d 个需求", len(demands))

	log.Println("测试数据创建完成！")
}

func createUsers(db *gorm.DB, count int) []model.User {
	passwordHash, _ := bcrypt.GenerateFromPassword([]byte("123456"), bcrypt.DefaultCost)

	prefixes := []string{"飞行", "航拍", "无人机", "天空", "云端", "飞翔", "翱翔", "御风"}
	suffixes := []string{"大师", "专家", "达人", "爱好者", "玩家", "工作室", "团队", "服务"}

	var users []model.User
	for i := 0; i < count; i++ {
		userType := "renter"
		if i%3 == 0 {
			userType = "drone_owner"
		}

		nickname := fmt.Sprintf("%s%s%d",
			prefixes[rand.Intn(len(prefixes))],
			suffixes[rand.Intn(len(suffixes))],
			rand.Intn(100)+1,
		)

		user := model.User{
			Phone:        fmt.Sprintf("138%08d", 10000000+i),
			PasswordHash: string(passwordHash),
			Nickname:     nickname,
			AvatarURL:    fmt.Sprintf("/uploads/avatar/user_%d.jpg", i+1),
			UserType:     userType,
			IDVerified:   "approved",
			CreditScore:  rand.Intn(50) + 70, // 70-120
			Status:       "active",
		}

		if err := db.Create(&user).Error; err != nil {
			log.Printf("创建用户失败: %v", err)
			continue
		}
		users = append(users, user)
	}
	return users
}

func createDrones(db *gorm.DB, users []model.User, count int) []model.Drone {
	var drones []model.Drone
	var owners []model.User

	// 筛选出无人机所有者
	for _, u := range users {
		if u.UserType == "drone_owner" {
			owners = append(owners, u)
		}
	}

	if len(owners) == 0 {
		log.Println("没有无人机所有者")
		return drones
	}

	for i := 0; i < count; i++ {
		droneModel := droneModels[i%len(droneModels)]
		owner := owners[rand.Intn(len(owners))]
		city := cities[rand.Intn(len(cities))]
		coords := cityCoords[city]

		// 在城市范围内随机生成坐标
		lat := coords[0] + rand.Float64()*(coords[1]-coords[0])
		lng := coords[2] + rand.Float64()*(coords[3]-coords[2])

		// 随机选择3-5个特性
		numFeatures := rand.Intn(3) + 3
		selectedFeatures := make([]string, 0)
		featureCopy := make([]string, len(features))
		copy(featureCopy, features)
		rand.Shuffle(len(featureCopy), func(i, j int) {
			featureCopy[i], featureCopy[j] = featureCopy[j], featureCopy[i]
		})
		for j := 0; j < numFeatures && j < len(featureCopy); j++ {
			selectedFeatures = append(selectedFeatures, featureCopy[j])
		}

		featuresJSON := fmt.Sprintf(`["%s"]`, joinStrings(selectedFeatures, `","`))
		imagesJSON := fmt.Sprintf(`["/uploads/drone/%s_%s.jpg"]`, droneModel.Brand, droneModel.Model)

		// 随机状态（80% available, 15% rented, 5% maintenance）
		status := "available"
		r := rand.Float64()
		if r > 0.95 {
			status = "maintenance"
		} else if r > 0.80 {
			status = "rented"
		}

		drone := model.Drone{
			OwnerID:             owner.ID,
			Brand:               droneModel.Brand,
			Model:               droneModel.Model,
			SerialNumber:        fmt.Sprintf("SN%s%d%06d", droneModel.Brand, i, rand.Intn(1000000)),
			MaxLoad:             droneModel.Load,
			MaxFlightTime:       droneModel.Time,
			MaxDistance:         droneModel.Distance,
			Features:            model.JSON(featuresJSON),
			Images:              model.JSON(imagesJSON),
			CertificationStatus: "approved",
			DailyPrice:          droneModel.Daily,
			HourlyPrice:         droneModel.Hourly,
			Deposit:             droneModel.Deposit,
			Latitude:            lat,
			Longitude:           lng,
			Address:             fmt.Sprintf("%s市某区某街道%d号", city, rand.Intn(999)+1),
			City:                city,
			AvailabilityStatus:  status,
			Rating:              4.0 + rand.Float64(),
			OrderCount:          rand.Intn(50),
			Description:         fmt.Sprintf("专业%s，性能优异，适合多种场景使用。", droneModel.Model),
		}

		if err := db.Create(&drone).Error; err != nil {
			log.Printf("创建无人机失败: %v", err)
			continue
		}
		drones = append(drones, drone)
	}
	return drones
}

func createOffers(db *gorm.DB, drones []model.Drone, count int) []model.RentalOffer {
	var offers []model.RentalOffer

	titles := []string{
		"专业航拍服务",
		"农业植保作业",
		"货物配送运输",
		"设备巡检服务",
		"婚礼跟拍录像",
		"地理测绘航拍",
		"影视拍摄服务",
		"应急救援支援",
	}

	for i := 0; i < count && i < len(drones); i++ {
		drone := drones[i]

		// 只有 available 和部分 rented 的无人机创建供给
		if drone.AvailabilityStatus == "maintenance" {
			continue
		}

		serviceType := serviceTypes[rand.Intn(len(serviceTypes))]
		title := titles[rand.Intn(len(titles))]

		// 根据服务类型调整价格
		price := drone.HourlyPrice
		priceType := "hourly"
		if serviceType == "agriculture" || serviceType == "cargo" {
			price = drone.DailyPrice
			priceType = "daily"
		}

		// 80% active, 15% paused, 5% closed
		status := "active"
		r := rand.Float64()
		if r > 0.95 {
			status = "closed"
		} else if r > 0.80 {
			status = "paused"
		}

		offer := model.RentalOffer{
			DroneID:       drone.ID,
			OwnerID:       drone.OwnerID,
			Title:         fmt.Sprintf("%s - %s %s", title, drone.Brand, drone.Model),
			Description:   fmt.Sprintf("提供%s，设备先进，经验丰富，服务周到。", title),
			ServiceType:   serviceType,
			AvailableFrom: time.Now().Add(-24 * time.Hour),
			AvailableTo:   time.Now().Add(24 * time.Hour * 30),
			Latitude:      drone.Latitude,
			Longitude:     drone.Longitude,
			Address:       drone.Address,
			ServiceRadius: float64(rand.Intn(50) + 10), // 10-60公里
			PriceType:     priceType,
			Price:         price,
			Status:        status,
			Views:         rand.Intn(200),
		}

		if err := db.Create(&offer).Error; err != nil {
			log.Printf("创建供给失败: %v", err)
			continue
		}
		offers = append(offers, offer)
	}
	return offers
}

func createDemands(db *gorm.DB, users []model.User, count int) []model.RentalDemand {
	var demands []model.RentalDemand

	demandTitles := []string{
		"需要航拍婚礼现场",
		"农田植保作业需求",
		"工地巡检航拍",
		"活动现场直播",
		"房地产项目航拍",
		"景区宣传片拍摄",
		"物流配送测试",
		"应急搜救协助",
	}

	for i := 0; i < count; i++ {
		user := users[rand.Intn(len(users))]
		city := cities[rand.Intn(len(cities))]
		coords := cityCoords[city]

		lat := coords[0] + rand.Float64()*(coords[1]-coords[0])
		lng := coords[2] + rand.Float64()*(coords[3]-coords[2])

		demandType := serviceTypes[rand.Intn(len(serviceTypes))]
		title := demandTitles[rand.Intn(len(demandTitles))]

		budget := int64(rand.Intn(50000) + 10000) // 100-600元

		status := "open"
		r := rand.Float64()
		if r > 0.85 {
			status = "closed"
		} else if r > 0.70 {
			status = "matched"
		}

		demand := model.RentalDemand{
			RenterID:         user.ID,
			DemandType:       demandType,
			Title:            title,
			Description:      fmt.Sprintf("需要专业的%s服务，具体要求面议。", title),
			RequiredFeatures: model.JSON(`["4K摄像","避障系统"]`),
			RequiredLoad:     rand.Float64() * 10,
			StartTime:        time.Now().Add(24 * time.Hour * time.Duration(rand.Intn(7)+1)),
			EndTime:          time.Now().Add(24 * time.Hour * time.Duration(rand.Intn(7)+8)),
			Latitude:         lat,
			Longitude:        lng,
			Address:          fmt.Sprintf("%s市某区某街道%d号", city, rand.Intn(999)+1),
			BudgetMin:        budget / 2,
			BudgetMax:        budget,
			Status:           status,
		}

		if err := db.Create(&demand).Error; err != nil {
			log.Printf("创建需求失败: %v", err)
			continue
		}
		demands = append(demands, demand)
	}
	return demands
}

func joinStrings(strs []string, sep string) string {
	if len(strs) == 0 {
		return ""
	}
	result := strs[0]
	for i := 1; i < len(strs); i++ {
		result += sep + strs[i]
	}
	return result
}
