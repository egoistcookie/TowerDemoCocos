import { _decorator, Component, Node, Prefab, instantiate, find } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 敌人对象池管理器
 * 用于复用敌人对象，减少创建和销毁开销，提升性能
 */
@ccclass('EnemyPool')
export class EnemyPool extends Component {
    private static instance: EnemyPool = null!;
    
    // 对象池容器节点（用于存储池中的敌人）
    private poolContainer: Node = null!;
    
    // 对象池：按敌人类型分类存储
    private pools: Map<string, Node[]> = new Map();
    
    // 预制体映射
    private prefabMap: Map<string, Prefab> = new Map();
    
    // 对象池配置
    private readonly INITIAL_POOL_SIZE: number = 10; // 初始池大小
    private readonly MAX_POOL_SIZE: number = 50; // 最大池大小（每种类型）
    
    // 活跃对象计数（用于调试）
    private activeCount: Map<string, number> = new Map();
    
    static getInstance(): EnemyPool | null {
        return EnemyPool.instance;
    }
    
    onLoad() {
        EnemyPool.instance = this;
        // 确保节点名称正确
        this.node.name = 'EnemyPool';
        
        // 创建或获取池容器节点
        if (!this.poolContainer) {
            this.poolContainer = new Node('PoolContainer');
            this.poolContainer.setParent(this.node);
        }
    }
    
    onDestroy() {
        if (EnemyPool.instance === this) {
            EnemyPool.instance = null!;
        }
        this.clearAllPools();
    }
    
    /**
     * 注册敌人预制体
     * @param prefabName 预制体名称（如 "Orc", "OrcWarrior" 等）
     * @param prefab 预制体
     */
    registerPrefab(prefabName: string, prefab: Prefab) {
        this.prefabMap.set(prefabName, prefab);
        
        // 如果该类型的池不存在，创建它
        if (!this.pools.has(prefabName)) {
            this.pools.set(prefabName, []);
            this.activeCount.set(prefabName, 0);
           //console.info(`[EnemyPool] 注册预制体: ${prefabName}, 创建新池`);
        } else {
           //console.info(`[EnemyPool] 注册预制体: ${prefabName}, 池已存在`);
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
            const enemy = instantiate(prefab);
            enemy.active = false; // 设置为非激活状态
            enemy.setParent(this.poolContainer); // 设置为对象池容器的子节点
            pool.push(enemy);
        }
        
        if (pool.length > initialCount) {
           //console.info(`[EnemyPool] 预热 ${prefabName}: 创建了 ${pool.length - initialCount} 个对象, 池大小: ${pool.length}`);
        }
    }
    
    /**
     * 从对象池获取敌人
     * @param prefabName 预制体名称
     * @returns 敌人节点，如果失败返回null
     */
    get(prefabName: string): Node | null {
        const pool = this.pools.get(prefabName);
        const prefab = this.prefabMap.get(prefabName);
        
        if (!pool || !prefab) {
            console.warn(`[EnemyPool] 未找到预制体: ${prefabName}`);
            return null;
        }
        
        const poolSizeBefore = pool.length;
        const activeCountBefore = this.activeCount.get(prefabName) || 0;
        let enemy: Node | null = null;
        let source = '';
        
        // 尝试从池中获取
        if (pool.length > 0) {
            enemy = pool.pop()!;
            source = '池中获取';
        } else {
            // 池为空，创建新对象
            enemy = instantiate(prefab);
            source = '新建对象';
        }
        
        if (enemy) {
            // 清理所有不需要的子节点（箭矢、长矛等）
            const childrenToRemove: Node[] = [];
            const children = enemy.children || [];
            for (const child of children) {
                if (child && child.isValid) {
                    const arrowScript = child.getComponent('Arrow') as any;
                    const childName = child.name.toLowerCase();
                    // 检查是否是箭矢或长矛
                    if (arrowScript || childName.includes('arrow') || childName.includes('spear') || childName.includes('长矛') || childName.includes('箭矢')) {
                        childrenToRemove.push(child);
                    }
                }
            }
            
            // 销毁箭矢和长矛子节点
            for (const child of childrenToRemove) {
                if (child && child.isValid) {
                    child.destroy();
                }
            }
            
            // 重置敌人脚本状态（如果存在）
            const enemyScript = enemy.getComponent('Enemy') as any;
            const orcWarlordScript = enemy.getComponent('OrcWarlord') as any;
            const orcWarriorScript = enemy.getComponent('OrcWarrior') as any;
            const trollSpearmanScript = enemy.getComponent('TrollSpearman') as any;
            const orcShamanScript = enemy.getComponent('OrcShaman') as any;
            
            const script = enemyScript || orcWarlordScript || orcWarriorScript || trollSpearmanScript || orcShamanScript;
            if (script) {
                // 重置状态
                if (script.resetEnemyState) {
                    script.resetEnemyState();
                } else if (script.onEnable) {
                    // 如果脚本有 onEnable，会在激活时自动调用
                }
                
                // 确保血条存在（如果脚本有 createHealthBar 方法）
                if (script.createHealthBar) {
                    // 检查血条是否已存在
                    const healthBarNode = enemy.children.find(child => {
                        const name = child.name.toLowerCase();
                        return name === 'healthbar' || name === 'health bar';
                    });
                    if (!healthBarNode || !healthBarNode.isValid) {
                        script.createHealthBar();
                    }
                }
            }
            
            // 激活对象
            enemy.active = true;
            
            // 更新活跃计数
            const count = this.activeCount.get(prefabName) || 0;
            this.activeCount.set(prefabName, count + 1);
            
            if (childrenToRemove.length > 0) {
               //console.info(`[EnemyPool] 获取 ${prefabName}: 已清理 ${childrenToRemove.length} 个子节点（箭矢/长矛）`);
            }
        }
        
        return enemy;
    }
    
    /**
     * 将敌人返回到对象池
     * @param enemy 敌人节点
     * @param prefabName 预制体名称（如果不知道，会尝试自动检测）
     */
    release(enemy: Node | null, prefabName?: string): void {
        if (!enemy || !enemy.isValid) {
           //console.info(`[EnemyPool] 释放对象失败: 对象无效`);
            return;
        }
        
            // 如果未提供prefabName，尝试从节点名称推断
        if (!prefabName) {
            const nodeName = enemy.name;
            // 尝试匹配常见的敌人名称
            if (nodeName.includes('OrcShaman') || nodeName.includes('Shaman')) {
                prefabName = 'OrcShaman';
            } else if (nodeName.includes('OrcWarlord') || nodeName.includes('Warlord')) {
                prefabName = 'OrcWarlord';
            } else if (nodeName.includes('OrcWarrior') || (nodeName.includes('Orc') && nodeName.includes('Warrior'))) {
                prefabName = 'OrcWarrior';
            } else if (nodeName.includes('Troll') || nodeName.includes('Spearman')) {
                prefabName = 'TrollSpearman';
            } else if (nodeName.includes('Orc') || nodeName.includes('Enemy')) {
                prefabName = 'Orc';
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
                   //console.info(`[EnemyPool] 释放对象失败: 无法推断类型且所有池已满, 销毁对象: ${enemy.name}`);
                    enemy.destroy();
                    return;
                }
            }
        }
        
        const pool = this.pools.get(prefabName);
        if (!pool) {
            // 如果找不到对应的池，直接销毁
           //console.info(`[EnemyPool] 释放对象失败: 未找到 ${prefabName} 的池, 销毁对象: ${enemy.name}`);
            enemy.destroy();
            return;
        }
        
        const poolSizeBefore = pool.length;
        const activeCountBefore = this.activeCount.get(prefabName) || 0;
        
        // 清理所有不需要的子节点（箭矢、长矛等），但保留血条节点
        const childrenToRemove: Node[] = [];
        const children = enemy.children || [];
        for (const child of children) {
            if (child && child.isValid) {
                // 检查是否是箭矢或长矛（通过组件或名称判断）
                const arrowScript = child.getComponent('Arrow') as any;
                const childName = child.name.toLowerCase();
                // 保留血条节点，清理其他子节点
                if (childName !== 'healthbar' && childName !== 'health bar' && !arrowScript) {
                    // 如果不是血条，检查是否是其他需要保留的节点
                    // 这里可以根据需要添加更多需要保留的节点类型
                } else if (arrowScript || childName.includes('arrow') || childName.includes('spear') || childName.includes('长矛') || childName.includes('箭矢')) {
                    // 是箭矢或长矛，需要清理
                    childrenToRemove.push(child);
                }
            }
        }
        
        // 销毁箭矢和长矛子节点
        for (const child of childrenToRemove) {
            if (child && child.isValid) {
                child.destroy();
            }
        }
        
        // 重置敌人状态
        enemy.active = false;
        enemy.setParent(this.poolContainer); // 移回对象池容器节点
        
        // 如果池未满，放回池中
        if (pool.length < this.MAX_POOL_SIZE) {
            pool.push(enemy);
            
            // 更新活跃计数
            const count = this.activeCount.get(prefabName) || 0;
            this.activeCount.set(prefabName, Math.max(0, count - 1));
            
            if (childrenToRemove.length > 0) {
               //console.info(`[EnemyPool] 释放 ${prefabName}: 已清理 ${childrenToRemove.length} 个子节点（箭矢/长矛）`);
            }
        } else {
            // 池已满，直接销毁
           //console.info(`[EnemyPool] 释放 ${prefabName}: 池已满(${pool.length}/${this.MAX_POOL_SIZE}), 销毁对象: ${enemy.name}`);
            enemy.destroy();
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
            for (const enemy of pool) {
                if (enemy && enemy.isValid) {
                    enemy.destroy();
                    totalDestroyed++;
                }
            }
            pool.length = 0;
        }
        
        this.pools.clear();
        this.activeCount.clear();
        
       //console.info(`[EnemyPool] 清空所有对象池: 销毁了 ${totalDestroyed} 个对象, 池类型: [${poolNames.join(', ')}]`);
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

