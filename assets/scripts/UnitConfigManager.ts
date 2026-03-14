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
    /**
     * 出场台词配置：键为关卡号（字符串形式，如 "1"、"2"...），值为对应关卡的出场台词
     */
    spawnDialogs?: Record<string, string>;
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
                    reject(err);
                    return;
                }

                this.config = jsonAsset.json as Record<string, UnitConfig>;
                this.isLoaded = true;
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
     * 获取单位在指定关卡的出场台词
     * - 优先使用当前关卡号对应的配置
     * - 如果未配置当前关卡，则回退使用第1关的出场台词
     * - 如果连第1关也没有配置，则使用 spawnDialogs 中任意一个（通常是第一个）
     */
    public getUnitSpawnDialog(unitId: string, level: number): string | null {
        const config = this.getUnitConfig(unitId);
        if (!config || !config.spawnDialogs) {
            return null;
        }

        const levelKey = String(level);
        const dialogs = config.spawnDialogs;

        // 1. 当前关卡有专门配置
        if (dialogs[levelKey]) {
            return dialogs[levelKey];
        }

        // 2. 没有当前关卡，则优先回退到第1关
        if (dialogs['1']) {
            return dialogs['1'];
        }

        // 3. 仍然没有，就返回配置中的第一个台词
        const keys = Object.keys(dialogs);
        if (keys.length > 0) {
            const firstKey = keys.sort((a, b) => {
                const na = parseInt(a, 10);
                const nb = parseInt(b, 10);
                if (isNaN(na) || isNaN(nb)) {
                    return a.localeCompare(b);
                }
                return na - nb;
            })[0];
            return dialogs[firstKey] || null;
        }

        return null;
    }

    /**
     * 检查配置是否已加载
     */
    public isConfigLoaded(): boolean {
        return this.isLoaded;
    }
}

