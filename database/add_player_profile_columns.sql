-- 为已存在的 player_statistics 表添加新字段
-- 方法1：直接执行（如果字段已存在会报错，可以忽略）
-- 取消下面的注释并执行：

-- ALTER TABLE player_statistics 
-- ADD COLUMN player_name VARCHAR(50) DEFAULT NULL COMMENT '玩家名称' AFTER player_id;

-- ALTER TABLE player_statistics 
-- ADD COLUMN player_avatar VARCHAR(500) DEFAULT NULL COMMENT '玩家头像URL（Base64或URL）' AFTER player_name;

-- 方法2：使用存储过程（推荐，自动检查字段是否存在）
-- 已在 game_analytics.sql 中提供

-- 方法3：手动检查后执行（最安全）
-- 先执行：SHOW COLUMNS FROM player_statistics LIKE 'player_name';
-- 如果没有结果，再执行上面的 ALTER TABLE 语句
