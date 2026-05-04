import { _decorator, Prefab, Node, Vec3, find, instantiate, SpriteFrame, Graphics, Color, Component, director, AudioClip } from 'cc';
import { Enemy } from './Enemy';
import { AudioManager } from '../AudioManager';
import { Arrow } from '../Arrow';
import { PiercingSpearProjectile } from '../PiercingSpearProjectile';

const { ccclass, property } = _decorator;

/** 穿透投矛：预警区域宽、长（像素），投掷延迟（秒） */
const PIERCE_SPEAR_CHANCE = 0.2;
const PIERCE_INDICATOR_WIDTH = 30;
const PIERCE_INDICATOR_LENGTH = 300;
const PIERCE_THROW_DELAY = 2;
const PIERCE_VISUAL_SCALE = 2;
/** 预警条透明度（相对不透明度的 20%，见 docs/节点路径.md Canvas/Background） */
const PIERCE_INDICATOR_ALPHA = Math.round(255 * 0.2);

@ccclass('TrollSpearman')
export class TrollSpearman extends Enemy {
    // 重写父类属性，设置 TrollSpearman 的默认值
    maxHealth: number = 40;
    moveSpeed: number = 55;
    attackDamage: number = 6;
    attackInterval: number = 1.8;
    attackRange: number = 200;
    collisionRadius: number = 2; // 碰撞半径（像素）
    unitName: string = "巨魔投矛手";
    unitDescription: string = "远程攻击的巨魔投矛手，拥有较远的攻击距离，但血量较低。攻击时有概率触发穿透投矛。";
    goldReward: number = 3;
    expReward: number = 3; // 消灭投矛手获得3点经验值
    attackAnimationName: string = 'troll-spear-attack';
    attackAnimationDuration: number = 0.6;

    @property(Prefab)
    spearPrefab: Prefab = null!; // 长矛预制体

    @property({ type: SpriteFrame, override: true })
    attackAnimationFrames: SpriteFrame[] = []; // 攻击动画帧数组

    /**
     * 重写攻击方法，使用远程攻击（投掷长矛）
     */
    attack() {
        if (!this.currentTarget || this.isDestroyed) {
            return;
        }

        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }

        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        this.flipDirection(direction);

        const targetForAttack = this.currentTarget;
        if (PIERCE_SPEAR_CHANCE > 0 && Math.random() < PIERCE_SPEAR_CHANCE && this.spearPrefab) {
            if (this.tryBeginPiercingSpearSkill(targetForAttack)) {
                return;
            }
        }

        const currentTarget = targetForAttack;

        this.attackCallback = () => {
            if (currentTarget && currentTarget.isValid && currentTarget.active) {
                this.createSpear(currentTarget);
            }
        };

        this.playAttackAnimation();
    }

    /**
     * 穿透投矛：20% 触发时已在外层判定。指示线挂在 Canvas/Background 同层且紧随其后（仅压在背景之上，见 docs/节点路径.md）；2 秒后投掷；计时与投矛手生死解耦。
     */
    private tryBeginPiercingSpearSkill(targetNode: Node): boolean {
        const canvas = find('Canvas');
        const schedulerHost = find('Canvas/GameManager')?.getComponent(Component) as Component | null;
        // 必须用常驻组件调度：投矛手死亡后节点销毁，若 schedule 挂在自身会导致投掷被取消
        if (!canvas || !schedulerHost) {
            return false;
        }

        const startW = this.node.worldPosition.clone();
        const targetW = targetNode.worldPosition.clone();
        const dir = new Vec3();
        Vec3.subtract(dir, targetW, startW);
        if (dir.length() < 0.01) {
            return false;
        }
        dir.normalize();
        const endW = new Vec3();
        Vec3.scaleAndAdd(endW, startW, dir, PIERCE_INDICATOR_LENGTH);

        this.stopAllAnimations();
        this.isPlayingAttackAnimation = true;
        if (this.sprite && this.idleAnimationFrames?.length && this.idleAnimationFrames[0]) {
            this.sprite.spriteFrame = this.idleAnimationFrames[0];
        }

        const indicator = new Node('PiercingSpearIndicator');
        const bg = find('Canvas/Background');
        const layerParent = bg?.parent ?? canvas;
        indicator.setParent(layerParent);
        if (bg?.isValid && bg.parent === layerParent) {
            indicator.setSiblingIndex(bg.getSiblingIndex() + 1);
        }
        indicator.setWorldPosition(startW);
        const ang = Math.atan2(dir.y, dir.x) * (180 / Math.PI);
        indicator.setRotationFromEuler(0, 0, ang);
        const g = indicator.addComponent(Graphics);
        g.fillColor = new Color(230, 30, 30, PIERCE_INDICATOR_ALPHA);
        g.rect(0, -PIERCE_INDICATOR_WIDTH / 2, PIERCE_INDICATOR_LENGTH, PIERCE_INDICATOR_WIDTH);
        g.fill();

        const dmg = this.attackDamage;
        const prefab = this.spearPrefab;
        const spearman = this;
        const sfxAtWindUp = this.attackSound;

        schedulerHost.scheduleOnce(() => {
            if (indicator.isValid) {
                indicator.destroy();
            }
            // 起点/终点已在触发时算好；投矛手死后仍掷矛（父节点用 Canvas / 场景）
            spearman.spawnPiercingSpearProjectile(
                startW,
                endW,
                Math.max(0, Math.round(dmg * 2)),
                prefab,
                sfxAtWindUp
            );
            if (spearman.node?.isValid && !spearman.isDestroyed) {
                spearman.isPlayingAttackAnimation = false;
                spearman.playIdleAnimation();
            }
        }, PIERCE_THROW_DELAY);

        return true;
    }

    /**
     * 延迟投掷：投矛手可能已死亡，仅用传入的世界坐标与预制体；父节点不依赖 this.node。
     */
    private spawnPiercingSpearProjectile(
        startW: Vec3,
        endW: Vec3,
        damage: number,
        prefab: Prefab,
        sfxClip?: AudioClip | null
    ) {
        if (!prefab) {
            return;
        }

        let parentNode: Node | null = find('Canvas');
        if (!parentNode?.isValid) {
            const sc = director.getScene();
            if (sc?.isValid) {
                parentNode = sc as unknown as Node;
            }
        }
        if (!parentNode?.isValid) {
            const n = this.node;
            if (n?.isValid) {
                parentNode = (n.scene?.isValid ? (n.scene as unknown as Node) : null) ?? n.parent ?? null;
            }
        }
        if (!parentNode?.isValid) {
            return;
        }

        const spear = instantiate(prefab);
        spear.setParent(parentNode);
        spear.setWorldPosition(startW);
        spear.active = true;

        const arrowComp = spear.getComponent(Arrow);
        if (arrowComp) {
            arrowComp.destroy();
        }
        let script = spear.getComponent(PiercingSpearProjectile);
        if (!script) {
            script = spear.addComponent(PiercingSpearProjectile);
        }
        script.init(startW.clone(), endW.clone(), damage, PIERCE_VISUAL_SCALE);

        const sfx = sfxClip ?? this.attackSound;
        if (sfx) {
            AudioManager.Instance.playSFX(sfx);
        }
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
        const validFrames = this.attackAnimationFrames.filter((frame) => frame != null);
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
                    this.attackCallback();
                }
            }

            // 检查动画是否完成
            if (animationTimer >= this.attackAnimationDuration) {
                if (lastFrameIndex < frameCount - 1 && frames[frameCount - 1]) {
                    this.sprite.spriteFrame = frames[frameCount - 1];
                }
                this.restoreDefaultSprite();
                this.unschedule(animationUpdate);

                this.attackCallback = null;

                this.playIdleAnimation();
                return;
            }

            // 更新到当前帧（只在帧变化时更新）
            if (targetFrameIndex !== lastFrameIndex && targetFrameIndex < frameCount && frames[targetFrameIndex]) {
                this.sprite.spriteFrame = frames[targetFrameIndex];
                lastFrameIndex = targetFrameIndex;
            }
        };

        this.schedule(animationUpdate, 0);
    }

    /**
     * 创建并投掷长矛
     */
    createSpear(targetNode: Node) {
        if (!this.spearPrefab) {
            return;
        }

        if (!targetNode.isValid || !targetNode.active) {
            return;
        }

        const spear = instantiate(this.spearPrefab);

        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            spear.setParent(parentNode);
        }

        const startPos = this.node.worldPosition.clone();
        spear.setWorldPosition(startPos);

        spear.active = true;

        let spearScript = spear.getComponent('Arrow') as any;
        if (!spearScript) {
            spearScript = spear.addComponent('Arrow');
            if (!spearScript) {
                return;
            }
        }

        if (this.attackSound) {
            AudioManager.Instance.playSFX(this.attackSound);
        }

        spearScript.init(
            startPos,
            targetNode,
            this.attackDamage,
            (damage: number, hitDirection: Vec3) => {
                if (targetNode && targetNode.isValid && targetNode.active) {
                    const towerScript = targetNode.getComponent('Arrower') as any;
                    const warAncientTreeScript = targetNode.getComponent('WarAncientTree') as any;
                    const hallScript = targetNode.getComponent('HunterHall') as any;
                    const swordsmanHallScript = targetNode.getComponent('SwordsmanHall') as any;
                    const crystalScript = targetNode.getComponent('Crystal') as any;
                    const hunterScript = targetNode.getComponent('Hunter') as any;
                    const elfSwordsmanScript = targetNode.getComponent('ElfSwordsman') as any;
                    const stoneWallScript = targetNode.getComponent('StoneWall') as any;
                    const eagleScript = targetNode.getComponent('Eagle') as any;
                    const targetScript =
                        towerScript ||
                        warAncientTreeScript ||
                        hallScript ||
                        swordsmanHallScript ||
                        crystalScript ||
                        hunterScript ||
                        elfSwordsmanScript ||
                        stoneWallScript ||
                        eagleScript;

                    if (targetScript && targetScript.takeDamage) {
                        targetScript.takeDamage(damage, hitDirection);
                    } else {
                        this.currentTarget = null!;
                    }
                }
            }
        );
    }
}
