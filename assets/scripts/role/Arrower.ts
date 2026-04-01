import { _decorator, SpriteFrame, Prefab, Texture2D, AudioClip, Vec3, Node, instantiate, find, sys, EventTouch } from 'cc';
import { Role } from './Role';
import { AudioManager } from '../AudioManager';
import { Arrow } from '../Arrow';
import { Arrow2 } from '../Arrow2';
import { UnitInfo } from '../UnitInfoPanel';
import { PlayerDataManager } from '../PlayerDataManager';
import { GamePopup } from '../GamePopup';
const { ccclass, property } = _decorator;

@ccclass('Arrower')
export class Arrower extends Role {
    // SP：多重箭 - 最终伤害衰减（由 BuffManager 写入到 _spMultiArrowDamageMul）
    // 说明：必须在控弦/攻击力卡等所有加成计算完成后，再做最终乘区衰减
    // 重写父类属性，设置 Arrower 的默认值
    @property({ override: true })
    maxHealth: number = 50;

    @property({ override: true })
    attackRange: number = 200;

    @property({ override: true })
    attackDamage: number = 10;

    @property({ override: true })
    attackInterval: number = 1.0;

    @property({ type: Prefab, override: true })
    bulletPrefab: Prefab = null!;

    @property({ type: Prefab, override: true })
    arrowPrefab: Prefab = null!; // 弓箭预制体（支持后期更新贴图）

    @property({ type: Prefab, override: true })
    explosionEffect: Prefab = null!;

    @property({ type: Prefab, override: true })
    damageNumberPrefab: Prefab = null!;

    @property({ override: true })
    buildCost: number = 5; // 建造成本（用于回收和升级）
    
    @property({ override: true })
    level: number = 1; // 弓箭手等级

    // 攻击动画相关属性
    @property({ type: SpriteFrame, override: true })
    attackAnimationFrames: SpriteFrame[] = []; // 攻击动画帧数组（推荐：在编辑器中手动设置）
    
    // 被攻击动画相关属性
    @property({ type: SpriteFrame, override: true })
    hitAnimationFrames: SpriteFrame[] = []; // 被攻击动画帧数组
    
    // 死亡动画相关属性
    @property({ type: SpriteFrame, override: true })
    deathAnimationFrames: SpriteFrame[] = []; // 死亡动画帧数组
    
    // 音效相关属性
    @property({ type: AudioClip, override: true })
    shootSound: AudioClip = null!; // 箭矢射出时的音效
    
    @property({ type: AudioClip, override: true })
    hitSound: AudioClip = null!; // 箭矢击中敌人时的音效

    // 弓弦松紧小游戏：长按时的持续音效（按固定节奏循环触发，资源挂在弓箭手预制体上）
    @property({ type: AudioClip })
    bowstringHoldSound: AudioClip = null!;

    @property({ type: Texture2D, override: true })
    attackAnimationTexture: Texture2D = null!; // 攻击动画纹理（12帧图片）

    @property({ override: true })
    framesPerRow: number = 12; // 每行帧数（横向排列为12，3x4网格为3，4x3网格为4）

    @property({ override: true })
    totalFrames: number = 12; // 总帧数

    @property({ override: true })
    attackAnimationDuration: number = 0.5; // 攻击动画时长（秒）
    
    @property({ override: true })
    hitAnimationDuration: number = 0.3; // 被攻击动画时长（秒）
    
    @property({ override: true })
    deathAnimationDuration: number = 1.0; // 死亡动画时长（秒）

    // 移动相关属性
    @property({ override: true })
    moveSpeed: number = 100; // 移动速度（像素/秒）

    @property({ type: SpriteFrame, override: true })
    moveAnimationFrames: SpriteFrame[] = []; // 移动动画帧数组（可选）

    @property({ override: true })
    moveAnimationDuration: number = 0.3; // 移动动画时长（秒）

    @property({ override: true })
    collisionRadius: number = 10; // 碰撞半径（像素）

    @property({ type: SpriteFrame, override: true })
    cardIcon: SpriteFrame = null!; // 单位名片图片
    
    // 单位信息属性
    @property({ override: true })
    unitName: string = "弓箭手";
    
    @property({ override: true })
    unitDescription: string = "你就是城里来的指挥官吗？看起来还不赖，暂且相信你好了。";
    
    @property({ type: SpriteFrame, override: true })
    unitIcon: SpriteFrame = null!;

    // 首个弓箭手“紧弓弦”互动资源（直接挂在弓箭手预制体上）
    @property({ type: [SpriteFrame] })
    bowstringTensionFrames: SpriteFrame[] = []; // 弓弦松紧序列帧（建议从“最松”到“最紧”）

    @property({ type: SpriteFrame })
    bowstringMoodExcellentIcon: SpriteFrame = null!; // 结算-最佳情绪图

    @property({ type: SpriteFrame })
    bowstringMoodGoodIcon: SpriteFrame = null!; // 结算-良好情绪图

    @property({ type: SpriteFrame })
    bowstringMoodBadIcon: SpriteFrame = null!; // 结算-较差情绪图

    // 3级专用：强化版箭矢预制体（Arrow2）
    @property({ type: Prefab })
    level3ArrowPrefab: Prefab = null!;
    
    // 技能相关属性
    private readonly PENETRATE_ARROW_MANA_COST: number = 10; // 穿透箭消耗蓝量
    private isPenetrateArrowEnabled: boolean = false; // 穿透箭开关（每个弓箭手独立，默认关闭）

    // 弓弦调整技能（九宫格第六格）：30 秒冷却（使用真实时间，暂停不影响冷却计时）
    // 冷却状态由 GameManager.bowstringSkillGlobalCooldownEndMs 全局管理，所有弓箭手共享
    private readonly BOWSTRING_SKILL_COOLDOWN_MS: number = 30_000;

    // 当前弓弦松紧带来的攻击倍率（只作用于本弓箭手实例；不叠加，直接覆盖）
    public bowstringAttackMultiplier: number = 1.0;

    battleSlogans: string[] = ['箭如雨下！', '射击！射击！射击！', '瞄准，射击！', '弓弦紧绷射天狼!', '箭似流星！','射箭！射箭！射箭！', 'Biu! Biu! Biu!'];
    private readonly SP_MULTI_ARROW_SLOGAN = '我的箭……会分叉？';

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

        const spEnabled = (Number((this as any)._spMultiArrowExtraTargets) || 0) > 0;
        if (spEnabled && Math.random() < 0.5) {
            this.createDialog(this.SP_MULTI_ARROW_SLOGAN, false);
        } else {
            this.createDialog();
        }
        anyThis.dialogIntervalTimer = 0;
        anyThis.dialogTimer = 0;
    }

    /**
     * 重写父类的checkSkill方法，检查是否有穿透箭技能
     * 技能状态由isPenetrateArrowEnabled控制，每个弓箭手独立
     */
    protected checkSkill() {
        // 技能状态由isPenetrateArrowEnabled控制，如果开启则hasSkill为true
        this.hasSkill = this.isPenetrateArrowEnabled;
    }
    
    /**
     * 重写父类的createArrow：
     * - 1、2级：使用普通箭矢逻辑（父类实现）
     * - 3级或拥有技能：使用 Arrow2 预制体，直线弹道，穿透第一个敌人后继续飞行100像素
     * - 有技能时：检查蓝量，有蓝自动使用穿透箭，没蓝使用普通箭
     */
    protected createArrow() {
        // 用临时 attackDamage 参与本次射击（不持久修改，避免误影响其它弓箭手）
        const effDamage = this.getEffectiveAttackDamage();
        this.withTempAttackDamage(effDamage, () => {
            // 检查是否有技能且蓝量足够
            const usePenetrateArrow = this.hasSkill && this.hasEnoughMana(this.PENETRATE_ARROW_MANA_COST);
            
            // 如果有技能且蓝量足够，使用穿透箭
            if (usePenetrateArrow && this.level3ArrowPrefab) {
                // 消耗蓝量
                this.consumeMana(this.PENETRATE_ARROW_MANA_COST);
                // 使用穿透箭逻辑
                this.createPenetrateArrow();
                return;
            }
            
            // 等级小于3或没有技能，保持原有逻辑
            if (this.level < 3 || !this.level3ArrowPrefab) {
                // SP：多重箭（仅作用于普通箭，不覆盖穿透箭）
                const extraTargets = Math.max(0, Math.floor(Number((this as any)._spMultiArrowExtraTargets) || 0));
                if (extraTargets > 0) {
                    this.createMultiArrow(extraTargets, this.attackDamage);
                } else {
                    // 使用父类的普通箭矢逻辑
                    // @ts-ignore 通过索引访问以避免编译器对protected的限制提示
                    super['createArrow']();
                }
                return;
            }
            
            // 3级但没有技能或蓝量不足，使用普通箭
            // @ts-ignore
            {
                const extraTargets = Math.max(0, Math.floor(Number((this as any)._spMultiArrowExtraTargets) || 0));
                if (extraTargets > 0) {
                    this.createMultiArrow(extraTargets, this.attackDamage);
                } else {
                    super['createArrow']();
                }
            }
        });
    }

    private createMultiArrow(extraTargets: number, baseDamage: number) {
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
            return;
        }
        const maxTargets = 1 + extraTargets;
        const enemies = this.getEnemies(true, this.attackRange);
        if (!enemies || enemies.length === 0) {
            return;
        }
        const myPos = this.node.worldPosition;
        // 以距离排序，优先近的；确保 currentTarget 在列表里
        const list = enemies
            .filter(e => e && e.isValid && e.active && this.isAliveEnemy(e))
            .sort((a, b) => {
                const da = (a.worldPosition.x - myPos.x) ** 2 + (a.worldPosition.y - myPos.y) ** 2;
                const db = (b.worldPosition.x - myPos.x) ** 2 + (b.worldPosition.y - myPos.y) ** 2;
                return da - db;
            });
        // 把当前目标放在最前
        const targets: Node[] = [];
        targets.push(this.currentTarget);
        for (const e of list) {
            if (targets.length >= maxTargets) break;
            if (e === this.currentTarget) continue;
            targets.push(e);
        }
        const spMul = Number((this as any)._spMultiArrowDamageMul);
        const finalMul = Number.isFinite(spMul) && spMul > 0 ? spMul : 1.0;
        // 多重箭：在最终伤害（已包含控弦、攻击力卡等加成）基础上，再做 0.9^level 衰减
        const perDamage = Math.max(1, Math.floor((Number(baseDamage) || 0) * finalMul));

        const oldTarget = this.currentTarget;
        const oldDamage = this.attackDamage;
        try {
            for (const t of targets) {
                this.currentTarget = t;
                this.attackDamage = perDamage;
                // @ts-ignore
                super['createArrow']();
            }
        } finally {
            this.currentTarget = oldTarget;
            this.attackDamage = oldDamage;
        }
    }

    private getEffectiveAttackDamage(): number {
        const base = Number(this.attackDamage) || 0;
        const m = Number(this.bowstringAttackMultiplier) || 1.0;
        return Math.max(0, Math.round(base * Math.max(1.0, m)));
    }

    private withTempAttackDamage(tempDamage: number, fn: () => void) {
        const old = this.attackDamage;
        this.attackDamage = tempDamage;
        try {
            fn();
        } finally {
            this.attackDamage = old;
        }
    }
    
    /**
     * 创建穿透箭（使用Arrow2预制体）
     */
    private createPenetrateArrow() {

        if (!this.currentTarget || this.isDestroyed) {
            return;
        }

        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            return;
        }

        // 选择使用的箭矢预制体（优先使用3级专用的 Arrow2）
        const prefabToUse = this.level3ArrowPrefab || this.arrowPrefab;
        if (!prefabToUse) {
            // 如果未配置 Arrow2，则退回父类逻辑
            // @ts-ignore
            super['createArrow']();
            return;
        }

        // 创建弓箭节点
        const arrowNode = instantiate(prefabToUse);

        // 设置父节点（添加到场景或Canvas）
        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            arrowNode.setParent(parentNode);
        } else {
            arrowNode.setParent(this.node.parent);
        }

        // 设置初始位置（弓箭手位置）
        const startPos = this.node.worldPosition.clone();
        arrowNode.setWorldPosition(startPos);

        // 确保节点激活
        arrowNode.active = true;

        // 获取或添加Arrow2组件（3级专用穿透箭）
        let arrow2Script = arrowNode.getComponent(Arrow2);
        if (!arrow2Script) {
            arrow2Script = arrowNode.addComponent(Arrow2);
        }

        // 播放箭矢射出音效
        if (this.shootSound && AudioManager.Instance) {
            AudioManager.Instance.playSFX(this.shootSound);
        }

        const targetNode = this.currentTarget;
        const baseDamage = this.attackDamage;

        // 记录是否已播放过音效
        let hasPlayedHitSound = false;

        // 初始化穿透箭，设置命中回调
        arrow2Script.init(
            startPos,
            targetNode,
            baseDamage,
            (damage: number, hitPos: Vec3, enemy: Node) => {
                // 播放击中音效（只在第一次命中时播放）
                if (!hasPlayedHitSound && this.hitSound) {
                    AudioManager.Instance?.playSFX(this.hitSound);
                    hasPlayedHitSound = true;
                }

                // 检查敌人是否有效
                if (!enemy || !enemy.isValid || !enemy.active) {
                    return;
                }

                // 检查是否是存活敌人
                if (!this.isAliveEnemy(enemy)) {
                    return;
                }

                // 获取敌人脚本并造成伤害
                const enemyScript = this.getEnemyScript(enemy);
                if (enemyScript && enemyScript.takeDamage) {
                    // 计算受力方向：从弓箭手指向被击中的敌人
                    const hitDirection = new Vec3();
                    Vec3.subtract(hitDirection, enemy.worldPosition, this.node.worldPosition);
                    if (hitDirection.length() > 0.001) {
                        hitDirection.normalize();
                    }
                    enemyScript.takeDamage(damage, hitDirection);
                    // 记录伤害统计
                    this.recordDamageToStatistics(damage);
                }
            }
        );
    }

    /**
     * 构建弓箭手专用的 UnitInfo（包含穿透箭技能）
     */
    public buildArrowerUnitInfo(): UnitInfo {
        // 计算升级费用：1到2级是10金币，此后每次升级多10金币
        const upgradeCost = this.level < 3 ? (10 + (this.level - 1) * 10) : undefined;
        
        // 确保生命值有效
        const currentHealth = (this.currentHealth !== undefined && !isNaN(this.currentHealth) && this.currentHealth >= 0) 
            ? this.currentHealth 
            : (this.maxHealth || 0);
        const maxHealth = (this.maxHealth !== undefined && !isNaN(this.maxHealth) && this.maxHealth > 0) 
            ? this.maxHealth 
            : 0;
        
        // 获取当前技能状态（每个弓箭手独立）
        const isSkillActive = this.isPenetrateArrowEnabled;

        const unitInfo: UnitInfo = {
            name: this.unitName || '角色',
            level: this.level,
            currentHealth: currentHealth,
            maxHealth: maxHealth,
            attackDamage: this.getEffectiveAttackDamage(),
            populationCost: 1,
            icon: this.cardIcon || this.defaultSpriteFrame,
            collisionRadius: this.collisionRadius,
            attackRange: this.attackRange,
            attackFrequency: 1.0 / this.attackInterval,
            moveSpeed: this.moveSpeed,
            isDefending: this.isDefending,
            upgradeCost: upgradeCost,
            onUpgradeClick: this.level < 3 ? () => {
                this.onUpgradeClick();
            } : undefined,
            onSellClick: () => {
                this.onSellClick();
            },
            onDefendClick: () => {
                this.onDefendClick();
            },
            onSkillClick: () => {
                // 切换技能状态（每个弓箭手独立）
                this.isPenetrateArrowEnabled = !this.isPenetrateArrowEnabled;
                
                // 更新技能状态
                this.hasSkill = this.isPenetrateArrowEnabled;
                
                // 如果技能激活，创建蓝量条；否则隐藏
                if (this.isPenetrateArrowEnabled) {
                    if (!this.manaBarNode || !this.manaBarNode.isValid) {
                        this.createManaBar();
                    } else {
                        this.manaBarNode.active = true;
                        // 确保蓝条出现时血条也同时可见
                        if (this.healthBarNode && this.healthBarNode.isValid) {
                            this.healthBarNode.active = true;
                        }
                    }
                } else {
                    if (this.manaBarNode && this.manaBarNode.isValid) {
                        this.manaBarNode.active = false;
                    }
                }
                
                // 刷新面板显示（更新按钮状态）
                if (this.unitSelectionManager) {
                    const unitInfoPanel = (this.unitSelectionManager as any).unitInfoPanel;
                    if (unitInfoPanel) {
                        // 更新unitInfo的技能状态
                        const updatedUnitInfo: UnitInfo = {
                            ...this.buildArrowerUnitInfo(),
                            isSkillActive: this.isPenetrateArrowEnabled
                        };
                        unitInfoPanel.updateButtons(updatedUnitInfo);
                    }
                }
            },
            onSkill2Click: () => {
                this.onBowstringSkillClick();
            },
            isSkillActive: isSkillActive
        };

        // 第二技能冷却信息（用于 UI 显示）
        unitInfo.skill2CooldownTotalSec = this.BOWSTRING_SKILL_COOLDOWN_MS / 1000;
        unitInfo.skill2CooldownRemainingSec = this.getBowstringSkillCooldownRemainingSec();

        return unitInfo;
    }

    private getBowstringSkillCooldownRemainingSec(): number {
        // 所有弓箭手共享全局冷却，从 GameManager 读取
        if (!this.gameManager) {
            this.findGameManager();
        }
        const gm: any = this.gameManager as any;
        if (gm && gm.getBowstringSkillGlobalCooldownRemainingSec) {
            return gm.getBowstringSkillGlobalCooldownRemainingSec();
        }
        return 0;
    }

    private refreshUnitInfoPanelIfSelected() {
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (!this.unitSelectionManager) {
            return;
        }
        if ((this.unitSelectionManager as any).isUnitSelected && !(this.unitSelectionManager as any).isUnitSelected(this.node)) {
            return;
        }
        const unitInfoPanel = (this.unitSelectionManager as any).unitInfoPanel;
        if (unitInfoPanel && unitInfoPanel.updateButtons) {
            const updated = this.buildArrowerUnitInfo();
            unitInfoPanel.updateButtons(updated);
        }
    }

    private onBowstringSkillClick() {
        console.log(`[BowstringSkill] click t=${Date.now()} uuid=${this.node?.uuid} name=${this.unitName}`);
        const remaining = this.getBowstringSkillCooldownRemainingSec();
        if (remaining > 0.05) {
            // 冷却中直接提示（不触发）
            GamePopup.showMessage(`技能冷却中：${Math.ceil(remaining)}s`, true, 1.2);
            this.refreshUnitInfoPanelIfSelected();
            return;
        }

        // 启动全局冷却（所有弓箭手共享）
        if (!this.gameManager) {
            this.findGameManager();
        }
        const gm: any = this.gameManager as any;
        if (gm && gm.startBowstringSkillGlobalCooldown) {
            gm.startBowstringSkillGlobalCooldown(this.BOWSTRING_SKILL_COOLDOWN_MS);
        }
        this.refreshUnitInfoPanelIfSelected();

        // 打开小游戏（不会叠加增幅：GameManager 内部用固定 baseKey 覆盖 attackDamage）
        gm?.openBowstringMiniGameForArrower?.(this);
    }

    /**
     * 重写 showUnitInfoPanel 方法，添加技能按钮
     */
    showUnitInfoPanel() {
        // 显示单位信息面板和范围
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (this.unitSelectionManager) {
            const unitInfo: UnitInfo = this.buildArrowerUnitInfo();
            this.unitSelectionManager.selectUnit(this.node, unitInfo);
        }

        // 点击其他地方设置移动目标
        const canvas = find('Canvas');
        this.scheduleOnce(() => {
            if (canvas) {
                // 创建全局触摸事件处理器
                this.globalTouchHandler = (event: EventTouch) => {
                    
                    // 检查当前单位是否仍被选中
                    // 注意：globalTouchHandler只有在单位被选中时才会注册
                    // 但如果选中状态在onGlobalTouchEnd中被清除，这里检查可能返回false
                    // 所以我们需要检查：如果getCurrentSelectedUnit()不为null且不是当前单位，说明选中了其他单位，应该移除监听器
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
                        // 或者如果没有任何选中（currentSelectedUnit为null），也不执行移动操作
                        if (!isSelected || currentSelectedUnit === null) {
                            // 移除监听器，因为单位已不再被选中
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
                        // 检查目标节点或其父节点是否是信息面板
                        let currentNode: Node | null = targetNode;
                        while (currentNode) {
                            // 检查节点名称是否包含 UnitInfoPanel（信息面板的节点名称）
                            if (currentNode.name === 'UnitInfoPanel' || currentNode.name.includes('UnitInfoPanel')) {
                                // 点击在信息面板上，不设置移动目标
                                return;
                            }
                            // 检查节点的路径是否包含 UnitInfoPanel
                            const nodePath = currentNode.getPathInHierarchy();
                            if (nodePath && nodePath.includes('UnitInfoPanel')) {
                                // 点击在信息面板上，不设置移动目标
                                return;
                            }
                            currentNode = currentNode.parent;
                            // 如果到达根节点，停止检查
                            if (!currentNode) {
                                break;
                            }
                        }
                    }
                    
                    // 点击不在信息面板上，设置移动目标
                    this.setManualMoveTarget(event);
                };
                
                canvas.on(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
            }
        }, 0.1);
    }
    
    /**
     * 重写防御按钮逻辑，确保刷新面板时仍保留穿透箭技能按钮
     */
    onDefendClick(event?: EventTouch) {
        if (event) {
            event.propagationStopped = true;
        }
        
        // 切换防御状态（沿用父类逻辑）
        this.isDefending = !this.isDefending;
        
        if (this.isDefending) {
            // 如果进入防御状态，清除手动移动目标并停止移动
            this.manualMoveTarget = null!;
            this.isManuallyControlled = false;
            this.stopMoving();
        } else {
            // 如果取消防御状态，清除手动移动目标，让单位进入正常索敌模式
            this.manualMoveTarget = null!;
            this.isManuallyControlled = false;
        }
        
        // 更新单位信息面板（刷新按钮显示，保留穿透箭）
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            const unitInfo: UnitInfo = this.buildArrowerUnitInfo();
            this.unitSelectionManager.selectUnit(this.node, unitInfo);
        }
    }

    /**
     * 重写 destroyTower 方法，在第一个弓箭手死亡时显示提示框
     */
    destroyTower() {
        // 检查是否是第一个弓箭手死亡
        if (!this.gameManager) {
            this.findGameManager();
        }

        // 如果是第一个弓箭手死亡，显示提示框
        if (this.gameManager && !(this.gameManager as any).hasShownFirstArrowerDeathPopup) {
            (this.gameManager as any).hasShownFirstArrowerDeathPopup = true;
            
            // 显示单位提示框
            if ((this.gameManager as any).unitIntroPopup) {
                const unitInfo = {
                    unitIcon: this.cardIcon || this.unitIcon || this.defaultSpriteFrame,
                    unitName: this.unitName || '弓箭手',
                    unitDescription: '请珍惜我的同伴，训练一个士兵需要耗费3枚金币'
                };
                (this.gameManager as any).unitIntroPopup.show(unitInfo);
            }
        }

        // 调用父类的 destroyTower 方法
        super.destroyTower();
    }
}