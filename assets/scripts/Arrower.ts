import { _decorator, SpriteFrame, Prefab, Texture2D, AudioClip, Vec3, Node, instantiate, find } from 'cc';
import { Role } from './Role';
import { AudioManager } from './AudioManager';
import { Arrow } from './Arrow';
import { Arrow2 } from './Arrow2';
const { ccclass, property } = _decorator;

@ccclass('Arrower')
export class Arrower extends Role {
    // 重写父类属性，设置 Arrower 的默认值
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

    @property({ type: Prefab, override: true })
    explosionEffect: Prefab = null!;

    @property({ type: Prefab, override: true })
    damageNumberPrefab: Prefab = null!;

    @property({ override: true })
    buildCost: number = 5; // 建造成本（用于回收和升级）
    
    @property({ override: true })
    level: number = 1; // 弓箭手等级

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
    collisionRadius: number = 30; // 碰撞半径（像素）

    @property({ type: SpriteFrame, override: true })
    cardIcon: SpriteFrame = null!; // 单位名片图片
    
    // 单位信息属性
    @property({ override: true })
    unitName: string = "弓箭手";
    
    @property({ override: true })
    unitDescription: string = "你就是城里来的指挥官吗？看起来还不赖，暂且相信你好了。";
    
    @property({ type: SpriteFrame, override: true })
    unitIcon: SpriteFrame = null!;

    // 3级专用：强化版箭矢预制体（Arrow2）
    @property({ type: Prefab })
    level3ArrowPrefab: Prefab = null!;

    battleSlogans: string[] = ['箭如雨下！', '射击！射击！射击！', '瞄准，射击！', '弓弦紧绷射天狼!', '箭似流星！','射箭！射箭！射箭！', 'Biu! Biu! Biu!'];

    /**
     * 重写父类的createArrow：
     * - 1、2级：使用普通箭矢逻辑（父类实现）
     * - 3级：使用 Arrow2 预制体，直线弹道，穿透第一个敌人后继续飞行100像素
     */
    protected createArrow() {
        // 等级小于3，保持原有逻辑
        if (this.level < 3 || !this.level3ArrowPrefab) {
            // 使用父类的普通箭矢逻辑
            // @ts-ignore 通过索引访问以避免编译器对protected的限制提示
            super['createArrow']();
            return;
        }

        if (!this.currentTarget || this.isDestroyed) {
            return;
        }

        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            return;
        }

        // 选择使用的箭矢预制体（优先使用3级专用的 Arrow2）
        const prefabToUse = this.level3ArrowPrefab || this.arrowPrefab;
        if (!prefabToUse) {
            // 如果未配置 Arrow2，则退回父类逻辑
            // @ts-ignore
            super['createArrow']();
            return;
        }

        // 创建弓箭节点
        const arrowNode = instantiate(prefabToUse);

        // 设置父节点（添加到场景或Canvas）
        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            arrowNode.setParent(parentNode);
        } else {
            arrowNode.setParent(this.node.parent);
        }

        // 设置初始位置（弓箭手位置）
        const startPos = this.node.worldPosition.clone();
        arrowNode.setWorldPosition(startPos);

        // 确保节点激活
        arrowNode.active = true;

        // 获取或添加Arrow2组件（3级专用穿透箭）
        let arrow2Script = arrowNode.getComponent(Arrow2);
        if (!arrow2Script) {
            arrow2Script = arrowNode.addComponent(Arrow2);
        }

        // 播放箭矢射出音效
        if (this.shootSound && AudioManager.Instance) {
            AudioManager.Instance.playSFX(this.shootSound);
        }

        const targetNode = this.currentTarget;
        const baseDamage = this.attackDamage;

        // 记录是否已播放过音效
        let hasPlayedHitSound = false;

        // 初始化穿透箭，设置命中回调
        arrow2Script.init(
            startPos,
            targetNode,
            baseDamage,
            (damage: number, hitPos: Vec3, enemy: Node) => {
                // 播放击中音效（只在第一次命中时播放）
                if (!hasPlayedHitSound && this.hitSound) {
                    AudioManager.Instance?.playSFX(this.hitSound);
                    hasPlayedHitSound = true;
                }

                // 检查敌人是否有效
                if (!enemy || !enemy.isValid || !enemy.active) {
                    return;
                }

                // 检查是否是存活敌人
                if (!this.isAliveEnemy(enemy)) {
                    return;
                }

                // 获取敌人脚本并造成伤害
                const enemyScript = this.getEnemyScript(enemy);
                if (enemyScript && enemyScript.takeDamage) {
                    enemyScript.takeDamage(damage);
                }
            }
        );
    }
}