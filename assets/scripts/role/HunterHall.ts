import { _decorator, Node, Vec3, Prefab, instantiate, find, SpriteFrame, Color, Graphics, UITransform, EventTouch } from 'cc';
import { UnitConfigManager } from '../UnitConfigManager';
import { GameState } from '../GameManager';
import { UnitInfo } from '../UnitInfoPanel';
import { Build } from './Build';
import { TalentEffectManager } from '../TalentEffectManager';
import { UnitPool } from '../UnitPool';
const { ccclass, property } = _decorator;

@ccclass('HunterHall')
export class HunterHall extends Build {
    @property(Prefab)
    hunterPrefab: Prefab = null!; // 生产的Hunter预制体

    // 生产相关属性
    @property
    maxHunterCount: number = 4; // 最多生产4个Hunter

    @property
    productionInterval: number = 2.0; // 每2秒生产一个

    @property
    spawnOffset: number = 100; // Hunter出现在下方100像素

    @property
    moveAwayDistance: number = 80; // Hunter生成后往前跑开的距离

    // 生产相关私有属性
    private productionProgressBar: Node = null!; // 生产进度条节点
    private productionProgressGraphics: Graphics = null!; // 生产进度条Graphics组件
    private producedHunters: Node[] = []; // 已生产的Hunter列表
    private totalProducedCount: number = 0; // 累计生产的单位数量（用于计算金币消耗）
    private productionTimer: number = 0; // 生产计时器
    private productionProgress: number = 0; // 生产进度（0-1）
    private isProducing: boolean = false; // 是否正在生产
    private hunterContainer: Node = null!; // Hunter容器

    start() {
        // 调用父类的通用初始化逻辑
        super.start();

        this.producedHunters = [];
        this.totalProducedCount = 0; // 重置累计生产数量
        this.productionTimer = 0;
        this.productionProgress = 0;
        this.isProducing = false;

        // 查找Hunter容器
        this.findHunterContainer();

        // 创建生产进度条
        this.createProductionProgressBar();

        // 添加点击事件监听（使用父类的通用方法）
        this.node.on(Node.EventType.TOUCH_END, this.onBuildingClick, this);
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
                // 游戏已结束或暂停，停止生产
                return;
            }
        }

        // 清理已死亡的Hunter
        this.cleanupDeadHunters();

        // 生产Hunter逻辑
        const aliveHunterCount = this.producedHunters.length;
        // 确保在检查时也检查人口上限，补充士兵时也需要占用人口
        if (aliveHunterCount < this.maxHunterCount) {
            // 检查人口上限（补充士兵时也需要占用人口）
            if (!this.gameManager) {
                this.findGameManager();
            }
            
            if (this.gameManager && !this.gameManager.canAddPopulation(1)) {
                // 人口已满，停止生产
                if (this.isProducing) {
                    this.isProducing = false;
                    this.productionProgress = 0;
                    this.updateProductionProgressBar();
                }
                return;
            }
            
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
                // produceHunter() 方法内部会检查并占用人口
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
                return;
            }
        }

        // 检查是否需要消耗金币：前4个单位免费，之后每补充1个单位消耗3金币
        // 使用累计生产数量，而不是当前存活数量
        const freeUnitCount = 4; // 前4个单位免费
        const unitCost = 3; // 之后每单位消耗3金币
        
        if (this.totalProducedCount >= freeUnitCount) {
            // 需要消耗金币
            if (!this.gameManager) {
                this.findGameManager();
            }
            if (this.gameManager && !this.gameManager.canAfford(unitCost)) {
                // 金币不足，回退人口
                if (this.gameManager) {
                    this.gameManager.removePopulation(1);
                }
                return;
            }
            // 消耗金币
            if (this.gameManager) {
                this.gameManager.spendGold(unitCost);
            }
        }

        // 性能优化：从对象池获取Hunter，而不是直接实例化
        let hunter: Node | null = null;
        const unitPool = UnitPool.getInstance();
        if (unitPool) {
            // 确保预制体已注册到对象池（如果未注册则注册）
            const stats = unitPool.getStats();
            if (!stats['Hunter']) {
                unitPool.registerPrefab('Hunter', this.hunterPrefab);
            }
            hunter = unitPool.get('Hunter');
        }
        
        // 如果对象池没有可用对象，降级使用instantiate
        if (!hunter) {
            hunter = instantiate(this.hunterPrefab);
        }
        
        // 重要：先禁用节点，避免在 setParent 时触发 onEnable
        hunter.active = false;
        
        hunter.setParent(this.hunterContainer);

        // 修复：在激活前先设置位置，确保 onEnable 时位置已正确（否则复活单位可能因为旧位置 y >= 500 而不安排自动上移）
        hunter.setWorldPosition(spawnPos);
        // 设置Hunter的建造成本（如果需要）
        const hunterScript = hunter.getComponent('Hunter') as any;
        if (hunterScript) {
            // 设置prefabName（用于对象池回收）
            if (hunterScript.prefabName === undefined || hunterScript.prefabName === '') {
                hunterScript.prefabName = 'Hunter';
            }
            
            // 检查单位是否首次出现
            if (this.gameManager) {
                const unitType = hunterScript.unitType || 'Hunter';
                this.gameManager.checkUnitFirstAppearance(unitType, hunterScript);
            }
        }
        
        // 现在激活节点，只触发一次 onEnable()
        hunter.active = true;
        // 同步建筑星级到训练单位头顶
        this.applyStarToProducedUnit(hunter);

        if (hunterScript) {
           //console.info(`[HunterHall] 生产猎手，最终攻击力=${hunterScript.attackDamage}, 生命值=${hunterScript.maxHealth}`);
        }

        // 添加到生产的Hunter列表
        this.producedHunters.push(hunter);
        // 增加累计生产数量
        this.totalProducedCount++;

        // 让Hunter移动到目标位置
        if (hunterScript) {
            this.scheduleOnce(() => {
                if (hunter && hunter.isValid && hunterScript) {
                    // 目标点计算延后到后置队列，进一步削峰
                    let targetPos: Vec3;
                    if (this.rallyPoint) {
                        targetPos = this.findOptimalRallyPointPosition(this.rallyPoint, hunter.worldPosition.clone());
                    } else {
                        const hunterIndex = this.producedHunters.length - 1;
                        const directionX = (hunterIndex % 2 === 0 ? 1 : -1);
                        const hp = hunter.worldPosition;
                        targetPos = new Vec3(hp.x + directionX * this.moveAwayDistance, hp.y, hp.z);
                    }
                    // 集结/跑开目标再按场景占用收束一格，减少多单位落同点重叠
                    targetPos = this.findAvailableSpawnPosition(targetPos);
                    // 使用setManualMoveTargetPosition方法设置移动目标
                    if (hunterScript.setManualMoveTargetPosition) {
                        hunterScript.setManualMoveTargetPosition(targetPos);
                    } else if (hunterScript.moveToPosition) {
                        // 如果没有setManualMoveTargetPosition方法，使用moveToPosition
                        let elapsed = 0;
                        const moveUpdate = (deltaTime: number) => {
                            if (!hunter || !hunter.isValid || !hunterScript) {
                                this.unschedule(moveUpdate);
                                return;
                            }
                            elapsed += deltaTime;
                            if (elapsed >= 6) {
                                if (hunterScript.stopMoving) hunterScript.stopMoving();
                                this.unschedule(moveUpdate);
                                return;
                            }
                            
                            const currentPos = hunter.worldPosition;
                            // 性能优化：使用平方距离比较
                            const dx = targetPos.x - currentPos.x;
                            const dy = targetPos.y - currentPos.y;
                            const distanceSq = dx * dx + dy * dy;
                            const arriveThreshold = 10;
                            const arriveThresholdSq = arriveThreshold * arriveThreshold;
                            
                            if (distanceSq <= arriveThresholdSq) {
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
                        this.schedule(moveUpdate, 0.05);
                    }
                }
            }, 0.05);
        }

        
        // 更新单位信息面板（如果被选中）
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                currentUnitCount: this.producedHunters.length
            });
        }
    }

    findAvailableSpawnPosition(initialPos: Vec3): Vec3 {
        const checkRadius = 38; // 生成站位半径（略大于逻辑碰撞，减少视觉重叠）
        const offsetStep = 54; // 每次平移的距离（增大步长，确保不会重叠）
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

        // 如果所有位置都被占用，返回初始位置（让Hunter自己处理碰撞）
        return initialPos;
    }

    hasUnitAtPosition(position: Vec3, radius: number): boolean {
        const minDistance = radius * 2; // 最小距离（两个半径）

        // 检查与水晶的碰撞（使用平方距离比较）
        const crystal = find('Crystal');
        if (crystal && crystal.isValid && crystal.active) {
            const crystalRadius = 50;
            // 使用安全距离，确保不会重叠
            const minDistance = (radius + crystalRadius) * 1.1;
            const dx0 = crystal.worldPosition.x - position.x;
            const dy0 = crystal.worldPosition.y - position.y;
            const distanceSq0 = dx0 * dx0 + dy0 * dy0;
            if (distanceSq0 < minDistance * minDistance) {
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
            
            for (const hunter of hunters) {
                // 勿要求 active：新单位先 setPosition 再 active=true，否则同帧第二只会误判空位而重叠
                if (hunter && hunter.isValid) {
                    const hunterScript = hunter.getComponent('Hunter') as any;
                    if (hunterScript && hunterScript.isAlive && hunterScript.isAlive()) {
                        // 获取Hunter的实时位置（包括正在移动的Hunter）
                        const hunterPos = hunter.worldPosition;
                        const dx1 = hunterPos.x - position.x;
                        const dy1 = hunterPos.y - position.y;
                        const distanceSq1 = dx1 * dx1 + dy1 * dy1;
                        const otherRadius = hunterScript.collisionRadius || radius;
                        // 使用1.2倍的安全距离，确保不会重叠（和Hunter的checkCollisionAtPosition保持一致）
                        const minDistance1 = (radius + otherRadius) * 1.2;
                        
                        if (distanceSq1 < minDistance1 * minDistance1) {
                            return true;
                        }
                    }
                }
            }
        } else {
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
                        const dx2 = hall.worldPosition.x - position.x;
                        const dy2 = hall.worldPosition.y - position.y;
                        const distanceSq2 = dx2 * dx2 + dy2 * dy2;
                        const hallRadius = 50; // 猎手大厅的半径
                        // 使用安全距离，确保不会重叠
                        const minDistance2 = (radius + hallRadius) * 1.1;
                        if (distanceSq2 < minDistance2 * minDistance2) {
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
                        const dx3 = enemy.worldPosition.x - position.x;
                        const dy3 = enemy.worldPosition.y - position.y;
                        const distanceSq3 = dx3 * dx3 + dy3 * dy3;
                        const enemyRadius = 30;
                        // 使用安全距离，确保不会重叠
                        const minDistance3 = (radius + enemyRadius) * 1.1;
                        if (distanceSq3 < minDistance3 * minDistance3) {
                            return true;
                        }
                    }
                }
            }
        }

        // 检查与其他类型友军单位的碰撞（跨类型防重叠）
        const friendlyContainers: Array<{ base: string; scriptName: string }> = [
            { base: 'Towers', scriptName: 'Arrower' },
            { base: 'Towers', scriptName: 'Priest' },
            { base: 'ElfSwordsmans', scriptName: 'ElfSwordsman' },
            { base: 'Mages', scriptName: 'Mage' },
        ];
        const crossTypeMinDist = 60; // 跨类型单位最小间距
        const crossTypeMinDistSq = crossTypeMinDist * crossTypeMinDist;
        for (const { base, scriptName } of friendlyContainers) {
            const containerNode = this.resolveUnitsContainerNode(base);
            if (!containerNode) continue;
            for (const unit of containerNode.children) {
                // 勿依赖 active：与生成流程一致，避免同帧未激活单位漏检
                if (!unit || !unit.isValid) continue;
                const unitScript = unit.getComponent(scriptName) as any;
                if (unitScript && unitScript.isAlive && unitScript.isAlive()) {
                    const up = unit.worldPosition;
                    const udx = up.x - position.x, udy = up.y - position.y;
                    if (udx * udx + udy * udy < crossTypeMinDistSq) return true;
                }
            }
        }

        return false;
    }

    cleanupDeadHunters() {
        // 清理已死亡的Hunter
        const beforeCount = this.producedHunters.length;
        let removedCount = 0;
        
        this.producedHunters = this.producedHunters.filter(hunter => {
            // 检查节点是否有效
            if (!hunter || !hunter.isValid || !hunter.active) {
                removedCount++;
                return false; // 节点无效，直接移除，不再检查脚本
            }
            
            // 检查Hunter脚本是否存活（节点有效时才检查）
            const hunterScript = hunter.getComponent('Hunter') as any;
            if (hunterScript && hunterScript.isAlive) {
                const isAlive = hunterScript.isAlive();
                if (!isAlive) {
                    removedCount++;
                }
                return isAlive;
            }
            
            // 如果没有Hunter脚本，保留节点（可能是其他类型的单位）
            return true;
        });
        
        const afterCount = this.producedHunters.length;
        if (beforeCount !== afterCount) {
            
            // 更新单位信息面板（如果被选中）
            if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
                this.unitSelectionManager.updateUnitInfo({
                    currentUnitCount: this.producedHunters.length
                });
            }
        }
    }



    /**
     * 获取单位信息（重写父类方法）
     */
    protected getUnitInfo(): UnitInfo | null {
        return {
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
            rallyPoint: this.rallyPoint
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

        // 升级：生产Hunter上限增加2个
        this.level++;
        this.maxHunterCount += 2;

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