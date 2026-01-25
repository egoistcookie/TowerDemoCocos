import { _decorator, Component, Node, Vec3, tween, Sprite, find, Prefab, instantiate, Label, Color, SpriteFrame, UITransform, AudioClip, Animation, AnimationState, view } from 'cc';
import { GameManager, GameState } from '../GameManager';
import { HealthBar } from '../HealthBar';
import { DamageNumber } from '../DamageNumber';
import { AudioManager } from '../AudioManager';
import { UnitType } from '../role/WarAncientTree';
import { EnemyPool } from '../EnemyPool';
import { UnitManager } from '../UnitManager';
const { ccclass, property } = _decorator;

@ccclass('OrcWarlord')
export class OrcWarlord extends Component {
    @property
    maxHealth: number = 100;

    @property
    moveSpeed: number = 30;

    @property
    attackDamage: number = 15;

    @property
    attackInterval: number = 2.0;

    @property
    attackRange: number = 70;

    @property
    collisionRadius: number = 10; // 碰撞半径（像素）

    @property({
        tooltip: "韧性（0-1）：1秒内遭受此百分比血量损失才会触发僵直。0表示没有抗性（受到攻击就会播放受击动画），1表示最大抗性（需要100%血量损失才触发僵直）"
    })
    tenacity: number = 0.3; // 韧性，默认0.3表示需要30%血量损失才触发僵直

    @property(Node)
    targetCrystal: Node = null!;

    @property(Prefab)
    damageNumberPrefab: Prefab = null!;

    // 单位类型
    public unitType: UnitType = UnitType.ENEMY;
    
    // 单位信息属性
    @property
    unitName: string = "兽人督军";
    
    @property
    unitDescription: string = "兽人军队的首领，拥有强大的攻击力和生命值，还能释放战争咆哮增强周围敌人。";
    
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

    // 动画时长属性
    @property
    idleAnimationDuration: number = 1.0; // 待机动画总时长
    
    @property
    walkAnimationDuration: number = 1.0; // 行走动画总时长
    
    @property
    attackAnimationDuration: number = 0.8; // 攻击动画总时长
    
    @property
    hitAnimationDuration: number = 0.3; // 被攻击动画总时长
    
    @property
    deathAnimationDuration: number = 1.0; // 死亡动画总时长

    private currentHealth: number = 100;
    private healthBar: HealthBar = null!;
    private healthBarNode: Node = null!;
    private isDestroyed: boolean = false;
    private attackTimer: number = 0;
    private currentTarget: Node = null!;
    private gameManager: GameManager = null!;
    private unitManager: UnitManager = null!;
    
    @property
    goldReward: number = 5; // 消灭敌人获得的金币
    
    @property
    expReward: number = 10; // 消灭兽人督军获得10点经验值
    
    @property(AudioClip)
    deathSound: AudioClip = null!; // 敌人死亡音效
    
    @property(AudioClip)
    attackSound: AudioClip = null!; // 敌人攻击音效
    
    // 动画相关私有属性
    private sprite: Sprite = null!;
    private uiTransform: UITransform = null!;
    private currentAnimationFrameIndex: number = 0;
    private animationTimer: number = 0;
    private isPlayingIdleAnimation: boolean = false;
    private isPlayingWalkAnimation: boolean = false;
    private isPlayingAttackAnimation: boolean = false;
    private isPlayingHitAnimation: boolean = false;
    private isPlayingDeathAnimation: boolean = false;
    private defaultSpriteFrame: SpriteFrame = null!;
    private defaultScale: Vec3 = new Vec3(1, 1, 1); // 默认缩放比例，用于方向翻转
    private isHit: boolean = false; // 表示敌人是否正在被攻击
    private attackComplete: boolean = false; // 攻击动画是否完成
    
    // 伤害计算相关属性
    private recentDamage: number = 0; // 最近1秒内受到的总伤害
    private damageTime: number = 0; // 最近一次伤害的时间戳
    private lastStaggerTime: number = -1; // 上次产生僵直的时间戳（-1表示从未产生过僵直）

    // 战争咆哮技能属性
    @property
    warcryCooldown: number = 30; // 战争咆哮冷却时间（秒）
    @property
    warcryDuration: number = 10; // 战争咆哮持续时间（秒）
    @property
    warcryEffect: number = 0.25; // 战争咆哮效果提升幅度（25%）
    @property
    warcryRange: number = 200; // 战争咆哮范围（像素）
    @property(AudioClip)
    warcrySound: AudioClip = null!; // 战争咆哮音效
    @property(SpriteFrame)
    warcryAnimationFrames: SpriteFrame[] = []; // 战争咆哮动画帧
    @property
    warcryAnimationDuration: number = 1.0; // 战争咆哮动画时长
    
    // 战争咆哮私有属性
    private warcryTimer: number = 0; // 战争咆哮冷却计时器
    private isPlayingWarcryAnimation: boolean = false; // 是否正在播放战争咆哮动画
    private warcryBuffedEnemies: Set<Node> = new Set(); // 被战争咆哮影响的敌人集合
    private warcryBuffEndTime: Map<Node, number> = new Map(); // 每个敌人的buff结束时间
    private wasPlayingAttackBeforeWarcry: boolean = false; // 战争咆哮前是否正在攻击（用于战争咆哮完成后重新开始攻击）
    
    // 对象池相关：预制体名称（用于对象池回收）
    public prefabName: string = "OrcWarlord";

    onEnable() {
        // 清理所有插在身上的武器（箭矢、长矛等）
        this.clearAttachedWeapons();
        
        // 从对象池获取时，重新初始化状态
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        this.attackComplete = false;
        this.warcryTimer = 0;
        this.recentDamage = 0;
        this.damageTime = 0;
        this.lastStaggerTime = -1; // 重置僵直时间
        this.isPlayingWarcryAnimation = false;
        this.warcryBuffedEnemies.clear();
        this.warcryBuffEndTime.clear();
        this.wasPlayingAttackBeforeWarcry = false;
        this.isHit = false;
        this.isPlayingAttackAnimation = false;
        this.isPlayingHitAnimation = false;
        this.isPlayingDeathAnimation = false;
        this.isPlayingIdleAnimation = false;
        this.isPlayingWalkAnimation = false;
        this.currentTarget = null!;
        
        // 重置动画
        this.currentAnimationFrameIndex = 0;
        this.animationTimer = 0;
        
        // 初始化动画相关属性（如果还没有初始化）
        if (!this.sprite) {
            this.sprite = this.node.getComponent(Sprite);
        }
        if (!this.uiTransform) {
            this.uiTransform = this.node.getComponent(UITransform);
        }
        
        if (this.sprite) {
            if (!this.defaultSpriteFrame) {
                this.defaultSpriteFrame = this.sprite.spriteFrame;
            }
            this.sprite.spriteFrame = this.defaultSpriteFrame;
            // 设置Sprite的sizeMode为CUSTOM，以便适配UITransform大小
            this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        
        // 保存默认缩放比例
        if (!this.defaultScale) {
            this.defaultScale = this.node.scale.clone();
        }
        
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
        
        // 查找游戏管理器
        this.findGameManager();
        
        // 查找单位管理器（性能优化）
        this.unitManager = UnitManager.getInstance();
        
        // 如果targetCrystal没有设置，尝试查找
        if (!this.targetCrystal || !this.targetCrystal.isValid) {
            let crystalNode = find('Crystal');
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
        
        // 重新创建血条（如果不存在）
        if (!this.healthBarNode || !this.healthBarNode.isValid) {
            this.createHealthBar();
        } else {
            // 如果血条已存在，更新血条状态
            if (this.healthBar) {
                this.healthBar.setMaxHealth(this.maxHealth);
                this.healthBar.setHealth(this.currentHealth);
            }
        }
        
        // 初始播放待机动画
        this.playIdleAnimation();
    }

    start() {
        // start 方法只在首次创建时调用，onEnable 会在每次从对象池获取时调用
        // 如果 onEnable 已经初始化了，这里就不需要重复初始化
        if (!this.defaultScale) {
            this.defaultScale = this.node.scale.clone();
        }
        
        if (!this.sprite) {
            this.sprite = this.node.getComponent(Sprite);
        }
        if (!this.uiTransform) {
            this.uiTransform = this.node.getComponent(UITransform);
        }
        
        if (this.sprite && !this.defaultSpriteFrame) {
            this.defaultSpriteFrame = this.sprite.spriteFrame;
            this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        
        // 查找游戏管理器
        this.findGameManager();
        
        // 如果targetCrystal没有设置，尝试查找
        if (!this.targetCrystal) {
            let crystalNode = find('Crystal');
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
        
        // 创建血条（如果不存在）
        if (!this.healthBarNode || !this.healthBarNode.isValid) {
            this.createHealthBar();
        }
        
        // 初始播放待机动画
        this.playIdleAnimation();
    }

    createHealthBar() {
        // 创建血条节点
        this.healthBarNode = new Node('HealthBar');
        this.healthBarNode.setParent(this.node);
        this.healthBarNode.setPosition(0, 40, 0); // 在敌人上方
        
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
            if (this.gameManager) {
                return;
            }
        }
        
    }

    update(deltaTime: number) {
        // 如果被销毁，只更新动画，不执行其他逻辑
        if (this.isDestroyed) {
            this.updateAnimation(deltaTime);
            return;
        }

        // 检查游戏状态 - 如果GameManager不存在，尝试重新查找
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        // 检查游戏状态，只在Playing状态下运行
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                // 游戏已结束或暂停，停止所有行动
                this.stopMoving();
                this.currentTarget = null!;
                return;
            }
        }

        // 更新攻击计时器（如果正在播放攻击动画或战争咆哮动画，不累积，等待动画完成）
        if (!this.isPlayingAttackAnimation && !this.isPlayingWarcryAnimation) {
            this.attackTimer += deltaTime;
        } else {
            // 攻击动画或战争咆哮动画播放中，不累积attackTimer，避免重复触发攻击
            if (this.isPlayingAttackAnimation) {
            }
        }
        
        // 更新战争咆哮冷却计时器（如果正在播放战争咆哮动画，不累积）
        if (!this.isPlayingWarcryAnimation) {
            this.warcryTimer += deltaTime;
        }
        
        // 检查是否可以释放战争咆哮
        if (this.warcryTimer >= this.warcryCooldown && !this.isHit && !this.isPlayingWarcryAnimation) {
            this.playWarcryAnimation();
        }
        
        // 更新战争咆哮buff状态
        this.updateWarcryBuffs(deltaTime);
        
        // 重置最近1秒外的伤害
        if (this.damageTime > 0 && this.attackTimer - this.damageTime > 1.0) {
            this.recentDamage = 0;
        }

        // 查找目标（优先防御塔，然后水晶）
        // 如果正在播放攻击动画，不查找新目标，保持当前目标不变（除非当前目标已无效）
        if (!this.isPlayingAttackAnimation) {
            this.findTarget();
        } else {
            // 正在攻击动画中，只检查当前目标是否仍然有效
            if (this.currentTarget && (!this.currentTarget.isValid || !this.currentTarget.active)) {
                // 当前目标已无效，清除目标
                this.currentTarget = null!;
            } else if (this.currentTarget) {
                // 检查当前目标是否仍然存活
                const towerScript = this.currentTarget.getComponent('Arrower') as any;
                const warAncientTreeScript = this.currentTarget.getComponent('WarAncientTree') as any;
                const hallScript = this.currentTarget.getComponent('HunterHall') as any;
                const swordsmanHallScript = this.currentTarget.getComponent('SwordsmanHall') as any;
                const crystalScript = this.currentTarget.getComponent('Crystal') as any;
                const hunterScript = this.currentTarget.getComponent('Hunter') as any;
                const elfSwordsmanScript = this.currentTarget.getComponent('ElfSwordsman') as any;
                const priestScript = this.currentTarget.getComponent('Priest') as any;
                const stoneWallScript = this.currentTarget.getComponent('StoneWall') as any;
                const targetScript = towerScript || warAncientTreeScript || hallScript || swordsmanHallScript || priestScript || crystalScript || hunterScript || elfSwordsmanScript || stoneWallScript;
                
                if (targetScript && targetScript.isAlive && !targetScript.isAlive()) {
                    // 当前目标已被摧毁，清除目标
                    this.currentTarget = null!;
                }
            }
        }

        if (this.currentTarget) {
            const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
            
            // 如果正在播放攻击动画，不进行距离检查和移动，让攻击动画完成
            if (this.isPlayingAttackAnimation) {
                // 攻击动画播放中，停止移动
                this.stopMoving();
            } else if (distance <= this.attackRange) {
                // 在攻击范围内，停止移动并攻击
                // 如果正在播放攻击动画，不调用stopMoving，避免重置动画状态
                if (!this.isPlayingAttackAnimation) {
                    this.stopMoving();
                }
                if (this.attackTimer >= this.attackInterval && !this.isHit && !this.isPlayingWarcryAnimation && !this.isPlayingAttackAnimation) {
                    // 先重置attackTimer，避免重复触发
                    this.attackTimer = 0;
                    // 然后调用attack()
                    this.attack();
                }
            } else {
                // 不在攻击范围内，只有在没有被攻击时才继续移动
                if (!this.isHit && !this.isPlayingWarcryAnimation) {
                    this.moveTowardsTarget(deltaTime);
                }
            }
        } else {
            // 没有目标，只有在没有被攻击时才向水晶移动
            // 如果正在播放攻击动画，不移动，让攻击动画完成
            if (this.isPlayingAttackAnimation) {
                this.stopMoving();
            } else if (this.targetCrystal && this.targetCrystal.isValid && !this.isHit && !this.isPlayingWarcryAnimation) {
                this.moveTowardsCrystal(deltaTime);
            }
        }
        
        // 更新动画
        this.updateAnimation(deltaTime);
    }

    findTarget() {
        // 索敌范围：200像素
        const detectionRange = 200;
        
        // 优先查找附近的防御塔和战争古树（在攻击范围内）
        // 性能优化：从UnitManager获取建筑物列表，不再使用递归查找
        let towers: Node[] = [];
        let trees: Node[] = [];
        let halls: Node[] = [];
        
        if (this.unitManager) {
            towers = this.unitManager.getTowers();
            trees = this.unitManager.getWarAncientTrees();
            halls = this.unitManager.getBuildings().filter(building => {
                const hallScript = building.getComponent('HunterHall') as any;
                return hallScript && hallScript.isAlive && hallScript.isAlive();
            });
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
        const blockedStoneWall = this.checkPathBlockedByStoneWall();
        if (blockedStoneWall) {
            const distance = Vec3.distance(this.node.worldPosition, blockedStoneWall.worldPosition);
            if (distance <= detectionRange) {
                // 如果石墙在检测范围内，且优先级更高或距离更近
                if (PRIORITY.STONEWALL < targetPriority || 
                    (PRIORITY.STONEWALL === targetPriority && distance < minDistance)) {
                    minDistance = distance;
                    nearestTarget = blockedStoneWall;
                    targetPriority = PRIORITY.STONEWALL;
                }
            }
        }

        // 3. 查找范围内的角色（优先级第三）
        // 4. 查找范围内的角色（优先级第四）
        // 查找所有角色单位：弓箭手、女猎手、牧师
        // 1) 弓箭手和牧师（都在Towers容器中）
        for (const tower of towers) {
            if (tower && tower.active && tower.isValid) {
                const towerScript = tower.getComponent('Arrower') as any;
                const priestScript = tower.getComponent('Priest') as any;
                const characterScript = towerScript || priestScript;
                // 检查弓箭手或牧师是否存活
                if (characterScript && characterScript.isAlive && characterScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, tower.worldPosition);
                    // 如果角色在范围内，且优先级更高或距离更近
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
        const huntersNode = find('Canvas/Hunters');
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

        // 5. 查找范围内的建筑物（战争古树和猎手大厅，优先级第五）
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

        // 3.4) 精灵剑士
        let swordsmen: Node[] = [];
        const swordsmenNode = find('Canvas/ElfSwordsmans');
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

        // 查找哨塔 - 从UnitManager获取
        let watchTowers: Node[] = [];
        if (this.unitManager) {
            watchTowers = this.unitManager.getBuildings().filter(building => {
                const watchTowerScript = building.getComponent('WatchTower') as any;
                return watchTowerScript && watchTowerScript.isAlive && watchTowerScript.isAlive();
            });
        } else {
            // 降级方案：直接从容器节点获取
            const watchTowersNode = find('Canvas/WatchTowers');
            if (watchTowersNode) {
                watchTowers = watchTowersNode.children || [];
            }
        }
        // 哨塔
        for (const watchTower of watchTowers) {
            if (!watchTower || !watchTower.active || !watchTower.isValid) continue;
            
            const watchTowerScript = watchTower.getComponent('WatchTower') as any;
            if (!watchTowerScript || !watchTowerScript.isAlive || !watchTowerScript.isAlive()) continue;
            
            const distance = Vec3.distance(this.node.worldPosition, watchTower.worldPosition);
            if (distance <= detectionRange) {
                if (PRIORITY.BUILDING < targetPriority || 
                    (PRIORITY.BUILDING === targetPriority && distance < minDistance)) {
                    minDistance = distance;
                    nearestTarget = watchTower;
                    targetPriority = PRIORITY.BUILDING;
                }
            }
        }

        // 如果找到目标，设置为当前目标
        // 但是，如果正在播放攻击动画，且当前目标仍然有效，不改变目标
        if (this.isPlayingAttackAnimation && this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
            // 检查当前目标是否仍然存活
            const towerScript = this.currentTarget.getComponent('Arrower') as any;
            const warAncientTreeScript = this.currentTarget.getComponent('WarAncientTree') as any;
            const hallScript = this.currentTarget.getComponent('HunterHall') as any;
            const swordsmanHallScript = this.currentTarget.getComponent('SwordsmanHall') as any;
            const crystalScript = this.currentTarget.getComponent('Crystal') as any;
            const hunterScript = this.currentTarget.getComponent('Hunter') as any;
            const elfSwordsmanScript = this.currentTarget.getComponent('ElfSwordsman') as any;
            const priestScript = this.currentTarget.getComponent('Priest') as any;
            const stoneWallScript = this.currentTarget.getComponent('StoneWall') as any;
            const watchTowerScript = this.currentTarget.getComponent('WatchTower') as any;
            const targetScript = towerScript || warAncientTreeScript || hallScript || swordsmanHallScript || priestScript || crystalScript || hunterScript || elfSwordsmanScript || stoneWallScript || watchTowerScript;
            
            // 如果当前目标仍然存活，保持当前目标不变
            if (targetScript && targetScript.isAlive && targetScript.isAlive()) {
                return; // 不改变目标，保持攻击动画中的目标
            } else {
            }
        }
        
        const oldTarget = this.currentTarget;
        if (nearestTarget) {
            this.currentTarget = nearestTarget;
            if (oldTarget !== nearestTarget) {
            }
        } else {
            // 200像素范围内没有任何我方单位，目标设为水晶
            if (this.targetCrystal && this.targetCrystal.isValid) {
                const crystalScript = this.targetCrystal.getComponent('Crystal') as any;
                if (crystalScript && crystalScript.isAlive && crystalScript.isAlive()) {
                    this.currentTarget = this.targetCrystal;
                    if (oldTarget !== this.targetCrystal) {
                    }
                } else {
                    this.currentTarget = null!;
                    if (oldTarget) {
                    }
                }
            } else {
                this.currentTarget = null!;
                if (oldTarget) {
                }
            }
        }
    }

    moveTowardsTarget(deltaTime: number) {
        if (!this.currentTarget) {
            return;
        }

        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        const distance = direction.length();
        
        if (distance > 0.1) {
            direction.normalize();
            
            // 应用敌人避让逻辑
            const finalDirection = this.calculateEnemyAvoidanceDirection(this.node.worldPosition, direction, deltaTime);
            
            const newPos = new Vec3();
            Vec3.scaleAndAdd(newPos, this.node.worldPosition, finalDirection, this.moveSpeed * deltaTime);
            
            // 检查移动路径上是否有石墙阻挡（如果目标不是石墙）
            const targetScript = this.currentTarget.getComponent('StoneWall') as any;
            if (!targetScript) {
                // 目标不是石墙，检查路径上是否有石墙阻挡
                if (this.checkCollisionWithStoneWall(newPos)) {
                    // 路径被石墙阻挡，尝试绕路
                    const detourPos = this.calculateDetourPosition(direction, deltaTime);
                    if (detourPos) {
                        // 找到绕路位置，移动到该位置
                        const clampedPos = this.clampPositionToScreen(detourPos);
                        this.node.setWorldPosition(clampedPos);
                        
                        // 根据移动方向翻转
                        const detourDirection = new Vec3();
                        Vec3.subtract(detourDirection, detourPos, this.node.worldPosition);
                        this.flipDirection(detourDirection);
                        
                        // 播放行走动画
                        this.playWalkAnimation();
                        return;
                    } else {
                        // 无法绕路，攻击最近的石墙
                        const nearestWall = this.findNearestStoneWall();
                        if (nearestWall) {
                            this.currentTarget = nearestWall;
                            return;
                        } else {
                            // 找不到石墙，停止移动
                            return;
                        }
                    }
                }
            }
            
            // 限制位置在屏幕范围内
            const clampedPos = this.clampPositionToScreen(newPos);
            this.node.setWorldPosition(clampedPos);
            
            // 根据移动方向翻转
            this.flipDirection(finalDirection);
            
            // 播放行走动画
            this.playWalkAnimation();
        }
    }

    moveTowardsCrystal(deltaTime: number) {
        if (!this.targetCrystal || !this.targetCrystal.isValid) {
            return;
        }

        // 在移动前检查路径上是否有战争古树或防御塔或石墙
        this.checkForTargetsOnPath();

        // 如果检测到目标（包括石墙），停止朝水晶移动，让update()方法处理目标
        if (this.currentTarget) {
            return;
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
            if (this.checkCollisionWithStoneWall(newPos)) {
                // 路径被石墙阻挡，尝试绕路
                const detourPos = this.calculateDetourPosition(direction, deltaTime);
                if (detourPos) {
                    // 找到绕路位置，移动到该位置
                    const clampedPos = this.clampPositionToScreen(detourPos);
                    this.node.setWorldPosition(clampedPos);
                    
                    // 根据移动方向翻转
                    const detourDirection = new Vec3();
                    Vec3.subtract(detourDirection, detourPos, this.node.worldPosition);
                    this.flipDirection(detourDirection);
                    
                    // 播放行走动画
                    this.playWalkAnimation();
                    return;
                } else {
                    // 无法绕路，停止移动
                    return;
                }
            }
            
            // 限制位置在屏幕范围内
            const clampedPos = this.clampPositionToScreen(newPos);
            this.node.setWorldPosition(clampedPos);
            
            // 根据移动方向翻转
            this.flipDirection(finalDirection);
            
            // 播放行走动画
            this.playWalkAnimation();
        }
    }

    /**
     * 计算绕路位置
     * @param direction 原始移动方向
     * @param deltaTime 时间间隔
     * @returns 如果找到可行的绕路位置返回该位置，否则返回null
     */
    calculateDetourPosition(direction: Vec3, deltaTime: number): Vec3 | null {
        const moveDistance = this.moveSpeed * deltaTime;
        const perpendicular = new Vec3(-direction.y, direction.x, 0); // 垂直于移动方向的方向
        
        // 使用较小的偏移距离，让移动更平滑
        const offsetDistances = [30, 50, 80]; // 逐步增加偏移距离
        
        // 尝试不同偏移距离的绕路
        for (const offsetDistance of offsetDistances) {
            // 尝试左侧绕路
            const leftOffset = new Vec3();
            Vec3.scaleAndAdd(leftOffset, this.node.worldPosition, perpendicular, offsetDistance);
            const leftPos = new Vec3();
            Vec3.scaleAndAdd(leftPos, leftOffset, direction, moveDistance);
            
            if (!this.checkCollisionWithStoneWall(leftPos)) {
                return leftPos;
            }
            
            // 尝试右侧绕路
            const rightOffset = new Vec3();
            Vec3.scaleAndAdd(rightOffset, this.node.worldPosition, perpendicular, -offsetDistance);
            const rightPos = new Vec3();
            Vec3.scaleAndAdd(rightPos, rightOffset, direction, moveDistance);
            
            if (!this.checkCollisionWithStoneWall(rightPos)) {
                return rightPos;
            }
        }
        
        // 无法找到可行的绕路位置
        return null;
    }

    /**
     * 查找最近的石墙
     * @returns 最近的石墙节点，如果没有找到返回null
     */
    findNearestStoneWall(): Node | null {
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
     * 检查位置是否与石墙碰撞
     * @param position 要检查的位置
     * @returns 如果与石墙碰撞返回true，否则返回false
     */
    checkCollisionWithStoneWall(position: Vec3): boolean {
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
                return true;
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
    checkPathBlockedByStoneWall(): Node | null {
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

        // 查找所有石墙
        let stoneWallsNode = find('StoneWalls');
        if (!stoneWallsNode && this.node.scene) {
            stoneWallsNode = findNodeRecursive(this.node.scene, 'StoneWalls');
        }

        if (!stoneWallsNode) {
            return null;
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
        
        // 检测路径上的石墙（分段检测）
        const checkSteps = Math.ceil(distanceToCrystal / 50); // 每50像素检测一次
        const stepSize = distanceToCrystal / checkSteps;
        const stoneWalls = stoneWallsNode.children || [];
        const blockingWalls: { wall: Node; distance: number }[] = [];

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
                if (distanceToWall < wallRadius + 20) { // 20像素的缓冲距离
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

        // 尝试左右绕行检测
        const perpendicular = new Vec3(-direction.y, direction.x, 0); // 垂直于路径的方向
        const offsetDistance = 80; // 绕行偏移距离

        // 检测左侧绕行
        const leftOffset = new Vec3();
        Vec3.scaleAndAdd(leftOffset, enemyPos, perpendicular, offsetDistance);
        const leftPathClear = this.checkPathClear(leftOffset, crystalPos, stoneWalls);

        // 检测右侧绕行
        const rightOffset = new Vec3();
        Vec3.scaleAndAdd(rightOffset, enemyPos, perpendicular, -offsetDistance);
        const rightPathClear = this.checkPathClear(rightOffset, crystalPos, stoneWalls);

        // 如果左右都无法绕行，返回最近的石墙
        if (!leftPathClear && !rightPathClear) {
            return nearestWall;
        }

        // 可以绕行，返回null
        return null;
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
        const checkSteps = Math.ceil(distance / 50);
        const stepSize = distance / checkSteps;

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

                if (distanceToWall < wallRadius + 20) {
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
            // 路径被石墙阻挡且无法绕开，优先攻击石墙
            allPotentialTargets.push(blockedStoneWall);
        }

        // 3. 添加石墙（用于一般检测）
        let stoneWallsNode = find('StoneWalls');
        if (!stoneWallsNode && this.node.scene) {
            stoneWallsNode = findNodeRecursive(this.node.scene, 'StoneWalls');
        }
        if (stoneWallsNode) {
            const stoneWalls = stoneWallsNode.children || [];
            for (const wall of stoneWalls) {
                if (wall && wall.active && wall.isValid) {
                    const wallScript = wall.getComponent('StoneWall') as any;
                    if (wallScript && wallScript.isAlive && wallScript.isAlive()) {
                        // 如果路径被阻挡，只添加阻挡路径的石墙
                        if (!blockedStoneWall || wall === blockedStoneWall) {
                            allPotentialTargets.push(wall);
                        }
                    }
                }
            }
        }

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
        
        // 3.4) 精灵剑士
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
        
        // 4.2) 猎手大厅
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
            } else if (target.getComponent('WarAncientTree') || target.getComponent('HunterHall')) {
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
        } else if (this.isPlayingWarcryAnimation) {
            this.updateWarcryAnimation();
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
        // 检查目标是否仍然有效，如果无效则停止攻击动画
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
            this.isPlayingAttackAnimation = false;
            this.attackComplete = false;
            this.currentTarget = null!;
            this.playIdleAnimation();
            return;
        }
        
        // 检查目标是否仍然存活
        const towerScript = this.currentTarget.getComponent('Arrower') as any;
        const warAncientTreeScript = this.currentTarget.getComponent('WarAncientTree') as any;
        const hallScript = this.currentTarget.getComponent('HunterHall') as any;
        const swordsmanHallScript = this.currentTarget.getComponent('SwordsmanHall') as any;
        const crystalScript = this.currentTarget.getComponent('Crystal') as any;
        const hunterScript = this.currentTarget.getComponent('Hunter') as any;
        const elfSwordsmanScript = this.currentTarget.getComponent('ElfSwordsman') as any;
        const priestScript = this.currentTarget.getComponent('Priest') as any;
        const stoneWallScript = this.currentTarget.getComponent('StoneWall') as any;
        const watchTowerScript = this.currentTarget.getComponent('WatchTower') as any;
        const targetScript = towerScript || warAncientTreeScript || hallScript || swordsmanHallScript || priestScript || crystalScript || hunterScript || elfSwordsmanScript || stoneWallScript || watchTowerScript;
        
        if (targetScript && targetScript.isAlive && !targetScript.isAlive()) {
            // 目标已被摧毁，停止攻击动画
            this.isPlayingAttackAnimation = false;
            this.attackComplete = false;
            this.currentTarget = null!;
            this.playIdleAnimation();
            return;
        }
        
        if (this.attackAnimationFrames.length === 0) {
            this.isPlayingAttackAnimation = false;
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
                    
                    // dealDamage() 中已经处理了目标被摧毁的情况，这里只需要检查是否还在播放攻击动画
                    // 如果目标被摧毁，dealDamage() 会停止攻击动画并清除目标
                    if (!this.isPlayingAttackAnimation) {
                        return;
                    }
                }
            }
            
            // 在动画播放过程中，定期检查目标是否仍然有效（每5帧检查一次，减少性能开销）
            if (frameIndex % 5 === 0) {
                if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
                    this.isPlayingAttackAnimation = false;
                    this.attackComplete = false;
                    this.currentTarget = null!;
                    this.playIdleAnimation();
                    return;
                }
            }
        } else {
            // 攻击动画播放完成，重置状态
            this.isPlayingAttackAnimation = false;
            this.attackComplete = false;
            
            // 如果目标已被摧毁，重置攻击计时器，避免下一次攻击立即触发
            if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
                this.currentTarget = null!;
                this.attackTimer = 0;
            }
            
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
                this.sprite.spriteFrame = this.hitAnimationFrames[frameIndex];
            }
        } else {
            // 被攻击动画播放完成，恢复移动或待机
            this.isPlayingHitAnimation = false;
            this.resumeMovement();
        }
    }

    // 更新战争咆哮动画
    updateWarcryAnimation() {
        if (this.warcryAnimationFrames.length === 0) {
            this.isPlayingWarcryAnimation = false;
            this.playIdleAnimation();
            return;
        }

        const frameDuration = this.warcryAnimationDuration / this.warcryAnimationFrames.length;
        const frameIndex = Math.floor(this.animationTimer / frameDuration);

        if (frameIndex < this.warcryAnimationFrames.length) {
            if (frameIndex !== this.currentAnimationFrameIndex) {
                this.currentAnimationFrameIndex = frameIndex;
                this.sprite.spriteFrame = this.warcryAnimationFrames[frameIndex];
                
                // 在动画中间点释放战争咆哮效果
                const warcryPoint = Math.floor(this.warcryAnimationFrames.length * 0.5);
                if (frameIndex === warcryPoint) {
                    this.releaseWarcry();
                }
            }
        } else {
            // 战争咆哮动画播放完成
            this.isPlayingWarcryAnimation = false;
            
            // 如果之前正在攻击，重新开始攻击
            if (this.wasPlayingAttackBeforeWarcry) {
                this.wasPlayingAttackBeforeWarcry = false;
                // 重新触发攻击
                if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
                    this.attack();
                } else {
                    this.playIdleAnimation();
                }
            } else {
                this.playIdleAnimation();
            }
        }
    }

    // 更新死亡动画
    updateDeathAnimation() {
        if (this.deathAnimationFrames.length === 0) {
            this.isPlayingDeathAnimation = false;
            return;
        }

        const frameDuration = this.deathAnimationDuration / this.deathAnimationFrames.length;
        const frameIndex = Math.floor(this.animationTimer / frameDuration);

        if (frameIndex < this.deathAnimationFrames.length) {
            if (frameIndex !== this.currentAnimationFrameIndex) {
                this.currentAnimationFrameIndex = frameIndex;
                this.sprite.spriteFrame = this.deathAnimationFrames[frameIndex];
            }
        } else {
            // 死亡动画播放完成，停留在最后一帧
            this.isPlayingDeathAnimation = false;
            // 保持最后一帧
            if (this.deathAnimationFrames.length > 0) {
                this.sprite.spriteFrame = this.deathAnimationFrames[this.deathAnimationFrames.length - 1];
            }
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
        if (this.isPlayingWalkAnimation || this.isDestroyed) {
            return;
        }

        this.stopAllAnimations();
        this.isPlayingWalkAnimation = true;
        this.animationTimer = 0;
        this.currentAnimationFrameIndex = -1;
    }

    // 播放攻击动画
    playAttackAnimation() {
        if (this.isPlayingDeathAnimation || this.isDestroyed) {
            return;
        }

        // 如果已经在播放攻击动画，不重复播放（在stopAllAnimations之前检查）
        if (this.isPlayingAttackAnimation) {
            return;
        }

        // 停止所有动画（除了攻击动画）
        const wasPlayingAttack = this.isPlayingAttackAnimation;
        this.stopAllAnimations();
        
        // 如果之前正在播放攻击动画，恢复状态（不应该发生，但为了安全）
        if (wasPlayingAttack) {
            this.isPlayingAttackAnimation = true;
            // 不重置animationTimer，继续播放
            return;
        }
        
        // 设置攻击动画状态
        this.isPlayingAttackAnimation = true;
        this.attackComplete = false;
        this.animationTimer = 0;
        this.currentAnimationFrameIndex = -1;
        
        // 播放攻击音效
        if (this.attackSound) {
            AudioManager.Instance.playSFX(this.attackSound);
        }
    }

    // 播放战争咆哮动画
    playWarcryAnimation() {
        if (this.isPlayingDeathAnimation || this.isDestroyed) {
            return;
        }

        // 如果正在播放战争咆哮动画，不重复播放
        if (this.isPlayingWarcryAnimation) {
            return;
        }

        // 如果正在播放攻击动画，保存状态，战争咆哮完成后重新开始攻击
        this.wasPlayingAttackBeforeWarcry = this.isPlayingAttackAnimation;
        

        this.stopAllAnimations();
        this.isPlayingWarcryAnimation = true;
        this.animationTimer = 0;
        this.currentAnimationFrameIndex = -1;
        // 重置战争咆哮冷却计时器
        this.warcryTimer = 0;
        
        // 如果没有战争咆哮动画帧，直接释放效果
        if (this.warcryAnimationFrames.length === 0) {
            this.releaseWarcry();
            this.isPlayingWarcryAnimation = false;
            // 如果之前正在攻击，重新开始攻击
            if (this.wasPlayingAttackBeforeWarcry) {
                this.wasPlayingAttackBeforeWarcry = false;
                // 重新触发攻击
                if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
                    this.attack();
                }
            } else {
                this.playIdleAnimation();
            }
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
        this.isPlayingIdleAnimation = false;
        this.isPlayingWalkAnimation = false;
        this.isPlayingAttackAnimation = false;
        this.isPlayingHitAnimation = false;
        this.isPlayingWarcryAnimation = false;
        // 不停止死亡动画
        this.isHit = false; // 清除被攻击标志
    }

    // 恢复默认精灵帧
    restoreDefaultSprite() {
        if (this.sprite && this.defaultSpriteFrame) {
            this.sprite.spriteFrame = this.defaultSpriteFrame;
        }
    }

    // 处理实际伤害
    dealDamage() {
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            // 如果正在播放攻击动画，停止它
            if (this.isPlayingAttackAnimation) {
                this.isPlayingAttackAnimation = false;
                this.attackComplete = false;
                this.playIdleAnimation();
            }
            return;
        }

        const towerScript = this.currentTarget.getComponent('Arrower') as any;
        const warAncientTreeScript = this.currentTarget.getComponent('WarAncientTree') as any;
        const hallScript = this.currentTarget.getComponent('HunterHall') as any;
        const swordsmanHallScript = this.currentTarget.getComponent('SwordsmanHall') as any;
        const crystalScript = this.currentTarget.getComponent('Crystal') as any;
        const hunterScript = this.currentTarget.getComponent('Hunter') as any;
        const elfSwordsmanScript = this.currentTarget.getComponent('ElfSwordsman') as any;
        const priestScript = this.currentTarget.getComponent('Priest') as any;
        const stoneWallScript = this.currentTarget.getComponent('StoneWall') as any;
        const watchTowerScript = this.currentTarget.getComponent('WatchTower') as any;
        const targetScript = towerScript || warAncientTreeScript || hallScript || swordsmanHallScript || priestScript || crystalScript || hunterScript || elfSwordsmanScript || stoneWallScript || watchTowerScript;
        
        if (targetScript && targetScript.takeDamage) {
            const targetType = targetScript.constructor.name;
            const wasAlive = targetScript.isAlive && targetScript.isAlive();
            targetScript.takeDamage(this.attackDamage);
            
            // 检查目标是否仍然存活，特别是石墙
            const isAliveAfter = targetScript.isAlive && targetScript.isAlive();
            if (targetScript && targetScript.isAlive && !targetScript.isAlive()) {
                // 目标被摧毁，清除目标并停止攻击动画
                this.currentTarget = null!;
                if (this.isPlayingAttackAnimation) {
                    this.isPlayingAttackAnimation = false;
                    this.attackComplete = false;
                    this.playIdleAnimation();
                }
            }
        } else {
            // 目标无效，清除目标
            this.currentTarget = null!;
            // 如果正在播放攻击动画，停止它
            if (this.isPlayingAttackAnimation) {
                this.isPlayingAttackAnimation = false;
                this.attackComplete = false;
                this.playIdleAnimation();
            }
        }
    }

    attack() {
        
        // 如果正在播放攻击动画，不重复触发攻击
        if (this.isPlayingAttackAnimation) {
            // 如果attackTimer被重置了，恢复它，避免攻击间隔被缩短
            if (this.attackTimer === 0) {
                // attackTimer已经在update中被重置，这是正常的
            }
            return;
        }
        
        if (!this.currentTarget || this.isDestroyed) {
            return;
        }

        // 再次检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }

        // 攻击时朝向目标方向
        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        this.flipDirection(direction);

        // 播放攻击动画
        this.playAttackAnimation();
    }

    takeDamage(damage: number) {
        if (this.isDestroyed) {
            return;
        }

        // 显示伤害数字
        this.showDamageNumber(damage);
        
        // 处理韧性为0的情况：没有抗性，每次受到伤害都触发僵直（仍需检查僵直冷却）
        if (this.tenacity <= 0) {
            const timeSinceLastStagger = this.lastStaggerTime < 0 ? Infinity : (this.attackTimer - this.lastStaggerTime);
            if (timeSinceLastStagger > 2.0) {
                // 记录僵直时间
                this.lastStaggerTime = this.attackTimer;
                // 被攻击时停止移动
                this.stopMoving();
                // 播放受击动画
                this.playHitAnimation();
            }
        } else {
            // 计算韧性阈值：需要受到最大生命值的 tenacity 百分比才会触发僵直
            // 例如：tenacity = 0.3 表示需要受到30%血量损失才触发僵直
            const threshold = this.maxHealth * Math.min(1, Math.max(0, this.tenacity));
            
            // 如果距离上次伤害超过1秒，重置累计伤害
            if (this.damageTime > 0 && this.attackTimer - this.damageTime > 1.0) {
                this.recentDamage = 0;
            }
            
            // 更新最近伤害和时间
            this.recentDamage += damage;
            this.damageTime = this.attackTimer;
            
            // 检查是否应该产生僵直：
            // 1. 最近1秒内受到的伤害大于等于韧性阈值
            // 2. 距离上次产生僵直超过2秒（或从未产生过僵直）
            const timeSinceLastStagger = this.lastStaggerTime < 0 ? Infinity : (this.attackTimer - this.lastStaggerTime);
            const canStagger = this.recentDamage >= threshold && timeSinceLastStagger > 2.0;
            
            if (canStagger) {
                // 记录僵直时间
                this.lastStaggerTime = this.attackTimer;
                // 重置累计伤害（因为已经产生僵直了，重新开始计算）
                this.recentDamage = 0;
                this.damageTime = this.attackTimer; // 重置伤害时间戳，确保下次计算从当前时间开始
                
                // 被攻击时停止移动
                this.stopMoving();
                
                // 播放受击动画
                this.playHitAnimation();
            }
        }

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
        damageNode.setWorldPosition(this.node.worldPosition.clone().add3f(0, 40, 0));
        
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

    // 释放战争咆哮效果
    releaseWarcry() {
        // 播放战争咆哮音效
        if (this.warcrySound) {
            AudioManager.Instance.playSFX(this.warcrySound);
        }
        
        // 查找附近的敌人
        this.findNearbyEnemies();
        
        // 重置战争咆哮冷却计时器
        this.warcryTimer = 0;
    }
    
    // 查找附近的敌人并应用战争咆哮效果
    findNearbyEnemies() {
        // 查找Enemies容器
        const enemiesNode = find('Canvas/Enemies');
        
        if (!enemiesNode) {
            return;
        }
        
        const enemies = enemiesNode.children || [];
        const currentTime = this.attackTimer;
        
        for (const enemy of enemies) {
            if (!enemy || !enemy.isValid || !enemy.active) {
                continue;
            }
            
            // 计算距离
            const distance = Vec3.distance(this.node.worldPosition, enemy.worldPosition);
            if (distance <= this.warcryRange) {
                // 检查敌人是否存活
                const enemyScript = enemy.getComponent('Enemy') as any || enemy.getComponent('OrcWarrior') as any || enemy.getComponent('OrcWarlord') as any;
                if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
                    // 应用战争咆哮效果
                    this.applyWarcryBuff(enemy, enemyScript, currentTime);
                }
            }
        }
    }
    
    // 应用战争咆哮buff
    applyWarcryBuff(enemy: Node, enemyScript: any, currentTime: number) {
        // 保存原始属性
        if (!enemyScript._originalMoveSpeed) {
            enemyScript._originalMoveSpeed = enemyScript.moveSpeed;
        }
        if (!enemyScript._originalAttackDamage) {
            enemyScript._originalAttackDamage = enemyScript.attackDamage;
        }
        if (!enemyScript._originalAttackInterval) {
            enemyScript._originalAttackInterval = enemyScript.attackInterval;
        }
        
        // 提升属性
        enemyScript.moveSpeed = enemyScript._originalMoveSpeed * (1 + this.warcryEffect);
        enemyScript.attackDamage = enemyScript._originalAttackDamage * (1 + this.warcryEffect);
        enemyScript.attackInterval = enemyScript._originalAttackInterval / (1 + this.warcryEffect);
        
        // 添加红光效果
        this.addRedGlowEffect(enemy);
        
        // 添加到受影响敌人集合
        this.warcryBuffedEnemies.add(enemy);
        this.warcryBuffEndTime.set(enemy, currentTime + this.warcryDuration);
    }
    
    // 移除战争咆哮buff
    removeWarcryBuff(enemy: Node, enemyScript: any) {
        if (enemyScript._originalMoveSpeed) {
            enemyScript.moveSpeed = enemyScript._originalMoveSpeed;
        }
        if (enemyScript._originalAttackDamage) {
            enemyScript.attackDamage = enemyScript._originalAttackDamage;
        }
        if (enemyScript._originalAttackInterval) {
            enemyScript.attackInterval = enemyScript._originalAttackInterval;
        }
        
        // 移除红光效果
        this.removeRedGlowEffect(enemy);
        
        // 从集合中移除
        this.warcryBuffedEnemies.delete(enemy);
        this.warcryBuffEndTime.delete(enemy);
    }
    
    // 添加红光效果
    addRedGlowEffect(enemy: Node) {
        // 移除已有的红光效果（如果有）
        this.removeRedGlowEffect(enemy);
        
        // 获取敌人的Sprite组件
        const sprite = enemy.getComponent(Sprite);
        if (sprite) {
            // 保存原始颜色，以便后续恢复
            enemy['_originalColor'] = sprite.color.clone();
            
            // 设置红色发光效果（提高红色通道值）
            sprite.color = new Color(255, 150, 150, 255); // 偏红色
        }
    }
    
    // 移除红光效果
    removeRedGlowEffect(enemy: Node) {
        // 获取敌人的Sprite组件
        const sprite = enemy.getComponent(Sprite);
        if (sprite && enemy['_originalColor']) {
            // 恢复原始颜色
            sprite.color = enemy['_originalColor'];
            delete enemy['_originalColor'];
        }
    }
    
    // 更新战争咆哮buff状态
    updateWarcryBuffs(deltaTime: number) {
        if (this.warcryBuffedEnemies.size === 0) {
            return;
        }
        
        const currentTime = this.attackTimer;
        const enemiesToRemove: Node[] = [];
        
        // 检查每个受影响的敌人
        for (const enemy of this.warcryBuffedEnemies) {
            if (!enemy || !enemy.isValid) {
                enemiesToRemove.push(enemy);
                continue;
            }
            
            const endTime = this.warcryBuffEndTime.get(enemy);
            if (endTime !== undefined && currentTime >= endTime) {
                // Buff时间到，移除效果
                const enemyScript = enemy.getComponent('Enemy') as any || enemy.getComponent('OrcWarrior') as any || enemy.getComponent('OrcWarlord') as any;
                if (enemyScript) {
                    this.removeWarcryBuff(enemy, enemyScript);
                }
                enemiesToRemove.push(enemy);
            }
        }
        
        // 清理无效敌人
        for (const enemy of enemiesToRemove) {
            this.warcryBuffedEnemies.delete(enemy);
            this.warcryBuffEndTime.delete(enemy);
        }
    }
    
    die() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;
        
        // 立即停止所有移动和动画
        this.stopAllAnimations();
        
        // 移除所有战争咆哮buff
        for (const enemy of this.warcryBuffedEnemies) {
            if (enemy && enemy.isValid) {
                const enemyScript = enemy.getComponent('Enemy') as any || enemy.getComponent('OrcWarrior') as any || enemy.getComponent('OrcWarlord') as any;
                if (enemyScript) {
                    this.removeWarcryBuff(enemy, enemyScript);
                }
            }
        }
        this.warcryBuffedEnemies.clear();
        this.warcryBuffEndTime.clear();
        
        // 奖励金币和经验值
        if (!this.gameManager) {
            this.findGameManager();
        }
        if (this.gameManager) {
            this.gameManager.addGold(this.goldReward);
            this.gameManager.addExperience(this.expReward);
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
        
        // 尸体暂留1分钟后返回对象池（而不是销毁）
        setTimeout(() => {
            returnToPool();
        }, 60000); // 60秒 = 1分钟
    }
    
    /**
     * 清理所有插在身上的武器（箭矢、长矛、回旋镖等）
     */
    private clearAttachedWeapons() {
        const childrenToRemove: Node[] = [];
        if (this.node) {
            const children = this.node.children || [];
            for (const child of children) {
                if (child && child.isValid) {
                    const arrowScript = child.getComponent('Arrow') as any;
                    const arrow2Script = child.getComponent('Arrow2') as any;
                    const boomerangScript = child.getComponent('Boomerang') as any;
                    const spearScript = child.getComponent('Spear') as any;
                    const childName = child.name.toLowerCase();
                    
                    // 保留血条节点，清理其他武器子节点
                    if (childName !== 'healthbar' && childName !== 'health bar') {
                        // 检查是否是武器（通过组件或名称判断）
                        if (arrowScript || arrow2Script || boomerangScript || spearScript || 
                            childName.includes('arrow') || childName.includes('spear') || 
                            childName.includes('boomerang') || childName.includes('长矛') || 
                            childName.includes('箭矢') || childName.includes('回旋镖')) {
                            // 是武器，需要清理
                            childrenToRemove.push(child);
                        }
                    }
                }
            }
        }
        
        // 销毁所有武器子节点
        for (const child of childrenToRemove) {
            if (child && child.isValid) {
                child.destroy();
            }
        }
    }

    /**
     * 重置敌人状态（用于对象池回收）
     */
    private resetEnemyState() {
        // 清理所有不需要的子节点（箭矢、长矛等）
        this.clearAttachedWeapons();
        
        // 重置所有状态变量
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        this.attackComplete = false;
        this.warcryTimer = 0;
        this.isPlayingWarcryAnimation = false;
        this.warcryBuffedEnemies.clear();
        this.warcryBuffEndTime.clear();
        this.wasPlayingAttackBeforeWarcry = false;
        this.isHit = false;
        this.isPlayingAttackAnimation = false;
        this.isPlayingHitAnimation = false;
        this.isPlayingDeathAnimation = false;
        this.isPlayingIdleAnimation = false;
        this.isPlayingWalkAnimation = false;
        this.currentTarget = null!;
        
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
        
        // 清理血条
        if (this.healthBarNode && this.healthBarNode.isValid) {
            this.healthBarNode.destroy();
        }
        this.healthBarNode = null!;
        this.healthBar = null!;
    }

    /**
     * 检查敌人是否存活
     * @returns 是否存活
     */
    isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
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