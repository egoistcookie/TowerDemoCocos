import { _decorator, Component, Node, Vec3, tween, Sprite, find, Prefab, instantiate, Label, Color, SpriteFrame, UITransform, AudioClip, Animation, AnimationState, view } from 'cc';
import { GameManager } from './GameManager';
import { GameState } from './GameState';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
import { AudioManager } from './AudioManager';
import { UnitType } from './WarAncientTree';
import { StoneWallGridPanel } from './StoneWallGridPanel';
import { UnitManager } from './UnitManager';
import { EnemyPool } from './EnemyPool';
import { UnitConfigManager } from './UnitConfigManager';
// import { PerformanceMonitor } from './PerformanceMonitor';
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
    protected attackTimer: number = 0;
    protected currentTarget: Node = null!;
    protected gameManager: GameManager = null!;
    protected unitManager: UnitManager = null!; // 单位管理器引用（性能优化）
    protected targetFindTimer: number = 0; // 目标查找计时器
    protected readonly TARGET_FIND_INTERVAL: number = 0.2; // 目标查找间隔（秒），不是每帧都查找
    
    // 性能优化：LOD系统相关属性
    private updateSkipCounter: number = 0; // 更新跳过计数器（用于LOD）
    private updateSkipInterval: number = 1; // 更新跳过间隔（每N帧更新一次）
    private animationUpdateTimer: number = 0; // 动画更新计时器
    private readonly ANIMATION_UPDATE_INTERVAL: number = 0.033; // 动画更新间隔（约30fps，而不是60fps）
    private cameraNode: Node = null!; // 摄像机节点缓存
    private lastDistanceCheckTime: number = 0; // 上次距离检查时间
    private readonly DISTANCE_CHECK_INTERVAL: number = 0.5; // 距离检查间隔（秒）
    private cachedDistanceToCamera: number = 0; // 缓存的到摄像机距离
    private readonly LOD_NEAR_DISTANCE: number = 600; // 近距离LOD阈值（像素）
    private readonly LOD_MID_DISTANCE: number = 1200; // 中距离LOD阈值（像素）
    
    // 性能优化：缓存和复用对象
    private cachedWorldPosition: Vec3 = new Vec3(); // 缓存世界位置，避免重复访问
    private cachedTargetWorldPosition: Vec3 = new Vec3(); // 缓存目标世界位置
    private tempVec3_1: Vec3 = new Vec3(); // 临时Vec3对象1（复用）
    private tempVec3_2: Vec3 = new Vec3(); // 临时Vec3对象2（复用）
    private cachedCurrentGrid: { x: number; y: number } | null = null; // 缓存的当前网格位置
    private lastGridCheckTime: number = 0; // 上次网格检查时间
    private readonly GRID_CHECK_INTERVAL: number = 0.2; // 网格检查间隔（秒）
    private cachedIsAboveGrid: boolean = false; // 缓存的"是否在网格上方"状态
    private lastAboveGridCheckTime: number = 0; // 上次"是否在网格上方"检查时间
    private readonly ABOVE_GRID_CHECK_INTERVAL: number = 0.3; // "是否在网格上方"检查间隔（秒）
    private cachedTargetComponent: any = null; // 缓存的目标组件（避免重复getComponent）
    private lastComponentCheckTime: number = 0; // 上次组件检查时间
    private readonly COMPONENT_CHECK_INTERVAL: number = 0.1; // 组件检查间隔（秒）
    
    // 对象池相关：预制体名称（用于对象池回收）
    public prefabName: string = "Orc"; // 默认值，子类可以重写
    
    // 石墙网格寻路相关属性
    private stoneWallGridPanelComponent: StoneWallGridPanel | null = null; // 石墙网格面板组件引用
    private isInStoneWallGrid: boolean = false; // 标记是否在网格中寻路
    private topLayerGapTarget: Vec3 | null = null; // 网格最上层缺口目标点
    private gridMoveState: 'down' | 'left' | 'right' | null = null; // 当前网格移动状态
    private gridMoveTargetX: number | null = null; // 左右移动时的目标网格x坐标
    
    @property
    goldReward: number = 0; // 消灭敌人获得的金币
    
    @property
    expReward: number = 0; // 消灭敌人获得的经验值
    
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
    protected attackComplete: boolean = false; // 攻击动画是否已完成造成伤害
    
    // Animation组件相关
    protected animationComponent: Animation = null!; // Animation组件引用

    // 对话框相关属性
    private dialogNode: Node | null = null; // 对话框节点
    private dialogLabel: Label | null = null; // 对话框文字标签
    private dialogTimer: number = 0; // 对话框显示计时器（用于控制显示时间和渐隐）
    private dialogIntervalTimer: number = 0; // 对话框间隔计时器（用于累计间隔时间）
    private dialogInterval: number = 0; // 下次显示对话框的间隔时间（5-10秒随机）
    private readonly DIALOG_MIN_INTERVAL: number = 5; // 最小间隔5秒
    private readonly DIALOG_MAX_INTERVAL: number = 10; // 最大间隔10秒
    private readonly DIALOG_DURATION: number = 2; // 对话框显示持续时间2秒
    private readonly DIALOG_SLOGANS: string[] = ['兽人万岁！', '打下这条防线！', '为了鲜血与荣耀！', '乌拉！', '为了部落！']; // 进攻口号数组
    
    // 性能监控相关属性
    private static unitCountLogTimer: number = 0; // 单位数量日志输出计时器（静态，所有Enemy实例共享）
    private static readonly UNIT_COUNT_LOG_INTERVAL: number = 1.0; // 单位数量日志输出间隔（秒）

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        
        // 初始化网格寻路相关属性
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
        
        // 性能优化：初始化LOD系统
        this.updateSkipCounter = Math.floor(Math.random() * 3); // 随机初始值，避免所有敌人同时更新
        this.updateSkipInterval = 1;
        this.animationUpdateTimer = 0;
        this.cachedDistanceToCamera = 0;
        this.lastDistanceCheckTime = 0;
        
        // 缓存摄像机节点
        const camera = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
        if (camera) {
            this.cameraNode = camera;
        }
        
        // 性能优化：初始化缓存对象
        this.cachedWorldPosition.set(this.node.worldPosition);
        this.cachedCurrentGrid = null;
        this.lastGridCheckTime = 0;
        this.cachedIsAboveGrid = false;
        this.lastAboveGridCheckTime = 0;
        this.cachedTargetComponent = null;
        this.lastComponentCheckTime = 0;
        
        // 查找单位管理器（性能优化）
        this.unitManager = UnitManager.getInstance();
        
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
        
        // 初始化对话框系统
        this.initDialogSystem();
        
        // 从配置文件加载金币和经验奖励（只在初始化时加载一次）
        this.loadRewardsFromConfig();
        
        // 初始播放待机动画
        this.playIdleAnimation();
    }
    
    /**
     * 当敌人从对象池激活时调用（用于对象池复用）
     * 从对象池获取的敌人会调用此方法，而不是start方法
     */
    onEnable() {
        // 从对象池获取时，重新初始化状态
        // 注意：sprite等组件引用在start中已经初始化，这里只需要重置状态
        if (this.sprite && this.defaultSpriteFrame) {
            this.sprite.spriteFrame = this.defaultSpriteFrame;
        }
        
        // 重新初始化状态
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        this.targetFindTimer = 0;
        this.isInStoneWallGrid = false;
        this.topLayerGapTarget = null;
        this.currentTarget = null!;
        this.isHit = false;
        this.isPlayingAttackAnimation = false;
        this.isPlayingHitAnimation = false;
        this.isPlayingDeathAnimation = false;
        this.attackComplete = false;
        
        // 重置LOD相关
        this.updateSkipCounter = Math.floor(Math.random() * 3);
        this.updateSkipInterval = 1;
        this.animationUpdateTimer = 0;
        this.lastDistanceCheckTime = 0;
        this.lastGridCheckTime = 0;
        this.lastAboveGridCheckTime = 0;
        this.lastComponentCheckTime = 0;
        this.cachedCurrentGrid = null;
        
        // 从配置文件加载金币和经验奖励（从对象池获取时也需要重新加载）
        this.loadRewardsFromConfig();
        this.cachedIsAboveGrid = false;
        this.cachedTargetComponent = null;
        
        // 重置节点状态
        if (this.node) {
            this.node.setScale(this.defaultScale);
            this.node.angle = 0;
            if (this.sprite) {
                const color = this.sprite.color.clone();
                color.a = 255;
                this.sprite.color = color;
            }
        }
        
        // 重新查找游戏管理器（可能已变化）
        this.findGameManager();
        
        // 重新查找单位管理器
        this.unitManager = UnitManager.getInstance();
        
        // 重新查找目标水晶
        if (!this.targetCrystal || !this.targetCrystal.isValid) {
            this.targetCrystal = find('Crystal') || null!;
        }
        
        // 重新创建血条（如果不存在）
        if (!this.healthBarNode || !this.healthBarNode.isValid) {
            this.createHealthBar();
        }
        
        // 重新初始化对话框系统
        this.initDialogSystem();
        
        // 播放待机动画
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

    /**
     * 初始化对话框系统
     */
    initDialogSystem() {
        this.dialogTimer = 0;
        this.dialogIntervalTimer = 0;
        // 随机生成第一次显示对话框的间隔时间（5-10秒）
        this.dialogInterval = this.DIALOG_MIN_INTERVAL + Math.random() * (this.DIALOG_MAX_INTERVAL - this.DIALOG_MIN_INTERVAL);
    }

    /**
     * 创建对话框节点
     */
    createDialog() {
        if (this.dialogNode && this.dialogNode.isValid) {
            // 如果对话框已存在，先销毁
            this.dialogNode.destroy();
        }

        // 创建对话框节点
        this.dialogNode = new Node('Dialog');
        this.dialogNode.setParent(this.node);
        this.dialogNode.setPosition(0, 50, 0); // 在血条上方
        // 根据当前敌人的朝向设置对话框的scale（与血条保持一致，确保文字从左往右显示）
        const currentEnemyScaleX = this.node.scale.x;
        if (currentEnemyScaleX < 0) {
            this.dialogNode.setScale(-1, 1, 1);
        } else {
            this.dialogNode.setScale(1, 1, 1);
        }

        // 添加UITransform组件
        const dialogTransform = this.dialogNode.addComponent(UITransform);
        dialogTransform.setContentSize(150, 30);

        // 创建文字标签（无背景，透明显示）
        const labelNode = new Node('DialogLabel');
        labelNode.setParent(this.dialogNode);
        labelNode.setPosition(0, 0, 0);

        const labelTransform = labelNode.addComponent(UITransform);
        labelTransform.setContentSize(150, 30);

        this.dialogLabel = labelNode.addComponent(Label);
        this.dialogLabel.string = this.getRandomSlogan();
        this.dialogLabel.fontSize = 14;
        this.dialogLabel.color = new Color(255, 0, 0, 255); // 红色文字
        this.dialogLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.dialogLabel.verticalAlign = Label.VerticalAlign.CENTER;
        this.dialogLabel.overflow = Label.Overflow.RESIZE_HEIGHT;

        // 初始设置为完全显示
        this.dialogNode.active = true;
        if (this.dialogLabel) {
            this.dialogLabel.color = new Color(255, 0, 0, 255); // 红色文字（敌人单位）
        }
    }

    /**
     * 获取随机口号
     */
    getRandomSlogan(): string {
        const index = Math.floor(Math.random() * this.DIALOG_SLOGANS.length);
        return this.DIALOG_SLOGANS[index];
    }

    /**
     * 更新对话框系统（检查间隔时间，创建对话框）
     */
    updateDialogSystem(deltaTime: number) {
        // 如果对话框正在显示，更新对话框
        if (this.dialogNode && this.dialogNode.isValid) {
            this.updateDialog(deltaTime);
            return;
        }

        // 如果对话框不存在，检查是否到了显示时间
        if (!this.dialogNode) {
            // 累计间隔时间
            this.dialogIntervalTimer += deltaTime;

            // 如果累计时间达到间隔时间，创建对话框
            if (this.dialogIntervalTimer >= this.dialogInterval) {
                this.createDialog();
                this.dialogIntervalTimer = 0; // 重置间隔计时器
                this.dialogTimer = 0; // 重置显示计时器
            }
        }
    }

    /**
     * 更新对话框（位置跟随、渐隐效果）
     */
    updateDialog(deltaTime: number) {
        if (!this.dialogNode || !this.dialogNode.isValid) {
            return;
        }

        // 更新对话框位置（跟随敌人，保持在血条上方）
        this.dialogNode.setPosition(0, 50, 0);
        // 根据当前敌人的朝向更新对话框的scale（与血条保持一致，确保文字从左往右显示）
        const currentEnemyScaleX = this.node.scale.x;
        if (currentEnemyScaleX < 0) {
            this.dialogNode.setScale(-1, 1, 1);
        } else {
            this.dialogNode.setScale(1, 1, 1);
        }

        // 更新显示计时器
        this.dialogTimer += deltaTime;

        // 如果显示时间超过持续时间，开始渐隐
        if (this.dialogTimer > this.DIALOG_DURATION) {
            const fadeTime = this.dialogTimer - this.DIALOG_DURATION;
            const fadeDuration = 0.5; // 渐隐持续时间0.5秒

            if (fadeTime < fadeDuration) {
                // 正在渐隐
                const alpha = 1 - (fadeTime / fadeDuration);
                const textAlpha = Math.floor(255 * alpha);

                if (this.dialogLabel) {
                    this.dialogLabel.color = new Color(255, 0, 0, textAlpha); // 红色文字（敌人单位），渐隐时保持红色
                }
            } else {
                // 渐隐完成，销毁对话框
                if (this.dialogNode && this.dialogNode.isValid) {
                    this.dialogNode.destroy();
                }
                this.dialogNode = null;
                this.dialogLabel = null;
                this.dialogTimer = 0;
                this.dialogIntervalTimer = 0; // 重置间隔计时器
                // 重新随机生成下次显示的间隔时间
                this.dialogInterval = this.DIALOG_MIN_INTERVAL + Math.random() * (this.DIALOG_MAX_INTERVAL - this.DIALOG_MIN_INTERVAL);
            }
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
        // 性能监控：开始计时
        // const updateStartTime = PerformanceMonitor.startTiming('Enemy.update');
        
        // 如果被销毁，只更新动画，不执行其他逻辑
        if (this.isDestroyed) {
            this.updateAnimation(deltaTime);
            // PerformanceMonitor.endTiming('Enemy.update', updateStartTime, 5);
            return;
        }

        // 性能监控：单位数量统计和日志输出（降低频率，避免每帧都输出）
        Enemy.unitCountLogTimer += deltaTime;
        if (Enemy.unitCountLogTimer >= Enemy.UNIT_COUNT_LOG_INTERVAL) {
            Enemy.unitCountLogTimer = 0;
            
            // 获取单位数量
            let enemyCount = 0;
            let roleCount = 0;
            
            if (this.unitManager) {
                const enemies = this.unitManager.getEnemies();
                enemyCount = enemies.length;
                
                // 统计Role单位数量（包括弓箭手、女猎手、精灵剑士、牧师）
                const towers = this.unitManager.getTowers();
                const hunters = this.unitManager.getHunters();
                const elfSwordsmans = this.unitManager.getElfSwordsmans();
                roleCount = towers.length + hunters.length + elfSwordsmans.length;
            } else {
                // 降级方案：直接查找节点
                const enemiesNode = find('Canvas/Enemies');
                if (enemiesNode) {
                    enemyCount = enemiesNode.children.filter(node => node && node.isValid && node.active).length;
                }
                
                const towersNode = find('Canvas/Towers');
                const huntersNode = find('Canvas/Hunters');
                const elfSwordsmansNode = find('Canvas/ElfSwordsmans');
                if (towersNode) roleCount += towersNode.children.filter(node => node && node.isValid && node.active).length;
                if (huntersNode) roleCount += huntersNode.children.filter(node => node && node.isValid && node.active).length;
                if (elfSwordsmansNode) roleCount += elfSwordsmansNode.children.filter(node => node && node.isValid && node.active).length;
            }
            
            //console.info(`[Enemy.update] 单位数量统计 - 敌人: ${enemyCount}, 角色: ${roleCount}, 总计: ${enemyCount + roleCount}`);
        }

        // 性能优化：LOD系统 - 根据距离摄像机远近，降低更新频率
        // 使用累计时间而不是Date.now()，避免系统调用开销
        this.lastDistanceCheckTime += deltaTime;
        if (this.lastDistanceCheckTime >= this.DISTANCE_CHECK_INTERVAL) {
            // const lodStartTime = PerformanceMonitor.startTiming('Enemy.updateLOD');
            this.updateLOD();
            // PerformanceMonitor.endTiming('Enemy.updateLOD', lodStartTime, 1);
            this.lastDistanceCheckTime = 0;
        }
        
        // 根据LOD级别决定是否跳过本次更新
        this.updateSkipCounter++;
        if (this.updateSkipCounter < this.updateSkipInterval) {
            // 跳过更新，但更新动画（降低频率）
            this.animationUpdateTimer += deltaTime;
            if (this.animationUpdateTimer >= this.ANIMATION_UPDATE_INTERVAL) {
                this.animationUpdateTimer = 0;
                this.updateAnimation(deltaTime);
            }
            // PerformanceMonitor.endTiming('Enemy.update', updateStartTime, 5);
            return;
        }
        this.updateSkipCounter = 0;

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

        // 更新攻击计时器
        this.attackTimer += deltaTime;
        this.targetFindTimer += deltaTime;
        
        // 更新对话框系统（降低频率，只在更新时执行）
        this.updateDialogSystem(deltaTime);

        // 查找目标（优先防御塔，然后水晶）- 按间隔查找而不是每帧都查找
        if (this.targetFindTimer >= this.TARGET_FIND_INTERVAL) {
            this.targetFindTimer = 0;
            // const findTargetStartTime = PerformanceMonitor.startTiming('Enemy.findTarget');
            this.findTarget();
            // PerformanceMonitor.endTiming('Enemy.findTarget', findTargetStartTime, 3);
        }
        
        // 如果当前目标已失效，立即重新查找（不等待间隔）
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
            if (this.targetFindTimer >= 0.1) { // 至少间隔0.1秒
                this.targetFindTimer = 0;
                // const findTargetStartTime = PerformanceMonitor.startTiming('Enemy.findTarget');
                this.findTarget();
                // PerformanceMonitor.endTiming('Enemy.findTarget', findTargetStartTime, 3);
            }
        }

        // 最高优先级：如果在网格中寻路，优先执行网格寻路逻辑
        // 但如果当前目标是我方单位，放弃网格寻路，直接朝我方单位移动
        if (this.isInStoneWallGrid) {
            // 检查当前目标是否是我方单位
            let isFriendlyUnit = false;
            if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
                const arrowerScript = this.currentTarget.getComponent('Arrower') as any;
                const hunterScript = this.currentTarget.getComponent('Hunter') as any;
                const swordsmanScript = this.currentTarget.getComponent('ElfSwordsman') as any;
                const priestScript = this.currentTarget.getComponent('Priest') as any;
                if (arrowerScript || hunterScript || swordsmanScript || priestScript) {
                    isFriendlyUnit = true;
                }
            }
            
            // 如果当前目标是我方单位，退出网格寻路模式，直接朝我方单位移动
            if (isFriendlyUnit) {
                this.isInStoneWallGrid = false;
                this.gridMoveState = null;
                this.gridMoveTargetX = null;
                // 继续执行后续逻辑，直接朝我方单位移动
            } else {
                // 如果正在播放攻击动画，停止攻击动画并切换到移动动画
                if (this.isPlayingAttackAnimation) {
                    this.isPlayingAttackAnimation = false;
                    this.attackComplete = false;
                    this.stopAllAnimations();
                }
                const hadTargetBefore = !!this.currentTarget;
                // const moveInGridStartTime = PerformanceMonitor.startTiming('Enemy.moveInStoneWallGrid');
                this.moveInStoneWallGrid(deltaTime);
                // PerformanceMonitor.endTiming('Enemy.moveInStoneWallGrid', moveInGridStartTime, 3);
                // 如果moveInStoneWallGrid检测到我方单位并设置了currentTarget，且退出了网格寻路模式，不直接return，让后续逻辑处理目标
                if (!this.isInStoneWallGrid && this.currentTarget && !hadTargetBefore) {
                    // 不return，继续执行后续逻辑处理移动和攻击
                } else {
                    this.updateAnimation(deltaTime);
                    return;
                }
            }
        }

        // 检查敌人是否在网格上方，如果是，先移动到缺口
        // 优先级：如果有缺口目标，优先移动到缺口；如果没有，检查是否在网格上方并查找缺口
        if (!this.currentTarget && !this.isInStoneWallGrid) {
            // 性能优化：缓存网格位置，减少worldToGrid调用
            this.lastGridCheckTime += deltaTime;
            if (this.lastGridCheckTime >= this.GRID_CHECK_INTERVAL || !this.cachedCurrentGrid) {
                this.cachedCurrentGrid = this.stoneWallGridPanelComponent?.worldToGrid(this.node.worldPosition) || null;
                this.lastGridCheckTime = 0;
            }
            
            // 先检查是否已经在最底层，如果是，清除所有网格相关状态，直接向水晶移动
            if (this.cachedCurrentGrid && this.cachedCurrentGrid.y <= 0) {
                // 已在最底层，清除所有网格相关状态，直接向水晶移动
                this.topLayerGapTarget = null;
                // 直接跳过后续的网格和绕行逻辑，进入向水晶移动的逻辑
            } else {
                // 性能优化：缓存"是否在网格上方"状态，减少checkEnemyAboveGrid调用
                this.lastAboveGridCheckTime += deltaTime;
                if (this.lastAboveGridCheckTime >= this.ABOVE_GRID_CHECK_INTERVAL || this.lastAboveGridCheckTime === deltaTime) {
                    this.cachedIsAboveGrid = this.checkEnemyAboveGrid();
                    this.lastAboveGridCheckTime = 0;
                }
                
                if ((this.topLayerGapTarget || this.cachedIsAboveGrid) && !this.currentTarget) {
                    // 如果已经有缺口目标，或者敌人在网格上方，且没有当前目标，处理缺口移动逻辑
                    // 如果还没有找到缺口目标，寻找缺口
                    if (!this.topLayerGapTarget) {
                        const gapPos = this.findGapInTopLayer();
                        if (gapPos) {
                            this.topLayerGapTarget = gapPos;
                        } else {
                            // 找不到缺口，攻击最近的石墙
                            const nearestWall = this.findNearestStoneWall();
                            if (nearestWall) {
                                this.currentTarget = nearestWall;
                                // 清除缺口目标，确保不会进入缺口移动逻辑
                                this.topLayerGapTarget = null;
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
                        // 移动到缺口（性能优化：复用Vec3对象）
                        this.cachedWorldPosition.set(this.node.worldPosition);
                        Vec3.subtract(this.tempVec3_1, this.topLayerGapTarget, this.cachedWorldPosition);
                        const gapDistance = this.tempVec3_1.length();

                        if (gapDistance < 15) {
                            // 已到达缺口，清除缺口标记，进入网格寻路模式
                            
                            // 确保敌人位置精确对齐到缺口位置
                            const clampedPos = this.clampPositionToScreen(this.topLayerGapTarget);
                            this.node.setWorldPosition(clampedPos);
                            
                            this.topLayerGapTarget = null;
                            
                            // 进入网格寻路模式（简化：直接进入，不使用A*算法）
                            this.isInStoneWallGrid = true;
                            // const moveInGridStartTime2 = PerformanceMonitor.startTiming('Enemy.moveInStoneWallGrid');
                            this.moveInStoneWallGrid(deltaTime);
                            // PerformanceMonitor.endTiming('Enemy.moveInStoneWallGrid', moveInGridStartTime2, 3);
                            return;
                            // 继续执行，让后续逻辑处理石墙攻击
                        } else {
                            // 向缺口移动（性能优化：复用Vec3对象）
                            this.tempVec3_1.normalize();
                            const moveDistance = this.moveSpeed * deltaTime;
                            Vec3.scaleAndAdd(this.tempVec3_2, this.cachedWorldPosition, this.tempVec3_1, moveDistance);
                            
                            const clampedPos = this.clampPositionToScreen(this.tempVec3_2);
                            this.node.setWorldPosition(clampedPos);
                            
                            // 根据移动方向翻转
                            this.flipDirection(this.tempVec3_1);
                            
                            // 播放行走动画
                            this.playWalkAnimation();
                            
                            // 如果正在播放攻击动画，停止攻击动画
                            if (this.isPlayingAttackAnimation) {
                                this.isPlayingAttackAnimation = false;
                            }
                        }
                        // modify by lf 2025-12-27 fix:修复敌人在网格上方移动时，没有播放行走动画的问题
                        this.updateAnimation(deltaTime);
                        return; // 优先处理缺口移动，不继续执行后续逻辑
                    }
                }
            }
        }

        // 处理当前目标（性能优化：使用平方距离比较，缓存位置和组件）
        if (this.currentTarget && this.currentTarget.isValid) {
            // 缓存位置
            this.cachedWorldPosition.set(this.node.worldPosition);
            this.cachedTargetWorldPosition.set(this.currentTarget.worldPosition);
            const dx = this.cachedTargetWorldPosition.x - this.cachedWorldPosition.x;
            const dy = this.cachedTargetWorldPosition.y - this.cachedWorldPosition.y;
            const distanceSq = dx * dx + dy * dy;
            const attackRangeSq = this.attackRange * this.attackRange;
            
            // 性能优化：缓存组件查找，避免重复getComponent调用
            this.lastComponentCheckTime += deltaTime;
            if (this.lastComponentCheckTime >= this.COMPONENT_CHECK_INTERVAL || !this.cachedTargetComponent) {
                const stoneWallComp = this.currentTarget.getComponent('StoneWall') as any;
                const crystalComp = this.currentTarget.getComponent('Crystal') as any;
                this.cachedTargetComponent = stoneWallComp || crystalComp;
                this.lastComponentCheckTime = 0;
            }

            if (distanceSq <= attackRangeSq) {
                // 在攻击范围内，停止移动并攻击
                // 只有在攻击条件满足时才停止移动并攻击，避免在等待攻击时重置动画状态
                if (this.attackTimer >= this.attackInterval && !this.isHit && !this.isPlayingAttackAnimation) {
                    // 攻击条件满足，停止移动并攻击
                    this.stopMoving();
                    // const attackStartTime = PerformanceMonitor.startTiming('Enemy.attack');
                    this.attack();
                    // PerformanceMonitor.endTiming('Enemy.attack', attackStartTime, 2);
                    this.attackTimer = 0;
                } else {
                    // 攻击条件不满足，不调用移动方法也不调用stopMoving()，保持当前状态等待攻击
                    // 不调用移动方法，敌人自然停止移动，也不调用stopMoving()避免重置动画状态
                }
            } else {
                // 不在攻击范围内，只有在没有被攻击时才继续移动
                if (!this.isHit && !this.isPlayingAttackAnimation) {
                    this.moveTowardsTarget(deltaTime);
                    // 如果正在播放攻击动画，停止攻击动画
                    if (this.isPlayingAttackAnimation) {
                        this.isPlayingAttackAnimation = false;
                    }
                } else {
                }
            }
        } else {
            // 没有目标，检查路径是否被石墙阻挡（使用缓存结果）
            if (this.targetCrystal && this.targetCrystal.isValid && !this.isHit) {
                // 路径畅通，向水晶移动
                this.moveTowardsCrystal(deltaTime);
                // 如果正在播放攻击动画，停止攻击动画
                if (this.isPlayingAttackAnimation) {
                    this.isPlayingAttackAnimation = false;
                }
            }
        }
        
        // 更新动画
        // const updateAnimationStartTime = PerformanceMonitor.startTiming('Enemy.updateAnimation');
        this.updateAnimation(deltaTime);
        // PerformanceMonitor.endTiming('Enemy.updateAnimation', updateAnimationStartTime, 2);

        // 性能监控：结束 update 方法计时
        // PerformanceMonitor.endTiming('Enemy.update', updateStartTime, 5);
    }

    private findTarget() {
        
        // 如果当前目标是我方单位（弓箭手、女猎手、剑士、牧师），保持这个目标作为最高优先级
        if (this.currentTarget && this.currentTarget.isValid && !this.isInStoneWallGrid) {
            const arrowerScript = this.currentTarget.getComponent('Arrower') as any;
            const hunterScript = this.currentTarget.getComponent('Hunter') as any;
            const swordsmanScript = this.currentTarget.getComponent('ElfSwordsman') as any;
            const priestScript = this.currentTarget.getComponent('Priest') as any;
            
            if ((arrowerScript || hunterScript || swordsmanScript || priestScript) && 
                this.currentTarget.active && this.currentTarget.isValid && this.currentTarget.worldPosition &&
                this.node && this.node.isValid && this.node.worldPosition) {
                // 检查这个单位是否仍然有效且存活
                if ((arrowerScript && arrowerScript.isAlive && arrowerScript.isAlive()) ||
                    (hunterScript && hunterScript.isAlive && hunterScript.isAlive()) ||
                    (swordsmanScript && swordsmanScript.isAlive && swordsmanScript.isAlive()) ||
                    (priestScript && priestScript.isAlive && priestScript.isAlive())) {
                    // 性能优化：不需要计算实际距离，只需要检查目标是否有效
                    // 保持这个目标，不执行后续的目标查找逻辑
                    return;
                }
            }
        }

        // 如果当前目标是石墙且敌人不在网格寻路模式（说明可能是A*寻路失败后设置的，或者是网格最上层没有缺口时设置的），保持这个目标作为最高优先级
        if (this.currentTarget && this.currentTarget.isValid && !this.isInStoneWallGrid && this.currentTarget.worldPosition &&
            this.node && this.node.isValid && this.node.worldPosition) {
            const currentWallScript = this.currentTarget.getComponent('StoneWall') as any;
            if (currentWallScript && currentWallScript.isAlive && currentWallScript.isAlive()) {
                // 性能优化：不需要计算实际距离，只需要检查石墙是否有效且存活
                // 保持这个目标，不执行后续的目标查找逻辑，确保敌人会移动到攻击范围内
                return;
            }
        }
        
        // 索敌范围：200像素
        const detectionRange = 200;
        const detectionRangeSq = detectionRange * detectionRange; // 平方距离，避免开方运算
        
        // 检查当前目标是否仍然有效，特别是石墙
        if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
            const targetScript = this.currentTarget.getComponent('StoneWall') as any || 
                                this.currentTarget.getComponent('Arrower') as any || 
                                this.currentTarget.getComponent('WarAncientTree') as any ||
                                this.currentTarget.getComponent('Crystal') as any ||
                                this.currentTarget.getComponent('Church') as any;
            
            // 如果目标是石墙，检查是否仍然存活
            if (targetScript && targetScript.isAlive && !targetScript.isAlive()) {
                this.currentTarget = null!;
            } else if (this.currentTarget && this.currentTarget.worldPosition &&
                       this.node && this.node.isValid && this.node.worldPosition) {
                // const currentWallScript = this.currentTarget.getComponent('StoneWall') as any;
                // if (currentWallScript && currentWallScript.isAlive && currentWallScript.isAlive()) {
                //     // 当前目标是石墙且仍然存活，检查距离（性能优化：使用平方距离）
                //     const dx = this.currentTarget.worldPosition.x - this.node.worldPosition.x;
                //     const dy = this.currentTarget.worldPosition.y - this.node.worldPosition.y;
                //     const distanceSq = dx * dx + dy * dy;
                //     const attackRangeSq = this.attackRange * this.attackRange;
                    
                //     // 如果石墙在攻击范围内，保持这个目标（正在攻击中）
                //     if (distanceSq <= attackRangeSq) {
                //         return;
                //     }
                    
                //     // 路径不再被阻挡（可以绕行），但是如果是网格最上层没有缺口时设置的石墙目标，应该保持目标
                //     // 因为这种情况下，敌人应该攻击石墙而不是绕行
                //     // 检查是否是在网格上方且没有缺口时设置的石墙目标
                //     const isGridTopLayerWall = this.checkEnemyAboveGrid() && !this.topLayerGapTarget;
                //     if (isGridTopLayerWall) {
                //         // 是在网格上方且没有缺口时设置的石墙目标，保持目标，不绕行
                //         return;
                //     } else {
                //         // 路径不再被阻挡（可以绕行），清除石墙目标，优先绕开石墙
                //         // 只有当实在无法绕行时才考虑攻击石墙
                //         this.currentTarget = null!;
                //         // 继续执行下面的逻辑，查找其他目标
                //     }
                // }
            }
        }
        
        // 优先查找附近的防御塔和战争古树（在攻击范围内）- 使用UnitManager优化
        let towers: Node[] = [];
        let trees: Node[] = [];
        let halls: Node[] = [];
        let swordsmanHalls: Node[] = [];
        
        // 使用UnitManager获取单位列表（性能优化）
        if (this.unitManager) {
            towers = this.unitManager.getTowers();
            trees = this.unitManager.getWarAncientTrees();
            halls = this.unitManager.getBuildings().filter(building => {
                const hallScript = building.getComponent('HunterHall') as any;
                return hallScript && hallScript.isAlive && hallScript.isAlive();
            });
            swordsmanHalls = this.unitManager.getBuildings().filter(building => {
                const hallScript = building.getComponent('SwordsmanHall') as any;
                return hallScript && hallScript.isAlive && hallScript.isAlive();
            });
        } else {
            // 降级方案：如果没有UnitManager，使用直接路径查找
            const towersNode = find('Canvas/Towers');
            if (towersNode) {
                towers = towersNode.children || [];
            }

            const warAncientTrees = find('Canvas/WarAncientTrees');
            if (warAncientTrees) {
                trees = warAncientTrees.children || [];
            }

            const hallsNode = find('Canvas/HunterHalls');
            if (hallsNode) {
                halls = hallsNode.children || [];
            }

            const swordsmanHallsNode = find('Canvas/SwordsmanHalls');
            if (swordsmanHallsNode) {
                swordsmanHalls = swordsmanHallsNode.children || [];
            }
        }

        let nearestTarget: Node = null!;
        let minDistanceSq = Infinity; // 使用平方距离，避免开方运算
        let targetPriority = Infinity;
        
        // 定义优先级：水晶>石墙（阻挡路径时）>树木>角色>建筑物
        const PRIORITY = {
            CRYSTAL: 1,
            STONEWALL: 1.5, // 石墙优先级介于水晶和树木之间
            TREE: 2,
            CHARACTER: 3,
            BUILDING: 4
        };

        const myPos = this.node.worldPosition; // 缓存当前位置，避免重复访问

        // 1. 检查水晶是否在范围内（优先级最高）- 使用UnitManager优化
        let targetCrystal = this.targetCrystal;
        if (!targetCrystal && this.unitManager) {
            targetCrystal = this.unitManager.getCrystal();
        }
        
        if (targetCrystal && targetCrystal.isValid && targetCrystal.worldPosition &&
            this.node && this.node.isValid && this.node.worldPosition) {
            const crystalScript = targetCrystal.getComponent('Crystal') as any;
            if (crystalScript && crystalScript.isAlive && crystalScript.isAlive()) {
                const dx = targetCrystal.worldPosition.x - myPos.x;
                const dy = targetCrystal.worldPosition.y - myPos.y;
                const distanceSq = dx * dx + dy * dy;
                if (distanceSq <= detectionRangeSq) {
                    nearestTarget = targetCrystal;
                    minDistanceSq = distanceSq;
                    targetPriority = PRIORITY.CRYSTAL;
                }
            }
        }

        // 3. 查找范围内的角色（优先级第三）
        // 查找所有角色单位：弓箭手、女猎手、牧师
        // 1) 弓箭手和牧师（都在Towers容器中）
        for (const tower of towers) {
            if (!tower || !tower.active || !tower.isValid) continue;
            
            const towerScript = tower.getComponent('Arrower') as any;
            const priestScript = tower.getComponent('Priest') as any;
            const characterScript = towerScript || priestScript;
            
            // 检查角色是否存活
            if (!characterScript || !characterScript.isAlive || !characterScript.isAlive()) continue;
            
            // 使用平方距离，避免开方运算
            const dx = tower.worldPosition.x - myPos.x;
            const dy = tower.worldPosition.y - myPos.y;
            const distanceSq = dx * dx + dy * dy;
            
            // 如果角色在范围内，且优先级更高或距离更近
            if (distanceSq <= detectionRangeSq) {
                if (PRIORITY.CHARACTER < targetPriority || 
                    (PRIORITY.CHARACTER === targetPriority && distanceSq < minDistanceSq)) {
                    minDistanceSq = distanceSq;
                    nearestTarget = tower;
                    targetPriority = PRIORITY.CHARACTER;
                }
            }
        }
        // 2) 女猎手（从对象池容器直接获取，不再使用递归查找）
        let hunters: Node[] = [];
        if (this.unitManager) {
            hunters = this.unitManager.getHunters();
        } else {
            // 降级方案：直接从容器节点获取
            const huntersNode = find('Canvas/Hunters');
            if (huntersNode) {
                hunters = huntersNode.children || [];
            }
        }
        for (const hunter of hunters) {
            if (!hunter || !hunter.active || !hunter.isValid) continue;
            
            const hunterScript = hunter.getComponent('Hunter') as any;
            if (!hunterScript || !hunterScript.isAlive || !hunterScript.isAlive()) continue;
            
            const dx = hunter.worldPosition.x - myPos.x;
            const dy = hunter.worldPosition.y - myPos.y;
            const distanceSq = dx * dx + dy * dy;
            
            if (distanceSq <= detectionRangeSq) {
                if (PRIORITY.CHARACTER < targetPriority || 
                    (PRIORITY.CHARACTER === targetPriority && distanceSq < minDistanceSq)) {
                    minDistanceSq = distanceSq;
                    nearestTarget = hunter;
                    targetPriority = PRIORITY.CHARACTER;
                }
            }
        }
        // 3) 精灵剑士（从对象池容器直接获取，不再使用递归查找）
        let swordsmen: Node[] = [];
        if (this.unitManager) {
            swordsmen = this.unitManager.getElfSwordsmans();
        } else {
            // 降级方案：直接从容器节点获取
            const swordsmenNode = find('Canvas/ElfSwordsmans');
            if (swordsmenNode) {
                swordsmen = swordsmenNode.children || [];
            }
        }
        for (const swordsman of swordsmen) {
            if (!swordsman || !swordsman.active || !swordsman.isValid) continue;
            
            const swordsmanScript = swordsman.getComponent('ElfSwordsman') as any;
            if (!swordsmanScript || !swordsmanScript.isAlive || !swordsmanScript.isAlive()) continue;
            
            const dx = swordsman.worldPosition.x - myPos.x;
            const dy = swordsman.worldPosition.y - myPos.y;
            const distanceSq = dx * dx + dy * dy;
            
            if (distanceSq <= detectionRangeSq) {
                if (PRIORITY.CHARACTER < targetPriority || 
                    (PRIORITY.CHARACTER === targetPriority && distanceSq < minDistanceSq)) {
                    minDistanceSq = distanceSq;
                    nearestTarget = swordsman;
                    targetPriority = PRIORITY.CHARACTER;
                }
            }
        }

        // 5. 查找范围内的建筑物（战争古树和猎手大厅，优先级第五）
        // 战争古树
        for (const tree of trees) {
            if (!tree || !tree.active || !tree.isValid) continue;
            
            const treeScript = tree.getComponent('WarAncientTree') as any;
            if (!treeScript || !treeScript.isAlive || !treeScript.isAlive()) continue;
            
            const dx = tree.worldPosition.x - myPos.x;
            const dy = tree.worldPosition.y - myPos.y;
            const distanceSq = dx * dx + dy * dy;
            
            if (distanceSq <= detectionRangeSq) {
                if (PRIORITY.BUILDING < targetPriority || 
                    (PRIORITY.BUILDING === targetPriority && distanceSq < minDistanceSq)) {
                    minDistanceSq = distanceSq;
                    nearestTarget = tree;
                    targetPriority = PRIORITY.BUILDING;
                }
            }
        }
        // 猎手大厅
        for (const hall of halls) {
            if (!hall || !hall.active || !hall.isValid) continue;
            
            const hallScript = hall.getComponent('HunterHall') as any;
            if (!hallScript || !hallScript.isAlive || !hallScript.isAlive()) continue;
            
            const dx = hall.worldPosition.x - myPos.x;
            const dy = hall.worldPosition.y - myPos.y;
            const distanceSq = dx * dx + dy * dy;
            
            if (distanceSq <= detectionRangeSq) {
                if (PRIORITY.BUILDING < targetPriority || 
                    (PRIORITY.BUILDING === targetPriority && distanceSq < minDistanceSq)) {
                    minDistanceSq = distanceSq;
                    nearestTarget = hall;
                    targetPriority = PRIORITY.BUILDING;
                }
            }
        }
        // 剑士小屋
        for (const hall of swordsmanHalls) {
            if (!hall || !hall.active || !hall.isValid) continue;
            
            const hallScript = hall.getComponent('SwordsmanHall') as any;
            if (!hallScript || !hallScript.isAlive || !hallScript.isAlive()) continue;
            
            const dx = hall.worldPosition.x - myPos.x;
            const dy = hall.worldPosition.y - myPos.y;
            const distanceSq = dx * dx + dy * dy;
            
            if (distanceSq <= detectionRangeSq) {
                if (PRIORITY.BUILDING < targetPriority || 
                    (PRIORITY.BUILDING === targetPriority && distanceSq < minDistanceSq)) {
                    minDistanceSq = distanceSq;
                    nearestTarget = hall;
                    targetPriority = PRIORITY.BUILDING;
                }
            }
        }

        // 查找教堂 - 从UnitManager获取，不再使用递归查找
        let churches: Node[] = [];
        if (this.unitManager) {
            churches = this.unitManager.getBuildings().filter(building => {
                const churchScript = building.getComponent('Church') as any;
                return churchScript && churchScript.isAlive && churchScript.isAlive();
            });
        }
        // 教堂
        for (const church of churches) {
            if (!church || !church.active || !church.isValid) continue;
            
            const churchScript = church.getComponent('Church') as any;
            if (!churchScript || !churchScript.isAlive || !churchScript.isAlive()) continue;
            
            const dx = church.worldPosition.x - myPos.x;
            const dy = church.worldPosition.y - myPos.y;
            const distanceSq = dx * dx + dy * dy;
            
            if (distanceSq <= detectionRangeSq) {
                if (PRIORITY.BUILDING < targetPriority || 
                    (PRIORITY.BUILDING === targetPriority && distanceSq < minDistanceSq)) {
                    minDistanceSq = distanceSq;
                    nearestTarget = church;
                    targetPriority = PRIORITY.BUILDING;
                }
            }
        }

        // 如果找到目标，设置为当前目标
        // 但是，如果当前目标是石墙（网格最上层没有缺口时设置的），且新找到的目标不是石墙，不要替换
        if (nearestTarget && nearestTarget.isValid) {
            // 检查当前目标是否有效，避免访问已销毁的节点
            let currentWallScript: any = null;
            if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
                try {
                    currentWallScript = this.currentTarget.getComponent('StoneWall') as any;
                } catch (e) {
                    // 如果获取组件失败，说明节点可能已被销毁，忽略错误
                    console.warn('[Enemy.findTarget] Failed to get StoneWall component from currentTarget:', e);
                }
            }
            const isCurrentTargetGridTopLayerWall = currentWallScript && this.checkEnemyAboveGrid() && !this.topLayerGapTarget;
            const newTargetIsWall = nearestTarget.isValid ? nearestTarget.getComponent('StoneWall') !== null : false;
            
            if (isCurrentTargetGridTopLayerWall && !newTargetIsWall) {
                // 当前目标是网格最上层没有缺口时设置的石墙，且新目标不是石墙，保持当前目标
                return;
            }
            
            this.currentTarget = nearestTarget;
        } else {
            if (this.checkEnemyAboveGrid()){
                // 当前敌人在网格之上，保持当前目标
                return;
            }
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

    private moveTowardsTarget(deltaTime: number) {
        if (!this.currentTarget) {
            return;
        }

        // 如果正在播放攻击动画，停止攻击动画并切换到移动动画
        if (this.isPlayingAttackAnimation) {
            this.isPlayingAttackAnimation = false;
            this.attackComplete = false;
            this.stopAllAnimations();
        }

        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        // 性能优化：使用平方距离比较，避免开方运算
        const distanceSq = direction.lengthSqr();
        const attackRangeSq = this.attackRange * this.attackRange;
        
        // 检查目标是否是石墙
        const targetScript = this.currentTarget.getComponent('StoneWall') as any;
        const isTargetStoneWall = !!targetScript;

        // 如果目标是石墙，使用简化的移动逻辑：直接移动到攻击范围内
        if (isTargetStoneWall) {
            // 检查是否已经在攻击范围内（使用平方距离）
            if (distanceSq <= attackRangeSq) {
                // 已经在攻击范围内，停止移动，让update()方法处理攻击
                return;
            }
            
            // 直接向石墙移动，即使检测到碰撞也要继续移动，直到进入攻击范围
            direction.normalize();
            const moveStep = this.moveSpeed * deltaTime;
            const currentPos = this.node.worldPosition.clone();
            const newPos = new Vec3();
            Vec3.scaleAndAdd(newPos, currentPos, direction, moveStep);
            
            // 性能优化：检查新位置到石墙的距离（使用平方距离）
            const newDx = newPos.x - this.currentTarget.worldPosition.x;
            const newDy = newPos.y - this.currentTarget.worldPosition.y;
            const newDistanceSq = newDx * newDx + newDy * newDy;

            // 如果移动后距离小于等于攻击范围，允许移动到该位置（即使检测到碰撞）
            if (newDistanceSq <= attackRangeSq) {
                // 移动后会在攻击范围内，正常移动（忽略碰撞检测）
                
                const clampedPos = this.clampPositionToScreen(newPos);
                
                // 检查位置是否被限制（如果被限制，说明可能到达了屏幕边界）
                const wasClamped = Math.abs(clampedPos.x - newPos.x) > 0.1 || Math.abs(clampedPos.y - newPos.y) > 0.1;
                if (wasClamped) {
                }
                
                this.node.setWorldPosition(clampedPos);
                this.flipDirection(direction);
                this.playWalkAnimation();
            } else {
                // 移动后距离仍然大于攻击范围，计算攻击范围边缘位置并移动到那里
                const targetPos = this.currentTarget.worldPosition;
                const attackRangePos = new Vec3();
                // 从石墙位置向敌人方向后退 attackRange 距离
                Vec3.scaleAndAdd(attackRangePos, targetPos, direction, -this.attackRange);
                
                // 计算从当前位置到攻击范围边缘的移动方向
                const moveToRangeDirection = new Vec3();
                Vec3.subtract(moveToRangeDirection, attackRangePos, currentPos);
                const moveToRangeDistance = moveToRangeDirection.length();

                if (moveToRangeDistance > moveStep) {
                    // 还需要移动，计算新位置
                    moveToRangeDirection.normalize();
                    Vec3.scaleAndAdd(newPos, currentPos, moveToRangeDirection, moveStep);
                    
                    // 检查新位置是否会被clampPositionToScreen限制
                    const clampedPos = this.clampPositionToScreen(newPos);

                    // 检查位置是否被限制（如果被限制，说明可能到达了屏幕边界）
                    const wasClamped = Math.abs(clampedPos.x - newPos.x) > 0.1 || Math.abs(clampedPos.y - newPos.y) > 0.1;
                    if (wasClamped) {
                    }

                    this.node.setWorldPosition(clampedPos);
                    this.flipDirection(moveToRangeDirection);
                    this.playWalkAnimation();
                } else {
                    // 已经到达攻击范围边缘，直接移动到该位置
                    
                    const clampedPos = this.clampPositionToScreen(attackRangePos);
                    this.node.setWorldPosition(clampedPos);
                    this.flipDirection(direction);
                }
            }
            return;
        }
        
        // 非石墙目标的移动逻辑（保持原有逻辑，使用平方距离）
        const minDistanceSq = 0.01; // 0.1的平方
        if (distanceSq > minDistanceSq) {
            direction.normalize();
            
            // 应用敌人避让逻辑
            const finalDirection = this.calculateEnemyAvoidanceDirection(this.node.worldPosition, direction, deltaTime);
            
            const newPos = new Vec3();
            Vec3.scaleAndAdd(newPos, this.node.worldPosition, finalDirection, this.moveSpeed * deltaTime);

            // 检查移动路径上是否有石墙阻挡
            const hasCollision = this.checkCollisionWithStoneWall(newPos);
            
            if (hasCollision) {
                // 检查碰撞的石墙是否是目标石墙
                const blockingWall = this.getBlockingStoneWall(newPos);
                const isTargetWall = blockingWall && blockingWall === this.currentTarget;
                
                if (isTargetWall) {
                    // 碰撞的是目标石墙，说明已经到达，停止移动
                    return;
                } else {
                    // 路径被其他石墙阻挡，先尝试局部绕路
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
                        // 全局路径可以绕行，继续尝试移动（可能只是局部阻挡）
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
                        const nearestWall = this.findNearestStoneWall();
                        if (nearestWall) {
                            this.currentTarget = nearestWall;
                            return;
                        }
                        // 找不到石墙，停止移动
                        return;
                    }
                }
            } else {
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

    private moveTowardsCrystal(deltaTime: number) {
        if (!this.targetCrystal || !this.targetCrystal.isValid) {
            return;
        }

        // 优先检查是否需要进入网格寻路模式
        if (!this.isInStoneWallGrid && this.checkStoneWallGridBelowEnemy()) {
            // checkStoneWallGridBelowEnemy() 已经检查了是否到达最底层，所以这里直接进入网格寻路模式
            this.isInStoneWallGrid = true;
            // const moveInGridStartTime3 = PerformanceMonitor.startTiming('Enemy.moveInStoneWallGrid');
            this.moveInStoneWallGrid(deltaTime);
            // PerformanceMonitor.endTiming('Enemy.moveInStoneWallGrid', moveInGridStartTime3, 3);
            return;
        }

        // 如果已经在网格寻路模式中，不需要执行后续逻辑
        if (this.isInStoneWallGrid) {
            return;
        }

        // 如果检测到目标（包括石墙），停止朝水晶移动，让update()方法处理目标
        if (this.currentTarget) {
            return;
        }

        // 如果正在播放攻击动画，停止攻击动画并切换到移动动画
        if (this.isPlayingAttackAnimation) {
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
        
        const moveDistance = this.moveSpeed * deltaTime;
        const perpendicular = new Vec3(-direction.y, direction.x, 0); // 垂直于移动方向的方向
        
        // 使用较小的偏移距离，让移动更平滑
        const offsetDistances = [30, 50, 80]; // 逐步增加偏移距离

        // 尝试不同偏移距离的绕路
        for (const offsetDistance of offsetDistances) {
            // 尝试右侧绕路（优先右侧绕路，符合用户需求）
            const rightOffset = new Vec3();
            Vec3.scaleAndAdd(rightOffset, this.node.worldPosition, perpendicular, -offsetDistance);
            const rightPos = new Vec3();
            Vec3.scaleAndAdd(rightPos, rightOffset, direction, moveDistance);
            const rightCollision = this.checkCollisionWithStoneWall(rightPos);
            if (!rightCollision) {
                return rightPos;
            }
            
            // 尝试左侧绕路
            const leftOffset = new Vec3();
            Vec3.scaleAndAdd(leftOffset, this.node.worldPosition, perpendicular, offsetDistance);
            const leftPos = new Vec3();
            Vec3.scaleAndAdd(leftPos, leftOffset, direction, moveDistance);
            const leftCollision = this.checkCollisionWithStoneWall(leftPos);
            if (!leftCollision) {
                return leftPos;
            }
        }
        
        // 无法找到可行的绕路位置
        return null;
    }

    /**
     * 查找最近的石墙
     * @returns 最近的石墙节点，如果没有找到返回null
     */
    private findNearestStoneWall(): Node | null {
        // 从Canvas/StoneWalls容器节点获取所有石墙
        let stoneWalls: Node[] = [];
        const stoneWallsNode = find('Canvas/StoneWalls');
        if (stoneWallsNode) {
            stoneWalls = stoneWallsNode.children || [];
        }

        let nearestWall: Node | null = null;
        let minDistance = Infinity;

        for (const wall of stoneWalls) {
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
        // 从Canvas/StoneWalls容器节点获取所有石墙
        let stoneWalls: Node[] = [];
        const stoneWallsNode = find('Canvas/StoneWalls');
        if (stoneWallsNode) {
            stoneWalls = stoneWallsNode.children || [];
        }

        for (const wall of stoneWalls) {
            if (!wall || !wall.active || !wall.isValid) continue;
            
            const wallScript = wall.getComponent('StoneWall') as any;
            // 检查石墙是否被摧毁（如果有isDestroyed属性）
            if (wallScript && wallScript.isDestroyed === true) continue;

            const wallPos = wall.worldPosition;
            const wallRadius = wallScript.collisionRadius ?? 25; // 使用预制体设置的值，如果没有设置则默认为25
            const distance = Vec3.distance(position, wallPos);

            // 如果距离小于碰撞半径，说明该位置有石墙
            if (distance < wallRadius) {
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
        // 从Canvas/StoneWalls容器节点获取所有石墙
        let stoneWalls: Node[] = [];
        const stoneWallsNode = find('Canvas/StoneWalls');
        if (stoneWallsNode) {
            stoneWalls = stoneWallsNode.children || [];
        }

        const enemyRadius = 20; // 敌人的碰撞半径

        for (const wall of stoneWalls) {
            if (!wall || !wall.active || !wall.isValid) continue;
            
            const wallScript = wall.getComponent('StoneWall') as any;
            if (!wallScript || !wallScript.isAlive || !wallScript.isAlive()) continue;

            const wallPos = wall.worldPosition;
            const wallRadius = wallScript.collisionRadius ?? 25; // 使用预制体设置的值，如果没有设置则默认为25
            const distanceToWall = Vec3.distance(position, wallPos);
            const minDistance = enemyRadius + wallRadius;

            // 如果距离小于最小距离，说明碰撞
            if (distanceToWall < minDistance) {
                return wall;
            }
        }

        return null;
    }

    private checkCollisionWithStoneWall(position: Vec3): boolean {
        const blockingWall = this.getBlockingStoneWall(position);
        if (blockingWall) {
            return true;
        }
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
            // 对话框反向翻转，保持正常朝向（文字从左往右）
            if (this.dialogNode && this.dialogNode.isValid) {
                this.dialogNode.setScale(-1, 1, 1);
            }
        } else {
            // 向右移动，正常朝向
            this.node.setScale(Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
            // 血条正常朝向
            if (this.healthBarNode && this.healthBarNode.isValid) {
                this.healthBarNode.setScale(1, 1, 1);
            }
            // 对话框正常朝向（文字从左往右）
            if (this.dialogNode && this.dialogNode.isValid) {
                this.dialogNode.setScale(1, 1, 1);
            }
        }
    }

    stopMoving() {
        // 停止移动，只有在没有播放其他动画时才切换到待机动画
        if (!this.isPlayingAttackAnimation && !this.isPlayingHitAnimation && !this.isPlayingDeathAnimation) {
            this.playIdleAnimation();
        }
    }

    /**
     * 性能优化：更新LOD级别（根据距离摄像机远近）
     */
    private updateLOD() {
        if (!this.cameraNode || !this.cameraNode.isValid) {
            // 如果摄像机节点无效，尝试重新查找
            const camera = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
            if (camera) {
                this.cameraNode = camera;
            } else {
                // 找不到摄像机，使用默认LOD级别
                this.updateSkipInterval = 1;
                return;
            }
        }
        
        // 计算到摄像机的距离（使用平方距离，避免开方）
        const enemyPos = this.node.worldPosition;
        const cameraPos = this.cameraNode.worldPosition;
        const dx = enemyPos.x - cameraPos.x;
        const dy = enemyPos.y - cameraPos.y;
        const distanceSq = dx * dx + dy * dy;
        this.cachedDistanceToCamera = Math.sqrt(distanceSq); // 缓存实际距离用于调试
        
        // 根据距离设置更新间隔
        if (this.cachedDistanceToCamera <= this.LOD_NEAR_DISTANCE) {
            // 近距离：每帧更新（updateSkipInterval = 1）
            this.updateSkipInterval = 1;
        } else if (this.cachedDistanceToCamera <= this.LOD_MID_DISTANCE) {
            // 中距离：每2帧更新一次
            this.updateSkipInterval = 2;
        } else {
            // 远距离：每3-4帧更新一次（根据距离动态调整）
            const farFactor = Math.min(4, Math.floor((this.cachedDistanceToCamera - this.LOD_MID_DISTANCE) / 300) + 3);
            this.updateSkipInterval = farFactor;
        }
    }

    // 动画更新方法
    updateAnimation(deltaTime: number) {
        if (!this.sprite) {
            return;
        }

        this.animationTimer += deltaTime;

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
        if (this.walkAnimationFrames.length === 0) {
            this.isPlayingWalkAnimation = false;
            return;
        }
        const frameDuration = this.walkAnimationDuration / this.walkAnimationFrames.length;
        const frameIndex = Math.floor(this.animationTimer / frameDuration) % this.walkAnimationFrames.length;
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
        
        if (this.isDestroyed) {
            return;
        }

        // 如果正在播放其他动画（攻击、被攻击、待机），需要停止并切换到行走动画
        if (this.isPlayingAttackAnimation || this.isPlayingHitAnimation || this.isPlayingIdleAnimation) {
            this.stopAllAnimations();
            this.isPlayingWalkAnimation = true;
            this.animationTimer = 0;
            this.currentAnimationFrameIndex = -1;
            
            // 立即播放第一帧，确保动画可见
            if (this.walkAnimationFrames.length > 0 && this.walkAnimationFrames[0] && this.sprite) {
                this.sprite.spriteFrame = this.walkAnimationFrames[0];
                this.currentAnimationFrameIndex = 0;
            } else {
            }
            
        } else if (!this.isPlayingWalkAnimation) {
            // 没有在播放任何动画，直接切换到行走动画
            this.isPlayingWalkAnimation = true;
            this.animationTimer = 0;
            this.currentAnimationFrameIndex = -1;
            
            // 立即播放第一帧，确保动画可见
            if (this.walkAnimationFrames.length > 0 && this.walkAnimationFrames[0] && this.sprite) {
                this.sprite.spriteFrame = this.walkAnimationFrames[0];
                this.currentAnimationFrameIndex = 0;
            } else {
            }
        } else {
            // 已经在播放行走动画，重置动画计时器确保动画正常播放
            // this.animationTimer = 0;
            // this.currentAnimationFrameIndex = -1;
            
            // // 立即播放第一帧，确保动画可见
            // if (this.walkAnimationFrames.length > 0 && this.walkAnimationFrames[0] && this.sprite) {
            //     this.sprite.spriteFrame = this.walkAnimationFrames[0];
            //     this.currentAnimationFrameIndex = 0;
            // } else {
            // }
        }
    }

    // 播放攻击动画
    playAttackAnimation() {
        // 性能监控：开始计时
        // const playAnimStartTime = PerformanceMonitor.startTiming('Enemy.playAttackAnimation');
        
        if (this.isPlayingDeathAnimation || this.isDestroyed) {
            // PerformanceMonitor.endTiming('Enemy.playAttackAnimation', playAnimStartTime, 0);
            return;
        }

        // 1. 停止所有动画
        // const stopAnimStartTime = PerformanceMonitor.startTiming('Enemy.playAttackAnimation.stopAllAnimations');
        this.stopAllAnimations();
        // PerformanceMonitor.endTiming('Enemy.playAttackAnimation.stopAllAnimations', stopAnimStartTime, 0);
        
        // 设置攻击动画状态
        this.isPlayingAttackAnimation = true;
        this.attackComplete = false;
        this.animationTimer = 0;
        this.currentAnimationFrameIndex = -1;

        // 2. 播放攻击音效
        // const soundStartTime = PerformanceMonitor.startTiming('Enemy.playAttackAnimation.playSound');
        if (this.attackSound) {
            AudioManager.Instance.playSFX(this.attackSound);
        } else {
        }
        // PerformanceMonitor.endTiming('Enemy.playAttackAnimation.playSound', soundStartTime, 0);
        
        // 3. 如果使用Animation组件播放攻击动画（用于需要Animation组件的情况）
        if (this.animationComponent) {
            // 3.1 清除之前的动画事件
            // const offStartTime = PerformanceMonitor.startTiming('Enemy.playAttackAnimation.animationOff');
            this.animationComponent.off(Animation.EventType.FINISHED);
            // PerformanceMonitor.endTiming('Enemy.playAttackAnimation.animationOff', offStartTime, 0);
            
            // 3.2 先停止当前可能正在播放的动画，确保每次都能重新开始
            // const stopStartTime = PerformanceMonitor.startTiming('Enemy.playAttackAnimation.animationStop');
            this.animationComponent.stop();
            // PerformanceMonitor.endTiming('Enemy.playAttackAnimation.animationStop', stopStartTime, 0);
            
            // 3.3 获取动画状态，设置动画速度与attackAnimationDuration保持同步
            // const getStateStartTime = PerformanceMonitor.startTiming('Enemy.playAttackAnimation.getState');
            const state = this.animationComponent.getState(this.attackAnimationName);
            if (state) {
                // 重置动画播放头到开始位置
                state.time = 0;
                // 设置动画时长与attackAnimationDuration参数保持一致
                state.speed = state.duration / this.attackAnimationDuration;
            } else {
            }
            // PerformanceMonitor.endTiming('Enemy.playAttackAnimation.getState', getStateStartTime, 0);
            
            // 3.4 注册动画完成事件监听器，确保动画播放完成后立即重置状态
            // const onceStartTime = PerformanceMonitor.startTiming('Enemy.playAttackAnimation.animationOnce');
            this.animationComponent.once(Animation.EventType.FINISHED, () => {
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
            // PerformanceMonitor.endTiming('Enemy.playAttackAnimation.animationOnce', onceStartTime, 0);
            
            // 3.5 播放动画
            // const playStartTime = PerformanceMonitor.startTiming('Enemy.playAttackAnimation.animationPlay');
            this.animationComponent.play(this.attackAnimationName);
            // PerformanceMonitor.endTiming('Enemy.playAttackAnimation.animationPlay', playStartTime, 0);
            
            // 3.6 在动画播放到一半时造成伤害（与动画帧方式保持一致）
            // const scheduleStartTime = PerformanceMonitor.startTiming('Enemy.playAttackAnimation.scheduleOnce');
            const damageTimer = this.attackAnimationDuration * 0.5;
            this.scheduleOnce(() => {
                if (this.isPlayingAttackAnimation && !this.attackComplete) {
                    this.dealDamage();
                    this.attackComplete = true;
                } else {
                }
            }, damageTimer);
            
            // 同时使用scheduleOnce作为备用方案，确保即使事件监听失败也能重置状态
            const finishTimer = this.attackAnimationDuration;
            this.scheduleOnce(() => {
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
            }, finishTimer);
            // PerformanceMonitor.endTiming('Enemy.playAttackAnimation.scheduleOnce', scheduleStartTime, 0);
        } else {
        }
        
        // 性能监控：结束计时
        // PerformanceMonitor.endTiming('Enemy.playAttackAnimation', playAnimStartTime, 0);
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
        
    }

    // 恢复默认精灵帧
    restoreDefaultSprite() {
        if (this.sprite && this.defaultSpriteFrame) {
            this.sprite.spriteFrame = this.defaultSpriteFrame;
        }
    }

    protected attack() {
        // 性能监控：开始计时
        // const attackStartTime = PerformanceMonitor.startTiming('Enemy.attack');
        
        // 1. 目标有效性检查
        // const checkStartTime = PerformanceMonitor.startTiming('Enemy.attack.checkTarget');
        if (!this.currentTarget || this.isDestroyed) {
            // PerformanceMonitor.endTiming('Enemy.attack.checkTarget', checkStartTime, 0);
            // PerformanceMonitor.endTiming('Enemy.attack', attackStartTime, 0);
            return;
        }

        // 再次检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            // PerformanceMonitor.endTiming('Enemy.attack.checkTarget', checkStartTime, 0);
            // PerformanceMonitor.endTiming('Enemy.attack', attackStartTime, 0);
            return;
        }
        // PerformanceMonitor.endTiming('Enemy.attack.checkTarget', checkStartTime, 0);

        // 2. 获取位置和距离计算
        // const positionStartTime = PerformanceMonitor.startTiming('Enemy.attack.getPosition');
        const targetPos = this.currentTarget.worldPosition;
        const enemyPos = this.node.worldPosition;
        // 性能优化：使用平方距离比较
        const dx = targetPos.x - enemyPos.x;
        const dy = targetPos.y - enemyPos.y;
        const distanceSq = dx * dx + dy * dy;
        const attackRangeSq = this.attackRange * this.attackRange;
        // PerformanceMonitor.endTiming('Enemy.attack.getPosition', positionStartTime, 0);

        // 3. 距离检查
        // const distanceCheckStartTime = PerformanceMonitor.startTiming('Enemy.attack.distanceCheck');
        // 检查距离是否在攻击范围内（使用平方距离）
        if (distanceSq > attackRangeSq) {
            // 如果正在播放攻击动画，停止攻击动画
            if (this.isPlayingAttackAnimation) {
                this.isPlayingAttackAnimation = false;
                this.attackComplete = false;
            }
            // PerformanceMonitor.endTiming('Enemy.attack.distanceCheck', distanceCheckStartTime, 0);
            // PerformanceMonitor.endTiming('Enemy.attack', attackStartTime, 0);
            return;
        }
        // PerformanceMonitor.endTiming('Enemy.attack.distanceCheck', distanceCheckStartTime, 0);

        // 4. 方向计算和翻转
        // const directionStartTime = PerformanceMonitor.startTiming('Enemy.attack.calculateDirection');
        // 攻击时朝向目标方向
        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        this.flipDirection(direction);
        // PerformanceMonitor.endTiming('Enemy.attack.calculateDirection', directionStartTime, 0);

        // 5. 播放攻击动画（使用动画帧，在updateAttackAnimation中造成伤害）
        // const animationStartTime = PerformanceMonitor.startTiming('Enemy.attack.playAnimation');
        this.playAttackAnimation();
        // PerformanceMonitor.endTiming('Enemy.attack.playAnimation', animationStartTime, 0);
        
        // 性能监控：结束计时
        // PerformanceMonitor.endTiming('Enemy.attack', attackStartTime, 2);
    }
    
    /**
     * 处理实际伤害（在攻击动画中途调用）
     */
    protected dealDamage() {
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }

        // 检查距离是否在攻击范围内（性能优化：使用平方距离比较）
        const targetPos = this.currentTarget.worldPosition;
        const enemyPos = this.node.worldPosition;
        const dx = targetPos.x - enemyPos.x;
        const dy = targetPos.y - enemyPos.y;
        const distanceSq = dx * dx + dy * dy;
        const attackRangeSq = this.attackRange * this.attackRange;
        if (distanceSq > attackRangeSq) {
            // 停止攻击动画
            this.isPlayingAttackAnimation = false;
            this.attackComplete = false;
            this.playIdleAnimation();
            return;
        }

        const towerScript = this.currentTarget.getComponent('Arrower') as any;
        const warAncientTreeScript = this.currentTarget.getComponent('WarAncientTree') as any;
        const hallScript = this.currentTarget.getComponent('HunterHall') as any;
        const swordsmanHallScript = this.currentTarget.getComponent('SwordsmanHall') as any;
        const churchScript = this.currentTarget.getComponent('Church') as any;
        const priestScript = this.currentTarget.getComponent('Priest') as any;
        const crystalScript = this.currentTarget.getComponent('Crystal') as any;
        const hunterScript = this.currentTarget.getComponent('Hunter') as any;
        const elfSwordsmanScript = this.currentTarget.getComponent('ElfSwordsman') as any;
        const stoneWallScript = this.currentTarget.getComponent('StoneWall') as any;
        const targetScript = towerScript || warAncientTreeScript || hallScript || swordsmanHallScript || churchScript || priestScript || crystalScript || hunterScript || elfSwordsmanScript || stoneWallScript;
        
        if (targetScript && targetScript.takeDamage) {
            targetScript.takeDamage(this.attackDamage);
            
            // 检查目标是否仍然存活，特别是石墙
            if (targetScript && targetScript.isAlive && !targetScript.isAlive()) {
                const wasStoneWall = !!stoneWallScript;
                this.currentTarget = null!;
                
                // 清除缺口标记
                this.topLayerGapTarget = null;
                
                // 如果摧毁的是石墙，检查是否需要重新进入网格寻路模式
                if (wasStoneWall) {
                    // 重置攻击动画状态，让下一帧自动切换到移动动画
                    if (this.isPlayingAttackAnimation) {
                        this.isPlayingAttackAnimation = false;
                        this.attackComplete = false;
                        // 停止所有动画，让下一帧的移动逻辑自动切换到移动动画
                        this.stopAllAnimations();
                    }
                    // 如果不在网格内寻路，清除网格寻路状态，下一帧会重新检查是否需要进入网格寻路模式
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

        // 清理对话框
        if (this.dialogNode && this.dialogNode.isValid) {
            this.dialogNode.destroy();
        }
        this.dialogNode = null;
        this.dialogLabel = null;
        
        // 立即停止所有移动和动画
        this.stopAllAnimations();
        
        // 移除绕行点标记

        // 奖励金币和经验值
        if (!this.gameManager) {
            this.findGameManager();
        }
        if (this.gameManager) {
            this.gameManager.addGold(this.goldReward);
            // 确保 expReward 有效才添加经验值
            if (this.expReward > 0) {
                this.gameManager.addExperience(this.expReward);
            }
        } else {
            // 如果找不到 GameManager，输出警告
            console.warn(`[Enemy] GameManager not found when ${this.unitName || 'Enemy'} died, expReward: ${this.expReward}`);
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

        // 性能优化：使用对象池回收敌人，而不是直接销毁
        const returnToPool = () => {
            const enemyPool = EnemyPool.getInstance();
            if (enemyPool && this.node && this.node.isValid) {
                // 重置敌人状态（在返回对象池前）
                this.resetEnemyState();
                // 返回到对象池
                enemyPool.release(this.node, this.prefabName);
            } else {
                // 如果对象池不存在，直接销毁
                if (this.node && this.node.isValid) {
                    this.node.destroy();
                }
            }
        };
        
        // 如果有死亡动画帧，等待动画播放完成后返回对象池
        if (this.deathAnimationFrames.length > 0) {
            // 延迟返回对象池，等待死亡动画播放完成
            setTimeout(() => {
                returnToPool();
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
                            // 返回对象池而不是销毁
                            returnToPool();
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
     * 重置敌人状态（用于对象池回收）
     */
    private resetEnemyState() {
        // 重置所有状态变量
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        this.targetFindTimer = 0;
        this.currentTarget = null!;
        this.topLayerGapTarget = null;
        this.isInStoneWallGrid = false;
        this.isHit = false;
        this.isPlayingAttackAnimation = false;
        this.isPlayingHitAnimation = false;
        this.isPlayingDeathAnimation = false;
        this.isPlayingIdleAnimation = false;
        this.isPlayingWalkAnimation = false;
        this.attackComplete = false;
        
        // 重置LOD相关
        this.updateSkipCounter = 0;
        this.updateSkipInterval = 1;
        this.animationUpdateTimer = 0;
        this.lastDistanceCheckTime = 0;
        this.lastGridCheckTime = 0;
        this.lastAboveGridCheckTime = 0;
        this.lastComponentCheckTime = 0;
        this.cachedCurrentGrid = null;
        this.cachedIsAboveGrid = false;
        this.cachedTargetComponent = null;
        
        // 重置动画
        this.currentAnimationFrameIndex = 0;
        this.animationTimer = 0;
        
        // 重置节点状态
        if (this.node) {
            this.node.setScale(this.defaultScale);
            this.node.angle = 0;
            if (this.sprite) {
                const color = this.sprite.color.clone();
                color.a = 255;
                this.sprite.color = color;
            }
        }
        
        // 清理对话框
        if (this.dialogNode && this.dialogNode.isValid) {
            this.dialogNode.destroy();
        }
        this.dialogNode = null;
        this.dialogLabel = null;
        
        // 清理血条
        if (this.healthBarNode && this.healthBarNode.isValid) {
            this.healthBarNode.destroy();
        }
        this.healthBarNode = null!;
        this.healthBar = null!;
    }

    /**
     * 查找石墙网格面板组件
     */
    private findStoneWallGridPanel() {
        if (this.stoneWallGridPanelComponent) {
            return;
        }

        // 从编辑器节点获取（Canvas/StoneWallGridPanel）
        const stoneWallGridPanelNode = find('Canvas/StoneWallGridPanel');
        if (stoneWallGridPanelNode) {
            this.stoneWallGridPanelComponent = stoneWallGridPanelNode.getComponent(StoneWallGridPanel);
        }
    }

    /**
     * 检查石墙网格是否在敌人下方
     */
    private checkStoneWallGridBelowEnemy(): boolean {
        this.findStoneWallGridPanel();
        
        if (!this.stoneWallGridPanelComponent) {
            return false;
        }

        const enemyPos = this.node.worldPosition;
        
        // 首先检查敌人当前所在的网格坐标
        const grid = this.stoneWallGridPanelComponent.worldToGrid(enemyPos);

        // 如果敌人已经在最底层（gridY=0或更小），不需要再进入网格寻路模式
        if (grid && grid.y <= 0) {
            return false;
        }
        
        // 如果敌人不在网格内，但y坐标已经小于等于最底层（约500），也不需要进入网格寻路模式
        // 网格范围：y:500-1000，x:0-750
        const gridMinY = 500; // 最底层（gridY=0）的y坐标
        if (!grid && enemyPos.y <= gridMinY) {
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
                    return false;
                }
                
                // 如果敌人还没有到达最底层（gridY=0，即y约500），需要进入网格寻路
                if (enemyPos.y > gridMinY + 25) { // 25是半个格子的容差
                    return true;
                } else {
                }
            }
        }

        return false;
    }

    /**
     * 检查敌人是否在网格上方
     */
    private checkEnemyAboveGrid(): boolean {
        this.findStoneWallGridPanel();
        
        if (!this.stoneWallGridPanelComponent) {
            return false;
        }

        const enemyPos = this.node.worldPosition;
        const gridMaxY = 975; // 最上层（gridY=9）的y坐标 减去一个石墙半径

        // 检查敌人是否在网格上方（y坐标 > gridMaxY），且在网格x范围内
        const isAbove = enemyPos.y > gridMaxY;
        
        return isAbove;
    }

    /**
     * 找到网格最上层的缺口
     */
    private findGapInTopLayer(): Vec3 | null {
        this.findStoneWallGridPanel();
        
        if (!this.stoneWallGridPanelComponent) {
            return null;
        }

        const enemyPos = this.node.worldPosition;
        const gridWidth = this.stoneWallGridPanelComponent.gridWidth;
        const gridHeight = this.stoneWallGridPanelComponent.gridHeight;
        const topLayerY = gridHeight - 1; // 最上层（gridY从0开始，所以是gridHeight-1）

        // 创建一个测试位置，y坐标使用网格最上层的y坐标
        const testGridPos = this.stoneWallGridPanelComponent.gridToWorld(0, topLayerY);
        if (!testGridPos) {
            return null;
        }
        
        // 使用敌人的x坐标找到对应的网格列
        const testWorldPos = new Vec3(enemyPos.x, testGridPos.y, 0);
        const enemyGrid = this.stoneWallGridPanelComponent.worldToGrid(testWorldPos);
        
        let startX = 0;
        if (enemyGrid && enemyGrid.y === topLayerY) {
            startX = enemyGrid.x;
        } else {
            // 如果无法转换，使用粗略计算（假设网格从x=0开始，每格50像素）
            startX = Math.max(0, Math.min(gridWidth - 1, Math.floor((enemyPos.x - this.stoneWallGridPanelComponent.node.worldPosition.x + (gridWidth * 50) / 2) / 50)));
        }

        let bestGap: Vec3 | null = null;
        let minDistance = Infinity;
        let directBelowGap: Vec3 | null = null; // 正下方的缺口

        // 直接遍历最上层的所有网格位置，只需一次循环
        for (let x = 0; x < gridWidth; x++) {
            // 检查网格是否被占用
            if (!this.stoneWallGridPanelComponent.isGridOccupied(x, topLayerY)) {
                const worldPos = this.stoneWallGridPanelComponent.gridToWorld(x, topLayerY);
                if (worldPos) {
                    // 检查该位置附近是否有石墙节点（通过搜索场景中的石墙节点）
                    // const hasStoneWallAtPosition = this.checkStoneWallAtPosition(worldPos);
                    // if (!hasStoneWallAtPosition) {
                        // 计算到敌人的距离（仅考虑x方向，因为敌人是在上方）
                        const distanceX = Math.abs(worldPos.x - enemyPos.x);
                        
                        // 优先检查正下方的位置
                        if (x === startX) {
                            directBelowGap = worldPos;
                            // 如果找到正下方的缺口，直接返回
                            return directBelowGap;
                        }
                        
                        // 记录距离最近的缺口
                        if (distanceX < minDistance) {
                            minDistance = distanceX;
                            bestGap = worldPos;
                        }
                    // }
                }
            }
        }
        
        // 如果找到了正下方的缺口，返回它；否则返回最近的缺口
        return directBelowGap || bestGap;
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

        // 从Canvas/StoneWalls容器节点获取所有石墙
        let stoneWalls: Node[] = [];
        const stoneWallsNode = find('Canvas/StoneWalls');
        if (stoneWallsNode) {
            const containerWalls = stoneWallsNode.children || [];
            stoneWalls.push(...containerWalls);
        }

        // 过滤出有效的石墙（有StoneWall组件且存活）
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
     * 在网格内移动（已简化：不再使用A*路径，直接向下移动+左右绕行）
     * 
     */
    private moveInStoneWallGrid(deltaTime: number) {
        // 如果正在播放攻击动画，停止攻击动画并切换到移动动画
        if (this.isPlayingAttackAnimation) {
            this.isPlayingAttackAnimation = false;
            this.attackComplete = false;
            this.stopAllAnimations();
        }

        // 检查是否已经到达最底层（gridY=0）
        this.findStoneWallGridPanel();
        if (!this.stoneWallGridPanelComponent) {
            this.isInStoneWallGrid = false;
            this.gridMoveState = null;
            this.gridMoveTargetX = null;
            return;
        }

        // 性能优化：缓存网格位置，减少worldToGrid调用
        const enemyPos = this.node.worldPosition;
        if (!this.cachedCurrentGrid || this.lastGridCheckTime >= this.GRID_CHECK_INTERVAL) {
            this.cachedCurrentGrid = this.stoneWallGridPanelComponent.worldToGrid(enemyPos);
            this.lastGridCheckTime = 0;
        }
        this.lastGridCheckTime += deltaTime;
        
        if (this.cachedCurrentGrid && this.cachedCurrentGrid.y <= 0) {
            // 已到达最底层，退出网格寻路模式
            this.isInStoneWallGrid = false;
            this.gridMoveState = null;
            this.gridMoveTargetX = null;
            return;
        }
        // 获取当前网格的中心位置
        const currentGridCenter = this.stoneWallGridPanelComponent.gridToWorld(this.cachedCurrentGrid.x, this.cachedCurrentGrid.y);

        const moveDistance = this.moveSpeed * deltaTime;
        let finalDirection = new Vec3(0, -1, 0); // 默认向下
        
        // 如果还没有移动状态，初始化为向下
        if (this.gridMoveState === null) {
            this.gridMoveState = 'down';
            this.gridMoveTargetX = null;
        }

        // 根据当前移动状态决定移动方向
        if (this.gridMoveState === 'down') {
            // 向下移动：检查是否到达当前网格底部
            if (enemyPos.y <= currentGridCenter.y) {
                // 到达底部，检查下方是否有阻挡
                if (this.cachedCurrentGrid && this.cachedCurrentGrid.y > 0) {
                    const nextGridY = this.cachedCurrentGrid.y - 1;
                    const isBlockedDown = this.stoneWallGridPanelComponent.isGridOccupied(this.cachedCurrentGrid.x, nextGridY);
                    
                    if (isBlockedDown) {
                        // 下方有阻挡，需要左右绕行
                        const targetGridX = this.findAvailableSideGrid();
                        if (targetGridX !== null) {
                            this.gridMoveState = targetGridX > this.cachedCurrentGrid!.x ? 'right' : 'left';
                            this.gridMoveTargetX = targetGridX;
                        } else {
                            // 左右都被阻挡，尝试攻击最近的石墙
                            const nearestWall = this.findNearestStoneWall();
                            if (nearestWall) {
                                this.isInStoneWallGrid = false;
                                this.gridMoveState = null;
                                this.gridMoveTargetX = null;
                                this.currentTarget = nearestWall;
                                return;
                            }
                            // 如果找不到石墙，继续向下（可能会卡住）
                        }
                    }
                    // 如果下方无阻挡，继续向下移动
                }
            }
            // 如果还没到达底部，继续向下移动
            finalDirection = new Vec3(0, -1, 0);
        } else if (this.gridMoveState === 'left' || this.gridMoveState === 'right') {
            // 左右移动：检查敌人是否到达目标网格的中心（x坐标） 允许2像素的误差
            if (Math.abs(enemyPos.x - currentGridCenter.x) <= 2) {
                // 到达目标网格中心，检查下方是否有阻挡
                if (this.cachedCurrentGrid && this.cachedCurrentGrid.y > 0) {
                    const nextGridY = this.cachedCurrentGrid.y - 1;
                    const isBlockedDown = this.stoneWallGridPanelComponent.isGridOccupied(this.cachedCurrentGrid.x, nextGridY);
                    
                    if (!isBlockedDown) {
                        // 下方无阻挡，切换到向下移动
                        this.gridMoveState = 'down';
                        this.gridMoveTargetX = null;
                        finalDirection = new Vec3(0, -1, 0);
                    } else {
                        // 下方仍有阻挡，继续寻找新的左右目标
                        const targetGridX = this.findAvailableSideGrid();
                        if (targetGridX !== null) {
                            this.gridMoveState = targetGridX > this.cachedCurrentGrid.x ? 'right' : 'left';
                            this.gridMoveTargetX = targetGridX;
                        } else {
                            // 左右都被阻挡，尝试攻击最近的石墙
                            const nearestWall = this.findNearestStoneWall();
                            if (nearestWall) {
                                this.isInStoneWallGrid = false;
                                this.gridMoveState = null;
                                this.gridMoveTargetX = null;
                                this.currentTarget = nearestWall;
                                return;
                            }
                        }
                    }
                }
            }
            
            // 如果还没到达目标中心，继续左右移动
            if (this.gridMoveState === 'left') {
                finalDirection = new Vec3(-1, 0, 0);
            } else if (this.gridMoveState === 'right') {
                finalDirection = new Vec3(1, 0, 0);
            }
        }
        
        // 执行移动
        const newPos = new Vec3();
        Vec3.scaleAndAdd(newPos, enemyPos, finalDirection, moveDistance);
        
        // 检查移动后是否会与其他敌人碰撞
        const willCollide = this.checkCollisionWithEnemy(newPos);
        if (willCollide) {
            // 如果会碰撞，应用轻微的避让
            const avoidanceDir = this.calculateEnemyAvoidanceDirection(enemyPos, finalDirection, deltaTime);
            const avoidanceWeight = 0.3;
            Vec3.lerp(finalDirection, finalDirection, avoidanceDir, avoidanceWeight);
            finalDirection.normalize();
            Vec3.scaleAndAdd(newPos, enemyPos, finalDirection, moveDistance);
        }
        
        const clampedPos = this.clampPositionToScreen(newPos);
        this.node.setWorldPosition(clampedPos);
        
        // 根据移动方向翻转
        this.flipDirection(finalDirection);
        
        // 播放行走动画
        this.playWalkAnimation();
    }

    /**
     * 查找可用的左右网格（优先向右）
     */
    private findAvailableSideGrid(): number | null {
        if (!this.cachedCurrentGrid || !this.stoneWallGridPanelComponent) {
            return null;
        }
        
        const currentX = this.cachedCurrentGrid.x;
        const currentY = this.cachedCurrentGrid.y;
        const gridWidth = this.stoneWallGridPanelComponent.gridWidth;
        
        // 跟踪左右两侧是否还能继续延伸（如果遇到被占用的格子，停止该侧的延伸）
        let canExtendRight = true;
        let canExtendLeft = true;
        
        // 优先尝试向右（朝向水晶方向）
        for (let offset = 1; offset < gridWidth; offset++) {
            // 如果左右两侧都遇到被占用的格子，停止搜索
            if (!canExtendRight && !canExtendLeft) {
                break;
            }
            
            const rightX = currentX + offset;
            const leftX = currentX - offset;
            
            // 检查右侧格子
            let rightAvailable = false;
            let rightDownAvailable = false;
            if (canExtendRight && rightX < gridWidth) {
                // 检查右侧格子是否被占用
                const isRightOccupied = this.stoneWallGridPanelComponent.isGridOccupied(rightX, currentY);
                if (isRightOccupied) {
                    // 遇到被占用的石墙，停止右侧延伸
                    canExtendRight = false;
                } else {
                    // 右侧格子未被占用，检查其下方格子
                    rightAvailable = true;
                    if (currentY > 0) {
                        const rightDownY = currentY - 1;
                        rightDownAvailable = !this.stoneWallGridPanelComponent.isGridOccupied(rightX, rightDownY);
                    }
                }
            } else if (rightX >= gridWidth) {
                // 超出网格范围，停止右侧延伸
                canExtendRight = false;
            }
            
            // 检查左侧格子
            let leftAvailable = false;
            let leftDownAvailable = false;
            if (canExtendLeft && leftX >= 0) {
                // 检查左侧格子是否被占用
                const isLeftOccupied = this.stoneWallGridPanelComponent.isGridOccupied(leftX, currentY);
                if (isLeftOccupied) {
                    // 遇到被占用的石墙，停止左侧延伸
                    canExtendLeft = false;
                } else {
                    // 左侧格子未被占用，检查其下方格子
                    leftAvailable = true;
                    if (currentY > 0) {
                        const leftDownY = currentY - 1;
                        leftDownAvailable = !this.stoneWallGridPanelComponent.isGridOccupied(leftX, leftDownY);
                    }
                }
            } else if (leftX < 0) {
                // 超出网格范围，停止左侧延伸
                canExtendLeft = false;
            }
            
            // 优先选择下方未被占用的格子
            // 如果右侧下方未被占用，优先返回右侧
            if (rightAvailable && rightDownAvailable) {
                return rightX;
            }
            // 如果左侧下方未被占用，返回左侧
            if (leftAvailable && leftDownAvailable) {
                return leftX;
            }
            
            // 如果左右下方都被占用，但左右格子本身未被占用，继续延伸寻找
            // 这里不返回，继续循环寻找更远的格子
        }
        
        return null;
    }

    /**
     * 检查指定位置是否与其他敌人碰撞
     * @param position 要检查的位置
     * @returns 如果与其他敌人碰撞返回true，否则返回false
     */
    private checkCollisionWithEnemy(position: Vec3): boolean {
        // 查找所有敌人容器，使用直接路径
        const enemyContainers = ['Canvas/Enemies', 'Canvas/Orcs', 'Canvas/TrollSpearmans', 'Canvas/OrcWarriors', 'Canvas/OrcWarlords'];
        const allEnemies: Node[] = [];

        for (const containerName of enemyContainers) {
            const containerNode = find(containerName);
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

    /**
     * 从配置文件加载金币和经验奖励（只在初始化时加载一次）
     */
    loadRewardsFromConfig() {
        const configManager = UnitConfigManager.getInstance();
        if (!configManager.isConfigLoaded()) {
            return; // 配置文件未加载，使用预制体中的默认值
        }
        
        // 使用 prefabName 作为单位ID，如果没有则使用 unitName
        const unitId = this.prefabName || this.unitName || '';
        if (!unitId) {
            return;
        }
        
        const config = configManager.getUnitConfig(unitId);
        if (config && config.baseStats) {
            // 从配置文件读取金币和经验奖励
            if (config.baseStats.goldReward !== undefined) {
                this.goldReward = config.baseStats.goldReward;
            }
            if (config.baseStats.expReward !== undefined) {
                this.expReward = config.baseStats.expReward;
            }
        }
    }
}

