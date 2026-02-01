import { _decorator, Node, Vec3, find, Prefab, instantiate, SpriteFrame, AudioClip, Graphics, UITransform, Color, EventTouch, Sprite } from 'cc';
import { Build } from './Build';
import { UnitInfo } from '../UnitInfoPanel';
import { StoneWallGridPanel } from '../StoneWallGridPanel';
import { UnitType } from './WarAncientTree';
import { BuildingPool } from '../BuildingPool';
import { GameManager, GameState } from '../GameManager';
import { ThunderChain } from '../ThunderChain';
import { AudioManager } from '../AudioManager';
import { UnitManager } from '../UnitManager';
import { ThunderTowerLightningEffect } from '../ThunderTowerLightningEffect';
const { ccclass, property } = _decorator;

// 建造阶段枚举
enum ConstructionStage {
    FOUNDATION = 0,    // 地基
    HALF_BUILT = 1,    // 半成品
    COMPLETE = 2       // 完全体
}

// 风化阶段枚举
enum WeatheringStage {
    NONE = -1,         // 无风化
    STAGE_1 = 0,       // 风化阶段1
    STAGE_2 = 1,       // 风化阶段2
    STAGE_3 = 2        // 风化阶段3
}

@ccclass('ThunderTower')
export class ThunderTower extends Build {
    // 雷塔特有属性
    @property
    goldReward: number = 6; // 回收获得的金币

    // 攻击相关属性
    @property
    attackRange: number = 350; // 攻击范围

    @property
    attackDamage: number = 20; // 攻击伤害

    @property
    attackInterval: number = 2.0; // 攻击间隔（秒）

    // 人口占用（雷塔占用2个人口）
    protected populationCost: number = 2;

    @property(Prefab)
    thunderChainPrefab: Prefab = null!; // 闪电链预制体

    @property(SpriteFrame)
    lightningTexture: SpriteFrame = null!; // 闪电链贴图（可选，如果有贴图则使用贴图作为攻击轨迹）

    @property(AudioClip)
    shootSound: AudioClip = null!; // 闪电射出时的音效

    @property(AudioClip)
    hitSound: AudioClip = null!; // 闪电击中敌人时的音效

    // 建造阶段贴图
    @property(SpriteFrame)
    foundationSprite: SpriteFrame = null!; // 地基贴图

    @property(SpriteFrame)
    halfBuiltSprite: SpriteFrame = null!; // 半成品贴图

    @property(SpriteFrame)
    completeSprite: SpriteFrame = null!; // 完全体贴图

    // 被破坏阶段贴图（3张）
    @property(SpriteFrame)
    destructionSprite1: SpriteFrame = null!; // 被破坏贴图1

    @property(SpriteFrame)
    destructionSprite2: SpriteFrame = null!; // 被破坏贴图2

    @property(SpriteFrame)
    destructionSprite3: SpriteFrame = null!; // 被破坏贴图3

    // 风化阶段贴图（3张）
    @property(SpriteFrame)
    weatheringSprite1: SpriteFrame = null!; // 风化贴图1

    @property(SpriteFrame)
    weatheringSprite2: SpriteFrame = null!; // 风化贴图2

    @property(SpriteFrame)
    weatheringSprite3: SpriteFrame = null!; // 风化贴图3

    // 建造阶段相关
    private constructionStage: ConstructionStage = ConstructionStage.FOUNDATION; // 当前建造阶段
    private constructionProgress: number = 0; // 建造进度（0-1）
    private constructionTimer: number = 0; // 建造计时器
    private readonly CONSTRUCTION_TIME: number = 5; // 每个阶段建造时间（秒）
    private constructionProgressBar: Node = null!; // 建造进度条节点
    private constructionProgressGraphics: Graphics = null!; // 建造进度条图形组件

    // 被破坏阶段相关
    private isDestroying: boolean = false; // 是否正在播放被破坏动画
    private destructionTimer: number = 0; // 被破坏动画计时器
    private readonly DESTRUCTION_TIME: number = 1; // 被破坏动画时间（秒）
    private destructionFrameIndex: number = 0; // 当前被破坏帧索引（0-2）

    // 风化阶段相关
    private weatheringStage: WeatheringStage = WeatheringStage.NONE; // 当前风化阶段
    private weatheringTimer: number = 0; // 风化计时器
    private readonly WEATHERING_TIME: number = 5; // 每个风化阶段时间（秒）

    // 攻击相关私有属性
    protected attackTimer: number = 0; // 攻击计时器
    protected currentTarget: Node = null!; // 当前攻击目标
    protected targetFindTimer: number = 0; // 目标查找计时器
    protected readonly TARGET_FIND_INTERVAL: number = 0.2; // 目标查找间隔（秒）
    protected hasFoundFirstTarget: boolean = false; // 是否已经找到过第一个目标
    private unitManager: UnitManager = null!; // 单位管理器引用
    // baseY 字段已移动到父类 Build 中复用

    /**
     * 当雷塔从对象池激活时调用
     */
    onEnable() {
        super.onEnable();
        
        // 雷塔特有的初始化：监听点击事件
        this.node.on(Node.EventType.TOUCH_END, this.onThunderTowerClick, this);
        
        // 初始化攻击相关属性
        this.attackTimer = 0;
        this.currentTarget = null!;
        this.targetFindTimer = 0;
        this.hasFoundFirstTarget = false;
        
        // 初始化建造阶段
        this.constructionStage = ConstructionStage.FOUNDATION;
        this.constructionProgress = 0;
        this.constructionTimer = 0;
        
        // 初始化被破坏和风化阶段
        this.isDestroying = false;
        this.destructionTimer = 0;
        this.destructionFrameIndex = 0;
        this.weatheringStage = WeatheringStage.NONE;
        this.weatheringTimer = 0;
        
        // 重置基准Y坐标（将在第一次设置高度时记录）
        this.baseY = 0;
        
        // 获取Sprite组件
        this.sprite = this.node.getComponent(Sprite);
        
        // 获取UnitManager
        this.unitManager = UnitManager.getInstance();
        
        // 创建建造进度条
        this.createConstructionProgressBar();
        
        // 设置初始贴图
        this.updateSprite();
        
        // 添加电光特效（只在完全体时添加）
        if (this.constructionStage >= ConstructionStage.COMPLETE) {
            this.createLightningEffect();
        }
    }

    protected start() {
        // 设置单位类型
        this.unitType = UnitType.BUILDING;
        
        // 调用父类start方法
        super.start();
        
        // 设置雷塔高度为两个网格（100像素）
        const uiTransform = this.node.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.setContentSize(uiTransform.width, 100); // 高度设为100（两个网格）
        }
        
        // 雷塔特有的初始化：监听点击事件
        this.node.on(Node.EventType.TOUCH_END, this.onThunderTowerClick, this);
        
        // 初始化攻击相关属性
        this.attackTimer = 0;
        this.currentTarget = null!;
        this.targetFindTimer = 0;
        this.hasFoundFirstTarget = false;
        
        // 初始化建造阶段
        this.constructionStage = ConstructionStage.FOUNDATION;
        this.constructionProgress = 0;
        this.constructionTimer = 0;
        
        // 初始化被破坏和风化阶段
        this.isDestroying = false;
        this.destructionTimer = 0;
        this.destructionFrameIndex = 0;
        this.weatheringStage = WeatheringStage.NONE;
        this.weatheringTimer = 0;
        
        // 获取Sprite组件
        if (!this.sprite) {
            this.sprite = this.node.getComponent(Sprite);
        }
        
        // 获取UnitManager
        this.unitManager = UnitManager.getInstance();
        
        // 创建建造进度条
        this.createConstructionProgressBar();
        
        // 设置初始贴图
        this.updateSprite();
        
        // 添加电光特效（只在完全体时添加）
        if (this.constructionStage >= ConstructionStage.COMPLETE) {
            this.createLightningEffect();
        }
    }
    
    onDestroy() {
        // 移除点击事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onThunderTowerClick, this);
        
        // 调用父类onDestroy
        super.onDestroy();
    }

    /**
     * 查找网格面板（重写以支持石墙网格）
     */
    protected findGridPanel() {
        const stoneWallGridPanelNode = find('Canvas/StoneWallGridPanel');
        if (stoneWallGridPanelNode) {
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

        // 雷塔占用两个网格：gridY（下方网格，选中的）和 gridY + 1（上方网格，Y坐标越大越在上方）
        // 检查上方网格是否存在（gridY+1不能超出网格范围）
        const gridPanel = this.gridPanel as any;
        if (gridY + 1 >= gridPanel.gridHeight) {
            // 上方网格超出范围，无法放置
            return;
        }

        // 检查是否是更新当前位置（网格已经被当前节点占用）
        const isUpdatingCurrentPosition = this.gridX === gridX && this.gridY === gridY;
        
        // 如果不是更新当前位置，检查两个网格是否都被占用
        if (!isUpdatingCurrentPosition) {
            if (gridPanel.isGridOccupiedByOther && gridPanel.isGridOccupiedByOther(gridX, gridY, this.node)) {
                // 下方网格被其他节点占用，无法放置
                return;
            }
            if (gridPanel.isGridOccupiedByOther && gridPanel.isGridOccupiedByOther(gridX, gridY + 1, this.node)) {
                // 上方网格被其他节点占用，无法放置
                return;
            }
            // 如果使用 isGridOccupied 方法（没有 isGridOccupiedByOther）
            if (!gridPanel.isGridOccupiedByOther && 
                (gridPanel.isGridOccupied(gridX, gridY) || gridPanel.isGridOccupied(gridX, gridY + 1))) {
                // 至少有一个网格被占用，无法放置
                return;
            }
        }

        // 获取目标网格的世界坐标（使用下方网格的位置，参考哨塔的做法）
        const targetWorldPos = this.gridPanel.gridToWorld(gridX, gridY);
        if (!targetWorldPos) {
            return;
        }

        // 如果不是更新当前位置，需要释放原网格并占用新网格
        if (!isUpdatingCurrentPosition) {
            // 释放原网格（释放两个网格）
            if (this.gridX >= 0 && this.gridY >= 0) {
                this.gridPanel.releaseGrid(this.gridX, this.gridY);
                if (this.gridY + 1 < gridPanel.gridHeight) {
                    this.gridPanel.releaseGrid(this.gridX, this.gridY + 1);
                }
            }

            // 占用新网格（占用两个网格：下方和上方）
            this.gridPanel.occupyGrid(gridX, gridY, this.node); // 下方网格（选中的）
            this.gridPanel.occupyGrid(gridX, gridY + 1, this.node); // 上方网格
        }
        
        // 更新网格坐标（使用下方网格的坐标，与哨塔一致）
        this.gridX = gridX;
        this.gridY = gridY;

        // 计算网格底部Y坐标（下方网格的底部）
        const gridBottomY = targetWorldPos.y - gridPanel.cellSize / 2;
        
        // 设置baseY为网格底部Y坐标
        this.baseY = gridBottomY;
        
        // 移动建筑物到新位置（调整Y坐标，使其居中在两个网格之间，参考哨塔的做法）
        const adjustedPos = new Vec3(targetWorldPos.x, targetWorldPos.y + 25, targetWorldPos.z); // 向上偏移25像素（半个网格）
        this.node.setWorldPosition(adjustedPos);
        
        // 根据当前建造阶段更新高度（但不改变位置，因为位置已经设置好了）
        const heightScale = this.constructionStage === ConstructionStage.FOUNDATION ? 0.5 : 
                           this.constructionStage === ConstructionStage.HALF_BUILT ? 0.66 : 1.0;
        
        // 设置缩放（保持X和Z不变，只调整Y）
        const defaultScale = this.defaultScale || new Vec3(1, 1, 1);
        this.node.setScale(defaultScale.x, defaultScale.y * heightScale, defaultScale.z);
    }

    /**
     * 构造雷塔的单位信息（包含回收回调）
     */
    private buildUnitInfo(): UnitInfo {
        return {
            name: '雷元素塔',
            level: this.level,
            currentHealth: this.currentHealth,
            maxHealth: this.maxHealth,
            attackDamage: this.attackDamage,
            attackFrequency: 1.0 / this.attackInterval,
            populationCost: this.populationCost,
            icon: this.cardIcon || this.defaultSpriteFrame,
            collisionRadius: this.collisionRadius,
            onSellClick: () => {
                this.onSellClick();
            },
            onUpgradeClick: () => {
                this.onUpgradeClick();
            }
        };
    }
    
    /**
     * 点击事件（雷塔特有）
     */
    onThunderTowerClick(event: EventTouch) {
        // 检查是否正在拖拽建筑物
        let towerBuilderNode = find('TowerBuilder');
        if (!towerBuilderNode && this.node.scene) {
            const findNodeRecursive = (node: Node, name: string): Node | null => {
                if (node.name === name) {
                    return node;
                }
                for (const child of node.children) {
                    const found = findNodeRecursive(child, name);
                    if (found) return found;
                }
                return null;
            };
            towerBuilderNode = findNodeRecursive(this.node.scene, 'TowerBuilder');
        }
        
        let towerBuilder: any = null;
        if (towerBuilderNode) {
            towerBuilder = towerBuilderNode.getComponent('TowerBuilder') as any;
        } else if (this.node.scene) {
            const findComponentInScene = (node: Node, componentType: string): any => {
                const comp = node.getComponent(componentType);
                if (comp) return comp;
                for (const child of node.children) {
                    const found = findComponentInScene(child, componentType);
                    if (found) return found;
                }
                return null;
            };
            towerBuilder = findComponentInScene(this.node.scene, 'TowerBuilder');
        }
        
        if (towerBuilder && (towerBuilder as any).isLongPressActive) {
            return;
        }
        
        if ((this.node as any)._showingInfoPanel) {
            return;
        }
        
        if (towerBuilder && towerBuilder.isDraggingBuilding) {
            if (towerBuilder.endDraggingBuilding && typeof towerBuilder.endDraggingBuilding === 'function') {
                towerBuilder.endDraggingBuilding(event);
            }
            return;
        }

        event.propagationStopped = true;

        // 点击时显示九宫格信息面板（包含回收按钮）
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (this.unitSelectionManager) {
            this.unitSelectionManager.selectUnit(this.node, this.buildUnitInfo());
        }

        if (this.selectionPanel && this.selectionPanel.isValid) {
            this.hideSelectionPanel();
            return;
        }
    }
    
    /**
     * 回收按钮点击事件
     */
    onSellClick(event?: EventTouch) {
        if (event) {
            event.propagationStopped = true;
        }
        
        if (!this.gameManager) {
            this.findGameManager();
        }

        if (this.gameManager) {
            const refund = Math.floor(this.buildCost * 0.8);
            this.gameManager.addGold(refund);
            // 注意：不在这里释放人口，因为die()方法中已经处理了人口释放
        }

        this.hideSelectionPanel();
        // die()方法中会释放人口，避免重复释放
        this.die();
    }

    /**
     * 升级按钮点击事件（参考Role的升级机制）
     */
    protected onUpgradeClick(event?: EventTouch) {
        if (event) {
            event.propagationStopped = true;
        }
        
        // 限制最高等级为3级
        if (this.level >= 3) {
            return;
        }

        if (!this.gameManager) {
            this.findGameManager();
        }

        if (!this.gameManager) {
            return;
        }

        // 升级费用：1到2级是10金币，此后每次升级多10金币
        // 公式：10 + (level - 1) * 10
        const upgradeCost = 10 + (this.level - 1) * 10;
        
        if (!this.gameManager.canAfford(upgradeCost)) {
            return;
        }

        // 消耗金币
        this.gameManager.spendGold(upgradeCost);

        // 升级单位
        this.level++;
        this.attackDamage = Math.floor(this.attackDamage * 1.25); // 攻击力增加25%
        this.attackInterval = this.attackInterval / 1.1; // 攻击速度增加10%（间隔减少10%）

        // 更新单位信息面板
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                level: this.level,
                attackDamage: this.attackDamage,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth,
                attackFrequency: 1.0 / this.attackInterval
            });
        }

        // 隐藏面板
        this.hideSelectionPanel();
    }

    /**
     * 更新逻辑（处理建造、攻击、被破坏、风化）
     */
    update(deltaTime: number) {
        // 处理风化阶段（优先级最高，因为此时已经死亡）
        if (this.weatheringStage !== WeatheringStage.NONE) {
            // 检查是否有风化贴图，如果没有则直接完成风化
            const hasWeatheringSprites = this.weatheringSprite1 || this.weatheringSprite2 || this.weatheringSprite3;
            
            if (!hasWeatheringSprites) {
                // 没有风化贴图，直接完成风化
                this.finalDestroy();
                return;
            }
            
            this.weatheringTimer += deltaTime;
            if (this.weatheringTimer >= this.WEATHERING_TIME) {
                this.weatheringTimer = 0;
                this.weatheringStage++;
                
                if (this.weatheringStage > WeatheringStage.STAGE_3) {
                    // 风化完成，彻底消失并释放网格
                    this.finalDestroy();
                    return;
                } else {
                    // 更新风化贴图
                    this.updateSprite();
                }
            }
            return;
        }

        // 处理被破坏阶段
        if (this.isDestroying) {
            // 检查是否有被破坏贴图，如果没有则直接进入风化阶段
            const hasDestructionSprites = this.destructionSprite1 || this.destructionSprite2 || this.destructionSprite3;
            
            if (!hasDestructionSprites) {
                // 没有被破坏贴图，直接进入风化阶段
                this.isDestroying = false;
                this.weatheringStage = WeatheringStage.STAGE_1;
                this.weatheringTimer = 0;
                this.updateSprite();
                return;
            }
            
            this.destructionTimer += deltaTime;
            const frameTime = this.DESTRUCTION_TIME / 3; // 每帧时间
            const newFrameIndex = Math.floor(this.destructionTimer / frameTime);
            
            if (newFrameIndex !== this.destructionFrameIndex && newFrameIndex < 3) {
                this.destructionFrameIndex = newFrameIndex;
                this.updateSprite();
            }
            
            if (this.destructionTimer >= this.DESTRUCTION_TIME) {
                // 被破坏动画完成，开始风化阶段
                this.isDestroying = false;
                this.weatheringStage = WeatheringStage.STAGE_1;
                this.weatheringTimer = 0;
                this.updateSprite();
            }
            return;
        }

        if (this.isDestroyed) {
            return;
        }

        // 处理建造阶段
        if (this.constructionStage < ConstructionStage.COMPLETE) {
            // 检查当前阶段是否有贴图，如果没有则跳过
            let shouldSkipStage = false;
            if (this.constructionStage === ConstructionStage.FOUNDATION && !this.foundationSprite) {
                shouldSkipStage = true;
            } else if (this.constructionStage === ConstructionStage.HALF_BUILT && !this.halfBuiltSprite) {
                shouldSkipStage = true;
            }
            
            if (shouldSkipStage) {
                // 跳过当前阶段
                this.constructionStage++;
                this.constructionTimer = 0;
                this.constructionProgress = 0;
                this.updateSprite();
                
                if (this.constructionStage >= ConstructionStage.COMPLETE) {
                    if (this.constructionProgressBar) {
                        this.constructionProgressBar.active = false;
                    }
                    this.createLightningEffect();
                }
            } else {
                // 正常建造流程
                this.constructionTimer += deltaTime;
                const targetTime = this.CONSTRUCTION_TIME;
                
                if (this.constructionTimer >= targetTime) {
                    // 当前阶段完成，进入下一阶段
                    this.constructionStage++;
                    this.constructionTimer = 0;
                    this.constructionProgress = 0;
                    
                    // 更新贴图
                    this.updateSprite();
                    
                    // 如果到达完全体，隐藏进度条并添加电光特效
                    if (this.constructionStage >= ConstructionStage.COMPLETE) {
                        if (this.constructionProgressBar) {
                            this.constructionProgressBar.active = false;
                        }
                        this.createLightningEffect();
                    }
                } else {
                    // 更新建造进度
                    this.constructionProgress = this.constructionTimer / targetTime;
                    this.updateConstructionProgressBar();
                }
            }
        }

        // 只有完全体才能攻击
        if (this.constructionStage < ConstructionStage.COMPLETE) {
            return;
        }

        if (!this.gameManager) {
            this.findGameManager();
        }
        
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                this.currentTarget = null!;
                return;
            }
        }

        // 处理攻击逻辑
        this.attackTimer += deltaTime;
        this.targetFindTimer += deltaTime;

        // 查找目标逻辑
        const needFindTarget = !this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active;
        const shouldFindByInterval = !this.hasFoundFirstTarget || this.targetFindTimer >= this.TARGET_FIND_INTERVAL;
        
        if (needFindTarget || shouldFindByInterval) {
            this.targetFindTimer = 0;
            this.findTarget();
            if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
                this.hasFoundFirstTarget = true;
            }
        }

        // 处理攻击逻辑
        if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
            const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
            
            if (distance <= this.attackRange) {
                if (this.attackTimer >= this.attackInterval) {
                    if (this.gameManager && this.gameManager.getGameState() === GameState.Playing) {
                        this.attack();
                        this.attackTimer = 0;
                    }
                }
            } else {
                this.currentTarget = null!;
            }
        }
    }

    /**
     * 查找目标
     */
    private findTarget() {
        if (!this.unitManager) {
            this.unitManager = UnitManager.getInstance();
        }

        const myPos = this.node.worldPosition;
        const detectionRange = this.attackRange;
        const detectionRangeSq = detectionRange * detectionRange;

        let nearestTarget: Node | null = null;
        let minDistanceSq = detectionRangeSq;

        // 查找敌人
        const enemies = this.unitManager ? this.unitManager.getEnemiesInRange(myPos, detectionRange, true) : [];
        
        for (const enemy of enemies) {
            if (!enemy || !enemy.isValid || !enemy.active) continue;

            const enemyScript = enemy.getComponent('Enemy') as any || 
                               enemy.getComponent('OrcWarlord') as any ||
                               enemy.getComponent('OrcWarrior') as any ||
                               enemy.getComponent('TrollSpearman') as any;
            
            if (!enemyScript || !enemyScript.isAlive || !enemyScript.isAlive()) continue;

            const dx = enemy.worldPosition.x - myPos.x;
            const dy = enemy.worldPosition.y - myPos.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq <= detectionRangeSq && distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                nearestTarget = enemy;
            }
        }

        if (nearestTarget) {
            this.currentTarget = nearestTarget;
        }
    }

    /**
     * 攻击
     */
    private attack() {
        if (!this.currentTarget || this.isDestroyed) {
            return;
        }

        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }

        // 播放攻击音效
        if (this.shootSound && AudioManager.Instance) {
            AudioManager.Instance.playSFX(this.shootSound);
        }

        // 创建闪电链
        this.createThunderChain();
    }

    /**
     * 创建闪电链
     */
    private createThunderChain() {
        if (!this.currentTarget || !this.currentTarget.isValid) {
            return;
        }

        // 创建闪电链节点
        let chainNode: Node;
        if (this.thunderChainPrefab) {
            chainNode = instantiate(this.thunderChainPrefab);
        } else {
            // 如果没有预制体，创建一个简单的节点
            chainNode = new Node('ThunderChain');
        }

        // 设置父节点
        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            chainNode.setParent(parentNode);
        } else {
            chainNode.setParent(this.node.parent);
        }

        // 设置初始位置（雷塔位置）
        const startPos = this.node.worldPosition.clone();
        chainNode.setWorldPosition(startPos);

        chainNode.active = true;

        // 获取或添加ThunderChain组件
        let thunderChainScript = chainNode.getComponent(ThunderChain);
        if (!thunderChainScript) {
            thunderChainScript = chainNode.addComponent(ThunderChain);
        }

        // 设置闪电链贴图（如果有）
        if (this.lightningTexture) {
            thunderChainScript.lightningTexture = this.lightningTexture;
        }

        // 初始化闪电链
        thunderChainScript.init(
            startPos,
            this.currentTarget,
            this.attackDamage,
            (damage: number, enemy: Node) => {
                // 命中回调
                this.onChainHit(damage, enemy);
            }
        );
    }

    /**
     * 闪电链命中回调
     */
    private onChainHit(damage: number, enemy: Node) {
        if (!enemy || !enemy.isValid || !enemy.active) {
            return;
        }

        // 播放命中音效
        if (this.hitSound && AudioManager.Instance) {
            AudioManager.Instance.playSFX(this.hitSound);
        }

        // 应用伤害
        const enemyScript = enemy.getComponent('Enemy') as any || 
                           enemy.getComponent('OrcWarlord') as any ||
                           enemy.getComponent('OrcWarrior') as any ||
                           enemy.getComponent('TrollSpearman') as any;
        
        if (enemyScript && enemyScript.takeDamage) {
            enemyScript.takeDamage(damage);
            // 记录伤害统计
            this.recordDamageToStatistics(damage);
        }
    }

    /**
     * 检查是否存活（与哨塔保持一致）
     */
    public isAlive(): boolean {
        return !this.isDestroyed && !this.isDestroying && this.weatheringStage === WeatheringStage.NONE && this.currentHealth > 0;
    }

    /**
     * 创建建造进度条
     */
    private createConstructionProgressBar() {
        if (this.constructionProgressBar && this.constructionProgressBar.isValid) {
            return;
        }

        this.constructionProgressBar = new Node('ConstructionProgressBar');
        this.constructionProgressBar.setParent(this.node);
        this.constructionProgressBar.setPosition(0, 60, 0);

        const uiTransform = this.constructionProgressBar.addComponent(UITransform);
        uiTransform.setContentSize(40, 4);

        this.constructionProgressGraphics = this.constructionProgressBar.addComponent(Graphics);
        this.constructionProgressBar.active = true;
    }

    /**
     * 更新建造进度条
     */
    private updateConstructionProgressBar() {
        if (!this.constructionProgressBar || !this.constructionProgressGraphics) return;

        if (this.constructionStage >= ConstructionStage.COMPLETE) {
            this.constructionProgressBar.active = false;
            return;
        }

        this.constructionProgressBar.active = true;
        this.constructionProgressGraphics.clear();

        const barWidth = 40;
        const barHeight = 4;
        const barX = -barWidth / 2;
        const barY = 0;

        // 绘制背景（灰色）
        this.constructionProgressGraphics.fillColor = new Color(100, 100, 100, 255);
        this.constructionProgressGraphics.rect(barX, barY, barWidth, barHeight);
        this.constructionProgressGraphics.fill();

        // 绘制进度（蓝色）
        if (this.constructionProgress > 0) {
            this.constructionProgressGraphics.fillColor = new Color(0, 150, 255, 255);
            this.constructionProgressGraphics.rect(barX, barY, barWidth * this.constructionProgress, barHeight);
            this.constructionProgressGraphics.fill();
        }
    }

    /**
     * 更新贴图
     */
    private updateSprite() {
        if (!this.sprite) {
            this.sprite = this.node.getComponent(Sprite);
        }
        if (!this.sprite) {
            return;
        }

        // 优先处理风化阶段
        if (this.weatheringStage === WeatheringStage.STAGE_1 && this.weatheringSprite1) {
            this.sprite.spriteFrame = this.weatheringSprite1;
            // 风化状态高度为50%，保持底部位置不变
            this.setHeightWithFixedBottomGeneric(0.5);
            return;
        }
        if (this.weatheringStage === WeatheringStage.STAGE_2 && this.weatheringSprite2) {
            this.sprite.spriteFrame = this.weatheringSprite2;
            // 风化状态高度为50%，保持底部位置不变
            this.setHeightWithFixedBottomGeneric(0.5);
            return;
        }
        if (this.weatheringStage === WeatheringStage.STAGE_3 && this.weatheringSprite3) {
            this.sprite.spriteFrame = this.weatheringSprite3;
            // 风化状态高度为50%，保持底部位置不变
            this.setHeightWithFixedBottomGeneric(0.5);
            return;
        }

        // 处理被破坏阶段
        if (this.isDestroying) {
            if (this.destructionFrameIndex === 0 && this.destructionSprite1) {
                this.sprite.spriteFrame = this.destructionSprite1;
                // 被破坏阶段保持当前高度（通常是完全体高度）
                return;
            }
            if (this.destructionFrameIndex === 1 && this.destructionSprite2) {
                this.sprite.spriteFrame = this.destructionSprite2;
                return;
            }
            if (this.destructionFrameIndex === 2 && this.destructionSprite3) {
                this.sprite.spriteFrame = this.destructionSprite3;
                return;
            }
        }

        // 处理建造阶段
        if (this.constructionStage === ConstructionStage.FOUNDATION && this.foundationSprite) {
            this.sprite.spriteFrame = this.foundationSprite;
            // 地基形态高度为50%，保持底部位置不变
            this.setHeightWithFixedBottomGeneric(0.5);
            return;
        }
        if (this.constructionStage === ConstructionStage.HALF_BUILT && this.halfBuiltSprite) {
            this.sprite.spriteFrame = this.halfBuiltSprite;
            // 半成品高度为66%，保持底部位置不变
            this.setHeightWithFixedBottomGeneric(0.66);
            return;
        }
        if (this.constructionStage === ConstructionStage.COMPLETE && this.completeSprite) {
            this.sprite.spriteFrame = this.completeSprite;
            // 完全体高度为100%，保持底部位置不变
            this.setHeightWithFixedBottomGeneric(1.0);
            return;
        }

        // 如果没有配置贴图，使用默认贴图（不改变）
        // 如果没有配置贴图，默认使用完全体高度
        if (this.constructionStage === ConstructionStage.COMPLETE) {
            this.setHeightWithFixedBottomGeneric(1.0);
        } else if (this.constructionStage === ConstructionStage.HALF_BUILT) {
            this.setHeightWithFixedBottomGeneric(0.66);
        } else if (this.constructionStage === ConstructionStage.FOUNDATION) {
            this.setHeightWithFixedBottomGeneric(0.5);
        }
    }

    /**
     * 重写die方法，不立即释放网格，而是进入被破坏阶段
     */
    protected die() {
        if (this.isDestroyed || this.isDestroying) {
            return;
        }

        this.isDestroyed = true;
        this.isDestroying = true;
        this.destructionTimer = 0;
        this.destructionFrameIndex = 0;

        // 释放人口
        if (!this.gameManager) {
            this.findGameManager();
        }
        if (this.gameManager) {
            this.gameManager.removePopulation(this.populationCost);
        }

        // 停止攻击
        this.currentTarget = null!;

        // 隐藏进度条
        if (this.constructionProgressBar) {
            this.constructionProgressBar.active = false;
        }

        // 隐藏血条
        if (this.healthBarNode) {
            this.healthBarNode.active = false;
        }

        // 移除电光特效
        const effect = this.node.getComponent(ThunderTowerLightningEffect);
        if (effect) {
            effect.destroy();
        }

        // 更新贴图
        this.updateSprite();

        // 播放爆炸特效（如果有）
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
    }

    /**
     * 最终销毁（风化完成后调用）
     */
    private finalDestroy() {
        // 释放网格占用（确保能找到网格面板）
        if (!this.gridPanel) {
            this.findGridPanel();
        }
        if (this.gridPanel && this.gridX >= 0 && this.gridY >= 0) {
            // 释放两个网格（因为占用两个格子）
            this.gridPanel.releaseGrid(this.gridX, this.gridY);
            const gridPanel = this.gridPanel as any;
            if (this.gridY + 1 < gridPanel.gridHeight) {
                this.gridPanel.releaseGrid(this.gridX, this.gridY + 1);
            }
        }

        // 性能优化：使用对象池回收建筑物，而不是直接销毁
        const returnToPool = () => {
            const buildingPool = BuildingPool.getInstance();
            if (buildingPool && this.node && this.node.isValid) {
                // 重置建筑物状态（在返回对象池前）
                this.resetBuildingState();
                // 返回到对象池
                buildingPool.release(this.node, this.prefabName);
            } else {
                // 如果对象池不存在，直接销毁
                if (this.node && this.node.isValid) {
                    this.node.destroy();
                }
            }
        };
        
        // 延迟返回对象池
        this.scheduleOnce(() => {
            returnToPool();
        }, 0.1);
    }

    /**
     * 重置建筑物状态（用于对象池回收）
     */
    protected resetBuildingState() {
        super.resetBuildingState();
        
        // 重置建造阶段
        this.constructionStage = ConstructionStage.FOUNDATION;
        this.constructionProgress = 0;
        this.constructionTimer = 0;
        
        // 重置被破坏和风化阶段
        this.isDestroying = false;
        this.destructionTimer = 0;
        this.destructionFrameIndex = 0;
        this.weatheringStage = WeatheringStage.NONE;
        this.weatheringTimer = 0;
        
        // 重置攻击相关
        this.attackTimer = 0;
        this.currentTarget = null!;
        this.targetFindTimer = 0;
        this.hasFoundFirstTarget = false;
        
        // 更新贴图
        this.updateSprite();
    }

    /**
     * 创建电光特效
     */
    private createLightningEffect() {
        // 检查是否已经存在特效组件
        let effect = this.node.getComponent(ThunderTowerLightningEffect);
        if (!effect) {
            effect = this.node.addComponent(ThunderTowerLightningEffect);
        }
    }
}
