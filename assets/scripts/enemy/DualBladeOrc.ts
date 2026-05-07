import { _decorator, find, Node, SpriteFrame, view, Vec3 } from 'cc';
import { Enemy } from './Enemy';

const { ccclass, property } = _decorator;

/**
 * 双刀兽人：优先索敌我方地面 Role；对地面 Role 普攻时有概率触发「剑舞」——
 * 以自身为圆心筛选范围内地面 Role，依次闪现至目标面前并以 3 倍攻速各斩一击。
 */
@ccclass('DualBladeOrc')
export class DualBladeOrc extends Enemy {
    @property({ tooltip: '剑舞：以自身为中心筛选我方地面 Role 的半径（像素）' })
    bladeDanceRadius: number = 200;

    @property({ tooltip: '剑舞：对地面 Role 发动普攻时触发概率（0~1）' })
    bladeDanceTriggerChance: number = 0.4;

    @property(SpriteFrame)
    bladeDanceAttackAnimationFrames: SpriteFrame[] = [];

    @property({ tooltip: '剑舞独立攻击动画总时长；0 表示与普通攻击动画时长一致' })
    bladeDanceAttackAnimationDuration: number = 0;

    @property({ tooltip: '剑舞独立 Animation 剪辑名；空则沿用普通攻击剪辑' })
    bladeDanceAttackAnimationName: string = '';

    public prefabName: string = 'DualBladeOrc';

    maxHealth: number = 48;
    moveSpeed: number = 52;
    attackDamage: number = 8;
    attackInterval: number = 1.0;
    attackRange: number = 60;
    collisionRadius: number = 2;
    unitName: string = '双刀兽人';
    unitDescription: string = '手持双刀，渴望战斗';
    goldReward: number = 3;
    expReward: number = 5;

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

    private _bladeDanceActive: boolean = false;
    private _bladeDanceTargets: Node[] = [];
    private _bladeDanceIndex: number = 0;

    private _savedAttackAnimationFrames: SpriteFrame[] | null = null;
    private _savedAttackAnimationDuration: number = 0;
    private _savedAttackAnimationName: string = '';

    private readonly _flashDir: Vec3 = new Vec3();
    private readonly _flashPos: Vec3 = new Vec3();
    private readonly _faceDir: Vec3 = new Vec3();

    protected shouldSkipRetarget(): boolean {
        return this._bladeDanceActive || super.shouldSkipRetarget();
    }

    protected resetEnemyState() {
        this.clearBladeDanceInternal();
        super.resetEnemyState();
    }

    protected findTargetInRange() {
        const screenHeight = view.getVisibleSize().height;
        const isInLowerThird = this.node.worldPosition.y < screenHeight / 3;
        const detectionRange = isInLowerThird ? 400 : 200;
        const detectionRangeSq = detectionRange * detectionRange;
        const myPos = this.node.worldPosition;

        const groundRole = this.findNearestGroundRoleInDetection(myPos, detectionRangeSq);
        if (groundRole) {
            this.currentTarget = groundRole;
            return;
        }
        super.findTargetInRange();
    }

    protected attack() {
        if (this._bladeDanceActive) {
            super.attack();
            return;
        }
        const chance = Math.min(1, Math.max(0, this.bladeDanceTriggerChance));
        if (
            this.currentTarget &&
            this.isAliveGroundRole(this.currentTarget) &&
            Math.random() < chance
        ) {
            const origin = this.node.worldPosition.clone();
            const targets = this.collectBladeDanceTargetsAround(origin);
            if (targets.length > 0) {
                this._bladeDanceActive = true;
                this._bladeDanceTargets = targets;
                this.runBladeDanceStrike(0);
                return;
            }
        }
        super.attack();
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
            return false;
        }
        this.restoreBladeDanceStrikeVisuals();
        const next = this._bladeDanceIndex + 1;
        if (next >= this._bladeDanceTargets.length) {
            this.clearBladeDanceInternal();
            return false;
        }
        this.isPlayingAttackAnimation = false;
        this.attackComplete = false;
        this.runBladeDanceStrike(next);
        return true;
    }

    private clearBladeDanceInternal() {
        this._bladeDanceActive = false;
        this._bladeDanceTargets = [];
        this._bladeDanceIndex = 0;
        this.restoreBladeDanceStrikeVisuals();
    }

    private applyBladeDanceStrikeVisuals() {
        this._savedAttackAnimationDuration = this.attackAnimationDuration;
        const baseDur =
            this.bladeDanceAttackAnimationFrames.length > 0 && this.bladeDanceAttackAnimationDuration > 0
                ? this.bladeDanceAttackAnimationDuration
                : this.attackAnimationDuration;
        this.attackAnimationDuration = baseDur / 3;
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

    private collectGroundRoleNodesFlat(): Node[] {
        const paths = [
            'Canvas/Towers',
            'Canvas/EagleArchers',
            'Canvas/Hunters',
            'Canvas/Mages',
            'Mages',
            'Canvas/ElfSwordsmans',
            'Canvas/Wisps',
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

    private collectBladeDanceTargetsAround(origin: Vec3): Node[] {
        const r = Math.max(1, this.bladeDanceRadius);
        const r2 = r * r;
        const list: { n: Node; d2: number }[] = [];
        for (const node of this.collectGroundRoleNodesFlat()) {
            if (!node?.isValid) {
                continue;
            }
            const role = node.getComponent('Role') as any;
            if (!role?.isAlive || !role.isAlive()) {
                continue;
            }
            const dx = node.worldPosition.x - origin.x;
            const dy = node.worldPosition.y - origin.y;
            const d2 = dx * dx + dy * dy;
            if (d2 <= r2) {
                list.push({ n: node, d2 });
            }
        }
        list.sort((a, b) => a.d2 - b.d2);
        return list.map((x) => x.n);
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

    private runBladeDanceStrike(startIndex: number) {
        let index = startIndex;
        while (index < this._bladeDanceTargets.length) {
            const t = this._bladeDanceTargets[index];
            if (!t?.isValid || !t.active || !this.isAliveGroundRole(t)) {
                index++;
                continue;
            }
            this._bladeDanceIndex = index;
            this.currentTarget = t;
            this.flashInFrontOfTarget(t);
            Vec3.subtract(this._faceDir, t.worldPosition, this.node.worldPosition);
            this.flipDirection(this._faceDir);
            this.playAttackAnimation();
            return;
        }
        this.clearBladeDanceInternal();
        if (!this.isDestroyed) {
            this.playIdleAnimation();
        }
    }
}
