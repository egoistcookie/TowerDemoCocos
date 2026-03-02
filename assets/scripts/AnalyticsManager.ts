import { _decorator, Component, sys } from 'cc';
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
    
    // 服务器配置
    private readonly SERVER_URL = 'https://www.egoistcookie.top/api/analytics/report';
    
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
        if (!this.isRecording && this.operations.length === 0) {
            console.warn('[AnalyticsManager] 没有可上报的数据');
            return false;
        }
        
        this.stopRecording();
        
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
            killCount
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
        return this.sendToServer(jsonData);
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
