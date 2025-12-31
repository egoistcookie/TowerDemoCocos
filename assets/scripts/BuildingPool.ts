import { _decorator, Component, Node, Prefab, instantiate, find } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 建筑物对象池管理器
 * 用于复用建筑物对象，减少创建和销毁开销，提升性能
 */
@ccclass('BuildingPool')
export class BuildingPool extends Component {
    private static instance: BuildingPool = null!;
    
    // 对象池容器节点（用于存储池中的建筑物）
    private poolContainer: Node = null!;
    
    // 对象池：按建筑物类型分类存储
    private pools: Map<string, Node[]> = new Map();
    
    // 预制体映射
    private prefabMap: Map<string, Prefab> = new Map();
    
    // 对象池配置
    private readonly INITIAL_POOL_SIZE: number = 3; // 初始池大小（建筑物通常较少）
    private readonly MAX_POOL_SIZE: number = 20; // 最大池大小（每种类型）
    
    // 活跃对象计数（用于调试）
    private activeCount: Map<string, number> = new Map();
    
    static getInstance(): BuildingPool | null {
        return BuildingPool.instance;
    }
    
    onLoad() {
        BuildingPool.instance = this;
        // 确保节点名称正确
        this.node.name = 'BuildingPool';
        
        // 创建或获取池容器节点
        if (!this.poolContainer) {
            this.poolContainer = new Node('PoolContainer');
            this.poolContainer.setParent(this.node);
        }
    }
    
    onDestroy() {
        if (BuildingPool.instance === this) {
            BuildingPool.instance = null!;
        }
        this.clearAllPools();
    }
    
    /**
     * 注册建筑物预制体
     * @param prefabName 预制体名称（如 "WarAncientTree", "HunterHall", "StoneWall" 等）
     * @param prefab 预制体
     */
    registerPrefab(prefabName: string, prefab: Prefab) {
        this.prefabMap.set(prefabName, prefab);
        
        // 如果该类型的池不存在，创建它
        if (!this.pools.has(prefabName)) {
            this.pools.set(prefabName, []);
            this.activeCount.set(prefabName, 0);
            console.info(`[BuildingPool] 注册预制体: ${prefabName}, 创建新池`);
        } else {
            console.info(`[BuildingPool] 注册预制体: ${prefabName}, 池已存在`);
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
            const building = instantiate(prefab);
            building.active = false; // 设置为非激活状态
            building.setParent(this.poolContainer); // 设置为对象池容器的子节点
            pool.push(building);
        }
        
        if (pool.length > initialCount) {
            console.info(`[BuildingPool] 预热 ${prefabName}: 创建了 ${pool.length - initialCount} 个对象, 池大小: ${pool.length}`);
        }
    }
    
    /**
     * 从对象池获取建筑物
     * @param prefabName 预制体名称
     * @returns 建筑物节点，如果失败返回null
     */
    get(prefabName: string): Node | null {
        const pool = this.pools.get(prefabName);
        const prefab = this.prefabMap.get(prefabName);
        
        if (!pool || !prefab) {
            console.warn(`[BuildingPool] 未找到预制体: ${prefabName}`);
            return null;
        }
        
        let building: Node | null = null;
        let source = '';
        
        // 尝试从池中获取
        if (pool.length > 0) {
            building = pool.pop()!;
            source = '池中获取';
        } else {
            // 池为空，创建新对象
            building = instantiate(prefab);
            source = '新建对象';
        }
        
        if (building) {
            // 激活对象
            building.active = true;
            
            // 更新活跃计数
            const count = this.activeCount.get(prefabName) || 0;
            this.activeCount.set(prefabName, count + 1);
        }
        
        return building;
    }
    
    /**
     * 将建筑物返回到对象池
     * @param building 建筑物节点
     * @param prefabName 预制体名称（如果不知道，会尝试自动检测）
     */
    release(building: Node | null, prefabName?: string): void {
        if (!building || !building.isValid) {
            console.info(`[BuildingPool] 释放对象失败: 对象无效`);
            return;
        }
        
        // 如果未提供prefabName，尝试从节点名称或组件推断
        if (!prefabName) {
            const nodeName = building.name;
            // 尝试从组件推断
            const buildScript = building.getComponent('Build') as any;
            if (buildScript && buildScript.prefabName) {
                prefabName = buildScript.prefabName;
            } else {
                // 尝试匹配常见的建筑物名称
                if (nodeName.includes('WarAncientTree') || nodeName.includes('Tree')) {
                    prefabName = 'WarAncientTree';
                } else if (nodeName.includes('HunterHall') || nodeName.includes('Hall')) {
                    prefabName = 'HunterHall';
                } else if (nodeName.includes('SwordsmanHall')) {
                    prefabName = 'SwordsmanHall';
                } else if (nodeName.includes('Church')) {
                    prefabName = 'Church';
                } else if (nodeName.includes('StoneWall') || nodeName.includes('Wall')) {
                    prefabName = 'StoneWall';
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
                        console.info(`[BuildingPool] 释放对象失败: 无法推断类型且所有池已满, 销毁对象: ${building.name}`);
                        building.destroy();
                        return;
                    }
                }
            }
        }
        
        const pool = this.pools.get(prefabName);
        if (!pool) {
            // 如果找不到对应的池，直接销毁
            console.info(`[BuildingPool] 释放对象失败: 未找到 ${prefabName} 的池, 销毁对象: ${building.name}`);
            building.destroy();
            return;
        }
        
        // 重置建筑物状态
        building.active = false;
        building.setParent(this.poolContainer); // 移回对象池容器节点
        
        // 如果池未满，放回池中
        if (pool.length < this.MAX_POOL_SIZE) {
            pool.push(building);
            
            // 更新活跃计数
            const count = this.activeCount.get(prefabName) || 0;
            this.activeCount.set(prefabName, Math.max(0, count - 1));
        } else {
            // 池已满，直接销毁
            console.info(`[BuildingPool] 释放 ${prefabName}: 池已满(${pool.length}/${this.MAX_POOL_SIZE}), 销毁对象: ${building.name}`);
            building.destroy();
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
            for (const building of pool) {
                if (building && building.isValid) {
                    building.destroy();
                    totalDestroyed++;
                }
            }
            pool.length = 0;
        }
        
        this.pools.clear();
        this.activeCount.clear();
        
        console.info(`[BuildingPool] 清空所有对象池: 销毁了 ${totalDestroyed} 个对象, 池类型: [${poolNames.join(', ')}]`);
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

