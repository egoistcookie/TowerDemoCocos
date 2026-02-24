import { _decorator, Component, Node, find, Vec3 } from 'cc';
import { UnitType } from './UnitType';

const { ccclass, property } = _decorator;

/**
 * 单位管理器 - 用于优化性能，缓存所有单位列表
 * 避免每个单位每帧都查找其他单位
 */
@ccclass('UnitManager')
export class UnitManager extends Component {
    private static instance: UnitManager = null!;
    
    // 缓存的单位列表
    private enemies: Node[] = [];
    private towers: Node[] = [];
    private warAncientTrees: Node[] = [];
    private hunterHalls: Node[] = [];
    private swordsmanHalls: Node[] = [];
    private churches: Node[] = [];
    private stoneWalls: Node[] = [];
    private watchTowers: Node[] = []; // 哨塔列表
    private iceTowers: Node[] = []; // 冰塔列表
    private thunderTowers: Node[] = []; // 雷塔列表
    private hunters: Node[] = []; // 女猎手列表
    private elfSwordsmans: Node[] = []; // 精灵剑士列表
    private crystal: Node = null!;
    
    // 节点引用缓存
    private enemiesNode: Node = null!;
    private towersNode: Node = null!;
    private warAncientTreesNode: Node = null!;
    private hunterHallsNode: Node = null!;
    private swordsmanHallsNode: Node = null!;
    private churchesNode: Node = null!;
    private stoneWallsNode: Node = null!;
    private watchTowersNode: Node = null!; // 哨塔容器节点
    private iceTowersNode: Node = null!; // 冰塔容器节点
    private thunderTowersNode: Node = null!; // 雷塔容器节点
    private huntersNode: Node = null!; // 女猎手容器节点
    private elfSwordsmansNode: Node = null!; // 精灵剑士容器节点
    
    // 更新频率控制
    private updateTimer: number = 0;
    private readonly UPDATE_INTERVAL: number = 0.1; // 每0.1秒更新一次单位列表（而不是每帧）
    
    static getInstance(): UnitManager | null {
        return UnitManager.instance;
    }
    
    start() {
        UnitManager.instance = this;
        this.initializeNodes();
        this.updateUnitLists();
    }
    
    /**
     * 初始化节点引用
     */
    private initializeNodes() {
        this.enemiesNode = find('Canvas/Enemies');
        this.towersNode = find('Canvas/Towers');
        this.warAncientTreesNode = find('Canvas/WarAncientTrees');
        this.hunterHallsNode = find('Canvas/HunterHalls');
        this.swordsmanHallsNode = find('Canvas/SwordsmanHalls');
        this.churchesNode = find('Canvas/Churches');
        this.stoneWallsNode = find('Canvas/StoneWalls');
        this.watchTowersNode = find('Canvas/WatchTowers');
        this.iceTowersNode = find('Canvas/IceTowers');
        this.thunderTowersNode = find('Canvas/ThunderTowers');
        this.huntersNode = find('Canvas/Hunters');
        this.elfSwordsmansNode = find('Canvas/ElfSwordsmans');
        this.crystal = find('Canvas/Crystal');
    }
    
    /**
     * 更新单位列表（不是每帧都更新，而是按间隔更新）
     */
    update(deltaTime: number) {
        this.updateTimer += deltaTime;
        
        if (this.updateTimer >= this.UPDATE_INTERVAL) {
            this.updateTimer = 0;
            this.updateUnitLists();
        }
    }
    
    /**
     * 更新所有单位列表
     */
    private updateUnitLists() {
        // 如果enemiesNode不存在或无效，重新查找（敌人可能是动态生成的）
        if (!this.enemiesNode || !this.enemiesNode.isValid) {
            this.enemiesNode = find('Canvas/Enemies');
        }
        
        // 更新敌人列表（直接使用children，避免重复过滤）
        if (this.enemiesNode && this.enemiesNode.isValid) {
            const allChildren = this.enemiesNode.children || [];
            // 优化：使用更高效的过滤方式
            this.enemies = [];
            for (let i = 0; i < allChildren.length; i++) {
                const node = allChildren[i];
                if (node && node.isValid && node.active) {
                    this.enemies.push(node);
                }
            }
            // console.info(`[UnitManager.updateUnitLists] Enemies节点有 ${allChildren.length} 个子节点，其中 ${this.enemies.length} 个有效且激活`);
        } else {
            this.enemies = [];
            // console.info(`[UnitManager.updateUnitLists] Enemies节点不存在或无效，敌人列表为空`);
        }
        
        // 更新防御塔列表
        if (this.towersNode && this.towersNode.isValid) {
            this.towers = this.towersNode.children.filter(node => 
                node && node.isValid && node.active
            );
        } else {
            this.towers = [];
        }
        
        // 更新战争古树列表
        if (this.warAncientTreesNode && this.warAncientTreesNode.isValid) {
            this.warAncientTrees = this.warAncientTreesNode.children.filter(node => 
                node && node.isValid && node.active
            );
        } else {
            this.warAncientTrees = [];
        }
        
        // 更新猎手大厅列表
        if (this.hunterHallsNode && this.hunterHallsNode.isValid) {
            this.hunterHalls = this.hunterHallsNode.children.filter(node => 
                node && node.isValid && node.active
            );
        } else {
            this.hunterHalls = [];
        }
        
        // 更新剑士大厅列表
        if (this.swordsmanHallsNode && this.swordsmanHallsNode.isValid) {
            this.swordsmanHalls = this.swordsmanHallsNode.children.filter(node => 
                node && node.isValid && node.active
            );
        } else {
            this.swordsmanHalls = [];
        }
        
        // 更新教堂列表
        if (this.churchesNode && this.churchesNode.isValid) {
            this.churches = this.churchesNode.children.filter(node => 
                node && node.isValid && node.active
            );
        } else {
            this.churches = [];
        }
        
        // 更新石墙列表
        if (this.stoneWallsNode && this.stoneWallsNode.isValid) {
            this.stoneWalls = this.stoneWallsNode.children.filter(node => 
                node && node.isValid && node.active
            );
        } else {
            this.stoneWalls = [];
        }
        
        // 更新哨塔列表
        if (this.watchTowersNode && this.watchTowersNode.isValid) {
            this.watchTowers = this.watchTowersNode.children.filter(node => 
                node && node.isValid && node.active
            );
        } else {
            this.watchTowers = [];
        }
        
        // 更新冰塔列表
        if (this.iceTowersNode && this.iceTowersNode.isValid) {
            this.iceTowers = this.iceTowersNode.children.filter(node => 
                node && node.isValid && node.active
            );
        } else {
            this.iceTowers = [];
        }
        
        // 更新雷塔列表
        if (this.thunderTowersNode && this.thunderTowersNode.isValid) {
            this.thunderTowers = this.thunderTowersNode.children.filter(node => 
                node && node.isValid && node.active
            );
        } else {
            this.thunderTowers = [];
        }
        
        // 更新女猎手列表（从对象池容器直接获取）
        if (this.huntersNode && this.huntersNode.isValid) {
            this.hunters = this.huntersNode.children.filter(node => 
                node && node.isValid && node.active
            );
        } else {
            this.hunters = [];
        }
        
        // 更新精灵剑士列表（从对象池容器直接获取）
        if (this.elfSwordsmansNode && this.elfSwordsmansNode.isValid) {
            this.elfSwordsmans = this.elfSwordsmansNode.children.filter(node => 
                node && node.isValid && node.active
            );
        } else {
            this.elfSwordsmans = [];
        }
        
        // 更新水晶引用
        if (!this.crystal || !this.crystal.isValid) {
            this.crystal = find('Canvas/Crystal');
        }
        
        // 更新其他节点引用（如果丢失）
        if (!this.towersNode || !this.towersNode.isValid) {
            this.towersNode = find('Canvas/Towers');
        }
        if (!this.warAncientTreesNode || !this.warAncientTreesNode.isValid) {
            this.warAncientTreesNode = find('Canvas/WarAncientTrees');
        }
        if (!this.hunterHallsNode || !this.hunterHallsNode.isValid) {
            this.hunterHallsNode = find('Canvas/HunterHalls');
        }
        if (!this.swordsmanHallsNode || !this.swordsmanHallsNode.isValid) {
            this.swordsmanHallsNode = find('Canvas/SwordsmanHalls');
        }
        if (!this.churchesNode || !this.churchesNode.isValid) {
            this.churchesNode = find('Canvas/Churches');
        }
        if (!this.stoneWallsNode || !this.stoneWallsNode.isValid) {
            this.stoneWallsNode = find('Canvas/StoneWalls');
        }
        if (!this.watchTowersNode || !this.watchTowersNode.isValid) {
            this.watchTowersNode = find('Canvas/WatchTowers');
        }
        if (!this.iceTowersNode || !this.iceTowersNode.isValid) {
            this.iceTowersNode = find('Canvas/IceTowers');
        }
        if (!this.thunderTowersNode || !this.thunderTowersNode.isValid) {
            this.thunderTowersNode = find('Canvas/ThunderTowers');
        }
        if (!this.huntersNode || !this.huntersNode.isValid) {
            this.huntersNode = find('Canvas/Hunters');
        }
        if (!this.elfSwordsmansNode || !this.elfSwordsmansNode.isValid) {
            this.elfSwordsmansNode = find('Canvas/ElfSwordsmans');
        }
    }
    
    /**
     * 获取所有敌人（已缓存）
     */
    getEnemies(): Node[] {
        return this.enemies.filter(node => node && node.isValid && node.active);
    }
    
    /**
     * 获取所有防御塔（已缓存）
     */
    getTowers(): Node[] {
        return this.towers.filter(node => node && node.isValid && node.active);
    }
    
    /**
     * 获取所有战争古树（已缓存）
     */
    getWarAncientTrees(): Node[] {
        return this.warAncientTrees.filter(node => node && node.isValid && node.active);
    }
    
    /**
     * 获取所有建筑物（包括战争古树、大厅、哨塔、冰塔、雷塔等）
     */
    getBuildings(): Node[] {
        return [
            ...this.warAncientTrees,
            ...this.hunterHalls,
            ...this.swordsmanHalls,
            ...this.churches,
            ...this.watchTowers,
            ...this.iceTowers,
            ...this.thunderTowers
        ].filter(node => node && node.isValid && node.active);
    }
    
    /**
     * 获取所有哨塔（已缓存）
     */
    getWatchTowers(): Node[] {
        return this.watchTowers.filter(node => node && node.isValid && node.active);
    }
    
    /**
     * 获取所有冰塔（已缓存）
     */
    getIceTowers(): Node[] {
        return this.iceTowers.filter(node => node && node.isValid && node.active);
    }
    
    /**
     * 获取所有雷塔（已缓存）
     */
    getThunderTowers(): Node[] {
        return this.thunderTowers.filter(node => node && node.isValid && node.active);
    }
    
    /**
     * 获取所有防御塔（包括哨塔、冰塔、雷塔）
     */
    getDefenseTowers(): Node[] {
        return [
            ...this.watchTowers,
            ...this.iceTowers,
            ...this.thunderTowers
        ].filter(node => node && node.isValid && node.active);
    }
    
    /**
     * 获取所有石墙（已缓存）
     */
    getStoneWalls(): Node[] {
        return this.stoneWalls.filter(node => node && node.isValid && node.active);
    }
    
    /**
     * 获取所有女猎手（已缓存，从对象池容器直接获取）
     */
    getHunters(): Node[] {
        return this.hunters.filter(node => node && node.isValid && node.active);
    }
    
    /**
     * 获取所有精灵剑士（已缓存，从对象池容器直接获取）
     */
    getElfSwordsmans(): Node[] {
        return this.elfSwordsmans.filter(node => node && node.isValid && node.active);
    }
    
    /**
     * 获取水晶节点（已缓存）
     */
    getCrystal(): Node | null {
        return (this.crystal && this.crystal.isValid) ? this.crystal : null;
    }
    
    /**
     * 在指定范围内查找敌人（优化版本，使用粗略距离筛选）
     * @param center 中心位置
     * @param maxDistance 最大距离
     * @param includeOnlyAlive 是否只包含存活的敌人
     */
    getEnemiesInRange(center: Vec3, maxDistance: number, includeOnlyAlive: boolean = true): Node[] {
        // 如果敌人列表为空，立即更新一次（可能UnitManager刚初始化）
        if (this.enemies.length === 0) {
            this.updateUnitLists();
        }
        
        const result: Node[] = [];
        const maxDistanceSq = maxDistance * maxDistance; // 使用距离的平方，避免开方运算
        
        // 优化：使用for循环而不是for...of，性能更好
        for (let i = 0; i < this.enemies.length; i++) {
            const enemy = this.enemies[i];
            if (!enemy || !enemy.isValid || !enemy.active) {
                continue;
            }
            
            // 粗略距离检查（使用平方距离，避免开方）
            const dx = enemy.worldPosition.x - center.x;
            const dy = enemy.worldPosition.y - center.y;
            const distanceSq = dx * dx + dy * dy;
            
            if (distanceSq > maxDistanceSq) {
                continue;
            }
            
            // 存活检查
            if (includeOnlyAlive) {
                const enemyScript = this.getEnemyScript(enemy);
                if (!enemyScript || !this.isAliveEnemy(enemy)) {
                    continue;
                }
            }
            
            result.push(enemy);
        }
        
        // console.info(`[UnitManager.getEnemiesInRange] 返回 ${result.length} 个符合条件的敌人`);
        return result;
    }
    
    /**
     * 在指定范围内查找建筑物
     * @param center 中心位置
     * @param maxDistance 最大距离
     */
    getBuildingsInRange(center: Vec3, maxDistance: number): Node[] {
        const result: Node[] = [];
        const maxDistanceSq = maxDistance * maxDistance;
        const allBuildings = this.getBuildings();
        
        for (const building of allBuildings) {
            if (!building || !building.isValid || !building.active) continue;
            
            const dx = building.worldPosition.x - center.x;
            const dy = building.worldPosition.y - center.y;
            const distanceSq = dx * dx + dy * dy;
            
            if (distanceSq <= maxDistanceSq) {
                result.push(building);
            }
        }
        
        return result;
    }
    
    /**
     * 获取敌人脚本（辅助方法）
     */
    private getEnemyScript(node: Node): any {
        if (!node || !node.isValid || !node.active) {
            return null;
        }
        
        const possibleComponentNames = ['TrollSpearman', 'OrcWarrior', 'OrcWarlord', 'Enemy', 'Orc'];
        for (const compName of possibleComponentNames) {
            const comp = node.getComponent(compName) as any;
            if (comp && comp.unitType === UnitType.ENEMY) {
                return comp;
            }
        }
        
        return null;
    }
    
    /**
     * 检查敌人是否存活
     */
    private isAliveEnemy(node: Node): boolean {
        const enemyScript = this.getEnemyScript(node);
        if (!enemyScript) {
            return false;
        }
        
        if (enemyScript.isAlive && typeof enemyScript.isAlive === 'function') {
            return enemyScript.isAlive();
        } else if (enemyScript.health !== undefined) {
            return enemyScript.health > 0;
        } else if (enemyScript.currentHealth !== undefined) {
            return enemyScript.currentHealth > 0;
        }
        
        return true;
    }
    
    /**
     * 手动刷新单位列表（当单位被创建或销毁时调用）
     */
    refreshUnitLists() {
        this.updateUnitLists();
    }
    
    onDestroy() {
        if (UnitManager.instance === this) {
            UnitManager.instance = null!;
        }
    }
}

