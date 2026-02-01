import { _decorator, Component, Node } from 'cc';
const { ccclass } = _decorator;

/**
 * 伤害统计数据
 */
export interface UnitDamageData {
    unitType: string;        // 单位类型（如 'WatchTower', 'IceTower', 'Arrower' 等）
    unitName: string;        // 单位显示名称（如 '哨塔', '冰塔', '弓箭手' 等）
    totalDamage: number;     // 总伤害（进攻贡献）
    hitCount: number;        // 命中次数
    dps: number;             // 每秒伤害（DPS）
    startTime: number;       // 开始时间
    endTime: number;         // 结束时间（或当前时间）
    damageTaken?: number;    // 承受伤害总量（坦克型单位使用，如剑士）
    healAmount?: number;     // 治疗总量（辅助型单位使用，如牧师）
}

/**
 * 伤害统计管理器（单例）
 * 用于记录游戏中所有单位的伤害数据
 */
@ccclass('DamageStatistics')
export class DamageStatistics {
    private static instance: DamageStatistics | null = null;
    
    // 存储每个单位的伤害数据（key: unitName，避免代码压缩后 unitType 相同导致合并）
    private damageMap: Map<string, UnitDamageData> = new Map();
    
    // 游戏开始时间
    private gameStartTime: number = 0;
    
    // 是否正在记录
    private isRecording: boolean = false;
    
    private constructor() {
        // 私有构造函数，确保单例
    }
    
    public static getInstance(): DamageStatistics {
        if (!DamageStatistics.instance) {
            DamageStatistics.instance = new DamageStatistics();
        }
        return DamageStatistics.instance;
    }
    
    /**
     * 开始记录伤害统计
     */
    public startRecording() {
        this.isRecording = true;
        this.gameStartTime = Date.now();
        this.damageMap.clear();
        // console.info('[DamageStatistics] 开始记录伤害统计');
    }
    
    /**
     * 停止记录伤害统计
     */
    public stopRecording() {
        this.isRecording = false;
        // console.info('[DamageStatistics] 停止记录伤害统计');
    }
    
    /**
     * 重置统计数据
     */
    public reset() {
        this.damageMap.clear();
        this.gameStartTime = 0;
        this.isRecording = false;
    }
    
    /**
     * 记录单位造成的伤害（进攻型贡献）
     * @param unitType 单位类型（如 'WatchTower', 'IceTower', 'Arrower' 等）
     * @param unitName 单位显示名称（如 '哨塔', '冰塔', '弓箭手' 等）
     * @param damage 伤害值
     */
    public recordDamage(unitType: string, unitName: string, damage: number) {
        if (!this.isRecording || damage <= 0) {
            return;
        }
        
        // 使用 unitName 作为 key，避免代码压缩后 unitType 相同导致不同单位类型被合并
        // 如果 unitName 为空，使用 unitType 作为回退
        const key = unitName && unitName.trim() !== '' ? unitName : unitType;
        
        // 获取或创建该单位的伤害数据
        let data = this.damageMap.get(key);
        if (!data) {
            data = {
                unitType: unitType,
                unitName: unitName,
                totalDamage: 0,
                hitCount: 0,
                dps: 0,
                startTime: Date.now(),
                endTime: Date.now(),
                damageTaken: 0,
                healAmount: 0
            };
            this.damageMap.set(key, data);
        }
        
        // 更新伤害数据
        data.totalDamage += damage;
        data.hitCount += 1;
        data.endTime = Date.now();
        
        // 计算DPS（每秒伤害）
        const elapsedTime = (data.endTime - data.startTime) / 1000; // 转换为秒
        if (elapsedTime > 0) {
            data.dps = data.totalDamage / elapsedTime;
        } else {
            data.dps = data.totalDamage; // 如果时间太短，直接使用总伤害
        }

        // console.info('[DamageStatistics] recordDamage',
        //     'unitType =', unitType,
        //     'unitName =', unitName,
        //     'key =', key,
        //     'damage =', damage,
        //     'totalDamage =', data.totalDamage,
        //     'hitCount =', data.hitCount,
        //     'dps =', data.dps.toFixed(2));
    }

    /**
     * 记录单位承受的伤害（如剑士的坦度贡献）
     */
    public recordDamageTaken(unitType: string, unitName: string, damage: number) {
        if (!this.isRecording || damage <= 0) {
            return;
        }

        // 使用 unitName 作为 key，避免代码压缩后 unitType 相同导致不同单位类型被合并
        // 如果 unitName 为空，使用 unitType 作为回退
        const key = unitName && unitName.trim() !== '' ? unitName : unitType;

        let data = this.damageMap.get(key);
        if (!data) {
            data = {
                unitType,
                unitName,
                totalDamage: 0,
                hitCount: 0,
                dps: 0,
                startTime: Date.now(),
                endTime: Date.now(),
                damageTaken: 0,
                healAmount: 0
            };
            this.damageMap.set(key, data);
        }

        data.damageTaken = (data.damageTaken || 0) + damage;
        data.endTime = Date.now();

        // console.info('[DamageStatistics] recordDamageTaken',
        //     'unitType =', unitType,
        //     'unitName =', unitName,
        //     'key =', key,
        //     'damageTaken =', data.damageTaken);
    }

    /**
     * 记录单位的治疗量（如牧师的治疗贡献）
     */
    public recordHeal(unitType: string, unitName: string, heal: number) {
        if (!this.isRecording || heal <= 0) {
            return;
        }

        // 使用 unitName 作为 key，避免代码压缩后 unitType 相同导致不同单位类型被合并
        // 如果 unitName 为空，使用 unitType 作为回退
        const key = unitName && unitName.trim() !== '' ? unitName : unitType;

        let data = this.damageMap.get(key);
        if (!data) {
            data = {
                unitType,
                unitName,
                totalDamage: 0,
                hitCount: 0,
                dps: 0,
                startTime: Date.now(),
                endTime: Date.now(),
                damageTaken: 0,
                healAmount: 0
            };
            this.damageMap.set(key, data);
        }

        data.healAmount = (data.healAmount || 0) + heal;
        data.endTime = Date.now();

        // console.info('[DamageStatistics] recordHeal',
        //     'unitType =', unitType,
        //     'unitName =', unitName,
        //     'key =', key,
        //     'healAmount =', data.healAmount);
    }
    
    /**
     * 获取所有单位的伤害数据
     */
    public getAllDamageData(): UnitDamageData[] {
        return Array.from(this.damageMap.values());
    }
    
    /**
     * 获取DPS排名前N位的单位
     * @param topN 前N位，默认为3
     *
     * 说明：目前结算面板采用的是“总伤害”排序，
     * 如果后续需要真正按DPS排序，可以调用本方法。
     */
    public getTopDPSUnits(topN: number = 3): UnitDamageData[] {
        const allData = this.getAllDamageData();
        
        // 按DPS降序排序
        allData.sort((a, b) => b.dps - a.dps);
        
        const topList = allData.slice(0, topN);
        // console.info('[DamageStatistics] getTopDPSUnits topN =', topN,
        //     'allCount =', allData.length,
        //     'topList =', topList.map(d => ({
        //         unitType: d.unitType,
        //         unitName: d.unitName,
        //         totalDamage: d.totalDamage,
        //         dps: Number(d.dps.toFixed(2))
        //     })));
        return topList;
    }
    
    /**
     * 获取总伤害排名前N位的单位
     * @param topN 前N位，默认为3
     */
    public getTopDamageUnits(topN: number = 3): UnitDamageData[] {
        const allData = this.getAllDamageData();
        
        // 按总伤害降序排序
        allData.sort((a, b) => b.totalDamage - a.totalDamage);
        
        const topList = allData.slice(0, topN);
        // console.info('[DamageStatistics] getTopDamageUnits topN =', topN,
        //     'allCount =', allData.length,
        //     'topList =', topList.map(d => ({
        //         unitType: d.unitType,
        //         unitName: d.unitName,
        //         totalDamage: d.totalDamage,
        //         dps: Number(d.dps.toFixed(2))
        //     })));
        return topList;
    }
    
    /**
     * 获取单位类型的中文名称映射
     */
    public static getUnitTypeNameMap(): Map<string, string> {
        const map = new Map<string, string>();
        map.set('WatchTower', '哨塔');
        map.set('IceTower', '冰元素塔');
        map.set('ThunderTower', '雷元素塔');
        map.set('Arrower', '弓箭手');
        map.set('Hunter', '女猎手'); // 修正：实际类名是 Hunter，不是 Huntress
        map.set('ElfSwordsman', '剑士'); // 修正：实际类名是 ElfSwordsman，不是 Swordsman
        map.set('HunterHall', '猎手大厅');
        map.set('WarAncientTree', '弓箭手小屋');
        map.set('Priest', '牧师');
        return map;
    }
}
