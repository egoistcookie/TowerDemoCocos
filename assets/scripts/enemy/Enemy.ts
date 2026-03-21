import { _decorator, Component, Node, Vec3, tween, Sprite, find, Prefab, instantiate, Label, Color, SpriteFrame, UITransform, AudioClip, Animation, AnimationState, view, UIOpacity, LabelOutline } from 'cc';
import { GameManager } from '../GameManager';
import { GameState } from '../GameState';
import { HealthBar } from '../HealthBar';
import { DamageNumber } from '../DamageNumber';
import { AudioManager } from '../AudioManager';
import { UnitType } from '../role/WarAncientTree';
import { StoneWallGridPanel } from '../StoneWallGridPanel';
import { UnitManager } from '../UnitManager';
import { EnemyPool } from '../EnemyPool';
import { UnitConfigManager } from '../UnitConfigManager';
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
    collisionRadius: number = 5; // 敌人之间的碰撞半径（像素），统一固定为 5

    @property({
        tooltip: "韧性（0-1）：1秒内遭受此百分比血量损失才会触发僵直。0表示没有抗性（受到攻击就会播放受击动画），1表示最大抗性（需要100%血量损失才触发僵直）"
    })
    tenacity: number = 0; // 韧性，默认0表示没有抗性，子类可以重写

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
    protected healthBar: HealthBar = null!;
    protected healthBarNode: Node = null!;
    protected isDestroyed: boolean = false;
    protected attackTimer: number = 0;
    protected currentTarget: Node = null!;
    protected gameManager: GameManager = null!;
    protected unitManager: UnitManager = null!; // 单位管理器引用（性能优化）
    protected targetFindTimer: number = 0; // 目标查找计时器
    protected readonly TARGET_FIND_INTERVAL: number = 0.2; // 目标查找间隔（秒），不是每帧都查找
    
    // 性能优化：缓存和复用对象
    private cachedWorldPosition: Vec3 = new Vec3(); // 缓存世界位置，避免重复访问
    private tempVec3_1: Vec3 = new Vec3(); // 临时Vec3对象1（复用）
    // 最近一次受击方向（世界坐标系下的力方向，用于伤害跳字反方向飘动）
    private lastHitDirection: Vec3 | null = null;
    
    // 对象池相关：预制体名称（用于对象池回收）
    public prefabName: string = "Orc"; // 默认值，子类可以重写
    
    
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
    private currentAnimationFrameIndex: number = 0;
    private animationTimer: number = 0;
    private isPlayingIdleAnimation: boolean = false;
    private isPlayingWalkAnimation: boolean = false;
    protected isPlayingAttackAnimation: boolean = false;
    private isPlayingHitAnimation: boolean = false;
    protected isPlayingDeathAnimation: boolean = false;
    protected defaultSpriteFrame: SpriteFrame = null!;
    protected defaultScale: Vec3 = new Vec3(1, 1, 1); // 默认缩放比例，用于方向翻转
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
    
    // 堵门触发的“燃血狂暴”状态
    private isBloodRageActive: boolean = false;
    private bloodRageBurnTimer: number = 0;
    private bloodRageOriginalMaxHealth: number = 0;
    private bloodRageOriginalMoveSpeed: number = 0;
    private bloodRageOriginalAttackDamage: number = 0;
    private bloodRageOriginalAttackInterval: number = 0;
    private bloodRageOriginalColor: Color | null = null;
    private bloodRagePulsePhase: number = 0;
    private bloodRageTier: number = 0;
    private readonly BLOOD_RAGE_FAST_BURN_Y: number = 1050;

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        
        
        // 保存默认缩放比例
        this.defaultScale = this.node.scale.clone();
        
        // 初始化动画相关属性
        this.sprite = this.node.getComponent(Sprite);
        this.animationComponent = this.node.getComponent(Animation);
        
        if (this.sprite) {
            this.defaultSpriteFrame = this.sprite.spriteFrame;
            // 设置Sprite的sizeMode为CUSTOM，以便适配UITransform大小
            this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        
        // 查找游戏管理器
        this.findGameManager();
        
        // 性能优化：初始化LOD系统
        // 性能优化：初始化缓存对象
        this.cachedWorldPosition.set(this.node.worldPosition);
        
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
        // 对象池复用时先恢复燃血改写的属性，避免数值叠加
        this.restoreBloodRageAttributesIfNeeded();

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
        this.currentTarget = null!;
        this.isPlayingAttackAnimation = false;
        this.isPlayingHitAnimation = false;
        this.isPlayingDeathAnimation = false;
        this.attackComplete = false;
        
        // 从配置文件加载金币和经验奖励（从对象池获取时也需要重新加载）
        this.loadRewardsFromConfig();
        
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

        // 对象池复用时重置狂暴状态
        this.resetBloodRageState();
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
        this.dialogLabel.fontSize = 16;
        this.dialogLabel.color = new Color(255, 0, 0, 255); // 红色文字
        this.dialogLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.dialogLabel.verticalAlign = Label.VerticalAlign.CENTER;
        this.dialogLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
        // 黑色描边
        const outline = labelNode.addComponent(LabelOutline);
        this.dialogLabel.outlineColor = new Color(0, 0, 0, 255);
        outline.width = 2;

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
        // 狂暴掉血逻辑：每秒损失当前最大生命值的10%
        this.updateBloodRage(deltaTime);

        // 先更新敌人的战争口号/对话框系统（与我方单位一致，持续在战斗中随机喊话）
        this.updateDialogSystem(deltaTime);

        // 简化版索敌和攻击逻辑（参考 Boss），优先使用该逻辑
        if (this.runSimpleAI(deltaTime)) {
            return;
        }

        // 下面为旧的复杂逻辑，目前通常不会再执行，仅作为兼容和备份保留
        // 性能监控：开始计时
        // const updateStartTime = PerformanceMonitor.startTiming('Enemy.update');
        
        // 如果被销毁，只更新动画，不执行其他逻辑
        // if (this.isDestroyed) {
        //     this.updateAnimation(deltaTime);
        //     // PerformanceMonitor.endTiming('Enemy.update', updateStartTime, 5);
        //     return;
        // }

        // // 性能监控：单位数量统计和日志输出（降低频率，避免每帧都输出）
        // Enemy.unitCountLogTimer += deltaTime;
        // if (Enemy.unitCountLogTimer >= Enemy.UNIT_COUNT_LOG_INTERVAL) {
        //     Enemy.unitCountLogTimer = 0;
            
        //     // 获取单位数量
        //     let enemyCount = 0;
        //     let roleCount = 0;
            
        //     if (this.unitManager) {
        //         const enemies = this.unitManager.getEnemies();
        //         enemyCount = enemies.length;
                
        //         // 统计Role单位数量（包括弓箭手、女猎手、精灵剑士、牧师）
        //         const towers = this.unitManager.getTowers();
        //         const hunters = this.unitManager.getHunters();
        //         const elfSwordsmans = this.unitManager.getElfSwordsmans();
        //         roleCount = towers.length + hunters.length + elfSwordsmans.length;
        //     } else {
        //         // 降级方案：直接查找节点
        //         const enemiesNode = find('Canvas/Enemies');
        //         if (enemiesNode) {
        //             enemyCount = enemiesNode.children.filter(node => node && node.isValid && node.active).length;
        //         }
                
        //         const towersNode = find('Canvas/Towers');
        //         const huntersNode = find('Canvas/Hunters');
        //         const elfSwordsmansNode = find('Canvas/ElfSwordsmans');
        //         if (towersNode) roleCount += towersNode.children.filter(node => node && node.isValid && node.active).length;
        //         if (huntersNode) roleCount += huntersNode.children.filter(node => node && node.isValid && node.active).length;
        //         if (elfSwordsmansNode) roleCount += elfSwordsmansNode.children.filter(node => node && node.isValid && node.active).length;
        //     }
            
        //     //console.info(`[Enemy.update] 单位数量统计 - 敌人: ${enemyCount}, 角色: ${roleCount}, 总计: ${enemyCount + roleCount}`);
        // }

        // // 性能优化：LOD系统 - 根据距离摄像机远近，降低更新频率
        // // 使用累计时间而不是Date.now()，避免系统调用开销
        // this.lastDistanceCheckTime += deltaTime;
        // if (this.lastDistanceCheckTime >= this.DISTANCE_CHECK_INTERVAL) {
        //     // const lodStartTime = PerformanceMonitor.startTiming('Enemy.updateLOD');
        //     this.updateLOD();
        //     // PerformanceMonitor.endTiming('Enemy.updateLOD', lodStartTime, 1);
        //     this.lastDistanceCheckTime = 0;
        // }
        
        // // 根据LOD级别决定是否跳过本次更新
        // this.updateSkipCounter++;
        // if (this.updateSkipCounter < this.updateSkipInterval) {
        //     // 跳过更新，但更新动画（降低频率）
        //     this.animationUpdateTimer += deltaTime;
        //     if (this.animationUpdateTimer >= this.ANIMATION_UPDATE_INTERVAL) {
        //         this.animationUpdateTimer = 0;
        //         this.updateAnimation(deltaTime);
        //     }
        //     // PerformanceMonitor.endTiming('Enemy.update', updateStartTime, 5);
        //     return;
        // }
        // this.updateSkipCounter = 0;

        // // 检查游戏状态 - 如果GameManager不存在，尝试重新查找
        // if (!this.gameManager) {
        //     this.findGameManager();
        // }
        
        // // 检查游戏状态，只在Playing状态下运行
        // if (this.gameManager) {
        //     const gameState = this.gameManager.getGameState();
        //     if (gameState !== GameState.Playing) {
        //         // 游戏已结束或暂停，停止移动和攻击
        //         this.stopMoving();
        //         this.currentTarget = null!;
        //         return;
        //     }
        // }

        // // 更新攻击计时器
        // this.attackTimer += deltaTime;
        // this.targetFindTimer += deltaTime;
        
        // // 更新对话框系统（降低频率，只在更新时执行）
        // this.updateDialogSystem(deltaTime);

        // // 查找目标（优先防御塔，然后水晶）- 按间隔查找而不是每帧都查找
        // if (this.targetFindTimer >= this.TARGET_FIND_INTERVAL) {
        //     this.targetFindTimer = 0;
        //     // const findTargetStartTime = PerformanceMonitor.startTiming('Enemy.findTarget');
        //     this.findTarget();
        //     // PerformanceMonitor.endTiming('Enemy.findTarget', findTargetStartTime, 3);
        // }
        
        // // 如果当前目标已失效，立即重新查找（不等待间隔）
        // if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
        //     if (this.targetFindTimer >= 0.1) { // 至少间隔0.1秒
        //         this.targetFindTimer = 0;
        //         // const findTargetStartTime = PerformanceMonitor.startTiming('Enemy.findTarget');
        //         this.findTarget();
        //         // PerformanceMonitor.endTiming('Enemy.findTarget', findTargetStartTime, 3);
        //     }
        // }

        // // 最高优先级：如果在网格中寻路，优先执行网格寻路逻辑
        // // 但如果当前目标是我方单位，放弃网格寻路，直接朝我方单位移动
        // if (this.isInStoneWallGrid) {
        //     // 检查当前目标是否是我方单位
        //     let isFriendlyUnit = false;
        //     if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
        //         const arrowerScript = this.currentTarget.getComponent('Arrower') as any;
        //         const hunterScript = this.currentTarget.getComponent('Hunter') as any;
        //         const swordsmanScript = this.currentTarget.getComponent('ElfSwordsman') as any;
        //         const priestScript = this.currentTarget.getComponent('Priest') as any;
        //         if (arrowerScript || hunterScript || swordsmanScript || priestScript) {
        //             isFriendlyUnit = true;
        //         }
        //     }
            
        //     // 如果当前目标是我方单位，退出网格寻路模式，直接朝我方单位移动
        //     if (isFriendlyUnit) {
        //         this.isInStoneWallGrid = false;
        //         this.gridMoveState = null;
        //         this.gridMoveTargetX = null;
        //         // 继续执行后续逻辑，直接朝我方单位移动
        //     } else {
        //         // 如果正在播放攻击动画，停止攻击动画并切换到移动动画
        //         if (this.isPlayingAttackAnimation) {
        //             this.isPlayingAttackAnimation = false;
        //             this.attackComplete = false;
        //             this.stopAllAnimations();
        //         }
        //         const hadTargetBefore = !!this.currentTarget;
        //         // const moveInGridStartTime = PerformanceMonitor.startTiming('Enemy.moveInStoneWallGrid');
        //         this.moveInStoneWallGrid(deltaTime);
        //         // PerformanceMonitor.endTiming('Enemy.moveInStoneWallGrid', moveInGridStartTime, 3);
        //         // 如果moveInStoneWallGrid检测到我方单位并设置了currentTarget，且退出了网格寻路模式，不直接return，让后续逻辑处理目标
        //         if (!this.isInStoneWallGrid && this.currentTarget && !hadTargetBefore) {
        //             // 不return，继续执行后续逻辑处理移动和攻击
        //         } else {
        //             this.updateAnimation(deltaTime);
        //             return;
        //         }
        //     }
        // }

        // // 检查敌人是否在网格上方，如果是，先移动到缺口
        // // 优先级：如果有缺口目标，优先移动到缺口；如果没有，检查是否在网格上方并查找缺口
        // if (!this.currentTarget && !this.isInStoneWallGrid) {
        //     // 性能优化：缓存网格位置，减少worldToGrid调用
        //     this.lastGridCheckTime += deltaTime;
        //     if (this.lastGridCheckTime >= this.GRID_CHECK_INTERVAL || !this.cachedCurrentGrid) {
        //         this.cachedCurrentGrid = this.stoneWallGridPanelComponent?.worldToGrid(this.node.worldPosition) || null;
        //         this.lastGridCheckTime = 0;
        //     }
            
        //     // 先检查是否已经在最底层，如果是，清除所有网格相关状态，直接向水晶移动
        //     if (this.cachedCurrentGrid && this.cachedCurrentGrid.y <= 0) {
        //         // 已在最底层，清除所有网格相关状态，直接向水晶移动
        //         this.topLayerGapTarget = null;
        //         // 直接跳过后续的网格和绕行逻辑，进入向水晶移动的逻辑
        //     } else {
        //         // 性能优化：缓存"是否在网格上方"状态，减少checkEnemyAboveGrid调用
        //         this.lastAboveGridCheckTime += deltaTime;
        //         if (this.lastAboveGridCheckTime >= this.ABOVE_GRID_CHECK_INTERVAL || this.lastAboveGridCheckTime === deltaTime) {
        //             this.cachedIsAboveGrid = this.checkEnemyAboveGrid();
        //             this.lastAboveGridCheckTime = 0;
        //         }
                
        //         if ((this.topLayerGapTarget || this.cachedIsAboveGrid) && !this.currentTarget) {
        //             // 如果已经有缺口目标，或者敌人在网格上方，且没有当前目标，处理缺口移动逻辑
        //             // 如果还没有找到缺口目标，寻找缺口
        //             if (!this.topLayerGapTarget) {
        //                 const gapPos = this.findGapInTopLayer();
        //                 if (gapPos) {
        //                     this.topLayerGapTarget = gapPos;
        //                 } else {
        //                     // 找不到缺口，攻击最近的石墙
        //                     const nearestWall = this.findNearestStoneWall();
        //                     if (nearestWall) {
        //                         this.currentTarget = nearestWall;
        //                         // 清除缺口目标，确保不会进入缺口移动逻辑
        //                         this.topLayerGapTarget = null;
        //                         // 直接跳出缺口处理分支，继续执行后续的"处理当前目标"逻辑
        //                         // 不执行return，让后续逻辑处理移动和攻击
        //                     } else {
        //                         // 如果正在播放攻击动画，停止攻击动画
        //                         if (this.isPlayingAttackAnimation) {
        //                             this.isPlayingAttackAnimation = false;
        //                         }
        //                         return;
        //                     }
        //                 }
        //             }

        //             // 如果设置了石墙目标，不应该进入缺口移动逻辑，应该跳出这个分支
        //             if (this.currentTarget && !this.topLayerGapTarget) {
        //                 // 已经设置了石墙目标，跳出缺口处理逻辑，让后续逻辑处理移动和攻击
        //                 // 清除可能存在的缺口目标标记
        //                 this.topLayerGapTarget = null;
        //                 // 不执行return，跳出这个else if分支，继续执行后续的"处理当前目标"逻辑
        //             } else if (this.topLayerGapTarget) {
        //                 // 移动到缺口（性能优化：复用Vec3对象）
        //                 this.cachedWorldPosition.set(this.node.worldPosition);
        //                 Vec3.subtract(this.tempVec3_1, this.topLayerGapTarget, this.cachedWorldPosition);
        //                 const gapDistance = this.tempVec3_1.length();

        //                 if (gapDistance < 15) {
        //                     // 已到达缺口，清除缺口标记，进入网格寻路模式
                            
        //                     // 确保敌人位置精确对齐到缺口位置
        //                     const clampedPos = this.clampPositionToScreen(this.topLayerGapTarget);
        //                     this.node.setWorldPosition(clampedPos);
                            
        //                     this.topLayerGapTarget = null;
                            
        //                     // 进入网格寻路模式（简化：直接进入，不使用A*算法）
        //                     this.isInStoneWallGrid = true;
        //                     // const moveInGridStartTime2 = PerformanceMonitor.startTiming('Enemy.moveInStoneWallGrid');
        //                     this.moveInStoneWallGrid(deltaTime);
        //                     // PerformanceMonitor.endTiming('Enemy.moveInStoneWallGrid', moveInGridStartTime2, 3);
        //                     return;
        //                     // 继续执行，让后续逻辑处理石墙攻击
        //                 } else {
        //                     // 向缺口移动（性能优化：复用Vec3对象）
        //                     this.tempVec3_1.normalize();
        //                     const moveDistance = this.moveSpeed * deltaTime;
        //                     Vec3.scaleAndAdd(this.tempVec3_2, this.cachedWorldPosition, this.tempVec3_1, moveDistance);
                            
        //                     const clampedPos = this.clampPositionToScreen(this.tempVec3_2);
        //                     this.node.setWorldPosition(clampedPos);
                            
        //                     // 根据移动方向翻转
        //                     this.flipDirection(this.tempVec3_1);
                            
        //                     // 播放行走动画
        //                     this.playWalkAnimation();
                            
        //                     // 如果正在播放攻击动画，停止攻击动画
        //                     if (this.isPlayingAttackAnimation) {
        //                         this.isPlayingAttackAnimation = false;
        //                     }
        //                 }
        //                 // modify by lf 2025-12-27 fix:修复敌人在网格上方移动时，没有播放行走动画的问题
        //                 this.updateAnimation(deltaTime);
        //                 return; // 优先处理缺口移动，不继续执行后续逻辑
        //             }
        //         }
        //     }
        // }

        // // 处理当前目标（性能优化：使用平方距离比较，缓存位置和组件）
        // if (this.currentTarget && this.currentTarget.isValid) {
        //     // 缓存位置
        //     this.cachedWorldPosition.set(this.node.worldPosition);
        //     this.cachedTargetWorldPosition.set(this.currentTarget.worldPosition);
        //     const dx = this.cachedTargetWorldPosition.x - this.cachedWorldPosition.x;
        //     const dy = this.cachedTargetWorldPosition.y - this.cachedWorldPosition.y;
        //     const distanceSq = dx * dx + dy * dy;
        //     const attackRangeSq = this.attackRange * this.attackRange;
            
        //     // 性能优化：缓存组件查找，避免重复getComponent调用
        //     this.lastComponentCheckTime += deltaTime;
        //     if (this.lastComponentCheckTime >= this.COMPONENT_CHECK_INTERVAL || !this.cachedTargetComponent) {
        //         const stoneWallComp = this.currentTarget.getComponent('StoneWall') as any;
        //         const crystalComp = this.currentTarget.getComponent('Crystal') as any;
        //         this.cachedTargetComponent = stoneWallComp || crystalComp;
        //         this.lastComponentCheckTime = 0;
        //     }

        //     if (distanceSq <= attackRangeSq) {
        //         // 在攻击范围内，停止移动并攻击
        //         // 只有在攻击条件满足时才停止移动并攻击，避免在等待攻击时重置动画状态
        //         if (this.attackTimer >= this.attackInterval && !this.isHit && !this.isPlayingAttackAnimation) {
        //             // 攻击条件满足，停止移动并攻击
        //             this.stopMoving();
        //             // const attackStartTime = PerformanceMonitor.startTiming('Enemy.attack');
        //             this.attack();
        //             // PerformanceMonitor.endTiming('Enemy.attack', attackStartTime, 2);
        //             this.attackTimer = 0;
        //         } else {
        //             // 攻击条件不满足，不调用移动方法也不调用stopMoving()，保持当前状态等待攻击
        //             // 不调用移动方法，敌人自然停止移动，也不调用stopMoving()避免重置动画状态
        //         }
        //     } else {
        //         // 不在攻击范围内，只有在没有被攻击时才继续移动
        //         if (!this.isHit && !this.isPlayingAttackAnimation) {
        //             this.moveTowardsTarget(deltaTime);
        //             // 如果正在播放攻击动画，停止攻击动画
        //             if (this.isPlayingAttackAnimation) {
        //                 this.isPlayingAttackAnimation = false;
        //             }
        //         } else {
        //         }
        //     }
        // } else {
        //     // 没有目标，检查路径是否被石墙阻挡（使用缓存结果）
        //     if (this.targetCrystal && this.targetCrystal.isValid && !this.isHit) {
        //         // 路径畅通，向水晶移动
        //         this.moveTowardsCrystal(deltaTime);
        //         // 如果正在播放攻击动画，停止攻击动画
        //         if (this.isPlayingAttackAnimation) {
        //             this.isPlayingAttackAnimation = false;
        //         }
        //     }
        // }
        
        // // 更新动画
        // // const updateAnimationStartTime = PerformanceMonitor.startTiming('Enemy.updateAnimation');
        // this.updateAnimation(deltaTime);
        // PerformanceMonitor.endTiming('Enemy.updateAnimation', updateAnimationStartTime, 2);

        // 性能监控：结束 update 方法计时
        // PerformanceMonitor.endTiming('Enemy.update', updateStartTime, 5);
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

        // 计算移动方向
        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        const distance = direction.length();

        // 如果距离太近，停止移动
        if (distance < 0.1) {
                return;
            }
            
        // 归一化方向
        direction.normalize();

        // 计算新位置
        const moveDistance = this.moveSpeed * deltaTime;
        const newPos = new Vec3();
        Vec3.scaleAndAdd(newPos, this.node.worldPosition, direction, moveDistance);

        // 敌人之间碰撞体积检测与避让
        const willCollide = this.checkCollisionWithEnemy(newPos);
        if (willCollide) {
            const currentPos = this.node.worldPosition;
            const avoidanceDir = this.calculateEnemyAvoidanceDirection(currentPos, direction, deltaTime);
            const avoidanceWeight = 0.3;
            const finalDir = new Vec3();
            Vec3.lerp(finalDir, direction, avoidanceDir, avoidanceWeight);
            finalDir.normalize();
            Vec3.scaleAndAdd(newPos, currentPos, finalDir, moveDistance);
            // 使用最终方向更新翻转方向
            direction.set(finalDir);
        }

        // 限制在屏幕范围内
                const clampedPos = this.clampPositionToScreen(newPos);
                            this.node.setWorldPosition(clampedPos);
                            
                            // 根据移动方向翻转
            this.flipDirection(direction);
            
            // 播放行走动画
            this.playWalkAnimation();
    }


    /**
     * 计算绕路位置（平滑移动，避免弹开效果）
     * @param direction 原始移动方向
     * @param deltaTime 时间间隔
     * @returns 如果找到可行的绕路位置返回该位置，否则返回null
     */

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
        let minDistanceSq = Infinity;

        for (const wall of stoneWalls) {
            if (!wall || !wall.active || !wall.isValid) continue;
            
            const wallScript = wall.getComponent('StoneWall') as any;
            if (!wallScript || !wallScript.isAlive || !wallScript.isAlive()) continue;

            const wallPos = wall.worldPosition;
            const dx = this.node.worldPosition.x - wallPos.x;
            const dy = this.node.worldPosition.y - wallPos.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                nearestWall = wall;
            }
        }

        return nearestWall;
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

            const dx = position.x - wallPos.x;
            const dy = position.y - wallPos.y;
            const distanceSq = dx * dx + dy * dy;
            const minDistance = enemyRadius + wallRadius;
            const minDistanceSq = minDistance * minDistance;

            // 如果距离小于最小距离，说明碰撞（使用平方距离比较）
            if (distanceSq < minDistanceSq) {
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
        this.attackComplete = false; // 重置攻击完成标志
        
    }

    // 恢复默认精灵帧
    restoreDefaultSprite() {
        if (this.sprite && this.defaultSpriteFrame) {
            this.sprite.spriteFrame = this.defaultSpriteFrame;
        }
    }

    // 恢复默认精灵帧

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
        const watchTowerScript = this.currentTarget.getComponent('WatchTower') as any;
        const iceTowerScript = this.currentTarget.getComponent('IceTower') as any; // 添加冰塔支持
        const thunderTowerScript = this.currentTarget.getComponent('ThunderTower') as any; // 添加雷塔支持
        const targetScript = towerScript || warAncientTreeScript || hallScript || swordsmanHallScript || churchScript || priestScript || crystalScript || hunterScript || elfSwordsmanScript || stoneWallScript || watchTowerScript || iceTowerScript || thunderTowerScript;
        
        if (targetScript && targetScript.takeDamage) {
            // 计算受击方向：从敌人指向目标
            const hitDir = new Vec3();
            Vec3.subtract(hitDir, this.currentTarget.worldPosition, this.node.worldPosition);
            if (hitDir.length() > 0.001) {
                hitDir.normalize();
            }
            targetScript.takeDamage(this.attackDamage, hitDir);
            
            // 检查目标是否仍然存活，特别是石墙
            if (targetScript && targetScript.isAlive && !targetScript.isAlive()) {
                const wasStoneWall = !!stoneWallScript;
                this.currentTarget = null!;
                
                
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

    takeDamage(damage: number, hitDirection?: Vec3) {
        if (this.isDestroyed) {
            return;
        }

        // 记录最近一次受击方向（标准化后的力方向）
        if (hitDirection && hitDirection.length() > 0.001) {
            if (!this.lastHitDirection) {
                this.lastHitDirection = new Vec3();
            }
            this.lastHitDirection.set(hitDirection);
            this.lastHitDirection.normalize();
        }

        // 调试日志：敌人受击信息
        // console.info('[Enemy.takeDamage]', this.unitName || this.node.name,
        //     'rawDamage:', damage,
        //     'hitDirection:', hitDirection ? `${hitDirection.x.toFixed(2)},${hitDirection.y.toFixed(2)}` : 'null',
        //     'lastHitDirection:', this.lastHitDirection ? `${this.lastHitDirection.x.toFixed(2)},${this.lastHitDirection.y.toFixed(2)}` : 'null');

        // 10% 概率触发暴击，实际伤害加成
        const isCritical = Math.random() < 0.1;
        const finalDamage = isCritical ? Math.floor(damage * 1.5) : damage;

        // 显示伤害数字（根据是否暴击与受击方向控制表现）
        this.showDamageNumber(finalDamage, isCritical, hitDirection);
        
        // 被攻击时停止移动
        this.stopMoving();
        
        // 播放受击动画
        this.playHitAnimation();

        this.currentHealth -= finalDamage;

        // 更新血条
        if (this.healthBar) {
            this.healthBar.setHealth(this.currentHealth);
        }

        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.die();
        }
    }

    /**
     * 恢复血量
     * @param amount 恢复的血量
     */
    heal(amount: number) {
        if (this.isDestroyed) {
            return;
        }

        // 如果血量已满，不恢复
        if (this.currentHealth >= this.maxHealth) {
            return;
        }

        const oldHealth = this.currentHealth;
        this.currentHealth = Math.min(this.currentHealth + amount, this.maxHealth);
        const actualHeal = this.currentHealth - oldHealth;

        // 更新血条
        if (this.healthBar) {
            this.healthBar.setHealth(this.currentHealth);
        }

        // 显示治疗特效（绿光）
        if (actualHeal > 0) {
            this.showHealEffect(actualHeal);
        }
    }

    /**
     * 显示治疗特效（绿光 + 文字）
     * @param amount 治疗量
     */
    showHealEffect(amount: number) {
        // 创建治疗特效节点
        const healEffectNode = new Node('HealEffect');
        const canvas = find('Canvas');
        if (canvas) {
            healEffectNode.setParent(canvas);
        } else {
            healEffectNode.setParent(this.node.scene);
        }
        
        // 设置位置（在敌人上方）
        const healPos = this.node.worldPosition.clone();
        healPos.y += 30;
        healEffectNode.setWorldPosition(healPos);

        // 添加UITransform
        const uiTransform = healEffectNode.addComponent(UITransform);
        if (uiTransform) {
            uiTransform.setContentSize(60, 40);
        }

        // 添加绿色圆形背景（可选，用于视觉效果）
        const sprite = healEffectNode.addComponent(Sprite);
        if (sprite) {
            sprite.color = new Color(0, 255, 0, 150); // 绿色，半透明
        }

        // 添加文字标签显示治疗量（四舍五入保留个位数，黑边绿字）
        const labelNode = new Node('HealLabel');
        labelNode.setParent(healEffectNode);
        labelNode.setPosition(0, 0, 0);
        const label = labelNode.addComponent(Label);
        const roundedAmount = Math.round(amount); // 四舍五入保留个位数
        label.string = `+${roundedAmount}`;
        label.fontSize = 20;
        label.color = Color.GREEN;
        const outline = labelNode.addComponent(LabelOutline);
        label.outlineColor = new Color(0, 0, 0, 255);
        outline.width = 2;
        
        const labelUITransform = labelNode.addComponent(UITransform);
        if (labelUITransform) {
            labelUITransform.setContentSize(60, 30);
        }

        // 添加UIOpacity用于淡出效果
        const uiOpacity = healEffectNode.addComponent(UIOpacity);
        if (uiOpacity) {
            uiOpacity.opacity = 255;
        }

        // 播放治疗特效动画（向上移动并淡出）
        const startPos = healEffectNode.worldPosition.clone();
        tween(healEffectNode)
            .by(1.0, { position: new Vec3(0, 50, 0) }, { easing: 'sineOut' })
            .to(0.5, { scale: new Vec3(0.5, 0.5, 1) }, { easing: 'sineIn' })
            .parallel(
                tween(uiOpacity).to(1.0, { opacity: 0 })
            )
            .call(() => {
                if (healEffectNode && healEffectNode.isValid) {
                    healEffectNode.destroy();
                }
            })
            .start();
    }

    // 恢复移动
    resumeMovement() {
        // 如果敌人还活着，并且没有其他动画在播放，恢复移动
        if (!this.isDestroyed && !this.isPlayingAttackAnimation && !this.isPlayingDeathAnimation) {
            const myPos = this.node.worldPosition;
            const attackRangeSq = this.attackRange * this.attackRange;

            // 如果有当前目标，向目标移动
            if (this.currentTarget) {
                const targetPos = this.currentTarget.worldPosition;
                const dx = myPos.x - targetPos.x;
                const dy = myPos.y - targetPos.y;
                const distanceSq = dx * dx + dy * dy;

                if (distanceSq > attackRangeSq) {
                    this.playWalkAnimation();
                } else {
                    this.playIdleAnimation();
                }
            } else if (this.targetCrystal && this.targetCrystal.isValid) {
                // 没有当前目标，向水晶移动
                const crystalPos = this.targetCrystal.worldPosition;
                const dx = myPos.x - crystalPos.x;
                const dy = myPos.y - crystalPos.y;
                const distanceSq = dx * dx + dy * dy;

                if (distanceSq > attackRangeSq) {
                    this.playWalkAnimation();
                } else {
                    this.playIdleAnimation();
                }
            } else {
                this.playIdleAnimation();
            }
        }
    }

    showDamageNumber(damage: number, isCritical: boolean = false, hitDirection?: Vec3) {
        // 创建伤害数字节点
        let damageNode: Node;
        if (this.damageNumberPrefab) {
            damageNode = instantiate(this.damageNumberPrefab);
        } else {
            damageNode = new Node('DamageNumber');
        }

        // 如果预制体上自带 DamageNumber 组件（包含自己的上飘逻辑），先移除，避免与当前自定义飘动冲突
        const builtinDamageComp = damageNode.getComponent(DamageNumber);
        if (builtinDamageComp) {
            damageNode.removeComponent(DamageNumber);
        }

        // 添加到Canvas或场景
        const canvas = find('Canvas');
        if (canvas) {
            damageNode.setParent(canvas);
        } else {
            damageNode.setParent(this.node.scene);
        }

        // 起始位置：在敌人上方一点
        const startPos = this.node.worldPosition.clone();
        startPos.y += 30;
        damageNode.setWorldPosition(startPos);

        // 查找或创建 Label
        let label: Label | null = damageNode.getComponent(Label);
        if (!label) {
            const labelsInChildren = damageNode.getComponentsInChildren(Label);
            if (labelsInChildren && labelsInChildren.length > 0) {
                label = labelsInChildren[0];
            }
        }
        if (!label) {
            label = damageNode.addComponent(Label);
            label.fontSize = 20;
        }

        // 文字内容与样式
        const baseDamageText = `-${Math.floor(damage)}`;
        label.string = isCritical ? `${baseDamageText}!` : baseDamageText;
        label.color = isCritical ? new Color(255, 0, 0, 255) : new Color(255, 255, 255, 255);

        // 黑色描边（使用非弃用 API）
        let outline = label.node.getComponent(LabelOutline);
        if (!outline) {
            outline = label.node.addComponent(LabelOutline);
        }
        (label as any).outlineColor = new Color(0, 0, 0, 255);
        (label as any).outlineWidth = 2;

        // 暴击放大（略小一点，避免过于夸张）
        if (isCritical) {
            label.fontSize = label.fontSize * 1.2;
        }

        // 飘动方向：沿箭矢/攻击方向飘动（与受击方向一致）
        const floatDir = new Vec3();
        const sourceDir = hitDirection && hitDirection.length() > 0.001
            ? hitDirection
            : (this.lastHitDirection && this.lastHitDirection.length() > 0.001 ? this.lastHitDirection : null);

        if (sourceDir) {
            floatDir.set(sourceDir);
            floatDir.normalize();
        } else {
            // 如果没有记录受击方向，默认向上
            floatDir.set(0, 1, 0);
        }

        // 飘动距离缩短一半
        const floatDistance = isCritical ? 40 : 25;
        const offset = new Vec3();
        Vec3.scaleAndAdd(offset, startPos, floatDir, floatDistance);
        const endWorldPos = offset;

        // 调试日志：伤害数字飘动方向与位置
        // console.info('[Enemy.showDamageNumber]', this.unitName || this.node.name,
        //     'damage:', damage,
        //     'isCritical:', isCritical,
        //     'hitDirection:', hitDirection ? `${hitDirection.x.toFixed(2)},${hitDirection.y.toFixed(2)}` : 'null',
        //     'usedSourceDir:', sourceDir ? `${sourceDir.x.toFixed(2)},${sourceDir.y.toFixed(2)}` : 'null',
        //     'floatDir:', `${floatDir.x.toFixed(2)},${floatDir.y.toFixed(2)}`,
        //     'startPos:', `${startPos.x.toFixed(1)},${startPos.y.toFixed(1)}`,
        //     'endPos:', `${endWorldPos.x.toFixed(1)},${endWorldPos.y.toFixed(1)}`);

        // 渐隐飘动动画
        const uiOpacity = damageNode.getComponent(UIOpacity) || damageNode.addComponent(UIOpacity);
        uiOpacity.opacity = 255;

        tween(damageNode)
            .to(0.6, { worldPosition: endWorldPos }, { easing: 'sineOut' })
            .parallel(
                tween(uiOpacity).to(0.6, { opacity: 0 })
            )
            .call(() => {
                if (damageNode && damageNode.isValid) {
                    damageNode.destroy();
                }
            })
            .start();
    }

    die() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;
        this.resetBloodRageState();

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
        if (this.gameManager && this.gameManager.addKillCount) {
            this.gameManager.addKillCount(1);
        }
    }

    getHealth(): number {
        return this.currentHealth;
    }

    isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }

    /**
     * 外部调用：进入燃血狂暴（数值翻倍 + 红色泛光 + 持续掉血）
     */
    public enterBloodRage(tier: number = 1) {
        if (this.isDestroyed) {
            return;
        }
        const targetTier = tier > 1 ? 2 : 1;
        if (this.isBloodRageActive && this.bloodRageTier >= targetTier) {
            return;
        }

        const wasActive = this.isBloodRageActive;
        const previousMaxHealth = this.maxHealth;
        if (!wasActive) {
            this.isBloodRageActive = true;
            this.bloodRageBurnTimer = 0;
            this.bloodRageOriginalMaxHealth = this.maxHealth;
            this.bloodRageOriginalMoveSpeed = this.moveSpeed;
            this.bloodRageOriginalAttackDamage = this.attackDamage;
            this.bloodRageOriginalAttackInterval = this.attackInterval;
        }
        this.bloodRageTier = targetTier;

        const healthMul = targetTier >= 2 ? 3 : 2;
        const moveMul = targetTier >= 2 ? 1.5 : 1.25;
        const attackMul = targetTier >= 2 ? 3 : 2;
        const intervalDiv = targetTier >= 2 ? 3 : 2;

        this.maxHealth = this.bloodRageOriginalMaxHealth * healthMul;
        const healthRatio = previousMaxHealth > 0 ? this.currentHealth / previousMaxHealth : 1;
        this.currentHealth = Math.min(this.maxHealth, this.maxHealth * healthRatio);
        this.moveSpeed = this.bloodRageOriginalMoveSpeed * moveMul;
        this.attackDamage = this.bloodRageOriginalAttackDamage * attackMul;
        this.attackInterval = this.bloodRageOriginalAttackInterval / intervalDiv;

        if (this.healthBar) {
            this.healthBar.setMaxHealth(this.maxHealth);
            this.healthBar.setHealth(this.currentHealth);
        }

        this.applyBloodRageVisual();
    }

    private updateBloodRage(deltaTime: number) {
        if (!this.isBloodRageActive || this.isDestroyed) {
            return;
        }
        this.bloodRagePulsePhase += deltaTime * 6;
        this.updateBloodRagePulseVisual();

        this.bloodRageBurnTimer += deltaTime;
        while (this.bloodRageBurnTimer >= 1) {
            this.bloodRageBurnTimer -= 1;
            const inFastBurnZone = this.node && this.node.isValid && this.node.worldPosition.y <= this.BLOOD_RAGE_FAST_BURN_Y;
            const burnRate = inFastBurnZone ? 0.1 : 0.05;
            const burnDamage = this.maxHealth * burnRate;
            this.currentHealth -= burnDamage;
            if (this.healthBar) {
                this.healthBar.setHealth(this.currentHealth);
            }
            if (this.currentHealth <= 0) {
                this.currentHealth = 0;
                this.die();
                return;
            }
        }
    }

    private applyBloodRageVisual() {
        if (!this.sprite) return;
        if (!this.bloodRageOriginalColor) {
            this.bloodRageOriginalColor = this.sprite.color.clone();
        }
        this.bloodRagePulsePhase = 0;
        this.updateBloodRagePulseVisual();
    }

    private updateBloodRagePulseVisual() {
        if (!this.sprite) return;
        const base = this.bloodRageOriginalColor || new Color(255, 255, 255, 255);
        const t = (Math.sin(this.bloodRagePulsePhase) + 1) * 0.5;
        const minRed = 0.35;
        const pulse = minRed + (1 - minRed) * t;
        const r = Math.min(255, Math.floor(base.r + (255 - base.r) * pulse));
        const g = Math.max(0, Math.floor(base.g * (1 - 0.75 * pulse)));
        const b = Math.max(0, Math.floor(base.b * (1 - 0.75 * pulse)));
        this.sprite.color = new Color(r, g, b, base.a);
    }

    private clearBloodRageVisualOnly() {
        if (this.sprite && this.bloodRageOriginalColor) {
            this.sprite.color = this.bloodRageOriginalColor;
        }
    }

    private restoreBloodRageAttributesIfNeeded() {
        if (this.bloodRageOriginalMaxHealth > 0) {
            this.maxHealth = this.bloodRageOriginalMaxHealth;
        }
        if (this.bloodRageOriginalMoveSpeed > 0) {
            this.moveSpeed = this.bloodRageOriginalMoveSpeed;
        }
        if (this.bloodRageOriginalAttackDamage > 0) {
            this.attackDamage = this.bloodRageOriginalAttackDamage;
        }
        if (this.bloodRageOriginalAttackInterval > 0) {
            this.attackInterval = this.bloodRageOriginalAttackInterval;
        }
        if (this.currentHealth > this.maxHealth) {
            this.currentHealth = this.maxHealth;
        }
    }

    private resetBloodRageState() {
        this.restoreBloodRageAttributesIfNeeded();
        this.clearBloodRageVisualOnly();
        this.isBloodRageActive = false;
        this.bloodRageBurnTimer = 0;
        this.bloodRageOriginalMaxHealth = 0;
        this.bloodRageOriginalMoveSpeed = 0;
        this.bloodRageOriginalAttackDamage = 0;
        this.bloodRageOriginalAttackInterval = 0;
        this.bloodRagePulsePhase = 0;
        this.bloodRageOriginalColor = null;
        this.bloodRageTier = 0;
    }

    /**
     * 简化版 AI：索敌 + 移动 + 攻击
     * 参考 Boss.update，实现清晰的流程，并**忽略石墙网格复杂寻路**：
     * 1) 检查游戏状态
     * 2) 更新攻击计时器
     * 3) 查找目标（防御塔 / 角色 / 建筑 / 石墙 / 水晶）
     * 4) 在攻击范围内则攻击，否则向目标移动（包括石墙），没有目标时追水晶
     *
     * 返回值：true 表示已经用简化逻辑处理完本帧，外层 update 不需要再走旧逻辑。
     */
    private runSimpleAI(deltaTime: number): boolean {

        // 已死亡：只更新动画
        if (this.isDestroyed) {
            this.updateAnimation(deltaTime);
            return true;
        }

        // 检查 GameManager 和游戏状态
        if (!this.gameManager) {
            this.findGameManager();
        }
        if (this.gameManager) {
            const state = this.gameManager.getGameState();
            if (state !== GameState.Playing) {
                this.stopMoving();
                this.currentTarget = null!;
                return true;
            }
        }

        // 更新攻击计时器
        this.attackTimer += deltaTime;

        // 步骤1：索敌 - 查找索敌范围内的目标
        // 正在播放攻击动画时，保持当前目标，仅检查其是否仍然有效
        if (this.isPlayingAttackAnimation) {
            if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
                this.currentTarget = null!;
            }
        } else {
            // 不在攻击动画中，正常索敌
            this.findTargetInRange();
        }

        // 步骤2：根据是否有目标决定行动
        if (this.currentTarget && this.currentTarget.isValid) {
            // 有目标：计算平方距离
            const myPos = this.node.worldPosition;
            const targetPos = this.currentTarget.worldPosition;
            const dx = myPos.x - targetPos.x;
            const dy = myPos.y - targetPos.y;
            const distanceSq = dx * dx + dy * dy;
            const attackRangeSq = this.attackRange * this.attackRange;

            if (this.isPlayingAttackAnimation) {
                // 攻击动画期间不移动
                this.stopMoving();
            } else if (distanceSq <= attackRangeSq) {
                // 在攻击范围内，停止移动并尝试攻击
                this.stopMoving();
                if (this.attackTimer >= this.attackInterval) {
                    this.attackTimer = 0;
                    this.attack();
                }
            } else {
                // 不在攻击范围内，向目标移动
                this.moveTowardsTarget(deltaTime);
            }
        } else {
            // 没有目标：朝下方移动
            this.moveDownwards(deltaTime);
        }

        // 更新动画
        this.updateAnimation(deltaTime);
        return true;
    }

    /**
     * 在索敌范围内查找目标（所有单位一视同仁）
     */
    private findTargetInRange() {
        // 动态索敌范围：在画面下方三分之一时扩大索敌范围
        const screenHeight = view.getVisibleSize().height;
        const isInLowerThird = this.node.worldPosition.y < screenHeight / 3;
        const detectionRange = isInLowerThird ? 400 : 200; // 下方区域索敌范围扩大至400像素
        const detectionRangeSq = detectionRange * detectionRange;
        const myPos = this.node.worldPosition;

        let nearestTarget: Node | null = null;
        let minDistanceSq = Infinity;

        // 获取所有可能的目标单位
        const allTargets: Node[] = [];

        // 1. 石墙
        const stoneWallsNode = find('Canvas/StoneWalls');
        if (stoneWallsNode) {
            for (const wall of stoneWallsNode.children) {
                if (wall && wall.active && wall.isValid) {
                    const wallScript = wall.getComponent('StoneWall') as any;
                    if (wallScript && wallScript.isAlive && wallScript.isAlive()) {
                        allTargets.push(wall);
                    }
                }
            }
        }

        // 2. 防御塔（哨塔、冰塔、雷塔）
        const watchTowersNode = find('Canvas/WatchTowers');
        if (watchTowersNode) {
            for (const tower of watchTowersNode.children) {
                if (tower && tower.active && tower.isValid) {
                    const towerScript = tower.getComponent('WatchTower') as any;
                    if (towerScript && towerScript.isAlive && towerScript.isAlive()) {
                        allTargets.push(tower);
                    }
                }
            }
        }

        const iceTowersNode = find('Canvas/IceTowers');
        if (iceTowersNode) {
            for (const tower of iceTowersNode.children) {
                if (tower && tower.active && tower.isValid) {
                    const towerScript = tower.getComponent('IceTower') as any;
                    if (towerScript && towerScript.isAlive && towerScript.isAlive()) {
                        allTargets.push(tower);
                    }
                }
            }
        }

        const thunderTowersNode = find('Canvas/ThunderTowers');
        if (thunderTowersNode) {
            for (const tower of thunderTowersNode.children) {
                if (tower && tower.active && tower.isValid) {
                    const towerScript = tower.getComponent('ThunderTower') as any;
                    if (towerScript && towerScript.isAlive && towerScript.isAlive()) {
                        allTargets.push(tower);
                    }
                }
            }
        }

        // 3. 我方单位（弓箭手、女猎手、精灵剑士、牧师）
        const towersNode = find('Canvas/Towers');
        if (towersNode) {
            for (const tower of towersNode.children) {
                if (tower && tower.active && tower.isValid) {
                    const arrowerScript = tower.getComponent('Arrower') as any;
                    const priestScript = tower.getComponent('Priest') as any;
                    if ((arrowerScript && arrowerScript.isAlive && arrowerScript.isAlive()) ||
                        (priestScript && priestScript.isAlive && priestScript.isAlive())) {
                        allTargets.push(tower);
                    }
                }
            }
        }

        const huntersNode = find('Canvas/Hunters');
        if (huntersNode) {
            for (const hunter of huntersNode.children) {
                if (hunter && hunter.active && hunter.isValid) {
                    const hunterScript = hunter.getComponent('Hunter') as any;
                    if (hunterScript && hunterScript.isAlive && hunterScript.isAlive()) {
                        allTargets.push(hunter);
                    }
                }
            }
        }

        const swordsmenNode = find('Canvas/ElfSwordsmans');
        if (swordsmenNode) {
            for (const swordsman of swordsmenNode.children) {
                if (swordsman && swordsman.active && swordsman.isValid) {
                    const swordsmanScript = swordsman.getComponent('ElfSwordsman') as any;
                    if (swordsmanScript && swordsmanScript.isAlive && swordsmanScript.isAlive()) {
                        allTargets.push(swordsman);
                    }
                }
            }
        }

        // 4. 建筑物（战争古树、猎手大厅、剑士小屋、教堂）
        const treesNode = find('Canvas/WarAncientTrees');
        if (treesNode) {
            for (const tree of treesNode.children) {
                if (tree && tree.active && tree.isValid) {
                    const treeScript = tree.getComponent('WarAncientTree') as any;
                    if (treeScript && treeScript.isAlive && treeScript.isAlive()) {
                        allTargets.push(tree);
                    }
                }
            }
        }

        const hallsNode = find('Canvas/HunterHalls');
        if (hallsNode) {
            for (const hall of hallsNode.children) {
                if (hall && hall.active && hall.isValid) {
                    const hallScript = hall.getComponent('HunterHall') as any;
                    if (hallScript && hallScript.isAlive && hallScript.isAlive()) {
                        allTargets.push(hall);
                    }
                }
            }
        }

        const swordsmanHallsNode = find('Canvas/SwordsmanHalls');
        if (swordsmanHallsNode) {
            for (const hall of swordsmanHallsNode.children) {
                if (hall && hall.active && hall.isValid) {
                    const hallScript = hall.getComponent('SwordsmanHall') as any;
                    if (hallScript && hallScript.isAlive && hallScript.isAlive()) {
                        allTargets.push(hall);
                    }
                }
            }
        }

        const churchesNode = find('Canvas/Churches');
        if (churchesNode) {
            for (const church of churchesNode.children) {
                if (church && church.active && church.isValid) {
                    const churchScript = church.getComponent('Church') as any;
                    if (churchScript && churchScript.isAlive && churchScript.isAlive()) {
                        allTargets.push(church);
                    }
                }
            }
        }

        // 5. 水晶
        if (this.targetCrystal && this.targetCrystal.isValid) {
            const crystalScript = this.targetCrystal.getComponent('Crystal') as any;
            if (crystalScript && crystalScript.isAlive && crystalScript.isAlive()) {
                allTargets.push(this.targetCrystal);
            }
        }

        // 在所有目标中找到索敌范围内最近的目标
        for (const target of allTargets) {
            const dx = target.worldPosition.x - myPos.x;
            const dy = target.worldPosition.y - myPos.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq <= detectionRangeSq && distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                nearestTarget = target;
            }
        }

        // 设置目标
        this.currentTarget = nearestTarget || null!;
    }

    /**
     * 朝下方移动（没有目标时的默认行为）
     */
    private moveDownwards(deltaTime: number) {
        if (this.isPlayingAttackAnimation) {
            this.isPlayingAttackAnimation = false;
            this.attackComplete = false;
            this.stopAllAnimations();
        }

        const moveDistance = this.moveSpeed * deltaTime;
        const direction = new Vec3(0, -1, 0); // 向下
        const newPos = new Vec3();
        Vec3.scaleAndAdd(newPos, this.node.worldPosition, direction, moveDistance);

        // 敌人之间碰撞体积检测与避让
        const willCollide = this.checkCollisionWithEnemy(newPos);
        if (willCollide) {
            const currentPos = this.node.worldPosition;
            const avoidanceDir = this.calculateEnemyAvoidanceDirection(currentPos, direction, deltaTime);
            const avoidanceWeight = 0.3;
            const finalDir = new Vec3();
            Vec3.lerp(finalDir, direction, avoidanceDir, avoidanceWeight);
            finalDir.normalize();
            Vec3.scaleAndAdd(newPos, currentPos, finalDir, moveDistance);
        }

        // 限制在屏幕范围内
        const clampedPos = this.clampPositionToScreen(newPos);
        this.node.setWorldPosition(clampedPos);

        // 播放行走动画
        this.playWalkAnimation();
    }
    /**
     * 重置敌人状态（用于对象池回收）
     */
    private resetEnemyState() {
        this.restoreBloodRageAttributesIfNeeded();
        // 重置所有状态变量
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        this.targetFindTimer = 0;
        this.currentTarget = null!;
        this.isPlayingAttackAnimation = false;
        this.isPlayingHitAnimation = false;
        this.isPlayingDeathAnimation = false;
        this.isPlayingIdleAnimation = false;
        this.isPlayingWalkAnimation = false;
        this.attackComplete = false;
        
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
     * 检查从起点到终点的路径是否被石墙阻挡
     * @param startPos 起点位置
     * @param endPos 终点位置
     * @returns 如果路径被石墙阻挡返回true，否则返回false
     */


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

        // 检查与每个敌人的碰撞（使用平方距离比较）
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
            const dx = position.x - enemyPos.x;
            const dy = position.y - enemyPos.y;
            const distanceSq = dx * dx + dy * dy;
            
            // 获取敌人的碰撞半径（如果有collisionRadius属性）
            const otherRadius = enemyScript.collisionRadius || 5;
            const minDistance = this.collisionRadius + otherRadius;
            const minDistanceSq = minDistance * minDistance;

            if (distanceSq < minDistanceSq && distanceSq > 0.01) {
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

        // 检测范围：碰撞半径的4倍（敌人之间统一使用较小的碰撞半径）
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
            const dx = currentPos.x - enemyPos.x;
            const dy = currentPos.y - enemyPos.y;
            const distanceSq = dx * dx + dy * dy;
            
            // 获取敌人的碰撞半径
            const otherRadius = enemyScript.collisionRadius || 5;
            const minDistance = this.collisionRadius + otherRadius;
            const minDistanceSq = minDistance * minDistance;
            const detectionRangeSq = detectionRange * detectionRange;

            if (distanceSq < detectionRangeSq && distanceSq > 0.01) {
                const distance = Math.sqrt(distanceSq);
                const avoidDir = new Vec3();
                Vec3.subtract(avoidDir, currentPos, enemyPos);
                avoidDir.normalize();
                
                // 距离越近，避障力越强
                let strength = 1 - (distance / detectionRange);
                
                // 如果已经在碰撞范围内，大幅增强避障力
                if (distanceSq < minDistanceSq) {
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

