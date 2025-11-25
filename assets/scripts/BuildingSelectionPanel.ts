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
    private touchEndHandled: boolean = false; // 标记触摸结束事件是否已处理

    start() {
        console.log('BuildingSelectionPanel.start: Initializing');
        this.findGameManager();
        this.node.active = false; // 初始隐藏
        
        // 监听Canvas的触摸移动事件，用于拖拽预览
        this.canvasNode = find('Canvas');
        if (this.canvasNode) {
            console.log('BuildingSelectionPanel.start: Canvas found, setting up touch listeners');
            this.canvasNode.on(Node.EventType.TOUCH_MOVE, this.onCanvasTouchMove, this);
            this.canvasNode.on(Node.EventType.TOUCH_END, this.onCanvasTouchEnd, this);
        } else {
            console.error('BuildingSelectionPanel.start: Canvas not found!');
        }
    }

    onDestroy() {
        if (this.canvasNode) {
            this.canvasNode.off(Node.EventType.TOUCH_MOVE, this.onCanvasTouchMove, this);
            this.canvasNode.off(Node.EventType.TOUCH_END, this.onCanvasTouchEnd, this);
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

    /**
     * Canvas触摸结束事件（处理拖拽到游戏界面中松开的情况）
     */
    onCanvasTouchEnd(event: EventTouch) {
        console.log('BuildingSelectionPanel.onCanvasTouchEnd: touchEndHandled=', this.touchEndHandled, 'isDragging=', this.isDragging, 'selectedBuilding=', !!this.selectedBuilding, 'dragPreview=', !!this.dragPreview);
        
        // 如果触摸结束事件已经被处理（在BuildingItem上），则不处理
        if (this.touchEndHandled) {
            console.log('BuildingSelectionPanel.onCanvasTouchEnd: Already handled, skipping');
            this.touchEndHandled = false; // 重置标志
            return;
        }

        // 如果正在拖拽且有选中的建筑物，处理建造逻辑
        if (this.isDragging && this.selectedBuilding && this.dragPreview) {
            console.log('BuildingSelectionPanel.onCanvasTouchEnd: Processing drag end');
            const location = event.getLocation();
            const startLocation = event.getStartLocation();
            const dragDistance = Math.sqrt(
                Math.pow(location.x - startLocation.x, 2) + 
                Math.pow(location.y - startLocation.y, 2)
            );

            // 如果拖拽距离超过5像素，检查是否可以建造
            if (dragDistance > 5) {
                // 检查触摸结束位置是否在建筑物选择面板区域内
                let isInPanelArea = false;
                if (this.node && this.node.active) {
                    const panelTransform = this.node.getComponent(UITransform);
                    if (panelTransform) {
                        const panelWorldPos = this.node.worldPosition;
                        const panelSize = panelTransform.contentSize;
                        
                        const cameraNode = find('Canvas/Camera');
                        if (cameraNode) {
                            const camera = cameraNode.getComponent(Camera);
                            if (camera) {
                                const panelScreenPos = new Vec3();
                                camera.worldToScreen(panelWorldPos, panelScreenPos);
                                
                                const panelScreenRect = {
                                    x: panelScreenPos.x - panelSize.width / 2,
                                    y: panelScreenPos.y - panelSize.height / 2,
                                    width: panelSize.width,
                                    height: panelSize.height
                                };
                                
                                if (location.x >= panelScreenRect.x && 
                                    location.x <= panelScreenRect.x + panelScreenRect.width &&
                                    location.y >= panelScreenRect.y && 
                                    location.y <= panelScreenRect.y + panelScreenRect.height) {
                                    isInPanelArea = true;
                                }
                            }
                        }
                    }
                }

                // 如果不在面板区域内，尝试建造
                if (!isInPanelArea) {
                    const worldPos = this.getWorldPositionFromScreen(new Vec3(location.x, location.y, 0));
                    if (worldPos && this.onBuildCallback) {
                        console.log('BuildingSelectionPanel.onCanvasTouchEnd: Calling onBuildCallback');
                        this.onBuildCallback(this.selectedBuilding, worldPos);
                        
                        // 清除拖拽预览和状态
                        this.clearDragPreview();
                        this.selectedBuilding = null;
                        this.isDragging = false;
                        
                        // 阻止事件传播
                        event.propagationStopped = true;
                        return;
                    }
                }
            }
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
        console.log('BuildingSelectionPanel.show: Showing panel, buildingTypes count=', this.buildingTypes.length);
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
        console.log('BuildingSelectionPanel.updatePanel: Updating panel with', this.buildingTypes.length, 'buildings');
        
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
            console.log('BuildingSelectionPanel.updatePanel: Added item', building.name, 'to panel');
        });
        
        console.log('BuildingSelectionPanel.updatePanel: Panel updated, children count=', this.panelContent.children.length);
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

        // 确保节点可以接收触摸事件
        // 在 Cocos Creator 中，节点需要有 UITransform 才能接收触摸事件
        // 我们已经添加了 UITransform，所以应该可以工作
        
        // 添加触摸事件
        console.log('BuildingSelectionPanel.createBuildingItem: Creating item for', building.name);
        item.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
            console.log('BuildingSelectionPanel: TOUCH_START event received on', building.name);
            this.onBuildingItemTouchStart(building, event);
        }, this);

        item.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
            console.log('BuildingSelectionPanel: TOUCH_MOVE event received on', building.name);
            this.onBuildingItemTouchMove(building, event);
        }, this);

        item.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            console.log('BuildingSelectionPanel: TOUCH_END event received on', building.name);
            this.onBuildingItemTouchEnd(building, event);
        }, this);

        item.on(Node.EventType.TOUCH_CANCEL, (event: EventTouch) => {
            console.log('BuildingSelectionPanel: TOUCH_CANCEL event received on', building.name);
            this.onBuildingItemTouchCancel(building, event);
        }, this);

        console.log('BuildingSelectionPanel.createBuildingItem: Item created, UITransform size=', transform.contentSize);
        return item;
    }

    /**
     * 建筑物选项触摸开始
     */
    onBuildingItemTouchStart(building: BuildingType, event: EventTouch) {
        console.log('BuildingSelectionPanel.onBuildingItemTouchStart: Building=', building.name);
        
        // 检查金币是否足够
        if (this.gameManager && !this.gameManager.canAfford(building.cost)) {
            console.log('BuildingSelectionPanel.onBuildingItemTouchStart: Not enough gold!');
            return;
        }

        this.selectedBuilding = building;
        this.isDragging = false;
        this.touchEndHandled = false; // 重置标志

        // 创建拖拽预览（初始位置在触摸点）
        const location = event.getLocation();
        console.log('BuildingSelectionPanel.onBuildingItemTouchStart: Location=', location);
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
                console.log('BuildingSelectionPanel.onBuildingItemTouchMove: Start dragging');
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
        console.log('BuildingSelectionPanel.onBuildingItemTouchEnd: Building=', building.name, 'selectedBuilding=', this.selectedBuilding?.name);
        
        if (this.selectedBuilding !== building) {
            console.log('BuildingSelectionPanel.onBuildingItemTouchEnd: Selected building mismatch');
            return;
        }

        // 检查是否发生了拖拽（移动距离超过5像素）
        const location = event.getLocation();
        const startLocation = event.getStartLocation();
        const dragDistance = Math.sqrt(
            Math.pow(location.x - startLocation.x, 2) + 
            Math.pow(location.y - startLocation.y, 2)
        );

        // 如果没有发生拖拽，不处理
        if (dragDistance <= 5) {
            this.clearDragPreview();
            this.selectedBuilding = null;
            this.isDragging = false;
            event.propagationStopped = true;
            return;
        }

        // 检查触摸结束位置是否在建筑物选择面板区域内
        // 使用更简单的方法：检查触摸位置是否在面板节点的屏幕坐标范围内
        let isInPanelArea = false;
        if (this.node && this.node.active) {
            const panelTransform = this.node.getComponent(UITransform);
            if (panelTransform) {
                // 获取面板的世界坐标和尺寸
                const panelWorldPos = this.node.worldPosition;
                const panelSize = panelTransform.contentSize;
                
                // 将面板的世界坐标转换为屏幕坐标
                const cameraNode = find('Canvas/Camera');
                if (cameraNode) {
                    const camera = cameraNode.getComponent(Camera);
                    if (camera) {
                        // 将面板的世界坐标转换为屏幕坐标
                        const panelScreenPos = new Vec3();
                        camera.worldToScreen(panelWorldPos, panelScreenPos);
                        
                        // 计算面板在屏幕上的边界
                        const panelScreenRect = {
                            x: panelScreenPos.x - panelSize.width / 2,
                            y: panelScreenPos.y - panelSize.height / 2,
                            width: panelSize.width,
                            height: panelSize.height
                        };
                        
                        // 检查触摸位置是否在面板的屏幕坐标范围内
                        if (location.x >= panelScreenRect.x && 
                            location.x <= panelScreenRect.x + panelScreenRect.width &&
                            location.y >= panelScreenRect.y && 
                            location.y <= panelScreenRect.y + panelScreenRect.height) {
                            isInPanelArea = true;
                        }
                    }
                }
            }
        }

        // 如果不在面板区域内，且有拖拽预览，则尝试建造
        if (!isInPanelArea && this.dragPreview && this.selectedBuilding) {
            // 拖拽结束，尝试建造（不在UI元素上）
            const worldPos = this.getWorldPositionFromScreen(new Vec3(location.x, location.y, 0));
            if (worldPos && this.onBuildCallback) {
                // 标记触摸结束事件已处理（成功建造）
                this.touchEndHandled = true;
                this.onBuildCallback(building, worldPos);
                // 成功建造后，清除状态
                this.clearDragPreview();
                this.selectedBuilding = null;
                this.isDragging = false;
                event.propagationStopped = true;
                return;
            }
        }
        
        // 如果没有成功建造，清除状态
        // 注意：如果触摸结束在BuildingItem上但没有成功建造，不设置touchEndHandled
        // 这样onCanvasTouchEnd可以处理（如果事件传播到Canvas）
        this.clearDragPreview();
        this.selectedBuilding = null;
        this.isDragging = false;

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
        console.log('BuildingSelectionPanel.onBuildingItemTouchCancel: Building=', building.name, 'selectedBuilding=', this.selectedBuilding?.name, 'isDragging=', this.isDragging);
        
        if (this.selectedBuilding !== building) {
            this.clearDragPreview();
            this.selectedBuilding = null;
            this.isDragging = false;
            event.propagationStopped = true;
            return;
        }

        // 如果正在拖拽，尝试处理建造逻辑（和TOUCH_END相同的逻辑）
        if (this.isDragging && this.selectedBuilding && this.dragPreview) {
            // 检查是否发生了拖拽（移动距离超过5像素）
            const location = event.getLocation();
            const startLocation = event.getStartLocation();
            const dragDistance = Math.sqrt(
                Math.pow(location.x - startLocation.x, 2) + 
                Math.pow(location.y - startLocation.y, 2)
            );

            // 如果拖拽距离超过5像素，检查是否可以建造
            if (dragDistance > 5) {
                // 检查触摸结束位置是否在建筑物选择面板区域内
                let isInPanelArea = false;
                if (this.node && this.node.active) {
                    const panelTransform = this.node.getComponent(UITransform);
                    if (panelTransform) {
                        const panelWorldPos = this.node.worldPosition;
                        const panelSize = panelTransform.contentSize;
                        
                        const cameraNode = find('Canvas/Camera');
                        if (cameraNode) {
                            const camera = cameraNode.getComponent(Camera);
                            if (camera) {
                                const panelScreenPos = new Vec3();
                                camera.worldToScreen(panelWorldPos, panelScreenPos);
                                
                                const panelScreenRect = {
                                    x: panelScreenPos.x - panelSize.width / 2,
                                    y: panelScreenPos.y - panelSize.height / 2,
                                    width: panelSize.width,
                                    height: panelSize.height
                                };
                                
                                if (location.x >= panelScreenRect.x && 
                                    location.x <= panelScreenRect.x + panelScreenRect.width &&
                                    location.y >= panelScreenRect.y && 
                                    location.y <= panelScreenRect.y + panelScreenRect.height) {
                                    isInPanelArea = true;
                                }
                            }
                        }
                    }
                }

                // 如果不在面板区域内，尝试建造
                if (!isInPanelArea) {
                    const worldPos = this.getWorldPositionFromScreen(new Vec3(location.x, location.y, 0));
                    if (worldPos && this.onBuildCallback) {
                        console.log('BuildingSelectionPanel.onBuildingItemTouchCancel: Calling onBuildCallback');
                        // 标记触摸结束事件已处理（成功建造）
                        this.touchEndHandled = true;
                        this.onBuildCallback(building, worldPos);
                        // 成功建造后，清除状态
                        this.clearDragPreview();
                        this.selectedBuilding = null;
                        this.isDragging = false;
                        event.propagationStopped = true;
                        return;
                    }
                }
            }
        }

        // 如果没有成功建造，清除状态
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
        
        // 只禁用功能性的组件（如WarAncientTree），保留视觉组件（如Sprite）
        const disableFunctionalComponents = (node: Node) => {
            // 禁用WarAncientTree组件（防止开始生产Arrower）
            const warAncientTree = node.getComponent('WarAncientTree');
            if (warAncientTree) {
                warAncientTree.enabled = false;
            }
            
            // 禁用MoonWell组件（防止触发人口上限增加）
            const moonWell = node.getComponent('MoonWell');
            if (moonWell) {
                moonWell.enabled = false;
            }
            
            // 禁用其他可能执行逻辑的组件
            const arrower = node.getComponent('Arrower');
            if (arrower) {
                arrower.enabled = false;
            }
            
            // 递归处理子节点
            node.children.forEach(child => {
                disableFunctionalComponents(child);
            });
        };
        disableFunctionalComponents(this.dragPreview);
        
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

