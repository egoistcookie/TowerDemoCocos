import { _decorator, Component, Node, Vec3, find, MotionStreak, Color } from 'cc';
import { UnitType } from './UnitType';
import { GameState } from './GameState';
const { ccclass, property } = _decorator;

@ccclass('ArcaneMissile')
export class ArcaneMissile extends Component {
    @property
    speed: number = 400;

    @property
    baseArcHeight: number = 35;

    @property
    retargetRadius: number = 140;

    @property
    damage: number = 6;

    private targetNode: Node = null!;
    private ownerNode: Node = null!;
    private startPos: Vec3 = new Vec3();
    private targetPos: Vec3 = new Vec3();
    private travelTime: number = 0;
    private elapsedTime: number = 0;
    private isFlying: boolean = false;
    private randomArcScale: number = 1;
    private randomLateralAmp: number = 0;
    private randomLateralFreq: number = 0;
    private randomLateralPhase: number = 0;
    private gameManager: any = null;
    private onHitCallback: ((damage: number, hitDirection: Vec3, target: Node | null) => void) | null = null;
    // 跟随箭矢的实现：记录上帧位置与当前飞行方向
    private lastPos: Vec3 = new Vec3();
    private currentDirection: Vec3 = new Vec3(1, 0, 0);
    private trailNode: Node | null = null;

    init(
        startPos: Vec3,
        targetNode: Node,
        damage: number,
        ownerNode?: Node,
        onHit?: (damage: number, hitDirection: Vec3, target: Node | null) => void
    ) {
        this.startPos = startPos.clone();
        this.targetNode = targetNode;
        this.damage = damage;
        this.ownerNode = ownerNode || null!;
        this.onHitCallback = onHit || null;
        //console.info('[ArcaneMissile.init] damage=', damage, 'target=', targetNode?.name);

        this.randomArcScale = 0.7 + Math.random() * 1.2;
        // 缩小飞行横向摆动，整体曲线更平滑
        this.randomLateralAmp = 8 + Math.random() * 14;
        this.randomLateralFreq = 1.5 + Math.random() * 2.5;
        this.randomLateralPhase = Math.random() * Math.PI * 2;

        this.node.setWorldPosition(this.startPos);
        this.lastPos = this.startPos.clone();

        if (this.targetNode && this.targetNode.isValid && this.targetNode.active) {
            this.targetPos = this.targetNode.worldPosition.clone();
        } else {
            this.targetPos = this.startPos.clone();
            this.targetPos.x += 120;
        }

        this.refreshTravelTime();
        this.elapsedTime = 0;
        this.isFlying = this.travelTime > 0;

        // 初始朝向：面向目标位置
        const initialDir = new Vec3();
        Vec3.subtract(initialDir, this.targetPos, this.startPos);
        if (initialDir.length() > 0.0001) {
            initialDir.normalize();
            this.currentDirection.set(initialDir);
            const angle = Math.atan2(initialDir.y, initialDir.x) * 180 / Math.PI;
            this.node.setRotationFromEuler(0, 0, angle);
        }

        // 拖尾特效：挂在子节点，避免与飞弹节点上的 Sprite（Renderable）冲突
        let trailHost = this.trailNode;
        if (!trailHost || !trailHost.isValid) {
            trailHost = this.node.getChildByName('ArcaneMissileTrail');
        }
        if (!trailHost || !trailHost.isValid) {
            trailHost = new Node('ArcaneMissileTrail');
            trailHost.setParent(this.node);
            trailHost.setPosition(0, 0, 0);
            this.trailNode = trailHost;
        }
        let trail = trailHost.getComponent(MotionStreak);
        if (!trail) {
            trail = trailHost.addComponent(MotionStreak);
        }
        // 统一参数（无论首次还是复用）
        trail.fadeTime = 0.35;      // 拖尾消失时间
        trail.minSeg = 5;           // 最小分段
        trail.stroke = 10;          // 宽度
        trail.color = new Color(160, 200, 255, 200); // 淡蓝
        (trail as any).fastMode = true;
    }

    private refreshTravelTime() {
        const dx = this.startPos.x - this.targetPos.x;
        const dy = this.startPos.y - this.targetPos.y;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq < 0.01) {
            this.travelTime = 0;
            return;
        }
        const distance = Math.sqrt(distanceSq);
        this.travelTime = distance / this.speed;
    }

    private getEnemyScript(node: Node): any {
        if (!node || !node.isValid || !node.active) return null;
        const names = ['Portal', 'TrollSpearman', 'OrcWarrior', 'OrcWarlord', 'OrcShaman', 'Dragon', 'Enemy', 'Boss', 'MinotaurWarrior'];
        for (const name of names) {
            const comp = node.getComponent(name) as any;
            if (comp) return comp;
        }
        // 兼容其他敌人类型（如 Portal）：查找带有 unitType===ENEMY 的组件
        const comps = node?.components || [];
        for (const c of comps) {
            const anyComp = c as any;
            if (anyComp && anyComp.unitType === UnitType.ENEMY) {
                return anyComp;
            }
        }
        return null;
    }

    private isAliveEnemy(node: Node): boolean {
        const script = this.getEnemyScript(node);
        if (!script) return false;
        if (script.isAlive && typeof script.isAlive === 'function') {
            return !!script.isAlive();
        }
        if (script.currentHealth !== undefined) {
            return script.currentHealth > 0;
        }
        return true;
    }

    private findNearbyEnemy(currentPos: Vec3): Node | null {
        const enemiesNode = find('Canvas/Enemies') || find('Enemies');
        const portalsNode = find('Canvas/Portals') || null;
        if (!enemiesNode && !portalsNode) return null;
        const maxDistSq = this.retargetRadius * this.retargetRadius;
        let best: Node | null = null;
        let bestDistSq = Number.POSITIVE_INFINITY;
        const scanList: Node[] = [];
        if (enemiesNode) scanList.push(...enemiesNode.children);
        if (portalsNode) scanList.push(...portalsNode.children);
        for (const enemy of scanList) {
            if (!enemy || !enemy.isValid || !enemy.active) continue;
            if (!this.isAliveEnemy(enemy)) continue;
            const dx = enemy.worldPosition.x - currentPos.x;
            const dy = enemy.worldPosition.y - currentPos.y;
            const d = dx * dx + dy * dy;
            if (d <= maxDistSq && d < bestDistSq) {
                best = enemy;
                bestDistSq = d;
            }
        }
        return best;
    }

    private calculateCurvedPosition(ratio: number): Vec3 {
        const pos = new Vec3();
        Vec3.lerp(pos, this.startPos, this.targetPos, ratio);

        const arcRatio = 4 * ratio * (1 - ratio);
        pos.y += this.baseArcHeight * this.randomArcScale * arcRatio;

        const dir = new Vec3();
        Vec3.subtract(dir, this.targetPos, this.startPos);
        const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
        if (len > 0.0001) {
            const nx = dir.x / len;
            const ny = dir.y / len;
            const px = -ny;
            const py = nx;
            const wave = Math.sin(ratio * Math.PI * this.randomLateralFreq + this.randomLateralPhase);
            const lateral = this.randomLateralAmp * wave * (0.2 + 0.8 * arcRatio);
            pos.x += px * lateral;
            pos.y += py * lateral;
        }
        return pos;
    }

    private hitTarget() {
        this.isFlying = false;
        const hitDirection = new Vec3(this.currentDirection.x, this.currentDirection.y, this.currentDirection.z);
        if (hitDirection.length() <= 0.001) {
            Vec3.subtract(hitDirection, this.targetPos, this.startPos);
        }
        if (hitDirection.length() > 0.001) {
            hitDirection.normalize();
        } else {
            hitDirection.set(0, -1, 0);
        }
        //console.info('[ArcaneMissile.hitTarget] target=', this.targetNode?.name, 'damage=', this.damage);
        if (this.onHitCallback) {
            this.onHitCallback(this.damage, hitDirection, this.targetNode || null);
        }
        if (this.node && this.node.isValid) {
            this.node.destroy();
        }
    }

    update(deltaTime: number) {
        if (!this.isFlying) return;

        if (!this.gameManager) {
            const gmNode = find('GameManager') || find('Canvas/GameManager');
            if (gmNode) this.gameManager = gmNode.getComponent('GameManager' as any);
        }
        if (this.gameManager && this.gameManager.getGameState) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) return;
        }

        if (!this.targetNode || !this.targetNode.isValid || !this.targetNode.active || !this.isAliveEnemy(this.targetNode)) {
            const newTarget = this.findNearbyEnemy(this.node.worldPosition);
            if (newTarget) {
                this.targetNode = newTarget;
                this.startPos = this.node.worldPosition.clone();
                this.targetPos = newTarget.worldPosition.clone();
                this.elapsedTime = 0;
                this.refreshTravelTime();
            } else {
                if (this.node && this.node.isValid) this.node.destroy();
                return;
            }
        } else {
            this.targetPos = this.targetNode.worldPosition.clone();
        }

        if (this.travelTime <= 0) {
            this.hitTarget();
            return;
        }

        this.elapsedTime += deltaTime;
        const ratio = Math.min(this.elapsedTime / this.travelTime, 1);
        const currentPos = this.calculateCurvedPosition(ratio);
        this.node.setWorldPosition(currentPos);

        // 更新朝向：始终指向当前飞行方向（与 Arrow 一致）
        const dir = new Vec3();
        Vec3.subtract(dir, currentPos, this.lastPos);
        if (dir.length() > 0.1) {
            dir.normalize();
            this.currentDirection.set(dir);
            const angle = Math.atan2(dir.y, dir.x) * 180 / Math.PI;
            this.node.setRotationFromEuler(0, 0, angle);
        }
        this.lastPos = currentPos.clone();

        if (this.targetNode && this.targetNode.isValid) {
            const tp = this.targetNode.worldPosition;
            const dx = currentPos.x - tp.x;
            const dy = currentPos.y - tp.y;
            if (dx * dx + dy * dy < 26 * 26) {
                this.hitTarget();
                return;
            }
        }

        if (ratio >= 1) {
            this.hitTarget();
        }
    }
}
