import { _decorator, SpriteFrame, Vec3, tween, Tween, find, view, Node, AudioClip } from 'cc';
import { Enemy } from './Enemy';
import { AudioManager } from '../AudioManager';

const { ccclass, property } = _decorator;

/** 近战：优先扑「落单」我方单位（无目标或目标已是本狼）；其次脚下障碍；最后水晶。 */
@ccclass('Wolf')
export class Wolf extends Enemy {
    maxHealth: number = 50;
    moveSpeed: number = 78;
    attackDamage: number = 7;
    attackInterval: number = 0.65;
    attackRange: number = 58;
    collisionRadius: number = 2;
    unitName: string = '狼';
    unitDescription: string = '敏捷的掠食者，优先扑向落单单位，并能跃过石墙。';
    goldReward: number = 2;
    expReward: number = 4;
    prefabName: string = 'Wolf';

    /** 狼叫声单声道：有在播则不再叠新 */
    protected override playEnemyOneShotSfx(clip: AudioClip | null): void {
        if (!clip || !AudioManager.Instance) {
            return;
        }
        AudioManager.Instance.playWolfSFX(clip);
    }

    /** 狼不触发战斗口号（不配兽人进攻喊话） */
    override initDialogSystem() {}

    override updateDialogSystem(_deltaTime: number) {}

    override getRandomSlogan(): string {
        return '';
    }

    /** 越墙后沿 y 轴净下移（世界坐标），一次 tween 直接越过障碍，不再先做向上弧 */
    private static readonly WALL_JUMP_CLEAR_Y = 60;
    /** 索敌用：正下方石墙的水平对齐容差（像素） */
    private static readonly WALL_ALIGN_X_TOL = 52;

    private _wallJumpActive = false;
    private _wallJumpCooldown = 0;
    /** 扑向单位途中越墙：起跳前暂存攻击目标，落地后恢复 */
    private _postWallJumpRestoreTarget: Node | null = null;

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

    /** 可选：跳跃序列帧；未配置时用行走动画代替 */
    @property({ type: [SpriteFrame], tooltip: '跳跃动画帧（可选）' })
    jumpAnimationFrames: SpriteFrame[] = [];

    @property
    jumpAnimationDuration: number = 0.4;

    private _jumpAnimTimer = 0;
    private _jumpFrameIndex = 0;

    /** 缓存 Canvas / 石墙 / Wolves 容器，减轻 lateUpdate 压力；场景切换时由 isValid / scene 校验 */
    private _layerCanvas: Node | null = null;
    private _layerStoneWalls: Node | null = null;
    private _layerWolves: Node | null = null;

    /**
     * 渲染层级：见 docs/节点路径.md「Canvas 节点层级顺序」——石墙约索引 30，哨塔/冰塔/雷塔约 26–28，
     * 狼需在 StoneWalls 之后绘制；做法同角鹰射手将单位挪到独立容器。
     *
     * 注意：`EnemyPool.get()` 里会先 `active=true` 触发本组件 onEnable（此时可能已挂到 Wolves），
     * 随后 `EnemySpawner.doSpawnEnemyAt` 会把节点 `setParent(Canvas/Enemies)`，从池取出的狼会因此
     * 长期留在 Enemies 下，与石墙的兄弟顺序无关，表现为随机被石墙遮挡。start() 只跑一遍无法补救，
     * 故在 lateUpdate 中每帧校正（逻辑轻：多数帧仅若干次比较）。
     */
    private ensureWolfRenderLayer() {
        const scene = this.node.scene;
        if (!this._layerCanvas?.isValid || this._layerCanvas.scene !== scene) {
            this._layerCanvas = find('Canvas');
        }
        if (!this._layerStoneWalls?.isValid || this._layerStoneWalls.scene !== scene) {
            this._layerStoneWalls = find('Canvas/StoneWalls');
        }
        if (!this._layerWolves?.isValid || this._layerWolves.scene !== scene) {
            this._layerWolves = find('Canvas/Wolves');
        }
        const canvas = this._layerCanvas;
        const stoneWalls = this._layerStoneWalls;
        if (!canvas?.isValid || !stoneWalls?.isValid || !this.node?.isValid) {
            return;
        }

        let wolves = this._layerWolves;
        if (!wolves?.isValid) {
            wolves = new Node('Wolves');
            wolves.setParent(canvas);
            this._layerWolves = wolves;
        }

        if (wolves.parent === canvas && stoneWalls.parent === canvas) {
            const swIdx = stoneWalls.getSiblingIndex();
            // 石墙节点在战斗中可能被挪到更后（索引变大），仅「创建时」调一次会漏；保持 Wolves 始终在石墙之上
            if (wolves.getSiblingIndex() <= swIdx) {
                wolves.setSiblingIndex(swIdx + 1);
            }
        }

        if (this.node.parent !== wolves) {
            this.node.setParent(wolves, true);
        }
    }

    start() {
        super.start();
        this.ensureWolfRenderLayer();
    }

    onEnable() {
        super.onEnable();
        Tween.stopAllByTarget(this.node);
        this._wallJumpActive = false;
        this._wallJumpCooldown = 0;
        this._jumpAnimTimer = 0;
        this._jumpFrameIndex = 0;
        this._postWallJumpRestoreTarget = null;
        this.ensureWolfRenderLayer();
    }

    update(deltaTime: number) {
        if (this._wallJumpCooldown > 0) {
            this._wallJumpCooldown -= deltaTime;
        }
        super.update(deltaTime);
        if (this._wallJumpActive && this.jumpAnimationFrames.length > 0 && this.sprite) {
            this._jumpAnimTimer += deltaTime;
            const n = this.jumpAnimationFrames.length;
            const fd = Math.max(0.05, this.jumpAnimationDuration / n);
            const idx = Math.min(n - 1, Math.floor(this._jumpAnimTimer / fd));
            if (idx !== this._jumpFrameIndex) {
                this._jumpFrameIndex = idx;
                const sf = this.jumpAnimationFrames[idx];
                if (sf) {
                    this.sprite.spriteFrame = sf;
                }
            }
        }
    }

    /**
     * 在刷怪等逻辑于同一帧内再次改父节点之后，把狼挂回 Canvas/Wolves 并校正与石墙的先后级。
     */
    lateUpdate() {
        this.ensureWolfRenderLayer();
    }

    protected shouldSkipRetarget(): boolean {
        return this._wallJumpActive;
    }

    protected resolveCombatMovement(distanceSq: number, attackRangeSq: number, deltaTime: number): 'attack' | 'move' | 'handled' {
        if (this._wallJumpActive) {
            this.stopMoving();
            return 'handled';
        }
        const obsNode = this.currentTarget;
        // 攻击目标在我方单位/水晶时：若竖直路径上隔着石墙且已贴墙，先越墙再起扑
        if (obsNode?.isValid && !this.isJumpObstacleTarget(obsNode)) {
            const pathWall = this.findStoneWallBetweenSelfAndDescentTarget(obsNode);
            if (
                pathWall &&
                this.getBlockingStoneWall(this.node.worldPosition) === pathWall
            ) {
                const saved = this.currentTarget;
                this.currentTarget = pathWall;
                if (this.tryStartObstacleJump(distanceSq, attackRangeSq)) {
                    this._postWallJumpRestoreTarget = saved;
                    this.stopMoving();
                    return 'handled';
                }
                this.currentTarget = saved;
            }
        }
        if (obsNode && this.isJumpObstacleTarget(obsNode) && this.isObstacleStrictlyBelow(obsNode)) {
            if (this.tryStartObstacleJump(distanceSq, attackRangeSq)) {
                this.stopMoving();
                return 'handled';
            }
            // 越障目标：不普攻，只对齐后 tween 越过（石墙 / 防御塔）
            return 'move';
        }
        return super.resolveCombatMovement(distanceSq, attackRangeSq, deltaTime);
    }

    /** 狼可跳过：石墙、哨塔、冰塔、雷塔（均在脚下时） */
    private isJumpObstacleTarget(node: Node): boolean {
        if (!node?.isValid) {
            return false;
        }
        return !!(
            node.getComponent('StoneWall') ||
            node.getComponent('WatchTower') ||
            node.getComponent('IceTower') ||
            node.getComponent('ThunderTower')
        );
    }

    private isObstacleStrictlyBelow(obstacleNode: Node): boolean {
        return obstacleNode.worldPosition.y < this.node.worldPosition.y - 0.5;
    }

    /** 与石墙 getBlockingStoneWall 一致；防御塔用圆心距 < 半径和 */
    private isTouchingCurrentJumpObstacle(): boolean {
        const target = this.currentTarget;
        if (!target?.isValid) {
            return false;
        }
        const my = this.node.worldPosition;

        if (target.getComponent('StoneWall')) {
            return this.getBlockingStoneWall(my) === target;
        }

        const towerScript =
            (target.getComponent('WatchTower') as any) ||
            (target.getComponent('IceTower') as any) ||
            (target.getComponent('ThunderTower') as any);
        if (!towerScript || (towerScript.isAlive && !towerScript.isAlive())) {
            return false;
        }

        const enemyRadius = 20;
        const towerR = towerScript.collisionRadius ?? 50;
        const minD = enemyRadius + towerR;
        const tp = target.worldPosition;
        const dx = my.x - tp.x;
        const dy = my.y - tp.y;
        const distSq = dx * dx + dy * dy;
        return distSq < minD * minD;
    }

    /**
     * 已与当前越障目标「贴合」时才起跳（石墙同全局阻挡；塔同圆形碰撞）
     */
    private tryStartObstacleJump(_distanceSq: number, _attackRangeSq: number): boolean {
        if (this._wallJumpCooldown > 0) {
            return false;
        }
        if (!this.currentTarget?.isValid || !this.isJumpObstacleTarget(this.currentTarget)) {
            return false;
        }
        const my = this.node.worldPosition;
        const o = this.currentTarget.worldPosition;
        if (my.y <= o.y + 0.5) {
            return false;
        }
        if (!this.isTouchingCurrentJumpObstacle()) {
            return false;
        }

        this._wallJumpActive = true;
        this._jumpAnimTimer = 0;
        this._jumpFrameIndex = -1;
        if (this.jumpAnimationFrames.length === 0) {
            this.playWalkAnimation();
        }

        const start = this.node.worldPosition;
        const end = new Vec3(start.x, start.y - Wolf.WALL_JUMP_CLEAR_Y, start.z);
        const clampRef = this.clampPositionToScreen(new Vec3(end.x, end.y, end.z));
        const clampedEnd = new Vec3(clampRef.x, clampRef.y, clampRef.z);

        tween(this.node)
            .to(0.32, { worldPosition: clampedEnd }, { easing: 'quadIn' })
            .call(() => this.onObstacleJumpDone())
            .start();

        return true;
    }

    private onObstacleJumpDone() {
        this._wallJumpActive = false;
        const restore = this._postWallJumpRestoreTarget;
        this._postWallJumpRestoreTarget = null;
        if (restore && restore.isValid && restore.active) {
            this.currentTarget = restore;
        } else {
            this.currentTarget = null!;
        }
        this._wallJumpCooldown = 0.45;
        this._jumpAnimTimer = 0;
        this._jumpFrameIndex = 0;
        if (!this.isDestroyed) {
            this.playIdleAnimation();
        }
    }

    /**
     * 我方已有「别的」攻击/治疗目标时无视（扑落单）；若目标就是本狼，仍参与优先级一。
     */
    private isFriendlyWithAttackTarget(script: any): boolean {
        const t = script?.currentTarget as Node | null;
        if (!t || !t.isValid || !t.active) {
            return false;
        }
        if (t === this.node) {
            return false;
        }
        return true;
    }

    /**
     * 当前攻击目标在狼下方、中间隔着一道石墙（竖直带内），用于「扑人途中」贴墙起跳。
     * 取 wolf→target 之间 y 最大的一道墙（最靠上、最先撞上）。
     */
    private findStoneWallBetweenSelfAndDescentTarget(target: Node): Node | null {
        if (!target?.isValid) {
            return null;
        }
        const my = this.node.worldPosition;
        const tp = target.worldPosition;
        const stoneWallsNode = find('Canvas/StoneWalls');
        if (!stoneWallsNode) {
            return null;
        }
        let best: Node | null = null;
        let bestWallY = -Infinity;
        for (const wall of stoneWallsNode.children) {
            if (!wall?.active || !wall.isValid) {
                continue;
            }
            const wallScript = wall.getComponent('StoneWall') as any;
            if (!wallScript?.isAlive?.()) {
                continue;
            }
            if (wallScript.isSpikeTrapActive?.()) {
                continue;
            }
            const wp = wall.worldPosition;
            if (!(wp.y < my.y - 0.5)) {
                continue;
            }
            if (!(tp.y < wp.y - 0.5)) {
                continue;
            }
            if (Math.abs(wp.x - my.x) > Wolf.WALL_ALIGN_X_TOL) {
                continue;
            }
            if (Math.abs(tp.x - wp.x) > Wolf.WALL_ALIGN_X_TOL * 2) {
                continue;
            }
            if (wp.y > bestWallY) {
                bestWallY = wp.y;
                best = wall;
            }
        }
        return best;
    }

    /** 优先级二：脚下方的石墙或防御塔（与狼 x 对齐），取索敌范围内最近者 */
    private considerJumpObstacleCandidate(
        node: Node,
        myPos: Vec3,
        detectionRangeSq: number,
        state: { best: Node | null; bestSq: number }
    ) {
        if (!node?.active || !node.isValid) {
            return;
        }
        if (node.worldPosition.y >= myPos.y) {
            return;
        }
        const dx = Math.abs(node.worldPosition.x - myPos.x);
        if (dx > Wolf.WALL_ALIGN_X_TOL) {
            return;
        }
        const ddx = node.worldPosition.x - myPos.x;
        const ddy = node.worldPosition.y - myPos.y;
        const dSq = ddx * ddx + ddy * ddy;
        if (dSq <= detectionRangeSq && dSq < state.bestSq) {
            state.bestSq = dSq;
            state.best = node;
        }
    }

    /**
     * 与 Enemy.findTargetInRange 一致：按组件名取我方战斗单位（Arrower 节点上没有名为 Role 的组件，不能 getComponent('Role')）。
     */
    private considerFriendlyUnitForPriorityOne(
        node: Node,
        script: any,
        myPos: Vec3,
        detectionRangeSq: number,
        isGroundMelee: boolean,
        state: { best: Node | null; bestSq: number }
    ) {
        if (!node.isValid || !node.active || !script) {
            return;
        }
        if (script.isAlive && typeof script.isAlive === 'function' && !script.isAlive()) {
            return;
        }
        if (this.isFriendlyWithAttackTarget(script)) {
            return;
        }
        if (isGroundMelee && script.isFlying === true) {
            return;
        }
        const dx = node.worldPosition.x - myPos.x;
        const dy = node.worldPosition.y - myPos.y;
        const dSq = dx * dx + dy * dy;
        if (dSq <= detectionRangeSq && dSq < state.bestSq) {
            state.bestSq = dSq;
            state.best = node;
        }
    }

    protected findTargetInRange() {
        const screenHeight = view.getVisibleSize().height;
        const isInLowerThird = this.node.worldPosition.y < screenHeight / 3;
        const detectionRange = isInLowerThird ? 400 : 200;
        const detectionRangeSq = detectionRange * detectionRange;
        const myPos = this.node.worldPosition;
        const isGroundMelee = this.attackRange < 100;

        const state = { best: null as Node | null, bestSq: Infinity };

        const towersNode = find('Canvas/Towers') || find('Towers');
        if (towersNode) {
            for (const tower of towersNode.children) {
                if (!tower?.active || !tower.isValid) {
                    continue;
                }
                const arrowerScript = tower.getComponent('Arrower') as any;
                const priestScript = tower.getComponent('Priest') as any;
                if (arrowerScript) {
                    this.considerFriendlyUnitForPriorityOne(tower, arrowerScript, myPos, detectionRangeSq, isGroundMelee, state);
                } else if (priestScript) {
                    this.considerFriendlyUnitForPriorityOne(tower, priestScript, myPos, detectionRangeSq, isGroundMelee, state);
                }
            }
        }

        const eagleArchersNode = find('Canvas/EagleArchers');
        if (eagleArchersNode) {
            for (const unit of eagleArchersNode.children) {
                if (!unit?.active || !unit.isValid) {
                    continue;
                }
                const eagleArcherScript = unit.getComponent('EagleArcher') as any;
                if (eagleArcherScript) {
                    this.considerFriendlyUnitForPriorityOne(unit, eagleArcherScript, myPos, detectionRangeSq, isGroundMelee, state);
                }
            }
        }

        const huntersNode = find('Canvas/Hunters');
        if (huntersNode) {
            for (const hunter of huntersNode.children) {
                if (!hunter?.active || !hunter.isValid) {
                    continue;
                }
                const hunterScript = hunter.getComponent('Hunter') as any;
                if (hunterScript) {
                    this.considerFriendlyUnitForPriorityOne(hunter, hunterScript, myPos, detectionRangeSq, isGroundMelee, state);
                }
            }
        }

        const magesNode = find('Canvas/Mages') || find('Mages');
        if (magesNode) {
            for (const mage of magesNode.children) {
                if (!mage?.active || !mage.isValid) {
                    continue;
                }
                const mageScript = mage.getComponent('Mage') as any;
                if (mageScript) {
                    this.considerFriendlyUnitForPriorityOne(mage, mageScript, myPos, detectionRangeSq, isGroundMelee, state);
                }
            }
        }

        const swordsmenNode = find('Canvas/ElfSwordsmans');
        if (swordsmenNode) {
            for (const swordsman of swordsmenNode.children) {
                if (!swordsman?.active || !swordsman.isValid) {
                    continue;
                }
                const swordsmanScript = swordsman.getComponent('ElfSwordsman') as any;
                if (swordsmanScript) {
                    this.considerFriendlyUnitForPriorityOne(swordsman, swordsmanScript, myPos, detectionRangeSq, isGroundMelee, state);
                }
            }
        }

        const best = state.best;

        if (best) {
            this.currentTarget = best;
            return;
        }

        const obstacleState = { best: null as Node | null, bestSq: Infinity };

        const stoneWallsNode = find('Canvas/StoneWalls');
        if (stoneWallsNode) {
            for (const wall of stoneWallsNode.children) {
                if (!wall?.active || !wall.isValid) {
                    continue;
                }
                const wallScript = wall.getComponent('StoneWall') as any;
                if (!wallScript?.isAlive?.()) {
                    continue;
                }
                if (wallScript.isSpikeTrapActive?.()) {
                    continue;
                }
                this.considerJumpObstacleCandidate(wall, myPos, detectionRangeSq, obstacleState);
            }
        }

        const scanDefenseTowers = (containerPath: string, componentName: string) => {
            const cont = find(containerPath);
            if (!cont) {
                return;
            }
            for (const towerNode of cont.children) {
                if (!towerNode?.active || !towerNode.isValid) {
                    continue;
                }
                const ts = towerNode.getComponent(componentName) as any;
                if (!ts?.isAlive?.()) {
                    continue;
                }
                this.considerJumpObstacleCandidate(towerNode, myPos, detectionRangeSq, obstacleState);
            }
        };
        scanDefenseTowers('Canvas/WatchTowers', 'WatchTower');
        scanDefenseTowers('Canvas/IceTowers', 'IceTower');
        scanDefenseTowers('Canvas/ThunderTowers', 'ThunderTower');

        if (obstacleState.best) {
            this.currentTarget = obstacleState.best;
            return;
        }

        if (this.targetCrystal?.isValid) {
            const crystalScript = this.targetCrystal.getComponent('Crystal') as any;
            if (crystalScript?.isAlive?.()) {
                const dx = this.targetCrystal.worldPosition.x - myPos.x;
                const dy = this.targetCrystal.worldPosition.y - myPos.y;
                const dSq = dx * dx + dy * dy;
                if (dSq <= detectionRangeSq) {
                    this.currentTarget = this.targetCrystal;
                    return;
                }
            }
        }

        this.currentTarget = null!;
    }
}
