import { _decorator, Node, Vec3, Prefab, instantiate, find, SpriteFrame, Color, Graphics, UITransform, EventTouch } from 'cc';
import { GameState } from '../GameManager';
import { UnitInfo } from '../UnitInfoPanel';
import { Build } from './Build';
import { UnitPool } from '../UnitPool';
const { ccclass, property } = _decorator;

@ccclass('MageTower')
export class MageTower extends Build {
    @property(Prefab)
    magePrefab: Prefab = null!;

    @property
    maxMageCount: number = 4;

    @property
    productionInterval: number = 2.0;

    @property
    spawnOffset: number = 100;

    @property
    moveAwayDistance: number = 80;

    private productionProgressBar: Node = null!;
    private productionProgressGraphics: Graphics = null!;
    private producedMages: Node[] = [];
    private productionTimer: number = 0;
    private productionProgress: number = 0;
    private isProducing: boolean = false;
    private mageContainer: Node = null!;

    start() {
        super.start();
        this.findMageContainer();
        this.createProductionProgressBar();
        // 预注册法师到单位池，避免首次get时的预制体未注册警告
        if (this.magePrefab) {
            UnitPool.getInstance()?.registerPrefab('Mage', this.magePrefab);
        }
        this.node.on(Node.EventType.TOUCH_END, this.onBuildingClick, this);
    }

    private findMageContainer() {
        let magesNode = find('Canvas/Mages') || find('Mages');
        if (!magesNode) {
            magesNode = new Node('Mages');
            const canvas = find('Canvas');
            if (canvas) {
                magesNode.setParent(canvas);
                //console.info('[MageTower] created mage container at Canvas/Mages');
            }
        }
        this.mageContainer = magesNode!;
        //console.info('[MageTower] use mage container:', this.mageContainer?.name, 'parent=', this.mageContainer?.parent?.name);
    }

    private createProductionProgressBar() {
        this.productionProgressBar = new Node('ProductionProgressBar');
        this.productionProgressBar.setParent(this.node);
        this.productionProgressBar.setPosition(0, 30, 0);
        const uiTransform = this.productionProgressBar.addComponent(UITransform);
        uiTransform.setContentSize(40, 4);
        this.productionProgressGraphics = this.productionProgressBar.addComponent(Graphics);
        this.productionProgressBar.active = false;
    }

    private updateProductionProgressBar() {
        if (!this.productionProgressGraphics || !this.productionProgressBar) return;
        if (!this.isProducing) {
            this.productionProgressBar.active = false;
            return;
        }
        this.productionProgressBar.active = true;
        this.productionProgressGraphics.clear();
        this.productionProgressGraphics.fillColor = new Color(100, 100, 100, 255);
        this.productionProgressGraphics.rect(-20, 0, 40, 4);
        this.productionProgressGraphics.fill();
        this.productionProgressGraphics.fillColor = new Color(255, 120, 20, 255);
        this.productionProgressGraphics.rect(-20, 0, 40 * this.productionProgress, 4);
        this.productionProgressGraphics.fill();
    }

    update(deltaTime: number) {
        if (this.isDestroyed) return;
        if (!this.gameManager) this.findGameManager();
        if (this.gameManager && this.gameManager.getGameState() !== GameState.Playing) return;

        this.cleanupDeadMages();
        if (this.producedMages.length >= this.maxMageCount) {
            this.isProducing = false;
            this.productionProgress = 0;
            this.updateProductionProgressBar();
            return;
        }
        if (this.gameManager && !this.gameManager.canAddPopulation(2)) {
            this.isProducing = false;
            this.productionProgress = 0;
            this.updateProductionProgressBar();
            return;
        }

        if (!this.isProducing) {
            this.isProducing = true;
            this.productionTimer = 0;
            this.productionProgress = 0;
        }
        this.productionTimer += deltaTime;
        this.productionProgress = Math.min(this.productionTimer / this.productionInterval, 1);
        this.updateProductionProgressBar();
        if (this.productionTimer >= this.productionInterval) {
            this.produceMage();
            this.productionTimer = 0;
            this.productionProgress = 0;
            this.isProducing = false;
            this.updateProductionProgressBar();
        }
    }

    private produceMage() {
        if (!this.magePrefab || !this.mageContainer) return;
        if (this.producedMages.length >= this.maxMageCount) return;
        if (!this.gameManager) this.findGameManager();
        if (this.gameManager && !this.gameManager.addPopulation(2)) return;

        let mage = UnitPool.getInstance()?.get('Mage') || null;
        if (!mage) {
            UnitPool.getInstance()?.registerPrefab('Mage', this.magePrefab);
            mage = UnitPool.getInstance()?.get('Mage') || instantiate(this.magePrefab);
        }
        mage.active = false;
        mage.setParent(this.mageContainer);
        //console.info('[MageTower.produceMage] spawned mage to container=', this.mageContainer?.name, 'parent=', this.mageContainer?.parent?.name, 'children=', this.mageContainer?.children?.length || 0);
		const pos = this.node.worldPosition.clone();
		// 初始落点：塔下方 spawnOffset
		let spawnPos = new Vec3(pos.x, pos.y - this.spawnOffset, pos.z);
		// 碰撞半径（从新法师脚本读取，兜底用40）
		const tmpMageScript = mage.getComponent('Mage') as any;
		const collisionRadius = Math.max(20, Math.min(120, tmpMageScript?.collisionRadius ?? 40));
		// 尝试在落点附近寻找不与已存在友军（尤其法师）重叠的位置
		spawnPos = this.findNonOverlappingPosition(spawnPos, collisionRadius * 1.6, 18);
        const mageScript = mage.getComponent('Mage') as any;
        if (mageScript && (!mageScript.prefabName || mageScript.prefabName === '')) {
            mageScript.prefabName = 'Mage';
        }
        // 法师首次出现应弹介绍框（法师塔本身不弹）
        if (this.gameManager && mageScript) {
            this.gameManager.checkUnitFirstAppearance('Mage', mageScript);
        }
        // 修复：在激活前先设置位置，确保 onEnable 时位置已正确（否则复活单位可能因为旧位置 y >= 500 而不安排自动上移）
        mage.setWorldPosition(spawnPos);
        mage.active = true;
        // 同步建筑星级到训练单位头顶
        this.applyStarToProducedUnit(mage);
        this.producedMages.push(mage);
		this.scheduleOnce(() => {
            if (!mage || !mage.isValid || !mageScript) return;
            // 目标点计算延后到后置队列，进一步削峰
            const idx = this.producedMages.length - 1;
            const dir = idx % 2 === 0 ? 1 : -1;
            let targetPos = new Vec3(mage.worldPosition.x + dir * this.moveAwayDistance, mage.worldPosition.y, mage.worldPosition.z);
            if (this.rallyPoint) {
                targetPos = this.findOptimalRallyPointPosition(this.rallyPoint, mage.worldPosition.clone());
            }
            targetPos = this.findNonOverlappingPosition(targetPos, collisionRadius * 1.2, 12);
            mageScript.setManualMoveTargetPosition?.(targetPos);
        }, 0.05);
    }

	/**
	 * 在给定基准点附近，查找一个与当前友军单位不重叠的位置。
	 * 简单极坐标扫描：逐步扩大半径，均匀取角度，命中即返回。
	 */
	private findNonOverlappingPosition(base: Vec3, minDistance: number, maxSamples: number): Vec3 {
		// 收集需要避让的友军节点：法师容器的活动子节点 + Towers 中的可作为角色的节点（如 Arrower、Priest 也可参与避让）
		const candidates: Node[] = [];
		if (this.mageContainer && this.mageContainer.children?.length) {
			for (const child of this.mageContainer.children) {
				if (child && child.isValid && child.active) {
					candidates.push(child);
				}
			}
		}
		const towersNode = find('Canvas/Towers') || find('Towers');
		if (towersNode && towersNode.children) {
			for (const t of towersNode.children) {
				if (t && t.isValid && t.active) {
					// 只收集有角色脚本的塔（弓/牧等可能实现了Role/可作为碰撞体）
					const roleLike = t.getComponent('Arrower') as any || t.getComponent('Priest') as any;
					if (roleLike) {
						candidates.push(t);
					}
				}
			}
		}
		// 若附近无候选，直接返回原点
		if (candidates.length === 0) {
			return base.clone();
		}
		// 先检测基准点本身是否安全
		if (this.isFreeAt(base, candidates, minDistance)) {
			return base.clone();
		}
		// 圆环扫描：半径从 rStep 到 3*rStep；角度均分
		const rStep = Math.max(12, Math.floor(minDistance * 0.5));
		const maxRings = 3;
		for (let ring = 1; ring <= maxRings; ring++) {
			const r = ring * rStep;
			const samples = Math.max(8, Math.min(24, maxSamples));
			for (let i = 0; i < samples; i++) {
				const theta = (2 * Math.PI * i) / samples;
				const px = base.x + r * Math.cos(theta);
				const py = base.y + r * Math.sin(theta);
				const test = new Vec3(px, py, base.z);
				if (this.isFreeAt(test, candidates, minDistance)) {
					return test;
				}
			}
		}
		// 找不到更好位置，返回基准点
		return base.clone();
	}

	private isFreeAt(testPos: Vec3, neighbors: Node[], minDistance: number): boolean {
		for (const n of neighbors) {
			if (!n || !n.isValid || !n.active) continue;
			const wp = n.worldPosition;
			// 取邻居半径（若读不到，兜底为 minDistance 的 0.6倍）
			const script = n.getComponent('Mage') as any
				|| n.getComponent('Arrower') as any
				|| n.getComponent('Priest') as any
				|| n.getComponent('Role') as any;
			const neighborRadius = Math.max(12, Math.min(120, script?.collisionRadius ?? Math.floor(minDistance * 0.6)));
			const safe = minDistance + neighborRadius * 0.0; // 当前 minDistance 已包含自身半径系数
			const dx = testPos.x - wp.x;
			const dy = testPos.y - wp.y;
			if (dx * dx + dy * dy < safe * safe) {
				return false;
			}
		}
		return true;
	}

    private cleanupDeadMages() {
        this.producedMages = this.producedMages.filter((mage) => {
            if (!mage || !mage.isValid || !mage.active) {
                // 法师总占用2人口；Role基类死亡时已回退1，这里补回退剩余1
                if (this.gameManager) this.gameManager.removePopulation(1);
                return false;
            }
            const mageScript = mage.getComponent('Mage') as any;
            const isAlive = !mageScript || !mageScript.isAlive || mageScript.isAlive();
            if (!isAlive && this.gameManager) {
                // 法师总占用2人口；Role基类死亡时已回退1，这里补回退剩余1
                this.gameManager.removePopulation(1);
            }
            return isAlive;
        });
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({ currentUnitCount: this.producedMages.length });
        }
    }

    protected getUnitInfo(): UnitInfo | null {
        return {
            name: '法师塔',
            level: this.level,
            currentHealth: this.currentHealth,
            maxHealth: this.maxHealth,
            attackDamage: 0,
            populationCost: 0,
            icon: this.cardIcon || this.defaultSpriteFrame,
            collisionRadius: this.collisionRadius,
            currentUnitCount: this.producedMages.length,
            maxUnitCount: this.maxMageCount,
            rallyPoint: this.rallyPoint
        };
    }

    protected onUpgradeClick(event?: EventTouch) {
        if (event) event.propagationStopped = true;
        if (!this.gameManager) this.findGameManager();
        if (!this.gameManager) return;
        const upgradeCost = Math.floor(this.buildCost * 0.5);
        if (!this.gameManager.canAfford(upgradeCost)) return;
        this.gameManager.spendGold(upgradeCost);
        this.level++;
        this.maxMageCount += 2;
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                level: this.level,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth,
                maxUnitCount: this.maxMageCount,
                currentUnitCount: this.producedMages.length
            });
        }
        this.hideSelectionPanel();
    }
}
