import { _decorator, Component, Node, Button, Label, find, director, UITransform, Color, Graphics, tween, Vec3, UIOpacity, Sprite, SpriteFrame, Prefab, instantiate, resources, assetManager, sys, view, macro, LabelOutline } from 'cc';
import { GameManager as GameManagerClass } from './GameManager';
import { CountdownPopup } from './CountdownPopup';
// 导入TalentSystem，用于管理天赋系统和单位卡片
import { TalentSystem } from './TalentSystem';
import { PlayerDataManager } from './PlayerDataManager';
import { SoundManager } from './SoundManager';
import { AudioManager } from './AudioManager';
import { BuffManager } from './BuffManager';
import { CheckInManager } from './CheckInManager';
import { GamePopup } from './GamePopup';
import { WeChatShareManager } from './WeChatShareManager';
import { LevelPassRateLabel } from './LevelPassRateLabel';
import { UnitConfigManager } from './UnitConfigManager';
import { FeedbackPopup } from './FeedbackPopup';

const { ccclass, property } = _decorator;

@ccclass('UIManager')
export class UIManager extends Component {
    @property(Button)
    buildButton: Button = null!;

    @property(Button)
    restartButton: Button = null!;

    @property(Button)
    checkInButton: Button = null!; // 签到按钮

    @property(Node)
    towerBuilder: Node = null!;

    @property(CountdownPopup)
    countdownPopup: CountdownPopup = null!;

    @property(Prefab)
    talentPanelPrefab: Prefab = null!; // TalentPanel 预制体（可在编辑器中配置，包含 TalentSystem 组件和边框贴图）

    private gameManager: GameManagerClass = null!;
    private playerDataManager: PlayerDataManager = null!;
    private warningNode: Node = null!;
    private announcementNode: Node = null!;
    private onCountdownComplete: (() => void) | null = null; // 倒计时完成回调
    private onCountdownManualClose: (() => void) | null = null; // 手动关闭回调

    private confirmDialogNode: Node | null = null;

    // 首页三页签相关引用
    private bottomSelectionNodeRef: Node = null!;
    private gameMainPanel: Node = null!;
    private talentPanelNode: Node = null!;
    private settingsPanelNode: Node = null!;

    // 公共背景（场景背景图）
    private backgroundNode: Node = null!;

    // 游戏 HUD 相关引用（来自 GameManager）
    private timerLabelNode: Node = null!;
    private goldLabelNode: Node = null!;
    private populationLabelNode: Node = null!;
    private healthLabelNode: Node = null!;

    // 其他与游戏页相关的节点
    private buildingGridPanelNode: Node = null!;
    private stoneWallGridPanelNode: Node = null!;
    private startGameButtonNode: Node = null!;
    private backToHomeButtonNode: Node = null!;
    private levelSelectLeftButton: Node = null!; // 向左选择关卡按钮
    private levelSelectRightButton: Node = null!; // 向右选择关卡按钮
    private currentLevelLabel: Label = null!; // 当前关卡显示标签
    // 关卡通关率与难度标签组件
    private levelPassRateLabelComp: LevelPassRateLabel | null = null;

    private activePage: 'game' | 'talent' | 'settings' = 'game';
    private currentLevel: number = 1; // 当前选择的关卡（1-10）

    // 分包资源相关
    private isSubpackageLoaded: boolean = false; // 是否已加载分包资源
    private isSubpackageLoading: boolean = false; // 是否正在加载分包资源
    private backgroundSprites: Map<number, SpriteFrame> = new Map(); // 缓存已加载的背景图片（关卡号 -> SpriteFrame）
    private otherBundle: any = null; // other bundle 引用
    private defaultBackgroundSprite: SpriteFrame | null = null; // 记录初始背景图，用于切回第一关

    // 是否已执行过“首次自动开始第一关”的逻辑（避免重复触发）
    private hasCheckedFirstRunAutoStart: boolean = false;

    start() {
        // 查找游戏管理器
        this.findGameManager();
        
        // 确保全局音频控制器在初始化阶段只创建一次
        this.initGlobalAudioManagers();
        
        // 初始化签到管理器
        this.initCheckInManager();
        
        // 初始化玩家数据管理器
        this.playerDataManager = PlayerDataManager.getInstance();
        this.playerDataManager.loadData().then(() => {
            // 根据已通过关卡，计算当前可进行的最大关卡：maxPassed + 1（不超过10）
            if (this.playerDataManager && this.playerDataManager.getPassedLevels) {
                const passed = this.playerDataManager.getPassedLevels();
                if (passed && passed.length > 0) {
                    const maxPassed = Math.max(...passed);
                    this.currentLevel = Math.min(10, maxPassed + 1);
                } else {
                    // 首次进入游戏：本地无任何通关记录，默认从第1关开始
                    this.currentLevel = 1;
                }
            }
            // 初始化关卡显示和下一关按钮状态
            this.updateStartButtonText();

            // 如果当前关卡大于1，确保分包背景资源已加载，并切换到对应关卡背景
            if (this.currentLevel > 1) {
                this.loadSubpackageResources()
                    .then(() => {
                        this.changeBackground(this.currentLevel);
                    })
                    .catch((err) => {
                        console.warn('[UIManager.start] 加载分包背景资源失败，仍使用默认背景', err);
                    });
            }

            // 首次进入游戏时，根据本地缓存自动开始第一关
            this.checkAndAutoStartFirstLevel();
        });

        // 检查并自动创建countdownPopup
        this.autoCreateCountdownPopup();


        // 检查TowerBuilder
        if (this.towerBuilder) {
        } else {
        }
        
        // 初始化特效节点
        this.createEffects();
        
        // 创建底部选区UI（首页三个页面）
        this.createBottomSelectionUI();

        // 默认激活游戏页
        this.setActivePage('game');
        
        // 初始化重新开始按钮贴图
        if (this.restartButton && this.restartButton.node) {
            this.setupButtonSprite(this.restartButton.node, 'restart.png', 'restart_down.png');
        }
        
        // 绑定开始游戏按钮事件（延迟绑定，确保按钮已创建）
        this.scheduleOnce(() => {
            this.bindStartGameButton();
            this.bindCheckInButton();
        }, 0.1);
        
        // 初始化微信转发功能
        this.initWeChatShare();
        
        // 播放主菜单背景音乐（进入游戏首页时播放 backMusic.mp3）
        // 如果玩家在退出到首页前已经关闭了BGM，则通过本地标记跳过一次首页自动播放，
        // 确保“关闭背景音乐后只能在设置页重新打开”
        const soundManager = SoundManager.getInstance();
        let skipBgmOnce = false;
        try {
            const skipStr = sys.localStorage.getItem('TowerDemo_SkipBgmOnNextHome');
            skipBgmOnce = skipStr === '1';
        } catch (e) {
            // 读取失败时按正常逻辑处理（不跳过）
            console.warn('[UIManager.start] 读取 TowerDemo_SkipBgmOnNextHome 失败: ', e);
        }
        if (skipBgmOnce) {
           //console.info('[UIManager.start] 检测到 TowerDemo_SkipBgmOnNextHome=1，本次进入首页不自动播放BGM');
            try {
                sys.localStorage.setItem('TowerDemo_SkipBgmOnNextHome', '0');
            } catch (e) {
                console.warn('[UIManager.start] 重置 TowerDemo_SkipBgmOnNextHome 失败: ', e);
            }
        }
        const isBgmOn = soundManager ? soundManager.isBgmOn() : null;
       //console.info('[UIManager.start] 准备自动播放首页BGM? isBgmOn =', isBgmOn, 'skipBgmOnce =', skipBgmOnce);
        if (soundManager && isBgmOn && !skipBgmOnce) {
           //console.info('[UIManager.start] 条件满足，调用 soundManager.playMenuBgm()');
            soundManager.playMenuBgm();
        } else {
            // console.info('[UIManager.start] 不自动播放首页BGM，原因：',
            //     !soundManager ? 'soundManager 为空' :
            //     !isBgmOn ? 'BGM 开关关闭' :
            //     skipBgmOnce ? 'skipBgmOnce = true' : '未知');
        }
    }

    /**
     * 首次进入游戏时，根据本地缓存自动开始第一关
     * 规则：
     * - 本地无任何通关记录（passedLevels 为空或不存在）；
     * - 且本地没有“已自动开始过”的标记；
     * 则自动触发开始第一关，相当于玩家点了一次“开始游戏”按钮。
     */
    private checkAndAutoStartFirstLevel() {
        if (this.hasCheckedFirstRunAutoStart) {
            return;
        }
        this.hasCheckedFirstRunAutoStart = true;

        try {
            const flag = sys.localStorage.getItem('tower_first_run_auto_started');
            if (flag === '1') {
                // 已经自动开始过，不再重复触发
                return;
            }
        } catch (e) {
            console.warn('[UIManager.checkAndAutoStartFirstLevel] 读取本地标记失败:', e);
        }

        // 判定是否为“首次进入”：没有任何通关记录
        let isFirstRun = true;
        if (this.playerDataManager && this.playerDataManager.getPassedLevels) {
            const passed = this.playerDataManager.getPassedLevels();
            if (passed && passed.length > 0) {
                isFirstRun = false;
            }
        }

        if (!isFirstRun) {
            return;
        }

        console.log('[UIManager.checkAndAutoStartFirstLevel] 检测为首次进入游戏，自动开始第一关');

        // currentLevel 已在 loadData 后初始化为 1，这里直接模拟点击开始游戏
        // 需要确保 BottomSelection / 开始按钮 已创建完毕，使用 scheduleOnce 延迟一帧执行
        this.scheduleOnce(() => {
            try {
                // 通过已经绑定的开始游戏逻辑来启动游戏，避免重复写启动代码
                if (this.startGameButtonNode && this.startGameButtonNode.isValid) {
                    const btn = this.startGameButtonNode.getComponent(Button);
                    if (btn && btn.clickEvents && btn.clickEvents.length > 0) {
                        // 如果通过 Cocos 事件面板配置了 clickEvents，可以遍历触发
                        btn.clickEvents.forEach((ev) => {
                            if (ev && ev.target && ev.component && ev.handler && (ev.target as any)[ev.component] && typeof (ev.target as any)[ev.component][ev.handler] === 'function') {
                                (ev.target as any)[ev.component][ev.handler].apply(ev.target, ev.customEventData ? [ev.customEventData] : []);
                            }
                        });
                    } else {
                        // 否则，直接复用我们在 createBottomSelectionUI 中配置的回调逻辑
                        // 这里简单调用 setActivePage('game') 并隐藏底部三页签，再通知 GameManager 开始游戏
                        this.setActivePage('game');
                        const bottomSelectionNode = this.bottomSelectionNodeRef || find('Canvas/BottomSelection');
                        if (bottomSelectionNode) {
                            bottomSelectionNode.active = false;
                        }
                        // 同时隐藏签到按钮（签到宝箱），与上一关/下一关按钮保持一致：仅在首页关卡选择界面显示
                        if (this.checkInButton && this.checkInButton.node && this.checkInButton.node.isValid) {
                            this.checkInButton.node.active = false;
                        }
                        // 通知 GameManager 实际开始游戏
                        this.findGameManager();
                        const gm = this.gameManager as any;
                        if (gm && gm.startGame) {
                            gm.startGame(this.currentLevel || 1);
                        }
                    }
                }

                // 标记已自动开始过，后续不再重复自动触发
                try {
                    sys.localStorage.setItem('tower_first_run_auto_started', '1');
                } catch (e) {
                    console.warn('[UIManager.checkAndAutoStartFirstLevel] 写入本地标记失败:', e);
                }
            } catch (e) {
                console.error('[UIManager.checkAndAutoStartFirstLevel] 自动开始第一关异常:', e);
            }
        }, 0.2);
    }

    /**
     * 游戏初始化阶段，确保全局音频控制器（AudioManager / SoundManager）只创建一次
     */
    private initGlobalAudioManagers() {
        const scene = director.getScene();
        const root = find('Canvas') || scene;
        if (!root) {
            console.warn('[UIManager] initGlobalAudioManagers() cannot find Canvas or scene root');
            return;
        }

        // 确保 AudioManager 存在
        let audioMgr = AudioManager.Instance;
        if (!audioMgr) {
            const audioNode = new Node('AudioManager');
            root.addChild(audioNode);
            audioMgr = audioNode.addComponent(AudioManager);
           //console.info('[UIManager] initGlobalAudioManagers() created AudioManager under', root.name);
        }

        // 确保 SoundManager 存在
        let soundMgr = SoundManager.getInstance();
        if (!soundMgr) {
            const soundNode = new Node('SoundManager');
            root.addChild(soundNode);
            soundMgr = soundNode.addComponent(SoundManager);
           //console.info('[UIManager] initGlobalAudioManagers() created SoundManager under', root.name);
        }
    }
    
    /**
     * 创建底部选区UI
     */
    createBottomSelectionUI() {
        // 直接创建底部选区，不使用UIBuilder，确保它能立即显示
        
        // 获取Canvas节点
        let canvasNode = find('Canvas');
        if (!canvasNode) {
            canvasNode = this.node;
        }
        
        // 检查底部选区节点是否已存在
        let bottomSelectionNode = find('Canvas/BottomSelection');
        if (bottomSelectionNode) {
            // 节点已存在，直接返回，避免重复创建
            return;
        }
        
        // 获取Canvas的尺寸信息
        const canvasTransform = canvasNode.getComponent(UITransform);
        const canvasWidth = canvasTransform ? canvasTransform.width : 750;
        const canvasHeight = canvasTransform ? canvasTransform.height : 640;
        
        // 三页签区高度设置为原来的一倍（从100变为200）
        const tabAreaHeight = 200;
        
        // 创建底部选区容器 - 覆盖整个屏幕
        bottomSelectionNode = new Node('BottomSelection');
        bottomSelectionNode.setParent(canvasNode);
        
        // 设置为可见
        bottomSelectionNode.active = true;
        
        // 添加UITransform组件
        const uiTransform = bottomSelectionNode.addComponent(UITransform);
        uiTransform.setContentSize(canvasWidth, canvasHeight);
        uiTransform.setAnchorPoint(0.5, 0.5);
        
        // 设置位置在屏幕中心
        bottomSelectionNode.setPosition(0, 0, 0);
        
        // 设置z轴顺序为最高
        bottomSelectionNode.setSiblingIndex(canvasNode.children.length - 1);
        
        // 在底部选区容器上直接绘制背景，确保整个区域背景统一
        // 这将确保面板和底部按钮容器之间没有空白区域
        const bottomSelectionBackground = bottomSelectionNode.getComponent(Graphics) || bottomSelectionNode.addComponent(Graphics);
        // 先绘制默认的深色背景
        bottomSelectionBackground.fillColor = new Color(0, 0, 0, 150); // 半透明黑色背景
        bottomSelectionBackground.rect(-canvasWidth / 2, -canvasHeight / 2, canvasWidth, canvasHeight);
        bottomSelectionBackground.fill();
        
        // 获取底部选区容器的尺寸信息，在整个函数中只声明一次
        const bottomSelectionTransform = bottomSelectionNode.getComponent(UITransform);
        // 默认尺寸，防止获取不到transform的情况
        const defaultWidth = 750;
        const defaultHeight = 640;
        
        // 计算面板尺寸，在整个函数中只计算一次
        const panelWidth = bottomSelectionTransform ? bottomSelectionTransform.width : defaultWidth;
        const panelHeight = bottomSelectionTransform ? bottomSelectionTransform.height : defaultHeight;
        
        // 我们将为天赋面板添加一个特殊处理，确保它的蓝色背景覆盖整个区域
        // 当点击天赋标签时，我们会更新这个背景颜色
        
        // 1. 创建游戏主体面板 - 覆盖整个屏幕，包括底部按钮区域
        const gameMainPanel = new Node('GameMainPanel');
        gameMainPanel.setParent(bottomSelectionNode);
        
        // 设置游戏主体面板尺寸：覆盖整个屏幕
        const gamePanelTransform = gameMainPanel.addComponent(UITransform);
        // 使用底部选区容器的尺寸，避免使用未定义的canvasWidth和canvasHeight
        gamePanelTransform.setContentSize(panelWidth, panelHeight);
        gamePanelTransform.setAnchorPoint(0.5, 0.5);
        
        // 位置：屏幕中心
        gameMainPanel.setPosition(0, 0, 0);
        
        // 确保面板可见
        gameMainPanel.active = true;
        
        // 游戏主体面板暂时设置为最高层级，确保开始游戏按钮可点击
        gameMainPanel.setSiblingIndex(bottomSelectionNode.children.length - 1);
        
        // 移除单独的面板背景，使用底部选区容器的统一背景
        // 这样可以确保面板和底部按钮容器之间没有空白区域
        
        // 1. 创建关卡选择区域（上方）
        const levelSelectArea = new Node('LevelSelectArea');
        levelSelectArea.setParent(gameMainPanel);
        levelSelectArea.setPosition(0, 80, 0);
        const levelSelectAreaTransform = levelSelectArea.addComponent(UITransform);
        // 加高关卡选择区域，给上方“通关率/难度徽章”留空间，但不改变原有关卡标签的居中位置
        levelSelectAreaTransform.setContentSize(400, 220);
        levelSelectAreaTransform.setAnchorPoint(0.5, 0.5);

        // 在关卡选择区域上方创建通关率与难度标签容器（整体居中显示）
        const levelStatsContainer = new Node('LevelStatsContainer');
        levelStatsContainer.setParent(levelSelectArea);
        // 往上移动 50 像素
        levelStatsContainer.setPosition(0, 105, 0);
        const levelStatsTransform = levelStatsContainer.addComponent(UITransform);
        levelStatsTransform.setContentSize(320, 70);
        levelStatsTransform.setAnchorPoint(0.5, 0.5);

        // 添加关卡通关率组件
        const passRateComp = levelStatsContainer.addComponent(LevelPassRateLabel);

        // 通关率文本（居中）
        const passRateNode = new Node('PassRateLabel');
        passRateNode.setParent(levelStatsContainer);
        passRateNode.setPosition(0, 18, 0);
        const passRateTransform = passRateNode.addComponent(UITransform);
        passRateTransform.setContentSize(300, 30);
        passRateTransform.setAnchorPoint(0.5, 0.5);
        const passRateLabel = passRateNode.addComponent(Label);
        passRateLabel.string = '通关率 --';
        // 字体调大两号
        passRateLabel.fontSize = 22;
        passRateLabel.color = new Color(220, 220, 220, 255);
        passRateLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        passRateLabel.verticalAlign = Label.VerticalAlign.CENTER;

        // 难度徽章背景节点（用于地狱/炼狱等有底色的样式）
        const difficultyBgNode = new Node('DifficultyBg');
        difficultyBgNode.setParent(levelStatsContainer);
        difficultyBgNode.setPosition(0, -15, 0);
        const difficultyBgTransform = difficultyBgNode.addComponent(UITransform);
        difficultyBgTransform.setContentSize(120, 34);
        difficultyBgTransform.setAnchorPoint(0.5, 0.5);
        // 用 Graphics 画底色（Sprite 没有 spriteFrame 时不会显示颜色）
        const difficultyBgG = difficultyBgNode.addComponent(Graphics);
        difficultyBgG.clear(); // 初始透明，由组件根据难度设置绘制

        // 难度文字
        const difficultyLabelNode = new Node('DifficultyLabel');
        difficultyLabelNode.setParent(difficultyBgNode);
        difficultyLabelNode.setPosition(0, 0, 0);
        const difficultyLabelTransform = difficultyLabelNode.addComponent(UITransform);
        difficultyLabelTransform.setContentSize(120, 30);
        difficultyLabelTransform.setAnchorPoint(0.5, 0.5);
        const difficultyLabel = difficultyLabelNode.addComponent(Label);
        difficultyLabel.string = '未知';
        // 字体调大两号
        difficultyLabel.fontSize = 24;
        difficultyLabel.color = new Color(153, 153, 153, 255);
        difficultyLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        difficultyLabel.verticalAlign = Label.VerticalAlign.CENTER;

        // 将子节点绑定给组件
        passRateComp.passRateLabel = passRateLabel;
        passRateComp.difficultyLabel = difficultyLabel;
        passRateComp.difficultyBg = difficultyBgNode;
        this.levelPassRateLabelComp = passRateComp;
        
        // 创建关卡显示标签（中间）
        const levelDisplayLabel = new Node('LevelDisplayLabel');
        levelDisplayLabel.setParent(levelSelectArea);
        // 保持原有关卡标签位置：位于左右箭头按钮之间的居中位置
        levelDisplayLabel.setPosition(0, 0, 0);
        const levelDisplayLabelTransform = levelDisplayLabel.addComponent(UITransform);
        levelDisplayLabelTransform.setContentSize(200, 60);
        levelDisplayLabelTransform.setAnchorPoint(0.5, 0.5);
        const levelDisplayLabelComp = levelDisplayLabel.addComponent(Label);
        this.currentLevelLabel = levelDisplayLabelComp; // 保存引用用于更新关卡显示
        this.updateStartButtonText();
        levelDisplayLabelComp.fontSize = 28;
        levelDisplayLabelComp.color = Color.WHITE;
        levelDisplayLabelComp.horizontalAlign = Label.HorizontalAlign.CENTER;
        levelDisplayLabelComp.verticalAlign = Label.VerticalAlign.CENTER;
        levelDisplayLabelComp.lineHeight = 60;
        
        // 创建关卡选择按钮（向左箭头）
        const leftArrowButton = new Node('LevelSelectLeftButton');
        leftArrowButton.setParent(levelSelectArea);
        leftArrowButton.setPosition(-150, 0, 0);
        const leftArrowTransform = leftArrowButton.addComponent(UITransform);
        leftArrowTransform.setContentSize(100, 100);
        leftArrowTransform.setAnchorPoint(0.5, 0.5);
        
        const leftArrowButtonComp = leftArrowButton.addComponent(Button);
        leftArrowButtonComp.node.on(Button.EventType.CLICK, () => {
            this.selectPreviousLevel();
        }, this);
        
        this.levelSelectLeftButton = leftArrowButton;
        
        // 使用贴图替代Graphics绘制
        this.setupButtonSprite(leftArrowButton, 'lastLevel.png', 'lastLevel_down.png');
        
        // 创建关卡选择按钮（向右箭头）
        const rightArrowButton = new Node('LevelSelectRightButton');
        rightArrowButton.setParent(levelSelectArea);
        rightArrowButton.setPosition(150, 0, 0);
        const rightArrowTransform = rightArrowButton.addComponent(UITransform);
        rightArrowTransform.setContentSize(100, 100);
        rightArrowTransform.setAnchorPoint(0.5, 0.5);
        
        const rightArrowButtonComp = rightArrowButton.addComponent(Button);
        rightArrowButtonComp.node.on(Button.EventType.CLICK, () => {
            this.selectNextLevel();
        }, this);
        
        this.levelSelectRightButton = rightArrowButton;
        
        // 使用贴图替代Graphics绘制
        this.setupButtonSprite(rightArrowButton, 'nextLevel.png', 'nextLevel_down.png');
        
        // 2. 创建开始游戏按钮（下方）
        const startButton = new Node('StartGameButton');
        startButton.setParent(gameMainPanel);
        startButton.setPosition(0, -80, 0);
        
        // 确保按钮可见
        startButton.active = true;
        
        // 添加按钮变换组件
        const startButtonTransform = startButton.addComponent(UITransform);
        startButtonTransform.setContentSize(100, 100); // 增大按钮尺寸，确保可见
        startButtonTransform.setAnchorPoint(0.5, 0.5);
        
        // 添加Button组件
        const startButtonComp = startButton.addComponent(Button);
        
        // 使用贴图替代Graphics绘制和Label文本
        this.setupButtonSprite(startButton, 'start.png', 'start_down.png');
        
        // 确保开始游戏按钮位于gameMainPanel的最上层
        startButton.setSiblingIndex(gameMainPanel.children.length - 1);
        
        // 2. 创建天赋面板 - 优先使用预制体，如果没有则动态创建
        let talentPanel: Node;
        
        if (this.talentPanelPrefab) {
            // 使用预制体实例化
            talentPanel = instantiate(this.talentPanelPrefab);
            talentPanel.name = 'TalentPanel';
            talentPanel.setParent(bottomSelectionNode);
            
            // 设置面板尺寸和位置
            const talentPanelTransform = talentPanel.getComponent(UITransform) || talentPanel.addComponent(UITransform);
            talentPanelTransform.setContentSize(panelWidth, panelHeight);
            talentPanelTransform.setAnchorPoint(0.5, 0.5);
            talentPanel.setPosition(0, 0, 0);
            
            // 设置面板层级
            talentPanel.setSiblingIndex(bottomSelectionNode.children.length - 2);
            
            // 确保 TalentSystem 组件的 talentPanel 属性已设置
            // 先查找所有子节点中的 TalentSystem 组件（因为组件可能在子节点上）
            let talentSystem = talentPanel.getComponent(TalentSystem);
            if (!talentSystem) {
                // 递归查找子节点
                const findTalentSystem = (node: Node): TalentSystem | null => {
                    const comp = node.getComponent(TalentSystem);
                    if (comp) return comp;
                    for (const child of node.children) {
                        const found = findTalentSystem(child);
                        if (found) return found;
                    }
                    return null;
                };
                talentSystem = findTalentSystem(talentPanel);
            }
            
            if (talentSystem) {
                talentSystem.talentPanel = talentPanel;
            } else {
                const newTalentSystem = talentPanel.addComponent(TalentSystem);
                newTalentSystem.talentPanel = talentPanel;
            }
        } else {
            // 降级方案：动态创建（保持向后兼容）
            talentPanel = new Node('TalentPanel');
            talentPanel.setParent(bottomSelectionNode);
            
            // 设置面板尺寸和位置 - 覆盖整个屏幕，从顶部到底部
            const talentPanelTransform = talentPanel.getComponent(UITransform) || talentPanel.addComponent(UITransform);
            // 面板高度：覆盖整个屏幕，包括底部按钮区域
            talentPanelTransform.setContentSize(panelWidth, panelHeight);
            talentPanelTransform.setAnchorPoint(0.5, 0.5);
            
            // 位置：屏幕中心
            talentPanel.setPosition(0, 0, 0);
            
            // 设置面板层级，确保在底部选区背景之上，但在底部按钮容器之下
            talentPanel.setSiblingIndex(bottomSelectionNode.children.length - 2);
            
            // 添加半透明背景，确保内容可见且与底部按钮容器连接
            const talentPanelBackground = talentPanel.getComponent(Graphics) || talentPanel.addComponent(Graphics);
            // 设置为透明背景，让三页共用同一张全局背景图
            talentPanelBackground.fillColor = new Color(0, 0, 0, 0);
            // 使用talentPanelTransform获取尺寸
            const talentPanelWidth = talentPanelTransform.width;
            const talentPanelHeight = talentPanelTransform.height;
            talentPanelBackground.rect(-talentPanelWidth / 2, -talentPanelHeight / 2, talentPanelWidth, talentPanelHeight);
            talentPanelBackground.fill();
            
            // 移除边框，避免与底部按钮容器重叠产生横线
            // talentPanelBackground.lineWidth = 2;
            // talentPanelBackground.strokeColor = new Color(100, 150, 255, 255);
            // talentPanelBackground.rect(-talentPanelWidth / 2, -talentPanelHeight / 2, talentPanelWidth, talentPanelHeight);
            // talentPanelBackground.stroke();
            
            // 天赋面板标题
            const talentLabel = talentPanel.getComponent(Label) || talentPanel.addComponent(Label);
            talentLabel.string = '天赋面板 - 强化友方单位';
            talentLabel.fontSize = 28;
            talentLabel.color = new Color(100, 200, 255, 255);
            talentLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            talentLabel.verticalAlign = Label.VerticalAlign.TOP;
            // 标题位置：顶部居中，距离顶部50像素
            // 使用固定值，避免使用未定义的canvasHeight
            talentLabel.node.setPosition(0, 200, 0); // 固定Y坐标，确保标题可见
            
            // 添加 TalentSystem 组件到 TalentPanel
            const talentSystem = talentPanel.getComponent(TalentSystem) || talentPanel.addComponent(TalentSystem);
            talentSystem.talentPanel = talentPanel;
        }
        
        // 初始隐藏
        talentPanel.active = false;
        
        // 注意：天赋列表由 TalentSystem 组件自动创建，不需要在这里手动创建
        // 3. 创建设置面板 - 初始隐藏
        const settingsPanel = new Node('SettingsPanel');
        settingsPanel.setParent(bottomSelectionNode);
        settingsPanel.active = false; // 初始隐藏
        
        // 设置面板尺寸和位置 - 覆盖整个屏幕
        const settingsPanelTransform = settingsPanel.addComponent(UITransform);
        // 使用底部选区容器的尺寸，避免使用未定义的canvasWidth和canvasHeight
        settingsPanelTransform.setContentSize(panelWidth, panelHeight);
        settingsPanelTransform.setAnchorPoint(0.5, 0.5);
        
        // 位置：屏幕中心
        settingsPanel.setPosition(0, 0, 0);
        
        // 设置面板层级，确保在底部选区背景之上，但在底部按钮容器之下
        settingsPanel.setSiblingIndex(bottomSelectionNode.children.length - 2);
        
        // 添加半透明背景，确保内容可见且覆盖整个屏幕
        const settingsPanelBackground = settingsPanel.addComponent(Graphics);
        // 设置为透明背景，让三页共用同一张全局背景图
        settingsPanelBackground.fillColor = new Color(0, 0, 0, 0);
        // 背景从屏幕顶部到底部完全覆盖
        settingsPanelBackground.rect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight);
        settingsPanelBackground.fill();
        
        // 移除边框，避免与底部按钮容器重叠产生横线
        // settingsPanelBackground.lineWidth = 2;
        // settingsPanelBackground.strokeColor = new Color(255, 100, 150, 255);
        // settingsPanelBackground.rect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight);
        // settingsPanelBackground.stroke();
        
        // 设置面板标题
        const settingsLabel = settingsPanel.addComponent(Label);
        settingsLabel.string = '设置面板 - 音效开关';
        settingsLabel.fontSize = 28;
        settingsLabel.color = new Color(255, 100, 150, 255);
        settingsLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        settingsLabel.verticalAlign = Label.VerticalAlign.TOP;
        // 标题位置：顶部居中，距离顶部150像素（往下移）
        settingsLabel.node.setPosition(0, panelHeight / 2 - 150, 0);
        
        // 设置项容器
        const settingsList = new Node('SettingsList');
        settingsList.setParent(settingsPanel);
        settingsList.setPosition(0, 0, 0);
        
        // 设置项配置
        const settingNames = ['背景音乐', '音效', '振动'];
        
        // 计算设置项的最佳位置（往下移，避免被顶部遮挡）
        const settingItemHeight = 90;
        const settingItemSpacing = 25; // 增加Y轴间隔
        const totalSettingHeight = settingNames.length * settingItemHeight + (settingNames.length - 1) * settingItemSpacing;
        // 往下偏移150像素，确保所有元素都可见
        const verticalOffset = -150; // 向下偏移
        const settingStartY = totalSettingHeight / 2 - settingItemHeight / 2 + verticalOffset;
        
        for (let i = 0; i < settingNames.length; i++) {
            const settingItem = new Node(`SettingItem${i}`);
            settingItem.setParent(settingsList);
            // 垂直居中排列设置项，增加间隔
            settingItem.setPosition(0, settingStartY - i * (settingItemHeight + settingItemSpacing), 0);
            
            // 设置项背景 - 基于屏幕宽度百分比，实现居中
            const settingItemBg = settingItem.addComponent(Graphics);
            const settingItemWidth = panelWidth * 0.8; // 使用面板宽度的80%，确保居中
            
            // 改为透明灰色背景
            settingItemBg.fillColor = new Color(100, 100, 100, 120); // 透明灰色
            // 计算居中的矩形位置：x从-settingItemWidth/2开始，到settingItemWidth/2结束
            settingItemBg.roundRect(-settingItemWidth/2, -settingItemHeight/2, settingItemWidth, settingItemHeight, 12);
            settingItemBg.fill();
            // 美化边框：使用更柔和的灰色边框
            settingItemBg.lineWidth = 2;
            settingItemBg.strokeColor = new Color(150, 150, 150, 180);
            settingItemBg.roundRect(-settingItemWidth/2, -settingItemHeight/2, settingItemWidth, settingItemHeight, 12);
            settingItemBg.stroke();
            
            // 设置项名称 - 创建独立子节点，确保可见
            const settingNameNode = new Node('SettingName');
            settingNameNode.setParent(settingItem);
            settingNameNode.setPosition(-settingItemWidth/4, 0, 0); // 左对齐，留出空间给开关
            
            const settingItemName = settingNameNode.addComponent(Label);
            settingItemName.string = settingNames[i];
            settingItemName.fontSize = 28; // 适当增大字体
            settingItemName.color = new Color(255, 255, 255, 255); // 改为白色，更清晰
            settingItemName.horizontalAlign = Label.HorizontalAlign.LEFT; // 左对齐
            settingItemName.verticalAlign = Label.VerticalAlign.CENTER;
            
            // 开关按钮容器 - 居中偏右显示
            const toggleContainer = new Node(`ToggleContainer${i}`);
            toggleContainer.setParent(settingItem);
            // 位置设为(settingItemWidth/4, 0)，使其在设置项中居中偏右
            toggleContainer.setPosition(settingItemWidth/4, 0, 0);
            
            // 开关背景 - 美化样式
            const toggleBg = toggleContainer.addComponent(Graphics);
            // 开关旋钮 - 美化样式
            const toggleKnob = toggleContainer.addComponent(Graphics);
            
            // 设置UITransform，确保点击区域正确
            const toggleTransform = toggleContainer.addComponent(UITransform);
            toggleTransform.setContentSize(70, 40);
            toggleTransform.setAnchorPoint(0.5, 0.5);
            
            // 添加Button组件
            toggleContainer.addComponent(Button);

            // 如果是第一个设置项（背景音乐），根据当前开关状态初始化视觉效果
            if (i === 0) {
                const soundManager = SoundManager.getInstance();
                // 优先从 SoundManager 读取状态，如果 SoundManager 不存在或状态未加载，则直接从 localStorage 读取
                let isOn = true; // 默认值
                if (soundManager) {
                    isOn = soundManager.isBgmOn();
                } else {
                    // 如果 SoundManager 不存在，直接从 localStorage 读取
                    try {
                        const bgmStr = sys.localStorage.getItem('TowerDemo_BGM_Enabled');
                        isOn = bgmStr === null ? true : bgmStr === '1';
                    } catch (e) {
                        // 读取失败，使用默认值 true
                    }
                }

                const updateBgmToggleVisual = (on: boolean) => {
                    toggleBg.clear();
                    toggleKnob.clear();

                    // 背景颜色：开启为绿色，关闭为灰色
                    toggleBg.fillColor = on ? new Color(80, 180, 80, 220) : new Color(80, 80, 80, 200);
                    toggleBg.roundRect(-35, -20, 70, 40, 20);
                    toggleBg.fill();
                    toggleBg.lineWidth = 1;
                    toggleBg.strokeColor = new Color(120, 120, 120, 255);
                    toggleBg.roundRect(-35, -20, 70, 40, 20);
                    toggleBg.stroke();

                    // 旋钮位置：开启在右侧，关闭在左侧
                    const knobX = on ? 15 : -15;
                    toggleKnob.fillColor = new Color(200, 200, 200, 255);
                    toggleKnob.circle(knobX, 0, 15);
                    toggleKnob.fill();
                    toggleKnob.lineWidth = 1;
                    toggleKnob.strokeColor = new Color(150, 150, 150, 255);
                    toggleKnob.circle(knobX, 0, 15);
                    toggleKnob.stroke();
                };

                // 初始化一次
                updateBgmToggleVisual(isOn);

                // 绑定点击事件（具体逻辑在后面绑定交互时补充）
                // 这里先把函数挂在容器上，后面复用
                (toggleContainer as any)._updateBgmToggleVisual = updateBgmToggleVisual;
                (toggleContainer as any)._isOn = isOn;
            }
            // 如果是第二个设置项（音效），根据当前音效开关状态初始化视觉效果
            else if (i === 1) {
                const soundManager = SoundManager.getInstance();
                // 优先从 SoundManager 读取状态，如果 SoundManager 不存在或状态未加载，则直接从 localStorage 读取
                let isOn = true; // 默认值
                if (soundManager) {
                    isOn = soundManager.isEffectOn();
                } else {
                    // 如果 SoundManager 不存在，直接从 localStorage 读取
                    try {
                        const sfxStr = sys.localStorage.getItem('TowerDemo_SFX_Enabled');
                        isOn = sfxStr === null ? true : sfxStr === '1';
                    } catch (e) {
                        // 读取失败，使用默认值 true
                    }
                }

                const updateSfxToggleVisual = (on: boolean) => {
                    toggleBg.clear();
                    toggleKnob.clear();

                    // 背景颜色：开启为绿色，关闭为灰色
                    toggleBg.fillColor = on ? new Color(80, 180, 80, 220) : new Color(80, 80, 80, 200);
                    toggleBg.roundRect(-35, -20, 70, 40, 20);
                    toggleBg.fill();
                    toggleBg.lineWidth = 1;
                    toggleBg.strokeColor = new Color(120, 120, 120, 255);
                    toggleBg.roundRect(-35, -20, 70, 40, 20);
                    toggleBg.stroke();

                    // 旋钮位置：开启在右侧，关闭在左侧
                    const knobX = on ? 15 : -15;
                    toggleKnob.fillColor = new Color(200, 200, 200, 255);
                    toggleKnob.circle(knobX, 0, 15);
                    toggleKnob.fill();
                    toggleKnob.lineWidth = 1;
                    toggleKnob.strokeColor = new Color(150, 150, 150, 255);
                    toggleKnob.circle(knobX, 0, 15);
                    toggleKnob.stroke();
                };

                // 初始化一次
                updateSfxToggleVisual(isOn);

                (toggleContainer as any)._updateSfxToggleVisual = updateSfxToggleVisual;
                (toggleContainer as any)._isOn = isOn;
            }
        }

        // 绑定设置项的交互逻辑：背景音乐开关键
        const soundManager = SoundManager.getInstance();
        if (soundManager) {
            const bgmItem = settingsList.getChildByName('SettingItem0');
            if (bgmItem) {
                const bgmToggle = bgmItem.getChildByName('ToggleContainer0');
                if (bgmToggle) {
                    const bgmButton = bgmToggle.getComponent(Button);
                    if (bgmButton) {
                        bgmButton.node.on(Button.EventType.CLICK, () => {
                            // 调用SoundManager切换背景音乐开关
                            const enabled = soundManager.toggleBgm();

                            // 更新视觉效果
                            const containerAny = bgmToggle as any;
                            if (containerAny._updateBgmToggleVisual) {
                                containerAny._isOn = enabled;
                                containerAny._updateBgmToggleVisual(enabled);
                            }

                            // 如果打开开关，根据当前是否在首页决定播放哪种背景音乐
                            if (enabled) {
                                // 底部三页签可见且游戏面板处于首页状态时，认为在首页，播放主菜单音乐
                                const isHome = this.bottomSelectionNodeRef && this.bottomSelectionNodeRef.active;
                                if (isHome) {
                                    soundManager.playMenuBgm();
                                } else {
                                    soundManager.playGameBgm();
                                }
                            }
                        }, this);
                    }
                }
            }
        }

        // 绑定设置项的交互逻辑：音效开关键
        if (soundManager) {
            const sfxItem = settingsList.getChildByName('SettingItem1');
            if (sfxItem) {
                const sfxToggle = sfxItem.getChildByName('ToggleContainer1');
                if (sfxToggle) {
                    const sfxButton = sfxToggle.getComponent(Button);
                    if (sfxButton) {
                        sfxButton.node.on(Button.EventType.CLICK, () => {
                            // 调用SoundManager切换音效开关
                            const enabled = soundManager.toggleEffect();

                            // 更新视觉效果
                            const containerAny = sfxToggle as any;
                            if (containerAny._updateSfxToggleVisual) {
                                containerAny._isOn = enabled;
                                containerAny._updateSfxToggleVisual(enabled);
                            }
                        }, this);
                    }
                }
            }
        }

        // 反馈意见按钮（设置页互动入口）
        const feedbackItem = new Node('SettingItemFeedback');
        feedbackItem.setParent(settingsList);
        // 放在现有开关项的下方
        const feedbackY = settingStartY - settingNames.length * (settingItemHeight + settingItemSpacing);
        feedbackItem.setPosition(0, feedbackY, 0);

        const feedbackBg = feedbackItem.addComponent(Graphics);
        const feedbackWidth = panelWidth * 0.8;
        feedbackBg.fillColor = new Color(100, 100, 100, 120);
        feedbackBg.roundRect(-feedbackWidth / 2, -settingItemHeight / 2, feedbackWidth, settingItemHeight, 12);
        feedbackBg.fill();
        feedbackBg.lineWidth = 2;
        feedbackBg.strokeColor = new Color(150, 150, 150, 180);
        feedbackBg.roundRect(-feedbackWidth / 2, -settingItemHeight / 2, feedbackWidth, settingItemHeight, 12);
        feedbackBg.stroke();

        const feedbackNameNode = new Node('SettingName');
        feedbackNameNode.setParent(feedbackItem);
        feedbackNameNode.setPosition(-feedbackWidth / 4, 0, 0);
        const feedbackLabel = feedbackNameNode.addComponent(Label);
        feedbackLabel.string = '反馈意见';
        feedbackLabel.fontSize = 28;
        feedbackLabel.color = new Color(255, 255, 255, 255);
        feedbackLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        feedbackLabel.verticalAlign = Label.VerticalAlign.CENTER;

        const feedbackBtnNode = new Node('FeedbackButton');
        feedbackBtnNode.setParent(feedbackItem);
        feedbackBtnNode.setPosition(feedbackWidth / 4, 0, 0);
        feedbackBtnNode.addComponent(UITransform).setContentSize(160, 50);
        const fbg = feedbackBtnNode.addComponent(Graphics);
        fbg.fillColor = new Color(80, 160, 255, 255);
        fbg.roundRect(-80, -25, 160, 50, 10);
        fbg.fill();
        const fbtn = feedbackBtnNode.addComponent(Button);
        const fln = new Node('Label');
        fln.setParent(feedbackBtnNode);
        fln.addComponent(UITransform).setContentSize(160, 50);
        const fl = fln.addComponent(Label);
        fl.string = '打开';
        fl.fontSize = 20;
        fl.color = new Color(255, 255, 255, 255);
        fl.horizontalAlign = Label.HorizontalAlign.CENTER;
        fl.verticalAlign = Label.VerticalAlign.CENTER;
        fbtn.node.on(Button.EventType.CLICK, () => {
            FeedbackPopup.show();
        }, this);
        
        // 4. 创建底部标签页按钮容器 - 位于画面最底部
        const buttonContainer = new Node('ButtonContainer');
        buttonContainer.setParent(bottomSelectionNode);
        
        // 设置按钮容器尺寸和位置 - 高度为原来的一倍
        const buttonContainerTransform = buttonContainer.addComponent(UITransform);
        buttonContainerTransform.setContentSize(canvasWidth, tabAreaHeight);
        // 设置锚点为底部中心
        buttonContainerTransform.setAnchorPoint(0.5, 0);
        
        // 计算按钮容器位置：
        // 底部选区容器(bottomSelectionNode)的高度为canvasHeight，锚点为(0.5, 0.5)，位于屏幕中心
        // 所以底部选区容器的底部边缘在Y坐标：-canvasHeight/2
        // 按钮容器的锚点为(0.5, 0)，所以它的底部边缘在自身Y坐标0处
        // 因此，按钮容器的Y坐标应该设置为：-canvasHeight/2 + tabAreaHeight/2
        // 这样按钮容器的底部边缘就与底部选区容器的底部边缘对齐了
        const buttonContainerY = -canvasHeight / 2 + tabAreaHeight / 2 - 30;
        buttonContainer.setPosition(0, buttonContainerY, 0);
        
        // 确保容器可见
        buttonContainer.active = true;
        
        // 设置按钮容器层级，确保它位于所有面板之上，但在需要时可以被覆盖
        buttonContainer.setSiblingIndex(bottomSelectionNode.children.length - 1);
        
        // 重新确保游戏主体面板位于最高层级，确保开始游戏按钮可点击
        gameMainPanel.setSiblingIndex(bottomSelectionNode.children.length - 1);
        
        // 添加按钮容器背景 - 透明，让面板背景显示出来
        const buttonContainerBackground = buttonContainer.addComponent(Graphics);
        // 使用透明背景，让下方的面板背景显示出来
        buttonContainerBackground.fillColor = new Color(0, 0, 0, 0); // 完全透明
        buttonContainerBackground.rect(-canvasWidth / 2, 0, canvasWidth, tabAreaHeight);
        buttonContainerBackground.fill();
        
        // 移除边框，避免出现不必要的横线
        // 注释掉边框绘制代码
        // buttonContainerBackground.lineWidth = 2;
        // buttonContainerBackground.strokeColor = new Color(100, 150, 255, 255);
        // buttonContainerBackground.rect(-canvasWidth / 2, 0, canvasWidth, tabAreaHeight);
        // buttonContainerBackground.stroke();
        
        // 创建三个标签页按钮
        this.createSelectionButton(buttonContainer, '游戏', -250);
        this.createSelectionButton(buttonContainer, '天赋', 0);
        this.createSelectionButton(buttonContainer, '设置', 250);

        // 记录页面和容器引用，供后续切换使用
        this.bottomSelectionNodeRef = bottomSelectionNode;
        this.gameMainPanel = gameMainPanel;
        this.talentPanelNode = talentPanel;
        this.settingsPanelNode = settingsPanel;
        this.startGameButtonNode = startButton;

        // 复用全局背景图（不随页面切换隐藏）
        if (!this.backgroundNode) {
            this.backgroundNode = find('Canvas/Background');
        }

        // 注意：首页主菜单背景音乐的自动播放逻辑统一放在 UIManager.start() 中处理，
        // 这里不再重复播放，避免退出游戏返回首页时出现意外的BGM开启。
        
        // 绑定开始游戏事件
        startButtonComp.node.on(Button.EventType.CLICK, () => {
           //console.info('[UIManager] Start button clicked, preparing to start game');
            
            // 1. 直接隐藏底部三页签，不依赖GameManager
            bottomSelectionNode.active = false;
            
            // 1.1 隐藏签到按钮（签到宝箱），逻辑同“上一关/下一关按钮”：只在首页关卡选择界面显示，进入战斗时隐藏
            if (this.checkInButton && this.checkInButton.node && this.checkInButton.node.isValid) {
                this.checkInButton.node.active = false;
            }
            
            // 2. 强制显示水晶节点，不依赖GameManager
            const crystal = find('Canvas/Crystal');
            if (crystal) {
                
                // 确保水晶节点及其所有父节点都处于激活状态
                let current = crystal;
                while (current) {
                    if (!current.active) {
                        current.active = true;
                    }
                    current = current.parent;
                }
                
                // 直接设置水晶节点为激活状态
                crystal.active = true;
            } else {
            }
            
            // 3. 设置当前关卡到EnemySpawner
            const enemySpawner = this.findComponentInScene('EnemySpawner') as any;
            if (enemySpawner && enemySpawner.setLevel) {
                enemySpawner.setLevel(this.currentLevel);
            }
            
            // 4. 调用GameManager的startGame方法（递归查找以防节点命名/层级变化）
            const gmComp = this.findComponentInScene('GameManager') as any;
            if (gmComp && gmComp.startGame) {
               //console.info('[UIManager] GameManager found, calling startGame()');
                gmComp.startGame();
            } else {
                console.warn('[UIManager] GameManager not found or has no startGame()');
            }
        }, this);
        
    }
    
    /**
     * 为按钮加载贴图并设置Sprite组件
     * @param buttonNode 按钮节点
     * @param normalPath 正常状态的贴图路径（相对于textures/icon）
     * @param pressedPath 按下状态的贴图路径（相对于textures/icon）
     */
    private setupButtonSprite(buttonNode: Node, normalPath: string, pressedPath: string) {
        // 保存当前的 UITransform 尺寸
        const uiTransform = buttonNode.getComponent(UITransform);
        const originalWidth = uiTransform ? uiTransform.width : 200;
        const originalHeight = uiTransform ? uiTransform.height : 80;
        
        // 移除现有的Graphics组件（如果存在）
        const graphics = buttonNode.getComponent(Graphics);
        if (graphics) {
            graphics.destroy();
        }
        
        // 移除现有的Label组件（如果存在，因为按钮现在使用贴图）
        const label = buttonNode.getComponent(Label);
        if (label) {
            label.destroy();
        }
        
        // 添加Sprite组件（必须在Button之前添加）
        let sprite = buttonNode.getComponent(Sprite);
        if (!sprite) {
            sprite = buttonNode.addComponent(Sprite);
        }
        
        // 设置 Sprite 的 sizeMode 为 CUSTOM，防止自动调整节点尺寸
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        
        // 获取或添加Button组件，并设置过渡模式
        let button = buttonNode.getComponent(Button);
        if (!button) {
            button = buttonNode.addComponent(Button);
        }
        button.transition = Button.Transition.SPRITE;
        // 设置target为按钮节点本身（包含Sprite组件的节点）
        button.target = buttonNode;
        
        // 加载正常状态贴图（移除文件扩展名，并添加 /spriteFrame 后缀）
        const normalPathWithoutExt = normalPath.replace(/\.(png|jpg|jpeg)$/i, '');
        const normalResourcePath = `textures/icon/${normalPathWithoutExt}/spriteFrame`;
        
        resources.load(normalResourcePath, SpriteFrame, (err, spriteFrame) => {
            if (err) {
                console.error(`Failed to load button sprite: ${normalPath} (path: ${normalResourcePath})`, err);
                return;
            }
            if (sprite && sprite.node && sprite.node.isValid && button && button.node && button.node.isValid) {
                sprite.spriteFrame = spriteFrame;
                // 设置Button的normalSprite
                button.normalSprite = spriteFrame;
                
                // 恢复原始尺寸
                const transform = buttonNode.getComponent(UITransform);
                if (transform) {
                    transform.setContentSize(originalWidth, originalHeight);
                }
            }
        });
        
        // 加载按下状态贴图（移除文件扩展名，并添加 /spriteFrame 后缀）
        const pressedPathWithoutExt = pressedPath.replace(/\.(png|jpg|jpeg)$/i, '');
        const pressedResourcePath = `textures/icon/${pressedPathWithoutExt}/spriteFrame`;
        
        resources.load(pressedResourcePath, SpriteFrame, (err, pressedSpriteFrame) => {
            if (err) {
                console.error(`Failed to load button pressed sprite: ${pressedPath} (path: ${pressedResourcePath})`, err);
                return;
            }
            if (button && button.node && button.node.isValid && pressedSpriteFrame) {
                // 设置Button的pressedSprite
                button.pressedSprite = pressedSpriteFrame;
            }
        });
    }
    
    /**
     * 创建选区按钮
     */
    createSelectionButton(parent: Node, text: string, xPos: number) {
        // 创建按钮节点
        const buttonNode = new Node(text + 'Button');
        buttonNode.setParent(parent);
        buttonNode.setPosition(xPos, 0, 0);
        
        // 确保按钮可见
        buttonNode.active = true;
        
        // 添加UITransform - 增大按钮尺寸，适应新的三页签区高度
        const uiTransform = buttonNode.addComponent(UITransform);
        uiTransform.setContentSize(250, 120); // 增大按钮尺寸50%，从200x80变为300x120
        uiTransform.setAnchorPoint(0.5, 0.5);
        
        // 根据按钮文本映射到对应的贴图文件名
        let normalImageName = '';
        if (text === '游戏') {
            normalImageName = 'game.png';
        } else if (text === '天赋') {
            normalImageName = 'tale.png';
        } else if (text === '设置') {
            normalImageName = 'set.png';
        } else {
            console.warn(`Unknown button text: ${text}, using default`);
            normalImageName = 'game.png';
        }
        
        const pressedImageName = normalImageName.replace(/\.(png|jpg|jpeg)$/i, '_down.$1');
        
        // 先添加Button组件（setupButtonSprite 需要Button组件存在）
        const button = buttonNode.addComponent(Button);
        
        // 使用贴图设置按钮
        this.setupButtonSprite(buttonNode, normalImageName, pressedImageName);
        
        // 绑定点击事件
        button.node.on(Button.EventType.CLICK, () => {
            if (text === '游戏') {
                this.setActivePage('game');
            } else if (text === '天赋') {
                this.setActivePage('talent');
            } else if (text === '设置') {
                this.setActivePage('settings');
            }
        }, this);
        
        return buttonNode;
    }

    /**
     * 缓存常用节点引用（只在需要时查找一次）
     */
    private cacheCommonNodes() {
        if (!this.backgroundNode) {
            this.backgroundNode = find('Canvas/Background');
        }

        if (!this.buildingGridPanelNode) {
            this.buildingGridPanelNode =
                find('Canvas/BuildingGridPanel') ||
                find('BuildingGridPanel');
        }

        if (!this.stoneWallGridPanelNode) {
            this.stoneWallGridPanelNode =
                find('Canvas/StoneWallGridPanel') ||
                find('StoneWallGridPanel');
        }

        // 退出游戏按钮（尝试按常用路径查找）
        if (!this.backToHomeButtonNode || !this.backToHomeButtonNode.isValid) {
            this.backToHomeButtonNode =
                // 优先按你提供的实际节点名 ReturnButton 查找
                find('Canvas/UI/ReturnButton') ||
                find('Canvas/ReturnButton') ||
                find('UI/ReturnButton') ||
                // 兼容旧命名 BackToHomeButton
                find('Canvas/UI/BackToHomeButton') ||
                find('Canvas/BackToHomeButton') ||
                find('UI/BackToHomeButton') ||
                find('BackToHomeButton') ||
                this.backToHomeButtonNode;
        }

        if (this.gameManager) {
            if (!this.timerLabelNode && (this.gameManager as any).timerLabel) {
                this.timerLabelNode = (this.gameManager as any).timerLabel.node;
            }
            if (!this.goldLabelNode && this.gameManager.goldLabel) {
                this.goldLabelNode = this.gameManager.goldLabel.node;
            }
            if (!this.populationLabelNode && this.gameManager.populationLabel) {
                this.populationLabelNode = this.gameManager.populationLabel.node;
            }
            if (!this.healthLabelNode && this.gameManager.healthLabel) {
                this.healthLabelNode = this.gameManager.healthLabel.node;
            }
        }
    }

    /**
     * 切换首页当前激活页面
     */
    private setActivePage(page: 'game' | 'talent' | 'settings') {
        // 切换到game页面时，更新下一关按钮状态
        if (page === 'game') {
            this.scheduleOnce(() => {
                this.updateNextLevelButtonState();
            }, 0.1);
        }
        this.activePage = page;

        // 如果底部三页签还未创建，尝试查找
        if (!this.bottomSelectionNodeRef) {
            this.bottomSelectionNodeRef = find('Canvas/BottomSelection');
        }
        if (this.bottomSelectionNodeRef && !this.gameMainPanel) {
            this.gameMainPanel = this.bottomSelectionNodeRef.getChildByName('GameMainPanel');
            this.talentPanelNode = this.bottomSelectionNodeRef.getChildByName('TalentPanel');
            this.settingsPanelNode = this.bottomSelectionNodeRef.getChildByName('SettingsPanel');
        }

        this.cacheCommonNodes();

        const isGame = page === 'game';
        const isTalent = page === 'talent';
        const isSettings = page === 'settings';

        // 切到天赋或设置页时，关闭首页的杀敌排行榜卷轴
        if (!isGame && this.gameManager && (this.gameManager as any).hideKillRankPanelExternally) {
            (this.gameManager as any).hideKillRankPanelExternally();
        }

        // 保持通用背景始终可见
        if (this.backgroundNode) {
            this.backgroundNode.active = true;
        }

        // 切换三个主面板
        if (this.gameMainPanel) {
            this.gameMainPanel.active = isGame;
            if (isGame && this.bottomSelectionNodeRef) {
                this.gameMainPanel.setSiblingIndex(this.bottomSelectionNodeRef.children.length - 2);
            }
        }
        if (this.talentPanelNode) {
            this.talentPanelNode.active = isTalent;
            if (isTalent && this.bottomSelectionNodeRef) {
                this.talentPanelNode.setSiblingIndex(this.bottomSelectionNodeRef.children.length - 2);
            }
            // 当切到“天赋”页时，主动刷新单位卡片的等级显示，避免返回后显示未更新
            if (isTalent) {
                this.scheduleOnce(() => {
                    try {
                        // 优先通过已知路径获取 TalentSystem
                        const tsNode = find('Canvas/BottomSelection/TalentPanel');
                        const ts = tsNode ? (tsNode.getComponent('TalentSystem') as any) : null;
                        // 回退到全场景查找
                        const talentSystem = ts || (this.node?.scene?.getComponentInChildren('TalentSystem') as any);
                        if (talentSystem && typeof talentSystem.refreshUnitCardsLevels === 'function') {
                            talentSystem.refreshUnitCardsLevels();
                        }
                    } catch {}
                }, 0);
            }
        }
        if (this.settingsPanelNode) {
            this.settingsPanelNode.active = isSettings;
            if (isSettings && this.bottomSelectionNodeRef) {
                this.settingsPanelNode.setSiblingIndex(this.bottomSelectionNodeRef.children.length - 2);
            }
        }

        // 游戏页面专属 UI（开始游戏按钮）
        if (this.startGameButtonNode && this.startGameButtonNode.isValid) {
            this.startGameButtonNode.active = isGame;
        }

        // 签到按钮只在游戏首页显示
        if (this.checkInButton && this.checkInButton.node && this.checkInButton.node.isValid) {
            this.checkInButton.node.active = isGame;
            console.log('[UIManager] setActivePage() 签到按钮显示状态:', isGame);
        }

        // 首页（game面板）显示时，刷新首页头像/等级/体力 HUD（与上一关/下一关按钮同属 gameMainPanel）
        if (isGame) {
            this.findGameManager();
            const gm = this.gameManager as any;
            if (gm && gm.refreshHomeLevelHud) {
                // 延迟一帧，确保 gameMainPanel 的 active 和层级已生效
                this.scheduleOnce(() => {
                    gm.refreshHomeLevelHud();
                }, 0);
            }
        }

        // 游戏 HUD：金币 / 人口 / 时间标签
        if (this.gameManager) {
            if (!this.timerLabelNode && (this.gameManager as any).timerLabel) {
                this.timerLabelNode = (this.gameManager as any).timerLabel.node;
            }
            if (!this.goldLabelNode && this.gameManager.goldLabel) {
                this.goldLabelNode = this.gameManager.goldLabel.node;
            }
            if (!this.populationLabelNode && this.gameManager.populationLabel) {
                this.populationLabelNode = this.gameManager.populationLabel.node;
            }
        }

        if (this.timerLabelNode) {
            this.timerLabelNode.active = isGame;
        }
        if (this.goldLabelNode) {
            this.goldLabelNode.active = isGame;
        }
        if (this.populationLabelNode) {
            this.populationLabelNode.active = isGame;
        }
        if (this.healthLabelNode) {
            this.healthLabelNode.active = isGame;
        }

        // 建造相关：建造按钮、建筑物网格、退出/重开按钮
        if (this.buildButton) {
            this.buildButton.node.active = isGame;
        }
        if (this.restartButton) {
            this.restartButton.node.active = isGame;
        }
        if (this.buildingGridPanelNode && this.buildingGridPanelNode.isValid) {
            this.buildingGridPanelNode.active = isGame;
        }
        if (this.stoneWallGridPanelNode && this.stoneWallGridPanelNode.isValid) {
            this.stoneWallGridPanelNode.active = isGame;
        }
        if (this.backToHomeButtonNode && this.backToHomeButtonNode.isValid) {
            this.backToHomeButtonNode.active = isGame;
        }
    }
    
    /**
     * 自动创建CountdownPopup
     */
    private autoCreateCountdownPopup() {
        // 如果countdownPopup已经存在，不需要创建
        if (this.countdownPopup) {
            return;
        }
        
        
        // 获取Canvas或屏幕尺寸
        const canvas = find('Canvas');
        let canvasWidth = 960;
        let canvasHeight = 640;
        
        if (canvas) {
            const canvasTransform = canvas.getComponent(UITransform);
            if (canvasTransform) {
                canvasWidth = canvasTransform.width;
                canvasHeight = canvasTransform.height;
            }
        }
        
        // 创建CountdownPopup节点
        const popupNode = new Node('CountdownPopup');
        popupNode.setParent(this.node);
        
        // 计算右上角位置：与最右保持50像素，与最上保持100像素（往上移100像素）
        const popupSize = 37.5; // 弹窗大小，缩小为原来的二分之一（37.5x37.5）
        const rightMargin = 50;
        const topMargin = 100; // 原来的200像素，往上移100像素
        
        // 计算位置：屏幕原点在中心，所以右上角坐标是 (canvasWidth/2 - margin - popupSize/2, canvasHeight/2 - margin - popupSize/2)
        const posX = (canvasWidth / 2) - rightMargin - (popupSize / 2);
        const posY = (canvasHeight / 2) - topMargin - (popupSize / 2);
        
        popupNode.setPosition(posX, posY, 0); // 右上角位置
        
        // 添加CountdownPopup组件
        this.countdownPopup = popupNode.addComponent(CountdownPopup);
        
        // 手动设置弹窗大小，确保是75x75
        let uiTransform = popupNode.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = popupNode.addComponent(UITransform);
        }
        uiTransform.setContentSize(popupSize, popupSize);
        
    }

    createEffects() {
        // 创建红边警告特效节点
        if (!this.warningNode) {
            this.warningNode = new Node('WarningEffect');
            const canvas = find('Canvas');
            if (canvas) {
                this.warningNode.setParent(canvas);
                this.warningNode.setSiblingIndex(0); 

                // 读取画布实际尺寸
                const canvasTransform = canvas.getComponent(UITransform);
                let width = 960;
                let height = 640;
                if (canvasTransform) {
                    width = canvasTransform.width;
                    height = canvasTransform.height;
                }

                const uiTransform = this.warningNode.addComponent(UITransform);
                uiTransform.setContentSize(width, height); // 和画布同大

                const graphics = this.warningNode.addComponent(Graphics);
                graphics.lineWidth = 20;
                graphics.strokeColor = new Color(255, 0, 0, 255); // 不透明红色

                // 在画布四边画一圈矩形边框（紧贴画布边缘）
                graphics.rect(-width / 2, -height / 2, width, height);
                graphics.stroke();

                this.warningNode.addComponent(UIOpacity).opacity = 0;
            }
        }

        // 创建公告提示节点
        if (!this.announcementNode) {
            this.announcementNode = new Node('Announcement');
            const canvas = find('Canvas');
            if (canvas) {
                this.announcementNode.setParent(canvas);
                this.announcementNode.setPosition(0, 100, 0); // 屏幕上方
                
                const label = this.announcementNode.addComponent(Label);
                label.string = "";
                label.fontSize = 40;
                label.color = Color.RED;
                label.isBold = true;
                // 黑色描边（边框）
                const outline = this.announcementNode.addComponent(LabelOutline);
                outline.width = 2;
                (label as any).outlineColor = new Color(0, 0, 0, 255);
                
                this.announcementNode.active = false;
            }
        }
    }

    /**
     * 显示红边警告特效
     */
    showWarningEffect() {
        if (!this.warningNode) return;
        
        const opacityComp = this.warningNode.getComponent(UIOpacity);
        if (!opacityComp) return;
        
        this.warningNode.active = true;
        opacityComp.opacity = 0;
        
        // 闪烁动画
        tween(opacityComp)
            .to(0.2, { opacity: 150 })
            .to(0.2, { opacity: 0 })
            .to(0.2, { opacity: 150 })
            .to(0.2, { opacity: 0 })
            .to(0.2, { opacity: 150 })
            .to(0.5, { opacity: 0 })
            .call(() => {
                // this.warningNode.active = false; // 保持节点存在，只是不可见
            })
            .start();
            
        // 如果Graphics不支持设置透明度，我们可以用Sprite创建红色图片，这里假设Graphics可以
    }

    /**
     * 显示屏幕中间公告
     * @param message 公告内容
     */
    showAnnouncement(message: string) {
        if (!this.announcementNode) return;
        
        const label = this.announcementNode.getComponent(Label);
        if (label) {
            label.string = message;
            // 兜底：确保描边存在并为黑色
            let outline = this.announcementNode.getComponent(LabelOutline);
            if (!outline) {
                outline = this.announcementNode.addComponent(LabelOutline);
            }
            outline.width = Math.max(2, outline.width || 0);
            (label as any).outlineColor = new Color(0, 0, 0, 255);
        }
        
        this.announcementNode.active = true;
        this.announcementNode.setScale(0, 0, 1);
        const uiOpacity = this.announcementNode.getComponent(UIOpacity) || this.announcementNode.addComponent(UIOpacity);
        uiOpacity.opacity = 255;
        
        // 弹跳出现的动画
        tween(this.announcementNode)
            .to(0.5, { scale: new Vec3(1.2, 1.2, 1) }, { easing: 'backOut' })
            .to(0.2, { scale: new Vec3(1, 1, 1) })
            .delay(1.5)
            .to(0.3, { scale: new Vec3(0, 0, 1) }) // 或者淡出
            .call(() => {
                this.announcementNode.active = false;
            })
            .start();
    }

    findGameManager() {
        // 方法1: 通过节点名称查找
        let gmNode = find('GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManagerClass);
            if (this.gameManager) {
                return;
            }
        }
        
        // 方法2: 从场景根节点递归查找
        const scene = director.getScene();
        if (scene) {
            const findInScene = (node: Node, componentType: any): any => {
                const comp = node.getComponent(componentType);
                if (comp) return comp;
                for (const child of node.children) {
                    const found = findInScene(child, componentType);
                    if (found) return found;
                }
                return null;
            };
            this.gameManager = findInScene(scene, GameManagerClass);
            if (this.gameManager) {
                return;
            }
        }
        
    }

    onBuildButtonClick() {
        if (this.towerBuilder) {
            const builderScript = this.towerBuilder.getComponent('TowerBuilder') as any;
            if (builderScript) {
                if (builderScript.onBuildButtonClick) {
                    builderScript.onBuildButtonClick();
                }
            }
        }
    }

    /**
     * 新手教程：建造按钮高亮闪烁更长时间（约 10 秒，高亮->还原循环），提示玩家点击建造
     * 进入第一关时调用
     */
    highlightBuildButtonForTutorial() {
        const btnNode = this.buildButton?.node || find('Canvas/UI/BuildButton');
        if (!btnNode || !btnNode.isValid) return;
        if (!btnNode.active) btnNode.active = true;

        tween(btnNode).stop();
        const sprite = btnNode.getComponent(Sprite);
        const origScale = btnNode.scale.clone();
        const origColor = sprite ? sprite.color.clone() : new Color(255, 255, 255, 255);
        const s = origScale.x;
        const highlightColor = new Color(255, 255, 0, 255);

        const setHighlight = () => {
            if (btnNode.isValid) {
                btnNode.setScale(s * 1.2, s * 1.2, 1);
                if (sprite && sprite.isValid) sprite.color = highlightColor;
            }
        };
        const setRestore = () => {
            if (btnNode.isValid) {
                btnNode.setScale(s, s, 1);
                if (sprite && sprite.isValid) sprite.color = origColor;
            }
        };

        // 高亮 0.5s -> 还原 0.5s，循环 10 次，共约 10 秒
        const blink = () => {
            setHighlight();
            this.scheduleOnce(() => {
                if (!btnNode.isValid) return;
                setRestore();
            }, 0.5);
        };
        for (let i = 0; i < 10; i++) {
            this.scheduleOnce(() => blink(), i * 1.0);
        }
        this.scheduleOnce(() => {
            if (!btnNode.isValid) return;
            setRestore();
        }, 10.0);
    }

    onRestartButtonClick() {
        
        // 重新查找GameManager
        this.findGameManager();
        
        if (this.gameManager) {
            // 先结算经验值
            this.gameManager.settleGameExperience();
            
            // 清理所有单位（包括敌人、我方单位和建筑物）
            this.gameManager.cleanupAllUnitsForReset();
            
            // 清除上一关的所有卡片增幅
            const buffManager = BuffManager.getInstance();
            buffManager.clearAllBuffs();
            console.log('[UIManager] 重新开始游戏，已清除所有卡片增幅');
            
            // 关闭结算弹窗
            if (this.gameManager.gameOverPanel) {
                this.gameManager.gameOverPanel.active = false;
            }
            // 关闭游戏结束弹窗
            const gm = this.gameManager as any;
            if (gm.gameOverDialog) {
                gm.gameOverDialog.active = false;
            }
            // 隐藏游戏结束的全屏遮罩，恢复点击
            if (gm.gameOverMask) {
                const maskNode = gm.gameOverMask as Node;
                if (maskNode && maskNode.isValid) {
                    maskNode.active = false;
                }
            }
            
            // 回到主界面（隐藏游戏相关UI，显示底部三页签）
            let bottomSelectionNode = find('Canvas/BottomSelection');
            if (!bottomSelectionNode) {
                this.createBottomSelectionUI();
                bottomSelectionNode = find('Canvas/BottomSelection');
            }
            
            if (bottomSelectionNode) {
                bottomSelectionNode.active = true;
                
                // 确保切换到游戏主体面板
                const gamePanel = bottomSelectionNode.getChildByName('GameMainPanel');
                const talentPanel = bottomSelectionNode.getChildByName('TalentPanel');
                const settingsPanel = bottomSelectionNode.getChildByName('SettingsPanel');
                
                if (gamePanel) {
                    gamePanel.active = true;
                    gamePanel.setSiblingIndex(bottomSelectionNode.children.length - 2);
                }
                if (talentPanel) {
                    talentPanel.active = false;
                }
                if (settingsPanel) {
                    settingsPanel.active = false;
                }
            }
            
            // 重新开始时，重置 TowerBuilder 的初始生成标记，允许再次生成14石墙和3哨塔
            const towerBuilderComp = this.findComponentInScene('TowerBuilder') as any;
            if (towerBuilderComp && towerBuilderComp.resetForRestart) {
                towerBuilderComp.resetForRestart();
            }

            // 重置 GameManager 的局内状态（金币 / 时间 / 水晶血量与等级等）
            const gmAny = this.gameManager as any;
            if (gmAny.resetGameStateForRestart) {
                gmAny.resetGameStateForRestart();
            }

            // 重置敌人波次系统（在重置GameManager之后立即重置）
            const enemySpawner = this.findComponentInScene('EnemySpawner') as any;
            if (enemySpawner) {
                // 先设置关卡，再重置
                if (enemySpawner.setLevel) {
                    enemySpawner.setLevel(this.currentLevel);
                }
                if (enemySpawner.reset) {
                    enemySpawner.reset();
                }
            }

            // 隐藏所有游戏元素
            const gameNodes = [
                'Canvas/Crystal',
                'Enemies',
                'Towers',
                'WarAncientTrees'
            ];
            
            for (const nodePath of gameNodes) {
                const node = find(nodePath);
                if (node) {
                    node.active = false;
                }
            }
            
            // 延迟一小段时间后自动开始游戏
            this.scheduleOnce(() => {
                // 直接执行开始游戏的逻辑
                // 1. 确保游戏状态为Ready
                if (this.gameManager) {
                    const gm = this.gameManager as any;
                    if (gm.gameState !== undefined) {
                        // GameState.Ready = 0
                        gm.gameState = 0;
                    }
                    
                    // 确保金币、时间等已正确重置（resetGameStateForRestart已经设置过）
                    // 这里再次确认，防止被其他代码覆盖
                    if (gm.gold !== undefined && gm.gold !== 20) {
                        console.warn(`[UIManager] 金币未正确重置为20，当前值: ${gm.gold}，强制重置`);
                        gm.gold = 20;
                    }
                    
                    if (gm.gameTime !== undefined && gm.gameTime !== 0) {
                        console.warn(`[UIManager] 游戏时间未正确重置为0，当前值: ${gm.gameTime}，强制重置`);
                        gm.gameTime = 0;
                    }
                    
                    // 更新UI，确保显示正确的初始值
                    if (gm.updateUI) {
                        gm.updateUI();
                    }
                }
                
                // 2. 隐藏底部三页签
                if (bottomSelectionNode) {
                    bottomSelectionNode.active = false;
                }
                
                // 3. 强制显示水晶节点
                const crystal = find('Canvas/Crystal');
                if (crystal) {
                    // 确保水晶节点及其所有父节点都处于激活状态
                    let current = crystal;
                    while (current) {
                        if (!current.active) {
                            current.active = true;
                        }
                        current = current.parent;
                    }
                    // 直接设置水晶节点为激活状态
                    crystal.active = true;
                }
                
                // 4. 再次确认EnemySpawner已设置正确的关卡
                const enemySpawner = this.findComponentInScene('EnemySpawner') as any;
                if (enemySpawner && enemySpawner.setLevel) {
                    enemySpawner.setLevel(this.currentLevel);
                }
                
                // 5. 调用GameManager的startGame方法
                if (this.gameManager && this.gameManager.startGame) {
                    this.gameManager.startGame();
                } else {
                    // 如果找不到，尝试递归查找
                    const gmComp = this.findComponentInScene('GameManager') as any;
                    if (gmComp && gmComp.startGame) {
                        gmComp.startGame();
                    }
                }
            }, 0.1); // 延迟0.1秒，确保UI切换完成
        } else {
            // 如果还是找不到，尝试直接重新加载场景
            const scene = director.getScene();
            if (scene && scene.name) {
                director.loadScene(scene.name);
            } else {
                // 如果场景名称为空，尝试使用默认场景名称
                director.loadScene('scene');
            }
        }
    }

    /**
     * 显示倒计时弹窗
     * @param onComplete 倒计时完成回调
     * @param onManualClose 手动关闭回调
     */
    showCountdownPopup(onComplete: () => void, onManualClose: () => void, durationSeconds: number = 60, skipInitialDelay: boolean = false) {
       //console.info(`[UIManager] showCountdownPopup() 被调用`);
        this.onCountdownComplete = onComplete;
        this.onCountdownManualClose = onManualClose;
        
        // 确保CountdownPopup存在
        this.autoCreateCountdownPopup();
       //console.info(`[UIManager] showCountdownPopup() countdownPopup存在=${!!this.countdownPopup}`);
        
        if (this.countdownPopup) {
           //console.info(`[UIManager] showCountdownPopup() 调用 countdownPopup.show()`);
            this.countdownPopup.show(this.onCountdownCompleteHandler.bind(this), this.onCountdownManualCloseHandler.bind(this), durationSeconds, skipInitialDelay);
        } else {
            console.error(`[UIManager] showCountdownPopup() 创建失败，直接调用onComplete`);
            // 如果创建失败，直接调用onComplete
            onComplete();
        }
    }

    /**
     * 隐藏倒计时弹窗
     */
    hideCountdownPopup() {
        
        if (this.countdownPopup) {
            this.countdownPopup.hide();
        }
    }

    /**
     * 倒计时完成回调处理
     */
    private onCountdownCompleteHandler() {
        
        if (this.onCountdownComplete) {
            this.onCountdownComplete();
        }
        
        this.onCountdownComplete = null;
        this.onCountdownManualClose = null;
    }

    /**
     * 手动关闭倒计时弹窗回调处理
     */
    private onCountdownManualCloseHandler() {
        
        if (this.onCountdownManualClose) {
            this.onCountdownManualClose();
        }
        
        this.onCountdownComplete = null;
        this.onCountdownManualClose = null;
    }
    
    /**
     * 创建确认对话框
     */
    private createConfirmDialog(message: string, onConfirm: () => void, onCancel: () => void) {
        // 如果已存在确认框，先销毁
        if (this.confirmDialogNode && this.confirmDialogNode.isValid) {
            this.confirmDialogNode.destroy();
        }
        
        // 获取Canvas节点
        const canvas = find('Canvas');
        if (!canvas) {
            return;
        }
        
        // 创建确认框容器
        this.confirmDialogNode = new Node('ConfirmDialog');
        this.confirmDialogNode.setParent(canvas);
        
        // 确保确认框节点处于激活状态
        this.confirmDialogNode.active = true;
        
        // 设置确认框层级为最高
        this.confirmDialogNode.setSiblingIndex(canvas.children.length - 1);
        
        // 添加UITransform
        const uiTransform = this.confirmDialogNode.addComponent(UITransform);
        uiTransform.setContentSize(400, 200);
        uiTransform.setAnchorPoint(0.5, 0.5);
        
        // 居中显示
        this.confirmDialogNode.setPosition(0, 0, 0);
        
        // 添加半透明背景遮罩
        const maskNode = new Node('Mask');
        maskNode.setParent(this.confirmDialogNode);
        maskNode.setPosition(0, 0, -1);
        const maskTransform = maskNode.addComponent(UITransform);
        maskTransform.setContentSize(canvas.getComponent(UITransform)?.width || 960, canvas.getComponent(UITransform)?.height || 640);
        maskTransform.setAnchorPoint(0.5, 0.5);
        const maskGraphics = maskNode.addComponent(Graphics);
        maskGraphics.fillColor = new Color(0, 0, 0, 150);
        maskGraphics.rect(-maskTransform.width/2, -maskTransform.height/2, maskTransform.width, maskTransform.height);
        maskGraphics.fill();
        
        // 添加确认框背景
        const background = this.confirmDialogNode.addComponent(Graphics);
        background.fillColor = new Color(40, 40, 60, 255);
        background.roundRect(-200, -100, 400, 200, 10);
        background.fill();
        background.lineWidth = 2;
        background.strokeColor = new Color(100, 150, 255, 255);
        background.roundRect(-200, -100, 400, 200, 10);
        background.stroke();
        
        // 添加标题
        const titleNode = new Node('Title');
        titleNode.setParent(this.confirmDialogNode);
        titleNode.setPosition(0, 50, 0);
        titleNode.active = true;
        
        const titleLabel = titleNode.addComponent(Label);
        titleLabel.string = '确认退出游戏';
        titleLabel.fontSize = 24;
        titleLabel.color = new Color(255, 255, 255, 255);
        titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLabel.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 添加消息文本
        const messageNode = new Node('Message');
        messageNode.setParent(this.confirmDialogNode);
        messageNode.setPosition(0, 0, 0);
        messageNode.active = true;
        
        const messageLabel = messageNode.addComponent(Label);
        messageLabel.string = message;
        messageLabel.fontSize = 18;
        messageLabel.color = new Color(200, 200, 200, 255);
        messageLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        messageLabel.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 创建按钮容器
        const buttonContainer = new Node('ButtonContainer');
        buttonContainer.setParent(this.confirmDialogNode);
        buttonContainer.setPosition(0, -50, 0);
        buttonContainer.active = true;
        
        // 创建确认按钮
        const confirmButton = new Node('ConfirmButton');
        confirmButton.setParent(buttonContainer);
        confirmButton.setPosition(-80, 0, 0);
        confirmButton.active = true;
        
        // 添加Button组件
        const confirmButtonComp = confirmButton.addComponent(Button);
        
        // 添加UITransform
        const confirmButtonTransform = confirmButton.addComponent(UITransform);
        confirmButtonTransform.setContentSize(120, 50);
        confirmButtonTransform.setAnchorPoint(0.5, 0.5);
        
        // 按钮背景
        const confirmBg = confirmButton.addComponent(Graphics);
        confirmBg.fillColor = new Color(60, 150, 60, 255);
        confirmBg.roundRect(-60, -25, 120, 50, 8);
        confirmBg.fill();
        confirmBg.lineWidth = 2;
        confirmBg.strokeColor = new Color(100, 200, 100, 255);
        confirmBg.roundRect(-60, -25, 120, 50, 8);
        confirmBg.stroke();
        
        // 创建单独的文本节点作为按钮的子节点
        const confirmTextNode = new Node('ConfirmButtonText');
        confirmTextNode.setParent(confirmButton);
        confirmTextNode.active = true;
        
        // 居中显示在按钮上
        confirmTextNode.setPosition(0, 0, 1);
        
        // 添加Label组件
        const confirmButtonLabel = confirmTextNode.addComponent(Label);
        confirmButtonLabel.string = '确认';
        confirmButtonLabel.fontSize = 20;
        confirmButtonLabel.color = new Color(255, 255, 255, 255);
        confirmButtonLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        confirmButtonLabel.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 设置Label的尺寸
        const confirmLabelTransform = confirmTextNode.addComponent(UITransform);
        confirmLabelTransform.setContentSize(120, 50);
        confirmLabelTransform.setAnchorPoint(0.5, 0.5);
        
        confirmButtonComp.node.on(Button.EventType.CLICK, () => {
            onConfirm();
            // 销毁确认框
            if (this.confirmDialogNode && this.confirmDialogNode.isValid) {
                this.confirmDialogNode.destroy();
                this.confirmDialogNode = null;
            }
        }, this);
        
        // 创建取消按钮
        const cancelButton = new Node('CancelButton');
        cancelButton.setParent(buttonContainer);
        cancelButton.setPosition(80, 0, 0);
        cancelButton.active = true;
        
        // 添加Button组件
        const cancelButtonComp = cancelButton.addComponent(Button);
        
        // 添加UITransform
        const cancelButtonTransform = cancelButton.addComponent(UITransform);
        cancelButtonTransform.setContentSize(120, 50);
        cancelButtonTransform.setAnchorPoint(0.5, 0.5);
        
        // 按钮背景
        const cancelBg = cancelButton.addComponent(Graphics);
        cancelBg.fillColor = new Color(150, 60, 60, 255);
        cancelBg.roundRect(-60, -25, 120, 50, 8);
        cancelBg.fill();
        cancelBg.lineWidth = 2;
        cancelBg.strokeColor = new Color(200, 100, 100, 255);
        cancelBg.roundRect(-60, -25, 120, 50, 8);
        cancelBg.stroke();
        
        // 创建单独的文本节点作为按钮的子节点
        const cancelTextNode = new Node('CancelButtonText');
        cancelTextNode.setParent(cancelButton);
        cancelTextNode.active = true;
        
        // 居中显示在按钮上
        cancelTextNode.setPosition(0, 0, 1);
        
        // 添加Label组件
        const cancelButtonLabel = cancelTextNode.addComponent(Label);
        cancelButtonLabel.string = '取消';
        cancelButtonLabel.fontSize = 20;
        cancelButtonLabel.color = new Color(255, 255, 255, 255);
        cancelButtonLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        cancelButtonLabel.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 设置Label的尺寸
        const cancelLabelTransform = cancelTextNode.addComponent(UITransform);
        cancelLabelTransform.setContentSize(120, 50);
        cancelLabelTransform.setAnchorPoint(0.5, 0.5);
        
        cancelButtonComp.node.on(Button.EventType.CLICK, () => {
            onCancel();
            // 销毁确认框
            if (this.confirmDialogNode && this.confirmDialogNode.isValid) {
                this.confirmDialogNode.destroy();
                this.confirmDialogNode = null;
            }
        }, this);
        
    }

    /**
     * 无需确认，直接退出游戏
     */
    onExitGameClick() {
        // 1. 使用已有的gameManager属性，如果不存在则查找
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        // 2. 如果结算面板未显示，先显示结算面板
        if (this.gameManager) {
            const gameOverDialog = (this.gameManager as any).gameOverDialog;
            if (!gameOverDialog || !gameOverDialog.active) {
                // 显示结算面板（主动退出）
                (this.gameManager as any).showGameResultPanel(null);
                return; // 显示结算面板后，等待用户再次点击退出按钮
            }
        }
        
        // 3. 如果结算面板已显示，则真正退出游戏
        //    如果玩家在设置中关闭了背景音乐，这里确保不会在退出流程中意外重新播放BGM
        const exitSoundManager = SoundManager.getInstance();
        const exitBgmOn = exitSoundManager ? exitSoundManager.isBgmOn() : null;
       //console.info('[UIManager.onExitGameClick] 退出游戏时 BGM 状态 isBgmOn =', exitBgmOn);
        if (exitSoundManager && !exitBgmOn) {
           //console.info('[UIManager.onExitGameClick] BGM 已关闭，停止当前BGM并标记下次首页不自动播放');
            const audioMgr = AudioManager.Instance;
            if (audioMgr) {
                audioMgr.stopBGM();
                audioMgr.setBGMVolume(0);
            }
            try {
                sys.localStorage.setItem('TowerDemo_SkipBgmOnNextHome', '1');
            } catch (e) {
                console.warn('[UIManager.onExitGameClick] 写入 TowerDemo_SkipBgmOnNextHome=1 失败: ', e);
            }
        } else {
            // console.info('[UIManager.onExitGameClick] 未写入 Skip 标记，原因：',
            //     !exitSoundManager ? 'SoundManager 为空' :
            //     exitBgmOn ? 'BGM 开关为开' : '未知');
        }
        
        // 清除上一关的所有卡片增幅
        const buffManager = BuffManager.getInstance();
        buffManager.clearAllBuffs();
        console.log('[UIManager] 退出游戏，已清除所有卡片增幅');
        
        // 在退出前结算经验值（虽然已经在showGameResultPanel中结算了，但这里确保保存）
        if (this.gameManager) {
            // 直接调用结算方法
            this.gameManager.settleGameExperience();
            this.gameManager.restartGame();
        } else {
        }
        
        // 4. 立即手动重置UI状态，确保游戏立即退出到首页
        // 查找或创建底部三页签UI
        let bottomSelectionNode = find('Canvas/BottomSelection');
        if (!bottomSelectionNode) {
            this.createBottomSelectionUI();
            bottomSelectionNode = find('Canvas/BottomSelection');
        }
        
        // 确保底部三页签显示
        if (bottomSelectionNode) {
            bottomSelectionNode.active = true;
            
            // 计算当前可进行的最大关卡：已通过关卡中的最大值，+1（不超过10）
            let targetLevel = this.currentLevel;
            if (this.playerDataManager && this.playerDataManager.getPassedLevels) {
                const passed = this.playerDataManager.getPassedLevels();
                if (passed && passed.length > 0) {
                    const maxPassed = Math.max(...passed);
                    // 如果已经是最后一关，则仍然停留在最后一关；否则显示下一关
                    targetLevel = Math.min(10, maxPassed + 1);
                }
            }

            // 更新当前关卡并刷新相关 UI（标签、下一关按钮状态、背景）
            this.currentLevel = targetLevel;
            this.updateStartButtonText();
            this.updateNextLevelButtonState();

            // 如果当前关卡大于1，确保分包背景资源已加载，再切换到对应背景
            if (this.currentLevel > 1) {
                this.loadSubpackageResources()
                    .then(() => {
                        this.changeBackground(this.currentLevel);
                    })
                    .catch((err) => {
                        console.warn('[UIManager.onExitGameClick] 加载分包背景资源失败，仍使用当前背景', err);
                    });
            } else {
                this.changeBackground(this.currentLevel);
            }

            // 确保切换到游戏主体面板
            const gamePanel = bottomSelectionNode.getChildByName('GameMainPanel');
            const talentPanel = bottomSelectionNode.getChildByName('TalentPanel');
            const settingsPanel = bottomSelectionNode.getChildByName('SettingsPanel');
            
            if (gamePanel) {
                gamePanel.active = true;
                gamePanel.setSiblingIndex(bottomSelectionNode.children.length - 2);
            }
            if (talentPanel) {
                talentPanel.active = false;
            }
            if (settingsPanel) {
                settingsPanel.active = false;
            }
        }

        // 5. 退出游戏后切回主菜单背景音乐（backMusic.mp3），前提是玩家开启了BGM
        const soundManager = SoundManager.getInstance();
        if (soundManager) {
            // 先确保战斗音乐停止，再播放主菜单音乐
            soundManager.stopGameBgm();
            if (soundManager.isBgmOn()) {
                soundManager.playMenuBgm();
            } else {
               //console.info('[UIManager.onExitGameClick] BGM is disabled, skip playing menu BGM');
            }
        }
        
        // 5. 隐藏所有游戏元素
        const gameNodes = [
            'Canvas/Crystal',
            'Enemies',
            'Towers',
            'WarAncientTrees'
        ];
        
        for (const nodePath of gameNodes) {
            const node = find(nodePath);
            if (node) {
                node.active = false;
            }
        }
        
        // 6. 隐藏结算面板
        if (this.gameManager) {
            const gameOverDialog = (this.gameManager as any).gameOverDialog;
            if (gameOverDialog) {
                gameOverDialog.active = false;
            }
            const gameOverPanel = (this.gameManager as any).gameOverPanel;
            if (gameOverPanel) {
                gameOverPanel.active = false;
            }
        }
        
        // 7. 检查是否是第一次从结算页返回主页，显示天赋强化提示
        console.log('[UIManager.onExitGameClick] 准备调用checkAndShowTalentHint');
        if (this.gameManager) {
            const mvpUnit = (this.gameManager as any).lastMVPUnit;
            console.log('[UIManager.onExitGameClick] gameManager存在，lastMVPUnit:', mvpUnit);
        } else {
            console.warn('[UIManager.onExitGameClick] gameManager不存在');
        }
        this.checkAndShowTalentHint();
    }
    
    /**
     * 检查并显示首次返回主页的天赋强化提示
     */
    private checkAndShowTalentHint() {
        console.log('[UIManager.checkAndShowTalentHint] 开始检查是否显示天赋提示');
        // 检查是否已经显示过提示
        const hasShownHint = sys.localStorage.getItem('TowerDemo_FirstTalentHintShown');
        console.log('[UIManager.checkAndShowTalentHint] hasShownHint:', hasShownHint);
        if (hasShownHint === '1') {
            console.log('[UIManager.checkAndShowTalentHint] 已经显示过提示，不再显示');
            return; // 已经显示过，不再显示
        }
        
        // 检查是否有MVP/SVP单位信息
        if (!this.gameManager) {
            console.warn('[UIManager.checkAndShowTalentHint] gameManager不存在，无法显示提示');
            return;
        }
        
        const mvpUnit = (this.gameManager as any).lastMVPUnit;
        console.log('[UIManager.checkAndShowTalentHint] mvpUnit:', mvpUnit);
        if (!mvpUnit || !mvpUnit.unitName) {
            console.warn('[UIManager.checkAndShowTalentHint] mvpUnit不存在或没有unitName，不显示提示');
            return; // 没有MVP/SVP单位，不显示提示
        }
        
        console.log('[UIManager.checkAndShowTalentHint] 所有检查通过，准备显示提示对话框');
        // 标记已显示过提示
        try {
            sys.localStorage.setItem('TowerDemo_FirstTalentHintShown', '1');
            console.log('[UIManager.checkAndShowTalentHint] 已标记首次天赋提示为已显示');
        } catch (e) {
            console.warn('[UIManager.checkAndShowTalentHint] 写入首次天赋提示标记失败:', e);
        }
        
        // 延迟显示提示，确保UI已完全切换
        // 使用setTimeout而不是scheduleOnce，因为组件可能在延迟期间被禁用
        // 直接在回调中创建对话框，不依赖组件实例
        console.log('[UIManager.checkAndShowTalentHint] 延迟0.5秒后显示提示对话框，mvpUnit:', mvpUnit);
        const savedMVPUnit = mvpUnit; // 保存mvpUnit的引用
        setTimeout(() => {
            console.log('[UIManager.checkAndShowTalentHint] 延迟结束，直接创建对话框');
            // 再次检查mvpUnit是否仍然存在
            if (!savedMVPUnit || !savedMVPUnit.unitName) {
                console.warn('[UIManager.checkAndShowTalentHint] mvpUnit已失效，无法显示提示对话框');
                return;
            }
            // 直接调用静态方法创建对话框，不依赖组件实例
            UIManager.showTalentHintDialogStatic(savedMVPUnit);
        }, 500);
    }
    
    /**
     * 显示天赋强化提示对话框（静态方法，不依赖组件实例）
     */
    private static showTalentHintDialogStatic(mvpUnit: { unitName: string; unitType: string; unitIcon: SpriteFrame | null }) {
        console.log('[UIManager.showTalentHintDialogStatic] 开始显示天赋提示对话框，mvpUnit:', mvpUnit);
        const canvas = find('Canvas');
        if (!canvas) {
            console.error('[UIManager.showTalentHintDialogStatic] 找不到Canvas节点');
            return;
        }
        console.log('[UIManager.showTalentHintDialogStatic] Canvas节点找到，开始创建对话框');
        
        // 创建对话框容器
        const dialogNode = new Node('TalentHintDialog');
        dialogNode.setParent(canvas);
        dialogNode.setSiblingIndex(Number.MAX_SAFE_INTEGER);
        
        // 添加UITransform
        const dialogTransform = dialogNode.addComponent(UITransform);
        const visibleSize = view.getVisibleSize();
        dialogTransform.setContentSize(visibleSize.width, visibleSize.height);
        dialogTransform.setAnchorPoint(0.5, 0.5);
        dialogNode.setPosition(0, 0, 0);
        
        // 创建半透明遮罩背景
        const maskNode = new Node('Mask');
        maskNode.setParent(dialogNode);
        const maskTransform = maskNode.addComponent(UITransform);
        maskTransform.setContentSize(visibleSize.width, visibleSize.height);
        maskTransform.setAnchorPoint(0.5, 0.5);
        maskNode.setPosition(0, 0, 0);
        const maskGraphics = maskNode.addComponent(Graphics);
        maskGraphics.fillColor = new Color(0, 0, 0, 180);
        maskGraphics.rect(-visibleSize.width / 2, -visibleSize.height / 2, visibleSize.width, visibleSize.height);
        maskGraphics.fill();
        
        // 创建对话框内容容器
        const contentNode = new Node('Content');
        contentNode.setParent(dialogNode);
        const contentTransform = contentNode.addComponent(UITransform);
        const dialogWidth = 600;
        const dialogHeight = 400;
        contentTransform.setContentSize(dialogWidth, dialogHeight);
        contentTransform.setAnchorPoint(0.5, 0.5);
        contentNode.setPosition(0, 0, 0);
        
        // 创建对话框背景
        const bgNode = new Node('Background');
        bgNode.setParent(contentNode);
        const bgTransform = bgNode.addComponent(UITransform);
        bgTransform.setContentSize(dialogWidth, dialogHeight);
        bgTransform.setAnchorPoint(0.5, 0.5);
        bgNode.setPosition(0, 0, 0);
        const bgGraphics = bgNode.addComponent(Graphics);
        bgGraphics.fillColor = new Color(40, 40, 60, 240);
        bgGraphics.roundRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, 10);
        bgGraphics.fill();
        bgGraphics.strokeColor = new Color(255, 215, 0, 255);
        bgGraphics.lineWidth = 3;
        bgGraphics.roundRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, 10);
        bgGraphics.stroke();
        
        // 创建单位图标区域（左侧）
        const iconNode = new Node('UnitIcon');
        iconNode.setParent(contentNode);
        const iconTransform = iconNode.addComponent(UITransform);
        iconTransform.setContentSize(150, 150);
        iconTransform.setAnchorPoint(0.5, 0.5);
        iconNode.setPosition(-dialogWidth / 2 + 100, 50, 0);
        
        // 创建单位图标背景
        const iconBgNode = new Node('IconBackground');
        iconBgNode.setParent(iconNode);
        const iconBgTransform = iconBgNode.addComponent(UITransform);
        iconBgTransform.setContentSize(150, 150);
        iconBgTransform.setAnchorPoint(0.5, 0.5);
        iconBgNode.setPosition(0, 0, 0);
        const iconBgGraphics = iconBgNode.addComponent(Graphics);
        iconBgGraphics.fillColor = new Color(60, 60, 80, 255);
        iconBgGraphics.roundRect(-75, -75, 150, 150, 8);
        iconBgGraphics.fill();
        
        // 创建单位图标Sprite
        const iconSpriteNode = new Node('IconSprite');
        iconSpriteNode.setParent(iconNode);
        const iconSpriteTransform = iconSpriteNode.addComponent(UITransform);
        iconSpriteTransform.setContentSize(120, 120);
        iconSpriteTransform.setAnchorPoint(0.5, 0.5);
        iconSpriteNode.setPosition(0, 0, 0);
        const iconSprite = iconSpriteNode.addComponent(Sprite);
        
        // 创建提示文本区域（右侧）
        const textNode = new Node('Text');
        textNode.setParent(contentNode);
        const textTransform = textNode.addComponent(UITransform);
        textTransform.setContentSize(350, 250);
        textTransform.setAnchorPoint(0.5, 0.5);
        textNode.setPosition(dialogWidth / 2 - 175, 0, 0);
        
        const hintLabel = textNode.addComponent(Label);
        // 根据本局是否胜利显示不同的提示文案：
        // - 胜利：强调“指挥得当，守住了防线”，鼓励继续提升
        // - 失败：只提示“必须提升自己，才有可能守护住防线”
        const isVictory = (mvpUnit as any).isVictory === true;
        if (isVictory) {
            hintLabel.string = `指挥官，虽然刚才您指挥得当，带领我们守住了防线，但是接下来的敌人会更加强悍，我们必须提升自己，才有可能坚持到最后。`;
        } else {
            hintLabel.string = `指挥官，我们必须提升自己，才有可能守护住防线。`;
        }
        hintLabel.fontSize = 18;
        hintLabel.color = new Color(255, 255, 255, 255);
        hintLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        hintLabel.verticalAlign = Label.VerticalAlign.TOP;
        hintLabel.enableWrapText = true;
        hintLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
        
        // 创建确认按钮
        const confirmButtonNode = new Node('ConfirmButton');
        confirmButtonNode.setParent(contentNode);
        const confirmButtonTransform = confirmButtonNode.addComponent(UITransform);
        confirmButtonTransform.setContentSize(200, 50);
        confirmButtonTransform.setAnchorPoint(0.5, 0.5);
        confirmButtonNode.setPosition(0, -dialogHeight / 2 + 40, 0);
        
        const confirmButtonBg = confirmButtonNode.addComponent(Graphics);
        confirmButtonBg.fillColor = new Color(100, 150, 255, 255);
        confirmButtonBg.roundRect(-100, -25, 200, 50, 8);
        confirmButtonBg.fill();
        
        const confirmButton = confirmButtonNode.addComponent(Button);
        const confirmLabelNode = new Node('Label');
        confirmLabelNode.setParent(confirmButtonNode);
        const confirmLabelTransform = confirmLabelNode.addComponent(UITransform);
        confirmLabelTransform.setContentSize(200, 50);
        confirmLabelTransform.setAnchorPoint(0.5, 0.5);
        confirmLabelNode.setPosition(0, 0, 0);
        const confirmLabel = confirmLabelNode.addComponent(Label);
        confirmLabel.string = '前往天赋页';
        confirmLabel.fontSize = 20;
        confirmLabel.color = new Color(255, 255, 255, 255);
        confirmLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        confirmLabel.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 尝试获取单位图标：优先使用mvpUnit中已提供的unitIcon，如果没有则通过TalentSystem加载
        if (mvpUnit.unitIcon) {
            // 直接使用已提供的图标（最可靠的方式）
            iconSprite.spriteFrame = mvpUnit.unitIcon;
            console.log('[UIManager.showTalentHintDialogSecond] 使用mvpUnit.unitIcon直接设置图标');
        } else {
            // 如果没有提供图标，尝试通过TalentSystem加载
            UIManager.loadUnitIconForHintStatic(mvpUnit.unitType, iconSprite);
        }
        
        // 跳转到天赋页面的辅助函数（不依赖UIManager组件实例）
        const switchToTalentPage = () => {
            console.log('[UIManager.showTalentHintDialogStatic] 开始跳转到天赋页面');
            const bottomSelectionNode = find('Canvas/BottomSelection');
            if (!bottomSelectionNode) {
                console.warn('[UIManager.showTalentHintDialogStatic] 找不到BottomSelection节点');
                return;
            }
            
            const gameMainPanel = bottomSelectionNode.getChildByName('GameMainPanel');
            const talentPanel = bottomSelectionNode.getChildByName('TalentPanel');
            const settingsPanel = bottomSelectionNode.getChildByName('SettingsPanel');
            
            // 切换面板显示状态
            if (gameMainPanel) {
                gameMainPanel.active = false;
            }
            if (talentPanel) {
                talentPanel.active = true;
                // 确保天赋面板在最上层
                talentPanel.setSiblingIndex(bottomSelectionNode.children.length - 1);
            }
            if (settingsPanel) {
                settingsPanel.active = false;
            }
            
            // 隐藏签到宝箱
            const checkInButtonNode = find('Canvas/CheckInButton') || find('Canvas/BottomSelection/CheckInButton');
            if (checkInButtonNode) {
                checkInButtonNode.active = false;
                console.log('[UIManager.showTalentHintDialogStatic] 已隐藏签到宝箱');
            }
            
            console.log('[UIManager.showTalentHintDialogStatic] 已切换到天赋页面');
            
            // 延迟显示第二个指引框（包含第二句话）
            setTimeout(() => {
                UIManager.showTalentHintDialogSecond(mvpUnit);
            }, 500);
        };
        
        // 绑定确认按钮点击事件
        confirmButton.node.on(Button.EventType.CLICK, () => {
            console.log('[UIManager.showTalentHintDialogStatic] 确认按钮被点击，关闭对话框并跳转到天赋页');
            dialogNode.destroy();
            switchToTalentPage();
        });
        
        // 绑定遮罩点击事件（点击遮罩也关闭并跳转）
        maskNode.on(Node.EventType.TOUCH_START, () => {
            console.log('[UIManager.showTalentHintDialogStatic] 遮罩被点击，关闭对话框并跳转到天赋页');
            dialogNode.destroy();
            switchToTalentPage();
        });
        
        // 淡入动画
        const dialogOpacity = dialogNode.addComponent(UIOpacity);
        dialogOpacity.opacity = 0;
        tween(dialogOpacity).to(0.3, { opacity: 255 }).start();
        
        console.log('[UIManager.showTalentHintDialogStatic] 对话框创建完成');
    }
    
    /**
     * 显示第二个天赋强化提示对话框（跳转到天赋页后显示，包含第二句话）
     */
    private static showTalentHintDialogSecond(mvpUnit: { unitName: string; unitType: string; unitIcon: SpriteFrame | null }) {
        console.log('[UIManager.showTalentHintDialogSecond] 开始显示第二个天赋提示对话框，mvpUnit:', mvpUnit);
        const canvas = find('Canvas');
        if (!canvas) {
            console.error('[UIManager.showTalentHintDialogSecond] 找不到Canvas节点');
            return;
        }
        console.log('[UIManager.showTalentHintDialogSecond] Canvas节点找到，开始创建对话框');
        
        // 创建对话框容器
        const dialogNode = new Node('TalentHintDialogSecond');
        dialogNode.setParent(canvas);
        dialogNode.setSiblingIndex(Number.MAX_SAFE_INTEGER);
        
        // 添加UITransform
        const dialogTransform = dialogNode.addComponent(UITransform);
        const visibleSize = view.getVisibleSize();
        dialogTransform.setContentSize(visibleSize.width, visibleSize.height);
        dialogTransform.setAnchorPoint(0.5, 0.5);
        dialogNode.setPosition(0, 0, 0);
        
        // 创建半透明遮罩背景
        const maskNode = new Node('Mask');
        maskNode.setParent(dialogNode);
        const maskTransform = maskNode.addComponent(UITransform);
        maskTransform.setContentSize(visibleSize.width, visibleSize.height);
        maskTransform.setAnchorPoint(0.5, 0.5);
        maskNode.setPosition(0, 0, 0);
        const maskGraphics = maskNode.addComponent(Graphics);
        maskGraphics.fillColor = new Color(0, 0, 0, 180);
        maskGraphics.rect(-visibleSize.width / 2, -visibleSize.height / 2, visibleSize.width, visibleSize.height);
        maskGraphics.fill();
        
        // 创建对话框内容容器
        const contentNode = new Node('Content');
        contentNode.setParent(dialogNode);
        const contentTransform = contentNode.addComponent(UITransform);
        const dialogWidth = 600;
        const dialogHeight = 300;
        contentTransform.setContentSize(dialogWidth, dialogHeight);
        contentTransform.setAnchorPoint(0.5, 0.5);
        contentNode.setPosition(0, 0, 0);
        
        // 创建对话框背景
        const bgNode = new Node('Background');
        bgNode.setParent(contentNode);
        const bgTransform = bgNode.addComponent(UITransform);
        bgTransform.setContentSize(dialogWidth, dialogHeight);
        bgTransform.setAnchorPoint(0.5, 0.5);
        bgNode.setPosition(0, 0, 0);
        const bgGraphics = bgNode.addComponent(Graphics);
        bgGraphics.fillColor = new Color(40, 40, 60, 240);
        bgGraphics.roundRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, 10);
        bgGraphics.fill();
        bgGraphics.strokeColor = new Color(255, 215, 0, 255);
        bgGraphics.lineWidth = 3;
        bgGraphics.roundRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, 10);
        bgGraphics.stroke();
        
        // 创建单位图标区域（左侧）
        const iconNode = new Node('UnitIcon');
        iconNode.setParent(contentNode);
        const iconTransform = iconNode.addComponent(UITransform);
        iconTransform.setContentSize(150, 150);
        iconTransform.setAnchorPoint(0.5, 0.5);
        iconNode.setPosition(-dialogWidth / 2 + 100, 0, 0);
        
        // 创建单位图标背景
        const iconBgNode = new Node('IconBackground');
        iconBgNode.setParent(iconNode);
        const iconBgTransform = iconBgNode.addComponent(UITransform);
        iconBgTransform.setContentSize(150, 150);
        iconBgTransform.setAnchorPoint(0.5, 0.5);
        iconBgNode.setPosition(0, 0, 0);
        const iconBgGraphics = iconBgNode.addComponent(Graphics);
        iconBgGraphics.fillColor = new Color(60, 60, 80, 255);
        iconBgGraphics.roundRect(-75, -75, 150, 150, 8);
        iconBgGraphics.fill();
        
        // 创建单位图标Sprite
        const iconSpriteNode = new Node('IconSprite');
        iconSpriteNode.setParent(iconNode);
        const iconSpriteTransform = iconSpriteNode.addComponent(UITransform);
        iconSpriteTransform.setContentSize(120, 120);
        iconSpriteTransform.setAnchorPoint(0.5, 0.5);
        iconSpriteNode.setPosition(0, 0, 0);
        const iconSprite = iconSpriteNode.addComponent(Sprite);
        
        // 创建提示文本区域（右侧）
        const textNode = new Node('Text');
        textNode.setParent(contentNode);
        const textTransform = textNode.addComponent(UITransform);
        textTransform.setContentSize(350, 200);
        textTransform.setAnchorPoint(0.5, 0.5);
        textNode.setPosition(dialogWidth / 2 - 175, 0, 0);
        
        const hintLabel = textNode.addComponent(Label);
        hintLabel.string = `您可以小幅度强化所有单位，或者针对性强化特定单位。`;
        hintLabel.fontSize = 18;
        hintLabel.color = new Color(255, 255, 255, 255);
        hintLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        hintLabel.verticalAlign = Label.VerticalAlign.CENTER;
        hintLabel.enableWrapText = true;
        hintLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
        
        // 创建确认按钮
        const confirmButtonNode = new Node('ConfirmButton');
        confirmButtonNode.setParent(contentNode);
        const confirmButtonTransform = confirmButtonNode.addComponent(UITransform);
        confirmButtonTransform.setContentSize(200, 50);
        confirmButtonTransform.setAnchorPoint(0.5, 0.5);
        confirmButtonNode.setPosition(0, -dialogHeight / 2 + 40, 0);
        
        const confirmButtonBg = confirmButtonNode.addComponent(Graphics);
        confirmButtonBg.fillColor = new Color(100, 150, 255, 255);
        confirmButtonBg.roundRect(-100, -25, 200, 50, 8);
        confirmButtonBg.fill();
        
        const confirmButton = confirmButtonNode.addComponent(Button);
        const confirmLabelNode = new Node('Label');
        confirmLabelNode.setParent(confirmButtonNode);
        const confirmLabelTransform = confirmLabelNode.addComponent(UITransform);
        confirmLabelTransform.setContentSize(200, 50);
        confirmLabelTransform.setAnchorPoint(0.5, 0.5);
        confirmLabelNode.setPosition(0, 0, 0);
        const confirmLabel = confirmLabelNode.addComponent(Label);
        confirmLabel.string = '我知道了';
        confirmLabel.fontSize = 20;
        confirmLabel.color = new Color(255, 255, 255, 255);
        confirmLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        confirmLabel.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 尝试获取单位图标：优先使用mvpUnit中已提供的unitIcon，如果没有则通过TalentSystem加载
        if (mvpUnit.unitIcon) {
            // 直接使用已提供的图标（最可靠的方式）
            iconSprite.spriteFrame = mvpUnit.unitIcon;
            console.log('[UIManager.showTalentHintDialogSecond] 使用mvpUnit.unitIcon直接设置图标');
        } else {
            // 如果没有提供图标，尝试通过TalentSystem加载
            UIManager.loadUnitIconForHintStatic(mvpUnit.unitType, iconSprite);
        }
        
        // 绑定确认按钮点击事件
        confirmButton.node.on(Button.EventType.CLICK, () => {
            console.log('[UIManager.showTalentHintDialogSecond] 确认按钮被点击，关闭对话框');
            dialogNode.destroy();
        });
        
        // 绑定遮罩点击事件（点击遮罩也关闭）
        maskNode.on(Node.EventType.TOUCH_START, () => {
            console.log('[UIManager.showTalentHintDialogSecond] 遮罩被点击，关闭对话框');
            dialogNode.destroy();
        });
        
        // 淡入动画
        const dialogOpacity = dialogNode.addComponent(UIOpacity);
        dialogOpacity.opacity = 0;
        tween(dialogOpacity).to(0.3, { opacity: 255 }).start();
        
        console.log('[UIManager.showTalentHintDialogSecond] 对话框创建完成');
    }
    
    /**
     * 显示天赋强化提示对话框（实例方法，保留用于向后兼容）
     */
    private showTalentHintDialog(mvpUnit: { unitName: string; unitType: string; unitIcon: SpriteFrame | null }) {
        console.log('[UIManager.showTalentHintDialog] 开始显示天赋提示对话框，mvpUnit:', mvpUnit);
        const canvas = find('Canvas');
        if (!canvas) {
            console.error('[UIManager.showTalentHintDialog] 找不到Canvas节点');
            return;
        }
        console.log('[UIManager.showTalentHintDialog] Canvas节点找到，开始创建对话框');
        
        // 创建对话框容器
        const dialogNode = new Node('TalentHintDialog');
        dialogNode.setParent(canvas);
        dialogNode.setSiblingIndex(Number.MAX_SAFE_INTEGER);
        
        // 添加UITransform
        const dialogTransform = dialogNode.addComponent(UITransform);
        const visibleSize = view.getVisibleSize();
        dialogTransform.setContentSize(visibleSize.width, visibleSize.height);
        dialogTransform.setAnchorPoint(0.5, 0.5);
        dialogNode.setPosition(0, 0, 0);
        
        // 创建半透明遮罩背景
        const maskNode = new Node('Mask');
        maskNode.setParent(dialogNode);
        const maskTransform = maskNode.addComponent(UITransform);
        maskTransform.setContentSize(visibleSize.width, visibleSize.height);
        maskTransform.setAnchorPoint(0.5, 0.5);
        maskNode.setPosition(0, 0, 0);
        const maskGraphics = maskNode.addComponent(Graphics);
        maskGraphics.fillColor = new Color(0, 0, 0, 180);
        maskGraphics.rect(-visibleSize.width / 2, -visibleSize.height / 2, visibleSize.width, visibleSize.height);
        maskGraphics.fill();
        
        // 创建对话框内容容器
        const contentNode = new Node('Content');
        contentNode.setParent(dialogNode);
        const contentTransform = contentNode.addComponent(UITransform);
        const dialogWidth = 600;
        const dialogHeight = 400;
        contentTransform.setContentSize(dialogWidth, dialogHeight);
        contentTransform.setAnchorPoint(0.5, 0.5);
        contentNode.setPosition(0, 0, 0);
        
        // 创建对话框背景
        const bgNode = new Node('Background');
        bgNode.setParent(contentNode);
        const bgTransform = bgNode.addComponent(UITransform);
        bgTransform.setContentSize(dialogWidth, dialogHeight);
        bgTransform.setAnchorPoint(0.5, 0.5);
        bgNode.setPosition(0, 0, 0);
        const bgGraphics = bgNode.addComponent(Graphics);
        bgGraphics.fillColor = new Color(40, 40, 60, 240);
        bgGraphics.roundRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, 10);
        bgGraphics.fill();
        bgGraphics.strokeColor = new Color(255, 215, 0, 255);
        bgGraphics.lineWidth = 3;
        bgGraphics.roundRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, 10);
        bgGraphics.stroke();
        
        // 创建单位图标区域（左侧）
        const iconNode = new Node('UnitIcon');
        iconNode.setParent(contentNode);
        const iconTransform = iconNode.addComponent(UITransform);
        iconTransform.setContentSize(150, 150);
        iconTransform.setAnchorPoint(0.5, 0.5);
        iconNode.setPosition(-dialogWidth / 2 + 100, 50, 0);
        
        // 创建单位图标背景
        const iconBgNode = new Node('IconBackground');
        iconBgNode.setParent(iconNode);
        const iconBgTransform = iconBgNode.addComponent(UITransform);
        iconBgTransform.setContentSize(150, 150);
        iconBgTransform.setAnchorPoint(0.5, 0.5);
        iconBgNode.setPosition(0, 0, 0);
        const iconBgGraphics = iconBgNode.addComponent(Graphics);
        iconBgGraphics.fillColor = new Color(60, 60, 80, 255);
        iconBgGraphics.roundRect(-75, -75, 150, 150, 8);
        iconBgGraphics.fill();
        
        // 创建单位图标Sprite
        const iconSpriteNode = new Node('IconSprite');
        iconSpriteNode.setParent(iconNode);
        const iconSpriteTransform = iconSpriteNode.addComponent(UITransform);
        iconSpriteTransform.setContentSize(120, 120);
        iconSpriteTransform.setAnchorPoint(0.5, 0.5);
        iconSpriteNode.setPosition(0, 0, 0);
        const iconSprite = iconSpriteNode.addComponent(Sprite);
        
        // 尝试获取单位图标
        this.loadUnitIconForHint(mvpUnit.unitType, iconSprite);
        
        // 创建文本内容区域（右侧）
        const textNode = new Node('TextContent');
        textNode.setParent(contentNode);
        const textTransform = textNode.addComponent(UITransform);
        textTransform.setContentSize(dialogWidth - 200, dialogHeight - 100);
        textTransform.setAnchorPoint(0.5, 0.5);
        textNode.setPosition(dialogWidth / 2 - 150, 0, 0);
        
        // 创建提示文本
        const hintLabel = textNode.addComponent(Label);
        hintLabel.string = `指挥官，虽然刚才您指挥得当，带领我们守住了防线，但是接下来的敌人会更加强悍，我们必须提升自己，才有可能守护住防线。\n\n您可以小幅度强化所有单位，或者针对性强化特定单位。`;
        hintLabel.fontSize = 20;
        hintLabel.color = new Color(255, 255, 255, 255);
        hintLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        hintLabel.verticalAlign = Label.VerticalAlign.TOP;
        hintLabel.lineHeight = 28;
        hintLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
        
        // 创建确认按钮
        const confirmButtonNode = new Node('ConfirmButton');
        confirmButtonNode.setParent(contentNode);
        const confirmButtonTransform = confirmButtonNode.addComponent(UITransform);
        confirmButtonTransform.setContentSize(200, 50);
        confirmButtonTransform.setAnchorPoint(0.5, 0.5);
        confirmButtonNode.setPosition(0, -dialogHeight / 2 + 40, 0);
        
        // 按钮背景
        const buttonBgNode = new Node('ButtonBackground');
        buttonBgNode.setParent(confirmButtonNode);
        const buttonBgTransform = buttonBgNode.addComponent(UITransform);
        buttonBgTransform.setContentSize(200, 50);
        buttonBgTransform.setAnchorPoint(0.5, 0.5);
        buttonBgNode.setPosition(0, 0, 0);
        const buttonBgGraphics = buttonBgNode.addComponent(Graphics);
        buttonBgGraphics.fillColor = new Color(100, 150, 255, 255);
        buttonBgGraphics.roundRect(-100, -25, 200, 50, 5);
        buttonBgGraphics.fill();
        
        // 按钮文字
        const buttonLabelNode = new Node('ButtonLabel');
        buttonLabelNode.setParent(confirmButtonNode);
        const buttonLabelTransform = buttonLabelNode.addComponent(UITransform);
        buttonLabelTransform.setContentSize(200, 50);
        buttonLabelTransform.setAnchorPoint(0.5, 0.5);
        buttonLabelNode.setPosition(0, 0, 0);
        const buttonLabel = buttonLabelNode.addComponent(Label);
        buttonLabel.string = '前往天赋页面';
        buttonLabel.fontSize = 22;
        buttonLabel.color = new Color(255, 255, 255, 255);
        buttonLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        buttonLabel.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 添加Button组件
        const confirmButton = confirmButtonNode.addComponent(Button);
        confirmButton.node.on(Button.EventType.CLICK, () => {
            // 关闭对话框
            if (dialogNode && dialogNode.isValid) {
                dialogNode.destroy();
            }
            // 跳转到天赋页面
            this.setActivePage('talent');
        }, this);
        
        // 添加点击遮罩关闭功能（可选）
        maskNode.on(Node.EventType.TOUCH_END, () => {
            if (dialogNode && dialogNode.isValid) {
                dialogNode.destroy();
            }
            // 跳转到天赋页面
            this.setActivePage('talent');
        }, this);
        
        // 淡入动画
        const uiOpacity = dialogNode.addComponent(UIOpacity);
        uiOpacity.opacity = 0;
        tween(uiOpacity)
            .to(0.3, { opacity: 255 })
            .start();
    }
    
    /**
     * 为提示对话框加载单位图标
     */
    /**
     * 加载单位图标用于提示（静态方法）
     */
    private static loadUnitIconForHintStatic(unitType: string, sprite: Sprite) {
        if (!unitType || !sprite) {
            return;
        }
        
        // 尝试通过TalentSystem的方法加载图标
        const bottomSelectionNode = find('Canvas/BottomSelection');
        if (bottomSelectionNode) {
            const talentPanelNode = bottomSelectionNode.getChildByName('TalentPanel');
            if (talentPanelNode) {
                const talentSystem = talentPanelNode.getComponent(TalentSystem);
                if (talentSystem && (talentSystem as any).loadUnitCardIcon) {
                    (talentSystem as any).loadUnitCardIcon(unitType, sprite);
                    return;
                }
            }
        }
        
        // 备用方案：如果TalentSystem不可用，尝试从UnitConfigManager获取单位信息
        // 但图标需要从预制体加载，这里暂时留空
        // 如果加载失败，图标会保持空白，但不影响功能
        console.warn('[UIManager.loadUnitIconForHintStatic] 无法加载单位图标:', unitType);
    }
    
    /**
     * 加载单位图标用于提示（实例方法，保留用于向后兼容）
     */
    private loadUnitIconForHint(unitType: string, sprite: Sprite) {
        UIManager.loadUnitIconForHintStatic(unitType, sprite);
    }
    
    /**
     * 加载分包资源（背景图片）
     * 只加载一次，后续调用会直接返回
     */
    private async loadSubpackageResources(): Promise<void> {
        if (this.isSubpackageLoaded) {
            return Promise.resolve();
        }

        // 如果正在加载，等待加载完成
        if (this.isSubpackageLoading) {
            // 轮询等待加载完成
            return new Promise<void>((resolve) => {
                const checkInterval = setInterval(() => {
                    if (this.isSubpackageLoaded) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            });
        }

        this.isSubpackageLoading = true;

        return new Promise<void>((resolve, reject) => {
            // 首先加载 other bundle
            assetManager.loadBundle('other', (err, bundle) => {
                if (err) {
                    this.isSubpackageLoading = false;
                    console.error('[UIManager] 加载 other bundle 失败', err);
                    reject(err);
                    return;
                }

                this.otherBundle = bundle;
                console.log('[UIManager] 成功加载 other bundle');

                // 加载所有关卡背景图片（background2.png 到 background10.png）
                const backgroundFiles = ['background2', 'background3', 'background4', 'background5', 'background6', 'background7', 'background8', 'background9', 'background10'];
                const loadPromises: Promise<void>[] = [];

                backgroundFiles.forEach((fileName, index) => {
                    const level = index + 2; // 关卡号从2开始
                    const resourcePath = `${fileName}/spriteFrame`; // bundle 内的相对路径
                    
                    const loadPromise = new Promise<void>((resolveItem, rejectItem) => {
                        bundle.load(resourcePath, SpriteFrame, (err, spriteFrame) => {
                            if (err) {
                                console.warn(`[UIManager] 加载分包资源失败: ${resourcePath}`, err);
                                rejectItem(err);
                                return;
                            }
                            
                            // 缓存加载的背景图片
                            if (!this.backgroundSprites) {
                                // 兼容性兜底：某些运行环境中私有 Map 字段可能被初始化为 null
                                this.backgroundSprites = new Map<number, SpriteFrame>();
                            }
                            this.backgroundSprites.set(level, spriteFrame);
                            console.log(`[UIManager] 成功加载分包资源: ${resourcePath} (关卡 ${level})`);
                            resolveItem();
                        });
                    });
                    
                    loadPromises.push(loadPromise);
                });

                // 等待所有资源加载完成
                Promise.all(loadPromises)
                    .then(() => {
                        this.isSubpackageLoaded = true;
                        this.isSubpackageLoading = false;
                        console.log('[UIManager] 分包资源加载完成');
                        resolve();
                    })
                    .catch((err) => {
                        this.isSubpackageLoading = false;
                        console.error('[UIManager] 分包资源加载失败', err);
                        reject(err);
                    });
            });
        });
    }

    /**
     * 切换背景图片
     * @param level 关卡号（1-5）
     */
    private changeBackground(level: number) {
        // 确保背景节点存在
        if (!this.backgroundNode) {
            this.backgroundNode = find('Canvas/Background');
        }

        if (!this.backgroundNode) {
            console.warn('[UIManager] 未找到背景节点 Canvas/Background');
            return;
        }

        // 获取背景节点的 Sprite 组件
        let sprite = this.backgroundNode.getComponent(Sprite);
        if (!sprite) {
            sprite = this.backgroundNode.addComponent(Sprite);
        }

        // 首次记录默认背景贴图
        if (!this.defaultBackgroundSprite) {
            this.defaultBackgroundSprite = sprite.spriteFrame || null;
        }

        // 如果关卡号为1，使用默认背景（如果有的话，保持原样）
        if (level === 1) {
            if (this.defaultBackgroundSprite) {
                sprite.spriteFrame = this.defaultBackgroundSprite;
                sprite.enabled = true;
                console.log('[UIManager] 已切换回第一关默认背景');
            } else {
                console.warn('[UIManager] 未记录到默认背景，无法切回第一关背景');
            }
            return;
        }

        // 从缓存中获取对应关卡的背景图片
        const spriteFrame = this.backgroundSprites.get(level);
        if (spriteFrame) {
            sprite.spriteFrame = spriteFrame;
            sprite.enabled = true;
            console.log(`[UIManager] 已切换背景图片到关卡 ${level}`);
        } else {
            console.warn(`[UIManager] 关卡 ${level} 的背景图片未加载`);
        }
    }

    /**
     * 选择上一个关卡
     */
    selectPreviousLevel() {
        if (this.currentLevel > 1) {
            this.currentLevel--;
            this.updateStartButtonText();
            this.updateNextLevelButtonState(); // 更新按钮状态
            
            // 切换背景图片（不加载分包资源）
            this.changeBackground(this.currentLevel);
        }
    }
    
    /**
     * 选择下一个关卡
     */
    selectNextLevel() {
        if (this.currentLevel < 10) {
            const nextLevel = this.currentLevel + 1;
            
            // 规则：只有“通过当前关卡”，才能选择“下一关”
            // 例如：通过关卡1 -> 可以选择关卡2
            if (this.playerDataManager) {
                const isCurrentLevelPassed = this.playerDataManager.isLevelPassed(this.currentLevel);
                if (!isCurrentLevelPassed) {
                   //console.info(`[UIManager.selectNextLevel] 当前关卡 ${this.currentLevel} 未通过，无法切换到关卡 ${nextLevel}`);
                    return;
                }
            }
            
            // 如果是第一次点击下一关卡，需要加载分包资源
            if (!this.isSubpackageLoaded && !this.isSubpackageLoading) {
                // 先更新关卡号，让用户看到反馈
                this.currentLevel = nextLevel;
                this.updateStartButtonText();
                this.updateNextLevelButtonState(); // 更新按钮状态
                
                // 异步加载分包资源，加载完成后切换背景
                this.loadSubpackageResources()
                    .then(() => {
                        // 加载完成后切换背景
                        this.changeBackground(this.currentLevel);
                    })
                    .catch((err) => {
                        console.error('[UIManager] 加载分包资源失败', err);
                        // 即使加载失败，也尝试切换背景（可能资源已存在）
                        this.changeBackground(this.currentLevel);
                    });
            } else {
                // 分包资源已加载或正在加载，直接切换背景
                this.currentLevel = nextLevel;
                this.updateStartButtonText();
                this.updateNextLevelButtonState(); // 更新按钮状态
                
                // 如果正在加载，等待加载完成后再切换背景
                if (this.isSubpackageLoading) {
                    this.loadSubpackageResources()
                        .then(() => {
                            this.changeBackground(this.currentLevel);
                        })
                        .catch(() => {
                            this.changeBackground(this.currentLevel);
                        });
                } else {
                    // 已加载完成，直接切换
                    this.changeBackground(this.currentLevel);
                }
            }
        }
    }
    
    /**
     * 更新上一关按钮的状态（启用/禁用和置灰）
     * 第一关时置灰，否则可点击
     */
    updatePreviousLevelButtonState() {
        if (!this.levelSelectLeftButton) {
            return;
        }
        const canGoToPreviousLevel = this.currentLevel > 1;
        const button = this.levelSelectLeftButton.getComponent(Button);
        if (button) {
            button.interactable = canGoToPreviousLevel;
        }
        const sprite = this.levelSelectLeftButton.getComponent(Sprite);
        if (sprite) {
            sprite.color = canGoToPreviousLevel ? new Color(255, 255, 255, 255) : new Color(128, 128, 128, 200);
        }
        let opacity = this.levelSelectLeftButton.getComponent(UIOpacity);
        if (!opacity) {
            opacity = this.levelSelectLeftButton.addComponent(UIOpacity);
        }
        if (opacity) {
            opacity.opacity = canGoToPreviousLevel ? 255 : 150;
        }
    }

    /**
     * 更新下一关按钮的状态（启用/禁用和置灰）
     */
    updateNextLevelButtonState() {
        this.updatePreviousLevelButtonState();
        if (!this.levelSelectRightButton) {
            return;
        }
        
        const nextLevel = this.currentLevel + 1;
        
        // 如果已经是最后一关，禁用按钮
        if (nextLevel > 10) {
            const button = this.levelSelectRightButton.getComponent(Button);
            if (button) {
                button.interactable = false;
            }
            const sprite = this.levelSelectRightButton.getComponent(Sprite);
            if (sprite) {
                sprite.color = new Color(128, 128, 128, 200); // 灰色半透明
            }
            let opacity = this.levelSelectRightButton.getComponent(UIOpacity);
            if (!opacity) {
                opacity = this.levelSelectRightButton.addComponent(UIOpacity);
            }
            if (opacity) {
                opacity.opacity = 150;
            }
            return;
        }
        
        // 检查当前关卡是否已通过（只有通过当前关卡才能进入下一关）
        // 首次玩家无过关记录时，只能选第一关；通过关卡1后才能选第二关
        const canGoToNextLevel = !!(this.playerDataManager && this.playerDataManager.isLevelPassed(this.currentLevel));
        
        const button = this.levelSelectRightButton.getComponent(Button);
        if (button) {
            button.interactable = canGoToNextLevel;
           //console.info(`[UIManager.updateNextLevelButtonState] 下一关按钮状态更新，当前关卡: ${this.currentLevel}, 下一关: ${nextLevel}, 当前关卡已通过: ${canGoToNextLevel}, 可切换: ${canGoToNextLevel}`);
        }
        
        // 设置按钮透明度（置灰效果）
        const sprite = this.levelSelectRightButton.getComponent(Sprite);
        if (sprite) {
            if (canGoToNextLevel) {
                sprite.color = new Color(255, 255, 255, 255); // 正常颜色
            } else {
                sprite.color = new Color(128, 128, 128, 200); // 灰色半透明
            }
        }
        
        // 如果按钮有UIOpacity组件，也可以通过它来设置透明度
        let opacity = this.levelSelectRightButton.getComponent(UIOpacity);
        if (!opacity) {
            opacity = this.levelSelectRightButton.addComponent(UIOpacity);
        }
        if (opacity) {
            opacity.opacity = canGoToNextLevel ? 255 : 150; // 未通过时降低透明度
        }
    }
    
    /**
     * 更新关卡选择区域的文本，显示当前选择的关卡
     */
    updateStartButtonText() {
        if (this.currentLevelLabel) {
            this.currentLevelLabel.string = `关卡 ${this.currentLevel}`;
        }
        // 更新下一关按钮状态
        this.updateNextLevelButtonState();
        // 同步更新通关率与难度标签
        if (this.levelPassRateLabelComp) {
            this.levelPassRateLabelComp.updateLevel(this.currentLevel);
        }
    }
    
    /**
     * 获取当前选择的关卡
     */
    getCurrentLevel(): number {
        return this.currentLevel;
    }
    
    /**
     * 返回按钮事件方法，从游戏主体页面返回到三页签首页
     */
    onBackToHome() {
        // 返回首页时，更新下一关按钮状态
        this.updateNextLevelButtonState();
        // 重新查找GameManager
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        // 保存游戏状态，用于恢复
        let wasPlaying = false;
        if (this.gameManager) {
            const gm = this.gameManager as any;
            wasPlaying = gm.gameState === 1; // GameState.Playing = 1
            // 如果游戏正在运行，暂停游戏
            if (wasPlaying && gm.pauseGame) {
                gm.pauseGame();
            }
        }
        
        // 显示确认框
        this.createConfirmDialog(
            '确定要退出游戏并返回首页吗？',
            () => {
                // 确认退出前，先恢复游戏时间缩放（如果之前暂停了）
                if (wasPlaying && this.gameManager) {
                    const gm = this.gameManager as any;
                    // 恢复时间缩放，但不改变游戏状态（因为即将退出）
                    if (gm.originalTimeScale !== undefined) {
                        director.getScheduler().setTimeScale(gm.originalTimeScale || 1);
                    }
                }
                // 确认退出
                this.onExitGameClick();
            },
            () => {
                // 取消退出，恢复游戏（如果之前是Playing状态）
                if (wasPlaying && this.gameManager) {
                    const gm = this.gameManager as any;
                    if (gm.resumeGame) {
                        gm.resumeGame();
                    }
                }
            }
        );
    }
    
    /**
     * 手动重置UI状态
     */
    manualResetUI() {
        
        // 查找或创建底部三页签UI
        let bottomSelectionNode = find('Canvas/BottomSelection');
        if (!bottomSelectionNode) {
            this.createBottomSelectionUI();
            bottomSelectionNode = find('Canvas/BottomSelection');
        }
        
        // 确保底部三页签显示
        if (bottomSelectionNode) {
            bottomSelectionNode.active = true;
            
            // 确保切换到游戏主体面板
            const gamePanel = bottomSelectionNode.getChildByName('GameMainPanel');
            const talentPanel = bottomSelectionNode.getChildByName('TalentPanel');
            const settingsPanel = bottomSelectionNode.getChildByName('SettingsPanel');
            
            if (gamePanel) {
                gamePanel.active = true;
                gamePanel.setSiblingIndex(bottomSelectionNode.children.length - 2);
            }
            if (talentPanel) {
                talentPanel.active = false;
            }
            if (settingsPanel) {
                settingsPanel.active = false;
            }
        }
        
        // 隐藏所有游戏元素
        const gameNodes = [
            'Canvas/Crystal',
            'Enemies',
            'Towers',
            'WarAncientTrees'
        ];
        
        for (const nodePath of gameNodes) {
            const node = find(nodePath);
            if (node) {
                node.active = false;
            }
        }
        
    }

    /**
     * 从场景递归查找指定组件（按组件名字符串）
     */
    private findComponentInScene(componentName: string): any {
        const scene = this.node.scene || (director.getScene && director.getScene());
        if (!scene) return null;
        const dfs = (node: Node): any => {
            const comp = node.getComponent(componentName);
            if (comp) return comp;
            for (const child of node.children) {
                const found = dfs(child);
                if (found) return found;
            }
            return null;
        };
        return dfs(scene);
    }
    
    /**
     * 绑定开始游戏按钮事件
     */
    private bindStartGameButton() {
        // 查找开始游戏按钮
        let startButton = find('Canvas/BottomSelection/GameMainPanel/StartGameButton');
        if (!startButton) {
            console.warn('[UIManager] bindStartGameButton() 未找到开始游戏按钮');
            return;
        }
        
        this.startGameButtonNode = startButton;
        
        // 获取按钮组件
        const buttonComp = startButton.getComponent(Button);
        if (!buttonComp) {
            console.warn('[UIManager] bindStartGameButton() 开始游戏按钮没有 Button 组件');
            return;
        }
        
        // 绑定点击事件
        buttonComp.node.on(Button.EventType.CLICK, () => {
            this.onStartGameClick();
        }, this);
        
       //console.info('[UIManager] bindStartGameButton() 开始游戏按钮事件已绑定');
    }
    
    /**
     * 开始游戏按钮点击事件
     */
    private onStartGameClick() {
       //console.info('[UIManager] onStartGameClick() 点击开始游戏按钮');
        
        // 查找 GameManager
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        if (!this.gameManager) {
            console.error('[UIManager] onStartGameClick() 未找到 GameManager');
            return;
        }
        
        // 清除上一关的所有卡片增幅
        const buffManager = BuffManager.getInstance();
        buffManager.clearAllBuffs();
        console.log('[UIManager] 已清除上一关的所有卡片增幅');
        
        // 切换背景音乐到游戏音乐（backMusic1.mp3）
        const soundManager = SoundManager.getInstance();
        if (soundManager && soundManager.isBgmOn()) {
           //console.info('[UIManager] onStartGameClick() 切换到游戏背景音乐');
            soundManager.playGameBgm();
        }
        
        // 调用 GameManager 的开始游戏方法
        const gm = this.gameManager as any;
        if (gm.startGameWithLevel) {
            gm.startGameWithLevel(this.currentLevel);
        } else if (gm.startGame) {
            gm.startGame();
        } else {
            console.error('[UIManager] onStartGameClick() GameManager 没有 startGame 或 startGameWithLevel 方法');
        }
        
        // 隐藏底部三页签
        const bottomSelection = find('Canvas/BottomSelection');
        if (bottomSelection) {
            bottomSelection.active = false;
        }
    }

    /**
     * 初始化签到管理器
     */
    private initCheckInManager() {
        const scene = director.getScene();
        const root = find('Canvas') || scene;
        if (!root) {
            console.warn('[UIManager] initCheckInManager() cannot find Canvas or scene root');
            return;
        }

        // 确保 CheckInManager 存在
        let checkInMgr = CheckInManager.getInstance();
        if (!checkInMgr) {
            const checkInNode = new Node('CheckInManager');
            root.addChild(checkInNode);
            checkInMgr = checkInNode.addComponent(CheckInManager);
            console.log('[UIManager] initCheckInManager() created CheckInManager');
        }
    }

    /**
     * 初始化微信转发功能
     */
    private initWeChatShare() {
        console.log('[UIManager] initWeChatShare() 开始初始化微信转发功能');

        const shareManager = WeChatShareManager.getInstance();
        shareManager.initShare();

        // 广告场景值：从广告/分享卡片/浏览器进入时自动开始游戏
        // 1035: 小程序广告，1044: 朋友圈广告，1036: APP 分享卡片，1037: 小程序推广计划
        // 1095: 小程序广告组件，1274: 优量汇广告，1045: 公众号自定义菜单
        // 1069: 移动应用（实际多为 H5 广告跳转，转化率与广告渠道一致）
        // unknown: 浏览器直接访问（开发者工具测试用）
        const AD_SCENES = [1035, 1044, 1036, 1037, 1095, 1274, 1045, 1069];

        // 检查是否已经自动开始过（只自动开始一次）
        let hasAutoStarted = false;
        try {
            const flag = sys.localStorage.getItem('tower_ad_auto_started');
            if (flag === '1') {
                hasAutoStarted = true;
            }
        } catch (e) {
            console.warn('[UIManager.initWeChatShare] 读取本地标记失败:', e);
        }

        // 处理从广告/分享卡片/浏览器进入时自动开始游戏的逻辑
        const handleAdLaunch = (res: any) => {
            // 已经自动开始过，不再重复触发
            if (hasAutoStarted) {
                console.log('[UIManager] 已经自动开始过，不再重复触发');
                return;
            }

            const scene = res?.scene;
            const isFromAd = AD_SCENES.indexOf(scene) >= 0;

            if (isFromAd) {
                // 标记已自动开始过
                hasAutoStarted = true;
                try {
                    sys.localStorage.setItem('tower_ad_auto_started', '1');
                } catch (e) {
                    console.warn('[UIManager.handleAdLaunch] 写入本地标记失败:', e);
                }

                console.log('[UIManager] 从广告进入 (scene=' + scene + ')，将自动开始游戏');
                this.scheduleOnce(() => {
                    // 切换到游戏页（与 checkAndAutoStartFirstLevel 保持一致）
                    this.setActivePage('game');

                    // 隐藏底部三页签
                    const bottomSelectionNode = this.bottomSelectionNodeRef || find('Canvas/BottomSelection');
                    if (bottomSelectionNode) {
                        bottomSelectionNode.active = false;
                    }

                    // 隐藏签到按钮（签到宝箱）
                    if (this.checkInButton && this.checkInButton.node && this.checkInButton.node.isValid) {
                        this.checkInButton.node.active = false;
                    }

                    // 通知 GameManager 实际开始游戏
                    this.findGameManager();
                    if (this.gameManager) {
                        console.log('[UIManager] 自动开始游戏');
                        this.gameManager.startGame();
                    } else {
                        console.warn('[UIManager] 未能找到 GameManager，无法自动开始游戏');
                    }
                }, 0.5);
            }
        };

        // 监听小游戏回到前台事件（冷启动和热启动都会触发）
        if (sys.platform === sys.Platform.WECHAT_GAME && typeof window !== 'undefined') {
            const wx = (window as any).wx;
            if (wx && typeof wx.onShow === 'function') {
                wx.onShow((res: any) => {
                    console.log('[UIManager] 小游戏回到前台，场景值:', res.scene, 'query:', res.query);
                    handleAdLaunch(res);
                });
            }
        } else {
            // 非微信平台（如开发者工具的桌面浏览器模式），直接检查启动参数
            console.log('[UIManager] 非微信平台，检查是否需要自动开始游戏');
            // 在桌面浏览器环境，scene 通常为 undefined，视为浏览器直接访问
            handleAdLaunch({ scene: undefined });
        }

        console.log('[UIManager] initWeChatShare() 微信转发功能初始化完成');
    }

    /**
     * 绑定签到按钮事件
     */
    private bindCheckInButton() {
        console.log('[UIManager] bindCheckInButton() 开始绑定签到按钮');
        
        if (!this.checkInButton) {
            console.error('[UIManager] bindCheckInButton() checkInButton 属性为空，请在编辑器中配置');
            return;
        }
        
        if (!this.checkInButton.node) {
            console.error('[UIManager] bindCheckInButton() checkInButton.node 为空');
            return;
        }

        console.log('[UIManager] bindCheckInButton() 签到按钮节点:', this.checkInButton.node.name);
        console.log('[UIManager] bindCheckInButton() 签到按钮位置:', this.checkInButton.node.position);
        console.log('[UIManager] bindCheckInButton() 签到按钮激活状态:', this.checkInButton.node.active);
        console.log('[UIManager] bindCheckInButton() 签到按钮父节点:', this.checkInButton.node.parent ? this.checkInButton.node.parent.name : 'null');

        // 确保签到按钮在最上层（不被遮挡）
        const canvas = find('Canvas');
        if (canvas) {
            // 将签到按钮移到Canvas的最上层
            this.checkInButton.node.setParent(canvas);
            this.checkInButton.node.setSiblingIndex(canvas.children.length - 1);
            
            // Y坐标往下移动100像素
            const currentPos = this.checkInButton.node.position;
            this.checkInButton.node.setPosition(currentPos.x - 20 , currentPos.y - 150, currentPos.z);
            console.log('[UIManager] bindCheckInButton() 签到按钮已移到Canvas最上层，层级索引:', canvas.children.length - 1);
            console.log('[UIManager] bindCheckInButton() 签到按钮新位置:', this.checkInButton.node.position);
        }

        // 检查 Sprite 组件
        const sprite = this.checkInButton.node.getComponent(Sprite);
        if (sprite) {
            console.log('[UIManager] bindCheckInButton() Sprite 组件存在');
            console.log('[UIManager] bindCheckInButton() SpriteFrame:', sprite.spriteFrame ? sprite.spriteFrame.name : 'null');
            console.log('[UIManager] bindCheckInButton() Sprite color:', sprite.color);
        } else {
            console.warn('[UIManager] bindCheckInButton() 签到按钮没有 Sprite 组件');
        }

        // 检查 UIOpacity 组件
        const opacity = this.checkInButton.node.getComponent(UIOpacity);
        if (opacity) {
            console.log('[UIManager] bindCheckInButton() UIOpacity:', opacity.opacity);
        }

        // 检查 UITransform 组件
        const uiTransform = this.checkInButton.node.getComponent(UITransform);
        if (uiTransform) {
            console.log('[UIManager] bindCheckInButton() UITransform 尺寸:', uiTransform.width, 'x', uiTransform.height);
        }

        // 绑定点击事件
        this.checkInButton.node.on(Button.EventType.CLICK, () => {
            console.log('[UIManager] 签到按钮被点击！');
            this.onCheckInButtonClick();
        }, this);

        // 更新签到按钮状态
        this.updateCheckInButtonState();

        console.log('[UIManager] bindCheckInButton() 签到按钮事件已绑定');
    }

    /**
     * 签到按钮点击事件
     */
    private onCheckInButtonClick() {
        console.log('[UIManager] onCheckInButtonClick() 签到按钮点击事件触发');
        
        const checkInManager = CheckInManager.getInstance();
        console.log('[UIManager] onCheckInButtonClick() CheckInManager 实例:', checkInManager);
        
        if (!checkInManager) {
            console.error('[UIManager] onCheckInButtonClick() 无法获取CheckInManager实例');
            GamePopup.showMessage('签到失败，请稍后重试');
            return;
        }

        // 执行签到
        console.log('[UIManager] onCheckInButtonClick() 开始执行签到');
        const result = checkInManager.checkIn();
        console.log('[UIManager] onCheckInButtonClick() 签到结果:', result);

        // 使用 GamePopup 显示提示
        GamePopup.showMessage(result.message);

        if (result.success) {
            // 签到成功，刷新GameManager的等级HUD（如果存在）
            console.log('[UIManager] onCheckInButtonClick() 签到成功');
            
            if (this.gameManager) {
                const gm = this.gameManager as any;
                if (gm.refreshHomeLevelHud) {
                    gm.refreshHomeLevelHud();
                }
            }

            console.log(`[UIManager] 签到成功，获得 ${result.expGained} 点经验值`);
        } else {
            console.log(`[UIManager] 签到失败: ${result.message}`);
        }
    }

    /**
     * 更新签到按钮状态（根据今天是否已签到）
     */
    private updateCheckInButtonState() {
        console.log('[UIManager] updateCheckInButtonState() 开始更新签到按钮状态');
        
        if (!this.checkInButton || !this.checkInButton.node) {
            console.warn('[UIManager] updateCheckInButtonState() 签到按钮不存在');
            return;
        }

        const checkInManager = CheckInManager.getInstance();
        if (!checkInManager) {
            console.warn('[UIManager] updateCheckInButtonState() CheckInManager 不存在');
            return;
        }

        const hasCheckedIn = checkInManager.hasCheckedInToday();
        console.log('[UIManager] updateCheckInButtonState() 今天是否已签到:', hasCheckedIn);

        // 按钮始终可交互，即使已签到也能点击（点击时会提示）
        this.checkInButton.interactable = true;
        console.log('[UIManager] updateCheckInButtonState() 按钮可交互状态设置为: true（始终可点击）');

        // 不改变按钮颜色和透明度，即使已签到也保持正常显示
        const sprite = this.checkInButton.node.getComponent(Sprite);
        if (sprite) {
            sprite.color = new Color(255, 255, 255, 255); // 始终保持正常颜色
            console.log('[UIManager] updateCheckInButtonState() Sprite 颜色保持正常');
        } else {
            console.warn('[UIManager] updateCheckInButtonState() 签到按钮没有 Sprite 组件');
        }

        // 确保透明度始终为255（完全不透明）
        let opacity = this.checkInButton.node.getComponent(UIOpacity);
        if (opacity) {
            opacity.opacity = 255;
            console.log('[UIManager] updateCheckInButtonState() UIOpacity 保持为: 255');
        }
        
        console.log('[UIManager] updateCheckInButtonState() 签到按钮状态更新完成');
    }
}