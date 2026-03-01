# "附近无人机"功能完整实现分析

## 📋 功能概述

"附近无人机"功能基于用户当前地理位置,查询并展示附近可用的无人机列表。整个功能链路包括:前端定位获取 → 坐标转换 → 后端距离计算 → 数据筛选排序 → 结果展示。

---

## 🔄 完整数据流程

```
用户打开"附近无人机"页面
    ↓
移动端调用 LocationService.getCurrentPosition()
    ↓
请求系统定位权限(iOS/Android)
    ↓
获取GPS原始坐标(WGS-84)
    ↓
转换为高德坐标系(GCJ-02)
    ↓
调用后端API: GET /api/v1/drone/nearby?lat={lat}&lng={lng}&radius={radius}
    ↓
后端使用Haversine公式计算距离
    ↓
筛选: availability_status=available, certification_status=approved
    ↓
按距离排序并分页返回
    ↓
前端渲染列表展示
```

---

## 📱 1. 移动端定位实现

### 1.1 LocationService 核心功能

**文件**: `mobile/src/utils/LocationService.ts`

#### 权限处理
```typescript
// Android: 动态请求权限
PermissionsAndroid.request(
  PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
)

// iOS: 触发系统权限弹窗(带3秒超时保护)
Geolocation.requestAuthorization()
```

#### 获取当前位置
```typescript
export async function getCurrentPosition(): Promise<LocationCoords> {
  // 1. 请求权限
  const hasPermission = await requestPermission();
  
  // 2. 获取GPS坐标(WGS-84)
  Geolocation.getCurrentPosition(
    position => {
      // 3. 转换为高德坐标系(GCJ-02)
      const gcj02 = wgs84ToGcj02(
        position.coords.longitude,
        position.coords.latitude
      );
      resolve(gcj02);
    },
    error => reject(error),
    {enableHighAccuracy: false, timeout: 10000, maximumAge: 60000}
  );
}
```

#### 坐标转换算法
**WGS-84 → GCJ-02 转换**

- **WGS-84**: GPS设备返回的国际标准坐标系
- **GCJ-02**: 中国国家测绘局要求的加密坐标系(火星坐标系)
- **转换原因**: 高德地图、后端距离计算都使用GCJ-02坐标系

```typescript
// Haversine变换 + 中国特定偏移算法
export function wgs84ToGcj02(wgsLng: number, wgsLat: number): LocationCoords {
  if (outOfChina(wgsLng, wgsLat)) {
    return {longitude: wgsLng, latitude: wgsLat};
  }
  // 应用偏移算法...
}
```

### 1.2 权限配置

#### iOS (Info.plist)
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>需要获取您的位置以推荐附近的无人机服务和完成配送定位</string>
```

#### Android (AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

---

## 🎯 2. NearbyDronesScreen 实现逻辑

**文件**: `mobile/src/screens/drone/NearbyDronesScreen.tsx`

### 2.1 核心功能

#### 开发模式 vs 生产模式
```typescript
const DEV_MODE = __DEV__;
const DEV_DEFAULT_COORDS = {
  latitude: 23.129163,   // 广州市中心
  longitude: 113.264435,
};

// 开发模式: 定位失败时使用模拟坐标,不影响开发体验
// 生产模式: 定位失败时提示用户并提供重试选项
```

#### 获取用户位置
```typescript
const getUserLocation = async (): Promise<{lat: number; lng: number}> => {
  try {
    // 尝试获取真实位置
    const position = await getCurrentPosition();
    return {lat: position.latitude, lng: position.longitude};
  } catch (error) {
    // 开发模式: fallback到模拟坐标
    if (DEV_MODE) {
      console.warn('[DEV] 使用模拟坐标');
      return DEV_DEFAULT_COORDS;
    }
    // 生产模式: 抛出错误给用户
    throw error;
  }
};
```

#### 查询附近无人机
```typescript
const fetchDrones = async () => {
  // 1. 获取当前位置
  const location = await getUserLocation();
  
  // 2. 调用后端API(默认半径50公里)
  const res = await droneService.nearby(location.lat, location.lng, 50);
  
  // 3. 更新UI状态
  setDrones(res.data?.list || []);
};
```

### 2.2 用户体验优化

1. **下拉刷新**: 支持手动刷新无人机列表
2. **定位状态显示**: 开发模式显示当前坐标,方便调试
3. **错误处理**: 
   - 开发环境: 静默fallback,不干扰开发
   - 生产环境: 明确提示并提供重试按钮
4. **空状态处理**: 区分"搜索中"、"定位失败"、"无数据"三种状态

---

## 🔧 3. 后端API实现

### 3.1 API端点

**路由**: `GET /api/v1/drone/nearby`

**参数**:
- `lat`: 纬度 (必需)
- `lng`: 经度 (必需)
- `radius`: 搜索半径(公里),默认50
- `page`: 页码,默认1
- `page_size`: 每页数量,默认20

**Handler**: `backend/internal/api/v1/drone/handler.go`
```go
func (h *Handler) Nearby(c *gin.Context) {
    lat, _ := strconv.ParseFloat(c.Query("lat"), 64)
    lng, _ := strconv.ParseFloat(c.Query("lng"), 64)
    radius, _ := strconv.ParseFloat(c.DefaultQuery("radius", "50"), 64)
    
    drones, total, err := h.droneService.FindNearby(lat, lng, radius, page, pageSize)
    response.SuccessWithPage(c, drones, total, page, pageSize)
}
```

### 3.2 Service层

**文件**: `backend/internal/service/drone_service.go`
```go
func (s *DroneService) FindNearby(lat, lng, radius float64, page, pageSize int) ([]model.Drone, int64, error) {
    if radius <= 0 {
        radius = 50 // 默认50公里
    }
    return s.droneRepo.FindNearby(lat, lng, radius, page, pageSize)
}
```

### 3.3 Repository层 - 距离计算

**文件**: `backend/internal/repository/drone_repo.go`

#### Haversine公式计算球面距离
```go
func (r *DroneRepo) FindNearby(lat, lng, radiusKM float64, page, pageSize int) ([]model.Drone, int64, error) {
    // Haversine公式: 计算地球表面两点间的大圆距离
    distanceExpr := `(6371 * acos(
        cos(radians(?)) * cos(radians(latitude)) * 
        cos(radians(longitude) - radians(?)) + 
        sin(radians(?)) * sin(radians(latitude))
    ))`
    
    query := r.db.Model(&model.Drone{}).
        Where("availability_status = ?", "available").           // 可用状态
        Where("certification_status = ?", "approved").            // 已认证
        Where(distanceExpr+" < ?", lat, lng, lat, radiusKM).    // 距离过滤
        Select("*, "+distanceExpr+" AS distance", lat, lng, lat). // 计算distance字段
        Order("distance ASC").                                     // 按距离排序
        Offset((page - 1) * pageSize).
        Limit(pageSize).
        Preload("Owner").
        Find(&drones)
}
```

**Haversine公式说明**:
- **R = 6371**: 地球半径(公里)
- **dLat, dLon**: 两点纬度差、经度差(弧度)
- **a**: 半正矢公式中间值
- **c**: 角距离
- **distance = R * c**: 实际球面距离

### 3.4 数据模型

**文件**: `backend/internal/model/models.go`
```go
type Drone struct {
    ID                  int64
    Latitude            float64  `gorm:"type:decimal(10,7)"`  // 纬度(7位小数 ≈ 1cm精度)
    Longitude           float64  `gorm:"type:decimal(10,7)"`  // 经度
    Address             string
    City                string
    AvailabilityStatus  string   // available, rented, maintenance, offline
    CertificationStatus string   // pending, approved, rejected
    Rating              float64
    DailyPrice          int64    // 单位:分
    // ...其他字段
}
```

---

## 🗺️ 4. 高德地图集成

### 4.1 后端高德API服务

**文件**: `backend/internal/pkg/amap/amap.go`

#### 周边POI搜索(用于地图选点功能)
```go
func (s *AmapService) SearchNearby(longitude, latitude float64, radius int, keyword string, page, pageSize int) ([]POIResult, int, error) {
    // 调用高德API: https://restapi.amap.com/v3/place/around
    // 返回周边兴趣点(POI)数据
}
```

#### 逆地理编码(坐标→地址)
```go
func (s *AmapService) ReverseGeoCode(longitude, latitude float64) (*ReverseGeoResult, error) {
    // 调用高德API: https://restapi.amap.com/v3/geocode/regeo
    // 将坐标转换为可读地址
}
```

### 4.2 移动端高德SDK

**iOS配置** (`mobile/ios/Podfile`):
```ruby
pod 'AMap3DMap', '~> 9.6'
pod 'AMapFoundation', '~> 1.7'
```

**初始化** (`mobile/ios/WurenjiMobile/AppDelegate.swift`):
```swift
// 隐私合规
MAMapView.updatePrivacyShow(.didShow, privacyInfo: .didContain)
MAMapView.updatePrivacyAgree(.didAgree)

// SDK初始化
AMapServices.shared().enableHTTPS = true  // 必须启用HTTPS
AMapServices.shared().apiKey = amapKey
```

---

## 🔐 5. 权限与安全

### 5.1 定位权限流程

```
应用启动
    ↓
首次使用定位功能时触发权限请求
    ↓
iOS: 显示系统弹窗(Info.plist配置的描述)
Android: 运行时动态请求(PermissionsAndroid)
    ↓
用户选择"允许"/"拒绝"
    ↓
权限结果返回给应用
    ↓
如果被拒绝:
  - 开发模式: 使用模拟坐标
  - 生产模式: 提示用户并引导到设置
```

### 5.2 数据脱敏

- **坐标精度**: 数据库存储7位小数(约1cm精度),但前端显示时可截断到4位(约11m精度)
- **用户隐私**: 不暴露无人机主的精确地址,只显示城市或区域

---

## 🚀 6. 性能优化

### 6.1 数据库优化

1. **索引策略**:
   ```sql
   CREATE INDEX idx_drones_city ON drones(city);
   CREATE INDEX idx_drones_availability ON drones(availability_status);
   CREATE INDEX idx_drones_certification ON drones(certification_status);
   ```

2. **空间索引**: MySQL 8.0+ 支持空间索引(SPATIAL INDEX),可进一步优化地理查询
   ```sql
   -- 可选的高级优化
   ALTER TABLE drones ADD COLUMN location POINT;
   CREATE SPATIAL INDEX idx_location ON drones(location);
   ```

### 6.2 缓存策略

**移动端缓存**:
```typescript
// getCurrentPosition配置
{
  enableHighAccuracy: false,  // 使用网络定位(更快)
  timeout: 10000,             // 10秒超时
  maximumAge: 60000           // 缓存60秒(避免频繁定位)
}
```

**后端缓存**:
- 对于热门区域,可使用Redis缓存查询结果(TTL 5-10分钟)
- 缓存Key: `nearby:drones:{lat}:{lng}:{radius}`

### 6.3 前端优化

1. **列表虚拟化**: 使用FlatList自动实现虚拟滚动
2. **图片懒加载**: 无人机图片按需加载
3. **防抖/节流**: 下拉刷新时防止重复请求

---

## 🧪 7. 测试建议

### 7.1 单元测试

**坐标转换测试**:
```typescript
describe('wgs84ToGcj02', () => {
  it('should convert Beijing coords correctly', () => {
    const result = wgs84ToGcj02(116.391, 39.906);
    expect(result.latitude).toBeCloseTo(39.907, 3);
    expect(result.longitude).toBeCloseTo(116.397, 3);
  });
});
```

**Haversine公式测试**:
```go
func TestHaversine(t *testing.T) {
    // 北京天安门 -> 上海外滩 ≈ 1067km
    dist := haversine(39.906, 116.391, 31.234, 121.474)
    assert.InDelta(t, 1067.0, dist, 10.0)
}
```

### 7.2 集成测试

1. **权限测试**: 模拟拒绝权限场景
2. **定位失败**: 模拟GPS不可用、超时等场景
3. **网络异常**: 测试API调用失败时的fallback逻辑
4. **边界条件**: 
   - 南北极附近坐标
   - 180°经度附近(日期变更线)
   - 超大半径(>1000km)

---

## 🐛 8. 常见问题排查

### 8.1 定位失败

**问题**: iOS定位一直失败
- ✅ 检查Info.plist是否配置`NSLocationWhenInUseUsageDescription`
- ✅ 确认用户已授予"使用时允许"权限
- ✅ 检查设备"设置 > 隐私 > 定位服务"是否开启

**问题**: Android定位Permission Denied
- ✅ 检查AndroidManifest.xml权限声明
- ✅ 确认运行时动态请求权限的代码正确执行
- ✅ targetSdkVersion >= 23时必须动态请求

### 8.2 坐标不准确

**问题**: 地图上显示的位置偏移
- ✅ 确认是否正确进行了WGS-84 → GCJ-02转换
- ✅ 检查高德SDK是否启用HTTPS(`enableHTTPS = true`)
- ✅ 验证后端数据库存储的坐标系是否一致

### 8.3 查询无结果

**问题**: 明明附近有无人机,却查询为空
- ✅ 检查无人机的`availability_status`和`certification_status`字段
- ✅ 确认搜索半径是否过小
- ✅ 验证坐标数据是否有效(非0,0或null)
- ✅ 检查数据库Haversine计算是否正确

### 8.4 后端SSL证书错误

**问题**: `request failed: tls: failed to verify certificate`
- ✅ 参考之前的修复:为HTTP客户端配置TLS(已修复)
- ✅ 确认系统证书是否有效
- ✅ 检查Go版本是否支持最新TLS协议

---

## 📊 9. 数据流示例

### 完整请求示例

**前端调用**:
```typescript
const res = await droneService.nearby(23.129163, 113.264435, 50);
```

**HTTP请求**:
```
GET /api/v1/drone/nearby?lat=23.129163&lng=113.264435&radius=50&page=1&page_size=20
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**SQL查询** (简化):
```sql
SELECT *, 
  (6371 * acos(
    cos(radians(23.129163)) * cos(radians(latitude)) * 
    cos(radians(longitude) - radians(113.264435)) + 
    sin(radians(23.129163)) * sin(radians(latitude))
  )) AS distance
FROM drones
WHERE availability_status = 'available'
  AND certification_status = 'approved'
  AND distance < 50
ORDER BY distance ASC
LIMIT 20 OFFSET 0;
```

**响应数据**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [
      {
        "id": 1,
        "brand": "DJI",
        "model": "Mavic 3",
        "latitude": 23.130000,
        "longitude": 113.265000,
        "daily_price": 50000,  // 500元(单位:分)
        "rating": 4.8,
        "address": "广州市越秀区中山路1号",
        "owner": {
          "id": 2,
          "nickname": "测试用户A"
        }
      }
      // ...更多无人机
    ],
    "total": 15,
    "page": 1,
    "page_size": 20
  }
}
```

---

## ✅ 10. 优化建议总结

### 已实现 ✅
1. ✅ WGS-84 → GCJ-02坐标转换
2. ✅ 双端权限请求与处理
3. ✅ 后端Haversine距离计算
4. ✅ 开发/生产模式区分
5. ✅ 定位失败fallback机制
6. ✅ 下拉刷新与空状态处理
7. ✅ 后端SSL/TLS配置修复

### 待优化 🚀
1. **Redis缓存**: 热门区域查询结果缓存
2. **空间索引**: MySQL SPATIAL INDEX优化地理查询
3. **实时更新**: WebSocket推送附近无人机状态变化
4. **智能推荐**: 基于用户历史偏好调整排序权重
5. **地图视图**: 在地图上直观显示附近无人机(已有基础地图组件)
6. **筛选功能**: 按价格、载重、续航时间等条件筛选

---

## 📚 参考资料

1. **坐标系转换**: [WGS84与GCJ02坐标转换算法](https://github.com/wandergis/coordtransform)
2. **Haversine公式**: [维基百科 - Haversine formula](https://en.wikipedia.org/wiki/Haversine_formula)
3. **高德地图API**: [高德开放平台 - Web服务API](https://lbs.amap.com/api/webservice/summary)
4. **React Native Geolocation**: [@react-native-community/geolocation](https://github.com/react-native-geolocation/react-native-geolocation)
5. **高德地图SDK**: [高德地图iOS SDK](https://lbs.amap.com/api/ios-sdk/summary/)

---

## 📝 总结

"附近无人机"功能是一个典型的LBS(Location Based Service)应用场景,涉及:

1. **前端定位**: React Native Geolocation + 坐标转换
2. **后端计算**: Haversine公式 + SQL地理查询
3. **地图集成**: 高德地图SDK/API
4. **用户体验**: 权限引导、错误处理、状态反馈

当前实现已覆盖核心功能,开发模式下支持模拟数据,生产环境使用真实定位,整个链路完整且健壮。
