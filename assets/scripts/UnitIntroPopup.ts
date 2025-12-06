import { _decorator, Component, Node, Sprite, Label, Button, EventTouch, find, UITransform, Vec3 } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('UnitIntroPopup')
export class UnitIntroPopup extends Component {
    @property(Node)
    container: Node = null!;
    
    @property(Sprite)
    unitIcon: Sprite = null!;
    
    @property(Label)
    unitName: Label = null!;
    
    @property(Label)
    unitDescription: Label = null!;
    
    @property(Button)
    closeButton: Button = null!;
    
    private gameManager: GameManager = null!;
    
    start() {
        // 尝试多种方式查找GameManager
        let gmNode = find('GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager) as GameManager;
            console.info('UnitIntroPopup: Found GameManager by name');
        } else {
            // 从场景根节点查找
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
                this.gameManager = findInScene(scene, GameManager) as GameManager;
                if (this.gameManager) {
                    console.info('UnitIntroPopup: Found GameManager recursively');
                } else {
                    console.warn('UnitIntroPopup: GameManager not found!');
                }
            }
        }
        
        // 初始隐藏
        if (this.container) {
            this.container.active = false;
        }
        
        // 绑定关闭事件
        if (this.closeButton) {
            this.closeButton.node.on(Button.EventType.CLICK, this.onClose, this);
        }
        
        // 绑定容器点击事件
        if (this.container) {
            this.container.on('touch-end', this.onClose, this);
        }
    }
    
    /**
     * 显示单位介绍弹窗
     * @param unitInfo 单位信息对象
     */
    show(unitInfo: any) {
        if (!this.container) return;
        
        // 暂停游戏
        if (this.gameManager) {
            this.gameManager.pauseGame();
        }
        
        // 设置单位信息
        if (unitInfo.unitIcon && this.unitIcon) {
            this.unitIcon.spriteFrame = unitInfo.unitIcon;
        }
        
        if (unitInfo.unitName && this.unitName) {
            this.unitName.string = unitInfo.unitName;
        }
        
        if (unitInfo.unitDescription && this.unitDescription) {
            this.unitDescription.string = unitInfo.unitDescription;
        }
        
        // 设置容器为最上层
        this.container.setSiblingIndex(Number.MAX_SAFE_INTEGER);
        
        // 显示弹窗
        this.container.active = true;
        
        // 监听触摸事件，阻止事件冒泡到下层
        this.container.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.container.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.container.on(Node.EventType.TOUCH_END, this.onClose, this);
    }
    
    /**
     * 触摸开始事件，阻止事件冒泡
     */
    onTouchStart(event: EventTouch) {
        event.propagationStopped = true;
    }
    
    /**
     * 触摸移动事件，阻止事件冒泡
     */
    onTouchMove(event: EventTouch) {
        event.propagationStopped = true;
    }
    
    /**
     * 隐藏单位介绍弹窗
     */
    hide() {
        if (!this.container) return;
        
        // 移除所有触摸事件监听器
        this.container.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.container.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.container.off(Node.EventType.TOUCH_END, this.onClose, this);
        
        // 继续游戏
        if (this.gameManager) {
            this.gameManager.resumeGame();
        }
        
        // 隐藏弹窗
        this.container.active = false;
    }
    
    /**
     * 关闭按钮点击事件
     */
    onClose() {
        this.hide();
    }
}
