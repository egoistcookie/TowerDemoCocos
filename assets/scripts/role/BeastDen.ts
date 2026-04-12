import { _decorator, Node, Vec3, find, Sprite, UITransform, Color, SpriteFrame, Label, UIOpacity, tween, Graphics, Prefab, assetManager, instantiate, resources } from 'cc';
import { Build } from './Build';
import { GameManager } from '../GameManager';
import { UnitManager } from '../UnitManager';
import { GameState } from '../GameState';
const { ccclass, property } = _decorator;

// 兽穴状态枚举
enum BeastDenState {
    Neutral = 0,    // 中立状态
    Tamed = 1       // 归顺我方
}

@ccclass('BeastDen')
export class BeastDen extends Build {
    // 兽穴属性
    @property
    bearSpawnDistance: number = 400;

    @property
    detectionRange: number = 100; // 安全范围（100 像素）

    // 感叹号相关
    @property
    warningExclamationInterval: number = 1.0;

    @property
    maxExclamationCount: number = 3;

    // 巨熊归顺读条
    @property
    tameDuration: number = 10.0;

    // 巨熊虚影 SpriteFrame（在编辑器中赋值）
    @property(SpriteFrame)
    bearGhostSpriteFrame: SpriteFrame = null!;

    // 状态相关
    private denState: BeastDenState = BeastDenState.Neutral;
    private unitManager: UnitManager = null!;
    private bearNode: Node = null!;
    private bearScript: any = null!;

    // 感叹号相关
    private exclamationNodes: Node[] = [];
    private exclamationTimer: number = 0;

    // 弓箭手提示标记：防止重复提示
    private hasShownArcherWarningDialog: boolean = false;

    // 巨熊虚影相关
    private bearGhostNode: Node = null!;
    private bearGhostOpacity: UIOpacity = null!;
    private bearGhostTimer: number = 0;
    private readonly BEAR_GHOST_FADE_IN_DURATION: number = 2.0;
    private bearGhostFadeInComplete: boolean = false;
    private bearGhostWaitTimer: number = 0; // 第三个感叹号后等待时间

    // 巨熊预制体缓存
    private bearPrefab: Prefab | null = null;

    // 归顺读条相关
    private tameProgress: number = 0; // 保留用于兼容性
    private tameIndicator: Node = null!;
    private tameLabel: Label = null!;
    private tameTimer: number = 0;

    // 边框指示器
    private borderGraphics: Graphics = null!;

    // 触发状态
    private isTriggered: boolean = false;
    private hasUnitsInRange: boolean = false;

    // 单位检测优化：每 0.5 秒检测一次
    private detectionTimer: number = 0;
    private readonly DETECTION_INTERVAL: number = 0.5;
    private cachedHasUnitsInRange: boolean = false;

    start() {
        this.unitManager = UnitManager.getInstance();

        if (!this.sprite) {
            this.sprite = this.node.getComponent(Sprite);
        }

        // 设置兽穴透明度为 50%（掩映在树木之中）
        if (this.sprite) {
            this.sprite.color = new Color(255, 255, 255, 128); // 50% 透明度
        }

        this.createBorderIndicator();
        this.createTameIndicator();
        this.createBearGhost();

        this.denState = BeastDenState.Neutral;
    }

    onEnable() {
        this.denState = BeastDenState.Neutral;
        this.isTriggered = false;
        this.hasUnitsInRange = false;
        this.cachedHasUnitsInRange = false;
        this.detectionTimer = 0;
        this.exclamationTimer = 0;
        this.bearGhostWaitTimer = 0;
        this.tameProgress = 0;
        this.tameTimer = 0;
        this.hasShownArcherWarningDialog = false; // 重置弓箭手警告标记
        this.clearExclamations();

        if (this.bearGhostNode && this.bearGhostNode.isValid) {
            this.bearGhostNode.active = false;
        }
        if (this.tameIndicator && this.tameIndicator.isValid) {
            this.tameIndicator.active = false;
        }
        this.updateBorderColor();
    }

    update(deltaTime: number) {
        if (!this.node.isValid || !this.node.active) return;

        const gameManager = this.getGameManager();
        if (!gameManager) return;

        const gameState = gameManager.getGameState();
        if (gameState !== GameState.Playing) return;

        // 每 0.5 秒检测一次范围内单位，降低 CPU 开销
        this.detectionTimer += deltaTime;
        if (this.detectionTimer >= this.DETECTION_INTERVAL) {
            this.detectionTimer = 0;

            const myPos = this.node.worldPosition;
            const friendlyCount = this.countFriendliesInRange(myPos, this.detectionRange);
            const enemyCount = this.countEnemiesInRange(myPos, this.detectionRange);
            this.cachedHasUnitsInRange = (friendlyCount + enemyCount) > 0;
        }

        const wasInRange = this.hasUnitsInRange;
        this.hasUnitsInRange = this.cachedHasUnitsInRange;

        if (this.denState === BeastDenState.Neutral) {
            this.updateNeutralState(deltaTime, wasInRange);
        } else if (this.denState === BeastDenState.Tamed) {
            this.updateTamedState(deltaTime);
        }

        // 巨熊触发流程：感叹号满 3 个后，等待 2 秒，然后虚影出现 2 秒凝实，最后生成真实巨熊
        if (this.isTriggered) {
            this.updateBearSpawnPhase(deltaTime);
        }
    }

    private updateNeutralState(deltaTime: number, wasInRange: boolean) {
        if (this.hasUnitsInRange && !wasInRange) {
            this.showBorder(true);
            this.exclamationTimer = 0;
        }

        if (!this.hasUnitsInRange && wasInRange) {
            this.clearExclamations();
            this.exclamationTimer = 0;
            this.hideBorder();
            return;
        }

        // 只有在有单位在范围内时才处理感叹号
        if (!this.hasUnitsInRange) {
            return;
        }

        // 弓箭手第一次进入范围时显示提示
        if (!wasInRange && this.hasUnitsInRange && !this.hasShownArcherWarningDialog) {
            const arrower = this.getFirstArrowerInFriendlies();
            if (arrower) {
                const gameManager = this.getGameManager();
                if (gameManager && typeof (gameManager as any)['showQuickUnitIntro'] === 'function') {
                    (gameManager as any)['showQuickUnitIntro'](
                        arrower,
                        '弓箭手',
                        '指挥官，这里有个兽穴，要不要去侦查一下？',
                        'Arrower'
                    );
                    this.hasShownArcherWarningDialog = true;
                }
            }
        }

        if (this.isTriggered) return;

        // 显示红边高亮
        this.showBorder(true);

        this.exclamationTimer += deltaTime;
        if (this.exclamationTimer >= this.warningExclamationInterval) {
            this.exclamationTimer = 0;

            if (this.exclamationNodes.length < this.maxExclamationCount) {
                this.addExclamation();
                // 第一个感叹号出现时开始预加载巨熊预制体
                if (this.exclamationNodes.length === 1) {
                    this.preloadBear();
                }
            }

            if (this.exclamationNodes.length >= this.maxExclamationCount) {
                this.triggerBearSpawn();
            }
        }
    }

    private updateTamedState(deltaTime: number) {
        // 只有在巨熊已死亡（bearNode 不存在）时才显示读条
        if (!this.bearNode || !this.bearNode.isValid) {
            // 检查读条是否未完成
            if (this.tameTimer < this.tameDuration) {
                this.tameTimer += deltaTime;
                const progress = Math.min(this.tameTimer / this.tameDuration, 1.0);
                this.updateTameIndicator(progress);

                if (progress >= 1.0) {
                    this.resurrectBear();
                    this.tameIndicator.active = false;
                }
            }
        } else {
            // 巨熊还活着，隐藏读条
            if (this.tameIndicator && this.tameIndicator.isValid) {
                this.tameIndicator.active = false;
            }
        }
    }

    private addExclamation() {
        const canvas = find('Canvas');
        if (!canvas || !canvas.isValid) {
            console.warn('[BeastDen] Canvas 不存在或无效，无法添加感叹号');
            return;
        }

        const denWorldPos = this.node.getWorldPosition();
        const index = this.exclamationNodes.length;
        const exclamationNode = new Node(`Exclamation_${index}`);
        exclamationNode.setParent(canvas);

        // 感叹号直接设置为世界坐标，Y 轴偏移 60
        const xOffset = (index - (this.maxExclamationCount - 1)) * 25 + 20;
        const yOffset = 60;
        exclamationNode.setWorldPosition(new Vec3(denWorldPos.x + xOffset, denWorldPos.y + yOffset, 0));

        const labelNode = new Node('Label');
        labelNode.setParent(exclamationNode);
        const label = labelNode.addComponent(Label);
        label.string = '!';
        label.fontSize = 40;
        label.color = new Color(255, 0, 0, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        // 设置 Label 的 UI 变换
        const labelTransform = labelNode.addComponent(UITransform);
        labelTransform.setContentSize(40, 50);

        const exclamationTransform = exclamationNode.addComponent(UITransform);
        exclamationTransform.setContentSize(50, 60);

        const opacity = exclamationNode.addComponent(UIOpacity);
        opacity.opacity = 0;

        // 设置渲染层级：在 Canvas 中最顶层
        exclamationNode.setSiblingIndex(100);

        exclamationNode.active = true;
        labelNode.active = true;

        tween(opacity)
            .to(0.3, { opacity: 255 })
            .start();

        this.exclamationNodes.push(exclamationNode);
    }

    private clearExclamations() {
        for (const node of this.exclamationNodes) {
            if (node && node.isValid) {
                const opacity = node.getComponent(UIOpacity);
                if (opacity) {
                    tween(opacity)
                        .to(0.2, { opacity: 0 })
                        .call(() => {
                            if (node && node.isValid) node.destroy();
                        })
                        .start();
                } else {
                    node.destroy();
                }
            }
        }
        this.exclamationNodes = [];
    }

    private triggerBearSpawn() {
        if (this.isTriggered) return;
        this.isTriggered = true;

        // 第三个感叹号出现后，等待 2 秒再显示虚影（感叹号保留，让其自然显示 2 秒）
        this.bearGhostWaitTimer = 0;

        // 不再立即清除感叹号，而是等到虚影出现时再清除
        // this.clearExclamations();
    }

    private preloadBear() {
        // 预加载巨熊预制体，虚影凝实后才会生成真实巨熊
        // 提前在第一个感叹号阶段加载，减少玩家等待时间

        // 从 prefabs_sub 分包加载巨熊预制体并缓存
        const sub = assetManager.getBundle('prefabs_sub');
        if (sub) {
            sub.load('Bear', Prefab, (err, prefab) => {
                if (err || !prefab) {
                    console.warn('[BeastDen] preloadBear: 预制体加载失败', err);
                    return;
                }
                this.bearPrefab = prefab;
            });
        }
    }

    private createBearGhost() {
        // 虚影节点改为 Canvas 的子节点，避免受兽穴透明度影响
        const canvas = find('Canvas');
        if (!canvas) {
            console.warn('[BeastDen] Canvas 不存在，无法创建巨熊虚影');
            return;
        }

        this.bearGhostNode = new Node('BearGhost');
        this.bearGhostNode.setParent(canvas);
        // 初始位置设置为兽穴位置
        this.bearGhostNode.setWorldPosition(this.node.worldPosition);

        const sprite = this.bearGhostNode.addComponent(Sprite);
        const uiTransform = this.bearGhostNode.addComponent(UITransform);

        // 先设置 SpriteFrame 和 sizeMode
        if (this.bearGhostSpriteFrame) {
            sprite.spriteFrame = this.bearGhostSpriteFrame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        }

        // 再设置 contentSize（必须在设置 spriteFrame 之后，否则会被 Sprite 重置）
        uiTransform.setContentSize(70, 60);

        // 详细日志：检查 SpriteFrame 的原始尺寸
        if (this.bearGhostSpriteFrame) {
            const originalSize = this.bearGhostSpriteFrame.getOriginalSize();
            const rectSize = this.bearGhostSpriteFrame.getRect().size;
            if (originalSize.x !== 70 || originalSize.y !== 60) {
                // console.log(`[BeastDen] 虚影创建：sizeMode=CUSTOM, contentSize=70x60, 原始尺寸=${originalSize.x}x${originalSize.y}, 裁剪尺寸=${rectSize.x}x${rectSize.y}`);
            }
        } else {
            console.warn('[BeastDen] bearGhostSpriteFrame 未设置，虚影可能不可见');
        }

        this.bearGhostOpacity = this.bearGhostNode.addComponent(UIOpacity);
        this.bearGhostOpacity.opacity = 0;
        this.bearGhostNode.active = false;

        // 设置渲染层级：在 Wisps 之后（值越大越在上层）
        this.bearGhostNode.setSiblingIndex(45);
    }

    /**
     * 更新巨熊出生流程：等待 2 秒 → 虚影出现 2 秒凝实 → 生成真实巨熊
     */
    private updateBearSpawnPhase(deltaTime: number) {
        // 第一阶段：第三个感叹号后等待 2 秒
        if (this.bearGhostWaitTimer < 2.0) {
            this.bearGhostWaitTimer += deltaTime;
            if (this.bearGhostWaitTimer >= 2.0) {
                // 等待完成，显示虚影，同时清除感叹号
                this.clearExclamations();

                if (this.bearGhostNode && this.bearGhostNode.isValid) {
                    // 设置虚影位置为兽穴位置
                    this.bearGhostNode.setWorldPosition(this.node.worldPosition);

                    this.bearGhostNode.active = true;
                    this.bearGhostOpacity.opacity = 0;

                    // 确保虚影大小为 70x60
                    const uiTransform = this.bearGhostNode.getComponent(UITransform);
                    const sprite = this.bearGhostNode.getComponent('Sprite') as Sprite;
                    if (uiTransform) {
                        uiTransform.setContentSize(70, 60);
                    }
                    if (sprite) {
                        if (sprite.sizeMode !== Sprite.SizeMode.CUSTOM || !sprite.spriteFrame) {
                            console.log(`[BeastDen] 虚影显示前：sprite.sizeMode=${sprite.sizeMode}, spriteFrame=${!!sprite.spriteFrame}`);
                        }
                    } else {
                        console.warn('[BeastDen] 虚影 Sprite 组件不存在，尝试重新添加');
                        this.bearGhostNode.addComponent(Sprite);
                    }

                    this.bearGhostNode.setScale(1, 1, 1);
                    this.bearGhostTimer = 0;
                    this.bearGhostFadeInComplete = false;

                    // 使用 tween 实现 2 秒淡入效果（不再缩放，保持 70x60 大小）
                    // 在 tween 完成时生成真实巨熊（确保虚影完全凝实后才生成）
                    tween(this.bearGhostOpacity)
                        .to(this.BEAR_GHOST_FADE_IN_DURATION, { opacity: 255 })
                        .call(() => {
                            // 淡入完成后生成真实巨熊
                            this.bearGhostFadeInComplete = true;
                            this.spawnActualBear();
                        })
                        .start();
                } else {
                    console.error('[BeastDen] bearGhostNode 不存在');
                }
            }
            return;
        }

        // 第二阶段：虚影渐现并变大（使用 tween 后不再需要手动更新）
        if (this.bearGhostFadeInComplete) {
            return;
        }
    }

    private spawnActualBear() {
        if (this.bearNode && this.bearNode.isValid) return;

        // 重置驯化计时器，以便下次死亡时重新开始读条
        this.tameTimer = 0;
        this.tameProgress = 0;

        // 使用预加载的预制体直接生成巨熊
        if (this.bearPrefab && this.node && this.node.isValid) {
            const createContainer = () => {
                const canvas = find('Canvas');
                if (!canvas) return null;
                let container = find('Canvas/Bears');
                if (!container) {
                    container = new Node('Bears');
                    canvas.addChild(container);
                }
                return container;
            };

            const container = createContainer();
            if (container) {
                const bearNode = instantiate(this.bearPrefab);
                bearNode.setParent(container);
                const bearPos = this.node.worldPosition.clone();
                bearPos.x += 50; // 巨熊出现在兽穴右侧 50 像素

                // 检查生成位置是否有单位，如果有则左右平移
                const adjustedPos = this.findAvailableSpawnPosition(bearPos);
                bearNode.setWorldPosition(adjustedPos);

                bearNode.active = true;

                const bearScript = bearNode.getComponent('Bear') as any;
                if (bearScript) {
                    bearScript.setNeutralState(this.node, this);
                    this.bearNode = bearNode;
                    this.bearScript = bearScript;

                    // 显示巨熊单位介绍框（使用弓箭手 - 开心贴图）
                    const gameManager = this.getGameManager();
                    if (gameManager && typeof (gameManager as any)['autoCreateUnitIntroPopup'] === 'function') {
                        (gameManager as any)['autoCreateUnitIntroPopup']();
                        const unitIntroPopup = (gameManager as any)['unitIntroPopup'];
                        if (unitIntroPopup) {
                            // resources 目录下的资源，使用 resources.load 方法，需要 /spriteFrame 后缀
                            resources.load('textures/arrower/arrowerHappy/spriteFrame', SpriteFrame, (err: Error | null, spriteFrame: SpriteFrame | null) => {
                                if (err) {
                                    console.warn('[BeastDen] 加载弓箭手 - 开心贴图失败', err);
                                    unitIntroPopup.show({
                                        unitName: '巨熊',
                                        unitDescription: '指挥官，熊来啦！',
                                        unitIcon: null,
                                        unitType: 'Bear'
                                    });
                                } else {
                                    unitIntroPopup.show({
                                        unitName: '巨熊',
                                        unitDescription: '指挥官，熊来啦！',
                                        unitIcon: spriteFrame,
                                        unitType: 'Bear'
                                    });
                                }
                            });
                        }
                    } else {
                        console.warn('[BeastDen] gameManager 不存在或 autoCreateUnitIntroPopup 方法不存在');
                    }
                }
            }
        } else {
            // 如果预制体未加载完成，回退到 GameManager.spawnBear
            const gameManager = this.getGameManager();
            if (gameManager && this.node && this.node.isValid) {
                const bearPos = this.node.worldPosition.clone();
                bearPos.x += 50;
                if ((gameManager as any).spawnBear) {
                    (gameManager as any).spawnBear(bearPos, this.node, false);
                }
            }
        }

        // 隐藏虚影
        if (this.bearGhostNode && this.bearGhostNode.isValid) {
            this.bearGhostNode.active = false;
        }
    }

    /**
     * 从 Canvas/Towers 容器中获取第一个弓箭手
     */
    private getFirstArrowerInTowers(): any {
        const towersContainer = find('Canvas/Towers');
        if (!towersContainer || !towersContainer.isValid) {
            return null;
        }

        for (const tower of towersContainer.children) {
            if (!tower || !tower.active || !tower.isValid) continue;
            const arrowerScript = tower.getComponent('Arrower') as any;
            if (arrowerScript) {
                return arrowerScript;
            }
        }

        return null;
    }

    /**
     * 从友方单位中获取第一个弓箭手
     */
    private getFirstArrowerInFriendlies(): any {
        if (!this.unitManager) {
            this.unitManager = UnitManager.getInstance();
        }

        if (!this.unitManager) {
            return null;
        }

        const friendlies = this.unitManager.getFriendlies();
        for (const friendly of friendlies) {
            if (!friendly || !friendly.isValid || !friendly.active) continue;
            const arrowerScript = friendly.getComponent('Arrower') as any;
            if (arrowerScript) {
                return arrowerScript;
            }
        }

        return null;
    }

    private resurrectBear() {
        // 重置驯化计时器，以便下次死亡时重新开始读条
        this.tameTimer = 0;
        this.tameProgress = 0;

        const gameManager = this.getGameManager();
        if (gameManager) {
            const bearPos = this.node.worldPosition.clone();
            bearPos.x += 50; // 巨熊出现在兽穴右侧 50 像素

            // 检查生成位置是否有单位，如果有则左右平移
            const adjustedPos = this.findAvailableSpawnPosition(bearPos);

            if ((gameManager as any).spawnBear) {
                (gameManager as any).spawnBear(adjustedPos, this.node, true);
            }
        }
    }

    private createBorderIndicator() {
        // 先检查是否已有 Graphics 组件
        this.borderGraphics = this.node.getComponent(Graphics);
        if (!this.borderGraphics) {
            this.borderGraphics = this.node.addComponent(Graphics);
        }
    }

    private showBorder(isRed: boolean) {
        if (!this.borderGraphics) return;

        const color = isRed ? new Color(255, 0, 0, 255) : new Color(0, 255, 0, 255);

        this.borderGraphics.clear();
        this.borderGraphics.strokeColor = color;
        this.borderGraphics.lineWidth = 5;

        const uiTransform = this.node.getComponent(UITransform);
        if (uiTransform) {
            const width = uiTransform.width;
            const height = uiTransform.height;

            this.borderGraphics.moveTo(-width / 2, -height / 2);
            this.borderGraphics.lineTo(width / 2, -height / 2);
            this.borderGraphics.lineTo(width / 2, height / 2);
            this.borderGraphics.lineTo(-width / 2, height / 2);
            this.borderGraphics.lineTo(-width / 2, -height / 2);
            this.borderGraphics.stroke();
        }
    }

    private updateBorderColor() {
        if (this.denState === BeastDenState.Tamed) {
            this.showBorder(false);
        } else {
            this.hideBorder();
        }
    }

    private hideBorder() {
        if (this.borderGraphics) {
            this.borderGraphics.clear();
        }
    }

    private createTameIndicator() {
        this.tameIndicator = new Node('TameIndicator');
        this.tameIndicator.setParent(this.node);
        this.tameIndicator.setPosition(0, 0, 0); // 向下移动 100 像素，距离兽穴更近

        const uiTransform = this.tameIndicator.addComponent(UITransform);
        uiTransform.setContentSize(120, 30);

        // 背景
        const bgNode = new Node('Background');
        bgNode.setParent(this.tameIndicator);
        const bgGraphics = bgNode.addComponent(Graphics);
        bgNode.addComponent(UITransform).setContentSize(120, 30);

        bgGraphics.fillColor = new Color(50, 50, 50, 200);
        bgGraphics.roundRect(-60, -15, 120, 30, 5);
        bgGraphics.fill();

        // 进度条
        const progressNode = new Node('Progress');
        progressNode.setParent(this.tameIndicator);
        progressNode.setPosition(-55, 0, 0);
        const progressGraphics = progressNode.addComponent(Graphics);
        const progressTransform = progressNode.addComponent(UITransform);
        progressTransform.setContentSize(110, 20);

        progressGraphics.fillColor = new Color(0, 255, 0, 255);
        progressGraphics.roundRect(0, -10, 0, 20, 3);
        progressGraphics.fill();

        // 倒计时文字
        const textNode = new Node('Text');
        textNode.setParent(this.tameIndicator);
        textNode.setPosition(0, 0, 0);
        this.tameLabel = textNode.addComponent(Label);
        this.tameLabel.string = '10.0s';
        this.tameLabel.fontSize = 18;
        this.tameLabel.color = new Color(255, 255, 255, 255);

        (this.tameIndicator as any).progressGraphics = progressGraphics;
        (this.tameIndicator as any).progressTransform = progressTransform;
        this.tameIndicator.active = false;
    }

    private updateTameIndicator(progress: number) {
        if (!this.tameIndicator || !this.tameIndicator.isValid) return;

        // 只有归顺状态且巨熊已死亡时才显示读条
        if (this.denState !== BeastDenState.Tamed) {
            this.tameIndicator.active = false;
            return;
        }

        this.tameIndicator.active = true;

        const progressGraphics = (this.tameIndicator as any).progressGraphics as Graphics;
        const progressTransform = (this.tameIndicator as any).progressTransform as UITransform;

        if (progressGraphics && progressTransform) {
            const maxWidth = 110;
            const currentWidth = maxWidth * progress;

            progressTransform.setContentSize(currentWidth, 20);

            progressGraphics.clear();
            progressGraphics.fillColor = new Color(0, 255, 0, 255);
            progressGraphics.roundRect(0, -10, currentWidth, 20, 3);
            progressGraphics.fill();
        }

        if (this.tameLabel) {
            const remainingTime = this.tameDuration * (1 - progress);
            this.tameLabel.string = `${remainingTime.toFixed(1)}s`;
        }
    }

    public startTameProgress() {
        if (this.denState !== BeastDenState.Neutral) return;

        this.denState = BeastDenState.Tamed;
        this.tameTimer = 0;
        this.tameProgress = 0;
        this.updateBorderColor();

        // 激活读条指示器
        if (this.tameIndicator && this.tameIndicator.isValid) {
            this.tameIndicator.active = true;
        }
    }

    public resetToNeutral() {
        // 注意：不改变 denState，保持 Tamed 状态，让 updateTamedState 处理复活读条
        // 只需要清空 bearNode 引用，updateTamedState 会检测到 bearNode 为空并开始读条
        this.bearNode = null!;
        this.bearScript = null!;
        this.isTriggered = false;
        this.tameTimer = 0;
        this.tameProgress = 0;

        // 激活读条指示器
        if (this.tameIndicator && this.tameIndicator.isValid) {
            this.tameIndicator.active = true;
        }
        this.hideBorder();
    }

    public clearBearNode() {
        this.bearNode = null!;
        this.bearScript = null!;
    }

    public setBearNode(bearNode: Node, bearScript: any) {
        this.bearNode = bearNode;
        this.bearScript = bearScript;
    }

    private countFriendliesInRange(center: Vec3, range: number): number {
        if (!this.unitManager) {
            this.unitManager = UnitManager.getInstance();
        }

        if (!this.unitManager) {
            return 0;
        }

        const friendlies = this.unitManager.getFriendlies();
        let count = 0;
        const rangeSq = range * range;

        for (const friendly of friendlies) {
            if (!friendly || !friendly.isValid || !friendly.active) continue;

            const dx = friendly.worldPosition.x - center.x;
            const dy = friendly.worldPosition.y - center.y;
            const distSq = dx * dx + dy * dy;

            if (distSq <= rangeSq) {
                count++;
            }
        }

        return count;
    }

    private countEnemiesInRange(center: Vec3, range: number): number {
        if (!this.unitManager) {
            this.unitManager = UnitManager.getInstance();
        }

        if (this.unitManager) {
            const enemies = this.unitManager.getEnemiesInRange(center, range, true);
            return enemies.length;
        }

        return 0;
    }

    /**
     * 检查指定位置是否有单位（用于生成巨熊时的碰撞检测）
     */
    private hasUnitAtPosition(position: Vec3, checkRadius: number): boolean {
        if (!this.unitManager) {
            this.unitManager = UnitManager.getInstance();
        }

        if (!this.unitManager) {
            return false;
        }

        const checkRadiusSq = checkRadius * checkRadius;

        // 检查所有友方单位
        const friendlies = this.unitManager.getFriendlies();
        for (const friendly of friendlies) {
            if (!friendly || !friendly.isValid || !friendly.active) continue;

            const dx = friendly.worldPosition.x - position.x;
            const dy = friendly.worldPosition.y - position.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < checkRadiusSq) {
                return true;
            }
        }

        // 检查所有敌人单位
        const enemies = this.unitManager.getEnemies();
        for (const enemy of enemies) {
            if (!enemy || !enemy.isValid || !enemy.active) continue;

            const dx = enemy.worldPosition.x - position.x;
            const dy = enemy.worldPosition.y - position.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < checkRadiusSq) {
                return true;
            }
        }

        // 检查石墙
        const stoneWallsContainer = find('Canvas/StoneWalls');
        if (stoneWallsContainer && stoneWallsContainer.isValid) {
            for (const stoneWall of stoneWallsContainer.children) {
                if (!stoneWall || !stoneWall.active || !stoneWall.isValid) continue;

                const dx = stoneWall.worldPosition.x - position.x;
                const dy = stoneWall.worldPosition.y - position.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < checkRadiusSq) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * 寻找可用的生成位置：如果初始位置被占用，则左右平移寻找空位
     */
    private findAvailableSpawnPosition(initialPos: Vec3): Vec3 {
        // 检查半径 = (巨熊碰撞半径 15 + 弓箭手碰撞半径 10) * 1.2 = 30
        // 再加上一点缓冲，确保生成后不会因为太近而被卡住
        const checkRadius = 40;
        const offsetStep = 50; // 每次平移的距离
        const maxAttempts = 20; // 最多尝试 20 次（左右各 10 次）

        // 检查初始位置是否可用
        if (!this.hasUnitAtPosition(initialPos, checkRadius)) {
            return initialPos;
        }

        // 尝试左右平移，交替检查左右两侧
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const rightPos = new Vec3(initialPos.x + offsetStep * attempt, initialPos.y, initialPos.z);
            if (!this.hasUnitAtPosition(rightPos, checkRadius)) {
                return rightPos;
            }
            const leftPos = new Vec3(initialPos.x - offsetStep * attempt, initialPos.y, initialPos.z);
            if (!this.hasUnitAtPosition(leftPos, checkRadius)) {
                return leftPos;
            }
        }

        // 如果所有位置都被占用，返回初始位置（巨熊会被卡住，但至少能生成）
        return initialPos;
    }

    private getGameManager(): GameManager | null {
        const managers = find('Canvas/GameManager');
        if (managers) {
            return managers.getComponent('GameManager') as GameManager;
        }
        return null;
    }

    onDestroy() {
        this.clearExclamations();

        if (this.bearGhostNode && this.bearGhostNode.isValid) {
            this.bearGhostNode.destroy();
        }
        if (this.tameIndicator && this.tameIndicator.isValid) {
            this.tameIndicator.destroy();
        }
    }
}
