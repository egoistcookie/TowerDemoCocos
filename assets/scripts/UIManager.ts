import { _decorator, Component, Node, Button, Label, find } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('UIManager')
export class UIManager extends Component {
    @property(Button)
    buildButton: Button = null!;

    @property(Button)
    restartButton: Button = null!;

    @property(Node)
    towerBuilder: Node = null!;

    private gameManager: GameManager = null!;

    start() {
        // 查找游戏管理器
        const gmNode = find('GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager);
            console.log('UIManager: Found GameManager');
        } else {
            console.warn('UIManager: GameManager not found!');
        }

        // 绑定按钮事件
        if (this.buildButton) {
            this.buildButton.node.on(Button.EventType.CLICK, this.onBuildButtonClick, this);
            console.log('UIManager: BuildButton event bound');
        } else {
            console.error('UIManager: BuildButton is null!');
        }

        if (this.restartButton) {
            this.restartButton.node.on(Button.EventType.CLICK, this.onRestartButtonClick, this);
            console.log('UIManager: RestartButton event bound');
        } else {
            console.error('UIManager: RestartButton is null!');
        }

        // 检查TowerBuilder
        if (this.towerBuilder) {
            console.log('UIManager: TowerBuilder node set:', this.towerBuilder.name);
        } else {
            console.warn('UIManager: TowerBuilder node not set!');
        }
    }

    onBuildButtonClick() {
        console.log('UIManager: BuildButton clicked!');
        if (this.towerBuilder) {
            const builderScript = this.towerBuilder.getComponent('TowerBuilder') as any;
            if (builderScript) {
                if (builderScript.onBuildButtonClick) {
                    console.log('UIManager: Calling TowerBuilder.onBuildButtonClick');
                    builderScript.onBuildButtonClick();
                } else {
                    console.error('UIManager: TowerBuilder script has no onBuildButtonClick method!');
                }
            } else {
                console.error('UIManager: TowerBuilder script not found on node!');
            }
        } else {
            console.error('UIManager: TowerBuilder node is null!');
        }
    }

    onRestartButtonClick() {
        console.log('UIManager: RestartButton clicked!');
        if (this.gameManager) {
            console.log('UIManager: Calling GameManager.restartGame');
            this.gameManager.restartGame();
        } else {
            console.error('UIManager: GameManager is null!');
        }
    }
}

