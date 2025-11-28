import { _decorator, Component, Node, Vec3, Prefab, instantiate, find, Sprite, SpriteFrame, Color, Graphics, UITransform, Label, EventTouch } from 'cc';
import { GameManager } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
import { Arrow } from './Arrow';
import { UnitSelectionManager } from './UnitSelectionManager';
import { UnitInfo } from './UnitInfoPanel';
import { SelectionManager } from './SelectionManager';
const { ccclass, property } = _decorator;

@ccclass('WarAncientTree')
export class WarAncientTree extends Component {
    @property
    maxHealth: number = 100;

    @property
    attackRange: number = 200;

    @property
    attackDamage: number = 15;

    @property
    attackInterval: number = 1.5;

    @property(Prefab)
    arrowPrefab: Prefab = null!;

    @property(Prefab)
    towerPrefab: Prefab = null!; // 生产的Arrower预制体

    @property(Prefab)
    explosionEffect: Prefab = null!;

    @property(Prefab)
    damageNumberPrefab: Prefab = null!;

    @property
    buildCost: number = 10; // 建造成本

    @property
    level: number = 1; // 战争古树等级

    @property
    collisionRadius: number = 50; // 占地范围（像素）

    // 攻击动画相关属性
    @property(SpriteFrame)
    attackAnimationFrames: SpriteFrame[] = [];

    @property
    attackAnimationDuration: number = 0.5;

    // 生产相关属性
    @property
    maxTowerCount: number = 4; // 最多生产4个Arrower

    @property
    productionInterval: number = 2.0; // 每2秒生产一个

    @property
    spawnOffset: number = 100; // Arrower出现在下方100像素

    @property
    moveAwayDistance: number = 80; // Arrower生成后往前跑开的距离

    private currentHealth: number = 100;
    private healthBar: HealthBar = null!;
    private healthBarNode: Node = null!;
    private productionProgressBar: Node = null!; // 生产进度条节点
    private productionProgressGraphics: Graphics = null!; // 生产进度条Graphics组件
    private isDestroyed: boolean = false;
    private attackTimer: number = 0;
    private currentTarget: Node = null!;
    private gameManager: GameManager = null!;
    private sprite: Sprite = null!;
    private defaultSpriteFrame: SpriteFrame = null!;
    private defaultScale: Vec3 = new Vec3(1, 1, 1);
    private isPlayingAttackAnimation: boolean = false;

    // 生产相关
    private producedTowers: Node[] = []; // 已生产的Arrower列表
    private productionTimer: number = 0; // 生产计时器
    private productionProgress: number = 0; // 生产进度（0-1）
    private isProducing: boolean = false; // 是否正在生产
    private towerContainer: Node = null!; // Arrower容器
    
    // 小精灵相关
    private attachedWisps: Node[] = []; // 依附的小精灵列表

    // 选择面板相关
    private selectionPanel: Node = null!; // 选择面板节点
    private globalTouchHandler: ((event: EventTouch) => void) | null = null; // 全局触摸事件处理器
    private unitSelectionManager: UnitSelectionManager = null!; // 单位选择管理器

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        this.currentTarget = null!;
        this.isPlayingAttackAnimation = false;
        this.producedTowers = [];
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

        // 查找Tower容器
        this.findTowerContainer();

        // 创建血条
        this.createHealthBar();

        // 创建生产进度条
        this.createProductionProgressBar();

        // 添加点击事件监听
        this.node.on(Node.EventType.TOUCH_END, this.onWarAncientTreeClick, this);
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

    findTowerContainer() {
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

        let towersNode = find('Towers');
        if (!towersNode && this.node.scene) {
            towersNode = findNodeRecursive(this.node.scene, 'Towers');
        }
        if (towersNode) {
            this.towerContainer = towersNode;
        } else {
            // 如果找不到，创建一个新的容器
            this.towerContainer = new Node('Towers');
            const canvas = find('Canvas');
            if (canvas) {
                this.towerContainer.setParent(canvas);
            } else if (this.node.scene) {
                this.towerContainer.setParent(this.node.scene);
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

        // 更新攻击计时器
        this.attackTimer += deltaTime;

        // 查找目标
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
            this.findTarget();
        }

        // 攻击逻辑
        if (this.currentTarget && this.attackTimer >= this.attackInterval) {
            const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
            if (distance <= this.attackRange) {
                this.attack();
                this.attackTimer = 0;
            } else {
                // 目标超出范围，清除目标
                this.currentTarget = null!;
            }
        }

        // 清理已死亡的Tower
        this.cleanupDeadTowers();

        // 生产Tower逻辑
        const aliveTowerCount = this.producedTowers.length;
        if (aliveTowerCount < this.maxTowerCount && this.gameManager.canAddPopulation(1)) {
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
                this.produceTower();
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

    findTarget() {
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

        const scene = this.node.scene;
        let enemiesNode = find('Enemies');

        if (!enemiesNode && scene) {
            enemiesNode = findNodeRecursive(scene, 'Enemies');
        }

        if (!enemiesNode) {
            this.currentTarget = null!;
            return;
        }

        const enemies = enemiesNode.children || [];
        let nearestEnemy: Node = null!;
        let minDistance = Infinity;

        for (const enemy of enemies) {
            if (enemy && enemy.active && enemy.isValid) {
                const enemyScript = enemy.getComponent('Enemy') as any;
                if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, enemy.worldPosition);
                    if (distance <= this.attackRange && distance < minDistance) {
                        minDistance = distance;
                        nearestEnemy = enemy;
                    }
                }
            }
        }

        this.currentTarget = nearestEnemy;
    }

    attack() {
        if (!this.currentTarget || this.isDestroyed) {
            return;
        }

        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }

        const enemyScript = this.currentTarget.getComponent('Enemy') as any;
        if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
            // 播放攻击动画，动画完成后才攻击
            this.playAttackAnimation(() => {
                this.executeAttack();
            });
        } else {
            this.currentTarget = null!;
        }
    }

    executeAttack() {
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active || this.isDestroyed) {
            return;
        }

        const enemyScript = this.currentTarget.getComponent('Enemy') as any;
        if (!enemyScript || !enemyScript.isAlive || !enemyScript.isAlive()) {
            this.currentTarget = null!;
            return;
        }

        // 创建弓箭特效
        if (this.arrowPrefab) {
            this.createArrow();
        } else {
            // 直接伤害（无特效）
            if (enemyScript.takeDamage) {
                enemyScript.takeDamage(this.attackDamage);
            }
        }
    }

    playAttackAnimation(onComplete?: () => void) {
        if (this.isPlayingAttackAnimation) {
            return;
        }

        if (!this.sprite) {
            this.sprite = this.node.getComponent(Sprite);
            if (!this.sprite) {
                if (onComplete) onComplete();
                return;
            }
        }

        if (!this.attackAnimationFrames || this.attackAnimationFrames.length === 0) {
            if (onComplete) onComplete();
            return;
        }

        const validFrames = this.attackAnimationFrames.filter(frame => frame != null);
        if (validFrames.length === 0) {
            if (onComplete) onComplete();
            return;
        }

        // 根据敌人位置决定是否翻转
        let shouldFlip = false;
        if (this.currentTarget && this.currentTarget.isValid) {
            const treePos = this.node.worldPosition;
            const enemyPos = this.currentTarget.worldPosition;
            shouldFlip = enemyPos.x < treePos.x;

            if (shouldFlip) {
                this.node.setScale(-Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
                if (this.healthBarNode && this.healthBarNode.isValid) {
                    this.healthBarNode.setScale(-1, 1, 1);
                }
            } else {
                this.node.setScale(Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
                if (this.healthBarNode && this.healthBarNode.isValid) {
                    this.healthBarNode.setScale(1, 1, 1);
                }
            }
        }

        this.isPlayingAttackAnimation = true;

        const frames = validFrames;
        const frameCount = frames.length;
        const frameDuration = this.attackAnimationDuration / frameCount;
        let animationTimer = 0;
        let lastFrameIndex = -1;

        if (frames[0]) {
            this.sprite.spriteFrame = frames[0];
            lastFrameIndex = 0;
        }

        const animationUpdate = (deltaTime: number) => {
            if (!this.sprite || !this.sprite.isValid || this.isDestroyed) {
                this.isPlayingAttackAnimation = false;
                this.unschedule(animationUpdate);
                if (onComplete) onComplete();
                return;
            }

            animationTimer += deltaTime;

            if (animationTimer >= this.attackAnimationDuration) {
                if (lastFrameIndex < frameCount - 1 && frames[frameCount - 1]) {
                    this.sprite.spriteFrame = frames[frameCount - 1];
                }
                this.restoreDefaultSprite();
                this.unschedule(animationUpdate);
                if (onComplete) {
                    onComplete();
                }
                return;
            }

            const targetFrameIndex = Math.min(Math.floor(animationTimer / frameDuration), frameCount - 1);
            if (targetFrameIndex !== lastFrameIndex && targetFrameIndex < frameCount && frames[targetFrameIndex]) {
                this.sprite.spriteFrame = frames[targetFrameIndex];
                lastFrameIndex = targetFrameIndex;
            }
        };

        this.schedule(animationUpdate, 0);
    }

    restoreDefaultSprite() {
        if (this.sprite && this.sprite.isValid && this.defaultSpriteFrame) {
            this.sprite.spriteFrame = this.defaultSpriteFrame;
        }
        if (this.node && this.node.isValid) {
            this.node.setScale(this.defaultScale.x, this.defaultScale.y, this.defaultScale.z);
        }
        if (this.healthBarNode && this.healthBarNode.isValid) {
            this.healthBarNode.setScale(1, 1, 1);
        }
        this.isPlayingAttackAnimation = false;
    }

    createArrow() {
        if (!this.arrowPrefab || !this.currentTarget) {
            return;
        }

        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            return;
        }

        const arrow = instantiate(this.arrowPrefab);

        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            arrow.setParent(parentNode);
        } else {
            arrow.setParent(this.node.parent);
        }

        const startPos = this.node.worldPosition.clone();
        arrow.setWorldPosition(startPos);
        arrow.active = true;

        let arrowScript = arrow.getComponent(Arrow);
        if (!arrowScript) {
            arrowScript = arrow.addComponent(Arrow);
        }

        arrowScript.init(
            startPos,
            this.currentTarget,
            this.attackDamage,
            (damage: number) => {
                const enemyScript = this.currentTarget?.getComponent('Enemy') as any;
                if (enemyScript && enemyScript.takeDamage) {
                    enemyScript.takeDamage(damage);
                }
            }
        );
    }

    produceTower() {
        if (!this.towerPrefab || !this.towerContainer) {
            console.warn('WarAncientTree: Cannot produce arrower - prefab or container missing');
            return;
        }

        if (this.producedTowers.length >= this.maxTowerCount) {
            return;
        }

        // 检查人口上限
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        if (this.gameManager && !this.gameManager.canAddPopulation(1)) {
            console.log('WarAncientTree: Cannot produce arrower - population limit reached');
            return;
        }

        // 计算Tower出现位置（战争古树下方100像素）
        const treePos = this.node.worldPosition.clone();
        let spawnPos = new Vec3(treePos.x, treePos.y - this.spawnOffset, treePos.z);

        // 检查生成位置是否有单位，如果有则左右平移
        spawnPos = this.findAvailableSpawnPosition(spawnPos);

        // 增加人口（在创建Tower之前）
        if (this.gameManager) {
            if (!this.gameManager.addPopulation(1)) {
                console.warn('WarAncientTree: Failed to add population, cannot produce tower');
                return;
            }
        }

        // 创建Tower
        const tower = instantiate(this.towerPrefab);
        tower.setParent(this.towerContainer);
        tower.setWorldPosition(spawnPos);
        tower.active = true;

        // 设置Tower的建造成本（如果需要）
        const towerScript = tower.getComponent('Arrower') as any;
        if (towerScript) {
            towerScript.buildCost = 0; // 由战争古树生产的Arrower建造成本为0
        }

        // 添加到生产的Tower列表
        this.producedTowers.push(tower);

        // 计算Tower的目标位置（向左右两侧跑开）
        // 根据已生产的Tower数量，分散到不同位置
        const towerIndex = this.producedTowers.length - 1;
        // 左右分散：偶数索引向右，奇数索引向左
        const directionX = (towerIndex % 2 === 0 ? 1 : -1);
        
        // 计算目标位置（只改变x坐标，y坐标不变）
        const targetPos = new Vec3(
            spawnPos.x + directionX * this.moveAwayDistance,
            spawnPos.y, // y坐标保持不变
            spawnPos.z
        );

        // 让Tower移动到目标位置
        if (towerScript) {
            // 使用schedule在下一帧开始移动，确保Tower已完全初始化
            this.scheduleOnce(() => {
                if (tower && tower.isValid && towerScript) {
                    // 使用setManualMoveTargetPosition方法设置移动目标
                    if (towerScript.setManualMoveTargetPosition) {
                        towerScript.setManualMoveTargetPosition(targetPos);
                    } else if (towerScript.moveToPosition) {
                        // 如果没有setManualMoveTargetPosition方法，使用moveToPosition
                        const moveUpdate = (deltaTime: number) => {
                            if (!tower || !tower.isValid || !towerScript) {
                                this.unschedule(moveUpdate);
                                return;
                            }
                            
                            const currentPos = tower.worldPosition;
                            const distance = Vec3.distance(currentPos, targetPos);
                            
                            if (distance <= 10) {
                                // 到达目标位置，停止移动
                                if (towerScript.stopMoving) {
                                    towerScript.stopMoving();
                                }
                                this.unschedule(moveUpdate);
                            } else {
                                // 继续移动
                                towerScript.moveToPosition(targetPos, deltaTime);
                            }
                        };
                        this.schedule(moveUpdate, 0);
                    }
                }
            }, 0.1);
        }

        console.log(`WarAncientTree: Produced arrower ${this.producedTowers.length}/${this.maxTowerCount} at position (${spawnPos.x.toFixed(2)}, ${spawnPos.y.toFixed(2)})`);
        
        // 更新单位信息面板（如果被选中）
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                currentUnitCount: this.producedTowers.length
            });
        }
    }

    findAvailableSpawnPosition(initialPos: Vec3): Vec3 {
        const checkRadius = 30; // Tower的碰撞半径
        const offsetStep = 50; // 每次平移的距离（增大步长，确保不会重叠）
        const maxAttempts = 20; // 最多尝试20次（左右各10次）

        // 检查初始位置是否可用
        if (!this.hasUnitAtPosition(initialPos, checkRadius)) {
            console.log(`WarAncientTree.findAvailableSpawnPosition: Initial position is available at (${initialPos.x.toFixed(1)}, ${initialPos.y.toFixed(1)})`);
            return initialPos;
        }

        console.log(`WarAncientTree.findAvailableSpawnPosition: Initial position (${initialPos.x.toFixed(1)}, ${initialPos.y.toFixed(1)}) is occupied, searching for available position...`);

        // 尝试左右平移，交替检查左右两侧
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // 先尝试右侧
            const rightPos = new Vec3(initialPos.x + offsetStep * attempt, initialPos.y, initialPos.z);
            if (!this.hasUnitAtPosition(rightPos, checkRadius)) {
                console.log(`WarAncientTree.findAvailableSpawnPosition: Found available position at right offset ${offsetStep * attempt}, position: (${rightPos.x.toFixed(1)}, ${rightPos.y.toFixed(1)})`);
                return rightPos;
            }

            // 再尝试左侧
            const leftPos = new Vec3(initialPos.x - offsetStep * attempt, initialPos.y, initialPos.z);
            if (!this.hasUnitAtPosition(leftPos, checkRadius)) {
                console.log(`WarAncientTree.findAvailableSpawnPosition: Found available position at left offset ${offsetStep * attempt}, position: (${leftPos.x.toFixed(1)}, ${leftPos.y.toFixed(1)})`);
                return leftPos;
            }
        }

        // 如果左右平移都找不到，尝试上下方向
        console.log(`WarAncientTree.findAvailableSpawnPosition: Horizontal search failed, trying vertical directions...`);
        for (let attempt = 1; attempt <= maxAttempts / 2; attempt++) {
            // 尝试上方
            const upPos = new Vec3(initialPos.x, initialPos.y + offsetStep * attempt, initialPos.z);
            if (!this.hasUnitAtPosition(upPos, checkRadius)) {
                console.log(`WarAncientTree.findAvailableSpawnPosition: Found available position at up offset ${offsetStep * attempt}, position: (${upPos.x.toFixed(1)}, ${upPos.y.toFixed(1)})`);
                return upPos;
            }

            // 尝试下方
            const downPos = new Vec3(initialPos.x, initialPos.y - offsetStep * attempt, initialPos.z);
            if (!this.hasUnitAtPosition(downPos, checkRadius)) {
                console.log(`WarAncientTree.findAvailableSpawnPosition: Found available position at down offset ${offsetStep * attempt}, position: (${downPos.x.toFixed(1)}, ${downPos.y.toFixed(1)})`);
                return downPos;
            }
        }

        // 如果所有位置都被占用，尝试对角线方向
        console.log(`WarAncientTree.findAvailableSpawnPosition: Vertical search failed, trying diagonal directions...`);
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
                    console.log(`WarAncientTree.findAvailableSpawnPosition: Found available position at diagonal offset, position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
                    return pos;
                }
            }
        }

        // 如果所有位置都被占用，返回初始位置（让Tower自己处理碰撞）
        console.warn(`WarAncientTree.findAvailableSpawnPosition: Could not find available spawn position after ${maxAttempts * 2} attempts, using initial position`);
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

        // 检查与其他Tower的碰撞
        // 每次都重新查找Towers节点，确保获取到所有Arrower（包括手动建造的）
        const findTowersNodeRecursive = (node: Node, name: string): Node | null => {
            if (node.name === name) {
                return node;
            }
            for (const child of node.children) {
                const found = findTowersNodeRecursive(child, name);
                if (found) return found;
            }
            return null;
        };

        let towersNode = find('Towers');
        if (!towersNode && this.node.scene) {
            towersNode = findTowersNodeRecursive(this.node.scene, 'Towers');
        }
        
        if (towersNode) {
            const towers = towersNode.children || [];
            console.log(`WarAncientTree.hasUnitAtPosition: Checking ${towers.length} towers at position (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
            
            for (const tower of towers) {
                if (tower && tower.isValid && tower.active) {
                    const towerScript = tower.getComponent('Arrower') as any;
                    if (towerScript && towerScript.isAlive && towerScript.isAlive()) {
                        // 获取Tower的实时位置（包括正在移动的Tower）
                        const towerPos = tower.worldPosition;
                        const distance = Vec3.distance(position, towerPos);
                        const otherRadius = towerScript.collisionRadius || radius;
                        // 使用1.2倍的安全距离，确保不会重叠（和Tower的checkCollisionAtPosition保持一致）
                        const minDistance = (radius + otherRadius) * 1.2;
                        
                        if (distance < minDistance) {
                            // 检查是否是自己生产的Tower
                            let isProducedTower = false;
                            for (const producedTower of this.producedTowers) {
                                if (producedTower === tower) {
                                    isProducedTower = true;
                                    break;
                                }
                            }
                            
                            if (isProducedTower) {
                                console.log(`WarAncientTree.hasUnitAtPosition: Collision detected with produced Arrower at distance ${distance.toFixed(1)}, minDistance: ${minDistance.toFixed(1)}, towerPos: (${towerPos.x.toFixed(1)}, ${towerPos.y.toFixed(1)})`);
                            } else {
                                console.log(`WarAncientTree.hasUnitAtPosition: Collision detected with other Arrower at distance ${distance.toFixed(1)}, minDistance: ${minDistance.toFixed(1)}, towerPos: (${towerPos.x.toFixed(1)}, ${towerPos.y.toFixed(1)})`);
                            }
                            return true;
                        }
                    }
                }
            }
        } else {
            console.warn('WarAncientTree.hasUnitAtPosition: Towers node not found!');
        }

        // 检查与战争古树的碰撞
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

        let treesNode = find('WarAncientTrees');
        if (!treesNode && this.node.scene) {
            treesNode = findNodeRecursive(this.node.scene, 'WarAncientTrees');
        }
        
        if (treesNode) {
            const trees = treesNode.children || [];
            for (const tree of trees) {
                if (tree && tree.isValid && tree.active && tree !== this.node) {
                    const treeScript = tree.getComponent('WarAncientTree') as any;
                    if (treeScript && treeScript.isAlive && treeScript.isAlive()) {
                        const distance = Vec3.distance(position, tree.worldPosition);
                        const treeRadius = 50; // 战争古树的半径
                        // 使用安全距离，确保不会重叠
                        const minDistance = (radius + treeRadius) * 1.1;
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

    cleanupDeadTowers() {
        // 清理已死亡的Tower
        const beforeCount = this.producedTowers.length;
        this.producedTowers = this.producedTowers.filter(tower => {
            if (!tower || !tower.isValid || !tower.active) {
                // Tower已死亡，减少人口
                if (this.gameManager) {
                    this.gameManager.removePopulation(1);
                }
                return false;
            }
            
            const towerScript = tower.getComponent('Arrower') as any;
            if (towerScript && towerScript.isAlive) {
                const isAlive = towerScript.isAlive();
                if (!isAlive) {
                    // Tower已死亡，减少人口
                    if (this.gameManager) {
                        this.gameManager.removePopulation(1);
                    }
                }
                return isAlive;
            }
            
            return true;
        });
        
        const afterCount = this.producedTowers.length;
        if (beforeCount !== afterCount) {
            console.log(`WarAncientTree.cleanupDeadTowers: Removed ${beforeCount - afterCount} dead arrowers, remaining: ${afterCount}`);
            
            // 更新单位信息面板（如果被选中）
            if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
                this.unitSelectionManager.updateUnitInfo({
                    currentUnitCount: this.producedTowers.length
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
     * 战争古树点击事件
     */
    onWarAncientTreeClick(event: EventTouch) {
        console.log('WarAncientTree.onWarAncientTreeClick: Entering method');
        // 检查是否有选中的小精灵，如果有则不处理点击事件（让小精灵移动到建筑物）
        const selectionManager = this.findSelectionManager();
        console.log('WarAncientTree.onWarAncientTreeClick: Found selectionManager:', selectionManager ? 'yes' : 'no');
        
        let hasSelectedWisps = false;
        if (selectionManager && selectionManager.hasSelectedWisps && typeof selectionManager.hasSelectedWisps === 'function') {
            hasSelectedWisps = selectionManager.hasSelectedWisps();
            console.log('WarAncientTree.onWarAncientTreeClick: Has selected wisps:', hasSelectedWisps);
        } else {
            console.log('WarAncientTree.onWarAncientTreeClick: selectionManager.hasSelectedWisps is not a function');
        }
        
        if (hasSelectedWisps) {
            // 有选中的小精灵，不处理建筑物的点击事件，让SelectionManager处理移动
            // 不设置propagationStopped，让事件继续传播，这样SelectionManager的移动命令可以执行
            console.log('WarAncientTree.onWarAncientTreeClick: Has selected wisps, returning to let SelectionManager handle movement');
            return;
        }

        // 阻止事件传播
        event.propagationStopped = true;
        console.log('WarAncientTree.onWarAncientTreeClick: Event propagation stopped');

        // 如果已经显示选择面板，先隐藏
        if (this.selectionPanel && this.selectionPanel.isValid) {
            console.log('WarAncientTree.onWarAncientTreeClick: Selection panel already shown, hiding it');
            this.hideSelectionPanel();
            return;
        }

        // 显示选择面板
        console.log('WarAncientTree.onWarAncientTreeClick: Showing selection panel');
        this.showSelectionPanel();
        console.log('WarAncientTree.onWarAncientTreeClick: Method completed');
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

        this.selectionPanel = new Node('WarAncientTreeSelectionPanel');
        this.selectionPanel.setParent(canvas);

        // 添加UITransform
        const uiTransform = this.selectionPanel.addComponent(UITransform);
        uiTransform.setContentSize(120, 40);

        // 设置位置（在战争古树上方）
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
                name: '战争古树',
                level: this.level,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth,
                attackDamage: this.attackDamage,
                populationCost: 0, // 战争古树不占用人口
                icon: this.defaultSpriteFrame,
                collisionRadius: this.collisionRadius,
                attackRange: this.attackRange,
                currentUnitCount: this.producedTowers.length,
                maxUnitCount: this.maxTowerCount,
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
            console.log(`WarAncientTree: Sold, refunded ${refund} gold`);
        }

        // 隐藏面板
        this.hideSelectionPanel();
        
        // 销毁战争古树
        this.destroyWarAncientTree();
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
            console.log(`WarAncientTree: Not enough gold for upgrade! Need ${upgradeCost}, have ${this.gameManager.getGold()}`);
            return;
        }

        // 消耗金币
        this.gameManager.spendGold(upgradeCost);

        // 升级：生产Tower上限增加2个
        this.level++;
        this.maxTowerCount += 2;

        console.log(`WarAncientTree: Upgraded to level ${this.level}, maxTowerCount increased to ${this.maxTowerCount}`);

        // 更新单位信息面板
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                level: this.level,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth,
                maxUnitCount: this.maxTowerCount,
                currentUnitCount: this.producedTowers.length
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
            console.warn('WarAncientTree: Cannot attach - wisp script not found');
            return;
        }

        // 检查小精灵是否已经依附在其他建筑物上
        if (wispScript.getIsAttached && wispScript.getIsAttached()) {
            console.warn('WarAncientTree: Wisp already attached to another building');
            return;
        }

        // 先将小精灵添加到依附列表，再调用attachToBuilding
        this.attachedWisps.push(wisp);
        
        // 让小精灵依附，传递fromBuilding参数为true避免循环调用
        if (wispScript.attachToBuilding) {
            wispScript.attachToBuilding(this.node, true);
            console.log(`WarAncientTree: Wisp attached, total: ${this.attachedWisps.length}`);
        }
    }

    /**
     * 卸下小精灵
     */
    detachWisp() {
        if (this.attachedWisps.length === 0) {
            console.log('WarAncientTree: No wisp to detach');
            return;
        }

        // 卸下第一个小精灵
        const wisp = this.attachedWisps[0];
        const wispScript = wisp.getComponent('Wisp') as any;
        if (wispScript && wispScript.detachFromBuilding) {
            wispScript.detachFromBuilding();
            const index = this.attachedWisps.indexOf(wisp);
            if (index >= 0) {
                this.attachedWisps.splice(index, 1);
            }
            console.log(`WarAncientTree: Wisp detached, remaining: ${this.attachedWisps.length}`);
        }
    }

    /**
     * 销毁战争古树（用于拆除）
     */
    destroyWarAncientTree() {
        // 停止所有生产
        this.isProducing = false;
        this.productionTimer = 0;
        this.productionProgress = 0;

        // 隐藏面板
        this.hideSelectionPanel();

        // 移除点击事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onWarAncientTreeClick, this);

        // 调用die方法进行销毁
        this.die();
    }
}

