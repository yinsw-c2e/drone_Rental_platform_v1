-- 132_fix_mojibake_seed_data.sql
--
-- 修复历史 seed 脚本因未给 mysql 客户端加 --default-character-set=utf8mb4
-- 而导致的 cp1252→utf8mb4 双重编码脏数据。
--
-- 表现:像 "佛山" 实际存的是 ä½›å±± 的 UTF-8 字节(C3A4 C2BD E280BA C3A5 C2B1 C2B1)。
-- 列本身是 utf8mb4 无误,只需把当前字节按 latin1 反解再以 utf8mb4 重新写回。
--
-- 受影响范围(本仓库当前数据,已枚举):
--   owner_profiles.service_city          : user_id IN (47,48,49) → '佛山'
--   owner_profiles.intro                 : user_id = 47          → 'E2E服务商测试档案'
--   pilot_profiles.service_base_address  : user_id IN (14,15,16,17) → '佛山'
--   pilots.service_base_address          : user_id IN (14,15,16,17) → '佛山'
--
-- 安全性:用 HEX 前缀精确匹配双重编码"佛"字字节,避免误伤已有正常中文记录。
-- 防再次发生:见 backend/scripts/mini_program_p0_acceptance.sh /
--             mini_program_dispatch_ui_fixture.sh / phase10_role_acceptance.sh
-- 已同步加上 --default-character-set=utf8mb4 。

UPDATE owner_profiles
SET service_city = CONVERT(CAST(CONVERT(service_city USING latin1) AS BINARY) USING utf8mb4)
WHERE HEX(service_city) LIKE 'C3A4C2BDE280BA%';

-- intro 字段的 mojibake 起始字节是 '45 32 45' (ASCII "E2E") 后跟 C3A6/C3A5 等 cp1252 字节,
-- 这种"ASCII 前缀 + 8-bit 高位扩展拉丁字节"组合是双重编码的指纹。
UPDATE owner_profiles
SET intro = CONVERT(CAST(CONVERT(intro USING latin1) AS BINARY) USING utf8mb4)
WHERE intro LIKE 'E2E%'
  AND (HEX(intro) LIKE '%C3A6%' OR HEX(intro) LIKE '%C3A5%' OR HEX(intro) LIKE '%C3A4%');

UPDATE pilot_profiles
SET service_base_address = CONVERT(CAST(CONVERT(service_base_address USING latin1) AS BINARY) USING utf8mb4)
WHERE HEX(service_base_address) LIKE 'C3A4C2BDE280BA%';

UPDATE pilots
SET service_base_address = CONVERT(CAST(CONVERT(service_base_address USING latin1) AS BINARY) USING utf8mb4)
WHERE HEX(service_base_address) LIKE 'C3A4C2BDE280BA%';
