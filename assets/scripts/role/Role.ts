import { _decorator, Component, Node, Vec3, Prefab, instantiate, find, Graphics, UITransform, Label, Color, tween, EventTouch, input, Input, resources, Sprite, SpriteFrame, Texture2D, Camera, AudioClip, view, CCString, UIOpacity, LabelOutline } from 'cc';
import { AudioManager } from '../AudioManager';
import { GameManager } from '../GameManager';
import { GameState } from '../GameState';
import { HealthBar } from '../HealthBar';
import { ManaBar } from '../ManaBar';
import { DamageNumber } from '../DamageNumber';
import { Arrow } from '../Arrow';
import { UnitSelectionManager } from '../UnitSelectionManager';
import { UnitInfo } from '../UnitInfoPanel';
import { UnitType } from '../UnitType';
import { UnitManager } from '../UnitManager';
import { UnitPool } from '../UnitPool';
import { DamageStatistics } from '../DamageStatistics';
import { BuffManager } from '../BuffManager';
import { TalentEffectManager } from '../TalentEffectManager';
import { UnitConfigManager } from '../UnitConfigManager';
// import { PerformanceMonitor } from './PerformanceMonitor';
const { ccclass, property } = _decorator;

@ccclass('Role')
export class Role extends Component {
    @property
    maxHealth: number = 0;

    @property
    attackRange: number = 0;

    @property
    attackDamage: number = 0;

    @property
    attackInterval: number = 0;

    @property(Prefab)
    bulletPrefab: Prefab = null!;

    @property(Prefab)
    arrowPrefab: Prefab = null!; // 弓箭预制体（支持后期更新贴图）

    @property(Prefab)
    explosionEffect: Prefab = null!;

    @property(Prefab)
    damageNumberPrefab: Prefab = null!;

    @property
    buildCost: number = 0; // 建造成本（用于回收和升级）
    
    @property
    level: number = 0; // 单位等级

    // 攻击动画相关属性
    @property(SpriteFrame)
    attackAnimationFrames: SpriteFrame[] = []; // 攻击动画帧数组（推荐：在编辑器中手动设置）
    
    // 被攻击动画相关属性
    @property(SpriteFrame)
    hitAnimationFrames: SpriteFrame[] = []; // 被攻击动画帧数组
    
    // 死亡动画相关属性
    @property(SpriteFrame)
    deathAnimationFrames: SpriteFrame[] = []; // 死亡动画帧数组
    
    // 音效相关属性
    @property(AudioClip)
    shootSound: AudioClip = null!; // 箭矢射出时的音效
    
    @property(AudioClip)
    hitSound: AudioClip = null!; // 箭矢击中敌人时的音效

    @property(Texture2D)
    attackAnimationTexture: Texture2D = null!; // 攻击动画纹理（12帧图片）

    @property
    framesPerRow: number = 0; // 每行帧数（横向排列为12，3x4网格为3，4x3网格为4）

    @property
    totalFrames: number = 0; // 总帧数

    @property
    attackAnimationDuration: number = 0; // 攻击动画时长（秒）
    
    @property
    hitAnimationDuration: number = 0; // 被攻击动画时长（秒）
    
    @property
    deathAnimationDuration: number = 0; // 死亡动画时长（秒）

    // 移动相关属性
    @property
    moveSpeed: number = 0; // 移动速度（像素/秒）

    @property(SpriteFrame)
    moveAnimationFrames: SpriteFrame[] = []; // 移动动画帧数组（可选）

    @property
    moveAnimationDuration: number = 0; // 移动动画时长（秒）

    // 待机动画相关属性（最多支持3段待机动画）
    @property({ type: [SpriteFrame], tooltip: "待机动画帧数组1（可选，最多支持3段待机动画）" })
    idleAnimationFrames1: SpriteFrame[] = []; // 待机动画帧数组1

    @property({ type: [SpriteFrame], tooltip: "待机动画帧数组2（可选，最多支持3段待机动画）" })
    idleAnimationFrames2: SpriteFrame[] = []; // 待机动画帧数组2

    @property({ type: [SpriteFrame], tooltip: "待机动画帧数组3（可选，最多支持3段待机动画）" })
    idleAnimationFrames3: SpriteFrame[] = []; // 待机动画帧数组3

    @property
    idleAnimationDuration: number = 1.0; // 待机动画时长（秒）

    @property
    collisionRadius: number = 15; // 碰撞半径（像素）

    @property(SpriteFrame)
    cardIcon: SpriteFrame = null!; // 单位名片图片

    // 单位类型
    public unitType: UnitType = UnitType.CHARACTER;
    
    // 单位信息属性
    @property
    unitName: string = "";
    
    @property
    unitDescription: string = "";
    
    @property(SpriteFrame)
    unitIcon: SpriteFrame = null!;

    protected currentHealth: number = 0;
    protected healthBar: HealthBar = null!;
    protected healthBarNode: Node = null!;
    
    // 蓝量系统
    protected maxMana: number = 100; // 最大蓝量
    protected currentMana: number = 100; // 当前蓝量
    protected manaRegenRate: number = 1; // 每秒回复蓝量
    protected manaRegenTimer: number = 0; // 蓝量回复计时器
    protected manaBar: ManaBar = null!;
    protected manaBarNode: Node = null!;
    protected hasSkill: boolean = false; // 是否拥有技能（从天赋系统获取）
    protected selectionPanel: Node = null!; // 选择面板
    protected isDestroyed: boolean = false;
    protected attackTimer: number = 0;
    protected currentTarget: Node = null!;
    protected gameManager: GameManager = null!;
    protected sprite: Sprite = null!; // Sprite组件引用
    protected defaultSpriteFrame: SpriteFrame = null!; // 默认SpriteFrame（动画结束后恢复）
    protected defaultScale: Vec3 = new Vec3(1, 1, 1); // 默认缩放（用于恢复翻转）
    protected isPlayingAttackAnimation: boolean = false; // 是否正在播放攻击动画
    protected isPlayingHitAnimation: boolean = false; // 是否正在播放被攻击动画
    protected isPlayingDeathAnimation: boolean = false; // 是否正在播放死亡动画
    protected isMoving: boolean = false; // 是否正在移动
    protected moveTarget: Node = null!; // 移动目标（敌人）
    protected isPlayingMoveAnimation: boolean = false; // 是否正在播放移动动画
    protected isPlayingIdleAnimation: boolean = false; // 是否正在播放待机动画
    // 在最近攻击或受击后的这段时间内禁止播放待机动画（秒）
    protected idleBlockTimer: number = 0;
    protected idleAnimationOriginalSizeMode: number | null = null; // 待机动画前的原始sizeMode（Sprite.SizeMode枚举值）
    protected idleAnimationOriginalSize: { width: number; height: number } | null = null; // 待机动画前的原始尺寸
    protected idleAnimationOriginalTrim: boolean | null = null; // 待机动画前的原始trim设置
    protected idleAnimationOriginalType: number | null = null; // 待机动画前的原始type设置（Sprite.Type枚举值）
    protected idleAnimationOriginalScale: Vec3 | null = null; // 待机动画前的原始缩放
    protected moveAnimationDisplaySize: { width: number; height: number } | null = null; // 移动动画时的实际显示大小
    protected currentIdleAnimationSegmentIndex: number = -1; // 当前播放的待机动画段落索引（用于判断是否是第三段）
    protected avoidDirection: Vec3 = new Vec3(); // 避障方向
    protected avoidTimer: number = 0; // 避障计时器
    protected collisionCheckCount: number = 0; // 碰撞检测调用计数（用于调试）
    protected manualMoveTarget: Vec3 | null = null!; // 手动移动目标位置
    protected isManuallyControlled: boolean = false; // 是否正在手动控制
    protected isDefending: boolean = false; // 是否处于防御状态（停止移动但仍攻击）
    protected globalTouchHandler: ((event: EventTouch) => void) | null = null!; // 全局触摸事件处理器
    protected isHighlighted: boolean = false; // 是否高亮显示
    protected highlightNode: Node = null!; // 高亮效果节点
    protected unitSelectionManager: UnitSelectionManager = null!; // 单位选择管理器
    protected isHit: boolean = false; // 是否正在被攻击
    protected animationTimer: number = 0; // 动画计时器
    protected currentAnimationFrameIndex: number = 0; // 当前动画帧索引
    protected unitManager: UnitManager = null!; // 单位管理器引用（性能优化）
    protected targetFindTimer: number = 0; // 目标查找计时器
    protected readonly TARGET_FIND_INTERVAL: number = 0.2; // 目标查找间隔（秒），不是每帧都查找
    protected hasFoundFirstTarget: boolean = false; // 是否已经找到过第一个目标（用于首次立即查找）
    
    // 出场后自动前移（若未设置集结点/未收到手动移动命令）
    private autoRoamScheduled: boolean = false;
    private autoRoamCallback: (() => void) | null = null;

    // 是否被手动控制过（如果是，则取消自动上移）
    private wasManuallyControlled: boolean = false;
    
    // 性能优化：碰撞检测频率控制
    protected collisionCheckTimer: number = 0; // 碰撞检测计时器
    protected readonly COLLISION_CHECK_INTERVAL: number = 0.05; // 碰撞检测间隔（秒），每0.05秒检测一次
    protected lastCollisionResult: boolean = false; // 上次碰撞检测结果
    
    // 性能优化：复用Vec3对象，避免频繁创建
    protected tempVec3_1: Vec3 = new Vec3();
    protected tempVec3_2: Vec3 = new Vec3();
    protected tempVec3_3: Vec3 = new Vec3();

    // 性能优化：缓存 Camera 引用，避免重复查找（添加于 2026/04/08）
    protected cachedCamera: Camera | null = null;
    
    // 防止 onEnable 重复应用增幅
    private _enhancementsApplied: boolean = false;
    
    // 保存初始属性值（用于对象池回收时恢复）
    private _initialMaxHealth: number = 0;
    private _initialAttackDamage: number = 0;
    private _initialAttackInterval: number = 0;
    private _initialMoveSpeed: number = 0;
    
    // 智能避让系统：防止抽搐式移动
    protected cachedAvoidDirection: Vec3 = new Vec3(); // 缓存的避让方向
    protected avoidDirectionTimer: number = 0; // 避让方向持续时间
    protected readonly AVOID_DIRECTION_DURATION: number = 0.5; // 避让方向保持时间（秒）
    protected stuckTimer: number = 0; // 卡住计时器
    protected readonly STUCK_THRESHOLD: number = 0.3; // 判定为卡住的时间阈值（秒）
    protected lastPosition: Vec3 = new Vec3(); // 上一帧的位置
    protected isStuck: boolean = false; // 是否卡住
    protected waitTimer: number = 0; // 等待计时器
    protected readonly WAIT_DURATION: number = 0.2; // 卡住后等待时间（秒）
    
    // 对象池相关：预制体名称（用于对象池回收）
    public prefabName: string = ""; // 默认值，子类可以重写

    // 对话框相关属性
    @property({ type: [CCString], tooltip: "战斗口号数组，每种单位可以配置自己的战斗口号" })
    battleSlogans: string[] = []; // 战斗口号数组（可在编辑器中配置）
    @property({ type: [CCString], tooltip: "待机口号数组，在播放待机动画时触发（如：休息一下吧，指挥官）" })
    idleSlogans: string[] = []; // 待机口号数组（可在编辑器中配置）
    private dialogNode: Node | null = null; // 对话框节点
    private dialogLabel: Label | null = null; // 对话框文字标签
    private isDialogIdleSlogan: boolean = false; // 当前对话框是否为“待机口号”
    private dialogTimer: number = 0; // 对话框显示计时器（用于控制显示时间和渐隐）
    private dialogIntervalTimer: number = 0; // 对话框间隔计时器（用于累计间隔时间）
    private dialogInterval: number = 0; // 下次显示对话框的间隔时间（3-6秒随机，稍微提高口号频率）
    private lastDialogIndexLogTime: number = 0; // 调试：限制 index 日志频率，避免刷屏
    private dialogWorldMaxRecalcTimer: number = 0; // worldMaxIndex 重算计时器
    private cachedDialogWorldMaxIndex: number = -1; // 缓存 worldMaxIndex，避免每帧 for 循环
    private readonly DIALOG_WORLD_MAX_RECALC_INTERVAL: number = 2; // 每2秒重算一次 worldMaxIndex
    private readonly ENABLE_DIALOG_INDEX_DEBUG: boolean = false; // 默认关闭重型调试遍历
    private readonly DIALOG_MIN_INTERVAL: number = 3; // 最小间隔从 5 秒调整为 3 秒
    private readonly DIALOG_MAX_INTERVAL: number = 6; // 最大间隔从 10 秒调整为 6 秒
    private readonly DIALOG_DURATION: number = 2; // 对话框显示持续时间2秒

    // 第三段待机动画“拉宽50%”相关：
    // 由于血条/对话框是 this.node 的子节点，如果直接拉宽 this.node，会一起被拉宽；
    // 所以在拉宽生效时对血条/对话框做反向缩放补偿，保持它们宽度不变。
    
    // 性能监控相关属性
    private static unitCountLogTimer: number = 0; // 单位数量日志输出计时器（静态，所有Role实例共享）
    private static readonly UNIT_COUNT_LOG_INTERVAL: number = 1.0; // 单位数量日志输出间隔（秒）
    
    // 节点缓存（性能优化：避免每帧 find()）
    private static cachedCrystalNode: Node | null = null;
    private static cachedTowersNode: Node | null = null;
    private static cachedHuntersNode: Node | null = null;
    private static cachedMagesNode: Node | null = null;
    private static cachedElfSwordsmansNode: Node | null = null;
    private static cachedEnemiesNode: Node | null = null;
    private static cachedMinotaurWarriorsNode: Node | null = null;
    private static cacheInitialized: boolean = false;
    private static recursiveFindWarningCount: number = 0; // 递归查找警告计数
    private static cachedGameManagerWarned: boolean = false; // GameManager 警告标志

    /**
     * 获取用于配置 / 天赋 / 卡片增幅的单位ID
     * 优先使用 prefabName（在建造/生产时显式设置，不会被代码压缩影响）
     * 回退到 constructor.name 以兼容旧数据
     */
    protected getUnitIdForEnhancement(): string {
        if (this.prefabName && this.prefabName.trim() !== '') {
            return this.prefabName;
        }
        return this.constructor.name;
    }

    start() {
        
        // 保存初始属性值（用于对象池回收时恢复）
        // 注意：从配置文件中读取基础值，而不是当前值（当前值可能已被配置管理器修改）
        if (this._initialMaxHealth === 0) {
            // 只在第一次保存
            const configManager = UnitConfigManager.getInstance();
            const unitId = this.getUnitIdForEnhancement();
            const config = configManager.getUnitConfig(unitId);
            
            if (config && config.baseStats) {
                // 从配置文件读取基础值
                this._initialMaxHealth = config.baseStats.maxHealth || this.maxHealth;
                this._initialAttackDamage = config.baseStats.attackDamage || this.attackDamage;
                this._initialAttackInterval = config.baseStats.attackInterval || this.attackInterval;
                this._initialMoveSpeed = config.baseStats.moveSpeed || this.moveSpeed;
            } else {
                // 如果配置不存在，使用当前值
                this._initialMaxHealth = this.maxHealth;
                this._initialAttackDamage = this.attackDamage;
                this._initialAttackInterval = this.attackInterval;
                this._initialMoveSpeed = this.moveSpeed;
            }
        }
        
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        this.currentTarget = null!;
        this.isPlayingAttackAnimation = false;
        this.hasFoundFirstTarget = false; // 初始化首次查找标志
        
        // 初始化智能避让系统
        this.lastPosition.set(this.node.worldPosition);
        this.cachedAvoidDirection.set(0, 0, 0);
        this.avoidDirectionTimer = 0;
        this.stuckTimer = 0;
        this.isStuck = false;
        this.waitTimer = 0;
        
        // 获取Sprite组件
        this.sprite = this.node.getComponent(Sprite);
        if (this.sprite) {
            // 保存默认SpriteFrame
            this.defaultSpriteFrame = this.sprite.spriteFrame;
            // 保存默认缩放
            this.defaultScale = this.node.scale.clone();
        }
        
        // 初始化攻击动画帧
        this.initAttackAnimation();
        
        // 查找游戏管理器
        this.findGameManager();
        
        // 查找单位管理器（性能优化）
        this.unitManager = UnitManager.getInstance();
        
        // 查找单位选择管理器
        this.findUnitSelectionManager();
        
        // 初始化节点缓存（只在第一个单位创建时执行一次）
        this.initializeNodeCache();
        
        // 创建血条
        this.createHealthBar();
        
        // 检查是否有技能（在onEnable中创建蓝量条，因为需要先应用天赋增幅）
        
        // 初始化对话框系统
        this.initDialogSystem();
        
        // 监听点击事件
        this.node.on(Node.EventType.TOUCH_END, this.onTowerClick, this);

        // 性能优化：缓存 Camera 引用，避免重复查找（添加于 2026/04/08）
        const cameraNode = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
        this.cachedCamera = cameraNode?.getComponent(Camera) || null;
        
        // 注意：不在 start() 中应用增幅，统一在 onEnable() 中处理
        // 这样可以确保首次创建和对象池复用时的行为一致
    }
    
    /**
     * 应用天赋增幅到单位
     * 注意：必须在 applyBuffsFromManager 之前调用
     */
    protected applyTalentEnhancements() {
        const talentEffectManager = TalentEffectManager.getInstance();
        const unitId = this.getUnitIdForEnhancement();
        
        // 应用单位卡片强化
        talentEffectManager.applyUnitEnhancements(unitId, this);
        
        // 应用公共天赋增幅
        talentEffectManager.applyTalentEffects(this);
    }
    
    /**
     * 初始化节点缓存（静态方法，只执行一次）
     * 性能优化：避免每帧调用 find()
     */
    private initializeNodeCache() {
        if (Role.cacheInitialized) {
            return;
        }
        
        console.warn('[Role性能优化] 开始初始化节点缓存...');
        
        // 缓存常用节点
        Role.cachedCrystalNode = find('Crystal');
        Role.cachedTowersNode = find('Canvas/Towers');
        Role.cachedHuntersNode = find('Canvas/Hunters');
        Role.cachedMagesNode = find('Canvas/Mages');
        Role.cachedElfSwordsmansNode = find('Canvas/ElfSwordsmans');
        Role.cachedEnemiesNode = find('Canvas/Enemies');
        Role.cachedMinotaurWarriorsNode = find('Canvas/MinotaurWarriors');
        
        Role.cacheInitialized = true;
        
        console.warn('[Role性能优化] 节点缓存初始化完成:', {
            crystal: !!Role.cachedCrystalNode,
            towers: !!Role.cachedTowersNode,
            hunters: !!Role.cachedHuntersNode,
            mages: !!Role.cachedMagesNode,
            elfSwordsmans: !!Role.cachedElfSwordsmansNode,
            enemies: !!Role.cachedEnemiesNode,
            minotaurWarriors: !!Role.cachedMinotaurWarriorsNode
        });
    }

    /**
     * 查找单位选择管理器
     * 优化：只在 start 时调用一次
     */
    findUnitSelectionManager() {
        // 方法1: 通过节点名称查找
        let managerNode = find('Canvas/UnitSelectionManager');
        if (managerNode) {
            this.unitSelectionManager = managerNode.getComponent(UnitSelectionManager);
            if (this.unitSelectionManager) {
                return;
            }
        }
        
        // 如果找不到，记录警告但不递归查找
        console.warn('[Role性能优化] 未找到 UnitSelectionManager 节点');
    }

    initAttackAnimation() {
        // 如果已经在编辑器中设置了attackAnimationFrames，直接使用
        if (this.attackAnimationFrames && this.attackAnimationFrames.length > 0) {
            const validFrames = this.attackAnimationFrames.filter(frame => frame != null);
            return;
        }

        // 如果没有设置帧数组，尝试从纹理中加载
        if (this.attackAnimationTexture) {
            this.loadFramesFromTexture();
        }
    }

    loadFramesFromTexture() {
        // 注意：Cocos Creator中，从Texture2D直接分割SpriteFrame需要手动计算
        // 这里提供一个基础实现，但推荐在编辑器中手动设置SpriteFrame数组
        
        // 如果纹理已导入为SpriteAtlas，应该使用SpriteAtlas的方式
        // 这里假设纹理是单行排列的12帧
        
        if (!this.sprite) {
            return;
        }

        // 由于Cocos Creator的API限制，从Texture2D直接创建SpriteFrame比较复杂
        // 推荐做法：在编辑器中手动设置attackAnimationFrames数组
        // 或者使用SpriteAtlas资源
        
        
    }

    createHealthBar() {
        // 创建血条节点
        this.healthBarNode = new Node('HealthBar');
        this.healthBarNode.setParent(this.node);
        this.healthBarNode.setPosition(0, 30, 0); // 在弓箭手上方
        // 确保血条初始缩放为正数（正常朝向）
        this.refreshOverheadNodesScale();
        
        // 添加HealthBar组件
        this.healthBar = this.healthBarNode.addComponent(HealthBar);
        if (this.healthBar) {
            this.healthBar.setMaxHealth(this.maxHealth);
            this.healthBar.setHealth(this.currentHealth);
        }
    }

    /**
     * 创建蓝量条（仅在拥有技能时显示）
     */
    createManaBar() {
        if (!this.hasSkill) {
            return; // 没有技能，不创建蓝量条
        }

        // 确保在显示蓝条的同时，血条也存在并可见
        if (!this.healthBarNode || !this.healthBarNode.isValid) {
            // 如果还没创建血条，先创建血条
            this.createHealthBar();
        } else {
            // 已有血条，则保证它是激活状态
            this.healthBarNode.active = true;
        }
        
        // 创建蓝量条节点
        this.manaBarNode = new Node('ManaBar');
        this.manaBarNode.setParent(this.node);
        // 蓝量条在血条下方，血条在30位置，蓝量条在25位置（血条高度约4，间距约1）
        this.manaBarNode.setPosition(0, 25, 0);
        // 确保蓝量条初始缩放为正数（正常朝向）
        this.refreshOverheadNodesScale();
        
        // 添加ManaBar组件
        this.manaBar = this.manaBarNode.addComponent(ManaBar);
        if (this.manaBar) {
            this.manaBar.setMaxMana(this.maxMana);
            this.manaBar.setMana(this.currentMana);
        }
        
        // 显示蓝量条
        this.manaBarNode.active = true;
    }
    
    /**
     * 检查是否有技能（子类可以重写此方法）
     * 默认检查PlayerDataManager中是否有技能配置
     */
    protected checkSkill() {
        // 默认没有技能，子类可以重写此方法
        this.hasSkill = false;
    }
    
    /**
     * 更新蓝量（每秒回复）
     */
    protected updateMana(deltaTime: number) {
        if (!this.hasSkill || this.isDestroyed) {
            return;
        }
        
        // 蓝量回复
        this.manaRegenTimer += deltaTime;
        if (this.manaRegenTimer >= 1.0) {
            this.manaRegenTimer = 0;
            if (this.currentMana < this.maxMana) {
                this.currentMana = Math.min(this.currentMana + this.manaRegenRate, this.maxMana);
                if (this.manaBar) {
                    this.manaBar.setMana(this.currentMana);
                }
            }
        }
    }
    
    /**
     * 消耗蓝量
     * @param amount 消耗的蓝量
     * @returns 是否成功消耗（蓝量足够）
     */
    protected consumeMana(amount: number): boolean {
        if (!this.hasSkill) {
            return false;
        }
        
        if (this.currentMana >= amount) {
            this.currentMana -= amount;
            if (this.manaBar) {
                this.manaBar.setMana(this.currentMana);
            }
            return true;
        }
        return false;
    }
    
    /**
     * 检查是否有足够的蓝量
     */
    protected hasEnoughMana(amount: number): boolean {
        return this.hasSkill && this.currentMana >= amount;
    }
    /**
     * 刷新血条/对话框缩放：
     * - 血条/蓝条根据角色朝向翻转
     * - 对话框保持固定朝向，文字始终从左往右显示
     */
    private refreshOverheadNodesScale() {
        // 血条/蓝条需要根据角色朝向翻转
        const overheadScaleX = this.node.scale.x < 0 ? -1 : 1;

        // 第三段待机动画拉宽 50% 时，对血条/对话框做反向补偿，保持它们宽度不变
        const isWideIdle = this.currentIdleAnimationSegmentIndex === 2 && this.isPlayingIdleAnimation;
        const wideIdleCompensationX = isWideIdle ? 1 / 1.5 : 1;

        // 血条/蓝条需要根据角色朝向翻转
        if (this.healthBarNode && this.healthBarNode.isValid) {
            this.healthBarNode.setScale(overheadScaleX * wideIdleCompensationX, 1, 1);
        }
        // 蓝条和血条保持一致的朝向
        if (this.manaBarNode && this.manaBarNode.isValid) {
            this.manaBarNode.setScale(overheadScaleX * wideIdleCompensationX, 1, 1);
        }

        // 对话框保持固定朝向：文字始终从左往右显示，不跟随角色翻转
        // 第三段待机动画拉宽时，做反向补偿
        if (this.dialogNode && this.dialogNode.isValid) {
            this.dialogNode.setScale(wideIdleCompensationX, 1, 1);
        }
    }

    /**
     * 初始化对话框系统
     */
    initDialogSystem() {
        this.dialogTimer = 0;
        this.dialogIntervalTimer = 0;
        this.dialogInterval = this.DIALOG_MIN_INTERVAL + Math.random() * (this.DIALOG_MAX_INTERVAL - this.DIALOG_MIN_INTERVAL);
    }

    /**
     * 创建对话框节点
     */
    createDialog(sloganText?: string, isIdleSlogan: boolean = false) {
        if (this.dialogNode && this.dialogNode.isValid) {
            // 如果对话框已存在，先销毁
            this.dialogNode.destroy();
        }
        // 记录当前对话框类型
        this.isDialogIdleSlogan = isIdleSlogan;

        // 创建对话框节点
        this.dialogNode = new Node('Dialog');
        // 关键改造：口号不挂在单位节点下，避免被石墙等“世界物体”遮挡
        // 统一挂到 Canvas 下，并放到 TopUI（木材/金币栏）之下：只会被顶层 UI 遮挡。
        const canvas = find('Canvas');
        if (canvas && canvas.isValid) {
            // 固定挂到 Canvas 根下，避免落在 UI 子树里导致跨父节点层级不可控
            this.dialogNode.setParent(canvas);
        } else if (this.node.scene) {
            this.dialogNode.setParent(this.node.scene);
        } else {
            this.dialogNode.setParent(this.node.parent);
        }

        this.cachedDialogWorldMaxIndex = -1;
        this.dialogWorldMaxRecalcTimer = 0;
        this.ensureDialogRenderOrder(true);

        // 初始位置：跟随单位头顶（世界坐标）
        const startPos = this.node.worldPosition.clone();
        startPos.y += 50;
        this.dialogNode.setWorldPosition(startPos);
        // 根据当前单位的朝向设置对话框scale，并在第三段待机拉宽时做反向补偿
        this.refreshOverheadNodesScale();

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
        // 如果提供了口号文本，使用提供的文本；否则根据类型获取
        if (sloganText) {
            this.dialogLabel.string = sloganText;
        } else if (isIdleSlogan) {
            this.dialogLabel.string = this.getRandomIdleSlogan();
        } else {
            this.dialogLabel.string = this.getRandomSlogan();
        }
        this.dialogLabel.fontSize = 16;
        this.dialogLabel.color = new Color(0, 255, 0, 255); // 绿色文字（我方单位）
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
            this.dialogLabel.color = new Color(0, 255, 0, 255); // 绿色文字（我方单位）
        }

        // 调试：创建时打印一次口号与石墙层级（默认关闭）
        if (this.ENABLE_DIALOG_INDEX_DEBUG) {
            this.logDialogAndStoneWallIndices('create');
        }
    }

    /**
     * 调试输出：口号节点与石墙节点的 parent/siblingIndex
     */
    private logDialogAndStoneWallIndices(tag: string) {
        if (!this.ENABLE_DIALOG_INDEX_DEBUG) return;
        try {
            const dialog = this.dialogNode;
            if (!dialog || !dialog.isValid) return;
            const dParent = dialog.parent;
            console.log(
                `[Role.dialog.index][${tag}] dialog=${dialog.name}, parent=${dParent ? dParent.name : 'null'}, index=${dialog.getSiblingIndex()}`
            );

            const canvas = find('Canvas');
            if (!canvas || !canvas.isValid) {
                console.log(`[Role.dialog.index][${tag}] Canvas not found`);
                return;
            }

            const stack: Node[] = [canvas];
            let hitCount = 0;
            while (stack.length > 0) {
                const n = stack.pop()!;
                for (const c of n.children) {
                    stack.push(c);
                }

                const hasStoneWallComp = !!n.getComponent('StoneWall');
                const nameLikeStoneWall = n.name === 'StoneWall' || n.name.includes('StoneWall') || n.name.includes('石墙');
                if (!hasStoneWallComp && !nameLikeStoneWall) continue;

                hitCount++;
                const p = n.parent;
                console.log(
                    `[Role.dialog.index][${tag}] stoneWall#${hitCount} node=${n.name}, parent=${p ? p.name : 'null'}, index=${n.getSiblingIndex()}`
                );
            }

            if (hitCount === 0) {
                console.log(`[Role.dialog.index][${tag}] no StoneWall nodes found under Canvas`);
            }
        } catch (e) {
            console.warn('[Role.dialog.index] log failed:', e);
        }
    }

    /**
     * 统一口号渲染顺序：
     * - 高于世界层（StoneWalls/Roles/Enemies/Builds 等）
     * - 低于顶层 UI（UI/HUD/TopUI）
     */
    private ensureDialogRenderOrder(recalcWorldMax: boolean = false) {
        try {
            if (!this.dialogNode || !this.dialogNode.isValid) return;
            const canvas = find('Canvas');
            if (!canvas || !canvas.isValid || this.dialogNode.parent !== canvas) return;

            const topUi = find('Canvas/UI') || find('Canvas/HUD') || find('Canvas/TopUI');
            const topUiIndex = topUi && topUi.isValid && topUi.parent === canvas ? topUi.getSiblingIndex() : canvas.children.length;

            if (recalcWorldMax || this.cachedDialogWorldMaxIndex < 0) {
                const worldParentNames = new Set([
                    'StoneWalls', 'Enemies', 'Enemys', 'Roles', 'Units', 'Builds', 'Bullets', 'Effects'
                ]);
                let worldMaxIndex = -1;
                for (const child of canvas.children) {
                    if (!child || !child.isValid) continue;
                    if (child === this.dialogNode) continue;
                    if (worldParentNames.has(child.name)) {
                        worldMaxIndex = Math.max(worldMaxIndex, child.getSiblingIndex());
                    }
                }
                this.cachedDialogWorldMaxIndex = worldMaxIndex;
            }

            const minIndex = this.cachedDialogWorldMaxIndex + 1;
            const maxIndex = Math.max(0, topUiIndex - 1);
            const targetIndex = Math.max(minIndex, maxIndex);
            this.dialogNode.setSiblingIndex(targetIndex);
        } catch {}
    }

    /**
     * 如果当前正在显示的是待机口号对话框，则立即清理。
     * 用于进入移动/攻击等动作时，避免“我休息一下，指挥官”残留到战斗过程中。
     */
    private clearIdleSloganDialogIfAny() {
        if (this.isDialogIdleSlogan && this.dialogNode && this.dialogNode.isValid) {
            this.dialogNode.destroy();
            this.dialogNode = null;
            this.dialogLabel = null;
            this.dialogTimer = 0;
            this.isDialogIdleSlogan = false;
        }
    }

    /**
     * 获取随机口号
     */
    getRandomSlogan(): string {
        // 如果配置了战斗口号，使用配置的口号；否则返回默认口号
        if (this.battleSlogans && this.battleSlogans.length > 0) {
            const index = Math.floor(Math.random() * this.battleSlogans.length);
            return this.battleSlogans[index];
        }
        // 默认口号（如果没有配置）
        return '为了荣耀！';
    }

    /**
     * 获取随机待机口号
     */
    getRandomIdleSlogan(): string {
        // 如果配置了待机口号，使用配置的口号；否则返回默认待机口号
        if (this.idleSlogans && this.idleSlogans.length > 0) {
            const index = Math.floor(Math.random() * this.idleSlogans.length);
            return this.idleSlogans[index];
        }
        // 默认待机口号（如果没有配置）
        return '我休息一下，指挥官';
    }

    /**
     * 更新对话框系统（检查间隔时间，创建对话框）
     * 修改：只有在移动或攻击时才播放口号
     */
    updateDialogSystem(deltaTime: number) {
        // 如果没有配置战斗口号，不显示对话框
        if (!this.battleSlogans || this.battleSlogans.length === 0) {
            return;
        }

        // 如果对话框正在显示，更新对话框
        if (this.dialogNode && this.dialogNode.isValid) {
            this.updateDialog(deltaTime);
            return;
        }

        // 只有在移动或攻击时才允许播放口号
        const isMovingOrAttacking = this.isMoving || this.isPlayingAttackAnimation;
        
        if (!isMovingOrAttacking) {
            // 不在移动或攻击状态，重置间隔计时器
            this.dialogIntervalTimer = 0;
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
     * 触发待机口号（在播放第三段待机动画时调用）
     */
    triggerIdleSlogan() {
        // 只有在真正待机时才允许触发待机口号
        // 避免在移动/攻击/受击/死亡等状态下误触发
        const isIdleState =
            !this.isMoving &&
            !this.isPlayingMoveAnimation &&
            !this.isPlayingAttackAnimation &&
            !this.isPlayingHitAnimation &&
            !this.isPlayingDeathAnimation &&
            this.isPlayingIdleAnimation;
        if (!isIdleState) {
            return;
        }

        // 新规则：索敌范围内一旦有敌人，就不触发待机口号
        // 避免战斗气氛下突然喊“我休息一下，指挥官”
        const detectionRange = this.getDetectionRange();
        const nearbyEnemies = this.getEnemies(true, detectionRange);
        if (nearbyEnemies.length > 0) {
            return;
        }

        // 如果对话框正在显示，不重复创建
        if (this.dialogNode && this.dialogNode.isValid) {
            return;
        }

        // 立即创建待机口号对话框
        this.createDialog(undefined, true);
        this.dialogTimer = 0; // 重置显示计时器
    }

    /**
     * 尝试在移动或攻击时触发口号
     * 如果还没有对话框且间隔计时器已经累计了一定时间，就立即创建对话框
     */
    tryTriggerSloganOnAction() {
        // 如果没有配置战斗口号，不显示对话框
        if (!this.battleSlogans || this.battleSlogans.length === 0) {
            return;
        }

        // 如果对话框正在显示，不重复创建
        if (this.dialogNode && this.dialogNode.isValid) {
            return;
        }

        // 如果间隔计时器已经累计了至少2秒，立即创建对话框
        // 这样可以更快地响应移动或攻击动作
        if (this.dialogIntervalTimer >= 2.0) {
            this.createDialog();
            this.dialogIntervalTimer = 0; // 重置间隔计时器
            this.dialogTimer = 0; // 重置显示计时器
        }
    }

    /**
     * 更新对话框（位置跟随、渐隐效果）
     */
    updateDialog(deltaTime: number) {
        if (!this.dialogNode || !this.dialogNode.isValid) {
            return;
        }

        // 更新对话框位置（跟随单位，保持在血条上方）
        // 对话框挂在 Canvas 下，因此必须用 worldPosition 每帧同步。
        const pos = this.node.worldPosition.clone();
        pos.y += 50;
        this.dialogNode.setWorldPosition(pos);

        // 每帧使用缓存值校正层级（不做 for 扫描）
        try {
            this.ensureDialogRenderOrder(false);
        } catch {}
        // 根据当前单位的朝向更新对话框scale，并在第三段待机拉宽时做反向补偿
        this.refreshOverheadNodesScale();

        // 更新显示计时器
        this.dialogTimer += deltaTime;

        // worldMaxIndex 低频重算：每2秒才进行一次 for 循环
        this.dialogWorldMaxRecalcTimer += deltaTime;
        if (this.dialogWorldMaxRecalcTimer >= this.DIALOG_WORLD_MAX_RECALC_INTERVAL) {
            this.dialogWorldMaxRecalcTimer = 0;
            try {
                this.ensureDialogRenderOrder(true);
            } catch {}
        }

        // 调试：显示期间每 0.8s 打印一次口号与石墙 index（默认关闭）
        if (this.ENABLE_DIALOG_INDEX_DEBUG && this.dialogTimer - this.lastDialogIndexLogTime >= 0.8) {
            this.lastDialogIndexLogTime = this.dialogTimer;
            this.logDialogAndStoneWallIndices('update');
        }

        // 如果显示时间超过持续时间，开始渐隐
        if (this.dialogTimer > this.DIALOG_DURATION) {
            const fadeTime = this.dialogTimer - this.DIALOG_DURATION;
            const fadeDuration = 0.5; // 渐隐持续时间0.5秒

            if (fadeTime < fadeDuration) {
                // 正在渐隐
                const alpha = 1 - (fadeTime / fadeDuration);
                const textAlpha = Math.floor(255 * alpha);

                if (this.dialogLabel) {
                    this.dialogLabel.color = new Color(0, 255, 0, textAlpha); // 绿色文字（我方单位），渐隐时保持绿色
                }
            } else {
                // 渐隐完成，销毁对话框
                if (this.dialogNode && this.dialogNode.isValid) {
                    this.dialogNode.destroy();
                }
                this.dialogNode = null;
                this.dialogLabel = null;
                this.isDialogIdleSlogan = false;
                this.dialogTimer = 0;
                this.dialogWorldMaxRecalcTimer = 0;
                this.cachedDialogWorldMaxIndex = -1;
                this.dialogIntervalTimer = 0; // 重置间隔计时器
                // 重新随机生成下次显示的间隔时间
                this.dialogInterval = this.DIALOG_MIN_INTERVAL + Math.random() * (this.DIALOG_MAX_INTERVAL - this.DIALOG_MIN_INTERVAL);
            }
        }
    }

    findGameManager() {
        // 方法1: 通过节点名称查找（尝试多个可能的路径）
        let gmNode = find('GameManager');
        if (!gmNode) {
            gmNode = find('Canvas/GameManager');
        }
        
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager);
            if (this.gameManager) {
               //console.log('[Role性能优化] 成功找到 GameManager');
                return;
            }
        }
        
        // 如果找不到，记录警告但不递归查找（只在第一次警告）
        if (!Role.cachedGameManagerWarned) {
            console.warn('[Role性能优化] 未找到 GameManager 节点，请确保 GameManager 在场景中');
            Role.cachedGameManagerWarned = true;
        }
    }

    update(deltaTime: number) {
        // 性能监控：开始计时
        // const updateStartTime = PerformanceMonitor.startTiming('Role.update');

        if (this.isDestroyed) {
            // PerformanceMonitor.endTiming('Role.update', updateStartTime, 5);
            return;
        }
        
        // 更新蓝量（每秒回复）
        this.updateMana(deltaTime);

        // 性能监控：单位数量统计和日志输出（降低频率，避免每帧都输出）
        Role.unitCountLogTimer += deltaTime;
        if (Role.unitCountLogTimer >= Role.UNIT_COUNT_LOG_INTERVAL) {
            Role.unitCountLogTimer = 0;
            
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
                
               //console.log(`[Role性能优化] 单位数量统计 - 敌人: ${enemyCount}, 我方: ${roleCount}, 使用UnitManager: 是`);
            } else {
                // 降级方案：使用缓存节点（避免 find() 调用）
                console.warn('[Role性能优化] UnitManager未初始化，使用缓存节点统计');
                const enemiesNode = Role.cachedEnemiesNode;
                if (enemiesNode) {
                    enemyCount = enemiesNode.children.filter(node => node && node.isValid && node.active).length;
                }
                
                const towersNode = Role.cachedTowersNode;
                const huntersNode = Role.cachedHuntersNode;
                const elfSwordsmansNode = Role.cachedElfSwordsmansNode;
                if (towersNode) roleCount += towersNode.children.filter(node => node && node.isValid && node.active).length;
                if (huntersNode) roleCount += huntersNode.children.filter(node => node && node.isValid && node.active).length;
                if (elfSwordsmansNode) roleCount += elfSwordsmansNode.children.filter(node => node && node.isValid && node.active).length;
                
               //console.log(`[Role性能优化] 单位数量统计 - 敌人: ${enemyCount}, 我方: ${roleCount}, 使用缓存节点: 是`);
            }
            
            // 输出递归查找警告计数
            if (Role.recursiveFindWarningCount > 0) {
                console.error(`[Role性能优化] ⚠️ 检测到 ${Role.recursiveFindWarningCount} 次递归查找警告！`);
            }
        }

        // 更新对话框系统（在游戏状态检查之前，确保对话框能正常显示）
        this.updateDialogSystem(deltaTime);

        // 检查游戏状态 - 如果GameManager不存在，尝试重新查找
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        // 检查游戏状态，只在Playing状态下运行
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                // 游戏已结束或暂停，停止攻击和移动
                this.currentTarget = null!;
                // PerformanceMonitor.endTiming('Role.update', updateStartTime, 5);
                return;
            }
        }

        this.attackTimer += deltaTime;
        this.targetFindTimer += deltaTime;

        // 确保UnitManager已获取（可能在start时还没初始化）
        if (!this.unitManager) {
            this.unitManager = UnitManager.getInstance();
        }

        // 防御状态下，不进行移动，但仍可攻击
        if (this.isDefending) {
            // 防御状态下，仍然需要查找目标并攻击
            // 如果当前目标已失效，立即重新查找（不等待间隔）
            const needFindTarget = !this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active;
            // 首次查找或按间隔查找
            const shouldFindByInterval = !this.hasFoundFirstTarget || this.targetFindTimer >= this.TARGET_FIND_INTERVAL;
            
            if (needFindTarget || shouldFindByInterval) {
                this.targetFindTimer = 0; // 重置计时器
                // const findTargetStartTime = PerformanceMonitor.startTiming('Role.findTarget');
                this.findTarget();
                // PerformanceMonitor.endTiming('Role.findTarget', findTargetStartTime, 3);
                // 如果找到了目标，标记为已找到第一个目标
                if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
                    this.hasFoundFirstTarget = true;
                }
            }
            
            // 防御状态下，只攻击范围内的敌人，不移动
            if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
                // 性能优化：使用平方距离比较
                const myPos = this.node.worldPosition;
                const targetPos = this.currentTarget.worldPosition;
                const dx = targetPos.x - myPos.x;
                const dy = targetPos.y - myPos.y;
                const distanceSq = dx * dx + dy * dy;
                const attackRangeSq = this.attackRange * this.attackRange;
                
                if (distanceSq <= attackRangeSq) {
                    // 在攻击范围内，攻击敌人
                    this.stopMoving();
                    if (this.attackTimer >= this.attackInterval) {
                        // 再次检查游戏状态，确保游戏仍在进行
                        if (this.gameManager && this.gameManager.getGameState() === GameState.Playing) {
                            // const attackStartTime = PerformanceMonitor.startTiming('Role.attack');
                            this.attack();
                            // PerformanceMonitor.endTiming('Role.attack', attackStartTime, 2);
                            this.attackTimer = 0;
                        }
                    }
                } else {
                    // 不在攻击范围内，停止移动（防御状态下不移动）
                    this.stopMoving();
                }
            } else {
                // 没有目标，停止移动
                this.stopMoving();
            }
            return; // 防御状态下，不执行后续的移动逻辑
        }

        // 优先处理手动移动目标
        if (this.manualMoveTarget) {
            // 性能优化：使用平方距离比较
            const myPos = this.node.worldPosition;
            const dx = this.manualMoveTarget.x - myPos.x;
            const dy = this.manualMoveTarget.y - myPos.y;
            const distanceSq = dx * dx + dy * dy;
            const arrivalThreshold = 10; // 到达阈值（像素）
            const arrivalThresholdSq = arrivalThreshold * arrivalThreshold;
            
            if (distanceSq <= arrivalThresholdSq) {
                // 到达手动移动目标，清除手动目标
                this.manualMoveTarget = null!;
                this.isManuallyControlled = false;
                this.stopMoving();
            } else {
                // 移动到手动目标位置
                this.moveToPosition(this.manualMoveTarget, deltaTime);
                return; // 手动移动时，不执行自动寻敌
            }
        }

        // 查找目标逻辑
        if (!this.manualMoveTarget) {
            // 如果当前目标已失效，立即重新查找（不等待间隔）
            const needFindTarget = !this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active;
            // 首次查找或按间隔查找
            const shouldFindByInterval = !this.hasFoundFirstTarget || this.targetFindTimer >= this.TARGET_FIND_INTERVAL;
            
            if (needFindTarget || shouldFindByInterval) {
                this.targetFindTimer = 0; // 重置计时器
                // const findTargetStartTime2 = PerformanceMonitor.startTiming('Role.findTarget');
                this.findTarget();
                // PerformanceMonitor.endTiming('Role.findTarget', findTargetStartTime2, 3);
                // 如果找到了目标，标记为已找到第一个目标
                if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
                    this.hasFoundFirstTarget = true;
                }
            }
        }

        // 无论是否移动，都要检查碰撞（防止重叠）
        const currentPos = this.node.worldPosition.clone();
        const hasCollisionNow = this.checkCollisionAtPosition(currentPos);
        if (hasCollisionNow) {
            // 即使不移动，如果有碰撞也要推开
            const pushDirection = this.calculatePushAwayDirection(currentPos);
            if (pushDirection.length() > 0.1) {
                const pushDistance = this.moveSpeed * deltaTime * 1.5;
                const pushPos = new Vec3();
                Vec3.scaleAndAdd(pushPos, currentPos, pushDirection, pushDistance);
                const finalPushPos = this.checkCollisionAndAdjust(currentPos, pushPos);
                this.node.setWorldPosition(finalPushPos);
            }
        }

        // 更新“禁止待机动画”的计时器（攻击/受击后短暂停播待机动画）
        if (this.idleBlockTimer > 0) {
            this.idleBlockTimer -= deltaTime;
            if (this.idleBlockTimer < 0) {
                this.idleBlockTimer = 0;
            }
        }

        // 处理自动移动和攻击逻辑
        if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
            // 性能优化：使用平方距离比较，缓存worldPosition
            const myPos = this.node.worldPosition;
            const targetPos = this.currentTarget.worldPosition;
            const dx = targetPos.x - myPos.x;
            const dy = targetPos.y - myPos.y;
            const distanceSq = dx * dx + dy * dy;
            const attackRangeSq = this.attackRange * this.attackRange;
            
            if (distanceSq <= attackRangeSq) {
                // 在攻击范围内，停止移动并攻击
                this.stopMoving();
                if (this.attackTimer >= this.attackInterval) {
                    // 再次检查游戏状态，确保游戏仍在进行
                    if (this.gameManager && this.gameManager.getGameState() === GameState.Playing) {
                        // const attackStartTime2 = PerformanceMonitor.startTiming('Role.attack');
                        this.attack();
                        // PerformanceMonitor.endTiming('Role.attack', attackStartTime2, 2);
                        this.attackTimer = 0;
                    }
                }
            } else {
                const movementRange = this.getMovementRange();
                const movementRangeSq = movementRange * movementRange;
                if (distanceSq <= movementRangeSq) {
                    // 在移动范围内，尝试朝敌人移动
                    const beforePos = this.node.worldPosition.clone();
                    // const moveStartTime = PerformanceMonitor.startTiming('Role.moveTowardsTarget');
                    this.moveTowardsTarget(deltaTime);
                    // PerformanceMonitor.endTiming('Role.moveTowardsTarget', moveStartTime, 3);

                    const afterPos = this.node.worldPosition.clone();
                    const dx2 = afterPos.x - beforePos.x;
                    const dy2 = afterPos.y - beforePos.y;
                    const movedDistanceSq = dx2 * dx2 + dy2 * dy2;

                    // 自动移动时，如果因为障碍物导致本帧几乎没有移动，则视为被阻挡
                    if (movedDistanceSq < 0.01) {
                        // 尝试在当前攻击范围内重新索敌
                        this.findTarget();
                        if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
                            const newTargetPos = this.currentTarget.worldPosition;
                            const newMyPos = this.node.worldPosition;
                            const newDx = newTargetPos.x - newMyPos.x;
                            const newDy = newTargetPos.y - newMyPos.y;
                            const newDistanceSq = newDx * newDx + newDy * newDy;
                            if (newDistanceSq <= attackRangeSq) {
                                // 障碍前方有敌人：停止移动，开始攻击
                                this.stopMoving();
                                if (this.attackTimer >= this.attackInterval) {
                                    if (this.gameManager && this.gameManager.getGameState() === GameState.Playing) {
                                        this.attack();
                                        this.attackTimer = 0;
                                    }
                                }
                                return;
                            }
                        }

                        // 范围内没有可以攻击的敌人：停止自动移动
                        this.stopMoving();
                        return;
                    }
                } else {
                    // 超出移动范围，停止移动
                    this.stopMoving();
                }
            }
        } else {
            // 没有目标，停止移动
            this.stopMoving();
        }

        // 检查是否需要播放待机动画（在非移动、非攻击状态时）
        if (!this.isMoving && !this.isPlayingAttackAnimation && !this.isPlayingHitAnimation && !this.isPlayingDeathAnimation && !this.isPlayingIdleAnimation) {
            this.checkAndPlayIdleAnimation();
        }
        
        // 性能监控：结束 update 方法计时
        // PerformanceMonitor.endTiming('Role.update', updateStartTime, 5);
    }

    /**
     * 移动到指定位置（用于手动控制）
     * @param targetPos 目标位置
     * @param deltaTime 时间增量
     * 性能优化：使用平方距离比较，复用临时Vec3对象
     */
    moveToPosition(targetPos: Vec3, deltaTime: number) {
        if (this.isDestroyed) {
            return;
        }

        const towerPos = this.node.worldPosition.clone();
        // 性能优化：使用平方距离比较
        const dx = targetPos.x - towerPos.x;
        const dy = targetPos.y - towerPos.y;
        const distanceSq = dx * dx + dy * dy;

        // 如果已经到达目标位置，停止移动
        if (distanceSq <= 100) { // 10*10 = 100
            this.stopMoving();
            return;
        }

        // 手动移动：如果当前位置或目标方向上有障碍，只尝试有限次数避让，避让不开就直接停止移动
        const hasCollision = this.checkCollisionAtPosition(towerPos);
        if (hasCollision) {
            // 不再无限尝试挤出，直接结束手动移动
            this.manualMoveTarget = null;
            this.isManuallyControlled = false;
            this.stopMoving();
            return;
        }

        // 计算移动方向
        Vec3.subtract(this.tempVec3_1, targetPos, towerPos);
        this.tempVec3_1.normalize();

        // 计算移动方向
        const moveDistance = this.moveSpeed * deltaTime;
        Vec3.scaleAndAdd(this.tempVec3_2, towerPos, this.tempVec3_1, moveDistance);

        // 检查新位置是否有碰撞，并用三次避让逻辑调整
        const adjustedPos = this.checkCollisionAndAdjust(towerPos, this.tempVec3_2);

        // 如果避让后仍然停在原地，说明三次避让全部失败，直接停止手动移动
        const adjDx = adjustedPos.x - towerPos.x;
        const adjDy = adjustedPos.y - towerPos.y;
        const adjDistanceSq = adjDx * adjDx + adjDy * adjDy;
        if (adjDistanceSq < 0.01) {
            this.manualMoveTarget = null;
            this.isManuallyControlled = false;
            this.stopMoving();
            return;
        }

        // 更新位置
        this.node.setWorldPosition(adjustedPos);

        // 根据移动方向翻转弓箭手
        if (this.tempVec3_1.x < 0) {
            // 向左移动，翻转
            this.node.setScale(-Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
            // 血条/对话框保持正常朝向（并在第三段待机拉宽时做反向补偿）
            this.refreshOverheadNodesScale();
        } else {
            // 向右移动，正常朝向
            this.node.setScale(Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
            // 血条/对话框保持正常朝向（并在第三段待机拉宽时做反向补偿）
            this.refreshOverheadNodesScale();
        }

        // 播放移动动画
        if (!this.isMoving) {
            this.isMoving = true;
            this.playMoveAnimation();
            // 开始移动时，如果满足条件，立即触发一次口号
            this.tryTriggerSloganOnAction();
        }
    }

    /**
     * 检查单个节点是否是存活的敌人
     * @param node 要检查的节点
     * @returns 是否是存活的敌人
     */
    isAliveEnemy(node: Node): boolean {
        if (!node || !node.isValid || !node.active) {
            return false;
        }

        const enemyScript = this.getEnemyScript(node);
        if (!enemyScript) {
            return false;
        }

        // 检查传送门是否处于休眠状态（五波次结束后的透明状态）
        // 休眠状态的传送门不应作为攻击目标
        if (enemyScript.isDormantNow && typeof enemyScript.isDormantNow === 'function') {
            if (enemyScript.isDormantNow()) {
                return false;
            }
        }

        // 检查敌人是否存活，支持多种存活检查方式
        if (enemyScript.isAlive && typeof enemyScript.isAlive === 'function') {
            return enemyScript.isAlive();
        } else if (enemyScript.health !== undefined) {
            return enemyScript.health > 0;
        } else if (enemyScript.currentHealth !== undefined) {
            return enemyScript.currentHealth > 0;
        }

        return true;
    }
    
    /**
     * 获取节点的敌人脚本（如果是敌人的话）
     * @param node 要获取脚本的节点
     * @returns 敌人脚本，如果不是敌人则返回null
     */
    getEnemyScript(node: Node): any {
        if (!node || !node.isValid || !node.active) {
            return null;
        }
        
        // 尝试获取所有可能的敌人组件类型（包括 Portal）
        const possibleComponentNames = ['TrollSpearman', 'OrcWarrior', 'OrcWarlord', 'MinotaurWarrior', 'Boss', 'Enemy', 'Portal'];
        for (const compName of possibleComponentNames) {
            const comp = node.getComponent(compName) as any;
            if (comp && comp.unitType === UnitType.ENEMY) {
                return comp;
            }
        }
        
        // 遍历所有组件，查找具有unitType属性的组件
        const allComponents = node.components;
        for (const comp of allComponents) {
            const typedComp = comp as any;
            if (typedComp && typedComp.unitType === UnitType.ENEMY) {
                return typedComp;
            }
        }
        
        return null;
    }
    
    /**
     * 获取所有符合条件的敌人节点（优化版本，使用UnitManager）
     * @param includeOnlyAlive 是否只包含存活的敌人
     * @param maxDistance 最大距离，超过此距离的敌人将被过滤
     * @returns 符合条件的敌人节点数组
     */
    getEnemies(includeOnlyAlive: boolean = true, maxDistance: number = Infinity): Node[] {
        // 优先使用UnitManager（性能优化）
        // 如果unitManager为null，尝试重新获取（可能UnitManager还没初始化）
        if (!this.unitManager) {
            this.unitManager = UnitManager.getInstance();
        }
        
        let enemies: Node[] = [];
        
        if (this.unitManager) {
            enemies = this.unitManager.getEnemiesInRange(
                this.node.worldPosition,
                maxDistance,
                includeOnlyAlive
            );
        } else {
            // 降级方案：使用缓存的节点（避免 find() 调用）
            console.warn('[Role性能优化] UnitManager未初始化，使用缓存节点降级方案');
            // 合并 Canvas/Enemies 和 Canvas/MinotaurWarriors 的子节点
            const allEnemies: Node[] = [];
            if (Role.cachedEnemiesNode && Role.cachedEnemiesNode.isValid) {
                const enemiesChildren = Role.cachedEnemiesNode.children || [];
                allEnemies.push(...enemiesChildren);
            }
            if (Role.cachedMinotaurWarriorsNode && Role.cachedMinotaurWarriorsNode.isValid) {
                const minotaurChildren = Role.cachedMinotaurWarriorsNode.children || [];
                allEnemies.push(...minotaurChildren);
            }
            if (allEnemies.length === 0) {
                console.error('[Role 性能优化] 缓存的敌人节点不存在！');
                return [];
            }
            const maxDistanceSq = maxDistance * maxDistance; // 使用平方距离，避免开方
            
            for (const enemy of allEnemies) {
                if (enemy && enemy.active && enemy.isValid) {
                    // 检查是否是敌人
                    const enemyScript = this.getEnemyScript(enemy);
                    if (!enemyScript) {
                        continue;
                    }
                    
                    // 粗略距离检查（使用平方距离，避免开方）
                    const dx = enemy.worldPosition.x - this.node.worldPosition.x;
                    const dy = enemy.worldPosition.y - this.node.worldPosition.y;
                    const distanceSq = dx * dx + dy * dy;
                    if (distanceSq > maxDistanceSq) {
                        continue;
                    }
                    
                    // 检查是否需要包含存活检查
                    if (includeOnlyAlive && !this.isAliveEnemy(enemy)) {
                        continue;
                    }
                    
                    enemies.push(enemy);
                }
            }
        }
        
        return enemies;
    }
    
    /**
     * 获取移动范围（可被子类重写）
     * @returns 移动范围，默认是攻击范围的2倍
     */
    protected getMovementRange(): number {
        return this.attackRange * 2;
    }

    /**
     * 获取索敌范围（可被子类重写）
     * @returns 索敌范围，默认是攻击范围的2倍
     */
    protected getDetectionRange(): number {
        return this.attackRange * 2;
    }
    
    findTarget() {
        let nearestEnemy: Node = null!;
        let minDistanceSq = Infinity; // 使用平方距离，避免开方运算
        const detectionRange = this.getDetectionRange(); // 使用可重写的方法获取索敌范围
        
        
        // 使用公共函数获取敌人（已优化，使用UnitManager）
        const enemies = this.getEnemies(true, detectionRange);
        
        
        // 如果没有找到敌人，可能是UnitManager还没初始化或敌人列表为空，尝试使用降级方案
        if (enemies.length === 0 && this.unitManager) {
            // 强制更新一次敌人列表
            this.unitManager.refreshUnitLists();
            // 再次尝试获取
            const enemiesRetry = this.getEnemies(true, detectionRange);
            if (enemiesRetry.length > 0) {
                // 使用重新获取的敌人列表
                const myPos = this.node.worldPosition;
                for (const enemy of enemiesRetry) {
                    if (!enemy || !enemy.isValid || !enemy.active) continue;
                    
                    // 使用平方距离比较，避免开方运算
                    const dx = enemy.worldPosition.x - myPos.x;
                    const dy = enemy.worldPosition.y - myPos.y;
                    const distanceSq = dx * dx + dy * dy;
                    
                    // 选择最近的敌人
                    if (distanceSq < minDistanceSq) {
                        minDistanceSq = distanceSq;
                        nearestEnemy = enemy;
                    }
                }
                this.currentTarget = nearestEnemy;
                return;
            }
        }
        
        const myPos = this.node.worldPosition;
        for (const enemy of enemies) {
            if (!enemy || !enemy.isValid || !enemy.active) {
                continue;
            }
            
            // 使用平方距离比较，避免开方运算
            const dx = enemy.worldPosition.x - myPos.x;
            const dy = enemy.worldPosition.y - myPos.y;
            const distanceSq = dx * dx + dy * dy;
            
            // 选择最近的敌人
            if (distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                nearestEnemy = enemy;
            }
        }

        this.currentTarget = nearestEnemy;
    }

    moveTowardsTarget(deltaTime: number) {
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active || this.isDestroyed) {
            this.stopMoving();
            return;
        }

        // 检查目标是否仍然存活，支持所有敌人类型
        if (!this.isAliveEnemy(this.currentTarget)) {
            this.stopMoving();
            return;
        }

        // 性能优化：缓存 worldPosition，避免重复访问
        const towerPos = this.node.worldPosition.clone(); // 使用clone确保获取最新位置
        const targetPos = this.currentTarget.worldPosition;
        
        // 使用平方距离比较，避免开方运算
        const dx = targetPos.x - towerPos.x;
        const dy = targetPos.y - towerPos.y;
        const distanceSq = dx * dx + dy * dy;
        const attackRangeSq = this.attackRange * this.attackRange;
        
        // 如果已经在攻击范围内，停止移动
        if (distanceSq <= attackRangeSq) {
            this.stopMoving();
            this.isStuck = false;
            this.stuckTimer = 0;
            this.waitTimer = 0;
            return;
        }

        // 智能避让：检测是否卡住
        const positionDx = towerPos.x - this.lastPosition.x;
        const positionDy = towerPos.y - this.lastPosition.y;
        const movedDistanceSq = positionDx * positionDx + positionDy * positionDy;
        
        if (movedDistanceSq < 0.01) { // 几乎没有移动
            this.stuckTimer += deltaTime;
            if (this.stuckTimer >= this.STUCK_THRESHOLD) {
                this.isStuck = true;
            }
        } else {
            this.stuckTimer = 0;
            this.isStuck = false;
        }
        
        // 保存当前位置供下一帧比较
        this.lastPosition.set(towerPos);

        // 如果卡住了，等待一段时间让其他单位先走
        if (this.isStuck) {
            this.waitTimer += deltaTime;
            if (this.waitTimer < this.WAIT_DURATION) {
                // 等待期间不移动
                return;
            } else {
                // 等待结束，重置状态并尝试新的避让方向
                this.isStuck = false;
                this.stuckTimer = 0;
                this.waitTimer = 0;
                this.avoidDirectionTimer = 0; // 强制重新计算避让方向
            }
        }

        // 性能优化：降低碰撞检测频率
        this.collisionCheckTimer += deltaTime;
        let hasCollision = this.lastCollisionResult;
        
        if (this.collisionCheckTimer >= this.COLLISION_CHECK_INTERVAL) {
            // 首先检查当前位置是否有碰撞，如果有，先推开
            hasCollision = this.checkCollisionAtPosition(towerPos);
            this.lastCollisionResult = hasCollision;
            this.collisionCheckTimer = 0;
        }
        
        if (hasCollision) {
            // 当前位置有碰撞，先推开
            const pushDirection = this.calculatePushAwayDirection(towerPos);
            if (pushDirection.length() > 0.1) {
                const pushDistance = this.moveSpeed * deltaTime * 1.5; // 推开速度更快
                Vec3.scaleAndAdd(this.tempVec3_1, towerPos, pushDirection, pushDistance);
                
                // 确保推开后的位置没有碰撞
                const finalPushPos = this.checkCollisionAndAdjust(towerPos, this.tempVec3_1);
                this.node.setWorldPosition(finalPushPos);
                
                return; // 先推开，下一帧再移动
            }
        }

        // 计算移动方向
        Vec3.subtract(this.tempVec3_1, targetPos, towerPos);
        this.tempVec3_1.normalize();

        // 智能避让：使用缓存的避让方向，减少频繁改变方向
        this.avoidDirectionTimer += deltaTime;
        let finalDirection: Vec3;
        
        if (this.avoidDirectionTimer >= this.AVOID_DIRECTION_DURATION || this.cachedAvoidDirection.length() < 0.1) {
            // 重新计算避让方向
            finalDirection = this.calculateAvoidanceDirection(towerPos, this.tempVec3_1, deltaTime);
            this.cachedAvoidDirection.set(finalDirection);
            this.avoidDirectionTimer = 0;
        } else {
            // 使用缓存的避让方向，保持移动的连贯性
            finalDirection = this.cachedAvoidDirection;
        }

        // 计算移动距离
        const moveDistance = this.moveSpeed * deltaTime;
        Vec3.scaleAndAdd(this.tempVec3_2, towerPos, finalDirection, moveDistance);

        // 检查新位置是否有碰撞，并调整
        const adjustedPos = this.checkCollisionAndAdjust(towerPos, this.tempVec3_2);

        // 更新位置
        this.node.setWorldPosition(adjustedPos);

        // 更新血条位置（血条是子节点，会自动跟随，但需要确保位置正确）
        if (this.healthBarNode && this.healthBarNode.isValid) {
            // 血条位置已经在createHealthBar中设置为相对位置，会自动跟随
        }

        // 根据移动方向翻转弓箭手（使用缓存的方向向量）
        if (finalDirection.x < 0) {
            // 向左移动，翻转
            this.node.setScale(-Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
            // 血条 / 蓝量条 / 对话框保持正常朝向（并在第三段待机拉宽时做反向补偿）
            this.refreshOverheadNodesScale();
        } else {
            // 向右移动，正常朝向
            this.node.setScale(Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
            // 血条 / 蓝量条 / 对话框保持正常朝向（并在第三段待机拉宽时做反向补偿）
            this.refreshOverheadNodesScale();
        }

        // 播放移动动画
        if (!this.isMoving) {
            this.isMoving = true;
            this.playMoveAnimation();
            // 开始移动时，如果满足条件，立即触发一次口号
            this.tryTriggerSloganOnAction();
        }
    }

    stopMoving() {
        if (this.isMoving) {
            this.isMoving = false;
            this.stopMoveAnimation();
        }
    }

    playMoveAnimation() {
        // 如果正在播放移动动画，不重复播放
        if (this.isPlayingMoveAnimation) {
            return;
        }

        // 进入移动状态时，不允许显示待机口令
        this.clearIdleSloganDialogIfAny();

        // 停止待机动画并恢复设置
        if (this.isPlayingIdleAnimation) {
            this.isPlayingIdleAnimation = false;
            this.restoreIdleAnimationSettings();
        }

        // 如果没有移动动画帧，使用默认SpriteFrame
        if (!this.moveAnimationFrames || this.moveAnimationFrames.length === 0) {
            return;
        }

        if (!this.sprite) {
            return;
        }

        // 检查帧是否有效
        const validFrames = this.moveAnimationFrames.filter(frame => frame != null);
        if (validFrames.length === 0) {
            return;
        }

        this.isPlayingMoveAnimation = true;

        const frames = validFrames;
        const frameCount = frames.length;
        const frameDuration = this.moveAnimationDuration / frameCount;
        let animationTimer = 0;
        let lastFrameIndex = -1;

        // 立即播放第一帧
        if (frames[0]) {
            this.sprite.spriteFrame = frames[0];
            lastFrameIndex = 0;
            
            // 记录移动动画时的实际显示大小，用于待机动画时保持一致
            const uiTransform = this.node.getComponent(UITransform);
            const firstFrame = frames[0];
            if (firstFrame && uiTransform) {
                const originalSize = firstFrame.originalSize || { width: 0, height: 0 };
                const rect = firstFrame.rect || { width: 0, height: 0, x: 0, y: 0 };
                const actualDisplayWidth = rect.width * Math.abs(this.node.scale.x);
                const actualDisplayHeight = rect.height * Math.abs(this.node.scale.y);
                
                // 记录移动时的实际显示大小
                this.moveAnimationDisplaySize = {
                    width: actualDisplayWidth,
                    height: actualDisplayHeight
                };
                
                // console.log(`[Role] 移动动画 - UITransform: (${uiTransform.width}, ${uiTransform.height}), 节点缩放: (${this.node.scale.x.toFixed(2)}, ${this.node.scale.y.toFixed(2)}), SpriteFrame rect: (${rect.width}, ${rect.height}), 实际显示大小: (${actualDisplayWidth.toFixed(2)}, ${actualDisplayHeight.toFixed(2)}), 单位名称=${this.unitName || '未知'}`);
            }
        }

        // 使用update方法逐帧播放
        const animationUpdate = (deltaTime: number) => {
            if (!this.isMoving || !this.sprite || !this.sprite.isValid || this.isDestroyed) {
                this.isPlayingMoveAnimation = false;
                this.unschedule(animationUpdate);
                // 恢复默认SpriteFrame
                if (this.sprite && this.sprite.isValid && this.defaultSpriteFrame) {
                    this.sprite.spriteFrame = this.defaultSpriteFrame;
                }
                return;
            }

            animationTimer += deltaTime;

            // 循环播放动画
            const targetFrameIndex = Math.floor(animationTimer / frameDuration) % frameCount;

            if (targetFrameIndex !== lastFrameIndex && frames[targetFrameIndex]) {
                this.sprite.spriteFrame = frames[targetFrameIndex];
                lastFrameIndex = targetFrameIndex;
            }
        };

        // 先取消之前的调度，避免重复调度
        this.unschedule(animationUpdate);
        // 开始动画更新
        this.schedule(animationUpdate, 0);
    }

    stopMoveAnimation() {
        this.isPlayingMoveAnimation = false;
        // 恢复默认SpriteFrame
        if (this.sprite && this.sprite.isValid && this.defaultSpriteFrame) {
            this.sprite.spriteFrame = this.defaultSpriteFrame;
        }
        // 如果不在攻击状态，尝试播放待机动画
        if (!this.isPlayingAttackAnimation && !this.isMoving) {
            this.checkAndPlayIdleAnimation();
        }
    }

    /**
     * 检查位置是否有碰撞
     * @param position 要检查的位置
     * @returns 如果有碰撞返回true
     * 性能优化：使用缓存节点和 UnitManager，避免 find() 和递归查找
     * 性能优化：使用平方距离比较，避免开方运算
     */
    checkCollisionAtPosition(position: Vec3): boolean {
        // 检查与水晶的碰撞 - 使用缓存节点和平方距离
        const crystal = Role.cachedCrystalNode;
        if (crystal && crystal.isValid && crystal.active) {
            const crystalPos = crystal.worldPosition;
            const dx = position.x - crystalPos.x;
            const dy = position.y - crystalPos.y;
            const distanceSq = dx * dx + dy * dy;
            const crystalRadius = 50;
            const minDistance = this.collisionRadius + crystalRadius;
            const minDistanceSq = minDistance * minDistance;
            if (distanceSq < minDistanceSq) {
                return true;
            }
        }

        // 检查与其他弓箭手的碰撞 - 优先使用 UnitManager，使用平方距离
        if (this.unitManager) {
            const towers = this.unitManager.getTowers();
            for (const tower of towers) {
                if (tower && tower.isValid && tower.active && tower !== this.node) {
                    const towerPos = tower.worldPosition;
                    const dx = position.x - towerPos.x;
                    const dy = position.y - towerPos.y;
                    const distanceSq = dx * dx + dy * dy;
                    const otherTowerScript = tower.getComponent('Role') as any;
                    if (!otherTowerScript) {
                        const arrowerScript = tower.getComponent('Arrower') as any;
                        if (arrowerScript) {
                            const otherRadius = arrowerScript.collisionRadius ? arrowerScript.collisionRadius : this.collisionRadius;
                            const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                            const minDistanceSq = minDistance * minDistance;
                            if (distanceSq < minDistanceSq) {
                                return true;
                            }
                        }
                        continue;
                    }
                    const otherRadius = otherTowerScript.collisionRadius ? otherTowerScript.collisionRadius : this.collisionRadius;
                    const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                    const minDistanceSq = minDistance * minDistance;
                    
                    if (distanceSq < minDistanceSq) {
                        return true;
                    }
                }
            }
        } else {
            // 降级方案：使用缓存节点
            console.warn('[Role性能优化] checkCollisionAtPosition: UnitManager未初始化，使用缓存节点');
            const towersNode = Role.cachedTowersNode;
        
            if (towersNode) {
                const towers = towersNode.children || [];
                for (const tower of towers) {
                    if (tower && tower.isValid && tower.active && tower !== this.node) {
                        const towerPos = tower.worldPosition;
                        const dx = position.x - towerPos.x;
                        const dy = position.y - towerPos.y;
                        const distanceSq = dx * dx + dy * dy;
                        const otherTowerScript = tower.getComponent('Role') as any;
                        if (!otherTowerScript) {
                            const arrowerScript = tower.getComponent('Arrower') as any;
                            if (arrowerScript) {
                                const otherRadius = arrowerScript.collisionRadius ? arrowerScript.collisionRadius : this.collisionRadius;
                                const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                                const minDistanceSq = minDistance * minDistance;
                                if (distanceSq < minDistanceSq) {
                                    return true;
                                }
                            }
                            continue;
                        }
                        const otherRadius = otherTowerScript.collisionRadius ? otherTowerScript.collisionRadius : this.collisionRadius;
                        const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                        const minDistanceSq = minDistance * minDistance;
                        
                        if (distanceSq < minDistanceSq) {
                            return true;
                        }
                    }
                }
            }
        }

        // 检查与精灵剑士的碰撞 - 优先使用 UnitManager，使用平方距离
        if (this.unitManager) {
            const swordsmen = this.unitManager.getElfSwordsmans();
            for (const swordsman of swordsmen) {
                if (swordsman && swordsman.isValid && swordsman.active && swordsman !== this.node) {
                    const swordsmanPos = swordsman.worldPosition;
                    const dx = position.x - swordsmanPos.x;
                    const dy = position.y - swordsmanPos.y;
                    const distanceSq = dx * dx + dy * dy;
                    const otherSwordsmanScript = swordsman.getComponent('Role') as any;
                    if (!otherSwordsmanScript) {
                        continue;
                    }
                    const otherRadius = otherSwordsmanScript.collisionRadius ? otherSwordsmanScript.collisionRadius : this.collisionRadius;
                    const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                    const minDistanceSq = minDistance * minDistance;
                    
                    if (distanceSq < minDistanceSq) {
                        return true;
                    }
                }
            }
        } else {
            // 降级方案：使用缓存节点（避免递归查找）
            const swordsmenNode = Role.cachedElfSwordsmansNode;
            
            if (swordsmenNode) {
                const swordsmen = swordsmenNode.children || [];
                for (const swordsman of swordsmen) {
                    if (swordsman && swordsman.isValid && swordsman.active && swordsman !== this.node) {
                        const swordsmanPos = swordsman.worldPosition;
                        const dx = position.x - swordsmanPos.x;
                        const dy = position.y - swordsmanPos.y;
                        const distanceSq = dx * dx + dy * dy;
                        const otherSwordsmanScript = swordsman.getComponent('Role') as any;
                        if (!otherSwordsmanScript) {
                            continue;
                        }
                        const otherRadius = otherSwordsmanScript.collisionRadius ? otherSwordsmanScript.collisionRadius : this.collisionRadius;
                        const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                        const minDistanceSq = minDistance * minDistance;
                        
                        if (distanceSq < minDistanceSq) {
                            return true;
                        }
                    }
                }
            }
        }

        // 检查与女猎手的碰撞 - 优先使用 UnitManager，使用平方距离
        if (this.unitManager) {
            const hunters = this.unitManager.getHunters();
            for (const hunter of hunters) {
                if (hunter && hunter.isValid && hunter.active && hunter !== this.node) {
                    const hunterPos = hunter.worldPosition;
                    const dx = position.x - hunterPos.x;
                    const dy = position.y - hunterPos.y;
                    const distanceSq = dx * dx + dy * dy;
                    const otherHunterScript = hunter.getComponent('Role') as any;
                    if (!otherHunterScript) {
                        continue;
                    }
                    const otherRadius = otherHunterScript.collisionRadius ? otherHunterScript.collisionRadius : this.collisionRadius;
                    const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                    const minDistanceSq = minDistance * minDistance;
                    
                    if (distanceSq < minDistanceSq) {
                        return true;
                    }
                }
            }
        } else {
            // 降级方案：使用缓存节点（避免递归查找）
            const huntersNode = Role.cachedHuntersNode;
            
            if (huntersNode) {
                const hunters = huntersNode.children || [];
                for (const hunter of hunters) {
                    if (hunter && hunter.isValid && hunter.active && hunter !== this.node) {
                        const hunterPos = hunter.worldPosition;
                        const dx = position.x - hunterPos.x;
                        const dy = position.y - hunterPos.y;
                        const distanceSq = dx * dx + dy * dy;
                        const otherHunterScript = hunter.getComponent('Role') as any;
                        if (!otherHunterScript) {
                            continue;
                        }
                        const otherRadius = otherHunterScript.collisionRadius ? otherHunterScript.collisionRadius : this.collisionRadius;
                        const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                        const minDistanceSq = minDistance * minDistance;
                        
                        if (distanceSq < minDistanceSq) {
                            return true;
                        }
                    }
                }
            }
        }

        // 检查与法师的碰撞 - 优先使用 UnitManager，使用平方距离
        if (this.unitManager) {
            const mages = this.unitManager.getMages();
            for (const mage of mages) {
                if (mage && mage.isValid && mage.active && mage !== this.node) {
                    const magePos = mage.worldPosition;
                    const dx = position.x - magePos.x;
                    const dy = position.y - magePos.y;
                    const distanceSq = dx * dx + dy * dy;
                    const otherMageScript = mage.getComponent('Role') as any;
                    if (!otherMageScript) {
                        continue;
                    }
                    const otherRadius = otherMageScript.collisionRadius ? otherMageScript.collisionRadius : this.collisionRadius;
                    const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                    const minDistanceSq = minDistance * minDistance;
                    if (distanceSq < minDistanceSq) {
                        return true;
                    }
                }
            }
        } else {
            const magesNode = Role.cachedMagesNode;
            if (magesNode) {
                const mages = magesNode.children || [];
                for (const mage of mages) {
                    if (mage && mage.isValid && mage.active && mage !== this.node) {
                        const magePos = mage.worldPosition;
                        const dx = position.x - magePos.x;
                        const dy = position.y - magePos.y;
                        const distanceSq = dx * dx + dy * dy;
                        const otherMageScript = mage.getComponent('Role') as any;
                        if (!otherMageScript) {
                            continue;
                        }
                        const otherRadius = otherMageScript.collisionRadius ? otherMageScript.collisionRadius : this.collisionRadius;
                        const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                        const minDistanceSq = minDistance * minDistance;
                        if (distanceSq < minDistanceSq) {
                            return true;
                        }
                    }
                }
            }
        }

        // 检查与敌人的碰撞 - 使用公共敌人获取函数（已优化，使用 UnitManager），使用平方距离
        const enemies = this.getEnemies(true);
        for (const enemy of enemies) {
            if (enemy && enemy.isValid && enemy.active) {
                const enemyPos = enemy.worldPosition;
                const dx = position.x - enemyPos.x;
                const dy = position.y - enemyPos.y;
                const distanceSq = dx * dx + dy * dy;
                const enemyRadius = 30;
                const minDistance = this.collisionRadius + enemyRadius;
                const minDistanceSq = minDistance * minDistance;
                if (distanceSq < minDistanceSq) {
                    return true;
                }
            }
        }

        // 检查与石墙的碰撞 - 使用 UnitManager（避免递归查找），使用平方距离
        if (this.unitManager) {
            const walls = this.unitManager.getStoneWalls();
            for (const wall of walls) {
                if (!wall || !wall.active || !wall.isValid) continue;
                const wallScript = wall.getComponent('StoneWall') as any;
                if (!wallScript || !wallScript.isAlive || !wallScript.isAlive()) continue;
                
                const wallPos = wall.worldPosition;
                const dx = position.x - wallPos.x;
                const dy = position.y - wallPos.y;
                const distanceSq = dx * dx + dy * dy;
                const wallRadius = wallScript.collisionRadius ?? 25;
                const minDistance = this.collisionRadius + wallRadius;
                const minDistanceSq = minDistance * minDistance;
                
                if (distanceSq < minDistanceSq) {
                    return true;
                }
            }
        } else {
            // 降级方案：记录警告，避免递归查找
            if (Role.recursiveFindWarningCount < 5) {
                console.error('[Role性能优化] 检测到石墙碰撞检测但 UnitManager 未初始化！跳过石墙碰撞检测。');
                Role.recursiveFindWarningCount++;
            }
        }

        // 检查与防御塔的碰撞 - 使用 UnitManager（避免递归查找），使用平方距离
        if (this.unitManager) {
            const towers = this.unitManager.getDefenseTowers();
            for (const tower of towers) {
                if (!tower || !tower.active || !tower.isValid) continue;
                const watchTowerScript = tower.getComponent('WatchTower') as any;
                const iceTowerScript = tower.getComponent('IceTower') as any;
                const thunderTowerScript = tower.getComponent('ThunderTower') as any;
                const towerScript = watchTowerScript || iceTowerScript || thunderTowerScript;
                if (!towerScript || !towerScript.isAlive || !towerScript.isAlive()) continue;
                
                const towerPos = tower.worldPosition;
                const dx = position.x - towerPos.x;
                const dy = position.y - towerPos.y;
                const distanceSq = dx * dx + dy * dy;
                const baseRadius = towerScript.collisionRadius ?? 50;
                const towerRadius = baseRadius * 0.6;
                const minDistance = this.collisionRadius + towerRadius;
                const minDistanceSq = minDistance * minDistance;
                
                if (distanceSq < minDistanceSq) {
                    return true;
                }
            }
        } else {
            // 降级方案：记录警告，避免递归查找
            if (Role.recursiveFindWarningCount < 5) {
                console.error('[Role性能优化] 检测到防御塔碰撞检测但 UnitManager 未初始化！跳过防御塔碰撞检测。');
                Role.recursiveFindWarningCount++;
            }
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
        const visibleSize = view.getVisibleSize();
        const designResolution = view.getDesignResolutionSize();
        
        // 计算屏幕边界，确保单位在可见屏幕内移动
        const minX = this.collisionRadius;
        const maxX = designResolution.width - this.collisionRadius;
        const minY = this.collisionRadius;
        // 限制顶部：距离画面顶部100像素
        const maxY = designResolution.height - this.collisionRadius - 100;
        
        // 限制位置在屏幕范围内
        const clampedPos = new Vec3(position);
        clampedPos.x = Math.max(minX, Math.min(maxX, clampedPos.x));
        clampedPos.y = Math.max(minY, Math.min(maxY, clampedPos.y));
        
        return clampedPos;
    }

    /**
     * 检查碰撞并调整位置
     * @param currentPos 当前位置
     * @param newPos 新位置
     * @returns 调整后的位置
     * 性能优化：使用平方距离比较，复用临时Vec3对象
     * 智能避让：减少尝试次数，优先使用较大角度避让
     */
    checkCollisionAndAdjust(currentPos: Vec3, newPos: Vec3): Vec3 {
        // 首先限制在屏幕范围内
        const clampedNewPos = this.clampPositionToScreen(newPos);
        
        // 如果新位置没有碰撞，直接返回
        if (!this.checkCollisionAtPosition(clampedNewPos)) {
            return clampedNewPos;
        }

        // 如果有碰撞，尝试寻找替代路径
        Vec3.subtract(this.tempVec3_1, clampedNewPos, currentPos);
        
        // 使用平方距离比较
        const dx = clampedNewPos.x - currentPos.x;
        const dy = clampedNewPos.y - currentPos.y;
        const moveDistanceSq = dx * dx + dy * dy;
        
        if (moveDistanceSq < 0.01) {
            // 移动距离太小，尝试推开
            const pushDir = this.calculatePushAwayDirection(currentPos);
            if (pushDir.length() > 0.1) {
                Vec3.scaleAndAdd(this.tempVec3_2, currentPos, pushDir, this.collisionRadius * 0.5);
                const clampedPushPos = this.clampPositionToScreen(this.tempVec3_2);
                if (!this.checkCollisionAtPosition(clampedPushPos)) {
                    return clampedPushPos;
                }
            }
            return currentPos;
        }

        const moveDistance = Math.sqrt(moveDistanceSq);
        this.tempVec3_1.normalize();

        // 智能避让：减少尝试次数，使用更大的角度偏移
        // 优先尝试较大角度（60度、90度），避免小角度频繁调整导致抽搐
        const offsetAngles = [60, -60, 90, -90, 120, -120, 150, -150, 30, -30];
        let tryCount = 0;
        const maxTries = 2; // 减少到2次尝试，避免过度计算

        for (const angle of offsetAngles) {
            const rad = angle * Math.PI / 180;
            const cosRad = Math.cos(rad);
            const sinRad = Math.sin(rad);
            const offsetDirX = this.tempVec3_1.x * cosRad - this.tempVec3_1.y * sinRad;
            const offsetDirY = this.tempVec3_1.x * sinRad + this.tempVec3_1.y * cosRad;
            
            // 归一化
            const offsetDirLen = Math.sqrt(offsetDirX * offsetDirX + offsetDirY * offsetDirY);
            const normOffsetDirX = offsetDirX / offsetDirLen;
            const normOffsetDirY = offsetDirY / offsetDirLen;

            // 只尝试完整距离，不尝试部分距离
            this.tempVec3_2.set(
                currentPos.x + normOffsetDirX * moveDistance,
                currentPos.y + normOffsetDirY * moveDistance,
                0
            );
            const clampedTestPos = this.clampPositionToScreen(this.tempVec3_2);

            tryCount++;

            if (!this.checkCollisionAtPosition(clampedTestPos)) {
                return clampedTestPos;
            }

            // 最多只尝试 maxTries 次
            if (tryCount >= maxTries) {
                break;
            }
        }

        // 如果所有方向都有碰撞，尝试推开
        const pushDir = this.calculatePushAwayDirection(currentPos);
        if (pushDir.length() > 0.1) {
            Vec3.scaleAndAdd(this.tempVec3_2, currentPos, pushDir, this.collisionRadius * 0.3);
            const clampedPushPos = this.clampPositionToScreen(this.tempVec3_2);
            if (!this.checkCollisionAtPosition(clampedPushPos)) {
                return clampedPushPos;
            }
        }

        // 如果所有方法都失败，保持当前位置
        return currentPos;
    }

    /**
     * 计算推开方向（当当前位置有碰撞时使用）
     * @param currentPos 当前位置
     * @returns 推开方向
     * 性能优化：使用缓存节点和 UnitManager，使用平方距离比较
     */
    calculatePushAwayDirection(currentPos: Vec3): Vec3 {
        const pushForce = new Vec3(0, 0, 0);
        let obstacleCount = 0;
        let maxPushStrength = 0;

        // 检查水晶 - 使用缓存节点和平方距离
        const crystal = Role.cachedCrystalNode;
        if (crystal && crystal.isValid && crystal.active) {
            const crystalPos = crystal.worldPosition;
            const dx = currentPos.x - crystalPos.x;
            const dy = currentPos.y - crystalPos.y;
            const distanceSq = dx * dx + dy * dy;
            const distance = Math.sqrt(distanceSq); // 只在需要时计算一次
            const crystalRadius = 50;
            const minDistance = this.collisionRadius + crystalRadius;
            if (distance < minDistance && distance > 0.1) {
                Vec3.subtract(this.tempVec3_1, currentPos, crystalPos);
                this.tempVec3_1.normalize();
                const strength = Math.max(1.0, (minDistance - distance) / minDistance * 2.0);
                Vec3.scaleAndAdd(pushForce, pushForce, this.tempVec3_1, strength);
                maxPushStrength = Math.max(maxPushStrength, strength);
                obstacleCount++;
            }
        }

        // 检查其他弓箭手 - 使用 UnitManager 和平方距离
        if (this.unitManager) {
            const towers = this.unitManager.getTowers();
            for (const tower of towers) {
                if (tower && tower.isValid && tower.active && tower !== this.node) {
                    const towerPos = tower.worldPosition;
                    const dx = currentPos.x - towerPos.x;
                    const dy = currentPos.y - towerPos.y;
                    const distanceSq = dx * dx + dy * dy;
                    let otherTowerScript = tower.getComponent('Role') as any;
                    if (!otherTowerScript) {
                        otherTowerScript = tower.getComponent('Arrower') as any;
                    }
                    const otherRadius = otherTowerScript && otherTowerScript.collisionRadius ? otherTowerScript.collisionRadius : this.collisionRadius;
                    const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                    const minDistanceSq = minDistance * minDistance;
                    if (distanceSq < minDistanceSq && distanceSq > 0.01) {
                        const distance = Math.sqrt(distanceSq);
                        Vec3.subtract(this.tempVec3_1, currentPos, towerPos);
                        this.tempVec3_1.normalize();
                        const strength = Math.max(2.0, (minDistance - distance) / minDistance * 3.0);
                        Vec3.scaleAndAdd(pushForce, pushForce, this.tempVec3_1, strength);
                        maxPushStrength = Math.max(maxPushStrength, strength);
                        obstacleCount++;
                    }
                }
            }
        }

        // 检查女猎手 - 使用 UnitManager 和平方距离
        if (this.unitManager) {
            const hunters = this.unitManager.getHunters();
            for (const hunter of hunters) {
                if (hunter && hunter.isValid && hunter.active && hunter !== this.node) {
                    const hunterPos = hunter.worldPosition;
                    const dx = currentPos.x - hunterPos.x;
                    const dy = currentPos.y - hunterPos.y;
                    const distanceSq = dx * dx + dy * dy;
                    const otherHunterScript = hunter.getComponent('Role') as any;
                    if (!otherHunterScript) {
                        continue;
                    }
                    const otherRadius = otherHunterScript.collisionRadius ? otherHunterScript.collisionRadius : this.collisionRadius;
                    const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                    const minDistanceSq = minDistance * minDistance;
                    if (distanceSq < minDistanceSq && distanceSq > 0.01) {
                        const distance = Math.sqrt(distanceSq);
                        Vec3.subtract(this.tempVec3_1, currentPos, hunterPos);
                        this.tempVec3_1.normalize();
                        const strength = Math.max(2.0, (minDistance - distance) / minDistance * 3.0);
                        Vec3.scaleAndAdd(pushForce, pushForce, this.tempVec3_1, strength);
                        maxPushStrength = Math.max(maxPushStrength, strength);
                        obstacleCount++;
                    }
                }
            }
        }

        // 检查法师 - 使用 UnitManager 和平方距离
        if (this.unitManager) {
            const mages = this.unitManager.getMages();
            for (const mage of mages) {
                if (mage && mage.isValid && mage.active && mage !== this.node) {
                    const magePos = mage.worldPosition;
                    const dx = currentPos.x - magePos.x;
                    const dy = currentPos.y - magePos.y;
                    const distanceSq = dx * dx + dy * dy;
                    const otherMageScript = mage.getComponent('Role') as any;
                    if (!otherMageScript) {
                        continue;
                    }
                    const otherRadius = otherMageScript.collisionRadius ? otherMageScript.collisionRadius : this.collisionRadius;
                    const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                    const minDistanceSq = minDistance * minDistance;
                    if (distanceSq < minDistanceSq && distanceSq > 0.01) {
                        const distance = Math.sqrt(distanceSq);
                        Vec3.subtract(this.tempVec3_1, currentPos, magePos);
                        this.tempVec3_1.normalize();
                        const strength = Math.max(2.0, (minDistance - distance) / minDistance * 3.0);
                        Vec3.scaleAndAdd(pushForce, pushForce, this.tempVec3_1, strength);
                        maxPushStrength = Math.max(maxPushStrength, strength);
                        obstacleCount++;
                    }
                }
            }
        }

        // 检查敌人 - 使用公共敌人获取函数（已优化）和平方距离
        const enemies = this.getEnemies(true, this.collisionRadius * 2);
        for (const enemy of enemies) {
            if (enemy && enemy.isValid && enemy.active) {
                const enemyPos = enemy.worldPosition;
                const dx = currentPos.x - enemyPos.x;
                const dy = currentPos.y - enemyPos.y;
                const distanceSq = dx * dx + dy * dy;
                const enemyRadius = 30;
                const minDistance = this.collisionRadius + enemyRadius;
                const minDistanceSq = minDistance * minDistance;
                if (distanceSq < minDistanceSq && distanceSq > 0.01) {
                    const distance = Math.sqrt(distanceSq);
                    Vec3.subtract(this.tempVec3_1, currentPos, enemyPos);
                    this.tempVec3_1.normalize();
                    const strength = Math.max(1.0, (minDistance - distance) / minDistance * 2.0);
                    Vec3.scaleAndAdd(pushForce, pushForce, this.tempVec3_1, strength);
                    maxPushStrength = Math.max(maxPushStrength, strength);
                    obstacleCount++;
                }
            }
        }

        if (obstacleCount > 0 && pushForce.length() > 0.1) {
            pushForce.normalize();
            Vec3.multiplyScalar(this.tempVec3_2, pushForce, Math.min(maxPushStrength, 2.0));
            return this.tempVec3_2;
        }

        return new Vec3(0, 0, 0);
    }
           

    /**
     * 计算避障方向
     * @param currentPos 当前位置
     * @param desiredDirection 期望移动方向
     * @param deltaTime 时间增量
     * @returns 调整后的移动方向
     * 性能优化：使用缓存节点和 UnitManager，使用平方距离比较
     */
    calculateAvoidanceDirection(currentPos: Vec3, desiredDirection: Vec3, deltaTime: number): Vec3 {
        const avoidanceForce = new Vec3(0, 0, 0);
        let obstacleCount = 0;
        let maxStrength = 0;

        // 检测附近的障碍物并计算避障力
        const detectionRange = this.collisionRadius * 4;
        const detectionRangeSq = detectionRange * detectionRange;

        // 检查水晶 - 使用缓存节点和平方距离
        const crystal = Role.cachedCrystalNode;
        if (crystal && crystal.isValid && crystal.active) {
            const crystalPos = crystal.worldPosition;
            const dx = currentPos.x - crystalPos.x;
            const dy = currentPos.y - crystalPos.y;
            const distanceSq = dx * dx + dy * dy;
            const crystalRadius = 40;
            const minDistance = this.collisionRadius + crystalRadius;
            const minDistanceSq = minDistance * minDistance;
            if (distanceSq < detectionRangeSq && distanceSq > 0.01) {
                const distance = Math.sqrt(distanceSq);
                Vec3.subtract(this.tempVec3_1, currentPos, crystalPos);
                this.tempVec3_1.normalize();
                let strength = 1 - (distance / detectionRange);
                if (distanceSq < minDistanceSq) {
                    strength = 2.0;
                }
                Vec3.scaleAndAdd(avoidanceForce, avoidanceForce, this.tempVec3_1, strength);
                maxStrength = Math.max(maxStrength, strength);
                obstacleCount++;
            }
        }

        // 检查其他弓箭手 - 使用 UnitManager 和平方距离
        if (this.unitManager) {
            const towers = this.unitManager.getTowers();
            for (const tower of towers) {
                if (tower && tower.isValid && tower.active && tower !== this.node) {
                    const towerPos = tower.worldPosition;
                    const dx = currentPos.x - towerPos.x;
                    const dy = currentPos.y - towerPos.y;
                    const distanceSq = dx * dx + dy * dy;
                    let otherTowerScript = tower.getComponent('Role') as any;
                    if (!otherTowerScript) {
                        otherTowerScript = tower.getComponent('Arrower') as any;
                    }
                    const otherRadius = otherTowerScript && otherTowerScript.collisionRadius ? otherTowerScript.collisionRadius : this.collisionRadius;
                    const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                    const minDistanceSq = minDistance * minDistance;
                    if (distanceSq < detectionRangeSq && distanceSq > 0.01) {
                        const distance = Math.sqrt(distanceSq);
                        Vec3.subtract(this.tempVec3_1, currentPos, towerPos);
                        this.tempVec3_1.normalize();
                        let strength = 1 - (distance / detectionRange);
                        if (distanceSq < minDistanceSq) {
                            strength = 3.0;
                        }
                        Vec3.scaleAndAdd(avoidanceForce, avoidanceForce, this.tempVec3_1, strength);
                        maxStrength = Math.max(maxStrength, strength);
                        obstacleCount++;
                    }
                }
            }
        }

        // 检查女猎手 - 使用 UnitManager 和平方距离
        if (this.unitManager) {
            const hunters = this.unitManager.getHunters();
            for (const hunter of hunters) {
                if (hunter && hunter.isValid && hunter.active && hunter !== this.node) {
                    const hunterPos = hunter.worldPosition;
                    const dx = currentPos.x - hunterPos.x;
                    const dy = currentPos.y - hunterPos.y;
                    const distanceSq = dx * dx + dy * dy;
                    const otherHunterScript = hunter.getComponent('Role') as any;
                    if (!otherHunterScript) {
                        continue;
                    }
                    const otherRadius = otherHunterScript.collisionRadius ? otherHunterScript.collisionRadius : this.collisionRadius;
                    const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                    const minDistanceSq = minDistance * minDistance;
                    if (distanceSq < detectionRangeSq && distanceSq > 0.01) {
                        const distance = Math.sqrt(distanceSq);
                        Vec3.subtract(this.tempVec3_1, currentPos, hunterPos);
                        this.tempVec3_1.normalize();
                        let strength = 1 - (distance / detectionRange);
                        if (distanceSq < minDistanceSq) {
                            strength = 3.0; // 大幅增强避障力
                        }
                        Vec3.scaleAndAdd(avoidanceForce, avoidanceForce, this.tempVec3_1, strength);
                        maxStrength = Math.max(maxStrength, strength);
                        obstacleCount++;
                    }
                }
            }
        }

        // 检查法师 - 使用 UnitManager 和平方距离
        if (this.unitManager) {
            const mages = this.unitManager.getMages();
            for (const mage of mages) {
                if (mage && mage.isValid && mage.active && mage !== this.node) {
                    const magePos = mage.worldPosition;
                    const dx = currentPos.x - magePos.x;
                    const dy = currentPos.y - magePos.y;
                    const distanceSq = dx * dx + dy * dy;
                    const otherMageScript = mage.getComponent('Role') as any;
                    if (!otherMageScript) {
                        continue;
                    }
                    const otherRadius = otherMageScript.collisionRadius ? otherMageScript.collisionRadius : this.collisionRadius;
                    const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                    const minDistanceSq = minDistance * minDistance;
                    if (distanceSq < detectionRangeSq && distanceSq > 0.01) {
                        const distance = Math.sqrt(distanceSq);
                        Vec3.subtract(this.tempVec3_1, currentPos, magePos);
                        this.tempVec3_1.normalize();
                        let strength = 1 - (distance / detectionRange);
                        if (distanceSq < minDistanceSq) {
                            strength = 3.0;
                        }
                        Vec3.scaleAndAdd(avoidanceForce, avoidanceForce, this.tempVec3_1, strength);
                        maxStrength = Math.max(maxStrength, strength);
                        obstacleCount++;
                    }
                }
            }
        }

        // 检查敌人 - 使用公共敌人获取函数和平方距离
        const enemies = this.getEnemies(true, detectionRange);
        for (const enemy of enemies) {
            if (enemy && enemy.isValid && enemy.active) {
                const enemyPos = enemy.worldPosition;
                const dx = currentPos.x - enemyPos.x;
                const dy = currentPos.y - enemyPos.y;
                const distanceSq = dx * dx + dy * dy;
                const enemyRadius = 25;
                const minDistance = this.collisionRadius + enemyRadius;
                const minDistanceSq = minDistance * minDistance;
                if (distanceSq < detectionRangeSq && distanceSq > 0.01) {
                    const distance = Math.sqrt(distanceSq);
                    Vec3.subtract(this.tempVec3_1, currentPos, enemyPos);
                    this.tempVec3_1.normalize();
                    let strength = 1 - (distance / detectionRange);
                    if (distanceSq < minDistanceSq) {
                        strength = 2.0;
                    }
                    Vec3.scaleAndAdd(avoidanceForce, avoidanceForce, this.tempVec3_1, strength);
                    maxStrength = Math.max(maxStrength, strength);
                    obstacleCount++;
                }
            }
        }

        // 如果有障碍物，应用避障力
        if (obstacleCount > 0 && avoidanceForce.length() > 0.1) {
            avoidanceForce.normalize();
            // 根据障碍物强度调整混合比例
            // 如果障碍物很近（maxStrength > 1），优先避障
            const avoidanceWeight = maxStrength > 2.0 ? 0.9 : (maxStrength > 1.0 ? 0.7 : 0.5); // 50%-90%避障
            Vec3.lerp(this.tempVec3_3, desiredDirection, avoidanceForce, avoidanceWeight);
            this.tempVec3_3.normalize();
            
            return this.tempVec3_3;
        }

        // 没有障碍物，返回期望方向
        return desiredDirection;
    }

    attack() {
        if (!this.currentTarget || this.isDestroyed) {
            return;
        }

        // 再次检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }

        // 攻击时停止移动
        this.stopMoving();

        // 开始攻击时，如果满足条件，立即触发一次口号
        this.tryTriggerSloganOnAction();

        // 检查目标是否是存活的敌人
        if (this.isAliveEnemy(this.currentTarget)) {
            // 播放攻击动画，动画完成后才射出弓箭
            this.playAttackAnimation(() => {
                // 动画播放完成后的回调，在这里创建弓箭
                this.executeAttack();
            });
        } else {
            // 目标已死亡，清除目标
            this.currentTarget = null!;
        }
    }

    executeAttack() {
        // 再次检查目标是否有效
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active || this.isDestroyed) {
            return;
        }

        // 检查目标是否是存活的敌人
        if (!this.isAliveEnemy(this.currentTarget)) {
            this.currentTarget = null!;
            return;
        }
        
        // 获取敌人脚本
        const enemyScript = this.getEnemyScript(this.currentTarget);

        // 创建弓箭特效（抛物线轨迹）
        if (this.arrowPrefab) {
            this.createArrow();
        } else if (this.bulletPrefab) {
            // 如果没有弓箭预制体，使用旧的子弹系统
            this.createBullet();
        } else {
            // 直接伤害（无特效）
            if (enemyScript && enemyScript.takeDamage) {
                enemyScript.takeDamage(this.attackDamage);
            }
        }
    }

    playAttackAnimation(onComplete?: () => void) {
        // 如果正在播放动画，不重复播放
        if (this.isPlayingAttackAnimation) {
            return;
        }

        // 每次攻击开始时，在2秒内禁止播放待机动画
        this.idleBlockTimer = 2;

        // 进入攻击状态时，不允许显示待机口令
        this.clearIdleSloganDialogIfAny();

        // 停止待机动画并恢复设置
        if (this.isPlayingIdleAnimation) {
            this.isPlayingIdleAnimation = false;
            this.restoreIdleAnimationSettings();
        }

        // 如果没有Sprite组件或没有动画帧，直接返回
        if (!this.sprite) {
            return;
        }

        // 如果没有设置动画帧，直接返回
        if (!this.attackAnimationFrames || this.attackAnimationFrames.length === 0) {
            return;
        }

        // 检查帧是否有效
        const validFrames = this.attackAnimationFrames.filter(frame => frame != null);
        if (validFrames.length === 0) {
            return;
        }

        // 根据敌人位置决定是否翻转
        let shouldFlip = false;
        if (this.currentTarget && this.currentTarget.isValid) {
            const towerPos = this.node.worldPosition;
            const enemyPos = this.currentTarget.worldPosition;
            // 如果敌人在左侧（敌人x < 弓箭手x），需要翻转
            shouldFlip = enemyPos.x < towerPos.x;
            
            if (shouldFlip) {
                // 水平翻转：scale.x = -1
                this.node.setScale(-Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
                // 血条 / 蓝量条保持正常朝向
                this.refreshOverheadNodesScale();
            } else {
                // 保持原样：scale.x = 1
                this.node.setScale(Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
                // 血条 / 蓝量条保持正常朝向
                this.refreshOverheadNodesScale();
            }
        }

        // 标记正在播放动画
        const wasPlayingAnimation = this.isPlayingAttackAnimation;
        this.isPlayingAttackAnimation = true;
        
        // 如果刚刚开始播放攻击动画，尝试触发口号
        if (!wasPlayingAnimation) {
            this.tryTriggerSloganOnAction();
        }

        const frames = validFrames;
        const frameCount = frames.length;
        const frameDuration = this.attackAnimationDuration / frameCount; // 每帧的时长

        // 使用update方法播放动画（更可靠）
        let animationTimer = 0;
        let lastFrameIndex = -1; // 记录上一帧的索引，避免重复设置
        
        // 立即播放第一帧
        if (frames[0]) {
            this.sprite.spriteFrame = frames[0];
            lastFrameIndex = 0;
        }
        
        // 使用update方法逐帧播放
        const animationUpdate = (deltaTime: number) => {
            if (!this.sprite || !this.sprite.isValid || this.isDestroyed) {
                this.isPlayingAttackAnimation = false;
                this.unschedule(animationUpdate);
                return;
            }

            animationTimer += deltaTime;
            
            // 计算当前应该显示的帧索引
            const targetFrameIndex = Math.min(Math.floor(animationTimer / frameDuration), frameCount - 1);
            
            // 检查动画是否完成
            if (animationTimer >= this.attackAnimationDuration) {
                // 确保播放最后一帧
                if (lastFrameIndex < frameCount - 1 && frames[frameCount - 1]) {
                    this.sprite.spriteFrame = frames[frameCount - 1];
                }
                // 动画播放完成，恢复默认SpriteFrame
                this.restoreDefaultSprite();
                this.unschedule(animationUpdate);
                
                // 调用完成回调（在恢复默认SpriteFrame之后）
                if (onComplete) {
                    onComplete();
                }
                return;
            }
            
            // 更新到当前帧（只在帧变化时更新）
            if (targetFrameIndex !== lastFrameIndex && targetFrameIndex < frameCount && frames[targetFrameIndex]) {
                this.sprite.spriteFrame = frames[targetFrameIndex];
                lastFrameIndex = targetFrameIndex;
            }
        };
        
        // 先取消之前的调度，避免重复调度
        this.unschedule(animationUpdate);
        // 开始动画更新（每帧更新）
        this.schedule(animationUpdate, 0);
    }

    restoreDefaultSprite() {
        // 恢复默认SpriteFrame
        if (this.sprite && this.sprite.isValid && this.defaultSpriteFrame) {
            this.sprite.spriteFrame = this.defaultSpriteFrame;
        }
        this.isPlayingAttackAnimation = false;
        
        // 如果当前目标存在，保持朝向敌人；否则恢复默认缩放
        if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
            // 根据敌人位置决定是否翻转，保持朝向敌人
            const towerPos = this.node.worldPosition;
            const enemyPos = this.currentTarget.worldPosition;
            const shouldFlip = enemyPos.x < towerPos.x;
            
            if (shouldFlip) {
                // 水平翻转：scale.x = -1
                this.node.setScale(-Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
            } else {
                // 保持原样：scale.x = 1
                this.node.setScale(Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
            }
            // 血条 / 蓝量条保持正常朝向（使用统一的缩放刷新逻辑）
            this.refreshOverheadNodesScale();
        } else {
            // 没有目标，恢复默认缩放（取消翻转）
            if (this.node && this.node.isValid) {
                this.node.setScale(this.defaultScale.x, this.defaultScale.y, this.defaultScale.z);
            }
            // 恢复血条的正常朝向
            if (this.healthBarNode && this.healthBarNode.isValid) {
                this.healthBarNode.setScale(1, 1, 1);
            }
            // 蓝量条始终保持正向，不随角色翻转
            if (this.manaBarNode && this.manaBarNode.isValid) {
                this.manaBarNode.setScale(1, 1, 1);
            }
        }
        
        // 如果正在移动，恢复移动动画
        if (this.isMoving) {
            this.playMoveAnimation();
        } else {
            // 如果不在移动状态，尝试播放待机动画
            this.checkAndPlayIdleAnimation();
        }
    }
    
    /**
     * 停止所有动画
     */
    stopAllAnimations() {
        this.isPlayingAttackAnimation = false;
        this.isPlayingHitAnimation = false;
        this.isPlayingIdleAnimation = false;
        // 不停止死亡动画
        this.isHit = false; // 清除被攻击标志
    }

    /**
     * 检查并播放待机动画（如果配置了待机动画且角色处于非移动、非攻击状态）
     */
    protected checkAndPlayIdleAnimation() {
        // 在最近攻击或受击后的这段时间内不播放待机动画
        if (this.idleBlockTimer > 0) {
            return;
        }
        // 如果正在移动或攻击，不播放待机动画
        if (this.isMoving || this.isPlayingAttackAnimation || this.isPlayingHitAnimation || this.isPlayingDeathAnimation) {
            return;
        }

        // 如果有有效攻击目标（目标存活且有效），不播放待机动画
        if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
            if (this.isAliveEnemy(this.currentTarget)) {
                return;
            } else {
                // 目标已死亡或无效，清理目标引用，避免影响后续待机判断
                this.currentTarget = null!;
            }
        }

        // 如果已经在播放待机动画，不重复播放
        if (this.isPlayingIdleAnimation) {
            return;
        }

        // 收集所有配置的待机动画
        const idleAnimations: SpriteFrame[][] = [];
        if (this.idleAnimationFrames1 && this.idleAnimationFrames1.length > 0) {
            idleAnimations.push(this.idleAnimationFrames1);
        }
        if (this.idleAnimationFrames2 && this.idleAnimationFrames2.length > 0) {
            idleAnimations.push(this.idleAnimationFrames2);
        }
        if (this.idleAnimationFrames3 && this.idleAnimationFrames3.length > 0) {
            idleAnimations.push(this.idleAnimationFrames3);
        }

        // 如果没有配置待机动画，维持现有逻辑（不播放）
        if (idleAnimations.length === 0) {
            return;
        }

        // 播放待机动画
        this.playIdleAnimation(idleAnimations);
    }

    /**
     * 播放待机动画
     * @param idleAnimations 待机动画数组（最多3段）
     *
     * 注意：这里不再做任何缩放或 UITransform 尺寸的特殊处理，
     * 播放逻辑完全参照移动动画的实现，只是多了"随机段落 + 末尾静止 2-5 秒"的机制。
     * 特殊处理：播放第三段待机动画时，将角色拉宽50%。
     */
    private playIdleAnimation(idleAnimations: SpriteFrame[][]) {
        if (!this.sprite || !this.sprite.isValid || this.isDestroyed) {
            return;
        }

        // 选择一段待机动画播放：
        // - 当三段都配置时：段1=40%，段2=40%，段3=20%
        // - 当只有1-2段配置时：等概率随机
        let selectedAnimation: SpriteFrame[] = [];
        let selectedIndex: number = 0; // 记录选中的段落索引（0/1/2）
        if (idleAnimations.length === 3) {
            const r = Math.random();
            if (r < 0.4) {
                selectedIndex = 0;
            } else if (r < 0.8) {
                selectedIndex = 1;
            } else {
                selectedIndex = 2;
            }
            selectedAnimation = idleAnimations[selectedIndex];
        } else if (idleAnimations.length === 2) {
            selectedIndex = Math.floor(Math.random() * 2);
            selectedAnimation = idleAnimations[selectedIndex];
        } else {
            selectedIndex = 0;
            selectedAnimation = idleAnimations[0];
        }

        // 过滤出有效的帧
        const validFrames = selectedAnimation.filter(frame => frame != null && frame.isValid);
        if (validFrames.length === 0) {
            return;
        }

        // 保存当前播放的段落索引，并标记进入待机播放（用于待机口号触发判断）
        this.currentIdleAnimationSegmentIndex = selectedIndex;
        this.isPlayingIdleAnimation = true;

        // 触发待机口号（在播放第三段待机动画时）
        if (selectedIndex === 2 && !this.isMoving && !this.isPlayingAttackAnimation && !this.isPlayingHitAnimation && !this.isPlayingDeathAnimation) {
            this.triggerIdleSlogan();
        }

        // 保存原始缩放（如果尚未保存）
        if (!this.idleAnimationOriginalScale) {
            this.idleAnimationOriginalScale = this.node.getScale().clone();
        }

        // 第三段待机动画：应用拉宽 50% 效果
        if (selectedIndex === 2) {
            // 应用拉宽 50% 效果（只修改 X 轴缩放）
            const targetScaleX = this.idleAnimationOriginalScale.x * 1.5;
            this.node.setScale(targetScaleX, this.idleAnimationOriginalScale.y, this.idleAnimationOriginalScale.z);
            // 血条/对话框反向补偿，保持它们宽度不变
            this.refreshOverheadNodesScale();
        }

        const frames = validFrames;
        const frameCount = frames.length;
        const frameDuration = this.idleAnimationDuration / frameCount;
        let animationTimer = 0;
        let lastFrameIndex = -1;

        // 立即播放第一帧（逻辑与移动动画一致）
        if (frames[0]) {
            this.sprite.spriteFrame = frames[0];
            lastFrameIndex = 0;
            const uiTransform = this.node.getComponent(UITransform);
            if (uiTransform) {
                //console.log(播放待机动画);
            }
        }
        // 使用 update 方法逐帧播放（整体结构与移动动画一致）
        const animationUpdate = (deltaTime: number) => {
            // 如果角色开始移动或攻击，停止待机动画
            if (this.isMoving || this.isPlayingAttackAnimation || !this.sprite || !this.sprite.isValid || this.isDestroyed) {
                this.isPlayingIdleAnimation = false;
                this.unschedule(animationUpdate);
                // 恢复原始设置（即便当前实现没有改动尺寸/缩放，这里留作安全兜底）
                this.restoreIdleAnimationSettings();
                return;
            }

            animationTimer += deltaTime;

            // 检查动画是否播放完成
            if (animationTimer >= this.idleAnimationDuration) {
                // 动画播放完成，保持最后一帧
                const lastFrame = frames[frameCount - 1];
                if (lastFrame) {
                    this.sprite.spriteFrame = lastFrame;
                }

                // 停止动画更新
                this.isPlayingIdleAnimation = false;
                this.unschedule(animationUpdate);

                // 第三段动画播放完成，立即恢复原始缩放
                if (selectedIndex === 2) {
                    this.restoreIdleAnimationSettings();
                }

                // 随机等待 2-5 秒后播放下一段待机动画
                const waitTime = 2 + Math.random() * 3;
                this.scheduleOnce(() => {
                    // 等待结束后，如果仍然处于待机状态，播放下一段待机动画
                    if (!this.isMoving && !this.isPlayingAttackAnimation && !this.isPlayingHitAnimation && !this.isPlayingDeathAnimation) {
                        this.checkAndPlayIdleAnimation();
                    } else {
                        this.restoreIdleAnimationSettings();
                    }
                }, waitTime);

                return;
            }

            // 计算当前应该显示的帧索引
            const targetFrameIndex = Math.min(Math.floor(animationTimer / frameDuration), frameCount - 1);

            // 更新到当前帧（只在帧变化时更新）
            if (targetFrameIndex !== lastFrameIndex && targetFrameIndex < frameCount && frames[targetFrameIndex]) {
                this.sprite.spriteFrame = frames[targetFrameIndex];
                lastFrameIndex = targetFrameIndex;

                // 打印 UITransform 尺寸做对比（不作修改）
                // const uiTransform = this.node.getComponent(UITransform);
                // if (uiTransform) {
                    //console.log(`[Role] 待机动画切换帧后 - UITransform大小: width=${uiTransform.width}, height=${uiTransform.height}, 帧索引=${targetFrameIndex}, 单位名称=${this.unitName || '未知'}`);
                //}
            }
        };

        // 先取消之前的调度，避免重复调度
        this.unschedule(animationUpdate);
        // 开始动画更新（每帧更新）
        this.schedule(animationUpdate, 0);
    }

    /**
     * 应用待机动画缩放，让SpriteFrame的rect区域的实际显示大小等于目标尺寸
     * 注意：实际显示大小 = rect尺寸 * 节点缩放
     */
    private applyIdleAnimationScale() {
        if (!this.sprite || !this.sprite.isValid || !this.sprite.spriteFrame || !this.idleAnimationOriginalSize) {
            return;
        }

        const spriteFrame = this.sprite.spriteFrame;
        const rect = spriteFrame.rect || { width: 0, height: 0 };
        
        // 如果rect尺寸为0，不应用缩放
        if (rect.width <= 0 || rect.height <= 0) {
            return;
        }

        // 计算缩放比例，让rect区域的实际显示大小等于目标尺寸
        // 实际显示大小 = rect * 节点缩放
        // 目标：rect * 新缩放 = 目标尺寸
        // 所以：新缩放 = 目标尺寸 / rect
        const targetWidth = this.idleAnimationOriginalSize.width;
        const targetHeight = this.idleAnimationOriginalSize.height;
        const scaleX = targetWidth / rect.width;
        const scaleY = targetHeight / rect.height;
        
        // 使用原始缩放作为基础，应用新的缩放
        if (this.idleAnimationOriginalScale) {
            const newScaleX = this.idleAnimationOriginalScale.x * scaleX;
            const newScaleY = this.idleAnimationOriginalScale.y * scaleY;
            this.node.setScale(
                newScaleX,
                newScaleY,
                this.idleAnimationOriginalScale.z
            );
            
            // 计算实际显示大小
            const actualDisplayWidth = rect.width * Math.abs(newScaleX);
            const actualDisplayHeight = rect.height * Math.abs(newScaleY);
            //console.log(`[Role] 应用待机动画缩放 - rect: (${rect.width}, ${rect.height}), 目标尺寸: (${targetWidth}, ${targetHeight}), 原始缩放: (${this.idleAnimationOriginalScale.x.toFixed(2)}, ${this.idleAnimationOriginalScale.y.toFixed(2)}), 新缩放: (${newScaleX.toFixed(2)}, ${newScaleY.toFixed(2)}), 实际显示大小: (${actualDisplayWidth.toFixed(2)}, ${actualDisplayHeight.toFixed(2)})`);
        } else {
            this.node.setScale(scaleX, scaleY, 1);
            const actualDisplayWidth = rect.width * Math.abs(scaleX);
            const actualDisplayHeight = rect.height * Math.abs(scaleY);
            //console.log(`[Role] 应用待机动画缩放 - rect: (${rect.width}, ${rect.height}), 目标尺寸: (${targetWidth}, ${targetHeight}), 缩放: (${scaleX.toFixed(2)}, ${scaleY.toFixed(2)}), 实际显示大小: (${actualDisplayWidth.toFixed(2)}, ${actualDisplayHeight.toFixed(2)})`);
        }
    }

    /**
     * 恢复待机动画前的Sprite设置
     */
    private restoreIdleAnimationSettings() {
        // 恢复Sprite设置（如果有修改）
        if (this.idleAnimationOriginalSizeMode !== null && this.sprite && this.sprite.isValid) {
            this.sprite.sizeMode = this.idleAnimationOriginalSizeMode;
            if (this.idleAnimationOriginalTrim !== null) {
                this.sprite.trim = this.idleAnimationOriginalTrim;
            }
            if (this.idleAnimationOriginalType !== null) {
                this.sprite.type = this.idleAnimationOriginalType;
            }
        }
        
        // 恢复原始缩放（如果保存了，比如第三段待机动画的拉宽效果）
        if (this.idleAnimationOriginalScale) {
            this.node.setScale(
                this.idleAnimationOriginalScale.x,
                this.idleAnimationOriginalScale.y,
                this.idleAnimationOriginalScale.z
            );
            //console.log(`[Role] 恢复待机动画缩放 - 恢复到原始缩放: (${this.idleAnimationOriginalScale.x.toFixed(2)}, ${this.idleAnimationOriginalScale.y.toFixed(2)})`);
        }

        this.refreshOverheadNodesScale();
        // 重置待机播放标志
        this.isPlayingIdleAnimation = false;
        // 清除所有保存的设置
        this.idleAnimationOriginalSizeMode = null;
        this.idleAnimationOriginalSize = null;
        this.idleAnimationOriginalTrim = null;
        this.idleAnimationOriginalType = null;
        this.idleAnimationOriginalScale = null;
        this.currentIdleAnimationSegmentIndex = -1; // 重置段落索引
    }

    /**
     * 播放被攻击动画
     */
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
        if (this.sprite && this.hitAnimationFrames.length > 0 && this.hitAnimationFrames[0]) {
            this.sprite.spriteFrame = this.hitAnimationFrames[0];
            this.currentAnimationFrameIndex = 0;
        }
        
        // 先取消之前的调度，避免重复调度
        this.unschedule(this.updateHitAnimation);
        // 开始动画更新
        this.schedule(this.updateHitAnimation, 0);
    }
    
    /**
     * 播放死亡动画
     */
    playDeathAnimation() {
        if (this.isPlayingDeathAnimation) {
            return;
        }

        this.stopAllAnimations();
        this.isPlayingDeathAnimation = true;
        this.animationTimer = 0;
        this.currentAnimationFrameIndex = -1;
        
        // 立即播放第一帧
        if (this.sprite && this.deathAnimationFrames.length > 0 && this.deathAnimationFrames[0]) {
            this.sprite.spriteFrame = this.deathAnimationFrames[0];
            this.currentAnimationFrameIndex = 0;
        }
        
        // 先取消之前的调度，避免重复调度
        this.unschedule(this.updateDeathAnimation);
        // 开始死亡动画更新
        this.schedule(this.updateDeathAnimation, 0);
    }
    
    /**
     * 更新被攻击动画
     */
    updateHitAnimation(deltaTime: number) {
        if (!this.sprite || !this.sprite.isValid || this.isDestroyed) {
            this.isPlayingHitAnimation = false;
            this.unschedule(this.updateHitAnimation);
            return;
        }
        
        this.animationTimer += deltaTime;
        
        // 计算当前应该显示的帧索引
        const frameCount = this.hitAnimationFrames.length;
        if (frameCount === 0) {
            this.isPlayingHitAnimation = false;
            this.unschedule(this.updateHitAnimation);
            this.resumeMovement();
            return;
        }
        
        const frameDuration = this.hitAnimationDuration / frameCount;
        const targetFrameIndex = Math.min(Math.floor(this.animationTimer / frameDuration), frameCount - 1);
        
        // 检查动画是否完成
        if (this.animationTimer >= this.hitAnimationDuration) {
            // 确保播放最后一帧
            if (this.currentAnimationFrameIndex < frameCount - 1 && this.hitAnimationFrames[frameCount - 1]) {
                this.sprite.spriteFrame = this.hitAnimationFrames[frameCount - 1];
            }
            // 动画播放完成，恢复移动或待机
            this.isPlayingHitAnimation = false;
            this.unschedule(this.updateHitAnimation);
            this.resumeMovement();
            return;
        }
        
        // 更新到当前帧（只在帧变化时更新）
        if (targetFrameIndex !== this.currentAnimationFrameIndex && this.hitAnimationFrames[targetFrameIndex]) {
            this.sprite.spriteFrame = this.hitAnimationFrames[targetFrameIndex];
            this.currentAnimationFrameIndex = targetFrameIndex;
        }
    }
    
    /**
     * 更新死亡动画
     */
    updateDeathAnimation(deltaTime: number) {
        if (!this.sprite || !this.sprite.isValid) {
            this.isPlayingDeathAnimation = false;
            this.unschedule(this.updateDeathAnimation);
            return;
        }
        
        this.animationTimer += deltaTime;
        
        // 计算当前应该显示的帧索引
        const frameCount = this.deathAnimationFrames.length;
        if (frameCount === 0) {
            this.isPlayingDeathAnimation = false;
            this.unschedule(this.updateDeathAnimation);
            return;
        }
        
        const frameDuration = this.deathAnimationDuration / frameCount;
        const targetFrameIndex = Math.min(Math.floor(this.animationTimer / frameDuration), frameCount - 1);
        
        // 更新到当前帧（只在帧变化时更新）
        if (targetFrameIndex !== this.currentAnimationFrameIndex && this.deathAnimationFrames[targetFrameIndex]) {
            this.sprite.spriteFrame = this.deathAnimationFrames[targetFrameIndex];
            this.currentAnimationFrameIndex = targetFrameIndex;
            
            // 解决最后两张帧人物被拉高的问题
            // 最后两张帧（索引3和4，从0开始计数）人物只在图片下半部分
            // 使用sprite的偏移而不是改变节点位置，避免节点回到原点
            if (frameCount >= 5) {
                if (targetFrameIndex === frameCount - 2 || targetFrameIndex === frameCount - 1) {
                    // 调整sprite的offset来补偿人物位置，而不是改变整个节点位置
                    if (this.sprite.spriteFrame) {
                        // 向下调整精灵的Y轴偏移，使人物保持在正确位置
                        const spriteFrame = this.sprite.spriteFrame;
                        // 注意：在Cocos Creator中，SpriteFrame的offset是只读的，所以我们需要通过调整节点的scaleY或者使用其他方式
                        // 这里使用调整节点scaleY的方式，只针对Y轴进行压缩
                        this.sprite.node.setScale(1, 0.5); // Y轴缩小到50%，可根据实际情况调整
                    }
                } else {
                    // 其他帧恢复正常比例
                    this.sprite.node.setScale(1, 1);
                }
            }
        }
        
        // 检查动画是否完成
        if (this.animationTimer >= this.deathAnimationDuration) {
            // 确保播放最后一帧
            if (this.currentAnimationFrameIndex < frameCount - 1 && this.deathAnimationFrames[frameCount - 1]) {
                this.sprite.spriteFrame = this.deathAnimationFrames[frameCount - 1];
                // 最后一帧也要调整比例
                if (frameCount >= 5) {
                    this.sprite.node.setScale(1, 0.5); // Y轴缩小到50%
                }
            }
            // 死亡动画播放完成，不再恢复
            this.isPlayingDeathAnimation = false;
            this.unschedule(this.updateDeathAnimation);
            return;
        }
    }
    
    /**
     * 恢复移动
     */
    resumeMovement() {
        // 清除被攻击标志
        this.isHit = false;
        
        // 如果角色还活着，并且没有其他动画在播放，恢复移动
        if (!this.isDestroyed && !this.isPlayingAttackAnimation && !this.isPlayingDeathAnimation) {
            // 如果正在移动，恢复移动动画
            if (this.isMoving) {
                this.playMoveAnimation();
            } else {
                // 否则恢复默认SpriteFrame
                this.restoreDefaultSprite();
            }
        }
    }

    protected createArrow() {
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

        // 设置初始位置（弓箭手位置）
        const startPos = this.node.worldPosition.clone();
        arrow.setWorldPosition(startPos);

        // 确保节点激活
        arrow.active = true;

        // 获取或添加Arrow组件
        let arrowScript = arrow.getComponent(Arrow);
        if (!arrowScript) {
            arrowScript = arrow.addComponent(Arrow);
        }

        // 播放箭矢射出音效
        if (this.shootSound && AudioManager.Instance) {
            AudioManager.Instance.playSFX(this.shootSound);
        }

        // 保存当前目标的引用，避免回调函数中引用失效的目标
        const targetNode = this.currentTarget;
        
        // 初始化弓箭，设置命中回调（带受力方向）
        arrowScript.init(
            startPos,
            targetNode,
            this.attackDamage,
            (damage: number, hitDirection: Vec3) => {
                // 播放箭矢击中音效
                if (this.hitSound) {
                    AudioManager.Instance?.playSFX(this.hitSound);
                }
                
                // 检查目标是否仍然有效
                if (targetNode && targetNode.isValid && targetNode.active) {
                    // 检查目标是否是存活的敌人
                    if (this.isAliveEnemy(targetNode)) {
                        // 获取敌人脚本
                        const enemyScript = this.getEnemyScript(targetNode);
                        if (enemyScript && enemyScript.takeDamage) {
                            // 将受力方向传给敌人，用于控制伤害数字飘动方向
                            enemyScript.takeDamage(damage, hitDirection);
                            // 记录伤害统计
                            this.recordDamageToStatistics(damage);
                        }
                    }
                }
            }
        );
    }

    protected createBullet() {
        if (!this.bulletPrefab || !this.currentTarget) {
            return;
        }

        const bullet = instantiate(this.bulletPrefab);
        bullet.setParent(this.node.parent);
        bullet.setWorldPosition(this.node.worldPosition);

        // 简单的子弹移动逻辑（可以创建Bullet脚本）
        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        direction.normalize();

        // 直接造成伤害（简化处理）
        // 获取敌人脚本，支持所有敌人类型
        if (this.isAliveEnemy(this.currentTarget)) {
            const enemyScript = this.getEnemyScript(this.currentTarget);
            if (enemyScript && enemyScript.takeDamage) {
                enemyScript.takeDamage(this.attackDamage);
                
                // 记录伤害统计
                this.recordDamageToStatistics(this.attackDamage);
            }
        }

        // 销毁子弹
        this.scheduleOnce(() => {
            if (bullet && bullet.isValid) {
                bullet.destroy();
            }
        }, 0.1);
    }

    // 最近一次受击方向（用于伤害数字沿攻击方向飘动）
    private lastHitDirection: Vec3 | null = null;

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

        // 受到攻击后，在2秒内禁止播放待机动画
        this.idleBlockTimer = 2;

		// 10% 概率触发暴击，实际伤害加成
		const isCritical = Math.random() < 0.1;
		const criticalDamage = isCritical ? Math.floor(damage * 1.5) : damage;

		// 伤害减免（用于“重甲”等卡片效果）
		const drPercentRaw = (this as any)._spDamageReductionPercent;
		const drPercent = Math.max(0, Math.min(90, typeof drPercentRaw === 'number' ? drPercentRaw : 0));
		const finalDamage = drPercent > 0 ? Math.max(1, Math.floor(criticalDamage * (1 - drPercent / 100))) : criticalDamage;

		// 显示伤害数字
        this.showDamageNumber(finalDamage, isCritical, hitDirection);
        
        // 播放受击动画
        this.playHitAnimation();

        this.currentHealth -= finalDamage;

        // 受击口号：弓箭手 / 女猎手 / 精灵剑士 30% 概率喊“我需要治疗！”或“牧师在哪里？”
        // 只在仍然存活时触发，避免死亡瞬间重复刷语音
        if (this.currentHealth > 0) {
            const nameForSlogan = this.unitName || this.constructor.name;
            if ((nameForSlogan === '弓箭手' || nameForSlogan === '女猎手' || nameForSlogan === '精灵剑士')
                && Math.random() < 0.3) {
                const healSlogans = ['我需要治疗！', '牧师在哪里？'];
                const idx = Math.floor(Math.random() * healSlogans.length);
                const text = healSlogans[idx];
                this.createDialog(text, false);
            }
        }

        // 更新血条
        if (this.healthBar) {
            this.healthBar.setHealth(this.currentHealth);
        }

        // 更新单位信息面板
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                currentHealth: Math.max(0, this.currentHealth),
                maxHealth: this.maxHealth
            });
        }

        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.destroyTower();
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

        // 更新单位信息面板
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth
            });
        }

        // 显示治愈特效（+号）
        if (actualHeal > 0) {
            this.showHealEffect(actualHeal);
        }
    }

    /**
     * 显示治愈特效（+号）
     * @param amount 治愈量
     */
    showHealEffect(amount: number) {
        // 创建+号特效节点
        const healNode = new Node('HealEffect');
        const canvas = find('Canvas');
        if (canvas) {
            healNode.setParent(canvas);
        } else {
            healNode.setParent(this.node.scene);
        }

        // 设置位置（在Tower上方）
        healNode.setWorldPosition(this.node.worldPosition.clone().add3f(0, 30, 0));

        // 添加Label组件显示+号（黑边绿字）
        const label = healNode.addComponent(Label);
        label.string = `+${Math.floor(amount)}`;
        label.fontSize = 20;
        label.color = Color.GREEN;
        const outline = healNode.addComponent(LabelOutline);
        label.outlineColor = new Color(0, 0, 0, 255);
        outline.width = 2;

        // 添加UITransform
        const uiTransform = healNode.addComponent(UITransform);
        uiTransform.setContentSize(40, 30);

        // 动画：向上移动并淡出
        const startPos = healNode.worldPosition.clone();
        const endPos = startPos.clone();
        endPos.y += 30; // 向上移动30像素

        tween(healNode)
            .to(0.5, { 
                worldPosition: endPos,
            }, {
                onUpdate: (target: Node, ratio: number) => {
                    // 淡出效果
                    const label = target.getComponent(Label);
                    if (label) {
                        const alpha = Math.floor(255 * (1 - ratio));
                        label.color = new Color(0, 255, 0, alpha);
                    }
                }
            })
            .call(() => {
                if (healNode && healNode.isValid) {
                    healNode.destroy();
                }
            })
            .start();
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
        
        // 起始位置：在单位上方一点
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
        // 我方单位受伤：统一使用黑边红字，暴击仅在尺寸和感叹号上区分
        label.color = new Color(255, 0, 0, 255);

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

        // 飘动方向：沿攻击方向飘动
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

        // 飘动距离与敌人保持一致（缩短版）
        const floatDistance = isCritical ? 40 : 25;
        const offset = new Vec3();
        Vec3.scaleAndAdd(offset, startPos, floatDir, floatDistance);
        const endWorldPos = offset;

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

    destroyTower() {
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

        // 播放死亡动画
        this.playDeathAnimation();

        // 减少人口
        // 如果buildCost为0，说明是由建筑生产的（WarAncientTree/HunterHall/SwordsmanHall），人口会在对应的cleanupDead方法中处理
        // 如果buildCost不为0，说明是手动建造的（如果有），需要在这里减少人口
        if (!this.gameManager) {
            this.findGameManager();
        }
        if (this.gameManager) {
            // 减少人口
            this.gameManager.removePopulation(1);
        }

        // 移除点击事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onTowerClick, this);

        // 隐藏选择面板（会移除全局触摸监听）
        this.hideSelectionPanel();
        
        // 清除手动移动目标
        this.manualMoveTarget = null!;
        this.isManuallyControlled = false;
        
        // 移除高亮效果
        this.removeHighlight();

        // 性能优化：使用对象池回收单位，而不是直接销毁
        const returnToPool = () => {
            const unitPool = UnitPool.getInstance();
            if (unitPool && this.node && this.node.isValid) {
                // 重置单位状态（在返回对象池前）
                this.resetRoleState();
                // 返回到对象池
                unitPool.release(this.node, this.prefabName);
            } else {
                // 如果对象池不存在，直接销毁
                if (this.node && this.node.isValid) {
                    this.node.destroy();
                }
            }
        };
        
        // 延迟返回对象池，等待死亡动画播放完成
        this.scheduleOnce(() => {
            // 销毁血条节点
            if (this.healthBarNode && this.healthBarNode.isValid) {
                this.healthBarNode.destroy();
            }
            // 返回对象池而不是销毁
            returnToPool();
        }, this.deathAnimationDuration); // 延迟时间与死亡动画时长相同，确保死亡动画完整播放
    }
    
    /**
     * 重置单位状态（用于对象池回收）
     */
    private resetRoleState() {
        
        // 恢复初始属性值（移除所有增幅效果）
        this.maxHealth = this._initialMaxHealth;
        this.attackDamage = this._initialAttackDamage;
        this.attackInterval = this._initialAttackInterval;
        this.moveSpeed = this._initialMoveSpeed;
        
        
        // 重置所有状态变量
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        this.targetFindTimer = 0;
        this.currentTarget = null!;
        this.isHit = false;
        this.isPlayingAttackAnimation = false;
        this.isPlayingHitAnimation = false;
        this.isPlayingDeathAnimation = false;
        this.isPlayingMoveAnimation = false;
        this.isMoving = false;
        this.moveTarget = null!;
        this.manualMoveTarget = null!;
        this.isManuallyControlled = false;
        this.isDefending = false; // 重置防御状态
        this.hasFoundFirstTarget = false;
        this.autoRoamScheduled = false;
        this.autoRoamCallback = null;
        
        // 重置智能避让系统
        this.lastPosition.set(0, 0, 0);
        this.cachedAvoidDirection.set(0, 0, 0);
        this.avoidDirectionTimer = 0;
        this.stuckTimer = 0;
        this.isStuck = false;
        this.waitTimer = 0;
        this.collisionCheckTimer = 0;
        this.lastCollisionResult = false;
        
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
        
        // 移除高亮效果
        this.removeHighlight();
        
        // 移除点击事件监听（会在onEnable中重新添加）
        this.node.off(Node.EventType.TOUCH_END, this.onTowerClick, this);
    }
    
    /**
     * 当单位从对象池激活时调用（用于对象池复用）
     * 从对象池获取的单位会调用此方法，而不是start方法
     */
    onEnable() {

        // 重置增幅标志，让每次从对象池获取时都能重新安排自动上移
        this._enhancementsApplied = false;
        console.log(`[Role.onEnable] ${this.unitName}, _enhancementsApplied=false, wasManuallyControlled=${this.wasManuallyControlled}, autoRoamScheduled=${this.autoRoamScheduled}`);

        // 从对象池获取时，重新初始化状态
        // 注意：sprite等组件引用在start中已经初始化，这里只需要重置状态
        if (this.sprite && this.defaultSpriteFrame) {
            this.sprite.spriteFrame = this.defaultSpriteFrame;
        }
        
        // 重新初始化状态
        this.currentHealth = this.maxHealth;
        this.currentMana = this.maxMana; // 重置蓝量
        this.manaRegenTimer = 0; // 重置蓝量回复计时器
        this.isDestroyed = false;
        this.attackTimer = 0;
        this.targetFindTimer = 0;
        this.currentTarget = null!;
        this.isHit = false;
        this.isPlayingAttackAnimation = false;
        this.isPlayingHitAnimation = false;
        this.isPlayingDeathAnimation = false;
        this.isPlayingMoveAnimation = false;
        this.isMoving = false;
        this.moveTarget = null!;
        this.manualMoveTarget = null!;
        this.isManuallyControlled = false;
        this.isDefending = false; // 重置防御状态
        this.hasFoundFirstTarget = false;

        // 重置手动控制标志
        this.wasManuallyControlled = false;

        // 重置智能避让系统
        this.lastPosition.set(this.node.worldPosition);
        this.cachedAvoidDirection.set(0, 0, 0);
        this.avoidDirectionTimer = 0;
        this.stuckTimer = 0;
        this.isStuck = false;
        this.waitTimer = 0;
        this.collisionCheckTimer = 0;
        this.lastCollisionResult = false;
        
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
        
        // 重新查找单位选择管理器
        this.findUnitSelectionManager();
        
        // 重新创建血条（如果不存在）
        if (!this.healthBarNode || !this.healthBarNode.isValid) {
            this.createHealthBar();
        } else {
            // 如果血条已存在，先更新为当前值（应用增益前）
            if (this.healthBar) {
                this.healthBar.setMaxHealth(this.maxHealth);
                this.healthBar.setHealth(this.currentHealth);
            }
        }
        
        // 检查是否有技能（在应用天赋增幅后检查）
        // 注意：技能检查需要在applyTalentEnhancements之后，因为技能可能通过天赋系统激活
        // 这里先设置一个默认值，子类可以重写checkSkill方法来检查技能
        
        // 重新初始化对话框系统
        this.initDialogSystem();
        
        // 重新监听点击事件
        this.node.on(Node.EventType.TOUCH_END, this.onTowerClick, this);
        
        const unitId = this.getUnitIdForEnhancement();
        
        // 防止重复应用增幅：如果已经应用过，直接返回
        if (this._enhancementsApplied) {
            return;
        }
        
        
        // 清除BuffManager保存的基准值缓存（对象池复用时必须清除）
        const hadCache = !!(this as any)._originalAttackDamage;
        (this as any)._originalAttackDamage = undefined;
        (this as any)._originalAttackInterval = undefined;
        (this as any)._originalMaxHealth = undefined;
        (this as any)._originalMoveSpeed = undefined;
        (this as any)._buffAttackDamagePercent = undefined;
        (this as any)._buffAttackIntervalPercent = undefined;
        (this as any)._buffMaxHealthPercent = undefined;
        (this as any)._buffMoveSpeedPercent = undefined;
        
        // 应用天赋增幅（必须在应用卡片增幅之前）
        this.applyTalentEnhancements();
        
        // 应用已保存的增益效果（会更新maxHealth和currentHealth，并再次更新血条）
        this.applyBuffsFromManager();
        
        // 应用天赋增幅后，如果有技能，创建蓝量条
        if (this.hasSkill) {
            // 如果蓝量条不存在，创建它
            if (!this.manaBarNode || !this.manaBarNode.isValid) {
                this.createManaBar();
            } else {
                // 如果蓝量条已存在，更新为当前值
                if (this.manaBar) {
                    this.manaBar.setMaxMana(this.maxMana);
                    this.manaBar.setMana(this.currentMana);
                }
                this.manaBarNode.active = true;
                // 确保蓝条出现时血条也同时可见
                if (this.healthBarNode && this.healthBarNode.isValid) {
                    this.healthBarNode.active = true;
                }
            }
        } else {
            // 没有技能，隐藏蓝量条
            if (this.manaBarNode && this.manaBarNode.isValid) {
                this.manaBarNode.active = false;
            }
        }
        
        // 出场后6秒：若未设置集结点/未手动下达移动命令，自动向上方 400-500px 的随机位置前进
        // 仅对：弓箭手、女猎手、剑士、牧师、法师 生效（通过单位名判断）
        try {
            const name = (this.unitName || '').trim();
            const eligible =
                name === '弓箭手' ||
                name === '女猎手' ||
                name === '剑士' || name === '精灵剑士' ||
                name === '牧师' ||
                name === '法师';
            if (eligible && !this.autoRoamScheduled) {
                // 若当前已经在较高位置（y >= 500），则不安排自动上移
                const curPos = this.node?.worldPosition;
                if (curPos && curPos.y >= 500) {
                    // 直接跳过自动前移逻辑
                    // 保持 autoRoamScheduled 为 false 以便后续如有需要可重新评估
                } else {
                this.autoRoamScheduled = true;
                this.autoRoamCallback = () => {
                    // 单位仍有效、未被销毁
                    if (!this.node || !this.node.isValid || this.isDestroyed) {
                        return;
                    }
                    // 若已被手动控制过，则取消自动上移
                    if (this.wasManuallyControlled) {
                        console.log(`[Role.autoRoam] ${this.unitName}, wasManuallyControlled=true, 取消自动上移`);
                        return;
                    }
                    // 若在6秒内已经被下达了移动/集结指令（manualMoveTarget 有值或被标记为手动控制），则不干预
                    if (this.manualMoveTarget || this.isManuallyControlled) {
                        return;
                    }
                    // 防御状态下不自动前移
                    if (this.isDefending) {
                        return;
                    }
                    // 若当前已有索敌目标（update 中已处理索敌），则不触发上移
                    if (this.currentTarget) {
                        return;
                    }
                    // 若当前已经在较高位置（y >= 500），则不触发上移
                    const curNow = this.node.worldPosition;
                    if (curNow && curNow.y >= 500) {
                        return;
                    }
                    // 计算上方 400-500 像素的随机位置
                    const dy = 400 + Math.floor(Math.random() * 101); // [400, 500]
                    const cur = this.node.worldPosition;
                    const target = new Vec3(cur.x, cur.y + dy, 0);
                    // 自动上移：直接设置移动目标，不标记 wasManuallyControlled
                    const adjustedPos = this.findAvailableMovePosition(target);
                    this.manualMoveTarget = adjustedPos.clone();
                    this.isManuallyControlled = true;
                    this.currentTarget = null!;
                };
                // 延迟 6 秒执行
                this.scheduleOnce(this.autoRoamCallback, 6.0);
                }
            }
        } catch (e) {
            // ignore
        }

        // 标记增幅已应用
        this._enhancementsApplied = true;
    }

    /**
     * 节点禁用时调用（回收到对象池时）
     * 注意：不在这里重置 _enhancementsApplied，因为在生产过程中可能会多次触发 onDisable/onEnable
     */
    protected onDisable() {
        // 取消自动前移回调
        if (this.autoRoamCallback) {
            try {
                this.unschedule(this.autoRoamCallback);
            } catch (e) {
                // ignore
            }
        }
        // 重置自动上移标志，避免对象池复用时的状态污染
        this.autoRoamScheduled = false;
        this.wasManuallyControlled = false;
    }

    getHealth(): number {
        return this.currentHealth;
    }

    isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }

    protected onTowerClick(event: EventTouch) {
        // 在检查选中区域之前，先保存当前的选中状态
        // 这样可以在"不在选中区域内"时，知道是哪一个单位被选中了
        let previouslySelectedUnit: Node | null = null;
        let previouslySelectedUnits: Node[] = [];
        if (this.unitSelectionManager) {
            previouslySelectedUnit = this.unitSelectionManager.getCurrentSelectedUnit();
            previouslySelectedUnits = [...(this.unitSelectionManager as any).currentSelectedUnits || []];
            // 过滤掉当前单位，看看是否有其他单位被选中
            if (previouslySelectedUnit === this.node) {
                previouslySelectedUnit = null;
            }
            previouslySelectedUnits = previouslySelectedUnits.filter(node => node !== this.node);
        }

        // 如果游戏已结束，不显示信息面板
        if (this.gameManager && this.gameManager.getGameState() !== GameState.Playing) {
            return;
        }

        const touchLocation = event.getLocation();

        // 如果已选中此单位，检查点击是否在选中区域内
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            const touchPos = this.tempVec3_1.set(touchLocation.x, touchLocation.y, 0);
            const camera = this.cachedCamera;
            if (camera && !this.isPointInSelectionArea(touchPos, camera)) {
                // 点击不在选中区域内，不阻止事件冒泡，让 Canvas 的 onGlobalTouchEnd 检测其他单位
// 设置移动目标但不阻止冒泡
                this.setManualMoveTarget(event, true);
                return;
            }
            // 点击在选中区域内，设置移动目标并阻止冒泡
            this.setManualMoveTarget(event);
            return;
        }

        // 首次选中：检查点击是否在 1.5 倍宽 3 倍高的选中区域内
        const camera = this.cachedCamera;
        if (camera) {
            const touchPos = this.tempVec3_1.set(touchLocation.x, touchLocation.y, 0);
            const isInSelectionArea = this.isPointInSelectionArea(touchPos, camera);
if (!isInSelectionArea) {
                // 点击不在当前单位的选中区域内，不阻止事件冒泡，让下方的单位有机会接收事件
                // 检查是否有其他单位被选中（说明用户想控制已选中的单位移动）
                if (previouslySelectedUnit) {
                    // 获取之前选中的单位组件，设置移动目标
                    const prevUnitRole = previouslySelectedUnit.getComponent('Role') as any;
                    if (prevUnitRole && prevUnitRole.setManualMoveTargetPosition) {
                        // 将屏幕坐标转换为世界坐标
                        const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
                        const worldPos = new Vec3();
                        camera.screenToWorld(screenPos, worldPos);
                        worldPos.z = 0;
                        prevUnitRole.setManualMoveTargetPosition(worldPos);
                    }
                    // 不阻止事件冒泡，让 SelectionManager 也能处理（清除选择状态）
                    return;
                }
                if (previouslySelectedUnits.length > 0) {
                    // 不阻止事件冒泡，让 SelectionManager 的 globalTouchHandler 处理移动
                    return;
                }
                // 没有其他单位被选中，不阻止事件冒泡，让下方的单位有机会接收事件
                return;
            }
        }

        // 首次选中此单位，阻止事件冒泡
        event.propagationStopped = true;

        // 显示单位信息面板
        this.showUnitInfoPanel();
    }

    /**
     * 显示单位信息面板（不显示头顶的选择面板）
     */
    showUnitInfoPanel() {
        
        // 显示单位信息面板和范围
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (this.unitSelectionManager) {
            // 计算升级费用：1到2级是10金币，此后每次升级多10金币
            // 公式：10 + (level - 1) * 10
            const upgradeCost = this.level < 3 ? (10 + (this.level - 1) * 10) : undefined;
            
            // 确保生命值有效
            const currentHealth = (this.currentHealth !== undefined && !isNaN(this.currentHealth) && this.currentHealth >= 0) 
                ? this.currentHealth 
                : (this.maxHealth || 0);
            const maxHealth = (this.maxHealth !== undefined && !isNaN(this.maxHealth) && this.maxHealth > 0) 
                ? this.maxHealth 
                : 0;
            
            
            const unitInfo: UnitInfo = {
                name: this.unitName || '角色',
                level: this.level,
                currentHealth: currentHealth,
                maxHealth: maxHealth,
                attackDamage: this.attackDamage,
                populationCost: 1, // Tower占用1个人口
                icon: this.cardIcon || this.defaultSpriteFrame,
                collisionRadius: this.collisionRadius,
                attackRange: this.attackRange,
                attackFrequency: 1.0 / this.attackInterval, // 攻击频率（次/秒）
                moveSpeed: this.moveSpeed,
                isDefending: this.isDefending, // 传递防御状态
                upgradeCost: upgradeCost, // 传递升级费用用于显示
                onUpgradeClick: this.level < 3 ? () => {
                    this.onUpgradeClick();
                } : undefined,
                onSellClick: () => {
                    this.onSellClick();
                },
                onDefendClick: () => {
                    this.onDefendClick();
                }
            };
            this.unitSelectionManager.selectUnit(this.node, unitInfo);
        }

        // 点击其他地方设置移动目标
        const canvas = find('Canvas');
        this.scheduleOnce(() => {
            if (canvas) {
                // 创建全局触摸事件处理器
                this.globalTouchHandler = (event: EventTouch) => {

                    // 检查当前单位是否仍被选中
                    // 注意：globalTouchHandler只有在单位被选中时才会注册
                    // 但如果选中状态在onGlobalTouchEnd中被清除，这里检查可能返回false
                    // 所以我们需要检查：如果getCurrentSelectedUnit()不为null且不是当前单位，说明选中了其他单位，应该移除监听器
                    if (this.unitSelectionManager) {
                        const currentSelectedUnit = this.unitSelectionManager.getCurrentSelectedUnit();
                        const isSelected = this.unitSelectionManager.isUnitSelected(this.node);

                        // 如果选中了其他单位（不是当前单位），移除监听器
                        if (currentSelectedUnit !== null && currentSelectedUnit !== this.node) {
                            const canvas = find('Canvas');
                            if (canvas && this.globalTouchHandler) {
                                canvas.off(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
                            }
                            this.globalTouchHandler = null!;
                            return;
                        }
                        
                        // 如果当前单位未被选中，也不执行移动操作
                        // 或者如果没有任何选中（currentSelectedUnit为null），也不执行移动操作
                        if (!isSelected || currentSelectedUnit === null) {
                            const canvas = find('Canvas');
                            if (canvas && this.globalTouchHandler) {
                                canvas.off(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
                            }
                            this.globalTouchHandler = null!;
                            return;
                        }
                    }
                    
                    // 检查点击是否在信息面板上（通过节点名称和路径检查）
                    const targetNode = event.target as Node;
                    if (targetNode) {
                        // 检查目标节点或其父节点是否是信息面板
                        let currentNode: Node | null = targetNode;
                        while (currentNode) {
                            // 检查节点名称是否包含 UnitInfoPanel（信息面板的节点名称）
                            if (currentNode.name === 'UnitInfoPanel' || currentNode.name.includes('UnitInfoPanel')) {
                                // 点击在信息面板上，不设置移动目标
                                return;
                            }
                            // 检查节点的路径是否包含 UnitInfoPanel
                            const nodePath = currentNode.getPathInHierarchy();
                            if (nodePath && nodePath.includes('UnitInfoPanel')) {
                                // 点击在信息面板上，不设置移动目标
                                return;
                            }
                            currentNode = currentNode.parent;
                            // 如果到达根节点，停止检查
                            if (!currentNode) {
                                break;
                            }
                        }
                    }

                    // 点击不在信息面板上，设置移动目标
                    this.setManualMoveTarget(event);
                };
                
                canvas.on(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
            }
        }, 0.1);
    }

    /**
     * 设置手动移动目标位置（用于多选移动）
     * @param worldPos 世界坐标位置
     */
    setManualMoveTargetPosition(worldPos: Vec3) {
        // 智能调整目标位置，避免与单位重叠
        const adjustedPos = this.findAvailableMovePosition(worldPos);

        // 设置手动移动目标
        this.manualMoveTarget = adjustedPos.clone();
        this.isManuallyControlled = true;

        // 清除当前自动寻敌目标，优先执行手动移动
        this.currentTarget = null!;
    }

    /**
     * 设置手动移动目标（用于单选移动）
     * @param event 触摸事件
     */

    /**
     * 检查点是否在单位碰撞半径内（添加于 2026/04/08，性能优化点 2）
     * @param touchLocation 触摸位置（屏幕坐标）
     * @param camera 相机组件
     * @returns 是否在碰撞半径内
     */
    protected isPointInCollisionRadius(touchLocation: Vec3, camera: Camera): boolean {
        const unitWorldPos = this.node.worldPosition;
        const unitScreenPos = new Vec3();
        camera.worldToScreen(unitWorldPos, unitScreenPos);

        // 将世界坐标的碰撞半径转换为屏幕坐标
        const testWorldPos = new Vec3(unitWorldPos.x + this.collisionRadius, unitWorldPos.y, unitWorldPos.z);
        const testScreenPos = new Vec3();
        camera.worldToScreen(testWorldPos, testScreenPos);
        const collisionRadiusScreen = Math.abs(testScreenPos.x - unitScreenPos.x);

        const dx = touchLocation.x - unitScreenPos.x;
        const dy = touchLocation.y - unitScreenPos.y;
        const distanceToUnit = Math.sqrt(dx * dx + dy * dy);

        return distanceToUnit <= collisionRadiusScreen;
    }

    /**
     * 检查点是否在单位选中区域内（1.5 倍宽 3 倍高矩形区域）
     * @param touchLocation 触摸位置（屏幕坐标）
     * @param camera 相机组件
     * @returns 是否在选中区域内
     */
    protected isPointInSelectionArea(touchLocation: Vec3, camera: Camera): boolean {
        const unitWorldPos = this.node.worldPosition;
        const unitScreenPos = new Vec3();
        camera.worldToScreen(unitWorldPos, unitScreenPos);

        // 将世界坐标的碰撞半径转换为屏幕坐标
        const testWorldPos = new Vec3(unitWorldPos.x + this.collisionRadius, unitWorldPos.y, unitWorldPos.z);
        const testScreenPos = new Vec3();
        camera.worldToScreen(testWorldPos, testScreenPos);
        const collisionRadiusScreen = Math.abs(testScreenPos.x - unitScreenPos.x);

        // 选中区域：宽度 = 1.5 * 碰撞半径，高度 = 3 * 碰撞半径
        const selectionHalfWidth = collisionRadiusScreen * 1.5;
        const selectionHalfHeight = collisionRadiusScreen * 3;

        const dx = Math.abs(touchLocation.x - unitScreenPos.x);
        const dy = Math.abs(touchLocation.y - unitScreenPos.y);

        return dx <= selectionHalfWidth && dy <= selectionHalfHeight;
    }

    setManualMoveTarget(event: EventTouch, shouldPropagate = false) {
        // 获取触摸位置
        const touchLocation = event.getLocation();

        // 检查点击是否在单位碰撞体积内（添加于 2026/04/08）
        // 使用公共方法检测碰撞（性能优化点 2）
        const camera = this.cachedCamera;
        if (camera) {
            // event.getLocation() 返回 Vec2，需要转换为 Vec3
            const touchPos = this.tempVec3_1.set(touchLocation.x, touchLocation.y, 0);
            if (this.isPointInCollisionRadius(touchPos, camera)) {
                return;
            }
        }

        // 阻止事件冒泡，避免触发其他点击事件（除非 shouldPropagate 为 true）
        if (!shouldPropagate) {
            event.propagationStopped = true;
        }

        // 使用缓存的 Camera（已在 start 中初始化）
        if (!this.cachedCamera) {
            // 如果缓存为空，尝试重新查找
            const cameraNode = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
            this.cachedCamera = cameraNode?.getComponent(Camera) || null;
        }
        if (!this.cachedCamera) {
            return;
        }
        // 将屏幕坐标转换为世界坐标
        const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
        const worldPos = new Vec3();
        this.cachedCamera.screenToWorld(screenPos, worldPos);
        worldPos.z = 0;
        
        // 标记为已被手动控制过（取消自动上移）
        this.wasManuallyControlled = true;
        console.log(`[Role.setManualMoveTarget] ${this.unitName}, wasManuallyControlled=true`);
        
        // 使用setManualMoveTargetPosition方法设置移动目标
        this.setManualMoveTargetPosition(worldPos);
        
        // 隐藏选择面板（这会移除全局触摸监听，确保只有一次控制机会）
        this.hideSelectionPanel();
        
        // 清除选中状态（只有当前单位被选中时才清除选择）
        if (this.unitSelectionManager) {
            const isSelected = this.unitSelectionManager.isUnitSelected(this.node);
            if (isSelected) {
                this.unitSelectionManager.clearSelection();
            } else {
                // 单位未被选中，不应该执行移动操作，直接返回
                return;
            }
        } else {
            // 如果没有unitSelectionManager，也不应该执行移动操作
            return;
        }
    }

    findAvailableMovePosition(initialPos: Vec3): Vec3 {
        const checkRadius = this.collisionRadius;
        const offsetStep = 40; // 每次平移的距离
        const maxAttempts = 5; // 最多尝试5次（左右各2次）

        // 检查初始位置是否可用
        if (!this.hasUnitAtMovePosition(initialPos, checkRadius)) {
            return initialPos;
        }

        // 尝试左右平移
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // 先尝试右侧
            const rightPos = new Vec3(initialPos.x + offsetStep * attempt, initialPos.y, initialPos.z);
            if (!this.hasUnitAtMovePosition(rightPos, checkRadius)) {
                return rightPos;
            }

            // 再尝试左侧
            const leftPos = new Vec3(initialPos.x - offsetStep * attempt, initialPos.y, initialPos.z);
            if (!this.hasUnitAtMovePosition(leftPos, checkRadius)) {
                return leftPos;
            }
        }

        // 如果所有位置都被占用，返回初始位置（让Tower自己处理碰撞）
        return initialPos;
    }

    hasUnitAtMovePosition(position: Vec3, radius: number): boolean {
        // 检查与水晶的碰撞
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

        const crystal = find('Crystal');
        if (!crystal && this.node.scene) {
            const scene = this.node.scene;
            const foundCrystal = findNodeRecursive(scene, 'Crystal');
            if (foundCrystal && foundCrystal.isValid && foundCrystal.active) {
                const crystalPos = foundCrystal.worldPosition;
                const dx = position.x - crystalPos.x;
                const dy = position.y - crystalPos.y;
                const distanceSq = dx * dx + dy * dy;
                const crystalRadius = 50;
                const minDistance = radius + crystalRadius;
                const minDistanceSq = minDistance * minDistance;
                if (distanceSq < minDistanceSq) {
                    return true;
                }
            }
        } else if (crystal && crystal.isValid && crystal.active) {
            const crystalPos = crystal.worldPosition;
            const dx = position.x - crystalPos.x;
            const dy = position.y - crystalPos.y;
            const distanceSq = dx * dx + dy * dy;
            const crystalRadius = 50;
            const minDistance = radius + crystalRadius;
            const minDistanceSq = minDistance * minDistance;
            if (distanceSq < minDistanceSq) {
                return true;
            }
        }

        // 检查与其他Tower的碰撞
        const towersNode = find('Canvas/Towers');
        
        if (towersNode) {
            const towers = towersNode.children || [];
            for (const tower of towers) {
                if (tower && tower.isValid && tower.active && tower !== this.node) {
                    let towerScript = tower.getComponent('Role') as any;
                    if (!towerScript) {
                        // 向后兼容，尝试获取Arrower
                        towerScript = tower.getComponent('Arrower') as any;
                    }
                    if (towerScript && towerScript.isAlive && towerScript.isAlive()) {
                        const towerPos = tower.worldPosition;
                        const dx = position.x - towerPos.x;
                        const dy = position.y - towerPos.y;
                        const distanceSq = dx * dx + dy * dy;
                        const otherRadius = towerScript.collisionRadius || radius;
                        const minDistance = radius + otherRadius;
                        const minDistanceSq = minDistance * minDistance;
                        if (distanceSq < minDistanceSq) {
                            return true;
                        }
                    }
                }
            }
        }

        // 检查与女猎手的碰撞
        let huntersNode = find('Hunters');
        if (!huntersNode && this.node.scene) {
            huntersNode = findNodeRecursive(this.node.scene, 'Hunters');
        }
        
        if (huntersNode) {
            const hunters = huntersNode.children || [];
            for (const hunter of hunters) {
                if (hunter && hunter.isValid && hunter.active && hunter !== this.node) {
                    const hunterScript = hunter.getComponent('Role') as any;
                    if (hunterScript && hunterScript.isAlive && hunterScript.isAlive()) {
                        const hunterPos = hunter.worldPosition;
                        const dx = position.x - hunterPos.x;
                        const dy = position.y - hunterPos.y;
                        const distanceSq = dx * dx + dy * dy;
                        const otherRadius = hunterScript.collisionRadius || radius;
                        const minDistance = radius + otherRadius;
                        const minDistanceSq = minDistance * minDistance;
                        if (distanceSq < minDistanceSq) {
                            return true;
                        }
                    }
                }
            }
        }

        // 检查与战争古树的碰撞
        let treesNode = find('WarAncientTrees');
        if (!treesNode && this.node.scene) {
            treesNode = findNodeRecursive(this.node.scene, 'WarAncientTrees');
        }
        
        if (treesNode) {
            const trees = treesNode.children || [];
            for (const tree of trees) {
                if (tree && tree.isValid && tree.active) {
                    const treeScript = tree.getComponent('WarAncientTree') as any;
                    if (treeScript && treeScript.isAlive && treeScript.isAlive()) {
                        const treePos = tree.worldPosition;
                        const dx = position.x - treePos.x;
                        const dy = position.y - treePos.y;
                        const distanceSq = dx * dx + dy * dy;
                        const treeRadius = 50; // 战争古树的半径
                        const minDistance = radius + treeRadius;
                        const minDistanceSq = minDistance * minDistance;
                        if (distanceSq < minDistanceSq) {
                            return true;
                        }
                    }
                }
            }
        }

        // 检查与敌人的碰撞 - 使用公共敌人获取函数，使用平方距离
        const enemies = this.getEnemies(true, radius * 2);
        for (const enemy of enemies) {
            if (enemy && enemy.isValid && enemy.active) {
                const enemyPos = enemy.worldPosition;
                const dx = position.x - enemyPos.x;
                const dy = position.y - enemyPos.y;
                const distanceSq = dx * dx + dy * dy;
                const enemyRadius = 30;
                const minDistance = radius + enemyRadius;
                const minDistanceSq = minDistance * minDistance;
                if (distanceSq < minDistanceSq) {
                    return true;
                }
            }
        }

        return false;
    }

    hideSelectionPanel() {
        // 移除全局触摸事件监听
        if (this.globalTouchHandler) {
            const canvas = find('Canvas');
            if (canvas) {
                canvas.off(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
            }
            this.globalTouchHandler = null!;
        } else {
        }

        // 清除单位信息面板和范围显示
        if (this.unitSelectionManager) {
            // 检查是否当前选中的是这个单位
            if (this.unitSelectionManager.isUnitSelected(this.node)) {
                this.unitSelectionManager.clearSelection();
            } else {
            }
        }
        
        // 注意：不清除手动移动目标，让防御单位继续移动到目标位置
        // 只有在到达目标位置后才会清除
    }

    onSellClick(event?: EventTouch) {
        if (event) {
            event.propagationStopped = true;
        }
        
        if (!this.gameManager) {
            this.findGameManager();
        }

        if (this.gameManager) {
            // 回收80%金币
            const refund = Math.floor(this.buildCost * 0.8);
            this.gameManager.addGold(refund);
        }

        // 隐藏面板
        this.hideSelectionPanel();
        
        // 销毁弓箭手（会真正从场景中移除）
        this.destroyTower();
    }

    onUpgradeClick(event?: EventTouch) {
        if (event) {
            event.propagationStopped = true;
        }
        
        // 限制最高等级为3级
        if (this.level >= 3) {
            // 已经是最高等级，不再升级（可以在这里添加提示）
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
            // 确保生命值有效
            const currentHealth = (this.currentHealth !== undefined && !isNaN(this.currentHealth)) ? this.currentHealth : (this.maxHealth || 0);
            const maxHealth = (this.maxHealth !== undefined && !isNaN(this.maxHealth) && this.maxHealth > 0) ? this.maxHealth : 0;
            
            this.unitSelectionManager.updateUnitInfo({
                level: this.level,
                attackDamage: this.attackDamage,
                currentHealth: currentHealth,
                maxHealth: maxHealth,
                attackFrequency: 1.0 / this.attackInterval,
                moveSpeed: this.moveSpeed
            });
        }

        // 隐藏面板
        this.hideSelectionPanel();
    }

    /**
     * 防御按钮点击事件
     */
    onDefendClick(event?: EventTouch) {
        if (event) {
            event.propagationStopped = true;
        }
        
        // 切换防御状态
        this.isDefending = !this.isDefending;
        
        if (this.isDefending) {
            // 如果进入防御状态，清除手动移动目标并停止移动
            this.manualMoveTarget = null!;
            this.isManuallyControlled = false;
            this.stopMoving();
        } else {
            // 如果取消防御状态，清除手动移动目标，让单位进入正常索敌模式
            this.manualMoveTarget = null!;
            this.isManuallyControlled = false;
        }
        
        // 更新单位信息面板（刷新按钮显示）
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            // 确保生命值有效
            const currentHealth = (this.currentHealth !== undefined && !isNaN(this.currentHealth) && this.currentHealth >= 0) 
                ? this.currentHealth 
                : (this.maxHealth || 0);
            const maxHealth = (this.maxHealth !== undefined && !isNaN(this.maxHealth) && this.maxHealth > 0) 
                ? this.maxHealth 
                : 0;
            
            // 通过重新显示单位信息来刷新按钮状态
            const unitInfo: UnitInfo = {
                name: this.unitName || '角色',
                level: this.level,
                currentHealth: currentHealth,
                maxHealth: maxHealth,
                attackDamage: this.attackDamage,
                populationCost: 1,
                icon: this.cardIcon || this.defaultSpriteFrame,
                collisionRadius: this.collisionRadius,
                attackRange: this.attackRange,
                attackFrequency: 1.0 / this.attackInterval,
                moveSpeed: this.moveSpeed,
                isDefending: this.isDefending, // 传递防御状态
                upgradeCost: this.level < 3 ? (10 + (this.level - 1) * 10) : undefined, // 传递升级费用用于显示
                onUpgradeClick: this.level < 3 ? () => {
                    this.onUpgradeClick();
                } : undefined,
                onSellClick: () => {
                    this.onSellClick();
                },
                onDefendClick: () => {
                    this.onDefendClick();
                }
            };
            this.unitSelectionManager.selectUnit(this.node, unitInfo);
        }
    }

    /**
     * 设置高亮显示
     * @param highlight 是否高亮
     */
    setHighlight(highlight: boolean) {
        if (this.isHighlighted === highlight) {
            return; // 状态相同，不需要更新
        }

        this.isHighlighted = highlight;

        if (highlight) {
            // 创建高亮效果
            this.createHighlight();
        } else {
            // 移除高亮效果
            this.removeHighlight();
        }
    }

    /**
     * 创建高亮效果
     */
    createHighlight() {
        if (this.highlightNode && this.highlightNode.isValid) {
            return; // 已经存在高亮节点
        }

        // 创建高亮节点
        this.highlightNode = new Node('Highlight');
        this.highlightNode.setParent(this.node);
        this.highlightNode.setPosition(0, 0, 0);

        // 添加Graphics组件绘制高亮边框
        const graphics = this.highlightNode.addComponent(Graphics);
        graphics.strokeColor.set(100, 200, 255, 255); // 亮蓝色边框
        graphics.lineWidth = 3;

        // 绘制圆形高亮边框（根据防御单位的碰撞半径）
        const radius = this.collisionRadius + 5; // 稍微大一点
        graphics.circle(0, 0, radius);
        graphics.stroke();

        // 添加半透明填充
        graphics.fillColor.set(100, 200, 255, 50); // 半透明蓝色
        graphics.circle(0, 0, radius);
        graphics.fill();
    }

    /**
     * 移除高亮效果
     */
    removeHighlight() {
        if (this.highlightNode && this.highlightNode.isValid) {
            this.highlightNode.destroy();
            this.highlightNode = null!;
        }
    }

    /**
     * 获取是否高亮
     */
    getIsHighlighted(): boolean {
        return this.isHighlighted;
    }
    
    /**
     * 记录伤害到统计系统
     * @param damage 伤害值
     */
    protected recordDamageToStatistics(damage: number) {
        if (damage <= 0) {
            return;
        }
        
        try {
            const damageStats = DamageStatistics.getInstance();
            const unitTypeNameMap = DamageStatistics.getUnitTypeNameMap();
            // 优先使用 this.unitName，避免 constructor.name 在代码压缩后变成单个字母（如 't'）
            let unitType = this.constructor.name; // 获取类名（如 'WatchTower', 'Arrower' 等）
            let unitName: string;
            
            // 优先使用 this.unitName（在编辑器中已设置）
            if (this.unitName && this.unitName.trim() !== '') {
                unitName = this.unitName;
            } else {
                // 如果 this.unitName 为空，尝试从映射表获取
                unitName = unitTypeNameMap.get(unitType) || unitType;
            }
            
            // 剑士：把受到的伤害记为"承伤贡献"
            // 判断是否为剑士：通过 unitName 或 unitType
            if (unitName === '剑士' || unitType === 'ElfSwordsman') {
                damageStats.recordDamageTaken(unitType, unitName, damage);
            }
            // 其它单位：正常按输出伤害统计
            else {
                damageStats.recordDamage(unitType, unitName, damage);
            }
        } catch (error) {
            // 忽略错误，避免影响游戏流程
            console.warn('[Role] 记录伤害统计失败:', error);
        }
    }
    
    /**
     * 从增益管理器应用增益效果（新训练的单位会调用此方法）
     */
    protected applyBuffsFromManager() {
        const buffManager = BuffManager.getInstance();
        const unitId = this.getUnitIdForEnhancement(); // 使用稳定的单位ID（优先 prefabName）
        
        
        // 应用增益
        buffManager.applyBuffsToUnit(this, unitId);
        
        
        // 应用增益后，强制更新血条显示
        if (this.healthBar && this.healthBar.isValid) {
            this.healthBar.setMaxHealth(this.maxHealth);
            this.healthBar.setHealth(this.currentHealth);
        }
        
        // 如果单位被选中，更新单位信息面板
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                attackDamage: this.attackDamage,
                attackFrequency: 1.0 / this.attackInterval,
                moveSpeed: this.moveSpeed,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth
            });
        }
    }
}

