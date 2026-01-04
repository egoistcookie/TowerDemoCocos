import { _decorator, Component, Node, UITransform, Graphics, Color, Label, Sprite, SpriteFrame, find, EventTouch, Button, Vec3, resources } from 'cc';
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
        const panelTransform = this.panelNode.getComponent(UITransform) || this.panelNode.addComponent(UITransform);
        panelTransform.setContentSize(screenWidth, screenHeight / 6);
        this.panelNode.setPosition(0, -screenHeight / 2 + screenHeight / 12, 0);

        // 创建背景
        this.createBackground(screenWidth, screenHeight / 6);

        // 创建内容（左侧信息 + 右侧按钮）
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
        this.nameLabel.node.setPosition(labelX, height / 2 - 20, 0);

        // 等级
        this.levelLabel = this.createLabel('Level', '等级: 1', 18, new Color(200, 200, 200, 255));
        this.levelLabel.node.setParent(infoNode);
        this.levelLabel.node.setPosition(labelX, height / 2 - 50, 0);

        // 生命值
        this.healthLabel = this.createLabel('Health', '生命值: 100/100', 18, new Color(200, 200, 200, 255));
        this.healthLabel.node.setParent(infoNode);
        this.healthLabel.node.setPosition(labelX, height / 2 - 80, 0);

        // 攻击力
        this.attackLabel = this.createLabel('Attack', '攻击力: 10', 18, new Color(200, 200, 200, 255));
        this.attackLabel.node.setParent(infoNode);
        this.attackLabel.node.setPosition(labelX, height / 2 - 110, 0);

        // 人口
        this.populationLabel = this.createLabel('Population', '占用人口: 1', 18, new Color(200, 200, 200, 255));
        this.populationLabel.node.setParent(infoNode);
        this.populationLabel.node.setPosition(labelX, height / 2 - 140, 0);

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
        // 按钮区域位置：右侧区域中心（相对于父节点）
        this.buttonGridNode.setPosition(panelWidth / 2 - buttonAreaWidth / 2, 0, 0);

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
     * 显示单位信息
     */
    showUnitInfo(unitInfo: UnitInfo) {
        if (!this.panelNode) {
            this.initPanel();
        }

        // 保存当前单位信息
        this.currentUnitInfo = unitInfo;

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
        }

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

