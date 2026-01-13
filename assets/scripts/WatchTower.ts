import { _decorator, Node, Vec3, find, Prefab, instantiate, SpriteFrame, AudioClip, Graphics, UITransform, Color } from 'cc';
import { Build } from './Build';
import { UnitInfo } from './UnitInfoPanel';
import { StoneWallGridPanel } from './StoneWallGridPanel';
import { UnitType } from './WarAncientTree';
import { BuildingPool } from './BuildingPool';
import { GameManager, GameState } from './GameManager';
import { Arrow } from './Arrow';
import { AudioManager } from './AudioManager';
import { UnitManager } from './UnitManager';
const { ccclass, property } = _decorator;

// 占领状态枚举
enum CaptureState {
    Neutral = 0,  // 中立
    Friendly = 1, // 我方
    Enemy = 2     // 敌方
}

@ccclass('WatchTower')
export class WatchTower extends Build {
    // 哨塔特有属性
    @property
    goldReward: number = 2; // 回收获得的金币

    // 攻击相关属性
    @property
    attackRange: number = 250; // 攻击范围

    @property
    attackDamage: number = 15; // 攻击伤害

    @property
    attackInterval: number = 1.2; // 攻击间隔（秒）

    @property(Prefab)
    arrowPrefab: Prefab = null!; // 弓箭预制体

    @property(AudioClip)
    shootSound: AudioClip = null!; // 箭矢射出时的音效

    @property(AudioClip)
    hitSound: AudioClip = null!; // 箭矢击中敌人时的音效

    // 攻击相关私有属性
    protected attackTimer: number = 0; // 攻击计时器
    protected currentTarget: Node = null!; // 当前攻击目标
    protected targetFindTimer: number = 0; // 目标查找计时器
    protected readonly TARGET_FIND_INTERVAL: number = 0.2; // 目标查找间隔（秒）
    protected hasFoundFirstTarget: boolean = false; // 是否已经找到过第一个目标

    // 占领相关属性
    private captureState: CaptureState = CaptureState.Neutral; // 当前占领状态
    private captureProgress: number = 0; // 占领进度（0-5秒）
    private readonly CAPTURE_TIME: number = 5.0; // 占领所需时间（秒）
    private captureIndicator: Node = null!; // 占领指示器节点（圆弧）
    private captureIndicatorGraphics: Graphics = null!; // 占领指示器Graphics组件
    private lastFriendlyCount: number = 0; // 上次检测到的我方单位数量
    private lastEnemyCount: number = 0; // 上次检测到的敌方单位数量
    private lastAdvantage: 'friendly' | 'enemy' | 'balanced' = 'balanced'; // 上次的优势方
    private unitManager: UnitManager = null!; // 单位管理器引用

    /**
     * 当哨塔从对象池激活时调用（用于对象池复用）
     */
    onEnable() {
        // 调用父类onEnable方法
        super.onEnable();
        
        // 初始化攻击相关属性
        this.attackTimer = 0;
        this.currentTarget = null!;
        this.targetFindTimer = 0;
        this.hasFoundFirstTarget = false;
        
        // 初始化占领相关属性
        this.captureState = CaptureState.Neutral;
        this.captureProgress = 0;
        this.lastFriendlyCount = 0;
        this.lastEnemyCount = 0;
        this.lastAdvantage = 'balanced';
        this.hideCaptureIndicator();
        
        // 获取UnitManager
        this.unitManager = UnitManager.getInstance();
    }

    protected start() {
        // 设置单位类型
        this.unitType = UnitType.BUILDING;
        
        // 调用父类start方法
        super.start();
        
        // 设置哨塔高度为两个网格（100像素）
        const uiTransform = this.node.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.setContentSize(uiTransform.width, 100); // 高度设为100（两个网格）
        }
        
        // 初始化攻击相关属性
        this.attackTimer = 0;
        this.currentTarget = null!;
        this.targetFindTimer = 0;
        this.hasFoundFirstTarget = false;
        
        // 初始化占领相关属性
        this.captureState = CaptureState.Neutral;
        this.captureProgress = 0;
        this.lastFriendlyCount = 0;
        this.lastEnemyCount = 0;
        this.lastAdvantage = 'balanced';
        this.hideCaptureIndicator();
        
        // 获取UnitManager
        this.unitManager = UnitManager.getInstance();
    }

    /**
     * 查找网格面板（重写以支持石墙网格）
     */
    protected findGridPanel() {
        // 查找石墙网格面板
        const stoneWallGridPanelNode = find('StoneWallGridPanel');
        if (stoneWallGridPanelNode) {
            // 使用类型断言，因为StoneWallGridPanel和BuildingGridPanel有相同的方法接口
            this.gridPanel = stoneWallGridPanelNode.getComponent(StoneWallGridPanel) as any;
        }
    }

    /**
     * 移动到指定网格位置（重写以支持占用两个网格）
     */
    public moveToGridPosition(gridX: number, gridY: number) {
        if (!this.gridPanel) {
            this.findGridPanel();
        }
        
        if (!this.gridPanel) {
            return;
        }

        // 检查第二个网格是否存在（gridY+1不能超出网格范围）
        const gridPanel = this.gridPanel as any;
        if (gridY + 1 >= gridPanel.gridHeight) {
            // 第二个网格超出范围，无法放置
            return;
        }

        // 检查两个网格是否都被占用
        if (gridPanel.isGridOccupied(gridX, gridY) || gridPanel.isGridOccupied(gridX, gridY + 1)) {
            // 至少有一个网格被占用，无法放置
            return;
        }

        // 获取目标网格的世界坐标（使用第一个网格的位置）
        const targetWorldPos = this.gridPanel.gridToWorld(gridX, gridY);
        if (!targetWorldPos) {
            return;
        }

        // 释放原网格（释放两个网格）
        if (this.gridX >= 0 && this.gridY >= 0) {
            this.gridPanel.releaseGrid(this.gridX, this.gridY);
            if (this.gridY + 1 < gridPanel.gridHeight) {
                this.gridPanel.releaseGrid(this.gridX, this.gridY + 1);
            }
        }

        // 占用新网格（占用两个网格）
        this.gridPanel.occupyGrid(gridX, gridY, this.node);
        this.gridPanel.occupyGrid(gridX, gridY + 1, this.node);
        this.gridX = gridX;
        this.gridY = gridY;

        // 移动建筑物到新位置（调整Y坐标，使其居中在两个网格之间）
        const adjustedPos = new Vec3(targetWorldPos.x, targetWorldPos.y + 25, targetWorldPos.z); // 向上偏移25像素（半个网格）
        this.node.setWorldPosition(adjustedPos);
    }

    /**
     * 构造哨塔的单位信息（包含回收回调，供九宫格面板使用）
     */
    private buildUnitInfo(): UnitInfo {
        return {
            name: '哨塔',
            level: this.level,
            currentHealth: this.currentHealth,
            maxHealth: this.maxHealth,
            attackDamage: this.attackDamage,
            populationCost: 0,
            icon: this.cardIcon || this.defaultSpriteFrame,
            collisionRadius: this.collisionRadius,
            onSellClick: () => {
                this.onSellClick();
            }
        };
    }

    /**
     * 更新逻辑（处理攻击和占领）
     */
    update(deltaTime: number) {
        if (this.isDestroyed) {
            return;
        }

        // 检查游戏状态
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                // 游戏已结束或暂停，停止攻击和占领
                this.currentTarget = null!;
                this.hideCaptureIndicator();
                return;
            }
        }

        // 处理占领逻辑
        this.updateCapture(deltaTime);

        // 处理攻击逻辑（占领时仍然可以攻击）
        this.attackTimer += deltaTime;
        this.targetFindTimer += deltaTime;

        // 查找目标逻辑
        const needFindTarget = !this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active;
        const shouldFindByInterval = !this.hasFoundFirstTarget || this.targetFindTimer >= this.TARGET_FIND_INTERVAL;
        
        if (needFindTarget || shouldFindByInterval) {
            this.targetFindTimer = 0; // 重置计时器
            this.findTarget();
            // 如果找到了目标，标记为已找到第一个目标
            if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
                this.hasFoundFirstTarget = true;
            }
        }

        // 处理攻击逻辑
        if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
            const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
            
            if (distance <= this.attackRange) {
                // 在攻击范围内，进行攻击
                if (this.attackTimer >= this.attackInterval) {
                    // 再次检查游戏状态，确保游戏仍在进行
                    if (this.gameManager && this.gameManager.getGameState() === GameState.Playing) {
                        this.attack();
                        this.attackTimer = 0;
                    }
                }
            } else {
                // 超出攻击范围，清除目标
                this.currentTarget = null!;
            }
        }
    }

    /**
     * 更新占领逻辑
     */
    private updateCapture(deltaTime: number) {
        // 获取范围内的单位数量
        const myPos = this.node.worldPosition;
        const friendlyCount = this.getFriendlyUnitsInRange(myPos, this.attackRange);
        const enemyCount = this.getEnemyUnitsInRange(myPos, this.attackRange);

        // 判断当前优势方
        const friendlyAdvantage = friendlyCount > enemyCount;
        const enemyAdvantage = enemyCount > friendlyCount;
        const isBalanced = friendlyCount === enemyCount;

        // 确定当前优势方
        let currentAdvantage: 'friendly' | 'enemy' | 'balanced' = 'balanced';
        if (friendlyAdvantage) {
            currentAdvantage = 'friendly';
        } else if (enemyAdvantage) {
            currentAdvantage = 'enemy';
        }

        // 如果数量差距颠倒，重置进度
        if (this.captureProgress > 0 && this.lastAdvantage !== 'balanced') {
            if (currentAdvantage !== this.lastAdvantage && currentAdvantage !== 'balanced') {
                // 优势方改变，重置进度
                this.captureProgress = 0;
            } else if (currentAdvantage === 'balanced') {
                // 变为平衡状态，重置进度
                this.captureProgress = 0;
            }
        }

        // 更新上次检测到的数量和优势方
        this.lastFriendlyCount = friendlyCount;
        this.lastEnemyCount = enemyCount;
        this.lastAdvantage = currentAdvantage;

        // 处理占领进度
        if (friendlyAdvantage && this.captureState !== CaptureState.Friendly) {
            // 我方优势，增加占领进度
            this.captureProgress += deltaTime;
            this.showCaptureIndicator(true); // 显示绿色圆弧（我方）
            this.updateCaptureIndicator(this.captureProgress / this.CAPTURE_TIME, true);

            if (this.captureProgress >= this.CAPTURE_TIME) {
                // 占领完成，设置为我方
                this.captureState = CaptureState.Friendly;
                this.captureProgress = 0;
                this.hideCaptureIndicator();
            }
        } else if (enemyAdvantage && this.captureState !== CaptureState.Enemy) {
            // 敌方优势，增加占领进度
            this.captureProgress += deltaTime;
            this.showCaptureIndicator(false); // 显示红色圆弧（敌方）
            this.updateCaptureIndicator(this.captureProgress / this.CAPTURE_TIME, false);

            if (this.captureProgress >= this.CAPTURE_TIME) {
                // 占领完成，设置为敌方
                this.captureState = CaptureState.Enemy;
                this.captureProgress = 0;
                this.hideCaptureIndicator();
            }
        } else {
            // 平衡状态或已占领，隐藏指示器并重置进度
            if (isBalanced || (this.captureState === CaptureState.Friendly && !friendlyAdvantage) || (this.captureState === CaptureState.Enemy && !enemyAdvantage)) {
                this.captureProgress = 0;
                this.hideCaptureIndicator();
            }
        }
    }

    /**
     * 获取范围内的友好单位数量
     */
    private getFriendlyUnitsInRange(center: Vec3, range: number): number {
        let count = 0;
        const rangeSq = range * range;

        // 查找弓箭手和牧师（在Towers容器中）
        const towersNode = find('Canvas/Towers');
        if (towersNode) {
            for (const tower of towersNode.children) {
                if (!tower || !tower.isValid || !tower.active) continue;
                const arrowerScript = tower.getComponent('Arrower') as any;
                const priestScript = tower.getComponent('Priest') as any;
                if (arrowerScript && arrowerScript.isAlive && arrowerScript.isAlive()) {
                    const dx = tower.worldPosition.x - center.x;
                    const dy = tower.worldPosition.y - center.y;
                    if (dx * dx + dy * dy <= rangeSq) {
                        count++;
                    }
                } else if (priestScript && priestScript.isAlive && priestScript.isAlive()) {
                    const dx = tower.worldPosition.x - center.x;
                    const dy = tower.worldPosition.y - center.y;
                    if (dx * dx + dy * dy <= rangeSq) {
                        count++;
                    }
                }
            }
        }

        // 查找女猎手
        const huntersNode = find('Canvas/Hunters');
        if (huntersNode) {
            for (const hunter of huntersNode.children) {
                if (!hunter || !hunter.isValid || !hunter.active) continue;
                const hunterScript = hunter.getComponent('Hunter') as any;
                if (hunterScript && hunterScript.isAlive && hunterScript.isAlive()) {
                    const dx = hunter.worldPosition.x - center.x;
                    const dy = hunter.worldPosition.y - center.y;
                    if (dx * dx + dy * dy <= rangeSq) {
                        count++;
                    }
                }
            }
        }

        // 查找精灵剑士
        const swordsmansNode = find('Canvas/ElfSwordsmans');
        if (swordsmansNode) {
            for (const swordsman of swordsmansNode.children) {
                if (!swordsman || !swordsman.isValid || !swordsman.active) continue;
                const swordsmanScript = swordsman.getComponent('ElfSwordsman') as any;
                if (swordsmanScript && swordsmanScript.isAlive && swordsmanScript.isAlive()) {
                    const dx = swordsman.worldPosition.x - center.x;
                    const dy = swordsman.worldPosition.y - center.y;
                    if (dx * dx + dy * dy <= rangeSq) {
                        count++;
                    }
                }
            }
        }


        return count;
    }

    /**
     * 获取范围内的敌方单位数量
     */
    private getEnemyUnitsInRange(center: Vec3, range: number): number {
        if (!this.unitManager) {
            this.unitManager = UnitManager.getInstance();
        }

        if (this.unitManager) {
            const enemies = this.unitManager.getEnemiesInRange(center, range, true);
            return enemies.length;
        }

        // 降级方案：直接查找
        let count = 0;
        const rangeSq = range * range;
        const enemyContainers = ['Canvas/Enemies', 'Canvas/Orcs', 'Canvas/TrollSpearmans', 'Canvas/OrcWarriors', 'Canvas/OrcWarlords'];
        
        for (const containerName of enemyContainers) {
            const containerNode = find(containerName);
            if (containerNode) {
                for (const enemy of containerNode.children) {
                    if (!enemy || !enemy.isValid || !enemy.active) continue;
                    const enemyScript = enemy.getComponent('Enemy') as any || 
                                       enemy.getComponent('OrcWarlord') as any ||
                                       enemy.getComponent('OrcWarrior') as any ||
                                       enemy.getComponent('TrollSpearman') as any;
                    if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
                        const dx = enemy.worldPosition.x - center.x;
                        const dy = enemy.worldPosition.y - center.y;
                        if (dx * dx + dy * dy <= rangeSq) {
                            count++;
                        }
                    }
                }
            }
        }

        return count;
    }

    /**
     * 显示占领指示器
     */
    private showCaptureIndicator(isFriendly: boolean) {
        if (this.captureIndicator && this.captureIndicator.isValid) {
            return; // 已经显示
        }

        // 隐藏之前的指示器
        this.hideCaptureIndicator();

        // 创建指示器节点
        this.captureIndicator = new Node('CaptureIndicator');
        this.captureIndicator.setParent(this.node);
        this.captureIndicator.setPosition(0, 0, 0);

        // 添加UITransform
        const uiTransform = this.captureIndicator.addComponent(UITransform);
        uiTransform.setContentSize(this.attackRange * 2, this.attackRange * 2);

        // 创建Graphics组件用于绘制圆弧
        this.captureIndicatorGraphics = this.captureIndicator.addComponent(Graphics);
    }

    /**
     * 更新占领指示器进度
     */
    private updateCaptureIndicator(progress: number, isFriendly: boolean) {
        if (!this.captureIndicator || !this.captureIndicator.isValid || !this.captureIndicatorGraphics) {
            return;
        }

        // 清除之前的绘制
        this.captureIndicatorGraphics.clear();

        // 设置绘制参数
        const radius = this.attackRange; // 使用攻击范围作为半径
        const lineWidth = 6; // 线条宽度
        const centerX = 0;
        const centerY = 0;

        // 确保进度在0-1之间
        const clampedProgress = Math.max(0, Math.min(1, progress));

        // 如果进度为0，不绘制任何内容
        if (clampedProgress <= 0) {
            return;
        }

        // 计算圆弧的起始角度和结束角度（使用弧度制）
        // 从顶部（-90度）开始，顺时针绘制
        const endAngle = -Math.PI / 2; // 从顶部开始（-90度 = -π/2）
        // 结束角度 = 起始角度 + 进度 * 360度（顺时针）
        const startAngle = endAngle + clampedProgress * Math.PI * 2;

        // 根据占领方设置颜色
        if (isFriendly) {
            // 我方：绿色
            this.captureIndicatorGraphics.strokeColor = new Color(100, 255, 100, 200);
        } else {
            // 敌方：红色
            this.captureIndicatorGraphics.strokeColor = new Color(255, 100, 100, 200);
        }
        this.captureIndicatorGraphics.lineWidth = lineWidth;

        // 绘制圆弧（从startAngle到endAngle，顺时针）
        this.captureIndicatorGraphics.arc(centerX, centerY, radius, startAngle, endAngle, false);
        this.captureIndicatorGraphics.stroke();
    }

    /**
     * 隐藏占领指示器
     */
    private hideCaptureIndicator() {
        if (this.captureIndicator && this.captureIndicator.isValid) {
            this.captureIndicator.destroy();
            this.captureIndicator = null!;
            this.captureIndicatorGraphics = null!;
        }
    }

    /**
     * 查找攻击目标（根据占领状态攻击不同目标）
     */
    private findTarget() {
        if (this.isDestroyed) {
            return;
        }

        const myPos = this.node.worldPosition;
        let nearestTarget: Node | null = null;
        let minDistance = this.attackRange;

        // 根据占领状态选择目标
        if (this.captureState === CaptureState.Friendly) {
            // 我方占领，攻击敌人
            nearestTarget = this.findNearestEnemy(myPos, minDistance);
        } else if (this.captureState === CaptureState.Enemy) {
            // 敌方占领，攻击我方单位
            nearestTarget = this.findNearestFriendlyUnit(myPos, minDistance);
        } else {
            // 中立状态，攻击敌人（默认行为）
            nearestTarget = this.findNearestEnemy(myPos, minDistance);
        }

        // 设置当前目标
        if (nearestTarget) {
            this.currentTarget = nearestTarget;
        } else {
            this.currentTarget = null!;
        }
    }

    /**
     * 查找最近的敌人
     */
    private findNearestEnemy(center: Vec3, maxRange: number): Node | null {
        let nearestTarget: Node | null = null;
        let minDistance = maxRange;

        // 使用UnitManager优化
        if (this.unitManager) {
            const enemies = this.unitManager.getEnemiesInRange(center, maxRange, true);
            for (const enemy of enemies) {
                const distance = Vec3.distance(center, enemy.worldPosition);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestTarget = enemy;
                }
            }
            return nearestTarget;
        }

        // 降级方案：直接查找
        const enemyContainers = ['Canvas/Enemies', 'Canvas/Orcs', 'Canvas/TrollSpearmans', 'Canvas/OrcWarriors', 'Canvas/OrcWarlords'];
        
        for (const containerName of enemyContainers) {
            const containerNode = find(containerName);
            if (containerNode) {
                for (const enemy of containerNode.children) {
                    if (!enemy || !enemy.isValid || !enemy.active) continue;
                    const enemyScript = enemy.getComponent('Enemy') as any || 
                                       enemy.getComponent('OrcWarlord') as any ||
                                       enemy.getComponent('OrcWarrior') as any ||
                                       enemy.getComponent('TrollSpearman') as any;
                    if (!enemyScript || !enemyScript.isAlive || !enemyScript.isAlive()) continue;
                    const distance = Vec3.distance(center, enemy.worldPosition);
                    if (distance <= maxRange && distance < minDistance) {
                        minDistance = distance;
                        nearestTarget = enemy;
                    }
                }
            }
        }

        return nearestTarget;
    }

    /**
     * 查找最近的我方单位
     */
    private findNearestFriendlyUnit(center: Vec3, maxRange: number): Node | null {
        let nearestTarget: Node | null = null;
        let minDistance = maxRange;

        // 查找Towers容器（包含Arrower和Priest）
        const towersNode = find('Canvas/Towers');
        if (towersNode) {
            for (const unit of towersNode.children) {
                if (!unit || !unit.isValid || !unit.active) continue;
                const arrowerScript = unit.getComponent('Arrower') as any;
                const priestScript = unit.getComponent('Priest') as any;
                const unitScript = arrowerScript || priestScript;
                if (!unitScript || !unitScript.isAlive || !unitScript.isAlive()) continue;
                const distance = Vec3.distance(center, unit.worldPosition);
                if (distance <= maxRange && distance < minDistance) {
                    minDistance = distance;
                    nearestTarget = unit;
                }
            }
        }

        // 查找Hunters容器
        const huntersNode = find('Canvas/Hunters');
        if (huntersNode) {
            for (const unit of huntersNode.children) {
                if (!unit || !unit.isValid || !unit.active) continue;
                const unitScript = unit.getComponent('Hunter') as any;
                if (!unitScript || !unitScript.isAlive || !unitScript.isAlive()) continue;
                const distance = Vec3.distance(center, unit.worldPosition);
                if (distance <= maxRange && distance < minDistance) {
                    minDistance = distance;
                    nearestTarget = unit;
                }
            }
        }

        // 查找ElfSwordsmans容器
        const swordsmansNode = find('Canvas/ElfSwordsmans');
        if (swordsmansNode) {
            for (const unit of swordsmansNode.children) {
                if (!unit || !unit.isValid || !unit.active) continue;
                const unitScript = unit.getComponent('ElfSwordsman') as any;
                if (!unitScript || !unitScript.isAlive || !unitScript.isAlive()) continue;
                const distance = Vec3.distance(center, unit.worldPosition);
                if (distance <= maxRange && distance < minDistance) {
                    minDistance = distance;
                    nearestTarget = unit;
                }
            }
        }

        return nearestTarget;
    }

    /**
     * 攻击目标
     */
    private attack() {
        if (!this.currentTarget || this.isDestroyed) {
            return;
        }

        // 再次检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }

        // 根据占领状态获取不同的脚本
        let targetScript: any = null;
        if (this.captureState === CaptureState.Enemy) {
            // 敌方占领，攻击我方单位
            targetScript = this.currentTarget.getComponent('Arrower') as any ||
                          this.currentTarget.getComponent('Hunter') as any ||
                          this.currentTarget.getComponent('ElfSwordsman') as any ||
                          this.currentTarget.getComponent('Priest') as any;
        } else {
            // 我方占领或中立，攻击敌人
            targetScript = this.currentTarget.getComponent('Enemy') as any || 
                           this.currentTarget.getComponent('OrcWarlord') as any ||
                           this.currentTarget.getComponent('OrcWarrior') as any ||
                           this.currentTarget.getComponent('TrollSpearman') as any;
        }
        
        if (!targetScript || !targetScript.isAlive || !targetScript.isAlive()) {
            this.currentTarget = null!;
            return;
        }

        // 播放射击音效
        if (this.shootSound && AudioManager.Instance) {
            AudioManager.Instance.playSFX(this.shootSound);
        }

        // 创建弓箭
        if (this.arrowPrefab) {
            this.createArrow();
        } else {
            // 如果没有弓箭预制体，直接造成伤害
            if (targetScript.takeDamage) {
                targetScript.takeDamage(this.attackDamage);
            }
        }
    }

    /**
     * 创建弓箭
     */
    private createArrow() {
        if (!this.arrowPrefab || !this.currentTarget) {
            return;
        }

        // 检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            return;
        }

        // 创建弓箭节点
        const arrow = instantiate(this.arrowPrefab);
        
        // 设置父节点（添加到场景或Canvas）
        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            arrow.setParent(parentNode);
        } else {
            arrow.setParent(this.node.parent);
        }

        // 设置初始位置（哨塔位置）
        const startPos = this.node.worldPosition.clone();
        arrow.setWorldPosition(startPos);

        // 确保节点激活
        arrow.active = true;

        // 获取或添加Arrow组件
        let arrowScript = arrow.getComponent(Arrow);
        if (!arrowScript) {
            arrowScript = arrow.addComponent(Arrow);
        }

        // 保存当前目标的引用，避免回调函数中引用失效的目标
        const targetNode = this.currentTarget;
        
        // 初始化弓箭，设置命中回调
        arrowScript.init(
            startPos,
            targetNode,
            this.attackDamage,
            (damage: number) => {
                // 播放箭矢击中音效
                if (this.hitSound) {
                    AudioManager.Instance?.playSFX(this.hitSound);
                }
                
                // 检查目标是否仍然有效
                if (targetNode && targetNode.isValid && targetNode.active) {
                    // 根据占领状态获取不同的脚本
                    let targetScript: any = null;
                    if (this.captureState === CaptureState.Enemy) {
                        targetScript = targetNode.getComponent('Arrower') as any ||
                                      targetNode.getComponent('Hunter') as any ||
                                      targetNode.getComponent('ElfSwordsman') as any ||
                                      targetNode.getComponent('Priest') as any;
                    } else {
                        targetScript = targetNode.getComponent('Enemy') as any || 
                                       targetNode.getComponent('OrcWarlord') as any ||
                                       targetNode.getComponent('OrcWarrior') as any ||
                                       targetNode.getComponent('TrollSpearman') as any;
                    }
                    
                    if (targetScript && targetScript.takeDamage) {
                        targetScript.takeDamage(damage);
                    }
                }
            }
        );
    }

    /**
     * 死亡（重写以添加金币奖励逻辑）
     */
    protected die() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;

        // 隐藏占领指示器
        this.hideCaptureIndicator();

        // 释放网格占用（确保能找到网格面板）
        // 哨塔占据两个网格高度，需要释放两个网格
        if (!this.gridPanel) {
            this.findGridPanel();
        }
        if (this.gridPanel && this.gridX >= 0 && this.gridY >= 0) {
            // 释放第一个网格
            this.gridPanel.releaseGrid(this.gridX, this.gridY);
            // 释放第二个网格（如果存在）
            if (this.gridY + 1 < (this.gridPanel as any).gridHeight) {
                this.gridPanel.releaseGrid(this.gridX, this.gridY + 1);
            }
        }

        // 播放爆炸特效
        if (this.explosionEffect) {
            const explosion = instantiate(this.explosionEffect);
            const canvas = find('Canvas');
            if (canvas) {
                explosion.setParent(canvas);
            } else if (this.node.scene) {
                explosion.setParent(this.node.scene);
            }
            explosion.setWorldPosition(this.node.worldPosition);
            explosion.active = true;
        }

        // 给玩家奖励金币（哨塔特有）
        if (this.gameManager) {
            this.gameManager.addGold(this.goldReward);
        }

        // 性能优化：使用对象池回收建筑物，而不是直接销毁
        const buildingPool = BuildingPool.getInstance();
        if (buildingPool && this.prefabName) {
            // 清理状态
            this.currentTarget = null!;
            this.attackTimer = 0;
            this.targetFindTimer = 0;
            this.hasFoundFirstTarget = false;
            this.captureState = CaptureState.Neutral;
            this.captureProgress = 0;
            
            // 回收到对象池
            buildingPool.release(this.node, this.prefabName);
        } else {
            // 如果没有对象池，直接销毁
            this.node.destroy();
        }
    }

    /**
     * 检查是否存活
     */
    public isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }
}
