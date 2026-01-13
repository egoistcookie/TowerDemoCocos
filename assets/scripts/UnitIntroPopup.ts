import { _decorator, Component, Node, Sprite, Label, Button, EventTouch, find, UITransform, Vec3 } from 'cc';
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
    
    private gameManager: any = null!; // GameManager引用（使用any避免循环依赖）
    private buildButton: Button = null!; // 建造按钮引用
    
    start() {
        // 尝试多种方式查找GameManager（使用字符串避免循环依赖）
        let gmNode = find('Canvas/GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent('GameManager' as any);
        } else {
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
                return;
            }
        }
        
        // 方法2: 直接通过节点名称查找
        const buildButtonNode = find('UI/BuildButton') || find('Canvas/UI/BuildButton') || find('BuildButton');
        if (buildButtonNode) {
            this.buildButton = buildButtonNode.getComponent(Button);
            if (this.buildButton) {
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
                    return;
                }
            }
        }
        
    }
    
    /**
     * 禁用建造按钮
     */
    private disableBuildButton() {
        if (this.buildButton) {
            this.buildButton.interactable = false;
        }
    }
    
    /**
     * 启用建造按钮
     */
    private enableBuildButton() {
        if (this.buildButton) {
            this.buildButton.interactable = true;
        }
    }
    
    /**
     * 退出建造模式并关闭建造面板
     */
    private exitBuildingMode() {
        // 查找 TowerBuilder 节点
        const towerBuilderNode = this.findTowerBuilderNode();
        if (!towerBuilderNode) {
            console.error('[UnitIntroPopup] TowerBuilder node not found');
        }
        if (towerBuilderNode) {
            const towerBuilder = towerBuilderNode.getComponent('TowerBuilder') as any;
            if (towerBuilder) {
                // 直接关闭建筑物选择面板（立即隐藏，不等待动画）
                this.hideBuildingPanelImmediately();
            }
        }
    }
    
    /**
     * 立即隐藏建筑物选择面板
     */
    private hideBuildingPanelImmediately() {

        // 通过 TowerBuilder 查找
        const towerBuilderNode = this.findTowerBuilderNode();
        if (!towerBuilderNode) {
            console.error('[UnitIntroPopup] TowerBuilder node not found when hiding panel (method 2)');
        }
        if (towerBuilderNode) {
            const towerBuilder = towerBuilderNode.getComponent('TowerBuilder') as any;
            if (towerBuilder && towerBuilder.buildingPanel) {
                // 关闭建造模式
                towerBuilder.isBuildingMode = false;
                // 直接设置节点为不可见
                if (towerBuilder.buildingPanel.node) {
                    towerBuilder.buildingPanel.node.active = false;
                    return;
                }
                // 如果 panelContent 存在，也隐藏它
                if (towerBuilder.buildingPanel.panelContent) {
                    towerBuilder.buildingPanel.panelContent.active = false;
                }
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
        
        // 设置单位描述，即使为空字符串也要设置（因为可能是预制体中配置的）
        if (this.unitDescription) {
            // 如果 unitDescription 存在（包括空字符串），就设置它
            // 如果不存在或为 undefined/null，则使用默认值
            this.unitDescription.string = unitInfo.unitDescription !== undefined && unitInfo.unitDescription !== null 
                ? unitInfo.unitDescription 
                : '暂无描述';
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
     * 在当前场景中查找 TowerBuilder 节点（更稳妥的递归查找）
     */
    private findTowerBuilderNode(): Node | null {
        // 优先使用全局 find 简单查找
        const directNode = find('TowerBuilder');
        if (directNode) {
            return directNode;
        }

        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        const findInScene = (node: Node): Node | null => {
            // 按名称匹配
            if (node.name === 'TowerBuilder') {
                return node;
            }
            // 按组件名匹配（即便节点名被改掉）
            const tbComp = node.getComponent('TowerBuilder') as any;
            if (tbComp) {
                return node;
            }
            for (const child of node.children) {
                const found = findInScene(child);
                if (found) {
                    return found;
                }
            }
            return null;
        };

        const foundNode = findInScene(scene);
        if (!foundNode) {
            console.error('[UnitIntroPopup] findTowerBuilderNode: TowerBuilder not found in scene tree');
        }
        return foundNode;
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
