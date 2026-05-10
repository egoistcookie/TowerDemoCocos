import { _decorator, Prefab, Node, Vec3, find, SpriteFrame, assetManager, AudioClip } from 'cc';
import { Role } from './Role';
import { AudioManager } from '../AudioManager';
const { ccclass, property } = _decorator;

/** 通用技能召唤的雇佣兵：远投长矛 / 近短剑，死亡不进入对象池 */
@ccclass('MercenarySoldier')
export class MercenarySoldier extends Role {
    static readonly MELEE_RANGE = 70;
    static readonly RANGED_RANGE = 250;

    /** 雇佣兵攻击相关音效相对全局 SFX 的音量倍率（与普通单位区分） */
    private static readonly MERCENARY_ATTACK_SFX_VOLUME = 0.8;

    /** 近战挥砍；未配置时可在预制体用 shootSound 等作兜底 */
    @property({ type: AudioClip, tooltip: '近战攻击音效' })
    meleeAttackSound: AudioClip = null!;

    /** 远程投矛 / 掷出；未配置时回退 shootSound */
    @property({ type: AudioClip, tooltip: '远程攻击音效（射矛）' })
    rangedAttackSound: AudioClip = null!;

    @property({ override: true })
    maxHealth: number = 100;

    @property({ override: true })
    attackRange: number = MercenarySoldier.RANGED_RANGE;

    @property({ override: true })
    attackDamage: number = 15;

    @property({ override: true })
    attackInterval: number = 1.0;

    @property({ type: Prefab, override: true })
    arrowPrefab: Prefab = null!;

    @property({ override: true })
    moveSpeed: number = 100;

    @property({ override: true })
    collisionRadius: number = 10;

    @property({ override: true })
    populationCost: number = 0;

    @property({ override: true })
    buildCost: number = 0;

    @property({ override: true })
    unitName: string = '雇佣士兵';

    @property({ override: true })
    unitDescription: string = '受雇参战的士兵，远则投矛、近则挥剑，阵亡后无法复活。';

    @property({ override: true })
    deathAnimationDuration: number = 0.4;

    /** 近战（短剑）攻击序列帧；未配置时回退到 attackAnimationFrames */
    @property({ type: [SpriteFrame], tooltip: '近战（短剑）攻击序列帧' })
    meleeAttackAnimationFrames: SpriteFrame[] = [];

    /** 远程（投矛）攻击序列帧；未配置时回退到 attackAnimationFrames */
    @property({ type: [SpriteFrame], tooltip: '远程（投矛）攻击序列帧' })
    rangedAttackAnimationFrames: SpriteFrame[] = [];

    /** 近战攻击动画时长（秒）；≤0 时使用 attackAnimationDuration */
    @property
    meleeAttackAnimationDuration: number = 0;

    /** 远程攻击动画时长（秒）；≤0 时使用 attackAnimationDuration */
    @property
    rangedAttackAnimationDuration: number = 0;

    /** 是否已向 other/mercenarySoldier 请求过移动序列（避免重复 loadDir） */
    private moveAnimBundleRequested = false;

    start() {
        super.start();
        this.prefabName = 'MercenarySoldier';
        if ((!this.deathAnimationFrames || this.deathAnimationFrames.length === 0) && this.sprite?.spriteFrame) {
            this.deathAnimationFrames = [this.sprite.spriteFrame];
        }
        this.tryBindArrowPrefabFromScene();
        this.tryLoadMoveAnimationFromOtherBundle();
    }

    override onEnable() {
        super.onEnable();
        this.tryLoadMoveAnimationFromOtherBundle();
    }

    /**
     * 预制体未配置 moveAnimationFrames 时，从 other 分包 mercenarySoldier 目录加载「雇佣兵移动_*」序列帧
     *（与 GameManager 动态背景的 other bundle 用法一致）
     */
    private tryLoadMoveAnimationFromOtherBundle(): void {
        if (this.moveAnimBundleRequested) {
            return;
        }
        if (this.moveAnimationFrames && this.moveAnimationFrames.filter((f) => !!f).length > 0) {
            return;
        }
        this.moveAnimBundleRequested = true;
        assetManager.loadBundle('other', (err, bundle) => {
            if (err || !bundle) {
                this.moveAnimBundleRequested = false;
                return;
            }
            bundle.loadDir('mercenarySoldier', SpriteFrame, (e, frames) => {
                if (e || !frames || frames.length === 0) {
                    this.moveAnimBundleRequested = false;
                    return;
                }
                const sorted = MercenarySoldier.filterAndSortMoveFrames(frames);
                if (sorted.length === 0) {
                    this.moveAnimBundleRequested = false;
                    return;
                }
                this.moveAnimationFrames = sorted;
                if (!this.moveAnimationDuration || this.moveAnimationDuration <= 0) {
                    this.moveAnimationDuration = Math.max(0.72, sorted.length * 0.048);
                }
                if (this.isMoving && !this.isPlayingMoveAnimation) {
                    this.playMoveAnimation();
                }
            });
        });
    }

    private static filterAndSortMoveFrames(frames: SpriteFrame[]): SpriteFrame[] {
        const withIdx: { f: SpriteFrame; n: number }[] = [];
        for (const f of frames) {
            if (!f || !f.isValid || !f.name) {
                continue;
            }
            if (f.name.indexOf('移动') < 0) {
                continue;
            }
            const m = f.name.match(/移动[_]?(\d+)/);
            const n = m ? parseInt(m[1], 10) : NaN;
            if (!Number.isFinite(n)) {
                continue;
            }
            withIdx.push({ f, n });
        }
        withIdx.sort((a, b) => a.n - b.n);
        return withIdx.map((x) => x.f);
    }

    /** 从场上弓箭手/女猎手/哨塔等处借用箭矢预制体（编辑器未挂箭 prefab 时） */
    tryBindArrowPrefabFromScene(): void {
        if (this.arrowPrefab) {
            return;
        }
        const tryArrower = (n: Node) => {
            const a = n.getComponent('Arrower') as any;
            if (a?.arrowPrefab) {
                return a.arrowPrefab as Prefab;
            }
            const h = n.getComponent('Hunter') as any;
            if (h?.arrowPrefab) {
                return h.arrowPrefab as Prefab;
            }
            const w = n.getComponent('WatchTower') as any;
            if (w?.arrowPrefab) {
                return w.arrowPrefab as Prefab;
            }
            return null;
        };
        const towers = find('Canvas/Towers');
        if (towers) {
            for (const c of towers.children) {
                const p = tryArrower(c);
                if (p) {
                    this.arrowPrefab = p;
                    return;
                }
            }
        }
        const hunters = find('Canvas/Hunters');
        if (hunters) {
            for (const c of hunters.children) {
                const p = tryArrower(c);
                if (p) {
                    this.arrowPrefab = p;
                    return;
                }
            }
        }
    }

    private isEnemyFlying(enemyScript: any): boolean {
        return !!(enemyScript && enemyScript.isFlying === true);
    }

    /**
     * 近战 / 远程分界用的圆心距离上限。
     * 仅用固定 MELEE_RANGE（70）时，双方碰撞推开后圆心距往往仍大于该值，贴身搏斗会一直走到远程分支；
     * 因此取「设计近战距离」与「双方碰撞半径之和 + 裕量」的较大值。
     */
    private getMeleeStrikeDistanceThreshold(enemyScript: any): number {
        const design = MercenarySoldier.MELEE_RANGE;
        const selfR = typeof this.collisionRadius === 'number' ? this.collisionRadius : 10;
        let enemyR = 20;
        if (
            enemyScript &&
            typeof enemyScript.collisionRadius === 'number' &&
            Number.isFinite(enemyScript.collisionRadius)
        ) {
            enemyR = enemyScript.collisionRadius;
        }
        const contactApprox = selfR + enemyR + 18;
        return Math.max(design, contactApprox);
    }

    /** 本次攻击是否用远程（长矛） */
    private shouldUseRangedAttack(distance: number, enemyScript: any): boolean {
        if (this.isEnemyFlying(enemyScript)) {
            return true;
        }
        return distance > this.getMeleeStrikeDistanceThreshold(enemyScript);
    }

    private countValidFrames(frames: SpriteFrame[] | null | undefined): number {
        if (!frames || frames.length === 0) {
            return 0;
        }
        return frames.filter((f) => !!f).length;
    }

    /** 本次攻击使用的序列帧：优先对应远近套，否则回退 attackAnimationFrames */
    private pickAttackFramesForStrike(ranged: boolean): SpriteFrame[] {
        const primary = ranged ? this.rangedAttackAnimationFrames : this.meleeAttackAnimationFrames;
        if (this.countValidFrames(primary) > 0) {
            return primary;
        }
        if (this.countValidFrames(this.attackAnimationFrames) > 0) {
            return this.attackAnimationFrames;
        }
        return [];
    }

    private strikeAnimationDuration(ranged: boolean): number {
        const d = ranged ? this.rangedAttackAnimationDuration : this.meleeAttackAnimationDuration;
        if (d > 0) {
            return d;
        }
        return this.attackAnimationDuration > 0 ? this.attackAnimationDuration : 0.5;
    }

    private playMercenaryAttackSfx(clip: AudioClip | null | undefined): void {
        if (!clip || !AudioManager.Instance) {
            return;
        }
        AudioManager.Instance.playSFXWithVolume(clip, MercenarySoldier.MERCENARY_ATTACK_SFX_VOLUME);
    }

    /** 远程：掷矛发射（音量 80%） */
    protected override playProjectileLaunchSound(): void {
        const clip = this.rangedAttackSound || this.shootSound;
        this.playMercenaryAttackSfx(clip);
    }

    /** 远程：命中（音量 80%） */
    protected override playProjectileHitSound(): void {
        this.playMercenaryAttackSfx(this.hitSound);
    }

    attack() {
        if (!this.currentTarget || this.isDestroyed) {
            return;
        }
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }
        this.stopMoving();
        const portal = this.currentTarget.getComponent('Portal') as any;
        const isPortalAlive = portal && !portal.isDormantNow?.() && portal.currentHealth > 0;
        if (!this.isAliveEnemy(this.currentTarget) && !isPortalAlive) {
            this.currentTarget = null!;
            return;
        }

        const enemyScript = this.getEnemyScript(this.currentTarget) || portal;
        const myPos = this.node.worldPosition;
        const tp = this.currentTarget.worldPosition;
        const dx = tp.x - myPos.x;
        const dy = tp.y - myPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ranged = this.shouldUseRangedAttack(dist, enemyScript);

        const framesToPlay = this.pickAttackFramesForStrike(ranged);
        if (this.countValidFrames(framesToPlay) === 0) {
            this.executeAttack();
            return;
        }

        const savedFrames = this.attackAnimationFrames;
        const savedDuration = this.attackAnimationDuration;
        this.attackAnimationFrames = framesToPlay;
        this.attackAnimationDuration = this.strikeAnimationDuration(ranged);

        if (!this.sprite) {
            this.attackAnimationFrames = savedFrames;
            this.attackAnimationDuration = savedDuration;
            this.executeAttack();
            return;
        }

        this.playAttackAnimation(() => {
            this.attackAnimationFrames = savedFrames;
            this.attackAnimationDuration = savedDuration;
            this.executeAttack();
        });
    }

    executeAttack() {
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active || this.isDestroyed) {
            return;
        }
        const portal = this.currentTarget.getComponent('Portal') as any;
        const isPortalAlive = portal && !portal.isDormantNow?.() && portal.currentHealth > 0;
        if (!this.isAliveEnemy(this.currentTarget) && !isPortalAlive) {
            this.currentTarget = null!;
            return;
        }
        const enemyScript = this.getEnemyScript(this.currentTarget) || portal;
        const myPos = this.node.worldPosition;
        const tp = this.currentTarget.worldPosition;
        const dx = tp.x - myPos.x;
        const dy = tp.y - myPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const meleeCap = this.getMeleeStrikeDistanceThreshold(enemyScript);

        const ranged = this.shouldUseRangedAttack(dist, enemyScript);
        if (ranged) {
            if (dist > MercenarySoldier.RANGED_RANGE + 1) {
                return;
            }
            if (this.arrowPrefab) {
                super.executeAttack();
            } else {
                this.tryBindArrowPrefabFromScene();
                if (this.arrowPrefab) {
                    super.executeAttack();
                } else if (enemyScript?.takeDamage) {
                    const rangedClip = this.rangedAttackSound || this.shootSound;
                    if (rangedClip) {
                        this.playMercenaryAttackSfx(rangedClip);
                    }
                    const hitDir = new Vec3(dx, dy, 0);
                    if (hitDir.length() > 0.001) {
                        hitDir.normalize();
                    }
                    enemyScript.takeDamage(this.attackDamage, hitDir);
                    this.recordDamageToStatistics(this.attackDamage);
                }
            }
            return;
        }

        if (dist > meleeCap + 1) {
            return;
        }
        if (enemyScript && enemyScript.takeDamage) {
            const meleeClip = this.meleeAttackSound || this.shootSound;
            if (meleeClip) {
                this.playMercenaryAttackSfx(meleeClip);
            }
            if (this.hitSound) {
                this.playMercenaryAttackSfx(this.hitSound);
            }
            const hitDir = new Vec3(dx, dy, 0);
            if (hitDir.length() > 0.001) {
                hitDir.normalize();
            }
            const dmg = Math.max(0, Math.round(this.attackDamage || 0));
            enemyScript.takeDamage(dmg, hitDir);
            this.recordDamageToStatistics(dmg);
        }
    }

    destroyTower() {
        if (this.isDestroyed) {
            return;
        }
        this.isDestroyed = true;
        this.destroyTransientHealthBarNow();
        this.hideTransientManaBarNow();
        const selfAny = this as any;
        if (selfAny.dialogNode && selfAny.dialogNode.isValid) {
            selfAny.dialogNode.destroy();
        }
        selfAny.dialogNode = null;
        selfAny.dialogLabel = null;
        this.playDeathAnimation();
        if (!this.gameManager) {
            this.findGameManager();
        }
        if (this.gameManager && this.populationCost > 0) {
            this.gameManager.removePopulation(this.populationCost);
        }
        this.node.off(Node.EventType.TOUCH_END, this.onTowerClick, this);
        this.hideSelectionPanel();
        this.manualMoveTarget = null!;
        this.isManuallyControlled = false;
        this.removeHighlight();
        const dur = Math.max(0.05, this.deathAnimationDuration || 0.3);
        this.scheduleOnce(() => {
            this.destroyTransientHealthBarNow();
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }, dur);
    }
}
