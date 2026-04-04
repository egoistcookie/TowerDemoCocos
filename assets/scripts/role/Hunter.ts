import { _decorator, SpriteFrame, Prefab, Texture2D, AudioClip, Node, Vec3, instantiate, find, UITransform, Color, Sprite, resources, UIOpacity, AudioSource } from 'cc';
import { Role } from './Role';
import { Boomerang } from '../Boomerang';
import { AudioManager } from '../AudioManager';
import { Tornado } from '../Tornado';
const { ccclass, property } = _decorator;

@ccclass('Hunter')
export class Hunter extends Role {
    // 重写父类属性，设置 Hunter 的默认值
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

    // Hunter 特有属性：回旋镖预制体
    @property({ type: Prefab })
    boomerangPrefab: Prefab = null!; // 回旋镖预制体

    @property({ type: Prefab, override: true })
    explosionEffect: Prefab = null!;

    @property({ type: Prefab, override: true })
    damageNumberPrefab: Prefab = null!;

    @property({ override: true })
    buildCost: number = 5; // 建造成本（用于回收和升级）
    
    @property({ override: true })
    level: number = 1; // 女猎手等级

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
    @property({ type: AudioClip, tooltip: '龙卷技能音效（释放后持续5秒）' })
    tornadoSkillSound: AudioClip = null!;

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
    unitName: string = "女猎手";
    
    @property({ override: true })
    unitDescription: string = "远程攻击单位，投掷回旋镖攻击敌人，回旋镖可以反弹多次。";
    
    @property({ type: SpriteFrame, override: true })
    unitIcon: SpriteFrame = null!;

    battleSlogans: string[] = ['我潜行于黑暗之中！', '利爪撕破长夜！', '月神指引我的道路!', '猎杀时刻！', '瞄准，射击！']; // 战斗口号数组（可在编辑器中配置）

    // ===== 龙卷技能（技能栏第一格） =====
    @property({ type: [SpriteFrame] })
    tornadoFrames: SpriteFrame[] = [];
    @property
    tornadoRadius: number = 90;
    @property
    tornadoDuration: number = 5.0;
    @property
    tornadoDps: number = 3;
    @property
    tornadoPullPerSec: number = 30;
    @property
    tornadoAutoCastInterval: number = 20; // 自动释放间隔（秒）
    @property
    tornadoManaCost: number = 20; // 每次释放消耗蓝量
    private isTornadoPlacing: boolean = false;
    private tornadoCircleNode: Node | null = null;
    private tornadoAutoCastTimer: number = 0;
    private tornadoSFXNode: Node | null = null;
    private tornadoSFXStopSeq: number = 0;

    public override onEnable() {
        super.onEnable();
        this.tornadoAutoCastTimer = 0;
        // 龙卷技能启用状态与关卡绑定（第3关及以后）
        this.hasSkill = this.isTornadoAwakened();
        if (this.hasSkill) {
            if (!this.manaBarNode || !this.manaBarNode.isValid) {
                this.createManaBar();
            } else {
                this.manaBarNode.active = true;
                if (this.manaBar) {
                    this.manaBar.setMaxMana(this.maxMana);
                    this.manaBar.setMana(this.currentMana);
                }
            }
        } else if (this.manaBarNode && this.manaBarNode.isValid) {
            this.manaBarNode.active = false;
        }
    }

    /**
     * 重写攻击方法，使用回旋镖
     */
    attack() {
        if (!this.currentTarget || this.isDestroyed) {
            return;
        }

        // 再次检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }

        // 攻击时停止移动
        this.stopMoving();

		// 获取敌人脚本，支持OrcWarlord、OrcWarrior、Enemy、TrollSpearman、Portal
		const enemyScript = this.currentTarget.getComponent('OrcWarlord') as any || this.currentTarget.getComponent('OrcWarrior') as any || this.currentTarget.getComponent('Enemy') as any || this.currentTarget.getComponent('TrollSpearman') as any;
		const portalScript = this.currentTarget.getComponent('Portal') as any;
		if ((enemyScript && enemyScript.isAlive && enemyScript.isAlive()) || (portalScript && typeof portalScript.takeDamage === 'function')) {
            // 播放攻击动画，动画完成后才射出回旋镖
            this.playAttackAnimation(() => {
                // 动画播放完成后的回调，在这里创建回旋镖
                this.executeAttack();
            });
        } else {
            // 目标已死亡，清除目标
            this.currentTarget = null!;
        }
    }

    // === 技能按钮回调（第一格）：开始放置龙卷法阵（支持事件传入以确定初始位置） ===
    public onSkillClick(startEvent?: any) {
        if (!this.isTornadoAwakened()) return;
        this.startTornadoPlacement(startEvent);
    }

    private isTornadoAwakened(): boolean {
        // 需求：第三关之后才觉醒龙卷技能（即第3关及以后可用）
        try {
            const gm = this.gameManager as any;
            const levelFromGM = Number(gm?.getCurrentLevelSafe?.());
            if (Number.isFinite(levelFromGM)) {
                return levelFromGM >= 3;
            }
        } catch {}
        try {
            const gmNode = find('GameManager');
            const gm = gmNode?.getComponent('GameManager') as any;
            const levelFromGM = Number(gm?.getCurrentLevelSafe?.());
            if (Number.isFinite(levelFromGM)) {
                return levelFromGM >= 3;
            }
        } catch {}
        try {
            const uiManagerNode = find('UIManager') || find('UI/UIManager') || find('Canvas/UI/UIManager');
            const uiManager = uiManagerNode?.getComponent('UIManager') as any;
            const levelFromUI = Number(uiManager?.getCurrentLevel?.());
            if (Number.isFinite(levelFromUI)) {
                return levelFromUI >= 3;
            }
        } catch {}
        return false;
    }

    private startTornadoPlacement(startEvent?: any) {
        if (this.isDestroyed || this.isTornadoPlacing) return;
        this.isTornadoPlacing = true;

        const canvas = find('Canvas');
        if (!canvas) {
            this.isTornadoPlacing = false;
            return;
        }
        const canvasTransform = canvas.getComponent(UITransform);
        if (!canvasTransform) {
            this.isTornadoPlacing = false;
            return;
        }

        // 创建魔法阵（使用 hunterRing 贴图，和牧师祈祷风格一致）
        const magicNode = new Node('TornadoCircle');
        const ui = magicNode.addComponent(UITransform);
        ui.setContentSize(this.tornadoRadius * 2, this.tornadoRadius * 2);
        const ringSprite = magicNode.addComponent(Sprite);
        const ringOpacity = magicNode.addComponent(UIOpacity);
        ringOpacity.opacity = 128; // 点击技能后出现的魔法阵：50% 透明度
        resources.load('textures/hunterRing/spriteFrame', SpriteFrame, (err, frame) => {
            if (!err && frame && magicNode.isValid) {
                ringSprite.spriteFrame = frame;
                return;
            }
            resources.load('textures/hunterRing', SpriteFrame, (err2, frame2) => {
                if (!err2 && frame2 && magicNode.isValid) {
                    ringSprite.spriteFrame = frame2;
                    return;
                }
                console.warn('[Hunter] 加载龙卷预览圈 hunterRing 失败:', err2 || err);
            });
        });
        magicNode.setParent(canvas);
        this.tornadoCircleNode = magicNode;

        // 统一位置更新函数：直接使用 UI 坐标映射到 Canvas（不再依赖 Camera，逻辑更稳定）
        const updatePositionFromEvent = (event: any) => {
            const anyEvent: any = event as any;
            // 优先用 getUILocation（已有 UI 坐标），其次退回 getLocation
            const loc = anyEvent?.getUILocation
                ? anyEvent.getUILocation()
                : (anyEvent?.getLocation ? anyEvent.getLocation() : anyEvent?.getLocationInView?.());
            if (!loc) return;
            // Canvas 是屏幕空间 UI，直接用设计分辨率宽高做偏移换算到锚点中心坐标
            const canvasSize = canvasTransform.contentSize;
            const localPos = new Vec3(
                loc.x - canvasSize.width / 2,
                loc.y - canvasSize.height / 2,
                0
            );
            magicNode.setPosition(localPos);
        };

        // 初始事件定位
        if (startEvent) {
            try { updatePositionFromEvent(startEvent); } catch {}
        } else {
            // 没有事件时，默认放在女猎手脚下
            const local = canvasTransform.convertToNodeSpaceAR(this.node.worldPosition.clone());
            magicNode.setPosition(local);
        }

        // 拖拽与释放
        const onTouchMove = (event: any) => {
            if (!this.isTornadoPlacing || !magicNode.isValid) return;
            updatePositionFromEvent(event);
        };
        const finishAndCast = (event: any | null) => {
            if (event) (event as any).propagationStopped = true;
            (canvas as any).off(Node.EventType.TOUCH_MOVE, onTouchMove, this, true);
            (canvas as any).off(Node.EventType.TOUCH_END, onTouchEnd, this, true);
            (canvas as any).off(Node.EventType.TOUCH_CANCEL, onTouchCancel, this, true);
            (canvas as any).off(Node.EventType.MOUSE_MOVE, onMouseMove, this, true);
            (canvas as any).off(Node.EventType.MOUSE_UP, onMouseUp, this, true);

            const valid = this.isTornadoPlacing && magicNode && magicNode.isValid;
            this.isTornadoPlacing = false;
            if (!valid) {
                if (magicNode && magicNode.isValid) magicNode.destroy();
                this.tornadoCircleNode = null;
                return;
            }
            const worldPos = magicNode.worldPosition.clone();
            if (magicNode && magicNode.isValid) magicNode.destroy();
            this.tornadoCircleNode = null;

            // 手动释放也需要消耗蓝量，不足则不释放
            if (!this.consumeMana(this.tornadoManaCost)) {
                return;
            }
            this.spawnTornado(worldPos);
        };
        const onTouchEnd = (event: any) => finishAndCast(event);
        const onTouchCancel = (event: any) => finishAndCast(event);
        const onMouseMove = (event: any) => {
            if (!this.isTornadoPlacing || !magicNode.isValid) return;
            updatePositionFromEvent(event);
        };
        const onMouseUp = (event: any) => finishAndCast(event);

        // 捕获阶段监听，避免被单位节点拦截
        (canvas as any).on(Node.EventType.TOUCH_MOVE, onTouchMove, this, true);
        (canvas as any).on(Node.EventType.TOUCH_END, onTouchEnd, this, true);
        (canvas as any).on(Node.EventType.TOUCH_CANCEL, onTouchCancel, this, true);
        (canvas as any).on(Node.EventType.MOUSE_MOVE, onMouseMove, this, true);
        (canvas as any).on(Node.EventType.MOUSE_UP, onMouseUp, this, true);
    }

    private spawnTornado(worldPos: Vec3) {
        const canvas = find('Canvas');
        const parent = canvas || this.node.scene || this.node.parent;
        if (!parent) return;
        const n = new Node('Tornado');
        n.setParent(parent);
        n.setWorldPosition(worldPos);
        n.active = true;
        // 帧动画 + 逻辑
        const t = n.addComponent(Tornado);
        t.tornadoFrames = (this.tornadoFrames || []).filter(Boolean);
        t.radius = this.tornadoRadius;
        t.duration = this.tornadoDuration;
        t.dps = this.tornadoDps;
        t.pullPowerPerSecond = this.tornadoPullPerSec;

        // 音画同步：由 Tornado 动画真正开始时回调再播放音效，避免“只有声音不见动画”
        t.onAnimationStarted = () => {
            this.playTornadoSkillSFX(5);
        };
    }

    private playTornadoSkillSFX(durationSec: number) {
        if (!this.tornadoSkillSound || !AudioManager.Instance) return;

        if (!this.tornadoSFXNode || !this.tornadoSFXNode.isValid) {
            this.tornadoSFXNode = new Node('TornadoSFX');
            this.tornadoSFXNode.setParent(this.node);
            this.tornadoSFXNode.active = true;
            this.tornadoSFXNode.addComponent(AudioSource);
        }

        const audio = this.tornadoSFXNode.getComponent(AudioSource);
        if (!audio) return;

        this.tornadoSFXStopSeq++;
        const seq = this.tornadoSFXStopSeq;
        audio.stop();
        audio.clip = this.tornadoSkillSound;
        audio.volume = AudioManager.Instance.getSFXVolume();
        audio.loop = true;
        audio.play();

        this.scheduleOnce(() => {
            if (seq !== this.tornadoSFXStopSeq) return;
            if (audio && audio.node && audio.node.isValid) {
                audio.stop();
            }
        }, Math.max(0.1, durationSec));
    }

    public override update(deltaTime: number) {
        super.update(deltaTime);
        this.updateAutoTornadoCast(deltaTime);
    }

    private updateAutoTornadoCast(deltaTime: number) {
        if (this.isDestroyed || !this.isTornadoAwakened()) return;

        this.tornadoAutoCastTimer += deltaTime;
        if (this.tornadoAutoCastTimer < this.tornadoAutoCastInterval) return;
        this.tornadoAutoCastTimer = 0;

        const targetNode = this.currentTarget;
        if (!targetNode || !targetNode.isValid || !targetNode.active) return;

        // 仅对当前可攻击目标自动释放（敌人/传送门）
        const enemyScript = targetNode.getComponent('OrcWarlord') as any ||
                            targetNode.getComponent('OrcWarrior') as any ||
                            targetNode.getComponent('Enemy') as any ||
                            targetNode.getComponent('TrollSpearman') as any ||
                            targetNode.getComponent('Boss') as any;
        const portalScript = targetNode.getComponent('Portal') as any;
        const canAttackEnemy = !!(enemyScript && enemyScript.isAlive && enemyScript.isAlive());
        const canAttackPortal = !!(portalScript && typeof portalScript.takeDamage === 'function');
        if (!canAttackEnemy && !canAttackPortal) return;

        // 蓝量不足不释放
        if (!this.consumeMana(this.tornadoManaCost)) return;

        this.spawnTornado(targetNode.worldPosition.clone());
    }

    /**
     * 重写显示信息面板：在第一格注入“龙卷”技能按钮（图标暂用穿透箭）
     */
    public override showUnitInfoPanel() {
        // 先执行父类逻辑，确保选择与移动点击注册正常
        super.showUnitInfoPanel();

        // 然后更新面板，注入女猎手的第一格技能（龙卷）
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (!this.unitSelectionManager) {
            return;
        }

        // 读取当前面板展示的基础数据并叠加技能回调
        const upgradeCost = this.level < 3 ? (10 + (this.level - 1) * 10) : undefined;
        const currentHealth = (this.currentHealth !== undefined && !isNaN(this.currentHealth) && this.currentHealth >= 0)
            ? this.currentHealth
            : (this.maxHealth || 0);
        const maxHealth = (this.maxHealth !== undefined && !isNaN(this.maxHealth) && this.maxHealth > 0)
            ? this.maxHealth
            : 0;

        const updatedInfo: any = {
            name: this.unitName || '女猎手',
            level: this.level,
            currentHealth: currentHealth,
            maxHealth: maxHealth,
            attackDamage: this.attackDamage,
            populationCost: 1,
            icon: this.cardIcon || this.defaultSpriteFrame,
            collisionRadius: this.collisionRadius,
            attackRange: this.attackRange,
            attackFrequency: 1.0 / this.attackInterval,
            moveSpeed: this.moveSpeed,
            isDefending: this.isDefending,
            upgradeCost: upgradeCost,
            onUpgradeClick: this.level < 3 ? () => { this.onUpgradeClick(); } : undefined,
            onSellClick: () => { this.onSellClick(); },
            onDefendClick: () => { this.onDefendClick(); },
            // 第三关及以后解锁龙卷技能
            onSkillClick: this.isTornadoAwakened() ? ((event?: any) => { this.onSkillClick(event); }) : undefined,
        };

        // 用 updateUnitInfo 刷新九宫格按钮和回调
        (this.unitSelectionManager as any).updateUnitInfo?.(updatedInfo);
    }

    /**
     * 重写执行攻击方法，优先使用回旋镖
     */
    executeAttack() {
        // 再次检查目标是否有效
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active || this.isDestroyed) {
            return;
        }

		// 获取敌人脚本，支持OrcWarlord、OrcWarrior、Enemy、TrollSpearman、Portal
		const enemyScript = this.currentTarget.getComponent('OrcWarlord') as any || this.currentTarget.getComponent('OrcWarrior') as any || this.currentTarget.getComponent('Enemy') as any || this.currentTarget.getComponent('TrollSpearman') as any;
		const portalScript = this.currentTarget.getComponent('Portal') as any;
		const canAttackEnemy = !!(enemyScript && enemyScript.isAlive && enemyScript.isAlive());
		const canAttackPortal = !!(portalScript && typeof portalScript.takeDamage === 'function');
		if (!canAttackEnemy && !canAttackPortal) {
			this.currentTarget = null!;
			return;
		}

        // 优先使用回旋镖预制体（如果存在）
        if (this.boomerangPrefab) {
            this.createBoomerang();
        } else if (this.bulletPrefab) {
            // 使用子弹预制体，直接造成伤害
            this.createBullet();
        } else if (this.arrowPrefab) {
            // 如果子弹预制体不存在，使用弓箭预制体
            this.createArrow();
        } else {
            // 直接伤害（无特效）
            if (enemyScript.takeDamage) {
                enemyScript.takeDamage(this.attackDamage);
                // 记录伤害统计
                this.recordDamageToStatistics(this.attackDamage);
            }
        }
    }

    /**
     * 创建回旋镖
     */
    createBoomerang() {
        if (!this.boomerangPrefab || !this.currentTarget) {
            return;
        }

        // 检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            return;
        }

        // 创建回旋镖节点
        const boomerang = instantiate(this.boomerangPrefab);
        
        // 设置父节点（添加到场景或Canvas）
        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            boomerang.setParent(parentNode);
        } else {
            boomerang.setParent(this.node.parent);
        }

        // 设置初始位置（女猎手位置）
        const startPos = this.node.worldPosition.clone();
        boomerang.setWorldPosition(startPos);

        // 确保节点激活
        boomerang.active = true;

        // 获取Boomerang组件
        const boomerangScript = boomerang.getComponent(Boomerang) as any;
        if (!boomerangScript) {
            return;
        }

        // SP：弹弹乐 - 增加弹射次数
        try {
            const extraBounces = Number((this as any)._spBoomerangExtraBounces) || 0;
            if (extraBounces > 0) {
                const base = Number(boomerangScript.maxBounces) || 0;
                boomerangScript.maxBounces = base + extraBounces;
            }
        } catch {}

        // 播放箭矢射出音效
        if (this.shootSound && AudioManager.Instance) {
            AudioManager.Instance.playSFX(this.shootSound);
        }

        // 保存当前目标的引用，避免回调函数中引用失效的目标
        const targetNode = this.currentTarget;
        
        // 初始化回旋镖
        boomerangScript.init(
            startPos,
            targetNode,
            this.attackDamage,
            (damage: number) => {
                // 播放箭矢击中音效
                if (this.hitSound) {
                    AudioManager.Instance?.playSFX(this.hitSound);
                }
                
				// 检查目标是否仍然有效
                if (targetNode && targetNode.isValid && targetNode.active) {
					// 支持Enemy、OrcWarrior、OrcWarlord、TrollSpearman、Portal
					const enemyScript = targetNode.getComponent('Enemy') as any || targetNode.getComponent('OrcWarrior') as any || targetNode.getComponent('OrcWarlord') as any || targetNode.getComponent('TrollSpearman') as any;
					const portalScript = targetNode.getComponent('Portal') as any;
					if (enemyScript && enemyScript.isAlive && enemyScript.isAlive() && typeof enemyScript.takeDamage === 'function') {
						enemyScript.takeDamage(damage);
						// 记录伤害统计
						this.recordDamageToStatistics(damage);
					} else if (portalScript && typeof portalScript.takeDamage === 'function') {
						portalScript.takeDamage(damage);
						// 记录伤害统计
						this.recordDamageToStatistics(damage);
					}
                }
            },
            this.node // 传入女猎手节点作为ownerNode
        );
    }
}
