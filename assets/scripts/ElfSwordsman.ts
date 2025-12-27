import { _decorator, SpriteFrame, Prefab, Texture2D, AudioClip, Node, Vec3 } from 'cc';
import { Role } from './Role';
import { AudioManager } from './AudioManager';
const { ccclass, property } = _decorator;

@ccclass('ElfSwordsman')
export class ElfSwordsman extends Role {
    // 重写父类属性，设置 ElfSwordsman 的默认值
    @property({ override: true })
    maxHealth: number = 200;

    @property({ override: true })
    attackRange: number = 60; // 近战攻击范围

    @property({ override: true })
    attackDamage: number = 10;

    @property({ override: true })
    attackInterval: number = 1.0;

    @property({ type: Prefab, override: true })
    bulletPrefab: Prefab = null!;

    @property({ type: Prefab, override: true })
    explosionEffect: Prefab = null!;

    @property({ type: Prefab, override: true })
    damageNumberPrefab: Prefab = null!;

    @property({ override: true })
    buildCost: number = 5; // 建造成本（用于回收和升级）
    
    @property({ override: true })
    level: number = 1; // 精灵剑士等级

    // 攻击动画相关属性
    @property({ type: SpriteFrame, override: true })
    attackAnimationFrames: SpriteFrame[] = []; // 攻击动画帧数组（推荐：在编辑器中手动设置）
    
    // 被攻击动画相关属性
    @property({ type: SpriteFrame, override: true })
    hitAnimationFrames: SpriteFrame[] = []; // 被攻击动画帧数组
    
    // 死亡动画相关属性
    @property({ type: SpriteFrame, override: true })
    deathAnimationFrames: SpriteFrame[] = []; // 死亡动画帧数组
    
    // 音效相关属性
    @property({ type: AudioClip })
    attackSound: AudioClip = null!; // 近战攻击时的音效（ElfSwordsman 特有）
    
    @property({ type: AudioClip, override: true })
    hitSound: AudioClip = null!; // 攻击击中敌人时的音效

    @property({ type: Texture2D, override: true })
    attackAnimationTexture: Texture2D = null!; // 攻击动画纹理（12帧图片）

    @property({ override: true })
    framesPerRow: number = 12; // 每行帧数（横向排列为12，3x4网格为3，4x3网格为4）

    @property({ override: true })
    totalFrames: number = 12; // 总帧数

    @property({ override: true })
    attackAnimationDuration: number = 0.5; // 攻击动画时长（秒）
    
    @property({ override: true })
    hitAnimationDuration: number = 0.3; // 被攻击动画时长（秒）
    
    @property({ override: true })
    deathAnimationDuration: number = 1.0; // 死亡动画时长（秒）

    // 移动相关属性
    @property({ override: true })
    moveSpeed: number = 100; // 移动速度（像素/秒）

    @property({ type: SpriteFrame, override: true })
    moveAnimationFrames: SpriteFrame[] = []; // 移动动画帧数组（可选）

    @property({ override: true })
    moveAnimationDuration: number = 0.3; // 移动动画时长（秒）

    @property({ override: true })
    collisionRadius: number = 30; // 碰撞半径（像素）

    @property({ type: SpriteFrame, override: true })
    cardIcon: SpriteFrame = null!; // 单位名片图片
    
    // 单位信息属性
    @property({ override: true })
    unitName: string = "精灵剑士";
    
    @property({ override: true })
    unitDescription: string = "近战攻击单位，使用剑进行近距离战斗。";
    
    @property({ type: SpriteFrame, override: true })
    unitIcon: SpriteFrame = null!;

    /**
     * 重写索敌范围，索敌范围为攻击范围的8倍（特殊处理）
     */
    protected getDetectionRange(): number {
        return this.attackRange * 8; // 8倍攻击范围用于检测（ElfSwordsman 特殊处理）
    }

    /**
     * 重写移动范围，移动范围为攻击范围的8倍（与索敌范围一致）
     */
    protected getMovementRange(): number {
        return this.attackRange * 8; // 8倍攻击范围用于移动（ElfSwordsman 特殊处理）
    }

    /**
     * 重写攻击方法，实现近战攻击
     */
    attack() {
        if (!this.currentTarget || this.isDestroyed) {
            return;
        }

        // 再次检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }

        // 攻击时停止移动
        this.stopMoving();

        // 检查目标是否是存活的敌人
        if (this.isAliveEnemy(this.currentTarget)) {
            // 播放攻击动画，动画完成后才进行近战攻击
            this.playAttackAnimation(() => {
                // 动画播放完成后的回调，在这里执行近战攻击
                this.executeAttack();
            });
        } else {
            // 目标已死亡，清除目标
            this.currentTarget = null!;
        }
    }

    /**
     * 重写执行攻击方法，实现近战攻击
     */
    executeAttack() {
        // 再次检查目标是否有效
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active || this.isDestroyed) {
            return;
        }

        // 检查目标是否是存活的敌人
        if (!this.isAliveEnemy(this.currentTarget)) {
            this.currentTarget = null!;
            return;
        }
        
        // 获取敌人脚本
        const enemyScript = this.getEnemyScript(this.currentTarget);

        // 近战攻击：直接对敌人造成伤害，不创建武器
        if (enemyScript && enemyScript.takeDamage) {
            // 播放攻击音效
            if (this.attackSound && AudioManager.Instance) {
                AudioManager.Instance.playSFX(this.attackSound);
            }
            // 播放击中音效
            if (this.hitSound && AudioManager.Instance) {
                AudioManager.Instance.playSFX(this.hitSound);
            }
            // 直接造成伤害
            enemyScript.takeDamage(this.attackDamage);
        }
    }
}
