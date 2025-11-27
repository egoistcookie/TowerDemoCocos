import { _decorator, Component, Node, Vec3, Prefab, instantiate, find, Graphics, UITransform, Label, Color, EventTouch, Sprite, SpriteFrame } from 'cc';
import { GameManager, GameState } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
import { UnitSelectionManager } from './UnitSelectionManager';
import { UnitInfo } from './UnitInfoPanel';
const { ccclass, property } = _decorator;

@ccclass('Wisp')
export class Wisp extends Component {
    @property
    maxHealth: number = 30; // 小精灵血量

    @property(Prefab)
    explosionEffect: Prefab = null!;

    @property(Prefab)
    damageNumberPrefab: Prefab = null!;

    @property(Prefab)
    healEffectPrefab: Prefab = null!; // 治疗特效预制体

    @property
    healAmount: number = 2; // 每次治疗恢复的血量

    @property
    healInterval: number = 1.0; // 治疗间隔（秒）

    @property
    moveSpeed: number = 80; // 移动速度（像素/秒）

    @property
    collisionRadius: number = 20; // 碰撞半径（像素）

    @property
    attachOffset: Vec3 = new Vec3(0, 30, 0); // 依附在建筑物上的偏移位置

    private currentHealth: number = 30;
    private healthBar: HealthBar = null!;
    private healthBarNode: Node = null!;
    private isDestroyed: boolean = false;
    private gameManager: GameManager = null!;
    private spriteComponent: Sprite = null!; // Sprite组件引用
    private defaultSpriteFrame: SpriteFrame = null!; // 默认SpriteFrame
    private unitSelectionManager: UnitSelectionManager = null!; // 单位选择管理器
    private isHighlighted: boolean = false; // 是否高亮显示
    private highlightNode: Node = null!; // 高亮效果节点
    
    // 依附相关
    private attachedBuilding: Node = null!; // 依附的建筑物
    private isAttached: boolean = false; // 是否已依附
    private healTimer: number = 0; // 治疗计时器
    
    // 移动相关
    private moveTarget: Vec3 | null = null!; // 移动目标位置
    private isMoving: boolean = false; // 是否正在移动
    private manualMoveTarget: Vec3 | null = null!; // 手动移动目标位置
    private isManuallyControlled: boolean = false; // 是否正在手动控制

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.isAttached = false;
        this.attachedBuilding = null!;
        this.healTimer = 0;
        this.isMoving = false;
        this.moveTarget = null!;
        this.manualMoveTarget = null!;
        this.isManuallyControlled = false;

        // 获取Sprite组件
        this.spriteComponent = this.node.getComponent(Sprite);
        if (this.spriteComponent && this.spriteComponent.spriteFrame) {
            this.defaultSpriteFrame = this.spriteComponent.spriteFrame;
        }

        // 查找游戏管理器
        this.findGameManager();

        // 查找单位选择管理器
        this.findUnitSelectionManager();

        // 创建血条
        this.createHealthBar();

        // 监听点击事件
        this.node.on(Node.EventType.TOUCH_END, this.onWispClick, this);
    }

    onDestroy() {
        // 移除点击事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onWispClick, this);

        // 如果依附在建筑物上，通知建筑物移除小精灵
        if (this.isAttached && this.attachedBuilding && this.attachedBuilding.isValid) {
            this.detachFromBuilding();
        }

        // 减少人口
        if (this.gameManager) {
            this.gameManager.removePopulation(1);
        }
    }

    update(deltaTime: number) {
        if (this.isDestroyed) {
            return;
        }

        // 检查游戏状态
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                return;
            }
        }

        // 如果依附在建筑物上，更新位置并治疗
        if (this.isAttached && this.attachedBuilding && this.attachedBuilding.isValid) {
            // 更新位置（跟随建筑物）
            const buildingPos = this.attachedBuilding.worldPosition.clone();
            const attachPos = buildingPos.add(this.attachOffset);
            this.node.setWorldPosition(attachPos);

            // 治疗建筑物
            this.healTimer += deltaTime;
            if (this.healTimer >= this.healInterval) {
                this.healTimer = 0;
                this.healBuilding();
            }
        } else {
            // 优先处理手动移动
            if (this.isManuallyControlled && this.manualMoveTarget) {
                const currentPos = this.node.worldPosition.clone();
                const targetPos = this.manualMoveTarget.clone(); // 克隆目标位置，避免被修改
                const direction = new Vec3(); // 创建新的方向向量
                Vec3.subtract(direction, targetPos, currentPos); // 使用静态方法计算方向，不会修改原始向量
                const distance = direction.length();

                if (distance <= 5) {
                    // 到达目标位置
                    this.node.setWorldPosition(targetPos);
                    this.isManuallyControlled = false;
                    this.manualMoveTarget = null!;
                    
                    // 到达目标位置后，检查是否与建筑物重叠
                    this.checkBuildingOverlap();
                } else {
                    // 继续移动
                    const moveDistance = this.moveSpeed * deltaTime;
                    const moveStep = direction.normalize().multiplyScalar(Math.min(moveDistance, distance));
                    const newPos = currentPos.add(moveStep);
                    this.node.setWorldPosition(newPos);
                    
                    // 移动过程中不检查重叠，避免在移动时被依附
                }
            } else if (this.isMoving && this.moveTarget) {
                // 自动移动到目标位置
                const currentPos = this.node.worldPosition.clone();
                const targetPos = this.moveTarget.clone(); // 克隆目标位置，避免被修改
                const direction = new Vec3(); // 创建新的方向向量
                Vec3.subtract(direction, targetPos, currentPos); // 使用静态方法计算方向，不会修改原始向量
                const distance = direction.length();

                if (distance <= 5) {
                    // 到达目标位置
                    this.node.setWorldPosition(targetPos);
                    this.isMoving = false;
                    this.moveTarget = null!;
                    
                    // 到达目标位置后，检查是否与建筑物重叠
                    this.checkBuildingOverlap();
                } else {
                    // 继续移动
                    const moveDistance = this.moveSpeed * deltaTime;
                    const moveStep = direction.normalize().multiplyScalar(Math.min(moveDistance, distance));
                    const newPos = currentPos.add(moveStep);
                    this.node.setWorldPosition(newPos);
                    
                    // 移动过程中不检查重叠，避免在移动时被依附
                }
            } else {
                // 静止状态下检查是否与建筑物重叠
                this.checkBuildingOverlap();
            }
        }
    }

    /**
     * 查找游戏管理器
     */
    findGameManager() {
        let gmNode = find('GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager);
            if (this.gameManager) {
                return;
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
            this.gameManager = findInScene(scene, GameManager);
        }
    }

    /**
     * 查找单位选择管理器
     */
    findUnitSelectionManager() {
        let managerNode = find('UnitSelectionManager');
        if (managerNode) {
            this.unitSelectionManager = managerNode.getComponent(UnitSelectionManager);
            if (this.unitSelectionManager) {
                return;
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
            this.unitSelectionManager = findInScene(scene, UnitSelectionManager);
        }
    }

    /**
     * 创建血条
     */
    createHealthBar() {
        this.healthBarNode = new Node('HealthBar');
        this.healthBarNode.setParent(this.node);
        this.healthBarNode.setPosition(0, 30, 0);

        this.healthBar = this.healthBarNode.addComponent(HealthBar);
        if (this.healthBar) {
            this.healthBar.setMaxHealth(this.maxHealth);
            this.healthBar.setHealth(this.currentHealth);
        }
    }

    /**
     * 依附到建筑物
     */
    attachToBuilding(building: Node) {
        if (this.isAttached) {
            console.warn('Wisp: Already attached to a building!');
            return;
        }

        this.attachedBuilding = building;
        this.isAttached = true;
        this.isMoving = false;
        this.moveTarget = null!;

        // 通知建筑物有小精灵依附
        const buildingScript = building.getComponent('WarAncientTree') as any;
        if (buildingScript && buildingScript.attachWisp) {
            buildingScript.attachWisp(this.node);
        } else {
            const moonWellScript = building.getComponent('MoonWell') as any;
            if (moonWellScript && moonWellScript.attachWisp) {
                moonWellScript.attachWisp(this.node);
            }
        }

        // 立即更新位置
        const buildingPos = building.worldPosition.clone();
        const attachPos = buildingPos.add(this.attachOffset);
        this.node.setWorldPosition(attachPos);

        console.log('Wisp: Attached to building');
    }

    /**
     * 从建筑物卸下
     */
    detachFromBuilding() {
        if (!this.isAttached) {
            return;
        }

        const building = this.attachedBuilding;
        this.attachedBuilding = null!;
        this.isAttached = false;

        // 通知建筑物小精灵已卸下（建筑物会从列表中移除）
        // 注意：建筑物会在detachWisp方法中处理列表移除，这里不需要手动移除

        // 移动到建筑物前方
        if (building && building.isValid) {
            const buildingPos = building.worldPosition.clone();
            // 建筑物前方位置（下方）
            const frontPos = new Vec3(buildingPos.x, buildingPos.y - 50, buildingPos.z);
            this.moveToPosition(frontPos);
        }

        console.log('Wisp: Detached from building');
    }

    /**
     * 移动到指定位置
     */
    moveToPosition(targetPos: Vec3) {
        this.moveTarget = targetPos.clone();
        this.isMoving = true;
        this.isManuallyControlled = false;
        this.manualMoveTarget = null!;
    }

    /**
     * 设置手动移动目标位置（用于选中移动）
     * @param worldPos 世界坐标位置
     */
    setManualMoveTargetPosition(worldPos: Vec3) {
        // 如果已依附，先卸下
        if (this.isAttached) {
            this.detachFromBuilding();
        }
        
        // 设置手动移动目标
        this.manualMoveTarget = worldPos.clone();
        this.isManuallyControlled = true;
        this.isMoving = false;
        this.moveTarget = null!;
        
        console.debug(`Wisp: Manual move target set to (${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})`);
    }

    /**
     * 检查是否与建筑物重叠，如果重叠则自动依附
     */
    checkBuildingOverlap() {
        // 如果已经依附，不需要检查
        if (this.isAttached) {
            return;
        }

        // 如果正在移动，不检查重叠（避免移动时被依附）
        if (this.isMoving || this.isManuallyControlled) {
            return;
        }

        const wispPos = this.node.worldPosition;
        const attachRange = 50; // 依附范围（像素）

        // 查找战争古树
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
                if (tree && tree.isValid && tree.active) {
                    const treeScript = tree.getComponent('WarAncientTree') as any;
                    if (treeScript && treeScript.isAlive && treeScript.isAlive()) {
                        const distance = Vec3.distance(wispPos, tree.worldPosition);
                        if (distance <= attachRange) {
                            // 与战争古树重叠，自动依附
                            this.attachToBuilding(tree);
                            return;
                        }
                    }
                }
            }
        }

        // 查找月亮井
        let wellsNode = find('MoonWells');
        if (!wellsNode && this.node.scene) {
            wellsNode = findNodeRecursive(this.node.scene, 'MoonWells');
        }
        if (wellsNode) {
            const wells = wellsNode.children || [];
            for (const well of wells) {
                if (well && well.isValid && well.active) {
                    const wellScript = well.getComponent('MoonWell') as any;
                    if (wellScript && wellScript.isAlive && wellScript.isAlive()) {
                        const distance = Vec3.distance(wispPos, well.worldPosition);
                        if (distance <= attachRange) {
                            // 与月亮井重叠，自动依附
                            this.attachToBuilding(well);
                            return;
                        }
                    }
                }
            }
        }
    }

    /**
     * 治疗建筑物
     */
    healBuilding() {
        if (!this.attachedBuilding || !this.attachedBuilding.isValid) {
            return;
        }

        // 根据建筑物类型调用相应的治疗/恢复方法
        const buildingScript = this.attachedBuilding.getComponent('WarAncientTree') as any;
        if (buildingScript && buildingScript.isAlive && buildingScript.isAlive()) {
            if (buildingScript.heal) {
                buildingScript.heal(this.healAmount);
            } else if (buildingScript.getHealth && buildingScript.getMaxHealth) {
                const currentHealth = buildingScript.getHealth();
                const maxHealth = buildingScript.getMaxHealth();
                if (currentHealth < maxHealth) {
                    // 直接设置血量
                    if (buildingScript.currentHealth !== undefined) {
                        buildingScript.currentHealth = Math.min(maxHealth, currentHealth + this.healAmount);
                        if (buildingScript.healthBar) {
                            buildingScript.healthBar.setHealth(buildingScript.currentHealth);
                        }
                    }
                }
            }
            this.showHealEffect();
            return;
        }

        const moonWellScript = this.attachedBuilding.getComponent('MoonWell') as any;
        if (moonWellScript && moonWellScript.isAlive && moonWellScript.isAlive()) {
            if (moonWellScript.heal) {
                moonWellScript.heal(this.healAmount);
            } else if (moonWellScript.getHealth && moonWellScript.getMaxHealth) {
                const currentHealth = moonWellScript.getHealth();
                const maxHealth = moonWellScript.getMaxHealth();
                if (currentHealth < maxHealth) {
                    if (moonWellScript.currentHealth !== undefined) {
                        moonWellScript.currentHealth = Math.min(maxHealth, currentHealth + this.healAmount);
                        if (moonWellScript.healthBar) {
                            moonWellScript.healthBar.setHealth(moonWellScript.currentHealth);
                        }
                    }
                }
            }
            this.showHealEffect();
            return;
        }
    }

    /**
     * 显示治疗特效
     */
    showHealEffect() {
        if (this.healEffectPrefab) {
            const effect = instantiate(this.healEffectPrefab);
            const canvas = find('Canvas');
            if (canvas) {
                effect.setParent(canvas);
            } else if (this.node.scene) {
                effect.setParent(this.node.scene);
            }
            effect.setWorldPosition(this.attachedBuilding.worldPosition.clone().add3f(0, 20, 0));
            effect.active = true;

            // 延迟销毁
            this.scheduleOnce(() => {
                if (effect && effect.isValid) {
                    effect.destroy();
                }
            }, 1.0);
        }
    }

    /**
     * 受到伤害
     */
    takeDamage(damage: number) {
        if (this.isDestroyed) {
            return;
        }

        this.currentHealth -= damage;

        // 更新单位信息面板
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                currentHealth: Math.max(0, this.currentHealth),
                maxHealth: this.maxHealth
            });
        }

        // 显示伤害数字
        if (this.damageNumberPrefab) {
            const damageNode = instantiate(this.damageNumberPrefab);
            const canvas = find('Canvas');
            if (canvas) {
                damageNode.setParent(canvas);
            } else if (this.node.scene) {
                damageNode.setParent(this.node.scene);
            }
            damageNode.setWorldPosition(this.node.worldPosition.clone().add3f(0, 30, 0));
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

    /**
     * 死亡
     */
    die() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;

        // 如果依附在建筑物上，先卸下
        if (this.isAttached && this.attachedBuilding) {
            this.detachFromBuilding();
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
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }, 0.5);
    }

    /**
     * 是否存活
     */
    isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }

    /**
     * 获取血量
     */
    getHealth(): number {
        return this.currentHealth;
    }

    /**
     * 获取最大血量
     */
    getMaxHealth(): number {
        return this.maxHealth;
    }

    /**
     * 是否已依附
     */
    getIsAttached(): boolean {
        return this.isAttached;
    }

    /**
     * 获取依附的建筑物
     */
    getAttachedBuilding(): Node | null {
        return this.attachedBuilding;
    }

    /**
     * 设置高亮显示
     */
    setHighlight(highlight: boolean) {
        this.isHighlighted = highlight;
        
        if (!this.highlightNode && highlight) {
            // 创建高亮效果节点
            this.highlightNode = new Node('Highlight');
            this.highlightNode.setParent(this.node);
            this.highlightNode.setPosition(0, 0, 0);
            
            const graphics = this.highlightNode.addComponent(Graphics);
            graphics.strokeColor = new Color(255, 255, 0, 255); // 黄色边框
            graphics.lineWidth = 3;
            graphics.circle(0, 0, this.collisionRadius);
            graphics.stroke();
        }
        
        if (this.highlightNode) {
            this.highlightNode.active = highlight;
        }
        
        // 如果取消高亮，同时清除UnitSelectionManager中的选中状态
        if (!highlight && this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.clearSelection();
        }
    }

    /**
     * 点击事件
     */
    onWispClick(event: EventTouch) {
        // 阻止事件冒泡
        event.propagationStopped = true;

        // 显示单位信息面板
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (this.unitSelectionManager) {
            // 检查是否已经选中了小精灵
            if (this.unitSelectionManager.isUnitSelected(this.node)) {
                // 如果已经选中，清除选择
                this.unitSelectionManager.clearSelection();
                // 同时清除SelectionManager中的选中状态
                this.clearSelectionInSelectionManager();
                return;
            }

            const unitInfo: UnitInfo = {
                name: '小精灵',
                level: 1,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth,
                attackDamage: 0, // 小精灵没有攻击能力
                populationCost: 1, // 占用1个人口
                icon: this.defaultSpriteFrame,
                collisionRadius: this.collisionRadius
            };
            this.unitSelectionManager.selectUnit(this.node, unitInfo);
            
            // 将小精灵添加到SelectionManager的选中列表中，以便后续可以移动
            this.addToSelectionManager();
        }
    }
    
    /**
     * 将小精灵添加到SelectionManager的选中列表中
     */
    private addToSelectionManager() {
        // 查找SelectionManager
        const selectionManager = this.findSelectionManager();
        if (selectionManager) {
            // 清除之前的选择
            selectionManager.clearSelection();
            // 将当前小精灵添加到选中列表
            selectionManager.setSelectedWisps([this]);
            // 注册移动命令
            selectionManager.registerMoveCommand();
        }
    }
    
    /**
     * 清除SelectionManager中的选中状态
     */
    private clearSelectionInSelectionManager() {
        const selectionManager = this.findSelectionManager();
        if (selectionManager) {
            selectionManager.clearSelection();
        }
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
}

