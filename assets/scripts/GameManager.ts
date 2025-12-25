import { _decorator, Component, Node, Label, director, find, Graphics, Color, UITransform, view, Sprite, Button, Vec3 } from 'cc';
import { Crystal } from './Crystal';
import { UnitIntroPopup } from './UnitIntroPopup';
import { UnitConfigManager } from './UnitConfigManager';
import { PlayerDataManager } from './PlayerDataManager';
const { ccclass, property } = _decorator;

export enum GameState {
    Ready,       // 准备就绪
    Playing,     // 游戏进行中
    Victory,     // 胜利
    Defeat,      // 失败
    Paused       // 暂停
}

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

    @property(UnitIntroPopup)
    unitIntroPopup: UnitIntroPopup = null!;

    private gameState: GameState = GameState.Ready;
    private gameTime: number = 600; // 10分钟 = 600秒
    private crystalScript: Crystal = null!;
    private gold: number = 10; // 初始金币
    private population: number = 0; // 当前人口
    private maxPopulation: number = 10; // 人口上限
    private currentGameExp: number = 0; // 本局游戏获得的经验值
    private playerDataManager: PlayerDataManager = null!;
    
    // 单位首次出现相关
    private appearedUnitTypes: Set<string> = new Set();
    private originalTimeScale: number = 1; // 保存原始时间缩放值
    
    // 单位信息属性，用于调试
    @property
    public debugUnitTypes: string[] = [];
    
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
        
        // 添加UITransform组件以设置尺寸
        const uiTransform = containerNode.addComponent(UITransform);
        uiTransform.setContentSize(screenWidth, popupHeight);
        
        // 设置容器的锚点为底部中心
        uiTransform.setAnchorPoint(0.5, 0);
        
        // 设置容器位置，使其底部与屏幕底部对齐
        containerNode.setPosition(0, 0, 0);
        
        // 设置容器颜色和透明度
        const containerGraphics = containerNode.addComponent(Graphics);
        containerGraphics.fillColor = new Color(0, 0, 0, 200);
        containerGraphics.rect(-screenWidth / 2, -popupHeight / 2, screenWidth, popupHeight);
        containerGraphics.fill();
        
        // 添加边框
        containerGraphics.strokeColor = new Color(255, 255, 255, 255);
        containerGraphics.lineWidth = 2;
        containerGraphics.rect(-screenWidth / 2, -popupHeight / 2, screenWidth, popupHeight);
        containerGraphics.stroke();
        
        // 计算左右区域的宽度和位置
        const halfWidth = screenWidth / 2;
        
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
        // 右上角位置：相对于容器中心，向右偏移screenWidth/2 - 30，向上偏移popupHeight/2 - 30
        closeNode.setPosition(screenWidth / 2 - 30, popupHeight / 2 - 30, 0);
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
        }
        
        // 自动创建单位介绍弹窗
        this.autoCreateUnitIntroPopup();
        
        this.updateUI();
        
        // 在游戏开始前隐藏所有游戏主体相关内容
        this.hideGameElements();
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

    update(deltaTime: number) {
        if (this.gameState !== GameState.Playing) {
            return;
        }

        // 更新倒计时
        this.gameTime -= deltaTime;
        if (this.gameTime <= 0) {
            this.gameTime = 0;
            this.endGame(GameState.Victory);
        }

        this.updateUI();
    }

    updateUI() {
        // 更新血量显示
        if (this.healthLabel && this.crystalScript) {
            this.healthLabel.string = `水晶血量: ${Math.max(0, Math.floor(this.crystalScript.getHealth()))}`;
        }

        // 更新倒计时显示
        if (this.timerLabel) {
            const minutes = Math.floor(this.gameTime / 60);
            const seconds = Math.floor(this.gameTime % 60);
            const secondsStr = seconds < 10 ? `0${seconds}` : `${seconds}`;
            this.timerLabel.string = `时间: ${minutes}:${secondsStr}`;
        }

        // 更新金币显示
        if (this.goldLabel) {
            this.goldLabel.string = `金币: ${this.gold}`;
        }

        // 更新人口显示
        if (this.populationLabel) {
            this.populationLabel.string = `人口: ${this.population}/${this.maxPopulation}`;
        }
    }

    onCrystalDestroyed() {
        if (this.gameState === GameState.Playing) {
            this.endGame(GameState.Defeat);
        }
    }

    endGame(state: GameState) {
        this.gameState = state;
        
        // 游戏结束时，清理所有单位（敌人直接消失，塔停止移动）
        this.cleanupAllUnitsForEndGame();
        
        // 结算经验值（即使为0也要保存，确保数据持久化）
        if (this.playerDataManager) {
            if (this.currentGameExp > 0) {
                // 保存本次获得的经验值（用于显示）
                const expGainedThisGame = this.currentGameExp;
                const talentPointsGained = this.playerDataManager.addExperience(this.currentGameExp);
                const currentExp = this.playerDataManager.getExperience();
                const remainingExp = this.playerDataManager.getRemainingExpForNextLevel();
                
                // 在游戏结束面板显示经验值（包含本次获得的经验值）
                if (this.expLabel) {
                    let expText = `本次获得经验值: +${expGainedThisGame}`;
                    if (talentPointsGained > 0) {
                        expText += `\n获得天赋点: +${talentPointsGained}`;
                    }
                    expText += `\n当前经验值: ${currentExp} (下一级还需 ${remainingExp})`;
                    this.expLabel.string = expText;
                } else {
                    // 如果expLabel未设置，尝试在gameOverPanel中创建
                    this.createExpLabelIfNeeded(expGainedThisGame, talentPointsGained);
                }
            } else {
                // 即使没有获得经验值，也要保存数据（可能使用了天赋点）
                this.playerDataManager.saveData();
                // 显示当前经验值
                const currentExp = this.playerDataManager.getExperience();
                const remainingExp = this.playerDataManager.getRemainingExpForNextLevel();
                if (this.expLabel) {
                    this.expLabel.string = `本次获得经验值: +0\n当前经验值: ${currentExp} (下一级还需 ${remainingExp})`;
                } else {
                    this.createExpLabelIfNeeded(0, 0);
                }
            }
        }
        
        if (this.gameOverPanel) {
            this.gameOverPanel.active = true;
        }

        if (this.gameOverLabel) {
            if (state === GameState.Victory) {
                this.gameOverLabel.string = '胜利！';
            } else {
                this.gameOverLabel.string = '失败！';
            }
            // 调整"失败"标签位置，往上移（保持在重新开始和建造按钮之间）
            const gameOverLabelNode = this.gameOverLabel.node;
            if (gameOverLabelNode) {
                const currentPos = gameOverLabelNode.position;
                gameOverLabelNode.setPosition(currentPos.x, 80, currentPos.z); // 往上移到Y=80位置
            }
        }
        
        // 调整经验值标签位置，保持在失败标签下方
        if (this.expLabel) {
            const expLabelNode = this.expLabel.node;
            if (expLabelNode) {
                // 如果gameOverLabel存在，放在其下方；否则使用固定位置
                if (this.gameOverLabel && this.gameOverLabel.node) {
                    const gameOverLabelPos = this.gameOverLabel.node.position;
                    expLabelNode.setPosition(gameOverLabelPos.x, gameOverLabelPos.y - 60, 0);
                } else {
                    expLabelNode.setPosition(0, 20, 0); // 往上移到Y=20位置
                }
            }
        }
        
        // 确保游戏状态已更新
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
        
        // 创建经验值标签
        const expLabelNode = new Node('ExpLabel');
        expLabelNode.setParent(this.gameOverPanel);
        
        const label = expLabelNode.addComponent(Label);
        label.string = '';
        label.fontSize = 20;
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.TOP;
        label.lineHeight = 24;
        
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
        
        // 更新经验值显示
        if (this.playerDataManager) {
            const currentExp = this.playerDataManager.getExperience();
            const remainingExp = this.playerDataManager.getRemainingExpForNextLevel();
            let expText = `本次获得经验值: +${expGained}`;
            if (talentPointsGained > 0) {
                expText += `\n获得天赋点: +${talentPointsGained}`;
            }
            expText += `\n当前经验值: ${currentExp} (下一级还需 ${remainingExp})`;
            this.expLabel.string = expText;
        }
    }

    cleanupAllUnitsForEndGame() {
        // 使用递归查找节点
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

        const scene = director.getScene();
        if (!scene) return;

        // 清理所有敌人（直接销毁）
        let enemiesNode = find('Enemies');
        if (!enemiesNode && scene) {
            enemiesNode = findNodeRecursive(scene, 'Enemies');
        }
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
        let towersNode = find('Towers');
        if (!towersNode && scene) {
            towersNode = findNodeRecursive(scene, 'Towers');
        }
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
     * 开始游戏
     */
    startGame() {
        if (this.gameState === GameState.Paused) {
            // 如果游戏已暂停，恢复游戏
            this.resumeGame();
        } else if (this.gameState === GameState.Ready) {
            // 如果游戏准备就绪，开始游戏
            this.gameState = GameState.Playing;
            
            // 显示所有游戏元素
            this.showGameElements();

            // 开局在石墙网格顶行生成初始石墙
            const towerBuilder = this.findComponentInScene('TowerBuilder') as any;
            if (towerBuilder && towerBuilder.spawnInitialStoneWalls) {
                // 等待一帧，确保网格面板初始化完成
                this.scheduleOnce(() => {
                    towerBuilder.spawnInitialStoneWalls(14);
                }, 0);
            } else {
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
            this.unitIntroPopup.show({
                unitName: unitScript.unitName || '未知单位',
                unitDescription: unitScript.unitDescription || '暂无描述',
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
        // 在重新开始游戏前，结算当前游戏的经验值
        this.settleGameExperience();
        
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
        
        // 重置游戏状态
        this.gameState = GameState.Ready;
        this.gameTime = 600;
        this.gold = 10;
        this.population = 0;
        this.maxPopulation = 10;
        
        // 隐藏所有游戏元素
        this.hideGameElements();
        
        // 确保游戏结束面板隐藏
        if (this.gameOverPanel) {
            this.gameOverPanel.active = false;
        }
        
        // 更新UI
        this.updateUI();
        
    }

    cleanupAllUnits() {
        // 使用递归查找节点
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

        const scene = director.getScene();
        if (!scene) return;

        // 清理所有敌人
        let enemiesNode = find('Enemies');
        if (!enemiesNode && scene) {
            enemiesNode = findNodeRecursive(scene, 'Enemies');
        }
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
        let towersNode = find('Towers');
        if (!towersNode && scene) {
            towersNode = findNodeRecursive(scene, 'Towers');
        }
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

