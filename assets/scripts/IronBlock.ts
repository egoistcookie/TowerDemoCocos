import { _decorator, Component, Node, Vec3, Sprite, SpriteFrame, find, AudioClip, UITransform } from 'cc';
import { GameState } from './GameState';
import { AudioManager } from './AudioManager';
import { getWatchTowerFamilyScript } from './WatchTowerFamily';

const { ccclass, property } = _decorator;

/** 铁块落地 AoE：建筑 / 防御塔 + 石墙（与投石车主目标一致；Role 另见 {@link IRON_BLOCK_ROLE_AOE_PATHS}） */
const IRON_BLOCK_AOE_SCAN: readonly { path: string }[] = [
    { path: 'Canvas/StoneWalls' },
    { path: 'Canvas/WatchTowers' },
    { path: 'Canvas/IceTowers' },
    { path: 'Canvas/ThunderTowers' },
    { path: 'Canvas/WarAncientTrees' },
    { path: 'Canvas/HunterHalls' },
    { path: 'Canvas/MageTowers' },
    { path: 'Canvas/SwordsmanHalls' },
    { path: 'Canvas/Churches' },
];

function getAliveBuildingDamageScript(node: Node | null): any {
    if (!node?.isValid || !node.activeInHierarchy) {
        return null;
    }
    const watch = getWatchTowerFamilyScript(node);
    if (watch?.takeDamage && watch.isAlive && watch.isAlive()) {
        return watch;
    }
    const ice = node.getComponent('IceTower') as any;
    if (ice?.takeDamage && ice.isAlive && ice.isAlive()) {
        return ice;
    }
    const thunder = node.getComponent('ThunderTower') as any;
    if (thunder?.takeDamage && thunder.isAlive && thunder.isAlive()) {
        return thunder;
    }
    const tree = node.getComponent('WarAncientTree') as any;
    if (tree?.takeDamage && tree.isAlive && tree.isAlive()) {
        return tree;
    }
    const hunterHall = node.getComponent('HunterHall') as any;
    if (hunterHall?.takeDamage && hunterHall.isAlive && hunterHall.isAlive()) {
        return hunterHall;
    }
    const mageTower = node.getComponent('MageTower') as any;
    if (mageTower?.takeDamage && mageTower.isAlive && mageTower.isAlive()) {
        return mageTower;
    }
    const swordsHall = node.getComponent('SwordsmanHall') as any;
    if (swordsHall?.takeDamage && swordsHall.isAlive && swordsHall.isAlive()) {
        return swordsHall;
    }
    const church = node.getComponent('Church') as any;
    if (church?.takeDamage && church.isAlive && church.isAlive()) {
        return church;
    }
    const stone = node.getComponent('StoneWall') as any;
    if (stone?.takeDamage && stone.isAlive && stone.isAlive()) {
        if (stone.isSpikeTrapActive && stone.isSpikeTrapActive()) {
            return null;
        }
        return stone;
    }
    return null;
}

/** 爆炸范围内可伤的「我方单位」容器（与 {@link Enemy.applyFindTargetInRange} 中角色段一致；投石车主目标仍不含 Role） */
const IRON_BLOCK_ROLE_AOE_PATHS: readonly string[] = [
    'Canvas/Towers',
    'Canvas/EagleArchers',
    'Canvas/Hunters',
    'Canvas/ElfSwordsmans',
    'Canvas/Mercenaries',
    'Canvas/Eagles',
    'Canvas/Wisps',
];

function getAliveRoleDamageScript(node: Node | null): any {
    if (!node?.isValid || !node.activeInHierarchy) {
        return null;
    }
    const tryNames = ['EagleArcher', 'Arrower', 'Priest', 'Hunter', 'Mage', 'ElfSwordsman', 'MercenarySoldier', 'Eagle', 'Wisp'] as const;
    for (const name of tryNames) {
        const s = node.getComponent(name) as any;
        if (s?.takeDamage && s.isAlive && s.isAlive()) {
            return s;
        }
    }
    return null;
}

/**
 * 敌方投石车投掷的铁块：弹道与 {@link CannonBall} 相同（速度、弧高、爆炸半径、飞行逻辑），
 * 落地后对半径内我方建筑、石墙及我方单位（Role）造成范围伤害。
 */
@ccclass('IronBlock')
export class IronBlock extends Component {
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
        tooltip: '落地爆炸序列帧；以落点为锚点中心，在 explosionDurationSec 内播放',
    })
    explosionFrames: SpriteFrame[] = [];

    @property({ type: AudioClip, tooltip: '爆炸音效' })
    explosionSound: AudioClip | null = null;

    private startPos: Vec3 = new Vec3();
    /** 发射瞬间锁定的落点世界坐标，全程不再跟随目标节点（避免目标死亡/回池后位置飘到原点下） */
    private targetPos: Vec3 = new Vec3();
    private travelTime: number = 0;
    private elapsedTime: number = 0;
    private isFlying: boolean = false;
    private lastPos: Vec3 = new Vec3();
    private currentDirection: Vec3 = new Vec3();
    private damage: number = 0;
    private gameManager: any = null;
    private flightFrameIdx: number = 0;
    private flightFrameTimer: number = 0;

    init(startPos: Vec3, targetNode: Node, damage: number) {
        this.startPos = startPos.clone();
        this.damage = damage;

        this.node.setWorldPosition(this.startPos);

        if (targetNode?.isValid && targetNode.activeInHierarchy) {
            this.targetPos = targetNode.worldPosition.clone();
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

    private prepareExplosionAtWorldCenter(landPos: Vec3) {
        this.node.setWorldPosition(landPos);
        this.node.setRotationFromEuler(0, 0, 0);
        let ui = this.node.getComponent(UITransform);
        if (!ui) {
            ui = this.node.addComponent(UITransform);
        }
        ui.setAnchorPoint(0.5, 0.5);
    }

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

    private damageBuildingsInRadius(landPos: Vec3) {
        const rsq = this.explosionRadius * this.explosionRadius;
        const defaultDir = new Vec3();
        if (this.currentDirection.length() > 0.001) {
            defaultDir.set(this.currentDirection);
        } else {
            Vec3.subtract(defaultDir, landPos, this.startPos);
            if (defaultDir.length() > 0.001) {
                defaultDir.normalize();
            } else {
                defaultDir.set(0, -1, 0);
            }
        }

        for (const { path } of IRON_BLOCK_AOE_SCAN) {
            const container = find(path);
            if (!container?.isValid) {
                continue;
            }
            for (const child of container.children) {
                if (!child?.isValid || !child.activeInHierarchy) {
                    continue;
                }
                const script = getAliveBuildingDamageScript(child);
                if (!script?.takeDamage) {
                    continue;
                }
                const p = child.worldPosition;
                const dx = p.x - landPos.x;
                const dy = p.y - landPos.y;
                if (dx * dx + dy * dy > rsq) {
                    continue;
                }
                const hitDir = new Vec3(dx, dy, 0);
                if (hitDir.length() > 0.001) {
                    hitDir.normalize();
                } else {
                    hitDir.set(defaultDir);
                }
                script.takeDamage(this.damage, hitDir);
            }
        }

        for (const path of IRON_BLOCK_ROLE_AOE_PATHS) {
            const container = find(path);
            if (!container?.isValid) {
                continue;
            }
            for (const child of container.children) {
                if (!child?.isValid || !child.activeInHierarchy) {
                    continue;
                }
                const script = getAliveRoleDamageScript(child);
                if (!script?.takeDamage) {
                    continue;
                }
                const p = child.worldPosition;
                const dx = p.x - landPos.x;
                const dy = p.y - landPos.y;
                if (dx * dx + dy * dy > rsq) {
                    continue;
                }
                const hitDir = new Vec3(dx, dy, 0);
                if (hitDir.length() > 0.001) {
                    hitDir.normalize();
                } else {
                    hitDir.set(defaultDir);
                }
                script.takeDamage(this.damage, hitDir, null);
            }
        }

        const magesRoot = find('Canvas/Mages') || find('Mages');
        if (magesRoot?.isValid) {
            for (const child of magesRoot.children) {
                if (!child?.isValid || !child.activeInHierarchy) {
                    continue;
                }
                const script = getAliveRoleDamageScript(child);
                if (!script?.takeDamage) {
                    continue;
                }
                const p = child.worldPosition;
                const dx = p.x - landPos.x;
                const dy = p.y - landPos.y;
                if (dx * dx + dy * dy > rsq) {
                    continue;
                }
                const hitDir = new Vec3(dx, dy, 0);
                if (hitDir.length() > 0.001) {
                    hitDir.normalize();
                } else {
                    hitDir.set(defaultDir);
                }
                script.takeDamage(this.damage, hitDir, null);
            }
        }

        const crystalNode = find('Canvas/Crystal') || find('Crystal');
        if (crystalNode?.isValid && crystalNode.activeInHierarchy) {
            const crystalScript = crystalNode.getComponent('Crystal') as any;
            if (crystalScript?.isAlive && crystalScript.isAlive() && typeof crystalScript.takeDamage === 'function') {
                const p = crystalNode.worldPosition;
                const dx = p.x - landPos.x;
                const dy = p.y - landPos.y;
                if (dx * dx + dy * dy <= rsq) {
                    crystalScript.takeDamage(this.damage);
                }
            }
        }
    }

    private explodeAt(landPos: Vec3) {
        this.isFlying = false;

        this.damageBuildingsInRadius(landPos);

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

        // 仅相对「发射时锁定的落点」判定接近爆炸，不读目标节点（避免多车同目标、目标中途死亡/回池）
        const tdx = currentPos.x - this.targetPos.x;
        const tdy = currentPos.y - this.targetPos.y;
        if (tdx * tdx + tdy * tdy < 35 * 35) {
            this.explodeAt(this.targetPos.clone());
            return;
        }

        if (currentRatio >= 1) {
            this.explodeAt(this.targetPos.clone());
        }
    }
}
