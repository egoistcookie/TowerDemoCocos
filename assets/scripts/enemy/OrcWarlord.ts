import { _decorator, AudioClip, SpriteFrame } from 'cc';
import { Boss } from './Boss';

const { ccclass, property } = _decorator;

@ccclass('OrcWarlord')
export class OrcWarlord extends Boss {
    // ====== OrcWarlord 专属数值与资源配置（通过 override 覆盖 Boss 默认值）======

    @property({ override: true })
    maxHealth: number = 300;

    @property({ override: true })
    moveSpeed: number = 35;

    @property({ override: true })
    attackDamage: number = 30;

    @property({ override: true })
    attackInterval: number = 1.8;

    @property({ override: true })
    attackRange: number = 70;

    @property({ override: true })
    collisionRadius: number = 18;

    @property({ override: true, tooltip: "韧性（0-1）：1秒内遭受此百分比血量损失才会触发僵直。" })
    tenacity: number = 0.3;

    // 单位信息
    @property({ override: true })
    unitName: string = "兽人督军";

    @property({ override: true })
    unitDescription: string = "拥有战争咆哮的强力Boss单位，能强化周围的敌人。";

    @property({ override: true })
    unitIcon: SpriteFrame = null!;

    // 动画帧
    @property({ override: true, type: [SpriteFrame] })
    idleAnimationFrames: SpriteFrame[] = [];

    @property({ override: true, type: [SpriteFrame] })
    walkAnimationFrames: SpriteFrame[] = [];

    @property({ override: true, type: [SpriteFrame] })
    attackAnimationFrames: SpriteFrame[] = [];

    @property({ override: true, type: [SpriteFrame] })
    hitAnimationFrames: SpriteFrame[] = [];

    @property({ override: true, type: [SpriteFrame] })
    deathAnimationFrames: SpriteFrame[] = [];

    // 动画时长
    @property({ override: true })
    idleAnimationDuration: number = 1.0;

    @property({ override: true })
    walkAnimationDuration: number = 0.8;

    @property({ override: true })
    attackAnimationDuration: number = 0.8;

    @property({ override: true })
    hitAnimationDuration: number = 0.3;

    @property({ override: true })
    deathAnimationDuration: number = 1.0;

    // 奖励
    @property({ override: true })
    goldReward: number = 20;

    @property({ override: true })
    expReward: number = 40;

    // 音效
    @property({ override: true, type: AudioClip })
    deathSound: AudioClip = null!;

    @property({ override: true, type: AudioClip })
    attackSound: AudioClip = null!;

    // ====== 战争咆哮配置（覆盖 Boss 默认数值）======

    @property({ override: true })
    warcryCooldown: number = 25; // 咆哮冷却

    @property({ override: true })
    warcryDuration: number = 10; // Buff 持续

    @property({ override: true })
    warcryEffect: number = 0.4;  // 属性提升 40%

    @property({ override: true })
    warcryRange: number = 220;   // 咆哮范围

    @property({ override: true, type: AudioClip })
    warcrySound: AudioClip = null!;

    @property({ override: true, type: [SpriteFrame] })
    warcryAnimationFrames: SpriteFrame[] = [];

    @property({ override: true })
    warcryAnimationDuration: number = 1.0;

    // 对象池中使用的预制体名称
    public prefabName: string = "OrcWarlord";

    // 低血量战争咆哮相关
    private hasCastLowHealthWarcry: boolean = false; // 是否已经释放过低血量咆哮
    private readonly LOW_HEALTH_THRESHOLD: number = 0.5; // 50%血量阈值

    onEnable() {
        super.onEnable();
        // 重置低血量咆哮标志（从对象池复用对象时）
        this.hasCastLowHealthWarcry = false;
    }

    start() {
        super.start();
        // 重置低血量咆哮标志
        this.hasCastLowHealthWarcry = false;
    }

    /**
     * 重写受击方法，检查生命值是否降到50%以下，如果是则立即释放一次额外的战争咆哮
     */
    takeDamage(damage: number) {
        // 获取当前生命值（使用类型断言访问父类的 private 属性）
        const bossThis = this as any;
        
        // 检查是否已销毁（使用类型断言访问父类的 private 属性）
        if (bossThis.isDestroyed) {
            return;
        }
        
        const currentHealthBefore = bossThis.currentHealth || this.maxHealth;
        
        // 计算扣除伤害后的生命值
        const healthAfterDamage = currentHealthBefore - damage;
        const healthPercentageAfter = healthAfterDamage / this.maxHealth;

        // 检查是否需要在扣血后释放低血量咆哮（在调用父类方法之前检查）
        const shouldCastLowHealthWarcry = !this.hasCastLowHealthWarcry && 
                                          healthAfterDamage > 0 && 
                                          healthPercentageAfter <= this.LOW_HEALTH_THRESHOLD;

        // 如果需要释放低血量咆哮，先标记，然后手动扣血，避免父类播放受击动画干扰
        if (shouldCastLowHealthWarcry) {
            // 标记已释放过低血量咆哮
            this.hasCastLowHealthWarcry = true;
            
            // 手动扣血（跳过父类的 takeDamage，避免受击动画干扰）
            bossThis.currentHealth = healthAfterDamage;
            if (bossThis.healthBar) {
                bossThis.healthBar.setHealth(bossThis.currentHealth);
            }
            
            // 显示伤害数字
            this.showDamageNumber(damage);
            
            // 检查是否死亡
            if (bossThis.currentHealth <= 0) {
                bossThis.currentHealth = 0;
                bossThis.die();
                return;
            }
            
            // 立即停止所有行动并释放战争咆哮
            if (!bossThis.isDestroyed && bossThis.currentHealth > 0) {
                // 停止所有动画（包括攻击动画和可能的受击动画），立即中断当前所有行动
                this.stopAllAnimations();
                
                // 重置攻击计时器，确保攻击被完全中断
                bossThis.attackTimer = 0;
                
                // 清除被攻击标志，确保可以释放咆哮
                bossThis.isHit = false;
                
                // 停止移动
                this.stopMoving();
                
                // 立即释放战争咆哮（不使用延迟，确保立即执行，不受冷却时间限制）
                this.playWarcryAnimation();
            }
        } else {
            // 不需要释放低血量咆哮，正常调用父类方法
            super.takeDamage(damage);
        }
    }
    
    /**
     * 重写攻击动画更新方法，在攻击动画播放期间也检查血量，确保能立即中断攻击释放咆哮
     */
    updateAttackAnimation() {
        // 先调用父类的攻击动画更新
        super.updateAttackAnimation();
        
        // 在攻击动画播放期间，检查血量是否降到50%以下
        const bossThis = this as any;
        if (this.isPlayingAttackAnimation && !this.hasCastLowHealthWarcry && bossThis.currentHealth > 0) {
            const healthPercentage = bossThis.currentHealth / this.maxHealth;
            if (healthPercentage <= this.LOW_HEALTH_THRESHOLD) {
                // 血量已降到50%以下，立即中断攻击并释放咆哮
                this.hasCastLowHealthWarcry = true;
                
                // 停止所有动画（包括攻击动画）
                this.stopAllAnimations();
                
                // 重置攻击计时器
                bossThis.attackTimer = 0;
                
                // 清除被攻击标志
                bossThis.isHit = false;
                
                // 停止移动
                this.stopMoving();
                
                // 立即释放战争咆哮
                this.playWarcryAnimation();
            }
        }
    }
}

