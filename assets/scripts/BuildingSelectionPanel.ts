import { _decorator, Component, Node, Prefab, Sprite, SpriteFrame, Label, Color, UITransform, Graphics, EventTouch, Vec3, Vec2, tween, UIOpacity, find, instantiate, Camera } from 'cc';
import { GameManager } from './GameManager';
import { GamePopup } from './GamePopup';
import { BuildingGridPanel } from './BuildingGridPanel';
import { StoneWallGridPanel } from './StoneWallGridPanel';
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
    private stoneWallGridPanel: StoneWallGridPanel = null!; // 石墙网格面板组件
    private lastIsDragging: boolean = false; // 上一帧的拖拽状态，用于检测状态变化

    start() {
        this.findGameManager();
        this.findGridPanel();
        this.node.active = false; // 初始隐藏
        
        // 监听Canvas的触摸事件，用于拖拽预览和面板外点击
        this.canvasNode = find('Canvas');
        if (this.canvasNode) {
            this.canvasNode.on(Node.EventType.TOUCH_START, this.onCanvasTouchStart, this);
            this.canvasNode.on(Node.EventType.TOUCH_MOVE, this.onCanvasTouchMove, this);
            this.canvasNode.on(Node.EventType.TOUCH_END, this.onCanvasTouchEnd, this);
        } else {
        }
        
        this.lastIsDragging = this.isDragging;
    }
    
    /**
     * 每帧更新，检测拖拽状态变化并清除高亮
     */
    update() {
        // 检测拖拽状态从 true 变为 false，说明触摸结束
        if (this.lastIsDragging && !this.isDragging) {
            this.clearGridHighlight();
        }
        this.lastIsDragging = this.isDragging;
    }
    
    /**
     * 清除网格高亮的辅助方法
     */
    private clearGridHighlight() {
        
        // 清除普通网格高亮
        if (!this.gridPanel) {
            this.findGridPanel();
        }
        if (this.gridPanel) {
            this.gridPanel.clearHighlight();
        } else {
        }
        
        // 清除石墙网格高亮
        if (!this.stoneWallGridPanel) {
            this.findStoneWallGridPanel();
        }
        if (this.stoneWallGridPanel) {
            this.stoneWallGridPanel.clearHighlight();
        } else {
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

    /**
     * 查找石墙网格面板
     */
    findStoneWallGridPanel() {
        // 先尝试查找场景中的石墙网格面板
        let stoneWallGridPanelNode = find('StoneWallGridPanel');
        
        if (stoneWallGridPanelNode) {
            this.stoneWallGridPanel = stoneWallGridPanelNode.getComponent(StoneWallGridPanel);
            if (this.stoneWallGridPanel) {
                return; // 成功找到，直接返回
            }
        }
        
        // 如果找不到节点或组件，尝试从TowerBuilder获取
        const towerBuilderNode = find('TowerBuilder');
        if (towerBuilderNode) {
            const towerBuilder = towerBuilderNode.getComponent('TowerBuilder') as any;
            if (towerBuilder && towerBuilder.stoneWallGridPanelComponent) {
                this.stoneWallGridPanel = towerBuilder.stoneWallGridPanelComponent;
                return;
            }
        }
        
        // 如果还是找不到，创建一个新的
        const canvas = find('Canvas');
        if (canvas) {
            stoneWallGridPanelNode = new Node('StoneWallGridPanel');
            stoneWallGridPanelNode.setParent(canvas);
            this.stoneWallGridPanel = stoneWallGridPanelNode.addComponent(StoneWallGridPanel);
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
        // 如果面板刚刚显示，忽略这次触摸事件（避免建造按钮点击触发隐藏）
        if ((this.node as any)._justShown) {
            return;
        }
        
        // 只有当面板显示且没有正在拖拽时，才检查面板外点击
        if (this.node.active && !this.isDragging && !this.selectedBuilding) {
            const targetNode = event.target as Node;
            
            // 检查点击目标是否是建造按钮或UI元素，如果是，不隐藏面板
            if (this.isUIElement(targetNode)) {
                // 阻止事件传播，避免触发其他逻辑
                event.propagationStopped = true;
                return;
            }
            
            const location = event.getLocation();
            let isInPanelArea = false;
            
            // 检查触摸位置是否在面板区域内
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
            
            // 如果点击在面板外，延迟隐藏面板（避免与按钮点击冲突）
            if (!isInPanelArea) {
                // 保存延迟回调的引用，以便在show()时取消
                const hideCallback = () => {
                    // 再次检查面板是否仍然显示且没有选中建筑物，并且不在保护期内
                    if (this.node.active && !this.isDragging && !this.selectedBuilding && !(this.node as any)._justShown) {
                        this.hide();
                    }
                };
                (this.node as any)._pendingHideCallback = hideCallback;
                this.scheduleOnce(hideCallback, 0.3);
            }
        }
    }
    
    /**
     * 检查节点是否是UI元素（按钮、面板等）
     */
    private isUIElement(node: Node | null): boolean {
        if (!node) return false;
        
        // 检查节点名称
        const nodeName = node.name;
        if (nodeName === 'BuildButton' || 
            nodeName === 'UI' || 
            nodeName === 'UIManager' ||
            nodeName.includes('Button') ||
            nodeName.includes('Panel') ||
            nodeName.includes('Label')) {
            return true;
        }
        
        // 递归检查父节点
        if (node.parent) {
            return this.isUIElement(node.parent);
        }
        
        return false;
    }
    
    /**
     * Canvas触摸移动事件（用于拖拽预览）
     */
    onCanvasTouchMove(event: EventTouch) {
        // 如果不在拖拽状态，确保清除高亮并返回
        if (!this.isDragging) {
            this.clearGridHighlight();
            return;
        }
        
        
        // 如果正在拖拽，必须处理触摸移动事件
        if (this.dragPreview && this.selectedBuilding) {
            // 确保预览节点有效且可见
            if (!this.dragPreview.isValid || !this.dragPreview.active) {
                return;
            }
            
            // 使用 getLocation() 获取屏幕坐标
            const location = event.getLocation();
            const screenPos = new Vec3(location.x, location.y, 0);
            
            // 判断是否是石墙或哨塔（都使用石墙网格）
            const isStoneWall = this.selectedBuilding.name === '石墙';
            const isWatchTower = this.selectedBuilding.name === '哨塔';
            const useStoneWallGrid = isStoneWall || isWatchTower;
            
            // 根据建筑类型选择对应的网格面板
            if (useStoneWallGrid) {
                // 石墙和哨塔使用石墙网格面板（现在使用世界坐标，与BuildingGridPanel一致）
                if (!this.stoneWallGridPanel) {
                    this.findStoneWallGridPanel();
                }
                if (this.stoneWallGridPanel) {
                    this.stoneWallGridPanel.show();
                }
                
                // 将屏幕坐标转换为世界坐标（与普通建筑物一致）
                const worldPos = this.getWorldPositionFromScreen(screenPos);
                if (!worldPos) {
                    return;
                }
                
                // 更新拖拽预览位置跟随鼠标
                this.dragPreview.setWorldPosition(worldPos); 
                
                // 如果有石墙网格面板，处理网格高亮和对齐
                if (this.stoneWallGridPanel) {
                    
                    // 尝试高亮石墙网格（如果位置在网格内）
                    this.stoneWallGridPanel.highlightGrid(worldPos);
                    
                    // 如果位置在石墙网格内，对齐拖拽预览到网格中心
                    const gridCenter = this.stoneWallGridPanel.getNearestGridCenter(worldPos);
                    if (gridCenter) {
                        // 更新预览位置到网格中心（对齐到网格）
                        this.dragPreview.setWorldPosition(gridCenter);
                    } else {
                        // 如果不在石墙网格内，清除高亮
                        this.stoneWallGridPanel.clearHighlight();
                    }
                } else {
                }
            } else {
                // 其他建筑使用普通网格面板
                if (!this.gridPanel) {
                    this.findGridPanel();
                }
                if (this.gridPanel) {
                    this.gridPanel.show();
                }
                
                // 将屏幕坐标转换为世界坐标
                const worldPos = this.getWorldPositionFromScreen(screenPos);
                if (!worldPos) {
                    return;
                }
                
                // 更新拖拽预览位置跟随鼠标
                this.dragPreview.setWorldPosition(worldPos);
                
                // 如果有普通网格面板，处理网格高亮和对齐
                if (this.gridPanel) {
                    
                    // 尝试高亮普通网格（如果位置在网格内）
                    this.gridPanel.highlightGrid(worldPos);
                    
                    // 如果位置在普通网格内，对齐拖拽预览到网格中心
                    const gridCenter = this.gridPanel.getNearestGridCenter(worldPos);
                    if (gridCenter) {
                        // 更新预览位置到网格中心（对齐到网格）
                        this.dragPreview.setWorldPosition(gridCenter);
                    } else {
                        // 如果不在普通网格内，清除高亮
                        this.gridPanel.clearHighlight();
                    }
                } else {
                }
            }
        }
    }

    /**
     * Canvas触摸结束事件（处理拖拽到游戏界面中松开的情况）
     */
    onCanvasTouchEnd(event: EventTouch) {
        const location = event.getLocation();
        const targetNode = event.target as Node;
        
        // 无论什么情况，都先清除网格高亮
        this.clearGridHighlight();
        
        // 如果触摸结束事件已经被处理（在BuildingItem上），则不处理
        if (this.touchEndHandled) {
            this.touchEndHandled = false; // 重置标志
            return;
        }

        // 如果正在拖拽且有选中的建筑物，处理建造逻辑
        if (this.isDragging && this.selectedBuilding && this.dragPreview) {
            // 立即停止拖拽状态，防止触摸移动事件继续处理
            this.isDragging = false;
            this.clearGridHighlight();
            
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
                    this.node.active = false;
                    if (panelOpacity) {
                        panelOpacity.opacity = 255;
                    }
                    this.node.setScale(1, 1, 1);
                }

                // 优先使用拖拽预览的当前位置（已经对齐到网格中心）
                let worldPos: Vec3 | null = null;
                if (this.dragPreview) {
                    worldPos = this.dragPreview.worldPosition.clone();
                }
                
                // 如果没有拖拽预览位置，使用触摸结束位置并对齐到网格中心
                if (!worldPos) {
                    worldPos = this.getWorldPositionFromScreen(new Vec3(location.x, location.y, 0));
                }
                
                // 判断是否是石墙或哨塔（都使用石墙网格）
                const isStoneWall = this.selectedBuilding.name === '石墙';
                const isWatchTower = this.selectedBuilding.name === '哨塔';
                const useStoneWallGrid = isStoneWall || isWatchTower;
                
                // 根据建筑类型选择对应的网格面板进行对齐
                if (worldPos) {
                    if (useStoneWallGrid) {
                        // 石墙和哨塔使用石墙网格面板
                        if (!this.stoneWallGridPanel) {
                            this.findStoneWallGridPanel();
                        }
                        
                        if (this.stoneWallGridPanel) {
                            const gridCenter = this.stoneWallGridPanel.getNearestGridCenter(worldPos);
                            if (gridCenter) {
                                // 检查目标网格是否被占用
                                const grid = this.stoneWallGridPanel.worldToGrid(gridCenter);
                                if (grid && !this.stoneWallGridPanel.isGridOccupied(grid.x, grid.y)) {
                                    worldPos = gridCenter;
                                } else {
                                    // 网格被占用，建造失败
                                    this.clearDragPreview();
                                    this.selectedBuilding = null;
                                    this.clearGridHighlight();
                                    if (this.onBuildCancelCallback) {
                                        this.onBuildCancelCallback();
                                    }
                                    return;
                                }
                            } else {
                                // 石墙和哨塔必须建造在石墙网格内，否则建造失败
                                this.clearDragPreview();
                                this.selectedBuilding = null;
                                // 确保清除网格高亮
                                this.clearGridHighlight();
                                if (this.onBuildCancelCallback) {
                                    this.onBuildCancelCallback();
                                }
                                return;
                            }
                        } else {
                            // 没有石墙网格面板，建造失败
                            this.clearDragPreview();
                            this.selectedBuilding = null;
                            if (this.onBuildCancelCallback) {
                                this.onBuildCancelCallback();
                            }
                            return;
                        }
                    } else {
                        // 其他建筑使用普通网格面板
                        if (this.gridPanel) {
                            const gridCenter = this.gridPanel.getNearestGridCenter(worldPos);
                            if (gridCenter) {
                                worldPos = gridCenter;
                            } else {
                                // 其他建筑物必须在普通网格内，否则建造失败
                                this.clearDragPreview();
                                this.selectedBuilding = null;
                                // 确保清除网格高亮
                                this.clearGridHighlight();
                                if (this.onBuildCancelCallback) {
                                    this.onBuildCancelCallback();
                                }
                                return;
                            }
                        } else {
                            // 没有普通网格面板，建造失败
                            this.clearDragPreview();
                            this.selectedBuilding = null;
                            if (this.onBuildCancelCallback) {
                                this.onBuildCancelCallback();
                            }
                            return;
                        }
                    }
                }
                
                if (worldPos && this.onBuildCallback) {
                this.onBuildCallback(this.selectedBuilding, worldPos);
                
                // 清除拖拽预览和状态
                this.clearDragPreview();
                this.selectedBuilding = null;
                
                // 再次确保清除网格高亮
                if (this.gridPanel) {
                    this.gridPanel.clearHighlight();
                }
                if (this.stoneWallGridPanel) {
                    this.stoneWallGridPanel.clearHighlight();
                }
                
                // 立即清除建筑物的选中状态（如果有）
                this.clearBuildingSelection();
                
                // 延迟一帧再次清除选中状态和网格高亮，确保建筑物创建完成后清除
                this.scheduleOnce(() => {
                    this.clearBuildingSelection();
                    if (this.gridPanel) {
                        this.gridPanel.clearHighlight();
                    }
                    if (this.stoneWallGridPanel) {
                        this.stoneWallGridPanel.clearHighlight();
                    }
                }, 0);
                
                // 阻止事件传播
                event.propagationStopped = true;
                return;
            }
            } else {
                // 拖拽距离不够，清除状态
                this.clearDragPreview();
                this.selectedBuilding = null;
                this.clearGridHighlight();
            }
        } else if (this.isDragging || this.selectedBuilding) {
            // 如果之前有拖拽状态但触摸结束时条件不满足，也要清除高亮
            this.isDragging = false;
            this.selectedBuilding = null;
            this.clearGridHighlight();
        } else {
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
        // 先取消所有延迟回调，防止之前的延迟隐藏回调执行
        this.unscheduleAllCallbacks();
        
        // 清除待执行的隐藏回调引用
        (this.node as any)._pendingHideCallback = null;
        
        // 先标记面板刚刚显示，忽略下一次触摸事件（避免建造按钮点击触发隐藏）
        // 必须在设置 active 之前设置，确保触摸事件触发时能检查到
        (this.node as any)._justShown = true;
        
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
        
        // 0.5秒后清除保护标记（给足够的时间让按钮点击事件处理完成）
        this.scheduleOnce(() => {
            (this.node as any)._justShown = false;
        }, 0.5);
    }

    /**
     * 隐藏面板
     */
    hide() {
        // 检查是否在保护期内，如果是，不隐藏
        if ((this.node as any)._justShown) {
            return;
        }
        
        // 如果面板已经隐藏，不需要再次隐藏
        if (!this.node.active) {
            return;
        }
        
        tween(this.node)
            .to(0.2, { scale: new Vec3(0, 1, 1) }, { easing: 'backIn' })
            .call(() => {
                this.node.active = false;
                this.selectedBuilding = null;
                this.clearDragPreview();
            })
            .start();
        
        // 关闭建造模式// 如果找不到节点或组件，尝试从TowerBuilder获取
        const towerBuilderNode = find('Canvas/TowerBuilder');
        if (towerBuilderNode) {
            const towerBuilder = towerBuilderNode.getComponent('TowerBuilder') as any;
            if (towerBuilder) {
                towerBuilder.isBuildingMode = false;
                towerBuilder.currentSelectedBuilding = null;
            }
        }
    }

    /**
     * 仅隐藏面板UI（不清除拖拽状态和预览）
     * 用于拖拽时隐藏面板但保留拖拽预览
     * 注意：不真正隐藏节点（active = false），而是使用透明度，确保触摸事件能够继续传递
     */
    hidePanelOnly() {
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
            const location = event.getLocation();
            const targetNode = event.target as Node;
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
            GamePopup.showMessage('金币不足');
            return;
        }

        this.selectedBuilding = building;
        this.isDragging = false;
        this.touchEndHandled = false; // 重置标志

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
                }
                
                // 延迟隐藏面板，确保触摸事件能够继续传递到 Canvas
                this.scheduleOnce(() => {
                    this.hidePanelOnly();
                }, 0);
            }
            
            // 如果已经开始拖拽，同时更新预览位置（作为备用，主要依赖Canvas的触摸事件）
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
        const location = event.getLocation();
        const startLocation = event.getStartLocation();
        const dragDistance = Math.sqrt(
            Math.pow(location.x - startLocation.x, 2) + 
            Math.pow(location.y - startLocation.y, 2)
        );
        const targetNode = event.target as Node;
        
        
        // 无论什么情况，都先清除网格高亮
        this.clearGridHighlight();
        
        // 延迟一帧再次清除，确保清除完成
        this.scheduleOnce(() => {
            this.clearGridHighlight();
        }, 0);
        
        if (this.selectedBuilding !== building) {
            return;
        }

        // 检查是否发生了拖拽（移动距离超过5像素）
        // location, startLocation, dragDistance 已在方法开头声明

        // 立即停止拖拽状态，防止触摸移动事件继续处理
        this.isDragging = false;
        this.clearGridHighlight();

        // 如果没有发生拖拽，不处理
        if (dragDistance <= 5) {
            this.clearDragPreview();
            this.selectedBuilding = null;
            event.propagationStopped = true;
            return;
        }

        // 检查触摸结束位置是否在建筑物选择面板区域内
        let isInPanelArea = false;
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
            this.node.active = false;
            if (panelOpacity) {
                panelOpacity.opacity = 255;
            }
            this.node.setScale(1, 1, 1);
        }

        // 尝试建造
        if (this.dragPreview && this.selectedBuilding) {
            // 优先使用拖拽预览的当前位置（已经对齐到网格中心）
            let buildPos: Vec3 | null = null;
            
            // 判断是否是石墙或哨塔（都使用石墙网格）
            const isStoneWall = this.selectedBuilding && this.selectedBuilding.name === '石墙';
            const isWatchTower = this.selectedBuilding && this.selectedBuilding.name === '哨塔';
            const useStoneWallGrid = isStoneWall || isWatchTower;
            
            // 对于所有建筑（包括石墙），统一使用世界坐标
            if (this.dragPreview) {
                buildPos = this.dragPreview.worldPosition.clone();
            } else {
                buildPos = this.getWorldPositionFromScreen(new Vec3(location.x, location.y, 0));
            }
            
            // 根据建筑类型选择对应的网格面板进行对齐
            if (buildPos) {
                if (useStoneWallGrid) {
                    // 石墙和哨塔使用石墙网格面板
                    if (!this.stoneWallGridPanel) {
                        this.findStoneWallGridPanel();
                    }
                    
                    if (this.stoneWallGridPanel) {
                        // 先尝试使用拖拽预览位置获取网格中心
                        let gridCenter = this.stoneWallGridPanel.getNearestGridCenter(buildPos);
                        
                        // 如果拖拽预览位置不在网格内，尝试使用触摸结束位置
                        if (!gridCenter) {
                            const touchWorldPos = this.getWorldPositionFromScreen(new Vec3(location.x, location.y, 0));
                            if (touchWorldPos) {
                                gridCenter = this.stoneWallGridPanel.getNearestGridCenter(touchWorldPos);
                            }
                        }
                        
                        if (gridCenter) {
                            // 检查目标网格是否被占用
                            const grid = this.stoneWallGridPanel.worldToGrid(gridCenter);
                            if (grid) {
                                const isOccupied = this.stoneWallGridPanel.isGridOccupied(grid.x, grid.y);
                                if (!isOccupied) {
                                    buildPos = gridCenter;
                                } else {
                                    // 网格被占用，建造失败
                                    this.clearDragPreview();
                                    this.selectedBuilding = null;
                                    this.clearGridHighlight();
                                    if (this.onBuildCancelCallback) {
                                        this.onBuildCancelCallback();
                                    }
                                    event.propagationStopped = true;
                                    return;
                                }
                            } else {
                                this.clearDragPreview();
                                this.selectedBuilding = null;
                                this.clearGridHighlight();
                                if (this.onBuildCancelCallback) {
                                    this.onBuildCancelCallback();
                                }
                                event.propagationStopped = true;
                                return;
                            }
                        } else {
                            // 石墙和哨塔必须建造在石墙网格内，否则建造失败
                            this.clearDragPreview();
                            this.selectedBuilding = null;
                            this.clearGridHighlight();
                            if (this.onBuildCancelCallback) {
                                this.onBuildCancelCallback();
                            }
                            event.propagationStopped = true;
                            return;
                        }
                    } else {
                        // 没有石墙网格面板，建造失败
                        this.clearDragPreview();
                        this.selectedBuilding = null;
                        if (this.onBuildCancelCallback) {
                            this.onBuildCancelCallback();
                        }
                        event.propagationStopped = true;
                        return;
                    }
                } else {
                    // 其他建筑使用普通网格面板
                    if (this.gridPanel) {
                        const gridCenter = this.gridPanel.getNearestGridCenter(buildPos);
                        if (gridCenter) {
                            buildPos = gridCenter;
                        } else {
                            // 如果不在网格内，建造失败，退出建造模式
                            this.clearDragPreview();
                            this.selectedBuilding = null;
                            // 确保清除网格高亮
                            if (this.gridPanel) {
                                this.gridPanel.clearHighlight();
                            }
                            if (this.onBuildCancelCallback) {
                                this.onBuildCancelCallback();
                            }
                            event.propagationStopped = true;
                            return;
                        }
                    }
                }
            }
            
            if (buildPos && this.onBuildCallback) {
                // 标记触摸结束事件已处理（成功建造）
                this.touchEndHandled = true;
                this.onBuildCallback(building, buildPos);
                
                // 清除拖拽预览和状态
                this.clearDragPreview();
                this.selectedBuilding = null;
                
                // 再次确保清除网格高亮
                if (this.gridPanel) {
                    this.gridPanel.clearHighlight();
                }
                if (this.stoneWallGridPanel) {
                    this.stoneWallGridPanel.clearHighlight();
                }
                
                // 立即清除建筑物的选中状态（如果有）
                this.clearBuildingSelection();
                
                // 延迟一帧再次清除选中状态和网格高亮，确保建筑物创建完成后清除
                this.scheduleOnce(() => {
                    this.clearBuildingSelection();
                    if (this.gridPanel) {
                        this.gridPanel.clearHighlight();
                    }
                    if (this.stoneWallGridPanel) {
                        this.stoneWallGridPanel.clearHighlight();
                    }
                }, 0);
                
                event.propagationStopped = true;
                return;
            }
        }
        
        // 如果没有成功建造，清除状态并重新显示面板
        this.clearDragPreview();
        this.selectedBuilding = null;
        this.show();
        
        // 阻止事件传播
        event.propagationStopped = true;
    }

    /**
     * 建筑物选项触摸取消
     */
    onBuildingItemTouchCancel(building: BuildingType, event: EventTouch) {
        if (this.selectedBuilding !== building) {
            this.clearDragPreview();
            this.selectedBuilding = null;
            this.isDragging = false;
            event.propagationStopped = true;
            return;
        }

        // 如果正在拖拽，尝试处理建造逻辑（和TOUCH_END相同的逻辑）
        if (this.isDragging && this.selectedBuilding && this.dragPreview) {
            // 立即停止拖拽状态，防止触摸移动事件继续处理
            this.isDragging = false;
            this.clearGridHighlight();
            
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
                    this.node.active = false;
                    if (panelOpacity) {
                        panelOpacity.opacity = 255;
                    }
                    this.node.setScale(1, 1, 1);
                }

                // 优先使用拖拽预览的当前位置（已经对齐到网格中心）
                let worldPos: Vec3 | null = null;
                if (this.dragPreview) {
                    worldPos = this.dragPreview.worldPosition.clone();
                }
                
                // 如果没有拖拽预览位置，使用触摸结束位置并对齐到网格中心
                if (!worldPos) {
                    worldPos = this.getWorldPositionFromScreen(new Vec3(location.x, location.y, 0));
                }
                
                // 判断是否是石墙或哨塔（都使用石墙网格）
                const isStoneWall = this.selectedBuilding && this.selectedBuilding.name === '石墙';
                const isWatchTower = this.selectedBuilding && this.selectedBuilding.name === '哨塔';
                const useStoneWallGrid = isStoneWall || isWatchTower;
                
                // 根据建筑类型选择对应的网格面板进行对齐
                if (worldPos) {
                    if (useStoneWallGrid) {
                        if (!this.stoneWallGridPanel) {
                            this.findStoneWallGridPanel();
                        }

                        if (this.stoneWallGridPanel) {
                            // 先尝试使用拖拽预览位置获取网格中心
                            let gridCenter = this.stoneWallGridPanel.getNearestGridCenter(worldPos);
                            
                            // 如果拖拽预览位置不在网格内，尝试使用触摸结束位置
                            if (!gridCenter) {
                                const touchWorldPos = this.getWorldPositionFromScreen(new Vec3(location.x, location.y, 0));
                                if (touchWorldPos) {
                                    gridCenter = this.stoneWallGridPanel.getNearestGridCenter(touchWorldPos);
                                }
                            }
                            
                            if (gridCenter) {
                                // 检查目标网格是否被占用
                                const grid = this.stoneWallGridPanel.worldToGrid(gridCenter);
                                if (grid && !this.stoneWallGridPanel.isGridOccupied(grid.x, grid.y)) {
                                    worldPos = gridCenter;
                                } else {
                                    this.clearDragPreview();
                                    this.selectedBuilding = null;
                                    this.clearGridHighlight();
                                    if (this.onBuildCancelCallback) {
                                        this.onBuildCancelCallback();
                                    }
                                    event.propagationStopped = true;
                                    return;
                                }
                            } else {
                                // 石墙和哨塔必须建造在石墙网格内
                                this.clearDragPreview();
                                this.selectedBuilding = null;
                                this.clearGridHighlight();
                                if (this.onBuildCancelCallback) {
                                    this.onBuildCancelCallback();
                                }
                                event.propagationStopped = true;
                                return;
                            }
                        } else {
                            // 没有石墙网格面板
                            this.clearDragPreview();
                            this.selectedBuilding = null;
                            if (this.onBuildCancelCallback) {
                                this.onBuildCancelCallback();
                            }
                            event.propagationStopped = true;
                            return;
                        }
                    } else if (this.gridPanel) {
                        const gridCenter = this.gridPanel.getNearestGridCenter(worldPos);
                        if (gridCenter) {
                            worldPos = gridCenter;
                        } else {
                            // 不在普通网格内，建造失败
                            this.clearDragPreview();
                            this.selectedBuilding = null;
                            if (this.gridPanel) {
                                this.gridPanel.clearHighlight();
                            }
                            if (this.onBuildCancelCallback) {
                                this.onBuildCancelCallback();
                            }
                            event.propagationStopped = true;
                            return;
                        }
                    }
                }
                
                if (worldPos && this.onBuildCallback) {
                    // 标记触摸结束事件已处理（成功建造）
                    this.touchEndHandled = true;
                    this.onBuildCallback(building, worldPos);
                    
                    // 清除拖拽预览和状态
                    this.clearDragPreview();
                    this.selectedBuilding = null;
                    
                    // 再次确保清除网格高亮
                    if (this.gridPanel) {
                        this.gridPanel.clearHighlight();
                    }
                    
                    // 立即清除建筑物的选中状态（如果有）
                    this.clearBuildingSelection();
                    
                    // 延迟一帧再次清除选中状态和网格高亮，确保建筑物创建完成后清除
                    this.scheduleOnce(() => {
                        this.clearBuildingSelection();
                        if (this.gridPanel) {
                            this.gridPanel.clearHighlight();
                        }
                    }, 0);
                    
                    event.propagationStopped = true;
                    return;
                }
            } else {
                // 拖拽距离不够，清除状态
                this.clearDragPreview();
                this.selectedBuilding = null;
                // 确保清除网格高亮
                if (this.gridPanel) {
                    this.gridPanel.clearHighlight();
                }
            }
        }

        // 如果没有成功建造，清除状态并重新显示面板
        this.clearDragPreview();
        this.selectedBuilding = null;
        // 确保清除网格高亮
        if (this.gridPanel) {
            this.gridPanel.clearHighlight();
        }
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
        
        // 只禁用功能性的组件（如WarAncientTree），保留视觉组件（如Sprite）
        const disableFunctionalComponents = (node: Node) => {
            // 禁用WarAncientTree组件（防止开始生产Arrower）
            const warAncientTree = node.getComponent('WarAncientTree');
            if (warAncientTree) {
                warAncientTree.enabled = false;
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
        // 如果不在拖拽状态，不更新预览，并清除高亮
        if (!this.isDragging) {
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
            if (this.stoneWallGridPanel) {
                this.stoneWallGridPanel.clearHighlight();
            }
            return;
        }
        
        if (!this.dragPreview || !this.selectedBuilding) {
            return;
        }

        // 确保预览节点有效且可见
        if (!this.dragPreview.isValid || !this.dragPreview.active) {
            return;
        }

        // 确保网格面板可见
        if (!this.gridPanel) {
            this.findGridPanel();
        }
        if (!this.stoneWallGridPanel) {
            this.findStoneWallGridPanel();
        }
        
        // 判断是否是石墙或哨塔（都使用石墙网格）
        const isStoneWall = this.selectedBuilding.name === '石墙';
        const isWatchTower = this.selectedBuilding.name === '哨塔';
        const useStoneWallGrid = isStoneWall || isWatchTower;
        
        if (useStoneWallGrid) {
            // 对于石墙和哨塔，使用世界坐标（与普通建筑物一致）
            const worldPos = this.getWorldPositionFromScreen(screenPos);
            if (!worldPos) {
                return;
            }
            
            // 更新拖拽预览位置跟随鼠标
            this.dragPreview.setWorldPosition(worldPos);
            
            // 处理石墙网格高亮
            if (this.stoneWallGridPanel) {
                this.stoneWallGridPanel.show();
                
                // 尝试高亮石墙网格（如果位置在网格内）
                this.stoneWallGridPanel.highlightGrid(worldPos);
                
                // 如果位置在石墙网格内，对齐到网格中心
                const gridCenter = this.stoneWallGridPanel.getNearestGridCenter(worldPos);
                if (gridCenter) {
                    this.dragPreview.setWorldPosition(gridCenter);
                } else {
                    // 如果不在石墙网格内，清除高亮
                    this.stoneWallGridPanel.clearHighlight();
                }
            }
        } else {
            // 对于其他建筑，使用世界坐标
            const worldPos = this.getWorldPositionFromScreen(screenPos);
            if (!worldPos) {
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
            }
            
            // 处理普通网格高亮
            if (this.gridPanel) {
                this.gridPanel.show();
                
                // 尝试高亮普通网格（如果位置在网格内）
                this.gridPanel.highlightGrid(worldPos);
                
                // 如果位置在普通网格内，对齐到网格中心
                const gridCenter = this.gridPanel.getNearestGridCenter(worldPos);
                if (gridCenter) {
                    this.dragPreview.setWorldPosition(gridCenter);
                } else {
                    // 如果不在普通网格内，清除高亮
                    this.gridPanel.clearHighlight();
                }
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
        if (!this.gridPanel) {
            this.findGridPanel();
        }
        if (this.gridPanel) {
            this.gridPanel.clearHighlight();
        } else {
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
                unitSelectionManager.clearSelection();
            }
        } else {
            // 如果找不到UnitSelectionManager节点，尝试在场景中查找组件
            const scene = this.node.scene;
            if (scene) {
                const unitSelectionManager = scene.getComponentInChildren(UnitSelectionManager);
                if (unitSelectionManager) {
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

