import { _decorator, Component, Node, Button, Label, find, director, UITransform, Color, Graphics, tween, Vec3, UIOpacity, Sprite, SpriteFrame } from 'cc';
import { GameManager } from './GameManager';
import { CountdownPopup } from './CountdownPopup';
const { ccclass, property } = _decorator;

@ccclass('UIManager')
export class UIManager extends Component {
    @property(Button)
    buildButton: Button = null!;

    @property(Button)
    restartButton: Button = null!;

    @property(Node)
    towerBuilder: Node = null!;

    @property(CountdownPopup)
    countdownPopup: CountdownPopup = null!;

    private gameManager: GameManager = null!;
    private warningNode: Node = null!;
    private announcementNode: Node = null!;
    private onCountdownComplete: (() => void) | null = null; // 倒计时完成回调
    private onCountdownManualClose: (() => void) | null = null; // 手动关闭回调

    start() {
        // 查找游戏管理器
        this.findGameManager();

        // 检查并自动创建countdownPopup
        this.autoCreateCountdownPopup();

        // 绑定按钮事件
        if (this.buildButton) {
            this.buildButton.node.on(Button.EventType.CLICK, this.onBuildButtonClick, this);
            console.info('UIManager: BuildButton event bound');
        } else {
            console.error('UIManager: BuildButton is null!');
        }

        if (this.restartButton) {
            this.restartButton.node.on(Button.EventType.CLICK, this.onRestartButtonClick, this);
            console.info('UIManager: RestartButton event bound');
        } else {
            console.error('UIManager: RestartButton is null!');
        }

        // 检查TowerBuilder
        if (this.towerBuilder) {
            console.info('UIManager: TowerBuilder node set:', this.towerBuilder.name);
        } else {
            console.warn('UIManager: TowerBuilder node not set!');
        }
        
        // 初始化特效节点
        this.createEffects();
    }
    
    /**
     * 自动创建CountdownPopup
     */
    private autoCreateCountdownPopup() {
        // 如果countdownPopup已经存在，不需要创建
        if (this.countdownPopup) {
            console.info('UIManager: CountdownPopup already exists');
            return;
        }
        
        console.info('UIManager: Auto-creating CountdownPopup');
        
        // 获取Canvas或屏幕尺寸
        const canvas = find('Canvas');
        let canvasWidth = 960;
        let canvasHeight = 640;
        
        if (canvas) {
            const canvasTransform = canvas.getComponent(UITransform);
            if (canvasTransform) {
                canvasWidth = canvasTransform.width;
                canvasHeight = canvasTransform.height;
            }
        }
        
        // 创建CountdownPopup节点
        const popupNode = new Node('CountdownPopup');
        popupNode.setParent(this.node);
        
        // 计算右上角位置：与最右保持50像素，与最上保持100像素（往上移100像素）
        const popupSize = 37.5; // 弹窗大小，缩小为原来的二分之一（37.5x37.5）
        const rightMargin = 50;
        const topMargin = 100; // 原来的200像素，往上移100像素
        
        // 计算位置：屏幕原点在中心，所以右上角坐标是 (canvasWidth/2 - margin - popupSize/2, canvasHeight/2 - margin - popupSize/2)
        const posX = (canvasWidth / 2) - rightMargin - (popupSize / 2);
        const posY = (canvasHeight / 2) - topMargin - (popupSize / 2);
        
        popupNode.setPosition(posX, posY, 0); // 右上角位置
        
        // 添加CountdownPopup组件
        this.countdownPopup = popupNode.addComponent(CountdownPopup);
        
        // 手动设置弹窗大小，确保是75x75
        let uiTransform = popupNode.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = popupNode.addComponent(UITransform);
        }
        uiTransform.setContentSize(popupSize, popupSize);
        
        console.info(`UIManager: CountdownPopup created automatically at position (${posX}, ${posY}) with size ${popupSize}x${popupSize}`);
    }

    createEffects() {
        // 创建红边警告特效节点
        if (!this.warningNode) {
            this.warningNode = new Node('WarningEffect');
            const canvas = find('Canvas');
            if (canvas) {
                this.warningNode.setParent(canvas);
                this.warningNode.setSiblingIndex(0); 

                // 读取画布实际尺寸
                const canvasTransform = canvas.getComponent(UITransform);
                let width = 960;
                let height = 640;
                if (canvasTransform) {
                    width = canvasTransform.width;
                    height = canvasTransform.height;
                }

                const uiTransform = this.warningNode.addComponent(UITransform);
                uiTransform.setContentSize(width, height); // 和画布同大

                const graphics = this.warningNode.addComponent(Graphics);
                graphics.lineWidth = 20;
                graphics.strokeColor = new Color(255, 0, 0, 255); // 不透明红色

                // 在画布四边画一圈矩形边框（紧贴画布边缘）
                graphics.rect(-width / 2, -height / 2, width, height);
                graphics.stroke();

                this.warningNode.addComponent(UIOpacity).opacity = 0;
            }
        }

        // 创建公告提示节点
        if (!this.announcementNode) {
            this.announcementNode = new Node('Announcement');
            const canvas = find('Canvas');
            if (canvas) {
                this.announcementNode.setParent(canvas);
                this.announcementNode.setPosition(0, 100, 0); // 屏幕上方
                
                const label = this.announcementNode.addComponent(Label);
                label.string = "";
                label.fontSize = 40;
                label.color = Color.RED;
                label.isBold = true;
                
                this.announcementNode.active = false;
            }
        }
    }

    /**
     * 显示红边警告特效
     */
    showWarningEffect() {
        if (!this.warningNode) return;
        
        const opacityComp = this.warningNode.getComponent(UIOpacity);
        if (!opacityComp) return;
        
        this.warningNode.active = true;
        opacityComp.opacity = 0;
        
        // 闪烁动画
        tween(opacityComp)
            .to(0.2, { opacity: 150 })
            .to(0.2, { opacity: 0 })
            .to(0.2, { opacity: 150 })
            .to(0.2, { opacity: 0 })
            .to(0.2, { opacity: 150 })
            .to(0.5, { opacity: 0 })
            .call(() => {
                // this.warningNode.active = false; // 保持节点存在，只是不可见
            })
            .start();
            
        // 如果Graphics不支持设置透明度，我们可以用Sprite创建红色图片，这里假设Graphics可以
    }

    /**
     * 显示屏幕中间公告
     * @param message 公告内容
     */
    showAnnouncement(message: string) {
        if (!this.announcementNode) return;
        
        const label = this.announcementNode.getComponent(Label);
        if (label) {
            label.string = message;
        }
        
        this.announcementNode.active = true;
        this.announcementNode.setScale(0, 0, 1);
        const uiOpacity = this.announcementNode.getComponent(UIOpacity) || this.announcementNode.addComponent(UIOpacity);
        uiOpacity.opacity = 255;
        
        // 弹跳出现的动画
        tween(this.announcementNode)
            .to(0.5, { scale: new Vec3(1.2, 1.2, 1) }, { easing: 'backOut' })
            .to(0.2, { scale: new Vec3(1, 1, 1) })
            .delay(1.5)
            .to(0.3, { scale: new Vec3(0, 0, 1) }) // 或者淡出
            .call(() => {
                this.announcementNode.active = false;
            })
            .start();
    }

    findGameManager() {
        // 方法1: 通过节点名称查找
        let gmNode = find('GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager);
            if (this.gameManager) {
                console.debug('UIManager: Found GameManager by name');
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
                console.debug('UIManager: Found GameManager by recursive search');
                return;
            }
        }
        
        console.warn('UIManager: GameManager not found!');
    }

    onBuildButtonClick() {
        console.debug('UIManager: BuildButton clicked!');
        if (this.towerBuilder) {
            const builderScript = this.towerBuilder.getComponent('TowerBuilder') as any;
            if (builderScript) {
                if (builderScript.onBuildButtonClick) {
                    console.debug('UIManager: Calling TowerBuilder.onBuildButtonClick');
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
        console.debug('UIManager: RestartButton clicked!');
        
        // 重新查找GameManager
        this.findGameManager();
        
        if (this.gameManager) {
            console.debug('UIManager: Calling GameManager.restartGame');
            this.gameManager.restartGame();
        } else {
            console.warn('UIManager: GameManager is null! Trying to reload scene directly.');
            // 如果还是找不到，尝试直接重新加载场景
            const scene = director.getScene();
            if (scene && scene.name) {
                console.debug('UIManager: Reloading scene:', scene.name);
                director.loadScene(scene.name);
            } else {
                // 如果场景名称为空，尝试使用默认场景名称
                console.debug('UIManager: Scene name is empty, trying default name "scene"');
                director.loadScene('scene');
            }
        }
    }

    /**
     * 显示倒计时弹窗
     * @param onComplete 倒计时完成回调
     * @param onManualClose 手动关闭回调
     */
    showCountdownPopup(onComplete: () => void, onManualClose: () => void) {
        console.info('UIManager: Showing countdown popup');
        
        this.onCountdownComplete = onComplete;
        this.onCountdownManualClose = onManualClose;
        
        // 确保CountdownPopup存在
        this.autoCreateCountdownPopup();
        
        if (this.countdownPopup) {
            console.info('UIManager: CountdownPopup exists, calling show()');
            this.countdownPopup.show(
                this.onCountdownCompleteHandler.bind(this),
                this.onCountdownManualCloseHandler.bind(this)
            );
        } else {
            console.error('UIManager: CountdownPopup is null after auto-creation!');
            // 如果创建失败，直接调用onComplete
            onComplete();
        }
    }

    /**
     * 隐藏倒计时弹窗
     */
    hideCountdownPopup() {
        console.debug('UIManager: Hiding countdown popup');
        
        if (this.countdownPopup) {
            this.countdownPopup.hide();
        }
    }

    /**
     * 倒计时完成回调处理
     */
    private onCountdownCompleteHandler() {
        console.info('UIManager: Countdown completed');
        
        if (this.onCountdownComplete) {
            this.onCountdownComplete();
        }
        
        this.onCountdownComplete = null;
        this.onCountdownManualClose = null;
    }

    /**
     * 手动关闭倒计时弹窗回调处理
     */
    private onCountdownManualCloseHandler() {
        console.info('UIManager: Countdown manually closed');
        
        if (this.onCountdownManualClose) {
            this.onCountdownManualClose();
        }
        
        this.onCountdownComplete = null;
        this.onCountdownManualClose = null;
    }
}

