import { _decorator, Component, sys } from 'cc';
import { PlayerDataManager } from './PlayerDataManager';
const { ccclass } = _decorator;

/**
 * 玩家操作类型枚举
 */
export enum OperationType {
    BUILD_WATCHTOWER = 'build_watchtower',           // 建造哨塔
    BUILD_WAR_ANCIENT_TREE = 'build_war_ancient_tree', // 建造战争古树
    BUILD_HUNTER_HALL = 'build_hunter_hall',         // 建造猎手大厅
    BUILD_SWORDSMAN_HALL = 'build_swordsman_hall',   // 建造剑士小屋
    BUILD_CHURCH = 'build_church',                   // 建造教堂
    BUILD_MOON_WELL = 'build_moon_well',             // 建造月亮井
    BUILD_STONE_WALL = 'build_stone_wall',           // 建造石墙
    BUILD_TREE = 'build_tree',                       // 建造树木
    BUILD_THUNDER_TOWER = 'build_thunder_tower',     // 建造雷塔
    BUILD_ICE_TOWER = 'build_ice_tower',             // 建造冰塔
    BUILD_MAGE_TOWER = 'build_mage_tower',           // 建造法师塔
    TRAIN_ARROWER = 'train_arrower',                 // 训练弓箭手
    TRAIN_HUNTER = 'train_hunter',                   // 训练女猎手
    TRAIN_SWORDSMAN = 'train_swordsman',             // 训练剑士
    TRAIN_PRIEST = 'train_priest',                   // 训练牧师
    TRAIN_WISP = 'train_wisp',                       // 训练小精灵
    UPGRADE_UNIT = 'upgrade_unit',                   // 升级单位
    RECYCLE_UNIT = 'recycle_unit',                   // 回收单位
    UPGRADE_BUILDING = 'upgrade_building',           // 升级建筑
    RECYCLE_BUILDING = 'recycle_building',           // 回收建筑
    SELECT_BUFF_CARD = 'select_buff_card',           // 选择增益卡片
    USE_TALENT_POINT = 'use_talent_point',           // 使用天赋点
    REVIVE = 'revive',                               // 复活（失败结算页看视频复活）
}

/**
 * 单次操作记录
 */
export interface OperationRecord {
    type: OperationType;           // 操作类型
    timestamp: number;             // 操作时间戳（毫秒）
    gameTime: number;              // 游戏内时间（秒）
    details?: any;                 // 操作详情（可选）
}

/**
 * 游戏埋点数据
 */
export interface AnalyticsData {
    playerId: string;              // 玩家ID
    level: number;                 // 关卡数
    operations: OperationRecord[]; // 操作序列
    result: 'success' | 'fail';    // 游戏结果
    endTime: number;               // 结束时间戳
    defendTime: number;            // 已防御时间（秒）
    currentWave: number;           // 当前波次
    finalGold: number;             // 最终金币数
    finalPopulation: number;       // 最终人口数
    killCount: number;             // 击杀数
    reviveCount?: number;          // 复活次数（成功复活，建议由 operations 里统计）
    unitLevels?: Record<string, number>; // 各单位强化等级（unitId -> level）
    sessionId?: number;            // 选卡实时埋点会话ID（首次选卡创建，结束时回填）
}

// card_selection_events.selection_mode 允许记录更多状态；前端用该类型约束。
export type CardSelectionMode = 'single' | 'get_all' | 'reroll';
export interface CardSelectionItem {
    unitId: string;
    rarity?: string;
    buffType?: string;
    buffValue?: number;
}

/**
 * 游戏埋点管理器
 * 负责记录玩家操作并在游戏结束时上报数据
 */
@ccclass('AnalyticsManager')
export class AnalyticsManager extends Component {
    private static instance: AnalyticsManager | null = null;
    
    private playerId: string = '';                    // 玩家ID
    private currentLevel: number = 1;                 // 当前关卡
    private operations: OperationRecord[] = [];       // 操作记录列表
    private gameStartTime: number = 0;                // 游戏开始时间
    private isRecording: boolean = false;             // 是否正在记录
    private isReportingGameData: boolean = false;     // 是否正在上报本局结算数据（并发保护）
    private hasReportedCurrentGame: boolean = false;  // 本局是否已完成过结算上报（幂等保护）
    private playerDataManager: PlayerDataManager | null = null; // 玩家数据管理器（用于获取单位强化信息）
    private sessionId: number | null = null;          // 选卡实时埋点会话ID（首次选卡创建）
    
    // 服务器配置
    private readonly SERVER_URL = 'https://www.egoistcookie.top/api/analytics/report';
    private readonly SESSION_START_URL = 'https://www.egoistcookie.top/api/analytics/session/start';
    private readonly CARD_SELECT_URL = 'https://www.egoistcookie.top/api/analytics/session/card-select';
    private readonly SESSION_END_URL = 'https://www.egoistcookie.top/api/analytics/session/end';
    
    /**
     * 获取单例实例
     */
    public static getInstance(): AnalyticsManager {
        if (!AnalyticsManager.instance) {
            console.warn('[AnalyticsManager] 实例未初始化');
        }
        return AnalyticsManager.instance!;
    }
    
    onLoad() {
        if (AnalyticsManager.instance) {
            this.destroy();
            return;
        }
        AnalyticsManager.instance = this;
        
        // 初始化玩家ID（从本地存储获取或生成新的）
        this.initPlayerId();
        
        // 初始化玩家数据管理器（用于在埋点中附带单位强化信息）
        this.playerDataManager = PlayerDataManager.getInstance();
        this.playerDataManager.loadData().catch((err) => {
            console.warn('[AnalyticsManager] 加载玩家数据失败，单位强化信息将不会包含在埋点中:', err);
        });
        
        console.log('[AnalyticsManager] 埋点管理器初始化完成');
    }
    
    onDestroy() {
        if (AnalyticsManager.instance === this) {
            AnalyticsManager.instance = null;
        }
    }
    
    /**
     * 初始化玩家ID
     */
    private initPlayerId() {
        const savedId = sys.localStorage.getItem('player_id');
        if (savedId) {
            this.playerId = savedId;
        } else {
            // 生成新的玩家ID（时间戳 + 随机数）
            this.playerId = `player_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
            sys.localStorage.setItem('player_id', this.playerId);
        }
        console.log('[AnalyticsManager] 玩家ID:', this.playerId);
    }
    
    /**
     * 开始记录游戏
     */
    public startRecording(level: number) {
        this.currentLevel = level;
        this.operations = [];
        this.gameStartTime = Date.now();
        this.isRecording = true;
        this.sessionId = null;
        // 开新局时重置结算上报状态
        this.isReportingGameData = false;
        this.hasReportedCurrentGame = false;
        console.log(`[AnalyticsManager] 开始记录关卡 ${level}`);
    }
    
    /**
     * 停止记录
     */
    public stopRecording() {
        this.isRecording = false;
        console.log('[AnalyticsManager] 停止记录');
    }
    
    /**
     * 记录操作
     */
    public recordOperation(type: OperationType, gameTime: number, details?: any) {
        if (!this.isRecording) {
            return;
        }
        
        const record: OperationRecord = {
            type,
            timestamp: Date.now(),
            gameTime,
            details
        };
        
        this.operations.push(record);
        console.log(`[AnalyticsManager] 记录操作: ${type}, 游戏时间: ${gameTime.toFixed(1)}s`);
    }

    /**
     * 恢复记录（用于复活后继续记录游戏操作）
     */
    public resumeRecording() {
        this.isRecording = true;
        console.log('[AnalyticsManager] 恢复记录（复活）');
    }

    /**
     * 强制记录操作（不受 isRecording 状态限制，用于复活等特殊时机）
     */
    public recordOperationForce(type: OperationType, gameTime: number, details?: any) {
        const record: OperationRecord = {
            type,
            timestamp: Date.now(),
            gameTime,
            details
        };
        this.operations.push(record);
        console.log(`[AnalyticsManager] 强制记录操作: ${type}, 游戏时间: ${gameTime.toFixed(1)}s`);
    }

    /**
     * 选卡实时上报：
     * - 首次选卡会创建 game_sessions 记录（sessionId）
     * - 每次选卡写入 card_selection_events，并更新 card_selection_summary 聚合表
     */
    public async reportCardSelection(mode: CardSelectionMode, cards: CardSelectionItem[], gameTimeSeconds?: number): Promise<void> {
        try {
            if (!this.isRecording) return;
            if (!cards || cards.length === 0) return;

            if (!this.sessionId) {
                this.sessionId = await this.startSessionIfNeeded();
            }

            const payload = {
                sessionId: this.sessionId || undefined,
                playerId: this.playerId,
                level: this.currentLevel,
                selectionMode: mode,
                selectedCount: cards.length,
                cards,
                eventTime: Date.now(),
                gameTime: typeof gameTimeSeconds === 'number' && !isNaN(gameTimeSeconds) ? Math.floor(gameTimeSeconds) : undefined
            };

            const resp = await this.sendJson(this.CARD_SELECT_URL, payload);
            // 兜底：若前端本地没有 sessionId，而服务端在 card-select 中自动创建了会话，则回写本地 sessionId
            if (!this.sessionId && resp && typeof resp.sessionId === 'number') {
                this.sessionId = resp.sessionId;
            }
        } catch (e) {
            console.warn('[AnalyticsManager] reportCardSelection 失败（忽略，不影响游戏）:', e);
        }
    }

    private async startSessionIfNeeded(): Promise<number | null> {
        try {
            const payload = {
                playerId: this.playerId,
                level: this.currentLevel,
                startTime: Date.now()
            };
            const resp = await this.sendJson(this.SESSION_START_URL, payload);
            const sid = resp && typeof resp.sessionId === 'number' ? resp.sessionId : null;
            return sid;
        } catch (e) {
            console.warn('[AnalyticsManager] startSessionIfNeeded 失败（忽略）:', e);
            return null;
        }
    }
    
    /**
     * 上报游戏数据
     */
    public async reportGameData(
        result: 'success' | 'fail',
        defendTime: number,
        currentWave: number,
        finalGold: number,
        finalPopulation: number,
        killCount: number
    ): Promise<boolean> {
        // 本局已上报过：直接忽略，避免同一局重复写入 game_records（例如 success/fail 各触发一次）
        if (this.hasReportedCurrentGame) {
            console.warn('[AnalyticsManager] 本局结算已上报，忽略重复上报');
            return true;
        }

        // 正在上报中：忽略并发重复触发
        if (this.isReportingGameData) {
            console.warn('[AnalyticsManager] 结算上报进行中，忽略重复触发');
            return false;
        }

        if (!this.isRecording && this.operations.length === 0) {
            console.warn('[AnalyticsManager] 没有可上报的数据');
            return false;
        }

        this.isReportingGameData = true;
        this.stopRecording();

        try {
        // 从玩家数据中获取所有单位的强化等级（例如 Arrower: 15, StoneWall: 44）
        let unitLevels: Record<string, number> = {};
        if (this.playerDataManager) {
            try {
                unitLevels = this.playerDataManager.getAllUnitLevels();
            } catch (e) {
                console.warn('[AnalyticsManager] 获取单位等级信息失败，将跳过该字段:', e);
            }
        }
        
        const analyticsData: AnalyticsData = {
            playerId: this.playerId,
            level: this.currentLevel,
            operations: this.operations,
            result,
            endTime: Date.now(),
            defendTime,
            currentWave,
            finalGold,
            finalPopulation,
            killCount,
            reviveCount: this.operations.reduce((acc, op) => acc + (op?.type === OperationType.REVIVE ? 1 : 0), 0),
            unitLevels,
            sessionId: this.sessionId || undefined
        };
        
        // 转换为JSON字符串
        const jsonData = JSON.stringify(analyticsData);
        
        console.log('[AnalyticsManager] 准备上报数据:', {
            playerId: this.playerId,
            level: this.currentLevel,
            result,
            operationCount: this.operations.length,
            defendTime,
            currentWave
        });
        
        // 发送到服务器
        const ok = await this.sendToServer(jsonData);

        // 如果存在 sessionId，则在结束时回填会话信息（满足“游戏结束时更新操作记录、防御时间、杀敌数等字段”）
        if (this.sessionId) {
            try {
                const endPayload = {
                    sessionId: this.sessionId,
                    playerId: this.playerId,
                    level: this.currentLevel,
                    endTime: analyticsData.endTime,
                    result: analyticsData.result,
                    defendTime: analyticsData.defendTime,
                    currentWave: analyticsData.currentWave,
                    finalGold: analyticsData.finalGold,
                    finalPopulation: analyticsData.finalPopulation,
                    killCount: analyticsData.killCount,
                    operationCount: this.operations.length,
                    reviveCount: analyticsData.reviveCount || 0,
                    operationsJson: JSON.stringify(this.operations)
                };
                await this.sendJson(this.SESSION_END_URL, endPayload);
            } catch (e) {
                console.warn('[AnalyticsManager] session/end 回填失败（忽略）:', e);
            }
        }

        if (ok) {
            this.hasReportedCurrentGame = true;
        }

        return ok;
        } finally {
            this.isReportingGameData = false;
        }
    }
    
    /**
     * 发送数据到服务器
     */
    private async sendToServer(jsonData: string): Promise<boolean> {
        try {
            // 使用XMLHttpRequest发送POST请求
            return new Promise<boolean>((resolve) => {
                const xhr = new XMLHttpRequest();
                xhr.timeout = 5000; // 5秒超时
                
                xhr.onreadystatechange = () => {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            console.log('[AnalyticsManager] 数据上报成功:', xhr.responseText);
                            resolve(true);
                        } else {
                            console.error('[AnalyticsManager] 数据上报失败:', xhr.status, xhr.statusText);
                            resolve(false);
                        }
                    }
                };
                
                xhr.onerror = () => {
                    console.error('[AnalyticsManager] 网络请求失败');
                    resolve(false);
                };
                
                xhr.ontimeout = () => {
                    console.error('[AnalyticsManager] 请求超时');
                    resolve(false);
                };
                
                xhr.open('POST', this.SERVER_URL, true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.send(jsonData);
            });
        } catch (error) {
            console.error('[AnalyticsManager] 发送数据异常:', error);
            return false;
        }
    }

    /**
     * 发送JSON并解析返回（用于 session / card-select）
     */
    private async sendJson(url: string, data: any): Promise<any> {
        const jsonData = JSON.stringify(data);
        return new Promise<any>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.timeout = 5000; // 5秒超时

            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        try {
                            resolve(xhr.responseText ? JSON.parse(xhr.responseText) : {});
                        } catch (e) {
                            resolve({});
                        }
                    } else {
                        reject(new Error(`HTTP ${xhr.status} ${xhr.statusText}`));
                    }
                }
            };

            xhr.onerror = () => reject(new Error('network error'));
            xhr.ontimeout = () => reject(new Error('timeout'));

            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(jsonData);
        });
    }
    
    /**
     * 获取当前操作数量
     */
    public getOperationCount(): number {
        return this.operations.length;
    }
    
    /**
     * 清空操作记录
     */
    public clearOperations() {
        this.operations = [];
        console.log('[AnalyticsManager] 操作记录已清空');
    }
}
