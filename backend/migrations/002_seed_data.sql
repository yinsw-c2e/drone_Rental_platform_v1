-- 无人机租赁平台测试数据
-- Database: wurenji

USE wurenji;

-- 清空现有数据（可选）
DELETE FROM admin_logs;
DELETE FROM matching_records;
DELETE FROM reviews;
DELETE FROM messages;
DELETE FROM payments;
DELETE FROM order_timelines;
DELETE FROM orders;
DELETE FROM cargo_demands;
DELETE FROM rental_demands;
DELETE FROM rental_offers;
DELETE FROM drones;
DELETE FROM users;
DELETE FROM system_configs;

-- 1. 插入用户数据
-- 密码都是: password123 (bcrypt加密后)
-- 注意：以下手机号均为虚拟测试号码，非真实用户
INSERT INTO users (id, phone, password_hash, nickname, avatar_url, user_type, id_verified, credit_score, status, created_at, updated_at) VALUES
(1, '13800000001', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '系统管理员', '', 'admin', 'approved', 100, 'active', NOW(), NOW()),
(2, '13800000002', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '测试用户A', 'https://picsum.photos/200?random=1', 'drone_owner', 'approved', 95, 'active', NOW(), NOW()),
(3, '13800000003', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '测试用户B', 'https://picsum.photos/200?random=2', 'drone_owner', 'approved', 98, 'active', NOW(), NOW()),
(4, '13800000004', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '测试用户C', 'https://picsum.photos/200?random=3', 'renter', 'approved', 92, 'active', NOW(), NOW()),
(5, '13800000005', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '测试用户D', 'https://picsum.photos/200?random=4', 'renter', 'approved', 88, 'active', NOW(), NOW()),
(6, '13800000006', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '测试用户E', 'https://picsum.photos/200?random=5', 'both', 'pending', 100, 'active', NOW(), NOW()),
(7, '13800000007', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '测试用户F', 'https://picsum.photos/200?random=6', 'drone_owner', 'approved', 96, 'active', NOW(), NOW()),
(8, '13800000008', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '测试用户G', 'https://picsum.photos/200?random=7', 'renter', 'rejected', 85, 'active', NOW(), NOW());

-- 2. 插入无人机数据
INSERT INTO drones (id, owner_id, brand, model, serial_number, max_load, max_flight_time, max_distance, features, images, certification_status, daily_price, hourly_price, deposit, latitude, longitude, address, city, availability_status, rating, order_count, description, created_at, updated_at) VALUES
(1, 2, '大疆', 'Mavic 3', 'DJI-MV3-001', 5.50, 46, 30.00, '["4K摄像", "智能避障", "长续航"]', '["https://picsum.photos/400/300?random=10", "https://picsum.photos/400/300?random=11"]', 'approved', 50000, 8000, 100000, 39.908820, 116.397470, '北京市朝阳区三里屯', '北京', 'available', 4.8, 15, '大疆最新旗舰无人机，配备4K摄像头，续航时间长达46分钟', NOW(), NOW()),
(2, 2, '大疆', 'Air 2S', 'DJI-A2S-002', 3.20, 31, 18.50, '["5.4K视频", "一键智能拍摄"]', '["https://picsum.photos/400/300?random=12", "https://picsum.photos/400/300?random=13"]', 'approved', 35000, 6000, 70000, 39.915140, 116.403960, '北京市东城区王府井', '北京', 'available', 4.6, 8, '轻便便携，专业航拍利器', NOW(), NOW()),
(3, 3, '大疆', 'Mini 3 Pro', 'DJI-M3P-003', 2.00, 34, 12.00, '["轻巧便携", "4K/60fps"]', '["https://picsum.photos/400/300?random=14"]', 'approved', 25000, 4000, 50000, 31.230390, 121.473700, '上海市黄浦区南京东路', '上海', 'available', 4.9, 20, '超轻便折叠设计，随身携带无压力', NOW(), NOW()),
(4, 3, '大疆', 'Phantom 4 Pro', 'DJI-P4P-004', 6.00, 30, 20.00, '["专业航拍", "机械快门"]', '["https://picsum.photos/400/300?random=15", "https://picsum.photos/400/300?random=16"]', 'approved', 45000, 7500, 90000, 31.224360, 121.469170, '上海市浦东新区陆家嘴', '上海', 'rented', 4.7, 12, '专业级航拍无人机，影视制作首选', NOW(), NOW()),
(5, 7, '大疆', 'Inspire 2', 'DJI-INS2-005', 10.00, 27, 25.00, '["双电池系统", "云台相机"]', '["https://picsum.photos/400/300?random=17"]', 'approved', 80000, 12000, 150000, 22.543100, 114.057870, '深圳市南山区科技园', '深圳', 'available', 4.9, 5, '顶级专业航拍平台，支持多种镜头', NOW(), NOW()),
(6, 7, '大疆', 'FPV', 'DJI-FPV-006', 4.00, 20, 16.00, '["沉浸式飞行", "4K/60fps"]', '["https://picsum.photos/400/300?random=18", "https://picsum.photos/400/300?random=19"]', 'pending', 30000, 5000, 60000, 22.547000, 114.085950, '深圳市福田区中心区', '深圳', 'maintenance', 0, 0, '穿越机体验，速度与激情的完美结合', NOW(), NOW()),
(7, 6, '大疆', 'Agras T30', 'DJI-AGR-007', 30.00, 18, 10.00, '["农业植保", "大容量药箱"]', '["https://picsum.photos/400/300?random=20"]', 'approved', 120000, 18000, 200000, 30.274090, 120.155070, '杭州市西湖区文三路', '杭州', 'available', 4.5, 3, '专业农业植保无人机，高效精准', NOW(), NOW());

-- 3. 插入租赁供给数据
INSERT INTO rental_offers (id, drone_id, owner_id, title, description, service_type, available_from, available_to, latitude, longitude, address, service_radius, price_type, price, status, views, created_at, updated_at) VALUES
(1, 1, 2, '大疆Mavic 3 专业航拍服务', '提供专业航拍服务，适合婚礼、活动、地产拍摄等场景', 'aerial_photo', '2026-02-20 08:00:00', '2026-03-20 18:00:00', 39.908820, 116.397470, '北京市朝阳区三里屯', 50.00, 'hourly', 8000, 'active', 156, NOW(), NOW()),
(2, 2, 2, '大疆Air 2S 整机租赁', '便携式专业航拍机，适合旅行拍摄', 'rental', '2026-02-20 00:00:00', '2026-04-20 23:59:59', 39.915140, 116.403960, '北京市东城区王府井', 30.00, 'daily', 35000, 'active', 89, NOW(), NOW()),
(3, 3, 3, 'Mini 3 Pro 轻便航拍', '轻巧便携，新手友好，提供简单培训', 'rental', '2026-02-20 00:00:00', '2026-03-31 23:59:59', 31.230390, 121.473700, '上海市黄浦区南京东路', 40.00, 'daily', 25000, 'active', 234, NOW(), NOW()),
(4, 5, 7, 'Inspire 2 专业影视拍摄', '顶级专业设备，提供操作员服务', 'aerial_photo', '2026-02-20 09:00:00', '2026-04-30 17:00:00', 22.543100, 114.057870, '深圳市南山区科技园', 100.00, 'hourly', 12000, 'active', 67, NOW(), NOW()),
(5, 7, 6, '农业植保服务', '专业农业植保作业，含药剂喷洒', 'agriculture', '2026-03-01 06:00:00', '2026-06-30 19:00:00', 30.274090, 120.155070, '杭州市西湖区文三路', 80.00, 'daily', 120000, 'active', 45, NOW(), NOW());

-- 4. 插入租赁需求数据
INSERT INTO rental_demands (id, renter_id, demand_type, title, description, required_features, required_load, latitude, longitude, address, city, start_time, end_time, budget_min, budget_max, status, urgency, created_at, updated_at) VALUES
(1, 4, 'rental', '寻找航拍无人机拍摄婚礼', '需要在3月15日拍摄婚礼，要求4K以上画质', '["4K摄像", "稳定云台"]', 0, 39.904200, 116.407400, '北京市西城区金融街', '北京', '2026-03-15 14:00:00', '2026-03-15 18:00:00', 20000, 40000, 'active', 'high', NOW(), NOW()),
(2, 5, 'rental', '需要无人机进行地产航拍', '为新楼盘拍摄宣传片，需要专业设备和操作员', '["专业航拍", "高清摄像"]', 0, 31.224360, 121.469170, '上海市浦东新区陆家嘴', '上海', '2026-03-10 09:00:00', '2026-03-10 17:00:00', 50000, 80000, 'active', 'medium', NOW(), NOW()),
(3, 4, 'aerial_photo', '公司年会活动拍摄', '需要航拍记录公司年会活动全程', '["4K摄像", "长续航"]', 0, 22.547000, 114.085950, '深圳市福田区中心区', '深圳', '2026-02-28 15:00:00', '2026-02-28 21:00:00', 30000, 50000, 'active', 'medium', NOW(), NOW()),
(4, 5, 'rental', '旅游航拍需求', '一周海南旅游，需要轻便航拍设备', '["轻巧便携", "防水"]', 0, 20.044220, 110.198280, '海口市龙华区', '海口', '2026-03-20 00:00:00', '2026-03-27 23:59:59', 150000, 200000, 'active', 'low', NOW(), NOW());

-- 5. 插入货运需求数据
INSERT INTO cargo_demands (id, publisher_id, cargo_type, cargo_weight, cargo_size, cargo_description, pickup_latitude, pickup_longitude, pickup_address, delivery_latitude, delivery_longitude, delivery_address, distance, pickup_time, delivery_deadline, offered_price, special_requirements, images, status, created_at, updated_at) VALUES
(1, 4, 'package', 2.50, '{"length": 30, "width": 20, "height": 15}', '医疗样本运输', 39.908820, 116.397470, '北京市朝阳区三里屯', 39.954930, 116.331270, '北京市海淀区中关村', 15.50, '2026-02-25 10:00:00', '2026-02-25 11:30:00', 50000, '温控运输，需要保温箱', '["https://picsum.photos/300?random=30"]', 'active', NOW(), NOW()),
(2, 5, 'equipment', 5.00, '{"length": 50, "width": 40, "height": 30}', '摄影器材配送', 31.230390, 121.473700, '上海市黄浦区南京东路', 31.297950, 121.506380, '上海市宝山区', 22.30, '2026-02-26 14:00:00', '2026-02-26 17:00:00', 80000, '贵重物品，需要保险', '["https://picsum.photos/300?random=31", "https://picsum.photos/300?random=32"]', 'active', NOW(), NOW()),
(3, 4, 'material', 8.00, '{"length": 60, "width": 50, "height": 40}', '建筑材料样品', 22.543100, 114.057870, '深圳市南山区科技园', 22.645280, 114.020980, '深圳市宝安区', 18.80, '2026-03-01 08:00:00', '2026-03-01 12:00:00', 100000, '工地收货', NULL, 'active', NOW(), NOW());

-- 6. 插入订单数据
INSERT INTO orders (id, order_no, order_type, related_id, drone_id, owner_id, renter_id, title, service_type, start_time, end_time, service_latitude, service_longitude, service_address, total_amount, platform_commission_rate, platform_commission, owner_amount, deposit_amount, status, created_at, updated_at) VALUES
(1, 'ORD202602190001', 'rental', 2, 2, 2, 4, '大疆Air 2S 整机租赁', 'rental', '2026-02-25 00:00:00', '2026-02-28 23:59:59', 39.904200, 116.407400, '北京市西城区金融街', 105000, 10.00, 10500, 94500, 70000, 'completed', DATE_SUB(NOW(), INTERVAL 5 DAY), NOW()),
(2, 'ORD202602200002', 'rental_offer', 1, 1, 2, 5, '大疆Mavic 3 专业航拍服务', 'aerial_photo', '2026-02-28 14:00:00', '2026-02-28 18:00:00', 31.224360, 121.469170, '上海市浦东新区陆家嘴', 32000, 10.00, 3200, 28800, 100000, 'paid', DATE_SUB(NOW(), INTERVAL 3 DAY), NOW()),
(3, 'ORD202602210003', 'rental', 3, 3, 3, 4, 'Mini 3 Pro 轻便航拍', 'rental', '2026-03-05 00:00:00', '2026-03-10 23:59:59', 22.547000, 114.085950, '深圳市福田区中心区', 150000, 10.00, 15000, 135000, 50000, 'accepted', DATE_SUB(NOW(), INTERVAL 2 DAY), NOW()),
(4, 'ORD202602220004', 'rental_offer', 4, 5, 7, 5, 'Inspire 2 专业影视拍摄', 'aerial_photo', '2026-03-10 09:00:00', '2026-03-10 17:00:00', 31.224360, 121.469170, '上海市浦东新区陆家嘴', 96000, 10.00, 9600, 86400, 150000, 'in_progress', DATE_SUB(NOW(), INTERVAL 1 DAY), NOW()),
(5, 'ORD202602230005', 'rental', 1, 1, 2, 4, '大疆Mavic 3 专业航拍', 'rental', '2026-02-24 00:00:00', '2026-02-26 23:59:59', 39.908820, 116.397470, '北京市朝阳区三里屯', 150000, 10.00, 15000, 135000, 100000, 'cancelled', DATE_SUB(NOW(), INTERVAL 4 DAY), NOW());

-- 7. 插入订单时间线数据
INSERT INTO order_timelines (order_id, status, note, operator_id, operator_type, created_at) VALUES
(1, 'created', '订单创建', 4, 'renter', DATE_SUB(NOW(), INTERVAL 5 DAY)),
(1, 'accepted', '机主接单', 2, 'owner', DATE_SUB(NOW(), INTERVAL 5 DAY)),
(1, 'paid', '支付成功', 4, 'renter', DATE_SUB(NOW(), INTERVAL 5 DAY)),
(1, 'in_progress', '订单进行中', 2, 'owner', DATE_SUB(NOW(), INTERVAL 4 DAY)),
(1, 'completed', '订单完成', 2, 'owner', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(2, 'created', '订单创建', 5, 'renter', DATE_SUB(NOW(), INTERVAL 3 DAY)),
(2, 'accepted', '机主接单', 2, 'owner', DATE_SUB(NOW(), INTERVAL 3 DAY)),
(2, 'paid', '支付成功', 5, 'renter', DATE_SUB(NOW(), INTERVAL 3 DAY)),
(3, 'created', '订单创建', 4, 'renter', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(3, 'accepted', '机主接单', 3, 'owner', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(4, 'created', '订单创建', 5, 'renter', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(4, 'accepted', '机主接单', 7, 'owner', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(4, 'paid', '支付成功', 5, 'renter', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(4, 'in_progress', '订单进行中', 7, 'owner', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(5, 'created', '订单创建', 4, 'renter', DATE_SUB(NOW(), INTERVAL 4 DAY)),
(5, 'cancelled', '租客取消订单', 4, 'renter', DATE_SUB(NOW(), INTERVAL 4 DAY));

-- 8. 插入支付记录数据
INSERT INTO payments (id, payment_no, order_id, user_id, payment_type, payment_method, amount, status, third_party_no, paid_at, created_at, updated_at) VALUES
(1, 'PAY202602190001', 1, 4, 'order', 'wechat', 175000, 'paid', 'WX2026021912345678', DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),
(2, 'PAY202602200002', 2, 5, 'order', 'alipay', 132000, 'paid', 'ALI2026022012345678', DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)),
(3, 'PAY202602210003', 3, 4, 'order', 'wechat', 200000, 'pending', '', NULL, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),
(4, 'PAY202602220004', 4, 5, 'order', 'alipay', 246000, 'paid', 'ALI2026022212345678', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
(5, 'PAY202602190005', 1, 4, 'refund', 'wechat', 70000, 'refunded', 'WX2026021923456789', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY));

-- 9. 插入消息数据
INSERT INTO messages (conversation_id, sender_id, receiver_id, message_type, content, is_read, read_at, created_at) VALUES
('conv_2_4', 2, 4, 'text', '您好，我是机主张三，您的订单已接受', 1, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),
('conv_2_4', 4, 2, 'text', '谢谢！请问取机地点在哪里？', 1, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),
('conv_2_4', 2, 4, 'text', '北京市朝阳区三里屯SOHO，可以约时间当面交接', 1, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),
('conv_2_4', 4, 2, 'text', '好的，明天上午10点可以吗？', 1, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),
('conv_2_4', 2, 4, 'text', '可以的，到时候见', 1, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),
('conv_3_5', 3, 5, 'text', '感谢预订！我会准时提供服务', 1, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)),
('conv_3_5', 5, 3, 'text', '好的，期待合作', 1, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)),
('conv_7_5', 7, 5, 'text', '您好，已收到您的订单，我会准时到达', 0, NULL, DATE_SUB(NOW(), INTERVAL 1 DAY)),
('conv_3_4', 3, 4, 'text', '您的订单已确认，请注意查收', 1, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),
('conv_3_4', 4, 3, 'text', '收到，谢谢！', 1, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY));

-- 10. 插入评价数据
INSERT INTO reviews (order_id, reviewer_id, reviewee_id, review_type, target_type, target_id, rating, content, images, tags, created_at, updated_at) VALUES
(1, 4, 2, 'renter_to_owner', 'owner', 2, 5, '机主非常专业，设备保养得很好，交接流程顺畅，非常满意！', '["https://picsum.photos/300?random=40"]', '["专业", "守时", "设备好"]', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
(1, 2, 4, 'owner_to_renter', 'renter', 4, 5, '租客很负责，按时归还设备，设备保护得很好，推荐！', NULL, '["守时", "爱护设备"]', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
(1, 4, 2, 'renter_to_drone', 'drone', 2, 5, 'Air 2S性能出色，画质清晰，操控简单，非常适合旅拍', '["https://picsum.photos/300?random=41", "https://picsum.photos/300?random=42"]', '["画质好", "易操作", "续航长"]', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
(2, 5, 2, 'renter_to_owner', 'owner', 2, 4, '服务态度好，航拍技术专业，就是时间稍微有点紧', NULL, '["专业", "效率高"]', DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY));

-- 11. 插入匹配记录数据
INSERT INTO matching_records (demand_id, demand_type, supply_id, supply_type, match_score, match_reason, status, created_at, updated_at) VALUES
(1, 'rental_demand', 1, 'rental_offer', 95, '{"distance": "5.2km", "price_match": "符合预算", "feature_match": "功能完全匹配"}', 'contacted', DATE_SUB(NOW(), INTERVAL 3 DAY), NOW()),
(1, 'rental_demand', 2, 'rental_offer', 88, '{"distance": "3.8km", "price_match": "价格合适", "feature_match": "基本匹配"}', 'viewed', DATE_SUB(NOW(), INTERVAL 3 DAY), NOW()),
(2, 'rental_demand', 4, 'rental_offer', 92, '{"distance": "8.5km", "price_match": "预算内", "feature_match": "专业设备"}', 'recommended', DATE_SUB(NOW(), INTERVAL 2 DAY), NOW()),
(3, 'rental_demand', 1, 'rental_offer', 90, '{"distance": "12km", "price_match": "合理", "feature_match": "符合需求"}', 'recommended', DATE_SUB(NOW(), INTERVAL 2 DAY), NOW()),
(4, 'rental_demand', 3, 'rental_offer', 85, '{"distance": "远程", "price_match": "预算内", "feature_match": "轻便携带"}', 'recommended', DATE_SUB(NOW(), INTERVAL 1 DAY), NOW());

-- 12. 插入系统配置数据
INSERT INTO system_configs (config_key, config_value, description, updated_at) VALUES
('platform_commission_rate', '10', '平台佣金比例(%)', NOW()),
('payment_timeout', '1800', '支付超时时间(秒)', NOW()),
('order_accept_timeout', '1800', '订单接受超时时间(秒)', NOW()),
('matching_radius', '50', '匹配搜索半径(km)', NOW()),
('matching_top_n', '10', '匹配推荐数量', NOW()),
('min_credit_score', '60', '最低信用分要求', NOW()),
('service_fee_rate', '3', '服务费率(%)', NOW())
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);

-- 13. 插入管理员日志数据
INSERT INTO admin_logs (admin_id, action, module, target_type, target_id, details, ip_address, created_at) VALUES
(1, 'approve', 'user', 'user', 2, '{"result": "approved", "reason": "资料齐全"}', '192.168.1.100', DATE_SUB(NOW(), INTERVAL 10 DAY)),
(1, 'approve', 'drone', 'drone', 1, '{"result": "approved", "reason": "认证通过"}', '192.168.1.100', DATE_SUB(NOW(), INTERVAL 9 DAY)),
(1, 'approve', 'drone', 'drone', 2, '{"result": "approved", "reason": "认证通过"}', '192.168.1.100', DATE_SUB(NOW(), INTERVAL 9 DAY)),
(1, 'approve', 'user', 'user', 3, '{"result": "approved", "reason": "资料齐全"}', '192.168.1.101', DATE_SUB(NOW(), INTERVAL 8 DAY)),
(1, 'reject', 'user', 'user', 8, '{"result": "rejected", "reason": "身份证照片不清晰"}', '192.168.1.101', DATE_SUB(NOW(), INTERVAL 7 DAY)),
(1, 'approve', 'drone', 'drone', 3, '{"result": "approved", "reason": "认证通过"}', '192.168.1.102', DATE_SUB(NOW(), INTERVAL 6 DAY)),
(1, 'system_config', 'config', 'config', 0, '{"action": "update", "key": "platform_commission_rate", "old_value": "8", "new_value": "10"}', '192.168.1.100', DATE_SUB(NOW(), INTERVAL 5 DAY));

-- 完成提示
SELECT '数据初始化完成！' AS message;
SELECT 
    '用户' AS table_name, COUNT(*) AS count FROM users
UNION ALL
SELECT '无人机', COUNT(*) FROM drones
UNION ALL
SELECT '租赁供给', COUNT(*) FROM rental_offers
UNION ALL
SELECT '租赁需求', COUNT(*) FROM rental_demands
UNION ALL
SELECT '货运需求', COUNT(*) FROM cargo_demands
UNION ALL
SELECT '订单', COUNT(*) FROM orders
UNION ALL
SELECT '订单时间线', COUNT(*) FROM order_timelines
UNION ALL
SELECT '支付记录', COUNT(*) FROM payments
UNION ALL
SELECT '消息', COUNT(*) FROM messages
UNION ALL
SELECT '评价', COUNT(*) FROM reviews
UNION ALL
SELECT '匹配记录', COUNT(*) FROM matching_records
UNION ALL
SELECT '系统配置', COUNT(*) FROM system_configs
UNION ALL
SELECT '管理员日志', COUNT(*) FROM admin_logs;
