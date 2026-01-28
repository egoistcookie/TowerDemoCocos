import { _decorator, Component, Node } from 'cc';
const { ccclass } = _decorator;

/**
 * 伤害统计数据
 */
export interface UnitDamageData {
    unitType: string;        // 单位类型（如 'WatchTower', 'IceTower', 'Arrower' 等）
    unitName: string;        // 单位显示名称（如 '哨塔', '冰塔', '弓箭手' 等）
    totalDamage: number;     // 总伤害
    hitCount: number;        // 命中次数
    dps: number;             // 每秒伤害（DPS）
    startTime: number;       // 开始时间
    endTime: number;         // 结束时间（或当前时间）
}

/**
 * 伤害统计管理器（单例）
 * 用于记录游戏中所有单位的伤害数据
 */
@ccclass('DamageStatistics')
export class DamageStatistics {
    private static instance: DamageStatistics | null = null;
    
    // 存储每个单位的伤害数据（key: unitType, value: UnitDamageData）
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
        console.info('[DamageStatistics] 开始记录伤害统计');
    }
    
    /**
     * 停止记录伤害统计
     */
    public stopRecording() {
        this.isRecording = false;
        console.info('[DamageStatistics] 停止记录伤害统计');
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
     * 记录单位造成的伤害
     * @param unitType 单位类型（如 'WatchTower', 'IceTower', 'Arrower' 等）
     * @param unitName 单位显示名称（如 '哨塔', '冰塔', '弓箭手' 等）
     * @param damage 伤害值
     */
    public recordDamage(unitType: string, unitName: string, damage: number) {
        if (!this.isRecording || damage <= 0) {
            return;
        }
        
        // 获取或创建该单位的伤害数据
        let data = this.damageMap.get(unitType);
        if (!data) {
            data = {
                unitType: unitType,
                unitName: unitName,
                totalDamage: 0,
                hitCount: 0,
                dps: 0,
                startTime: Date.now(),
                endTime: Date.now()
            };
            this.damageMap.set(unitType, data);
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
     */
    public getTopDPSUnits(topN: number = 3): UnitDamageData[] {
        const allData = this.getAllDamageData();
        
        // 按DPS降序排序
        allData.sort((a, b) => b.dps - a.dps);
        
        // 返回前N位
        return allData.slice(0, topN);
    }
    
    /**
     * 获取总伤害排名前N位的单位
     * @param topN 前N位，默认为3
     */
    public getTopDamageUnits(topN: number = 3): UnitDamageData[] {
        const allData = this.getAllDamageData();
        
        // 按总伤害降序排序
        allData.sort((a, b) => b.totalDamage - a.totalDamage);
        
        // 返回前N位
        return allData.slice(0, topN);
    }
    
    /**
     * 获取单位类型的中文名称映射
     */
    public static getUnitTypeNameMap(): Map<string, string> {
        const map = new Map<string, string>();
        map.set('WatchTower', '哨塔');
        map.set('IceTower', '冰塔');
        map.set('ThunderTower', '雷塔');
        map.set('Arrower', '弓箭手');
        map.set('Hunter', '女猎手'); // 修正：实际类名是 Hunter，不是 Huntress
        map.set('ElfSwordsman', '剑士'); // 修正：实际类名是 ElfSwordsman，不是 Swordsman
        map.set('HunterHall', '弓箭手小屋');
        map.set('WarAncientTree', '战争古树');
        return map;
    }
}
