import { _decorator, SpriteFrame, Prefab, Texture2D, AudioClip, EventTouch, EventMouse, Node, find, instantiate, Sprite, UITransform, Color, Camera, tween, UIOpacity, Vec3, resources, SpriteFrame as CCSpriteFrame } from 'cc';
import { Role } from './Role';
import { UnitInfo } from '../UnitInfoPanel';
import { AudioManager } from '../AudioManager';
import { GamePopup } from '../GamePopup';
import { GameState } from '../GameManager';
import { UnitConfigManager } from '../UnitConfigManager';
import { UnitPool } from '../UnitPool';
const { ccclass, property } = _decorator;

/**
 * 角鹰 - 空中飞行单位
 * 特点：
 * - 空中飞行单位（不占人口）
 * - 近战攻击
 * - 有幼年期和完全体两种形态
 * - 幼年期需要 10 秒成长为完全体
 */
@ccclass('Eagle')
export class Eagle extends Role {
    @property({ override: true })
    maxHealth: number = 80;

    @property({ override: true })
    attackRange: number = 70; // 攻击距离 70

    @property({ override: true })
    attackDamage: number = 25;

    @property({ override: true })
    attackInterval: number = 1.2;

    @property({ override: true })
    buildCost: number = 0; // 角鹰由兽栏免费训练

    @property({ override: true })
    populationCost: number = 0; // 角鹰不占用人口

    @property({ override: true })
    level: number = 1;

    @property({ override: true })
    unitName: string = "角鹰";

    @property({ override: true })
    unitDescription: string = "空中飞行单位，拥有强大的攻击能力。";

    @property({ type: SpriteFrame, override: true })
    attackAnimationFrames: SpriteFrame[] = [];

    @property({ type: SpriteFrame, override: true })
    hitAnimationFrames: SpriteFrame[] = [];

    @property({ type: SpriteFrame, override: true })
    deathAnimationFrames: SpriteFrame[] = [];

    @property({ type: AudioClip, override: true })
    shootSound: AudioClip = null!;

    @property({ type: AudioClip, override: true })
    hitSound: AudioClip = null!;

    @property({ type: Texture2D, override: true })
    attackAnimationTexture: Texture2D = null!;

    @property({ override: true })
    framesPerRow: number = 12;

    @property({ override: true })
    totalFrames: number = 12;

    @property({ override: true })
    attackAnimationDuration: number = 0.5;

    @property({ override: true })
    hitAnimationDuration: number = 0.5; // 受击动画时长

    @property({ override: true })
    deathAnimationDuration: number = 1.0; // 死亡动画时长

    @property({ override: true })
    moveSpeed: number = 120; // 飞行单位移动速度较快

    @property({ type: SpriteFrame, override: true })
    moveAnimationFrames: SpriteFrame[] = [];

    @property({ override: true })
    moveAnimationDuration: number = 2.0; // 移动动画 2 秒播放完 9 帧

    @property({ override: true })
    collisionRadius: number = 15;

    @property({ type: SpriteFrame, override: true })
    cardIcon: SpriteFrame = null!;

    // 飞行单位标志
    @property({ visible: false })
    isFlying: boolean = true; // 角鹰是飞行单位

    // 幼年期和完全体贴图
    @property(SpriteFrame)
    juvenileSprite: SpriteFrame = null!; // 幼年期角鹰贴图

    @property(SpriteFrame)
    adultSprite: SpriteFrame = null!; // 完全体角鹰贴图

    // 当前是否为幼年期
    private isJuvenile: boolean = true;

    start() {
        super.start();
        // 默认幼年期
        this.isJuvenile = true;
        this.updateSprite();

        // 确保动画持续时间设置正确（如果预制体中为 0，则使用默认值）
        if (this.hitAnimationDuration <= 0) {
            this.hitAnimationDuration = 0.5; // 10 帧，0.5 秒
        }
        if (this.deathAnimationDuration <= 0) {
            this.deathAnimationDuration = 1.0; // 10 帧，1.0 秒
        }

        // 刷新血条缩放，确保血条不随面向变化
        this.refreshOverheadNodesScale();
    }

    update(deltaTime: number) {
        super.update(deltaTime);
    }

    /**
     * 设置角鹰是否为幼年期
     * @param juvenile true-幼年期，false-完全体
     */
    public setJuvenile(juvenile: boolean) {
        this.isJuvenile = juvenile;
        this.updateSprite();
    }

    /**
     * 更新角鹰贴图
     */
    private updateSprite() {
        const sprite = this.node.getComponent(Sprite);
        if (!sprite) return;

        if (this.isJuvenile) {
            // 幼年期
            if (this.juvenileSprite) {
                sprite.spriteFrame = this.juvenileSprite;
            }
        } else {
            // 完全体
            if (this.adultSprite) {
                sprite.spriteFrame = this.adultSprite;
            }
        }
    }

    protected getUnitInfo(): UnitInfo | null {
        return {
            name: this.isJuvenile ? '角鹰（幼年）' : '角鹰',
            level: this.level,
            currentHealth: this.currentHealth,
            maxHealth: this.maxHealth,
            attackDamage: this.attackDamage,
            populationCost: 0, // 角鹰不占用人口
            icon: this.cardIcon || this.defaultSpriteFrame,
            collisionRadius: this.collisionRadius,
            attackRange: this.attackRange,
            moveSpeed: this.moveSpeed,
            isFlying: true // 飞行单位
        };
    }

    /**
     * 覆盖父类的索敌范围，角鹰的索敌范围为 444
     */
    protected getDetectionRange(): number {
        return 444;
    }

    /**
     * 覆盖父类的移动范围，角鹰的移动范围与索敌范围一致（444）
     */
    protected getMovementRange(): number {
        return 444;
    }

    /**
     * 覆盖父类的移动逻辑，飞行单位可以越过障碍物
     */
    protected moveTowards(targetPos: Vec3, deltaTime: number) {
        if (!this.node || !this.node.isValid) return;

        const currentPos = this.node.worldPosition;
        const direction = new Vec3();
        Vec3.subtract(direction, targetPos, currentPos);
        direction.normalize();

        // 飞行单位不需要绕开地面障碍，但仍需检查与其他角鹰的碰撞
        const moveDistance = this.moveSpeed * deltaTime;
        const newPos = new Vec3(
            currentPos.x + direction.x * moveDistance,
            currentPos.y + direction.y * moveDistance,
            currentPos.z
        );

        // 检查碰撞并调整位置（主要是避免与其他角鹰碰撞）
        const adjustedPos = this.checkCollisionAndAdjust(currentPos, newPos);
        this.node.setWorldPosition(adjustedPos);

        // 根据移动方向翻转
        if (direction.x < 0) {
            this.node.setScale(-Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
        } else {
            this.node.setScale(Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
        }
        // 血条不需要跟随翻转，调用 refreshOverheadNodesScale 更新血条缩放
        this.refreshOverheadNodesScale();

        // 播放移动动画
        this.playMoveAnimation();
    }

    /**
     * 覆盖父类的手动移动逻辑，飞行单位可以越过障碍物
     */
    override moveToPosition(targetPos: Vec3, deltaTime: number) {
        if (this.isDestroyed) {
            return;
        }

        const currentPos = this.node.worldPosition;
        const dx = targetPos.x - currentPos.x;
        const dy = targetPos.y - currentPos.y;
        const distanceSq = dx * dx + dy * dy;

        // 如果已经到达目标位置，停止移动
        if (distanceSq <= 100) {
            this.stopMoving();
            return;
        }

        // 设置移动状态
        this.isMoving = true;

        // 飞行单位不需要检查地面障碍，但仍需检查与其他角鹰的碰撞
        const direction = new Vec3();
        Vec3.subtract(direction, targetPos, currentPos);
        direction.normalize();

        const moveDistance = this.moveSpeed * deltaTime;
        const newPos = new Vec3(
            currentPos.x + direction.x * moveDistance,
            currentPos.y + direction.y * moveDistance,
            currentPos.z
        );

        // 检查碰撞并调整位置（主要是避免与其他角鹰碰撞）
        const adjustedPos = this.checkCollisionAndAdjust(currentPos, newPos);

        this.node.setWorldPosition(adjustedPos);

        // 根据移动方向翻转
        if (direction.x < 0) {
            this.node.setScale(-Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
        } else {
            this.node.setScale(Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
        }

        // 血条不需要跟随翻转，调用 refreshOverheadNodesScale 更新血条缩放
        this.refreshOverheadNodesScale();

        // 播放移动动画
        this.playMoveAnimation();
    }

    /**
     * 覆盖父类的碰撞检测逻辑，飞行单位只与其他角鹰碰撞
     */
    override checkCollisionAtPosition(position: Vec3): boolean {
        // 角鹰作为飞行单位，只与其他角鹰有碰撞，与其他单位无碰撞
        if (this.unitManager) {
            const eagles = this.unitManager.getEagles();
            for (const eagle of eagles) {
                if (eagle && eagle.isValid && eagle.active && eagle !== this.node) {
                    const eaglePos = eagle.worldPosition;
                    const dx = position.x - eaglePos.x;
                    const dy = position.y - eaglePos.y;
                    const distanceSq = dx * dx + dy * dy;

                    const otherEagleScript = eagle.getComponent('Eagle') as any;
                    const otherRadius = otherEagleScript?.collisionRadius ?? this.collisionRadius;
                    const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                    const minDistanceSq = minDistance * minDistance;

                    if (distanceSq < minDistanceSq) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * 覆盖血条缩放方法，使血条不随面向变化（飞行单位血条始终朝上）
     * 原理：当父节点翻转时，血条需要反向翻转来抵消
     */
    protected refreshOverheadNodesScale() {
        // 血条/蓝条需要反向抵消父节点的翻转
        // 当父节点 scale.x = -1（向左）时，血条需要 scale.x = -1 来抵消，最终显示为 1（正常）
        // 当父节点 scale.x = 1（向右）时，血条需要 scale.x = 1，最终显示为 1（正常）
        const parentScaleX = this.node.scale.x;
        const overheadScaleX = parentScaleX < 0 ? -1 : 1; // 与父节点同向，抵消翻转

        // 第三段待机动画拉宽 50% 时，对血条/对话框做反向补偿，保持它们宽度不变
        const isWideIdle = this.currentIdleAnimationSegmentIndex === 2 && this.isPlayingIdleAnimation;
        const wideIdleCompensationX = isWideIdle ? 1 / 1.5 : 1;

        // 血条/蓝条保持固定朝向（抵消父节点翻转）
        if (this.healthBarNode && this.healthBarNode.isValid) {
            this.healthBarNode.setScale(overheadScaleX * wideIdleCompensationX, 1, 1);
        }
        // 蓝条和血条保持一致的朝向
        if (this.manaBarNode && this.manaBarNode.isValid) {
            this.manaBarNode.setScale(overheadScaleX * wideIdleCompensationX, 1, 1);
        }
    }

    /**
     * 覆盖死亡逻辑，角鹰死亡不扣除人口
     */
    protected onDeath() {
        // 角鹰不占用人口，死亡时不需要回退人口
        // 调用父类的其他死亡逻辑（播放动画等）
        const roleScript = this.node.getComponent('Role') as any;
        if (roleScript && roleScript.playDeathAnimation) {
            roleScript.playDeathAnimation();
        }
    }

    /**
     * 覆盖销毁方法，角鹰死亡不释放人口
     */
    override destroyTower() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;

        // 清理对话框（使用父类的 protected 方法）
        this.cleanupDialog();

        // 播放死亡动画
        this.playDeathAnimation();

        // 角鹰不占用人口，死亡时不需要回退人口
        // 不调用 gameManager.removePopulation(1)

        // 移除点击事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onTowerClick, this);

        // 隐藏选择面板（会移除全局触摸监听）
        this.hideSelectionPanel();

        // 清除手动移动目标
        this.manualMoveTarget = null!;
        this.isManuallyControlled = false;

        // 移除高亮效果
        this.removeHighlight();

        // 性能优化：使用对象池回收单位，而不是直接销毁
        const returnToPool = () => {
            const unitPool = UnitPool.getInstance();
            if (unitPool && this.node && this.node.isValid) {
                // 重置单位状态（在返回对象池前）
                this.resetRoleState();
                // 返回到对象池
                unitPool.release(this.node, this.prefabName);
            } else {
                // 如果对象池不存在，直接销毁
                if (this.node && this.node.isValid) {
                    this.node.destroy();
                }
            }
        };

        // 延迟返回对象池，等待死亡动画播放完成
        if (this.deathAnimationDuration > 0) {
            this.scheduleOnce(returnToPool, this.deathAnimationDuration);
        } else {
            returnToPool();
        }
    }
}