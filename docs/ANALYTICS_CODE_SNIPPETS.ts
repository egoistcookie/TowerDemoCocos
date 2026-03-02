/**
 * 游戏埋点快速集成代码片段
 * 将以下代码复制到对应文件中
 */

// ============================================
// 1. GameManager.ts - 添加到类的顶部
// ============================================

import { AnalyticsManager, OperationType } from './AnalyticsManager';

// 在 GameManager 类中添加成员变量
private analyticsManager: AnalyticsManager | null = null;
private totalKillCount: number = 0;

// ============================================
// 2. GameManager.ts - 在 start() 或 onLoad() 中初始化
// ============================================

start() {
    // ... 其他初始化代码
    
    // 初始化埋点管理器
    this.analyticsManager = AnalyticsManager.getInstance();
    
    // ...
}

// ============================================
// 3. GameManager.ts - 在开始游戏时启动记录
// ============================================

// 找到开始游戏的方法，添加以下代码
startGame(level: number) {
    // ... 其他游戏开始逻辑
    
    // 开始记录埋点
    if (this.analyticsManager) {
        this.analyticsManager.startRecording(level);
    }
    
    // 重置击杀数
    this.totalKillCount = 0;
    
    this.gameState = GameState.Playing;
    // ...
}

// ============================================
// 4. GameManager.ts - 在游戏结束时上报数据
// ============================================

// 找到游戏结束的方法，添加以下代码
showGameOver(isSuccess: boolean) {
    // ... 其他游戏结束逻辑
    
    // 上报埋点数据（异步，不阻塞游戏）
    if (this.analyticsManager) {
        const result = isSuccess ? 'success' : 'fail';
        
        this.analyticsManager.reportGameData(
            result,
            Math.floor(this.gameTime),      // 已防御时间（秒）
            this.currentWave || 0,          // 当前波次
            this.gold || 0,                 // 最终金币
            this.population || 0,           // 最终人口
            this.totalKillCount || 0        // 击杀数
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

// ============================================
// 5. GameManager.ts - 在退出游戏时上报数据
// ============================================

// 找到退出游戏按钮的回调方法
onExitGameButtonClick() {
    // 如果游戏正在进行，先上报数据
    if (this.analyticsManager && this.gameState === GameState.Playing) {
        this.analyticsManager.reportGameData(
            'fail',  // 主动退出算作失败
            Math.floor(this.gameTime),
            this.currentWave || 0,
            this.gold || 0,
            this.population || 0,
            this.totalKillCount || 0
        ).then(() => {
            console.log('[Game] 退出前数据已上报');
        }).catch(() => {
            console.warn('[Game] 退出前数据上报失败');
        }).finally(() => {
            // 无论上报成功与否，都继续退出流程
            this.performExit();
        });
    } else {
        this.performExit();
    }
}

// 实际的退出逻辑
private performExit() {
    this.gameState = GameState.Ready;
    // ... 其他退出逻辑
}

// ============================================
// 6. GameManager.ts - 添加辅助方法
// ============================================

/**
 * 获取当前游戏时间（供其他脚本调用）
 */
public getGameTime(): number {
    return this.gameTime;
}

/**
 * 增加击杀数
 */
public addKillCount(count: number = 1) {
    this.totalKillCount += count;
}

/**
 * 获取击杀数
 */
public getTotalKillCount(): number {
    return this.totalKillCount;
}

// ============================================
// 7. Enemy.ts - 在敌人死亡时记录击杀
// ============================================

// 在 Enemy.ts 的死亡方法中添加
onDeath() {
    // ... 其他死亡逻辑
    
    // 增加击杀数统计
    const gameManager = find('Canvas/GameManager')?.getComponent('GameManager');
    if (gameManager && gameManager.addKillCount) {
        gameManager.addKillCount(1);
    }
    
    // ...
}

// ============================================
// 8. TowerBuilder.ts - 记录建造操作
// ============================================

import { AnalyticsManager, OperationType } from './AnalyticsManager';

// 在建造方法中添加
buildWatchTower(position: Vec3) {
    // ... 建造逻辑
    
    // 记录操作
    const analytics = AnalyticsManager.getInstance();
    const gameManager = find('Canvas/GameManager')?.getComponent('GameManager');
    if (analytics && gameManager) {
        analytics.recordOperation(
            OperationType.BUILD_WATCHTOWER,
            gameManager.getGameTime(),
            { position: { x: position.x, y: position.y } }
        );
    }
}

// 其他建筑物类似，使用对应的 OperationType：
// BUILD_WAR_ANCIENT_TREE
// BUILD_HUNTER_HALL
// BUILD_SWORDSMAN_HALL
// BUILD_CHURCH
// BUILD_MOON_WELL
// BUILD_STONE_WALL
// BUILD_TREE
// BUILD_THUNDER_TOWER
// BUILD_ICE_TOWER

// ============================================
// 9. WarAncientTree.ts - 记录训练操作
// ============================================

import { AnalyticsManager, OperationType } from './AnalyticsManager';

// 在训练方法中添加
trainArrower() {
    // ... 训练逻辑
    
    // 记录操作
    const analytics = AnalyticsManager.getInstance();
    const gameManager = find('Canvas/GameManager')?.getComponent('GameManager');
    if (analytics && gameManager) {
        analytics.recordOperation(
            OperationType.TRAIN_ARROWER,
            gameManager.getGameTime(),
            { buildingId: this.node.uuid }
        );
    }
}

// 其他单位类似，使用对应的 OperationType：
// TRAIN_HUNTER
// TRAIN_SWORDSMAN
// TRAIN_PRIEST
// TRAIN_WISP

// ============================================
// 10. UnitInfoPanel.ts - 记录升级和回收操作
// ============================================

import { AnalyticsManager, OperationType } from './AnalyticsManager';

// 升级单位
onUpgradeButtonClick() {
    // ... 升级逻辑
    
    const analytics = AnalyticsManager.getInstance();
    const gameManager = find('Canvas/GameManager')?.getComponent('GameManager');
    if (analytics && gameManager) {
        analytics.recordOperation(
            OperationType.UPGRADE_UNIT,
            gameManager.getGameTime(),
            { 
                unitType: this.currentUnit?.name,
                level: this.getUnitLevel()
            }
        );
    }
}

// 回收单位
onRecycleButtonClick() {
    // ... 回收逻辑
    
    const analytics = AnalyticsManager.getInstance();
    const gameManager = find('Canvas/GameManager')?.getComponent('GameManager');
    if (analytics && gameManager) {
        analytics.recordOperation(
            OperationType.RECYCLE_UNIT,
            gameManager.getGameTime(),
            { unitType: this.currentUnit?.name }
        );
    }
}

// 升级建筑
onUpgradeBuildingClick() {
    // ... 升级逻辑
    
    const analytics = AnalyticsManager.getInstance();
    const gameManager = find('Canvas/GameManager')?.getComponent('GameManager');
    if (analytics && gameManager) {
        analytics.recordOperation(
            OperationType.UPGRADE_BUILDING,
            gameManager.getGameTime(),
            { 
                buildingType: this.currentBuilding?.name,
                level: this.getBuildingLevel()
            }
        );
    }
}

// 回收建筑
onRecycleBuildingClick() {
    // ... 回收逻辑
    
    const analytics = AnalyticsManager.getInstance();
    const gameManager = find('Canvas/GameManager')?.getComponent('GameManager');
    if (analytics && gameManager) {
        analytics.recordOperation(
            OperationType.RECYCLE_BUILDING,
            gameManager.getGameTime(),
            { buildingType: this.currentBuilding?.name }
        );
    }
}

// ============================================
// 11. BuffCardPopup.ts - 记录卡片选择
// ============================================

import { AnalyticsManager, OperationType } from './AnalyticsManager';

// 在卡片选择方法中添加
onCardSelected(cardData: BuffCardData) {
    // ... 卡片选择逻辑
    
    const analytics = AnalyticsManager.getInstance();
    const gameManager = find('Canvas/GameManager')?.getComponent('GameManager');
    if (analytics && gameManager) {
        analytics.recordOperation(
            OperationType.SELECT_BUFF_CARD,
            gameManager.getGameTime(),
            { 
                cardType: cardData.unitType,
                buffType: cardData.buffType,
                rarity: cardData.rarity
            }
        );
    }
}

// ============================================
// 12. TalentSystem.ts - 记录天赋点使用
// ============================================

import { AnalyticsManager, OperationType } from './AnalyticsManager';

// 在使用天赋点的方法中添加
onUpgradeTalent(talentType: string) {
    // ... 天赋升级逻辑
    
    const analytics = AnalyticsManager.getInstance();
    const gameManager = find('Canvas/GameManager')?.getComponent('GameManager');
    if (analytics && gameManager) {
        analytics.recordOperation(
            OperationType.USE_TALENT_POINT,
            gameManager.getGameTime(),
            { talentType: talentType }
        );
    }
}

// ============================================
// 集成完成！
// ============================================

/**
 * 集成检查清单：
 * 
 * □ 1. 已将 AnalyticsManager.ts 放入 assets/scripts/ 目录
 * □ 2. 在 Canvas 节点上添加了 AnalyticsManager 组件
 * □ 3. GameManager 中已初始化 analyticsManager
 * □ 4. 游戏开始时调用 startRecording()
 * □ 5. 游戏结束时调用 reportGameData()
 * □ 6. 退出游戏时调用 reportGameData()
 * □ 7. 各种操作中调用 recordOperation()
 * □ 8. 敌人死亡时调用 addKillCount()
 * □ 9. 数据库已创建并配置
 * □ 10. 后端 API 服务已部署
 * □ 11. 已测试数据上报功能
 * 
 * 测试方法：
 * 1. 打开浏览器控制台
 * 2. 开始游戏
 * 3. 进行各种操作（建造、训练、升级等）
 * 4. 结束游戏或退出
 * 5. 查看控制台日志，确认数据已上报
 * 6. 查看数据库，确认数据已入库
 */
