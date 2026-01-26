import { _decorator, Component, Node, Sprite, Label, Button, EventTouch, find, UITransform, Vec3, tween, Color, UIOpacity, Graphics, view } from 'cc';
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
    private maskLayer: Node = null!; // 遮罩层节点
    
    start() {
        // 尝试多种方式查找GameManager（使用字符串避免循环依赖）
        let gmNode = find('Canvas/GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent('GameManager' as any);
        } else {
        }
        
        // 查找建造按钮
        this.findBuildButton();
        
        // 创建遮罩层
        this.createMaskLayer();
        
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
     * 创建遮罩层（用于阻止点击穿透和置灰效果）
     */
    private createMaskLayer() {
        // 如果遮罩层已存在，先销毁
        if (this.maskLayer && this.maskLayer.isValid) {
            this.maskLayer.destroy();
        }
        
        // 查找 Canvas 节点
        const canvasNode = find('Canvas');
        if (!canvasNode) {
            console.error('[UnitIntroPopup] Canvas node not found');
            return;
        }
        
        // 创建遮罩层节点
        this.maskLayer = new Node('UnitIntroMask');
        this.maskLayer.setParent(canvasNode);
        
        // 设置遮罩层在最上层（但低于介绍框容器）
        this.maskLayer.setSiblingIndex(Number.MAX_SAFE_INTEGER - 1);
        
        // 添加 UITransform 组件
        const uiTransform = this.maskLayer.addComponent(UITransform);
        const visibleSize = view.getVisibleSize();
        // 使用足够大的尺寸确保覆盖整个屏幕
        uiTransform.setContentSize(visibleSize.width * 2, visibleSize.height * 2);
        this.maskLayer.setPosition(0, 0, 0);
        
        // 添加 Graphics 组件用于绘制半透明黑色背景
        const graphics = this.maskLayer.addComponent(Graphics);
        graphics.fillColor = new Color(0, 0, 0, 180); // 半透明黑色（alpha=180，约70%不透明度）
        // 绘制一个足够大的矩形覆盖整个屏幕
        graphics.rect(-visibleSize.width, -visibleSize.height, visibleSize.width * 2, visibleSize.height * 2);
        graphics.fill();
        
        // 添加 UIOpacity 组件用于淡入淡出动画
        const uiOpacity = this.maskLayer.addComponent(UIOpacity);
        uiOpacity.opacity = 0;
        
        // 初始隐藏遮罩层
        this.maskLayer.active = false;
        
        // 阻止遮罩层的所有触摸事件穿透（使用 capture 模式确保优先处理）
        this.maskLayer.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
            event.propagationStopped = true;
        }, this, true);
        this.maskLayer.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
            event.propagationStopped = true;
        }, this, true);
        this.maskLayer.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            event.propagationStopped = true;
        }, this, true);
        this.maskLayer.on(Node.EventType.TOUCH_CANCEL, (event: EventTouch) => {
            event.propagationStopped = true;
        }, this, true);
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
        
        // 显示遮罩层（置灰效果）
        this.showMaskLayer();
        
        // 设置容器为最上层（在遮罩层之上）
        this.container.setSiblingIndex(Number.MAX_SAFE_INTEGER);
        
        // 显示弹窗
        this.container.active = true;
        
        // 添加高亮显示效果
        this.playHighlightAnimation();
        
        // 监听触摸事件，阻止事件冒泡到下层
        this.container.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.container.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.container.on(Node.EventType.TOUCH_END, this.onClose, this);
    }
    
    /**
     * 显示遮罩层（置灰效果）
     */
    private showMaskLayer() {
        if (!this.maskLayer || !this.maskLayer.isValid) {
            this.createMaskLayer();
        }
        if (!this.maskLayer || !this.maskLayer.isValid) return;
        
        // 获取屏幕尺寸
        const visibleSize = view.getVisibleSize();
        
        // 更新遮罩层大小（以防屏幕尺寸变化）
        const uiTransform = this.maskLayer.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.setContentSize(visibleSize.width * 2, visibleSize.height * 2);
        }
        
        // 更新 Graphics 绘制（如果需要）
        const graphics = this.maskLayer.getComponent(Graphics);
        if (graphics) {
            graphics.clear();
            graphics.fillColor = new Color(0, 0, 0, 180);
            graphics.rect(-visibleSize.width, -visibleSize.height, visibleSize.width * 2, visibleSize.height * 2);
            graphics.fill();
        }
        
        // 显示遮罩层
        this.maskLayer.active = true;
        this.maskLayer.setSiblingIndex(Number.MAX_SAFE_INTEGER - 1);
        
        // 淡入动画
        const uiOpacity = this.maskLayer.getComponent(UIOpacity);
        if (uiOpacity) {
            uiOpacity.opacity = 0;
            tween({ opacity: 0 })
                .to(0.3, { opacity: 180 }, {
                    onUpdate: (target: any) => {
                        if (uiOpacity && uiOpacity.isValid) {
                            uiOpacity.opacity = Math.floor(target.opacity);
                        }
                    }
                })
                .start();
        }
    }
    
    /**
     * 隐藏遮罩层
     */
    private hideMaskLayer() {
        if (!this.maskLayer) return;
        
        // 淡出动画
        const uiOpacity = this.maskLayer.getComponent(UIOpacity);
        if (uiOpacity) {
            tween({ opacity: uiOpacity.opacity })
                .to(0.2, { opacity: 0 }, {
                    onUpdate: (target: any) => {
                        if (uiOpacity) {
                            uiOpacity.opacity = Math.floor(target.opacity);
                        }
                    },
                    onComplete: () => {
                        // 动画完成后隐藏遮罩层
                        this.maskLayer.active = false;
                    }
                })
                .start();
        } else {
            // 如果没有 UIOpacity 组件，直接隐藏
            this.maskLayer.active = false;
        }
    }
    
    /**
     * 播放高亮显示动画
     */
    private playHighlightAnimation() {
        if (!this.container) return;
        
        // 停止之前的动画
        tween(this.container).stop();
        
        // 初始状态：缩放为0.8，透明度为0
        this.container.setScale(0.8, 0.8, 1);
        
        // 获取或添加 UIOpacity 组件用于透明度控制
        let uiOpacity = this.container.getComponent(UIOpacity);
        if (!uiOpacity) {
            uiOpacity = this.container.addComponent(UIOpacity);
        }
        uiOpacity.opacity = 0;
        
        // 弹跳出现动画：同时进行缩放和透明度动画
        // 缩放动画：从0.8到1.1再到1.0（弹跳效果）
        tween(this.container)
            .to(0.3, { scale: new Vec3(1.1, 1.1, 1) }, { easing: 'backOut' })
            .to(0.1, { scale: new Vec3(1.0, 1.0, 1) })
            .start();
        
        // 透明度动画：从0到255
        tween({ opacity: 0 })
            .to(0.2, { opacity: 255 }, {
                onUpdate: (target: any) => {
                    if (uiOpacity) {
                        uiOpacity.opacity = Math.floor(target.opacity);
                    }
                }
            })
            .call(() => {
                // 动画完成后，确保透明度为255
                if (uiOpacity) {
                    uiOpacity.opacity = 255;
                }
                
                // 添加持续的高亮闪烁效果（轻微的颜色变化）
                this.playContinuousHighlight();
            })
            .start();
    }
    
    /**
     * 播放持续的高亮闪烁效果
     */
    private playContinuousHighlight() {
        if (!this.container) return;
        
        // 获取容器的背景 Sprite（如果有的话）
        const backgroundSprite = this.container.getComponent(Sprite);
        
        if (backgroundSprite) {
            // 保存原始颜色
            const originalColor = backgroundSprite.color.clone();
            
            // 创建闪烁动画：轻微的颜色变化
            tween(backgroundSprite)
                .to(1.0, { 
                    color: new Color(
                        Math.min(255, originalColor.r + 20),
                        Math.min(255, originalColor.g + 20),
                        Math.min(255, originalColor.b + 20),
                        originalColor.a
                    )
                })
                .to(1.0, { color: originalColor })
                .union()
                .repeatForever()
                .start();
        } else {
            // 如果没有背景 Sprite，使用缩放脉冲效果
            tween(this.container)
                .to(0.8, { scale: new Vec3(1.02, 1.02, 1) })
                .to(0.8, { scale: new Vec3(1.0, 1.0, 1) })
                .union()
                .repeatForever()
                .start();
        }
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
        
        // 停止所有动画
        tween(this.container).stop();
        
        // 恢复原始状态
        this.container.setScale(1.0, 1.0, 1);
        const uiOpacity = this.container.getComponent(UIOpacity);
        if (uiOpacity) {
            uiOpacity.opacity = 255;
        }
        
        // 恢复背景颜色（如果有）
        const backgroundSprite = this.container.getComponent(Sprite);
        if (backgroundSprite) {
            tween(backgroundSprite).stop();
        }
        
        // 移除所有触摸事件监听器
        this.container.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.container.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.container.off(Node.EventType.TOUCH_END, this.onClose, this);
        
        // 隐藏遮罩层
        this.hideMaskLayer();
        
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
