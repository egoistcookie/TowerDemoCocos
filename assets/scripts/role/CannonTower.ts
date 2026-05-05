import { _decorator, Prefab, instantiate, find, SpriteFrame, Vec3, UITransform } from 'cc';
import { WatchTower, ConstructionStage } from './WatchTower';
import { UnitInfo } from '../UnitInfoPanel';
import { CannonBall } from '../CannonBall';
const { ccclass, property } = _decorator;

/**
 * 炮塔：由哨塔升级而来，慢攻速、抛物线炮弹、落点 AoE。
 */
@ccclass('CannonTower')
export class CannonTower extends WatchTower {
    @property(Prefab)
    cannonBallPrefab: Prefab = null!;

    /** 炮塔攻击前摇序列帧（独立于哨塔） */
    @property({ type: [SpriteFrame] })
    cannonAttackAnimationFrames: SpriteFrame[] = [];

    @property
    cannonAttackAnimationDuration: number = 0.45;

    /** 炮塔以炮弹为准；仅有箭矢预制体无炮弹时不再误判为远程（否则 fireProjectile 打不出伤害） */
    protected hasRangedProjectile(): boolean {
        return !!this.cannonBallPrefab;
    }

    onEnable() {
        super.onEnable();
        this.constructionStage = ConstructionStage.COMPLETE;
        this.constructionProgress = 0;
        this.constructionTimer = 0;
        if (this.constructionProgressBar) {
            this.constructionProgressBar.active = false;
        }
        this.scheduleOnce(() => this.updateSprite(), 0);
    }

    protected start() {
        super.start();
        this.constructionStage = ConstructionStage.COMPLETE;
        this.constructionProgress = 0;
        this.constructionTimer = 0;
        if (this.constructionProgressBar) {
            this.constructionProgressBar.active = false;
        }
        this.updateSprite();
    }

    /** 覆盖哨塔九宫格信息：无「升级炮塔」按钮 */
    protected buildUnitInfo(): UnitInfo {
        return {
            name: '炮塔',
            level: this.level,
            currentHealth: this.currentHealth,
            maxHealth: this.maxHealth,
            attackDamage: this.attackDamage,
            attackFrequency: 1.0 / this.attackInterval,
            populationCost: this.populationCost,
            icon: this.cardIcon || this.defaultSpriteFrame,
            collisionRadius: this.collisionRadius,
            onSellClick: () => {
                this.onSellClick();
            },
        };
    }

    /**
     * 炮塔使用炮弹；攻击前可播放独立序列帧。
     */
    protected fireProjectile(): void {
        const frames = (this.cannonAttackAnimationFrames || []).filter((f) => f != null);
        const delay = Math.max(0.15, Number(this.cannonAttackAnimationDuration) || 0.45);
        if (!frames.length || !this.sprite) {
            this.spawnCannonBall();
            return;
        }
        const sp = this.sprite;
        const durPer = delay / frames.length;
        let idx = 0;
        sp.spriteFrame = frames[0];
        let acc = 0;
        const step = (dt: number) => {
            acc += dt;
            const next = Math.min(frames.length - 1, Math.floor(acc / durPer));
            if (next !== idx && frames[next]) {
                idx = next;
                sp.spriteFrame = frames[next];
            }
            if (acc >= delay) {
                this.unschedule(step);
                this.spawnCannonBall();
                this.updateSprite();
            }
        };
        this.schedule(step, 0);
    }

    /**
     * 炮口在世界坐标中的位置：炮塔精灵顶边中心（节点锚点一般在中心，不能直接用语节点坐标）。
     */
    private getCannonMuzzleWorldPosition(out: Vec3): Vec3 {
        const ui = this.node.getComponent(UITransform);
        if (ui && ui.width > 1 && ui.height > 1) {
            const localTopCenter = new Vec3((0.5 - ui.anchorX) * ui.width, (1 - ui.anchorY) * ui.height, 0);
            return ui.convertToWorldSpaceAR(localTopCenter, out);
        }
        out.set(this.node.worldPosition);
        const bump = this.collisionRadius > 0 ? this.collisionRadius * 0.5 : 28;
        out.y += bump;
        return out;
    }

    private spawnCannonBall(): void {
        if (!this.cannonBallPrefab || !this.currentTarget) {
            return;
        }
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            return;
        }

        const ball = instantiate(this.cannonBallPrefab);
        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            ball.setParent(parentNode);
        } else {
            ball.setParent(this.node.parent);
        }

        const startPos = this.getCannonMuzzleWorldPosition(new Vec3());
        ball.setWorldPosition(startPos);
        ball.active = true;

        let ballScript = ball.getComponent(CannonBall);
        if (!ballScript) {
            ballScript = ball.addComponent(CannonBall);
        }

        const targetNode = this.currentTarget;
        ballScript.init(startPos, targetNode, this.attackDamage, this);
    }
}
