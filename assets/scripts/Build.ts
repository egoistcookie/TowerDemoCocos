import { _decorator, Component, Node, Vec3, Prefab, instantiate, find, Sprite, SpriteFrame, Color, Graphics, UITransform, Label, EventTouch, Camera } from 'cc';
import { GameManager, GameState } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
import { UnitSelectionManager } from './UnitSelectionManager';
import { UnitInfo } from './UnitInfoPanel';
import { SelectionManager } from './SelectionManager';
import { BuildingGridPanel } from './BuildingGridPanel';
import { UnitType } from './WarAncientTree';
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
    protected buildCost: number = 10; // 建造成本

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
    
    // 小精灵相关
    protected attachedWisps: Node[] = []; // 依附的小精灵列表

    // 选择面板相关
    protected selectionPanel: Node = null!; // 选择面板节点
    protected globalTouchHandler: ((event: EventTouch) => void) | null = null; // 全局触摸事件处理器
    protected unitSelectionManager: UnitSelectionManager = null!; // 单位选择管理器

    // 网格位置相关
    public gridX: number = -1; // 网格X坐标
    public gridY: number = -1; // 网格Y坐标
    protected isMoving: boolean = false; // 是否正在移动
    protected moveStartPos: Vec3 = new Vec3(); // 移动起始位置
    protected gridPanel: BuildingGridPanel = null!; // 网格面板组件

    protected start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
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

    protected isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }

    /**
     * 显示选择面板（子类需要重写）
     */
    protected showSelectionPanel() {
        // 子类实现
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
            console.debug(`Build: Sold, refunded ${refund} gold`);
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
     * 销毁建筑物（子类可以重写）
     */
    protected destroyBuilding() {
        // 隐藏面板
        this.hideSelectionPanel();

        // 移除点击事件监听（子类需要重写点击事件处理方法名）
        // this.node.off(Node.EventType.TOUCH_END, this.onBuildingClick, this);

        // 调用die方法进行销毁
        this.die();
    }

    /**
     * 让小精灵依附
     */
    protected attachWisp(wisp: Node) {
        const wispScript = wisp.getComponent('Wisp') as any;
        if (!wispScript) {
            console.warn('Build: Cannot attach - wisp script not found');
            return;
        }

        // 检查小精灵是否已经依附在其他建筑物上
        if (wispScript.getIsAttached && wispScript.getIsAttached()) {
            console.warn('Build: Wisp already attached to another building');
            return;
        }

        // 先将小精灵添加到依附列表，再调用attachToBuilding
        this.attachedWisps.push(wisp);
        
        // 让小精灵依附，传递fromBuilding参数为true避免循环调用
        if (wispScript.attachToBuilding) {
            wispScript.attachToBuilding(this.node, true);
            console.debug(`Build: Wisp attached, total: ${this.attachedWisps.length}`);
        }
    }

    /**
     * 卸下小精灵
     */
    protected detachWisp() {
        if (this.attachedWisps.length === 0) {
            console.debug('Build: No wisp to detach');
            return;
        }

        // 卸下第一个小精灵
        const wisp = this.attachedWisps[0];
        // 先从列表中移除，再调用detachFromBuilding，避免indexOf出错
        this.attachedWisps.shift();
        
        const wispScript = wisp.getComponent('Wisp') as any;
        if (wispScript && wispScript.detachFromBuilding) {
            wispScript.detachFromBuilding();
            console.debug(`Build: Wisp detached, remaining: ${this.attachedWisps.length}`);
        }
        
        // 卸下小精灵后取消选中状态
        this.hideSelectionPanel();
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
    protected moveToGridPosition(gridX: number, gridY: number) {
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

        console.debug(`Build: Moved to grid (${gridX}, ${gridY})`);
    }

    /**
     * 查找网格面板
     */
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
     * 建筑物点击事件处理（子类需要重写）
     */
    protected onBuildingClick(event: EventTouch) {
        // 子类实现
    }
}
