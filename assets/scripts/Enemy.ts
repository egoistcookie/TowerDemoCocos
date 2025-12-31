import { _decorator, Component, Node, Vec3, tween, Sprite, find, Prefab, instantiate, Label, Color, SpriteFrame, UITransform, AudioClip, Animation, AnimationState, view } from 'cc';
import { GameManager, GameState } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
import { AudioManager } from './AudioManager';
import { UnitType } from './WarAncientTree';
import { StoneWallGridPanel } from './StoneWallGridPanel';
import { UnitManager } from './UnitManager';
import { EnemyPool } from './EnemyPool';
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
    private unitManager: UnitManager = null!; // 单位管理器引用（性能优化）
    private targetFindTimer: number = 0; // 目标查找计时器
    private readonly TARGET_FIND_INTERVAL: number = 0.2; // 目标查找间隔（秒），不是每帧都查找
    
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
    private tempVec3_3: Vec3 = new Vec3(); // 临时Vec3对象3（复用）
    private cachedCurrentGrid: { x: number; y: number } | null = null; // 缓存的当前网格位置
    private lastGridCheckTime: number = 0; // 上次网格检查时间
    private readonly GRID_CHECK_INTERVAL: number = 0.2; // 网格检查间隔（秒）
    private cachedIsAboveGrid: boolean = false; // 缓存的"是否在网格上方"状态
    private lastAboveGridCheckTime: number = 0; // 上次"是否在网格上方"检查时间
    private readonly ABOVE_GRID_CHECK_INTERVAL: number = 0.3; // "是否在网格上方"检查间隔（秒）
    private cachedTargetComponent: any = null; // 缓存的目标组件（避免重复getComponent）
    private cachedTargetComponentType: string = ''; // 缓存的目标组件类型
    private lastComponentCheckTime: number = 0; // 上次组件检查时间
    private readonly COMPONENT_CHECK_INTERVAL: number = 0.1; // 组件检查间隔（秒）
    private lastFriendlyUnitCheckTime: number = 0; // 上次检测我方单位的时间（性能优化）
    
    // 唯一ID，用于区分不同的敌人实例
    private enemyId: string = "";
    
    // 对象池相关：预制体名称（用于对象池回收）
    public prefabName: string = "Orc"; // 默认值，子类可以重写
    
    // 石墙网格寻路相关属性
    private stoneWallGridPanelComponent: StoneWallGridPanel | null = null; // 石墙网格面板组件引用
    private gridPath: Vec3[] = []; // 存储路径上的所有点
    private currentPathIndex: number = 0; // 当前路径点索引
    private lastPathCheckTime: number = 0; // 上次路径检查时间（秒）
    private isInStoneWallGrid: boolean = false; // 标记是否在网格中寻路
    private topLayerGapTarget: Vec3 | null = null; // 网格最上层缺口目标点
    
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
    private attackComplete: boolean = false; // 攻击动画是否已完成造成伤害
    
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
        this.cachedTargetComponentType = '';
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
        this.detourTarget = null;
        this.gridPath = [];
        this.currentPathIndex = 0;
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
        this.cachedIsAboveGrid = false;
        this.cachedTargetComponent = null;
        this.cachedTargetComponentType = '';
        
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
        // 如果被销毁，只更新动画，不执行其他逻辑
        if (this.isDestroyed) {
            this.updateAnimation(deltaTime);
            return;
        }

        // 性能优化：LOD系统 - 根据距离摄像机远近，降低更新频率
        // 使用累计时间而不是Date.now()，避免系统调用开销
        this.lastDistanceCheckTime += deltaTime;
        if (this.lastDistanceCheckTime >= this.DISTANCE_CHECK_INTERVAL) {
            this.updateLOD();
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
        const oldAttackTimer = this.attackTimer;
        this.attackTimer += deltaTime;
        this.targetFindTimer += deltaTime;
        
        // 更新对话框系统（降低频率，只在更新时执行）
        this.updateDialogSystem(deltaTime);
        
        // 性能优化：使用平方距离比较，避免开方运算，并缓存位置
        if (this.currentTarget && this.currentTarget.isValid) {
            // 缓存位置，避免重复访问worldPosition属性
            this.cachedWorldPosition.set(this.node.worldPosition);
            this.cachedTargetWorldPosition.set(this.currentTarget.worldPosition);
            const dx = this.cachedTargetWorldPosition.x - this.cachedWorldPosition.x;
            const dy = this.cachedTargetWorldPosition.y - this.cachedWorldPosition.y;
            const distanceSq = dx * dx + dy * dy;
            const attackRangeSq = this.attackRange * this.attackRange;
            if (distanceSq <= attackRangeSq) {
                if (this.attackTimer >= this.attackInterval - 0.1 || (oldAttackTimer < this.attackInterval && this.attackTimer >= this.attackInterval)) {
                }
            }
        }

        // 查找目标（优先防御塔，然后水晶）- 按间隔查找而不是每帧都查找
        if (this.targetFindTimer >= this.TARGET_FIND_INTERVAL) {
            this.targetFindTimer = 0;
            this.findTarget();
        }
        
        // 如果当前目标已失效，立即重新查找（不等待间隔）
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
            if (this.targetFindTimer >= 0.1) { // 至少间隔0.1秒
                this.targetFindTimer = 0;
                this.findTarget();
            }
        }

        // 最高优先级：如果在网格中寻路，优先执行网格寻路逻辑
        if (this.isInStoneWallGrid) {
            // 如果正在播放攻击动画，停止攻击动画并切换到移动动画
            if (this.isPlayingAttackAnimation) {
                this.isPlayingAttackAnimation = false;
                this.attackComplete = false;
                this.stopAllAnimations();
            }
            const hadTargetBefore = !!this.currentTarget;
            this.moveInStoneWallGrid(deltaTime);
            // 如果moveInStoneWallGrid检测到我方单位并设置了currentTarget，且退出了网格寻路模式，不直接return，让后续逻辑处理目标
            if (!this.isInStoneWallGrid && this.currentTarget && !hadTargetBefore) {
                // 不return，继续执行后续逻辑处理移动和攻击
            } else {
                this.updateAnimation(deltaTime);
                return;
            }
        }

        // 检查敌人是否在网格上方，如果是，先移动到缺口（但前提是还没有到达最底层）
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
                this.detourTarget = null;
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
                        
                        const gapTarget = this.topLayerGapTarget;
                        this.topLayerGapTarget = null;
                        
                        // 进入网格寻路模式（简化：直接进入，不使用A*算法）
                        this.isInStoneWallGrid = true;
                        this.gridPath = [];
                        this.currentPathIndex = 0;
                        this.moveInStoneWallGrid(deltaTime);
                        return;
                        // 继续执行，让后续逻辑处理石墙攻击
                    } else {
                        // 向缺口移动前，优先检测我方单位
                        const friendlyUnit = this.checkForFriendlyUnitInGrid();
                        if (friendlyUnit) {
                            // 检测到我方单位且路径畅通，优先攻击我方单位
                            this.topLayerGapTarget = null;
                            this.currentTarget = friendlyUnit;
                            // 清除绕行目标点
                            if (this.detourTarget) {
                                this.detourTarget = null;
                            }
                            // 继续执行后续逻辑处理移动和攻击
                            return;
                        }

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

        // 检查是否需要进入网格寻路模式（但前提是还没有到达最底层，且没有缺口目标）
        // 如果正在移动到缺口，不应该进入网格寻路模式
        if (!this.currentTarget && !this.isInStoneWallGrid && !this.topLayerGapTarget) {
            // 性能优化：使用缓存的网格位置
            if (!this.cachedCurrentGrid) {
                this.cachedCurrentGrid = this.stoneWallGridPanelComponent?.worldToGrid(this.node.worldPosition) || null;
            }
            // 先检查是否已经在最底层，如果是，清除网格相关状态，直接向水晶移动
            if (this.cachedCurrentGrid && this.cachedCurrentGrid.y <= 0) {
                // 已在最底层，清除所有网格相关状态，直接向水晶移动
                this.topLayerGapTarget = null;
                this.detourTarget = null;
                // 直接跳过后续的网格和绕行逻辑，进入向水晶移动的逻辑
            } else if (this.checkStoneWallGridBelowEnemy()) {
                // checkStoneWallGridBelowEnemy() 已经检查了是否到达最底层，所以这里直接进入网格寻路模式（简化：不使用A*算法）
                this.isInStoneWallGrid = true;
                this.gridPath = [];
                this.currentPathIndex = 0;
                this.moveInStoneWallGrid(deltaTime);
                // 如果正在播放攻击动画，停止攻击动画
                if (this.isPlayingAttackAnimation) {
                    this.isPlayingAttackAnimation = false;
                }
                return;
            }
        }

        // 最高优先级：如果当前目标是石墙且不在网格寻路模式（A*寻路失败后设置的），优先攻击石墙
        // 这种情况下应该清除绕行目标点，专注于攻击石墙
        // 性能优化：缓存组件查找结果
        if (this.currentTarget && this.currentTarget.isValid && !this.isInStoneWallGrid) {
            // 缓存组件，避免重复getComponent调用
            this.lastComponentCheckTime += deltaTime;
            if (this.lastComponentCheckTime >= this.COMPONENT_CHECK_INTERVAL || !this.cachedTargetComponent || this.cachedTargetComponentType !== 'StoneWall') {
                this.cachedTargetComponent = this.currentTarget.getComponent('StoneWall') as any;
                this.cachedTargetComponentType = 'StoneWall';
                this.lastComponentCheckTime = 0;
            }
            
            const currentWallScript = this.cachedTargetComponent;
            if (currentWallScript && currentWallScript.isAlive && currentWallScript.isAlive()) {
                // A*寻路失败后设置的石墙目标具有最高优先级，清除绕行目标点
                if (this.detourTarget) {
                    this.detourTarget = null;
                }
                // 继续执行，让后续逻辑处理石墙攻击
            }
        }

        // 如果有绕行目标点，直接向绕行目标点移动，忽略当前目标
        // 但前提是敌人还没有到达最底层，且当前目标不是A*寻路失败后的石墙
        // 性能优化：使用缓存的网格位置
        if (this.detourTarget) {
            if (!this.cachedCurrentGrid) {
                this.cachedCurrentGrid = this.stoneWallGridPanelComponent?.worldToGrid(this.node.worldPosition) || null;
            }
            if (this.cachedCurrentGrid && this.cachedCurrentGrid.y <= 0) {
                // 已在最底层，清除绕行目标点，直接向水晶移动
                this.detourTarget = null;
                // 继续执行，进入向水晶移动的逻辑
            } else {
                this.moveTowardsCrystal(deltaTime); // 这个方法会处理绕行目标点逻辑
                // 如果正在播放攻击动画，停止攻击动画
                if (this.isPlayingAttackAnimation) {
                    this.isPlayingAttackAnimation = false;
                }
                return;
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
                this.cachedTargetComponentType = stoneWallComp ? 'StoneWall' : (crystalComp ? 'Crystal' : '');
                this.lastComponentCheckTime = 0;
            }
            const targetType = this.cachedTargetComponentType === 'StoneWall' ? '石墙' : 
                              this.cachedTargetComponentType === 'Crystal' ? '水晶' : '其他';

            if (distanceSq <= attackRangeSq) {
                // 在攻击范围内，停止移动并攻击
                // 只有在攻击条件满足时才停止移动并攻击，避免在等待攻击时重置动画状态
                if (this.attackTimer >= this.attackInterval && !this.isHit && !this.isPlayingAttackAnimation) {
                    // 攻击条件满足，停止移动并攻击
                    this.stopMoving();
                    this.attack();
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
            // 没有目标，检查路径是否被石墙阻挡
            if (this.targetCrystal && this.targetCrystal.isValid && !this.isHit) {
                // 在移动前先检查路径是否被石墙阻挡
                const blockedStoneWall = this.checkPathBlockedByStoneWall();
                if (blockedStoneWall) {
                    // 路径被石墙阻挡且无法绕行，立即设置为攻击目标
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
        
        // 更新动画
        this.updateAnimation(deltaTime);
    }

    private findTarget() {
        // 如果有绕行目标点，直接返回，不执行目标查找逻辑，确保敌人优先朝绕行点移动
        if (this.detourTarget) {
            return;
        }
        
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
        
        // 使用递归查找Towers容器（更可靠）
        const findNodeRecursive = (node: Node, name: string): Node | null => {
            if (!node || !node.isValid) {
                return null;
            }
            if (node.name === name) {
                return node;
            }
            const children = node.children || [];
            for (const child of children) {
                if (child && child.isValid) {
                    const found = findNodeRecursive(child, name);
                    if (found) return found;
                }
            }
            return null;
        };
        
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
                const currentWallScript = this.currentTarget.getComponent('StoneWall') as any;
                if (currentWallScript && currentWallScript.isAlive && currentWallScript.isAlive()) {
                    // 当前目标是石墙且仍然存活，检查距离（性能优化：使用平方距离）
                    const dx = this.currentTarget.worldPosition.x - this.node.worldPosition.x;
                    const dy = this.currentTarget.worldPosition.y - this.node.worldPosition.y;
                    const distanceSq = dx * dx + dy * dy;
                    const attackRangeSq = this.attackRange * this.attackRange;
                    
                    // 如果石墙在攻击范围内，保持这个目标（正在攻击中）
                    if (distanceSq <= attackRangeSq) {
                        return;
                    }
                    
                    // 检查路径是否仍然被这个石墙或其他石墙阻挡且无法绕行
                    const blockedStoneWall = this.checkPathBlockedByStoneWall();
                    if (blockedStoneWall && blockedStoneWall.isValid && blockedStoneWall.worldPosition &&
                        this.node && this.node.isValid && this.node.worldPosition) {
                        // 路径仍然被阻挡且无法绕行，保持当前石墙目标或切换到更近的阻挡石墙
                        if (blockedStoneWall === this.currentTarget) {
                            return;
                        } else {
                            // 性能优化：使用平方距离比较
                            const blockedDx = blockedStoneWall.worldPosition.x - this.node.worldPosition.x;
                            const blockedDy = blockedStoneWall.worldPosition.y - this.node.worldPosition.y;
                            const blockedDistanceSq = blockedDx * blockedDx + blockedDy * blockedDy;
                            if (blockedDistanceSq < distanceSq) {
                                this.currentTarget = blockedStoneWall;
                                return;
                            } else {
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
                            return;
                        } else {
                            // 路径不再被阻挡（可以绕行），清除石墙目标，优先绕开石墙
                            // 只有当实在无法绕行时才考虑攻击石墙
                            this.currentTarget = null!;
                            // 继续执行下面的逻辑，查找其他目标
                        }
                    }
                }
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

            let warAncientTrees = find('WarAncientTrees');
            if (!warAncientTrees && this.node.scene) {
                warAncientTrees = findNodeRecursive(this.node.scene, 'WarAncientTrees');
            }
            if (warAncientTrees) {
                trees = warAncientTrees.children || [];
            }

            let hallsNode = find('HunterHalls');
            if (!hallsNode && this.node.scene) {
                hallsNode = findNodeRecursive(this.node.scene, 'HunterHalls');
            }
            if (hallsNode) {
                halls = hallsNode.children || [];
            }

            let swordsmanHallsNode = find('SwordsmanHalls');
            if (!swordsmanHallsNode && this.node.scene) {
                swordsmanHallsNode = findNodeRecursive(this.node.scene, 'SwordsmanHalls');
            }
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

        // 2. 检查路径是否被石墙阻挡（优先级第二）
        // 如果路径被石墙阻挡且无法绕行，无论距离多远都要攻击石墙
        const blockedStoneWall = this.checkPathBlockedByStoneWall();
        if (blockedStoneWall && blockedStoneWall.isValid && blockedStoneWall.worldPosition &&
            this.node && this.node.isValid && this.node.worldPosition) {
            const dx = blockedStoneWall.worldPosition.x - myPos.x;
            const dy = blockedStoneWall.worldPosition.y - myPos.y;
            const distanceSq = dx * dx + dy * dy;
            // 如果路径被阻挡且无法绕行，无论距离多远都要攻击石墙
            // 路径被完全阻挡时，石墙的优先级应该高于水晶（除非水晶已经在攻击范围内且敌人正在攻击）
            if (targetPriority === PRIORITY.CRYSTAL && targetCrystal && targetCrystal.worldPosition) {
                const cx = targetCrystal.worldPosition.x - myPos.x;
                const cy = targetCrystal.worldPosition.y - myPos.y;
                const crystalDistanceSq = cx * cx + cy * cy;
                const attackRangeSq = this.attackRange * this.attackRange;
                // 如果水晶在攻击范围内且当前目标就是水晶，保持攻击水晶（可能正在攻击中）
                // 否则，即使水晶在检测范围内，也要优先攻击阻挡路径的石墙
                if (crystalDistanceSq <= attackRangeSq && this.currentTarget === targetCrystal) {
                    // 水晶在攻击范围内且正在攻击，保持水晶为目标
                } else {
                    // 水晶不在攻击范围内，或当前目标不是水晶，优先攻击阻挡路径的石墙
                    minDistanceSq = distanceSq;
                    nearestTarget = blockedStoneWall;
                    targetPriority = PRIORITY.STONEWALL;
                }
            } else {
                // 当前目标不是水晶，如果路径被阻挡，强制攻击石墙
                minDistanceSq = distanceSq;
                nearestTarget = blockedStoneWall;
                targetPriority = PRIORITY.STONEWALL;
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
            // 如果有绕行目标点，不要设置水晶为当前目标，让moveTowardsCrystal处理绕行逻辑
            if (this.detourTarget) {
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
                const clampedDx = clampedPos.x - this.currentTarget.worldPosition.x;
                const clampedDy = clampedPos.y - this.currentTarget.worldPosition.y;
                const clampedDistanceSq = clampedDx * clampedDx + clampedDy * clampedDy;
                
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
                    const clampedDistance = Vec3.distance(clampedPos, targetPos);

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
                    const clampedDistance = Vec3.distance(clampedPos, targetPos);
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
                        // 局部无法绕路，检查全局路径是否被阻挡且无法绕行
                        const blockedStoneWall = this.checkPathBlockedByStoneWall();
                        if (blockedStoneWall) {
                            // 全局路径被阻挡且无法绕行，设置石墙为目标
                            this.currentTarget = blockedStoneWall;
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
            this.moveInStoneWallGrid(deltaTime);
            return;
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
                this.currentTarget = blockedStoneWall;
                // 清除绕行目标点
                this.detourTarget = null;
                return;
            }
            
        }

        // 如果有绕行目标点，优先移动到绕行目标点（不检查其他目标）
        // 但如果敌人已在最底层，清除绕行目标点，直接向水晶移动
        if (this.detourTarget) {
            const currentGrid = this.stoneWallGridPanelComponent?.worldToGrid(this.node.worldPosition);
            if (currentGrid && currentGrid.y <= 0) {
                // 已在最底层，清除绕行目标点，直接向水晶移动
                this.detourTarget = null;
                // 继续执行，进入向水晶移动的逻辑
            } else {
                const enemyWorldPos = this.node.worldPosition;
                const toDetour = new Vec3();
                Vec3.subtract(toDetour, this.detourTarget, enemyWorldPos);
                const detourDistance = toDetour.length();
                
                // 如果已经到达绕行目标点（距离小于阈值），清除绕行目标点，继续向水晶移动
                if (detourDistance < 5) {
                    
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
                    return;
                }
            }
        }

        // 如果还有绕行目标点（说明还没到达），直接返回，不要执行后续的水晶移动逻辑
        if (this.detourTarget) {
            return;
        }

        // 只有在没有绕行目标点时，才检查路径上的目标
        this.checkForTargetsOnPath();

        // 如果检测到目标（包括石墙），停止朝水晶移动，让update()方法处理目标
        if (this.currentTarget) {
            return;
        }
        
        // 检查checkForTargetsOnPath是否设置了detourTarget
        if (this.detourTarget) {
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
            
            // 检查移动路径上是否有石墙阻挡
            const hasCollision = this.checkCollisionWithStoneWall(newPos);
            if (hasCollision) {
                // 路径被石墙阻挡，尝试绕路
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
                    const blockedStoneWall = this.checkPathBlockedByStoneWall();
                    if (blockedStoneWall) {
                        // 全局路径被阻挡且无法绕行，设置石墙为目标
                        this.currentTarget = blockedStoneWall;
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
            return null;
        }
        
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

        for (const wall of allStoneWalls) {
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

        const enemyRadius = 20; // 敌人的碰撞半径

        for (const wall of allStoneWalls) {
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
            const wallPos = blockingWall.worldPosition;
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

    /**
     * 检查路径是否被石墙阻挡
     * @returns 如果路径被阻挡且无法绕开，返回最近的石墙节点；否则返回null
     */
    private checkPathBlockedByStoneWall(): Node | null {
        // 如果敌人已在最底层，直接返回null，不执行绕行逻辑，直接向水晶移动
        const currentGrid = this.stoneWallGridPanelComponent?.worldToGrid(this.node.worldPosition);
        if (currentGrid && currentGrid.y <= 0) {
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
                        canDetour = true;
                        return null;
                    }
                }
                
                this.detourTarget = bestExit;
                canDetour = true;
            }
        }
        
        // 如果没有找到房间出口，使用传统的绕行距离计算方法
        if (!canDetour) {
            // 优先检测左右两侧（最常见的绕行方向），使用计算出的最小绕行距离
            // 计算需要绕过整个障碍物组的最小距离
            const minDetourDistance = this.calculateMinDetourDistance(enemyPos, crystalPos, wallGroups, perpendicular);
            
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
                    this.detourTarget = clampedRightOffset.clone();
                    canDetour = true;
                } else {
                    // 障碍物在左侧或中间，优先选择左侧绕行
                    this.detourTarget = clampedLeftOffset.clone();
                    canDetour = true;
                }
            } else if (leftCanDetour) {
                this.detourTarget = clampedLeftOffset.clone();
                canDetour = true;
            } else if (rightCanDetour) {
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
                        const clampedLeftOffsetFallback = this.clampPositionToScreen(leftOffsetFallback);
                        this.detourTarget = clampedLeftOffsetFallback.clone();
                        canDetour = true;
                        break;
                    }
                    
                    // 检测右侧绕行（负方向）
                    const rightOffsetFallback = new Vec3();
                    Vec3.scaleAndAdd(rightOffsetFallback, enemyPos, perpendicular, -offsetDistance);
                    if (this.checkPathClearAroundObstacles(rightOffsetFallback, crystalPos, wallGroups, stoneWalls)) {
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
            // 清除绕行目标点
            this.detourTarget = null;
            return nearestWall;
        }

        // 可以绕行，返回null（绕行目标点已保存在this.detourTarget中）
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
                        group.push(otherWall);
                        processed.add(otherWall);
                        queue.push(otherWall);
                    }
                }
            }

            groups.push(group);
        }

        const totalWallsInGroups = groups.reduce((sum, g) => sum + g.length, 0);
        
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
        //     
        //     for (const gap of gaps) {
        //         // 简化检查：只需要从间隙到水晶的路径畅通即可
        //         if (this.checkPathClearAroundObstacles(gap, crystalPos, [], this.getAllStoneWalls())) {
        //             exits.push(gap);
        //         }
        //     }
        // }
        
        // 2. 暂时禁用组间间隙出口
        // const interGroupGaps = this.findInterGroupGaps(wallGroups, enemyRadius);
        // 
        // for (const gap of interGroupGaps) {
        //     if (this.checkPathClearAroundObstacles(gap, crystalPos, [], this.getAllStoneWalls())) {
        //         exits.push(gap);
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

        // 4. 重新设计出口寻找算法：将石墙组视为边界，找到真正的口子作为出口
        
        // 找到主要的石墙组（最大的那个）
        let mainWallGroup: Node[] = [];
        for (const group of wallGroups) {
            if (group.length > mainWallGroup.length) {
                mainWallGroup = group;
            }
        }
        
        if (mainWallGroup.length === 0) {
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
            
        }

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

        // 只有当敌人还没通过石墙组时，才寻找出口
        if (hasPassedWallGroup) {
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

        // 4. 如果没有找到出口，添加一个基于敌人和水晶连线的紧急出口
        if (exits.length === 0) {
            const emergencyExit = this.generateEmergencyExit(enemyPos, crystalPos, overallMinX, overallMaxX, overallMinY, overallMaxY, gameBounds);
            if (emergencyExit) {
                exits.push(emergencyExit);
            }
        }
        
        // 去重：移除距离过近的出口
        const uniqueExits = this.deduplicateExits(exits, enemyRadius * 2);
        
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

        // 改进的路径检查：只检查从出口到水晶的路径是否畅通
        // 敌人可以自行移动到出口位置
        if (this.checkPathClearAroundObstacles(exitPos, crystalPos, [], this.getAllStoneWalls())) {
            return exitPos;
        }
        
        // 如果严格检查失败，尝试使用更宽松的检查
        if (this.checkPathClear(exitPos, crystalPos, this.getAllStoneWalls())) {
            return exitPos;
        }
        
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

        // 5. 添加角色单位
        // 3.1) 弓箭手
        const towersNode = find('Canvas/Towers');
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
        
        // 3.2) 女猎手（从对象池容器直接获取，不再使用递归查找）
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
            if (hunter && hunter.active && hunter.isValid) {
                const hunterScript = hunter.getComponent('Hunter') as any;
                if (hunterScript && hunterScript.isAlive && hunterScript.isAlive()) {
                    allPotentialTargets.push(hunter);
                }
            }
        }
        
        // 3.3) 精灵剑士（从对象池容器直接获取，不再使用递归查找）
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
            if (swordsman && swordsman.active && swordsman.isValid) {
                const swordsmanScript = swordsman.getComponent('ElfSwordsman') as any;
                if (swordsmanScript && swordsmanScript.isAlive && swordsmanScript.isAlive()) {
                    allPotentialTargets.push(swordsman);
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
            } else if (target.getComponent('Arrower') || target.getComponent('Hunter') || target.getComponent('ElfSwordsman')) {
                targetPriority = PRIORITY.CHARACTER;
            } else if (target.getComponent('WarAncientTree') || target.getComponent('HunterHall') || target.getComponent('SwordsmanHall')) {
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
        
        if (this.isPlayingDeathAnimation || this.isDestroyed) {
            return;
        }

        // 检查当前目标距离
        if (this.currentTarget) {
            const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
            const targetType = this.currentTarget.getComponent('StoneWall') ? '石墙' : 
                              this.currentTarget.getComponent('Crystal') ? '水晶' : '其他';
        } else {
        }

        // 停止所有动画
        this.stopAllAnimations();
        
        // 设置攻击动画状态
        this.isPlayingAttackAnimation = true;
        this.attackComplete = false;
        this.animationTimer = 0;
        this.currentAnimationFrameIndex = -1;

        // 播放攻击音效
        if (this.attackSound) {
            AudioManager.Instance.playSFX(this.attackSound);
        } else {
        }
        
        // 如果使用Animation组件播放攻击动画（用于需要Animation组件的情况）
        if (this.animationComponent) {
            // 清除之前的动画事件
            this.animationComponent.off(Animation.EventType.FINISHED);
            
            // 先停止当前可能正在播放的动画，确保每次都能重新开始
            this.animationComponent.stop();
            
            // 获取动画状态，设置动画速度与attackAnimationDuration保持同步
            const state = this.animationComponent.getState(this.attackAnimationName);
            if (state) {
                // 重置动画播放头到开始位置
                state.time = 0;
                // 设置动画时长与attackAnimationDuration参数保持一致
                state.speed = state.duration / this.attackAnimationDuration;
            } else {
            }
            
            // 注册动画完成事件监听器，确保动画播放完成后立即重置状态
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
            
            // 播放动画
            this.animationComponent.play(this.attackAnimationName);
            
            // 在动画播放到一半时造成伤害（与动画帧方式保持一致）
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
        } else {
        }
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
        
        if (!this.currentTarget || this.isDestroyed) {
            return;
        }

        // 再次检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }

        const targetPos = this.currentTarget.worldPosition;
        const enemyPos = this.node.worldPosition;
        // 性能优化：使用平方距离比较
        const dx = targetPos.x - enemyPos.x;
        const dy = targetPos.y - enemyPos.y;
        const distanceSq = dx * dx + dy * dy;
        const attackRangeSq = this.attackRange * this.attackRange;
        const targetType = this.currentTarget.getComponent('StoneWall') ? '石墙' : 
                          this.currentTarget.getComponent('Crystal') ? '水晶' : '其他';

        // 检查距离是否在攻击范围内（使用平方距离）
        if (distanceSq > attackRangeSq) {
            // 如果正在播放攻击动画，停止攻击动画
            if (this.isPlayingAttackAnimation) {
                this.isPlayingAttackAnimation = false;
                this.attackComplete = false;
            }
            return;
        }

        // 攻击时朝向目标方向
        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        this.flipDirection(direction);

        // 播放攻击动画（使用动画帧，在updateAttackAnimation中造成伤害）
        this.playAttackAnimation();
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
                // 清除绕行目标点，重新计算路径
                this.detourTarget = null;
                
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
        this.detourTarget = null;
        this.topLayerGapTarget = null;
        this.isInStoneWallGrid = false;
        this.gridPath = [];
        this.currentPathIndex = 0;
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
        this.cachedTargetComponentType = '';
        
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
        const gridMaxY = 1000; // 最上层（gridY=9）的y坐标
        const gridMinX = 0;
        const gridMaxX = 750;

        // 检查敌人是否在网格上方（y坐标 > gridMaxY），且在网格x范围内
        const isAbove = enemyPos.y > gridMaxY && enemyPos.x >= gridMinX - 50 && enemyPos.x <= gridMaxX + 50;
        
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

        // 将敌人的x坐标转换为网格坐标（使用网格最上层对应的y坐标）
        // 先尝试使用敌人的x坐标找到对应的网格列
        let startX = 0;
        let bestGap: Vec3 | null = null;
        let minDistance = Infinity;

        // 创建一个测试位置，y坐标使用网格最上层的y坐标
        // 我们需要知道网格最上层的世界y坐标，可以通过将gridY=topLayerY转换为世界坐标来获取
        const testGridPos = this.stoneWallGridPanelComponent.gridToWorld(0, topLayerY);
        if (!testGridPos) {
            return null;
        }
        
        // 使用敌人的x坐标找到对应的网格列
        const testWorldPos = new Vec3(enemyPos.x, testGridPos.y, 0);
        const enemyGrid = this.stoneWallGridPanelComponent.worldToGrid(testWorldPos);
        
        if (enemyGrid && enemyGrid.y === topLayerY) {
            startX = enemyGrid.x;
        } else {
            // 如果无法转换，使用粗略计算（假设网格从x=0开始，每格50像素）
            startX = Math.max(0, Math.min(gridWidth - 1, Math.floor((enemyPos.x - this.stoneWallGridPanelComponent.node.worldPosition.x + (gridWidth * 50) / 2) / 50)));
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
                                }
                            } else {
                            }
                        }
                    } else {
                    }
                }
            }

            // 如果已经找到正下方的缺口，直接返回
            if (offset === 0 && bestGap) {
                return bestGap;
            }
        }

        if (bestGap) {
        } else {
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
                    return false;
                }
                
                // 进一步验证实际是否有石墙节点
                if (this.checkStoneWallAtPosition(pathPoint)) {
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
        // 简化：不再重新规划路径，直接使用简单移动逻辑
        // 如果已经在网格中，继续使用moveInStoneWallGrid的简单移动逻辑
        if (!this.isInStoneWallGrid) {
            return;
        }
        // 不需要重新规划，moveInStoneWallGrid会自动处理
    }


    /**
     * 在网格内或网格上方检测我方单位（弓箭手、女猎手、剑士），如果路径畅通则返回单位
     * @returns 如果找到可攻击的我方单位且路径畅通，返回单位节点；否则返回null
     */
    private checkForFriendlyUnitInGrid(): Node | null {
        const enemyPos = this.node.worldPosition;
        const detectionRange = 200; // 索敌范围：200像素

        let nearestUnit: Node | null = null;
        let minDistance = Infinity;

        // 1. 查找弓箭手（从对象池容器直接获取）
        const towersNode = find('Canvas/Towers');
        if (towersNode) {
            const towers = towersNode.children || [];
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

        // 2. 查找女猎手（从对象池容器直接获取，不再使用递归查找）
        const huntersNode = find('Canvas/Hunters');
        if (huntersNode) {
            const hunters = huntersNode.children || [];
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

        // 3. 查找精灵剑士（从对象池容器直接获取，不再使用递归查找）
        const swordsmenNode = find('Canvas/ElfSwordsmans');
        if (swordsmenNode) {
            const swordsmen = swordsmenNode.children || [];
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
     * 在网格内移动（已简化：不再使用A*路径，直接向下移动+左右绕行）
     * 性能优化：移除A*算法，使用简单的直接移动逻辑
     */
    private moveInStoneWallGrid(deltaTime: number) {
        // 如果正在播放攻击动画，停止攻击动画并切换到移动动画
        if (this.isPlayingAttackAnimation) {
            this.isPlayingAttackAnimation = false;
            this.attackComplete = false;
            this.stopAllAnimations();
        }
        
        // 性能优化：大幅减少检测频率，每2秒检测一次我方单位（而不是每帧）
        this.lastFriendlyUnitCheckTime += deltaTime;
        
        if (this.lastFriendlyUnitCheckTime >= 2.0) {
            this.lastFriendlyUnitCheckTime = 0;
            // 优先检测我方单位（弓箭手、女猎手、剑士），如果路径畅通则优先攻击
            const friendlyUnit = this.checkForFriendlyUnitInGrid();
            if (friendlyUnit) {
                // 检测到我方单位且路径畅通，退出网格寻路模式，优先攻击我方单位
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
        }

        // 检查是否已经到达最底层（gridY=0）
        this.findStoneWallGridPanel();
        if (!this.stoneWallGridPanelComponent) {
            this.isInStoneWallGrid = false;
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
            this.gridPath = [];
            this.currentPathIndex = 0;
            return;
        }

        // 性能优化：简化移动逻辑，直接向下移动，遇到阻挡时简单左右绕行
        // 使用网格系统快速检查，而不是递归查找所有石墙
        const moveDistance = this.moveSpeed * deltaTime;
        const downDirection = new Vec3(0, -1, 0); // 直接向下
        
        // 性能优化：使用网格系统快速检查石墙，而不是递归查找
        let finalDirection = downDirection;
        const checkPos = this.tempVec3_1;
        Vec3.scaleAndAdd(checkPos, enemyPos, downDirection, moveDistance);
        
        // 使用网格系统检查（更快）
        const checkGrid = this.stoneWallGridPanelComponent.worldToGrid(checkPos);
        const isBlockedDown = checkGrid && this.stoneWallGridPanelComponent.isGridOccupied(checkGrid.x, checkGrid.y);
        
        if (isBlockedDown) {
            // 向下被阻挡，尝试左右绕行
            // 优先尝试向右（朝向水晶方向）
            const rightDirection = new Vec3(1, 0, 0);
            Vec3.scaleAndAdd(checkPos, enemyPos, rightDirection, moveDistance);
            const checkGridRight = this.stoneWallGridPanelComponent.worldToGrid(checkPos);
            const isBlockedRight = checkGridRight && this.stoneWallGridPanelComponent.isGridOccupied(checkGridRight.x, checkGridRight.y);
            
            if (!isBlockedRight) {
                finalDirection = rightDirection;
            } else {
                // 右也被阻挡，尝试向左
                const leftDirection = new Vec3(-1, 0, 0);
                Vec3.scaleAndAdd(checkPos, enemyPos, leftDirection, moveDistance);
                const checkGridLeft = this.stoneWallGridPanelComponent.worldToGrid(checkPos);
                const isBlockedLeft = checkGridLeft && this.stoneWallGridPanelComponent.isGridOccupied(checkGridLeft.x, checkGridLeft.y);
                
                if (!isBlockedLeft) {
                    finalDirection = leftDirection;
                } else {
                    // 左右都被阻挡，尝试攻击最近的石墙
                    const nearestWall = this.findNearestStoneWall();
                    if (nearestWall) {
                        this.isInStoneWallGrid = false;
                        this.currentTarget = nearestWall;
                        return;
                    }
                    // 如果找不到石墙，继续尝试向下（可能会卡住，但至少不会崩溃）
                }
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
}

