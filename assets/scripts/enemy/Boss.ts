import { _decorator, Component, Node, Vec3, Sprite, find, Color, SpriteFrame, AudioClip } from 'cc';
import { GameManager, GameState } from '../GameManager';
import { AudioManager } from '../AudioManager';
import { UnitType } from '../role/WarAncientTree';
const { ccclass, property } = _decorator;

/**
 * Boss基类
 * 包含Boss单位的共同功能，如战争咆哮等
 */
@ccclass('Boss')
export class Boss extends Component {
    // 战争咆哮技能属性（子类可以重写）
    @property
    warcryCooldown: number = 30; // 战争咆哮冷却时间（秒）
    @property
    warcryDuration: number = 10; // 战争咆哮持续时间（秒）
    @property
    warcryEffect: number = 0.25; // 战争咆哮效果提升幅度（25%）
    @property
    warcryRange: number = 200; // 战争咆哮范围（像素）
    @property(AudioClip)
    warcrySound: AudioClip = null!; // 战争咆哮音效
    @property(SpriteFrame)
    warcryAnimationFrames: SpriteFrame[] = []; // 战争咆哮动画帧
    @property
    warcryAnimationDuration: number = 1.0; // 战争咆哮动画时长
    
    // 战争咆哮私有属性
    protected warcryTimer: number = 0; // 战争咆哮冷却计时器
    protected isPlayingWarcryAnimation: boolean = false; // 是否正在播放战争咆哮动画
    protected warcryBuffedEnemies: Set<Node> = new Set(); // 被战争咆哮影响的敌人集合
    protected warcryBuffEndTime: Map<Node, number> = new Map(); // 每个敌人的buff结束时间
    protected wasPlayingAttackBeforeWarcry: boolean = false; // 战争咆哮前是否正在攻击
    
    // 攻击计时器（用于计算buff时间）
    protected attackTimer: number = 0;

    /**
     * 释放战争咆哮效果（子类可以重写以增强效果）
     */
    protected releaseWarcry() {
        // 播放战争咆哮音效
        if (this.warcrySound) {
            AudioManager.Instance.playSFX(this.warcrySound);
        }
        
        // 查找附近的敌人
        this.findNearbyEnemies();
        
        // 重置战争咆哮冷却计时器
        this.warcryTimer = 0;
    }
    
    /**
     * 查找附近的敌人并应用战争咆哮效果（子类可以重写以扩大范围）
     */
    protected findNearbyEnemies() {
        // 查找Enemies容器
        const enemiesNode = find('Canvas/Enemies');
        
        if (!enemiesNode) {
            return;
        }
        
        const enemies = enemiesNode.children || [];
        const currentTime = this.attackTimer;
        
        for (const enemy of enemies) {
            if (!enemy || !enemy.isValid || !enemy.active) {
                continue;
            }
            
            // 计算距离
            const distance = Vec3.distance(this.node.worldPosition, enemy.worldPosition);
            if (distance <= this.warcryRange) {
                // 检查敌人是否存活
                const enemyScript = enemy.getComponent('Enemy') as any || 
                                   enemy.getComponent('OrcWarrior') as any || 
                                   enemy.getComponent('OrcWarlord') as any ||
                                   enemy.getComponent('Boss') as any;
                if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
                    // 应用战争咆哮效果
                    this.applyWarcryBuff(enemy, enemyScript, currentTime);
                }
            }
        }
    }
    
    /**
     * 应用战争咆哮buff（子类可以重写以增强效果）
     */
    protected applyWarcryBuff(enemy: Node, enemyScript: any, currentTime: number) {
        // 保存原始属性
        if (!enemyScript._originalMoveSpeed) {
            enemyScript._originalMoveSpeed = enemyScript.moveSpeed;
        }
        if (!enemyScript._originalAttackDamage) {
            enemyScript._originalAttackDamage = enemyScript.attackDamage;
        }
        if (!enemyScript._originalAttackInterval) {
            enemyScript._originalAttackInterval = enemyScript.attackInterval;
        }
        
        // 提升属性
        enemyScript.moveSpeed = enemyScript._originalMoveSpeed * (1 + this.warcryEffect);
        enemyScript.attackDamage = enemyScript._originalAttackDamage * (1 + this.warcryEffect);
        enemyScript.attackInterval = enemyScript._originalAttackInterval / (1 + this.warcryEffect);
        
        // 添加红光效果
        this.addRedGlowEffect(enemy);
        
        // 添加到受影响敌人集合
        this.warcryBuffedEnemies.add(enemy);
        this.warcryBuffEndTime.set(enemy, currentTime + this.warcryDuration);
    }
    
    /**
     * 移除战争咆哮buff
     */
    protected removeWarcryBuff(enemy: Node, enemyScript: any) {
        if (enemyScript._originalMoveSpeed) {
            enemyScript.moveSpeed = enemyScript._originalMoveSpeed;
        }
        if (enemyScript._originalAttackDamage) {
            enemyScript.attackDamage = enemyScript._originalAttackDamage;
        }
        if (enemyScript._originalAttackInterval) {
            enemyScript.attackInterval = enemyScript._originalAttackInterval;
        }
        
        // 移除红光效果
        this.removeRedGlowEffect(enemy);
        
        // 从集合中移除
        this.warcryBuffedEnemies.delete(enemy);
        this.warcryBuffEndTime.delete(enemy);
    }
    
    /**
     * 添加红光效果
     */
    protected addRedGlowEffect(enemy: Node) {
        // 移除已有的红光效果（如果有）
        this.removeRedGlowEffect(enemy);
        
        // 获取敌人的Sprite组件
        const sprite = enemy.getComponent(Sprite);
        if (sprite) {
            // 保存原始颜色，以便后续恢复
            enemy['_originalColor'] = sprite.color.clone();
            
            // 设置红色发光效果（提高红色通道值）
            sprite.color = new Color(255, 150, 150, 255); // 偏红色
        }
    }
    
    /**
     * 移除红光效果
     */
    protected removeRedGlowEffect(enemy: Node) {
        // 获取敌人的Sprite组件
        const sprite = enemy.getComponent(Sprite);
        if (sprite && enemy['_originalColor']) {
            // 恢复原始颜色
            sprite.color = enemy['_originalColor'];
            delete enemy['_originalColor'];
        }
    }
    
    /**
     * 更新战争咆哮buff状态（需要在update中调用）
     */
    protected updateWarcryBuffs(deltaTime: number) {
        if (this.warcryBuffedEnemies.size === 0) {
            return;
        }
        
        const currentTime = this.attackTimer;
        const enemiesToRemove: Node[] = [];
        
        // 检查每个受影响的敌人
        for (const enemy of this.warcryBuffedEnemies) {
            if (!enemy || !enemy.isValid) {
                enemiesToRemove.push(enemy);
                continue;
            }
            
            const endTime = this.warcryBuffEndTime.get(enemy);
            if (endTime !== undefined && currentTime >= endTime) {
                // Buff时间到，移除效果
                const enemyScript = enemy.getComponent('Enemy') as any || 
                                   enemy.getComponent('OrcWarrior') as any || 
                                   enemy.getComponent('OrcWarlord') as any ||
                                   enemy.getComponent('Boss') as any;
                if (enemyScript) {
                    this.removeWarcryBuff(enemy, enemyScript);
                }
                enemiesToRemove.push(enemy);
            }
        }
        
        // 清理无效敌人
        for (const enemy of enemiesToRemove) {
            this.warcryBuffedEnemies.delete(enemy);
            this.warcryBuffEndTime.delete(enemy);
        }
    }
    
    /**
     * 清理所有战争咆哮buff（死亡时调用）
     */
    protected clearAllWarcryBuffs() {
        for (const enemy of this.warcryBuffedEnemies) {
            if (enemy && enemy.isValid) {
                const enemyScript = enemy.getComponent('Enemy') as any || 
                                   enemy.getComponent('OrcWarrior') as any || 
                                   enemy.getComponent('OrcWarlord') as any ||
                                   enemy.getComponent('Boss') as any;
                if (enemyScript) {
                    this.removeWarcryBuff(enemy, enemyScript);
                }
            }
        }
        this.warcryBuffedEnemies.clear();
        this.warcryBuffEndTime.clear();
    }
}
