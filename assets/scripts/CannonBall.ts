import { _decorator, Component, Node, Vec3, Sprite, SpriteFrame, find, AudioClip, UITransform } from 'cc';
import { GameState } from './GameState';
import { AudioManager } from './AudioManager';
import { getEnemyLikeScript } from './EnemyScriptLookup';
import { Build } from './role/Build';

const { ccclass, property } = _decorator;

/** 与陷阱伤害扫描一致的容器路径（用于地面 AoE） */
const ENEMY_CONTAINER_PATHS: readonly string[] = [
    'Canvas/Enemies',
    'Canvas/Enemys',
    'Canvas/Orcs',
    'Canvas/TrollSpearmans',
    'Canvas/OrcWarriors',
    'Canvas/OrcWarlords',
    'Canvas/OrcShamans',
    'Canvas/MinotaurWarriors',
    'Canvas/Wolves',
    'Canvas/Boss',
    'Canvas/Bosses',
    'Canvas/Portals',
];

/**
 * 炮弹：抛物线弹道与 Arrow 一致（同 arc 公式），速度默认为箭矢一半；
 * 落地后在落点播放爆炸序列帧（预制体配置）、音效与半径内群伤。
 */
@ccclass('CannonBall')
export class CannonBall extends Component {
    @property
    speed: number = 250;

    @property
    arcHeight: number = 50;

    @property
    explosionRadius: number = 100;

    @property
    explosionDurationSec: number = 1;

    @property({ type: [SpriteFrame], tooltip: '飞行中可选序列帧，空则用节点当前 Sprite' })
    flightFrames: SpriteFrame[] = [];

    @property({
        type: [SpriteFrame],
        tooltip: '落地爆炸序列帧（常见 4 张）；以落点为锚点中心，在 explosionDurationSec 内按贴图原始尺寸逐帧播放',
    })
    explosionFrames: SpriteFrame[] = [];

    @property({ type: AudioClip, tooltip: '爆炸音效' })
    explosionSound: AudioClip | null = null;

    private targetNode: Node | null = null;
    private startPos: Vec3 = new Vec3();
    private targetPos: Vec3 = new Vec3();
    private travelTime: number = 0;
    private elapsedTime: number = 0;
    private isFlying: boolean = false;
    private lastPos: Vec3 = new Vec3();
    private currentDirection: Vec3 = new Vec3();
    private damage: number = 0;
    private sourceBuild: Build | null = null;
    private gameManager: any = null;
    private flightFrameIdx: number = 0;
    private flightFrameTimer: number = 0;

    init(startPos: Vec3, targetNode: Node, damage: number, sourceBuild: Build | null) {
        this.startPos = startPos.clone();
        this.targetNode = targetNode;
        this.damage = damage;
        this.sourceBuild = sourceBuild;

        this.node.setWorldPosition(this.startPos);

        if (this.targetNode?.isValid) {
            this.targetPos = this.targetNode.worldPosition.clone();
        } else {
            this.targetPos = this.startPos.clone();
            this.targetPos.x += 200;
        }

        const dx = this.startPos.x - this.targetPos.x;
        const dy = this.startPos.y - this.targetPos.y;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq < 0.01) {
            this.node.destroy();
            return;
        }
        const distance = Math.sqrt(distanceSq);
        this.travelTime = distance / Math.max(1, this.speed);
        if (this.travelTime <= 0) {
            this.node.destroy();
            return;
        }

        this.elapsedTime = 0;
        this.isFlying = true;
        this.lastPos = this.startPos.clone();

        const initialDirection = new Vec3();
        Vec3.subtract(initialDirection, this.targetPos, this.startPos);
        if (initialDirection.length() > 0.1) {
            initialDirection.normalize();
            this.currentDirection.set(initialDirection);
            const angle = (Math.atan2(initialDirection.y, initialDirection.x) * 180) / Math.PI;
            this.node.setRotationFromEuler(0, 0, angle);
        } else {
            this.currentDirection.set(1, 0, 0);
        }
    }

    private calculateParabolicPosition(ratio: number): Vec3 {
        const pos = new Vec3();
        Vec3.lerp(pos, this.startPos, this.targetPos, ratio);
        const arcRatio = 4 * ratio * (1 - ratio);
        pos.y += this.arcHeight * arcRatio;
        return pos;
    }

    private applyFlightSprite(dt: number) {
        const frames = (this.flightFrames || []).filter((f) => f != null);
        if (!frames.length) {
            return;
        }
        const sp = this.node.getComponent(Sprite);
        if (!sp) {
            return;
        }
        this.flightFrameTimer += dt;
        const count = frames.length;
        const dur = Math.max(0.05, this.travelTime / count);
        const idx = Math.min(count - 1, Math.floor(this.flightFrameTimer / dur));
        if (idx !== this.flightFrameIdx && frames[idx]) {
            this.flightFrameIdx = idx;
            sp.spriteFrame = frames[idx];
        }
    }

    /** 爆炸以落点为视觉中心（锚点 0.5,0.5），便于与伤害范围同心 */
    private prepareExplosionAtWorldCenter(landPos: Vec3) {
        this.node.setWorldPosition(landPos);
        this.node.setRotationFromEuler(0, 0, 0);
        let ui = this.node.getComponent(UITransform);
        if (!ui) {
            ui = this.node.addComponent(UITransform);
        }
        ui.setAnchorPoint(0.5, 0.5);
    }

    /** 按贴图原始尺寸显示当前爆炸帧（CUSTOM + UITransform 与 SpriteFrame 原始大小一致） */
    private applyExplosionSpriteOriginalPixelSize(sp: Sprite, frame: SpriteFrame) {
        sp.spriteFrame = frame;
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        let ui = this.node.getComponent(UITransform);
        if (!ui) {
            ui = this.node.addComponent(UITransform);
        }
        ui.setAnchorPoint(0.5, 0.5);
        try {
            const os = frame.getOriginalSize();
            let w = os.x;
            let h = os.y;
            if (!w || !h) {
                const r = frame.rect;
                w = r.width;
                h = r.height;
            }
            if (w > 0 && h > 0) {
                ui.setContentSize(w, h);
            }
        } catch {
            const r = frame.rect;
            if (r.width > 0 && r.height > 0) {
                ui.setContentSize(r.width, r.height);
            }
        }
    }

    private explodeAt(landPos: Vec3) {
        this.isFlying = false;

        const dir = new Vec3();
        if (this.currentDirection.length() > 0.001) {
            dir.set(this.currentDirection);
        } else {
            Vec3.subtract(dir, landPos, this.startPos);
            if (dir.length() > 0.001) {
                dir.normalize();
            } else {
                dir.set(0, -1, 0);
            }
        }

        const rsq = this.explosionRadius * this.explosionRadius;
        for (const path of ENEMY_CONTAINER_PATHS) {
            const container = find(path);
            if (!container?.isValid) {
                continue;
            }
            for (const enemyNode of container.children) {
                if (!enemyNode?.isValid || !enemyNode.activeInHierarchy) {
                    continue;
                }
                const enemyScript = getEnemyLikeScript(enemyNode);
                if (!enemyScript?.isAlive || !enemyScript.isAlive()) {
                    continue;
                }
                const p = enemyNode.worldPosition;
                const dx = p.x - landPos.x;
                const dy = p.y - landPos.y;
                if (dx * dx + dy * dy > rsq) {
                    continue;
                }
                const hitDir = new Vec3(dx, dy, 0);
                if (hitDir.length() > 0.001) {
                    hitDir.normalize();
                } else {
                    hitDir.set(dir);
                }
                if (enemyScript.takeDamage) {
                    enemyScript.takeDamage(this.damage, hitDir);
                    try {
                        this.sourceBuild?.reportDamageForStatistics(this.damage);
                    } catch {}
                }
            }
        }

        if (this.explosionSound && AudioManager.Instance) {
            AudioManager.Instance.playSFX(this.explosionSound);
        }

        const frames = (this.explosionFrames || []).filter((f) => f != null);
        const dur = Math.max(0.05, this.explosionDurationSec);

        if (!frames.length) {
            if (this.node?.isValid) {
                this.node.destroy();
            }
            return;
        }

        this.prepareExplosionAtWorldCenter(landPos);

        let sp = this.node.getComponent(Sprite);
        if (!sp) {
            sp = this.node.addComponent(Sprite);
        }

        this.applyExplosionSpriteOriginalPixelSize(sp, frames[0]);

        let t = 0;
        const frameDur = dur / frames.length;
        let fi = 0;

        const tick = (dt: number) => {
            if (!this.node?.isValid) {
                return;
            }
            t += dt;
            const next = Math.min(frames.length - 1, Math.floor(t / frameDur));
            if (next !== fi && frames[next]) {
                fi = next;
                this.applyExplosionSpriteOriginalPixelSize(sp!, frames[next]);
            }
            if (t >= dur) {
                this.unschedule(tick);
                if (this.node?.isValid) {
                    this.node.destroy();
                }
            }
        };
        this.schedule(tick, 0);
    }

    update(dt: number) {
        if (!this.isFlying) {
            return;
        }

        if (!this.gameManager) {
            const gmNode = find('GameManager') || find('Canvas/GameManager');
            if (gmNode) {
                this.gameManager = gmNode.getComponent('GameManager' as any);
            }
        }
        if (this.gameManager?.getGameState && this.gameManager.getGameState() !== GameState.Playing) {
            return;
        }

        this.elapsedTime += dt;
        this.applyFlightSprite(dt);

        if (this.targetNode?.isValid) {
            this.targetPos = this.targetNode.worldPosition.clone();
        }

        const currentRatio = Math.min(this.elapsedTime / this.travelTime, 1);
        const currentPos = this.calculateParabolicPosition(currentRatio);
        this.node.setWorldPosition(currentPos);

        const direction = new Vec3();
        Vec3.subtract(direction, currentPos, this.lastPos);
        if (direction.length() > 0.1) {
            direction.normalize();
            this.currentDirection.set(direction);
            const angle = (Math.atan2(direction.y, direction.x) * 180) / Math.PI;
            this.node.setRotationFromEuler(0, 0, angle);
        }
        this.lastPos = currentPos.clone();

        if (this.targetNode?.isValid) {
            const tp = this.targetNode.worldPosition;
            const dx = currentPos.x - tp.x;
            const dy = currentPos.y - tp.y;
            if (dx * dx + dy * dy < 35 * 35) {
                this.explodeAt(tp.clone());
                return;
            }
        }

        if (currentRatio >= 1) {
            this.explodeAt(currentPos.clone());
        }
    }
}
