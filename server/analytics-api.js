/**
 * 游戏埋点数据接收API
 * Node.js + Express + MySQL 实现
 * 
 * 安装依赖:
 * npm install express mysql2 body-parser cors
 */

const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001; // 支持通过环境变量设置端口

// 中间件配置
app.use(cors()); // 允许跨域
app.use(bodyParser.json({ limit: '10mb' })); // 解析JSON请求体

// 数据库连接池配置
const pool = mysql.createPool({
    host: 'localhost', // 或 'www.egoistcookie.top'
    port: 3306,
    user: 'tower_game_user',
    password: 'TowerGame@2026!',
    database: 'tower_defense_analytics',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});

/**
 * 健康检查接口
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

/**
 * 接收游戏埋点数据
 * POST /api/analytics/report
 */
app.post('/api/analytics/report', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const data = req.body;
        
        // 数据验证
        if (!data || !data.playerId || !data.level || !data.operations) {
            return res.status(400).json({
                success: false,
                message: '缺少必要参数',
                timestamp: Date.now()
            });
        }
        
        console.log(`[Analytics] 收到玩家 ${data.playerId} 的数据，关卡 ${data.level}，操作数 ${data.operations.length}`);
        
        // 开启事务
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        
        try {
            // 1. 插入游戏记录（原有逻辑：结束时整包上报）
            const operationsJson = JSON.stringify(data.operations);
            // 新增：将各单位强化等级信息作为JSON一起入库（例如 { Arrower: 15, StoneWall: 44 }）
            const unitLevelsJson = data.unitLevels ? JSON.stringify(data.unitLevels) : null;
            const [insertResult] = await connection.execute(
                `INSERT INTO game_records (
                    player_id, level, result, operations_json, end_time, 
                    defend_time, current_wave, final_gold, final_population, 
                    kill_count, operation_count, unit_levels_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    data.playerId,
                    data.level,
                    data.result,
                    operationsJson,
                    data.endTime,
                    data.defendTime,
                    data.currentWave,
                    data.finalGold || 0,
                    data.finalPopulation || 0,
                    data.killCount || 0,
                    data.operations.length,
                    unitLevelsJson
                ]
            );
            
            const recordId = insertResult.insertId;

            // 1.1 回填 game_sessions（选卡实时埋点用）
            // 优先使用前端传入的 sessionId；若缺失，则兜底匹配该玩家该关卡最近一条未结束会话
            let targetSessionId = null;
            if (data.sessionId) {
                targetSessionId = data.sessionId;
            } else {
                const [sessionRows] = await connection.execute(
                    `SELECT id
                     FROM game_sessions
                     WHERE player_id = ? AND level = ? AND end_time IS NULL
                     ORDER BY start_time DESC, id DESC
                     LIMIT 1`,
                    [data.playerId, data.level]
                );
                if (Array.isArray(sessionRows) && sessionRows.length > 0) {
                    targetSessionId = sessionRows[0].id;
                }
            }

            if (targetSessionId) {
                try {
                    // revive_count：优先使用前端显式提供的 reviveCount，兜底从 operations 里统计 'revive'
                    const reviveCount =
                        typeof data.reviveCount === 'number' && !Number.isNaN(data.reviveCount)
                            ? Math.max(0, Math.floor(data.reviveCount))
                            : Array.isArray(data.operations)
                                ? data.operations.filter(op => op && op.type === 'revive').length
                                : 0;
                    await connection.execute(
                        `UPDATE game_sessions
                         SET end_time = ?,
                             result = ?,
                             defend_time = ?,
                             current_wave = ?,
                             final_gold = ?,
                             final_population = ?,
                             kill_count = ?,
                             operation_count = ?,
                             revive_count = ?,
                             operations_json = ?
                         WHERE id = ? AND player_id = ? AND level = ?`,
                        [
                            data.endTime,
                            data.result,
                            data.defendTime,
                            data.currentWave,
                            data.finalGold || 0,
                            data.finalPopulation || 0,
                            data.killCount || 0,
                            data.operations.length,
                            reviveCount,
                            operationsJson,
                            targetSessionId,
                            data.playerId,
                            data.level
                        ]
                    );
                } catch (e) {
                    console.warn('[Analytics] 回填 game_sessions 失败（将忽略，不影响主流程）:', e?.message || e);
                }
            }
            
            // 2. 更新玩家统计
            await connection.execute(
                `CALL update_player_statistics(?, ?, ?, ?, ?, ?, ?)`,
                [
                    data.playerId,
                    data.level,
                    data.result,
                    data.defendTime,
                    data.killCount || 0,
                    data.operations.length,
                    data.endTime
                ]
            );
            
            // 3. 更新关卡统计
            await connection.execute(
                `CALL update_level_statistics(?, ?, ?, ?)`,
                [
                    data.level,
                    data.result,
                    data.defendTime,
                    data.operations.length
                ]
            );
            
            // 4. 更新操作类型统计
            const operationTypes = {};
            data.operations.forEach(op => {
                operationTypes[op.type] = (operationTypes[op.type] || 0) + 1;
            });
            
            for (const [opType, count] of Object.entries(operationTypes)) {
                await connection.execute(
                    `INSERT INTO operation_statistics (player_id, operation_type, count, last_operation_time)
                     VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE 
                        count = count + VALUES(count),
                        last_operation_time = VALUES(last_operation_time)`,
                    [data.playerId, opType, count, data.endTime]
                );
            }
            
            // 提交事务
            await connection.commit();
            connection.release();
            
            const processingTime = Date.now() - startTime;
            console.log(`[Analytics] 数据保存成功，记录ID: ${recordId}，耗时: ${processingTime}ms`);
            
            // 返回成功响应
            res.json({
                success: true,
                message: '数据接收成功',
                recordId: recordId,
                processingTime: processingTime,
                timestamp: Date.now()
            });
            
        } catch (error) {
            // 回滚事务
            await connection.rollback();
            connection.release();
            throw error;
        }
        
    } catch (error) {
        console.error('[Analytics] 处理数据失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: error.message,
            timestamp: Date.now()
        });
    }
});

/**
 * 选卡实时埋点：创建/获取会话
 * POST /api/analytics/session/start
 * body: { playerId, level, startTime? }
 * return: { sessionId }
 */
app.post('/api/analytics/session/start', async (req, res) => {
    try {
        const { playerId, level, startTime } = req.body || {};
        if (!playerId || !level) {
            return res.status(400).json({ success: false, message: '缺少 playerId 或 level' });
        }

        const st = typeof startTime === 'number' && !isNaN(startTime) ? startTime : Date.now();
        const [result] = await pool.execute(
            `INSERT INTO game_sessions (player_id, level, start_time)
             VALUES (?, ?, ?)`,
            [playerId, level, st]
        );

        res.json({ success: true, sessionId: result.insertId });
    } catch (error) {
        console.error('[Analytics] session/start 失败:', error);
        res.status(500).json({ success: false, message: '服务器内部错误', error: error.message });
    }
});

/**
 * 选卡实时埋点：上报一次选卡（会写入 events，并更新 summary 聚合表）
 * POST /api/analytics/session/card-select
 * body: {
 *   sessionId?, playerId, level,
 *   selectionMode: 'single'|'get_all',
 *   selectedCount: number,
 *   cards: [{ unitId, rarity, buffType?, buffValue? }],
 *   eventTime?, gameTime?
 * }
 * 若 sessionId 不传，则会自动创建会话（等价于“首次选卡创建游戏与玩家记录”）。
 */
app.post('/api/analytics/session/card-select', async (req, res) => {
    const startTime = Date.now();
    try {
        const body = req.body || {};
        const playerId = body.playerId;
        const level = body.level;
        let sessionId = body.sessionId;
        const selectionMode = body.selectionMode;
        const selectedCount = body.selectedCount;
        const cards = Array.isArray(body.cards) ? body.cards : [];
        const eventTime = typeof body.eventTime === 'number' && !isNaN(body.eventTime) ? body.eventTime : Date.now();
        const gameTime = typeof body.gameTime === 'number' && !isNaN(body.gameTime) ? body.gameTime : null;

        if (!playerId || !level || !selectionMode || !selectedCount || cards.length === 0) {
            return res.status(400).json({ success: false, message: '缺少必要参数' });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();
        try {
            // 1) 首次选卡：如果没有 sessionId，则创建会话
            if (!sessionId) {
                const [ins] = await connection.execute(
                    `INSERT INTO game_sessions (player_id, level, start_time)
                     VALUES (?, ?, ?)`,
                    [playerId, level, eventTime]
                );
                sessionId = ins.insertId;
            }

            // 2) 写入选卡明细事件
            const cardsJson = JSON.stringify(cards);
            await connection.execute(
                `INSERT INTO card_selection_events (
                    session_id, player_id, level, event_time, game_time, selection_mode, selected_count, cards_json
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [sessionId, playerId, level, eventTime, gameTime, selectionMode, selectedCount, cardsJson]
            );

            // 3) 更新选卡汇总（按 session + unit 聚合）
            for (const c of cards) {
                if (!c || !c.unitId) continue;
                const rarity = c.rarity || null;
                await connection.execute(
                    `INSERT INTO card_selection_summary (
                        session_id, player_id, level, unit_id, rarity, pick_times, pick_amount, last_pick_time
                     ) VALUES (?, ?, ?, ?, ?, 1, 1, ?)
                     ON DUPLICATE KEY UPDATE
                        rarity = COALESCE(VALUES(rarity), rarity),
                        pick_times = pick_times + 1,
                        pick_amount = pick_amount + 1,
                        last_pick_time = VALUES(last_pick_time)`,
                    [sessionId, playerId, level, c.unitId, rarity, eventTime]
                );
            }

            await connection.commit();
            connection.release();

            res.json({
                success: true,
                sessionId,
                processingTime: Date.now() - startTime
            });
        } catch (err) {
            await connection.rollback();
            connection.release();
            throw err;
        }
    } catch (error) {
        console.error('[Analytics] session/card-select 失败:', error);
        res.status(500).json({ success: false, message: '服务器内部错误', error: error.message });
    }
});

/**
 * 选卡实时埋点：会话结束回填（用于“游戏结束时更新操作记录/防御时间/杀敌数等字段”）
 * POST /api/analytics/session/end
 * body: { sessionId, playerId, level, endTime, result, defendTime, currentWave, finalGold, finalPopulation, killCount, operationCount, operationsJson? }
 */
app.post('/api/analytics/session/end', async (req, res) => {
    try {
        const b = req.body || {};
        const { sessionId, playerId, level } = b;
        if (!sessionId || !playerId || !level) {
            return res.status(400).json({ success: false, message: '缺少 sessionId/playerId/level' });
        }

        // revive_count：优先使用前端显式提供的 reviveCount，兜底从 operationsJson 里统计 "type":"revive"
        let reviveCount = 0;
        if (typeof b.reviveCount === 'number' && !Number.isNaN(b.reviveCount)) {
            reviveCount = Math.max(0, Math.floor(b.reviveCount));
        } else if (typeof b.operationsJson === 'string' && b.operationsJson) {
            // 粗略统计即可：避免 JSON.parse 带来的异常/开销（服务端只做兜底）
            const m = b.operationsJson.match(/"type"\s*:\s*"revive"/g);
            reviveCount = m ? m.length : 0;
        }

        await pool.execute(
            `UPDATE game_sessions
             SET end_time = ?,
                 result = ?,
                 defend_time = ?,
                 current_wave = ?,
                 final_gold = ?,
                 final_population = ?,
                 kill_count = ?,
                 operation_count = ?,
                 revive_count = ?,
                 operations_json = ?
             WHERE id = ? AND player_id = ? AND level = ?`,
            [
                b.endTime || Date.now(),
                b.result || null,
                b.defendTime || 0,
                b.currentWave || 0,
                b.finalGold || 0,
                b.finalPopulation || 0,
                b.killCount || 0,
                b.operationCount || 0,
                reviveCount,
                b.operationsJson || null,
                sessionId,
                playerId,
                level
            ]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('[Analytics] session/end 失败:', error);
        res.status(500).json({ success: false, message: '服务器内部错误', error: error.message });
    }
});

/**
 * 查询玩家统计信息
 * GET /api/analytics/player/:playerId
 */
app.get('/api/analytics/player/:playerId', async (req, res) => {
    try {
        const { playerId } = req.params;
        
        const [rows] = await pool.execute(
            'SELECT * FROM player_statistics WHERE player_id = ?',
            [playerId]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '玩家不存在'
            });
        }
        
        res.json({
            success: true,
            data: rows[0]
        });
        
    } catch (error) {
        console.error('[Analytics] 查询玩家统计失败:', error);
        res.status(500).json({
            success: false,
            message: '查询失败',
            error: error.message
        });
    }
});

/**
 * 查询玩家击杀榜排名（超越人数/百分比、前百分比）
 * GET /api/analytics/player/:playerId/kill-rank
 *
 * 数据来源：player_kill_rank 视图（单表查询）
 */
app.get('/api/analytics/player/:playerId/kill-rank', async (req, res) => {
    try {
        const { playerId } = req.params;
        console.log('[Analytics] kill-rank request:', { playerId });

        const [rows] = await pool.execute(
            `SELECT 
                player_id,
                total_kills,
                kill_rank,
                total_players,
                top_percent,
                surpassed_count,
                surpassed_percent
             FROM player_kill_rank
             WHERE player_id = ?`,
            [playerId]
        );

        if (rows.length === 0) {
            console.log('[Analytics] kill-rank no rows for player:', playerId);
            // 玩家还没有任何统计数据（尚未上报过结算），返回默认
            return res.json({
                success: true,
                data: {
                    player_id: playerId,
                    total_kills: 0,
                    kill_rank: 0,
                    total_players: 0,
                    top_percent: 0,
                    surpassed_count: 0,
                    surpassed_percent: 0
                }
            });
        }

        console.log('[Analytics] kill-rank ok:', rows[0]);
        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('[Analytics] 查询玩家击杀榜排名失败:', error);
        res.status(500).json({
            success: false,
            message: '查询失败',
            error: error.message
        });
    }
});

/**
 * 查询排行榜
 * GET /api/analytics/leaderboard?limit=10
 */
app.get('/api/analytics/leaderboard', async (req, res) => {
    try {
        let limit = parseInt(req.query.limit);
        if (isNaN(limit) || limit <= 0) {
            limit = 10;
        }
        // 做一个上限，避免一次查询过多
        limit = Math.min(limit, 100);
        
        const [rows] = await pool.execute(
            `SELECT * FROM player_leaderboard LIMIT ${limit}`
        );
        
        res.json({
            success: true,
            data: rows
        });
        
    } catch (error) {
        console.error('[Analytics] 查询排行榜失败:', error);
        res.status(500).json({
            success: false,
            message: '查询失败',
            error: error.message
        });
    }
});

/**
 * 查询杀敌数排行榜（前N名）
 * GET /api/analytics/leaderboard/kill-top?limit=10
 * 数据来源：player_kill_rank 视图 + player_leaderboard 视图 + player_statistics 表
 */
app.get('/api/analytics/leaderboard/kill-top', async (req, res) => {
    try {
        let limit = parseInt(req.query.limit);
        if (isNaN(limit) || limit <= 0) {
            limit = 10;
        }
        // 做一个上限，避免一次查询过多
        limit = Math.min(limit, 100);
        
        const [rows] = await pool.execute(
            `SELECT 
                k.player_id,
                COALESCE(ps.player_name, '') AS player_name,
                COALESCE(ps.player_avatar, '') AS player_avatar,
                k.total_kills,
                COALESCE(pl.max_level, 0) AS max_level,
                k.kill_rank
             FROM player_kill_rank k
             LEFT JOIN player_leaderboard pl ON pl.player_id = k.player_id
             LEFT JOIN player_statistics ps ON ps.player_id = k.player_id
             ORDER BY k.total_kills DESC
             LIMIT ${limit}`
        );
        
        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('[Analytics] 查询杀敌排行榜失败:', error);
        res.status(500).json({
            success: false,
            message: '查询失败',
            error: error.message
        });
    }
});

/**
 * 查询关卡统计
 * GET /api/analytics/levels
 */
app.get('/api/analytics/levels', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM level_difficulty_analysis'
        );
        
        res.json({
            success: true,
            data: rows
        });
        
    } catch (error) {
        console.error('[Analytics] 查询关卡统计失败:', error);
        res.status(500).json({
            success: false,
            message: '查询失败',
            error: error.message
        });
    }
});

/**
 * 查询单个关卡的通关率
 * GET /api/analytics/level/:levelId/pass-rate
 */
app.get('/api/analytics/level/:levelId/pass-rate', async (req, res) => {
    try {
        const levelId = parseInt(req.params.levelId);
        
        if (isNaN(levelId) || levelId < 1 || levelId > 10) {
            return res.status(400).json({
                success: false,
                message: '无效的关卡ID'
            });
        }
        
        const [rows] = await pool.execute(
            `SELECT 
                level,
                total_attempts,
                success_count,
                fail_count,
                ROUND(success_count * 100.0 / NULLIF(total_attempts, 0), 2) AS pass_rate,
                avg_defend_time,
                avg_operations
            FROM level_statistics 
            WHERE level = ?`,
            [levelId]
        );
        
        if (rows.length === 0) {
            // 如果没有数据，返回默认值
            return res.json({
                success: true,
                data: {
                    level: levelId,
                    total_attempts: 0,
                    success_count: 0,
                    fail_count: 0,
                    pass_rate: 0,
                    difficulty_label: '未知',
                    difficulty_color: '#999999'
                }
            });
        }
        
        const levelData = rows[0];
        const passRate = levelData.pass_rate || 0;
        
        // 根据通关率计算难度等级
        let difficultyLabel = '';
        let difficultyColor = '';
        
        if (passRate >= 80) {
            difficultyLabel = '简单';
            difficultyColor = '#00FF00'; // 绿色
        } else if (passRate >= 60) {
            difficultyLabel = '普通';
            difficultyColor = '#4CAF50'; // 浅绿
        } else if (passRate >= 40) {
            difficultyLabel = '困难';
            difficultyColor = '#FFA500'; // 橙色
        } else if (passRate >= 20) {
            difficultyLabel = '噩梦';
            difficultyColor = '#FF4500'; // 橙红
        } else if (passRate >= 10) {
            difficultyLabel = '炼狱';
            difficultyColor = '#DC143C'; // 深红
        } else {
            difficultyLabel = '地狱';
            difficultyColor = '#8B0000'; // 暗红
        }
        
        res.json({
            success: true,
            data: {
                level: levelData.level,
                total_attempts: levelData.total_attempts,
                success_count: levelData.success_count,
                fail_count: levelData.fail_count,
                pass_rate: passRate,
                avg_defend_time: levelData.avg_defend_time,
                avg_operations: levelData.avg_operations,
                difficulty_label: difficultyLabel,
                difficulty_color: difficultyColor
            }
        });
        
    } catch (error) {
        console.error('[Analytics] 查询关卡通关率失败:', error);
        res.status(500).json({
            success: false,
            message: '查询失败',
            error: error.message
        });
    }
});

/**
 * 批量查询所有关卡的通关率
 * GET /api/analytics/levels/pass-rates
 */
app.get('/api/analytics/levels/pass-rates', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT 
                level,
                total_attempts,
                success_count,
                fail_count,
                ROUND(success_count * 100.0 / NULLIF(total_attempts, 0), 2) AS pass_rate,
                avg_defend_time,
                avg_operations
            FROM level_statistics 
            ORDER BY level ASC`
        );
        
        // 为每个关卡添加难度标签
        const levelsWithDifficulty = [];
        
        for (let i = 1; i <= 10; i++) {
            const levelData = rows.find(r => r.level === i);
            
            if (!levelData) {
                // 没有数据的关卡
                levelsWithDifficulty.push({
                    level: i,
                    total_attempts: 0,
                    success_count: 0,
                    fail_count: 0,
                    pass_rate: 0,
                    difficulty_label: '未知',
                    difficulty_color: '#999999'
                });
                continue;
            }
            
            const passRate = levelData.pass_rate || 0;
            let difficultyLabel = '';
            let difficultyColor = '';
            
            if (passRate >= 80) {
                difficultyLabel = '简单';
                difficultyColor = '#00FF00';
            } else if (passRate >= 60) {
                difficultyLabel = '普通';
                difficultyColor = '#4CAF50';
            } else if (passRate >= 40) {
                difficultyLabel = '困难';
                difficultyColor = '#FFA500';
            } else if (passRate >= 20) {
                difficultyLabel = '噩梦';
                difficultyColor = '#FF4500';
            } else if (passRate >= 10) {
                difficultyLabel = '炼狱';
                difficultyColor = '#DC143C';
            } else {
                difficultyLabel = '地狱';
                difficultyColor = '#8B0000';
            }
            
            levelsWithDifficulty.push({
                level: levelData.level,
                total_attempts: levelData.total_attempts,
                success_count: levelData.success_count,
                fail_count: levelData.fail_count,
                pass_rate: passRate,
                avg_defend_time: levelData.avg_defend_time,
                avg_operations: levelData.avg_operations,
                difficulty_label: difficultyLabel,
                difficulty_color: difficultyColor
            });
        }
        
        res.json({
            success: true,
            data: levelsWithDifficulty
        });
        
    } catch (error) {
        console.error('[Analytics] 批量查询关卡通关率失败:', error);
        res.status(500).json({
            success: false,
            message: '查询失败',
            error: error.message
        });
    }
});

/**
 * 更新玩家信息（名称和头像）
 * PUT /api/analytics/player/:playerId/profile
 */
app.put('/api/analytics/player/:playerId/profile', async (req, res) => {
    try {
        const { playerId } = req.params;
        const { player_name, player_avatar } = req.body;
        
        if (!playerId) {
            return res.status(400).json({
                success: false,
                message: '缺少玩家ID'
            });
        }
        
        // 验证名称长度
        if (player_name && player_name.length > 50) {
            return res.status(400).json({
                success: false,
                message: '玩家名称不能超过50个字符'
            });
        }
        
        // 验证头像长度
        if (player_avatar) {
            // 如果是 Base64（data:image 开头），允许更长（前端已限制文件<=2MB）
            if (player_avatar.startsWith('data:image')) {
                // 预留大约 3MB 的字符串长度空间
                if (player_avatar.length > 3 * 1024 * 1024) {
                    return res.status(400).json({
                        success: false,
                        message: '头像数据过大'
                    });
                }
            } else {
                // 普通 URL 情况下限制长度
                if (player_avatar.length > 500) {
                    return res.status(400).json({
                        success: false,
                        message: '头像URL过长'
                    });
                }
            }
        }
        
        // 构建更新字段
        const updateFields = [];
        const updateValues = [];
        
        if (player_name !== undefined) {
            updateFields.push('player_name = ?');
            updateValues.push(player_name || null);
        }
        
        if (player_avatar !== undefined) {
            updateFields.push('player_avatar = ?');
            updateValues.push(player_avatar || null);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: '没有需要更新的字段'
            });
        }
        
        updateValues.push(playerId);
        
        // 更新数据库
        const [result] = await pool.execute(
            `UPDATE player_statistics 
             SET ${updateFields.join(', ')} 
             WHERE player_id = ?`,
            updateValues
        );
        
        if (result.affectedRows === 0) {
            // 如果玩家不存在，尝试创建
            await pool.execute(
                `INSERT INTO player_statistics (player_id, player_name, player_avatar) 
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                    player_name = VALUES(player_name),
                    player_avatar = VALUES(player_avatar)`,
                [playerId, player_name || null, player_avatar || null]
            );
        }
        
        console.log(`[Analytics] 更新玩家信息成功: ${playerId}, name=${player_name || 'null'}, avatar=${player_avatar ? '已设置' : 'null'}`);
        
        res.json({
            success: true,
            message: '更新成功',
            data: {
                player_id: playerId,
                player_name: player_name || null,
                player_avatar: player_avatar || null
            }
        });
        
    } catch (error) {
        console.error('[Analytics] 更新玩家信息失败:', error);
        res.status(500).json({
            success: false,
            message: '更新失败',
            error: error.message
        });
    }
});

/**
 * 获取玩家信息（包括名称和头像）
 * GET /api/analytics/player/:playerId/profile
 */
app.get('/api/analytics/player/:playerId/profile', async (req, res) => {
    try {
        const { playerId } = req.params;
        
        const [rows] = await pool.execute(
            'SELECT player_id, player_name, player_avatar FROM player_statistics WHERE player_id = ?',
            [playerId]
        );
        
        if (rows.length === 0) {
            return res.json({
                success: true,
                data: {
                    player_id: playerId,
                    player_name: null,
                    player_avatar: null
                }
            });
        }
        
        res.json({
            success: true,
            data: rows[0]
        });
        
    } catch (error) {
        console.error('[Analytics] 查询玩家信息失败:', error);
        res.status(500).json({
            success: false,
            message: '查询失败',
            error: error.message
        });
    }
});

/**
 * ============================
 * 玩家反馈（设置页互动）
 * ============================
 */

// 提交反馈
// POST /api/feedback/create
// POST /api/analytics/feedback/create
// body: { playerId, content }
async function handleFeedbackCreate(req, res) {
    try {
        const { playerId, content } = req.body || {};
        if (!playerId || !content || typeof content !== 'string' || content.trim().length === 0) {
            return res.status(400).json({ success: false, message: '缺少 playerId 或 content' });
        }
        const text = content.trim().slice(0, 2000);
        const [result] = await pool.execute(
            `INSERT INTO player_feedback (player_id, content) VALUES (?, ?)`,
            [playerId, text]
        );
        res.json({ success: true, feedbackId: result.insertId });
    } catch (error) {
        console.error('[Feedback] create 失败:', error);
        res.status(500).json({ success: false, message: '服务器内部错误', error: error.message });
    }
}
app.post('/api/feedback/create', handleFeedbackCreate);
app.post('/api/analytics/feedback/create', handleFeedbackCreate);

// 获取反馈列表（全量按时间倒序，默认取前100条）
// GET /api/feedback/list?limit=100
// GET /api/analytics/feedback/list?limit=100
async function handleFeedbackList(req, res) {
    try {
        let limit = parseInt(req.query.limit);
        if (isNaN(limit) || limit <= 0) limit = 100;
        limit = Math.min(limit, 200);

        const [rows] = await pool.execute(
            `SELECT id, player_id, content, agree_count, disagree_count, created_at
             FROM player_feedback
             ORDER BY created_at DESC
             LIMIT ${limit}`
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('[Feedback] list 失败:', error);
        res.status(500).json({ success: false, message: '服务器内部错误', error: error.message });
    }
}
app.get('/api/feedback/list', handleFeedbackList);
app.get('/api/analytics/feedback/list', handleFeedbackList);

// 投票（赞同/不赞同，单玩家单反馈只能投一次；重复投票返回已投票）
// POST /api/feedback/vote
// POST /api/analytics/feedback/vote
// body: { playerId, feedbackId, vote: 'agree'|'disagree' }
async function handleFeedbackVote(req, res) {
    const startTime = Date.now();
    try {
        const { playerId, feedbackId, vote } = req.body || {};
        const fid = parseInt(feedbackId);
        if (!playerId || isNaN(fid) || fid <= 0 || (vote !== 'agree' && vote !== 'disagree')) {
            return res.status(400).json({ success: false, message: '参数错误' });
        }

        const conn = await pool.getConnection();
        await conn.beginTransaction();
        try {
            // 尝试插入投票记录（去重）
            const [ins] = await conn.execute(
                `INSERT INTO player_feedback_votes (feedback_id, player_id, vote)
                 VALUES (?, ?, ?)`,
                [fid, playerId, vote]
            );

            // 计数+1
            if (vote === 'agree') {
                await conn.execute(
                    `UPDATE player_feedback SET agree_count = agree_count + 1 WHERE id = ?`,
                    [fid]
                );
            } else {
                await conn.execute(
                    `UPDATE player_feedback SET disagree_count = disagree_count + 1 WHERE id = ?`,
                    [fid]
                );
            }

            await conn.commit();
            conn.release();

            res.json({ success: true, processingTime: Date.now() - startTime });
        } catch (e) {
            await conn.rollback();
            conn.release();

            // 重复投票（唯一键冲突）
            if (e && e.code === 'ER_DUP_ENTRY') {
                return res.json({ success: true, duplicate: true, message: '已投票' });
            }
            throw e;
        }
    } catch (error) {
        console.error('[Feedback] vote 失败:', error);
        res.status(500).json({ success: false, message: '服务器内部错误', error: error.message });
    }
}
app.post('/api/feedback/vote', handleFeedbackVote);
app.post('/api/analytics/feedback/vote', handleFeedbackVote);

// 提交评论
// POST /api/feedback/comment
// POST /api/analytics/feedback/comment
// body: { playerId, feedbackId, content }
async function handleFeedbackComment(req, res) {
    try {
        const { playerId, feedbackId, content } = req.body || {};
        const fid = parseInt(feedbackId);
        if (!playerId || isNaN(fid) || fid <= 0 || !content || typeof content !== 'string' || content.trim().length === 0) {
            return res.status(400).json({ success: false, message: '参数错误' });
        }
        const text = content.trim().slice(0, 2000);
        const [result] = await pool.execute(
            `INSERT INTO player_feedback_comments (feedback_id, player_id, content) VALUES (?, ?, ?)`,
            [fid, playerId, text]
        );
        res.json({ success: true, commentId: result.insertId });
    } catch (error) {
        console.error('[Feedback] comment 失败:', error);
        res.status(500).json({ success: false, message: '服务器内部错误', error: error.message });
    }
}
app.post('/api/feedback/comment', handleFeedbackComment);
app.post('/api/analytics/feedback/comment', handleFeedbackComment);

// 获取评论列表
// GET /api/feedback/:feedbackId/comments?limit=100
// GET /api/analytics/feedback/:feedbackId/comments?limit=100
async function handleFeedbackComments(req, res) {
    try {
        const fid = parseInt(req.params.feedbackId);
        if (isNaN(fid) || fid <= 0) {
            return res.status(400).json({ success: false, message: '参数错误' });
        }
        let limit = parseInt(req.query.limit);
        if (isNaN(limit) || limit <= 0) limit = 100;
        limit = Math.min(limit, 200);

        const [rows] = await pool.execute(
            `SELECT id, feedback_id, player_id, content, created_at
             FROM player_feedback_comments
             WHERE feedback_id = ?
             ORDER BY created_at ASC
             LIMIT ${limit}`,
            [fid]
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('[Feedback] comments 失败:', error);
        res.status(500).json({ success: false, message: '服务器内部错误', error: error.message });
    }
}
app.get('/api/feedback/:feedbackId/comments', handleFeedbackComments);
app.get('/api/analytics/feedback/:feedbackId/comments', handleFeedbackComments);

// 启动服务器
app.listen(PORT, () => {
    console.log(`游戏埋点API服务已启动，监听端口: ${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/api/health`);
    console.log(`数据上报: http://localhost:${PORT}/api/analytics/report`);
});

// 优雅关闭
process.on('SIGTERM', async () => {
    console.log('收到SIGTERM信号，正在关闭服务...');
    await pool.end();
    process.exit(0);
});
