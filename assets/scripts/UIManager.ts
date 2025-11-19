import { _decorator, Component, Node, Button, Label, find, director } from 'cc';
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
        this.findGameManager();

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

    findGameManager() {
        // 方法1: 通过节点名称查找
        let gmNode = find('GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager);
            if (this.gameManager) {
                console.log('UIManager: Found GameManager by name');
                return;
            }
        }
        
        // 方法2: 从场景根节点递归查找
        const scene = director.getScene();
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
            this.gameManager = findInScene(scene, GameManager);
            if (this.gameManager) {
                console.log('UIManager: Found GameManager by recursive search');
                return;
            }
        }
        
        console.warn('UIManager: GameManager not found!');
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
        
        // 重新查找GameManager
        this.findGameManager();
        
        if (this.gameManager) {
            console.log('UIManager: Calling GameManager.restartGame');
            this.gameManager.restartGame();
        } else {
            console.warn('UIManager: GameManager is null! Trying to reload scene directly.');
            // 如果还是找不到，尝试直接重新加载场景
            const scene = director.getScene();
            if (scene && scene.name) {
                console.log('UIManager: Reloading scene:', scene.name);
                director.loadScene(scene.name);
            } else {
                // 如果场景名称为空，尝试使用默认场景名称
                console.log('UIManager: Scene name is empty, trying default name "scene"');
                director.loadScene('scene');
            }
        }
    }
}

