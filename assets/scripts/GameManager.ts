import { _decorator, Component, Node, Label, director, find } from 'cc';
import { Crystal } from './Crystal';
const { ccclass, property } = _decorator;

export enum GameState {
    Playing,
    Victory,
    Defeat
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

    private gameState: GameState = GameState.Playing;
    private gameTime: number = 600; // 10分钟 = 600秒
    private crystalScript: Crystal = null!;
    private gold: number = 10; // 初始金币
    private population: number = 0; // 当前人口
    private maxPopulation: number = 10; // 人口上限

    start() {
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

