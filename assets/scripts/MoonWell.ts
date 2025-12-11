import { _decorator, Component, Node, Vec3, find, Prefab, instantiate, Graphics, UITransform, Label, Color, EventTouch, Sprite, SpriteFrame, Camera } from 'cc';
import { GameManager, GameState } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
import { UnitSelectionManager } from './UnitSelectionManager';
import { UnitInfo } from './UnitInfoPanel';
import { SelectionManager } from './SelectionManager';
import { UnitType } from './WarAncientTree';
import { BuildingGridPanel } from './BuildingGridPanel';
const { ccclass, property } = _decorator;

@ccclass('MoonWell')
export class MoonWell extends Component {
    @property
    maxHealth: number = 80; // 月亮井的血量

    @property(Prefab)
    explosionEffect: Prefab = null!;

    @property(Prefab)
    damageNumberPrefab: Prefab = null!;

    @property
    buildCost: number = 10; // 建造成本

    @property
    populationIncrease: number = 10; // 增加的人口上限

    @property
    healRange: number = 100; // 治疗范围（像素）

    @property
    healAmount: number = 1; // 每次治疗恢复的血量

    @property
    healInterval: number = 2.0; // 治疗间隔（秒）

    @property
    level: number = 1; // 月亮井等级

    @property
    collisionRadius: number = 40; // 占地范围（像素）

    @property(SpriteFrame)
    cardIcon: SpriteFrame = null!; // 单位名片图片

    // 单位类型
    public unitType: UnitType = UnitType.BUILDING;
    
    // 单位信息属性
    @property
    unitName: string = "月亮井";
    
    @property
    unitDescription: string = "能够恢复周围单位生命值，并提供人口上限的建筑物。";
    
    @property(SpriteFrame)
    unitIcon: SpriteFrame = null!;

    private currentHealth: number = 80;
    private healthBar: HealthBar = null!;
    private healthBarNode: Node = null!;
    private isDestroyed: boolean = false;
    private gameManager: GameManager = null!;
    private hasIncreasedPopulation: boolean = false; // 标记是否已经增加过人口上限
    private healTimer: number = 0; // 治疗计时器
    private selectionPanel: Node = null!; // 选择面板
    private globalTouchHandler: ((event: EventTouch) => void) | null = null!; // 全局触摸事件处理器
    private rangeDisplayNode: Node = null!; // 范围显示节点
    private unitSelectionManager: UnitSelectionManager = null!; // 单位选择管理器
    private sprite: Sprite = null!; // Sprite组件引用
    private defaultSpriteFrame: SpriteFrame = null!; // 默认SpriteFrame
    
    // 小精灵相关
    private attachedWisps: Node[] = []; // 依附的小精灵列表

    // 网格位置相关
    public gridX: number = -1; // 网格X坐标
    public gridY: number = -1; // 网格Y坐标
    private isMoving: boolean = false; // 是否正在移动
    private moveStartPos: Vec3 = new Vec3(); // 移动起始位置
    private gridPanel: BuildingGridPanel = null!; // 网格面板组件

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.hasIncreasedPopulation = false;
        this.healTimer = 0;
        this.attachedWisps = [];

        // 查找游戏管理器
        this.findGameManager();

        // 查找单位选择管理器
        this.findUnitSelectionManager();

        // 获取Sprite组件
        this.sprite = this.node.getComponent(Sprite);
        if (this.sprite && this.sprite.spriteFrame) {
            this.defaultSpriteFrame = this.sprite.spriteFrame;
        }

        // 创建血条
        this.createHealthBar();

        // 监听点击事件
        this.node.on(Node.EventType.TOUCH_END, this.onMoonWellClick, this);

        // 注意：不在start()中自动增加人口上限
        // 只有在通过TowerBuilder.buildMoonWell()建造时才会调用increasePopulationLimit()来增加人口上限
        // 这样可以避免场景中预先放置的月亮井导致人口上限异常增加
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

        // 治疗逻辑
        this.healTimer += deltaTime;
        if (this.healTimer >= this.healInterval) {
            this.healTimer = 0;
            this.healNearbyUnits();
        }
    }

    /**
     * 手动调用此方法来增加人口上限（由TowerBuilder调用）
     */
    increasePopulationLimit() {
        if (this.hasIncreasedPopulation) {
            console.warn('MoonWell: Population limit already increased for this well.');
            return;
        }

        // 使用延迟确保 GameManager 已经初始化完成
        this.scheduleOnce(() => {
            if (!this.gameManager) {
                // 如果第一次没找到，再尝试一次
                this.findGameManager();
            }
            
            if (this.gameManager) {
                const currentMax = this.gameManager.getMaxPopulation();
                const newMax = currentMax + this.populationIncrease;
                this.gameManager.setMaxPopulation(newMax);
                this.hasIncreasedPopulation = true;
                console.debug(`MoonWell: Increased max population by ${this.populationIncrease}, from ${currentMax} to ${newMax}`);
            } else {
                console.error('MoonWell: GameManager not found! Cannot increase population limit.');
            }
        }, 0.1);
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
        
        console.warn('MoonWell: GameManager not found!');
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

        // 隐藏面板和范围显示
        this.hideSelectionPanel();
        this.hideRangeDisplay();

        // 移除点击事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onMoonWellClick, this);

        // 被摧毁时减少人口上限（只有增加过人口上限的月亮井才减少）
        if (this.hasIncreasedPopulation && this.gameManager) {
            const currentMax = this.gameManager.getMaxPopulation();
            const newMax = Math.max(10, currentMax - this.populationIncrease); // 至少保持初始的10人口上限
            this.gameManager.setMaxPopulation(newMax);
            console.debug(`MoonWell: Decreased max population by ${this.populationIncrease}, new max: ${newMax}`);
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

    isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }

    getHealth(): number {
        return this.currentHealth;
    }

    getMaxHealth(): number {
        return this.maxHealth;
    }

    /**
     * 治疗附近的友方单位
     */
    healNearbyUnits() {
        if (this.isDestroyed) {
            return;
        }

        // 递归查找节点（更可靠）
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

        const moonWellPos = this.node.worldPosition;
        let healedCount = 0;

        // 1. 治疗附近的弓箭手
        let towersNode = find('Towers');
        
        // 如果直接查找失败，尝试递归查找
        if (!towersNode && this.node.scene) {
            towersNode = findNodeRecursive(this.node.scene, 'Towers');
        }

        if (towersNode) {
            const towers = towersNode.children || [];
            for (const tower of towers) {
                if (!tower || !tower.isValid || !tower.active) {
                    continue;
                }

                const towerScript = tower.getComponent('Arrower') as any;
                if (!towerScript || !towerScript.isAlive || !towerScript.isAlive()) {
                    continue;
                }

                // 计算距离
                const distance = Vec3.distance(moonWellPos, tower.worldPosition);
                if (distance <= this.healRange) {
                    // 在治疗范围内，恢复血量
                    if (towerScript.heal) {
                        towerScript.heal(this.healAmount);
                        healedCount++;
                    }
                }
            }
        }

        // 2. 治疗附近的小精灵
        let wispsNode = find('Wisps');
        
        // 如果直接查找失败，尝试递归查找
        if (!wispsNode && this.node.scene) {
            wispsNode = findNodeRecursive(this.node.scene, 'Wisps');
        }

        if (wispsNode) {
            const wisps = wispsNode.children || [];
            for (const wisp of wisps) {
                if (!wisp || !wisp.isValid || !wisp.active) {
                    continue;
                }

                const wispScript = wisp.getComponent('Wisp') as any;
                if (!wispScript || !wispScript.isAlive || !wispScript.isAlive()) {
                    continue;
                }

                // 计算距离
                const distance = Vec3.distance(moonWellPos, wisp.worldPosition);
                if (distance <= this.healRange) {
                    // 在治疗范围内，恢复血量
                    if (wispScript.heal) {
                        wispScript.heal(this.healAmount);
                        healedCount++;
                    }
                }
            }
        }

        // 3. 治疗附近的女猎手
        let huntersNode = find('Hunters');
        
        // 如果直接查找失败，尝试递归查找
        if (!huntersNode && this.node.scene) {
            huntersNode = findNodeRecursive(this.node.scene, 'Hunters');
        }

        if (huntersNode) {
            const hunters = huntersNode.children || [];
            for (const hunter of hunters) {
                if (!hunter || !hunter.isValid || !hunter.active) {
                    continue;
                }

                const hunterScript = hunter.getComponent('Hunter') as any;
                if (!hunterScript || !hunterScript.isAlive || !hunterScript.isAlive()) {
                    continue;
                }

                // 计算距离
                const distance = Vec3.distance(moonWellPos, hunter.worldPosition);
                if (distance <= this.healRange) {
                    // 在治疗范围内，恢复血量
                    if (hunterScript.heal) {
                        hunterScript.heal(this.healAmount);
                        healedCount++;
                    }
                }
            }
        }

        // 调试信息（降低频率）
        if (healedCount > 0 && Math.random() < 0.1) { // 约10%的概率输出
            console.debug(`MoonWell: Healed ${healedCount} unit(s) within range ${this.healRange}`);
        }
    }

    /**
     * 点击月亮井事件
     */
    onMoonWellClick(event: EventTouch) {
        console.debug('[MoonWell] onMoonWellClick - 节点点击事件触发, propagationStopped:', event.propagationStopped);
        console.debug('MoonWell.onMoonWellClick: Entering method');
        
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
        
        console.debug('[MoonWell] onMoonWellClick - 查找TowerBuilder, 节点找到:', !!towerBuilderNode, '组件找到:', !!towerBuilder, 'isDraggingBuilding:', towerBuilder?.isDraggingBuilding);
        
        // 检查是否正在长按检测（由TowerBuilder处理）
        if (towerBuilder && (towerBuilder as any).isLongPressActive) {
            console.debug('[MoonWell] onMoonWellClick - 检测到正在长按检测，不处理点击事件，让TowerBuilder处理');
            // 阻止事件传播，让TowerBuilder处理
            event.propagationStopped = true;
            return;
        }
        
        // 检查是否正在显示信息面板（由TowerBuilder打开）
        if ((this.node as any)._showingInfoPanel) {
            console.debug('MoonWell.onMoonWellClick: 正在显示信息面板，不处理点击事件');
            return;
        }
        
        if (towerBuilder && towerBuilder.isDraggingBuilding) {
            console.debug('[MoonWell] onMoonWellClick - 检测到正在拖拽建筑物，直接调用TowerBuilder.endDraggingBuilding处理');
            // 直接调用TowerBuilder的方法来处理拖拽结束，而不是依赖事件传播
            if (towerBuilder.endDraggingBuilding && typeof towerBuilder.endDraggingBuilding === 'function') {
                towerBuilder.endDraggingBuilding(event);
            }
            return;
        }
        
        // 如果游戏已结束，不显示选择面板
        if (this.gameManager && this.gameManager.getGameState() !== GameState.Playing) {
            console.debug('MoonWell.onMoonWellClick: Game not in playing state, returning');
            return;
        }

        // 检查是否有选中的小精灵，如果有则不处理点击事件（让小精灵移动到建筑物）
        const selectionManager = this.findSelectionManager();
        console.debug('MoonWell.onMoonWellClick: Found selectionManager:', selectionManager ? 'yes' : 'no');
        
        let hasSelectedWisps = false;
        if (selectionManager && selectionManager.hasSelectedWisps && typeof selectionManager.hasSelectedWisps === 'function') {
            hasSelectedWisps = selectionManager.hasSelectedWisps();
            console.debug('MoonWell.onMoonWellClick: Has selected wisps:', hasSelectedWisps);
        } else {
            console.debug('MoonWell.onMoonWellClick: selectionManager.hasSelectedWisps is not a function');
        }
        
        if (hasSelectedWisps) {
            // 有选中的小精灵，不处理建筑物的点击事件，让SelectionManager处理移动
            // 不设置propagationStopped，让事件继续传播，这样SelectionManager的移动命令可以执行
            console.debug('MoonWell.onMoonWellClick: Has selected wisps, returning to let SelectionManager handle movement');
            return;
        }

        // 检查是否正在显示信息面板（由TowerBuilder打开）
        if ((this.node as any)._showingInfoPanel) {
            console.debug('MoonWell.onMoonWellClick: 正在显示信息面板，不处理点击事件');
            return;
        }

        // 阻止事件冒泡
        event.propagationStopped = true;
        console.debug('MoonWell.onMoonWellClick: Event propagation stopped');

        // 如果正在移动，不处理点击
        if (this.isMoving) {
            return;
        }

        // 如果已有选择面板，先关闭
        if (this.selectionPanel) {
            console.debug('MoonWell.onMoonWellClick: Selection panel already shown, hiding it');
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
        console.debug('[MoonWell] onMoveTouchEnd - 触摸结束事件, isMoving:', this.isMoving, 'gridPanel存在:', !!this.gridPanel, 'propagationStopped:', event.propagationStopped);
        if (!this.isMoving || !this.gridPanel) {
            console.debug('[MoonWell] onMoveTouchEnd - 不在移动状态或gridPanel不存在，直接返回');
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

        console.debug(`MoonWell: Moved to grid (${gridX}, ${gridY})`);
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

        // 范围显示将通过UnitSelectionManager统一管理

        this.selectionPanel = new Node('MoonWellSelectionPanel');
        this.selectionPanel.setParent(canvas);

        // 添加UITransform
        const uiTransform = this.selectionPanel.addComponent(UITransform);
        uiTransform.setContentSize(120, 40);

        // 设置位置（在月亮井上方）
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
                name: '月亮井',
                level: this.level,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth,
                attackDamage: 0, // 月亮井不攻击
                populationCost: 0, // 月亮井不占用人口，反而增加人口上限
                icon: this.cardIcon || this.defaultSpriteFrame,
                collisionRadius: this.collisionRadius,
                healRange: this.healRange,
                healAmount: this.healAmount,
                healSpeed: 1.0 / this.healInterval, // 治疗速度（次/秒）
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
        
        // 清除单位信息面板和范围显示（使用UnitSelectionManager统一管理）
        if (this.unitSelectionManager) {
            // 检查是否当前选中的是这个单位
            if (this.unitSelectionManager.isUnitSelected(this.node)) {
                this.unitSelectionManager.clearSelection();
            }
        }
        
        if (this.selectionPanel && this.selectionPanel.isValid) {
            this.selectionPanel.destroy();
            this.selectionPanel = null!;
        }
    }

    /**
     * 显示范围（占地范围和治愈范围）
     */
    showRangeDisplay() {
        if (this.rangeDisplayNode) {
            this.hideRangeDisplay();
        }

        const canvas = find('Canvas');
        if (!canvas) return;

        // 创建范围显示节点
        this.rangeDisplayNode = new Node('MoonWellRangeDisplay');
        this.rangeDisplayNode.setParent(canvas);
        
        // 设置位置与月亮井相同
        this.rangeDisplayNode.setWorldPosition(this.node.worldPosition);

        // 添加UITransform（用于定位）
        const uiTransform = this.rangeDisplayNode.addComponent(UITransform);
        uiTransform.setContentSize(this.healRange * 2, this.healRange * 2);

        // 绘制治愈范围（绿色半透明圆圈）
        const healRangeGraphics = new Node('HealRange');
        healRangeGraphics.setParent(this.rangeDisplayNode);
        healRangeGraphics.setPosition(0, 0, 0);
        const healGraphics = healRangeGraphics.addComponent(Graphics);
        healGraphics.fillColor = new Color(0, 255, 0, 100); // 绿色半透明
        healGraphics.circle(0, 0, this.healRange);
        healGraphics.fill();
        
        // 绘制治愈范围边框（绿色实线）
        healGraphics.strokeColor = new Color(0, 255, 0, 200); // 绿色边框
        healGraphics.lineWidth = 2;
        healGraphics.circle(0, 0, this.healRange);
        healGraphics.stroke();

        // 绘制占地范围（蓝色半透明圆圈）
        const collisionRangeGraphics = new Node('CollisionRange');
        collisionRangeGraphics.setParent(this.rangeDisplayNode);
        collisionRangeGraphics.setPosition(0, 0, 0);
        const collisionGraphics = collisionRangeGraphics.addComponent(Graphics);
        collisionGraphics.fillColor = new Color(0, 100, 255, 80); // 蓝色半透明
        collisionGraphics.circle(0, 0, this.collisionRadius);
        collisionGraphics.fill();
        
        // 绘制占地范围边框（蓝色实线）
        collisionGraphics.strokeColor = new Color(0, 100, 255, 200); // 蓝色边框
        collisionGraphics.lineWidth = 2;
        collisionGraphics.circle(0, 0, this.collisionRadius);
        collisionGraphics.stroke();
    }

    /**
     * 隐藏范围显示
     */
    hideRangeDisplay() {
        if (this.rangeDisplayNode && this.rangeDisplayNode.isValid) {
            this.rangeDisplayNode.destroy();
            this.rangeDisplayNode = null!;
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
            console.debug(`MoonWell: Sold, refunded ${refund} gold`);
        }

        // 隐藏面板
        this.hideSelectionPanel();
        
        // 销毁月亮井
        this.destroyMoonWell();
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
            console.debug(`MoonWell: Not enough gold for upgrade! Need ${upgradeCost}, have ${this.gameManager.getGold()}`);
            return;
        }

        // 消耗金币
        this.gameManager.spendGold(upgradeCost);

        // 升级：扩大治疗范围和治疗速度
        this.level += 1;
        this.healRange = Math.floor(this.healRange * 1.5); // 扩大50%治疗范围
        this.healInterval = Math.max(0.5, this.healInterval * 0.7); // 加快30%治疗速度（最小0.5秒）

        console.debug(`MoonWell: Upgraded to level ${this.level}, healRange: ${this.healRange}, healInterval: ${this.healInterval.toFixed(2)}`);

        // 更新单位信息面板和范围显示
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            // 重新选择单位以更新范围显示
            const unitInfo: UnitInfo = {
                name: '月亮井',
                level: this.level,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth,
                attackDamage: 0,
                populationCost: 0,
                icon: this.defaultSpriteFrame,
                collisionRadius: this.collisionRadius,
                healRange: this.healRange,
                healAmount: this.healAmount,
                healSpeed: 1.0 / this.healInterval,
                onUpgradeClick: () => {
                    this.onUpgradeClick();
                },
                onSellClick: () => {
                    this.onSellClick();
                }
            };
            this.unitSelectionManager.selectUnit(this.node, unitInfo);
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
            console.warn('MoonWell: Cannot attach - wisp script not found');
            return;
        }

        // 检查小精灵是否已经依附在其他建筑物上
        if (wispScript.getIsAttached && wispScript.getIsAttached()) {
            console.warn('MoonWell: Wisp already attached to another building');
            return;
        }

        // 先将小精灵添加到依附列表，再调用attachToBuilding
        this.attachedWisps.push(wisp);
        
        // 让小精灵依附，传递fromBuilding参数为true避免循环调用
        if (wispScript.attachToBuilding) {
            wispScript.attachToBuilding(this.node, true);
            console.debug(`MoonWell: Wisp attached, total: ${this.attachedWisps.length}`);
        }
    }

    /**
     * 卸下小精灵
     */
    detachWisp() {
        if (this.attachedWisps.length === 0) {
            console.debug('MoonWell: No wisp to detach');
            return;
        }

        // 卸下第一个小精灵
        const wisp = this.attachedWisps[0];
        // 先从列表中移除，再调用detachFromBuilding，避免indexOf出错
        this.attachedWisps.shift();
        
        const wispScript = wisp.getComponent('Wisp') as any;
        if (wispScript && wispScript.detachFromBuilding) {
            wispScript.detachFromBuilding();
            console.debug(`MoonWell: Wisp detached, remaining: ${this.attachedWisps.length}`);
        }
        
        // 卸下小精灵后取消选中状态，类似点击升级按钮
        this.hideSelectionPanel();
    }

    /**
     * 销毁月亮井（用于拆除）
     */
    destroyMoonWell() {
        // 隐藏面板
        this.hideSelectionPanel();

        // 移除点击事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onMoonWellClick, this);

        // 调用die方法进行销毁
        this.die();
    }
}

