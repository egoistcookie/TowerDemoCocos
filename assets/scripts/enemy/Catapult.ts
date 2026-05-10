import { _decorator, Prefab, Node, Vec3, find, instantiate, SpriteFrame } from 'cc';
import { Enemy } from './Enemy';
import { IronBlock } from '../IronBlock';
import { getWatchTowerFamilyScript } from '../WatchTowerFamily';

const { ccclass, property } = _decorator;

/**
 * 投石车：移速极慢，索敌**水晶优先**，其次我方石墙与建筑（防御塔 / 大厅 / 古树 / 教堂等），远程 600 像素、3 秒一发；
 * 攻城器械不受堵门燃血狂暴与战争咆哮数值影响。攻击动画半程投掷 {@link IronBlock}（抛物线范围伤害，参数与炮弹一致）。
 * 贴图默认朝下时通过 {@link Catapult.facingAngleOffsetDeg} 与每帧 {@link Catapult.refreshFacingTowardTarget} 使车身始终朝向当前目标。
 */
@ccclass('Catapult')
export class Catapult extends Enemy {
    maxHealth: number = 220;
    moveSpeed: number = 18;
    attackDamage: number = 32;
    attackInterval: number = 3;
    attackRange: number = 600;
    collisionRadius: number = 2;
    unitName: string = '投石车';
    unitDescription: string = '缓慢的攻城器械，以我方石墙与建筑为目标，投掷铁块造成范围伤害；不受燃血狂暴与战争咆哮影响。';
    goldReward: number = 10;
    expReward: number = 10;
    prefabName: string = 'Catapult';
    attackAnimationDuration: number = 0.65;

    @property(Prefab)
    ironBlockPrefab: Prefab = null!;

    /**
     * 贴图在 angle=0 时朝向屏幕 -Y（朝下）时，与数学方位角 atan2(dy,dx) 的差值（度）。
     * 若炮口未指向目标，在编辑器中微调本项（或勾选 {@link Catapult.invertFacingAngle}）。
     */
    @property
    facingAngleOffsetDeg: number = 90;

    @property({ tooltip: '勾选则对最终朝向角取反，用于快速修正左右反了的情况' })
    invertFacingAngle: boolean = false;

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

    /** 攻城器械：不受堵门燃血狂暴与督军/牛头战争咆哮加成 */
    protected override ignoresBloodRageAndWarcry(): boolean {
        return true;
    }

    /** 投石车不触发兽人进攻战斗口号 */
    override initDialogSystem() {}

    override updateDialogSystem(_deltaTime: number) {}

    override getRandomSlogan(): string {
        return '';
    }

    private readonly _faceTargetWorld = new Vec3();

    update(deltaTime: number) {
        super.update(deltaTime);
        if (!this.isDestroyed && !this.isPlayingDeathAnimation) {
            this.refreshFacingTowardTarget();
        }
    }

    /**
     * 不用水平 scale 翻转朝向，避免与车身旋转冲突（朝向由 angle 负责）。
     * 不访问父类私有 dialogNode：投石车已禁用战斗口号，无对话框子节点。
     */
    override flipDirection(_direction: Vec3) {
        this.node.setScale(Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
        this.syncHealthBarFacingFromParent();
    }

    /** 使车身 angle 指向目标；无有效目标时面向默认下移方向 (0,-1) */
    private refreshFacingTowardTarget() {
        let dx = 0;
        let dy = -1;
        if (this.currentTarget?.isValid && this.currentTarget.active) {
            this.currentTarget.getWorldPosition(this._faceTargetWorld);
            dx = this._faceTargetWorld.x - this.node.worldPosition.x;
            dy = this._faceTargetWorld.y - this.node.worldPosition.y;
        }
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-6) {
            return;
        }
        const inv = 1 / Math.sqrt(lenSq);
        dx *= inv;
        dy *= inv;
        const baseDeg = Math.atan2(dy, dx) * (180 / Math.PI);
        // 与 Cocos 2D 的 node.angle 约定一致：此处用「+」避免目标在右侧时车身朝左
        let angle = baseDeg + this.facingAngleOffsetDeg;
        if (this.invertFacingAngle) {
            angle = -angle;
        }
        this.node.angle = angle;
    }

    protected pickSimpleAIDetectionRangeSq(): number {
        const margin = 120;
        const r = Math.max(this.attackRange + margin, 400);
        return r * r;
    }

    /** 收集索敌目标：范围内**存活水晶**始终最高优先级，否则最近的石墙或建筑。 */
    protected findTargetInRange() {
        const myPos = this.node.worldPosition;
        const detectionRangeSq = this.pickSimpleAIDetectionRangeSq();

        if (!this.targetCrystal || !this.targetCrystal.isValid) {
            this.targetCrystal = find('Crystal') || find('Canvas/Crystal') || null!;
        }
        if (this.targetCrystal?.isValid && this.targetCrystal.activeInHierarchy) {
            const crystalScript = this.targetCrystal.getComponent('Crystal') as any;
            if (crystalScript?.isAlive && crystalScript.isAlive()) {
                const cx = this.targetCrystal.worldPosition.x - myPos.x;
                const cy = this.targetCrystal.worldPosition.y - myPos.y;
                const cSq = cx * cx + cy * cy;
                if (cSq <= detectionRangeSq) {
                    this.currentTarget = this.targetCrystal;
                    return;
                }
            }
        }

        let nearestTarget: Node | null = null;
        let minDistanceSq = Infinity;

        const consider = (node: Node | null) => {
            if (!node?.isValid || !node.activeInHierarchy) {
                return;
            }
            const dx = node.worldPosition.x - myPos.x;
            const dy = node.worldPosition.y - myPos.y;
            const dSq = dx * dx + dy * dy;
            if (dSq > detectionRangeSq || dSq >= minDistanceSq) {
                return;
            }
            minDistanceSq = dSq;
            nearestTarget = node;
        };

        const stoneWallsNode = find('Canvas/StoneWalls');
        if (stoneWallsNode) {
            for (const wall of stoneWallsNode.children) {
                if (!wall?.isValid || !wall.activeInHierarchy) {
                    continue;
                }
                const wallScript = wall.getComponent('StoneWall') as any;
                if (wallScript?.isAlive && wallScript.isAlive()) {
                    if (wallScript.isSpikeTrapActive && wallScript.isSpikeTrapActive()) {
                        continue;
                    }
                    consider(wall);
                }
            }
        }

        const watchTowersNode = find('Canvas/WatchTowers');
        if (watchTowersNode) {
            for (const tower of watchTowersNode.children) {
                const s = getWatchTowerFamilyScript(tower);
                if (s?.isAlive && s.isAlive()) {
                    consider(tower);
                }
            }
        }

        const iceTowersNode = find('Canvas/IceTowers');
        if (iceTowersNode) {
            for (const tower of iceTowersNode.children) {
                const s = tower.getComponent('IceTower') as any;
                if (s?.isAlive && s.isAlive()) {
                    consider(tower);
                }
            }
        }

        const thunderTowersNode = find('Canvas/ThunderTowers');
        if (thunderTowersNode) {
            for (const tower of thunderTowersNode.children) {
                const s = tower.getComponent('ThunderTower') as any;
                if (s?.isAlive && s.isAlive()) {
                    consider(tower);
                }
            }
        }

        const treesNode = find('Canvas/WarAncientTrees');
        if (treesNode) {
            for (const tree of treesNode.children) {
                const s = tree.getComponent('WarAncientTree') as any;
                if (s?.isAlive && s.isAlive()) {
                    consider(tree);
                }
            }
        }

        const hallsNode = find('Canvas/HunterHalls');
        if (hallsNode) {
            for (const hall of hallsNode.children) {
                const s = hall.getComponent('HunterHall') as any;
                if (s?.isAlive && s.isAlive()) {
                    consider(hall);
                }
            }
        }

        const mageTowersNode = find('Canvas/MageTowers');
        if (mageTowersNode) {
            for (const tower of mageTowersNode.children) {
                const s = tower.getComponent('MageTower') as any;
                if (s?.isAlive && s.isAlive()) {
                    consider(tower);
                }
            }
        }

        const swordsmanHallsNode = find('Canvas/SwordsmanHalls');
        if (swordsmanHallsNode) {
            for (const hall of swordsmanHallsNode.children) {
                const s = hall.getComponent('SwordsmanHall') as any;
                if (s?.isAlive && s.isAlive()) {
                    consider(hall);
                }
            }
        }

        const churchesNode = find('Canvas/Churches');
        if (churchesNode) {
            for (const church of churchesNode.children) {
                const s = church.getComponent('Church') as any;
                if (s?.isAlive && s.isAlive()) {
                    consider(church);
                }
            }
        }

        this.currentTarget = nearestTarget || null!;
    }

    /**
     * 索敌未命中任何建筑时，仍朝水晶移动（攻城单位）；水晶已毁则保持无目标由基类下移。
     */
    protected tryEnsureFallbackCombatTarget(): void {
        if (this.currentTarget?.isValid) {
            return;
        }
        if (!this.targetCrystal || !this.targetCrystal.isValid) {
            this.targetCrystal = find('Crystal') || find('Canvas/Crystal') || null!;
        }
        if (this.targetCrystal?.isValid && this.targetCrystal.activeInHierarchy) {
            const crystalScript = this.targetCrystal.getComponent('Crystal') as any;
            if (crystalScript?.isAlive && crystalScript.isAlive()) {
                this.currentTarget = this.targetCrystal;
            }
        }
    }

    override playAttackAnimation() {
        if (this.isPlayingDeathAnimation || this.isDestroyed) {
            return;
        }

        if (this.attackAnimationFrames && this.attackAnimationFrames.length > 0) {
            super.playAttackAnimation();
            return;
        }

        this.stopAllAnimations();
        this.isPlayingAttackAnimation = true;
        this.attackComplete = false;

        if (this.attackSound) {
            this.playEnemyOneShotSfx(this.attackSound);
        }

        const mid = Math.max(0.05, this.attackAnimationDuration * 0.5);
        this.scheduleOnce(() => {
            if (!this.node?.isValid || this.isDestroyed) {
                return;
            }
            if (this.isPlayingAttackAnimation && !this.attackComplete) {
                this.dealDamage();
                this.attackComplete = true;
            }
        }, mid);

        this.scheduleOnce(() => {
            if (!this.node?.isValid || this.isDestroyed) {
                return;
            }
            if (this.isPlayingAttackAnimation) {
                this.handleAttackAnimationEnded();
            }
        }, Math.max(mid + 0.05, this.attackAnimationDuration));
    }

    protected dealDamage() {
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }

        const targetPos = this.currentTarget.worldPosition;
        const enemyPos = this.node.worldPosition;
        const dx = targetPos.x - enemyPos.x;
        const dy = targetPos.y - enemyPos.y;
        const distanceSq = dx * dx + dy * dy;
        const attackRangeSq = this.attackRange * this.attackRange;
        if (distanceSq > attackRangeSq) {
            this.isPlayingAttackAnimation = false;
            this.attackComplete = false;
            this.playIdleAnimation();
            return;
        }

        if (!this.ironBlockPrefab) {
            return;
        }

        this.refreshFacingTowardTarget();

        const canvas = find('Canvas');
        const parentNode = canvas || this.node.scene || this.node.parent;
        const block = instantiate(this.ironBlockPrefab);
        if (parentNode) {
            block.setParent(parentNode);
        } else {
            block.setParent(this.node.parent);
        }
        block.active = true;

        const startPos = this.node.worldPosition.clone();
        block.setWorldPosition(startPos);

        let script = block.getComponent(IronBlock);
        if (!script) {
            script = block.addComponent(IronBlock);
        }
        script.init(startPos, this.currentTarget, this.attackDamage);
    }
}
