# 游戏埋点功能集成指南

## 一、集成步骤

### 1. 在 Canvas 节点上添加 AnalyticsManager 组件

在 Cocos Creator 编辑器中：
1. 选择场景中的 Canvas 节点
2. 在属性检查器中点击"添加组件"
3. 选择"自定义组件" -> "AnalyticsManager"

### 2. 在 GameManager 中引入 AnalyticsManager

在 `GameManager.ts` 文件顶部添加导入：

```typescript
import { AnalyticsManager, OperationType } from './AnalyticsManager';
```

在 GameManager 类中添加成员变量：

```typescript
private analyticsManager: AnalyticsManager | null = null;
```

在 `start()` 或 `onLoad()` 方法中初始化：

```typescript
start() {
    // ... 其他初始化代码
    
    // 初始化埋点管理器
    this.analyticsManager = AnalyticsManager.getInstance();
}
```

### 3. 在游戏开始时启动记录

在开始游戏的方法中（例如 `startGame()` 或 `onStartGameButtonClick()`）：

```typescript
startGame(level: number) {
    // ... 其他游戏开始逻辑
    
    // 开始记录埋点
    if (this.analyticsManager) {
        this.analyticsManager.startRecording(level);
    }
    
    this.gameState = GameState.Playing;
    // ...
}
```

### 4. 在游戏结束时上报数据

在游戏结束的方法中（例如 `showGameOver()` 或 `gameOver()`）：

```typescript
async showGameOver(isSuccess: boolean) {
    // ... 其他游戏结束逻辑
    
    // 上报埋点数据
    if (this.analyticsManager) {
        const result = isSuccess ? 'success' : 'fail';
        
        // 异步上报，不阻塞游戏流程
        this.analyticsManager.reportGameData(
            result,
            this.gameTime,           // 已防御时间
            this.currentWave,        // 当前波次
            this.gold,               // 最终金币
            this.population,         // 最终人口
            this.totalKillCount      // 击杀数（需要添加此变量）
        ).then(success => {
            if (success) {
                console.log('[Game] 埋点数据上报成功');
            } else {
                console.warn('[Game] 埋点数据上报失败，但不影响游戏');
            }
        }).catch(error => {
            console.error('[Game] 埋点上报异常:', error);
        });
    }
    
    // 显示游戏结束界面
    // ...
}
```

### 5. 在退出游戏时上报数据

在退出游戏的方法中（例如 `onExitGameButtonClick()`）：

```typescript
onExitGameButtonClick() {
    // 上报埋点数据（游戏未完成，算作失败）
    if (this.analyticsManager && this.gameState === GameState.Playing) {
        this.analyticsManager.reportGameData(
            'fail',
            this.gameTime,
            this.currentWave,
            this.gold,
            this.population,
            this.totalKillCount
        ).then(() => {
            // 数据上报完成后再退出
            this.exitGame();
        }).catch(() => {
            // 即使上报失败也要退出
            this.exitGame();
        });
    } else {
        this.exitGame();
    }
}

private exitGame() {
    // 实际的退出逻辑
    this.gameState = GameState.Ready;
    // ... 清理游戏状态
}
```

## 二、记录各种操作

### 1. 建造建筑物

在建造建筑的方法中（例如 `TowerBuilder.ts` 或 `BuildingGridPanel.ts`）：

```typescript
// 在 TowerBuilder.ts 或相关文件中
import { AnalyticsManager, OperationType } from './AnalyticsManager';

buildWatchTower(position: Vec3) {
    // ... 建造逻辑
    
    // 记录操作
    const analytics = AnalyticsManager.getInstance();
    if (analytics) {
        const gameManager = this.getGameManager(); // 获取 GameManager 实例
        analytics.recordOperation(
            OperationType.BUILD_WATCHTOWER,
            gameManager.getGameTime(), // 需要添加 getGameTime() 方法
            { position: { x: position.x, y: position.y } }
        );
    }
}

buildWarAncientTree(position: Vec3) {
    // ... 建造逻辑
    
    const analytics = AnalyticsManager.getInstance();
    if (analytics) {
        analytics.recordOperation(
            OperationType.BUILD_WAR_ANCIENT_TREE,
            this.getGameTime(),
            { position: { x: position.x, y: position.y } }
        );
    }
}

// 其他建筑物类似：
// BUILD_HUNTER_HALL, BUILD_SWORDSMAN_HALL, BUILD_CHURCH, 
// BUILD_MOON_WELL, BUILD_STONE_WALL, BUILD_TREE,
// BUILD_THUNDER_TOWER, BUILD_ICE_TOWER
```

### 2. 训练单位

在训练单位的方法中（例如 `WarAncientTree.ts`）：

```typescript
// 在 WarAncientTree.ts 或相关建筑脚本中
import { AnalyticsManager, OperationType } from './AnalyticsManager';

trainArrower() {
    // ... 训练逻辑
    
    const analytics = AnalyticsManager.getInstance();
    if (analytics) {
        analytics.recordOperation(
            OperationType.TRAIN_ARROWER,
            this.getGameTime(),
            { buildingId: this.node.uuid }
        );
    }
}

// 其他单位类似：
// TRAIN_HUNTER, TRAIN_SWORDSMAN, TRAIN_PRIEST, TRAIN_WISP
```

### 3. 升级单位/建筑

在升级方法中：

```typescript
upgradeUnit(unit: Node) {
    // ... 升级逻辑
    
    const analytics = AnalyticsManager.getInstance();
    if (analytics) {
        analytics.recordOperation(
            OperationType.UPGRADE_UNIT,
            this.getGameTime(),
            { 
                unitType: unit.name,
                level: this.getUnitLevel(unit)
            }
        );
    }
}

upgradeBuilding(building: Node) {
    // ... 升级逻辑
    
    const analytics = AnalyticsManager.getInstance();
    if (analytics) {
        analytics.recordOperation(
            OperationType.UPGRADE_BUILDING,
            this.getGameTime(),
            { 
                buildingType: building.name,
                level: this.getBuildingLevel(building)
            }
        );
    }
}
```

### 4. 回收单位/建筑

在回收方法中：

```typescript
recycleUnit(unit: Node) {
    // ... 回收逻辑
    
    const analytics = AnalyticsManager.getInstance();
    if (analytics) {
        analytics.recordOperation(
            OperationType.RECYCLE_UNIT,
            this.getGameTime(),
            { unitType: unit.name }
        );
    }
}

recycleBuilding(building: Node) {
    // ... 回收逻辑
    
    const analytics = AnalyticsManager.getInstance();
    if (analytics) {
        analytics.recordOperation(
            OperationType.RECYCLE_BUILDING,
            this.getGameTime(),
            { buildingType: building.name }
        );
    }
}
```

### 5. 选择增益卡片

在 `BuffCardPopup.ts` 中：

```typescript
import { AnalyticsManager, OperationType } from './AnalyticsManager';

onCardSelected(cardData: BuffCardData) {
    // ... 卡片选择逻辑
    
    const analytics = AnalyticsManager.getInstance();
    if (analytics) {
        analytics.recordOperation(
            OperationType.SELECT_BUFF_CARD,
            this.getGameTime(),
            { 
                cardType: cardData.unitType,
                buffType: cardData.buffType,
                rarity: cardData.rarity
            }
        );
    }
}
```

### 6. 使用天赋点

在 `TalentSystem.ts` 中：

```typescript
import { AnalyticsManager, OperationType } from './AnalyticsManager';

useTalentPoint(talentType: string) {
    // ... 天赋点使用逻辑
    
    const analytics = AnalyticsManager.getInstance();
    if (analytics) {
        analytics.recordOperation(
            OperationType.USE_TALENT_POINT,
            this.getGameTime(),
            { talentType: talentType }
        );
    }
}
```

## 三、在 GameManager 中添加辅助方法

在 `GameManager.ts` 中添加以下方法：

```typescript
/**
 * 获取当前游戏时间（供埋点使用）
 */
public getGameTime(): number {
    return this.gameTime;
}

/**
 * 获取当前波次（供埋点使用）
 */
public getCurrentWave(): number {
    return this.currentWave;
}

/**
 * 获取当前关卡（供埋点使用）
 */
public getCurrentLevel(): number {
    return this.currentLevel;
}

/**
 * 添加击杀数统计
 */
private totalKillCount: number = 0;

public addKillCount(count: number = 1) {
    this.totalKillCount += count;
}

public getTotalKillCount(): number {
    return this.totalKillCount;
}

/**
 * 重置游戏时清空击杀数
 */
resetGameStateForRestart() {
    // ... 其他重置逻辑
    this.totalKillCount = 0;
}
```

## 四、在敌人死亡时记录击杀

在 `Enemy.ts` 中：

```typescript
onDeath() {
    // ... 死亡逻辑
    
    // 增加击杀数
    const gameManager = this.getGameManager();
    if (gameManager) {
        gameManager.addKillCount(1);
    }
}
```

## 五、测试埋点功能

### 1. 本地测试

在浏览器控制台中查看日志：
- 游戏开始时应该看到 `[AnalyticsManager] 开始记录关卡 X`
- 每次操作都应该看到 `[AnalyticsManager] 记录操作: xxx`
- 游戏结束时应该看到 `[AnalyticsManager] 准备上报数据`

### 2. 模拟服务器测试

如果服务器还未部署，可以临时修改 `AnalyticsManager.ts` 中的 `SERVER_URL`：

```typescript
// 临时使用 mock 服务器
private readonly SERVER_URL = 'https://httpbin.org/post';
```

这样可以看到请求是否成功发送。

### 3. 查看上报的数据

在浏览器开发者工具的 Network 标签中：
- 筛选 XHR 请求
- 查找发送到 `/api/analytics/report` 的 POST 请求
- 查看 Request Payload 中的数据格式是否正确

## 六、注意事项

1. **不阻塞游戏流程**：所有埋点操作都是异步的，失败不会影响游戏
2. **数据大小限制**：单局游戏操作数过多时，JSON 可能很大，注意服务器限制
3. **网络超时**：设置了 5 秒超时，避免长时间等待
4. **玩家隐私**：只记录游戏操作，不收集个人信息
5. **性能影响**：埋点操作很轻量，对游戏性能影响极小

## 七、常见问题

### Q1: 埋点数据没有上报？
A: 检查：
- 浏览器控制台是否有错误
- 服务器是否正常运行
- 网络是否连通
- CORS 是否配置正确

### Q2: 如何查看已上报的数据？
A: 登录数据库查询：
```sql
SELECT * FROM game_records ORDER BY end_time DESC LIMIT 10;
```

### Q3: 如何禁用埋点？
A: 在 `AnalyticsManager.ts` 的 `sendToServer` 方法开头添加：
```typescript
return Promise.resolve(true); // 直接返回成功，不实际发送
```

## 八、后续优化建议

1. **批量上报**：收集多局游戏数据后一次性上报
2. **离线缓存**：网络失败时保存到本地，下次联网时上报
3. **数据压缩**：对大量操作数据进行压缩
4. **采样上报**：只上报部分玩家的数据，减轻服务器压力
5. **实时分析**：接入数据分析平台，实时查看玩家行为
