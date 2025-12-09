import { _decorator, Component, Node, find, Graphics, UITransform, Color, EventTouch, Camera, Vec3 } from 'cc';
import { UnitInfoPanel, UnitInfo } from './UnitInfoPanel';
const { ccclass, property } = _decorator;

/**
 * 单位选择管理器
 * 统一管理单位选择和信息面板显示
 */
@ccclass('UnitSelectionManager')
export class UnitSelectionManager extends Component {
    @property(Node)
    unitInfoPanelNode: Node = null!; // 单位信息面板节点

    private unitInfoPanel: UnitInfoPanel = null!; // 单位信息面板组件
    private currentSelectedUnit: Node = null!; // 当前选中的单位节点
    private currentRangeDisplayNode: Node = null!; // 当前范围显示节点

    start() {
        this.initUnitInfoPanel();
        this.setupGlobalClickHandler();
    }
    
    /**
     * 设置全局点击处理器，用于取消选择
     */
    setupGlobalClickHandler() {
        const canvas = find('Canvas');
        if (canvas) {
            // 监听Canvas的触摸结束事件，用于取消选择
            canvas.on(Node.EventType.TOUCH_END, this.onGlobalTouchEnd, this);
        }
    }
    
    /**
     * 全局触摸结束事件处理
     */
    onGlobalTouchEnd(event: EventTouch) {
        // 如果没有选中任何单位，直接返回
        if (!this.currentSelectedUnit) {
            return;
        }
        
        // 检查点击位置是否在当前选中的单位上
        const touchLocation = event.getLocation();
        const cameraNode = find('Canvas/Camera');
        if (!cameraNode) {
            return;
        }
        
        const camera = cameraNode.getComponent(Camera);
        if (!camera) {
            return;
        }
        
        // 检查点击位置是否在当前选中的单位上
        const unitWorldPos = this.currentSelectedUnit.worldPosition;
        const unitScreenPos = new Vec3();
        camera.worldToScreen(unitWorldPos, unitScreenPos);
        
        // 计算点击位置与单位屏幕位置的距离
        const distanceToUnit = Math.sqrt(
            Math.pow(touchLocation.x - unitScreenPos.x, 2) +
            Math.pow(touchLocation.y - unitScreenPos.y, 2)
        );
        
        // 检查点击位置是否在单位的碰撞范围内
        const unitInfoPanel = this.unitInfoPanel;
        if (unitInfoPanel) {
            // 检查点击位置是否在信息面板上
            const panelNode = unitInfoPanel.panelNode;
            if (panelNode && panelNode.active) {
                const panelTransform = panelNode.getComponent(UITransform);
                if (panelTransform) {
                    const panelWorldPos = panelNode.worldPosition;
                    const panelScreenPos = new Vec3();
                    camera.worldToScreen(panelWorldPos, panelScreenPos);
                    
                    // 计算面板在屏幕上的边界
                    const panelWidth = panelTransform.width;
                    const panelHeight = panelTransform.height;
                    const panelLeft = panelScreenPos.x - panelWidth / 2;
                    const panelRight = panelScreenPos.x + panelWidth / 2;
                    const panelBottom = panelScreenPos.y - panelHeight / 2;
                    const panelTop = panelScreenPos.y + panelHeight / 2;
                    
                    // 检查点击位置是否在面板内
                    if (touchLocation.x >= panelLeft && 
                        touchLocation.x <= panelRight && 
                        touchLocation.y >= panelBottom && 
                        touchLocation.y <= panelTop) {
                        // 点击在信息面板上，不取消选择
                        return;
                    }
                }
            }
        }
        
        // 检查点击位置是否在当前选中的单位上
        // 假设单位的碰撞半径为50像素（可以根据实际情况调整）
        const collisionRadius = 50;
        if (distanceToUnit <= collisionRadius) {
            // 点击在单位上，不取消选择
            return;
        }
        
        // 点击不在单位和信息面板上，取消选择
        this.clearSelection();
    }

    /**
     * 初始化单位信息面板
     */
    initUnitInfoPanel() {
        const canvas = find('Canvas');
        if (!canvas) {
            console.error('UnitSelectionManager: Canvas not found!');
            return;
        }

        // 创建或获取单位信息面板节点
        if (!this.unitInfoPanelNode) {
            this.unitInfoPanelNode = new Node('UnitInfoPanel');
            this.unitInfoPanelNode.setParent(canvas);
        }

        // 获取或添加UnitInfoPanel组件
        this.unitInfoPanel = this.unitInfoPanelNode.getComponent(UnitInfoPanel);
        if (!this.unitInfoPanel) {
            this.unitInfoPanel = this.unitInfoPanelNode.addComponent(UnitInfoPanel);
        }

        // 设置panelNode引用
        if (this.unitInfoPanel) {
            this.unitInfoPanel.panelNode = this.unitInfoPanelNode;
        }
    }

    /**
     * 选中单位
     * @param unitNode 单位节点
     * @param unitInfo 单位信息
     */
    selectUnit(unitNode: Node, unitInfo: UnitInfo) {
        // 清除之前的选择
        this.clearSelection();

        // 设置当前选中的单位
        this.currentSelectedUnit = unitNode;

        // 显示单位信息面板
        if (this.unitInfoPanel) {
            this.unitInfoPanel.showUnitInfo(unitInfo);
        }

        // 显示范围
        this.showRangeDisplay(unitNode, unitInfo);
    }

    /**
     * 清除选择
     */
    clearSelection() {
        // 隐藏信息面板
        if (this.unitInfoPanel) {
            this.unitInfoPanel.hide();
        }

        // 隐藏范围显示
        this.hideRangeDisplay();

        // 先保存当前选中的单位，然后清除选中状态
        const selectedUnit = this.currentSelectedUnit;
        // 清除当前选中单位
        this.currentSelectedUnit = null!;
        
        // 如果有选中的单位，调用setHighlight(false)清除高亮
        if (selectedUnit && selectedUnit.isValid) {
            // 调用单位的setHighlight方法清除高亮
            const unitScript = selectedUnit.getComponent('Wisp') as any;
            if (unitScript && unitScript.setHighlight) {
                unitScript.setHighlight(false);
            }
            
            // 也检查是否是其他单位类型
            const arrowerScript = selectedUnit.getComponent('Arrower') as any;
            if (arrowerScript && arrowerScript.setHighlight) {
                arrowerScript.setHighlight(false);
            }
            
            // 检查是否是女猎手
            const hunterScript = selectedUnit.getComponent('Hunter') as any;
            if (hunterScript && hunterScript.setHighlight) {
                hunterScript.setHighlight(false);
            }
            
            // 检查是否是建筑物类型
            const warAncientTreeScript = selectedUnit.getComponent('WarAncientTree') as any;
            if (warAncientTreeScript && warAncientTreeScript.setHighlight) {
                warAncientTreeScript.setHighlight(false);
            }
            
            const moonWellScript = selectedUnit.getComponent('MoonWell') as any;
            if (moonWellScript && moonWellScript.setHighlight) {
                moonWellScript.setHighlight(false);
            }
            
            const treeScript = selectedUnit.getComponent('Tree') as any;
            if (treeScript && treeScript.setHighlight) {
                treeScript.setHighlight(false);
            }
            
            const hunterHallScript = selectedUnit.getComponent('HunterHall') as any;
            if (hunterHallScript && hunterHallScript.setHighlight) {
                hunterHallScript.setHighlight(false);
            }
        }
    }

    /**
     * 显示范围显示
     */
    showRangeDisplay(unitNode: Node, unitInfo: UnitInfo) {
        // 先隐藏之前的范围显示
        this.hideRangeDisplay();

        const canvas = find('Canvas');
        if (!canvas) return;

        // 创建范围显示节点
        this.currentRangeDisplayNode = new Node('UnitRangeDisplay');
        this.currentRangeDisplayNode.setParent(canvas);
        this.currentRangeDisplayNode.setWorldPosition(unitNode.worldPosition);

        // 添加UITransform
        const uiTransform = this.currentRangeDisplayNode.addComponent(UITransform);
        const maxRange = Math.max(
            unitInfo.collisionRadius || 0,
            unitInfo.attackRange || 0,
            unitInfo.healRange || 0
        );
        uiTransform.setContentSize(maxRange * 2, maxRange * 2);

        // 绘制占地范围（如果有）
        if (unitInfo.collisionRadius && unitInfo.collisionRadius > 0) {
            const collisionNode = new Node('CollisionRange');
            collisionNode.setParent(this.currentRangeDisplayNode);
            collisionNode.setPosition(0, 0, 0);
            const collisionGraphics = collisionNode.addComponent(Graphics);
            collisionGraphics.fillColor = new Color(0, 100, 255, 80); // 蓝色半透明
            collisionGraphics.circle(0, 0, unitInfo.collisionRadius);
            collisionGraphics.fill();
            collisionGraphics.strokeColor = new Color(0, 100, 255, 200); // 蓝色边框
            collisionGraphics.lineWidth = 2;
            collisionGraphics.circle(0, 0, unitInfo.collisionRadius);
            collisionGraphics.stroke();
        }

        // 绘制攻击范围（如果有）
        if (unitInfo.attackRange && unitInfo.attackRange > 0) {
            const attackNode = new Node('AttackRange');
            attackNode.setParent(this.currentRangeDisplayNode);
            attackNode.setPosition(0, 0, 0);
            const attackGraphics = attackNode.addComponent(Graphics);
            attackGraphics.fillColor = new Color(255, 0, 0, 100); // 红色半透明
            attackGraphics.circle(0, 0, unitInfo.attackRange);
            attackGraphics.fill();
            attackGraphics.strokeColor = new Color(255, 0, 0, 200); // 红色边框
            attackGraphics.lineWidth = 2;
            attackGraphics.circle(0, 0, unitInfo.attackRange);
            attackGraphics.stroke();
        }

        // 绘制治疗范围（如果有，如月亮井）
        if (unitInfo.healRange && unitInfo.healRange > 0) {
            const healNode = new Node('HealRange');
            healNode.setParent(this.currentRangeDisplayNode);
            healNode.setPosition(0, 0, 0);
            const healGraphics = healNode.addComponent(Graphics);
            healGraphics.fillColor = new Color(0, 255, 0, 100); // 绿色半透明
            healGraphics.circle(0, 0, unitInfo.healRange);
            healGraphics.fill();
            healGraphics.strokeColor = new Color(0, 255, 0, 200); // 绿色边框
            healGraphics.lineWidth = 2;
            healGraphics.circle(0, 0, unitInfo.healRange);
            healGraphics.stroke();
        }
    }

    /**
     * 隐藏范围显示
     */
    hideRangeDisplay() {
        if (this.currentRangeDisplayNode && this.currentRangeDisplayNode.isValid) {
            this.currentRangeDisplayNode.destroy();
            this.currentRangeDisplayNode = null!;
        }
    }

    /**
     * 更新单位信息（用于实时更新生命值等）
     */
    updateUnitInfo(unitInfo: Partial<UnitInfo>) {
        if (this.unitInfoPanel) {
            this.unitInfoPanel.updateUnitInfo(unitInfo);
        }
    }

    /**
     * 获取当前选中的单位
     */
    getCurrentSelectedUnit(): Node | null {
        return this.currentSelectedUnit;
    }

    /**
     * 检查是否选中了指定单位
     */
    isUnitSelected(unitNode: Node): boolean {
        return this.currentSelectedUnit === unitNode;
    }
    
    /**
     * 更新范围显示位置，使其跟随选中的单位移动
     */
    update(deltaTime: number) {
        // 如果有选中的单位和范围显示节点，更新范围显示节点的位置
        if (this.currentSelectedUnit && this.currentSelectedUnit.isValid && this.currentRangeDisplayNode && this.currentRangeDisplayNode.isValid) {
            this.currentRangeDisplayNode.setWorldPosition(this.currentSelectedUnit.worldPosition);
        }
    }
}

