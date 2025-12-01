import { _decorator, Component, Node, Vec3, tween, Sprite, find, Prefab, instantiate, Label, Color, SpriteFrame, UITransform, AudioClip, Animation, AnimationState } from 'cc';
import { GameManager } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
import { AudioManager } from './AudioManager';
import { UnitType } from './WarAncientTree';
const { ccclass, property } = _decorator;

@ccclass('Enemy')
export class Enemy extends Component {
    @property
    maxHealth: number = 30;

    @property
    moveSpeed: number = 50;

    @property
    attackDamage: number = 5;

    @property
    attackInterval: number = 2.0;

    @property
    attackRange: number = 50;

    @property(Node)
    targetCrystal: Node = null!;

    @property(Prefab)
    damageNumberPrefab: Prefab = null!;

    // 动画帧属性
    @property(SpriteFrame)
    idleAnimationFrames: SpriteFrame[] = []; // 待机动画帧
    
    @property(SpriteFrame)
    walkAnimationFrames: SpriteFrame[] = []; // 行走动画帧
    
    @property(SpriteFrame)
    hitAnimationFrames: SpriteFrame[] = []; // 被攻击动画帧
    
    @property(SpriteFrame)
    deathAnimationFrames: SpriteFrame[] = []; // 死亡动画帧
    
    // 动画名称配置
    @property
    attackAnimationName: string = 'orc-attck'; // 攻击动画名称，可在编辑器中配置
    
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

    private currentHealth: number = 30;
    private healthBar: HealthBar = null!;
    private healthBarNode: Node = null!;
    private isDestroyed: boolean = false;
    private attackTimer: number = 0;
    private currentTarget: Node = null!;
    private gameManager: GameManager = null!;
    
    @property
    goldReward: number = 2; // 消灭敌人获得的金币
    
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
    private attackCallback: (() => void) | null = null; // 攻击动画完成后的回调函数
    
    // Animation组件相关
    private animationComponent: Animation = null!; // Animation组件引用

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        
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
                console.info('Enemy: Found crystal node:', crystalNode.name, 'at position:', crystalNode.worldPosition);
            } else {
                console.error('Enemy: Cannot find Crystal node!');
            }
        } else {
            console.info('Enemy: targetCrystal already set:', this.targetCrystal.name, 'at position:', this.targetCrystal.worldPosition);
        }
        
        // 创建血条
        this.createHealthBar();
        
        // 初始播放待机动画
        this.playIdleAnimation();
        
        // console.info('Enemy: Start at position:', this.node.worldPosition);
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
            } else {
                // 调试：如果没有目标水晶
                if (!this.targetCrystal) {
                    // console.warn('Enemy: No targetCrystal set!');
                } else if (!this.targetCrystal.isValid) {
                    // console.warn('Enemy: targetCrystal is invalid!');
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
        
        // 定义优先级：水晶>树木>角色>建筑物
        const PRIORITY = {
            CRYSTAL: 1,
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

        // 2. 查找范围内的树木（优先级次之）
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
        
        // 3. 查找范围内的角色（优先级第三）
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

        // 4. 查找范围内的建筑物（战争古树、月亮井和猎手大厅，优先级第四）
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

        // 在移动前检查路径上是否有战争古树或防御塔
        this.checkForTargetsOnPath();

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
            this.node.setWorldPosition(newPos);
            
            // 根据移动方向翻转
            this.flipDirection(direction);
            
            // 播放行走动画
            this.playWalkAnimation();
            
            // 调试日志（每60帧输出一次，避免刷屏）
            if (Math.random() < 0.016) { // 约每60帧一次
                // console.info('Enemy moving:', {
                //     from: enemyWorldPos,
                //     to: crystalWorldPos,
                //     distance: distance.toFixed(2),
                //     moveDistance: moveDistance.toFixed(2)
                // });
            }
        }
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
        
        // 定义优先级：水晶>树木>角色>建筑物
        const PRIORITY = {
            CRYSTAL: 1,
            TREE: 2,
            CHARACTER: 3,
            BUILDING: 4
        };
        
        let nearestTarget: Node = null!;
        let minDistance = Infinity;
        let targetPriority = Infinity;

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

        // 2. 检查树木
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
                        const distance = Vec3.distance(this.node.worldPosition, tree.worldPosition);
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
        
        // 3. 检查角色单位（优先级第三）
        // 1) 弓箭手
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
                        const distance = Vec3.distance(this.node.worldPosition, tower.worldPosition);
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
        }
        // 2) 女猎手
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
                        const distance = Vec3.distance(this.node.worldPosition, hunter.worldPosition);
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
        }

        // 4. 检查战争古树
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
                        const distance = Vec3.distance(this.node.worldPosition, tree.worldPosition);
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
        }

        // 5. 检查月亮井
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
                        const distance = Vec3.distance(this.node.worldPosition, well.worldPosition);
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
                        const distance = Vec3.distance(this.node.worldPosition, wisp.worldPosition);
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
        }
        
        // 4. 检查建筑物（优先级第四）
        // 4.1) 战争古树（已在前面检查）
        // 4.2) 月亮井（已在前面检查）
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
                        const distance = Vec3.distance(this.node.worldPosition, hall.worldPosition);
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
        }
        
        // 如果找到目标，设置为当前目标
        if (nearestTarget) {
            this.currentTarget = nearestTarget;
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
        
        // 不再使用序列帧攻击动画，直接停止动画
        this.isPlayingAttackAnimation = false;
        this.playIdleAnimation();
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
        console.info('Enemy.playAttackAnimation: Starting attack animation');
        if (this.isPlayingDeathAnimation || this.isDestroyed) {
            console.info('Enemy.playAttackAnimation: Is playing death animation or destroyed, returning');
            return;
        }

        // 停止所有动画
        this.stopAllAnimations();
        
        // 设置攻击动画状态
        this.isPlayingAttackAnimation = true;
        
        // 使用Animation组件播放攻击动画
        if (this.animationComponent) {
            console.info('Enemy.playAttackAnimation: Using Animation component');
            // 清除之前的动画事件
            this.animationComponent.off(Animation.EventType.FINISHED);
            
            // 先停止当前可能正在播放的动画，确保每次都能重新开始
            this.animationComponent.stop();
            
            // 播放攻击动画
            console.info(`Enemy.playAttackAnimation: Playing animation ${this.attackAnimationName}`);
            
            // 获取动画状态，设置动画速度与attackAnimationDuration保持同步
            const state = this.animationComponent.getState(this.attackAnimationName);
            if (state) {
                // 重置动画播放头到开始位置
                state.time = 0;
                // 设置动画时长与attackAnimationDuration参数保持一致
                state.speed = state.duration / this.attackAnimationDuration;
                console.info(`Enemy.playAttackAnimation: Animation state found, duration: ${state.duration}, speed: ${state.speed}`);
            }
            
            // 播放动画
            this.animationComponent.play(this.attackAnimationName);
            
            // 不使用动画事件，而是使用定时器方式来处理攻击回调
            // 攻击动画播放完成时调用攻击回调和结束动画
            const finishTimer = this.attackAnimationDuration; // 攻击动画播放完成时触发
            
            // 攻击动画播放完成时调用攻击回调并结束动画
            this.scheduleOnce(() => {
                if (this.isPlayingAttackAnimation) {
                    console.info('Enemy.playAttackAnimation: Attack animation finished, calling attack callback and stopping animation');
                    
                    // 调用攻击回调函数
                    if (this.attackCallback) {
                        this.attackCallback();
                        this.attackCallback = null;
                    }
                    
                    // 播放攻击音效
                    if (this.attackSound) {
                        console.info('Enemy.playAttackAnimation: Playing attack sound');
                        AudioManager.Instance.playSFX(this.attackSound);
                    }
                    
                    // 结束动画
                    this.isPlayingAttackAnimation = false;
                    
                    // 动画结束后切换回待机动画
                    this.playIdleAnimation();
                }
            }, finishTimer);
        } else {
            console.info('Enemy.playAttackAnimation: No Animation component, using frame animation');
            // 如果没有Animation组件，使用原来的帧动画
            this.animationTimer = 0;
            this.currentAnimationFrameIndex = -1;
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

    attack() {
        if (!this.currentTarget || this.isDestroyed) {
            console.info('Enemy.attack: No target or destroyed, returning');
            return;
        }

        // 再次检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            console.info('Enemy.attack: Target is invalid or inactive, returning');
            this.currentTarget = null!;
            return;
        }

        // 攻击时朝向目标方向
        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        this.flipDirection(direction);

        // 保存当前目标，用于攻击动画完成后造成伤害
        const currentTarget = this.currentTarget;
        
        // 设置攻击回调函数
        this.attackCallback = () => {
            console.info('Enemy.attackCallback: Attack callback called');
            if (currentTarget && currentTarget.isValid && currentTarget.active) {
                const towerScript = currentTarget.getComponent('Arrower') as any;
                const warAncientTreeScript = currentTarget.getComponent('WarAncientTree') as any;
                const normalTreeScript = currentTarget.getComponent('Tree') as any;
                const wellScript = currentTarget.getComponent('MoonWell') as any;
                const hallScript = currentTarget.getComponent('HunterHall') as any;
                const crystalScript = currentTarget.getComponent('Crystal') as any;
                const wispScript = currentTarget.getComponent('Wisp') as any;
                const targetScript = towerScript || warAncientTreeScript || normalTreeScript || wellScript || hallScript || crystalScript || wispScript;
                
                if (targetScript && targetScript.takeDamage) {
                    targetScript.takeDamage(this.attackDamage);
                    // 根据目标类型输出日志
                    if (towerScript) {
                        console.info(`Enemy.attackCallback: Attacked arrower, dealt ${this.attackDamage} damage`);
                    } else if (warAncientTreeScript) {
                        console.info(`Enemy.attackCallback: Attacked war ancient tree, dealt ${this.attackDamage} damage`);
                    } else if (normalTreeScript) {
                        console.info(`Enemy.attackCallback: Attacked normal tree, dealt ${this.attackDamage} damage`);
                    } else if (wellScript) {
                        console.info(`Enemy.attackCallback: Attacked moon well, dealt ${this.attackDamage} damage`);
                    } else if (hallScript) {
                        console.info(`Enemy.attackCallback: Attacked hunter hall, dealt ${this.attackDamage} damage`);
                    } else if (crystalScript) {
                        console.info(`Enemy.attackCallback: Attacked crystal, dealt ${this.attackDamage} damage`);
                    } else if (wispScript) {
                        console.info(`Enemy.attackCallback: Attacked wisp, dealt ${this.attackDamage} damage`);
                    }
                } else {
                    // 目标无效，清除目标
                    console.info('Enemy.attackCallback: Target is invalid, clearing target');
                    this.currentTarget = null!;
                }
            } else {
                console.info('Enemy.attackCallback: Current target is invalid or inactive');
            }
        };

        // 播放攻击动画
        console.info('Enemy.attack: Playing attack animation:', this.attackAnimationName);
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
            console.info(`Enemy: Died, rewarded ${this.goldReward} gold`);
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
}

