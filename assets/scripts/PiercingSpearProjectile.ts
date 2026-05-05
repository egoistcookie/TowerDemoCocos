import { _decorator, Component, Node, Vec3, find } from 'cc';
import { GameState } from './GameState';
import { gatherSpearPierceCandidateNodes } from './PierceTargetGatherer';
import { getWatchTowerFamilyScript } from './WatchTowerFamily';

const { ccclass, property } = _decorator;

const HIT_RADIUS = 38;
/** 超出路径仍存活时的兜底销毁（秒），避免异常状态下节点悬挂 */
const MAX_FLIGHT_SECONDS = 2.5;

/**
 * 穿透投矛：沿直线飞行，对路径上单位各造成一次伤害（与 createSpear 命中逻辑一致）。
 */
@ccclass('PiercingSpearProjectile')
export class PiercingSpearProjectile extends Component {
    @property
    speed: number = 520;

    private startW = new Vec3();
    private endW = new Vec3();
    private dir = new Vec3();
    private damage = 0;
    private readonly hitUuids = new Set<string>();
    private traveled = 0;
    private readonly pathLen = 300;
    private flying = false;
    private gameManager: any = null;
    private flightElapsed = 0;
    private readonly hitDirScratch = new Vec3();

    init(startWorld: Vec3, endWorld: Vec3, damage: number, visualScale: number) {
        this.startW.set(startWorld);
        this.endW.set(endWorld);
        Vec3.subtract(this.dir, this.endW, this.startW);
        const len = this.dir.length();
        if (len < 1) {
            this.node.destroy();
            return;
        }
        this.dir.multiplyScalar(1 / len);
        this.damage = damage;
        this.traveled = 0;
        this.hitUuids.clear();
        this.flightElapsed = 0;
        this.node.setWorldPosition(this.startW);
        this.node.setScale(visualScale, visualScale, 1);
        const ang = Math.atan2(this.dir.y, this.dir.x) * (180 / Math.PI);
        this.node.setRotationFromEuler(0, 0, ang);
        this.flying = true;
    }

    update(deltaTime: number) {
        if (!this.flying) {
            return;
        }

        if (!this.gameManager) {
            const gmNode = find('GameManager') || find('Canvas/GameManager');
            if (gmNode) {
                this.gameManager = gmNode.getComponent('GameManager' as any);
            }
        }
        if (this.gameManager?.getGameState) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                this.disposeProjectile();
                return;
            }
        }

        this.flightElapsed += deltaTime;
        if (this.flightElapsed > MAX_FLIGHT_SECONDS) {
            this.disposeProjectile();
            return;
        }

        const move = this.speed * deltaTime;
        this.traveled += move;
        const pos = this.node.worldPosition;
        Vec3.scaleAndAdd(pos, pos, this.dir, move);
        this.node.setWorldPosition(pos);

        this.checkHits(pos);

        if (this.traveled >= this.pathLen - 0.5) {
            this.disposeProjectile();
        }
    }

    private disposeProjectile() {
        this.flying = false;
        this.hitUuids.clear();
        if (this.node?.isValid) {
            this.node.destroy();
        }
    }

    onDestroy() {
        this.hitUuids.clear();
        this.flying = false;
    }

    private checkHits(spearTip: Vec3) {
        const candidates = gatherSpearPierceCandidateNodes();
        this.hitDirScratch.set(this.dir);

        for (const targetNode of candidates) {
            if (!targetNode?.isValid || !targetNode.active) {
                continue;
            }
            const uid = targetNode.uuid;
            if (this.hitUuids.has(uid)) {
                continue;
            }
            const tp = targetNode.worldPosition;
            const dx = spearTip.x - tp.x;
            const dy = spearTip.y - tp.y;
            if (dx * dx + dy * dy > HIT_RADIUS * HIT_RADIUS) {
                continue;
            }
            this.hitUuids.add(uid);
            this.applySpearDamage(targetNode, this.damage, this.hitDirScratch);
        }
    }

    private applySpearDamage(targetNode: Node, damage: number, hitDirection: Vec3) {
        const towerScript = targetNode.getComponent('Arrower') as any;
        const warAncientTreeScript = targetNode.getComponent('WarAncientTree') as any;
        const hallScript = targetNode.getComponent('HunterHall') as any;
        const swordsmanHallScript = targetNode.getComponent('SwordsmanHall') as any;
        const crystalScript = targetNode.getComponent('Crystal') as any;
        const hunterScript = targetNode.getComponent('Hunter') as any;
        const elfSwordsmanScript = targetNode.getComponent('ElfSwordsman') as any;
        const stoneWallScript = targetNode.getComponent('StoneWall') as any;
        const eagleScript = targetNode.getComponent('Eagle') as any;
        const priestScript = targetNode.getComponent('Priest') as any;
        const mageScript = targetNode.getComponent('Mage') as any;
        const watchTowerScript = getWatchTowerFamilyScript(targetNode);
        const iceTowerScript = targetNode.getComponent('IceTower') as any;
        const thunderTowerScript = targetNode.getComponent('ThunderTower') as any;
        const mageTowerScript = targetNode.getComponent('MageTower') as any;
        const eagleArcherScript = targetNode.getComponent('EagleArcher') as any;
        const bearScript = targetNode.getComponent('Bear') as any;
        const churchScript = targetNode.getComponent('Church') as any;

        const targetScript =
            towerScript ||
            warAncientTreeScript ||
            hallScript ||
            swordsmanHallScript ||
            crystalScript ||
            hunterScript ||
            elfSwordsmanScript ||
            stoneWallScript ||
            eagleScript ||
            priestScript ||
            mageScript ||
            watchTowerScript ||
            iceTowerScript ||
            thunderTowerScript ||
            mageTowerScript ||
            eagleArcherScript ||
            bearScript ||
            churchScript;

        if (targetScript?.takeDamage) {
            targetScript.takeDamage(damage, hitDirection);
        }
    }
}
