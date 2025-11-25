import { _decorator, Component, Node, UITransform, Graphics, Color, Label, Sprite, SpriteFrame, find } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 单位信息接口
 */
export interface UnitInfo {
    name: string; // 单位名称
    level: number; // 等级
    currentHealth: number; // 当前生命值
    maxHealth: number; // 最大生命值
    attackDamage: number; // 攻击力（如果有）
    populationCost: number; // 占用人口数（如果有）
    icon: SpriteFrame | null; // 单位图标
    // 范围信息
    collisionRadius?: number; // 占地范围
    attackRange?: number; // 攻击范围（如果有）
    healRange?: number; // 治疗范围（如果有，如月亮井）
}

@ccclass('UnitInfoPanel')
export class UnitInfoPanel extends Component {
    @property(Node)
    panelNode: Node = null!; // 面板节点

    private backgroundNode: Node = null!; // 背景节点
    private iconNode: Node = null!; // 图标节点
    private nameLabel: Label = null!; // 名称标签
    private levelLabel: Label = null!; // 等级标签
    private healthLabel: Label = null!; // 生命值标签
    private attackLabel: Label = null!; // 攻击力标签
    private populationLabel: Label = null!; // 人口标签

    start() {
        this.initPanel();
    }

    /**
     * 初始化面板
     */
    initPanel() {
        const canvas = find('Canvas');
        if (!canvas) {
            console.error('UnitInfoPanel: Canvas not found!');
            return;
        }

        // 创建面板节点（如果不存在）
        if (!this.panelNode) {
            this.panelNode = new Node('UnitInfoPanel');
            this.panelNode.setParent(canvas);
        }

        // 获取Canvas的UITransform
        const canvasTransform = canvas.getComponent(UITransform);
        const screenHeight = canvasTransform?.height || 1334;
        const screenWidth = canvasTransform?.width || 750;

        // 设置面板位置和大小（屏幕下方，占屏幕1/6高度）
        const panelTransform = this.panelNode.getComponent(UITransform) || this.panelNode.addComponent(UITransform);
        panelTransform.setContentSize(screenWidth, screenHeight / 6);
        this.panelNode.setPosition(0, -screenHeight / 2 + screenHeight / 12, 0);

        // 创建背景
        this.createBackground(screenWidth, screenHeight / 6);

        // 创建内容
        this.createContent(screenWidth, screenHeight / 6);

        // 初始隐藏
        this.hide();
    }

    /**
     * 创建背景
     */
    createBackground(width: number, height: number) {
        if (this.backgroundNode) {
            this.backgroundNode.destroy();
        }

        this.backgroundNode = new Node('Background');
        this.backgroundNode.setParent(this.panelNode);
        this.backgroundNode.setPosition(0, 0, 0);

        const bgTransform = this.backgroundNode.addComponent(UITransform);
        bgTransform.setContentSize(width, height);

        const bgGraphics = this.backgroundNode.addComponent(Graphics);
        bgGraphics.fillColor = new Color(0, 0, 0, 200); // 半透明黑色
        bgGraphics.rect(-width / 2, -height / 2, width, height);
        bgGraphics.fill();
    }

    /**
     * 创建内容
     */
    createContent(width: number, height: number) {
        const contentNode = new Node('Content');
        contentNode.setParent(this.panelNode);
        contentNode.setPosition(0, 0, 0);

        // 左侧：单位图标
        this.iconNode = new Node('Icon');
        this.iconNode.setParent(contentNode);
        const iconTransform = this.iconNode.addComponent(UITransform);
        iconTransform.setContentSize(height * 0.8, height * 0.8);
        this.iconNode.setPosition(-width / 2 + height * 0.5, 0, 0);
        const iconSprite = this.iconNode.addComponent(Sprite);
        iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;

        // 右侧：属性信息
        const infoNode = new Node('Info');
        infoNode.setParent(contentNode);
        const infoTransform = infoNode.addComponent(UITransform);
        infoTransform.setContentSize(width - height, height);
        infoNode.setPosition(height * 0.5, 0, 0);

        // 名称
        this.nameLabel = this.createLabel('Name', '单位名称', 24, new Color(255, 255, 255, 255));
        this.nameLabel.node.setParent(infoNode);
        this.nameLabel.node.setPosition(0, height / 2 - 20, 0);

        // 等级
        this.levelLabel = this.createLabel('Level', '等级: 1', 18, new Color(200, 200, 200, 255));
        this.levelLabel.node.setParent(infoNode);
        this.levelLabel.node.setPosition(0, height / 2 - 50, 0);

        // 生命值
        this.healthLabel = this.createLabel('Health', '生命值: 100/100', 18, new Color(200, 200, 200, 255));
        this.healthLabel.node.setParent(infoNode);
        this.healthLabel.node.setPosition(0, height / 2 - 80, 0);

        // 攻击力
        this.attackLabel = this.createLabel('Attack', '攻击力: 10', 18, new Color(200, 200, 200, 255));
        this.attackLabel.node.setParent(infoNode);
        this.attackLabel.node.setPosition(0, height / 2 - 110, 0);

        // 人口
        this.populationLabel = this.createLabel('Population', '占用人口: 1', 18, new Color(200, 200, 200, 255));
        this.populationLabel.node.setParent(infoNode);
        this.populationLabel.node.setPosition(0, height / 2 - 140, 0);
    }

    /**
     * 创建标签
     */
    createLabel(name: string, text: string, fontSize: number, color: Color): Label {
        const labelNode = new Node(name);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.color = color;
        return label;
    }

    /**
     * 显示单位信息
     */
    showUnitInfo(unitInfo: UnitInfo) {
        if (!this.panelNode) {
            this.initPanel();
        }

        // 更新图标
        if (this.iconNode) {
            const iconSprite = this.iconNode.getComponent(Sprite);
            if (iconSprite && unitInfo.icon) {
                iconSprite.spriteFrame = unitInfo.icon;
            }
        }

        // 更新名称
        if (this.nameLabel) {
            this.nameLabel.string = unitInfo.name;
        }

        // 更新等级
        if (this.levelLabel) {
            this.levelLabel.string = `等级: ${unitInfo.level}`;
        }

        // 更新生命值
        if (this.healthLabel) {
            this.healthLabel.string = `生命值: ${unitInfo.currentHealth}/${unitInfo.maxHealth}`;
        }

        // 更新攻击力
        if (this.attackLabel) {
            if (unitInfo.attackDamage !== undefined && unitInfo.attackDamage > 0) {
                this.attackLabel.string = `攻击力: ${unitInfo.attackDamage}`;
                this.attackLabel.node.active = true;
            } else {
                this.attackLabel.node.active = false;
            }
        }

        // 更新人口
        if (this.populationLabel) {
            if (unitInfo.populationCost !== undefined && unitInfo.populationCost > 0) {
                this.populationLabel.string = `占用人口: ${unitInfo.populationCost}`;
                this.populationLabel.node.active = true;
            } else {
                this.populationLabel.node.active = false;
            }
        }

        // 显示面板
        this.show();
    }

    /**
     * 显示面板
     */
    show() {
        if (this.panelNode) {
            this.panelNode.active = true;
        }
    }

    /**
     * 隐藏面板
     */
    hide() {
        if (this.panelNode) {
            this.panelNode.active = false;
        }
    }

    /**
     * 更新单位信息（用于实时更新生命值等）
     */
    updateUnitInfo(unitInfo: Partial<UnitInfo>) {
        if (!this.panelNode || !this.panelNode.active) {
            return;
        }

        // 更新生命值
        if (unitInfo.currentHealth !== undefined && unitInfo.maxHealth !== undefined && this.healthLabel) {
            this.healthLabel.string = `生命值: ${unitInfo.currentHealth}/${unitInfo.maxHealth}`;
        }

        // 更新等级
        if (unitInfo.level !== undefined && this.levelLabel) {
            this.levelLabel.string = `等级: ${unitInfo.level}`;
        }
    }
}

