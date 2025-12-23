import { _decorator, Node, Vec3, Prefab, instantiate, find, Sprite, SpriteFrame, Color, Graphics, UITransform, Label, EventTouch } from 'cc';
import { GameState } from './GameManager';
import { Arrow } from './Arrow';
import { Arrower } from './Arrower';
import { UnitInfo } from './UnitInfoPanel';
import { UnitConfigManager } from './UnitConfigManager';
import { Build } from './Build';
const { ccclass, property } = _decorator;

// 单位类型枚举
export enum UnitType {
    BUILDING = 'BUILDING',
    CHARACTER = 'CHARACTER',
    TREE = 'TREE',
    CRYSTAL = 'CRYSTAL',
    ENEMY = 'ENEMY' // 敌方单位类型
}

@ccclass('WarAncientTree')
export class WarAncientTree extends Build {
    // 攻击相关属性（子类自定义）
    @property
    attackRange: number = 200;

    @property
    attackDamage: number = 15;

    @property
    attackInterval: number = 1.5;

    @property(Prefab)
    arrowPrefab: Prefab = null!;

    // 攻击动画相关属性（子类自定义）
    @property(SpriteFrame)
    attackAnimationFrames: SpriteFrame[] = [];

    @property
    attackAnimationDuration: number = 0.5;

    // 生产相关属性
    @property(Prefab)
    towerPrefab: Prefab = null!; // 生产的 Arrower 预制体

    @property
    maxTowerCount: number = 4; // 最多生产4个Arrower

    @property
    productionInterval: number = 2.0; // 每2秒生产一个

    @property
    spawnOffset: number = 100; // Arrower出现在下方100像素

    @property
    moveAwayDistance: number = 80; // Arrower生成后往前跑开的距离

    // 攻击相关私有属性
    private attackTimer: number = 0;
    private currentTarget: Node = null!;
    private isPlayingAttackAnimation: boolean = false;

    // 生产相关私有属性
    private productionProgressBar: Node = null!; // 生产进度条节点
    private productionProgressGraphics: Graphics = null!; // 生产进度条Graphics组件
    private producedTowers: Node[] = []; // 已生产的Arrower列表
    private productionTimer: number = 0; // 生产计时器
    private productionProgress: number = 0; // 生产进度（0-1）
    private isProducing: boolean = false; // 是否正在生产
    private towerContainer: Node = null!; // Arrower容器

    start() {
        // 调用父类的通用初始化逻辑
        super.start();

        this.attackTimer = 0;
        this.currentTarget = null!;
        this.isPlayingAttackAnimation = false;
        this.producedTowers = [];
        this.productionTimer = 0;
        this.productionProgress = 0;
        this.isProducing = false;

        // 查找Tower容器
        this.findTowerContainer();

        // 创建生产进度条
        this.createProductionProgressBar();

        // 添加点击事件监听（使用父类的通用方法）
        this.node.on(Node.EventType.TOUCH_END, this.onBuildingClick, this);
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

        // 检查游戏状态 - 如果GameManager不存在，尝试重新查找
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        // 检查游戏状态，只在Playing状态下运行
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                // 游戏已结束或暂停，停止所有行动
                this.currentTarget = null!;
                return;
            }
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

        // 清理已死亡的Tower，及时释放人口并触发补充
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
                    // 获取敌人脚本，支持Enemy、OrcWarrior、OrcWarlord和TrollSpearman
                    const enemyScript = enemy.getComponent('OrcWarlord') as any || enemy.getComponent('OrcWarrior') as any || enemy.getComponent('Enemy') as any || enemy.getComponent('TrollSpearman') as any;
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

        // 获取敌人脚本，支持Enemy、OrcWarrior、OrcWarlord和TrollSpearman
        const enemyScript = this.currentTarget.getComponent('Enemy') as any || this.currentTarget.getComponent('OrcWarrior') as any || this.currentTarget.getComponent('OrcWarlord') as any || this.currentTarget.getComponent('TrollSpearman') as any;
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

        // 获取敌人脚本，支持Enemy、OrcWarrior、OrcWarlord和TrollSpearman
        const enemyScript = this.currentTarget.getComponent('Enemy') as any || this.currentTarget.getComponent('OrcWarrior') as any || this.currentTarget.getComponent('OrcWarlord') as any || this.currentTarget.getComponent('TrollSpearman') as any;
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

        // 先取消之前的调度，避免重复调度
        this.unschedule(animationUpdate);
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
                const enemyScript = this.currentTarget?.getComponent('Enemy') as any || this.currentTarget?.getComponent('OrcWarrior') as any || this.currentTarget?.getComponent('OrcWarlord') as any || this.currentTarget?.getComponent('TrollSpearman') as any;
                if (enemyScript && enemyScript.takeDamage) {
                    enemyScript.takeDamage(damage);
                }
            }
        );
    }

    produceTower() {
        if (!this.towerPrefab || !this.towerContainer) {
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
                return;
            }
        }

        // 创建Tower
        const tower = instantiate(this.towerPrefab);
        tower.setParent(this.towerContainer);
        tower.setWorldPosition(spawnPos);
        tower.active = true;

        // 设置Tower的建造成本（如果需要）
        const towerScript = tower.getComponent(Arrower);
        if (towerScript) {
            // 先应用配置（排除 buildCost，因为需要在实例化时动态设置）
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                configManager.applyConfigToUnit('Arrower', towerScript, ['buildCost']);
            }
            
            // 然后设置建造成本（由战争古树生产的Arrower建造成本为0）
            towerScript.buildCost = 0;
            
            // 检查单位是否首次出现
            if (this.gameManager) {
                const unitType = towerScript.unitType || 'Arrower';
                this.gameManager.checkUnitFirstAppearance(unitType, towerScript);
            }
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
            return initialPos;
        }


        // 尝试左右平移，交替检查左右两侧
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // 先尝试右侧
            const rightPos = new Vec3(initialPos.x + offsetStep * attempt, initialPos.y, initialPos.z);
            if (!this.hasUnitAtPosition(rightPos, checkRadius)) {
                return rightPos;
            }

            // 再尝试左侧
            const leftPos = new Vec3(initialPos.x - offsetStep * attempt, initialPos.y, initialPos.z);
            if (!this.hasUnitAtPosition(leftPos, checkRadius)) {
                return leftPos;
            }
        }

        // 如果左右平移都找不到，尝试上下方向
        for (let attempt = 1; attempt <= maxAttempts / 2; attempt++) {
            // 尝试上方
            const upPos = new Vec3(initialPos.x, initialPos.y + offsetStep * attempt, initialPos.z);
            if (!this.hasUnitAtPosition(upPos, checkRadius)) {
                return upPos;
            }

            // 尝试下方
            const downPos = new Vec3(initialPos.x, initialPos.y - offsetStep * attempt, initialPos.z);
            if (!this.hasUnitAtPosition(downPos, checkRadius)) {
                return downPos;
            }
        }

        // 如果所有位置都被占用，尝试对角线方向
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
                    return pos;
                }
            }
        }

        // 如果所有位置都被占用，返回初始位置（让Tower自己处理碰撞）
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
                            } else {
                            }
                            return true;
                        }
                    }
                }
            }
        } else {
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
                    const enemyScript = enemy.getComponent('OrcWarlord') as any || enemy.getComponent('OrcWarrior') as any || enemy.getComponent('Enemy') as any;
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
        let removedCount = 0;
        
        this.producedTowers = this.producedTowers.filter(tower => {
            // 检查节点是否有效
            if (!tower || !tower.isValid || !tower.active) {
                removedCount++;
                return false;
            }
            
            // 检查Arrower脚本是否存活（节点有效时才检查）
            const towerScript = tower.getComponent('Arrower') as any;
            if (towerScript && towerScript.isAlive) {
                const isAlive = towerScript.isAlive();
                if (!isAlive) {
                    removedCount++;
                }
                return isAlive;
            }
            
            // 如果没有Arrower脚本，保留节点（可能是其他类型的单位）
            return true;
        });
        
        const afterCount = this.producedTowers.length;
        if (beforeCount !== afterCount) {
            // 更新单位信息面板（如果被选中）
            if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
                this.unitSelectionManager.updateUnitInfo({
                    currentUnitCount: this.producedTowers.length
                });
            }
        }
    }

    /**
     * 获取单位信息（重写父类方法）
     */
    protected getUnitInfo(): UnitInfo | null {
        return {
            name: '弓箭手小屋',
            level: this.level,
            currentHealth: this.currentHealth,
            maxHealth: this.maxHealth,
            attackDamage: this.attackDamage,
            populationCost: 0, // 战争古树不占用人口
            icon: this.cardIcon || this.defaultSpriteFrame,
            collisionRadius: this.collisionRadius,
            attackRange: this.attackRange,
            currentUnitCount: this.producedTowers.length,
            maxUnitCount: this.maxTowerCount
        };
    }

    /**
     * 升级按钮点击事件（重写父类方法）
     */
    protected onUpgradeClick(event?: EventTouch) {
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
            return;
        }

        // 消耗金币
        this.gameManager.spendGold(upgradeCost);

        // 升级：生产Tower上限增加2个
        this.level++;
        this.maxTowerCount += 2;

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
     * 销毁建筑物（重写父类方法，添加生产停止逻辑）
     */
    protected destroyBuilding() {
        // 停止所有生产
        this.isProducing = false;
        this.productionTimer = 0;
        this.productionProgress = 0;

        // 调用父类的销毁方法
        super.destroyBuilding();
    }
}

