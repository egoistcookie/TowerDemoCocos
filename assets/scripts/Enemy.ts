import { _decorator, Component, Node, Vec3, tween, Sprite, find, Prefab, instantiate, Label, Color, SpriteFrame, UITransform, AudioClip, Animation, AnimationState, view, Graphics } from 'cc';
import { GameManager, GameState } from './GameManager';
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
    attackRange: number = 70; // 增加攻击范围，确保大于石墙碰撞半径(40) + 敌人半径(20) = 60

    @property(Node)
    targetCrystal: Node = null!;

    @property(Prefab)
    damageNumberPrefab: Prefab = null!;

    // 单位类型
    public unitType: UnitType = UnitType.ENEMY;
    
    // 单位信息属性
    @property
    unitName: string = "兽人";
    
    @property
    unitDescription: string = "普通的兽人，攻击力和生命值较低，但数量众多。";
    
    @property(SpriteFrame)
    unitIcon: SpriteFrame = null!;

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
    private detourTarget: Vec3 | null = null; // 绕行目标点，当找到绕行路径时设置
    private detourMarkerNode: Node | null = null; // 绕行点高亮标记节点
    
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
        this.detourTarget = null; // 初始化绕行目标点
        
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
            const targetType = this.currentTarget.getComponent('StoneWall') ? '石墙' : 
                              this.currentTarget.getComponent('Crystal') ? '水晶' : '其他';
            
            if (distance <= this.attackRange) {
                // 在攻击范围内，停止移动并攻击
                console.debug(`[Enemy] update: 目标${targetType}在攻击范围内(距离: ${distance.toFixed(1)}, 攻击范围: ${this.attackRange})，准备攻击`);
                this.stopMoving();
                if (this.attackTimer >= this.attackInterval && !this.isHit) {
                    console.debug(`[Enemy] update: 攻击计时器就绪，开始攻击${targetType}`);
                    this.attack();
                    this.attackTimer = 0;
                } else {
                    console.debug(`[Enemy] update: 攻击计时器未就绪(已过时间: ${this.attackTimer.toFixed(2)}, 需要: ${this.attackInterval}), 或被攻击中: ${this.isHit}`);
                }
            } else {
                // 不在攻击范围内，只有在没有被攻击时才继续移动
                console.debug(`[Enemy] update: 目标${targetType}不在攻击范围内(距离: ${distance.toFixed(1)}, 攻击范围: ${this.attackRange})，继续移动`);
                if (!this.isHit) {
                    this.moveTowardsTarget(deltaTime);
                    // 如果正在播放攻击动画，停止攻击动画
                    if (this.isPlayingAttackAnimation) {
                        this.isPlayingAttackAnimation = false;
                    }
                }
            }
        } else {
            // 没有目标，检查路径是否被石墙阻挡
            if (this.targetCrystal && this.targetCrystal.isValid && !this.isHit) {
                // 在移动前先检查路径是否被石墙阻挡
                const blockedStoneWall = this.checkPathBlockedByStoneWall();
                if (blockedStoneWall) {
                    // 路径被石墙阻挡且无法绕行，立即设置为攻击目标
                    console.debug(`[Enemy] update: 路径被石墙阻挡且无法绕行，设置石墙为攻击目标`);
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
        
        // 如果当前目标已经是石墙，且石墙仍然存活，检查是否应该保持这个目标
        if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
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
                    // 路径不再被阻挡（可以绕行），但如果石墙距离很近（在检测范围内），仍然保持石墙目标
                    // 只有当石墙距离很远时，才清除石墙目标
                    if (distance <= detectionRange) {
                        console.debug(`[Enemy] findTarget: 路径可以绕行，但石墙距离较近(${distance.toFixed(1)})，保持石墙目标`);
                        return;
                    } else {
                        console.debug(`[Enemy] findTarget: 路径可以绕行且石墙距离较远(${distance.toFixed(1)})，清除石墙目标，继续查找其他目标`);
                        this.currentTarget = null!;
                        // 继续执行下面的逻辑，查找其他目标
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
        
        // 检查目标是否是石墙
        const targetScript = this.currentTarget.getComponent('StoneWall') as any;
        const isTargetStoneWall = !!targetScript;
        
        // 如果目标是石墙，使用简化的移动逻辑：直接移动到攻击范围内
        if (isTargetStoneWall) {
            // 检查是否已经在攻击范围内
            if (distance <= this.attackRange) {
                // 已经在攻击范围内，停止移动，让update()方法处理攻击
                console.debug(`[Enemy] moveTowardsTarget: 目标石墙已在攻击范围内(距离: ${distance.toFixed(1)}, 攻击范围: ${this.attackRange})，停止移动`);
                return;
            }
            
            // 直接向石墙移动，即使检测到碰撞也要继续移动，直到进入攻击范围
            direction.normalize();
            const moveStep = this.moveSpeed * deltaTime;
            const newPos = new Vec3();
            Vec3.scaleAndAdd(newPos, this.node.worldPosition, direction, moveStep);
            
            // 检查新位置到石墙的距离
            const newDistance = Vec3.distance(newPos, this.currentTarget.worldPosition);
            
            // 如果移动后距离小于等于攻击范围，允许移动到该位置（即使检测到碰撞）
            if (newDistance <= this.attackRange) {
                // 移动后会在攻击范围内，正常移动（忽略碰撞检测）
                console.debug(`[Enemy] moveTowardsTarget: 向石墙移动，当前位置(${this.node.worldPosition.x.toFixed(1)}, ${this.node.worldPosition.y.toFixed(1)}), 石墙位置(${this.currentTarget.worldPosition.x.toFixed(1)}, ${this.currentTarget.worldPosition.y.toFixed(1)}), 新位置(${newPos.x.toFixed(1)}, ${newPos.y.toFixed(1)}), 当前距离: ${distance.toFixed(1)}, 新距离: ${newDistance.toFixed(1)}, 攻击范围: ${this.attackRange}`);
                
                const clampedPos = this.clampPositionToScreen(newPos);
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
                Vec3.subtract(moveToRangeDirection, attackRangePos, this.node.worldPosition);
                const moveToRangeDistance = moveToRangeDirection.length();
                
                if (moveToRangeDistance > moveStep) {
                    // 还需要移动，计算新位置
                    moveToRangeDirection.normalize();
                    Vec3.scaleAndAdd(newPos, this.node.worldPosition, moveToRangeDirection, moveStep);
                    
                    console.debug(`[Enemy] moveTowardsTarget: 向石墙攻击范围边缘移动，当前位置(${this.node.worldPosition.x.toFixed(1)}, ${this.node.worldPosition.y.toFixed(1)}), 石墙位置(${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)}), 新位置(${newPos.x.toFixed(1)}, ${newPos.y.toFixed(1)}), 当前距离: ${distance.toFixed(1)}, 攻击范围: ${this.attackRange}`);
                    
                    const clampedPos = this.clampPositionToScreen(newPos);
                    this.node.setWorldPosition(clampedPos);
                    this.flipDirection(moveToRangeDirection);
                    this.playWalkAnimation();
                } else {
                    // 已经到达攻击范围边缘，直接移动到该位置
                    console.debug(`[Enemy] moveTowardsTarget: 已到达石墙攻击范围边缘，当前位置(${this.node.worldPosition.x.toFixed(1)}, ${this.node.worldPosition.y.toFixed(1)}), 石墙位置(${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)}), 攻击范围边缘(${attackRangePos.x.toFixed(1)}, ${attackRangePos.y.toFixed(1)}), 当前距离: ${distance.toFixed(1)}, 攻击范围: ${this.attackRange}`);
                    
                    const clampedPos = this.clampPositionToScreen(attackRangePos);
                    this.node.setWorldPosition(clampedPos);
                    this.flipDirection(direction);
                }
            }
            return;
        }
        
        // 非石墙目标的移动逻辑（保持原有逻辑）
        if (distance > 0.1) {
            direction.normalize();
            const newPos = new Vec3();
            Vec3.scaleAndAdd(newPos, this.node.worldPosition, direction, this.moveSpeed * deltaTime);
            
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

    moveTowardsCrystal(deltaTime: number) {
        if (!this.targetCrystal || !this.targetCrystal.isValid) {
            return;
        }

        // 在移动前检查路径是否被石墙阻挡且无法绕行
        // 如果路径被阻挡且无法绕行，立即攻击最近的石墙
        const blockedStoneWall = this.checkPathBlockedByStoneWall();
        if (blockedStoneWall) {
            // 路径被石墙阻挡且无法绕行，立即设置为攻击目标
            console.debug(`[Enemy] moveTowardsCrystal: 路径被石墙阻挡且无法绕行，设置石墙为攻击目标`);
            this.currentTarget = blockedStoneWall;
            // 清除绕行目标点
            this.detourTarget = null;
            this.removeDetourMarker();
            return;
        }

        // 如果有绕行目标点，优先移动到绕行目标点（不检查其他目标）
        if (this.detourTarget) {
            const enemyWorldPos = this.node.worldPosition;
            const toDetour = new Vec3();
            Vec3.subtract(toDetour, this.detourTarget, enemyWorldPos);
            const detourDistance = toDetour.length();
            
            // 如果已经到达绕行目标点（距离小于阈值），清除绕行目标点，继续向水晶移动
            if (detourDistance < 20) {
                console.debug(`[Enemy] moveTowardsCrystal: 已到达绕行目标点，清除绕行目标，继续向水晶移动`);
                this.detourTarget = null;
                this.removeDetourMarker();
                // 清除目标，确保继续向水晶移动
                this.currentTarget = null!;
            } else {
                // 向绕行目标点移动
                toDetour.normalize();
                const moveDistance = this.moveSpeed * deltaTime;
                const newPos = new Vec3();
                Vec3.scaleAndAdd(newPos, enemyWorldPos, toDetour, moveDistance);
                
                // 检查移动路径上是否有石墙阻挡
                if (!this.checkCollisionWithStoneWall(newPos)) {
                    const clampedPos = this.clampPositionToScreen(newPos);
                    this.node.setWorldPosition(clampedPos);
                    this.flipDirection(toDetour);
                    this.playWalkAnimation();
                    console.debug(`[Enemy] moveTowardsCrystal: 向绕行目标点移动，距离: ${detourDistance.toFixed(1)}像素`);
                    return;
                } else {
                    // 绕行路径也被阻挡，清除绕行目标点，重新检测
                    console.debug(`[Enemy] moveTowardsCrystal: 绕行路径也被阻挡，清除绕行目标点，重新检测`);
                    this.detourTarget = null;
                    this.removeDetourMarker();
                }
            }
        }

        // 在移动前检查路径上是否有战争古树或防御塔或石墙
        // 注意：如果有绕行目标点，不会执行到这里
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
    calculateDetourPosition(direction: Vec3, deltaTime: number): Vec3 | null {
        const moveDistance = this.moveSpeed * deltaTime;
        const perpendicular = new Vec3(-direction.y, direction.x, 0); // 垂直于移动方向的方向
        
        // 使用较小的偏移距离，让移动更平滑
        const offsetDistances = [30, 50, 80]; // 逐步增加偏移距离
        
        console.debug(`[Enemy] calculateDetourPosition: 当前位置(${this.node.worldPosition.x.toFixed(1)}, ${this.node.worldPosition.y.toFixed(1)}), 移动方向(${direction.x.toFixed(2)}, ${direction.y.toFixed(2)}), 移动距离: ${moveDistance.toFixed(1)}`);
        
        // 尝试不同偏移距离的绕路
        for (const offsetDistance of offsetDistances) {
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
            
            // 尝试右侧绕路
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
        }
        
        // 无法找到可行的绕路位置
        console.debug(`[Enemy] calculateDetourPosition: 所有绕路尝试都失败`);
        return null;
    }

    /**
     * 检查位置是否与石墙碰撞
     * @param position 要检查的位置
     * @returns 如果与石墙碰撞返回true，否则返回false
     */
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

    checkCollisionWithStoneWall(position: Vec3): boolean {
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
            console.info(`[Enemy] checkPathBlockedByStoneWall: 从StoneWalls容器找到 ${containerWalls.length} 个石墙节点`);
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
            console.info(`[Enemy] checkPathBlockedByStoneWall: 递归查找场景找到 ${sceneWalls.length} 个石墙节点`);
            
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
        
        console.info(`[Enemy] checkPathBlockedByStoneWall: 最终有效的石墙数量: ${stoneWalls.length}`);
        
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
        console.info(`[Enemy] checkPathBlockedByStoneWall: 检测到${blockingWalls.length}个阻挡石墙，分为${wallGroups.length}个连接组 [${groupInfo}]`);

        // 改进的绕行检测：尝试多个角度和距离的组合
        // perpendicular已经在上面计算过了，直接使用
        
        // 增加更多偏移距离，确保能够检测到所有可能的绕行路径（包括更大的距离）
        const offsetDistances = [50, 70, 90, 110, 130, 150, 180, 220, 260, 300, 400, 500, 600, 750]; 
        // 尝试更多角度，包括左右两侧的所有可能方向
        const angles = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, -10, -20, -30, -40, -50, -60, -70, -80, -90]; 
        let canDetour = false;

        // 优先检测左右两侧（最常见的绕行方向），使用计算出的最小绕行距离
        // 计算需要绕过整个障碍物组的最小距离
        const minDetourDistance = this.calculateMinDetourDistance(enemyPos, crystalPos, wallGroups, perpendicular);
        console.info(`[Enemy] checkPathBlockedByStoneWall: 开始检测绕行路径，最小绕行距离: ${minDetourDistance.toFixed(1)}像素`);
        
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
            // 如果障碍物在右侧，优先选择左侧绕行；如果障碍物在左侧，优先选择右侧绕行
            if (obstacleSide > 0) {
                // 障碍物在右侧，优先选择左侧绕行
                console.info(`[Enemy] checkPathBlockedByStoneWall: ✓ 找到左侧绕行路径！偏移距离: ${optimalDetourDistance}像素`);
                this.detourTarget = clampedLeftOffset.clone();
                this.createDetourMarker(clampedLeftOffset);
                canDetour = true;
            } else {
                // 障碍物在左侧或中间，优先选择右侧绕行
                console.info(`[Enemy] checkPathBlockedByStoneWall: ✓ 找到右侧绕行路径！偏移距离: ${optimalDetourDistance}像素`);
                this.detourTarget = clampedRightOffset.clone();
                this.createDetourMarker(clampedRightOffset);
                canDetour = true;
            }
        } else if (leftCanDetour) {
            console.info(`[Enemy] checkPathBlockedByStoneWall: ✓ 找到左侧绕行路径！偏移距离: ${optimalDetourDistance}像素`);
            this.detourTarget = clampedLeftOffset.clone();
            this.createDetourMarker(clampedLeftOffset);
            canDetour = true;
        } else if (rightCanDetour) {
            console.info(`[Enemy] checkPathBlockedByStoneWall: ✓ 找到右侧绕行路径！偏移距离: ${optimalDetourDistance}像素`);
            this.detourTarget = clampedRightOffset.clone();
            this.createDetourMarker(clampedRightOffset);
            canDetour = true;
        } else {
            // 使用最优距离无法绕行，尝试更大的距离
            const fallbackDistances = [optimalDetourDistance + 50, optimalDetourDistance + 100, optimalDetourDistance + 150, optimalDetourDistance + 200, optimalDetourDistance + 300, optimalDetourDistance + 400, optimalDetourDistance + 500];
            for (const offsetDistance of fallbackDistances) {
                // 检测左侧绕行（正方向）
                const leftOffsetFallback = new Vec3();
                Vec3.scaleAndAdd(leftOffsetFallback, enemyPos, perpendicular, offsetDistance);
                if (this.checkPathClearAroundObstacles(leftOffsetFallback, crystalPos, wallGroups, stoneWalls)) {
                    console.info(`[Enemy] checkPathBlockedByStoneWall: ✓ 找到左侧绕行路径（备用距离）！偏移距离: ${offsetDistance}像素`);
                    const clampedLeftOffsetFallback = this.clampPositionToScreen(leftOffsetFallback);
                    this.detourTarget = clampedLeftOffsetFallback.clone();
                    this.createDetourMarker(clampedLeftOffsetFallback);
                    canDetour = true;
                    break;
                }
                
                // 检测右侧绕行（负方向）
                const rightOffsetFallback = new Vec3();
                Vec3.scaleAndAdd(rightOffsetFallback, enemyPos, perpendicular, -offsetDistance);
                if (this.checkPathClearAroundObstacles(rightOffsetFallback, crystalPos, wallGroups, stoneWalls)) {
                    console.info(`[Enemy] checkPathBlockedByStoneWall: ✓ 找到右侧绕行路径（备用距离）！偏移距离: ${offsetDistance}像素`);
                    const clampedRightOffsetFallback = this.clampPositionToScreen(rightOffsetFallback);
                    this.detourTarget = clampedRightOffsetFallback.clone();
                    this.createDetourMarker(clampedRightOffsetFallback);
                    canDetour = true;
                    break;
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
                        console.info(`[Enemy] checkPathBlockedByStoneWall: ✓ 找到绕行路径！偏移距离: ${offsetDistance}像素, 角度: ${angleDeg}度`);
                        // 保存绕行目标点，限制在地图范围内
                        const clampedOffsetPos = this.clampPositionToScreen(offsetPos);
                        this.detourTarget = clampedOffsetPos.clone();
                        this.createDetourMarker(clampedOffsetPos);
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
            console.info(`[Enemy] checkPathBlockedByStoneWall: ✗ 所有绕行尝试都失败，路径被石墙完全阻挡，需要攻击石墙`);
            // 清除绕行目标点
            this.detourTarget = null;
            this.removeDetourMarker();
            return nearestWall;
        }

        // 可以绕行，返回null（绕行目标点已保存在this.detourTarget中）
        console.info(`[Enemy] checkPathBlockedByStoneWall: ✓ 找到可绕行路径，绕行目标点: (${this.detourTarget!.x.toFixed(1)}, ${this.detourTarget!.y.toFixed(1)})`);
        return null;
    }

    /**
     * 将连接在一起的石墙分组（视为整体障碍物）
     * 如果两个石墙之间的间距小于敌人碰撞体积，则视为连接在一起
     */
    private groupConnectedWalls(blockingWalls: Node[], allWalls: Node[]): Node[][] {
        const enemyRadius = 20; // 敌人的碰撞半径
        const minGap = enemyRadius * 2; // 最小可通过间距（40像素）
        // 增加额外的连接容差，确保紧密排列的石墙能被正确识别
        const connectionTolerance = 60; // 额外的连接容差（像素）
        const groups: Node[][] = [];
        const processed = new Set<Node>();

        console.info(`[Enemy] groupConnectedWalls: 开始分组，blockingWalls数量: ${blockingWalls.length}, allWalls数量: ${allWalls.length}`);

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

                // 检查所有石墙，找到连接的石墙（包括不在blockingWalls中的石墙）
                for (const otherWall of allWalls) {
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
                    const minDistance = currentRadius + otherRadius;
                    // 放宽连接判断：使用更大的阈值，确保紧密排列的石墙能被识别
                    const connectionThreshold = minDistance + minGap + connectionTolerance;

                    totalChecked++;
                    
                    // 如果间距小于连接阈值，视为连接
                    if (distance < connectionThreshold) {
                        connectionsFound++;
                        console.info(`[Enemy] groupConnectedWalls: 发现连接石墙！距离: ${distance.toFixed(1)}, 阈值: ${connectionThreshold.toFixed(1)}, 当前组大小: ${group.length + 1}, 当前石墙位置: (${currentPos.x.toFixed(1)}, ${currentPos.y.toFixed(1)}), 连接石墙位置: (${otherPos.x.toFixed(1)}, ${otherPos.y.toFixed(1)})`);
                        group.push(otherWall);
                        processed.add(otherWall);
                        queue.push(otherWall);
                    }
                }
            }

            console.info(`[Enemy] groupConnectedWalls: 完成一组，组大小: ${group.length}, 检查了 ${totalChecked} 个石墙，找到 ${connectionsFound} 个连接`);
            groups.push(group);
        }

        const totalWallsInGroups = groups.reduce((sum, g) => sum + g.length, 0);
        console.info(`[Enemy] groupConnectedWalls: 分组完成，共 ${groups.length} 个组，总石墙数: ${totalWallsInGroups}`);
        
        // 如果分组后的石墙数量少于allWalls，输出警告
        if (totalWallsInGroups < allWalls.length) {
            console.warn(`[Enemy] groupConnectedWalls: 警告！分组后的石墙数量(${totalWallsInGroups})少于总石墙数量(${allWalls.length})，可能有石墙未被分组`);
        }
        
        return groups;
    }

    /**
     * 计算绕过障碍物组所需的最小距离
     */
    private calculateMinDetourDistance(enemyPos: Vec3, crystalPos: Vec3, wallGroups: Node[][], perpendicular: Vec3): number {
        let maxRequiredDistance = 0;

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
     * 创建绕行点高亮标记
     */
    private createDetourMarker(position: Vec3) {
        // 先移除旧的标记
        this.removeDetourMarker();

        // 创建标记节点
        this.detourMarkerNode = new Node('DetourMarker');
        
        // 将标记节点添加到场景根节点或Canvas
        const canvas = find('Canvas');
        if (canvas) {
            this.detourMarkerNode.setParent(canvas);
        } else if (this.node.scene) {
            this.detourMarkerNode.setParent(this.node.scene);
        } else {
            console.warn('[Enemy] createDetourMarker: 无法找到Canvas或场景根节点，无法创建标记');
            return;
        }

        // 设置位置
        this.detourMarkerNode.setWorldPosition(position);

        // 添加Graphics组件绘制高亮标记
        const graphics = this.detourMarkerNode.addComponent(Graphics);
        graphics.strokeColor = new Color(255, 0, 0, 255); // 红色边框
        graphics.fillColor = new Color(255, 0, 0, 100); // 半透明红色填充
        graphics.lineWidth = 4;

        // 绘制圆形标记
        const radius = 30; // 标记半径
        graphics.circle(0, 0, radius);
        graphics.fill();
        graphics.stroke();

        // 绘制内部十字标记
        graphics.strokeColor = new Color(255, 255, 255, 255); // 白色十字
        graphics.lineWidth = 3;
        graphics.moveTo(-radius * 0.7, 0);
        graphics.lineTo(radius * 0.7, 0);
        graphics.stroke();
        graphics.moveTo(0, -radius * 0.7);
        graphics.lineTo(0, radius * 0.7);
        graphics.stroke();

        console.info(`[Enemy] createDetourMarker: 创建绕行点标记，位置: (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
    }

    /**
     * 移除绕行点高亮标记
     */
    private removeDetourMarker() {
        if (this.detourMarkerNode && this.detourMarkerNode.isValid) {
            this.detourMarkerNode.destroy();
            this.detourMarkerNode = null;
            console.debug('[Enemy] removeDetourMarker: 移除绕行点标记');
        }
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
        if (this.isPlayingDeathAnimation || this.isDestroyed) {
            console.debug('Enemy.playAttackAnimation: Is playing death animation or destroyed, returning');
            return;
        }

        // 停止所有动画
        this.stopAllAnimations();
        
        // 设置攻击动画状态
        this.isPlayingAttackAnimation = true;
        
        // 使用Animation组件播放攻击动画
        if (this.animationComponent) {
            console.debug('Enemy.playAttackAnimation: Using Animation component');
            // 清除之前的动画事件
            this.animationComponent.off(Animation.EventType.FINISHED);
            
            // 先停止当前可能正在播放的动画，确保每次都能重新开始
            this.animationComponent.stop();
            
            // 播放攻击动画
            console.debug(`Enemy.playAttackAnimation: Playing animation ${this.attackAnimationName}`);
            
            // 获取动画状态，设置动画速度与attackAnimationDuration保持同步
            const state = this.animationComponent.getState(this.attackAnimationName);
            if (state) {
                // 重置动画播放头到开始位置
                state.time = 0;
                // 设置动画时长与attackAnimationDuration参数保持一致
                state.speed = state.duration / this.attackAnimationDuration;
                console.debug(`Enemy.playAttackAnimation: Animation state found, duration: ${state.duration}, speed: ${state.speed}`);
            }
            
            // 播放动画
            this.animationComponent.play(this.attackAnimationName);
            
            // 不使用动画事件，而是使用定时器方式来处理攻击回调
            // 攻击动画播放完成时调用攻击回调和结束动画
            const finishTimer = this.attackAnimationDuration; // 攻击动画播放完成时触发
            
            // 攻击动画播放完成时调用攻击回调并结束动画
            this.scheduleOnce(() => {
                if (this.isPlayingAttackAnimation) {
                    console.debug('Enemy.playAttackAnimation: Attack animation finished, calling attack callback and stopping animation');
                    
                    // 调用攻击回调函数
                    if (this.attackCallback) {
                        this.attackCallback();
                        this.attackCallback = null;
                    }
                    
                    // 播放攻击音效
                    if (this.attackSound) {
                        console.debug('Enemy.playAttackAnimation: Playing attack sound');
                        AudioManager.Instance.playSFX(this.attackSound);
                    }
                    
                    // 结束动画
                    this.isPlayingAttackAnimation = false;
                    
                    // 动画结束后切换回待机动画
                    this.playIdleAnimation();
                }
            }, finishTimer);
        } else {
            console.debug('Enemy.playAttackAnimation: No Animation component, using frame animation');
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
            console.debug('Enemy.attack: No target or destroyed, returning');
            return;
        }

        // 再次检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            console.debug('Enemy.attack: Target is invalid or inactive, returning');
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
            console.debug('Enemy.attackCallback: Attack callback called');
            if (currentTarget && currentTarget.isValid && currentTarget.active) {
                const towerScript = currentTarget.getComponent('Arrower') as any;
                const warAncientTreeScript = currentTarget.getComponent('WarAncientTree') as any;
                const normalTreeScript = currentTarget.getComponent('Tree') as any;
                const wellScript = currentTarget.getComponent('MoonWell') as any;
                const hallScript = currentTarget.getComponent('HunterHall') as any;
                const swordsmanHallScript = currentTarget.getComponent('SwordsmanHall') as any;
                const crystalScript = currentTarget.getComponent('Crystal') as any;
                const wispScript = currentTarget.getComponent('Wisp') as any;
                const hunterScript = currentTarget.getComponent('Hunter') as any;
                const elfSwordsmanScript = currentTarget.getComponent('ElfSwordsman') as any;
                const stoneWallScript = currentTarget.getComponent('StoneWall') as any;
                const targetScript = towerScript || warAncientTreeScript || normalTreeScript || wellScript || hallScript || swordsmanHallScript || crystalScript || wispScript || hunterScript || elfSwordsmanScript || stoneWallScript;
                
                if (targetScript && targetScript.takeDamage) {
                    targetScript.takeDamage(this.attackDamage);
                    // 根据目标类型输出日志
                    if (towerScript) {
                        console.debug(`Enemy.attackCallback: Attacked arrower, dealt ${this.attackDamage} damage`);
                    } else if (warAncientTreeScript) {
                        console.debug(`Enemy.attackCallback: Attacked war ancient tree, dealt ${this.attackDamage} damage`);
                    } else if (normalTreeScript) {
                        console.debug(`Enemy.attackCallback: Attacked normal tree, dealt ${this.attackDamage} damage`);
                    } else if (wellScript) {
                        console.debug(`Enemy.attackCallback: Attacked moon well, dealt ${this.attackDamage} damage`);
                    } else if (hallScript) {
                        console.debug(`Enemy.attackCallback: Attacked hunter hall, dealt ${this.attackDamage} damage`);
                    } else if (swordsmanHallScript) {
                        console.debug(`Enemy.attackCallback: Attacked swordsman hall, dealt ${this.attackDamage} damage`);
                    } else if (crystalScript) {
                        console.debug(`Enemy.attackCallback: Attacked crystal, dealt ${this.attackDamage} damage`);
                    } else if (wispScript) {
                        console.debug(`Enemy.attackCallback: Attacked wisp, dealt ${this.attackDamage} damage`);
                    } else if (hunterScript) {
                        console.debug(`Enemy.attackCallback: Attacked hunter, dealt ${this.attackDamage} damage`);
                    } else if (elfSwordsmanScript) {
                        console.debug(`Enemy.attackCallback: Attacked elf swordsman, dealt ${this.attackDamage} damage`);
                    } else if (stoneWallScript) {
                        console.debug(`Enemy.attackCallback: Attacked stone wall, dealt ${this.attackDamage} damage`);
                    }
                } else {
                    // 目标无效，清除目标
                    console.debug('Enemy.attackCallback: Target is invalid, clearing target');
                    this.currentTarget = null!;
                }
            } else {
                console.debug('Enemy.attackCallback: Current target is invalid or inactive');
            }
        };

        // 播放攻击动画
        console.debug('Enemy.attack: Playing attack animation:', this.attackAnimationName);
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
        
        // 移除绕行点标记
        this.removeDetourMarker();
        
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
}


