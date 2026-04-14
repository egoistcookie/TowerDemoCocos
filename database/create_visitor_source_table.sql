-- ============================================
-- 游客来源统计表
-- 用于记录查看排行榜但未上传游戏记录的玩家（游客）的来源渠道
-- 执行方式：在 tower_defense_analytics 数据库中执行
-- ============================================

USE tower_defense_analytics;

-- 创建游客来源记录表
CREATE TABLE IF NOT EXISTS visitor_source_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录 ID',
    player_id VARCHAR(100) NOT NULL COMMENT '玩家 ID',
    channel VARCHAR(50) NOT NULL DEFAULT 'unknown' COMMENT '来源渠道：ad_1035(小程序广告), ad_1044(朋友圈广告), ad_1036(分享卡片), ad_1037(小程序推广), launcher(启动), public_account(公众号), nearby(附近), scene_XXX(其他场景值), unknown(未知)',
    scene VARCHAR(100) NOT NULL DEFAULT 'unknown' COMMENT '访问场景：launcher_XXX(启动场景), unknown(未知)',
    access_count BIGINT DEFAULT 1 COMMENT '访问次数',
    first_access_time BIGINT NOT NULL COMMENT '首次访问时间戳（毫秒）',
    last_access_time BIGINT NOT NULL COMMENT '最后访问时间戳（毫秒）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录更新时间',
    UNIQUE KEY uk_player_id (player_id),
    INDEX idx_channel (channel),
    INDEX idx_scene (scene),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游客来源记录表 - 记录查看排行榜但未上传游戏记录的玩家的来源渠道';

-- ============================================
-- 查询示例
-- ============================================

-- 1. 按来源渠道统计游客数量
-- SELECT channel, COUNT(*) AS visitor_count FROM visitor_source_records GROUP BY channel ORDER BY visitor_count DESC;

-- 2. 按来源渠道统计访问总次数
-- SELECT channel, SUM(access_count) AS total_visits FROM visitor_source_records GROUP BY channel ORDER BY total_visits DESC;

-- 3. 查看最近 7 天的游客来源
-- SELECT channel, COUNT(*) AS visitor_count FROM visitor_source_records WHERE last_access_time >= UNIX_TIMESTAMP(NOW() - INTERVAL 7 DAY) * 1000 GROUP BY channel ORDER BY visitor_count DESC;

-- 4. 查看各渠道的平均访问次数
-- SELECT channel, AVG(access_count) AS avg_visits_per_user FROM visitor_source_records GROUP BY channel ORDER BY avg_visits_per_user DESC;

-- 5. 查看最近一次访问时间
-- SELECT channel, scene, player_id, FROM_UNIXTIME(last_access_time / 1000) AS last_access FROM visitor_source_records ORDER BY last_access_time DESC LIMIT 20;
