import { _decorator, find, Node, SpriteFrame, Vec3 } from 'cc';
import { Enemy } from './Enemy';

const { ccclass, property } = _decorator;

/**
 * 狂兽人：优先索敌我方地面 Role；对地面 Role 普攻时有概率触发「剑舞」——
 * 以当前锁定的目标所在位置为圆心、半径内筛选我方地面 Role，1 秒内至多 4 次闪现斩击，
 * 满 1 秒后回到发起剑舞时的位置。
 */
@ccclass('DualBladeOrc')
export class DualBladeOrc extends Enemy {
    @property({ tooltip: '剑舞：以「当前目标位置」为圆心筛选我方地面 Role 的半径（像素）' })
    bladeDanceRadius: number = 150;

    @property({ tooltip: '剑舞：对地面 Role 发动普攻时触发概率（0~1）' })
    bladeDanceTriggerChance: number = 0.4;

    @property(SpriteFrame)
    bladeDanceAttackAnimationFrames: SpriteFrame[] = [];

    @property({ tooltip: '剑舞独立攻击动画总时长；0 表示与普通攻击动画时长一致' })
    bladeDanceAttackAnimationDuration: number = 0;

    @property({ tooltip: '剑舞独立 Animation 剪辑名；空则沿用普通攻击剪辑' })
    bladeDanceAttackAnimationName: string = '';

    @property({
        tooltip:
            '仅把横向偏移不超过此值的石墙当作「挡路」目标；过大视为侧面墙，不拆（狂兽人以 Role 为主）。',
    })
    stoneWallMaxSideOffsetPx: number = 88;

    @property({
        tooltip:
            '石墙中心须在自身「下方」至少超过此像素（与朝下移动一致）才视为挡路；避免拆同一行旁边的墙。',
    })
    stoneWallMinBelowPx: number = 12;

    public prefabName: string = 'DualBladeOrc';

    maxHealth: number = 200;
    moveSpeed: number = 52;
    attackDamage: number = 16;
    attackInterval: number = 1.0;
    attackRange: number = 60;
    collisionRadius: number = 2;
    unitName: string = '狂兽人';
    unitDescription: string = '渴望战斗';
    goldReward: number = 3;
    expReward: number = 5;

    @property({
        override: true,
        tooltip:
            '韧性（0-1）：1秒内累计受到的伤害达到「最大生命×韧性」才触发僵直；与 Boss 相同，僵直有 2 秒冷却。',
    })
    tenacity: number = 0.5;

    @property({ type: SpriteFrame, override: true })
    idleAnimationFrames: SpriteFrame[] = [];

    @property({ type: SpriteFrame, override: true })
    walkAnimationFrames: SpriteFrame[] = [];

    @property({ type: SpriteFrame, override: true })
    attackAnimationFrames: SpriteFrame[] = [];

    @property({ type: SpriteFrame, override: true })
    hitAnimationFrames: SpriteFrame[] = [];

    @property({ type: SpriteFrame, override: true })
    deathAnimationFrames: SpriteFrame[] = [];

    /** 剑舞进行中：本阶段不常规索敌，避免下移 */
    private _bladeDanceActive: boolean = false;
    /** 递增会话号，取消 schedule 残留回调 */
    private _bladeDanceSession: number = 0;
    /** 发起剑舞时记录的「当前目标」世界坐标（满 1 秒回到此处） */
    private readonly _bladeDanceAnchorPos: Vec3 = new Vec3();
    /** 发起剑舞时的锁定目标；斩击间隙用来保持 AI 仍有合法 currentTarget */
    private _bladeDanceResumeTarget: Node | null = null;
    /** 本轮剑舞要斩击的 Role 列表（长度 1~4） */
    private _bladeDanceStrikeRoles: Node[] = [];
    /** 与 attack() 里 span 一致，用于压缩单次斩击动画时长，避免下一刀打断上一刀的出伤 */
    private _bladeDanceStrikeCount: number = 0;

    /** 下一次 pickSimpleAIDetectionRangeSq 使用大半径（剑舞结束 / 兜底索敌） */
    private _bladeDanceWideRetargetOnce: boolean = false;

    private _savedAttackAnimationFrames: SpriteFrame[] | null = null;
    private _savedAttackAnimationDuration: number = 0;
    private _savedAttackAnimationName: string = '';

    private readonly _flashDir: Vec3 = new Vec3();
    private readonly _flashPos: Vec3 = new Vec3();
    private readonly _faceDir: Vec3 = new Vec3();

    /** 与 Boss 一致：最近 1 秒内受到的总伤害（用于韧性僵直判定） */
    private recentDamage: number = 0;
    private damageTime: number = 0;
    private lastStaggerTime: number = -1;

    /** 满 1 秒回到锚点（稳定引用供 schedule / unschedule） */
    private readonly _boundBladeDanceReturn = () => {
        this.finishBladeDanceTeleportBack();
    };

    onEnable() {
        super.onEnable();
        this.resetTenacityState();
    }

    private resetTenacityState() {
        this.recentDamage = 0;
        this.damageTime = 0;
        this.lastStaggerTime = -1;
    }

    takeDamage(damage: number, hitDirection?: Vec3) {
        if (this.isDestroyed) {
            return;
        }

        if (hitDirection && hitDirection.length() > 0.001) {
            this.lastHitDirection.set(hitDirection);
            this.lastHitDirection.normalize();
        }

        const isCritical = Math.random() < 0.1;
        const finalDamage = isCritical ? Math.floor(damage * 1.5) : damage;

        this.showDamageNumber(finalDamage, isCritical, hitDirection);

        if (this.tenacity <= 0) {
            const timeSinceLastStagger =
                this.lastStaggerTime < 0 ? Infinity : this.attackTimer - this.lastStaggerTime;
            if (timeSinceLastStagger > 2.0) {
                this.lastStaggerTime = this.attackTimer;
                this.stopMoving();
                this.playHitAnimation();
            }
        } else {
            const threshold = this.maxHealth * Math.min(1, Math.max(0, this.tenacity));

            if (this.damageTime > 0 && this.attackTimer - this.damageTime > 1.0) {
                this.recentDamage = 0;
            }

            this.recentDamage += finalDamage;
            this.damageTime = this.attackTimer;

            const timeSinceLastStagger =
                this.lastStaggerTime < 0 ? Infinity : this.attackTimer - this.lastStaggerTime;
            const canStagger = this.recentDamage >= threshold && timeSinceLastStagger > 2.0;

            if (canStagger) {
                this.lastStaggerTime = this.attackTimer;
                this.recentDamage = 0;
                this.damageTime = this.attackTimer;

                this.stopMoving();
                this.playHitAnimation();
            }
        }

        this.currentHealth -= finalDamage;

        this.bumpTransientHealthBarAfterHit();

        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.die();
        }
    }

    protected shouldSkipRetarget(): boolean {
        return this._bladeDanceActive || super.shouldSkipRetarget();
    }

    protected resolveCombatMovement(
        _distanceSq: number,
        _attackRangeSq: number,
        _deltaTime: number
    ): 'attack' | 'move' | 'handled' {
        if (this._bladeDanceActive) {
            this.stopMoving();
            return 'handled';
        }
        return super.resolveCombatMovement(_distanceSq, _attackRangeSq, _deltaTime);
    }

    protected tryEnsureFallbackCombatTarget(): void {
        if (this.isDestroyed || !this.node?.isValid) {
            return;
        }
        if (this._bladeDanceActive) {
            const t = this.currentTarget;
            if (!t || !t.isValid || !t.active) {
                if (this._bladeDanceResumeTarget?.isValid && this._bladeDanceResumeTarget.active) {
                    this.currentTarget = this._bladeDanceResumeTarget;
                }
            }
            return;
        }
        const t = this.currentTarget;
        if (t?.isValid && t.active) {
            return;
        }
        this.refreshWideCombatTarget();
    }

    /** 扩大半径索敌一次，必要时指向存活水晶 */
    private refreshWideCombatTarget(): void {
        if (this.isDestroyed || !this.node?.isValid) {
            return;
        }
        this._bladeDanceWideRetargetOnce = true;
        this.findTargetInRange();
        if (!this.currentTarget) {
            if (!this.targetCrystal || !this.targetCrystal.isValid) {
                this.targetCrystal = find('Crystal') || null!;
            }
            if (this.targetCrystal?.isValid) {
                const crystalScript = this.targetCrystal.getComponent('Crystal') as any;
                if (crystalScript?.isAlive && crystalScript.isAlive()) {
                    this.currentTarget = this.targetCrystal;
                }
            }
        }
    }

    protected resetEnemyState() {
        this.clearBladeDanceInternal(true);
        this.resetTenacityState();
        super.resetEnemyState();
    }

    protected pickSimpleAIDetectionRangeSq(): number {
        let sq = super.pickSimpleAIDetectionRangeSq();
        if (this._bladeDanceWideRetargetOnce) {
            this._bladeDanceWideRetargetOnce = false;
            const wideR = 2600;
            sq = Math.max(sq, wideR * wideR);
        }
        return sq;
    }

    protected findTargetInRange() {
        const detectionRangeSq = this.pickSimpleAIDetectionRangeSq();
        const myPos = this.node.worldPosition;

        const groundRole = this.findNearestGroundRoleInDetection(myPos, detectionRangeSq);
        if (groundRole) {
            this.currentTarget = groundRole;
            return;
        }
        this.applyFindTargetInRange(detectionRangeSq);
    }

    /**
     * 只拆「脚下纵向通道上」的挡路石墙；侧面、同行的墙不纳入索敌，便于无 Role 时走 moveDownwards 找单位。
     */
    protected shouldConsiderStoneWallTarget(wallNode: Node): boolean {
        const my = this.node.worldPosition;
        const w = wallNode.worldPosition;
        const dx = Math.abs(w.x - my.x);
        if (dx > this.stoneWallMaxSideOffsetPx) {
            return false;
        }
        const dy = w.y - my.y;
        // 与 Enemy.moveDownwards 一致：朝下为 Y 减小；挡路墙应在下方（更小 Y）
        if (dy > -this.stoneWallMinBelowPx) {
            return false;
        }
        return true;
    }

    protected attack() {
        if (this._bladeDanceActive) {
            return;
        }
        const chance = Math.min(1, Math.max(0, this.bladeDanceTriggerChance));
        if (
            this.currentTarget &&
            this.isAliveGroundRole(this.currentTarget) &&
            Math.random() < chance
        ) {
            const anchor = this.currentTarget.worldPosition;
            this._bladeDanceAnchorPos.set(anchor.x, anchor.y, anchor.z);
            this._bladeDanceResumeTarget = this.currentTarget;
            const roles = this.collectGroundRolesNearPoint(this._bladeDanceAnchorPos, this.bladeDanceRadius);
            if (roles.length === 0) {
                super.attack();
                return;
            }
            const strikeCount = Math.min(4, roles.length);
            this._bladeDanceStrikeRoles = roles.slice(0, strikeCount);
            this._bladeDanceStrikeCount = strikeCount;

            this._bladeDanceSession++;
            const session = this._bladeDanceSession;
            this._bladeDanceActive = true;

            this.unschedule(this._boundBladeDanceReturn);
            const span = 0.92;
            for (let i = 0; i < strikeCount; i++) {
                const delay = strikeCount <= 1 ? 0 : (i / strikeCount) * span;
                this.scheduleOnce(() => {
                    this.executeBladeDanceStrike(session, i);
                }, delay);
            }
            this.scheduleOnce(this._boundBladeDanceReturn, 1.0);
            return;
        }
        super.attack();
    }

    /**
     * 单次斩击：闪现 -> 朝向 -> 播放攻击动画（出伤由 Enemy 帧动画半程 / Animation 组件半程 schedule 触发）
     */
    private executeBladeDanceStrike(session: number, strikeIndex: number) {
        if (this.isDestroyed || !this.node?.isValid || session !== this._bladeDanceSession || !this._bladeDanceActive) {
            return;
        }
        const role = this._bladeDanceStrikeRoles[strikeIndex];
        if (!role?.isValid || !role.active || !this.isAliveGroundRole(role)) {
            return;
        }
        this.currentTarget = role;
        this.flashInFrontOfTarget(role);
        Vec3.subtract(this._faceDir, role.worldPosition, this.node.worldPosition);
        this.flipDirection(this._faceDir);
        this.playAttackAnimation();
    }

    /** 满 1 秒：回到锚点、结束剑舞、重索敌 */
    private finishBladeDanceTeleportBack() {
        if (!this._bladeDanceActive || this.isDestroyed || !this.node?.isValid) {
            return;
        }
        const back = this.clampPositionToScreen(this._bladeDanceAnchorPos);
        this.node.setWorldPosition(back);

        this.clearBladeDanceInternal(false);

        if (!this.isDestroyed && this.node?.isValid) {
            this.playIdleAnimation();
        }
    }

    playAttackAnimation() {
        if (this._bladeDanceActive) {
            this.applyBladeDanceStrikeVisuals();
            if (this.bladeDanceAttackAnimationName) {
                this._savedAttackAnimationName = this.attackAnimationName;
                this.attackAnimationName = this.bladeDanceAttackAnimationName;
            }
        }
        super.playAttackAnimation();
    }

    protected onAttackAnimationFinished(): boolean {
        if (!this._bladeDanceActive) {
            this.refreshWideCombatTarget();
            return false;
        }
        // 剑舞：不收招待机，避免两刀之间闪 idle；由下一刀 playAttackAnimation 覆盖。须手动清攻击标记，否则 handleAttackAnimationEnded 早退后不重置。
        this.restoreBladeDanceStrikeVisuals();
        this.isPlayingAttackAnimation = false;
        this.attackComplete = false;
        return true;
    }

    private clearBladeDanceInternal(skipWideRetarget = false) {
        this.unschedule(this._boundBladeDanceReturn);
        this._bladeDanceSession++;
        this._bladeDanceActive = false;
        this._bladeDanceStrikeRoles = [];
        this._bladeDanceStrikeCount = 0;
        this._bladeDanceResumeTarget = null;
        this.restoreBladeDanceStrikeVisuals();
        if (!skipWideRetarget && !this.isDestroyed && this.node?.isValid) {
            this.refreshWideCombatTarget();
        }
    }

    private applyBladeDanceStrikeVisuals() {
        this._savedAttackAnimationDuration = this.attackAnimationDuration;
        const baseDur =
            this.bladeDanceAttackAnimationFrames.length > 0 && this.bladeDanceAttackAnimationDuration > 0
                ? this.bladeDanceAttackAnimationDuration
                : this.attackAnimationDuration;
        this.attackAnimationDuration = baseDur / 3;
        // 与 executeBladeDanceStrike 排期一致：相邻两刀起点间隔 = span/N，须使半程出伤早于下一刀 stopAllAnimations
        const span = 0.92;
        const n = Math.max(1, this._bladeDanceStrikeCount);
        const minGap = n <= 1 ? 1.0 : span / n;
        const maxDur = Math.max(0.06, minGap * 0.88);
        this.attackAnimationDuration = Math.min(this.attackAnimationDuration, maxDur);
        if (this.bladeDanceAttackAnimationFrames.length > 0) {
            this._savedAttackAnimationFrames = this.attackAnimationFrames;
            this.attackAnimationFrames = this.bladeDanceAttackAnimationFrames;
        }
    }

    private restoreBladeDanceStrikeVisuals() {
        if (this._savedAttackAnimationFrames) {
            this.attackAnimationFrames = this._savedAttackAnimationFrames;
            this._savedAttackAnimationFrames = null;
        }
        if (this._savedAttackAnimationDuration > 0) {
            this.attackAnimationDuration = this._savedAttackAnimationDuration;
            this._savedAttackAnimationDuration = 0;
        }
        if (this._savedAttackAnimationName) {
            this.attackAnimationName = this._savedAttackAnimationName;
            this._savedAttackAnimationName = '';
        }
    }

    /** 地面 Role 扫描路径（不含小精灵 Wisps，不作为优先索敌 / 剑舞目标） */
    private collectGroundRoleNodesFlat(): Node[] {
        const paths = [
            'Canvas/Towers',
            'Canvas/EagleArchers',
            'Canvas/Hunters',
            'Canvas/Mages',
            'Mages',
            'Canvas/ElfSwordsmans',
        ];
        const out: Node[] = [];
        for (const p of paths) {
            const container = find(p);
            if (!container) {
                continue;
            }
            for (const child of container.children) {
                if (!child?.active || !child.isValid) {
                    continue;
                }
                const role = child.getComponent('Role') as any;
                if (role?.isAlive && role.isAlive() && role.isFlying !== true) {
                    out.push(child);
                }
            }
        }
        return out;
    }

    /** 以 anchor 为圆心、半径内存活地面 Role，按距离升序 */
    private collectGroundRolesNearPoint(anchor: Vec3, radiusPx: number): Node[] {
        const r = Math.max(1, radiusPx);
        const r2 = r * r;
        const list: { n: Node; d2: number }[] = [];
        for (const node of this.collectGroundRoleNodesFlat()) {
            if (!node?.isValid || !node.active) {
                continue;
            }
            const role = node.getComponent('Role') as any;
            if (!role?.isAlive || !role.isAlive()) {
                continue;
            }
            const dx = node.worldPosition.x - anchor.x;
            const dy = node.worldPosition.y - anchor.y;
            const d2 = dx * dx + dy * dy;
            if (d2 <= r2) {
                list.push({ n: node, d2 });
            }
        }
        list.sort((a, b) => a.d2 - b.d2);
        return list.map((x) => x.n);
    }

    private findNearestGroundRoleInDetection(myPos: Vec3, detectionRangeSq: number): Node | null {
        let nearest: Node | null = null;
        let minSq = Infinity;
        for (const node of this.collectGroundRoleNodesFlat()) {
            const dx = node.worldPosition.x - myPos.x;
            const dy = node.worldPosition.y - myPos.y;
            const d2 = dx * dx + dy * dy;
            if (d2 <= detectionRangeSq && d2 < minSq) {
                minSq = d2;
                nearest = node;
            }
        }
        return nearest;
    }

    private isAliveGroundRole(node: Node): boolean {
        if (!node?.isValid || !node.active) {
            return false;
        }
        const role = node.getComponent('Role') as any;
        return !!(role && role.isFlying !== true && role.isAlive && role.isAlive());
    }

    private flashInFrontOfTarget(target: Node) {
        const tp = target.worldPosition;
        const ep = this.node.worldPosition;
        Vec3.subtract(this._flashDir, ep, tp);
        if (this._flashDir.lengthSqr() < 0.0001) {
            this._flashDir.set(0, 1, 0);
        } else {
            this._flashDir.normalize();
        }
        const standOff = Math.min(this.attackRange * 0.9, 80);
        Vec3.scaleAndAdd(this._flashPos, tp, this._flashDir, standOff);
        const clamped = this.clampPositionToScreen(this._flashPos);
        this.node.setWorldPosition(clamped);
    }
}
