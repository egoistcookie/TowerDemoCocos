import { _decorator, Node, Vec3, Prefab, instantiate, find, Sprite, SpriteFrame, Color, Graphics, UITransform, Label, EventTouch } from 'cc';
import { Build } from './Build';
import { GameManager, GameState } from './GameManager';
import { UnitSelectionManager } from './UnitSelectionManager';
import { UnitInfo } from './UnitInfoPanel';
import { UnitConfigManager } from './UnitConfigManager';
import { UnitType } from './WarAncientTree';
import { Priest } from './Priest';
import { TalentEffectManager } from './TalentEffectManager';
const { ccclass, property } = _decorator;

@ccclass('Church')
export class Church extends Build {
    @property({ override: true })
    protected maxHealth: number = 120;

    @property({ override: true })
    public buildCost: number = 12;

    @property({ override: true })
    protected collisionRadius: number = 50;

    @property({ type: SpriteFrame, override: true })
    protected cardIcon: SpriteFrame = null!;

    // 单位类型
    public unitType: UnitType = UnitType.BUILDING;

    // 单位信息
    @property({ override: true })
    protected unitName: string = '教堂';

    @property({ override: true })
    protected unitDescription: string = '训练牧师的建筑，可以持续生产为友军治疗的辅助单位。';

    @property({ type: SpriteFrame, override: true })
    protected unitIcon: SpriteFrame = null!;

    // 生产相关属性
    @property(Prefab)
    priestPrefab: Prefab = null!;

    @property
    maxPriestCount: number = 4;

    @property
    productionInterval: number = 2.0;

    @property
    spawnOffset: number = 100; // 牧师出现在建筑下方

    @property
    moveAwayDistance: number = 80; // 牧师生成后向左右跑开的距离

    // 生产相关私有属性
    private productionProgressBar: Node = null!;
    private productionProgressGraphics: Graphics = null!;
    private producedPriests: Node[] = [];
    private productionTimer: number = 0;
    private productionProgress: number = 0; // 0-1
    private isProducing: boolean = false;
    private priestContainer: Node = null!;

    protected start() {
        super.start();

        this.producedPriests = [];
        this.productionTimer = 0;
        this.productionProgress = 0;
        this.isProducing = false;

        this.findPriestContainer();
        this.createProductionProgressBar();

        // 绑定点击事件：使用通用的移动/选择逻辑
        this.node.on(Node.EventType.TOUCH_END, this.onBuildingClick, this);
    }

    update(deltaTime: number) {
        if (this.isDestroyed) return;

        if (!this.gameManager) {
            this.findGameManager();
        }

        if (this.gameManager) {
            const state = this.gameManager.getGameState();
            if (state !== GameState.Playing) {
                return;
            }
        }

        // 清理已死亡牧师（只维护列表，不在这里处理人口）
        this.cleanupDeadPriests();

        const aliveCount = this.producedPriests.length;
        if (aliveCount < this.maxPriestCount) {
            if (this.gameManager && !this.gameManager.canAddPopulation(1)) {
                // 人口已满，停止生产
                if (this.isProducing) {
                    this.isProducing = false;
                    this.productionProgress = 0;
                    this.updateProductionProgressBar();
                }
                return;
            }

            if (!this.isProducing) {
                this.isProducing = true;
                this.productionTimer = 0;
                this.productionProgress = 0;
                this.updateProductionProgressBar();
            }

            this.productionTimer += deltaTime;

            const progressStep = 0.5;
            const totalSteps = this.productionInterval / progressStep;
            const currentStep = Math.floor(this.productionTimer / progressStep);
            this.productionProgress = Math.min(currentStep / totalSteps, 1.0);
            this.updateProductionProgressBar();

            if (this.productionTimer >= this.productionInterval) {
                this.producePriest();
                this.productionTimer = 0;
                this.productionProgress = 0;
                this.isProducing = false;
                this.updateProductionProgressBar();
            }
        } else {
            if (this.isProducing) {
                this.isProducing = false;
                this.productionProgress = 0;
                this.updateProductionProgressBar();
            }
        }
    }

    private findPriestContainer() {
        const findNodeRecursive = (node: Node, name: string): Node | null => {
            if (node.name === name) return node;
            for (const child of node.children) {
                const r = findNodeRecursive(child, name);
                if (r) return r;
            }
            return null;
        };

        let towersNode = find('Towers');
        if (!towersNode && this.node.scene) {
            towersNode = findNodeRecursive(this.node.scene, 'Towers');
        }

        if (towersNode) {
            this.priestContainer = towersNode;
        } else {
            this.priestContainer = new Node('Towers');
            const canvas = find('Canvas');
            if (canvas) {
                this.priestContainer.setParent(canvas);
            } else if (this.node.scene) {
                this.priestContainer.setParent(this.node.scene);
            }
        }
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
        if (!this.productionProgressBar || !this.productionProgressGraphics) return;

        if (!this.isProducing) {
            this.productionProgressBar.active = false;
            return;
        }

        this.productionProgressBar.active = true;
        this.productionProgressGraphics.clear();

        const barWidth = 40;
        const barHeight = 4;
        const barX = -barWidth / 2;
        const barY = 0;

        this.productionProgressGraphics.fillColor = new Color(100, 100, 100, 255);
        this.productionProgressGraphics.rect(barX, barY, barWidth, barHeight);
        this.productionProgressGraphics.fill();

        if (this.productionProgress > 0) {
            this.productionProgressGraphics.fillColor = new Color(0, 200, 100, 255);
            this.productionProgressGraphics.rect(barX, barY, barWidth * this.productionProgress, barHeight);
            this.productionProgressGraphics.fill();
        }
    }

    private producePriest() {
        if (!this.priestPrefab || !this.priestContainer) {
            return;
        }

        if (this.producedPriests.length >= this.maxPriestCount) {
            return;
        }

        if (!this.gameManager) {
            this.findGameManager();
        }

        if (this.gameManager && !this.gameManager.canAddPopulation(1)) {
            return;
        }

        const churchPos = this.node.worldPosition.clone();
        let spawnPos = new Vec3(churchPos.x, churchPos.y - this.spawnOffset, churchPos.z);
        spawnPos = this.findAvailableSpawnPosition(spawnPos);

        if (this.gameManager) {
            if (!this.gameManager.addPopulation(1)) {
                return;
            }
        }

        const priest = instantiate(this.priestPrefab);
        priest.setParent(this.priestContainer);
        priest.setWorldPosition(spawnPos);
        priest.active = true;

        const priestScript = priest.getComponent(Priest) as Priest | null;
        if (priestScript) {
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                // 排除 buildCost，由教堂脚本控制
                (configManager as any).applyConfigToUnit?.('Priest', priestScript, ['buildCost']);
            }
            
            // 应用单位卡片强化
            const talentEffectManager = TalentEffectManager.getInstance();
            talentEffectManager.applyUnitEnhancements('Priest', priestScript);
            
            // 应用公共天赋增幅
            talentEffectManager.applyTalentEffects(priestScript);
            
            priestScript.buildCost = 0;

            if (this.gameManager) {
                const unitType = (priestScript as any).unitType || 'Priest';
                this.gameManager.checkUnitFirstAppearance(unitType, priestScript);
            }
        }

        this.producedPriests.push(priest);

        const index = this.producedPriests.length - 1;
        const dirX = index % 2 === 0 ? 1 : -1;
        const targetPos = new Vec3(
            spawnPos.x + dirX * this.moveAwayDistance,
            spawnPos.y,
            spawnPos.z
        );

        if (priestScript) {
            this.scheduleOnce(() => {
                if (!priest || !priest.isValid || !priestScript) return;

                if ((priestScript as any).setManualMoveTargetPosition) {
                    (priestScript as any).setManualMoveTargetPosition(targetPos);
                } else if ((priestScript as any).moveToPosition) {
                    const moveUpdate = (dt: number) => {
                        if (!priest || !priest.isValid || !priestScript) {
                            this.unschedule(moveUpdate);
                            return;
                        }
                        const cur = priest.worldPosition;
                        const d = Vec3.distance(cur, targetPos);
                        if (d <= 10) {
                            if ((priestScript as any).stopMoving) {
                                (priestScript as any).stopMoving();
                            }
                            this.unschedule(moveUpdate);
                        } else {
                            (priestScript as any).moveToPosition(targetPos, dt);
                        }
                    };
                    this.schedule(moveUpdate, 0);
                }
            }, 0.1);
        }


        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                currentUnitCount: this.producedPriests.length
            });
        }
    }

    private findAvailableSpawnPosition(initialPos: Vec3): Vec3 {
        const checkRadius = 30;
        const offsetStep = 50;
        const maxAttempts = 20;

        if (!this.hasUnitAtPosition(initialPos, checkRadius)) {
            return initialPos;
        }

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const right = new Vec3(initialPos.x + offsetStep * attempt, initialPos.y, initialPos.z);
            if (!this.hasUnitAtPosition(right, checkRadius)) {
                return right;
            }

            const left = new Vec3(initialPos.x - offsetStep * attempt, initialPos.y, initialPos.z);
            if (!this.hasUnitAtPosition(left, checkRadius)) {
                return left;
            }
        }

        return initialPos;
    }

    private hasUnitAtPosition(position: Vec3, radius: number): boolean {
        const minDistance = radius * 2;

        const crystal = find('Crystal');
        if (crystal && crystal.isValid && crystal.active) {
            const distance = Vec3.distance(position, crystal.worldPosition);
            const crystalRadius = 50;
            const safe = (radius + crystalRadius) * 1.1;
            if (distance < safe) return true;
        }

        const findNodeRecursive = (node: Node, name: string): Node | null => {
            if (node.name === name) return node;
            for (const child of node.children) {
                const r = findNodeRecursive(child, name);
                if (r) return r;
            }
            return null;
        };

        let towersNode = find('Towers');
        if (!towersNode && this.node.scene) {
            towersNode = findNodeRecursive(this.node.scene, 'Towers');
        }

        if (towersNode) {
            const towers = towersNode.children || [];
            for (const tower of towers) {
                if (!tower || !tower.isValid || !tower.active) continue;
                const script = tower.getComponent('Arrower') as any || tower.getComponent(Priest) as any;
                if (script && script.isAlive && script.isAlive()) {
                    const d = Vec3.distance(position, tower.worldPosition);
                    const otherRadius = script.collisionRadius || radius;
                    const safe = (radius + otherRadius) * 1.2;
                    if (d < safe) return true;
                }
            }
        }

        return false;
    }

    private cleanupDeadPriests() {
        const before = this.producedPriests.length;
        let removed = 0;

        this.producedPriests = this.producedPriests.filter(node => {
            if (!node || !node.isValid || !node.active) {
                removed++;
                return false;
            }
            const script = node.getComponent(Priest) as any;
            if (script && script.isAlive) {
                const alive = script.isAlive();
                if (!alive) removed++;
                return alive;
            }
            return true;
        });

        if (before !== this.producedPriests.length) {
            if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
                this.unitSelectionManager.updateUnitInfo({
                    currentUnitCount: this.producedPriests.length
                });
            }
        }
    }

    /**
     * 建筑点击：沿用战争古树/猎手大厅的交互风格，进入移动/选中逻辑
     */
    protected onBuildingClick(event: EventTouch) {
        // 简化版：如果已有选择面板则关闭，否则显示选择面板
        event.propagationStopped = true;

        if (this.selectionPanel && this.selectionPanel.isValid) {
            this.hideSelectionPanel();
            return;
        }

        this.showSelectionPanel();
    }

    /**
     * 显示选择面板（拆除 / 升级 + 信息）
     */
    showSelectionPanel() {
        const canvas = find('Canvas');
        if (!canvas) return;

        this.selectionPanel = new Node('ChurchSelectionPanel');
        this.selectionPanel.setParent(canvas);

        const uiTransform = this.selectionPanel.addComponent(UITransform);
        uiTransform.setContentSize(120, 40);

        const worldPos = this.node.worldPosition.clone();
        worldPos.y += 50;
        this.selectionPanel.setWorldPosition(worldPos);

        const graphics = this.selectionPanel.addComponent(Graphics);
        graphics.fillColor = new Color(0, 0, 0, 180);
        graphics.rect(-60, -20, 120, 40);
        graphics.fill();

        const sellBtn = new Node('SellButton');
        sellBtn.setParent(this.selectionPanel);
        const sellTf = sellBtn.addComponent(UITransform);
        sellTf.setContentSize(50, 30);
        sellBtn.setPosition(-35, 0);
        const sellLabel = sellBtn.addComponent(Label);
        sellLabel.string = '拆除';
        sellLabel.fontSize = 16;
        sellLabel.color = Color.WHITE;

        const upgradeBtn = new Node('UpgradeButton');
        upgradeBtn.setParent(this.selectionPanel);
        const upTf = upgradeBtn.addComponent(UITransform);
        upTf.setContentSize(50, 30);
        upgradeBtn.setPosition(35, 0);
        const upLabel = upgradeBtn.addComponent(Label);
        upLabel.string = '升级';
        upLabel.fontSize = 16;
        upLabel.color = Color.WHITE;

        sellBtn.on(Node.EventType.TOUCH_END, this.onSellClick, this);
        upgradeBtn.on(Node.EventType.TOUCH_END, this.onUpgradeClick, this);

        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (this.unitSelectionManager) {
            const info: UnitInfo = {
                name: this.unitName || '教堂',
                level: this.level,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth,
                attackDamage: 0, // 教堂不攻击
                populationCost: 0,
                icon: this.cardIcon || this.defaultSpriteFrame,
                collisionRadius: this.collisionRadius,
                currentUnitCount: this.producedPriests.length,
                maxUnitCount: this.maxPriestCount,
                onUpgradeClick: () => this.onUpgradeClick(),
                onSellClick: () => this.onSellClick()
            };
            this.unitSelectionManager.selectUnit(this.node, info);
        }

        // 点击画布空白关闭面板
        this.scheduleOnce(() => {
            if (!canvas) return;
            this.globalTouchHandler = (e: EventTouch) => {
                if (this.selectionPanel && this.selectionPanel.isValid) {
                    const target = e.target as Node;
                    if (target) {
                        let cur: Node | null = target;
                        while (cur) {
                            if (cur === this.selectionPanel) {
                                return;
                            }
                            cur = cur.parent;
                        }
                    }
                }
                this.hideSelectionPanel();
            };
            canvas.on(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
        }, 0.1);
    }

    /**
     * 升级：提升可生产牧师数量
     */
    protected override onUpgradeClick(event?: EventTouch) {
        if (event) event.propagationStopped = true;

        if (!this.gameManager) {
            this.findGameManager();
        }
        if (!this.gameManager) return;

        const upgradeCost = Math.floor(this.buildCost * 0.5);
        if (!this.gameManager.canAfford(upgradeCost)) {
            return;
        }

        this.gameManager.spendGold(upgradeCost);
        this.level++;
        this.maxPriestCount += 2;

        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                level: this.level,
                maxUnitCount: this.maxPriestCount,
                currentUnitCount: this.producedPriests.length,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth
            });
        }

        this.hideSelectionPanel();
    }

    /**
     * 拆除：复用父类金币返还与销毁逻辑
     */
    protected override onSellClick(event?: EventTouch) {
        super.onSellClick(event);
    }
}


