import { Component, director, Node } from 'cc';

/**
 * 专用内存排查：统一前缀 [MEM_PROBE]；节点树前缀 [MEM_NODE]（仅 logSceneNodeTreeFull）。
 * 若控制台只有 MemoryProbe.ts:84 而无 142+ 行，说明运行包未含节点转储或日志被过滤。测完将 ENABLED 设为 false。
 * Chromium 系有 performance.memory；微信等环境常为 N/A，需结合 sceneNodes / 池统计。
 */
export class MemoryProbe {
    static ENABLED = true;

    private static baselineUsedBytes: number | null = null;

    /** 进入关卡 / 开局时调用，用于 sinceStartMB */
    static resetBaseline(): void {
        const m = this.readJsMemoryBytes();
        this.baselineUsedBytes = m?.used ?? null;
    }

    private static readJsMemoryBytes(): { used: number; total: number; limit: number } | null {
        const perf = (globalThis as any).performance;
        const memory = perf?.memory;
        if (!memory || typeof memory.usedJSHeapSize !== 'number') {
            return null;
        }
        return {
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit,
        };
    }

    private static mb(b: number): string {
        return (b / 1024 / 1024).toFixed(1);
    }

    /** 递归统计当前场景节点总数（仅低频 snapshot 使用） */
    static countSceneNodes(): number {
        const scene = director.getScene();
        if (!scene || !scene.isValid) {
            return -1;
        }
        let n = 0;
        const walk = (node: Node) => {
            n++;
            const ch = node.children;
            if (!ch) {
                return;
            }
            for (let i = 0; i < ch.length; i++) {
                walk(ch[i]);
            }
        };
        walk(scene);
        return n;
    }

    /**
     * @param tag 事件标识，便于日志排序筛选
     * @param extra 附加结构化字段（会并入 JSON）
     * @param opts.includeSceneNodes 为 true 时附带 sceneNodes（有少量开销）
     */
    static snapshot(tag: string, extra?: Record<string, unknown>, opts?: { includeSceneNodes?: boolean }): void {
        if (!this.ENABLED) {
            return;
        }
        const bytes = this.readJsMemoryBytes();
        const usedMB = bytes ? this.mb(bytes.used) : 'N/A';
        const totalMB = bytes ? this.mb(bytes.total) : 'N/A';
        const limitMB = bytes ? this.mb(bytes.limit) : 'N/A';
        let sinceStartMB: string | number = 'N/A';
        if (bytes && this.baselineUsedBytes != null) {
            sinceStartMB = this.mb(bytes.used - this.baselineUsedBytes);
        }
        const payload: Record<string, unknown> = {
            tag,
            usedMB,
            totalMB,
            limitMB,
            sinceStartMB,
            ...(extra || {}),
        };
        if (opts?.includeSceneNodes) {
            payload.sceneNodes = this.countSceneNodes();
        }
        console.log(`[MEM_PROBE] ${JSON.stringify(payload)}`);
    }

    /**
     * 打印当前场景下每个节点的路径与状态（测完关 ENABLED）。
     * tags: pool_bench=在对象池容器下；node_off=节点 active 关闭；not_in_hierarchy=不在激活层级（父链有关闭）。
     */
    static logSceneNodeTreeFull(gameTimeSec?: number): void {
        if (!this.ENABLED) {
            return;
        }
        try {
            const scene = director.getScene();
            if (!scene || !scene.isValid) {
                console.warn('[MEM_NODE] no valid scene');
                return;
            }
            const rows: string[] = [];
            let seq = 0;
            const tagForPath = (path: string, active: boolean, aih: boolean): string => {
                const tags: string[] = [];
                if (
                    path.includes('/PoolContainer') ||
                    path.includes('BattleFloatPoolRoot') ||
                    /EnemyPool|UnitPool|BuildingPool/.test(path)
                ) {
                    tags.push('pool_bench');
                }
                if (!active) {
                    tags.push('node_off');
                }
                if (!aih) {
                    tags.push('not_in_hierarchy');
                }
                return tags.length ? tags.join(',') : '-';
            };
            const walk = (node: Node, path: string) => {
                seq++;
                const ch = node.children?.length ?? 0;
                let compN = 0;
                try {
                    compN = node.getComponents(Component).length;
                } catch {
                    compN = -1;
                }
                const tags = tagForPath(path, node.active, node.activeInHierarchy);
                rows.push(
                    `${seq}\t${tags}\tactive=${node.active ? 1 : 0}\taih=${node.activeInHierarchy ? 1 : 0}\tch=${ch}\tcomp=${compN}\t${path}`
                );
                if (!node.children) {
                    return;
                }
                for (let i = 0; i < node.children.length; i++) {
                    const c = node.children[i];
                    walk(c, `${path}/${c.name}`);
                }
            };
            walk(scene, scene.name);
            const head = `[MEM_NODE] dump begin gameTimeSec=${gameTimeSec ?? 'n/a'} totalNodes=${rows.length}`;
            console.log(head);
            for (const line of rows) {
                console.log(`[MEM_NODE]\t${line}`);
            }
            console.log(`[MEM_NODE] dump end totalNodes=${rows.length}`);
        } catch (e) {
            console.error('[MEM_NODE] dump failed', e);
        }
    }
}
