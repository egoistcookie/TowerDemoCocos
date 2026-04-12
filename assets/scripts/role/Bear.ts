import { _decorator, Node, Vec3, find, EventTouch } from 'cc';
import { Role } from './Role';
import { UnitManager } from '../UnitManager';
import { UnitType } from '../UnitType';
import { GameState } from '../GameState';
import { UnitInfoPanel } from '../UnitInfoPanel';
const { ccclass, property } = _decorator;

// 巨熊状态枚举
enum BearState {
    Neutral = 0,    // 中立状态（攻击所有单位）
    Tamed = 1,      // 归顺我方（只攻击敌人）
    Returning = 2   // 返回兽穴中
}

// ============================================================================
// 性能优化：预计算避让角度的 sin/cos 值，避免每帧重复计算三角函数
// 优化前：每帧计算 8-40 次 Math.cos/sin
// 优化后：文件加载时计算一次，之后查表
// ============================================================================
const OFFSET_ANGLES = [60, -60, 90, -90];
const OFFSET_COS: number[] = [];
const OFFSET_SIN: number[] = [];
(function() {
    for (const angle of OFFSET_ANGLES) {
        const rad = angle * Math.PI / 180;
        OFFSET_COS.push(Math.cos(rad));
        OFFSET_SIN.push(Math.sin(rad));
    }
})();

@ccclass('Bear')
export class Bear extends Role {
    // 性能优化：复用的 Vec3 对象，避免每帧创建新对象产生 GC 压力
    private bearTempVec3: Vec3 = new Vec3();

    // 巨熊属性
    @property
    maxHealth: number = 1000;

    @property
    attackDamage: number = 15; // 原为 30，降低为一半

    @property
    attackRange: number = 60;

    @property
    attackInterval: number = 1.5;

    @property
    moveSpeed: number = 80;

    // 返回兽穴相关
    @property
    returnDistance: number = 400;

    // 韧性（0-1）：1 秒内遭受此百分比血量损失才会触发僵直
    @property({ tooltip: "韧性（0-1）：1 秒内遭受此百分比血量损失才会触发僵直。0.2 表示需要承受 20% 最大生命值的伤害才会播放受击动画" })
    tenacity: number = 0.2;

    // 兽穴引用
    private beastDenNode: Node = null!;
    private beastDenScript: any = null!;

    // 状态相关
    private bearState: BearState = BearState.Neutral;
    protected unitManager: UnitManager = null!;
    private isDead: boolean = false; // 死亡状态标记

    // 韧性相关
    private damageInWindow: number = 0; // 1 秒内累积的伤害
    private damageWindowTimer: number = 0; // 伤害窗口计时器

    // 返回逻辑相关
    protected isReturning: boolean = false;
    protected returnTarget: Vec3 = null!;

    // 目标选择相关
    protected currentTarget: Node = null!;
    protected targetFindTimer: number = 0;
    protected readonly TARGET_FIND_INTERVAL: number = 0.5;

    // 注意：attackTimer 和 currentHealth 等属性从 Role 基类继承，无需重复定义

    start() {
        super.start(); // 调用父类 start() 创建血条等组件
          //console.log.log('[Bear] super.start() 调用完成，healthBar=' + !!((this as any).healthBar));

        // 设置巨熊的碰撞半径（15 像素，比弓箭手大）
        this.collisionRadius = 15;

        // 设置动画时长（预制体中为 0，需要在此处设置）
        this.attackAnimationDuration = 1.0; // 攻击动画时长 1 秒
        this.hitAnimationDuration = 0.5;    // 受击动画时长 0.5 秒
        this.moveAnimationDuration = 0.5;   // 移动动画时长 0.5 秒

        this.findGameManager();
        this.unitManager = UnitManager.getInstance();
        this.unitType = UnitType.CHARACTER;
        this.unitName = "巨熊";
        this.unitDescription = "中立肉盾单位，初始时攻击所有单位，被击败后可归顺我方。";
        this.currentHealth = this.maxHealth;
        this.bearState = BearState.Neutral;
        //console.log('[Bear] 巨熊初始化完成');
    }

    onEnable() {
        this.currentHealth = this.maxHealth;
        this.bearState = BearState.Neutral;
        this.isReturning = false;
        this.attackTimer = 0;
        this.targetFindTimer = 0;
        this.currentTarget = null!;
        this.damageWindowTimer = 0;
        this.damageInWindow = 0;
    }

    update(deltaTime: number) {
        if (!this.node.isValid || !this.node.active) return;
        if (this.isDead || this.isDestroyed) return; // 死亡后不更新任何行为

        if (!this.gameManager) {
            this.findGameManager();
        }

        const gameState = this.gameManager?.getGameState();
        if (gameState !== GameState.Playing) {
            return;
        }

        // 更新韧性伤害窗口：1 秒后重置累积伤害
        this.damageWindowTimer += deltaTime;
        if (this.damageWindowTimer > 1.0) {
            this.damageWindowTimer = 0;
            this.damageInWindow = 0;
        }

        if (this.bearState === BearState.Neutral || this.bearState === BearState.Tamed) {
            this.updateCombatState(deltaTime);
        } else if (this.bearState === BearState.Returning) {
            this.updateReturningState(deltaTime);
        }

        this.checkReturnDistance(deltaTime);
    }

    private updateCombatState(deltaTime: number) {
        this.targetFindTimer += deltaTime;
        if (this.targetFindTimer >= this.TARGET_FIND_INTERVAL || !this.currentTarget || !this.currentTarget.isValid) {
            this.targetFindTimer = 0;
          //console.log('[Bear] 开始寻找新目标，当前 target=' + (this.currentTarget?.name || 'null'));
            this.findNewTarget();
          //console.log('[Bear] 寻找目标完成，新 target=' + (this.currentTarget?.name || 'null'));
        }

        if (this.currentTarget && this.currentTarget.isValid) {
            const dist = this.getDistanceToTarget();
          //console.log('[Bear] 当前目标距离=' + dist.toFixed(2) + ', attackRange=' + this.attackRange + ', 目标=' + this.currentTarget.name);
            if (dist <= this.attackRange) {
              //console.log('[Bear] 进入攻击范围，停止移动');
                this.stopMovement();

                this.attackTimer += deltaTime;
                if (this.attackTimer >= this.attackInterval) {
                    this.attackTimer = 0;
                    this.performAttack();
                }
                this.faceTarget(this.currentTarget);
            } else {
              //console.log('[Bear] 移动向目标，当前位置=' + this.node.worldPosition.x.toFixed(1) + ',' + this.node.worldPosition.y.toFixed(1));
                this.moveTowards(this.currentTarget.worldPosition, deltaTime);
              //console.log('[Bear] 移动后位置=' + this.node.worldPosition.x.toFixed(1) + ',' + this.node.worldPosition.y.toFixed(1));
            }
        } else {
          //console.log('[Bear] 没有有效目标，停止移动');
            this.stopMovement();
        }
    }

    private performAttack() {
        if (!this.currentTarget || !this.currentTarget.isValid) return;

        // 播放攻击动画
        this.playAttackAnimation(() => {
            // 第二次伤害：攻击动画结束时再次造成伤害
            if (this.currentTarget && this.currentTarget.isValid) {
                this.dealDamageToTarget();
                //console.log('[Bear] 巨熊攻击目标（第 2 段伤害 - 动画结束）');
            }
        });

        // 第一次伤害：攻击动画播放到一半时造成伤害（动画时长 1 秒，一半是 0.5 秒）
        this.scheduleOnce(() => {
            if (this.currentTarget && this.currentTarget.isValid) {
                this.dealDamageToTarget();
                //console.log('[Bear] 巨熊攻击目标（第 1 段伤害 - 动画一半）');
            }
        }, this.attackAnimationDuration / 2);
    }

    private dealDamageToTarget() {
        if (!this.currentTarget || !this.currentTarget.isValid) return;

        const targetScript = this.currentTarget.getComponent('Enemy') as any ||
                            this.currentTarget.getComponent('Portal') as any ||
                            this.currentTarget.getComponent('Role') as any ||
                            this.currentTarget.getComponent('Build') as any;

        if (targetScript && targetScript.takeDamage) {
            targetScript.takeDamage(this.attackDamage);
        }
    }

    private updateReturningState(deltaTime: number) {
        if (!this.returnTarget) return;

        // 使用平方距离比较，避免开方运算
        const dx = this.node.worldPosition.x - this.returnTarget.x;
        const dy = this.node.worldPosition.y - this.returnTarget.y;
        const distSq = dx * dx + dy * dy;
        const returnDistSq = 50 * 50;

        if (distSq <= returnDistSq) {
            this.isReturning = false;
            this.bearState = BearState.Neutral;
            this.stopMovement();
        } else {
            this.moveTowards(this.returnTarget, deltaTime);
        }
    }

    private findNewTarget() {
        if (!this.unitManager) {
            this.unitManager = UnitManager.getInstance();
            if (!this.unitManager) {
              //console.log('[Bear] findNewTarget: UnitManager 不存在');
                return;
            }
        }

        const myPos = this.node.worldPosition;
        let targets: Node[] = [];

      //console.log('[Bear] findNewTarget: 当前位置=' + myPos.x.toFixed(1) + ',' + myPos.y.toFixed(1) + ', bearState=' + this.bearState);

        if (this.bearState === BearState.Neutral) {
            targets = this.unitManager.getAllTargetsInRange(myPos, 500);
            // 排除自己
            targets = targets.filter(t => t !== this.node);
          //console.log('[Bear] findNewTarget: 中立状态，找到目标数=' + targets.length);
        } else if (this.bearState === BearState.Tamed) {
            targets = this.unitManager.getEnemiesInRange(myPos, 500, true);
          //console.log('[Bear] findNewTarget: 归顺状态，找到敌人数=' + targets.length);
        }

        if (targets.length === 0) {
          //console.log('[Bear] findNewTarget: 没有有效目标，返回');
            return;
        }

        let nearestTarget: Node = null!;
        let nearestDistSq = Infinity;

        for (const target of targets) {
            if (!target || !target.isValid || !target.active) continue;

            const targetScript = target.getComponent('Enemy') ||
                                target.getComponent('Orc') ||
                                target.getComponent('Role') ||
                                target.getComponent('Arrower') ||
                                target.getComponent('Hunter') ||
                                target.getComponent('ElfSwordsman') ||
                                target.getComponent('Priest') ||
                                target.getComponent('Mage');

            if (targetScript && (targetScript as any).isAlive && !(targetScript as any).isAlive()) continue;

            // 使用平方距离比较，避免开方运算
            const dx = target.worldPosition.x - myPos.x;
            const dy = target.worldPosition.y - myPos.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < nearestDistSq) {
                nearestDistSq = distSq;
                nearestTarget = target;
            }
        }

        if (nearestTarget && nearestTarget.isValid) {
            this.currentTarget = nearestTarget;
          //console.log('[Bear] findNewTarget: 设置新目标=' + nearestTarget.name + ', 距离=' + Math.sqrt(nearestDistSq).toFixed(1));
        } else {
          //console.log('[Bear] findNewTarget: 没有找到有效的最近目标');
        }
    }

    private getDistanceToTarget(): number {
        if (!this.currentTarget || !this.currentTarget.isValid) return Infinity;
        // 使用平方距离返回实际距离（需要开方）
        const dx = this.currentTarget.worldPosition.x - this.node.worldPosition.x;
        const dy = this.currentTarget.worldPosition.y - this.node.worldPosition.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private faceTarget(target: Node) {
        if (!target || !target.isValid) return;

        const myPos = this.node.worldPosition;
        const targetPos = target.worldPosition;

        if (targetPos.x > myPos.x) {
            this.node.scale = new Vec3(Math.abs(this.node.scale.x), this.node.scale.y, this.node.scale.z);
        } else {
            this.node.scale = new Vec3(-Math.abs(this.node.scale.x), this.node.scale.y, this.node.scale.z);
        }
        // 更新血条朝向，使其不随角色翻转
        this.refreshOverheadNodesScale();
    }

    private moveTowards(targetPos: Vec3, deltaTime: number) {
        const myPos = this.node.worldPosition;
        const direction = new Vec3();
        Vec3.subtract(direction, targetPos, myPos);
        direction.normalize();

        const moveDelta = this.moveSpeed * deltaTime;
        const desiredPos = new Vec3(
            myPos.x + direction.x * moveDelta,
            myPos.y + direction.y * moveDelta,
            myPos.z
        );

      //console.log('[Bear] moveTowards: 从 (' + myPos.x.toFixed(1) + ',' + myPos.y.toFixed(1) + ') 移动到 (' + desiredPos.x.toFixed(1) + ',' + desiredPos.y.toFixed(1) + ')');

        // 使用避让逻辑：如果新位置有碰撞，尝试调整方向
        const adjustedPos = this.checkCollisionAndAdjust(myPos, desiredPos);

      //console.log('[Bear] moveTowards: 调整后位置 (' + adjustedPos.x.toFixed(1) + ',' + adjustedPos.y.toFixed(1) + ')');

        // 如果调整后位置没有变化，说明被卡住了
        const dx = adjustedPos.x - myPos.x;
        const dy = adjustedPos.y - myPos.y;
        const moveDistanceSq = dx * dx + dy * dy;
        if (moveDistanceSq < 0.01) {
          //console.log('[Bear] moveTowards: 被卡住，移动距离太小');
            // 被卡住，不播放移动动画
            return;
        }

        this.node.worldPosition = adjustedPos;

        // 如果正在播放攻击动画，不播放移动动画
        if (!this.isPlayingAttackAnimation) {
            if (!this.isMoving) {
                this.isMoving = true;
            }
            this.playMoveAnimation();
        }

        if (direction.x > 0) {
            this.node.scale = new Vec3(Math.abs(this.node.scale.x), this.node.scale.y, this.node.scale.z);
        } else {
            this.node.scale = new Vec3(-Math.abs(this.node.scale.x), this.node.scale.y, this.node.scale.z);
        }
        // 更新血条朝向，使其不随角色翻转
        this.refreshOverheadNodesScale();
    }

    /**
     * 检查碰撞并调整位置 - 直接调用父类方法
     */
    checkCollisionAndAdjust(currentPos: Vec3, newPos: Vec3): Vec3 {
        return super.checkCollisionAndAdjust(currentPos, newPos);
    }

    private stopMovement() {
        if (this.isMoving) {
            this.isMoving = false;
            this.stopMoveAnimation();
        }
    }

    private checkReturnDistance(deltaTime: number) {
        if (this.bearState !== BearState.Tamed) return;
        if (this.isReturning) return;

        if (!this.beastDenNode || !this.beastDenNode.isValid) return;

        const denPos = this.beastDenNode.worldPosition;
        const myPos = this.node.worldPosition;

        // 使用平方距离比较，避免开方运算
        const dx = myPos.x - denPos.x;
        const dy = myPos.y - denPos.y;
        const distSq = dx * dx + dy * dy;
        const returnDistanceSq = this.returnDistance * this.returnDistance;

        if (distSq > returnDistanceSq) {
            // 停止攻击，立即返回
            this.stopMovement();
            this.currentTarget = null!;
            this.attackTimer = 0;
            this.startReturning(denPos);
        }
    }

    private startReturning(denPos: Vec3) {
        this.isReturning = true;
        this.bearState = BearState.Returning;
        this.returnTarget = denPos.clone();
        this.currentTarget = null!;
    }

    public setTamedState(denNode: Node, denScript: any) {
        //console.log('[Bear] 巨熊归顺我方');

        this.beastDenNode = denNode;
        this.beastDenScript = denScript;
        this.bearState = BearState.Tamed;
        this.isReturning = false;
        this.currentHealth = this.maxHealth;
        this.damageWindowTimer = 0;
        this.damageInWindow = 0;

        // 更新血条（如果 Role 基类有 healthBar）
        const healthBar = (this as any).healthBar;
        if (healthBar && healthBar.updateHealthBar) {
            healthBar.updateHealthBar(this.currentHealth, this.maxHealth);
        }
    }

    public setNeutralState(denNode: Node, denScript: any) {
        //console.log('[Bear] 巨熊重置为中立状态');
        this.beastDenNode = denNode;
        this.beastDenScript = denScript;
        this.bearState = BearState.Neutral;
        this.isReturning = false;
        this.currentTarget = null!;
        this.damageWindowTimer = 0;
        this.damageInWindow = 0;
    }

    /**
     * 重写 showUnitInfoPanel：巨熊不显示任何九宫格按钮
     */
    showUnitInfoPanel() {
        // 显示单位信息面板和范围
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (this.unitSelectionManager) {
            const currentHealth = (this.currentHealth !== undefined && !isNaN(this.currentHealth) && this.currentHealth >= 0)
                ? this.currentHealth
                : (this.maxHealth || 0);
            const maxHealth = (this.maxHealth !== undefined && !isNaN(this.maxHealth) && this.maxHealth > 0)
                ? this.maxHealth
                : 0;

            const unitInfo: import('../UnitInfoPanel').UnitInfo = {
                name: this.unitName || '角色',
                level: this.level,
                currentHealth: currentHealth,
                maxHealth: maxHealth,
                attackDamage: this.attackDamage,
                populationCost: 1,
                icon: this.cardIcon || this.defaultSpriteFrame,
                collisionRadius: this.collisionRadius,
                attackRange: this.attackRange,
                attackFrequency: 1.0 / this.attackInterval,
                moveSpeed: this.moveSpeed
                // 不设置 onUpgradeClick、onSellClick、onDefendClick 等回调，九宫格不显示任何按钮
            };
            this.unitSelectionManager.selectUnit(this.node, unitInfo);
        }

        // 点击其他地方设置移动目标（与基类相同）
        const canvas = find('Canvas');
        this.scheduleOnce(() => {
            if (canvas) {
                this.globalTouchHandler = (event: EventTouch) => {
                    if (this.unitSelectionManager) {
                        const currentSelectedUnit = this.unitSelectionManager.getCurrentSelectedUnit();

                        if (currentSelectedUnit !== null && currentSelectedUnit !== this.node) {
                            const canvas = find('Canvas');
                            if (canvas && this.globalTouchHandler) {
                                canvas.off(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
                            }
                            this.globalTouchHandler = null!;
                            return;
                        }
                    }

                    const targetNode = event.target as Node;
                    if (targetNode) {
                        let currentNode: Node | null = targetNode;
                        while (currentNode) {
                            if (currentNode.name === 'UnitInfoPanel' || currentNode.name.includes('UnitInfoPanel')) {
                                return;
                            }
                            const nodePath = currentNode.getPathInHierarchy();
                            if (nodePath && nodePath.includes('UnitInfoPanel')) {
                                return;
                            }
                            currentNode = currentNode.parent;
                            if (!currentNode) {
                                break;
                            }
                        }
                    }

                    this.setManualMoveTarget(event);
                };

                canvas.on(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
            }
        }, 0.1);
    }

    public onBearDefeated() {
        //console.log(`[Bear] 巨熊被击败，bearState=${this.bearState}, beastDenScript=${!!this.beastDenScript}`);

        // 先通知兽穴清空 bearNode 引用
        if (this.beastDenScript && this.beastDenScript.clearBearNode) {
            this.beastDenScript.clearBearNode();
        }

        // 根据熊的状态决定后续操作
        if (this.bearState === BearState.Tamed) {
            //console.log('[Bear] 归顺巨熊被击败，通知兽穴开始复活读条');
            if (this.beastDenScript && this.beastDenScript.resetToNeutral) {
                this.beastDenScript.resetToNeutral();
            } else {
                console.warn('[Bear] beastDenScript.resetToNeutral 方法不存在');
            }
        } else if (this.bearState === BearState.Neutral) {
            //console.log('[Bear] 中立巨熊被击败，通知兽穴开始驯化读条');
            if (this.beastDenScript && this.beastDenScript.startTameProgress) {
                this.beastDenScript.startTameProgress();
            } else {
                console.warn('[Bear] beastDenScript.startTameProgress 方法不存在');
            }
        }
    }

    public takeDamage(damage: number, hitDirection?: Vec3) {
        // 死亡后不再受到伤害
        if (this.isDead) return;

        // 韧性逻辑：累积 1 秒内的伤害，只有超过阈值才播放受击动画
        const damageThreshold = this.maxHealth * this.tenacity;
        const shouldPlayHitAnimation = (this.damageInWindow + damage) >= damageThreshold;
        this.damageInWindow += damage;

        this.currentHealth = Math.max(0, this.currentHealth - damage);

        // 显示伤害数字
        this.showDamageNumber(damage, false, hitDirection);

        // 更新血条
        const healthBar = (this as any).healthBar;
        if (healthBar && healthBar.setHealth) {
            healthBar.setHealth(this.currentHealth);
        }

        // 只有超过韧性阈值才播放受击动画
        if (shouldPlayHitAnimation) {
            this.playHitAnimation();
        }

        if (this.currentHealth <= 0) {
            this.isDead = true;
            this.isDestroyed = true; // 标记为已销毁，阻止后续移动和攻击
            this.onBearDefeated();

            // 立即停止所有动画（移动、攻击等），只保留死亡动画
            this.stopAllAnimations();

            // 销毁血条
            if (this.healthBarNode && this.healthBarNode.isValid) {
                this.healthBarNode.destroy();
            }
            this.healthBarNode = null!;
            this.healthBar = null!;

            this.playDeathAnimation();
            // 尸体留存 10 秒后销毁
            this.scheduleOnce(() => {
                if (this.node && this.node.isValid) {
                    this.node.destroy();
                }
            }, 10.0);
        }
    }

    public setBearNode(bearNode: Node, bearScript: any) {
        // 此方法用于 BeastDen 调用，保持兼容性
    }

    onDestroy() {
        this.beastDenNode = null!;
        this.beastDenScript = null!;
        this.currentTarget = null!;
    }
}
