import { _decorator, SpriteFrame, Prefab, Texture2D, AudioClip, EventTouch, EventMouse, Node, find, instantiate, Sprite, UITransform, Color, Camera, tween, UIOpacity, Vec3, resources, SpriteFrame as CCSpriteFrame } from 'cc';
import { Role } from './Role';
import { UnitInfo } from '../UnitInfoPanel';
import { AudioManager } from '../AudioManager';
import { GamePopup } from '../GamePopup';
import { GameState } from '../GameManager';
import { UnitConfigManager } from '../UnitConfigManager';
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
    attackRange: number = 666; // 索敌范围 666

    @property({ override: true })
    attackDamage: number = 25;

    @property({ override: true })
    attackInterval: number = 1.2;

    @property({ override: true })
    buildCost: number = 0; // 角鹰由兽栏免费训练

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
    moveSpeed: number = 120; // 飞行单位移动速度较快

    @property({ type: SpriteFrame, override: true })
    moveAnimationFrames: SpriteFrame[] = [];

    @property({ override: true })
    moveAnimationDuration: number = 0.3;

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
     * 覆盖父类的移动逻辑，飞行单位可以越过障碍物
     */
    protected moveTowards(targetPos: Vec3, deltaTime: number) {
        if (!this.node || !this.node.isValid) return;

        const currentPos = this.node.worldPosition;
        const direction = new Vec3();
        Vec3.subtract(direction, targetPos, currentPos);
        direction.normalize();

        // 飞行单位直接移动，不需要绕开障碍物
        const moveDistance = this.moveSpeed * deltaTime;
        const newPos = new Vec3(
            currentPos.x + direction.x * moveDistance,
            currentPos.y + direction.y * moveDistance,
            currentPos.z
        );

        this.node.setWorldPosition(newPos);

        // 播放移动动画
        this.playMoveAnimation();
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

    onDestroy() {
        super.onDestroy();
    }
}
