-- ============================================================
-- Migration 004: 统一 conversation_id 格式
-- ============================================================
-- 问题：系统中存在两种不一致的 conversation_id 格式
--   格式1: "conv_X_Y"（种子数据使用，且X/Y顺序不固定）
--   格式2: "小ID-大ID"（message_service.go 的 makeConversationID 生成）
-- 
-- 目标：统一为 "小ID-大ID" 格式（与后端 makeConversationID 一致）
--   例如: "conv_7_5" -> "5-7"
--         "conv_2_4" -> "2-4"
--         "7-5"      -> "5-7"
-- ============================================================

-- 第1步: 修复 "conv_X_Y" 格式 -> "小ID-大ID" 格式
-- 提取 conv_ 后面的两个数字，按小在前大在后重新组合
UPDATE messages
SET conversation_id = CASE
    WHEN CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(conversation_id, '_', 2), '_', -1) AS UNSIGNED) <=
         CAST(SUBSTRING_INDEX(conversation_id, '_', -1) AS UNSIGNED)
    THEN CONCAT(
        SUBSTRING_INDEX(SUBSTRING_INDEX(conversation_id, '_', 2), '_', -1),
        '-',
        SUBSTRING_INDEX(conversation_id, '_', -1)
    )
    ELSE CONCAT(
        SUBSTRING_INDEX(conversation_id, '_', -1),
        '-',
        SUBSTRING_INDEX(SUBSTRING_INDEX(conversation_id, '_', 2), '_', -1)
    )
END
WHERE conversation_id LIKE 'conv\_%' ESCAPE '\\';

-- 第2步: 修复纯数字格式 "大ID-小ID" -> "小ID-大ID"
-- 处理已有的数字格式但顺序反了的情况
UPDATE messages
SET conversation_id = CONCAT(
    SUBSTRING_INDEX(conversation_id, '-', -1),
    '-',
    SUBSTRING_INDEX(conversation_id, '-', 1)
)
WHERE conversation_id REGEXP '^[0-9]+-[0-9]+$'
  AND CAST(SUBSTRING_INDEX(conversation_id, '-', 1) AS UNSIGNED) >
      CAST(SUBSTRING_INDEX(conversation_id, '-', -1) AS UNSIGNED);

-- 第3步: 验证修复结果
-- 执行后应该所有 conversation_id 都是 "小ID-大ID" 格式
-- SELECT DISTINCT conversation_id FROM messages ORDER BY conversation_id;
--
-- 检查是否还有未修复的记录（应返回0行）
-- SELECT conversation_id FROM messages
-- WHERE conversation_id LIKE 'conv\_%' ESCAPE '\\'
--    OR (conversation_id REGEXP '^[0-9]+-[0-9]+$'
--        AND CAST(SUBSTRING_INDEX(conversation_id, '-', 1) AS UNSIGNED) >
--            CAST(SUBSTRING_INDEX(conversation_id, '-', -1) AS UNSIGNED));
