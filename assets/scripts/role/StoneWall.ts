import { _decorator, Node, Vec3, find, UITransform, Label, Color, SpriteFrame, Graphics, EventTouch, Camera, instantiate } from 'cc';
import { Build } from './Build';
import { UnitInfo } from '../UnitInfoPanel';
import { BuildingGridPanel } from '../BuildingGridPanel';
import { StoneWallGridPanel } from '../StoneWallGridPanel';
import { UnitType } from './WarAncientTree';
import { BuildingPool } from '../BuildingPool';
const { ccclass, property } = _decorator;

@ccclass('StoneWall')
export class StoneWall extends Build {
    // 石墙特有属性
    @property
    goldReward: number = 1; // 回收获得的金币
    
    // 高亮相关
    private isHighlighted: boolean = false; // 是否高亮显示
    private highlightNode: Node = null!; // 高亮效果节点
    
    /**
     * 当石墙从对象池激活时调用（用于对象池复用）
     */
    onEnable() {
        // 调用父类onEnable方法
        super.onEnable();
        
        // 石墙特有的初始化：监听点击事件
        this.node.on(Node.EventType.TOUCH_END, this.onStoneWallClick, this);
    }
    
    protected start() {
        // 设置单位类型
        this.unitType = UnitType.BUILDING;
        
        // 调用父类start方法
        super.start();
        
        // 石墙特有的初始化：监听点击事件
        this.node.on(Node.EventType.TOUCH_END, this.onStoneWallClick, this);
    }
    
    onDestroy() {
        // 移除点击事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onStoneWallClick, this);
        
        // 调用父类onDestroy
        super.onDestroy();
    }
    
    /**
     * 查找网格面板（重写以支持石墙网格）
     */
    protected findGridPanel() {
        // 查找石墙网格面板
        const stoneWallGridPanelNode = find('StoneWallGridPanel');
        if (stoneWallGridPanelNode) {
            // 使用类型断言，因为StoneWallGridPanel和BuildingGridPanel有相同的方法接口
            this.gridPanel = stoneWallGridPanelNode.getComponent(StoneWallGridPanel) as any;
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
     * 点击事件（石墙特有）
     */
    onStoneWallClick(event: EventTouch) {
        // 检查是否正在拖拽建筑物（通过TowerBuilder）
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
     * 设置高亮显示（石墙特有）
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
            const radius = this.collisionRadius ?? 25;
            graphics.circle(0, 0, radius);
            graphics.stroke();
        } else if (this.highlightNode && highlight) {
            // 如果高亮节点已存在，重新绘制以确保使用最新的 collisionRadius 值
            const graphics = this.highlightNode.getComponent(Graphics);
            if (graphics) {
                graphics.clear();
                graphics.strokeColor = new Color(255, 255, 0, 255); // 黄色边框
                graphics.lineWidth = 3;
                const radius = this.collisionRadius ?? 25;
                graphics.circle(0, 0, radius);
                graphics.stroke();
            }
        }
        
        if (this.highlightNode) {
            this.highlightNode.active = highlight;
        }
    }

    /**
     * 死亡（重写以添加金币奖励逻辑）
     */
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

        // 给玩家奖励金币（石墙特有）
        if (this.gameManager) {
            this.gameManager.addGold(this.goldReward);
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
        }, 0.5);
    }
    
    /**
     * 重置建筑物状态（重写以清理石墙特有状态）
     */
    protected resetBuildingState() {
        // 调用父类重置方法
        super.resetBuildingState();
        
        // 清理高亮节点
        if (this.highlightNode) {
            this.highlightNode.destroy();
            this.highlightNode = null!;
        }
        this.isHighlighted = false;
    }

    /**
     * 回收按钮点击事件（石墙特有）
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
        
        // 销毁石墙（使用die方法，会返回到对象池）
        this.die();
    }

    /**
     * 销毁石墙（用于回收，已废弃，使用die方法）
     * @deprecated 使用die()方法代替
     */
    destroyStoneWall() {
        this.die();
    }
}
