import { _decorator, Component, Node, Vec3, tween, Sprite, find, Prefab, instantiate, Label, Color, SpriteFrame, UITransform, AudioClip, view } from 'cc';
import { GameManager, GameState } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
import { AudioManager } from './AudioManager';
import { UnitType } from './WarAncientTree';
const { ccclass, property } = _decorator;

@ccclass('OrcWarrior')
export class OrcWarrior extends Component {
    @property
    maxHealth: number = 50;

    @property
    moveSpeed: number = 40;

    @property
    attackDamage: number = 8;

    @property
    attackInterval: number = 1.5;

    @property
    attackRange: number = 60;

    @property(Node)
    targetCrystal: Node = null!;

    @property(Prefab)
    damageNumberPrefab: Prefab = null!;

    // 单位类型
    public unitType: UnitType = UnitType.ENEMY;
    
    // 单位信息属性
    @property
    unitName: string = "兽人战士";
    
    @property
    unitDescription: string = "强大的兽人战士，拥有较高的攻击力和生命值。";
    
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
    attackAnimationDuration: number = 0.5; // 攻击动画总时长
    
    @property
    hitAnimationDuration: number = 0.3; // 被攻击动画总时长
    
    @property
    deathAnimationDuration: number = 1.0; // 死亡动画总时长

    private currentHealth: number = 50;
    private healthBar: HealthBar = null!;
    private healthBarNode: Node = null!;
    private isDestroyed: boolean = false;
    private attackTimer: number = 0;
    private currentTarget: Node = null!;
    private gameManager: GameManager = null!;
    
    @property
    goldReward: number = 3; // 消灭敌人获得的金币
    
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

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        this.attackComplete = false;
        
        // 保存默认缩放比例
        this.defaultScale = this.node.scale.clone();
        
        // 初始化动画相关属性
        this.sprite = this.node.getComponent(Sprite);
        this.uiTransform = this.node.getComponent(UITransform);
        
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
                // 游戏已结束或暂停，停止移动和攻击
                this.stopMoving();
                this.currentTarget = null!;
                return;
            }
        }

        // 更新攻击计时器
        this.attackTimer += deltaTime;

        // 查找目标（优先防御塔，然后水晶）
        this.findTarget();

        if (this.currentTarget) {
            const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
            
            if (distance <= this.attackRange) {
                // 在攻击范围内，停止移动并攻击
                this.stopMoving();
                if (this.attackTimer >= this.attackInterval && !this.isHit) {
                    this.attack();
                    this.attackTimer = 0;
                }
            } else {
                // 不在攻击范围内，只有在没有被攻击时才继续移动
                if (!this.isHit) {
                    this.moveTowardsTarget(deltaTime);
                    // 如果正在播放攻击动画，停止攻击动画
                    if (this.isPlayingAttackAnimation) {
                        this.isPlayingAttackAnimation = false;
                    }
                }
            }
        } else {
            // 没有目标，只有在没有被攻击时才向水晶移动
            if (this.targetCrystal && this.targetCrystal.isValid && !this.isHit) {
                this.moveTowardsCrystal(deltaTime);
                // 如果正在播放攻击动画，停止攻击动画
                if (this.isPlayingAttackAnimation) {
                    this.isPlayingAttackAnimation = false;
                }
            }
        }
        
        // 更新动画
        this.updateAnimation(deltaTime);
    }

    findTarget() {
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
        // 查找所有角色单位：弓箭手、小精灵、女猎手
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
        if (nearestTarget) {
            this.currentTarget = nearestTarget;
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

    moveTowardsTarget(deltaTime: number) {
        if (!this.currentTarget) {
            return;
        }

        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        const distance = direction.length();
        
        if (distance > 0.1) {
            direction.normalize();
            const newPos = new Vec3();
            Vec3.scaleAndAdd(newPos, this.node.worldPosition, direction, this.moveSpeed * deltaTime);
            
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
            
            this.node.setWorldPosition(newPos);
            
            // 根据移动方向翻转
            this.flipDirection(direction);
            
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
            const moveDistance = this.moveSpeed * deltaTime;
            const newPos = new Vec3();
            Vec3.scaleAndAdd(newPos, enemyWorldPos, direction, moveDistance);
            
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
            this.flipDirection(direction);
            
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
            const wallRadius = wallScript.collisionRadius || 40;
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
        
        // 3.3) 小精灵
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
            } else if (target.getComponent('Arrower') || target.getComponent('Hunter') || target.getComponent('Wisp')) {
                targetPriority = PRIORITY.CHARACTER;
            } else if (target.getComponent('WarAncientTree') || target.getComponent('MoonWell') || target.getComponent('HunterHall')) {
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
                this.sprite.spriteFrame = this.hitAnimationFrames[frameIndex];
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
            return;
        }

        const towerScript = this.currentTarget.getComponent('Arrower') as any;
        const warAncientTreeScript = this.currentTarget.getComponent('WarAncientTree') as any;
        const normalTreeScript = this.currentTarget.getComponent('Tree') as any;
        const wellScript = this.currentTarget.getComponent('MoonWell') as any;
        const hallScript = this.currentTarget.getComponent('HunterHall') as any;
        const crystalScript = this.currentTarget.getComponent('Crystal') as any;
        const wispScript = this.currentTarget.getComponent('Wisp') as any;
        const hunterScript = this.currentTarget.getComponent('Hunter') as any;
        const stoneWallScript = this.currentTarget.getComponent('StoneWall') as any;
        const targetScript = towerScript || warAncientTreeScript || normalTreeScript || wellScript || hallScript || crystalScript || wispScript || hunterScript || stoneWallScript;
        
        if (targetScript && targetScript.takeDamage) {
            targetScript.takeDamage(this.attackDamage);
        } else {
            // 目标无效，清除目标
            this.currentTarget = null!;
        }
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
        
        // 奖励金币
        if (!this.gameManager) {
            this.findGameManager();
        }
        if (this.gameManager) {
            this.gameManager.addGold(this.goldReward);
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
            // 没有死亡动画帧，直接销毁
            this.node.destroy();
        }
    }

    /**
     * 检查敌人是否存活
     * @returns 是否存活
     */
    isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }
}