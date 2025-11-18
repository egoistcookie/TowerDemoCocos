import { _decorator, Component, Node, Label, director } from 'cc';
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

    private gameState: GameState = GameState.Playing;
    private gameTime: number = 180; // 3分钟 = 180秒
    private crystalScript: Crystal = null!;

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
            this.timerLabel.string = `时间: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    onCrystalDestroyed() {
        if (this.gameState === GameState.Playing) {
            this.endGame(GameState.Defeat);
        }
    }

    endGame(state: GameState) {
        this.gameState = state;
        
        if (this.gameOverPanel) {
            this.gameOverPanel.active = true;
        }

        if (this.gameOverLabel) {
            if (state === GameState.Victory) {
                this.gameOverLabel.string = '胜利！';
            } else {
                this.gameOverLabel.string = '失败！';
            }
        }
    }

    getGameState(): GameState {
        return this.gameState;
    }

    restartGame() {
        console.log('GameManager: restartGame called');
        const sceneName = director.getScene()?.name;
        if (sceneName) {
            console.log('GameManager: Reloading scene:', sceneName);
            director.loadScene(sceneName);
        } else {
            console.error('GameManager: Cannot get current scene name!');
        }
    }
}

