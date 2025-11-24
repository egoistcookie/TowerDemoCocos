import { _decorator, Component, Node, Prefab, Sprite, SpriteFrame, Label, Color, UITransform, Graphics, EventTouch, Vec3, Vec2, tween, UIOpacity, find, instantiate, Camera } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

// 建筑物类型定义
export interface BuildingType {
    name: string;
    prefab: Prefab;
    cost: number;
    icon: SpriteFrame; // 图标
    description?: string;
}

@ccclass('BuildingSelectionPanel')
export class BuildingSelectionPanel extends Component {
    @property(Node)
    panelContent: Node = null!; // 面板内容容器

    @property(Prefab)
    buildingItemPrefab: Prefab = null!; // 建筑物选项预制体（可选）

    private buildingTypes: BuildingType[] = [];
    private selectedBuilding: BuildingType | null = null;
    private isDragging: boolean = false;
    private dragPreview: Node = null!;
    private gameManager: GameManager = null!;
    private onBuildingSelectedCallback: ((building: BuildingType) => void) | null = null;
    private onBuildCallback: ((building: BuildingType, position: Vec3) => void) | null = null;
    private canvasNode: Node = null!;

    start() {
        this.findGameManager();
        this.node.active = false; // 初始隐藏
        
        // 监听Canvas的触摸移动事件，用于拖拽预览
        this.canvasNode = find('Canvas');
        if (this.canvasNode) {
            this.canvasNode.on(Node.EventType.TOUCH_MOVE, this.onCanvasTouchMove, this);
        }
    }

    onDestroy() {
        if (this.canvasNode) {
            this.canvasNode.off(Node.EventType.TOUCH_MOVE, this.onCanvasTouchMove, this);
        }
        this.clearDragPreview();
    }

    /**
     * Canvas触摸移动事件（用于拖拽预览）
     */
    onCanvasTouchMove(event: EventTouch) {
        if (this.isDragging && this.dragPreview && this.selectedBuilding) {
            const location = event.getLocation();
            this.updateDragPreview(new Vec3(location.x, location.y, 0));
        }
    }

    findGameManager() {
        const gmNode = find('GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager);
        }
    }

    /**
     * 设置建筑物类型列表
     */
    setBuildingTypes(types: BuildingType[]) {
        this.buildingTypes = types;
        this.updatePanel();
    }

    /**
     * 设置建筑物选择回调
     */
    setOnBuildingSelected(callback: (building: BuildingType) => void) {
        this.onBuildingSelectedCallback = callback;
    }

    /**
     * 设置建造回调
     */
    setOnBuild(callback: (building: BuildingType, position: Vec3) => void) {
        this.onBuildCallback = callback;
    }

    /**
     * 显示面板
     */
    show() {
        this.node.active = true;
        // 动画显示
        this.node.setScale(0, 1, 1);
        tween(this.node)
            .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();
    }

    /**
     * 隐藏面板
     */
    hide() {
        tween(this.node)
            .to(0.2, { scale: new Vec3(0, 1, 1) }, { easing: 'backIn' })
            .call(() => {
                this.node.active = false;
                this.selectedBuilding = null;
                this.clearDragPreview();
            })
            .start();
    }

    /**
     * 更新面板内容
     */
    updatePanel() {
        // 如果没有指定内容容器，尝试查找或创建
        if (!this.panelContent) {
            // 尝试查找Content子节点
            const contentNode = this.node.getChildByName('Content');
            if (contentNode) {
                this.panelContent = contentNode;
            } else {
                // 如果没有，使用当前节点
                this.panelContent = this.node;
            }
        }

        // 清空现有内容
        if (this.panelContent) {
            this.panelContent.removeAllChildren();
        }

        // 创建建筑物选项
        this.buildingTypes.forEach((building, index) => {
            const item = this.createBuildingItem(building, index);
            this.panelContent.addChild(item);
        });
    }

    /**
     * 创建建筑物选项
     */
    createBuildingItem(building: BuildingType, index: number): Node {
        const item = new Node(`BuildingItem_${building.name}`);
        
        // 添加UITransform
        const transform = item.addComponent(UITransform);
        transform.setContentSize(120, 120);

        // 设置位置（水平排列）
        const spacing = 140;
        const startX = -(this.buildingTypes.length - 1) * spacing / 2;
        item.setPosition(startX + index * spacing, 0, 0);

        // 添加背景
        const bg = new Node('Background');
        bg.setParent(item);
        bg.setPosition(0, 0, 0);
        const bgTransform = bg.addComponent(UITransform);
        bgTransform.setContentSize(110, 110);
            const bgGraphics = bg.addComponent(Graphics);
        bgGraphics.fillColor = new Color(50, 50, 50, 200);
        bgGraphics.roundRect(-55, -55, 110, 110, 10);
        bgGraphics.fill();

        // 添加图标
        if (building.icon) {
            const icon = new Node('Icon');
            icon.setParent(item);
            icon.setPosition(0, 10, 0);
            const iconSprite = icon.addComponent(Sprite);
            iconSprite.spriteFrame = building.icon;
            const iconTransform = icon.addComponent(UITransform);
            iconTransform.setContentSize(60, 60);
        }

        // 添加名称标签
        const nameLabel = new Node('NameLabel');
        nameLabel.setParent(item);
        nameLabel.setPosition(0, -20, 0);
        const nameLabelComp = nameLabel.addComponent(Label);
        nameLabelComp.string = building.name;
        nameLabelComp.fontSize = 16;
        nameLabelComp.color = Color.WHITE;

        // 添加价格标签
        const costLabel = new Node('CostLabel');
        costLabel.setParent(item);
        costLabel.setPosition(0, -40, 0);
        const costLabelComp = costLabel.addComponent(Label);
        costLabelComp.string = `💰${building.cost}`;
        costLabelComp.fontSize = 14;
        costLabelComp.color = Color.YELLOW;

        // 添加触摸事件
        item.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
            this.onBuildingItemTouchStart(building, event);
        }, this);

        item.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
            this.onBuildingItemTouchMove(building, event);
        }, this);

        item.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            this.onBuildingItemTouchEnd(building, event);
        }, this);

        item.on(Node.EventType.TOUCH_CANCEL, (event: EventTouch) => {
            this.onBuildingItemTouchCancel(building, event);
        }, this);

        return item;
    }

    /**
     * 建筑物选项触摸开始
     */
    onBuildingItemTouchStart(building: BuildingType, event: EventTouch) {
        // 检查金币是否足够
        if (this.gameManager && !this.gameManager.canAfford(building.cost)) {
            return;
        }

        this.selectedBuilding = building;
        this.isDragging = false;

        // 创建拖拽预览（初始位置在触摸点）
        const location = event.getLocation();
        this.createDragPreview(building, new Vec3(location.x, location.y, 0));

        if (this.onBuildingSelectedCallback) {
            this.onBuildingSelectedCallback(building);
        }
        
        // 阻止事件传播，避免触发其他事件
        event.propagationStopped = true;
    }

    /**
     * 建筑物选项触摸移动
     */
    onBuildingItemTouchMove(building: BuildingType, event: EventTouch) {
        if (this.selectedBuilding !== building) {
            return;
        }

        // 标记为拖拽状态（移动超过一定距离才算拖拽）
        const location = event.getLocation();
        const startLocation = event.getStartLocation();
        const dragDistance = Math.sqrt(
            Math.pow(location.x - startLocation.x, 2) + 
            Math.pow(location.y - startLocation.y, 2)
        );
        
        // 如果移动距离超过10像素，认为是拖拽
        if (dragDistance > 10) {
            if (!this.isDragging) {
                this.isDragging = true;
            }
            
            // 更新拖拽预览位置
            this.updateDragPreview(new Vec3(location.x, location.y, 0));
        }
        
        // 阻止事件传播
        event.propagationStopped = true;
    }

    /**
     * 建筑物选项触摸结束
     */
    onBuildingItemTouchEnd(building: BuildingType, event: EventTouch) {
        if (this.selectedBuilding !== building) {
            return;
        }

        if (this.isDragging) {
            // 检查是否点击在UI元素上（如面板、按钮等），如果是则不建造
            const targetNode = event.target as Node;
            let isUIElement = false;
            
            if (targetNode) {
                const nodeName = targetNode.name.toLowerCase();
                // 检查节点名称
                if (nodeName.includes('button') || 
                    nodeName.includes('panel') || 
                    nodeName.includes('label') ||
                    nodeName.includes('selection') ||
                    nodeName.includes('buildingitem') ||
                    nodeName.includes('buildingselection')) {
                    isUIElement = true;
                } else {
                    // 检查父节点
                    let parent = targetNode.parent;
                    while (parent) {
                        const parentName = parent.name.toLowerCase();
                        if (parentName.includes('ui') || 
                            parentName.includes('panel') ||
                            parentName.includes('buildingselection')) {
                            // 检查是否是Canvas的直接子节点（UI层）
                            if (parent.name === 'Canvas') {
                                // 检查是否是UI相关的子节点
                                const uiChildren = ['UI', 'UIManager', 'HealthLabel', 'TimerLabel', 'BuildingSelectionPanel'];
                                if (uiChildren.some(name => targetNode.name.includes(name) || 
                                    targetNode.getPathInHierarchy().includes(name))) {
                                    isUIElement = true;
                                    break;
                                }
                            } else {
                                // 如果父节点是UI相关，不建造
                                isUIElement = true;
                                break;
                            }
                        }
                        parent = parent.parent;
                    }
                }
            }

            if (!isUIElement) {
                // 拖拽结束，尝试建造（不在UI元素上）
                const location = event.getLocation();
                const worldPos = this.getWorldPositionFromScreen(new Vec3(location.x, location.y, 0));
                if (worldPos && this.onBuildCallback) {
                    this.onBuildCallback(building, worldPos);
                }
            }
        }

        // 清除拖拽预览和状态
        this.clearDragPreview();
        this.selectedBuilding = null;
        this.isDragging = false;
        
        // 阻止事件传播
        event.propagationStopped = true;
    }

    /**
     * 建筑物选项触摸取消
     */
    onBuildingItemTouchCancel(building: BuildingType, event: EventTouch) {
        this.clearDragPreview();
        this.selectedBuilding = null;
        this.isDragging = false;
        
        // 阻止事件传播
        event.propagationStopped = true;
    }

    /**
     * 创建拖拽预览
     */
    createDragPreview(building: BuildingType, screenPos: Vec3) {
        if (!building.prefab) {
            return;
        }

        // 创建预览节点
        this.dragPreview = instantiate(building.prefab);
        
        // 设置父节点
        const canvas = find('Canvas');
        if (canvas) {
            this.dragPreview.setParent(canvas);
        } else {
            this.dragPreview.setParent(this.node.scene);
        }

        // 设置半透明效果
        const opacity = this.dragPreview.addComponent(UIOpacity);
        opacity.opacity = 150; // 半透明

        // 设置初始位置
        const worldPos = this.getWorldPositionFromScreen(screenPos);
        if (worldPos) {
            this.dragPreview.setWorldPosition(worldPos);
        }
    }

    /**
     * 更新拖拽预览位置
     */
    updateDragPreview(screenPos: Vec3) {
        if (!this.dragPreview) {
            return;
        }

        const worldPos = this.getWorldPositionFromScreen(screenPos);
        if (worldPos) {
            this.dragPreview.setWorldPosition(worldPos);
        }
    }

    /**
     * 清除拖拽预览
     */
    clearDragPreview() {
        if (this.dragPreview && this.dragPreview.isValid) {
            this.dragPreview.destroy();
            this.dragPreview = null!;
        }
    }

    /**
     * 从屏幕坐标获取世界坐标
     */
    getWorldPositionFromScreen(screenPos: Vec3): Vec3 | null {
        const cameraNode = find('Canvas/Camera');
        if (!cameraNode) {
            return null;
        }

        const camera = cameraNode.getComponent(Camera);
        if (!camera) {
            return null;
        }

        const worldPos = new Vec3();
        camera.screenToWorld(screenPos, worldPos);
        worldPos.z = 0;
        return worldPos;
    }
}

