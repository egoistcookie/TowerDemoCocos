import { _decorator, Component, Node, Vec3, Prefab, instantiate, find, Sprite, SpriteFrame, Color, Graphics, UITransform } from 'cc';
import { GameManager } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
import { Arrow } from './Arrow';
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
    towerPrefab: Prefab = null!; // 生产的Tower预制体

    @property(Prefab)
    explosionEffect: Prefab = null!;

    @property(Prefab)
    damageNumberPrefab: Prefab = null!;

    @property
    buildCost: number = 10; // 建造成本

    // 攻击动画相关属性
    @property(SpriteFrame)
    attackAnimationFrames: SpriteFrame[] = [];

    @property
    attackAnimationDuration: number = 0.5;

    // 生产相关属性
    @property
    maxTowerCount: number = 4; // 最多生产4个Tower

    @property
    productionInterval: number = 2.0; // 每2秒生产一个

    @property
    spawnOffset: number = 100; // Tower出现在下方100像素

    @property
    moveAwayDistance: number = 80; // Tower生成后往前跑开的距离

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
    private producedTowers: Node[] = []; // 已生产的Tower列表
    private productionTimer: number = 0; // 生产计时器
    private productionProgress: number = 0; // 生产进度（0-1）
    private isProducing: boolean = false; // 是否正在生产
    private towerContainer: Node = null!; // Tower容器

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

        // 获取Sprite组件
        this.sprite = this.node.getComponent(Sprite);
        if (this.sprite && this.sprite.spriteFrame) {
            this.defaultSpriteFrame = this.sprite.spriteFrame;
        }
        this.defaultScale = this.node.scale.clone();

        // 查找游戏管理器
        this.findGameManager();

        // 查找Tower容器
        this.findTowerContainer();

        // 创建血条
        this.createHealthBar();

        // 创建生产进度条
        this.createProductionProgressBar();
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
        if (aliveTowerCount < this.maxTowerCount) {
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
            console.warn('WarAncientTree: Cannot produce tower - prefab or container missing');
            return;
        }

        if (this.producedTowers.length >= this.maxTowerCount) {
            return;
        }

        // 计算Tower出现位置（战争古树下方100像素）
        const treePos = this.node.worldPosition.clone();
        let spawnPos = new Vec3(treePos.x, treePos.y - this.spawnOffset, treePos.z);

        // 检查生成位置是否有单位，如果有则左右平移
        spawnPos = this.findAvailableSpawnPosition(spawnPos);

        // 创建Tower
        const tower = instantiate(this.towerPrefab);
        tower.setParent(this.towerContainer);
        tower.setWorldPosition(spawnPos);
        tower.active = true;

        // 设置Tower的建造成本（如果需要）
        const towerScript = tower.getComponent('Tower') as any;
        if (towerScript) {
            towerScript.buildCost = 0; // 由战争古树生产的Tower建造成本为0
        }

        // 添加到生产的Tower列表
        this.producedTowers.push(tower);

        // 计算Tower的目标位置（往前跑开一段距离）
        // 根据已生产的Tower数量，分散到不同位置
        const towerIndex = this.producedTowers.length - 1;
        const angleOffset = (towerIndex % 2 === 0 ? 1 : -1) * 15; // 左右分散
        const forwardDirection = new Vec3(0, 1, 0); // 前方方向（向上）
        
        // 旋转方向向量
        const radian = angleOffset * Math.PI / 180;
        const cos = Math.cos(radian);
        const sin = Math.sin(radian);
        const rotatedX = forwardDirection.x * cos - forwardDirection.y * sin;
        const rotatedY = forwardDirection.x * sin + forwardDirection.y * cos;
        const direction = new Vec3(rotatedX, rotatedY, 0);
        
        // 计算目标位置（前方跑开）
        const targetPos = new Vec3();
        Vec3.scaleAndAdd(targetPos, spawnPos, direction, this.moveAwayDistance);

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

        console.log(`WarAncientTree: Produced tower ${this.producedTowers.length}/${this.maxTowerCount} at position (${spawnPos.x.toFixed(2)}, ${spawnPos.y.toFixed(2)})`);
    }

    findAvailableSpawnPosition(initialPos: Vec3): Vec3 {
        const checkRadius = 30; // Tower的碰撞半径
        const offsetStep = 40; // 每次平移的距离
        const maxAttempts = 5; // 最多尝试5次（左右各2次）

        // 检查初始位置是否可用
        if (!this.hasUnitAtPosition(initialPos, checkRadius)) {
            return initialPos;
        }

        // 尝试左右平移
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // 先尝试右侧
            const rightPos = new Vec3(initialPos.x + offsetStep * attempt, initialPos.y, initialPos.z);
            if (!this.hasUnitAtPosition(rightPos, checkRadius)) {
                console.log(`WarAncientTree: Found available position at right offset ${offsetStep * attempt}`);
                return rightPos;
            }

            // 再尝试左侧
            const leftPos = new Vec3(initialPos.x - offsetStep * attempt, initialPos.y, initialPos.z);
            if (!this.hasUnitAtPosition(leftPos, checkRadius)) {
                console.log(`WarAncientTree: Found available position at left offset ${offsetStep * attempt}`);
                return leftPos;
            }
        }

        // 如果所有位置都被占用，返回初始位置（让Tower自己处理碰撞）
        console.warn('WarAncientTree: Could not find available spawn position, using initial position');
        return initialPos;
    }

    hasUnitAtPosition(position: Vec3, radius: number): boolean {
        const minDistance = radius * 2; // 最小距离（两个半径）

        // 检查与水晶的碰撞
        const crystal = find('Crystal');
        if (crystal && crystal.isValid && crystal.active) {
            const distance = Vec3.distance(position, crystal.worldPosition);
            const crystalRadius = 50;
            if (distance < radius + crystalRadius) {
                return true;
            }
        }

        // 检查与其他Tower的碰撞
        if (this.towerContainer) {
            const towers = this.towerContainer.children || [];
            for (const tower of towers) {
                if (tower && tower.isValid && tower.active) {
                    // 排除自己生产的Tower（因为它们可能会移动）
                    let isProducedTower = false;
                    for (const producedTower of this.producedTowers) {
                        if (producedTower === tower) {
                            isProducedTower = true;
                            break;
                        }
                    }
                    if (isProducedTower) {
                        continue;
                    }
                    
                    const towerScript = tower.getComponent('Tower') as any;
                    if (towerScript && towerScript.isAlive && towerScript.isAlive()) {
                        const distance = Vec3.distance(position, tower.worldPosition);
                        const otherRadius = towerScript.collisionRadius || radius;
                        if (distance < radius + otherRadius) {
                            return true;
                        }
                    }
                }
            }
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
                        if (distance < radius + treeRadius) {
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
                        if (distance < radius + enemyRadius) {
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
        this.producedTowers = this.producedTowers.filter(tower => {
            if (!tower || !tower.isValid || !tower.active) {
                return false;
            }
            
            const towerScript = tower.getComponent('Tower') as any;
            if (towerScript && towerScript.isAlive) {
                return towerScript.isAlive();
            }
            
            return true;
        });
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
}

