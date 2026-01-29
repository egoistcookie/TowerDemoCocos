import { _decorator, Component, Node, Label, director, find, Graphics, Color, UITransform, view, Sprite, Button, Vec3, resources, SpriteFrame, assetManager, Prefab, BlockInputEvents } from 'cc';
import { Crystal } from './role/Crystal';
import { UnitIntroPopup } from './UnitIntroPopup';
import { UnitConfigManager } from './UnitConfigManager';
import { PlayerDataManager } from './PlayerDataManager';
import { UnitManager } from './UnitManager';
import { UnitPool } from './UnitPool';
import { BuildingPool } from './BuildingPool';
import { GameState } from './GameState';
import { GamePopup } from './GamePopup';
import { DamageStatistics } from './DamageStatistics';
const { ccclass, property } = _decorator;

// 重新导出 GameState 以保持向后兼容
export { GameState };

@ccclass('GameManager')
export class GameManager extends Component {
    @property(Node)
    crystal: Node = null!;

    @property(Label)
    healthLabel: Label = null!;

    @property(Label)
    timerLabel: Label = null!;

    @property(Node)
    gameOverPanel: Node = null!;

    @property(Label)
    gameOverLabel: Label = null!;

    @property(Label)
    goldLabel: Label = null!;

    @property(Label)
    populationLabel: Label = null!; // 人口标签

    @property(Label)
    expLabel: Label = null!; // 经验值标签（游戏结束面板）

    @property(Button)
    exitGameButton: Button = null!; // 退出游戏按钮（ReturnButton）
    private uiManager: any = null!; // UIManager引用
    private gameOverDialog: Node = null!; // 游戏结束弹窗容器
    // 游戏结束时的全屏遮罩，阻止所有点击（类似 UnitIntroMask）
    private gameOverMask: Node | null = null;

    @property(UnitIntroPopup)
    unitIntroPopup: UnitIntroPopup = null!;

    private gameState: GameState = GameState.Ready;
    private gameTime: number = 0; // 已防御时间（累积时间，从0开始）
    private crystalScript: Crystal = null!;
    private gold: number = 20; // 初始金币
    private population: number = 0; // 当前人口
    private maxPopulation: number = 10; // 人口上限
    private currentGameExp: number = 0; // 本局游戏获得的经验值
    private playerDataManager: PlayerDataManager = null!;
    private hasShownPopulationLimitWarning: boolean = false; // 是否已显示过人口上限提示
    private hasShownFirstArrowerDeathPopup: boolean = false; // 是否已显示过第一个弓箭手死亡提示
    
    // 单位首次出现相关
    private appearedUnitTypes: Set<string> = new Set();
    private originalTimeScale: number = 1; // 保存原始时间缩放值
    
    // 单位信息属性，用于调试
    @property
    public debugUnitTypes: string[] = [];

    // 分包预制体（prefabs_sub）加载状态
    private prefabsSubLoaded: boolean = false;
    private isLoadingPrefabsSub: boolean = false;

    // 顶部左侧等级 HUD（头像 + 等级文字 + 经验条 + 体力）
    private levelHudNode: Node | null = null;
    private levelLabel: Label | null = null;
    private levelExpBarNode: Node | null = null;
    private levelExpBarMaxWidth: number = 120;
    private staminaLabel: Label | null = null;  // 体力标签

    // 结算页等级进度条
    private gameOverLevelBarBg: Node | null = null;
    private gameOverLevelBar: Node | null = null;
    private gameOverLevelLabel: Label | null = null;
    private gameOverLevelBarMaxWidth: number = 260;
    private gameOverLevelBarHeight: number = 20;

    /**
     * 在结算页创建或更新"升级进度条"，并根据本局战斗的经验变化播放从0到当前进度的动画。
     * @param prevLevel 结算前等级（使用天赋点数量表示等级）
     * @param prevExp   结算前当前等级内的经验（0-99）
     * @param currentLevel 结算后等级
     * @param currentExp   结算后当前等级内的经验（0-99）
     * @param levelsGained 本局提升的等级数
     * @param expGained 本局获得的经验值
     */
    private createOrUpdateGameOverLevelBar(
        prevLevel: number,
        prevExp: number,
        currentLevel: number,
        currentExp: number,
        levelsGained: number,
        expGained: number = 0
    ) {
        if (!this.gameOverDialog) {
            return;
        }

        // 创建背景条
        if (!this.gameOverLevelBarBg || !this.gameOverLevelBarBg.isValid) {
            this.gameOverLevelBarBg = new Node('GameOverLevelBarBg');
            this.gameOverLevelBarBg.setParent(this.gameOverDialog);

            const bgTransform = this.gameOverLevelBarBg.addComponent(UITransform);
            bgTransform.setContentSize(this.gameOverLevelBarMaxWidth, this.gameOverLevelBarHeight + 8);

            // 放在经验说明文字下方一点（布局函数会整体调整Y）
            this.gameOverLevelBarBg.setPosition(0, -100, 0);

            const bgG = this.gameOverLevelBarBg.addComponent(Graphics);
            bgG.fillColor = new Color(40, 40, 40, 220);
            bgG.roundRect(
                -this.gameOverLevelBarMaxWidth / 2,
                -this.gameOverLevelBarHeight / 2,
                this.gameOverLevelBarMaxWidth,
                this.gameOverLevelBarHeight,
                this.gameOverLevelBarHeight / 2
            );
            bgG.fill();
            bgG.lineWidth = 2;
            bgG.strokeColor = new Color(255, 215, 0, 255);
            bgG.roundRect(
                -this.gameOverLevelBarMaxWidth / 2,
                -this.gameOverLevelBarHeight / 2,
                this.gameOverLevelBarMaxWidth,
                this.gameOverLevelBarHeight,
                this.gameOverLevelBarHeight / 2
            );
            bgG.stroke();

            // 进度条前景
            this.gameOverLevelBar = new Node('GameOverLevelBar');
            this.gameOverLevelBar.setParent(this.gameOverLevelBarBg);
            const barTransform = this.gameOverLevelBar.addComponent(UITransform);
            barTransform.setContentSize(0, this.gameOverLevelBarHeight - 4);
            this.gameOverLevelBar.setPosition(-this.gameOverLevelBarMaxWidth / 2, 0, 0);

            const barG = this.gameOverLevelBar.addComponent(Graphics);
            barG.fillColor = new Color(120, 220, 80, 255);
            // 初始绘制为0宽度，后续会根据UITransform宽度动态更新
            barG.roundRect(0, - (this.gameOverLevelBarHeight - 4) / 2, 0, this.gameOverLevelBarHeight - 4, (this.gameOverLevelBarHeight - 4) / 2);
            barG.fill();

            // 等级文字：例如 "等级 Lv.3 → Lv.5 (+50经验值)"
            const labelNode = new Node('GameOverLevelLabel');
            labelNode.setParent(this.gameOverLevelBarBg);
            this.gameOverLevelLabel = labelNode.addComponent(Label);
            this.gameOverLevelLabel.fontSize = 20;
            this.gameOverLevelLabel.color = new Color(255, 255, 255, 255);
            this.gameOverLevelLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.gameOverLevelLabel.verticalAlign = Label.VerticalAlign.BOTTOM;

            const labelTransform = labelNode.addComponent(UITransform);
            labelTransform.setContentSize(this.gameOverLevelBarMaxWidth, 24);
            // 增加Y坐标间隔，从18改为28
            labelNode.setPosition(0, this.gameOverLevelBarHeight / 2 + 28, 0);
        }

        // 更新等级文字（添加经验值显示）
        const fromLevel = Math.max(1, prevLevel);
        const toLevel = Math.max(1, currentLevel);
        if (this.gameOverLevelLabel) {
            let levelText = '';
            if (fromLevel === toLevel) {
                levelText = `等级 Lv.${toLevel}`;
            } else {
                levelText = `等级 Lv.${fromLevel} → Lv.${toLevel}`;
            }
            // 添加经验值显示
            if (expGained > 0) {
                levelText += ` (+${expGained}经验值)`;
            }
            this.gameOverLevelLabel.string = levelText;
        }

        // 确保进度条存在
        if (!this.gameOverLevelBar || !this.gameOverLevelBar.isValid) {
            return;
        }

        const barTransform = this.gameOverLevelBar.getComponent(UITransform);
        const barG = this.gameOverLevelBar.getComponent(Graphics);
        if (!barTransform || !barG) {
            return;
        }

        // 更新进度条Graphics绘制的辅助方法
        const updateBarGraphics = (width: number) => {
            barG.clear();
            if (width > 0) {
                barG.fillColor = new Color(120, 220, 80, 255);
                barG.roundRect(0, - (this.gameOverLevelBarHeight - 4) / 2, width, this.gameOverLevelBarHeight - 4, (this.gameOverLevelBarHeight - 4) / 2);
                barG.fill();
            }
        };

        // 先重置为0宽度，再播放动画
        barTransform.setContentSize(0, this.gameOverLevelBarHeight - 4);
        updateBarGraphics(0);

        const totalLevelsGained = Math.max(0, levelsGained);
        const finalExpRatio = Math.max(0, Math.min(1, currentExp / 100));

        // 如果没有获得经验，只显示静态进度
        if (this.currentGameExp <= 0 || (totalLevelsGained === 0 && prevLevel === currentLevel && prevExp === currentExp)) {
            const ratio = finalExpRatio;
            const finalWidth = this.gameOverLevelBarMaxWidth * ratio;
            barTransform.setContentSize(finalWidth, this.gameOverLevelBarHeight - 4);
            updateBarGraphics(finalWidth);
            return;
        }

        // 播放多级升级动画：每级一次"拉满"效果，最后一段拉到当前经验
        const singleDuration = 0.4; // 每次拉满的时间

        const playFill = (targetRatio: number, onComplete?: () => void) => {
            let elapsed = 0;
            const startWidth = barTransform.width;
            const targetWidth = this.gameOverLevelBarMaxWidth * targetRatio;

            const step = (dt: number) => {
                elapsed += dt;
                const t = Math.min(1, elapsed / singleDuration);
                const width = startWidth + (targetWidth - startWidth) * t;
                barTransform.setContentSize(width, this.gameOverLevelBarHeight - 4);
                // 每次更新宽度时，重新绘制Graphics
                updateBarGraphics(width);
                if (t >= 1) {
                    this.unschedule(step);
                    if (onComplete) {
                        onComplete();
                    }
                }
            };

            this.schedule(step, 0);
        };

        // 动画序列
        let remainingLevels = totalLevelsGained;

        const playSequence = () => {
            if (remainingLevels > 0) {
                // 对每一个完整升级，进度条从0拉满
                barTransform.setContentSize(0, this.gameOverLevelBarHeight - 4);
                updateBarGraphics(0);
                playFill(1, () => {
                    remainingLevels--;
                    playSequence();
                });
            } else {
                // 最后一段：从0拉到当前经验进度
                barTransform.setContentSize(0, this.gameOverLevelBarHeight - 4);
                updateBarGraphics(0);
                playFill(finalExpRatio);
            }
        };

        playSequence();
    }
    
    // 自动创建UnitIntroPopup
    private autoCreateUnitIntroPopup() {
        if (this.unitIntroPopup) {
            return;
        }
        
        
        // 添加Canvas节点作为容器（如果没有的话）
        let canvas = find('Canvas');
        if (!canvas) {
            canvas = new Node('Canvas');
            const scene = director.getScene();
            if (scene) {
                canvas.setParent(scene);
            }
        }
        
        // 创建完整的UI结构
        const containerNode = new Node('container');
        containerNode.setParent(canvas);
        
        // 获取Canvas的实际尺寸
        const canvasTransform = canvas.getComponent(UITransform);
        const screenWidth = canvasTransform?.width || 750;
        const screenHeight = canvasTransform?.height || 1334;
        
        // 设置容器尺寸为屏幕下方三分之一
        const popupHeight = screenHeight / 3;
        
        // 左右与边框保持50像素间隔，所以容器宽度 = 屏幕宽度 - 100
        const popupWidth = screenWidth - 100;
        
        // 添加UITransform组件以设置尺寸
        const uiTransform = containerNode.addComponent(UITransform);
        uiTransform.setContentSize(popupWidth, popupHeight);
        
        // 设置容器的锚点为底部中心
        uiTransform.setAnchorPoint(0.5, 0);
        
        // 设置容器位置，使其底部与屏幕底部对齐
        containerNode.setPosition(0, 0, 0);
        
        // 设置容器颜色和透明度
        const containerGraphics = containerNode.addComponent(Graphics);
        containerGraphics.fillColor = new Color(0, 0, 0, 200);
        
        // 圆角半径
        const cornerRadius = 15;
        
        // 绘制半透明黑色背景（圆角矩形）
        containerGraphics.roundRect(-popupWidth / 2, -popupHeight / 2, popupWidth, popupHeight, cornerRadius);
        containerGraphics.fill();
        
        // 添加高亮边框（圆角矩形）
        containerGraphics.strokeColor = new Color(100, 200, 255, 255); // 亮蓝色边框
        containerGraphics.lineWidth = 3;
        containerGraphics.roundRect(-popupWidth / 2, -popupHeight / 2, popupWidth, popupHeight, cornerRadius);
        containerGraphics.stroke();
        
        // 计算左右区域的宽度和位置（使用调整后的popupWidth）
        const halfWidth = popupWidth / 2;
        
        // 创建左侧单位图片区域
        const iconNode = new Node('unitIcon');
        iconNode.setParent(containerNode);
        // 左侧区域中心位置：相对于容器中心向左偏移halfWidth/2
        iconNode.setPosition(-halfWidth / 2, 0, 0);
        const iconTransform = iconNode.addComponent(UITransform);
        // 左侧区域尺寸：宽度为halfWidth的80%，高度为popupHeight的80%
        iconTransform.setContentSize(halfWidth * 0.8, popupHeight * 0.8);
        const iconSprite = iconNode.addComponent(Sprite);
        iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        
        // 创建右侧介绍区域
        const contentNode = new Node('content');
        contentNode.setParent(containerNode);
        // 右侧区域中心位置：相对于容器中心向右偏移halfWidth/2
        contentNode.setPosition(halfWidth / 2, 0, 0);
        const contentTransform = contentNode.addComponent(UITransform);
        // 右侧区域尺寸：宽度为halfWidth，高度为popupHeight
        contentTransform.setContentSize(halfWidth, popupHeight);
        
        // 创建单位名称节点（右侧区域顶部）
        const nameNode = new Node('unitName');
        nameNode.setParent(contentNode);
        nameNode.setPosition(0, popupHeight / 2 - 50, 0);
        const nameLabel = nameNode.addComponent(Label);
        nameLabel.string = '单位名称';
        nameLabel.fontSize = 32;
        nameLabel.color = new Color(255, 255, 255, 255);
        nameLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        
        // 创建单位描述节点（右侧区域中部）
        const descNode = new Node('unitDescription');
        descNode.setParent(contentNode);
        descNode.setPosition(0, 0, 0);
        const descLabel = descNode.addComponent(Label);
        descLabel.string = '单位描述';
        descLabel.fontSize = 24;
        descLabel.color = new Color(255, 255, 255, 255);
        descLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
        descLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        descLabel.verticalAlign = Label.VerticalAlign.TOP;
        const descTransform = descNode.addComponent(UITransform);
        descTransform.setContentSize(halfWidth * 0.9, popupHeight * 0.6);
        
        // 创建关闭按钮节点（右上角）
        const closeNode = new Node('closeButton');
        closeNode.setParent(containerNode);
        // 右上角位置：相对于容器中心，向右偏移popupWidth/2 - 30，向上偏移popupHeight/2 - 30
        closeNode.setPosition(popupWidth / 2 - 30, popupHeight / 2 - 30, 0);
        const closeButton = closeNode.addComponent(Button);
        const closeTransform = closeNode.addComponent(UITransform);
        closeTransform.setContentSize(50, 50);
        
        // 添加关闭按钮背景
        const closeGraphics = closeNode.addComponent(Graphics);
        closeGraphics.fillColor = new Color(200, 50, 50, 255);
        closeGraphics.circle(0, 0, 25);
        closeGraphics.fill();
        
        // 添加关闭按钮边框
        closeGraphics.strokeColor = new Color(255, 255, 255, 255);
        closeGraphics.lineWidth = 2;
        closeGraphics.circle(0, 0, 25);
        closeGraphics.stroke();
        
        // 添加UnitIntroPopup组件到container节点
        const unitIntroPopup = containerNode.addComponent(UnitIntroPopup);
        
        // 设置组件属性
        unitIntroPopup.container = containerNode;
        unitIntroPopup.unitIcon = iconSprite;
        unitIntroPopup.unitName = nameLabel;
        unitIntroPopup.unitDescription = descLabel;
        unitIntroPopup.closeButton = closeButton;
        
        // 设置到GameManager的属性
        this.unitIntroPopup = unitIntroPopup;
        
    }

    start() {
        // 初始化单位管理器（性能优化）
        this.initializeUnitManager();
        this.initializeUnitPool();
        this.initializeBuildingPool();
        
        // 加载单位配置
        const configManager = UnitConfigManager.getInstance();
        configManager.loadConfig().then(() => {
        }).catch((err) => {
        });
        
        // 初始化玩家数据管理器
        this.playerDataManager = PlayerDataManager.getInstance();
        this.playerDataManager.loadData().then(() => {
        }).catch((err) => {
        });
        
        // 查找UIManager
        const uiManagerNode = find('UIManager') || find('UI/UIManager') || find('Canvas/UI/UIManager');
        if (uiManagerNode) {
            this.uiManager = uiManagerNode.getComponent('UIManager');
        }
        
        // 每次游戏开始时清空已出现单位类型集合
        this.appearedUnitTypes.clear();
        this.debugUnitTypes = [];
        
        // 重置本局经验值
        this.currentGameExp = 0;
        
        // 显式将游戏状态设置为Ready，确保游戏开始前处于准备状态
        this.gameState = GameState.Ready;
        
        // 增强水晶节点查找逻辑
        if (!this.crystal) {
            // 尝试多种路径查找水晶节点
            const crystalPaths = [
                'Crystal',
                'Canvas/Crystal',
                'Units/Crystal',
                'GameWorld/Crystal',
                'World/Crystal',
                'Map/Crystal'
            ];
            
            for (const path of crystalPaths) {
                const foundCrystal = find(path);
                if (foundCrystal) {
                    this.crystal = foundCrystal;
                    break;
                }
            }
            
            if (!this.crystal) {
                return;
            }
        }
        
        
        this.crystalScript = this.crystal.getComponent(Crystal);
        // 监听水晶销毁事件
        if (this.crystalScript) {
            Crystal.getEventTarget().on('crystal-destroyed', this.onCrystalDestroyed, this);
        } else {
        }
        if (this.gameOverPanel) {
            this.gameOverPanel.active = false;
            
            // 隐藏退出游戏按钮
            if (this.exitGameButton && this.exitGameButton.node) {
                this.exitGameButton.node.active = false;
            }
            
            // 隐藏弹窗
            if (this.gameOverDialog) {
                this.gameOverDialog.active = false;
            }
        }
        
        // 自动创建单位介绍弹窗
        this.autoCreateUnitIntroPopup();
        
        this.updateUI();
        
        // 在游戏开始前隐藏所有游戏主体相关内容
        this.hideGameElements();
        
        // 初始化并显示左上角等级HUD（首页显示）
        this.updateLevelHud();
    }
    
    /**
     * 初始化单位管理器（性能优化）
     */
    private initializeUnitManager() {
        // 检查是否已存在UnitManager
        let unitManagerNode = find('UnitManager');
        if (!unitManagerNode) {
            // 创建UnitManager节点
            unitManagerNode = new Node('UnitManager');
            const scene = director.getScene();
            if (scene) {
                unitManagerNode.setParent(scene);
            } else {
                // 如果场景不存在，尝试添加到Canvas
                const canvas = find('Canvas');
                if (canvas) {
                    unitManagerNode.setParent(canvas);
                }
            }
            // 添加UnitManager组件
            unitManagerNode.addComponent(UnitManager);
        }
    }
    
    /**
     * 初始化单位对象池（性能优化）
     */
    private initializeUnitPool() {
        // 检查是否已存在UnitPool
        let unitPoolNode = find('UnitPool');
        if (!unitPoolNode) {
            // 创建UnitPool节点
            unitPoolNode = new Node('UnitPool');
            const scene = director.getScene();
            if (scene) {
                unitPoolNode.setParent(scene);
            } else {
                // 如果场景不存在，尝试添加到Canvas
                const canvas = find('Canvas');
                if (canvas) {
                    unitPoolNode.setParent(canvas);
                }
            }
            // 添加UnitPool组件
            unitPoolNode.addComponent(UnitPool);
        }
    }
    
    /**
     * 初始化建筑物对象池（性能优化）
     */
    private initializeBuildingPool() {
        // 检查是否已存在BuildingPool
        let buildingPoolNode = find('BuildingPool');
        if (!buildingPoolNode) {
            // 创建BuildingPool节点
            buildingPoolNode = new Node('BuildingPool');
            const scene = director.getScene();
            if (scene) {
                buildingPoolNode.setParent(scene);
            } else {
                // 如果场景不存在，尝试添加到Canvas
                const canvas = find('Canvas');
                if (canvas) {
                    buildingPoolNode.setParent(canvas);
                }
            }
            // 添加BuildingPool组件
            buildingPoolNode.addComponent(BuildingPool);
        }
    }
    
    /**
     * 在游戏开始前或退出游戏时隐藏所有游戏主体相关内容，但保留底部选区
     */
    hideGameElements() {
        // 隐藏所有游戏元素，包括水晶
        const enemies = find('Enemies');
        if (enemies) {
            enemies.active = false;
        }
        
        const towers = find('Towers');
        if (towers) {
            towers.active = false;
        }
        
        // 退出游戏时隐藏水晶
        if (this.crystal) {
            this.crystal.active = false;
        }
        
        // 隐藏游戏内状态标签：血量 / 计时 / 金币 / 人口
        if (this.healthLabel) {
            this.healthLabel.node.active = false;
        }
        if (this.timerLabel) {
            this.timerLabel.node.active = false;
        }
        if (this.goldLabel) {
            this.goldLabel.node.active = false;
        }
        if (this.populationLabel) {
            this.populationLabel.node.active = false;
        }

        // 隐藏建造按钮（多种路径兼容）
        const buildButtonNode = find('UI/BuildButton') || find('Canvas/UI/BuildButton') || find('BuildButton');
        if (buildButtonNode) {
            buildButtonNode.active = false;
        }
        // 如果有 UIManager，则通过它再隐藏一遍
        const uiManagerNode = find('UIManager') || find('UI/UIManager') || find('Canvas/UI/UIManager');
        if (uiManagerNode) {
            const uiManager = uiManagerNode.getComponent('UIManager') as any;
            if (uiManager && uiManager.buildButton) {
                uiManager.buildButton.node.active = false;
            }
        }

        // 隐藏宝石首页上的退出游戏按钮
        if (this.exitGameButton && this.exitGameButton.node) {
            this.exitGameButton.node.active = false;
        }

        // 隐藏 Canvas/UI 下的图标：HIcon、GIcon、PIcon
        const uiRoot = find('Canvas/UI') || find('UI');
        if (uiRoot) {
            const hIcon = uiRoot.getChildByName('HIcon');
            if (hIcon) hIcon.active = false;
            const gIcon = uiRoot.getChildByName('GIcon');
            if (gIcon) gIcon.active = false;
            const pIcon = uiRoot.getChildByName('PIcon');
            if (pIcon) pIcon.active = false;
        }

        // 更新左上角等级HUD显示状态（会根据gameMainPanel的显示状态自动控制）
        this.updateLevelHud();

    }
    
    /**
     * 递归查找整个场景中的水晶节点
     */
    private findCrystalRecursive(node: Node): Node | null {
        // 检查当前节点是否是水晶
        if (node.name.toLowerCase().includes('crystal')) {
            return node;
        }
        
        // 递归检查所有子节点
        for (const child of node.children) {
            const found = this.findCrystalRecursive(child);
            if (found) {
                return found;
            }
        }
        
        return null;
    }
    
    /**
     * 手动构建节点的完整路径
     */
    private getNodePath(node: Node): string {
        let path = node.name;
        let current = node.parent;
        while (current) {
            path = `${current.name}/${path}`;
            current = current.parent;
        }
        return path;
    }
    
    /**
     * 检查并确保节点及其所有父节点都处于激活状态
     */
    private ensureNodeAndParentsActive(node: Node): void {
        let current = node;
        while (current) {
            if (!current.active) {
                current.active = true;
            }
            current = current.parent;
        }
    }
    
    /**
     * 在游戏开始后显示所有游戏主体相关内容
     */
    showGameElements() {
        // 隐藏左上角等级HUD（游戏开始时隐藏，由updateLevelHud根据gameMainPanel状态控制）
        // 这里不需要手动隐藏，updateLevelHud会自动处理
        
        // 显示所有游戏元素
        const enemies = find('Enemies');
        if (enemies) {
            enemies.active = true;
        }
        
        const towers = find('Towers');
        if (towers) {
            towers.active = true;
        }
        
        // 显示水晶 - 基于用户提供的资源位置，水晶位于Canvas/Crystal
        if (!this.crystal) {
            
            // 直接使用用户提供的路径查找水晶
            this.crystal = find('Canvas/Crystal');
            
            if (this.crystal) {
                this.crystalScript = this.crystal.getComponent(Crystal);
                if (this.crystalScript) {
                    Crystal.getEventTarget().on('crystal-destroyed', this.onCrystalDestroyed, this);
                }
            } else {
                // 尝试递归查找作为备用方案
                const scene = director.getScene();
                if (scene) {
                    this.crystal = this.findCrystalRecursive(scene);
                    if (this.crystal) {
                        this.crystalScript = this.crystal.getComponent(Crystal);
                        if (this.crystalScript) {
                            Crystal.getEventTarget().on('crystal-destroyed', this.onCrystalDestroyed, this);
                        }
                    }
                }
            }
        }
        
        // 强制显示水晶节点
        if (this.crystal) {
            
            // 确保水晶节点及其所有父节点都处于激活状态
            this.ensureNodeAndParentsActive(this.crystal);
            
            // 直接设置水晶节点为激活状态
            this.crystal.active = true;
        } else {
            // 最后尝试直接查找并显示，不保存引用
            const directCrystal = find('Canvas/Crystal');
            if (directCrystal) {
                directCrystal.active = true;
            }
        }
        
        // 显示游戏主体相关的标签和按钮
        if (this.healthLabel) {
            this.healthLabel.node.active = true;
        }
        
        if (this.timerLabel) {
            this.timerLabel.node.active = true;
        }
        
        if (this.goldLabel) {
            this.goldLabel.node.active = true;
        }
        
        if (this.populationLabel) {
            this.populationLabel.node.active = true;
        }
        
        // 显示建造按钮（尝试多种路径）
        const buildButton = find('UI/BuildButton') || find('Canvas/UI/BuildButton') || find('BuildButton');
        if (buildButton) {
            buildButton.active = true;
        } else {
        }
        
        // 查找UIManager并显示建造按钮
        const uiManagerNode = find('UIManager') || find('UI/UIManager') || find('Canvas/UI/UIManager');
        if (uiManagerNode) {
            const uiManager = uiManagerNode.getComponent('UIManager') as any;
            if (uiManager && uiManager.buildButton) {
                uiManager.buildButton.node.active = true;
            }
        }
        
        // 显示所有其他UI元素
        const uiNode = find('UI') || find('Canvas/UI');
        if (uiNode) {
            for (const child of uiNode.children) {
                // 显示所有UI元素，除了特定的隐藏元素
                if (child.name !== 'container' && child.name !== 'GameOverPanel') {
                    child.active = true;
                }
            }
        } else {
        }
        
    }
    

    onDestroy() {
        // 移除事件监听
        if (this.crystalScript) {
            Crystal.getEventTarget().off('crystal-destroyed', this.onCrystalDestroyed, this);
        }
    }

    /**
     * 根据当前状态，统一控制游戏内 HUD（血量、时间、金币、人口、图标、建造/退出按钮）的显隐
     * - 仅在 GameState.Playing 时显示
     * - 在首页（Ready）、暂停、结算等状态全部隐藏
     */
    private setInGameUIVisible(visible: boolean) {
        // 优先使用序列化引用
        if (this.healthLabel && this.healthLabel.node.isValid) {
            this.healthLabel.node.active = visible;
        }
        if (this.timerLabel && this.timerLabel.node.isValid) {
            this.timerLabel.node.active = visible;
        }
        if (this.goldLabel && this.goldLabel.node.isValid) {
            this.goldLabel.node.active = visible;
        }
        if (this.populationLabel && this.populationLabel.node.isValid) {
            this.populationLabel.node.active = visible;
        }

        // 注意：exitGameButton 在结算时可能会被移动到 GameOverDialog 作为“结算页退出按钮”
        // 如果它已经不在 HUD（Canvas/UI）下，就不要在这里强制隐藏，否则会导致结算页只剩“重新开始”
        if (this.exitGameButton && this.exitGameButton.node && this.exitGameButton.node.isValid) {
            const parentName = this.exitGameButton.node.parent?.name;
            const isInHud = parentName === 'UI' || parentName === 'Canvas' || parentName === 'Canvas/UI';
            const isInGameOverDialog = parentName === 'GameOverDialog' || this.exitGameButton.node.parent === this.gameOverDialog;
            if (!isInGameOverDialog) {
                this.exitGameButton.node.active = visible;
            }
        }

        // 通过节点路径兜底，确保即使序列化引用未绑定也能正确隐藏
        const uiRoot = find('Canvas/UI') || find('UI');
        if (uiRoot) {
            const names = ['HealthLabel', 'TimerLabel', 'GoldLabel', 'PopulationLabel', 'HIcon', 'GIcon', 'PIcon', 'BuildButton', 'ExitGameButton', 'ReturnButton'];
            for (const name of names) {
                const child = uiRoot.getChildByName(name);
                if (child && child.isValid) {
                    child.active = visible;
                }
            }
        }

        // UIManager 中的建造按钮也一起控制
        const uiManagerNode = this.uiManager
            ? (this.uiManager.node as Node | undefined)
            : (find('UIManager') || find('UI/UIManager') || find('Canvas/UI/UIManager'));
        if (uiManagerNode) {
            const uiManager = this.uiManager || (uiManagerNode.getComponent('UIManager') as any);
            if (uiManager && uiManager.buildButton && uiManager.buildButton.node && uiManager.buildButton.node.isValid) {
                uiManager.buildButton.node.active = visible;
            }
        }
    }

    update(deltaTime: number) {
        const isPlaying = this.gameState === GameState.Playing;
        // 统一控制 HUD 显隐：只有战斗中才显示，首页/暂停/结算等都隐藏
        this.setInGameUIVisible(isPlaying);

        // 定期更新左上角等级HUD的显示状态（根据gameMainPanel的显示状态）
        // 只在非游戏状态时检查，避免频繁检查影响性能
        if (!isPlaying && this.levelHudNode && this.levelHudNode.isValid) {
            const bottomSelectionNode = find('Canvas/BottomSelection');
            let gameMainPanel: Node | null = null;
            if (bottomSelectionNode) {
                gameMainPanel = bottomSelectionNode.getChildByName('GameMainPanel');
            }
            const shouldShow = gameMainPanel && gameMainPanel.active === true;
            if (this.levelHudNode.active !== shouldShow) {
                this.levelHudNode.active = shouldShow;
                if (shouldShow) {
                    // 如果显示，更新内容
                    this.updateLevelHud();
                }
            }
        }

        if (!isPlaying) {
            return;
        }

        // 更新已防御时间（累积时间）
        this.gameTime += deltaTime;

        this.updateUI();
    }

    updateUI() {
        // 更新血量显示
        if (this.healthLabel && this.crystalScript) {
            this.healthLabel.string = `${Math.max(0, Math.floor(this.crystalScript.getHealth()))}`;
        }

        // 更新已防御时间显示
        if (this.timerLabel) {
            const minutes = Math.floor(this.gameTime / 60);
            const seconds = Math.floor(this.gameTime % 60);
            const secondsStr = seconds < 10 ? `0${seconds}` : `${seconds}`;
            this.timerLabel.string = `已防御: ${minutes}:${secondsStr}`;
        }

        // 更新金币显示
        if (this.goldLabel) {
            this.goldLabel.string = `${this.gold}`;
        }

        // 更新人口显示
        if (this.populationLabel) {
            this.populationLabel.string = `${this.population}/${this.maxPopulation}`;
        }

        // 更新左上角等级 HUD（头像 + 等级 + 经验条）
        this.updateLevelHud();
    }

    /**
     * 创建或更新左上角的等级 HUD（头像 + 等级文字 + 经验进度条）
     */
    private updateLevelHud() {
        const uiRoot = find('Canvas/UI') || find('UI');
        if (!uiRoot) {
            return;
        }

        if (!this.levelHudNode || !this.levelHudNode.isValid) {
            // 创建 HUD 根节点
            this.levelHudNode = new Node('LevelHUD');
            this.levelHudNode.setParent(uiRoot);

            const uiTransform = this.levelHudNode.addComponent(UITransform);
            uiTransform.setContentSize(260, 60);

            // 放到左上角（相对于 Canvas），位置继续往上移动
            const visibleSize = view.getVisibleSize();
            const offsetX = -visibleSize.width / 2 + 150;
            const offsetY = visibleSize.height / 2 + 10;  // 继续往上移动，从-20改为+10
            this.levelHudNode.setPosition(offsetX, offsetY, 0);

            // 头像区域（左侧一个圆形或方形占位）
            const avatarNode = new Node('Avatar');
            avatarNode.setParent(this.levelHudNode);
            const avatarTransform = avatarNode.addComponent(UITransform);
            avatarTransform.setContentSize(48, 48);
            avatarNode.setPosition(-90, 0, 0);

            const avatarG = avatarNode.addComponent(Graphics);
            avatarG.fillColor = new Color(80, 80, 80, 255);
            avatarG.circle(0, 0, 24);
            avatarG.fill();

            // 等级文字
            const levelLabelNode = new Node('LevelLabel');
            levelLabelNode.setParent(this.levelHudNode);
            this.levelLabel = levelLabelNode.addComponent(Label);
            this.levelLabel.string = 'Lv.1';
            this.levelLabel.fontSize = 20;
            this.levelLabel.color = new Color(255, 255, 255, 255);
            this.levelLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
            this.levelLabel.verticalAlign = Label.VerticalAlign.CENTER;

            const levelLabelTransform = levelLabelNode.addComponent(UITransform);
            levelLabelTransform.setContentSize(120, 24);
            levelLabelNode.setPosition(-30, 16, 0);

            // 经验条背景
            const barBgNode = new Node('LevelExpBarBg');
            barBgNode.setParent(this.levelHudNode);
            const barBgTransform = barBgNode.addComponent(UITransform);
            barBgTransform.setContentSize(this.levelExpBarMaxWidth, 16);
            barBgNode.setPosition(-20, -12, 0);

            const bgG = barBgNode.addComponent(Graphics);
            bgG.fillColor = new Color(40, 40, 40, 200);
            bgG.roundRect(-this.levelExpBarMaxWidth / 2, -8, this.levelExpBarMaxWidth, 16, 8);
            bgG.fill();
            bgG.lineWidth = 2;
            bgG.strokeColor = new Color(200, 200, 200, 255);
            bgG.roundRect(-this.levelExpBarMaxWidth / 2, -8, this.levelExpBarMaxWidth, 16, 8);
            bgG.stroke();

            // 经验条前景
            const barNode = new Node('LevelExpBar');
            barNode.setParent(barBgNode);
            const barTransform = barNode.addComponent(UITransform);
            barTransform.setContentSize(0, 12);
            barNode.setPosition(-this.levelExpBarMaxWidth / 2, 0, 0);

            const barG = barNode.addComponent(Graphics);
            barG.fillColor = new Color(80, 200, 120, 255);
            barG.roundRect(0, -6, this.levelExpBarMaxWidth, 12, 6);
            barG.fill();

            this.levelExpBarNode = barNode;

            // 体力标签（显示在经验条下方）
            const staminaLabelNode = new Node('StaminaLabel');
            staminaLabelNode.setParent(this.levelHudNode);
            this.staminaLabel = staminaLabelNode.addComponent(Label);
            this.staminaLabel.string = '体力: 50/50';
            this.staminaLabel.fontSize = 18;
            this.staminaLabel.color = new Color(255, 200, 100, 255);
            this.staminaLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
            this.staminaLabel.verticalAlign = Label.VerticalAlign.CENTER;

            const staminaLabelTransform = staminaLabelNode.addComponent(UITransform);
            staminaLabelTransform.setContentSize(120, 24);
            staminaLabelNode.setPosition(-30, -32, 0);  // 在经验条下方
        }

        if (!this.playerDataManager) {
            return;
        }

        const talentPoints = this.playerDataManager.getTalentPoints();
        const level = Math.max(1, talentPoints); // 将天赋点概念直接视为等级
        const currentExp = this.playerDataManager.getExperience(); // 0-99
        const ratio = Math.max(0, Math.min(1, currentExp / 100));

        if (this.levelLabel) {
            this.levelLabel.string = `Lv.${level}`;
        }

        if (this.levelExpBarNode && this.levelExpBarNode.isValid) {
            const barTransform = this.levelExpBarNode.getComponent(UITransform);
            if (barTransform) {
                barTransform.setContentSize(this.levelExpBarMaxWidth * ratio, 12);
            }
        }

        // 更新体力显示
        if (this.staminaLabel) {
            const stamina = this.playerDataManager.getStamina();
            this.staminaLabel.string = `体力: ${stamina}/50`;
        }

        // 根据游戏首页（gameMainPanel）的显示状态来控制levelHudNode的显示/隐藏
        // 参考上一关、下一关按钮的显示逻辑：只在gameMainPanel显示时显示
        const bottomSelectionNode = find('Canvas/BottomSelection');
        let gameMainPanel: Node | null = null;
        if (bottomSelectionNode) {
            gameMainPanel = bottomSelectionNode.getChildByName('GameMainPanel');
        }
        
        if (this.levelHudNode && this.levelHudNode.isValid) {
            // 只在游戏首页（gameMainPanel）显示时显示levelHudNode
            const shouldShow = gameMainPanel && gameMainPanel.active === true;
            this.levelHudNode.active = shouldShow;
        }
    }

    onCrystalDestroyed() {
        if (this.gameState === GameState.Playing) {
            this.endGame(GameState.Defeat);
        }
    }

    // 记录最近一次游戏结果状态，用于结算界面（MVP/SVP 显示）
    private lastGameResultState: GameState | null = null;

    endGame(state: GameState) {
        console.info(`[GameManager.endGame] 游戏结束，状态: ${state === GameState.Victory ? 'Victory' : state === GameState.Defeat ? 'Defeat' : 'Other'}`);
        this.gameState = state;
        
        // 游戏结束时，清理所有单位（敌人直接消失，塔停止移动）
        this.cleanupAllUnitsForEndGame();
        
        // 显示结算面板
        this.showGameResultPanel(state);
    }
    
    /**
     * 显示游戏结算面板（统一方法，用于游戏结束和主动退出）
     * @param state 游戏状态（Victory/Defeat/Other），如果为null则显示为"主动退出"
     */
    showGameResultPanel(state: GameState | null = null) {
        // 记录本次结果状态（null 表示主动退出）
        this.lastGameResultState = state;
        
        // 消耗体力（每局游戏无论输赢都消耗5点体力）
        if (this.playerDataManager) {
            this.playerDataManager.consumeStamina(5);
        }
        
        // 保存经验相关的数据，用于后续创建进度条
        let prevLevel = 0;
        let prevExp = 0;
        let currentLevel = 0;
        let currentExp = 0;
        let levelsGained = 0;
        let expGainedThisGame = 0;
        
        // 结算经验值（即使为0也要保存，确保数据持久化）
        if (this.playerDataManager) {
            if (this.currentGameExp > 0) {
                // 结算前的等级和经验（用于做升级进度动画）
                prevLevel = this.playerDataManager.getTalentPoints();
                prevExp = this.playerDataManager.getExperience(); // 0-99

                // 保存本次获得的经验值（用于显示）
                expGainedThisGame = this.currentGameExp;
                levelsGained = this.playerDataManager.addExperience(this.currentGameExp);
                currentLevel = this.playerDataManager.getTalentPoints();
                currentExp = this.playerDataManager.getExperience();
                const remainingExp = this.playerDataManager.getRemainingExpForNextLevel();
                
                // 在游戏结束面板显示经验和等级概览
                if (this.expLabel) {
                    let expText = `本次获得经验值: +${expGainedThisGame}`;
                    expText += `\n当前等级: Lv.${Math.max(1, currentLevel)}`;
                    expText += `\n当前经验值: ${currentExp} / 100 (下一级还需 ${remainingExp})`;
                    this.expLabel.string = expText;
                } else {
                    // 如果expLabel未设置，尝试在gameOverPanel中创建
                    this.createExpLabelIfNeeded(expGainedThisGame, 0);
                }
            } else {
                // 即使没有获得经验值，也要保存数据
                this.playerDataManager.saveData();
                currentLevel = this.playerDataManager.getTalentPoints();
                currentExp = this.playerDataManager.getExperience();
                const remainingExp = this.playerDataManager.getRemainingExpForNextLevel();
                prevLevel = Math.max(1, currentLevel);
                prevExp = currentExp;
                if (this.expLabel) {
                    this.expLabel.string = `本次获得经验值: +0\n当前等级: Lv.${Math.max(1, currentLevel)}\n当前经验值: ${currentExp} / 100 (下一级还需 ${remainingExp})`;
                } else {
                    this.createExpLabelIfNeeded(0, 0);
                }
            }
        }
        
        if (this.gameOverPanel) {
            this.gameOverPanel.active = true;
        }

        // 创建或获取游戏结束弹窗（必须在创建进度条之前）
        this.createGameOverDialog();
        
        // 创建 / 更新结算页等级进度条，并播放从0到当前进度的动画（必须在createGameOverDialog之后）
        if (this.playerDataManager) {
            if (this.currentGameExp > 0) {
                this.createOrUpdateGameOverLevelBar(prevLevel, prevExp, currentLevel, currentExp, levelsGained, expGainedThisGame);
            } else {
                // 经验没有增加时，仍然显示当前进度条（但不播放动画）
                this.createOrUpdateGameOverLevelBar(
                    prevLevel,
                    prevExp,
                    currentLevel,
                    currentExp,
                    0,
                    0
                );
            }
        }
        
        // 初始化退出游戏按钮（查找场景中的ReturnButton）
        this.initExitGameButton();
        
        // 显示退出游戏按钮
        if (this.exitGameButton && this.exitGameButton.node) {
            this.exitGameButton.node.active = true;
        }
        
        // 设置结果标签文本
        if (this.gameOverLabel) {
            if (state === null) {
                // 主动退出
                this.gameOverLabel.string = '游戏结算';
            } else if (state === GameState.Victory) {
                this.gameOverLabel.string = '胜利！';
                
                // 记录当前关卡为已通过
                if (this.uiManager && this.uiManager.getCurrentLevel) {
                    const currentLevel = this.uiManager.getCurrentLevel();
                    if (this.playerDataManager && currentLevel) {
                        this.playerDataManager.passLevel(currentLevel);
                        console.info(`[GameManager.showGameResultPanel] 关卡 ${currentLevel} 已标记为通过`);
                    }
                }
            } else if (state === GameState.Defeat) {
                this.gameOverLabel.string = '失败！';
            } else {
                this.gameOverLabel.string = '游戏结束';
            }
            // 调大字体
            this.gameOverLabel.fontSize = 48;
        }
        
        // 停止伤害统计
        const damageStats = DamageStatistics.getInstance();
        damageStats.stopRecording();
        
        // 创建伤害统计图表
        this.createDamageStatsPanel();
        
        // 确保UI元素已移动到弹窗中
        this.moveUIElementsToDialog();
        
        // 调整所有UI元素的位置
        this.layoutGameOverUI();
        
        // 将弹窗置于最上层
        this.setGameOverUIOnTop();
        
        // 显示弹窗
        if (this.gameOverDialog) {
            this.gameOverDialog.active = true;
            console.info('[GameManager.showGameResultPanel] 游戏结算弹窗已显示');
        } else {
            console.warn('[GameManager.showGameResultPanel] 游戏结算弹窗不存在！');
        }

        // 更新左上角等级HUD显示状态（会根据gameMainPanel的显示状态自动控制）
        this.updateLevelHud();
    }
    
    /**
     * 创建伤害统计图表面板
     */
    private createDamageStatsPanel() {
        if (!this.gameOverDialog) {
            return;
        }
        
        // 检查是否已存在伤害统计面板
        let statsPanel = this.gameOverDialog.getChildByName('DamageStatsPanel');
        if (statsPanel) {
            statsPanel.destroy();
        }
        
        // 创建伤害统计面板
        statsPanel = new Node('DamageStatsPanel');
        statsPanel.setParent(this.gameOverDialog);
        
        // 添加UITransform组件（调整尺寸：高度增加，宽度减少）
        const statsTransform = statsPanel.addComponent(UITransform);
        statsTransform.setContentSize(380, 150);
        
        // 创建背景
        const statsBg = new Node('StatsBackground');
        statsBg.setParent(statsPanel);
        const bgTransform = statsBg.addComponent(UITransform);
        bgTransform.setContentSize(380, 150);
        const bgGraphics = statsBg.addComponent(Graphics);
        bgGraphics.fillColor = new Color(20, 20, 20, 200);
        bgGraphics.roundRect(-190, -75, 380, 150, 8);
        bgGraphics.fill();
        bgGraphics.strokeColor = new Color(150, 150, 150, 255);
        bgGraphics.lineWidth = 1;
        bgGraphics.roundRect(-190, -75, 380, 150, 8);
        bgGraphics.stroke();
        
        // 获取总伤害前三位的单位（按总伤害排序，更符合“谁打得最多”的直觉）
        const damageStats = DamageStatistics.getInstance();
        // 先取出所有单位的统计数据，按“贡献值”排序后再截取前3名
        const allUnits = damageStats.getAllDamageData();
        
        // 计算单位的贡献值：剑士用承伤，牧师用治疗，其它用总伤害
        const getContributionValue = (unit: any): number => {
            if (unit.unitType === 'ElfSwordsman') {
                return unit.damageTaken || 0;
            } else if (unit.unitType === 'Priest') {
                return unit.healAmount || 0;
            }
            return unit.totalDamage || 0;
        };
        
        const filteredUnits = allUnits.filter(u => getContributionValue(u) > 0);
        // 按贡献值从高到低排序
        filteredUnits.sort((a, b) => getContributionValue(b) - getContributionValue(a));
        const topUnits = filteredUnits.slice(0, 3);
        
        if (topUnits.length === 0) {
            // 如果没有伤害数据，显示提示
            const noDataLabel = new Node('NoDataLabel');
            noDataLabel.setParent(statsPanel);
            const labelTransform = noDataLabel.addComponent(UITransform);
            labelTransform.setContentSize(380, 150);
            const label = noDataLabel.addComponent(Label);
            label.string = '暂无贡献数据';
            label.fontSize = 20;
            label.color = new Color(150, 150, 150, 255);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            return;
        }
        
        // 创建标题
        const titleLabel = new Node('TitleLabel');
        titleLabel.setParent(statsPanel);
        titleLabel.setPosition(0, 60, 0);
        const titleTransform = titleLabel.addComponent(UITransform);
        titleTransform.setContentSize(380, 25);
        const title = titleLabel.addComponent(Label);
        // 标题改为“贡献榜”
        title.string = '贡献榜';
        title.fontSize = 18;
        title.color = new Color(255, 255, 200, 255);
        title.horizontalAlign = Label.HorizontalAlign.CENTER;
        title.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 计算最大“贡献值”（剑士用承伤、牧师用治疗，其它用总伤害）
        const maxContribution = Math.max(...topUnits.map(u => getContributionValue(u)));
        
        // 创建每个单位的统计项（调整布局：缩小名称和数值之间的距离）
        const itemHeight = 28;
        const itemSpacing = 6;
        const startY = 25;
        
        topUnits.forEach((unit, index) => {
            const itemNode = new Node(`StatsItem_${index}`);
            itemNode.setParent(statsPanel);
            itemNode.setPosition(0, startY - index * (itemHeight + itemSpacing), 0);
            
            const itemTransform = itemNode.addComponent(UITransform);
            itemTransform.setContentSize(350, itemHeight);
            
            // 单位名称标签（向左移动，缩小与数值的距离）
            const nameLabel = new Node('NameLabel');
            nameLabel.setParent(itemNode);
            nameLabel.setPosition(-140, 0, 0);
            const nameTransform = nameLabel.addComponent(UITransform);
            nameTransform.setContentSize(80, itemHeight);
            const name = nameLabel.addComponent(Label);
            // 第一名加上 MVP/SVP 前缀，并使用金色高亮
            let displayName = unit.unitName;
            if (index === 0) {
                const isVictory = this.lastGameResultState === GameState.Victory;
                const prefix = isVictory ? 'MVP ' : 'SVP ';
                displayName = prefix + displayName;
                name.color = new Color(255, 215, 0, 255);
            } else {
                name.color = new Color(255, 255, 255, 255);
            }
            name.string = displayName;
            name.fontSize = 16;
            name.horizontalAlign = Label.HorizontalAlign.LEFT;
            name.verticalAlign = Label.VerticalAlign.CENTER;
            
            // 贡献数值标签（向右移动，缩小与名称的距离）
            const contribLabelNode = new Node('ContributionLabel');
            contribLabelNode.setParent(itemNode);
            contribLabelNode.setPosition(-30, 0, 0);
            const contribTransform = contribLabelNode.addComponent(UITransform);
            contribTransform.setContentSize(110, itemHeight);
            const contribLabel = contribLabelNode.addComponent(Label);

            const contributionValue = getContributionValue(unit);
            let suffix = '';
            // 剑士：承伤（红色数字，黑色描边）
            if (unit.unitName === '剑士') {
                suffix = '（承伤）';
                contribLabel.color = new Color(255, 0, 0, 255);      // 红色数字
                contribLabel.enableOutline = true;
                contribLabel.outlineColor = new Color(0, 0, 0, 255);   // 黑色描边
                contribLabel.outlineWidth = 2;
            }
            // 牧师：治疗量（绿色数字，黑色描边）
            else if (unit.unitName === '牧师') {
                suffix = '（治疗量）';
                contribLabel.color = new Color(0, 255, 0, 255);     // 绿色文字
                contribLabel.enableOutline = true;
                contribLabel.outlineColor = new Color(0, 0, 0, 255); // 黑色描边
                contribLabel.outlineWidth = 2;
            }
            // 其它单位：默认伤害贡献
            else {
                contribLabel.color = new Color(200, 255, 200, 255);
            }

            contribLabel.string = `${Math.floor(contributionValue)}${suffix}`;
            contribLabel.fontSize = 14;
            contribLabel.horizontalAlign = Label.HorizontalAlign.RIGHT;
            contribLabel.verticalAlign = Label.VerticalAlign.CENTER;
            
            // 伤害条背景（调整位置和大小）
            const barBg = new Node('BarBackground');
            barBg.setParent(itemNode);
            barBg.setPosition(50, 0, 0);
            const barBgTransform = barBg.addComponent(UITransform);
            barBgTransform.setContentSize(250, 16);
            const barBgGraphics = barBg.addComponent(Graphics);
            barBgGraphics.fillColor = new Color(50, 50, 50, 255);
            barBgGraphics.roundRect(-125, -8, 250, 16, 3);
            barBgGraphics.fill();
            
            // 贡献条（根据贡献值比例）
            const bar = new Node('Bar');
            bar.setParent(barBg);
            const barTransform = bar.addComponent(UITransform);
            const barWidth = maxContribution > 0 ? (getContributionValue(unit) / maxContribution) * 250 : 0;
            barTransform.setContentSize(barWidth, 16);
            bar.setPosition(-125 + barWidth / 2, 0, 0);
            const barGraphics = bar.addComponent(Graphics);
            
            // 根据排名设置不同颜色
            let barColor: Color;
            if (index === 0) {
                barColor = new Color(255, 215, 0, 255); // 金色
            } else if (index === 1) {
                barColor = new Color(192, 192, 192, 255); // 银色
            } else {
                barColor = new Color(205, 127, 50, 255); // 铜色
            }
            
            barGraphics.fillColor = barColor;
            barGraphics.roundRect(-barWidth / 2, -8, barWidth, 16, 3);
            barGraphics.fill();

            // 在条状图上显示对应的“贡献值”数值（居中显示，数值本身变色，描边统一黑色）
            const contribValueLabelNode = new Node('ContributionValueLabel');
            // 挂在实际的贡献条上，这样文本始终被限制在条内部，不会跑到前端之外出现“多出来的1”
            contribValueLabelNode.setParent(bar);
            contribValueLabelNode.setPosition(0, 0, 0);
            const contribValueLabelTransform = contribValueLabelNode.addComponent(UITransform);
            // 宽度跟随当前条宽
            contribValueLabelTransform.setContentSize(barWidth, 16);
            const contribValueLabel = contribValueLabelNode.addComponent(Label);
            // 与右侧数字保持一致的后缀显示
            let centerSuffix = '';
            if (unit.unitName === '剑士') {
                centerSuffix = '（承伤）';
            } else if (unit.unitName === '牧师') {
                centerSuffix = '（治疗量）';
            }
            contribValueLabel.string = `${Math.floor(contributionValue)}${centerSuffix}`;
            contribValueLabel.fontSize = 14;
            // 数值颜色：剑士红字，牧师绿色，其它白字
            if (unit.unitName === '牧师') {
                contribValueLabel.color = new Color(0, 255, 0, 255);   // 绿色数字
            } else if (unit.unitName === '剑士') {
                contribValueLabel.color = new Color(255, 0, 0, 255);   // 红色数字
            } else {
                contribValueLabel.color = new Color(255, 255, 255, 255);
            }
            contribValueLabel.enableOutline = true;
            // 描边统一黑色，避免在条前端出现彩色块
            contribValueLabel.outlineColor = new Color(0, 0, 0, 255);
            contribValueLabel.outlineWidth = 2;
            contribValueLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            contribValueLabel.verticalAlign = Label.VerticalAlign.CENTER;
        });
    }
    
    /**
     * 为按钮加载贴图并设置Sprite组件
     * @param buttonNode 按钮节点
     * @param normalPath 正常状态的贴图路径（相对于textures/icon）
     * @param pressedPath 按下状态的贴图路径（相对于textures/icon）
     */
    private setupButtonSprite(buttonNode: Node, normalPath: string, pressedPath: string) {
        // 移除现有的Graphics组件（如果存在）
        const graphics = buttonNode.getComponent(Graphics);
        if (graphics) {
            graphics.destroy();
        }
        
        // 移除现有的Label组件（如果存在，因为按钮现在使用贴图）
        const label = buttonNode.getComponent(Label);
        if (label) {
            label.destroy();
        }
        
        // 添加Sprite组件（必须在Button之前添加）
        let sprite = buttonNode.getComponent(Sprite);
        if (!sprite) {
            sprite = buttonNode.addComponent(Sprite);
        }
        
        // 获取或添加Button组件，并设置过渡模式
        let button = buttonNode.getComponent(Button);
        if (!button) {
            button = buttonNode.addComponent(Button);
        }
        button.transition = Button.Transition.SPRITE;
        // 设置target为按钮节点本身（包含Sprite组件的节点）
        button.target = buttonNode;
        
        // 加载正常状态贴图（移除文件扩展名，并添加 /spriteFrame 后缀）
        const normalPathWithoutExt = normalPath.replace(/\.(png|jpg|jpeg)$/i, '');
        const normalResourcePath = `textures/icon/${normalPathWithoutExt}/spriteFrame`;
        
        resources.load(normalResourcePath, SpriteFrame, (err, spriteFrame) => {
            if (err) {
                console.error(`Failed to load button sprite: ${normalPath} (path: ${normalResourcePath})`, err);
                return;
            }
            if (sprite && sprite.node && sprite.node.isValid && button && button.node && button.node.isValid) {
                sprite.spriteFrame = spriteFrame;
                // 设置Button的normalSprite
                button.normalSprite = spriteFrame;
            }
        });
        
        // 加载按下状态贴图（移除文件扩展名，并添加 /spriteFrame 后缀）
        const pressedPathWithoutExt = pressedPath.replace(/\.(png|jpg|jpeg)$/i, '');
        const pressedResourcePath = `textures/icon/${pressedPathWithoutExt}/spriteFrame`;
        
        resources.load(pressedResourcePath, SpriteFrame, (err, pressedSpriteFrame) => {
            if (err) {
                console.error(`Failed to load button pressed sprite: ${pressedPath} (path: ${pressedResourcePath})`, err);
                return;
            }
            if (button && button.node && button.node.isValid && pressedSpriteFrame) {
                // 设置Button的pressedSprite
                button.pressedSprite = pressedSpriteFrame;
            }
        });
    }
    
    /**
     * 初始化退出游戏按钮（查找场景中的 ExitButton 节点）
     */
    private initExitGameButton() {
        if (!this.gameOverPanel) {
            return;
        }
        
        // 如果已经通过@property设置了，直接使用
        if (this.exitGameButton && this.exitGameButton.node && this.exitGameButton.node.isValid) {
            // 绑定点击事件
            this.exitGameButton.node.off(Button.EventType.CLICK);
            this.exitGameButton.node.on(Button.EventType.CLICK, () => {
                this.onExitGameClick();
            }, this);
            // 设置按钮贴图
            this.setupButtonSprite(this.exitGameButton.node, 'exit.png', 'exit_down.png');
            return;
        }
        
        // 1）优先在 gameOverPanel / gameOverDialog 下查找名为 ExitButton 的节点
        let exitButtonNode: Node | null = null;
        exitButtonNode = this.gameOverPanel.getChildByName('ExitButton');
        if (!exitButtonNode && this.gameOverDialog) {
            exitButtonNode = this.gameOverDialog.getChildByName('ExitButton');
        }

        // 2）如果还没找到，尝试在整个场景中递归查找 ExitButton
        if (!exitButtonNode && this.node && this.node.scene) {
            const findNodeRecursive = (node: Node, name: string): Node | null => {
                if (node.name === name) {
                    return node;
                }
                for (const child of node.children) {
                    const found = findNodeRecursive(child, name);
                    if (found) return found;
                }
                return null;
            };
            exitButtonNode = findNodeRecursive(this.node.scene, 'ExitButton');
        }

        if (!exitButtonNode) {
            console.warn('[GameManager.initExitGameButton] 未能在场景中找到名为 ExitButton 的节点，自动创建一个。');
            // 在弹窗下动态创建一个退出按钮节点
            const parentForExit = this.gameOverDialog || this.gameOverPanel || this.node;
            exitButtonNode = new Node('ExitButton');
            exitButtonNode.setParent(parentForExit);
        } else {
            // 确保退出按钮在结算弹窗容器下，这样布局函数才能正常摆放
            if (this.gameOverDialog && exitButtonNode.parent !== this.gameOverDialog) {
                exitButtonNode.setParent(this.gameOverDialog);
            }
        }

        // 获取或添加 Button 组件
        let button = exitButtonNode.getComponent(Button);
        if (!button) {
            button = exitButtonNode.addComponent(Button);
        }

                this.exitGameButton = button;

                // 绑定点击事件
                button.node.off(Button.EventType.CLICK);
                button.node.on(Button.EventType.CLICK, () => {
                    this.onExitGameClick();
                }, this);

                // 设置按钮贴图
                this.setupButtonSprite(button.node, 'exit.png', 'exit_down.png');
    }
    
    /**
     * 退出游戏按钮点击事件
     */
    private onExitGameClick() {
        // 如果结算面板未显示，先显示结算面板
        if (!this.gameOverDialog || !this.gameOverDialog.active) {
            // 显示结算面板（主动退出）
            this.showGameResultPanel(null);
            return; // 显示结算面板后，等待用户再次点击退出按钮
        }
        
        // 如果结算面板已显示，则真正退出游戏
        // 结算经验值（虽然已经在showGameResultPanel中结算了，但这里确保保存）
        if (this.playerDataManager) {
            this.settleGameExperience();
        }
        
        // 隐藏结算面板
        if (this.gameOverDialog) {
            this.gameOverDialog.active = false;
        }
        // 隐藏结算全屏遮罩
        if (this.gameOverMask && this.gameOverMask.isValid) {
            this.gameOverMask.active = false;
        }
        if (this.gameOverPanel) {
            this.gameOverPanel.active = false;
        }
        
        // 直接调用UIManager的onExitGameClick方法（无需确认框）
        if (this.uiManager && (this.uiManager as any).onExitGameClick) {
            (this.uiManager as any).onExitGameClick();
        } else {
            // 如果找不到UIManager，尝试直接查找
            const uiManagerNode = find('UIManager') || find('UI/UIManager') || find('Canvas/UI/UIManager');
            if (uiManagerNode) {
                const uiManager = uiManagerNode.getComponent('UIManager') as any;
                if (uiManager && uiManager.onExitGameClick) {
                    uiManager.onExitGameClick();
                }
            }
        }
    }
    
    /**
     * 创建游戏结束弹窗容器
     */
    private createGameOverDialog() {
        // 如果弹窗已存在，直接返回
        if (this.gameOverDialog && this.gameOverDialog.isValid) {
            // 确保UI元素在弹窗中
            if (this.gameOverPanel) {
                this.moveUIElementsToDialog();
            }
            return;
        }
        
        // 如果gameOverPanel不存在，仍然创建弹窗，但需要创建必要的UI元素
        if (!this.gameOverPanel) {
            console.warn('[GameManager.createGameOverDialog] gameOverPanel不存在，但仍会创建弹窗');
        }
        
        // 创建弹窗容器 - 直接放到Canvas的最上层，而不是gameOverPanel
        const canvas = find('Canvas');
        this.gameOverDialog = new Node('GameOverDialog');
        if (canvas) {
            // 先创建/更新全屏遮罩，阻止所有点击
            this.createOrUpdateGameOverMask(canvas);

            this.gameOverDialog.setParent(canvas);
            // 设置到Canvas的最上层（高于遮罩）
            this.gameOverDialog.setSiblingIndex(Number.MAX_SAFE_INTEGER);
        } else {
            // 如果找不到Canvas，回退到gameOverPanel
            this.gameOverDialog.setParent(this.gameOverPanel);
        }
        this.gameOverDialog.setPosition(0, 100, 0); // 向上移300像素
        
        // 添加UITransform组件
        const dialogTransform = this.gameOverDialog.addComponent(UITransform);
        dialogTransform.setContentSize(500, 600); // 弹窗大小（增加高度以容纳伤害统计图表）
        
        // 创建弹窗背景（使用Graphics绘制半透明背景）
        const graphics = this.gameOverDialog.addComponent(Graphics);
        graphics.fillColor = new Color(30, 30, 30, 230); // 深色半透明背景
        const width = 500;
        const height = 600; // 增加高度
        const cornerRadius = 10; // 圆角半径
        graphics.roundRect(-width / 2, -height / 2, width, height, cornerRadius);
        graphics.fill();
        
        // 绘制边框
        graphics.strokeColor = new Color(200, 200, 200, 255);
        graphics.lineWidth = 2;
        graphics.roundRect(-width / 2, -height / 2, width, height, cornerRadius);
        graphics.stroke();

        // 阻止所有输入事件穿透到游戏中的单位、网格、按钮等
        this.gameOverDialog.addComponent(BlockInputEvents);
        
        // 将相关UI元素移动到弹窗中
        if (this.gameOverPanel) {
            this.moveUIElementsToDialog();
        } else {
            // 如果gameOverPanel不存在，创建必要的UI元素
            this.createGameOverUIElements();
        }
    }

    /**
     * 创建或更新游戏结束时的全屏遮罩，阻止任何点击穿透到游戏内单位 / 网格 / 按钮
     */
    private createOrUpdateGameOverMask(canvas: Node) {
        if (this.gameOverMask && this.gameOverMask.isValid) {
            this.gameOverMask.setParent(canvas);
        } else {
            this.gameOverMask = new Node('GameOverMask');
            this.gameOverMask.setParent(canvas);

            // 覆盖整个屏幕
            const uiTransform = this.gameOverMask.addComponent(UITransform);
            const visibleSize = view.getVisibleSize();
            uiTransform.setContentSize(visibleSize.width * 2, visibleSize.height * 2);
            this.gameOverMask.setPosition(0, 0, 0);

            // 可选：轻微透明度的黑色遮罩（也可以不画，只用于阻止点击）
            // 这里画一个很淡的透明层，如果你不想变暗，可以把 alpha 改成 0
            const graphics = this.gameOverMask.addComponent(Graphics);
            graphics.fillColor = new Color(0, 0, 0, 0); // 完全透明，只做点击拦截
            graphics.rect(-visibleSize.width, -visibleSize.height, visibleSize.width * 2, visibleSize.height * 2);
            graphics.fill();

            // 关键：阻止所有输入事件穿透
            this.gameOverMask.addComponent(BlockInputEvents);
        }

        // 遮罩在 Canvas 顶层，但低于弹窗本身
        this.gameOverMask.setSiblingIndex(Number.MAX_SAFE_INTEGER - 1);
        this.gameOverMask.active = true;
    }
    
    /**
     * 创建游戏结束UI元素（当gameOverPanel不存在时）
     */
    private createGameOverUIElements() {
        if (!this.gameOverDialog) {
            return;
        }
        
        // 创建结果标签（如果不存在）
        if (!this.gameOverLabel) {
            const labelNode = new Node('GameOverLabel');
            labelNode.setParent(this.gameOverDialog);
            labelNode.setPosition(0, 100, 0);
            this.gameOverLabel = labelNode.addComponent(Label);
            this.gameOverLabel.string = '胜利！';
            this.gameOverLabel.fontSize = 48;
            this.gameOverLabel.color = new Color(255, 255, 255, 255);
            this.gameOverLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.gameOverLabel.verticalAlign = Label.VerticalAlign.CENTER;
        }
        
        // 创建经验值标签（如果不存在）
        if (!this.expLabel) {
            const expNode = new Node('ExpLabel');
            expNode.setParent(this.gameOverDialog);
            expNode.setPosition(0, 0, 0);
            this.expLabel = expNode.addComponent(Label);
            this.expLabel.string = '';
            this.expLabel.fontSize = 18;
            this.expLabel.color = new Color(200, 200, 200, 255);
            this.expLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.expLabel.verticalAlign = Label.VerticalAlign.CENTER;
        }
    }
    
    /**
     * 将UI元素移动到弹窗中
     */
    private moveUIElementsToDialog() {
        if (!this.gameOverDialog || !this.gameOverPanel) {
            return;
        }
        
        // 移动结果标签到弹窗（如果不在弹窗中）
        if (this.gameOverLabel && this.gameOverLabel.node && this.gameOverLabel.node.parent !== this.gameOverDialog) {
            this.gameOverLabel.node.setParent(this.gameOverDialog);
        }
        
        // 移动经验值标签到弹窗（如果不在弹窗中）
        if (this.expLabel && this.expLabel.node && this.expLabel.node.parent !== this.gameOverDialog) {
            this.expLabel.node.setParent(this.gameOverDialog);
        }
        
        // 移动退出游戏按钮到弹窗（如果不在弹窗中）
        if (this.exitGameButton && this.exitGameButton.node && this.exitGameButton.node.parent !== this.gameOverDialog) {
            this.exitGameButton.node.setParent(this.gameOverDialog);
        }
        
        // 移动重新开始按钮到弹窗（如果不在弹窗中）
        let restartButtonNode = this.gameOverPanel.getChildByName('RestartButton');
        if (!restartButtonNode && this.gameOverDialog) {
            restartButtonNode = this.gameOverDialog.getChildByName('RestartButton');
        }
        if (restartButtonNode && restartButtonNode.parent !== this.gameOverDialog) {
            restartButtonNode.setParent(this.gameOverDialog);
        }
    }
    
    /**
     * 调整游戏结束UI的布局
     * 布局顺序（从上到下）：结果标签 -> 伤害统计图表 -> 「关卡奖励」分界线 -> 经验值标签 -> 退出游戏按钮 -> 重新开始按钮
     */
    private layoutGameOverUI() {
        if (!this.gameOverDialog) {
            return;
        }
        
        // 从弹窗中查找重新开始按钮
        let restartButtonNode = this.gameOverDialog.getChildByName('RestartButton');
        if (!restartButtonNode && this.gameOverPanel) {
            restartButtonNode = this.gameOverPanel.getChildByName('RestartButton');
        }
        if (!restartButtonNode) {
            return;
        }
        
        // 所有元素相对于弹窗中心定位（弹窗中心为0,0）
        const spacing = 20;           // 通用元素间距
        const buttonSpacing = 30;     // 按钮与经验值标签之间的间距
        const statsToExpSpacing = 50; // DPS 面板与经验值区域之间的额外间距，避免重叠
        let currentY = 250;           // 从弹窗中心上方开始（结果标签位置，因为面板高度增加了）
        
        // 结果标签位置（最上方）
        if (this.gameOverLabel && this.gameOverLabel.node) {
            this.gameOverLabel.node.setPosition(0, currentY, 0);
            const labelTransform = this.gameOverLabel.node.getComponent(UITransform);
            const labelHeight = labelTransform ? labelTransform.height : 60;
            currentY = currentY - labelHeight / 2 - spacing;
        }
        
        // 伤害统计图表位置（在结果标签下方）
        const damageStatsNode = this.gameOverDialog.getChildByName('DamageStatsPanel');
        if (damageStatsNode) {
            const statsTransform = damageStatsNode.getComponent(UITransform);
            const statsHeight = statsTransform ? statsTransform.height : 150;
            damageStatsNode.setPosition(0, currentY - statsHeight / 2, 0);
            currentY = currentY - statsHeight - statsToExpSpacing; // DPS 面板整体高度 + 额外间距

            // 在 DPS 排行面板与经验值标签之间添加「关卡奖励」分界线
            let rewardTitleNode = this.gameOverDialog.getChildByName('RewardTitle');
            if (!rewardTitleNode) {
                rewardTitleNode = new Node('RewardTitle');
                rewardTitleNode.setParent(this.gameOverDialog);

                const rewardLabel = rewardTitleNode.addComponent(Label);
                rewardLabel.string = '———— 关卡奖励 ————';
                rewardLabel.fontSize = 24;
                // 使用较为显眼的金色
                rewardLabel.color = new Color(255, 215, 0, 255);
                rewardLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
                rewardLabel.verticalAlign = Label.VerticalAlign.CENTER;

                const rewardTransform = rewardTitleNode.addComponent(UITransform);
                rewardTransform.setContentSize(400, 30);
            } else {
                const rewardLabel = rewardTitleNode.getComponent(Label);
                if (rewardLabel) {
                    rewardLabel.color = new Color(255, 215, 0, 255);
                }
            }

            rewardTitleNode.setPosition(0, currentY, 0);
            // 分界线下方再留出一点空间给经验值文本
            currentY = currentY - 40;
        }
        
        // 经验值标签位置（在伤害统计图表下方）
        if (this.expLabel && this.expLabel.node) {
            this.expLabel.fontSize = 24;
            const expLabelTransform = this.expLabel.node.getComponent(UITransform);
            const expLabelHeight = expLabelTransform ? expLabelTransform.height : 80;
            this.expLabel.node.setPosition(0, currentY - expLabelHeight / 2, 0);
            currentY = currentY - expLabelHeight / 2 - buttonSpacing; // 使用更大的间距
        }
        
        // 退出游戏按钮与重新开始按钮在同一行并排显示（整体稍微下移约 50 像素）
        const restartButtonTransform = restartButtonNode.getComponent(UITransform);
        const restartButtonHeight = restartButtonTransform ? restartButtonTransform.height : 50;

        let exitButtonNode = this.exitGameButton && this.exitGameButton.node ? this.exitGameButton.node : null;
        let exitButtonHeight = 50;
        if (exitButtonNode) {
            const exitButtonTransform = exitButtonNode.getComponent(UITransform);
            if (exitButtonTransform) {
                exitButtonHeight = exitButtonTransform.height;
            }
        }

        const rowHeight = Math.max(restartButtonHeight, exitButtonHeight);
        // 在原基础上整体向下移动 50 像素
        const buttonY = currentY - rowHeight / 2 - 50;

        // 左侧：退出按钮
        if (exitButtonNode) {
            exitButtonNode.setPosition(-80, buttonY, 0);
        }

        // 右侧：重新开始按钮
        restartButtonNode.setPosition(80, buttonY, 0);

        // 更新 currentY（如果后续还要布局其他元素）
        currentY = buttonY - rowHeight / 2 - spacing;
    }
    
    /**
     * 将游戏结束弹窗置于面板最上层
     */
    private setGameOverUIOnTop() {
        if (!this.gameOverDialog) {
            return;
        }
        
        // 如果弹窗的父节点是Canvas，直接设置到Canvas的最上层
        const canvas = find('Canvas');
        if (canvas && this.gameOverDialog.parent === canvas) {
            this.gameOverDialog.setSiblingIndex(canvas.children.length - 1);
            return;
        }
        
        // 否则，设置到gameOverPanel的最上层
        if (!this.gameOverPanel) {
            return;
        }
        
        const children = this.gameOverPanel.children;
        if (children.length === 0) {
            return;
        }
        
        const maxIndex = children.length - 1;
        
        // 将弹窗置于最上层
        this.gameOverDialog.setSiblingIndex(maxIndex);
        
        // 确保弹窗内的元素也正确排序（从下到上）
        const dialogChildren = this.gameOverDialog.children;
        if (dialogChildren.length > 0) {
            const dialogMaxIndex = dialogChildren.length - 1;
            
            // 重新开始按钮（最下方）
            const restartButtonNode = this.gameOverDialog.getChildByName('RestartButton');
            if (restartButtonNode) {
                restartButtonNode.setSiblingIndex(0);
            }
            
            // 退出游戏按钮
            if (this.exitGameButton && this.exitGameButton.node) {
                this.exitGameButton.node.setSiblingIndex(1);
            }
            
            // 经验值标签
            if (this.expLabel && this.expLabel.node) {
                this.expLabel.node.setSiblingIndex(2);
            }
            
            // 结果标签（最上方）
            if (this.gameOverLabel && this.gameOverLabel.node) {
                this.gameOverLabel.node.setSiblingIndex(dialogMaxIndex);
            }
        }
    }
    
    /**
     * 如果expLabel未设置，尝试在gameOverPanel中创建经验值标签
     * @param expGained 本次获得的经验值
     * @param talentPointsGained 本次获得的天赋点
     */
    private createExpLabelIfNeeded(expGained: number = 0, talentPointsGained: number = 0) {
        if (!this.gameOverPanel || this.expLabel) {
            return;
        }
        
        // 查找gameOverLabel作为参考位置
        const gameOverLabelNode = this.gameOverPanel.getChildByName('GameOverLabel');
        if (!gameOverLabelNode) {
            return;
        }
        
        // 创建经验值 / 升级信息标签
        const expLabelNode = new Node('ExpLabel');
        expLabelNode.setParent(this.gameOverPanel);
        
        const label = expLabelNode.addComponent(Label);
        label.string = '';
        label.fontSize = 28; // 调大字体
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.TOP;
        label.lineHeight = 32; // 相应调整行高
        
        const transform = expLabelNode.addComponent(UITransform);
        transform.setContentSize(400, 80); // 增加高度以容纳多行文本
        
        // 设置位置在gameOverLabel下方（往上移，保持在重新开始和建造按钮之间）
        const gameOverLabelTransform = gameOverLabelNode.getComponent(UITransform);
        if (gameOverLabelTransform) {
            // 先获取gameOverLabel的位置，如果它已经被调整过，使用调整后的位置
            let gameOverLabelPos = gameOverLabelNode.position;
            // 如果gameOverLabel在默认位置（接近0），则使用调整后的位置
            if (Math.abs(gameOverLabelPos.y) < 10) {
                gameOverLabelPos = new Vec3(gameOverLabelPos.x, 80, gameOverLabelPos.z);
            }
            expLabelNode.setPosition(gameOverLabelPos.x, gameOverLabelPos.y - 60, 0);
        } else {
            expLabelNode.setPosition(0, 20, 0); // 往上移到Y=20位置
        }
        
        this.expLabel = label;
    }

    cleanupAllUnitsForEndGame() {
        const scene = director.getScene();
        if (!scene) return;

        // 清理所有敌人（直接销毁）
        const enemiesNode = find('Canvas/Enemies');
        if (enemiesNode) {
            const enemies = enemiesNode.children.slice(); // 复制数组
            for (const enemy of enemies) {
                if (enemy && enemy.isValid) {
                    // 直接销毁，不播放死亡动画
                    enemy.destroy();
                }
            }
        }

        // 停止所有防御塔移动
        const towersNode = find('Canvas/Towers');
        if (towersNode) {
            const towers = towersNode.children; // 不需要复制数组，因为不销毁
            for (const tower of towers) {
                if (tower && tower.isValid) {
                    const towerScript = tower.getComponent('Arrower') as any;
                    if (towerScript && towerScript.stopMoving) {
                        towerScript.stopMoving();
                        // 也要停止攻击动画和逻辑
                        if (towerScript.currentTarget) {
                            towerScript.currentTarget = null!;
                        }
                    }
                }
            }
        }
    }

    /**
     * 清理所有单位（用于重置游戏）
     */
    cleanupAllUnitsForReset() {
        const scene = director.getScene();
        if (!scene) return;

        // 清理所有敌人
        const enemiesNode = find('Canvas/Enemies');
        if (enemiesNode) {
            const enemies = enemiesNode.children.slice();
            for (const enemy of enemies) {
                if (enemy && enemy.isValid) {
                    enemy.destroy();
                }
            }
        }

        // 清理所有我方单位
        // 注意：Priests和Towers共用Canvas/Towers容器
        const unitContainers = [
            'Canvas/Towers',  // 包含Towers和Priests
            'Canvas/Hunters',
            'Canvas/Swordsmen'
        ];

        for (const containerPath of unitContainers) {
            const containerNode = find(containerPath);
            if (containerNode) {
                const units = containerNode.children.slice();
                for (const unit of units) {
                    if (unit && unit.isValid) {
                        const roleScript = unit.getComponent('Role') as any;
                        if (roleScript && roleScript.destroyRole) {
                            roleScript.destroyRole();
                        } else {
                            unit.destroy();
                        }
                    }
                }
            }
        }

        // 清理所有建筑物（包括石墙、哨塔以及其他建筑容器）
        const buildingContainers = [
            'Canvas/WarAncientTrees',
            'Canvas/HunterHalls',
            'Canvas/SwordsmanHalls',
            'Canvas/Churches',
            'Canvas/StoneWalls',
            'Canvas/WatchTowers',
            'Canvas/IceTowers',
            'Canvas/ThunderTowers'
        ];

        for (const containerPath of buildingContainers) {
            const containerNode = find(containerPath);
            if (containerNode) {
                const buildings = containerNode.children.slice();
                for (const building of buildings) {
                    if (building && building.isValid) {
                        const buildScript = building.getComponent('Build') as any;
                        if (buildScript && buildScript.destroyBuild) {
                            buildScript.destroyBuild();
                        } else {
                            building.destroy();
                        }
                    }
                }
            }
        }
    }

    getGameState(): GameState {
        return this.gameState;
    }
    
    /**
     * 暂停游戏
     */
    pauseGame() {
        // 设置游戏状态为暂停
        this.gameState = GameState.Paused;
        
        // 保存当前时间缩放值
        this.originalTimeScale = director.getScheduler().getTimeScale();
        
        // 暂停游戏时间
        director.getScheduler().setTimeScale(0);
        
    }
    
    /**
     * 继续游戏
     */
    resumeGame() {
        // 设置游戏状态为继续
        this.gameState = GameState.Playing;
        
        // 恢复游戏时间
        director.getScheduler().setTimeScale(this.originalTimeScale);
        
        
        // 通知所有单位游戏已恢复，确保动画能够正确播放
        this.notifyGameResumed();
    }
    
    /**
     * 开始游戏（对外入口）：先确保加载分包目录 prefabs_sub 下的所有预制体，再执行真正的开始逻辑
     */
    startGame() {
        console.log('startGame' + this.gameState.toString());

        // 如果分包还未加载，先加载分包和其中的所有预制体，然后再继续开始游戏逻辑
        if (!this.prefabsSubLoaded) {
            if (this.isLoadingPrefabsSub) {
                // 已经在加载中，避免重复触发
                return;
            }

            this.isLoadingPrefabsSub = true;
            console.info('[GameManager] 开始加载分包 prefabs_sub');

            assetManager.loadBundle('prefabs_sub', (err, bundle) => {
                if (err) {
                    console.error('[GameManager] 加载分包 prefabs_sub 失败:', err);
                    this.isLoadingPrefabsSub = false;
                    return;
                }

                if (!bundle) {
                    console.error('[GameManager] 分包 prefabs_sub 加载结果为空');
                    this.isLoadingPrefabsSub = false;
                    return;
                }

                // 直接按名字加载分包中的几个建筑预制体（石墙、冰塔、雷塔、哨塔）
                console.info('[GameManager] 开始从分包 prefabs_sub 加载建筑预制体 StoneWall / IceTower / ThunderTower / WatchTower');

                const loadPrefab = (name: string, onLoaded: (prefab: Prefab | null) => void) => {
                    bundle.load(name, Prefab, (err2, prefab) => {
                        if (err2 || !prefab) {
                            console.error('[GameManager] 从分包 prefabs_sub 加载预制体失败:', name, err2);
                            onLoaded(null);
                        } else {
                            console.info('[GameManager] 从分包 prefabs_sub 成功加载预制体:', name);
                            onLoaded(prefab as Prefab);
                        }
                    });
                };

                // 顺序加载四个预制体，全部尝试完后再注入 TowerBuilder
                loadPrefab('StoneWall', (stoneWallPrefab) => {
                    loadPrefab('IceTower', (iceTowerPrefab) => {
                        loadPrefab('ThunderTower', (thunderTowerPrefab) => {
                            loadPrefab('WatchTower', (watchTowerPrefab) => {
                                try {
                                    const towerBuilder = this.findComponentInScene('TowerBuilder') as any;
                                    if (towerBuilder) {
                                        if (stoneWallPrefab && typeof towerBuilder.setStoneWallPrefab === 'function') {
                                            console.info('[GameManager] 将分包中的 StoneWall 预制体注入 TowerBuilder');
                                            towerBuilder.setStoneWallPrefab(stoneWallPrefab);
                                        }
                                        if (iceTowerPrefab && typeof towerBuilder.setIceTowerPrefab === 'function') {
                                            console.info('[GameManager] 将分包中的 IceTower 预制体注入 TowerBuilder');
                                            towerBuilder.setIceTowerPrefab(iceTowerPrefab);
                                        }
                                        if (thunderTowerPrefab && typeof towerBuilder.setThunderTowerPrefab === 'function') {
                                            console.info('[GameManager] 将分包中的 ThunderTower 预制体注入 TowerBuilder');
                                            towerBuilder.setThunderTowerPrefab(thunderTowerPrefab);
                                        }
                                        if (watchTowerPrefab && typeof towerBuilder.setWatchTowerPrefab === 'function') {
                                            console.info('[GameManager] 将分包中的 WatchTower 预制体注入 TowerBuilder');
                                            towerBuilder.setWatchTowerPrefab(watchTowerPrefab);
                                        }
                                    } else {
                                        console.warn('[GameManager] TowerBuilder 组件不存在，无法注入分包预制体');
                                    }
                                } catch (e) {
                                    console.error('[GameManager] 注入分包建筑预制体到 TowerBuilder 时出错:', e);
                                }

                                this.prefabsSubLoaded = true;
                                this.isLoadingPrefabsSub = false;

                                // 分包加载完毕后，再次调用开始逻辑（这次会直接走内部实现）
                                this._startGameInternal();
                            });
                        });
                    });
                });
            });

            return;
        }

        // 分包已加载，直接执行内部开始逻辑
        this._startGameInternal();
    }

    /**
     * 真正的开始游戏逻辑（在分包加载完成后调用）
     */
    private _startGameInternal() {
        // 启动伤害统计
        const damageStats = DamageStatistics.getInstance();
        damageStats.startRecording();
        // 确保时间缩放正常（防止退出时暂停导致的问题）
        const currentTimeScale = director.getScheduler().getTimeScale();
        if (currentTimeScale === 0) {
            director.getScheduler().setTimeScale(1);
            this.originalTimeScale = 1;
        }
        
        if (this.gameState === GameState.Paused) {
            // 如果游戏已暂停，恢复游戏
            this.resumeGame();
        } else if (this.gameState === GameState.Ready) {
            // 如果游戏准备就绪，开始游戏
            this.gameState = GameState.Playing;
            
            // 显示所有游戏元素
            this.showGameElements();

            // 开局在石墙网格顶行生成初始石墙
            // 注意：这里传入的是组件名 'TowerBuilder'，而不是节点路径
            const towerBuilder = this.findComponentInScene('TowerBuilder') as any;
            if (towerBuilder && towerBuilder.spawnInitialStoneWalls) {
                // 0 帧延迟，等于等待一帧，确保网格面板初始化完成
                this.scheduleOnce(() => {
                    towerBuilder.spawnInitialStoneWalls(14);
                    // 生成初始哨塔（在石墙网格中随机生成3个）
                    // 延迟执行，确保所有组件的start方法都已执行完毕，避免影响其他组件的初始化
                    if (towerBuilder.spawnInitialWatchTowers) {
                        console.info('[GameManager] 开始生成初始哨塔');
                        this.scheduleOnce(() => {
                            towerBuilder.spawnInitialWatchTowers(3);
                        }, 0.1); // 延迟0.1秒，确保所有组件初始化完成
                    } else {
                        console.info('[GameManager] TowerBuilder没有spawnInitialWatchTowers方法');
                    }
                }, 0);
            }
        } else if (this.gameState !== GameState.Playing) {
            // 如果游戏已结束，重新开始游戏
            this.restartGame();
        }
    }
    
    /**
     * 通知所有单位游戏已恢复
     */
    notifyGameResumed() {
        const scene = director.getScene();
        if (!scene) return;
        
        // 递归查找所有单位节点
        const findAllUnits = (node: Node) => {
            // 检查当前节点是否是可移动单位
            const hunterScript = node.getComponent('Hunter') as any;
            const arrowerScript = node.getComponent('Arrower') as any;
            
            // 恢复移动动画
            if (hunterScript) {
                // 无论当前状态如何，都重新检查移动状态并恢复动画
                this.scheduleOnce(() => {
                    if (hunterScript.node && hunterScript.node.isValid) {
                        // 检查是否有手动移动目标
                        if (hunterScript.manualMoveTarget) {
                            // 有手动移动目标，确保isMoving为true并重新启动移动动画
                            hunterScript.isMoving = true;
                            if (hunterScript.playMoveAnimation) {
                                hunterScript.playMoveAnimation();
                            }
                        } 
                        // 检查是否有自动寻敌目标
                        else if (hunterScript.currentTarget && hunterScript.currentTarget.isValid) {
                            try {
                                // 有自动寻敌目标，直接设置isMoving为true并启动移动动画
                                // 简化逻辑，避免类型检查报错
                                hunterScript.isMoving = true;
                                if (hunterScript.playMoveAnimation) {
                                    hunterScript.playMoveAnimation();
                                }
                            } catch (error) {
                            }
                        }
                    }
                }, 0.1);
            } else if (arrowerScript) {
                // 恢复弓箭手的移动动画
                if (arrowerScript.isMoving && arrowerScript.playMoveAnimation) {
                    arrowerScript.playMoveAnimation();
                }
            }
            
            // 递归检查子节点
            for (const child of node.children) {
                findAllUnits(child);
            }
        };
        
        findAllUnits(scene);
    }

    /**
     * 从场景递归查找指定组件（按组件名字符串）
     */
    private findComponentInScene(componentName: string): Component | null {
        const scene = director.getScene();
        if (!scene) return null;

        const dfs = (node: Node): Component | null => {
            const comp = node.getComponent(componentName);
            if (comp) {
                return comp;
            }
            for (const child of node.children) {
                const found = dfs(child);
                if (found) return found;
            }
            return null;
        };

        return dfs(scene);
    }
    
    /**
     * 检查单位是否首次出现
     * @param unitType 单位类型
     * @param unitScript 单位脚本
     * @returns 是否首次出现
     */
    checkUnitFirstAppearance(unitType: string, unitScript: any): boolean {
        // 使用单位名称作为唯一标识，确保每种单位只显示一次介绍框
        // 优先使用unitScript.unitName，否则使用unitType
        const uniqueUnitType = unitScript.unitName || unitType;
        
        
        if (!this.appearedUnitTypes.has(uniqueUnitType)) {
            this.appearedUnitTypes.add(uniqueUnitType);
            
            // 更新调试数组
            this.debugUnitTypes = Array.from(this.appearedUnitTypes);
            
            this.showUnitIntro(unitScript);
            return true;
        }
        return false;
    }
    
    /**
     * 显示单位介绍
     * @param unitScript 单位脚本
     */
    showUnitIntro(unitScript: any) {
        
        // 自动创建单位介绍弹窗
        this.autoCreateUnitIntroPopup();
        
        // 获取单位图片，优先使用cardIcon，其次使用spriteFrame
        let unitIcon = null;
        if (unitScript.cardIcon) {
            unitIcon = unitScript.cardIcon;
        } else if (unitScript.defaultSpriteFrame) {
            unitIcon = unitScript.defaultSpriteFrame;
        } else if (unitScript.node) {
            // 尝试获取单位的Sprite组件的spriteFrame
            const spriteComponent = unitScript.node.getComponent(Sprite);
            if (spriteComponent && spriteComponent.spriteFrame) {
                unitIcon = spriteComponent.spriteFrame;
            }
        }
        
        if (this.unitIntroPopup) {
            // 从 unitConfig.json 获取单位信息
            const configManager = UnitConfigManager.getInstance();
            // 获取单位ID（优先使用 prefabName，其次使用 unitType）
            const unitId = unitScript.prefabName || unitScript.unitType || '';
            const displayInfo = configManager.getUnitDisplayInfo(unitId);
            
            // 使用配置文件中的信息
            const unitName = displayInfo ? displayInfo.name : (unitScript.unitName || '未知单位');
            const unitDescription = displayInfo ? displayInfo.description : '暂无描述';
            
            this.unitIntroPopup.show({
                unitName: unitName,
                unitDescription: unitDescription,
                unitIcon: unitIcon,
                unitType: unitScript.unitType || 'unknown'
            });
        } else {
        }
    }

    // 金币相关方法
    getGold(): number {
        return this.gold;
    }

    addGold(amount: number) {
        this.gold += amount;
        this.updateUI();
    }

    // 经验值相关方法
    addExperience(amount: number) {
        if (amount > 0) {
            this.currentGameExp += amount;
        }
    }

    spendGold(amount: number): boolean {
        if (this.gold >= amount) {
            this.gold -= amount;
            this.updateUI();
            return true;
        }
        return false;
    }

    canAfford(amount: number): boolean {
        return this.gold >= amount;
    }

    // 人口相关方法
    getPopulation(): number {
        return this.population;
    }

    getMaxPopulation(): number {
        return this.maxPopulation;
    }

    addPopulation(amount: number = 1): boolean {
        if (this.population + amount <= this.maxPopulation) {
            this.population += amount;
            this.updateUI();
            
            // 检测首次达到人口上限时显示提示框
            if (this.population >= this.maxPopulation && !this.hasShownPopulationLimitWarning) {
                this.hasShownPopulationLimitWarning = true;
                GamePopup.showMessage('已达到人口上限，请升级生命之树');
            }
            
            return true;
        }
        return false;
    }

    removePopulation(amount: number = 1) {
        this.population = Math.max(0, this.population - amount);
        this.updateUI();
    }

    canAddPopulation(amount: number = 1): boolean {
        return this.population + amount <= this.maxPopulation;
    }

    setMaxPopulation(max: number) {
        this.maxPopulation = max;
        this.updateUI();
    }

    restartGame() {
        // 恢复时间缩放（确保游戏时间正常，避免退出时暂停导致的问题）
        director.getScheduler().setTimeScale(1);
        this.originalTimeScale = 1;
        
        // 停止伤害统计
        const damageStats = DamageStatistics.getInstance();
        damageStats.stopRecording();
        damageStats.reset();
        
        // 在重新开始游戏前，结算当前游戏的经验值
        this.settleGameExperience();

        // 更新左上角等级HUD显示状态（会根据gameMainPanel的显示状态自动控制）
        this.updateLevelHud();
        
        // 清理所有敌人和防御塔
        this.cleanupAllUnits();
        
        const scene = director.getScene();
        let sceneName = scene?.name;
        
        
        // 如果场景名称为空，尝试使用默认名称
        if (!sceneName || sceneName === '') {
            sceneName = 'scene';
        }
        
        if (sceneName) {
            
            // 使用更可靠的方式重新加载场景
            director.loadScene(sceneName, (error: Error | null) => {
                if (error) {
                    
                    // 场景加载失败时，手动重置游戏状态
                    this.manualResetGame();
                } else {
                }
            });
        } else {
            
            // 无法获取场景名称时，手动重置游戏状态
            this.manualResetGame();
        }
    }
    
    /**
     * 结算游戏经验值（在游戏结束或主动退出时调用）
     * 公共方法，供外部调用
     */
    public settleGameExperience() {
        if (this.playerDataManager && this.currentGameExp > 0) {
            this.playerDataManager.addExperience(this.currentGameExp);
            // 重置本局经验值
            this.currentGameExp = 0;
        } else if (this.playerDataManager) {
            // 即使没有获得经验值，也要保存数据（可能使用了天赋点）
            this.playerDataManager.saveData();
        }
    }
    
    /**
     * 手动重置游戏状态（当场景重载失败时使用）
     */
    manualResetGame() {
        
        // 恢复时间缩放（确保游戏时间正常）
        director.getScheduler().setTimeScale(1);
        this.originalTimeScale = 1;
        
        // 重置游戏状态
        this.gameState = GameState.Ready;
        this.gameTime = 0;
        this.gold = 10;
        this.population = 0;
        this.maxPopulation = 10;
        this.hasShownPopulationLimitWarning = false; // 重置人口上限提示标志
        
        // 重置水晶状态
        if (this.crystalScript) {
            const crystal = this.crystalScript as any;
            if (crystal.currentHealth !== undefined && crystal.maxHealth !== undefined) {
                crystal.currentHealth = crystal.maxHealth;
            }
            // 重置水晶的isDestroyed状态
            if (crystal.isDestroyed !== undefined) {
                crystal.isDestroyed = false;
            }
            // 确保水晶节点是激活的
            if (crystal.node && crystal.node.isValid) {
                crystal.node.active = true;
            }
        }
        
        // 隐藏所有游戏元素
        this.hideGameElements();
        
        // 确保游戏结束面板隐藏
        if (this.gameOverPanel) {
            this.gameOverPanel.active = false;
            
            // 隐藏退出游戏按钮
            if (this.exitGameButton && this.exitGameButton.node) {
                this.exitGameButton.node.active = false;
            }
            
            // 隐藏弹窗
            if (this.gameOverDialog) {
                this.gameOverDialog.active = false;
            }
        }
        
        // 更新UI
        this.updateUI();
        
    }

    cleanupAllUnits() {
        const scene = director.getScene();
        if (!scene) return;

        // 清理所有敌人
        const enemiesNode = find('Canvas/Enemies');
        if (enemiesNode) {
            const enemies = enemiesNode.children.slice(); // 复制数组，避免在遍历时修改
            for (const enemy of enemies) {
                if (enemy && enemy.isValid) {
                    const enemyScript = enemy.getComponent('Enemy') as any;
                    if (enemyScript && enemyScript.die) {
                        enemyScript.die();
                    } else {
                        enemy.destroy();
                    }
                }
            }
        }

        // 清理所有防御塔
        const towersNode = find('Canvas/Towers');
        if (towersNode) {
            const towers = towersNode.children.slice(); // 复制数组
            for (const tower of towers) {
                if (tower && tower.isValid) {
                    const towerScript = tower.getComponent('Arrower') as any;
                    if (towerScript) {
                        // 如果游戏结束，停止所有塔的移动
                        if (towerScript.stopMoving) {
                            towerScript.stopMoving();
                        }
                        // 只有在非游戏结束时的清理才销毁塔（例如重启游戏时）
                        // 但这里的cleanupAllUnits目前主要用于重启游戏
                        // 我们需要区分是"游戏结束清理"还是"重启清理"
                        // 为了简单起见，这里保持原来的销毁逻辑用于重启
                        // 但我们需要一个新的方法来处理游戏结束时的状态冻结
                        if (towerScript.destroyArrower) {
                            towerScript.destroyArrower();
                        } else {
                            tower.destroy();
                        }
                    }
                }
            }
        }

    }
}

