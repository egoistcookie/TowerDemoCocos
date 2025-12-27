import { PlayerDataManager, UnitEnhancement } from './PlayerDataManager';
import { TalentType } from './TalentSystem';

/**
 * 天赋效果管理器
 * 负责应用公共天赋增幅和单位卡片强化到单位
 */
export class TalentEffectManager {
    private static instance: TalentEffectManager | null = null;
    private playerDataManager: PlayerDataManager;

    private constructor() {
        this.playerDataManager = PlayerDataManager.getInstance();
    }

    public static getInstance(): TalentEffectManager {
        if (!TalentEffectManager.instance) {
            TalentEffectManager.instance = new TalentEffectManager();
        }
        return TalentEffectManager.instance;
    }

    /**
     * 应用单位卡片强化到单位
     * 注意：应该在应用配置文件基础属性之后，应用公共天赋增幅之前调用
     * @param unitId 单位ID
     * @param unitScript 单位脚本组件实例
     */
    public applyUnitEnhancements(unitId: string, unitScript: any): void {
        const enhancement = this.playerDataManager.getUnitEnhancement(unitId);
        if (!enhancement || !enhancement.enhancements) {
            return;
        }

        const enhancements = enhancement.enhancements;

        // 应用攻击力增幅
        if (enhancements.attackDamage !== undefined && unitScript.hasOwnProperty('attackDamage')) {
            unitScript.attackDamage = (unitScript.attackDamage || 0) + enhancements.attackDamage;
        }

        // 应用攻击速度增幅（减少攻击间隔）
        if (enhancements.attackSpeed !== undefined && unitScript.hasOwnProperty('attackInterval')) {
            // attackSpeed 是增加的攻击速度百分比，需要转换为减少攻击间隔
            // 例如：攻击速度+10% 意味着攻击间隔减少到原来的 1/(1+0.1) = 0.909
            const speedMultiplier = 1 / (1 + enhancements.attackSpeed / 100);
            unitScript.attackInterval = (unitScript.attackInterval || 1) * speedMultiplier;
        }

        // 应用生命值增幅
        if (enhancements.maxHealth !== undefined && unitScript.hasOwnProperty('maxHealth')) {
            unitScript.maxHealth = (unitScript.maxHealth || 0) + enhancements.maxHealth;
            // 如果当前生命值存在，也需要相应增加
            if (unitScript.hasOwnProperty('currentHealth')) {
                unitScript.currentHealth = (unitScript.currentHealth || 0) + enhancements.maxHealth;
            }
        }

        // 应用移动速度增幅
        if (enhancements.moveSpeed !== undefined && unitScript.hasOwnProperty('moveSpeed')) {
            unitScript.moveSpeed = (unitScript.moveSpeed || 0) + enhancements.moveSpeed;
        }

        // 应用护甲增幅
        if (enhancements.armor !== undefined && unitScript.hasOwnProperty('armor')) {
            unitScript.armor = (unitScript.armor || 0) + enhancements.armor;
        }
    }

    /**
     * 应用公共天赋增幅到单位
     * 注意：应该在应用单位卡片强化之后调用
     * @param unitScript 单位脚本组件实例
     */
    public applyTalentEffects(unitScript: any): void {
        // 获取所有天赋的等级并计算增幅值
        const talentLevels = this.getTalentLevels();

        // 应用攻击力增幅（百分比）
        if (talentLevels.attackDamage > 0 && unitScript.hasOwnProperty('attackDamage')) {
            const bonusPercent = 1 * talentLevels.attackDamage; // 每级+1%攻击力
            const currentDamage = unitScript.attackDamage || 0;
            unitScript.attackDamage = currentDamage * (1 + bonusPercent / 100);
        }

        // 应用攻击速度增幅（减少攻击间隔）
        if (talentLevels.attackSpeed > 0 && unitScript.hasOwnProperty('attackInterval')) {
            const speedBonus = 5 * talentLevels.attackSpeed; // 每级+5%攻击速度
            const speedMultiplier = 1 / (1 + speedBonus / 100);
            unitScript.attackInterval = (unitScript.attackInterval || 1) * speedMultiplier;
        }

        // 应用生命值增幅（百分比）
        if (talentLevels.health > 0 && unitScript.hasOwnProperty('maxHealth')) {
            const bonusPercent = 2 * talentLevels.health; // 每级+2%生命值
            const currentMaxHealth = unitScript.maxHealth || 0;
            const healthIncrease = currentMaxHealth * (bonusPercent / 100);
            unitScript.maxHealth = currentMaxHealth + healthIncrease;
            // 如果当前生命值存在，也需要相应增加
            if (unitScript.hasOwnProperty('currentHealth')) {
                unitScript.currentHealth = (unitScript.currentHealth || 0) + healthIncrease;
            }
        }

        // 应用移动速度增幅
        if (talentLevels.moveSpeed > 0 && unitScript.hasOwnProperty('moveSpeed')) {
            const bonus = 5 * talentLevels.moveSpeed; // 每级+5移动速度
            unitScript.moveSpeed = (unitScript.moveSpeed || 0) + bonus;
        }
    }

    /**
     * 获取所有天赋的等级
     * @returns 天赋等级映射
     */
    private getTalentLevels(): Record<string, number> {
        return {
            attackDamage: this.playerDataManager.getTalentLevel('attack_damage'),
            attackSpeed: this.playerDataManager.getTalentLevel('attack_speed'),
            health: this.playerDataManager.getTalentLevel('health'),
            moveSpeed: this.playerDataManager.getTalentLevel('move_speed')
        };
    }

    /**
     * 获取指定天赋类型的增幅值
     * @param talentType 天赋类型
     * @returns 增幅值
     */
    public getTalentEffectValue(talentType: TalentType): number {
        let talentId = '';
        let valuePerLevel = 0;

        switch (talentType) {
            case TalentType.ATTACK_DAMAGE:
                talentId = 'attack_damage';
                valuePerLevel = 1; // 每级+1%
                break;
            case TalentType.ATTACK_SPEED:
                talentId = 'attack_speed';
                valuePerLevel = 5;
                break;
            case TalentType.HEALTH:
                talentId = 'health';
                valuePerLevel = 2; // 每级+2%
                break;
            case TalentType.MOVE_SPEED:
                talentId = 'move_speed';
                valuePerLevel = 5;
                break;
        }

        const level = this.playerDataManager.getTalentLevel(talentId);
        return valuePerLevel * level;
    }
}

