import { _decorator, Component, Node, Vec3, Prefab, instantiate, find, UITransform, Label, Color, SpriteFrame, Sprite, Graphics, EventTouch } from 'cc';
import { GameManager } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
import { UnitSelectionManager } from './UnitSelectionManager';
import { UnitInfo } from './UnitInfoPanel';
const { ccclass, property } = _decorator;

@ccclass('Tree')
export class Tree extends Component {
    @property
    maxHealth: number = 20; // 树木血量
    
    @property
    buildCost: number = 1; // 建造成本
    
    @property
    goldReward: number = 1; // 回收获得的金币
    
    @property(SpriteFrame)
    cardIcon: SpriteFrame = null!; // 单位名片图片
    
    @property
    collisionRadius: number = 30; // 碰撞半径（像素）
    
    @property(Prefab)
    explosionEffect: Prefab = null!; // 爆炸特效预制体
    
    @property(Prefab)
    damageNumberPrefab: Prefab = null!; // 伤害数字预制体
    
    private currentHealth: number = 20;
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
        this.node.on(Node.EventType.TOUCH_END, this.onTreeClick, this);
    }
    
    onDestroy() {
        // 移除点击事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onTreeClick, this);
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
        this.healthBarNode.setPosition(0, 50, 0); // 调整血条位置，确保在树木上方显示
        
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
            
            // 设置伤害数字位置（在树木上方）
            const treePos = this.node.worldPosition.clone();
            damageNode.setWorldPosition(treePos.add3f(0, 50, 0));
            
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
    onTreeClick(event: EventTouch) {
        // 检查是否有选中的小精灵，如果有则不处理点击事件（让小精灵移动到树木）
        const selectionManager = this.findSelectionManager();
        
        let hasSelectedWisps = false;
        if (selectionManager && selectionManager.hasSelectedWisps && typeof selectionManager.hasSelectedWisps === 'function') {
            hasSelectedWisps = selectionManager.hasSelectedWisps();
        }
        
        if (hasSelectedWisps) {
            // 有选中的小精灵，不处理树木的点击事件，让SelectionManager处理移动
            return;
        }

        // 阻止事件传播
        event.propagationStopped = true;

        // 如果已经显示选择面板，先隐藏
        if (this.selectionPanel && this.selectionPanel.isValid) {
            this.hideSelectionPanel();
            return;
        }

        // 显示单位信息面板和范围
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (this.unitSelectionManager) {
            const unitInfo: UnitInfo = {
                name: '普通树木',
                level: 1,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth,
                attackDamage: 0, // 普通树木没有攻击能力
                populationCost: 0, // 不占用人口
                icon: this.cardIcon || this.defaultSpriteFrame,
                collisionRadius: this.collisionRadius,
                onSellClick: () => {
                    this.onSellClick();
                }
            };
            this.unitSelectionManager.selectUnit(this.node, unitInfo);
        }

        // 显示选择面板
        this.showSelectionPanel();
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

        this.selectionPanel = new Node('TreeSelectionPanel');
        this.selectionPanel.setParent(canvas);

        // 添加UITransform
        const uiTransform = this.selectionPanel.addComponent(UITransform);
        uiTransform.setContentSize(120, 40);

        // 设置位置（在树木上方）
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
        
        // 销毁树木
        this.destroyTree();
    }

    /**
     * 销毁树木（用于回收）
     */
    destroyTree() {
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