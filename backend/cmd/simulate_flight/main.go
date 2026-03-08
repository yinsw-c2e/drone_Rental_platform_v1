package main

import (
	"flag"
	"fmt"
	"log"
	"math"
	"math/rand"
	"strings"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

var defaultStart = [2]float64{23.0272917, 113.1243033} // 取货点
var defaultEnd = [2]float64{23.0189895, 113.1356922}   // 送货点

func main() {
	orderID := flag.Int64("order", 9, "要模拟的订单ID")
	droneID := flag.Int64("drone", 18, "无人机ID")
	pilotID := flag.Int64("pilot", 5, "飞手ID")
	steps := flag.Int("steps", 20, "总步数（位置点数量）")
	interval := flag.Int("interval", 3, "每步间隔秒数")
	flag.Parse()

	dsn := "root:root@tcp(127.0.0.1:3306)/wurenji?charset=utf8mb4&parseTime=True&loc=Local"
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}

	// 检查订单状态，必须是 in_transit（运输中）才能模拟飞行数据
	var orderStatus string
	row := db.Raw("SELECT status FROM orders WHERE id = ?", *orderID).Row()
	if err := row.Scan(&orderStatus); err != nil {
		log.Fatalf("订单 %d 不存在: %v", *orderID, err)
	}
	if orderStatus != "in_transit" {
		fmt.Printf("❌ 订单当前状态为 [%s]，只有状态为 in_transit（运输中）才能模拟飞行\n", orderStatus)
		fmt.Println("请先在 App 中将任务执行进度推进到 '开始运输' 步骤")
		return
	}
	fmt.Printf("✅ 订单状态确认: %s，开始模拟飞行...\n", orderStatus)

	startLat, startLng := defaultStart[0], defaultStart[1]
	endLat, endLng := defaultEnd[0], defaultEnd[1]

	fmt.Printf("开始模拟飞行 orderID=%d, 共%d步, 每步%d秒\n", *orderID, *steps, *interval)
	fmt.Printf("起点: %.6f, %.6f\n", startLat, startLng)
	fmt.Printf("终点: %.6f, %.6f\n\n", endLat, endLng)

	for i := 0; i <= *steps; i++ {
		// 线性插值计算当前位置
		t := float64(i) / float64(*steps)
		lat := startLat + (endLat-startLat)*t
		lng := startLng + (endLng-startLng)*t

		// 加一点随机抖动模拟真实GPS
		lat += (rand.Float64() - 0.5) * 0.0002
		lng += (rand.Float64() - 0.5) * 0.0002

		// 模拟飞行高度：起飞爬升→巡航→降落
		var altitude float64
		if t < 0.1 {
			altitude = t / 0.1 * 120 // 爬升到120m
		} else if t > 0.9 {
			altitude = (1 - t) / 0.1 * 120 // 降落
		} else {
			altitude = 120 + (rand.Float64()-0.5)*5 // 巡航±5m抖动
		}

		// 模拟电量消耗
		battery := int64(100 - int(t*30) - rand.Intn(3))

		// 计算朝向（从起点到终点的方向）
		dLat := endLat - startLat
		dLng := endLng - startLng
		heading := math.Atan2(dLng, dLat) * 180 / math.Pi
		if heading < 0 {
			heading += 360
		}

		// 速度：巡航15m/s，起降时较慢
		speed := int64(15)
		if t < 0.1 || t > 0.9 {
			speed = 5
		}

		now := time.Now()
		sql := fmt.Sprintf(`INSERT INTO flight_positions 
			(order_id, drone_id, pilot_id, latitude, longitude, altitude, speed, heading, 
			 battery_level, signal_strength, gps_satellites, temperature, wind_speed, recorded_at, created_at)
			VALUES (%d, %d, %d, %.7f, %.7f, %d, %d, %d, %d, %d, %d, %d, %d, '%s', '%s')`,
			*orderID, *droneID, *pilotID,
			lat, lng,
			int64(altitude), speed, int64(heading),
			battery, int64(85+rand.Intn(15)),
			int64(8+rand.Intn(4)),
			int64(25+rand.Intn(5)),
			int64(3+rand.Intn(3)),
			now.Format("2006-01-02 15:04:05.000"),
			now.Format("2006-01-02 15:04:05.000"),
		)

		if err := db.Exec(sql).Error; err != nil {
			log.Printf("第%d步插入失败: %v", i, err)
		} else {
			progress := strings.Repeat("█", i*20/(*steps)) + strings.Repeat("░", 20-i*20/(*steps))
			fmt.Printf("\r[%s] %d/%d  坐标:(%.5f,%.5f) 高度:%.0fm 电量:%d%%",
				progress, i, *steps, lat, lng, altitude, battery)
		}

		if i < *steps {
			time.Sleep(time.Duration(*interval) * time.Second)
		}
	}

	// 飞行结束，自动更新订单状态为 delivered（已送达）
	if err := db.Exec("UPDATE orders SET status='delivered', updated_at=NOW() WHERE id=?", *orderID).Error; err != nil {
		log.Printf("更新订单状态失败: %v", err)
	} else {
		fmt.Println("\n✅ 订单状态已自动更新为: delivered（已送达）")
	}
	fmt.Printf("\n模拟飞行完成！共插入 %d 条位置数据\n", *steps+1)
}
