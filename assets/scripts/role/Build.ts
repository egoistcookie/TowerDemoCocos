import { _decorator, Component, Node, Vec3, Prefab, instantiate, find, Sprite, SpriteFrame, Color, Graphics, UITransform, Label, EventTouch, Camera } from 'cc';
import { GameManager } from '../GameManager';
import { GameState } from '../GameState';
import { HealthBar } from '../HealthBar';
import { DamageNumber } from '../DamageNumber';
import { UnitSelectionManager } from '../UnitSelectionManager';
import { UnitInfo } from '../UnitInfoPanel';
import { SelectionManager } from '../SelectionManager';
import { BuildingGridPanel } from '../BuildingGridPanel';
import { UnitType } from '../UnitType';
import { BuildingPool } from '../BuildingPool';
import { DamageStatistics } from '../DamageStatistics';
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
    // 建筑在完全体时的基准底部Y坐标（用于在建造/风化/损坏过程中保持“贴地”）
    // 使用 NaN 作为“尚未初始化”的标记，避免合法的 0 高度被误判为未设置
    protected baseY: number = Number.NaN;

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
    
    @property(SpriteFrame)
    protected rallyPointMarkerSprite: SpriteFrame = null!; // 集结点标记贴图（如果设置了贴图，则使用贴图；否则使用默认的红点）
    
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
        // 重置基准底部高度为“未初始化”状态
        this.baseY = Number.NaN;

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
    /**
     * 显示单位信息面板（不显示头顶的选择面板）
     */
    public showSelectionPanel() {
        // 显示单位信息面板和范围
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (this.unitSelectionManager) {
            const unitInfo = this.getUnitInfo();
            if (unitInfo) {
                // 建筑物不显示升级按钮，去掉 onUpgradeClick
                // unitInfo.onUpgradeClick = () => {
                //     this.onUpgradeClick();
                // };
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
        const canvas = find('Canvas');
        this.scheduleOnce(() => {
            if (canvas) {
                // 创建全局触摸事件处理器
                this.globalTouchHandler = (event: EventTouch) => {
                    // 点击不在信息面板上，关闭面板
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
        
        // 如果设置了集结点的贴图，使用贴图；否则使用默认的红点
        if (this.rallyPointMarkerSprite) {
            // 使用贴图
            // 添加Sprite组件显示贴图
            const sprite = this.rallyPointMarker.addComponent(Sprite);
            sprite.spriteFrame = this.rallyPointMarkerSprite;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        } else {
            // 使用默认红点（Graphics绘制）
            // 添加Graphics组件绘制红色圆点
            const graphics = this.rallyPointMarker.addComponent(Graphics);
            graphics.fillColor = new Color(255, 0, 0, 255); // 红色
            graphics.circle(0, 0, 10); // 半径10的圆
            graphics.fill();
            graphics.strokeColor = new Color(255, 0, 0, 255);
            graphics.lineWidth = 2;
            graphics.circle(0, 0, 10);
            graphics.stroke();
        }
        
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

    /**
     * 查找集结点的最佳位置（考虑附近的友方单位，避免挤在一起）
     * 子类可以重写此方法以使用自己的 hasUnitAtPosition 和 findAvailableSpawnPosition 方法
     * @param rallyPoint 集结点位置
     * @param unitSpawnPos 单位生成位置
     * @returns 最佳目标位置
     */
    protected findOptimalRallyPointPosition(rallyPoint: Vec3, unitSpawnPos: Vec3): Vec3 {
        const checkRadius = 80; // 检查半径（像素）
        const minDistance = 60; // 最小间距（像素），避免太挤
        const unitRadius = 20; // 单位碰撞半径
        
        // 查找集结点附近的友方单位（弓箭手、女猎手、剑士、牧师）
        const nearbyFriends: { node: Node; pos: Vec3; distance: number }[] = [];
        
        // 检查所有友方单位容器
        const friendlyContainers = [
            { name: 'Towers', componentNames: ['Arrower', 'Priest'] },
            { name: 'Hunters', componentNames: ['Hunter'] },
            { name: 'ElfSwordsmans', componentNames: ['ElfSwordsman'] }
        ];
        
        for (const container of friendlyContainers) {
            const containerNode = find(`Canvas/${container.name}`);
            if (!containerNode) continue;
            
            const units = containerNode.children || [];
            for (const unit of units) {
                if (!unit || !unit.isValid || !unit.active) continue;
                
                // 检查是否是友方单位
                let isFriendly = false;
                for (const compName of container.componentNames) {
                    const script = unit.getComponent(compName) as any;
                    if (script && script.isAlive && script.isAlive()) {
                        isFriendly = true;
                        break;
                    }
                }
                
                if (isFriendly) {
                    const unitPos = unit.worldPosition;
                    const distance = Vec3.distance(rallyPoint, unitPos);
                    
                    // 只考虑在检查半径内的单位
                    if (distance <= checkRadius) {
                        nearbyFriends.push({
                            node: unit,
                            pos: unitPos,
                            distance: distance
                        });
                    }
                }
            }
        }
        
        // 如果没有附近的友方单位，直接返回集结点位置
        if (nearbyFriends.length === 0) {
            return rallyPoint.clone();
        }
        
        // 找到最近的友方单位
        nearbyFriends.sort((a, b) => a.distance - b.distance);
        const nearestFriend = nearbyFriends[0];
        
        // 计算从最近友方单位到集结点的方向
        const direction = new Vec3();
        Vec3.subtract(direction, rallyPoint, nearestFriend.pos);
        const dirLength = direction.length();
        
        // 如果距离已经很远，直接使用集结点位置
        if (dirLength > checkRadius) {
            return rallyPoint.clone();
        }
        
        // 在友方单位附近找一个合适的位置，朝向集结点
        // 位置在友方单位和集结点之间，保持最小间距
        const targetDistance = Math.max(minDistance, unitRadius * 2);
        let targetPos: Vec3;
        
        if (dirLength > 0.1) {
            // 归一化方向
            direction.normalize();
            
            // 计算目标位置：在友方单位周围，朝向集结点方向
            Vec3.scaleAndAdd(targetPos = new Vec3(), nearestFriend.pos, direction, targetDistance);
        } else {
            // 如果友方单位就在集结点上，在集结点周围找一个位置
            // 使用一个固定方向（例如右侧）
            targetPos = new Vec3(rallyPoint.x + targetDistance, rallyPoint.y, rallyPoint.z);
        }
        
        // 子类可能重写了 hasUnitAtPosition 和 findAvailableSpawnPosition，尝试调用它们
        // 如果没有重写，使用默认逻辑（直接返回目标位置）
        if ((this as any).hasUnitAtPosition && typeof (this as any).hasUnitAtPosition === 'function') {
            const checkRadiusForPos = unitRadius;
            if (!(this as any).hasUnitAtPosition(targetPos, checkRadiusForPos)) {
                return targetPos;
            }
            
            // 如果目标位置被占用，尝试在周围找一个可用的位置
            if ((this as any).findAvailableSpawnPosition && typeof (this as any).findAvailableSpawnPosition === 'function') {
                return (this as any).findAvailableSpawnPosition(targetPos);
            }
        }
        
        // 如果没有重写方法，直接返回目标位置（让单位自己处理碰撞）
        return targetPos;
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
     * 公共工具方法：根据高度缩放比例调整建筑高度，但保持底部贴合网格
     * 适用于占据两个格子高的建筑（如哨塔、冰塔、雷元素塔）
     * @param heightScale 高度缩放比例（0.5 = 50%, 0.66 = 66%, 1.0 = 100%）
     */
    protected setHeightWithFixedBottomGeneric(heightScale: number, fullGridHeightInCells: number = 2) {
        const uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) {
            // 没有 UITransform 时，尽量仍然按比例缩放 Y
            this.node.setScale(this.defaultScale.x, heightScale, this.defaultScale.z);
            return;
        }

        // 计算完全体高度：优先使用网格 cellSize，其次用自身高度 * 默认缩放
        let fullHeight: number;
        const gridPanelAny = this.gridPanel as any;
        if (gridPanelAny && gridPanelAny.cellSize) {
            fullHeight = gridPanelAny.cellSize * fullGridHeightInCells;
        } else {
            fullHeight = uiTransform.height * this.defaultScale.y;
        }

        // 如果还未记录基准底部Y，则根据当前所在网格/位置计算一次
        if (Number.isNaN(this.baseY)) {
            if (this.gridPanel && this.gridX >= 0 && this.gridY >= 0) {
                const gridPanel = this.gridPanel as any;
                const gridCenter = this.gridPanel.gridToWorld(this.gridX, this.gridY);
                if (gridCenter) {
                    // 网格底部 = 中心Y - cellSize/2
                    this.baseY = gridCenter.y - gridPanel.cellSize / 2;
                } else {
                    const currentHeight = fullHeight * heightScale;
                    this.baseY = this.node.worldPosition.y - currentHeight / 2;
                }
            } else {
                const currentHeight = fullHeight * heightScale;
                this.baseY = this.node.worldPosition.y - currentHeight / 2;
            }
        }

        const currentHeight = fullHeight * heightScale;
        const newY = this.baseY + currentHeight / 2;

        // 按比例缩放 Y，X/Z 使用默认缩放（保持宽度不变）
        this.node.setScale(this.defaultScale.x, heightScale, this.defaultScale.z);

        const pos = this.node.worldPosition.clone();
        pos.y = newY;
        this.node.setWorldPosition(pos);
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

        // 如果已经选中此单位，先取消选择
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.hideSelectionPanel();
            return;
        }

        // 开始移动模式
        this.startMoving(event);
    }
    
    /**
     * 记录伤害到统计系统
     * @param damage 伤害值
     */
    protected recordDamageToStatistics(damage: number) {
        if (damage <= 0) {
            return;
        }
        
        try {
            const damageStats = DamageStatistics.getInstance();
            const unitTypeNameMap = DamageStatistics.getUnitTypeNameMap();
            const unitType = this.constructor.name; // 获取类名（如 'WatchTower', 'IceTower' 等）
            const unitName = unitTypeNameMap.get(unitType) || unitType;
            console.info('[Build] 记录伤害统计',
                'unitType =', unitType,
                'unitName =', unitName,
                'damage =', damage);
            damageStats.recordDamage(unitType, unitName, damage);
        } catch (error) {
            // 忽略错误，避免影响游戏流程
            console.warn('[Build] 记录伤害统计失败:', error);
        }
    }
}
