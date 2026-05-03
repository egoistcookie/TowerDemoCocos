import { Color, Component, Label, LabelOutline, Node, Prefab, UIOpacity, UITransform, Vec3, find, instantiate, tween } from 'cc';
import { DamageNumber } from './DamageNumber';
import { MemoryProbe } from './MemoryProbe';

type SpawnFloatTextOptions = {
    owner: Component;
    prefab?: Prefab | null;
    worldPos: Vec3;
    text: string;
    color: Color;
    fontSize?: number;
    duration?: number;
    moveOffset?: Vec3;
    outlineColor?: Color;
    outlineWidth?: number;
};

type PoolStats = {
    created: number;
    reused: number;
    inUse: number;
    pooled: number;
};

export class BattleFloatTextPool {
    private static readonly POOL_ROOT_NAME = 'BattleFloatPoolRoot';
    private static readonly FALLBACK_KEY = '__fallback__';
    /** 每类飘字最大缓存：过大则常驻节点与 Label 增多；48 仍远高于同屏并发 */
    private static readonly MAX_POOL_SIZE_PER_KEY = 48;
    private static readonly MEMORY_LOG_INTERVAL_MS = 10000;
    // 临时开关：用于定位内存问题时一键禁用战斗飘字
    private static readonly TEMP_DISABLE_FLOAT_TEXT = false;
    private static readonly TEMP_DISABLE_LOG_INTERVAL_MS = 3000;

    private static pools: Map<string, Node[]> = new Map();
    private static inUseCount: Map<string, number> = new Map();
    private static totalCreated = 0;
    private static totalReused = 0;
    private static lastMemoryLogTime = 0;
    private static blockedSpawnCount = 0;
    private static lastDisableLogTime = 0;

    static spawnFloatText(options: SpawnFloatTextOptions): void {
        if (this.TEMP_DISABLE_FLOAT_TEXT) {
            this.blockedSpawnCount++;
            const now = Date.now();
            if (now - this.lastDisableLogTime >= this.TEMP_DISABLE_LOG_INTERVAL_MS) {
                this.lastDisableLogTime = now;
                console.warn(
                    `[BattleFloatTextPool] TEMP_DISABLE_FLOAT_TEXT=true, blocked=${this.blockedSpawnCount}`
                );
            }
            return;
        }

        const parent = this.resolveParent(options.owner);
        if (!parent) return;

        const key = this.getKey(options.prefab);
        const node = this.acquire(key, options.prefab);
        if (!node || !node.isValid) return;

        node.setParent(parent);
        node.active = true;
        node.setWorldPosition(options.worldPos);
        node.setScale(1, 1, 1);

        const label = this.ensureLabel(node, options.fontSize ?? 20);
        label.string = options.text;
        label.color = options.color;

        const outline = node.getComponent(LabelOutline) || node.addComponent(LabelOutline);
        outline.color = options.outlineColor ?? new Color(0, 0, 0, 255);
        outline.width = options.outlineWidth ?? 2;

        const uiOpacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        uiOpacity.opacity = 255;

        const duration = Math.max(0.1, options.duration ?? 0.6);
        const moveOffset = options.moveOffset ?? new Vec3(0, 30, 0);
        const endPos = new Vec3(options.worldPos.x + moveOffset.x, options.worldPos.y + moveOffset.y, options.worldPos.z + moveOffset.z);

        tween(node)
            .to(duration, { worldPosition: endPos }, { easing: 'sineOut' })
            .parallel(tween(uiOpacity).to(duration, { opacity: 0 }))
            .call(() => this.release(key, node))
            .start();

        this.maybeLogMemory(parent);
    }

    static getStats(): PoolStats {
        let pooled = 0;
        for (const arr of this.pools.values()) {
            pooled += arr.length;
        }
        let inUse = 0;
        for (const c of this.inUseCount.values()) {
            inUse += c;
        }
        return {
            created: this.totalCreated,
            reused: this.totalReused,
            inUse,
            pooled,
        };
    }

    /** Tick.summary：按 key 的池长与占用 */
    static getDebugStats(): Record<string, unknown> {
        const perKey: Record<string, { pooled: number; inUse: number }> = {};
        for (const [k, arr] of this.pools.entries()) {
            perKey[k] = { pooled: arr.length, inUse: this.inUseCount.get(k) || 0 };
        }
        return { ...this.getStats(), perKey };
    }

    private static resolveParent(owner: Component): Node | null {
        const canvas = find('Canvas');
        if (canvas && canvas.isValid) return canvas;
        if (owner.node?.scene && owner.node.scene.isValid) return owner.node.scene;
        if (owner.node?.parent && owner.node.parent.isValid) return owner.node.parent;
        return null;
    }

    private static ensurePoolRoot(parent: Node): Node {
        const inCanvas = find(`Canvas/${this.POOL_ROOT_NAME}`);
        if (inCanvas && inCanvas.isValid) return inCanvas;
        let root = parent.getChildByName(this.POOL_ROOT_NAME);
        if (!root || !root.isValid) {
            root = new Node(this.POOL_ROOT_NAME);
            root.setParent(parent);
            root.active = false;
        }
        return root;
    }

    private static getKey(prefab?: Prefab | null): string {
        if (!prefab) return this.FALLBACK_KEY;
        const anyPrefab = prefab as any;
        return anyPrefab?._uuid || anyPrefab?.name || this.FALLBACK_KEY;
    }

    private static acquire(key: string, prefab?: Prefab | null): Node {
        const pool = this.pools.get(key) || [];
        this.pools.set(key, pool);

        let node: Node | null = null;
        while (pool.length > 0 && !node) {
            const n = pool.pop()!;
            if (n && n.isValid) {
                node = n;
                this.totalReused++;
            }
        }

        if (!node) {
            node = prefab ? instantiate(prefab) : new Node('DamageNumber');
            this.totalCreated++;
        }

        const builtinDamageComp = node.getComponent(DamageNumber);
        if (builtinDamageComp) {
            node.removeComponent(DamageNumber);
        }

        const inUse = this.inUseCount.get(key) || 0;
        this.inUseCount.set(key, inUse + 1);
        return node;
    }

    private static release(key: string, node: Node): void {
        if (!node || !node.isValid) return;

        node.active = false;
        const parent = node.parent;
        if (parent && parent.isValid) {
            const poolRoot = this.ensurePoolRoot(parent);
            node.setParent(poolRoot);
        }

        const inUse = this.inUseCount.get(key) || 0;
        this.inUseCount.set(key, Math.max(0, inUse - 1));

        const pool = this.pools.get(key) || [];
        this.pools.set(key, pool);
        if (pool.length >= this.MAX_POOL_SIZE_PER_KEY) {
            node.destroy();
            return;
        }
        pool.push(node);
    }

    private static ensureLabel(node: Node, defaultFontSize: number): Label {
        let label = node.getComponent(Label);
        if (!label) {
            const labels = node.getComponentsInChildren(Label);
            if (labels && labels.length > 0) {
                label = labels[0];
            }
        }
        if (!label) {
            label = node.addComponent(Label);
        }
        label.fontSize = defaultFontSize;

        let trans = label.node.getComponent(UITransform);
        if (!trans) {
            trans = label.node.addComponent(UITransform);
        }
        if (trans.contentSize.width <= 0 || trans.contentSize.height <= 0) {
            trans.setContentSize(60, 40);
        }
        return label;
    }

    private static maybeLogMemory(parent: Node): void {
        const now = Date.now();
        if (now - this.lastMemoryLogTime < this.MEMORY_LOG_INTERVAL_MS) return;
        this.lastMemoryLogTime = now;

        const stats = this.getStats();
        const parentChildren = parent?.children?.length ?? -1;
        MemoryProbe.snapshot(
            'BattleFloatTextPool.interval',
            {
                floatCreated: stats.created,
                floatReused: stats.reused,
                floatInUse: stats.inUse,
                floatPooled: stats.pooled,
                parentChildren,
            },
            { includeSceneNodes: true }
        );
    }
}

