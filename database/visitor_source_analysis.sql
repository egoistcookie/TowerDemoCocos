-- ============================================
-- 游客来源分析查询脚本
-- 用于分析查看排行榜但未上传游戏记录的游客来源
-- ============================================

USE tower_defense_analytics;

-- ============================================
-- 1. 总体统计
-- ============================================

-- 1.1 游客总数 vs 有游戏记录的玩家数
SELECT
    '游客总数（访问过排行榜）' AS metric, COUNT(*) AS value FROM visitor_source_records
UNION ALL
SELECT
    '有游戏记录的玩家数', COUNT(DISTINCT player_id) FROM player_statistics WHERE total_games > 0
UNION ALL
SELECT
    '纯游客玩家（无游戏记录）', COUNT(*) FROM visitor_source_records v WHERE NOT EXISTS (SELECT 1 FROM player_statistics p WHERE p.player_id = v.player_id AND p.total_games > 0);

-- 1.2 游客占比
SELECT
    CONCAT(ROUND(
        (SELECT COUNT(*) FROM visitor_source_records WHERE player_id NOT IN (
            SELECT player_id FROM player_statistics WHERE total_games > 0
        )) * 100.0 / COUNT(*), 2
    ), '%') AS pure_visitor_rate
FROM visitor_source_records;

-- ============================================
-- 2. 按来源渠道统计
-- ============================================

-- 2.1 各渠道游客数量排名
SELECT
    channel,
    COUNT(*) AS visitor_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM visitor_source_records), 2) AS percentage,
    SUM(access_count) AS total_visits,
    AVG(access_count) AS avg_visits_per_user,
    MIN(FROM_UNIXTIME(first_access_time / 1000)) AS first_access,
    MAX(FROM_UNIXTIME(last_access_time / 1000)) AS last_access
FROM visitor_source_records
GROUP BY channel
ORDER BY visitor_count DESC;

-- 2.2 广告渠道细分（仅广告来源）
SELECT
    channel,
    CASE channel
        WHEN 'ad_1035' THEN '小程序广告'
        WHEN 'ad_1044' THEN '朋友圈广告'
        WHEN 'ad_1036' THEN '分享卡片'
        WHEN 'ad_1037' THEN '小程序推广'
        ELSE '其他'
    END AS channel_name,
    COUNT(*) AS visitor_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM visitor_source_records WHERE channel LIKE 'ad_%'), 2) AS percentage
FROM visitor_source_records
WHERE channel LIKE 'ad_%'
GROUP BY channel
ORDER BY visitor_count DESC;

-- ============================================
-- 3. 按场景统计
-- ============================================

-- 3.1 各场景游客数量排名
SELECT
    scene,
    COUNT(*) AS visitor_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM visitor_source_records), 2) AS percentage,
    SUM(access_count) AS total_visits
FROM visitor_source_records
GROUP BY scene
ORDER BY visitor_count DESC;

-- ============================================
-- 4. 时间维度分析
-- ============================================

-- 4.1 每日游客来源（最近 30 天）
SELECT
    DATE(FROM_UNIXTIME(last_access_time / 1000)) AS access_date,
    channel,
    COUNT(*) AS visitor_count,
    SUM(access_count) AS total_visits
FROM visitor_source_records
WHERE last_access_time >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY) * 1000
GROUP BY DATE(FROM_UNIXTIME(last_access_time / 1000)), channel
ORDER BY access_date DESC, visitor_count DESC;

-- 4.2 每周趋势
SELECT
    YEARWEEK(FROM_UNIXTIME(last_access_time / 1000)) AS week,
    channel,
    COUNT(*) AS visitor_count
FROM visitor_source_records
WHERE last_access_time >= UNIX_TIMESTAMP(NOW() - INTERVAL 8 WEEK) * 1000
GROUP BY YEARWEEK(FROM_UNIXTIME(last_access_time / 1000)), channel
ORDER BY week DESC, visitor_count DESC;

-- ============================================
-- 5. 渠道质量分析（转化率）
-- ============================================

-- 5.1 各渠道的转化率（有游戏记录的玩家占比）
SELECT
    v.channel,
    COUNT(*) AS total_visitors,
    COUNT(p.player_id) AS converted_players,
    ROUND(COUNT(p.player_id) * 100.0 / COUNT(*), 2) AS conversion_rate
FROM visitor_source_records v
LEFT JOIN player_statistics p ON p.player_id = v.player_id AND p.total_games > 0
GROUP BY v.channel
ORDER BY conversion_rate DESC;

-- ============================================
-- 6. 最新游客记录
-- ============================================

-- 6.1 最近访问的游客（Top 50）
SELECT
    v.player_id,
    v.channel,
    v.scene,
    v.access_count,
    FROM_UNIXTIME(v.first_access_time / 1000) AS first_access,
    FROM_UNIXTIME(v.last_access_time / 1000) AS last_access,
    CASE WHEN p.player_id IS NOT NULL THEN '有游戏记录' ELSE '纯游客' END AS player_type
FROM visitor_source_records v
LEFT JOIN player_statistics p ON p.player_id = v.player_id
ORDER BY v.last_access_time DESC
LIMIT 50;

-- ============================================
-- 7. 高价值游客识别（访问次数多但未转化）
-- ============================================

-- 7.1 访问次数 Top 20 的纯游客（可能是潜力用户）
SELECT
    v.player_id,
    v.channel,
    v.scene,
    v.access_count,
    FROM_UNIXTIME(v.first_access_time / 1000) AS first_access,
    FROM_UNIXTIME(v.last_access_time / 1000) AS last_access,
    DATEDIFF(
        FROM_UNIXTIME(v.last_access_time / 1000),
        FROM_UNIXTIME(v.first_access_time / 1000)
    ) AS days_active
FROM visitor_source_records v
WHERE NOT EXISTS (SELECT 1 FROM player_statistics p WHERE p.player_id = v.player_id AND p.total_games > 0)
ORDER BY v.access_count DESC
LIMIT 20;
