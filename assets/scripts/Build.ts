import { _decorator, Component, Node, Vec3, Prefab, instantiate, find, Sprite, SpriteFrame, Color, Graphics, UITransform, Label, EventTouch, Camera } from 'cc';
import { GameManager, GameState } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
import { UnitSelectionManager } from './UnitSelectionManager';
import { UnitInfo } from './UnitInfoPanel';
import { SelectionManager } from './SelectionManager';
import { BuildingGridPanel } from './BuildingGridPanel';
import { UnitType } from './WarAncientTree';
import { BuildingPool } from './BuildingPool';
const { ccclass, property } = _decorator;

@ccclass('Build')
export class Build extends Component {
    // 基础属性（protected）
    @property
    protected maxHealth: number = 100;

    @property(Prefab)
    protected explosionEffect: Prefab = null!;

    @property(Prefab)
    protected damageNumberPrefab: Prefab = null!;

    @property
    public buildCost: number = 10; // 建造成本

    @property
    protected level: number = 1; // 建筑物等级

    @property
    protected collisionRadius: number = 50; // 占地范围（像素）

    @property(SpriteFrame)
    protected cardIcon: SpriteFrame = null!; // 单位名片图片

    // 单位类型
    public unitType: UnitType = UnitType.BUILDING;
    
    // 单位信息属性
    @property
    protected unitName: string = "建筑物";
    
    @property
    protected unitDescription: string = "基础建筑物。";
    
    @property(SpriteFrame)
    protected unitIcon: SpriteFrame = null!;

    // 通用组件引用（protected）
    protected currentHealth: number = 100;
    protected healthBar: HealthBar = null!;
    protected healthBarNode: Node = null!;
    protected isDestroyed: boolean = false;
    protected gameManager: GameManager = null!;
    protected sprite: Sprite = null!;
    protected defaultSpriteFrame: SpriteFrame = null!;
    protected defaultScale: Vec3 = new Vec3(1, 1, 1);

    // 选择面板相关
    protected selectionPanel: Node = null!; // 选择面板节点
    protected globalTouchHandler: ((event: EventTouch) => void) | null = null; // 全局触摸事件处理器
    protected unitSelectionManager: UnitSelectionManager = null!; // 单位选择管理器

    // 网格位置相关
    public gridX: number = -1; // 网格X坐标
    public gridY: number = -1; // 网格Y坐标
    protected isMoving: boolean = false; // 是否正在移动
    protected moveStartPos: Vec3 = new Vec3(); // 移动起始位置
    protected gridPanel: any = null!; // 网格面板组件（支持BuildingGridPanel和StoneWallGridPanel）
    
    // 集结点相关
    public rallyPoint: Vec3 | null = null; // 集结点位置
    protected isSettingRallyPoint: boolean = false; // 是否正在设置集结点
    protected rallyPointMarker: Node = null!; // 集结点标记节点（红色圆点）
    protected rallyPointPreview: Node = null!; // 集结点预览节点（红色圆点虚影）
    protected rallyPointHideTimer: number = 0; // 集结点隐藏定时器
    protected readonly RALLY_POINT_DISPLAY_DURATION: number = 2; // 集结点显示持续时间（秒）
    
    // 对象池相关：预制体名称（用于对象池回收）
    public prefabName: string = '';

    /**
     * 当建筑物从对象池激活时调用（用于对象池复用）
     * 从对象池获取的建筑物会调用此方法，而不是start方法
     */
    onEnable() {
        // 从对象池获取时，重新初始化状态
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.gridX = -1;
        this.gridY = -1;
        this.isMoving = false;
        
        // 重新查找游戏管理器（可能已变化）
        this.findGameManager();
        
        // 重新查找单位选择管理器
        this.findUnitSelectionManager();
        
        // 重新查找网格面板
        this.findGridPanel();
        
        // 重新创建血条（如果不存在）
        if (!this.healthBarNode || !this.healthBarNode.isValid) {
            this.createHealthBar();
        } else {
            // 如果血条已存在，更新血条状态
            if (this.healthBar) {
                this.healthBar.setMaxHealth(this.maxHealth);
                this.healthBar.setHealth(this.currentHealth);
            }
        }
    }

    protected start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;

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

        // 查找网格面板
        this.findGridPanel();

        // 创建血条
        this.createHealthBar();
    }

    protected findGameManager() {
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
    protected findUnitSelectionManager() {
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

    protected createHealthBar() {
        this.healthBarNode = new Node('HealthBar');
        this.healthBarNode.setParent(this.node);
        this.healthBarNode.setPosition(0, 50, 0);

        this.healthBar = this.healthBarNode.addComponent(HealthBar);
        if (this.healthBar) {
            this.healthBar.setMaxHealth(this.maxHealth);
            this.healthBar.setHealth(this.currentHealth);
        }
    }

    protected takeDamage(damage: number) {
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

    /**
     * 恢复血量（由小精灵调用）
     */
    protected heal(amount: number) {
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

    protected die() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;

        // 释放网格占用（确保能找到网格面板）
        if (!this.gridPanel) {
            this.findGridPanel();
        }
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
        
        // 取消集结点隐藏定时器
        this.unschedule(this.hideRallyPointMarker);
        
        // 清理集结点标记
        if (this.rallyPointMarker) {
            this.rallyPointMarker.destroy();
            this.rallyPointMarker = null!;
        }
        if (this.rallyPointPreview) {
            this.rallyPointPreview.destroy();
            this.rallyPointPreview = null!;
        }
        
        // 取消设置集结点（如果正在设置）
        if (this.isSettingRallyPoint) {
            this.cancelSetRallyPoint();
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

        // 性能优化：使用对象池回收建筑物，而不是直接销毁
        const returnToPool = () => {
            const buildingPool = BuildingPool.getInstance();
            if (buildingPool && this.node && this.node.isValid) {
                // 重置建筑物状态（在返回对象池前）
                this.resetBuildingState();
                // 返回到对象池
                buildingPool.release(this.node, this.prefabName);
            } else {
                // 如果对象池不存在，直接销毁
                if (this.node && this.node.isValid) {
                    this.node.destroy();
                }
            }
        };
        
        // 延迟返回对象池，等待爆炸特效播放
        this.scheduleOnce(() => {
            returnToPool();
        }, 0.1);
    }
    
    /**
     * 重置建筑物状态（用于对象池回收）
     */
    protected resetBuildingState() {
        // 重置基础状态
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.gridX = -1;
        this.gridY = -1;
        this.isMoving = false;
        this.rallyPoint = null;
        this.isSettingRallyPoint = false;
        
        // 重置血条（如果血条节点存在，尝试更新；否则重新创建）
        if (this.healthBarNode && this.healthBarNode.isValid) {
            // 血条节点存在，尝试获取或重新获取HealthBar组件
            if (!this.healthBar) {
                this.healthBar = this.healthBarNode.getComponent(HealthBar);
            }
            if (this.healthBar) {
                this.healthBar.setMaxHealth(this.maxHealth);
                this.healthBar.setHealth(this.currentHealth);
            } else {
                // 如果HealthBar组件丢失，重新创建
                this.createHealthBar();
            }
        } else {
            // 血条节点不存在，重新创建
            this.healthBarNode = null!;
            this.healthBar = null!;
            if (this.node && this.node.isValid) {
                this.createHealthBar();
            }
        }
        
        // 重置节点状态
        if (this.node) {
            this.node.setScale(this.defaultScale);
            this.node.angle = 0;
            if (this.sprite && this.defaultSpriteFrame) {
                this.sprite.spriteFrame = this.defaultSpriteFrame;
            }
        }
        
        // 清理集结点标记
        if (this.rallyPointMarker) {
            this.rallyPointMarker.destroy();
            this.rallyPointMarker = null!;
        }
        if (this.rallyPointPreview) {
            this.rallyPointPreview.destroy();
            this.rallyPointPreview = null!;
        }
        
        // 隐藏选择面板
        this.hideSelectionPanel();
    }

    onDestroy() {
        // 双保险：如果仍有网格占用标记，尝试释放
        if (!this.isDestroyed && this.gridX >= 0 && this.gridY >= 0) {
            if (!this.gridPanel) {
                this.findGridPanel();
            }
            if (this.gridPanel) {
                this.gridPanel.releaseGrid(this.gridX, this.gridY);
            }
        }
    }

    protected isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }

    /**
     * 获取单位信息（子类需要重写）
     */
    protected getUnitInfo(): UnitInfo | null {
        // 子类实现
        return null;
    }

    /**
     * 显示选择面板（通用实现）
     */
    public showSelectionPanel() {
        // 创建选择面板
        const canvas = find('Canvas');
        if (!canvas) return;

        this.selectionPanel = new Node('BuildingSelectionPanel');
        this.selectionPanel.setParent(canvas);

        // 添加UITransform
        const uiTransform = this.selectionPanel.addComponent(UITransform);
        uiTransform.setContentSize(120, 40);

        // 设置位置（在建筑物上方）
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
            const unitInfo = this.getUnitInfo();
            if (unitInfo) {
                // 确保回调函数正确绑定
                unitInfo.onUpgradeClick = () => {
                    this.onUpgradeClick();
                };
                unitInfo.onSellClick = () => {
                    this.onSellClick();
                };
                unitInfo.onRallyPointClick = () => {
                    this.startSetRallyPoint();
                };
                unitInfo.rallyPoint = this.rallyPoint;
                this.unitSelectionManager.selectUnit(this.node, unitInfo);
            }
        }
        
        // 显示集结点标记（点击建筑时显示，但不启动自动隐藏定时器）
        if (this.rallyPoint) {
            this.updateRallyPointMarker();
            // 取消自动隐藏定时器（因为用户主动查看）
            this.unschedule(this.hideRallyPointMarker);
            this.rallyPointHideTimer = 0;
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
    protected hideSelectionPanel() {
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
        
        // 隐藏集结点标记
        if (this.rallyPointMarker) {
            this.rallyPointMarker.active = false;
        }
    }

    /**
     * 拆除按钮点击事件
     */
    protected onSellClick(event?: EventTouch) {
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
        
        // 销毁建筑物（子类可以重写）
        this.destroyBuilding();
    }

    /**
     * 升级按钮点击事件（子类需要重写）
     */
    protected onUpgradeClick(event?: EventTouch) {
        // 子类实现
    }

    /**
     * 销毁建筑物（通用实现）
     */
    protected destroyBuilding() {
        // 隐藏面板
        this.hideSelectionPanel();

        // 移除点击事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onBuildingClick, this);

        // 调用die方法进行销毁
        this.die();
    }


    /**
     * 开始移动建筑物
     */
    protected startMoving(event: EventTouch) {
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
    protected onMoveTouchMove(event: EventTouch) {
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
    protected onMoveTouchEnd(event: EventTouch) {
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
    public moveToGridPosition(gridX: number, gridY: number) {
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
     * 查找网格面板
     */
    /**
     * 开始设置集结点
     */
    public startSetRallyPoint() {
        this.isSettingRallyPoint = true;
        
        // 创建预览标记
        this.createRallyPointPreview();
        
        // 监听全局点击和移动事件
        const canvas = find('Canvas');
        if (canvas) {
            // 移除之前的监听器（如果有）
            canvas.off(Node.EventType.TOUCH_END, this.onRallyPointTouchEnd, this);
            canvas.off(Node.EventType.TOUCH_MOVE, this.onRallyPointTouchMove, this);
            // 添加新的监听器
            canvas.on(Node.EventType.TOUCH_END, this.onRallyPointTouchEnd, this);
            canvas.on(Node.EventType.TOUCH_MOVE, this.onRallyPointTouchMove, this);
        }
    }
    
    /**
     * 集结点设置触摸移动事件（显示预览）
     */
    protected onRallyPointTouchMove(event: EventTouch) {
        if (!this.isSettingRallyPoint || !this.rallyPointPreview) {
            return;
        }
        
        // 获取触摸位置并转换为世界坐标
        const touchLocation = event.getLocation();
        const cameraNode = find('Canvas/Camera');
        if (!cameraNode) {
            return;
        }
        
        const camera = cameraNode.getComponent(Camera);
        if (!camera) {
            return;
        }
        
        const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
        const worldPos = new Vec3();
        camera.screenToWorld(screenPos, worldPos);
        worldPos.z = 0;
        
        // 更新预览位置
        this.rallyPointPreview.setWorldPosition(worldPos);
        this.rallyPointPreview.active = true;
    }
    
    /**
     * 集结点设置触摸结束事件
     */
    protected onRallyPointTouchEnd(event: EventTouch) {
        if (!this.isSettingRallyPoint) {
            return;
        }
        
        // 检查是否点击在UI元素上
        const targetNode = event.target as Node;
        if (targetNode) {
            const nodeName = targetNode.name.toLowerCase();
            if (nodeName.includes('button') || 
                nodeName.includes('panel') || 
                nodeName.includes('label') ||
                nodeName.includes('selection') ||
                nodeName.includes('buildingitem')) {
                // 点击在UI上，取消设置
                this.cancelSetRallyPoint();
                return;
            }
        }
        
        // 获取触摸位置并转换为世界坐标
        const touchLocation = event.getLocation();
        const cameraNode = find('Canvas/Camera');
        if (!cameraNode) {
            this.cancelSetRallyPoint();
            return;
        }
        
        const camera = cameraNode.getComponent(Camera);
        if (!camera) {
            this.cancelSetRallyPoint();
            return;
        }
        
        const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
        const worldPos = new Vec3();
        camera.screenToWorld(screenPos, worldPos);
        worldPos.z = 0;
        
        // 设置集结点
        this.rallyPoint = worldPos.clone();
        this.isSettingRallyPoint = false;
        
        // 移除事件监听
        const canvas = find('Canvas');
        if (canvas) {
            canvas.off(Node.EventType.TOUCH_END, this.onRallyPointTouchEnd, this);
            canvas.off(Node.EventType.TOUCH_MOVE, this.onRallyPointTouchMove, this);
        }
        
        // 隐藏预览，显示实际标记
        if (this.rallyPointPreview) {
            this.rallyPointPreview.active = false;
        }
        this.updateRallyPointMarker();
        
        // 取消之前的定时器（如果存在）
        this.unschedule(this.hideRallyPointMarker);
        
        // 启动2秒定时器，2秒后自动隐藏集结点标记
        this.scheduleOnce(this.hideRallyPointMarker, this.RALLY_POINT_DISPLAY_DURATION);
        
        // 更新单位信息面板（如果有显示）
        if (this.unitSelectionManager) {
            const unitInfo = this.getUnitInfo();
            if (unitInfo) {
                unitInfo.rallyPoint = this.rallyPoint;
                this.unitSelectionManager.updateUnitInfo(unitInfo);
            }
        }
    }
    
    /**
     * 取消设置集结点
     */
    protected cancelSetRallyPoint() {
        this.isSettingRallyPoint = false;
        const canvas = find('Canvas');
        if (canvas) {
            canvas.off(Node.EventType.TOUCH_END, this.onRallyPointTouchEnd, this);
            canvas.off(Node.EventType.TOUCH_MOVE, this.onRallyPointTouchMove, this);
        }
        
        // 隐藏预览
        if (this.rallyPointPreview) {
            this.rallyPointPreview.active = false;
        }
    }
    
    /**
     * 创建集结点标记
     */
    protected createRallyPointMarker() {
        if (this.rallyPointMarker) {
            return;
        }
        
        const canvas = find('Canvas');
        if (!canvas) {
            return;
        }
        
        // 创建标记节点
        this.rallyPointMarker = new Node('RallyPointMarker');
        this.rallyPointMarker.setParent(canvas);
        
        // 添加UITransform
        const uiTransform = this.rallyPointMarker.addComponent(UITransform);
        uiTransform.setContentSize(20, 20);
        
        // 添加Graphics组件绘制红色圆点
        const graphics = this.rallyPointMarker.addComponent(Graphics);
        graphics.fillColor = new Color(255, 0, 0, 255); // 红色
        graphics.circle(0, 0, 10); // 半径10的圆
        graphics.fill();
        graphics.strokeColor = new Color(255, 0, 0, 255);
        graphics.lineWidth = 2;
        graphics.circle(0, 0, 10);
        graphics.stroke();
        
        // 初始隐藏
        this.rallyPointMarker.active = false;
    }
    
    /**
     * 创建集结点预览标记
     */
    protected createRallyPointPreview() {
        if (this.rallyPointPreview) {
            this.rallyPointPreview.active = true;
            return;
        }
        
        const canvas = find('Canvas');
        if (!canvas) {
            return;
        }
        
        // 创建预览节点
        this.rallyPointPreview = new Node('RallyPointPreview');
        this.rallyPointPreview.setParent(canvas);
        
        // 添加UITransform
        const uiTransform = this.rallyPointPreview.addComponent(UITransform);
        uiTransform.setContentSize(20, 20);
        
        // 添加Graphics组件绘制红色圆点虚影（半透明）
        const graphics = this.rallyPointPreview.addComponent(Graphics);
        graphics.fillColor = new Color(255, 0, 0, 150); // 红色半透明
        graphics.circle(0, 0, 10); // 半径10的圆
        graphics.fill();
        graphics.strokeColor = new Color(255, 0, 0, 150);
        graphics.lineWidth = 2;
        graphics.circle(0, 0, 10);
        graphics.stroke();
        
        // 初始隐藏
        this.rallyPointPreview.active = false;
    }
    
    /**
     * 更新集结点标记显示
     */
    protected updateRallyPointMarker() {
        // 创建标记（如果不存在）
        this.createRallyPointMarker();
        
        if (!this.rallyPointMarker) {
            return;
        }
        
        if (this.rallyPoint) {
            // 有集结点，显示标记
            this.rallyPointMarker.setWorldPosition(this.rallyPoint);
            this.rallyPointMarker.active = true;
        } else {
            // 没有集结点，隐藏标记
            this.rallyPointMarker.active = false;
        }
    }
    
    /**
     * 隐藏集结点标记（定时器回调）
     */
    protected hideRallyPointMarker() {
        if (this.rallyPointMarker && this.rallyPointMarker.isValid) {
            this.rallyPointMarker.active = false;
        }
        this.rallyPointHideTimer = 0;
    }
    
    protected findGridPanel() {
        const gridPanelNode = find('BuildingGridPanel');
        if (gridPanelNode) {
            this.gridPanel = gridPanelNode.getComponent(BuildingGridPanel);
        }
    }

    /**
     * 查找SelectionManager
     */
    protected findSelectionManager(): any {
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
     * 建筑物点击事件处理（通用实现）
     */
    protected onBuildingClick(event: EventTouch) {
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
        if (towerBuilder && (towerBuilder as any).isLongPressActive) {
            return;
        }
        
        // 检查是否正在显示信息面板（由TowerBuilder打开）
        if ((this.node as any)._showingInfoPanel) {
            return;
        }
        
        if (towerBuilder && towerBuilder.isDraggingBuilding) {
            // 直接调用TowerBuilder的方法来处理拖拽结束
            if (towerBuilder.endDraggingBuilding && typeof towerBuilder.endDraggingBuilding === 'function') {
                towerBuilder.endDraggingBuilding(event);
            }
            return;
        }
        
        // 检查是否正在显示信息面板（由TowerBuilder打开）
        if ((this.node as any)._showingInfoPanel) {
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
}
