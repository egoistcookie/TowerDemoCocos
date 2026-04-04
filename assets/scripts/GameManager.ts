import { _decorator, Component, Node, Label, director, find, Graphics, Color, UITransform, view, Sprite, Button, Vec3, resources, SpriteFrame, assetManager, Prefab, instantiate, BlockInputEvents, sys, Texture2D, ImageAsset, Mask, UIOpacity, LabelOutline, AudioSource, tween } from 'cc';
// 微信小游戏全局对象声明（避免 TypeScript 报错）
declare const wx: any;
import { Crystal } from './role/Crystal';
import { UnitIntroPopup } from './UnitIntroPopup';
import { BuffCardPopup, BuffCardData } from './BuffCardPopup';
import { BuffManager } from './BuffManager';
import { UnitConfigManager } from './UnitConfigManager';
import { BuffCardConfigManager } from './BuffCardConfigManager';
import { PlayerDataManager } from './PlayerDataManager';
import { UnitManager } from './UnitManager';
import { UnitPool } from './UnitPool';
import { BuildingPool } from './BuildingPool';
import { GameState } from './GameState';
import { GamePopup } from './GamePopup';
import { DamageStatistics } from './DamageStatistics';
import { ShamanTotem } from './ShamanTotem';
import { WarAncientTree } from './role/WarAncientTree';
import { ForestGridPanel } from './ForestGridPanel';
import { AudioManager } from './AudioManager';
import { SoundManager } from './SoundManager';
import { AnalyticsManager, OperationType } from './AnalyticsManager';
import { PlayerProfilePopup } from './PlayerProfilePopup';
import { WeChatShareManager } from './WeChatShareManager';
const { ccclass, property } = _decorator;

// 重新导出 GameState 以保持向后兼容
export { GameState };

@ccclass('GameManager')
export class GameManager extends Component {
    @property(Node)
    crystal: Node = null!;

    @property(Label)
    healthLabel: Label = null!;

    @property(Label)
    timerLabel: Label = null!;

    @property(Label)
    waveLabel: Label = null!; // 波次标签

    @property(Node)
    gameOverPanel: Node = null!;

    @property(Label)
    gameOverLabel: Label = null!;

    @property(Label)
    goldLabel: Label = null!;

    @property(Label)
    populationLabel: Label = null!; // 人口标签

    @property(Label)
    expLabel: Label = null!; // 经验值标签（游戏结束面板）

    @property(Button)
    exitGameButton: Button = null!; // 退出游戏按钮（ReturnButton）
    private uiManager: any = null!; // UIManager引用
    private gameOverDialog: Node = null!; // 游戏结束弹窗容器
    // 游戏结束时的全屏遮罩，阻止所有点击（类似 UnitIntroMask）
    private gameOverMask: Node | null = null;

    @property(UnitIntroPopup)
    unitIntroPopup: UnitIntroPopup = null!;
    
    @property(BuffCardPopup)
    buffCardPopup: BuffCardPopup = null!;

    private gameState: GameState = GameState.Ready;
    private gameTime: number = 0; // 已防御时间（累积时间，从0开始）
    private crystalScript: Crystal = null!;
    private gold: number = 30; // 初始金币
    private wood: number = 50; // 初始木材（提升到 50）
    private population: number = 0; // 当前人口
    private maxPopulation: number = 10; // 人口上限
    private currentGameExp: number = 0; // 本局游戏获得的经验值
    private playerDataManager: PlayerDataManager = null!;
    private hasShownPopulationLimitWarning: boolean = false; // 是否已显示过人口上限提示
    private hasShownFirstArrowerDeathPopup: boolean = false; // 是否已显示过第一个弓箭手死亡提示
    private hasTriggeredFirstArrowerBowstringMiniGame: boolean = false; // 首个弓箭手“紧弓弦”互动仅触发一次
    private hasTriggeredFirstSwordsmanSharpenMiniGame: boolean = false; // 首个剑士“磨剑”互动仅触发一次
    private hasShownArrowerNeedPriestDialog: boolean = false; // 一局一次：弓箭手受伤且场上无牧师
    private hasShownPriestProtectBuildingDialog: boolean = false; // 一局一次：牧师在场且防御建筑掉血
    private hasShownGoldReach100ArrowerDialog: boolean = false; // 一局一次：金币首次达到100
    private hasShownPriestSuggestSwordsmanAfterKillDialog: boolean = false; // 一局一次：牧师在场且有友方单位被击杀 -> 提示建造剑士
    private hasShownArrowerSuggestBuildWhenWood60: boolean = false; // 一局一次：木材达到60由弓箭手提示多建塔
    private lastDefenseStructureHealthSnapshot: number = -1; // 防御建筑血量快照（用于检测掉血）
    private lastFriendlyUnitCountSnapshot: number = -1; // 友方单位数量快照（用于检测有单位被击杀）
    private lastBattleDialogDebugLogMs: number = 0; // 动态对话调试日志节流
    // A 提示触发后：等待玩家点击建造按钮打开建筑选择面板，再高亮“教堂”候选项
    private pendingHighlightChurchCandidateAfterBuild: boolean = false;
    // D 提示触发后：等待玩家点击建造按钮打开建筑选择面板，再高亮“剑士小屋”候选项
    private pendingHighlightSwordsmanHallCandidateAfterBuild: boolean = false;
    // A 提示的“建造按钮高亮”需要可被玩家点击打断；用 token 来取消未完成的 scheduleOnce
    private buildButtonBattleHintBlinkSeqId: number = 0;
    private buildButtonBattleHintOriginalScale: Vec3 | null = null;
    private buildButtonBattleHintOriginalColor: Color | null = null;
    private buildButtonBattleHintNode: Node | null = null;
    private lastPendingChurchHighlightDebugLogMs: number = 0;
    // 埋点相关
    private analyticsManager: AnalyticsManager | null = null;
    private totalKillCount: number = 0;
    
    // 单位首次出现相关
    private appearedUnitTypes: Set<string> = new Set();
    private hasShownLevel2MageTowerUnlockIntro: boolean = false; // 第2关小精灵介绍后，法师塔解锁介绍仅弹一次
    private hasShownLevel2HunterTornadoAwakenIntro: boolean = false; // 第2关通关后，女猎手龙卷觉醒介绍仅弹一次
    private shownFirstBuffCardLevels: Set<number> = new Set(); // 每关“首次抽卡”标记（用于固定SP卡逻辑）
    private originalTimeScale: number = 1; // 保存原始时间缩放值
    
    // 全局增益卡片图标（在初始化时加载）
    private populationIcon: SpriteFrame | null = null; // 人口增加卡片图标
    private goldIcon: SpriteFrame | null = null; // 金币增加卡片图标
    private orcRageIntroIcon: SpriteFrame | null = null; // 一档：兽人狂暴介绍框固定图标
    private orcRageTier2IntroIcon: SpriteFrame | null = null; // 二档：燃血狂暴介绍框固定图标
    // “紧弓弦”小游戏运行态
    private bowstringMiniGameRoot: Node | null = null;
    private bowstringMiniGameEnergyFill: Graphics | null = null;
    private bowstringMiniGameNeedle: Graphics | null = null;
    private bowstringMiniGameAnimSprite: Sprite | null = null;
    private bowstringMiniGameAnimFrames: SpriteFrame[] = [];
    private bowstringMiniGameHold: boolean = false;
    private bowstringMiniGameCycleTime: number = 0;
    private bowstringMiniGameEnergyValue: number = 0;
    private bowstringMiniGameFinalized: boolean = false;
    private bowstringMiniGameTargetArrower: any = null;
    private bowstringMiniGameRealtimeLoopId: number | null = null;
    private bowstringMiniGameRealtimeLastMs: number = 0;
    private bowstringMiniGameInputEnableAtMs: number = 0;
    private bowstringMiniGameWaitFirstRelease: boolean = false;
    private bowstringMiniGameIgnoreEndUntilMs: number = 0;
    private bowstringMiniGameHasStartedHold: boolean = false;
    private bowstringMiniGameHoldAudioSource: AudioSource | null = null; // 弓弦小游戏长按音效（循环播放）

    // “磨剑”小游戏运行态（剑士：5秒狂点）
    private swordSharpenMiniGameRoot: Node | null = null;
    private swordSharpenMiniGameAnimSprite: Sprite | null = null;
    private swordSharpenMiniGameAnimFrames: SpriteFrame[] = [];
    private swordSharpenMiniGameClickCount: number = 0;
    private swordSharpenMiniGameFinalized: boolean = false;
    private swordSharpenMiniGameEndAtMs: number = 0;
    private swordSharpenMiniGameTargetSwordsman: any = null;
    private swordSharpenMiniGameRealtimeLoopId: number | null = null;
    private swordSharpenMiniGameLastClickAtMs: number = 0;
    private swordSharpenMiniGameInputEnableAtMs: number = 0;
    private swordSharpenMiniGameTimerLabel: Label | null = null;
    private swordSharpenMiniGameClickLabel: Label | null = null;

    // 磨剑“每次点击播放完整一轮序列帧”的播放队列（避免只跳帧）
    private swordSharpenMiniGameAnimPendingCount: number = 0;
    private swordSharpenMiniGameAnimRunning: boolean = false;
    private swordSharpenMiniGameAnimTimeoutId: number | null = null;

    // 到 10 秒后：锁输入 + 延迟到动画队列播放完再做 UI 结算
    private swordSharpenMiniGameShouldFinalizeUIAfterAnim: boolean = false;
    private swordSharpenMiniGameFinalizeClicks: number = 0;
    private swordSharpenMiniGameFinalizeDamageBoostPercent: number = 0;
    private swordSharpenMiniGameFinalizeSpeedBoostPercent: number = 0;
    private swordSharpenMiniGameFinalizeIconToUse: SpriteFrame | null = null;
    
    // 弓弦技能全局冷却（所有弓箭手共享）
    private bowstringSkillGlobalCooldownEndMs: number = 0;
    private bowstringSkillCooldownRefreshLoopId: number | null = null;

    // 磨剑技能全局冷却（所有剑士共享）
    private swordSharpenSkillGlobalCooldownEndMs: number = 0;
    private swordSharpenSkillCooldownRefreshLoopId: number | null = null;
    
    /**
     * 加载全局增益卡片图标资源
     */
    private loadGlobalBuffIcons() {
        // 加载人口增加卡片图标（资源在 assets/resources/textures/icon 目录下）
        // 注意：加载 SpriteFrame 需要添加 /spriteFrame 后缀
        resources.load('textures/icon/PIcon/spriteFrame', SpriteFrame, (err, spriteFrame) => {
            if (err) {
                console.error('[GameManager] 加载人口增加卡片图标失败:', err);
            } else {
                this.populationIcon = spriteFrame;
                //console.info('[GameManager] 人口增加卡片图标加载成功');
            }
        });
        
        // 加载金币增加卡片图标（资源在 assets/resources/textures/icon 目录下）
        // 注意：加载 SpriteFrame 需要添加 /spriteFrame 后缀
        resources.load('textures/icon/GIcon/spriteFrame', SpriteFrame, (err, spriteFrame) => {
            if (err) {
                console.error('[GameManager] 加载金币增加卡片图标失败:', err);
            } else {
                this.goldIcon = spriteFrame;
                //console.info('[GameManager] 金币增加卡片图标加载成功');
            }
        });
    }
    
    // 单位信息属性，用于调试
    @property
    public debugUnitTypes: string[] = [];

    // 分包预制体（prefabs_sub）加载状态
    private prefabsSubLoaded: boolean = false;
    private isLoadingPrefabsSub: boolean = false;

    // 顶部左侧等级 HUD（头像 + 等级文字 + 等级经验条 + 体力条）
    private levelHudNode: Node | null = null;
    private levelLabel: Label | null = null;
    private levelLabelNode: Node | null = null; // 等级标签节点（用于点击）
    private avatarNode: Node | null = null; // 头像节点
    private avatarSprite: Sprite | null = null; // 头像Sprite组件
    private playerNameLabel: Label | null = null; // 玩家名称标签
    private levelExpBarNode: Node | null = null;
    private playerProfilePopup: PlayerProfilePopup | null = null; // 玩家信息编辑弹窗
    private playerName: string = ''; // 当前玩家名称
    private playerAvatar: string = ''; // 当前玩家头像
    // 顶部 HUD 进度条宽度，适当放大（原来 120，整体增加约 20%）
    private levelExpBarMaxWidth: number = 144;
    private levelExpValueLabel: Label | null = null;      // 等级经验条上的数值文字
    private staminaBarNode: Node | null = null;           // 体力条前景节点
    private staminaLabel: Label | null = null;            // 体力条上的数值文字（在条内部）
    private staminaTitleLabel: Label | null = null;       // “体力”标题文字（在体力条上方）
    private staminaCountdownLabel: Label | null = null;   // 体力括号说明（体力已满/xx:xx后恢复）

    // 首页击杀榜标签（位于体力值右侧）
    private killRankLabel: Label | null = null;
    private killRankNode: Node | null = null;
    private killRankFetchInFlight: boolean = false;
    private lastKillRankFetchAt: number = 0;
    private lastKillRankPlayerId: string = '';
    private killRankReqSeq: number = 0;

    // 杀敌排行榜卷轴面板
    private killRankPanelNode: Node | null = null;
    private killRankPanelVisible: boolean = false;
    private killRankCloseOverlayNode: Node | null = null; // 排行榜全屏关闭层

    // 首页杀敌榜缓存（避免出现 "--"）
    private lastKillRankKills: number = 0;
    private lastKillRankSurpassedPercent: number = 0;
    private hasKillRankCache: boolean = false;
    private readonly KILL_RANK_CACHE_KEY = 'tower_kill_rank_cache';

    // 杀敌标签下方提示文字（“点击可查看贡献榜”）
    private killRankHintLabel: Label | null = null;
    // 玩家未设置昵称时的提示标签（显示在等级标签下方，与名称位置一致）
    private playerNameHintLabel: Label | null = null;

    // 首次加载分包/预制体时的全屏加载界面
    private loadingOverlay: Node | null = null;
    private loadingBarNode: Node | null = null;
    private loadingBarMaxWidth: number = 300;
    private loadingLabel: Label | null = null;
    // 加载界面背景轮播（使用 5-8 关背景图轮询播放）
    private loadingBgNode: Node | null = null;
    private loadingBgSprite: Sprite | null = null;
    private loadingBgFrames: (SpriteFrame | null)[] = [];
    private loadingBgIndex: number = 0;
    private loadingBgTimer: number = 0;
    private readonly LOADING_BG_INTERVAL: number = 0.25; // 每张图显示 0.25 秒
    private loadingBgBundleLoading: boolean = false;

    // 游戏内动态背景切换（从 assets/other/backgroundX 文件夹加载）
    private gameBackgroundNode: Node | null = null;
    private gameBackgroundSprite: Sprite | null = null;
    private gameBackgroundFrames: SpriteFrame[] = [];
    private gameBackgroundIndex: number = 0;
    private readonly GAME_BG_INTERVAL: number = 0.33; // 每张图显示 0.5 秒（2fps，即每秒2帧）
    private gameBackgroundActive: boolean = false;
    private gameBackgroundDefaultSprite: SpriteFrame | null = null; // 默认静态背景

    // 结算页等级进度条
    private gameOverLevelBarBg: Node | null = null;
    private gameOverLevelBar: Node | null = null;
    private gameOverLevelLabel: Label | null = null;
    private gameOverLevelBarMaxWidth: number = 260;
    private gameOverLevelBarHeight: number = 20;

    // 失败结算页：激励视频复活（本局仅一次）
    private reviveUsedThisRun: boolean = false; // 本局是否已使用过复活（成功复活后置为true）
    private reviveButtonNode: Node | null = null;
    private reviveButton: Button | null = null;
    private reviveButtonLabel: Label | null = null;
    private reviveVideoAd: any = null; // 微信小游戏激励视频广告实例
    private reviveVideoAdCloseHandler: ((res: any) => void) | null = null;
    private reviveVideoButtonSpriteFrame: SpriteFrame | null = null;
    private reviveVideoButtonSpriteFrameLoading: Promise<SpriteFrame | null> | null = null;

    // 木材 UI 标签（左上角），在场景中通过代码创建并缓存
    private woodLabel: Label | null = null;

    // 树林网格（左右各一块）
    private forestLeftNode: Node | null = null;
    private forestRightNode: Node | null = null;

    /**
     * 微信推荐页相关
     */
    private recommendPageManager: any = null;

    /**
     * 场景加载时，尝试预加载微信推荐页（仅微信小游戏环境生效）
     */
    onLoad() {
        // 仅在微信小游戏环境尝试加载
        // 注意：引擎环境判断与 API 可用性双保险
        try {
            // @ts-ignore
            const isWechat = sys && (sys as any).platform === (sys as any).Platform.WECHAT_GAME;
            const canCreate = typeof wx !== 'undefined' && wx && typeof wx.createPageManager === 'function';
            if (isWechat && canCreate) {
                // 异步预加载，不影响主流程
                this.loadWeChatRecommend().catch(() => { /* ignore */ });
            }
        } catch {
            // ignore
        }
    }

    /**
     * 预加载微信官方推荐页
     */
    private async loadWeChatRecommend() {
        // 运行环境与 API 可用性校验
        // @ts-ignore
        const isWechat = sys && (sys as any).platform === (sys as any).Platform.WECHAT_GAME;
        if (!isWechat) return;
        if (typeof wx === 'undefined' || !wx || typeof wx.createPageManager !== 'function') return;

        try {
            if (!this.recommendPageManager) {
                this.recommendPageManager = wx.createPageManager();
            }
            await this.recommendPageManager.load({
                openlink: 'TWFRCqV5WeM2AkMXhKwJ03MhfPOieJfAsvXKUbWvQFQtLyyA5etMPabBehga950uzfZcH3Vi3QeEh41xRGEVFw',
            });
        } catch (e) {
            console.warn('[WeChatRecommend] load failed:', e);
        }
    }

    /**
     * 展示微信官方推荐页（若未加载则先加载）
     */
    private async showWeChatRecommend() {
        // @ts-ignore
        const isWechat = sys && (sys as any).platform === (sys as any).Platform.WECHAT_GAME;
        if (!isWechat) return;
        if (typeof wx === 'undefined' || !wx || typeof wx.createPageManager !== 'function') return;

        try {
            if (!this.recommendPageManager) {
                await this.loadWeChatRecommend();
            }
            if (this.recommendPageManager && typeof this.recommendPageManager.show === 'function') {
                await this.recommendPageManager.show();
            }
        } catch (e) {
            console.warn('[WeChatRecommend] show failed:', e);
        }
    }
    /**
     * 在结算页创建或更新"升级进度条"，并根据本局战斗的经验变化播放从0到当前进度的动画。
     * @param prevLevel 结算前等级（使用天赋点数量表示等级）
     * @param prevExp   结算前当前等级内的经验（0-99）
     * @param currentLevel 结算后等级
     * @param currentExp   结算后当前等级内的经验（0-99）
     * @param levelsGained 本局提升的等级数
     * @param expGained 本局获得的经验值
     */
    // 是否在结算界面中展示“经验/等级”区域（经验文字 + 等级进度条）
    private showExpSectionInGameOver: boolean = false;

    private createOrUpdateGameOverLevelBar(
        prevLevel: number,
        prevExp: number,
        currentLevel: number,
        currentExp: number,
        levelsGained: number,
        expGained: number = 0
    ) {
        if (!this.gameOverDialog) {
            return;
        }

        // 创建背景条
        if (!this.gameOverLevelBarBg || !this.gameOverLevelBarBg.isValid) {
            this.gameOverLevelBarBg = new Node('GameOverLevelBarBg');
            this.gameOverLevelBarBg.setParent(this.gameOverDialog);

            const bgTransform = this.gameOverLevelBarBg.addComponent(UITransform);
            bgTransform.setContentSize(this.gameOverLevelBarMaxWidth, this.gameOverLevelBarHeight + 8);

            // 放在经验说明文字下方一点（布局函数会整体调整Y）
            this.gameOverLevelBarBg.setPosition(0, -100, 0);

            const bgG = this.gameOverLevelBarBg.addComponent(Graphics);
            bgG.fillColor = new Color(40, 40, 40, 220);
            bgG.roundRect(
                -this.gameOverLevelBarMaxWidth / 2,
                -this.gameOverLevelBarHeight / 2,
                this.gameOverLevelBarMaxWidth,
                this.gameOverLevelBarHeight,
                this.gameOverLevelBarHeight / 2
            );
            bgG.fill();
            bgG.lineWidth = 2;
            bgG.strokeColor = new Color(255, 215, 0, 255);
            bgG.roundRect(
                -this.gameOverLevelBarMaxWidth / 2,
                -this.gameOverLevelBarHeight / 2,
                this.gameOverLevelBarMaxWidth,
                this.gameOverLevelBarHeight,
                this.gameOverLevelBarHeight / 2
            );
            bgG.stroke();

            // 进度条前景
            this.gameOverLevelBar = new Node('GameOverLevelBar');
            this.gameOverLevelBar.setParent(this.gameOverLevelBarBg);
            const barTransform = this.gameOverLevelBar.addComponent(UITransform);
            barTransform.setContentSize(0, this.gameOverLevelBarHeight - 4);
            this.gameOverLevelBar.setPosition(-this.gameOverLevelBarMaxWidth / 2, 0, 0);

            const barG = this.gameOverLevelBar.addComponent(Graphics);
            barG.fillColor = new Color(120, 220, 80, 255);
            // 初始绘制为0宽度，后续会根据UITransform宽度动态更新
            barG.roundRect(0, - (this.gameOverLevelBarHeight - 4) / 2, 0, this.gameOverLevelBarHeight - 4, (this.gameOverLevelBarHeight - 4) / 2);
            barG.fill();

            // 等级文字：例如 "等级 Lv.3 → Lv.5 (+50经验值)"
            const labelNode = new Node('GameOverLevelLabel');
            labelNode.setParent(this.gameOverLevelBarBg);
            this.gameOverLevelLabel = labelNode.addComponent(Label);
            this.gameOverLevelLabel.fontSize = 20;
            this.gameOverLevelLabel.color = new Color(255, 255, 255, 255);
            this.gameOverLevelLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.gameOverLevelLabel.verticalAlign = Label.VerticalAlign.BOTTOM;

            const labelTransform = labelNode.addComponent(UITransform);
            labelTransform.setContentSize(this.gameOverLevelBarMaxWidth, 24);
            // 增加Y坐标间隔，从18改为28
            labelNode.setPosition(0, this.gameOverLevelBarHeight / 2 + 28, 0);
        }

        // 更新等级文字（添加经验值显示）
        const fromLevel = Math.max(1, prevLevel);
        const toLevel = Math.max(1, currentLevel);
        if (this.gameOverLevelLabel) {
            let levelText = '';
            if (fromLevel === toLevel) {
                levelText = `等级 Lv.${toLevel}`;
            } else {
                levelText = `等级 Lv.${fromLevel} → Lv.${toLevel}`;
            }
            // 添加经验值显示
            if (expGained > 0) {
                levelText += ` (+${expGained}经验值)`;
            }
            this.gameOverLevelLabel.string = levelText;
        }

        // 确保进度条存在
        if (!this.gameOverLevelBar || !this.gameOverLevelBar.isValid) {
            return;
        }

        const barTransform = this.gameOverLevelBar.getComponent(UITransform);
        const barG = this.gameOverLevelBar.getComponent(Graphics);
        if (!barTransform || !barG) {
            return;
        }

        // 更新进度条Graphics绘制的辅助方法
        const updateBarGraphics = (width: number) => {
            barG.clear();
            if (width > 0) {
                barG.fillColor = new Color(120, 220, 80, 255);
                barG.roundRect(0, - (this.gameOverLevelBarHeight - 4) / 2, width, this.gameOverLevelBarHeight - 4, (this.gameOverLevelBarHeight - 4) / 2);
                barG.fill();
            }
        };

        // 先重置为0宽度，再播放动画
        barTransform.setContentSize(0, this.gameOverLevelBarHeight - 4);
        updateBarGraphics(0);

        const totalLevelsGained = Math.max(0, levelsGained);
        const finalExpRatio = Math.max(0, Math.min(1, currentExp / 100));

        // 如果没有获得经验，只显示静态进度
        if (this.currentGameExp <= 0 || (totalLevelsGained === 0 && prevLevel === currentLevel && prevExp === currentExp)) {
            const ratio = finalExpRatio;
            const finalWidth = this.gameOverLevelBarMaxWidth * ratio;
            barTransform.setContentSize(finalWidth, this.gameOverLevelBarHeight - 4);
            updateBarGraphics(finalWidth);
            return;
        }

        // 播放多级升级动画：每级一次"拉满"效果，最后一段拉到当前经验
        const singleDuration = 0.4; // 每次拉满的时间

        const playFill = (targetRatio: number, onComplete?: () => void) => {
            let elapsed = 0;
            const startWidth = barTransform.width;
            const targetWidth = this.gameOverLevelBarMaxWidth * targetRatio;

            const step = (dt: number) => {
                elapsed += dt;
                const t = Math.min(1, elapsed / singleDuration);
                const width = startWidth + (targetWidth - startWidth) * t;
                barTransform.setContentSize(width, this.gameOverLevelBarHeight - 4);
                // 每次更新宽度时，重新绘制Graphics
                updateBarGraphics(width);
                if (t >= 1) {
                    this.unschedule(step);
                    if (onComplete) {
                        onComplete();
                    }
                }
            };

            this.schedule(step, 0);
        };

        // 动画序列
        let remainingLevels = totalLevelsGained;

        const playSequence = () => {
            if (remainingLevels > 0) {
                // 对每一个完整升级，进度条从0拉满
                barTransform.setContentSize(0, this.gameOverLevelBarHeight - 4);
                updateBarGraphics(0);
                playFill(1, () => {
                    remainingLevels--;
                    playSequence();
                });
            } else {
                // 最后一段：从0拉到当前经验进度
                barTransform.setContentSize(0, this.gameOverLevelBarHeight - 4);
                updateBarGraphics(0);
                playFill(finalExpRatio);
            }
        };

        playSequence();
    }

    /**
     * 初始化失败结算页激励视频广告（复活用）
     * 逻辑参考 BuffCardPopup.ts
     */
    private initReviveVideoAd() {
        const wxObj = (window as any).wx;
        if (wxObj && wxObj.createRewardedVideoAd) {
            try {
                this.reviveVideoAd = wxObj.createRewardedVideoAd({
                    adUnitId: 'adunit-e4a8d497181fe16d'
                });
                this.reviveVideoAd.onLoad(() => {
                    console.log('[GameManager] 复活激励视频广告加载成功');
                });
                this.reviveVideoAd.onError((err: any) => {
                    console.error('[GameManager] 复活激励视频广告错误:', err);
                });
            } catch (error) {
                console.error('[GameManager] 创建复活激励视频广告失败:', error);
                this.reviveVideoAd = null;
            }
        } else {
            console.warn('[GameManager] 不在微信小游戏环境中，无法创建复活激励视频广告');
            this.reviveVideoAd = null;
        }
    }

    /**
     * 懒加载并缓存“看视频”按钮背景（assets/resources/textures/icon/video.png）
     */
    private loadReviveVideoButtonSpriteFrame(): Promise<SpriteFrame | null> {
        if (this.reviveVideoButtonSpriteFrame) return Promise.resolve(this.reviveVideoButtonSpriteFrame);
        if (this.reviveVideoButtonSpriteFrameLoading) return this.reviveVideoButtonSpriteFrameLoading;

        const path = 'textures/icon/video/spriteFrame';
        this.reviveVideoButtonSpriteFrameLoading = new Promise((resolve) => {
            resources.load(path, SpriteFrame, (err, sf) => {
                this.reviveVideoButtonSpriteFrameLoading = null;
                if (err) {
                    console.error('[GameManager] resources.load 失败:', path, err);
                    resolve(null);
                    return;
                }
                this.reviveVideoButtonSpriteFrame = sf;
                resolve(sf);
            });
        });
        return this.reviveVideoButtonSpriteFrameLoading;
    }

    private applyReviveVideoButtonBg(buttonNode: Node) {
        this.loadReviveVideoButtonSpriteFrame()
            .then((sf) => {
                if (!sf || !buttonNode || !buttonNode.isValid) return;
                const sp = buttonNode.getComponent(Sprite);
                if (!sp || !sp.isValid) return;
                sp.spriteFrame = sf;
            })
            .catch((err) => {
                console.warn('[GameManager] 加载复活视频按钮背景失败', err);
            });
    }

    /**
     * 显示激励视频广告（复活用）
     */
    private showReviveVideoAd(onSuccess: () => void, onFail?: () => void) {
        if (!this.reviveVideoAd) {
            console.warn('[GameManager] 复活激励视频广告未初始化，直接执行操作（降级）');
            onSuccess();
            return;
        }

        let isCallbackExecuted = false;
        const executeCallback = (success: boolean) => {
            if (isCallbackExecuted) {
                console.warn('[GameManager] 广告回调已被执行，忽略重复调用');
                return;
            }
            isCallbackExecuted = true;
            if (success) {
                console.log('[GameManager] 复活激励视频广告观看完成');
                onSuccess();
            } else {
                console.log('[GameManager] 复活激励视频广告中途退出');
                if (onFail) onFail();
            }
        };

        // 移除之前的 onClose 监听器（如果存在）
        if (this.reviveVideoAdCloseHandler) {
            if (this.reviveVideoAd.offClose && typeof this.reviveVideoAd.offClose === 'function') {
                this.reviveVideoAd.offClose(this.reviveVideoAdCloseHandler);
            }
        }

        // 创建新的关闭事件处理器
        this.reviveVideoAdCloseHandler = (res: any) => {
            if (res && res.isEnded) {
                executeCallback(true);
            } else {
                executeCallback(false);
            }
        };

        this.reviveVideoAd.onClose(this.reviveVideoAdCloseHandler);

        this.reviveVideoAd.show().catch(() => {
            console.log('[GameManager] 复活广告显示失败，尝试加载后重试');
            this.reviveVideoAd.load()
                .then(() => this.reviveVideoAd.show())
                .catch((err: any) => {
                    console.error('[GameManager] 复活激励视频广告显示失败', err);
                    if (!isCallbackExecuted) {
                        isCallbackExecuted = true;
                        if (onFail) onFail();
                        else onSuccess(); // 默认降级：直接成功
                    }
                });
        });
    }

    private hideReviveButton() {
        if (this.reviveButtonNode && this.reviveButtonNode.isValid) {
            this.reviveButtonNode.active = false;
        }
    }

    /**
     * 在失败结算弹窗中创建/显示复活按钮（本局仅一次）
     */
    private createOrShowReviveButton() {
        if (!this.gameOverDialog || !this.gameOverDialog.isValid) return;
        if (this.reviveUsedThisRun) return;

        if (!this.reviveButtonNode || !this.reviveButtonNode.isValid) {
            const btnNode = new Node('ReviveButton');
            btnNode.setParent(this.gameOverDialog);

            const tr = btnNode.addComponent(UITransform);
            // 默认尺寸先给一个值，后面再根据 RestartButton 尺寸同步
            tr.setContentSize(200, 60);

            const sp = btnNode.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            this.applyReviveVideoButtonBg(btnNode);

            const btn = btnNode.addComponent(Button);
            btnNode.on(Button.EventType.CLICK, this.onReviveClick, this);

            // 文案（白字黑边）
            const labelNode = new Node('ReviveButtonLabel');
            labelNode.setParent(btnNode);
            labelNode.setPosition(0, 0, 0);
            const labelTr = labelNode.addComponent(UITransform);
            labelTr.setContentSize(180, 54);

            const label = labelNode.addComponent(Label);
            // 文案改为两行：“（观看视频）”单独一行
            label.string = '复活一次并清屏\n（观看视频）';
            // 字体略小，避免拥挤
            label.fontSize = 20;
            label.color = new Color(255, 255, 255, 255);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            label.enableOutline = true;
            label.outlineColor = new Color(0, 0, 0, 255);
            label.outlineWidth = 2;

            this.reviveButtonNode = btnNode;
            this.reviveButton = btn;
            this.reviveButtonLabel = label;
        }

        this.reviveButtonNode.active = true;
        this.reviveButtonNode.setSiblingIndex(Number.MAX_SAFE_INTEGER);
    }

    private onReviveClick() {
        if (this.reviveUsedThisRun) return;

        // 防止重复点击
        if (this.reviveButton) {
            (this.reviveButton as any).interactable = false;
        }

        this.showReviveVideoAd(() => {
            this.executeReviveOnce();
        }, () => {
            console.warn('[GameManager] 复活广告观看失败/中途退出，无法复活');
            if (this.reviveButton) {
                (this.reviveButton as any).interactable = true;
            }
        });
    }

    /**
     * 复活一次：恢复游戏进行状态 + 清屏敌人 + 血量回满 + 金币/木材+50
     * 防御计时与波次不重置，继续进行。
     */
    private executeReviveOnce() {
        if (this.reviveUsedThisRun) return;

        // 埋点：复活也算一次操作（游戏结束后 isRecording 已停止，需强制写入并恢复记录）
        try {
            if (this.analyticsManager) {
                const gt = this.getGameTime ? this.getGameTime() : 0;
                this.analyticsManager.recordOperationForce(OperationType.REVIVE, gt, { mode: 'rewarded_video' });
                // 恢复记录状态，使复活后的游戏操作继续被记录
                this.analyticsManager.resumeRecording();
            }
        } catch (e) {
            // 忽略埋点异常
        }

        this.reviveUsedThisRun = true;
        this.hideReviveButton();

        // 关闭结算弹窗与遮罩
        if (this.gameOverDialog && this.gameOverDialog.isValid) this.gameOverDialog.active = false;
        if (this.gameOverPanel && this.gameOverPanel.isValid) this.gameOverPanel.active = false;
        if (this.gameOverMask && this.gameOverMask.isValid) this.gameOverMask.active = false;

        // 清屏：消灭全屏敌人
        const enemiesNode = find('Canvas/Enemies');
        if (enemiesNode && enemiesNode.isValid) {
            const enemies = enemiesNode.children.slice();
            for (const e of enemies) {
                if (e && e.isValid) e.destroy();
            }
        }

        // 水晶回血并重新激活（复用重置逻辑）
        if (this.crystalScript) {
            try {
                (this.crystalScript as any).currentHealth = this.crystalScript.getMaxHealth();
                (this.crystalScript as any).isDestroyed = false;
                if (this.crystal && this.crystal.isValid) {
                    this.crystal.active = true;
                }
            } catch (e) {
                console.warn('[GameManager] 复活重置水晶失败:', e);
            }
        }

        // 资源奖励：在失败前基础上 +50
        this.gold = (this.gold || 0) + 50;
        this.wood = (this.wood || 0) + 50;

        // 恢复游戏状态并继续计时/波次
        this.setInGameUIVisible(true);
        this.updateUI();
        this.resumeGame();
    }
    
    // 自动创建UnitIntroPopup
    private autoCreateUnitIntroPopup() {
        if (this.unitIntroPopup) {
            return;
        }
        
        
        // 添加Canvas节点作为容器（如果没有的话）
        let canvas = find('Canvas');
        if (!canvas) {
            canvas = new Node('Canvas');
            const scene = director.getScene();
            if (scene) {
                canvas.setParent(scene);
            }
        }
        
        // 创建完整的UI结构
        const containerNode = new Node('container');
        containerNode.setParent(canvas);
        
        // 获取Canvas的实际尺寸
        const canvasTransform = canvas.getComponent(UITransform);
        const screenWidth = canvasTransform?.width || 750;
        const screenHeight = canvasTransform?.height || 1334;
        
        // 设置容器尺寸为屏幕下方三分之一
        const popupHeight = screenHeight / 3;
        
        // 左右与边框保持50像素间隔，所以容器宽度 = 屏幕宽度 - 100
        const popupWidth = screenWidth - 100;
        
        // 添加UITransform组件以设置尺寸
        const uiTransform = containerNode.addComponent(UITransform);
        uiTransform.setContentSize(popupWidth, popupHeight);
        
        // 设置容器的锚点为底部中心
        uiTransform.setAnchorPoint(0.5, 0);
        
        // 设置容器位置，使其底部与屏幕底部对齐
        containerNode.setPosition(0, 0, 0);
        
        // 检查节点状态（在绘制 Graphics 之前）
        //console.info('[GameManager] UnitIntroPopup Graphics 创建前：containerNode.active=', containerNode.active);
        //console.info('[GameManager] UnitIntroPopup Graphics 创建前：containerNode.isValid=', containerNode.isValid);
        //console.info('[GameManager] UnitIntroPopup Graphics 创建前：containerNode.parent=', containerNode.parent?.name);
        //console.info('[GameManager] UnitIntroPopup Graphics 创建前：containerNode.parent.active=', containerNode.parent?.active);
        
        // 设置容器颜色和透明度
        const containerGraphics = containerNode.addComponent(Graphics);
        containerGraphics.fillColor = new Color(0, 0, 0, 200);
        
        // 圆角半径
        const cornerRadius = 15;
        
        // 绘制半透明黑色背景（圆角矩形）
        //console.info('[GameManager] UnitIntroPopup 开始绘制背景，containerNode.active=', containerNode.active);
        containerGraphics.roundRect(-popupWidth / 2, -popupHeight / 2, popupWidth, popupHeight, cornerRadius);
        containerGraphics.fill();
        
        // 添加高亮边框（圆角矩形）
        containerGraphics.strokeColor = new Color(100, 200, 255, 255); // 亮蓝色边框
        containerGraphics.lineWidth = 3;
        containerGraphics.roundRect(-popupWidth / 2, -popupHeight / 2, popupWidth, popupHeight, cornerRadius);
        containerGraphics.stroke();
        
        //console.info('[GameManager] UnitIntroPopup Graphics 绘制完成，containerNode.active=', containerNode.active);
        //console.info('[GameManager] UnitIntroPopup Graphics 绘制完成，containerGraphics.enabled=', containerGraphics.enabled);
        
        // 计算左右区域的宽度和位置（使用调整后的popupWidth）
        const halfWidth = popupWidth / 2;
        
        // 创建左侧单位图片区域
        const iconNode = new Node('unitIcon');
        iconNode.setParent(containerNode);
        // 左侧区域中心位置：相对于容器中心向左偏移halfWidth/2
        iconNode.setPosition(-halfWidth / 2, 0, 0);
        const iconTransform = iconNode.addComponent(UITransform);
        // 左侧区域尺寸：宽度为halfWidth的80%，高度为popupHeight的80%
        iconTransform.setContentSize(halfWidth * 0.8, popupHeight * 0.8);
        const iconSprite = iconNode.addComponent(Sprite);
        iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        
        // 创建右侧介绍区域
        const contentNode = new Node('content');
        contentNode.setParent(containerNode);
        // 右侧区域中心位置：相对于容器中心向右偏移halfWidth/2
        contentNode.setPosition(halfWidth / 2, 0, 0);
        const contentTransform = contentNode.addComponent(UITransform);
        // 右侧区域尺寸：宽度为halfWidth，高度为popupHeight
        contentTransform.setContentSize(halfWidth, popupHeight);
        
        // 创建单位名称节点（右侧区域顶部）
        const nameNode = new Node('unitName');
        nameNode.setParent(contentNode);
        nameNode.setPosition(0, popupHeight / 2 - 50, 0);
        const nameLabel = nameNode.addComponent(Label);
        nameLabel.string = '单位名称';
        nameLabel.fontSize = 32;
        nameLabel.color = new Color(255, 255, 255, 255);
        nameLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        
        // 创建单位描述节点（右侧区域中部）
        const descNode = new Node('unitDescription');
        descNode.setParent(contentNode);
        descNode.setPosition(0, 0, 0);
        const descLabel = descNode.addComponent(Label);
        descLabel.string = '单位描述';
        descLabel.fontSize = 24;
        descLabel.color = new Color(255, 255, 255, 255);
        descLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
        descLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        descLabel.verticalAlign = Label.VerticalAlign.TOP;
        const descTransform = descNode.addComponent(UITransform);
        descTransform.setContentSize(halfWidth * 0.9, popupHeight * 0.6);
        
        // 创建关闭按钮节点（右上角）
        const closeNode = new Node('closeButton');
        closeNode.setParent(containerNode);
        // 右上角位置：相对于容器中心，向右偏移popupWidth/2 - 30，向上偏移popupHeight/2 - 30
        closeNode.setPosition(popupWidth / 2 - 30, popupHeight / 2 - 30, 0);
        const closeButton = closeNode.addComponent(Button);
        const closeTransform = closeNode.addComponent(UITransform);
        closeTransform.setContentSize(50, 50);
        
        // 添加关闭按钮背景
        const closeGraphics = closeNode.addComponent(Graphics);
        closeGraphics.fillColor = new Color(200, 50, 50, 255);
        closeGraphics.circle(0, 0, 25);
        closeGraphics.fill();
        
        // 添加关闭按钮边框
        closeGraphics.strokeColor = new Color(255, 255, 255, 255);
        closeGraphics.lineWidth = 2;
        closeGraphics.circle(0, 0, 25);
        closeGraphics.stroke();
        
        // 添加UnitIntroPopup组件到container节点
        const unitIntroPopup = containerNode.addComponent(UnitIntroPopup);
        
        // 设置组件属性
        unitIntroPopup.container = containerNode;
        unitIntroPopup.unitIcon = iconSprite;
        unitIntroPopup.unitName = nameLabel;
        unitIntroPopup.unitDescription = descLabel;
        unitIntroPopup.closeButton = closeButton;
        
        // 设置到GameManager的属性
        this.unitIntroPopup = unitIntroPopup;
        
    }

    /**
     * 自动创建波次标签（如果不存在）
     */
    private autoCreateWaveLabel() {
        // 如果已经有波次标签，直接返回
        if (this.waveLabel && this.waveLabel.node && this.waveLabel.node.isValid) {
            return;
        }

        // 尝试查找已存在的波次标签节点
        const existingWaveLabel = find('Canvas/UI/WaveLabel') || find('Canvas/WaveLabel') || find('WaveLabel');
        if (existingWaveLabel) {
            this.waveLabel = existingWaveLabel.getComponent(Label);
            if (!this.waveLabel) {
                this.waveLabel = existingWaveLabel.addComponent(Label);
            }
            return;
        }

        // 如果没有timerLabel，无法确定位置，直接返回
        if (!this.timerLabel || !this.timerLabel.node || !this.timerLabel.node.isValid) {
            console.warn('[GameManager] autoCreateWaveLabel: timerLabel不存在，无法创建波次标签');
            return;
        }

        // 创建波次标签节点，放在timerLabel的下方
        const waveLabelNode = new Node('WaveLabel');
        const timerParent = this.timerLabel.node.parent;
        if (timerParent) {
            waveLabelNode.setParent(timerParent);
        } else {
            const canvas = find('Canvas');
            if (canvas) {
                waveLabelNode.setParent(canvas);
            } else {
                console.warn('[GameManager] autoCreateWaveLabel: 无法找到Canvas节点');
                return;
            }
        }

        // 添加UITransform组件
        const uiTransform = waveLabelNode.addComponent(UITransform);
        const timerTransform = this.timerLabel.node.getComponent(UITransform);
        if (timerTransform) {
            uiTransform.setContentSize(timerTransform.width, timerTransform.height);
        } else {
            uiTransform.setContentSize(200, 30);
        }

        // 添加Label组件
        const waveLabel = waveLabelNode.addComponent(Label);
        waveLabel.string = '当前波次: --';
        waveLabel.fontSize = this.timerLabel.fontSize || 24;
        waveLabel.color = new Color(255, 255, 255, 255); // 白色字体
        waveLabel.horizontalAlign = this.timerLabel.horizontalAlign;
        waveLabel.verticalAlign = this.timerLabel.verticalAlign;
        
        // 添加黑色描边效果
        waveLabel.enableOutline = true;
        waveLabel.outlineColor = new Color(0, 0, 0, 255); // 黑色描边
        waveLabel.outlineWidth = 2; // 描边宽度

        // 为timerLabel也添加黑色描边效果
        if (this.timerLabel) {
            this.timerLabel.color = new Color(255, 255, 255, 255); // 白色字体
            this.timerLabel.enableOutline = true;
            this.timerLabel.outlineColor = new Color(0, 0, 0, 255); // 黑色描边
            this.timerLabel.outlineWidth = 2; // 描边宽度
        }

        // 调整timerLabel的位置：向左移动20像素
        const timerPos = this.timerLabel.node.position.clone();
        this.timerLabel.node.setPosition(timerPos.x - 20, timerPos.y, timerPos.z);

        // 设置波次标签位置：在timerLabel下方30像素（timerLabel已经向左移动了20像素）
        const newTimerPos = this.timerLabel.node.position.clone();
        waveLabelNode.setPosition(newTimerPos.x, newTimerPos.y - 30, newTimerPos.z);

        // 保存引用
        this.waveLabel = waveLabel;

      //console.log('[GameManager] 已自动创建波次标签，并调整了时间标签和波次标签的位置');
    }

    start() {
        // 初始化单位管理器（性能优化）
        this.initializeUnitManager();
        this.initializeUnitPool();
        this.initializeBuildingPool();
        
        // 加载单位配置
        const configManager = UnitConfigManager.getInstance();
        configManager.loadConfig().then(() => {
        }).catch((err) => {
        });
        
        // 加载增益卡片配置
        const buffCardConfigManager = BuffCardConfigManager.getInstance();
        buffCardConfigManager.loadConfig().then(() => {
        }).catch((err) => {
        });
        
        // 加载全局增益卡片图标资源
        this.loadGlobalBuffIcons();
        
        // 初始化玩家数据管理器
        this.playerDataManager = PlayerDataManager.getInstance();
        this.playerDataManager.loadData().then(() => {
        }).catch((err) => {
        });
        
        // 查找UIManager
        const uiManagerNode = find('UIManager') || find('UI/UIManager') || find('Canvas/UI/UIManager');
        if (uiManagerNode) {
            this.uiManager = uiManagerNode.getComponent('UIManager');
        }

        // 初始化埋点管理器（场景中挂载的 AnalyticsManager 组件）
        this.analyticsManager = null;
        this.totalKillCount = 0;
        // 优先通过节点名查找（Canvas 下的 AnalyticsManager 节点）
        let analyticsNode = find('Canvas/AnalyticsManager') || find('AnalyticsManager');
        if (analyticsNode) {
            let analyticsComp = analyticsNode.getComponent(AnalyticsManager) as AnalyticsManager | null;
            if (!analyticsComp) {
                // 兼容通过字符串方式挂载脚本的情况
                analyticsComp = analyticsNode.getComponent('AnalyticsManager') as any;
            }
            if (analyticsComp) {
                this.analyticsManager = analyticsComp;
              //console.log('[GameManager] AnalyticsManager 已初始化并绑定 (via node search)');
            } else {
                console.warn('[GameManager] 找到 AnalyticsManager 节点，但未能获取组件实例');
            }
        } else {
            console.warn('[GameManager] 场景中未找到 AnalyticsManager 节点，埋点功能被禁用');
        }
        
        // 每次游戏开始时清空已出现单位类型集合
        this.appearedUnitTypes.clear();
        this.shownFirstBuffCardLevels.clear();
        this.hasShownLevel2MageTowerUnlockIntro = false;
        this.hasShownLevel2HunterTornadoAwakenIntro = false;
        this.debugUnitTypes = [];
        this.hasShownArrowerNeedPriestDialog = false;
        this.hasShownPriestProtectBuildingDialog = false;
        this.hasShownGoldReach100ArrowerDialog = false;
        this.hasShownPriestSuggestSwordsmanAfterKillDialog = false;
        this.hasShownArrowerSuggestBuildWhenWood60 = false;
        this.lastDefenseStructureHealthSnapshot = -1;
        this.lastFriendlyUnitCountSnapshot = -1;
        
        // 重置本局经验值
        this.currentGameExp = 0;

        // 每局开始时重置“复活一次”状态
        this.reviveUsedThisRun = false;
        // 初始化失败结算页激励视频广告（微信环境下）
        this.initReviveVideoAd();
        
        // 显式将游戏状态设置为Ready，确保游戏开始前处于准备状态
        this.gameState = GameState.Ready;
        
        // 增强水晶节点查找逻辑
        if (!this.crystal) {
            // 尝试多种路径查找水晶节点
            const crystalPaths = [
                'Crystal',
                'Canvas/Crystal',
                'Units/Crystal',
                'GameWorld/Crystal',
                'World/Crystal',
                'Map/Crystal'
            ];
            
            for (const path of crystalPaths) {
                const foundCrystal = find(path);
                if (foundCrystal) {
                    this.crystal = foundCrystal;
                    break;
                }
            }
            
            if (!this.crystal) {
                return;
            }
        }
        
        
        this.crystalScript = this.crystal.getComponent(Crystal);
        // 监听水晶销毁事件
        if (this.crystalScript) {
            Crystal.getEventTarget().on('crystal-destroyed', this.onCrystalDestroyed, this);
        } else {
        }
        if (this.gameOverPanel) {
            this.gameOverPanel.active = false;
            
            // 隐藏退出游戏按钮
            if (this.exitGameButton && this.exitGameButton.node) {
                this.exitGameButton.node.active = false;
            }
            
            // 隐藏弹窗
            if (this.gameOverDialog) {
                this.gameOverDialog.active = false;
            }
        }
        
        // 自动创建单位介绍弹窗
        this.autoCreateUnitIntroPopup();
        
        // 自动创建BuffCardPopup（在游戏开始前就创建好，参考UnitIntroPopup的做法）
        this.autoCreateBuffCardPopup();
        
        // 自动创建波次标签（如果不存在）
        this.autoCreateWaveLabel();
        
        this.updateUI();
        this.tryTriggerBattleDialogs();
        
        // 在游戏开始前隐藏所有游戏主体相关内容
        this.hideGameElements();
        
        // 初始化并显示左上角等级HUD（首页显示）
        this.updateLevelHud();
        
        // 进入首页时加载玩家信息（名称和头像）- 只加载一次
        this.loadPlayerProfile();

        // 创建或查找左上角木材标签（与金币标签放在一起）
        this.initWoodLabel();

        // 在画面下方左右两角创建树林网格并种树
        this.createForestGrids();
    }

    /**
     * 初始化左上角木材标签：放在金币标签附近，显示当前木材数量。
     * 优先复用场景中已有的节点，如果没有则动态创建。
     */
    private initWoodLabel() {
        if (this.woodLabel && this.woodLabel.node && this.woodLabel.node.isValid) {
            // 已经初始化过，则仅更新数值并保持当前显隐状态
            this.woodLabel.string = `${this.wood}`;
            return;
        }

        // 如果场景中已经手动放置了名为 WoodLabel 的节点，则直接复用
        const existingNode = find('Canvas/UI/WoodLabel') ||
                             find('Canvas/WoodLabel') ||
                             find('WoodLabel');
        if (existingNode) {
            this.woodLabel = existingNode.getComponent(Label);
            if (!this.woodLabel) {
                this.woodLabel = existingNode.addComponent(Label);
            }
            this.woodLabel.string = `${this.wood}`;
            // 首页时默认隐藏，等真正开始游戏后再显示
            if (this.woodLabel.node) {
                this.woodLabel.node.active = false;
            }
            return;
        }

        // 否则，在金币标签的父节点下动态创建一个新的木材标签
        if (!this.goldLabel || !this.goldLabel.node || !this.goldLabel.node.isValid) {
            return;
        }

        const goldNode = this.goldLabel.node;
        const parent = goldNode.parent || this.node;
        const woodNode = new Node('WoodLabel');
        woodNode.setParent(parent);

        // 复制金币标签的样式
        const goldTransform = goldNode.getComponent(UITransform);
        const woodTransform = woodNode.addComponent(UITransform);
        if (goldTransform) {
            woodTransform.setContentSize(goldTransform.contentSize);
        }

        const woodLabel = woodNode.addComponent(Label);
        woodLabel.fontSize = this.goldLabel.fontSize;
        woodLabel.color = this.goldLabel.color.clone();
        woodLabel.string = `${this.wood}`;

        // 将木材标签放在金币标签的右侧留一点间距（例如 80 像素）
        const offsetX = 80;
        const goldPos = goldNode.position.clone();
        woodNode.setPosition(goldPos.x + offsetX, goldPos.y, goldPos.z);

        this.woodLabel = woodLabel;
        // 首页时默认隐藏，等真正开始游戏后再显示
        if (this.woodLabel && this.woodLabel.node) {
            this.woodLabel.node.active = false;
        }
    }

    /**
     * 创建两片树林网格（左下角和右下角），用于种植树木
     */
    private createForestGrids() {
        if (this.forestLeftNode && this.forestLeftNode.isValid &&
            this.forestRightNode && this.forestRightNode.isValid) {
            return;
        }

        const canvas = find('Canvas');
        if (!canvas) {
            return;
        }

        // 左侧树林
        if (!this.forestLeftNode || !this.forestLeftNode.isValid) {
            const leftNode = new Node('ForestGridLeft');
            leftNode.setParent(canvas);
            const leftPanel = leftNode.addComponent(ForestGridPanel);
            leftPanel.gridWidth = 6;
            leftPanel.gridHeight = 4;
            leftPanel.cellSize = 50;
            leftPanel.cellSpacing = 0;
            leftPanel.alignRight = false;
            // 首页阶段默认隐藏，等开始游戏后再显示
            leftNode.active = false;
            this.forestLeftNode = leftNode;
        }

        // 右侧树林
        if (!this.forestRightNode || !this.forestRightNode.isValid) {
            const rightNode = new Node('ForestGridRight');
            rightNode.setParent(canvas);
            const rightPanel = rightNode.addComponent(ForestGridPanel);
            rightPanel.gridWidth = 6;
            rightPanel.gridHeight = 4;
            rightPanel.cellSize = 50;
            rightPanel.cellSpacing = 0;
            rightPanel.alignRight = true;
            // 首页阶段默认隐藏，等开始游戏后再显示
            rightNode.active = false;
            this.forestRightNode = rightNode;
        }
    }
    
    /**
     * 初始化单位管理器（性能优化）
     */
    private initializeUnitManager() {
        // 检查是否已存在UnitManager
        let unitManagerNode = find('UnitManager');
        if (!unitManagerNode) {
            // 创建UnitManager节点
            unitManagerNode = new Node('UnitManager');
            const scene = director.getScene();
            if (scene) {
                unitManagerNode.setParent(scene);
            } else {
                // 如果场景不存在，尝试添加到Canvas
                const canvas = find('Canvas');
                if (canvas) {
                    unitManagerNode.setParent(canvas);
                }
            }
            // 添加UnitManager组件
            unitManagerNode.addComponent(UnitManager);
        }
    }
    
    /**
     * 初始化单位对象池（性能优化）
     */
    private initializeUnitPool() {
        // 检查是否已存在UnitPool
        let unitPoolNode = find('UnitPool');
        if (!unitPoolNode) {
            // 创建UnitPool节点
            unitPoolNode = new Node('UnitPool');
            const scene = director.getScene();
            if (scene) {
                unitPoolNode.setParent(scene);
            } else {
                // 如果场景不存在，尝试添加到Canvas
                const canvas = find('Canvas');
                if (canvas) {
                    unitPoolNode.setParent(canvas);
                }
            }
            // 添加UnitPool组件
            unitPoolNode.addComponent(UnitPool);
        }
    }
    
    /**
     * 初始化建筑物对象池（性能优化）
     */
    private initializeBuildingPool() {
        // 检查是否已存在BuildingPool
        let buildingPoolNode = find('BuildingPool');
        if (!buildingPoolNode) {
            // 创建BuildingPool节点
            buildingPoolNode = new Node('BuildingPool');
            const scene = director.getScene();
            if (scene) {
                buildingPoolNode.setParent(scene);
            } else {
                // 如果场景不存在，尝试添加到Canvas
                const canvas = find('Canvas');
                if (canvas) {
                    buildingPoolNode.setParent(canvas);
                }
            }
            // 添加BuildingPool组件
            buildingPoolNode.addComponent(BuildingPool);
        }
    }
    
    /**
     * 在游戏开始前或退出游戏时隐藏所有游戏主体相关内容，但保留底部选区
     */
    hideGameElements() {
        // 隐藏所有游戏元素，包括水晶
        const enemies = find('Enemies');
        if (enemies) {
            enemies.active = false;
        }
        
        const towers = find('Towers');
        if (towers) {
            towers.active = false;
        }
        
        // 退出游戏时隐藏水晶
        if (this.crystal) {
            this.crystal.active = false;
        }
        
        // 隐藏游戏内状态标签：血量 / 计时 / 波次 / 金币 / 人口
        if (this.healthLabel) {
            this.healthLabel.node.active = false;
        }
        if (this.timerLabel) {
            this.timerLabel.node.active = false;
        }
        if (this.waveLabel) {
            this.waveLabel.node.active = false;
        }
        if (this.goldLabel) {
            this.goldLabel.node.active = false;
        }
        if (this.populationLabel) {
            this.populationLabel.node.active = false;
        }
        // 首页隐藏木材标签
        if (this.woodLabel && this.woodLabel.node && this.woodLabel.node.isValid) {
            this.woodLabel.node.active = false;
        }

        // 首页隐藏两片树林网格
        if (this.forestLeftNode && this.forestLeftNode.isValid) {
            this.forestLeftNode.active = false;
        }
        if (this.forestRightNode && this.forestRightNode.isValid) {
            this.forestRightNode.active = false;
        }

        // 停止动态背景切换，恢复静态背景
        this.stopDynamicBackground();

        // 隐藏建造按钮（多种路径兼容）
        const buildButtonNode = find('UI/BuildButton') || find('Canvas/UI/BuildButton') || find('BuildButton');
        if (buildButtonNode) {
            buildButtonNode.active = false;
        }
        // 如果有 UIManager，则通过它再隐藏一遍
        const uiManagerNode = find('UIManager') || find('UI/UIManager') || find('Canvas/UI/UIManager');
        if (uiManagerNode) {
            const uiManager = uiManagerNode.getComponent('UIManager') as any;
            if (uiManager && uiManager.buildButton) {
                uiManager.buildButton.node.active = false;
            }
        }

        // 隐藏宝石首页上的退出游戏按钮
        if (this.exitGameButton && this.exitGameButton.node) {
            this.exitGameButton.node.active = false;
        }

        // 隐藏 Canvas/UI 下的图标：HIcon、GIcon、PIcon
        const uiRoot = find('Canvas/UI') || find('UI');
        if (uiRoot) {
            const hIcon = uiRoot.getChildByName('HIcon');
            if (hIcon) hIcon.active = false;
            const gIcon = uiRoot.getChildByName('GIcon');
            if (gIcon) gIcon.active = false;
            const pIcon = uiRoot.getChildByName('PIcon');
            if (pIcon) pIcon.active = false;
            // 首页隐藏木材图标
            const wIcon = uiRoot.getChildByName('WIcon');
            if (wIcon) wIcon.active = false;
        }

        // LevelHUD 作为 gameMainPanel 的子节点，会自动随着 gameMainPanel 显示隐藏
        // 游戏开始时 gameMainPanel 隐藏，LevelHUD 也会自动隐藏，无需手动更新
        
    }
    
    /**
     * 递归查找整个场景中的水晶节点
     */
    private findCrystalRecursive(node: Node): Node | null {
        // 检查当前节点是否是水晶
        if (node.name.toLowerCase().includes('crystal')) {
            return node;
        }
        
        // 递归检查所有子节点
        for (const child of node.children) {
            const found = this.findCrystalRecursive(child);
            if (found) {
                return found;
            }
        }
        
        return null;
    }
    
    /**
     * 手动构建节点的完整路径
     */
    private getNodePath(node: Node): string {
        let path = node.name;
        let current = node.parent;
        while (current) {
            path = `${current.name}/${path}`;
            current = current.parent;
        }
        return path;
    }
    
    /**
     * 检查并确保节点及其所有父节点都处于激活状态
     */
    private ensureNodeAndParentsActive(node: Node): void {
        let current = node;
        while (current) {
            if (!current.active) {
                current.active = true;
            }
            current = current.parent;
        }
    }
    
    /**
     * 在游戏开始后显示所有游戏主体相关内容
     */
    showGameElements() {
        // 隐藏左上角等级HUD（游戏开始时隐藏，由updateLevelHud根据gameMainPanel状态控制）
        // 这里不需要手动隐藏，updateLevelHud会自动处理
        
        // 显示所有游戏元素
        const enemies = find('Enemies');
        if (enemies) {
            enemies.active = true;
        }
        
        const towers = find('Towers');
        if (towers) {
            towers.active = true;
        }
        
        // 显示水晶 - 基于用户提供的资源位置，水晶位于Canvas/Crystal
        if (!this.crystal) {
            
            // 直接使用用户提供的路径查找水晶
            this.crystal = find('Canvas/Crystal');
            
            if (this.crystal) {
                this.crystalScript = this.crystal.getComponent(Crystal);
                if (this.crystalScript) {
                    Crystal.getEventTarget().on('crystal-destroyed', this.onCrystalDestroyed, this);
                }
            } else {
                // 尝试递归查找作为备用方案
                const scene = director.getScene();
                if (scene) {
                    this.crystal = this.findCrystalRecursive(scene);
                    if (this.crystal) {
                        this.crystalScript = this.crystal.getComponent(Crystal);
                        if (this.crystalScript) {
                            Crystal.getEventTarget().on('crystal-destroyed', this.onCrystalDestroyed, this);
                        }
                    }
                }
            }
        }
        
        // 强制显示水晶节点
        if (this.crystal) {
            
            // 确保水晶节点及其所有父节点都处于激活状态
            this.ensureNodeAndParentsActive(this.crystal);
            
            // 直接设置水晶节点为激活状态
            this.crystal.active = true;
        } else {
            // 最后尝试直接查找并显示，不保存引用
            const directCrystal = find('Canvas/Crystal');
            if (directCrystal) {
                directCrystal.active = true;
            }
        }
        
        // 显示游戏主体相关的标签和按钮
        if (this.healthLabel) {
            this.healthLabel.node.active = true;
        }
        
        if (this.timerLabel) {
            this.timerLabel.node.active = true;
        }
        
        if (this.waveLabel) {
            this.waveLabel.node.active = true;
        }
        
        if (this.goldLabel) {
            this.goldLabel.node.active = true;
        }
        
        if (this.populationLabel) {
            this.populationLabel.node.active = true;
        }

        // 显示木材标签（如果已初始化）
        if (this.woodLabel && this.woodLabel.node && this.woodLabel.node.isValid) {
            this.woodLabel.node.active = true;
        }

        // 显示两片树林网格（如果已创建）
        if (this.forestLeftNode && this.forestLeftNode.isValid) {
            this.forestLeftNode.active = true;
        }
        if (this.forestRightNode && this.forestRightNode.isValid) {
            this.forestRightNode.active = true;
        }
        
        // 显示建造按钮（尝试多种路径）
        const buildButton = find('UI/BuildButton') || find('Canvas/UI/BuildButton') || find('BuildButton');
        if (buildButton) {
            buildButton.active = true;
        } else {
        }
        
        // 查找UIManager并显示建造按钮
        const uiManagerNode = find('UIManager') || find('UI/UIManager') || find('Canvas/UI/UIManager');
        if (uiManagerNode) {
            const uiManager = uiManagerNode.getComponent('UIManager') as any;
            if (uiManager && uiManager.buildButton) {
                uiManager.buildButton.node.active = true;
            }
        }
        
        // 显示所有其他UI元素
        const uiNode = find('UI') || find('Canvas/UI');
        if (uiNode) {
            for (const child of uiNode.children) {
                // 显示所有UI元素，除了特定的隐藏元素
                if (child.name !== 'container' && child.name !== 'GameOverPanel') {
                    child.active = true;
                }
            }

            // 确保木材图标 WIcon 也被显示
            const wIcon = uiNode.getChildByName('WIcon');
            if (wIcon) {
                wIcon.active = true;
            }
        } else {
        }
        
    }
    

    onDestroy() {
        // 移除事件监听
        if (this.crystalScript) {
            Crystal.getEventTarget().off('crystal-destroyed', this.onCrystalDestroyed, this);
        }
    }

    /**
     * 根据当前状态，统一控制游戏内 HUD（血量、时间、金币、人口、图标、建造/退出按钮）的显隐
     * - 仅在 GameState.Playing 时显示
     * - 在首页（Ready）、暂停、结算等状态全部隐藏
     */
    private setInGameUIVisible(visible: boolean) {
        // 优先使用序列化引用
        if (this.healthLabel && this.healthLabel.node.isValid) {
            this.healthLabel.node.active = visible;
        }
        if (this.timerLabel && this.timerLabel.node.isValid) {
            this.timerLabel.node.active = visible;
        }
        if (this.waveLabel && this.waveLabel.node.isValid) {
            this.waveLabel.node.active = visible;
        }
        if (this.goldLabel && this.goldLabel.node.isValid) {
            this.goldLabel.node.active = visible;
        }
        if (this.populationLabel && this.populationLabel.node.isValid) {
            this.populationLabel.node.active = visible;
        }
        // 同步控制木材标签显隐，保持与金币标签一致
        if (this.woodLabel && this.woodLabel.node && this.woodLabel.node.isValid) {
            this.woodLabel.node.active = visible;
        }

        // 注意：exitGameButton 在结算时可能会被移动到 GameOverDialog 作为“结算页退出按钮”
        // 如果它已经不在 HUD（Canvas/UI）下，就不要在这里强制隐藏，否则会导致结算页只剩“重新开始”
        if (this.exitGameButton && this.exitGameButton.node && this.exitGameButton.node.isValid) {
            const parentName = this.exitGameButton.node.parent?.name;
            const isInHud = parentName === 'UI' || parentName === 'Canvas' || parentName === 'Canvas/UI';
            const isInGameOverDialog = parentName === 'GameOverDialog' || this.exitGameButton.node.parent === this.gameOverDialog;
            if (!isInGameOverDialog) {
                this.exitGameButton.node.active = visible;
            }
        }

        // 通过节点路径兜底，确保即使序列化引用未绑定也能正确隐藏
        const uiRoot = find('Canvas/UI') || find('UI');
        if (uiRoot) {
            const names = [
                'HealthLabel',
                'TimerLabel',
                'WaveLabel',
                'GoldLabel',
                'PopulationLabel',
                'HIcon',
                'GIcon',
                'PIcon',
                'BuildButton',
                'ExitGameButton',
                'ReturnButton',
                // 木材相关：标签和图标
                'WoodLabel',
                'WIcon',
            ];
            for (const name of names) {
                const child = uiRoot.getChildByName(name);
                if (child && child.isValid) {
                    child.active = visible;
                }
            }
        }

        // UIManager 中的建造按钮也一起控制
        const uiManagerNode = this.uiManager
            ? (this.uiManager.node as Node | undefined)
            : (find('UIManager') || find('UI/UIManager') || find('Canvas/UI/UIManager'));
        if (uiManagerNode) {
            const uiManager = this.uiManager || (uiManagerNode.getComponent('UIManager') as any);
            if (uiManager && uiManager.buildButton && uiManager.buildButton.node && uiManager.buildButton.node.isValid) {
                uiManager.buildButton.node.active = visible;
            }
        }
    }

    update(deltaTime: number) {
        const isPlaying = this.gameState === GameState.Playing;
        // 统一控制 HUD 显隐：只有战斗中才显示，首页/暂停/结算等都隐藏
        this.setInGameUIVisible(isPlaying);

        // 首页体力倒计时：即使不在 Playing 状态，也需要按秒刷新
        if (!isPlaying) {
            this.updateLevelHud();
            return;
        }

        // 更新已防御时间（累积时间）
        this.gameTime += deltaTime;

        this.updateUI();
        // 战斗中动态对话检测（内部有日志节流）
        this.tryTriggerBattleDialogs();
    }

    /**
     * 获取当前游戏时间（秒），供其他脚本调用（如埋点记录）
     */
    public getGameTime(): number {
        return this.gameTime;
    }

    updateUI() {
        // 更新血量显示
        if (this.healthLabel && this.crystalScript) {
            this.healthLabel.string = `${Math.max(0, Math.floor(this.crystalScript.getHealth()))}`;
        }

        // 更新已防御时间显示
        if (this.timerLabel) {
            const minutes = Math.floor(this.gameTime / 60);
            const seconds = Math.floor(this.gameTime % 60);
            const secondsStr = seconds < 10 ? `0${seconds}` : `${seconds}`;
            this.timerLabel.string = `已防御: ${minutes}:${secondsStr}`;
        }

        // 更新波次显示
        if (this.waveLabel) {
            const enemySpawner = this.findComponentInScene('EnemySpawner') as any;
            if (enemySpawner && enemySpawner.getCurrentWaveNumber && enemySpawner.getTotalWaves) {
                const currentWave = enemySpawner.getCurrentWaveNumber();
                const totalWaves = enemySpawner.getTotalWaves();
                if (totalWaves > 0) {
                    this.waveLabel.string = `当前波次: 第${currentWave}波`;
                } else {
                    this.waveLabel.string = `当前波次: --`;
                }
            } else {
                this.waveLabel.string = `当前波次: --`;
            }
        }

        // 更新金币显示
        if (this.goldLabel) {
            this.goldLabel.string = `${this.gold}`;
        }

        // 更新木材显示
        if (this.woodLabel && this.woodLabel.node && this.woodLabel.node.isValid) {
            this.woodLabel.string = `${this.wood}`;
        }

        // 更新人口显示
        if (this.populationLabel) {
            this.populationLabel.string = `${this.population}/${this.maxPopulation}`;
        }

        // LevelHUD 只在首页显示，游戏进行中（Playing状态）不更新
        // 它会在 start()、showGameResultPanel() 等返回首页时更新
    }

    /**
     * 创建或更新左上角的等级 HUD（头像 + 等级文字 + 经验进度条）
     * 作为 gameMainPanel 的子节点，与上一关/下一关按钮的显示逻辑完全一致
     */
    /**
     * 首页专用：刷新（并在需要时创建）头像/等级/体力 HUD
     * 说明：LevelHUD 作为 gameMainPanel 子节点，显示隐藏由 gameMainPanel 决定；
     * 这里负责确保它在首页能被创建出来并更新内容。
     */
    public refreshHomeLevelHud() {
        this.updateLevelHud();
    }

    private updateLevelHud() {
        // 查找 gameMainPanel（与上一关/下一关按钮的父节点一致）
        const bottomSelectionNode = find('Canvas/BottomSelection');
        let gameMainPanel: Node | null = null;
        if (bottomSelectionNode) {
            gameMainPanel = bottomSelectionNode.getChildByName('GameMainPanel');
        }
        
        if (!gameMainPanel) {
            // 如果 gameMainPanel 不存在，不创建 HUD
            return;
        }

        if (!this.levelHudNode || !this.levelHudNode.isValid) {
            // 创建 HUD 根节点，作为 gameMainPanel 的子节点
            this.levelHudNode = new Node('LevelHUD');
            this.levelHudNode.setParent(gameMainPanel);

            const uiTransform = this.levelHudNode.addComponent(UITransform);
            // 整个 HUD 区域再放大一些，适配更大的头像和进度条
            uiTransform.setContentSize(320, 70);

            // 放到左上角（相对于 gameMainPanel），整体靠近屏幕顶部
            const visibleSize = view.getVisibleSize();
            const offsetX = -visibleSize.width / 2 + 150;
            // 往下移一点，避免贴边
            const offsetY = visibleSize.height / 2 - 60; // 整体再下移 20 像素
            this.levelHudNode.setPosition(offsetX, offsetY, 0);

            // 头像区域（左侧，可点击）
            const avatarNode = new Node('Avatar');
            avatarNode.setParent(this.levelHudNode);
            const avatarTransform = avatarNode.addComponent(UITransform);
            avatarTransform.setContentSize(74, 74);
            avatarNode.setPosition(-100, 0, 0);
            
            // 添加圆形遮罩，用于裁剪头像为圆形/圆角效果
            const avatarMask = avatarNode.addComponent(Mask);
            // 兼容不同版本引擎：优先使用 ELLIPSE，没有则退回 RECT
            const ellipseType = (Mask.Type as any).ELLIPSE;
            const rectType = (Mask.Type as any).RECT;
            avatarMask.type = ellipseType !== undefined ? ellipseType : rectType;
            
            // 使用 Graphics 在遮罩节点上绘制一个圆形，作为遮罩形状和默认背景
            const avatarG = avatarNode.addComponent(Graphics);
            avatarG.fillColor = new Color(80, 80, 80, 255);
            avatarG.circle(0, 0, 30);
            avatarG.fill();
            
            // 创建实际显示头像图片的子节点（会被遮罩裁剪）
            const avatarImageNode = new Node('AvatarImage');
            avatarImageNode.setParent(avatarNode);
            const avatarImageTransform = avatarImageNode.addComponent(UITransform);
            avatarImageTransform.setContentSize(60, 60);
            avatarImageTransform.setAnchorPoint(0.5, 0.5);
            avatarImageNode.setPosition(0, 0, 0);
            // 添加Sprite组件用于显示头像图片
            this.avatarSprite = avatarImageNode.addComponent(Sprite);
            this.avatarSprite.sizeMode = Sprite.SizeMode.CUSTOM;
            
            // 头像可点击（点击遮罩节点）
            const avatarButton = avatarNode.addComponent(Button);
            avatarButton.node.on(Button.EventType.CLICK, this.onAvatarClick, this);
            
            this.avatarNode = avatarNode;

            // 玩家名称标签（放到等级标签下方，Y 与体力括号说明齐平）
            const playerNameNode = new Node('PlayerName');
            playerNameNode.setParent(this.levelHudNode);
            const playerNameTransform = playerNameNode.addComponent(UITransform);
            playerNameTransform.setContentSize(180, 24);
            // 等级标签中心 (-10, 26)，体力括号说明 Y = -38，这里采用 -38，X 与等级标签一致
            playerNameNode.setPosition(-10, -38, 0);
            this.playerNameLabel = playerNameNode.addComponent(Label);
            this.playerNameLabel.string = '';
            this.playerNameLabel.fontSize = 18;
            // 棕色字体
            this.playerNameLabel.color = new Color(160, 110, 60, 255);
            this.playerNameLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.playerNameLabel.verticalAlign = Label.VerticalAlign.CENTER;
            // 黑色描边（使用 Label 自带描边属性，避免 LabelOutline 组件的弃用警告）
            this.playerNameLabel.enableOutline = true;
            this.playerNameLabel.outlineColor = new Color(0, 0, 0, 255);
            this.playerNameLabel.outlineWidth = 2;
            // 名称区域可点击，打开资料编辑弹窗
            const playerNameButton = playerNameNode.addComponent(Button);
            playerNameButton.node.on(Button.EventType.CLICK, this.onLevelLabelClick, this);

            // 未设置昵称时的提示标签（位置与名称一致）
            const playerNameHintNode = new Node('PlayerNameHint');
            playerNameHintNode.setParent(this.levelHudNode);
            const playerNameHintTransform = playerNameHintNode.addComponent(UITransform);
            playerNameHintTransform.setContentSize(220, 24);
            playerNameHintNode.setPosition(-10, -38, 0);
            this.playerNameHintLabel = playerNameHintNode.addComponent(Label);
            this.playerNameHintLabel.string = '（可设置头像和昵称）';
            this.playerNameHintLabel.fontSize = 16;
            this.playerNameHintLabel.color = new Color(200, 180, 140, 255);
            this.playerNameHintLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.playerNameHintLabel.verticalAlign = Label.VerticalAlign.CENTER;
            this.playerNameHintLabel.enableOutline = true;
            this.playerNameHintLabel.outlineColor = new Color(0, 0, 0, 255);
            this.playerNameHintLabel.outlineWidth = 2;
            // 提示文本也可点击，打开资料编辑弹窗
            const playerNameHintButton = playerNameHintNode.addComponent(Button);
            playerNameHintButton.node.on(Button.EventType.CLICK, this.onLevelLabelClick, this);
            // 初始时根据当前名称决定是否显示
            playerNameHintNode.active = !this.playerName || this.playerName.trim().length === 0;

            // 等级文字（可点击）
            const levelLabelNode = new Node('LevelLabel');
            levelLabelNode.setParent(this.levelHudNode);
            this.levelLabelNode = levelLabelNode;
            this.levelLabel = levelLabelNode.addComponent(Label);
            this.levelLabel.string = 'Lv.1';
            this.levelLabel.fontSize = 32;
            this.levelLabel.color = new Color(255, 255, 255, 255);
            this.levelLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
            this.levelLabel.verticalAlign = Label.VerticalAlign.CENTER;

            const levelLabelTransform = levelLabelNode.addComponent(UITransform);
            levelLabelTransform.setContentSize(180, 34);
            levelLabelNode.setPosition(-10, 26, 0);
            
            // 等级标签可点击
            const levelButton = levelLabelNode.addComponent(Button);
            levelButton.node.on(Button.EventType.CLICK, this.onLevelLabelClick, this);

            // 等级经验条背景
            const barBgNode = new Node('LevelExpBarBg');
            barBgNode.setParent(this.levelHudNode);
            const barBgTransform = barBgNode.addComponent(UITransform);
            // 经验条整体高度略增，宽度使用 levelExpBarMaxWidth
            barBgTransform.setContentSize(this.levelExpBarMaxWidth, 24);
            // 放在头像右侧下方一点
            barBgNode.setPosition(-10, -10, 0);

            const bgG = barBgNode.addComponent(Graphics);
            bgG.fillColor = new Color(40, 40, 40, 200);
            bgG.roundRect(-this.levelExpBarMaxWidth / 2, -10, this.levelExpBarMaxWidth, 20, 10);
            bgG.fill();
            bgG.lineWidth = 2;
            bgG.strokeColor = new Color(200, 200, 200, 255);
            bgG.roundRect(-this.levelExpBarMaxWidth / 2, -10, this.levelExpBarMaxWidth, 20, 10);
            bgG.stroke();

            // 等级经验条前景
            const barNode = new Node('LevelExpBar');
            barNode.setParent(barBgNode);
            const barTransform = barNode.addComponent(UITransform);
            // 固定绘制整条宽度，通过缩放来控制进度比例
            barTransform.setAnchorPoint(0, 0.5);
            barTransform.setContentSize(this.levelExpBarMaxWidth, 16);
            barNode.setPosition(-this.levelExpBarMaxWidth / 2, 0, 0);

            const barG = barNode.addComponent(Graphics);
            barG.fillColor = new Color(80, 200, 120, 255);
            barG.roundRect(0, -8, this.levelExpBarMaxWidth, 16, 8);
            barG.fill();

            // 初始缩放为 0，后续根据经验值动态设置
            barNode.setScale(0, 1, 1);

            this.levelExpBarNode = barNode;

            // 等级经验数值（显示在经验条上）
            const levelExpLabelNode = new Node('LevelExpValue');
            levelExpLabelNode.setParent(barBgNode);
            this.levelExpValueLabel = levelExpLabelNode.addComponent(Label);
            this.levelExpValueLabel.string = '0 / 100';
            this.levelExpValueLabel.fontSize = 18;
            this.levelExpValueLabel.color = new Color(255, 255, 255, 255);
            this.levelExpValueLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.levelExpValueLabel.verticalAlign = Label.VerticalAlign.CENTER;
            const levelExpLabelTrans = levelExpLabelNode.addComponent(UITransform);
            levelExpLabelTrans.setContentSize(this.levelExpBarMaxWidth, 24);
            levelExpLabelNode.setPosition(0, 0, 0);

            // 体力条背景（与等级经验条等宽，位于其右侧，x 轴保持 50 像素间距）
            const staminaBgNode = new Node('StaminaBarBg');
            staminaBgNode.setParent(this.levelHudNode);
            const staminaBgTransform = staminaBgNode.addComponent(UITransform);
            staminaBgTransform.setContentSize(this.levelExpBarMaxWidth, 24);
            const staminaBgPosX = -10 + this.levelExpBarMaxWidth + 50; // 等级条中心 x + 半宽 + 50
            staminaBgNode.setPosition(staminaBgPosX, -10, 0);

            const staminaBgG = staminaBgNode.addComponent(Graphics);
            staminaBgG.fillColor = new Color(40, 40, 40, 200);
            staminaBgG.roundRect(-this.levelExpBarMaxWidth / 2, -10, this.levelExpBarMaxWidth, 20, 10);
            staminaBgG.fill();
            staminaBgG.lineWidth = 2;
            staminaBgG.strokeColor = new Color(255, 220, 120, 255);
            staminaBgG.roundRect(-this.levelExpBarMaxWidth / 2, -10, this.levelExpBarMaxWidth, 20, 10);
            staminaBgG.stroke();

            // 体力条前景
            const staminaBarNode = new Node('StaminaBar');
            staminaBarNode.setParent(staminaBgNode);
            const staminaBarTrans = staminaBarNode.addComponent(UITransform);
            staminaBarTrans.setAnchorPoint(0, 0.5);
            staminaBarTrans.setContentSize(this.levelExpBarMaxWidth, 16);
            staminaBarNode.setPosition(-this.levelExpBarMaxWidth / 2, 0, 0);

            const staminaBarG = staminaBarNode.addComponent(Graphics);
            staminaBarG.fillColor = new Color(255, 200, 100, 255);
            staminaBarG.roundRect(0, -8, this.levelExpBarMaxWidth, 16, 8);
            staminaBarG.fill();

            // 初始缩放为 0，后续根据体力动态设置
            staminaBarNode.setScale(0, 1, 1);

            this.staminaBarNode = staminaBarNode;

            // 体力数值（显示在体力条上）
            const staminaValueNode = new Node('StaminaValue');
            staminaValueNode.setParent(staminaBgNode);
            this.staminaLabel = staminaValueNode.addComponent(Label);
            this.staminaLabel.string = '50/50';
            this.staminaLabel.fontSize = 18;
            this.staminaLabel.color = new Color(255, 255, 255, 255);
            this.staminaLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.staminaLabel.verticalAlign = Label.VerticalAlign.CENTER;
            const staminaValueTrans = staminaValueNode.addComponent(UITransform);
            staminaValueTrans.setContentSize(this.levelExpBarMaxWidth, 24);
            staminaValueNode.setPosition(0, 0, 0);

            // 体力括号说明（位于体力条右侧 20 像素）
            const staminaCountdownNode = new Node('StaminaCountdown');
            staminaCountdownNode.setParent(this.levelHudNode);
            this.staminaCountdownLabel = staminaCountdownNode.addComponent(Label);
            this.staminaCountdownLabel.string = '';
            this.staminaCountdownLabel.fontSize = 18;
            this.staminaCountdownLabel.color = new Color(255, 255, 255, 255);
            // 倒计时作为“换行”内容：单独放在体力条下方一行，居中显示
            this.staminaCountdownLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.staminaCountdownLabel.verticalAlign = Label.VerticalAlign.CENTER;
            const staminaCountdownTrans = staminaCountdownNode.addComponent(UITransform);
            staminaCountdownTrans.setContentSize(this.levelExpBarMaxWidth, 24);
            staminaCountdownNode.setPosition(staminaBgPosX, -38, 0);

            // 体力标题（显示在体力进度条上方，类似于 Lv 等级标题）
            const staminaTitleNode = new Node('StaminaTitle');
            staminaTitleNode.setParent(this.levelHudNode);
            this.staminaTitleLabel = staminaTitleNode.addComponent(Label);
            this.staminaTitleLabel.string = '体力';
            // 与 Lv 等级字号保持一致
            this.staminaTitleLabel.fontSize = 32;
            this.staminaTitleLabel.color = new Color(255, 255, 255, 255);
            this.staminaTitleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.staminaTitleLabel.verticalAlign = Label.VerticalAlign.CENTER;
            const staminaTitleTrans = staminaTitleNode.addComponent(UITransform);
            staminaTitleTrans.setContentSize(80, 26);
            staminaTitleNode.setPosition(staminaBgPosX, 26, 0);

            // ============================
            // 击杀榜标签（位于体力条右侧）
            // ============================
            const killRankNode = new Node('KillRankLabel');
            killRankNode.setParent(this.levelHudNode);
            this.killRankNode = killRankNode;

            // 尺寸与样式：小面板 + 一行文字
            const killRankWidth = 280;
            const killRankHeight = 34;
            const killRankTrans = killRankNode.addComponent(UITransform);
            killRankTrans.setContentSize(killRankWidth, killRankHeight);

            // 位置：体力条右侧 30 像素
            const killRankPosX = staminaBgPosX + (this.levelExpBarMaxWidth / 2) + (killRankWidth / 2) + 30;
            killRankNode.setPosition(killRankPosX, -10, 0);

            // 背景（深色圆角 + 边框）
            const killRankBg = killRankNode.addComponent(Graphics);
            killRankBg.fillColor = new Color(40, 40, 40, 200);
            killRankBg.roundRect(-killRankWidth / 2, -killRankHeight / 2, killRankWidth, killRankHeight, 10);
            killRankBg.fill();
            killRankBg.lineWidth = 2;
            killRankBg.strokeColor = new Color(120, 200, 255, 255);
            killRankBg.roundRect(-killRankWidth / 2, -killRankHeight / 2, killRankWidth, killRankHeight, 10);
            killRankBg.stroke();

            // 文本
            const killRankTextNode = new Node('KillRankText');
            killRankTextNode.setParent(killRankNode);
            const killRankTextTrans = killRankTextNode.addComponent(UITransform);
            killRankTextTrans.setContentSize(killRankWidth, killRankHeight);
            killRankTextNode.setPosition(0, 0, 0);

            this.killRankLabel = killRankTextNode.addComponent(Label);
            this.killRankLabel.string = '杀敌:0  超越0%的指挥官';
            this.killRankLabel.fontSize = 18;
            this.killRankLabel.color = new Color(255, 255, 255, 255);
            this.killRankLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.killRankLabel.verticalAlign = Label.VerticalAlign.CENTER;

            // 使击杀榜标签可点击，打开排行榜卷轴
            const killRankButton = killRankNode.addComponent(Button);
            killRankButton.transition = Button.Transition.SCALE;
            killRankButton.node.on(Button.EventType.CLICK, this.onKillRankClick, this);

            // 在杀敌标签下方增加提示文字：“(点击可查看贡献榜)”，Y 与体力括号说明一致
            const killRankHintNode = new Node('KillRankHint');
            killRankHintNode.setParent(this.levelHudNode);
            const killRankHintTrans = killRankHintNode.addComponent(UITransform);
            killRankHintTrans.setContentSize(killRankWidth, 24);
            killRankHintNode.setPosition(killRankPosX, -38, 0);
            this.killRankHintLabel = killRankHintNode.addComponent(Label);
            this.killRankHintLabel.string = '（点击可查看贡献榜）';
            this.killRankHintLabel.fontSize = 16;
            this.killRankHintLabel.color = new Color(230, 230, 230, 255);
            this.killRankHintLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.killRankHintLabel.verticalAlign = Label.VerticalAlign.CENTER;
        }

        // 注意：playerDataManager 可能还没加载完；先展示默认值，等数据可用后再刷新

        const playerLevel = this.playerDataManager ? this.playerDataManager.getPlayerLevel() : 1;
        const level = Math.max(1, playerLevel); // 使用独立的指挥官等级
        const currentExp = this.playerDataManager ? this.playerDataManager.getExperience() : 0; // 0-99
        const ratio = Math.max(0, Math.min(1, currentExp / 100));

        if (this.levelLabel) {
            this.levelLabel.string = `Lv.${level}`;
        }

        // 更新等级经验条进度和文字
        if (this.levelExpBarNode && this.levelExpBarNode.isValid) {
            // 通过 X 轴缩放控制填充比例
            this.levelExpBarNode.setScale(ratio, 1, 1);
        }
        if (this.levelExpValueLabel) {
            this.levelExpValueLabel.string = `${currentExp} / 100`;
        }

        // 更新体力条和文字
        const stamina = this.playerDataManager ? this.playerDataManager.getStamina() : 0;
        const staminaRatio = Math.max(0, Math.min(1, stamina / 50));
        if (this.staminaBarNode && this.staminaBarNode.isValid) {
            // 通过 X 轴缩放控制填充比例
            this.staminaBarNode.setScale(staminaRatio, 1, 1);
        }
        if (this.staminaLabel) {
            this.staminaLabel.string = `${stamina}/50`;
        }
        if (this.staminaCountdownLabel) {
            let countdownText = '';
            if (this.playerDataManager) {
                const ms = this.playerDataManager.getMsUntilNextStamina();
                if (ms > 0 && stamina < 50) {
                    const totalSec = Math.ceil(ms / 1000);
                    const mm = Math.floor(totalSec / 60);
                    const ss = totalSec % 60;
                    const ssStr = ss < 10 ? `0${ss}` : `${ss}`;
                    countdownText = `（${mm}:${ssStr}后恢复）`;
                } else {
                    countdownText = `（体力已满）`;
                }
            }
            this.staminaCountdownLabel.string = countdownText;
        }

        // 更新首页击杀榜标签（异步，不影响首页展示）
        this.updateHomeKillRankLabel();

        // LevelHUD 作为 gameMainPanel 的子节点，会自动随着 gameMainPanel 的显示隐藏而显示隐藏
        // 无需手动控制 active，与上一关/下一关按钮的显示逻辑完全一致
        // 注意：玩家信息（名称和头像）的加载已移至 start() 和保存回调中，避免频繁查询
    }
    
    /**
     * 头像点击事件
     */
    private onAvatarClick() {
        this.showPlayerProfilePopup();
    }
    
    /**
     * 等级标签点击事件
     */
    private onLevelLabelClick() {
        this.showPlayerProfilePopup();
    }
    
    /**
     * 名称输入框点击事件（调用原生输入框）
     */
    private onNameInputClick() {
        const currentName = this.playerName || '';

        // 1. 微信小游戏环境：使用系统键盘输入名称
        if (sys.platform === sys.Platform.WECHAT_GAME && typeof wx !== 'undefined' && wx.showKeyboard) {
          //console.log('[GameManager] onNameInputClick in WECHAT_GAME, 使用 wx.showKeyboard');

            try {
                wx.showKeyboard({
                    defaultValue: currentName,
                    maxLength: 50,
                    multiple: false,
                    confirmHold: false,
                    confirmType: 'done',
                    success: () => {
                        // 成功弹出键盘后，监听确认事件
                        const handleConfirm = (res: any) => {
                            try {
                                const value = (res && res.value) ? String(res.value) : '';
                                const trimmedName = value.trim().substring(0, 50);
                                if (trimmedName.length > 0) {
                                    if (this.playerProfilePopup && this.playerProfilePopup.nameInputLabel) {
                                        this.playerProfilePopup.nameInputLabel.string = trimmedName;
                                        this.playerProfilePopup.nameInputLabel.color = new Color(255, 255, 255, 255);
                                    }
                                }
                            } finally {
                                // 一次性监听，用完后解绑，避免多次触发
                                if (wx.offKeyboardConfirm) {
                                    wx.offKeyboardConfirm(handleConfirm);
                                }
                            }
                        };

                        if (wx.onKeyboardConfirm) {
                            wx.onKeyboardConfirm(handleConfirm);
                        }
                    },
                    fail: (err: any) => {
                        console.warn('[GameManager] wx.showKeyboard 调用失败:', err);
                    }
                });
            } catch (e) {
                console.error('[GameManager] wx.showKeyboard 调用异常:', e);
            }

            return;
        }

        // 2. 浏览器 / H5 环境：使用原生 prompt 作为简易输入框
        const hasPrompt = typeof window !== 'undefined' && typeof (window as any).prompt === 'function';
        if (!hasPrompt) {
            console.warn('[GameManager] 当前环境不支持 window.prompt，名称输入被忽略');
            return;
        }

        const inputName = (window as any).prompt('请输入玩家名称（最多50个字符）:', currentName);
        if (inputName !== null) {
            const trimmedName = inputName.trim().substring(0, 50);
            if (trimmedName.length > 0) {
                if (this.playerProfilePopup && this.playerProfilePopup.nameInputLabel) {
                    this.playerProfilePopup.nameInputLabel.string = trimmedName;
                    this.playerProfilePopup.nameInputLabel.color = new Color(255, 255, 255, 255);
                }
            }
        }
    }
    
    /**
     * 击杀榜标签点击事件：展开/收起“指挥官贡献榜”卷轴
     */
    private onKillRankClick() {
        if (this.killRankPanelVisible) {
            this.hideKillRankPanel();
        } else {
            this.showKillRankPanel();
        }
    }
    
    /**
     * 创建并显示杀敌排行榜卷轴
     */
    private showKillRankPanel() {
        if (!this.killRankPanelNode || !this.killRankPanelNode.isValid) {
            this.killRankPanelNode = this.createKillRankPanel();
        }
        if (!this.killRankPanelNode) return;

        this.ensureKillRankCloseOverlay();
        if (this.killRankCloseOverlayNode && this.killRankCloseOverlayNode.isValid) {
            this.killRankCloseOverlayNode.active = true;
            this.killRankCloseOverlayNode.setSiblingIndex(Number.MAX_SAFE_INTEGER - 1);
        }
        
        // 直接显示在预设位置（后续如需动画可再精细化）
        this.killRankPanelNode.active = true;
        this.killRankPanelNode.setSiblingIndex(Number.MAX_SAFE_INTEGER);
        this.killRankPanelVisible = true;
        
        // 异步拉取排行榜数据
        this.fetchKillLeaderboard();
    }
    
    /**
     * 收起杀敌排行榜卷轴
     */
    private hideKillRankPanel() {
        if (!this.killRankPanelNode || !this.killRankPanelNode.isValid) {
            this.killRankPanelVisible = false;
            return;
        }
        
        // 简化为直接隐藏，避免位移后下次无法再次显示的问题
        this.killRankPanelNode.active = false;
        if (this.killRankCloseOverlayNode && this.killRankCloseOverlayNode.isValid) {
            this.killRankCloseOverlayNode.active = false;
        }
        this.killRankPanelVisible = false;
    }

    /**
     * 创建排行榜全屏关闭层（点击任意位置关闭）
     */
    private ensureKillRankCloseOverlay() {
        if (this.killRankCloseOverlayNode && this.killRankCloseOverlayNode.isValid) {
            return;
        }
        const canvas = find('Canvas');
        if (!canvas) return;
        const vs = view.getVisibleSize();
        const overlay = new Node('KillRankCloseOverlay');
        overlay.setParent(canvas);
        const tr = overlay.addComponent(UITransform);
        tr.setContentSize(vs.width, vs.height);
        overlay.setPosition(0, 0, 0);
        const g = overlay.addComponent(Graphics);
        g.fillColor = new Color(0, 0, 0, 0);
        g.rect(-vs.width / 2, -vs.height / 2, vs.width, vs.height);
        g.fill();
        overlay.on(Node.EventType.TOUCH_END, () => {
            this.hideKillRankPanel();
        }, this);
        this.killRankCloseOverlayNode = overlay;
    }
    
    /**
     * 创建杀敌排行榜卷轴面板节点
     */
    private createKillRankPanel(): Node | null {
        const canvas = find('Canvas');
        if (!canvas) {
            console.warn('[GameManager] createKillRankPanel: Canvas not found');
            return null;
        }
        
        // 指挥官排行榜整体尺寸：原基础上宽+50、高+100
        const panelWidth = 570;
        const panelHeight = 820;
        
        const panelNode = new Node('KillRankPanel');
        panelNode.setParent(canvas);
        
        const uiTrans = panelNode.addComponent(UITransform);
        uiTrans.setContentSize(panelWidth, panelHeight);
        // 居中显示卷轴，整体向上移动 350 像素
        uiTrans.setAnchorPoint(0.5, 0.5);
        panelNode.setPosition(0, 390, 0);
        // 卷轴内点击任意位置也可关闭（转发按钮会阻断冒泡）
        panelNode.on(Node.EventType.TOUCH_END, () => {
            this.hideKillRankPanel();
        }, this);
        
        // 卷轴背景（上圆下圆 + 中间矩形，偏 parchment 风格）
        const g = panelNode.addComponent(Graphics);
        const bgColor = new Color(245, 230, 200, 240);
        const borderColor = new Color(180, 140, 80, 255);
        const radius = 24;
        const h = panelHeight;
        const w = panelWidth;
        
        g.fillColor = bgColor;
        g.roundRect(-w / 2, -h, w, h, radius);
        g.fill();
        g.lineWidth = 4;
        g.strokeColor = borderColor;
        g.roundRect(-w / 2, -h, w, h, radius);
        g.stroke();
        
        // 标题：指挥官贡献榜
        const titleNode = new Node('KillRankTitle');
        titleNode.setParent(panelNode);
        const titleLabel = titleNode.addComponent(Label);
        titleLabel.string = '指挥官贡献榜';
        titleLabel.fontSize = 30;
        titleLabel.color = new Color(255, 255, 255, 255);
        titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLabel.verticalAlign = Label.VerticalAlign.CENTER;
        // 棕色描边
        titleLabel.enableOutline = true;
        titleLabel.outlineColor = new Color(120, 80, 20, 255);
        titleLabel.outlineWidth = 3;
        const titleTrans = titleNode.addComponent(UITransform);
        titleTrans.setContentSize(panelWidth, 40);
        titleNode.setPosition(0, -50, 0);

        // 右上角分享按钮：点击后主动分享当前“超越百分比”文案
        const shareBtnNode = new Node('KillRankShareButton');
        shareBtnNode.setParent(panelNode);
        const shareBtnTrans = shareBtnNode.addComponent(UITransform);
        shareBtnTrans.setContentSize(55, 55);
        // 该卷轴以“顶部为 y=0、向下为负”的坐标系绘制，因此顶部区域 y 取负值
        shareBtnNode.setPosition(panelWidth / 2 - 50, -50, 0);

        // 使用 resources/textures/icon/zhuanfa.png 对应的 SpriteFrame 作为按钮贴图
        const shareBtnSprite = shareBtnNode.addComponent(Sprite);
        shareBtnSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load('textures/icon/zhuanfa/spriteFrame', SpriteFrame, (err, sf) => {
            if (!err && sf && shareBtnNode.isValid) {
                shareBtnSprite.spriteFrame = sf;
            } else if (err) {
                console.warn('[GameManager] 加载转发按钮贴图失败:', err);
            }
        });

        const shareBtn = shareBtnNode.addComponent(Button);
        shareBtn.transition = Button.Transition.SCALE;
        shareBtnNode.on(Node.EventType.TOUCH_END, (event: any) => {
            // 阻断到 panelNode 的 TOUCH_END 冒泡，避免点击转发时关闭排行榜
            event.propagationStopped = true;
        }, this);
        shareBtn.node.on(Button.EventType.CLICK, this.onKillRankShareClick, this);
        
        // 排行内容容器
        const listNode = new Node('KillRankList');
        listNode.setParent(panelNode);
        const listTrans = listNode.addComponent(UITransform);
        listTrans.setContentSize(panelWidth - 40, panelHeight - 220);
        listTrans.setAnchorPoint(0.5, 1);
        listNode.setPosition(0, -90, 0);
        
        // 底部感谢语
        const footerNode = new Node('KillRankFooter');
        footerNode.setParent(panelNode);
        const footerLabel = footerNode.addComponent(Label);
        footerLabel.string = '感谢指挥官们为守护古树防线而做出的卓越贡献';
        footerLabel.fontSize = 22;
        footerLabel.color = new Color(255, 255, 255, 255);
        footerLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        footerLabel.verticalAlign = Label.VerticalAlign.CENTER;
        // 金色描边
        footerLabel.enableOutline = true;
        footerLabel.outlineColor = new Color(200, 160, 60, 255);
        footerLabel.outlineWidth = 2;
        const footerTrans = footerNode.addComponent(UITransform);
        footerTrans.setContentSize(panelWidth - 40, 40);
        // 保持在卷轴最下方居中，并在原基础上再向下移动 250 像素
        footerNode.setPosition(0, -panelHeight / 2 - 330, 0);
        
        return panelNode;
    }

    /**
     * 排行榜右上角分享按钮：调用现有主动分享方法
     */
    private onKillRankShareClick() {
        const percent = Math.max(0, Math.min(100, this.lastKillRankSurpassedPercent || 0));
        const title = `我超过了${percent.toFixed(1)}%的玩家，快来一起守护防线！`;
        const shareManager = WeChatShareManager.getInstance();
        shareManager.shareAppMessage(title);
    }
    
    /**
     * 从服务器拉取杀敌排行榜前十并填充卷轴
     */
    private async fetchKillLeaderboard() {
        const url = 'https://www.egoistcookie.top/api/analytics/leaderboard/kill-top?limit=10';
        
        return new Promise<void>((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.timeout = 5000;
            
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        try {
                            const resp = JSON.parse(xhr.responseText);
                            if (resp && resp.success && Array.isArray(resp.data)) {
                                this.populateKillRankPanel(resp.data);
                            }
                        } catch (e) {
                            console.error('[GameManager] 解析杀敌排行榜响应失败:', e);
                        }
                    } else {
                        console.warn('[GameManager] 请求杀敌排行榜失败:', xhr.status);
                    }
                    resolve();
                }
            };
            
            xhr.onerror = () => {
                console.error('[GameManager] 请求杀敌排行榜网络错误');
                resolve();
            };
            xhr.ontimeout = () => {
                console.error('[GameManager] 请求杀敌排行榜超时');
                resolve();
            };
            
            xhr.open('GET', url, true);
            xhr.send();
        });
    }
    
    /**
     * 将排行榜数据渲染到卷轴面板
     */
    private populateKillRankPanel(rows: any[]) {
        if (!this.killRankPanelNode || !this.killRankPanelNode.isValid) return;
        const listNode = this.killRankPanelNode.getChildByName('KillRankList');
        if (!listNode) return;
        
        // 清理旧内容
        const children = [...listNode.children];
        for (const c of children) {
            c.destroy();
        }
        
        // 每行稍微加高一点，给三列排版留空间
        const entryHeight = 44;
        let y = -20;
        
        for (let i = 0; i < rows.length && i < 10; i++) {
            const row = rows[i];
            const rank = i + 1;
            const playerId = row.player_id || '';
            const hasName = !!row.player_name;
            const displayName = hasName
                ? row.player_name
                : (playerId.length > 4 ? playerId.slice(-4) : playerId || '未知指挥官');
            const totalKills = row.total_kills || 0;
            const maxLevel = row.max_level || 0;
            const avatar = row.player_avatar || '';
            
            const entryNode = new Node(`Entry_${rank}`);
            entryNode.setParent(listNode);
            const entryTrans = entryNode.addComponent(UITransform);
            entryTrans.setContentSize(listNode.getComponent(UITransform)!.width, entryHeight);
            entryTrans.setAnchorPoint(0.5, 1);
            entryNode.setPosition(0, y, 0);
            y -= entryHeight + 4;
            
            // 背景
            const g = entryNode.addComponent(Graphics);
            let bgColor = new Color(255, 255, 255, 30);
            if (rank === 1) bgColor = new Color(255, 215, 0, 60);       // 金
            else if (rank === 2) bgColor = new Color(205, 127, 50, 60); // 铜
            else if (rank === 3) bgColor = new Color(192, 192, 192, 60); // 银
            g.fillColor = bgColor;
            g.roundRect(-entryTrans.width / 2, -entryHeight, entryTrans.width, entryHeight - 4, 10);
            g.fill();
            
            // 头像（小圆）
            const avatarNode = new Node('Avatar');
            avatarNode.setParent(entryNode);
            const avatarTrans = avatarNode.addComponent(UITransform);
            avatarTrans.setContentSize(32, 32);
            avatarTrans.setAnchorPoint(0.5, 0.5);
            avatarNode.setPosition(-entryTrans.width / 2 + 26, -entryHeight / 2, 0);
            // 背景圆：作为无头像时的占位
            const avatarBgG = avatarNode.addComponent(Graphics);
            avatarBgG.fillColor = new Color(80, 80, 80, 255);
            avatarBgG.circle(0, 0, 16);
            avatarBgG.fill();
            // 实际头像 Sprite 放在子节点，确保在背景之上
            if (avatar && avatar.startsWith('data:image')) {
                const avatarImgNode = new Node('AvatarImage');
                avatarImgNode.setParent(avatarNode);
                const avatarImgTrans = avatarImgNode.addComponent(UITransform);
                avatarImgTrans.setContentSize(32, 32);
                avatarImgTrans.setAnchorPoint(0.5, 0.5);
                avatarImgNode.setPosition(0, 0, 0);
                const avatarSprite = avatarImgNode.addComponent(Sprite);
                avatarSprite.sizeMode = Sprite.SizeMode.CUSTOM;
                this.loadSpriteFromBase64(avatar, avatarSprite);
            }
            
            // 三列文本：昵称 / 杀敌数 / 最大通关，全部左对齐
            const columnsTotalWidth = entryTrans.width - 80; // 去掉头像左侧占位
            const colWidth = columnsTotalWidth / 3;
            const baseLeftX = -entryTrans.width / 2 + 48; // 从头像右侧一点开始

            // 公共函数：创建一列 Label
            const createColumnLabel = (name: string, text: string, colIndex: number) => {
                const node = new Node(name);
                node.setParent(entryNode);
                const label = node.addComponent(Label);
                label.string = text;
                // 字体全部加大一号：原来 18 → 19
                label.fontSize = 19;
                label.color = new Color(255, 255, 255, 255);
                label.enableOutline = true;

                if (rank === 1) {
                    label.outlineColor = new Color(255, 215, 0, 255);
                    label.outlineWidth = 2;
                } else if (rank === 2) {
                    label.outlineColor = new Color(205, 127, 50, 255);
                    label.outlineWidth = 2;
                } else if (rank === 3) {
                    label.outlineColor = new Color(192, 192, 192, 255);
                    label.outlineWidth = 2;
                } else {
                    label.outlineColor = new Color(0, 0, 0, 255);
                    label.outlineWidth = 2;
                }

                label.horizontalAlign = Label.HorizontalAlign.LEFT;
                label.verticalAlign = Label.VerticalAlign.CENTER;

                const trans = node.addComponent(UITransform);
                trans.setContentSize(colWidth, entryHeight);
                trans.setAnchorPoint(0, 0.5);

                const leftX = baseLeftX + colWidth * colIndex;
                node.setPosition(leftX, -entryHeight / 2, 0);
            };

            // 第 0 列：排名 + 昵称
            createColumnLabel('NameLabel', `${rank}. ${displayName}`, 0);
            // 第 1 列：杀敌数
            createColumnLabel('KillLabel', `杀敌 ${totalKills}`, 1);
            // 第 2 列：最大通关数
            createColumnLabel('LevelLabel', `最大通关 ${maxLevel}`, 2);
        }
    }
    
    /**
     * 显示玩家信息编辑弹窗
     */
    private showPlayerProfilePopup() {
        // 创建弹窗（如果不存在）
        if (!this.playerProfilePopup) {
            this.createPlayerProfilePopup();
        }
        
        if (!this.playerProfilePopup) return;
        
        // 获取player_id
        let playerId = '';
        try {
            playerId = sys.localStorage.getItem('player_id') || '';
        } catch (e) {
            console.error('[GameManager] 获取player_id失败:', e);
            return;
        }
        
        if (!playerId) {
            console.warn('[GameManager] player_id为空，无法打开编辑弹窗');
            return;
        }
        
        // 显示弹窗
        this.playerProfilePopup.show(
            playerId,
            this.playerName,
            this.playerAvatar,
            (name: string, avatar: string) => {
                // 保存成功回调
                this.playerName = name;
                this.playerAvatar = avatar;
                this.updatePlayerProfileDisplay();
                // 保存成功后重新从服务器加载玩家信息，确保数据一致性
                this.loadPlayerProfile();
            },
            () => {
                // 取消回调
            }
        );
    }
    
    /**
     * 创建玩家信息编辑弹窗
     */
    private createPlayerProfilePopup() {
        const canvas = find('Canvas');
        if (!canvas) {
            console.error('[GameManager] 找不到Canvas节点');
            return;
        }
        
        // 创建弹窗根节点
        const popupNode = new Node('PlayerProfilePopup');
        popupNode.setParent(canvas);
        popupNode.setPosition(0, 0, 0);
        popupNode.active = false;
        // 确保弹窗显示在最上层
        popupNode.setSiblingIndex(Number.MAX_SAFE_INTEGER);
        
        const popupTransform = popupNode.addComponent(UITransform);
        popupTransform.setContentSize(750, 640);
        popupTransform.setAnchorPoint(0.5, 0.5);
        
        // 添加组件
        this.playerProfilePopup = popupNode.addComponent(PlayerProfilePopup);
        
        // 创建弹窗容器（内容面板）
        const container = new Node('PopupContainer');
        container.setParent(popupNode);
        const containerTransform = container.addComponent(UITransform);
        containerTransform.setContentSize(500, 400);
        containerTransform.setAnchorPoint(0.5, 0.5);
        container.setPosition(0, 0, 0);
        // 确保容器在遮罩之上
        container.setSiblingIndex(1);
        
        // 内容面板背景（增强对比度和亮度）
        const bgG = container.addComponent(Graphics);
        bgG.fillColor = new Color(50, 55, 75, 255); // 提高亮度，增强对比度
        bgG.roundRect(-250, -200, 500, 400, 15);
        bgG.fill();
        bgG.lineWidth = 4; // 增加边框宽度
        bgG.strokeColor = new Color(150, 200, 255, 255); // 更亮的边框色
        bgG.roundRect(-250, -200, 500, 400, 15);
        bgG.stroke();
        
        // 标题
        const titleNode = new Node('Title');
        titleNode.setParent(container);
        const titleLabel = titleNode.addComponent(Label);
        titleLabel.string = '编辑玩家信息';
        titleLabel.fontSize = 28;
        titleLabel.color = new Color(255, 255, 255, 255);
        titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        const titleTransform = titleNode.addComponent(UITransform);
        titleTransform.setContentSize(500, 40);
        titleNode.setPosition(0, 150, 0);
        
        // 头像显示区域（带圆形遮罩）
        const avatarDisplayNode = new Node('AvatarDisplay');
        avatarDisplayNode.setParent(container);
        const avatarDisplayTransform = avatarDisplayNode.addComponent(UITransform);
        avatarDisplayTransform.setContentSize(100, 100);
        avatarDisplayTransform.setAnchorPoint(0.5, 0.5);
        avatarDisplayNode.setPosition(0, 50, 0);
        // 添加圆形遮罩和背景
        const avatarMask = avatarDisplayNode.addComponent(Mask);
        const ellipseType = (Mask.Type as any).ELLIPSE;
        const rectType = (Mask.Type as any).RECT;
        avatarMask.type = ellipseType !== undefined ? ellipseType : rectType;
        const avatarBgG = avatarDisplayNode.addComponent(Graphics);
        avatarBgG.fillColor = new Color(80, 80, 80, 255);
        avatarBgG.circle(0, 0, 50);
        avatarBgG.fill();
        // 实际头像图片节点（被遮罩裁剪）
        const avatarImageNode = new Node('AvatarImage');
        avatarImageNode.setParent(avatarDisplayNode);
        const avatarImageTrans = avatarImageNode.addComponent(UITransform);
        avatarImageTrans.setContentSize(100, 100);
        avatarImageTrans.setAnchorPoint(0.5, 0.5);
        avatarImageNode.setPosition(0, 0, 0);
        const avatarSprite = avatarImageNode.addComponent(Sprite);
        this.playerProfilePopup.avatarSprite = avatarSprite;
        
        // 上传头像按钮
        const uploadBtnNode = new Node('UploadButton');
        uploadBtnNode.setParent(container);
        const uploadBtnTransform = uploadBtnNode.addComponent(UITransform);
        uploadBtnTransform.setContentSize(150, 40);
        uploadBtnTransform.setAnchorPoint(0.5, 0.5);
        uploadBtnNode.setPosition(0, -20, 0);
        // 先添加Graphics背景
        const uploadBtnG = uploadBtnNode.addComponent(Graphics);
        uploadBtnG.fillColor = new Color(80, 120, 200, 255);
        uploadBtnG.roundRect(-75, -20, 150, 40, 8);
        uploadBtnG.fill();
        // 后添加Button组件，确保能接收点击事件
        const uploadBtn = uploadBtnNode.addComponent(Button);
        uploadBtn.transition = Button.Transition.COLOR;
        uploadBtn.normalColor = new Color(255, 255, 255, 255);
        uploadBtn.hoverColor = new Color(200, 200, 255, 255);
        uploadBtn.pressedColor = new Color(150, 150, 255, 255);
        this.playerProfilePopup.uploadAvatarButton = uploadBtn;
        const uploadBtnLabel = new Node('UploadLabel');
        uploadBtnLabel.setParent(uploadBtnNode);
        const uploadLabel = uploadBtnLabel.addComponent(Label);
        uploadLabel.string = '上传头像';
        uploadLabel.fontSize = 20;
        uploadLabel.color = new Color(255, 255, 255, 255);
        uploadLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        const uploadLabelTransform = uploadBtnLabel.addComponent(UITransform);
        uploadLabelTransform.setContentSize(150, 40);
        
        // 名称输入框（使用EditBox）
        const nameInputNode = new Node('NameInput');
        nameInputNode.setParent(container);
        const nameInputTransform = nameInputNode.addComponent(UITransform);
        nameInputTransform.setContentSize(300, 40);
        nameInputTransform.setAnchorPoint(0.5, 0.5);
        nameInputNode.setPosition(0, -80, 0);
        
        // 输入框背景
        const nameInputBg = nameInputNode.addComponent(Graphics);
        nameInputBg.fillColor = new Color(60, 60, 80, 255);
        nameInputBg.roundRect(-150, -20, 300, 40, 8);
        nameInputBg.fill();
        nameInputBg.lineWidth = 2;
        nameInputBg.strokeColor = new Color(150, 150, 200, 255);
        nameInputBg.roundRect(-150, -20, 300, 40, 8);
        nameInputBg.stroke();
        
        // 名称输入Label（简化处理：实际项目中建议使用EditBox或原生输入框）
        // 注意：在Cocos Creator中，文本输入需要使用EditBox组件，但需要正确配置
        // 这里先用Label作为占位，实际输入可以通过点击后调用原生输入框实现
        const nameLabel = nameInputNode.addComponent(Label);
        nameLabel.string = '请输入玩家名称';
        nameLabel.fontSize = 20;
        nameLabel.color = new Color(150, 150, 150, 255);
        nameLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.playerProfilePopup.nameInputLabel = nameLabel;
        
        // 名称输入框可点击，点击后调用原生输入框
        const nameInputButton = nameInputNode.addComponent(Button);
        nameInputButton.node.on(Button.EventType.CLICK, () => {
            this.onNameInputClick();
        }, this);
        
        // 保存按钮
        const saveBtnNode = new Node('SaveButton');
        saveBtnNode.setParent(container);
        const saveBtnTransform = saveBtnNode.addComponent(UITransform);
        saveBtnTransform.setContentSize(120, 45);
        saveBtnTransform.setAnchorPoint(0.5, 0.5);
        saveBtnNode.setPosition(-80, -150, 0);
        // 先添加Graphics背景
        const saveBtnG = saveBtnNode.addComponent(Graphics);
        saveBtnG.fillColor = new Color(60, 180, 60, 255);
        saveBtnG.roundRect(-60, -22.5, 120, 45, 8);
        saveBtnG.fill();
        // 后添加Button组件，确保能接收点击事件
        const saveBtn = saveBtnNode.addComponent(Button);
        saveBtn.transition = Button.Transition.COLOR;
        saveBtn.normalColor = new Color(255, 255, 255, 255);
        saveBtn.hoverColor = new Color(200, 255, 200, 255);
        saveBtn.pressedColor = new Color(150, 255, 150, 255);
        this.playerProfilePopup.saveButton = saveBtn;
        const saveBtnLabel = new Node('SaveLabel');
        saveBtnLabel.setParent(saveBtnNode);
        const saveLabel = saveBtnLabel.addComponent(Label);
        saveLabel.string = '保存';
        saveLabel.fontSize = 22;
        saveLabel.color = new Color(255, 255, 255, 255);
        saveLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        const saveLabelTransform = saveBtnLabel.addComponent(UITransform);
        saveLabelTransform.setContentSize(120, 45);
        
        // 取消按钮
        const cancelBtnNode = new Node('CancelButton');
        cancelBtnNode.setParent(container);
        const cancelBtnTransform = cancelBtnNode.addComponent(UITransform);
        cancelBtnTransform.setContentSize(120, 45);
        cancelBtnTransform.setAnchorPoint(0.5, 0.5);
        cancelBtnNode.setPosition(80, -150, 0);
        // 先添加Graphics背景
        const cancelBtnG = cancelBtnNode.addComponent(Graphics);
        cancelBtnG.fillColor = new Color(180, 60, 60, 255);
        cancelBtnG.roundRect(-60, -22.5, 120, 45, 8);
        cancelBtnG.fill();
        // 后添加Button组件，确保能接收点击事件
        const cancelBtn = cancelBtnNode.addComponent(Button);
        cancelBtn.transition = Button.Transition.COLOR;
        cancelBtn.normalColor = new Color(255, 255, 255, 255);
        cancelBtn.hoverColor = new Color(255, 200, 200, 255);
        cancelBtn.pressedColor = new Color(255, 150, 150, 255);
        this.playerProfilePopup.cancelButton = cancelBtn;
        const cancelBtnLabel = new Node('CancelLabel');
        cancelBtnLabel.setParent(cancelBtnNode);
        const cancelLabel = cancelBtnLabel.addComponent(Label);
        cancelLabel.string = '取消';
        cancelLabel.fontSize = 22;
        cancelLabel.color = new Color(255, 255, 255, 255);
        cancelLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        const cancelLabelTransform = cancelBtnLabel.addComponent(UITransform);
        cancelLabelTransform.setContentSize(120, 45);
        
        this.playerProfilePopup.popupContainer = container;
    }
    
    /**
     * 从服务器加载玩家信息（名称和头像）
     */
    private async loadPlayerProfile() {
        let playerId = '';
        try {
            playerId = sys.localStorage.getItem('player_id') || '';
        } catch (e) {
            return;
        }
        
        if (!playerId) return;
        
        try {
            const response = await this.fetchPlayerProfile(playerId);
            if (response && response.success && response.data) {
                this.playerName = response.data.player_name || '';
                this.playerAvatar = response.data.player_avatar || '';
                this.updatePlayerProfileDisplay();
            }
        } catch (error) {
            console.error('[GameManager] 加载玩家信息失败:', error);
        }
    }
    
    /**
     * 获取玩家信息
     */
    private async fetchPlayerProfile(playerId: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.timeout = 3000;
            
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        try {
                            const data = JSON.parse(xhr.responseText);
                            resolve(data);
                        } catch (error) {
                            reject(new Error('解析响应失败'));
                        }
                    } else {
                        reject(new Error(`请求失败: ${xhr.status}`));
                    }
                }
            };
            
            xhr.onerror = () => reject(new Error('网络错误'));
            xhr.ontimeout = () => reject(new Error('请求超时'));
            
            xhr.open('GET', `https://www.egoistcookie.top/api/analytics/player/${encodeURIComponent(playerId)}/profile`, true);
            xhr.send();
        });
    }
    
    /**
     * 更新玩家信息显示（头像和名称）
     */
    private updatePlayerProfileDisplay() {
        // 更新名称
        const name = (this.playerName || '').trim();
        if (this.playerNameLabel) {
            this.playerNameLabel.string = name;
        }
        // 未设置昵称提示：当名称为空时显示“（可设置头像和昵称）”
        if (this.playerNameHintLabel && this.playerNameHintLabel.node && this.playerNameHintLabel.node.isValid) {
            this.playerNameHintLabel.node.active = name.length === 0;
        }
        
        // 更新头像
        if (this.avatarSprite && this.playerAvatar) {
            // 从Base64加载头像
            this.loadAvatarFromBase64(this.playerAvatar);
        } else {
            // 默认头像（灰色圆圈）
            this.showDefaultAvatar();
        }
    }
    
    /**
     * 从Base64字符串加载头像
     * 注意：Cocos Creator中从Base64加载图片比较复杂，这里简化处理
     * 实际项目中建议将图片上传到服务器，返回URL，然后使用resources.load加载
     */
    private loadAvatarFromBase64(base64: string) {
        if (!this.avatarSprite || !this.avatarNode) return;
        
        // 仅在浏览器环境下可用
        if (typeof Image === 'undefined') {
            console.warn('[GameManager] 当前环境不支持 Image 对象，无法从Base64加载头像');
            return;
        }
        
        const img = new Image();
        img.onload = () => {
            try {
                const imageAsset = new ImageAsset(img);
                const texture = new Texture2D();
                texture.image = imageAsset;
                
                const spriteFrame = new SpriteFrame();
                spriteFrame.texture = texture;
                
                this.avatarSprite.spriteFrame = spriteFrame;
                
                // 清理占位用的 Graphics（如果有）
                const graphics = this.avatarNode!.getComponent(Graphics);
                if (graphics) {
                    graphics.clear();
                }
                
              //console.log('[GameManager] 已从Base64加载并显示头像');
            } catch (e) {
                console.error('[GameManager] 从Base64创建头像失败:', e);
            }
        };
        img.onerror = (err) => {
            console.error('[GameManager] 加载Base64头像失败:', err);
        };
        img.src = base64;
    }
    
    /**
     * 通用：从Base64加载图片到指定 Sprite（用于排行榜头像等）
     */
    private loadSpriteFromBase64(base64: string, sprite: Sprite) {
        if (!sprite) return;
        if (typeof Image === 'undefined') {
            console.warn('[GameManager] 当前环境不支持 Image 对象，无法从Base64加载Sprite');
            return;
        }
        
        const img = new Image();
        img.onload = () => {
            try {
                const imageAsset = new ImageAsset(img);
                const texture = new Texture2D();
                texture.image = imageAsset;
                
                const spriteFrame = new SpriteFrame();
                spriteFrame.texture = texture;
                
                sprite.spriteFrame = spriteFrame;
            } catch (e) {
                console.error('[GameManager] 从Base64创建Sprite失败:', e);
            }
        };
        img.onerror = (err) => {
            console.error('[GameManager] 加载Base64 Sprite 失败:', err);
        };
        img.src = base64;
    }

    /**
     * 提供给 UIManager 等外部调用：强制关闭杀敌排行榜
     */
    public hideKillRankPanelExternally() {
        this.hideKillRankPanel();
    }
    
    /**
     * 显示默认头像
     */
    private showDefaultAvatar() {
        if (!this.avatarNode) return;
        
        const graphics = this.avatarNode.getComponent(Graphics);
        if (graphics) {
            graphics.clear();
            graphics.fillColor = new Color(80, 80, 80, 255);
            graphics.circle(0, 0, 30);
            graphics.fill();
        }
        
        // 清空SpriteFrame
        if (this.avatarSprite) {
            this.avatarSprite.spriteFrame = null;
        }
    }

    /**
     * 首页：更新击杀榜标签（杀敌数 + 超越百分比/前百分比）
     * 数据来源：后台 /api/analytics/player/:playerId/kill-rank（单表查询 player_kill_rank 视图）
     */
    private updateHomeKillRankLabel() {
        if (!this.killRankLabel || !this.killRankLabel.node || !this.killRankLabel.node.isValid) {
            return;
        }

        // 仅在“游戏首页”查询：进入战斗（Playing）后不再请求排行榜
        // 1) 状态判断
        if (this.gameState === GameState.Playing) {
            return;
        }
        // 2) UI 判断：BottomSelection/GameMainPanel 必须处于激活（首页可见）
        const bottomSelectionNode = find('Canvas/BottomSelection');
        const gameMainPanel = bottomSelectionNode ? bottomSelectionNode.getChildByName('GameMainPanel') : null;
        if (!bottomSelectionNode || !bottomSelectionNode.activeInHierarchy || !gameMainPanel || !gameMainPanel.activeInHierarchy) {
            return;
        }

        const setKillRankTextSafe = (text: string, color: Color) => {
            const lbl = this.killRankLabel;
            if (!lbl || !lbl.node || !lbl.node.isValid) return;
            lbl.string = text;
            lbl.color = color;
        };

        // 从本地缓存加载上一次成功的杀敌数/百分比（仅加载一次）
        const loadKillRankCacheIfNeeded = () => {
            if (this.hasKillRankCache) return;
            try {
                const raw = sys.localStorage.getItem(this.KILL_RANK_CACHE_KEY);
                if (raw) {
                    const obj = JSON.parse(raw);
                    if (typeof obj.kills === 'number' && typeof obj.surpassedPercent === 'number') {
                        this.lastKillRankKills = obj.kills;
                        this.lastKillRankSurpassedPercent = obj.surpassedPercent;
                        this.hasKillRankCache = true;
                    }
                }
            } catch (e) {
                console.warn('[KillRank] 读取本地缓存失败:', e);
            }
        };

        const formatKillRankTextFromCache = () => {
            if (!this.hasKillRankCache) return '杀敌:0  超越0%的指挥官';
            return `杀敌:${this.lastKillRankKills}  超越${this.lastKillRankSurpassedPercent.toFixed(1)}%的指挥官`;
        };

        const saveKillRankCache = (kills: number, surpassedPercent: number) => {
            this.lastKillRankKills = kills;
            this.lastKillRankSurpassedPercent = surpassedPercent;
            this.hasKillRankCache = true;
            try {
                sys.localStorage.setItem(
                    this.KILL_RANK_CACHE_KEY,
                    JSON.stringify({ kills, surpassedPercent })
                );
            } catch (e) {
                console.warn('[KillRank] 写入本地缓存失败:', e);
            }
        };

        // 先加载缓存，并立即用缓存填充一版文字，避免出现 "--"
        loadKillRankCacheIfNeeded();
        setKillRankTextSafe(formatKillRankTextFromCache(), new Color(255, 255, 255, 255));

        let playerId = '';
        try {
            playerId = sys.localStorage.getItem('player_id') || '';
        } catch (e) {
            // ignore
        }

        if (!playerId) {
            // 没有 player_id：通常是 AnalyticsManager 没挂载/未初始化
            console.warn('[KillRank] player_id 为空：可能未挂载/未初始化 AnalyticsManager，或 localStorage 读失败');
            // 没有playerId时也优先使用缓存
            setKillRankTextSafe(formatKillRankTextFromCache(), new Color(200, 200, 200, 255));
            return;
        }

        // 节流：避免首页 HUD 频繁刷新导致刷屏/重复请求
        const now = Date.now();
        if (this.killRankFetchInFlight) {
            return;
        }
        if (this.lastKillRankPlayerId === playerId && now - this.lastKillRankFetchAt < 5000) {
            return;
        }

        // 异步请求，失败不影响流程
        const url = `https://www.egoistcookie.top/api/analytics/player/${encodeURIComponent(playerId)}/kill-rank`;
        const xhr = new XMLHttpRequest();
        xhr.timeout = 3000;
        this.killRankFetchInFlight = true;
        this.lastKillRankFetchAt = now;
        this.lastKillRankPlayerId = playerId;
        const reqSeq = ++this.killRankReqSeq;
       //console.info('[KillRank] 请求开始:', { playerId, url });
        xhr.onreadystatechange = () => {
            if (xhr.readyState !== 4) return;
            this.killRankFetchInFlight = false;
           //console.info('[KillRank] 请求完成:', { status: xhr.status, statusText: xhr.statusText });

            // 如果这不是最新一次请求的回包，直接丢弃（避免退出/切页后旧回包写 UI）
            if (reqSeq !== this.killRankReqSeq) {
               //console.info('[KillRank] 丢弃过期回包:', { reqSeq, latest: this.killRankReqSeq });
                return;
            }
            // 回包时再确认仍处于首页（避免退出到战斗/切页后写 UI）
            if (this.gameState === GameState.Playing) return;
            const bottomSelectionNode2 = find('Canvas/BottomSelection');
            const gameMainPanel2 = bottomSelectionNode2 ? bottomSelectionNode2.getChildByName('GameMainPanel') : null;
            if (!bottomSelectionNode2 || !bottomSelectionNode2.activeInHierarchy || !gameMainPanel2 || !gameMainPanel2.activeInHierarchy) {
               //console.info('[KillRank] 回包时不在首页，忽略写 UI');
                return;
            }

            if (xhr.status !== 200) {
                console.warn('[KillRank] HTTP 非200，返回占位文案，responseText(截断):', (xhr.responseText || '').slice(0, 200));
                // 请求失败时保持/恢复上一次成功的值
                setKillRankTextSafe(formatKillRankTextFromCache(), new Color(200, 200, 200, 255));
                return;
            }
            try {
                const rawText = xhr.responseText || '';
               //console.info('[KillRank] responseText(截断):', rawText.slice(0, 300));
                const resp = JSON.parse(xhr.responseText || '{}');
                if (!resp || !resp.success || !resp.data) {
                    console.warn('[KillRank] JSON 结构不符合预期:', resp);
                    setKillRankTextSafe(formatKillRankTextFromCache(), new Color(200, 200, 200, 255));
                    return;
                }

                const d = resp.data;
                // console.info('[KillRank] data:', {
                //     total_kills: d.total_kills,
                //     surpassed_percent: d.surpassed_percent,
                //     kill_rank: d.kill_rank,
                //     total_players: d.total_players
                // });
                const toNumber = (v: any, fallback: number) => {
                    const n = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v) : NaN);
                    return Number.isFinite(n) ? n : fallback;
                };

                const kills = toNumber(d.total_kills, 0);
                const surpassedPercent = toNumber(d.surpassed_percent, 0);
                // 持久化缓存
                saveKillRankCache(kills, surpassedPercent);

                // 文案：杀敌数 + 超越 x% 的指挥官
                setKillRankTextSafe(`杀敌:${kills}  超越${surpassedPercent.toFixed(1)}%的指挥官`, new Color(255, 255, 255, 255));
            } catch (e) {
                console.error('[KillRank] 解析 JSON 失败:', e);
                setKillRankTextSafe(formatKillRankTextFromCache(), new Color(200, 200, 200, 255));
            }
        };
        xhr.onerror = () => {
            this.killRankFetchInFlight = false;
            console.error('[KillRank] xhr.onerror 网络错误，url=', url);
            setKillRankTextSafe(formatKillRankTextFromCache(), new Color(200, 200, 200, 255));
        };
        xhr.ontimeout = () => {
            this.killRankFetchInFlight = false;
            console.error('[KillRank] xhr.ontimeout 请求超时(3s)，url=', url);
            setKillRankTextSafe(formatKillRankTextFromCache(), new Color(200, 200, 200, 255));
        };
        xhr.open('GET', url, true);
        xhr.send();
    }

    onCrystalDestroyed() {
        if (this.gameState === GameState.Playing) {
            this.endGame(GameState.Defeat);
        }
    }

    // 记录最近一次游戏结果状态，用于结算界面（MVP/SVP 显示）
    private lastGameResultState: GameState | null = null;
    // 记录MVP/SVP单位信息，用于首次返回主页提示
    public lastMVPUnit: { unitName: string; unitType: string; unitIcon: SpriteFrame | null } | null = null;

    endGame(state: GameState) {
        //console.info(`[GameManager.endGame] 游戏结束，状态: ${state === GameState.Victory ? 'Victory' : state === GameState.Defeat ? 'Defeat' : 'Other'}`);
        this.gameState = state;
        
        // 游戏结束时，清理所有单位（敌人直接消失，塔停止移动）
        this.cleanupAllUnitsForEndGame();
        
        // 显示结算面板
        this.showGameResultPanel(state);
    }

    // 使用单位介绍框展示法师塔解锁，贴图直接从 resources/textures/fashita 加载
    private showMageTowerUnlockViaIntro(onClosed?: () => void) {
        if (!this.unitIntroPopup) {
            if (onClosed) onClosed();
            return;
        }
        const finish = (icon: SpriteFrame | null) => {
            this.unitIntroPopup.show({
                unitName: '法师塔',
                unitDescription: '已解锁新兵营：法师塔！',
                unitIcon: icon,
                unitType: 'MageTower',
                unitId: 'MageTower',
                onCloseCallback: () => { if (onClosed) onClosed(); }
            });
        };
        resources.load('textures/fashita/spriteFrame', SpriteFrame, (err, sf) => {
            if (!err && sf) {
                finish(sf);
            } else {
                resources.load('textures/fashita', SpriteFrame, (err2, sf2) => {
                    finish(!err2 && sf2 ? sf2 : null);
                });
            }
        });
    }

    // 使用单位介绍框展示女猎手“龙卷觉醒”
    private showHunterTornadoAwakenViaIntro(onClosed?: () => void) {
        if (!this.unitIntroPopup) {
            if (onClosed) onClosed();
            return;
        }
        const finish = (icon: SpriteFrame | null) => {
            this.unitIntroPopup.show({
                unitName: '觉醒技能【龙卷】',
                unitDescription: '不错，指挥官，终于恢复了我百分之一的力量。',
                unitIcon: icon,
                unitType: 'Hunter',
                unitId: 'HunterTornadoAwaken',
                onCloseCallback: () => { if (onClosed) onClosed(); }
            });
        };
        const candidatePaths = [
            'textures/Hunter/spriteFrame',
        ];
        const loadAt = (idx: number) => {
            if (idx >= candidatePaths.length) {
                finish(null);
                return;
            }
            resources.load(candidatePaths[idx], SpriteFrame, (err, sf) => {
                if (!err && sf) {
                    finish(sf);
                    return;
                }
                loadAt(idx + 1);
            });
        };
        loadAt(0);
    }
    
    /**
     * 显示游戏结算面板（统一方法，用于游戏结束和主动退出）
     * @param state 游戏状态（Victory/Defeat/Other），如果为null则显示为"主动退出"
     */
    showGameResultPanel(state: GameState | null = null) {
        // 记录本次结果状态（null 表示主动退出）
        this.lastGameResultState = state;
        // 默认不展示经验/等级区域，后续根据本局是否获得经验来决定
        this.showExpSectionInGameOver = false;

       //console.info(`[GameManager.showGameResultPanel] start, state=${state}, currentGameExp=${this.currentGameExp}`);

        // 最简需求：第一关胜利时，在结算页弹出前，先展示“法师塔解锁”单位介绍框（仅一次）
        try {
            const finalState = state != null ? state : this.lastGameResultState;
            const level = this.getCurrentLevelSafe ? this.getCurrentLevelSafe() : (this as any).currentLevel || 1;
            if (finalState === GameState.Victory && level === 2 && !this.hasShownLevel2HunterTornadoAwakenIntro) {
                this.hasShownLevel2HunterTornadoAwakenIntro = true;
                this.showHunterTornadoAwakenViaIntro(() => {
                    this.showGameResultPanel(state);
                });
                return;
            }
            if (finalState === GameState.Victory && level === 1 && !(this as any)._hasShownLevel1MageUnlockOnce) {
                (this as any)._hasShownLevel1MageUnlockOnce = true;
                this.showMageTowerUnlockViaIntro(() => {
                    this.showGameResultPanel(state);
                });
                return;
            }
        } catch {}
        
        // 消耗体力（每局游戏无论输赢都消耗5点体力）
        if (this.playerDataManager) {
            this.playerDataManager.consumeStamina(5);
        }
        
        // 保存经验相关的数据，用于后续创建进度条
        let prevLevel = 0;
        let prevExp = 0;
        let currentLevel = 0;
        let currentExp = 0;
        let levelsGained = 0;
        let expGainedThisGame = 0;
        
        // 结算经验值（即使为0也要保存，确保数据持久化）
        if (this.playerDataManager) {
            if (this.currentGameExp > 0) {
                // 结算前的等级和经验（用于做升级进度动画）
                prevLevel = this.playerDataManager.getPlayerLevel();
                prevExp = this.playerDataManager.getExperience(); // 0-99

                // 保存本次获得的经验值（用于显示）
                expGainedThisGame = this.currentGameExp;
                levelsGained = this.playerDataManager.addExperience(this.currentGameExp);
                currentLevel = this.playerDataManager.getPlayerLevel();
                currentExp = this.playerDataManager.getExperience();
                const remainingExp = this.playerDataManager.getRemainingExpForNextLevel();
                
                // 在游戏结束面板显示经验和等级概览
                // 本局获得了经验值：展示“经验/等级”区域
                this.showExpSectionInGameOver = true;
                if (this.expLabel) {
                    let expText = `本次获得经验值: +${expGainedThisGame}`;
                    expText += `\n当前等级: Lv.${Math.max(1, currentLevel)}`;
                    expText += `\n当前经验值: ${currentExp} / 100 (下一级还需 ${remainingExp})`;
                    this.expLabel.string = expText;
                    if (this.expLabel.node) {
                        this.expLabel.node.active = true;
                    }
                } else {
                    // 如果expLabel未设置，尝试在gameOverPanel中创建
                    this.createExpLabelIfNeeded(expGainedThisGame, 0);
                    if (this.expLabel && this.expLabel.node) {
                        let expText = `本次获得经验值: +${expGainedThisGame}`;
                        expText += `\n当前等级: Lv.${Math.max(1, currentLevel)}`;
                        expText += `\n当前经验值: ${currentExp} / 100 (下一级还需 ${remainingExp})`;
                        this.expLabel.string = expText;
                        this.expLabel.node.active = true;
                    }
                }
            } else {
                // 即使没有获得经验值，也要保存数据
                this.playerDataManager.saveData();
                currentLevel = this.playerDataManager.getPlayerLevel();
                currentExp = this.playerDataManager.getExperience();
                const remainingExp = this.playerDataManager.getRemainingExpForNextLevel();
                prevLevel = Math.max(1, currentLevel);
                prevExp = currentExp;

                // 本局没有获得经验值：不在结算弹窗中展示详细经验/等级信息，最多只保留一行“本次获得经验值：+0”或直接隐藏
                // 为了避免信息干扰，这里选择隐藏经验标签
                if (this.expLabel && this.expLabel.node) {
                    this.expLabel.node.active = false;
                }

                // 同时不展示等级进度条
                if (this.gameOverLevelBarBg && this.gameOverLevelBarBg.isValid) {
                    this.gameOverLevelBarBg.active = false;
                }
                this.showExpSectionInGameOver = false;
            }
        }
        
        if (this.gameOverPanel) {
            this.gameOverPanel.active = true;
        }

        // 创建或获取游戏结束弹窗（必须在创建进度条之前）
        this.createGameOverDialog();
        
        // 创建 / 更新结算页等级进度条，并播放从0到当前进度的动画（必须在createGameOverDialog之后）
        // 只有在本局实际获得经验时才展示等级进度条，否则完全隐藏，避免干扰贡献榜布局
        if (this.playerDataManager && this.currentGameExp > 0) {
            this.createOrUpdateGameOverLevelBar(prevLevel, prevExp, currentLevel, currentExp, levelsGained, expGainedThisGame);
            if (this.gameOverLevelBarBg && this.gameOverLevelBarBg.isValid) {
                this.gameOverLevelBarBg.active = true;
            }
        } else if (this.gameOverLevelBarBg && this.gameOverLevelBarBg.isValid) {
            this.gameOverLevelBarBg.active = false;
        }
        
        // 初始化退出游戏按钮（查找场景中的ReturnButton）
        this.initExitGameButton();
        
        // 显示退出游戏按钮
        if (this.exitGameButton && this.exitGameButton.node) {
            this.exitGameButton.node.active = true;
        }
        
        // 设置结果标签文本
        if (this.gameOverLabel) {
            if (state === null) {
                // 主动退出
                this.gameOverLabel.string = '游戏结算';
            } else if (state === GameState.Victory) {
                this.gameOverLabel.string = '胜利！';
                
                // 记录当前关卡为已通过
                if (this.uiManager && this.uiManager.getCurrentLevel) {
                    const currentLevel = this.uiManager.getCurrentLevel();
                    if (this.playerDataManager && currentLevel) {
                        this.playerDataManager.passLevel(currentLevel);
                        //console.info(`[GameManager.showGameResultPanel] 关卡 ${currentLevel} 已标记为通过`);
                    }
                }
                
                // 胜利时以50%概率展示微信官方推荐页（异步，不阻塞结算UI）
                if (Math.random() < 0.5) {
                    this.scheduleOnce(() => {
                        this.showWeChatRecommend();
                    }, 0.1);
                }
            } else if (state === GameState.Defeat) {
                this.gameOverLabel.string = '失败！';
                // 失败结算：展示一次性复活按钮
                this.createOrShowReviveButton();
            } else {
                this.gameOverLabel.string = '游戏结束';
            }
            // 调大字体
            this.gameOverLabel.fontSize = 48;
        }
        
        // 停止伤害统计
        const damageStats = DamageStatistics.getInstance();
        damageStats.stopRecording();
        
        // 创建/更新伤害统计图表（会在内部设置MVP单位信息）
      //console.log('[GameManager.showGameResultPanel] 调用createDamageStatsPanel前，lastMVPUnit:', this.lastMVPUnit);
        this.createDamageStatsPanel();
      //console.log('[GameManager.showGameResultPanel] 调用createDamageStatsPanel后，lastMVPUnit:', this.lastMVPUnit);
        
        // 如果createDamageStatsPanel没有设置MVP单位（例如没有贡献数据），尝试设置默认MVP单位
        if (!this.lastMVPUnit) {
          //console.log('[GameManager.showGameResultPanel] lastMVPUnit为空，调用setDefaultMVPUnit');
            this.setDefaultMVPUnit();
        }
        
        // 确保UI元素已移动到弹窗中
        this.moveUIElementsToDialog();
        
        // 调整所有UI元素的位置
        this.layoutGameOverUI();
        
        // 将弹窗置于最上层
        this.setGameOverUIOnTop();
        
        // 显示弹窗
        if (this.gameOverDialog) {
            this.gameOverDialog.active = true;
            //console.info('[GameManager.showGameResultPanel] 游戏结算弹窗已显示');
        } else {
            console.warn('[GameManager.showGameResultPanel] 游戏结算弹窗不存在！');
        }

        // 上报埋点数据（异步，不影响游戏流程）
        if (this.analyticsManager) {
            const result: 'success' | 'fail' = state === GameState.Victory ? 'success' : 'fail';
            let currentWave = 0;
            const enemySpawner = this.findComponentInScene('EnemySpawner') as any;
            if (enemySpawner && enemySpawner.getCurrentWaveNumber) {
                const wave = enemySpawner.getCurrentWaveNumber();
                if (typeof wave === 'number' && !isNaN(wave)) {
                    currentWave = wave;
                }
            }

            const defendTime = Math.floor(this.gameTime);
            const finalGold = this.gold || 0;
            const finalPopulation = this.population || 0;
            const killCount = this.totalKillCount || 0;

            this.analyticsManager.reportGameData(
                result,
                defendTime,
                currentWave,
                finalGold,
                finalPopulation,
                killCount
            ).then(success => {
                if (success) {
                    console.log('[GameManager] 埋点数据上报成功');
                } else {
                    console.warn('[GameManager] 埋点数据上报失败，但不影响游戏');
                }
            }).catch((error) => {
                console.error('[GameManager] 埋点数据上报异常:', error);
            });
        } else {
            console.warn('[GameManager] analyticsManager 为空，跳过埋点上报');
        }

        // 更新左上角等级HUD显示状态（会根据gameMainPanel的显示状态自动控制）
        this.updateLevelHud();
    }
    
    /**
     * 清理游戏结束弹窗中的动态UI元素（防止重复创建导致排版错乱）
     * 注意：不销毁面板节点本身，只清空其子节点，这样可以保证位置/尺寸等始终一致。
     */
    private cleanupGameOverDynamicUI() {
        if (!this.gameOverDialog) {
            return;
        }
        
        // 仅清空伤害统计面板的子节点，保留面板节点和其 UITransform
        const statsPanel = this.gameOverDialog.getChildByName('DamageStatsPanel');
        if (statsPanel && statsPanel.isValid) {
            const children = [...statsPanel.children];
            for (const child of children) {
                if (child && child.isValid) {
                    child.destroy();
                }
            }
           //console.info('[GameManager.cleanupGameOverDynamicUI] cleared DamageStatsPanel children');
        }
        
        // 「关卡奖励」分界线节点不再销毁，始终复用，以保证其 Y 坐标一致
        // 等级进度条同样复用（在 createOrUpdateGameOverLevelBar 中控制）
    }
    
    /**
     * 创建伤害统计图表面板（可重复调用，内部自动复用同一个面板节点）
     */
    private createDamageStatsPanel() {
        if (!this.gameOverDialog) {
            return;
        }
        
        // 清理旧的动态UI元素（防止重复创建导致排版错乱），但保留面板节点本身
        this.cleanupGameOverDynamicUI();
        
        // 创建或复用伤害统计面板
        let statsPanel = this.gameOverDialog.getChildByName('DamageStatsPanel');
        let isNewPanel = false;
        if (!statsPanel) {
            statsPanel = new Node('DamageStatsPanel');
            statsPanel.setParent(this.gameOverDialog);
            isNewPanel = true;
        }
        
        // 添加或获取 UITransform 组件（调整尺寸：高度增加以容纳3条数据）
        let statsTransform = statsPanel.getComponent(UITransform);
        if (!statsTransform) {
            statsTransform = statsPanel.addComponent(UITransform);
        }
        const panelHeight = Math.max(150, 25 + 3 * (28 + 6) + 20); // 动态计算高度：标题(25) + 3条数据 + 底部间距(20)
        statsTransform.setContentSize(380, panelHeight);

       //console.info(`[GameManager.createDamageStatsPanel] ${isNewPanel ? 'create' : 'reuse'} panel, height=${panelHeight}`);
        
        // 创建背景
        const statsBg = new Node('StatsBackground');
        statsBg.setParent(statsPanel);
        const bgTransform = statsBg.addComponent(UITransform);
        bgTransform.setContentSize(380, panelHeight);
        const bgGraphics = statsBg.addComponent(Graphics);
        bgGraphics.fillColor = new Color(20, 20, 20, 200);
        bgGraphics.roundRect(-190, -panelHeight / 2, 380, panelHeight, 8);
        bgGraphics.fill();
        bgGraphics.strokeColor = new Color(150, 150, 150, 255);
        bgGraphics.lineWidth = 1;
        bgGraphics.roundRect(-190, -panelHeight / 2, 380, panelHeight, 8);
        bgGraphics.stroke();
        
        // 获取总伤害前三位的单位（按总伤害排序，更符合“谁打得最多”的直觉）
        const damageStats = DamageStatistics.getInstance();
        // 先取出所有单位的统计数据，按“贡献值”排序后再截取前3名
        const allUnits = damageStats.getAllDamageData();
        
        // 计算单位的贡献值：剑士用承伤，牧师用治疗，其它用总伤害
        // 使用 unitName 判断，避免代码压缩后 unitType 不准确
        const getContributionValue = (unit: any): number => {
            if (unit.unitName === '剑士' || unit.unitType === 'ElfSwordsman') {
                return unit.damageTaken || 0;
            } else if (unit.unitName === '牧师' || unit.unitType === 'Priest') {
                return unit.healAmount || 0;
            }
            return unit.totalDamage || 0;
        };
        
        // 判断是否是建筑物的辅助函数
        const isBuilding = (unit: any): boolean => {
            const buildingTypes = ['WatchTower', 'IceTower', 'ThunderTower', 'WarAncientTree',
                                  'HunterHall', 'MageTower', 'SwordsmanHall', 'Church', 'StoneWall'];
            return buildingTypes.indexOf(unit.unitType) >= 0;
        };
        
        const filteredUnits = allUnits.filter(u => getContributionValue(u) > 0);
        // 按贡献值从高到低排序
        filteredUnits.sort((a, b) => getContributionValue(b) - getContributionValue(a));
        const topUnits = filteredUnits.slice(0, 3);
        
        
        // 查找第一个非建筑物的单位（用于MVP/SVP提示）
      //console.log('[GameManager.createDamageStatsPanel] 开始查找非建筑物单位，总单位数:', filteredUnits.length);
        let mvpUnitForHint: any = null;
        for (const unit of filteredUnits) {
            const isUnitBuilding = isBuilding(unit);
          //console.log(`[GameManager.createDamageStatsPanel] 检查单位: ${unit.unitName} (${unit.unitType}), 是建筑物: ${isUnitBuilding}`);
            if (!isUnitBuilding) {
                mvpUnitForHint = unit;
              //console.log(`[GameManager.createDamageStatsPanel] 找到非建筑物单位: ${unit.unitName} (${unit.unitType})`);
                break;
            }
        }
        
        // 如果找到了非建筑物单位，保存为MVP单位信息（用于首次返回主页提示）
        if (mvpUnitForHint) {
            const isVictory = this.lastGameResultState === GameState.Victory;
          //console.log(`[GameManager.createDamageStatsPanel] 保存MVP单位信息: ${mvpUnitForHint.unitName} (${mvpUnitForHint.unitType}), 胜利: ${isVictory}`);
            this.saveMVPUnitInfo(mvpUnitForHint, isVictory);
        } else {
            console.warn('[GameManager.createDamageStatsPanel] 未找到非建筑物单位，将使用默认MVP单位');
        }
        
        if (topUnits.length === 0) {
            // 如果没有伤害数据，显示提示
            const noDataLabel = new Node('NoDataLabel');
            noDataLabel.setParent(statsPanel);
            const labelTransform = noDataLabel.addComponent(UITransform);
            labelTransform.setContentSize(380, panelHeight);
            const label = noDataLabel.addComponent(Label);
            label.string = '暂无贡献数据';
            label.fontSize = 20;
            label.color = new Color(150, 150, 150, 255);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            
            // 即使没有贡献数据，也尝试设置一个默认的MVP单位（用于首次返回主页提示）
          //console.log('[GameManager.createDamageStatsPanel] 没有贡献数据，调用setDefaultMVPUnit');
            this.setDefaultMVPUnit();
            return;
        }
        
        // 创建标题
        const titleLabel = new Node('TitleLabel');
        titleLabel.setParent(statsPanel);
        titleLabel.setPosition(0, panelHeight / 2 - 20, 0); // 动态计算标题位置
        const titleTransform = titleLabel.addComponent(UITransform);
        titleTransform.setContentSize(380, 25);
        const title = titleLabel.addComponent(Label);
        // 标题改为“贡献榜”
        title.string = '贡献榜';
        title.fontSize = 18;
        title.color = new Color(255, 255, 200, 255);
        title.horizontalAlign = Label.HorizontalAlign.CENTER;
        title.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 计算最大“贡献值”（剑士用承伤、牧师用治疗，其它用总伤害）
        const maxContribution = Math.max(...topUnits.map(u => getContributionValue(u)));
        
        // 创建每个单位的统计项（调整布局：缩小名称和数值之间的距离）
        const itemHeight = 28;
        const itemSpacing = 6;
        const startY = panelHeight / 2 - 50; // 动态计算起始Y位置
        
        topUnits.forEach((unit, index) => {
            const itemNode = new Node(`StatsItem_${index}`);
            itemNode.setParent(statsPanel);
            itemNode.setPosition(0, startY - index * (itemHeight + itemSpacing), 0);
            
            const itemTransform = itemNode.addComponent(UITransform);
            itemTransform.setContentSize(350, itemHeight);
            
            // 单位名称标签（增加宽度以容纳 MVP/SVP 前缀）
            const nameLabel = new Node('NameLabel');
            nameLabel.setParent(itemNode);
            nameLabel.setPosition(-140, 0, 0);
            const nameTransform = nameLabel.addComponent(UITransform);
            nameTransform.setContentSize(120, itemHeight); // 从80增加到120，确保能显示"SVP 剑士"
            const name = nameLabel.addComponent(Label);
            // 第一名加上 MVP/SVP 前缀，并使用金色高亮
            let displayName = unit.unitName;
            if (index === 0) {
                const isVictory = this.lastGameResultState === GameState.Victory;
                const prefix = isVictory ? 'MVP ' : 'SVP ';
                displayName = prefix + displayName;
                name.color = new Color(255, 215, 0, 255);
                
                // 注意：MVP/SVP单位信息已在上面统一处理（优先选择非建筑物单位），这里不再重复保存
            } else {
                name.color = new Color(255, 255, 255, 255);
            }
            name.string = displayName;
            name.fontSize = 16;
            name.horizontalAlign = Label.HorizontalAlign.LEFT;
            name.verticalAlign = Label.VerticalAlign.CENTER;
            // 宽度已增加到120，应该足够显示"SVP 剑士"等文本
            
            const contributionValue = getContributionValue(unit);
            
            // 伤害条背景（调整位置和大小）
            const barBg = new Node('BarBackground');
            barBg.setParent(itemNode);
            barBg.setPosition(50, 0, 0);
            const barBgTransform = barBg.addComponent(UITransform);
            barBgTransform.setContentSize(250, 16);
            const barBgGraphics = barBg.addComponent(Graphics);
            barBgGraphics.fillColor = new Color(50, 50, 50, 255);
            barBgGraphics.roundRect(-125, -8, 250, 16, 3);
            barBgGraphics.fill();
            
            // 贡献条（根据贡献值比例）
            const bar = new Node('Bar');
            bar.setParent(barBg);
            const barTransform = bar.addComponent(UITransform);
            const barWidth = maxContribution > 0 ? (getContributionValue(unit) / maxContribution) * 250 : 0;
            barTransform.setContentSize(barWidth, 16);
            bar.setPosition(-125 + barWidth / 2, 0, 0);
            const barGraphics = bar.addComponent(Graphics);
            
            // 根据排名设置不同颜色
            let barColor: Color;
            if (index === 0) {
                barColor = new Color(255, 215, 0, 255); // 金色
            } else if (index === 1) {
                barColor = new Color(192, 192, 192, 255); // 银色
            } else {
                barColor = new Color(205, 127, 50, 255); // 铜色
            }
            
            barGraphics.fillColor = barColor;
            barGraphics.roundRect(-barWidth / 2, -8, barWidth, 16, 3);
            barGraphics.fill();

            // 在条状图上显示对应的"贡献值"数值（所有单位都在条中显示数值）
            const contribValueLabelNode = new Node('ContributionValueLabel');
            contribValueLabelNode.setParent(bar);
            contribValueLabelNode.setPosition(0, 0, 0);
            const contribValueLabelTransform = contribValueLabelNode.addComponent(UITransform);
            contribValueLabelTransform.setContentSize(barWidth, 16);
            const contribValueLabel = contribValueLabelNode.addComponent(Label);

            // 根据单位类型设置后缀和颜色
            let centerSuffix = '';
            if (unit.unitName === '剑士') {
                centerSuffix = '（承伤）';
                contribValueLabel.color = new Color(255, 0, 0, 255);   // 红色数字
            } else if (unit.unitName === '牧师') {
                centerSuffix = '（治疗量）';
                contribValueLabel.color = new Color(0, 255, 0, 255);   // 绿色数字
            } else {
                // 其他单位：无后缀，白色数字
                contribValueLabel.color = new Color(255, 255, 255, 255);
            }
            
            contribValueLabel.string = `${Math.floor(contributionValue)}${centerSuffix}`;
            contribValueLabel.fontSize = 14;
            contribValueLabel.enableOutline = true;
            contribValueLabel.outlineColor = new Color(0, 0, 0, 255);   // 黑色描边
            contribValueLabel.outlineWidth = 2;
            contribValueLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            contribValueLabel.verticalAlign = Label.VerticalAlign.CENTER;
        });
    }
    
    /**
     * 保存MVP/SVP单位信息，用于首次返回主页提示
     */
    private saveMVPUnitInfo(unit: any, isVictory: boolean) {
      //console.log(`[GameManager.saveMVPUnitInfo] 保存MVP单位信息: unitName=${unit.unitName}, unitType=${unit.unitType}, isVictory=${isVictory}`);
        this.lastMVPUnit = {
            unitName: unit.unitName || '未知单位',
            unitType: unit.unitType || '',
            unitIcon: null, // 图标稍后在UIManager中通过TalentSystem获取
            // 额外记录这局是否胜利，供UI决定提示文案
            isVictory: isVictory
        } as any;
      //console.log(`[GameManager.saveMVPUnitInfo] lastMVPUnit已设置:`, this.lastMVPUnit);
    }
    
    /**
     * 设置默认的MVP单位（当没有贡献数据时使用）
     */
    private setDefaultMVPUnit() {
      //console.log('[GameManager.setDefaultMVPUnit] 开始设置默认MVP单位');
        // 判断是否是建筑物的辅助函数
        const isBuildingType = (unitType: string): boolean => {
            const buildingTypes = ['WatchTower', 'IceTower', 'ThunderTower', 'WarAncientTree',
                                  'HunterHall', 'MageTower', 'SwordsmanHall', 'Church', 'StoneWall'];
            return buildingTypes.indexOf(unitType) >= 0;
        };
        
        // 尝试获取第一个上场的非建筑物单位作为默认MVP
        const activeUnitTypes = this.getActiveUnitTypes().filter(type => type !== 'MageTower');
      //console.log('[GameManager.setDefaultMVPUnit] 当前上场的单位类型:', activeUnitTypes);
        
        // 过滤掉建筑物类型
        const nonBuildingTypes = activeUnitTypes.filter(type => !isBuildingType(type));
      //console.log('[GameManager.setDefaultMVPUnit] 过滤后的非建筑物单位类型:', nonBuildingTypes);
        
        if (nonBuildingTypes.length > 0) {
            // 使用第一个非建筑物单位类型
            const firstUnitType = nonBuildingTypes[0];
          //console.log(`[GameManager.setDefaultMVPUnit] 使用第一个非建筑物单位类型: ${firstUnitType}`);
            const unitNode = this.findFirstUnitInstance(firstUnitType);
            if (unitNode) {
                // 尝试获取单位信息
                const roleScript = unitNode.getComponent('Role') as any;
                const buildScript = unitNode.getComponent('Build') as any;
                const script = roleScript || buildScript;
                
                if (script) {
                    const configManager = UnitConfigManager.getInstance();
                    const displayInfo = configManager.getUnitDisplayInfo(firstUnitType);
                    const unitName = displayInfo ? displayInfo.name : (script.unitName || firstUnitType);
                    
                    this.lastMVPUnit = {
                        unitName: unitName,
                        unitType: firstUnitType,
                        unitIcon: null
                    };
                  //console.log(`[GameManager.setDefaultMVPUnit] 从单位实例获取信息: ${unitName} (${firstUnitType})`);
                    return;
                }
            }
            
            // 如果找不到单位实例，至少保存单位类型和名称
            const configManager = UnitConfigManager.getInstance();
            const displayInfo = configManager.getUnitDisplayInfo(firstUnitType);
            const unitName = displayInfo ? displayInfo.name : firstUnitType;
            
            this.lastMVPUnit = {
                unitName: unitName,
                unitType: firstUnitType,
                unitIcon: null,
                isVictory: this.lastGameResultState === GameState.Victory
            } as any;
          //console.log(`[GameManager.setDefaultMVPUnit] 从配置获取信息: ${unitName} (${firstUnitType})`);
        } else {
            // 如果没有任何非建筑物单位，使用默认单位（弓箭手）
          //console.log('[GameManager.setDefaultMVPUnit] 没有非建筑物单位，使用默认单位: 弓箭手');
            this.lastMVPUnit = {
                unitName: '弓箭手',
                unitType: 'Arrower',
                unitIcon: null,
                isVictory: this.lastGameResultState === GameState.Victory
            } as any;
        }
      //console.log('[GameManager.setDefaultMVPUnit] 最终设置的lastMVPUnit:', this.lastMVPUnit);
    }
    
    /**
     * 为按钮加载贴图并设置Sprite组件
     * @param buttonNode 按钮节点
     * @param normalPath 正常状态的贴图路径（相对于textures/icon）
     * @param pressedPath 按下状态的贴图路径（相对于textures/icon）
     */
    private setupButtonSprite(buttonNode: Node, normalPath: string, pressedPath: string) {
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
     * 初始化退出游戏按钮（查找场景中的 ExitButton 节点）
     */
    private initExitGameButton() {
        if (!this.gameOverPanel) {
            return;
        }
        
        // 如果已经通过@property设置了，直接使用
        if (this.exitGameButton && this.exitGameButton.node && this.exitGameButton.node.isValid) {
            // 绑定点击事件
            this.exitGameButton.node.off(Button.EventType.CLICK);
            this.exitGameButton.node.on(Button.EventType.CLICK, () => {
                this.onExitGameClick();
            }, this);
            // 设置按钮贴图
            this.setupButtonSprite(this.exitGameButton.node, 'exit.png', 'exit_down.png');
            return;
        }
        
        // 1）优先在 gameOverPanel / gameOverDialog 下查找名为 ExitButton 的节点
        let exitButtonNode: Node | null = null;
        exitButtonNode = this.gameOverPanel.getChildByName('ExitButton');
        if (!exitButtonNode && this.gameOverDialog) {
            exitButtonNode = this.gameOverDialog.getChildByName('ExitButton');
        }

        // 2）如果还没找到，尝试在整个场景中递归查找 ExitButton
        if (!exitButtonNode && this.node && this.node.scene) {
            const findNodeRecursive = (node: Node, name: string): Node | null => {
                if (node.name === name) {
                    return node;
                }
                for (const child of node.children) {
                    const found = findNodeRecursive(child, name);
                    if (found) return found;
                }
                return null;
            };
            exitButtonNode = findNodeRecursive(this.node.scene, 'ExitButton');
        }

        if (!exitButtonNode) {
            console.warn('[GameManager.initExitGameButton] 未能在场景中找到名为 ExitButton 的节点，自动创建一个。');
            // 在弹窗下动态创建一个退出按钮节点
            const parentForExit = this.gameOverDialog || this.gameOverPanel || this.node;
            exitButtonNode = new Node('ExitButton');
            exitButtonNode.setParent(parentForExit);
        } else {
            // 确保退出按钮在结算弹窗容器下，这样布局函数才能正常摆放
            if (this.gameOverDialog && exitButtonNode.parent !== this.gameOverDialog) {
                exitButtonNode.setParent(this.gameOverDialog);
            }
        }

        // 获取或添加 Button 组件
        let button = exitButtonNode.getComponent(Button);
        if (!button) {
            button = exitButtonNode.addComponent(Button);
        }

                this.exitGameButton = button;

                // 绑定点击事件
                button.node.off(Button.EventType.CLICK);
                button.node.on(Button.EventType.CLICK, () => {
                    this.onExitGameClick();
                }, this);

                // 设置按钮贴图
                this.setupButtonSprite(button.node, 'exit.png', 'exit_down.png');
    }
    
    /**
     * 退出游戏按钮点击事件
     */
    private onExitGameClick() {
        // 如果结算面板未显示，先显示结算面板
        if (!this.gameOverDialog || !this.gameOverDialog.active) {
            // 显示结算面板（主动退出）
            this.showGameResultPanel(null);
            return; // 显示结算面板后，等待用户再次点击退出按钮
        }
        
        // 如果结算面板已显示，则真正退出游戏
        // 结算经验值（虽然已经在showGameResultPanel中结算了，但这里确保保存）
        if (this.playerDataManager) {
            this.settleGameExperience();
        }
        
        // 隐藏结算面板
        if (this.gameOverDialog) {
            this.gameOverDialog.active = false;
        }
        // 隐藏结算全屏遮罩
        if (this.gameOverMask && this.gameOverMask.isValid) {
            this.gameOverMask.active = false;
        }
        if (this.gameOverPanel) {
            this.gameOverPanel.active = false;
        }
        
        // 直接调用UIManager的onExitGameClick方法（无需确认框）
        if (this.uiManager && (this.uiManager as any).onExitGameClick) {
            (this.uiManager as any).onExitGameClick();
        } else {
            // 如果找不到UIManager，尝试直接查找
            const uiManagerNode = find('UIManager') || find('UI/UIManager') || find('Canvas/UI/UIManager');
            if (uiManagerNode) {
                const uiManager = uiManagerNode.getComponent('UIManager') as any;
                if (uiManager && uiManager.onExitGameClick) {
                    uiManager.onExitGameClick();
                }
            }
        }
    }
    
    /**
     * 创建游戏结束弹窗容器
     */
    private createGameOverDialog() {
        // 如果弹窗已存在，直接返回
        if (this.gameOverDialog && this.gameOverDialog.isValid) {
            // 确保UI元素在弹窗中
            if (this.gameOverPanel) {
                this.moveUIElementsToDialog();
            }
            return;
        }
        
        // 如果gameOverPanel不存在，仍然创建弹窗，但需要创建必要的UI元素
        if (!this.gameOverPanel) {
            console.warn('[GameManager.createGameOverDialog] gameOverPanel不存在，但仍会创建弹窗');
        }
        
        // 创建弹窗容器 - 直接放到Canvas的最上层，而不是gameOverPanel
        const canvas = find('Canvas');
        this.gameOverDialog = new Node('GameOverDialog');
        if (canvas) {
            // 先创建/更新全屏遮罩，阻止所有点击
            this.createOrUpdateGameOverMask(canvas);

            this.gameOverDialog.setParent(canvas);
            // 设置到Canvas的最上层（高于遮罩）
            this.gameOverDialog.setSiblingIndex(Number.MAX_SAFE_INTEGER);
        } else {
            // 如果找不到Canvas，回退到gameOverPanel
            this.gameOverDialog.setParent(this.gameOverPanel);
        }
        this.gameOverDialog.setPosition(0, 100, 0); // 向上移300像素
        
        // 添加UITransform组件
        const dialogTransform = this.gameOverDialog.addComponent(UITransform);
        dialogTransform.setContentSize(500, 600); // 弹窗大小（增加高度以容纳伤害统计图表）
        
        // 创建弹窗背景（使用Graphics绘制半透明背景）
        const graphics = this.gameOverDialog.addComponent(Graphics);
        graphics.fillColor = new Color(30, 30, 30, 230); // 深色半透明背景
        const width = 500;
        const height = 600; // 增加高度
        const cornerRadius = 10; // 圆角半径
        graphics.roundRect(-width / 2, -height / 2, width, height, cornerRadius);
        graphics.fill();
        
        // 绘制边框
        graphics.strokeColor = new Color(200, 200, 200, 255);
        graphics.lineWidth = 2;
        graphics.roundRect(-width / 2, -height / 2, width, height, cornerRadius);
        graphics.stroke();

        // 阻止所有输入事件穿透到游戏中的单位、网格、按钮等
        this.gameOverDialog.addComponent(BlockInputEvents);
        
        // 将相关UI元素移动到弹窗中
        if (this.gameOverPanel) {
            this.moveUIElementsToDialog();
        } else {
            // 如果gameOverPanel不存在，创建必要的UI元素
            this.createGameOverUIElements();
        }
    }

    /**
     * 创建或更新游戏结束时的全屏遮罩，阻止任何点击穿透到游戏内单位 / 网格 / 按钮
     */
    private createOrUpdateGameOverMask(canvas: Node) {
        if (this.gameOverMask && this.gameOverMask.isValid) {
            this.gameOverMask.setParent(canvas);
        } else {
            this.gameOverMask = new Node('GameOverMask');
            this.gameOverMask.setParent(canvas);

            // 覆盖整个屏幕
            const uiTransform = this.gameOverMask.addComponent(UITransform);
            const visibleSize = view.getVisibleSize();
            uiTransform.setContentSize(visibleSize.width * 2, visibleSize.height * 2);
            this.gameOverMask.setPosition(0, 0, 0);

            // 可选：轻微透明度的黑色遮罩（也可以不画，只用于阻止点击）
            // 这里画一个很淡的透明层，如果你不想变暗，可以把 alpha 改成 0
            const graphics = this.gameOverMask.addComponent(Graphics);
            graphics.fillColor = new Color(0, 0, 0, 0); // 完全透明，只做点击拦截
            graphics.rect(-visibleSize.width, -visibleSize.height, visibleSize.width * 2, visibleSize.height * 2);
            graphics.fill();

            // 关键：阻止所有输入事件穿透
            this.gameOverMask.addComponent(BlockInputEvents);
        }

        // 遮罩在 Canvas 顶层，但低于弹窗本身
        this.gameOverMask.setSiblingIndex(Number.MAX_SAFE_INTEGER - 1);
        this.gameOverMask.active = true;
    }
    
    /**
     * 创建游戏结束UI元素（当gameOverPanel不存在时）
     */
    private createGameOverUIElements() {
        if (!this.gameOverDialog) {
            return;
        }
        
        // 创建结果标签（如果不存在）
        if (!this.gameOverLabel) {
            const labelNode = new Node('GameOverLabel');
            labelNode.setParent(this.gameOverDialog);
            labelNode.setPosition(0, 100, 0);
            this.gameOverLabel = labelNode.addComponent(Label);
            this.gameOverLabel.string = '胜利！';
            this.gameOverLabel.fontSize = 48;
            this.gameOverLabel.color = new Color(255, 255, 255, 255);
            this.gameOverLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.gameOverLabel.verticalAlign = Label.VerticalAlign.CENTER;
        }
        
        // 创建经验值标签（如果不存在）
        if (!this.expLabel) {
            const expNode = new Node('ExpLabel');
            expNode.setParent(this.gameOverDialog);
            expNode.setPosition(0, 0, 0);
            this.expLabel = expNode.addComponent(Label);
            this.expLabel.string = '';
            this.expLabel.fontSize = 18;
            this.expLabel.color = new Color(200, 200, 200, 255);
            this.expLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.expLabel.verticalAlign = Label.VerticalAlign.CENTER;
        }
    }
    
    /**
     * 将UI元素移动到弹窗中
     */
    private moveUIElementsToDialog() {
        if (!this.gameOverDialog || !this.gameOverPanel) {
            return;
        }
        
        // 移动结果标签到弹窗（如果不在弹窗中）
        if (this.gameOverLabel && this.gameOverLabel.node && this.gameOverLabel.node.parent !== this.gameOverDialog) {
            this.gameOverLabel.node.setParent(this.gameOverDialog);
        }
        
        // 移动经验值标签到弹窗（如果不在弹窗中）
        if (this.expLabel && this.expLabel.node && this.expLabel.node.parent !== this.gameOverDialog) {
            this.expLabel.node.setParent(this.gameOverDialog);
        }
        
        // 移动退出游戏按钮到弹窗（如果不在弹窗中）
        if (this.exitGameButton && this.exitGameButton.node && this.exitGameButton.node.parent !== this.gameOverDialog) {
            this.exitGameButton.node.setParent(this.gameOverDialog);
        }
        
        // 移动重新开始按钮到弹窗（如果不在弹窗中）
        let restartButtonNode = this.gameOverPanel.getChildByName('RestartButton');
        if (!restartButtonNode && this.gameOverDialog) {
            restartButtonNode = this.gameOverDialog.getChildByName('RestartButton');
        }
        if (restartButtonNode && restartButtonNode.parent !== this.gameOverDialog) {
            restartButtonNode.setParent(this.gameOverDialog);
        }
    }
    
    /**
     * 调整游戏结束UI的布局
     * 布局顺序（从上到下）：结果标签 -> 伤害统计图表 -> 「关卡奖励」分界线 -> 经验值标签 -> 退出游戏按钮 -> 重新开始按钮
     */
    private layoutGameOverUI() {
        if (!this.gameOverDialog) {
            return;
        }
        
        // 从弹窗中查找重新开始按钮
        let restartButtonNode = this.gameOverDialog.getChildByName('RestartButton');
        if (!restartButtonNode && this.gameOverPanel) {
            restartButtonNode = this.gameOverPanel.getChildByName('RestartButton');
        }
        if (!restartButtonNode) {
            return;
        }
        
        // 所有元素相对于弹窗中心定位（弹窗中心为0,0）
        const spacing = 20;           // 通用元素间距
        const buttonSpacing = 30;     // 按钮与经验值标签之间的间距
        let currentY = 250;           // 从弹窗中心上方开始（结果标签位置，因为面板高度增加了）
        
        // 结果标签位置（最上方）
        if (this.gameOverLabel && this.gameOverLabel.node) {
            this.gameOverLabel.node.setPosition(0, currentY, 0);
            const labelTransform = this.gameOverLabel.node.getComponent(UITransform);
            const labelHeight = labelTransform ? labelTransform.height : 60;
            currentY = currentY - labelHeight / 2 - spacing;
        }
        
        // 伤害统计图表位置（使用固定Y坐标，与是否获得经验无关）
        const damageStatsNode = this.gameOverDialog.getChildByName('DamageStatsPanel');
        if (damageStatsNode) {
            const statsTransform = damageStatsNode.getComponent(UITransform);
            // 为防止某些情况下 UITransform 高度被意外改成 0，增加一个下限
            const statsHeight = statsTransform ? Math.max(150, statsTransform.height) : 150;
        }
        
        // 「关卡奖励」分界线位置（固定Y，与是否获得经验、本局数据无关）
        let rewardTitleNode = this.gameOverDialog.getChildByName('RewardTitle');
        if (!rewardTitleNode) {
            rewardTitleNode = new Node('RewardTitle');
            rewardTitleNode.setParent(this.gameOverDialog);

            const rewardLabel = rewardTitleNode.addComponent(Label);
            rewardLabel.string = '———— 关卡奖励 ————';
            rewardLabel.fontSize = 24;
            rewardLabel.color = new Color(255, 215, 0, 255);
            rewardLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            rewardLabel.verticalAlign = Label.VerticalAlign.CENTER;

            const rewardTransform = rewardTitleNode.addComponent(UITransform);
            rewardTransform.setContentSize(400, 30);
        } else {
            const rewardLabel = rewardTitleNode.getComponent(Label);
            if (rewardLabel) {
                rewardLabel.string = '———— 关卡奖励 ————';
                rewardLabel.fontSize = 24;
                rewardLabel.color = new Color(255, 215, 0, 255);
                rewardLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
                rewardLabel.verticalAlign = Label.VerticalAlign.CENTER;
            }
        }

        // 固定坐标：贡献榜中心在 y = 125，分界线在 y = 0（可根据美术需要再微调）
        if (damageStatsNode) {
            const statsTransform2 = damageStatsNode.getComponent(UITransform);
            const statsHeight2 = statsTransform2 ? Math.max(150, statsTransform2.height) : 150;
            const fixedStatsCenterY = 125;
            damageStatsNode.setPosition(0, fixedStatsCenterY, 0);
           //console.info(`[GameManager.layoutGameOverUI] set DamageStatsPanel y=${fixedStatsCenterY}, height=${statsHeight2}`);
        }
        rewardTitleNode.setPosition(0, 0, 0);
       //console.info('[GameManager.layoutGameOverUI] set RewardTitle y=0');

        // 从分界线下方的一个固定位置开始布局经验区域和按钮，保证与经验无关
        currentY = -40;
        
        // 经验区域布局（经验文字 + 等级进度条），使用固定坐标，避免出现文字重叠
        // 1）当有经验时：经验文字整体稍微向下，等级+进度条整体稍微向上，形成清晰的上下分区
        // 2）当无经验时：仅按一个固定高度预留空间，保证按钮位置稳定
        const defaultExpAreaHeight = 80; // 经验区域的“标准高度”
        if (this.showExpSectionInGameOver && this.expLabel && this.expLabel.node && this.expLabel.node.active) {
            // 经验说明文字字体大小与进度条上方的等级文字保持一致（20）
            this.expLabel.fontSize = 20;

            // 固定经验文字和进度条的Y坐标（根据你的要求微调）：
            //  - 进度条整体下移 10 像素
            //  - 经验文字整体下移 20 像素
            const fixedLevelBarY = -60;   // 原 -50，下移 10
            const fixedExpTextY = -135;   // 原 -105，下移 20

            // 摆放经验文字
            this.expLabel.node.setPosition(0, fixedExpTextY, 0);

            // 如果存在等级进度条，则摆放在略高的位置
            if (this.gameOverLevelBarBg && this.gameOverLevelBarBg.isValid && this.gameOverLevelBarBg.active) {
                this.gameOverLevelBarBg.setPosition(0, fixedLevelBarY, 0);
            }

            // 经验区域整体高度近似：从进度条顶部到经验文字底部，这里取一个略大于 defaultExpAreaHeight 的固定值
            const expAreaTotalHeight = 110; // 经验区域实际高度（进度条 + 文字）
            // 经验区域底部Y（用于摆放按钮）：略低于经验文字
            const expAreaBottomY = fixedExpTextY - expAreaTotalHeight / 2;
            currentY = expAreaBottomY - buttonSpacing;
        } else {
            // 不显示经验标签时，也按默认高度预留空间，保证按钮位置稳定
            currentY = currentY - defaultExpAreaHeight / 2 - buttonSpacing;
        }
        
        // 退出游戏按钮与重新开始按钮在同一行并排显示（整体稍微下移约 40 像素）
        const restartButtonTransform = restartButtonNode.getComponent(UITransform);
        const restartButtonHeight = restartButtonTransform ? restartButtonTransform.height : 50;

        let exitButtonNode = this.exitGameButton && this.exitGameButton.node ? this.exitGameButton.node : null;
        let exitButtonHeight = 50;
        if (exitButtonNode) {
            const exitButtonTransform = exitButtonNode.getComponent(UITransform);
            if (exitButtonTransform) {
                exitButtonHeight = exitButtonTransform.height;
            }
        }

        const rowHeight = Math.max(restartButtonHeight, exitButtonHeight);
        const buttonY = currentY - rowHeight / 2 + 10;

        // 左侧：退出按钮
        if (exitButtonNode) {
            exitButtonNode.setPosition(-80, buttonY, 0);
        }

        // 右侧：重新开始按钮
        restartButtonNode.setPosition(80, buttonY, 0);

        // 复活按钮：与两按钮 Y 坐标一致，放在“重置游戏”右侧
        if (this.reviveButtonNode && this.reviveButtonNode.isValid && this.reviveButtonNode.active) {
            const reviveTr = this.reviveButtonNode.getComponent(UITransform);
            const restartTr2 = restartButtonNode.getComponent(UITransform);
            if (reviveTr && restartTr2) {
                // 尺寸与“重置游戏”一致
                reviveTr.setContentSize(restartTr2.width, restartTr2.height);
            }
            const restartPos2 = restartButtonNode.position.clone();
            const offsetX = (restartTr2 ? restartTr2.width : 100) + 30; // 向右一个按钮宽度 + 间距
            this.reviveButtonNode.setPosition(restartPos2.x + offsetX, buttonY, restartPos2.z);
        }

        // 更新 currentY（如果后续还要布局其他元素）
        currentY = buttonY - rowHeight / 2 - spacing;
    }
    
    /**
     * 将游戏结束弹窗置于面板最上层
     */
    private setGameOverUIOnTop() {
        if (!this.gameOverDialog) {
            return;
        }
        
        // 如果弹窗的父节点是Canvas，直接设置到Canvas的最上层
        const canvas = find('Canvas');
        if (canvas && this.gameOverDialog.parent === canvas) {
            this.gameOverDialog.setSiblingIndex(canvas.children.length - 1);
            return;
        }
        
        // 否则，设置到gameOverPanel的最上层
        if (!this.gameOverPanel) {
            return;
        }
        
        const children = this.gameOverPanel.children;
        if (children.length === 0) {
            return;
        }
        
        const maxIndex = children.length - 1;
        
        // 将弹窗置于最上层
        this.gameOverDialog.setSiblingIndex(maxIndex);
        
        // 确保弹窗内的元素也正确排序（从下到上）
        const dialogChildren = this.gameOverDialog.children;
        if (dialogChildren.length > 0) {
            const dialogMaxIndex = dialogChildren.length - 1;
            
            // 重新开始按钮（最下方）
            const restartButtonNode = this.gameOverDialog.getChildByName('RestartButton');
            if (restartButtonNode) {
                restartButtonNode.setSiblingIndex(0);
            }
            
            // 退出游戏按钮
            if (this.exitGameButton && this.exitGameButton.node) {
                this.exitGameButton.node.setSiblingIndex(1);
            }
            
            // 经验值标签
            if (this.expLabel && this.expLabel.node) {
                this.expLabel.node.setSiblingIndex(2);
            }
            
            // 结果标签（最上方）
            if (this.gameOverLabel && this.gameOverLabel.node) {
                this.gameOverLabel.node.setSiblingIndex(dialogMaxIndex);
            }
        }
    }
    
    /**
     * 如果expLabel未设置，尝试在gameOverPanel中创建经验值标签
     * @param expGained 本次获得的经验值
     * @param talentPointsGained 本次获得的天赋点
     */
    private createExpLabelIfNeeded(expGained: number = 0, talentPointsGained: number = 0) {
        if (!this.gameOverPanel || this.expLabel) {
            return;
        }
        
        // 查找gameOverLabel作为参考位置
        const gameOverLabelNode = this.gameOverPanel.getChildByName('GameOverLabel');
        if (!gameOverLabelNode) {
            return;
        }
        
        // 创建经验值 / 升级信息标签
        const expLabelNode = new Node('ExpLabel');
        expLabelNode.setParent(this.gameOverPanel);
        
        const label = expLabelNode.addComponent(Label);
        label.string = '';
        label.fontSize = 28; // 调大字体
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.TOP;
        label.lineHeight = 32; // 相应调整行高
        
        const transform = expLabelNode.addComponent(UITransform);
        transform.setContentSize(400, 80); // 增加高度以容纳多行文本
        
        // 设置位置在gameOverLabel下方（往上移，保持在重新开始和建造按钮之间）
        const gameOverLabelTransform = gameOverLabelNode.getComponent(UITransform);
        if (gameOverLabelTransform) {
            // 先获取gameOverLabel的位置，如果它已经被调整过，使用调整后的位置
            let gameOverLabelPos = gameOverLabelNode.position;
            // 如果gameOverLabel在默认位置（接近0），则使用调整后的位置
            if (Math.abs(gameOverLabelPos.y) < 10) {
                gameOverLabelPos = new Vec3(gameOverLabelPos.x, 80, gameOverLabelPos.z);
            }
            expLabelNode.setPosition(gameOverLabelPos.x, gameOverLabelPos.y - 60, 0);
        } else {
            expLabelNode.setPosition(0, 20, 0); // 往上移到Y=20位置
        }
        
        this.expLabel = label;
    }

    cleanupAllUnitsForEndGame() {
        const scene = director.getScene();
        if (!scene) return;

        // 清理所有敌人（直接销毁）
        const enemiesNode = find('Canvas/Enemies');
        if (enemiesNode) {
            const enemies = enemiesNode.children.slice(); // 复制数组
            for (const enemy of enemies) {
                if (enemy && enemy.isValid) {
                    // 直接销毁，不播放死亡动画
                    enemy.destroy();
                }
            }
        }

        // 停止所有防御塔移动
        const towersNode = find('Canvas/Towers');
        if (towersNode) {
            const towers = towersNode.children; // 不需要复制数组，因为不销毁
            for (const tower of towers) {
                if (tower && tower.isValid) {
                    const towerScript = tower.getComponent('Arrower') as any;
                    if (towerScript && towerScript.stopMoving) {
                        towerScript.stopMoving();
                        // 也要停止攻击动画和逻辑
                        if (towerScript.currentTarget) {
                            towerScript.currentTarget = null!;
                        }
                    }
                }
            }
        }

        // 清理所有ThunderChain（防止游戏失败后继续执行导致报错）
        this.cleanupAllThunderChains();
    }

    /**
     * 清理所有ThunderChain
     */
    private cleanupAllThunderChains() {
        const scene = director.getScene();
        if (!scene) return;

        // 查找所有ThunderChain节点（可能在Canvas下，也可能在其他地方）
        const findThunderChains = (node: Node): Node[] => {
            const chains: Node[] = [];
            if (node && node.isValid) {
                const chainComponent = node.getComponent('ThunderChain');
                if (chainComponent) {
                    chains.push(node);
                }
                // 递归查找子节点
                for (const child of node.children) {
                    chains.push(...findThunderChains(child));
                }
            }
            return chains;
        };

        // 从Canvas开始查找
        const canvas = find('Canvas');
        if (canvas) {
            const chains = findThunderChains(canvas);
            for (const chain of chains) {
                if (chain && chain.isValid) {
                    // 调用destroyChain方法（如果存在）
                    const chainScript = chain.getComponent('ThunderChain') as any;
                    if (chainScript && chainScript.destroyChain) {
                        chainScript.destroyChain();
                    } else {
                        // 如果方法不存在，直接销毁
                        chain.destroy();
                    }
                }
            }
        }
    }

    /**
     * 清理所有单位（用于重置游戏）
     */
    cleanupAllUnitsForReset() {
        const scene = director.getScene();
        if (!scene) return;

      //console.log('[GameManager] 开始清理所有单位...');

        // 清理所有敌人
        const enemiesNode = find('Canvas/Enemies');
        if (enemiesNode) {
            const enemies = enemiesNode.children.slice();
          //console.log(`[GameManager] 清理 ${enemies.length} 个敌人`);
            for (const enemy of enemies) {
                if (enemy && enemy.isValid) {
                    enemy.destroy();
                }
            }
        }

        // 清理所有我方单位
        // 注意：Priests和Towers共用Canvas/Towers容器，Wisps在Canvas/Wisps容器
        const unitContainers = [
            'Canvas/Towers',     // 包含Towers和Priests
            'Canvas/Hunters',    // 猎手
            'Canvas/Mages',      // 法师
            'Canvas/Swordsmen',  // 剑士
            'Canvas/Wisps'       // 小精灵（重要：必须清理）
        ];

        for (const containerPath of unitContainers) {
            const containerNode = find(containerPath);
            if (containerNode) {
                const units = containerNode.children.slice();
                if (units.length > 0) {
                  //console.log(`[GameManager] 清理 ${containerPath}: ${units.length} 个单位`);
                }
                for (const unit of units) {
                    if (unit && unit.isValid) {
                        const roleScript = unit.getComponent('Role') as any;
                        if (roleScript && roleScript.destroyRole) {
                            roleScript.destroyRole();
                        } else {
                            unit.destroy();
                        }
                    }
                }
            }
        }

        // 清理所有建筑物（包括石墙、哨塔以及其他建筑容器）
        const buildingContainers = [
            'Canvas/WarAncientTrees',
            'Canvas/HunterHalls',
            'Canvas/MageTowers',
            'Canvas/SwordsmanHalls',
            'Canvas/Churches',
            'Canvas/StoneWalls',
            'Canvas/WatchTowers',
            'Canvas/IceTowers',
            'Canvas/ThunderTowers'
        ];

        for (const containerPath of buildingContainers) {
            const containerNode = find(containerPath);
            if (containerNode) {
                const buildings = containerNode.children.slice();
                if (buildings.length > 0) {
                  //console.log(`[GameManager] 清理 ${containerPath}: ${buildings.length} 个建筑`);
                }
                for (const building of buildings) {
                    if (building && building.isValid) {
                        // 在销毁建筑前，先清理建筑内部的trainedUnits数组
                        const buildScript = building.getComponent('Build') as any;
                        if (buildScript) {
                            // 清理战争古树的producedTowers数组
                            if (buildScript.producedTowers && Array.isArray(buildScript.producedTowers)) {
                                buildScript.producedTowers = [];
                            }
                            // 清理其他建筑的trainedUnits数组
                            if (buildScript.trainedUnits && Array.isArray(buildScript.trainedUnits)) {
                                buildScript.trainedUnits = [];
                            }
                            // 调用销毁方法
                            if (buildScript.destroyBuild) {
                                buildScript.destroyBuild();
                            } else {
                                building.destroy();
                            }
                        } else {
                            building.destroy();
                        }
                    }
                }
            }
        }

        // 清理所有萨满图腾（如果还有残留，强制销毁）
        const totems = scene.getComponentsInChildren(ShamanTotem);
        for (const totem of totems) {
            if (totem && totem.node && totem.node.isValid) {
                totem.node.destroy();
            }
        }

        // 兜底：如果场景中还有战争古树实例，强制销毁，避免等级状态残留
        const warAncientTrees = scene.getComponentsInChildren(WarAncientTree);
        for (const tree of warAncientTrees) {
            if (tree && tree.node && tree.node.isValid) {
                tree.node.destroy();
            }
        }

      //console.log('[GameManager] 所有单位清理完成');
    }

    /**
     * 重新开始一局时重置 GameManager 的局内状态（金币 / 时间 / 血量等）
     */
    resetGameStateForRestart() {
      //console.log('[GameManager] 开始重置游戏状态...');
        
        // 清除所有增益效果
        const buffManager = BuffManager.getInstance();
        buffManager.clearAllBuffs();
        
        // 清空建筑物对象池，避免残留状态导致错误
        const buildingPool = BuildingPool.getInstance();
        if (buildingPool) {
            buildingPool.clearAllPools();
          //console.log('[GameManager] 已清空建筑物对象池');
        }
        
        // 清空单位对象池
        const unitPool = UnitPool.getInstance();
        if (unitPool) {
            unitPool.clearAllPools();
          //console.log('[GameManager] 已清空单位对象池');
        }
        
        // 重置基础数值
        this.gameTime = 0;
        this.gold = 30;              // 初始金币固定为 30
        this.wood = 50;              // 初始木材固定为 50
        this.population = 0;
        this.currentGameExp = 0;
        this.hasShownPopulationLimitWarning = false;
        this.hasShownFirstArrowerDeathPopup = false;
        this.appearedUnitTypes.clear();
        this.shownFirstBuffCardLevels.clear();
        this.hasShownLevel2MageTowerUnlockIntro = false;
        this.hasShownLevel2HunterTornadoAwakenIntro = false;
        this.hasShownArrowerNeedPriestDialog = false;
        this.hasShownPriestProtectBuildingDialog = false;
        this.hasShownGoldReach100ArrowerDialog = false;
        this.hasShownArrowerSuggestBuildWhenWood60 = false;
        this.pendingHighlightChurchCandidateAfterBuild = false;
        this.pendingHighlightSwordsmanHallCandidateAfterBuild = false;
        this.buildButtonBattleHintBlinkSeqId++;
        this.lastDefenseStructureHealthSnapshot = -1;
        this.lastFriendlyUnitCountSnapshot = -1;
        this.gameState = GameState.Ready;

        // 重置水晶（血量和等级）
        if (this.crystalScript) {
            // 恢复到默认等级和满血
            this.crystalScript.level = 1;
            // 直接重置 currentHealth 和销毁标记
            (this.crystalScript as any).currentHealth = this.crystalScript.getMaxHealth();
            (this.crystalScript as any).isDestroyed = false;

            // 确保水晶节点激活
            if (this.crystal && this.crystal.isValid) {
                this.crystal.active = true;
            }
        }

        // 更新一次 UI（血量 / 金币 / 时间等）
        this.updateUI();
        
      //console.log('[GameManager] 游戏状态重置完成');
    }

    getGameState(): GameState {
        return this.gameState;
    }
    
    /**
     * 暂停游戏
     */
    pauseGame() {
        // 设置游戏状态为暂停
        this.gameState = GameState.Paused;
        
        // 保存当前时间缩放值（如果当前为 0，则保存为 1，确保恢复时能正常工作）
        const currentTimeScale = director.getScheduler().getTimeScale();
        this.originalTimeScale = currentTimeScale > 0 ? currentTimeScale : 1;
        
        // 暂停游戏时间
        director.getScheduler().setTimeScale(0);
        
        //console.info(`[GameManager] pauseGame() 游戏已暂停，保存的 timeScale=${this.originalTimeScale}`);
        
    }
    
    /**
     * 继续游戏
     */
    resumeGame() {
        // 设置游戏状态为继续
        this.gameState = GameState.Playing;
        
        // 恢复游戏时间（确保 timeScale 至少为 1，避免恢复为 0）
        const targetTimeScale = this.originalTimeScale > 0 ? this.originalTimeScale : 1;
        director.getScheduler().setTimeScale(targetTimeScale);
        this.originalTimeScale = targetTimeScale; // 更新保存的值，确保下次暂停时能正确恢复
        
        //console.info(`[GameManager] resumeGame() 游戏已恢复，timeScale=${targetTimeScale}`);
        
        // 通知所有单位游戏已恢复，确保动画能够正确播放
        this.notifyGameResumed();
    }
    
    /**
     * 显示全屏加载界面（用于首次加载分包和预制体时）
     */
    private showLoadingOverlay() {
        if (this.loadingOverlay && this.loadingOverlay.isValid) {
            this.loadingOverlay.active = true;
            return;
        }

        const canvas = find('Canvas');
        if (!canvas) {
            return;
        }

        const overlay = new Node('LoadingOverlay');
        overlay.setParent(canvas);

        const uiTransform = overlay.addComponent(UITransform);
        const vs = view.getVisibleSize();
        uiTransform.setContentSize(vs.width, vs.height);
        overlay.setPosition(0, 0, 0);

        // 全屏半透明背景
        const bg = overlay.addComponent(Graphics);
        bg.fillColor = new Color(0, 0, 0, 200);
        bg.rect(-vs.width / 2, -vs.height / 2, vs.width, vs.height);
        bg.fill();

        // 阻止点击穿透
        overlay.addComponent(BlockInputEvents);

        // 进度条背景
        const barBgNode = new Node('LoadingBarBg');
        barBgNode.setParent(overlay);
        const barBgTrans = barBgNode.addComponent(UITransform);
        barBgTrans.setContentSize(this.loadingBarMaxWidth, 30);
        barBgNode.setPosition(0, -20, 0);

        const barBgG = barBgNode.addComponent(Graphics);
        barBgG.fillColor = new Color(40, 40, 40, 255);
        barBgG.roundRect(-this.loadingBarMaxWidth / 2, -15, this.loadingBarMaxWidth, 30, 15);
        barBgG.fill();

        // 进度条前景
        const barNode = new Node('LoadingBar');
        barNode.setParent(barBgNode);
        const barTrans = barNode.addComponent(UITransform);
        barTrans.setAnchorPoint(0, 0.5);
        barTrans.setContentSize(this.loadingBarMaxWidth, 22);
        barNode.setPosition(-this.loadingBarMaxWidth / 2, 0, 0);

        const barG = barNode.addComponent(Graphics);
        barG.fillColor = new Color(120, 200, 255, 255);
        barG.roundRect(0, -11, this.loadingBarMaxWidth, 22, 11);
        barG.fill();
        barNode.setScale(0, 1, 1);

        // 进度文字
        const labelNode = new Node('LoadingLabel');
        labelNode.setParent(overlay);
        this.loadingLabel = labelNode.addComponent(Label);
        this.loadingLabel.string = '正在加载... 0%';
        this.loadingLabel.fontSize = 22;
        this.loadingLabel.color = new Color(255, 255, 255, 255);
        this.loadingLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.loadingLabel.verticalAlign = Label.VerticalAlign.CENTER;
        const labelTrans = labelNode.addComponent(UITransform);
        labelTrans.setContentSize(400, 40);
        labelNode.setPosition(0, 30, 0);

        this.loadingOverlay = overlay;
        this.loadingBarNode = barNode;
        // 初始进度 0
        this.updateLoadingProgress(0);
    }

    /**
     * 更新加载界面的进度（0~1）
     */
    private updateLoadingProgress(progress: number) {
        const p = Math.max(0, Math.min(1, progress));
        if (this.loadingBarNode && this.loadingBarNode.isValid) {
            this.loadingBarNode.setScale(p, 1, 1);
        }
        if (this.loadingLabel && this.loadingLabel.isValid) {
            const percent = Math.round(p * 100);
            this.loadingLabel.string = `正在加载... ${percent}%`;
        }
    }

    /**
     * 隐藏并销毁加载界面
     */
    private hideLoadingOverlay() {
        if (this.loadingOverlay && this.loadingOverlay.isValid) {
            this.loadingOverlay.destroy();
        }
        this.loadingOverlay = null;
        this.loadingBarNode = null;
        this.loadingLabel = null;
    }
    
    /**
     * 开始游戏（对外入口）：先确保加载分包目录 prefabs_sub 下的所有预制体，再执行真正的开始逻辑
     */
    startGame() {
      //console.log('startGame' + this.gameState.toString());

        // 新开一局：重置复活按钮状态
        this.reviveUsedThisRun = false;
        this.hideReviveButton();

        // 如果分包还未加载，先加载分包和其中的所有预制体，然后再继续开始游戏逻辑
        if (!this.prefabsSubLoaded) {
            if (this.isLoadingPrefabsSub) {
                // 已经在加载中，避免重复触发
                return;
            }

            this.isLoadingPrefabsSub = true;
            //console.info('[GameManager] 开始加载分包 prefabs_sub');

            // 首次加载时显示全屏加载读条
            this.showLoadingOverlay();
            // 初始进度 0
            this.updateLoadingProgress(0);

                // 加载步骤: 1) 加载 bundle (20%)  2) 九个预制体 (共 80%，线性分配)
            assetManager.loadBundle('prefabs_sub', (err, bundle) => {
                if (err) {
                    console.error('[GameManager] 加载分包 prefabs_sub 失败:', err);
                    this.isLoadingPrefabsSub = false;
                    this.hideLoadingOverlay();
                    return;
                }

                if (!bundle) {
                    console.error('[GameManager] 分包 prefabs_sub 加载结果为空');
                    this.isLoadingPrefabsSub = false;
                    this.hideLoadingOverlay();
                    return;
                }

                // bundle 成功，进度到 20%
                this.updateLoadingProgress(0.2);

                // 直接按名字加载分包中的几个建筑预制体（石墙、冰塔、雷塔、哨塔、战争古树、猎手大厅、剑士小屋、教堂）
                //console.info('[GameManager] 开始从分包 prefabs_sub 加载建筑预制体 StoneWall / IceTower / ThunderTower / WatchTower / WarAncientTree / HunterHall / SwordsmanHall / Church');

                const loadPrefab = (name: string, stepIndex: number, totalSteps: number, onLoaded: (prefab: Prefab | null) => void) => {
                    bundle.load(name, Prefab, (err2, prefab) => {
                        if (err2 || !prefab) {
                            console.error('[GameManager] 从分包 prefabs_sub 加载预制体失败:', name, err2);
                            onLoaded(null);
                        } else {
                            //console.info('[GameManager] 从分包 prefabs_sub 成功加载预制体:', name);
                            onLoaded(prefab as Prefab);
                        }

                        // 每个预制体完成后更新进度：0.2 ~ 1.0 之间线性分配
                        const base = 0.2;
                        const remain = 0.8;
                        const p = base + remain * (stepIndex / totalSteps);
                        this.updateLoadingProgress(p);
                    });
                };

                // 仅在第二关加载 MageTower，避免拖慢第一关
                const currentLevelForPrefabLoad = this.getCurrentLevelSafe();
                const shouldLoadMageTower = currentLevelForPrefabLoad !== 1;
                // 顺序加载基础建筑预制体；MageTower 仅在第二关追加为第9步
                const totalSteps = shouldLoadMageTower ? 9 : 8;

                const finalizeInjection = (
                    stoneWallPrefab: Prefab | null,
                    iceTowerPrefab: Prefab | null,
                    thunderTowerPrefab: Prefab | null,
                    watchTowerPrefab: Prefab | null,
                    warAncientTreePrefab: Prefab | null,
                    hunterHallPrefab: Prefab | null,
                    swordsmanHallPrefab: Prefab | null,
                    churchPrefab: Prefab | null,
                    mageTowerPrefab: Prefab | null
                ) => {
                    try {
                        const towerBuilder = this.findComponentInScene('TowerBuilder') as any;
                        if (towerBuilder) {
                            if (stoneWallPrefab && typeof towerBuilder.setStoneWallPrefab === 'function') {
                                towerBuilder.setStoneWallPrefab(stoneWallPrefab);
                            }
                            if (iceTowerPrefab && typeof towerBuilder.setIceTowerPrefab === 'function') {
                                towerBuilder.setIceTowerPrefab(iceTowerPrefab);
                            }
                            if (thunderTowerPrefab && typeof towerBuilder.setThunderTowerPrefab === 'function') {
                                towerBuilder.setThunderTowerPrefab(thunderTowerPrefab);
                            }
                            if (watchTowerPrefab && typeof towerBuilder.setWatchTowerPrefab === 'function') {
                                towerBuilder.setWatchTowerPrefab(watchTowerPrefab);
                            }
                            if (warAncientTreePrefab && typeof towerBuilder.setWarAncientTreePrefab === 'function') {
                                towerBuilder.setWarAncientTreePrefab(warAncientTreePrefab);
                            }
                            if (hunterHallPrefab && typeof towerBuilder.setHunterHallPrefab === 'function') {
                                towerBuilder.setHunterHallPrefab(hunterHallPrefab);
                            }
                            if (swordsmanHallPrefab && typeof towerBuilder.setSwordsmanHallPrefab === 'function') {
                                towerBuilder.setSwordsmanHallPrefab(swordsmanHallPrefab);
                            }
                            if (churchPrefab && typeof towerBuilder.setChurchPrefab === 'function') {
                                towerBuilder.setChurchPrefab(churchPrefab);
                            }

                            if (shouldLoadMageTower) {
                                if (mageTowerPrefab && typeof towerBuilder.setMageTowerPrefab === 'function') {
                                  //console.info('[GameManager] non-level1: MageTower prefab loaded, injecting to TowerBuilder');
                                    towerBuilder.setMageTowerPrefab(mageTowerPrefab as Prefab);
                                } else {
                                    console.warn('[GameManager] non-level1: MageTower prefab load failed or TowerBuilder lacks setMageTowerPrefab');
                                }
                            } else {
                              //console.info('[GameManager] level1: skip MageTower prefab load');
                            }

                            if (typeof towerBuilder.refreshBuildingTypes === 'function') {
                                towerBuilder.refreshBuildingTypes();
                            }
                        } else {
                            console.warn('[GameManager] TowerBuilder 组件不存在，无法注入分包预制体');
                        }
                    } catch (e) {
                        console.error('[GameManager] 注入分包建筑预制体到 TowerBuilder 时出错:', e);
                    }

                    this.prefabsSubLoaded = true;
                    this.isLoadingPrefabsSub = false;
                    this.updateLoadingProgress(1);
                    this.hideLoadingOverlay();
                    this._startGameInternal();
                };

                loadPrefab('StoneWall', 1, totalSteps, (stoneWallPrefab) => {
                    loadPrefab('IceTower', 2, totalSteps, (iceTowerPrefab) => {
                        loadPrefab('ThunderTower', 3, totalSteps, (thunderTowerPrefab) => {
                            loadPrefab('WatchTower', 4, totalSteps, (watchTowerPrefab) => {
                                loadPrefab('WarAncientTree', 5, totalSteps, (warAncientTreePrefab) => {
                                    loadPrefab('HunterHall', 6, totalSteps, (hunterHallPrefab) => {
                                        loadPrefab('SwordsmanHall', 7, totalSteps, (swordsmanHallPrefab) => {
                                            loadPrefab('Church', 8, totalSteps, (churchPrefab) => {
                                                if (shouldLoadMageTower) {
                                                    loadPrefab('MageTower', 9, totalSteps, (mageTowerPrefab) => {
                                                        finalizeInjection(
                                                            stoneWallPrefab, iceTowerPrefab, thunderTowerPrefab, watchTowerPrefab,
                                                            warAncientTreePrefab, hunterHallPrefab, swordsmanHallPrefab, churchPrefab, mageTowerPrefab
                                                        );
                                                    });
                                                } else {
                                                    finalizeInjection(
                                                        stoneWallPrefab, iceTowerPrefab, thunderTowerPrefab, watchTowerPrefab,
                                                        warAncientTreePrefab, hunterHallPrefab, swordsmanHallPrefab, churchPrefab, null
                                                    );
                                                }
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });

            return;
        }

        // 分包已加载，直接执行内部开始逻辑
        this._startGameInternal();
    }

    /**
     * 真正的开始游戏逻辑（在分包加载完成后调用）
     */
    private _startGameInternal() {
        // 启动伤害统计
        const damageStats = DamageStatistics.getInstance();
        damageStats.startRecording();
        // 确保时间缩放正常（防止退出时暂停导致的问题）
        const currentTimeScale = director.getScheduler().getTimeScale();
        if (currentTimeScale === 0) {
            director.getScheduler().setTimeScale(1);
            this.originalTimeScale = 1;
        }
        
        // 无论游戏状态如何，只要开始游戏，都应该切换到游戏BGM（前提是玩家没有关闭BGM开关）
        const soundManager = SoundManager.getInstance();
        if (soundManager && soundManager.isBgmOn()) {
            //console.info('[GameManager] _startGameInternal() switching to game BGM (backMusic1)');
            soundManager.playGameBgm();
        } else {
            //console.info('[GameManager] _startGameInternal() BGM is disabled, skip playing game BGM');
        }
        
        // 关卡读取必须与埋点解耦，否则 analyticsManager 不存在时会错误回落到第1关
        let level = this.getCurrentLevelSafe();
      //console.info('[GameManager._startGameInternal] resolved level =', level, 'gameState =', this.gameState);
        // 开始记录埋点数据（如果可用）
        if (this.analyticsManager) {
            this.analyticsManager.startRecording(level);
            this.totalKillCount = 0;
        }

        if (this.gameState === GameState.Paused) {
            // 如果游戏已暂停，恢复游戏
            this.resumeGame();
        } else if (this.gameState === GameState.Ready) {
            // 如果游戏准备就绪，开始游戏
            this.gameState = GameState.Playing;
            
            // 显示所有游戏元素
            this.showGameElements();

            // 启动动态背景切换
            this.startDynamicBackground(level);

            // 游戏正式开始时，让生命之树自动训练一个小精灵
            const crystalComp = this.findComponentInScene('Crystal') as any;
            if (crystalComp && crystalComp.autoTrainWispIfPossible) {
                this.scheduleOnce(() => {
                    crystalComp.autoTrainWispIfPossible();
                }, 0.2);
            }

            // 开局在石墙网格顶行生成初始石墙与哨塔
            // 注意：这里传入的是组件名 'TowerBuilder'，而不是节点路径
            const towerBuilder = this.findComponentInScene('TowerBuilder') as any;
            if (towerBuilder && towerBuilder.spawnInitialStoneWalls) {
                // 0 帧延迟，等于等待一帧，确保网格面板初始化完成
                this.scheduleOnce(() => {
                    towerBuilder.spawnInitialStoneWalls(14);
                    // 生成初始哨塔（在石墙网格中随机生成3个）
                    // 延迟执行，确保所有组件的start方法都已执行完毕，避免影响其他组件的初始化
                    if (towerBuilder.spawnInitialWatchTowers) {
                        //console.info('[GameManager] 开始生成初始哨塔');
                        this.scheduleOnce(() => {
                            towerBuilder.spawnInitialWatchTowers(3);
                        }, 0.1); // 延迟0.1秒，确保所有组件初始化完成
                    }

                    // 第1~4关额外生成一个初始弓箭手小屋：建筑物网格固定位置
                    if (level >= 1 && level <= 4 && towerBuilder.spawnInitialWarAncientTreeForLevel1) {
                        this.scheduleOnce(() => {
                            towerBuilder.spawnInitialWarAncientTreeForLevel1();
                        }, 0.05);
                    }

                    // 第2关额外生成一个初始法师塔（参考自动生成弓箭手小屋）
                    if (level === 2 && towerBuilder.spawnInitialMageTowerForLevel2) {
                        this.scheduleOnce(() => {
                          //console.info('[GameManager] trigger spawnInitialMageTowerForLevel2 from start flow');
                            towerBuilder.spawnInitialMageTowerForLevel2();
                        }, 0.08);
                    } else {
                        console.info('[GameManager] skip initial mage tower spawn in start flow:', 'level=', level, 'hasMethod=', !!towerBuilder?.spawnInitialMageTowerForLevel2);
                    }
                }, 0);
            }

            // 生成敌人传送门（画面上方一排三个）
            this.scheduleOnce(() => {
                this.spawnInitialEnemyPortals();
            }, 0.15);
        } else if (this.gameState !== GameState.Playing) {
            // 如果游戏已结束，重新开始游戏
            this.restartGame();
        }
    }
    
    /**
     * 通知所有单位游戏已恢复
     */
    notifyGameResumed() {
        const scene = director.getScene();
        if (!scene) return;
        
        // 递归查找所有单位节点
        const findAllUnits = (node: Node) => {
            // 检查当前节点是否是可移动单位
            const hunterScript = node.getComponent('Hunter') as any;
            const arrowerScript = node.getComponent('Arrower') as any;
            
            // 恢复移动动画
            if (hunterScript) {
                // 无论当前状态如何，都重新检查移动状态并恢复动画
                this.scheduleOnce(() => {
                    if (hunterScript.node && hunterScript.node.isValid) {
                        // 检查是否有手动移动目标
                        if (hunterScript.manualMoveTarget) {
                            // 有手动移动目标，确保isMoving为true并重新启动移动动画
                            hunterScript.isMoving = true;
                            if (hunterScript.playMoveAnimation) {
                                hunterScript.playMoveAnimation();
                            }
                        } 
                        // 检查是否有自动寻敌目标
                        else if (hunterScript.currentTarget && hunterScript.currentTarget.isValid) {
                            try {
                                // 有自动寻敌目标，直接设置isMoving为true并启动移动动画
                                // 简化逻辑，避免类型检查报错
                                hunterScript.isMoving = true;
                                if (hunterScript.playMoveAnimation) {
                                    hunterScript.playMoveAnimation();
                                }
                            } catch (error) {
                            }
                        }
                    }
                }, 0.1);
            } else if (arrowerScript) {
                // 恢复弓箭手的移动动画
                if (arrowerScript.isMoving && arrowerScript.playMoveAnimation) {
                    arrowerScript.playMoveAnimation();
                }
            }
            
            // 递归检查子节点
            for (const child of node.children) {
                findAllUnits(child);
            }
        };
        
        findAllUnits(scene);
    }

    /**
     * 从场景递归查找指定组件（按组件名字符串）
     */
    private findComponentInScene(componentName: string): Component | null {
        const scene = director.getScene();
        if (!scene) return null;

        const dfs = (node: Node): Component | null => {
            const comp = node.getComponent(componentName);
            if (comp) {
                return comp;
            }
            for (const child of node.children) {
                const found = dfs(child);
                if (found) return found;
            }
            return null;
        };

        return dfs(scene);
    }
    
    /**
     * 在画面上方生成三个敌人传送门（使用用户提供的传送门预制体）
     * - 优先从分包 'prefabs_sub' 加载 'Portal'
     * - 回退到主包 resources.load('Portal')
     * - 容器：Canvas/Portals（不存在则创建）
     * - 位置：y=1200，x为[-400, 0, 400]
     */
    private spawnInitialEnemyPortals() {
        const createContainer = (): Node | null => {
            const canvas = find('Canvas');
            if (!canvas) return null;
            // 优先放入 Enemies 容器，确保可被单位索敌/攻击；若不存在则退回到 Portals
            let enemies = find('Canvas/Enemies');
            if (enemies) {
                return enemies;
            }
            let container = find('Canvas/Portals');
            if (!container) {
                container = new Node('Portals');
                canvas.addChild(container);
            }
            return container;
        };
        const container = createContainer();
        if (!container) {
            console.warn('[GameManager] spawnInitialEnemyPortals: 未找到 Canvas，跳过创建传送门');
            return;
        }
        // 调整容器层级：确保不遮挡 HUD/UI，且不低于背景
        try {
            const canvasNode = find('Canvas');
            if (canvasNode) {
                const children = canvasNode.children;
                let uiIndex = -1;
                let bgIndex = -1;
                const uiNode = find('Canvas/UI') || find('Canvas/HUD') || find('Canvas/TopUI');
                const bgNode = find('Canvas/Background') || find('Canvas/BG') || find('Canvas/Back');
                if (uiNode) uiIndex = uiNode.getSiblingIndex();
                if (bgNode) bgIndex = bgNode.getSiblingIndex();
                if (uiIndex >= 0) {
                    const targetIndex = Math.max(0, uiIndex - 1);
                    container.setSiblingIndex(targetIndex);
                } else if (bgIndex >= 0) {
                    container.setSiblingIndex(bgIndex + 1);
                } else {
                    const mid = Math.floor(children.length / 2);
                    container.setSiblingIndex(Math.max(0, mid));
                }
            }
        } catch (e) {
            // 忽略异常，保持默认层级
        }
        // 根据画布宽度动态计算三个位点，避免超出屏幕
        const canvas = find('Canvas');
        const ui = canvas ? canvas.getComponent(UITransform) : null;
        const halfW = ui ? ui.contentSize.width * 0.5 : 480; // 兜底宽度为960
        const margin = 160; // 边缘留白，避免越界
        const offsetX = 360; // 整体向右平移（原300基础上再+100）
        const leftX = -halfW + margin + offsetX;
        const rightX = halfW - margin + offsetX;
        const midX = 0 + offsetX;
        const y = 1260; // 上移50
        const positions = [new Vec3(leftX, y, 0), new Vec3(midX, y, 0), new Vec3(rightX, y, 0)];
        const tryInstantiate = (prefab: Prefab | null) => {
            if (!prefab) {
                console.warn('[GameManager] spawnInitialEnemyPortals: 传送门预制体为空，放弃生成');
                return;
            }
            // 顶部三个传送门（保持原有机制）
            for (const pos of positions) {
                const node = instantiate(prefab);
                node.setParent(container);
                node.setWorldPosition(pos);
                node.active = true;
            }
        };
        // 优先使用分包 bundle
        const sub = assetManager.getBundle('prefabs_sub');
        if (sub) {
            sub.load('Portal', Prefab, (err, prefab) => {
                if (err || !prefab) {
                    // 回退到主包 resources
                    resources.load('Portal', Prefab, (err2, prefab2) => {
                        if (err2 || !prefab2) {
                            console.warn('[GameManager] spawnInitialEnemyPortals: 无法从分包或主包加载 Portal 预制体');
                            return;
                        }
                        tryInstantiate(prefab2 as Prefab);
                    });
                    return;
                }
                tryInstantiate(prefab as Prefab);
            });
        } else {
            // 无分包时直接从主包尝试
            resources.load('Portal', Prefab, (err2, prefab2) => {
                if (err2 || !prefab2) {
                    console.warn('[GameManager] spawnInitialEnemyPortals: 主包未能加载 Portal 预制体');
                    return;
                }
                tryInstantiate(prefab2 as Prefab);
            });
        }
    }

    /**
     * 从第三波开始可调用：随机左/右侧出现“传送门预告”图标（textures/show.png，放大2倍，闪烁10秒），随后替换为传送门并开启独立刷怪。
     */
    public spawnRandomSidePortalWithIndicator() {
        // 关卡 1、2 不生成侧面传送门
        try {
            const level = this.getCurrentLevelSafe ? this.getCurrentLevelSafe() : 1;
            if (typeof level === 'number' && level < 3) {
                //console.info('[SidePortal] skip on level < 3, level=', level);
                return;
            }
        } catch {}
        try { console.log('[SidePortal] spawnRandomSidePortalWithIndicator called'); } catch {}
        const createContainer = (): Node | null => {
            const canvas = find('Canvas');
            if (!canvas) return null;
            let enemies = find('Canvas/Enemies');
            if (enemies) return enemies;
            let container = find('Canvas/Portals');
            if (!container) {
                container = new Node('Portals');
                canvas.addChild(container);
            }
            // 层级调整：不遮挡 HUD/UI
            try {
                const uiNode = find('Canvas/UI') || find('Canvas/HUD') || find('Canvas/TopUI');
                if (uiNode) {
                    container.setSiblingIndex(Math.max(0, uiNode.getSiblingIndex() - 1));
                }
            } catch {}
            return container;
        };
        const container = createContainer();
        if (!container) {
            console.warn('[GameManager] spawnRandomSidePortalWithIndicator: no container');
            return;
        }
        // 计算左右侧位点
        const canvas = find('Canvas');
        const ui = canvas ? canvas.getComponent(UITransform) : null;
        const halfW = ui ? ui.contentSize.width * 0.5 : 480;
        const sideMargin = 160;
        const offsetX = 360;
        const sideLeftX = -halfW + sideMargin + offsetX;
        const sideRightX = halfW - sideMargin + offsetX;
        const baseY = 900;
        const randY = baseY - Math.random() * 200; // 在当前基准往下200像素内的随机位置
        const sidePos = Math.random() < 0.5 ? new Vec3(sideLeftX, randY, 0) : new Vec3(sideRightX, randY, 0);
        try { console.log('[SidePortal] indicator target pos =', sidePos.x, sidePos.y, 'container=', container?.name); } catch {}

        // 先创建“预告”图标：textures/show（参考传送门生成的“空间裂缝”可视化：使用不透明度淡入/淡出循环）
        const placeIndicator = (sf: SpriteFrame | null) => {
            const n = new Node('PortalIndicator');
            n.setParent(container);
            n.setWorldPosition(sidePos);
            try { console.log('[SidePortal] indicator node created under', n.parent?.name, 'worldPos=', sidePos.x, sidePos.y); } catch {}
            // 图标
            const sp = n.addComponent(Sprite);
            if (sf) sp.spriteFrame = sf;
            // 确保尺寸可见：使用自定义尺寸为原图的2倍
            try {
                (sp as any).sizeMode = (Sprite as any).SizeMode.CUSTOM;
                const tr = n.getComponent(UITransform) || n.addComponent(UITransform);
                const os = (sf as any)?.originalSize;
                if (tr && os && typeof os.width === 'number' && typeof os.height === 'number') {
                    tr.setContentSize(Math.max(32, os.width * 2), Math.max(32, os.height * 2));
                } else {
                    tr.setContentSize(96, 96);
                }
                try { const size = (n.getComponent(UITransform) as UITransform)?.contentSize; console.log('[SidePortal] indicator size =', size?.width, size?.height); } catch {}
            } catch {
                n.setScale(2, 2, 2);
            }
            // 置于容器顶端，避免被同容器内其他节点遮挡
            try { n.setSiblingIndex(Number.MAX_SAFE_INTEGER - 1); } catch {}
            const opacity = n.addComponent(UIOpacity);
            opacity.opacity = 0; // 从透明开始
            // 参考“裂缝”效果：淡入-停留-淡出，循环播放直到转换为传送门
            const oneCycle = tween(opacity)
                .to(0.12, { opacity: 255 })
                .delay(0.18)
                .to(0.15, { opacity: 60 });
            tween(opacity).repeatForever(oneCycle).start();
            try { console.log('[SidePortal] indicator blink tween started'); } catch {}

            const spawnPortalAt = (pos: Vec3) => {
                // 停止并移除指示
                if (n && n.isValid) n.destroy();
                try { console.log('[SidePortal] indicator ended, spawning portal at', pos.x, pos.y); } catch {}
                const trySpawn = (prefab: Prefab | null) => {
                    if (!prefab) {
                        console.warn('[GameManager] spawnRandomSidePortalWithIndicator: Portal prefab null');
                        return;
                    }
                    const p = instantiate(prefab);
                    p.setParent(container);
                    p.setWorldPosition(pos);
                    p.active = true;
                    const portal = p.getComponent('Portal') as any;
                    if (portal) {
                        portal.enableAutoSummon = true;
                        portal.isSidePortal = true;
                        portal.spawnTimestampMs = Date.now();
                        portal.autoSummonMinInterval = 3.0;
                        portal.autoSummonMaxInterval = 6.0;
                    }
                    try { console.log('[SidePortal] portal spawned node=', p?.name, 'parent=', p?.parent?.name); } catch {}
                };
                // 分包优先
                const sub = assetManager.getBundle('prefabs_sub');
                if (sub) {
                    sub.load('Portal', Prefab, (err, prefab) => {
                        if (err || !prefab) {
                            try { console.warn('[SidePortal] subbundle load Portal failed, fallback to resources', err); } catch {}
                            resources.load('Portal', Prefab, (e2, p2) => trySpawn((p2 as Prefab) || null));
                            return;
                        }
                        try { console.log('[SidePortal] subbundle Portal loaded'); } catch {}
                        trySpawn(prefab as Prefab);
                    });
                } else {
                    try { console.log('[SidePortal] no subbundle, loading Portal from resources'); } catch {}
                    resources.load('Portal', Prefab, (e2, p2) => trySpawn((p2 as Prefab) || null));
                }
            };

            // 10秒后生成传送门
            this.scheduleOnce(() => spawnPortalAt(sidePos), 10.0);
            try { console.log('[SidePortal] scheduled portal spawn in 10s at', sidePos.x, sidePos.y); } catch {}

            // 指示出现2秒后：触发单位介绍框提示一次
            this.scheduleOnce(() => {
                try {
                    const arrower = typeof (this as any)['getFirstActiveUnitScriptInContainers'] === 'function'
                        ? (this as any)['getFirstActiveUnitScriptInContainers'](['Canvas/Towers'], 'Arrower')
                        : null;
                    if (arrower && typeof (this as any)['showQuickUnitIntro'] === 'function') {
                        (this as any)['showQuickUnitIntro'](
                            arrower,
                            '弓箭手',
                            '指挥官，敌人展开了突袭！小心从战场两翼出现的传送门。',
                            'Arrower'
                        );
                        try { console.log('[SidePortal] quick unit intro shown'); } catch {}
                    }
                } catch {}
            }, 2.0);
        };

        // 加载 show.png（resources/textures/show）- 兼容多种导入形态与路径
        const tryLoadShowSpriteFrame = (onReady: (sf: SpriteFrame | null) => void) => {
            // 方案A：直接按 SpriteFrame 资源加载（若导入为精灵帧）
            resources.load('textures/show', SpriteFrame, (errA, sfA) => {
                if (!errA && sfA) {
                    try { console.log('[SidePortal] textures/show loaded as SpriteFrame'); } catch {}
                    onReady(sfA as SpriteFrame);
                    return;
                }
                try { console.warn('[SidePortal] load SpriteFrame textures/show failed, try spriteFrame path', errA); } catch {}
                // 方案B：部分版本需要显式 '/spriteFrame'
                resources.load('textures/show/spriteFrame', SpriteFrame, (errB, sfB) => {
                    if (!errB && sfB) {
                        try { console.log('[SidePortal] textures/show/spriteFrame loaded'); } catch {}
                        onReady(sfB as SpriteFrame);
                        return;
                    }
                    try { console.warn('[SidePortal] load SpriteFrame textures/show/spriteFrame failed, try Texture2D', errB); } catch {}
                    // 方案C：按纹理加载后临时创建 SpriteFrame
                    resources.load('textures/show', Texture2D, (errC, tex) => {
                        if (!errC && tex) {
                            try {
                                const sf = new SpriteFrame();
                                sf.texture = tex as Texture2D;
                                console.log('[SidePortal] textures/show loaded as Texture2D, created SpriteFrame');
                                onReady(sf);
                            } catch (e) {
                                console.warn('[SidePortal] create SpriteFrame from Texture2D failed', e);
                                onReady(null);
                            }
                            return;
                        }
                        try { console.warn('[SidePortal] load Texture2D textures/show failed, give up', errC); } catch {}
                        onReady(null);
                    });
                });
            });
        };
        tryLoadShowSpriteFrame((sf) => {
            if (!sf) {
                console.warn('[GameManager] 加载 textures/show 失败，仍然创建无图标的指示节点');
                placeIndicator(null);
                return;
            }
            placeIndicator(sf);
        });
    }

    /**
     * 安排在延时后重新触发一次侧面传送门预告与生成
     */
    public scheduleSidePortalRespawnAfter(delaySeconds: number) {
        const sec = Math.max(0.1, delaySeconds || 0);
        this.scheduleOnce(() => {
            this.spawnRandomSidePortalWithIndicator();
        }, sec);
    }

    /**
     * 检查单位是否首次出现
     * @param unitType 单位类型
     * @param unitScript 单位脚本
     * @returns 是否首次出现
     */
    checkUnitFirstAppearance(unitType: string, unitScript: any): boolean {
        // 使用单位名称作为唯一标识，确保每种单位只显示一次介绍框
        // 优先使用unitScript.unitName，否则使用unitType
        const uniqueUnitType = unitScript.unitName || unitType;

        if (!this.appearedUnitTypes.has(uniqueUnitType)) {
            this.appearedUnitTypes.add(uniqueUnitType);

            // 更新调试数组
            this.debugUnitTypes = Array.from(this.appearedUnitTypes);

            // 特殊建筑首次出现时不弹单位介绍框：弓箭手小屋 / 猎手大厅 / 法师塔 / 剑士小屋 / 教堂
            const introBlockedNames = new Set<string>(['弓箭手小屋', '猎手大厅', '法师塔', '剑士小屋', '教堂']);
            const shouldShowIntro = !introBlockedNames.has(uniqueUnitType);
            const isFirstArrower = unitType === 'Arrower' || unitScript?.unitType === 'Arrower' || unitScript?.prefabName === 'Arrower' || uniqueUnitType === '弓箭手';
            const isFirstSwordsman =
                unitType === 'ElfSwordsman' ||
                unitScript?.unitType === 'ElfSwordsman' ||
                unitScript?.prefabName === 'ElfSwordsman' ||
                uniqueUnitType === '精灵剑士' ||
                uniqueUnitType === '剑士';

            if (isFirstArrower && shouldShowIntro) {
                const baseCloseCallback = this.getIntroCloseCallback(uniqueUnitType);
                this.showUnitIntro(unitScript, () => {
                    if (baseCloseCallback) {
                        baseCloseCallback();
                    }
                    this.triggerFirstArrowerBowstringFlow(unitScript);
                });
            } else if (isFirstArrower) {
                this.triggerFirstArrowerBowstringFlow(unitScript);
            } else if (isFirstSwordsman && shouldShowIntro) {
                const baseCloseCallback = this.getIntroCloseCallback(uniqueUnitType);
                this.showUnitIntro(unitScript, () => {
                    if (baseCloseCallback) {
                        baseCloseCallback();
                    }
                    this.triggerFirstSwordsmanSharpenFlow(unitScript);
                });
            } else if (isFirstSwordsman) {
                this.triggerFirstSwordsmanSharpenFlow(unitScript);
            } else if (shouldShowIntro) {
                this.showUnitIntro(unitScript, this.getIntroCloseCallback(uniqueUnitType));
            }

            return true;
        }

        return false;
    }

    /**
     * 首个弓箭手：延迟触发“紧弓弦”剧情与小游戏
     */
    private triggerFirstArrowerBowstringFlow(arrowerScript: any) {
        if (this.hasTriggeredFirstArrowerBowstringMiniGame) {
            return;
        }
        this.hasTriggeredFirstArrowerBowstringMiniGame = true;

        // 固定 5 秒后出现请求帮助对话
        const delay = 5;
        this.scheduleOnce(() => {
            if (this.gameState !== GameState.Playing) {
                return;
            }
            if (!arrowerScript || !arrowerScript.node || !arrowerScript.node.isValid || !arrowerScript.node.active) {
                return;
            }
            this.showFirstArrowerHelpIntro(arrowerScript);
        }, delay);
    }

    private showFirstArrowerHelpIntro(arrowerScript: any) {
        this.autoCreateUnitIntroPopup();
        if (!this.unitIntroPopup) {
            return;
        }
        const icon = arrowerScript?.cardIcon || arrowerScript?.defaultSpriteFrame || null;
        this.unitIntroPopup.show({
            unitName: '弓箭手',
            unitDescription: '指挥官，帮我紧一紧弓弦。',
            unitIcon: icon,
            unitType: 'Arrower',
            unitId: 'Arrower',
            onCloseCallback: () => {
                // 首次出现流程：不需要“先松开一次”的门闩（否则会出现部分区域点击不触发开始的体感问题）
                this.showBowstringMiniGame(arrowerScript, false);
            }
        });
    }

    /**
     * @param requireReleaseGuard 仅当从技能按钮点击触发时为 true，用于吞掉“按钮那一次输入残留”
     */
    private showBowstringMiniGame(arrowerScript: any, requireReleaseGuard: boolean = false) {
        if (this.bowstringMiniGameRoot && this.bowstringMiniGameRoot.isValid) {
            this.stopBowstringHoldLoopSfx();
            this.bowstringMiniGameRoot.destroy();
        }

        const canvas = find('Canvas');
        if (!canvas) {
            return;
        }

        this.bowstringMiniGameTargetArrower = arrowerScript;
        this.bowstringMiniGameFinalized = false;
        this.bowstringMiniGameHold = false;
        this.bowstringMiniGameHasStartedHold = false;
        this.bowstringMiniGameIgnoreEndUntilMs = 0;
        this.bowstringMiniGameCycleTime = 0;
        this.bowstringMiniGameEnergyValue = 0;
        (this as any).__bowstringLoggedHoldTick = false;
        this.bowstringMiniGameHoldAudioSource = null;
        this.bowstringMiniGameAnimSprite = null;
        this.bowstringMiniGameAnimFrames = Array.isArray(arrowerScript?.bowstringTensionFrames)
            ? (arrowerScript.bowstringTensionFrames as SpriteFrame[]).filter(Boolean)
            : [];
        this.clearBowstringRealtimeLoop();
        this.pauseGame();
        // 防止“点击技能按钮抬手/点击残留事件”导致立刻进入长按态
        this.bowstringMiniGameInputEnableAtMs = Date.now() + 180;
        // 技能按钮触发时，往往当前那次按下还未结束：必须先看到一次 release，才允许开始 hold
        this.bowstringMiniGameWaitFirstRelease = !!requireReleaseGuard;
        if (!this.bowstringMiniGameWaitFirstRelease) {
            // 非技能触发：仍需防止 touch-end + mouse-up 同时到来造成的误结算
            this.bowstringMiniGameIgnoreEndUntilMs = Date.now() + 120;
        }
        // console.log(
        //     `[BowstringMiniGame] open t=${Date.now()} enableAt=${this.bowstringMiniGameInputEnableAtMs} waitFirstRelease=${this.bowstringMiniGameWaitFirstRelease} requireReleaseGuard=${requireReleaseGuard}`,
        //     arrowerScript?.node?.uuid
        // );

        const root = new Node('BowstringMiniGame');
        root.setParent(canvas);
        root.setSiblingIndex(Number.MAX_SAFE_INTEGER - 2);
        this.bowstringMiniGameRoot = root;
        root.addComponent(BlockInputEvents);

        // 专用 AudioSource：用于“4秒 mp3 播完后自动循环直到松开”
        this.bowstringMiniGameHoldAudioSource = root.addComponent(AudioSource);
        this.bowstringMiniGameHoldAudioSource.loop = true;

        const rootTr = root.addComponent(UITransform);
        rootTr.setContentSize(view.getVisibleSize().width * 2, view.getVisibleSize().height * 2);
        root.setPosition(0, 0, 0);

        const mask = root.addComponent(Graphics);
        mask.fillColor = new Color(0, 0, 0, 180);
        const vs = view.getVisibleSize();
        mask.rect(-vs.width, -vs.height, vs.width * 2, vs.height * 2);
        mask.fill();

        const panel = new Node('MiniGamePanel');
        panel.setParent(root);
        panel.setPosition(0, 0, 0);
        const panelTr = panel.addComponent(UITransform);
        panelTr.setContentSize(400, 400);
        const panelBg = panel.addComponent(Graphics);
        panelBg.fillColor = new Color(25, 25, 35, 245);
        panelBg.roundRect(-200, -200, 400, 400, 14);
        panelBg.fill();

        const titleNode = new Node('Title');
        titleNode.setParent(panel);
        titleNode.setPosition(0, 172, 0);
        titleNode.addComponent(UITransform).setContentSize(360, 32);
        const title = titleNode.addComponent(Label);
        title.string = '长按调整弓弦松紧';
        title.fontSize = 20;
        title.color = new Color(240, 240, 255, 255);
        title.horizontalAlign = Label.HorizontalAlign.CENTER;
        title.verticalAlign = Label.VerticalAlign.CENTER;

        // 左侧：弓弦动态区（序列帧从弓箭手预制体读取）
        const left = new Node('BowStringAnim');
        left.setParent(panel);
        left.setPosition(-105, -8, 0);
        left.addComponent(UITransform).setContentSize(150, 280);
        const leftBg = left.addComponent(Graphics);
        leftBg.fillColor = new Color(48, 48, 68, 255);
        leftBg.roundRect(-75, -140, 150, 280, 8);
        leftBg.fill();
        const animNode = new Node('BowStringAnimSprite');
        animNode.setParent(left);
        animNode.setPosition(0, 16, 0);
        animNode.addComponent(UITransform).setContentSize(126, 210);
        this.bowstringMiniGameAnimSprite = animNode.addComponent(Sprite);
        this.bowstringMiniGameAnimSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        if (this.bowstringMiniGameAnimFrames.length > 0) {
            this.bowstringMiniGameAnimSprite.spriteFrame = this.bowstringMiniGameAnimFrames[0];
        }

        const leftTipNode = new Node('LeftTip');
        leftTipNode.setParent(left);
        leftTipNode.setPosition(0, -118, 0);
        leftTipNode.addComponent(UITransform).setContentSize(136, 24);
        const leftTip = leftTipNode.addComponent(Label);
        leftTip.string = this.bowstringMiniGameAnimFrames.length > 0 ? '陪伴100年的弓弦' : '弓弦';
        leftTip.fontSize = 16;
        leftTip.color = new Color(180, 190, 220, 255);
        leftTip.horizontalAlign = Label.HorizontalAlign.CENTER;
        leftTip.verticalAlign = Label.VerticalAlign.CENTER;

        // 右侧：能量条区
        const right = new Node('EnergyPanel');
        right.setParent(panel);
        right.setPosition(112, -8, 0);
        right.addComponent(UITransform).setContentSize(150, 280);
        const rightBg = right.addComponent(Graphics);
        rightBg.fillColor = new Color(48, 48, 68, 255);
        rightBg.roundRect(-75, -140, 150, 280, 8);
        rightBg.fill();

        const barX = -20;
        const barY = -110;
        const barW = 40;
        const barH = 220;
        const barFrame = new Node('EnergyBarFrame');
        barFrame.setParent(right);
        barFrame.addComponent(UITransform).setContentSize(60, 188);
        const barFrameG = barFrame.addComponent(Graphics);
        barFrameG.strokeColor = new Color(220, 220, 245, 255);
        barFrameG.lineWidth = 2;
        barFrameG.roundRect(barX - 4, barY - 4, barW + 8, barH + 8, 4);
        barFrameG.stroke();

        const highlightHeight = 28;
        const hl = new Node('MidHighlight');
        hl.setParent(right);
        hl.addComponent(UITransform).setContentSize(64, highlightHeight);
        const hlg = hl.addComponent(Graphics);
        hlg.fillColor = new Color(255, 220, 80, 100);
        hlg.roundRect(barX - 8, -highlightHeight / 2, barW + 16, highlightHeight, 4);
        hlg.fill();

        // 中间附近的“次优区域”轻微高亮，便于与远离中间区域区分
        const nearTop = new Node('NearMidTop');
        nearTop.setParent(right);
        nearTop.addComponent(UITransform).setContentSize(64, 24);
        const nearTopG = nearTop.addComponent(Graphics);
        nearTopG.fillColor = new Color(255, 235, 140, 45);
        nearTopG.roundRect(barX - 8, 18, barW + 16, 24, 4);
        nearTopG.fill();

        const nearBottom = new Node('NearMidBottom');
        nearBottom.setParent(right);
        nearBottom.addComponent(UITransform).setContentSize(64, 24);
        const nearBottomG = nearBottom.addComponent(Graphics);
        nearBottomG.fillColor = new Color(255, 235, 140, 45);
        nearBottomG.roundRect(barX - 8, -42, barW + 16, 24, 4);
        nearBottomG.fill();

        const fillNode = new Node('EnergyFill');
        fillNode.setParent(right);
        fillNode.addComponent(UITransform).setContentSize(60, 188);
        this.bowstringMiniGameEnergyFill = fillNode.addComponent(Graphics);

        const needleNode = new Node('EnergyNeedle');
        needleNode.setParent(right);
        needleNode.addComponent(UITransform).setContentSize(70, 8);
        this.bowstringMiniGameNeedle = needleNode.addComponent(Graphics);

        const tipNode = new Node('Tip');
        tipNode.setParent(panel);
        tipNode.setPosition(0, -176, 0);
        tipNode.addComponent(UITransform).setContentSize(360, 28);
        const tip = tipNode.addComponent(Label);
        tip.string = '长按屏幕蓄力，松开即确定（中间高亮最佳）';
        tip.fontSize = 14;
        tip.color = new Color(208, 216, 245, 255);
        tip.horizontalAlign = Label.HorizontalAlign.CENTER;
        tip.verticalAlign = Label.VerticalAlign.CENTER;

        this.refreshBowstringEnergyVisual(barX, barY, barW, barH);

        const onStart = (event?: any) => {
            const now = Date.now();
            const type = event?.type || 'unknown';
            const loc = (event?.getUILocation && event.getUILocation()) || (event?.getLocation && event.getLocation());
            // console.log(
            //     `[BowstringMiniGame] onStart t=${now} type=${type} waitFirstRelease=${this.bowstringMiniGameWaitFirstRelease} enableAt=${this.bowstringMiniGameInputEnableAtMs}`,
            //     loc ? `x=${Math.round(loc.x)} y=${Math.round(loc.y)}` : ''
            // );
            // 仅在保护窗口期拦截“按钮残留输入”；窗口后第一下真实触控应允许直接开始长按
            if (this.bowstringMiniGameWaitFirstRelease && now < this.bowstringMiniGameInputEnableAtMs) return;
            if (this.bowstringMiniGameWaitFirstRelease && now >= this.bowstringMiniGameInputEnableAtMs) {
                this.bowstringMiniGameWaitFirstRelease = false;
                this.bowstringMiniGameIgnoreEndUntilMs = 0;
            }
            if (now < this.bowstringMiniGameInputEnableAtMs) return;
            // 防止 touch-start + mouse-down 同时触发导致重复进入 hold
            if (this.bowstringMiniGameHold) {
                return;
            }
            this.bowstringMiniGameHold = true;
            this.bowstringMiniGameHasStartedHold = true;
            // 长按开始：播放并循环，直到松开/结算
            this.startBowstringHoldLoopSfx();
          //console.log(`[BowstringMiniGame] hold=true t=${now}`);
        };
        const onEnd = (event?: any) => {
            const now = Date.now();
            const type = event?.type || 'unknown';
            // console.log(
            //     `[BowstringMiniGame] onEnd t=${now} type=${type} hold=${this.bowstringMiniGameHold} waitFirstRelease=${this.bowstringMiniGameWaitFirstRelease}`
            // );
            // 同一次物理抬手可能同时触发 touch-end + mouse-up：短窗口内忽略重复 end
            if (now < (this.bowstringMiniGameIgnoreEndUntilMs || 0)) {
              //console.log(`[BowstringMiniGame] end ignored (dup window) t=${now}`);
                return;
            }
            // 第一次 release 仅用于“清空技能按钮那次输入残留”，不触发结算
            // if (this.bowstringMiniGameWaitFirstRelease) {
            //     this.bowstringMiniGameWaitFirstRelease = false;
            //     this.bowstringMiniGameIgnoreEndUntilMs = now + 120;
            //     console.log(`[BowstringMiniGame] first release consumed t=${now}`);
            //     return;
            // }
            // 没有真正开始过长按（hold 从未进入过 true），不允许结算，避免“自动结束/闪一下就没”
            if (!this.bowstringMiniGameHasStartedHold) {
              //console.log(`[BowstringMiniGame] end ignored (never started hold) t=${now}`);
                return;
            }
            this.finalizeBowstringMiniGame();
        };

        root.on(Node.EventType.TOUCH_START, onStart, this, true);
        root.on(Node.EventType.TOUCH_END, onEnd, this, true);
        root.on(Node.EventType.TOUCH_CANCEL, onEnd, this, true);
        root.on(Node.EventType.MOUSE_DOWN, onStart, this, true);
        root.on(Node.EventType.MOUSE_UP, onEnd, this, true);
        root.on(Node.EventType.MOUSE_LEAVE, onEnd, this, true);

        this.startBowstringRealtimeLoop(barX, barY, barW, barH);
    }

    /**
     * 弓弦小游戏：开始“长按循环音效”
     * - 音效资源从弓箭手预制体字段 `bowstringHoldSound` 读取
     * - 使用专用 AudioSource.loop=true，使得 4 秒 mp3 播完后自动重播，直到松开
     */
    private startBowstringHoldLoopSfx() {
        const clip = this.bowstringMiniGameTargetArrower?.bowstringHoldSound;
        const src = this.bowstringMiniGameHoldAudioSource;
        if (!clip || !src || !src.node || !src.node.isValid) return;

        // 音量跟随 AudioManager 的 sfxVolume（如果存在）
        try {
            const am = AudioManager.Instance;
            if (am && typeof (am as any).getSFXVolume === 'function') {
                src.volume = Math.max(0, Math.min(1, Number((am as any).getSFXVolume()) || 0.8));
            }
        } catch (e) {
            // ignore
        }

        src.clip = clip;
        if (src.playing) {
            src.stop();
        }
        src.play();
    }

    /**
     * 弓弦小游戏：停止“长按循环音效”
     */
    private stopBowstringHoldLoopSfx() {
        const src = this.bowstringMiniGameHoldAudioSource;
        if (!src || !src.node || !src.node.isValid) return;
        try {
            if (src.playing) {
                src.stop();
            }
        } catch (e) {
            // ignore
        }
    }

    /**
     * 获取弓弦技能全局冷却剩余秒数（所有弓箭手共享）    */
    public getBowstringSkillGlobalCooldownRemainingSec(): number {
        const now = Date.now();
        const remainMs = Math.max(0, (this.bowstringSkillGlobalCooldownEndMs || 0) - now);
        return remainMs / 1000;
    }

    /**
     * 启动弓弦技能全局冷却（所有弓箭手共享）    */
    public startBowstringSkillGlobalCooldown(cooldownMs: number) {
        this.bowstringSkillGlobalCooldownEndMs = Date.now() + cooldownMs;
        this.startBowstringCooldownRefreshLoop();
    }

    private startBowstringCooldownRefreshLoop() {
        // 清除旧循环
        if (this.bowstringSkillCooldownRefreshLoopId !== null) {
            clearInterval(this.bowstringSkillCooldownRefreshLoopId);
            this.bowstringSkillCooldownRefreshLoopId = null;
        }
        this.bowstringSkillCooldownRefreshLoopId = setInterval(() => {
            const remain = this.getBowstringSkillGlobalCooldownRemainingSec();
            // 扫描所有弓箭手，刷新当前被选中的那个的面板
            this.refreshSelectedArrowerPanel();
            if (remain <= 0.01) {
                clearInterval(this.bowstringSkillCooldownRefreshLoopId!);
                this.bowstringSkillCooldownRefreshLoopId = null;
                this.refreshSelectedArrowerPanel(); // 冷却结束再刷一次
            }
        }, 200) as unknown as number;
    }

    private refreshSelectedArrowerPanel() {
        // 找到 UnitSelectionManager，获取当前选中的弓箭手并刷新面板
        const canvas = find('Canvas');
        if (!canvas) return;
        const usmNode = find('Canvas/UnitSelectionManager') || canvas.getChildByName('UnitSelectionManager');
        if (!usmNode) return;
        const usm = usmNode.getComponent('UnitSelectionManager') as any;
        if (!usm) return;
        const unitInfoPanel = usm.unitInfoPanel;
        if (!unitInfoPanel || !unitInfoPanel.updateButtons) return;
        // 获取当前选中单位
        const selectedUnit = usm.getCurrentSelectedUnit ? usm.getCurrentSelectedUnit() : null;
        if (!selectedUnit || !selectedUnit.isValid) return;
        const arrower = selectedUnit.getComponent('Arrower') as any;
        if (!arrower) return;
        if (arrower.buildArrowerUnitInfo) {
            unitInfoPanel.updateButtons(arrower.buildArrowerUnitInfo());
        }
    }

    /**
     * 获取磨剑技能全局冷却剩余秒数（所有剑士共享）
     */
    public getSwordSharpenSkillGlobalCooldownRemainingSec(): number {
        const now = Date.now();
        const remainMs = Math.max(0, (this.swordSharpenSkillGlobalCooldownEndMs || 0) - now);
        return remainMs / 1000;
    }

    /**
     * 启动磨剑技能全局冷却（所有剑士共享）
     */
    public startSwordSharpenSkillGlobalCooldown(cooldownMs: number) {
        this.swordSharpenSkillGlobalCooldownEndMs = Date.now() + cooldownMs;
        this.startSwordSharpenCooldownRefreshLoop();
    }

    private startSwordSharpenCooldownRefreshLoop() {
        // 清除旧循环
        if (this.swordSharpenSkillCooldownRefreshLoopId !== null) {
            clearInterval(this.swordSharpenSkillCooldownRefreshLoopId);
            this.swordSharpenSkillCooldownRefreshLoopId = null;
        }
        this.swordSharpenSkillCooldownRefreshLoopId = setInterval(() => {
            const remain = this.getSwordSharpenSkillGlobalCooldownRemainingSec();
            this.refreshSelectedSwordsmanPanel();
            if (remain <= 0.01) {
                clearInterval(this.swordSharpenSkillCooldownRefreshLoopId!);
                this.swordSharpenSkillCooldownRefreshLoopId = null;
                this.refreshSelectedSwordsmanPanel(); // 冷却结束再刷一次
            }
        }, 200) as unknown as number;
    }

    private refreshSelectedSwordsmanPanel() {
        // 找到 UnitSelectionManager，获取当前选中的剑士并刷新面板
        const canvas = find('Canvas');
        if (!canvas) return;
        const usmNode = find('Canvas/UnitSelectionManager') || canvas.getChildByName('UnitSelectionManager');
        if (!usmNode) return;
        const usm = usmNode.getComponent('UnitSelectionManager') as any;
        if (!usm) return;

        const unitInfoPanel = usm.unitInfoPanel;
        if (!unitInfoPanel || !unitInfoPanel.updateButtons) return;

        const selectedUnit = usm.getCurrentSelectedUnit ? usm.getCurrentSelectedUnit() : null;
        if (!selectedUnit || !selectedUnit.isValid) return;

        const swordsman = selectedUnit.getComponent('ElfSwordsman') as any;
        if (!swordsman) return;
        if (swordsman.buildSwordsmanUnitInfo) {
            unitInfoPanel.updateButtons(swordsman.buildSwordsmanUnitInfo());
        }
    }
    /**
     * 弓箭手技能：打开弓弦松紧小游戏（不受“首次触发”限制）
     */
    public openBowstringMiniGameForArrower(arrowerScript: any) {
        if (!arrowerScript || !arrowerScript.node || !arrowerScript.node.isValid || !arrowerScript.node.active) {
            return;
        }
        // 技能按钮触发：需要“先松开一次”门闩，避免按钮点击残留输入导致立刻开始/立刻结算
        this.showBowstringMiniGame(arrowerScript, true);
    }

    /**
     * 磨剑技能：打开磨剑小游戏（不受“首次触发”限制）
     */
    public openSwordSharpenMiniGameForSwordsman(swordsmanScript: any) {
        if (!swordsmanScript || !swordsmanScript.node || !swordsmanScript.node.isValid || !swordsmanScript.node.active) {
            return;
        }
        // 技能按钮触发：需要“先短暂吞掉”残留输入，避免立刻触发一次点击
        this.showSwordsmanSharpenMiniGame(swordsmanScript, true);
    }

    private startBowstringRealtimeLoop(barX: number, barY: number, barW: number, barH: number) {
        this.clearBowstringRealtimeLoop();
        this.bowstringMiniGameRealtimeLastMs = Date.now();
        this.bowstringMiniGameRealtimeLoopId = setInterval(() => {
            if (!this.bowstringMiniGameRoot || !this.bowstringMiniGameRoot.isValid || this.bowstringMiniGameFinalized) {
                this.clearBowstringRealtimeLoop();
                return;
            }
            const now = Date.now();
            const dt = Math.max(0, Math.min(0.05, (now - this.bowstringMiniGameRealtimeLastMs) / 1000));
            this.bowstringMiniGameRealtimeLastMs = now;
            if (!this.bowstringMiniGameHold) {
                return;
            }

            // 关键日志：确认“未长按却开始”的真实触发点
            // （只在 hold=true 的第一次 tick 打印一次）
            // if ((this as any).__bowstringLoggedHoldTick !== true) {
            //     (this as any).__bowstringLoggedHoldTick = true;
            //     console.log(`[BowstringMiniGame] tick-start t=${now} dt=${dt.toFixed(3)} cycle=${this.bowstringMiniGameCycleTime.toFixed(3)}`);
            // }
            this.bowstringMiniGameCycleTime += dt;
            while (this.bowstringMiniGameCycleTime >= 4.0) {
                this.bowstringMiniGameCycleTime -= 4.0;
            }
            this.bowstringMiniGameEnergyValue = this.calcBowstringEnergy(this.bowstringMiniGameCycleTime);
            this.refreshBowstringEnergyVisual(barX, barY, barW, barH);
        }, 16) as unknown as number;
    }

    private clearBowstringRealtimeLoop() {
        if (this.bowstringMiniGameRealtimeLoopId !== null) {
            clearInterval(this.bowstringMiniGameRealtimeLoopId);
            this.bowstringMiniGameRealtimeLoopId = null;
        }
    }

    private calcBowstringEnergy(t: number): number {
        // 2.5 秒上升到顶，1.5 秒下降到底（总周期 4 秒）
        if (t <= 2.5) {
            return Math.max(0, Math.min(1, t / 2.5));
        }
        return Math.max(0, Math.min(1, 1 - (t - 2.5) / 1.5));
    }

    private refreshBowstringEnergyVisual(barX: number, barY: number, barW: number, barH: number) {
        if (!this.bowstringMiniGameEnergyFill || !this.bowstringMiniGameNeedle) {
            return;
        }
        const fill = this.bowstringMiniGameEnergyFill;
        const needle = this.bowstringMiniGameNeedle;
        fill.clear();
        needle.clear();

        const h = Math.max(0, Math.min(1, this.bowstringMiniGameEnergyValue)) * barH;
        fill.fillColor = new Color(90, 205, 255, 255);
        fill.roundRect(barX, barY, barW, h, 3);
        fill.fill();

        const y = barY + h;
        needle.fillColor = new Color(255, 245, 180, 255);
        needle.roundRect(barX - 14, y - 2, barW + 28, 4, 2);
        needle.fill();

        // 同步更新左侧弓弦序列帧：按 4 秒完整周期线性映射（避免 2.5 秒提前播到末帧）
        if (this.bowstringMiniGameAnimSprite && this.bowstringMiniGameAnimFrames.length > 0) {
            const n = this.bowstringMiniGameAnimFrames.length;
            const normalized = Math.max(0, Math.min(0.999999, this.bowstringMiniGameCycleTime / 4.0));
            const idx = Math.min(n - 1, Math.max(0, Math.floor(normalized * n)));
            this.bowstringMiniGameAnimSprite.spriteFrame = this.bowstringMiniGameAnimFrames[idx];
        }
    }

    private finalizeBowstringMiniGame() {
        if (this.bowstringMiniGameFinalized) {
            return;
        }
        this.bowstringMiniGameFinalized = true;
      //console.log(`[BowstringMiniGame] finalize t=${Date.now()} energy=${this.bowstringMiniGameEnergyValue.toFixed(3)} cycle=${this.bowstringMiniGameCycleTime.toFixed(3)}`);
        this.bowstringMiniGameHold = false;
        this.stopBowstringHoldLoopSfx();
        this.clearBowstringRealtimeLoop();

        const energy = Math.max(0, Math.min(1, this.bowstringMiniGameEnergyValue));
        const centerDist = Math.abs(energy - 0.5);
        const isInBestZone = centerDist <= 0.065; // 对齐中间高亮区（约 28/220）
        const isInGoodZone = centerDist <= 0.16;  // 次优区（明显优于外围，但不算最佳）
        const score = Math.max(0, 1 - Math.abs(energy - 0.5) / 0.5); // 中点得分最高
        const multiplier = 1.1 + 0.4 * score; // [1.1, 1.5]
        const attackBoostPercent = Math.max(0, Math.round((multiplier - 1) * 100));

        const archer = this.bowstringMiniGameTargetArrower;
        // 小游戏结束后启动全局冷却（初始小游戏和技能触发的小游戏都走这里）
        // GameManager 内部的 startBowstringSkillGlobalCooldown 会自动启动刷新循环
        this.startBowstringSkillGlobalCooldown(30_000);
        // 一次小游戏：提升全体弓箭手（非递归，定向扫描固定容器，避免性能抖动）
        try {
            const visited = new Set<string>();
            let appliedCount = 0;
            const containerPaths = [
                'Canvas/Towers',
            ];
            for (let p = 0; p < containerPaths.length; p++) {
                const container = find(containerPaths[p]);
                if (!container || !container.isValid) continue;
                const children = container.children || [];
                for (let i = 0; i < children.length; i++) {
                    const n = children[i];
                    if (!n || !n.isValid || !n.active) continue;
                    const a = n.getComponent('Arrower') as any;
                    if (!a || !a.node || !a.node.isValid || !a.node.active) continue;
                    const id = a.node.uuid || `${a.node.name}_${i}`;
                    if (visited.has(id)) continue;
                    visited.add(id);
                    a.bowstringAttackMultiplier = multiplier;
                    appliedCount++;
                }
            }
            // 兜底：确保触发小游戏的那个弓箭手一定被覆盖（即使它临时不在上述容器里）
            if (archer && archer.node && archer.node.isValid && archer.node.active) {
                const id = archer.node.uuid || '__current_archer__';
                if (!visited.has(id)) {
                    archer.bowstringAttackMultiplier = multiplier;
                    visited.add(id);
                    appliedCount++;
                }
            }
           //console.log(`[BowstringMiniGame] applyAllArrowersFast multiplier=${multiplier.toFixed(3)} count=${appliedCount}`);
        } catch (e) {
            console.warn('[BowstringMiniGame] applyAllArrowersFast failed', e);
        }

        const root = this.bowstringMiniGameRoot;
        if (root && root.isValid) {
            const showPerfect = isInBestZone;
            if (showPerfect) {
                const perfectNode = new Node('PerfectText');
                perfectNode.setParent(root);
                perfectNode.setPosition(112, 152, 0);
                perfectNode.addComponent(UITransform).setContentSize(180, 44);
                const perfectLabel = perfectNode.addComponent(Label);
                perfectLabel.string = 'Prefect!';
                perfectLabel.fontSize = 42;
                perfectLabel.color = new Color(255, 215, 80, 255);
                perfectLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
                perfectLabel.verticalAlign = Label.VerticalAlign.CENTER;
                const outline = perfectNode.addComponent(LabelOutline);
                outline.color = new Color(20, 20, 20, 255);
                outline.width = 4;
            }
            this.fadeOutBowstringMiniGameRoot(0.9, showPerfect ? 0.35 : 0, () => {
                this.showArrowerThanksIntro(multiplier, attackBoostPercent, archer, isInBestZone, isInGoodZone);
            });
            return;
        }

        this.showArrowerThanksIntro(multiplier, attackBoostPercent, archer, isInBestZone, isInGoodZone);
        this.bowstringMiniGameRoot = null;
        this.bowstringMiniGameEnergyFill = null;
        this.bowstringMiniGameNeedle = null;
        this.bowstringMiniGameAnimSprite = null;
        this.bowstringMiniGameAnimFrames = [];
        this.bowstringMiniGameTargetArrower = null;
    }

    private fadeOutBowstringMiniGameRoot(durationSec: number, delaySec: number, onDone: () => void) {
        const root = this.bowstringMiniGameRoot;
        if (!root || !root.isValid) {
            onDone();
            return;
        }
        let opacity = root.getComponent(UIOpacity);
        if (!opacity) {
            opacity = root.addComponent(UIOpacity);
        }
        opacity.opacity = 255;
        setTimeout(() => {
            const startMs = Date.now();
            const loopId = setInterval(() => {
                const curRoot = this.bowstringMiniGameRoot;
                if (!curRoot || !curRoot.isValid || !opacity || !opacity.isValid) {
                    clearInterval(loopId);
                    onDone();
                    return;
                }
                const t = Math.max(0, Math.min(1, (Date.now() - startMs) / Math.max(0.001, durationSec * 1000)));
                opacity.opacity = Math.max(0, Math.round(255 * (1 - t)));
                if (t >= 1) {
                    clearInterval(loopId);
                    curRoot.destroy();
                    this.bowstringMiniGameRoot = null;
                    this.bowstringMiniGameEnergyFill = null;
                    this.bowstringMiniGameNeedle = null;
                    this.bowstringMiniGameAnimSprite = null;
                    this.bowstringMiniGameAnimFrames = [];
                    this.bowstringMiniGameTargetArrower = null;
                    onDone();
                }
            }, 16) as unknown as number;
        }, Math.max(0, delaySec) * 1000);
    }

    private showArrowerThanksIntro(multiplier: number, attackBoostPercent: number, archer: any, isInBestZone: boolean, isInGoodZone: boolean) {
        this.autoCreateUnitIntroPopup();
        if (!this.unitIntroPopup) {
            return;
        }

        let description = '谢谢你，指挥官，至少比刚才顺手多了。';
        let moodIcon: SpriteFrame | null = archer?.bowstringMoodBadIcon || null;
        if (isInBestZone) {
            description = '太好了！这个程度刚刚好！';
            moodIcon = archer?.bowstringMoodExcellentIcon || moodIcon;
        } else if (isInGoodZone) {
            description = '不错！手感回来了不少，多谢指挥官帮忙。';
            moodIcon = archer?.bowstringMoodGoodIcon || moodIcon;
        } else {
            description = '我会努力适应这个松紧度，谢谢指挥官。';
        }

        const fallbackIcon = archer?.cardIcon || archer?.defaultSpriteFrame || null;
        this.unitIntroPopup.show({
            unitName: '弓箭手',
            unitDescription: description,
            unitIcon: moodIcon || fallbackIcon,
            unitType: 'Arrower',
            unitId: 'Arrower',
            onCloseCallback: () => {
                GamePopup.showMessage(`全体弓箭手攻击力提升${attackBoostPercent}%`, true, 2.5);
            }
        });
    }

    /**
     * 首个剑士：延迟触发“磨剑”剧情与小游戏
     */
    private triggerFirstSwordsmanSharpenFlow(swordsmanScript: any) {
        if (this.hasTriggeredFirstSwordsmanSharpenMiniGame) {
            return;
        }
        this.hasTriggeredFirstSwordsmanSharpenMiniGame = true;

        // 固定 5 秒后出现请求帮助对话（参考弓箭手紧弓弦流程）
        const delay = 5;
        this.scheduleOnce(() => {
            if (this.gameState !== GameState.Playing) { 
                return;
            }
            if (!swordsmanScript || !swordsmanScript.node || !swordsmanScript.node.isValid || !swordsmanScript.node.active) {
                return;
            }
            this.showFirstSwordsmanHelpIntro(swordsmanScript);
        }, delay);
    }

    private showFirstSwordsmanHelpIntro(swordsmanScript: any) {
        this.autoCreateUnitIntroPopup();
        if (!this.unitIntroPopup) {
            return;
        }

        const icon = swordsmanScript?.cardIcon || swordsmanScript?.defaultSpriteFrame || null;
        this.unitIntroPopup.show({
            unitName: '剑士',
            unitDescription: '指挥官，吾之剑刃略有钝感，虽可自行处理，但若你愿意，可否助我打磨此剑？',
            unitIcon: icon,
            unitType: 'ElfSwordsman',
            unitId: 'ElfSwordsman',
            onCloseCallback: () => {
                this.showSwordsmanSharpenMiniGame(swordsmanScript);
            }
        });
    }

    /**
     * 剑士磨剑小游戏：5秒狂点鼠标，每次点击触发一次动画和音效
     */
    private showSwordsmanSharpenMiniGame(swordsmanScript: any, requireInputGuard: boolean = false) {
        if (this.swordSharpenMiniGameRoot && this.swordSharpenMiniGameRoot.isValid) {
            this.swordSharpenMiniGameRoot.destroy();
        }

        const canvas = find('Canvas');
        if (!canvas) {
            return;
        }

        this.swordSharpenMiniGameTargetSwordsman = swordsmanScript;
        this.swordSharpenMiniGameFinalized = false;
        this.swordSharpenMiniGameClickCount = 0;
        this.swordSharpenMiniGameEndAtMs = Date.now() + 5_000;
        this.swordSharpenMiniGameLastClickAtMs = 0;
        // 防止“点击技能按钮/界面抬起”残留输入导致立刻进入点击态
        this.swordSharpenMiniGameInputEnableAtMs = Date.now() + (requireInputGuard ? 180 : 120);

        this.swordSharpenMiniGameAnimFrames = Array.isArray(swordsmanScript?.swordSharpenFrames)
            ? (swordsmanScript.swordSharpenFrames as SpriteFrame[]).filter(Boolean)
            : [];

        this.clearSwordSharpenRealtimeLoop();
        this.swordSharpenMiniGameAnimSprite = null;
        this.swordSharpenMiniGameTimerLabel = null;
        this.swordSharpenMiniGameClickLabel = null;
        this.swordSharpenMiniGameAnimPendingCount = 0;
        this.swordSharpenMiniGameAnimRunning = false;
        this.clearSwordSharpenMiniGameAnimTimeout();
        this.swordSharpenMiniGameShouldFinalizeUIAfterAnim = false;
        this.swordSharpenMiniGameFinalizeClicks = 0;
        this.swordSharpenMiniGameFinalizeDamageBoostPercent = 0;
        this.swordSharpenMiniGameFinalizeSpeedBoostPercent = 0;
        this.swordSharpenMiniGameFinalizeIconToUse = null;

        this.pauseGame();

        const root = new Node('SwordSharpenMiniGame');
        root.setParent(canvas);
        root.setSiblingIndex(Number.MAX_SAFE_INTEGER - 2);
        this.swordSharpenMiniGameRoot = root;
        root.addComponent(BlockInputEvents);

        const rootTr = root.addComponent(UITransform);
        rootTr.setContentSize(view.getVisibleSize().width * 2, view.getVisibleSize().height * 2);
        root.setPosition(0, 0, 0);

        const mask = root.addComponent(Graphics);
        mask.fillColor = new Color(0, 0, 0, 180);
        const vs = view.getVisibleSize();
        mask.rect(-vs.width, -vs.height, vs.width * 2, vs.height * 2);
        mask.fill();

        const panel = new Node('MiniGamePanel');
        panel.setParent(root);
        panel.setPosition(0, 0, 0);
        const panelTr = panel.addComponent(UITransform);
        panelTr.setContentSize(400, 400);
        const panelBg = panel.addComponent(Graphics);
        panelBg.fillColor = new Color(25, 25, 35, 245);
        panelBg.roundRect(-200, -200, 400, 400, 14);
        panelBg.fill();

        const titleNode = new Node('Title');
        titleNode.setParent(panel);
        titleNode.setPosition(0, 172, 0);
        titleNode.addComponent(UITransform).setContentSize(360, 32);
        const title = titleNode.addComponent(Label);
        title.string = '打磨5秒';
        title.fontSize = 20;
        title.color = new Color(240, 240, 255, 255);
        title.horizontalAlign = Label.HorizontalAlign.CENTER;
        title.verticalAlign = Label.VerticalAlign.CENTER;

        // 中间：磨剑动画区
        const centerAnim = new Node('SwordAnimArea');
        centerAnim.setParent(panel);
        centerAnim.setPosition(0, 10, 0);
        centerAnim.addComponent(UITransform).setContentSize(250, 250);

        const animBg = centerAnim.addComponent(Graphics);
        animBg.fillColor = new Color(48, 48, 68, 255);
        animBg.roundRect(-125, -125, 250, 250, 12);
        animBg.fill();

        const animNode = new Node('SwordAnimSprite');
        animNode.setParent(centerAnim);
        animNode.setPosition(0, 0, 0);
        const animTr = animNode.addComponent(UITransform);
        animTr.setContentSize(180, 180);
        this.swordSharpenMiniGameAnimSprite = animNode.addComponent(Sprite);
        this.swordSharpenMiniGameAnimSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        // 关闭 trim，避免序列帧因裁边差异导致主体忽大忽小
        this.swordSharpenMiniGameAnimSprite.trim = false;
        if (this.swordSharpenMiniGameAnimFrames.length > 0) {
            this.swordSharpenMiniGameAnimSprite.spriteFrame = this.swordSharpenMiniGameAnimFrames[0];
        }

        const infoNode = new Node('Info');
        infoNode.setParent(panel);
        infoNode.setPosition(0, -165, 0);
        const infoTr = infoNode.addComponent(UITransform);
        infoTr.setContentSize(360, 40);
        const infoLabel = infoNode.addComponent(Label);
        infoLabel.string = '点击触发打磨（点击越多，强化越强）';
        infoLabel.fontSize = 14;
        infoLabel.color = new Color(208, 216, 245, 255);
        infoLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        infoLabel.verticalAlign = Label.VerticalAlign.CENTER;

        // 右上：倒计时
        const timerNode = new Node('Timer');
        timerNode.setParent(panel);
        timerNode.setPosition(112, 150, 0);
        timerNode.addComponent(UITransform).setContentSize(120, 28);
        this.swordSharpenMiniGameTimerLabel = timerNode.addComponent(Label);
        this.swordSharpenMiniGameTimerLabel.fontSize = 18;
        this.swordSharpenMiniGameTimerLabel.color = new Color(255, 245, 180, 255);
        this.swordSharpenMiniGameTimerLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.swordSharpenMiniGameTimerLabel.verticalAlign = Label.VerticalAlign.CENTER;
        this.swordSharpenMiniGameTimerLabel.string = '5.0s';

        // 右中：点击次数
        const clickNode = new Node('ClickCount');
        clickNode.setParent(panel);
        clickNode.setPosition(112, 115, 0);
        clickNode.addComponent(UITransform).setContentSize(120, 28);
        this.swordSharpenMiniGameClickLabel = clickNode.addComponent(Label);
        this.swordSharpenMiniGameClickLabel.fontSize = 18;
        this.swordSharpenMiniGameClickLabel.color = new Color(200, 220, 255, 255);
        this.swordSharpenMiniGameClickLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.swordSharpenMiniGameClickLabel.verticalAlign = Label.VerticalAlign.CENTER;
        this.swordSharpenMiniGameClickLabel.string = '打磨次数：0';

        // 实时 UI 更新：真实时间（setInterval），不受 timeScale 影响
        this.swordSharpenMiniGameRealtimeLoopId = setInterval(() => {
            if (!this.swordSharpenMiniGameRoot || !this.swordSharpenMiniGameRoot.isValid || this.swordSharpenMiniGameFinalized) {
                this.clearSwordSharpenRealtimeLoop();
                return;
            }
            const remainSec = Math.max(0, (this.swordSharpenMiniGameEndAtMs - Date.now()) / 1000);
            if (this.swordSharpenMiniGameTimerLabel) {
                this.swordSharpenMiniGameTimerLabel.string = `${remainSec.toFixed(1)}s`;
            }
            if (remainSec <= 0) {
                // 等 setTimeout 触发 finalize（避免多次 finalize），这里仅停止轮询
                this.clearSwordSharpenRealtimeLoop();
            }
        }, 50) as unknown as number;

        const onClick = () => {
            if (this.swordSharpenMiniGameFinalized) {
                return;
            }
            const now = Date.now();
            if (now >= this.swordSharpenMiniGameEndAtMs) {
                return;
            }
            if (now < this.swordSharpenMiniGameInputEnableAtMs) {
                return;
            }

            // 防止同一物理动作被多个事件重复触发（touch/mouse 混合）
            if (now - this.swordSharpenMiniGameLastClickAtMs < 25) {
                return;
            }
            this.swordSharpenMiniGameLastClickAtMs = now;

            this.swordSharpenMiniGameClickCount++;
            // 点击也会触发“完整序列帧”的播放一次（队列式串行播放）
            this.swordSharpenMiniGameAnimPendingCount++;

            if (this.swordSharpenMiniGameClickLabel) {
                this.swordSharpenMiniGameClickLabel.string = `打磨：${this.swordSharpenMiniGameClickCount}`;
            }

            this.tryPlaySwordSharpenAnimQueue();

            const clip = swordsmanScript?.swordSharpenSound;
            if (clip && AudioManager.Instance) {
                AudioManager.Instance.playSFX(clip);
            }
        };

        root.on(Node.EventType.TOUCH_START, onClick, this, true);
        root.on(Node.EventType.MOUSE_DOWN, onClick, this, true);

        setTimeout(() => {
            this.finalizeSwordsmanSharpenMiniGame();
        }, 5_000);
    }

    private finalizeSwordsmanSharpenMiniGame() {
        if (this.swordSharpenMiniGameFinalized) {
            return;
        }
        this.swordSharpenMiniGameFinalized = true;
        this.clearSwordSharpenRealtimeLoop();

        const clicks = this.swordSharpenMiniGameClickCount;

        const { damageBoostPercent, speedBoostPercent } = this.calcSwordSharpenBoost(clicks);
        const damageMultiplier = 1 + damageBoostPercent / 100;

        // 小游戏结束后给全体剑士应用强化（覆盖式）
        this.applySwordSharpenBuffToAllSwordsmen(damageMultiplier, speedBoostPercent);

        const swordsman = this.swordSharpenMiniGameTargetSwordsman;
        const fallbackIcon = swordsman?.cardIcon || swordsman?.defaultSpriteFrame || null;
        // 结算时确定要用的表情贴图：避免淡出销毁时 reset 导致引用丢失
        let moodIcon: SpriteFrame | null = swordsman?.swordSharpenMoodBadIcon || null;
        if (clicks > 20) {
            moodIcon = swordsman?.swordSharpenMoodExcellentIcon || moodIcon;
        } else if (clicks >= 10) {
            moodIcon = swordsman?.swordSharpenMoodGoodIcon || moodIcon;
        }
        const iconToUse = moodIcon || fallbackIcon;
        // 结束后：锁输入，但让队列里的动画把“每次点击完整播完”后再结算 UI
        this.swordSharpenMiniGameShouldFinalizeUIAfterAnim = true;
        this.swordSharpenMiniGameFinalizeClicks = clicks;
        this.swordSharpenMiniGameFinalizeDamageBoostPercent = damageBoostPercent;
        this.swordSharpenMiniGameFinalizeSpeedBoostPercent = speedBoostPercent;
        this.swordSharpenMiniGameFinalizeIconToUse = iconToUse;

        this.maybeFinalizeSwordSharpenMiniGameUI();
    }

    private maybeFinalizeSwordSharpenMiniGameUI() {
        if (!this.swordSharpenMiniGameShouldFinalizeUIAfterAnim) return;
        if (this.swordSharpenMiniGameAnimRunning) return;
        if (this.swordSharpenMiniGameAnimPendingCount > 0) return;

        this.swordSharpenMiniGameShouldFinalizeUIAfterAnim = false;

        const clicks = this.swordSharpenMiniGameFinalizeClicks;
        const damageBoostPercent = this.swordSharpenMiniGameFinalizeDamageBoostPercent;
        const speedBoostPercent = this.swordSharpenMiniGameFinalizeSpeedBoostPercent;
        const iconToUse = this.swordSharpenMiniGameFinalizeIconToUse;

        const root = this.swordSharpenMiniGameRoot;
        if (root && root.isValid) {
            this.fadeOutSwordSharpenMiniGameRoot(0.35, 0, () => {
                this.showSwordsmanThanksIntro(clicks, damageBoostPercent, speedBoostPercent, iconToUse);
            });
            return;
        }

        this.showSwordsmanThanksIntro(clicks, damageBoostPercent, speedBoostPercent, iconToUse);
        this.resetSwordSharpenMiniGameRefs();
    }

    private calcSwordSharpenBoost(clicks: number): { damageBoostPercent: number; speedBoostPercent: number } {
        // 最佳：click > 20
        // 一般：10-20
        // 最差：<10
        if (clicks < 10) {
            return { damageBoostPercent: 0, speedBoostPercent: 0 };
        }
        if (clicks <= 20) {
            const t = (clicks - 10) / 10; // 0..1
            const damageBoostPercent = Math.round((10 + t * 15) * 0.5); // 原值一半：5..12(约)
            const speedBoostPercent = Math.round((6 + t * 9) * 0.5); // 原值一半：3..8(约)
            return { damageBoostPercent, speedBoostPercent };
        }
        const extra = Math.min(clicks - 20, 10); // 1..10
        const t = extra / 10; // 0..1
        const damageBoostPercent = Math.round((25 + t * 15) * 0.5); // 原值一半：12..20(约)
        const speedBoostPercent = Math.round((15 + t * 15) * 0.5); // 原值一半：8..15(约)
        return { damageBoostPercent, speedBoostPercent };
    }

    private applySwordSharpenBuffToAllSwordsmen(damageMultiplier: number, speedBoostPercent: number) {
        try {
            const visited = new Set<string>();
            let appliedCount = 0;

            const containerPaths = [
                'Canvas/Towers',
                'Canvas/Units',
                'Canvas/ElfSwordsmans',
                'Canvas/Swordsmen',
            ];

            for (let p = 0; p < containerPaths.length; p++) {
                const container = find(containerPaths[p]);
                if (!container || !container.isValid) continue;

                const children = container.children || [];
                for (let i = 0; i < children.length; i++) {
                    const n = children[i];
                    if (!n || !n.isValid || !n.active) continue;

                    const s = n.getComponent('ElfSwordsman') as any;
                    if (!s || !s.node || !s.node.isValid || !s.node.active) continue;

                    const id = s.node.uuid || `${s.node.name}_${i}`;
                    if (visited.has(id)) continue;
                    visited.add(id);

                    if (typeof s.applySwordSharpenBuff === 'function') {
                        s.applySwordSharpenBuff(damageMultiplier, speedBoostPercent);
                        appliedCount++;
                    }
                }
            }

            const swordsman = this.swordSharpenMiniGameTargetSwordsman;
            if (swordsman && swordsman.node && swordsman.node.isValid && swordsman.node.active) {
                const id = swordsman.node.uuid || '__current_swordsman__';
                if (!visited.has(id) && typeof swordsman.applySwordSharpenBuff === 'function') {
                    swordsman.applySwordSharpenBuff(damageMultiplier, speedBoostPercent);
                    appliedCount++;
                }
            }

           //console.log(`[SwordSharpenMiniGame] applyAllSwordsmen multiplier=${damageMultiplier.toFixed(3)} speed+${speedBoostPercent}% count=${appliedCount}`);
        } catch (e) {
            console.warn('[SwordSharpenMiniGame] applyAllSwordsmen failed', e);
        }
    }

    private clearSwordSharpenRealtimeLoop() {
        if (this.swordSharpenMiniGameRealtimeLoopId !== null) {
            clearInterval(this.swordSharpenMiniGameRealtimeLoopId);
            this.swordSharpenMiniGameRealtimeLoopId = null;
        }
    }

    private clearSwordSharpenMiniGameAnimTimeout() {
        if (this.swordSharpenMiniGameAnimTimeoutId !== null) {
            clearTimeout(this.swordSharpenMiniGameAnimTimeoutId);
            this.swordSharpenMiniGameAnimTimeoutId = null;
        }
    }

    private tryPlaySwordSharpenAnimQueue() {
        if (!this.swordSharpenMiniGameAnimSprite || !this.swordSharpenMiniGameAnimSprite.isValid) return;
        if (this.swordSharpenMiniGameAnimPendingCount <= 0) return;
        if (this.swordSharpenMiniGameAnimRunning) return;

        this.swordSharpenMiniGameAnimRunning = true;
        this.playSwordSharpenOneSequence();
    }

    private playSwordSharpenOneSequence() {
        const sprite = this.swordSharpenMiniGameAnimSprite;
        const frames = this.swordSharpenMiniGameAnimFrames;
        if (!sprite || !sprite.isValid) {
            this.swordSharpenMiniGameAnimRunning = false;
            return;
        }
        if (!Array.isArray(frames) || frames.length <= 0) {
            this.swordSharpenMiniGameAnimRunning = false;
            // 没有帧就等价于“立即完成一次点击序列”
            this.swordSharpenMiniGameAnimPendingCount = Math.max(0, this.swordSharpenMiniGameAnimPendingCount - 1);
            this.tryPlaySwordSharpenAnimQueue();
            return;
        }

        const frameCount = frames.length;
        // 希望每次点击是“完整播放一次”，总时长控制在约 0.42s（帧数越多每帧越短）
        const totalMs = 420;
        const stepMs = Math.max(25, Math.round(totalMs / frameCount));

        let frameIndex = 0;
        const step = () => {
            if (!this.swordSharpenMiniGameAnimSprite || !this.swordSharpenMiniGameAnimSprite.isValid) {
                this.swordSharpenMiniGameAnimRunning = false;
                return;
            }

            // 播放当前帧
            this.swordSharpenMiniGameAnimSprite.spriteFrame = frames[frameIndex];
            // 强制固定显示尺寸，避免帧切换时出现视觉缩放抖动
            const tr = this.swordSharpenMiniGameAnimSprite.node.getComponent(UITransform);
            if (tr) {
                tr.setContentSize(180, 180);
            }
            frameIndex++;

            if (frameIndex < frameCount) {
                this.swordSharpenMiniGameAnimTimeoutId = setTimeout(step, stepMs) as unknown as number;
                return;
            }

            // 序列播放完成：消耗一个“待播放点击序列”
            this.swordSharpenMiniGameAnimPendingCount = Math.max(0, this.swordSharpenMiniGameAnimPendingCount - 1);
            this.swordSharpenMiniGameAnimRunning = false;
            this.swordSharpenMiniGameAnimTimeoutId = null;

            // 如果 10 秒已结束且队列清空，则结算 UI
            this.maybeFinalizeSwordSharpenMiniGameUI();

            // 如果还有排队的点击序列，继续播放下一轮
            this.tryPlaySwordSharpenAnimQueue();
        };

        // 立即开始序列，保证点击后立刻有反馈
        step();
    }

    private fadeOutSwordSharpenMiniGameRoot(durationSec: number, delaySec: number, onDone: () => void) {
        const root = this.swordSharpenMiniGameRoot;
        if (!root || !root.isValid) {
            onDone();
            return;
        }

        let opacity = root.getComponent(UIOpacity);
        if (!opacity) {
            opacity = root.addComponent(UIOpacity);
        }
        opacity.opacity = 255;

        setTimeout(() => {
            const startMs = Date.now();
            const loopId = setInterval(() => {
                const curRoot = this.swordSharpenMiniGameRoot;
                if (!curRoot || !curRoot.isValid || !opacity || !opacity.isValid) {
                    clearInterval(loopId);
                    onDone();
                    return;
                }
                const t = Math.max(0, Math.min(1, (Date.now() - startMs) / Math.max(0.001, durationSec * 1000)));
                opacity.opacity = Math.max(0, Math.round(255 * (1 - t)));
                if (t >= 1) {
                    clearInterval(loopId);
                    curRoot.destroy();
                    this.resetSwordSharpenMiniGameRefs();
                    onDone();
                }
            }, 16) as unknown as number;
        }, Math.max(0, delaySec) * 1000);
    }

    private resetSwordSharpenMiniGameRefs() {
        this.swordSharpenMiniGameRoot = null;
        this.swordSharpenMiniGameAnimSprite = null;
        this.swordSharpenMiniGameAnimFrames = [];
        this.swordSharpenMiniGameClickCount = 0;
        this.swordSharpenMiniGameEndAtMs = 0;
        this.swordSharpenMiniGameTargetSwordsman = null;
        this.swordSharpenMiniGameTimerLabel = null;
        this.swordSharpenMiniGameClickLabel = null;
        this.swordSharpenMiniGameLastClickAtMs = 0;

        this.swordSharpenMiniGameAnimPendingCount = 0;
        this.swordSharpenMiniGameAnimRunning = false;
        this.clearSwordSharpenMiniGameAnimTimeout();

        this.swordSharpenMiniGameShouldFinalizeUIAfterAnim = false;
        this.swordSharpenMiniGameFinalizeClicks = 0;
        this.swordSharpenMiniGameFinalizeDamageBoostPercent = 0;
        this.swordSharpenMiniGameFinalizeSpeedBoostPercent = 0;
        this.swordSharpenMiniGameFinalizeIconToUse = null;
    }

    private showSwordsmanThanksIntro(clicks: number, damageBoostPercent: number, speedBoostPercent: number, unitIcon: SpriteFrame | null) {
        this.autoCreateUnitIntroPopup();
        if (!this.unitIntroPopup) return;

        let description = '……无妨。战场上的磨损远甚于此。';
        if (clicks > 20) {
            description = '指挥官，卓越的手艺。此剑如今映出的寒光，胜过往昔。';
        } else if (clicks >= 10) {
            description = '嗯，已堪使用，多谢指挥官。';
        }

        this.unitIntroPopup.show({
            unitName: '剑士',
            unitDescription: description,
            unitIcon: unitIcon,
            unitType: 'ElfSwordsman',
            unitId: 'ElfSwordsman',
            onCloseCallback: () => {
                GamePopup.showMessage(`全体剑士攻击力提升${damageBoostPercent}%，攻速提升${speedBoostPercent}%`, true, 2.5);
            }
        });
    }

    /**
     * 战斗中动态单位对话（均为“一局一次”触发）
     * 要求：不使用递归，只扫描固定容器的一层 children。
     */
    private tryTriggerBattleDialogs() {
        if (this.gameState !== GameState.Playing) {
            return;
        }
        const now = Date.now();
        const canDebugLog = now - this.lastBattleDialogDebugLogMs >= 1500;
        this.autoCreateUnitIntroPopup();

        // A 提示触发后，可能在对话弹窗期间就已经打开建造面板；因此这里不依赖 intro popup 是否激活
        this.tryHighlightChurchCandidateAfterBuild();
        this.tryHighlightSwordsmanHallCandidateAfterBuild();

        if (this.unitIntroPopup && this.unitIntroPopup.container && this.unitIntroPopup.container.active) {
            // 已有介绍框在显示时不叠加，下一帧再尝试
            if (canDebugLog) {
               //console.log('[BattleDialog] skip: intro popup active');
                this.lastBattleDialogDebugLogMs = now;
            }
            return;
        }

        const priestScript = this.getFirstActiveUnitScriptInContainers(['Canvas/Towers', 'Canvas/Priests'], 'Priest');
        const hasPriest = !!priestScript;
        if (canDebugLog) {
           //console.log(
            //     `[BattleDialog] tick gold=${this.gold} wood=${this.wood} hasPriest=${hasPriest} shown={A:${this.hasShownArrowerNeedPriestDialog},B:${this.hasShownPriestProtectBuildingDialog},C:${this.hasShownGoldReach100ArrowerDialog},D:${this.hasShownPriestSuggestSwordsmanAfterKillDialog},E:${this.hasShownArrowerSuggestBuildWhenWood60}}`
            // );
        }
        // e. 木材达到 90：弓箭手提示多建造防御塔（仅在 Canvas/Towers 一层扫描）
        if (!this.hasShownArrowerSuggestBuildWhenWood60 && this.wood >= 90) {
            const arrowerForWood = this.getFirstActiveUnitScriptInContainers(['Canvas/Towers'], 'Arrower');
            if (arrowerForWood) {
                this.showQuickUnitIntro(
                    arrowerForWood,
                    '弓箭手',
                    '指挥官，木头够多了，屯着也没用，多建造一些防御塔，为我们减轻压力吧！',
                    'Arrower'
                );
                this.hasShownArrowerSuggestBuildWhenWood60 = true;
               //console.log('[BattleDialog][E] Arrower container=Canvas/Towers');
               //console.log('[BattleDialog][E] triggered: wood >= 60, arrower found');
                return;
            }
        }


        // c. 金额第一次积攒达到100
        if (!this.hasShownGoldReach100ArrowerDialog && this.gold >= 100) {
            const arrowerScript = this.getFirstActiveUnitScriptInContainers(['Canvas/Towers'], 'Arrower');
            if (arrowerScript) {
                this.showQuickUnitIntro(
                    arrowerScript,
                    '弓箭手',
                    '可以升级生命之树了，我们需要更多的人手！',
                    'Arrower'
                );
                this.hasShownGoldReach100ArrowerDialog = true;
               //console.log('[BattleDialog][C] Arrower container=Canvas/Towers');
                this.highlightCrystalForBattleHint();
               //console.log('[BattleDialog][C] triggered: gold reached 100+, arrower found');
                return;
            }
        }

        // a. 弓箭手受伤，且场上没有牧师
        if (!this.hasShownArrowerNeedPriestDialog && !hasPriest) {
            const injuredArrower = this.getFirstInjuredArrowerInContainers(['Canvas/Towers']);
            if (injuredArrower) {
                this.showQuickUnitIntro(
                    injuredArrower,
                    '弓箭手',
                    '指挥官，我开始想念牧师大姐了。',
                    'Arrower'
                );
                this.hasShownArrowerNeedPriestDialog = true;
                this.highlightBuildButtonForBattleHint();
                this.pendingHighlightChurchCandidateAfterBuild = true;
               //console.log('[BattleDialog][A] triggered: injured Arrower found and no Priest');
                return;
            }
        }

        // b. 牧师在场，且防御塔（含主水晶/防御建筑）血量减少
        const currentDefenseHp = this.getDefenseStructureHealthSnapshotNoRecursion();
        if (this.lastDefenseStructureHealthSnapshot < 0) {
            this.lastDefenseStructureHealthSnapshot = currentDefenseHp;
            if (canDebugLog) {
               //console.log(`[BattleDialog][B] init snapshot=${currentDefenseHp.toFixed(1)}`);
                this.lastBattleDialogDebugLogMs = now;
            }
            return;
        }
        if (
            !this.hasShownPriestProtectBuildingDialog &&
            hasPriest &&
            currentDefenseHp + 0.01 < this.lastDefenseStructureHealthSnapshot
        ) {
            this.showQuickUnitIntro(
                priestScript,
                '牧师',
                '指挥官，祈祷唤来的圣灵也能保护建筑物哦。',
                'Priest'
            );
            this.hasShownPriestProtectBuildingDialog = true;
            this.lastDefenseStructureHealthSnapshot = currentDefenseHp;
          //console.log('[BattleDialog][B] triggered: Priest present and defense hp decreased');
            return;
        }
        this.lastDefenseStructureHealthSnapshot = currentDefenseHp;

        // d. 牧师在场，且有友方单位被击杀：提示“只有剑士能挡住敌人”，并高亮建造按钮与剑士小屋
        const currentFriendlyCount = this.getFriendlyUnitCountSnapshotNoRecursion();
        if (this.lastFriendlyUnitCountSnapshot < 0) {
            this.lastFriendlyUnitCountSnapshot = currentFriendlyCount;
            if (canDebugLog) {
              //console.log(`[BattleDialog][D] init snapshot=${currentFriendlyCount}`);
                this.lastBattleDialogDebugLogMs = now;
            }
            return;
        }
        if (
            !this.hasShownPriestSuggestSwordsmanAfterKillDialog &&
            hasPriest &&
            currentFriendlyCount < this.lastFriendlyUnitCountSnapshot
        ) {
            this.showQuickUnitIntro(
                priestScript,
                '牧师',
                '指挥官，现在只有剑士才能挡住敌人！',
                'Priest'
            );
            this.hasShownPriestSuggestSwordsmanAfterKillDialog = true;
            this.highlightBuildButtonForBattleHint();
            this.pendingHighlightSwordsmanHallCandidateAfterBuild = true;
            this.lastFriendlyUnitCountSnapshot = currentFriendlyCount;
          //console.log('[BattleDialog][D] triggered: Priest present and friendly unit count decreased');
            return;
        }
        this.lastFriendlyUnitCountSnapshot = currentFriendlyCount;
        if (canDebugLog) {
            this.lastBattleDialogDebugLogMs = now;
        }
    }

    /**
     * A 提示触发时：高亮建造按钮（复用第一关教程逻辑）
     */
    private highlightBuildButtonForBattleHint() {
        const btnNode = find('UI/BuildButton') || find('Canvas/UI/BuildButton') || find('BuildButton');
        if (!btnNode || !btnNode.isValid) return;

        const sprite = btnNode.getComponent(Sprite);
        this.buildButtonBattleHintNode = btnNode;
        this.buildButtonBattleHintOriginalScale = btnNode.scale.clone();
        this.buildButtonBattleHintOriginalColor = sprite ? sprite.color.clone() : null;

        const seqId = ++this.buildButtonBattleHintBlinkSeqId;
        if (!btnNode.active) btnNode.active = true;

        const origScale = this.buildButtonBattleHintOriginalScale!;
        const sx = origScale.x;
        const sy = origScale.y;
        const sz = origScale.z;
        const highlightColor = new Color(255, 255, 0, 255);

        const setHighlight = () => {
            if (this.buildButtonBattleHintBlinkSeqId !== seqId) return;
            if (!btnNode || !btnNode.isValid) return;
            btnNode.setScale(sx * 1.2, sy * 1.2, sz);
            if (sprite && sprite.isValid) sprite.color = highlightColor;
        };

        const setRestore = () => {
            if (this.buildButtonBattleHintBlinkSeqId !== seqId) return;
            if (!btnNode || !btnNode.isValid) return;

            const os = this.buildButtonBattleHintOriginalScale;
            if (os) btnNode.setScale(os.x, os.y, os.z);
            if (sprite && sprite.isValid && this.buildButtonBattleHintOriginalColor) {
                sprite.color = this.buildButtonBattleHintOriginalColor;
            }
        };

        // 高亮 0.5s -> 还原 0.5s，循环 10 次（约 10 秒）；玩家打开面板后会立即停止
        const loops = 10;
        for (let i = 0; i < loops; i++) {
            this.scheduleOnce(() => {
                setHighlight();
                this.scheduleOnce(() => setRestore(), 0.5);
            }, i * 1.0);
        }
        this.scheduleOnce(() => setRestore(), loops * 1.0);
    }

    private stopBuildButtonForBattleHint() {
        // 让未完成的 scheduleOnce 回调全部失效
        this.buildButtonBattleHintBlinkSeqId++;

        const btnNode = this.buildButtonBattleHintNode;
        if (!btnNode || !btnNode.isValid) return;

        const os = this.buildButtonBattleHintOriginalScale;
        if (os) btnNode.setScale(os.x, os.y, os.z);

        const sprite = btnNode.getComponent(Sprite);
        if (sprite && sprite.isValid && this.buildButtonBattleHintOriginalColor) {
            sprite.color = this.buildButtonBattleHintOriginalColor;
        }
    }

    /**
     * A 提示触发后：玩家点击建造按钮打开建筑选择面板时，
     * 高亮建筑物候选框里的“教堂”选项。
     * 注意：只做一次高亮，避免重复干扰玩家操作。
     */
    private tryHighlightChurchCandidateAfterBuild() {
        if (!this.pendingHighlightChurchCandidateAfterBuild) {
            return;
        }

        const panelNode = find('Canvas/BuildingSelectionPanel') || find('BuildingSelectionPanel');
        if (!panelNode || !panelNode.isValid) {
            return;
        }

        // 玩家已打开建造面板：立即停止“建造按钮频闪”，避免干扰操作
        if (!panelNode.activeInHierarchy) {
            return;
        }
        this.stopBuildButtonForBattleHint();

        const contentNode = panelNode.getChildByName('Content');
        if (!contentNode || !contentNode.isValid) {
            return;
        }

        // 建筑候选项节点命名规则：BuildingItem_${building.name}（教堂）
        let churchCandidateItem = contentNode.getChildByName('BuildingItem_教堂');
        if (!churchCandidateItem || !churchCandidateItem.isValid) {
            // 更鲁棒的兜底：不强依赖固定节点名，避免字面不一致导致找不到
            const children = contentNode.children || [];
            for (const c of children) {
                if (!c || !c.isValid) continue;
                if (!c.name || typeof c.name !== 'string') continue;
                if (c.name.startsWith('BuildingItem_') && (c.name.includes('教堂') || c.name.includes('Church'))) {
                    churchCandidateItem = c;
                    break;
                }
            }
        }

        if (!churchCandidateItem || !churchCandidateItem.isValid) {
            const now = Date.now();
            if (now - this.lastPendingChurchHighlightDebugLogMs >= 1500) {
                this.lastPendingChurchHighlightDebugLogMs = now;
                // console.log(
                //     '[BattleDialog][A] pending church highlight: cannot find candidate item. ' +
                //     `panelChildren=${(contentNode.children || []).length}`
                // );
            }
            return;
        }

        // 注意：BuildingItem 背景是 Graphics 绘制，直接改 fillColor 可能不重绘，用户看不到变化。
        // 这里统一用可见性更强的缩放频闪来高亮“教堂”候选项。
        this.blinkNodeForBattleHint(
            churchCandidateItem,
            8,
            0.35,
            0.28,
            1.18,
            new Color(255, 255, 0, 255)
        );

        this.pendingHighlightChurchCandidateAfterBuild = false;
    }

    /**
     * D 提示触发后：玩家点击建造按钮打开建筑选择面板时，
     * 高亮建筑物候选框里的“剑士小屋 / SwordsmanHall”选项。
     * 注意：只做一次高亮，避免重复干扰玩家操作。
     */
    private tryHighlightSwordsmanHallCandidateAfterBuild() {
        if (!this.pendingHighlightSwordsmanHallCandidateAfterBuild) {
            return;
        }

        const panelNode = find('Canvas/BuildingSelectionPanel') || find('BuildingSelectionPanel');
        if (!panelNode || !panelNode.isValid) {
            return;
        }
        if (!panelNode.activeInHierarchy) {
            return;
        }
        // 玩家已打开建造面板：立即停止“建造按钮频闪”，避免干扰操作
        this.stopBuildButtonForBattleHint();

        const contentNode = panelNode.getChildByName('Content');
        if (!contentNode || !contentNode.isValid) {
            return;
        }

        // 建筑候选项节点命名规则：BuildingItem_${building.name}
        let swordsmanHallItem =
            contentNode.getChildByName('BuildingItem_剑士小屋') ||
            contentNode.getChildByName('BuildingItem_剑士屋') ||
            contentNode.getChildByName('BuildingItem_SwordsmanHall') ||
            null;

        if (!swordsmanHallItem || !swordsmanHallItem.isValid) {
            // 兜底：不依赖固定节点名，扫描一层 children
            const children = contentNode.children || [];
            for (const c of children) {
                if (!c || !c.isValid) continue;
                const n = String((c as any).name || '');
                if (!n.startsWith('BuildingItem_')) continue;
                // 可能的命名包含：剑士、小屋、兵营、Swordsman
                if (n.includes('剑士') || n.includes('Swordsman')) {
                    swordsmanHallItem = c;
                    break;
                }
            }
        }

        if (!swordsmanHallItem || !swordsmanHallItem.isValid) {
            return;
        }

        this.blinkNodeForBattleHint(
            swordsmanHallItem,
            8,
            0.35,
            0.28,
            1.18,
            new Color(255, 255, 0, 255)
        );
        this.pendingHighlightSwordsmanHallCandidateAfterBuild = false;
    }

    /**
     * 友方单位数量快照（不递归，只扫描固定容器的一层 children）。
     * 用于检测“有单位被击杀”（数量下降）。
     */
    private getFriendlyUnitCountSnapshotNoRecursion(): number {
        let total = 0;

        // Canvas/Towers 里通常混放 Arrower / Priest（以及可能的其他Role）
        const towers = find('Canvas/Towers');
        if (towers && towers.isValid && towers.activeInHierarchy) {
            const children = towers.children || [];
            for (let i = 0; i < children.length; i++) {
                const node = children[i];
                if (!node || !node.isValid || !node.active) continue;
                if (node.getComponent('Arrower') || node.getComponent('Priest')) {
                    total++;
                }
            }
        }

        const watchList: Array<{ path: string; comp: string }> = [
            { path: 'Canvas/Hunters', comp: 'Hunter' },
            { path: 'Canvas/Mages', comp: 'Mage' },
            { path: 'Canvas/Swordsmen', comp: 'ElfSwordsman' },
            // 兼容：如果未来把 Priest/Arrower 放到独立容器，这里也能统计到
            { path: 'Canvas/Priests', comp: 'Priest' },
            { path: 'Canvas/Arrowers', comp: 'Arrower' },
            { path: 'Canvas/Archers', comp: 'Arrower' },
        ];

        for (let w = 0; w < watchList.length; w++) {
            const item = watchList[w];
            const container = find(item.path);
            if (!container || !container.isValid || !container.activeInHierarchy) continue;
            const children = container.children || [];
            for (let j = 0; j < children.length; j++) {
                const node = children[j];
                if (!node || !node.isValid || !node.active) continue;
                if (node.getComponent(item.comp)) {
                    total++;
                }
            }
        }
        return total;
    }

    /**
     * C 提示触发时：高亮生命之树（Canvas/Crystal）
     */
    private highlightCrystalForBattleHint() {
        const crystalNode = this.crystal && this.crystal.isValid ? this.crystal : find('Canvas/Crystal');
        if (!crystalNode || !crystalNode.isValid) {
            return;
        }
        this.blinkNodeForBattleHint(crystalNode, 10, 0.5, 0.5, 1.15, new Color(255, 235, 120, 255));
    }

    /**
     * 通用频闪高亮：放大 + 着色，再还原（循环）
     */
    private blinkNodeForBattleHint(
        targetNode: Node,
        loops: number,
        highlightSec: number,
        restoreSec: number,
        scaleMul: number,
        highlightColor: Color
    ) {
        if (!targetNode || !targetNode.isValid || loops <= 0) return;
        if (!targetNode.active) {
            targetNode.active = true;
        }
        const sprite = targetNode.getComponent(Sprite);
        const origScale = targetNode.scale.clone();
        const origColor = sprite ? sprite.color.clone() : new Color(255, 255, 255, 255);
        const sx = origScale.x;
        const sy = origScale.y;
        const sz = origScale.z;

        const setHighlight = () => {
            if (!targetNode || !targetNode.isValid) return;
            targetNode.setScale(sx * scaleMul, sy * scaleMul, sz);
            if (sprite && sprite.isValid) {
                sprite.color = highlightColor;
            }
        };
        const setRestore = () => {
            if (!targetNode || !targetNode.isValid) return;
            targetNode.setScale(sx, sy, sz);
            if (sprite && sprite.isValid) {
                sprite.color = origColor;
            }
        };

        for (let i = 0; i < loops; i++) {
            this.scheduleOnce(() => {
                setHighlight();
                this.scheduleOnce(() => setRestore(), Math.max(0, highlightSec));
            }, i * Math.max(0, highlightSec + restoreSec));
        }
        this.scheduleOnce(() => setRestore(), loops * Math.max(0, highlightSec + restoreSec));
    }

    private showQuickUnitIntro(unitScript: any, unitName: string, unitDescription: string, unitId: string) {
        this.autoCreateUnitIntroPopup();
        if (!this.unitIntroPopup) {
            return;
        }
        const unitIcon = unitScript?.cardIcon || unitScript?.defaultSpriteFrame || unitScript?.node?.getComponent(Sprite)?.spriteFrame || null;
        this.unitIntroPopup.show({
            unitName,
            unitDescription,
            unitIcon,
            unitType: unitId,
            unitId
        });
    }

    private getFirstActiveUnitScriptInContainers(containerPaths: string[], componentName: string): any | null {
        for (let p = 0; p < containerPaths.length; p++) {
            const container = find(containerPaths[p]);
            if (!container || !container.isValid || !container.activeInHierarchy) continue;
            const children = container.children || [];
            for (let i = 0; i < children.length; i++) {
                const node = children[i];
                if (!node || !node.isValid || !node.active) continue;
                const script = node.getComponent(componentName) as any;
                if (script && script.node && script.node.isValid && script.node.active) {
                    return script;
                }
            }
        }
        return null;
    }

    private getFirstInjuredArrowerInContainers(containerPaths: string[]): any | null {
        for (let p = 0; p < containerPaths.length; p++) {
            const container = find(containerPaths[p]);
            if (!container || !container.isValid || !container.activeInHierarchy) continue;
            const children = container.children || [];
            for (let i = 0; i < children.length; i++) {
                const node = children[i];
                if (!node || !node.isValid || !node.active) continue;
                const ar = node.getComponent('Arrower') as any;
                if (!ar || !ar.node || !ar.node.isValid || !ar.node.active) continue;
                const cur = Number(ar.currentHealth);
                const max = Number(ar.maxHealth);
                if (isFinite(cur) && isFinite(max) && max > 0 && cur < max) {
                    return ar;
                }
            }
        }
        return null;
    }

    private readHealthSafe(script: any): number {
        if (!script) return 0;
        if (typeof script.getHealth === 'function') {
            const h = Number(script.getHealth());
            if (isFinite(h)) return Math.max(0, h);
        }
        const h2 = Number(script.currentHealth);
        if (isFinite(h2)) return Math.max(0, h2);
        return 0;
    }

    private getDefenseStructureHealthSnapshotNoRecursion(): number {
        let total = 0;
        if (this.crystalScript) {
            total += this.readHealthSafe(this.crystalScript);
        }
        const watchList: Array<{ path: string; comp: string }> = [
            { path: 'Canvas/WarAncientTrees', comp: 'WarAncientTree' },
            { path: 'Canvas/WatchTowers', comp: 'WatchTower' },
            { path: 'Canvas/IceTowers', comp: 'IceTower' },
            { path: 'Canvas/ThunderTowers', comp: 'ThunderTower' },
        ];
        for (let i = 0; i < watchList.length; i++) {
            const item = watchList[i];
            const container = find(item.path);
            if (!container || !container.isValid || !container.activeInHierarchy) continue;
            const children = container.children || [];
            for (let j = 0; j < children.length; j++) {
                const node = children[j];
                if (!node || !node.isValid || !node.active) continue;
                const script = node.getComponent(item.comp) as any;
                total += this.readHealthSafe(script);
            }
        }
        return total;
    }
    
    /**
     * 显示单位介绍
     * @param unitScript 单位脚本
     */
    showUnitIntro(unitScript: any, onCloseCallback?: (() => void) | null) {
        
        // 自动创建单位介绍弹窗
        this.autoCreateUnitIntroPopup();
        
        // 获取单位图片，优先使用cardIcon，其次使用spriteFrame
        let unitIcon = null;
        if (unitScript.cardIcon) {
            unitIcon = unitScript.cardIcon;
        } else if (unitScript.defaultSpriteFrame) {
            unitIcon = unitScript.defaultSpriteFrame;
        } else if (unitScript.node) {
            // 尝试获取单位的Sprite组件的spriteFrame
            const spriteComponent = unitScript.node.getComponent(Sprite);
            if (spriteComponent && spriteComponent.spriteFrame) {
                unitIcon = spriteComponent.spriteFrame;
            }
        }
        
        if (this.unitIntroPopup) {
            // 从 unitConfig.json 获取单位信息
            const configManager = UnitConfigManager.getInstance();
            // 获取单位ID（优先使用 prefabName，其次使用 unitType）
            const rawUnitId = unitScript.prefabName || unitScript.unitType || '';
            const displayInfo = configManager.getUnitDisplayInfo(rawUnitId);

            // 使用配置文件中的名称
            const unitName = displayInfo ? displayInfo.name : (unitScript.unitName || '未知单位');

            // 单位介绍框中的台词：按关卡从 spawnDialogs 中读取，缺省回退到第1关 / 任何一条
            let unitDescription = '暂无描述';
            try {
                // 获取当前关卡（默认第1关）
                let level = 1;
                if (this.uiManager && (this.uiManager as any).getCurrentLevel) {
                    const currentLevel = (this.uiManager as any).getCurrentLevel();
                    if (typeof currentLevel === 'number' && !isNaN(currentLevel)) {
                        level = currentLevel;
                    }
                }

                const dialogText = configManager.getUnitSpawnDialog(rawUnitId, level);
                if (dialogText) {
                    unitDescription = dialogText;
                } else if (displayInfo && displayInfo.description) {
                    // 如果没有按关卡配置，则回退到 displayInfo.description
                    unitDescription = displayInfo.description;
                }
            } catch (e) {
                // 任意错误都回退到静态描述
                if (displayInfo && displayInfo.description) {
                    unitDescription = displayInfo.description;
                }
            }

            this.unitIntroPopup.show({
                unitName: unitName,
                unitDescription: unitDescription,
                unitIcon: unitIcon,
                unitType: unitScript.unitType || 'unknown',
                unitId: rawUnitId,  // prefabName，用于识别小精灵等以触发新手教程
                onCloseCallback: onCloseCallback || undefined
            });
        } else {
        }
    }

    private getIntroCloseCallback(uniqueUnitType: string): (() => void) | null {
        const level = this.getCurrentLevelSafe();
        // 第二关：小精灵介绍关闭后，自动弹出法师塔解锁介绍
        const isWispIntro = uniqueUnitType === '小精灵' || uniqueUnitType === 'Wisp';
        if (level === 2 && isWispIntro && !this.hasShownLevel2MageTowerUnlockIntro) {
            this.hasShownLevel2MageTowerUnlockIntro = true;
            return () => this.showMageTowerUnlockIntro();
        }
        return null;
    }

    private getCurrentLevelSafe(): number {
        let level = 1;
        if (this.uiManager && (this.uiManager as any).getCurrentLevel) {
            const currentLevel = (this.uiManager as any).getCurrentLevel();
            if (typeof currentLevel === 'number' && !isNaN(currentLevel)) {
                level = currentLevel;
            }
        }
        // 兜底：避免 this.uiManager 尚未缓存，导致始终回落到第1关
        if (level === 1) {
            const uiManagerNode = find('UIManager') || find('UI/UIManager') || find('Canvas/UI/UIManager');
            const uiManager = uiManagerNode?.getComponent('UIManager') as any;
            if (uiManager && typeof uiManager.getCurrentLevel === 'function') {
                const currentLevel = uiManager.getCurrentLevel();
                if (typeof currentLevel === 'number' && !isNaN(currentLevel)) {
                    level = currentLevel;
                }
            }
        }
        return level;
    }

    private showMageTowerUnlockIntro() {
        const unitId = 'MageTower';
        const configManager = UnitConfigManager.getInstance();
        const displayInfo = configManager.getUnitDisplayInfo(unitId);
        const towerBuilder = this.findComponentInScene('TowerBuilder') as any;
        const unitIcon = towerBuilder?.mageTowerIcon || null;

        const pseudoUnitScript: any = {
            prefabName: unitId,
            unitType: unitId,
            unitName: displayInfo?.name || '法师塔',
            defaultSpriteFrame: unitIcon,
            cardIcon: unitIcon
        };
        this.showUnitIntro(pseudoUnitScript);
    }

    /**
     * 堵门触发“兽人燃血狂暴”时的特殊介绍弹窗
     */
    public showOrcBloodRageIntro(onCloseCallback?: () => void, rageTier: number = 1) {
        this.autoCreateUnitIntroPopup();
        if (!this.unitIntroPopup) return;
        const isTier2 = rageTier >= 2;
        const unitName = isTier2 ? '燃血狂暴' : '兽人狂暴';
        const unitDescription = isTier2 ? '挡我者死！' : '兽人永不为奴！';
        const iconPath = isTier2 ? 'textures/orc/kuangbao2/spriteFrame' : 'textures/orc/kuangbao/spriteFrame';
        const cachedIcon = isTier2 ? this.orcRageTier2IntroIcon : this.orcRageIntroIcon;
        const showPopup = (icon: SpriteFrame | null) => {
            this.unitIntroPopup.show({
                unitName: unitName,
                unitDescription: unitDescription,
                unitIcon: icon,
                unitType: 'OrcWarrior',
                unitId: 'OrcWarrior',
                introBorderColor: new Color(255, 60, 60, 255),
                onCloseCallback: onCloseCallback
            });
        };

        if (cachedIcon) {
            showPopup(cachedIcon);
            return;
        }

        resources.load(iconPath, SpriteFrame, (err, spriteFrame) => {
            if (err || !spriteFrame) {
                console.warn(`[GameManager] 加载${unitName}介绍贴图失败，使用空图标展示:`, err);
                showPopup(null);
                return;
            }
            if (isTier2) {
                this.orcRageTier2IntroIcon = spriteFrame;
            } else {
                this.orcRageIntroIcon = spriteFrame;
            }
            showPopup(spriteFrame);
        });
    }

    // 金币相关方法
    getGold(): number {
        return this.gold;
    }

    addGold(amount: number) {
        this.gold += amount;
        this.updateUI();
    }

    // 木材相关方法
    getWood(): number {
        return this.wood;
    }

    addWood(amount: number) {
        if (amount === 0) {
            return;
        }
        this.wood += amount;
        if (this.wood < 0) {
            this.wood = 0;
        }
        this.updateUI();
    }

    spendWood(amount: number): boolean {
        if (amount <= 0) {
            return true;
        }
        if (this.wood >= amount) {
            this.wood -= amount;
            this.updateUI();
            return true;
        }
        return false;
    }

    // 经验值相关方法
    addExperience(amount: number) {
        if (amount > 0) {
            this.currentGameExp += amount;
        }
    }

    spendGold(amount: number): boolean {
        if (this.gold >= amount) {
            this.gold -= amount;
            this.updateUI();
            return true;
        }
        return false;
    }

    /**
     * 获取所有已上场的单位类型列表
     */
    getActiveUnitTypes(): string[] {
        const unitTypes = new Set<string>();
        
        // 单位容器路径映射
        const unitContainers: Record<string, string[]> = {
            'Arrower': ['Canvas/Towers'],
            'Hunter': ['Canvas/Hunters'],
            'Mage': ['Canvas/Mages'],
            // 剑士容器命名在不同场景/版本中可能不同，这里做兼容
            'ElfSwordsman': ['Canvas/Swordsmen', 'Canvas/ElfSwordsmans'],
            'Priest': ['Canvas/Towers'],
            'StoneWall': ['Canvas/StoneWalls'],
            'WatchTower': ['Canvas/WatchTowers'],
            'IceTower': ['Canvas/IceTowers'],
            'ThunderTower': ['Canvas/ThunderTowers'],
            'WarAncientTree': ['Canvas/WarAncientTrees'],
            'HunterHall': ['Canvas/HunterHalls'],
            'MageTower': ['Canvas/MageTowers'],
            'SwordsmanHall': ['Canvas/SwordsmanHalls'],
            'Church': ['Canvas/Churches'],
        };
        
        // 检查每个单位类型是否有已上场的单位
        for (const unitType in unitContainers) {
            const containers = unitContainers[unitType];
            for (const containerPath of containers) {
                const container = find(containerPath);
                if (container) {
                    for (const child of container.children) {
                        if (child && child.isValid && child.active) {
                            // 检查是否有对应的组件
                            // 对于建筑类单位（WatchTower, IceTower, ThunderTower等），需要检查具体的组件类名
                            // 对于其他单位，检查Role或Build组件
                            let script: any = null;
                            if (unitType === 'WatchTower' || unitType === 'IceTower' || unitType === 'ThunderTower' ||
                                unitType === 'StoneWall' ||
                                unitType === 'WarAncientTree' || unitType === 'HunterHall' || 
                                unitType === 'SwordsmanHall' || unitType === 'Church') {
                                // 建筑类单位，检查具体的组件类名
                                script = child.getComponent(unitType) as any;
                            } else {
                                // 其他单位，必须精确匹配组件类名
                                script = child.getComponent(unitType) as any;
                                // 如果找不到精确匹配，检查是否有unitType属性匹配
                                if (!script) {
                                    const roleScript = child.getComponent('Role') as any;
                                    const buildScript = child.getComponent('Build') as any;
                                    const tempScript = roleScript || buildScript;
                                    if (tempScript && tempScript.unitType === unitType) {
                                        script = tempScript;
                                    }
                                }
                            }
                            
                            if (script) {
                                unitTypes.add(unitType);
                                //console.info(`[GameManager] 找到已上场的单位类型: ${unitType}，容器: ${containerPath}`);
                                break; // 找到一个就够了
                            }
                        }
                    }
                }
                if (unitTypes.has(unitType)) {
                    break; // 已经找到，不需要继续检查其他容器
                }
            }
        }
        
        //console.info(`[GameManager] 已上场的单位类型列表:`, Array.from(unitTypes));
        return Array.from(unitTypes);
    }

    /**
     * 生成增益卡片数据（总是生成3张卡片）
     */
    generateBuffCards(isRerollMode: boolean = false, forceFirstDrawFixedSp: boolean = false): BuffCardData[] {
        // 法师塔不参与增幅卡片池，仅保留法师单位参与
        const activeUnitTypes = this.getActiveUnitTypes().filter(type => type !== 'MageTower');
        //console.info(`[GameManager] generateBuffCards: 已上场的单位类型数量=${activeUnitTypes.length}, 再抽一次模式=${isRerollMode}`);
        
        const cards: BuffCardData[] = [];
        const configManager = UnitConfigManager.getInstance();
        const buffCardConfigManager = BuffCardConfigManager.getInstance();
        
        if (!buffCardConfigManager.isConfigLoaded()) {
            console.warn('[GameManager] generateBuffCards: 增益卡片配置未加载，使用默认配置');
        }

        // 普通抽卡且是“本关首次抽卡”时，使用固定 SP 组合
        if (!isRerollMode && forceFirstDrawFixedSp) {
            const currentLevel = this.getCurrentLevelSafe();
            const fixedSpUnitTypes: string[] = ['StoneWall', 'WatchTower'];
            if (currentLevel <= 4) {
                // 前四关：固定 石墙 + 哨塔 + 弓箭手
                fixedSpUnitTypes.push('Arrower');
            } else {
                // 第五关起：固定 石墙 + 哨塔 + 场上存在的一个 role
                const roleTypes = ['Arrower', 'Hunter', 'ElfSwordsman', 'Priest', 'Mage'];
                const activeRoleTypes = activeUnitTypes.filter((t) => roleTypes.indexOf(t) !== -1);
                const randomRole = activeRoleTypes.length > 0
                    ? activeRoleTypes[Math.floor(Math.random() * activeRoleTypes.length)]
                    : 'Arrower';
                fixedSpUnitTypes.push(randomRole);
            }
            // 注意：首抽固定SP必须“稳定必出”，不能依赖 BuffCardConfigManager 异步加载是否完成。
            // 因此这里直接构造 SP 卡片数据（并尽量从场景实例拿图标），避免被降级为 SSR。
            return fixedSpUnitTypes.map((unitType) => this.buildFixedSpCard(unitType, configManager));
        }
        
        // 如果是再抽一次模式，确定UR/SP卡片的位置（随机选择，且不重复）
        let urCardIndex = -1;
        let spCardIndex = -1;
        if (isRerollMode) {
            // 检查是否有支持UR的单位类型（只有角色和防御塔有UR）
            const urEligibleTypes = this.getUREligibleUnitTypes(activeUnitTypes);
            if (urEligibleTypes.length > 0) {
                urCardIndex = Math.floor(Math.random() * 3);
            } else {
                // 如果没有支持UR的单位类型，不设置UR位置
                console.warn('[GameManager] generateBuffCards: 再抽一次模式，但没有支持UR的单位类型');
            }

            // 再抽一次：强制至少 1 张 SP（彩色卡）
            // SP 可用于 角色 + 防御塔(Watch/Ice/Thunder) + StoneWall（无声自愈）
            try {
                const buffCardConfigManager = BuffCardConfigManager.getInstance();
                const spEligibleTypes = activeUnitTypes.filter((t) => {
                    const cat = buffCardConfigManager.getUnitTypeCategory(t);
                    return cat === 'role' || cat === 'tower' || t === 'StoneWall';
                });
                if (spEligibleTypes.length > 0) {
                    const candidates = [0, 1, 2].filter((i) => i !== urCardIndex);
                    spCardIndex = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : -1;
                }
            } catch {}
        }
        
        // 总是生成3张卡片
        for (let cardCount = 0; cardCount < 3; cardCount++) {
            let rarity: 'R' | 'SR' | 'SSR' | 'UR' | 'SP';
            
            // 如果是再抽一次模式且当前卡片是UR位置
            if (isRerollMode && cardCount === urCardIndex && urCardIndex >= 0) {
                rarity = 'UR';
            } else if (isRerollMode && cardCount === spCardIndex && spCardIndex >= 0) {
                rarity = 'SP';
            } else {
                // 生成卡片稀有度（普通模式或非UR位置）
                rarity = buffCardConfigManager.generateRarity();
            }
            //console.info(`[GameManager] generateBuffCards: 卡片 ${cardCount + 1} 稀有度=${rarity}`);
            
            // 决定是单位增益还是全局增益（20%概率生成全局增益）
            // 注意：UR卡片只有角色和防御塔才有，不生成全局增益
            // SP/UR 不生成全局增益（SP 为彩色特殊卡，只做单位效果）
            const isGlobalBuff = rarity !== 'UR' && rarity !== 'SP' && Math.random() < 0.2;
            
            let cardData: BuffCardData;
            
            if (isGlobalBuff && activeUnitTypes.length > 0) {
                // 生成全局增益卡片（人口或金币）
                const globalEffects = buffCardConfigManager.getGlobalBuffEffects(rarity);
                const globalBuffTypes = Object.keys(globalEffects);
                if (globalBuffTypes.length > 0) {
                    const randomGlobalBuffType = globalBuffTypes[Math.floor(Math.random() * globalBuffTypes.length)];
                    const globalBuff = globalEffects[randomGlobalBuffType];
                    
                    // 根据增益类型选择对应的图标
                    let unitIcon: SpriteFrame | null = null;
                    let unitName: string = '';
                    
                    if (randomGlobalBuffType === 'populationIncrease') {
                        // 人口增加卡片：使用人口图标
                        unitIcon = this.populationIcon;
                        unitName = '人口上限';
                    } else if (randomGlobalBuffType === 'goldReward') {
                        // 金币增加卡片：使用金币图标
                        unitIcon = this.goldIcon;
                        unitName = '金币奖励';
                    } else {
                        // 其他全局增益：随机选择一个单位类型用于显示图标（兼容性处理）
                        const randomUnitType = activeUnitTypes[Math.floor(Math.random() * activeUnitTypes.length)];
                        const displayInfo = configManager.getUnitDisplayInfo(randomUnitType);
                        unitName = displayInfo ? displayInfo.name : randomUnitType;
                        
                        const unitInstance = this.findFirstUnitInstance(randomUnitType);
                        if (unitInstance) {
                            const unitScript = unitInstance.getComponent(randomUnitType) as any ||
                                             unitInstance.getComponent('Role') as any ||
                                             unitInstance.getComponent('Build') as any;
                            if (unitScript) {
                                if (unitScript.cardIcon) {
                                    unitIcon = unitScript.cardIcon;
                                } else if (unitScript.defaultSpriteFrame) {
                                    unitIcon = unitScript.defaultSpriteFrame;
                                }
                            }
                        }
                    }
                    
                    cardData = {
                        unitId: randomGlobalBuffType,
                        unitName: unitName,
                        unitIcon: unitIcon,
                        buffType: randomGlobalBuffType,
                        buffValue: globalBuff.value,
                        buffDescription: globalBuff.desc,
                        rarity: rarity
                    };
                } else {
                    // 如果没有全局增益，生成单位增益
                    cardData = this.generateUnitBuffCard(activeUnitTypes, configManager, buffCardConfigManager, rarity, cardCount);
                }
            } else if (activeUnitTypes.length > 0) {
                // 生成单位增益卡片
                // 如果是UR卡片，只从支持UR的单位类型中选择（角色和防御塔）
                let eligibleTypes = activeUnitTypes;
                if (rarity === 'UR') {
                    eligibleTypes = this.getUREligibleUnitTypes(activeUnitTypes);
                    if (eligibleTypes.length === 0) {
                        // 如果没有支持UR的单位类型，降级为SSR（这种情况不应该发生，因为前面已经检查过）
                        console.warn('[GameManager] generateBuffCards: UR卡片但没有支持UR的单位类型，降级为SSR');
                        rarity = 'SSR';
                        eligibleTypes = activeUnitTypes;
                    }
                }
                cardData = this.generateUnitBuffCard(eligibleTypes, configManager, buffCardConfigManager, rarity, cardCount);
            } else {
                // 没有已上场的单位，生成全局增益
                const globalEffects = buffCardConfigManager.getGlobalBuffEffects(rarity);
                const globalBuffTypes = Object.keys(globalEffects);
                if (globalBuffTypes.length > 0) {
                    const randomGlobalBuffType = globalBuffTypes[Math.floor(Math.random() * globalBuffTypes.length)];
                    const globalBuff = globalEffects[randomGlobalBuffType];
                    
                    // 根据增益类型选择对应的图标
                    let unitIcon: SpriteFrame | null = null;
                    let unitName: string = '全局增益';
                    
                    if (randomGlobalBuffType === 'populationIncrease') {
                        // 人口增加卡片：使用人口图标
                        unitIcon = this.populationIcon;
                        unitName = '人口上限';
                    } else if (randomGlobalBuffType === 'goldReward') {
                        // 金币增加卡片：使用金币图标
                        unitIcon = this.goldIcon;
                        unitName = '金币奖励';
                    }
                    
                    cardData = {
                        unitId: randomGlobalBuffType,
                        unitName: unitName,
                        unitIcon: unitIcon,
                        buffType: randomGlobalBuffType,
                        buffValue: globalBuff.value,
                        buffDescription: globalBuff.desc,
                        rarity: rarity
                    };
                } else {
                    console.warn('[GameManager] generateBuffCards: 无法生成卡片，没有可用的增益效果');
                    continue;
                }
            }
            
            //console.info(`[GameManager] generateBuffCards: 生成卡片 ${cardCount + 1}`, cardData);
            cards.push(cardData);
        }
        
        //console.info(`[GameManager] generateBuffCards: 总共生成了 ${cards.length} 张卡片`);
        return cards;
    }
    
    /**
     * 获取支持UR的单位类型（只有角色和防御塔有UR）
     */
    private getUREligibleUnitTypes(activeUnitTypes: string[]): string[] {
        // 角色类型（继承Role的单位）
        const roleTypes = ['Arrower', 'Hunter', 'ElfSwordsman', 'Priest', 'Mage'];
        // 防御塔类型
        const towerTypes = ['WatchTower', 'IceTower', 'ThunderTower'];
        
        // 筛选出既是已上场单位，又是角色或防御塔的单位类型
        return activeUnitTypes.filter(type => 
            roleTypes.indexOf(type) !== -1 || towerTypes.indexOf(type) !== -1
        );
    }
    
    /**
     * 生成单位增益卡片
     */
    private generateUnitBuffCard(
        activeUnitTypes: string[],
        configManager: UnitConfigManager,
        buffCardConfigManager: BuffCardConfigManager,
        rarity: 'R' | 'SR' | 'SSR' | 'UR' | 'SP',
        cardIndex: number
    ): BuffCardData {
        // SP 彩色卡：允许从“角色 + 防御塔 + StoneWall”单位池中抽取
        if (rarity === 'SP') {
            const spEligible = activeUnitTypes.filter((t) => {
                const cat = buffCardConfigManager.getUnitTypeCategory(t);
                return cat === 'role' || cat === 'tower' || t === 'StoneWall';
            });
            if (spEligible.length > 0) {
                activeUnitTypes = spEligible;
            } else {
                // 没有 SP 可用单位时，降级为 SSR
                rarity = 'SSR';
            }
        }
        // 打乱单位类型
        const shuffledTypes = [...activeUnitTypes].sort(() => Math.random() - 0.5);
        const unitType = shuffledTypes[cardIndex % shuffledTypes.length];
        
        // 获取单位显示信息
        const displayInfo = configManager.getUnitDisplayInfo(unitType);
        const unitName = displayInfo ? displayInfo.name : unitType;
        
        // 从实际的预制体实例中获取 cardIcon
        let unitIcon: SpriteFrame | null = null;
        const unitInstance = this.findFirstUnitInstance(unitType);
        //console.info(`[GameManager] generateUnitBuffCard: 查找单位类型 ${unitType}，找到实例=${!!unitInstance}`);
        if (unitInstance) {
            const unitScript = unitInstance.getComponent(unitType) as any ||
                             unitInstance.getComponent('Role') as any ||
                             unitInstance.getComponent('Build') as any;
            if (unitScript) {
                if (unitScript.cardIcon) {
                    unitIcon = unitScript.cardIcon;
                    //console.info(`[GameManager] generateUnitBuffCard: 使用 cardIcon，单位类型=${unitType}`);
                } else if (unitScript.defaultSpriteFrame) {
                    unitIcon = unitScript.defaultSpriteFrame;
                    //console.info(`[GameManager] generateUnitBuffCard: 使用 defaultSpriteFrame，单位类型=${unitType}`);
                } else if (unitScript.node) {
                    const spriteComponent = unitScript.node.getComponent(Sprite);
                    if (spriteComponent && spriteComponent.spriteFrame) {
                        unitIcon = spriteComponent.spriteFrame;
                        //console.info(`[GameManager] generateUnitBuffCard: 使用 Sprite.spriteFrame，单位类型=${unitType}`);
                    }
                }
            } else {
                console.warn(`[GameManager] generateUnitBuffCard: 单位实例 ${unitType} 没有找到脚本组件`);
            }
        } else {
            console.warn(`[GameManager] generateUnitBuffCard: 没有找到单位类型 ${unitType} 的实例`);
        }
        
        // 获取单位类型分类
        const unitCategory = buffCardConfigManager.getUnitTypeCategory(unitType);
        
        // 如果是 SP（彩色）卡片：目前支持 角色 + 防御塔(Watch/Ice/Thunder) + 石墙
        // 其它单位暂不支持 SP，降级为 SSR 普通属性卡
        const spAllowedNonRoleUnits = new Set<string>(['StoneWall', 'WatchTower', 'IceTower', 'ThunderTower']);
        if (rarity === 'SP' && unitCategory !== 'role' && !spAllowedNonRoleUnits.has(unitType)) {
            rarity = 'SSR';
        }
        
        // 获取该单位类型可用的增益效果
        // 如果是UR，先尝试获取UR配置，如果没有则使用SSR配置并增强
        let buffEffects = buffCardConfigManager.getBuffEffects(rarity, unitCategory);
        let buffValueMultiplier = 1.0; // UR属性加成倍数（在SSR之上）
        
        if (rarity === 'UR') {
            // UR卡片：如果配置中没有UR，使用SSR配置并增强50%
            if (Object.keys(buffEffects).length === 0) {
                buffEffects = buffCardConfigManager.getBuffEffects('SSR', unitCategory);
                buffValueMultiplier = 1.5; // UR属性加成在SSR基础上增加50%
            } else {
                // 如果配置中有UR，使用UR配置（通常UR配置的值已经比SSR高）
                buffValueMultiplier = 1.0;
            }
        }
        
        let buffTypes = Object.keys(buffEffects);
        // SP 彩色卡：按单位类型过滤专属效果，避免错配
        if (rarity === 'SP') {
            const spMap: Record<string, string[]> = {
                Arrower: ['multiArrow'],
                Hunter: ['bouncyBoomerang'],
                ElfSwordsman: ['heavyArmor'],
                Priest: ['widePrayer'],
                Mage: ['bangBangBang'],
                StoneWall: ['selfHealingWall'],
                ThunderTower: ['thunderChainPlus'],
                IceTower: ['iceCrawl'],
                WatchTower: ['ballista']
            };
            const allowed = spMap[unitType] || [];
            buffTypes = buffTypes.filter(t => allowed.indexOf(t) !== -1);

            // 已满 3 级的 SP 不再出现
            try {
                const bm = BuffManager.getInstance();
                buffTypes = buffTypes.filter((t) => bm.getSpLevel(unitType, t) < 3);
            } catch {}
        }
        // 法师不提供攻速增幅：仅允许攻击力与移动速度
        // 注意：SP 卡片已经做过“法师专属彩色效果”过滤，这里不能再覆盖掉，否则会把 SP 错当成普通属性卡（例如把攻击力+20%带出来）
        if (unitType === 'Mage' && rarity !== 'SP') {
            buffTypes = buffTypes.filter(type => type === 'attackDamage' || type === 'moveSpeed');
        }
        // 建筑物（如 弓箭手小屋/教堂/猎手大厅/剑士小屋 等）不出现“攻击力增幅”卡片
        if (unitCategory === 'building') {
            buffTypes = buffTypes.filter(type => type !== 'attackDamage');
        }
        
        if (buffTypes.length === 0) {
            console.warn(`[GameManager] generateUnitBuffCard: 单位类型 ${unitType} 没有可用的增益效果`);
            // 对于建筑物：不要回退到攻击力，改为提供生命值增幅作为兜底
            if (unitCategory === 'building') {
                const baseValue = rarity === 'UR' ? 45 : (rarity === 'SSR' ? 40 : rarity === 'SR' ? 30 : 20);
                return {
                    unitId: unitType,
                    unitName: unitName,
                    unitIcon: unitIcon,
                    buffType: 'maxHealth',
                    buffValue: baseValue,
                    buffDescription: `${unitName}: 生命值+${baseValue}%`,
                    rarity: rarity
                };
            }
            // 非建筑：保持原有兜底（攻击力）
            const baseValue = rarity === 'UR' ? 30 : 20;
            return {
                unitId: unitType,
                unitName: unitName,
                unitIcon: unitIcon,
                buffType: 'attackDamage',
                buffValue: baseValue,
                buffDescription: `${unitName}: 攻击力+${baseValue}%`,
                rarity: rarity
            };
        }
        
        // 随机选择一个增益类型
        const randomBuffType = buffTypes[Math.floor(Math.random() * buffTypes.length)];
        const buff = buffEffects[randomBuffType];
        
        // 应用UR加成倍数
        const finalBuffValue = Math.round(buff.value * buffValueMultiplier);

        // 默认描述：单位名 + 配置描述（把数字替换为最终数值）
        let desc = `${unitName}: ${buff.desc.replace(/\d+/, finalBuffValue.toString())}`;

        // SP：三级升级 + 罗马数字（抽到即等级+1，最多3；效果按级级累加：1->3->6）
        if (rarity === 'SP') {
            const bm = BuffManager.getInstance();
            const curLv = bm.getSpLevel(unitType, randomBuffType);
            const nextLv = Math.min(3, curLv + 1);
            const roman = (lv: number) => (lv === 1 ? 'I' : lv === 2 ? 'II' : 'III');
            const tri = (lv: number) => (lv * (lv + 1)) / 2; // 1->1,2->3,3->6

            // SP 的 buffValue 表示“一级增量”，总效果=base*tri(level)
            const base = Number(finalBuffValue) || 0;
            const total = base * tri(nextLv);
            const prevTotal = base * tri(curLv);
            const delta = total - prevTotal;

            const spNameMap: Record<string, string> = {
                multiArrow: '多重箭',
                bouncyBoomerang: '弹弹乐',
                heavyArmor: '重甲',
                widePrayer: '广域祈祷',
                bangBangBang: '砰砰砰',
                selfHealingWall: '无声自愈',
                thunderChainPlus: '我就是闪电！',
                iceCrawl: '寸步难行',
                ballista: '巨弩'
            };
            const spName = spNameMap[randomBuffType] || randomBuffType;

            if (randomBuffType === 'bouncyBoomerang') {
                desc = `${spName}${roman(nextLv)}：弹射单位+${delta}`;
            } else if (randomBuffType === 'multiArrow') {
                // 多重箭升级规则：
                // - 每次升级只+1个额外目标（最多额外3个 => 最多打4个单位）
                // - 攻击力会变为原来的 80%^等级
                const extraTargetsDelta = 1;
                desc = `${spName}${roman(nextLv)}：攻击目标+${extraTargetsDelta}，攻击力稍微降低`;
            } else if (randomBuffType === 'heavyArmor') {
                desc = `${spName}${roman(nextLv)}：伤害减免+${delta}%，攻速移速稍微降低`;
            } else if (randomBuffType === 'widePrayer') {
                desc = `${spName}${roman(nextLv)}：祈祷范围+${delta}`;
            } else if (randomBuffType === 'bangBangBang') {
                desc = `${spName}${roman(nextLv)}：攻击飞弹数量+${delta}`;
            } else if (randomBuffType === 'selfHealingWall') {
                const linearTotal = base * nextLv;
                desc = `${spName}${roman(nextLv)}：每秒恢复${linearTotal}点生命值`;
            } else if (randomBuffType === 'thunderChainPlus') {
                desc = `${spName}${roman(nextLv)}：攻击目标+${delta}`;
            } else if (randomBuffType === 'iceCrawl') {
                desc = `${spName}${roman(nextLv)}：波及范围增加，减速效果增强`;
            } else if (randomBuffType === 'ballista') {
                desc = `${spName}${roman(nextLv)}：箭矢体积增加，命中可小幅击退`;
            }
        }

        return {
            unitId: unitType,
            unitName: unitName,
            unitIcon: unitIcon,
            buffType: randomBuffType,
            buffValue: finalBuffValue,
            buffDescription: desc,
            rarity: rarity
        };
    }

    /**
     * 首抽固定 SP 卡片（不依赖 BuffCardConfigManager 是否已加载）
     */
    private buildFixedSpCard(unitType: string, configManager: UnitConfigManager): BuffCardData {
        const displayInfo = configManager.getUnitDisplayInfo(unitType);
        const unitName = displayInfo ? displayInfo.name : unitType;

        // 尽量从实际实例中拿 icon（与普通卡一致）
        let unitIcon: SpriteFrame | null = null;
        const unitInstance = this.findFirstUnitInstance(unitType);
        if (unitInstance) {
            const unitScript = unitInstance.getComponent(unitType) as any ||
                unitInstance.getComponent('Role') as any ||
                unitInstance.getComponent('Build') as any;
            if (unitScript) {
                unitIcon = unitScript.cardIcon || unitScript.defaultSpriteFrame || unitScript.node?.getComponent(Sprite)?.spriteFrame || null;
            }
        }

        // 固定 SP 效果（与 assets/resources/config/buffCardConfig.json 一致）
        // - StoneWall: selfHealingWall value=2
        // - WatchTower: ballista value=1
        // - Arrower: multiArrow value=1
        // - 其它角色：使用对应专属 SP（value 以配置为准）
        const spByUnit: Record<string, { buffType: string; buffValue: number; buffDescription: string }> = {
            StoneWall: { buffType: 'selfHealingWall', buffValue: 2, buffDescription: '无声自愈：每秒恢复2点生命值，抽到升级，最高三级' },
            WatchTower: { buffType: 'ballista', buffValue: 1, buffDescription: '巨弩：箭矢体积增大，命中可小幅击退，最高三级' },
            Arrower: { buffType: 'multiArrow', buffValue: 1, buffDescription: '多重箭：攻击目标+1，攻击力稍微降低，最高三级' },
            Hunter: { buffType: 'bouncyBoomerang', buffValue: 1, buffDescription: '弹弹乐：弹射单位+1，最高三级' },
            ElfSwordsman: { buffType: 'heavyArmor', buffValue: 5, buffDescription: '重甲：伤害减免+5%，攻速移速稍微降低，最高三级' },
            Priest: { buffType: 'widePrayer', buffValue: 10, buffDescription: '广域祈祷：祈祷范围+10，最高三级' },
            Mage: { buffType: 'bangBangBang', buffValue: 1, buffDescription: '砰砰砰：攻击飞弹数量+1，最高三级' }
        };

        const sp = spByUnit[unitType] || spByUnit['Arrower'];
        return {
            unitId: unitType,
            unitName,
            unitIcon,
            buffType: sp.buffType,
            buffValue: sp.buffValue,
            buffDescription: sp.buffDescription,
            rarity: 'SP'
        };
    }
    
    /**
     * 查找第一个指定类型的单位实例
     */
    private findFirstUnitInstance(unitType: string): Node | null {
        // 使用与 getActiveUnitTypes 相同的容器路径映射
        const unitContainers: Record<string, string[]> = {
            'Arrower': ['Canvas/Towers', 'Canvas/Arrows', 'Canvas/Units'],
            'Hunter': ['Canvas/Hunters'],
            'Mage': ['Canvas/Mages'],
            // 剑士容器兼容（部分场景使用 Canvas/ElfSwordsmans）
            'ElfSwordsman': ['Canvas/Swordsmen', 'Canvas/ElfSwordsmans'],
            'Priest': ['Canvas/Towers', 'Canvas/Priests'],
            'MageTower': ['Canvas/MageTowers'],
            'WatchTower': ['Canvas/WatchTowers'],
            'IceTower': ['Canvas/IceTowers'],
            'ThunderTower': ['Canvas/ThunderTowers'],
            'WarAncientTree': ['Canvas/WarAncientTrees'],
            'HunterHall': ['Canvas/HunterHalls'],
            'SwordsmanHall': ['Canvas/SwordsmanHalls'],
            'Church': ['Canvas/Churches'],
            'StoneWall': ['Canvas/StoneWalls'],
        };
        
        const containers = unitContainers[unitType] || [];
        
        for (const containerPath of containers) {
            const container = find(containerPath);
            if (container) {
                for (const child of container.children) {
                    if (!child.active || !child.isValid) continue;
                    
                    // 检查是否有对应的组件
                    let script: any = null;
                    if (unitType === 'WatchTower' || unitType === 'IceTower' || unitType === 'ThunderTower' ||
                        unitType === 'WarAncientTree' || unitType === 'HunterHall' || 
                        unitType === 'SwordsmanHall' || unitType === 'Church') {
                        // 建筑类单位，检查具体的组件类名
                        script = child.getComponent(unitType) as any;
                    } else {
                        // 其他单位，必须精确匹配组件类名
                        script = child.getComponent(unitType) as any;
                        // 如果找不到精确匹配，检查是否有unitType属性匹配
                        if (!script) {
                            const roleScript = child.getComponent('Role') as any;
                            const buildScript = child.getComponent('Build') as any;
                            const tempScript = roleScript || buildScript;
                            if (tempScript && tempScript.unitType === unitType) {
                                script = tempScript;
                            }
                        }
                    }
                    
                    if (script) {
                        return child;
                    }
                }
            }
        }
        
        return null;
    }

    /**
     * 显示增益卡片
     * @param onClose 可选的回调函数，在卡片弹窗关闭时调用
     */
    showBuffCards(onClose?: () => void) {
        //console.info('[GameManager] showBuffCards 被调用');
        // BuffCardPopup 应该在 onLoad() 中已经创建好了，这里不需要再创建
        if (!this.buffCardPopup) {
            console.error('[GameManager] BuffCardPopup不存在，应该在onLoad()中已创建');
            return;
        }
        
        //console.info('[GameManager] BuffCardPopup存在，开始生成卡片数据');
        const currentLevel = this.getCurrentLevelSafe();
        const isFirstDrawThisLevel = !this.shownFirstBuffCardLevels.has(currentLevel);
        if (isFirstDrawThisLevel) {
            this.shownFirstBuffCardLevels.add(currentLevel);
        }
        const cards = this.generateBuffCards(false, isFirstDrawThisLevel);
        if (cards && cards.length > 0) {
            //console.info(`[GameManager] 生成了 ${cards.length} 张卡片`);
            if (cards.length > 0) {
                //console.info('[GameManager] 调用 BuffCardPopup.show()');
                this.buffCardPopup.show(cards, onClose);
            } else {
                console.warn('[GameManager] 没有可用的增益卡片生成，跳过显示。');
                if (onClose) onClose();
            }
        } else {
            console.warn('[GameManager] BuffCardPopup 创建失败，跳过显示。');
            if (onClose) onClose();
        }
    }

    /**
     * 自动创建BuffCardPopup（如果不存在）
     */
    private autoCreateBuffCardPopup() {
        if (this.buffCardPopup && this.buffCardPopup.isValid) {
            return;
        }
        
        const canvasNode = find('Canvas');
        if (!canvasNode) {
            console.error('[GameManager] Canvas node not found for BuffCardPopup');
            return;
        }
        
        // 创建主容器节点
        const containerNode = new Node('BuffCardPopup');
        containerNode.setParent(canvasNode);
        
        const uiTransform = containerNode.addComponent(UITransform);
        const visibleSize = view.getVisibleSize();
        // 容器宽度增加
        const popupWidth = visibleSize.width * 0.95;
        const popupHeight = visibleSize.height * 0.6;
        uiTransform.setContentSize(popupWidth, popupHeight);
        
        // 设置锚点为中心（默认就是中心，但明确设置）
        uiTransform.setAnchorPoint(0.5, 0.5);
        
        // 设置容器位置为屏幕中心
        containerNode.setPosition(0, 0, 0);
        
        // 确保容器在最上层（设置最高的siblingIndex）
        containerNode.setSiblingIndex(canvasNode.children.length);
        
        //console.info('[GameManager] BuffCardPopup容器创建完成，位置=', containerNode.position, 
                    // '尺寸=', popupWidth, 'x', popupHeight,
                    // '父节点=', canvasNode.name,
                    // 'siblingIndex=', containerNode.getSiblingIndex());
        
        // 检查节点状态（在绘制 Graphics 之前）
        //console.info('[GameManager] BuffCardPopup Graphics 创建前：containerNode.active=', containerNode.active);
        //console.info('[GameManager] BuffCardPopup Graphics 创建前：containerNode.isValid=', containerNode.isValid);
        //console.info('[GameManager] BuffCardPopup Graphics 创建前：containerNode.parent=', containerNode.parent?.name);
        //console.info('[GameManager] BuffCardPopup Graphics 创建前：containerNode.parent.active=', containerNode.parent?.active);
        
        // 容器背景完全透明（不绘制背景）
        // 如果需要边框，可以取消下面的注释
        // const bgGraphics = containerNode.addComponent(Graphics);
        // bgGraphics.strokeColor = new Color(255, 215, 0, 255);
        // bgGraphics.lineWidth = 3;
        // bgGraphics.roundRect(-popupWidth / 2, -popupHeight / 2, popupWidth, popupHeight, 15);
        // bgGraphics.stroke();
        
        //console.info('[GameManager] BuffCardPopup 容器创建完成，背景完全透明');
        
        // 创建卡片容器
        const cardContainer = new Node('CardContainer');
        cardContainer.setParent(containerNode);
        cardContainer.addComponent(UITransform).setContentSize(popupWidth, popupHeight * 0.8);
        cardContainer.setPosition(0, 0, 0);
        
        // 创建三张卡片节点
        const cardWidth = (popupWidth - 60) / 3; // 减去间隔，每张卡片宽度（已随容器宽度增加）
        const cardHeight = popupHeight * 0.7 - 50; // 高度减少50像素
        const cardSpacing = 20;
        const startX = -cardWidth - cardSpacing;
        
        const createCardNode = (name: string, x: number): Node => {
            const cardNode = new Node(name);
            cardNode.setParent(cardContainer);
            cardNode.addComponent(UITransform).setContentSize(cardWidth, cardHeight);
            cardNode.setPosition(x, 0, 0);
            
            // 卡片背景
            const cardBg = new Node('CardBackground');
            cardBg.setParent(cardNode);
            cardBg.addComponent(UITransform).setContentSize(cardWidth, cardHeight);
            const cardBgGraphics = cardBg.addComponent(Graphics);
            cardBgGraphics.fillColor = new Color(50, 50, 50, 255);
            cardBgGraphics.roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
            cardBgGraphics.fill();
            cardBgGraphics.strokeColor = new Color(100, 100, 100, 255);
            cardBgGraphics.lineWidth = 2;
            cardBgGraphics.roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
            cardBgGraphics.stroke();
            
            // 图标（顶部）
            const iconNode = new Node('Icon');
            iconNode.setParent(cardNode);
            iconNode.addComponent(UITransform).setContentSize(cardWidth * 0.6, cardWidth * 0.6);
            iconNode.setPosition(0, cardHeight / 2 - cardWidth * 0.3 - 10, 0);
            iconNode.addComponent(Sprite);
            
            // 单位图片（中间，替代原来的名称标签）
            const unitImageNode = new Node('Name'); // 保持名称不变以兼容现有代码
            unitImageNode.setParent(cardNode);
            // 适配卡片中央大小，使用卡片宽度的80%作为图片尺寸
            const unitImageSize = Math.min(cardWidth * 0.8, cardHeight * 0.4);
            unitImageNode.addComponent(UITransform).setContentSize(unitImageSize, unitImageSize);
            unitImageNode.setPosition(0, 0, 0);
            const unitImageSprite = unitImageNode.addComponent(Sprite);
            unitImageSprite.sizeMode = Sprite.SizeMode.CUSTOM;
            
            // 描述标签
            const descLabelNode = new Node('Description');
            descLabelNode.setParent(cardNode);
            descLabelNode.addComponent(UITransform).setContentSize(cardWidth * 0.8, cardHeight * 0.3);
            descLabelNode.setPosition(0, -cardHeight / 2 + cardHeight * 0.15 + 10, 0);
            const descLabel = descLabelNode.addComponent(Label);
            descLabel.fontSize = 16;
            descLabel.color = Color.WHITE;
            descLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            descLabel.verticalAlign = Label.VerticalAlign.CENTER;
            descLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
            
            // 按钮（覆盖整个卡片）
            const buttonNode = new Node('Button');
            buttonNode.setParent(cardNode);
            buttonNode.addComponent(UITransform).setContentSize(cardWidth, cardHeight);
            buttonNode.addComponent(Button);
            
            return cardNode;
        };
        
        const card1 = createCardNode('Card1', startX);
        const card2 = createCardNode('Card2', 0);
        const card3 = createCardNode('Card3', -startX);
        
        // 添加BuffCardPopup组件
        const buffCardPopup = containerNode.addComponent(BuffCardPopup);
        this.buffCardPopup = buffCardPopup;
        
        // 手动设置gameManager（因为start()可能已经执行过了）
        (buffCardPopup as any).gameManager = this;
        
        // 绑定属性
        buffCardPopup.container = containerNode;
        buffCardPopup.cardContainer = cardContainer;
        buffCardPopup.card1 = card1;
        buffCardPopup.card1Icon = card1.getChildByName('Icon')?.getComponent(Sprite) || null;
        buffCardPopup.card1Name = card1.getChildByName('Name')?.getComponent(Sprite) || null; // 改为 Sprite
        buffCardPopup.card1Description = card1.getChildByName('Description')?.getComponent(Label) || null;
        buffCardPopup.card1Button = card1.getChildByName('Button')?.getComponent(Button) || null;
        
        buffCardPopup.card2 = card2;
        buffCardPopup.card2Icon = card2.getChildByName('Icon')?.getComponent(Sprite) || null;
        buffCardPopup.card2Name = card2.getChildByName('Name')?.getComponent(Sprite) || null; // 改为 Sprite
        buffCardPopup.card2Description = card2.getChildByName('Description')?.getComponent(Label) || null;
        buffCardPopup.card2Button = card2.getChildByName('Button')?.getComponent(Button) || null;
        
        buffCardPopup.card3 = card3;
        buffCardPopup.card3Icon = card3.getChildByName('Icon')?.getComponent(Sprite) || null;
        buffCardPopup.card3Name = card3.getChildByName('Name')?.getComponent(Sprite) || null; // 改为 Sprite
        buffCardPopup.card3Description = card3.getChildByName('Description')?.getComponent(Label) || null;
        buffCardPopup.card3Button = card3.getChildByName('Button')?.getComponent(Button) || null;
        
        // 验证绑定
        //console.info('[GameManager] BuffCardPopup 属性绑定验证:');
        //console.info('  container:', !!buffCardPopup.container);
        //console.info('  cardContainer:', !!buffCardPopup.cardContainer);
        //console.info('  card1:', !!buffCardPopup.card1, 'card1Icon:', !!buffCardPopup.card1Icon, 'card1Name:', !!buffCardPopup.card1Name);
        //console.info('  card2:', !!buffCardPopup.card2, 'card2Icon:', !!buffCardPopup.card2Icon, 'card2Name:', !!buffCardPopup.card2Name);
        //console.info('  card3:', !!buffCardPopup.card3, 'card3Icon:', !!buffCardPopup.card3Icon, 'card3Name:', !!buffCardPopup.card3Name);
        
        // 不要在这里设置 active = false！
        // 参考 UnitIntroPopup 的做法：Graphics 在节点 active 时绘制，然后在 start() 中才设置为 inactive
        // 这样可以确保 Graphics 内容被正确保存
        // containerNode.active = false; // 注释掉，让 start() 方法来设置
        
        //console.info('[GameManager] BuffCardPopup UI已动态创建完成，containerNode.active=', containerNode.active);
    }

    canAfford(amount: number): boolean {
        return this.gold >= amount;
    }

    // 人口相关方法
    getPopulation(): number {
        return this.population;
    }

    getMaxPopulation(): number {
        return this.maxPopulation;
    }

    addPopulation(amount: number = 1): boolean {
        if (this.population + amount <= this.maxPopulation) {
            this.population += amount;
            this.updateUI();
            
            // 检测首次达到人口上限时显示提示框
            if (this.population >= this.maxPopulation && !this.hasShownPopulationLimitWarning) {
                this.hasShownPopulationLimitWarning = true;
                GamePopup.showMessage('已达到人口上限，请升级生命之树');
            }
            
            return true;
        }
        return false;
    }

    removePopulation(amount: number = 1) {
        this.population = Math.max(0, this.population - amount);
        this.updateUI();
    }

    canAddPopulation(amount: number = 1): boolean {
        return this.population + amount <= this.maxPopulation;
    }

    setMaxPopulation(max: number) {
        this.maxPopulation = max;
        this.updateUI();
    }

    /**
     * 增加击杀数（供敌人脚本调用）
     */
    public addKillCount(count: number = 1) {
        this.totalKillCount += count;
    }

    /**
     * 获取当前累计击杀数
     */
    public getTotalKillCount(): number {
        return this.totalKillCount;
    }

    restartGame() {
        // 恢复时间缩放（确保游戏时间正常，避免退出时暂停导致的问题）
        director.getScheduler().setTimeScale(1);
        this.originalTimeScale = 1;

        // 重新开始：重置复活按钮状态
        this.reviveUsedThisRun = false;
        this.hideReviveButton();
        
        // 停止伤害统计
        const damageStats = DamageStatistics.getInstance();
        damageStats.stopRecording();
        damageStats.reset();
        
        // 在重新开始游戏前，结算当前游戏的经验值
        this.settleGameExperience();

        // 重置本局计时与 UI 显示
        this.gameTime = 0;
        this.updateUI();

        // 更新左上角等级HUD显示状态（会根据gameMainPanel的显示状态自动控制）
        this.updateLevelHud();
        
        // 清理所有敌人和防御塔
        this.cleanupAllUnits();
        
        const scene = director.getScene();
        let sceneName = scene?.name;
        
        
        // 如果场景名称为空，尝试使用默认名称
        if (!sceneName || sceneName === '') {
            sceneName = 'scene';
        }
        
        if (sceneName) {
            
            // 使用更可靠的方式重新加载场景
            director.loadScene(sceneName, (error: Error | null) => {
                if (error) {
                    
                    // 场景加载失败时，手动重置游戏状态
                    this.manualResetGame();
                } else {
                }
            });
        } else {
            
            // 无法获取场景名称时，手动重置游戏状态
            this.manualResetGame();
        }
    }
    
    /**
     * 结算游戏经验值（在游戏结束或主动退出时调用）
     * 公共方法，供外部调用
     */
    public settleGameExperience() {
        if (this.playerDataManager && this.currentGameExp > 0) {
            this.playerDataManager.addExperience(this.currentGameExp);
            // 重置本局经验值
            this.currentGameExp = 0;
        } else if (this.playerDataManager) {
            // 即使没有获得经验值，也要保存数据（可能使用了天赋点）
            this.playerDataManager.saveData();
        }
    }
    
    /**
     * 手动重置游戏状态（当场景重载失败时使用）
     */
    manualResetGame() {
        
        // 恢复时间缩放（确保游戏时间正常）
        director.getScheduler().setTimeScale(1);
        this.originalTimeScale = 1;
        
        // 重置游戏状态
        this.gameState = GameState.Ready;
        this.gameTime = 0;
        this.gold = 10;
        this.population = 0;
        this.maxPopulation = 10;
        this.hasShownPopulationLimitWarning = false; // 重置人口上限提示标志
        
        // 重置水晶状态
        if (this.crystalScript) {
            const crystal = this.crystalScript as any;
            if (crystal.currentHealth !== undefined && crystal.maxHealth !== undefined) {
                crystal.currentHealth = crystal.maxHealth;
            }
            // 重置水晶的isDestroyed状态
            if (crystal.isDestroyed !== undefined) {
                crystal.isDestroyed = false;
            }
            // 确保水晶节点是激活的
            if (crystal.node && crystal.node.isValid) {
                crystal.node.active = true;
            }
        }
        
        // 隐藏所有游戏元素
        this.hideGameElements();
        
        // 确保游戏结束面板隐藏
        if (this.gameOverPanel) {
            this.gameOverPanel.active = false;
            
            // 隐藏退出游戏按钮
            if (this.exitGameButton && this.exitGameButton.node) {
                this.exitGameButton.node.active = false;
            }
            
            // 隐藏弹窗
            if (this.gameOverDialog) {
                this.gameOverDialog.active = false;
            }
        }
        
        // 更新UI
        this.updateUI();
        
    }

    cleanupAllUnits() {
        const scene = director.getScene();
        if (!scene) return;

        // 清理所有敌人
        const enemiesNode = find('Canvas/Enemies');
        if (enemiesNode) {
            const enemies = enemiesNode.children.slice(); // 复制数组，避免在遍历时修改
            for (const enemy of enemies) {
                if (enemy && enemy.isValid) {
                    const enemyScript = enemy.getComponent('Enemy') as any;
                    if (enemyScript && enemyScript.die) {
                        enemyScript.die();
                    } else {
                        enemy.destroy();
                    }
                }
            }
        }

        // 清理所有防御塔
        const towersNode = find('Canvas/Towers');
        if (towersNode) {
            const towers = towersNode.children.slice(); // 复制数组
            for (const tower of towers) {
                if (tower && tower.isValid) {
                    const towerScript = tower.getComponent('Arrower') as any;
                    if (towerScript) {
                        // 如果游戏结束，停止所有塔的移动
                        if (towerScript.stopMoving) {
                            towerScript.stopMoving();
                        }
                        // 只有在非游戏结束时的清理才销毁塔（例如重启游戏时）
                        // 但这里的cleanupAllUnits目前主要用于重启游戏
                        // 我们需要区分是"游戏结束清理"还是"重启清理"
                        // 为了简单起见，这里保持原来的销毁逻辑用于重启
                        // 但我们需要一个新的方法来处理游戏结束时的状态冻结
                        if (towerScript.destroyArrower) {
                            towerScript.destroyArrower();
                        } else {
                            tower.destroy();
                        }
                    }
                }
            }
        }

    }

    /**
     * 启动动态背景切换（从 assets/other/backgroundX 文件夹加载图片并循环播放）
     * @param level 当前关卡号
     */
    private startDynamicBackground(level: number) {
        // 获取背景节点
        if (!this.gameBackgroundNode) {
            this.gameBackgroundNode = find('Canvas/Background');
        }

        if (!this.gameBackgroundNode) {
            console.warn('[GameManager] 未找到背景节点 Canvas/Background，无法启动动态背景');
            return;
        }

        // 获取或创建 Sprite 组件
        this.gameBackgroundSprite = this.gameBackgroundNode.getComponent(Sprite);
        if (!this.gameBackgroundSprite) {
            this.gameBackgroundSprite = this.gameBackgroundNode.addComponent(Sprite);
        }

        // 记录默认静态背景
        if (!this.gameBackgroundDefaultSprite && this.gameBackgroundSprite.spriteFrame) {
            this.gameBackgroundDefaultSprite = this.gameBackgroundSprite.spriteFrame;
        }

        // 加载对应关卡文件夹中的图片
        const folderName = `background${level}`;
        this.loadGameBackgroundImages(folderName);
    }

    /**
     * 加载游戏动态背景图片（从 assets/other/backgroundX 文件夹）
     * @param folderName 文件夹名称（如 "background1"）
     */
    private loadGameBackgroundImages(folderName: string) {
        // 清空之前的图片
        this.gameBackgroundFrames = [];
        this.gameBackgroundIndex = 0;
        this.gameBackgroundActive = false;

        // 加载 other bundle
        assetManager.loadBundle('other', (err, bundle) => {
            if (err) {
                console.warn(`[GameManager] 加载 other bundle 失败，回退到静态背景:`, err);
                this.fallbackToStaticBackground();
                return;
            }

            // 尝试加载文件夹中的所有图片
            // 注意：在 Cocos Creator 中，loadDir 需要传入文件夹路径
            const folderPath = folderName;
            bundle.loadDir(folderPath, SpriteFrame, (err2, spriteFrames) => {
                if (err2 || !spriteFrames || spriteFrames.length === 0) {
                    console.warn(`[GameManager] 文件夹 ${folderPath} 不存在或没有图片，回退到静态背景:`, err2);
                    this.fallbackToStaticBackground();
                    return;
                }

                // 过滤出有效的 SpriteFrame
                const validFrames: SpriteFrame[] = [];
                for (const frame of spriteFrames) {
                    if (frame && frame.isValid) {
                        validFrames.push(frame);
                    }
                }

                if (validFrames.length === 0) {
                    console.warn(`[GameManager] 文件夹 ${folderPath} 中没有有效的图片，回退到静态背景`);
                    this.fallbackToStaticBackground();
                    return;
                }

                // 保存图片数组并启动切换
                this.gameBackgroundFrames = validFrames;
                this.gameBackgroundIndex = 0;
                this.gameBackgroundActive = true;

                // 立即显示第一张图片
                if (this.gameBackgroundSprite && this.gameBackgroundFrames.length > 0) {
                    this.gameBackgroundSprite.spriteFrame = this.gameBackgroundFrames[0];
                    this.gameBackgroundSprite.enabled = true;
                }

                // 启动定时切换（每 0.05 秒切换一次，即 20fps）
                this.schedule(this.updateGameBackground, this.GAME_BG_INTERVAL);

              //console.log(`[GameManager] 成功加载 ${validFrames.length} 张动态背景图片，开始循环播放`);
            });
        });
    }

    /**
     * 更新游戏动态背景（每 0.05 秒调用一次）
     */
    private updateGameBackground() {
        if (!this.gameBackgroundActive || this.gameBackgroundFrames.length === 0) {
            return;
        }

        // 切换到下一张图片
        this.gameBackgroundIndex = (this.gameBackgroundIndex + 1) % this.gameBackgroundFrames.length;
        
        if (this.gameBackgroundSprite && this.gameBackgroundFrames[this.gameBackgroundIndex]) {
            this.gameBackgroundSprite.spriteFrame = this.gameBackgroundFrames[this.gameBackgroundIndex];
        }
    }

    /**
     * 停止动态背景切换，回退到静态背景
     */
    private stopDynamicBackground() {
        // 停止定时器
        this.unschedule(this.updateGameBackground);
        this.gameBackgroundActive = false;
        this.gameBackgroundFrames = [];
        this.gameBackgroundIndex = 0;

        // 恢复静态背景
        this.fallbackToStaticBackground();
    }

    /**
     * 回退到静态背景（使用 UIManager 的 changeBackground 方法）
     */
    private fallbackToStaticBackground() {
        // 如果有默认背景，恢复它
        if (this.gameBackgroundSprite && this.gameBackgroundDefaultSprite) {
            this.gameBackgroundSprite.spriteFrame = this.gameBackgroundDefaultSprite;
            this.gameBackgroundSprite.enabled = true;
        } else if (this.uiManager && (this.uiManager as any).changeBackground) {
            // 否则通过 UIManager 切换背景
            let level = 1;
            if (this.uiManager && (this.uiManager as any).getCurrentLevel) {
                const currentLevel = (this.uiManager as any).getCurrentLevel();
                if (typeof currentLevel === 'number' && !isNaN(currentLevel)) {
                    level = currentLevel;
                }
            }
            (this.uiManager as any).changeBackground(level);
        }
    }
}

