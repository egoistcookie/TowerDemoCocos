import { _decorator, Component, Node, Button, Label, find, director, UITransform, Color, Graphics, tween, Vec3, UIOpacity, Sprite, SpriteFrame, Prefab, instantiate, assetManager, director as directorModule, resources } from 'cc';
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
        console.log(`TalentSystem: start() called, arrowerPrefab: ${this.arrowerPrefab ? 'configured' : 'not configured'}`);
        
        // 如果 talentPanel 未设置，使用当前节点
        if (!this.talentPanel) {
            console.log('TalentSystem: talentPanel is null in start(), using this.node');
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
                    console.log(`TalentSystem: Preloaded prefab: ${path}`);
                } else {
                    console.log(`TalentSystem: Failed to preload prefab: ${path}, err: ${err}`);
                }
            });
        });
    }
    
    onEnable() {
        // 当组件被激活时，创建天赋面板UI
        console.log('TalentSystem: onEnable called, talentPanel:', this.talentPanel);
        
        // 如果 talentPanel 未设置，使用当前节点
        if (!this.talentPanel) {
            console.log('TalentSystem: talentPanel is null in onEnable(), using this.node');
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
        console.log('TalentSystem: createTalentPanelUI called, talentPanel:', this.talentPanel);
        if (!this.talentPanel) {
            console.error('TalentSystem: TalentPanel node is null! Please configure it in the editor.');
            // 尝试从当前节点获取
            this.talentPanel = this.node;
            if (!this.talentPanel) {
                console.error('TalentSystem: Cannot find talentPanel node, aborting UI creation');
                return;
            }
            console.log('TalentSystem: Using current node as talentPanel');
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
        console.log('TalentSystem: createTalentPanelUI completed!');
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
                    console.log('TalentSystem: Talent tab clicked, showing talent list');
                    this.showTalentList();
                }, this);
            } else if (tab.id === 'units') {
                buttonComp.node.on(Button.EventType.CLICK, () => {
                    console.log('TalentSystem: Units tab clicked, showing unit cards');
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
        console.log('TalentSystem: showUnitCards called!');
        // 销毁之前的内容
        this.clearContent();
        
        // 创建单位卡片网格
        this.createUnitCardsGrid();
        console.log('TalentSystem: showUnitCards completed!');
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
        console.log('TalentSystem: createUnitCardsGrid called!');
        // 友方单位列表
        const unitTypes = [
            { id: 'Arrower', name: '弓箭手', description: '远程攻击单位，能够攻击远处的敌人，射速较快', icon: 'Arrower', unitType: 'CHARACTER' },
            { id: 'Hunter', name: '女猎手', description: '远程攻击单位，投掷回旋镖攻击敌人，回旋镖可以反弹多次', icon: 'Hunter', unitType: 'CHARACTER' },
            { id: 'Wisp', name: '小精灵', description: '能够治疗建筑物的小精灵，是维护基地的重要单位', icon: 'Wisp', unitType: 'CHARACTER' },
            { id: 'WarAncientTree', name: '战争古树', description: '能够生产弓箭手的建筑物，同时拥有远程攻击能力', icon: 'WarAncientTree', unitType: 'BUILDING' },
            { id: 'MoonWell', name: '月亮井', description: '能够恢复周围单位生命值，并提供人口上限的建筑物', icon: 'MoonWell', unitType: 'BUILDING' },
            { id: 'Tree', name: '普通树木', description: '普通的树木，可以提供资源', icon: 'Tree', unitType: 'TREE' }
        ];
        
        console.log('TalentSystem: Unit types to create cards for:', unitTypes.map(unit => unit.name));
        
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
        
        console.log(`TalentSystem: Card layout - panelWidth: ${panelWidth}, availableWidth: ${availableWidth}, cardWidth: ${actualCardWidth}, cardHeight: ${actualCardHeight}, startX: ${startX}, spacingX: ${spacingX}, cardSpacing: ${actualCardSpacing}, horizontalMargin: ${horizontalMargin}`);
        
        // 创建卡片容器
        const cardsContainer = new Node('UnitCardsContainer');
        cardsContainer.setParent(this.talentPanel);
        cardsContainer.setPosition(0, 0, 0);
        // 确保卡片容器处于激活状态
        cardsContainer.active = true;
        console.log('TalentSystem: UnitCardsContainer created and activated!');
        
        // 创建单位卡片
        for (let i = 0; i < unitTypes.length; i++) {
            const unit = unitTypes[i];
            const row = Math.floor(i / columns);
            const col = i % columns;
            
            const xPos = startX + col * spacingX;
            const yPos = startY - row * spacingY;
            
            console.log(`TalentSystem: Creating card for unit ${unit.name} at position (${xPos}, ${yPos})`);
            this.createUnitCard(unit, xPos, yPos, actualCardWidth, actualCardHeight, cardsContainer);
            console.log(`TalentSystem: Card for unit ${unit.name} created!`);
        }
        
        console.log('TalentSystem: createUnitCardsGrid completed!');
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
        console.log(`TalentSystem: Showing detail for unit ${unit.name}`);
        
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
        
        // 获取单位属性（这里使用模拟数据，实际应从单位脚本中获取）
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
            case 'TREE':
                return '树木单位';
            default:
                return '未知类型';
        }
    }
    
    getUnitStats(unitId: string): any {
        // 根据单位ID返回相应的属性数据
        // 这里使用模拟数据，实际应从单位脚本中获取
        const statsMap: any = {
            'arrower': {
                '生命值': 50,
                '攻击力': 10,
                '攻击范围': '200像素',
                '攻击间隔': '1.0秒',
                '移动速度': '100像素/秒',
                '建造成本': '5金币'
            },
            'hunter': {
                '生命值': 50,
                '攻击力': 10,
                '攻击范围': '200像素',
                '攻击间隔': '1.0秒',
                '移动速度': '100像素/秒',
                '建造成本': '5金币'
            },
            'wisp': {
                '生命值': 30,
                '治疗量': '2点/次',
                '治疗间隔': '1.0秒',
                '移动速度': '80像素/秒',
                '人口占用': 1
            },
            'war_ancient_tree': {
                '生命值': 100,
                '攻击力': 15,
                '攻击范围': '200像素',
                '攻击间隔': '1.5秒',
                '建造成本': '10金币',
                '最大生产数量': 4
            },
            'moon_well': {
                '生命值': 80,
                '治疗范围': '100像素',
                '治疗量': '1点/次',
                '治疗间隔': '2.0秒',
                '建造成本': '10金币',
                '人口增加': 10
            },
            'tree': {
                '生命值': 20,
                '建造成本': '1金币',
                '回收奖励': '1金币'
            }
        };
        
        return statsMap[unitId] || {};
    }
    
    /**
     * 加载单位的卡片图标
     * @param unitId 单位ID
     * @param sprite Sprite组件，用于显示图标
     */
    loadUnitCardIcon(unitId: string, sprite: Sprite) {
        console.log(`TalentSystem: Loading card icon for unit ${unitId}`);
        
        // 根据单位ID构建节点名称
        const unitNameMap: Record<string, string> = {
            'Arrower': 'Arrower',
            'Hunter': 'Hunter',
            'Wisp': 'Wisp',
            'WarAncientTree': 'WarAncientTree',
            'MoonWell': 'MoonWell',
            'Tree': 'Tree'
        };
        
        const nodeName = unitNameMap[unitId] || unitId;
        
        // 对于 Arrower 和 Hunter，优先从场景中查找实例
        if (unitId === 'Arrower' || unitId === 'Hunter') {
            // 1. 首先从场景中查找单位实例，获取其图标（最可靠）
            this.tryGetIconFromScene(unitId, nodeName, sprite, () => {
                // 2. 如果场景中没有找到，从预制体获取
                this.tryGetIconFromPrefab(unitId, nodeName, sprite);
            });
        } else {
            // 1. 首先从场景中查找单位，获取其图标
            this.tryGetIconFromScene(unitId, nodeName, sprite, () => {
                // 2. 如果场景中没有找到，从预制体获取
                this.tryGetIconFromPrefab(unitId, nodeName, sprite);
            });
        }
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
            console.log(`TalentSystem: Unit script is null for ${unitId}`);
            return false;
        }
        
        // 1. 优先使用cardIcon
        if (unitScript.cardIcon) {
            console.log(`TalentSystem: Setting card icon from ${unitId} cardIcon`);
            sprite.spriteFrame = unitScript.cardIcon;
            return true;
        } else {
            console.log(`TalentSystem: ${unitId} cardIcon is null`);
        }
        
        // 2. 如果没有cardIcon，尝试获取unitIcon
        if (unitScript.unitIcon) {
            console.log(`TalentSystem: Setting card icon from ${unitId} unitIcon`);
            sprite.spriteFrame = unitScript.unitIcon;
            return true;
        } else {
            console.log(`TalentSystem: ${unitId} unitIcon is null`);
        }
        
        // 3. 尝试获取defaultSpriteFrame
        if (unitScript.defaultSpriteFrame) {
            console.log(`TalentSystem: Setting card icon from ${unitId} defaultSpriteFrame`);
            sprite.spriteFrame = unitScript.defaultSpriteFrame;
            return true;
        } else {
            console.log(`TalentSystem: ${unitId} defaultSpriteFrame is null`);
        }
        
        // 4. 尝试获取Sprite组件的spriteFrame
        const spriteComponent = node.getComponent(Sprite);
        if (spriteComponent) {
            if (spriteComponent.spriteFrame) {
                console.log(`TalentSystem: Setting card icon from ${unitId} Sprite component spriteFrame`);
                sprite.spriteFrame = spriteComponent.spriteFrame;
                return true;
            } else {
                console.log(`TalentSystem: ${unitId} Sprite component spriteFrame is null`);
            }
        } else {
            console.log(`TalentSystem: No Sprite component found on node for ${unitId}`);
        }
        
        return false;
    }
    
    /**
     * 尝试从场景中获取单位图标
     * @param unitId 单位ID
     * @param nodeName 节点名称
     * @param sprite Sprite组件
     * @param callback 回调函数，场景中未找到时调用
     */
    private tryGetIconFromScene(unitId: string, nodeName: string, sprite: Sprite, callback: () => void) {
        console.log(`TalentSystem: Trying to get icon from scene for unit ${unitId}`);
        
        // 获取Canvas节点
        const canvas = find('Canvas');
        if (!canvas) {
            console.error(`TalentSystem: Canvas not found`);
            callback();
            return;
        }
        
        let foundIcon = false;
        
        // 递归查找所有可能的单位节点
        const searchNodesForIcon = (node: Node) => {
            // 跳过卡片节点
            if (node.name.includes('UnitCard_')) {
                return;
            }
            
            // 检查节点名称是否匹配
            if (node.name === unitId || node.name === nodeName || 
                node.name.toLowerCase() === unitId.toLowerCase() || 
                node.name.toLowerCase() === nodeName.toLowerCase() ||
                node.name.includes(unitId) || node.name.includes(nodeName)) {
                
                // 尝试获取节点的脚本组件
                const componentName = unitId.charAt(0).toUpperCase() + unitId.slice(1);
                const unitScript = node.getComponent(componentName) as any || 
                                  node.getComponent(unitId) as any || 
                                  node.getComponent(nodeName) as any;
                
                if (unitScript) {
                    console.log(`TalentSystem: Found component in node ${node.name}`);
                    if (this.tryGetIconFromUnitScript(unitScript, node, sprite, unitId)) {
                        foundIcon = true;
                        return;
                    }
                }
                
                // 如果没有找到组件，尝试直接获取节点的Sprite组件的spriteFrame
                const spriteComponent = node.getComponent(Sprite);
                if (spriteComponent && spriteComponent.spriteFrame) {
                    console.log(`TalentSystem: Setting card icon from scene unit Sprite component spriteFrame`);
                    sprite.spriteFrame = spriteComponent.spriteFrame;
                    foundIcon = true;
                    return;
                }
                
                // 尝试查找子节点中的Sprite组件
                for (const child of node.children) {
                    const childSpriteComponent = child.getComponent(Sprite);
                    if (childSpriteComponent && childSpriteComponent.spriteFrame) {
                        console.log(`TalentSystem: Setting card icon from scene unit child Sprite component spriteFrame`);
                        sprite.spriteFrame = childSpriteComponent.spriteFrame;
                        foundIcon = true;
                        return;
                    }
                }
            }
            
            // 递归检查子节点
            for (const child of node.children) {
                if (foundIcon) {
                    return;
                }
                searchNodesForIcon(child);
            }
        };
        
        // 开始搜索
        searchNodesForIcon(canvas);
        
        // 特殊处理：检查各种单位容器
        if (!foundIcon) {
            // 检查 Arrower 单位（Towers 容器）
            if (unitId === 'Arrower') {
                // 先检查 Towers 容器
                const towersNode = find('Towers');
                if (towersNode) {
                    console.log(`TalentSystem: Checking Towers container for Arrower units, children count: ${towersNode.children.length}`);
                    for (const child of towersNode.children) {
                        const unitScript = child.getComponent('Arrower') as any;
                        if (unitScript) {
                            console.log(`TalentSystem: Found Arrower script in Towers container`);
                            if (this.tryGetIconFromUnitScript(unitScript, child, sprite, 'Arrower')) {
                                foundIcon = true;
                                break;
                            }
                        }
                    }
                }
                
                // 如果没找到，尝试递归查找所有 Arrower 节点
                if (!foundIcon) {
                    console.log(`TalentSystem: Searching for Arrower nodes recursively...`);
                    const searchArrower = (node: Node): boolean => {
                        if (node.name === 'Arrower' || node.getComponent('Arrower')) {
                            const unitScript = node.getComponent('Arrower') as any;
                            if (unitScript) {
                                console.log(`TalentSystem: Found Arrower node: ${node.name}`);
                                if (this.tryGetIconFromUnitScript(unitScript, node, sprite, 'Arrower')) {
                                    return true;
                                }
                            }
                            // 也尝试直接从节点的 Sprite 组件获取
                            const nodeSprite = node.getComponent(Sprite);
                            if (nodeSprite && nodeSprite.spriteFrame) {
                                console.log(`TalentSystem: Got icon from Arrower node Sprite component`);
                                sprite.spriteFrame = nodeSprite.spriteFrame;
                                return true;
                            }
                        }
                        for (const child of node.children) {
                            if (searchArrower(child)) {
                                return true;
                            }
                        }
                        return false;
                    };
                    if (canvas) {
                        foundIcon = searchArrower(canvas);
                    }
                }
                // 如果没找到，尝试从 WarAncientTree 的预制体获取
                if (!foundIcon) {
                    const warAncientTreeNode = find('WarAncientTree') || find('Canvas/WarAncientTree');
                    if (warAncientTreeNode) {
                        const warAncientTreeScript = warAncientTreeNode.getComponent('WarAncientTree') as any;
                        if (warAncientTreeScript && warAncientTreeScript.towerPrefab) {
                            console.log(`TalentSystem: Trying to get Arrower icon from WarAncientTree towerPrefab`);
                            const prefabInstance = instantiate(warAncientTreeScript.towerPrefab);
                            prefabInstance.active = true; // 确保激活
                            
                            const arrowerScript = prefabInstance.getComponent('Arrower') as any;
                            if (arrowerScript) {
                                if (this.tryGetIconFromUnitScript(arrowerScript, prefabInstance, sprite, 'Arrower')) {
                                    foundIcon = true;
                                }
                            }
                            
                            // 如果脚本方法没找到，直接尝试获取Sprite组件
                            if (!foundIcon) {
                                const arrowerSprite = prefabInstance.getComponent(Sprite);
                                if (arrowerSprite && arrowerSprite.spriteFrame) {
                                    console.log(`TalentSystem: Got Arrower icon from prefab Sprite component`);
                                    sprite.spriteFrame = arrowerSprite.spriteFrame;
                                    foundIcon = true;
                                }
                            }
                            
                            prefabInstance.destroy();
                        }
                    }
                }
            }
            // 检查 Hunter 单位（HunterHall 可能生产，也可能在 Towers 容器中）
            else if (unitId === 'Hunter') {
                // 先检查 Hunters 容器
                const huntersNode = find('Hunters');
                if (huntersNode) {
                    console.log(`TalentSystem: Checking Hunters container for Hunter units`);
                    for (const child of huntersNode.children) {
                        const unitScript = child.getComponent('Hunter') as any;
                        if (unitScript) {
                            if (this.tryGetIconFromUnitScript(unitScript, child, sprite, 'Hunter')) {
                                foundIcon = true;
                                break;
                            }
                        }
                    }
                }
                // 如果没找到，检查 Towers 容器（Hunter 可能也在那里）
                if (!foundIcon) {
                    const towersNode = find('Towers');
                    if (towersNode) {
                        console.log(`TalentSystem: Checking Towers container for Hunter units`);
                        for (const child of towersNode.children) {
                            const unitScript = child.getComponent('Hunter') as any;
                            if (unitScript) {
                                if (this.tryGetIconFromUnitScript(unitScript, child, sprite, 'Hunter')) {
                                    foundIcon = true;
                                    break;
                                }
                            }
                        }
                    }
                }
                // 如果还是没找到，尝试从 HunterHall 的预制体获取
                if (!foundIcon) {
                    const hunterHallNode = find('HunterHall') || find('Canvas/HunterHall');
                    if (hunterHallNode) {
                        const hunterHallScript = hunterHallNode.getComponent('HunterHall') as any;
                        if (hunterHallScript && hunterHallScript.hunterPrefab) {
                            console.log(`TalentSystem: Trying to get Hunter icon from HunterHall hunterPrefab`);
                            const prefabInstance = instantiate(hunterHallScript.hunterPrefab);
                            prefabInstance.active = true; // 确保激活
                            
                            const hunterScript = prefabInstance.getComponent('Hunter') as any;
                            if (hunterScript) {
                                if (this.tryGetIconFromUnitScript(hunterScript, prefabInstance, sprite, 'Hunter')) {
                                    foundIcon = true;
                                }
                            }
                            
                            // 如果脚本方法没找到，直接尝试获取Sprite组件
                            if (!foundIcon) {
                                const hunterSprite = prefabInstance.getComponent(Sprite);
                                if (hunterSprite && hunterSprite.spriteFrame) {
                                    console.log(`TalentSystem: Got Hunter icon from prefab Sprite component`);
                                    sprite.spriteFrame = hunterSprite.spriteFrame;
                                    foundIcon = true;
                                }
                            }
                            
                            prefabInstance.destroy();
                        }
                    }
                }
            }
            // 检查 Wisp 单位（可能在场景中）
            else if (unitId === 'Wisp') {
                const wispsNode = find('Wisps') || find('Canvas');
                if (wispsNode) {
                    console.log(`TalentSystem: Checking for Wisp units`);
                    const searchWisps = (node: Node) => {
                        const unitScript = node.getComponent('Wisp') as any;
                        if (unitScript) {
                            if (this.tryGetIconFromUnitScript(unitScript, node, sprite, 'Wisp')) {
                                foundIcon = true;
                                return true;
                            }
                        }
                        for (const child of node.children) {
                            if (searchWisps(child)) {
                                return true;
                            }
                        }
                        return false;
                    };
                    searchWisps(wispsNode);
                }
            }
            // 检查建筑物单位
            else if (unitId === 'WarAncientTree' || unitId === 'MoonWell' || unitId === 'Tree') {
                const buildingsNode = find('Buildings') || find('Canvas');
                if (buildingsNode) {
                    console.log(`TalentSystem: Checking for ${unitId} units`);
                    const searchBuildings = (node: Node) => {
                        const componentName = unitId.charAt(0).toUpperCase() + unitId.slice(1);
                        const unitScript = node.getComponent(componentName) as any || 
                                          node.getComponent(unitId) as any;
                        if (unitScript) {
                            if (this.tryGetIconFromUnitScript(unitScript, node, sprite, unitId)) {
                                foundIcon = true;
                                return true;
                            }
                        }
                        for (const child of node.children) {
                            if (searchBuildings(child)) {
                                return true;
                            }
                        }
                        return false;
                    };
                    searchBuildings(buildingsNode);
                }
            }
        }
        
        // 如果找到图标，返回；否则调用回调函数，从预制体获取
        if (!foundIcon) {
            callback();
        } else {
            console.log(`TalentSystem: Successfully got icon from scene for unit ${unitId}`);
        }
    }
    
    /**
     * 尝试从预制体获取单位图标
     * @param unitId 单位ID
     * @param nodeName 节点名称
     * @param sprite Sprite组件
     */
    private tryGetIconFromPrefab(unitId: string, nodeName: string, sprite: Sprite) {
        console.log(`TalentSystem: Trying to get icon from prefab for unit ${unitId}`);
        
        // 尝试从场景中的单位获取预制体引用
        let prefab: Prefab | null = null;
        
        // 根据单位ID查找对应的预制体
        if (unitId === 'Arrower') {
            // 1. 优先使用TalentSystem的arrowerPrefab属性
            console.log(`TalentSystem: Checking arrowerPrefab property, value: ${this.arrowerPrefab ? 'exists' : 'null/undefined'}`);
            if (this.arrowerPrefab) {
                console.log(`TalentSystem: Using arrowerPrefab from TalentSystem`);
                prefab = this.arrowerPrefab;
            } else {
                // 2. 优先从场景中的WarAncientTree获取towerPrefab（更可靠）
                console.log(`TalentSystem: arrowerPrefab is null, trying to get Arrower prefab from scene...`);
                let warAncientTreeNode = find('WarAncientTree') || find('Canvas/WarAncientTree');
                if (!warAncientTreeNode) {
                    const warAncientTreesContainer = find('WarAncientTrees');
                    if (warAncientTreesContainer && warAncientTreesContainer.children.length > 0) {
                        warAncientTreeNode = warAncientTreesContainer.children[0];
                        console.log(`TalentSystem: Found WarAncientTree from container`);
                    }
                }
                if (warAncientTreeNode) {
                    const warAncientTreeScript = warAncientTreeNode.getComponent('WarAncientTree') as any;
                    if (warAncientTreeScript) {
                        console.log(`TalentSystem: Found WarAncientTree script`);
                        if (warAncientTreeScript.towerPrefab) {
                            console.log(`TalentSystem: Found towerPrefab from WarAncientTree`);
                            prefab = warAncientTreeScript.towerPrefab;
                        } else {
                            console.log(`TalentSystem: WarAncientTree found but no towerPrefab`);
                        }
                    } else {
                        console.log(`TalentSystem: WarAncientTree node found but no script`);
                    }
                } else {
                    console.log(`TalentSystem: WarAncientTree node not found in scene`);
                }
                
                // 3. 如果场景中没有找到，尝试从resources加载
                if (!prefab) {
                    const prefabPath = 'prefabs/Arrower';
                    console.log(`TalentSystem: Trying to load Arrower prefab from resources, path: ${prefabPath}`);
                    const loadedPrefab = resources.get(prefabPath, Prefab);
                    if (loadedPrefab) {
                        console.log(`TalentSystem: Got Arrower prefab from resources (sync)`);
                        prefab = loadedPrefab;
                    } else {
                        // 异步加载 - 使用 assetManager 加载（支持任意路径）
                        console.log(`TalentSystem: Arrower prefab not in cache, loading async using assetManager...`);
                        const spriteRef = sprite; // 保存 sprite 引用
                        const unitIdRef = unitId; // 保存 unitId 引用
                        
                        // 尝试使用 assetManager 加载（支持 assets/prefabs/ 路径）
                        const fullPath = `db://assets/prefabs/Arrower`;
                        console.log(`TalentSystem: Trying to load Arrower from full path: ${fullPath}`);
                        
                        assetManager.loadAny({ path: fullPath, type: Prefab }, (err, asyncPrefab) => {
                            console.log(`TalentSystem: Arrower assetManager load callback executed, err: ${err ? err.message : 'null'}, prefab: ${asyncPrefab ? 'exists' : 'null'}`);
                            if (!err && asyncPrefab) {
                                console.log(`TalentSystem: Loaded Arrower prefab using assetManager (async), spriteRef: ${spriteRef ? 'exists' : 'null'}`);
                                if (spriteRef) {
                                    this.loadIconFromPrefabInstance(asyncPrefab as Prefab, unitIdRef, spriteRef);
                                } else {
                                    console.log(`TalentSystem: Sprite reference is null in callback for ${unitIdRef}`);
                                }
                            } else {
                                console.log(`TalentSystem: Failed to load Arrower prefab using assetManager, err: ${err}, trying resources.load...`);
                                // 降级到 resources.load
                                resources.load(prefabPath, Prefab, (err2, asyncPrefab2) => {
                                    console.log(`TalentSystem: Arrower resources.load callback executed, err: ${err2 ? err2.message : 'null'}, prefab: ${asyncPrefab2 ? 'exists' : 'null'}`);
                                    if (!err2 && asyncPrefab2) {
                                        console.log(`TalentSystem: Loaded Arrower prefab from resources (async), spriteRef: ${spriteRef ? 'exists' : 'null'}`);
                                        if (spriteRef) {
                                            this.loadIconFromPrefabInstance(asyncPrefab2, unitIdRef, spriteRef);
                                        }
                                    } else {
                                        console.log(`TalentSystem: Failed to load Arrower prefab from resources, err: ${err2}`);
                                    }
                                });
                            }
                        });
                        console.log(`TalentSystem: Arrower async load request sent, returning...`);
                        return; // 异步加载，先返回
                    }
                }
            }
        } else if (unitId === 'Hunter') {
            // 1. 优先从场景中的HunterHall获取hunterPrefab（更可靠）
            console.log(`TalentSystem: Trying to get Hunter prefab from scene...`);
            let hunterHallNode = find('HunterHall') || find('Canvas/HunterHall');
            if (!hunterHallNode) {
                const hunterHallsContainer = find('HunterHalls');
                if (hunterHallsContainer && hunterHallsContainer.children.length > 0) {
                    hunterHallNode = hunterHallsContainer.children[0];
                    console.log(`TalentSystem: Found HunterHall from container`);
                }
            }
            if (hunterHallNode) {
                const hunterHallScript = hunterHallNode.getComponent('HunterHall') as any;
                if (hunterHallScript) {
                    console.log(`TalentSystem: Found HunterHall script`);
                    if (hunterHallScript.hunterPrefab) {
                        console.log(`TalentSystem: Found hunterPrefab from HunterHall`);
                        prefab = hunterHallScript.hunterPrefab;
                    } else {
                        console.log(`TalentSystem: HunterHall found but no hunterPrefab`);
                    }
                } else {
                    console.log(`TalentSystem: HunterHall node found but no script`);
                }
            } else {
                console.log(`TalentSystem: HunterHall node not found in scene`);
            }
            
            // 2. 如果场景中没有找到，尝试从resources加载
            if (!prefab) {
                const prefabPath = 'prefabs/Hunter';
                console.log(`TalentSystem: Trying to load Hunter prefab from resources, path: ${prefabPath}`);
                const loadedPrefab = resources.get(prefabPath, Prefab);
                if (loadedPrefab) {
                    console.log(`TalentSystem: Got Hunter prefab from resources (sync)`);
                    prefab = loadedPrefab;
                } else {
                    // 异步加载
                    console.log(`TalentSystem: Hunter prefab not in cache, loading async...`);
                    resources.load(prefabPath, Prefab, (err, asyncPrefab) => {
                        console.log(`TalentSystem: Hunter async load callback, err: ${err}, prefab: ${asyncPrefab ? 'exists' : 'null'}`);
                        if (!err && asyncPrefab) {
                            console.log(`TalentSystem: Loaded Hunter prefab from resources (async)`);
                            this.loadIconFromPrefabInstance(asyncPrefab, unitId, sprite);
                        } else {
                            console.log(`TalentSystem: Failed to load Hunter prefab from resources`);
                        }
                    });
                    return; // 异步加载，先返回
                }
            }
        } else if (unitId === 'WarAncientTree') {
            // 从TowerBuilder获取warAncientTreePrefab
            const towerBuilderNode = find('TowerBuilder') || find('Canvas/TowerBuilder');
            if (towerBuilderNode) {
                const towerBuilderScript = towerBuilderNode.getComponent('TowerBuilder') as any;
                if (towerBuilderScript && towerBuilderScript.warAncientTreePrefab) {
                    prefab = towerBuilderScript.warAncientTreePrefab;
                }
            }
        } else if (unitId === 'MoonWell') {
            // 从TowerBuilder获取moonWellPrefab
            const towerBuilderNode = find('TowerBuilder') || find('Canvas/TowerBuilder');
            if (towerBuilderNode) {
                const towerBuilderScript = towerBuilderNode.getComponent('TowerBuilder') as any;
                if (towerBuilderScript && towerBuilderScript.moonWellPrefab) {
                    prefab = towerBuilderScript.moonWellPrefab;
                }
            }
        } else if (unitId === 'Tree') {
            // 从TowerBuilder获取treePrefab
            const towerBuilderNode = find('TowerBuilder') || find('Canvas/TowerBuilder');
            if (towerBuilderNode) {
                const towerBuilderScript = towerBuilderNode.getComponent('TowerBuilder') as any;
                if (towerBuilderScript && towerBuilderScript.treePrefab) {
                    prefab = towerBuilderScript.treePrefab;
                }
            }
        } else if (unitId === 'Wisp') {
            // 从Crystal获取wispPrefab
            const crystalNode = find('Crystal') || find('Canvas/Crystal');
            if (crystalNode) {
                const crystalScript = crystalNode.getComponent('Crystal') as any;
                if (crystalScript && crystalScript.wispPrefab) {
                    prefab = crystalScript.wispPrefab;
                }
            }
        }
        
        // 如果找到预制体，尝试从中获取图标
        if (prefab) {
            console.log(`TalentSystem: Found prefab for ${unitId}, creating instance`);
            this.loadIconFromPrefabInstance(prefab, unitId, sprite);
        } else {
            console.warn(`TalentSystem: Prefab not found for ${unitId}. Tried to find from scene nodes.`);
        }
    }
    
    /**
     * 从预制体实例加载图标
     * @param prefab 预制体
     * @param unitId 单位ID
     * @param sprite Sprite组件
     */
    private loadIconFromPrefabInstance(prefab: Prefab, unitId: string, sprite: Sprite) {
        console.log(`TalentSystem: Loading icon from prefab instance for ${unitId}, prefab: ${prefab ? 'exists' : 'null'}, sprite: ${sprite ? 'exists' : 'null'}`);
        if (!prefab) {
            console.log(`TalentSystem: Prefab is null for ${unitId}`);
            return;
        }
        if (!sprite) {
            console.log(`TalentSystem: Sprite is null for ${unitId}`);
            return;
        }
        
        // 先尝试直接从预制体数据获取 SpriteFrame（不需要实例化）
        const prefabData = prefab.data;
        if (prefabData) {
            console.log(`TalentSystem: Checking prefab data for ${unitId}, prefabData: ${prefabData ? 'exists' : 'null'}`);
            const prefabSprite = prefabData.getComponent(Sprite);
            if (prefabSprite) {
                console.log(`TalentSystem: Found Sprite component in prefab data for ${unitId}, spriteFrame: ${prefabSprite.spriteFrame ? 'exists' : 'null'}`);
                // 如果 spriteFrame 存在，直接使用
                if (prefabSprite.spriteFrame) {
                    console.log(`TalentSystem: Got spriteFrame directly from prefab data for ${unitId}`);
                    sprite.spriteFrame = prefabSprite.spriteFrame;
                    console.log(`TalentSystem: Icon set from prefab data, spriteFrame: ${sprite.spriteFrame ? 'set' : 'not set'}`);
                    return;
                }
                // 如果 spriteFrame 为空，尝试强制刷新
                console.log(`TalentSystem: Prefab Sprite spriteFrame is null, trying to refresh...`);
                prefabSprite.enabled = false;
                prefabSprite.enabled = true;
                // 等待一帧再检查
                this.scheduleOnce(() => {
                    if (prefabSprite.spriteFrame) {
                        console.log(`TalentSystem: Got spriteFrame after refresh from prefab data for ${unitId}`);
                        sprite.spriteFrame = prefabSprite.spriteFrame;
                        console.log(`TalentSystem: Icon set from prefab data after refresh, spriteFrame: ${sprite.spriteFrame ? 'set' : 'not set'}`);
                    } else {
                        console.log(`TalentSystem: Prefab Sprite spriteFrame is still null after refresh for ${unitId}, will try instantiating`);
                    }
                }, 0);
            } else {
                console.log(`TalentSystem: No Sprite component found in prefab data for ${unitId}`);
            }
        } else {
            console.log(`TalentSystem: Prefab data is null for ${unitId}`);
        }
        
        console.log(`TalentSystem: Instantiating prefab for ${unitId}...`);
        const prefabInstance = instantiate(prefab);
        if (prefabInstance) {
            console.log(`TalentSystem: Prefab instance created for ${unitId}`);
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
                console.log(`TalentSystem: Found ${componentName} component in prefab instance`);
            } else {
                console.log(`TalentSystem: No ${componentName} component found in prefab instance`);
            }
            
            // 使用统一的图标获取逻辑（优先从组件属性获取）
            if (unitScript && this.tryGetIconFromUnitScript(unitScript, prefabInstance, sprite, unitId)) {
                console.log(`TalentSystem: Successfully loaded icon from unit script for ${unitId}, spriteFrame: ${sprite.spriteFrame ? 'set' : 'not set'}`);
                prefabInstance.destroy();
                return;
            }
            
            // 如果单位脚本中没有找到图标，尝试从Sprite组件获取
            // 4. 尝试从根节点获取Sprite组件（优先检查这个，因为大部分单位的Sprite在根节点）
            const rootSprite = prefabInstance.getComponent(Sprite);
            if (rootSprite) {
                console.log(`TalentSystem: Found root Sprite component for ${unitId}, spriteFrame: ${rootSprite.spriteFrame ? 'exists' : 'null'}`);
                
                // 立即检查 spriteFrame
                if (rootSprite.spriteFrame) {
                    console.log(`TalentSystem: Setting card icon from prefab root Sprite spriteFrame for ${unitId} (immediate)`);
                    sprite.spriteFrame = rootSprite.spriteFrame;
                    console.log(`TalentSystem: Icon set successfully for ${unitId}, spriteFrame: ${sprite.spriteFrame ? 'set' : 'not set'}`);
                    prefabInstance.destroy();
                    return;
                }
                
                // 如果 spriteFrame 为空，强制刷新并等待
                console.log(`TalentSystem: Root Sprite spriteFrame is null, refreshing and waiting...`);
                rootSprite.enabled = false;
                rootSprite.enabled = true;
                
                const spriteRef = sprite;
                const prefabRef = prefabInstance;
                const rootSpriteRef = rootSprite;
                
                // 等待一帧确保组件初始化
                this.scheduleOnce(() => {
                    let spriteFrame = rootSpriteRef.spriteFrame;
                    console.log(`TalentSystem: After first wait, spriteFrame: ${spriteFrame ? 'exists' : 'null'}`);
                    
                    if (spriteFrame) {
                        console.log(`TalentSystem: Setting card icon from prefab root Sprite spriteFrame for ${unitId} (after wait)`);
                        spriteRef.spriteFrame = spriteFrame;
                        console.log(`TalentSystem: Icon set successfully for ${unitId}, spriteFrame: ${spriteRef.spriteFrame ? 'set' : 'not set'}`);
                        prefabRef.destroy();
                    } else {
                        // 再次尝试刷新
                        console.log(`TalentSystem: Still no spriteFrame, trying second refresh...`);
                        rootSpriteRef.enabled = false;
                        rootSpriteRef.enabled = true;
                        this.scheduleOnce(() => {
                            spriteFrame = rootSpriteRef.spriteFrame;
                            console.log(`TalentSystem: After second wait, spriteFrame: ${spriteFrame ? 'exists' : 'null'}`);
                            
                            if (spriteFrame) {
                                console.log(`TalentSystem: Setting card icon from prefab root Sprite spriteFrame for ${unitId} (after second wait)`);
                                spriteRef.spriteFrame = spriteFrame;
                                console.log(`TalentSystem: Icon set successfully for ${unitId}, spriteFrame: ${spriteRef.spriteFrame ? 'set' : 'not set'}`);
                            } else {
                                console.log(`TalentSystem: Root Sprite spriteFrame is still null after second wait for ${unitId}, rootSprite enabled: ${rootSpriteRef.enabled}`);
                            }
                            prefabRef.destroy();
                        }, 0.05); // 等待 0.05 秒
                    }
                }, 0.05); // 等待 0.05 秒
                return; // 等待中，先返回
            } else {
                console.log(`TalentSystem: No root Sprite component found for ${unitId}`);
            }
            
            // 5. 尝试从子节点中查找Sprite组件（有些单位的Sprite可能在子节点中）
            const childSprite = findSpriteInChildren(prefabInstance);
            if (childSprite) {
                console.log(`TalentSystem: Found child Sprite component for ${unitId}`);
                if (childSprite.spriteFrame) {
                    console.log(`TalentSystem: Setting card icon from prefab child Sprite spriteFrame for ${unitId}`);
                    sprite.spriteFrame = childSprite.spriteFrame;
                    console.log(`TalentSystem: Icon set successfully from child Sprite for ${unitId}, spriteFrame: ${sprite.spriteFrame ? 'set' : 'not set'}`);
                    prefabInstance.destroy();
                    return;
                } else {
                    // 如果spriteFrame为空，尝试等待一帧
                    console.log(`TalentSystem: Child Sprite found but spriteFrame is null for ${unitId}, waiting for initialization...`);
                    const spriteRef = sprite;
                    const prefabRef = prefabInstance;
                    const childSpriteRef = childSprite;
                    
                    this.scheduleOnce(() => {
                        let spriteFrame = childSpriteRef.spriteFrame;
                        if (!spriteFrame) {
                            childSpriteRef.enabled = false;
                            childSpriteRef.enabled = true;
                            spriteFrame = childSpriteRef.spriteFrame;
                        }
                        
                        if (spriteFrame) {
                            console.log(`TalentSystem: Got child spriteFrame after waiting for ${unitId}`);
                            spriteRef.spriteFrame = spriteFrame;
                            console.log(`TalentSystem: Icon set successfully from child Sprite after waiting for ${unitId}, spriteFrame: ${spriteRef.spriteFrame ? 'set' : 'not set'}`);
                        } else {
                            console.log(`TalentSystem: Still no child spriteFrame after waiting for ${unitId}`);
                        }
                        prefabRef.destroy();
                    }, 0.1);
                    return; // 等待中，先返回
                }
            } else {
                console.log(`TalentSystem: No child Sprite component found for ${unitId}`);
            }
            
            // 6. 如果还是没有找到，输出警告
            console.log(`TalentSystem: Could not find spriteFrame in prefab for ${unitId}, tried: cardIcon, unitIcon, defaultSpriteFrame, root Sprite, child Sprite`);
            
            prefabInstance.destroy();
        } else {
            console.log(`TalentSystem: Failed to instantiate prefab for ${unitId}`);
        }
        
        // 如果都获取不到，保持Sprite组件为空（不显示图标）
        console.log(`TalentSystem: Could not get icon for ${unitId}, sprite will remain empty`);
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
            console.error(`TalentSystem: Talent ${talentId} not found!`);
            return;
        }
        
        // 检查是否可以升级
        if (talent.level >= talent.maxLevel) {
            console.log(`TalentSystem: Talent ${talentId} already at max level!`);
            return;
        }
        
        if (this.talentPoints < talent.cost) {
            console.log(`TalentSystem: Not enough talent points for ${talentId}!`);
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
        
        console.log(`TalentSystem: Upgraded talent ${talentId} to level ${talent.level}!`);
    }
    
    applyTalentEffect(talent: Talent) {
        // 这里可以添加实际的天赋效果应用逻辑
        // 例如，遍历所有友方单位并增加相应属性
        console.log(`TalentSystem: Applied talent effect - ${talent.name}: +${talent.value}% ${TalentType[talent.type]}`);
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