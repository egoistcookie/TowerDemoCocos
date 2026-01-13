import { _decorator, Component, Node, Button, Label, find, director, UITransform, Color, Graphics, tween, Vec3, UIOpacity, Sprite, SpriteFrame, Prefab, instantiate, assetManager, director as directorModule, resources } from 'cc';
import { UnitConfigManager } from './UnitConfigManager';
import { PlayerDataManager, UnitEnhancement } from './PlayerDataManager';
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
    private talentPoints: number = 0; // 初始天赋点
    private playerDataManager: PlayerDataManager = null!;
    private expLabelNode: Node = null!; // 经验值标签节点
    
    start() {
        // 初始化玩家数据管理器
        this.playerDataManager = PlayerDataManager.getInstance();
        this.playerDataManager.loadData().then(() => {
            // 从PlayerDataManager加载天赋点
            this.talentPoints = this.playerDataManager.getTalentPoints();
            // 初始化天赋数据
            this.initTalents();
        }).catch((err) => {
            // 如果加载失败，使用默认值
            this.initTalents();
        });
        
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
        // 预加载所有单位预制体
        const prefabPaths = [
            'prefabs/Arrower', 
            'prefabs/Hunter',
            'prefabs/WarAncientTree',
            'prefabs/ElfSwordsman',
            'prefabs/Priest',
            'prefabs/HunterHall',
            'prefabs/SwordsmanHall',
            'prefabs/Church',
            'prefabs/StoneWall'
        ];
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
        
        // 如果PlayerDataManager未初始化，初始化它
        if (!this.playerDataManager) {
            this.playerDataManager = PlayerDataManager.getInstance();
            this.playerDataManager.loadData().then(() => {
                this.talentPoints = this.playerDataManager.getTalentPoints();
            }).catch((err) => {
            });
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
            value: 1, // 每级+1%攻击力
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
            value: 2, // 每级+2%生命值
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
        
        // 从PlayerDataManager加载已保存的天赋等级
        this.loadTalentLevels();
    }
    
    /**
     * 从PlayerDataManager加载已保存的天赋等级
     */
    loadTalentLevels() {
        if (!this.playerDataManager) {
            return;
        }
        
        // 遍历所有天赋，从持久化数据中加载等级
        for (const [talentId, talent] of this.talents.entries()) {
            const savedLevel = this.playerDataManager.getTalentLevel(talentId);
            if (savedLevel !== undefined && savedLevel >= 0 && savedLevel <= talent.maxLevel) {
                talent.level = savedLevel;
            }
        }
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
        tabsNode.setPosition(0, 300, 0); // 调整标签页位置，适应更大的面板（向上移动100）
        
        // 确保标签页容器处于激活状态
        tabsNode.active = true;
        
        // 标签配置
        const tabs = [
            { id: 'talents', name: '天赋升级' },
            { id: 'units', name: '单位详情' }
        ];
        
        // 创建标签按钮（水平居中）
        const buttonWidth = 150;
        const buttonSpacing = 10;
        const totalWidth = buttonWidth * tabs.length + buttonSpacing * (tabs.length - 1);
        const startX = -totalWidth / 2 + buttonWidth / 2;
        
        for (let i = 0; i < tabs.length; i++) {
            const tab = tabs[i];
            const tabButton = new Node(`Tab_${tab.id}`);
            tabButton.setParent(tabsNode);
            const xPos = startX + i * (buttonWidth + buttonSpacing);
            tabButton.setPosition(xPos, 0, 0);
            
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
            
            // 添加UITransform组件（Button需要UITransform来定义点击区域）
            const tabButtonTransform = tabButton.addComponent(UITransform);
            tabButtonTransform.setContentSize(150, 40);
            tabButtonTransform.setAnchorPoint(0.5, 0.5);
            
            // 创建按钮文本节点（作为子节点，确保文本正确显示）
            const buttonTextNode = new Node('ButtonText');
            buttonTextNode.setParent(tabButton);
            buttonTextNode.setPosition(0, 0, 0);
            
            // 为文本节点添加UITransform
            const buttonTextTransform = buttonTextNode.addComponent(UITransform);
            buttonTextTransform.setContentSize(150, 40);
            buttonTextTransform.setAnchorPoint(0.5, 0.5);
            
            // 添加按钮文本
            const buttonText = buttonTextNode.addComponent(Label);
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
        
        // 更新天赋点和经验值显示
        this.updateTalentPointsDisplay();
    }
    
    createUnitCardsGrid() {
        // 友方单位列表
        const unitTypes = [
            // 建筑物单位
            { id: 'WarAncientTree', name: '弓箭手小屋', description: '能够训练弓箭手的建筑物，同时拥有远程攻击能力', icon: 'WarAncientTree', unitType: 'BUILDING' },
            { id: 'HunterHall', name: '猎手大厅', description: '能够训练女猎手的建筑物', icon: 'HunterHall', unitType: 'BUILDING' },
            { id: 'SwordsmanHall', name: '剑士小屋', description: '能够生产精灵剑士的建筑物，提供强大的近战攻击单位', icon: 'SwordsmanHall', unitType: 'BUILDING' },
            { id: 'Church', name: '教堂', description: '训练牧师的建筑，可以持续生产为友军治疗的辅助单位', icon: 'Church', unitType: 'BUILDING' },
            { id: 'StoneWall', name: '石墙', description: '坚固的石墙，可以阻挡敌人的进攻路线', icon: 'StoneWall', unitType: 'BUILDING' },
            // 角色单位
            { id: 'Arrower', name: '弓箭手', description: '远程攻击单位，能够攻击远处的敌人，射速较快', icon: 'Arrower', unitType: 'CHARACTER' },
            { id: 'Hunter', name: '女猎手', description: '远程攻击单位，投掷回旋镖攻击敌人，回旋镖可以反弹多次', icon: 'Hunter', unitType: 'CHARACTER' },
            { id: 'ElfSwordsman', name: '精灵剑士', description: '近战攻击单位，使用剑进行近距离战斗', icon: 'ElfSwordsman', unitType: 'CHARACTER' },
            { id: 'Priest', name: '牧师', description: '辅助单位，治疗附近受伤的友军', icon: 'Priest', unitType: 'CHARACTER' },
        ];
        
        let cardWidth = 200;
        let cardHeight = 230; 
        
        // 3列布局
        const columns = 3;
        
        const startX = -210;
        const startY = 10; // 稍微向下偏移，避免与顶部标签重叠
        const spacingX = cardWidth + 10; // 卡片宽度 + 间距
        const spacingY = cardHeight + 10; // 卡片高度 + 行间距
        
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
            
            this.createUnitCard(unit, xPos, yPos, cardWidth, cardHeight, cardsContainer);
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
        
        // 创建单位等级标签（显示使用的天赋点数）
        const levelNode = new Node('UnitLevel');
        levelNode.setParent(cardNode);
        levelNode.setPosition(0, -65, 0);
        // 确保等级节点处于激活状态
        levelNode.active = true;
        
        const levelLabel = levelNode.addComponent(Label);
        const unitLevel = this.getUnitTalentPointsUsed(unit.id);
        levelLabel.string = `等级: ${unitLevel}`;
        levelLabel.fontSize = 14;
        levelLabel.color = new Color(255, 200, 100, 255); // 使用金色显示等级
        levelLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        
        // 创建查看详情按钮
        const detailButton = new Node('DetailButton');
        detailButton.setParent(cardNode);
        detailButton.setPosition(0, -95, 0);
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
        
        // 添加内容背景（增加高度以容纳强化功能）
        const contentTransform = contentNode.addComponent(UITransform);
        contentTransform.setContentSize(500, 750);
        contentTransform.setAnchorPoint(0.5, 0.5);
        
        // 创建详情面板背景
        const contentBackground = contentNode.addComponent(Graphics);
        contentBackground.fillColor = new Color(70, 70, 90, 255);
        contentBackground.roundRect(-250, -375, 500, 750, 10);
        contentBackground.fill();
        
        // 创建详情面板边框
        if (this.detailPanelBorderFrame) {
            // 使用边框贴图
            const borderNode = new Node('DetailPanelBorder');
            borderNode.setParent(contentNode);
            borderNode.setPosition(0, 0, 0);
            borderNode.active = true;
            
            const borderTransform = borderNode.addComponent(UITransform);
            borderTransform.setContentSize(500, 750);
            borderTransform.setAnchorPoint(0.5, 0.5);
            
            const borderSprite = borderNode.addComponent(Sprite);
            borderSprite.spriteFrame = this.detailPanelBorderFrame;
            borderSprite.type = Sprite.Type.SIMPLE;
            borderSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        } else {
            // 使用 Graphics 绘制边框（降级方案）
            contentBackground.lineWidth = 2;
            contentBackground.strokeColor = new Color(120, 170, 220, 255);
            contentBackground.roundRect(-250, -375, 500, 750, 10);
            contentBackground.stroke();
        }
        
        // 创建关闭按钮
        const closeButton = new Node('CloseButton');
        closeButton.setParent(contentNode);
        closeButton.setPosition(220, 345, 0);
        
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
        closeButtonText.fontSize = 18;
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
        nameLabel.fontSize = 34;
        nameLabel.color = Color.WHITE;
        nameLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        
        // 创建单位类型
        const typeNode = new Node('UnitType');
        typeNode.setParent(contentNode);
        typeNode.setPosition(0, 120, 0);
        
        const typeLabel = typeNode.addComponent(Label);
        typeLabel.string = this.getUnitTypeDisplayName(unit.unitType);
        typeLabel.fontSize = 20;
        typeLabel.color = Color.GRAY;
        typeLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        
        // 创建单位描述
        const descNode = new Node('UnitDescription');
        descNode.setParent(contentNode);
        descNode.setPosition(0, 60, 0);
        
        const descLabel = descNode.addComponent(Label);
        descLabel.string = unit.description;
        descLabel.fontSize = 18;
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
        statsNode.setPosition(0, 50, 0);
        
        // 从配置文件获取单位基础属性
        const configManager = UnitConfigManager.getInstance();
        const unitConfig = configManager.getUnitConfig(unit.id);
        const baseStats = unitConfig?.baseStats || {};
        
        // 获取单位卡片强化数据
        const unitEnhancement = this.playerDataManager.getUnitEnhancement(unit.id);
        const enhancements = unitEnhancement?.enhancements || {};
        
        // 获取公共天赋增幅值（不需要实例化，只需要计算值）
        
        // 属性映射：显示名称 -> 属性键名（角色单位不显示护甲）
        const statMapping: Record<string, { key: string, format?: (val: number) => string }> = {
            '生命值': { key: 'maxHealth', format: (v) => Math.floor(v).toString() },
            '攻击力': { key: 'attackDamage', format: (v) => Math.floor(v).toString() },
            '攻击速度': { key: 'attackInterval', format: (v) => v.toFixed(2) + '秒' },
            '移动速度': { key: 'moveSpeed', format: (v) => Math.floor(v).toString() }
        };
        
        // 显示属性（只显示基础属性）
        let yOffset = 0;
        for (const displayName in statMapping) {
            if (statMapping.hasOwnProperty(displayName)) {
                const mapping = statMapping[displayName];
                const statKey = mapping.key;
                const formatFunc = mapping.format || ((v) => v.toString());
                
                // 获取基础值
                let baseValue = baseStats[statKey] || 0;
                
                // 只显示有值的属性
                if (baseValue > 0) {
                    const statNode = new Node(`Stat_${statKey}`);
                    statNode.setParent(statsNode);
                    statNode.setPosition(0, yOffset, 0);
                    
                    // 构建显示文本（只显示基础值）
                    const displayText = `${displayName}: ${formatFunc(baseValue)}`;
                    
                    const statLabel = statNode.addComponent(Label);
                    statLabel.string = displayText;
                    statLabel.fontSize = 16;
                    statLabel.color = Color.WHITE; // 统一使用白色
                    statLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
                    
                    yOffset -= 25;
                }
            }
        }
        
        // 创建强化功能区域
        this.createEnhancementSection(unit, contentNode, detailPanel);
        
        // 创建关闭面板的事件（点击遮罩关闭）
        maskNode.on(Node.EventType.TOUCH_END, () => {
            detailPanel.destroy();
        }, this);
    }
    
    /**
     * 创建强化功能区域
     */
    createEnhancementSection(unit: any, contentNode: Node, detailPanel: Node) {
        // 创建强化区域标题
        const enhancementTitleNode = new Node('EnhancementTitle');
        enhancementTitleNode.setParent(contentNode);
        enhancementTitleNode.setPosition(0, -120, 0);
        
        const enhancementTitleLabel = enhancementTitleNode.addComponent(Label);
        enhancementTitleLabel.string = '单位强化';
        enhancementTitleLabel.fontSize = 22;
        enhancementTitleLabel.color = new Color(255, 200, 100, 255);
        enhancementTitleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        
        // 获取当前单位的强化数据
        const currentEnhancement = this.playerDataManager.getUnitEnhancement(unit.id);
        
        // 显示当前强化状态
        const enhancementStatusNode = new Node('EnhancementStatus');
        enhancementStatusNode.setParent(contentNode);
        enhancementStatusNode.setPosition(0, -150, 0);
        
        let statusText = '当前强化：';
        if (currentEnhancement && currentEnhancement.enhancements) {
            const enhancements = currentEnhancement.enhancements;
            const parts: string[] = [];
            if (enhancements.attackDamage) parts.push(`攻击力+${enhancements.attackDamage}`);
            if (enhancements.attackSpeed) parts.push(`攻击速度+${enhancements.attackSpeed}%`);
            if (enhancements.maxHealth) parts.push(`生命值+${enhancements.maxHealth}`);
            if (enhancements.moveSpeed) parts.push(`移动速度+${enhancements.moveSpeed}`);
            if (enhancements.buildCost) parts.push(`建造成本-${Math.abs(enhancements.buildCost)}`);
            statusText += parts.length > 0 ? parts.join(', ') : '无';
        } else {
            statusText += '无';
        }
        
        const statusLabel = enhancementStatusNode.addComponent(Label);
        statusLabel.string = statusText;
        statusLabel.fontSize = 16;
        statusLabel.color = Color.WHITE;
        statusLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        
        // 创建可强化属性列表
        const enhancementButtonsNode = new Node('EnhancementButtons');
        enhancementButtonsNode.setParent(contentNode);
        enhancementButtonsNode.setPosition(0, -200, 0);
        
        // 根据单位类型确定可强化的属性列表
        let enhancementOptions: Array<{ key: string, name: string, value: number, unit: string }> = [];
        
        if (unit.unitType === 'BUILDING') {
            // 建筑物：除弓箭手小屋外，只能强化生命值和建造成本
            if (unit.id === 'WarAncientTree') {
                // 弓箭手小屋：可以强化所有属性（除了护甲和移动速度）
                enhancementOptions = [
                    { key: 'attackDamage', name: '攻击力', value: 1, unit: '' },
                    { key: 'attackSpeed', name: '攻击速度', value: 5, unit: '%' },
                    { key: 'maxHealth', name: '生命值', value: 2, unit: '' }
                ];
            } else {
                // 其他建筑物：只能强化生命值和建造成本
                enhancementOptions = [
                    { key: 'maxHealth', name: '生命值', value: 2, unit: '' },
                    { key: 'buildCost', name: '建造成本', value: -1, unit: '金币' } // 负数表示减少
                ];
            }
        } else {
            // 角色单位：只显示基础属性（攻击力、攻击速度、生命值、移动速度），不显示护甲
            enhancementOptions = [
                { key: 'attackDamage', name: '攻击力', value: 1, unit: '' },
                { key: 'attackSpeed', name: '攻击速度', value: 5, unit: '%' },
                { key: 'maxHealth', name: '生命值', value: 2, unit: '' },
                { key: 'moveSpeed', name: '移动速度', value: 5, unit: '' }
            ];
        }
        
        let buttonYOffset = 0;
        for (const option of enhancementOptions) {
            const buttonNode = new Node(`EnhanceButton_${option.key}`);
            buttonNode.setParent(enhancementButtonsNode);
            buttonNode.setPosition(0, buttonYOffset, 0);
            
            // 添加按钮背景
            const buttonBackground = buttonNode.addComponent(Graphics);
            buttonBackground.fillColor = new Color(80, 120, 160, 200);
            buttonBackground.roundRect(-200, -15, 400, 30, 5);
            buttonBackground.fill();
            
            buttonBackground.lineWidth = 1;
            buttonBackground.strokeColor = new Color(100, 150, 200, 255);
            buttonBackground.roundRect(-200, -15, 400, 30, 5);
            buttonBackground.stroke();
            
            // 添加UITransform
            const buttonTransform = buttonNode.addComponent(UITransform);
            buttonTransform.setContentSize(400, 30);
            buttonTransform.setAnchorPoint(0.5, 0.5);
            
            // 创建按钮文本
            const buttonTextNode = new Node('ButtonText');
            buttonTextNode.setParent(buttonNode);
            buttonTextNode.setPosition(0, 0, 0);
            
            const buttonTextLabel = buttonTextNode.addComponent(Label);
            const currentValue = currentEnhancement?.enhancements?.[option.key as keyof typeof currentEnhancement.enhancements] || 0;
            
            // 构建显示文本
            let displayText = '';
            if (option.key === 'buildCost') {
                // 建造成本显示特殊格式
                const currentCostReduction = currentValue || 0;
                displayText = `${option.name} ${option.value > 0 ? '+' : ''}${option.value}${option.unit} (当前: ${currentCostReduction > 0 ? '+' : ''}${currentCostReduction}${option.unit}) [消耗1天赋点]`;
            } else {
                displayText = `${option.name} +${option.value}${option.unit} (当前: +${currentValue}${option.unit}) [消耗1天赋点]`;
            }
            
            buttonTextLabel.string = displayText;
            buttonTextLabel.fontSize = 16;
            buttonTextLabel.color = Color.WHITE;
            buttonTextLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            
            // 添加Button组件
            const buttonComp = buttonNode.addComponent(Button);
            
            // 绑定点击事件
            buttonComp.node.on(Button.EventType.CLICK, () => {
                this.enhanceUnitProperty(unit.id, option.key, option.value, detailPanel);
            }, this);
            
            buttonYOffset -= 35;
        }
    }
    
    /**
     * 强化单位属性
     */
    enhanceUnitProperty(unitId: string, propertyKey: string, value: number, detailPanel: Node) {
        // 检查是否有足够的天赋点
        if (!this.playerDataManager) {
            return;
        }
        
        const currentTalentPoints = this.playerDataManager.getTalentPoints();
        if (currentTalentPoints < 1) {
            // 显示提示：天赋点不足
            return;
        }
        
        // 获取当前强化数据
        let enhancement = this.playerDataManager.getUnitEnhancement(unitId);
        if (!enhancement) {
            enhancement = {
                unitId: unitId,
                enhancements: {}
            };
        }
        
        // 更新强化值
        const currentValue = enhancement.enhancements[propertyKey as keyof typeof enhancement.enhancements] || 0;
        enhancement.enhancements[propertyKey as keyof typeof enhancement.enhancements] = (currentValue as number) + value;
        
        // 保存强化数据
        this.playerDataManager.setUnitEnhancement(unitId, enhancement);
        
        // 消耗天赋点
        this.playerDataManager.useTalentPoint(1);
        this.talentPoints = this.playerDataManager.getTalentPoints();
        
        // 更新天赋点显示
        this.updateTalentPointsDisplay();
        
        // 更新卡片上的等级显示
        this.updateUnitCardLevel(unitId);
        
        // 重新创建详情面板以显示更新后的数据
        detailPanel.destroy();
        // 重新获取unit对象（需要从单位列表中找到）
        const unitTypes = [
            { id: 'WarAncientTree', name: '弓箭手小屋', description: '能够训练弓箭手的建筑物，同时拥有远程攻击能力', icon: 'WarAncientTree', unitType: 'BUILDING' },
            { id: 'HunterHall', name: '猎手大厅', description: '能够训练女猎手的建筑物', icon: 'HunterHall', unitType: 'BUILDING' },
            { id: 'SwordsmanHall', name: '剑士小屋', description: '能够生产精灵剑士的建筑物，提供强大的近战攻击单位', icon: 'SwordsmanHall', unitType: 'BUILDING' },
            { id: 'Church', name: '教堂', description: '训练牧师的建筑，可以持续生产为友军治疗的辅助单位', icon: 'Church', unitType: 'BUILDING' },
            { id: 'StoneWall', name: '石墙', description: '坚固的石墙，可以阻挡敌人的进攻路线', icon: 'StoneWall', unitType: 'BUILDING' },
            { id: 'Arrower', name: '弓箭手', description: '远程攻击单位，能够攻击远处的敌人，射速较快', icon: 'Arrower', unitType: 'CHARACTER' },
            { id: 'Hunter', name: '女猎手', description: '远程攻击单位，投掷回旋镖攻击敌人，回旋镖可以反弹多次', icon: 'Hunter', unitType: 'CHARACTER' },
            { id: 'ElfSwordsman', name: '精灵剑士', description: '近战攻击单位，使用剑进行近距离战斗', icon: 'ElfSwordsman', unitType: 'CHARACTER' },
            { id: 'Priest', name: '牧师', description: '辅助单位，治疗附近受伤的友军', icon: 'Priest', unitType: 'CHARACTER' },
        ];
        const unit = unitTypes.find(u => u.id === unitId);
        if (unit) {
            this.showUnitDetail(unit);
        }
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
                'elf_swordsman': 'ElfSwordsman',
                'ElfSwordsman': 'ElfSwordsman',
                'priest': 'Priest',
                'Priest': 'Priest',
                'hunter_hall': 'HunterHall',
                'HunterHall': 'HunterHall',
                'swordsman_hall': 'SwordsmanHall',
                'SwordsmanHall': 'SwordsmanHall',
                'church': 'Church',
                'Church': 'Church',
                'stone_wall': 'StoneWall',
                'StoneWall': 'StoneWall',
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
     * 更新单位卡片上的等级显示
     * @param unitId 单位ID
     */
    private updateUnitCardLevel(unitId: string) {
        if (!this.talentPanel) {
            return;
        }
        
        // 查找对应的卡片节点
        const cardNodeName = `UnitCard_${unitId}`;
        const cardsContainer = this.talentPanel.getChildByName('UnitCardsContainer');
        if (!cardsContainer) {
            return;
        }
        
        const cardNode = cardsContainer.getChildByName(cardNodeName);
        if (!cardNode) {
            return;
        }
        
        // 查找等级节点
        const levelNode = cardNode.getChildByName('UnitLevel');
        if (!levelNode) {
            return;
        }
        
        // 更新等级显示
        const levelLabel = levelNode.getComponent(Label);
        if (levelLabel) {
            const unitLevel = this.getUnitTalentPointsUsed(unitId);
            levelLabel.string = `等级: ${unitLevel}`;
        }
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
            'ElfSwordsman': '2f39c6d5-5dcc-4f99-b0e8-8137ca283667',
            'Priest': 'f3983aea-26d4-452d-8336-0e29fd2ec477',
            'HunterHall': '84fcb7a8-0a07-41ce-b1b3-19821780e361',
            'SwordsmanHall': '42935d61-4a45-4323-aa06-5518bd9b5b8d',
            'Church': 'ca650a85-5921-4179-9dc2-e6357f29e73c',
            'StoneWall': 'a7405231-7385-4e8a-9fb9-633c4577e610',
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
            
            // 获取单位组件（尝试多种方式）
            let unitScript: any = null;
            
            // 方式1: 尝试使用首字母大写的组件名（如 ElfSwordsman）
            const componentName = unitId.charAt(0).toUpperCase() + unitId.slice(1);
            unitScript = prefabInstance.getComponent(componentName) as any;
            
            // 方式2: 如果方式1失败，尝试使用原始ID（如 StoneWall）
            if (!unitScript) {
                unitScript = prefabInstance.getComponent(unitId) as any;
            }
            
            // 方式3: 尝试查找所有可能的组件类型（包括基类）
            if (!unitScript) {
                const possibleNames = [
                    componentName,
                    unitId,
                    'Build',      // 建筑物基类
                    'Role',       // 角色基类
                    'HunterHall', // 特殊单位
                    'SwordsmanHall',
                    'Church',
                    'StoneWall',
                ];
                for (const name of possibleNames) {
                    unitScript = prefabInstance.getComponent(name) as any;
                    if (unitScript) break;
                }
            }
            
            // 使用统一的图标获取逻辑（优先从组件属性获取）
            if (unitScript) {
                // 先立即尝试获取（可能已经初始化）
                if (this.tryGetIconFromUnitScript(unitScript, prefabInstance, sprite, unitId)) {
                    prefabInstance.destroy();
                    return;
                }
                
                // 如果立即获取失败，等待一帧确保组件属性已初始化
                this.scheduleOnce(() => {
                    if (!sprite.node || !sprite.node.isValid) {
                        prefabInstance.destroy();
                        return;
                    }
                    if (this.tryGetIconFromUnitScript(unitScript, prefabInstance, sprite, unitId)) {
                        prefabInstance.destroy();
                        return;
                    }
                    // 如果从组件属性获取失败，继续尝试从Sprite组件获取
                    this.tryGetSpriteFromInstance(prefabInstance, sprite, unitId);
                }, 0);
                return; // 先返回，等待回调
            }
            
            // 如果没有找到单位脚本，直接尝试从Sprite组件获取
            this.tryGetSpriteFromInstance(prefabInstance, sprite, unitId);
        } else {
        }
        
        // 如果都获取不到，保持Sprite组件为空（不显示图标）
        // 最后检查一次 spriteFrame 是否已设置
        if (!sprite.spriteFrame) {
        }
    }
    
    /**
     * 从预制体实例中尝试获取Sprite组件
     * @param prefabInstance 预制体实例
     * @param sprite 目标Sprite组件
     * @param unitId 单位ID
     */
    private tryGetSpriteFromInstance(prefabInstance: Node, sprite: Sprite, unitId: string) {
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
        
        // 1. 尝试从根节点获取Sprite组件（优先检查这个，因为大部分单位的Sprite在根节点）
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
        }
        
        // 2. 尝试从子节点中查找Sprite组件（有些单位的Sprite可能在子节点中）
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
        }
        
        // 3. 如果还是没有找到，销毁实例
        prefabInstance.destroy();
    }
    
    createTalentPointsDisplay() {
        // 创建天赋点显示节点
        const talentPointsNode = new Node('TalentPointsDisplay');
        talentPointsNode.setParent(this.talentPanel);
        talentPointsNode.setPosition(0, 250, 0); // 上移到页签按钮下方，避免被单位卡片遮挡（向上移动100）
        
        // 添加UITransform
        const talentPointsTransform = talentPointsNode.addComponent(UITransform);
        talentPointsTransform.setContentSize(400, 60);
        
        // 添加天赋点Label
        const label = talentPointsNode.addComponent(Label);
        // 从PlayerDataManager获取最新天赋点
        if (this.playerDataManager) {
            this.talentPoints = this.playerDataManager.getTalentPoints();
        }
        label.string = `天赋点: ${this.talentPoints}`;
        label.fontSize = 24;
        label.color = Color.YELLOW;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.TOP;
        
        // 创建经验值显示节点（在天赋点下方）
        this.expLabelNode = new Node('ExpLabel');
        this.expLabelNode.setParent(talentPointsNode);
        this.expLabelNode.setPosition(0, -35, 0); // 在天赋点标签下方
        
        const expTransform = this.expLabelNode.addComponent(UITransform);
        expTransform.setContentSize(400, 30);
        
        const expLabel = this.expLabelNode.addComponent(Label);
        // 从PlayerDataManager获取经验值
        if (this.playerDataManager) {
            const currentExp = this.playerDataManager.getExperience();
            const remainingExp = this.playerDataManager.getRemainingExpForNextLevel();
            const currentTalentPoints = this.playerDataManager.getTalentPoints();
            // 计算总经验值：初始天赋点0，每100经验值转换为1天赋点
            // 总经验值 = 当前经验值 + 当前天赋点数 * 100
            const totalExp = currentExp + currentTalentPoints * 100;
            expLabel.string = `经验值: ${currentExp} (下一级还需 ${remainingExp})\n总经验值: ${totalExp}`;
        } else {
            expLabel.string = `经验值: 0 (下一级还需 100)\n总经验值: 0`;
        }
        expLabel.fontSize = 18;
        expLabel.color = Color.CYAN;
        expLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        expLabel.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 创建重置天赋点按钮（在经验值标签下方）
        const resetButtonNode = new Node('ResetTalentButton');
        resetButtonNode.setParent(talentPointsNode);
        resetButtonNode.setPosition(0, -100, 0); // 在经验值标签下方
        
        const resetButtonTransform = resetButtonNode.addComponent(UITransform);
        resetButtonTransform.setContentSize(150, 35);
        resetButtonTransform.setAnchorPoint(0.5, 0.5);
        
        // 添加按钮背景
        const resetButtonBackground = resetButtonNode.addComponent(Graphics);
        resetButtonBackground.fillColor = new Color(150, 60, 60, 200);
        resetButtonBackground.roundRect(-75, -17.5, 150, 35, 5);
        resetButtonBackground.fill();
        
        resetButtonBackground.lineWidth = 2;
        resetButtonBackground.strokeColor = new Color(200, 100, 100, 255);
        resetButtonBackground.roundRect(-75, -17.5, 150, 35, 5);
        resetButtonBackground.stroke();
        
        // 创建按钮文本
        const resetButtonTextNode = new Node('ResetButtonText');
        resetButtonTextNode.setParent(resetButtonNode);
        resetButtonTextNode.setPosition(0, 0, 0);
        
        const resetButtonTextLabel = resetButtonTextNode.addComponent(Label);
        resetButtonTextLabel.string = '重置天赋点';
        resetButtonTextLabel.fontSize = 16;
        resetButtonTextLabel.color = Color.WHITE;
        resetButtonTextLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        resetButtonTextLabel.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 添加Button组件
        const resetButtonComp = resetButtonNode.addComponent(Button);
        
        // 绑定点击事件
        resetButtonComp.node.on(Button.EventType.CLICK, () => {
            this.resetAllTalents();
        }, this);
    }
    
    createTalentList() {
        // 天赋列表位置
        let yPos = 0;
        const spacing = 30;
        const talentItemHeight = 50; // 增大天赋项高度
        
        // 遍历所有天赋
        for (let [talentId, talent] of this.talents) {
            // 创建天赋项
            const talentItem = new Node(`Talent_${talentId}`);
            talentItem.setParent(this.talentPanel);
            talentItem.setPosition(0, yPos, 0);
            
            // 添加背景
            const background = talentItem.addComponent(Graphics);
            background.fillColor = new Color(50, 50, 50, 150);
            background.roundRect(-320, -15, 640, 50, 5);
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
            nameLabelComp.fontSize = 20;
            nameLabelComp.color = Color.WHITE;
            nameLabelComp.horizontalAlign = Label.HorizontalAlign.LEFT;
            nameLabelComp.verticalAlign = Label.VerticalAlign.TOP;
            
            // 创建天赋描述标签
            const descLabel = new Node('DescLabel');
            descLabel.setParent(talentItem);
            descLabel.setPosition(0, 0, 0);
            
            const descLabelComp = descLabel.addComponent(Label);
            descLabelComp.string = talent.description;
            descLabelComp.fontSize = 20;
            descLabelComp.color = Color.GRAY;
            descLabelComp.horizontalAlign = Label.HorizontalAlign.LEFT;
            descLabelComp.verticalAlign = Label.VerticalAlign.TOP;
            
            // 创建天赋效果标签（显示当前增幅情况）
            const effectLabel = new Node('EffectLabel');
            effectLabel.setParent(talentItem);
            effectLabel.setPosition(150, 0, 0);
            
            const effectLabelComp = effectLabel.addComponent(Label);
            // 计算当前增幅：每级增幅值 * 当前等级
            const currentBonus = talent.value * talent.level;
            if (talent.type === TalentType.ATTACK_DAMAGE || talent.type === TalentType.HEALTH) {
                // 攻击力和生命值显示百分比
                effectLabelComp.string = currentBonus > 0 ? `+${currentBonus}%` : `+${talent.value}%`;
            } else {
                // 其他显示数值
                effectLabelComp.string = currentBonus > 0 ? `+${currentBonus}` : `+${talent.value}`;
            }
            effectLabelComp.fontSize = 20;
            effectLabelComp.color = Color.GREEN;
            effectLabelComp.horizontalAlign = Label.HorizontalAlign.RIGHT;
            effectLabelComp.verticalAlign = Label.VerticalAlign.TOP;
            
            // 创建等级显示
            const levelLabel = new Node('LevelLabel');
            levelLabel.setParent(talentItem);
            levelLabel.setPosition(200, 0, 0);
            
            const levelLabelComp = levelLabel.addComponent(Label);
            levelLabelComp.string = `${talent.level}/${talent.maxLevel}`;
            levelLabelComp.fontSize = 20;
            levelLabelComp.color = Color.WHITE;
            levelLabelComp.horizontalAlign = Label.HorizontalAlign.RIGHT;
            levelLabelComp.verticalAlign = Label.VerticalAlign.TOP;
            
            // 创建升级按钮
            const upgradeButton = new Node('UpgradeButton');
            upgradeButton.setParent(talentItem);
            upgradeButton.setPosition(270, 0, 0);
            
            // 添加UITransform组件（Button需要UITransform来定义点击区域）
            const upgradeButtonTransform = upgradeButton.addComponent(UITransform);
            upgradeButtonTransform.setContentSize(70, 24);
            upgradeButtonTransform.setAnchorPoint(0.5, 0.5);
            
            // 添加按钮背景
            const buttonBackground = upgradeButton.addComponent(Graphics);
            buttonBackground.fillColor = new Color(80, 120, 80, 200);
            buttonBackground.roundRect(-35, -12, 70, 24, 3);
            buttonBackground.fill();
            
            // 创建按钮文本节点（参考查看详情按钮的实现方式）
            const buttonTextNode = new Node('ButtonText');
            buttonTextNode.setParent(upgradeButton);
            buttonTextNode.setPosition(0, 0, 0);
            buttonTextNode.active = true; // 确保按钮文本节点处于激活状态
            
            // 为按钮文本添加UITransform
            const buttonTextTransform = buttonTextNode.addComponent(UITransform);
            buttonTextTransform.setContentSize(70, 24);
            buttonTextTransform.setAnchorPoint(0.5, 0.5);
            
            const buttonTextLabel = buttonTextNode.addComponent(Label);
            buttonTextLabel.string = '升级';
            buttonTextLabel.fontSize = 12; // 稍微减小字体，确保在24高度的按钮中能完全显示
            buttonTextLabel.color = Color.WHITE;
            buttonTextLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            buttonTextLabel.verticalAlign = Label.VerticalAlign.CENTER;
            // 设置行高与按钮高度一致，确保垂直居中（重要：必须设置才能正确垂直居中）
            buttonTextLabel.lineHeight = 24;
            // 确保文本在UITransform区域内正确显示
            buttonTextLabel.overflow = Label.Overflow.NONE;
            // 禁用文本换行
            buttonTextLabel.enableWrapText = false;
            
            // 添加Button组件
            const buttonComp = upgradeButton.addComponent(Button);
            
            // 绑定点击事件
            buttonComp.node.on(Button.EventType.CLICK, () => {
                this.upgradeTalent(talentId);
            }, this);
            
            // 更新y位置（使用新的高度和间距）
            yPos -= (talentItemHeight + spacing);
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
        
        // 从PlayerDataManager获取最新天赋点
        if (this.playerDataManager) {
            this.talentPoints = this.playerDataManager.getTalentPoints();
        }
        
        // 检查是否有足够的天赋点
        if (this.talentPoints < talent.cost) {
            return;
        }
        
        // 扣除天赋点
        this.talentPoints -= talent.cost;
        
        // 保存到PlayerDataManager
        if (this.playerDataManager) {
            this.playerDataManager.useTalentPoint(talent.cost);
            this.talentPoints = this.playerDataManager.getTalentPoints();
        }
        
        // 升级天赋
        talent.level++;
        
        // 保存天赋等级到PlayerDataManager
        if (this.playerDataManager) {
            this.playerDataManager.setTalentLevel(talentId, talent.level);
        }
        
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
        // 更新天赋点和经验值显示
        this.updateTalentPointsDisplay();
        // 重新创建天赋列表（保持天赋点显示不变）
        this.showTalentList();
    }
    
    /**
     * 更新天赋点和经验值显示
     */
    updateTalentPointsDisplay() {
        // 查找天赋点显示节点
        const talentPointsNode = this.talentPanel.getChildByName('TalentPointsDisplay');
        if (!talentPointsNode) {
            return;
        }
        
        // 更新天赋点显示
        const talentPointsLabel = talentPointsNode.getComponent(Label);
        if (talentPointsLabel) {
            // 从PlayerDataManager获取最新天赋点
            if (this.playerDataManager) {
                this.talentPoints = this.playerDataManager.getTalentPoints();
            }
            talentPointsLabel.string = `天赋点: ${this.talentPoints}`;
        }
        
        // 更新经验值显示
        if (this.expLabelNode && this.expLabelNode.isValid) {
            const expLabel = this.expLabelNode.getComponent(Label);
            if (expLabel && this.playerDataManager) {
                const currentExp = this.playerDataManager.getExperience();
                const remainingExp = this.playerDataManager.getRemainingExpForNextLevel();
                const currentTalentPoints = this.playerDataManager.getTalentPoints();
                const totalExp = currentExp + currentTalentPoints * 100; // 总经验值 = 当前经验值 + 当前天赋点数 * 100
                expLabel.string = `经验值: ${currentExp} (下一级还需 ${remainingExp})\n总经验值: ${totalExp}`;
            }
        }
    }
    
    /**
     * 获取单位使用的天赋点数（等级）
     * @param unitId 单位ID
     * @returns 该单位使用的天赋点数
     */
    getUnitTalentPointsUsed(unitId: string): number {
        if (!this.playerDataManager) {
            return 0;
        }
        
        const enhancement = this.playerDataManager.getUnitEnhancement(unitId);
        if (!enhancement || !enhancement.enhancements) {
            return 0;
        }
        
        const enhancements = enhancement.enhancements;
        let talentPointsUsed = 0;
        
        // 计算各属性使用的天赋点数
        // 攻击力：1点 = 1天赋点
        if (enhancements.attackDamage) {
            talentPointsUsed += Math.floor(enhancements.attackDamage / 1);
        }
        
        // 攻击速度：5% = 1天赋点
        if (enhancements.attackSpeed) {
            talentPointsUsed += Math.floor(enhancements.attackSpeed / 5);
        }
        
        // 生命值：2点 = 1天赋点
        if (enhancements.maxHealth) {
            talentPointsUsed += Math.floor(enhancements.maxHealth / 2);
        }
        
        // 移动速度：5点 = 1天赋点
        if (enhancements.moveSpeed) {
            talentPointsUsed += Math.floor(enhancements.moveSpeed / 5);
        }
        
        // 建造成本：1点 = 1天赋点（负数表示减少）
        if (enhancements.buildCost) {
            talentPointsUsed += Math.abs(Math.floor(enhancements.buildCost / 1));
        }
        
        return talentPointsUsed;
    }
    
    /**
     * 重置所有天赋点
     */
    resetAllTalents() {
        if (!this.playerDataManager) {
            return;
        }
        
        // 计算已使用的天赋点总数
        let totalUsedPoints = 0;
        
        // 计算天赋升级使用的天赋点
        for (const talentId of this.talents.keys()) {
            const talent = this.talents.get(talentId);
            if (talent) {
                const currentLevel = this.playerDataManager.getTalentLevel(talentId);
                totalUsedPoints += currentLevel * talent.cost;
            }
        }
        
        // 计算单位强化使用的天赋点
        const unitEnhancements = this.playerDataManager.getPlayerData().unitEnhancements || {};
        for (const unitId in unitEnhancements) {
            if (unitEnhancements.hasOwnProperty(unitId)) {
                const enhancement = unitEnhancements[unitId];
                if (enhancement && enhancement.enhancements) {
                    // 每个强化项消耗1天赋点，计算强化项数量
                    const enhancements = enhancement.enhancements;
                    let enhancementCount = 0;
                    if (enhancements.attackDamage) enhancementCount += Math.floor(enhancements.attackDamage / 1); // 1点攻击力=1天赋点
                    if (enhancements.attackSpeed) enhancementCount += Math.floor(enhancements.attackSpeed / 5);
                    if (enhancements.maxHealth) enhancementCount += Math.floor(enhancements.maxHealth / 2); // 2点生命值=1天赋点
                    if (enhancements.moveSpeed) enhancementCount += Math.floor(enhancements.moveSpeed / 5);
                    if (enhancements.buildCost) enhancementCount += Math.abs(Math.floor(enhancements.buildCost / 1));
                    totalUsedPoints += enhancementCount;
                }
            }
        }
        
        // 重置所有天赋等级
        for (const talentId of this.talents.keys()) {
            this.playerDataManager.setTalentLevel(talentId, 0);
            const talent = this.talents.get(talentId);
            if (talent) {
                talent.level = 0;
            }
        }
        
        // 清空所有单位强化
        const unitEnhancementsData = this.playerDataManager.getPlayerData().unitEnhancements || {};
        for (const unitId in unitEnhancementsData) {
            if (unitEnhancementsData.hasOwnProperty(unitId)) {
                this.playerDataManager.setUnitEnhancement(unitId, {
                    unitId: unitId,
                    enhancements: {}
                });
            }
        }
        
        // 恢复天赋点
        const currentTalentPoints = this.playerDataManager.getTalentPoints();
        this.playerDataManager.setTalentPoints(currentTalentPoints + totalUsedPoints);
        this.talentPoints = this.playerDataManager.getTalentPoints();
        
        // 更新显示
        this.updateTalentPointsDisplay();
        this.updateTalentPanel();
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