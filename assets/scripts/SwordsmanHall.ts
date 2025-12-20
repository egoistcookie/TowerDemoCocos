import { _decorator, Component, Node, Vec3, Prefab, instantiate, find, Sprite, SpriteFrame, Color, Graphics, UITransform, Label, EventTouch, Camera } from 'cc';
import { UnitConfigManager } from './UnitConfigManager';
import { GameManager, GameState } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
import { UnitSelectionManager } from './UnitSelectionManager';
import { UnitInfo } from './UnitInfoPanel';
import { SelectionManager } from './SelectionManager';
import { UnitType } from './WarAncientTree';
import { BuildingGridPanel } from './BuildingGridPanel';
const { ccclass, property } = _decorator;

@ccclass('SwordsmanHall')
export class SwordsmanHall extends Component {
    @property
    maxHealth: number = 100;

    @property(Prefab)
    swordsmanPrefab: Prefab = null!; // 生产的ElfSwordsman预制体

    @property(Prefab)
    explosionEffect: Prefab = null!;

    @property(Prefab)
    damageNumberPrefab: Prefab = null!;

    @property
    buildCost: number = 10; // 建造成本

    @property
    level: number = 1; // 剑士小屋等级

    @property
    collisionRadius: number = 50; // 占地范围（像素）

    @property(SpriteFrame)
    cardIcon: SpriteFrame = null!; // 单位名片图片

    // 单位类型
    public unitType: UnitType = UnitType.BUILDING;
    
    // 单位信息属性
    @property
    unitName: string = "剑士小屋";
    
    @property
    unitDescription: string = "能够生产精灵剑士的建筑物，提供强大的近战攻击单位。";
    
    @property(SpriteFrame)
    unitIcon: SpriteFrame = null!;

    // 生产相关属性
    @property
    maxSwordsmanCount: number = 4; // 最多生产4个ElfSwordsman

    @property
    productionInterval: number = 2.0; // 每2秒生产一个

    @property
    spawnOffset: number = 100; // ElfSwordsman出现在下方100像素

    @property
    moveAwayDistance: number = 80; // ElfSwordsman生成后往前跑开的距离

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
    private producedSwordsmen: Node[] = []; // 已生产的ElfSwordsman列表
    private productionTimer: number = 0; // 生产计时器
    private productionProgress: number = 0; // 生产进度（0-1）
    private isProducing: boolean = false; // 是否正在生产
    private swordsmanContainer: Node = null!; // ElfSwordsman容器
    
    // 小精灵相关
    private attachedWisps: Node[] = []; // 依附的小精灵列表

    // 选择面板相关
    private selectionPanel: Node = null!; // 选择面板节点
    private globalTouchHandler: ((event: EventTouch) => void) | null = null; // 全局触摸事件处理器
    private unitSelectionManager: UnitSelectionManager = null!; // 单位选择管理器

    // 网格位置相关
    public gridX: number = -1; // 网格X坐标
    public gridY: number = -1; // 网格Y坐标
    private isMoving: boolean = false; // 是否正在移动
    private moveStartPos: Vec3 = new Vec3(); // 移动起始位置
    private gridPanel: BuildingGridPanel = null!; // 网格面板组件

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.producedSwordsmen = [];
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

        // 查找ElfSwordsman容器
        this.findSwordsmanContainer();

        // 创建血条
        this.createHealthBar();

        // 创建生产进度条
        this.createProductionProgressBar();

        // 添加点击事件监听
        this.node.on(Node.EventType.TOUCH_END, this.onSwordsmanHallClick, this);
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
     * 查找网格面板
     */
    findGridPanel() {
        const gridPanelNode = find('BuildingGridPanel');
        if (gridPanelNode) {
            this.gridPanel = gridPanelNode.getComponent(BuildingGridPanel);
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

    findSwordsmanContainer() {
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

        let swordsmenNode = find('ElfSwordsmans');
        if (!swordsmenNode && this.node.scene) {
            swordsmenNode = findNodeRecursive(this.node.scene, 'ElfSwordsmans');
        }
        if (swordsmenNode) {
            this.swordsmanContainer = swordsmenNode;
        } else {
            // 如果找不到，创建一个新的容器
            this.swordsmanContainer = new Node('ElfSwordsmans');
            const canvas = find('Canvas');
            if (canvas) {
                this.swordsmanContainer.setParent(canvas);
            } else if (this.node.scene) {
                this.swordsmanContainer.setParent(this.node.scene);
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

        // 检查游戏状态，如果不是Playing状态，停止生产
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                // 游戏已结束或暂停，停止生产
                return;
            }
        }

        // 清理已死亡的ElfSwordsman
        this.cleanupDeadSwordsmen();

        // 生产ElfSwordsman逻辑
        const aliveSwordsmanCount = this.producedSwordsmen.length;
        // 确保在检查时也检查人口上限，补充士兵时也需要占用人口
        if (aliveSwordsmanCount < this.maxSwordsmanCount) {
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
                // produceSwordsman() 方法内部会检查并占用人口
                this.produceSwordsman();
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

    produceSwordsman() {
        if (!this.swordsmanPrefab || !this.swordsmanContainer) {
            return;
        }

        if (this.producedSwordsmen.length >= this.maxSwordsmanCount) {
            return;
        }

        // 检查人口上限
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        if (this.gameManager && !this.gameManager.canAddPopulation(1)) {
            return;
        }

        // 计算ElfSwordsman出现位置（剑士小屋下方100像素）
        const hallPos = this.node.worldPosition.clone();
        let spawnPos = new Vec3(hallPos.x, hallPos.y - this.spawnOffset, hallPos.z);

        // 检查生成位置是否有单位，如果有则左右平移
        spawnPos = this.findAvailableSpawnPosition(spawnPos);

        // 增加人口（在创建ElfSwordsman之前）
        if (this.gameManager) {
            if (!this.gameManager.addPopulation(1)) {
                return;
            }
        }

        // 创建ElfSwordsman
        const swordsman = instantiate(this.swordsmanPrefab);
        swordsman.setParent(this.swordsmanContainer);
        swordsman.setWorldPosition(spawnPos);
        swordsman.active = true;

        // 添加到生产的ElfSwordsman列表
        this.producedSwordsmen.push(swordsman);

        // 计算ElfSwordsman的目标位置（向左右两侧跑开）
        // 根据已生产的ElfSwordsman数量，分散到不同位置
        const swordsmanIndex = this.producedSwordsmen.length - 1;
        // 左右分散：偶数索引向右，奇数索引向左
        const directionX = (swordsmanIndex % 2 === 0 ? 1 : -1);
        
        // 计算目标位置（只改变x坐标，y坐标不变）
        const targetPos = new Vec3(
            spawnPos.x + directionX * this.moveAwayDistance,
            spawnPos.y, // y坐标保持不变
            spawnPos.z
        );

        // 设置ElfSwordsman的建造成本（如果需要）
        const swordsmanScript = swordsman.getComponent('ElfSwordsman') as any;
        if (swordsmanScript) {
            // 应用配置
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                configManager.applyConfigToUnit('ElfSwordsman', swordsmanScript);
            }
            swordsmanScript.buildCost = 0; // 由剑士小屋生产的ElfSwordsman建造成本为0
            
            // 让ElfSwordsman移动到目标位置（先设置移动目标，再显示单位介绍）
            // 使用schedule在下一帧开始移动，确保ElfSwordsman已完全初始化
            this.scheduleOnce(() => {
                if (swordsman && swordsman.isValid && swordsmanScript) {
                    // 使用setManualMoveTargetPosition方法设置移动目标
                    if (swordsmanScript.setManualMoveTargetPosition) {
                        swordsmanScript.setManualMoveTargetPosition(targetPos);
                    } else if (swordsmanScript.moveToPosition) {
                        // 如果没有setManualMoveTargetPosition方法，使用moveToPosition
                        const moveUpdate = (deltaTime: number) => {
                            if (!swordsman || !swordsman.isValid || !swordsmanScript) {
                                this.unschedule(moveUpdate);
                                return;
                            }
                            
                            const currentPos = swordsman.worldPosition;
                            const distance = Vec3.distance(currentPos, targetPos);
                            
                            if (distance <= 10) {
                                // 到达目标位置，停止移动
                                if (swordsmanScript.stopMoving) {
                                    swordsmanScript.stopMoving();
                                }
                                this.unschedule(moveUpdate);
                            } else {
                                // 继续移动
                                swordsmanScript.moveToPosition(targetPos, deltaTime);
                            }
                        };
                        this.schedule(moveUpdate, 0);
                    }
                }
            }, 0.05);
            
            // 检查单位是否首次出现（在设置移动目标后显示单位介绍）
            if (this.gameManager) {
                const unitType = swordsmanScript.unitType || 'ElfSwordsman';
                this.gameManager.checkUnitFirstAppearance(unitType, swordsmanScript);
            }
        }

        
        // 更新单位信息面板（如果被选中）
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                currentUnitCount: this.producedSwordsmen.length
            });
        }
    }

    findAvailableSpawnPosition(initialPos: Vec3): Vec3 {
        const checkRadius = 30; // ElfSwordsman的碰撞半径
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

        // 如果所有位置都被占用，返回初始位置（让ElfSwordsman自己处理碰撞）
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

        // 检查与其他ElfSwordsman的碰撞
        // 每次都重新查找ElfSwordsmans节点，确保获取到所有ElfSwordsman（包括手动建造的）
        const findSwordsmenNodeRecursive = (node: Node, name: string): Node | null => {
            if (node.name === name) {
                return node;
            }
            for (const child of node.children) {
                const found = findSwordsmenNodeRecursive(child, name);
                if (found) return found;
            }
            return null;
        };

        let swordsmenNode = find('ElfSwordsmans');
        if (!swordsmenNode && this.node.scene) {
            swordsmenNode = findSwordsmenNodeRecursive(this.node.scene, 'ElfSwordsmans');
        }
        
        if (swordsmenNode) {
            const swordsmen = swordsmenNode.children || [];
            
            for (const swordsman of swordsmen) {
                if (swordsman && swordsman.isValid && swordsman.active) {
                    const swordsmanScript = swordsman.getComponent('ElfSwordsman') as any;
                    if (swordsmanScript && swordsmanScript.isAlive && swordsmanScript.isAlive()) {
                        // 获取ElfSwordsman的实时位置（包括正在移动的ElfSwordsman）
                        const swordsmanPos = swordsman.worldPosition;
                        const distance = Vec3.distance(position, swordsmanPos);
                        const otherRadius = swordsmanScript.collisionRadius || radius;
                        // 使用1.2倍的安全距离，确保不会重叠（和ElfSwordsman的checkCollisionAtPosition保持一致）
                        const minDistance = (radius + otherRadius) * 1.2;
                        
                        if (distance < minDistance) {
                            // 检查是否是自己生产的ElfSwordsman
                            let isProducedSwordsman = false;
                            for (const producedSwordsman of this.producedSwordsmen) {
                                if (producedSwordsman === swordsman) {
                                    isProducedSwordsman = true;
                                    break;
                                }
                            }
                            
                            if (isProducedSwordsman) {
                            } else {
                            }
                            return true;
                        }
                    }
                }
            }
        } else {
        }

        // 检查与剑士小屋的碰撞
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

        let hallsNode = find('SwordsmanHalls');
        if (!hallsNode && this.node.scene) {
            hallsNode = findNodeRecursive(this.node.scene, 'SwordsmanHalls');
        }
        
        if (hallsNode) {
            const halls = hallsNode.children || [];
            for (const hall of halls) {
                if (hall && hall.isValid && hall.active && hall !== this.node) {
                    const hallScript = hall.getComponent('SwordsmanHall') as any;
                    if (hallScript && hallScript.isAlive && hallScript.isAlive()) {
                        const distance = Vec3.distance(position, hall.worldPosition);
                        const hallRadius = 50; // 剑士小屋的半径
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

    cleanupDeadSwordsmen() {
        // 清理已死亡的ElfSwordsman
        const beforeCount = this.producedSwordsmen.length;
        let removedCount = 0;
        
        this.producedSwordsmen = this.producedSwordsmen.filter(swordsman => {
            // 检查节点是否有效
            if (!swordsman || !swordsman.isValid || !swordsman.active) {
                removedCount++;
                return false; // 节点无效，直接移除，不再检查脚本
            }
            
            // 检查ElfSwordsman脚本是否存活（节点有效时才检查）
            const swordsmanScript = swordsman.getComponent('ElfSwordsman') as any;
            if (swordsmanScript && swordsmanScript.isAlive) {
                const isAlive = swordsmanScript.isAlive();
                if (!isAlive) {
                    removedCount++;
                }
                return isAlive;
            }
            
            // 如果没有ElfSwordsman脚本，保留节点（可能是其他类型的单位）
            return true;
        });
        
        // 只在有ElfSwordsman死亡时减少人口（避免重复减少）
        // 注意：ElfSwordsman的buildCost为0，所以ElfSwordsman.destroyTower()不会减少人口
        // 因此这里需要减少人口
        if (removedCount > 0 && this.gameManager) {
            this.gameManager.removePopulation(removedCount);
        }
        
        const afterCount = this.producedSwordsmen.length;
        if (beforeCount !== afterCount) {
            
            // 更新单位信息面板（如果被选中）
            if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
                this.unitSelectionManager.updateUnitInfo({
                    currentUnitCount: this.producedSwordsmen.length
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

        // 释放网格占用
        if (this.gridPanel && this.gridX >= 0 && this.gridY >= 0) {
            this.gridPanel.releaseGrid(this.gridX, this.gridY);
        }

        // 移除移动事件监听
        if (this.isMoving) {
            const canvas = find('Canvas');
            if (canvas) {
                canvas.off(Node.EventType.TOUCH_MOVE, this.onMoveTouchMove, this);
                canvas.off(Node.EventType.TOUCH_END, this.onMoveTouchEnd, this);
            }
        }

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
     * 剑士小屋点击事件
     */
    onSwordsmanHallClick(event: EventTouch) {
        
        // 检查是否正在拖拽建筑物（通过TowerBuilder）
        // 使用递归查找方法，更可靠
        let towerBuilderNode = find('TowerBuilder');
        if (!towerBuilderNode && this.node.scene) {
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
            towerBuilderNode = findNodeRecursive(this.node.scene, 'TowerBuilder');
        }
        
        // 如果还是找不到，尝试通过组件类型查找
        let towerBuilder: any = null;
        if (towerBuilderNode) {
            towerBuilder = towerBuilderNode.getComponent('TowerBuilder') as any;
        } else if (this.node.scene) {
            // 从场景中查找TowerBuilder组件
            const findComponentInScene = (node: Node, componentType: string): any => {
                const comp = node.getComponent(componentType);
                if (comp) return comp;
                for (const child of node.children) {
                    const found = findComponentInScene(child, componentType);
                    if (found) return found;
                }
                return null;
            };
            towerBuilder = findComponentInScene(this.node.scene, 'TowerBuilder');
        }
        
        
        // 检查是否正在长按检测（由TowerBuilder处理）
        // 注意：不要阻止事件传播，让TowerBuilder的onTouchEnd也能处理
        if (towerBuilder && (towerBuilder as any).isLongPressActive) {
            // 不阻止事件传播，让TowerBuilder的onTouchEnd也能处理
            // event.propagationStopped = true; // 注释掉，让事件继续传播
            return;
        }
        
        // 检查是否正在显示信息面板（由TowerBuilder打开）
        if ((this.node as any)._showingInfoPanel) {
            return;
        }
        
        if (towerBuilder && towerBuilder.isDraggingBuilding) {
            // 直接调用TowerBuilder的方法来处理拖拽结束，而不是依赖事件传播
            if (towerBuilder.endDraggingBuilding && typeof towerBuilder.endDraggingBuilding === 'function') {
                towerBuilder.endDraggingBuilding(event);
            }
            return;
        }
        
        // 检查是否有选中的小精灵，如果有则不处理点击事件（让小精灵移动到建筑物）
        const selectionManager = this.findSelectionManager();
        
        let hasSelectedWisps = false;
        if (selectionManager && selectionManager.hasSelectedWisps && typeof selectionManager.hasSelectedWisps === 'function') {
            hasSelectedWisps = selectionManager.hasSelectedWisps();
        } else {
        }
        
        if (hasSelectedWisps) {
            // 有选中的小精灵，不处理建筑物的点击事件，让SelectionManager处理移动
            // 不设置propagationStopped，让事件继续传播，这样SelectionManager的移动命令可以执行
            return;
        }

        // 阻止事件传播
        event.propagationStopped = true;

        // 如果正在移动，不处理点击
        if (this.isMoving) {
            return;
        }

        // 如果已经显示选择面板，先隐藏
        if (this.selectionPanel && this.selectionPanel.isValid) {
            this.hideSelectionPanel();
            return;
        }

        // 开始移动模式
        this.startMoving(event);
    }

    /**
     * 开始移动建筑物
     */
    startMoving(event: EventTouch) {
        if (!this.gridPanel) {
            this.findGridPanel();
        }
        
        if (!this.gridPanel) {
            // 如果没有网格面板，显示选择面板
            this.showSelectionPanel();
            return;
        }

        this.isMoving = true;
        this.moveStartPos = this.node.worldPosition.clone();
        
        // 监听触摸移动和结束事件
        const canvas = find('Canvas');
        if (canvas) {
            canvas.on(Node.EventType.TOUCH_MOVE, this.onMoveTouchMove, this);
            canvas.on(Node.EventType.TOUCH_END, this.onMoveTouchEnd, this);
        }
        
        // 高亮当前网格
        this.gridPanel.highlightGrid(this.node.worldPosition);
    }

    /**
     * 移动时的触摸移动事件
     */
    onMoveTouchMove(event: EventTouch) {
        if (!this.isMoving || !this.gridPanel) {
            return;
        }

        // 获取触摸位置并转换为世界坐标
        const touchLocation = event.getLocation();
        const cameraNode = find('Canvas/Camera');
        if (!cameraNode) return;
        
        const camera = cameraNode.getComponent(Camera);
        if (!camera) return;

        const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
        const worldPos = new Vec3();
        camera.screenToWorld(screenPos, worldPos);
        worldPos.z = 0;

        // 高亮网格
        this.gridPanel.highlightGrid(worldPos);
    }

    /**
     * 移动时的触摸结束事件
     */
    onMoveTouchEnd(event: EventTouch) {
        if (!this.isMoving || !this.gridPanel) {
            return;
        }

        // 移除事件监听
        const canvas = find('Canvas');
        if (canvas) {
            canvas.off(Node.EventType.TOUCH_MOVE, this.onMoveTouchMove, this);
            canvas.off(Node.EventType.TOUCH_END, this.onMoveTouchEnd, this);
        }

        this.isMoving = false;

        // 获取触摸位置并转换为世界坐标
        const touchLocation = event.getLocation();
        const cameraNode = find('Canvas/Camera');
        if (!cameraNode) {
            this.gridPanel.clearHighlight();
            return;
        }
        
        const camera = cameraNode.getComponent(Camera);
        if (!camera) {
            this.gridPanel.clearHighlight();
            return;
        }

        const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
        const worldPos = new Vec3();
        camera.screenToWorld(screenPos, worldPos);
        worldPos.z = 0;

        // 获取最近的网格中心
        const gridCenter = this.gridPanel.getNearestGridCenter(worldPos);
        if (gridCenter) {
            // 检查目标网格是否可用
            const grid = this.gridPanel.worldToGrid(gridCenter);
            if (grid && !this.gridPanel.isGridOccupied(grid.x, grid.y)) {
                // 移动到新位置
                this.moveToGridPosition(grid.x, grid.y);
            } else {
                // 目标网格已被占用，显示选择面板
                this.showSelectionPanel();
            }
        } else {
            // 不在网格内，显示选择面板
            this.showSelectionPanel();
        }

        // 清除高亮
        this.gridPanel.clearHighlight();
    }

    /**
     * 移动到指定网格位置
     */
    moveToGridPosition(gridX: number, gridY: number) {
        if (!this.gridPanel) {
            this.findGridPanel();
        }
        
        if (!this.gridPanel) {
            return;
        }

        // 获取目标网格的世界坐标
        const targetWorldPos = this.gridPanel.gridToWorld(gridX, gridY);
        if (!targetWorldPos) {
            return;
        }

        // 释放原网格
        if (this.gridX >= 0 && this.gridY >= 0) {
            this.gridPanel.releaseGrid(this.gridX, this.gridY);
        }

        // 占用新网格
        this.gridPanel.occupyGrid(gridX, gridY, this.node);
        this.gridX = gridX;
        this.gridY = gridY;

        // 移动建筑物到新位置
        this.node.setWorldPosition(targetWorldPos);

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

        this.selectionPanel = new Node('SwordsmanHallSelectionPanel');
        this.selectionPanel.setParent(canvas);

        // 添加UITransform
        const uiTransform = this.selectionPanel.addComponent(UITransform);
        uiTransform.setContentSize(120, 40);

        // 设置位置（在剑士小屋上方）
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
                name: '剑士小屋',
                level: this.level,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth,
                attackDamage: 0, // 剑士小屋没有攻击能力
                populationCost: 0, // 剑士小屋不占用人口
                icon: this.cardIcon || this.defaultSpriteFrame,
                collisionRadius: this.collisionRadius,
                currentUnitCount: this.producedSwordsmen.length,
                maxUnitCount: this.maxSwordsmanCount,
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
        }

        // 隐藏面板
        this.hideSelectionPanel();
        
        // 销毁剑士小屋
        this.destroySwordsmanHall();
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
            return;
        }

        // 消耗金币
        this.gameManager.spendGold(upgradeCost);

        // 升级：生产ElfSwordsman上限增加2个
        this.level++;
        this.maxSwordsmanCount += 2;


        // 更新单位信息面板
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                level: this.level,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth,
                maxUnitCount: this.maxSwordsmanCount,
                currentUnitCount: this.producedSwordsmen.length
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
            return;
        }

        // 检查小精灵是否已经依附在其他建筑物上
        if (wispScript.getIsAttached && wispScript.getIsAttached()) {
            return;
        }

        // 先将小精灵添加到依附列表，再调用attachToBuilding
        this.attachedWisps.push(wisp);
        
        // 让小精灵依附，传递fromBuilding参数为true避免循环调用
        if (wispScript.attachToBuilding) {
            wispScript.attachToBuilding(this.node, true);
        }
    }

    /**
     * 卸下小精灵
     */
    detachWisp() {
        if (this.attachedWisps.length === 0) {
            return;
        }

        // 卸下第一个小精灵
        const wisp = this.attachedWisps[0];
        // 先从列表中移除，再调用detachFromBuilding，避免indexOf出错
        this.attachedWisps.shift();
        
        const wispScript = wisp.getComponent('Wisp') as any;
        if (wispScript && wispScript.detachFromBuilding) {
            wispScript.detachFromBuilding();
        }
    }

    /**
     * 销毁剑士小屋（用于拆除）
     */
    destroySwordsmanHall() {
        // 停止所有生产
        this.isProducing = false;
        this.productionTimer = 0;
        this.productionProgress = 0;

        // 隐藏面板
        this.hideSelectionPanel();

        // 移除点击事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onSwordsmanHallClick, this);

        // 调用die方法进行销毁
        this.die();
    }
}

