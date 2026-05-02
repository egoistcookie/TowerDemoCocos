import { _decorator, Component, Node, Prefab, instantiate, Vec3, EventTouch, input, Input, Camera, find, view, UITransform, SpriteFrame, Graphics, Color, director, tween, Tween, Sprite, AudioClip, UIOpacity, AudioSource, sys } from 'cc';
import { GameManager } from './GameManager';
import { BuildingSelectionPanel, BuildingType } from './BuildingSelectionPanel';
import { GamePopup } from './GamePopup';
import { UnitSelectionManager } from './UnitSelectionManager';
import { WarAncientTree } from './role/WarAncientTree';
import { HunterHall } from './role/HunterHall';
import { MageTower } from './role/MageTower';
import { StoneWall } from './role/StoneWall';
import { WatchTower } from './role/WatchTower';
import { IceTower } from './role/IceTower';
import { ThunderTower } from './role/ThunderTower';
import { SwordsmanHall } from './role/SwordsmanHall';
import { TalentEffectManager } from './TalentEffectManager';
import { Church } from './role/Church';
import { EagleNest } from './role/EagleNest';
import { UnitConfigManager } from './UnitConfigManager';
import { PlayerDataManager } from './PlayerDataManager';
import { BuildingGridPanel } from './BuildingGridPanel';
import { StoneWallGridPanel } from './StoneWallGridPanel';
import { BuildingPool } from './BuildingPool';
import { AnalyticsManager, OperationType } from './AnalyticsManager';
import { Build } from './role/Build';
import { Role } from './role/Role';
import { SoundManager } from './SoundManager';
import { AudioManager } from './AudioManager';
const { ccclass, property } = _decorator;

@ccclass('TowerBuilder')
export class TowerBuilder extends Component {
    // 战争古树预制体：已经移动到分包 prefabs_sub，由 GameManager 在运行时注入
    private warAncientTreePrefab: Prefab = null!; // 战争古树预制体（运行时赋值）

    @property(SpriteFrame)
    warAncientTreeIcon: SpriteFrame = null!; // 战争古树图标



    // 猎手大厅预制体：已经移动到分包 prefabs_sub，由 GameManager 在运行时注入
    private hunterHallPrefab: Prefab = null!; // 猎手大厅预制体（运行时赋值）

    @property(SpriteFrame)
    hunterHallIcon: SpriteFrame = null!; // 猎手大厅图标

    // 法师塔预制体：由 GameManager 在运行时注入
    private mageTowerPrefab: Prefab = null!;

    @property(SpriteFrame)
    mageTowerIcon: SpriteFrame = null!;

    // 石墙预制体：已经移动到分包 prefabs_sub，由 GameManager 在运行时注入
    private stoneWallPrefab: Prefab = null!; // 石墙预制体（运行时赋值）

    @property(SpriteFrame)
    stoneWallIcon: SpriteFrame = null!; // 石墙图标

    // 哨塔预制体：不再通过 Cocos 属性面板指定，而是从分包 prefabs_sub 中加载后由 GameManager 注入
    private watchTowerPrefab: Prefab = null!; // 哨塔预制体（运行时赋值）

    @property(SpriteFrame)
    watchTowerIcon: SpriteFrame = null!; // 哨塔图标

    // 冰元素塔预制体：已经移动到分包 prefabs_sub，由 GameManager 在运行时注入
    private iceTowerPrefab: Prefab = null!; // 冰元素塔预制体（运行时赋值）

    @property(SpriteFrame)
    iceTowerIcon: SpriteFrame = null!; // 冰元素塔图标

    // 雷元素塔预制体：已经移动到分包 prefabs_sub，由 GameManager 在运行时注入
    private thunderTowerPrefab: Prefab = null!; // 雷元素塔预制体（运行时赋值）

    @property(SpriteFrame)
    thunderTowerIcon: SpriteFrame = null!; // 雷元素塔图标

    // 剑士小屋预制体：已经移动到分包 prefabs_sub，由 GameManager 在运行时注入
    private swordsmanHallPrefab: Prefab = null!; // 剑士小屋预制体（运行时赋值）

    @property(SpriteFrame)
    swordsmanHallIcon: SpriteFrame = null!; // 剑士小屋图标

    // 教堂预制体：已经移动到分包 prefabs_sub，由 GameManager 在运行时注入
    private churchPrefab: Prefab = null!; // 教堂预制体（运行时赋值）

    @property(SpriteFrame)
    churchIcon: SpriteFrame = null!; // 教堂图标

    // 角鹰兽栏预制体：由 GameManager 在运行时注入
    private eagleNestPrefab: Prefab = null!;

    @property(SpriteFrame)
    eagleNestIcon: SpriteFrame = null!; // 角鹰兽栏图标

    @property(SpriteFrame)
    starIcon: SpriteFrame = null!; // 星标贴图（用于建筑/单位星级显示）

    @property(AudioClip)
    starUpgradeSfx: AudioClip = null!; // 升星音效（可选）

    @property(AudioClip)
    buildPlaceSfx: AudioClip = null!; // 网格上成功安放建筑音效（可选）

    /** 勾选后在控制台输出升星音效诊断（clip、SoundManager/AudioManager 通路）；上线可关 */
    @property
    debugStarUpgradeSfxLog: boolean = true;

    @property(Node)
    buildingSelectionPanel: Node = null!; // 建筑物选择面板节点

    @property
    buildRange: number = 800; // 建造范围（距离水晶），增大范围以便更容易建造

    @property
    minBuildDistance: number = 80; // 最小建造距离（距离水晶）

    @property(Node)
    targetCrystal: Node = null!;

    @property(Node)
    towerContainer: Node = null!;

    @property(Node)
    warAncientTreeContainer: Node = null!; // 战争古树容器



    @property(Node)
    hunterHallContainer: Node = null!; // 猎手大厅容器

    @property(Node)
    mageTowerContainer: Node = null!; // 法师塔容器

    @property(Node)
    stoneWallContainer: Node = null!; // 石墙容器

    @property(Node)
    watchTowerContainer: Node = null!; // 哨塔容器

    @property(Node)
    iceTowerContainer: Node = null!; // 冰元素塔容器

    @property(Node)
    thunderTowerContainer: Node = null!; // 雷元素塔容器

    @property(Node)
    swordsmanHallContainer: Node = null!; // 剑士小屋容器

    @property(Node)
    churchContainer: Node = null!; // 教堂容器

    @property(Node)
    eagleNestContainer: Node = null!; // 角鹰兽栏容器

    @property(Node)
    buildingGridPanel: Node = null!; // 建筑物网格面板节点

    @property(Node)
    stoneWallGridPanel: Node = null!; // 石墙网格面板节点

    @property
    towerCost: number = 10; // 战争古树建造成本（10金币）



    @property
    hunterHallCost: number = 10; // 猎手大厅建造成本（10金币）

    @property
    mageTowerCost: number = 10; // 法师塔建造成本（10金币）

    @property
    stoneWallCost: number = 5; // 石墙建造成本（5金币）

    @property
    watchTowerCost: number = 5; // 哨塔建造成本（5金币）

    // 木材消耗：基础数值提升 10 倍（哨塔 10 木，冰塔/雷塔 30 木）
    @property
    watchTowerWoodCost: number = 10;

    @property
    iceTowerWoodCost: number = 30;

    @property
    thunderTowerWoodCost: number = 30;

    @property
    swordsmanHallCost: number = 10; // 剑士小屋建造成本（10金币）

    @property
    churchCost: number = 10; // 教堂建造成本（10金币）
    @property
    eagleNestCost: number = 15; // 角鹰兽栏建造成本（15 金币）

    private isBuildingMode: boolean = false;
    private previewTower: Node = null!;
    private gameManager: GameManager = null!;
    private buildingPanel: BuildingSelectionPanel = null!;
    private currentSelectedBuilding: BuildingType | null = null;
    private gridPanel: BuildingGridPanel = null!; // 网格面板组件
    private stoneWallGridPanelComponent: StoneWallGridPanel = null!; // 石墙网格面板组件
    private initialStoneWallsPlaced: boolean = false; // 是否已生成初始石墙
    private initialWatchTowersPlaced: boolean = false; // 是否已生成初始哨塔
    private initialWarAncientTreePlaced: boolean = false; // 第一关是否已生成初始弓箭手小屋
    private initialMageTowerPlaced: boolean = false; // 第二关是否已生成初始法师塔
    private hasShownDragTutorialInLevel1: boolean = false; // 第一关是否已显示过拖动建造提示
    /** 与 D:\\CocosProject\\TowerDemoCocos-wip-backup-2026-05-01 一致：第一关点击建筑打开面板时提示长按拖动，最多 3 次（localStorage 计数） */
    private static readonly LEVEL1_BUILDING_LONG_PRESS_HINT_KEY = 'TowerDemo_Level1BuildingLongPressHintCount';
    private static readonly LEVEL1_BUILDING_LONG_PRESS_HINT_MAX = 3;

    // 建筑物拖拽相关
    private isDraggingBuilding: boolean = false; // 是否正在拖拽建筑物
    private draggedBuilding: Node = null!; // 当前拖拽的建筑物节点
    private draggedBuildingOriginalGrid: { x: number; y: number } | null = null; // 拖拽建筑物原始网格位置
    // 第一关新手拖拽流程日志（仅在网格变化时打印，避免刷屏）
    private level1TutorialDragLastGridKey: string = '';
    private level1TutorialTargetReachedLogged: boolean = false;
    
    // 长按检测相关
    private longPressBuilding: Node | null = null; // 正在长按的建筑物
    private longPressStartTime: number = 0; // 长按开始时间
    private longPressThreshold: number = 0.8; // 长按阈值（秒），超过此时间才进入拖拽模式
    private longPressStartPos: Vec3 | null = null; // 长按开始位置
    private longPressMoveThreshold: number = 10; // 移动阈值（像素），超过此距离取消长按
    private longPressIndicator: Node | null = null; // 长按指示器节点（旋转圆弧）
    private isLongPressActive: boolean = false; // 是否正在长按检测中
    private readonly candidateDisplayCount: number = 3;
    /** 每波手动刷新候选的初始金币；每点一次刷新，下次价格 +5，每波结束时重置为该值 */
    private readonly refreshCandidateGoldCostBase: number = 10;
    private refreshCandidateManualGoldCost: number = 10;
    private currentBuildingPool: BuildingType[] = [];
    private currentWaveBuildingCandidates: BuildingType[] = [];
    private lastCandidateKey: string = '';
    private isBuildCommitInProgress: boolean = false;
    private lastBuildCommitAtMs: number = 0;

    private readonly STAR_CONTAINER_NAME = 'StarLevelContainer';
    private readonly BUILDING_STAR_Y = 70;
    private readonly UNIT_STAR_Y = 55;
    private readonly STAR_EFFECT_DURATION = 3.0; // 升星旋转特效时长（秒）
    private readonly STAR_SHOW_DURATION = 5.0; // 星标显示时长（秒）
    private starPoolRoot: Node | null = null;
    private readonly starContainerPool: Node[] = [];
    private readonly starHideTokenByNode = new WeakMap<Node, number>();
    private readonly starHideCbByNode = new WeakMap<Node, () => void>();
    private starHideTokenSeq = 1;
    private readonly STAR_FX_POOL_ROOT_NAME = 'StarUpgradeFxPool';
    private static readonly STAR_PARTICLE_GFX_READY_KEY = '__starParticleGfxReady';
    private static readonly STAR_BURST_GFX_READY_KEY = '__starBurstGfxReady';
    private readonly MIN_STAR_FX_POOL_SIZE = 4;
    private readonly MAX_STAR_FX_POOL_SIZE = 24;
    private readonly MAX_STAR_FX_PER_UPGRADE = 8;
    private starFxPoolRoot: Node | null = null;
    private readonly starFxPool: Node[] = [];

    /**
     * 由 GameManager 在分包加载完毕后调用，注入分包中的预制体
     */
    public setWatchTowerPrefab(prefab: Prefab) {
        this.watchTowerPrefab = prefab;
        // 预制体更新后，尝试从中提取图标
        this.ensureIconsFromPrefabs();
    }

    public setStoneWallPrefab(prefab: Prefab) {
        this.stoneWallPrefab = prefab;
        // 预制体更新后，尝试从中提取图标
        this.ensureIconsFromPrefabs();
    }

    public setIceTowerPrefab(prefab: Prefab) {
        this.iceTowerPrefab = prefab;
        // 预制体更新后，尝试从中提取图标
        this.ensureIconsFromPrefabs();
    }

    public setThunderTowerPrefab(prefab: Prefab) {
        this.thunderTowerPrefab = prefab;
        // 预制体更新后，尝试从中提取图标
        this.ensureIconsFromPrefabs();
    }

    public setWarAncientTreePrefab(prefab: Prefab) {
        this.warAncientTreePrefab = prefab;
        // 预制体更新后，尝试从中提取图标
        this.ensureIconsFromPrefabs();
    }

    public setHunterHallPrefab(prefab: Prefab) {
        this.hunterHallPrefab = prefab;
        // 预制体更新后，尝试从中提取图标
        this.ensureIconsFromPrefabs();
    }

    public setMageTowerPrefab(prefab: Prefab) {
        this.mageTowerPrefab = prefab;
        this.ensureIconsFromPrefabs();
    }

    public setSwordsmanHallPrefab(prefab: Prefab) {
        this.swordsmanHallPrefab = prefab;
        // 预制体更新后，尝试从中提取图标
        this.ensureIconsFromPrefabs();
    }

    public setChurchPrefab(prefab: Prefab) {
        this.churchPrefab = prefab;
        // 预制体更新后，尝试从中提取图标
        this.ensureIconsFromPrefabs();
    }

    public setEagleNestPrefab(prefab: Prefab) {
        this.eagleNestPrefab = prefab;
        this.ensureIconsFromPrefabs();
    }

    /**
     * 在所有预制体加载完成后调用，更新建筑类型列表
     */
    public refreshBuildingTypes() {
        this.updateBuildingTypes();
    }

    /**
     * 每波结束时由外部调用，刷新本波可选建筑候选
     */
    public onWaveCompletedRefreshCandidates() {
        this.refreshCandidateManualGoldCost = this.refreshCandidateGoldCostBase;
        this.updateBuildingTypes();
        this.updateRefreshButtonState();
    }

    public applyStarToBuildingNode(node: Node, starLevel: number) {
        // 防御塔/石墙不展示星标（若此前有残留则回收进星池）
        if (this.isStarDisplayDisabledForBuilding(node)) {
            const old = node.getChildByName(this.STAR_CONTAINER_NAME);
            if (old && old.isValid) this.releaseStarContainer(node, old);
            return;
        }
        this.applyStarToAnyNode(node, starLevel, this.BUILDING_STAR_Y, 26, 2);
    }

    public applyStarToUnitNode(node: Node, starLevel: number) {
        // 单位头顶星：轻量独立路径（仅选中或升星特效期间展示，见 enqueueUnitStarApply / UnitSelectionManager）
        if (!node || !node.isValid) return;
        if (!this.starIcon) return;
        const level = Math.max(1, Math.min(3, Math.floor(Number(starLevel || 1))));

        let container = node.getChildByName(this.STAR_CONTAINER_NAME);
        if (!container || !container.isValid) {
            container = new Node(this.STAR_CONTAINER_NAME);
            container.setParent(node);
        }
        container.active = true;
        container.setPosition(0, this.UNIT_STAR_Y, 0);
        container.angle = 0;

        // 仅在刷新时做一次反拉伸补偿，不做每帧维护
        this.updateStarContainerAntiStretch(node, container);

        const starSize = 16; // 单位星标缩放为原来的 0.8 倍
        const gap = 2;
        while (container.children.length > level) {
            const ch = container.children[container.children.length - 1];
            if (ch && ch.isValid) ch.destroy();
            else break;
        }
        while (container.children.length < level) {
            const star = new Node('Star');
            star.setParent(container);
            star.addComponent(UITransform).setContentSize(starSize, starSize);
            const sp = star.addComponent(Sprite);
            sp.spriteFrame = this.starIcon;
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        const totalW = level * starSize + (level - 1) * gap;
        for (let i = 0; i < level; i++) {
            const star = container.children[i];
            if (!star || !star.isValid) continue;
            const tr = star.getComponent(UITransform);
            if (tr) tr.setContentSize(starSize, starSize);
            star.setPosition(-totalW / 2 + starSize / 2 + i * (starSize + gap), 0, 0);
            const sp = star.getComponent(Sprite);
            if (sp) sp.spriteFrame = this.starIcon;
        }
    }

    public hideUnitStarNode(node: Node | null) {
        if (!node || !node.isValid) return;
        const old = node.getChildByName(this.STAR_CONTAINER_NAME);
        if (old && old.isValid) old.destroy();
    }

    public enqueueUnitStarApply(node: Node | null, starLevel: number, withFx: boolean = false, applyStar: boolean = true) {
        if (!node || !node.isValid) return;
        const level = Math.max(1, Math.min(3, Math.floor(Number(starLevel || 1))));
        if (withFx) {
            // 带特效的升星：头顶星与特效同步出现，特效结束未选中则收回（避免特效前长时间常驻）
            this.playStarUpgradeEffect(
                node,
                applyStar
                    ? { hideUnitHeadStarsAfterIfNotSelected: true, unitStarLevelForFx: level }
                    : undefined
            );
        } else if (applyStar) {
            this.applyStarToUnitNode(node, level);
        }
    }

    private applyStarToAnyNode(node: Node, starLevel: number, yOffset: number, starSize: number, gap: number) {
        if (!node || !node.isValid) return;
        const level = Math.max(1, Math.min(3, Math.floor(Number(starLevel || 1))));
        if (!this.starIcon) return;

        const container = this.acquireStarContainer(node);
        container.setPosition(0, yOffset, 0);
        container.angle = 0;

        // 仅在创建/刷新时做一次反拉伸补偿，避免每帧维护开销
        this.updateStarContainerAntiStretch(node, container);

        // children count to match level
        const need = level;
        while (container.children.length > need) {
            const ch = container.children[container.children.length - 1];
            if (ch && ch.isValid) ch.destroy();
            else break;
        }
        while (container.children.length < need) {
            const star = new Node('Star');
            star.setParent(container);
            star.addComponent(UITransform).setContentSize(starSize, starSize);
            const sp = star.addComponent(Sprite);
            sp.spriteFrame = this.starIcon;
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        const totalW = need * starSize + (need - 1) * gap;
        for (let i = 0; i < need; i++) {
            const star = container.children[i];
            if (!star || !star.isValid) continue;
            const x = -totalW / 2 + starSize / 2 + i * (starSize + gap);
            star.setPosition(x, 0, 0);
            const sp = star.getComponent(Sprite);
            if (sp) sp.spriteFrame = this.starIcon;
        }

        // 注意：这里仅做静态星标刷新。特效与5秒回收只在“真实升星”时触发。
    }

    private _logStarUpgradeSfx(tag: string, extra?: any) {
        if (!this.debugStarUpgradeSfxLog) return;
        const clipName = (this.starUpgradeSfx as any)?.name || '(null)';
        const resolved = this.getStarUpgradeSfxClip();
        const resolvedName = (resolved as any)?.name || '(null)';
        const sm = SoundManager.getInstance();
        const effectOn = sm ? (sm as any).isEffectOn?.() : 'no-sound-manager';
        const smHasEffectSource = sm ? !!(sm as any).effectAudioSource : false;
        const smEffectVol = sm ? (sm as any).effectAudioSource?.volume : undefined;
        let audioMgrSfxVol: number | string | undefined = undefined;
        try {
            const am = AudioManager.Instance;
            audioMgrSfxVol = am ? (am as any).sfxVolume : 'no-audio-manager';
        } catch {
            audioMgrSfxVol = 'audio-manager-error';
        }
        console.log(`[TowerBuilder][StarSfx] ${tag}`, {
            towerBuilderNode: this.node?.name,
            starUpgradeSfxProperty: clipName,
            resolvedClip: resolvedName,
            effectOn,
            smHasEffectSource,
            smEffectVol,
            audioMgrSfxVol,
            extra,
        });
    }

    private playStarUpgradeFxAndAutoHide(node: Node) {
        if (!node || !node.isValid) return;
        const container = node.getChildByName(this.STAR_CONTAINER_NAME);
        if (!container || !container.isValid) {
            this._logStarUpgradeSfx('playStarUpgradeFxAndAutoHide: no StarLevelContainer, sfx only', {
                building: node?.name,
            });
            this.playStarUpgradeSfxIfAny();
            return;
        }

        // 升星特效：使用备份版 playStarUpgradeEffect 同款视觉（内含音效）
        this.playStarUpgradeEffect(node);

        // 临时策略：不再定时回收星标，避免“升星后再放置新建筑”时的回收链路卡死
        // 仅清理旧回调，防止历史版本遗留的 scheduleOnce 在本轮触发。
        const prevCb = this.starHideCbByNode.get(node);
        if (prevCb) {
            try { this.unschedule(prevCb); } catch {}
            this.starHideCbByNode.delete(node);
        }
        this.starHideTokenByNode.set(node, this.starHideTokenSeq++);
    }

    /**
     * 升星音效：Inspector 的 starUpgradeSfx；未配置时从本节点及子节点上的 AudioSource.clip 取（预制体上挂子节点即可）
     */
    private getStarUpgradeSfxClip(): AudioClip | null {
        if (this.starUpgradeSfx) {
            return this.starUpgradeSfx;
        }
        const sources = this.node.getComponentsInChildren(AudioSource);
        let fallback: AudioClip | null = null;
        for (const as of sources) {
            const clip = as?.clip;
            if (!clip) continue;
            const nm = (as.node?.name || '').toLowerCase();
            if (nm.includes('star') && (nm.includes('upgrade') || nm.includes('sfx'))) {
                return clip;
            }
            if (!fallback) {
                fallback = clip;
            }
        }
        return fallback;
    }

    private playStarUpgradeSfxIfAny() {
        const clip = this.getStarUpgradeSfxClip();
        if (!clip) {
            this._logStarUpgradeSfx('playStarUpgradeSfxIfAny: no clip (property empty & no AudioSource.clip)', {});
            return;
        }
        try {
            const sm = SoundManager.getInstance();
            const smHasEffectSource = sm ? !!(sm as any).effectAudioSource : false;
            if (sm && smHasEffectSource) {
                this._logStarUpgradeSfx('play via SoundManager.playEffect', { clip: (clip as any)?.name });
                sm.playEffect(clip);
            } else {
                this._logStarUpgradeSfx('play via AudioManager.playSFX fallback', {
                    clip: (clip as any)?.name,
                    reason: !sm ? 'no SoundManager' : 'no effectAudioSource',
                });
                AudioManager.Instance?.playSFX(clip);
            }
        } catch (e) {
            this._logStarUpgradeSfx('playStarUpgradeSfxIfAny threw', { error: String(e) });
        }
    }

    /** 与升星音效相同通路：SoundManager.effectAudioSource 优先，否则 AudioManager.playSFX */
    private playBuildPlaceSfxIfAny() {
        if (!this.buildPlaceSfx) return;
        try {
            const sm = SoundManager.getInstance();
            const smHasEffectSource = sm ? !!(sm as any).effectAudioSource : false;
            if (sm && smHasEffectSource) {
                sm.playEffect(this.buildPlaceSfx);
            } else {
                AudioManager.Instance?.playSFX(this.buildPlaceSfx);
            }
        } catch {}
    }

    private resolveUnitSelectionManager(): UnitSelectionManager | null {
        let n = find('UnitSelectionManager');
        if (!n) n = find('Canvas/UnitSelectionManager');
        const direct = n?.getComponent(UnitSelectionManager);
        if (direct) return direct;
        const scene = this.node?.scene;
        return scene ? scene.getComponentInChildren(UnitSelectionManager) : null;
    }

    /**
     * 参考备份版本的升星特效：星环爆开 + 汇聚 + 渐隐
     * @param opts.hideUnitHeadStarsAfterIfNotSelected 特效结束时若单位未被选中则隐藏头顶星（仅角色单位）
     * @param opts.unitStarLevelForFx 若传入则在特效开始时刷新头顶静态星（与特效同期显示）
     */
    private playStarUpgradeEffect(
        node: Node | null,
        opts?: { hideUnitHeadStarsAfterIfNotSelected?: boolean; unitStarLevelForFx?: number }
    ) {
        if (!node || !node.isValid || !node.active || !node.activeInHierarchy) return;

        this._logStarUpgradeSfx('playStarUpgradeEffect', { target: node?.name, opts });

        // 防止短时间重复叠加同名特效
        const oldFx = node.getChildByName('StarUpgradeFx');
        if (oldFx && oldFx.isValid) {
            this.recycleStarUpgradeEffect(oldFx);
        }

        const fxStarLv = opts?.unitStarLevelForFx;
        if (fxStarLv != null) {
            this.applyStarToUnitNode(node, fxStarLv);
        }

        this.playStarUpgradeSfxIfAny();

        const effectRoot = this.acquireStarUpgradeEffect();
        effectRoot.setParent(node);
        effectRoot.setPosition(0, 45, 0);
        effectRoot.active = true;
        effectRoot.setScale(1, 1, 1);
        const opacity = effectRoot.getComponent(UIOpacity) || effectRoot.addComponent(UIOpacity);
        opacity.opacity = 255;
        this.ensureStarUpgradeEffectVisualReady(effectRoot);

        const particleCount = 6;
        const radius = 52;
        const starFxSize = 16; // 与备份版一致
        for (let i = 0; i < particleCount; i++) {
            let pivot = effectRoot.getChildByName(`FxPivot_${i}`);
            if (!pivot || !pivot.isValid) {
                pivot = new Node(`FxPivot_${i}`);
                pivot.setParent(effectRoot);
            }
            pivot.setPosition(0, 0, 0);

            let p = pivot.getChildByName(`FxStar_${i}`);
            if (!p || !p.isValid) {
                p = new Node(`FxStar_${i}`);
                p.setParent(pivot);
                p.addComponent(UITransform);
            }
            const tr = p.getComponent(UITransform) || p.addComponent(UITransform);
            tr.setContentSize(starFxSize, starFxSize);
            const sp = p.getComponent(Sprite);
            const g = p.getComponent(Graphics);
            if (this.starIcon) {
                if (sp) {
                    sp.enabled = true;
                    sp.spriteFrame = this.starIcon;
                    sp.sizeMode = Sprite.SizeMode.CUSTOM;
                    sp.color = new Color(255, 220, 90, 255);
                }
                if (g) {
                    g.clear();
                    g.enabled = false;
                }
            } else {
                if (sp) {
                    sp.enabled = true;
                    sp.sizeMode = Sprite.SizeMode.CUSTOM;
                    sp.color = new Color(255, 220, 90, 255);
                } else {
                    let ensuredG = g;
                    if (!ensuredG) {
                        ensuredG = p.addComponent(Graphics);
                    }
                    ensuredG.enabled = true;
                    const pAny = p as any;
                    if (!pAny[TowerBuilder.STAR_PARTICLE_GFX_READY_KEY]) {
                        ensuredG.clear();
                        ensuredG.fillColor = new Color(255, 220, 90, 255);
                        ensuredG.circle(0, 0, Math.max(1, starFxSize * 0.35));
                        ensuredG.fill();
                        pAny[TowerBuilder.STAR_PARTICLE_GFX_READY_KEY] = true;
                    }
                }
            }

            const angleDeg = (360 * i) / particleCount;
            const angleRad = (Math.PI * 2 * i) / particleCount;
            const ringPos = new Vec3(Math.cos(angleRad) * radius, Math.sin(angleRad) * radius, 0);
            p.setPosition(ringPos);
            p.setScale(0.2, 0.2, 1);

            Tween.stopAllByTarget(p);
            tween(p)
                .to(0.16, { scale: new Vec3(1.6, 1.6, 1) }, { easing: 'backOut' })
                .to(0.22, { scale: new Vec3(1.0, 1.0, 1) }, { easing: 'sineOut' })
                .to(1.0, { position: new Vec3(0, 0, 0), scale: new Vec3(0.25, 0.25, 1) }, { easing: 'quadIn' })
                .start();

            pivot.angle = angleDeg;
            Tween.stopAllByTarget(pivot);
            const targetAngle = angleDeg + 360 * 6;
            tween(pivot)
                .to(1.38, { angle: targetAngle + 120 }, { easing: 'linear' })
                .start();
        }

        let burst = effectRoot.getChildByName('StarUpgradeFxBurst');
        if (!burst || !burst.isValid) {
            burst = new Node('StarUpgradeFxBurst');
            burst.setParent(effectRoot);
            const burstTr = burst.addComponent(UITransform);
            burstTr.setContentSize(20, 20);
            const burstG = burst.addComponent(Graphics);
            burstG.fillColor = new Color(255, 235, 120, 180);
            burstG.circle(0, 0, 9);
            burstG.fill();
        }
        burst.setScale(0.2, 0.2, 1);
        const burstOpacity = burst.getComponent(UIOpacity) || burst.addComponent(UIOpacity);
        burstOpacity.opacity = 220;
        Tween.stopAllByTarget(burst);
        tween(burst)
            .to(0.12, { scale: new Vec3(1.2, 1.2, 1) }, { easing: 'backOut' })
            .to(0.22, { scale: new Vec3(0.7, 0.7, 1) })
            .delay(0.95)
            .to(0.24, { scale: new Vec3(1.45, 1.45, 1) }, { easing: 'quadIn' })
            .start();
        Tween.stopAllByTarget(burstOpacity);
        tween(burstOpacity)
            .to(0.35, { opacity: 0 })
            .delay(0.95)
            .to(0.35, { opacity: 220 })
            .to(0.24, { opacity: 0 })
            .start();

        Tween.stopAllByTarget(opacity);
        const hideHeadAfter = opts?.hideUnitHeadStarsAfterIfNotSelected;
        const fxTarget = node;
        tween(opacity)
            .delay(1.2)
            .to(0.8, { opacity: 0 })
            .call(() => {
                try {
                    if (effectRoot && effectRoot.isValid) this.recycleStarUpgradeEffect(effectRoot);
                    if (hideHeadAfter && fxTarget && fxTarget.isValid && fxTarget.getComponent('Role')) {
                        const usm = this.resolveUnitSelectionManager();
                        if (!usm || !usm.isUnitSelected(fxTarget)) {
                            this.hideUnitStarNode(fxTarget);
                        }
                    }
                } catch (e) {
                    this._logStarUpgradeSfx('playStarUpgradeEffect tween call threw', { error: String(e) });
                }
            })
            .start();
    }

    private getStarFxPoolRoot(): Node {
        if (this.starFxPoolRoot && this.starFxPoolRoot.isValid) return this.starFxPoolRoot;
        let root = this.node.getChildByName(this.STAR_FX_POOL_ROOT_NAME);
        if (!root || !root.isValid) {
            root = new Node(this.STAR_FX_POOL_ROOT_NAME);
            root.setParent(this.node);
            root.active = false;
        }
        this.starFxPoolRoot = root;
        return root;
    }

    private createStarUpgradeEffectNode(): Node {
        const effectRoot = new Node('StarUpgradeFx');
        const opacity = effectRoot.addComponent(UIOpacity);
        opacity.opacity = 255;
        const particleCount = 6;
        const starFxSize = 16;
        for (let i = 0; i < particleCount; i++) {
            const pivot = new Node(`FxPivot_${i}`);
            pivot.setParent(effectRoot);
            pivot.setPosition(0, 0, 0);
            const p = new Node(`FxStar_${i}`);
            p.setParent(pivot);
            p.addComponent(UITransform).setContentSize(starFxSize, starFxSize);
            if (this.starIcon) {
                const sp = p.addComponent(Sprite);
                sp.spriteFrame = this.starIcon;
                sp.sizeMode = Sprite.SizeMode.CUSTOM;
                sp.color = new Color(255, 220, 90, 255);
            } else {
                const g = p.addComponent(Graphics);
                g.fillColor = new Color(255, 220, 90, 255);
                g.circle(0, 0, Math.max(1, starFxSize * 0.35));
                g.fill();
                (p as any)[TowerBuilder.STAR_PARTICLE_GFX_READY_KEY] = true;
            }
        }
        const burst = new Node('StarUpgradeFxBurst');
        burst.setParent(effectRoot);
        burst.addComponent(UITransform).setContentSize(20, 20);
        const burstG = burst.addComponent(Graphics);
        burstG.fillColor = new Color(255, 235, 120, 180);
        burstG.circle(0, 0, 9);
        burstG.fill();
        (burst as any)[TowerBuilder.STAR_BURST_GFX_READY_KEY] = true;
        burst.addComponent(UIOpacity).opacity = 220;
        return effectRoot;
    }

    private acquireStarUpgradeEffect(): Node {
        this.ensureMinStarFxPoolSize();
        while (this.starFxPool.length > 0) {
            const fx = this.starFxPool.pop()!;
            if (fx && fx.isValid) {
                this.stopTweensRecursive(fx);
                return fx;
            }
        }
        return this.createStarUpgradeEffectNode();
    }

    private recycleStarUpgradeEffect(effectRoot: Node | null) {
        if (!effectRoot || !effectRoot.isValid) return;
        this.stopTweensRecursive(effectRoot);
        effectRoot.active = false;
        effectRoot.setScale(1, 1, 1);
        effectRoot.setPosition(0, 0, 0);
        const opacity = effectRoot.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 255;
        effectRoot.setParent(this.getStarFxPoolRoot());
        if (this.starFxPool.length >= this.MAX_STAR_FX_POOL_SIZE) {
            effectRoot.destroy();
            return;
        }
        this.starFxPool.push(effectRoot);
    }

    private stopTweensRecursive(node: Node) {
        if (!node || !node.isValid) return;
        Tween.stopAllByTarget(node);
        const op = node.getComponent(UIOpacity);
        if (op) Tween.stopAllByTarget(op);
        for (const c of node.children) {
            this.stopTweensRecursive(c);
        }
    }

    private ensureMinStarFxPoolSize() {
        const need = Math.max(0, this.MIN_STAR_FX_POOL_SIZE - this.starFxPool.length);
        for (let i = 0; i < need; i++) {
            const fx = this.createStarUpgradeEffectNode();
            fx.active = false;
            fx.setParent(this.getStarFxPoolRoot());
            this.starFxPool.push(fx);
        }
    }

    private ensureStarUpgradeEffectVisualReady(effectRoot: Node) {
        const particleCount = 6;
        const starFxSize = 16;
        for (let i = 0; i < particleCount; i++) {
            let pivot = effectRoot.getChildByName(`FxPivot_${i}`);
            if (!pivot || !pivot.isValid) {
                pivot = new Node(`FxPivot_${i}`);
                pivot.setParent(effectRoot);
            }
            pivot.active = true;
            pivot.setPosition(0, 0, 0);
            pivot.angle = 0;

            let star = pivot.getChildByName(`FxStar_${i}`);
            if (!star || !star.isValid) {
                star = new Node(`FxStar_${i}`);
                star.setParent(pivot);
            }
            star.active = true;
            const tr = star.getComponent(UITransform) || star.addComponent(UITransform);
            tr.setContentSize(starFxSize, starFxSize);
        }

        let burst = effectRoot.getChildByName('StarUpgradeFxBurst');
        if (!burst || !burst.isValid) {
            burst = new Node('StarUpgradeFxBurst');
            burst.setParent(effectRoot);
        }
        burst.active = true;
        const burstTr = burst.getComponent(UITransform) || burst.addComponent(UITransform);
        burstTr.setContentSize(20, 20);
        let burstG = burst.getComponent(Graphics);
        if (!burstG) burstG = burst.addComponent(Graphics);
        burstG.enabled = true;
        const burstAny = burst as any;
        if (!burstAny[TowerBuilder.STAR_BURST_GFX_READY_KEY]) {
            burstG.clear();
            burstG.fillColor = new Color(255, 235, 120, 180);
            burstG.circle(0, 0, 9);
            burstG.fill();
            burstAny[TowerBuilder.STAR_BURST_GFX_READY_KEY] = true;
        }
        const burstOpacity = burst.getComponent(UIOpacity) || burst.addComponent(UIOpacity);
        burstOpacity.opacity = 220;
    }

    /**
     * 建筑升星时给已产出单位播放升星特效，并在特效期间显示头顶星标；
     * 特效结束后若单位未被选中则收回星标（与「点击选中才常驻显示」一致）。
     */
    private playUpgradeEffectForProducedUnits(buildScript: any, nextStar: number) {
        if (!buildScript) return;
        const clampStar = (s: number) => Math.max(1, Math.min(3, Math.floor(s)));

        const applyStatsToUnit = (u: Node) => {
            if (!u || !u.isValid || !u.active || !u.activeInHierarchy) return;
            const oldStar = clampStar(Number((u as any).__spawnStarLevel || 1));
            const role = u.getComponent(Role);
            if (role && typeof role.applyStarTierScaling === 'function') {
                role.applyStarTierScaling(oldStar, nextStar);
            }
            (u as any).__spawnStarLevel = nextStar;
        };

        let fxCount = 0;
        const tryPlayFx = (u: Node) => {
            if (fxCount >= this.MAX_STAR_FX_PER_UPGRADE) return;
            if (!u || !u.isValid || !u.active || !u.activeInHierarchy) return;
            this.enqueueUnitStarApply(u, nextStar, true, true);
            fxCount++;
        };

        try {
            const arrays = [
                'producedTowers',
                'producedHunters',
                'producedMages',
                'producedPriests',
                'producedSwordsmen',
                'producedEagles',
            ];
            for (const key of arrays) {
                const arr = buildScript[key];
                if (!Array.isArray(arr)) continue;
                for (const u of arr) {
                    applyStatsToUnit(u);
                }
            }
            const eagleContainer = buildScript.eagleContainer as Node | null;
            if (eagleContainer && eagleContainer.isValid) {
                for (const u of eagleContainer.children) {
                    applyStatsToUnit(u);
                }
            }
            for (const key of arrays) {
                const arr = buildScript[key];
                if (!Array.isArray(arr)) continue;
                for (const u of arr) {
                    tryPlayFx(u);
                    if (fxCount >= this.MAX_STAR_FX_PER_UPGRADE) return;
                }
            }
            if (eagleContainer && eagleContainer.isValid) {
                for (const u of eagleContainer.children) {
                    tryPlayFx(u);
                    if (fxCount >= this.MAX_STAR_FX_PER_UPGRADE) return;
                }
            }
        } catch {}
    }

    private ensureStarPoolRoot(): Node {
        if (this.starPoolRoot && this.starPoolRoot.isValid) {
            return this.starPoolRoot;
        }
        let root = this.node.getChildByName('StarPoolRoot');
        if (!root || !root.isValid) {
            root = new Node('StarPoolRoot');
            root.setParent(this.node);
        }
        root.active = false;
        this.starPoolRoot = root;
        return root;
    }

    private acquireStarContainer(owner: Node): Node {
        const existed = owner.getChildByName(this.STAR_CONTAINER_NAME);
        if (existed && existed.isValid) {
            existed.active = true;
            return existed;
        }
        let container: Node | null = null;
        while (this.starContainerPool.length > 0 && !container) {
            const cand = this.starContainerPool.pop()!;
            if (cand && cand.isValid) {
                container = cand;
            }
        }
        if (!container) {
            container = new Node(this.STAR_CONTAINER_NAME);
        }
        container.name = this.STAR_CONTAINER_NAME;
        container.setParent(owner);
        container.active = true;
        container.angle = 0;
        return container;
    }

    private releaseStarContainer(owner: Node | null, container: Node) {
        if (!container || !container.isValid) return;
        Tween.stopAllByTarget(container);
        container.angle = 0;
        container.active = false;
        container.setParent(this.ensureStarPoolRoot());
        if (this.starContainerPool.indexOf(container) < 0) {
            this.starContainerPool.push(container);
        }
        if (owner && owner.isValid) {
            // 失效当前 owner 的旧显示 token，避免旧定时器影响新一轮显示
            this.starHideTokenByNode.set(owner, this.starHideTokenSeq++);
            const prevCb = this.starHideCbByNode.get(owner);
            if (prevCb) {
                try { this.unschedule(prevCb); } catch {}
                this.starHideCbByNode.delete(owner);
            }
        }
    }

    private updateStarContainerAntiStretch(targetNode: Node, container?: Node | null) {
        if (!targetNode || !targetNode.isValid) return;
        const c = container && container.isValid ? container : targetNode.getChildByName(this.STAR_CONTAINER_NAME);
        if (!c || !c.isValid) return;
        const sx = targetNode.scale.x;
        const sy = targetNode.scale.y;
        // 反向补偿父节点在待机/钓鱼动画中的拉伸，保证星星等比显示
        const invX = Math.abs(sx) > 0.0001 ? 1 / sx : 1;
        const invY = Math.abs(sy) > 0.0001 ? 1 / sy : 1;
        c.setScale(invX, invY, 1);
    }

    update() {
        // 队列节流版本已关闭，保留空 update 以避免每帧额外开销
    }

    private isStarDisplayDisabledForBuilding(node: Node): boolean {
        if (!node || !node.isValid) return false;
        return !!(
            node.getComponent(StoneWall) ||
            node.getComponent(WatchTower) ||
            node.getComponent(IceTower) ||
            node.getComponent(ThunderTower)
        );
    }

    private getNodeBuildingTypeId(node: Node, buildScript?: any): string {
        const prefabName = (buildScript?.prefabName || '').toString().trim();
        if (prefabName) return prefabName;
        if (node.getComponent(WarAncientTree)) return 'WarAncientTree';
        if (node.getComponent(HunterHall)) return 'HunterHall';
        if (node.getComponent(MageTower)) return 'MageTower';
        if (node.getComponent(SwordsmanHall)) return 'SwordsmanHall';
        if (node.getComponent(Church)) return 'Church';
        if (node.getComponent('EagleNest')) return 'EagleNest';
        if (node.getComponent(StoneWall)) return 'StoneWall';
        if (node.getComponent(WatchTower)) return 'WatchTower';
        if (node.getComponent(IceTower)) return 'IceTower';
        if (node.getComponent(ThunderTower)) return 'ThunderTower';
        return (node.name || '').replace('(Clone)', '').trim();
    }

    private getCandidateBuildingTypeId(building: BuildingType): string {
        const mapByName: Record<string, string> = {
            '弓箭手小屋': 'WarAncientTree',
            '猎手大厅': 'HunterHall',
            '法师塔': 'MageTower',
            '剑士小屋': 'SwordsmanHall',
            '教堂': 'Church',
            '角鹰兽栏': 'EagleNest',
            '石墙': 'StoneWall',
            '哨塔': 'WatchTower'
        };
        if (building?.name && mapByName[building.name]) return mapByName[building.name];
        if (building?.prefab) {
            if (building.prefab === this.warAncientTreePrefab) return 'WarAncientTree';
            if (building.prefab === this.hunterHallPrefab) return 'HunterHall';
            if (building.prefab === this.mageTowerPrefab) return 'MageTower';
            if (building.prefab === this.swordsmanHallPrefab) return 'SwordsmanHall';
            if (building.prefab === this.churchPrefab) return 'Church';
            if (building.prefab === this.eagleNestPrefab) return 'EagleNest';
            if (building.prefab === this.stoneWallPrefab) return 'StoneWall';
            if (building.prefab === this.watchTowerPrefab) return 'WatchTower';
        }
        return building?.name || '';
    }

    private tryMergeBuildings(source: Node, target: Node): boolean {
        if (!source || !target || !source.isValid || !target.isValid) return false;
        const srcBuild = (source.getComponent(Build) || source.getComponent('Build')) as any;
        const dstBuild = (target.getComponent(Build) || target.getComponent('Build')) as any;
        if (!srcBuild || !dstBuild) return false;

        const srcKey = this.getNodeBuildingTypeId(source, srcBuild);
        const dstKey = this.getNodeBuildingTypeId(target, dstBuild);
        if (!srcKey || !dstKey || srcKey !== dstKey) return false;

        // 阶段2：防御塔/石墙不参与合并升星
        if (
            srcKey === 'StoneWall' || srcKey === 'WatchTower' || srcKey === 'IceTower' || srcKey === 'ThunderTower'
        ) {
            return false;
        }

        const srcStar = Math.max(1, Math.min(3, Math.floor(Number(srcBuild.starLevel || 1))));
        const dstStar = Math.max(1, Math.min(3, Math.floor(Number(dstBuild.starLevel || 1))));
        if (srcStar !== dstStar) return false;
        if (srcStar >= 3) return false;

        const nextStar = srcStar + 1;
        if (typeof dstBuild.setStarLevel === 'function') dstBuild.setStarLevel(nextStar);
        else dstBuild.starLevel = nextStar;
        this.applyStarToBuildingNode(target, nextStar);
        this._logStarUpgradeSfx('tryMergeBuildings: merged', { type: srcKey, fromStar: srcStar, toStar: nextStar });
        this.playStarUpgradeFxAndAutoHide(target);
        this.playUpgradeEffectForProducedUnits(dstBuild, nextStar);

        // 只升级建筑本体；不批量同步已产出单位，避免瞬时重负载。

        try {
            const buildingPool = BuildingPool.getInstance();
            if (buildingPool) {
                buildingPool.release(source, srcBuild.prefabName || undefined);
            } else {
                source.destroy();
            }
        } catch {
            if (source && source.isValid) source.destroy();
        }

        this.playBuildPlaceSfxIfAny();
        return true;
    }

    private tryMergeCandidateBuildingAtGrid(building: BuildingType, gridX: number, gridY: number): boolean {
        if (!this.gridPanel) return false;
        const gridCells = (this.gridPanel as any).gridCells;
        const cell = gridCells?.[gridY]?.[gridX];
        const target = cell?.buildingNode as Node | null;
        if (!target || !target.isValid) return false;

        const dstBuild = (target.getComponent(Build) || target.getComponent('Build')) as any;
        if (!dstBuild) return false;

        const srcTypeId = this.getCandidateBuildingTypeId(building);
        const dstTypeId = this.getNodeBuildingTypeId(target, dstBuild);
        if (!srcTypeId || !dstTypeId) return false;
        if (srcTypeId !== dstTypeId) return false;

        const srcStar = 1; // 候选框新建筑固定 1 星
        const dstStar = Math.max(1, Math.min(3, Math.floor(Number(dstBuild.starLevel || 1))));
        if (srcStar !== dstStar) return false;
        if (dstStar >= 3) return false;

        if (!this.gameManager) this.findGameManager();
        const unitId = this.getCandidateBuildingTypeId(building);
        let buildCost = building.cost;
        const configCost = this.getBuildCostFromConfig(unitId);
        if (configCost > 0) buildCost = this.getActualBuildCost(unitId, configCost);
        if (!this.gameManager || !this.gameManager.canAfford(buildCost)) {
            GamePopup.showMessage('金币不足');
            return true; // 命中可合并目标但钱不够，阻断普通建造
        }
        this.gameManager.spendGold(buildCost);

        const nextStar = dstStar + 1;
        if (typeof dstBuild.setStarLevel === 'function') dstBuild.setStarLevel(nextStar);
        else dstBuild.starLevel = nextStar;
        this.applyStarToBuildingNode(target, nextStar);
        this._logStarUpgradeSfx('tryMergeCandidateBuildingAtGrid: merged', {
            type: srcTypeId,
            fromStar: dstStar,
            toStar: nextStar,
            gridX,
            gridY,
        });
        this.playStarUpgradeFxAndAutoHide(target);
        this.playUpgradeEffectForProducedUnits(dstBuild, nextStar);

        this.playBuildPlaceSfxIfAny();
        return true;
    }

    /**
     * 刷怪进度（0~1），用于刷新按钮金边长度
     * - 0：整圈
     * - 1：完全消失
     */
    public setWaveSpawnProgress(progress01: number) {
        if (!this.buildingPanel) return;
        try {
            (this.buildingPanel as any).setRefreshProgress?.(progress01);
        } catch {}
    }

    /**
     * 更新建筑类型列表（当预制体被注入后调用）
     */
    private updateBuildingTypes() {
        if (!this.buildingPanel) {
            return; // 如果面板还未初始化，直接返回
        }

        const buildingTypes: BuildingType[] = [];
        const configManager = UnitConfigManager.getInstance();
        const currentLevel = this.getCurrentLevelForUnlock();
        
        // 确保配置文件已加载（如果未加载，使用预制体的默认值作为后备）
        if (this.warAncientTreePrefab) {
            let cost = this.towerCost; // 默认使用预制体的值
            if (configManager.isConfigLoaded()) {
                const configCost = this.getBuildCostFromConfig('WarAncientTree');
                if (configCost > 0) {
                    cost = this.getActualBuildCost('WarAncientTree', configCost);
                }
            }
            buildingTypes.push({
                name: '弓箭手小屋',
                prefab: this.warAncientTreePrefab,
                cost: cost,
                icon: this.warAncientTreeIcon || null!,
                description: '可以生产Tower单位'
            });
        }
        if (this.hunterHallPrefab) {
            let cost = this.hunterHallCost; // 默认使用预制体的值
            if (configManager.isConfigLoaded()) {
                const configCost = this.getBuildCostFromConfig('HunterHall');
                if (configCost > 0) {
                    cost = this.getActualBuildCost('HunterHall', configCost);
                }
            }
            buildingTypes.push({
                name: '猎手大厅',
                prefab: this.hunterHallPrefab,
                cost: cost,
                icon: this.hunterHallIcon || null!,
                description: '可以生产女猎手单位'
            });
        }
        // 法师塔在第2关及以后解锁
        if (this.mageTowerPrefab && currentLevel >= 2) {
            let cost = this.mageTowerCost;
            if (configManager.isConfigLoaded()) {
                const configCost = this.getBuildCostFromConfig('MageTower');
                if (configCost > 0) {
                    cost = this.getActualBuildCost('MageTower', configCost);
                }
            }
            buildingTypes.push({
                name: '法师塔',
                prefab: this.mageTowerPrefab,
                cost: cost,
                icon: this.mageTowerIcon || null!,
                description: '可以训练法师单位'
            });
        }
        // if (this.stoneWallPrefab) {
        //     let cost = this.stoneWallCost; // 默认使用预制体的值
        //     if (configManager.isConfigLoaded()) {
        //         const configCost = this.getBuildCostFromConfig('StoneWall');
        //         if (configCost > 0) {
        //             cost = this.getActualBuildCost('StoneWall', configCost);
        //         }
        //     }
        //     buildingTypes.push({
        //         name: '石墙',
        //         prefab: this.stoneWallPrefab,
        //         cost: cost,
        //         icon: this.stoneWallIcon || null!,
        //         description: '坚固的障碍物，阻挡敌人进攻路线'
        //     });
        // }
        // 哨塔不在建造面板中显示，只能通过初始化生成
        // if (this.watchTowerPrefab) {
        //     let cost = this.watchTowerCost; // 默认使用预制体的值
        //     if (configManager.isConfigLoaded()) {
        //         const configCost = this.getBuildCostFromConfig('WatchTower');
        //         if (configCost > 0) {
        //             cost = this.getActualBuildCost('WatchTower', configCost);
        //         }
        //     }
        //     buildingTypes.push({
        //         name: '哨塔',
        //         prefab: this.watchTowerPrefab,
        //         cost: cost,
        //         icon: this.watchTowerIcon || null!,
        //         description: '可以攻击敌人的防御塔，使用弓箭攻击'
        //     });
        // }
        if (this.swordsmanHallPrefab) {
            let cost = this.swordsmanHallCost; // 默认使用预制体的值
            if (configManager.isConfigLoaded()) {
                const configCost = this.getBuildCostFromConfig('SwordsmanHall');
                if (configCost > 0) {
                    cost = this.getActualBuildCost('SwordsmanHall', configCost);
                }
            }
            buildingTypes.push({
                name: '剑士小屋',
                prefab: this.swordsmanHallPrefab,
                cost: cost,
                icon: this.swordsmanHallIcon || null!,
                description: '可以生产精灵剑士单位'
            });
        }
        if (this.churchPrefab) {
            let cost = this.churchCost; // 默认使用预制体的值
            if (configManager.isConfigLoaded()) {
                const configCost = this.getBuildCostFromConfig('Church');
                if (configCost > 0) {
                    cost = this.getActualBuildCost('Church', configCost);
                }
            }
            buildingTypes.push({
                name: '教堂',
                prefab: this.churchPrefab,
                cost: cost,
                icon: this.churchIcon || null!,
                description: '可以生产为友军治疗的牧师单位'
            });
        }
        // 角鹰兽栏在第 3 关及以后解锁
        if (this.eagleNestPrefab && currentLevel >= 3) {
            let cost = this.eagleNestCost;
            if (configManager.isConfigLoaded()) {
                const configCost = this.getBuildCostFromConfig('EagleNest');
                if (configCost > 0) {
                    cost = this.getActualBuildCost('EagleNest', configCost);
                }
            }
            buildingTypes.push({
                name: '角鹰兽栏',
                prefab: this.eagleNestPrefab,
                cost: cost,
                icon: this.eagleNestIcon || null!,
                description: '可以生产角鹰单位（空中单位，不占用人口）'
            });
        }
        this.currentBuildingPool = buildingTypes;
        // 候选框只展示 3 个：每次从当前解锁池随机抽取
        this.refreshCurrentWaveBuildingCandidates(false);
        this.updateRefreshButtonState();
    }

    private getCurrentLevelForUnlock(): number {
        const uiManagerNode = find('UIManager') || find('UI/UIManager') || find('Canvas/UI/UIManager');
        const uiManager = uiManagerNode?.getComponent('UIManager') as any;
        if (uiManager && typeof uiManager.getCurrentLevel === 'function') {
            const level = uiManager.getCurrentLevel();
            if (typeof level === 'number' && !isNaN(level)) {
                return level;
            }
        }
        return 1;
    }

    private getCurrentLevelForTutorial(): number {
        const uiManagerNode = find('UIManager') || find('UI/UIManager') || find('Canvas/UI/UIManager');
        const uiManager = uiManagerNode?.getComponent('UIManager') as any;
        if (uiManager && typeof uiManager.getCurrentLevel === 'function') {
            const level = uiManager.getCurrentLevel();
            if (typeof level === 'number' && !isNaN(level)) {
                return level;
            }
        }
        const fallbackLevel = (this.gameManager as any)?.getCurrentLevelSafe?.();
        return typeof fallbackLevel === 'number' && !isNaN(fallbackLevel) ? fallbackLevel : 0;
    }

    /**
     * 重新开始游戏时重置内部状态，允许重新生成初始石墙和哨塔
     */
    public resetForRestart() {
        this.initialStoneWallsPlaced = false;
        this.initialWatchTowersPlaced = false;
        this.initialWarAncientTreePlaced = false;
        this.initialMageTowerPlaced = false;
        this.refreshCandidateManualGoldCost = this.refreshCandidateGoldCostBase;

        // 重置建筑网格占用状态
        if (!this.gridPanel) {
            this.findGridPanel();
        }
        if (this.gridPanel && (this.gridPanel as any).resetGrid) {
            (this.gridPanel as any).resetGrid();
        }

        // 重置石墙网格占用状态
        if (!this.stoneWallGridPanelComponent) {
            this.findStoneWallGridPanel();
        }
        if (this.stoneWallGridPanelComponent && (this.stoneWallGridPanelComponent as any).resetGrid) {
            (this.stoneWallGridPanelComponent as any).resetGrid();
        }
    }

    /**
     * 从预制体的 Sprite 组件中自动提取图标（如果未在编辑器中手动指定）
     */
    private ensureIconsFromPrefabs() {
        const extractIconFromPrefab = (prefab: Prefab | null | undefined, currentIcon: SpriteFrame | null | undefined): SpriteFrame | null | undefined => {
            if (currentIcon) {
                return currentIcon;
            }
            if (!prefab || !prefab.data) {
                return currentIcon;
            }
            const root = prefab.data as Node;
            if (!root) {
                return currentIcon;
            }
            const sprite = root.getComponent(Sprite) || root.getComponentInChildren(Sprite);
            if (sprite && sprite.spriteFrame) {
                return sprite.spriteFrame;
            }
            return currentIcon;
        };

        // 石墙 / 哨塔 / 冰塔 / 雷塔 / 战争古树 / 猎手大厅 / 剑士小屋 / 教堂图标，如果未手动设置，则自动从对应预制体根节点（或子节点）的 Sprite 中提取
        this.stoneWallIcon = extractIconFromPrefab(this.stoneWallPrefab, this.stoneWallIcon) as SpriteFrame;
        this.watchTowerIcon = extractIconFromPrefab(this.watchTowerPrefab, this.watchTowerIcon) as SpriteFrame;
        this.iceTowerIcon = extractIconFromPrefab(this.iceTowerPrefab, this.iceTowerIcon) as SpriteFrame;
        this.thunderTowerIcon = extractIconFromPrefab(this.thunderTowerPrefab, this.thunderTowerIcon) as SpriteFrame;
        this.warAncientTreeIcon = extractIconFromPrefab(this.warAncientTreePrefab, this.warAncientTreeIcon) as SpriteFrame;
        this.hunterHallIcon = extractIconFromPrefab(this.hunterHallPrefab, this.hunterHallIcon) as SpriteFrame;
        this.mageTowerIcon = extractIconFromPrefab(this.mageTowerPrefab, this.mageTowerIcon) as SpriteFrame;
        this.swordsmanHallIcon = extractIconFromPrefab(this.swordsmanHallPrefab, this.swordsmanHallIcon) as SpriteFrame;
        this.churchIcon = extractIconFromPrefab(this.churchPrefab, this.churchIcon) as SpriteFrame;
        this.eagleNestIcon = extractIconFromPrefab(this.eagleNestPrefab, this.eagleNestIcon) as SpriteFrame;
    }

    start() {
        // 查找游戏管理器
        this.findGameManager();
        
        // 从分包注入的预制体中自动提取图标（如果未在编辑器中配置）
        this.ensureIconsFromPrefabs();

        // 查找水晶
        if (!this.targetCrystal) { 
            this.targetCrystal = find('Crystal');
        }

        // 创建弓箭手容器
        if (!this.towerContainer) {
            // 先尝试查找现有的Towers节点
            const existingTowers = find('Towers');
            if (existingTowers) {
                this.towerContainer = existingTowers;
            } else {
                this.towerContainer = new Node('Towers');
                this.towerContainer.setParent(this.node.scene);
            }
        }

        // 创建战争古树容器
        if (!this.warAncientTreeContainer) {
            const existingTrees = find('WarAncientTrees');
            if (existingTrees) {
                this.warAncientTreeContainer = existingTrees;
            } else {
                this.warAncientTreeContainer = new Node('WarAncientTrees');
                const canvas = find('Canvas');
                if (canvas) {
                    this.warAncientTreeContainer.setParent(canvas);
                } else if (this.node.scene) {
                    this.warAncientTreeContainer.setParent(this.node.scene);
                }
            }
        }

        

        // 创建猎手大厅容器
        if (!this.hunterHallContainer) {
            const existingHalls = find('HunterHalls');
            if (existingHalls) {
                this.hunterHallContainer = existingHalls;
            } else {
                this.hunterHallContainer = new Node('HunterHalls');
                const canvas = find('Canvas');
                if (canvas) {
                    this.hunterHallContainer.setParent(canvas);
                } else if (this.node.scene) {
                    this.hunterHallContainer.setParent(this.node.scene);
                }
            }
        }

        if (!this.mageTowerContainer) {
            const existingTowers = find('MageTowers');
            if (existingTowers) {
                this.mageTowerContainer = existingTowers;
            } else {
                this.mageTowerContainer = new Node('MageTowers');
                const canvas = find('Canvas');
                if (canvas) {
                    this.mageTowerContainer.setParent(canvas);
                } else if (this.node.scene) {
                    this.mageTowerContainer.setParent(this.node.scene);
                }
            }
        }

        // 角鹰兽栏容器（与长按拖动拾取 getBuildingAtPosition 一致）
        if (!this.eagleNestContainer) {
            const existingNests = find('EagleNests');
            if (existingNests) {
                this.eagleNestContainer = existingNests;
            } else {
                this.eagleNestContainer = new Node('EagleNests');
                const canvas = find('Canvas');
                if (canvas) {
                    this.eagleNestContainer.setParent(canvas);
                } else if (this.node.scene) {
                    this.eagleNestContainer.setParent(this.node.scene);
                }
            }
        }

        // 创建剑士小屋容器
        if (!this.swordsmanHallContainer) {
            const existingHalls = find('SwordsmanHalls');
            if (existingHalls) {
                this.swordsmanHallContainer = existingHalls;
            } else {
                this.swordsmanHallContainer = new Node('SwordsmanHalls');
                const canvas = find('Canvas');
                if (canvas) {
                    this.swordsmanHallContainer.setParent(canvas);
                } else if (this.node.scene) {
                    this.swordsmanHallContainer.setParent(this.node.scene);
                }
            }
        }

        // 创建教堂容器
        if (!this.churchContainer) {
            const existingChurches = find('Churches');
            if (existingChurches) {
                this.churchContainer = existingChurches;
            } else {
                this.churchContainer = new Node('Churches');
                const canvas = find('Canvas');
                if (canvas) {
                    this.churchContainer.setParent(canvas);
                } else if (this.node.scene) {
                    this.churchContainer.setParent(this.node.scene);
                }
            }
        }

        // 创建哨塔容器
        if (!this.watchTowerContainer) {
            const existingWatchTowers = find('Canvas/WatchTowers');
            if (existingWatchTowers) {
                this.watchTowerContainer = existingWatchTowers;
            } else {
                this.watchTowerContainer = new Node('WatchTowers');
                const canvas = find('Canvas');
                if (canvas) {
                    this.watchTowerContainer.setParent(canvas);
                } else if (this.node.scene) {
                    this.watchTowerContainer.setParent(this.node.scene);
                }
            }
        }

        // 创建冰塔容器
        if (!this.iceTowerContainer) {
            const existingIceTowers = find('Canvas/IceTowers');
            if (existingIceTowers) {
                this.iceTowerContainer = existingIceTowers;
            } else {
                this.iceTowerContainer = new Node('IceTowers');
                const canvas = find('Canvas');
                if (canvas) {
                    this.iceTowerContainer.setParent(canvas);
                } else if (this.node.scene) {
                    this.iceTowerContainer.setParent(this.node.scene);
                }
            }
        }

        // 创建雷塔容器
        if (!this.thunderTowerContainer) {
            const existingThunderTowers = find('Canvas/ThunderTowers');
            if (existingThunderTowers) {
                this.thunderTowerContainer = existingThunderTowers;
            } else {
                this.thunderTowerContainer = new Node('ThunderTowers');
                const canvas = find('Canvas');
                if (canvas) {
                    this.thunderTowerContainer.setParent(canvas);
                } else if (this.node.scene) {
                    this.thunderTowerContainer.setParent(this.node.scene);
                }
            }
        }

        // 创建精灵剑士容器
        const existingSwordsmen = find('ElfSwordsmans');
        if (!existingSwordsmen) {
            const swordsmenContainer = new Node('ElfSwordsmans');
            const canvas = find('Canvas');
            if (canvas) {
                swordsmenContainer.setParent(canvas);
            } else if (this.node.scene) {
                swordsmenContainer.setParent(this.node.scene);
            }
        }

        // 创建石墙容器
        if (!this.stoneWallContainer) {
            const existingWalls = find('StoneWalls');
            if (existingWalls) {
                this.stoneWallContainer = existingWalls;
            } else {
                this.stoneWallContainer = new Node('StoneWalls');
                const canvas = find('Canvas');
                if (canvas) {
                    this.stoneWallContainer.setParent(canvas);
                } else if (this.node.scene) {
                    this.stoneWallContainer.setParent(this.node.scene);
                }
            }
        }

        // 查找网格面板
        this.findGridPanel();

        // 初始化建筑物选择面板
        this.initBuildingPanel();

        // 监听触摸事件 - 使用capture阶段优先处理建筑物拖拽
        const canvasNode = find('Canvas');
        if (canvasNode) {
            // 使用capture阶段，优先处理建筑物拖拽，避免SelectionManager干扰
            // 注意：capture阶段在Cocos Creator中需要使用不同的方式
            // 先移除可能存在的旧监听器，确保只注册一次
            canvasNode.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
            canvasNode.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            canvasNode.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
            
            // 注册事件监听器
            canvasNode.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
            canvasNode.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            canvasNode.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        } else {
            // 如果没有Canvas，使用全局输入事件作为后备
            input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
            input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
            input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        }
    }

    onDestroy() {
        // 清除长按检测状态
        this.cancelLongPressDetection();
        
        // 移除Canvas节点事件监听
        const canvasNode = find('Canvas');
        if (canvasNode) {
            canvasNode.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
            canvasNode.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            canvasNode.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        }
        // 移除全局输入事件监听（如果使用了）
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    }

    /**
     * 初始化建筑物选择面板
     */
    initBuildingPanel() {
        // 如果没有指定面板节点，创建一个
        if (!this.buildingSelectionPanel) {
            this.buildingSelectionPanel = new Node('BuildingSelectionPanel');
            const canvas = find('Canvas');
            if (canvas) {
                this.buildingSelectionPanel.setParent(canvas);
            } else {
                this.buildingSelectionPanel.setParent(this.node.scene);
            }

            // 设置面板位置（屏幕下方）
            const uiTransform = this.buildingSelectionPanel.addComponent(UITransform);
            const canvasTransform = canvas?.getComponent(UITransform);
            const screenHeight = canvasTransform?.height || 1334;
            uiTransform.setContentSize(750, screenHeight / 6); // 占屏幕1/6高度
            this.buildingSelectionPanel.setPosition(0, -screenHeight / 2 + screenHeight / 12, 0);

            // 添加背景
            const bg = new Node('Background');
            bg.setParent(this.buildingSelectionPanel);
            bg.setPosition(0, 0, 0);
            const bgTransform = bg.addComponent(UITransform);
            bgTransform.setContentSize(750, screenHeight / 6);
            const bgGraphics = bg.addComponent(Graphics);
            bgGraphics.fillColor = new Color(0, 0, 0, 200);
            bgGraphics.rect(-375, -screenHeight / 12, 750, screenHeight / 6);
            bgGraphics.fill();

            // 创建内容容器
            const content = new Node('Content');
            content.setParent(this.buildingSelectionPanel);
            content.setPosition(0, 0, 0);
            
            // 获取或添加BuildingSelectionPanel组件
            this.buildingPanel = this.buildingSelectionPanel.getComponent(BuildingSelectionPanel);
            if (!this.buildingPanel) {
                this.buildingPanel = this.buildingSelectionPanel.addComponent(BuildingSelectionPanel);
            }
            
            // 设置panelContent引用
            if (this.buildingPanel) {
                this.buildingPanel.panelContent = content;
            }
        } else {
            // 如果面板节点已存在，获取组件
            this.buildingPanel = this.buildingSelectionPanel.getComponent(BuildingSelectionPanel);
            if (!this.buildingPanel) {
                this.buildingPanel = this.buildingSelectionPanel.addComponent(BuildingSelectionPanel);
            }
        }

        // 设置建筑物类型
        this.updateBuildingTypes();

        // 设置回调
        this.buildingPanel.setOnBuildingSelected((building: BuildingType) => {
            this.currentSelectedBuilding = building;
        });

        this.buildingPanel.setOnBuild((building: BuildingType, position: Vec3) => {
            this.buildBuilding(building, position);
        });

        // 设置建造取消回调（当建造失败或取消时调用）
        this.buildingPanel.setOnBuildCancel(() => {
            this.disableBuildingMode();
        });

        // 设置刷新候选回调（本波内每次手动刷新后下次价格 +5，每波重置为基础价）
        this.buildingPanel.setOnRefreshRequest(() => {
            if (!this.gameManager) {
                this.findGameManager();
            }
            const cost = this.refreshCandidateManualGoldCost;
            if (!this.gameManager || !this.gameManager.canAfford(cost)) {
                GamePopup.showMessage('金币不足');
                this.updateRefreshButtonState();
                return;
            }
            this.gameManager.spendGold(cost);
            this.refreshCandidateManualGoldCost = cost + 5;
            this.refreshCurrentWaveBuildingCandidates(false, true);
            this.updateRefreshButtonState();
        });
        this.updateRefreshButtonState();
    }

    private updateRefreshButtonState() {
        if (!this.buildingPanel) {
            return;
        }
        const cost = this.refreshCandidateManualGoldCost;
        const canRefresh = !!this.gameManager && this.gameManager.canAfford(cost);
        this.buildingPanel.setRefreshButtonState(cost, canRefresh);
    }

    private refreshCurrentWaveBuildingCandidates(forceIncludeCurrentSelection: boolean, avoidSameAsLast: boolean = false): void {
        if (!this.buildingPanel) {
            return;
        }
        const pool = [...this.currentBuildingPool];
        if (pool.length === 0) {
            this.buildingPanel.setBuildingTypes([]);
            return;
        }

        const pickCount = Math.min(this.candidateDisplayCount, pool.length);
        const makeKey = (arr: BuildingType[]) => arr.map(x => x.name).slice().sort().join('|');
        const doPickOnce = (): BuildingType[] => {
            const picked: BuildingType[] = [];
            const usedIndex = new Set<number>();
            while (picked.length < pickCount) {
                const idx = Math.floor(Math.random() * pool.length);
                if (usedIndex.has(idx)) continue;
                usedIndex.add(idx);
                picked.push(pool[idx]);
            }
            return picked;
        };

        let picked = doPickOnce();
        if (avoidSameAsLast && pool.length > pickCount && this.lastCandidateKey) {
            const maxAttempts = 8;
            let attempt = 0;
            while (attempt < maxAttempts && makeKey(picked) === this.lastCandidateKey) {
                picked = doPickOnce();
                attempt++;
            }
        }

        if (forceIncludeCurrentSelection && this.currentSelectedBuilding) {
            const hasCurrent = picked.some(item => item.name === this.currentSelectedBuilding?.name);
            if (!hasCurrent) {
                picked[0] = this.currentSelectedBuilding;
            }
        }

        this.currentWaveBuildingCandidates = [...picked];
        this.buildingPanel.setBuildingTypes(this.currentWaveBuildingCandidates);
        this.lastCandidateKey = makeKey(picked);
    }

    private consumeCandidateAfterPlaced(placedBuilding: BuildingType | null): void {
        if (!placedBuilding) return;
        if (!this.currentWaveBuildingCandidates.length) return;
        const idx = this.currentWaveBuildingCandidates.findIndex(
            (item) => item && item.name === placedBuilding.name
        );
        if (idx < 0) return;
        this.currentWaveBuildingCandidates.splice(idx, 1);
        if (this.buildingPanel) {
            this.buildingPanel.setBuildingTypes([...this.currentWaveBuildingCandidates]);
        }
    }

    /**
     * 查找网格面板
     */
    findGridPanel() {
        if (this.buildingGridPanel) {
            this.gridPanel = this.buildingGridPanel.getComponent(BuildingGridPanel);
            if (this.gridPanel) {
                return;
            }
        }
        
        // 尝试查找场景中的网格面板
        const gridPanelNode = find('BuildingGridPanel');
        if (gridPanelNode) {
            this.gridPanel = gridPanelNode.getComponent(BuildingGridPanel);
            if (this.gridPanel) {
                this.buildingGridPanel = gridPanelNode;
                return;
            }
        }
        
        // 如果找不到，创建一个
        const canvas = find('Canvas');
        if (canvas) {
            const gridNode = new Node('BuildingGridPanel');
            gridNode.setParent(canvas);
            this.gridPanel = gridNode.addComponent(BuildingGridPanel);
            this.buildingGridPanel = gridNode;
        }
    }

    /**
     * 查找石墙网格面板
     */
    findStoneWallGridPanel() {
        // 优先使用属性绑定的节点
        if (this.stoneWallGridPanel) {
            this.stoneWallGridPanelComponent = this.stoneWallGridPanel.getComponent(StoneWallGridPanel);
            if (this.stoneWallGridPanelComponent) {
                return;
            }
        }
        
        // 从编辑器节点获取（Canvas/StoneWallGridPanel）
        const stoneWallGridPanelNode = find('Canvas/StoneWallGridPanel');
        if (stoneWallGridPanelNode) {
            this.stoneWallGridPanelComponent = stoneWallGridPanelNode.getComponent(StoneWallGridPanel);
            if (this.stoneWallGridPanelComponent) {
                this.stoneWallGridPanel = stoneWallGridPanelNode;
            }
        } else {
           //console.info('[TowerBuilder] findStoneWallGridPanel: 找不到Canvas/StoneWallGridPanel节点');
        }
    }

    /**
     * 触摸开始事件（检测建筑物点击，开始长按检测）
     */
    onTouchStart(event: EventTouch) {
          //console.log('[TowerBuilder] onTouchStart called');
        // 如果正在建造模式，不处理拖拽
        if (this.isBuildingMode) {
            return;
        }

        // 检查是否点击在UI元素上
        const targetNode = event.target as Node;
        if (targetNode) {
            const nodeName = targetNode.name.toLowerCase();
            if (nodeName.includes('button') || 
                nodeName.includes('panel') || 
                nodeName.includes('label') ||
                nodeName.includes('selection') ||
                nodeName.includes('buildingitem')) {
                return;
            }
        }

        // 获取触摸位置并转换为世界坐标
        const touchLocation = event.getLocation();
        const cameraNode = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
        if (!cameraNode || !this.gridPanel) {
            return;
        }
        
        const camera = cameraNode.getComponent(Camera);
        if (!camera) {
            return;
        }

        // 将屏幕坐标转换为世界坐标
        const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
        const worldPos = new Vec3();
        camera.screenToWorld(screenPos, worldPos);
        worldPos.z = 0;

        // 检查是否点击在建筑物上
        const building = this.getBuildingAtPosition(worldPos);
        if (building && this.gridPanel.isPositionInGrid(worldPos)) {
            // 开始长按检测
            this.startLongPressDetection(building, touchLocation);
            // 设置标志，告诉建筑物不要处理 onBuildingClick
            (building as any)._towerBuilderHandlingClick = true;
            // 注意：不立即阻止事件传播，让建筑物的 TOUCH_END 监听器能收到事件
        }
    }

    /**
     * 触摸移动事件（用于拖拽预览和建筑物拖拽）
     */
    onTouchMove(event: EventTouch) {
        // 处理建筑物拖拽 - 优先处理，避免SelectionManager处理
        if (this.isDraggingBuilding && this.draggedBuilding) {
            // 立即阻止事件传播，避免SelectionManager处理多选框
            event.propagationStopped = true;
            
            // 获取触摸位置并转换为世界坐标
            const touchLocation = event.getLocation();
            const cameraNode = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
            if (!cameraNode || !this.gridPanel) {
                return;
            }
            
            const camera = cameraNode.getComponent(Camera);
            if (!camera) {
                return;
            }

            // 将屏幕坐标转换为世界坐标
            const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
            const worldPos = new Vec3();
            camera.screenToWorld(screenPos, worldPos);
            worldPos.z = 0;

            // 检查是否在网格内
            if (this.gridPanel.isPositionInGrid(worldPos)) {
                // 在网格内，对齐到最近的网格中心
                const gridCenter = this.gridPanel.getNearestGridCenter(worldPos);
                if (gridCenter) {
                    // 建筑物对齐到网格中心
                    this.draggedBuilding.setWorldPosition(gridCenter);
                    // 第一关新手引导：记录“拖入目标格(1,2)”流程，并在命中目标格时清除高亮
                    try {
                        const level = this.getCurrentLevelForTutorial();
                        const tutorialActive = !!(this.gameManager as any)?.hasShownLevel1BuildHutTutorialAt48s;
                        if (level === 1 && tutorialActive && typeof (this.gridPanel as any).worldToGrid === 'function') {
                            const g = (this.gridPanel as any).worldToGrid(gridCenter);
                            if (g) {
                                const key = `${g.x},${g.y}`;
                                if (key !== this.level1TutorialDragLastGridKey) {
                                    this.level1TutorialDragLastGridKey = key;
                                }
                            }
                            if (g && g.x === 1 && g.y === 2) {
                                if (!this.level1TutorialTargetReachedLogged) {
                                    this.level1TutorialTargetReachedLogged = true;
                                }
                                this.gridPanel.clearHighlight();
                                return;
                            }
                        }
                    } catch {}
                    // 默认：高亮显示目标网格（排除当前拖拽的建筑物）
                    this.gridPanel.highlightGrid(gridCenter, this.draggedBuilding);
                } else {
                    // 无法获取网格中心，保持当前位置但清除高亮
                    this.gridPanel.clearHighlight();
                }
            } else {
                // 不在网格内，保持建筑物在最后一个有效网格位置，清除高亮
                // 不清除高亮，让用户知道当前位置无效
                this.gridPanel.clearHighlight();
            }
            return;
        }

        // 检查长按检测状态，如果移动距离超过阈值，取消长按
        if (this.isLongPressActive && this.longPressBuilding && this.longPressStartPos) {
            try {
                const touchLocation = event.getLocation();
                const moveDistance = Math.sqrt(
                    Math.pow(touchLocation.x - this.longPressStartPos.x, 2) + 
                    Math.pow(touchLocation.y - this.longPressStartPos.y, 2)
                );
                
                if (moveDistance > this.longPressMoveThreshold) {
                    // 移动距离超过阈值，取消长按检测
                    this.cancelLongPressDetection();
                }
            } catch (error) {
                // 如果访问 longPressStartPos 属性出错，取消长按检测
                this.cancelLongPressDetection();
            }
        }

        // 原有的建造模式处理
        if (!this.isBuildingMode || !this.currentSelectedBuilding) {
            // 不在建造模式时清除高亮
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
            if (this.stoneWallGridPanelComponent) {
                this.stoneWallGridPanelComponent.clearHighlight();
            }
            return;
        }

        // 检查是否点击在UI元素上
        const targetNode = event.target as Node;
        if (targetNode) {
            const nodeName = targetNode.name.toLowerCase();
            if (nodeName.includes('button') || 
                nodeName.includes('panel') || 
                nodeName.includes('label') ||
                nodeName.includes('selection') ||
                nodeName.includes('buildingitem')) {
                return;
            }
        }

        // 获取触摸位置并转换为世界坐标
        const touchLocation = event.getLocation();
        const cameraNode = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
        if (!cameraNode) {
            return;
        }
        
        const camera = cameraNode.getComponent(Camera);
        if (!camera) {
            return;
        }

        // 将屏幕坐标转换为世界坐标
        const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
        const worldPos = new Vec3();
        camera.screenToWorld(screenPos, worldPos);
        worldPos.z = 0;

        // 判断是否是石墙（优先处理石墙的高亮）
        const isStoneWall = this.currentSelectedBuilding && (this.currentSelectedBuilding.name === '石墙' || this.currentSelectedBuilding.prefab === this.stoneWallPrefab);
        
        if (isStoneWall) {
            // 石墙使用石墙网格面板
            if (!this.stoneWallGridPanelComponent) {
                this.findStoneWallGridPanel();
            }
            if (this.stoneWallGridPanelComponent) {
                // 清除普通网格高亮
                if (this.gridPanel) {
                    this.gridPanel.clearHighlight();
                }
                // 高亮显示石墙网格
                this.stoneWallGridPanelComponent.highlightGrid(worldPos);
            }
        } else {
            // 普通建筑物使用普通网格面板
            if (this.gridPanel) {
                // 清除石墙网格高亮
                if (this.stoneWallGridPanelComponent) {
                    this.stoneWallGridPanelComponent.clearHighlight();
                }
                // 高亮显示网格
                this.gridPanel.highlightGrid(worldPos);
            }
        }
    }

    findGameManager() {
        // 方法1: 通过节点名称查找
        let gmNode = find('GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager);
            if (this.gameManager) {
                return;
            }
        }
        
        // 方法2: 从场景根节点递归查找GameManager组件
        const scene = this.node.scene;
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
            this.gameManager = findInScene(scene, GameManager);
            if (this.gameManager) {
                return;
            }
        }
        
        // 方法3: 查找所有GameManager组件
        const sceneNodes = director.getScene()?.children || [];
        for (const child of sceneNodes) {
            this.gameManager = child.getComponent(GameManager);
            if (this.gameManager) {
                return;
            }
        }
        
        // 方法4: 查找Canvas节点下的GameManager
        const canvas = find('Canvas');
        if (canvas) {
            this.gameManager = canvas.getComponent(GameManager);
            if (this.gameManager) {
                return;
            }
            
            // 查找Canvas的子节点
            for (const child of canvas.children) {
                this.gameManager = child.getComponent(GameManager);
                if (this.gameManager) {
                    return;
                }
            }
        }
        
        // 如果还是找不到，输出警告
    }

    enableBuildingMode() {
        this.isBuildingMode = true;
        this.updateRefreshButtonState();
        // 显示建筑物选择面板
        if (this.buildingPanel) {
            this.buildingPanel.show();
        }
        
        // 根据当前选中的建筑类型显示相应的网格面板
        if (this.currentSelectedBuilding && this.currentSelectedBuilding.name === '石墙') {
            // 显示石墙网格面板
            if (!this.stoneWallGridPanelComponent) {
                this.findStoneWallGridPanel();
            }
            if (this.stoneWallGridPanelComponent) {
                this.stoneWallGridPanelComponent.show();
            }
        } else {
            // 显示普通建筑网格面板
            if (!this.gridPanel) {
                this.findGridPanel();
            }
            if (this.gridPanel) {
                this.gridPanel.show();
            }
        }

        // 第一关：在首次打开建造面板时，提示拖动候选兵营到网格中建造
        //this.showDragTutorialIfNeeded();
    }

    /**
     * 在第一关首次点击建造按钮并展开候选面板时，显示拖动建造提示
     */
    private showDragTutorialIfNeeded() {
        // 仅在第一关且未显示过时才提示
        if (this.hasShownDragTutorialInLevel1) {
            return;
        }

        const uiManagerNode = find('UIManager') || find('UI/UIManager') || find('Canvas/UI/UIManager');
        const uiManager = uiManagerNode?.getComponent('UIManager') as any;
        if (!uiManager || typeof uiManager.getCurrentLevel !== 'function') {
            return;
        }

        const level = uiManager.getCurrentLevel();
        if (level !== 1) {
            return;
        }

        // 确保建造候选面板已经可见
        const isPanelVisible = this.buildingPanel && this.buildingPanel.node && this.buildingPanel.node.active;
        if (!isPanelVisible) {
            return;
        }

        GamePopup.showMessage('可拖动候选兵营，到兵营网格中建造', true, 5);
        this.hasShownDragTutorialInLevel1 = true;
    }

    private tryShowLevel1BuildingLongPressHint() {
        if (this.getCurrentLevelForTutorial() !== 1) {
            return;
        }

        let shownCount = 0;
        try {
            const raw = sys.localStorage.getItem(TowerBuilder.LEVEL1_BUILDING_LONG_PRESS_HINT_KEY);
            const parsed = raw ? parseInt(raw, 10) : 0;
            shownCount = Number.isFinite(parsed) ? parsed : 0;
        } catch {
            shownCount = 0;
        }

        if (shownCount >= TowerBuilder.LEVEL1_BUILDING_LONG_PRESS_HINT_MAX) {
            return;
        }

        GamePopup.showMessage('长按建筑物可以拖动', true, 2);
        try {
            sys.localStorage.setItem(
                TowerBuilder.LEVEL1_BUILDING_LONG_PRESS_HINT_KEY,
                String(shownCount + 1)
            );
        } catch {
            // ignore localStorage errors
        }
    }

    disableBuildingMode() {
        this.isBuildingMode = false;
        this.currentSelectedBuilding = null;
        
        // 隐藏建筑物选择面板
        if (this.buildingPanel) {
            this.buildingPanel.hide();
        }

        if (this.previewTower) {
            this.previewTower.destroy();
            this.previewTower = null!;
        }
        
        // 清除普通建筑网格高亮
        if (this.gridPanel) {
            this.gridPanel.clearHighlight();
        }
        
        // 清除石墙网格高亮
        if (this.stoneWallGridPanelComponent) {
            this.stoneWallGridPanelComponent.clearHighlight();
        }
    }

    /**
     * 获取是否在建造模式下（供外部调用）
     */
    getIsBuildingMode(): boolean {
        return this.isBuildingMode;
    }

    onTouchEnd(event: EventTouch) {
          //console.log('[TowerBuilder] onTouchEnd called, isLongPressActive:', this.isLongPressActive, 'longPressBuilding:', this.longPressBuilding?.name);
        const location = event.getLocation();
        const targetNode = event.target as Node;

        
        // 无论是否在拖拽状态，都先清除网格高亮（防止残留）
        if (this.gridPanel) {
            this.gridPanel.clearHighlight();
        }
        
        // 处理建筑物拖拽结束 - 优先处理
        if (this.isDraggingBuilding && this.draggedBuilding) {
            // 立即阻止事件传播，避免SelectionManager处理
            event.propagationStopped = true;
            // 处理拖拽结束并放置建筑物
            this.endDraggingBuilding(event);
            // 清除长按检测状态
            this.cancelLongPressDetection();
            return;
        }
        
        // 如果不在拖拽状态，但draggedBuilding还存在，说明状态不一致，强制清除
        if (!this.isDraggingBuilding && this.draggedBuilding) {
            this.draggedBuilding = null!;
            this.draggedBuildingOriginalGrid = null;
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
        }

        // 处理长按检测：如果还在长按检测状态（未进入拖拽模式），则打开信息面板
        // 检查是否正在长按检测，并且没有进入拖拽模式
        if (this.isLongPressActive && this.longPressBuilding && !this.isDraggingBuilding) {
            const currentTime = Date.now();
            const elapsedTime = this.longPressStartTime > 0 ? (currentTime - this.longPressStartTime) / 1000 : 0;

              //console.log('[TowerBuilder] onTouchEnd: 单击建筑物，打开信息面板', this.longPressBuilding.name, 'elapsedTime:', elapsedTime);

            // 先清除长按检测状态（含建筑物上的 _towerBuilderHandlingClick）
            const building = this.longPressBuilding;
            this.cancelLongPressDetection();
            // 阻止事件传播，防止其他系统处理（包括建筑物的节点级别事件）
            event.propagationStopped = true;
            // 立即打开建筑物信息面板，不要延迟
            if (building && building.isValid) {
                // 先标记建筑物正在显示信息面板，防止 onBuildingClick 执行
                (building as any)._showingInfoPanel = true;
                  //console.log('[TowerBuilder] 准备打开信息面板，已设置 _showingInfoPanel 标志');

                this.tryShowLevel1BuildingLongPressHint();
                this.showBuildingInfoPanel(building);

                // 延迟清除标记，给面板时间显示
                this.scheduleOnce(() => {
                    if (building && building.isValid) {
                        (building as any)._showingInfoPanel = false;
                          //console.log('[TowerBuilder] 清除 _showingInfoPanel 标志');
                    }
                }, 0.5); // 延长到 0.5 秒，确保面板完全显示
            }
            return;
        }

        // 只在建造模式下处理
        if (!this.isBuildingMode || !this.currentSelectedBuilding) {
            // 不在建造模式或没有选中建筑物，不阻止事件传播
            return;
        }
        
        // 判断是否是石墙（优先处理石墙的放置逻辑）
        const isStoneWall = this.currentSelectedBuilding && (this.currentSelectedBuilding.name === '石墙' || this.currentSelectedBuilding.prefab === this.stoneWallPrefab);
        
        // 对于石墙，即使在其他系统可能拦截事件的情况下，也要确保能够放置
        // 石墙是唯一可以放置在地图各处的建筑物，需要优先处理
        if (isStoneWall) {
            // 立即阻止事件传播，确保石墙放置逻辑能够执行
            event.propagationStopped = true;
        }
        
        // 检查是否点击在UI元素上（如按钮、面板），如果是则不处理
        if (targetNode) {
            const nodeName = targetNode.name.toLowerCase();
            // 检查节点名称
            if (nodeName.includes('button') || 
                nodeName.includes('panel') || 
                nodeName.includes('label') ||
                nodeName.includes('selection') ||
                nodeName.includes('buildingitem') ||
                nodeName.includes('buildingselection')) {
                return;
            }
            // 检查父节点
            let parent = targetNode.parent;
            while (parent) {
                const parentName = parent.name.toLowerCase();
                if (parentName.includes('ui') || 
                    parentName.includes('panel') ||
                    parentName.includes('buildingselection') ||
                    parentName === 'canvas') {
                    // 检查是否是Canvas的直接子节点（UI层）
                    if (parent.name === 'Canvas') {
                        // 检查是否是UI相关的子节点
                        const uiChildren = ['UI', 'UIManager', 'HealthLabel', 'TimerLabel', 'BuildingSelectionPanel'];
                        if (uiChildren.some(name => targetNode.name.includes(name) || 
                            targetNode.getPathInHierarchy().includes(name))) {
                            return;
                        }
                    } else {
                        // 如果父节点是UI相关，不处理
                        return;
                    }
                }
                parent = parent.parent;
            }
        }
        
        if (!this.targetCrystal) {
            this.disableBuildingMode();
            return;
        }

        // 阻止事件继续传播，避免SelectionManager处理
        // 注意：石墙已经在上面提前阻止了事件传播，这里确保其他建筑物也能阻止事件传播
        event.propagationStopped = true;

        // 获取触摸位置
        const touchLocation = event.getLocation();
        
        // 查找Camera节点
        const cameraNode = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
        if (!cameraNode) {
            return;
        }
        
        const camera = cameraNode.getComponent(Camera);
        if (!camera) {
            return;
        }

        // 将屏幕坐标转换为世界坐标
        const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
        const worldPos = new Vec3();
        camera.screenToWorld(screenPos, worldPos);
        worldPos.z = 0;

        // 判断是否是石墙（已在上面判断过，这里使用之前的值）
        // isStoneWall 变量已在上面定义（第815行）
        
        let finalWorldPos = worldPos;
        if (isStoneWall) {
            if (!this.stoneWallGridPanelComponent) {
                this.findStoneWallGridPanel();
            }

            const stonePanel = this.stoneWallGridPanelComponent;
            if (!stonePanel) {
                return;
            }

            const gridCenter = stonePanel.getNearestGridCenter(worldPos);
            if (!gridCenter) {
                stonePanel.clearHighlight();
                return;
            }

            const grid = stonePanel.worldToGrid(gridCenter);
            if (!grid || stonePanel.isGridOccupied(grid.x, grid.y)) {
                stonePanel.clearHighlight();
                return;
            }

            finalWorldPos = gridCenter;
        } else if (this.gridPanel) {
            const gridCenter = this.gridPanel.getNearestGridCenter(worldPos);
            if (gridCenter) {
                finalWorldPos = gridCenter;
                // 候选框拖出建筑：若目标格已有建筑，优先尝试合并升星
                const g = this.gridPanel.worldToGrid(finalWorldPos);
                if (g) {
                    const gridCells = (this.gridPanel as any).gridCells;
                    const cellBuilding = gridCells?.[g.y]?.[g.x]?.buildingNode as Node | null;
                }
                if (g) {
                    const gridCells = (this.gridPanel as any).gridCells;
                    const cellBuilding = gridCells?.[g.y]?.[g.x]?.buildingNode as Node | null;
                    const occupied = !!(cellBuilding && cellBuilding.isValid) || this.gridPanel.isGridOccupied(g.x, g.y);
                    if (occupied) {
                    const mergedOrHandled = this.tryMergeCandidateBuildingAtGrid(this.currentSelectedBuilding, g.x, g.y);
                    if (mergedOrHandled) {
                        this.consumeCandidateAfterPlaced(this.currentSelectedBuilding);
                        this.disableBuildingMode();
                        if (this.gridPanel) this.gridPanel.clearHighlight();
                        if (this.stoneWallGridPanelComponent) this.stoneWallGridPanelComponent.clearHighlight();
                        return;
                    }
                    }
                }
            } else {
                // 非石墙必须在普通网格内
                this.gridPanel.clearHighlight();
                return;
            }
        }

        // 检查是否可以建造
        const canBuild = this.canBuildAt(finalWorldPos, this.currentSelectedBuilding);
        
        if (canBuild) {
            this.buildBuilding(this.currentSelectedBuilding, finalWorldPos);
        }
        
        // 清除高亮
        if (this.gridPanel) {
            this.gridPanel.clearHighlight();
        }
        if (this.stoneWallGridPanelComponent) {
            this.stoneWallGridPanelComponent.clearHighlight();
        }
    }

    canBuildAt(position: Vec3, building: BuildingType): boolean {
        if (!this.targetCrystal || !building) {
            return false;
        }

        // 判断是否是石墙或哨塔（都使用石墙网格）
        const isStoneWall = building.name === '石墙' || building.prefab === this.stoneWallPrefab;
        const isWatchTower = building.name === '哨塔' || building.prefab === this.watchTowerPrefab;
        const useStoneWallGrid = isStoneWall || isWatchTower;

        // 石墙和哨塔必须放置在石墙网格内
        if (useStoneWallGrid) {
            if (!this.stoneWallGridPanelComponent) {
                this.findStoneWallGridPanel();
            }
            const stonePanel = this.stoneWallGridPanelComponent;
            if (!stonePanel) {
                return false;
            }

            if (!stonePanel.isPositionInGrid(position)) {
                return false;
            }

            const grid = stonePanel.worldToGrid(position);
            if (!grid || stonePanel.isGridOccupied(grid.x, grid.y)) {
                return false;
            }

            return true;
        }

        // 非石墙/哨塔：需要在普通网格内并满足距离
        if (this.gridPanel) {
            if (!this.gridPanel.isPositionInGrid(position)) {
                return false;
            }
            
            // 检查目标网格是否已被占用
            const grid = this.gridPanel.worldToGrid(position);
            if (grid && this.gridPanel.isGridOccupied(grid.x, grid.y)) {
                return false;
            }
        }

        // 检查距离水晶的距离（保留原有逻辑作为备用检查，使用平方距离）
        const crystalPos = this.targetCrystal.worldPosition;
        const cdx = position.x - crystalPos.x, cdy = position.y - crystalPos.y, cdz = position.z - crystalPos.z;
        const crystalDistSq = cdx * cdx + cdy * cdy + cdz * cdz;
        
        if (crystalDistSq < this.minBuildDistance * this.minBuildDistance || crystalDistSq > this.buildRange * this.buildRange) {
            return false;
        }

        // 其他建筑物的碰撞检测（保持原有逻辑）
        // 检查是否与现有弓箭手重叠
        const towers = this.towerContainer?.children || [];
        for (const tower of towers) {
            if (tower.active) {
                const tp = tower.worldPosition;
                const tdx = position.x - tp.x, tdy = position.y - tp.y, tdz = position.z - tp.z;
                if (tdx * tdx + tdy * tdy + tdz * tdz < 60 * 60) { // 弓箭手之间的最小距离
                    return false;
                }
            }
        }

        // 检查是否与现有战争古树重叠
        const warAncients = this.warAncientTreeContainer?.children || [];
        for (const tree of warAncients) {
            if (tree.active) {
                const wp = tree.worldPosition;
                const wdx = position.x - wp.x, wdy = position.y - wp.y, wdz = position.z - wp.z;
                if (wdx * wdx + wdy * wdy + wdz * wdz < 80 * 80) { // 战争古树之间的最小距离（稍大一些）
                    return false;
                }
            }
        }

        // 检查是否与现有猎手大厅重叠
        const hunterHalls = this.hunterHallContainer?.children || [];
        for (const hall of hunterHalls) {
            if (hall.active) {
                const hp = hall.worldPosition;
                const hdx = position.x - hp.x, hdy = position.y - hp.y, hdz = position.z - hp.z;
                if (hdx * hdx + hdy * hdy + hdz * hdz < 80 * 80) { // 猎手大厅之间的最小距离
                    return false;
                }
            }
        }

        // 检查是否与现有教堂重叠
        const churches = this.churchContainer?.children || [];
        for (const c of churches) {
            if (c.active) {
                const cp = c.worldPosition;
                const chdx = position.x - cp.x, chdy = position.y - cp.y, chdz = position.z - cp.z;
                if (chdx * chdx + chdy * chdy + chdz * chdz < 80 * 80) { // 教堂之间/与其他建筑的最小距离
                    return false;
                }
            }
        }

        // 检查是否与现有角鹰兽栏重叠
        const eagleNests = this.eagleNestContainer?.children || [];
        for (const nest of eagleNests) {
            if (nest.active) {
                const np = nest.worldPosition;
                const ndx = position.x - np.x, ndy = position.y - np.y, ndz = position.z - np.z;
                if (ndx * ndx + ndy * ndy + ndz * ndz < 80 * 80) { // 角鹰兽栏之间/与其他建筑的最小距离
                    return false;
                }
            }
        }

        // 检查是否与现有石墙重叠（其他建筑物不能与石墙重叠）
        const stoneWalls = this.stoneWallContainer?.children || [];
        for (const wall of stoneWalls) {
            if (wall.active) {
                const swp = wall.worldPosition;
                const swdx = position.x - swp.x, swdy = position.y - swp.y, swdz = position.z - swp.z;
                if (swdx * swdx + swdy * swdy + swdz * swdz < 80 * 80) { // 其他建筑物与石墙的最小距离
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * 建造建筑物（通用方法）
     */
    buildBuilding(building: BuildingType, worldPosition: Vec3) {
        const nowMs = Date.now();
        if (this.isBuildCommitInProgress || (nowMs - this.lastBuildCommitAtMs) < 120) {
            return;
        }
        this.isBuildCommitInProgress = true;
        this.lastBuildCommitAtMs = nowMs;
        this.scheduleOnce(() => {
            this.isBuildCommitInProgress = false;
        }, 0.08);

        // 检查金币是否足够
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        // 从配置文件中获取建造成本
        let buildCost = building.cost;
        const buildingNameToUnitId: Record<string, string> = {
            '弓箭手小屋': 'WarAncientTree',
            '猎手大厅': 'HunterHall',
            '法师塔': 'MageTower',
            '石墙': 'StoneWall',
            '哨塔': 'WatchTower',
            '剑士小屋': 'SwordsmanHall',
            '教堂': 'Church',
            '角鹰兽栏': 'EagleNest'
        };
        
        const unitId = buildingNameToUnitId[building.name];
        if (unitId) {
            const configCost = this.getBuildCostFromConfig(unitId);
            if (configCost > 0) {
                buildCost = this.getActualBuildCost(unitId, configCost);
            }
        }
        
        if (this.gameManager && !this.gameManager.canAfford(buildCost)) {
            // 显示金币不足弹窗
            GamePopup.showMessage('金币不足');
            // 不退出建造模式，让用户可以继续尝试或选择其他建筑物
            // 但需要重新显示建筑物选择面板
            if (this.buildingPanel) {
                this.buildingPanel.show();
            }
            return;
        }

        // 候选框拖拽路径兜底：先尝试“落到已占用格时直接合并升星”
        // 注意：石墙/防御塔不参与星级显示与合并
        const unitTypeIdForMerge = this.getCandidateBuildingTypeId(building);
        const isMergeEligibleType = unitTypeIdForMerge !== 'StoneWall' &&
            unitTypeIdForMerge !== 'WatchTower' &&
            unitTypeIdForMerge !== 'IceTower' &&
            unitTypeIdForMerge !== 'ThunderTower';
        if (isMergeEligibleType && this.gridPanel) {
            const g = this.gridPanel.worldToGrid(worldPosition);
            if (g) {
                const mergedOrHandled = this.tryMergeCandidateBuildingAtGrid(building, g.x, g.y);
                if (mergedOrHandled) {
                    this.consumeCandidateAfterPlaced(building);
                    this.disableBuildingMode();
                    if (this.gridPanel) this.gridPanel.clearHighlight();
                    if (this.stoneWallGridPanelComponent) this.stoneWallGridPanelComponent.clearHighlight();
                    return;
                }
            }
        }

        // 检查是否可以在此位置建造
        if (!this.canBuildAt(worldPosition, building)) {
            // 不能建造时不退出建造模式，让用户可以继续尝试其他位置
            // 但需要重新显示建筑物选择面板
            if (this.buildingPanel) {
                this.buildingPanel.show();
            }
            return;
        }

        // 根据建筑物类型选择建造方法（仅当对应预制体存在时才视为成功派发）
        let placementDispatched = false;
        if (building.name === '弓箭手小屋' || building.prefab === this.warAncientTreePrefab) {
            if (this.warAncientTreePrefab) {
                this.buildWarAncientTree(worldPosition);
                placementDispatched = true;
            }
        } else if (building.name === '猎手大厅' || building.prefab === this.hunterHallPrefab) {
            if (this.hunterHallPrefab) {
                this.buildHunterHall(worldPosition);
                placementDispatched = true;
            }
        } else if (building.name === '法师塔' || building.prefab === this.mageTowerPrefab) {
            if (this.mageTowerPrefab) {
                this.buildMageTower(worldPosition);
                placementDispatched = true;
            }
        } else if (building.name === '石墙' || building.prefab === this.stoneWallPrefab) {
            if (this.stoneWallPrefab) {
                this.buildStoneWall(worldPosition);
                placementDispatched = true;
            }
        } else if (building.name === '哨塔' || building.prefab === this.watchTowerPrefab) {
            if (this.watchTowerPrefab) {
                this.buildWatchTower(worldPosition);
                placementDispatched = true;
            }
        } else if (building.name === '剑士小屋' || building.prefab === this.swordsmanHallPrefab) {
            if (this.swordsmanHallPrefab) {
                this.buildSwordsmanHall(worldPosition);
                placementDispatched = true;
            }
        } else if (building.name === '教堂' || building.prefab === this.churchPrefab) {
            if (this.churchPrefab) {
                this.buildChurch(worldPosition);
                placementDispatched = true;
            }
        } else if (building.name === '角鹰兽栏' || building.prefab === this.eagleNestPrefab) {
            if (this.eagleNestPrefab) {
                this.buildEagleNest(worldPosition);
                placementDispatched = true;
            }
        }

        if (placementDispatched) {
            this.playBuildPlaceSfxIfAny();
        }

        // 候选框中的建筑一旦成功安置，即从候选列表中移除
        this.consumeCandidateAfterPlaced(building);

        // 只有在成功建造后才退出建造模式
        this.disableBuildingMode();
        
        // 立即清除网格高亮（绿色可放置框体）
        if (this.gridPanel) {
            this.gridPanel.clearHighlight();
        }
        if (this.gameManager && typeof (this.gameManager as any).clearLevel1BuildHutTutorialGridHighlight === 'function') {
            (this.gameManager as any).clearLevel1BuildHutTutorialGridHighlight();
        }
        
        // 清除建筑物的选中状态（只清除UnitSelectionManager，不清除SelectionManager的多选）
        const unitSelectionManagerNode = find('UnitSelectionManager');
        if (unitSelectionManagerNode) {
            const unitSelectionManager = unitSelectionManagerNode.getComponent(UnitSelectionManager);
            if (unitSelectionManager) {
                unitSelectionManager.clearSelection();
            }
        }
        
        // 延迟一帧再次清除选中状态和网格高亮，确保建筑物创建完成后清除
        this.scheduleOnce(() => {
            const unitSelectionManagerNode = find('UnitSelectionManager');
            if (unitSelectionManagerNode) {
                const unitSelectionManager = unitSelectionManagerNode.getComponent(UnitSelectionManager);
                if (unitSelectionManager) {
                    unitSelectionManager.clearSelection();
                }
            }
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
        }, 0.02);
    }

    /**
     * 建造战争古树
     */
    buildWarAncientTree(worldPosition: Vec3, skipCost: boolean = false) {
        if (!this.warAncientTreePrefab) {
            return;
        }

        // 确保 gridPanel 存在
        if (!this.gridPanel) {
            this.findGridPanel();
        }

        // 从配置文件中获取建造成本（考虑单位卡片强化减少）
        const actualCost = this.getActualBuildCost('WarAncientTree');
        
        // 消耗金币（初始化赠送建筑可跳过扣费）
        if (this.gameManager && !skipCost) {
            this.gameManager.spendGold(actualCost);
        }

        // 性能优化：从对象池获取建筑物，而不是直接实例化
        const buildingPool = BuildingPool.getInstance();
        let tree: Node | null = null;
        if (buildingPool) {
            // 确保预制体已注册到对象池（如果未注册则注册）
            const stats = buildingPool.getStats();
            if (!stats['WarAncientTree']) {
                buildingPool.registerPrefab('WarAncientTree', this.warAncientTreePrefab);
            }
            tree = buildingPool.get('WarAncientTree');
        }
        
        // 如果对象池没有可用对象，降级使用instantiate
        if (!tree) {
            tree = instantiate(this.warAncientTreePrefab);
        }
        
        // 设置父节点
        const parent = this.warAncientTreeContainer || this.node;
        if (parent && !parent.active) {
            parent.active = true;
        }
        
        tree.setParent(parent);
        tree.active = true;
        tree.setPosition(0, 0, 0);
        tree.setRotationFromEuler(0, 0, 0);
        tree.setScale(1, 1, 1);
        tree.setWorldPosition(worldPosition);

        // 设置建造成本并检查首次出现
        const treeScript = tree.getComponent(WarAncientTree);
        if (treeScript) {
            // 设置prefabName（用于对象池回收）
            treeScript.prefabName = 'WarAncientTree';
            // 先应用配置（排除 buildCost，因为需要在实例化时动态设置）
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                configManager.applyConfigToUnit('WarAncientTree', treeScript, ['buildCost']);
            }
            
            // 应用单位卡片强化
            const talentEffectManager = TalentEffectManager.getInstance();
            talentEffectManager.applyUnitEnhancements('WarAncientTree', treeScript);
            
            // 应用公共天赋增幅
            talentEffectManager.applyTalentEffects(treeScript);
            
            // 然后设置建造成本（使用实际成本）
            treeScript.buildCost = actualCost;
            
            // 记录网格位置并标记占用
            if (this.gridPanel) {
                const grid = this.gridPanel.worldToGrid(worldPosition);
                if (grid) {
                    treeScript.gridX = grid.x;
                    treeScript.gridY = grid.y;
                    this.gridPanel.occupyGrid(grid.x, grid.y, tree);
                }
            }
            
            // 检查单位是否首次出现
            if (this.gameManager) {
                const unitType = treeScript.unitType || 'WarAncientTree';
                this.gameManager.checkUnitFirstAppearance(unitType, treeScript);
            }
        }
        // 记录操作
        const analytics = AnalyticsManager.getInstance();
        if (analytics && this.gameManager) {
            analytics.recordOperation(
                OperationType.BUILD_WAR_ANCIENT_TREE,
                this.gameManager.getGameTime(),
                { position: { x: treeScript.gridX, y: treeScript.gridY } }
            );
        }

    }

    /**
     * 建造猎手大厅
     */
    buildHunterHall(worldPosition: Vec3) {
        if (!this.hunterHallPrefab) {
            return;
        }

        // 获取实际建造成本（考虑单位卡片强化减少）
        const actualCost = this.getActualBuildCost('HunterHall');
        
        // 消耗金币
        if (this.gameManager) {
            this.gameManager.spendGold(actualCost);
        }

        // 性能优化：从对象池获取建筑物，而不是直接实例化
        const buildingPool = BuildingPool.getInstance();
        let hall: Node | null = null;
        if (buildingPool) {
            // 确保预制体已注册到对象池（如果未注册则注册）
            const stats = buildingPool.getStats();
            if (!stats['HunterHall']) {
                buildingPool.registerPrefab('HunterHall', this.hunterHallPrefab);
            }
            hall = buildingPool.get('HunterHall');
        }
        
        // 如果对象池没有可用对象，降级使用instantiate
        if (!hall) {
            hall = instantiate(this.hunterHallPrefab);
        }
        
        // 设置父节点
        const parent = this.hunterHallContainer || this.node;
        if (parent && !parent.active) {
            parent.active = true;
        }
        
        hall.setParent(parent);
        hall.active = true;
        hall.setPosition(0, 0, 0);
        hall.setRotationFromEuler(0, 0, 0);
        hall.setScale(1, 1, 1);
        hall.setWorldPosition(worldPosition);

        // 设置建造成本并检查首次出现
        const hallScript = hall.getComponent(HunterHall);
        if (hallScript) {
            // 设置prefabName（用于对象池回收）
            hallScript.prefabName = 'HunterHall';
            // 先应用配置（如果有）
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                (configManager as any).applyConfigToUnit?.('HunterHall', hallScript, ['buildCost']);
            }
            
            // 应用单位卡片强化
            const talentEffectManager = TalentEffectManager.getInstance();
            talentEffectManager.applyUnitEnhancements('HunterHall', hallScript);
            
            // 应用公共天赋增幅
            talentEffectManager.applyTalentEffects(hallScript);
            
            hallScript.buildCost = actualCost;
            
            // 记录网格位置并标记占用
            if (this.gridPanel) {
                const grid = this.gridPanel.worldToGrid(worldPosition);
                if (grid) {
                    hallScript.gridX = grid.x;
                    hallScript.gridY = grid.y;
                    this.gridPanel.occupyGrid(grid.x, grid.y, hall);
                }
            }
            
            // 检查单位是否首次出现
            if (this.gameManager) {
                const unitType = hallScript.unitType || 'HunterHall';
                this.gameManager.checkUnitFirstAppearance(unitType, hallScript);
            }
        }
        // 记录操作
        const analytics = AnalyticsManager.getInstance();
        if (analytics && this.gameManager) {
            analytics.recordOperation(
                OperationType.BUILD_HUNTER_HALL,
                this.gameManager.getGameTime(),
                { position: { x: hallScript.gridX, y: hallScript.gridY } }
            );
        }

    }

    buildMageTower(worldPosition: Vec3, skipCost: boolean = false): boolean {
        if (!this.mageTowerPrefab) {
            console.warn('[TowerBuilder.buildMageTower] abort: mageTowerPrefab is null');
            return false;
        }
        const actualCost = this.getActualBuildCost('MageTower');
        if (this.gameManager && !skipCost) {
            this.gameManager.spendGold(actualCost);
        }
        const buildingPool = BuildingPool.getInstance();
        let tower: Node | null = null;
        if (buildingPool) {
            const stats = buildingPool.getStats();
            if (!stats['MageTower']) {
                buildingPool.registerPrefab('MageTower', this.mageTowerPrefab);
            }
            tower = buildingPool.get('MageTower');
        }
        if (!tower) {
            tower = instantiate(this.mageTowerPrefab);
        }
        const parent = this.mageTowerContainer || this.node;
        if (parent && !parent.active) {
            parent.active = true;
        }
        tower.setParent(parent);
        tower.active = true;
        tower.setPosition(0, 0, 0);
        tower.setRotationFromEuler(0, 0, 0);
        tower.setScale(1, 1, 1);
        tower.setWorldPosition(worldPosition);

        const towerScript = tower.getComponent(MageTower);
        if (towerScript) {
            towerScript.prefabName = 'MageTower';
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                (configManager as any).applyConfigToUnit?.('MageTower', towerScript, ['buildCost']);
            }
            const talentEffectManager = TalentEffectManager.getInstance();
            talentEffectManager.applyUnitEnhancements('MageTower', towerScript);
            talentEffectManager.applyTalentEffects(towerScript);
            towerScript.buildCost = actualCost;
            if (this.gridPanel) {
                const grid = this.gridPanel.worldToGrid(worldPosition);
                if (grid) {
                    towerScript.gridX = grid.x;
                    towerScript.gridY = grid.y;
                    this.gridPanel.occupyGrid(grid.x, grid.y, tower);
                }
            }
            if (this.gameManager) {
                const unitType = towerScript.unitType || 'MageTower';
                this.gameManager.checkUnitFirstAppearance(unitType, towerScript);
            }

            // 记录操作（建造法师塔）
            const analytics = AnalyticsManager.getInstance();
            if (analytics && this.gameManager) {
                analytics.recordOperation(
                    OperationType.BUILD_MAGE_TOWER,
                    this.gameManager.getGameTime(),
                    { position: { x: towerScript.gridX, y: towerScript.gridY } }
                );
            }
            console.info('[TowerBuilder.buildMageTower] success:', 'worldPos=', worldPosition.x, worldPosition.y, 'skipCost=', skipCost, 'parent=', parent?.name);
            return true;
        }
        console.warn('[TowerBuilder.buildMageTower] abort: instantiated node missing MageTower component');
        return false;
    }

    /**
     * 建造石墙
     */
    buildStoneWall(worldPosition: Vec3, skipCost: boolean = false) {
        if (!this.stoneWallPrefab) {
            return;
        }

        // 获取实际建造成本（考虑单位卡片强化减少）
        const actualCost = this.getActualBuildCost('StoneWall');
        
        // 消耗金币
        if (this.gameManager && !skipCost) {
            this.gameManager.spendGold(actualCost);
        }

        // 性能优化：从对象池获取建筑物，而不是直接实例化
        const buildingPool = BuildingPool.getInstance();
        let wall: Node | null = null;
        if (buildingPool) {
            // 确保预制体已注册到对象池（如果未注册则注册）
            const stats = buildingPool.getStats();
            if (!stats['StoneWall']) {
                buildingPool.registerPrefab('StoneWall', this.stoneWallPrefab);
            }
            wall = buildingPool.get('StoneWall');
        }
        
        // 如果对象池没有可用对象，降级使用instantiate
        if (!wall) {
            wall = instantiate(this.stoneWallPrefab);
        }
        
        // 设置父节点
        const parent = this.stoneWallContainer || this.node;
        if (parent && !parent.active) {
            parent.active = true;
        }
        
        wall.setParent(parent);
        wall.active = true;
        wall.setPosition(0, 0, 0);
        wall.setRotationFromEuler(0, 0, 0);
        wall.setScale(1, 1, 1);
        // 使用setWorldPosition确保位置正确（gridToWorld返回的坐标是相对于Canvas中心的Canvas坐标）
        // 对于UI节点，如果父节点是Canvas，setWorldPosition会将坐标正确设置
        wall.setWorldPosition(worldPosition);

        // 设置建造成本并检查首次出现
        const wallScript = wall.getComponent(StoneWall);
        if (wallScript) {
            // 设置prefabName（用于对象池回收）
            wallScript.prefabName = 'StoneWall';
            // 先应用配置（排除 buildCost 和 collisionRadius，使用预制体中的设置）
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                configManager.applyConfigToUnit('StoneWall', wallScript, ['buildCost', 'collisionRadius']);
            }
            
            // 应用单位卡片强化
            const talentEffectManager = TalentEffectManager.getInstance();
            talentEffectManager.applyUnitEnhancements('StoneWall', wallScript);
            
            // 应用公共天赋增幅
            talentEffectManager.applyTalentEffects(wallScript);
            
            // 然后设置建造成本（使用实际成本）
            wallScript.buildCost = actualCost;
            
            // 石墙只能放置在石墙网格内，占用网格
            if (!this.stoneWallGridPanelComponent) {
                this.findStoneWallGridPanel();
            }
            
            if (this.stoneWallGridPanelComponent) {
                const grid = this.stoneWallGridPanelComponent.worldToGrid(worldPosition);
                if (grid) {
                    // 检查网格是否被占用
                    if (this.stoneWallGridPanelComponent.isGridOccupied(grid.x, grid.y)) {
                        // 网格已被占用，不应该发生这种情况（应该在放置前检查）
                    } else {
                        // 占用网格
                        if (this.stoneWallGridPanelComponent.occupyGrid(grid.x, grid.y, wall)) {
                            wallScript.gridX = grid.x;
                            wallScript.gridY = grid.y;
                        } else {
                            wallScript.gridX = -1;
                            wallScript.gridY = -1;
                        }
                    }
                } else {
                    // 石墙不在石墙网格内，不应该发生这种情况（应该在放置前检查）
                    wallScript.gridX = -1;
                    wallScript.gridY = -1;
                }
            } else {
                wallScript.gridX = -1;
                wallScript.gridY = -1;
            }
            
            // 检查单位是否首次出现
            if (this.gameManager) {
                const unitType = wallScript.unitType || 'StoneWall';
                this.gameManager.checkUnitFirstAppearance(unitType, wallScript);
            }
        }

        // 记录操作
        const analytics = AnalyticsManager.getInstance();
        if (analytics && this.gameManager) {
            analytics.recordOperation(
                OperationType.BUILD_STONE_WALL,
                this.gameManager.getGameTime(),
                { position: { x: wallScript.gridX, y: wallScript.gridY } }
            );
        }
    }

    /**
     * 建造哨塔
     */
    buildWatchTower(worldPosition: Vec3, skipCost: boolean = false) {
        if (!this.watchTowerPrefab) {
            return;
        }

        // 获取实际建造成本（考虑单位卡片强化减少）
        const actualCost = this.getActualBuildCost('WatchTower');
        
        // 检查人口（哨塔不占用人口）
        const populationCost = 0;
        if (this.gameManager) {
            // 即使skipCost=true，也需要占用人口（初始化建造的哨塔也需要占用人口）
            if (!this.gameManager.canAddPopulation(populationCost)) {
                if (!skipCost) {
                    GamePopup.showMessage('人口不足，无法建造哨塔');
                }
                return;
            }
            // 消耗金币与木材（仅在非skipCost时）
            if (!skipCost) {
                // 先检查木材是否足够
                const woodCost = this.watchTowerWoodCost || 1;
                const gmAny = this.gameManager as any;
                if (gmAny.getWood && gmAny.spendWood) {
                    const currentWood = gmAny.getWood();
                    if (currentWood < woodCost) {
                        GamePopup.showMessage('木材不足，无法建造哨塔');
                        return;
                    }
                    gmAny.spendWood(woodCost);
                }
                this.gameManager.spendGold(actualCost);
            }
            // 占用人口（无论是否skipCost都需要占用）
            if (populationCost > 0) {
                this.gameManager.addPopulation(populationCost);
            }
        }

        // 确保容器已初始化（如果编辑器没有手动绑定，则在此处兜底查找）
        if (!this.watchTowerContainer) {
            const canvas = find('Canvas');
            if (canvas) {
                // 兼容多种命名：WatchTowers / Towers / 直接在 Canvas 下
                this.watchTowerContainer =
                    this.watchTowerContainer ||
                    canvas.getChildByName('WatchTowers') ||
                    canvas.getChildByName('Towers') ||
                    canvas;
            }
        }
        
        // 性能优化：从对象池获取建筑物，而不是直接实例化
        const buildingPool = BuildingPool.getInstance();
        let tower: Node | null = null;
        if (buildingPool) {
            // 确保预制体已注册到对象池（如果未注册则注册）
            const stats = buildingPool.getStats();
            if (!stats['WatchTower']) {
                buildingPool.registerPrefab('WatchTower', this.watchTowerPrefab);
            }
            tower = buildingPool.get('WatchTower');
        }
        
        // 如果对象池没有可用对象，降级使用instantiate
        if (!tower) {
            tower = instantiate(this.watchTowerPrefab);
        }
        
        // 检查tower是否有效
        if (!tower || !tower.isValid) {
            console.error('[TowerBuilder] buildWatchTower: 无法创建哨塔节点');
            return;
        }
        
        // 设置父节点
        const parent = this.watchTowerContainer || this.node;
        if (!parent || !parent.isValid) {
            console.error('[TowerBuilder] buildWatchTower: 父节点无效');
            if (tower && tower.isValid) {
                tower.destroy();
            }
            return;
        }
        
        if (!parent.active) {
            parent.active = true;
        }
        
        tower.setParent(parent);
        tower.active = true;
        tower.setPosition(0, 0, 0);
        tower.setRotationFromEuler(0, 0, 0);
        tower.setScale(1, 1, 1);
        tower.setWorldPosition(worldPosition);

        // 设置建造成本并检查首次出现
        const towerScript = tower.getComponent(WatchTower);
        if (towerScript) {
            // 设置prefabName（用于对象池回收）
            towerScript.prefabName = 'WatchTower';
            // 先应用配置（排除 buildCost 和 collisionRadius，使用预制体中的设置）
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                configManager.applyConfigToUnit('WatchTower', towerScript, ['buildCost', 'collisionRadius']);
            }
            
            // 应用单位卡片强化
            const talentEffectManager = TalentEffectManager.getInstance();
            talentEffectManager.applyUnitEnhancements('WatchTower', towerScript);
            
            // 应用公共天赋增幅
            talentEffectManager.applyTalentEffects(towerScript);
            
            // 然后设置建造成本（使用实际成本）
            towerScript.buildCost = actualCost;
            
            // 哨塔只能放置在石墙网格内，占用网格
            if (!this.stoneWallGridPanelComponent) {
                this.findStoneWallGridPanel();
            }
            
            if (this.stoneWallGridPanelComponent) {
                const grid = this.stoneWallGridPanelComponent.worldToGrid(worldPosition);
                if (grid) {
                    // 哨塔占据两个网格高度，需要检查两个网格是否都被占用
                    // 检查第二个网格是否存在（grid.y+1不能超出网格范围）
                    if (grid.y + 1 >= this.stoneWallGridPanelComponent.gridHeight) {
                        // 第二个网格超出范围，无法放置
                        towerScript.gridX = -1;
                        towerScript.gridY = -1;
                    } else if (this.stoneWallGridPanelComponent.isGridOccupied(grid.x, grid.y) || 
                               this.stoneWallGridPanelComponent.isGridOccupied(grid.x, grid.y + 1)) {
                        // 至少有一个网格被占用，不应该发生这种情况（应该在放置前检查）
                        towerScript.gridX = -1;
                        towerScript.gridY = -1;
                    } else {
                        // 占用两个网格
                        if (this.stoneWallGridPanelComponent.occupyGrid(grid.x, grid.y, tower) &&
                            this.stoneWallGridPanelComponent.occupyGrid(grid.x, grid.y + 1, tower)) {
                            towerScript.gridX = grid.x;
                            towerScript.gridY = grid.y;
                            // 调整位置：在原有基础上整体向下偏移 25 像素
                            const gridPos = this.stoneWallGridPanelComponent.gridToWorld(grid.x, grid.y);
                            if (gridPos) {
                                const adjustedPos = new Vec3(gridPos.x, gridPos.y, gridPos.z);
                                tower.setWorldPosition(adjustedPos);
                            }
                        } else {
                            // 占用失败，释放已占用的网格
                            this.stoneWallGridPanelComponent.releaseGrid(grid.x, grid.y);
                            this.stoneWallGridPanelComponent.releaseGrid(grid.x, grid.y + 1);
                            towerScript.gridX = -1;
                            towerScript.gridY = -1;
                        }
                    }
                } else {
                    // 哨塔不在石墙网格内，不应该发生这种情况（应该在放置前检查）
                    towerScript.gridX = -1;
                    towerScript.gridY = -1;
                }
            } else {
                towerScript.gridX = -1;
                towerScript.gridY = -1;
            }
            
            // 检查单位是否首次出现
            if (this.gameManager) {
                const unitType = towerScript.unitType || 'WatchTower';
                this.gameManager.checkUnitFirstAppearance(unitType, towerScript);
            }
        }
        // 记录操作
        const analytics = AnalyticsManager.getInstance();
        if (analytics && this.gameManager) {
            analytics.recordOperation(
                OperationType.BUILD_WATCHTOWER,
                this.gameManager.getGameTime(),
                { position: { x: towerScript.gridX, y: towerScript.gridY } }
            );
        }
    }

    /**
     * 在石墙网格最上方一行随机生成指定数量的石墙（仅在游戏开始时调用一次）
     */
    spawnInitialStoneWalls(count: number = 14) {
        if (this.initialStoneWallsPlaced) {
            return;
        }
        if (!this.stoneWallGridPanelComponent) {
            this.findStoneWallGridPanel();
        }
        const panel = this.stoneWallGridPanelComponent;
        if (!panel) {
            return;
        }

        const maxCount = Math.min(count, panel.gridWidth);
        // 最上方一行（StoneWallGridPanel 以左上为0,0，向下为递增）
        const y = 9;

        // 生成并打乱x坐标
        const xs: number[] = [];
        for (let i = 0; i < panel.gridWidth; i++) {
            xs.push(i);
        }
        for (let i = xs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [xs[i], xs[j]] = [xs[j], xs[i]];
        }

        let placed = 0;
        for (const x of xs) {
            if (placed >= maxCount) break;
            // 跳过已占用格子
            if (panel.isGridOccupied(x, y)) {
                continue;
            }
            const worldPos = panel.gridToWorld(x, y);
            if (!worldPos) {
                continue;
            }
            this.buildStoneWall(worldPos, true);
            placed++;
        }

        this.initialStoneWallsPlaced = true;
    }

    /**
     * 第一关：在建筑物网格第三排第一个位置生成一个初始弓箭手小屋
     * （向上移动一个建筑物网格：由原来的第二排 gridY = 1 调整为第三排 gridY = 2）
     */
    public spawnInitialWarAncientTreeForLevel1() {
        if (this.initialWarAncientTreePlaced) {
            return;
        }

        // 确保建筑物网格面板存在
        if (!this.gridPanel) {
            this.findGridPanel();
        }
        const panel = this.gridPanel;
        if (!panel) {
            return;
        }

        const gridX = 0;
        const gridY = 2; // 第三排（从下往上数）

        // 如果该格子已被占用，则不再生成，避免与后续逻辑冲突
        if (panel.isGridOccupied(gridX, gridY)) {
            return;
        }

        const worldPos = panel.gridToWorld(gridX, gridY);
        if (!worldPos) {
            return;
        }

        // 初始化赠送建筑：不消耗金币
        this.buildWarAncientTree(worldPos, true);
        this.initialWarAncientTreePlaced = true;
    }

    /**
     * 第二关：在建筑物网格第三排第二个位置生成一个初始法师塔
     */
    public spawnInitialMageTowerForLevel2() {
        if (this.initialMageTowerPlaced) {
            console.info('[TowerBuilder.spawnInitialMageTowerForLevel2] skip: already placed');
            return;
        }

        if (!this.gridPanel) {
            this.findGridPanel();
        }
        const panel = this.gridPanel;
        if (!panel) {
            console.warn('[TowerBuilder.spawnInitialMageTowerForLevel2] abort: gridPanel not found');
            return;
        }
        console.info('[TowerBuilder.spawnInitialMageTowerForLevel2] start:', 'hasMagePrefab=', !!this.mageTowerPrefab, 'grid=', panel.gridWidth, 'x', panel.gridHeight);

        const candidates = [
            { x: 1, y: 2 }, // 预期固定位置（第三排第二个）
            { x: 2, y: 2 }, // 兜底1
            { x: 1, y: 1 }  // 兜底2
        ];

        for (const pos of candidates) {
            if (panel.isGridOccupied(pos.x, pos.y)) {
                console.info('[TowerBuilder.spawnInitialMageTowerForLevel2] candidate occupied:', pos.x, pos.y);
                continue;
            }
            const worldPos = panel.gridToWorld(pos.x, pos.y);
            if (!worldPos) {
                console.warn('[TowerBuilder.spawnInitialMageTowerForLevel2] candidate gridToWorld failed:', pos.x, pos.y);
                continue;
            }
            const built = this.buildMageTower(worldPos, true);
            console.info('[TowerBuilder.spawnInitialMageTowerForLevel2] try candidate:', pos.x, pos.y, 'built=', built);
            if (built) {
                this.initialMageTowerPlaced = true;
                return;
            }
        }
        console.warn('[TowerBuilder.spawnInitialMageTowerForLevel2] failed: no candidate built');
    }

    /**
     * 在石墙网格中随机生成指定数量的哨塔（仅在游戏开始时调用一次）
     * 要求：
     * - y轴坐标固定：哨塔占据石墙网格从上往下数第3、4个格子
     *   （即以StoneWallGridPanel顶行为 gridY = gridHeight - 1，则底部格为 gridY = gridHeight - 4）
     * - x轴坐标仍然随机，且之间保持最小间距
     */
    spawnInitialWatchTowers(count: number = 3) {
       //console.info('[TowerBuilder] spawnInitialWatchTowers: 开始生成初始哨塔，数量=', count);
        if (this.initialWatchTowersPlaced) {
           //console.info('[TowerBuilder] spawnInitialWatchTowers: 哨塔已生成，跳过');
            return;
        }
        if (!this.stoneWallGridPanelComponent) {
           //console.info('[TowerBuilder] spawnInitialWatchTowers: 查找石墙网格面板');
            this.findStoneWallGridPanel();
        }
        const panel = this.stoneWallGridPanelComponent;
        if (!panel) {
           //console.info('[TowerBuilder] spawnInitialWatchTowers: 找不到石墙网格面板');
            return;
        }
       //console.info('[TowerBuilder] spawnInitialWatchTowers: 找到石墙网格面板，gridWidth=', panel.gridWidth, 'gridHeight=', panel.gridHeight);

        // 计算固定的Y坐标：
        // 顶行索引为 gridHeight - 1，从上往下第3、4行为：
        //   第3行：gridHeight - 3
        //   第4行：gridHeight - 4
        // 哨塔底部格子为更靠下的那一行（第4行），即 baseY = gridHeight - 4
        const baseY = panel.gridHeight - 4;
        if (baseY < 0 || baseY + 1 >= panel.gridHeight) {
            // 网格高度异常，直接返回，避免越界
            return;
        }

        // 只允许在这一行放置哨塔
        const availableYs: number[] = [baseY];

        // 生成所有可能的x坐标
        const availableXs: number[] = [];
        for (let x = 0; x < panel.gridWidth; x++) {
            availableXs.push(x);
        }

        // 打乱y坐标
        for (let i = availableYs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableYs[i], availableYs[j]] = [availableYs[j], availableYs[i]];
        }

        // 打乱x坐标
        for (let i = availableXs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableXs[i], availableXs[j]] = [availableXs[j], availableXs[i]];
        }

        const placedPositions: { x: number; y: number }[] = [];
        let placed = 0;
        const minXDistance = 3; // x坐标最小间距
       //console.info('[TowerBuilder] spawnInitialWatchTowers: 开始尝试放置哨塔，最小x间距=', minXDistance);

        // 尝试放置哨塔（Y固定，X随机）
        for (const y of availableYs) {
            if (placed >= count) break;
            
            for (const x of availableXs) {
                if (placed >= count) break;
                
                // 跳过已占用的格子
                if (panel.isGridOccupied(x, y)) {
                    continue;
                }

                // 检查与已放置的哨塔x坐标距离是否足够
                let canPlace = true;
                for (const pos of placedPositions) {
                    if (Math.abs(x - pos.x) < minXDistance) {
                        canPlace = false;
                        break;
                    }
                }

                if (canPlace) {
                    const worldPos = panel.gridToWorld(x, y);
                    if (!worldPos) {
                       //console.info('[TowerBuilder] spawnInitialWatchTowers: 格子(', x, ',', y, ')无法转换为世界坐标，跳过');
                        continue;
                    }
                   //console.info('[TowerBuilder] spawnInitialWatchTowers: 在格子(', x, ',', y, ')生成哨塔，世界坐标=', worldPos);
                    // 使用buildWatchTower方法建造哨塔（skipCost=true，不消耗金币）
                    this.buildWatchTower(worldPos, true);
                    
                    // 记录已放置的位置
                    placedPositions.push({ x, y });
                    placed++;
                }
            }
        }

       //console.info('[TowerBuilder] spawnInitialWatchTowers: 完成，共生成', placed, '个哨塔');
        this.initialWatchTowersPlaced = true;
    }

    /**
     * 建造冰元素塔
     */
    buildIceTower(worldPosition: Vec3, skipCost: boolean = false) {
        if (!this.iceTowerPrefab) {
            return;
        }

        // 获取实际建造成本（考虑单位卡片强化减少）
        const actualCost = this.getActualBuildCost('IceTower', 20); // 默认20金币
        
        // 检查人口（冰塔不占用人口）
        const populationCost = 0;
        if (this.gameManager) {
            // 即使skipCost=true，也需要占用人口
            if (!this.gameManager.canAddPopulation(populationCost)) {
                if (!skipCost) {
                    GamePopup.showMessage('人口不足，无法建造冰塔');
                }
                return;
            }
            // 消耗金币与木材（仅在非skipCost时）
            if (!skipCost) {
                const woodCost = this.iceTowerWoodCost || 3;
                const gmAny = this.gameManager as any;
                if (gmAny.getWood && gmAny.spendWood) {
                    const currentWood = gmAny.getWood();
                    if (currentWood < woodCost) {
                        GamePopup.showMessage('木材不足，无法建造冰塔');
                        return;
                    }
                    gmAny.spendWood(woodCost);
                }
                this.gameManager.spendGold(actualCost);
            }
            // 占用人口（无论是否skipCost都需要占用）
            if (populationCost > 0) {
                this.gameManager.addPopulation(populationCost);
            }
        }

        // 性能优化：从对象池获取建筑物
        const buildingPool = BuildingPool.getInstance();
        let tower: Node | null = null;
        if (buildingPool) {
            const stats = buildingPool.getStats();
            if (!stats['IceTower']) {
                buildingPool.registerPrefab('IceTower', this.iceTowerPrefab);
            }
            tower = buildingPool.get('IceTower');
        }
        
        if (!tower) {
            tower = instantiate(this.iceTowerPrefab);
        }
        
        // 设置父节点
        const parent = this.iceTowerContainer || this.node;
        if (parent && !parent.active) {
            parent.active = true;
        }
        
        tower.setParent(parent);
        tower.active = true;
        tower.setPosition(0, 0, 0);
        tower.setRotationFromEuler(0, 0, 0);
        tower.setScale(1, 1, 1);
        tower.setWorldPosition(worldPosition);

        // 设置建造成本并检查首次出现
        const towerScript = tower.getComponent(IceTower);
        if (towerScript) {
            towerScript.prefabName = 'IceTower';
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                configManager.applyConfigToUnit('IceTower', towerScript, ['buildCost', 'collisionRadius']);
            }
            
            const talentEffectManager = TalentEffectManager.getInstance();
            talentEffectManager.applyUnitEnhancements('IceTower', towerScript);
            talentEffectManager.applyTalentEffects(towerScript);
            
            towerScript.buildCost = actualCost;
            
            // 冰塔只能放置在石墙网格内，占用网格
            if (!this.stoneWallGridPanelComponent) {
                this.findStoneWallGridPanel();
            }
            
            if (this.stoneWallGridPanelComponent) {
                const grid = this.stoneWallGridPanelComponent.worldToGrid(worldPosition);
                if (grid) {
                    // 冰塔占据两个网格高度，需要检查两个网格是否都被占用
                    // 检查上方网格是否存在（grid.y+1不能超出网格范围，Y坐标越大越在上方）
                    if (grid.y + 1 >= this.stoneWallGridPanelComponent.gridHeight) {
                        // 上方网格超出范围，无法放置
                        towerScript.gridX = -1;
                        towerScript.gridY = -1;
                    } else if (this.stoneWallGridPanelComponent.isGridOccupied(grid.x, grid.y) || 
                               this.stoneWallGridPanelComponent.isGridOccupied(grid.x, grid.y + 1)) {
                        // 至少有一个网格被占用，不应该发生这种情况（应该在放置前检查）
                        towerScript.gridX = -1;
                        towerScript.gridY = -1;
                    } else {
                        // 占用两个网格：grid.y（选中的网格，下方）和 grid.y + 1（上方网格）
                        const occupy1 = this.stoneWallGridPanelComponent.occupyGrid(grid.x, grid.y, tower);
                        const occupy2 = this.stoneWallGridPanelComponent.occupyGrid(grid.x, grid.y + 1, tower);
                       //console.info('[TowerBuilder] buildIceTower 占用网格:', grid.x, grid.y, '结果:', occupy1, '上方网格:', grid.x, grid.y + 1, '结果:', occupy2);
                        if (occupy1 && occupy2) {
                            towerScript.gridX = grid.x;
                            towerScript.gridY = grid.y; // 使用下方网格的坐标（与哨塔一致）
                           //console.info('[TowerBuilder] buildIceTower 成功占用两个网格，gridX:', towerScript.gridX, 'gridY:', towerScript.gridY, '(占用网格:', grid.x, grid.y, '和', grid.x, grid.y + 1, ')');
                            // 调整位置，使其居中在两个网格之间（参考哨塔的做法）
                            const gridPos = this.stoneWallGridPanelComponent.gridToWorld(grid.x, grid.y);
                           //console.info('[TowerBuilder] buildIceTower 网格位置:', gridPos);
                            if (gridPos) {
                                // 向上偏移50像素（一个网格），使其居中在两个网格之间
                                const adjustedPos = new Vec3(gridPos.x, gridPos.y + 100, gridPos.z);
                                tower.setWorldPosition(adjustedPos);
                                
                                // 设置 baseY 为下方网格的底部（用于后续的 setHeightWithFixedBottom 调用）
                                const gridPanel = this.stoneWallGridPanelComponent as any;
                                const gridBottomY = gridPos.y - gridPanel.cellSize / 2;
                                (towerScript as any).baseY = gridBottomY;
                                
                                // 根据当前建造阶段更新高度（但不改变位置，因为位置已经设置好了）
                                const constructionStage = (towerScript as any).constructionStage;
                                const defaultScale = (towerScript as any).defaultScale || new Vec3(1, 1, 1);
                                const heightScale = constructionStage === 0 ? 0.5 : constructionStage === 1 ? 0.66 : 1.0;
                                
                                // 设置缩放（保持X和Z不变，只调整Y）
                                tower.setScale(defaultScale.x, defaultScale.y * heightScale, defaultScale.z);
                                
                                // 注意：不调用 setHeightWithFixedBottom，因为它会重新计算位置
                                // 位置已经设置为两个网格的中心，不需要再调整
                            }
                        } else {
                            // 占用失败，释放已占用的网格
                            console.warn('[TowerBuilder] buildIceTower 占用网格失败，释放已占用的网格');
                            if (occupy1) {
                                this.stoneWallGridPanelComponent.releaseGrid(grid.x, grid.y);
                            }
                            if (occupy2) {
                                this.stoneWallGridPanelComponent.releaseGrid(grid.x, grid.y + 1);
                            }
                            towerScript.gridX = -1;
                            towerScript.gridY = -1;
                        }
                    }
                } else {
                    // 冰塔不在石墙网格内，不应该发生这种情况（应该在放置前检查）
                    console.warn('[TowerBuilder] buildIceTower 无法转换为网格坐标');
                    towerScript.gridX = -1;
                    towerScript.gridY = -1;
                }
            } else {
                console.warn('[TowerBuilder] buildIceTower 找不到石墙网格面板');
                towerScript.gridX = -1;
                towerScript.gridY = -1;
            }
            
            // 验证网格占用情况
            if (towerScript.gridX >= 0 && towerScript.gridY >= 0 && this.stoneWallGridPanelComponent) {
                // gridY 是下方网格的坐标（选中的），上方网格是 gridY + 1
                const isOccupied1 = this.stoneWallGridPanelComponent.isGridOccupied(towerScript.gridX, towerScript.gridY);
                const isOccupied2 = this.stoneWallGridPanelComponent.isGridOccupied(towerScript.gridX, towerScript.gridY + 1);
               //console.info('[TowerBuilder] buildIceTower 验证网格占用 - 下方网格:', towerScript.gridX, towerScript.gridY, '占用:', isOccupied1, '上方网格:', towerScript.gridX, towerScript.gridY + 1, '占用:', isOccupied2);
            }
            
            if (this.gameManager) {
                const unitType = towerScript.unitType || 'IceTower';
                this.gameManager.checkUnitFirstAppearance(unitType, towerScript);
            }
        }
        if (towerScript && towerScript.gridX >= 0 && towerScript.gridY >= 0) {
            this.playBuildPlaceSfxIfAny();
        }
        // 记录操作
        const analytics = AnalyticsManager.getInstance();
        if (analytics && this.gameManager) {
            analytics.recordOperation(
                OperationType.BUILD_ICE_TOWER,
                this.gameManager.getGameTime(),
                { position: { x: towerScript.gridX, y: towerScript.gridY } }
            );
        }
    }

    /**
     * 建造雷元素塔
     */
    buildThunderTower(worldPosition: Vec3, skipCost: boolean = false) {
        if (!this.thunderTowerPrefab) {
            return;
        }

        // 获取实际建造成本（考虑单位卡片强化减少）
        const actualCost = this.getActualBuildCost('ThunderTower', 30); // 默认30金币
        
        // 检查人口（雷塔不占用人口）
        const populationCost = 0;
        if (this.gameManager) {
            // 即使skipCost=true，也需要占用人口
            if (!this.gameManager.canAddPopulation(populationCost)) {
                if (!skipCost) {
                    GamePopup.showMessage('人口不足，无法建造雷塔');
                }
                return;
            }
            // 消耗金币与木材（仅在非skipCost时）
            if (!skipCost) {
                const woodCost = this.thunderTowerWoodCost || 3;
                const gmAny = this.gameManager as any;
                if (gmAny.getWood && gmAny.spendWood) {
                    const currentWood = gmAny.getWood();
                    if (currentWood < woodCost) {
                        GamePopup.showMessage('木材不足，无法建造雷塔');
                        return;
                    }
                    gmAny.spendWood(woodCost);
                }
                this.gameManager.spendGold(actualCost);
            }
            // 占用人口（无论是否skipCost都需要占用）
            if (populationCost > 0) {
                this.gameManager.addPopulation(populationCost);
            }
        }

        // 性能优化：从对象池获取建筑物
        const buildingPool = BuildingPool.getInstance();
        let tower: Node | null = null;
        if (buildingPool) {
            const stats = buildingPool.getStats();
            if (!stats['ThunderTower']) {
                buildingPool.registerPrefab('ThunderTower', this.thunderTowerPrefab);
            }
            tower = buildingPool.get('ThunderTower');
        }
        
        if (!tower) {
            tower = instantiate(this.thunderTowerPrefab);
        }
        
        // 设置父节点
        const parent = this.thunderTowerContainer || this.node;
        if (parent && !parent.active) {
            parent.active = true;
        }
        
        tower.setParent(parent);
        tower.active = true;
        tower.setPosition(0, 0, 0);
        tower.setRotationFromEuler(0, 0, 0);
        tower.setScale(1, 1, 1);
        tower.setWorldPosition(worldPosition);

        // 设置建造成本并检查首次出现
        const towerScript = tower.getComponent(ThunderTower);
        if (towerScript) {
            towerScript.prefabName = 'ThunderTower';
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                configManager.applyConfigToUnit('ThunderTower', towerScript, ['buildCost', 'collisionRadius']);
            }
            
            const talentEffectManager = TalentEffectManager.getInstance();
            talentEffectManager.applyUnitEnhancements('ThunderTower', towerScript);
            talentEffectManager.applyTalentEffects(towerScript);
            
            towerScript.buildCost = actualCost;
            
            // 雷塔只能放置在石墙网格内，占用网格
            if (!this.stoneWallGridPanelComponent) {
                this.findStoneWallGridPanel();
            }
            
            if (this.stoneWallGridPanelComponent) {
                const grid = this.stoneWallGridPanelComponent.worldToGrid(worldPosition);
                if (grid) {
                    // 雷塔占据两个网格高度，需要检查两个网格是否都被占用
                    // 检查上方网格是否存在（grid.y+1不能超出网格范围，Y坐标越大越在上方）
                    if (grid.y + 1 >= this.stoneWallGridPanelComponent.gridHeight) {
                        // 上方网格超出范围，无法放置
                        towerScript.gridX = -1;
                        towerScript.gridY = -1;
                    } else if (this.stoneWallGridPanelComponent.isGridOccupied(grid.x, grid.y) || 
                               this.stoneWallGridPanelComponent.isGridOccupied(grid.x, grid.y + 1)) {
                        // 至少有一个网格被占用，不应该发生这种情况（应该在放置前检查）
                        towerScript.gridX = -1;
                        towerScript.gridY = -1;
                    } else {
                        // 占用两个网格：grid.y（选中的网格，下方）和 grid.y + 1（上方网格）
                        const occupy1 = this.stoneWallGridPanelComponent.occupyGrid(grid.x, grid.y, tower);
                        const occupy2 = this.stoneWallGridPanelComponent.occupyGrid(grid.x, grid.y + 1, tower);
                       //console.info('[TowerBuilder] buildThunderTower 占用网格:', grid.x, grid.y, '结果:', occupy1, '上方网格:', grid.x, grid.y + 1, '结果:', occupy2);
                        if (occupy1 && occupy2) {
                            towerScript.gridX = grid.x;
                            towerScript.gridY = grid.y; // 使用下方网格的坐标（与哨塔一致）
                           //console.info('[TowerBuilder] buildThunderTower 成功占用两个网格，gridX:', towerScript.gridX, 'gridY:', towerScript.gridY, '(占用网格:', grid.x, grid.y, '和', grid.x, grid.y + 1, ')');
                            // 调整位置，使其居中在两个网格之间（参考哨塔的做法）
                            const gridPos = this.stoneWallGridPanelComponent.gridToWorld(grid.x, grid.y);
                            if (gridPos) {
                                // 向上偏移25像素（半个网格），使其居中在两个网格之间
                                const adjustedPos = new Vec3(gridPos.x, gridPos.y + 25, gridPos.z);
                                tower.setWorldPosition(adjustedPos);
                                
                                // 设置 baseY 为下方网格的底部（用于后续的 setHeightWithFixedBottom 调用）
                                const gridPanel = this.stoneWallGridPanelComponent as any;
                                const gridBottomY = gridPos.y - gridPanel.cellSize / 2;
                                (towerScript as any).baseY = gridBottomY;
                                
                                // 根据当前建造阶段更新高度（但不改变位置，因为位置已经设置好了）
                                const constructionStage = (towerScript as any).constructionStage;
                                const defaultScale = (towerScript as any).defaultScale || new Vec3(1, 1, 1);
                                const heightScale = constructionStage === 0 ? 0.5 : constructionStage === 1 ? 0.66 : 1.0;
                                
                                // 设置缩放（保持X和Z不变，只调整Y）
                                tower.setScale(defaultScale.x, defaultScale.y * heightScale, defaultScale.z);
                                
                                // 注意：不调用 setHeightWithFixedBottom，因为它会重新计算位置
                                // 位置已经设置为两个网格的中心，不需要再调整
                            }
                        } else {
                            // 占用失败，释放已占用的网格
                            console.warn('[TowerBuilder] buildThunderTower 占用网格失败，释放已占用的网格');
                            if (occupy1) {
                                this.stoneWallGridPanelComponent.releaseGrid(grid.x, grid.y);
                            }
                            if (occupy2) {
                                this.stoneWallGridPanelComponent.releaseGrid(grid.x, grid.y + 1);
                            }
                            towerScript.gridX = -1;
                            towerScript.gridY = -1;
                        }
                    }
                } else {
                    // 雷塔不在石墙网格内，不应该发生这种情况（应该在放置前检查）
                    towerScript.gridX = -1;
                    towerScript.gridY = -1;
                }
            } else {
                towerScript.gridX = -1;
                towerScript.gridY = -1;
            }
            
            if (this.gameManager) {
                const unitType = towerScript.unitType || 'ThunderTower';
                this.gameManager.checkUnitFirstAppearance(unitType, towerScript);
            }
        }
        if (towerScript && towerScript.gridX >= 0 && towerScript.gridY >= 0) {
            this.playBuildPlaceSfxIfAny();
        }
        // 记录操作
        const analytics = AnalyticsManager.getInstance();
        if (analytics && this.gameManager) {
            analytics.recordOperation(
                OperationType.BUILD_THUNDER_TOWER,
                this.gameManager.getGameTime(),
                { position: { x: towerScript.gridX, y: towerScript.gridY } }
            );
        }
    }

    /**
     * 建造剑士小屋
     */
    buildSwordsmanHall(worldPosition: Vec3) {
        if (!this.swordsmanHallPrefab) {
            return;
        }

        // 获取实际建造成本（考虑单位卡片强化减少）
        const actualCost = this.getActualBuildCost('SwordsmanHall');
        
        // 消耗金币
        if (this.gameManager) {
            this.gameManager.spendGold(actualCost);
        }

        // 性能优化：从对象池获取建筑物，而不是直接实例化
        const buildingPool = BuildingPool.getInstance();
        let hall: Node | null = null;
        if (buildingPool) {
            // 确保预制体已注册到对象池（如果未注册则注册）
            const stats = buildingPool.getStats();
            if (!stats['SwordsmanHall']) {
                buildingPool.registerPrefab('SwordsmanHall', this.swordsmanHallPrefab);
            }
            hall = buildingPool.get('SwordsmanHall');
        }
        
        // 如果对象池没有可用对象，降级使用instantiate
        if (!hall) {
            hall = instantiate(this.swordsmanHallPrefab);
        }
        
        // 设置父节点
        const parent = this.swordsmanHallContainer || this.node;
        if (parent && !parent.active) {
            parent.active = true;
        }
        
        hall.setParent(parent);
        hall.active = true;
        hall.setPosition(0, 0, 0);
        hall.setRotationFromEuler(0, 0, 0);
        hall.setScale(1, 1, 1);
        hall.setWorldPosition(worldPosition);

        // 设置建造成本并检查首次出现
        const hallScript = hall.getComponent(SwordsmanHall);
        if (hallScript) {
            // 设置prefabName（用于对象池回收）
            hallScript.prefabName = 'SwordsmanHall';
            // 先应用配置（如果有）
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                (configManager as any).applyConfigToUnit?.('SwordsmanHall', hallScript, ['buildCost']);
            }
            
            // 应用单位卡片强化
            const talentEffectManager = TalentEffectManager.getInstance();
            talentEffectManager.applyUnitEnhancements('SwordsmanHall', hallScript);
            
            // 应用公共天赋增幅
            talentEffectManager.applyTalentEffects(hallScript);
            
            hallScript.buildCost = actualCost;
            
            // 记录网格位置并标记占用
            if (this.gridPanel) {
                const grid = this.gridPanel.worldToGrid(worldPosition);
                if (grid) {
                    hallScript.gridX = grid.x;
                    hallScript.gridY = grid.y;
                    this.gridPanel.occupyGrid(grid.x, grid.y, hall);
                }
            }
            
            // 检查单位是否首次出现
            if (this.gameManager) {
                const unitType = hallScript.unitType || 'SwordsmanHall';
                this.gameManager.checkUnitFirstAppearance(unitType, hallScript);
            }
        }
        // 记录操作
        const analytics = AnalyticsManager.getInstance();
        if (analytics && this.gameManager) {
            analytics.recordOperation(
                OperationType.BUILD_SWORDSMAN_HALL,
                this.gameManager.getGameTime(),
                { position: { x: hallScript.gridX, y: hallScript.gridY } }
            );
        }

    }

    /**
     * 建造教堂
     */
    buildChurch(worldPosition: Vec3) {
        if (!this.churchPrefab) {
            return;
        }

        // 获取实际建造成本（考虑单位卡片强化减少）
        const actualCost = this.getActualBuildCost('Church');
        
        // 消耗金币
        if (this.gameManager) {
            this.gameManager.spendGold(actualCost);
        }

        // 性能优化：从对象池获取建筑物，而不是直接实例化
        const buildingPool = BuildingPool.getInstance();
        let church: Node | null = null;
        if (buildingPool) {
            // 确保预制体已注册到对象池（如果未注册则注册）
            const stats = buildingPool.getStats();
            if (!stats['Church']) {
                buildingPool.registerPrefab('Church', this.churchPrefab);
            }
            church = buildingPool.get('Church');
        }
        
        // 如果对象池没有可用对象，降级使用instantiate
        if (!church) {
            church = instantiate(this.churchPrefab);
        }

        // 设置父节点
        const parent = this.churchContainer || this.node;
        if (parent && !parent.active) {
            parent.active = true;
        }

        church.setParent(parent);
        church.active = true;
        church.setPosition(0, 0, 0);
        church.setRotationFromEuler(0, 0, 0);
        church.setScale(1, 1, 1);
        church.setWorldPosition(worldPosition);

        const churchScript = church.getComponent(Church);
        if (churchScript) {
            // 设置prefabName（用于对象池回收）
            churchScript.prefabName = 'Church';
            // 先应用配置（排除 buildCost）
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                (configManager as any).applyConfigToUnit?.('Church', churchScript, ['buildCost']);
            }
            
            // 应用单位卡片强化
            const talentEffectManager = TalentEffectManager.getInstance();
            talentEffectManager.applyUnitEnhancements('Church', churchScript);
            
            // 应用公共天赋增幅
            talentEffectManager.applyTalentEffects(churchScript);

            // 然后设置建造成本（使用实际成本）
            churchScript.buildCost = actualCost;

            // 记录网格位置并标记占用
            if (this.gridPanel) {
                const grid = this.gridPanel.worldToGrid(worldPosition);
                if (grid) {
                    churchScript.gridX = grid.x;
                    churchScript.gridY = grid.y;
                    this.gridPanel.occupyGrid(grid.x, grid.y, church);
                }
            }

            // 检查首次出现
            if (this.gameManager) {
                const unitType = (churchScript as any).unitType || 'Church';
                this.gameManager.checkUnitFirstAppearance(unitType, churchScript);
            }
        }
        // 记录操作
        const analytics = AnalyticsManager.getInstance();
        if (analytics && this.gameManager) {
            analytics.recordOperation(
                OperationType.BUILD_CHURCH,
                this.gameManager.getGameTime(),
                { position: { x: churchScript.gridX, y: churchScript.gridY } }
            );
        }

    }

    /**
     * 建造角鹰兽栏
     */
    buildEagleNest(worldPosition: Vec3, skipCost: boolean = false) {
        if (!this.eagleNestPrefab) {
            return;
        }

        // 确保 gridPanel 存在
        if (!this.gridPanel) {
            this.findGridPanel();
        }

        // 从配置文件中获取建造成本
        const actualCost = this.getActualBuildCost('EagleNest');

        // 消耗金币（初始化赠送建筑可跳过扣费）
        if (this.gameManager && !skipCost) {
            this.gameManager.spendGold(actualCost);
        }

        // 从对象池获取建筑物
        const buildingPool = BuildingPool.getInstance();
        let eagleNest: Node | null = null;
        if (buildingPool) {
            const stats = buildingPool.getStats();
            if (!stats['EagleNest']) {
                buildingPool.registerPrefab('EagleNest', this.eagleNestPrefab);
            }
            eagleNest = buildingPool.get('EagleNest');
        }

        if (!eagleNest) {
            eagleNest = instantiate(this.eagleNestPrefab);
        }

        // 设置父节点
        const parent = this.eagleNestContainer || this.node;
        if (parent && !parent.active) {
            parent.active = true;
        }

        eagleNest.setParent(parent);
        eagleNest.active = true;
        eagleNest.setPosition(0, 0, 0);
        eagleNest.setRotationFromEuler(0, 0, 0);
        eagleNest.setScale(1, 1, 1);
        eagleNest.setWorldPosition(worldPosition);

        const eagleNestScript = eagleNest.getComponent('EagleNest') as any;
        if (eagleNestScript) {
            eagleNestScript.prefabName = 'EagleNest';

            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                (configManager as any).applyConfigToUnit?.('EagleNest', eagleNestScript, ['buildCost']);
            }

            const talentEffectManager = TalentEffectManager.getInstance();
            talentEffectManager.applyUnitEnhancements('EagleNest', eagleNestScript);
            talentEffectManager.applyTalentEffects(eagleNestScript);

            eagleNestScript.buildCost = actualCost;

            // 记录网格位置并标记占用
            if (this.gridPanel) {
                const grid = this.gridPanel.worldToGrid(worldPosition);
                if (grid) {
                    eagleNestScript.gridX = grid.x;
                    eagleNestScript.gridY = grid.y;
                    this.gridPanel.occupyGrid(grid.x, grid.y, eagleNest);
                }
            }

            if (this.gameManager) {
                const unitType = eagleNestScript.unitType || 'EagleNest';
                this.gameManager.checkUnitFirstAppearance(unitType, eagleNestScript);
            }
        }

        const analytics = AnalyticsManager.getInstance();
        if (analytics && this.gameManager) {
            analytics.recordOperation(
                OperationType.BUILD_EAGLE_NEST,
                this.gameManager.getGameTime(),
                { position: { x: eagleNestScript?.gridX, y: eagleNestScript?.gridY } }
            );
        }
    }

    // 可以通过按钮调用
    onBuildButtonClick() {
        if (!this.gameManager) {
            this.findGameManager();
        }
        if (this.gameManager && typeof (this.gameManager as any).tryResumeForLevel1BuildHutTutorial === 'function') {
            (this.gameManager as any).tryResumeForLevel1BuildHutTutorial();
        }

        // 检查warAncientTreePrefab是否设置
        if (!this.warAncientTreePrefab) {
            return;
        }
        
        // 检查targetCrystal是否设置
        if (!this.targetCrystal) {
            this.targetCrystal = find('Crystal');
            if (!this.targetCrystal) {
                return;
            }
        }
        
        // 检查面板是否显示（更准确的判断）
        const isPanelVisible = this.buildingPanel && this.buildingPanel.node && this.buildingPanel.node.active;
        
        // 如果已经在建造模式且面板显示，切换为关闭建造模式
        if (this.isBuildingMode && isPanelVisible) {
            this.disableBuildingMode();
            return;
        }
        
        // 取消当前的单位选择（只清除UnitSelectionManager，不清除SelectionManager的多选）
        const unitSelectionManagerNode = find('UnitSelectionManager');
        if (unitSelectionManagerNode) {
            const unitSelectionManager = unitSelectionManagerNode.getComponent(UnitSelectionManager);
            if (unitSelectionManager) {
                unitSelectionManager.clearSelection();
            }
        }
        
        this.enableBuildingMode();
        this.updateRefreshButtonState();

        if (this.gameManager && typeof (this.gameManager as any).notifyLevel1BuildHutTutorialAfterBuildPanelOpened === 'function') {
            (this.gameManager as any).notifyLevel1BuildHutTutorialAfterBuildPanelOpened();
        }
    }
    
    /**
     * 获取指定位置的建筑物
     */
    getBuildingAtPosition(worldPos: Vec3): Node | null {
        // 检查所有建筑物容器
        const containers = [
            this.warAncientTreeContainer,
            this.hunterHallContainer,
            this.swordsmanHallContainer,
            this.mageTowerContainer,
            this.eagleNestContainer,
            this.stoneWallContainer,
            this.churchContainer
        ];

        for (const container of containers) {
            if (!container) continue;
            
            for (const child of container.children) {
                if (!child.active) continue;
                
                // 检查建筑物是否在点击位置附近（考虑碰撞半径，使用平方距离）
                const cp = child.worldPosition;
                const bdx = worldPos.x - cp.x, bdy = worldPos.y - cp.y, bdz = worldPos.z - cp.z;
                if (bdx * bdx + bdy * bdy + bdz * bdz < 50 * 50) { // 50像素的点击范围
                    return child;
                }
            }
        }

        // 兼容：角鹰兽栏在未创建 EagleNests 容器时曾挂在 TowerBuilder 节点下
        if (this.node && this.node.children?.length) {
            for (const child of this.node.children) {
                if (!child || !child.active || !child.getComponent('EagleNest')) continue;
                const cp = child.worldPosition;
                const bdx = worldPos.x - cp.x, bdy = worldPos.y - cp.y, bdz = worldPos.z - cp.z;
                if (bdx * bdx + bdy * bdy + bdz * bdz < 50 * 50) {
                    return child;
                }
            }
        }
        
        return null;
    }

    /**
     * 开始长按检测
     */
    startLongPressDetection(building: Node, touchLocation: { x: number; y: number }) {
        // 清除之前的长按检测状态
        this.cancelLongPressDetection();
        
        // 设置长按检测状态
        this.longPressBuilding = building;
        this.longPressStartTime = Date.now();
        this.longPressStartPos = new Vec3(touchLocation.x, touchLocation.y, 0);
        this.isLongPressActive = true;
        
                // 注意：不立即显示读条，等 0.5 秒后才显示
        // 使用 scheduleOnce 在 0.5 秒后显示读条指示器
        this.scheduleOnce(() => {
            if (this.isLongPressActive && this.longPressBuilding === building) {
                  //console.log('[TowerBuilder] 长按超过 0.5 秒，显示读条指示器');
                this.showLongPressIndicator(building);
            }
        }, 0.5);

        // 启动定时器检查长按时间（每 0.05 秒检查一次，持续检查直到达到阈值或取消）
        this.schedule(this.checkLongPress, 0.05);
        
    }

    /**
     * 取消长按检测
     */
    cancelLongPressDetection() {
        const prevBuilding = this.longPressBuilding;
        // 清除定时器
        this.unschedule(this.checkLongPress);
        this.isLongPressActive = false;
        this.longPressBuilding = null;
        this.longPressStartTime = 0;
        this.longPressStartPos = null;
        
        // 隐藏长按指示器
        this.hideLongPressIndicator();
        if (prevBuilding && prevBuilding.isValid) {
            (prevBuilding as any)._towerBuilderHandlingClick = false;
        }
    }

    /**
     * 检查长按是否达到阈值（定时器回调）
     */
    checkLongPress() {
        // 如果不在长按检测状态，直接返回
        if (!this.isLongPressActive || !this.longPressBuilding || !this.longPressStartTime) {
            return;
        }

        const currentTime = Date.now();
        const elapsedTime = (currentTime - this.longPressStartTime) / 1000; // 转换为秒
        const progress = Math.min(elapsedTime / this.longPressThreshold, 1.0);

        // 更新长按指示器的进度
        if (this.longPressIndicator && this.longPressIndicator.isValid) {
            this.updateLongPressIndicator(progress);
        }

        // 如果进度达到1.0，停止定时器并进入拖拽模式
        if (progress >= 1.0) {
            // 长按时间达到阈值，进入拖拽模式
            const building = this.longPressBuilding;
            // 先停止定时器，避免继续更新
            this.unschedule(this.checkLongPress);
            this.isLongPressActive = false;
            // 确保显示完整的圆环
            if (this.longPressIndicator && this.longPressIndicator.isValid) {
                this.updateLongPressIndicator(1.0);
            }
            // 清除长按检测状态（但不隐藏指示器，因为即将进入拖拽模式）
            this.longPressBuilding = null;
            this.longPressStartTime = 0;
            this.longPressStartPos = null;
            if (building && building.isValid) {
                (building as any)._towerBuilderHandlingClick = false;
            }
            // 进入拖拽模式
            this.startDraggingBuilding(building);
        }
    }

    /**
     * 显示建筑物信息面板
     */
    showBuildingInfoPanel(building: Node) {
          //console.log('[TowerBuilder] showBuildingInfoPanel called, building:', building.name, 'isValid:', building.isValid);
        if (!building || !building.isValid) {
            return;
        }

        // 确保长按检测已取消，避免定时器继续运行
        // 注意：这里不调用clearCurrentSelection，避免清除刚打开的信息面板
        if (this.isLongPressActive) {
            this.cancelLongPressDetection();
        }

        // 根据建筑物类型调用对应的showSelectionPanel方法
        const warAncientTree = building.getComponent(WarAncientTree);
          //console.log('[TowerBuilder] 获取 WarAncientTree 组件，结果:', warAncientTree != null);
        if (warAncientTree && warAncientTree.showSelectionPanel) {
            warAncientTree.showSelectionPanel();
            return;
        }

        const hunterHall = building.getComponent(HunterHall);
        if (hunterHall && hunterHall.showSelectionPanel) {
            hunterHall.showSelectionPanel();
            return;
        }

        const swordsmanHall = building.getComponent(SwordsmanHall);
        if (swordsmanHall && swordsmanHall.showSelectionPanel) {
            swordsmanHall.showSelectionPanel();
            return;
        }

        const mageTower = building.getComponent(MageTower);
        if (mageTower && mageTower.showSelectionPanel) {
            mageTower.showSelectionPanel();
            return;
        }

        const eagleNest = building.getComponent(EagleNest);
        if (eagleNest && eagleNest.showSelectionPanel) {
            eagleNest.showSelectionPanel();
            return;
        }

        const church = building.getComponent(Church);
        if (church && church.showSelectionPanel) {
            church.showSelectionPanel();
            return;
        }
        
        const stoneWall = building.getComponent(StoneWall);
        if (stoneWall && stoneWall.showSelectionPanel) {
            stoneWall.showSelectionPanel();
            return;
        }
        
    }

    /**
     * 显示长按指示器（旋转圆弧）
     */
    showLongPressIndicator(building: Node) {
        if (!building || !building.isValid) {
            return;
        }

        // 隐藏之前的指示器
        this.hideLongPressIndicator();

        // 创建指示器节点
        const indicator = new Node('LongPressIndicator');
        indicator.setParent(building);
        indicator.setPosition(0, 0, 0);

        // 添加UITransform
        const uiTransform = indicator.addComponent(UITransform);
        uiTransform.setContentSize(100, 100);

        // 创建Graphics组件用于绘制圆弧
        const graphics = indicator.addComponent(Graphics);
        
        // 设置初始进度为0
        this.updateLongPressIndicator(0, graphics);

        this.longPressIndicator = indicator;
    }

    /**
     * 更新长按指示器进度
     */
    updateLongPressIndicator(progress: number, graphics?: Graphics) {
        if (!this.longPressIndicator || !this.longPressIndicator.isValid) {
            return;
        }

        if (!graphics) {
            graphics = this.longPressIndicator.getComponent(Graphics);
        }

        if (!graphics) {
            return;
        }

        // 清除之前的绘制
        graphics.clear();

        // 设置绘制参数
        const radius = 50; // 圆弧半径
        const lineWidth = 5; // 线条宽度（稍微粗一点，更明显）
        const centerX = 0;
        const centerY = 0;

        // 确保进度在0-1之间
        const clampedProgress = Math.max(0, Math.min(1, progress));

        // 如果进度为0，不绘制任何内容
        if (clampedProgress <= 0) {
            return;
        }

        // 计算圆弧的起始角度和结束角度（使用弧度制）
        // 从顶部（-90度）开始，顺时针绘制
        const endAngle = -Math.PI / 2; // 从顶部开始（-90度 = -π/2）
        // 结束角度 = 起始角度 + 进度 * 360度（顺时针）
        // 当 progress = 0 时，endAngle = startAngle（不绘制）
        // 当 progress = 0.5 时，endAngle = startAngle + π（180度圆弧）
        // 当 progress = 1.0 时，endAngle = startAngle + 2π（360度，完整圆）
        const startAngle = endAngle + clampedProgress * Math.PI * 2;

        // 根据进度调整颜色（从蓝色渐变到红色）
        // 进度0-1时，颜色从蓝色(100, 200, 255)渐变到红色(255, 100, 100)
        const red = 100 + Math.floor(clampedProgress * 155);   // 100 -> 255
        const green = 200 - Math.floor(clampedProgress * 100); // 200 -> 100
        const blue = 255 - Math.floor(clampedProgress * 155); // 255 -> 100
        const colorAlpha = 150 + Math.floor(clampedProgress * 105); // 150-255
        graphics.strokeColor = new Color(red, green, blue, colorAlpha);
        graphics.lineWidth = lineWidth;

        // 绘制圆弧（从startAngle到endAngle，顺时针）
        // 当 progress = 0 时，startAngle == endAngle，不绘制（已提前返回）
        // 当 progress 增加时，endAngle 增加，圆弧延长
        // 当 progress = 1.0 时，endAngle = startAngle + 2π，绘制完整圆
        graphics.arc(centerX, centerY, radius, startAngle, endAngle, false);
        graphics.stroke();
        
        // 如果进度达到1.0，使用红色和更粗的线条重新绘制完整圆环
        if (clampedProgress >= 1.0) {
            graphics.strokeColor = new Color(255, 100, 100, 255); // 红色
            graphics.lineWidth = lineWidth + 1; // 稍微粗一点
            graphics.arc(centerX, centerY, radius, startAngle, endAngle, false);
            graphics.stroke();
        }
    }

    /**
     * 隐藏长按指示器
     */
    hideLongPressIndicator() {
        if (this.longPressIndicator && this.longPressIndicator.isValid) {
            this.longPressIndicator.destroy();
            this.longPressIndicator = null;
        }
    }

    /**
     * 开始拖拽建筑物
     */
    startDraggingBuilding(building: Node) {
        if (!this.gridPanel) {
            return;
        }

        // 隐藏长按指示器（如果还存在）
        this.hideLongPressIndicator();

        // 获取建筑物的原始网格位置
        const originalGrid = this.gridPanel.getBuildingGridPosition(building);
        if (!originalGrid) {
            return;
        }

        this.isDraggingBuilding = true;
        this.draggedBuilding = building;
        this.draggedBuildingOriginalGrid = originalGrid;
        this.level1TutorialDragLastGridKey = '';
        this.level1TutorialTargetReachedLogged = false;

        // 临时释放网格占用（拖拽时）
        this.gridPanel.releaseGrid(originalGrid.x, originalGrid.y);

        // 清除所有选择，避免出现多选框
        this.clearCurrentSelection();

        // 显示网格面板
        this.gridPanel.show();

    }

    /**
     * 结束拖拽建筑物
     */
    endDraggingBuilding(event: EventTouch) {
        
        // 如果不在拖拽状态，直接返回（避免重复处理）
        if (!this.isDraggingBuilding) {
            return;
        }
        
        if (!this.draggedBuilding || !this.gridPanel) {
            // 如果状态不正确，确保清除拖拽状态
            this.isDraggingBuilding = false;
            this.draggedBuilding = null!;
            this.draggedBuildingOriginalGrid = null;
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
            return;
        }

        // 获取触摸位置并转换为世界坐标
        const touchLocation = event.getLocation();
        
        const cameraNode = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
        if (!cameraNode) {
            this.cancelDraggingBuilding();
            return;
        }
        
        const camera = cameraNode.getComponent(Camera);
        if (!camera) {
            this.cancelDraggingBuilding();
            return;
        }

        // 将屏幕坐标转换为世界坐标
        const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
        const worldPos = new Vec3();
        camera.screenToWorld(screenPos, worldPos);
        worldPos.z = 0;

        // 判断是否是石墙
        const isStoneWall = this.draggedBuilding && this.draggedBuilding.getComponent(StoneWall) !== null;
        
        // 检查是否在网格内
        const isInGrid = this.gridPanel.isPositionInGrid(worldPos);
        if (!isInGrid) {
            // 石墙可以放置在网格外，其他建筑物必须在网格内
            if (!isStoneWall) {
                // 不在网格内，取消拖拽，恢复原位置
                this.cancelDraggingBuilding();
                return;
            }
            // 石墙不在网格内，直接使用世界坐标，不进行网格对齐
            // 对于石墙，直接移动到世界坐标位置
            this.draggedBuilding.setWorldPosition(worldPos);
            // 清除拖拽状态
            this.isDraggingBuilding = false;
            this.draggedBuilding = null!;
            this.draggedBuildingOriginalGrid = null;
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
            return;
        }
        

        // 获取最近的网格中心位置（确保对齐到格子中央）
        const gridCenter = this.gridPanel.getNearestGridCenter(worldPos);
        if (!gridCenter) {
            // 石墙可以放置在网格外，其他建筑物必须在网格内
            if (!isStoneWall) {
                // 无法获取网格中心，取消拖拽
                this.cancelDraggingBuilding();
                return;
            }
            // 石墙无法获取网格中心，直接使用世界坐标
            this.draggedBuilding.setWorldPosition(worldPos);
            // 清除拖拽状态
            this.isDraggingBuilding = false;
            this.draggedBuilding = null!;
            this.draggedBuildingOriginalGrid = null;
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
            return;
        }
        // 获取目标网格（使用对齐后的位置）
        const targetGrid = this.gridPanel.worldToGrid(gridCenter);
        if (!targetGrid) {
            // 石墙可以放置在网格外，其他建筑物必须在网格内
            if (!isStoneWall) {
                this.cancelDraggingBuilding();
                return;
            }
            // 石墙无法获取目标网格，直接使用世界坐标
            this.draggedBuilding.setWorldPosition(worldPos);
            // 清除拖拽状态
            this.isDraggingBuilding = false;
            this.draggedBuilding = null!;
            this.draggedBuildingOriginalGrid = null;
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
            return;
        }

        // 检查目标网格是否被其他建筑物占用
        const isOccupiedByOther = this.gridPanel.isGridOccupiedByOther(
            targetGrid.x, 
            targetGrid.y, 
            this.draggedBuilding
        );

        let merged = false;
        if (isOccupiedByOther) {
            // 目标位置有其他建筑物，交换位置
            // 注意：由于拖拽时已经释放了原始网格，所以需要通过网格单元格直接获取建筑物
            const gridCells = (this.gridPanel as any).gridCells;
            if (!gridCells || !gridCells[targetGrid.y]) {
                // 网格数据无效，恢复原位置
                this.cancelDraggingBuilding();
                return;
            }
            
            const cell = gridCells[targetGrid.y][targetGrid.x];
            const otherBuilding = cell ? cell.buildingNode : null;
            
            // 检查建筑物节点是否有效
            if (otherBuilding && otherBuilding.isValid && otherBuilding !== this.draggedBuilding) {
                // 叠加：同类型 + 同星级 的建筑可合并升星（最高3星）
                if (this.tryMergeBuildings(this.draggedBuilding, otherBuilding)) {
                    // 合并成功：无需交换位置；拖拽源建筑已被回收
                    merged = true;
                } else {
                // 使用保存的原始网格位置进行交换
                if (this.draggedBuildingOriginalGrid) {
                    this.swapBuildingsWithGrid(
                        this.draggedBuilding, 
                        this.draggedBuildingOriginalGrid.x, 
                        this.draggedBuildingOriginalGrid.y,
                        otherBuilding,
                        targetGrid.x,
                        targetGrid.y
                    );
                } else {
                    // 如果找不到原始位置，恢复原位置
                    this.cancelDraggingBuilding();
                    return;
                }
                }
            } else {
                // 找不到其他建筑物或建筑物已无效，恢复原位置
                this.cancelDraggingBuilding();
                return;
            }
        } else {
            // 目标位置为空，直接移动
            this.moveBuildingToGrid(this.draggedBuilding, targetGrid.x, targetGrid.y);
        }

        // 保存拖拽的建筑物节点引用（在清除状态前）
        // 合并成功时，拖拽源可能已回收，避免引用失效
        const buildingToDeselect = merged ? null : this.draggedBuilding;
        
        // 清除拖拽状态
        this.isDraggingBuilding = false;
        this.draggedBuilding = null!;
        this.draggedBuildingOriginalGrid = null;

        // 清除高亮
        this.gridPanel.clearHighlight();
        
        // 清除建筑物的选中状态
        this.clearCurrentSelection();
        
        // 如果建筑物节点仍然有效，直接清除其选中状态
        if (buildingToDeselect && buildingToDeselect.isValid) {
            // 直接清除UnitSelectionManager中该建筑物的选中状态
            const unitSelectionManagerNode = find('UnitSelectionManager');
            if (unitSelectionManagerNode) {
                const unitSelectionManager = unitSelectionManagerNode.getComponent(UnitSelectionManager);
                if (unitSelectionManager) {
                    // 检查该建筑物是否被选中
                    if (unitSelectionManager.isUnitSelected(buildingToDeselect)) {
                        unitSelectionManager.clearSelection();
                    }
                }
            }
        }
        
    }

    /**
     * 取消拖拽建筑物（恢复原位置）
     */
    cancelDraggingBuilding() {
        
        // 无论状态如何，都要清除拖拽状态，避免状态残留
        if (!this.isDraggingBuilding) {
            this.draggedBuilding = null!;
            this.draggedBuildingOriginalGrid = null;
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
            return;
        }
        
        if (!this.draggedBuilding || !this.gridPanel || !this.draggedBuildingOriginalGrid) {
            // 即使状态不正确，也要清除拖拽状态
            this.isDraggingBuilding = false;
            this.draggedBuilding = null!;
            this.draggedBuildingOriginalGrid = null;
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
            return;
        }

        // 保存拖拽的建筑物节点引用（在清除状态前）
        const buildingToDeselect = this.draggedBuilding;

        // 恢复原网格位置
        this.moveBuildingToGrid(
            this.draggedBuilding,
            this.draggedBuildingOriginalGrid.x,
            this.draggedBuildingOriginalGrid.y
        );

        // 清除拖拽状态
        this.isDraggingBuilding = false;
        this.draggedBuilding = null!;
        this.draggedBuildingOriginalGrid = null;

        // 清除高亮
        this.gridPanel.clearHighlight();
        
        // 清除建筑物的选中状态
        this.clearCurrentSelection();
        
        // 如果建筑物节点仍然有效，直接清除其选中状态
        if (buildingToDeselect && buildingToDeselect.isValid) {
            // 直接清除UnitSelectionManager中该建筑物的选中状态
            const unitSelectionManagerNode = find('UnitSelectionManager');
            if (unitSelectionManagerNode) {
                const unitSelectionManager = unitSelectionManagerNode.getComponent(UnitSelectionManager);
                if (unitSelectionManager) {
                    // 检查该建筑物是否被选中
                    if (unitSelectionManager.isUnitSelected(buildingToDeselect)) {
                        unitSelectionManager.clearSelection();
                    }
                }
            }
        }
    }

    /**
     * 移动建筑物到指定网格
     */
    moveBuildingToGrid(building: Node, gridX: number, gridY: number) {
        if (!this.gridPanel) {
            return;
        }

        // 获取目标世界坐标
        const targetWorldPos = this.gridPanel.gridToWorld(gridX, gridY);
        if (!targetWorldPos) {
            return;
        }

        // 获取建筑物脚本（不同建筑物类型有不同的脚本）
        const warAncientTree = building.getComponent(WarAncientTree);
        const hunterHall = building.getComponent(HunterHall);
        const church = building.getComponent(Church);

        // 更新网格占用
        const oldGrid = this.gridPanel.getBuildingGridPosition(building);
        if (oldGrid) {
            this.gridPanel.releaseGrid(oldGrid.x, oldGrid.y);
        }
        this.gridPanel.occupyGrid(gridX, gridY, building);

        // 更新建筑物位置和网格坐标
        if (warAncientTree) {
            warAncientTree.gridX = gridX;
            warAncientTree.gridY = gridY;
            if (warAncientTree.moveToGridPosition) {
                warAncientTree.moveToGridPosition(gridX, gridY);
            } else {
                building.setWorldPosition(targetWorldPos);
            }
        } else if (hunterHall) {
            hunterHall.gridX = gridX;
            hunterHall.gridY = gridY;
            if (hunterHall.moveToGridPosition) {
                hunterHall.moveToGridPosition(gridX, gridY);
            } else {
                building.setWorldPosition(targetWorldPos);
            }
        } else if (church) {
            church.gridX = gridX;
            church.gridY = gridY;
            if (church.moveToGridPosition) {
                church.moveToGridPosition(gridX, gridY);
            } else {
                building.setWorldPosition(targetWorldPos);
            }
        } else {
            // 如果没有找到脚本，直接设置位置
            building.setWorldPosition(targetWorldPos);
        }

    }

    /**
     * 交换两个建筑物的位置（使用已知的网格位置）
     */
    swapBuildingsWithGrid(
        building1: Node, 
        grid1X: number, 
        grid1Y: number,
        building2: Node,
        grid2X: number,
        grid2Y: number
    ) {
        if (!this.gridPanel) {
            return;
        }

        // 检查建筑物节点是否有效
        if (!building1 || !building1.isValid || !building2 || !building2.isValid) {
            return;
        }

        // 获取目标世界坐标
        const targetWorldPos1 = this.gridPanel.gridToWorld(grid2X, grid2Y);
        const targetWorldPos2 = this.gridPanel.gridToWorld(grid1X, grid1Y);
        
        if (!targetWorldPos1 || !targetWorldPos2) {
            return;
        }

        // 获取建筑物脚本（在节点有效的情况下）
        const warAncientTree1 = building1.isValid ? building1.getComponent(WarAncientTree) : null;
        const hunterHall1 = building1.isValid ? building1.getComponent(HunterHall) : null;
        const church1 = building1.isValid ? building1.getComponent(Church) : null;

        const warAncientTree2 = building2.isValid ? building2.getComponent(WarAncientTree) : null;
        const hunterHall2 = building2.isValid ? building2.getComponent(HunterHall) : null;
        const church2 = building2.isValid ? building2.getComponent(Church) : null;

        // 先释放两个网格
        this.gridPanel.releaseGrid(grid1X, grid1Y);
        this.gridPanel.releaseGrid(grid2X, grid2Y);
        
        // 交换占用
        this.gridPanel.occupyGrid(grid2X, grid2Y, building1);
        this.gridPanel.occupyGrid(grid1X, grid1Y, building2);

        // 更新建筑物1的位置和网格坐标
        if (warAncientTree1) {
            warAncientTree1.gridX = grid2X;
            warAncientTree1.gridY = grid2Y;
            if (warAncientTree1.moveToGridPosition) {
                warAncientTree1.moveToGridPosition(grid2X, grid2Y);
            } else {
                building1.setWorldPosition(targetWorldPos1);
            }
        } else if (hunterHall1) {
            hunterHall1.gridX = grid2X;
            hunterHall1.gridY = grid2Y;
            if (hunterHall1.moveToGridPosition) {
                hunterHall1.moveToGridPosition(grid2X, grid2Y);
            } else {
                building1.setWorldPosition(targetWorldPos1);
            }
        } else if (church1) {
            church1.gridX = grid2X;
            church1.gridY = grid2Y;
            if (church1.moveToGridPosition) {
                church1.moveToGridPosition(grid2X, grid2Y);
            } else {
                building1.setWorldPosition(targetWorldPos1);
            }
        } else {
            building1.setWorldPosition(targetWorldPos1);
        }

        // 更新建筑物2的位置和网格坐标
        if (warAncientTree2) {
            warAncientTree2.gridX = grid1X;
            warAncientTree2.gridY = grid1Y;
            if (warAncientTree2.moveToGridPosition) {
                warAncientTree2.moveToGridPosition(grid1X, grid1Y);
            } else {
                building2.setWorldPosition(targetWorldPos2);
            }
        } else if (hunterHall2) {
            hunterHall2.gridX = grid1X;
            hunterHall2.gridY = grid1Y;
            if (hunterHall2.moveToGridPosition) {
                hunterHall2.moveToGridPosition(grid1X, grid1Y);
            } else {
                building2.setWorldPosition(targetWorldPos2);
            }
        } else if (church2) {
            church2.gridX = grid1X;
            church2.gridY = grid1Y;
            if (church2.moveToGridPosition) {
                church2.moveToGridPosition(grid1X, grid1Y);
            } else {
                building2.setWorldPosition(targetWorldPos2);
            }
        } else {
            building2.setWorldPosition(targetWorldPos2);
        }

    }

    /**
     * 交换两个建筑物的位置（通过查找网格位置）
     */
    swapBuildings(building1: Node, building2: Node) {
        if (!this.gridPanel) {
            return;
        }

        // 获取两个建筑物的网格位置
        const grid1 = this.gridPanel.getBuildingGridPosition(building1);
        const grid2 = this.gridPanel.getBuildingGridPosition(building2);

        if (!grid1 || !grid2) {
            return;
        }

        // 使用已知网格位置进行交换
        this.swapBuildingsWithGrid(building1, grid1.x, grid1.y, building2, grid2.x, grid2.y);
    }

    /**
     * 取消当前的单位选择
     */
    clearCurrentSelection() {
        
        // 清除UnitSelectionManager的选择
        const unitSelectionManagerNode = find('UnitSelectionManager');
        if (unitSelectionManagerNode) {
            const unitSelectionManager = unitSelectionManagerNode.getComponent(UnitSelectionManager);
            if (unitSelectionManager) {
                unitSelectionManager.clearSelection();
            } else {
            }
        } else {
            // 如果找不到UnitSelectionManager节点，尝试在场景中查找组件
            const scene = this.node.scene;
            if (scene) {
                const unitSelectionManager = scene.getComponentInChildren(UnitSelectionManager);
                if (unitSelectionManager) {
                    unitSelectionManager.clearSelection();
                } else {
                }
            }
        }
        
        // 清除SelectionManager的选择（管理防御塔的选择）
        const selectionManagerNode = find('SelectionManager');
        if (selectionManagerNode) {
            const selectionManager = selectionManagerNode.getComponent('SelectionManager') as any;
            if (selectionManager) {
                if (selectionManager.clearSelection) {
                    selectionManager.clearSelection();
                }
            }
        } else {
            // 如果找不到SelectionManager节点，尝试在场景中查找组件
            const scene = this.node.scene;
            if (scene) {
                const selectionManager = scene.getComponentInChildren('SelectionManager') as any;
                if (selectionManager && selectionManager.clearSelection) {
                    selectionManager.clearSelection();
                }
            }
        }
        
    }
    
    /**
     * 从配置文件中获取建造成本
     * @param unitId 单位ID
     * @returns 建造成本，如果配置不存在则返回0
     */
    private getBuildCostFromConfig(unitId: string): number {
        const configManager = UnitConfigManager.getInstance();
        if (!configManager.isConfigLoaded()) {
            return 0;
        }
        
        const config = configManager.getUnitConfig(unitId);
        if (config && config.baseStats && config.baseStats.buildCost !== undefined) {
            return config.baseStats.buildCost;
        }
        
        return 0;
    }

    /**
     * 获取实际建造成本（考虑单位卡片强化减少）
     * @param unitId 单位ID
     * @param baseCost 基础建造成本（如果为0或未提供，则从配置文件读取）
     * @returns 实际建造成本
     */
    public getActualBuildCost(unitId: string, baseCost?: number): number {
        // 如果未提供baseCost或为0，从配置文件读取
        let actualBaseCost = baseCost || 0;
        if (actualBaseCost === 0) {
            actualBaseCost = this.getBuildCostFromConfig(unitId);
        }
        
        const playerDataManager = PlayerDataManager.getInstance();
        const enhancement = playerDataManager.getUnitEnhancement(unitId);
        
        if (enhancement && enhancement.enhancements && enhancement.enhancements.buildCost !== undefined) {
            // buildCost 是负数，表示减少的成本
            const costReduction = enhancement.enhancements.buildCost;
            const actualCost = Math.max(1, actualBaseCost + costReduction); // 最少1金币
            return actualCost;
        }
        
        return actualBaseCost;
    }
}

