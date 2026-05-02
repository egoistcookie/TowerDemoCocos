import { _decorator, Node, Vec3, Prefab, instantiate, find, SpriteFrame, Color, Graphics, UITransform, EventTouch, resources } from 'cc';
import { GameState } from '../GameManager';
import { UnitInfo } from '../UnitInfoPanel';
import { Build } from './Build';
import { UnitPool } from '../UnitPool';
import { GamePopup } from '../GamePopup';
import { AnalyticsManager } from '../AnalyticsManager';
import { OperationType } from '../AnalyticsManager';
const { ccclass, property } = _decorator;

/**
 * 角鹰兽栏 - 训练角鹰的建筑
 * 特点：
 * - 训练的角鹰需要 10 秒成长时间才能离开兽栏
 * - 角鹰不占用人口
 * - 没有数量上限
 */
@ccclass('EagleNest')
export class EagleNest extends Build {
    @property(Prefab)
    eaglePrefab: Prefab = null!;

    @property
    productionInterval: number = 3.0; // 训练间隔 3 秒

    @property
    growthDuration: number = 10.0; // 幼体成长时间 10 秒

    @property
    spawnOffset: number = 100; // 角鹰出现位置偏移

    @property
    moveAwayDistance: number = 80; // 角鹰离开距离

    private productionProgressBar: Node = null!;
    private productionProgressGraphics: Graphics = null!;
    private growthProgressBar: Node = null!;
    private growthProgressGraphics: Graphics = null!;
    private productionTimer: number = 0;
    private productionProgress: number = 0;
    private isProducing: boolean = false;
    private eagleContainer: Node = null!;
    // 幼体训练队列：只记录成长进度，不创建实体
    private juvenileQueue: Array<{
        growthTimer: number;
        growthProgress: number;
    }> = [];
    // 标记是否已经显示过幼体提示（每局游戏只显示一次）
    private hasShownJuvenileHint: boolean = false;

    start() {
        super.start();
        this.findEagleContainer();
        this.createProgressBars();
        // 预注册角鹰到单位池
        if (this.eaglePrefab) {
            UnitPool.getInstance()?.registerPrefab('Eagle', this.eaglePrefab);
        }
        this.node.on(Node.EventType.TOUCH_END, this.onBuildingClick, this);
    }

    private findEagleContainer() {
        let eaglesNode = find('Canvas/Eagles') || find('Eagles');
        if (!eaglesNode) {
            eaglesNode = new Node('Eagles');
            const canvas = find('Canvas');
            if (canvas) {
                eaglesNode.setParent(canvas);
            }
        }
        this.eagleContainer = eaglesNode!;
    }

    private createProgressBars() {
        // 训练进度条（生产进度）
        this.productionProgressBar = new Node('ProductionProgressBar');
        this.productionProgressBar.setParent(this.node);
        this.productionProgressBar.setPosition(0, 35, 0);
        const prodUiTransform = this.productionProgressBar.addComponent(UITransform);
        prodUiTransform.setContentSize(40, 4);
        this.productionProgressGraphics = this.productionProgressBar.addComponent(Graphics);
        this.productionProgressBar.active = false;

        // 成长进度条（角鹰成长进度，显示在第一个正在成长的角鹰上方）
        this.growthProgressBar = new Node('GrowthProgressBar');
        this.growthProgressBar.setParent(this.node);
        this.growthProgressBar.setPosition(0, 50, 0);
        const growthUiTransform = this.growthProgressBar.addComponent(UITransform);
        growthUiTransform.setContentSize(40, 4);
        this.growthProgressGraphics = this.growthProgressBar.addComponent(Graphics);
        this.growthProgressBar.active = false;
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

    private updateGrowthProgressBar(growthProgress: number) {
        if (!this.growthProgressGraphics || !this.growthProgressBar) return;
        if (this.juvenileQueue.length === 0) {
            this.growthProgressBar.active = false;
            return;
        }
        this.growthProgressBar.active = true;
        this.growthProgressGraphics.clear();
        this.growthProgressGraphics.fillColor = new Color(100, 100, 100, 255);
        this.growthProgressGraphics.rect(-20, 0, 40, 4);
        this.growthProgressGraphics.fill();
        this.growthProgressGraphics.fillColor = new Color(0, 255, 100, 255); // 绿色表示成长中
        this.growthProgressGraphics.rect(-20, 0, 40 * growthProgress, 4);
        this.growthProgressGraphics.fill();
    }

    update(deltaTime: number) {
        if (this.isDestroyed) return;
        if (!this.gameManager) this.findGameManager();
        if (this.gameManager && this.gameManager.getGameState() !== GameState.Playing) return;

        // 更新成长中的幼体
        this.updateGrowingEagles(deltaTime);

        // 生产逻辑：只有当幼体队列已满（有一个正在成长）时，才停止生产
        // 改为：只有当幼体完全成长后，才开始训练下一只
        if (this.isProducing) {
            this.productionTimer += deltaTime;
            this.productionProgress = Math.min(this.productionTimer / this.productionInterval, 1);
            this.updateProductionProgressBar();

            if (this.productionTimer >= this.productionInterval) {
                this.produceEagle();
                this.productionTimer = 0;
                this.productionProgress = 0;
                this.isProducing = false;
                this.updateProductionProgressBar();
            }
        } else {
            // 只有当没有幼体正在成长时，才开始新的生产
            if (this.juvenileQueue.length === 0) {
                this.isProducing = true;
                this.productionTimer = 0;
                this.productionProgress = 0;
            }
        }
    }

    private updateGrowingEagles(deltaTime: number) {
        // 更新所有成长中的幼体（只更新第一个，因为只显示第一个的进度）
        if (this.juvenileQueue.length > 0) {
            const firstItem = this.juvenileQueue[0];
            firstItem.growthTimer += deltaTime;
            firstItem.growthProgress = Math.min(firstItem.growthTimer / this.growthDuration, 1);
            this.updateGrowthProgressBar(firstItem.growthProgress);

            // 成长完成，训练出完全体角鹰
            if (firstItem.growthProgress >= 1) {
                this.produceAdultEagle();
                this.juvenileQueue.shift(); // 移除已完成的幼体
            }
        }

        // 如果没有成长中的幼体，隐藏进度条
        if (this.juvenileQueue.length === 0) {
            this.growthProgressBar.active = false;
        }
    }

    private produceEagle() {
        if (!this.eaglePrefab || !this.eagleContainer) return;
        if (!this.gameManager) this.findGameManager();

        // 角鹰不占用人口，没有数量上限

        // 不创建实体，只添加到幼体队列
        this.juvenileQueue.push({
            growthTimer: 0,
            growthProgress: 0
        });

        // 只在第一次训练幼体时显示提示
        if (!this.hasShownJuvenileHint) {
            GamePopup.showMessage('角鹰幼体开始成长！');
            this.hasShownJuvenileHint = true;
        }

        // 记录训练角鹰操作
        const analytics = AnalyticsManager.getInstance();
        if (analytics && this.gameManager) {
            analytics.recordOperation(
                OperationType.TRAIN_EAGLE,
                this.gameManager.getGameTime(),
                { position: { x: this.node.worldPosition.x, y: this.node.worldPosition.y } }
            );
        }

        // 更新单位信息面板
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                currentUnitCount: this.juvenileQueue.length
            });
        }
    }

    private produceAdultEagle() {
        if (!this.eaglePrefab || !this.eagleContainer) return;
        if (!this.gameManager) this.findGameManager();

        // 创建完全体角鹰实体
        let eagle = UnitPool.getInstance()?.get('Eagle') || null;
        if (!eagle) {
            UnitPool.getInstance()?.registerPrefab('Eagle', this.eaglePrefab);
            eagle = UnitPool.getInstance()?.get('Eagle') || instantiate(this.eaglePrefab);
        }

        eagle.active = false;
        eagle.setParent(this.eagleContainer);

        const pos = this.node.worldPosition.clone();
        // 初始落点：兽栏下方 spawnOffset
        let spawnPos = new Vec3(pos.x, pos.y - this.spawnOffset, pos.z);

        // 获取碰撞半径
        const tmpEagleScript = eagle.getComponent('Eagle') as any;
        const collisionRadius = Math.max(20, Math.min(120, tmpEagleScript?.collisionRadius ?? 40));

        // 尝试在落点附近寻找不与已存在友军重叠的位置
        spawnPos = this.findNonOverlappingPosition(spawnPos, collisionRadius * 1.6, 18);

        const eagleScript = eagle.getComponent('Eagle') as any;
        if (eagleScript && (!eagleScript.prefabName || eagleScript.prefabName === '')) {
            eagleScript.prefabName = 'Eagle';
        }

        // 应用配置文件中的属性（确保 attackRange 等属性正确）
        const configManager = (this as any).unitConfigManager ||
                              find('GameManager')?.getComponent('GameManager')?.['unitConfigManager'];
        if (configManager && typeof configManager.applyConfigToUnit === 'function') {
            configManager.applyConfigToUnit('Eagle', eagleScript, ['buildCost']);
        }

        // 设置为完全体
        if (eagleScript) {
            eagleScript.setJuvenile(false);
        }

        // 设置位置并激活
        eagle.setWorldPosition(spawnPos);
        eagle.active = true;
        // 同步建筑星级到训练单位头顶
        this.applyStarToProducedUnit(eagle);

        // 首次出现检查（完全体角鹰）
        if (this.gameManager) {
            this.gameManager.checkUnitFirstAppearance('Eagle_Adult', eagleScript);
        }

        // 完全体角鹰可以离开兽栏，设置移动目标
        if (eagleScript) {
            this.scheduleOnce(() => {
                if (!eagle || !eagle.isValid || !eagleScript) return;
                // 目标点计算延后到后置队列，进一步削峰
                if (this.rallyPoint) {
                    const rallyPos = this.findOptimalRallyPointPosition(this.rallyPoint, eagle.worldPosition.clone());
                    eagleScript.setManualMoveTargetPosition?.(rallyPos);
                } else {
                    const targetPos = new Vec3(
                        eagle.worldPosition.x + this.moveAwayDistance,
                        eagle.worldPosition.y,
                        eagle.worldPosition.z
                    );
                    eagleScript.setManualMoveTargetPosition?.(targetPos);
                }
            }, 0.05);
        }

        // 更新单位信息面板
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                currentUnitCount: this.juvenileQueue.length
            });
        }
    }

    /**
     * 在给定基准点附近，查找一个与当前友军单位不重叠的位置
     */
    private findNonOverlappingPosition(base: Vec3, minDistance: number, maxSamples: number): Vec3 {
        const candidates: Node[] = [];

        if (this.eagleContainer && this.eagleContainer.children?.length) {
            for (const child of this.eagleContainer.children) {
                if (child && child.isValid && child.active) {
                    candidates.push(child);
                }
            }
        }

        if (candidates.length === 0) {
            return base.clone();
        }

        // 先检测基准点本身是否安全
        if (this.isFreeAt(base, candidates, minDistance)) {
            return base.clone();
        }

        // 圆环扫描
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

        return base.clone();
    }

    private isFreeAt(testPos: Vec3, neighbors: Node[], minDistance: number): boolean {
        for (const n of neighbors) {
            if (!n || !n.isValid || !n.active) continue;
            const wp = n.worldPosition;
            const script = n.getComponent('Eagle') as any || n.getComponent('Role') as any;
            const neighborRadius = Math.max(12, Math.min(120, script?.collisionRadius ?? Math.floor(minDistance * 0.6)));
            const safe = minDistance + neighborRadius * 0.0;
            const dx = testPos.x - wp.x;
            const dy = testPos.y - wp.y;
            if (dx * dx + dy * dy < safe * safe) {
                return false;
            }
        }
        return true;
    }

    protected getUnitInfo(): UnitInfo | null {
        return {
            name: '角鹰兽栏',
            level: this.level,
            currentHealth: this.currentHealth,
            maxHealth: this.maxHealth,
            attackDamage: 0,
            populationCost: 0,
            icon: this.cardIcon || this.defaultSpriteFrame,
            collisionRadius: this.collisionRadius,
            currentUnitCount: this.juvenileQueue.length,
            maxUnitCount: 999, // 无上限
            rallyPoint: this.rallyPoint
        };
    }

    protected onUpgradeClick(event?: EventTouch) {
        // 角鹰兽栏不可升级
    }

    onDestroy() {
        // 清理幼体队列
        this.juvenileQueue = [];

        if (this.productionProgressBar) {
            this.productionProgressBar.destroy();
        }
        if (this.growthProgressBar) {
            this.growthProgressBar.destroy();
        }
    }
}
