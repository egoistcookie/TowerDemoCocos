import { _decorator, Prefab, Node, Vec3, find, instantiate, SpriteFrame } from 'cc';
import { Enemy } from './Enemy';
import { AudioManager } from './AudioManager';

const { ccclass, property } = _decorator;

@ccclass('TrollSpearman')
export class TrollSpearman extends Enemy {
    // 重写父类属性，设置 TrollSpearman 的默认值
    maxHealth: number = 40;
    moveSpeed: number = 55;
    attackDamage: number = 6;
    attackInterval: number = 1.8;
    attackRange: number = 200;
    collisionRadius: number = 20; // 碰撞半径（像素）
    unitName: string = "巨魔投矛手";
    unitDescription: string = "远程攻击的巨魔投矛手，拥有较远的攻击距离，但血量较低。";
    goldReward: number = 3;
    attackAnimationName: string = 'troll-spear-attack';
    attackAnimationDuration: number = 0.6;
    
    @property(Prefab)
    spearPrefab: Prefab = null!; // 长矛预制体
    
    @property({ type: SpriteFrame, override: true })
    attackAnimationFrames: SpriteFrame[] = [];// 攻击动画帧数组
    
    /**
     * 重写攻击方法，使用远程攻击（投掷长矛）
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

        // 保存当前目标，用于攻击动画中途投掷长矛
        const currentTarget = this.currentTarget;
        
        // 设置攻击回调函数，在动画播放中途（约50%处）投掷长矛
        this.attackCallback = () => {
            if (currentTarget && currentTarget.isValid && currentTarget.active) {
                // 使用投掷长矛的方式攻击目标
                this.createSpear(currentTarget);
            } else {
            }
        };

        // 播放攻击动画（使用重写的方法）
        this.playAttackAnimation();
    }
    
    /**
     * 重写播放攻击动画方法，使用动画帧方式，在动画中途调用createSpear
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
        let hasThrownSpear = false; // 标记是否已经投掷长矛
        
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
            
            // 在动画播放到约50%时投掷长矛（只执行一次）
            if (!hasThrownSpear && animationTimer >= this.attackAnimationDuration * 0.5) {
                hasThrownSpear = true;
                if (this.attackCallback) {
                    // 调用攻击回调函数（投掷长矛）
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
     * 创建并投掷长矛
     */
    createSpear(targetNode: Node) {
        
        if (!this.spearPrefab) {
            return;
        }

        // 检查目标是否有效
        if (!targetNode.isValid || !targetNode.active) {
            return;
        }
        
        const targetPos = targetNode.worldPosition;
        const enemyPos = this.node.worldPosition;

        // 创建长矛节点
        const spear = instantiate(this.spearPrefab);
        
        // 设置父节点（添加到场景或Canvas）
        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            spear.setParent(parentNode);
        } else {
            spear.setParent(this.node.parent);
        }

        // 设置初始位置（投矛手位置）
        const startPos = this.node.worldPosition.clone();
        spear.setWorldPosition(startPos);

        // 确保节点激活
        spear.active = true;

        // 获取或添加Arrow组件（因为长矛的逻辑和弓箭类似，使用相同的组件）
        let spearScript = spear.getComponent('Arrow') as any;
        if (!spearScript) {
            // 如果没有Arrow组件，尝试添加
            // 在Cocos Creator中，直接使用组件名称添加
            spearScript = spear.addComponent('Arrow');
            if (!spearScript) {
                return;
            }
        }

        // 播放攻击音效
        if (this.attackSound) {
            AudioManager.Instance.playSFX(this.attackSound);
        }

        // 初始化长矛，设置命中回调
        spearScript.init(
            startPos,
            targetNode,
            this.attackDamage,
            (damage: number) => {
                // 检查目标是否仍然有效
                if (targetNode && targetNode.isValid && targetNode.active) {
                    const towerScript = targetNode.getComponent('Arrower') as any;
                    const warAncientTreeScript = targetNode.getComponent('WarAncientTree') as any;
                    const normalTreeScript = targetNode.getComponent('Tree') as any;
                    const wellScript = targetNode.getComponent('MoonWell') as any;
                    const hallScript = targetNode.getComponent('HunterHall') as any;
                    const swordsmanHallScript = targetNode.getComponent('SwordsmanHall') as any;
                    const crystalScript = targetNode.getComponent('Crystal') as any;
                    const wispScript = targetNode.getComponent('Wisp') as any;
                    const hunterScript = targetNode.getComponent('Hunter') as any;
                    const elfSwordsmanScript = targetNode.getComponent('ElfSwordsman') as any;
                    const stoneWallScript = targetNode.getComponent('StoneWall') as any;
                    const targetScript = towerScript || warAncientTreeScript || normalTreeScript || wellScript || hallScript || swordsmanHallScript || crystalScript || wispScript || hunterScript || elfSwordsmanScript || stoneWallScript;
                    
                    if (targetScript && targetScript.takeDamage) {
                        targetScript.takeDamage(damage);
                        // 根据目标类型输出关键日志
                        if (stoneWallScript) {
                        } else if (crystalScript) {
                        }
                    } else {
                        // 目标无效，清除目标
                        this.currentTarget = null!;
                    }
                }
            }
        );
    }
}
