import { _decorator } from 'cc';
import { resources, JsonAsset } from 'cc';
import { sys } from 'cc';

const { ccclass } = _decorator;

/**
 * 单位强化数据结构
 */
export interface UnitEnhancement {
    unitId: string;
    enhancements: {
        attackDamage?: number;    // 攻击力增幅
        attackSpeed?: number;      // 攻击速度增幅（实际是减少attackInterval）
        maxHealth?: number;       // 生命值增幅
        moveSpeed?: number;       // 移动速度增幅
        armor?: number;           // 护甲增幅
        buildCost?: number;        // 建造成本减少（负数表示减少）
    };
}

interface PlayerData {
    experience: number;
    talentPoints: number;
    talentLevels?: Record<string, number>;  // 天赋ID -> 等级
    unitEnhancements?: Record<string, UnitEnhancement>;  // 单位ID -> 强化数据
}

@ccclass('PlayerDataManager')
export class PlayerDataManager {
    private static instance: PlayerDataManager | null = null;
    private playerData: PlayerData = {
        experience: 0,
        talentPoints: 0,
        talentLevels: {},
        unitEnhancements: {}
    };
    private isLoaded: boolean = false;
    private loadPromise: Promise<void> | null = null;
    private readonly STORAGE_KEY = 'playerData';
    private readonly CONFIG_PATH = 'config/playerData';

    private constructor() {}

    public static getInstance(): PlayerDataManager {
        if (!PlayerDataManager.instance) {
            PlayerDataManager.instance = new PlayerDataManager();
        }
        return PlayerDataManager.instance;
    }

    /**
     * 加载玩家数据
     * 优先从localStorage加载，如果不存在则从配置文件加载
     */
    public loadData(): Promise<void> {
        if (this.isLoaded) {
            return Promise.resolve();
        }

        if (this.loadPromise) {
            return this.loadPromise;
        }

        this.loadPromise = new Promise((resolve, reject) => {
            // 首先尝试从localStorage加载
            const savedData = sys.localStorage.getItem(this.STORAGE_KEY);
            if (savedData) {
                try {
                    const parsedData = JSON.parse(savedData);
                    // 确保新字段存在
                    this.playerData = {
                        experience: 0,
                        talentPoints: 5,
                        talentLevels: {},
                        unitEnhancements: {},
                        ...parsedData
                    };
                    if (!this.playerData.talentLevels) {
                        this.playerData.talentLevels = {};
                    }
                    if (!this.playerData.unitEnhancements) {
                        this.playerData.unitEnhancements = {};
                    }
                    this.isLoaded = true;
                    resolve();
                    return;
                } catch (e) {
                    // 如果解析失败，继续从配置文件加载
                }
            }

            // 从配置文件加载
            resources.load(this.CONFIG_PATH, JsonAsset, (err, jsonAsset) => {
                if (err) {
                    // 如果配置文件不存在，使用默认值
                    this.playerData = {
                        experience: 0,
                        talentPoints: 0,
                        talentLevels: {},
                        unitEnhancements: {}
                    };
                    this.isLoaded = true;
                    this.saveData(); // 保存默认值到localStorage
                    resolve();
                    return;
                }

                const configData = jsonAsset.json as PlayerData;
                // 合并配置文件和localStorage的数据（localStorage优先）
                if (savedData) {
                    try {
                        const localStorageData = JSON.parse(savedData);
                        // 确保新字段存在
                        this.playerData = { 
                            experience: 0,
                            talentPoints: 5,
                            talentLevels: {},
                            unitEnhancements: {},
                            ...configData, 
                            ...localStorageData 
                        };
                        // 确保新字段不为undefined
                        if (!this.playerData.talentLevels) {
                            this.playerData.talentLevels = {};
                        }
                        if (!this.playerData.unitEnhancements) {
                            this.playerData.unitEnhancements = {};
                        }
                    } catch (e) {
                        this.playerData = {
                            experience: 0,
                            talentPoints: 5,
                            talentLevels: {},
                            unitEnhancements: {},
                            ...configData
                        };
                    }
                } else {
                    this.playerData = {
                        experience: 0,
                        talentPoints: 5,
                        talentLevels: {},
                        unitEnhancements: {},
                        ...configData
                    };
                }

                this.isLoaded = true;
                this.saveData(); // 确保数据保存到localStorage
                resolve();
            });
        });

        return this.loadPromise;
    }

    /**
     * 保存玩家数据到localStorage
     */
    public saveData(): void {
        try {
            sys.localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.playerData));
        } catch (e) {
            console.error('Failed to save player data:', e);
        }
    }

    /**
     * 获取当前经验值
     */
    public getExperience(): number {
        return this.playerData.experience;
    }

    /**
     * 获取当前天赋点
     */
    public getTalentPoints(): number {
        return this.playerData.talentPoints;
    }

    /**
     * 添加经验值
     * @param amount 要添加的经验值
     * @returns 返回转换后的天赋点数量
     */
    public addExperience(amount: number): number {
        this.playerData.experience += amount;
        
        // 计算可以转换的天赋点
        const talentPointsGained = Math.floor(this.playerData.experience / 100);
        if (talentPointsGained > 0) {
            this.playerData.talentPoints += talentPointsGained;
            this.playerData.experience = this.playerData.experience % 100;
        }
        
        this.saveData();
        return talentPointsGained;
    }

    /**
     * 设置经验值（用于初始化或重置）
     */
    public setExperience(amount: number): void {
        this.playerData.experience = amount;
        this.saveData();
    }

    /**
     * 设置天赋点
     */
    public setTalentPoints(amount: number): void {
        this.playerData.talentPoints = amount;
        this.saveData();
    }

    /**
     * 使用天赋点
     * @param amount 要使用的天赋点数量
     * @returns 是否成功使用
     */
    public useTalentPoint(amount: number): boolean {
        if (this.playerData.talentPoints >= amount) {
            this.playerData.talentPoints -= amount;
            this.saveData();
            return true;
        }
        return false;
    }

    /**
     * 获取下一级所需经验值
     */
    public getRemainingExpForNextLevel(): number {
        return 100 - (this.playerData.experience % 100);
    }

    /**
     * 获取天赋等级
     * @param talentId 天赋ID
     * @returns 天赋等级，如果不存在则返回0
     */
    public getTalentLevel(talentId: string): number {
        if (!this.playerData.talentLevels) {
            this.playerData.talentLevels = {};
        }
        return this.playerData.talentLevels[talentId] || 0;
    }

    /**
     * 设置天赋等级
     * @param talentId 天赋ID
     * @param level 等级
     */
    public setTalentLevel(talentId: string, level: number): void {
        if (!this.playerData.talentLevels) {
            this.playerData.talentLevels = {};
        }
        this.playerData.talentLevels[talentId] = level;
        this.saveData();
    }

    /**
     * 获取单位强化数据
     * @param unitId 单位ID
     * @returns 单位强化数据，如果不存在则返回null
     */
    public getUnitEnhancement(unitId: string): UnitEnhancement | null {
        if (!this.playerData.unitEnhancements) {
            this.playerData.unitEnhancements = {};
        }
        return this.playerData.unitEnhancements[unitId] || null;
    }

    /**
     * 设置单位强化数据
     * @param unitId 单位ID
     * @param enhancement 强化数据
     */
    public setUnitEnhancement(unitId: string, enhancement: UnitEnhancement): void {
        if (!this.playerData.unitEnhancements) {
            this.playerData.unitEnhancements = {};
        }
        this.playerData.unitEnhancements[unitId] = enhancement;
        this.saveData();
    }

    /**
     * 重置玩家数据（用于测试或重置功能）
     */
    public resetData(): void {
        this.playerData = {
            experience: 0,
            talentPoints: 0,
            talentLevels: {},
            unitEnhancements: {}
        };
        this.saveData();
    }
    
    /**
     * 导出玩家数据为JSON字符串（用于调试或备份）
     * 注意：在Cocos Creator运行时环境中，无法直接写入resources目录下的文件
     * 数据已自动保存到localStorage，此方法仅用于导出查看
     */
    public exportDataAsJSON(): string {
        return JSON.stringify(this.playerData, null, 2);
    }
    
    /**
     * 获取玩家数据的副本（用于查看）
     */
    public getPlayerData(): PlayerData {
        return { ...this.playerData };
    }
}

