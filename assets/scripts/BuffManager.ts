import { _decorator } from 'cc';
const { ccclass } = _decorator;

/**
 * 增益数据接口
 */
export interface BuffData {
    unitId: string;           // 单位ID
    buffType: string;         // 增益类型
    buffValue: number;        // 增益数值
    timestamp: number;        // 应用时间戳
}

/**
 * 增益管理器（单例）
 * 负责保存和管理所有已应用的增益效果
 */
@ccclass('BuffManager')
export class BuffManager {
    private static instance: BuffManager | null = null;
    
    // 保存所有已应用的增益（按单位ID分组）
    private appliedBuffs: Map<string, BuffData[]> = new Map();
    
    // 全局增益（人口、金币等）
    private globalBuffs: BuffData[] = [];
    
    private constructor() {}
    
    /**
     * 获取单例实例
     */
    public static getInstance(): BuffManager {
        if (!BuffManager.instance) {
            BuffManager.instance = new BuffManager();
        }
        return BuffManager.instance;
    }
    
    /**
     * 添加增益
     */
    public addBuff(unitId: string, buffType: string, buffValue: number) {
        const buffData: BuffData = {
            unitId,
            buffType,
            buffValue,
            timestamp: Date.now()
        };
        
        // 全局增益
        if (buffType === 'populationIncrease' || buffType === 'goldReward' || buffType === 'goldIncrease') {
            this.globalBuffs.push(buffData);
           //console.info(`[BuffManager] 添加全局增益: ${buffType} +${buffValue}`);
            return;
        }
        
        // 单位增益
        if (!this.appliedBuffs.has(unitId)) {
            this.appliedBuffs.set(unitId, []);
        }
        
        const buffs = this.appliedBuffs.get(unitId)!;
        buffs.push(buffData);
        
       //console.info(`[BuffManager] 添加单位增益: ${unitId} ${buffType} +${buffValue}%`);
    }
    
    /**
     * 获取指定单位的所有增益
     */
    public getBuffsForUnit(unitId: string): BuffData[] {
        return this.appliedBuffs.get(unitId) || [];
    }
    
    /**
     * 获取所有全局增益
     */
    public getGlobalBuffs(): BuffData[] {
        return this.globalBuffs;
    }
    
    /**
     * 应用增益到单位
     */
    public applyBuffsToUnit(unitScript: any, unitId: string) {
        const buffs = this.getBuffsForUnit(unitId);
        
        if (buffs.length === 0) {
           //console.info(`[BuffManager] 单位 ${unitId} 没有已保存的增益`);
            return;
        }
        
       //console.info(`[BuffManager] 应用 ${buffs.length} 个增益到新单位: ${unitId}`);
        
        // 保存当前属性作为基准（此时已经应用了天赋增幅）
        // 注意：这里保存的是天赋增幅后的属性值，卡片增幅将基于这个值计算
        if (!unitScript._originalAttackDamage) {
            unitScript._originalAttackDamage = unitScript.attackDamage || 0;
           //console.info(`[BuffManager] 保存基准攻击力（已含天赋增幅）: ${unitScript._originalAttackDamage}`);
        }
        if (!unitScript._originalAttackInterval) {
            unitScript._originalAttackInterval = unitScript.attackInterval || 1;
           //console.info(`[BuffManager] 保存基准攻击间隔（已含天赋增幅）: ${unitScript._originalAttackInterval}`);
        }
        if (!unitScript._originalMaxHealth) {
            unitScript._originalMaxHealth = unitScript.maxHealth || 0;
           //console.info(`[BuffManager] 保存基准生命值（已含天赋增幅）: ${unitScript._originalMaxHealth}`);
        }
        if (!unitScript._originalMoveSpeed) {
            unitScript._originalMoveSpeed = unitScript.moveSpeed || 0;
           //console.info(`[BuffManager] 保存基准移动速度（已含天赋增幅）: ${unitScript._originalMoveSpeed}`);
        }
        
        // 初始化累积增幅百分比为0（新单位）
        unitScript._buffAttackDamagePercent = 0;
        unitScript._buffAttackSpeedPercent = 0;
        unitScript._buffMaxHealthPercent = 0;
        unitScript._buffMoveSpeedPercent = 0;
        
        // 应用所有增益
        for (const buff of buffs) {
            this.applySingleBuff(unitScript, buff);
        }
    }
    
    /**
     * 应用单个增益到单位
     */
    private applySingleBuff(unitScript: any, buff: BuffData) {
        switch (buff.buffType) {
            case 'attackDamage':
                // 攻击力提升（百分比叠加）
                unitScript._buffAttackDamagePercent += buff.buffValue;
                const damageMultiplier = 1 + unitScript._buffAttackDamagePercent / 100;
                unitScript.attackDamage = Math.floor(unitScript._originalAttackDamage * damageMultiplier);
               //console.info(`[BuffManager] 应用攻击力增幅 ${buff.buffValue}%，累积增幅 ${unitScript._buffAttackDamagePercent}%，最终攻击力: ${unitScript.attackDamage}`);
                break;
                
            case 'attackSpeed':
                // 攻击速度提升（减少攻击间隔，百分比叠加）
                unitScript._buffAttackSpeedPercent += buff.buffValue;
                const speedMultiplier = 1 + unitScript._buffAttackSpeedPercent / 100;
                unitScript.attackInterval = unitScript._originalAttackInterval / speedMultiplier;
               //console.info(`[BuffManager] 应用攻击速度增幅 ${buff.buffValue}%，累积增幅 ${unitScript._buffAttackSpeedPercent}%，最终攻击间隔: ${unitScript.attackInterval}`);
                break;
                
            case 'maxHealth':
                // 生命值提升（百分比叠加）
                unitScript._buffMaxHealthPercent += buff.buffValue;
                const healthMultiplier = 1 + unitScript._buffMaxHealthPercent / 100;
                const oldMaxHealth = unitScript.maxHealth || unitScript._originalMaxHealth || 1;
                const newMaxHealth = Math.floor(unitScript._originalMaxHealth * healthMultiplier);
                unitScript.maxHealth = newMaxHealth;
                
                // 按比例调整当前生命值（保持血量百分比）
                // 如果当前血量等于旧的最大血量，说明是满血，直接设置为新的最大血量
                if (unitScript.currentHealth === oldMaxHealth || unitScript.currentHealth === undefined) {
                    unitScript.currentHealth = newMaxHealth;
                } else {
                    // 否则按比例调整
                    const currentHealthRatio = (unitScript.currentHealth || oldMaxHealth) / oldMaxHealth;
                    unitScript.currentHealth = Math.floor(newMaxHealth * currentHealthRatio);
                }
                
                // 同步刷新血条组件
                if (unitScript.healthBar && typeof unitScript.healthBar.setMaxHealth === 'function') {
                    unitScript.healthBar.setMaxHealth(unitScript.maxHealth);
                    unitScript.healthBar.setHealth(unitScript.currentHealth);
                }
                
               //console.info(`[BuffManager] 应用生命值增幅 ${buff.buffValue}%，累积增幅 ${unitScript._buffMaxHealthPercent}%，最终生命上限: ${unitScript.maxHealth}，当前生命: ${unitScript.currentHealth}`);
                break;
                
            case 'moveSpeed':
                // 移动速度提升（百分比叠加），保留2位小数
                unitScript._buffMoveSpeedPercent += buff.buffValue;
                const moveMultiplier = 1 + unitScript._buffMoveSpeedPercent / 100;
                unitScript.moveSpeed = Math.round(unitScript._originalMoveSpeed * moveMultiplier * 100) / 100;
               //console.info(`[BuffManager] 应用移动速度增幅 ${buff.buffValue}%，累积增幅 ${unitScript._buffMoveSpeedPercent}%，最终移动速度: ${unitScript.moveSpeed}`);
                break;
        }
    }
    
    /**
     * 清除所有增益（用于重新开始游戏）
     */
    public clearAllBuffs() {
        this.appliedBuffs.clear();
        this.globalBuffs = [];
       //console.info('[BuffManager] 清除所有增益');
    }
    
    /**
     * 获取所有已应用的增益（用于调试）
     */
    public getAllBuffs(): Map<string, BuffData[]> {
        return this.appliedBuffs;
    }
}
