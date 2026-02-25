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
    playerLevel: number;  // 玩家等级（Lv.x），只增不减
    talentLevels?: Record<string, number>;  // 天赋ID -> 等级
    unitEnhancements?: Record<string, UnitEnhancement>;  // 单位ID -> 强化数据
    passedLevels?: number[];  // 已通过的关卡列表（关卡号）
    stamina?: number;  // 体力值（0-50）
    lastStaminaRecoverTime?: number;  // 最后恢复体力的时间戳（毫秒）
}

@ccclass('PlayerDataManager')
export class PlayerDataManager {
    private static instance: PlayerDataManager | null = null;
    private playerData: PlayerData = {
        experience: 0,
        talentPoints: 0,
        playerLevel: 1,  // 玩家等级从1级开始
        talentLevels: {},
        unitEnhancements: {},
        passedLevels: [1],  // 默认第一关已通过（解锁）
        stamina: 50,  // 默认满体力
        lastStaminaRecoverTime: Date.now()  // 默认当前时间
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
                        playerLevel: 1,
                        talentLevels: {},
                        unitEnhancements: {},
                        passedLevels: [1],  // 默认第一关已通过
                        stamina: 50,  // 默认满体力
                        lastStaminaRecoverTime: Date.now(),
                        ...parsedData
                    };
                    if (!this.playerData.talentLevels) {
                        this.playerData.talentLevels = {};
                    }
                    if (!this.playerData.unitEnhancements) {
                        this.playerData.unitEnhancements = {};
                    }
                    if (!this.playerData.passedLevels || this.playerData.passedLevels.length === 0) {
                        this.playerData.passedLevels = [1];  // 默认第一关已通过
                    }
                    if (this.playerData.stamina === undefined) {
                        this.playerData.stamina = 50;
                    }
                    if (this.playerData.lastStaminaRecoverTime === undefined) {
                        this.playerData.lastStaminaRecoverTime = Date.now();
                    }
                    
                    // 兼容性处理：如果 playerLevel 不存在或为默认值1，则根据已消耗的天赋点计算正确的等级
                    if (!this.playerData.playerLevel || this.playerData.playerLevel === 1) {
                        this.playerData.playerLevel = this.calculatePlayerLevelFromData();
                        console.log(`[PlayerDataManager] 兼容性处理：计算玩家等级为 ${this.playerData.playerLevel}`);
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
                        playerLevel: 1,
                        talentLevels: {},
                        unitEnhancements: {},
                        passedLevels: [1],  // 默认第一关已通过
                        stamina: 50,  // 默认满体力
                        lastStaminaRecoverTime: Date.now()
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
                            playerLevel: 1,
                            talentLevels: {},
                            unitEnhancements: {},
                            stamina: 50,
                            lastStaminaRecoverTime: Date.now(),
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
                        if (this.playerData.stamina === undefined) {
                            this.playerData.stamina = 50;
                        }
                        if (this.playerData.lastStaminaRecoverTime === undefined) {
                            this.playerData.lastStaminaRecoverTime = Date.now();
                        }
                    } catch (e) {
                        this.playerData = {
                            experience: 0,
                            talentPoints: 5,
                            playerLevel: 1,
                            talentLevels: {},
                            unitEnhancements: {},
                            stamina: 50,
                            lastStaminaRecoverTime: Date.now(),
                            ...configData
                        };
                    }
                } else {
                    this.playerData = {
                        experience: 0,
                        talentPoints: 5,
                        playerLevel: 1,
                        talentLevels: {},
                        unitEnhancements: {},
                        stamina: 50,
                        lastStaminaRecoverTime: Date.now(),
                        ...configData
                    };
                }

                // 兼容性处理：如果 playerLevel 不存在或为默认值1，则根据已消耗的天赋点计算正确的等级
                if (!this.playerData.playerLevel || this.playerData.playerLevel === 1) {
                    this.playerData.playerLevel = this.calculatePlayerLevelFromData();
                    console.log(`[PlayerDataManager] 兼容性处理：计算玩家等级为 ${this.playerData.playerLevel}`);
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
     * 获取玩家等级
     */
    public getPlayerLevel(): number {
        return this.playerData.playerLevel || 1;
    }

    /**
     * 设置玩家等级（只能增加，不能减少）
     */
    public setPlayerLevel(level: number): void {
        if (level > this.playerData.playerLevel) {
            this.playerData.playerLevel = level;
            this.saveData();
        }
    }

    /**
     * 增加玩家等级
     */
    public increasePlayerLevel(amount: number = 1): void {
        this.playerData.playerLevel = (this.playerData.playerLevel || 1) + amount;
        this.saveData();
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
            
            // 玩家等级也增加（每获得1个天赋点，玩家等级+1）
            this.playerData.playerLevel = (this.playerData.playerLevel || 1) + talentPointsGained;
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
     * 标记关卡为已通过
     * @param level 关卡号（1-5）
     */
    public passLevel(level: number): void {
        if (!this.playerData.passedLevels) {
            this.playerData.passedLevels = [1];  // 默认第一关已通过
        }
        if (this.playerData.passedLevels.indexOf(level) === -1) {
            this.playerData.passedLevels.push(level);
            this.saveData();
        }
    }

    /**
     * 检查关卡是否已通过
     * @param level 关卡号（1-5）
     * @returns 是否已通过
     */
    public isLevelPassed(level: number): boolean {
        if (!this.playerData.passedLevels) {
            this.playerData.passedLevels = [1];  // 默认第一关已通过
        }
        return this.playerData.passedLevels.indexOf(level) !== -1;
    }

    /**
     * 获取已通过的关卡列表
     * @returns 已通过的关卡号数组
     */
    public getPassedLevels(): number[] {
        if (!this.playerData.passedLevels) {
            this.playerData.passedLevels = [1];  // 默认第一关已通过
        }
        return [...this.playerData.passedLevels];
    }

    /**
     * 重置玩家数据（用于测试或重置功能）
     */
    public resetData(): void {
        this.playerData = {
            experience: 0,
            talentPoints: 0,
            playerLevel: 1,
            talentLevels: {},
            unitEnhancements: {},
            passedLevels: [1],  // 默认第一关已通过
            stamina: 50,
            lastStaminaRecoverTime: Date.now()
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

    /**
     * 获取当前体力值（会自动计算恢复）
     */
    public getStamina(): number {
        this.updateStaminaRecovery();
        return Math.min(50, Math.max(0, this.playerData.stamina || 50));
    }

    /**
     * 消耗体力
     * @param amount 消耗的体力值
     * @returns 是否成功消耗
     */
    public consumeStamina(amount: number): boolean {
        this.updateStaminaRecovery();
        const currentStamina = this.playerData.stamina || 50;
        if (currentStamina >= amount) {
            this.playerData.stamina = currentStamina - amount;
            this.saveData();
            return true;
        }
        return false;
    }

    /**
     * 更新体力恢复（每5分钟回复1点）
     */
    private updateStaminaRecovery(): void {
        const now = Date.now();
        const lastTime = this.playerData.lastStaminaRecoverTime || now;
        const currentStamina = this.playerData.stamina || 50;
        
        // 每 5 分钟回复 1 点
        const intervalMs = 5 * 60 * 1000;
        const intervalsPassed = Math.floor((now - lastTime) / intervalMs);
        
        if (intervalsPassed > 0 && currentStamina < 50) {
            // 每5分钟回复1点，最多回复到50
            const newStamina = Math.min(50, currentStamina + intervalsPassed);
            this.playerData.stamina = newStamina;
            // 更新最后恢复时间（只记录到 5 分钟粒度）
            this.playerData.lastStaminaRecoverTime = lastTime + intervalsPassed * intervalMs;
            this.saveData();
        }
    }

    /**
     * 获取距离下一次恢复 1 点体力的剩余毫秒数
     * - 若体力已满，返回 0
     */
    public getMsUntilNextStamina(): number {
        this.updateStaminaRecovery();
        const currentStamina = Math.min(50, Math.max(0, this.playerData.stamina || 50));
        if (currentStamina >= 50) {
            return 0;
        }
        const now = Date.now();
        const lastTime = this.playerData.lastStaminaRecoverTime || now;
        const intervalMs = 5 * 60 * 1000;
        const elapsed = now - lastTime;
        const remain = intervalMs - (elapsed % intervalMs);
        return Math.max(0, remain);
    }

    /**
     * 检查是否有足够的体力
     * @param amount 需要的体力值
     * @returns 是否有足够的体力
     */
    public hasEnoughStamina(amount: number): boolean {
        this.updateStaminaRecovery();
        return (this.playerData.stamina || 50) >= amount;
    }

    /**
     * 根据已有数据计算玩家等级（用于兼容性处理）
     * 玩家等级 = 当前天赋点 + 已消耗的天赋点
     * @returns 计算出的玩家等级
     */
    private calculatePlayerLevelFromData(): number {
        let totalLevel = 1; // 初始等级为1
        
        // 1. 当前未使用的天赋点
        const currentTalentPoints = this.playerData.talentPoints || 0;
        totalLevel += currentTalentPoints;
        
        // 2. 计算天赋升级消耗的天赋点
        if (this.playerData.talentLevels) {
            for (const talentId in this.playerData.talentLevels) {
                if (this.playerData.talentLevels.hasOwnProperty(talentId)) {
                    const talentLevel = this.playerData.talentLevels[talentId];
                    // 假设每级天赋消耗1点（根据实际情况调整）
                    totalLevel += talentLevel * 1;
                }
            }
        }
        
        // 3. 计算单位强化消耗的天赋点（分段递增）
        if (this.playerData.unitEnhancements) {
            for (const unitId in this.playerData.unitEnhancements) {
                if (this.playerData.unitEnhancements.hasOwnProperty(unitId)) {
                    const enhancement = this.playerData.unitEnhancements[unitId];
                    if (enhancement && enhancement.enhancements) {
                        // 计算该单位的总强化次数
                        let unitEnhancementCount = 0;
                        const enhancements = enhancement.enhancements;
                        
                        // 攻击力：1点 = 1次强化
                        if (enhancements.attackDamage) {
                            unitEnhancementCount += Math.floor(enhancements.attackDamage / 1);
                        }
                        
                        // 攻击速度：5% = 1次强化
                        if (enhancements.attackSpeed) {
                            unitEnhancementCount += Math.floor(enhancements.attackSpeed / 5);
                        }
                        
                        // 生命值：2点 = 1次强化
                        if (enhancements.maxHealth) {
                            unitEnhancementCount += Math.floor(enhancements.maxHealth / 2);
                        }
                        
                        // 移动速度：5点 = 1次强化
                        if (enhancements.moveSpeed) {
                            unitEnhancementCount += Math.floor(enhancements.moveSpeed / 5);
                        }
                        
                        // 建造成本：1点 = 1次强化
                        if (enhancements.buildCost) {
                            unitEnhancementCount += Math.abs(Math.floor(enhancements.buildCost / 1));
                        }
                        
                        // 根据强化次数计算消耗的天赋点（分段递增）
                        // 1-5级：每次消耗1点
                        // 6-10级：每次消耗2点
                        // 11-15级：每次消耗3点
                        // 以此类推
                        for (let i = 0; i < unitEnhancementCount; i++) {
                            const pointsForThisLevel = Math.floor(i / 5) + 1;
                            totalLevel += pointsForThisLevel;
                        }
                    }
                }
            }
        }
        
        return totalLevel;
    }
}

