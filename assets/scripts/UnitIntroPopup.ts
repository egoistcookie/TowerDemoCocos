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
    private buildButton: Button = null!; // 建造按钮引用
    
    start() {
        // 尝试多种方式查找GameManager
        let gmNode = find('GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager) as GameManager;
            console.debug('UnitIntroPopup: Found GameManager by name');
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
                    console.debug('UnitIntroPopup: Found GameManager recursively');
                } else {
                    console.warn('UnitIntroPopup: GameManager not found!');
                }
            }
        }
        
        // 查找建造按钮
        this.findBuildButton();
        
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
     * 查找建造按钮
     */
    private findBuildButton() {
        // 方法1: 通过UIManager查找
        const uiManagerNode = find('UIManager') || find('UI/UIManager') || find('Canvas/UI/UIManager');
        if (uiManagerNode) {
            const uiManager = uiManagerNode.getComponent('UIManager') as any;
            if (uiManager && uiManager.buildButton) {
                this.buildButton = uiManager.buildButton;
                console.debug('UnitIntroPopup: Found BuildButton through UIManager');
                return;
            }
        }
        
        // 方法2: 直接通过节点名称查找
        const buildButtonNode = find('UI/BuildButton') || find('Canvas/UI/BuildButton') || find('BuildButton');
        if (buildButtonNode) {
            this.buildButton = buildButtonNode.getComponent(Button);
            if (this.buildButton) {
                console.debug('UnitIntroPopup: Found BuildButton by node name');
                return;
            }
        }
        
        // 方法3: 从场景中递归查找
        const scene = this.node.scene;
        if (scene) {
            const findInScene = (node: Node, name: string): Node | null => {
                if (node.name === name) {
                    return node;
                }
                for (const child of node.children) {
                    const found = findInScene(child, name);
                    if (found) return found;
                }
                return null;
            };
            
            const buttonNode = findInScene(scene, 'BuildButton');
            if (buttonNode) {
                this.buildButton = buttonNode.getComponent(Button);
                if (this.buildButton) {
                    console.debug('UnitIntroPopup: Found BuildButton recursively');
                    return;
                }
            }
        }
        
        console.warn('UnitIntroPopup: BuildButton not found!');
    }
    
    /**
     * 禁用建造按钮
     */
    private disableBuildButton() {
        if (this.buildButton) {
            this.buildButton.interactable = false;
            console.debug('UnitIntroPopup: BuildButton disabled');
        }
    }
    
    /**
     * 启用建造按钮
     */
    private enableBuildButton() {
        if (this.buildButton) {
            this.buildButton.interactable = true;
            console.debug('UnitIntroPopup: BuildButton enabled');
        }
    }
    
    /**
     * 退出建造模式并关闭建造面板
     */
    private exitBuildingMode() {
        // 查找 TowerBuilder 节点
        const towerBuilderNode = find('TowerBuilder');
        if (towerBuilderNode) {
            const towerBuilder = towerBuilderNode.getComponent('TowerBuilder') as any;
            if (towerBuilder) {
                // 先直接关闭建筑物选择面板（立即隐藏，不等待动画）
                this.hideBuildingPanelImmediately();
                
                // 调用 disableBuildingMode 退出建造模式并关闭建造面板
                if (towerBuilder.disableBuildingMode && typeof towerBuilder.disableBuildingMode === 'function') {
                    towerBuilder.disableBuildingMode();
                    console.debug('UnitIntroPopup: Building mode disabled');
                }
                // 确保建造模式状态被设置为 false
                if (towerBuilder.isBuildingMode !== undefined) {
                    towerBuilder.isBuildingMode = false;
                }
            }
        }
    }
    
    /**
     * 立即隐藏建筑物选择面板
     */
    private hideBuildingPanelImmediately() {
        // 方法1: 通过节点名称查找 BuildingSelectionPanel
        const panelNode = find('BuildingSelectionPanel') || find('Canvas/UI/BuildingSelectionPanel') || find('UI/BuildingSelectionPanel');
        if (panelNode) {
            panelNode.active = false;
            console.debug('UnitIntroPopup: BuildingSelectionPanel hidden immediately by node name');
            return;
        }
        
        // 方法2: 通过 TowerBuilder 查找
        const towerBuilderNode = find('TowerBuilder');
        if (towerBuilderNode) {
            const towerBuilder = towerBuilderNode.getComponent('TowerBuilder') as any;
            if (towerBuilder && towerBuilder.buildingPanel) {
                // 直接设置节点为不可见
                if (towerBuilder.buildingPanel.node) {
                    towerBuilder.buildingPanel.node.active = false;
                    console.debug('UnitIntroPopup: BuildingSelectionPanel hidden immediately through TowerBuilder');
                    return;
                }
                // 如果 panelContent 存在，也隐藏它
                if (towerBuilder.buildingPanel.panelContent) {
                    towerBuilder.buildingPanel.panelContent.active = false;
                }
            }
        }
        
        // 方法3: 从场景中递归查找
        const scene = this.node.scene;
        if (scene) {
            const findInScene = (node: Node, name: string): Node | null => {
                if (node.name === name) {
                    return node;
                }
                for (const child of node.children) {
                    const found = findInScene(child, name);
                    if (found) return found;
                }
                return null;
            };
            
            const foundPanel = findInScene(scene, 'BuildingSelectionPanel');
            if (foundPanel) {
                foundPanel.active = false;
                console.debug('UnitIntroPopup: BuildingSelectionPanel hidden immediately recursively');
            }
        }
    }
    
    /**
     * 显示单位介绍弹窗
     * @param unitInfo 单位信息对象
     */
    show(unitInfo: any) {
        if (!this.container) return;
        
        // 退出建造模式并关闭建造面板
        this.exitBuildingMode();
        
        // 暂停游戏
        if (this.gameManager) {
            this.gameManager.pauseGame();
        }
        
        // 禁用建造按钮
        this.disableBuildButton();
        
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
        
        // 启用建造按钮
        this.enableBuildButton();
        
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
