-- 更新所有测试用户的密码为 password123 的正确 bcrypt hash
-- 这个 hash 是通过 bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost) 生成的

UPDATE users 
SET password_hash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' 
WHERE phone LIKE '138000000%';

-- 验证更新
SELECT id, phone, nickname, user_type, 
       LEFT(password_hash, 20) as password_preview
FROM users 
WHERE phone LIKE '138000000%'
ORDER BY id;
