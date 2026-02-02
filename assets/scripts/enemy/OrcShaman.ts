import { _decorator, Prefab, Node, Vec3, find, instantiate, SpriteFrame } from 'cc';
import { Enemy } from './Enemy';
import { AudioManager } from '../AudioManager';

const { ccclass, property } = _decorator;

@ccclass('OrcShaman')
export class OrcShaman extends Enemy {
    // 重写父类属性，设置 OrcShaman 的默认值
    maxHealth: number = 250; // 强化生命值：从200增加到250
    moveSpeed: number = 30; // 移动速度缓慢
    attackDamage: number = 25; // 攻击力很高
    attackInterval: number = 2.0;
    attackRange: number = 200; // 远程攻击范围
    collisionRadius: number = 20; // 碰撞半径（像素）
    tenacity: number = 0.3; // 韧性与督军保持一致（0.3）
    unitName: string = "兽人萨满";
    unitDescription: string = "强大的兽人萨满，释放绿色法球攻击，移动缓慢但攻击力极高。";
    goldReward: number = 8;
    expReward: number = 8; // 消灭萨满获得8点经验值
    attackAnimationName: string = 'shaman-attack';
    attackAnimationDuration: number = 0.6;
    
    @property(Prefab)
    greenOrbPrefab: Prefab = null!; // 绿色法球预制体
    
    @property({ type: SpriteFrame, override: true })
    attackAnimationFrames: SpriteFrame[] = [];// 攻击动画帧数组
    
    // 图腾技能相关
    private totemSpawnTimer: number = 0; // 萨满出现后的计时器
    private readonly TOTEM_SPAWN_DELAY: number = 5; // 萨满出现5秒后释放图腾
    private totemCooldown: number = 0; // 图腾冷却时间
    private readonly TOTEM_COOLDOWN: number = 30; // 图腾冷却时间30秒
    private hasCastLowHealthTotem: boolean = false; // 是否已经释放过70%血量以下的图腾
    private readonly LOW_HEALTH_THRESHOLD: number = 0.7; // 70%血量阈值
    @property(Prefab)
    totemPrefab: Prefab = null!; // 图腾预制体
    
    @property({ type: SpriteFrame })
    totemCastAnimationFrames: SpriteFrame[] = []; // 释放图腾的动画帧数组
    
    @property
    totemCastAnimationDuration: number = 1.0; // 释放图腾动画时长
    
    start() {
        super.start();
        // 在 start 中确保 expReward 被正确设置
        if (this.expReward === 0) {
            this.expReward = 8;
        }
        // 重置图腾相关状态
        this.totemSpawnTimer = 0;
        this.totemCooldown = 0;
        this.hasCastLowHealthTotem = false;
    }
    
    update(deltaTime: number) {
        // 调用父类的update方法
        super.update(deltaTime);
        
        if (this.isDestroyed || this.isPlayingDeathAnimation) {
            return;
        }
        
        // 更新图腾冷却时间
        if (this.totemCooldown > 0) {
            this.totemCooldown -= deltaTime;
            if (this.totemCooldown < 0) {
                this.totemCooldown = 0;
            }
        }
        
        // 更新图腾释放计时器
        this.totemSpawnTimer += deltaTime;
        
        // 如果冷却时间已过，且距离上次释放已超过初始延迟时间，可以释放图腾
        if (this.totemCooldown <= 0 && this.totemSpawnTimer >= this.TOTEM_SPAWN_DELAY) {
            this.castTotem();
            // 重置计时器，设置冷却时间
            this.totemSpawnTimer = 0;
            this.totemCooldown = this.TOTEM_COOLDOWN;
        }
    }
    
    /**
     * 重写攻击方法，使用远程攻击（释放绿色法球）
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

        const targetPos = this.currentTarget.worldPosition;
        const enemyPos = this.node.worldPosition;
        const distance = Vec3.distance(enemyPos, targetPos);

        // 攻击时朝向目标方向
        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        this.flipDirection(direction);

        // 保存当前目标，用于攻击动画中途释放法球
        const currentTarget = this.currentTarget;
        
        // 设置攻击回调函数，在动画播放中途（约50%处）释放法球
        this.attackCallback = () => {
            if (currentTarget && currentTarget.isValid && currentTarget.active) {
                // 使用释放绿色法球的方式攻击目标
                this.createGreenOrb(currentTarget);
            }
        };

        // 播放攻击动画（使用重写的方法）
        this.playAttackAnimation();
    }
    
    /**
     * 重写播放攻击动画方法，使用动画帧方式，在动画中途调用createGreenOrb
     */
    playAttackAnimation() {
        if (this.isPlayingDeathAnimation || this.isDestroyed) {
            return;
        }

        // 如果正在播放动画，不重复播放
        if (this.isPlayingAttackAnimation) {
            return;
        }

        // 如果没有Sprite组件或没有动画帧，直接返回
        if (!this.sprite) {
            return;
        }

        // 如果没有设置动画帧，直接返回
        if (!this.attackAnimationFrames || this.attackAnimationFrames.length === 0) {
            return;
        }

        // 检查帧是否有效
        const validFrames = this.attackAnimationFrames.filter(frame => frame != null);
        if (validFrames.length === 0) {
            return;
        }

        // 停止所有动画
        this.stopAllAnimations();
        
        // 标记正在播放动画
        this.isPlayingAttackAnimation = true;

        const frames = validFrames;
        const frameCount = frames.length;
        const frameDuration = this.attackAnimationDuration / frameCount; // 每帧的时长

        // 使用update方法播放动画（更可靠）
        let animationTimer = 0;
        let lastFrameIndex = -1; // 记录上一帧的索引，避免重复设置
        let hasThrownOrb = false; // 标记是否已经释放法球
        
        // 立即播放第一帧
        if (frames[0]) {
            this.sprite.spriteFrame = frames[0];
            lastFrameIndex = 0;
        }
        
        // 使用update方法逐帧播放
        const animationUpdate = (deltaTime: number) => {
            if (!this.sprite || !this.sprite.isValid || this.isDestroyed) {
                this.isPlayingAttackAnimation = false;
                this.unschedule(animationUpdate);
                return;
            }

            animationTimer += deltaTime;
            
            // 计算当前应该显示的帧索引
            const targetFrameIndex = Math.min(Math.floor(animationTimer / frameDuration), frameCount - 1);
            
            // 在动画播放到约50%时释放法球（只执行一次）
            if (!hasThrownOrb && animationTimer >= this.attackAnimationDuration * 0.5) {
                hasThrownOrb = true;
                if (this.attackCallback) {
                    // 调用攻击回调函数（释放绿色法球）
                    this.attackCallback();
                }
            }
            
            // 检查动画是否完成
            if (animationTimer >= this.attackAnimationDuration) {
                // 确保播放最后一帧
                if (lastFrameIndex < frameCount - 1 && frames[frameCount - 1]) {
                    this.sprite.spriteFrame = frames[frameCount - 1];
                }
                // 动画播放完成，恢复默认SpriteFrame
                this.restoreDefaultSprite();
                this.unschedule(animationUpdate);
                
                // 清除回调
                this.attackCallback = null;
                
                // 动画结束后切换回待机动画
                this.playIdleAnimation();
                return;
            }
            
            // 更新到当前帧（只在帧变化时更新）
            if (targetFrameIndex !== lastFrameIndex && targetFrameIndex < frameCount && frames[targetFrameIndex]) {
                this.sprite.spriteFrame = frames[targetFrameIndex];
                lastFrameIndex = targetFrameIndex;
            }
        };
        
        // 开始动画更新（每帧更新）
        this.schedule(animationUpdate, 0);
    }
    
    /**
     * 创建并释放绿色法球
     */
    createGreenOrb(targetNode: Node) {
        if (!this.greenOrbPrefab) {
            return;
        }

        // 检查目标是否有效
        if (!targetNode.isValid || !targetNode.active) {
            return;
        }
        
        const targetPos = targetNode.worldPosition;
        const enemyPos = this.node.worldPosition;

        // 创建绿色法球节点
        const orb = instantiate(this.greenOrbPrefab);
        
        // 设置父节点（添加到场景或Canvas）
        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            orb.setParent(parentNode);
        } else {
            orb.setParent(this.node.parent);
        }

        // 设置初始位置（萨满位置）
        const startPos = this.node.worldPosition.clone();
        orb.setWorldPosition(startPos);

        // 确保节点激活
        orb.active = true;

        // 获取或添加GreenOrb组件
        let orbScript = orb.getComponent('GreenOrb') as any;
        if (!orbScript) {
            // 如果没有GreenOrb组件，尝试添加
            orbScript = orb.addComponent('GreenOrb');
            if (!orbScript) {
                return;
            }
        }

        // 播放攻击音效
        if (this.attackSound) {
            AudioManager.Instance.playSFX(this.attackSound);
        }

        // 初始化法球，设置命中回调
        orbScript.init(
            startPos,
            targetNode,
            this.attackDamage,
            (damage: number) => {
                // 检查目标是否仍然有效
                if (targetNode && targetNode.isValid && targetNode.active) {
                    const towerScript = targetNode.getComponent('Arrower') as any;
                    const warAncientTreeScript = targetNode.getComponent('WarAncientTree') as any;
                    const hallScript = targetNode.getComponent('HunterHall') as any;
                    const swordsmanHallScript = targetNode.getComponent('SwordsmanHall') as any;
                    const crystalScript = targetNode.getComponent('Crystal') as any;
                    const hunterScript = targetNode.getComponent('Hunter') as any;
                    const elfSwordsmanScript = targetNode.getComponent('ElfSwordsman') as any;
                    const stoneWallScript = targetNode.getComponent('StoneWall') as any;
                    const watchTowerScript = targetNode.getComponent('WatchTower') as any;
                    const iceTowerScript = targetNode.getComponent('IceTower') as any;
                    const thunderTowerScript = targetNode.getComponent('ThunderTower') as any;
                    const targetScript = towerScript || warAncientTreeScript || hallScript || swordsmanHallScript || crystalScript || hunterScript || elfSwordsmanScript || stoneWallScript || watchTowerScript || iceTowerScript || thunderTowerScript;
                    
                    if (targetScript && targetScript.takeDamage) {
                        targetScript.takeDamage(damage);
                    } else {
                        // 目标无效，清除目标
                        this.currentTarget = null!;
                    }
                }
            }
        );
    }
    
    /**
     * 释放萨满图腾技能
     */
    private castTotem() {
        if (!this.totemPrefab || this.isDestroyed) {
            return;
        }
        
        // 如果有释放图腾的动画帧，播放动画
        if (this.totemCastAnimationFrames && this.totemCastAnimationFrames.length > 0) {
            this.playTotemCastAnimation(() => {
                // 动画完成后创建图腾
                this.createTotem();
            });
        } else {
            // 没有动画帧，直接创建图腾
            this.createTotem();
        }
    }
    
    /**
     * 播放释放图腾的动画
     */
    private playTotemCastAnimation(onComplete: () => void) {
        if (!this.sprite || this.isDestroyed) {
            onComplete();
            return;
        }
        
        const frames = this.totemCastAnimationFrames.filter(frame => frame != null);
        if (frames.length === 0) {
            onComplete();
            return;
        }
        
        // 停止所有动画
        this.stopAllAnimations();
        
        const frameCount = frames.length;
        const frameDuration = this.totemCastAnimationDuration / frameCount;
        
        let animationTimer = 0;
        let lastFrameIndex = -1;
        
        // 立即播放第一帧
        if (frames[0]) {
            this.sprite.spriteFrame = frames[0];
            lastFrameIndex = 0;
        }
        
        // 使用update方法逐帧播放
        const animationUpdate = (deltaTime: number) => {
            if (!this.sprite || !this.sprite.isValid || this.isDestroyed) {
                this.unschedule(animationUpdate);
                onComplete();
                return;
            }
            
            animationTimer += deltaTime;
            
            // 计算当前应该显示的帧索引
            const targetFrameIndex = Math.min(Math.floor(animationTimer / frameDuration), frameCount - 1);
            
            // 检查动画是否完成
            if (animationTimer >= this.totemCastAnimationDuration) {
                // 确保播放最后一帧
                if (lastFrameIndex < frameCount - 1 && frames[frameCount - 1]) {
                    this.sprite.spriteFrame = frames[frameCount - 1];
                }
                // 动画播放完成，恢复默认SpriteFrame
                this.restoreDefaultSprite();
                this.unschedule(animationUpdate);
                onComplete();
                return;
            }
            
            // 更新到当前帧（只在帧变化时更新）
            if (targetFrameIndex !== lastFrameIndex && targetFrameIndex < frameCount && frames[targetFrameIndex]) {
                this.sprite.spriteFrame = frames[targetFrameIndex];
                lastFrameIndex = targetFrameIndex;
            }
        };
        
        // 开始动画更新（每帧更新）
        this.schedule(animationUpdate, 0);
    }
    
    /**
     * 创建图腾
     */
    private createTotem() {
        // 计算图腾位置（身前10像素）
        const shamanPos = this.node.worldPosition.clone();
        const direction = new Vec3();
        
        // 如果有目标，朝向目标方向；否则朝向移动方向
        if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
            Vec3.subtract(direction, this.currentTarget.worldPosition, shamanPos);
        } else {
            // 默认朝右
            direction.set(1, 0, 0);
        }
        
        // 归一化方向向量
        if (direction.length() > 0.1) {
            direction.normalize();
        } else {
            direction.set(1, 0, 0);
        }
        
        // 计算图腾位置（身前10像素）
        const totemPos = new Vec3();
        Vec3.scaleAndAdd(totemPos, shamanPos, direction, 10);
        
        // 创建图腾节点
        const totem = instantiate(this.totemPrefab);
        
        // 设置父节点
        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            totem.setParent(parentNode);
        } else {
            totem.setParent(this.node.parent);
        }
        
        // 设置位置
        totem.setWorldPosition(totemPos);
        totem.active = true;
        
        // 获取或添加ShamanTotem组件
        let totemScript = totem.getComponent('ShamanTotem') as any;
        if (!totemScript) {
            totemScript = totem.addComponent('ShamanTotem');
        }
        
        // 初始化图腾
        if (totemScript && totemScript.init) {
            totemScript.init(totemPos);
        }
    }

    /**
     * 重写受击方法，检查生命值是否降到70%以下，如果是则释放额外图腾
     */
    takeDamage(damage: number) {
        if (this.isDestroyed) {
            return;
        }

        // 调用父类的takeDamage方法
        super.takeDamage(damage);

        // 检查生命值是否降到70%以下，且还没有释放过低血量图腾
        if (!this.hasCastLowHealthTotem && this.currentHealth > 0) {
            const healthPercentage = this.currentHealth / this.maxHealth;
            if (healthPercentage <= this.LOW_HEALTH_THRESHOLD) {
                // 标记已释放过低血量图腾
                this.hasCastLowHealthTotem = true;
                // 立即释放额外图腾（不受冷却时间限制）
                this.castTotem();
            }
        }
    }
}
