import { _decorator, Component, Node, EventTarget, instantiate, EventTouch, Sprite, SpriteFrame, find, Graphics, UITransform, Color, Prefab, Vec3, resources } from 'cc';
import { UnitSelectionManager } from '../UnitSelectionManager';
import { UnitInfo } from '../UnitInfoPanel';
import { GameState } from '../GameState';
import { GamePopup } from '../GamePopup';
const { ccclass, property } = _decorator;

const eventTarget = new EventTarget();

@ccclass('Crystal')
export class Crystal extends Component {
    @property
    maxHealth: number = 100;

    @property(Node)
    explosionEffect: Node = null!;

    @property
    level: number = 1; // 水晶等级

    @property
    collisionRadius: number = 40; // 占地范围（像素）

    @property(SpriteFrame)
    cardIcon: SpriteFrame = null!; // 单位名片图片

    @property
    maxLevel: number = 5; // 最高等级

    @property
    upgradeDuration: number = 20; // 升级时间（秒）

    @property([SpriteFrame])
    levelSprites: SpriteFrame[] = []; // 每个等级的贴图数组（索引0对应1级，索引1对应2级...）

    // 训练小精灵相关属性
    @property(Prefab)
    wispPrefab: Prefab = null!; // 小精灵预制体

    @property
    trainWispDuration: number = 3.0; // 训练小精灵时间（秒）

    @property
    trainWispCost: number = 5; // 训练小精灵费用（金币）

    @property
    wispSpawnOffset: number = 100; // 小精灵生成位置偏移（像素）

    private currentHealth: number = 100;
    private isDestroyed: boolean = false;
    private unitSelectionManager: UnitSelectionManager = null!; // 单位选择管理器
    private sprite: Sprite = null!; // Sprite组件引用
    private defaultSpriteFrame: SpriteFrame = null!; // 默认SpriteFrame
    private gameManager: any = null!; // 游戏管理器（使用 any，避免与 GameManager 形成循环依赖）
    
    // 升级相关
    private isUpgrading: boolean = false; // 是否正在升级
    private upgradeTimer: number = 0; // 升级计时器
    private upgradeProgress: number = 0; // 升级进度（0-1）
    private upgradeProgressBar: Node = null!; // 升级进度条节点
    private upgradeProgressGraphics: Graphics = null!; // 升级进度条Graphics组件

    // 训练小精灵相关
    private isTrainingWisp: boolean = false; // 是否正在训练小精灵
    private trainWispTimer: number = 0; // 训练小精灵计时器
    private trainWispProgress: number = 0; // 训练小精灵进度（0-1）
    private trainWispProgressBar: Node = null!; // 训练小精灵进度条节点
    private trainWispProgressGraphics: Graphics = null!; // 训练小精灵进度条Graphics组件

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.isUpgrading = false;
        this.upgradeTimer = 0;
        this.upgradeProgress = 0;

        // 查找单位选择管理器
        this.findUnitSelectionManager();

        // 查找游戏管理器
        this.findGameManager();

        // 获取Sprite组件
        this.sprite = this.node.getComponent(Sprite);
        if (this.sprite && this.sprite.spriteFrame) {
            this.defaultSpriteFrame = this.sprite.spriteFrame;
        }

        // 初始化等级贴图
        this.updateLevelSprite();

        // 创建升级进度条
        this.createUpgradeProgressBar();

        // 创建训练小精灵进度条（保留逻辑但默认隐藏，由自动训练复用）
        this.createTrainWispProgressBar();

        // 加载小精灵预制体（如果未设置），供自动训练使用
        if (!this.wispPrefab) {
            this.loadWispPrefab();
        }

        // 监听点击事件
        this.node.on(Node.EventType.TOUCH_END, this.onCrystalClick, this);
    }

    onDestroy() {
        // 移除点击事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onCrystalClick, this);

        // 清除单位信息面板和范围显示
        if (this.unitSelectionManager) {
            // 检查是否当前选中的是水晶
            if (this.unitSelectionManager.isUnitSelected(this.node)) {
                this.unitSelectionManager.clearSelection();
            }
        }
    }

    takeDamage(damage: number) {
        if (this.isDestroyed) {
            return;
        }

        this.currentHealth -= damage;

        // 更新单位信息面板
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                currentHealth: Math.max(0, this.currentHealth),
                maxHealth: this.maxHealth
            });
        }
        
        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.destroyCrystal();
        }
    }

    destroyCrystal() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;

        // 清除单位信息面板和范围显示
        if (this.unitSelectionManager) {
            // 检查是否当前选中的是水晶
            if (this.unitSelectionManager.isUnitSelected(this.node)) {
                this.unitSelectionManager.clearSelection();
            }
        }
        
        // 触发爆炸效果
        if (this.explosionEffect) {
            const explosion = instantiate(this.explosionEffect);
            
            // 先设置父节点和位置
            explosion.setParent(this.node.parent);
            explosion.setWorldPosition(this.node.worldPosition);
            
            // 立即设置缩放为0，确保不会显示在屏幕中央
            explosion.setScale(0, 0, 1);
            
            // 延迟一小段时间后开始动画（确保位置已正确设置）
            this.scheduleOnce(() => {
                if (explosion && explosion.isValid) {
                    // 爆炸效果会自动在ExplosionEffect的start()中开始动画
                }
            }, 0.01);
            
            // 延迟销毁爆炸效果节点（动画完成后）
            this.scheduleOnce(() => {
                if (explosion && explosion.isValid) {
                    explosion.destroy();
                }
            }, 1.0);
        }

        // 通知游戏管理器
        eventTarget.emit('crystal-destroyed');
        
        // 隐藏水晶
        this.node.active = false;
    }

    getHealth(): number {
        return this.currentHealth;
    }

    getMaxHealth(): number {
        return this.maxHealth;
    }

    isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }

    static getEventTarget(): EventTarget {
        return eventTarget;
    }

    /**
     * 查找单位选择管理器
     */
    findUnitSelectionManager() {
        // 方法1: 通过节点名称查找
        let managerNode = find('UnitSelectionManager');
        if (managerNode) {
            this.unitSelectionManager = managerNode.getComponent(UnitSelectionManager);
            if (this.unitSelectionManager) {
                return;
            }
        }
        
        // 方法2: 从场景根节点递归查找UnitSelectionManager组件
        const scene = this.node.scene;
        if (scene) {
            const findInScene = (node: Node, componentType: any): any => {
                const comp = node.getComponent(componentType);
                if (comp) return comp;
                for (const child of node.children) {
                    const found = findInScene(child, componentType);
                    if (found) return found;
                }
                return null;
            };
            this.unitSelectionManager = findInScene(scene, UnitSelectionManager);
        }
    }

    /**
     * 查找游戏管理器
     * 使用字符串组件名，避免直接导入 GameManager 造成循环依赖：
     * GameManager.ts -> Crystal.ts -> GameManager.ts
     */
    findGameManager() {
        // 方法1：通过名称直接查找 GameManager 节点
        let gmNode = find('Canvas/GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent('GameManager' as any);
            if (this.gameManager) {
                return;
            }
        }
    }

    /**
     * 创建升级进度条
     */
    createUpgradeProgressBar() {
        if (this.upgradeProgressBar) {
            return;
        }

        this.upgradeProgressBar = new Node('UpgradeProgressBar');
        this.upgradeProgressBar.setParent(this.node);
        this.upgradeProgressBar.setPosition(0, -60, 0); // 位于血量条下方

        const uiTransform = this.upgradeProgressBar.addComponent(UITransform);
        uiTransform.setContentSize(60, 6);

        this.upgradeProgressGraphics = this.upgradeProgressBar.addComponent(Graphics);
        this.updateUpgradeProgressBar();
    }

    /**
     * 更新升级进度条
     */
    updateUpgradeProgressBar() {
        if (!this.upgradeProgressGraphics) {
            return;
        }

        this.upgradeProgressGraphics.clear();
        
        if (this.isUpgrading) {
            // 显示进度条
            this.upgradeProgressBar.active = true;
            
            // 绘制进度条背景
            this.upgradeProgressGraphics.fillColor = new Color(50, 50, 50, 200);
            this.upgradeProgressGraphics.rect(-30, -3, 60, 6);
            this.upgradeProgressGraphics.fill();

            // 绘制进度条
            const progressWidth = 60 * this.upgradeProgress;
            this.upgradeProgressGraphics.fillColor = new Color(0, 255, 0, 255);
            this.upgradeProgressGraphics.rect(-30, -3, progressWidth, 6);
            this.upgradeProgressGraphics.fill();

            // 绘制边框
            this.upgradeProgressGraphics.strokeColor = new Color(255, 255, 255, 255);
            this.upgradeProgressGraphics.lineWidth = 1;
            this.upgradeProgressGraphics.rect(-30, -3, 60, 6);
            this.upgradeProgressGraphics.stroke();
        } else {
            // 隐藏进度条
            this.upgradeProgressBar.active = false;
        }
    }

    /**
     * 更新方法
     */
    update(deltaTime: number) {
        if (this.isDestroyed) {
            return;
        }

        // 检查游戏状态
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                return;
            }
        }

        // 升级逻辑
        if (this.isUpgrading) {
            this.upgradeTimer += deltaTime;
            this.upgradeProgress = Math.min(1.0, this.upgradeTimer / this.upgradeDuration);
            this.updateUpgradeProgressBar();

            if (this.upgradeProgress >= 1.0) {
                // 升级完成
                this.completeUpgrade();
            }
        }

        // 自动训练小精灵的计时逻辑
        if (this.isTrainingWisp) {
            this.trainWispTimer += deltaTime;
            this.trainWispProgress = Math.min(1.0, this.trainWispTimer / this.trainWispDuration);
            this.updateTrainWispProgressBar();

            if (this.trainWispProgress >= 1.0) {
                // 训练完成，生成小精灵
                this.completeTrainWisp();
            }
        }
    }

    /**
     * 获取升级费用
     */
    getUpgradeCost(targetLevel: number): number {
        if (targetLevel <= this.level) {
            return 0; // 不能降级
        }
        // 升级费用：2级100，3级150，4级200，5级250
        if (targetLevel === 2) {
            return 100;
        } else if (targetLevel === 3) {
            return 150;
        } else if (targetLevel === 4) {
            return 200;
        } else if (targetLevel === 5) {
            return 250;
        }
        return 250; // 默认返回最高级费用
    }

    /**
     * 开始升级
     */
    startUpgrade() {
        // 检查是否已达到最高等级
        if (this.level >= this.maxLevel) {
            GamePopup.showMessage('已达到最高等级');
            return;
        }

        // 检查是否正在升级
        if (this.isUpgrading) {
            GamePopup.showMessage('正在升级中');
            return;
        }

        // 查找游戏管理器
        if (!this.gameManager) {
            this.findGameManager();
        }

        if (!this.gameManager) {
            return;
        }

        // 计算升级费用
        const targetLevel = this.level + 1;
        const upgradeCost = this.getUpgradeCost(targetLevel);

        // 检查金币是否足够
        if (!this.gameManager.canAfford(upgradeCost)) {
            GamePopup.showMessage('金币不足');
            return;
        }

        // 扣除金币
        this.gameManager.spendGold(upgradeCost);

        // 开始升级
        this.isUpgrading = true;
        this.upgradeTimer = 0;
        this.upgradeProgress = 0;
        this.updateUpgradeProgressBar();
        
        // 升级时取消被选中的状态
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.clearSelection();
        }
    }

    /**
     * 完成升级
     */
    completeUpgrade() {
        this.level++;
        
        // 增加人口上限
        if (this.gameManager) {
            const currentMax = this.gameManager.getMaxPopulation();
            this.gameManager.setMaxPopulation(currentMax + 4);
        }

        // 更新贴图
        this.updateLevelSprite();

        // 升级完成后，自动训练2个小精灵
        this.autoTrainMultipleWisps(2);

        // 重置升级状态
        this.isUpgrading = false;
        this.upgradeTimer = 0;
        this.upgradeProgress = 0;
        this.updateUpgradeProgressBar();

        // 更新单位信息面板（如果被选中）
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                level: this.level
            });
        }
    }

    /**
     * 在游戏开始时自动训练3个小精灵（2+1）
     */
    autoTrainWispIfPossible() {
        // 查找游戏管理器，确保已进入游戏中状态
        if (!this.gameManager) {
            this.findGameManager();
        }
        if (!this.gameManager) {
            return;
        }
        const state = this.gameManager.getGameState && this.gameManager.getGameState();
        if (state !== GameState.Playing) {
            return;
        }

        // 避免同时进行多个训练
        if (this.isTrainingWisp) {
            return;
        }

        // 如果小精灵预制体还没加载好，先加载并稍后重试
        if (!this.wispPrefab) {
            this.loadWispPrefab();
            // 稍后再尝试一次，避免只尝试一次就失败
            this.scheduleOnce(() => {
                this.autoTrainWispIfPossible();
            }, 0.5);
            return;
        }

        // 初始训练2个小精灵
        this.autoTrainMultipleWisps(2);
    }
    
    /**
     * 自动训练多个小精灵
     * @param count 训练数量
     */
    autoTrainMultipleWisps(count: number) {
        if (count <= 0) {
            return;
        }
        
        // 训练第一个
        this.startTrainWisp();
        
        // 如果需要训练多个，延迟训练后续的
        if (count > 1) {
            this.scheduleOnce(() => {
                this.autoTrainMultipleWisps(count - 1);
            }, this.trainWispDuration + 0.1); // 等待当前训练完成后再训练下一个
        }
    }

    /**
     * 获取当前等级的贴图
     */
    getCurrentLevelSprite(): SpriteFrame | null {
        // 等级从1开始，数组索引从0开始
        const spriteIndex = this.level - 1;

        if (this.levelSprites && this.levelSprites.length > spriteIndex && this.levelSprites[spriteIndex]) {
            // 使用该等级的贴图
            return this.levelSprites[spriteIndex];
        } else {
            // 没有设置等级贴图，使用默认贴图
            return this.defaultSpriteFrame;
        }
    }

    /**
     * 更新等级贴图
     */
    updateLevelSprite() {
        if (!this.sprite) {
            return;
        }

        const currentSprite = this.getCurrentLevelSprite();
        if (currentSprite) {
            this.sprite.spriteFrame = currentSprite;
        }

        // 根据等级设置节点缩放比例
        // 1级：40%，2级：50%，3级：60%，4级：80%，5级：100%
        let scalePercent: number;
        switch (this.level) {
            case 1:
                scalePercent = 0.4;
                break;
            case 2:
                scalePercent = 0.5;
                break;
            case 3:
                scalePercent = 0.6;
                break;
            case 4:
                scalePercent = 0.8;
                break;
            case 5:
                scalePercent = 1.0;
                break;
            default:
                scalePercent = 0.4 + (this.level - 1) * 0.15; // 默认计算方式
        }
        this.node.setScale(scalePercent, scalePercent, 1);
    }

    /**
     * 水晶点击事件
     */
    onCrystalClick(event: EventTouch) {
        // 如果水晶已被摧毁，不显示信息面板
        if (this.isDestroyed) {
            return;
        }

        // 阻止事件冒泡
        event.propagationStopped = true;

        // 显示单位信息面板和范围
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (this.unitSelectionManager) {
            // 检查是否已经选中了水晶
            if (this.unitSelectionManager.isUnitSelected(this.node)) {
                // 如果已经选中，清除选择
                this.unitSelectionManager.clearSelection();
                return;
            }

            // 确保游戏管理器已初始化
            if (!this.gameManager) {
                this.findGameManager();
            }

            // 计算升级费用和是否可升级
            const nextLevel = this.level + 1;
            const upgradeCost = this.getUpgradeCost(nextLevel);
            const canUpgrade = this.level < this.maxLevel && !this.isUpgrading && 
                              this.gameManager && this.gameManager.canAfford(upgradeCost);

            // 获取当前等级的贴图用于显示在单位介绍框中
            const currentLevelSprite = this.getCurrentLevelSprite();

            const unitInfo: UnitInfo = {
                name: '生命之树',
                level: this.level,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth,
                attackDamage: 0, // 生命之树不攻击
                populationCost: 0, // 生命之树不占用人口
                icon: currentLevelSprite || this.cardIcon || this.defaultSpriteFrame, // 优先使用当前等级的贴图
                collisionRadius: this.collisionRadius,
                maxLevel: this.maxLevel, // 传递最高等级信息
                // 只要未达到最高等级，就显示升级按钮（点击时的检查在startUpgrade中处理）
                onUpgradeClick: this.level < this.maxLevel ? () => {
                    this.startUpgrade();
                } : undefined,
                upgradeCost: this.level < this.maxLevel ? upgradeCost : undefined, // 传递升级费用用于显示
                // 去掉训练小精灵按钮，训练改为自动进行
            };
            this.unitSelectionManager.selectUnit(this.node, unitInfo);
        }
    }

    /**
     * 加载小精灵预制体
     */
    loadWispPrefab() {
        resources.load('prefabs/Wisp', Prefab, (err, prefab) => {
            if (!err && prefab) {
                this.wispPrefab = prefab;
            } else {
                console.warn('[Crystal] 加载小精灵预制体失败:', err);
            }
        });
    }

    /**
     * 创建训练小精灵进度条
     */
    createTrainWispProgressBar() {
        if (this.trainWispProgressBar) {
            return;
        }

        this.trainWispProgressBar = new Node('TrainWispProgressBar');
        this.trainWispProgressBar.setParent(this.node);
        this.trainWispProgressBar.setPosition(0, -70, 0); // 位于升级进度条下方

        const uiTransform = this.trainWispProgressBar.addComponent(UITransform);
        uiTransform.setContentSize(60, 6);

        this.trainWispProgressGraphics = this.trainWispProgressBar.addComponent(Graphics);
        this.updateTrainWispProgressBar();
    }

    /**
     * 更新训练小精灵进度条
     */
    updateTrainWispProgressBar() {
        if (!this.trainWispProgressGraphics || !this.trainWispProgressBar) {
            return;
        }

        this.trainWispProgressGraphics.clear();
        
        if (this.isTrainingWisp) {
            // 显示进度条
            this.trainWispProgressBar.active = true;
            
            // 绘制进度条背景
            this.trainWispProgressGraphics.fillColor = new Color(50, 50, 50, 200);
            this.trainWispProgressGraphics.rect(-30, -3, 60, 6);
            this.trainWispProgressGraphics.fill();

            // 绘制进度条
            const progressWidth = 60 * this.trainWispProgress;
            this.trainWispProgressGraphics.fillColor = new Color(0, 150, 255, 255); // 蓝色
            this.trainWispProgressGraphics.rect(-30, -3, progressWidth, 6);
            this.trainWispProgressGraphics.fill();

            // 绘制边框
            this.trainWispProgressGraphics.strokeColor = new Color(255, 255, 255, 255);
            this.trainWispProgressGraphics.lineWidth = 1;
            this.trainWispProgressGraphics.rect(-30, -3, 60, 6);
            this.trainWispProgressGraphics.stroke();
        } else {
            // 隐藏进度条
            this.trainWispProgressBar.active = false;
        }
    }

    /**
     * 开始训练小精灵
     */
    startTrainWisp() {
        // 对外暴露的训练接口不再从按钮调用，仅供自动训练逻辑使用
        if (this.isTrainingWisp) {
            return;
        }

        // 检查小精灵预制体是否已加载
        if (!this.wispPrefab) {
            this.loadWispPrefab();
            return;
        }

        // 开始训练（无需消耗金币）
        this.isTrainingWisp = true;
        this.trainWispTimer = 0;
        this.trainWispProgress = 0;
        this.updateTrainWispProgressBar();
    }

    /**
     * 完成训练小精灵
     */
    completeTrainWisp() {
        if (!this.wispPrefab) {
            console.error('[Crystal] 小精灵预制体未加载');
            this.isTrainingWisp = false;
            this.trainWispTimer = 0;
            this.trainWispProgress = 0;
            this.updateTrainWispProgressBar();
            return;
        }

        // 查找小精灵容器
        let wispContainer = find('Canvas/Wisps');
        if (!wispContainer) {
            const canvas = find('Canvas');
            if (canvas) {
                wispContainer = new Node('Wisps');
                wispContainer.setParent(canvas);
            } else if (this.node.scene) {
                wispContainer = new Node('Wisps');
                wispContainer.setParent(this.node.scene);
            }
        }

        if (!wispContainer) {
            console.error('[Crystal] 无法创建小精灵容器');
            this.isTrainingWisp = false;
            this.trainWispTimer = 0;
            this.trainWispProgress = 0;
            this.updateTrainWispProgressBar();
            return;
        }

        // 计算生成位置（水晶下方）
        const crystalPos = this.node.worldPosition.clone();
        const spawnPos = new Vec3(crystalPos.x, crystalPos.y - this.wispSpawnOffset, crystalPos.z);

        // 创建小精灵
        const wisp = instantiate(this.wispPrefab);
        wisp.setParent(wispContainer);
        wisp.setWorldPosition(spawnPos);
        wisp.active = true;

        // 小精灵首次出现时，使用 GameManager 的“单位首次出现介绍框”系统
        const wispScript = wisp.getComponent('Wisp') as any;
        if (wispScript) {
            // 尽量为单位标记 prefabName（用于配置与显示）
            if (!wispScript.prefabName) {
                wispScript.prefabName = 'Wisp';
            }
            // 通过自身的 gameManager 引用触发首次出现检查（与塔建造逻辑保持一致）
            if (!this.gameManager) {
                this.findGameManager();
            }
            const gm = this.gameManager as any;
            if (gm && gm.checkUnitFirstAppearance) {
                const unitType = wispScript.unitType || 'Wisp';
                gm.checkUnitFirstAppearance(unitType, wispScript);
            }
        }

        // 重置训练状态
        this.isTrainingWisp = false;
        this.trainWispTimer = 0;
        this.trainWispProgress = 0;
        this.updateTrainWispProgressBar();
    }
}

