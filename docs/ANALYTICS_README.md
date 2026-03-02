# 游戏埋点系统

## 概述

本系统为塔防游戏提供完整的玩家行为数据采集、存储和分析功能。通过记录玩家的操作序列，帮助开发者了解玩家行为，优化游戏体验。

## 功能特性

✅ **完整的操作记录**：记录建造、训练、升级、回收等所有玩家操作  
✅ **游戏结果追踪**：记录通关/失败、防御时间、波次、击杀数等关键数据  
✅ **异步上报**：不阻塞游戏流程，失败不影响游戏正常运行  
✅ **数据持久化**：MySQL数据库存储，支持复杂查询和统计分析  
✅ **玩家统计**：自动统计玩家游戏次数、胜率、最高关卡等  
✅ **关卡分析**：统计各关卡难度、通过率、平均操作数等  
✅ **RESTful API**：提供标准的HTTP接口，易于集成和扩展  

## 系统架构

```
┌─────────────────┐
│   Cocos游戏客户端  │
│  AnalyticsManager │
└────────┬────────┘
         │ HTTPS POST
         ▼
┌─────────────────┐
│   Nginx反向代理   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Node.js API服务 │
│   Express框架    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MySQL数据库     │
│  4张表 + 视图    │
└─────────────────┘
```

## 文件结构

```
TowerDemoCocos/
├── assets/scripts/
│   └── AnalyticsManager.ts          # 客户端埋点管理器
├── database/
│   └── game_analytics.sql           # 数据库表结构
├── server/
│   ├── analytics-api.js             # 后端API服务
│   ├── package.json                 # Node.js依赖配置
│   └── DEPLOYMENT.md                # 服务器部署指南
└── docs/
    ├── ANALYTICS_INTEGRATION.md     # 集成指南
    ├── ANALYTICS_CODE_SNIPPETS.ts   # 代码片段
    └── README.md                    # 本文件
```

## 快速开始

### 1. 客户端集成（5分钟）

```typescript
// 1. 在 Canvas 节点添加 AnalyticsManager 组件

// 2. 在 GameManager.ts 中初始化
import { AnalyticsManager, OperationType } from './AnalyticsManager';

start() {
    this.analyticsManager = AnalyticsManager.getInstance();
}

// 3. 游戏开始时启动记录
startGame(level: number) {
    this.analyticsManager?.startRecording(level);
}

// 4. 游戏结束时上报数据
showGameOver(isSuccess: boolean) {
    this.analyticsManager?.reportGameData(
        isSuccess ? 'success' : 'fail',
        this.gameTime,
        this.currentWave,
        this.gold,
        this.population,
        this.totalKillCount
    );
}

// 5. 记录操作
buildTower() {
    this.analyticsManager?.recordOperation(
        OperationType.BUILD_WATCHTOWER,
        this.gameTime
    );
}
```

### 2. 数据库部署（3分钟）

```bash
# 登录MySQL
mysql -u root -p

# 执行初始化脚本
source /path/to/game_analytics.sql

# 验证
USE tower_defense_analytics;
SHOW TABLES;
```

### 3. API服务部署（5分钟）

```bash
# 安装依赖
cd server
npm install

# 启动服务
pm2 start analytics-api.js --name tower-analytics

# 测试
curl http://localhost:3000/api/health
```

## 数据库表结构

### 1. game_records（游戏记录主表）
存储每局游戏的完整数据，包括操作序列JSON。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 记录ID |
| player_id | VARCHAR(100) | 玩家ID |
| level | INT | 关卡数 |
| result | ENUM | 游戏结果（success/fail） |
| operations_json | TEXT | 操作序列JSON |
| end_time | BIGINT | 结束时间戳 |
| defend_time | INT | 已防御时间（秒） |
| current_wave | INT | 当前波次 |
| final_gold | INT | 最终金币数 |
| final_population | INT | 最终人口数 |
| kill_count | INT | 击杀数 |

### 2. player_statistics（玩家统计表）
汇总每个玩家的游戏统计数据。

| 字段 | 类型 | 说明 |
|------|------|------|
| player_id | VARCHAR(100) | 玩家ID |
| total_games | INT | 总游戏局数 |
| success_games | INT | 成功局数 |
| max_level | INT | 最高通关关卡 |
| total_kills | BIGINT | 累计击杀数 |

### 3. operation_statistics（操作统计表）
统计每个玩家各类操作的使用频率。

### 4. level_statistics（关卡统计表）
统计各关卡的难度和通过率。

## API接口

### 1. 数据上报
```
POST /api/analytics/report
Content-Type: application/json

{
  "playerId": "player_123",
  "level": 1,
  "operations": [...],
  "result": "success",
  "endTime": 1234567890,
  "defendTime": 180,
  "currentWave": 10,
  "finalGold": 50,
  "finalPopulation": 15,
  "killCount": 100
}
```

### 2. 查询玩家统计
```
GET /api/analytics/player/{playerId}
```

### 3. 查询排行榜
```
GET /api/analytics/leaderboard?limit=10
```

### 4. 查询关卡统计
```
GET /api/analytics/levels
```

## 记录的操作类型

| 操作类型 | 说明 |
|---------|------|
| BUILD_WATCHTOWER | 建造哨塔 |
| BUILD_WAR_ANCIENT_TREE | 建造战争古树 |
| BUILD_HUNTER_HALL | 建造猎手大厅 |
| BUILD_SWORDSMAN_HALL | 建造剑士小屋 |
| BUILD_CHURCH | 建造教堂 |
| BUILD_MOON_WELL | 建造月亮井 |
| BUILD_STONE_WALL | 建造石墙 |
| BUILD_TREE | 建造树木 |
| BUILD_THUNDER_TOWER | 建造雷塔 |
| BUILD_ICE_TOWER | 建造冰塔 |
| TRAIN_ARROWER | 训练弓箭手 |
| TRAIN_HUNTER | 训练女猎手 |
| TRAIN_SWORDSMAN | 训练剑士 |
| TRAIN_PRIEST | 训练牧师 |
| TRAIN_WISP | 训练小精灵 |
| UPGRADE_UNIT | 升级单位 |
| RECYCLE_UNIT | 回收单位 |
| UPGRADE_BUILDING | 升级建筑 |
| RECYCLE_BUILDING | 回收建筑 |
| SELECT_BUFF_CARD | 选择增益卡片 |
| USE_TALENT_POINT | 使用天赋点 |

## 数据分析示例

### 查询玩家排行榜
```sql
SELECT * FROM player_leaderboard LIMIT 10;
```

### 查询关卡难度
```sql
SELECT * FROM level_difficulty_analysis;
```

### 查询最常用的操作
```sql
SELECT operation_type, SUM(count) as total_count 
FROM operation_statistics 
GROUP BY operation_type 
ORDER BY total_count DESC;
```

### 查询某玩家的游戏历史
```sql
SELECT 
    level,
    result,
    defend_time,
    current_wave,
    kill_count,
    FROM_UNIXTIME(end_time/1000) as play_time
FROM game_records 
WHERE player_id = 'player_xxx' 
ORDER BY end_time DESC 
LIMIT 10;
```

### 分析玩家操作序列
```sql
SELECT 
    player_id,
    level,
    JSON_LENGTH(operations_json) as operation_count,
    operations_json
FROM game_records 
WHERE result = 'success' AND level = 5
ORDER BY operation_count ASC
LIMIT 5;
```

## 性能优化

1. **数据库索引**：已为常用查询字段创建索引
2. **连接池**：使用MySQL连接池，提高并发性能
3. **异步处理**：客户端异步上报，不阻塞游戏
4. **超时控制**：5秒超时，避免长时间等待
5. **批量操作**：使用存储过程批量更新统计数据

## 安全建议

1. ✅ 使用强密码（已配置示例密码）
2. ✅ 限制数据库访问IP
3. ✅ 启用HTTPS（Nginx配置）
4. ✅ 定期备份数据库
5. ✅ 监控异常请求
6. ✅ 限制请求频率（可在Nginx配置）

## 故障处理

### 客户端上报失败
- 不影响游戏正常运行
- 控制台会输出警告日志
- 可在浏览器Network面板查看请求详情

### 服务器异常
- 检查PM2进程状态：`pm2 status`
- 查看错误日志：`pm2 logs tower-analytics`
- 重启服务：`pm2 restart tower-analytics`

### 数据库连接失败
- 检查MySQL服务：`systemctl status mysql`
- 检查用户权限：`SHOW GRANTS FOR 'tower_game_user'@'%';`
- 查看错误日志：`tail -f /var/log/mysql/error.log`

## 扩展功能

### 1. 实时数据看板
可以基于数据库数据开发实时数据看板，展示：
- 在线玩家数
- 实时通关率
- 热门操作排行
- 关卡难度曲线

### 2. A/B测试
记录不同版本的游戏数据，对比分析：
- 不同难度设置的通过率
- 不同UI布局的操作效率
- 不同奖励机制的留存率

### 3. 玩家画像
基于操作数据分析玩家类型：
- 激进型：快速建造，高风险高收益
- 稳健型：防御为主，步步为营
- 经济型：注重资源管理，精打细算

### 4. 智能推荐
根据玩家历史数据推荐：
- 适合的关卡难度
- 推荐的建造策略
- 个性化的天赋加点方案

## 技术支持

- 集成文档：`docs/ANALYTICS_INTEGRATION.md`
- 代码示例：`docs/ANALYTICS_CODE_SNIPPETS.ts`
- 部署指南：`server/DEPLOYMENT.md`

## 更新日志

### v1.0.0 (2026-03-02)
- ✅ 完成客户端埋点管理器
- ✅ 完成数据库表结构设计
- ✅ 完成后端API服务
- ✅ 完成部署文档
- ✅ 完成集成指南

## 许可证

MIT License

---

**祝游戏开发顺利！** 🎮
