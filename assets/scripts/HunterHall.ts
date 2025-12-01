import { _decorator, Component, Node, Vec3, Prefab, instantiate, find, Sprite, SpriteFrame, Color, Graphics, UITransform, Label, EventTouch } from 'cc';
import { GameManager } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
import { UnitSelectionManager } from './UnitSelectionManager';
import { UnitInfo } from './UnitInfoPanel';
import { SelectionManager } from './SelectionManager';
import { UnitType } from './WarAncientTree';
const { ccclass, property } = _decorator;

@ccclass('HunterHall')
export class HunterHall extends Component {
    @property
    maxHealth: number = 100;

    @property(Prefab)
    hunterPrefab: Prefab = null!; // 生产的Hunter预制体

    @property(Prefab)
    explosionEffect: Prefab = null!;

    @property(Prefab)
    damageNumberPrefab: Prefab = null!;

    @property
    buildCost: number = 10; // 建造成本

    @property
    level: number = 1; // 猎手大厅等级

    @property
    collisionRadius: number = 50; // 占地范围（像素）

    @property(SpriteFrame)
    cardIcon: SpriteFrame = null!; // 单位名片图片

    // 单位类型
    public unitType: UnitType = UnitType.BUILDING;

    // 生产相关属性
    @property
    maxHunterCount: number = 4; // 最多生产4个Hunter

    @property
    productionInterval: number = 2.0; // 每2秒生产一个

    @property
    spawnOffset: number = 100; // Hunter出现在下方100像素

    @property
    moveAwayDistance: number = 80; // Hunter生成后往前跑开的距离

    private currentHealth: number = 100;
    private healthBar: HealthBar = null!;
    private healthBarNode: Node = null!;
    private productionProgressBar: Node = null!; // 生产进度条节点
    private productionProgressGraphics: Graphics = null!; // 生产进度条Graphics组件
    private isDestroyed: boolean = false;
    private gameManager: GameManager = null!;
    private sprite: Sprite = null!;
    private defaultSpriteFrame: SpriteFrame = null!;
    private defaultScale: Vec3 = new Vec3(1, 1, 1);

    // 生产相关
    private producedHunters: Node[] = []; // 已生产的Hunter列表
    private productionTimer: number = 0; // 生产计时器
    private productionProgress: number = 0; // 生产进度（0-1）
    private isProducing: boolean = false; // 是否正在生产
    private hunterContainer: Node = null!; // Hunter容器
    
    // 小精灵相关
    private attachedWisps: Node[] = []; // 依附的小精灵列表

    // 选择面板相关
    private selectionPanel: Node = null!; // 选择面板节点
    private globalTouchHandler: ((event: EventTouch) => void) | null = null; // 全局触摸事件处理器
    private unitSelectionManager: UnitSelectionManager = null!; // 单位选择管理器

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.producedHunters = [];
        this.productionTimer = 0;
        this.productionProgress = 0;
        this.isProducing = false;
        this.attachedWisps = [];

        // 获取Sprite组件
        this.sprite = this.node.getComponent(Sprite);
        if (this.sprite && this.sprite.spriteFrame) {
            this.defaultSpriteFrame = this.sprite.spriteFrame;
        }
        this.defaultScale = this.node.scale.clone();

        // 查找游戏管理器
        this.findGameManager();

        // 查找单位选择管理器
        this.findUnitSelectionManager();

        // 查找Hunter容器
        this.findHunterContainer();

        // 创建血条
        this.createHealthBar();

        // 创建生产进度条
        this.createProductionProgressBar();

        // 添加点击事件监听
        this.node.on(Node.EventType.TOUCH_END, this.onHunterHallClick, this);
    }

    findGameManager() {
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

        let gmNode = find('GameManager');
        if (!gmNode && this.node.scene) {
            gmNode = findNodeRecursive(this.node.scene, 'GameManager');
        }
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager);
        }
    }

    /**
     * 查找单位选择管理器
     */
    findUnitSelectionManager() {
        // 方法1: 通过节点名称查找
        let managerNode = find('UnitSelectionManager');
        if (managerNode) {
            this.unitSelectionManager = managerNode.getComponent(UnitSelectionManager);
            if (this.unitSelectionManager) {
                return;
            }
        }
        
        // 方法2: 从场景根节点递归查找UnitSelectionManager组件
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
            this.unitSelectionManager = findInScene(scene, UnitSelectionManager);
        }
    }

    findHunterContainer() {
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

        let huntersNode = find('Hunters');
        if (!huntersNode && this.node.scene) {
            huntersNode = findNodeRecursive(this.node.scene, 'Hunters');
        }
        if (huntersNode) {
            this.hunterContainer = huntersNode;
        } else {
            // 如果找不到，创建一个新的容器
            this.hunterContainer = new Node('Hunters');
            const canvas = find('Canvas');
            if (canvas) {
                this.hunterContainer.setParent(canvas);
            } else if (this.node.scene) {
                this.hunterContainer.setParent(this.node.scene);
            }
        }
    }

    createHealthBar() {
        this.healthBarNode = new Node('HealthBar');
        this.healthBarNode.setParent(this.node);
        this.healthBarNode.setPosition(0, 50, 0);

        this.healthBar = this.healthBarNode.addComponent(HealthBar);
        if (this.healthBar) {
            this.healthBar.setMaxHealth(this.maxHealth);
            this.healthBar.setHealth(this.currentHealth);
        }
    }

    createProductionProgressBar() {
        // 创建生产进度条节点（位于血量条下方）
        this.productionProgressBar = new Node('ProductionProgressBar');
        this.productionProgressBar.setParent(this.node);
        this.productionProgressBar.setPosition(0, 30, 0); // 血量条下方

        // 添加UITransform组件
        const uiTransform = this.productionProgressBar.addComponent(UITransform);
        uiTransform.setContentSize(40, 4);

        // 添加Graphics组件
        this.productionProgressGraphics = this.productionProgressBar.addComponent(Graphics);
        
        // 初始隐藏进度条
        this.productionProgressBar.active = false;
    }

    updateProductionProgressBar() {
        if (!this.productionProgressBar || !this.productionProgressGraphics) {
            return;
        }

        if (!this.isProducing) {
            this.productionProgressBar.active = false;
            return;
        }

        this.productionProgressBar.active = true;
        this.productionProgressGraphics.clear();

        const barWidth = 40;
        const barHeight = 4;
        const barX = -barWidth / 2;
        const barY = 0;

        // 绘制背景（灰色）
        this.productionProgressGraphics.fillColor = new Color(100, 100, 100, 255);
        this.productionProgressGraphics.rect(barX, barY, barWidth, barHeight);
        this.productionProgressGraphics.fill();

        // 绘制进度（蓝色）
        if (this.productionProgress > 0) {
            this.productionProgressGraphics.fillColor = new Color(0, 150, 255, 255);
            this.productionProgressGraphics.rect(barX, barY, barWidth * this.productionProgress, barHeight);
            this.productionProgressGraphics.fill();
        }
    }

    update(deltaTime: number) {
        if (this.isDestroyed) {
            return;
        }

        // 清理已死亡的Hunter
        this.cleanupDeadHunters();

        // 生产Hunter逻辑
        const aliveHunterCount = this.producedHunters.length;
        if (aliveHunterCount < this.maxHunterCount && this.gameManager.canAddPopulation(1)) {
            if (!this.isProducing) {
                // 开始生产
                this.isProducing = true;
                this.productionTimer = 0;
                this.productionProgress = 0;
                this.updateProductionProgressBar();
            }

            this.productionTimer += deltaTime;
            
            // 更新生产进度（每0.5秒前进一格，共4格）
            const progressStep = 0.5; // 每0.5秒一格
            const totalSteps = this.productionInterval / progressStep; // 总格数（2.0 / 0.5 = 4格）
            const currentStep = Math.floor(this.productionTimer / progressStep);
            this.productionProgress = Math.min(currentStep / totalSteps, 1.0);
            this.updateProductionProgressBar();

            if (this.productionTimer >= this.productionInterval) {
                this.produceHunter();
                this.productionTimer = 0;
                this.productionProgress = 0;
                this.isProducing = false;
                this.updateProductionProgressBar();
            }
        } else {
            // 已达到最大数量，停止生产
            if (this.isProducing) {
                this.isProducing = false;
                this.productionProgress = 0;
                this.updateProductionProgressBar();
            }
        }
    }

    produceHunter() {
        if (!this.hunterPrefab || !this.hunterContainer) {
            console.warn('HunterHall: Cannot produce hunter - prefab or container missing');
            return;
        }

        if (this.producedHunters.length >= this.maxHunterCount) {
            return;
        }

        // 检查人口上限
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        if (this.gameManager && !this.gameManager.canAddPopulation(1)) {
            console.debug('HunterHall: Cannot produce hunter - population limit reached');
            return;
        }

        // 计算Hunter出现位置（猎手大厅下方100像素）
        const hallPos = this.node.worldPosition.clone();
        let spawnPos = new Vec3(hallPos.x, hallPos.y - this.spawnOffset, hallPos.z);

        // 检查生成位置是否有单位，如果有则左右平移
        spawnPos = this.findAvailableSpawnPosition(spawnPos);

        // 增加人口（在创建Hunter之前）
        if (this.gameManager) {
            if (!this.gameManager.addPopulation(1)) {
                console.warn('HunterHall: Failed to add population, cannot produce hunter');
                return;
            }
        }

        // 创建Hunter
        const hunter = instantiate(this.hunterPrefab);
        hunter.setParent(this.hunterContainer);
        hunter.setWorldPosition(spawnPos);
        hunter.active = true;

        // 设置Hunter的建造成本（如果需要）
        const hunterScript = hunter.getComponent('Hunter') as any;
        if (hunterScript) {
            hunterScript.buildCost = 0; // 由猎手大厅生产的Hunter建造成本为0
        }

        // 添加到生产的Hunter列表
        this.producedHunters.push(hunter);

        // 计算Hunter的目标位置（向左右两侧跑开）
        // 根据已生产的Hunter数量，分散到不同位置
        const hunterIndex = this.producedHunters.length - 1;
        // 左右分散：偶数索引向右，奇数索引向左
        const directionX = (hunterIndex % 2 === 0 ? 1 : -1);
        
        // 计算目标位置（只改变x坐标，y坐标不变）
        const targetPos = new Vec3(
            spawnPos.x + directionX * this.moveAwayDistance,
            spawnPos.y, // y坐标保持不变
            spawnPos.z
        );

        // 让Hunter移动到目标位置
        if (hunterScript) {
            // 使用schedule在下一帧开始移动，确保Hunter已完全初始化
            this.scheduleOnce(() => {
                if (hunter && hunter.isValid && hunterScript) {
                    // 使用setManualMoveTargetPosition方法设置移动目标
                    if (hunterScript.setManualMoveTargetPosition) {
                        hunterScript.setManualMoveTargetPosition(targetPos);
                    } else if (hunterScript.moveToPosition) {
                        // 如果没有setManualMoveTargetPosition方法，使用moveToPosition
                        const moveUpdate = (deltaTime: number) => {
                            if (!hunter || !hunter.isValid || !hunterScript) {
                                this.unschedule(moveUpdate);
                                return;
                            }
                            
                            const currentPos = hunter.worldPosition;
                            const distance = Vec3.distance(currentPos, targetPos);
                            
                            if (distance <= 10) {
                                // 到达目标位置，停止移动
                                if (hunterScript.stopMoving) {
                                    hunterScript.stopMoving();
                                }
                                this.unschedule(moveUpdate);
                            } else {
                                // 继续移动
                                hunterScript.moveToPosition(targetPos, deltaTime);
                            }
                        };
                        this.schedule(moveUpdate, 0);
                    }
                }
            }, 0.1);
        }

        console.debug(`HunterHall: Produced hunter ${this.producedHunters.length}/${this.maxHunterCount} at position (${spawnPos.x.toFixed(2)}, ${spawnPos.y.toFixed(2)})`);
        
        // 更新单位信息面板（如果被选中）
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                currentUnitCount: this.producedHunters.length
            });
        }
    }

    findAvailableSpawnPosition(initialPos: Vec3): Vec3 {
        const checkRadius = 30; // Hunter的碰撞半径
        const offsetStep = 50; // 每次平移的距离（增大步长，确保不会重叠）
        const maxAttempts = 20; // 最多尝试20次（左右各10次）

        // 检查初始位置是否可用
        if (!this.hasUnitAtPosition(initialPos, checkRadius)) {
            console.debug(`HunterHall.findAvailableSpawnPosition: Initial position is available at (${initialPos.x.toFixed(1)}, ${initialPos.y.toFixed(1)})`);
            return initialPos;
        }

        console.debug(`HunterHall.findAvailableSpawnPosition: Initial position (${initialPos.x.toFixed(1)}, ${initialPos.y.toFixed(1)}) is occupied, searching for available position...`);

        // 尝试左右平移，交替检查左右两侧
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // 先尝试右侧
            const rightPos = new Vec3(initialPos.x + offsetStep * attempt, initialPos.y, initialPos.z);
            if (!this.hasUnitAtPosition(rightPos, checkRadius)) {
                console.debug(`HunterHall.findAvailableSpawnPosition: Found available position at right offset ${offsetStep * attempt}, position: (${rightPos.x.toFixed(1)}, ${rightPos.y.toFixed(1)})`);
                return rightPos;
            }

            // 再尝试左侧
            const leftPos = new Vec3(initialPos.x - offsetStep * attempt, initialPos.y, initialPos.z);
            if (!this.hasUnitAtPosition(leftPos, checkRadius)) {
                console.debug(`HunterHall.findAvailableSpawnPosition: Found available position at left offset ${offsetStep * attempt}, position: (${leftPos.x.toFixed(1)}, ${leftPos.y.toFixed(1)})`);
                return leftPos;
            }
        }

        // 如果左右平移都找不到，尝试上下方向
        console.debug(`HunterHall.findAvailableSpawnPosition: Horizontal search failed, trying vertical directions...`);
        for (let attempt = 1; attempt <= maxAttempts / 2; attempt++) {
            // 尝试上方
            const upPos = new Vec3(initialPos.x, initialPos.y + offsetStep * attempt, initialPos.z);
            if (!this.hasUnitAtPosition(upPos, checkRadius)) {
                console.debug(`HunterHall.findAvailableSpawnPosition: Found available position at up offset ${offsetStep * attempt}, position: (${upPos.x.toFixed(1)}, ${upPos.y.toFixed(1)})`);
                return upPos;
            }

            // 尝试下方
            const downPos = new Vec3(initialPos.x, initialPos.y - offsetStep * attempt, initialPos.z);
            if (!this.hasUnitAtPosition(downPos, checkRadius)) {
                console.debug(`HunterHall.findAvailableSpawnPosition: Found available position at down offset ${offsetStep * attempt}, position: (${downPos.x.toFixed(1)}, ${downPos.y.toFixed(1)})`);
                return downPos;
            }
        }

        // 如果所有位置都被占用，尝试对角线方向
        console.debug(`HunterHall.findAvailableSpawnPosition: Vertical search failed, trying diagonal directions...`);
        for (let attempt = 1; attempt <= maxAttempts / 2; attempt++) {
            const diagonalOffset = offsetStep * attempt;
            // 尝试四个对角线方向
            const positions = [
                new Vec3(initialPos.x + diagonalOffset, initialPos.y + diagonalOffset, initialPos.z), // 右上
                new Vec3(initialPos.x - diagonalOffset, initialPos.y + diagonalOffset, initialPos.z), // 左上
                new Vec3(initialPos.x + diagonalOffset, initialPos.y - diagonalOffset, initialPos.z), // 右下
                new Vec3(initialPos.x - diagonalOffset, initialPos.y - diagonalOffset, initialPos.z), // 左下
            ];

            for (const pos of positions) {
                if (!this.hasUnitAtPosition(pos, checkRadius)) {
                    console.debug(`HunterHall.findAvailableSpawnPosition: Found available position at diagonal offset, position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
                    return pos;
                }
            }
        }

        // 如果所有位置都被占用，返回初始位置（让Hunter自己处理碰撞）
        console.warn(`HunterHall.findAvailableSpawnPosition: Could not find available spawn position after ${maxAttempts * 2} attempts, using initial position`);
        return initialPos;
    }

    hasUnitAtPosition(position: Vec3, radius: number): boolean {
        const minDistance = radius * 2; // 最小距离（两个半径）

        // 检查与水晶的碰撞
        const crystal = find('Crystal');
        if (crystal && crystal.isValid && crystal.active) {
            const distance = Vec3.distance(position, crystal.worldPosition);
            const crystalRadius = 50;
            // 使用安全距离，确保不会重叠
            const minDistance = (radius + crystalRadius) * 1.1;
            if (distance < minDistance) {
                return true;
            }
        }

        // 检查与其他Hunter的碰撞
        // 每次都重新查找Hunters节点，确保获取到所有Hunter（包括手动建造的）
        const findHuntersNodeRecursive = (node: Node, name: string): Node | null => {
            if (node.name === name) {
                return node;
            }
            for (const child of node.children) {
                const found = findHuntersNodeRecursive(child, name);
                if (found) return found;
            }
            return null;
        };

        let huntersNode = find('Hunters');
        if (!huntersNode && this.node.scene) {
            huntersNode = findHuntersNodeRecursive(this.node.scene, 'Hunters');
        }
        
        if (huntersNode) {
            const hunters = huntersNode.children || [];
            console.debug(`HunterHall.hasUnitAtPosition: Checking ${hunters.length} hunters at position (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
            
            for (const hunter of hunters) {
                if (hunter && hunter.isValid && hunter.active) {
                    const hunterScript = hunter.getComponent('Hunter') as any;
                    if (hunterScript && hunterScript.isAlive && hunterScript.isAlive()) {
                        // 获取Hunter的实时位置（包括正在移动的Hunter）
                        const hunterPos = hunter.worldPosition;
                        const distance = Vec3.distance(position, hunterPos);
                        const otherRadius = hunterScript.collisionRadius || radius;
                        // 使用1.2倍的安全距离，确保不会重叠（和Hunter的checkCollisionAtPosition保持一致）
                        const minDistance = (radius + otherRadius) * 1.2;
                        
                        if (distance < minDistance) {
                            // 检查是否是自己生产的Hunter
                            let isProducedHunter = false;
                            for (const producedHunter of this.producedHunters) {
                                if (producedHunter === hunter) {
                                    isProducedHunter = true;
                                    break;
                                }
                            }
                            
                            if (isProducedHunter) {
                                console.debug(`HunterHall.hasUnitAtPosition: Collision detected with produced Hunter at distance ${distance.toFixed(1)}, minDistance: ${minDistance.toFixed(1)}, hunterPos: (${hunterPos.x.toFixed(1)}, ${hunterPos.y.toFixed(1)})`);
                            } else {
                                console.debug(`HunterHall.hasUnitAtPosition: Collision detected with other Hunter at distance ${distance.toFixed(1)}, minDistance: ${minDistance.toFixed(1)}, hunterPos: (${hunterPos.x.toFixed(1)}, ${hunterPos.y.toFixed(1)})`);
                            }
                            return true;
                        }
                    }
                }
            }
        } else {
            console.warn('HunterHall.hasUnitAtPosition: Hunters node not found!');
        }

        // 检查与猎手大厅的碰撞
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

        let hallsNode = find('HunterHalls');
        if (!hallsNode && this.node.scene) {
            hallsNode = findNodeRecursive(this.node.scene, 'HunterHalls');
        }
        
        if (hallsNode) {
            const halls = hallsNode.children || [];
            for (const hall of halls) {
                if (hall && hall.isValid && hall.active && hall !== this.node) {
                    const hallScript = hall.getComponent('HunterHall') as any;
                    if (hallScript && hallScript.isAlive && hallScript.isAlive()) {
                        const distance = Vec3.distance(position, hall.worldPosition);
                        const hallRadius = 50; // 猎手大厅的半径
                        // 使用安全距离，确保不会重叠
                        const minDistance = (radius + hallRadius) * 1.1;
                        if (distance < minDistance) {
                            return true;
                        }
                    }
                }
            }
        }

        // 检查与敌人的碰撞
        const enemiesNode = find('Enemies');
        if (enemiesNode) {
            const enemies = enemiesNode.children || [];
            for (const enemy of enemies) {
                if (enemy && enemy.isValid && enemy.active) {
                    const enemyScript = enemy.getComponent('Enemy') as any;
                    if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
                        const distance = Vec3.distance(position, enemy.worldPosition);
                        const enemyRadius = 30;
                        // 使用安全距离，确保不会重叠
                        const minDistance = (radius + enemyRadius) * 1.1;
                        if (distance < minDistance) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    cleanupDeadHunters() {
        // 清理已死亡的Hunter
        const beforeCount = this.producedHunters.length;
        this.producedHunters = this.producedHunters.filter(hunter => {
            if (!hunter || !hunter.isValid || !hunter.active) {
                // Hunter已死亡，减少人口
                if (this.gameManager) {
                    this.gameManager.removePopulation(1);
                }
                return false;
            }
            
            const hunterScript = hunter.getComponent('Hunter') as any;
            if (hunterScript && hunterScript.isAlive) {
                const isAlive = hunterScript.isAlive();
                if (!isAlive) {
                    // Hunter已死亡，减少人口
                    if (this.gameManager) {
                        this.gameManager.removePopulation(1);
                    }
                }
                return isAlive;
            }
            
            return true;
        });
        
        const afterCount = this.producedHunters.length;
        if (beforeCount !== afterCount) {
            console.debug(`HunterHall.cleanupDeadHunters: Removed ${beforeCount - afterCount} dead hunters, remaining: ${afterCount}`);
            
            // 更新单位信息面板（如果被选中）
            if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
                this.unitSelectionManager.updateUnitInfo({
                    currentUnitCount: this.producedHunters.length
                });
            }
        }
    }

    /**
     * 恢复血量（由小精灵调用）
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
    }

    takeDamage(damage: number) {
        if (this.isDestroyed) {
            return;
        }

        this.currentHealth -= damage;

        // 显示伤害数字
        if (this.damageNumberPrefab) {
            const damageNode = instantiate(this.damageNumberPrefab);
            const canvas = find('Canvas');
            if (canvas) {
                damageNode.setParent(canvas);
            } else if (this.node.scene) {
                damageNode.setParent(this.node.scene);
            }
            damageNode.setWorldPosition(this.node.worldPosition.clone().add3f(0, 50, 0));
            const damageScript = damageNode.getComponent(DamageNumber);
            if (damageScript) {
                damageScript.setDamage(damage);
            }
        }

        // 更新血条
        if (this.healthBar) {
            this.healthBar.setHealth(this.currentHealth);
        }

        if (this.currentHealth <= 0) {
            this.die();
        }
    }

    die() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;

        // 卸下所有依附的小精灵，让它们出现在建筑物下方
        while (this.attachedWisps.length > 0) {
            // 先从列表中移除小精灵，再处理，避免null引用
            const wisp = this.attachedWisps.shift();
            if (wisp && wisp.isValid) {
                const wispScript = wisp.getComponent('Wisp') as any;
                if (wispScript && wispScript.detachFromBuilding) {
                    wispScript.detachFromBuilding();
                }
            }
        }

        // 播放爆炸特效
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

        // 销毁节点
        this.node.destroy();
    }

    isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }

    /**
     * 猎手大厅点击事件
     */
    onHunterHallClick(event: EventTouch) {
        console.debug('HunterHall.onHunterHallClick: Entering method');
        // 检查是否有选中的小精灵，如果有则不处理点击事件（让小精灵移动到建筑物）
        const selectionManager = this.findSelectionManager();
        console.debug('HunterHall.onHunterHallClick: Found selectionManager:', selectionManager ? 'yes' : 'no');
        
        let hasSelectedWisps = false;
        if (selectionManager && selectionManager.hasSelectedWisps && typeof selectionManager.hasSelectedWisps === 'function') {
            hasSelectedWisps = selectionManager.hasSelectedWisps();
            console.debug('HunterHall.onHunterHallClick: Has selected wisps:', hasSelectedWisps);
        } else {
            console.debug('HunterHall.onHunterHallClick: selectionManager.hasSelectedWisps is not a function');
        }
        
        if (hasSelectedWisps) {
            // 有选中的小精灵，不处理建筑物的点击事件，让SelectionManager处理移动
            // 不设置propagationStopped，让事件继续传播，这样SelectionManager的移动命令可以执行
            console.debug('HunterHall.onHunterHallClick: Has selected wisps, returning to let SelectionManager handle movement');
            return;
        }

        // 阻止事件传播
        event.propagationStopped = true;
        console.debug('HunterHall.onHunterHallClick: Event propagation stopped');

        // 如果已经显示选择面板，先隐藏
        if (this.selectionPanel && this.selectionPanel.isValid) {
            console.debug('HunterHall.onHunterHallClick: Selection panel already shown, hiding it');
            this.hideSelectionPanel();
            return;
        }

        // 显示选择面板
        console.debug('HunterHall.onHunterHallClick: Showing selection panel');
        this.showSelectionPanel();
        console.debug('HunterHall.onHunterHallClick: Method completed');
    }

    /**
     * 查找SelectionManager
     */
    private findSelectionManager(): any {
        let managerNode = find('SelectionManager');
        if (managerNode) {
            const selectionManager = managerNode.getComponent('SelectionManager');
            if (selectionManager) {
                return selectionManager;
            }
        }
        
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
            return findInScene(scene, 'SelectionManager');
        }
        return null;
    }

    /**
     * 显示选择面板
     */
    showSelectionPanel() {
        // 创建选择面板
        const canvas = find('Canvas');
        if (!canvas) return;

        this.selectionPanel = new Node('HunterHallSelectionPanel');
        this.selectionPanel.setParent(canvas);

        // 添加UITransform
        const uiTransform = this.selectionPanel.addComponent(UITransform);
        uiTransform.setContentSize(120, 40);

        // 设置位置（在猎手大厅上方）
        const worldPos = this.node.worldPosition.clone();
        worldPos.y += 50;
        this.selectionPanel.setWorldPosition(worldPos);

        // 添加半透明背景
        const graphics = this.selectionPanel.addComponent(Graphics);
        graphics.fillColor = new Color(0, 0, 0, 180); // 半透明黑色
        graphics.rect(-60, -20, 120, 40);
        graphics.fill();

        // 创建拆除按钮
        const sellBtn = new Node('SellButton');
        sellBtn.setParent(this.selectionPanel);
        const sellBtnTransform = sellBtn.addComponent(UITransform);
        sellBtnTransform.setContentSize(50, 30);
        sellBtn.setPosition(-35, 0);

        const sellLabel = sellBtn.addComponent(Label);
        sellLabel.string = '拆除';
        sellLabel.fontSize = 16;
        sellLabel.color = Color.WHITE;

        // 创建升级按钮
        const upgradeBtn = new Node('UpgradeButton');
        upgradeBtn.setParent(this.selectionPanel);
        const upgradeBtnTransform = upgradeBtn.addComponent(UITransform);
        upgradeBtnTransform.setContentSize(50, 30);
        upgradeBtn.setPosition(35, 0);

        const upgradeLabel = upgradeBtn.addComponent(Label);
        upgradeLabel.string = '升级';
        upgradeLabel.fontSize = 16;
        upgradeLabel.color = Color.WHITE;

        // 添加按钮点击事件
        sellBtn.on(Node.EventType.TOUCH_END, this.onSellClick, this);
        upgradeBtn.on(Node.EventType.TOUCH_END, this.onUpgradeClick, this);

        // 显示单位信息面板和范围
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (this.unitSelectionManager) {
            const unitInfo: UnitInfo = {
                name: '猎手大厅',
                level: this.level,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth,
                attackDamage: 0, // 猎手大厅没有攻击能力
                populationCost: 0, // 猎手大厅不占用人口
                icon: this.cardIcon || this.defaultSpriteFrame,
                collisionRadius: this.collisionRadius,
                currentUnitCount: this.producedHunters.length,
                maxUnitCount: this.maxHunterCount,
                onUpgradeClick: () => {
                    this.onUpgradeClick();
                },
                onSellClick: () => {
                    this.onSellClick();
                },
                onDetachWispClick: () => {
                    this.detachWisp();
                }
            };
            this.unitSelectionManager.selectUnit(this.node, unitInfo);
        }

        // 点击其他地方关闭面板
        this.scheduleOnce(() => {
            if (canvas) {
                // 创建全局触摸事件处理器
                this.globalTouchHandler = (event: EventTouch) => {
                    // 检查点击是否在选择面板或其子节点上
                    if (this.selectionPanel && this.selectionPanel.isValid) {
                        const targetNode = event.target as Node;
                        if (targetNode) {
                            // 检查目标节点是否是选择面板或其子节点
                            let currentNode: Node | null = targetNode;
                            while (currentNode) {
                                if (currentNode === this.selectionPanel) {
                                    // 点击在选择面板上，不关闭
                                    return;
                                }
                                currentNode = currentNode.parent;
                            }
                        }
                    }
                    
                    // 点击不在选择面板上，关闭面板
                    this.hideSelectionPanel();
                };
                
                canvas.on(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
            }
        }, 0.1);
    }

    /**
     * 隐藏选择面板
     */
    hideSelectionPanel() {
        // 移除全局触摸事件监听
        if (this.globalTouchHandler) {
            const canvas = find('Canvas');
            if (canvas) {
                canvas.off(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
            }
            this.globalTouchHandler = null;
        }
        
        if (this.selectionPanel && this.selectionPanel.isValid) {
            this.selectionPanel.destroy();
            this.selectionPanel = null!;
        }

        // 清除单位信息面板和范围显示
        if (this.unitSelectionManager) {
            // 检查是否当前选中的是这个单位
            if (this.unitSelectionManager.isUnitSelected(this.node)) {
                this.unitSelectionManager.clearSelection();
            }
        }
    }

    /**
     * 拆除按钮点击事件
     */
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
            console.debug(`HunterHall: Sold, refunded ${refund} gold`);
        }

        // 隐藏面板
        this.hideSelectionPanel();
        
        // 销毁猎手大厅
        this.destroyHunterHall();
    }

    /**
     * 升级按钮点击事件
     */
    onUpgradeClick(event?: EventTouch) {
        if (event) {
            event.propagationStopped = true;
        }
        
        if (!this.gameManager) {
            this.findGameManager();
        }

        if (!this.gameManager) {
            return;
        }

        // 升级成本是建造成本的50%
        const upgradeCost = Math.floor(this.buildCost * 0.5);
        
        if (!this.gameManager.canAfford(upgradeCost)) {
            console.debug(`HunterHall: Not enough gold for upgrade! Need ${upgradeCost}, have ${this.gameManager.getGold()}`);
            return;
        }

        // 消耗金币
        this.gameManager.spendGold(upgradeCost);

        // 升级：生产Hunter上限增加2个
        this.level++;
        this.maxHunterCount += 2;

        console.debug(`HunterHall: Upgraded to level ${this.level}, maxHunterCount increased to ${this.maxHunterCount}`);

        // 更新单位信息面板
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                level: this.level,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth,
                maxUnitCount: this.maxHunterCount,
                currentUnitCount: this.producedHunters.length
            });
        }

        // 隐藏面板
        this.hideSelectionPanel();
    }

    /**
     * 让小精灵依附
     */
    attachWisp(wisp: Node) {
        const wispScript = wisp.getComponent('Wisp') as any;
        if (!wispScript) {
            console.warn('HunterHall: Cannot attach - wisp script not found');
            return;
        }

        // 检查小精灵是否已经依附在其他建筑物上
        if (wispScript.getIsAttached && wispScript.getIsAttached()) {
            console.warn('HunterHall: Wisp already attached to another building');
            return;
        }

        // 先将小精灵添加到依附列表，再调用attachToBuilding
        this.attachedWisps.push(wisp);
        
        // 让小精灵依附，传递fromBuilding参数为true避免循环调用
        if (wispScript.attachToBuilding) {
            wispScript.attachToBuilding(this.node, true);
            console.debug(`HunterHall: Wisp attached, total: ${this.attachedWisps.length}`);
        }
    }

    /**
     * 卸下小精灵
     */
    detachWisp() {
        if (this.attachedWisps.length === 0) {
            console.debug('HunterHall: No wisp to detach');
            return;
        }

        // 卸下第一个小精灵
        const wisp = this.attachedWisps[0];
        // 先从列表中移除，再调用detachFromBuilding，避免indexOf出错
        this.attachedWisps.shift();
        
        const wispScript = wisp.getComponent('Wisp') as any;
        if (wispScript && wispScript.detachFromBuilding) {
            wispScript.detachFromBuilding();
            console.debug(`HunterHall: Wisp detached, remaining: ${this.attachedWisps.length}`);
        }
    }

    /**
     * 销毁猎手大厅（用于拆除）
     */
    destroyHunterHall() {
        // 停止所有生产
        this.isProducing = false;
        this.productionTimer = 0;
        this.productionProgress = 0;

        // 隐藏面板
        this.hideSelectionPanel();

        // 移除点击事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onHunterHallClick, this);

        // 调用die方法进行销毁
        this.die();
    }
}