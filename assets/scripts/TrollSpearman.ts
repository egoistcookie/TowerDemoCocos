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
        console.debug(`[TrollSpearman] attack: 开始攻击，currentTarget=${this.currentTarget ? '存在' : 'null'}, isDestroyed=${this.isDestroyed}`);
        
        if (!this.currentTarget || this.isDestroyed) {
            console.debug(`[TrollSpearman] attack: 无目标或已销毁，退出`);
            return;
        }

        // 再次检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            console.debug(`[TrollSpearman] attack: 目标无效，清除目标`);
            this.currentTarget = null!;
            return;
        }

        const targetPos = this.currentTarget.worldPosition;
        const enemyPos = this.node.worldPosition;
        const distance = Vec3.distance(enemyPos, targetPos);
        console.debug(`[TrollSpearman] attack: 目标有效，位置=(${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)}), 距离=${distance.toFixed(1)}, 攻击范围=${this.attackRange}`);

        // 攻击时朝向目标方向
        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        this.flipDirection(direction);

        // 保存当前目标，用于攻击动画中途投掷长矛
        const currentTarget = this.currentTarget;
        
        // 设置攻击回调函数，在动画播放中途（约50%处）投掷长矛
        this.attackCallback = () => {
            console.debug(`[TrollSpearman] attackCallback: 攻击回调被调用，准备投掷长矛`);
            if (currentTarget && currentTarget.isValid && currentTarget.active) {
                // 使用投掷长矛的方式攻击目标
                this.createSpear(currentTarget);
            } else {
                console.debug(`[TrollSpearman] attackCallback: 目标已无效，取消投掷`);
            }
        };

        // 播放攻击动画（使用重写的方法）
        console.debug(`[TrollSpearman] attack: 调用playAttackAnimation`);
        this.playAttackAnimation();
    }
    
    /**
     * 重写播放攻击动画方法，使用动画帧方式，在动画中途调用createSpear
     */
    playAttackAnimation() {
        console.debug(`[TrollSpearman] playAttackAnimation: 开始，isPlayingDeathAnimation=${this.isPlayingDeathAnimation}, isDestroyed=${this.isDestroyed}`);
        
        if (this.isPlayingDeathAnimation || this.isDestroyed) {
            return;
        }

        // 如果正在播放动画，不重复播放
        if (this.isPlayingAttackAnimation) {
            return;
        }

        // 如果没有Sprite组件或没有动画帧，直接返回
        if (!this.sprite) {
            console.debug(`[TrollSpearman] playAttackAnimation: 错误！没有Sprite组件`);
            return;
        }

        // 如果没有设置动画帧，直接返回
        if (!this.attackAnimationFrames || this.attackAnimationFrames.length === 0) {
            console.debug(`[TrollSpearman] playAttackAnimation: 错误！没有配置攻击动画帧`);
            return;
        }

        // 检查帧是否有效
        const validFrames = this.attackAnimationFrames.filter(frame => frame != null);
        if (validFrames.length === 0) {
            console.debug(`[TrollSpearman] playAttackAnimation: 错误！所有动画帧都无效`);
            return;
        }

        // 停止所有动画
        this.stopAllAnimations();
        
        // 标记正在播放动画
        this.isPlayingAttackAnimation = true;
        
        console.debug(`[TrollSpearman] playAttackAnimation: 开始播放动画帧，帧数=${validFrames.length}, 动画时长=${this.attackAnimationDuration}`);

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
                console.debug(`[TrollSpearman] playAttackAnimation: 动画播放到50%，触发投掷长矛，attackCallback=${this.attackCallback ? '存在' : 'null'}`);
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
        console.debug(`[TrollSpearman] createSpear: 开始创建长矛，spearPrefab=${this.spearPrefab ? '存在' : 'null'}, targetNode=${targetNode ? '存在' : 'null'}`);
        
        if (!this.spearPrefab) {
            console.debug(`[TrollSpearman] createSpear: 错误！长矛预制体未配置`);
            return;
        }

        // 检查目标是否有效
        if (!targetNode.isValid || !targetNode.active) {
            console.debug(`[TrollSpearman] createSpear: 目标无效，取消创建`);
            return;
        }
        
        const targetPos = targetNode.worldPosition;
        const enemyPos = this.node.worldPosition;
        console.debug(`[TrollSpearman] createSpear: 目标有效，目标位置=(${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)}), 敌人位置=(${enemyPos.x.toFixed(1)}, ${enemyPos.y.toFixed(1)}), 伤害=${this.attackDamage}`);

        // 创建长矛节点
        const spear = instantiate(this.spearPrefab);
        console.debug(`[TrollSpearman] createSpear: 长矛节点已创建`);
        
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
        console.debug(`[TrollSpearman] createSpear: 长矛位置设置完成，位置=(${startPos.x.toFixed(1)}, ${startPos.y.toFixed(1)})`);

        // 确保节点激活
        spear.active = true;

        // 获取或添加Arrow组件（因为长矛的逻辑和弓箭类似，使用相同的组件）
        let spearScript = spear.getComponent('Arrow') as any;
        if (!spearScript) {
            // 如果没有Arrow组件，尝试添加
            // 在Cocos Creator中，直接使用组件名称添加
            spearScript = spear.addComponent('Arrow');
            if (!spearScript) {
                console.debug(`[TrollSpearman] createSpear: 错误！无法添加Arrow组件`);
                return;
            }
        }
        console.debug(`[TrollSpearman] createSpear: Arrow组件已获取，准备初始化`);

        // 播放攻击音效
        if (this.attackSound) {
            AudioManager.Instance.playSFX(this.attackSound);
        }

        // 初始化长矛，设置命中回调
        console.debug(`[TrollSpearman] createSpear: 调用spearScript.init`);
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
                            console.debug(`[TrollSpearman] createSpear: 攻击石墙，造成 ${damage} 点伤害`);
                        } else if (crystalScript) {
                            console.debug(`[TrollSpearman] createSpear: 攻击水晶，造成 ${damage} 点伤害`);
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
