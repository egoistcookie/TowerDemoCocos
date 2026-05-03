import { _decorator, Color, SpriteFrame, Prefab, Texture2D, AudioClip, Vec3, Node, instantiate, find, sys, EventTouch, view, tween, UIOpacity, Label, LabelOutline } from 'cc';
import { Role } from './Role';
import { AudioManager } from '../AudioManager';
import { Arrow } from '../Arrow';
import { Arrow2 } from '../Arrow2';
import { UnitInfo } from '../UnitInfoPanel';
import { PlayerDataManager } from '../PlayerDataManager';
import { GamePopup } from '../GamePopup';
import { GameState } from '../GameManager';
const { ccclass, property } = _decorator;

@ccclass('Arrower')
export class Arrower extends Role {
    // SP：多重箭（由 BuffManager 写入 _spMultiArrowExtraTargets）
    // 当前规则：仅增加目标数量，不降低攻击力
    // 重写父类属性，设置 Arrower 的默认值
    @property({ override: true })
    maxHealth: number = 50;

    @property({ override: true })
    attackRange: number = 200;

    @property({ override: true })
    attackDamage: number = 10;

    @property({ override: true })
    attackInterval: number = 1.0;

    @property({ type: Prefab, override: true })
    bulletPrefab: Prefab = null!;

    @property({ type: Prefab, override: true })
    arrowPrefab: Prefab = null!; // 弓箭预制体（支持后期更新贴图）

    @property({ type: Prefab, override: true })
    explosionEffect: Prefab = null!;

    @property({ type: Prefab, override: true })
    damageNumberPrefab: Prefab = null!;

    @property({ override: true })
    buildCost: number = 5; // 建造成本（用于回收和升级）
    
    @property({ override: true })
    level: number = 1; // 弓箭手等级

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
    @property({ type: AudioClip, override: true })
    shootSound: AudioClip = null!; // 箭矢射出时的音效
    
    @property({ type: AudioClip, override: true })
    hitSound: AudioClip = null!; // 箭矢击中敌人时的音效

    // 弓弦松紧小游戏：长按时的持续音效（按固定节奏循环触发，资源挂在弓箭手预制体上）
    @property({ type: AudioClip })
    bowstringHoldSound: AudioClip = null!;

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

    @property({ type: SpriteFrame, override: true })
    cardIcon: SpriteFrame = null!; // 单位名片图片
    
    // 单位信息属性
    @property({ override: true })
    unitName: string = "弓箭手";
    
    @property({ override: true })
    unitDescription: string = "你就是城里来的指挥官吗？看起来还不赖，暂且相信你好了。";
    
    @property({ type: SpriteFrame, override: true })
    unitIcon: SpriteFrame = null!;

    // 首个弓箭手“紧弓弦”互动资源（直接挂在弓箭手预制体上）
    @property({ type: [SpriteFrame] })
    bowstringTensionFrames: SpriteFrame[] = []; // 弓弦松紧序列帧（建议从“最松”到“最紧”）

    @property({ type: SpriteFrame })
    bowstringMoodExcellentIcon: SpriteFrame = null!; // 结算-最佳情绪图

    @property({ type: SpriteFrame })
    bowstringMoodGoodIcon: SpriteFrame = null!; // 结算-良好情绪图

    @property({ type: SpriteFrame })
    bowstringMoodBadIcon: SpriteFrame = null!; // 结算-较差情绪图

    // 3级专用：强化版箭矢预制体（Arrow2）
    @property({ type: Prefab })
    level3ArrowPrefab: Prefab = null!;

    // 钓鱼动画：开始钓鱼动画帧（播放一次）
    @property({ type: [SpriteFrame] })
    fishingStartFrames: SpriteFrame[] = [];

    // 钓鱼动画：循环钓鱼动画帧（持续循环）
    @property({ type: [SpriteFrame] })
    fishingLoopFrames: SpriteFrame[] = [];

    // 陷阱动画：设置陷阱时播放（3秒布置阶段）
    @property({ type: [SpriteFrame] })
    spikeTrapSetupFrames: SpriteFrame[] = [];

    // 陷阱动画：地刺触发时播放（敌人经过/触发陷阱时）
    @property({ type: [SpriteFrame] })
    spikeTrapTriggerFrames: SpriteFrame[] = [];

    // 陷阱网格贴图（显示在石墙网格空地上）
    @property({ type: SpriteFrame })
    spikeTrapGridSprite: SpriteFrame = null!;

    // 钓鱼相关：全局静态引用，确保全场景只有一个钓鱼弓箭手
    private static fishingArcher: Arrower | null = null;
    // 钓鱼相关：静态锁，防止多个弓箭手同时进入钓鱼状态
    private static isFishingLock: boolean = false;
    // 钓鱼相关：全局累计钓鱼金币（用于每20金币触发人口上限+1）
    private static totalFishingGold: number = 0;

    // 钓鱼相关：空闲计时器（5秒内未攻击则触发钓鱼）
    private fishingIdleTimer: number = 0;
    // 钓鱼相关：当前是否正在钓鱼
    private isFishing: boolean = false;
    // 钓鱼相关：动画播放引用（用于清除定时器）
    private _fishingAnimUpdate: ((deltaTime: number) => void) | null = null;
    // 钓鱼相关：保存原始缩放，停止钓鱼时恢复
    private _fishingOriginalScale: Vec3 | null = null;
    // 钓鱼相关：是否已到达钓鱼位置
    private _hasArrivedAtFishingSpot: boolean = false;
    // 钓鱼相关：金币产出计时器（每3秒产出1金币）
    private _fishingGoldTimer: number = 0;
    // 临时Vec3缓存，避免频繁创建
    private _tempVec3: Vec3 = new Vec3();
    // 陷阱机制
    private _trapCheckTimer: number = 0;
    private _trapIdleTimer: number = 0;
    private _isSettingSpikeTrap: boolean = false;
    private _spikeTrapBuildTimer: number = 0;
    private _pendingTrapCell: { x: number; y: number } | null = null;
    private _trapDebugLogTimer: number = 0;
    private _spikeTrapAnimTimer: number = 0;
    private _spikeTrapOriginalSprite: SpriteFrame | null = null;
    private _spikeTrapOriginalScale: Vec3 | null = null;
    private _isAligningToTrapCell: boolean = false;
    private _trapAlignCellCenter: Vec3 | null = null;
    private _expectedTrapSetupFrame: SpriteFrame | null = null;
    private _trapFlickerLogTimer: number = 0;
    private _trapSetupCooldownTimer: number = 0;
    private _lastTrapSetupFrameIdx: number = -1;
    private readonly SPIKE_TRAP_BUILD_DURATION: number = 4.0;

    // 技能相关属性
    private readonly PENETRATE_ARROW_MANA_COST: number = 10; // 穿透箭消耗蓝量
    private isPenetrateArrowEnabled: boolean = false; // 穿透箭开关（每个弓箭手独立，默认关闭）

    // 弓弦调整技能（九宫格第六格）：30 秒冷却（使用真实时间，暂停不影响冷却计时）
    // 冷却状态由 GameManager.bowstringSkillGlobalCooldownEndMs 全局管理，所有弓箭手共享
    private readonly BOWSTRING_SKILL_COOLDOWN_MS: number = 30_000;

    // 当前弓弦松紧带来的攻击倍率（只作用于本弓箭手实例；不叠加，直接覆盖）
    public bowstringAttackMultiplier: number = 1.0;

    battleSlogans: string[] = ['箭如雨下！', '射击！射击！射击！', '瞄准，射击！', '弓弦紧绷射天狼!', '箭似流星！', 'Biu! Biu! Biu!'];
    private readonly fishingSlogans: string[] = ['钓鱼！钓鱼！钓鱼！', '我来养活大家！', '怎么还不上钩呀'];
    private readonly SP_MULTI_ARROW_SLOGAN = '我的箭……会分叉？';

    public override tryTriggerSloganOnAction() {
        const slogans = this.isFishing ? this.fishingSlogans : this.battleSlogans;
        if (!slogans || slogans.length === 0) {
            return;
        }
        const anyThis = this as any;
        if (anyThis.dialogNode && anyThis.dialogNode.isValid) {
            return;
        }
        if ((Number(anyThis.dialogIntervalTimer) || 0) < 2.0) {
            return;
        }

        const spEnabled = (Number((this as any)._spMultiArrowExtraTargets) || 0) > 0;
        if (spEnabled && Math.random() < 0.5) {
            this.createDialog(this.SP_MULTI_ARROW_SLOGAN, false);
        } else {
            this.createDialog();
        }
        anyThis.dialogIntervalTimer = 0;
        anyThis.dialogTimer = 0;
    }

    /**
     * 重写口号获取：钓鱼时使用钓鱼口号
     */
    public override getRandomSlogan(): string {
        if (this.isFishing && this.fishingSlogans.length > 0) {
            const index = Math.floor(Math.random() * this.fishingSlogans.length);
            return this.fishingSlogans[index];
        }
        return super.getRandomSlogan();
    }

    public override getRandomIdleSlogan(): string {
        if (this.isFishing && this.fishingSlogans.length > 0) {
            const index = Math.floor(Math.random() * this.fishingSlogans.length);
            return this.fishingSlogans[index];
        }
        return super.getRandomIdleSlogan();
    }

    /**
     * 重写父类的checkSkill方法，检查是否有穿透箭技能
     * 技能状态由isPenetrateArrowEnabled控制，每个弓箭手独立
     */
    protected checkSkill() {
        // 技能状态由isPenetrateArrowEnabled控制，如果开启则hasSkill为true
        this.hasSkill = this.isPenetrateArrowEnabled;
    }
    
    /**
     * 重写父类的createArrow：
     * - 1、2级：使用普通箭矢逻辑（父类实现）
     * - 3级或拥有技能：使用 Arrow2 预制体，直线弹道，穿透第一个敌人后继续飞行100像素
     * - 有技能时：检查蓝量，有蓝自动使用穿透箭，没蓝使用普通箭
     */
    protected createArrow() {
        // 用临时 attackDamage 参与本次射击（不持久修改，避免误影响其它弓箭手）
        const effDamage = this.getEffectiveAttackDamage();
        this.withTempAttackDamage(effDamage, () => {
            // 检查是否有技能且蓝量足够
            const usePenetrateArrow = this.hasSkill && this.hasEnoughMana(this.PENETRATE_ARROW_MANA_COST);
            
            // 如果有技能且蓝量足够，使用穿透箭
            if (usePenetrateArrow && this.level3ArrowPrefab) {
                // 消耗蓝量
                this.consumeMana(this.PENETRATE_ARROW_MANA_COST);
                // 使用穿透箭逻辑
                this.createPenetrateArrow();
                return;
            }
            
            // 等级小于3或没有技能，保持原有逻辑
            if (this.level < 3 || !this.level3ArrowPrefab) {
                // SP：多重箭（仅作用于普通箭，不覆盖穿透箭）
                const extraTargets = Math.max(0, Math.floor(Number((this as any)._spMultiArrowExtraTargets) || 0));
                if (extraTargets > 0) {
                    this.createMultiArrow(extraTargets, this.attackDamage);
                } else {
                    // 使用父类的普通箭矢逻辑
                    // @ts-ignore 通过索引访问以避免编译器对protected的限制提示
                    super['createArrow']();
                }
                return;
            }
            
            // 3级但没有技能或蓝量不足，使用普通箭
            // @ts-ignore
            {
                const extraTargets = Math.max(0, Math.floor(Number((this as any)._spMultiArrowExtraTargets) || 0));
                if (extraTargets > 0) {
                    this.createMultiArrow(extraTargets, this.attackDamage);
                } else {
                    super['createArrow']();
                }
            }
        });
    }

    private createMultiArrow(extraTargets: number, baseDamage: number) {
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
            return;
        }
        const maxTargets = 1 + extraTargets;
        const enemies = this.getEnemies(true, this.attackRange);
        if (!enemies || enemies.length === 0) {
            return;
        }
        const myPos = this.node.worldPosition;
        // 以距离排序，优先近的；确保 currentTarget 在列表里
        const list = enemies
            .filter(e => e && e.isValid && e.active && this.isAliveEnemy(e))
            .sort((a, b) => {
                const da = (a.worldPosition.x - myPos.x) ** 2 + (a.worldPosition.y - myPos.y) ** 2;
                const db = (b.worldPosition.x - myPos.x) ** 2 + (b.worldPosition.y - myPos.y) ** 2;
                return da - db;
            });
        // 把当前目标放在最前
        const targets: Node[] = [];
        targets.push(this.currentTarget);
        for (const e of list) {
            if (targets.length >= maxTargets) break;
            if (e === this.currentTarget) continue;
            targets.push(e);
        }
        const perDamage = Math.max(1, Math.floor(Number(baseDamage) || 0));

        const oldTarget = this.currentTarget;
        const oldDamage = this.attackDamage;
        try {
            for (const t of targets) {
                this.currentTarget = t;
                this.attackDamage = perDamage;
                // @ts-ignore
                super['createArrow']();
            }
        } finally {
            this.currentTarget = oldTarget;
            this.attackDamage = oldDamage;
        }
    }

    private getEffectiveAttackDamage(): number {
        const base = Number(this.attackDamage) || 0;
        const m = Number(this.bowstringAttackMultiplier) || 1.0;
        return Math.max(0, Math.round(base * Math.max(1.0, m)));
    }

    private withTempAttackDamage(tempDamage: number, fn: () => void) {
        const old = this.attackDamage;
        this.attackDamage = tempDamage;
        try {
            fn();
        } finally {
            this.attackDamage = old;
        }
    }
    
    /**
     * 创建穿透箭（使用Arrow2预制体）
     */
    private createPenetrateArrow() {

        if (!this.currentTarget || this.isDestroyed) {
            return;
        }

        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            return;
        }

        // 选择使用的箭矢预制体（优先使用3级专用的 Arrow2）
        const prefabToUse = this.level3ArrowPrefab || this.arrowPrefab;
        if (!prefabToUse) {
            // 如果未配置 Arrow2，则退回父类逻辑
            // @ts-ignore
            super['createArrow']();
            return;
        }

        // 创建弓箭节点
        const arrowNode = instantiate(prefabToUse);

        // 设置父节点（添加到场景或Canvas）
        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            arrowNode.setParent(parentNode);
        } else {
            arrowNode.setParent(this.node.parent);
        }

        // 设置初始位置（弓箭手位置）
        const startPos = this.node.worldPosition.clone();
        arrowNode.setWorldPosition(startPos);

        // 确保节点激活
        arrowNode.active = true;

        // 获取或添加Arrow2组件（3级专用穿透箭）
        let arrow2Script = arrowNode.getComponent(Arrow2);
        if (!arrow2Script) {
            arrow2Script = arrowNode.addComponent(Arrow2);
        }

        // 播放箭矢射出音效
        if (this.shootSound && AudioManager.Instance) {
            AudioManager.Instance.playSFX(this.shootSound);
        }

        const targetNode = this.currentTarget;
        const baseDamage = this.attackDamage;

        // 记录是否已播放过音效
        let hasPlayedHitSound = false;

        // 初始化穿透箭，设置命中回调
        arrow2Script.init(
            startPos,
            targetNode,
            baseDamage,
            (damage: number, hitPos: Vec3, enemy: Node) => {
                // 播放击中音效（只在第一次命中时播放）
                if (!hasPlayedHitSound && this.hitSound) {
                    AudioManager.Instance?.playSFX(this.hitSound);
                    hasPlayedHitSound = true;
                }

                // 检查敌人是否有效
                if (!enemy || !enemy.isValid || !enemy.active) {
                    return;
                }

                // 检查是否是存活敌人
                if (!this.isAliveEnemy(enemy)) {
                    return;
                }

                // 获取敌人脚本并造成伤害
                const enemyScript = this.getEnemyScript(enemy);
                if (enemyScript && enemyScript.takeDamage) {
                    // 计算受力方向：从弓箭手指向被击中的敌人
                    const hitDirection = new Vec3();
                    Vec3.subtract(hitDirection, enemy.worldPosition, this.node.worldPosition);
                    if (hitDirection.length() > 0.001) {
                        hitDirection.normalize();
                    }
                    enemyScript.takeDamage(damage, hitDirection);
                    // 记录伤害统计
                    this.recordDamageToStatistics(damage);
                }
            }
        );
    }

    /**
     * 构建弓箭手专用的 UnitInfo（包含穿透箭技能）
     */
    public buildArrowerUnitInfo(): UnitInfo {
        // 计算升级费用：1到2级是10金币，此后每次升级多10金币
        const upgradeCost = this.level < 3 ? (10 + (this.level - 1) * 10) : undefined;
        
        // 确保生命值有效
        const currentHealth = (this.currentHealth !== undefined && !isNaN(this.currentHealth) && this.currentHealth >= 0) 
            ? this.currentHealth 
            : (this.maxHealth || 0);
        const maxHealth = (this.maxHealth !== undefined && !isNaN(this.maxHealth) && this.maxHealth > 0) 
            ? this.maxHealth 
            : 0;
        
        // 获取当前技能状态（每个弓箭手独立）
        const isSkillActive = this.isPenetrateArrowEnabled;

        const unitInfo: UnitInfo = {
            name: this.unitName || '角色',
            level: this.level,
            currentHealth: currentHealth,
            maxHealth: maxHealth,
            attackDamage: this.getEffectiveAttackDamage(),
            populationCost: 1,
            icon: this.cardIcon || this.defaultSpriteFrame,
            collisionRadius: this.collisionRadius,
            attackRange: this.attackRange,
            attackFrequency: 1.0 / this.attackInterval,
            moveSpeed: this.moveSpeed,
            isDefending: this.isDefending,
            upgradeCost: upgradeCost,
            onUpgradeClick: this.level < 3 ? () => {
                this.onUpgradeClick();
            } : undefined,
            onSellClick: () => {
                this.onSellClick();
            },
            onDefendClick: () => {
                this.onDefendClick();
            },
            onSkillClick: () => {
                // 切换技能状态（每个弓箭手独立）
                this.isPenetrateArrowEnabled = !this.isPenetrateArrowEnabled;
                
                // 更新技能状态
                this.hasSkill = this.isPenetrateArrowEnabled;
                
                // 如果技能激活，确保蓝量条节点存在（默认隐藏，射箭消耗蓝后才临时显示）
                if (this.isPenetrateArrowEnabled) {
                    if (!this.manaBarNode || !this.manaBarNode.isValid) {
                        this.createManaBar();
                    } else if (this.manaBar) {
                        this.manaBar.setMaxMana(this.maxMana);
                        this.manaBar.setMana(this.currentMana);
                    }
                } else {
                    if (this.manaBarNode && this.manaBarNode.isValid) {
                        this.manaBarNode.active = false;
                    }
                }
                
                // 刷新面板显示（更新按钮状态）
                if (this.unitSelectionManager) {
                    const unitInfoPanel = (this.unitSelectionManager as any).unitInfoPanel;
                    if (unitInfoPanel) {
                        // 更新unitInfo的技能状态
                        const updatedUnitInfo: UnitInfo = {
                            ...this.buildArrowerUnitInfo(),
                            isSkillActive: this.isPenetrateArrowEnabled
                        };
                        unitInfoPanel.updateButtons(updatedUnitInfo);
                    }
                }
            },
            onSkill2Click: () => {
                this.onBowstringSkillClick();
            },
            isSkillActive: isSkillActive
        };

        // 第二技能冷却信息（用于 UI 显示）
        unitInfo.skill2CooldownTotalSec = this.BOWSTRING_SKILL_COOLDOWN_MS / 1000;
        unitInfo.skill2CooldownRemainingSec = this.getBowstringSkillCooldownRemainingSec();

        return unitInfo;
    }

    private getBowstringSkillCooldownRemainingSec(): number {
        // 所有弓箭手共享全局冷却，从 GameManager 读取
        if (!this.gameManager) {
            this.findGameManager();
        }
        const gm: any = this.gameManager as any;
        if (gm && gm.getBowstringSkillGlobalCooldownRemainingSec) {
            return gm.getBowstringSkillGlobalCooldownRemainingSec();
        }
        return 0;
    }

    private refreshUnitInfoPanelIfSelected() {
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (!this.unitSelectionManager) {
            return;
        }
        if ((this.unitSelectionManager as any).isUnitSelected && !(this.unitSelectionManager as any).isUnitSelected(this.node)) {
            return;
        }
        const unitInfoPanel = (this.unitSelectionManager as any).unitInfoPanel;
        if (unitInfoPanel && unitInfoPanel.updateButtons) {
            const updated = this.buildArrowerUnitInfo();
            unitInfoPanel.updateButtons(updated);
        }
    }

    private onBowstringSkillClick() {
        console.log(`[BowstringSkill] click t=${Date.now()} uuid=${this.node?.uuid} name=${this.unitName}`);
        const remaining = this.getBowstringSkillCooldownRemainingSec();
        if (remaining > 0.05) {
            // 冷却中直接提示（不触发）
            GamePopup.showMessage(`技能冷却中：${Math.ceil(remaining)}s`, true, 1.2);
            this.refreshUnitInfoPanelIfSelected();
            return;
        }

        // 启动全局冷却（所有弓箭手共享）
        if (!this.gameManager) {
            this.findGameManager();
        }
        const gm: any = this.gameManager as any;
        if (gm && gm.startBowstringSkillGlobalCooldown) {
            gm.startBowstringSkillGlobalCooldown(this.BOWSTRING_SKILL_COOLDOWN_MS);
        }
        this.refreshUnitInfoPanelIfSelected();

        // 打开小游戏（不会叠加增幅：GameManager 内部用固定 baseKey 覆盖 attackDamage）
        gm?.openBowstringMiniGameForArrower?.(this);
    }

    /**
     * 重写 showUnitInfoPanel 方法，添加技能按钮
     */
    showUnitInfoPanel() {
        // 显示单位信息面板和范围
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (this.unitSelectionManager) {
            const unitInfo: UnitInfo = this.buildArrowerUnitInfo();
            this.unitSelectionManager.selectUnit(this.node, unitInfo);
        }

        // 点击其他地方设置移动目标
        const canvas = find('Canvas');
        this.scheduleOnce(() => {
            if (canvas) {
                // 创建全局触摸事件处理器
                this.globalTouchHandler = (event: EventTouch) => {
                    
                    // 检查当前单位是否仍被选中
                    // 注意：globalTouchHandler只有在单位被选中时才会注册
                    // 但如果选中状态在onGlobalTouchEnd中被清除，这里检查可能返回false
                    // 所以我们需要检查：如果getCurrentSelectedUnit()不为null且不是当前单位，说明选中了其他单位，应该移除监听器
                    if (this.unitSelectionManager) {
                        const currentSelectedUnit = this.unitSelectionManager.getCurrentSelectedUnit();
                        const isSelected = this.unitSelectionManager.isUnitSelected(this.node);
                        
                        
                        // 如果选中了其他单位（不是当前单位），移除监听器
                        if (currentSelectedUnit !== null && currentSelectedUnit !== this.node) {
                            const canvas = find('Canvas');
                            if (canvas && this.globalTouchHandler) {
                                canvas.off(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
                            }
                            this.globalTouchHandler = null!;
                            return;
                        }
                        
                        // 如果当前单位未被选中，也不执行移动操作
                        // 或者如果没有任何选中（currentSelectedUnit为null），也不执行移动操作
                        if (!isSelected || currentSelectedUnit === null) {
                            // 移除监听器，因为单位已不再被选中
                            const canvas = find('Canvas');
                            if (canvas && this.globalTouchHandler) {
                                canvas.off(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
                            }
                            this.globalTouchHandler = null!;
                            return;
                        }
                    }
                    
                    // 检查点击是否在信息面板上（通过节点名称和路径检查）
                    const targetNode = event.target as Node;
                    if (targetNode) {
                        // 检查目标节点或其父节点是否是信息面板
                        let currentNode: Node | null = targetNode;
                        while (currentNode) {
                            // 检查节点名称是否包含 UnitInfoPanel（信息面板的节点名称）
                            if (currentNode.name === 'UnitInfoPanel' || currentNode.name.includes('UnitInfoPanel')) {
                                // 点击在信息面板上，不设置移动目标
                                return;
                            }
                            // 检查节点的路径是否包含 UnitInfoPanel
                            const nodePath = currentNode.getPathInHierarchy();
                            if (nodePath && nodePath.includes('UnitInfoPanel')) {
                                // 点击在信息面板上，不设置移动目标
                                return;
                            }
                            currentNode = currentNode.parent;
                            // 如果到达根节点，停止检查
                            if (!currentNode) {
                                break;
                            }
                        }
                    }
                    
                    // 点击不在信息面板上，设置移动目标
                    this.setManualMoveTarget(event);
                };
                
                canvas.on(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
            }
        }, 0.1);
    }
    
    /**
     * 重写防御按钮逻辑，确保刷新面板时仍保留穿透箭技能按钮
     */
    onDefendClick(event?: EventTouch) {
        if (event) {
            event.propagationStopped = true;
        }
        
        // 切换防御状态（沿用父类逻辑）
        this.isDefending = !this.isDefending;
        
        if (this.isDefending) {
            // 如果进入防御状态，清除手动移动目标并停止移动
            this.manualMoveTarget = null!;
            this.isManuallyControlled = false;
            this.stopMoving();
        } else {
            // 如果取消防御状态，清除手动移动目标，让单位进入正常索敌模式
            this.manualMoveTarget = null!;
            this.isManuallyControlled = false;
            // 取消防御状态时重置钓鱼空闲计时器
            this.fishingIdleTimer = 0;
        }
        
        // 更新单位信息面板（刷新按钮显示，保留穿透箭）
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            const unitInfo: UnitInfo = this.buildArrowerUnitInfo();
            this.unitSelectionManager.selectUnit(this.node, unitInfo);
        }
    }

    /**
     * 重写 destroyTower 方法，在第一个弓箭手死亡时显示提示框
     */
    destroyTower() {
        // 检查是否是第一个弓箭手死亡
        if (!this.gameManager) {
            this.findGameManager();
        }

        // 如果是第一个弓箭手死亡，显示提示框
        if (this.gameManager && !(this.gameManager as any).hasShownFirstArrowerDeathPopup) {
            (this.gameManager as any).hasShownFirstArrowerDeathPopup = true;
            
            // 显示单位提示框
            if ((this.gameManager as any).unitIntroPopup) {
                const unitInfo = {
                    unitIcon: this.cardIcon || this.unitIcon || this.defaultSpriteFrame,
                    unitName: this.unitName || '弓箭手',
                    unitDescription: '请珍惜我的同伴，训练一个士兵需要耗费3枚金币'
                };
                (this.gameManager as any).unitIntroPopup.show(unitInfo);
            }
        }

        // 清理钓鱼状态
        if (this.isFishing && Arrower.fishingArcher === this) {
            Arrower.fishingArcher = null;
            Arrower.isFishingLock = false;
        }

        // 调用父类的 destroyTower 方法
        super.destroyTower();
    }

    onDestroy() {
        // 重要：弓箭手的钓鱼状态使用静态锁控制“全局唯一”
        // 若关卡切换/重开时直接清理节点，可能不会走 destroyTower()，从而导致锁残留，后续关卡永远无法再钓鱼。
        try {
            if (this.isFishing && Arrower.fishingArcher === this) {
                Arrower.fishingArcher = null;
                Arrower.isFishingLock = false;
            }
        } catch {}

        // 清理钓鱼动画定时器（避免残留 schedule）
        try {
            if (this._fishingAnimUpdate) {
                this.unschedule(this._fishingAnimUpdate);
                this._fishingAnimUpdate = null;
            }
        } catch {}

        // 父类清理
        // @ts-ignore - 兼容父类可能未实现 onDestroy
        super.onDestroy?.();
    }

    // ==================== 钓鱼机制 ====================

    /**
     * 重写对话框系统更新：钓鱼期间抑制战斗口号，避免干扰钓鱼口号
     */
    updateDialogSystem(deltaTime: number) {
        if (this.isFishing) {
            const anyThis = this as any;
            // 钓鱼期间独立累加间隔计时器，避免父类逻辑被抑制后计时停滞
            if (!anyThis.dialogNode || !anyThis.dialogNode.isValid) {
                anyThis.dialogIntervalTimer = (Number(anyThis.dialogIntervalTimer) || 0) + deltaTime;
            }

            // 仅维护当前对话框显示状态；新口号触发由 update() 钓鱼分支控制
            if (anyThis.dialogNode && anyThis.dialogNode.isValid) {
                this.updateDialog(deltaTime);
            }
            return;
        }
        // 非钓鱼状态：使用父类默认逻辑
        super.updateDialogSystem(deltaTime);
    }

    /**
     * 重写 update：检查空闲时间，超过 5 秒未攻击则开始钓鱼
     */
    update(deltaTime: number) {
        // 如果已销毁或在死亡状态，跳过钓鱼逻辑
        if (this.isDestroyed) {
            return;
        }

        if (this._isSettingSpikeTrap) {
            // 设置陷阱期间：陷阱动画最高优先级；仅允许“受击”中断
            if ((this as any).isPlayingHitAnimation) {
                this.cancelSpikeTrapSetup('hit-interrupt');
                return;
            }
            // 锁定行为状态，防止索敌/移动/攻击分支抢动画
            this.currentTarget = null!;
            this.manualMoveTarget = null!;
            this.isManuallyControlled = false;
            this.isMoving = false;
            (this as any).isPlayingMoveAnimation = false;
            (this as any).isPlayingAttackAnimation = false;
            this._spikeTrapBuildTimer += deltaTime;
            this.playSpikeTrapSetupAnimation(deltaTime);
            // 闪烁定位：若当前显示帧与期望帧不一致，说明有其他逻辑在抢帧
            if (this.sprite && this.sprite.isValid && this._expectedTrapSetupFrame) {
                if (this.sprite.spriteFrame !== this._expectedTrapSetupFrame) {
                    // 每帧纠正回期望帧，避免视觉闪烁
                    this.sprite.spriteFrame = this._expectedTrapSetupFrame;
                }
            }
            if (this._spikeTrapBuildTimer >= this.SPIKE_TRAP_BUILD_DURATION) {
                this.finishSpikeTrapSetup();
            }
            return;
        }

        this.updateSpikeTrapBehavior(deltaTime);

        // 【关键优化】在 super.update() 之前完成钓鱼状态初始化和检查
        // 这样 startFishing() 设置的 manualMoveTarget 能在同一帧被父类 update 处理
        const canUseFishing = this.canUseFishingBehavior();
        if (this.isFishing) {
            if (!canUseFishing) {
                this.stopFishing();
                super.update(deltaTime);
                return;
            }
            // 钓鱼过程中间歇性触发 fishingSlogans
            const anyThis = this as any;
            if ((Number(anyThis.dialogIntervalTimer) || 0) >= 5.0 && (!anyThis.dialogNode || !anyThis.dialogNode.isValid)) {
                this.createDialog();
                anyThis.dialogIntervalTimer = 0;
                anyThis.dialogTimer = 0;
            }

            // 到达钓鱼位置后清除手动移动目标
            if (!this.manualMoveTarget) {
                this.isManuallyControlled = false;

                if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
                    this.findTarget();
                }
            } else {
                const pos = this.node.worldPosition;
                const dx = this.manualMoveTarget.x - pos.x;
                const dy = this.manualMoveTarget.y - pos.y;
                if ((dx * dx + dy * dy) < 100) {
                    this.manualMoveTarget = null;
                    this.isManuallyControlled = false;

                    this._hasArrivedAtFishingSpot = true;
                    this._fishingOriginalScale = this.node.getScale().clone();
                    this.node.setScale(1.6, 1.2, this.node.scale.z);
                    this.playFishingStartAnimation();

                    if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
                        this.findTarget();
                    }
                }
            }

            if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
                this.stopFishing();
            } else if (this._hasArrivedAtFishingSpot) {
                this.playFishingLoopAnimation(deltaTime);

                if (!this.gameManager) {
                    this.findGameManager();
                }
                const gm: any = this.gameManager;
                // 参考金矿逻辑：仅在 Playing 状态下产出，暂停时不累计
                if (gm && gm.getGameState && gm.getGameState() === GameState.Playing) {
                    // 每3秒产出1金币并显示飘字
                    this._fishingGoldTimer += deltaTime;
                    if (this._fishingGoldTimer >= 3.0) {
                        this._fishingGoldTimer -= 3.0;
                        if (gm.addGold) {
                            gm.addGold(1);
                            Arrower.totalFishingGold += 1;

                            // 每累计20个钓鱼金币，人口上限+1，并弹出提示
                            if (Arrower.totalFishingGold > 0 && Arrower.totalFishingGold % 20 === 0) {
                                if (gm.getMaxPopulation && gm.setMaxPopulation) {
                                    const currentMaxPopulation = Number(gm.getMaxPopulation()) || 0;
                                    gm.setMaxPopulation(currentMaxPopulation + 1);
                                }
                                GamePopup.showMessage('经过钓鱼者的不懈努力\n防线能够供养的人口增加', true, 3);
                            }
                        }
                        this.showGoldRewardText();
                    }
                }
            }
        } else {
            // 检查空闲时间（5 秒未攻击则开始钓鱼）
            if (canUseFishing && (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active)) {
                this.fishingIdleTimer += deltaTime;
                if (this.fishingIdleTimer >= 5.0 && !Arrower.isFishingLock) {
                    this.startFishing();
                }
            } else {
                this.fishingIdleTimer = 0;
            }
        }

        // 调用父类 update（此时 manualMoveTarget 可能已设置，父类会处理移动）
        super.update(deltaTime);

        // 如果正在钓鱼，跳过父类后续逻辑
        if (this.isFishing) {
            return;
        }
    }

    private updateSpikeTrapBehavior(deltaTime: number) {
        if (this._trapSetupCooldownTimer > 0) {
            this._trapSetupCooldownTimer -= deltaTime;
            return;
        }
        if (!this.canUseSpikeTrapBehavior()) {
            this._trapCheckTimer = 0;
            this._trapIdleTimer = 0;
            this._trapDebugLogTimer = 0;
            return;
        }
        if (this._isAligningToTrapCell && this._trapAlignCellCenter) {
            const myPos = this.node.worldPosition;
            const dx = this._trapAlignCellCenter.x - myPos.x;
            const dy = this._trapAlignCellCenter.y - myPos.y;
            // 已经到格子中心附近，重试一次设陷阱（不再重复触发对齐）
            if (dx * dx + dy * dy <= 12 * 12) {
                this._isAligningToTrapCell = false;
                this.manualMoveTarget = null!;
                this.isManuallyControlled = false;
                this.tryStartSpikeTrapSetup(false);
            }
            return;
        }
        if (this.isFishing) {
            this._trapCheckTimer = 0;
            this._trapIdleTimer = 0;
            return;
        }
        // 仅弓箭手空闲时累计闲置时长（无有效战斗目标、非手动移动、非防御）
        const hasTarget = this.hasValidTrapInterruptTarget();
        if (!hasTarget && this.currentTarget) {
            // 清理传送门/无效目标，避免卡住“有目标”状态
            this.currentTarget = null!;
        }
        const hasManualMove = !!this.manualMoveTarget;
        if (!hasTarget && !hasManualMove && !this.isDefending) {
            this._trapIdleTimer += deltaTime;
        } else {
            this._trapIdleTimer = 0;
        }
        this._trapCheckTimer += deltaTime;
        if (this._trapCheckTimer < 1.5) {
            return;
        }
        this._trapCheckTimer = 0;
        if (this._trapIdleTimer < 3.0) {
            return;
        }
        this.tryStartSpikeTrapSetup(true);
    }

    private hasValidTrapInterruptTarget(): boolean {
        const t = this.currentTarget;
        if (!t || !t.isValid || !t.active) return false;
        // 传送门不可攻击，不应阻断陷阱设置
        if (t.getComponent && t.getComponent('Portal')) return false;
        // 只有可存活敌人目标才算“有目标”
        return this.isAliveEnemy(t);
    }

    private tryStartSpikeTrapSetup(allowAlignToCellCenter: boolean) {
        const gridNode = find('Canvas/StoneWallGridPanel') || find('StoneWallGridPanel');
        const grid = gridNode?.getComponent('StoneWallGridPanel') as any;
        if (!grid) {
            return;
        }
        const myPos = this.node.worldPosition;
        const cell = grid.worldToGrid ? grid.worldToGrid(myPos) : null;
        if (!cell) {
            return;
        }

        // 新需求：陷阱放在“空地格子”，不是石墙本体
        if (grid.isGridOccupied && grid.isGridOccupied(cell.x, cell.y)) {
            return;
        }
        if (grid.hasTrapAt && grid.hasTrapAt(cell.x, cell.y)) {
            return;
        }

        // 先对齐到当前格子中心，再开始3秒设置动画与计时
        if (allowAlignToCellCenter && grid.gridToWorld) {
            const center = grid.gridToWorld(cell.x, cell.y) as Vec3 | null;
            if (center) {
                const dx = center.x - myPos.x;
                const dy = center.y - myPos.y;
                if (dx * dx + dy * dy > 12 * 12) {
                    this._isAligningToTrapCell = true;
                    this._trapAlignCellCenter = center.clone();
                    if (!this.manualMoveTarget) {
                        this.manualMoveTarget = new Vec3();
                    }
                    this.manualMoveTarget.set(center);
                    this.isManuallyControlled = true;
                    return;
                }
            }
        }

        this._isSettingSpikeTrap = true;
        this._spikeTrapBuildTimer = 0;
        this._spikeTrapAnimTimer = 0;
        this._spikeTrapOriginalSprite = this.sprite && this.sprite.isValid ? this.sprite.spriteFrame : null;
        this._spikeTrapOriginalScale = this.node.getScale().clone();
        this._expectedTrapSetupFrame = null;
        this._trapFlickerLogTimer = 0;
        this._lastTrapSetupFrameIdx = -1;
        this._pendingTrapCell = { x: cell.x, y: cell.y };
        this._isAligningToTrapCell = false;
        this._trapAlignCellCenter = null;
        // 彻底清理当前节点上的已调度动画回调（含父类待机动画），防止与挖坑动画抢帧
        this.unscheduleAllCallbacks();
        this.stopAllAnimations();
        (this as any).isPlayingIdleAnimation = false;
        (this as any).isPlayingMoveAnimation = false;
        this.isMoving = false;
        this.currentTarget = null!;
        // 关键：停止钓鱼动画定时器，避免与设置陷阱动画同时改 spriteFrame 导致闪烁
        if (this._fishingAnimUpdate) {
            this.unschedule(this._fishingAnimUpdate);
            this._fishingAnimUpdate = null;
        }
        if (this.sprite && this.sprite.isValid) {
            this.sprite.color = new Color(255, 255, 255, 255);
        }
        // 设置陷阱动画期间放大为 1.2x
        this.node.setScale(1.2, 1.2, this.node.scale.z);
        const trapSetupSlogans = ['指挥官，我教你做陷阱', '嘿嘿嘿'];
        const trapSlogan = trapSetupSlogans[Math.floor(Math.random() * trapSetupSlogans.length)];
        this.createDialog(trapSlogan, false);
    }

    private finishSpikeTrapSetup() {
        const pendingCell = this._pendingTrapCell;
        const gridNode = find('Canvas/StoneWallGridPanel') || find('StoneWallGridPanel');
        const grid = gridNode?.getComponent('StoneWallGridPanel') as any;
        if (pendingCell && grid && grid.placeTrapAt) {
            const trapSprite = this.spikeTrapGridSprite
                || (this.spikeTrapTriggerFrames && this.spikeTrapTriggerFrames.length > 0 ? this.spikeTrapTriggerFrames[0] : null)
                || (this.spikeTrapSetupFrames && this.spikeTrapSetupFrames.length > 0 ? this.spikeTrapSetupFrames[0] : null);
            const ok = grid.placeTrapAt(
                pendingCell.x,
                pendingCell.y,
                this.getEffectiveAttackDamage(),
                trapSprite,
                this.spikeTrapTriggerFrames || []
            );
            if (!ok) {
                // 放置失败时静默忽略，保持流程可继续
            }
        }
        this._isSettingSpikeTrap = false;
        this._spikeTrapBuildTimer = 0;
        this._spikeTrapAnimTimer = 0;
        this._pendingTrapCell = null;
        this._expectedTrapSetupFrame = null;
        this._trapFlickerLogTimer = 0;
        this._lastTrapSetupFrameIdx = -1;
        this._trapIdleTimer = 0;
        this._isAligningToTrapCell = false;
        this._trapAlignCellCenter = null;
        // 设陷阱后短冷却，避免视觉上连续触发“设置陷阱”动画
        this._trapSetupCooldownTimer = 2.0;
        if (this.sprite && this.sprite.isValid && this._spikeTrapOriginalSprite) {
            this.sprite.spriteFrame = this._spikeTrapOriginalSprite;
        }
        if (this.sprite && this.sprite.isValid) {
            this.sprite.color = new Color(255, 255, 255, 255);
        }
        if (this._spikeTrapOriginalScale) {
            this.node.setScale(this._spikeTrapOriginalScale);
        }
        this._spikeTrapOriginalScale = null;
        this._spikeTrapOriginalSprite = null;
    }

    private cancelSpikeTrapSetup(reason: string) {
        this._isSettingSpikeTrap = false;
        this._spikeTrapBuildTimer = 0;
        this._spikeTrapAnimTimer = 0;
        this._pendingTrapCell = null;
        this._expectedTrapSetupFrame = null;
        this._trapFlickerLogTimer = 0;
        this._lastTrapSetupFrameIdx = -1;
        this._trapIdleTimer = 0;
        this._isAligningToTrapCell = false;
        this._trapAlignCellCenter = null;
        // 受击打断后给短冷却，避免立刻再次进设置态
        this._trapSetupCooldownTimer = 1.0;
        if (this.sprite && this.sprite.isValid && this._spikeTrapOriginalSprite) {
            this.sprite.spriteFrame = this._spikeTrapOriginalSprite;
        }
        if (this.sprite && this.sprite.isValid) {
            this.sprite.color = new Color(255, 255, 255, 255);
        }
        if (this._spikeTrapOriginalScale) {
            this.node.setScale(this._spikeTrapOriginalScale);
        }
        this._spikeTrapOriginalScale = null;
        this._spikeTrapOriginalSprite = null;
    }

    private playSpikeTrapSetupAnimation(deltaTime: number) {
        if (!this.sprite || !this.sprite.isValid) return;
        if (!this.spikeTrapSetupFrames || this.spikeTrapSetupFrames.length === 0) return;
        const frames = this.spikeTrapSetupFrames.filter(f => !!f);
        if (frames.length === 0) return;
        this._spikeTrapAnimTimer += deltaTime;
        const progress = Math.max(0, Math.min(1, this._spikeTrapBuildTimer / this.SPIKE_TRAP_BUILD_DURATION));
        const idx = Math.min(frames.length - 1, Math.floor(progress * frames.length));
        this._lastTrapSetupFrameIdx = idx;
        this._expectedTrapSetupFrame = frames[idx];
        this.sprite.spriteFrame = frames[idx];
    }


    /**
     * 是否允许该单位使用钓鱼行为（子类可重写）
     */
    protected canUseFishingBehavior(): boolean {
        return true;
    }

    protected canUseSpikeTrapBehavior(): boolean {
        return true;
    }

    /**
     * 重写 setManualMoveTargetPosition：手动控制时取消钓鱼
     */
    setManualMoveTargetPosition(worldPos: Vec3) {
        // 如果正在钓鱼，取消钓鱼状态
        if (this.isFishing) {
            this.stopFishing();
        }
        // 调用父类方法执行移动
        super.setManualMoveTargetPosition(worldPos);
    }

    /**
     * 开始钓鱼：移动到右下角池塘边位置
     */
    private startFishing() {
        // 使用静态锁防止多个弓箭手同时进入钓鱼状态
        if (Arrower.isFishingLock) {
            return;
        }

        // 确保全局只有一个钓鱼弓箭手（任何时刻只能有一个）
        if (Arrower.fishingArcher && Arrower.fishingArcher.isFishing) {
            return;
        }

        Arrower.isFishingLock = true;
        this.isFishing = true;
        this.fishingIdleTimer = 0;
        Arrower.fishingArcher = this;

        // 停止移动并清除攻击目标
        this.stopMoving();
        this.currentTarget = null!;

        // 钓鱼位置：池塘边上
        // 池塘贴图石头边缘在左上部，弓箭手站在石头边缘上
        // 以画面中心为基准，池塘在右下角区域
        const designResolution = view.getDesignResolutionSize();
        const centerX = designResolution.width / 2;
        const centerY = designResolution.height / 2;
        // 相对于画面中心的偏移（向右200，向下400）
        const fishingPos = new Vec3(centerX + 235, centerY - 545, 0);
        if (!this.manualMoveTarget) {
            this.manualMoveTarget = new Vec3();
        }
        this.manualMoveTarget.set(fishingPos);
        this.isManuallyControlled = true;

        // 向钓鱼目的地移动时触发口号（从两句出发口号中随机挑选）
        const departureSlogans = ['指挥官，我钓鱼去啦', '我来养活大家'];
        const slogan = departureSlogans[Math.floor(Math.random() * departureSlogans.length)];
        this.createDialog(slogan, false);

        // 隐藏血条和蓝条
        if (this.healthBarNode && this.healthBarNode.isValid) {
            this.healthBarNode.active = false;
        }
        if (this.manaBarNode && this.manaBarNode.isValid) {
            this.manaBarNode.active = false;
        }

        // 确保不被 isDefending 阻挡手动移动，并在父类 update 之后再次标记
        this.isDefending = false;
        this.isManuallyControlled = true;
    }

    /**
     * 停止钓鱼：恢复正常运行
     */
    private stopFishing() {
        this.isFishing = false;
        this.fishingIdleTimer = 0;
        this._hasArrivedAtFishingSpot = false;
        this._fishingGoldTimer = 0;

        // 血条/蓝条均为受击或消耗后临时显示，结束钓鱼不强制常驻打开

        // 如果是当前钓鱼弓箭手，清除全局引用和锁
        if (Arrower.fishingArcher === this) {
            Arrower.fishingArcher = null;
            Arrower.isFishingLock = false;
        }

        // 重置其他弓箭手的空闲计时器，防止另一个弓箭手立即开始钓鱼
        if (this.unitManager) {
            const towers = this.unitManager.getTowers();
            for (const tower of towers) {
                if (tower && tower.isValid && tower !== this.node) {
                    const arrowerScript = tower.getComponent('Arrower') as any;
                    if (arrowerScript) {
                        arrowerScript.fishingIdleTimer = 0;
                    }
                }
            }
        }

        // 清除钓鱼动画定时器
        if (this._fishingAnimUpdate) {
            this.unschedule(this._fishingAnimUpdate);
            this._fishingAnimUpdate = null;
        }

        // 停止钓鱼动画，恢复默认贴图
        if (this.sprite && this.sprite.isValid && this.defaultSpriteFrame) {
            this.sprite.spriteFrame = this.defaultSpriteFrame;
        }

        // 恢复原始缩放
        if (this._fishingOriginalScale) {
            this.node.setScale(this._fishingOriginalScale);
            this._fishingOriginalScale = null;
        }
    }

    /**
     * 播放开始钓鱼动画（播放一次）
     */
    private playFishingStartAnimation() {
        if (this._isSettingSpikeTrap) {
            return;
        }
        if (!this.sprite || !this.sprite.isValid || this.fishingStartFrames.length === 0) {
            // 如果没配置动画帧，直接播放循环动画
            this.playFishingLoopAnimation(0);
            return;
        }

        const frames = this.fishingStartFrames.filter(f => f != null);
        if (frames.length === 0) {
            this.playFishingLoopAnimation(0);
            return;
        }

        const frameDuration = 0.05; // 每帧 0.05 秒
        let timer = 0;

        const animUpdate = (dt: number) => {
            if (!this.isFishing || !this.sprite || !this.sprite.isValid || this.isDestroyed) {
                this.unschedule(animUpdate);
                this._fishingAnimUpdate = null;
                return;
            }

            timer += dt;
            const frameIndex = Math.floor(timer / frameDuration) % frames.length;

            // 播放完一次后，切换到循环动画
            if (timer >= frames.length * frameDuration) {
                this.unschedule(animUpdate);
                this._fishingAnimUpdate = null;
                this.playFishingLoopAnimation(0);
                return;
            }

            if (frames[frameIndex]) {
                this.sprite.spriteFrame = frames[frameIndex];
            }
        };

        // 清除之前的动画
        if (this._fishingAnimUpdate) {
            this.unschedule(this._fishingAnimUpdate);
        }

        this._fishingAnimUpdate = animUpdate;
        this.schedule(animUpdate, 0);
    }

    /**
     * 播放循环钓鱼动画（持续循环）
     */
    private playFishingLoopAnimation(_deltaTime: number) {
        if (this._isSettingSpikeTrap) {
            return;
        }
        // 使用定时器实现循环播放，不依赖 _deltaTime
        if (this._fishingAnimUpdate) {
            return; // 已在播放
        }

        const frames = this.fishingLoopFrames.filter(f => f != null);
        if (frames.length === 0) {
            return;
        }

        const frameDuration = 0.15; // 每帧 0.15 秒
        let timer = 0;

        // 立即播放第一帧
        if (this.sprite && this.sprite.isValid && frames[0]) {
            this.sprite.spriteFrame = frames[0];
        }

        const animUpdate = (dt: number) => {
            if (!this.isFishing || !this.sprite || !this.sprite.isValid || this.isDestroyed) {
                this.unschedule(animUpdate);
                this._fishingAnimUpdate = null;
                // 恢复默认贴图
                if (this.sprite && this.sprite.isValid && this.defaultSpriteFrame) {
                    this.sprite.spriteFrame = this.defaultSpriteFrame;
                }
                return;
            }

            timer += dt;
            const frameIndex = Math.floor(timer / frameDuration) % frames.length;

            if (frames[frameIndex] && this.sprite && this.sprite.isValid) {
                this.sprite.spriteFrame = frames[frameIndex];
            }
        };

        this._fishingAnimUpdate = animUpdate;
        this.schedule(animUpdate, 0);
    }

    /**
     * 显示金币奖励飘字（参考 GoldMine.showGoldRewardText）
     */
    private showGoldRewardText() {
        if (!this.node || !this.node.isValid) return;

        const canvas = find('Canvas');
        const parentNode = canvas || this.node.scene || this.node.parent;
        if (!parentNode) return;

        const basePos = this._tempVec3.set(this.node.worldPosition);
        basePos.y += 50;

        const n = new Node('GoldRewardText');
        n.setParent(parentNode);

        try {
            n.setSiblingIndex(48);
        } catch {}

        n.setWorldPosition(basePos);

        let label: Label | null = n.getComponent(Label);
        if (!label) label = n.addComponent(Label);
        label.string = '+1 fish';
        label.fontSize = 20;
        label.color = new Color(255, 215, 0, 255);

        let outline = label.node.getComponent(LabelOutline);
        if (!outline) {
            outline = label.node.addComponent(LabelOutline);
        }
        outline.color = new Color(0, 0, 0, 255);
        outline.width = 2;

        const opacity = n.getComponent(UIOpacity) || n.addComponent(UIOpacity);
        opacity.opacity = 255;

        const floatUp = 30;

        tween(n)
            .delay(0.1)
            .to(0.8, { worldPosition: new Vec3(basePos.x, basePos.y + floatUp, basePos.z) }, { easing: 'sineOut' })
            .parallel(tween(opacity).to(0.8, { opacity: 0 }))
            .call(() => {
                if (n && n.isValid) n.destroy();
            })
            .start();
    }

    // ==================== 钓鱼机制结束 ====================
}