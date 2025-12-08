import { resources, JsonAsset } from 'cc';

/**
 * 单位配置接口
 */
export interface UnitConfig {
    baseStats: Record<string, any>;
    displayInfo: {
        name: string;
        description: string;
    };
    displayStats: Record<string, any>;
}

/**
 * 单位配置管理器
 * 单例模式，负责加载和管理单位配置
 */
export class UnitConfigManager {
    private static instance: UnitConfigManager;
    private config: Record<string, UnitConfig> = {};
    private isLoaded: boolean = false;
    private loadPromise: Promise<void> | null = null;

    private constructor() {}

    /**
     * 获取单例实例
     */
    public static getInstance(): UnitConfigManager {
        if (!UnitConfigManager.instance) {
            UnitConfigManager.instance = new UnitConfigManager();
        }
        return UnitConfigManager.instance;
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
            resources.load('config/unitConfig', JsonAsset, (err, jsonAsset) => {
                if (err) {
                    console.error('UnitConfigManager: Failed to load unitConfig.json', err);
                    console.error('UnitConfigManager: Please ensure unitConfig.json is located in assets/resources/config/ folder');
                    reject(err);
                    return;
                }

                this.config = jsonAsset.json as Record<string, UnitConfig>;
                this.isLoaded = true;
                console.log('UnitConfigManager: Unit config loaded successfully');
                resolve();
            });
        });

        return this.loadPromise;
    }

    /**
     * 获取指定单位的配置
     * @param unitId 单位ID（如 'Arrower', 'Hunter' 等）
     * @returns 单位配置，如果不存在则返回 null
     */
    public getUnitConfig(unitId: string): UnitConfig | null {
        if (!this.isLoaded) {
            console.warn(`UnitConfigManager: Config not loaded yet, cannot get config for ${unitId}`);
            return null;
        }

        return this.config[unitId] || null;
    }

    /**
     * 将配置应用到单位组件
     * @param unitId 单位ID
     * @param unitScript 单位脚本组件实例
     * @param excludeProperties 要排除的属性列表（这些属性不会被配置覆盖）
     */
    public applyConfigToUnit(unitId: string, unitScript: any, excludeProperties: string[] = []): boolean {
        const config = this.getUnitConfig(unitId);
        if (!config) {
            console.warn(`UnitConfigManager: No config found for unit ${unitId}`);
            return false;
        }

        // 默认排除的属性：buildCost 应该在实例化时动态设置，不应该被配置覆盖
        const defaultExclude = ['buildCost', ...excludeProperties];
        
        // 应用基础属性
        const baseStats = config.baseStats;
        for (const key in baseStats) {
            if (baseStats.hasOwnProperty(key) && unitScript.hasOwnProperty(key)) {
                // 跳过排除的属性
                if (defaultExclude.indexOf(key) !== -1) {
                    continue;
                }
                unitScript[key] = baseStats[key];
            }
        }

        // 应用显示信息
        if (config.displayInfo) {
            if (unitScript.hasOwnProperty('unitName')) {
                unitScript.unitName = config.displayInfo.name;
            }
            if (unitScript.hasOwnProperty('unitDescription')) {
                unitScript.unitDescription = config.displayInfo.description;
            }
        }

        console.log(`UnitConfigManager: Applied config to unit ${unitId}`);
        return true;
    }

    /**
     * 获取单位的显示属性（用于详情面板）
     * @param unitId 单位ID
     * @returns 显示属性对象，如果不存在则返回空对象
     */
    public getUnitDisplayStats(unitId: string): Record<string, any> {
        const config = this.getUnitConfig(unitId);
        if (!config) {
            return {};
        }

        return config.displayStats || {};
    }

    /**
     * 获取单位的显示信息
     * @param unitId 单位ID
     * @returns 显示信息对象，如果不存在则返回 null
     */
    public getUnitDisplayInfo(unitId: string): { name: string; description: string } | null {
        const config = this.getUnitConfig(unitId);
        if (!config) {
            return null;
        }

        return config.displayInfo || null;
    }

    /**
     * 检查配置是否已加载
     */
    public isConfigLoaded(): boolean {
        return this.isLoaded;
    }
}

