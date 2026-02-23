import { _decorator, Component, Node, UITransform, Graphics, Color, Label, Sprite, SpriteFrame, find, EventTouch, Button, Vec3, resources, director } from 'cc';
import { GameManager } from './GameManager';
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
    healRange?: number; // 治疗范围（如果有）
    // 建筑物属性
    currentUnitCount?: number; // 当前训练单位数量（建筑物）
    maxUnitCount?: number; // 最大训练单位数量（建筑物）
    healAmount?: number; // 治疗量（建筑物）
    healSpeed?: number; // 治疗速度（建筑物，单位：次/秒）
    // 防御单位属性
    attackFrequency?: number; // 攻击频率（防御单位，单位：次/秒）
    moveSpeed?: number; // 移动速度（防御单位，单位：像素/秒）
    // 按钮回调
    onUpgradeClick?: () => void; // 升级按钮点击回调
    onSellClick?: () => void; // 回收按钮点击回调
    onRallyPointClick?: () => void; // 集结点设置按钮点击回调
    onDefendClick?: () => void; // 防御按钮点击回调
    // 升级相关
    upgradeCost?: number; // 升级费用（用于显示）
    maxLevel?: number; // 最高等级（用于判断是否满级）
    // 集结点相关
    rallyPoint?: Vec3 | null; // 集结点位置（用于显示）
    // 防御状态
    isDefending?: boolean; // 是否处于防御状态（用于按钮显示）
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
    private unitCountLabel: Label = null!; // 训练单位数量标签（建筑物）
    private healAmountLabel: Label = null!; // 治疗量标签（建筑物）
    private healSpeedLabel: Label = null!; // 治疗速度标签（建筑物）
    private attackFrequencyLabel: Label = null!; // 攻击频率标签（防御单位）
    private moveSpeedLabel: Label = null!; // 移动速度标签（防御单位）
    private rallyPointLabel: Label = null!; // 集结点标签（建筑物）
    private buttonGridNode: Node = null!; // 九宫格按钮区域节点
    private buttonNodes: Node[] = []; // 按钮节点数组（9个）
    private currentUnitInfo: UnitInfo | null = null!; // 当前单位信息
    private currentSelectedUnits: Node[] = []; // 当前选中的多个单位节点（多选模式）
    private isMultiSelection: boolean = false; // 是否为多选模式
    private buttonSprites: Map<number, Sprite> = new Map(); // 按钮的Sprite组件映射（按钮索引 -> Sprite）
    private buttonNormalSprites: Map<number, SpriteFrame> = new Map(); // 按钮正常状态的贴图（按钮索引 -> SpriteFrame）
    private buttonDownSprites: Map<number, SpriteFrame> = new Map(); // 按钮按下状态的贴图（按钮索引 -> SpriteFrame）
    private defendButtonPressed: boolean = false; // 防御按钮是否处于按下状态

    start() {
        this.initPanel();
    }

    /**
     * 初始化面板
     */
    initPanel() {
        const canvas = find('Canvas');
        if (!canvas) {
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
        // 两侧与边框保持50像素的距离，所以面板宽度 = 屏幕宽度 - 50
        const panelWidth = screenWidth - 50;
        const panelHeight = screenHeight / 6; 
        const panelTransform = this.panelNode.getComponent(UITransform) || this.panelNode.addComponent(UITransform);
        panelTransform.setContentSize(panelWidth, panelHeight);
        this.panelNode.setPosition(0, -screenHeight / 2 + panelHeight / 2, 0);

        // 创建背景
        this.createBackground(panelWidth, panelHeight);

        // 创建内容（左侧信息 + 右侧按钮）
        this.createContent(panelWidth, panelHeight);

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
        
        // 圆角半径
        const cornerRadius = 15;
        
        // 绘制半透明黑色背景（圆角矩形）
        bgGraphics.fillColor = new Color(0, 0, 0, 200);
        bgGraphics.roundRect(-width / 2, -height / 2, width, height, cornerRadius);
        bgGraphics.fill();
        
        // 绘制高亮边框（圆角矩形）
        bgGraphics.strokeColor = new Color(100, 200, 255, 255); // 亮蓝色边框
        bgGraphics.lineWidth = 3;
        bgGraphics.roundRect(-width / 2, -height / 2, width, height, cornerRadius);
        bgGraphics.stroke();
    }

    /**
     * 创建内容
     */
    createContent(width: number, height: number) {
        const contentNode = new Node('Content');
        contentNode.setParent(this.panelNode);
        contentNode.setPosition(0, 0, 0);

        // 计算三个区域的宽度（各占33%）
        const areaWidth = width / 3; // 每个区域占1/3宽度
        
        // 左侧：单位图标区域（33%宽度）
        // 左侧区域范围：从 -width/2 到 -width/2 + areaWidth，中心在 -width/2 + areaWidth/2
        this.iconNode = new Node('Icon');
        this.iconNode.setParent(contentNode);
        const iconTransform = this.iconNode.addComponent(UITransform);
        iconTransform.setContentSize(areaWidth, height * 0.8);
        // 图标位置：左侧区域中心
        this.iconNode.setPosition(-width / 2 + areaWidth / 2, 0, 0);
        const iconSprite = this.iconNode.addComponent(Sprite);
        iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;

        // 中间：属性信息区域（33%宽度）
        // 中间区域范围：从 -width/6 到 width/6，中心在 0
        const infoNode = new Node('Info');
        infoNode.setParent(contentNode);
        const infoTransform = infoNode.addComponent(UITransform);
        infoTransform.setContentSize(areaWidth, height);
        // 信息区域位置：中间区域中心（面板中心）
        infoNode.setPosition(0, 0, 0);

        // infoNode的左边缘位置（相对于infoNode中心）
        const infoLeftEdge = 0;//-areaWidth / 2;
        const labelLeftPadding = 10; // 左对齐时的内边距
        const labelX = infoLeftEdge + labelLeftPadding; // 标签的x坐标（左对齐）

        // 名称
        this.nameLabel = this.createLabel('Name', '单位名称', 24, new Color(255, 255, 255, 255));
        this.nameLabel.node.setParent(infoNode);
        // 设置名称标签支持多行显示
        const nameLabelTransform = this.nameLabel.node.getComponent(UITransform);
        if (nameLabelTransform) {
            // 设置宽度，高度限制为从当前位置到面板底部的距离
            const maxHeight = height / 2 + 20 - 10; // 从当前位置向下到面板底部，留出10像素边距
            nameLabelTransform.setContentSize(areaWidth - labelLeftPadding * 2, maxHeight);
            // 设置锚点为顶部中心(0.5, 1)，这样文本从顶部开始显示，向下扩展
            nameLabelTransform.setAnchorPoint(0.5, 1);
        }
        // 位置设置为居中（x=0相对于infoNode中心），和属性标签的x坐标对齐方式一致
        this.nameLabel.node.setPosition(0, height / 2 - 20, 0);
        // 设置水平居中对齐
        this.nameLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.nameLabel.overflow = Label.Overflow.RESIZE_HEIGHT; // 允许高度自适应
        this.nameLabel.verticalAlign = Label.VerticalAlign.TOP; // 文本顶部对齐

        // 等级
        this.levelLabel = this.createLabel('Level', '等级: 1', 18, new Color(200, 200, 200, 255));
        this.levelLabel.node.setParent(infoNode);
        this.levelLabel.node.setPosition(labelX, height / 2 - 80, 0);

        // 生命值
        this.healthLabel = this.createLabel('Health', '生命值: 100/100', 18, new Color(200, 200, 200, 255));
        this.healthLabel.node.setParent(infoNode);
        this.healthLabel.node.setPosition(labelX, height / 2 - 110, 0);

        // 攻击力
        this.attackLabel = this.createLabel('Attack', '攻击力: 10', 18, new Color(200, 200, 200, 255));
        this.attackLabel.node.setParent(infoNode);
        this.attackLabel.node.setPosition(labelX, height / 2 - 140, 0);

        // 训练单位数量（建筑物）
        this.unitCountLabel = this.createLabel('UnitCount', '训练单位: 0/0', 18, new Color(200, 200, 200, 255));
        this.unitCountLabel.node.setParent(infoNode);
        this.unitCountLabel.node.setPosition(labelX, height / 2 - 170, 0);
        this.unitCountLabel.node.active = false;

        // 治疗量（建筑物）
        this.healAmountLabel = this.createLabel('HealAmount', '治疗量: 0', 18, new Color(200, 200, 200, 255));
        this.healAmountLabel.node.setParent(infoNode);
        this.healAmountLabel.node.setPosition(labelX, height / 2 - 200, 0);
        this.healAmountLabel.node.active = false;

        // 治疗速度（建筑物）
        this.healSpeedLabel = this.createLabel('HealSpeed', '治疗速度: 0/秒', 18, new Color(200, 200, 200, 255));
        this.healSpeedLabel.node.setParent(infoNode);
        this.healSpeedLabel.node.setPosition(labelX, height / 2 - 230, 0);
        this.healSpeedLabel.node.active = false;

        // 攻击频率（防御单位）
        this.attackFrequencyLabel = this.createLabel('AttackFrequency', '攻击频率: 0/秒', 18, new Color(200, 200, 200, 255));
        this.attackFrequencyLabel.node.setParent(infoNode);
        this.attackFrequencyLabel.node.setPosition(labelX, height / 2 - 170, 0);
        this.attackFrequencyLabel.node.active = false;

        // 移动速度（防御单位）
        this.moveSpeedLabel = this.createLabel('MoveSpeed', '移动速度: 0', 18, new Color(200, 200, 200, 255));
        this.moveSpeedLabel.node.setParent(infoNode);
        this.moveSpeedLabel.node.setPosition(labelX, height / 2 - 200, 0);
        this.moveSpeedLabel.node.active = false;

        // 集结点（建筑物）
        this.rallyPointLabel = this.createLabel('RallyPoint', '集结点: 未设置', 18, new Color(200, 200, 200, 255));
        this.rallyPointLabel.node.setParent(infoNode);
        this.rallyPointLabel.node.setPosition(labelX, height / 2 - 260, 0);
        this.rallyPointLabel.node.active = false;

        // 右侧：九宫格按钮区域（33%宽度）
        // 右侧区域范围：从 width/6 到 width/2，中心在 width/2 - areaWidth/2 = width/3
        this.createButtonGrid(contentNode, width, height, areaWidth);
    }

    /**
     * 创建九宫格按钮区域
     */
    createButtonGrid(parentNode: Node, panelWidth: number, panelHeight: number, buttonAreaWidth: number) {
        // 创建按钮区域节点
        this.buttonGridNode = new Node('ButtonGrid');
        this.buttonGridNode.setParent(parentNode);
        const gridTransform = this.buttonGridNode.addComponent(UITransform);
        gridTransform.setContentSize(buttonAreaWidth, panelHeight);
        // 按钮区域位置：右侧区域中心（相对于父节点），整体往上移10像素
        this.buttonGridNode.setPosition(panelWidth / 2 - buttonAreaWidth / 2, 10, 0);

        // 按钮大小和间距
        const buttonSize = Math.min(buttonAreaWidth / 3.5, panelHeight / 3.5); // 按钮大小
        const spacing = buttonSize * 0.2; // 按钮间距
        const startX = -buttonAreaWidth / 2 + buttonSize / 2 + spacing;
        const startY = panelHeight / 2 - buttonSize / 2 - spacing;

        // 创建9个按钮（3x3网格）
        this.buttonNodes = [];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const buttonIndex = row * 3 + col;
                const buttonNode = new Node(`Button${buttonIndex}`);
                buttonNode.setParent(this.buttonGridNode);
                
                const buttonTransform = buttonNode.addComponent(UITransform);
                buttonTransform.setContentSize(buttonSize, buttonSize);
                
                const x = startX + col * (buttonSize + spacing);
                const y = startY - row * (buttonSize + spacing);
                buttonNode.setPosition(x, y, 0);

                // 添加按钮Sprite组件（用于显示贴图）
                const buttonSprite = buttonNode.addComponent(Sprite);
                buttonSprite.sizeMode = Sprite.SizeMode.CUSTOM;
                this.buttonSprites.set(buttonIndex, buttonSprite);

                // 添加按钮组件（用于点击检测）
                const button = buttonNode.addComponent(Button);
                button.transition = Button.Transition.NONE; // 不使用默认过渡

                // 添加标签节点（隐藏，不显示文字）
                const labelNode = new Node('Label');
                labelNode.setParent(buttonNode);
                labelNode.active = false; // 隐藏标签，因为使用贴图
                const label = labelNode.addComponent(Label);
                label.string = '';
                label.fontSize = 14;
                label.color = Color.WHITE;

                // 为升级按钮（索引2）创建费用标签
                if (buttonIndex === 2) {
                    const costLabelNode = new Node('CostLabel');
                    costLabelNode.setParent(buttonNode);
                    const costLabelTransform = costLabelNode.addComponent(UITransform);
                    costLabelTransform.setContentSize(buttonSize, 20);
                    costLabelNode.setPosition(0, -buttonSize / 2 - 5, 0); // 按钮下方
                    const costLabel = costLabelNode.addComponent(Label);
                    costLabel.string = '';
                    costLabel.fontSize = 14;
                    costLabel.color = new Color(255, 255, 0, 255); // 黄色
                    costLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
                    costLabel.verticalAlign = Label.VerticalAlign.CENTER;
                    costLabelNode.active = false; // 默认隐藏
                }

                this.buttonNodes.push(buttonNode);
            }
        }
    }

    /**
     * 加载按钮贴图
     * @param buttonIndex 按钮索引
     * @param normalPath 正常状态贴图路径（相对于textures/icon目录，如 "up.png"）
     * @param downPath 按下状态贴图路径（如 "up_down.png"）
     */
    private loadButtonSprite(buttonIndex: number, normalPath: string, downPath: string) {
        const sprite = this.buttonSprites.get(buttonIndex);
        if (!sprite) {
            return;
        }

        // 移除文件扩展名，构建资源路径
        const normalPathWithoutExt = normalPath.replace(/\.(png|jpg|jpeg)$/i, '');
        const normalResourcePath = `textures/icon/${normalPathWithoutExt}/spriteFrame`;
        
        resources.load(normalResourcePath, SpriteFrame, (err, spriteFrame) => {
            if (err) {
                console.error(`Failed to load button sprite: ${normalPath} (path: ${normalResourcePath})`, err);
                return;
            }
            if (sprite && sprite.node && sprite.node.isValid && spriteFrame) {
                this.buttonNormalSprites.set(buttonIndex, spriteFrame);
                // 根据按钮类型设置初始贴图
                if (buttonIndex === 1 && this.defendButtonPressed) {
                    // 防御按钮且处于按下状态，使用按下贴图（按下贴图会在加载后设置）
                    // 如果按下贴图已经加载，立即设置
                    const downSprite = this.buttonDownSprites.get(buttonIndex);
                    if (downSprite) {
                        sprite.spriteFrame = downSprite;
                    } else {
                        sprite.spriteFrame = spriteFrame; // 临时使用正常贴图，等按下贴图加载后切换
                    }
                } else {
                    sprite.spriteFrame = spriteFrame;
                }
            }
        });

        // 加载按下状态贴图
        const downPathWithoutExt = downPath.replace(/\.(png|jpg|jpeg)$/i, '');
        const downResourcePath = `textures/icon/${downPathWithoutExt}/spriteFrame`;
        
        resources.load(downResourcePath, SpriteFrame, (err, downSpriteFrame) => {
            if (err) {
                console.error(`Failed to load button down sprite: ${downPath} (path: ${downResourcePath})`, err);
                return;
            }
            if (downSpriteFrame) {
                this.buttonDownSprites.set(buttonIndex, downSpriteFrame);
                // 如果是防御按钮且处于按下状态，设置按下贴图
                if (buttonIndex === 1 && this.defendButtonPressed && sprite && sprite.node && sprite.node.isValid) {
                    sprite.spriteFrame = downSpriteFrame;
                }
            }
        });
    }

    /**
     * 创建标签（左对齐）
     */
    createLabel(name: string, text: string, fontSize: number, color: Color): Label {
        const labelNode = new Node(name);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.color = color;
        // 设置左对齐
        label.horizontalAlign = Label.HorizontalAlign.LEFT;
        return label;
    }

    /**
     * 显示单位信息（单选）
     */
    showUnitInfo(unitInfo: UnitInfo) {
        console.info(`[UnitInfoPanel] showUnitInfo 被调用: 单位=${unitInfo.name}, currentHealth=${unitInfo.currentHealth}, maxHealth=${unitInfo.maxHealth}, attackDamage=${unitInfo.attackDamage}, attackFrequency=${unitInfo.attackFrequency}`);
        
        if (!this.panelNode) {
            this.initPanel();
        }

        // 保存当前单位信息
        this.currentUnitInfo = unitInfo;
        this.currentSelectedUnits = [];
        this.isMultiSelection = false;

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
            // 判断是否满级：如果提供了maxLevel，则使用它；否则默认使用3级
            const maxLevel = unitInfo.maxLevel !== undefined ? unitInfo.maxLevel : 3;
            const levelText = unitInfo.level >= maxLevel ? `等级: ${unitInfo.level}（满级）` : `等级: ${unitInfo.level}`;
            this.levelLabel.string = levelText;
            this.levelLabel.node.active = true; // 确保等级标签显示
        }

        // 更新生命值
        if (this.healthLabel) {
            // 检查生命值是否有效
            if (unitInfo.currentHealth !== undefined && unitInfo.maxHealth !== undefined && 
                !isNaN(unitInfo.currentHealth) && !isNaN(unitInfo.maxHealth) &&
                unitInfo.currentHealth >= 0 && unitInfo.maxHealth > 0) {
                this.healthLabel.string = `生命值: ${unitInfo.currentHealth}/${unitInfo.maxHealth}`;
                this.healthLabel.node.active = true;
            } else {
                console.warn(`[UnitInfoPanel] showUnitInfo() 生命值无效: currentHealth=${unitInfo.currentHealth}, maxHealth=${unitInfo.maxHealth}`);
                this.healthLabel.string = `生命值: 0/0`;
                this.healthLabel.node.active = true;
            }
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

        // 占用人口标签已移除，不再显示

        // 更新建筑物属性
        if (this.unitCountLabel) {
            if (unitInfo.currentUnitCount !== undefined && unitInfo.maxUnitCount !== undefined) {
                this.unitCountLabel.string = `训练单位: ${unitInfo.currentUnitCount}/${unitInfo.maxUnitCount}`;
                this.unitCountLabel.node.active = true;
            } else {
                this.unitCountLabel.node.active = false;
            }
        }

        if (this.healAmountLabel) {
            if (unitInfo.healAmount !== undefined && unitInfo.healAmount > 0) {
                this.healAmountLabel.string = `治疗量: ${unitInfo.healAmount}`;
                this.healAmountLabel.node.active = true;
            } else {
                this.healAmountLabel.node.active = false;
            }
        }

        if (this.healSpeedLabel) {
            if (unitInfo.healSpeed !== undefined && unitInfo.healSpeed > 0) {
                this.healSpeedLabel.string = `治疗速度: ${unitInfo.healSpeed.toFixed(2)}/秒`;
                this.healSpeedLabel.node.active = true;
            } else {
                this.healSpeedLabel.node.active = false;
            }
        }

        // 更新防御单位属性
        if (this.attackFrequencyLabel) {
            if (unitInfo.attackFrequency !== undefined && unitInfo.attackFrequency > 0) {
                this.attackFrequencyLabel.string = `攻击频率: ${unitInfo.attackFrequency.toFixed(2)}/秒`;
                this.attackFrequencyLabel.node.active = true;
            } else {
                this.attackFrequencyLabel.node.active = false;
            }
        }

        if (this.moveSpeedLabel) {
            if (unitInfo.moveSpeed !== undefined && unitInfo.moveSpeed > 0) {
                this.moveSpeedLabel.string = `移动速度: ${unitInfo.moveSpeed}`;
                this.moveSpeedLabel.node.active = true;
            } else {
                this.moveSpeedLabel.node.active = false;
            }
        }

        // 更新集结点显示（建筑物）
        if (this.rallyPointLabel) {
            if (unitInfo.rallyPoint !== undefined && unitInfo.rallyPoint !== null) {
                this.rallyPointLabel.string = `集结点: (${Math.floor(unitInfo.rallyPoint.x)}, ${Math.floor(unitInfo.rallyPoint.y)})`;
                this.rallyPointLabel.node.active = true;
            } else {
                this.rallyPointLabel.string = '集结点: 未设置';
                this.rallyPointLabel.node.active = true; // 即使未设置也显示
            }
        }

        // 确保按钮网格节点可见
        if (this.buttonGridNode) {
            this.buttonGridNode.active = true;
        }

        // 更新按钮
        this.updateButtons(unitInfo);

        // 显示面板
        this.show();
    }

    /**
     * 获取单位名称（辅助方法）
     */
    private getUnitName(unitNode: Node): string {
        if (!unitNode || !unitNode.isValid) {
            return '未知单位';
        }

        // 尝试从Role组件获取单位名称
        const roleScript = unitNode.getComponent('Role') as any;
        if (roleScript && roleScript.unitName) {
            return roleScript.unitName;
        }

        // 备用方案：尝试从各种单位类型获取名称
        const arrowerScript = unitNode.getComponent('Arrower') as any;
        if (arrowerScript && arrowerScript.unitName) {
            return arrowerScript.unitName;
        }

        const hunterScript = unitNode.getComponent('Hunter') as any;
        if (hunterScript && hunterScript.unitName) {
            return hunterScript.unitName;
        }

        const swordsmanScript = unitNode.getComponent('ElfSwordsman') as any;
        if (swordsmanScript && swordsmanScript.unitName) {
            return swordsmanScript.unitName;
        }

        const priestScript = unitNode.getComponent('Priest') as any;
        if (priestScript && priestScript.unitName) {
            return priestScript.unitName;
        }

        return '未知单位';
    }

    /**
     * 显示多个单位信息（多选）
     * @param firstUnitInfo 第一个单位的信息（用于显示）
     * @param selectedUnits 所有选中的单位节点数组
     */
    showMultipleUnitsInfo(firstUnitInfo: UnitInfo, selectedUnits: Node[]) {
        if (!this.panelNode) {
            console.info('[UnitInfoPanel] showMultipleUnitsInfo: panelNode不存在，初始化面板');
            this.initPanel();
        }

        // 保存当前单位信息和多选状态
        this.currentUnitInfo = firstUnitInfo;
        this.currentSelectedUnits = selectedUnits.filter(node => node && node.isValid && node.active);
        this.isMultiSelection = this.currentSelectedUnits.length > 1;

        // 更新图标（使用第一个单位的图标）
        if (this.iconNode) {
            const iconSprite = this.iconNode.getComponent(Sprite);
            if (iconSprite && firstUnitInfo.icon) {
                iconSprite.spriteFrame = firstUnitInfo.icon;
            }
        }

        // 统计每种单位的数量
        const unitCountMap = new Map<string, number>();
        for (const unitNode of this.currentSelectedUnits) {
            const unitName = this.getUnitName(unitNode);
            unitCountMap.set(unitName, (unitCountMap.get(unitName) || 0) + 1);
        }

        // 更新名称显示
        if (this.nameLabel) {
            if (unitCountMap.size === 1) {
                // 只有一种单位，显示：单位名称（数量）
                const unitName = Array.from(unitCountMap.keys())[0];
                const count = unitCountMap.get(unitName) || 0;
                this.nameLabel.string = `${unitName} (${count})`;
            } else {
                // 多种单位，换行显示每种单位的名称和数量
                const lines: string[] = [];
                for (const [unitName, count] of unitCountMap.entries()) {
                    lines.push(`${unitName} (${count})`);
                }
                this.nameLabel.string = lines.join('\n');
            }
        }

        // 隐藏等级、生命值、攻击力
        if (this.levelLabel) {
            this.levelLabel.node.active = false;
        }
        if (this.healthLabel) {
            this.healthLabel.node.active = false;
        }
        if (this.attackLabel) {
            this.attackLabel.node.active = false;
        }

        // 隐藏建筑物特有属性（多选时通常不显示）
        if (this.unitCountLabel) {
            this.unitCountLabel.node.active = false;
        }
        if (this.healAmountLabel) {
            this.healAmountLabel.node.active = false;
        }
        if (this.healSpeedLabel) {
            this.healSpeedLabel.node.active = false;
        }
        if (this.attackFrequencyLabel) {
            this.attackFrequencyLabel.node.active = false;
        }
        if (this.moveSpeedLabel) {
            this.moveSpeedLabel.node.active = false;
        }
        if (this.rallyPointLabel) {
            this.rallyPointLabel.node.active = false;
        }

        // 确保按钮网格节点可见
        if (this.buttonGridNode) {
            this.buttonGridNode.active = true;
        }

        // 更新按钮（支持批量操作）
        this.updateButtonsForMultiSelection(firstUnitInfo);

        // 显示面板
        this.show();
    }

    /**
     * 更新按钮显示和功能
     */
    updateButtons(unitInfo: UnitInfo) {
        if (!this.buttonNodes || this.buttonNodes.length < 9) {
            return;
        }

        // 清除所有按钮的点击事件和隐藏所有按钮
        for (let i = 0; i < this.buttonNodes.length; i++) {
            const buttonNode = this.buttonNodes[i];
            buttonNode.active = false; // 默认隐藏
            buttonNode.off(Node.EventType.TOUCH_END);
            buttonNode.off(Node.EventType.TOUCH_START); // 也清除TOUCH_START事件
            const labelNode = buttonNode.getChildByName('Label');
            if (labelNode) {
                labelNode.active = false; // 隐藏标签
            }
            // 隐藏费用标签
            const costLabelNode = buttonNode.getChildByName('CostLabel');
            if (costLabelNode) {
                costLabelNode.active = false;
            }
        }

        // 设置集结点按钮（位置：左上角，索引0）
        if (unitInfo.onRallyPointClick && this.buttonNodes[0]) {
            const rallyButton = this.buttonNodes[0];
            rallyButton.active = true;
            
            // 加载集结点按钮贴图
            this.loadButtonSprite(0, 'uni.png', 'uni_down.png');
            
            // 设置点击事件，点击时切换贴图
            rallyButton.on(Node.EventType.TOUCH_START, () => {
                const sprite = this.buttonSprites.get(0);
                const downSprite = this.buttonDownSprites.get(0);
                if (sprite && downSprite && sprite.node && sprite.node.isValid) {
                    sprite.spriteFrame = downSprite;
                }
            });
            
            rallyButton.on(Node.EventType.TOUCH_END, () => {
                const sprite = this.buttonSprites.get(0);
                const normalSprite = this.buttonNormalSprites.get(0);
                if (sprite && normalSprite && sprite.node && sprite.node.isValid) {
                    sprite.spriteFrame = normalSprite;
                }
                if (unitInfo.onRallyPointClick) {
                    unitInfo.onRallyPointClick();
                }
            });
        }

        // 设置防御按钮（位置：第一行第二列，索引1）
        if (unitInfo.onDefendClick && this.buttonNodes[1]) {
            const defendButton = this.buttonNodes[1];
            defendButton.active = true;
            
            // 根据isDefending状态设置初始按下状态
            this.defendButtonPressed = unitInfo.isDefending === true;
            
            // 加载防御按钮贴图
            this.loadButtonSprite(1, 'defense.png', 'defense_down.png');
            
            // 如果贴图已经加载，立即设置正确的状态
            const sprite = this.buttonSprites.get(1);
            if (sprite && sprite.node && sprite.node.isValid) {
                if (this.defendButtonPressed) {
                    const downSprite = this.buttonDownSprites.get(1);
                    if (downSprite) {
                        sprite.spriteFrame = downSprite;
                    }
                } else {
                    const normalSprite = this.buttonNormalSprites.get(1);
                    if (normalSprite) {
                        sprite.spriteFrame = normalSprite;
                    }
                }
            }
            
            // 设置点击事件，点击后切换状态并保持
            defendButton.on(Node.EventType.TOUCH_END, () => {
                // 切换防御按钮的按下状态
                this.defendButtonPressed = !this.defendButtonPressed;
                
                const sprite = this.buttonSprites.get(1);
                if (sprite && sprite.node && sprite.node.isValid) {
                    if (this.defendButtonPressed) {
                        const downSprite = this.buttonDownSprites.get(1);
                        if (downSprite) {
                            sprite.spriteFrame = downSprite;
                        }
                    } else {
                        const normalSprite = this.buttonNormalSprites.get(1);
                        if (normalSprite) {
                            sprite.spriteFrame = normalSprite;
                        }
                    }
                }
                
                if (unitInfo.onDefendClick) {
                    unitInfo.onDefendClick();
                }
            });
        }
        
        // 设置升级按钮（位置：右上角，索引2）
        if (unitInfo.onUpgradeClick && this.buttonNodes[2]) {
            const upgradeButton = this.buttonNodes[2];
            upgradeButton.active = true;
            
            // 显示升级费用标签
            const costLabelNode = upgradeButton.getChildByName('CostLabel');
            if (costLabelNode) {
                const costLabel = costLabelNode.getComponent(Label);
                if (costLabel && unitInfo.upgradeCost !== undefined) {
                    costLabel.string = `${unitInfo.upgradeCost}`;
                    costLabelNode.active = true;
                } else {
                    costLabelNode.active = false;
                }
            }
            
            // 加载升级按钮贴图
            this.loadButtonSprite(2, 'up.png', 'up_down.png');
            
            // 设置点击事件，点击时切换贴图
            upgradeButton.on(Node.EventType.TOUCH_START, () => {
                const sprite = this.buttonSprites.get(2);
                const downSprite = this.buttonDownSprites.get(2);
                if (sprite && downSprite && sprite.node && sprite.node.isValid) {
                    sprite.spriteFrame = downSprite;
                }
            });
            
            upgradeButton.on(Node.EventType.TOUCH_END, () => {
                const sprite = this.buttonSprites.get(2);
                const normalSprite = this.buttonNormalSprites.get(2);
                if (sprite && normalSprite && sprite.node && sprite.node.isValid) {
                    sprite.spriteFrame = normalSprite;
                }
                if (unitInfo.onUpgradeClick) {
                    unitInfo.onUpgradeClick();
                }
            });
        } else if (this.buttonNodes[2]) {
            // 如果没有升级按钮，隐藏费用标签
            const upgradeButton = this.buttonNodes[2];
            const costLabelNode = upgradeButton.getChildByName('CostLabel');
            if (costLabelNode) {
                costLabelNode.active = false;
            }
        }

        // 训练小精灵按钮已移除，训练改为由生命之树自动进行

        // 设置回收按钮（位置：右下，索引8）
        if (unitInfo.onSellClick && this.buttonNodes[8]) {
            const sellButton = this.buttonNodes[8];
            sellButton.active = true;
            
            // 加载回收按钮贴图
            this.loadButtonSprite(8, 'cancel.png', 'cancel_down.png');
            
            // 设置点击事件，点击时切换贴图
            sellButton.on(Node.EventType.TOUCH_START, () => {
                const sprite = this.buttonSprites.get(8);
                const downSprite = this.buttonDownSprites.get(8);
                if (sprite && downSprite && sprite.node && sprite.node.isValid) {
                    sprite.spriteFrame = downSprite;
                }
            });
            
            sellButton.on(Node.EventType.TOUCH_END, () => {
                const sprite = this.buttonSprites.get(8);
                const normalSprite = this.buttonNormalSprites.get(8);
                if (sprite && normalSprite && sprite.node && sprite.node.isValid) {
                    sprite.spriteFrame = normalSprite;
                }
                if (unitInfo.onSellClick) {
                    unitInfo.onSellClick();
                }
            });
        }


        // 其余按钮暂时置空（已默认清空）
    }

    /**
     * 更新按钮显示和功能（多选模式）
     */
    updateButtonsForMultiSelection(firstUnitInfo: UnitInfo) {
        if (!this.buttonNodes || this.buttonNodes.length < 9) {
            return;
        }

        // 清除所有按钮的点击事件和隐藏所有按钮
        for (let i = 0; i < this.buttonNodes.length; i++) {
            const buttonNode = this.buttonNodes[i];
            buttonNode.active = false; // 默认隐藏
            buttonNode.off(Node.EventType.TOUCH_END);
            buttonNode.off(Node.EventType.TOUCH_START);
            const labelNode = buttonNode.getChildByName('Label');
            if (labelNode) {
                labelNode.active = false;
            }
            // 隐藏费用标签
            const costLabelNode = buttonNode.getChildByName('CostLabel');
            if (costLabelNode) {
                costLabelNode.active = false;
            }
        }

        // 设置防御按钮（位置：第一行第二列，索引1）
        if (firstUnitInfo.onDefendClick && this.buttonNodes[1]) {
            const defendButton = this.buttonNodes[1];
            defendButton.active = true;
            
            // 检查所有单位是否都处于防御状态
            let allDefending = true;
            for (const unitNode of this.currentSelectedUnits) {
                if (!unitNode || !unitNode.isValid) continue;
                const unitScript = unitNode.getComponent('Arrower') as any ||
                                  unitNode.getComponent('Hunter') as any ||
                                  unitNode.getComponent('ElfSwordsman') as any ||
                                  unitNode.getComponent('Priest') as any;
                if (unitScript && unitScript.isDefending !== undefined && !unitScript.isDefending) {
                    allDefending = false;
                    break;
                }
            }
            
            this.defendButtonPressed = allDefending;
            
            // 加载防御按钮贴图
            this.loadButtonSprite(1, 'defense.png', 'defense_down.png');
            
            // 如果贴图已经加载，立即设置正确的状态
            const sprite = this.buttonSprites.get(1);
            if (sprite && sprite.node && sprite.node.isValid) {
                if (this.defendButtonPressed) {
                    const downSprite = this.buttonDownSprites.get(1);
                    if (downSprite) {
                        sprite.spriteFrame = downSprite;
                    }
                } else {
                    const normalSprite = this.buttonNormalSprites.get(1);
                    if (normalSprite) {
                        sprite.spriteFrame = normalSprite;
                    }
                }
            }
            
            // 设置点击事件，批量切换防御状态
            defendButton.on(Node.EventType.TOUCH_END, () => {
                // 切换防御按钮的按下状态
                this.defendButtonPressed = !this.defendButtonPressed;
                
                const sprite = this.buttonSprites.get(1);
                if (sprite && sprite.node && sprite.node.isValid) {
                    if (this.defendButtonPressed) {
                        const downSprite = this.buttonDownSprites.get(1);
                        if (downSprite) {
                            sprite.spriteFrame = downSprite;
                        }
                    } else {
                        const normalSprite = this.buttonNormalSprites.get(1);
                        if (normalSprite) {
                            sprite.spriteFrame = normalSprite;
                        }
                    }
                }
                
                // 批量设置防御状态
                this.batchDefend(this.defendButtonPressed);
            });
        }
        
        // 设置升级按钮（位置：右上角，索引2）
        if (firstUnitInfo.onUpgradeClick && this.buttonNodes[2]) {
            const upgradeButton = this.buttonNodes[2];
            upgradeButton.active = true;
            
            // 显示升级费用标签
            const costLabelNode = upgradeButton.getChildByName('CostLabel');
            if (costLabelNode) {
                const costLabel = costLabelNode.getComponent(Label);
                if (costLabel && firstUnitInfo.upgradeCost !== undefined) {
                    costLabel.string = `${firstUnitInfo.upgradeCost}`;
                    costLabelNode.active = true;
                } else {
                    costLabelNode.active = false;
                }
            }
            
            // 加载升级按钮贴图
            this.loadButtonSprite(2, 'up.png', 'up_down.png');
            
            // 设置点击事件，批量升级
            upgradeButton.on(Node.EventType.TOUCH_START, () => {
                const sprite = this.buttonSprites.get(2);
                const downSprite = this.buttonDownSprites.get(2);
                if (sprite && downSprite && sprite.node && sprite.node.isValid) {
                    sprite.spriteFrame = downSprite;
                }
            });
            
            upgradeButton.on(Node.EventType.TOUCH_END, () => {
                const sprite = this.buttonSprites.get(2);
                const normalSprite = this.buttonNormalSprites.get(2);
                if (sprite && normalSprite && sprite.node && sprite.node.isValid) {
                    sprite.spriteFrame = normalSprite;
                }
                // 批量升级
                this.batchUpgrade();
            });
        }

        // 设置回收按钮（位置：右下，索引8）
        if (firstUnitInfo.onSellClick && this.buttonNodes[8]) {
            const sellButton = this.buttonNodes[8];
            sellButton.active = true;
            
            // 加载回收按钮贴图
            this.loadButtonSprite(8, 'cancel.png', 'cancel_down.png');
            
            // 设置点击事件，批量回收
            sellButton.on(Node.EventType.TOUCH_START, () => {
                const sprite = this.buttonSprites.get(8);
                const downSprite = this.buttonDownSprites.get(8);
                if (sprite && downSprite && sprite.node && sprite.node.isValid) {
                    sprite.spriteFrame = downSprite;
                }
            });
            
            sellButton.on(Node.EventType.TOUCH_END, () => {
                const sprite = this.buttonSprites.get(8);
                const normalSprite = this.buttonNormalSprites.get(8);
                if (sprite && normalSprite && sprite.node && sprite.node.isValid) {
                    sprite.spriteFrame = normalSprite;
                }
                // 批量回收
                this.batchSell();
            });
        }
    }

    /**
     * 批量升级（金币不足时先升级先选中的单位）
     */
    private batchUpgrade() {
        if (this.currentSelectedUnits.length === 0) {
            console.info('[UnitInfoPanel] batchUpgrade: 没有选中的单位');
            return;
        }

        // 保存当前选中的单位列表（防止升级时被清除）
        const unitsToUpgrade = this.currentSelectedUnits.slice();
        
        // 获取GameManager（尝试多种路径）
        let gameManagerNode = find('Canvas/GameManager') || find('GameManager');
        // }
        
        if (!gameManagerNode) {
            console.error('[UnitInfoPanel] batchUpgrade: 找不到GameManager节点');
            return;
        }
        const gameManager = gameManagerNode.getComponent('GameManager') as any;
        if (!gameManager) {
            console.error('[UnitInfoPanel] batchUpgrade: 找不到GameManager组件');
            return;
        }

        // 获取UnitSelectionManager，用于恢复多选状态（尝试多种路径）
        let unitSelectionManagerNode = find('Canvas/UnitSelectionManager') || find('UnitSelectionManager');
        
        let unitSelectionManager: any = null;
        if (unitSelectionManagerNode) {
            unitSelectionManager = unitSelectionManagerNode.getComponent('UnitSelectionManager');
        }

        // 按选择顺序升级（先选中的先升级）
        let upgradedCount = 0;
        const upgradedUnits: Node[] = [];
        
        for (const unitNode of unitsToUpgrade) {
            if (!unitNode || !unitNode.isValid || !unitNode.active) {
                console.info('[UnitInfoPanel] batchUpgrade: 单位节点无效，跳过');
                continue;
            }

            // 所有单位都继承自Role，直接获取Role组件
            let unitScript = unitNode.getComponent('Role') as any;
            
            // 如果获取不到Role组件，尝试获取具体的子类组件（Arrower、Hunter等都继承自Role）
            if (!unitScript) {
                unitScript = unitNode.getComponent('Arrower') as any ||
                             unitNode.getComponent('Hunter') as any ||
                             unitNode.getComponent('ElfSwordsman') as any ||
                             unitNode.getComponent('Priest') as any;
            }
            
            if (!unitScript) {
                console.info('[UnitInfoPanel] batchUpgrade: 无法获取单位脚本，单位名称 =', unitNode.name);
                continue;
            }
            
            if (!unitScript.onUpgradeClick) {
                console.info('[UnitInfoPanel] batchUpgrade: 单位没有onUpgradeClick方法，单位名称 =', unitNode.name);
                continue;
            }

            // 检查是否有足够的金币
            // 升级费用：1到2级是10金币，此后每次升级多10金币
            // 公式：10 + (level - 1) * 10
            const currentLevel = unitScript.level || 1;
            const upgradeCost = 10 + (currentLevel - 1) * 10;
            if (upgradeCost > 0) {
                // 检查gameManager是否存在canAfford方法
                if (!gameManager.canAfford) {
                    console.error('[UnitInfoPanel] batchUpgrade: GameManager没有canAfford方法');
                    continue;
                }
                
                // 检查金币是否足够
                if (!gameManager.canAfford(upgradeCost)) {
                    console.info('[UnitInfoPanel] batchUpgrade: 金币不足，跳过单位，单位名称 =', unitNode.name, '，升级费用 =', upgradeCost, '，当前金币 =', gameManager.gold);
                    // 金币不足，跳过这个单位，继续下一个
                    continue;
                }
            }
            
            // 保存升级前的等级，用于判断是否真的升级了
            const levelBeforeUpgrade = unitScript.level || 1;
            
            try {
                // 临时保存unitSelectionManager的引用，防止hideSelectionPanel清除选择
                const originalUnitSelectionManager = unitScript.unitSelectionManager;
                
                // 执行升级（onUpgradeClick内部会检查金币并消耗）
                unitScript.onUpgradeClick();
                
                // 检查是否真的升级了（通过等级变化判断）
                const levelAfterUpgrade = unitScript.level || 1;
                if (levelAfterUpgrade > levelBeforeUpgrade) {
                    upgradedCount++;
                    upgradedUnits.push(unitNode);
                } else {
                    console.warn('[UnitInfoPanel] batchUpgrade: 升级失败，单位名称 =', unitNode.name, '，等级未变化');
                }
                
                // 如果升级后选择被清除，恢复多选状态
                if (unitSelectionManager && this.currentSelectedUnits.length === 0) {
                    // 重新选择所有单位（包括已升级的）
                    const allUnits = unitsToUpgrade.filter(u => u && u.isValid && u.active);
                    if (allUnits.length > 0) {
                        unitSelectionManager.selectMultipleUnits(allUnits);
                    }
                }
                
                upgradedCount++;
                upgradedUnits.push(unitNode);
            } catch (error) {
                console.error('[UnitInfoPanel] batchUpgrade: 升级失败，单位名称 =', unitNode.name, '，错误 =', error);
            }
        }
        
        // 如果升级后选择被清除，恢复多选状态
        if (unitSelectionManager && this.currentSelectedUnits.length === 0 && upgradedUnits.length > 0) {
            // 重新选择所有单位（包括已升级的和未升级的）
            const allUnits = unitsToUpgrade.filter(u => u && u.isValid && u.active);
            if (allUnits.length > 0) {
                unitSelectionManager.selectMultipleUnits(allUnits);
            }
        }
        
    }

    /**
     * 批量回收
     */
    private batchSell() {
        if (this.currentSelectedUnits.length === 0) {
            return;
        }

        // 按选择顺序回收所有单位
        for (const unitNode of this.currentSelectedUnits) {
            if (!unitNode || !unitNode.isValid || !unitNode.active) {
                continue;
            }

            const unitScript = unitNode.getComponent('Arrower') as any ||
                              unitNode.getComponent('Hunter') as any ||
                              unitNode.getComponent('ElfSwordsman') as any ||
                              unitNode.getComponent('Priest') as any;
            
            if (unitScript && unitScript.onSellClick) {
                unitScript.onSellClick();
            }
        }

        // 回收完成后，隐藏面板
        this.hide();
    }

    /**
     * 批量设置防御状态
     */
    private batchDefend(defend: boolean) {
        if (this.currentSelectedUnits.length === 0) {
            return;
        }

        // 批量设置所有单位的防御状态
        for (const unitNode of this.currentSelectedUnits) {
            if (!unitNode || !unitNode.isValid || !unitNode.active) {
                continue;
            }

            const unitScript = unitNode.getComponent('Arrower') as any ||
                              unitNode.getComponent('Hunter') as any ||
                              unitNode.getComponent('ElfSwordsman') as any ||
                              unitNode.getComponent('Priest') as any;
            
            if (unitScript) {
                // 如果当前状态与目标状态不一致，才切换
                if (unitScript.isDefending !== undefined && unitScript.isDefending !== defend) {
                    // 直接设置防御状态
                    unitScript.isDefending = defend;
                    
                    if (defend) {
                        // 如果进入防御状态，清除手动移动目标并停止移动
                        if (unitScript.manualMoveTarget !== undefined) {
                            unitScript.manualMoveTarget = null!;
                        }
                        if (unitScript.isManuallyControlled !== undefined) {
                            unitScript.isManuallyControlled = false;
                        }
                        if (unitScript.stopMoving) {
                            unitScript.stopMoving();
                        }
                    } else {
                        // 如果取消防御状态，清除手动移动目标，让单位进入正常索敌模式
                        if (unitScript.manualMoveTarget !== undefined) {
                            unitScript.manualMoveTarget = null!;
                        }
                        if (unitScript.isManuallyControlled !== undefined) {
                            unitScript.isManuallyControlled = false;
                        }
                    }
                }
            }
        }
    }

    /**
     * 显示面板
     */
    show() {
        if (!this.panelNode) {
            console.info('[UnitInfoPanel] show: panelNode不存在，初始化面板');
            this.initPanel();
        }
        if (this.panelNode) {
            this.panelNode.active = true;
            console.info('[UnitInfoPanel] show: panelNode.active =', this.panelNode.active);
        } else {
            console.info('[UnitInfoPanel] show: panelNode不存在，无法显示面板');
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

        // 更新攻击力
        if (unitInfo.attackDamage !== undefined && this.attackLabel) {
            if (unitInfo.attackDamage > 0) {
                this.attackLabel.string = `攻击力: ${unitInfo.attackDamage}`;
                this.attackLabel.node.active = true;
            } else {
                this.attackLabel.node.active = false;
            }
        }

        // 更新训练单位数量
        if (unitInfo.currentUnitCount !== undefined && unitInfo.maxUnitCount !== undefined && this.unitCountLabel) {
            this.unitCountLabel.string = `训练单位: ${unitInfo.currentUnitCount}/${unitInfo.maxUnitCount}`;
        }

        // 更新当前单位信息（合并更新）
        if (this.currentUnitInfo) {
            Object.assign(this.currentUnitInfo, unitInfo);
            // 重新更新按钮（以防回调函数变化）
            this.updateButtons(this.currentUnitInfo);
        }
    }
}

