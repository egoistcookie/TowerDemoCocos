import { _decorator, Component, Node, Vec3, Color, find } from 'cc';
import { GameManager } from '../GameManager';
import { DamageNumber } from '../DamageNumber';
import { Wisp } from './Wisp';

const { ccclass, property } = _decorator;

@ccclass('Tree')
export class Tree extends Component {
    @property
    growTime: number = 5.0; // 成长时间（秒）

    @property
    woodInterval: number = 2.0; // 有小精灵时产木周期（秒）

    @property
    woodPerTick: number = 1; // 每次产木数量

    @property
    wispDetectRadius: number = 50; // 检测小精灵的半径（像素，缩小到方圆50）

    private growTimer: number = 0;
    private woodTimer: number = 0;
    private isGrown: boolean = false;
    private gameManager: GameManager = null!;

    start() {
        this.findGameManager();
        this.growTimer = 0;
        this.woodTimer = 0;
        this.isGrown = false;
    }

    update(deltaTime: number) {
        if (!this.gameManager || !this.gameManager.node || !this.gameManager.node.isValid) {
            this.findGameManager();
        }

        // 成长逻辑
        if (!this.isGrown) {
            this.growTimer += deltaTime;
            if (this.growTimer >= this.growTime) {
                this.isGrown = true;
                this.onGrown();
            }
            // 未成长前不产木
            return;
        }

        // 产木逻辑：已成长且附近有小精灵
        this.woodTimer += deltaTime;
        if (this.woodTimer >= this.woodInterval) {
            this.woodTimer = 0;
            if (this.hasNearbyWisp()) {
                if (this.gameManager && (this.gameManager as any).addWood) {
                    (this.gameManager as any).addWood(this.woodPerTick);
                }
                this.showWoodGainEffect();
            }
        }
    }

    private findGameManager() {
        let gmNode = find('GameManager') || find('Canvas/GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager);
        } else if (this.node && this.node.scene) {
            const scene = this.node.scene;
            const findInScene = (node: Node): GameManager | null => {
                const gm = node.getComponent(GameManager);
                if (gm) return gm;
                for (const child of node.children) {
                    const result = findInScene(child);
                    if (result) return result;
                }
                return null;
            };
            this.gameManager = findInScene(scene);
        }
    }

    /**
     * 树木成长完成时的视觉反馈
     */
    private onGrown() {
        // 简单做法：成长后稍微放大一点
        const s = this.node.scale;
        this.node.setScale(s.x * 1.2, s.y * 1.2, s.z);
    }

    /**
     * 检测附近是否有至少一个小精灵
     */
    private hasNearbyWisp(): boolean {
        if (!this.node || !this.node.isValid || !this.node.scene) {
            return false;
        }

        const treeWorldPos = this.node.worldPosition.clone();
        let found = false;

        const checkNode = (node: Node) => {
            if (found) return;

            const wisp = node.getComponent(Wisp);
            if (wisp && node.active && node.isValid) {
                const dist = Vec3.distance(treeWorldPos, node.worldPosition);
                if (dist <= this.wispDetectRadius) {
                    found = true;
                    return;
                }
            }

            for (const child of node.children) {
                if (found) return;
                checkNode(child);
            }
        };

        checkNode(this.node.scene);
        return found;
    }

    /**
     * 显示 +1 绿色飘字（使用 DamageNumber）
     */
    private showWoodGainEffect() {
        const parent = this.node.parent || this.node;
        const effectNode = new Node('WoodGain');
        effectNode.setParent(parent);

        const pos = this.node.worldPosition.clone();
        pos.y += 40;
        effectNode.setWorldPosition(pos);

        const dmg = effectNode.addComponent(DamageNumber);
        // 负数代表治疗/恢复，DamageNumber 会显示绿色 "+1"
        dmg.setDamage(-this.woodPerTick);

        // 可选：调整颜色更偏绿色
        dmg.setColor(new Color(0, 255, 0, 255));
    }
}

