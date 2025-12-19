import { _decorator, Component, Node, Vec3, tween, Sprite, find, Prefab, instantiate, Label, Color, SpriteFrame, UITransform, AudioClip, Animation, AnimationState, view, Graphics } from 'cc';
import { GameManager, GameState } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
import { AudioManager } from './AudioManager';
import { UnitType } from './WarAncientTree';
import { StoneWallGridPanel } from './StoneWallGridPanel';
const { ccclass, property } = _decorator;

@ccclass('Enemy')
export class Enemy extends Component {
    @property
    maxHealth: number = 0;

    @property
    moveSpeed: number = 0;

    @property
    attackDamage: number = 0;

    @property
    attackInterval: number = 0;

    @property
    attackRange: number = 0; // 增加攻击范围，确保大于石墙碰撞半径(40) + 敌人半径(20) = 60

    @property
    collisionRadius: number = 20; // 碰撞半径（像素），默认20，子类可以重写

    @property(Node)
    targetCrystal: Node = null!;

    @property(Prefab)
    damageNumberPrefab: Prefab = null!;

    // 单位类型
    public unitType: UnitType = UnitType.ENEMY;
    
    // 单位信息属性
    @property
    unitName: string = "";
    
    @property
    unitDescription: string = "";
    
    @property(SpriteFrame)
    unitIcon: SpriteFrame = null!;

    // 动画帧属性
    @property(SpriteFrame)
    idleAnimationFrames: SpriteFrame[] = []; // 待机动画帧
    
    @property(SpriteFrame)
    walkAnimationFrames: SpriteFrame[] = []; // 行走动画帧
    
    @property(SpriteFrame)
    attackAnimationFrames: SpriteFrame[] = []; // 攻击动画帧
    
    @property(SpriteFrame)
    hitAnimationFrames: SpriteFrame[] = []; // 被攻击动画帧
    
    @property(SpriteFrame)
    deathAnimationFrames: SpriteFrame[] = []; // 死亡动画帧
    
    // 动画名称配置
    @property
    attackAnimationName: string = ""; // 攻击动画名称，可在编辑器中配置
    
    // 动画时长属性
    @property
    idleAnimationDuration: number = 1.0; // 待机动画总时长
    
    @property
    walkAnimationDuration: number = 1.0; // 行走动画总时长
    
    @property
    attackAnimationDuration: number = 0.5; // 攻击动画总时长
    
    @property
    hitAnimationDuration: number = 0.3; // 被攻击动画总时长
    
    @property
    deathAnimationDuration: number = 1.0; // 死亡动画总时长

    protected currentHealth: number = 0;
    private healthBar: HealthBar = null!;
    private healthBarNode: Node = null!;
    protected isDestroyed: boolean = false;
    private attackTimer: number = 0;
    protected currentTarget: Node = null!;
    private gameManager: GameManager = null!;
    private detourTarget: Vec3 | null = null; // 绕行目标点，当找到绕行路径时设置
    
    // 唯一ID，用于区分不同的敌人实例
    private enemyId: string = "";
    
    // 石墙网格寻路相关属性
    private stoneWallGridPanelComponent: StoneWallGridPanel | null = null; // 石墙网格面板组件引用
    private gridPath: Vec3[] = []; // 存储路径上的所有点
    private currentPathIndex: number = 0; // 当前路径点索引
    private lastPathCheckTime: number = 0; // 上次路径检查时间（秒）
    private isInStoneWallGrid: boolean = false; // 标记是否在网格中寻路
    private topLayerGapTarget: Vec3 | null = null; // 网格最上层缺口目标点
    
    @property
    goldReward: number = 0; // 消灭敌人获得的金币
    
    @property(AudioClip)
    deathSound: AudioClip = null!; // 敌人死亡音效
    
    @property(AudioClip)
    attackSound: AudioClip = null!; // 敌人攻击音效
    
    // 动画相关私有属性
    protected sprite: Sprite = null!;
    private uiTransform: UITransform = null!;
    private currentAnimationFrameIndex: number = 0;
    private animationTimer: number = 0;
    private isPlayingIdleAnimation: boolean = false;
    private isPlayingWalkAnimation: boolean = false;
    protected isPlayingAttackAnimation: boolean = false;
    private isPlayingHitAnimation: boolean = false;
    protected isPlayingDeathAnimation: boolean = false;
    protected defaultSpriteFrame: SpriteFrame = null!;
    protected defaultScale: Vec3 = new Vec3(1, 1, 1); // 默认缩放比例，用于方向翻转
    private isHit: boolean = false; // 表示敌人是否正在被攻击
    protected attackCallback: (() => void) | null = null; // 攻击动画完成后的回调函数
    private attackComplete: boolean = false; // 攻击动画是否已完成造成伤害
    
    // Animation组件相关
    protected animationComponent: Animation = null!; // Animation组件引用

    // 日志格式化辅助方法
    private logMessage(level: 'info' | 'debug' | 'warn' | 'error', message: string) {
        const formattedMessage = `[${this.enemyId}] ${message}`;
        switch (level) {
            case 'info':
                console.info(formattedMessage);
                break;
            case 'debug':
                console.debug(formattedMessage);
                break;
            case 'warn':
                this.logMessage('debug', formattedMessage);
                break;
            case 'error':
                console.error(formattedMessage);
                break;
        }
    }

    start() {
        // 生成唯一ID（使用时间戳和随机数）
        if (!this.enemyId) {
            this.enemyId = `Enemy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        this.detourTarget = null; // 初始化绕行目标点
        
        // 初始化网格寻路相关属性
        this.gridPath = [];
        this.currentPathIndex = 0;
        this.isInStoneWallGrid = false;
        this.stoneWallGridPanelComponent = null;
        this.topLayerGapTarget = null;
        
        // 保存默认缩放比例
        this.defaultScale = this.node.scale.clone();
        
        // 初始化动画相关属性
        this.sprite = this.node.getComponent(Sprite);
        this.uiTransform = this.node.getComponent(UITransform);
        this.animationComponent = this.node.getComponent(Animation);
        
        if (this.sprite) {
            this.defaultSpriteFrame = this.sprite.spriteFrame;
            // 设置Sprite的sizeMode为CUSTOM，以便适配UITransform大小
            this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        
        // 查找游戏管理器
        this.findGameManager();
        
        // 如果targetCrystal没有设置，尝试查找
        if (!this.targetCrystal) {
            // 使用 find 函数查找节点
            let crystalNode = find('Crystal');
            
            // 如果找不到，尝试从场景根节点递归查找
            if (!crystalNode && this.node.scene) {
                const findInScene = (node: Node, name: string): Node | null => {
                    if (node.name === name) {
                        return node;
                    }
                    for (const child of node.children) {
                        const found = findInScene(child, name);
                        if (found) return found;
                    }
                    return null;
                };
                crystalNode = findInScene(this.node.scene, 'Crystal');
            }
            
            if (crystalNode) {
                this.targetCrystal = crystalNode;
            }
        }
        
        // 创建血条
        this.createHealthBar();
        
        // 初始播放待机动画
        this.playIdleAnimation();
    }

    createHealthBar() {
        // 创建血条节点
        this.healthBarNode = new Node('HealthBar');
        this.healthBarNode.setParent(this.node);
        this.healthBarNode.setPosition(0, 30, 0); // 在敌人上方
        
        // 添加HealthBar组件
        this.healthBar = this.healthBarNode.addComponent(HealthBar);
        if (this.healthBar) {
            this.healthBar.setMaxHealth(this.maxHealth);
            this.healthBar.setHealth(this.currentHealth);
        }
    }

    findGameManager() {
        // 方法1: 通过节点名称查找
        let gmNode = find('GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager);
            if (this.gameManager) {
                return;
            }
        }
        
        // 方法2: 从场景根节点递归查找GameManager组件
        const scene = this.node.scene;
        if (scene) {
            const findInScene = (node: Node, componentType: any): any => {
                const comp = node.getComponent(componentType);
                if (comp) return comp;
                for (const child of node.children) {
                    const found = findInScene(child, componentType);
                    if (found) return found;
                }
                return null;
            };
            this.gameManager = findInScene(scene, GameManager);
        }
    }

    update(deltaTime: number) {
        // 如果被销毁，只更新动画，不执行其他逻辑
        if (this.isDestroyed) {
            this.updateAnimation(deltaTime);
            return;
        }

        this.logMessage('info', `[Enemy] update: gameManager`);
        // 检查游戏状态 - 如果GameManager不存在，尝试重新查找
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        // 检查游戏状态，只在Playing状态下运行
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                // 游戏已结束或暂停，停止移动和攻击
                this.stopMoving();
                this.currentTarget = null!;
                return;
            }
        }

        this.logMessage('info', `[Enemy] update: oldAttackTimer`);
        // 更新攻击计时器
        const oldAttackTimer = this.attackTimer;
        this.attackTimer += deltaTime;
        // 如果attackTimer接近或达到attackInterval，添加详细日志
        if (this.currentTarget && Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition) <= this.attackRange) {
            if (this.attackTimer >= this.attackInterval - 0.1 || (oldAttackTimer < this.attackInterval && this.attackTimer >= this.attackInterval)) {
                this.logMessage('debug', `update: ⏰ attackTimer累积: ${oldAttackTimer.toFixed(2)} -> ${this.attackTimer.toFixed(2)}, attackInterval=${this.attackInterval}, 是否达到攻击条件=${this.attackTimer >= this.attackInterval}`);
            }
        }

        this.logMessage('info', `[Enemy] update: findTarget`);
        // 查找目标（优先防御塔，然后水晶）
        this.findTarget();

        this.logMessage('info', `[Enemy] update: 如果在网格中寻路` + this.isInStoneWallGrid);
        // 最高优先级：如果在网格中寻路，优先执行网格寻路逻辑
        if (this.isInStoneWallGrid) {
            this.logMessage('info', `[Enemy] update: 在网格中寻路，执行网格移动逻辑`);
            // 如果正在播放攻击动画，停止攻击动画并切换到移动动画
            if (this.isPlayingAttackAnimation) {
                this.logMessage('info', `[Enemy] update: 在网格中寻路，检测到正在播放攻击动画，停止攻击动画并切换到移动动画`);
                this.isPlayingAttackAnimation = false;
                this.attackComplete = false;
                this.stopAllAnimations();
            }
            const hadTargetBefore = !!this.currentTarget;
            this.moveInStoneWallGrid(deltaTime);
            // 如果moveInStoneWallGrid检测到我方单位并设置了currentTarget，且退出了网格寻路模式，不直接return，让后续逻辑处理目标
            this.logMessage('info', `[Enemy] update: moveInStoneWallGrid检测到我方单位，已退出网格寻路模式，继续处理目标移动` + this.isInStoneWallGrid + " " + this.currentTarget + " " + hadTargetBefore);
            if (!this.isInStoneWallGrid && this.currentTarget && !hadTargetBefore) {
                this.logMessage('info', `[Enemy] update: moveInStoneWallGrid检测到我方单位，已退出网格寻路模式，继续处理目标移动`);
                // 不return，继续执行后续逻辑处理移动和攻击
            } else {
                this.logMessage('info', `[Enemy] update: moveInStoneWallGrid检测到我方单位，已退出网格寻路模式，继续处理目标移动` + this.isInStoneWallGrid + " " + this.currentTarget + " " + hadTargetBefore);
                this.updateAnimation(deltaTime);
                return;
            }
        }

        this.logMessage('info', `[Enemy] update: 检查敌人是否在网格上方` + this.currentTarget + " " + this.isInStoneWallGrid + " " + this.topLayerGapTarget);
        // 检查敌人是否在网格上方，如果是，先移动到缺口（但前提是还没有到达最底层）
        // 优先级：如果有缺口目标，优先移动到缺口；如果没有，检查是否在网格上方并查找缺口
        if (!this.currentTarget && !this.isInStoneWallGrid) {
            // 先检查是否已经在最底层，如果是，清除所有网格相关状态，直接向水晶移动
            const currentGrid = this.stoneWallGridPanelComponent?.worldToGrid(this.node.worldPosition);
            if (currentGrid && currentGrid.y <= 0) {
                // 已在最底层，清除所有网格相关状态，直接向水晶移动
                this.logMessage('debug', `[Enemy] update: 敌人已在最底层（gridY=${currentGrid.y}），清除网格相关状态，直接向水晶移动`);
                this.topLayerGapTarget = null;
                this.detourTarget = null;
                // 直接跳过后续的网格和绕行逻辑，进入向水晶移动的逻辑
            } else if ((this.topLayerGapTarget || this.checkEnemyAboveGrid()) && !this.currentTarget) {
                // 如果已经有缺口目标，或者敌人在网格上方，且没有当前目标，处理缺口移动逻辑
                // 如果还没有找到缺口目标，寻找缺口
                if (!this.topLayerGapTarget) {
                    const gapPos = this.findGapInTopLayer();
                    if (gapPos) {
                        this.topLayerGapTarget = gapPos;
                        this.logMessage('debug', `[Enemy] update: ✅ 在网格上方，找到缺口位置: (${gapPos.x.toFixed(1)}, ${gapPos.y.toFixed(1)})`);
                    } else {
                        // 找不到缺口，攻击最近的石墙
                        const nearestWall = this.findNearestStoneWall();
                        if (nearestWall) {
                            this.currentTarget = nearestWall;
                            // 清除缺口目标，确保不会进入缺口移动逻辑
                            this.topLayerGapTarget = null;
                            this.logMessage('debug', `[Enemy] update: 网格最上层没有缺口，设置为攻击最近的石墙，距离=${Vec3.distance(this.node.worldPosition, nearestWall.worldPosition).toFixed(1)}`);
                            // 直接跳出缺口处理分支，继续执行后续的"处理当前目标"逻辑
                            // 不执行return，让后续逻辑处理移动和攻击
                        } else {
                            // 如果正在播放攻击动画，停止攻击动画
                            if (this.isPlayingAttackAnimation) {
                                this.isPlayingAttackAnimation = false;
                            }
                            return;
                        }
                    }
                }

                // 如果设置了石墙目标，不应该进入缺口移动逻辑，应该跳出这个分支
                if (this.currentTarget && !this.topLayerGapTarget) {
                    // 已经设置了石墙目标，跳出缺口处理逻辑，让后续逻辑处理移动和攻击
                    // 清除可能存在的缺口目标标记
                    this.topLayerGapTarget = null;
                    // 不执行return，跳出这个else if分支，继续执行后续的"处理当前目标"逻辑
                } else if (this.topLayerGapTarget) {
                    // 移动到缺口
                    const enemyPos = this.node.worldPosition;
                    const toGap = new Vec3();
                    Vec3.subtract(toGap, this.topLayerGapTarget, enemyPos);
                    const gapDistance = toGap.length();

                    if (gapDistance < 15) {
                        // 已到达缺口，清除缺口标记，进入网格寻路模式
                        this.logMessage('debug', `[Enemy] update: ✅ 已到达缺口位置(${this.topLayerGapTarget.x.toFixed(1)}, ${this.topLayerGapTarget.y.toFixed(1)})，距离=${gapDistance.toFixed(1)}，进入网格寻路模式`);
                        
                        // 确保敌人位置精确对齐到缺口位置
                        const clampedPos = this.clampPositionToScreen(this.topLayerGapTarget);
                        this.node.setWorldPosition(clampedPos);
                        
                        const gapTarget = this.topLayerGapTarget;
                        this.topLayerGapTarget = null;
                        
                        // 进入网格寻路模式
                        this.isInStoneWallGrid = true;
                        const path = this.findPathInStoneWallGrid();
                        if (path && path.length > 0) {
                            this.gridPath = path;
                            this.currentPathIndex = 0;
                            this.logMessage('debug', `[Enemy] update: 找到网格路径，路径点数量=${path.length}，开始网格内移动`);
                            this.moveInStoneWallGrid(deltaTime);
                            return;
                        } else {
                            // 无路可走，攻击最近的石墙（最高优先级）
                            this.isInStoneWallGrid = false;
                            const nearestWall = this.findNearestStoneWall();
                            if (nearestWall) {
                                this.currentTarget = nearestWall;
                                // 清除绕行目标点，因为A*寻路失败后的石墙攻击优先级更高
                                if (this.detourTarget) {
                                    this.logMessage('debug', `[Enemy] update: A*寻路失败后的石墙目标（最高优先级），清除绕行目标点`);
                                    this.detourTarget = null;
                                }
                                this.logMessage('debug', `[Enemy] update: ❌ A*寻路失败，设置为攻击最近的石墙（最高优先级）`);
                                // 不立即return，让后续逻辑处理移动和攻击
                            } else {
                                this.logMessage('debug', `[Enemy] update: ❌ A*寻路失败且找不到石墙，停止移动`);
                                return;
                            }
                        }
                        // 继续执行，让后续逻辑处理石墙攻击
                    } else {
                        // 向缺口移动前，优先检测我方单位
                        const friendlyUnit = this.checkForFriendlyUnitInGrid();
                        if (friendlyUnit) {
                            // 检测到我方单位且路径畅通，优先攻击我方单位
                            this.logMessage('debug', `[Enemy] update: 在网格上方检测到我方单位且路径畅通，优先攻击`);
                            this.topLayerGapTarget = null;
                            this.currentTarget = friendlyUnit;
                            // 清除绕行目标点
                            if (this.detourTarget) {
                                this.detourTarget = null;
                            }
                            // 继续执行后续逻辑处理移动和攻击
                            return;
                        }

                        // 向缺口移动
                        this.logMessage('debug', `[Enemy] update: 🎯 向缺口移动，当前位置(${enemyPos.x.toFixed(1)}, ${enemyPos.y.toFixed(1)})，目标(${this.topLayerGapTarget.x.toFixed(1)}, ${this.topLayerGapTarget.y.toFixed(1)})，距离=${gapDistance.toFixed(1)}`);
                        toGap.normalize();
                        const moveDistance = this.moveSpeed * deltaTime;
                        const newPos = new Vec3();
                        Vec3.scaleAndAdd(newPos, enemyPos, toGap, moveDistance);
                        
                        const clampedPos = this.clampPositionToScreen(newPos);
                        this.node.setWorldPosition(clampedPos);
                        
                        // 根据移动方向翻转
                        this.flipDirection(toGap);
                        
                        // 播放行走动画
                        this.playWalkAnimation();
                        
                        // 如果正在播放攻击动画，停止攻击动画
                        if (this.isPlayingAttackAnimation) {
                            this.isPlayingAttackAnimation = false;
                        }
                    }
                    return; // 优先处理缺口移动，不继续执行后续逻辑
                }
            }
        }

        this.logMessage('info', `[Enemy] update: 检查是否需要进入网格寻路模式` + this.isInStoneWallGrid + " " + this.topLayerGapTarget + " " + this.currentTarget);
        // 检查是否需要进入网格寻路模式（但前提是还没有到达最底层，且没有缺口目标）
        // 如果正在移动到缺口，不应该进入网格寻路模式
        if (!this.currentTarget && !this.isInStoneWallGrid && !this.topLayerGapTarget) {
            // 先检查是否已经在最底层，如果是，清除网格相关状态，直接向水晶移动
            const currentGrid = this.stoneWallGridPanelComponent?.worldToGrid(this.node.worldPosition);
            if (currentGrid && currentGrid.y <= 0) {
                // 已在最底层，清除所有网格相关状态，直接向水晶移动
                this.logMessage('debug', `[Enemy] update: 敌人已在最底层（gridY=${currentGrid.y}），清除网格相关状态，直接向水晶移动`);
                this.topLayerGapTarget = null;
                this.detourTarget = null;
                // 直接跳过后续的网格和绕行逻辑，进入向水晶移动的逻辑
            } else if (this.checkStoneWallGridBelowEnemy()) {
                // checkStoneWallGridBelowEnemy() 已经检查了是否到达最底层，所以这里直接进入网格寻路模式
                this.logMessage('debug', `[Enemy] update: 检测到石墙网格在下方，进入网格寻路模式`);
                this.isInStoneWallGrid = true;
                const path = this.findPathInStoneWallGrid();
                if (path && path.length > 0) {
                    this.gridPath = path;
                    this.currentPathIndex = 0;
                    this.moveInStoneWallGrid(deltaTime);
                    // 如果正在播放攻击动画，停止攻击动画
                    if (this.isPlayingAttackAnimation) {
                        this.isPlayingAttackAnimation = false;
                    }
                    return;
                } else {
                    // 无路可走，攻击最近的石墙（最高优先级）
                    this.isInStoneWallGrid = false;
                    const nearestWall = this.findNearestStoneWall();
                    if (nearestWall) {
                        this.currentTarget = nearestWall;
                        // 清除绕行目标点，因为A*寻路失败后的石墙攻击优先级更高
                        if (this.detourTarget) {
                            this.logMessage('debug', `[Enemy] update: A*寻路失败后的石墙目标（最高优先级），清除绕行目标点`);
                            this.detourTarget = null;
                        }
                        this.logMessage('debug', `[Enemy] update: ❌ A*寻路失败，设置为攻击最近的石墙（最高优先级）`);
                        // 不立即return，让后续逻辑处理移动和攻击
                    } else {
                        this.logMessage('debug', `[Enemy] update: ❌ A*寻路失败且找不到石墙，停止移动`);
                        return;
                    }
                }
                // 继续执行，让后续逻辑处理石墙攻击
            }
        }
        this.logMessage('info', `[Enemy] update: 最高优先级`);

        // 最高优先级：如果当前目标是石墙且不在网格寻路模式（A*寻路失败后设置的），优先攻击石墙
        // 这种情况下应该清除绕行目标点，专注于攻击石墙
        if (this.currentTarget && !this.isInStoneWallGrid) {
            const currentWallScript = this.currentTarget.getComponent('StoneWall') as any;
            if (currentWallScript && currentWallScript.isAlive && currentWallScript.isAlive()) {
                // A*寻路失败后设置的石墙目标具有最高优先级，清除绕行目标点
                if (this.detourTarget) {
                    this.logMessage('debug', `[Enemy] update: A*寻路失败后的石墙目标（最高优先级），清除绕行目标点`);
                    this.detourTarget = null;
                }
                // 继续执行，让后续逻辑处理石墙攻击
            }
        }
        this.logMessage('info', `[Enemy] update: 如果有绕行目标点`);

        // 如果有绕行目标点，直接向绕行目标点移动，忽略当前目标
        // 但前提是敌人还没有到达最底层，且当前目标不是A*寻路失败后的石墙
        if (this.detourTarget) {
            const currentGrid = this.stoneWallGridPanelComponent?.worldToGrid(this.node.worldPosition);
            if (currentGrid && currentGrid.y <= 0) {
                // 已在最底层，清除绕行目标点，直接向水晶移动
                this.logMessage('debug', `[Enemy] update: 敌人已在最底层（gridY=${currentGrid.y}），清除绕行目标点，直接向水晶移动`);
                this.detourTarget = null;
                // 继续执行，进入向水晶移动的逻辑
            } else {
                this.logMessage('debug', `[Enemy] update: 检测到绕行目标点，优先向绕行点移动`);
                this.moveTowardsCrystal(deltaTime); // 这个方法会处理绕行目标点逻辑
                // 如果正在播放攻击动画，停止攻击动画
                if (this.isPlayingAttackAnimation) {
                    this.isPlayingAttackAnimation = false;
                }
                return;
            }
        }
        this.logMessage('info', `[Enemy] update: 处理当前目标`);

        // 处理当前目标
        if (this.currentTarget) {
            const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
            const targetType = this.currentTarget.getComponent('StoneWall') ? '石墙' : 
                              this.currentTarget.getComponent('Crystal') ? '水晶' : '其他';
            
            this.logMessage('debug', `update: 处理当前目标${targetType}，距离=${distance.toFixed(1)}, 攻击范围=${this.attackRange}, 是否在攻击范围内=${distance <= this.attackRange}, attackTimer=${this.attackTimer.toFixed(2)}, attackInterval=${this.attackInterval}, isHit=${this.isHit}, isPlayingAttackAnimation=${this.isPlayingAttackAnimation}`);
            
            if (distance <= this.attackRange) {
                // 在攻击范围内，停止移动并攻击
                this.logMessage('debug', `update: 目标${targetType}在攻击范围内，距离=${distance.toFixed(1)}, 攻击范围=${this.attackRange}, attackTimer=${this.attackTimer.toFixed(2)}, attackInterval=${this.attackInterval}, isHit=${this.isHit}, isPlayingAttackAnimation=${this.isPlayingAttackAnimation}`);
                // 只有在攻击条件满足时才停止移动并攻击，避免在等待攻击时重置动画状态
                if (this.attackTimer >= this.attackInterval && !this.isHit && !this.isPlayingAttackAnimation) {
                    // 攻击条件满足，停止移动并攻击
                    this.stopMoving();
                    this.logMessage('debug', `update: 攻击条件满足，调用attack方法，距离=${distance.toFixed(1)}, 攻击范围=${this.attackRange}`);
                    this.attack();
                    this.attackTimer = 0;
                } else {
                    // 攻击条件不满足，不调用移动方法也不调用stopMoving()，保持当前状态等待攻击
                    this.logMessage('debug', `update: 攻击条件不满足，attackTimer=${this.attackTimer.toFixed(2)}, attackInterval=${this.attackInterval}, isHit=${this.isHit}, isPlayingAttackAnimation=${this.isPlayingAttackAnimation}，保持当前状态等待攻击`);
                    // 不调用移动方法，敌人自然停止移动，也不调用stopMoving()避免重置动画状态
                }
            } else {
                // 不在攻击范围内，只有在没有被攻击时才继续移动
                this.logMessage('debug', `update: 目标${targetType}不在攻击范围内(距离: ${distance.toFixed(1)}, 攻击范围: ${this.attackRange})，继续移动，isHit=${this.isHit}, isPlayingAttackAnimation=${this.isPlayingAttackAnimation}`);
                if (!this.isHit && !this.isPlayingAttackAnimation) {
                    this.moveTowardsTarget(deltaTime);
                    // 如果正在播放攻击动画，停止攻击动画
                    if (this.isPlayingAttackAnimation) {
                        this.isPlayingAttackAnimation = false;
                    }
                } else {
                    this.logMessage('debug', `update: 无法移动，isHit=${this.isHit}, isPlayingAttackAnimation=${this.isPlayingAttackAnimation}`);
                }
            }
        } else {
            // 没有目标，检查路径是否被石墙阻挡
            if (this.targetCrystal && this.targetCrystal.isValid && !this.isHit) {
                // 在移动前先检查路径是否被石墙阻挡
                const blockedStoneWall = this.checkPathBlockedByStoneWall();
                if (blockedStoneWall) {
                    // 路径被石墙阻挡且无法绕行，立即设置为攻击目标
                    this.logMessage('debug', `[Enemy] update: 路径被石墙阻挡且无法绕行，设置石墙为攻击目标`);
                    this.currentTarget = blockedStoneWall;
                    // 继续执行，让下一帧处理攻击逻辑
                } else {
                    // 路径畅通，向水晶移动
                    this.moveTowardsCrystal(deltaTime);
                    // 如果正在播放攻击动画，停止攻击动画
                    if (this.isPlayingAttackAnimation) {
                        this.isPlayingAttackAnimation = false;
                    }
                }
            }
        }
        
        this.logMessage('info', `[Enemy] update: updateAnimation`);
        // 更新动画
        this.updateAnimation(deltaTime);
    }

    private findTarget() {
        // 如果有绕行目标点，直接返回，不执行目标查找逻辑，确保敌人优先朝绕行点移动
        if (this.detourTarget) {
            console.debug(`[Enemy] findTarget: 已有绕行目标点，跳过目标查找`);
            return;
        }
        
        // 如果当前目标是我方单位（弓箭手、女猎手、剑士、牧师），保持这个目标作为最高优先级
        if (this.currentTarget && !this.isInStoneWallGrid) {
            const arrowerScript = this.currentTarget.getComponent('Arrower') as any;
            const hunterScript = this.currentTarget.getComponent('Hunter') as any;
            const swordsmanScript = this.currentTarget.getComponent('ElfSwordsman') as any;
            const priestScript = this.currentTarget.getComponent('Priest') as any;
            
            if ((arrowerScript || hunterScript || swordsmanScript || priestScript) && 
                this.currentTarget.active && this.currentTarget.isValid) {
                // 检查这个单位是否仍然有效且存活
                if ((arrowerScript && arrowerScript.isAlive && arrowerScript.isAlive()) ||
                    (hunterScript && hunterScript.isAlive && hunterScript.isAlive()) ||
                    (swordsmanScript && swordsmanScript.isAlive && swordsmanScript.isAlive()) ||
                    (priestScript && priestScript.isAlive && priestScript.isAlive())) {
                    const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
                    console.debug(`[Enemy] findTarget: 当前目标是我方单位，保持目标（最高优先级），距离: ${distance.toFixed(1)}`);
                    // 保持这个目标，不执行后续的目标查找逻辑
                    return;
                }
            }
        }

        // 如果当前目标是石墙且敌人不在网格寻路模式（说明可能是A*寻路失败后设置的，或者是网格最上层没有缺口时设置的），保持这个目标作为最高优先级
        if (this.currentTarget && !this.isInStoneWallGrid) {
            const currentWallScript = this.currentTarget.getComponent('StoneWall') as any;
            if (currentWallScript && currentWallScript.isAlive && currentWallScript.isAlive()) {
                // 检查这个石墙是否仍然有效且存活
                const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
                this.logMessage('debug', `findTarget: 当前目标是石墙（A*寻路失败后设置或网格最上层没有缺口时设置），保持目标（最高优先级），距离: ${distance.toFixed(1)}, 攻击范围: ${this.attackRange}`);
                // 保持这个目标，不执行后续的目标查找逻辑，确保敌人会移动到攻击范围内
                return;
            }
        }
        
        // 使用递归查找Towers容器（更可靠）
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
        
        // 索敌范围：200像素
        const detectionRange = 200;
        
        // 检查当前目标是否仍然有效，特别是石墙
        if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
            const targetScript = this.currentTarget.getComponent('StoneWall') as any || 
                                this.currentTarget.getComponent('Arrower') as any || 
                                this.currentTarget.getComponent('WarAncientTree') as any ||
                                this.currentTarget.getComponent('Crystal') as any;
            
            // 如果目标是石墙，检查是否仍然存活
            if (targetScript && targetScript.isAlive && !targetScript.isAlive()) {
                console.debug(`[Enemy] findTarget: 当前目标已被摧毁，清除目标`);
                this.currentTarget = null!;
            } else {
                const currentWallScript = this.currentTarget.getComponent('StoneWall') as any;
                if (currentWallScript && currentWallScript.isAlive && currentWallScript.isAlive()) {
                    // 当前目标是石墙且仍然存活，检查距离
                    const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
                    console.debug(`[Enemy] findTarget: 当前目标是石墙，距离: ${distance.toFixed(1)}, 攻击范围: ${this.attackRange}`);
                    
                    // 如果石墙在攻击范围内，保持这个目标（正在攻击中）
                    if (distance <= this.attackRange) {
                        console.debug(`[Enemy] findTarget: 石墙在攻击范围内，保持目标`);
                        return;
                    }
                    
                    // 检查路径是否仍然被这个石墙或其他石墙阻挡且无法绕行
                    const blockedStoneWall = this.checkPathBlockedByStoneWall();
                    if (blockedStoneWall) {
                        // 路径仍然被阻挡且无法绕行，保持当前石墙目标或切换到更近的阻挡石墙
                        if (blockedStoneWall === this.currentTarget) {
                            console.debug(`[Enemy] findTarget: 路径仍然被当前石墙阻挡且无法绕行，保持目标`);
                            return;
                        } else {
                            const blockedDistance = Vec3.distance(this.node.worldPosition, blockedStoneWall.worldPosition);
                            if (blockedDistance < distance) {
                                console.debug(`[Enemy] findTarget: 切换到更近的阻挡石墙`);
                                this.currentTarget = blockedStoneWall;
                                return;
                            } else {
                                console.debug(`[Enemy] findTarget: 当前石墙更近，保持目标`);
                                return;
                            }
                        }
                    } else {
                        // 路径不再被阻挡（可以绕行），但是如果是网格最上层没有缺口时设置的石墙目标，应该保持目标
                        // 因为这种情况下，敌人应该攻击石墙而不是绕行
                        // 检查是否是在网格上方且没有缺口时设置的石墙目标
                        const isGridTopLayerWall = this.checkEnemyAboveGrid() && !this.topLayerGapTarget;
                        if (isGridTopLayerWall) {
                            // 是在网格上方且没有缺口时设置的石墙目标，保持目标，不绕行
                            console.info(`[Enemy] findTarget: 路径可以绕行，但是当前石墙目标是网格最上层没有缺口时设置的，保持目标，不绕行，距离: ${distance.toFixed(1)}`);
                            return;
                        } else {
                            // 路径不再被阻挡（可以绕行），清除石墙目标，优先绕开石墙
                            // 只有当实在无法绕行时才考虑攻击石墙
                            console.debug(`[Enemy] findTarget: 路径可以绕行，清除石墙目标，优先绕开石墙`);
                            this.currentTarget = null!;
                            // 继续执行下面的逻辑，查找其他目标
                        }
                    }
                }
            }
        }
        
        // 优先查找附近的防御塔和战争古树（在攻击范围内）
        let towers: Node[] = [];
        let towersNode = find('Towers');
        
        // 如果直接查找失败，尝试递归查找
        if (!towersNode && this.node.scene) {
            towersNode = findNodeRecursive(this.node.scene, 'Towers');
        }
        
        if (towersNode) {
            towers = towersNode.children;
        }

        // 查找战争古树
        let trees: Node[] = [];
        let warAncientTrees = find('WarAncientTrees');
        if (!warAncientTrees && this.node.scene) {
            warAncientTrees = findNodeRecursive(this.node.scene, 'WarAncientTrees');
        }
        if (warAncientTrees) {
            trees = warAncientTrees.children;
        }

        // 查找月亮井
        let wells: Node[] = [];
        let wellsNode = find('MoonWells');
        if (!wellsNode && this.node.scene) {
            wellsNode = findNodeRecursive(this.node.scene, 'MoonWells');
        }
        if (wellsNode) {
            wells = wellsNode.children;
        }

        // 查找猎手大厅
        let halls: Node[] = [];
        let hallsNode = find('HunterHalls');
        if (!hallsNode && this.node.scene) {
            hallsNode = findNodeRecursive(this.node.scene, 'HunterHalls');
        }
        if (hallsNode) {
            halls = hallsNode.children;
        } else if (this.node.scene) {
            // 如果没有找到HunterHalls容器，直接从场景中查找所有HunterHall组件
            const findAllHunterHalls = (node: Node) => {
                const hallScript = node.getComponent('HunterHall') as any;
                if (hallScript && hallScript.isAlive && hallScript.isAlive()) {
                    halls.push(node);
                }
                for (const child of node.children) {
                    findAllHunterHalls(child);
                }
            };
            findAllHunterHalls(this.node.scene);
        }

        // 查找剑士小屋
        let swordsmanHalls: Node[] = [];
        let swordsmanHallsNode = find('SwordsmanHalls');
        if (!swordsmanHallsNode && this.node.scene) {
            swordsmanHallsNode = findNodeRecursive(this.node.scene, 'SwordsmanHalls');
        }
        if (swordsmanHallsNode) {
            swordsmanHalls = swordsmanHallsNode.children;
        } else if (this.node.scene) {
            // 如果没有找到SwordsmanHalls容器，直接从场景中查找所有SwordsmanHall组件
            const findAllSwordsmanHalls = (node: Node) => {
                const hallScript = node.getComponent('SwordsmanHall') as any;
                if (hallScript && hallScript.isAlive && hallScript.isAlive()) {
                    swordsmanHalls.push(node);
                }
                for (const child of node.children) {
                    findAllSwordsmanHalls(child);
                }
            };
            findAllSwordsmanHalls(this.node.scene);
        }

        // 查找小精灵
        let wisps: Node[] = [];
        let wispsNode = find('Wisps');
        if (!wispsNode && this.node.scene) {
            wispsNode = findNodeRecursive(this.node.scene, 'Wisps');
        }
        if (wispsNode) {
            wisps = wispsNode.children;
        }
        
        let nearestTarget: Node = null!;
        let minDistance = Infinity;
        let targetPriority = Infinity;
        
        // 定义优先级：水晶>石墙（阻挡路径时）>树木>角色>建筑物
        const PRIORITY = {
            CRYSTAL: 1,
            STONEWALL: 1.5, // 石墙优先级介于水晶和树木之间
            TREE: 2,
            CHARACTER: 3,
            BUILDING: 4
        };

        // 1. 检查水晶是否在范围内（优先级最高）
        if (this.targetCrystal && this.targetCrystal.isValid) {
            const crystalScript = this.targetCrystal.getComponent('Crystal') as any;
            if (crystalScript && crystalScript.isAlive && crystalScript.isAlive()) {
                const distance = Vec3.distance(this.node.worldPosition, this.targetCrystal.worldPosition);
                if (distance <= detectionRange) {
                    nearestTarget = this.targetCrystal;
                    minDistance = distance;
                    targetPriority = PRIORITY.CRYSTAL;
                }
            }
        }

        // 2. 检查路径是否被石墙阻挡（优先级第二）
        // 如果路径被石墙阻挡且无法绕行，无论距离多远都要攻击石墙
        const blockedStoneWall = this.checkPathBlockedByStoneWall();
        if (blockedStoneWall) {
            const distance = Vec3.distance(this.node.worldPosition, blockedStoneWall.worldPosition);
            // 如果路径被阻挡且无法绕行，无论距离多远都要攻击石墙
            // 路径被完全阻挡时，石墙的优先级应该高于水晶（除非水晶已经在攻击范围内且敌人正在攻击）
            if (targetPriority === PRIORITY.CRYSTAL) {
                const crystalDistance = Vec3.distance(this.node.worldPosition, this.targetCrystal.worldPosition);
                // 如果水晶在攻击范围内且当前目标就是水晶，保持攻击水晶（可能正在攻击中）
                // 否则，即使水晶在检测范围内，也要优先攻击阻挡路径的石墙
                if (crystalDistance <= this.attackRange && this.currentTarget === this.targetCrystal) {
                    // 水晶在攻击范围内且正在攻击，保持水晶为目标
                    console.debug(`[Enemy] findTarget: 水晶在攻击范围内且正在攻击，保持水晶为目标`);
                } else {
                    // 水晶不在攻击范围内，或当前目标不是水晶，优先攻击阻挡路径的石墙
                    console.debug(`[Enemy] findTarget: 路径被完全阻挡，优先攻击石墙（距离: ${distance.toFixed(1)}），而不是水晶（距离: ${crystalDistance.toFixed(1)}）`);
                    minDistance = distance;
                    nearestTarget = blockedStoneWall;
                    targetPriority = PRIORITY.STONEWALL;
                }
            } else {
                // 当前目标不是水晶，如果路径被阻挡，强制攻击石墙
                minDistance = distance;
                nearestTarget = blockedStoneWall;
                targetPriority = PRIORITY.STONEWALL;
            }
        }

        // 3. 查找范围内的树木（优先级第三）
        // 查找树木
        let treesNode = find('Trees');
        if (!treesNode && this.node.scene) {
            treesNode = findNodeRecursive(this.node.scene, 'Trees');
        }
        
        if (treesNode) {
            const trees = treesNode.children || [];
            for (const tree of trees) {
                if (tree && tree.active && tree.isValid) {
                    const treeScript = tree.getComponent('Tree') as any;
                    // 检查树木是否存活
                    if (treeScript && treeScript.isAlive && treeScript.isAlive()) {
                        const distance = Vec3.distance(this.node.worldPosition, tree.worldPosition);
                        // 如果树木在范围内，且优先级更高或距离更近
                        if (distance <= detectionRange) {
                            if (PRIORITY.TREE < targetPriority || 
                                (PRIORITY.TREE === targetPriority && distance < minDistance)) {
                                minDistance = distance;
                                nearestTarget = tree;
                                targetPriority = PRIORITY.TREE;
                            }
                        }
                    }
                }
            }
        }
        
        // 4. 查找范围内的角色（优先级第四）
        // 查找所有角色单位：弓箭手、小精灵、女猎手、牧师
        // 1) 弓箭手
        for (const tower of towers) {
            if (tower && tower.active && tower.isValid) {
                const towerScript = tower.getComponent('Arrower') as any;
                // 检查弓箭手是否存活
                if (towerScript && towerScript.isAlive && towerScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, tower.worldPosition);
                    // 如果弓箭手在范围内，且优先级更高或距离更近
                    if (distance <= detectionRange) {
                        if (PRIORITY.CHARACTER < targetPriority || 
                            (PRIORITY.CHARACTER === targetPriority && distance < minDistance)) {
                            minDistance = distance;
                            nearestTarget = tower;
                            targetPriority = PRIORITY.CHARACTER;
                        }
                    }
                }
            }
        }
        // 1.5) 牧师（也在Towers容器中）
        for (const tower of towers) {
            if (tower && tower.active && tower.isValid) {
                const priestScript = tower.getComponent('Priest') as any;
                // 检查牧师是否存活
                if (priestScript && priestScript.isAlive && priestScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, tower.worldPosition);
                    // 如果牧师在范围内，且优先级更高或距离更近
                    if (distance <= detectionRange) {
                        if (PRIORITY.CHARACTER < targetPriority || 
                            (PRIORITY.CHARACTER === targetPriority && distance < minDistance)) {
                            minDistance = distance;
                            nearestTarget = tower;
                            targetPriority = PRIORITY.CHARACTER;
                        }
                    }
                }
            }
        }
        // 2) 女猎手
        let hunters: Node[] = [];
        let huntersNode = find('Hunters');
        if (!huntersNode && this.node.scene) {
            huntersNode = findNodeRecursive(this.node.scene, 'Hunters');
        }
        if (huntersNode) {
            hunters = huntersNode.children;
        }
        for (const hunter of hunters) {
            if (hunter && hunter.active && hunter.isValid) {
                const hunterScript = hunter.getComponent('Hunter') as any;
                // 检查女猎手是否存活
                if (hunterScript && hunterScript.isAlive && hunterScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, hunter.worldPosition);
                    // 如果女猎手在范围内，且优先级更高或距离更近
                    if (distance <= detectionRange) {
                        if (PRIORITY.CHARACTER < targetPriority || 
                            (PRIORITY.CHARACTER === targetPriority && distance < minDistance)) {
                            minDistance = distance;
                            nearestTarget = hunter;
                            targetPriority = PRIORITY.CHARACTER;
                        }
                    }
                }
            }
        }
        // 3) 精灵剑士
        let swordsmen: Node[] = [];
        let swordsmenNode = find('ElfSwordsmans');
        if (!swordsmenNode && this.node.scene) {
            swordsmenNode = findNodeRecursive(this.node.scene, 'ElfSwordsmans');
        }
        if (swordsmenNode) {
            swordsmen = swordsmenNode.children;
        }
        for (const swordsman of swordsmen) {
            if (swordsman && swordsman.active && swordsman.isValid) {
                const swordsmanScript = swordsman.getComponent('ElfSwordsman') as any;
                // 检查精灵剑士是否存活
                if (swordsmanScript && swordsmanScript.isAlive && swordsmanScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, swordsman.worldPosition);
                    // 如果精灵剑士在范围内，且优先级更高或距离更近
                    if (distance <= detectionRange) {
                        if (PRIORITY.CHARACTER < targetPriority || 
                            (PRIORITY.CHARACTER === targetPriority && distance < minDistance)) {
                            minDistance = distance;
                            nearestTarget = swordsman;
                            targetPriority = PRIORITY.CHARACTER;
                        }
                    }
                }
            }
        }

        // 5. 查找范围内的建筑物（战争古树、月亮井和猎手大厅，优先级第五）
        // 战争古树
        for (const tree of trees) {
            if (tree && tree.active && tree.isValid) {
                const treeScript = tree.getComponent('WarAncientTree') as any;
                // 检查战争古树是否存活
                if (treeScript && treeScript.isAlive && treeScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, tree.worldPosition);
                    // 如果战争古树在范围内，且优先级更高或距离更近
                    if (distance <= detectionRange) {
                        if (PRIORITY.BUILDING < targetPriority || 
                            (PRIORITY.BUILDING === targetPriority && distance < minDistance)) {
                            minDistance = distance;
                            nearestTarget = tree;
                            targetPriority = PRIORITY.BUILDING;
                        }
                    }
                }
            }
        }
        // 月亮井
        for (const well of wells) {
            if (well && well.active && well.isValid) {
                const wellScript = well.getComponent('MoonWell') as any;
                // 检查月亮井是否存活
                if (wellScript && wellScript.isAlive && wellScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, well.worldPosition);
                    // 如果月亮井在范围内，且优先级更高或距离更近
                    if (distance <= detectionRange) {
                        if (PRIORITY.BUILDING < targetPriority || 
                            (PRIORITY.BUILDING === targetPriority && distance < minDistance)) {
                            minDistance = distance;
                            nearestTarget = well;
                            targetPriority = PRIORITY.BUILDING;
                        }
                    }
                }
            }
        }
        // 猎手大厅
        for (const hall of halls) {
            if (hall && hall.active && hall.isValid) {
                const hallScript = hall.getComponent('HunterHall') as any;
                // 检查猎手大厅是否存活
                if (hallScript && hallScript.isAlive && hallScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, hall.worldPosition);
                    // 如果猎手大厅在范围内，且优先级更高或距离更近
                    if (distance <= detectionRange) {
                        if (PRIORITY.BUILDING < targetPriority || 
                            (PRIORITY.BUILDING === targetPriority && distance < minDistance)) {
                            minDistance = distance;
                            nearestTarget = hall;
                            targetPriority = PRIORITY.BUILDING;
                        }
                    }
                }
            }
        }
        // 剑士小屋
        for (const hall of swordsmanHalls) {
            if (hall && hall.active && hall.isValid) {
                const hallScript = hall.getComponent('SwordsmanHall') as any;
                // 检查剑士小屋是否存活
                if (hallScript && hallScript.isAlive && hallScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, hall.worldPosition);
                    // 如果剑士小屋在范围内，且优先级更高或距离更近
                    if (distance <= detectionRange) {
                        if (PRIORITY.BUILDING < targetPriority || 
                            (PRIORITY.BUILDING === targetPriority && distance < minDistance)) {
                            minDistance = distance;
                            nearestTarget = hall;
                            targetPriority = PRIORITY.BUILDING;
                        }
                    }
                }
            }
        }

        // 3.3) 小精灵
        for (const wisp of wisps) {
            if (wisp && wisp.active && wisp.isValid) {
                const wispScript = wisp.getComponent('Wisp') as any;
                // 检查小精灵是否存活
                if (wispScript && wispScript.isAlive && wispScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, wisp.worldPosition);
                    // 如果小精灵在范围内，且优先级更高或距离更近
                    if (distance <= detectionRange) {
                        if (PRIORITY.CHARACTER < targetPriority || 
                            (PRIORITY.CHARACTER === targetPriority && distance < minDistance)) {
                            minDistance = distance;
                            nearestTarget = wisp;
                            targetPriority = PRIORITY.CHARACTER;
                        }
                    }
                }
            }
        }

        // 如果找到目标，设置为当前目标
        // 但是，如果当前目标是石墙（网格最上层没有缺口时设置的），且新找到的目标不是石墙，不要替换
        if (nearestTarget) {
            const currentWallScript = this.currentTarget?.getComponent('StoneWall') as any;
            const isCurrentTargetGridTopLayerWall = currentWallScript && this.checkEnemyAboveGrid() && !this.topLayerGapTarget;
            const newTargetIsWall = nearestTarget.getComponent('StoneWall') !== null;
            
            if (isCurrentTargetGridTopLayerWall && !newTargetIsWall) {
                // 当前目标是网格最上层没有缺口时设置的石墙，且新目标不是石墙，保持当前目标
                console.info(`[Enemy] findTarget: 当前目标是网格最上层没有缺口时设置的石墙，保持目标，不替换为新目标`);
                return;
            }
            
            this.currentTarget = nearestTarget;
        } else {
            // 如果有绕行目标点，不要设置水晶为当前目标，让moveTowardsCrystal处理绕行逻辑
            if (this.detourTarget) {
                console.debug(`[Enemy] findTarget: 已有绕行目标点，不设置水晶为当前目标`);
                this.currentTarget = null!;
            } else {
                // 200像素范围内没有任何我方单位，目标设为水晶
                if (this.targetCrystal && this.targetCrystal.isValid) {
                    const crystalScript = this.targetCrystal.getComponent('Crystal') as any;
                    if (crystalScript && crystalScript.isAlive && crystalScript.isAlive()) {
                        this.currentTarget = this.targetCrystal;
                    } else {
                        this.currentTarget = null!;
                    }
                } else {
                    this.currentTarget = null!;
                }
            }
        }
    }

    private moveTowardsTarget(deltaTime: number) {
        if (!this.currentTarget) {
             this.logMessage('debug', `[Enemy] moveTowardsTarget: 没有当前目标，无法移动`);
            return;
        }

        // 如果正在播放攻击动画，停止攻击动画并切换到移动动画
        if (this.isPlayingAttackAnimation) {
            this.logMessage('debug', `moveTowardsTarget: 检测到正在播放攻击动画，停止攻击动画并切换到移动动画`);
            this.isPlayingAttackAnimation = false;
            this.attackComplete = false;
            this.stopAllAnimations();
        }

        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        const distance = direction.length();
        
        // 检查目标是否是石墙
        const targetScript = this.currentTarget.getComponent('StoneWall') as any;
        const isTargetStoneWall = !!targetScript;
        
        this.logMessage('debug', `moveTowardsTarget: 开始移动，目标=${this.currentTarget.name || '未知'}, 距离=${distance.toFixed(1)}, 攻击范围=${this.attackRange}, 是石墙=${isTargetStoneWall}`);
        
        // 如果目标是石墙，使用简化的移动逻辑：直接移动到攻击范围内
        if (isTargetStoneWall) {
            // 检查是否已经在攻击范围内
            if (distance <= this.attackRange) {
                // 已经在攻击范围内，停止移动，让update()方法处理攻击
                this.logMessage('debug', `moveTowardsTarget: 目标石墙已在攻击范围内(距离: ${distance.toFixed(1)}, 攻击范围: ${this.attackRange})，停止移动`);
                return;
            }
            
            // 直接向石墙移动，即使检测到碰撞也要继续移动，直到进入攻击范围
            direction.normalize();
            const moveStep = this.moveSpeed * deltaTime;
            const currentPos = this.node.worldPosition.clone();
            const newPos = new Vec3();
            Vec3.scaleAndAdd(newPos, currentPos, direction, moveStep);
            
            // 检查新位置到石墙的距离
            const newDistance = Vec3.distance(newPos, this.currentTarget.worldPosition);
            
            this.logMessage('debug', `moveTowardsTarget: 石墙目标移动计算，当前位置(${currentPos.x.toFixed(1)}, ${currentPos.y.toFixed(1)}), 石墙位置(${this.currentTarget.worldPosition.x.toFixed(1)}, ${this.currentTarget.worldPosition.y.toFixed(1)}), 移动方向(${direction.x.toFixed(2)}, ${direction.y.toFixed(2)}), 移动步长=${moveStep.toFixed(1)}, 新位置(${newPos.x.toFixed(1)}, ${newPos.y.toFixed(1)}), 当前距离: ${distance.toFixed(1)}, 新距离: ${newDistance.toFixed(1)}, 攻击范围: ${this.attackRange}`);
            
            // 如果移动后距离小于等于攻击范围，允许移动到该位置（即使检测到碰撞）
            if (newDistance <= this.attackRange) {
                // 移动后会在攻击范围内，正常移动（忽略碰撞检测）
                this.logMessage('debug', `moveTowardsTarget: 向石墙移动（将进入攻击范围），当前位置(${currentPos.x.toFixed(1)}, ${currentPos.y.toFixed(1)}), 新位置(${newPos.x.toFixed(1)}, ${newPos.y.toFixed(1)}), 当前距离: ${distance.toFixed(1)}, 新距离: ${newDistance.toFixed(1)}, 攻击范围: ${this.attackRange}`);
                
                const clampedPos = this.clampPositionToScreen(newPos);
                const clampedDistance = Vec3.distance(clampedPos, this.currentTarget.worldPosition);
                
                // 检查位置是否被限制（如果被限制，说明可能到达了屏幕边界）
                const wasClamped = Math.abs(clampedPos.x - newPos.x) > 0.1 || Math.abs(clampedPos.y - newPos.y) > 0.1;
                if (wasClamped) {
                    this.logMessage('debug', `moveTowardsTarget: 位置被屏幕边界限制，原始位置(${newPos.x.toFixed(1)}, ${newPos.y.toFixed(1)}), 限制后位置(${clampedPos.x.toFixed(1)}, ${clampedPos.y.toFixed(1)})`);
                }
                
                this.node.setWorldPosition(clampedPos);
                this.logMessage('debug', `moveTowardsTarget: 已设置新位置(${clampedPos.x.toFixed(1)}, ${clampedPos.y.toFixed(1)}), 实际距离=${clampedDistance.toFixed(1)}`);
                this.flipDirection(direction);
                this.playWalkAnimation();
            } else {
                // 移动后距离仍然大于攻击范围，计算攻击范围边缘位置并移动到那里
                this.logMessage('debug', `moveTowardsTarget: 移动后距离仍然大于攻击范围(newDistance=${newDistance.toFixed(1)}, attackRange=${this.attackRange})，计算攻击范围边缘位置`);
                const targetPos = this.currentTarget.worldPosition;
                const attackRangePos = new Vec3();
                // 从石墙位置向敌人方向后退 attackRange 距离
                Vec3.scaleAndAdd(attackRangePos, targetPos, direction, -this.attackRange);
                
                // 计算从当前位置到攻击范围边缘的移动方向
                const moveToRangeDirection = new Vec3();
                Vec3.subtract(moveToRangeDirection, attackRangePos, currentPos);
                const moveToRangeDistance = moveToRangeDirection.length();
                
                this.logMessage('debug', `moveTowardsTarget: 攻击范围边缘位置=(${attackRangePos.x.toFixed(1)}, ${attackRangePos.y.toFixed(1)}), 到边缘距离=${moveToRangeDistance.toFixed(1)}, 移动步长=${moveStep.toFixed(1)}`);
                
                if (moveToRangeDistance > moveStep) {
                    this.logMessage('debug', `moveTowardsTarget: 还需要移动(moveToRangeDistance=${moveToRangeDistance.toFixed(1)} > moveStep=${moveStep.toFixed(1)})，计算新位置`);
                    // 还需要移动，计算新位置
                    moveToRangeDirection.normalize();
                    Vec3.scaleAndAdd(newPos, currentPos, moveToRangeDirection, moveStep);
                    
                    // 检查新位置是否会被clampPositionToScreen限制
                    const clampedPos = this.clampPositionToScreen(newPos);
                    const clampedDistance = Vec3.distance(clampedPos, targetPos);
                    
                    this.logMessage('debug', `moveTowardsTarget: 向石墙攻击范围边缘移动，当前位置(${currentPos.x.toFixed(1)}, ${currentPos.y.toFixed(1)}), 石墙位置(${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)}), 攻击范围边缘(${attackRangePos.x.toFixed(1)}, ${attackRangePos.y.toFixed(1)}), 新位置(${newPos.x.toFixed(1)}, ${newPos.y.toFixed(1)}), 限制后位置(${clampedPos.x.toFixed(1)}, ${clampedPos.y.toFixed(1)}), 当前距离: ${distance.toFixed(1)}, 新距离: ${newDistance.toFixed(1)}, 限制后距离: ${clampedDistance.toFixed(1)}, 攻击范围: ${this.attackRange}`);
                    
                    // 检查位置是否被限制（如果被限制，说明可能到达了屏幕边界）
                    const wasClamped = Math.abs(clampedPos.x - newPos.x) > 0.1 || Math.abs(clampedPos.y - newPos.y) > 0.1;
                    if (wasClamped) {
                        this.logMessage('debug', `moveTowardsTarget: 位置被屏幕边界限制，原始位置(${newPos.x.toFixed(1)}, ${newPos.y.toFixed(1)}), 限制后位置(${clampedPos.x.toFixed(1)}, ${clampedPos.y.toFixed(1)})`);
                    }
                    
                    this.logMessage('debug', `moveTowardsTarget: 已设置新位置(${clampedPos.x.toFixed(1)}, ${clampedPos.y.toFixed(1)}), 实际距离=${clampedDistance.toFixed(1)}`);
                    
                    this.node.setWorldPosition(clampedPos);
                    this.flipDirection(moveToRangeDirection);
                    this.playWalkAnimation();
                    this.logMessage('debug', `moveTowardsTarget: 已设置新位置并播放行走动画`);
                } else {
                    // 已经到达攻击范围边缘，直接移动到该位置
                    this.logMessage('debug', `moveTowardsTarget: 已到达石墙攻击范围边缘，当前位置(${currentPos.x.toFixed(1)}, ${currentPos.y.toFixed(1)}), 石墙位置(${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)}), 攻击范围边缘(${attackRangePos.x.toFixed(1)}, ${attackRangePos.y.toFixed(1)}), 当前距离: ${distance.toFixed(1)}, 攻击范围: ${this.attackRange}`);
                    
                    const clampedPos = this.clampPositionToScreen(attackRangePos);
                    const clampedDistance = Vec3.distance(clampedPos, targetPos);
                    this.logMessage('debug', `moveTowardsTarget: 已设置新位置(${clampedPos.x.toFixed(1)}, ${clampedPos.y.toFixed(1)}), 实际距离=${clampedDistance.toFixed(1)}`);
                    this.node.setWorldPosition(clampedPos);
                    this.flipDirection(direction);
                }
            }
            return;
        }
        
        // 非石墙目标的移动逻辑（保持原有逻辑）
        if (distance > 0.1) {
            direction.normalize();
            
            // 应用敌人避让逻辑
            const finalDirection = this.calculateEnemyAvoidanceDirection(this.node.worldPosition, direction, deltaTime);
            
            const newPos = new Vec3();
            Vec3.scaleAndAdd(newPos, this.node.worldPosition, finalDirection, this.moveSpeed * deltaTime);
            
            console.debug(`[Enemy] moveTowardsTarget: 当前位置(${this.node.worldPosition.x.toFixed(1)}, ${this.node.worldPosition.y.toFixed(1)}), 目标位置(${this.currentTarget.worldPosition.x.toFixed(1)}, ${this.currentTarget.worldPosition.y.toFixed(1)}), 新位置(${newPos.x.toFixed(1)}, ${newPos.y.toFixed(1)})`);
            
            // 检查移动路径上是否有石墙阻挡
            const hasCollision = this.checkCollisionWithStoneWall(newPos);
            
            if (hasCollision) {
                // 检查碰撞的石墙是否是目标石墙
                const blockingWall = this.getBlockingStoneWall(newPos);
                const isTargetWall = blockingWall && blockingWall === this.currentTarget;
                
                if (isTargetWall) {
                    // 碰撞的是目标石墙，说明已经到达，停止移动
                    console.debug(`[Enemy] moveTowardsTarget: 碰撞的是目标石墙，已到达目标，停止移动`);
                    return;
                } else {
                    // 路径被其他石墙阻挡，先尝试局部绕路
                    console.debug(`[Enemy] moveTowardsTarget: 路径被其他石墙阻挡，开始尝试绕路`);
                    const detourPos = this.calculateDetourPosition(direction, deltaTime);
                    if (detourPos) {
                        // 找到绕路位置，平滑移动到该位置（避免闪现）
                        const detourDirection = new Vec3();
                        Vec3.subtract(detourDirection, detourPos, this.node.worldPosition);
                        const detourDistance = detourDirection.length();
                        
                        if (detourDistance > 0.1) {
                            detourDirection.normalize();
                            // 计算平滑移动的距离，不超过移动速度
                            const moveDist = Math.min(this.moveSpeed * deltaTime, detourDistance);
                            const smoothDetourPos = new Vec3();
                            Vec3.scaleAndAdd(smoothDetourPos, this.node.worldPosition, detourDirection, moveDist);
                            const clampedPos = this.clampPositionToScreen(smoothDetourPos);
                            this.node.setWorldPosition(clampedPos);
                            
                            // 根据移动方向翻转
                            this.flipDirection(detourDirection);
                            
                            // 播放行走动画
                            this.playWalkAnimation();
                        }
                        return;
                    } else {
                        // 局部无法绕路，检查全局路径是否被阻挡且无法绕行
                        console.debug(`[Enemy] moveTowardsTarget: 局部无法找到绕路位置，检查全局路径是否被阻挡`);
                        const blockedStoneWall = this.checkPathBlockedByStoneWall();
                        if (blockedStoneWall) {
                            // 全局路径被阻挡且无法绕行，设置石墙为目标
                            console.debug(`[Enemy] moveTowardsTarget: 全局路径被石墙阻挡且无法绕行，设置石墙为攻击目标`);
                            this.currentTarget = blockedStoneWall;
                            console.debug(`[Enemy] moveTowardsTarget: 当前目标已设置为石墙，距离: ${Vec3.distance(this.node.worldPosition, blockedStoneWall.worldPosition).toFixed(1)}`);
                            return;
                        } else {
                            // 全局路径可以绕行，继续尝试移动（可能只是局部阻挡）
                            console.debug(`[Enemy] moveTowardsTarget: 全局路径可以绕行，继续尝试移动`);
                            // 尝试一个小的偏移来绕过局部阻挡
                            const smallOffset = new Vec3(-direction.y, direction.x, 0);
                            smallOffset.normalize();
                            smallOffset.multiplyScalar(30); // 30像素的小偏移
                            const offsetPos = new Vec3();
                            Vec3.add(offsetPos, newPos, smallOffset);
                            if (!this.checkCollisionWithStoneWall(offsetPos)) {
                                const clampedPos = this.clampPositionToScreen(offsetPos);
                                this.node.setWorldPosition(clampedPos);
                                this.flipDirection(direction);
                                this.playWalkAnimation();
                                return;
                            }
                            // 如果小偏移也不行，所有绕路尝试都失败，攻击最近的石墙
                            console.debug(`[Enemy] moveTowardsTarget: 所有绕路尝试都失败，查找最近的石墙作为攻击目标`);
                            const nearestWall = this.findNearestStoneWall();
                            if (nearestWall) {
                                console.debug(`[Enemy] moveTowardsTarget: 找到最近的石墙，设置为攻击目标，距离: ${Vec3.distance(this.node.worldPosition, nearestWall.worldPosition).toFixed(1)}`);
                                this.currentTarget = nearestWall;
                                return;
                            }
                            // 找不到石墙，停止移动
                            console.debug(`[Enemy] moveTowardsTarget: 无法绕过局部阻挡且找不到石墙，停止移动`);
                            return;
                        }
                    }
                }
            } else {
                console.debug(`[Enemy] moveTowardsTarget: 目标不是石墙，未检测到碰撞`);
            }
            
            // 限制位置在屏幕范围内
            const clampedPos = this.clampPositionToScreen(newPos);
            console.debug(`[Enemy] moveTowardsTarget: 正常移动，设置位置(${clampedPos.x.toFixed(1)}, ${clampedPos.y.toFixed(1)})`);
            this.node.setWorldPosition(clampedPos);
            
            // 根据移动方向翻转
            this.flipDirection(direction);
            
            // 播放行走动画
            this.playWalkAnimation();
        }
    }

    private moveTowardsCrystal(deltaTime: number) {
        if (!this.targetCrystal || !this.targetCrystal.isValid) {
            return;
        }

        // 优先检查是否需要进入网格寻路模式
        if (!this.isInStoneWallGrid && this.checkStoneWallGridBelowEnemy()) {
            // checkStoneWallGridBelowEnemy() 已经检查了是否到达最底层，所以这里直接进入网格寻路模式
            console.debug(`[Enemy] moveTowardsCrystal: 检测到石墙网格在下方，进入网格寻路模式`);
            this.isInStoneWallGrid = true;
            const path = this.findPathInStoneWallGrid();
            if (path && path.length > 0) {
                this.gridPath = path;
                this.currentPathIndex = 0;
                this.moveInStoneWallGrid(deltaTime);
                return;
            } else {
                // 无路可走，攻击最近的石墙（最高优先级）
                this.isInStoneWallGrid = false;
                const nearestWall = this.findNearestStoneWall();
                if (nearestWall) {
                    this.currentTarget = nearestWall;
                    // 清除绕行目标点，因为A*寻路失败后的石墙攻击优先级更高
                    if (this.detourTarget) {
                        console.debug(`[Enemy] moveTowardsCrystal: A*寻路失败后的石墙目标（最高优先级），清除绕行目标点`);
                        this.detourTarget = null;
                    }
                    this.logMessage('debug', `[Enemy] moveTowardsCrystal: ❌ A*寻路失败，设置为攻击最近的石墙（最高优先级）`);
                    // 不立即return，让调用者知道需要处理石墙攻击
                    return;
                } else {
                    this.logMessage('debug', `[Enemy] moveTowardsCrystal: ❌ A*寻路失败且找不到石墙`);
                    return;
                }
            }
        }

        // 如果已经在网格寻路模式中，不需要执行后续逻辑
        if (this.isInStoneWallGrid) {
            return;
        }

        // 如果已经存在绕行点，跳过初始的路径阻塞检查，直接执行绕行逻辑
        // 只有在没有绕行点时，才检查路径是否被石墙阻挡
        if (!this.detourTarget) {
            // 在移动前检查路径是否被石墙阻挡且无法绕行
            // 如果路径被阻挡且无法绕行，立即攻击最近的石墙
            const blockedStoneWall = this.checkPathBlockedByStoneWall();
            if (blockedStoneWall) {
                // 路径被石墙阻挡且无法绕行，立即设置为攻击目标
                console.debug(`[Enemy] moveTowardsCrystal: 路径被石墙阻挡且无法绕行，设置石墙为攻击目标`);
                this.currentTarget = blockedStoneWall;
                // 清除绕行目标点
                this.detourTarget = null;
                return;
            }
            
            console.debug(`[Enemy] moveTowardsCrystal: 路径畅通，开始向水晶移动`);
        }

        // 如果有绕行目标点，优先移动到绕行目标点（不检查其他目标）
        // 但如果敌人已在最底层，清除绕行目标点，直接向水晶移动
        if (this.detourTarget) {
            const currentGrid = this.stoneWallGridPanelComponent?.worldToGrid(this.node.worldPosition);
            if (currentGrid && currentGrid.y <= 0) {
                // 已在最底层，清除绕行目标点，直接向水晶移动
                console.debug(`[Enemy] moveTowardsCrystal: 敌人已在最底层（gridY=${currentGrid.y}），清除绕行目标点，直接向水晶移动`);
                this.detourTarget = null;
                // 继续执行，进入向水晶移动的逻辑
            } else {
                const enemyWorldPos = this.node.worldPosition;
                const toDetour = new Vec3();
                Vec3.subtract(toDetour, this.detourTarget, enemyWorldPos);
                const detourDistance = toDetour.length();
                
                // 如果已经到达绕行目标点（距离小于阈值），清除绕行目标点，继续向水晶移动
                if (detourDistance < 5) {
                    console.debug(`[Enemy] moveTowardsCrystal: ✅ 已到达绕行目标点！`);
                    
                    // 清除绕行目标点和标记
                    this.detourTarget = null;
                    // 清除当前目标，确保继续向水晶移动
                    this.currentTarget = null!;
                } else {
                    // 向绕行目标点移动，减少严格的路径检查，特别是对于房间出口
                    // 房间出口是经过计算的安全路径，不需要过度检查
                    toDetour.normalize();
                    const moveDistance = this.moveSpeed * deltaTime;
                    const newPos = new Vec3();
                    Vec3.scaleAndAdd(newPos, enemyWorldPos, toDetour, moveDistance);
                    
                    // 只检查最终位置是否有严重碰撞，允许轻微擦碰
                    // 使用更宽松的碰撞检测阈值
                    const clampedPos = this.clampPositionToScreen(newPos);
                    this.node.setWorldPosition(clampedPos);
                    this.flipDirection(toDetour);
                    this.playWalkAnimation();
                    // 移除频繁调用的日志以减少日志 spam
                    // console.debug(`[Enemy] moveTowardsCrystal: 向绕行目标点移动，距离: ${detourDistance.toFixed(1)}像素`);
                    return;
                }
            }
        }

        // 如果还有绕行目标点（说明还没到达），直接返回，不要执行后续的水晶移动逻辑
        if (this.detourTarget) {
            console.debug(`[Enemy] moveTowardsCrystal: 还有绕行目标点，继续向绕行点移动`);
            return;
        }
        
        console.debug(`[Enemy] moveTowardsCrystal: 无绕行目标，准备向水晶移动`);

        // 只有在没有绕行目标点时，才检查路径上的目标
        this.checkForTargetsOnPath();

        // 如果检测到目标（包括石墙），停止朝水晶移动，让update()方法处理目标
        if (this.currentTarget) {
            console.debug(`[Enemy] moveTowardsCrystal: 检测到当前目标，停止向水晶移动`);
            return;
        }
        
        // 检查checkForTargetsOnPath是否设置了detourTarget
        if (this.detourTarget) {
            console.debug(`[Enemy] moveTowardsCrystal: checkForTargetsOnPath设置了新的绕行目标，下一帧将向绕行目标移动`);
            return;
        }
        
        this.logMessage('debug', `moveTowardsCrystal: 无当前目标和绕行目标，开始向水晶移动`);

        // 如果正在播放攻击动画，停止攻击动画并切换到移动动画
        if (this.isPlayingAttackAnimation) {
            this.logMessage('debug', `moveTowardsCrystal: 检测到正在播放攻击动画，停止攻击动画并切换到移动动画`);
            this.isPlayingAttackAnimation = false;
            this.attackComplete = false;
            this.stopAllAnimations();
        }

        const crystalWorldPos = this.targetCrystal.worldPosition;
        const enemyWorldPos = this.node.worldPosition;
        
        const direction = new Vec3();
        Vec3.subtract(direction, crystalWorldPos, enemyWorldPos);
        const distance = direction.length();
        
        if (distance > 0.1) {
            direction.normalize();
            
            // 应用敌人避让逻辑
            const finalDirection = this.calculateEnemyAvoidanceDirection(enemyWorldPos, direction, deltaTime);
            
            const moveDistance = this.moveSpeed * deltaTime;
            const newPos = new Vec3();
            Vec3.scaleAndAdd(newPos, enemyWorldPos, finalDirection, moveDistance);
            
            // 检查移动路径上是否有石墙阻挡
            const hasCollision = this.checkCollisionWithStoneWall(newPos);
            console.debug(`[Enemy] moveTowardsCrystal: 当前位置(${this.node.worldPosition.x.toFixed(1)}, ${this.node.worldPosition.y.toFixed(1)}), 水晶位置(${crystalWorldPos.x.toFixed(1)}, ${crystalWorldPos.y.toFixed(1)}), 新位置(${newPos.x.toFixed(1)}, ${newPos.y.toFixed(1)}), 碰撞检测: ${hasCollision}`);
            if (hasCollision) {
                // 路径被石墙阻挡，尝试绕路
                console.debug(`[Enemy] moveTowardsCrystal: 检测到石墙阻挡，开始尝试绕路`);
                const detourPos = this.calculateDetourPosition(direction, deltaTime);
                if (detourPos) {
                    // 找到绕路位置，平滑移动到该位置（避免闪现）
                    const detourDirection = new Vec3();
                    Vec3.subtract(detourDirection, detourPos, this.node.worldPosition);
                    const detourDistance = detourDirection.length();
                    
                    if (detourDistance > 0.1) {
                        detourDirection.normalize();
                        // 计算平滑移动的距离，不超过移动速度
                        const moveDist = Math.min(this.moveSpeed * deltaTime, detourDistance);
                        const smoothDetourPos = new Vec3();
                        Vec3.scaleAndAdd(smoothDetourPos, this.node.worldPosition, detourDirection, moveDist);
                        const clampedPos = this.clampPositionToScreen(smoothDetourPos);
                        this.node.setWorldPosition(clampedPos);
                        
                        // 根据移动方向翻转
                        this.flipDirection(detourDirection);
                        
                        // 播放行走动画
                        this.playWalkAnimation();
                    }
                    return;
                } else {
                    // 局部无法绕路，检查全局路径是否被阻挡且无法绕行
                    console.debug(`[Enemy] moveTowardsCrystal: 局部无法找到绕路位置，检查全局路径是否被阻挡`);
                    const blockedStoneWall = this.checkPathBlockedByStoneWall();
                    if (blockedStoneWall) {
                        // 全局路径被阻挡且无法绕行，设置石墙为目标
                        console.debug(`[Enemy] moveTowardsCrystal: 全局路径被石墙阻挡且无法绕行，设置石墙为攻击目标`);
                        this.currentTarget = blockedStoneWall;
                        return;
                    } else {
                        // 全局路径可以绕行，继续尝试移动（可能只是局部阻挡）
                        console.debug(`[Enemy] moveTowardsCrystal: 全局路径可以绕行，继续尝试移动`);
                        // 尝试一个小的偏移来绕过局部阻挡
                        const smallOffset = new Vec3(-direction.y, direction.x, 0);
                        smallOffset.normalize();
                        smallOffset.multiplyScalar(30); // 30像素的小偏移
                        const offsetPos = new Vec3();
                        Vec3.add(offsetPos, newPos, smallOffset);
                        if (!this.checkCollisionWithStoneWall(offsetPos)) {
                            const clampedPos = this.clampPositionToScreen(offsetPos);
                            this.node.setWorldPosition(clampedPos);
                            this.flipDirection(direction);
                            this.playWalkAnimation();
                            return;
                        }
                        // 如果小偏移也不行，所有绕路尝试都失败，攻击最近的石墙
                        console.debug(`[Enemy] moveTowardsCrystal: 所有绕路尝试都失败，查找最近的石墙作为攻击目标`);
                        const nearestWall = this.findNearestStoneWall();
                        if (nearestWall) {
                            console.debug(`[Enemy] moveTowardsCrystal: 找到最近的石墙，设置为攻击目标，距离: ${Vec3.distance(this.node.worldPosition, nearestWall.worldPosition).toFixed(1)}`);
                            this.currentTarget = nearestWall;
                            return;
                        }
                        // 找不到石墙，停止移动
                        console.debug(`[Enemy] moveTowardsCrystal: 无法绕过局部阻挡且找不到石墙，停止移动`);
                        return;
                    }
                }
            }
            
            // 限制位置在屏幕范围内
            const clampedPos = this.clampPositionToScreen(newPos);
            this.node.setWorldPosition(clampedPos);
            
            // 根据移动方向翻转
            this.flipDirection(direction);
            
            // 播放行走动画
            this.playWalkAnimation();
        }
    }

    /**
     * 计算绕路位置（平滑移动，避免弹开效果）
     * @param direction 原始移动方向
     * @param deltaTime 时间间隔
     * @returns 如果找到可行的绕路位置返回该位置，否则返回null
     */
    private calculateDetourPosition(direction: Vec3, deltaTime: number): Vec3 | null {
        // 如果已经有全局绕行目标点，就不执行局部绕路逻辑
        if (this.detourTarget) {
            console.debug(`[Enemy] calculateDetourPosition: 已有全局绕行目标点，跳过局部绕路计算`);
            return null;
        }
        
        const moveDistance = this.moveSpeed * deltaTime;
        const perpendicular = new Vec3(-direction.y, direction.x, 0); // 垂直于移动方向的方向
        
        // 使用较小的偏移距离，让移动更平滑
        const offsetDistances = [30, 50, 80]; // 逐步增加偏移距离
        
        console.debug(`[Enemy] calculateDetourPosition: 当前位置(${this.node.worldPosition.x.toFixed(1)}, ${this.node.worldPosition.y.toFixed(1)}), 移动方向(${direction.x.toFixed(2)}, ${direction.y.toFixed(2)}), 移动距离: ${moveDistance.toFixed(1)}`);
        
        // 尝试不同偏移距离的绕路
        for (const offsetDistance of offsetDistances) {
            // 尝试右侧绕路（优先右侧绕路，符合用户需求）
            const rightOffset = new Vec3();
            Vec3.scaleAndAdd(rightOffset, this.node.worldPosition, perpendicular, -offsetDistance);
            const rightPos = new Vec3();
            Vec3.scaleAndAdd(rightPos, rightOffset, direction, moveDistance);
            const rightCollision = this.checkCollisionWithStoneWall(rightPos);
            console.debug(`[Enemy] calculateDetourPosition: 尝试右侧绕路(偏移${offsetDistance}), 位置(${rightPos.x.toFixed(1)}, ${rightPos.y.toFixed(1)}), 碰撞: ${rightCollision}`);
            if (!rightCollision) {
                console.debug(`[Enemy] calculateDetourPosition: 右侧绕路成功`);
                return rightPos;
            }
            
            // 尝试左侧绕路
            const leftOffset = new Vec3();
            Vec3.scaleAndAdd(leftOffset, this.node.worldPosition, perpendicular, offsetDistance);
            const leftPos = new Vec3();
            Vec3.scaleAndAdd(leftPos, leftOffset, direction, moveDistance);
            const leftCollision = this.checkCollisionWithStoneWall(leftPos);
            console.debug(`[Enemy] calculateDetourPosition: 尝试左侧绕路(偏移${offsetDistance}), 位置(${leftPos.x.toFixed(1)}, ${leftPos.y.toFixed(1)}), 碰撞: ${leftCollision}`);
            if (!leftCollision) {
                console.debug(`[Enemy] calculateDetourPosition: 左侧绕路成功`);
                return leftPos;
            }
        }
        
        // 无法找到可行的绕路位置
        console.debug(`[Enemy] calculateDetourPosition: 所有绕路尝试都失败`);
        return null;
    }

    /**
     * 查找最近的石墙
     * @returns 最近的石墙节点，如果没有找到返回null
     */
    private findNearestStoneWall(): Node | null {
        // 递归查找所有带有StoneWall组件的节点
        const findAllStoneWalls = (node: Node): Node[] => {
            const walls: Node[] = [];
            
            // 检查当前节点是否有StoneWall组件
            const wallScript = node.getComponent('StoneWall') as any;
            if (wallScript && node.active && node.isValid) {
                walls.push(node);
            }
            
            // 递归检查子节点
            for (const child of node.children) {
                walls.push(...findAllStoneWalls(child));
            }
            
            return walls;
        };

        // 从场景根节点开始查找所有石墙
        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        const allStoneWalls = findAllStoneWalls(scene);
        let nearestWall: Node | null = null;
        let minDistance = Infinity;

        for (const wall of allStoneWalls) {
            if (!wall || !wall.active || !wall.isValid) continue;
            
            const wallScript = wall.getComponent('StoneWall') as any;
            if (!wallScript || !wallScript.isAlive || !wallScript.isAlive()) continue;

            const wallPos = wall.worldPosition;
            const distance = Vec3.distance(this.node.worldPosition, wallPos);

            if (distance < minDistance) {
                minDistance = distance;
                nearestWall = wall;
            }
        }

        return nearestWall;
    }

    /**
     * 检查指定位置是否有石墙节点
     * @param position 要检查的世界坐标位置
     * @returns 如果该位置有石墙节点返回true，否则返回false
     */
    private checkStoneWallAtPosition(position: Vec3): boolean {
        // 递归查找所有带有StoneWall组件的节点
        const findAllStoneWalls = (node: Node): Node[] => {
            const walls: Node[] = [];
            
            // 检查当前节点是否有StoneWall组件
            const wallScript = node.getComponent('StoneWall') as any;
            if (wallScript && node.active && node.isValid) {
                walls.push(node);
            }
            
            // 递归检查子节点
            for (const child of node.children) {
                walls.push(...findAllStoneWalls(child));
            }
            
            return walls;
        };

        // 从场景根节点开始查找所有石墙
        const scene = this.node.scene;
        if (!scene) {
            return false;
        }

        const allStoneWalls = findAllStoneWalls(scene);
        const checkRadius = 25; // 检查半径，约半个格子大小（50/2）

        for (const wall of allStoneWalls) {
            if (!wall || !wall.active || !wall.isValid) continue;
            
            const wallScript = wall.getComponent('StoneWall') as any;
            // 检查石墙是否被摧毁（如果有isDestroyed属性）
            if (wallScript && wallScript.isDestroyed === true) continue;

            const wallPos = wall.worldPosition;
            const distance = Vec3.distance(position, wallPos);

            // 如果距离小于检查半径，说明该位置有石墙
            if (distance < checkRadius) {
                console.debug(`[Enemy] checkStoneWallAtPosition: 位置(${position.x.toFixed(1)}, ${position.y.toFixed(1)}) 检测到石墙，距离=${distance.toFixed(1)}`);
                return true;
            }
        }

        return false;
    }

    /**
     * 获取阻挡位置的石墙节点
     * @param position 要检查的位置
     * @returns 如果与石墙碰撞返回石墙节点，否则返回null
     */
    getBlockingStoneWall(position: Vec3): Node | null {
        // 递归查找所有带有StoneWall组件的节点
        const findAllStoneWalls = (node: Node): Node[] => {
            const walls: Node[] = [];
            
            // 检查当前节点是否有StoneWall组件
            const wallScript = node.getComponent('StoneWall') as any;
            if (wallScript && node.active && node.isValid) {
                walls.push(node);
            }
            
            // 递归检查子节点
            for (const child of node.children) {
                walls.push(...findAllStoneWalls(child));
            }
            
            return walls;
        };

        // 从场景根节点开始查找所有石墙
        const scene = this.node.scene;
        if (!scene) {
            console.debug(`[Enemy] getBlockingStoneWall: 场景不存在`);
            return null;
        }

        const allStoneWalls = findAllStoneWalls(scene);
        console.debug(`[Enemy] getBlockingStoneWall: 找到${allStoneWalls.length}个石墙节点`);

        const enemyRadius = 20; // 敌人的碰撞半径

        for (const wall of allStoneWalls) {
            if (!wall || !wall.active || !wall.isValid) continue;
            
            const wallScript = wall.getComponent('StoneWall') as any;
            if (!wallScript || !wallScript.isAlive || !wallScript.isAlive()) continue;

            const wallPos = wall.worldPosition;
            const wallRadius = wallScript.collisionRadius || 40;
            const distanceToWall = Vec3.distance(position, wallPos);
            const minDistance = enemyRadius + wallRadius;

            console.debug(`[Enemy] getBlockingStoneWall: 检查石墙(${wallPos.x.toFixed(1)}, ${wallPos.y.toFixed(1)}), 距离: ${distanceToWall.toFixed(1)}, 最小距离: ${minDistance.toFixed(1)}`);

            // 如果距离小于最小距离，说明碰撞
            if (distanceToWall < minDistance) {
                console.debug(`[Enemy] getBlockingStoneWall: 检测到碰撞，返回石墙节点`);
                return wall;
            }
        }

        return null;
    }

    private checkCollisionWithStoneWall(position: Vec3): boolean {
        const blockingWall = this.getBlockingStoneWall(position);
        if (blockingWall) {
            const wallPos = blockingWall.worldPosition;
            console.debug(`[Enemy] checkCollisionWithStoneWall: 检测到碰撞！位置(${position.x.toFixed(1)}, ${position.y.toFixed(1)})与石墙(${wallPos.x.toFixed(1)}, ${wallPos.y.toFixed(1)})碰撞`);
            return true;
        }
        console.debug(`[Enemy] checkCollisionWithStoneWall: 位置(${position.x.toFixed(1)}, ${position.y.toFixed(1)})未检测到碰撞`);
        return false;
    }

    /**
     * 限制位置在屏幕范围内
     * @param position 要检查的位置
     * @returns 限制在屏幕范围内的位置
     */
    clampPositionToScreen(position: Vec3): Vec3 {
        // 使用cc.view获取屏幕尺寸和设计分辨率
        const designResolution = view.getDesignResolutionSize();
        
        // 使用默认碰撞半径（敌人单位通常较小）
        const collisionRadius = 20;
        
        // 计算屏幕边界，确保单位在可见屏幕内移动
        const minX = collisionRadius;
        const maxX = designResolution.width - collisionRadius;
        const minY = collisionRadius;
        const maxY = designResolution.height - collisionRadius;
        
        // 限制位置在屏幕范围内
        const clampedPos = new Vec3(position);
        clampedPos.x = Math.max(minX, Math.min(maxX, clampedPos.x));
        clampedPos.y = Math.max(minY, Math.min(maxY, clampedPos.y));
        
        return clampedPos;
    }

    // 根据移动方向翻转敌人
    flipDirection(direction: Vec3) {
        if (direction.x < 0) {
            // 向左移动，翻转
            this.node.setScale(-Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
            // 血条反向翻转，保持正常朝向
            if (this.healthBarNode && this.healthBarNode.isValid) {
                this.healthBarNode.setScale(-1, 1, 1);
            }
        } else {
            // 向右移动，正常朝向
            this.node.setScale(Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
            // 血条正常朝向
            if (this.healthBarNode && this.healthBarNode.isValid) {
                this.healthBarNode.setScale(1, 1, 1);
            }
        }
    }

    /**
     * 检查路径是否被石墙阻挡
     * @returns 如果路径被阻挡且无法绕开，返回最近的石墙节点；否则返回null
     */
    private checkPathBlockedByStoneWall(): Node | null {
        // 如果敌人已在最底层，直接返回null，不执行绕行逻辑，直接向水晶移动
        const currentGrid = this.stoneWallGridPanelComponent?.worldToGrid(this.node.worldPosition);
        if (currentGrid && currentGrid.y <= 0) {
            console.debug(`[Enemy] checkPathBlockedByStoneWall: 敌人已在最底层（gridY=${currentGrid.y}），跳过绕行逻辑，直接向水晶移动`);
            // 清除可能存在的绕行目标点
            if (this.detourTarget) {
                this.detourTarget = null;
            }
            return null;
        }

        if (!this.targetCrystal || !this.targetCrystal.isValid) {
            return null;
        }

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

        // 查找所有石墙 - 改进的查找方式：同时查找容器中的和场景中直接放置的石墙
        let stoneWalls: Node[] = [];
        
        // 方法1: 从StoneWalls容器节点获取
        let stoneWallsNode = find('StoneWalls');
        if (!stoneWallsNode && this.node.scene) {
            stoneWallsNode = findNodeRecursive(this.node.scene, 'StoneWalls');
        }
        
        if (stoneWallsNode) {
            const containerWalls = stoneWallsNode.children || [];
            stoneWalls.push(...containerWalls);
            console.debug(`[Enemy] checkPathBlockedByStoneWall: 从StoneWalls容器找到 ${containerWalls.length} 个石墙节点`);
        }
        
        // 方法2: 始终递归查找场景中所有带有StoneWall组件的节点（包括提前放置的石墙）
        if (this.node.scene) {
            const findAllStoneWalls = (node: Node): Node[] => {
                const walls: Node[] = [];
                const wallScript = node.getComponent('StoneWall') as any;
                if (wallScript && node.active && node.isValid) {
                    walls.push(node);
                }
                for (const child of node.children) {
                    walls.push(...findAllStoneWalls(child));
                }
                return walls;
            };
            const sceneWalls = findAllStoneWalls(this.node.scene);
            console.debug(`[Enemy] checkPathBlockedByStoneWall: 递归查找场景找到 ${sceneWalls.length} 个石墙节点`);
            
            // 合并容器中的石墙和场景中的石墙，去重
            const allWallsMap = new Map<Node, boolean>();
            for (const wall of stoneWalls) {
                allWallsMap.set(wall, true);
            }
            for (const wall of sceneWalls) {
                if (!allWallsMap.has(wall)) {
                    stoneWalls.push(wall);
                    allWallsMap.set(wall, true);
                }
            }
        }
        
        // 过滤出有效的石墙（有StoneWall组件且存活）
        stoneWalls = stoneWalls.filter(wall => {
            if (!wall || !wall.active || !wall.isValid) return false;
            const wallScript = wall.getComponent('StoneWall') as any;
            return wallScript && wallScript.isAlive && wallScript.isAlive();
        });
        
        console.debug(`[Enemy] checkPathBlockedByStoneWall: 最终有效的石墙数量: ${stoneWalls.length}`);
        
        if (stoneWalls.length === 0) {
            return null; // 没有石墙
        }

        const enemyPos = this.node.worldPosition;
        const crystalPos = this.targetCrystal.worldPosition;
        const direction = new Vec3();
        Vec3.subtract(direction, crystalPos, enemyPos);
        const distanceToCrystal = direction.length();
        
        if (distanceToCrystal < 0.1) {
            return null; // 已经到达水晶
        }

        direction.normalize();
        
        // 计算垂直于路径的方向（用于检测路径附近的石墙）
        const perpendicular = new Vec3(-direction.y, direction.x, 0);
        perpendicular.normalize();
        
        // 检测路径上的石墙（分段检测）
        // 扩大检测范围，不仅检测路径上的石墙，还检测路径附近的石墙
        const checkSteps = Math.ceil(distanceToCrystal / 50); // 每50像素检测一次
        const stepSize = distanceToCrystal / checkSteps;
        const blockingWalls: { wall: Node; distance: number }[] = [];
        const enemyRadius = 20; // 敌人的碰撞半径
        const detectionWidth = 100; // 路径两侧的检测宽度（像素）

        // 检测路径上的石墙
        for (let i = 0; i <= checkSteps; i++) {
            const checkPos = new Vec3();
            Vec3.scaleAndAdd(checkPos, enemyPos, direction, stepSize * i);

            // 检查这个位置是否有石墙
            for (const wall of stoneWalls) {
                if (!wall || !wall.active || !wall.isValid) continue;
                
                const wallScript = wall.getComponent('StoneWall') as any;
                if (!wallScript || !wallScript.isAlive || !wallScript.isAlive()) continue;

                const wallPos = wall.worldPosition;
                const wallRadius = wallScript.collisionRadius || 40;
                const distanceToWall = Vec3.distance(checkPos, wallPos);

                // 如果检测点距离石墙太近，说明路径被阻挡
                if (distanceToWall < wallRadius + enemyRadius + 10) { // 加上敌人半径和缓冲距离
                    const distanceFromEnemy = Vec3.distance(enemyPos, wallPos);
                    // 避免重复添加同一个石墙
                    const existingWall = blockingWalls.find(bw => bw.wall === wall);
                    if (!existingWall) {
                        blockingWalls.push({ wall, distance: distanceFromEnemy });
                    }
                }
            }
        }

        // 额外检测：检查路径附近（左右两侧）的石墙，确保能检测到所有可能阻挡的石墙
        for (const wall of stoneWalls) {
            if (!wall || !wall.active || !wall.isValid) continue;
            
            const wallScript = wall.getComponent('StoneWall') as any;
            if (!wallScript || !wallScript.isAlive || !wallScript.isAlive()) continue;

            // 如果已经在blockingWalls中，跳过
            if (blockingWalls.find(bw => bw.wall === wall)) {
                continue;
            }

            const wallPos = wall.worldPosition;
            const wallRadius = wallScript.collisionRadius || 40;
            
            // 计算石墙到路径的距离（垂直距离）
            const toWall = new Vec3();
            Vec3.subtract(toWall, wallPos, enemyPos);
            const projectionOnPath = Vec3.dot(toWall, direction);
            
            // 如果石墙在路径范围内（在敌人和水晶之间）
            if (projectionOnPath > 0 && projectionOnPath < distanceToCrystal) {
                const pathPoint = new Vec3();
                Vec3.scaleAndAdd(pathPoint, enemyPos, direction, projectionOnPath);
                const perpendicularDistance = Vec3.distance(wallPos, pathPoint);
                
                // 如果石墙距离路径太近（在检测宽度内），也视为阻挡
                if (perpendicularDistance < wallRadius + enemyRadius + detectionWidth) {
                    const distanceFromEnemy = Vec3.distance(enemyPos, wallPos);
                    blockingWalls.push({ wall, distance: distanceFromEnemy });
                }
            }
        }

        if (blockingWalls.length === 0) {
            return null; // 没有阻挡的石墙
        }

        // 找到最近的石墙
        blockingWalls.sort((a, b) => a.distance - b.distance);
        const nearestWall = blockingWalls[0].wall;

        // 将连接在一起的石墙分组（视为整体障碍物）
        const wallGroups = this.groupConnectedWalls(blockingWalls.map(bw => bw.wall), stoneWalls);
        const groupInfo = wallGroups.map((group, idx) => `组${idx + 1}:${group.length}个石墙`).join(', ');
        console.debug(`[Enemy] checkPathBlockedByStoneWall: 检测到${blockingWalls.length}个阻挡石墙，分为${wallGroups.length}个连接组 [${groupInfo}]`);

        // 改进的绕行检测：尝试多个角度和距离的组合
        // perpendicular已经在上面计算过了，直接使用
        
        // 增加更多偏移距离，确保能够检测到所有可能的绕行路径（包括更大的距离）
        const offsetDistances = [50, 70, 90, 110, 130, 150, 180, 220, 260, 300, 400, 500, 600, 750]; 
        // 尝试更多角度，包括左右两侧的所有可能方向
        const angles = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, -10, -20, -30, -40, -50, -60, -70, -80, -90]; 
        let canDetour = false;

        // 获取游戏边界
        const designResolution = view.getDesignResolutionSize();
        const gameBounds = {
            minX: 0,
            maxX: designResolution.width,
            minY: 0,
            maxY: designResolution.height
        };

        // 计算石墙组与游戏边界形成的房间出口
        console.debug(`[Enemy] checkPathBlockedByStoneWall: 开始查找房间出口`);
        const roomExits = this.findRoomExits(enemyPos, crystalPos, wallGroups, gameBounds, perpendicular);
        
        // 如果找到房间出口，优先使用出口作为绕行点
        if (roomExits.length > 0) {
            // 选择最适合的出口作为绕行点
            const bestExit = this.selectBestExit(roomExits, enemyPos, crystalPos);
            if (bestExit) {
                // 检查是否已经设置了相同的绕行目标
                if (this.detourTarget) {
                    const distance = Vec3.distance(this.detourTarget, bestExit);
                    if (distance < 10) {
                        console.debug(`[Enemy] checkPathBlockedByStoneWall: 已经设置了相同的绕行目标(距离: ${distance.toFixed(1)}), 无需重复设置`);
                        canDetour = true;
                        return null;
                    }
                }
                
                console.debug(`[Enemy] checkPathBlockedByStoneWall: ✓ 找到房间出口作为绕行点！出口位置: (${bestExit.x.toFixed(1)}, ${bestExit.y.toFixed(1)})`);
                this.detourTarget = bestExit;
                canDetour = true;
                console.debug(`[Enemy] checkPathBlockedByStoneWall: 设置绕行目标，敌人将向出口移动`);
            }
        }
        
        // 如果没有找到房间出口，使用传统的绕行距离计算方法
        if (!canDetour) {
            // 优先检测左右两侧（最常见的绕行方向），使用计算出的最小绕行距离
            // 计算需要绕过整个障碍物组的最小距离
            const minDetourDistance = this.calculateMinDetourDistance(enemyPos, crystalPos, wallGroups, perpendicular);
            console.debug(`[Enemy] checkPathBlockedByStoneWall: 开始检测绕行路径，最小绕行距离: ${minDetourDistance.toFixed(1)}像素`);
            
            // 直接使用计算出的最小绕行距离，加上一些安全余量
            const optimalDetourDistance = Math.max(100, Math.ceil(minDetourDistance / 50) * 50 + 50); // 向上取整到50的倍数，再加50作为安全余量
            
            // 计算左侧和右侧的绕行坐标
            const leftOffset = new Vec3();
            Vec3.scaleAndAdd(leftOffset, enemyPos, perpendicular, optimalDetourDistance);
            const rightOffset = new Vec3();
            Vec3.scaleAndAdd(rightOffset, enemyPos, perpendicular, -optimalDetourDistance);
            
            // 先限制绕行点在地图范围内，然后再检测路径
            const clampedLeftOffset = this.clampPositionToScreen(leftOffset);
            const clampedRightOffset = this.clampPositionToScreen(rightOffset);
            
            // 检查左右两侧哪个可以绕行，优先选择更合理的绕行方向
            // 计算障碍物组中心相对于路径的位置
            let obstacleSide = 0; // 0=中间, 1=右侧, -1=左侧
            if (wallGroups.length > 0 && wallGroups[0].length > 0) {
                const firstWall = wallGroups[0][0];
                const wallPos = firstWall.worldPosition;
                const toWall = new Vec3();
                Vec3.subtract(toWall, wallPos, enemyPos);
                const wallProjection = Vec3.dot(toWall, perpendicular);
                obstacleSide = wallProjection > 0 ? 1 : -1; // 正方向为右侧，负方向为左侧
            }
            
            // 优先选择与障碍物相反的一侧绕行（更合理）
            const leftCanDetour = this.checkPathClearAroundObstacles(clampedLeftOffset, crystalPos, wallGroups, stoneWalls);
            const rightCanDetour = this.checkPathClearAroundObstacles(clampedRightOffset, crystalPos, wallGroups, stoneWalls);
            
            // 优先选择与障碍物相反的一侧，如果两侧都可以绕行
            if (leftCanDetour && rightCanDetour) {
                // 如果障碍物在右侧，优先选择右侧绕行；如果障碍物在左侧，优先选择左侧绕行
                if (obstacleSide > 0) {
                    // 障碍物在右侧，优先选择右侧绕行
                    console.debug(`[Enemy] checkPathBlockedByStoneWall: ✓ 找到右侧绕行路径！偏移距离: ${optimalDetourDistance}像素`);
                    this.detourTarget = clampedRightOffset.clone();
                    canDetour = true;
                } else {
                    // 障碍物在左侧或中间，优先选择左侧绕行
                    console.debug(`[Enemy] checkPathBlockedByStoneWall: ✓ 找到左侧绕行路径！偏移距离: ${optimalDetourDistance}像素`);
                    this.detourTarget = clampedLeftOffset.clone();
                    canDetour = true;
                }
            } else if (leftCanDetour) {
                console.debug(`[Enemy] checkPathBlockedByStoneWall: ✓ 找到左侧绕行路径！偏移距离: ${optimalDetourDistance}像素`);
                this.detourTarget = clampedLeftOffset.clone();
                canDetour = true;
            } else if (rightCanDetour) {
                console.debug(`[Enemy] checkPathBlockedByStoneWall: ✓ 找到右侧绕行路径！偏移距离: ${optimalDetourDistance}像素`);
                this.detourTarget = clampedRightOffset.clone();
                canDetour = true;
            } else {
                // 使用最优距离无法绕行，尝试更大的距离
                const fallbackDistances = [optimalDetourDistance + 50, optimalDetourDistance + 100, optimalDetourDistance + 150, optimalDetourDistance + 200, optimalDetourDistance + 300, optimalDetourDistance + 400, optimalDetourDistance + 500];
                for (const offsetDistance of fallbackDistances) {
                    // 检测左侧绕行（正方向）
                    const leftOffsetFallback = new Vec3();
                    Vec3.scaleAndAdd(leftOffsetFallback, enemyPos, perpendicular, offsetDistance);
                    if (this.checkPathClearAroundObstacles(leftOffsetFallback, crystalPos, wallGroups, stoneWalls)) {
                        console.debug(`[Enemy] checkPathBlockedByStoneWall: ✓ 找到左侧绕行路径（备用距离）！偏移距离: ${offsetDistance}像素`);
                        const clampedLeftOffsetFallback = this.clampPositionToScreen(leftOffsetFallback);
                        this.detourTarget = clampedLeftOffsetFallback.clone();
                        canDetour = true;
                        break;
                    }
                    
                    // 检测右侧绕行（负方向）
                    const rightOffsetFallback = new Vec3();
                    Vec3.scaleAndAdd(rightOffsetFallback, enemyPos, perpendicular, -offsetDistance);
                    if (this.checkPathClearAroundObstacles(rightOffsetFallback, crystalPos, wallGroups, stoneWalls)) {
                        console.debug(`[Enemy] checkPathBlockedByStoneWall: ✓ 找到右侧绕行路径（备用距离）！偏移距离: ${offsetDistance}像素`);
                        const clampedRightOffsetFallback = this.clampPositionToScreen(rightOffsetFallback);
                        this.detourTarget = clampedRightOffsetFallback.clone();
                        canDetour = true;
                        break;
                    }
                }
            }
        }

        // 如果左右两侧都无法绕行，尝试其他角度
        if (!canDetour) {
            for (const offsetDistance of offsetDistances) {
                for (const angleDeg of angles) {
                    // 跳过已经检测过的左右方向（0度和180度）
                    if (angleDeg === 0 || Math.abs(angleDeg) === 90) {
                        continue;
                    }
                    
                    // 计算旋转后的偏移方向
                    const angleRad = angleDeg * Math.PI / 180;
                    const cosAngle = Math.cos(angleRad);
                    const sinAngle = Math.sin(angleRad);
                    
                    // 旋转垂直方向向量
                    const rotatedPerp = new Vec3(
                        perpendicular.x * cosAngle - perpendicular.y * sinAngle,
                        perpendicular.x * sinAngle + perpendicular.y * cosAngle,
                        0
                    );
                    rotatedPerp.normalize();
                    
                    // 计算偏移位置
                    const offsetPos = new Vec3();
                    Vec3.scaleAndAdd(offsetPos, enemyPos, rotatedPerp, offsetDistance);
                    
                    // 检查从偏移位置到水晶的路径是否畅通（绕过障碍物组）
                    if (this.checkPathClearAroundObstacles(offsetPos, crystalPos, wallGroups, stoneWalls)) {
                        console.debug(`[Enemy] checkPathBlockedByStoneWall: ✓ 找到绕行路径！偏移距离: ${offsetDistance}像素, 角度: ${angleDeg}度`);
                        // 保存绕行目标点，限制在地图范围内
                        const clampedOffsetPos = this.clampPositionToScreen(offsetPos);
                        this.detourTarget = clampedOffsetPos.clone();
                        canDetour = true;
                        break;
                    }
                }
                
                if (canDetour) {
                    break;
                }
            }
        }

        // 如果所有方向都无法绕行，返回最近的石墙
        if (!canDetour) {
            console.debug(`[Enemy] checkPathBlockedByStoneWall: ✗ 所有绕行尝试都失败，路径被石墙完全阻挡，需要攻击石墙`);
            // 清除绕行目标点
            this.detourTarget = null;
            return nearestWall;
        }

        // 可以绕行，返回null（绕行目标点已保存在this.detourTarget中）
        console.debug(`[Enemy] checkPathBlockedByStoneWall: ✓ 找到可绕行路径，绕行目标点: (${this.detourTarget!.x.toFixed(1)}, ${this.detourTarget!.y.toFixed(1)})`);
        return null;
    }

    /**
     * 将连接在一起的石墙分组（视为整体障碍物）
     * 如果两个石墙之间的间距小于敌人碰撞体积，则视为连接在一起
     */
    private groupConnectedWalls(blockingWalls: Node[], allWalls: Node[]): Node[][] {
        // 简化连接逻辑，只考虑物理接触
        const enemyRadius = 20; // 敌人的碰撞半径
        const groups: Node[][] = [];
        const processed = new Set<Node>();

        console.debug(`[Enemy] groupConnectedWalls: 开始分组，blockingWalls数量: ${blockingWalls.length}, allWalls数量: ${allWalls.length}`);

        for (const wall of blockingWalls) {
            if (processed.has(wall)) {
                continue;
            }

            // 创建一个新组
            const group: Node[] = [wall];
            processed.add(wall);

            // 使用广度优先搜索找到所有连接的石墙
            const queue: Node[] = [wall];
            let totalChecked = 0;
            let connectionsFound = 0;
            
            while (queue.length > 0) {
                const currentWall = queue.shift()!;
                const currentScript = currentWall.getComponent('StoneWall') as any;
                if (!currentScript) continue;
                const currentRadius = currentScript.collisionRadius || 40;
                const currentPos = currentWall.worldPosition;

                // 只检查阻挡路径的石墙，避免将不相关的石墙分组
                for (const otherWall of blockingWalls) {
                    if (processed.has(otherWall) || otherWall === currentWall) {
                        continue;
                    }

                    const otherScript = otherWall.getComponent('StoneWall') as any;
                    if (!otherScript || !otherScript.isAlive || !otherScript.isAlive()) {
                        continue;
                    }

                    const otherRadius = otherScript.collisionRadius || 40;
                    const otherPos = otherWall.worldPosition;
                    const distance = Vec3.distance(currentPos, otherPos);
                    
                    // 严格的连接条件：只有当石墙几乎物理接触时才视为连接
                    // 石墙半径为40，所以两个石墙中心距离小于85像素才视为连接
                    const connectionThreshold = (currentRadius + otherRadius) + 5; // 5像素的容差

                    totalChecked++;
                    
                    // 如果间距小于连接阈值，视为连接
                    if (distance < connectionThreshold) {
                        connectionsFound++;
                        console.debug(`[Enemy] groupConnectedWalls: 发现连接石墙！距离: ${distance.toFixed(1)}, 阈值: ${connectionThreshold.toFixed(1)}, 当前组大小: ${group.length + 1}, 当前石墙位置: (${currentPos.x.toFixed(1)}, ${currentPos.y.toFixed(1)}), 连接石墙位置: (${otherPos.x.toFixed(1)}, ${otherPos.y.toFixed(1)})`);
                        group.push(otherWall);
                        processed.add(otherWall);
                        queue.push(otherWall);
                    }
                }
            }

            console.debug(`[Enemy] groupConnectedWalls: 完成一组，组大小: ${group.length}, 检查了 ${totalChecked} 个石墙，找到 ${connectionsFound} 个连接`);
            groups.push(group);
        }

        const totalWallsInGroups = groups.reduce((sum, g) => sum + g.length, 0);
        console.debug(`[Enemy] groupConnectedWalls: 分组完成，共 ${groups.length} 个组，总石墙数: ${totalWallsInGroups}`);
        
        // 移除误导性警告，因为我们只对阻挡路径的石墙进行分组
        // 分组数量少于allWalls是正常的，因为不是所有石墙都阻挡路径
        
        return groups;
    }

    /**
     * 计算绕过障碍物组所需的最小距离
     */
    private calculateMinDetourDistance(enemyPos: Vec3, crystalPos: Vec3, wallGroups: Node[][], perpendicular: Vec3): number {
        let maxRequiredDistance = 0;
        const designResolution = view.getDesignResolutionSize();
        const gameBounds = {
            minX: 0,
            maxX: designResolution.width,
            minY: 0,
            maxY: designResolution.height
        };

        // 清除旧的调试节点
        this.clearDebugNodes();

        for (const group of wallGroups) {
            // 计算组的边界框
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;
            let maxRadius = 0;

            for (const wall of group) {
                const wallScript = wall.getComponent('StoneWall') as any;
                if (!wallScript) continue;
                const radius = wallScript.collisionRadius || 40;
                maxRadius = Math.max(maxRadius, radius);
                const pos = wall.worldPosition;
                minX = Math.min(minX, pos.x - radius);
                maxX = Math.max(maxX, pos.x + radius);
                minY = Math.min(minY, pos.y - radius);
                maxY = Math.max(maxY, pos.y + radius);
            }


            // 计算从敌人到障碍物组边界的距离
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            const groupCenter = new Vec3(centerX, centerY, 0);
            
            // 计算障碍物组在垂直于路径方向上的投影
            const toGroup = new Vec3();
            Vec3.subtract(toGroup, groupCenter, enemyPos);
            const projection = Vec3.dot(toGroup, perpendicular);
            const groupWidth = Math.max(maxX - minX, maxY - minY) / 2 + maxRadius + 20; // 加上敌人半径

            // 需要的绕行距离 = 障碍物宽度 + 安全距离
            const requiredDistance = Math.abs(projection) + groupWidth;
            maxRequiredDistance = Math.max(maxRequiredDistance, requiredDistance);
        }

        return maxRequiredDistance;
    }

    /**
     * 计算石墙组与游戏边界形成的房间出口
     */
    private findRoomExits(enemyPos: Vec3, crystalPos: Vec3, wallGroups: Node[][], gameBounds: { minX: number; maxX: number; minY: number; maxY: number }, perpendicular: Vec3): Vec3[] {
        const exits: Vec3[] = [];
        const enemyRadius = 20; // 敌人的碰撞半径
        
        console.debug(`[Enemy] findRoomExits: 开始计算房间出口，敌人位置: (${enemyPos.x.toFixed(1)}, ${enemyPos.y.toFixed(1)}), 水晶位置: (${crystalPos.x.toFixed(1)}, ${crystalPos.y.toFixed(1)})`);
        
        // 合并所有石墙组的石墙到一个数组中
        const allWallsInGroups: Node[] = [];
        for (const group of wallGroups) {
            allWallsInGroups.push(...group);
            
            // 计算组的边界框并绘制标注
            let groupMinX = Infinity, groupMaxX = -Infinity;
            let groupMinY = Infinity, groupMaxY = -Infinity;
            
            for (const wall of group) {
                const wallScript = wall.getComponent('StoneWall') as any;
                if (!wallScript) continue;
                const radius = wallScript.collisionRadius || 40;
                const pos = wall.worldPosition;
                groupMinX = Math.min(groupMinX, pos.x - radius);
                groupMaxX = Math.max(groupMaxX, pos.x + radius);
                groupMinY = Math.min(groupMinY, pos.y - radius);
                groupMaxY = Math.max(groupMaxY, pos.y + radius);
            }
            
            // 确保边界框有效
            groupMinX = isFinite(groupMinX) ? groupMinX : enemyPos.x;
            groupMaxX = isFinite(groupMaxX) ? groupMaxX : enemyPos.x;
            groupMinY = isFinite(groupMinY) ? groupMinY : enemyPos.y;
            groupMaxY = isFinite(groupMaxY) ? groupMaxY : enemyPos.y;
            
        }
        
        // 1. 暂时禁用组内和组间间隙出口，因为它们生成了错误的出口
        // 后续可以优化这些方法后再启用
        // for (const group of wallGroups) {
        //     const gaps = this.findWallGroupGaps(group, enemyRadius);
        //     console.debug(`[Enemy] findRoomExits: 找到 ${gaps.length} 个石墙间隙`);
        //     
        //     for (const gap of gaps) {
        //         // 简化检查：只需要从间隙到水晶的路径畅通即可
        //         if (this.checkPathClearAroundObstacles(gap, crystalPos, [], this.getAllStoneWalls())) {
        //             exits.push(gap);
        //             console.debug(`[Enemy] findRoomExits: 找到石墙组间隙作为出口！位置: (${gap.x.toFixed(1)}, ${gap.y.toFixed(1)})`);
        //         }
        //     }
        // }
        
        // 2. 暂时禁用组间间隙出口
        // const interGroupGaps = this.findInterGroupGaps(wallGroups, enemyRadius);
        // console.debug(`[Enemy] findRoomExits: 找到 ${interGroupGaps.length} 个石墙组间间隙`);
        // 
        // for (const gap of interGroupGaps) {
        //     if (this.checkPathClearAroundObstacles(gap, crystalPos, [], this.getAllStoneWalls())) {
        //         exits.push(gap);
        //         console.debug(`[Enemy] findRoomExits: 找到石墙组间间隙作为出口！位置: (${gap.x.toFixed(1)}, ${gap.y.toFixed(1)})`);
        //     }
        // }
        
        // 3. 计算整体边界并查找边界出口
        // 计算所有石墙组的整体边界
        let overallMinX = Infinity, overallMaxX = -Infinity;
        let overallMinY = Infinity, overallMaxY = -Infinity;
        
        for (const wall of allWallsInGroups) {
            const wallScript = wall.getComponent('StoneWall') as any;
            if (!wallScript) continue;
            const radius = wallScript.collisionRadius || 40;
            const pos = wall.worldPosition;
            overallMinX = Math.min(overallMinX, pos.x - radius);
            overallMaxX = Math.max(overallMaxX, pos.x + radius);
            overallMinY = Math.min(overallMinY, pos.y - radius);
            overallMaxY = Math.max(overallMaxY, pos.y + radius);
        }
        
        // 确保边界有效
        overallMinX = isFinite(overallMinX) ? overallMinX : enemyPos.x;
        overallMaxX = isFinite(overallMaxX) ? overallMaxX : enemyPos.x;
        overallMinY = isFinite(overallMinY) ? overallMinY : enemyPos.y;
        overallMaxY = isFinite(overallMaxY) ? overallMaxY : enemyPos.y;
        
        // 扩展边界，考虑敌人和石墙的碰撞半径
        const extendedMinX = Math.max(gameBounds.minX, overallMinX - 100);
        const extendedMaxX = Math.min(gameBounds.maxX, overallMaxX + 100);
        const extendedMinY = Math.max(gameBounds.minY, overallMinY - 100);
        const extendedMaxY = Math.min(gameBounds.maxY, overallMaxY + 100);
        
        console.debug(`[Enemy] findRoomExits: 整体边界 - minX: ${extendedMinX.toFixed(1)}, maxX: ${extendedMaxX.toFixed(1)}, minY: ${extendedMinY.toFixed(1)}, maxY: ${extendedMaxY.toFixed(1)}`);
        
        // 4. 重新设计出口寻找算法：将石墙组视为边界，找到真正的口子作为出口
        console.debug(`[Enemy] findRoomExits: 重新设计的出口寻找算法`);
        
        // 找到主要的石墙组（最大的那个）
        let mainWallGroup: Node[] = [];
        for (const group of wallGroups) {
            if (group.length > mainWallGroup.length) {
                mainWallGroup = group;
            }
        }
        
        if (mainWallGroup.length === 0) {
            this.logMessage('debug', `[Enemy] findRoomExits: 没有找到主要石墙组`);
            return exits;
        }
        
        // 计算主要石墙组的边界
        let groupMinX = Infinity, groupMaxX = -Infinity;
        let groupMinY = Infinity, groupMaxY = -Infinity;
        
        // 收集所有石墙节点的位置
        const wallPositions: string[] = [];
        
        for (const wall of mainWallGroup) {
            const wallScript = wall.getComponent('StoneWall') as any;
            if (!wallScript) continue;
            const radius = wallScript.collisionRadius || 40;
            const pos = wall.worldPosition;
            groupMinX = Math.min(groupMinX, pos.x - radius);
            groupMaxX = Math.max(groupMaxX, pos.x + radius);
            groupMinY = Math.min(groupMinY, pos.y - radius);
            groupMaxY = Math.max(groupMaxY, pos.y + radius);
            
            // 收集石墙节点位置
            wallPositions.push(`(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
        }
        
        // 打印主要石墙组的占地面积和节点位置（info级别）
        console.debug(`[Enemy] findRoomExits: 主要石墙组占地面积 - minX: ${groupMinX.toFixed(1)}, maxX: ${groupMaxX.toFixed(1)}, minY: ${groupMinY.toFixed(1)}, maxY: ${groupMaxY.toFixed(1)}`);
        console.debug(`[Enemy] findRoomExits: 主要石墙组节点位置: [${wallPositions.join(', ')}]`);
        
        // 打印所有石墙组的占地面积和节点位置
        for (let i = 0; i < wallGroups.length; i++) {
            const group = wallGroups[i];
            let gMinX = Infinity, gMaxX = -Infinity;
            let gMinY = Infinity, gMaxY = -Infinity;
            const gWallPositions: string[] = [];
            
            for (const wall of group) {
                const wallScript = wall.getComponent('StoneWall') as any;
                if (!wallScript) continue;
                const radius = wallScript.collisionRadius || 40;
                const pos = wall.worldPosition;
                gMinX = Math.min(gMinX, pos.x - radius);
                gMaxX = Math.max(gMaxX, pos.x + radius);
                gMinY = Math.min(gMinY, pos.y - radius);
                gMaxY = Math.max(gMaxY, pos.y + radius);
                
                gWallPositions.push(`(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
            }
            
            console.debug(`[Enemy] findRoomExits: 石墙组${i+1}占地面积 - minX: ${gMinX.toFixed(1)}, maxX: ${gMaxX.toFixed(1)}, minY: ${gMinY.toFixed(1)}, maxY: ${gMaxY.toFixed(1)}`);
            console.debug(`[Enemy] findRoomExits: 石墙组${i+1}节点位置: [${gWallPositions.join(', ')}]`);
        }
        
        console.debug(`[Enemy] findRoomExits: 游戏边界 - minX: ${gameBounds.minX.toFixed(1)}, maxX: ${gameBounds.maxX.toFixed(1)}, minY: ${gameBounds.minY.toFixed(1)}, maxY: ${gameBounds.maxY.toFixed(1)}`);
        
        // 计算敌人移动方向
        const directionToCrystal = new Vec3();
        Vec3.subtract(directionToCrystal, crystalPos, enemyPos);
        directionToCrystal.normalize();
        
        // 检查敌人是否已经通过了石墙组
        // 检查敌人是否已经在石墙组的另一侧（相对于水晶方向）
        // 如果敌人X坐标大于石墙组最大X，且正向左移动，说明已经通过
        // 或者敌人X坐标小于石墙组最小X，且正向右移动，说明已经通过
        const hasPassedWallGroup = 
            (enemyPos.x > groupMaxX && directionToCrystal.x < 0) ||
            (enemyPos.x < groupMinX && directionToCrystal.x > 0);
        
        console.debug(`[Enemy] findRoomExits: 敌人位置: (${enemyPos.x.toFixed(1)}, ${enemyPos.y.toFixed(1)}), 移动方向: (${directionToCrystal.x.toFixed(2)}, ${directionToCrystal.y.toFixed(2)}), 石墙组边界: [${groupMinX.toFixed(1)}, ${groupMaxX.toFixed(1)}], 是否已通过: ${hasPassedWallGroup}`);
        
        // 只有当敌人还没通过石墙组时，才寻找出口
        if (hasPassedWallGroup) {
            console.debug(`[Enemy] findRoomExits: 敌人已经通过石墙组，不需要寻找此方向的出口`);
            return exits;
        }
        
        // 计算敌人在石墙组的哪一侧
        const enemyCenterX = enemyPos.x;
        const groupCenterX = (groupMinX + groupMaxX) / 2;
        
        // 计算敌人y坐标对应的石墙组y位置，作为出口的y坐标
        // 确保出口y坐标在石墙组的y范围内
        const exitY = Math.max(groupMinY + (enemyRadius + 15), Math.min(groupMaxY - (enemyRadius + 5), enemyPos.y));
        
        // 添加右侧出口
        const rightExitX = groupMaxX + (enemyRadius + 5); // 石墙组右侧边界外仅25像素
        const rightExit = new Vec3(rightExitX, exitY, 0);
        rightExit.x = Math.max(gameBounds.minX + 20, Math.min(gameBounds.maxX - 20, rightExit.x));
        rightExit.y = Math.max(gameBounds.minY + 20, Math.min(gameBounds.maxY - 20, rightExit.y));
        exits.push(rightExit);
        
        // 添加左侧出口
        const leftExitX = groupMinX - (enemyRadius + 5); // 石墙组左侧边界外仅25像素
        const leftExit = new Vec3(leftExitX, exitY, 0);
        leftExit.x = Math.max(gameBounds.minX + 20, Math.min(gameBounds.maxX - 20, leftExit.x));
        leftExit.y = Math.max(gameBounds.minY + 20, Math.min(gameBounds.maxY - 20, leftExit.y));
        exits.push(leftExit);
        
        console.debug(`[Enemy] findRoomExits: 找到两侧出口！左侧: (${leftExit.x.toFixed(1)}, ${leftExit.y.toFixed(1)}), 右侧: (${rightExit.x.toFixed(1)}, ${rightExit.y.toFixed(1)})`);
        
        // 4. 如果没有找到出口，添加一个基于敌人和水晶连线的紧急出口
        if (exits.length === 0) {
            this.logMessage('debug', `[Enemy] findRoomExits: 未找到常规出口，添加紧急出口`);
            const emergencyExit = this.generateEmergencyExit(enemyPos, crystalPos, overallMinX, overallMaxX, overallMinY, overallMaxY, gameBounds);
            if (emergencyExit) {
                exits.push(emergencyExit);
                console.debug(`[Enemy] findRoomExits: 添加紧急出口！位置: (${emergencyExit.x.toFixed(1)}, ${emergencyExit.y.toFixed(1)})`);
            }
        }
        
        // 去重：移除距离过近的出口
        const uniqueExits = this.deduplicateExits(exits, enemyRadius * 2);
        
        console.debug(`[Enemy] findRoomExits: 总共找到 ${uniqueExits.length} 个出口`);
        return uniqueExits;
    }
    
    /**
     * 查找不同石墙组之间的间隙
     */
    private findInterGroupGaps(wallGroups: Node[][], enemyRadius: number): Vec3[] {
        const gaps: Vec3[] = [];
        const minGapSize = enemyRadius * 2 + 10; // 最小间隙大小
        
        // 遍历所有石墙组对
        for (let i = 0; i < wallGroups.length; i++) {
            for (let j = i + 1; j < wallGroups.length; j++) {
                const groupA = wallGroups[i];
                const groupB = wallGroups[j];
                
                // 遍历组A和组B中的所有石墙对
                for (const wallA of groupA) {
                    for (const wallB of groupB) {
                        const wallAScript = wallA.getComponent('StoneWall') as any;
                        const wallBScript = wallB.getComponent('StoneWall') as any;
                        if (!wallAScript || !wallBScript) continue;
                        
                        const wallARadius = wallAScript.collisionRadius || 40;
                        const wallBRadius = wallBScript.collisionRadius || 40;
                        const wallAPos = wallA.worldPosition;
                        const wallBPos = wallB.worldPosition;
                        
                        // 计算两个石墙之间的距离
                        const distance = Vec3.distance(wallAPos, wallBPos);
                        const minDistance = wallARadius + wallBRadius;
                        
                        // 如果两个石墙之间的距离大于最小距离 + 最小间隙大小，说明存在间隙
                        if (distance > minDistance + minGapSize) {
                            // 计算间隙的中心位置
                            const gapCenter = new Vec3();
                            Vec3.lerp(gapCenter, wallAPos, wallBPos, 0.5);
                            
                            // 检查这个间隙是否已经被添加
                            const alreadyExists = gaps.some(gap => Vec3.distance(gap, gapCenter) < minGapSize / 2);
                            if (!alreadyExists) {
                                gaps.push(gapCenter);
                                console.debug(`[Enemy] findInterGroupGaps: 找到石墙组间间隙！位置: (${gapCenter.x.toFixed(1)}, ${gapCenter.y.toFixed(1)}), 组A石墙: (${wallAPos.x.toFixed(1)}, ${wallAPos.y.toFixed(1)}), 组B石墙: (${wallBPos.x.toFixed(1)}, ${wallBPos.y.toFixed(1)}), 距离: ${distance.toFixed(1)}`);
                            }
                        }
                    }
                }
            }
        }
        
        return gaps;
    }
    
    /**
     * 生成边界出口候选点
     */
    private generateBoundaryExitCandidates(minX: number, maxX: number, minY: number, maxY: number, enemyPos: Vec3, crystalPos: Vec3, gameBounds: { minX: number; maxX: number; minY: number; maxY: number }): Vec3[] {
        const candidates: Vec3[] = [];
        const offset = 50; // 出口偏移距离
        const candidateCount = 5; // 每个边界生成的候选点数量
        
        // 计算边界长度
        const width = maxX - minX;
        const height = maxY - minY;
        
        // 生成右侧边界的候选点
        const rightX = maxX + offset;
        for (let i = 0; i < candidateCount; i++) {
            const ratio = i / (candidateCount - 1);
            const exitY = minY + height * ratio;
            const exitPos = new Vec3(rightX, exitY, 0);
            // 限制在游戏边界内
            exitPos.x = Math.max(gameBounds.minX + 50, Math.min(gameBounds.maxX - 50, exitPos.x));
            exitPos.y = Math.max(gameBounds.minY + 50, Math.min(gameBounds.maxY - 50, exitPos.y));
            candidates.push(exitPos);
        }
        
        // 生成左侧边界的候选点
        const leftX = minX - offset;
        for (let i = 0; i < candidateCount; i++) {
            const ratio = i / (candidateCount - 1);
            const exitY = minY + height * ratio;
            const exitPos = new Vec3(leftX, exitY, 0);
            // 限制在游戏边界内
            exitPos.x = Math.max(gameBounds.minX + 50, Math.min(gameBounds.maxX - 50, exitPos.x));
            exitPos.y = Math.max(gameBounds.minY + 50, Math.min(gameBounds.maxY - 50, exitPos.y));
            candidates.push(exitPos);
        }
        
        // 生成上侧边界的候选点
        const topY = maxY + offset;
        for (let i = 0; i < candidateCount; i++) {
            const ratio = i / (candidateCount - 1);
            const exitX = minX + width * ratio;
            const exitPos = new Vec3(exitX, topY, 0);
            // 限制在游戏边界内
            exitPos.x = Math.max(gameBounds.minX + 50, Math.min(gameBounds.maxX - 50, exitPos.x));
            exitPos.y = Math.max(gameBounds.minY + 50, Math.min(gameBounds.maxY - 50, exitPos.y));
            candidates.push(exitPos);
        }
        
        // 生成下侧边界的候选点
        const bottomY = minY - offset;
        for (let i = 0; i < candidateCount; i++) {
            const ratio = i / (candidateCount - 1);
            const exitX = minX + width * ratio;
            const exitPos = new Vec3(exitX, bottomY, 0);
            // 限制在游戏边界内
            exitPos.x = Math.max(gameBounds.minX + 50, Math.min(gameBounds.maxX - 50, exitPos.x));
            exitPos.y = Math.max(gameBounds.minY + 50, Math.min(gameBounds.maxY - 50, exitPos.y));
            candidates.push(exitPos);
        }
        
        return candidates;
    }
    
    /**
     * 生成紧急出口
     */
    private generateEmergencyExit(enemyPos: Vec3, crystalPos: Vec3, minX: number, maxX: number, minY: number, maxY: number, gameBounds: { minX: number; maxX: number; minY: number; maxY: number }): Vec3 | null {
        // 计算敌人到水晶的方向
        const direction = new Vec3();
        Vec3.subtract(direction, crystalPos, enemyPos);
        direction.normalize();
        
        // 计算垂直于移动方向的方向
        const perpendicular = new Vec3(-direction.y, direction.x, 0);
        perpendicular.normalize();
        
        // 尝试在左右两侧生成紧急出口
        const emergencyDistances = [150, 250, 350, 450]; // 不同距离的尝试
        
        for (const distance of emergencyDistances) {
            // 尝试右侧
            const rightExit = new Vec3();
            Vec3.scaleAndAdd(rightExit, enemyPos, perpendicular, -distance);
            // 限制在游戏边界内
            rightExit.x = Math.max(gameBounds.minX + 50, Math.min(gameBounds.maxX - 50, rightExit.x));
            rightExit.y = Math.max(gameBounds.minY + 50, Math.min(gameBounds.maxY - 50, rightExit.y));
            
            if (this.checkPathClear(rightExit, crystalPos, this.getAllStoneWalls())) {
                return rightExit;
            }
            
            // 尝试左侧
            const leftExit = new Vec3();
            Vec3.scaleAndAdd(leftExit, enemyPos, perpendicular, distance);
            // 限制在游戏边界内
            leftExit.x = Math.max(gameBounds.minX + 50, Math.min(gameBounds.maxX - 50, leftExit.x));
            leftExit.y = Math.max(gameBounds.minY + 50, Math.min(gameBounds.maxY - 50, leftExit.y));
            
            if (this.checkPathClear(leftExit, crystalPos, this.getAllStoneWalls())) {
                return leftExit;
            }
        }
        
        // 如果都失败，返回基于游戏边界的默认出口
        return new Vec3(
            (gameBounds.minX + gameBounds.maxX) / 2,
            gameBounds.minY + 100,
            0
        );
    }
    
    /**
     * 生成基于敌人到水晶连线的直接出口候选点
     */
    private generateDirectExitCandidates(enemyPos: Vec3, crystalPos: Vec3, overallMinX: number, overallMaxX: number, overallMinY: number, overallMaxY: number, gameBounds: { minX: number; maxX: number; minY: number; maxY: number }): Vec3[] {
        const candidates: Vec3[] = [];
        const offset = 50; // 出口偏移距离
        
        console.debug(`[Enemy] generateDirectExitCandidates: 敌人位置: (${enemyPos.x.toFixed(1)}, ${enemyPos.y.toFixed(1)}), 水晶位置: (${crystalPos.x.toFixed(1)}, ${crystalPos.y.toFixed(1)})`);
        
        // 计算敌人到水晶的方向
        const direction = new Vec3();
        Vec3.subtract(direction, crystalPos, enemyPos);
        const distance = direction.length();
        direction.normalize();
        
        // 计算垂直于移动方向的方向
        const perpendicular = new Vec3(-direction.y, direction.x, 0);
        perpendicular.normalize();
        
        // 生成多个偏移距离的候选点
        const offsetDistances = [100, 150, 200, 250];
        
        // 只尝试右侧偏移，因为左侧是边界
        for (const dist of offsetDistances) {
            // 右侧偏移（根据敌人位置和水晶位置确定真正的右侧）
            // 计算偏移方向：根据水晶位置在敌人的哪一侧
            const crystalOnRight = crystalPos.x > enemyPos.x;
            const offsetDirection = crystalOnRight ? -1 : 1; // 水晶在右侧时，向右偏移为负方向
            
            const exitPos = new Vec3();
            Vec3.scaleAndAdd(exitPos, enemyPos, perpendicular, offsetDirection * dist);
            
            // 沿着敌人到水晶的方向移动一段距离
            const forwardDistance = Math.min(distance / 3, 150); // 最大向前移动150像素
            Vec3.add(exitPos, exitPos, direction.multiplyScalar(forwardDistance));
            
            // 限制在游戏边界内
            exitPos.x = Math.max(gameBounds.minX + 100, Math.min(gameBounds.maxX - 100, exitPos.x));
            exitPos.y = Math.max(gameBounds.minY + 100, Math.min(gameBounds.maxY - 100, exitPos.y));
            
            // 确保出口位置合理，不靠近边界
            const isNearBoundary = exitPos.x < gameBounds.minX + 150 || exitPos.x > gameBounds.maxX - 150 || 
                                  exitPos.y < gameBounds.minY + 150 || exitPos.y > gameBounds.maxY - 150;
            
            if (!isNearBoundary) {
                candidates.push(exitPos);
                console.debug(`[Enemy] generateDirectExitCandidates: 生成右侧出口候选点: (${exitPos.x.toFixed(1)}, ${exitPos.y.toFixed(1)}), 偏移距离: ${dist}`);
            }
        }
        
        return candidates;
    }
    
    /**
     * 去重出口列表，移除距离过近的出口
     */
    private deduplicateExits(exits: Vec3[], minDistance: number): Vec3[] {
        const uniqueExits: Vec3[] = [];
        
        for (const exit of exits) {
            let isDuplicate = false;
            for (const uniqueExit of uniqueExits) {
                if (Vec3.distance(exit, uniqueExit) < minDistance) {
                    isDuplicate = true;
                    break;
                }
            }
            if (!isDuplicate) {
                uniqueExits.push(exit);
            }
        }
        
        return uniqueExits;
    }

    /**
     * 查找石墙组中的间隙（门）
     */
    private findWallGroupGaps(wallGroup: Node[], enemyRadius: number): Vec3[] {
        const gaps: Vec3[] = [];
        const minGapSize = enemyRadius * 2 + 10; // 最小间隙大小（敌人可以通过）
        
        // 遍历石墙组中的每一个石墙
        for (let i = 0; i < wallGroup.length; i++) {
            const wallA = wallGroup[i];
            const wallAScript = wallA.getComponent('StoneWall') as any;
            if (!wallAScript) continue;
            const wallARadius = wallAScript.collisionRadius || 40;
            const wallAPos = wallA.worldPosition;
            
            // 遍历其他石墙，检查间隙
            for (let j = i + 1; j < wallGroup.length; j++) {
                const wallB = wallGroup[j];
                const wallBScript = wallB.getComponent('StoneWall') as any;
                if (!wallBScript) continue;
                const wallBRadius = wallBScript.collisionRadius || 40;
                const wallBPos = wallB.worldPosition;
                
                // 计算两个石墙之间的距离
                const distance = Vec3.distance(wallAPos, wallBPos);
                const minDistance = wallARadius + wallBRadius;
                
                // 如果两个石墙之间的距离大于最小距离 + 最小间隙大小，说明存在间隙
                if (distance > minDistance + minGapSize) {
                    // 计算间隙的中心位置
                    const gapCenter = new Vec3();
                    Vec3.lerp(gapCenter, wallAPos, wallBPos, 0.5);
                    
                    // 检查这个间隙是否已经被添加
                    const alreadyExists = gaps.some(gap => Vec3.distance(gap, gapCenter) < minGapSize / 2);
                    if (!alreadyExists) {
                        gaps.push(gapCenter);
                        console.debug(`[Enemy] findWallGroupGaps: 找到石墙间隙！位置: (${gapCenter.x.toFixed(1)}, ${gapCenter.y.toFixed(1)}), 石墙A: (${wallAPos.x.toFixed(1)}, ${wallAPos.y.toFixed(1)}), 石墙B: (${wallBPos.x.toFixed(1)}, ${wallBPos.y.toFixed(1)}), 距离: ${distance.toFixed(1)}, 最小距离: ${minDistance.toFixed(1)}, 间隙大小: ${(distance - minDistance).toFixed(1)}`);
                    }
                }
            }
        }
        
        return gaps;
    }

    /**
     * 查找房间某一侧的出口
     */
    private findExitOnSide(enemyPos: Vec3, crystalPos: Vec3, wallGroup: Node[], sidePosition: number, gameBounds: { minX: number; maxX: number; minY: number; maxY: number }, perpendicular: Vec3, side: string): Vec3 | null {
        // 根据侧边类型计算出口位置
        let exitX: number, exitY: number;
        const offset = 50; // 出口偏移距离
        
        // 改进的出口位置计算：基于石墙组的边界，而不是敌人和水晶的平均值
        // 计算组的边界框
        let groupMinX = Infinity, groupMaxX = -Infinity;
        let groupMinY = Infinity, groupMaxY = -Infinity;
        
        for (const wall of wallGroup) {
            const wallScript = wall.getComponent('StoneWall') as any;
            if (!wallScript) continue;
            const radius = wallScript.collisionRadius || 40;
            const pos = wall.worldPosition;
            groupMinX = Math.min(groupMinX, pos.x - radius);
            groupMaxX = Math.max(groupMaxX, pos.x + radius);
            groupMinY = Math.min(groupMinY, pos.y - radius);
            groupMaxY = Math.max(groupMaxY, pos.y + radius);
        }
        
        // 确保边界框有效
        groupMinX = isFinite(groupMinX) ? groupMinX : enemyPos.x;
        groupMaxX = isFinite(groupMaxX) ? groupMaxX : enemyPos.x;
        groupMinY = isFinite(groupMinY) ? groupMinY : enemyPos.y;
        groupMaxY = isFinite(groupMaxY) ? groupMaxY : enemyPos.y;
        
        // 计算组的中心点
        const groupCenterX = (groupMinX + groupMaxX) / 2;
        const groupCenterY = (groupMinY + groupMaxY) / 2;
        
        // 根据侧边类型计算出口位置
        switch (side) {
            case 'right':
                exitX = sidePosition + offset;
                exitY = groupCenterY; // 使用组中心点作为Y坐标
                break;
            case 'left':
                exitX = sidePosition - offset;
                exitY = groupCenterY; // 使用组中心点作为Y坐标
                break;
            case 'top':
                exitX = groupCenterX; // 使用组中心点作为X坐标
                exitY = sidePosition + offset;
                break;
            case 'bottom':
                exitX = groupCenterX; // 使用组中心点作为X坐标
                exitY = sidePosition - offset;
                break;
            default:
                return null;
        }

        // 限制出口在游戏边界内
        exitX = Math.max(gameBounds.minX + 50, Math.min(gameBounds.maxX - 50, exitX));
        exitY = Math.max(gameBounds.minY + 50, Math.min(gameBounds.maxY - 50, exitY));

        const exitPos = new Vec3(exitX, exitY, 0);
        
        console.debug(`[Enemy] findExitOnSide: 计算出口位置，侧边: ${side}, 位置: (${exitPos.x.toFixed(1)}, ${exitPos.y.toFixed(1)})`);
        
        // 改进的路径检查：只检查从出口到水晶的路径是否畅通
        // 敌人可以自行移动到出口位置
        if (this.checkPathClearAroundObstacles(exitPos, crystalPos, [], this.getAllStoneWalls())) {
            console.debug(`[Enemy] findExitOnSide: 出口到水晶的路径畅通，返回出口位置`);
            return exitPos;
        }
        
        // 如果严格检查失败，尝试使用更宽松的检查
        console.debug(`[Enemy] findExitOnSide: 严格检查失败，尝试宽松检查`);
        if (this.checkPathClear(exitPos, crystalPos, this.getAllStoneWalls())) {
            console.debug(`[Enemy] findExitOnSide: 宽松检查通过，返回出口位置`);
            return exitPos;
        }
        
        console.debug(`[Enemy] findExitOnSide: 所有检查失败，返回null`);
        return null;
    }

    /**
     * 从房间出口中选择最佳出口
     */
    private selectBestExit(exits: Vec3[], enemyPos: Vec3, crystalPos: Vec3): Vec3 | null {
        if (exits.length === 0) {
            return null;
        }
        
        // 选择距离敌人最近且能通往水晶的出口
        let bestExit: Vec3 | null = null;
        let minTotalDistance = Infinity;
        
        for (const exit of exits) {
            // 计算总距离：敌人到出口 + 出口到水晶
            const enemyToExit = Vec3.distance(enemyPos, exit);
            const exitToCrystal = Vec3.distance(exit, crystalPos);
            const totalDistance = enemyToExit + exitToCrystal;
            
            // 选择总距离最短的出口
            if (totalDistance < minTotalDistance) {
                minTotalDistance = totalDistance;
                bestExit = exit;
            }
        }
        
        return bestExit;
    }

    /**
     * 获取所有石墙
     */
    private getAllStoneWalls(): Node[] {
        const stoneWalls: Node[] = [];
        
        // 递归查找场景中所有带有StoneWall组件的节点
        if (this.node.scene) {
            const findAllStoneWalls = (node: Node) => {
                const wallScript = node.getComponent('StoneWall') as any;
                if (wallScript && node.active && node.isValid && wallScript.isAlive && wallScript.isAlive()) {
                    stoneWalls.push(node);
                }
                for (const child of node.children) {
                    findAllStoneWalls(child);
                }
            };
            findAllStoneWalls(this.node.scene);
        }
        
        return stoneWalls;
    }

    /**
     * 清除所有旧的调试节点
     */
    private clearDebugNodes() {
        const oldDebugNodes = this.node.scene?.children.filter(node => node.name.startsWith('WallGroupDebug'));
        if (oldDebugNodes && oldDebugNodes.length > 0) {
            for (const oldNode of oldDebugNodes) {
                oldNode.destroy();
            }
        }
    }

    /**
     * 调试：绘制石墙组的占地面积
     */

    /**
     * 检查从当前位置到绕行目标点的路径是否被石墙阻挡
     */
    private checkPathFromCurrentToDetourBlocked(): boolean {
        if (!this.detourTarget) {
            return false;
        }
        
        const currentPos = this.node.worldPosition;
        const detourPos = this.detourTarget;
        
        // 检查从当前位置到绕行目标点的路径是否被石墙阻挡
        // 使用分段检测，每30像素检查一次
        const direction = new Vec3();
        Vec3.subtract(direction, detourPos, currentPos);
        const distance = direction.length();
        const checkSteps = Math.max(5, Math.ceil(distance / 30)); // 每30像素检查一次，至少检查5次
        const stepSize = distance / checkSteps;
        
        direction.normalize();
        
        for (let i = 0; i <= checkSteps; i++) {
            const checkPos = new Vec3();
            Vec3.scaleAndAdd(checkPos, currentPos, direction, stepSize * i);
            
            // 检查该位置是否与石墙碰撞
            if (this.checkCollisionWithStoneWall(checkPos)) {
                console.debug(`[Enemy] checkPathFromCurrentToDetourBlocked: 从当前位置到绕行目标点的路径被石墙阻挡，检查点: (${checkPos.x.toFixed(1)}, ${checkPos.y.toFixed(1)})`);
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 检查从起点到终点的路径是否畅通（绕过障碍物组）
     */
    private checkPathClearAroundObstacles(startPos: Vec3, endPos: Vec3, wallGroups: Node[][], allStoneWalls: Node[]): boolean {
        const direction = new Vec3();
        Vec3.subtract(direction, endPos, startPos);
        const distance = direction.length();
        
        if (distance < 0.1) {
            return true;
        }

        direction.normalize();
        // 使用更小的步长进行检测，确保不会漏掉阻挡的石墙
        const checkSteps = Math.max(10, Math.ceil(distance / 30)); // 每30像素检测一次，至少检测10次
        const stepSize = distance / checkSteps;
        
        const enemyRadius = 20; // 敌人的碰撞半径

        // 检查路径上的每个点
        for (let i = 0; i <= checkSteps; i++) {
            const checkPos = new Vec3();
            Vec3.scaleAndAdd(checkPos, startPos, direction, stepSize * i);

            // 检查是否与任何障碍物组碰撞
            for (const group of wallGroups) {
                if (this.checkPositionCollidesWithGroup(checkPos, group, enemyRadius)) {
                    return false; // 路径被阻挡
                }
            }

            // 也检查其他不在组内的石墙
            for (const wall of allStoneWalls) {
                // 跳过已经在组内的石墙
                let inGroup = false;
                for (const group of wallGroups) {
                    if (group.indexOf(wall) >= 0) {
                        inGroup = true;
                        break;
                    }
                }
                if (inGroup) continue;

                if (!wall || !wall.active || !wall.isValid) continue;
                
                const wallScript = wall.getComponent('StoneWall') as any;
                if (!wallScript || !wallScript.isAlive || !wallScript.isAlive()) continue;

                const wallPos = wall.worldPosition;
                const wallRadius = wallScript.collisionRadius || 40;
                const distanceToWall = Vec3.distance(checkPos, wallPos);
                const minDistance = enemyRadius + wallRadius + 10; // 增加10像素的安全距离

                if (distanceToWall < minDistance) {
                    return false; // 路径被阻挡
                }
            }
        }

        return true; // 路径畅通
    }


    /**
     * 检查位置是否与障碍物组碰撞（将组作为整体障碍物处理）
     */
    private checkPositionCollidesWithGroup(position: Vec3, group: Node[], enemyRadius: number): boolean {
        if (group.length === 0) {
            return false;
        }

        // 计算组的边界框（包括所有石墙的碰撞半径）
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let maxRadius = 0;

        for (const wall of group) {
            if (!wall || !wall.active || !wall.isValid) continue;
            
            const wallScript = wall.getComponent('StoneWall') as any;
            if (!wallScript || !wallScript.isAlive || !wallScript.isAlive()) continue;

            const wallPos = wall.worldPosition;
            const wallRadius = wallScript.collisionRadius || 40;
            maxRadius = Math.max(maxRadius, wallRadius);
            
            // 扩展边界框，包含石墙的碰撞半径
            minX = Math.min(minX, wallPos.x - wallRadius);
            maxX = Math.max(maxX, wallPos.x + wallRadius);
            minY = Math.min(minY, wallPos.y - wallRadius);
            maxY = Math.max(maxY, wallPos.y + wallRadius);
        }

        // 如果边界框无效，回退到逐个检查
        if (minX === Infinity || maxX === -Infinity || minY === Infinity || maxY === -Infinity) {
            for (const wall of group) {
                if (!wall || !wall.active || !wall.isValid) continue;
                
                const wallScript = wall.getComponent('StoneWall') as any;
                if (!wallScript || !wallScript.isAlive || !wallScript.isAlive()) continue;

                const wallPos = wall.worldPosition;
                const wallRadius = wallScript.collisionRadius || 40;
                const distanceToWall = Vec3.distance(position, wallPos);
                const minDistance = enemyRadius + wallRadius + 10;

                if (distanceToWall < minDistance) {
                    return true;
                }
            }
            return false;
        }

        // 扩展边界框，加上敌人半径和安全距离
        const safetyMargin = enemyRadius + 10;
        minX -= safetyMargin;
        maxX += safetyMargin;
        minY -= safetyMargin;
        maxY += safetyMargin;

        // 检查位置是否在扩展后的边界框内
        if (position.x >= minX && position.x <= maxX && position.y >= minY && position.y <= maxY) {
            return true; // 位置在组的边界框内，视为碰撞
        }

        // 如果位置在边界框外，检查是否与边界框的边或角太近（用于处理边界情况）
        // 计算位置到边界框的最短距离
        const closestX = Math.max(minX, Math.min(maxX, position.x));
        const closestY = Math.max(minY, Math.min(maxY, position.y));
        const distanceToBox = Vec3.distance(position, new Vec3(closestX, closestY, 0));
        
        // 如果距离边界框太近（小于敌人半径），也视为碰撞
        if (distanceToBox < enemyRadius) {
            return true;
        }

        return false; // 无碰撞
    }

    /**
     * 检查从起点到终点的路径是否畅通（没有石墙阻挡）
     */
    private checkPathClear(startPos: Vec3, endPos: Vec3, stoneWalls: Node[]): boolean {
        const direction = new Vec3();
        Vec3.subtract(direction, endPos, startPos);
        const distance = direction.length();
        
        if (distance < 0.1) {
            return true;
        }

        direction.normalize();
        // 使用更小的步长进行检测，确保不会漏掉阻挡的石墙
        const checkSteps = Math.max(10, Math.ceil(distance / 30)); // 每30像素检测一次，至少检测10次
        const stepSize = distance / checkSteps;
        
        const enemyRadius = 20; // 敌人的碰撞半径

        for (let i = 0; i <= checkSteps; i++) {
            const checkPos = new Vec3();
            Vec3.scaleAndAdd(checkPos, startPos, direction, stepSize * i);

            for (const wall of stoneWalls) {
                if (!wall || !wall.active || !wall.isValid) continue;
                
                const wallScript = wall.getComponent('StoneWall') as any;
                if (!wallScript || !wallScript.isAlive || !wallScript.isAlive()) continue;

                const wallPos = wall.worldPosition;
                const wallRadius = wallScript.collisionRadius || 40;
                const distanceToWall = Vec3.distance(checkPos, wallPos);
                const minDistance = enemyRadius + wallRadius + 10; // 增加10像素的安全距离

                // 如果检测点距离石墙太近，说明路径被阻挡
                if (distanceToWall < minDistance) {
                    return false; // 路径被阻挡
                }
            }
        }

        return true; // 路径畅通
    }

    checkForTargetsOnPath() {
        // 检测范围：200像素
        const detectionRange = 200;
        
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
        
        // 定义优先级：水晶>石墙（阻挡路径时）>树木>角色>建筑物
        const PRIORITY = {
            CRYSTAL: 1,
            STONEWALL: 1.5, // 石墙优先级介于水晶和树木之间
            TREE: 2,
            CHARACTER: 3,
            BUILDING: 4
        };
        
        // 收集所有可能的目标对象
        const allPotentialTargets: Node[] = [];
        const enemyPos = this.node.worldPosition;
        
        // 1. 添加水晶（如果存在且存活）
        if (this.targetCrystal && this.targetCrystal.isValid) {
            const crystalScript = this.targetCrystal.getComponent('Crystal') as any;
            if (crystalScript && crystalScript.isAlive && crystalScript.isAlive()) {
                allPotentialTargets.push(this.targetCrystal);
            }
        }
        
        // 2. 检查路径是否被石墙阻挡
        const blockedStoneWall = this.checkPathBlockedByStoneWall();
        if (blockedStoneWall) {
            // 路径被石墙阻挡且无法绕行，优先攻击石墙
            allPotentialTargets.push(blockedStoneWall);
        }
        // 注意：如果可以绕行（blockedStoneWall为null），则不添加任何石墙到目标列表，
        // 让Enemy继续向水晶移动，而不是攻击石墙

        // 3. 添加石墙（用于一般检测）
        // 已移除：当可以绕行时，不应该添加石墙到目标列表

        // 4. 添加树木
        let treesNode = find('Trees');
        if (!treesNode && this.node.scene) {
            treesNode = findNodeRecursive(this.node.scene, 'Trees');
        }
        if (treesNode) {
            const trees = treesNode.children || [];
            for (const tree of trees) {
                if (tree && tree.active && tree.isValid) {
                    const treeScript = tree.getComponent('Tree') as any;
                    if (treeScript && treeScript.isAlive && treeScript.isAlive()) {
                        allPotentialTargets.push(tree);
                    }
                }
            }
        }
        
        // 5. 添加角色单位
        // 3.1) 弓箭手
        let towersNode = find('Towers');
        if (!towersNode && this.node.scene) {
            towersNode = findNodeRecursive(this.node.scene, 'Towers');
        }
        if (towersNode) {
            const towers = towersNode.children || [];
            for (const tower of towers) {
                if (tower && tower.active && tower.isValid) {
                    const towerScript = tower.getComponent('Arrower') as any;
                    if (towerScript && towerScript.isAlive && towerScript.isAlive()) {
                        allPotentialTargets.push(tower);
                    }
                }
            }
            // 3.1.5) 牧师（也在Towers容器中）
            for (const tower of towers) {
                if (tower && tower.active && tower.isValid) {
                    const priestScript = tower.getComponent('Priest') as any;
                    if (priestScript && priestScript.isAlive && priestScript.isAlive()) {
                        allPotentialTargets.push(tower);
                    }
                }
            }
        }
        
        // 3.2) 女猎手
        let huntersNode = find('Hunters');
        if (!huntersNode && this.node.scene) {
            huntersNode = findNodeRecursive(this.node.scene, 'Hunters');
        }
        if (huntersNode) {
            const hunters = huntersNode.children || [];
            for (const hunter of hunters) {
                if (hunter && hunter.active && hunter.isValid) {
                    const hunterScript = hunter.getComponent('Hunter') as any;
                    if (hunterScript && hunterScript.isAlive && hunterScript.isAlive()) {
                        allPotentialTargets.push(hunter);
                    }
                }
            }
        }
        
        // 3.3) 精灵剑士
        let swordsmenNode = find('ElfSwordsmans');
        if (!swordsmenNode && this.node.scene) {
            swordsmenNode = findNodeRecursive(this.node.scene, 'ElfSwordsmans');
        }
        if (swordsmenNode) {
            const swordsmen = swordsmenNode.children || [];
            for (const swordsman of swordsmen) {
                if (swordsman && swordsman.active && swordsman.isValid) {
                    const swordsmanScript = swordsman.getComponent('ElfSwordsman') as any;
                    if (swordsmanScript && swordsmanScript.isAlive && swordsmanScript.isAlive()) {
                        allPotentialTargets.push(swordsman);
                    }
                }
            }
        }
        
        // 3.4) 小精灵
        let wispsNode = find('Wisps');
        if (!wispsNode && this.node.scene) {
            wispsNode = findNodeRecursive(this.node.scene, 'Wisps');
        }
        if (wispsNode) {
            const wisps = wispsNode.children || [];
            for (const wisp of wisps) {
                if (wisp && wisp.active && wisp.isValid) {
                    const wispScript = wisp.getComponent('Wisp') as any;
                    if (wispScript && wispScript.isAlive && wispScript.isAlive()) {
                        allPotentialTargets.push(wisp);
                    }
                }
            }
        }
        
        // 6. 添加建筑物
        // 4.1) 战争古树
        let warAncientTrees = find('WarAncientTrees');
        if (!warAncientTrees && this.node.scene) {
            warAncientTrees = findNodeRecursive(this.node.scene, 'WarAncientTrees');
        }
        if (warAncientTrees) {
            const trees = warAncientTrees.children || [];
            for (const tree of trees) {
                if (tree && tree.active && tree.isValid) {
                    const treeScript = tree.getComponent('WarAncientTree') as any;
                    if (treeScript && treeScript.isAlive && treeScript.isAlive()) {
                        allPotentialTargets.push(tree);
                    }
                }
            }
        }
        
        // 4.2) 月亮井
        let wellsNode = find('MoonWells');
        if (!wellsNode && this.node.scene) {
            wellsNode = findNodeRecursive(this.node.scene, 'MoonWells');
        }
        if (wellsNode) {
            const wells = wellsNode.children || [];
            for (const well of wells) {
                if (well && well.active && well.isValid) {
                    const wellScript = well.getComponent('MoonWell') as any;
                    if (wellScript && wellScript.isAlive && wellScript.isAlive()) {
                        allPotentialTargets.push(well);
                    }
                }
            }
        }
        
        // 4.3) 猎手大厅
        let hallsNode = find('HunterHalls');
        if (!hallsNode && this.node.scene) {
            hallsNode = findNodeRecursive(this.node.scene, 'HunterHalls');
        }
        if (hallsNode) {
            const halls = hallsNode.children || [];
            for (const hall of halls) {
                if (hall && hall.active && hall.isValid) {
                    const hallScript = hall.getComponent('HunterHall') as any;
                    if (hallScript && hallScript.isAlive && hallScript.isAlive()) {
                        allPotentialTargets.push(hall);
                    }
                }
            }
        } else if (this.node.scene) {
            // 如果没有找到HunterHalls容器，直接从场景中查找所有HunterHall组件
            const findAllHunterHalls = (node: Node) => {
                const hallScript = node.getComponent('HunterHall') as any;
                if (hallScript && hallScript.isAlive && hallScript.isAlive()) {
                    allPotentialTargets.push(node);
                }
                for (const child of node.children) {
                    findAllHunterHalls(child);
                }
            };
            findAllHunterHalls(this.node.scene);
        }
        
        // 4.4) 剑士小屋
        let swordsmanHallsNode = find('SwordsmanHalls');
        if (!swordsmanHallsNode && this.node.scene) {
            swordsmanHallsNode = findNodeRecursive(this.node.scene, 'SwordsmanHalls');
        }
        if (swordsmanHallsNode) {
            const swordsmanHalls = swordsmanHallsNode.children || [];
            for (const hall of swordsmanHalls) {
                if (hall && hall.active && hall.isValid) {
                    const hallScript = hall.getComponent('SwordsmanHall') as any;
                    if (hallScript && hallScript.isAlive && hallScript.isAlive()) {
                        allPotentialTargets.push(hall);
                    }
                }
            }
        } else if (this.node.scene) {
            // 如果没有找到SwordsmanHalls容器，直接从场景中查找所有SwordsmanHall组件
            const findAllSwordsmanHalls = (node: Node) => {
                const hallScript = node.getComponent('SwordsmanHall') as any;
                if (hallScript && hallScript.isAlive && hallScript.isAlive()) {
                    allPotentialTargets.push(node);
                }
                for (const child of node.children) {
                    findAllSwordsmanHalls(child);
                }
            };
            findAllSwordsmanHalls(this.node.scene);
        }
        
        // 过滤出在检测范围内的目标，并选择最佳目标
        let bestTarget: Node | null = null;
        let bestPriority = Infinity;
        let bestDistance = Infinity;
        
        for (const target of allPotentialTargets) {
            if (!target || !target.isValid) continue;
            
            // 计算距离
            const distance = Vec3.distance(enemyPos, target.worldPosition);
            if (distance > detectionRange) continue;
            
            // 确定目标优先级
            let targetPriority: number;
            if (target.getComponent('Crystal')) {
                targetPriority = PRIORITY.CRYSTAL;
            } else if (target.getComponent('StoneWall')) {
                targetPriority = PRIORITY.STONEWALL;
            } else if (target.getComponent('Tree')) {
                targetPriority = PRIORITY.TREE;
            } else if (target.getComponent('Arrower') || target.getComponent('Hunter') || target.getComponent('Wisp') || target.getComponent('ElfSwordsman')) {
                targetPriority = PRIORITY.CHARACTER;
            } else if (target.getComponent('WarAncientTree') || target.getComponent('MoonWell') || target.getComponent('HunterHall') || target.getComponent('SwordsmanHall')) {
                targetPriority = PRIORITY.BUILDING;
            } else {
                // 未知类型，跳过
                continue;
            }
            
            // 选择优先级最高且距离最近的目标
            if (targetPriority < bestPriority || 
                (targetPriority === bestPriority && distance < bestDistance)) {
                bestTarget = target;
                bestPriority = targetPriority;
                bestDistance = distance;
            }
        }
        
        // 如果找到目标，设置为当前目标
        if (bestTarget) {
            this.currentTarget = bestTarget;
        }
    }

    stopMoving() {
        // 停止移动，只有在没有播放其他动画时才切换到待机动画
        if (!this.isPlayingAttackAnimation && !this.isPlayingHitAnimation && !this.isPlayingDeathAnimation) {
            this.playIdleAnimation();
        }
    }

    // 动画更新方法
    updateAnimation(deltaTime: number) {
        if (!this.sprite) {
            return;
        }

        this.animationTimer += deltaTime;

        this.logMessage('info', `[Enemy] update: isPlayingIdleAnimation` + this.isPlayingIdleAnimation + " isPlayingWalkAnimation " + this.isPlayingWalkAnimation + " isPlayingAttackAnimation " + this.isPlayingAttackAnimation + " isPlayingHitAnimation " + this.isPlayingHitAnimation + " isPlayingDeathAnimation " + this.isPlayingDeathAnimation);
        // 根据当前播放的动画类型更新帧
        if (this.isPlayingIdleAnimation) {
            this.updateIdleAnimation();
        } else if (this.isPlayingWalkAnimation) {
            this.updateWalkAnimation();
        } else if (this.isPlayingAttackAnimation) {
            this.updateAttackAnimation();
        } else if (this.isPlayingHitAnimation) {
            this.updateHitAnimation();
        } else if (this.isPlayingDeathAnimation) {
            this.updateDeathAnimation();
        }
    }

    // 更新待机动画
    updateIdleAnimation() {
        if (this.idleAnimationFrames.length === 0) {
            this.isPlayingIdleAnimation = false;
            return;
        }

        const frameDuration = this.idleAnimationDuration / this.idleAnimationFrames.length;
        const frameIndex = Math.floor(this.animationTimer / frameDuration) % this.idleAnimationFrames.length;

        if (frameIndex !== this.currentAnimationFrameIndex) {
            this.currentAnimationFrameIndex = frameIndex;
            this.sprite.spriteFrame = this.idleAnimationFrames[frameIndex];
        }
    }

    // 更新行走动画
    updateWalkAnimation() {
        this.logMessage('info', `[Enemy] update: isPlayingWalkAnimation` + this.walkAnimationFrames.length);
        if (this.walkAnimationFrames.length === 0) {
            this.isPlayingWalkAnimation = false;
            return;
        }
        this.logMessage('info', `[Enemy] update: walkAnimationDuration` + this.walkAnimationDuration);
        const frameDuration = this.walkAnimationDuration / this.walkAnimationFrames.length;
        this.logMessage('info', `[Enemy] update: this.animationTimer` + frameDuration);
        this.logMessage('info', `[Enemy] update: this.animationTimer` + this.animationTimer);
        const frameIndex = Math.floor(this.animationTimer / frameDuration) % this.walkAnimationFrames.length;
        this.logMessage('info', `[Enemy] update: frameIndex` + frameIndex + " currentAnimationFrameIndex " + this.currentAnimationFrameIndex); 
        if (frameIndex !== this.currentAnimationFrameIndex) {
            this.currentAnimationFrameIndex = frameIndex;
            this.sprite.spriteFrame = this.walkAnimationFrames[frameIndex];
        }
    }

    // 更新攻击动画
    updateAttackAnimation() {
        // 如果使用Animation组件播放动画，直接返回
        if (this.animationComponent) {
            return;
        }
        
        // 如果没有设置攻击动画帧，直接停止动画
        if (this.attackAnimationFrames.length === 0) {
            this.isPlayingAttackAnimation = false;
            this.attackComplete = false;
            this.playIdleAnimation();
            return;
        }

        const frameDuration = this.attackAnimationDuration / this.attackAnimationFrames.length;
        const frameIndex = Math.floor(this.animationTimer / frameDuration);

        if (frameIndex < this.attackAnimationFrames.length) {
            if (frameIndex !== this.currentAnimationFrameIndex) {
                this.currentAnimationFrameIndex = frameIndex;
                this.sprite.spriteFrame = this.attackAnimationFrames[frameIndex];
                
                // 在攻击动画的后半段造成伤害
                const attackPoint = Math.floor(this.attackAnimationFrames.length * 0.5);
                if (frameIndex === attackPoint && !this.attackComplete) {
                    this.dealDamage();
                    this.attackComplete = true;
                }
            }
        } else {
            // 攻击动画播放完成，重置状态
            this.isPlayingAttackAnimation = false;
            this.attackComplete = false;
            this.playIdleAnimation();
        }
    }

    // 更新被攻击动画
    updateHitAnimation() {
        if (this.hitAnimationFrames.length === 0) {
            this.isPlayingHitAnimation = false;
            this.resumeMovement();
            return;
        }

        const frameDuration = this.hitAnimationDuration / this.hitAnimationFrames.length;
        const frameIndex = Math.floor(this.animationTimer / frameDuration);

        if (frameIndex < this.hitAnimationFrames.length) {
            if (frameIndex !== this.currentAnimationFrameIndex) {
                this.currentAnimationFrameIndex = frameIndex;
                if (this.hitAnimationFrames[frameIndex]) {
                    this.sprite.spriteFrame = this.hitAnimationFrames[frameIndex];
                }
            }
        } else {
            // 被攻击动画播放完成，恢复移动或待机
            this.isPlayingHitAnimation = false;
            this.resumeMovement();
        }
    }

    // 更新死亡动画
    updateDeathAnimation() {
        if (this.deathAnimationFrames.length === 0) {
            this.isPlayingDeathAnimation = false;
            return;
        }

        const frameDuration = this.deathAnimationDuration / this.deathAnimationFrames.length;
        const frameIndex = Math.floor(this.animationTimer / frameDuration) % this.deathAnimationFrames.length;

        if (frameIndex !== this.currentAnimationFrameIndex) {
            this.currentAnimationFrameIndex = frameIndex;
            this.sprite.spriteFrame = this.deathAnimationFrames[frameIndex];
        }
    }

    // 播放待机动画
    playIdleAnimation() {
        if (this.isPlayingIdleAnimation || this.isDestroyed) {
            return;
        }

        this.stopAllAnimations();
        this.isPlayingIdleAnimation = true;
        this.animationTimer = 0;
        this.currentAnimationFrameIndex = -1;
    }

    // 播放行走动画
    playWalkAnimation() {
        this.logMessage('debug', `playWalkAnimation: ========== 被调用 ==========`);
        this.logMessage('debug', `playWalkAnimation: isPlayingWalkAnimation=${this.isPlayingWalkAnimation}, isDestroyed=${this.isDestroyed}, isPlayingAttackAnimation=${this.isPlayingAttackAnimation}, isPlayingHitAnimation=${this.isPlayingHitAnimation}, isPlayingIdleAnimation=${this.isPlayingIdleAnimation}`);
        
        if (this.isDestroyed) {
            this.logMessage('debug', `playWalkAnimation: 已销毁，不播放`);
            return;
        }

        // 如果正在播放其他动画（攻击、被攻击、待机），需要停止并切换到行走动画
        if (this.isPlayingAttackAnimation || this.isPlayingHitAnimation || this.isPlayingIdleAnimation) {
            this.logMessage('info', `playWalkAnimation: 正在播放其他动画，停止所有动画并切换到行走动画`);
            this.stopAllAnimations();
            this.isPlayingWalkAnimation = true;
            this.animationTimer = 0;
            this.currentAnimationFrameIndex = -1;
            
            // 立即播放第一帧，确保动画可见
            if (this.walkAnimationFrames.length > 0 && this.walkAnimationFrames[0] && this.sprite) {
                this.sprite.spriteFrame = this.walkAnimationFrames[0];
                this.currentAnimationFrameIndex = 0;
                this.logMessage('debug', `playWalkAnimation: 已设置第一帧，walkAnimationFrames.length=${this.walkAnimationFrames.length}`);
            } else {
                this.logMessage('warn', `playWalkAnimation: 行走动画帧为空或sprite不存在，walkAnimationFrames.length=${this.walkAnimationFrames ? this.walkAnimationFrames.length : 0}, sprite=${this.sprite ? '存在' : '不存在'}`);
            }
            
            this.logMessage('info', `playWalkAnimation: 已设置行走动画状态，isPlayingWalkAnimation=true`);
        } else if (!this.isPlayingWalkAnimation) {
            // 没有在播放任何动画，直接切换到行走动画
            this.logMessage('info', `playWalkAnimation: 没有在播放任何动画，切换到行走动画`);
            this.isPlayingWalkAnimation = true;
            this.animationTimer = 0;
            this.currentAnimationFrameIndex = -1;
            
            // 立即播放第一帧，确保动画可见
            if (this.walkAnimationFrames.length > 0 && this.walkAnimationFrames[0] && this.sprite) {
                this.sprite.spriteFrame = this.walkAnimationFrames[0];
                this.currentAnimationFrameIndex = 0;
                this.logMessage('info', `playWalkAnimation: 已设置第一帧，walkAnimationFrames.length=${this.walkAnimationFrames.length}`);
            } else {
                this.logMessage('info', `playWalkAnimation: 行走动画帧为空或sprite不存在，walkAnimationFrames.length=${this.walkAnimationFrames ? this.walkAnimationFrames.length : 0}, sprite=${this.sprite ? '存在' : '不存在'}`);
            }
        } else {
            // 已经在播放行走动画，重置动画计时器确保动画正常播放
            // this.logMessage('debug', `playWalkAnimation: 已在播放行走动画，重置动画计时器确保动画正常播放`);
            // this.animationTimer = 0;
            // this.currentAnimationFrameIndex = -1;
            
            // // 立即播放第一帧，确保动画可见
            // if (this.walkAnimationFrames.length > 0 && this.walkAnimationFrames[0] && this.sprite) {
            //     this.sprite.spriteFrame = this.walkAnimationFrames[0];
            //     this.currentAnimationFrameIndex = 0;
            //     this.logMessage('debug', `playWalkAnimation: 已设置第一帧，walkAnimationFrames.length=${this.walkAnimationFrames.length}`);
            // } else {
            //     this.logMessage('warn', `playWalkAnimation: 行走动画帧为空或sprite不存在，walkAnimationFrames.length=${this.walkAnimationFrames ? this.walkAnimationFrames.length : 0}, sprite=${this.sprite ? '存在' : '不存在'}`);
            // }
        }
    }

    // 播放攻击动画
    playAttackAnimation() {
        this.logMessage('debug', `playAttackAnimation: ========== 被调用 ==========`);
        this.logMessage('debug', `playAttackAnimation: isPlayingDeathAnimation=${this.isPlayingDeathAnimation}, isDestroyed=${this.isDestroyed}, isPlayingAttackAnimation=${this.isPlayingAttackAnimation}`);
        
        if (this.isPlayingDeathAnimation || this.isDestroyed) {
            this.logMessage('debug', `playAttackAnimation: 已死亡或正在播放死亡动画，不播放攻击动画`);
            return;
        }

        // 检查当前目标距离
        if (this.currentTarget) {
            const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
            const targetType = this.currentTarget.getComponent('StoneWall') ? '石墙' : 
                              this.currentTarget.getComponent('Crystal') ? '水晶' : '其他';
            this.logMessage('debug', `playAttackAnimation: 当前目标${targetType}，距离=${distance.toFixed(1)}, 攻击范围=${this.attackRange}, 是否在攻击范围内=${distance <= this.attackRange}`);
        } else {
            this.logMessage('warn', `playAttackAnimation: 没有当前目标`);
        }

        // 停止所有动画
        this.logMessage('debug', `playAttackAnimation: 停止所有动画，当前状态: isPlayingWalkAnimation=${this.isPlayingWalkAnimation}, isPlayingIdleAnimation=${this.isPlayingIdleAnimation}, isPlayingAttackAnimation=${this.isPlayingAttackAnimation}`);
        this.stopAllAnimations();
        this.logMessage('debug', `playAttackAnimation: 停止所有动画后，状态: isPlayingWalkAnimation=${this.isPlayingWalkAnimation}, isPlayingIdleAnimation=${this.isPlayingIdleAnimation}, isPlayingAttackAnimation=${this.isPlayingAttackAnimation}`);
        
        // 设置攻击动画状态
        this.isPlayingAttackAnimation = true;
        this.attackComplete = false;
        this.animationTimer = 0;
        this.currentAnimationFrameIndex = -1;
        
        this.logMessage('debug', `playAttackAnimation: 已设置攻击动画状态，isPlayingAttackAnimation=true, attackComplete=false`);
        
        // 播放攻击音效
        if (this.attackSound) {
            this.logMessage('debug', `playAttackAnimation: 播放攻击音效`);
            AudioManager.Instance.playSFX(this.attackSound);
        } else {
            this.logMessage('debug', `playAttackAnimation: 没有攻击音效`);
        }
        
        // 如果使用Animation组件播放攻击动画（用于需要Animation组件的情况）
        if (this.animationComponent) {
            this.logMessage('debug', `playAttackAnimation: 使用Animation组件播放攻击动画，动画名称=${this.attackAnimationName}`);
            // 清除之前的动画事件
            this.animationComponent.off(Animation.EventType.FINISHED);
            
            // 先停止当前可能正在播放的动画，确保每次都能重新开始
            this.animationComponent.stop();
            this.logMessage('debug', `playAttackAnimation: 已停止Animation组件当前动画`);
            
            // 获取动画状态，设置动画速度与attackAnimationDuration保持同步
            const state = this.animationComponent.getState(this.attackAnimationName);
            if (state) {
                this.logMessage('debug', `playAttackAnimation: 找到动画状态，duration=${state.duration}, attackAnimationDuration=${this.attackAnimationDuration}`);
                // 重置动画播放头到开始位置
                state.time = 0;
                // 设置动画时长与attackAnimationDuration参数保持一致
                state.speed = state.duration / this.attackAnimationDuration;
                this.logMessage('debug', `playAttackAnimation: 设置动画速度=${state.speed.toFixed(2)}`);
            } else {
                this.logMessage('warn', `playAttackAnimation: 未找到动画状态，动画名称=${this.attackAnimationName}`);
            }
            
            // 注册动画完成事件监听器，确保动画播放完成后立即重置状态
            this.animationComponent.once(Animation.EventType.FINISHED, () => {
                this.logMessage('debug', `playAttackAnimation: Animation组件动画播放完成，重置状态`);
                if (this.isPlayingAttackAnimation) {
                    // 调用攻击回调函数（如果存在，用于特殊攻击逻辑如远程攻击）
                    if (this.attackCallback) {
                        this.attackCallback();
                        this.attackCallback = null;
                    }
                    
                    // 结束动画
                    this.isPlayingAttackAnimation = false;
                    this.attackComplete = false;
                    
                    // 动画结束后切换回待机动画
                    this.playIdleAnimation();
                }
            });
            
            // 播放动画
            this.animationComponent.play(this.attackAnimationName);
            this.logMessage('debug', `playAttackAnimation: 已调用animationComponent.play(${this.attackAnimationName})`);
            
            // 在动画播放到一半时造成伤害（与动画帧方式保持一致）
            const damageTimer = this.attackAnimationDuration * 0.5;
            this.scheduleOnce(() => {
                this.logMessage('debug', `playAttackAnimation: scheduleOnce回调触发（造成伤害），isPlayingAttackAnimation=${this.isPlayingAttackAnimation}, attackComplete=${this.attackComplete}, currentTarget=${this.currentTarget ? '存在' : 'null'}`);
                if (this.isPlayingAttackAnimation && !this.attackComplete) {
                    this.logMessage('debug', `playAttackAnimation: 动画播放到一半，调用dealDamage造成伤害`);
                    this.dealDamage();
                    this.attackComplete = true;
                } else {
                    this.logMessage('warn', `playAttackAnimation: 条件不满足，不调用dealDamage，isPlayingAttackAnimation=${this.isPlayingAttackAnimation}, attackComplete=${this.attackComplete}`);
                }
            }, damageTimer);
            
            // 同时使用scheduleOnce作为备用方案，确保即使事件监听失败也能重置状态
            const finishTimer = this.attackAnimationDuration;
            this.scheduleOnce(() => {
                if (this.isPlayingAttackAnimation) {
                    this.logMessage('warn', `playAttackAnimation: scheduleOnce触发，重置状态（备用方案）`);
                    // 调用攻击回调函数（如果存在，用于特殊攻击逻辑如远程攻击）
                    if (this.attackCallback) {
                        this.attackCallback();
                        this.attackCallback = null;
                    }
                    
                    // 结束动画
                    this.isPlayingAttackAnimation = false;
                    this.attackComplete = false;
                    
                    // 动画结束后切换回待机动画
                    this.playIdleAnimation();
                }
            }, finishTimer);
        } else {
            this.logMessage('debug', `playAttackAnimation: 没有Animation组件，使用动画帧方式（在updateAttackAnimation中处理）`);
        }
        this.logMessage('debug', `playAttackAnimation: ========== 完成 ==========`);
    }

    // 播放被攻击动画
    playHitAnimation() {
        if (this.isPlayingDeathAnimation || this.isDestroyed) {
            return;
        }

        this.stopAllAnimations();
        this.isPlayingHitAnimation = true;
        this.isHit = true; // 设置被攻击标志
        this.animationTimer = 0;
        this.currentAnimationFrameIndex = -1;
        
        // 立即播放第一帧
        if (this.hitAnimationFrames.length > 0 && this.hitAnimationFrames[0] && this.sprite) {
            this.sprite.spriteFrame = this.hitAnimationFrames[0];
            this.currentAnimationFrameIndex = 0;
        }
    }

    // 播放死亡动画
    playDeathAnimation() {
        if (this.isPlayingDeathAnimation) {
            return;
        }

        this.stopAllAnimations();
        this.isPlayingDeathAnimation = true;
        this.animationTimer = 0;
        this.currentAnimationFrameIndex = -1;
    }

    // 停止所有动画
    stopAllAnimations() {
        const beforeState = {
            isPlayingIdleAnimation: this.isPlayingIdleAnimation,
            isPlayingWalkAnimation: this.isPlayingWalkAnimation,
            isPlayingAttackAnimation: this.isPlayingAttackAnimation,
            isPlayingHitAnimation: this.isPlayingHitAnimation
        };
        
        this.isPlayingIdleAnimation = false;
        this.isPlayingWalkAnimation = false;
        this.isPlayingAttackAnimation = false;
        this.isPlayingHitAnimation = false;
        // 不停止死亡动画
        this.isHit = false; // 清除被攻击标志
        this.attackComplete = false; // 重置攻击完成标志
        
        this.logMessage('debug', `stopAllAnimations: 停止前状态: idle=${beforeState.isPlayingIdleAnimation}, walk=${beforeState.isPlayingWalkAnimation}, attack=${beforeState.isPlayingAttackAnimation}, hit=${beforeState.isPlayingHitAnimation}`);
        this.logMessage('debug', `stopAllAnimations: 停止后状态: idle=${this.isPlayingIdleAnimation}, walk=${this.isPlayingWalkAnimation}, attack=${this.isPlayingAttackAnimation}, hit=${this.isPlayingHitAnimation}`);
    }

    // 恢复默认精灵帧
    restoreDefaultSprite() {
        if (this.sprite && this.defaultSpriteFrame) {
            this.sprite.spriteFrame = this.defaultSpriteFrame;
        }
    }

    protected attack() {
        this.logMessage('debug', `attack: ========== 开始攻击 ==========`);
        this.logMessage('debug', `attack: currentTarget=${this.currentTarget ? '存在' : 'null'}, isDestroyed=${this.isDestroyed}, isPlayingAttackAnimation=${this.isPlayingAttackAnimation}`);
        
        if (!this.currentTarget || this.isDestroyed) {
            this.logMessage('debug', `attack: 没有目标或已销毁，退出攻击`);
            return;
        }

        // 再次检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.logMessage('debug', `attack: 目标无效或未激活，清除目标`);
            this.currentTarget = null!;
            return;
        }

        const targetPos = this.currentTarget.worldPosition;
        const enemyPos = this.node.worldPosition;
        const distance = Vec3.distance(enemyPos, targetPos);
        const targetType = this.currentTarget.getComponent('StoneWall') ? '石墙' : 
                          this.currentTarget.getComponent('Crystal') ? '水晶' : '其他';
        this.logMessage('debug', `attack: 目标${targetType}有效，位置=(${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)}), 敌人位置=(${enemyPos.x.toFixed(1)}, ${enemyPos.y.toFixed(1)}), 距离=${distance.toFixed(1)}, 攻击范围=${this.attackRange}, 伤害=${this.attackDamage}`);

        // 检查距离是否在攻击范围内
        if (distance > this.attackRange) {
            this.logMessage('warn', `attack: ❌ 目标不在攻击范围内（距离=${distance.toFixed(1)}, 攻击范围=${this.attackRange}），不执行攻击，停止攻击动画`);
            // 如果正在播放攻击动画，停止攻击动画
            if (this.isPlayingAttackAnimation) {
                this.logMessage('warn', `attack: 正在播放攻击动画，停止攻击动画`);
                this.isPlayingAttackAnimation = false;
                this.attackComplete = false;
            }
            this.logMessage('debug', `attack: ========== 退出攻击（距离超出） ==========`);
            return;
        }

        this.logMessage('debug', `attack: ✅ 距离检查通过，准备攻击`);

        // 攻击时朝向目标方向
        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        this.flipDirection(direction);

        // 播放攻击动画（使用动画帧，在updateAttackAnimation中造成伤害）
        this.logMessage('debug', `attack: 调用playAttackAnimation，距离=${distance.toFixed(1)}, 攻击范围=${this.attackRange}`);
        this.playAttackAnimation();
        this.logMessage('debug', `attack: ========== 攻击完成 ==========`);
    }
    
    /**
     * 处理实际伤害（在攻击动画中途调用）
     */
    protected dealDamage() {
        this.logMessage('debug', `dealDamage: ========== 被调用 ==========`);
        this.logMessage('debug', `dealDamage: currentTarget=${this.currentTarget ? '存在' : 'null'}, isValid=${this.currentTarget ? this.currentTarget.isValid : 'N/A'}, active=${this.currentTarget ? this.currentTarget.active : 'N/A'}`);
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
            this.logMessage('warn', `dealDamage: 目标无效，清除目标`);
            this.currentTarget = null!;
            return;
        }

        // 检查距离是否在攻击范围内
        const targetPos = this.currentTarget.worldPosition;
        const enemyPos = this.node.worldPosition;
        const distance = Vec3.distance(enemyPos, targetPos);
        if (distance > this.attackRange) {
            this.logMessage('debug', `[Enemy] dealDamage: 目标不在攻击范围内（距离=${distance.toFixed(1)}, 攻击范围=${this.attackRange}），不造成伤害`);
            // 停止攻击动画
            this.isPlayingAttackAnimation = false;
            this.attackComplete = false;
            this.playIdleAnimation();
            return;
        }

        const towerScript = this.currentTarget.getComponent('Arrower') as any;
        const warAncientTreeScript = this.currentTarget.getComponent('WarAncientTree') as any;
        const normalTreeScript = this.currentTarget.getComponent('Tree') as any;
        const wellScript = this.currentTarget.getComponent('MoonWell') as any;
        const hallScript = this.currentTarget.getComponent('HunterHall') as any;
        const swordsmanHallScript = this.currentTarget.getComponent('SwordsmanHall') as any;
        const churchScript = this.currentTarget.getComponent('Church') as any;
        const priestScript = this.currentTarget.getComponent('Priest') as any;
        const crystalScript = this.currentTarget.getComponent('Crystal') as any;
        const wispScript = this.currentTarget.getComponent('Wisp') as any;
        const hunterScript = this.currentTarget.getComponent('Hunter') as any;
        const elfSwordsmanScript = this.currentTarget.getComponent('ElfSwordsman') as any;
        const stoneWallScript = this.currentTarget.getComponent('StoneWall') as any;
        const targetScript = towerScript || warAncientTreeScript || normalTreeScript || wellScript || hallScript || swordsmanHallScript || churchScript || priestScript || crystalScript || wispScript || hunterScript || elfSwordsmanScript || stoneWallScript;
        
        if (targetScript && targetScript.takeDamage) {
            this.logMessage('debug', `dealDamage: 调用takeDamage，伤害=${this.attackDamage}，目标类型=${targetScript.constructor.name}`);
            targetScript.takeDamage(this.attackDamage);
            this.logMessage('debug', `dealDamage: 造成伤害 ${this.attackDamage}，目标类型=${targetScript.constructor.name}`);
            
            // 检查目标是否仍然存活，特别是石墙
            if (targetScript && targetScript.isAlive && !targetScript.isAlive()) {
                const wasStoneWall = !!stoneWallScript;
                this.logMessage('debug', `dealDamage: 目标被摧毁，wasStoneWall=${wasStoneWall}`);
                this.currentTarget = null!;
                // 清除绕行目标点，重新计算路径
                this.detourTarget = null;
                
                // 清除缺口标记
                this.topLayerGapTarget = null;
                
                // 如果摧毁的是石墙，检查是否需要重新进入网格寻路模式
                if (wasStoneWall) {
                    this.logMessage('debug', `dealDamage: 石墙被摧毁，重新规划路径`);
                    // 重置攻击动画状态，让下一帧自动切换到移动动画
                    if (this.isPlayingAttackAnimation) {
                        this.logMessage('debug', `dealDamage: 石墙被摧毁，重置攻击动画状态，下一帧将切换到移动动画`);
                        this.isPlayingAttackAnimation = false;
                        this.attackComplete = false;
                        // 停止所有动画，让下一帧的移动逻辑自动切换到移动动画
                        this.stopAllAnimations();
                    }
                    // 如果正在网格内寻路，重新规划路径
                    if (this.isInStoneWallGrid) {
                        this.replanGridPath();
                    } else {
                        // 清除网格寻路状态，下一帧会重新检查是否需要进入网格寻路模式
                        this.isInStoneWallGrid = false;
                        this.gridPath = [];
                        this.currentPathIndex = 0;
                    }
                }
            }
        } else {
            // 目标无效，清除目标
            this.currentTarget = null!;
        }
    }

    takeDamage(damage: number) {
        if (this.isDestroyed) {
            return;
        }

        // 显示伤害数字
        this.showDamageNumber(damage);
        
        // 被攻击时停止移动
        this.stopMoving();
        
        // 播放受击动画
        this.playHitAnimation();

        this.currentHealth -= damage;

        // 更新血条
        if (this.healthBar) {
            this.healthBar.setHealth(this.currentHealth);
        }

        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.die();
        }
    }

    // 恢复移动
    resumeMovement() {
        // 清除被攻击标志
        this.isHit = false;
        
        // 如果敌人还活着，并且没有其他动画在播放，恢复移动
        if (!this.isDestroyed && !this.isPlayingAttackAnimation && !this.isPlayingDeathAnimation) {
            // 如果有当前目标，向目标移动
            if (this.currentTarget) {
                const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
                if (distance > this.attackRange) {
                    this.playWalkAnimation();
                } else {
                    this.playIdleAnimation();
                }
            } else if (this.targetCrystal && this.targetCrystal.isValid) {
                // 没有当前目标，向水晶移动
                const distance = Vec3.distance(this.node.worldPosition, this.targetCrystal.worldPosition);
                if (distance > this.attackRange) {
                    this.playWalkAnimation();
                } else {
                    this.playIdleAnimation();
                }
            } else {
                this.playIdleAnimation();
            }
        }
    }

    showDamageNumber(damage: number) {
        // 创建伤害数字节点
        let damageNode: Node;
        if (this.damageNumberPrefab) {
            damageNode = instantiate(this.damageNumberPrefab);
        } else {
            // 如果没有预制体，创建简单的Label节点
            damageNode = new Node('DamageNumber');
            const label = damageNode.addComponent(Label);
            label.string = `-${Math.floor(damage)}`;
            label.fontSize = 20;
            label.color = Color.WHITE;
        }
        
        // 添加到Canvas或场景
        const canvas = find('Canvas');
        if (canvas) {
            damageNode.setParent(canvas);
        } else {
            damageNode.setParent(this.node.scene);
        }
        
        // 设置位置（在敌人上方）
        damageNode.setWorldPosition(this.node.worldPosition.clone().add3f(0, 30, 0));
        
        // 如果有DamageNumber组件，设置伤害值
        const damageScript = damageNode.getComponent(DamageNumber);
        if (damageScript) {
            damageScript.setDamage(damage);
        } else {
            // 如果没有组件，手动添加动画
            const label = damageNode.getComponent(Label);
            if (label) {
                const startPos = damageNode.position.clone();
                const endPos = startPos.clone();
                endPos.y += 50;
                
                tween(damageNode)
                    .to(1.0, { position: endPos })
                    .parallel(
                        tween().to(1.0, {}, {
                            onUpdate: (target, ratio) => {
                                const color = label.color.clone();
                                color.a = 255 * (1 - ratio);
                                label.color = color;
                            }
                        })
                    )
                    .call(() => {
                        if (damageNode && damageNode.isValid) {
                            damageNode.destroy();
                        }
                    })
                    .start();
            }
        }
    }

    die() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;
        
        // 立即停止所有移动和动画
        this.stopAllAnimations();
        
        // 移除绕行点标记
        
        
        // 奖励金币
        if (!this.gameManager) {
            this.findGameManager();
        }
        if (this.gameManager) {
            this.gameManager.addGold(this.goldReward);
            console.debug(`Enemy: Died, rewarded ${this.goldReward} gold`);
        }

        // 销毁血条节点
        if (this.healthBarNode && this.healthBarNode.isValid) {
            this.healthBarNode.destroy();
        }

        // 播放死亡音效
        if (this.deathSound) {
            AudioManager.Instance.playSFX(this.deathSound);
        }

        // 优先播放死亡动画
        this.playDeathAnimation();

        // 如果有死亡动画帧，等待动画播放完成后销毁
        if (this.deathAnimationFrames.length > 0) {
            // 延迟销毁，等待死亡动画播放完成
            setTimeout(() => {
                if (this.node && this.node.isValid) {
                    this.node.destroy();
                }
            }, this.deathAnimationDuration * 1000);
        } else {
            // 如果没有死亡动画帧，使用原来的倒下和渐隐效果
            tween(this.node)
                .to(0.3, { angle: 90 })
                .call(() => {
                    // 渐隐消失
                    const sprite = this.node.getComponent(Sprite);
                    const startOpacity = sprite ? sprite.color.a : 255;
                    
                    tween(this.node)
                        .to(1.0, { 
                            position: this.node.position.clone().add3f(0, -20, 0)
                        })
                        .parallel(
                            tween().to(1.0, {}, {
                                onUpdate: (target, ratio) => {
                                    if (sprite && this.node && this.node.isValid) {
                                        const color = sprite.color.clone();
                                        color.a = startOpacity * (1 - ratio);
                                        sprite.color = color;
                                    }
                                }
                            })
                        )
                        .call(() => {
                            // 确保节点被真正销毁
                            if (this.node && this.node.isValid) {
                                this.node.destroy();
                            }
                        })
                        .start();
                })
                .start();
        }
    }

    getHealth(): number {
        return this.currentHealth;
    }

    isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }

    /**
     * 查找石墙网格面板组件
     */
    private findStoneWallGridPanel() {
        if (this.stoneWallGridPanelComponent) {
            return;
        }

        // 方法1: 通过节点名称查找
        let gridPanelNode = find('StoneWallGridPanel');
        if (gridPanelNode) {
            this.stoneWallGridPanelComponent = gridPanelNode.getComponent(StoneWallGridPanel);
            if (this.stoneWallGridPanelComponent) {
                return;
            }
        }

        // 方法2: 从场景根节点递归查找
        const scene = this.node.scene;
        if (scene) {
            const findInScene = (node: Node, componentType: any): any => {
                const comp = node.getComponent(componentType);
                if (comp) return comp;
                for (const child of node.children) {
                    const found = findInScene(child, componentType);
                    if (found) return found;
                }
                return null;
            };
            this.stoneWallGridPanelComponent = findInScene(scene, StoneWallGridPanel);
        }
    }

    /**
     * 检查石墙网格是否在敌人下方
     */
    private checkStoneWallGridBelowEnemy(): boolean {
        this.findStoneWallGridPanel();
        
        if (!this.stoneWallGridPanelComponent) {
            console.debug(`[Enemy] checkStoneWallGridBelowEnemy: 石墙网格面板组件不存在`);
            return false;
        }

        const enemyPos = this.node.worldPosition;
        
        // 首先检查敌人当前所在的网格坐标
        const grid = this.stoneWallGridPanelComponent.worldToGrid(enemyPos);
        
        console.debug(`[Enemy] checkStoneWallGridBelowEnemy: 敌人位置(${enemyPos.x.toFixed(1)}, ${enemyPos.y.toFixed(1)}), 网格坐标=${grid ? `(${grid.x}, ${grid.y})` : 'null'}`);
        
        // 如果敌人已经在最底层（gridY=0或更小），不需要再进入网格寻路模式
        if (grid && grid.y <= 0) {
            console.debug(`[Enemy] checkStoneWallGridBelowEnemy: 敌人已在最底层（gridY=${grid.y}），不需要进入网格寻路模式`);
            return false;
        }
        
        // 如果敌人不在网格内，但y坐标已经小于等于最底层（约500），也不需要进入网格寻路模式
        // 网格范围：y:500-1000，x:0-750
        const gridMinY = 500; // 最底层（gridY=0）的y坐标
        if (!grid && enemyPos.y <= gridMinY) {
            console.debug(`[Enemy] checkStoneWallGridBelowEnemy: 敌人不在网格内但y坐标(${enemyPos.y.toFixed(1)})已低于最底层(${gridMinY})，不需要进入网格寻路模式`);
            return false;
        }
        
        // 网格高度：10格 * 50 = 500像素
        const gridMaxY = 1000; // 最上层（gridY=9）的y坐标
        const gridMinX = 0;
        const gridMaxX = 750;

        // 检查敌人是否在网格上方或网格范围内
        // 如果敌人y坐标 >= 网格顶部y坐标（gridMaxY），说明网格在敌人下方
        // 或者敌人y坐标在网格范围内，且还没有到达最底层（gridY=0）
        if (enemyPos.x >= gridMinX - 50 && enemyPos.x <= gridMaxX + 50) {
            // x坐标在网格x范围内（允许一些容差）
            if (enemyPos.y >= gridMinY - 50 && enemyPos.y <= gridMaxY + 50) {
                // 敌人在网格上方或网格范围内
                // 再次检查网格坐标，确保判断准确（因为y坐标可能有误差）
                const gridInCheck = this.stoneWallGridPanelComponent.worldToGrid(enemyPos);
                if (gridInCheck && gridInCheck.y <= 0) {
                    // 敌人已经在最底层，不需要进入网格寻路模式
                    console.debug(`[Enemy] checkStoneWallGridBelowEnemy: 敌人已在最底层（gridY=${gridInCheck.y}），不需要进入网格寻路模式`);
                    return false;
                }
                
                // 如果敌人还没有到达最底层（gridY=0，即y约500），需要进入网格寻路
                if (enemyPos.y > gridMinY + 25) { // 25是半个格子的容差
                    console.debug(`[Enemy] checkStoneWallGridBelowEnemy: ✅ 需要进入网格寻路模式（敌人在网格范围内，y=${enemyPos.y.toFixed(1)} > ${gridMinY + 25}）`);
                    return true;
                } else {
                    console.debug(`[Enemy] checkStoneWallGridBelowEnemy: 敌人y坐标(${enemyPos.y.toFixed(1)})已接近或低于最底层(${gridMinY + 25})，不需要进入网格寻路模式`);
                }
            }
        }

        console.debug(`[Enemy] checkStoneWallGridBelowEnemy: ❌ 不需要进入网格寻路模式`);
        return false;
    }

    /**
     * 检查敌人是否在网格上方
     */
    private checkEnemyAboveGrid(): boolean {
        this.findStoneWallGridPanel();
        
        if (!this.stoneWallGridPanelComponent) {
            console.debug(`[Enemy] checkEnemyAboveGrid: 石墙网格面板组件不存在`);
            return false;
        }

        const enemyPos = this.node.worldPosition;
        const gridMaxY = 1000; // 最上层（gridY=9）的y坐标
        const gridMinX = 0;
        const gridMaxX = 750;

        // 检查敌人是否在网格上方（y坐标 > gridMaxY），且在网格x范围内
        const isAbove = enemyPos.y > gridMaxY && enemyPos.x >= gridMinX - 50 && enemyPos.x <= gridMaxX + 50;
        console.debug(`[Enemy] checkEnemyAboveGrid: 敌人位置(${enemyPos.x.toFixed(1)}, ${enemyPos.y.toFixed(1)}), 网格顶部y=${gridMaxY}, 是否在网格上方=${isAbove}`);
        
        return isAbove;
    }

    /**
     * 找到网格最上层的缺口
     */
    private findGapInTopLayer(): Vec3 | null {
        this.findStoneWallGridPanel();
        
        if (!this.stoneWallGridPanelComponent) {
            this.logMessage('debug', `[Enemy] findGapInTopLayer: 石墙网格面板组件不存在`);
            return null;
        }

        const enemyPos = this.node.worldPosition;
        const gridWidth = this.stoneWallGridPanelComponent.gridWidth;
        const gridHeight = this.stoneWallGridPanelComponent.gridHeight;
        const topLayerY = gridHeight - 1; // 最上层（gridY从0开始，所以是gridHeight-1）

        console.debug(`[Enemy] findGapInTopLayer: 开始在网格最上层(gridY=${topLayerY})查找缺口，敌人位置(${enemyPos.x.toFixed(1)}, ${enemyPos.y.toFixed(1)})，网格尺寸=${gridWidth}x${gridHeight}`);

        // 将敌人的x坐标转换为网格坐标（使用网格最上层对应的y坐标）
        // 先尝试使用敌人的x坐标找到对应的网格列
        let startX = 0;
        let bestGap: Vec3 | null = null;
        let minDistance = Infinity;

        // 创建一个测试位置，y坐标使用网格最上层的y坐标
        // 我们需要知道网格最上层的世界y坐标，可以通过将gridY=topLayerY转换为世界坐标来获取
        const testGridPos = this.stoneWallGridPanelComponent.gridToWorld(0, topLayerY);
        if (!testGridPos) {
            this.logMessage('debug', `[Enemy] findGapInTopLayer: 无法获取网格最上层世界坐标`);
            return null;
        }
        
        // 使用敌人的x坐标找到对应的网格列
        const testWorldPos = new Vec3(enemyPos.x, testGridPos.y, 0);
        const enemyGrid = this.stoneWallGridPanelComponent.worldToGrid(testWorldPos);
        
        if (enemyGrid && enemyGrid.y === topLayerY) {
            startX = enemyGrid.x;
            console.debug(`[Enemy] findGapInTopLayer: 敌人对应的网格列x=${startX}`);
        } else {
            // 如果无法转换，使用粗略计算（假设网格从x=0开始，每格50像素）
            startX = Math.max(0, Math.min(gridWidth - 1, Math.floor((enemyPos.x - this.stoneWallGridPanelComponent.node.worldPosition.x + (gridWidth * 50) / 2) / 50)));
            console.debug(`[Enemy] findGapInTopLayer: 使用粗略计算得到网格列x=${startX}`);
        }

        // 从敌人位置向左右两侧搜索最近的缺口
        // 优先选择距离敌人最近的缺口
        for (let offset = 0; offset < gridWidth; offset++) {
            // 同时检查右侧和左侧，选择距离更近的
            const checkXs = [];
            if (offset === 0) {
                // 先检查正下方
                checkXs.push(startX);
            } else {
                // 检查左右两侧
                checkXs.push(startX + offset); // 右侧
                checkXs.push(startX - offset); // 左侧
            }

            for (const x of checkXs) {
                if (x >= 0 && x < gridWidth) {
                    // 检查网格是否被占用
                    if (!this.stoneWallGridPanelComponent.isGridOccupied(x, topLayerY)) {
                        // 进一步验证：检查该位置是否真的有石墙节点（即使占用状态可能不正确）
                        const worldPos = this.stoneWallGridPanelComponent.gridToWorld(x, topLayerY);
                        if (worldPos) {
                            // 检查该位置附近是否有石墙节点（通过搜索场景中的石墙节点）
                            const hasStoneWallAtPosition = this.checkStoneWallAtPosition(worldPos);
                            if (!hasStoneWallAtPosition) {
                                // 计算到敌人的距离（仅考虑x方向，因为敌人是在上方）
                                const distanceX = Math.abs(worldPos.x - enemyPos.x);
                                if (distanceX < minDistance) {
                                    minDistance = distanceX;
                                    bestGap = worldPos;
                                    console.debug(`[Enemy] findGapInTopLayer: 找到潜在缺口 (gridX=${x}, gridY=${topLayerY})，世界坐标(${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})，x方向距离=${distanceX.toFixed(1)}`);
                                }
                            } else {
                                console.debug(`[Enemy] findGapInTopLayer: (gridX=${x}, gridY=${topLayerY}) 位置检测到实际存在石墙，跳过`);
                            }
                        }
                    } else {
                        console.debug(`[Enemy] findGapInTopLayer: (gridX=${x}, gridY=${topLayerY}) 网格状态显示被占用`);
                    }
                }
            }

            // 如果已经找到正下方的缺口，直接返回
            if (offset === 0 && bestGap) {
                console.debug(`[Enemy] findGapInTopLayer: ✅ 在敌人正下方找到缺口 (gridX=${startX}, gridY=${topLayerY}) -> 世界坐标(${bestGap.x.toFixed(1)}, ${bestGap.y.toFixed(1)})`);
                return bestGap;
            }
        }

        if (bestGap) {
            console.debug(`[Enemy] findGapInTopLayer: ✅ 找到最佳缺口：世界坐标(${bestGap.x.toFixed(1)}, ${bestGap.y.toFixed(1)})，x方向距离=${minDistance.toFixed(1)}`);
        } else {
            console.debug(`[Enemy] findGapInTopLayer: ❌ 未找到缺口，最上层所有格子都被占用`);
        }
        
        return bestGap;
    }


    /**
     * 检查当前网格路径是否仍然有效（路径上的点是否被石墙占用）
     */
    private checkGridPathValid(): boolean {
        if (!this.gridPath || this.gridPath.length === 0 || !this.stoneWallGridPanelComponent) {
            return false;
        }

        // 检查当前路径点和未来路径点是否被石墙占用
        for (let i = this.currentPathIndex; i < this.gridPath.length; i++) {
            const pathPoint = this.gridPath[i];
            const grid = this.stoneWallGridPanelComponent.worldToGrid(pathPoint);
            if (grid) {
                // 检查网格是否被占用
                if (this.stoneWallGridPanelComponent.isGridOccupied(grid.x, grid.y)) {
                    console.debug(`[Enemy] checkGridPathValid: 路径点[${i}] (gridX=${grid.x}, gridY=${grid.y}) 被占用，路径无效`);
                    return false;
                }
                
                // 进一步验证实际是否有石墙节点
                if (this.checkStoneWallAtPosition(pathPoint)) {
                    console.debug(`[Enemy] checkGridPathValid: 路径点[${i}] (gridX=${grid.x}, gridY=${grid.y}) 检测到实际石墙，路径无效`);
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * 重新规划网格路径（当石墙被摧毁或放置时调用）
     */
    private replanGridPath() {
        if (!this.isInStoneWallGrid) {
            console.debug('[Enemy] replanGridPath: 敌人不在网格寻路模式，无需重新规划');
            return;
        }

        console.debug('[Enemy] replanGridPath: 开始重新规划网格路径');
        
        // 重新计算路径
        const path = this.findPathInStoneWallGrid();
        if (path && path.length > 0) {
            this.gridPath = path;
            this.currentPathIndex = 0;
            console.debug(`[Enemy] replanGridPath: ✅ 重新规划成功，新路径包含 ${path.length} 个路径点`);
        } else {
            // 无路可走，退出网格寻路模式
            this.logMessage('debug', '[Enemy] replanGridPath: ❌ 重新规划失败，无路可走，退出网格寻路模式');
            this.isInStoneWallGrid = false;
            this.gridPath = [];
            this.currentPathIndex = 0;
            
            // 尝试攻击最近的石墙
            const nearestWall = this.findNearestStoneWall();
            if (nearestWall) {
                this.currentTarget = nearestWall;
                console.debug('[Enemy] replanGridPath: 设置为攻击最近的石墙');
            }
        }
    }

    /**
     * A*寻路算法节点
     */
    private createAStarNode(x: number, y: number): { x: number; y: number; g: number; h: number; f: number; parent: any } {
        return {
            x: x,
            y: y,
            g: 0,
            h: 0,
            f: 0,
            parent: null
        };
    }

    /**
     * 在网格中使用A*算法寻路到最底层
     */
    private findPathInStoneWallGrid(): Vec3[] | null {
        this.findStoneWallGridPanel();
        
        if (!this.stoneWallGridPanelComponent) {
            console.debug(`[Enemy] findPathInStoneWallGrid: 石墙网格面板组件不存在`);
            return null;
        }

        const enemyPos = this.node.worldPosition;
        const grid = this.stoneWallGridPanelComponent.worldToGrid(enemyPos);
        
        console.debug(`[Enemy] findPathInStoneWallGrid: 开始寻路，敌人位置(${enemyPos.x.toFixed(1)}, ${enemyPos.y.toFixed(1)}), 网格坐标=${grid ? `(${grid.x}, ${grid.y})` : 'null'}`);
        
        // 如果敌人不在网格内，尝试找到最近的网格入口点
        let startGrid: { x: number; y: number } | null = grid;
        if (!startGrid) {
            // 敌人不在网格内，找到最近的网格点作为起点
            // 计算敌人到网格的距离，找到最近的网格边界点
            const gridMinX = 0;
            const gridMaxX = 750;
            const gridMinY = 500;
            const gridMaxY = 1000;
            
            let nearestX = Math.max(gridMinX, Math.min(gridMaxX, enemyPos.x));
            let nearestY = Math.max(gridMinY, Math.min(gridMaxY, enemyPos.y));
            
            // 如果敌人在网格上方，从网格顶部进入
            if (enemyPos.y > gridMaxY) {
                nearestY = gridMaxY;
            }
            
            const nearestWorldPos = new Vec3(nearestX, nearestY, 0);
            startGrid = this.stoneWallGridPanelComponent.worldToGrid(nearestWorldPos);
            if (!startGrid) {
                console.debug(`[Enemy] findPathInStoneWallGrid: ❌ 无法找到起始网格点`);
                return null;
            }
            console.debug(`[Enemy] findPathInStoneWallGrid: 敌人不在网格内，使用最近网格点作为起点 (gridX=${startGrid.x}, gridY=${startGrid.y})`);
        }

        // 使用A*算法寻路到最底层（gridY=0）
        console.debug(`[Enemy] findPathInStoneWallGrid: 开始A*寻路，起点 (gridX=${startGrid.x}, gridY=${startGrid.y}) -> 目标层 (gridY=0)`);
        const path = this.findPathToBottomLayerAStar(startGrid.x, startGrid.y);
        
        if (!path || path.length === 0) {
            console.debug(`[Enemy] findPathInStoneWallGrid: ❌ A*寻路失败，无法找到路径`);
            return null;
        }

        console.debug(`[Enemy] findPathInStoneWallGrid: ✅ A*寻路成功，找到 ${path.length} 个路径点`);
        
        // 将网格坐标路径转换为世界坐标
        const worldPath: Vec3[] = [];
        for (let i = 0; i < path.length; i++) {
            const gridPos = path[i];
            const worldPos = this.stoneWallGridPanelComponent.gridToWorld(gridPos.x, gridPos.y);
            if (worldPos) {
                worldPath.push(worldPos);
                console.debug(`[Enemy] findPathInStoneWallGrid: 路径点[${i}] (gridX=${gridPos.x}, gridY=${gridPos.y}) -> 世界坐标(${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})`);
            }
        }

        console.debug(`[Enemy] findPathInStoneWallGrid: ✅ 路径转换完成，共 ${worldPath.length} 个世界坐标点`);
        return worldPath;
    }

    /**
     * A*寻路核心算法：寻找从起点到最底层（gridY=0）的路径
     */
    private findPathToBottomLayerAStar(startX: number, startY: number): { x: number; y: number }[] | null {
        if (!this.stoneWallGridPanelComponent) {
            return null;
        }

        // 从组件获取网格尺寸，而不是硬编码
        const gridWidth = this.stoneWallGridPanelComponent.gridWidth;
        const gridHeight = this.stoneWallGridPanelComponent.gridHeight;
        const targetY = 0; // 最底层
        
        console.debug(`[Enemy] findPathToBottomLayerAStar: 开始A*寻路，网格尺寸=${gridWidth}x${gridHeight}，起点(${startX}, ${startY}) -> 目标层(gridY=${targetY})`);

        // 如果起点已经在最底层，直接返回
        if (startY <= targetY) {
            return [{ x: startX, y: targetY }];
        }

        // A*算法实现
        const openList: Array<{ x: number; y: number; g: number; h: number; f: number; parent: any }> = [];
        const closedList: Set<string> = new Set();
        
        const startNode = this.createAStarNode(startX, startY);
        startNode.g = 0;
        startNode.h = Math.abs(startY - targetY); // 启发式：到最底层的距离
        startNode.f = startNode.g + startNode.h;
        openList.push(startNode);

        // 四个方向的移动（上下左右）
        const directions = [
            { x: 0, y: -1 }, // 向下（朝向gridY=0）
            { x: -1, y: 0 }, // 向左
            { x: 1, y: 0 },  // 向右
            { x: 0, y: 1 }   // 向上（远离gridY=0，优先级最低）
        ];

        while (openList.length > 0) {
            // 找到f值最小的节点
            let currentNodeIndex = 0;
            for (let i = 1; i < openList.length; i++) {
                if (openList[i].f < openList[currentNodeIndex].f) {
                    currentNodeIndex = i;
                }
            }

            const currentNode = openList.splice(currentNodeIndex, 1)[0];
            const nodeKey = `${currentNode.x},${currentNode.y}`;
            closedList.add(nodeKey);

            // 检查是否到达目标层
            if (currentNode.y <= targetY) {
                // 重构路径
                const path: { x: number; y: number }[] = [];
                let node: any = currentNode;
                while (node) {
                    path.unshift({ x: node.x, y: node.y });
                    node = node.parent;
                }
                return path;
            }

            // 检查相邻节点
            for (const dir of directions) {
                const newX = currentNode.x + dir.x;
                const newY = currentNode.y + dir.y;

                // 检查边界
                if (newX < 0 || newX >= gridWidth || newY < 0 || newY >= gridHeight) {
                    continue;
                }

                // 检查是否已访问
                const newKey = `${newX},${newY}`;
                if (closedList.has(newKey)) {
                    continue;
                }

                // 检查该格子是否被石墙占用（同时检查网格状态和实际石墙节点）
                const isOccupied = this.stoneWallGridPanelComponent.isGridOccupied(newX, newY);
                if (isOccupied) {
                    // 网格状态显示被占用，跳过
                    continue;
                }
                
                // 进一步验证：检查该位置是否真的有石墙节点（即使占用状态可能不正确）
                const worldPos = this.stoneWallGridPanelComponent.gridToWorld(newX, newY);
                if (worldPos && this.checkStoneWallAtPosition(worldPos)) {
                    // 实际检测到石墙节点，跳过该格子
                    console.debug(`[Enemy] findPathToBottomLayerAStar: 格子(gridX=${newX}, gridY=${newY})检测到实际石墙，跳过`);
                    continue;
                }

                // 计算代价
                const moveCost = 1; // 每个格子的移动代价为1
                const newG = currentNode.g + moveCost;
                const newH = Math.abs(newY - targetY); // 到目标层的距离
                const newF = newG + newH;

                // 检查openList中是否已有该节点
                let existingNode = openList.find(n => n.x === newX && n.y === newY);
                if (existingNode) {
                    // 如果新路径更好，更新节点
                    if (newF < existingNode.f) {
                        existingNode.g = newG;
                        existingNode.h = newH;
                        existingNode.f = newF;
                        existingNode.parent = currentNode;
                    }
                } else {
                    // 添加新节点到openList
                    const newNode = this.createAStarNode(newX, newY);
                    newNode.g = newG;
                    newNode.h = newH;
                    newNode.f = newF;
                    newNode.parent = currentNode;
                    openList.push(newNode);
                }
            }
        }

        // 无法找到路径
        return null;
    }


    /**
     * 在网格内或网格上方检测我方单位（弓箭手、女猎手、剑士），如果路径畅通则返回单位
     * @returns 如果找到可攻击的我方单位且路径畅通，返回单位节点；否则返回null
     */
    private checkForFriendlyUnitInGrid(): Node | null {
        const enemyPos = this.node.worldPosition;
        const detectionRange = 200; // 索敌范围：200像素

        // 使用递归查找容器节点
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

        let nearestUnit: Node | null = null;
        let minDistance = Infinity;

        // 1. 查找弓箭手
        let towersNode = find('Towers');
        if (!towersNode && this.node.scene) {
            towersNode = findNodeRecursive(this.node.scene, 'Towers');
        }
        if (towersNode) {
            const towers = towersNode.children;
            for (const tower of towers) {
                if (tower && tower.active && tower.isValid) {
                    const towerScript = tower.getComponent('Arrower') as any;
                    if (towerScript && towerScript.isAlive && towerScript.isAlive()) {
                        const distance = Vec3.distance(enemyPos, tower.worldPosition);
                        if (distance <= detectionRange && distance < minDistance) {
                            // 检查路径是否被石墙阻挡
                            if (!this.isPathBlockedByStoneWall(enemyPos, tower.worldPosition)) {
                                nearestUnit = tower;
                                minDistance = distance;
                            }
                        }
                    }
                }
            }
        }

        // 2. 查找女猎手
        let huntersNode = find('Hunters');
        if (!huntersNode && this.node.scene) {
            huntersNode = findNodeRecursive(this.node.scene, 'Hunters');
        }
        if (huntersNode) {
            const hunters = huntersNode.children;
            for (const hunter of hunters) {
                if (hunter && hunter.active && hunter.isValid) {
                    const hunterScript = hunter.getComponent('Hunter') as any;
                    if (hunterScript && hunterScript.isAlive && hunterScript.isAlive()) {
                        const distance = Vec3.distance(enemyPos, hunter.worldPosition);
                        if (distance <= detectionRange && distance < minDistance) {
                            // 检查路径是否被石墙阻挡
                            if (!this.isPathBlockedByStoneWall(enemyPos, hunter.worldPosition)) {
                                nearestUnit = hunter;
                                minDistance = distance;
                            }
                        }
                    }
                }
            }
        }

        // 3. 查找精灵剑士
        let swordsmenNode = find('ElfSwordsmans');
        if (!swordsmenNode && this.node.scene) {
            swordsmenNode = findNodeRecursive(this.node.scene, 'ElfSwordsmans');
        }
        if (swordsmenNode) {
            const swordsmen = swordsmenNode.children;
            for (const swordsman of swordsmen) {
                if (swordsman && swordsman.active && swordsman.isValid) {
                    const swordsmanScript = swordsman.getComponent('ElfSwordsman') as any;
                    if (swordsmanScript && swordsmanScript.isAlive && swordsmanScript.isAlive()) {
                        const distance = Vec3.distance(enemyPos, swordsman.worldPosition);
                        if (distance <= detectionRange && distance < minDistance) {
                            // 检查路径是否被石墙阻挡
                            if (!this.isPathBlockedByStoneWall(enemyPos, swordsman.worldPosition)) {
                                nearestUnit = swordsman;
                                minDistance = distance;
                            }
                        }
                    }
                }
            }
        }

        if (nearestUnit) {
            console.debug(`[Enemy] checkForFriendlyUnitInGrid: 找到我方单位且路径畅通，距离: ${minDistance.toFixed(1)}`);
        }

        return nearestUnit;
    }

    /**
     * 检查从起点到终点的路径是否被石墙阻挡
     * @param startPos 起点位置
     * @param endPos 终点位置
     * @returns 如果路径被石墙阻挡返回true，否则返回false
     */
    private isPathBlockedByStoneWall(startPos: Vec3, endPos: Vec3): boolean {
        const direction = new Vec3();
        Vec3.subtract(direction, endPos, startPos);
        const distance = direction.length();

        if (distance < 0.1) {
            return false; // 距离太近，认为路径畅通
        }

        direction.normalize();

        // 使用递归查找所有石墙
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

        // 查找所有石墙
        let stoneWalls: Node[] = [];
        let stoneWallsNode = find('StoneWalls');
        if (!stoneWallsNode && this.node.scene) {
            stoneWallsNode = findNodeRecursive(this.node.scene, 'StoneWalls');
        }

        if (this.node.scene) {
            const findAllStoneWalls = (node: Node): Node[] => {
                const walls: Node[] = [];
                const wallScript = node.getComponent('StoneWall') as any;
                if (wallScript && node.active && node.isValid) {
                    walls.push(node);
                }
                for (const child of node.children) {
                    walls.push(...findAllStoneWalls(child));
                }
                return walls;
            };
            stoneWalls = findAllStoneWalls(this.node.scene);
        }

        // 过滤出有效的石墙
        stoneWalls = stoneWalls.filter(wall => {
            if (!wall || !wall.active || !wall.isValid) return false;
            const wallScript = wall.getComponent('StoneWall') as any;
            return wallScript && wallScript.isAlive && wallScript.isAlive();
        });

        // 检查路径上是否有石墙阻挡
        const checkSteps = Math.ceil(distance / 20); // 每20像素检查一次
        const enemyRadius = 20; // 敌人的碰撞半径

        for (let i = 0; i <= checkSteps; i++) {
            const t = i / checkSteps;
            const checkPos = new Vec3();
            Vec3.lerp(checkPos, startPos, endPos, t);

            // 检查这个位置附近是否有石墙
            for (const wall of stoneWalls) {
                const wallPos = wall.worldPosition;
                const wallScript = wall.getComponent('StoneWall') as any;
                const wallRadius = wallScript?.collisionRadius || 40;
                const distanceToWall = Vec3.distance(checkPos, wallPos);
                const minDistance = enemyRadius + wallRadius + 10; // 增加10像素的安全距离

                if (distanceToWall < minDistance) {
                    return true; // 路径被阻挡
                }
            }
        }

        return false; // 路径畅通
    }

    /**
     * 在网格内移动
     */
    private moveInStoneWallGrid(deltaTime: number) {
        // 如果正在播放攻击动画，停止攻击动画并切换到移动动画
        if (this.isPlayingAttackAnimation) {
            this.logMessage('debug', `moveInStoneWallGrid: 检测到正在播放攻击动画，停止攻击动画并切换到移动动画`);
            this.isPlayingAttackAnimation = false;
            this.attackComplete = false;
            this.stopAllAnimations();
        }
        
        // 优先检测我方单位（弓箭手、女猎手、剑士），如果路径畅通则优先攻击
        const friendlyUnit = this.checkForFriendlyUnitInGrid();
        if (friendlyUnit) {
            // 检测到我方单位且路径畅通，退出网格寻路模式，优先攻击我方单位
            console.debug(`[Enemy] moveInStoneWallGrid: 检测到我方单位且路径畅通，退出网格寻路模式，优先攻击`);
            this.isInStoneWallGrid = false;
            this.currentTarget = friendlyUnit;
            this.gridPath = [];
            this.currentPathIndex = 0;
            // 清除绕行目标点
            if (this.detourTarget) {
                this.detourTarget = null;
            }
            // 继续执行后续逻辑处理移动和攻击
            return;
        }

        // 定期检查路径是否仍然有效（每0.5秒检查一次，避免频繁检查）
        const checkInterval = 0.5;
        const now = Date.now() / 1000;
        if (!this.lastPathCheckTime) {
            this.lastPathCheckTime = now;
        }
        if (this.gridPath && this.gridPath.length > 0 && now - this.lastPathCheckTime >= checkInterval) {
            this.lastPathCheckTime = now;
            if (!this.checkGridPathValid()) {
                console.debug('[Enemy] moveInStoneWallGrid: 路径无效，重新规划路径');
                this.replanGridPath();
                // 如果重新规划后没有路径，继续执行后续逻辑
                if (!this.gridPath || this.gridPath.length === 0) {
                    return;
                }
            }
        }

        if (!this.gridPath || this.gridPath.length === 0) {
            // 没有路径，尝试重新寻路
            const newPath = this.findPathInStoneWallGrid();
            if (newPath && newPath.length > 0) {
                this.gridPath = newPath;
                this.currentPathIndex = 0;
            } else {
                // 无路可走，清除网格寻路状态，尝试攻击石墙
                this.isInStoneWallGrid = false;
                const nearestWall = this.findNearestStoneWall();
                if (nearestWall) {
                    this.currentTarget = nearestWall;
                    console.debug(`[Enemy] moveInStoneWallGrid: 无路可走，设置为攻击最近的石墙`);
                }
                return;
            }
        }

        // 检查是否已经到达最后一个路径点
        if (this.currentPathIndex >= this.gridPath.length) {
            // 已到达最底层，清除网格寻路状态
            this.isInStoneWallGrid = false;
            this.gridPath = [];
            this.currentPathIndex = 0;
            
            // 确认敌人确实在最底层
            const finalGrid = this.stoneWallGridPanelComponent?.worldToGrid(this.node.worldPosition);
            if (finalGrid && finalGrid.y <= 0) {
                console.debug(`[Enemy] moveInStoneWallGrid: ✅ 已到达最底层（gridY=${finalGrid.y}），退出网格寻路模式，敌人位置(${this.node.worldPosition.x.toFixed(1)}, ${this.node.worldPosition.y.toFixed(1)})`);
            } else {
                const finalGridInfo = finalGrid ? `gridY=${finalGrid.y}` : '不在网格内';
                console.debug(`[Enemy] moveInStoneWallGrid: ⚠️ 路径索引超出但可能未到达最底层（${finalGridInfo}），退出网格寻路模式，敌人位置(${this.node.worldPosition.x.toFixed(1)}, ${this.node.worldPosition.y.toFixed(1)})`);
            }
            return;
        }

        const targetPoint = this.gridPath[this.currentPathIndex];
        const enemyPos = this.node.worldPosition;
        const direction = new Vec3();
        Vec3.subtract(direction, targetPoint, enemyPos);
        const distance = direction.length();

        // 如果已经到达当前路径点
        if (distance < 10) { // 10像素的到达阈值
            const currentGrid = this.stoneWallGridPanelComponent?.worldToGrid(this.node.worldPosition);
            console.debug(`[Enemy] moveInStoneWallGrid: 到达路径点[${this.currentPathIndex}]/${this.gridPath.length}, 敌人位置(${this.node.worldPosition.x.toFixed(1)}, ${this.node.worldPosition.y.toFixed(1)}), 网格坐标=${currentGrid ? `(${currentGrid.x}, ${currentGrid.y})` : 'null'}`);
            
            // 检查是否已经到达最底层（gridY=0）
            if (currentGrid && currentGrid.y <= 0) {
                // 已到达最底层，直接退出网格寻路模式
                console.debug(`[Enemy] moveInStoneWallGrid: ✅ 已到达最底层（gridY=${currentGrid.y}），退出网格寻路模式`);
                this.isInStoneWallGrid = false;
                this.gridPath = [];
                this.currentPathIndex = 0;
                return;
            }
            
            this.currentPathIndex++;
            
            // 如果还有下一个路径点，继续移动
            if (this.currentPathIndex < this.gridPath.length) {
                const nextPoint = this.gridPath[this.currentPathIndex];
                const nextGrid = this.stoneWallGridPanelComponent?.worldToGrid(nextPoint);
                console.debug(`[Enemy] moveInStoneWallGrid: 继续移动到下一个路径点[${this.currentPathIndex}] (${nextPoint.x.toFixed(1)}, ${nextPoint.y.toFixed(1)}), 网格坐标=${nextGrid ? `(${nextGrid.x}, ${nextGrid.y})` : 'null'}`);
                
                // 正常移动到下一个路径点（包括最底层），不进行闪现
                return this.moveInStoneWallGrid(deltaTime);
            } else {
                // 已到达最后一个路径点，检查是否真的在最底层
                this.isInStoneWallGrid = false;
                this.gridPath = [];
                this.currentPathIndex = 0;
                
                // 确认敌人确实在最底层，避免重新进入网格寻路模式
                const finalGrid = this.stoneWallGridPanelComponent?.worldToGrid(this.node.worldPosition);
                if (finalGrid && finalGrid.y <= 0) {
                    console.debug(`[Enemy] moveInStoneWallGrid: ✅ 已到达最底层（gridY=${finalGrid.y}），退出网格寻路模式，敌人位置(${this.node.worldPosition.x.toFixed(1)}, ${this.node.worldPosition.y.toFixed(1)})`);
                } else {
                    const finalGridInfo = finalGrid ? `gridY=${finalGrid.y}` : '不在网格内';
                    console.debug(`[Enemy] moveInStoneWallGrid: ⚠️ 路径完成但可能未到达最底层（${finalGridInfo}），退出网格寻路模式，敌人位置(${this.node.worldPosition.x.toFixed(1)}, ${this.node.worldPosition.y.toFixed(1)})`);
                }
                return;
            }
        }

        // 向当前路径点移动
        if (distance > 0.1) {
            direction.normalize();
            
            // 在网格移动中，禁用或大幅减少避让逻辑，优先跟随网格路径
            // 只在非常接近时才应用轻微的避让，避免反复横跳
            let finalDirection = direction;
            const moveDistance = this.moveSpeed * deltaTime;
            const newPos = new Vec3();
            Vec3.scaleAndAdd(newPos, enemyPos, direction, moveDistance);
            
            // 检查移动后是否会与其他敌人碰撞
            const willCollide = this.checkCollisionWithEnemy(newPos);
            if (willCollide) {
                // 如果会碰撞，应用轻微的避让，但保持主要方向向下
                const avoidanceDir = this.calculateEnemyAvoidanceDirection(enemyPos, direction, deltaTime);
                // 混合避让方向和原始方向，但优先保持向下移动
                const avoidanceWeight = 0.2; // 降低避让权重，优先跟随路径
                Vec3.lerp(finalDirection, direction, avoidanceDir, avoidanceWeight);
                finalDirection.normalize();
                Vec3.scaleAndAdd(newPos, enemyPos, finalDirection, moveDistance);
            } else {
                // 不会碰撞，直接使用原始方向
                finalDirection = direction;
            }
            
            const clampedPos = this.clampPositionToScreen(newPos);
            this.node.setWorldPosition(clampedPos);
            
            // 根据移动方向翻转
            this.flipDirection(finalDirection);
            
            // 播放行走动画
            this.playWalkAnimation();
        }
    }

    /**
     * 检查指定位置是否与其他敌人碰撞
     * @param position 要检查的位置
     * @returns 如果与其他敌人碰撞返回true，否则返回false
     */
    private checkCollisionWithEnemy(position: Vec3): boolean {
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

        // 查找所有敌人容器
        const enemyContainers = ['Enemies', 'Orcs', 'TrollSpearmans', 'OrcWarriors', 'OrcWarlords'];
        const allEnemies: Node[] = [];

        for (const containerName of enemyContainers) {
            let containerNode = find(containerName);
            if (!containerNode && this.node.scene) {
                containerNode = findNodeRecursive(this.node.scene, containerName);
            }
            if (containerNode) {
                allEnemies.push(...containerNode.children);
            }
        }

        // 检查与每个敌人的碰撞
        for (const enemy of allEnemies) {
            if (!enemy || !enemy.isValid || !enemy.active || enemy === this.node) {
                continue;
            }

            // 获取敌人的脚本组件
            const enemyScript = enemy.getComponent('Enemy') as any || 
                               enemy.getComponent('OrcWarlord') as any;
            
            if (!enemyScript) {
                continue;
            }

            // 检查敌人是否存活
            if (enemyScript.isAlive && !enemyScript.isAlive()) {
                continue;
            }

            const enemyPos = enemy.worldPosition;
            const enemyDistance = Vec3.distance(position, enemyPos);
            
            // 获取敌人的碰撞半径（如果有collisionRadius属性）
            const otherRadius = enemyScript.collisionRadius || 20;
            const minDistance = this.collisionRadius + otherRadius;

            if (enemyDistance < minDistance && enemyDistance > 0.1) {
                return true; // 碰撞
            }
        }

        return false; // 无碰撞
    }

    /**
     * 计算敌人避让方向
     * @param currentPos 当前位置
     * @param desiredDirection 期望移动方向
     * @param deltaTime 时间增量
     * @returns 调整后的移动方向
     */
    private calculateEnemyAvoidanceDirection(currentPos: Vec3, desiredDirection: Vec3, deltaTime: number): Vec3 {
        const avoidanceForce = new Vec3(0, 0, 0);
        let obstacleCount = 0;
        let maxStrength = 0;

        // 检测范围：碰撞半径的4倍
        const detectionRange = this.collisionRadius * 4;

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

        // 查找所有敌人容器
        const enemyContainers = ['Enemies', 'Orcs', 'TrollSpearmans', 'OrcWarriors', 'OrcWarlords'];
        const allEnemies: Node[] = [];

        for (const containerName of enemyContainers) {
            let containerNode = find(containerName);
            if (!containerNode && this.node.scene) {
                containerNode = findNodeRecursive(this.node.scene, containerName);
            }
            if (containerNode) {
                allEnemies.push(...containerNode.children);
            }
        }

        // 检查附近的敌人
        for (const enemy of allEnemies) {
            if (!enemy || !enemy.isValid || !enemy.active || enemy === this.node) {
                continue;
            }

            // 获取敌人的脚本组件
            const enemyScript = enemy.getComponent('Enemy') as any || 
                               enemy.getComponent('OrcWarlord') as any;
            
            if (!enemyScript) {
                continue;
            }

            // 检查敌人是否存活
            if (enemyScript.isAlive && !enemyScript.isAlive()) {
                continue;
            }

            const enemyPos = enemy.worldPosition;
            const distance = Vec3.distance(currentPos, enemyPos);
            
            // 获取敌人的碰撞半径
            const otherRadius = enemyScript.collisionRadius || 20;
            const minDistance = this.collisionRadius + otherRadius;

            if (distance < detectionRange && distance > 0.1) {
                const avoidDir = new Vec3();
                Vec3.subtract(avoidDir, currentPos, enemyPos);
                avoidDir.normalize();
                
                // 距离越近，避障力越强
                let strength = 1 - (distance / detectionRange);
                
                // 如果已经在碰撞范围内，大幅增强避障力
                if (distance < minDistance) {
                    strength = 2.0; // 强制避障
                }
                
                Vec3.scaleAndAdd(avoidanceForce, avoidanceForce, avoidDir, strength);
                maxStrength = Math.max(maxStrength, strength);
                obstacleCount++;
            }
        }

        // 如果有障碍物，应用避障力
        if (obstacleCount > 0 && avoidanceForce.length() > 0.1) {
            avoidanceForce.normalize();
            
            // 根据障碍物强度调整混合比例
            // 如果障碍物很近（maxStrength > 1），优先避障
            const avoidanceWeight = maxStrength > 2.0 ? 0.7 : (maxStrength > 1.0 ? 0.5 : 0.3);
            const finalDir = new Vec3();
            Vec3.lerp(finalDir, desiredDirection, avoidanceForce, avoidanceWeight);
            finalDir.normalize();
            
            return finalDir;
        }

        // 没有障碍物，返回期望方向
        return desiredDirection;
    }
}



