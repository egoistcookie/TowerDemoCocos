import { _decorator, SpriteFrame, Prefab, Texture2D, AudioClip, Node, Vec3, find, Sprite } from 'cc';
import { GameState } from '../GameState';
import { getEnemyLikeScript } from '../EnemyScriptLookup';
import { StoneWallGridPanel } from '../StoneWallGridPanel';
import { UnitManager } from '../UnitManager';
import { Role } from './Role';
import { AudioManager } from '../AudioManager';
import { UnitInfo } from '../UnitInfoPanel';
import { GamePopup } from '../GamePopup';
const { ccclass, property } = _decorator;

@ccclass('ElfSwordsman')
export class ElfSwordsman extends Role {
    // 重写父类属性，设置 ElfSwordsman 的默认值
    @property({ override: true })
    maxHealth: number = 200;

    @property({ override: true })
    attackRange: number = 60; // 近战攻击范围

    @property({ override: true })
    attackDamage: number = 10;

    @property({ override: true })
    attackInterval: number = 1.0;

    @property({ type: Prefab, override: true })
    bulletPrefab: Prefab = null!;

    @property({ type: Prefab, override: true })
    explosionEffect: Prefab = null!;

    @property({ type: Prefab, override: true })
    damageNumberPrefab: Prefab = null!;

    @property({ override: true })
    buildCost: number = 5; // 建造成本（用于回收和升级）
    
    @property({ override: true })
    level: number = 1; // 精灵剑士等级

    // 攻击动画相关属性
    @property({ type: SpriteFrame, override: true })
    attackAnimationFrames: SpriteFrame[] = []; // 攻击动画帧数组（推荐：在编辑器中手动设置）
    
    // 被攻击动画相关属性
    @property({ type: SpriteFrame, override: true })
    hitAnimationFrames: SpriteFrame[] = []; // 被攻击动画帧数组
    
    // 死亡动画相关属性
    @property({ type: SpriteFrame, override: true })
    deathAnimationFrames: SpriteFrame[] = []; // 死亡动画帧数组
    
    // 音效相关属性
    @property({ type: AudioClip })
    attackSound: AudioClip = null!; // 近战攻击时的音效（ElfSwordsman 特有）
    
    @property({ type: AudioClip, override: true })
    hitSound: AudioClip = null!; // 攻击击中敌人时的音效

    @property({ type: Texture2D, override: true })
    attackAnimationTexture: Texture2D = null!; // 攻击动画纹理（12帧图片）

    @property({ override: true })
    framesPerRow: number = 12; // 每行帧数（横向排列为12，3x4网格为3，4x3网格为4）

    @property({ override: true })
    totalFrames: number = 12; // 总帧数

    @property({ override: true })
    attackAnimationDuration: number = 0.5; // 攻击动画时长（秒）
    
    @property({ override: true })
    hitAnimationDuration: number = 0.3; // 被攻击动画时长（秒）
    
    @property({ override: true })
    deathAnimationDuration: number = 1.0; // 死亡动画时长（秒）

    // 移动相关属性
    @property({ override: true })
    moveSpeed: number = 100; // 移动速度（像素/秒）

    @property({ type: SpriteFrame, override: true })
    moveAnimationFrames: SpriteFrame[] = []; // 移动动画帧数组（可选）

    @property({ override: true })
    moveAnimationDuration: number = 0.3; // 移动动画时长（秒）

    @property({ override: true })
    collisionRadius: number = 10; // 碰撞半径（像素）

    @property({ override: true })
    protected topScreenMargin: number = -40; // 剑士顶部安全边距-40，允许移动到更高Y位置以到达传送门

    @property({ type: SpriteFrame, override: true })
    cardIcon: SpriteFrame = null!; // 单位名片图片
    
    // 单位信息属性
    @property({ override: true })
    unitName: string = "剑士";
    
    @property({ override: true })
    unitDescription: string = "近战攻击单位，使用剑进行近距离战斗。";
    
    @property({ type: SpriteFrame, override: true })
    unitIcon: SpriteFrame = null!;

    // === 磨剑小游戏资源（由 GameManager 在弹窗内触发/结算） ===
    @property({ type: [SpriteFrame] })
    swordSharpenFrames: SpriteFrame[] = []; // 磨剑动画序列帧（建议从“钝”到“锋利”）

    @property({ type: AudioClip })
    swordSharpenSound: AudioClip = null!; // 每次磨剑点击音效

    @property({ type: SpriteFrame })
    swordSharpenMoodExcellentIcon: SpriteFrame = null!; // 结算-最佳情绪图

    @property({ type: SpriteFrame })
    swordSharpenMoodGoodIcon: SpriteFrame = null!; // 结算-一般情绪图

    @property({ type: SpriteFrame })
    swordSharpenMoodBadIcon: SpriteFrame = null!; // 结算-最差情绪图

    /** 造墙读条序列帧（沿用原编辑器字段名 repairAnimationFrames） */
    @property({ type: [SpriteFrame] })
    repairAnimationFrames: SpriteFrame[] = [];

    /** 造墙读条动画默认时长（秒）；实际读条以 autoStoneWallChannelSec 为准传入 */
    @property
    repairAnimationDuration: number = 2.0;

    /** 造墙读条期间音效（字段名沿用 repairSound） */
    @property({
        type: AudioClip,
        displayName: '造墙读条音效',
        tooltip: '自动造墙读条动画期间播放',
    })
    repairSound: AudioClip | null = null;

    /** 站在石墙网格内且上方格空闲时，自动读条建造石墙（参考弓箭手陷阱） */
    @property
    autoStoneWallEnabled: boolean = true;

    /** 无战斗目标时累计多久可尝试自动造墙（秒） */
    @property
    autoStoneWallIdleThresholdSec: number = 3.0;

    /** 造墙读条时长（秒），与读条序列帧时长一致 */
    @property
    autoStoneWallChannelSec: number = 2.0;

    /** @deprecated 已不再参与逻辑；空闲仅由 autoStoneWallIdleThresholdSec 与每帧累加控制 */
    @property
    autoStoneWallCheckIntervalSec: number = 1.5;

    /** 完成后冷却，避免连续触发（秒） */
    @property
    autoStoneWallCooldownSec: number = 2.0;

    /**
     * 相对当前格的「上方」网格 Y 偏移（+1 通常对应屏幕 Y 更大的一侧，与关卡一致时可改为 -1）
     */
    @property
    autoStoneWallGridDeltaY: number = 1;

    /** 造墙读条序列帧动画是否正在播放 */
    private _isPlayingSwordsmanRepairAnimation: boolean = false;

    /** 石墙网格面板缓存 */
    private _cachedStoneWallGridPanel: StoneWallGridPanel | null = null;

    /** 自动造墙决策节流计时器 */
    private _autoStoneWallThrottleTimer: number = 0;

    /** 防线模式下：在网格内被网格外敌人合法击中且无石墙遮挡时，允许追击该敌人（跨出防线） */
    private _wallDefenseRetaliationEnemy: Node | null = null;

    /** 造墙读条序列帧 schedule，便于打断时 unschedule */
    private _repairChannelAnimUpdate: ((dt: number) => void) | null = null;

    /** 是否正在自动造墙读条中 */
    private _isAutoBuildingStoneWall: boolean = false;
    /** 造墙读条计时器（秒） */
    private _stoneWallBuildTimer: number = 0;
    /** 待建造的网格坐标（造墙读条完成后在此格放置石墙） */
    private _pendingStoneWallCell: { x: number; y: number } | null = null;
    /** 造墙空闲累计计时器（秒） */
    private _stoneWallIdleTimer: number = 0;
    /** 造墙完成后冷却计时器（秒） */
    private _stoneWallCooldownTimer: number = 0;

    /** 空闲达标后对「含友方占位」全量检测的节流（秒） */
    private _autoStoneWallHeavyThrottleTimer: number = 0;

    /** 当前磨剑带来的伤害倍率（只作用于本实例；不做叠加，直接覆盖） */
    public swordSharpenDamageMultiplier: number = 1.0;
    /** 磨剑前基准攻击间隔（对象池复用时在 onEnable 重置） */
    private swordSharpenAttackIntervalBase: number = 0;
    /** 磨剑前基准攻击力（对象池复用时在 onEnable 重置） */
    private swordSharpenAttackDamageBase: number = 0;

    /** 对象池激活时初始化剑士专属状态 */
    onEnable() {
        // 先让父类完成对象池激活、天赋/卡片增幅等初始化
        // @ts-ignore
        super.onEnable?.();

        // 对象池复用时重置磨剑相关基准，避免跨局/跨角色残留
        this.swordSharpenDamageMultiplier = 1.0;
        this.swordSharpenAttackIntervalBase = 0;
        this.swordSharpenAttackDamageBase = 0;

        this.cancelAutoStoneWallBuild('onEnable');
        this._wallDefenseRetaliationEnemy = null;
        this._autoStoneWallThrottleTimer = 0;
        this._autoStoneWallHeavyThrottleTimer = 0;
    }

    /**
     * 应用磨剑结算后的强化效果：攻击力与攻速（通过修改 attackInterval）
     * @param damageMultiplier 伤害倍率（如 1.25 表示 +25%）
     * @param speedPercent 攻速提升百分比（如 20 表示 +20%）
     */
    public applySwordSharpenBuff(damageMultiplier: number, speedPercent: number) {
        const dm = Number(damageMultiplier);
        this.swordSharpenDamageMultiplier = Number.isFinite(dm) && dm > 0 ? dm : 1.0;

        const sp = Math.max(0, Number(speedPercent) || 0);
        const speedMultiplier = 1 + sp / 100;

        // 基准只记录一次：后续结算直接覆盖到同一基准之上（不叠加）
        if (this.swordSharpenAttackIntervalBase <= 0) {
            this.swordSharpenAttackIntervalBase = this.attackInterval || 1;
        }
        if (this.swordSharpenAttackDamageBase <= 0) {
            this.swordSharpenAttackDamageBase = this.attackDamage || 0;
        }

        // 直接把增幅写进单位属性：攻击力/攻速面板都会体现（符合“直接增加到攻击力/攻击速度”）
        this.attackDamage = Math.max(0, Math.round((this.swordSharpenAttackDamageBase || 0) * this.swordSharpenDamageMultiplier));
        this.attackInterval = (this.swordSharpenAttackIntervalBase || 1) / speedMultiplier;

        // 让攻速提升尽快生效：重新开始计时
        this.attackTimer = 0;
    }

    /** 剑士战斗口号列表（造墙触发时随机播放） */
    battleSlogans: string[] = ['Excalibur！', '我可以这样打上一百天！', '要上了！', '以此剑为誓！', '没吃饱饭？', '用点力！'];

    /** 磨剑技能冷却时间（毫秒，全体剑士共享） */
    private readonly SWORD_SHARPEN_SKILL_COOLDOWN_MS: number = 30_000;

    /**
     * 重写索敌范围，索敌范围为攻击范围的8倍（特殊处理）
     */
    protected getDetectionRange(): number {
        return this.attackRange * 8; // 8倍攻击范围用于检测（ElfSwordsman 特殊处理）
    }

    /**
     * 重写移动范围，移动范围为攻击范围的8倍（与索敌范围一致）
     */
    protected getMovementRange(): number {
        return this.attackRange * 8; // 8倍攻击范围用于移动（ElfSwordsman 特殊处理）
    }

    /** 判断敌人是否站在石墙网格上（用于防线模式过滤） */
    private isEnemyOnStoneWallGrid(enemy: Node): boolean {
        const panel = this.getStoneWallGridPanel();
        if (!panel?.node?.isValid) {
            return false;
        }
        return panel.worldToGrid(enemy.worldPosition) !== null;
    }

    /** 仅当脚下在石墙战场格子内（不含「网格下方待命带」） */
    private isSwordsmanStrictlyOnStoneWallGridCells(): boolean {
        const panel = this.getStoneWallGridPanel();
        if (!panel?.node?.isValid) {
            return false;
        }
        return panel.worldToGrid(this.node.worldPosition) !== null;
    }

    /** 记录反击敌人：当剑士被网格外敌人攻击且路径被石墙阻挡时登记为目标 */
    private tryRegisterWallDefenseRetaliation(attacker: Node | null): void {
        if (!attacker?.isValid || !attacker.active) {
            return;
        }
        if (!this.isAliveEnemy(attacker)) {
            return;
        }
        const enemyCombat = getEnemyLikeScript(attacker);
        if (enemyCombat && enemyCombat.isFlying === true) {
            return;
        }
        if (!this.isSwordsmanStrictlyOnStoneWallGridCells()) {
            return;
        }
        if (this.isEnemyOnStoneWallGrid(attacker)) {
            return;
        }
        this._wallDefenseRetaliationEnemy = attacker;
        if (this.canSeekAndFightEnemy()) {
            this.currentTarget = attacker;
            this.targetFindTimer = 0;
        }
    }

    /** 受击时触发防线反击：登记攻击者为优先追击目标 */
    protected onReceivedDamage(finalDamage: number, hitDirection?: Vec3, damageSource?: Node | null): void {
        super.onReceivedDamage(finalDamage, hitDirection, damageSource);
        if (finalDamage <= 0) {
            return;
        }
        this.tryRegisterWallDefenseRetaliation(damageSource ?? null);
    }

    /** 索敌列表增强：将反击目标追加到列表末尾（如尚未在列表中） */
    protected amendEnemiesForFindTarget(enemies: Node[]): Node[] {
        const r = this._wallDefenseRetaliationEnemy;
        if (!r?.isValid || !r.active || !this.isAliveEnemy(r)) {
            return enemies;
        }
        if (enemies.indexOf(r) >= 0) {
            return enemies;
        }
        return [...enemies, r];
    }

    /**
     * 索敌列表过滤：仅当剑士双脚站在石墙网格格子内（不含网格下方待命带）时，只保留已进入网格的敌人。
     * 待命带上的敌人 worldToGrid 为 null，若对该区域也过滤会导致无法近战。
     */
    protected filterEnemiesForFindTarget(enemies: Node[]): Node[] {
        if (!this.isSwordsmanStrictlyOnStoneWallGridCells()) {
            return enemies;
        }
        return enemies.filter((e) => e && e.isValid && e.active && this.isEnemyOnStoneWallGrid(e));
    }

    /** 同上：仅在站在网格格子内时丢弃「已离开网格」的目标（反击登记目标除外） */
    private clearCurrentTargetIfWallDefenseRuleViolated(): void {
        if (!this.isSwordsmanStrictlyOnStoneWallGridCells()) {
            return;
        }
        const t = this.currentTarget;
        if (!t || !t.isValid || !t.active) {
            return;
        }
        if (this.isEnemyOnStoneWallGrid(t)) {
            return;
        }
        if (t === this._wallDefenseRetaliationEnemy && this.isAliveEnemy(t)) {
            return;
        }
        this.currentTarget = null!;
    }

    /** 清理反击引用：敌人回到网格/死亡/失效时清除反击登记 */
    private pruneWallDefenseRetaliationRef(): void {
        const r = this._wallDefenseRetaliationEnemy;
        if (!r) {
            return;
        }
        if (r.isValid && r.active && this.isEnemyOnStoneWallGrid(r)) {
            this._wallDefenseRetaliationEnemy = null;
            return;
        }
        if (!r.isValid || !r.active || !this.isAliveEnemy(r)) {
            if (this.currentTarget === r) {
                this.currentTarget = null!;
            }
            this._wallDefenseRetaliationEnemy = null;
        }
    }

    /** 判断当前是否允许索敌/攻击（防卫模式始终允许；造墙读条禁止） */
    protected canSeekAndFightEnemy(): boolean {
        if (this.isDefending) {
            return true;
        }
        return !this._isAutoBuildingStoneWall;
    }

    /** 造墙读条期间禁止受击动画，避免 sprite 抢帧 */
    protected shouldPlayHitAnimationOnDamage(): boolean {
        return !this._isAutoBuildingStoneWall;
    }

    protected shouldBlockIdleAnimation(): boolean {
        if (this._isAutoBuildingStoneWall) {
            return true;
        }
        if (this._isPlayingSwordsmanRepairAnimation) {
            return true;
        }
        return false;
    }

    /** 停止移动时保留造墙读条序列帧 sprite，避免被父类恢复为待机精灵 */
    protected shouldPreserveSpriteOnStopMove(): boolean {
        if (this._isAutoBuildingStoneWall) {
            return (
                this._isPlayingSwordsmanRepairAnimation ||
                (this._stoneWallBuildTimer > 0 && this._stoneWallBuildTimer < this.autoStoneWallChannelSec)
            );
        }
        return false;
    }

    /** 每帧更新：自动造墙决策 + 读条 + 防线反击清理 → 父类 update */
    update(deltaTime: number) {
        if (this.isDestroyed) {
            this.cancelAutoStoneWallBuild('destroyed');
            super.update(deltaTime);
            return;
        }

        if (this._isAutoBuildingStoneWall && !this.isDefending) {
            this.tickAutoStoneWallChannel(deltaTime);
            return;
        }

        if (!this.isDestroyed && !this.isDefending) {
            this.tickAutoStoneWallDecision(deltaTime);
        }
        this.pruneWallDefenseRetaliationRef();
        this.clearCurrentTargetIfWallDefenseRuleViolated();
        super.update(deltaTime);
    }

    /** 手动移动目标：重置造墙/反击状态后调用父类 */
    setManualMoveTargetPosition(worldPos: Vec3) {
        this.cancelAutoStoneWallBuild('manual-move');
        this._wallDefenseRetaliationEnemy = null;
        super.setManualMoveTargetPosition(worldPos);
    }

    /** 获取 TowerBuilder 节点组件（用于造墙） */
    private findTowerBuilder(): any {
        const n = find('Canvas/TowerBuilder') || find('TowerBuilder');
        return n?.getComponent('TowerBuilder') as any ?? null;
    }

    /** 剑士当前脚底所在格是否为 (gx,gy)（仅网格整数坐标，无开方） */
    private isSwordsmanOnStoneWallGridCell(panel: StoneWallGridPanel, gx: number, gy: number): boolean {
        const g = panel.worldToGrid(this.node.worldPosition);
        return g !== null && g.x === gx && g.y === gy;
    }

    /** 石墙格子上是否有友方行走单位占位 */
    private isFriendlyWalkerOnStoneWallCell(panel: StoneWallGridPanel, gx: number, gy: number): boolean {
        // ⚠️ PERFORMANCE-CRITICAL: 遍历 UnitManager 获取所有友方单位（剑士/猎人/法师/箭塔/牧师），再逐个检测网格/距离
        if (this.isSwordsmanOnStoneWallGridCell(panel, gx, gy)) {
            return true;
        }
        const cellCenter = panel.gridToWorld(gx, gy);
        if (!cellCenter) {
            return false;
        }
        const selfNode = this.node;
        const selfR = Math.max(6, this.collisionRadius || 10);
        const walkers: Node[] = [];
        const um = UnitManager.getInstance();
        if (um) {
            walkers.push(...um.getElfSwordsmans(), ...um.getHunters(), ...um.getMages(), ...um.getTowers());
        }
        const priests = find('Canvas/Priests');
        if (priests) {
            walkers.push(...priests.children);
        }
        for (const n of walkers) {
            if (!n || n === selfNode || !n.isValid || !n.active) {
                continue;
            }
            const role = n.getComponent(Role) as Role | null;
            const otherR = role ? Math.max(6, role.collisionRadius || 10) : 10;
            const wp = n.worldPosition;
            const og = panel.worldToGrid(wp);
            if (og && og.x === gx && og.y === gy) {
                return true;
            }
            const dx = wp.x - cellCenter.x;
            const dy = wp.y - cellCenter.y;
            const threshold = selfR + otherR + 8;
            if (dx * dx + dy * dy < threshold * threshold) {
                return true;
            }
        }
        return false;
    }

    /**
     * 友方单位阻塞墙格时的可读原因（用于调试「空格却造不了」：是否误判自身网格/距离）
     */
    private getFriendlyWalkerBlockDetail(panel: StoneWallGridPanel, gx: number, gy: number): string | null {
        if (this.isSwordsmanOnStoneWallGridCell(panel, gx, gy)) {
            return 'self:worldToGrid与墙格相同(疑锚点/坐标换算)';
        }
        const cellCenter = panel.gridToWorld(gx, gy);
        if (!cellCenter) {
            return 'gridToWorld返回null';
        }
        const selfNode = this.node;
        const selfR = Math.max(6, this.collisionRadius || 10);
        const walkers: Node[] = [];
        const um = UnitManager.getInstance();
        if (um) {
            walkers.push(...um.getElfSwordsmans(), ...um.getHunters(), ...um.getMages(), ...um.getTowers());
        }
        const priests = find('Canvas/Priests');
        if (priests) {
            walkers.push(...priests.children);
        }
        for (const n of walkers) {
            if (!n || n === selfNode || !n.isValid || !n.active) {
                continue;
            }
            const role = n.getComponent(Role) as Role | null;
            const otherR = role ? Math.max(6, role.collisionRadius || 10) : 10;
            const wp = n.worldPosition;
            const og = panel.worldToGrid(wp);
            if (og && og.x === gx && og.y === gy) {
                return `unit:${n.name}:同格网格(${gx},${gy})`;
            }
            const dx = wp.x - cellCenter.x;
            const dy = wp.y - cellCenter.y;
            const threshold = selfR + otherR + 8;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dx * dx + dy * dy < threshold * threshold) {
                return `unit:${n.name}:距格心≈${dist.toFixed(1)}px<threshold≈${threshold.toFixed(1)}`;
            }
        }
        return null;
    }

    /**
     * 轻量探测：不占位遍历友方单位；用于每帧累加空闲时间。
     */
    private probeAutoStoneWallTargetCellCheap(panel: StoneWallGridPanel): {
        cell: { x: number; y: number } | null;
        reject: string | null;
        meta: Record<string, unknown>;
    } {
        const meta: Record<string, unknown> = {};
        const wp = this.node.worldPosition;
        const sg = panel.worldToGrid(wp);
        if (!sg) {
            meta.worldPos = { x: wp.x, y: wp.y, z: wp.z };
            return { cell: null, reject: 'self_not_in_stone_wall_grid', meta };
        }
        const dy = Math.trunc(this.autoStoneWallGridDeltaY) || 1;
        const tx = sg.x;
        const ty = sg.y + dy;
        meta.selfGrid = { x: sg.x, y: sg.y };
        meta.deltaY = dy;
        meta.targetGrid = { x: tx, y: ty };
        if (ty < 0 || ty >= panel.gridHeight || tx < 0 || tx >= panel.gridWidth) {
            return { cell: null, reject: 'target_out_of_bounds', meta };
        }
        if (panel.isGridOccupied(tx, ty)) {
            return { cell: null, reject: 'grid_occupied', meta };
        }
        if (panel.hasTrapAt(tx, ty)) {
            return { cell: null, reject: 'trap_on_cell', meta };
        }
        if (this.isSwordsmanOnStoneWallGridCell(panel, tx, ty)) {
            meta.hint = 'worldToGrid(自身)等于墙格，脚格与自我判定可能不一致';
            return { cell: null, reject: 'self_grid_equals_wall_cell', meta };
        }
        return { cell: { x: tx, y: ty }, reject: null, meta };
    }

    /** 全量探测（含友方占位）；reject 与 meta 用于调试日志 */
    private probeAutoStoneWallTargetCell(panel: StoneWallGridPanel): {
        cell: { x: number; y: number } | null;
        reject: string | null;
        meta: Record<string, unknown>;
    } {
        const base = this.probeAutoStoneWallTargetCellCheap(panel);
        if (!base.cell) {
            return base;
        }
        const walkerDetail = this.getFriendlyWalkerBlockDetail(panel, base.cell.x, base.cell.y);
        if (walkerDetail) {
            return {
                cell: null,
                reject: 'friendly_walker_blocks',
                meta: { ...base.meta, walkerDetail },
            };
        }
        return base;
    }

    /** 自动造墙决策：空闲超时 → 全量检测 → 启动造墙读条（空闲每帧累加，不再被 0.5s 节流锁死） */
    private tickAutoStoneWallDecision(deltaTime: number): void {
        if (!this.autoStoneWallEnabled) {
            return;
        }
        if (!this.gameManager) {
            this.findGameManager();
        }
        const gm = this.gameManager as any;
        if (gm?.getGameState && gm.getGameState() !== GameState.Playing) {
            this._stoneWallIdleTimer = 0;
            this._autoStoneWallHeavyThrottleTimer = 0;
            return;
        }
        if (this._stoneWallCooldownTimer > 0) {
            this._stoneWallCooldownTimer = Math.max(0, this._stoneWallCooldownTimer - deltaTime);
            return;
        }
        if (this.isDefending || this.manualMoveTarget) {
            this._stoneWallIdleTimer = 0;
            this._autoStoneWallHeavyThrottleTimer = 0;
            return;
        }
        if (this.hasAutoStoneWallCombatInterrupt()) {
            this._stoneWallIdleTimer = 0;
            this._autoStoneWallHeavyThrottleTimer = 0;
            return;
        }
        const panel = this.getStoneWallGridPanel();
        if (!panel?.node?.isValid) {
            return;
        }
        if (!panel.worldToGrid(this.node.worldPosition)) {
            this._stoneWallIdleTimer = 0;
            this._autoStoneWallHeavyThrottleTimer = 0;
            return;
        }

        const cheap = this.probeAutoStoneWallTargetCellCheap(panel);
        if (!cheap.cell) {
            this._stoneWallIdleTimer = 0;
            this._autoStoneWallHeavyThrottleTimer = 0;
            this._autoStoneWallThrottleTimer += deltaTime;
            if (this._autoStoneWallThrottleTimer >= 0.5) {
                this._autoStoneWallThrottleTimer = 0;
            }
            return;
        }

        this._stoneWallIdleTimer += deltaTime;

        if (this._stoneWallIdleTimer < this.autoStoneWallIdleThresholdSec) {
            this._autoStoneWallHeavyThrottleTimer = 0;
            return;
        }

        this._autoStoneWallHeavyThrottleTimer += deltaTime;
        if (this._autoStoneWallHeavyThrottleTimer < 0.5) {
            return;
        }
        this._autoStoneWallHeavyThrottleTimer = 0;

        const full = this.probeAutoStoneWallTargetCell(panel);
        if (!full.cell) {
            this._stoneWallIdleTimer = 0;
            return;
        }

        this.startAutoStoneWallBuild(full.cell);
    }

    /** 启动造墙：设置读条计时、清除移动/索敌状态、播放读条序列帧 */
    private startAutoStoneWallBuild(cell: { x: number; y: number }): void {
        this._isAutoBuildingStoneWall = true;
        this._stoneWallBuildTimer = 0;
        this._pendingStoneWallCell = { x: cell.x, y: cell.y };
        this._stoneWallIdleTimer = 0;

        this.stopIdleAnimationPlayback();
        this.currentTarget = null!;
        this.manualMoveTarget = null!;
        this.isManuallyControlled = false;
        this.autoRoamManualMoveActive = false;
        this.stopMoving();
        (this as any).isPlayingMoveAnimation = false;
        (this as any).isPlayingAttackAnimation = false;
        this.isMoving = false;

        const slogans = ['指挥官，吾善工事！', '吾善工事！'];
        this.createDialog(slogans[Math.floor(Math.random() * slogans.length)], false);

        const ch = Math.max(0.5, Number(this.autoStoneWallChannelSec) || 2);
        this.playSwordsmanRepairAnimation(ch, true);
        this.idleBlockTimer = Math.max(this.idleBlockTimer, ch + 0.25);
    }

    /** 造墙读条帧更新：计时器递增，读条完成时触发建造；中途被打断则取消 */
    private tickAutoStoneWallChannel(deltaTime: number): void {
        if (this.isDestroyed || !this.node?.isValid) {
            this.cancelAutoStoneWallBuild('destroyed');
            return;
        }
        if (!this.gameManager) {
            this.findGameManager();
        }
        const gm = this.gameManager as any;
        if (gm?.getGameState && gm.getGameState() !== GameState.Playing) {
            this.cancelAutoStoneWallBuild('paused');
            return;
        }
        if (this.manualMoveTarget) {
            this.cancelAutoStoneWallBuild('manual-path');
            super.update(deltaTime);
            return;
        }
        if (this.isDefending) {
            this.cancelAutoStoneWallBuild('defend');
            super.update(deltaTime);
            return;
        }

        this.currentTarget = null!;
        this.isMoving = false;
        (this as any).isPlayingMoveAnimation = false;
        (this as any).isPlayingAttackAnimation = false;

        const pendingCell = this._pendingStoneWallCell;
        const swPanel = this.getStoneWallGridPanel();
        // 必须仍站在「开始读条时脚下的格子」；误用 pending（墙格）会与锚点 worldToGrid 冲突导致读条被每帧取消
        const dy = Math.trunc(this.autoStoneWallGridDeltaY) || 1;
        const footGy = pendingCell ? pendingCell.y - dy : NaN;
        if (
            pendingCell &&
            swPanel?.node?.isValid &&
            Number.isFinite(footGy) &&
            !this.isSwordsmanOnStoneWallGridCell(swPanel, pendingCell.x, footGy)
        ) {
            const gNow = swPanel.worldToGrid(this.node.worldPosition);
            this.cancelAutoStoneWallBuild('left-foot-cell', {
                pendingWallGrid: { x: pendingCell.x, y: pendingCell.y },
                expectedFootGrid: { x: pendingCell.x, y: footGy },
                worldGridNow: gNow ? { x: gNow.x, y: gNow.y } : null,
            });
            super.update(deltaTime);
            return;
        }

        this._stoneWallBuildTimer += deltaTime;
        const ch = Math.max(0.5, Number(this.autoStoneWallChannelSec) || 2);
        if (this._stoneWallBuildTimer >= ch) {
            this.finishAutoStoneWallBuild();
        }
    }

    /** 读条完成，实际调用 TowerBuilder 建造石墙 */
    private finishAutoStoneWallBuild(): void {
        const pending = this._pendingStoneWallCell;
        const panel = this.getStoneWallGridPanel();
        const tb = this.findTowerBuilder();

        this._isAutoBuildingStoneWall = false;
        this._stoneWallBuildTimer = 0;
        this._pendingStoneWallCell = null;
        this.stopSwordsmanRepairAnimationChannel();

        if (!pending || !panel?.node?.isValid || !tb?.buildStoneWall) {
            this._stoneWallCooldownTimer = Math.max(this._stoneWallCooldownTimer, 1.0);
            return;
        }
        if (panel.isGridOccupied(pending.x, pending.y) || panel.hasTrapAt(pending.x, pending.y)) {
            this._stoneWallCooldownTimer = Math.max(this._stoneWallCooldownTimer, 1.0);
            return;
        }
        if (this.isFriendlyWalkerOnStoneWallCell(panel, pending.x, pending.y)) {
            this._stoneWallCooldownTimer = Math.max(this._stoneWallCooldownTimer, 1.0);
            return;
        }
        const wpos = panel.gridToWorld(pending.x, pending.y);
        if (!wpos) {
            this._stoneWallCooldownTimer = Math.max(this._stoneWallCooldownTimer, 1.0);
            return;
        }
        tb.buildStoneWall(wpos, true);
        this._stoneWallCooldownTimer = Math.max(
            this._stoneWallCooldownTimer,
            Number(this.autoStoneWallCooldownSec) || 2,
        );
    }

    /** 取消自动造墙：清除计时状态，进入冷却 */
    private cancelAutoStoneWallBuild(_reason: string, _extra?: Record<string, unknown>): void {
        void _reason;
        void _extra;
        if (!this._isAutoBuildingStoneWall) {
            return;
        }
        this._isAutoBuildingStoneWall = false;
        this._stoneWallBuildTimer = 0;
        this._pendingStoneWallCell = null;
        this.stopSwordsmanRepairAnimationChannel();
        this._stoneWallCooldownTimer = Math.max(this._stoneWallCooldownTimer, 1.0);
    }

    /** 停止造墙读条序列帧 schedule，恢复默认 sprite */
    private stopSwordsmanRepairAnimationChannel(): void {
        if (this._repairChannelAnimUpdate) {
            this.unschedule(this._repairChannelAnimUpdate);
            this._repairChannelAnimUpdate = null;
        }
        this._isPlayingSwordsmanRepairAnimation = false;
        if (this.sprite?.isValid && this.defaultSpriteFrame) {
            this.sprite.spriteFrame = this.defaultSpriteFrame;
        }
    }

    /** 获取石墙网格面板（带缓存，面板失效时自动重新查找） */
    private getStoneWallGridPanel(): StoneWallGridPanel | null {
        if (this._cachedStoneWallGridPanel && this._cachedStoneWallGridPanel.isValid) {
            return this._cachedStoneWallGridPanel;
        }
        const n = find('Canvas/StoneWallGridPanel') || find('StoneWallGridPanel');
        this._cachedStoneWallGridPanel = (n && n.getComponent('StoneWallGridPanel')) as StoneWallGridPanel | null;
        return this._cachedStoneWallGridPanel;
    }

    /**
     * 自动造墙专用的「战斗打断」：仅当敌人已在近战攻击距离内才视为无法空闲造墙。
     * 否则远处/索敌范围内的敌人会一直占用 currentTarget，导致永远无法累积造墙空闲时间。
     */
    private hasAutoStoneWallCombatInterrupt(): boolean {
        const t = this.currentTarget;
        if (!t || !t.isValid || !t.active) {
            return false;
        }
        if (t.getComponent && t.getComponent('Portal')) {
            return false;
        }
        if (!this.isAliveEnemy(t)) {
            return false;
        }
        const r = Math.max(1, this.attackRange || 0);
        const rsq = r * r;
        const dx = t.worldPosition.x - this.node.worldPosition.x;
        const dy = t.worldPosition.y - this.node.worldPosition.y;
        const dz = t.worldPosition.z - this.node.worldPosition.z;
        return dx * dx + dy * dy + dz * dz <= rsq;
    }

    /** 造墙读条音效（字段名沿用 repairSound） */
    private playRepairSfx(): void {
        if (!this.repairSound || !AudioManager.Instance) {
            return;
        }
        AudioManager.Instance.playSFX(this.repairSound);
    }

    /**
     * @param clipDuration 指定动画/读条时长（秒）；不传则用 repairAnimationDuration
     * @param playSfx 是否播放读条音效
     */
    private playSwordsmanRepairAnimation(clipDuration?: number, playSfx: boolean = true): boolean {
        // schedule(animationUpdate, 0) 每帧切换序列帧；自动造墙读条期间调用一次
        if (this._isPlayingSwordsmanRepairAnimation) {
            return false;
        }
        this.stopIdleAnimationPlayback();
        this.stopSwordsmanRepairAnimationChannel();
        if (!this.sprite) {
            this.sprite = this.node.getComponent(Sprite);
        }
        if (!this.sprite || !this.repairAnimationFrames?.length) {
            return false;
        }
        const frames = this.repairAnimationFrames.filter(f => f != null);
        if (!frames.length) {
            return false;
        }
        this.isPlayingIdleAnimation = false;
        const dur =
            clipDuration != null
                ? Math.max(0.5, clipDuration)
                : Math.max(2, Number(this.repairAnimationDuration) || 2);
        this.idleBlockTimer = Math.max(this.idleBlockTimer, dur + 0.2);
        this._isPlayingSwordsmanRepairAnimation = true;
        if (playSfx) {
            this.playRepairSfx();
        }
        const frameCount = frames.length;
        const frameDuration = Math.max(0.05, dur / frameCount);
        let animationTimer = 0;
        let lastFrameIndex = -1;
        if (frames[0]) {
            this.sprite.spriteFrame = frames[0];
            lastFrameIndex = 0;
        }
        const animationUpdate = (dt: number) => {
            if (!this.sprite?.isValid || this.isDestroyed) {
                this._isPlayingSwordsmanRepairAnimation = false;
                this._repairChannelAnimUpdate = null;
                this.unschedule(animationUpdate);
                return;
            }
            animationTimer += dt;
            if (animationTimer >= dur) {
                if (this.defaultSpriteFrame) {
                    this.sprite.spriteFrame = this.defaultSpriteFrame;
                }
                this._isPlayingSwordsmanRepairAnimation = false;
                this._repairChannelAnimUpdate = null;
                this.unschedule(animationUpdate);
                return;
            }
            const targetFrameIndex = Math.min(Math.floor(animationTimer / frameDuration), frameCount - 1);
            if (targetFrameIndex !== lastFrameIndex && frames[targetFrameIndex]) {
                this.sprite.spriteFrame = frames[targetFrameIndex];
                lastFrameIndex = targetFrameIndex;
            }
        };
        this._repairChannelAnimUpdate = animationUpdate;
        this.schedule(animationUpdate, 0);
        return true;
    }

    /**
     * 重写攻击方法，实现近战攻击
     */
    attack() {
        if (this._isAutoBuildingStoneWall) {
            return;
        }
        if (!this.currentTarget || this.isDestroyed) {
            return;
        }

        // 再次检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }

        // 攻击时停止移动
        this.stopMoving();

        // 检查目标是否是存活的敌人（或传送门）
        const portal = this.currentTarget.getComponent('Portal') as any;
        const isPortalAlive = portal && !portal.isDormantNow?.() && portal.currentHealth > 0;
        if (this.isAliveEnemy(this.currentTarget) || isPortalAlive) {
            // 播放攻击动画，动画完成后才进行近战攻击
            this.playAttackAnimation(() => {
                // 动画播放完成后的回调，在这里执行近战攻击
                this.executeAttack();
            });
        } else {
            // 目标已死亡，清除目标
            this.currentTarget = null!;
        }
    }

    /**
     * 构建剑士专用 UnitInfo（包含“磨剑”技能按钮）
     */
    public buildSwordsmanUnitInfo(): UnitInfo {
        // 计算升级费用：1到2级是10金币，此后每次升级多10金币
        const upgradeCost = this.level < 3 ? (10 + (this.level - 1) * 10) : undefined;

        const currentHealth = (this.currentHealth !== undefined && !isNaN(this.currentHealth) && this.currentHealth >= 0)
            ? this.currentHealth
            : (this.maxHealth || 0);
        const maxHealth = (this.maxHealth !== undefined && !isNaN(this.maxHealth) && this.maxHealth > 0)
            ? this.maxHealth
            : 0;

        const gm: any = this.gameManager;
        const remaining = gm && typeof gm.getSwordSharpenSkillGlobalCooldownRemainingSec === 'function'
            ? gm.getSwordSharpenSkillGlobalCooldownRemainingSec()
            : 0;

        const unitInfo: UnitInfo = {
            name: '剑士',
            level: this.level,
            currentHealth,
            maxHealth,
            attackDamage: this.attackDamage,
            populationCost: 1,
            icon: this.cardIcon || this.defaultSpriteFrame,
            collisionRadius: this.collisionRadius,
            attackRange: this.attackRange,
            attackFrequency: this.attackInterval ? 1.0 / this.attackInterval : 0,
            moveSpeed: this.moveSpeed,
            isDefending: this.isDefending,
            upgradeCost: upgradeCost,
            onUpgradeClick: this.level < 3 ? () => this.onUpgradeClick() : undefined,
            onSellClick: () => this.onSellClick(),
            onDefendClick: () => this.onDefendClick(),
            onSkillClick: undefined,
            onSkill2Click: () => this.onSwordSharpenSkillClick(),
            skill2CooldownTotalSec: this.SWORD_SHARPEN_SKILL_COOLDOWN_MS / 1000,
            skill2CooldownRemainingSec: remaining
        };

        return unitInfo;
    }

    /** 刷新单位信息面板（仅当剑士被选中时） */
    private refreshUnitInfoPanelIfSelected() {
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (!this.unitSelectionManager) return;
        if ((this.unitSelectionManager as any).isUnitSelected && !(this.unitSelectionManager as any).isUnitSelected(this.node)) {
            return;
        }
        const unitInfoPanel = (this.unitSelectionManager as any).unitInfoPanel;
        if (unitInfoPanel && unitInfoPanel.updateButtons) {
            unitInfoPanel.updateButtons(this.buildSwordsmanUnitInfo());
        }
    }

    /** 磨剑技能按钮点击处理：检查冷却 → 启动冷却 → 打开小游戏 */
    private onSwordSharpenSkillClick() {
        if (!this.gameManager) {
            this.findGameManager();
        }
        const gm: any = this.gameManager;
        if (!gm || typeof gm.getSwordSharpenSkillGlobalCooldownRemainingSec !== 'function') {
            return;
        }
        const remaining = gm.getSwordSharpenSkillGlobalCooldownRemainingSec();
        if (remaining > 0.05) {
            GamePopup.showMessage(`技能冷却中：${Math.ceil(remaining)}s`, true, 1.2);
            this.refreshUnitInfoPanelIfSelected();
            return;
        }

        if (gm && typeof gm.startSwordSharpenSkillGlobalCooldown === 'function') {
            gm.startSwordSharpenSkillGlobalCooldown(this.SWORD_SHARPEN_SKILL_COOLDOWN_MS);
        }
        this.refreshUnitInfoPanelIfSelected();

        gm?.openSwordSharpenMiniGameForSwordsman?.(this);
    }

    /**
     * 重写 showUnitInfoPanel：在原本面板基础上注入“磨剑”技能按钮（九宫格第六格）
     */
    showUnitInfoPanel() {
        super.showUnitInfoPanel();
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (!this.unitSelectionManager) return;

        const unitInfoPanel = (this.unitSelectionManager as any).unitInfoPanel;
        if (unitInfoPanel && unitInfoPanel.updateButtons) {
            // 只更新按钮状态，不重复创建移动监听逻辑
            unitInfoPanel.updateButtons(this.buildSwordsmanUnitInfo());
        }
    }

    /**
     * 重写执行攻击方法，实现近战攻击
     */
    executeAttack() {
        // 再次检查目标是否有效
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active || this.isDestroyed) {
            return;
        }

        // 检查目标是否是存活的敌人（Portal 特殊处理，不依赖 isAliveEnemy）
        const portal = this.currentTarget.getComponent('Portal') as any;
        const isPortalAlive = portal && !portal.isDormantNow?.() && portal.currentHealth > 0;
        if (!this.isAliveEnemy(this.currentTarget) && !isPortalAlive) {
            this.currentTarget = null!;
            return;
        }

        // 获取敌人脚本（Portal 也通过此方式获取）
        const enemyScript = this.getEnemyScript(this.currentTarget) || portal;

        // 近战攻击：直接对敌人造成伤害，不创建武器
        if (enemyScript && enemyScript.takeDamage) {
            const effectiveDamage = Math.max(0, Math.round(this.attackDamage || 0));
            // 播放攻击音效（优先 attackSound，缺省则回退到 shootSound，确保有声）
            if (AudioManager.Instance) {
                if (this.attackSound) {
                    AudioManager.Instance.playSFX(this.attackSound);
                } else if ((this as any).shootSound) {
                    AudioManager.Instance.playSFX((this as any).shootSound);
                }
            }
            // 播放击中音效
            if (this.hitSound && AudioManager.Instance) {
                AudioManager.Instance.playSFX(this.hitSound);
            }
            const hitDir = new Vec3();
            Vec3.subtract(hitDir, this.currentTarget.worldPosition, this.node.worldPosition);
            if (hitDir.length() > 0.001) {
                hitDir.normalize();
            }
            enemyScript.takeDamage(effectiveDamage, hitDir);
            // 记录伤害统计
            this.recordDamageToStatistics(effectiveDamage);
        }
    }
}
