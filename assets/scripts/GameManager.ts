import { _decorator, Component, Node, Label, director, find, Graphics, Color, UITransform, view, Sprite, Button } from 'cc';
import { Crystal } from './Crystal';
import { UnitIntroPopup } from './UnitIntroPopup';
const { ccclass, property } = _decorator;

export enum GameState {
    Playing,
    Victory,
    Defeat,
    Paused
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

    @property(UnitIntroPopup)
    unitIntroPopup: UnitIntroPopup = null!;

    private gameState: GameState = GameState.Playing;
    private gameTime: number = 600; // 10分钟 = 600秒
    private crystalScript: Crystal = null!;
    private gold: number = 10; // 初始金币
    private population: number = 0; // 当前人口
    private maxPopulation: number = 10; // 人口上限
    
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
        
        console.debug('GameManager: Auto-creating UnitIntroPopup');
        
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
        
        console.debug('GameManager: UnitIntroPopup created with full UI structure');
    }

    start() {
        // 每次游戏开始时清空已出现单位类型集合
        this.appearedUnitTypes.clear();
        this.debugUnitTypes = [];
        console.debug(`GameManager: Cleared appearedUnitTypes collection on game start`);
        
        if (this.crystal) {
            this.crystalScript = this.crystal.getComponent(Crystal);
            // 监听水晶销毁事件
            if (this.crystalScript) {
                Crystal.getEventTarget().on('crystal-destroyed', this.onCrystalDestroyed, this);
            }
        }
        if (this.gameOverPanel) {
            this.gameOverPanel.active = false;
        }
        
        // 自动创建单位介绍弹窗
        this.autoCreateUnitIntroPopup();
        
        this.updateUI();
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
        console.debug(`GameManager: endGame called with state: ${state} (${state === GameState.Victory ? 'Victory' : state === GameState.Defeat ? 'Defeat' : 'Unknown'})`);
        this.gameState = state;
        
        // 游戏结束时，清理所有单位（敌人直接消失，塔停止移动）
        this.cleanupAllUnitsForEndGame();
        
        if (this.gameOverPanel) {
            this.gameOverPanel.active = true;
            console.debug('GameManager: GameOverPanel activated');
        }

        if (this.gameOverLabel) {
            if (state === GameState.Victory) {
                this.gameOverLabel.string = '胜利！';
            } else {
                this.gameOverLabel.string = '失败！';
            }
            console.debug(`GameManager: GameOverLabel set to: ${this.gameOverLabel.string}`);
        }
        
        // 确保游戏状态已更新
        console.debug(`GameManager: Current game state: ${this.gameState}`);
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
        
        console.debug('GameManager: Game paused');
    }
    
    /**
     * 继续游戏
     */
    resumeGame() {
        // 设置游戏状态为继续
        this.gameState = GameState.Playing;
        
        // 恢复游戏时间
        director.getScheduler().setTimeScale(this.originalTimeScale);
        
        console.debug('GameManager: Game resumed');
        
        // 通知所有单位游戏已恢复，确保动画能够正确播放
        this.notifyGameResumed();
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
                                console.warn('GameManager: Error resuming hunter movement:', error);
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
     * 检查单位是否首次出现
     * @param unitType 单位类型
     * @param unitScript 单位脚本
     * @returns 是否首次出现
     */
    checkUnitFirstAppearance(unitType: string, unitScript: any): boolean {
        // 使用单位名称作为唯一标识，确保每种单位只显示一次介绍框
        // 优先使用unitScript.unitName，否则使用unitType
        const uniqueUnitType = unitScript.unitName || unitType;
        
        console.debug(`GameManager: Checking unit first appearance for type: ${uniqueUnitType}`);
        console.debug(`GameManager: Appeared unit types: ${Array.from(this.appearedUnitTypes)}`);
        
        if (!this.appearedUnitTypes.has(uniqueUnitType)) {
            console.debug(`GameManager: First appearance of unit type: ${uniqueUnitType}, showing intro`);
            this.appearedUnitTypes.add(uniqueUnitType);
            
            // 更新调试数组
            this.debugUnitTypes = Array.from(this.appearedUnitTypes);
            
            this.showUnitIntro(unitScript);
            return true;
        }
        console.debug(`GameManager: Unit type ${uniqueUnitType} has already appeared`);
        return false;
    }
    
    /**
     * 显示单位介绍
     * @param unitScript 单位脚本
     */
    showUnitIntro(unitScript: any) {
        console.debug(`GameManager: Showing unit intro for unitScript with unitName: ${unitScript.unitName}`);
        
        // 自动创建单位介绍弹窗
        this.autoCreateUnitIntroPopup();
        
        // 获取单位图片，优先使用cardIcon，其次使用spriteFrame
        let unitIcon = null;
        if (unitScript.cardIcon) {
            unitIcon = unitScript.cardIcon;
            console.debug(`GameManager: Using cardIcon for unit intro`);
        } else if (unitScript.defaultSpriteFrame) {
            unitIcon = unitScript.defaultSpriteFrame;
            console.debug(`GameManager: Using defaultSpriteFrame for unit intro`);
        } else if (unitScript.node) {
            // 尝试获取单位的Sprite组件的spriteFrame
            const spriteComponent = unitScript.node.getComponent(Sprite);
            if (spriteComponent && spriteComponent.spriteFrame) {
                unitIcon = spriteComponent.spriteFrame;
                console.debug(`GameManager: Using spriteComponent.spriteFrame for unit intro`);
            }
        }
        
        if (this.unitIntroPopup) {
            console.debug(`GameManager: Calling unitIntroPopup.show with unitName: ${unitScript.unitName}, unitDescription: ${unitScript.unitDescription}, unitIcon: ${unitIcon ? 'available' : 'null'}, unitType: ${unitScript.unitType}`);
            this.unitIntroPopup.show({
                unitName: unitScript.unitName || '未知单位',
                unitDescription: unitScript.unitDescription || '暂无描述',
                unitIcon: unitIcon,
                unitType: unitScript.unitType || 'unknown'
            });
        } else {
            console.error(`GameManager: unitIntroPopup is null, cannot show unit intro`);
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
        console.debug('GameManager: restartGame called');
        
        // 清理所有敌人和防御塔（如果场景重载失败时的备用方案）
        this.cleanupAllUnits();
        
        const scene = director.getScene();
        let sceneName = scene?.name;
        
        // 如果场景名称为空，尝试使用默认名称
        if (!sceneName || sceneName === '') {
            sceneName = 'scene';
            console.debug('GameManager: Scene name is empty, using default name "scene"');
        }
        
        if (sceneName) {
            console.debug('GameManager: Reloading scene:', sceneName);
            director.loadScene(sceneName, (error: Error | null) => {
                if (error) {
                    console.error('GameManager: Failed to reload scene:', error);
                } else {
                    console.debug('GameManager: Scene reloaded successfully');
                }
            });
        } else {
            console.error('GameManager: Cannot get current scene name!');
        }
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

        console.debug('GameManager: Cleaned up all enemies and arrowers');
    }
}

