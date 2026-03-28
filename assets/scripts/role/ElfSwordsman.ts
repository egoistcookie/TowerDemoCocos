import { _decorator, SpriteFrame, Prefab, Texture2D, AudioClip, Node, Vec3 } from 'cc';
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

    // 当前磨剑带来的伤害倍率（只作用于本实例；不做叠加，直接覆盖）
    public swordSharpenDamageMultiplier: number = 1.0;
    // 为了避免重复叠加，这里缓存“磨剑前”的基准属性（对象池复用时会在 onEnable 重置）
    private swordSharpenAttackIntervalBase: number = 0;
    private swordSharpenAttackDamageBase: number = 0;

    onEnable() {
        // 先让父类完成对象池激活、天赋/卡片增幅等初始化
        // @ts-ignore
        super.onEnable?.();

        // 对象池复用时重置磨剑相关基准，避免跨局/跨角色残留
        this.swordSharpenDamageMultiplier = 1.0;
        this.swordSharpenAttackIntervalBase = 0;
        this.swordSharpenAttackDamageBase = 0;
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

    
    battleSlogans: string[] = ['为了荣耀！', '为了联盟！', '吃我一剑！', '哈！'];

    // 剑士磨剑技能冷却（全体剑士共享）
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

    /**
     * 重写攻击方法，实现近战攻击
     */
    attack() {
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

        // 检查目标是否是存活的敌人
        if (this.isAliveEnemy(this.currentTarget)) {
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

        // 检查目标是否是存活的敌人
        if (!this.isAliveEnemy(this.currentTarget)) {
            this.currentTarget = null!;
            return;
        }
        
        // 获取敌人脚本
        const enemyScript = this.getEnemyScript(this.currentTarget);

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
            // 直接造成伤害
            enemyScript.takeDamage(effectiveDamage);
            // 记录伤害统计
            this.recordDamageToStatistics(effectiveDamage);
        }
    }
}
