-- 为管理员账号(user_id=1)添加测试订单

USE wurenji;

-- 添加2个管理员作为租客的订单
INSERT INTO orders (order_no, order_type, offer_id, drone_id, owner_id, renter_id, title, service_type, start_time, end_time, latitude, longitude, address, total_amount, platform_rate, platform_commission, actual_amount, deposit, status, created_at, updated_at) VALUES
('ORD202602240006', 'rental', 2, 2, 2, 1, '大疆Air 2S 整机租赁', 'rental', '2026-02-25 00:00:00', '2026-02-27 23:59:59', 39.915140, 116.403960, '北京市东城区王府井', 105000, 10.00, 10500, 94500, 70000, 'in_progress', DATE_SUB(NOW(), INTERVAL 2 DAY), NOW()),
('ORD202602250007', 'rental_offer', 3, 3, 3, 1, 'Mini 3 Pro 轻便航拍', 'rental', '2026-03-01 10:00:00', '2026-03-01 15:00:00', 31.230390, 121.473700, '上海市黄浦区南京东路', 20000, 10.00, 2000, 18000, 50000, 'paid', DATE_SUB(NOW(), INTERVAL 1 DAY), NOW());

-- 获取刚插入的订单ID（假设是6和7，因为之前有5条订单）
SET @order6_id = LAST_INSERT_ID();
SET @order7_id = @order6_id + 1;

-- 添加订单时间线
INSERT INTO order_timelines (order_id, status, note, operator_id, operator_type, created_at) VALUES
(@order6_id, 'created', '订单创建', 1, 'renter', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(@order6_id, 'accepted', '机主接单', 2, 'owner', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(@order6_id, 'paid', '支付成功', 1, 'renter', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(@order6_id, 'in_progress', '订单进行中', 2, 'owner', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(@order7_id, 'created', '订单创建', 1, 'renter', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(@order7_id, 'accepted', '机主接单', 3, 'owner', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(@order7_id, 'paid', '支付成功', 1, 'renter', DATE_SUB(NOW(), INTERVAL 1 DAY));

-- 添加支付记录
INSERT INTO payments (payment_no, order_id, user_id, payment_type, payment_method, amount, status, third_party_no, paid_at, created_at, updated_at) VALUES
('PAY202602240006', @order6_id, 1, 'order', 'wechat', 105000, 'paid', 'WX2026022412345678', DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),
('PAY202602250007', @order7_id, 1, 'order', 'alipay', 20000, 'paid', 'ALI2026022512345678', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY));

-- 添加消息记录
-- conversation_id 格式: "小ID-大ID"（与 message_service.go 的 makeConversationID 一致）
INSERT INTO messages (conversation_id, sender_id, receiver_id, message_type, content, is_read, read_at, created_at) VALUES
('1-2', 2, 1, 'text', '您好，管理员，您的订单已接受，欢迎体验！', 1, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),
('1-2', 1, 2, 'text', '谢谢！我会按时取机的', 1, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),
('1-3', 3, 1, 'text', '感谢您的预订！期待为您服务', 1, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY));

SELECT '✅ 已为管理员账号添加 2 条测试订单' AS status;
