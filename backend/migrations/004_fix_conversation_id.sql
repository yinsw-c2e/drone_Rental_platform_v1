-- Migration: Fix inconsistent conversation_id formats
-- This script normalizes conversation_id to always have the smaller user ID first
-- For example, "7-5" will be updated to "5-7"

-- Step 1: Create a temporary table to store the mapping
CREATE TEMPORARY TABLE IF NOT EXISTS conversation_id_mapping AS
SELECT DISTINCT 
    conversation_id AS old_id,
    CASE 
        WHEN CAST(SUBSTRING_INDEX(conversation_id, '-', 1) AS UNSIGNED) > 
             CAST(SUBSTRING_INDEX(conversation_id, '-', -1) AS UNSIGNED)
        THEN CONCAT(
            SUBSTRING_INDEX(conversation_id, '-', -1), 
            '-', 
            SUBSTRING_INDEX(conversation_id, '-', 1)
        )
        ELSE conversation_id
    END AS new_id
FROM messages
WHERE conversation_id LIKE '%-%';

-- Step 2: Update messages table with normalized conversation_id
UPDATE messages m
INNER JOIN conversation_id_mapping map ON m.conversation_id = map.old_id
SET m.conversation_id = map.new_id
WHERE map.old_id != map.new_id;

-- Step 3: Verify the fix (should return 0 rows if all fixed)
-- SELECT conversation_id 
-- FROM messages 
-- WHERE CAST(SUBSTRING_INDEX(conversation_id, '-', 1) AS UNSIGNED) > 
--       CAST(SUBSTRING_INDEX(conversation_id, '-', -1) AS UNSIGNED);

-- Step 4: Drop temporary table
DROP TEMPORARY TABLE IF EXISTS conversation_id_mapping;
