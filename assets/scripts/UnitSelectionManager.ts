import { _decorator, Component, Node, find, Graphics, UITransform, Color } from 'cc';
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

        // 清除当前选中单位
        this.currentSelectedUnit = null!;
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
}

