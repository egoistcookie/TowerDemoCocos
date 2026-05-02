import { _decorator, Component, Node, Prefab, Sprite, SpriteFrame, Label, Color, UITransform, Graphics, EventTouch, Vec3, Vec2, tween, UIOpacity, find, instantiate, Camera, ScrollView, Mask, LabelOutline, Button, resources, AudioClip } from 'cc';
import { GameManager } from './GameManager';
import { GamePopup } from './GamePopup';
import { SoundManager } from './SoundManager';
import { AudioManager } from './AudioManager';
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
    private onRefreshRequestCallback: (() => void) | null = null; // 刷新候选建筑回调
    private canvasNode: Node = null!;
    private touchEndHandled: boolean = false; // 标记触摸结束事件是否已处理
    private gridPanel: BuildingGridPanel = null!; // 网格面板组件
    private stoneWallGridPanel: StoneWallGridPanel = null!; // 石墙网格面板组件
    private lastIsDragging: boolean = false; // 上一帧的拖拽状态，用于检测状态变化
    private refreshButtonCost: number = 10;
    private refreshButtonEnabled: boolean = true;
    private refreshProgress: number = 0; // 0=整圈；1=完成
    private refreshButtonNode: Node | null = null;
    private refreshMainButton: Button | null = null;
    private refreshIconSprite: Sprite | null = null;
    private refreshCostLabel: Label | null = null;
    private refreshRingGraphics: Graphics | null = null;
    /** 落地去抖时间戳（强隔离 End/Cancel/Canvas 多路径重入） */
    private lastDropFinalizeAtMs: number = -999999;
    private nextAllowedDropFinalizeAtMs: number = -999999;

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
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        // 强隔离：同一次鼠标松手可能走到 End/Cancel/Canvas 多条路径，这里只允许一次 finalize
        if (now < this.nextAllowedDropFinalizeAtMs) {
            return;
        }
        this.nextAllowedDropFinalizeAtMs = now + 220;
        this.lastDropFinalizeAtMs = now;

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

                // 必须使用“松开时鼠标位置”作为落地判定依据（避免用预览的历史吸附位置导致误建造/触发升星链路）
                let worldPos: Vec3 | null = this.getWorldPositionFromScreen(new Vec3(location.x, location.y, 0));
                
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
                        
                        if (this.stoneWallGridPanel && worldPos) {
                            const gridCenter = this.stoneWallGridPanel.getNearestGridCenter(worldPos);
                            if (gridCenter) {
                                // 检查目标网格是否被占用
                                const grid = this.stoneWallGridPanel.worldToGrid(gridCenter);
                                // 哨塔占据两个网格高度，需要检查两个网格是否都被占用
                                let canPlace = false;
                                if (isWatchTower) {
                                    // 检查第二个网格是否存在
                                    if (grid.y + 1 < this.stoneWallGridPanel.gridHeight) {
                                        // 检查两个网格是否都被占用
                                        canPlace = !this.stoneWallGridPanel.isGridOccupied(grid.x, grid.y) && 
                                                   !this.stoneWallGridPanel.isGridOccupied(grid.x, grid.y + 1);
                                    }
                                } else {
                                    // 石墙只占用一个网格
                                    canPlace = !this.stoneWallGridPanel.isGridOccupied(grid.x, grid.y);
                                }
                                if (grid && canPlace) {
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
                        if (this.gridPanel && worldPos) {
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
                // 成功建造后，再额外延长短窗口，防止同一松手链路的迟到回调再次进入
                this.nextAllowedDropFinalizeAtMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 260;
                
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
                }, 0.02);
                
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
     * 设置刷新候选建筑回调
     */
    setOnRefreshRequest(callback: () => void) {
        this.onRefreshRequestCallback = callback;
    }

    /**
     * 仅存金币/可否刷新状态，仅重绘刷新按钮，不触发整面板重建。
     */
    setRefreshButtonState(cost: number, enabled: boolean) {
        this.refreshButtonCost = cost;
        this.refreshButtonEnabled = enabled;
        this.updateRefreshButtonVisuals();
    }

    /**
     * 设置刷新按钮金边进度（0~1）。
     * - 0：整圈金边
     * - 1：金边完全消失（本波刷完）
     */
    setRefreshProgress(progress01: number) {
        this.refreshProgress = Math.max(0, Math.min(1, progress01));
        this.redrawRefreshRing();
    }

    private redrawRefreshRing() {
        if (!this.refreshRingGraphics || !this.refreshButtonNode || !this.refreshButtonNode.isValid) {
            return;
        }
        const g = this.refreshRingGraphics;
        g.clear();

        const remaining = Math.max(0, 1 - (this.refreshProgress || 0));
        if (remaining <= 0.001) {
            return;
        }

        const diameter = this.refreshButtonNode.getComponent(UITransform)?.contentSize.width || 92;
        const lineWidth = 6;
        const radius = diameter / 2 + Math.max(0, lineWidth / 2 - 1);
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + remaining * Math.PI * 2;
        g.lineWidth = lineWidth;
        g.strokeColor = new Color(255, 215, 0, 255);
        g.arc(0, 0, radius, startAngle, endAngle, false);
        g.stroke();
    }

    private updateRefreshButtonVisuals() {
        if (this.refreshMainButton) {
            this.refreshMainButton.interactable = this.refreshButtonEnabled;
        }
        if (this.refreshIconSprite) {
            this.refreshIconSprite.grayscale = !this.refreshButtonEnabled;
            this.refreshIconSprite.color = this.refreshButtonEnabled ? Color.WHITE : new Color(200, 200, 200, 255);
        }
        if (this.refreshCostLabel) {
            this.refreshCostLabel.string = `💰${this.refreshButtonCost}`;
            this.refreshCostLabel.color = this.refreshButtonEnabled ? Color.YELLOW : new Color(180, 180, 180, 255);
        }
        this.redrawRefreshRing();
    }

    /**
     * assets/resources/textures/icon/刷新1.png、刷新2.png；加载路径与 UIManager.setupButtonSprite 相同：`textures/icon/{文件名不含扩展名}/spriteFrame`
     */
    private applyRefreshButtonIconSprites(buttonRoot: Node, diameter: number) {
        const sprite = buttonRoot.getComponent(Sprite);
        const button = buttonRoot.getComponent(Button);
        if (!sprite || !button) return;

        const normalPath = 'textures/icon/刷新1/spriteFrame';
        const pressedPath = 'textures/icon/刷新2/spriteFrame';

        resources.load(normalPath, SpriteFrame, (err, sf) => {
            if (err || !sprite.isValid) return;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.type = Sprite.Type.SIMPLE;
            sprite.spriteFrame = sf;
            button.normalSprite = sf;
            button.hoverSprite = sf;
            const tr = buttonRoot.getComponent(UITransform);
            if (tr && sf) {
                const rect = sf.rect;
                const w = rect.width || (sf as any).width;
                const h = rect.height || (sf as any).height;
                if (w > 0 && h > 0) {
                    const scale = Math.min(diameter / w, diameter / h);
                    tr.setContentSize(w * scale, h * scale);
                }
            }
            this.redrawRefreshRing();
        });

        resources.load(pressedPath, SpriteFrame, (err, sf2) => {
            if (err || !button.isValid || !sf2) return;
            button.pressedSprite = sf2;
            button.disabledSprite = sf2;
        });
    }

    private onRefreshButtonClicked() {
        if (!this.refreshButtonEnabled) {
            GamePopup.showMessage('金币不足');
            return;
        }
        BuildingSelectionPanel.playCardSelectSfxShared();
        if (this.onRefreshRequestCallback) {
            this.onRefreshRequestCallback();
        }
    }

    /** resources/sounds/抽卡.mp3，与 BuffCardPopup 抽卡确认同源通路 */
    private static readonly CARD_SELECT_SFX_RES = 'sounds/抽卡';
    private static cardSelectSfxClip: AudioClip | null = null;
    private static cardSelectSfxLoading = false;

    private static playCardSelectSfxShared() {
        if (BuildingSelectionPanel.cardSelectSfxClip) {
            BuildingSelectionPanel.playClip(BuildingSelectionPanel.cardSelectSfxClip);
            return;
        }
        if (BuildingSelectionPanel.cardSelectSfxLoading) return;
        BuildingSelectionPanel.cardSelectSfxLoading = true;
        resources.load(BuildingSelectionPanel.CARD_SELECT_SFX_RES, AudioClip, (err, clip) => {
            BuildingSelectionPanel.cardSelectSfxLoading = false;
            if (err || !clip) return;
            BuildingSelectionPanel.cardSelectSfxClip = clip;
            BuildingSelectionPanel.playClip(clip);
        });
    }

    private static playClip(clip: AudioClip) {
        try {
            const sm = SoundManager.getInstance();
            const smHasEffectSource = sm ? !!(sm as any).effectAudioSource : false;
            if (sm && smHasEffectSource) sm.playEffect(clip);
            else AudioManager.Instance?.playSFX(clip);
        } catch {}
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

        // 将面板移到 Canvas 的最前面（显示在所有节点之上）
        const canvas = find('Canvas');
        if (canvas) {
            this.node.setSiblingIndex(canvas.children.length - 1);
        }

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
        const itemWidth = 120;
        const spacing = 20;
        const maxCandidateSlots = 3;
        const hMargin = 10;
        const contentAreaWidth = maxCandidateSlots * (itemWidth + spacing) + 12;
        const refreshButtonAreaWidth = 100;
        const panelWidth = hMargin + contentAreaWidth + refreshButtonAreaWidth + hMargin;
        const panelHeight = 220;

        // 获取 Canvas 节点，用于计算屏幕底部位置
        const canvas = find('Canvas');
        let canvasHeight = 1280; // 默认值
        if (canvas) {
            const canvasTransform = canvas.getComponent(UITransform);
            if (canvasTransform) {
                canvasHeight = canvasTransform.contentSize.height;
            }
        }

        // 获取或创建面板的 UITransform
        let panelTransform = this.node.getComponent(UITransform);
        if (!panelTransform) {
            panelTransform = this.node.addComponent(UITransform);
        }
        panelTransform.setContentSize(panelWidth, panelHeight);
        // 面板锚点设置为 (0.5, 0.5) 中心对齐
        panelTransform.anchorPoint = new Vec2(0.5, 0.5);

        // 确保面板节点位置在屏幕底部中心
        // Canvas 的原点在中心，底部位置是 -canvasHeight/2
        // 面板中心应该在 -canvasHeight/2 + panelHeight/2 的位置
        this.node.setPosition(0, -canvasHeight / 2 + panelHeight / 2, 0);

        // 清空现有的 panelContent
        if (this.panelContent && this.panelContent.parent) {
            this.panelContent.parent.removeAllChildren();
        }

        // 创建面板背景
        const bgNode = new Node('Background');
        bgNode.setParent(this.node);
        bgNode.setPosition(0, 0, 0);
        const bgTransform = bgNode.addComponent(UITransform);
        bgTransform.setContentSize(panelWidth, panelHeight);
        bgTransform.anchorPoint = new Vec2(0.5, 0.5);
        const bgGraphics = bgNode.addComponent(Graphics);
        bgGraphics.fillColor = new Color(30, 30, 30, 200);
        bgGraphics.roundRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 10);
        bgGraphics.fill();

        // 创建内容容器（直接作为 panelNode 的子节点，便于 GameManager 查找）
        const contentNode = new Node('Content');
        contentNode.setParent(this.node);
        // 内容容器锚点 (0, 0.5)；初始 x 在下方按 hMargin 与滚动范围再定
        contentNode.setPosition(-panelWidth / 2 + hMargin, 0, 0);

        const contentTransform = contentNode.addComponent(UITransform);
        contentTransform.anchorPoint = new Vec2(0, 0.5);

        this.panelContent = contentNode;

        // 创建建筑物选项
        this.buildingTypes.forEach((building, index) => {
            const item = this.createBuildingItem(building, index, itemWidth, spacing);
            this.panelContent.addChild(item);
        });

        // 更新内容容器宽度（根据建筑物数量）
        if (this.panelContent && this.buildingTypes.length > 0) {
            const totalWidth = this.buildingTypes.length * (itemWidth + spacing);
            contentTransform.setContentSize(totalWidth, panelHeight);
        }

        // 添加遮罩组件来裁剪超出内容
        this.node.addComponent(Mask);

        // 添加触摸滚动支持
        // 内容容器锚点 (0, 0.5)，原点在左侧
        // 当内容宽度小于面板宽度时，内容已经居中对齐，不需要滚动
        // 当内容宽度大于面板宽度时，内容靠左对齐，允许滚动
        const contentWidth = this.buildingTypes.length * (itemWidth + spacing);
        const isCentered = contentWidth < contentAreaWidth;

        // 初始位置：居中时以内容区中心居中，否则靠左（均相对左右各 hMargin 的内侧区域）
        const contentAreaCenterX = -panelWidth / 2 + hMargin + contentAreaWidth / 2;
        const initialPosX = isCentered ? (contentAreaCenterX - contentWidth / 2) : -panelWidth / 2 + hMargin;

        // 设置内容容器初始位置
        contentNode.setPosition(initialPosX, 0, 0);

        let isDragging = false;
        let startX = 0;
        let startScrollX = initialPosX;

        this.node.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
            isDragging = false;
            startX = event.touch!.getStartLocation().x;
            startScrollX = contentNode.position.x;
        }, this);

        this.node.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
            const touchX = event.touch!.getLocation().x;
            const deltaX = touchX - startX;
            const newScrollX = startScrollX + deltaX;

            // 限制滚动范围（只有当内容宽度大于面板宽度时才允许滚动）
            if (contentWidth > contentAreaWidth) {
                const maxScrollX = -panelWidth / 2 + hMargin;
                const minScrollX = -panelWidth / 2 + hMargin + contentAreaWidth - contentWidth;

                if (newScrollX > maxScrollX) {
                    contentNode.setPosition(maxScrollX, 0, 0);
                } else if (newScrollX < minScrollX) {
                    contentNode.setPosition(minScrollX, 0, 0);
                } else {
                    contentNode.setPosition(newScrollX, 0, 0);
                }
            }
        }, this);

        // 候选池右侧刷新按钮：贴图 刷新1/刷新2（resources/textures/icon）+ 金边圆环 + 金币文案
        const refreshNode = new Node('RefreshButton');
        refreshNode.setParent(this.node);
        refreshNode.setPosition(panelWidth / 2 - hMargin - refreshButtonAreaWidth / 2, 0, 0);
        const refreshTransform = refreshNode.addComponent(UITransform);
        const refreshDiameter = 92;
        refreshTransform.setContentSize(refreshDiameter, refreshDiameter);

        const refreshSprite = refreshNode.addComponent(Sprite);
        refreshSprite.sizeMode = Sprite.SizeMode.CUSTOM;

        const refreshBtn = refreshNode.addComponent(Button);
        refreshBtn.transition = Button.Transition.SPRITE;
        refreshBtn.target = refreshNode;
        refreshBtn.zoomScale = 1;
        refreshBtn.interactable = this.refreshButtonEnabled;
        refreshBtn.node.on(Button.EventType.CLICK, this.onRefreshButtonClicked, this);

        this.refreshMainButton = refreshBtn;
        this.refreshIconSprite = refreshSprite;

        const ringNode = new Node('RefreshRing');
        ringNode.setParent(refreshNode);
        ringNode.setPosition(0, 0, 0);
        const ringTransform = ringNode.addComponent(UITransform);
        ringTransform.setContentSize(refreshDiameter + 8, refreshDiameter + 8);
        const ringGraphics = ringNode.addComponent(Graphics);

        const refreshCostNode = new Node('RefreshCostLabel');
        refreshCostNode.setParent(refreshNode);
        refreshCostNode.setPosition(0, -36, 0);
        const refreshCostLabel = refreshCostNode.addComponent(Label);
        refreshCostLabel.string = `💰${this.refreshButtonCost}`;
        refreshCostLabel.fontSize = 18;
        refreshCostLabel.color = this.refreshButtonEnabled ? Color.YELLOW : new Color(180, 180, 180, 255);
        const refreshCostOutline = refreshCostNode.addComponent(LabelOutline);
        refreshCostOutline.color = new Color(0, 0, 0, 255);
        refreshCostOutline.width = 2;

        this.applyRefreshButtonIconSprites(refreshNode, refreshDiameter);

        this.refreshButtonNode = refreshNode;
        this.refreshCostLabel = refreshCostLabel;
        this.refreshRingGraphics = ringGraphics;
        this.redrawRefreshRing();
        this.updateRefreshButtonVisuals();
    }

    /**
     * 创建建筑物选项
     */
    createBuildingItem(building: BuildingType, index: number, itemWidth: number, spacing: number): Node {
        const item = new Node(`BuildingItem_${building.name}`);

        // 添加 UITransform
        const transform = item.addComponent(UITransform);
        transform.setContentSize(itemWidth, itemWidth);

        // 设置位置（水平排列，从左到右，第一个元素中心距离左边缘 itemWidth/2 + spacing）
        item.setPosition(itemWidth / 2 + spacing + index * (itemWidth + spacing), 0, 0);

        // 添加背景
        const bg = new Node('Background');
        bg.setParent(item);
        bg.setPosition(0, 0, 0);
        const bgTransform = bg.addComponent(UITransform);
        bgTransform.setContentSize(itemWidth - 10, itemWidth - 10);
        const bgGraphics = bg.addComponent(Graphics);
        bgGraphics.fillColor = new Color(50, 50, 50, 200);
        bgGraphics.roundRect(-(itemWidth - 10) / 2, -(itemWidth - 10) / 2, itemWidth - 10, itemWidth - 10, 10);
        bgGraphics.fill();
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
            // 提示金币不足后，强制关闭候选框，避免玩家继续点击导致反复提示
            this.forceClosePanelAfterInsufficientGold();
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
     * 金币不足时强制关闭候选面板（绕过 show() 的 _justShown 保护期）。
     * 目的：防止玩家点击游戏区域时反复触发“金币不足”提示。
     */
    private forceClosePanelAfterInsufficientGold() {
        try {
            // 取消可能残留的延迟隐藏回调
            (this.node as any)._pendingHideCallback = null;
        } catch {}

        // 清理拖拽/选择态，避免后续事件继续沿用旧状态
        this.selectedBuilding = null;
        this.isDragging = false;
        this.touchEndHandled = false;
        this.clearDragPreview();

        // 清除网格高亮，避免残留
        try {
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
        } catch {}
        try {
            if (this.stoneWallGridPanel) {
                this.stoneWallGridPanel.clearHighlight();
            }
        } catch {}

        // 直接隐藏面板（不走 hide()，避免 _justShown 保护期阻止关闭）
        if (this.node && this.node.isValid) {
            this.node.active = false;
            // 恢复一个“隐藏态缩放”，与 hide() 逻辑保持一致
            this.node.setScale(0, 1, 1);
        }
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
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        if (now < this.nextAllowedDropFinalizeAtMs) {
            event.propagationStopped = true;
            return;
        }
        const location = event.getLocation();
        const startLocation = event.getStartLocation();
        const dragDistance = Math.sqrt(
            Math.pow(location.x - startLocation.x, 2) + 
            Math.pow(location.y - startLocation.y, 2)
        );
        if (this.selectedBuilding !== building) {
            return;
        }

        // 点击未拖拽：仅清理，不走建造。
        if (dragDistance <= 5) {
            this.isDragging = false;
            this.clearDragPreview();
            this.selectedBuilding = null;
            this.clearGridHighlight();
            event.propagationStopped = true;
            return;
        }

        // 拖拽结束：统一交给 Canvas 的单一路径处理，避免 End/Cancel 双分支重复触发导致卡死。
        this.isDragging = true;
        this.onCanvasTouchEnd(event);
        event.propagationStopped = true;
        return;
    }

    /**
     * 建筑物选项触摸取消
     */
    onBuildingItemTouchCancel(building: BuildingType, event: EventTouch) {
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        if (now < this.nextAllowedDropFinalizeAtMs) {
            event.propagationStopped = true;
            return;
        }
        if (this.selectedBuilding !== building) {
            this.clearDragPreview();
            this.selectedBuilding = null;
            this.isDragging = false;
            event.propagationStopped = true;
            return;
        }
        // Cancel 和 End 统一走同一条落地路径，避免双路径重复触发。
        const location = event.getLocation();
        const startLocation = event.getStartLocation();
        const dragDistance = Math.sqrt(
            Math.pow(location.x - startLocation.x, 2) +
            Math.pow(location.y - startLocation.y, 2)
        );
        if (dragDistance <= 5) {
            this.clearDragPreview();
            this.selectedBuilding = null;
            this.isDragging = false;
            this.clearGridHighlight();
            event.propagationStopped = true;
            return;
        }
        this.isDragging = true;
        this.onCanvasTouchEnd(event);
        event.propagationStopped = true;
        return;
    }

    /**
     * 创建拖拽预览
     */
    createDragPreview(building: BuildingType, screenPos: Vec3) {
        // 重要：拖拽预览不要 instantiate 真实预制体（例如 Church 会在 onEnable/start 里 schedule/update，导致“未落地就卡死”）。
        // 改为纯图标预览：只包含 Sprite/UITransform/UIOpacity，无任何逻辑组件。
        this.dragPreview = new Node('DragPreview');
        const ui = this.dragPreview.addComponent(UITransform);
        const desired = 100;
        const sp = this.dragPreview.addComponent(Sprite);
        sp.spriteFrame = building.icon || null!;
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.type = Sprite.Type.SIMPLE;
        // 预览大小：按贴图原尺寸等比缩放到 desired（避免某些资源仍按原像素看起来很大）
        const rect = sp.spriteFrame?.rect;
        const w = rect?.width || desired;
        const h = rect?.height || desired;
        const denom = Math.max(1, Math.max(w, h));
        const s = desired / denom;
        ui.setContentSize(w, h);
        this.dragPreview.setScale(s, s, 1);
        
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

