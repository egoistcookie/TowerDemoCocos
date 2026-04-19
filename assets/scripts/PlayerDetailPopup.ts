import { _decorator, Component, Node, Label, Sprite, UITransform, Color, Graphics, find, sys, Texture2D, ImageAsset, SpriteFrame, Mask, MaskType, ScrollView, resources, Button, UIOpacity, tween, view, Prefab, instantiate, assetManager } from 'cc';
// 微信小游戏全局对象声明（避免 TypeScript 报错）
declare const wx: any;
const { ccclass, property } = _decorator;

/**
 * 玩家详情数据接口
 */
export interface PlayerDetailData {
    player_id: string;
    player_name?: string;
    player_avatar?: string;
    total_kills: number;
    max_level: number;
    game_record?: {
        operations_json: any[];
        unit_levels_json: Record<string, number>;
    };
}

/**
 * 称号数据接口
 */
export interface TitleData {
    titleName: string;      // 称号名称
    iconPath: string;       // 图标路径（不含前缀）
    description?: string;   // 称号描述
}

/**
 * 角色展示项
 */
export interface RoleDisplayItem {
    roleId: string;        // 角色 ID（如 ElfSwordsman）
    roleName: string;      // 角色显示名（如 剑士）
    roleLevel: number;     // 角色等级（或防御塔数量）
    iconPath: string;      // 图标资源路径
    towerCount?: number;   // 防御塔/石墙数量（如果是防御塔）
}

@ccclass('PlayerDetailPopup')
export class PlayerDetailPopup extends Component {
    private popupContainer: Node | null = null; // 弹窗容器
    private maskLayer: Node | null = null; // 遮罩层
    private gameManager: any = null!; // GameManager 引用
    private currentData: PlayerDetailData | null = null; // 当前显示的数据
    private closeButton: Node | null = null; // 关闭按钮
    private playerTitles: TitleData[] = []; // 玩家称号列表

    // 建筑到角色的映射（包含训练建筑、防御塔和石墙）
    private readonly BUILDING_TO_ROLE: Record<string, { roleId: string; roleName: string; iconPath: string; isTower?: boolean }> = {
        // 训练建筑
        'build_swordsman_hall': { roleId: 'ElfSwordsman', roleName: '剑士', iconPath: 'textures/role/ElfSwordsman' },
        'build_hunter_hall': { roleId: 'Hunter', roleName: '女猎手', iconPath: 'textures/role/Hunter' },
        'build_church': { roleId: 'Priest', roleName: '牧师', iconPath: 'textures/role/Priest' },
        'build_moon_well': { roleId: 'Wisp', roleName: '小精灵', iconPath: 'textures/role/Wisp' },
        'build_mage_tower': { roleId: 'Mage', roleName: '法师', iconPath: 'textures/role/Mage' },
        'build_war_ancient_tree': { roleId: 'Arrower', roleName: '弓箭手', iconPath: 'textures/role/Arrower' },
        'build_eagle_nest': { roleId: 'Eagle', roleName: '角鹰', iconPath: 'textures/role/Eagle' },
        'build_bear_den': { roleId: 'Bear', roleName: '巨熊', iconPath: 'textures/role/Bear' },
        // 防御塔
        'build_watchtower': { roleId: 'WatchTower', roleName: '哨塔', iconPath: 'textures/role/WatchTower', isTower: true },
        'build_thunder_tower': { roleId: 'ThunderTower', roleName: '雷塔', iconPath: 'textures/role/ThunderTower', isTower: true },
        'build_ice_tower': { roleId: 'IceTower', roleName: '冰塔', iconPath: 'textures/role/IceTower', isTower: true },
        // 石墙
        'build_stone_wall': { roleId: 'StoneWall', roleName: '石墙', iconPath: 'textures/role/StoneWall', isTower: true },
    };

    // 角色显示名映射（用于 unitConfig.json 中的 name）
    private readonly ROLE_DISPLAY_NAMES: Record<string, string> = {
        'ElfSwordsman': '剑士',
        'Hunter': '女猎手',
        'Priest': '牧师',
        'Wisp': '小精灵',
        'Arrower': '弓箭手',
        'Mage': '法师',
        'Eagle': '角鹰',
        'Bear': '巨熊',
    };

    // 防御塔/石墙的 roleId 到信息的映射（用于从 towerCountMap 恢复显示信息）
    private readonly TOWER_ROLE_INFO: Record<string, { roleName: string; iconPath: string }> = {
        'WatchTower': { roleName: '哨塔', iconPath: 'textures/role/WatchTower' },
        'ThunderTower': { roleName: '雷塔', iconPath: 'textures/role/ThunderTower' },
        'IceTower': { roleName: '冰塔', iconPath: 'textures/role/IceTower' },
        'StoneWall': { roleName: '石墙', iconPath: 'textures/role/StoneWall' },
    };

    // 特殊单位（巨熊、角鹰）的信息映射
    private readonly SPECIAL_UNIT_INFO: Record<string, { roleName: string; iconPath: string }> = {
        'Bear': { roleName: '巨熊', iconPath: 'textures/role/Bear' },
        'Eagle': { roleName: '角鹰', iconPath: 'textures/role/Eagle' },
        'BeastDen': { roleName: '兽穴', iconPath: 'textures/role/BeastDen' },
    };

    onLoad() {
        // 查找 GameManager
        let gmNode = find('Canvas/GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent('GameManager' as any);
        }

        // 创建弹窗 UI 结构
        this.createPopupUI();

        // 创建遮罩层
        this.createMaskLayer();
    }

    /**
     * 创建弹窗 UI 结构
     */
    private createPopupUI() {
        console.log('[PlayerDetailPopup] createPopupUI start');

        const canvasNode = find('Canvas');
        console.log('[PlayerDetailPopup] canvasNode:', canvasNode);
        if (!canvasNode) return;

        // 为主节点添加 UITransform 组件（如果还没有）
        let uiTrans = this.node.getComponent(UITransform);
        if (!uiTrans) {
            uiTrans = this.node.addComponent(UITransform);
        }
        uiTrans.setContentSize(100, 100); // 主节点大小不影响子节点
        this.node.setPosition(0, 0, 0);
        console.log('[PlayerDetailPopup] this.node:', this.node);

        // 弹窗容器（卷轴风格背景）
        this.popupContainer = new Node('PopupContainer');
        this.popupContainer.setParent(this.node);

        const panelWidth = 600;
        const panelHeight = 700;

        const containerTrans = this.popupContainer.addComponent(UITransform);
        containerTrans.setContentSize(panelWidth, panelHeight);
        containerTrans.setAnchorPoint(0.5, 0.5);
        this.popupContainer.setPosition(0, 0, 0);

        // 卷轴背景（parchment 风格）- 以节点中心为原点绘制
        const g = this.popupContainer.addComponent(Graphics);
        const bgColor = new Color(245, 230, 200, 255); // 米黄色背景
        const borderColor = new Color(180, 140, 80, 255);
        const radius = 24;

        g.fillColor = bgColor;
        g.roundRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, radius);
        g.fill();

        g.lineWidth = 4;
        g.strokeColor = borderColor;
        g.roundRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, radius);
        g.stroke();

        // 标题（顶部居中）
        const titleNode = new Node('Title');
        titleNode.setParent(this.popupContainer);
        const titleLabel = titleNode.addComponent(Label);
        titleLabel.string = '玩家详情';
        titleLabel.fontSize = 28;
        titleLabel.color = new Color(255, 255, 255, 255);
        titleLabel.enableOutline = true;
        titleLabel.outlineColor = new Color(120, 80, 20, 255);
        titleLabel.outlineWidth = 3;
        titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLabel.verticalAlign = Label.VerticalAlign.CENTER;
        const titleTrans = titleNode.addComponent(UITransform);
        titleTrans.setContentSize(panelWidth, 50);
        titleNode.setPosition(0, panelHeight / 2 - 30, 0);

        // 关闭按钮（右上角 X）
        this.closeButton = new Node('CloseButton');
        this.closeButton.setParent(this.popupContainer);
        const closeBtnTrans = this.closeButton.addComponent(UITransform);
        closeBtnTrans.setContentSize(40, 40);
        this.closeButton.setPosition(panelWidth / 2 - 30, panelHeight / 2 - 30, 0);

        // 关闭按钮背景圆
        const closeBgNode = new Node('Bg');
        closeBgNode.setParent(this.closeButton);
        const closeBgTrans = closeBgNode.addComponent(UITransform);
        closeBgTrans.setContentSize(40, 40);
        closeBgNode.setPosition(0, 0, 0);
        const closeBgG = closeBgNode.addComponent(Graphics);
        closeBgG.fillColor = new Color(200, 80, 80, 200);
        closeBgG.circle(0, 0, 20);
        closeBgG.fill();

        // 关闭按钮文字 X
        const closeLabel = this.closeButton.addComponent(Label);
        closeLabel.string = 'X';
        closeLabel.fontSize = 24;
        closeLabel.color = new Color(255, 255, 255, 255);
        closeLabel.enableOutline = true;
        closeLabel.outlineColor = new Color(0, 0, 0, 255);
        closeLabel.outlineWidth = 2;
        closeLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        closeLabel.verticalAlign = Label.VerticalAlign.CENTER;

        // 内容容器（左右分栏）- 在标题下方
        const contentContainer = new Node('ContentContainer');
        contentContainer.setParent(this.popupContainer);
        const contentTrans = contentContainer.addComponent(UITransform);
        const contentWidth = panelWidth - 40;
        const contentHeight = panelHeight - 100; // 减去标题和底部空间
        contentTrans.setContentSize(contentWidth, contentHeight);
        contentTrans.setAnchorPoint(0.5, 0.5); // 锚点在中心
        contentContainer.setPosition(0, 0, 0); // 居中

        // 左侧面板（玩家信息）- 占一半宽度
        const leftNode = new Node('LeftPanel');
        leftNode.setParent(contentContainer);
        const leftTrans = leftNode.addComponent(UITransform);
        const leftWidth = contentWidth / 2 - 10; // 一半宽度减去中间间距
        leftTrans.setContentSize(leftWidth, contentHeight);
        leftTrans.setAnchorPoint(0.5, 0.5); // 锚点在中心
        leftNode.setPosition(-contentWidth / 4, 0, 0); // 左侧居中

        // 右侧面板（通关阵容）
        const rightNode = new Node('RightPanel');
        rightNode.setParent(contentContainer);
        const rightTrans = rightNode.addComponent(UITransform);
        const rightWidth = contentWidth / 2 - 10; // 一半宽度减去中间间距
        rightTrans.setContentSize(rightWidth, contentHeight);
        rightTrans.setAnchorPoint(0.5, 0.5); // 锚点在中心
        rightNode.setPosition(contentWidth / 4, 0, 0); // 右侧居中

        // 右侧 ScrollView 容器
        const scrollNode = new Node('ScrollView');
        scrollNode.setParent(rightNode);
        const scrollTrans = scrollNode.addComponent(UITransform);
        scrollTrans.setContentSize(rightWidth, contentHeight);
        scrollNode.setPosition(0, 0, 0);

        // Content 节点（必须在创建 ScrollView 之前创建）
        const contentNode = new Node('RoleContent');
        contentNode.setParent(scrollNode);
        const contentNodeTrans = contentNode.addComponent(UITransform);
        contentNodeTrans.setContentSize(320, 100); // 初始高度，会在填充时动态调整
        contentNodeTrans.setAnchorPoint(0.5, 1);
        contentNode.setPosition(0, contentHeight / 2 - 10, 0); // 从顶部开始，留 10px 间距

        // 添加 ScrollView 组件
        const scrollView = scrollNode.addComponent(ScrollView);
        scrollView.vertical = true;
        scrollView.horizontal = false;
        scrollView.inertia = true;
        scrollView.brake = 0.5;
        scrollView.elastic = true;
        scrollView.content = contentNode;

        // 添加 Mask 组件
        const mask = scrollNode.addComponent(Mask);
        mask.type = MaskType.GRAPHICS_RECT;

        // 绑定关闭按钮事件
        this.closeButton.on(Node.EventType.TOUCH_END, this.hide, this);

        console.log('[PlayerDetailPopup] createPopupUI completed, popupContainer:', this.popupContainer);
    }

    /**
     * 创建遮罩层
     */
    private createMaskLayer() {
        if (this.maskLayer && this.maskLayer.isValid) {
            this.maskLayer.destroy();
        }

        // 遮罩层添加到 Canvas，而不是 this.node
        const canvasNode = find('Canvas');
        if (!canvasNode) return;

        this.maskLayer = new Node('PlayerDetailMask');
        this.maskLayer.setParent(canvasNode);

        const uiTransform = this.maskLayer.addComponent(UITransform);
        const visibleSize = view.getVisibleSize();
        uiTransform.setContentSize(visibleSize.width, visibleSize.height);
        this.maskLayer.setPosition(0, 0, 0);

        // 设置遮罩层在 Canvas 的较低层级（会在后面调整）
        this.maskLayer.setSiblingIndex(0);

        const graphics = this.maskLayer.addComponent(Graphics);
        graphics.fillColor = new Color(0, 0, 0, 100); // 降低遮罩透明度
        graphics.rect(-visibleSize.width / 2, -visibleSize.height / 2, visibleSize.width, visibleSize.height);
        graphics.fill();

        const uiOpacity = this.maskLayer.addComponent(UIOpacity);
        uiOpacity.opacity = 0;

        this.maskLayer.active = false;

        // 阻止触摸事件穿透
        this.maskLayer.on(Node.EventType.TOUCH_START, (event: any) => {
            event.propagationStopped = true;
        }, this);

        console.log('[PlayerDetailPopup] createMaskLayer completed, maskLayer:', this.maskLayer);
    }

    /**
     * 显示弹窗
     */
    public show(data: PlayerDetailData) {
        this.currentData = data;

        console.log('[PlayerDetailPopup] show called, popupContainer:', this.popupContainer);

        if (!this.popupContainer || !this.popupContainer.isValid) {
            console.error('[PlayerDetailPopup] popupContainer 未设置，尝试重新创建 UI');
            this.createPopupUI();
            if (!this.popupContainer) {
                console.error('[PlayerDetailPopup] 重新创建 UI 后 popupContainer 仍为 null');
                return;
            }
        }

        console.log('[PlayerDetailPopup] show data:', data);

        // 确保节点激活并设置到最上层
        this.node.active = true;
        // 获取父节点（Canvas），将弹窗设置到最上层
        const parent = this.node.parent;
        if (parent) {
            this.node.setSiblingIndex(parent.children.length - 1);
        }

        // 填充数据
        this.populatePlayerInfo(data);

        // 显示弹窗容器
        this.popupContainer.active = true;

        // 显示遮罩层（在弹窗之下）
        this.showMaskLayer();

        // 暂时隐藏贡献榜的遮罩层，避免阻挡再次点击
        if (this.gameManager && this.gameManager.killRankCloseOverlayNode) {
            this.gameManager.killRankCloseOverlayNode.active = false;
        }

        // 解析并显示通关阵容
        if (data.game_record) {
            console.log('[PlayerDetailPopup] game_record exists, operations:', data.game_record.operations_json?.length, 'unitLevels:', data.game_record.unit_levels_json);
            this.populateRoleLineup(data.game_record.operations_json, data.game_record.unit_levels_json);
        } else {
            console.warn('[PlayerDetailPopup] no game_record in data');
        }
    }

    /**
     * 隐藏弹窗
     */
    public hide() {
        if (this.popupContainer) {
            this.popupContainer.active = false;
        }
        this.node.active = false;

        if (this.maskLayer) {
            this.maskLayer.active = false;
        }

        // 恢复贡献榜的遮罩层和面板层级
        if (this.gameManager && this.gameManager.killRankCloseOverlayNode && this.gameManager.killRankCloseOverlayNode.isValid) {
            this.gameManager.killRankCloseOverlayNode.active = true;
            this.gameManager.killRankCloseOverlayNode.setSiblingIndex(Number.MAX_SAFE_INTEGER - 1);
        }
        if (this.gameManager && this.gameManager.killRankPanelNode && this.gameManager.killRankPanelNode.isValid) {
            this.gameManager.killRankPanelNode.active = true;
            this.gameManager.killRankPanelNode.setSiblingIndex(Number.MAX_SAFE_INTEGER);
        }

        console.log('[PlayerDetailPopup] hide called, player detail popup closed');
    }

    /**
     * 显示遮罩层
     */
    private showMaskLayer() {
        if (!this.maskLayer || !this.maskLayer.isValid) return;

        this.maskLayer.active = true;

        // 获取父节点（Canvas），将遮罩层设置到弹窗节点之下
        const parent = this.maskLayer.parent;
        if (parent && this.node && this.node.isValid) {
            const popupIndex = this.node.getSiblingIndex();
            this.maskLayer.setSiblingIndex(popupIndex - 1);
        }

        const uiOpacity = this.maskLayer.getComponent(UIOpacity);
        if (uiOpacity) {
            tween(uiOpacity)
                .to(0.2, { opacity: 150 }) // 降低遮罩透明度
                .start();
        }

        console.log('[PlayerDetailPopup] showMaskLayer, maskLayer siblingIndex:', this.maskLayer.getSiblingIndex());
    }

    /**
     * 填充玩家信息（左侧）
     */
    private populatePlayerInfo(data: PlayerDetailData) {
        console.log('[PlayerDetailPopup] populatePlayerInfo start');

        if (!this.popupContainer) {
            console.error('[PlayerDetailPopup] popupContainer is null');
            return;
        }

        // 获取内容容器
        const contentContainer = this.popupContainer.getChildByName('ContentContainer');
        console.log('[PlayerDetailPopup] contentContainer:', contentContainer);
        if (!contentContainer) return;

        // 获取左侧面板
        const leftNode = contentContainer.getChildByName('LeftPanel');
        console.log('[PlayerDetailPopup] leftNode:', leftNode);
        if (!leftNode) return;

        // 清理旧的左侧内容
        const children = [...leftNode.children];
        console.log('[PlayerDetailPopup] clearing', children.length, 'children');
        for (const c of children) {
            c.destroy();
        }

        // 获取左侧面板尺寸
        const leftTrans = leftNode.getComponent(UITransform);
        const leftWidth = leftTrans ? leftTrans.width : 280;
        const leftHeight = leftTrans ? leftTrans.height : 600;
        const centerX = 0; // 锚点已改为 0.5,0.5，中心 X 为 0

        // 计算垂直居中：头像上移 100 像素
        const startY = 150; // 头像中心 Y 坐标，从原来的 50 上移 100 像素

        // 玩家头像（左侧面板中心）
        const avatarNode = new Node('Avatar');
        avatarNode.setParent(leftNode);
        const avatarTrans = avatarNode.addComponent(UITransform);
        avatarTrans.setContentSize(160, 160); // 宽高扩大一倍
        avatarNode.setPosition(centerX, startY, 0);

        // 头像背景（方形，适配玩家上传的图片）
        const avatarBgG = avatarNode.addComponent(Graphics);
        avatarBgG.fillColor = new Color(60, 60, 60, 255);
        // 绘制方形背景，边长 160（与节点尺寸一致）
        avatarBgG.rect(-80, -80, 160, 160);
        avatarBgG.fill();
        avatarBgG.lineWidth = 4; // 边框加粗
        avatarBgG.strokeColor = new Color(200, 160, 60, 255);
        avatarBgG.rect(-80, -80, 160, 160);
        avatarBgG.stroke();

        // 加载头像
        if (data.player_avatar && data.player_avatar.startsWith('data:image')) {
            const avatarImgNode = new Node('AvatarImage');
            avatarImgNode.setParent(avatarNode);
            const avatarImgTrans = avatarImgNode.addComponent(UITransform);
            avatarImgTrans.setContentSize(152, 152); // 扩大一倍
            avatarImgNode.setPosition(0, 0, 0);
            const avatarSprite = avatarImgNode.addComponent(Sprite);
            avatarSprite.sizeMode = Sprite.SizeMode.CUSTOM;
            if (this.gameManager && typeof this.gameManager.loadSpriteFromBase64 === 'function') {
                this.gameManager.loadSpriteFromBase64(data.player_avatar, avatarSprite);
            }
        }

        // 声明名称、杀敌数、通关数节点变量（在闭包中使用）
        let nameNode: Node;
        let killsNode: Node;
        let maxLevelNode: Node;

        // 玩家 ID / 名称（先创建节点，位置在获取称号后设置）
        const playerId = data.player_id || '';
        const displayName = data.player_name || (playerId.length > 8 ? playerId.slice(-8) : playerId);
        nameNode = new Node('PlayerName');
        nameNode.setParent(leftNode);
        const nameLabel = nameNode.addComponent(Label);
        nameLabel.string = displayName;
        nameLabel.fontSize = 24;
        nameLabel.color = new Color(255, 255, 255, 255);
        nameLabel.enableOutline = true;
        nameLabel.outlineColor = new Color(0, 0, 0, 255);
        nameLabel.outlineWidth = 2;
        nameLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        const nameTrans = nameNode.addComponent(UITransform);
        nameTrans.setContentSize(leftWidth - 20, 40);

        // 杀敌数（名称下方 30px）
        killsNode = new Node('KillCount');
        killsNode.setParent(leftNode);
        const killsLabel = killsNode.addComponent(Label);
        killsLabel.string = `杀敌数：${data.total_kills || 0}`;
        killsLabel.fontSize = 20;
        killsLabel.color = new Color(255, 255, 255, 255);
        killsLabel.enableOutline = true;
        killsLabel.outlineColor = new Color(0, 0, 0, 255);
        killsLabel.outlineWidth = 2;
        killsLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        const killsTrans = killsNode.addComponent(UITransform);
        killsTrans.setContentSize(leftWidth - 20, 36);

        // 最大通关数（杀敌数下方 30px）
        maxLevelNode = new Node('MaxLevel');
        maxLevelNode.setParent(leftNode);
        const maxLevelLabel = maxLevelNode.addComponent(Label);
        maxLevelLabel.string = `最大通关：${data.max_level || 0}`;
        maxLevelLabel.fontSize = 20;
        maxLevelLabel.color = new Color(255, 255, 255, 255);
        maxLevelLabel.enableOutline = true;
        maxLevelLabel.outlineColor = new Color(0, 0, 0, 255);
        maxLevelLabel.outlineWidth = 2;
        maxLevelLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        const maxLevelTrans = maxLevelNode.addComponent(UITransform);
        maxLevelTrans.setContentSize(leftWidth - 20, 36);

        // 获取称号列表
        this.fetchPlayerTitles(data.player_id).then((titles) => {
            this.playerTitles = titles;
            if (titles.length > 0) {
                // 有称号：渲染称号，名称放在最后一个称号下方 30px
                const titlesHeight = this.renderTitles(leftNode, centerX, startY);
                const nameY = startY - 80 - titlesHeight - 30; // 最后一个称号下方 30px
                nameNode.setPosition(centerX, nameY, 0);
                killsNode.setPosition(centerX, nameY - 30, 0);
                maxLevelNode.setPosition(centerX, nameY - 60, 0);
            } else {
                // 无称号：名称在头像下方 30px
                const nameY = startY - 80 - 30; // 头像下边缘（startY-80）下方 30px
                nameNode.setPosition(centerX, nameY, 0);
                killsNode.setPosition(centerX, nameY - 30, 0);
                maxLevelNode.setPosition(centerX, nameY - 60, 0);
            }
        }).catch((err) => {
            console.error('[PlayerDetailPopup] 获取玩家称号失败:', err);
            // 获取失败时按无称号处理
            const nameY = startY - 80 - 30;
            nameNode.setPosition(centerX, nameY, 0);
            killsNode.setPosition(centerX, nameY - 30, 0);
            maxLevelNode.setPosition(centerX, nameY - 60, 0);
        });
    }

    /**
     * 渲染称号列表（头像下方 30px 开始，从上往下排列）
     * @returns 称号区域总高度
     */
    private renderTitles(leftNode: Node, centerX: number, startY: number): number {
        if (!this.playerTitles || this.playerTitles.length === 0) {
            return 0;
        }

        // 获取左侧面板宽度
        const leftTrans = leftNode.getComponent(UITransform);
        const leftWidth = leftTrans ? leftTrans.width : 280;

        // 称号从头像下方 30px 开始排列
        // 头像中心 Y = startY, 头像半径 = 80, 头像下边缘 Y = startY - 80
        // 第一个称号 Y = 头像下边缘 - 30 = startY - 110
        const titleHeight = 36; // 每个称号占用的高度（图标 30x30 + 上下间距）
        const iconSize = 35; // 图标大小

        this.playerTitles.forEach((title, index) => {
            // 从上往下排列，第一个称号在头像下方 30px
            const y = startY - 110 - (index * titleHeight);

            // 创建称号容器节点（居中显示）
            const titleNode = new Node(`Title_${index}`);
            titleNode.setParent(leftNode);
            const titleTrans = titleNode.addComponent(UITransform);
            titleTrans.setContentSize(leftWidth - 20, titleHeight);
            titleNode.setPosition(centerX, y, 0);

            // 加载称号图标（在名称前方/左侧）
            const iconNode = new Node('TitleIcon');
            iconNode.setParent(titleNode);
            const iconTrans = iconNode.addComponent(UITransform);
            iconTrans.setContentSize(iconSize, iconSize);
            iconNode.setPosition(-40, 0, 0); // 图标在左侧
            const iconSprite = iconNode.addComponent(Sprite);
            iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
            iconSprite.type = Sprite.Type.SIMPLE;

            // 从 resources 加载称号图标
            this.loadTitleIcon(title.iconPath, iconSprite);

            // 称号名称（在图标右侧，左对齐，与图标间距再加 3px）
            const nameLabelNode = new Node('TitleName');
            nameLabelNode.setParent(titleNode);
            const nameLabelTrans = nameLabelNode.addComponent(UITransform);
            nameLabelTrans.setContentSize(leftWidth - 100, titleHeight);
            nameLabelNode.setPosition(18, 0, 0); // 名称节点向右偏移，与图标间距再加 3px
            const titleLabel = nameLabelNode.addComponent(Label);
            titleLabel.string = title.titleName;
            titleLabel.fontSize = 18;
            titleLabel.color = new Color(255, 215, 0, 255); // 金色
            titleLabel.enableOutline = true;
            titleLabel.outlineColor = new Color(0, 0, 0, 255);
            titleLabel.outlineWidth = 2;
            titleLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        });

        // 返回称号区域总高度
        return this.playerTitles.length * titleHeight;
    }

    /**
     * 加载称号图标
     */
    private loadTitleIcon(iconPath: string, sprite: Sprite) {
        // iconPath 是如 "称号 - 杀手.png" 格式，需要去掉 .png 后缀
        const resourceName = iconPath.replace('.png', '');
        // 加载路径：textures/icon/称号 - 杀手/spriteFrame
        const loadPath = `textures/icon/${resourceName}/spriteFrame`;
        console.log('[PlayerDetailPopup] loadTitleIcon:', { iconPath, resourceName, loadPath });

        resources.load(loadPath, SpriteFrame, (err, spriteFrame) => {
            if (err) {
                console.error('[PlayerDetailPopup] 加载称号图标失败:', resourceName, err);
                // 加载失败时创建占位图标
                this.createPlaceholderTitleIcon(sprite.node);
            } else if (spriteFrame && sprite.node.isValid) {
                sprite.spriteFrame = spriteFrame;
            }
        });
    }

    /**
     * 创建占位称号图标
     */
    private createPlaceholderTitleIcon(iconNode: Node) {
        const g = iconNode.addComponent(Graphics);
        g.fillColor = new Color(150, 150, 150, 255);
        g.circle(0, 0, 12);
        g.fill();
    }

    /**
     * 从服务器获取玩家称号列表
     */
    private async fetchPlayerTitles(playerId: string): Promise<TitleData[]> {
        const url = `https://www.egoistcookie.top/api/analytics/player/${encodeURIComponent(playerId)}/titles`;
        console.log('[PlayerDetailPopup] fetchPlayerTitles playerId:', playerId, 'url:', url);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.timeout = 5000;

            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        try {
                            const resp = JSON.parse(xhr.responseText);
                            console.log('[PlayerDetailPopup] fetchPlayerTitles response:', resp);
                            if (resp && resp.success && Array.isArray(resp.data)) {
                                resolve(resp.data);
                            } else {
                                console.warn('[PlayerDetailPopup] fetchPlayerTitles: no data in response');
                                resolve([]);
                            }
                        } catch (e) {
                            console.error('[PlayerDetailPopup] 解析称号响应失败:', e);
                            reject(e);
                        }
                    } else {
                        console.warn('[PlayerDetailPopup] 请求称号失败:', xhr.status);
                        reject(new Error(`HTTP ${xhr.status}`));
                    }
                }
            };

            xhr.onerror = () => {
                console.error('[PlayerDetailPopup] 请求称号网络错误');
                reject(new Error('Network error'));
            };
            xhr.ontimeout = () => {
                console.error('[PlayerDetailPopup] 请求称号超时');
                reject(new Error('Timeout'));
            };

            xhr.open('GET', url, true);
            xhr.send();
        });
    }

    /**
     * 解析操作数据为角色展示项
     * 从 operations 提取所有建筑和防御塔，从 unit_levels_json 获取等级
     * 防御塔和石墙显示建造数量（xx 座），其他单位显示等级
     */
    private parseOperationsToRoles(operations: any[], unitLevels: Record<string, number>): RoleDisplayItem[] {
        console.log('[PlayerDetailPopup] parseOperationsToRoles:', { operations, unitLevels });

        const roles: RoleDisplayItem[] = [];
        const addedRoleIds = new Set<string>();

        // 统计防御塔/石墙的建造次数
        const towerCountMap: Record<string, number> = {};

        // 遍历所有操作，统计防御塔建造次数
        console.log('[PlayerDetailPopup] 遍历 operations，数量:', operations?.length);
        for (const op of operations) {
            const opType = op.type;
            const mapping = this.BUILDING_TO_ROLE[opType];
            console.log('[PlayerDetailPopup] 检查操作:', opType, 'mapping:', mapping);

            if (mapping) {
                if (mapping.isTower) {
                    // 防御塔/石墙：统计建造次数
                    towerCountMap[mapping.roleId] = (towerCountMap[mapping.roleId] || 0) + 1;
                    console.log('[PlayerDetailPopup] 防御塔计数:', mapping.roleId, '当前数量:', towerCountMap[mapping.roleId]);
                } else if (!addedRoleIds.has(mapping.roleId)) {
                    // 训练建筑：只显示一次
                    addedRoleIds.add(mapping.roleId);
                    const level = unitLevels?.[mapping.roleId] ?? 0;
                    roles.push({
                        roleId: mapping.roleId,
                        roleName: mapping.roleName,
                        roleLevel: level,
                        iconPath: mapping.iconPath,
                        towerCount: undefined, // 训练单位不显示数量
                    });
                }
            }

            // 特殊处理：触发巨熊操作
            if (opType === 'trigger_bear' && !addedRoleIds.has('Bear')) {
                addedRoleIds.add('Bear');
                const level = unitLevels?.['Bear'] ?? 0;
                const bearInfo = this.SPECIAL_UNIT_INFO['Bear'];
                if (bearInfo) {
                    roles.push({
                        roleId: 'Bear',
                        roleName: bearInfo.roleName,
                        roleLevel: level,
                        iconPath: bearInfo.iconPath,
                    });
                }
            }
        }

        // 将防御塔/石墙添加到结果中
        console.log('[PlayerDetailPopup] 准备添加防御塔到 roles，towerCountMap:', towerCountMap);
        for (const roleId of Object.keys(towerCountMap)) {
            const count = towerCountMap[roleId];
            const towerInfo = this.TOWER_ROLE_INFO[roleId];
            console.log('[PlayerDetailPopup] 添加防御塔到 roles:', { roleId, count, towerInfo });
            if (towerInfo) {
                roles.push({
                    roleId: roleId,
                    roleName: towerInfo.roleName,
                    roleLevel: count, // 用 roleLevel 存储数量
                    iconPath: towerInfo.iconPath,
                    towerCount: count, // 标记为防御塔数量
                });
                console.log('[PlayerDetailPopup] 已添加防御塔到 roles:', roleId, '数量:', count);
            }
        }

        // 如果 towerCountMap 为空，尝试从 unitLevels 中获取防御塔/石墙信息
        if (Object.keys(towerCountMap).length === 0 && unitLevels && Object.keys(unitLevels).length > 0) {
            console.log('[PlayerDetailPopup] towerCountMap 为空，尝试从 unitLevels 获取防御塔:', unitLevels);
            for (const unitId of Object.keys(unitLevels)) {
                const level = unitLevels[unitId];
                // 检查是否是防御塔/石墙单位
                const towerInfo = this.TOWER_ROLE_INFO[unitId];
                if (towerInfo && level > 0) {
                    // 从 unitLevels 中获取的数量可能是等级，这里需要转换一下
                    // 如果是石墙，level 可能是数量；如果是防御塔，level 可能是等级
                    // 暂时将 level 作为数量显示
                    roles.push({
                        roleId: unitId,
                        roleName: towerInfo.roleName,
                        roleLevel: level,
                        iconPath: towerInfo.iconPath,
                        towerCount: level,
                    });
                    console.log('[PlayerDetailPopup] 从 unitLevels 添加防御塔:', unitId, '数量:', level);
                }
            }
        }

        // 从 unitLevels 中添加特殊单位（角鹰、巨熊、兽穴）
        // 注意：EagleNest 会显示为 Eagle（角鹰）
        if (unitLevels && Object.keys(unitLevels).length > 0) {
            console.log('[PlayerDetailPopup] 从 unitLevels 添加特殊单位:', unitLevels);
            // EagleNest -> Eagle 映射
            const unitIdAliasMap: Record<string, string> = {
                'EagleNest': 'Eagle',
            };
            for (const unitId of Object.keys(unitLevels)) {
                const level = unitLevels[unitId];
                // 跳过已添加的单位
                if (addedRoleIds.has(unitId)) {
                    continue;
                }
                // 处理别名映射
                const actualUnitId = unitIdAliasMap[unitId] || unitId;
                // 检查是否是特殊单位
                const specialInfo = this.SPECIAL_UNIT_INFO[actualUnitId];
                if (specialInfo && level > 0) {
                    roles.push({
                        roleId: actualUnitId,
                        roleName: specialInfo.roleName,
                        roleLevel: level,
                        iconPath: specialInfo.iconPath,
                    });
                    addedRoleIds.add(actualUnitId);
                    console.log('[PlayerDetailPopup] 从 unitLevels 添加特殊单位:', actualUnitId, '等级:', level);
                }
            }
        }

        console.log('[PlayerDetailPopup] roles:', roles);
        return roles;
    }

    /**
     * 填充通关阵容（右侧）
     */
    private populateRoleLineup(operations: any[], unitLevels: Record<string, number>) {
        if (!this.popupContainer) return;

        // 获取内容容器
        const contentContainer = this.popupContainer.getChildByName('ContentContainer');
        if (!contentContainer) return;

        // 获取右侧面板
        const rightNode = contentContainer.getChildByName('RightPanel');
        if (!rightNode) return;

        // 获取 ScrollView
        const scrollNode = rightNode.getChildByName('ScrollView');
        if (!scrollNode) return;

        // 获取 RoleContent
        const contentNode = scrollNode.getChildByName('RoleContent');
        if (!contentNode) return;

        // 清理旧内容
        const children = [...contentNode.children];
        for (const c of children) {
            c.destroy();
        }

        // 解析操作数据为角色展示项
        const roles = this.parseOperationsToRoles(operations, unitLevels);

        if (roles.length === 0) {
            // 没有阵容数据显示提示
            const emptyNode = new Node('EmptyTip');
            emptyNode.setParent(contentNode);
            const emptyLabel = emptyNode.addComponent(Label);
            emptyLabel.string = '暂无阵容数据';
            emptyLabel.fontSize = 20;
            emptyLabel.color = new Color(200, 200, 200, 255);
            emptyLabel.enableOutline = true;
            emptyLabel.outlineColor = new Color(0, 0, 0, 255);
            emptyLabel.outlineWidth = 2;
            emptyLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            const emptyTrans = emptyNode.addComponent(UITransform);
            emptyTrans.setContentSize(200, 40);
            // 标题放在右侧面板顶部居中
            const rightTrans = rightNode.getComponent(UITransform);
            const rightHeight = rightTrans ? rightTrans.height : 600;
            emptyNode.setPosition(0, rightHeight / 2 - 60, 0);
            return;
        }

        // 在右侧面板顶部添加"最后通关阵容"标题（不在 ScrollView content 中）
        const existingTitle = rightNode.getChildByName('LineupTitle');
        if (!existingTitle) {
            const titleNode = new Node('LineupTitle');
            titleNode.setParent(rightNode);
            const titleLabel = titleNode.addComponent(Label);
            titleLabel.string = '最后通关阵容';
            titleLabel.fontSize = 22;
            titleLabel.color = new Color(255, 215, 0, 255); // 金色
            titleLabel.enableOutline = true;
            titleLabel.outlineColor = new Color(0, 0, 0, 255);
            titleLabel.outlineWidth = 2;
            titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            const titleTrans = titleNode.addComponent(UITransform);
            titleTrans.setContentSize(280, 40);
            // 标题放在右侧面板顶部居中
            const rightTrans = rightNode.getComponent(UITransform);
            const rightHeight = rightTrans ? rightTrans.height : 600;
            titleNode.setPosition(0, rightHeight / 2 - 30, 0);
        }

        // 计算需要的行数（一行两格）
        const rowHeight = 120; // 格子 100 + 间距 20
        const rowCount = Math.ceil(roles.length / 2);
        const contentHeight = Math.max(rowCount * rowHeight + 20, 300); // 最小高度 300

        // 更新 content 节点高度
        const contentTrans = contentNode.getComponent(UITransform);
        if (contentTrans) {
            contentTrans.setContentSize(300, contentHeight);
        }

        // 填充角色格子（从顶部开始，向下移动 60 像素，与标题保持距离）
        let y = -70; // 原本 -10，现在向下移动 60 像素
        for (let i = 0; i < roles.length; i++) {
            const role = roles[i];
            const rowIndex = Math.floor(i / 2);
            const colIndex = i % 2;

            const x = colIndex === 0 ? -75 : 75;
            const yPos = y - rowIndex * rowHeight;

            // 创建格子节点
            const slotNode = new Node(`RoleSlot_${i}`);
            slotNode.setParent(contentNode);
            const slotTrans = slotNode.addComponent(UITransform);
            slotTrans.setContentSize(100, 100);
            slotTrans.setAnchorPoint(0.5, 1);
            slotNode.setPosition(x, yPos, 0);

            // 格子背景
            const slotBgG = slotNode.addComponent(Graphics);
            slotBgG.fillColor = new Color(255, 255, 255, 20);
            slotBgG.roundRect(-50, -100, 100, 100, 10);
            slotBgG.fill();
            slotBgG.lineWidth = 2;
            slotBgG.strokeColor = new Color(200, 160, 60, 180);
            slotBgG.roundRect(-50, -100, 100, 100, 10);
            slotBgG.stroke();

            // 角色图标
            const iconNode = new Node('RoleIcon');
            iconNode.setParent(slotNode);
            const iconTrans = iconNode.addComponent(UITransform);
            iconTrans.setContentSize(64, 64);
            iconNode.setPosition(0, -50, 0);

            // 加载图标（尝试多种路径）
            this.loadRoleIcon(role.iconPath, role.roleId, iconNode);

            // 等级/数量显示（防御塔显示"xx 座"，石墙显示"xx 个"，其他显示"Lv.xx"）
            const levelNode = new Node('RoleLevel');
            levelNode.setParent(slotNode);
            const levelLabel = levelNode.addComponent(Label);
            if (role.towerCount !== undefined) {
                // 防御塔/石墙：显示数量
                if (role.roleId === 'StoneWall') {
                    levelLabel.string = `${role.towerCount}个`;
                } else {
                    levelLabel.string = `${role.towerCount}座`;
                }
            } else {
                // 训练单位：显示等级
                levelLabel.string = `Lv.${role.roleLevel}`;
            }
            levelLabel.fontSize = 16;
            levelLabel.color = new Color(255, 215, 0, 255); // 金色
            levelLabel.enableOutline = true;
            levelLabel.outlineColor = new Color(0, 0, 0, 255);
            levelLabel.outlineWidth = 2;
            levelLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            const levelTrans = levelNode.addComponent(UITransform);
            levelTrans.setContentSize(80, 24);
            levelNode.setPosition(0, -85, 0);

            // 角色名称
            const nameNode = new Node('RoleName');
            nameNode.setParent(slotNode);
            const nameLabel = nameNode.addComponent(Label);
            nameLabel.string = role.roleName;
            nameLabel.fontSize = 14;
            nameLabel.color = new Color(255, 255, 255, 255);
            nameLabel.enableOutline = true;
            nameLabel.outlineColor = new Color(0, 0, 0, 255);
            nameLabel.outlineWidth = 2;
            nameLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            const nameTrans = nameNode.addComponent(UITransform);
            nameTrans.setContentSize(80, 20);
            nameNode.setPosition(0, -110, 0);
        }
    }

    /**
     * 加载角色图标（参考天赋页的方式，从预制体获取）
     */
    private loadRoleIcon(primaryPath: string, roleId: string, iconNode: Node) {
        const iconImgNode = new Node('IconImage');
        iconImgNode.setParent(iconNode);
        const iconImgTrans = iconImgNode.addComponent(UITransform);
        iconImgTrans.setContentSize(60, 60);
        iconImgNode.setPosition(0, 0, 0);
        const iconSprite = iconImgNode.addComponent(Sprite);
        iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;

        // 参考天赋页的 loadUnitCardIcon 方法，从预制体获取图标
        this.loadIconFromPrefab(roleId, iconSprite);
    }

    /**
     * 从预制体加载单位图标（参考 TalentSystem.loadUnitCardIcon）
     */
    private loadIconFromPrefab(unitId: string, sprite: Sprite) {
        // 单位 ID 映射：处理不同格式的单位 ID
        const unitIdMap: Record<string, string> = {
            // 角色单位
            'ElfSwordsman': 'ElfSwordsman',
            'Hunter': 'Hunter',
            'Priest': 'Priest',
            'Wisp': 'Wisp',
            'Mage': 'Mage',
            'Arrower': 'Arrower',
            // 防御塔
            'WatchTower': 'WatchTower',
            'ThunderTower': 'ThunderTower',
            'IceTower': 'IceTower',
            // 石墙
            'StoneWall': 'StoneWall',
            // 特殊单位
            'Bear': 'Bear',
            'Eagle': 'Eagle',
            'BeastDen': 'BeastDen',
        };

        const normalizedUnitId = unitIdMap[unitId] || unitId;

        // 从 prefabs_sub 分包加载预制体
        assetManager.loadBundle('prefabs_sub', (err, bundle) => {
            if (err || !bundle) {
                // 加载分包失败，尝试从主包加载
                this.loadIconFromMainBundle(normalizedUnitId, sprite);
                return;
            }

            bundle.load(normalizedUnitId, Prefab, (err, prefab) => {
                if (err || !prefab) {
                    // 加载预制体失败，显示占位图
                    this.createPlaceholderIcon(sprite.node, normalizedUnitId);
                    return;
                }

                // 从预制体实例中获取图标
                this.extractIconFromPrefab(prefab, sprite, normalizedUnitId);
            });
        });
    }

    /**
     * 从主包加载预制体图标
     */
    private loadIconFromMainBundle(unitId: string, sprite: Sprite) {
        // 从主包加载预制体
        assetManager.loadBundle('main', (err, bundle) => {
            if (err || !bundle) {
                // 加载主包失败，显示占位图
                this.createPlaceholderIcon(sprite.node, unitId);
                return;
            }

            bundle.load(unitId, Prefab, (err, prefab) => {
                if (err || !prefab) {
                    // 加载预制体失败，显示占位图
                    this.createPlaceholderIcon(sprite.node, unitId);
                    return;
                }

                // 从预制体实例中获取图标
                this.extractIconFromPrefab(prefab, sprite, unitId);
            });
        });
    }

    /**
     * 从预制体实例中提取图标 SpriteFrame
     */
    private extractIconFromPrefab(prefab: Prefab, sprite: Sprite, unitId: string) {
        if (!prefab || !sprite || !sprite.node || !sprite.node.isValid) {
            return;
        }

        // 实例化预制体
        const prefabInstance = instantiate(prefab);
        if (!prefabInstance) {
            this.createPlaceholderIcon(sprite.node, unitId);
            return;
        }

        prefabInstance.active = true;

        // 递归查找 Sprite 组件
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

        // 1. 尝试从根节点获取 Sprite 组件
        const rootSprite = prefabInstance.getComponent(Sprite);
        if (rootSprite && rootSprite.spriteFrame) {
            sprite.spriteFrame = rootSprite.spriteFrame;
            prefabInstance.destroy();
            return;
        }

        // 2. 尝试从子节点中查找 Sprite 组件
        const childSprite = findSpriteInChildren(prefabInstance);
        if (childSprite && childSprite.spriteFrame) {
            sprite.spriteFrame = childSprite.spriteFrame;
            prefabInstance.destroy();
            return;
        }

        // 3. 如果还是没有找到，使用占位图
        prefabInstance.destroy();
        this.createPlaceholderIcon(sprite.node, unitId);
    }

    /**
     * 创建占位图标（彩色圆圈 + 首字母）
     */
    private createPlaceholderIcon(iconNode: Node, roleId: string) {
        // 背景圆圈
        const g = iconNode.addComponent(Graphics);
        // 根据角色 ID 生成不同颜色
        const colors: Record<string, Color> = {
            // 角色单位
            'ElfSwordsman': new Color(100, 200, 100, 255), // 绿色
            'Hunter': new Color(200, 150, 50, 255),        // 棕色
            'Priest': new Color(200, 100, 200, 255),       // 紫色
            'Wisp': new Color(100, 200, 255, 255),         // 蓝色
            'Mage': new Color(150, 100, 255, 255),         // 蓝紫色
            'Arrower': new Color(150, 200, 100, 255),      // 黄绿色
            // 防御塔
            'WatchTower': new Color(120, 120, 120, 255),   // 灰色
            'ThunderTower': new Color(255, 215, 0, 255),   // 金色
            'IceTower': new Color(100, 200, 255, 255),     // 冰蓝色
            // 石墙
            'StoneWall': new Color(180, 180, 180, 255),    // 浅灰色
            // 特殊单位
            'Bear': new Color(139, 69, 19, 255),           // 棕色（熊）
            'Eagle': new Color(70, 130, 180, 255),         // 钢蓝色（鹰）
            'BeastDen': new Color(101, 67, 33, 255),       // 深棕色（兽穴）
        };
        const color = colors[roleId] || new Color(150, 150, 150, 255);
        g.fillColor = color;
        g.circle(0, 0, 30);
        g.fill();
        g.lineWidth = 2;
        g.strokeColor = new Color(255, 255, 255, 200);
        g.circle(0, 0, 30);
        g.stroke();

        // 显示角色首字母
        const label = iconNode.addComponent(Label);
        const firstChar = roleId.charAt(0);
        label.string = firstChar;
        label.fontSize = 24;
        label.color = new Color(255, 255, 255, 255);
        label.enableOutline = true;
        label.outlineColor = new Color(0, 0, 0, 255);
        label.outlineWidth = 2;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
    }
}
