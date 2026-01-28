import { _decorator, SpriteFrame, Prefab, Texture2D, AudioClip, Node, Vec3, instantiate, find } from 'cc';
import { Role } from './Role';
import { Boomerang } from '../Boomerang';
import { AudioManager } from '../AudioManager';
const { ccclass, property } = _decorator;

@ccclass('Hunter')
export class Hunter extends Role {
    // 重写父类属性，设置 Hunter 的默认值
    @property({ override: true })
    maxHealth: number = 50;

    @property({ override: true })
    attackRange: number = 200;

    @property({ override: true })
    attackDamage: number = 10;

    @property({ override: true })
    attackInterval: number = 1.0;

    @property({ type: Prefab, override: true })
    bulletPrefab: Prefab = null!;

    @property({ type: Prefab, override: true })
    arrowPrefab: Prefab = null!; // 弓箭预制体（支持后期更新贴图）

    // Hunter 特有属性：回旋镖预制体
    @property({ type: Prefab })
    boomerangPrefab: Prefab = null!; // 回旋镖预制体

    @property({ type: Prefab, override: true })
    explosionEffect: Prefab = null!;

    @property({ type: Prefab, override: true })
    damageNumberPrefab: Prefab = null!;

    @property({ override: true })
    buildCost: number = 5; // 建造成本（用于回收和升级）
    
    @property({ override: true })
    level: number = 1; // 女猎手等级

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
    @property({ type: AudioClip, override: true })
    shootSound: AudioClip = null!; // 箭矢射出时的音效
    
    @property({ type: AudioClip, override: true })
    hitSound: AudioClip = null!; // 箭矢击中敌人时的音效

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
    collisionRadius: number = 10; // 碰撞半径（像素）

    @property({ type: SpriteFrame, override: true })
    cardIcon: SpriteFrame = null!; // 单位名片图片
    
    // 单位信息属性
    @property({ override: true })
    unitName: string = "女猎手";
    
    @property({ override: true })
    unitDescription: string = "远程攻击单位，投掷回旋镖攻击敌人，回旋镖可以反弹多次。";
    
    @property({ type: SpriteFrame, override: true })
    unitIcon: SpriteFrame = null!;

    battleSlogans: string[] = ['我潜行于黑暗之中！', '利爪撕破长夜！', '月神指引我的道路!', '猎杀时刻！', '射击！射击！射击！', '瞄准，射击！']; // 战斗口号数组（可在编辑器中配置）

    /**
     * 重写攻击方法，使用回旋镖
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

        // 获取敌人脚本，支持OrcWarlord、OrcWarrior、Enemy和TrollSpearman
        const enemyScript = this.currentTarget.getComponent('OrcWarlord') as any || this.currentTarget.getComponent('OrcWarrior') as any || this.currentTarget.getComponent('Enemy') as any || this.currentTarget.getComponent('TrollSpearman') as any;
        if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
            // 播放攻击动画，动画完成后才射出回旋镖
            this.playAttackAnimation(() => {
                // 动画播放完成后的回调，在这里创建回旋镖
                this.executeAttack();
            });
        } else {
            // 目标已死亡，清除目标
            this.currentTarget = null!;
        }
    }

    /**
     * 重写执行攻击方法，优先使用回旋镖
     */
    executeAttack() {
        // 再次检查目标是否有效
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active || this.isDestroyed) {
            return;
        }

        // 获取敌人脚本，支持OrcWarlord、OrcWarrior、Enemy和TrollSpearman
        const enemyScript = this.currentTarget.getComponent('OrcWarlord') as any || this.currentTarget.getComponent('OrcWarrior') as any || this.currentTarget.getComponent('Enemy') as any || this.currentTarget.getComponent('TrollSpearman') as any;
        if (!enemyScript || !enemyScript.isAlive || !enemyScript.isAlive()) {
            this.currentTarget = null!;
            return;
        }

        // 优先使用回旋镖预制体（如果存在）
        if (this.boomerangPrefab) {
            this.createBoomerang();
        } else if (this.bulletPrefab) {
            // 使用子弹预制体，直接造成伤害
            this.createBullet();
        } else if (this.arrowPrefab) {
            // 如果子弹预制体不存在，使用弓箭预制体
            this.createArrow();
        } else {
            // 直接伤害（无特效）
            if (enemyScript.takeDamage) {
                enemyScript.takeDamage(this.attackDamage);
                // 记录伤害统计
                this.recordDamageToStatistics(this.attackDamage);
            }
        }
    }

    /**
     * 创建回旋镖
     */
    createBoomerang() {
        if (!this.boomerangPrefab || !this.currentTarget) {
            return;
        }

        // 检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            return;
        }

        // 创建回旋镖节点
        const boomerang = instantiate(this.boomerangPrefab);
        
        // 设置父节点（添加到场景或Canvas）
        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            boomerang.setParent(parentNode);
        } else {
            boomerang.setParent(this.node.parent);
        }

        // 设置初始位置（女猎手位置）
        const startPos = this.node.worldPosition.clone();
        boomerang.setWorldPosition(startPos);

        // 确保节点激活
        boomerang.active = true;

        // 获取Boomerang组件
        const boomerangScript = boomerang.getComponent(Boomerang) as any;
        if (!boomerangScript) {
            return;
        }

        // 播放箭矢射出音效
        if (this.shootSound && AudioManager.Instance) {
            AudioManager.Instance.playSFX(this.shootSound);
        }

        // 保存当前目标的引用，避免回调函数中引用失效的目标
        const targetNode = this.currentTarget;
        
        // 初始化回旋镖
        boomerangScript.init(
            startPos,
            targetNode,
            this.attackDamage,
            (damage: number) => {
                // 播放箭矢击中音效
                if (this.hitSound) {
                    AudioManager.Instance?.playSFX(this.hitSound);
                }
                
                // 检查目标是否仍然有效
                if (targetNode && targetNode.isValid && targetNode.active) {
                    // 支持Enemy、OrcWarrior、OrcWarlord和TrollSpearman
                    const enemyScript = targetNode.getComponent('Enemy') as any || targetNode.getComponent('OrcWarrior') as any || targetNode.getComponent('OrcWarlord') as any || targetNode.getComponent('TrollSpearman') as any;
                    if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
                        if (enemyScript.takeDamage) {
                            enemyScript.takeDamage(damage);
                            // 记录伤害统计
                            this.recordDamageToStatistics(damage);
                        }
                    }
                }
            },
            this.node // 传入女猎手节点作为ownerNode
        );
    }
}
