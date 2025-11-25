import { _decorator, Component, Node, EventTarget, instantiate, EventTouch, Sprite, SpriteFrame, find } from 'cc';
import { UnitSelectionManager } from './UnitSelectionManager';
import { UnitInfo } from './UnitInfoPanel';
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

    private currentHealth: number = 100;
    private isDestroyed: boolean = false;
    private unitSelectionManager: UnitSelectionManager = null!; // 单位选择管理器
    private sprite: Sprite = null!; // Sprite组件引用
    private defaultSpriteFrame: SpriteFrame = null!; // 默认SpriteFrame

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;

        // 查找单位选择管理器
        this.findUnitSelectionManager();

        // 获取Sprite组件
        this.sprite = this.node.getComponent(Sprite);
        if (this.sprite && this.sprite.spriteFrame) {
            this.defaultSpriteFrame = this.sprite.spriteFrame;
        }

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
                icon: this.defaultSpriteFrame,
                collisionRadius: this.collisionRadius
            };
            this.unitSelectionManager.selectUnit(this.node, unitInfo);
        }
    }
}

