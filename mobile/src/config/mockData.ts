/**
 * 开发模式模拟数据配置
 * 
 * 重要：所有模拟数据必须来自数据库中实际存在的记录
 * 数据来源：wurenji数据库的真实数据
 * 更新时间：2026-03-01
 */

// ============================================================
// 模拟位置坐标（来自数据库中真实的无人机位置）
// ============================================================

/**
 * 默认开发位置：北京市朝阳区三里屯
 * 数据来源：drones表 ID=1 (大疆 Mavic 3)
 */
export const DEV_DEFAULT_LOCATION = {
  latitude: 39.90882,
  longitude: 116.39747,
  city: '北京',
  address: '北京市朝阳区三里屯',
};

/**
 * 可选的开发位置列表（来自数据库中不同城市的真实无人机位置）
 */
export const DEV_LOCATION_PRESETS = [
  {
    name: '北京-朝阳区',
    latitude: 39.90882,
    longitude: 116.39747,
    description: '数据库ID=1, 大疆Mavic 3位置',
  },
  {
    name: '北京-东城区',
    latitude: 39.91514,
    longitude: 116.40396,
    description: '数据库ID=2, 大疆Air 2S位置',
  },
  {
    name: '上海-黄浦区',
    latitude: 31.23039,
    longitude: 121.47370,
    description: '数据库ID=3, 大疆Mini 3 Pro位置',
  },
  {
    name: '深圳-福田区',
    latitude: 22.54310,
    longitude: 114.05787,
    description: '数据库ID=5, 大疆Inspire 2位置',
  },
  {
    name: '杭州-西湖区',
    latitude: 30.27409,
    longitude: 120.15507,
    description: '数据库ID=7, 大疆Agras T30位置',
  },
];

// ============================================================
// 模拟无人机数据（API返回格式的真实数据）
// ============================================================

/**
 * 附近无人机模拟数据
 * 数据来源：通过API GET /api/v1/drone/nearby 实际返回的数据
 * 使用场景：当后端API不可用时的fallback数据
 */
export const MOCK_NEARBY_DRONES = [
  {
    id: 1,
    owner_id: 2,
    brand: '大疆',
    model: 'Mavic 3',
    serial_number: 'DJI-MV3-001',
    max_load: 5.5,
    max_flight_time: 46,
    max_distance: 30,
    features: ['4K摄像', '智能避障', '长续航'],
    images: [
      'https://picsum.photos/400/300?random=10',
      'https://picsum.photos/400/300?random=11',
    ],
    certification_status: 'approved',
    daily_price: 50000,
    hourly_price: 8000,
    deposit: 100000,
    latitude: 39.90882,
    longitude: 116.39747,
    address: '北京市朝阳区三里屯',
    city: '北京',
    availability_status: 'available',
    rating: 4.8,
    order_count: 15,
    description: '大疆最新旗舰无人机，配备4K摄像头，续航时间长达46分钟',
    owner: {
      id: 2,
      nickname: '测试用户A',
      avatar_url: 'https://picsum.photos/200?random=1',
      user_type: 'drone_owner',
      credit_score: 95,
    },
  },
  {
    id: 2,
    owner_id: 2,
    brand: '大疆',
    model: 'Air 2S',
    serial_number: 'DJI-A2S-002',
    max_load: 3.2,
    max_flight_time: 31,
    max_distance: 18.5,
    features: ['5.4K视频', '一键智能拍摄'],
    images: [
      'https://picsum.photos/400/300?random=12',
      'https://picsum.photos/400/300?random=13',
    ],
    certification_status: 'approved',
    daily_price: 35000,
    hourly_price: 6000,
    deposit: 70000,
    latitude: 39.91514,
    longitude: 116.40396,
    address: '北京市东城区王府井',
    city: '北京',
    availability_status: 'available',
    rating: 4.6,
    order_count: 8,
    description: '轻便便携，专业航拍利器',
    owner: {
      id: 2,
      nickname: '测试用户A',
      avatar_url: 'https://picsum.photos/200?random=1',
      user_type: 'drone_owner',
      credit_score: 95,
    },
  },
  {
    id: 3,
    owner_id: 3,
    brand: '大疆',
    model: 'Mini 3 Pro',
    serial_number: 'DJI-M3P-003',
    max_load: 2.1,
    max_flight_time: 34,
    max_distance: 25,
    features: ['轻便折叠', 'HDR拍摄'],
    images: [
      'https://picsum.photos/400/300?random=14',
      'https://picsum.photos/400/300?random=15',
    ],
    certification_status: 'approved',
    daily_price: 25000,
    hourly_price: 4000,
    deposit: 50000,
    latitude: 31.23039,
    longitude: 121.47370,
    address: '上海市黄浦区外滩',
    city: '上海',
    availability_status: 'available',
    rating: 4.9,
    order_count: 22,
    description: '口袋大小，旅行必备',
    owner: {
      id: 3,
      nickname: '测试用户B',
      avatar_url: 'https://picsum.photos/200?random=2',
      user_type: 'drone_owner',
      credit_score: 88,
    },
  },
];

// ============================================================
// 使用指南
// ============================================================

/**
 * 如何在组件中使用：
 * 
 * import { DEV_DEFAULT_LOCATION, MOCK_NEARBY_DRONES } from '../config/mockData';
 * 
 * // 1. 开发模式定位fallback
 * const location = __DEV__ && !realLocation 
 *   ? DEV_DEFAULT_LOCATION 
 *   : realLocation;
 * 
 * // 2. API失败时的fallback数据
 * try {
 *   const res = await api.get('/drone/nearby');
 *   setDrones(res.data.list);
 * } catch (error) {
 *   if (__DEV__) {
 *     console.warn('[DEV] API失败，使用数据库模拟数据');
 *     setDrones(MOCK_NEARBY_DRONES);
 *   }
 * }
 * 
 * 注意事项：
 * - 所有模拟数据必须定期与数据库同步
 * - 生产环境不应使用任何模拟数据
 * - 模拟数据仅用于开发调试，不影响生产逻辑
 */
