import { _decorator, Component, sys } from 'cc';
import { PlayerDataManager } from './PlayerDataManager';

const { ccclass, property } = _decorator;

/**
 * 签到管理器
 * 负责处理每日签到逻辑
 */
@ccclass('CheckInManager')
export class CheckInManager extends Component {
    private static instance: CheckInManager | null = null;
    
    // 签到奖励经验值
    private readonly CHECK_IN_REWARD_EXP: number = 500;
    
    // 本地存储键名
    private readonly LAST_CHECK_IN_DATE_KEY: string = 'TowerDemo_LastCheckInDate';
    
    /**
     * 获取单例实例
     */
    public static getInstance(): CheckInManager | null {
        return CheckInManager.instance;
    }
    
    onLoad() {
        if (CheckInManager.instance) {
            console.warn('[CheckInManager] 实例已存在，销毁当前节点');
            this.node.destroy();
            return;
        }
        CheckInManager.instance = this;
    }
    
    onDestroy() {
        if (CheckInManager.instance === this) {
            CheckInManager.instance = null;
        }
    }
    
    /**
     * 检查今天是否已经签到
     * @returns true表示今天已签到，false表示今天未签到
     */
    public hasCheckedInToday(): boolean {
        try {
            const lastCheckInDate = sys.localStorage.getItem(this.LAST_CHECK_IN_DATE_KEY);
            const today = this.getTodayDateString();
            
            console.log('[CheckInManager] hasCheckedInToday() 上次签到日期:', lastCheckInDate);
            console.log('[CheckInManager] hasCheckedInToday() 今天日期:', today);
            
            if (!lastCheckInDate) {
                console.log('[CheckInManager] hasCheckedInToday() 从未签到过，返回 false');
                return false;
            }
            
            const result = lastCheckInDate === today;
            console.log('[CheckInManager] hasCheckedInToday() 比较结果:', result);
            return result;
        } catch (e) {
            console.error('[CheckInManager] 检查签到状态失败:', e);
            return false;
        }
    }
    
    /**
     * 执行签到
     * @returns 签到结果 { success: boolean, message: string, expGained: number }
     */
    public checkIn(): { success: boolean; message: string; expGained: number } {
        console.log('[CheckInManager] checkIn() 开始执行签到');
        
        // 检查今天是否已经签到
        const hasCheckedIn = this.hasCheckedInToday();
        console.log('[CheckInManager] checkIn() 今天是否已签到:', hasCheckedIn);
        
        if (hasCheckedIn) {
            console.log('[CheckInManager] checkIn() 今天已经签到过了');
            return {
                success: false,
                message: '今天已经签到过了，明天再来吧！',
                expGained: 0
            };
        }
        
        // 获取玩家数据管理器
        const playerDataManager = PlayerDataManager.getInstance();
        console.log('[CheckInManager] checkIn() PlayerDataManager 实例:', playerDataManager);
        
        if (!playerDataManager) {
            console.error('[CheckInManager] 无法获取PlayerDataManager实例');
            return {
                success: false,
                message: '签到失败，请稍后重试',
                expGained: 0
            };
        }
        
        // 添加经验值
        console.log('[CheckInManager] checkIn() 添加经验值:', this.CHECK_IN_REWARD_EXP);
        playerDataManager.addExperience(this.CHECK_IN_REWARD_EXP);
        
        // 保存签到日期
        try {
            const today = this.getTodayDateString();
            console.log('[CheckInManager] checkIn() 保存签到日期:', today);
            sys.localStorage.setItem(this.LAST_CHECK_IN_DATE_KEY, today);
        } catch (e) {
            console.error('[CheckInManager] 保存签到日期失败:', e);
        }
        
        // 保存玩家数据
        playerDataManager.saveData();
        console.log('[CheckInManager] checkIn() 玩家数据已保存');
        
        console.log(`[CheckInManager] 签到成功，获得 ${this.CHECK_IN_REWARD_EXP} 点经验值`);
        
        return {
            success: true,
            message: `签到成功！获得 ${this.CHECK_IN_REWARD_EXP} 点经验值`,
            expGained: this.CHECK_IN_REWARD_EXP
        };
    }
    
    /**
     * 获取今天的日期字符串（格式：YYYY-MM-DD）
     */
    private getTodayDateString(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        const monthStr = month < 10 ? '0' + month : '' + month;
        const dayStr = day < 10 ? '0' + day : '' + day;
        return `${year}-${monthStr}-${dayStr}`;
    }
    
    /**
     * 获取签到奖励经验值
     */
    public getCheckInRewardExp(): number {
        return this.CHECK_IN_REWARD_EXP;
    }
}
