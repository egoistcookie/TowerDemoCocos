import { _decorator, Component, Node, Prefab, Sprite, SpriteFrame, Label, Color, UITransform, Graphics, EventTouch, Vec3, Vec2, tween, UIOpacity, find, instantiate, Camera } from 'cc';
import { GameManager } from './GameManager';
import { GamePopup } from './GamePopup';
import { BuildingGridPanel } from './BuildingGridPanel';
import { UnitSelectionManager } from './UnitSelectionManager';
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
    private onBuildCancelCallback: (() => void) | null = null; // 建造取消/失败回调
    private canvasNode: Node = null!;
    private touchEndHandled: boolean = false; // 标记触摸结束事件是否已处理
    private gridPanel: BuildingGridPanel = null!; // 网格面板组件

    start() {
        console.debug('BuildingSelectionPanel.start: Initializing');
        this.findGameManager();
        this.findGridPanel();
        this.node.active = false; // 初始隐藏
        
        // 监听Canvas的触摸事件，用于拖拽预览和面板外点击
        this.canvasNode = find('Canvas');
        if (this.canvasNode) {
            console.debug('BuildingSelectionPanel.start: Canvas found, setting up touch listeners');
            this.canvasNode.on(Node.EventType.TOUCH_START, this.onCanvasTouchStart, this);
            this.canvasNode.on(Node.EventType.TOUCH_MOVE, this.onCanvasTouchMove, this);
            this.canvasNode.on(Node.EventType.TOUCH_END, this.onCanvasTouchEnd, this);
        } else {
            console.error('BuildingSelectionPanel.start: Canvas not found!');
        }
    }

    /**
     * 查找网格面板
     */
    findGridPanel() {
        // 先尝试查找场景中的网格面板
        let gridPanelNode = find('BuildingGridPanel');
        
        if (gridPanelNode) {
            this.gridPanel = gridPanelNode.getComponent(BuildingGridPanel);
            if (this.gridPanel) {
                return; // 成功找到，直接返回
            }
        }
        
        // 如果找不到节点或组件，尝试从TowerBuilder获取
        const towerBuilderNode = find('TowerBuilder');
        if (towerBuilderNode) {
            const towerBuilder = towerBuilderNode.getComponent('TowerBuilder') as any;
            if (towerBuilder && towerBuilder.gridPanel) {
                this.gridPanel = towerBuilder.gridPanel;
                return;
            }
        }
        
        // 如果还是找不到，创建一个新的
        const canvas = find('Canvas');
        if (canvas) {
            gridPanelNode = new Node('BuildingGridPanel');
            gridPanelNode.setParent(canvas);
            this.gridPanel = gridPanelNode.addComponent(BuildingGridPanel);
        }
    }

    onDestroy() {
        if (this.canvasNode) {
            this.canvasNode.off(Node.EventType.TOUCH_START, this.onCanvasTouchStart, this);
            this.canvasNode.off(Node.EventType.TOUCH_MOVE, this.onCanvasTouchMove, this);
            this.canvasNode.off(Node.EventType.TOUCH_END, this.onCanvasTouchEnd, this);
        }
        this.clearDragPreview();
    }

    /**
     * Canvas触摸开始事件（用于检测面板外点击）
     */
    onCanvasTouchStart(event: EventTouch) {
        // 只有当面板显示且没有正在拖拽时，才检查面板外点击
        if (this.node.active && !this.isDragging && !this.selectedBuilding) {
            console.debug('BuildingSelectionPanel.onCanvasTouchStart: Checking if touch is outside panel');
            
            const location = event.getLocation();
            let isInPanelArea = false;
            
            // 检查触摸位置是否在面板区域内
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
            
            // 如果点击在面板外，隐藏面板
            if (!isInPanelArea) {
                console.debug('BuildingSelectionPanel.onCanvasTouchStart: Touch is outside panel, hiding panel');
                this.hide();
            }
        }
    }
    
    /**
     * Canvas触摸移动事件（用于拖拽预览）
     */
    onCanvasTouchMove(event: EventTouch) {
        // 如果正在拖拽，必须处理触摸移动事件
        if (this.isDragging && this.dragPreview && this.selectedBuilding) {
            // 确保预览节点有效且可见
            if (!this.dragPreview.isValid || !this.dragPreview.active) {
                console.warn('[BuildingSelectionPanel] onCanvasTouchMove - 预览节点无效或不可见:', 'isValid=', this.dragPreview.isValid, 'active=', this.dragPreview.active);
                return;
            }
            
            // 使用 getLocation() 获取屏幕坐标（用于转换为世界坐标）
            // camera.screenToWorld 需要屏幕坐标，而不是 UI 坐标
            const location = event.getLocation();
            const screenPos = new Vec3(location.x, location.y, 0);
            
            // 转换为世界坐标
            const worldPos = this.getWorldPositionFromScreen(screenPos);
            console.info('[BuildingSelectionPanel] onCanvasTouchMove - 拖拽中, 屏幕坐标:', `(${location.x.toFixed(1)}, ${location.y.toFixed(1)})`, '世界坐标:', worldPos ? `(${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})` : 'null');
            
            if (!worldPos) {
                console.warn('[BuildingSelectionPanel] onCanvasTouchMove - 无法获取世界坐标');
                return;
            }
            
            // 确保网格面板可见
            if (!this.gridPanel) {
                this.findGridPanel();
            }
            if (this.gridPanel) {
                this.gridPanel.show();
            }
            
            // 首先确保拖拽预览位置跟随鼠标（无论是否在网格内）
            // 记录更新前的位置
            const oldPos = this.dragPreview.worldPosition.clone();
            this.dragPreview.setWorldPosition(worldPos);
            const newPos = this.dragPreview.worldPosition.clone();
            const posChanged = Math.abs(oldPos.x - newPos.x) > 0.1 || Math.abs(oldPos.y - newPos.y) > 0.1;
            if (posChanged) {
                console.info('[BuildingSelectionPanel] onCanvasTouchMove - 更新预览位置: 从', `(${oldPos.x.toFixed(1)}, ${oldPos.y.toFixed(1)})`, '到', `(${newPos.x.toFixed(1)}, ${newPos.y.toFixed(1)})`);
            }
            
            // 如果有网格面板，处理网格高亮和对齐
            if (this.gridPanel) {
                // 尝试高亮网格（如果位置在网格内）
                this.gridPanel.highlightGrid(worldPos);
                
                // 如果位置在网格内，对齐拖拽预览到网格中心
                const gridCenter = this.gridPanel.getNearestGridCenter(worldPos);
                if (gridCenter) {
                    // 更新预览位置到网格中心（对齐到网格）
                    this.dragPreview.setWorldPosition(gridCenter);
                    console.info('[BuildingSelectionPanel] onCanvasTouchMove - 对齐到网格中心:', `(${gridCenter.x.toFixed(1)}, ${gridCenter.y.toFixed(1)})`);
                } else {
                    // 如果不在网格内，清除高亮
                    this.gridPanel.clearHighlight();
                }
            }
        } else {
            // 只有在非拖拽状态下才输出调试信息，避免日志过多
            if (this.selectedBuilding || this.dragPreview) {
                console.info('[BuildingSelectionPanel] onCanvasTouchMove - 条件不满足，跳过处理: isDragging=', this.isDragging, 'dragPreview=', !!this.dragPreview, 'selectedBuilding=', !!this.selectedBuilding);
            }
        }
    }

    /**
     * Canvas触摸结束事件（处理拖拽到游戏界面中松开的情况）
     */
    onCanvasTouchEnd(event: EventTouch) {
        console.debug('BuildingSelectionPanel.onCanvasTouchEnd: touchEndHandled=', this.touchEndHandled, 'isDragging=', this.isDragging, 'selectedBuilding=', !!this.selectedBuilding, 'dragPreview=', !!this.dragPreview);
        
        // 如果触摸结束事件已经被处理（在BuildingItem上），则不处理
        if (this.touchEndHandled) {
            console.debug('BuildingSelectionPanel.onCanvasTouchEnd: Already handled, skipping');
            this.touchEndHandled = false; // 重置标志
            return;
        }

        // 如果正在拖拽且有选中的建筑物，处理建造逻辑
        if (this.isDragging && this.selectedBuilding && this.dragPreview) {
            console.debug('BuildingSelectionPanel.onCanvasTouchEnd: Processing drag end');
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
                // 检查面板是否可见（即使被隐藏，节点可能仍然存在）
                const panelOpacity = this.node.getComponent(UIOpacity);
                const isPanelVisible = this.node.active && (!panelOpacity || panelOpacity.opacity > 0) && this.node.scale.x > 0;
                
                if (isPanelVisible) {
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

                // 如果触摸位置在面板区域内，先关闭面板
                if (isInPanelArea) {
                    console.info('[BuildingSelectionPanel] onCanvasTouchEnd - 触摸位置在面板上，先关闭面板');
                    // 真正隐藏面板（设置 active = false）
                    this.node.active = false;
                    // 恢复透明度
                    if (panelOpacity) {
                        panelOpacity.opacity = 255;
                    }
                    // 恢复缩放
                    this.node.setScale(1, 1, 1);
                }

                // 尝试建造（无论是否在面板区域内，都尝试建造）
                // 这样可以处理面板关闭后，触摸位置对应的世界坐标位置
                // 优先使用拖拽预览的当前位置（已经对齐到网格中心）
                let worldPos: Vec3 | null = null;
                if (this.dragPreview) {
                    worldPos = this.dragPreview.worldPosition.clone();
                    console.info('[BuildingSelectionPanel] onCanvasTouchEnd - 使用拖拽预览位置:', `(${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})`);
                }
                
                // 如果没有拖拽预览位置，使用触摸结束位置并对齐到网格中心
                if (!worldPos) {
                    worldPos = this.getWorldPositionFromScreen(new Vec3(location.x, location.y, 0));
                    console.info('[BuildingSelectionPanel] onCanvasTouchEnd - 使用触摸位置:', worldPos ? `(${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})` : 'null');
                }
                
                // 如果有网格面板，确保对齐到网格中心
                if (worldPos && this.gridPanel) {
                    const gridCenter = this.gridPanel.getNearestGridCenter(worldPos);
                    if (gridCenter) {
                        worldPos = gridCenter;
                        console.info('[BuildingSelectionPanel] onCanvasTouchEnd - 对齐到网格中心:', `(${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})`);
                    } else {
                        console.warn('[BuildingSelectionPanel] onCanvasTouchEnd - 无法对齐到网格中心，位置不在网格内');
                        // 如果不在网格内，建造失败，退出建造模式
                        if (this.gridPanel) {
                            this.gridPanel.clearHighlight();
                        }
                        // 清除拖拽状态
                        this.clearDragPreview();
                        this.selectedBuilding = null;
                        this.isDragging = false;
                        console.info('[BuildingSelectionPanel] 位置不在可放置区域，建造失败，退出建造模式');
                        // 调用建造取消回调，退出建造模式
                        if (this.onBuildCancelCallback) {
                            this.onBuildCancelCallback();
                        }
                        return;
                    }
                }
                
                if (worldPos && this.onBuildCallback) {
                    console.info('[BuildingSelectionPanel] onCanvasTouchEnd - 调用建造回调, 位置:', `(${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})`);
                    this.onBuildCallback(this.selectedBuilding, worldPos);
                    
                    // 清除拖拽预览和状态
                    this.clearDragPreview();
                    this.selectedBuilding = null;
                    this.isDragging = false;
                    
                    // 清除网格高亮
                    if (this.gridPanel) {
                        this.gridPanel.clearHighlight();
                    }
                    
                    // 清除建筑物的选中状态（如果有）
                    this.clearBuildingSelection();
                    
                    // 阻止事件传播
                    event.propagationStopped = true;
                    return;
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
     * 设置建造取消回调（当建造失败或取消时调用）
     */
    setOnBuildCancel(callback: () => void) {
        this.onBuildCancelCallback = callback;
    }

    /**
     * 显示面板
     */
    show() {
        console.debug('BuildingSelectionPanel.show: Showing panel, buildingTypes count=', this.buildingTypes.length);
        this.node.active = true;
        
        // 恢复透明度（如果之前被隐藏）
        let opacity = this.node.getComponent(UIOpacity);
        if (opacity) {
            opacity.opacity = 255;
        }
        
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
     * 仅隐藏面板UI（不清除拖拽状态和预览）
     * 用于拖拽时隐藏面板但保留拖拽预览
     * 注意：不真正隐藏节点（active = false），而是使用透明度，确保触摸事件能够继续传递
     */
    hidePanelOnly() {
        console.info('[BuildingSelectionPanel] 隐藏面板UI - isDragging:', this.isDragging, 'dragPreview:', !!this.dragPreview, 'selectedBuilding:', !!this.selectedBuilding);
        
        // 使用透明度隐藏面板，而不是真正隐藏节点
        // 这样可以确保触摸事件能够继续传递到 Canvas
        let opacity = this.node.getComponent(UIOpacity);
        if (!opacity) {
            opacity = this.node.addComponent(UIOpacity);
        }
        
        tween(opacity)
            .to(0.2, { opacity: 0 }, { easing: 'backIn' })
            .call(() => {
                // 设置缩放为0，让面板不可见，但不设置 active = false
                // 这样可以确保触摸事件能够继续传递
                this.node.setScale(0, 1, 1);
                console.info('[BuildingSelectionPanel] 面板已隐藏 - isDragging:', this.isDragging, 'dragPreview:', !!this.dragPreview, 'selectedBuilding:', !!this.selectedBuilding);
            })
            .start();
    }

    /**
     * 更新面板内容
     */
    updatePanel() {
        console.debug('BuildingSelectionPanel.updatePanel: Updating panel with', this.buildingTypes.length, 'buildings');
        
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
            console.debug('BuildingSelectionPanel.updatePanel: Added item', building.name, 'to panel');
        });
        
        console.debug('BuildingSelectionPanel.updatePanel: Panel updated, children count=', this.panelContent.children.length);
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
        console.debug('BuildingSelectionPanel.createBuildingItem: Creating item for', building.name);
        item.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
            console.debug('BuildingSelectionPanel: TOUCH_START event received on', building.name);
            this.onBuildingItemTouchStart(building, event);
        }, this);

        item.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
            console.debug('BuildingSelectionPanel: TOUCH_MOVE event received on', building.name);
            this.onBuildingItemTouchMove(building, event);
        }, this);

        item.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            console.debug('BuildingSelectionPanel: TOUCH_END event received on', building.name);
            this.onBuildingItemTouchEnd(building, event);
        }, this);

        item.on(Node.EventType.TOUCH_CANCEL, (event: EventTouch) => {
            console.debug('BuildingSelectionPanel: TOUCH_CANCEL event received on', building.name);
            this.onBuildingItemTouchCancel(building, event);
        }, this);

        console.debug('BuildingSelectionPanel.createBuildingItem: Item created, UITransform size=', transform.contentSize);
        return item;
    }

    /**
     * 建筑物选项触摸开始
     */
    onBuildingItemTouchStart(building: BuildingType, event: EventTouch) {
        console.info('[BuildingSelectionPanel] 触摸开始 - 建筑物:', building.name);
        
        // 检查金币是否足够
        if (this.gameManager && !this.gameManager.canAfford(building.cost)) {
            GamePopup.showMessage('金币不足');
            return;
        }

        this.selectedBuilding = building;
        this.isDragging = false;
        this.touchEndHandled = false; // 重置标志
        console.info('[BuildingSelectionPanel] 设置选中状态 - selectedBuilding:', building.name, 'isDragging:', this.isDragging);

        // 显示网格面板
        if (this.gridPanel) {
            this.gridPanel.show();
        } else {
            this.findGridPanel();
            if (this.gridPanel) {
                this.gridPanel.show();
            }
        }

        // 创建拖拽预览（初始位置在触摸点）
        const location = event.getLocation();
        this.createDragPreview(building, new Vec3(location.x, location.y, 0));
        console.info('[BuildingSelectionPanel] 创建拖拽预览完成 - dragPreview:', !!this.dragPreview);

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

        // 使用屏幕坐标来计算拖拽距离和转换为世界坐标
        const location = event.getLocation();
        const startLocation = event.getStartLocation();
        const dragDistance = Math.sqrt(
            Math.pow(location.x - startLocation.x, 2) + 
            Math.pow(location.y - startLocation.y, 2)
        );
        
        // 如果移动距离超过10像素，认为是拖拽
        if (dragDistance > 10) {
            if (!this.isDragging) {
                console.info('[BuildingSelectionPanel] 开始拖拽建筑物:', building.name, 'isDragging:', this.isDragging, 'dragPreview:', !!this.dragPreview);
                this.isDragging = true;
                
                // 确保网格面板可见
                if (!this.gridPanel) {
                    this.findGridPanel();
                }
                if (this.gridPanel) {
                    this.gridPanel.show();
                }
                
                // 立即更新拖拽预览位置，确保它跟随鼠标（使用屏幕坐标）
                const worldPos = this.getWorldPositionFromScreen(new Vec3(location.x, location.y, 0));
                if (worldPos && this.dragPreview) {
                    this.dragPreview.setWorldPosition(worldPos);
                    console.info('[BuildingSelectionPanel] 拖拽开始时更新预览位置:', `(${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})`);
                } else {
                    console.warn('[BuildingSelectionPanel] 无法更新预览位置 - worldPos:', !!worldPos, 'dragPreview:', !!this.dragPreview);
                }
                
                // 延迟隐藏面板，确保触摸事件能够继续传递到 Canvas
                // 使用 scheduleOnce 延迟一帧，让触摸事件能够正确传递
                this.scheduleOnce(() => {
                    this.hidePanelOnly();
                    console.info('[BuildingSelectionPanel] 面板已隐藏, isDragging:', this.isDragging, 'dragPreview:', !!this.dragPreview, 'selectedBuilding:', !!this.selectedBuilding);
                }, 0);
            }
            
            // 如果已经开始拖拽，同时更新预览位置（作为备用，主要依赖Canvas的触摸事件）
            // 这样可以确保即使BuildingItem的触摸事件中断，预览位置也能更新
            if (this.isDragging && this.dragPreview) {
                this.updateDragPreview(new Vec3(location.x, location.y, 0));
            }
        } else {
            // 即使移动距离不够，也要更新拖拽预览位置，确保它跟随鼠标（使用屏幕坐标）
            if (this.dragPreview) {
                const worldPos = this.getWorldPositionFromScreen(new Vec3(location.x, location.y, 0));
                if (worldPos) {
                    this.dragPreview.setWorldPosition(worldPos);
                }
            }
        }
        
        // 不阻止事件传播，让Canvas也能接收到触摸移动事件
        // 这样即使BuildingItem的触摸事件中断，Canvas的触摸事件仍然可以工作
        // event.propagationStopped = true;
    }

    /**
     * 建筑物选项触摸结束
     */
    onBuildingItemTouchEnd(building: BuildingType, event: EventTouch) {
        console.debug('BuildingSelectionPanel.onBuildingItemTouchEnd: Building=', building.name, 'selectedBuilding=', this.selectedBuilding?.name);
        
        if (this.selectedBuilding !== building) {
            console.debug('BuildingSelectionPanel.onBuildingItemTouchEnd: Selected building mismatch');
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
        // 检查面板是否可见（即使被隐藏，节点可能仍然存在）
        const panelOpacity = this.node.getComponent(UIOpacity);
        const isPanelVisible = this.node.active && (!panelOpacity || panelOpacity.opacity > 0) && this.node.scale.x > 0;
        
        if (isPanelVisible) {
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

        // 如果触摸位置在面板区域内，先关闭面板
        if (isInPanelArea) {
            console.info('[BuildingSelectionPanel] onBuildingItemTouchEnd - 触摸位置在面板上，先关闭面板');
            // 真正隐藏面板（设置 active = false）
            this.node.active = false;
            // 恢复透明度
            if (panelOpacity) {
                panelOpacity.opacity = 255;
            }
            // 恢复缩放
            this.node.setScale(1, 1, 1);
        }

        // 尝试建造（无论是否在面板区域内，都尝试建造）
        // 这样可以处理面板关闭后，触摸位置对应的世界坐标位置
        if (this.dragPreview && this.selectedBuilding) {
            // 优先使用拖拽预览的当前位置（已经对齐到网格中心）
            let worldPos: Vec3 | null = null;
            if (this.dragPreview) {
                worldPos = this.dragPreview.worldPosition.clone();
                console.info('[BuildingSelectionPanel] onBuildingItemTouchEnd - 使用拖拽预览位置:', `(${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})`);
            }
            
            // 如果没有拖拽预览位置，使用触摸结束位置并对齐到网格中心
            if (!worldPos) {
                worldPos = this.getWorldPositionFromScreen(new Vec3(location.x, location.y, 0));
                console.info('[BuildingSelectionPanel] onBuildingItemTouchEnd - 使用触摸位置:', worldPos ? `(${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})` : 'null');
            }
            
            // 如果有网格面板，确保对齐到网格中心
            if (worldPos && this.gridPanel) {
                const gridCenter = this.gridPanel.getNearestGridCenter(worldPos);
                if (gridCenter) {
                    worldPos = gridCenter;
                    console.info('[BuildingSelectionPanel] onBuildingItemTouchEnd - 对齐到网格中心:', `(${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})`);
                } else {
                    console.warn('[BuildingSelectionPanel] onBuildingItemTouchEnd - 无法对齐到网格中心，位置不在网格内');
                    // 如果不在网格内，建造失败，退出建造模式
                    if (this.gridPanel) {
                        this.gridPanel.clearHighlight();
                    }
                    this.clearDragPreview();
                    this.selectedBuilding = null;
                    this.isDragging = false;
                    console.info('[BuildingSelectionPanel] 位置不在可放置区域，建造失败，退出建造模式');
                    // 调用建造取消回调，退出建造模式
                    if (this.onBuildCancelCallback) {
                        this.onBuildCancelCallback();
                    }
                    event.propagationStopped = true;
                    return;
                }
            }
            
            if (worldPos && this.onBuildCallback) {
                // 标记触摸结束事件已处理（成功建造）
                this.touchEndHandled = true;
                console.info('[BuildingSelectionPanel] onBuildingItemTouchEnd - 调用建造回调, 位置:', `(${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})`);
                this.onBuildCallback(building, worldPos);
                // 成功建造后，清除状态
                this.clearDragPreview();
                this.selectedBuilding = null;
                this.isDragging = false;
                
                // 清除建筑物的选中状态（如果有）
                this.clearBuildingSelection();
                
                event.propagationStopped = true;
                return;
            }
        }
        
        // 如果没有成功建造，清除状态并重新显示面板
        // 注意：如果触摸结束在BuildingItem上但没有成功建造，不设置touchEndHandled
        // 这样onCanvasTouchEnd可以处理（如果事件传播到Canvas）
        this.clearDragPreview();
        this.selectedBuilding = null;
        this.isDragging = false;
        
        // 重新显示建筑物选择面板，让用户可以选择其他建筑物
        console.info('[BuildingSelectionPanel] 拖拽取消，重新显示建筑物选择面板');
        this.show();
        
        // 阻止事件传播
        event.propagationStopped = true;
    }

    /**
     * 建筑物选项触摸取消
     */
    onBuildingItemTouchCancel(building: BuildingType, event: EventTouch) {
        console.debug('BuildingSelectionPanel.onBuildingItemTouchCancel: Building=', building.name, 'selectedBuilding=', this.selectedBuilding?.name, 'isDragging=', this.isDragging);
        
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
                // 检查面板是否可见（即使被隐藏，节点可能仍然存在）
                const panelOpacity = this.node.getComponent(UIOpacity);
                const isPanelVisible = this.node.active && (!panelOpacity || panelOpacity.opacity > 0) && this.node.scale.x > 0;
                
                if (isPanelVisible) {
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

                // 如果触摸位置在面板区域内，先关闭面板
                if (isInPanelArea) {
                    console.info('[BuildingSelectionPanel] onBuildingItemTouchCancel - 触摸位置在面板上，先关闭面板');
                    // 真正隐藏面板（设置 active = false）
                    this.node.active = false;
                    // 恢复透明度
                    if (panelOpacity) {
                        panelOpacity.opacity = 255;
                    }
                    // 恢复缩放
                    this.node.setScale(1, 1, 1);
                }

                // 尝试建造（无论是否在面板区域内，都尝试建造）
                // 这样可以处理面板关闭后，触摸位置对应的世界坐标位置
                // 优先使用拖拽预览的当前位置（已经对齐到网格中心）
                let worldPos: Vec3 | null = null;
                if (this.dragPreview) {
                    worldPos = this.dragPreview.worldPosition.clone();
                    console.info('[BuildingSelectionPanel] onBuildingItemTouchCancel - 使用拖拽预览位置:', `(${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})`);
                }
                
                // 如果没有拖拽预览位置，使用触摸结束位置并对齐到网格中心
                if (!worldPos) {
                    worldPos = this.getWorldPositionFromScreen(new Vec3(location.x, location.y, 0));
                    console.info('[BuildingSelectionPanel] onBuildingItemTouchCancel - 使用触摸位置:', worldPos ? `(${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})` : 'null');
                }
                
                // 如果有网格面板，确保对齐到网格中心
                if (worldPos && this.gridPanel) {
                    const gridCenter = this.gridPanel.getNearestGridCenter(worldPos);
                    if (gridCenter) {
                        worldPos = gridCenter;
                        console.info('[BuildingSelectionPanel] onBuildingItemTouchCancel - 对齐到网格中心:', `(${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})`);
                    } else {
                        console.warn('[BuildingSelectionPanel] onBuildingItemTouchCancel - 无法对齐到网格中心，位置不在网格内');
                        // 如果不在网格内，建造失败，退出建造模式
                        if (this.gridPanel) {
                            this.gridPanel.clearHighlight();
                        }
                        this.clearDragPreview();
                        this.selectedBuilding = null;
                        this.isDragging = false;
                        console.info('[BuildingSelectionPanel] 位置不在可放置区域，建造失败，退出建造模式');
                        // 调用建造取消回调，退出建造模式
                        if (this.onBuildCancelCallback) {
                            this.onBuildCancelCallback();
                        }
                        event.propagationStopped = true;
                        return;
                    }
                }
                
                if (worldPos && this.onBuildCallback) {
                    console.info('[BuildingSelectionPanel] onBuildingItemTouchCancel - 调用建造回调, 位置:', `(${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})`);
                    // 标记触摸结束事件已处理（成功建造）
                    this.touchEndHandled = true;
                    this.onBuildCallback(building, worldPos);
                    // 成功建造后，清除状态
                    this.clearDragPreview();
                    this.selectedBuilding = null;
                    this.isDragging = false;
                    
                    // 清除建筑物的选中状态（如果有）
                    this.clearBuildingSelection();
                    
                    event.propagationStopped = true;
                    return;
                }
            }
        }

        // 如果没有成功建造，清除状态并重新显示面板
        this.clearDragPreview();
        this.selectedBuilding = null;
        this.isDragging = false;
        
        // 重新显示建筑物选择面板，让用户可以选择其他建筑物
        console.info('[BuildingSelectionPanel] 拖拽取消，重新显示建筑物选择面板');
        this.show();
        
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
        console.info('[BuildingSelectionPanel] 创建拖拽预览节点:', this.dragPreview.name);
        
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
        
        // 设置父节点到Canvas，确保它不受面板隐藏影响
        const canvas = find('Canvas');
        if (canvas) {
            this.dragPreview.setParent(canvas);
            console.info('[BuildingSelectionPanel] 拖拽预览已添加到Canvas');
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
            console.info('[BuildingSelectionPanel] 拖拽预览初始位置:', `(${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})`);
        }
    }

    /**
     * 更新拖拽预览位置
     */
    updateDragPreview(screenPos: Vec3) {
        if (!this.dragPreview) {
            console.warn('[BuildingSelectionPanel] updateDragPreview - dragPreview不存在');
            return;
        }

        // 确保预览节点有效且可见
        if (!this.dragPreview.isValid || !this.dragPreview.active) {
            console.warn('[BuildingSelectionPanel] updateDragPreview - 预览节点无效或不可见:', 'isValid=', this.dragPreview.isValid, 'active=', this.dragPreview.active);
            return;
        }

        // 确保网格面板可见
        if (!this.gridPanel) {
            this.findGridPanel();
        }
        
        // 首先更新拖拽预览位置，让它始终跟随鼠标（无论是否有网格面板）
        const worldPos = this.getWorldPositionFromScreen(screenPos);
        if (!worldPos) {
            console.warn('[BuildingSelectionPanel] updateDragPreview - 无法获取世界坐标');
            return;
        }
        
        // 记录更新前的位置
        const oldPos = this.dragPreview.worldPosition.clone();
        
        // 无论是否在网格内，都要更新拖拽预览的位置，让它始终跟随鼠标
        this.dragPreview.setWorldPosition(worldPos);
        
        // 验证位置是否真的更新了
        const newPos = this.dragPreview.worldPosition.clone();
        const posChanged = Math.abs(oldPos.x - newPos.x) > 0.1 || Math.abs(oldPos.y - newPos.y) > 0.1;
        if (posChanged) {
            console.info('[BuildingSelectionPanel] updateDragPreview - 预览位置已更新: 从', `(${oldPos.x.toFixed(1)}, ${oldPos.y.toFixed(1)})`, '到', `(${newPos.x.toFixed(1)}, ${newPos.y.toFixed(1)})`);
        }
        
        // 处理网格高亮（如果有网格面板）
        if (this.gridPanel) {
            this.gridPanel.show();
            
            // 尝试高亮网格（如果位置在网格内）
            this.gridPanel.highlightGrid(worldPos);
            
            // 如果位置在网格内，对齐到网格中心
            const gridCenter = this.gridPanel.getNearestGridCenter(worldPos);
            if (gridCenter) {
                this.dragPreview.setWorldPosition(gridCenter);
                console.info('[BuildingSelectionPanel] updateDragPreview - 对齐到网格中心:', `(${gridCenter.x.toFixed(1)}, ${gridCenter.y.toFixed(1)})`);
            } else {
                // 如果不在网格内，清除高亮
                this.gridPanel.clearHighlight();
            }
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
        
        // 清除网格高亮（但不隐藏网格面板，因为可能还在建造模式）
        if (this.gridPanel) {
            this.gridPanel.clearHighlight();
        }
    }
    
    /**
     * 清除建筑物的选中状态
     */
    clearBuildingSelection() {
        // 清除UnitSelectionManager的选择
        const unitSelectionManagerNode = find('UnitSelectionManager');
        if (unitSelectionManagerNode) {
            const unitSelectionManager = unitSelectionManagerNode.getComponent(UnitSelectionManager);
            if (unitSelectionManager) {
                console.debug('BuildingSelectionPanel.clearBuildingSelection: 清除UnitSelectionManager的选中状态');
                unitSelectionManager.clearSelection();
            }
        } else {
            // 如果找不到UnitSelectionManager节点，尝试在场景中查找组件
            const scene = this.node.scene;
            if (scene) {
                const unitSelectionManager = scene.getComponentInChildren(UnitSelectionManager);
                if (unitSelectionManager) {
                    console.debug('BuildingSelectionPanel.clearBuildingSelection: 在场景中找到UnitSelectionManager，清除选中状态');
                    unitSelectionManager.clearSelection();
                }
            }
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

