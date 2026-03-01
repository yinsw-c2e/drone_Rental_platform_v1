# 开发模式模拟数据管理指南

## 📋 概述

本目录包含开发模式下使用的模拟数据配置文件。**所有模拟数据必须来自数据库中实际存在的记录**,确保开发环境与生产环境的数据结构一致性。

## 📂 文件说明

### `mockData.ts`
包含从数据库提取的真实数据,用于开发模式的fallback场景:
- 默认位置坐标(来自真实无人机位置)
- 附近无人机列表(来自数据库真实记录)
- 用户信息(来自数据库真实用户)

## 🔄 数据同步流程

### 1. 从数据库提取最新数据

```bash
# 进入后端目录
cd /path/to/backend

# 查询可用无人机数据
docker exec wurenji-mysql mysql -uroot -proot -D wurenji -e "
SELECT d.id, d.brand, d.model, d.latitude, d.longitude, 
       d.address, d.city, d.daily_price, d.rating, 
       u.nickname, u.avatar_url
FROM drones d 
LEFT JOIN users u ON d.owner_id = u.id
WHERE d.availability_status='available' 
  AND d.certification_status='approved' 
ORDER BY d.id 
LIMIT 10;
" 2>&1 | grep -v "Using a password"
```

### 2. 通过API获取完整数据结构

```bash
# 1. 登录获取Token
TOKEN=$(curl -s http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800000002","password":"password123"}' \
  | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

# 2. 获取附近无人机数据
curl -s "http://localhost:8080/api/v1/drone/nearby?lat=39.9088&lng=116.3975&radius=50" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool > nearby_drones_response.json

# 3. 从响应中提取data.list部分更新到mockData.ts
```

### 3. 更新mockData.ts文件

1. 打开 `mockData.ts`
2. 更新 `MOCK_NEARBY_DRONES` 数组,使用从API获取的最新数据
3. 更新 `DEV_DEFAULT_LOCATION`,使用数据库中真实的无人机位置
4. 在文件顶部注释中更新"更新时间"

### 4. 验证数据一致性

```typescript
// 在组件中测试
const testDataConsistency = async () => {
  const mockDrone = MOCK_NEARBY_DRONES[0];
  const realDrone = await droneService.getById(mockDrone.id);
  
  console.log('Mock Data:', mockDrone);
  console.log('Real Data:', realDrone);
  // 对比字段结构是否一致
};
```

## 📍 可用的模拟位置

### 北京区域
- **朝阳区三里屯**: 39.90882, 116.39747 (ID=1, 大疆Mavic 3)
- **东城区王府井**: 39.91514, 116.40396 (ID=2, 大疆Air 2S)

### 上海区域
- **黄浦区外滩**: 31.23039, 121.47370 (ID=3, 大疆Mini 3 Pro)

### 深圳区域
- **福田区**: 22.54310, 114.05787 (ID=5, 大疆Inspire 2)

### 杭州区域
- **西湖区**: 30.27409, 120.15507 (ID=7, 大疆Agras T30)

## 🎯 使用场景

### 场景1: 定位失败的fallback

```typescript
import {DEV_DEFAULT_LOCATION} from '../config/mockData';

try {
  const position = await getCurrentPosition();
  return position;
} catch (error) {
  if (__DEV__) {
    console.warn('[DEV] 使用数据库真实坐标');
    return DEV_DEFAULT_LOCATION;
  }
  throw error;
}
```

### 场景2: API失败的fallback

```typescript
import {MOCK_NEARBY_DRONES} from '../config/mockData';

try {
  const res = await droneService.nearby(lat, lng, radius);
  return res.data.list;
} catch (error) {
  if (__DEV__) {
    console.warn('[DEV] API失败，使用数据库模拟数据');
    return MOCK_NEARBY_DRONES;
  }
  throw error;
}
```

### 场景3: 离线开发模式

```typescript
const OFFLINE_DEV_MODE = __DEV__ && !navigator.onLine;

if (OFFLINE_DEV_MODE) {
  // 完全使用本地模拟数据,不依赖后端
  setDrones(MOCK_NEARBY_DRONES);
  setLocation(DEV_DEFAULT_LOCATION);
}
```

## ⚠️ 注意事项

### ✅ 正确做法
1. 定期同步数据库数据到mockData.ts
2. 使用数据库中真实存在的ID、坐标、用户信息
3. 保持模拟数据的数据结构与API响应完全一致
4. 在代码中明确标注 `[DEV]` 前缀
5. 仅在开发模式 (`__DEV__`) 使用模拟数据

### ❌ 错误做法
1. ❌ 虚构不存在的数据ID、坐标
2. ❌ 使用与生产环境不一致的数据结构
3. ❌ 在生产环境使用模拟数据
4. ❌ 长期不更新导致模拟数据过时
5. ❌ 硬编码模拟数据到组件中(应集中管理)

## 🔍 数据验证检查清单

- [ ] 所有无人机ID在数据库中存在
- [ ] 坐标数据与数据库一致(小数点精度相同)
- [ ] 用户信息(owner)来自真实用户表
- [ ] 价格、评分等数值与数据库匹配
- [ ] 数据结构与API响应格式完全一致
- [ ] 更新时间标注在文件头部
- [ ] 所有fallback逻辑只在 `__DEV__` 模式生效

## 📊 定期维护计划

| 维护项 | 频率 | 负责人 |
|--------|------|--------|
| 同步数据库数据 | 每月1次 | 开发团队 |
| 验证数据一致性 | 每次发版前 | QA团队 |
| 清理过期数据 | 每季度1次 | 开发团队 |
| 更新文档说明 | 按需更新 | 开发团队 |

## 🚀 自动化脚本(待实现)

```bash
#!/bin/bash
# scripts/sync-mock-data.sh
# 自动从数据库同步最新数据到mockData.ts

# 1. 查询数据库
# 2. 调用API获取完整结构
# 3. 格式化为TypeScript代码
# 4. 更新mockData.ts文件
# 5. 运行类型检查
```

## 📚 相关文档

- [开发/生产模式差异化处理规范](../../docs/dev-prod-mode.md)
- [LBS附近无人机功能分析](../LOCATION_FEATURE_ANALYSIS.md)
- [API接口文档](../../../backend/docs/api.md)

---

**最后更新**: 2026-03-01  
**维护人员**: 开发团队
