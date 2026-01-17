import { _decorator, SpriteFrame, Prefab, Texture2D, AudioClip, Node, Vec3, find, CCString } from 'cc';
import { Role } from './Role';
import { GameManager, GameState } from '../GameManager';
const { ccclass, property } = _decorator;

@ccclass('Priest')
export class Priest extends Role {
    // 使用父类的攻击/移动字段作为“治疗”参数，以复用通用逻辑
    @property({ override: true })
    maxHealth: number = 60;

    @property({ override: true })
    attackRange: number = 220;   // 实际含义：治疗范围

    @property({ override: true })
    attackDamage: number = 15;   // 实际含义：单次治疗量

    @property({ override: true })
    attackInterval: number = 1.5;

    @property({ type: Prefab, override: true })
    bulletPrefab: Prefab = null!;    // 牧师不发射子弹，仅为兼容保留

    @property({ type: Prefab, override: true })
    arrowPrefab: Prefab = null!;     // 牧师不发射箭，仅为兼容保留

    @property({ type: Prefab, override: true })
    explosionEffect: Prefab = null!;

    @property({ type: Prefab, override: true })
    damageNumberPrefab: Prefab = null!;

    @property({ override: true })
    buildCost: number = 5;

    @property({ override: true })
    level: number = 1;

    // 动画 / 音效（按需要在编辑器里配置）
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
    hitAnimationDuration: number = 0.3;

    @property({ override: true })
    deathAnimationDuration: number = 1.0;

    @property({ override: true })
    moveSpeed: number = 100;

    @property({ type: SpriteFrame, override: true })
    moveAnimationFrames: SpriteFrame[] = [];

    @property({ override: true })
    moveAnimationDuration: number = 0.3;

    @property({ override: true })
    collisionRadius: number = 10;

    @property({ type: SpriteFrame, override: true })
    cardIcon: SpriteFrame = null!;

    // 单位信息
    @property({ override: true })
    unitName: string = '牧师';

    @property({ override: true })
    unitDescription: string = '辅助单位，治疗附近受伤的友军。';

    @property({ type: SpriteFrame, override: true })
    unitIcon: SpriteFrame = null!;
    
    @property({ type: [CCString], override: true, tooltip: "战斗口号数组，牧师的治疗口号" })
    battleSlogans: string[] = ['治疗！治疗！治疗！', '尘归尘！', '圣光指引我!', '愿圣光与你同在！', '慢点打，慢点打！'];

    update(deltaTime: number) {
        if (this.isDestroyed) {
            return;
        }

        // 只更新对话框系统，不调用父类的完整update方法（避免移动和攻击逻辑重复执行）
        this.updateDialogSystem(deltaTime);

        if (!this.gameManager) {
            this.findGameManager();
        }
        if (this.gameManager) {
            const state = this.gameManager.getGameState();
            if (state !== GameState.Playing) {
                // 游戏暂停/结束时不执行寻路与治疗
                this.currentTarget = null!;
                return;
            }
        }

        this.attackTimer += deltaTime;

        // 防御状态下，不进行移动，但仍可治疗
        if (this.isDefending) {
            // 防御状态下，仍然需要查找治疗目标
            this.findHealTarget();
            
            // 防御状态下，只在治疗范围内治疗，不移动
            if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
                const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
                
                if (distance <= this.attackRange) {
                    // 在治疗范围内，执行治疗
                    this.stopMoving();
                    if (this.attackTimer >= this.attackInterval) {
                        this.healCurrentTarget();
                        this.attackTimer = 0;
                    }
                } else {
                    // 不在治疗范围内，停止移动（防御状态下不移动）
                    this.stopMoving();
                }
            } else {
                // 没有目标，停止移动
                this.stopMoving();
            }
            return; // 防御状态下，不执行后续的移动逻辑
        }

        // 先做位置碰撞与推开逻辑，直接复用父类能力
        const currentPos = this.node.worldPosition.clone();
        const hasCollisionNow = this.checkCollisionAtPosition(currentPos);
        if (hasCollisionNow) {
            const pushDir = this.calculatePushAwayDirection(currentPos);
            if (pushDir.length() > 0.1) {
                const pushDistance = this.moveSpeed * deltaTime * 1.5;
                const pushPos = new Vec3();
                Vec3.scaleAndAdd(pushPos, currentPos, pushDir, pushDistance);
                const finalPushPos = this.checkCollisionAndAdjust(currentPos, pushPos);
                this.node.setWorldPosition(finalPushPos);
            }
        }

        // 手动移动优先
        if (this.manualMoveTarget) {
            const distToManual = Vec3.distance(this.node.worldPosition, this.manualMoveTarget);
            if (distToManual <= 10) {
                this.manualMoveTarget = null!;
                this.isManuallyControlled = false;
                this.stopMoving();
            } else {
                this.moveToPosition(this.manualMoveTarget, deltaTime);
                return;
            }
        }

        // 自动寻找治疗目标
        if (!this.manualMoveTarget) {
            this.findHealTarget();
        }

        if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
            const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);

            if (distance <= this.attackRange) {
                // 在治疗范围内
                this.stopMoving();
                if (this.attackTimer >= this.attackInterval) {
                    this.healCurrentTarget();
                    this.attackTimer = 0;
                }
            } else if (distance <= this.attackRange * 2) {
                // 2倍范围内，向友军移动
                this.moveTowardsAlly(deltaTime);
            } else {
                this.stopMoving();
            }
        } else {
            // 没有目标
            this.stopMoving();
        }
    }

    /**
     * 查找最近的受伤友军（弓箭手 / 精灵剑士 / 女猎手 / 牧师），允许治疗自己
     */
    private findHealTarget() {
        const candidates = this.getFriendlyUnits(true, this.attackRange * 2);
        let nearest: Node | null = null;
        let minDist = Infinity;

        for (const node of candidates) {
            const dist = Vec3.distance(this.node.worldPosition, node.worldPosition);
            if (dist < minDist) {
                minDist = dist;
                nearest = node;
            }
        }

        this.currentTarget = nearest as any;
    }

    /**
     * 获取友军列表（包含牧师自身）
     * @param onlyInjured 是否仅获取受伤单位
     * @param maxDistance 最大距离
     */
    private getFriendlyUnits(onlyInjured: boolean, maxDistance: number): Node[] {
        const scene = this.node.scene;
        if (!scene) return [];

        const result: Node[] = [];

        const visit = (node: Node) => {
            if (!node || !node.isValid || !node.active) return;

            // 关心四类友军：弓箭手、女猎手、精灵剑士、牧师（包含自身）
            const arrower = node.getComponent('Arrower') as any;
            const hunter = node.getComponent('Hunter') as any;
            const swordsman = node.getComponent('ElfSwordsman') as any;
            const priest = node.getComponent('Priest') as any;

            const script = arrower || hunter || swordsman || priest;
            if (script) {
                const dist = Vec3.distance(this.node.worldPosition, node.worldPosition);
                if (dist <= maxDistance) {
                    let currentHealth = 0;
                    let maxHealth = 0;

                    if (script.getHealth && typeof script.getHealth === 'function') {
                        currentHealth = script.getHealth();
                    } else if (script.currentHealth !== undefined) {
                        currentHealth = script.currentHealth;
                    }

                    maxHealth = script.maxHealth ?? 0;

                    const injured = maxHealth > 0 && currentHealth < maxHealth;
                    if (!onlyInjured || injured) {
                        result.push(node);
                    }
                }
            }

            for (const child of node.children) {
                visit(child);
            }
        };

        visit(scene);
        return result;
    }

    /**
     * 朝友军移动（不再使用父类针对敌人的 moveTowardsTarget）
     */
    private moveTowardsAlly(deltaTime: number) {
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active || this.isDestroyed) {
            this.stopMoving();
            return;
        }

        const towerPos = this.node.worldPosition.clone();
        const targetPos = this.currentTarget.worldPosition;
        const distance = Vec3.distance(towerPos, targetPos);

        if (distance <= this.attackRange) {
            this.stopMoving();
            return;
        }

        // 使用与父类类似的移动和避障逻辑
        const direction = new Vec3();
        Vec3.subtract(direction, targetPos, towerPos);
        direction.normalize();

        const finalDir = this.calculateAvoidanceDirection(towerPos, direction, deltaTime);

        const moveDistance = this.moveSpeed * deltaTime;
        const newPos = new Vec3();
        Vec3.scaleAndAdd(newPos, towerPos, finalDir, moveDistance);

        const adjustedPos = this.checkCollisionAndAdjust(towerPos, newPos);
        this.node.setWorldPosition(adjustedPos);

        // 根据方向翻转
        if (direction.x < 0) {
            this.node.setScale(-Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
            if (this.healthBarNode && this.healthBarNode.isValid) {
                this.healthBarNode.setScale(-1, 1, 1);
            }
        } else {
            this.node.setScale(Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
            if (this.healthBarNode && this.healthBarNode.isValid) {
                this.healthBarNode.setScale(1, 1, 1);
            }
        }

        if (!this.isMoving) {
            this.isMoving = true;
            this.playMoveAnimation();
        }
    }

    /**
     * 对当前目标执行治疗
     */
    private healCurrentTarget() {
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active || this.isDestroyed) {
            return;
        }

        const targetNode = this.currentTarget;
        const arrower = targetNode.getComponent('Arrower') as any;
        const hunter = targetNode.getComponent('Hunter') as any;
        const swordsman = targetNode.getComponent('ElfSwordsman') as any;
        const priest = targetNode.getComponent('Priest') as any;
        const script = arrower || hunter || swordsman || priest;

        if (!script) {
            this.currentTarget = null!;
            return;
        }

        // 检查是否还活着且未满血
        const isAlive = script.isAlive ? script.isAlive() : (script.currentHealth ?? 1) > 0;
        const maxHealth = script.maxHealth ?? 0;
        let currentHealth = 0;
        if (script.getHealth && typeof script.getHealth === 'function') {
            currentHealth = script.getHealth();
        } else if (script.currentHealth !== undefined) {
            currentHealth = script.currentHealth;
        }

        if (!isAlive || maxHealth <= 0 || currentHealth >= maxHealth) {
            this.currentTarget = null!;
            return;
        }

        // 播放“攻击动画”，在动画完成回调中实际执行治疗
        this.playAttackAnimation(() => {
            const healAmount = this.attackDamage > 0 ? this.attackDamage : 10;
            if (script.heal && typeof script.heal === 'function') {
                script.heal(healAmount);
            }
        });
    }
}


