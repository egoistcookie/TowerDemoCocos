import { _decorator, Component, Node, Button, Label, find, director, UITransform, Color, Graphics, tween, Vec3, UIOpacity, Sprite, SpriteFrame, Prefab, instantiate, assetManager, director as directorModule, resources } from 'cc';
import { UnitConfigManager } from './UnitConfigManager';
const { ccclass, property } = _decorator;

// 天赋类型
export enum TalentType {
    ATTACK_DAMAGE,    // 攻击力
    ATTACK_SPEED,     // 攻击速度
    HEALTH,           // 生命值
    MOVE_SPEED,       // 移动速度
    ARMOR             // 护甲
}

// 天赋数据结构
export interface Talent {
    id: string;
    name: string;
    description: string;
    type: TalentType;
    value: number;
    cost: number;
    level: number;
    maxLevel: number;
}

@ccclass('TalentSystem')
export class TalentSystem extends Component {
    @property(Node)
    talentPanel: Node = null!;
    
    @property(Prefab)
    arrowerPrefab: Prefab = null!;
    
    @property(SpriteFrame)
    cardBorderFrame: SpriteFrame = null!; // 卡片边框贴图（可在 Cocos Creator 编辑器中配置）
    
    @property(SpriteFrame)
    detailPanelBorderFrame: SpriteFrame = null!; // 详细信息展示框边框贴图（可在 Cocos Creator 编辑器中配置）
    
    private talents: Map<string, Talent> = new Map();
    private talentPoints: number = 5; // 初始天赋点
    
    start() {
        // 初始化天赋数据
        this.initTalents();
        
        // 检查 arrowerPrefab 是否配置
        
        // 如果 talentPanel 未设置，使用当前节点
        if (!this.talentPanel) {
            this.talentPanel = this.node;
        }
        
        // 预加载单位预制体资源
        this.preloadUnitPrefabs();
        
        // 如果面板已经激活，创建UI
        if (this.talentPanel && this.talentPanel.active) {
            this.createTalentPanelUI();
        }
    }
    
    /**
     * 预加载单位预制体资源
     */
    private preloadUnitPrefabs() {
        // 预加载 Arrower 和 Hunter 预制体
        const prefabPaths = ['prefabs/Arrower', 'prefabs/Hunter'];
        prefabPaths.forEach(path => {
            resources.load(path, Prefab, (err, prefab) => {
                if (!err && prefab) {
                } else {
                }
            });
        });
    }
    
    onEnable() {
        // 当组件被激活时，创建天赋面板UI
        
        // 如果 talentPanel 未设置，使用当前节点
        if (!this.talentPanel) {
            this.talentPanel = this.node;
        }
        
        // 延迟一帧创建UI，确保所有属性都已设置
        this.scheduleOnce(() => {
            this.createTalentPanelUI();
        }, 0);
    }
    
    initTalents() {
        // 初始化一些基础天赋
        this.talents.set('attack_damage', {
            id: 'attack_damage',
            name: '攻击力提升',
            description: '提升所有友方单位的攻击力',
            type: TalentType.ATTACK_DAMAGE,
            value: 10,
            cost: 1,
            level: 0,
            maxLevel: 5
        });
        
        this.talents.set('attack_speed', {
            id: 'attack_speed',
            name: '攻击速度提升',
            description: '提升所有友方单位的攻击速度',
            type: TalentType.ATTACK_SPEED,
            value: 5,
            cost: 1,
            level: 0,
            maxLevel: 5
        });
        
        this.talents.set('health', {
            id: 'health',
            name: '生命值提升',
            description: '提升所有友方单位的生命值',
            type: TalentType.HEALTH,
            value: 20,
            cost: 1,
            level: 0,
            maxLevel: 5
        });
        
        this.talents.set('move_speed', {
            id: 'move_speed',
            name: '移动速度提升',
            description: '提升所有友方单位的移动速度',
            type: TalentType.MOVE_SPEED,
            value: 5,
            cost: 1,
            level: 0,
            maxLevel: 5
        });
        
        this.talents.set('armor', {
            id: 'armor',
            name: '护甲提升',
            description: '提升所有友方单位的护甲',
            type: TalentType.ARMOR,
            value: 2,
            cost: 1,
            level: 0,
            maxLevel: 5
        });
    }
    
    createTalentPanelUI() {
        if (!this.talentPanel) {
            // 尝试从当前节点获取
            this.talentPanel = this.node;
            if (!this.talentPanel) {
                return;
            }
        }
        
        // 清空面板内容
        for (let child of this.talentPanel.children) {
            if (child.name !== 'Background') {
                child.destroy();
            }
        }
        
        // 创建天赋点显示
        this.createTalentPointsDisplay();
        
        // 创建标签页切换
        this.createTalentTabs();
        
        // 默认显示天赋列表
        this.showTalentList();
    }
    
    createTalentTabs() {
        // 创建标签页容器
        const tabsNode = new Node('TalentTabs');
        tabsNode.setParent(this.talentPanel);
        tabsNode.setPosition(0, 200, 0); // 调整标签页位置，适应更大的面板
        
        // 确保标签页容器处于激活状态
        tabsNode.active = true;
        
        // 标签配置
        const tabs = [
            { id: 'talents', name: '天赋升级' },
            { id: 'units', name: '单位详情' }
        ];
        
        // 创建标签按钮
        let xOffset = -100;
        for (let tab of tabs) {
            const tabButton = new Node(`Tab_${tab.id}`);
            tabButton.setParent(tabsNode);
            tabButton.setPosition(xOffset, 0, 0);
            
            // 添加按钮背景
            const buttonBackground = tabButton.addComponent(Graphics);
            buttonBackground.fillColor = new Color(80, 120, 160, 200);
            buttonBackground.roundRect(-75, -20, 150, 40, 5);
            buttonBackground.fill();
            
            // 添加按钮边框
            buttonBackground.lineWidth = 2;
            buttonBackground.strokeColor = new Color(100, 150, 200, 255);
            buttonBackground.roundRect(-75, -20, 150, 40, 5);
            buttonBackground.stroke();
            
            // 添加按钮文本
            const buttonText = tabButton.addComponent(Label);
            buttonText.string = tab.name;
            buttonText.fontSize = 18;
            buttonText.color = Color.WHITE;
            buttonText.horizontalAlign = Label.HorizontalAlign.CENTER;
            buttonText.verticalAlign = Label.VerticalAlign.CENTER;
            
            // 添加Button组件
            const buttonComp = tabButton.addComponent(Button);
            
            // 绑定点击事件
            if (tab.id === 'talents') {
                buttonComp.node.on(Button.EventType.CLICK, () => {
                    this.showTalentList();
                }, this);
            } else if (tab.id === 'units') {
                buttonComp.node.on(Button.EventType.CLICK, () => {
                    this.showUnitCards();
                }, this);
            }
            
            xOffset += 150;
        }
    }
    
    showTalentList() {
        // 销毁之前的内容
        this.clearContent();
        
        // 创建天赋列表
        this.createTalentList();
    }
    
    showUnitCards() {
        // 销毁之前的内容
        this.clearContent();
        
        // 创建单位卡片网格
        this.createUnitCardsGrid();
    }
    
    clearContent() {
        // 销毁除了背景、天赋点显示和标签页之外的所有内容
        for (let child of this.talentPanel.children) {
            if (child.name !== 'Background' && child.name !== 'TalentPointsDisplay' && child.name !== 'TalentTabs') {
                child.destroy();
            }
        }
    }
    
    createUnitCardsGrid() {
        // 友方单位列表
        const unitTypes = [
            { id: 'Arrower', name: '弓箭手', description: '远程攻击单位，能够攻击远处的敌人，射速较快', icon: 'Arrower', unitType: 'CHARACTER' },
            { id: 'Hunter', name: '女猎手', description: '远程攻击单位，投掷回旋镖攻击敌人，回旋镖可以反弹多次', icon: 'Hunter', unitType: 'CHARACTER' },
            { id: 'WarAncientTree', name: '战争古树', description: '能够生产弓箭手的建筑物，同时拥有远程攻击能力', icon: 'WarAncientTree', unitType: 'BUILDING' },
        ];
        
        
        // 卡片布局配置 - 三格占满一行
        // 获取面板宽度，用于计算卡片尺寸
        const panelTransform = this.talentPanel.getComponent(UITransform);
        let panelWidth = 750; // 默认宽度（画面宽度）
        let panelHeight = 960; // 默认高度
        
        if (panelTransform) {
            panelWidth = panelTransform.width;
            panelHeight = panelTransform.height;
        } else {
            // 如果面板没有UITransform，尝试从Canvas获取
            const canvas = find('Canvas');
            if (canvas) {
                const canvasTransform = canvas.getComponent(UITransform);
                if (canvasTransform) {
                    panelWidth = canvasTransform.width;
                    panelHeight = canvasTransform.height;
                }
            }
        }
        
        // 计算卡片尺寸：三格占满一行，均匀分布
        // 使用较小的边距，确保卡片尽可能占满画面
        const horizontalMargin = 20; // 左右边距各10，总共20
        const availableWidth = panelWidth - horizontalMargin; // 可用宽度
        
        // 三个卡片，两个间距：cardWidth * 3 + spacing * 2 = availableWidth
        // 为了占满画面，先计算卡片宽度，然后分配间距
        // 设置间距为15，则：cardWidth = (availableWidth - 30) / 3
        const cardSpacing = 15; // 卡片之间的间距
        const cardWidth = Math.floor((availableWidth - cardSpacing * 2) / 3);
        const cardHeight = Math.floor(cardWidth * 1.6); // 高度为宽度的1.6倍
        
        // 重新计算实际间距，确保三格占满一行（处理取整误差）
        const totalCardsWidth = cardWidth * 3;
        const totalSpacing = availableWidth - totalCardsWidth;
        const actualCardSpacing = Math.floor(totalSpacing / 2); // 两个间距，平均分配
        
        // 计算起始X位置：从左边距开始，第一个卡片中心位置
        // 左边距 = horizontalMargin / 2 = 10
        // 第一个卡片左边界 = -panelWidth/2 + 10
        // 第一个卡片中心 = -panelWidth/2 + 10 + cardWidth/2
        const startX = -panelWidth / 2 + horizontalMargin / 2 + cardWidth / 2;
        const startY = 50; // 稍微向下偏移，避免与顶部标签重叠
        const spacingX = cardWidth + actualCardSpacing; // 卡片宽度 + 间距
        const spacingY = cardHeight + 25; // 卡片高度 + 行间距
        const columns = 3;
        
        // 使用计算出的卡片尺寸
        const actualCardWidth = cardWidth;
        const actualCardHeight = cardHeight;
        
        
        // 创建卡片容器
        const cardsContainer = new Node('UnitCardsContainer');
        cardsContainer.setParent(this.talentPanel);
        cardsContainer.setPosition(0, 0, 0);
        // 确保卡片容器处于激活状态
        cardsContainer.active = true;
        
        // 创建单位卡片
        for (let i = 0; i < unitTypes.length; i++) {
            const unit = unitTypes[i];
            const row = Math.floor(i / columns);
            const col = i % columns;
            
            const xPos = startX + col * spacingX;
            const yPos = startY - row * spacingY;
            
            this.createUnitCard(unit, xPos, yPos, actualCardWidth, actualCardHeight, cardsContainer);
        }
        
    }
    
    createUnitCard(unit: any, x: number, y: number, width: number, height: number, parentNode: Node) {
        // 创建卡片节点
        const cardNode = new Node(`UnitCard_${unit.id}`);
        cardNode.setParent(parentNode);
        cardNode.setPosition(x, y, 0);
        // 确保卡片节点处于激活状态
        cardNode.active = true;
        
        // 添加UITransform
        const cardTransform = cardNode.addComponent(UITransform);
        cardTransform.setContentSize(width, height);
        cardTransform.setAnchorPoint(0.5, 0.5);
        
        // 创建卡片背景
        const cardBackground = cardNode.addComponent(Graphics);
        cardBackground.fillColor = new Color(60, 60, 80, 200);
        cardBackground.roundRect(-width/2, -height/2, width, height, 8);
        cardBackground.fill();
        
        // 创建卡片边框
        if (this.cardBorderFrame) {
            // 使用边框贴图
            const borderNode = new Node('CardBorder');
            borderNode.setParent(cardNode);
            borderNode.setPosition(0, 0, 0);
            borderNode.active = true;
            
            const borderTransform = borderNode.addComponent(UITransform);
            borderTransform.setContentSize(width, height);
            borderTransform.setAnchorPoint(0.5, 0.5);
            
            const borderSprite = borderNode.addComponent(Sprite);
            borderSprite.spriteFrame = this.cardBorderFrame;
            borderSprite.type = Sprite.Type.SIMPLE;
            borderSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        } else {
            // 使用 Graphics 绘制边框（降级方案）
            cardBackground.lineWidth = 2;
            cardBackground.strokeColor = new Color(100, 150, 200, 255);
            cardBackground.roundRect(-width/2, -height/2, width, height, 8);
            cardBackground.stroke();
        }
        
        // 创建单位图标节点（图标容器）
        // 图标尺寸适配卡片宽度（150），留出一些边距
        const iconSize = Math.min(width * 0.7, 100); // 卡片宽度的70%，最大100像素
        const iconNode = new Node('UnitIcon');
        iconNode.setParent(cardNode);
        iconNode.setPosition(0, 30, 0);
        // 确保图标容器处于激活状态
        iconNode.active = true;
        
        // 设置图标容器尺寸
        const iconTransform = iconNode.addComponent(UITransform);
        iconTransform.setContentSize(iconSize, iconSize);
        iconTransform.setAnchorPoint(0.5, 0.5);
        
        // 添加图标背景
        const iconBackground = iconNode.addComponent(Graphics);
        iconBackground.fillColor = new Color(40, 40, 60, 200);
        iconBackground.roundRect(-iconSize/2, -iconSize/2, iconSize, iconSize, 8);
        iconBackground.fill();
        
        // 添加图标边框
        iconBackground.lineWidth = 2;
        iconBackground.strokeColor = new Color(100, 150, 200, 255);
        iconBackground.roundRect(-iconSize/2, -iconSize/2, iconSize, iconSize, 8);
        iconBackground.stroke();
        
        // 创建Sprite节点用于显示单位图标
        const spriteNode = new Node('UnitIconSprite');
        spriteNode.setParent(iconNode);
        spriteNode.setPosition(0, 0, 0);
        // 确保Sprite节点处于激活状态
        spriteNode.active = true;
        
        // 设置Sprite节点尺寸（稍微小于容器，留出边框空间）
        const spriteSize = iconSize * 0.85; // 容器尺寸的85%
        const spriteTransform = spriteNode.addComponent(UITransform);
        spriteTransform.setContentSize(spriteSize, spriteSize);
        spriteTransform.setAnchorPoint(0.5, 0.5);
        
        // 添加Sprite组件
        const sprite = spriteNode.addComponent(Sprite);
        // 设置 Sprite 尺寸模式为 CUSTOM，确保图片按照 UITransform 的尺寸显示
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.SIMPLE;
        
        // 尝试加载单位的cardIcon
        this.loadUnitCardIcon(unit.id, sprite);
        
        // 创建单位名称标签
        const nameNode = new Node('UnitName');
        nameNode.setParent(cardNode);
        nameNode.setPosition(0, -20, 0);
        // 确保名称节点处于激活状态
        nameNode.active = true;
        
        const nameLabel = nameNode.addComponent(Label);
        nameLabel.string = unit.name;
        nameLabel.fontSize = 18;
        nameLabel.color = Color.WHITE;
        nameLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        
        // 创建单位类型标签
        const typeNode = new Node('UnitType');
        typeNode.setParent(cardNode);
        typeNode.setPosition(0, -45, 0);
        // 确保类型节点处于激活状态
        typeNode.active = true;
        
        const typeLabel = typeNode.addComponent(Label);
        typeLabel.string = this.getUnitTypeDisplayName(unit.unitType);
        typeLabel.fontSize = 14;
        typeLabel.color = Color.GRAY;
        typeLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        
        // 创建查看详情按钮
        const detailButton = new Node('DetailButton');
        detailButton.setParent(cardNode);
        detailButton.setPosition(0, -75, 0);
        // 确保按钮节点处于激活状态
        detailButton.active = true;
        
        // 添加按钮背景
        const buttonBackground = detailButton.addComponent(Graphics);
        buttonBackground.fillColor = new Color(80, 120, 160, 200);
        buttonBackground.roundRect(-40, -15, 80, 30, 5);
        buttonBackground.fill();
        
        // 添加按钮边框
        buttonBackground.lineWidth = 1;
        buttonBackground.strokeColor = new Color(100, 150, 200, 255);
        buttonBackground.roundRect(-40, -15, 80, 30, 5);
        buttonBackground.stroke();
        
        // 创建按钮文本
        const buttonTextNode = new Node('ButtonText');
        buttonTextNode.setParent(detailButton);
        // 确保按钮文本节点处于激活状态
        buttonTextNode.active = true;
        
        const buttonTextLabel = buttonTextNode.addComponent(Label);
        buttonTextLabel.string = '查看详情';
        buttonTextLabel.fontSize = 14;
        buttonTextLabel.color = Color.WHITE;
        buttonTextLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        buttonTextLabel.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 添加Button组件
        const buttonComp = detailButton.addComponent(Button);
        
        // 绑定点击事件
        buttonComp.node.on(Button.EventType.CLICK, () => {
            this.showUnitDetail(unit);
        }, this);
    }
    
    showUnitDetail(unit: any) {
        
        // 创建详情面板
        const detailPanel = new Node('UnitDetailPanel');
        detailPanel.setParent(this.talentPanel);
        detailPanel.setPosition(0, 0, 0);
        
        // 添加半透明背景遮罩
        const maskNode = new Node('Mask');
        maskNode.setParent(detailPanel);
        maskNode.setPosition(0, 0, -1);
        
        // 获取屏幕尺寸
        const canvas = find('Canvas');
        const screenWidth = canvas?.getComponent(UITransform)?.width || 960;
        const screenHeight = canvas?.getComponent(UITransform)?.height || 640;
        
        // 设置遮罩尺寸
        const maskTransform = maskNode.addComponent(UITransform);
        maskTransform.setContentSize(screenWidth, screenHeight);
        maskTransform.setAnchorPoint(0.5, 0.5);
        
        // 创建遮罩背景
        const maskBackground = maskNode.addComponent(Graphics);
        maskBackground.fillColor = new Color(0, 0, 0, 150);
        maskBackground.rect(-screenWidth/2, -screenHeight/2, screenWidth, screenHeight);
        maskBackground.fill();
        
        // 创建详情面板内容
        const contentNode = new Node('DetailContent');
        contentNode.setParent(detailPanel);
        contentNode.setPosition(0, 0, 0);
        
        // 添加内容背景
        const contentTransform = contentNode.addComponent(UITransform);
        contentTransform.setContentSize(500, 400);
        contentTransform.setAnchorPoint(0.5, 0.5);
        
        // 创建详情面板背景
        const contentBackground = contentNode.addComponent(Graphics);
        contentBackground.fillColor = new Color(70, 70, 90, 255);
        contentBackground.roundRect(-250, -200, 500, 400, 10);
        contentBackground.fill();
        
        // 创建详情面板边框
        if (this.detailPanelBorderFrame) {
            // 使用边框贴图
            const borderNode = new Node('DetailPanelBorder');
            borderNode.setParent(contentNode);
            borderNode.setPosition(0, 0, 0);
            borderNode.active = true;
            
            const borderTransform = borderNode.addComponent(UITransform);
            borderTransform.setContentSize(500, 400);
            borderTransform.setAnchorPoint(0.5, 0.5);
            
            const borderSprite = borderNode.addComponent(Sprite);
            borderSprite.spriteFrame = this.detailPanelBorderFrame;
            borderSprite.type = Sprite.Type.SIMPLE;
            borderSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        } else {
            // 使用 Graphics 绘制边框（降级方案）
            contentBackground.lineWidth = 2;
            contentBackground.strokeColor = new Color(120, 170, 220, 255);
            contentBackground.roundRect(-250, -200, 500, 400, 10);
            contentBackground.stroke();
        }
        
        // 创建关闭按钮
        const closeButton = new Node('CloseButton');
        closeButton.setParent(contentNode);
        closeButton.setPosition(220, 170, 0);
        
        // 添加关闭按钮背景
        const closeButtonBackground = closeButton.addComponent(Graphics);
        closeButtonBackground.fillColor = new Color(150, 60, 60, 200);
        closeButtonBackground.circle(0, 0, 15);
        closeButtonBackground.fill();
        
        // 添加关闭按钮边框
        closeButtonBackground.lineWidth = 2;
        closeButtonBackground.strokeColor = new Color(200, 100, 100, 255);
        closeButtonBackground.circle(0, 0, 15);
        closeButtonBackground.stroke();
        
        // 添加关闭按钮文本
        const closeButtonText = closeButton.addComponent(Label);
        closeButtonText.string = 'X';
        closeButtonText.fontSize = 16;
        closeButtonText.color = Color.WHITE;
        closeButtonText.horizontalAlign = Label.HorizontalAlign.CENTER;
        closeButtonText.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 添加Button组件
        const closeButtonComp = closeButton.addComponent(Button);
        
        // 绑定关闭事件
        closeButtonComp.node.on(Button.EventType.CLICK, () => {
            detailPanel.destroy();
        }, this);
        
        // 创建单位名称
        const nameNode = new Node('UnitName');
        nameNode.setParent(contentNode);
        nameNode.setPosition(0, 150, 0);
        
        const nameLabel = nameNode.addComponent(Label);
        nameLabel.string = unit.name;
        nameLabel.fontSize = 32;
        nameLabel.color = Color.WHITE;
        nameLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        
        // 创建单位类型
        const typeNode = new Node('UnitType');
        typeNode.setParent(contentNode);
        typeNode.setPosition(0, 120, 0);
        
        const typeLabel = typeNode.addComponent(Label);
        typeLabel.string = this.getUnitTypeDisplayName(unit.unitType);
        typeLabel.fontSize = 18;
        typeLabel.color = Color.GRAY;
        typeLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        
        // 创建单位描述
        const descNode = new Node('UnitDescription');
        descNode.setParent(contentNode);
        descNode.setPosition(0, 60, 0);
        
        const descLabel = descNode.addComponent(Label);
        descLabel.string = unit.description;
        descLabel.fontSize = 16;
        descLabel.color = Color.WHITE;
        descLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        descLabel.verticalAlign = Label.VerticalAlign.TOP;
        
        // 设置描述文本尺寸
        const descTransform = descNode.addComponent(UITransform);
        descTransform.setContentSize(400, 100);
        descTransform.setAnchorPoint(0.5, 0.5);
        
        // 创建属性列表
        const statsNode = new Node('UnitStats');
        statsNode.setParent(contentNode);
        statsNode.setPosition(0, -30, 0);
        
        // 从配置文件获取单位属性
        const unitStats = this.getUnitStats(unit.id);
        
        // 显示属性
        let yOffset = 0;
        // 使用传统的for...in循环遍历对象属性，兼容更低版本的TypeScript
        for (const statName in unitStats) {
            // 只显示自己的属性，不显示继承的属性
            if (unitStats.hasOwnProperty(statName)) {
                const statValue = unitStats[statName];
                // 跳过一些内部属性
                if (statName !== 'node' && statName !== 'constructor' && typeof statValue !== 'function') {
                    const statNode = new Node(`Stat_${statName}`);
                    statNode.setParent(statsNode);
                    statNode.setPosition(0, yOffset, 0);
                    
                    const statLabel = statNode.addComponent(Label);
                    statLabel.string = `${statName}: ${statValue}`;
                    statLabel.fontSize = 16;
                    statLabel.color = Color.WHITE;
                    statLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
                    
                    yOffset -= 30;
                }
            }
        }
        
        // 创建关闭面板的事件（点击遮罩关闭）
        maskNode.on(Node.EventType.TOUCH_END, () => {
            detailPanel.destroy();
        }, this);
    }
    
    getUnitTypeDisplayName(type: string): string {
        switch (type) {
            case 'CHARACTER':
                return '角色单位';
            case 'BUILDING':
                return '建筑物单位';
            default:
                return '未知类型';
        }
    }
    
    getUnitStats(unitId: string): any {
        // 从配置文件读取单位属性
        const configManager = UnitConfigManager.getInstance();
        
        if (configManager.isConfigLoaded()) {
            // 单位ID映射：处理不同格式的单位ID
            const unitIdMap: Record<string, string> = {
                'arrower': 'Arrower',
                'Arrower': 'Arrower',
                'hunter': 'Hunter',
                'Hunter': 'Hunter',
                'war_ancient_tree': 'WarAncientTree',
                'WarAncientTree': 'WarAncientTree',
            };
            
            const normalizedUnitId = unitIdMap[unitId] || unitId;
            const displayStats = configManager.getUnitDisplayStats(normalizedUnitId);
            if (displayStats && Object.keys(displayStats).length > 0) {
                return displayStats;
            }
        }
        
        // 如果配置未加载或找不到配置，返回空对象
        return {};
    }
    
    /**
     * 尝试通过单位ID重新查找sprite组件
     * @param unitId 单位ID
     * @returns Sprite组件，如果找不到则返回null
     */
    private tryFindSpriteByUnitId(unitId: string): Sprite | null {
        if (!this.talentPanel) {
            return null;
        }
        
        // 查找对应的卡片节点
        const cardNodeName = `UnitCard_${unitId}`;
        const cardsContainer = this.talentPanel.getChildByName('UnitCardsContainer');
        if (!cardsContainer) {
            return null;
        }
        
        const cardNode = cardsContainer.getChildByName(cardNodeName);
        if (!cardNode) {
            return null;
        }
        
        // 查找图标节点
        const iconNode = cardNode.getChildByName('UnitIcon');
        if (!iconNode) {
            return null;
        }
        
        // 查找sprite节点
        const spriteNode = iconNode.getChildByName('UnitIconSprite');
        if (!spriteNode) {
            return null;
        }
        
        return spriteNode.getComponent(Sprite);
    }
    
    /**
     * 加载单位的卡片图标
     * @param unitId 单位ID
     * @param sprite Sprite组件，用于显示图标
     */
    loadUnitCardIcon(unitId: string, sprite: Sprite) {
        
        // 根据单位ID构建节点名称
        const nodeName = unitId;
        
        // 直接从预制体获取图标（通过 UUID 加载）
        this.tryGetIconFromPrefab(unitId, nodeName, sprite);
    }
    
    /**
     * 从单位脚本中尝试获取图标
     * @param unitScript 单位脚本组件
     * @param node 单位节点
     * @param sprite Sprite组件
     * @param unitId 单位ID（用于日志）
     * @returns 是否成功获取图标
     */
    private tryGetIconFromUnitScript(unitScript: any, node: Node, sprite: Sprite, unitId: string): boolean {
        if (!unitScript) {
            return false;
        }
        
        // 1. 优先使用cardIcon
        if (unitScript.cardIcon) {
            sprite.spriteFrame = unitScript.cardIcon;
            return true;
        } else {
        }
        
        // 2. 如果没有cardIcon，尝试获取unitIcon
        if (unitScript.unitIcon) {
            sprite.spriteFrame = unitScript.unitIcon;
            return true;
        } else {
        }
        
        // 3. 尝试获取defaultSpriteFrame
        if (unitScript.defaultSpriteFrame) {
            sprite.spriteFrame = unitScript.defaultSpriteFrame;
            return true;
        } else {
        }
        
        // 4. 尝试获取Sprite组件的spriteFrame
        const spriteComponent = node.getComponent(Sprite);
        if (spriteComponent) {
            if (spriteComponent.spriteFrame) {
                sprite.spriteFrame = spriteComponent.spriteFrame;
                return true;
            } else {
            }
        } else {
        }
        
        return false;
    }
    
    /**
     * 尝试从预制体获取单位图标
     * @param unitId 单位ID
     * @param nodeName 节点名称
     * @param sprite Sprite组件
     */
    private tryGetIconFromPrefab(unitId: string, nodeName: string, sprite: Sprite) {
        
        // 单位 prefab 的 UUID 映射表
        const prefabUuidMap: Record<string, string> = {
            'Arrower': 'bcbcc8da-eb3d-4ad2-a55a-b0a0cb5da998',
            'Hunter': '989ff20a-2de2-44bb-9590-29df03813990',
            'WarAncientTree': 'be50baf7-2a47-44a1-85e1-8116927ef58e',
        };
        
        // 1. 优先使用 TalentSystem 的 arrowerPrefab 属性（如果配置了）
        if (unitId === 'Arrower' && this.arrowerPrefab) {
            this.loadIconFromPrefabInstance(this.arrowerPrefab, unitId, sprite);
            return;
        }
        
        // 2. 通过 UUID 加载 prefab
        const uuid = prefabUuidMap[unitId];
        if (!uuid) {
            return;
        }
        
        const spriteRef = sprite; // 保存 sprite 引用
        const unitIdRef = unitId; // 保存 unitId 引用
        
        assetManager.loadAny({ uuid: uuid, type: Prefab }, (err, loadedPrefab) => {
            if (!err && loadedPrefab) {
                // 检查 sprite 是否有效，如果无效则尝试重新查找
                let validSprite = spriteRef;
                if (!validSprite || !validSprite.node || !validSprite.node.isValid) {
                    validSprite = this.tryFindSpriteByUnitId(unitIdRef);
                    if (validSprite) {
                    } else {
                    }
                }
                if (validSprite && validSprite.node && validSprite.node.isValid) {
                    // 确保 sprite 节点仍然有效
                    this.loadIconFromPrefabInstance(loadedPrefab as Prefab, unitIdRef, validSprite);
                } else {
                }
            } else {
            }
        });
    }
    
    /**
     * 从预制体实例加载图标
     * @param prefab 预制体
     * @param unitId 单位ID
     * @param sprite Sprite组件
     */
    private loadIconFromPrefabInstance(prefab: Prefab, unitId: string, sprite: Sprite) {
        if (!prefab) {
            return;
        }
        if (!sprite) {
            return;
        }
        // 检查 sprite 节点是否仍然有效
        if (!sprite.node || !sprite.node.isValid) {
            return;
        }
        
        // 先尝试直接从预制体数据获取 SpriteFrame（不需要实例化）
        const prefabData = prefab.data;
        if (prefabData) {
            const prefabSprite = prefabData.getComponent(Sprite);
            if (prefabSprite) {
                // 如果 spriteFrame 存在，直接使用
                if (prefabSprite.spriteFrame) {
                    sprite.spriteFrame = prefabSprite.spriteFrame;
                    return;
                }
                // 如果 spriteFrame 为空，尝试强制刷新
                prefabSprite.enabled = false;
                prefabSprite.enabled = true;
                // 等待一帧再检查
                this.scheduleOnce(() => {
                    // 检查 sprite 节点是否仍然有效
                    if (!sprite.node || !sprite.node.isValid) {
                        return;
                    }
                    if (prefabSprite.spriteFrame) {
                        sprite.spriteFrame = prefabSprite.spriteFrame;
                    } else {
                    }
                }, 0);
            } else {
            }
        } else {
        }
        
        const prefabInstance = instantiate(prefab);
        if (prefabInstance) {
            // 激活预制体实例，确保组件能够初始化
            prefabInstance.active = true;
            
            // 递归查找Sprite组件的辅助函数
            const findSpriteInChildren = (node: Node): Sprite | null => {
                const childSprite = node.getComponent(Sprite);
                if (childSprite && childSprite.spriteFrame) {
                    return childSprite;
                }
                for (const child of node.children) {
                    const found = findSpriteInChildren(child);
                    if (found) {
                        return found;
                    }
                }
                return null;
            };
            
            // 获取单位组件
            const componentName = unitId.charAt(0).toUpperCase() + unitId.slice(1);
            const unitScript = prefabInstance.getComponent(componentName) as any || 
                              prefabInstance.getComponent(unitId) as any;
            
            if (unitScript) {
            } else {
            }
            
            // 使用统一的图标获取逻辑（优先从组件属性获取）
            if (unitScript && this.tryGetIconFromUnitScript(unitScript, prefabInstance, sprite, unitId)) {
                prefabInstance.destroy();
                return;
            }
            
            // 如果单位脚本中没有找到图标，尝试从Sprite组件获取
            // 4. 尝试从根节点获取Sprite组件（优先检查这个，因为大部分单位的Sprite在根节点）
            const rootSprite = prefabInstance.getComponent(Sprite);
            if (rootSprite) {
                
                // 立即检查 spriteFrame
                if (rootSprite.spriteFrame) {
                    sprite.spriteFrame = rootSprite.spriteFrame;
                    prefabInstance.destroy();
                    return;
                }
                
                // 如果 spriteFrame 为空，强制刷新并等待
                rootSprite.enabled = false;
                rootSprite.enabled = true;
                
                const spriteRef = sprite;
                const prefabRef = prefabInstance;
                const rootSpriteRef = rootSprite;
                
                // 等待一帧确保组件初始化
                this.scheduleOnce(() => {
                    // 检查 sprite 节点是否仍然有效
                    if (!spriteRef.node || !spriteRef.node.isValid) {
                        prefabRef.destroy();
                        return;
                    }
                    let spriteFrame = rootSpriteRef.spriteFrame;
                    
                    if (spriteFrame) {
                        spriteRef.spriteFrame = spriteFrame;
                        prefabRef.destroy();
                    } else {
                        // 再次尝试刷新
                        rootSpriteRef.enabled = false;
                        rootSpriteRef.enabled = true;
                        this.scheduleOnce(() => {
                            // 再次检查 sprite 节点是否仍然有效
                            if (!spriteRef.node || !spriteRef.node.isValid) {
                                prefabRef.destroy();
                                return;
                            }
                            spriteFrame = rootSpriteRef.spriteFrame;
                            
                            if (spriteFrame) {
                                spriteRef.spriteFrame = spriteFrame;
                            } else {
                            }
                            prefabRef.destroy();
                        }, 0.05); // 等待 0.05 秒
                    }
                }, 0.05); // 等待 0.05 秒
                return; // 等待中，先返回
            } else {
            }
            
            // 5. 尝试从子节点中查找Sprite组件（有些单位的Sprite可能在子节点中）
            const childSprite = findSpriteInChildren(prefabInstance);
            if (childSprite) {
                if (childSprite.spriteFrame) {
                    sprite.spriteFrame = childSprite.spriteFrame;
                    prefabInstance.destroy();
                    return;
                } else {
                    // 如果spriteFrame为空，尝试等待一帧
                    const spriteRef = sprite;
                    const prefabRef = prefabInstance;
                    const childSpriteRef = childSprite;
                    
                    this.scheduleOnce(() => {
                        // 检查 sprite 节点是否仍然有效
                        if (!spriteRef.node || !spriteRef.node.isValid) {
                            prefabRef.destroy();
                            return;
                        }
                        let spriteFrame = childSpriteRef.spriteFrame;
                        if (!spriteFrame) {
                            childSpriteRef.enabled = false;
                            childSpriteRef.enabled = true;
                            spriteFrame = childSpriteRef.spriteFrame;
                        }
                        
                        if (spriteFrame) {
                            spriteRef.spriteFrame = spriteFrame;
                        } else {
                        }
                        prefabRef.destroy();
                    }, 0.1);
                    return; // 等待中，先返回
                }
            } else {
            }
            
            // 6. 如果还是没有找到，输出警告
            
            prefabInstance.destroy();
        } else {
        }
        
        // 如果都获取不到，保持Sprite组件为空（不显示图标）
        // 最后检查一次 spriteFrame 是否已设置
        if (!sprite.spriteFrame) {
        }
    }
    
    createTalentPointsDisplay() {
        // 创建天赋点显示节点
        const talentPointsNode = new Node('TalentPointsDisplay');
        talentPointsNode.setParent(this.talentPanel);
        talentPointsNode.setPosition(0, 40, 0);
        
        // 添加Label
        const label = talentPointsNode.addComponent(Label);
        label.string = `天赋点: ${this.talentPoints}`;
        label.fontSize = 24;
        label.color = Color.YELLOW;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
    }
    
    createTalentList() {
        // 天赋列表位置
        let yPos = 0;
        const spacing = 30;
        
        // 遍历所有天赋
        for (let [talentId, talent] of this.talents) {
            // 创建天赋项
            const talentItem = new Node(`Talent_${talentId}`);
            talentItem.setParent(this.talentPanel);
            talentItem.setPosition(0, yPos, 0);
            
            // 添加背景
            const background = talentItem.addComponent(Graphics);
            background.fillColor = new Color(50, 50, 50, 150);
            background.roundRect(-320, -15, 640, 30, 5);
            background.fill();
            
            // 添加边框
            background.lineWidth = 1;
            background.strokeColor = new Color(100, 100, 100, 255);
            background.roundRect(-320, -15, 640, 30, 5);
            background.stroke();
            
            // 创建天赋名称标签
            const nameLabel = new Node('NameLabel');
            nameLabel.setParent(talentItem);
            nameLabel.setPosition(-280, 0, 0);
            
            const nameLabelComp = nameLabel.addComponent(Label);
            nameLabelComp.string = talent.name;
            nameLabelComp.fontSize = 16;
            nameLabelComp.color = Color.WHITE;
            nameLabelComp.horizontalAlign = Label.HorizontalAlign.LEFT;
            
            // 创建天赋描述标签
            const descLabel = new Node('DescLabel');
            descLabel.setParent(talentItem);
            descLabel.setPosition(0, 0, 0);
            
            const descLabelComp = descLabel.addComponent(Label);
            descLabelComp.string = talent.description;
            descLabelComp.fontSize = 14;
            descLabelComp.color = Color.GRAY;
            descLabelComp.horizontalAlign = Label.HorizontalAlign.LEFT;
            
            // 创建天赋效果标签
            const effectLabel = new Node('EffectLabel');
            effectLabel.setParent(talentItem);
            effectLabel.setPosition(150, 0, 0);
            
            const effectLabelComp = effectLabel.addComponent(Label);
            effectLabelComp.string = `+${talent.value}%`;
            effectLabelComp.fontSize = 14;
            effectLabelComp.color = Color.GREEN;
            effectLabelComp.horizontalAlign = Label.HorizontalAlign.RIGHT;
            
            // 创建等级显示
            const levelLabel = new Node('LevelLabel');
            levelLabel.setParent(talentItem);
            levelLabel.setPosition(200, 0, 0);
            
            const levelLabelComp = levelLabel.addComponent(Label);
            levelLabelComp.string = `${talent.level}/${talent.maxLevel}`;
            levelLabelComp.fontSize = 14;
            levelLabelComp.color = Color.WHITE;
            
            // 创建升级按钮
            const upgradeButton = new Node('UpgradeButton');
            upgradeButton.setParent(talentItem);
            upgradeButton.setPosition(270, 0, 0);
            
            // 添加按钮背景
            const buttonBackground = upgradeButton.addComponent(Graphics);
            buttonBackground.fillColor = new Color(80, 120, 80, 200);
            buttonBackground.roundRect(-35, -12, 70, 24, 3);
            buttonBackground.fill();
            
            // 添加按钮标签
            const buttonLabel = new Node('ButtonLabel');
            buttonLabel.setParent(upgradeButton);
            
            const buttonLabelComp = buttonLabel.addComponent(Label);
            buttonLabelComp.string = '升级';
            buttonLabelComp.fontSize = 14;
            buttonLabelComp.color = Color.WHITE;
            buttonLabelComp.horizontalAlign = Label.HorizontalAlign.CENTER;
            buttonLabelComp.verticalAlign = Label.VerticalAlign.CENTER;
            
            // 添加Button组件
            const buttonComp = upgradeButton.addComponent(Button);
            
            // 绑定点击事件
            buttonComp.node.on(Button.EventType.CLICK, () => {
                this.upgradeTalent(talentId);
            }, this);
            
            // 更新y位置
            yPos -= spacing;
        }
    }
    
    upgradeTalent(talentId: string) {
        const talent = this.talents.get(talentId);
        if (!talent) {
            return;
        }
        
        // 检查是否可以升级
        if (talent.level >= talent.maxLevel) {
            return;
        }
        
        if (this.talentPoints < talent.cost) {
            return;
        }
        
        // 扣除天赋点
        this.talentPoints -= talent.cost;
        
        // 升级天赋
        talent.level++;
        
        // 应用天赋效果
        this.applyTalentEffect(talent);
        
        // 更新天赋面板
        this.updateTalentPanel();
        
    }
    
    applyTalentEffect(talent: Talent) {
        // 这里可以添加实际的天赋效果应用逻辑
        // 例如，遍历所有友方单位并增加相应属性
    }
    
    updateTalentPanel() {
        // 重新创建天赋面板UI
        this.createTalentPanelUI();
    }
    
    // 获取天赋效果值
    getTalentEffect(type: TalentType): number {
        let totalValue = 0;
        
        for (let talent of this.talents.values()) {
            if (talent.type === type) {
                totalValue += talent.value * talent.level;
            }
        }
        
        return totalValue;
    }
}