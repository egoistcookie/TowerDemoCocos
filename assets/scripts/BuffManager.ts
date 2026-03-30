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
    
    private static readonly SP_BUFF_TYPES = new Set<string>([
        'multiArrow',
        'bouncyBoomerang',
        'heavyArmor',
        'widePrayer',
        'bangBangBang'
    ]);

    private isSpBuffType(buffType: string): boolean {
        return BuffManager.SP_BUFF_TYPES.has(buffType);
    }

    /**
     * 获取 SP 等级（同单位同 buffType 的次数，最多 3）
     */
    public getSpLevel(unitId: string, buffType: string): number {
        if (!this.isSpBuffType(buffType)) return 0;
        const buffs = this.getBuffsForUnit(unitId);
        let cnt = 0;
        for (const b of buffs) {
            if (b && b.buffType === buffType) cnt++;
        }
        return Math.min(3, cnt);
    }

    private static tri(level: number): number {
        const l = Math.max(0, Math.min(3, Math.floor(level)));
        return (l * (l + 1)) / 2; // 1->1, 2->3, 3->6
    }

    /**
     * 添加增益
     */
    public addBuff(unitId: string, buffType: string, buffValue: number) {
        // SP：同卡最多三级（抽到则等级+1）
        if (this.isSpBuffType(buffType)) {
            const lv = this.getSpLevel(unitId, buffType);
            if (lv >= 3) {
                // 达到三级后不再叠加
                return;
            }
        }

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
        } else {
           //console.info(`[BuffManager] 已有基准攻击力缓存: ${unitScript._originalAttackDamage}，当前攻击力: ${unitScript.attackDamage}`);
        }
        if (!unitScript._originalAttackInterval) {
            unitScript._originalAttackInterval = unitScript.attackInterval || 1;
           //console.info(`[BuffManager] 保存基准攻击间隔（已含天赋增幅）: ${unitScript._originalAttackInterval}`);
        }
        if (!unitScript._originalMaxHealth) {
            unitScript._originalMaxHealth = unitScript.maxHealth || 0;
           //console.info(`[BuffManager] 保存基准生命值（已含天赋增幅）: ${unitScript._originalMaxHealth}`);
        } else {
           //console.info(`[BuffManager] 已有基准生命值缓存: ${unitScript._originalMaxHealth}，当前生命值: ${unitScript.maxHealth}`);
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
        
        // 应用所有“非SP”增益（SP 单独按等级计算，避免简单叠加导致数值失控）
        const spBuffs: BuffData[] = [];
        for (const buff of buffs) {
            if (buff && this.isSpBuffType(buff.buffType)) {
                spBuffs.push(buff);
            } else {
                this.applySingleBuff(unitScript, buff);
            }
        }

        // 统一按等级应用 SP
        this.applySpBuffsByLevel(unitScript, spBuffs);
    }

    private applySpBuffsByLevel(unitScript: any, spBuffs: BuffData[]) {
        if (!spBuffs || spBuffs.length === 0) return;

        // 先重置 SP 字段（保证覆盖式应用）
        unitScript._spMultiArrowExtraTargets = 0;
        unitScript._spBoomerangExtraBounces = 0;
        unitScript._spDamageReductionPercent = 0;
        unitScript._spHeavyArmorPenaltyPercent = 0;
        unitScript._spHolyPrayerRadiusFlat = 0;
        unitScript._spMissilesPerAttackFlat = 0;

        // 分组：buffType -> { level, baseValue }
        const map = new Map<string, { level: number; base: number }>();
        for (const b of spBuffs) {
            if (!b) continue;
            const cur = map.get(b.buffType) || { level: 0, base: Number(b.buffValue) || 0 };
            cur.level = Math.min(3, cur.level + 1);
            // base 取第一次的 value（同一SP默认一致）
            if (!Number.isFinite(cur.base) || cur.base === 0) cur.base = Number(b.buffValue) || 0;
            map.set(b.buffType, cur);
        }

        // 应用：总效果 = base * tri(level)，符合“级级累加”
        for (const [buffType, info] of map.entries()) {
            const level = Math.max(0, Math.min(3, info.level));
            const base = Number(info.base) || 0;
            const total = base * BuffManager.tri(level);

            switch (buffType) {
                case 'multiArrow':
                    unitScript._spMultiArrowExtraTargets = Math.max(0, Math.floor(total));
                    break;
                case 'bouncyBoomerang':
                    unitScript._spBoomerangExtraBounces = Math.max(0, Math.floor(total));
                    break;
                case 'widePrayer': {
                    if (unitScript._originalHolyPrayerRadius === undefined) {
                        unitScript._originalHolyPrayerRadius = unitScript.holyPrayerRadius || 0;
                    }
                    unitScript._spHolyPrayerRadiusFlat = total;
                    unitScript.holyPrayerRadius = (unitScript._originalHolyPrayerRadius || 0) + unitScript._spHolyPrayerRadiusFlat;
                    break;
                }
                case 'bangBangBang': {
                    if (unitScript._originalMissilesPerAttack === undefined) {
                        unitScript._originalMissilesPerAttack = unitScript.missilesPerAttack || 0;
                    }
                    unitScript._spMissilesPerAttackFlat = Math.max(0, Math.floor(total));
                    unitScript.missilesPerAttack = Math.max(1, (unitScript._originalMissilesPerAttack || 0) + unitScript._spMissilesPerAttackFlat);
                    break;
                }
                case 'heavyArmor': {
                    unitScript._spDamageReductionPercent = total;

                    // 副作用：攻速/攻击/移速降低（同样按“级级累加”，每级基准惩罚 5%）
                    const penalty = 5 * BuffManager.tri(level); // 1->5,2->15,3->30
                    unitScript._spHeavyArmorPenaltyPercent = penalty;

                    // 在“通用卡片百分比计算”之后，再额外施加惩罚（不污染 _buffXXXPercent，避免与普通卡片混算）
                    const p = Math.max(0, Math.min(80, penalty));
                    const downMul = 1 - p / 100;
                    unitScript.attackDamage = Math.max(0, Math.floor((unitScript.attackDamage || 0) * downMul));
                    unitScript.moveSpeed = Math.round((unitScript.moveSpeed || 0) * downMul * 100) / 100;
                    unitScript.attackInterval = Math.max(0.05, (unitScript.attackInterval || 1) * (1 + p / 100));
                    break;
                }
            }
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
            
            // SP 彩色卡在 applyBuffsToUnit() 中按“等级”统一处理，这里不逐条叠加
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
