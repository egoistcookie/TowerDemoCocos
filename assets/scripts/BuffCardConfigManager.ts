import { resources, JsonAsset } from 'cc';

/**
 * 增益效果配置接口
 */
export interface BuffEffect {
    value: number;
    desc: string;
}

/**
 * 增益卡片配置接口
 */
export interface BuffCardConfig {
    rarityProbabilities: {
        R: number;
        SR: number;
        SSR: number;
    };
    buffEffects: {
        [rarity: string]: {
            tower: Record<string, BuffEffect>;
            role: Record<string, BuffEffect>;
            building: Record<string, BuffEffect>;
            global: Record<string, BuffEffect>;
        };
    };
    unitTypeCategories: {
        tower: string[];
        role: string[];
        building: string[];
    };
}

/**
 * 增益卡片配置管理器
 * 单例模式，负责加载和管理增益卡片配置
 */
export class BuffCardConfigManager {
    private static instance: BuffCardConfigManager;
    private config: BuffCardConfig | null = null;
    private isLoaded: boolean = false;
    private loadPromise: Promise<void> | null = null;

    private constructor() {}

    /**
     * 获取单例实例
     */
    public static getInstance(): BuffCardConfigManager {
        if (!BuffCardConfigManager.instance) {
            BuffCardConfigManager.instance = new BuffCardConfigManager();
        }
        return BuffCardConfigManager.instance;
    }

    /**
     * 加载配置文件
     */
    public loadConfig(): Promise<void> {
        if (this.isLoaded) {
            return Promise.resolve();
        }

        if (this.loadPromise) {
            return this.loadPromise;
        }

        this.loadPromise = new Promise((resolve, reject) => {
            resources.load('config/buffCardConfig', JsonAsset, (err, jsonAsset) => {
                if (err) {
                    console.error('[BuffCardConfigManager] 加载配置文件失败:', err);
                    reject(err);
                    return;
                }

                this.config = jsonAsset.json as BuffCardConfig;
                this.isLoaded = true;
                console.info('[BuffCardConfigManager] 配置文件加载成功');
                resolve();
            });
        });

        return this.loadPromise;
    }

    /**
     * 获取配置
     */
    public getConfig(): BuffCardConfig | null {
        return this.config;
    }

    /**
     * 根据概率随机生成卡片稀有度
     */
    public generateRarity(): 'R' | 'SR' | 'SSR' {
        if (!this.config) {
            console.warn('[BuffCardConfigManager] 配置未加载，返回默认R');
            return 'R'; // 默认返回R
        }

        const rand = Math.random();
        const probs = this.config.rarityProbabilities;
        
        // 确保概率值正确（R: 0-0.9, SR: 0.9-0.98, SSR: 0.98-1.0）
        let rarity: 'R' | 'SR' | 'SSR';
        if (rand < probs.R) {
            rarity = 'R';
        } else if (rand < probs.R + probs.SR) {
            rarity = 'SR';
        } else {
            rarity = 'SSR';
        }
        
        // 调试日志：输出概率计算详情
        console.info(`[BuffCardConfigManager] generateRarity: rand=${rand.toFixed(4)}, R=${probs.R}, SR=${probs.SR}, SSR=${1 - probs.R - probs.SR}, 结果=${rarity}`);
        
        return rarity;
    }

    /**
     * 获取单位类型分类
     */
    public getUnitTypeCategory(unitType: string): 'tower' | 'role' | 'building' | null {
        if (!this.config) {
            return null;
        }

        const categories = this.config.unitTypeCategories;
        if (categories.tower.indexOf(unitType) !== -1) {
            return 'tower';
        } else if (categories.role.indexOf(unitType) !== -1) {
            return 'role';
        } else if (categories.building.indexOf(unitType) !== -1) {
            return 'building';
        }
        return null;
    }

    /**
     * 获取指定稀有度和单位类型的增益效果列表
     */
    public getBuffEffects(rarity: 'R' | 'SR' | 'SSR', unitCategory: 'tower' | 'role' | 'building' | null): Record<string, BuffEffect> {
        if (!this.config) {
            return {};
        }

        const rarityConfig = this.config.buffEffects[rarity];
        if (!rarityConfig) {
            return {};
        }

        if (unitCategory && rarityConfig[unitCategory]) {
            return rarityConfig[unitCategory];
        }

        return {};
    }

    /**
     * 获取全局增益效果列表（人口、金币等）
     */
    public getGlobalBuffEffects(rarity: 'R' | 'SR' | 'SSR'): Record<string, BuffEffect> {
        if (!this.config) {
            return {};
        }

        const rarityConfig = this.config.buffEffects[rarity];
        if (!rarityConfig || !rarityConfig.global) {
            return {};
        }

        return rarityConfig.global;
    }

    /**
     * 检查配置是否已加载
     */
    public isConfigLoaded(): boolean {
        return this.isLoaded;
    }
}
