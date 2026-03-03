-- 游戏埋点数据库表结构
-- 数据库名称: tower_defense_analytics
-- 字符集: utf8mb4

-- ============================================
-- 第一步：创建数据库
-- ============================================
CREATE DATABASE IF NOT EXISTS tower_defense_analytics 
DEFAULT CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- ============================================
-- 第二步：创建数据库用户并授权
-- ============================================
-- 创建专用数据库用户（请根据实际情况修改密码）
CREATE USER IF NOT EXISTS 'tower_game_user'@'localhost' IDENTIFIED BY 'TowerGame@2026!';
CREATE USER IF NOT EXISTS 'tower_game_user'@'%' IDENTIFIED BY 'TowerGame@2026!';

-- 授予该用户对数据库的完整权限
GRANT ALL PRIVILEGES ON tower_defense_analytics.* TO 'tower_game_user'@'localhost';
GRANT ALL PRIVILEGES ON tower_defense_analytics.* TO 'tower_game_user'@'%';

-- 刷新权限
FLUSH PRIVILEGES;

-- ============================================
-- 第三步：切换到目标数据库
-- ============================================
USE tower_defense_analytics;

-- 游戏记录主表
CREATE TABLE IF NOT EXISTS game_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
    player_id VARCHAR(100) NOT NULL COMMENT '玩家ID',
    level INT NOT NULL COMMENT '关卡数',
    result ENUM('success', 'fail') NOT NULL COMMENT '游戏结果：success-通关，fail-失败',
    operations_json TEXT NOT NULL COMMENT '操作序列JSON字符串',
    end_time BIGINT NOT NULL COMMENT '结束时间戳（毫秒）',
    defend_time INT NOT NULL COMMENT '已防御时间（秒）',
    current_wave INT NOT NULL COMMENT '当前波次',
    final_gold INT DEFAULT 0 COMMENT '最终金币数',
    final_population INT DEFAULT 0 COMMENT '最终人口数',
    kill_count INT DEFAULT 0 COMMENT '击杀数',
    operation_count INT DEFAULT 0 COMMENT '操作次数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_player_id (player_id),
    INDEX idx_level (level),
    INDEX idx_result (result),
    INDEX idx_end_time (end_time),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏记录主表';

-- 玩家统计表
CREATE TABLE IF NOT EXISTS player_statistics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '统计ID',
    player_id VARCHAR(100) NOT NULL UNIQUE COMMENT '玩家ID',
    total_games INT DEFAULT 0 COMMENT '总游戏局数',
    success_games INT DEFAULT 0 COMMENT '成功局数',
    fail_games INT DEFAULT 0 COMMENT '失败局数',
    max_level INT DEFAULT 1 COMMENT '最高通关关卡',
    total_defend_time BIGINT DEFAULT 0 COMMENT '累计防御时间（秒）',
    total_kills BIGINT DEFAULT 0 COMMENT '累计击杀数',
    total_operations BIGINT DEFAULT 0 COMMENT '累计操作次数',
    first_play_time BIGINT COMMENT '首次游戏时间戳',
    last_play_time BIGINT COMMENT '最后游戏时间戳',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_max_level (max_level),
    INDEX idx_total_games (total_games)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='玩家统计表';

-- 操作类型统计表
CREATE TABLE IF NOT EXISTS operation_statistics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '统计ID',
    player_id VARCHAR(100) NOT NULL COMMENT '玩家ID',
    operation_type VARCHAR(50) NOT NULL COMMENT '操作类型',
    count INT DEFAULT 0 COMMENT '操作次数',
    last_operation_time BIGINT COMMENT '最后操作时间戳',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_player_operation (player_id, operation_type),
    INDEX idx_operation_type (operation_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作类型统计表';

-- 关卡统计表
CREATE TABLE IF NOT EXISTS level_statistics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '统计ID',
    level INT NOT NULL COMMENT '关卡数',
    total_attempts INT DEFAULT 0 COMMENT '总尝试次数',
    success_count INT DEFAULT 0 COMMENT '成功次数',
    fail_count INT DEFAULT 0 COMMENT '失败次数',
    avg_defend_time DECIMAL(10,2) DEFAULT 0 COMMENT '平均防御时间（秒）',
    avg_operations DECIMAL(10,2) DEFAULT 0 COMMENT '平均操作次数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='关卡统计表';

-- 创建存储过程：更新玩家统计
DELIMITER //
CREATE PROCEDURE update_player_statistics(
    IN p_player_id VARCHAR(100),
    IN p_level INT,
    IN p_result VARCHAR(10),
    IN p_defend_time INT,
    IN p_kill_count INT,
    IN p_operation_count INT,
    IN p_end_time BIGINT
)
BEGIN
    -- 插入或更新玩家统计
    INSERT INTO player_statistics (
        player_id, 
        total_games, 
        success_games, 
        fail_games, 
        max_level,
        total_defend_time,
        total_kills,
        total_operations,
        first_play_time,
        last_play_time
    ) VALUES (
        p_player_id,
        1,
        IF(p_result = 'success', 1, 0),
        IF(p_result = 'fail', 1, 0),
        IF(p_result = 'success', p_level, 0),
        p_defend_time,
        p_kill_count,
        p_operation_count,
        p_end_time,
        p_end_time
    )
    ON DUPLICATE KEY UPDATE
        total_games = total_games + 1,
        success_games = success_games + IF(p_result = 'success', 1, 0),
        fail_games = fail_games + IF(p_result = 'fail', 1, 0),
        max_level = GREATEST(max_level, IF(p_result = 'success', p_level, 0)),
        total_defend_time = total_defend_time + p_defend_time,
        total_kills = total_kills + p_kill_count,
        total_operations = total_operations + p_operation_count,
        last_play_time = p_end_time;
END //
DELIMITER ;

-- 创建存储过程：更新关卡统计
DELIMITER //
CREATE PROCEDURE update_level_statistics(
    IN p_level INT,
    IN p_result VARCHAR(10),
    IN p_defend_time INT,
    IN p_operation_count INT
)
BEGIN
    -- 插入或更新关卡统计
    INSERT INTO level_statistics (
        level,
        total_attempts,
        success_count,
        fail_count,
        avg_defend_time,
        avg_operations
    ) VALUES (
        p_level,
        1,
        IF(p_result = 'success', 1, 0),
        IF(p_result = 'fail', 1, 0),
        p_defend_time,
        p_operation_count
    )
    ON DUPLICATE KEY UPDATE
        total_attempts = total_attempts + 1,
        success_count = success_count + IF(p_result = 'success', 1, 0),
        fail_count = fail_count + IF(p_result = 'fail', 1, 0),
        avg_defend_time = (avg_defend_time * (total_attempts - 1) + p_defend_time) / total_attempts,
        avg_operations = (avg_operations * (total_attempts - 1) + p_operation_count) / total_attempts;
END //
DELIMITER ;

-- 创建视图：玩家排行榜
CREATE OR REPLACE VIEW player_leaderboard AS
SELECT 
    player_id,
    total_games,
    success_games,
    fail_games,
    ROUND(success_games * 100.0 / NULLIF(total_games, 0), 2) AS win_rate,
    max_level,
    total_defend_time,
    total_kills,
    ROUND(total_kills * 1.0 / NULLIF(total_games, 0), 2) AS avg_kills_per_game,
    last_play_time
FROM player_statistics
ORDER BY max_level DESC, success_games DESC, total_kills DESC;

-- 创建视图：击杀榜排名（供“超越多少玩家/前百分比”展示）
-- 说明：使用窗口函数（MySQL 8.0+），查询时只需查该视图（单表查询）。
CREATE OR REPLACE VIEW player_kill_rank AS
SELECT
    t.player_id,
    t.total_kills,
    t.kill_rank,
    t.total_players,
    ROUND(t.kill_rank * 100.0 / NULLIF(t.total_players, 0), 2) AS top_percent,               -- 排名前 top_percent%
    (t.total_players - t.kill_rank) AS surpassed_count,                                     -- 超越人数
    ROUND((t.total_players - t.kill_rank) * 100.0 / NULLIF(t.total_players, 0), 2) AS surpassed_percent -- 超越百分比
FROM (
    SELECT
        pl.player_id,
        pl.total_kills,
        RANK() OVER (ORDER BY pl.total_kills DESC) AS kill_rank,
        COUNT(*) OVER () AS total_players
    FROM player_leaderboard pl
) t;

-- 创建视图：关卡难度分析
CREATE OR REPLACE VIEW level_difficulty_analysis AS
SELECT 
    level,
    total_attempts,
    success_count,
    fail_count,
    ROUND(success_count * 100.0 / NULLIF(total_attempts, 0), 2) AS success_rate,
    avg_defend_time,
    avg_operations
FROM level_statistics
ORDER BY level;

-- 示例查询：查看某玩家的游戏历史
-- SELECT * FROM game_records WHERE player_id = 'player_xxx' ORDER BY end_time DESC LIMIT 10;

-- 示例查询：查看玩家排行榜前10名
-- SELECT * FROM player_leaderboard LIMIT 10;

-- 示例查询：查看关卡难度分析
-- SELECT * FROM level_difficulty_analysis;

-- 示例查询：查看最常用的操作类型
-- SELECT operation_type, SUM(count) as total_count 
-- FROM operation_statistics 
-- GROUP BY operation_type 
-- ORDER BY total_count DESC;

-- ============================================
-- 数据库连接配置说明
-- ============================================
-- 主机: www.egoistcookie.top (或 localhost)
-- 端口: 3306
-- 数据库: tower_defense_analytics
-- 用户名: tower_game_user
-- 密码: TowerGame@2026! (请根据实际情况修改)
-- 
-- 连接字符串示例:
-- mysql://tower_game_user:TowerGame@2026!@www.egoistcookie.top:3306/tower_defense_analytics
--
-- 安全建议：
-- 1. 生产环境请使用更强的密码
-- 2. 限制用户只能从特定IP访问（修改 '%' 为具体IP）
-- 3. 定期备份数据库
-- 4. 启用SSL连接
-- ============================================
