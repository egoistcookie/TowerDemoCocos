import { _decorator, SpriteFrame, Prefab, Texture2D, AudioClip, Node, Vec3, find, CCString, EventTouch, EventMouse, UITransform, Sprite, SpriteFrame as CCSpriteFrame, resources, Color, Animation, input, Input, Camera, view, UIOpacity, tween } from 'cc';
import { Role } from './Role';
import { GameManager, GameState } from '../GameManager';
import { DamageStatistics } from '../DamageStatistics';
import { AudioManager } from '../AudioManager';
import type { UnitInfo } from '../UnitInfoPanel';
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

    @property({ type: AudioClip, tooltip: "圣光祈祷技能音效" })
    holyPrayerSound: AudioClip = null!;

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

    // 圣光祈祷特效动画帧（显示在魔法阵内部，非必配）
    @property({ type: [SpriteFrame], tooltip: '圣光祈祷特效动画帧（显示在魔法阵内部，可选）' })
    holyPrayerEffectFrames: SpriteFrame[] = [];

    // 圣光祈祷相关字段
    private isHolyPrayerActive: boolean = false;         // 是否正在拖动魔法阵
    private holyPrayerRadius: number = 100;              // 半径（直径200像素）
    private holyPrayerDuration: number = 5;              // 持续时间（秒）
    private holyPrayerTickInterval: number = 0.5;        // 治疗间隔（秒）
    private currentMagicCircleNode: Node | null = null!; // 当前魔法阵节点
    private readonly HOLY_PRAYER_MANA_COST: number = 20; // 每次圣光祈祷消耗的蓝量

    // 自动圣光祈祷相关字段
    private autoHolyPrayerTimer: number = 0;                  // 自动祈祷计时器
    private readonly AUTO_HOLY_PRAYER_INTERVAL: number = 10;  // 自动祈祷间隔（秒）

    /**
     * 节点启用时：标记拥有技能，让父类创建和更新蓝量条
     */
    onEnable() {
        // 牧师始终拥有技能（圣光祈祷），需要蓝量条和蓝量回复
        (this as any).hasSkill = true;
        super.onEnable();
    }

    update(deltaTime: number) {
        if (this.isDestroyed) {
            return;
        }

        // 更新牧师专用的“禁止待机动画”计时器
        if (this.idleBlockTimer > 0) {
            this.idleBlockTimer -= deltaTime;
            if (this.idleBlockTimer < 0) {
                this.idleBlockTimer = 0;
            }
        }

        // 更新蓝量（每秒回复）
        this.updateMana(deltaTime);

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

        // 自动圣光祈祷计时（只在游戏进行时累计）
        this.autoHolyPrayerTimer += deltaTime;
        if (this.autoHolyPrayerTimer >= this.AUTO_HOLY_PRAYER_INTERVAL) {
            this.autoHolyPrayerTimer = 0;
            this.tryAutoCastHolyPrayer();
        }

        // 防御状态下，不进行移动，但仍可治疗
        if (this.isDefending) {
            // 防御状态下，仍然需要查找治疗目标
            this.findHealTarget();
            
            // 防御状态下，只在治疗范围内治疗，不移动
            if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
                // 性能优化：使用平方距离比较
                const myPos = this.node.worldPosition;
                const targetPos = this.currentTarget.worldPosition;
                const dx = targetPos.x - myPos.x;
                const dy = targetPos.y - myPos.y;
                const distanceSq = dx * dx + dy * dy;
                const attackRangeSq = this.attackRange * this.attackRange;
                
                if (distanceSq <= attackRangeSq) {
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
            // 性能优化：使用平方距离比较
            const myPos2 = this.node.worldPosition;
            const dx2 = this.manualMoveTarget.x - myPos2.x;
            const dy2 = this.manualMoveTarget.y - myPos2.y;
            const distToManualSq = dx2 * dx2 + dy2 * dy2;
            const manualThreshold = 10;
            const manualThresholdSq = manualThreshold * manualThreshold;
            if (distToManualSq <= manualThresholdSq) {
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
            const myPos3 = this.node.worldPosition;
            const targetPos3 = this.currentTarget.worldPosition;
            const dx3 = targetPos3.x - myPos3.x;
            const dy3 = targetPos3.y - myPos3.y;
            const distanceSq3 = dx3 * dx3 + dy3 * dy3;
            const attackRangeSq3 = this.attackRange * this.attackRange;

            if (distanceSq3 <= attackRangeSq3) {
                // 在治疗范围内
                this.stopMoving();
                if (this.attackTimer >= this.attackInterval) {
                    this.healCurrentTarget();
                    this.attackTimer = 0;
                }
            } else if (distanceSq3 <= (this.attackRange * 2) * (this.attackRange * 2)) {
                // 2倍范围内，向友军移动
                this.moveTowardsAlly(deltaTime);
            } else {
                this.stopMoving();
            }
        } else {
            // 没有目标
            this.stopMoving();
        }

        // 牧师脱战后的待机动画检测：完全空闲时尝试播放待机动画
        if (
            !this.isMoving &&
            !this.isPlayingAttackAnimation &&
            !this.isPlayingHitAnimation &&
            !this.isPlayingDeathAnimation &&
            !this.isPlayingIdleAnimation
        ) {
            this.checkAndPlayIdleAnimation();
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
     * 覆盖显示信息面板，加入圣光祈祷技能按钮
     */
    showUnitInfoPanel() {
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (this.unitSelectionManager) {
            const unitInfo = this.buildPriestUnitInfo();
            this.unitSelectionManager.selectUnit(this.node, unitInfo);
        }

        // 点击其他地方设置移动目标（复用父类逻辑）
        const canvas = find('Canvas');
        this.scheduleOnce(() => {
            if (canvas) {
                // 创建全局触摸事件处理器
                this.globalTouchHandler = (event: EventTouch) => {
                    
                    // 检查当前单位是否仍被选中
                    if (this.unitSelectionManager) {
                        const currentSelectedUnit = this.unitSelectionManager.getCurrentSelectedUnit();
                        const isSelected = this.unitSelectionManager.isUnitSelected(this.node);
                        
                        // 如果选中了其他单位（不是当前单位），移除监听器
                        if (currentSelectedUnit !== null && currentSelectedUnit !== this.node) {
                            const canvas = find('Canvas');
                            if (canvas && this.globalTouchHandler) {
                                canvas.off(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
                            }
                            this.globalTouchHandler = null!;
                            return;
                        }
                        
                        // 如果当前单位未被选中，也不执行移动操作
                        if (!isSelected || currentSelectedUnit === null) {
                            const canvas = find('Canvas');
                            if (canvas && this.globalTouchHandler) {
                                canvas.off(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
                            }
                            this.globalTouchHandler = null!;
                            return;
                        }
                    }
                    
                    // 检查点击是否在信息面板上（通过节点名称和路径检查）
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
                    
                    // 如果正在放置圣光祈祷魔法阵，不执行移动操作
                    if (this.isHolyPrayerActive) {
                        return;
                    }
                    
                    // 点击不在信息面板上，设置移动目标
                    this.setManualMoveTarget(event);
                };
                
                canvas.on(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
            }
        }, 0.1);
    }

    /**
     * 构建牧师的 UnitInfo（带圣光祈祷技能按钮）
     */
    private buildPriestUnitInfo(): UnitInfo {
        const level = this.level || 1;
        const upgradeCost = level < 3 ? (10 + (level - 1) * 10) : undefined;

        const currentHealth = (this.currentHealth !== undefined && !isNaN(this.currentHealth) && this.currentHealth >= 0)
            ? this.currentHealth
            : (this.maxHealth || 0);
        const maxHealth = (this.maxHealth !== undefined && !isNaN(this.maxHealth) && this.maxHealth > 0)
            ? this.maxHealth
            : 0;

        const unitInfo: UnitInfo = {
            name: this.unitName || '牧师',
            level: level,
            currentHealth: currentHealth,
            maxHealth: maxHealth,
            attackDamage: this.attackDamage || 0,
            populationCost: 1,
            icon: this.cardIcon || this.defaultSpriteFrame,
            collisionRadius: this.collisionRadius,
            attackRange: this.attackRange,
            attackFrequency: this.attackInterval ? 1.0 / this.attackInterval : 0,
            moveSpeed: this.moveSpeed,
            isDefending: this.isDefending,
            upgradeCost: upgradeCost,
            onUpgradeClick: level < 3 ? () => {
                this.onUpgradeClick();
            } : undefined,
            onSellClick: () => {
                this.onSellClick();
            },
            onDefendClick: () => {
                this.onDefendClick();
            },
            // 圣光祈祷技能按钮（九宫格第4个格子，UnitInfoPanel 根据 name 判断为牧师并放在索引3）
            onSkillClick: (event?: EventTouch) => {
                this.startHolyPrayerPlacement(event);
            },
            isSkillActive: false
        };

        return unitInfo;
    }

    /**
     * 开始放置圣光祈祷魔法阵：在鼠标位置出现可拖动的圆形
     * @param startEvent 来自技能按钮的触摸事件，用于确定初始位置
     */
    private startHolyPrayerPlacement(startEvent?: EventTouch) {
        //console.log'[Priest.startHolyPrayerPlacement] 开始放置圣光祈祷魔法阵，是否带起始事件:', !!startEvent);
        
        if (this.isHolyPrayerActive) {
            //console.log'[Priest.startHolyPrayerPlacement] 已经在放置魔法阵，忽略');
            return;
        }
        this.isHolyPrayerActive = true;

        const canvas = find('Canvas');
        if (!canvas) {
            console.error('[Priest.startHolyPrayerPlacement] 找不到Canvas节点');
            this.isHolyPrayerActive = false;
            return;
        }

        const canvasTransform = canvas.getComponent(UITransform);
        if (!canvasTransform) {
            console.error('[Priest.startHolyPrayerPlacement] Canvas没有UITransform组件');
            this.isHolyPrayerActive = false;
            return;
        }

        // 创建魔法阵节点
        const magicNode = new Node('HolyPrayerCircle');
        const uiTrans = magicNode.addComponent(UITransform);
        uiTrans.setContentSize(this.holyPrayerRadius * 2, this.holyPrayerRadius * 2);
        const sprite = magicNode.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.color = new Color(255, 255, 255, 180);

        magicNode.setParent(canvas);
        this.currentMagicCircleNode = magicNode;

        const updatePositionFromEvent = (event: EventTouch | EventMouse) => {
            const eventType = (event as any)?.type || 'Unknown';
            const targetName = ((event as any)?.target && (event as any).target.name) || 'UnknownTarget';
            const cameraNode = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
            if (!cameraNode) {
                console.warn('[Priest.startHolyPrayerPlacement] 找不到Camera节点，事件类型:', eventType, '目标节点:', targetName);
                return;
            }
            const camera = cameraNode.getComponent(Camera);
            if (!camera) {
                console.warn('[Priest.startHolyPrayerPlacement] Camera节点没有Camera组件，事件类型:', eventType, '目标节点:', targetName);
                return;
            }
            
            // 统一从事件中获取屏幕坐标（支持触摸和鼠标）
            // EventTouch / EventMouse 都有 getLocation 方法
            // 这里用 any 避免类型限制
            const anyEvent: any = event as any;
            const loc = anyEvent.getLocation ? anyEvent.getLocation() : anyEvent.getLocationInView?.();
            if (!loc) {
                console.warn('[Priest.startHolyPrayerPlacement] 事件没有位置信息，无法更新魔法阵位置，事件类型:', eventType, '目标节点:', targetName);
                return;
            }
            const screenPos = new Vec3(loc.x, loc.y, 0);
            const worldPos = new Vec3();
            camera.screenToWorld(screenPos, worldPos);
            worldPos.z = 0;
            
            // 转换为Canvas本地坐标
            const localPos = canvasTransform.convertToNodeSpaceAR(worldPos);
            magicNode.setPosition(localPos);

            // console.log'[Priest.startHolyPrayerPlacement] 更新魔法阵位置',
                // '事件类型:', eventType,
                // '目标节点:', targetName,
                // '屏幕坐标:', screenPos,
                // '世界坐标:', worldPos,
                // '本地坐标:', localPos);
        };

        // 如果有来自技能按钮的起始事件，立即根据该事件设置一次位置
        if (startEvent) {
            try {
                updatePositionFromEvent(startEvent);
            } catch (e) {
                console.warn('[Priest.startHolyPrayerPlacement] 根据起始事件更新位置失败:', e);
            }
        }

        const onTouchMove = (event: EventTouch) => {
            if (!this.isHolyPrayerActive || !magicNode.isValid) {
                //console.log'[Priest.startHolyPrayerPlacement] onTouchMove 被忽略，isHolyPrayerActive =', this.isHolyPrayerActive, 'magicNode.isValid =', magicNode.isValid);
                return;
            }
            updatePositionFromEvent(event);
        };

        const finishTouchAndCast = (event: EventTouch | null) => {
            if (event) {
                // 防止事件继续传递到弓箭手等单位的点击/移动逻辑，导致交互冲突
                (event as any).propagationStopped = true;
            }

            // 取消 Canvas 上的事件监听（与 on 中的捕获阶段参数保持一致）
            (canvas as any).off(Node.EventType.TOUCH_MOVE, onTouchMove, this, true);
            (canvas as any).off(Node.EventType.TOUCH_END, onTouchEnd, this, true);
            (canvas as any).off(Node.EventType.TOUCH_CANCEL, onTouchCancel, this, true);
            (canvas as any).off(Node.EventType.MOUSE_MOVE, onMouseMove, this, true);
            (canvas as any).off(Node.EventType.MOUSE_UP, onMouseUp, this, true);

            if (!this.isHolyPrayerActive || !magicNode.isValid) {
                console.warn('[Priest.startHolyPrayerPlacement] 魔法阵状态无效，取消施放',
                    'isHolyPrayerActive =', this.isHolyPrayerActive,
                    'magicNode.isValid =', magicNode.isValid);
                this.isHolyPrayerActive = false;
                if (magicNode && magicNode.isValid) {
                    magicNode.destroy();
                }
                this.currentMagicCircleNode = null!;
                return;
            }

            // 使用当前魔法阵的世界坐标作为最终落点
            const worldPos = magicNode.worldPosition.clone();

            // 施放治疗效果（手动释放）
            this.castHolyPrayer(worldPos, magicNode, false);

            // 在 castHolyPrayer 中处理魔法阵的渐隐和销毁
            this.isHolyPrayerActive = false;
        };

        const onTouchEnd = (event: EventTouch) => {
            // 正常的触摸松手
            finishTouchAndCast(event);
        };

        const onTouchCancel = (event: EventTouch) => {
            // 在手机上，手指滑出屏幕/系统中断触摸时会触发 TOUCH_CANCEL
            // 这里也按松手处理，避免“魔法阵停在那儿但不释放治疗”的情况
            finishTouchAndCast(event);
        };

        const onMouseMove = (event: EventMouse) => {
            if (!this.isHolyPrayerActive || !magicNode.isValid) {
                //console.log'[Priest.startHolyPrayerPlacement] onMouseMove 被忽略，isHolyPrayerActive =', this.isHolyPrayerActive, 'magicNode.isValid =', magicNode.isValid);
                return;
            }
            updatePositionFromEvent(event);
        };

        const onMouseUp = (event: EventMouse) => {
            //console.log'[Priest.startHolyPrayerPlacement] 鼠标抬起，准备施放治疗');

            // 防止事件继续传递到弓箭手等单位的点击/移动逻辑，导致交互冲突
            (event as any).propagationStopped = true;

            (canvas as any).off(Node.EventType.MOUSE_MOVE, onMouseMove, this, true);
            (canvas as any).off(Node.EventType.MOUSE_UP, onMouseUp, this, true);
            (canvas as any).off(Node.EventType.TOUCH_MOVE, onTouchMove, this, true);
            (canvas as any).off(Node.EventType.TOUCH_END, onTouchEnd, this, true);

            if (!this.isHolyPrayerActive || !magicNode.isValid) {
                console.warn('[Priest.startHolyPrayerPlacement] 魔法阵状态无效，取消施放（鼠标）',
                    'isHolyPrayerActive =', this.isHolyPrayerActive,
                    'magicNode.isValid =', magicNode.isValid);
                this.isHolyPrayerActive = false;
                if (magicNode && magicNode.isValid) {
                    magicNode.destroy();
                }
                this.currentMagicCircleNode = null!;
                return;
            }

            // 直接使用当前魔法阵的世界坐标，不再重新计算
            const worldPos = magicNode.worldPosition.clone();
            //console.log'[Priest.startHolyPrayerPlacement] 魔法阵最终世界坐标(鼠标):', worldPos);

            // 手动释放
            this.castHolyPrayer(worldPos, magicNode, false);

            this.isHolyPrayerActive = false;
        };

        // 使用 Canvas 节点监听拖动和松开事件（捕获阶段），避免被单位自己的事件拦截
        // 这样即使拖动经过弓箭手等单位，只要在 Canvas 范围内，事件都会先经过这里
        (canvas as any).on(Node.EventType.TOUCH_MOVE, onTouchMove, this, true);
        (canvas as any).on(Node.EventType.TOUCH_END, onTouchEnd, this, true);
        (canvas as any).on(Node.EventType.TOUCH_CANCEL, onTouchCancel, this, true);
        (canvas as any).on(Node.EventType.MOUSE_MOVE, onMouseMove, this, true);
        (canvas as any).on(Node.EventType.MOUSE_UP, onMouseUp, this, true);

        // 加载魔法阵贴图（mofazhen1.png）
        resources.load('textures/mofazhen1/spriteFrame', CCSpriteFrame, (err, sf) => {
            if (err) {
                console.error('[Priest.startHolyPrayerPlacement] 加载圣光祈祷魔法阵贴图失败:', err);
                return;
            }
            if (sprite && sprite.node && sprite.node.isValid) {
                sprite.spriteFrame = sf;
                //console.log'[Priest.startHolyPrayerPlacement] 魔法阵贴图加载成功');
            }
        });
    }

    /**
     * 在指定位置施放圣光祈祷：范围持续治疗 + 牧师自身动画 + 魔法阵渐隐特效
     * @param centerWorldPos 祈祷中心世界坐标
     * @param magicNode 魔法阵节点（可选）
     * @param isAuto 是否为自动释放
     */
    private castHolyPrayer(centerWorldPos: Vec3, magicNode?: Node | null, isAuto: boolean = false) {
        //console.log'[Priest.castHolyPrayer] 开始施放圣光祈祷，中心位置:', centerWorldPos);

        // 先尝试消耗蓝量（每次祈祷消耗20点蓝量），蓝量不足时取消施放
        if (!this.consumeMana(this.HOLY_PRAYER_MANA_COST)) {
            //console.log'[Priest.castHolyPrayer] 蓝量不足，无法施放圣光祈祷，当前蓝量：', (this as any).currentMana);
            if (magicNode && magicNode.isValid) {
                magicNode.destroy();
                if (this.currentMagicCircleNode === magicNode) {
                    this.currentMagicCircleNode = null!;
                }
            }
            return;
        }

        // 播放圣光祈祷音效（1.5倍音量，使用专用节点避免被其他音效打断）
        if (this.holyPrayerSound && AudioManager.Instance) {
            AudioManager.Instance.playHolyPrayerSFX(this.holyPrayerSound, 1.5);
        }

        // 播放牧师自身的攻击动画（释放祈祷时的动作，速度减慢一倍 / 三倍）
        this.playPrayerAttackAnimation();
        
        // 自动祈祷时播放固定战斗口号
        if (isAuto) {
            this.createDialog('愿圣光庇佑你！', false);
        }
        
        // 播放牧师自身的圣光祈祷动画（需要在预制体的 Animation 里配置对应状态名）
        const anim = this.node.getComponent(Animation);
        if (anim) {
            if (anim.getState('HolyPrayer')) {
                anim.play('HolyPrayer');
                //console.log'[Priest.castHolyPrayer] 播放圣光祈祷动画');
            } else {
                //console.log'[Priest.castHolyPrayer] 未找到HolyPrayer动画状态，跳过动画播放');
            }
        } else {
            //console.log'[Priest.castHolyPrayer] 牧师节点没有Animation组件，跳过动画播放');
        }

        // 范围治疗：5秒，每0.5秒一次
        const ticks = Math.floor(this.holyPrayerDuration / this.holyPrayerTickInterval);
        const healPerTick = Math.round((this.attackDamage || 0) / 4);
        const radius = this.holyPrayerRadius;

        //console.log('[Priest.castHolyPrayer] 治疗参数 - 总次数:', ticks, '每次治疗量:', healPerTick, '半径:', radius, '攻击力:', this.attackDamage);

        for (let i = 0; i < ticks; i++) {
            const delayTime = i * this.holyPrayerTickInterval;
            this.scheduleOnce(() => {
                // 分次治疗时不再逐条打印日志，以避免在单位密集（例如大量弓箭手）时造成卡顿
                this.healAlliesInCircle(centerWorldPos, radius, healPerTick);
            }, delayTime);
        }

        // 魔法阵渐隐 + 内部特效
        if (magicNode && magicNode.isValid) {
            // 魔法阵透明度变化：
            // 前2秒：从100%透明度（255）到50%透明度（128）
            // 后8秒：保持10%透明度（26）直到治疗结束
            const uiOpacity = magicNode.getComponent(UIOpacity) || magicNode.addComponent(UIOpacity);
            uiOpacity.opacity = 255; // 初始100%透明度

            // 前2秒：从100%到50%
            tween(uiOpacity)
                .to(2, { opacity: 128 })
                .then(
                    // 后8秒：保持10%透明度
                    tween(uiOpacity)
                        .to(8, { opacity: 26 })
                        .call(() => {
                            //console.log'[Priest.castHolyPrayer] 魔法阵显示结束，销毁节点');
                            if (magicNode && magicNode.isValid) {
                                magicNode.destroy();
                            }
                            if (this.currentMagicCircleNode === magicNode) {
                                this.currentMagicCircleNode = null!;
                            }
                        })
                )
                .start();

            // 在魔法阵内部播放牧师配置的圣光祈祷动画帧（如果有配置）
            if (this.holyPrayerEffectFrames && this.holyPrayerEffectFrames.length > 0) {
                const effectNode = new Node('HolyPrayerEffect');
                effectNode.setParent(magicNode);
                effectNode.setPosition(0, 0, 0);

                const effectTransform = effectNode.addComponent(UITransform);
                const circleSize = magicNode.getComponent(UITransform)?.contentSize;
                if (circleSize) {
                    // 稍微比魔法阵小一点
                    effectTransform.setContentSize(circleSize.width * 0.8, circleSize.height * 0.8);
                }

                const effectSprite = effectNode.addComponent(Sprite);
                effectSprite.sizeMode = Sprite.SizeMode.CUSTOM;

                const frames = this.holyPrayerEffectFrames;
                const animationDuration = 2; // 动画帧2秒播放完毕
                const frameCount = frames.length;
                const frameDuration = animationDuration / frameCount;

                let frameIndex = 0;
                effectSprite.spriteFrame = frames[frameIndex];

                // 动画帧透明度：从100%到50%
                const effectOpacity = effectNode.addComponent(UIOpacity);
                effectOpacity.opacity = 255; // 初始100%透明度

                // 动画帧在2秒内从100%透明度到50%透明度
                tween(effectOpacity)
                    .to(2, { opacity: 128 })
                    .call(() => {
                        // 2秒后隐藏动画帧节点
                        if (effectNode && effectNode.isValid) {
                            effectNode.destroy();
                        }
                    })
                    .start();

                // 使用 schedule 周期切换帧，在2秒内播完
                let isAnimationComplete = false;
                const frameUpdateCallback = () => {
                    if (!effectNode.isValid || !magicNode.isValid || isAnimationComplete) {
                        return;
                    }
                    frameIndex++;
                    if (frameIndex >= frameCount) {
                        // 动画播放完毕，停止切换帧
                        isAnimationComplete = true;
                        frameIndex = frameCount - 1; // 停在最后一帧
                    }
                    if (effectSprite && effectSprite.node && effectSprite.node.isValid) {
                        effectSprite.spriteFrame = frames[frameIndex];
                    }
                };

                this.schedule(
                    frameUpdateCallback,
                    frameDuration,
                    frameCount - 1,
                    frameDuration
                );
            } else {
                //console.log'[Priest.castHolyPrayer] 未配置 holyPrayerEffectFrames，不在魔法阵内部播放额外特效');
            }
        }
    }

    /**
     * 自动圣光祈祷：每隔固定时间，以最近的受伤友军为中心施放
     */
    private tryAutoCastHolyPrayer() {
        if (this.isDestroyed || this.isHolyPrayerActive) {
            return;
        }

        // 查找最近的受伤友军作为中心
        const center = this.findBestHolyPrayerCenter();
        if (!center) {
            return;
        }

        // 在该位置创建一个魔法阵节点（与手动释放共用视觉效果）
        const magicNode = this.createHolyPrayerCircleAt(center);

        // 施放圣光祈祷（内部会检查蓝量，不足则直接返回，标记为自动释放）
        this.castHolyPrayer(center, magicNode, true);
    }

    /**
     * 查找用于圣光祈祷的最佳中心点：
     * 以距离牧师最近的受伤友军为中心
     */
    private findBestHolyPrayerCenter(): Vec3 | null {
        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        // 使用与寻找治疗目标类似的范围，这里使用 4 倍治疗范围
        const candidates = this.getFriendlyUnits(true, this.attackRange * 4);
        if (!candidates || candidates.length === 0) {
            return null;
        }

        let nearest: Node | null = null;
        let minDist = Infinity;
        const myPos = this.node.worldPosition;

        for (const node of candidates) {
            const dx = node.worldPosition.x - myPos.x;
            const dy = node.worldPosition.y - myPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
                minDist = dist;
                nearest = node;
            }
        }

        return nearest ? nearest.worldPosition.clone() : null;
    }

    /**
     * 在指定世界坐标创建一个圣光祈祷魔法阵节点（用于自动施放）
     */
    private createHolyPrayerCircleAt(centerWorldPos: Vec3): Node | null {
        const canvas = find('Canvas');
        if (!canvas) {
            console.error('[Priest.createHolyPrayerCircleAt] 找不到Canvas节点');
            return null;
        }
        const canvasTransform = canvas.getComponent(UITransform);
        if (!canvasTransform) {
            console.error('[Priest.createHolyPrayerCircleAt] Canvas没有UITransform组件');
            return null;
        }

        const magicNode = new Node('HolyPrayerCircleAuto');
        const uiTrans = magicNode.addComponent(UITransform);
        uiTrans.setContentSize(this.holyPrayerRadius * 2, this.holyPrayerRadius * 2);
        const sprite = magicNode.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.color = new Color(255, 255, 255, 180);

        magicNode.setParent(canvas);

        // 将世界坐标转换为 Canvas 本地坐标
        const localPos = canvasTransform.convertToNodeSpaceAR(centerWorldPos);
        magicNode.setPosition(localPos);

        // 记录当前魔法阵节点，便于后续销毁
        this.currentMagicCircleNode = magicNode;

        // 加载魔法阵贴图（与手动释放共用）
        resources.load('textures/mofazhen1/spriteFrame', CCSpriteFrame, (err, sf) => {
            if (err) {
                console.error('[Priest.createHolyPrayerCircleAt] 加载圣光祈祷魔法阵贴图失败:', err);
                return;
            }
            if (sprite && sprite.node && sprite.node.isValid) {
                sprite.spriteFrame = sf;
            }
        });

        return magicNode;
    }

    /**
     * 仅用于圣光祈祷时的“慢速”攻击动画：
     * 临时将攻击动画时长加倍，然后调用父类的播放逻辑
     */
    private playPrayerAttackAnimation() {
        const originalDuration = this.attackAnimationDuration;
        this.attackAnimationDuration = originalDuration * 3;
        try {
            super.playAttackAnimation();
        } finally {
            // 恢复原始时长，避免影响普通治疗攻击
            this.attackAnimationDuration = originalDuration;
        }
    }

    /**
     * 治疗魔法阵范围内的所有友军
     */
    private healAlliesInCircle(centerWorldPos: Vec3, radius: number, healAmount: number) {
        // 这里只打印一次汇总日志即可，避免对每个单位、多次tick都刷日志导致卡顿
        //console.log'[Priest.healAlliesInCircle] 开始治疗，中心:', centerWorldPos, '半径:', radius, '治疗量:', healAmount);
        
        const scene = this.node.scene;
        if (!scene || healAmount <= 0) {
            console.warn('[Priest.healAlliesInCircle] 场景无效或治疗量<=0，取消治疗');
            return;
        }

        let healedCount = 0;
        const visitNode = (node: Node) => {
            if (!node || !node.isValid || !node.active) {
                return;
            }

            // 只考虑友军单位和建筑物
            // 单位：Arrower / Hunter / ElfSwordsman / Priest / Role
            // 建筑物：Build 及其子类（SwordsmanHall / HunterHall / WarAncientTree / Church / IceTower / WatchTower / ThunderTower / StoneWall 等）
            const arrower = node.getComponent('Arrower') as any;
            const hunter = node.getComponent('Hunter') as any;
            const swordsman = node.getComponent('ElfSwordsman') as any;
            const priest = node.getComponent('Priest') as any;
            const role = node.getComponent('Role') as any;
            const buildBase = node.getComponent('Build') as any;
            const swordsmanHall = node.getComponent('SwordsmanHall') as any;
            const hunterHall = node.getComponent('HunterHall') as any;
            const warAncientTree = node.getComponent('WarAncientTree') as any;
            const church = node.getComponent('Church') as any;
            const iceTower = node.getComponent('IceTower') as any;
            const watchTower = node.getComponent('WatchTower') as any;
            const thunderTower = node.getComponent('ThunderTower') as any;
            const stoneWall = node.getComponent('StoneWall') as any;

            const script =
                arrower ||
                hunter ||
                swordsman ||
                priest ||
                role ||
                buildBase ||
                swordsmanHall ||
                hunterHall ||
                warAncientTree ||
                church ||
                iceTower ||
                watchTower ||
                thunderTower ||
                stoneWall;

            if (script) {
                const unitWorldPos = node.worldPosition;
                const distance = Vec3.distance(unitWorldPos, centerWorldPos);
                
                if (distance <= radius) {
                    const maxHealth = script.maxHealth ?? 0;
                    let currentHealth = 0;
                    if (script.getHealth && typeof script.getHealth === 'function') {
                        currentHealth = script.getHealth();
                    } else if (script.currentHealth !== undefined) {
                        currentHealth = script.currentHealth;
                    }
                    
                    if (maxHealth > 0 && currentHealth < maxHealth) {
                        if (script.heal && typeof script.heal === 'function') {
                            script.heal(healAmount);
                            healedCount++;
                            // 单位很多时逐个打印会造成性能问题，这里去掉详细日志

                            // 记录治疗贡献
                            try {
                                const damageStats = DamageStatistics.getInstance();
                                const unitTypeNameMap = DamageStatistics.getUnitTypeNameMap();
                                const unitType = this.constructor.name; // 'Priest'
                                let unitName: string;
                                if (this.unitName && this.unitName.trim() !== '') {
                                    unitName = this.unitName;
                                } else {
                                    unitName = unitTypeNameMap.get(unitType) || '牧师';
                                }
                                damageStats.recordHeal(unitType, unitName, healAmount);
                            } catch (e) {
                                console.error('[Priest.healAlliesInCircle] 记录治疗贡献失败:', e);
                            }
                        }
                    }
                }
            }

            // 递归遍历子节点
            for (const child of node.children) {
                visitNode(child);
            }
        };

        // 从场景根节点开始遍历
        visitNode(scene);
        
        //console.log'[Priest.healAlliesInCircle] 本次治疗完成，共治疗', healedCount, '个单位');
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

            // 记录牧师的治疗贡献到统计系统
            try {
                const damageStats = DamageStatistics.getInstance();
                const unitTypeNameMap = DamageStatistics.getUnitTypeNameMap();
                // 优先使用 this.unitName，避免 constructor.name 在代码压缩后变成单个字母（如 't'）
                const unitType = this.constructor.name; // 'Priest'
                let unitName: string;
                
                // 优先使用 this.unitName（在编辑器中已设置）
                if (this.unitName && this.unitName.trim() !== '') {
                    unitName = this.unitName;
                } else {
                    // 如果 this.unitName 为空，尝试从映射表获取，最后使用默认值
                    unitName = unitTypeNameMap.get(unitType) || '牧师';
                }
                
                damageStats.recordHeal(unitType, unitName, healAmount);
            } catch (e) {
                // 忽略异常，避免影响战斗流程
            }
        });
    }
}


