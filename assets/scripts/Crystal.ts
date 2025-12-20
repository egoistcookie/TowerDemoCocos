import { _decorator, Component, Node, EventTarget, instantiate, EventTouch, Sprite, SpriteFrame, find, Prefab, Vec3, Graphics, UITransform, Color } from 'cc';
import { UnitConfigManager } from './UnitConfigManager';
import { UnitSelectionManager } from './UnitSelectionManager';
import { UnitInfo } from './UnitInfoPanel';
import { GameManager, GameState } from './GameManager';
import { GamePopup } from './GamePopup';
const { ccclass, property } = _decorator;

const eventTarget = new EventTarget();

@ccclass('Crystal')
export class Crystal extends Component {
    @property
    maxHealth: number = 100;

    @property(Node)
    explosionEffect: Node = null!;

    @property
    level: number = 1; // 水晶等级

    @property
    collisionRadius: number = 40; // 占地范围（像素）

    @property(SpriteFrame)
    cardIcon: SpriteFrame = null!; // 单位名片图片

    @property(Prefab)
    wispPrefab: Prefab = null!; // 小精灵预制体

    @property
    productionInterval: number = 2.0; // 每2秒生产一个小精灵

    @property
    spawnOffset: number = 100; // 小精灵出现在下方100像素

    private currentHealth: number = 100;
    private isDestroyed: boolean = false;
    private unitSelectionManager: UnitSelectionManager = null!; // 单位选择管理器
    private sprite: Sprite = null!; // Sprite组件引用
    private defaultSpriteFrame: SpriteFrame = null!; // 默认SpriteFrame
    private gameManager: GameManager = null!; // 游戏管理器
    
    // 生产相关
    private producedWisps: Node[] = []; // 已生产的小精灵列表
    private productionTimer: number = 0; // 生产计时器
    private productionProgress: number = 0; // 生产进度（0-1）
    private isProducing: boolean = false; // 是否正在生产
    private wispContainer: Node = null!; // 小精灵容器
    private productionProgressBar: Node = null!; // 生产进度条节点
    private productionProgressGraphics: Graphics = null!; // 生产进度条Graphics组件

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.producedWisps = [];
        this.productionTimer = 0;
        this.productionProgress = 0;
        this.isProducing = false;

        // 查找单位选择管理器
        this.findUnitSelectionManager();

        // 查找游戏管理器
        this.findGameManager();

        // 查找小精灵容器
        this.findWispContainer();

        // 获取Sprite组件
        this.sprite = this.node.getComponent(Sprite);
        if (this.sprite && this.sprite.spriteFrame) {
            this.defaultSpriteFrame = this.sprite.spriteFrame;
        }

        // 创建生产进度条
        this.createProductionProgressBar();

        // 监听点击事件
        this.node.on(Node.EventType.TOUCH_END, this.onCrystalClick, this);
    }

    onDestroy() {
        // 移除点击事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onCrystalClick, this);

        // 清除单位信息面板和范围显示
        if (this.unitSelectionManager) {
            // 检查是否当前选中的是水晶
            if (this.unitSelectionManager.isUnitSelected(this.node)) {
                this.unitSelectionManager.clearSelection();
            }
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
        
        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.destroyCrystal();
        }
    }

    destroyCrystal() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;

        // 清除单位信息面板和范围显示
        if (this.unitSelectionManager) {
            // 检查是否当前选中的是水晶
            if (this.unitSelectionManager.isUnitSelected(this.node)) {
                this.unitSelectionManager.clearSelection();
            }
        }
        
        // 触发爆炸效果
        if (this.explosionEffect) {
            const explosion = instantiate(this.explosionEffect);
            
            // 先设置父节点和位置
            explosion.setParent(this.node.parent);
            explosion.setWorldPosition(this.node.worldPosition);
            
            // 立即设置缩放为0，确保不会显示在屏幕中央
            explosion.setScale(0, 0, 1);
            
            // 延迟一小段时间后开始动画（确保位置已正确设置）
            this.scheduleOnce(() => {
                if (explosion && explosion.isValid) {
                    // 爆炸效果会自动在ExplosionEffect的start()中开始动画
                }
            }, 0.01);
            
            // 延迟销毁爆炸效果节点（动画完成后）
            this.scheduleOnce(() => {
                if (explosion && explosion.isValid) {
                    explosion.destroy();
                }
            }, 1.0);
        }

        // 通知游戏管理器
        eventTarget.emit('crystal-destroyed');
        
        // 隐藏水晶
        this.node.active = false;
    }

    getHealth(): number {
        return this.currentHealth;
    }

    getMaxHealth(): number {
        return this.maxHealth;
    }

    isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }

    static getEventTarget(): EventTarget {
        return eventTarget;
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
     * 查找小精灵容器
     */
    findWispContainer() {
        // 查找Wisps容器
        let wispsNode = find('Wisps');
        if (!wispsNode && this.node.scene) {
            // 如果不存在，创建一个
            wispsNode = new Node('Wisps');
            const canvas = find('Canvas');
            if (canvas) {
                wispsNode.setParent(canvas);
            } else if (this.node.scene) {
                wispsNode.setParent(this.node.scene);
            }
        }
        this.wispContainer = wispsNode;
    }

    /**
     * 创建生产进度条
     */
    createProductionProgressBar() {
        if (this.productionProgressBar) {
            return;
        }

        this.productionProgressBar = new Node('ProductionProgressBar');
        this.productionProgressBar.setParent(this.node);
        this.productionProgressBar.setPosition(0, -60, 0); // 位于血量条下方

        const uiTransform = this.productionProgressBar.addComponent(UITransform);
        uiTransform.setContentSize(60, 6);

        this.productionProgressGraphics = this.productionProgressBar.addComponent(Graphics);
        this.updateProductionProgressBar();
    }

    /**
     * 更新生产进度条
     */
    updateProductionProgressBar() {
        if (!this.productionProgressGraphics) {
            return;
        }

        this.productionProgressGraphics.clear();
        
        if (this.isProducing) {
            // 绘制进度条背景
            this.productionProgressGraphics.fillColor = new Color(50, 50, 50, 200);
            this.productionProgressGraphics.rect(-30, -3, 60, 6);
            this.productionProgressGraphics.fill();

            // 绘制进度条
            const progressWidth = 60 * this.productionProgress;
            this.productionProgressGraphics.fillColor = new Color(0, 255, 0, 255);
            this.productionProgressGraphics.rect(-30, -3, progressWidth, 6);
            this.productionProgressGraphics.fill();

            // 绘制边框
            this.productionProgressGraphics.strokeColor = new Color(255, 255, 255, 255);
            this.productionProgressGraphics.lineWidth = 1;
            this.productionProgressGraphics.rect(-30, -3, 60, 6);
            this.productionProgressGraphics.stroke();
        }
    }

    /**
     * 更新方法
     */
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

        // 生产小精灵逻辑
        if (this.isProducing) {
            this.productionTimer += deltaTime;
            this.productionProgress = Math.min(1.0, this.productionTimer / this.productionInterval);
            this.updateProductionProgressBar();

            if (this.productionProgress >= 1.0) {
                // 生产完成
                this.productionTimer = 0;
                this.productionProgress = 0;
                this.isProducing = false;
                this.produceWisp();
                this.updateProductionProgressBar();
            }
        }
    }

    /**
     * 开始生产小精灵
     */
    startProducingWisp() {
        if (this.isProducing) {
            return; // 正在生产中
        }

        // 检查人口上限
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        if (this.gameManager && !this.gameManager.canAddPopulation(1)) {
            // 显示人口不足弹窗
            GamePopup.showMessage('人口不足');
            return;
        }

        this.isProducing = true;
        this.productionTimer = 0;
        this.productionProgress = 0;
        this.updateProductionProgressBar();
        
        // 水晶点击训练小精灵后会取消被选中的状态
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.clearSelection();
        }
    }

    /**
     * 生产小精灵
     */
    produceWisp() {
        if (!this.wispPrefab || !this.wispContainer) {
            return;
        }

        // 检查人口上限
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        if (this.gameManager && !this.gameManager.canAddPopulation(1)) {
            return;
        }

        // 计算小精灵出现位置（水晶下方100像素）
        const crystalPos = this.node.worldPosition.clone();
        const spawnPos = new Vec3(crystalPos.x, crystalPos.y - this.spawnOffset, crystalPos.z);

        // 增加人口（在创建小精灵之前）
        if (this.gameManager) {
            if (!this.gameManager.addPopulation(1)) {
                return;
            }
        }

        // 创建小精灵
        const wisp = instantiate(this.wispPrefab);
        wisp.setParent(this.wispContainer);
        wisp.setWorldPosition(spawnPos);
        wisp.active = true;

        // 应用配置
        const wispScript = wisp.getComponent('Wisp') as any;
        if (wispScript) {
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                configManager.applyConfigToUnit('Wisp', wispScript);
            }
        }

        // 添加到生产的小精灵列表
        this.producedWisps.push(wisp);

        // 监听小精灵销毁事件，从列表中移除
        wisp.once(Node.EventType.NODE_DESTROYED, () => {
            // 安全地从列表中移除小精灵，避免findIndex出错
            if (this.producedWisps && Array.isArray(this.producedWisps)) {
                const index = this.producedWisps.findIndex(w => w === wisp);
                if (index >= 0) {
                    this.producedWisps.splice(index, 1);
                }
            }
        });

        
        // 更新单位信息面板（如果被选中）
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                currentUnitCount: this.producedWisps.length
            });
        }
    }

    /**
     * 水晶点击事件
     */
    onCrystalClick(event: EventTouch) {
        // 如果水晶已被摧毁，不显示信息面板
        if (this.isDestroyed) {
            return;
        }

        // 阻止事件冒泡
        event.propagationStopped = true;

        // 显示单位信息面板和范围
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (this.unitSelectionManager) {
            // 检查是否已经选中了水晶
            if (this.unitSelectionManager.isUnitSelected(this.node)) {
                // 如果已经选中，清除选择
                this.unitSelectionManager.clearSelection();
                return;
            }

            const unitInfo: UnitInfo = {
                name: '水晶',
                level: this.level,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth,
                attackDamage: 0, // 水晶不攻击
                populationCost: 0, // 水晶不占用人口
                icon: this.cardIcon || this.defaultSpriteFrame,
                collisionRadius: this.collisionRadius,
                currentUnitCount: this.producedWisps.length,
                maxUnitCount: 999, // 无上限
                onTrainWispClick: () => {
                    this.startProducingWisp();
                }
            };
            this.unitSelectionManager.selectUnit(this.node, unitInfo);
        }
    }
}

