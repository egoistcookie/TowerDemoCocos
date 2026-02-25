import { _decorator, Component, Node, Prefab, instantiate, find } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 通用单位对象池管理器
 * 用于复用单位对象（包括敌人和我方单位），减少创建和销毁开销，提升性能
 */
@ccclass('UnitPool')
export class UnitPool extends Component {
    private static instance: UnitPool = null!;
    
    // 对象池容器节点（用于存储池中的单位）
    private poolContainer: Node = null!;
    
    // 对象池：按单位类型分类存储
    private pools: Map<string, Node[]> = new Map();
    
    // 预制体映射
    private prefabMap: Map<string, Prefab> = new Map();
    
    // 对象池配置
    private readonly INITIAL_POOL_SIZE: number = 5; // 初始池大小（我方单位通常较少）
    private readonly MAX_POOL_SIZE: number = 30; // 最大池大小（每种类型）
    
    // 活跃对象计数（用于调试）
    private activeCount: Map<string, number> = new Map();
    
    static getInstance(): UnitPool | null {
        return UnitPool.instance;
    }
    
    onLoad() {
        UnitPool.instance = this;
        // 确保节点名称正确
        this.node.name = 'UnitPool';
        
        // 创建或获取池容器节点
        if (!this.poolContainer) {
            this.poolContainer = new Node('PoolContainer');
            this.poolContainer.setParent(this.node);
        }
    }
    
    onDestroy() {
        if (UnitPool.instance === this) {
            UnitPool.instance = null!;
        }
        this.clearAllPools();
    }
    
    /**
     * 注册单位预制体
     * @param prefabName 预制体名称（如 "Arrower", "Priest", "Hunter" 等）
     * @param prefab 预制体
     */
    registerPrefab(prefabName: string, prefab: Prefab) {
        this.prefabMap.set(prefabName, prefab);
        
        // 如果该类型的池不存在，创建它
        if (!this.pools.has(prefabName)) {
            this.pools.set(prefabName, []);
            this.activeCount.set(prefabName, 0);
           //console.info(`[UnitPool] 注册预制体: ${prefabName}, 创建新池`);
        } else {
           //console.info(`[UnitPool] 注册预制体: ${prefabName}, 池已存在`);
        }
        
        // 预创建一些对象
        this.preWarm(prefabName);
    }
    
    /**
     * 预热对象池（预创建对象）
     * @param prefabName 预制体名称
     */
    private preWarm(prefabName: string) {
        const pool = this.pools.get(prefabName);
        const prefab = this.prefabMap.get(prefabName);
        
        if (!pool || !prefab) {
            return;
        }
        
        const initialCount = pool.length;
        // 如果池中对象数量少于初始大小，创建更多对象
        while (pool.length < this.INITIAL_POOL_SIZE) {
            const unit = instantiate(prefab);
            unit.active = false; // 设置为非激活状态
            unit.setParent(this.poolContainer); // 设置为对象池容器的子节点
            pool.push(unit);
        }
        
        if (pool.length > initialCount) {
           //console.info(`[UnitPool] 预热 ${prefabName}: 创建了 ${pool.length - initialCount} 个对象, 池大小: ${pool.length}`);
        }
    }
    
    /**
     * 从对象池获取单位
     * @param prefabName 预制体名称
     * @returns 单位节点，如果失败返回null
     */
    get(prefabName: string): Node | null {
        const pool = this.pools.get(prefabName);
        const prefab = this.prefabMap.get(prefabName);
        
        if (!pool || !prefab) {
            console.warn(`[UnitPool] 未找到预制体: ${prefabName}`);
            return null;
        }
        
        const poolSizeBefore = pool.length;
        const activeCountBefore = this.activeCount.get(prefabName) || 0;
        let unit: Node | null = null;
        let source = '';
        
        // 尝试从池中获取
        if (pool.length > 0) {
            unit = pool.pop()!;
            source = '池中获取';
        } else {
            // 池为空，创建新对象
            unit = instantiate(prefab);
            source = '新建对象';
        }
        
        if (unit) {
            // 激活对象
            unit.active = true;
            
            // 更新活跃计数
            const count = this.activeCount.get(prefabName) || 0;
            this.activeCount.set(prefabName, count + 1);
            
        }
        
        return unit;
    }
    
    /**
     * 将单位返回到对象池
     * @param unit 单位节点
     * @param prefabName 预制体名称（如果不知道，会尝试自动检测）
     */
    release(unit: Node | null, prefabName?: string): void {
        if (!unit || !unit.isValid) {
           //console.info(`[UnitPool] 释放对象失败: 对象无效`);
            return;
        }
        
        // 如果未提供prefabName，尝试从节点名称或组件推断
        if (!prefabName) {
            const nodeName = unit.name;
            // 尝试从组件推断
            const roleScript = unit.getComponent('Role') as any;
            if (roleScript && roleScript.prefabName) {
                prefabName = roleScript.prefabName;
            } else {
                // 尝试匹配常见的单位名称
                if (nodeName.includes('Arrower') || nodeName.includes('Tower')) {
                    prefabName = 'Arrower';
                } else if (nodeName.includes('Priest')) {
                    prefabName = 'Priest';
                } else if (nodeName.includes('Hunter')) {
                    prefabName = 'Hunter';
                } else if (nodeName.includes('ElfSwordsman') || nodeName.includes('Swordsman')) {
                    prefabName = 'ElfSwordsman';
                } else {
                    // 如果无法推断，尝试所有池
                    for (const [name, pool] of this.pools.entries()) {
                        if (pool.length < this.MAX_POOL_SIZE) {
                            prefabName = name;
                            break;
                        }
                    }
                    if (!prefabName) {
                        // 如果所有池都满了，直接销毁
                       //console.info(`[UnitPool] 释放对象失败: 无法推断类型且所有池已满, 销毁对象: ${unit.name}`);
                        unit.destroy();
                        return;
                    }
                }
            }
        }
        
        const pool = this.pools.get(prefabName);
        if (!pool) {
            // 如果找不到对应的池，直接销毁
           //console.info(`[UnitPool] 释放对象失败: 未找到 ${prefabName} 的池, 销毁对象: ${unit.name}`);
            unit.destroy();
            return;
        }
        
        const poolSizeBefore = pool.length;
        const activeCountBefore = this.activeCount.get(prefabName) || 0;
        
        // 重置单位状态
        unit.active = false;
        unit.setParent(this.poolContainer); // 移回对象池容器节点
        
        // 重置增幅标志，以便下次复用时可以重新应用增幅
        const roleScript = unit.getComponent('Role') as any;
        if (roleScript) {
            roleScript._enhancementsApplied = false;
        }
        
        // 如果池未满，放回池中
        if (pool.length < this.MAX_POOL_SIZE) {
            pool.push(unit);
            
            // 更新活跃计数
            const count = this.activeCount.get(prefabName) || 0;
            this.activeCount.set(prefabName, Math.max(0, count - 1));
            
        } else {
            // 池已满，直接销毁
           //console.info(`[UnitPool] 释放 ${prefabName}: 池已满(${pool.length}/${this.MAX_POOL_SIZE}), 销毁对象: ${unit.name}`);
            unit.destroy();
        }
    }
    
    /**
     * 清空所有对象池
     */
    clearAllPools() {
        let totalDestroyed = 0;
        const poolNames: string[] = [];
        
        for (const [name, pool] of this.pools.entries()) {
            poolNames.push(name);
            const poolSize = pool.length;
            for (const unit of pool) {
                if (unit && unit.isValid) {
                    unit.destroy();
                    totalDestroyed++;
                }
            }
            pool.length = 0;
        }
        
        this.pools.clear();
        this.activeCount.clear();
        
       //console.info(`[UnitPool] 清空所有对象池: 销毁了 ${totalDestroyed} 个对象, 池类型: [${poolNames.join(', ')}]`);
    }
    
    /**
     * 获取对象池统计信息（用于调试）
     */
    getStats(): { [key: string]: { poolSize: number; activeCount: number } } {
        const stats: { [key: string]: { poolSize: number; activeCount: number } } = {};
        for (const [name, pool] of this.pools.entries()) {
            stats[name] = {
                poolSize: pool.length,
                activeCount: this.activeCount.get(name) || 0
            };
        }
        return stats;
    }
}

