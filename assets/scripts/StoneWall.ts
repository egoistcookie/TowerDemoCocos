import { _decorator, Component, Node, Vec3, Prefab, instantiate, find, UITransform, Label, Color, SpriteFrame, Sprite, Graphics, EventTouch, Camera } from 'cc';
import { GameManager } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
import { UnitSelectionManager } from './UnitSelectionManager';
import { UnitInfo } from './UnitInfoPanel';
import { BuildingGridPanel } from './BuildingGridPanel';
import { StoneWallGridPanel } from './StoneWallGridPanel';
const { ccclass, property } = _decorator;

@ccclass('StoneWall')
export class StoneWall extends Component {
    @property
    maxHealth: number = 50; // 石墙血量
    
    @property
    buildCost: number = 5; // 建造成本
    
    @property
    goldReward: number = 1; // 回收获得的金币
    
    @property(SpriteFrame)
    cardIcon: SpriteFrame = null!; // 单位名片图片
    
    @property
    collisionRadius: number = 40; // 碰撞半径（像素）
    
    @property(Prefab)
    explosionEffect: Prefab = null!; // 爆炸特效预制体
    
    @property(Prefab)
    damageNumberPrefab: Prefab = null!; // 伤害数字预制体
    
    // 单位信息属性
    @property
    unitType: string = "STONEWALL"; // 单位类型
    
    @property
    unitName: string = "石墙"; // 单位名称
    
    @property
    unitDescription: string = "坚固的石墙，可以阻挡敌人的进攻路线。";
    
    @property(SpriteFrame)
    unitIcon: SpriteFrame = null!;
    
    private currentHealth: number = 50;
    private healthBar: HealthBar = null!;
    private healthBarNode: Node = null!;
    private isDestroyed: boolean = false;
    private gameManager: GameManager = null!;
    private sprite: Sprite = null!; // Sprite组件引用
    private defaultSpriteFrame: SpriteFrame = null!; // 默认SpriteFrame
    private defaultScale: Vec3 = new Vec3(1, 1, 1); // 默认缩放
    private isHighlighted: boolean = false; // 是否高亮显示
    private highlightNode: Node = null!; // 高亮效果节点
    private unitSelectionManager: UnitSelectionManager = null!; // 单位选择管理器

    // 网格位置相关
    public gridX: number = -1; // 网格X坐标
    public gridY: number = -1; // 网格Y坐标
    private isMoving: boolean = false; // 是否正在移动
    private moveStartPos: Vec3 = new Vec3(); // 移动起始位置
    private gridPanel: BuildingGridPanel | StoneWallGridPanel = null!; // 网格面板组件（支持普通网格和石墙网格）
    
    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        
        // 获取Sprite组件
        this.sprite = this.node.getComponent(Sprite);
        if (this.sprite) {
            this.defaultSpriteFrame = this.sprite.spriteFrame;
        }
        
        // 保存默认缩放
        this.defaultScale = this.node.scale.clone();
        
        // 查找游戏管理器
        this.findGameManager();
        
        // 查找单位选择管理器
        this.findUnitSelectionManager();
        
        // 创建血条
        this.createHealthBar();
        
        // 监听点击事件
        this.node.on(Node.EventType.TOUCH_END, this.onStoneWallClick, this);
    }
    
    onDestroy() {
        // 移除点击事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onStoneWallClick, this);
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
     * 构造石墙的单位信息（包含回收回调，供九宫格面板使用）
     */
    private buildUnitInfo(): UnitInfo {
        return {
            name: '石墙',
            level: 1,
            currentHealth: this.currentHealth,
            maxHealth: this.maxHealth,
            attackDamage: 0,
            populationCost: 0,
            icon: this.cardIcon || this.defaultSpriteFrame,
            collisionRadius: this.collisionRadius,
            onSellClick: () => {
                this.onSellClick();
            }
        };
    }
    
    /**
     * 查找网格面板
     */
    findGridPanel() {
        // 查找石墙网格面板
        const stoneWallGridPanelNode = find('StoneWallGridPanel');
        if (stoneWallGridPanelNode) {
            this.gridPanel = stoneWallGridPanelNode.getComponent(StoneWallGridPanel);
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
        this.healthBarNode.setPosition(0, 50, 0); // 调整血条位置，确保在石墙上方显示
        
        this.healthBar = this.healthBarNode.addComponent(HealthBar);
        if (this.healthBar) {
            this.healthBar.setMaxHealth(this.maxHealth);
            this.healthBar.setHealth(this.currentHealth);
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
        
        // 显示伤害数字
        if (this.damageNumberPrefab) {
            const damageNode = instantiate(this.damageNumberPrefab);
            const canvas = find('Canvas');
            if (canvas) {
                damageNode.setParent(canvas);
            } else if (this.node.scene) {
                damageNode.setParent(this.node.scene);
            }
            
            // 设置伤害数字位置（在石墙上方）
            const wallPos = this.node.worldPosition.clone();
            damageNode.setWorldPosition(wallPos.add3f(0, 50, 0));
            
            // 获取DamageNumber组件并设置伤害数值
            const damageScript = damageNode.getComponent(DamageNumber);
            if (damageScript) {
                damageScript.setDamage(damage);
            }
        }
        
        // 更新血条
        if (this.healthBar) {
            this.healthBar.setHealth(this.currentHealth);
        }
        
        // 更新单位信息面板
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                currentHealth: Math.max(0, this.currentHealth),
                maxHealth: this.maxHealth
            });
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
        
        // 给玩家奖励金币
        if (this.gameManager) {
            this.gameManager.addGold(this.goldReward);
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
    }
    
    // 选择面板相关属性
    private selectionPanel: Node = null!; // 选择面板节点
    private globalTouchHandler: ((event: EventTouch) => void) | null = null; // 全局触摸事件处理器

    /**
     * 点击事件
     */
    onStoneWallClick(event: EventTouch) {
        console.debug('[StoneWall] onStoneWallClick - 节点点击事件触发, propagationStopped:', event.propagationStopped);
        
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
        
        console.debug('[StoneWall] onStoneWallClick - 查找TowerBuilder, 节点找到:', !!towerBuilderNode, '组件找到:', !!towerBuilder, 'isDraggingBuilding:', towerBuilder?.isDraggingBuilding);
        
        // 检查是否正在长按检测（由TowerBuilder处理）
        // 注意：不要阻止事件传播，让TowerBuilder的onTouchEnd也能处理
        if (towerBuilder && (towerBuilder as any).isLongPressActive) {
            console.debug('[StoneWall] onStoneWallClick - 检测到正在长按检测，不处理点击事件，让TowerBuilder处理');
            // 不阻止事件传播，让TowerBuilder的onTouchEnd也能处理
            // event.propagationStopped = true; // 注释掉，让事件继续传播
            return;
        }
        
        // 检查是否正在显示信息面板（由TowerBuilder打开）
        if ((this.node as any)._showingInfoPanel) {
            console.debug('StoneWall.onStoneWallClick: 正在显示信息面板，不处理点击事件');
            return;
        }
        
        if (towerBuilder && towerBuilder.isDraggingBuilding) {
            console.debug('[StoneWall] onStoneWallClick - 检测到正在拖拽建筑物，直接调用TowerBuilder.endDraggingBuilding处理');
            // 直接调用TowerBuilder的方法来处理拖拽结束，而不是依赖事件传播
            if (towerBuilder.endDraggingBuilding && typeof towerBuilder.endDraggingBuilding === 'function') {
                towerBuilder.endDraggingBuilding(event);
            }
            return;
        }
        
        // 检查是否有选中的小精灵，如果有则不处理点击事件（让小精灵移动到石墙）
        const selectionManager = this.findSelectionManager();
        
        let hasSelectedWisps = false;
        if (selectionManager && selectionManager.hasSelectedWisps && typeof selectionManager.hasSelectedWisps === 'function') {
            hasSelectedWisps = selectionManager.hasSelectedWisps();
        }
        
        if (hasSelectedWisps) {
            // 有选中的小精灵，不处理石墙的点击事件，让SelectionManager处理移动
            return;
        }

        // 阻止事件传播
        event.propagationStopped = true;

        // 点击时显示九宫格信息面板（包含回收按钮）
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (this.unitSelectionManager) {
            this.unitSelectionManager.selectUnit(this.node, this.buildUnitInfo());
        }

        // 如果正在移动，不重复处理
        if (this.isMoving) {
            return;
        }

        // 如果已经显示自带选择面板，先隐藏
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
            if (!this.unitSelectionManager) {
                this.findUnitSelectionManager();
            }
            if (this.unitSelectionManager) {
                this.unitSelectionManager.selectUnit(this.node, this.buildUnitInfo());
            }
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
        console.debug('[StoneWall] onMoveTouchEnd - 触摸结束事件, isMoving:', this.isMoving, 'gridPanel存在:', !!this.gridPanel, 'propagationStopped:', event.propagationStopped);
        if (!this.isMoving || !this.gridPanel) {
            console.debug('[StoneWall] onMoveTouchEnd - 不在移动状态或gridPanel不存在，直接返回');
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
                if (!this.unitSelectionManager) {
                    this.findUnitSelectionManager();
                }
                if (this.unitSelectionManager) {
                    this.unitSelectionManager.selectUnit(this.node, this.buildUnitInfo());
                }
            }
        } else {
            // 不在网格内，显示选择面板
            if (!this.unitSelectionManager) {
                this.findUnitSelectionManager();
            }
            if (this.unitSelectionManager) {
                this.unitSelectionManager.selectUnit(this.node, this.buildUnitInfo());
            }
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

        console.debug(`StoneWall: Moved to grid (${gridX}, ${gridY})`);
    }

    /**
     * 查找SelectionManager
     */
    private findSelectionManager(): any {
        let managerNode = find('SelectionManager');
        if (managerNode) {
            return managerNode.getComponent('SelectionManager');
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

        this.selectionPanel = new Node('StoneWallSelectionPanel');
        this.selectionPanel.setParent(canvas);

        // 添加UITransform
        const uiTransform = this.selectionPanel.addComponent(UITransform);
        uiTransform.setContentSize(120, 40);

        // 设置位置（在石墙上方）
        const worldPos = this.node.worldPosition.clone();
        worldPos.y += 50;
        this.selectionPanel.setWorldPosition(worldPos);

        // 添加半透明背景
        const graphics = this.selectionPanel.addComponent(Graphics);
        graphics.fillColor = new Color(0, 0, 0, 180); // 半透明黑色
        graphics.rect(-60, -20, 120, 40);
        graphics.fill();

        // 创建回收按钮
        const sellBtn = new Node('SellButton');
        sellBtn.setParent(this.selectionPanel);
        const sellBtnTransform = sellBtn.addComponent(UITransform);
        sellBtnTransform.setContentSize(50, 30);
        sellBtn.setPosition(-35, 0);

        const sellLabel = sellBtn.addComponent(Label);
        sellLabel.string = '回收';
        sellLabel.fontSize = 16;
        sellLabel.color = Color.WHITE;

        // 添加按钮点击事件
        sellBtn.on(Node.EventType.TOUCH_END, this.onSellClick, this);

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
     * 回收按钮点击事件
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
        
        // 销毁石墙
        this.destroyStoneWall();
    }

    /**
     * 销毁石墙（用于回收）
     */
    destroyStoneWall() {
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
}

