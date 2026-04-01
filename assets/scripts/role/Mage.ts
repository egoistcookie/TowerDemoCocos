import { _decorator, SpriteFrame, Prefab, Texture2D, AudioClip, EventTouch, EventMouse, Node, find, instantiate, Sprite, UITransform, Color, Camera, tween, UIOpacity, Vec3, resources, SpriteFrame as CCSpriteFrame } from 'cc';
import { Role } from './Role';
import { UnitInfo } from '../UnitInfoPanel';
import { ArcaneMissile } from '../ArcaneMissile';
import { AudioManager } from '../AudioManager';
import { GamePopup } from '../GamePopup';
import { GameState } from '../GameManager';
import { UnitConfigManager } from '../UnitConfigManager';
import { FireballExplosionEffect } from '../FireballExplosionEffect';
const { ccclass, property } = _decorator;

@ccclass('Mage')
export class Mage extends Role {
    @property
    missilesPerAttack: number = 10;

    @property
    missileBurstDuration: number = 3.0;

    @property
    missileDamageScale: number = 0.35;

    @property
    missileRetargetRadius: number = 150;

    @property({ override: true })
    maxHealth: number = 60;

    @property({ override: true })
    attackRange: number = 260;

    @property({ override: true })
    attackDamage: number = 16;

    @property({ override: true })
    attackInterval: number = 3.0;

    @property({ type: Prefab, override: true })
    bulletPrefab: Prefab = null!; // 火球预制体

    @property({ type: Prefab, override: true })
    explosionEffect: Prefab = null!;

    @property({ type: Prefab, override: true })
    damageNumberPrefab: Prefab = null!;

    @property({ override: true })
    buildCost: number = 5;
    
    @property({ override: true })
    level: number = 1;

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
    attackAnimationDuration: number = 0.55;
    
    @property({ override: true })
    hitAnimationDuration: number = 0.3;
    
    @property({ override: true })
    deathAnimationDuration: number = 1.0;

    @property({ override: true })
    moveSpeed: number = 95;

    @property({ type: SpriteFrame, override: true })
    moveAnimationFrames: SpriteFrame[] = [];

    @property({ override: true })
    moveAnimationDuration: number = 0.3;

    @property({ override: true })
    collisionRadius: number = 10;

    @property({ type: SpriteFrame, override: true })
    cardIcon: SpriteFrame = null!;
    
    @property({ override: true })
    unitName: string = "法师";
    
    @property({ override: true })
    unitDescription: string = "现在是哪个笨蛋准备好要挨揍了？";
    
    @property({ type: SpriteFrame, override: true })
    unitIcon: SpriteFrame = null!;

    battleSlogans: string[] = ['奥术光辉！', '飞弹准备！', '爆炸，就是艺术！', '砰、砰、砰！'];
    private readonly SP_BANG_BANG_BANG_SLOGAN = '火力覆盖！';

    public override tryTriggerSloganOnAction() {
        if (!this.battleSlogans || this.battleSlogans.length === 0) {
            return;
        }
        const anyThis = this as any;
        if (anyThis.dialogNode && anyThis.dialogNode.isValid) {
            return;
        }
        if ((Number(anyThis.dialogIntervalTimer) || 0) < 2.0) {
            return;
        }

        const spEnabled = (Number((this as any)._spMissilesPerAttackFlat) || 0) > 0;
        if (spEnabled && Math.random() < 0.5) {
            this.createDialog(this.SP_BANG_BANG_BANG_SLOGAN, false);
        } else {
            this.createDialog();
        }
        anyThis.dialogIntervalTimer = 0;
        anyThis.dialogTimer = 0;
    }

    // 避免在一次爆发期间被重复触发
    private isBurstEmitting: boolean = false;
    private isMeteorPlacing: boolean = false;
    private currentMeteorCircle: Node | null = null;
    private readonly METEOR_MANA_COST: number = 50;

    // 陨石技能配置
    @property
    meteorDamage: number = 300;
    @property
    meteorRadius: number = 80;
    @property
    meteorFallDuration: number = 4.0;
    @property({ type: SpriteFrame, tooltip: '陨石精灵帧（可选，如未配置则使用纯色圆点）' })
    meteorSpriteFrame: SpriteFrame = null!;
    @property({ type: [SpriteFrame], tooltip: '陨石下落动画帧（可选，未配置则使用单帧）' })
    meteorAnimationFrames: SpriteFrame[] = [];
    @property({ type: AudioClip, tooltip: '陨石下落第3秒播放的技能音效' })
    meteorSound: AudioClip = null!;

    onEnable() {
        // 法师生命值与牧师保持一致，避免两者数值漂移
        try {
            const config = UnitConfigManager.getInstance().getUnitConfig('Priest');
            const priestHp = config?.baseStats?.maxHealth;
            if (typeof priestHp === 'number' && priestHp > 0) {
                this.maxHealth = priestHp;
            }
        } catch (e) {
            console.warn('[Mage.onEnable] sync hp from Priest config failed:', e);
        }
        // 法师拥有主动技能（陨石），启用蓝量条与蓝量回复
        (this as any).hasSkill = true;
        super.onEnable();
    }

    public override update(deltaTime: number) {
        super.update(deltaTime);
        if (this.isDestroyed || this.isMeteorPlacing) {
            return;
        }
        if (!this.gameManager) {
            this.findGameManager();
        }
        if (this.gameManager && this.gameManager.getGameState && this.gameManager.getGameState() !== GameState.Playing) {
            return;
        }
        // 蓝量满值时自动释放陨石，目标为附近最近敌人
        if (this.currentMana >= this.maxMana) {
            this.tryAutoCastMeteor();
        }
    }

    public override attack() {
        if (!this.currentTarget || this.isDestroyed) {
            return;
        }
        if (this.isPlayingAttackAnimation) {
            return;
        }
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }
        this.stopMoving();
        this.tryTriggerSloganOnAction();
        //console.info('[Mage.attack] begin. interval=', this.attackInterval, 'perAttack=', this.missilesPerAttack, 'burstDuration=', this.missileBurstDuration);
        if (this.isAliveEnemy(this.currentTarget)) {
            const attackAnimDuration = Math.max(0.1, this.attackAnimationDuration);
            const burstStartDelay = attackAnimDuration * 0.5;
            const burstWindow = Math.max(0.1, attackAnimDuration - burstStartDelay);
            //console.info('[Mage.attack] schedule burst: startDelay=', burstStartDelay.toFixed(3), 'burstWindow=', burstWindow.toFixed(3), 'attackAnimDuration=', attackAnimDuration.toFixed(3));

            this.playAttackAnimation();
            this.scheduleOnce(() => {
                if (this.isDestroyed || !this.node || !this.node.isValid) {
                    return;
                }
                if (this.isBurstEmitting) {
                    //console.info('[Mage.attack] burst already emitting, skip reschedule');
                    return;
                }
                //console.info('[Mage.attack] burst start at half animation');
                this.fireArcaneMissileBurst(burstWindow);
            }, burstStartDelay);
        } else {
            this.currentTarget = null!;
        }
    }

    private fireArcaneMissileBurst(burstWindow: number) {
        //console.info('[Mage.fireArcaneMissileBurst] enter. bulletPrefab=', !!this.bulletPrefab, 'destroyed=', this.isDestroyed);
        if (this.isDestroyed) {
            console.warn('[Mage.fireArcaneMissileBurst] aborted: destroyed');
            this.executeAttack();
            return;
        }
        if (this.isBurstEmitting) {
            //console.info('[Mage.fireArcaneMissileBurst] already emitting, skip');
            return;
        }
        this.isBurstEmitting = true;
        const count = Math.max(1, Math.floor(this.missilesPerAttack));
        const effectiveWindow = Math.max(0.05, burstWindow);
        const interval = count > 1 ? Math.max(0.02, effectiveWindow / (count - 1)) : 0;
        //console.info('[Mage.fireArcaneMissileBurst] setup: count=', count, 'interval=', interval.toFixed(3), 'window=', effectiveWindow.toFixed(3));
        
        // 逐发定时器，确保按期发射指定数量
        let emitted = 0;
        const emitOne = () => {
                if (this.isDestroyed || !this.node || !this.node.isValid) {
                this.unschedule(emitOne);
                this.isBurstEmitting = false;
                //console.info('[Mage.fireArcaneMissileBurst] stopped due to destroyed/invalid node at emitted=', emitted);
                    return;
                }
                const target = this.pickMissileTarget();
            if (target) {
                // 每发飞弹都播放一次发射音效（与 missilesPerAttack 数量一致）
                if (this.shootSound && AudioManager.Instance) {
                    AudioManager.Instance.playSFX(this.shootSound);
                }
                this.spawnArcaneMissile(target);
                //console.info('[Mage.fireArcaneMissileBurst] emitted #', emitted + 1, '/', count, 'target=', target.name);
            }
            emitted++;
            if (emitted >= count) {
                //console.info('[Mage.fireArcaneMissileBurst] done. total=', emitted);
                this.unschedule(emitOne);
                this.isBurstEmitting = false;
            }
        };
        // 立即发射第一枚
        //console.info('[Mage.fireArcaneMissileBurst] emit first immediately');
        emitOne();
        // 其余按固定间隔发射，直到达到数量
        if (count > 1) {
            //console.info('[Mage.fireArcaneMissileBurst] schedule remaining, interval=', interval.toFixed(3));
            this.schedule(emitOne, interval);
        }
    }

    private pickMissileTarget(): Node | null {
        if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active && this.isAliveEnemy(this.currentTarget)) {
            return this.currentTarget;
        }
        let enemies = this.getEnemies(true, this.attackRange * 1.2);
        // 兜底：UnitManager 可能不包含传送门，额外合并 Canvas/Portals 内的敌对单位
        try {
            const portals = find('Canvas/Portals');
            if (portals) {
                for (const child of portals.children) {
                    if (!child || !child.isValid || !child.active) continue;
                    if (this.isAliveEnemy(child)) {
                        enemies = enemies ? enemies.slice() : [];
                        enemies.push(child);
                    }
                }
            }
        } catch {}
        if (!enemies || enemies.length === 0) {
            return null;
        }
        const idx = Math.floor(Math.random() * enemies.length);
        return enemies[idx] || null;
    }

    private spawnArcaneMissile(target: Node) {
        if (!target || !target.isValid) {
            return;
        }
        let missile: Node;
        if (this.bulletPrefab) {
            missile = instantiate(this.bulletPrefab);
        } else {
            // 无预制体时的降级方案：动态创建节点并挂载脚本
            missile = new Node('ArcaneMissile');
        }
        const parentNode = find('Canvas') || this.node.scene || this.node.parent;
        if (!parentNode) {
            missile.destroy();
            return;
        }
        missile.setParent(parentNode);
        const startPos = this.node.worldPosition.clone();
        missile.setWorldPosition(startPos);

        let missileScript = missile.getComponent(ArcaneMissile) || missile.getComponent('ArcaneMissile') as any;
        if (!missileScript) {
            // 预制体没有脚本时，尝试动态添加
            missileScript = (missile.addComponent as any)?.(ArcaneMissile) || missile.addComponent?.('ArcaneMissile');
        }
        if (!missileScript || !missileScript.init) {
            missile.destroy();
            return;
        }
        const perMissileDamage = Math.max(1, this.attackDamage * this.missileDamageScale);
        missileScript.retargetRadius = this.missileRetargetRadius;
        missileScript.init(startPos, target, perMissileDamage, this.node, (damage: number, hitDirection: any, hitTarget: Node | null) => {
            if (!hitTarget || !hitTarget.isValid || !hitTarget.active) {
                return;
            }
            if (this.isAliveEnemy(hitTarget)) {
                const enemyScript = this.getEnemyScript(hitTarget);
                if (enemyScript && enemyScript.takeDamage) {
                    enemyScript.takeDamage(damage, hitDirection);
                    this.recordDamageToStatistics(damage);
                }
            }
        });
    }

    private buildMageUnitInfo(): UnitInfo {
        const upgradeCost = this.level < 3 ? (10 + (this.level - 1) * 10) : undefined;
        const currentHealth = (this.currentHealth !== undefined && !isNaN(this.currentHealth) && this.currentHealth >= 0)
            ? this.currentHealth : (this.maxHealth || 0);
        const maxHealth = (this.maxHealth !== undefined && !isNaN(this.maxHealth) && this.maxHealth > 0)
            ? this.maxHealth : 0;
        return {
            name: this.unitName || '法师',
            level: this.level,
            currentHealth,
            maxHealth,
            attackDamage: this.attackDamage,
            populationCost: 2,
            icon: this.cardIcon || this.defaultSpriteFrame,
            collisionRadius: this.collisionRadius,
            attackRange: this.attackRange,
            attackFrequency: 1.0 / this.attackInterval,
            moveSpeed: this.moveSpeed,
            isDefending: this.isDefending,
            upgradeCost,
            onUpgradeClick: this.level < 3 ? () => this.onUpgradeClick() : undefined,
            onSellClick: () => this.onSellClick(),
            onDefendClick: () => this.onDefendClick(),
            onSkillClick: (event?: EventTouch) => this.onMeteorSkillClick(event),
            isSkillActive: false
        };
    }

    public override showUnitInfoPanel() {
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (this.unitSelectionManager) {
            this.unitSelectionManager.selectUnit(this.node, this.buildMageUnitInfo());
        }

        const canvas = find('Canvas');
        this.scheduleOnce(() => {
            if (canvas) {
                this.globalTouchHandler = (event: EventTouch) => {
                    this.setManualMoveTarget(event);
                };
                canvas.on(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
            }
        }, 0.1);
    }

    private onMeteorSkillClick(event?: EventTouch) {
        if (event) event.propagationStopped = true;
        this.startMeteorPlacement(event);
    }

    /**
     * 开始放置陨石魔法阵（完整复用牧师祈祷的交互方式）
     */
    private startMeteorPlacement(startEvent?: EventTouch) {
        if (this.isMeteorPlacing) {
            return;
        }
        this.isMeteorPlacing = true;

        const canvas = find('Canvas');
        if (!canvas) {
            console.error('[Mage.startMeteorPlacement] 找不到Canvas节点');
            this.isMeteorPlacing = false;
            return;
        }
        const canvasTransform = canvas.getComponent(UITransform);
        if (!canvasTransform) {
            console.error('[Mage.startMeteorPlacement] Canvas没有UITransform组件');
            this.isMeteorPlacing = false;
            return;
        }

        // 创建魔法阵节点
        const circle = new Node('MeteorCircle');
        const uiTrans = circle.addComponent(UITransform);
        uiTrans.setContentSize(160, 160);
        const sprite = circle.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.color = new Color(255, 255, 255, 200);
        circle.setParent(canvas);
        this.currentMeteorCircle = circle;

        const updatePosFromEvent = (ev: EventTouch | EventMouse) => {
            const cameraNode = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
            if (!cameraNode) return;
            const camera = cameraNode.getComponent(Camera);
            if (!camera) return;
            const anyEvent: any = ev as any;
            const loc = anyEvent.getLocation ? anyEvent.getLocation() : anyEvent.getLocationInView?.();
            if (!loc) return;
            const screenPos = new Vec3(loc.x, loc.y, 0);
            const worldPos = new Vec3();
            camera.screenToWorld(screenPos, worldPos);
            worldPos.z = 0;
            const localPos = canvasTransform.convertToNodeSpaceAR(worldPos);
            circle.setPosition(localPos);
        };

        // 初次定位
        if (startEvent) {
            try { updatePosFromEvent(startEvent); } catch {}
        }

        // 事件处理
        const onTouchMove = (ev: EventTouch) => {
            if (!this.isMeteorPlacing || !circle.isValid) return;
            updatePosFromEvent(ev);
        };
        const finishAndCast = (ev: EventTouch | null) => {
            if (ev) (ev as any).propagationStopped = true;
            (canvas as any).off(Node.EventType.TOUCH_MOVE, onTouchMove, this, true);
            (canvas as any).off(Node.EventType.TOUCH_END, onTouchEnd, this, true);
            (canvas as any).off(Node.EventType.TOUCH_CANCEL, onTouchCancel, this, true);
            (canvas as any).off(Node.EventType.MOUSE_MOVE, onMouseMove, this, true);
            (canvas as any).off(Node.EventType.MOUSE_UP, onMouseUp, this, true);

            if (!this.isMeteorPlacing || !circle.isValid) {
                this.isMeteorPlacing = false;
                if (circle && circle.isValid) circle.destroy();
                this.currentMeteorCircle = null;
                return;
            }
            const worldPos = circle.worldPosition.clone();
            this.castMeteor(worldPos, circle);
            this.isMeteorPlacing = false;
        };
        const onTouchEnd = (ev: EventTouch) => finishAndCast(ev);
        const onTouchCancel = (ev: EventTouch) => finishAndCast(ev);
        const onMouseMove = (ev: EventMouse) => {
            if (!this.isMeteorPlacing || !circle.isValid) return;
            updatePosFromEvent(ev);
        };
        const onMouseUp = (ev: EventMouse) => {
            (ev as any).propagationStopped = true;
            (canvas as any).off(Node.EventType.MOUSE_MOVE, onMouseMove, this, true);
            (canvas as any).off(Node.EventType.MOUSE_UP, onMouseUp, this, true);
            (canvas as any).off(Node.EventType.TOUCH_MOVE, onTouchMove, this, true);
            (canvas as any).off(Node.EventType.TOUCH_END, onTouchEnd, this, true);
            finishAndCast(null);
        };
        (canvas as any).on(Node.EventType.TOUCH_MOVE, onTouchMove, this, true);
        (canvas as any).on(Node.EventType.TOUCH_END, onTouchEnd, this, true);
        (canvas as any).on(Node.EventType.TOUCH_CANCEL, onTouchCancel, this, true);
        (canvas as any).on(Node.EventType.MOUSE_MOVE, onMouseMove, this, true);
        (canvas as any).on(Node.EventType.MOUSE_UP, onMouseUp, this, true);

        // 加载陨石专用魔法阵贴图（与牧师不同）
        resources.load('textures/mofazhen2/spriteFrame', CCSpriteFrame, (err, sf) => {
            if (!err && sprite && sprite.node && sprite.node.isValid) {
                sprite.spriteFrame = sf;
            }
        });
    }

    /**
     * 施放陨石：显示魔法阵渐隐 + 陨石从左上坠落，命中后造成范围高额伤害
     */
    private castMeteor(centerWorldPos: Vec3, circleNode?: Node | null, isAuto: boolean = false) {
        // 先扣蓝，蓝量不足则取消施法
        if (!this.consumeMana(this.METEOR_MANA_COST)) {
            if (!isAuto) {
                GamePopup.showMessage(`蓝量不足，释放陨石需要${this.METEOR_MANA_COST}蓝量`);
            }
            if (circleNode && circleNode.isValid) {
                circleNode.destroy();
            }
            this.currentMeteorCircle = null;
            return;
        }

        // 释放陨石时播放固定口号（参考牧师祈祷的固定台词触发）
        this.createDialog('让火焰净化一切！', false);

        // 魔法阵渐隐
        if (circleNode && circleNode.isValid) {
            const opacity = circleNode.getComponent(UIOpacity) || circleNode.addComponent(UIOpacity);
            opacity.opacity = 255;
            tween(opacity)
                // 10秒由100%透明度降到50%透明度
                .to(10, { opacity: 128 })
                .call(() => {
                    // 保留到陨石落地后销毁
                })
                .start();
        }

        // 创建陨石节点
        const parent = find('Canvas') || this.node.scene || this.node.parent;
        if (!parent) return;
        const meteor = new Node('Meteor');
        meteor.setParent(parent);
        const uiTrans = meteor.addComponent(UITransform);
        uiTrans.setContentSize(48, 48);
        const sprite = meteor.addComponent(Sprite);
        const animFrames = (this.meteorAnimationFrames || []).filter(Boolean);
        if (animFrames.length > 0) {
            sprite.spriteFrame = animFrames[0];
        } else if (this.meteorSpriteFrame) {
            sprite.spriteFrame = this.meteorSpriteFrame;
        } else {
            sprite.color = new Color(220, 140, 80, 255);
        }

        // 起始位置：释放位置左上 400 像素
        const startPos = centerWorldPos.clone().add3f(-400, 400, 0);
        meteor.setWorldPosition(startPos);
        // 固定时间轴（总计 4 秒）：
        // 0~3s: 从左上落到法阵
        // 3~4s: 在法阵位置播放爆炸阶段动画
        // 3.5s: 造成伤害
        const totalDuration = 4.0;
        const moveDuration = 3.0;
        const soundTime = 3.0;
        const damageTime = 3.5;
        let elapsed = 0;
        let lastFrameIndex = -1;
        let hasPlayedMeteorSound = false;
        let hasAppliedDamage = false;

        const animationUpdate = (dt: number) => {
            if (!meteor || !meteor.isValid) {
                this.unschedule(animationUpdate);
                return;
            }
            elapsed += dt;
            const t = Math.min(elapsed, totalDuration);

            // 前3秒位移
            if (t <= moveDuration) {
                const moveProgress = t / moveDuration;
                const curPos = new Vec3();
                Vec3.lerp(curPos, startPos, centerWorldPos, moveProgress);
                meteor.setWorldPosition(curPos);
            } else {
                meteor.setWorldPosition(centerWorldPos);
            }

            // 全4秒按固定时长播放贴图，贴图数量只影响每帧持续时间
            if (animFrames.length > 0) {
                const progress = t / totalDuration;
                const frameIndex = Math.min(animFrames.length - 1, Math.floor(progress * animFrames.length));
                if (frameIndex !== lastFrameIndex) {
                    lastFrameIndex = frameIndex;
                    sprite.spriteFrame = animFrames[frameIndex];
                }
            }

            // 第3秒播放陨石技能音效
            if (!hasPlayedMeteorSound && t >= soundTime) {
                hasPlayedMeteorSound = true;
                if (this.meteorSound && AudioManager.Instance) {
                    AudioManager.Instance.playSFX(this.meteorSound);
                }
            }

            // 3.5秒造成伤害
            if (!hasAppliedDamage && t >= damageTime) {
                hasAppliedDamage = true;
                this.dealMeteorAOEDamage(centerWorldPos, this.meteorRadius, this.meteorDamage);
            }

            // 4秒结束，销毁节点
            if (t >= totalDuration) {
                this.unschedule(animationUpdate);
                this.playMeteorExplosion(centerWorldPos);
                if (meteor && meteor.isValid) meteor.destroy();
                if (circleNode && circleNode.isValid) circleNode.destroy();
                this.currentMeteorCircle = null;
            }
        };

        this.schedule(animationUpdate, 0);
    }

    private tryAutoCastMeteor() {
        const target = this.findNearestEnemyForMeteor(this.attackRange * 2);
        if (!target) {
            return;
        }
        const targetPos = target.worldPosition.clone();
        const circleNode = this.createMeteorCircleAt(targetPos);
        this.castMeteor(targetPos, circleNode, true);
    }

    private findNearestEnemyForMeteor(maxDistance: number): Node | null {
        const enemies = this.getEnemies(true, maxDistance);
        if (!enemies || enemies.length === 0) {
            return null;
        }
        let nearest: Node | null = null;
        let minDistanceSq = Infinity;
        const myPos = this.node.worldPosition;
        for (const enemy of enemies) {
            if (!enemy || !enemy.isValid || !enemy.active || !this.isAliveEnemy(enemy)) {
                continue;
            }
            const dx = enemy.worldPosition.x - myPos.x;
            const dy = enemy.worldPosition.y - myPos.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                nearest = enemy;
            }
        }
        return nearest;
    }

    private createMeteorCircleAt(centerWorldPos: Vec3): Node | null {
        const canvas = find('Canvas');
        if (!canvas) {
            return null;
        }
        const canvasTransform = canvas.getComponent(UITransform);
        if (!canvasTransform) {
            return null;
        }

        const circle = new Node('MeteorCircleAuto');
        const uiTrans = circle.addComponent(UITransform);
        uiTrans.setContentSize(160, 160);
        const sprite = circle.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.color = new Color(255, 255, 255, 200);
        circle.setParent(canvas);
        const localPos = canvasTransform.convertToNodeSpaceAR(centerWorldPos);
        circle.setPosition(localPos);

        resources.load('textures/mofazhen2/spriteFrame', CCSpriteFrame, (err, sf) => {
            if (!err && sprite && sprite.node && sprite.node.isValid) {
                sprite.spriteFrame = sf;
            }
        });
        return circle;
    }

    private playMeteorExplosion(pos: Vec3) {
        const parent = find('Canvas') || this.node.scene || this.node.parent;
        if (!parent) return;
        const node = new Node('MeteorExplosion');
        node.setParent(parent);
        node.setWorldPosition(pos);
        const eff = node.addComponent(FireballExplosionEffect);
        eff.init();
    }

    private dealMeteorAOEDamage(center: Vec3, radius: number, damage: number) {
        const scene = this.node.scene;
        if (!scene || damage <= 0 || radius <= 0) return;
        const hitEnemies = new Set<Node>();
        let hitCount = 0;
        const visitNode = (node: Node) => {
            if (!node || !node.isValid || !node.active) return;
            // 敌方单位组件集合
            const enemyScript = this.getEnemyScript(node);
            if (enemyScript && enemyScript.takeDamage) {
                const enemyNode = (enemyScript.node as Node) || node;
                if (!hitEnemies.has(enemyNode)) {
                    const p = enemyNode.worldPosition;
                    const dx = p.x - center.x, dy = p.y - center.y, dz = p.z - center.z;
                    const distSq = dx * dx + dy * dy + dz * dz;
                    if (distSq <= radius * radius) {
                        // 命中方向：从中心指向单位
                        const dir = new Vec3(dx, dy, dz);
                        if (dir.length() > 0.1) dir.normalize();
                        enemyScript.takeDamage(damage, dir);
                        this.recordDamageToStatistics(damage);
                        hitEnemies.add(enemyNode);
                        hitCount++;
                        // 已命中该敌人，避免继续从其子节点重复命中
                        for (const child of enemyNode.children) {
                            // 跳过子树遍历（不再深入该敌人的结构）
                        }
                    }
                }
            }
            // 常规继续遍历
            for (const child of node.children) visitNode(child);
        };
        visitNode(scene);
    }

}
