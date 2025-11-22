import { _decorator, Component, Node, Vec3, Prefab, instantiate, find, Graphics, UITransform, Label, Color, tween, EventTouch, input, Input, resources, Sprite, SpriteFrame, Texture2D } from 'cc';
import { GameManager, GameState } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
import { Arrow } from './Arrow';
const { ccclass, property } = _decorator;

@ccclass('Tower')
export class Tower extends Component {
    @property
    maxHealth: number = 50;

    @property
    attackRange: number = 200;

    @property
    attackDamage: number = 10;

    @property
    attackInterval: number = 1.0;

    @property(Prefab)
    bulletPrefab: Prefab = null!;

    @property(Prefab)
    arrowPrefab: Prefab = null!; // 弓箭预制体（支持后期更新贴图）

    @property(Prefab)
    explosionEffect: Prefab = null!;

    @property(Prefab)
    damageNumberPrefab: Prefab = null!;

    @property
    buildCost: number = 5; // 建造成本（用于回收和升级）
    
    @property
    level: number = 1; // 防御塔等级

    // 攻击动画相关属性
    @property(SpriteFrame)
    attackAnimationFrames: SpriteFrame[] = []; // 攻击动画帧数组（推荐：在编辑器中手动设置）

    @property(Texture2D)
    attackAnimationTexture: Texture2D = null!; // 攻击动画纹理（12帧图片）

    @property
    framesPerRow: number = 12; // 每行帧数（横向排列为12，3x4网格为3，4x3网格为4）

    @property
    totalFrames: number = 12; // 总帧数

    @property
    attackAnimationDuration: number = 0.5; // 攻击动画时长（秒）

    private currentHealth: number = 50;
    private healthBar: HealthBar = null!;
    private healthBarNode: Node = null!;
    private selectionPanel: Node = null!; // 选择面板
    private isDestroyed: boolean = false;
    private attackTimer: number = 0;
    private currentTarget: Node = null!;
    private gameManager: GameManager = null!;
    private sprite: Sprite = null!; // Sprite组件引用
    private defaultSpriteFrame: SpriteFrame = null!; // 默认SpriteFrame（动画结束后恢复）
    private defaultScale: Vec3 = new Vec3(1, 1, 1); // 默认缩放（用于恢复翻转）
    private isPlayingAttackAnimation: boolean = false; // 是否正在播放攻击动画

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        this.currentTarget = null!;
        this.isPlayingAttackAnimation = false;
        
        // 获取Sprite组件
        this.sprite = this.node.getComponent(Sprite);
        if (this.sprite) {
            // 保存默认SpriteFrame
            this.defaultSpriteFrame = this.sprite.spriteFrame;
            // 保存默认缩放
            this.defaultScale = this.node.scale.clone();
            console.log('Tower: Sprite component found, default spriteFrame and scale saved');
        } else {
            console.error('Tower: Sprite component not found! Attack animation will not work.');
        }
        
        // 初始化攻击动画帧
        this.initAttackAnimation();
        
        // 查找游戏管理器
        this.findGameManager();
        
        // 创建血条
        this.createHealthBar();
        
        // 监听点击事件
        this.node.on(Node.EventType.TOUCH_END, this.onTowerClick, this);
        
        console.log('Tower: Started at position:', this.node.worldPosition);
    }

    initAttackAnimation() {
        // 如果已经在编辑器中设置了attackAnimationFrames，直接使用
        if (this.attackAnimationFrames && this.attackAnimationFrames.length > 0) {
            const validFrames = this.attackAnimationFrames.filter(frame => frame != null);
            console.log(`Tower: Using ${validFrames.length} valid frames from attackAnimationFrames array (total: ${this.attackAnimationFrames.length})`);
            if (validFrames.length < this.attackAnimationFrames.length) {
                console.warn(`Tower: Warning - ${this.attackAnimationFrames.length - validFrames.length} frames are null or invalid!`);
            }
            return;
        }

        // 如果没有设置帧数组，尝试从纹理中加载
        if (this.attackAnimationTexture) {
            console.log('Tower: Loading attack animation frames from texture...');
            this.loadFramesFromTexture();
        } else {
            console.warn('Tower: No attack animation frames or texture set. Attack animation will not play.');
        }
    }

    loadFramesFromTexture() {
        // 注意：Cocos Creator中，从Texture2D直接分割SpriteFrame需要手动计算
        // 这里提供一个基础实现，但推荐在编辑器中手动设置SpriteFrame数组
        
        // 如果纹理已导入为SpriteAtlas，应该使用SpriteAtlas的方式
        // 这里假设纹理是单行排列的12帧
        
        if (!this.sprite) {
            console.error('Tower: Sprite component not found!');
            return;
        }

        // 由于Cocos Creator的API限制，从Texture2D直接创建SpriteFrame比较复杂
        // 推荐做法：在编辑器中手动设置attackAnimationFrames数组
        // 或者使用SpriteAtlas资源
        
        console.warn('Tower: Auto-loading frames from texture is not fully supported. Please set attackAnimationFrames array in editor, or use SpriteAtlas.');
    }

    createHealthBar() {
        // 创建血条节点
        this.healthBarNode = new Node('HealthBar');
        this.healthBarNode.setParent(this.node);
        this.healthBarNode.setPosition(0, 30, 0); // 在防御塔上方
        // 确保血条初始缩放为正数（正常朝向）
        this.healthBarNode.setScale(1, 1, 1);
        
        // 添加HealthBar组件
        this.healthBar = this.healthBarNode.addComponent(HealthBar);
        if (this.healthBar) {
            this.healthBar.setMaxHealth(this.maxHealth);
            this.healthBar.setHealth(this.currentHealth);
        }
    }

    findGameManager() {
        // 方法1: 通过节点名称查找
        let gmNode = find('GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager);
            if (this.gameManager) {
                return;
            }
        }
        
        // 方法2: 从场景根节点递归查找GameManager组件
        const scene = this.node.scene;
        if (scene) {
            const findInScene = (node: Node, componentType: any): any => {
                const comp = node.getComponent(componentType);
                if (comp) return comp;
                for (const child of node.children) {
                    const found = findInScene(child, componentType);
                    if (found) return found;
                }
                return null;
            };
            this.gameManager = findInScene(scene, GameManager);
            if (this.gameManager) {
                return;
            }
        }
    }

    update(deltaTime: number) {
        if (this.isDestroyed) {
            return;
        }

        // 检查游戏状态 - 如果GameManager不存在，尝试重新查找
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        // 检查游戏状态，如果不是Playing状态，停止攻击
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                // 游戏已结束，停止攻击
                this.currentTarget = null!;
                return;
            }
        }

        this.attackTimer += deltaTime;

        // 查找目标
        this.findTarget();

        // 攻击目标
        if (this.currentTarget && this.attackTimer >= this.attackInterval) {
            // 再次检查游戏状态，确保游戏仍在进行
            if (this.gameManager && this.gameManager.getGameState() === GameState.Playing) {
                this.attack();
                this.attackTimer = 0;
            }
        }
    }

    findTarget() {
        // 使用递归查找Enemies容器（更可靠）
        const findNodeRecursive = (node: Node, name: string): Node | null => {
            if (node.name === name) {
                return node;
            }
            for (const child of node.children) {
                const found = findNodeRecursive(child, name);
                if (found) return found;
            }
            return null;
        };
        
        const scene = this.node.scene;
        let enemiesNode = find('Enemies');
        
        // 如果直接查找失败，尝试递归查找
        if (!enemiesNode && scene) {
            enemiesNode = findNodeRecursive(scene, 'Enemies');
        }
        
        if (!enemiesNode) {
            // 调试：每60帧输出一次，避免刷屏
            if (Math.random() < 0.016) {
                console.warn('Tower: Enemies container not found!');
            }
            this.currentTarget = null!;
            return;
        }
        
        const enemies = enemiesNode.children || [];
        let nearestEnemy: Node = null!;
        let minDistance = Infinity;

        for (const enemy of enemies) {
            if (enemy && enemy.active && enemy.isValid) {
                const enemyScript = enemy.getComponent('Enemy') as any;
                // 检查敌人是否存活
                if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, enemy.worldPosition);
                    // 在攻击范围内，选择最近的敌人
                    if (distance <= this.attackRange && distance < minDistance) {
                        minDistance = distance;
                        nearestEnemy = enemy;
                    }
                }
            }
        }

        // 如果找到目标，输出调试信息（每60帧一次）
        if (nearestEnemy && Math.random() < 0.016) {
            console.log(`Tower: Found target enemy at distance ${minDistance.toFixed(2)}, attacking!`);
        }

        this.currentTarget = nearestEnemy;
    }

    attack() {
        if (!this.currentTarget || this.isDestroyed) {
            return;
        }

        // 再次检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }

        const enemyScript = this.currentTarget.getComponent('Enemy') as any;
        if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
            // 播放攻击动画，动画完成后才射出弓箭
            console.log('Tower: Attack triggered, playing attack animation...');
            this.playAttackAnimation(() => {
                // 动画播放完成后的回调，在这里创建弓箭
                this.executeAttack();
            });
        } else {
            // 目标已死亡，清除目标
            this.currentTarget = null!;
        }
    }

    executeAttack() {
        // 再次检查目标是否有效
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active || this.isDestroyed) {
            return;
        }

        const enemyScript = this.currentTarget.getComponent('Enemy') as any;
        if (!enemyScript || !enemyScript.isAlive || !enemyScript.isAlive()) {
            this.currentTarget = null!;
            return;
        }

        // 创建弓箭特效（抛物线轨迹）
        if (this.arrowPrefab) {
            this.createArrow();
        } else if (this.bulletPrefab) {
            // 如果没有弓箭预制体，使用旧的子弹系统
            this.createBullet();
        } else {
            // 直接伤害（无特效）
            if (enemyScript.takeDamage) {
                enemyScript.takeDamage(this.attackDamage);
                console.log(`Tower: Attacked enemy, dealt ${this.attackDamage} damage`);
            }
        }
    }

    playAttackAnimation(onComplete?: () => void) {
        // 如果正在播放动画，不重复播放
        if (this.isPlayingAttackAnimation) {
            console.log('Tower: Animation already playing, skipping...');
            return;
        }

        // 如果没有Sprite组件或没有动画帧，直接返回
        if (!this.sprite) {
            console.warn('Tower: Sprite component not found, cannot play attack animation');
            // 尝试重新获取Sprite组件
            this.sprite = this.node.getComponent(Sprite);
            if (!this.sprite) {
                console.error('Tower: Failed to get Sprite component!');
                return;
            }
        }

        // 如果没有设置动画帧，直接返回
        if (!this.attackAnimationFrames || this.attackAnimationFrames.length === 0) {
            console.warn('Tower: Attack animation frames not set, skipping animation');
            console.warn(`Tower: attackAnimationFrames is ${this.attackAnimationFrames ? 'defined but empty' : 'null/undefined'}`);
            return;
        }

        // 检查帧是否有效
        const validFrames = this.attackAnimationFrames.filter(frame => frame != null);
        if (validFrames.length === 0) {
            console.error('Tower: All animation frames are null or invalid!');
            return;
        }

        console.log(`Tower: Starting attack animation with ${validFrames.length} frames, duration: ${this.attackAnimationDuration}s`);

        // 根据敌人位置决定是否翻转
        let shouldFlip = false;
        if (this.currentTarget && this.currentTarget.isValid) {
            const towerPos = this.node.worldPosition;
            const enemyPos = this.currentTarget.worldPosition;
            // 如果敌人在左侧（敌人x < 防御塔x），需要翻转
            shouldFlip = enemyPos.x < towerPos.x;
            
            if (shouldFlip) {
                // 水平翻转：scale.x = -1
                this.node.setScale(-Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
                // 血条需要反向翻转，保持正常朝向
                if (this.healthBarNode && this.healthBarNode.isValid) {
                    const healthBarScale = this.healthBarNode.scale.clone();
                    this.healthBarNode.setScale(-Math.abs(healthBarScale.x), healthBarScale.y, healthBarScale.z);
                }
                console.log('Tower: Enemy on left, flipping attack animation');
            } else {
                // 保持原样：scale.x = 1
                this.node.setScale(Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
                // 血条保持正常朝向
                if (this.healthBarNode && this.healthBarNode.isValid) {
                    const healthBarScale = this.healthBarNode.scale.clone();
                    this.healthBarNode.setScale(Math.abs(healthBarScale.x), healthBarScale.y, healthBarScale.z);
                }
                console.log('Tower: Enemy on right, keeping normal orientation');
            }
        }

        // 标记正在播放动画
        this.isPlayingAttackAnimation = true;

        const frames = validFrames;
        const frameCount = frames.length;
        const frameDuration = this.attackAnimationDuration / frameCount; // 每帧的时长
        let currentFrameIndex = 0;

        console.log(`Tower: Frame duration: ${frameDuration.toFixed(3)}s per frame`);

        // 使用update方法播放动画（更可靠）
        let animationTimer = 0;
        let lastFrameIndex = -1; // 记录上一帧的索引，避免重复设置
        
        // 立即播放第一帧
        if (frames[0]) {
            this.sprite.spriteFrame = frames[0];
            lastFrameIndex = 0;
            console.log(`Tower: Playing frame 1/${frameCount}`);
        }
        
        // 使用update方法逐帧播放
        const animationUpdate = (deltaTime: number) => {
            if (!this.sprite || !this.sprite.isValid || this.isDestroyed) {
                console.warn('Tower: Animation stopped - sprite invalid or tower destroyed');
                this.isPlayingAttackAnimation = false;
                this.unschedule(animationUpdate);
                return;
            }

            animationTimer += deltaTime;
            
            // 计算当前应该显示的帧索引
            const targetFrameIndex = Math.min(Math.floor(animationTimer / frameDuration), frameCount - 1);
            
            // 检查动画是否完成
            if (animationTimer >= this.attackAnimationDuration) {
                // 确保播放最后一帧
                if (lastFrameIndex < frameCount - 1 && frames[frameCount - 1]) {
                    this.sprite.spriteFrame = frames[frameCount - 1];
                    console.log(`Tower: Playing frame ${frameCount}/${frameCount}`);
                }
                // 动画播放完成，恢复默认SpriteFrame
                console.log('Tower: Attack animation completed, restoring default sprite');
                this.restoreDefaultSprite();
                this.unschedule(animationUpdate);
                
                // 调用完成回调（在恢复默认SpriteFrame之后）
                if (onComplete) {
                    onComplete();
                }
                return;
            }
            
            // 更新到当前帧（只在帧变化时更新）
            if (targetFrameIndex !== lastFrameIndex && targetFrameIndex < frameCount && frames[targetFrameIndex]) {
                this.sprite.spriteFrame = frames[targetFrameIndex];
                lastFrameIndex = targetFrameIndex;
                console.log(`Tower: Playing frame ${targetFrameIndex + 1}/${frameCount}`);
            }
        };
        
        // 开始动画更新（每帧更新）
        this.schedule(animationUpdate, 0);
    }

    restoreDefaultSprite() {
        // 恢复默认SpriteFrame
        if (this.sprite && this.sprite.isValid && this.defaultSpriteFrame) {
            this.sprite.spriteFrame = this.defaultSpriteFrame;
        }
        // 恢复默认缩放（取消翻转）
        if (this.node && this.node.isValid) {
            this.node.setScale(this.defaultScale.x, this.defaultScale.y, this.defaultScale.z);
        }
        // 恢复血条的正常朝向
        if (this.healthBarNode && this.healthBarNode.isValid) {
            this.healthBarNode.setScale(1, 1, 1);
        }
        this.isPlayingAttackAnimation = false;
    }

    createLaserEffect(targetPos: Vec3) {
        // 创建激光效果节点
        const laserNode = new Node('Laser');
        
        // 将激光节点添加到Canvas或场景根节点，确保在最上层显示
        const canvas = find('Canvas');
        if (canvas) {
            laserNode.setParent(canvas);
            // 如果添加到Canvas，需要UITransform组件
            const uiTransform = laserNode.addComponent(UITransform);
            if (uiTransform) {
                // 设置足够大的内容区域，确保激光线不会被裁剪
                uiTransform.setContentSize(2000, 2000);
            }
        } else {
            const scene = this.node.scene;
            if (scene) {
                laserNode.setParent(scene);
            } else {
                laserNode.setParent(this.node.parent);
            }
        }
        
        // 设置激光节点的世界位置为防御塔位置
        laserNode.setWorldPosition(this.node.worldPosition);
        
        // 添加Graphics组件用于绘制激光
        const graphics = laserNode.addComponent(Graphics);
        if (graphics) {
            // 设置激光颜色为亮红色，更醒目
            graphics.strokeColor.set(255, 0, 0, 255); // 纯红色，更明显
            graphics.lineWidth = 6; // 加粗，更容易看到
            
            // 计算起点和终点（本地坐标）
            const fromPos = new Vec3(0, 0, 0); // 本地坐标原点
            const toPos = new Vec3();
            // 将目标位置转换为激光节点的本地坐标
            Vec3.subtract(toPos, targetPos, laserNode.worldPosition);
            
            // 绘制激光线
            graphics.moveTo(fromPos.x, fromPos.y);
            graphics.lineTo(toPos.x, toPos.y);
            graphics.stroke();
            
            // 每次攻击都输出日志，方便调试
            console.log(`Tower: Created laser effect from tower at (${this.node.worldPosition.x.toFixed(2)}, ${this.node.worldPosition.y.toFixed(2)}) to enemy at (${targetPos.x.toFixed(2)}, ${targetPos.y.toFixed(2)})`);
            
            // 添加渐隐效果
            const startAlpha = 255;
            const fadeDuration = 0.2; // 稍微延长显示时间
            const fadeTimer = 0.02; // 每帧更新间隔
            
            let elapsed = 0;
            const fadeUpdate = () => {
                elapsed += fadeTimer;
                if (elapsed < fadeDuration && laserNode && laserNode.isValid && graphics) {
                    const alpha = Math.floor(startAlpha * (1 - elapsed / fadeDuration));
                    // Color对象的属性是只读的，需要clone后修改
                    const fadeColor = graphics.strokeColor.clone();
                    fadeColor.a = alpha;
                    graphics.strokeColor = fadeColor;
                    graphics.clear();
                    graphics.moveTo(fromPos.x, fromPos.y);
                    graphics.lineTo(toPos.x, toPos.y);
                    graphics.stroke();
                    this.scheduleOnce(fadeUpdate, fadeTimer);
                } else {
                    // 渐隐完成，销毁节点
                    if (laserNode && laserNode.isValid) {
                        laserNode.destroy();
                    }
                }
            };
            
            // 开始渐隐
            this.scheduleOnce(fadeUpdate, fadeTimer);
            
            // 备用：如果渐隐失败，0.3秒后强制销毁
            this.scheduleOnce(() => {
                if (laserNode && laserNode.isValid) {
                    laserNode.destroy();
                }
            }, 0.3);
        } else {
            console.error('Tower: Failed to add Graphics component to laser node!');
        }
    }

    createArrow() {
        if (!this.arrowPrefab) {
            console.warn('Tower: arrowPrefab is not set!');
            return;
        }

        if (!this.currentTarget) {
            console.warn('Tower: currentTarget is null!');
            return;
        }

        // 检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            console.warn('Tower: currentTarget is invalid or inactive!');
            return;
        }

        console.log(`Tower: Creating arrow, target: ${this.currentTarget.name}, position: ${this.currentTarget.worldPosition}`);

        // 创建弓箭节点
        const arrow = instantiate(this.arrowPrefab);
        
        // 设置父节点（添加到场景或Canvas）
        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            arrow.setParent(parentNode);
            console.log(`Tower: Arrow parent set to ${parentNode.name}`);
        } else {
            arrow.setParent(this.node.parent);
            console.log(`Tower: Arrow parent set to tower parent`);
        }

        // 设置初始位置（防御塔位置）
        const startPos = this.node.worldPosition.clone();
        arrow.setWorldPosition(startPos);
        console.log(`Tower: Arrow initial position: (${startPos.x.toFixed(2)}, ${startPos.y.toFixed(2)})`);

        // 确保节点激活
        arrow.active = true;

        // 获取或添加Arrow组件
        let arrowScript = arrow.getComponent(Arrow);
        if (!arrowScript) {
            console.log('Tower: Arrow component not found, adding it...');
            arrowScript = arrow.addComponent(Arrow);
        } else {
            console.log('Tower: Arrow component found');
        }

        // 初始化弓箭，设置命中回调
        console.log(`Tower: Initializing arrow with damage: ${this.attackDamage}`);
        arrowScript.init(
            startPos,
            this.currentTarget,
            this.attackDamage,
            (damage: number) => {
                // 命中目标时造成伤害
                console.log(`Tower: Arrow hit callback called with damage: ${damage}`);
                const enemyScript = this.currentTarget?.getComponent('Enemy') as any;
                if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
                    if (enemyScript.takeDamage) {
                        enemyScript.takeDamage(damage);
                        console.log(`Tower: Arrow hit enemy, dealt ${damage} damage`);
                    }
                }
            }
        );
    }

    createBullet() {
        if (!this.bulletPrefab || !this.currentTarget) {
            return;
        }

        const bullet = instantiate(this.bulletPrefab);
        bullet.setParent(this.node.parent);
        bullet.setWorldPosition(this.node.worldPosition);

        // 简单的子弹移动逻辑（可以创建Bullet脚本）
        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        direction.normalize();

        // 直接造成伤害（简化处理）
        const enemyScript = this.currentTarget.getComponent('Enemy') as any;
        if (enemyScript && enemyScript.takeDamage) {
            enemyScript.takeDamage(this.attackDamage);
        }

        // 销毁子弹
        this.scheduleOnce(() => {
            if (bullet && bullet.isValid) {
                bullet.destroy();
            }
        }, 0.1);
    }

    takeDamage(damage: number) {
        if (this.isDestroyed) {
            return;
        }

        // 显示伤害数字
        this.showDamageNumber(damage);

        this.currentHealth -= damage;

        // 更新血条
        if (this.healthBar) {
            this.healthBar.setHealth(this.currentHealth);
        }

        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.destroyTower();
        }
    }

    showDamageNumber(damage: number) {
        // 创建伤害数字节点
        let damageNode: Node;
        if (this.damageNumberPrefab) {
            damageNode = instantiate(this.damageNumberPrefab);
        } else {
            // 如果没有预制体，创建简单的Label节点
            damageNode = new Node('DamageNumber');
            const label = damageNode.addComponent(Label);
            label.string = `-${Math.floor(damage)}`;
            label.fontSize = 20;
            label.color = Color.WHITE;
        }
        
        // 添加到Canvas或场景
        const canvas = find('Canvas');
        if (canvas) {
            damageNode.setParent(canvas);
        } else {
            damageNode.setParent(this.node.scene);
        }
        
        // 设置位置（在防御塔上方）
        damageNode.setWorldPosition(this.node.worldPosition.clone().add3f(0, 30, 0));
        
        // 如果有DamageNumber组件，设置伤害值
        const damageScript = damageNode.getComponent(DamageNumber);
        if (damageScript) {
            damageScript.setDamage(damage);
        } else {
            // 如果没有组件，手动添加动画
            const label = damageNode.getComponent(Label);
            if (label) {
                const startPos = damageNode.position.clone();
                const endPos = startPos.clone();
                endPos.y += 50;
                
                tween(damageNode)
                    .to(1.0, { position: endPos })
                    .parallel(
                        tween().to(1.0, {}, {
                            onUpdate: (target, ratio) => {
                                const color = label.color.clone();
                                color.a = 255 * (1 - ratio);
                                label.color = color;
                            }
                        })
                    )
                    .call(() => {
                        if (damageNode && damageNode.isValid) {
                            damageNode.destroy();
                        }
                    })
                    .start();
            }
        }
    }

    destroyTower() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;

        // 移除点击事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onTowerClick, this);

        // 隐藏选择面板
        this.hideSelectionPanel();

        // 触发爆炸效果
        let explosionPrefab = this.explosionEffect;
        
        // 如果explosionEffect未设置，尝试从资源中加载
        if (!explosionPrefab) {
            console.warn('Tower: explosionEffect prefab is not set, trying to load from resources...');
            // 尝试从resources/prefabs加载Explosion预制体
            resources.load('prefabs/Explosion', Prefab, (err, prefab) => {
                if (err) {
                    console.error('Tower: Failed to load Explosion prefab from resources:', err);
                    return;
                }
                explosionPrefab = prefab;
                this.createExplosionEffect(explosionPrefab);
            });
            return;
        }
        
        this.createExplosionEffect(explosionPrefab);
    }

    private createExplosionEffect(explosionPrefab: Prefab) {
        if (!explosionPrefab) {
            console.error('Tower: Cannot create explosion effect, prefab is null!');
            return;
        }

        console.log('Tower: Creating explosion effect at position:', this.node.worldPosition);
        const explosion = instantiate(explosionPrefab);
        
        // 确保节点激活
        explosion.active = true;
        
        // 先设置父节点和位置（使用场景根节点或Canvas，确保不会被防御塔销毁影响）
        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            explosion.setParent(parentNode);
            explosion.setWorldPosition(this.node.worldPosition);
            console.log('Tower: Explosion effect parent set, position:', explosion.worldPosition);
        } else {
            console.error('Tower: Cannot find parent node for explosion effect!');
            explosion.destroy();
            return;
        }
        
        // 立即设置缩放为0，确保不会显示在屏幕中央
        explosion.setScale(0, 0, 1);
        
        // 检查ExplosionEffect组件是否存在
        const explosionScript = explosion.getComponent('ExplosionEffect');
        if (explosionScript) {
            console.log('Tower: ExplosionEffect component found, animation should start automatically');
        } else {
            console.warn('Tower: ExplosionEffect component not found on explosion prefab!');
        }

        // 延迟销毁爆炸效果节点（动画完成后，ExplosionEffect会自动销毁，这里作为备用）
        this.scheduleOnce(() => {
            if (explosion && explosion.isValid) {
                console.log('Tower: Cleaning up explosion effect');
                explosion.destroy();
            }
        }, 2.0); // 延长到2秒，确保动画完成

        // 销毁血条节点
        if (this.healthBarNode && this.healthBarNode.isValid) {
            this.healthBarNode.destroy();
        }

        // 真正销毁防御塔节点
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }, 0.1); // 延迟一小段时间，确保爆炸效果已创建
    }

    getHealth(): number {
        return this.currentHealth;
    }

    isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }

    onTowerClick(event: EventTouch) {
        // 如果游戏已结束，不显示选择面板
        if (this.gameManager && this.gameManager.getGameState() !== GameState.Playing) {
            return;
        }

        // 阻止事件冒泡
        event.propagationStopped = true;

        // 如果已有选择面板，先关闭
        if (this.selectionPanel) {
            this.hideSelectionPanel();
            return;
        }

        // 显示选择面板
        this.showSelectionPanel();
    }

    showSelectionPanel() {
        // 创建选择面板
        const canvas = find('Canvas');
        if (!canvas) return;

        this.selectionPanel = new Node('TowerSelectionPanel');
        this.selectionPanel.setParent(canvas);

        // 添加UITransform
        const uiTransform = this.selectionPanel.addComponent(UITransform);
        uiTransform.setContentSize(120, 40);

        // 设置位置（在防御塔上方）
        const worldPos = this.node.worldPosition.clone();
        worldPos.y += 50;
        this.selectionPanel.setWorldPosition(worldPos);

        // 添加半透明背景
        const graphics = this.selectionPanel.addComponent(Graphics);
        graphics.fillColor = new Color(0, 0, 0, 180); // 半透明黑色
        graphics.rect(-60, -20, 120, 40);
        graphics.fill();

        // 创建回收按钮
        const sellBtn = new Node('SellButton');
        sellBtn.setParent(this.selectionPanel);
        const sellBtnTransform = sellBtn.addComponent(UITransform);
        sellBtnTransform.setContentSize(50, 30);
        sellBtn.setPosition(-35, 0);

        const sellLabel = sellBtn.addComponent(Label);
        sellLabel.string = '回收';
        sellLabel.fontSize = 16;
        sellLabel.color = Color.WHITE;

        // 创建升级按钮
        const upgradeBtn = new Node('UpgradeButton');
        upgradeBtn.setParent(this.selectionPanel);
        const upgradeBtnTransform = upgradeBtn.addComponent(UITransform);
        upgradeBtnTransform.setContentSize(50, 30);
        upgradeBtn.setPosition(35, 0);

        const upgradeLabel = upgradeBtn.addComponent(Label);
        upgradeLabel.string = '升级';
        upgradeLabel.fontSize = 16;
        upgradeLabel.color = Color.WHITE;

        // 添加按钮点击事件
        sellBtn.on(Node.EventType.TOUCH_END, this.onSellClick, this);
        upgradeBtn.on(Node.EventType.TOUCH_END, this.onUpgradeClick, this);

        // 点击其他地方关闭面板
        this.scheduleOnce(() => {
            if (canvas) {
                canvas.once(Node.EventType.TOUCH_END, this.hideSelectionPanel, this);
            }
        }, 0.1);
    }

    hideSelectionPanel() {
        if (this.selectionPanel && this.selectionPanel.isValid) {
            this.selectionPanel.destroy();
            this.selectionPanel = null!;
        }
    }

    onSellClick(event: EventTouch) {
        event.propagationStopped = true;
        
        if (!this.gameManager) {
            this.findGameManager();
        }

        if (this.gameManager) {
            // 回收80%金币
            const refund = Math.floor(this.buildCost * 0.8);
            this.gameManager.addGold(refund);
            console.log(`Tower: Sold, refunded ${refund} gold`);
        }

        // 隐藏面板
        this.hideSelectionPanel();
        
        // 销毁防御塔（会真正从场景中移除）
        this.destroyTower();
    }

    onUpgradeClick(event: EventTouch) {
        event.propagationStopped = true;
        
        if (!this.gameManager) {
            this.findGameManager();
        }

        if (!this.gameManager) {
            return;
        }

        // 升级成本是建造成本的2倍
        const upgradeCost = this.buildCost * 2;
        
        if (!this.gameManager.canAfford(upgradeCost)) {
            console.log(`Tower: Not enough gold for upgrade! Need ${upgradeCost}, have ${this.gameManager.getGold()}`);
            return;
        }

        // 消耗金币
        this.gameManager.spendGold(upgradeCost);

        // 升级防御塔
        this.level++;
        this.attackDamage = Math.floor(this.attackDamage * 1.5); // 攻击力增加50%
        this.attackInterval = this.attackInterval / 1.5; // 攻击速度增加50%（间隔减少）

        console.log(`Tower: Upgraded to level ${this.level}, damage: ${this.attackDamage}, interval: ${this.attackInterval.toFixed(2)}`);

        // 隐藏面板
        this.hideSelectionPanel();
    }
}

