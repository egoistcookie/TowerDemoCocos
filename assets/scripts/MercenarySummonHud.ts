import {
    _decorator,
    Component,
    Node,
    Sprite,
    SpriteFrame,
    UITransform,
    Color,
    Graphics,
    Vec3,
    Vec2,
    EventTouch,
    find,
    view,
    resources,
    BlockInputEvents,
    Camera,
    assetManager,
    Prefab,
    instantiate,
} from 'cc';
import { GameState } from './GameState';
import { GameManager } from './GameManager';
import { MercenarySoldier } from './role/MercenarySoldier';

const { ccclass } = _decorator;

const COOLDOWN_SEC = 30;
const BTN_SIZE = 76;

function screenToWorld(screenPos: Vec2): Vec3 {
    const cameraNode = find('Canvas/Camera');
    if (!cameraNode) {
        return new Vec3(0, 0, 0);
    }
    const camera = cameraNode.getComponent(Camera);
    if (!camera) {
        return new Vec3(0, 0, 0);
    }
    const worldPos = new Vec3();
    camera.screenToWorld(new Vec3(screenPos.x, screenPos.y, 0), worldPos);
    worldPos.z = 0;
    return worldPos;
}

@ccclass('MercenarySummonHud')
export class MercenarySummonHud extends Component {
    private gm: GameManager | null = null;
    private iconSprite: Sprite | null = null;
    private maskG: Graphics | null = null;
    private cooldownRemain = 0;
    private dragging = false;
    private ghost: Node | null = null;
    /** Canvas 捕获阶段监听拖拽（全局 input 在手指离开按钮后收不到 MOVE） */
    private canvasForCapture: Node | null = null;
    /** 开始拖拽时的触点 ID，避免多指时误用其它手指的 END */
    private activeDragTouchId: number = -1;

    /** 分包/主包中的 MercenarySoldier 预制体（与场景里单位一致，勿用图标节点代替） */
    private mercenarySoldierPrefab: Prefab | null = null;
    private mercenaryPrefabLoading = false;
    private mercenaryPrefabLoadCallbacks: Array<() => void> = [];

    static resetForRestart(): void {
        const merc = find('Canvas/Mercenaries');
        if (merc?.isValid) {
            merc.removeAllChildren();
        }
        const hudNode = find('Canvas/MercenarySummonHud');
        const hud = hudNode?.getComponent(MercenarySummonHud);
        hud?.resetForNewRun();
    }

    resetForNewRun() {
        this.cooldownRemain = 0;
        this.interruptDrag();
        this.refreshCooldownMask();
    }

    /** 非 Playing / 切场景时取消拖拽幽灵，不重置冷却 */
    interruptDrag() {
        this.dragging = false;
        this.activeDragTouchId = -1;
        this.destroyGhost();
    }

    static ensureInstalled(): void {
        const canvas = find('Canvas');
        if (!canvas) {
            return;
        }
        let hudNode = find('Canvas/MercenarySummonHud');
        if (!hudNode) {
            hudNode = new Node('MercenarySummonHud');
            hudNode.layer = canvas.layer;
            hudNode.setParent(canvas);
            const uit = hudNode.addComponent(UITransform);
            uit.setContentSize(BTN_SIZE, BTN_SIZE);
            hudNode.addComponent(MercenarySummonHud);
            hudNode.setSiblingIndex(canvas.children.length - 1);
        }
        hudNode.active = true;
    }

    onLoad() {
        this.gm =
            find('Canvas/GameManager')?.getComponent(GameManager) ||
            find('GameManager')?.getComponent(GameManager) ||
            null;

        const uit = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        uit.setContentSize(BTN_SIZE, BTN_SIZE);
        this.node.addComponent(BlockInputEvents);

        const iconNode = new Node('Icon');
        iconNode.layer = this.node.layer;
        iconNode.setParent(this.node);
        const iconUt = iconNode.addComponent(UITransform);
        iconUt.setContentSize(BTN_SIZE, BTN_SIZE);
        this.iconSprite = iconNode.addComponent(Sprite);
        this.iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;

        const maskNode = new Node('CooldownMask');
        maskNode.layer = this.node.layer;
        maskNode.setParent(this.node);
        const mUt = maskNode.addComponent(UITransform);
        mUt.setContentSize(BTN_SIZE, BTN_SIZE);
        this.maskG = maskNode.addComponent(Graphics);

        this.node.on(Node.EventType.TOUCH_START, this.onBtnTouchStart, this);

        resources.load('textures/icon/雇佣士兵/spriteFrame', SpriteFrame, (err, sf) => {
            if (err || !sf || !this.iconSprite?.isValid) {
                resources.load('textures/icon/雇佣士兵', SpriteFrame, (err2, sf2) => {
                    if (!err2 && sf2 && this.iconSprite?.isValid) {
                        this.iconSprite.spriteFrame = sf2;
                    }
                });
                return;
            }
            this.iconSprite.spriteFrame = sf;
        });
    }

    start() {
        this.canvasForCapture = find('Canvas');
        if (this.canvasForCapture) {
            this.canvasForCapture.on(Node.EventType.TOUCH_MOVE, this.onCanvasTouchMoveCapture, this, true);
            this.canvasForCapture.on(Node.EventType.TOUCH_END, this.onCanvasTouchEndCapture, this, true);
            this.canvasForCapture.on(Node.EventType.TOUCH_CANCEL, this.onCanvasTouchEndCapture, this, true);
        }
        this.layoutLeft();
        this.ensureMercenarySoldierPrefab(() => {});
    }

    onDestroy() {
        if (this.canvasForCapture?.isValid) {
            this.canvasForCapture.off(Node.EventType.TOUCH_MOVE, this.onCanvasTouchMoveCapture, this, true);
            this.canvasForCapture.off(Node.EventType.TOUCH_END, this.onCanvasTouchEndCapture, this, true);
            this.canvasForCapture.off(Node.EventType.TOUCH_CANCEL, this.onCanvasTouchEndCapture, this, true);
        }
        this.canvasForCapture = null;
        this.node.off(Node.EventType.TOUCH_START, this.onBtnTouchStart, this);
        this.destroyGhost();
    }

    private layoutLeft() {
        const vo = view.getVisibleOrigin();
        const half = BTN_SIZE / 2;
        this.node.setWorldPosition(vo.x + half, vo.y + 200, 0);
    }

    update(dt: number) {
        if (this.gm?.getGameState() === GameState.Playing && this.cooldownRemain > 0) {
            this.cooldownRemain -= dt;
            if (this.cooldownRemain < 0) {
                this.cooldownRemain = 0;
            }
        }
        this.refreshCooldownMask();
    }

    private refreshCooldownMask() {
        if (!this.maskG) {
            return;
        }
        this.maskG.clear();
        const ratio = COOLDOWN_SEC > 0 ? Math.min(1, Math.max(0, this.cooldownRemain / COOLDOWN_SEC)) : 0;
        if (ratio < 0.001) {
            return;
        }
        this.maskG.fillColor = new Color(55, 55, 55, 200);
        const w = BTN_SIZE;
        const h = BTN_SIZE * ratio;
        // 灰色贴底向上延伸：冷却减少时高度变小，亮色从上往下露出（非自下往上）
        const bottomY = -BTN_SIZE / 2;
        this.maskG.rect(-w / 2, bottomY, w, h);
        this.maskG.fill();
    }

    private onBtnTouchStart(ev: EventTouch) {
        if (this.gm?.getGameState() !== GameState.Playing) {
            return;
        }
        if (this.cooldownRemain > 0.02) {
            return;
        }
        this.beginDrag(ev);
    }

    private beginDrag(ev: EventTouch) {
        if (this.dragging) {
            return;
        }
        if (this.cooldownRemain > 0.02) {
            return;
        }
        this.dragging = true;
        this.activeDragTouchId = ev.touch?.getID() ?? -1;
        const canvas = find('Canvas');
        if (!canvas) {
            this.dragging = false;
            return;
        }
        const g = new Node('MercenaryDeployGhost');
        g.layer = canvas.layer;
        g.setParent(canvas);
        const ut = g.addComponent(UITransform);
        ut.setContentSize(48, 48);
        const sp = g.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        if (this.iconSprite?.spriteFrame) {
            sp.spriteFrame = this.iconSprite.spriteFrame;
        } else {
            resources.load('textures/icon/雇佣士兵/spriteFrame', SpriteFrame, (e, sf) => {
                if (!e && sf && sp.isValid) {
                    sp.spriteFrame = sf;
                }
            });
        }
        const loc = ev.getLocation();
        g.setWorldPosition(screenToWorld(loc));
        this.ghost = g;
    }

    private onCanvasTouchMoveCapture(ev: EventTouch) {
        if (!this.dragging || !this.ghost?.isValid) {
            return;
        }
        const tid = ev.touch?.getID() ?? -1;
        if (this.activeDragTouchId >= 0 && tid >= 0 && tid !== this.activeDragTouchId) {
            return;
        }
        const loc = ev.getLocation();
        this.ghost.setWorldPosition(screenToWorld(loc));
    }

    private onCanvasTouchEndCapture(ev: EventTouch) {
        if (!this.dragging) {
            return;
        }
        const tid = ev.touch?.getID() ?? -1;
        if (this.activeDragTouchId >= 0 && tid >= 0 && tid !== this.activeDragTouchId) {
            return;
        }
        this.dragging = false;
        this.activeDragTouchId = -1;
        const loc = ev.getLocation();
        const world = screenToWorld(loc);
        const valid = this.isValidDeployWorldPos(world);
        this.destroyGhost();
        if (valid && this.gm?.getGameState() === GameState.Playing) {
            this.spawnTwoAt(world);
        }
    }

    private destroyGhost() {
        if (this.ghost && this.ghost.isValid) {
            this.ghost.destroy();
        }
        this.ghost = null;
    }

    private isValidDeployWorldPos(p: Vec3): boolean {
        const vo = view.getVisibleOrigin();
        const vs = view.getVisibleSize();
        const m = 24;
        return (
            p.x >= vo.x + m &&
            p.x <= vo.x + vs.width - m &&
            p.y >= vo.y + m &&
            p.y <= vo.y + vs.height - m
        );
    }

    private ensureMercenaryParent(): Node {
        let p = find('Canvas/Mercenaries');
        if (!p) {
            const canvas = find('Canvas');
            p = new Node('Mercenaries');
            if (canvas) {
                p.layer = canvas.layer;
                p.setParent(canvas);
            }
        }
        return p!;
    }

    /**
     * 从 prefabs_sub 或 main 加载 MercenarySoldier.prefab（与兵营产出方式一致）
     */
    private ensureMercenarySoldierPrefab(done: () => void): void {
        if (this.mercenarySoldierPrefab) {
            done();
            return;
        }
        this.mercenaryPrefabLoadCallbacks.push(done);
        if (this.mercenaryPrefabLoading) {
            return;
        }
        this.mercenaryPrefabLoading = true;

        const flush = () => {
            this.mercenaryPrefabLoading = false;
            const cbs = this.mercenaryPrefabLoadCallbacks.splice(0);
            for (const cb of cbs) {
                try {
                    cb();
                } catch (e) {
                    console.error('[MercenarySummonHud] 预制体加载回调异常', e);
                }
            }
        };

        const tryLoadFrom = (bundleName: string, onMissing: () => void) => {
            assetManager.loadBundle(bundleName, (err, bundle) => {
                if (err || !bundle) {
                    onMissing();
                    return;
                }
                bundle.load('MercenarySoldier', Prefab, (e, prefab) => {
                    if (!e && prefab) {
                        this.mercenarySoldierPrefab = prefab;
                        flush();
                        return;
                    }
                    onMissing();
                });
            });
        };

        tryLoadFrom('prefabs_sub', () => {
            tryLoadFrom('main', () => {
                console.error(
                    '[MercenarySummonHud] 未加载到 MercenarySoldier 预制体：请在 prefabs_sub 或 main 资源包中放置名为 MercenarySoldier 的 Prefab',
                );
                flush();
            });
        });
    }

    private spawnTwoAt(center: Vec3) {
        this.ensureMercenarySoldierPrefab(() => {
            if (!this.mercenarySoldierPrefab) {
                return;
            }
            const parent = this.ensureMercenaryParent();
            const offsets = [-22, 22];
            let firstMercenary: MercenarySoldier | null = null;
            for (const ox of offsets) {
                const n = instantiate(this.mercenarySoldierPrefab);
                n.layer = parent.layer;
                n.setParent(parent);
                n.setWorldPosition(center.x + ox, center.y, 0);
                n.active = true;
                const role = n.getComponent(MercenarySoldier);
                if (role) {
                    role.prefabName = 'MercenarySoldier';
                    if (!firstMercenary) {
                        firstMercenary = role;
                    }
                }
            }
            const gm =
                this.gm ||
                find('Canvas/GameManager')?.getComponent(GameManager) ||
                find('GameManager')?.getComponent(GameManager) ||
                null;
            if (gm && firstMercenary && typeof (gm as any).checkUnitFirstAppearance === 'function') {
                (gm as any).checkUnitFirstAppearance('MercenarySoldier', firstMercenary);
            }
            this.cooldownRemain = COOLDOWN_SEC;
        });
    }
}
