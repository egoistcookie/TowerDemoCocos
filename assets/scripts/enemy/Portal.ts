import { _decorator, Component, Node, Vec3, Prefab, instantiate, find, UITransform, resources, Label, LabelOutline, Color, UIOpacity, tween, Sprite, SpriteFrame } from 'cc';
import { UnitType } from '../UnitType';
import { HealthBar } from '../HealthBar';
const { ccclass, property } = _decorator;

@ccclass('Portal')
export class Portal extends Component {
    // 作为敌方单位参与索敌与被攻击
    public unitType: UnitType = UnitType.ENEMY;
    private static hasShownFirstPortalAttackIntro: boolean = false;
	private _originalMaxHealth?: number;

	// 循环贴图动画
	@property({ type: [SpriteFrame] })
	public loopAnimationFrames: SpriteFrame[] = [];
	@property
	public loopAnimationDuration: number = 1.0; // 一轮动画总时长（秒）
	private sprite: Sprite | null = null;
	private animationTimer: number = 0;
	private currentAnimFrameIndex: number = -1;
    @property
    public maxHealth: number = 1000;

    @property(Prefab)
    public fireballPrefab: Prefab = null!;

    @property
    public detectRadius: number = 200;

    @property
    public fireIntervalSeconds: number = 2.0;

	// 传送门攻击力（用于火球伤害），允许被动态增益
	@property
	public attackDamage: number = 12;

    private currentHealth: number = 0;
    private leftCooldown: number = 0;
    private rightCooldown: number = 0;

    // 血条
    private healthBarNode: Node = null!;
    private healthBar: HealthBar = null!;

    // 休眠可视化
    private uiOpacity: UIOpacity | null = null;
    private lastDormant: boolean = false;

    // 伤害数字
    @property(Prefab)
    public damageNumberPrefab: Prefab = null!;

    onEnable() {
        // 出场即按普通敌人的规则进行每关增幅
        this.applyLevelBuffLikeEnemies();
        this.currentHealth = this.maxHealth;
        this.leftCooldown = 0;
        this.rightCooldown = 0;
        this.ensureHealthBar();
        this.updateHealthBar();
        // 伤害飘字：若未在编辑器指定预制体，则使用内置Label方案，无需异步加载
		// 贴图循环动画初始化
		this.sprite = this.node.getComponent(Sprite) || null;
		this.animationTimer = 0;
		this.currentAnimFrameIndex = -1;
        // 初始化透明度组件与休眠可视化
        this.uiOpacity = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
        const dormant = this.isDormantNow();
        this.applyDormantVisual(dormant);
        this.lastDormant = dormant;
    }

    // 参照 EnemySpawner.applyLevelBuff，对传送门应用关卡生命增幅
    private applyLevelBuffLikeEnemies() {
        if (this._originalMaxHealth === undefined) {
            this._originalMaxHealth = this.maxHealth || 0;
        }
        const spawner = (find('Canvas/EnemySpawner') || find('EnemySpawner'))?.getComponent('EnemySpawner') as any;
        if (!spawner) return;
        const level = (spawner['currentLevel'] as number) ?? 1;
        let levelMul = 1.0;
        if (level > 2) {
            levelMul = 1.0 + (level - 2) * 0.1;
        }
        const persistentMul = (spawner['persistentEnemyGrowthMultiplier'] as number) ?? 1.0;
        const multiplier = levelMul * persistentMul;
        if (multiplier === 1.0) return;
        if (this._originalMaxHealth > 0) {
            this.maxHealth = Math.floor(this._originalMaxHealth * multiplier);
        }
    }

    private isDormantNow(): boolean {
        // 倒计时或非Playing时进入休眠：不可选中、不可攻击也不主动攻击
        const gm = find('GameManager')?.getComponent('GameManager') as any;
        const stateOk = gm && typeof gm.getGameState === 'function' ? (gm.getGameState() === 'Playing') : true;
        let waveActive = true;
        const es = find('Canvas/EnemySpawner')?.getComponent('EnemySpawner') as any || find('EnemySpawner')?.getComponent('EnemySpawner') as any;
        if (es) {
            // 访问私有字段（通过索引），false 表示正在进行下一波倒计时
            if (typeof es['isWaveActive'] === 'boolean') {
                waveActive = es['isWaveActive'];
            }
        }
        return !stateOk || !waveActive;
    }

    private applyDormantVisual(dormant: boolean) {
        if (!this.node || !this.node.isValid) return;
        if (!this.uiOpacity || !this.uiOpacity.isValid) {
            this.uiOpacity = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
        }
        // 半透明显示区分
        this.uiOpacity.opacity = dormant ? 140 : 255;
    }

    private getGameManager(): any | null {
        // 非递归：仅按统一路径获取
        const gmNode = find('GameManager') || find('Canvas/GameManager');
        return gmNode ? (gmNode.getComponent('GameManager') as any) : null;
    }

	update(dt: number) {
        const dormant = this.isDormantNow();
        if (dormant !== this.lastDormant) {
            this.applyDormantVisual(dormant);
            this.lastDormant = dormant;
        }

		// 循环动画持续播放（即使休眠也继续播放，以保持传送门活性视觉）
		this.updateLoopAnimation(dt);

        if (dormant) {
            return;
        }
        if (!this.node || !this.node.isValid) {
            return;
        }
        this.leftCooldown -= dt;
        this.rightCooldown -= dt;

        const target = this.findNearestFriendlyInRange(this.detectRadius);
        if (!target) {
            return;
        }
        const { topLeft, topRight } = this.getTopCornersWorld();

        if (this.leftCooldown <= 0 && topLeft) {
            this.shootFireball(topLeft, target);
            this.leftCooldown = this.fireIntervalSeconds;
        }
        if (this.rightCooldown <= 0 && topRight) {
            this.shootFireball(topRight, target);
            this.rightCooldown = this.fireIntervalSeconds;
        }
    }

	private updateLoopAnimation(dt: number) {
		if (!this.sprite || !this.loopAnimationFrames || this.loopAnimationFrames.length === 0) {
			return;
		}
		if (this.loopAnimationDuration <= 0) {
			this.loopAnimationDuration = 1.0;
		}
		this.animationTimer += dt;
		const frameDuration = this.loopAnimationDuration / this.loopAnimationFrames.length;
		const frameIndex = Math.floor(this.animationTimer / frameDuration) % this.loopAnimationFrames.length;
		if (frameIndex !== this.currentAnimFrameIndex) {
			this.currentAnimFrameIndex = frameIndex;
			this.sprite.spriteFrame = this.loopAnimationFrames[frameIndex];
		}
	}

    public takeDamage(amount: number) {
        console.log('[Portal] takeDamage', amount, 'hpBefore=',
             this.currentHealth, 'hpAfter=', this.currentHealth - amount, this.node.name);
        if (this.isDormantNow()) {
            return;
        }
        if (amount <= 0 || !this.node || !this.node.isValid) {
            return;
        }
        this.currentHealth -= amount;
        this.updateHealthBar();
        this.showDamageNumber(amount);
        if (this.currentHealth <= 0) {
            this.onPortalDestroyed();
        }
    }

    private onPortalDestroyed() {
        // 触发兽人狂暴机制
        const enemySpawnerNode = find('Canvas/EnemySpawner') || find('EnemySpawner');
        const spawner = enemySpawnerNode ? (enemySpawnerNode.getComponent('EnemySpawner') as any) : null;
        if (spawner && typeof spawner['triggerOrcBloodRage'] === 'function') {
            try {
                spawner['triggerOrcBloodRage'](1);
            } catch (e) {
                console.warn('[Portal] 触发狂暴失败', e);
            }
        }

        // 强化剩余的其他传送门（+50% 生命与攻击）
        try {
            (Portal as any).applyBuffToOtherPortals?.(this.node);
        } catch (e) {
            console.warn('[Portal] 强化其它传送门失败', e);
        }
        // 发放击毁奖励：+100 金币，+50 木材
        const gm = this.getGameManager();
        if (gm) {
            try {
                if (typeof gm.addGold === 'function') {
                    gm.addGold(100);
                } else {
                    console.warn('[Portal] 未找到 addGold 方法');
                }
                if (typeof gm.addWood === 'function') {
                    gm.addWood(50);
                } else {
                    console.warn('[Portal] 未找到 addWood 方法');
                }
                if (typeof gm.addExperience === 'function') {
                    gm.addExperience(50);
                } else {
                    console.warn('[Portal] 未找到 addExperience 方法');
                }
                console.log('[Portal] 击毁奖励：+100 金币，+50 木材');
            } catch (e) {
                console.warn('[Portal] 发放资源奖励失败', e);
            }
        } else {
            console.warn('[Portal] 未找到 GameManager，无法发放击毁奖励');
        }

        // 三段奖励飘字：+50exp、+100gold、+50wood（字号比伤害数字大2，依次消散）
        this.showRewardTexts();

        if (this.node && this.node.isValid) {
            this.node.destroy();
        }
    }

    private showRewardTexts() {
        if (!this.node || !this.node.isValid) return;
        const canvas = find('Canvas');
        const parentNode = canvas || this.node.scene || this.node.parent;
        if (!parentNode) return;

        const basePos = this.node.worldPosition.clone();
        basePos.y -= 70; // 在原基础上再向下挪 100（原先为 +30）

        const entries = [
            { text: '+50exp', color: new Color(255, 255, 0, 255) },    // 黄色偏突出
            { text: '+100gold', color: new Color(255, 215, 0, 255) },  // 金色
            { text: '+50wood', color: new Color(144, 238, 144, 255) }  // 淡绿色
        ];

        // 伤害数字字号20，这里+2为22（更突出）
        const fontSize = 22;
        const lineHeight = 26; // 行距稍大于字号

        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            const n = new Node('RewardText');
            n.setParent(parentNode);
            // 放到 UI 之下，避免遮挡顶层 UI
            try {
                const uiNode = find('Canvas/UI') || find('Canvas/HUD') || find('Canvas/TopUI');
                if (uiNode) {
                    const uiIndex = uiNode.getSiblingIndex();
                    n.setSiblingIndex(Math.max(0, uiIndex - 1));
                }
            } catch {}

            const start = basePos.clone();
            // 三行展示（向上排布）
            start.y += (entries.length - 1 - i) * lineHeight;
            n.setWorldPosition(start);

            let label: Label | null = n.getComponent(Label);
            if (!label) label = n.addComponent(Label);
            label.string = e.text;
            label.fontSize = fontSize;
            label.lineHeight = lineHeight;
            label.color = e.color;
            // 直接使用 Label 的描边属性，避免使用已弃用的 LabelOutline.color
            (label as any).outlineColor = new Color(0, 0, 0, 255);
            (label as any).outlineWidth = 2;

            const opacity = n.getComponent(UIOpacity) || n.addComponent(UIOpacity);
            // 立即可见，后续只延迟开始消散
            opacity.opacity = 255;

            // 依次显隐：第0条立刻开始，第1条延迟0.15s，第2条延迟0.3s
            const delay = i * 0.15;
            const floatUp = 24; // 上浮距离

            tween(n)
                // 延迟开始上浮与消散，但文本从创建起就已经显示
                .delay(delay)
                .to(1.0, { worldPosition: new Vec3(start.x, start.y + floatUp, start.z) }, { easing: 'sineOut' })
                .parallel(tween(opacity).to(1.0, { opacity: 0 }))
                .call(() => {
                    if (n && n.isValid) n.destroy();
                })
                .start();
        }
    }

    private ensureHealthBar() {
        if (!this.node || !this.node.isValid) return;
        if (!this.healthBarNode || !this.healthBarNode.isValid) {
            this.healthBarNode = new Node('HealthBar');
            this.healthBarNode.setParent(this.node);
            // 放在顶端上方
            const ui = this.node.getComponent(UITransform);
            const y = ui ? (ui.contentSize.height * 0.5 + 20) : 50;
            this.healthBarNode.setPosition(0, y, 0);
            this.healthBar = this.healthBarNode.addComponent(HealthBar);
            this.healthBar.barWidth = 80;
            this.healthBar.barHeight = 6;
        }
        if (!this.healthBar) {
            this.healthBar = this.healthBarNode.getComponent(HealthBar)!;
        }
        if (this.healthBar) {
            this.healthBar.setMaxHealth(this.maxHealth);
            this.healthBar.setHealth(this.currentHealth);
        }
    }

    private updateHealthBar() {
        if (!this.healthBar) return;
        this.healthBar.setHealth(this.currentHealth);
    }

    // 取消异步加载 DamageNumber 预制体逻辑：
    // 若需要自定义样式，可在编辑器里直接指定 damageNumberPrefab；
    // 否则走 showDamageNumber 内置的 Label 方案，避免报 bundle 缺失的警告。

    private showDamageNumber(damage: number) {
        let damageNode: Node;
        if (this.damageNumberPrefab) {
            damageNode = instantiate(this.damageNumberPrefab);
        } else {
            damageNode = new Node('DamageNumber');
        }

        const canvas = find('Canvas');
        if (canvas) {
            damageNode.setParent(canvas);
            // 确保飘字不遮挡 UI：将其放在 UI 之下
            try {
                const uiNode = find('Canvas/UI') || find('Canvas/HUD') || find('Canvas/TopUI');
                if (uiNode) {
                    const uiIndex = uiNode.getSiblingIndex();
                    damageNode.setSiblingIndex(Math.max(0, uiIndex - 1));
                }
            } catch {}
        } else if (this.node.scene) {
            damageNode.setParent(this.node.scene);
        } else {
            damageNode.setParent(this.node.parent);
        }

        const startPos = this.node.worldPosition.clone();
        startPos.y += 40;
        damageNode.setWorldPosition(startPos);

        let label: Label | null = damageNode.getComponent(Label);
        if (!label) {
            const labels = damageNode.getComponentsInChildren(Label);
            if (labels && labels.length > 0) label = labels[0];
        }
        if (!label) {
            label = damageNode.addComponent(Label);
            label.fontSize = 20;
        }
        label.string = `-${Math.floor(Math.max(1, damage))}`;
        label.color = new Color(255, 255, 255, 255);
        // 与普通敌人一致：添加 LabelOutline 组件，并使用 Label 的非弃用描边属性
        let outline = label.node.getComponent(LabelOutline);
        if (!outline) {
            outline = label.node.addComponent(LabelOutline);
        }
        (label as any).outlineColor = new Color(0, 0, 0, 255);
        outline.width = 2;

        const opacity = damageNode.getComponent(UIOpacity) || damageNode.addComponent(UIOpacity);
        opacity.opacity = 255;

        const endPos = startPos.clone();
        endPos.y += 30;
        tween(damageNode)
            .to(0.6, { worldPosition: endPos }, { easing: 'sineOut' })
            .parallel(tween(opacity).to(0.6, { opacity: 0 }))
            .call(() => {
                if (damageNode && damageNode.isValid) damageNode.destroy();
            })
            .start();
    }

    private getTopCornersWorld(): { topLeft: Vec3 | null; topRight: Vec3 | null } {
        const ui = this.node.getComponent(UITransform);
        if (!ui) {
            return { topLeft: null, topRight: null };
        }
        const size = ui.contentSize;
        const halfW = size.width * 0.5;
        const halfH = size.height * 0.5;
        const worldPos = this.node.worldPosition.clone();
        const topLeft = new Vec3(worldPos.x - halfW, worldPos.y + halfH, worldPos.z);
        const topRight = new Vec3(worldPos.x + halfW, worldPos.y + halfH, worldPos.z);
        return { topLeft, topRight };
        }

    private shootFireball(startPos: Vec3, targetNode: Node) {
        if (this.isDormantNow()) {
            return;
        }
        if (!this.fireballPrefab) {
            return;
        }
        if (!targetNode || !targetNode.isValid || !targetNode.active) {
            return;
        }
        const canvas = find('Canvas');
        const parentNode = canvas || this.node.scene || this.node.parent;
        const fireballNode = instantiate(this.fireballPrefab);
        if (parentNode) {
            fireballNode.setParent(parentNode);
        } else {
            fireballNode.setParent(this.node.parent);
        }
        fireballNode.setWorldPosition(startPos);
        fireballNode.active = true;
        // Fireball.ts 实际类名可能为 'Arrow'，做兼容
        let fireballScript = fireballNode.getComponent('Fireball') as any
                          || fireballNode.getComponent('Arrow') as any;
        if (!fireballScript) {
            fireballScript = fireballNode.addComponent('Fireball') as any
                          || fireballNode.addComponent('Arrow') as any;
        }
		if (fireballScript && typeof fireballScript.init === 'function') {
            // 使用可配置的 attackDamage，便于被动增益生效
            const damage = Math.max(1, Math.floor(this.attackDamage));
            fireballScript.init(startPos, targetNode, damage, (dmg: number, hitDir: Vec3) => {
                if (!targetNode || !targetNode.isValid) return;
                // 优先作为角色单位受击
                const role =
                    (targetNode.getComponent('Role') as any) ||
                    (targetNode.getComponent('Arrower') as any) ||
                    (targetNode.getComponent('Hunter') as any) ||
                    (targetNode.getComponent('ElfSwordsman') as any) ||
                    (targetNode.getComponent('Priest') as any) ||
                    (targetNode.getComponent('Mage') as any);
                if (role && typeof role.takeDamage === 'function') {
                    role.takeDamage(dmg, hitDir);
                    this.tryShowFirstPortalAttackIntro();
                    return;
                }
                // 次选：如果目标是建筑并且暴露了 takeDamage（少数建筑可能公开）
                const build = (targetNode.getComponent('Build') as any);
                if (build && typeof build.takeDamage === 'function') {
                    build.takeDamage(dmg, hitDir);
                    this.tryShowFirstPortalAttackIntro();
                }
            });
        }
    }

    private tryShowFirstPortalAttackIntro() {
        if (Portal.hasShownFirstPortalAttackIntro) return;
        const gm = this.getGameManager();
        if (!gm) return;
        try {
            const arrower = typeof gm['getFirstActiveUnitScriptInContainers'] === 'function'
                ? gm['getFirstActiveUnitScriptInContainers'](['Canvas/Towers'], 'Arrower')
                : null;
            if (arrower && typeof gm['showQuickUnitIntro'] === 'function') {
                gm['showQuickUnitIntro'](
                    arrower,
                    '弓箭手',
                    '指挥官，攻击我们的是敌人的传送门装置，如果摧毁掉就能获取大量战利品。',
                    'Arrower'
                );
                Portal.hasShownFirstPortalAttackIntro = true;
            }
        } catch {}
    }

    private findNearestFriendlyInRange(radius: number): Node | null {
        const containers = [
            'Canvas/Towers',       // 弓箭手等远程单位
            'Canvas/Hunters',
            'Canvas/ElfSwordsmans', // 实际项目中剑士容器常用命名
            'Canvas/Swordsmen',
            'Canvas/Priests',
            'Canvas/Mages'
        ];
        const center = this.node.worldPosition;
        let best: Node | null = null;
        let bestDistSq = radius * radius;
        for (const path of containers) {
            const container = find(path);
            if (!container) continue;
            for (const child of container.children) {
                if (!child.active || !child.isValid) continue;
                const pos = child.worldPosition;
                const dx = pos.x - center.x;
                const dy = pos.y - center.y;
                const d2 = dx * dx + dy * dy;
                if (d2 <= bestDistSq) {
                    best = child;
                    bestDistSq = d2;
                }
            }
        }
        return best;
    }

	// 当某个传送门被摧毁时，强化其他存活传送门：+50% 最大生命与 +50% 攻击力（可叠加）
	private static applyBuffToOtherPortals(exclude: Node) {
		const collect = (path: string) => {
			const cont = find(path);
			return cont && cont.isValid ? cont.children.slice() : [];
		};
		const candidates: Node[] = [];
		candidates.push(...collect('Canvas/Portals'));
		candidates.push(...collect('Canvas/Enemies'));
		for (const n of candidates) {
			if (!n || !n.isValid || !n.active || n === exclude) continue;
			const p = n.getComponent('Portal') as any;
			if (!p) continue;
			if (typeof p.currentHealth !== 'number' || p.currentHealth <= 0) continue;
			// 生命上限提升 50%，当前生命按原百分比提升
			const oldMax = Math.max(1, p.maxHealth || 1);
			const oldCur = Math.max(0, p.currentHealth || 0);
			const ratio = Math.max(0, Math.min(1, oldCur / oldMax));
			const newMax = Math.floor(oldMax * 1.5);
			p.maxHealth = newMax;
			p.currentHealth = Math.floor(newMax * ratio);
			// 同步刷新血条最大值与当前值
			if (typeof p.ensureHealthBar === 'function') p.ensureHealthBar();
			try {
				const hb = (p as any).healthBar;
				if (hb && typeof hb.setMaxHealth === 'function') {
					hb.setMaxHealth(p.maxHealth);
				}
			} catch {}
			if (typeof p.updateHealthBar === 'function') p.updateHealthBar();
			// 攻击力提升 50%
			if (typeof p.attackDamage === 'number') {
				p.attackDamage = Math.max(1, Math.floor(p.attackDamage * 1.5));
			}
		}
	}
}

