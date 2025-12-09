import { _decorator, Component, Node, Prefab, instantiate, Vec3, EventTouch, input, Input, Camera, find, view, UITransform, SpriteFrame, Graphics, Color, director } from 'cc';
import { GameManager } from './GameManager';
import { BuildingSelectionPanel, BuildingType } from './BuildingSelectionPanel';
import { GamePopup } from './GamePopup';
import { UnitSelectionManager } from './UnitSelectionManager';
import { WarAncientTree } from './WarAncientTree';
import { MoonWell } from './MoonWell';
import { Tree } from './Tree';
import { HunterHall } from './HunterHall';
import { UnitConfigManager } from './UnitConfigManager';
import { BuildingGridPanel } from './BuildingGridPanel';
const { ccclass, property } = _decorator;

@ccclass('TowerBuilder')
export class TowerBuilder extends Component {
    @property(Prefab)
    warAncientTreePrefab: Prefab = null!; // 战争古树预制体

    @property(SpriteFrame)
    warAncientTreeIcon: SpriteFrame = null!; // 战争古树图标

    @property(Prefab)
    moonWellPrefab: Prefab = null!; // 月亮井预制体

    @property(SpriteFrame)
    moonWellIcon: SpriteFrame = null!; // 月亮井图标

    @property(Prefab)
    treePrefab: Prefab = null!; // 普通树木预制体

    @property(SpriteFrame)
    treeIcon: SpriteFrame = null!; // 普通树木图标

    @property(Prefab)
    hunterHallPrefab: Prefab = null!; // 猎手大厅预制体

    @property(SpriteFrame)
    hunterHallIcon: SpriteFrame = null!; // 猎手大厅图标

    @property(Node)
    buildingSelectionPanel: Node = null!; // 建筑物选择面板节点

    @property
    buildRange: number = 800; // 建造范围（距离水晶），增大范围以便更容易建造

    @property
    minBuildDistance: number = 80; // 最小建造距离（距离水晶）

    @property(Node)
    targetCrystal: Node = null!;

    @property(Node)
    towerContainer: Node = null!;

    @property(Node)
    warAncientTreeContainer: Node = null!; // 战争古树容器

    @property(Node)
    moonWellContainer: Node = null!; // 月亮井容器

    @property(Node)
    treeContainer: Node = null!; // 普通树木容器

    @property(Node)
    hunterHallContainer: Node = null!; // 猎手大厅容器

    @property(Node)
    buildingGridPanel: Node = null!; // 建筑物网格面板节点

    @property
    towerCost: number = 10; // 战争古树建造成本（10金币）

    @property
    moonWellCost: number = 10; // 月亮井建造成本（10金币）

    @property
    treeCost: number = 1; // 普通树木建造成本（1金币）

    @property
    hunterHallCost: number = 10; // 猎手大厅建造成本（10金币）

    private isBuildingMode: boolean = false;
    private previewTower: Node = null!;
    private gameManager: GameManager = null!;
    private buildingPanel: BuildingSelectionPanel = null!;
    private currentSelectedBuilding: BuildingType | null = null;
    private gridPanel: BuildingGridPanel = null!; // 网格面板组件
    
    // 建筑物拖拽相关
    private isDraggingBuilding: boolean = false; // 是否正在拖拽建筑物
    private draggedBuilding: Node = null!; // 当前拖拽的建筑物节点
    private draggedBuildingOriginalGrid: { x: number; y: number } | null = null; // 拖拽建筑物原始网格位置

    start() {
        // 查找游戏管理器
        this.findGameManager();
        
        // 查找水晶
        if (!this.targetCrystal) {
            this.targetCrystal = find('Crystal');
        }

        // 创建弓箭手容器
        if (!this.towerContainer) {
            // 先尝试查找现有的Towers节点
            const existingTowers = find('Towers');
            if (existingTowers) {
                this.towerContainer = existingTowers;
            } else {
                this.towerContainer = new Node('Towers');
                this.towerContainer.setParent(this.node.scene);
            }
        }

        // 创建战争古树容器
        if (!this.warAncientTreeContainer) {
            const existingTrees = find('WarAncientTrees');
            if (existingTrees) {
                this.warAncientTreeContainer = existingTrees;
            } else {
                this.warAncientTreeContainer = new Node('WarAncientTrees');
                const canvas = find('Canvas');
                if (canvas) {
                    this.warAncientTreeContainer.setParent(canvas);
                } else if (this.node.scene) {
                    this.warAncientTreeContainer.setParent(this.node.scene);
                }
            }
        }

        // 创建月亮井容器
        if (!this.moonWellContainer) {
            const existingWells = find('MoonWells');
            if (existingWells) {
                this.moonWellContainer = existingWells;
            } else {
                this.moonWellContainer = new Node('MoonWells');
                const canvas = find('Canvas');
                if (canvas) {
                    this.moonWellContainer.setParent(canvas);
                } else if (this.node.scene) {
                    this.moonWellContainer.setParent(this.node.scene);
                }
            }
        }
        
        // 创建普通树木容器
        if (!this.treeContainer) {
            const existingTrees = find('Trees');
            if (existingTrees) {
                this.treeContainer = existingTrees;
            } else {
                this.treeContainer = new Node('Trees');
                const canvas = find('Canvas');
                if (canvas) {
                    this.treeContainer.setParent(canvas);
                } else if (this.node.scene) {
                    this.treeContainer.setParent(this.node.scene);
                }
            }
        }

        // 创建猎手大厅容器
        if (!this.hunterHallContainer) {
            const existingHalls = find('HunterHalls');
            if (existingHalls) {
                this.hunterHallContainer = existingHalls;
            } else {
                this.hunterHallContainer = new Node('HunterHalls');
                const canvas = find('Canvas');
                if (canvas) {
                    this.hunterHallContainer.setParent(canvas);
                } else if (this.node.scene) {
                    this.hunterHallContainer.setParent(this.node.scene);
                }
            }
        }

        // 查找网格面板
        this.findGridPanel();

        // 初始化建筑物选择面板
        this.initBuildingPanel();

        // 监听触摸事件 - 使用capture阶段优先处理建筑物拖拽
        const canvasNode = find('Canvas');
        if (canvasNode) {
            // 使用capture阶段，优先处理建筑物拖拽，避免SelectionManager干扰
            // 注意：capture阶段在Cocos Creator中需要使用不同的方式
            canvasNode.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
            canvasNode.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            canvasNode.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        } else {
            // 如果没有Canvas，使用全局输入事件作为后备
            input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
            input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
            input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        }
    }

    onDestroy() {
        // 移除Canvas节点事件监听
        const canvasNode = find('Canvas');
        if (canvasNode) {
            canvasNode.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
            canvasNode.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            canvasNode.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        }
        // 移除全局输入事件监听（如果使用了）
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    }

    /**
     * 初始化建筑物选择面板
     */
    initBuildingPanel() {
        // 如果没有指定面板节点，创建一个
        if (!this.buildingSelectionPanel) {
            this.buildingSelectionPanel = new Node('BuildingSelectionPanel');
            const canvas = find('Canvas');
            if (canvas) {
                this.buildingSelectionPanel.setParent(canvas);
            } else {
                this.buildingSelectionPanel.setParent(this.node.scene);
            }

            // 设置面板位置（屏幕下方）
            const uiTransform = this.buildingSelectionPanel.addComponent(UITransform);
            const canvasTransform = canvas?.getComponent(UITransform);
            const screenHeight = canvasTransform?.height || 1334;
            uiTransform.setContentSize(750, screenHeight / 6); // 占屏幕1/6高度
            this.buildingSelectionPanel.setPosition(0, -screenHeight / 2 + screenHeight / 12, 0);

            // 添加背景
            const bg = new Node('Background');
            bg.setParent(this.buildingSelectionPanel);
            bg.setPosition(0, 0, 0);
            const bgTransform = bg.addComponent(UITransform);
            bgTransform.setContentSize(750, screenHeight / 6);
            const bgGraphics = bg.addComponent(Graphics);
            bgGraphics.fillColor = new Color(0, 0, 0, 200);
            bgGraphics.rect(-375, -screenHeight / 12, 750, screenHeight / 6);
            bgGraphics.fill();

            // 创建内容容器
            const content = new Node('Content');
            content.setParent(this.buildingSelectionPanel);
            content.setPosition(0, 0, 0);
            
            // 获取或添加BuildingSelectionPanel组件
            this.buildingPanel = this.buildingSelectionPanel.getComponent(BuildingSelectionPanel);
            if (!this.buildingPanel) {
                this.buildingPanel = this.buildingSelectionPanel.addComponent(BuildingSelectionPanel);
            }
            
            // 设置panelContent引用
            if (this.buildingPanel) {
                this.buildingPanel.panelContent = content;
            }
        } else {
            // 如果面板节点已存在，获取组件
            this.buildingPanel = this.buildingSelectionPanel.getComponent(BuildingSelectionPanel);
            if (!this.buildingPanel) {
                this.buildingPanel = this.buildingSelectionPanel.addComponent(BuildingSelectionPanel);
            }
        }

        // 设置建筑物类型
        const buildingTypes: BuildingType[] = [];
        if (this.warAncientTreePrefab) {
            buildingTypes.push({
                name: '弓箭手小屋',
                prefab: this.warAncientTreePrefab,
                cost: this.towerCost,
                icon: this.warAncientTreeIcon || null!,
                description: '可以生产Tower单位'
            });
        }
        if (this.moonWellPrefab) {
            buildingTypes.push({
                name: '月亮井',
                prefab: this.moonWellPrefab,
                cost: this.moonWellCost,
                icon: this.moonWellIcon || null!,
                description: '增加10个人口上限'
            });
        }
        if (this.treePrefab) {
            buildingTypes.push({
                name: '普通树木',
                prefab: this.treePrefab,
                cost: this.treeCost,
                icon: this.treeIcon || null!,
                description: '阻挡敌人，建造成本低'
            });
        }
        if (this.hunterHallPrefab) {
            buildingTypes.push({
                name: '猎手大厅',
                prefab: this.hunterHallPrefab,
                cost: this.hunterHallCost,
                icon: this.hunterHallIcon || null!,
                description: '可以生产女猎手单位'
            });
        }
        this.buildingPanel.setBuildingTypes(buildingTypes);

        // 设置回调
        this.buildingPanel.setOnBuildingSelected((building: BuildingType) => {
            this.currentSelectedBuilding = building;
        });

        this.buildingPanel.setOnBuild((building: BuildingType, position: Vec3) => {
            this.buildBuilding(building, position);
        });

        // 设置建造取消回调（当建造失败或取消时调用）
        this.buildingPanel.setOnBuildCancel(() => {
            this.disableBuildingMode();
        });
    }

    /**
     * 查找网格面板
     */
    findGridPanel() {
        if (this.buildingGridPanel) {
            this.gridPanel = this.buildingGridPanel.getComponent(BuildingGridPanel);
            if (this.gridPanel) {
                return;
            }
        }
        
        // 尝试查找场景中的网格面板
        const gridPanelNode = find('BuildingGridPanel');
        if (gridPanelNode) {
            this.gridPanel = gridPanelNode.getComponent(BuildingGridPanel);
            if (this.gridPanel) {
                this.buildingGridPanel = gridPanelNode;
                return;
            }
        }
        
        // 如果找不到，创建一个
        const canvas = find('Canvas');
        if (canvas) {
            const gridNode = new Node('BuildingGridPanel');
            gridNode.setParent(canvas);
            this.gridPanel = gridNode.addComponent(BuildingGridPanel);
            this.buildingGridPanel = gridNode;
        }
    }

    /**
     * 触摸开始事件（检测建筑物点击，进入拖拽模式）
     */
    onTouchStart(event: EventTouch) {
        // 如果正在建造模式，不处理拖拽
        if (this.isBuildingMode) {
            return;
        }

        // 检查是否点击在UI元素上
        const targetNode = event.target as Node;
        if (targetNode) {
            const nodeName = targetNode.name.toLowerCase();
            if (nodeName.includes('button') || 
                nodeName.includes('panel') || 
                nodeName.includes('label') ||
                nodeName.includes('selection') ||
                nodeName.includes('buildingitem')) {
                return;
            }
        }

        // 获取触摸位置并转换为世界坐标
        const touchLocation = event.getLocation();
        const cameraNode = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
        if (!cameraNode || !this.gridPanel) {
            return;
        }
        
        const camera = cameraNode.getComponent(Camera);
        if (!camera) {
            return;
        }

        // 将屏幕坐标转换为世界坐标
        const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
        const worldPos = new Vec3();
        camera.screenToWorld(screenPos, worldPos);
        worldPos.z = 0;

        // 检查是否点击在建筑物上
        const building = this.getBuildingAtPosition(worldPos);
        if (building && this.gridPanel.isPositionInGrid(worldPos)) {
            // 进入拖拽模式
            this.startDraggingBuilding(building);
            // 立即阻止事件传播到其他系统（包括SelectionManager）
            event.propagationStopped = true;
            return;
        }
    }

    /**
     * 触摸移动事件（用于拖拽预览和建筑物拖拽）
     */
    onTouchMove(event: EventTouch) {
        // 处理建筑物拖拽 - 优先处理，避免SelectionManager处理
        if (this.isDraggingBuilding && this.draggedBuilding) {
            // 立即阻止事件传播，避免SelectionManager处理多选框
            event.propagationStopped = true;
            
            // 获取触摸位置并转换为世界坐标
            const touchLocation = event.getLocation();
            const cameraNode = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
            if (!cameraNode || !this.gridPanel) {
                return;
            }
            
            const camera = cameraNode.getComponent(Camera);
            if (!camera) {
                return;
            }

            // 将屏幕坐标转换为世界坐标
            const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
            const worldPos = new Vec3();
            camera.screenToWorld(screenPos, worldPos);
            worldPos.z = 0;

            // 检查是否在网格内
            if (this.gridPanel.isPositionInGrid(worldPos)) {
                // 在网格内，对齐到最近的网格中心
                const gridCenter = this.gridPanel.getNearestGridCenter(worldPos);
                if (gridCenter) {
                    // 建筑物对齐到网格中心
                    this.draggedBuilding.setWorldPosition(gridCenter);
                    // 高亮显示目标网格（排除当前拖拽的建筑物）
                    this.gridPanel.highlightGrid(gridCenter, this.draggedBuilding);
                } else {
                    // 无法获取网格中心，保持当前位置但清除高亮
                    this.gridPanel.clearHighlight();
                }
            } else {
                // 不在网格内，保持建筑物在最后一个有效网格位置，清除高亮
                // 不清除高亮，让用户知道当前位置无效
                this.gridPanel.clearHighlight();
            }
            return;
        }

        // 原有的建造模式处理
        if (!this.isBuildingMode || !this.currentSelectedBuilding) {
            // 不在建造模式时清除高亮
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
            return;
        }

        // 检查是否点击在UI元素上
        const targetNode = event.target as Node;
        if (targetNode) {
            const nodeName = targetNode.name.toLowerCase();
            if (nodeName.includes('button') || 
                nodeName.includes('panel') || 
                nodeName.includes('label') ||
                nodeName.includes('selection') ||
                nodeName.includes('buildingitem')) {
                return;
            }
        }

        // 获取触摸位置并转换为世界坐标
        const touchLocation = event.getLocation();
        const cameraNode = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
        if (!cameraNode || !this.gridPanel) {
            return;
        }
        
        const camera = cameraNode.getComponent(Camera);
        if (!camera) {
            return;
        }

        // 将屏幕坐标转换为世界坐标
        const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
        const worldPos = new Vec3();
        camera.screenToWorld(screenPos, worldPos);
        worldPos.z = 0;

        // 高亮显示网格
        this.gridPanel.highlightGrid(worldPos);
    }

    findGameManager() {
        // 方法1: 通过节点名称查找
        let gmNode = find('GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager);
            if (this.gameManager) {
                console.debug('TowerBuilder: Found GameManager by name');
                return;
            }
        }
        
        // 方法2: 从场景根节点递归查找GameManager组件
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
            this.gameManager = findInScene(scene, GameManager);
            if (this.gameManager) {
                console.debug('TowerBuilder: Found GameManager recursively');
                return;
            }
        }
        
        // 方法3: 查找所有GameManager组件
        const sceneNodes = director.getScene()?.children || [];
        for (const child of sceneNodes) {
            this.gameManager = child.getComponent(GameManager);
            if (this.gameManager) {
                console.debug('TowerBuilder: Found GameManager by checking scene children');
                return;
            }
        }
        
        // 方法4: 查找Canvas节点下的GameManager
        const canvas = find('Canvas');
        if (canvas) {
            this.gameManager = canvas.getComponent(GameManager);
            if (this.gameManager) {
                console.debug('TowerBuilder: Found GameManager on Canvas');
                return;
            }
            
            // 查找Canvas的子节点
            for (const child of canvas.children) {
                this.gameManager = child.getComponent(GameManager);
                if (this.gameManager) {
                    console.debug('TowerBuilder: Found GameManager in Canvas children');
                    return;
                }
            }
        }
        
        // 如果还是找不到，输出警告
        console.warn('TowerBuilder: GameManager not found!');
    }

    enableBuildingMode() {
        this.isBuildingMode = true;
        // 显示建筑物选择面板
        if (this.buildingPanel) {
            this.buildingPanel.show();
        }
        
        // 显示网格面板
        if (!this.gridPanel) {
            this.findGridPanel();
        }
        if (this.gridPanel) {
            this.gridPanel.show();
        }
    }

    disableBuildingMode() {
        this.isBuildingMode = false;
        this.currentSelectedBuilding = null;
        
        // 隐藏建筑物选择面板
        if (this.buildingPanel) {
            this.buildingPanel.hide();
        }

        if (this.previewTower) {
            this.previewTower.destroy();
            this.previewTower = null!;
        }
        
        // 清除网格高亮（可以选择隐藏网格面板或保持可见）
        if (this.gridPanel) {
            this.gridPanel.clearHighlight();
            // 可选：隐藏网格面板
            // this.gridPanel.hide();
        }
    }

    /**
     * 获取是否在建造模式下（供外部调用）
     */
    getIsBuildingMode(): boolean {
        return this.isBuildingMode;
    }

    onTouchEnd(event: EventTouch) {
        // 处理建筑物拖拽结束 - 优先处理
        if (this.isDraggingBuilding && this.draggedBuilding) {
            // 立即阻止事件传播，避免SelectionManager处理
            event.propagationStopped = true;
            // 处理拖拽结束并放置建筑物
            this.endDraggingBuilding(event);
            return;
        }

        // 只在建造模式下处理
        if (!this.isBuildingMode || !this.currentSelectedBuilding) {
            // 不在建造模式或没有选中建筑物，不阻止事件传播
            return;
        }
        
        // 检查是否点击在UI元素上（如按钮、面板），如果是则不处理
        const targetNode = event.target as Node;
        if (targetNode) {
            const nodeName = targetNode.name.toLowerCase();
            // 检查节点名称
            if (nodeName.includes('button') || 
                nodeName.includes('panel') || 
                nodeName.includes('label') ||
                nodeName.includes('selection') ||
                nodeName.includes('buildingitem') ||
                nodeName.includes('buildingselection')) {
                return;
            }
            // 检查父节点
            let parent = targetNode.parent;
            while (parent) {
                const parentName = parent.name.toLowerCase();
                if (parentName.includes('ui') || 
                    parentName.includes('panel') ||
                    parentName.includes('buildingselection') ||
                    parentName === 'canvas') {
                    // 检查是否是Canvas的直接子节点（UI层）
                    if (parent.name === 'Canvas') {
                        // 检查是否是UI相关的子节点
                        const uiChildren = ['UI', 'UIManager', 'HealthLabel', 'TimerLabel', 'BuildingSelectionPanel'];
                        if (uiChildren.some(name => targetNode.name.includes(name) || 
                            targetNode.getPathInHierarchy().includes(name))) {
                            return;
                        }
                    } else {
                        // 如果父节点是UI相关，不处理
                        return;
                    }
                }
                parent = parent.parent;
            }
        }
        
        if (!this.targetCrystal) {
            this.disableBuildingMode();
            return;
        }

        // 阻止事件继续传播，避免SelectionManager处理
        event.propagationStopped = true;

        // 获取触摸位置
        const touchLocation = event.getLocation();
        
        // 查找Camera节点
        const cameraNode = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
        if (!cameraNode) {
            return;
        }
        
        const camera = cameraNode.getComponent(Camera);
        if (!camera) {
            return;
        }

        // 将屏幕坐标转换为世界坐标
        const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
        const worldPos = new Vec3();
        camera.screenToWorld(screenPos, worldPos);
        worldPos.z = 0;

        // 如果有网格面板，对齐到网格中心
        let finalWorldPos = worldPos;
        if (this.gridPanel) {
            const gridCenter = this.gridPanel.getNearestGridCenter(worldPos);
            if (gridCenter) {
                finalWorldPos = gridCenter;
            } else {
                // 不在网格内，清除高亮并返回
                this.gridPanel.clearHighlight();
                return;
            }
        }

        // 检查是否可以建造
        const canBuild = this.canBuildAt(finalWorldPos, this.currentSelectedBuilding);
        
        if (canBuild) {
            this.buildBuilding(this.currentSelectedBuilding, finalWorldPos);
        }
        
        // 清除高亮
        if (this.gridPanel) {
            this.gridPanel.clearHighlight();
        }
    }

    canBuildAt(position: Vec3, building: BuildingType): boolean {
        if (!this.targetCrystal || !building) {
            return false;
        }

        // 如果有网格面板，检查位置是否在网格内
        if (this.gridPanel) {
            if (!this.gridPanel.isPositionInGrid(position)) {
                return false;
            }
            
            // 检查目标网格是否已被占用
            const grid = this.gridPanel.worldToGrid(position);
            if (grid && this.gridPanel.isGridOccupied(grid.x, grid.y)) {
                return false;
            }
        }

        // 检查距离水晶的距离（保留原有逻辑作为备用检查）
        const crystalPos = this.targetCrystal.worldPosition;
        const distance = Vec3.distance(position, crystalPos);
        
        if (distance < this.minBuildDistance || distance > this.buildRange) {
            return false;
        }

        // 检查是否与现有弓箭手重叠
        const towers = this.towerContainer?.children || [];
        for (const tower of towers) {
            if (tower.active) {
                const towerDistance = Vec3.distance(position, tower.worldPosition);
                if (towerDistance < 60) { // 弓箭手之间的最小距离
                    return false;
                }
            }
        }

        // 检查是否与现有战争古树重叠
        const warAncients = this.warAncientTreeContainer?.children || [];
        for (const tree of warAncients) {
            if (tree.active) {
                const treeDistance = Vec3.distance(position, tree.worldPosition);
                if (treeDistance < 80) { // 战争古树之间的最小距离（稍大一些）
                    return false;
                }
            }
        }

        // 检查是否与现有月亮井重叠
        const wells = this.moonWellContainer?.children || [];
        for (const well of wells) {
            if (well.active) {
                const wellDistance = Vec3.distance(position, well.worldPosition);
                if (wellDistance < 80) { // 月亮井之间的最小距离
                    return false;
                }
            }
        }
        
        // 检查是否与现有普通树木重叠
        const trees = this.treeContainer?.children || [];
        for (const tree of trees) {
            if (tree.active) {
                const treeDistance = Vec3.distance(position, tree.worldPosition);
                if (treeDistance < 60) { // 普通树木之间的最小距离
                    return false;
                }
            }
        }

        // 检查是否与现有猎手大厅重叠
        const hunterHalls = this.hunterHallContainer?.children || [];
        for (const hall of hunterHalls) {
            if (hall.active) {
                const hallDistance = Vec3.distance(position, hall.worldPosition);
                if (hallDistance < 80) { // 猎手大厅之间的最小距离
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * 建造建筑物（通用方法）
     */
    buildBuilding(building: BuildingType, worldPosition: Vec3) {
        // 检查金币是否足够
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        if (this.gameManager && !this.gameManager.canAfford(building.cost)) {
            console.debug('TowerBuilder.buildBuilding: Not enough gold! Need', building.cost, 'but have', this.gameManager.getGold());
            // 显示金币不足弹窗
            GamePopup.showMessage('金币不足');
            // 不退出建造模式，让用户可以继续尝试或选择其他建筑物
            // 但需要重新显示建筑物选择面板
            if (this.buildingPanel) {
                this.buildingPanel.show();
            }
            return;
        }

        // 检查是否可以在此位置建造
        if (!this.canBuildAt(worldPosition, building)) {
            console.debug('TowerBuilder.buildBuilding: Cannot build at this position');
            // 不能建造时不退出建造模式，让用户可以继续尝试其他位置
            // 但需要重新显示建筑物选择面板
            if (this.buildingPanel) {
                this.buildingPanel.show();
            }
            return;
        }

        // 根据建筑物类型选择建造方法
        if (building.name === '弓箭手小屋' || building.prefab === this.warAncientTreePrefab) {
            this.buildWarAncientTree(worldPosition);
        } else if (building.name === '月亮井' || building.prefab === this.moonWellPrefab) {
            this.buildMoonWell(worldPosition);
        } else if (building.name === '普通树木' || building.prefab === this.treePrefab) {
            this.buildTree(worldPosition);
        } else if (building.name === '猎手大厅' || building.prefab === this.hunterHallPrefab) {
            this.buildHunterHall(worldPosition);
        } else {
            // 可以扩展其他建筑物类型
            console.warn('TowerBuilder.buildBuilding: Unknown building type:', building.name);
        }

        // 只有在成功建造后才退出建造模式
        this.disableBuildingMode();
    }

    /**
     * 建造战争古树
     */
    buildWarAncientTree(worldPosition: Vec3) {
        if (!this.warAncientTreePrefab) {
            console.error('TowerBuilder.buildWarAncientTree: warAncientTreePrefab is null!');
            return;
        }

        // 消耗金币
        if (this.gameManager) {
            this.gameManager.spendGold(this.towerCost);
        }

        // 创建战争古树
        const tree = instantiate(this.warAncientTreePrefab);
        
        // 设置父节点
        const parent = this.warAncientTreeContainer || this.node;
        if (parent && !parent.active) {
            parent.active = true;
        }
        
        tree.setParent(parent);
        tree.active = true;
        tree.setPosition(0, 0, 0);
        tree.setRotationFromEuler(0, 0, 0);
        tree.setScale(1, 1, 1);
        tree.setWorldPosition(worldPosition);

        // 设置建造成本并检查首次出现
        const treeScript = tree.getComponent(WarAncientTree);
        if (treeScript) {
            // 先应用配置（排除 buildCost，因为需要在实例化时动态设置）
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                configManager.applyConfigToUnit('WarAncientTree', treeScript, ['buildCost']);
            }
            
            // 然后设置建造成本（覆盖配置中的值）
            treeScript.buildCost = this.towerCost;
            
            // 记录网格位置并标记占用
            if (this.gridPanel) {
                const grid = this.gridPanel.worldToGrid(worldPosition);
                if (grid) {
                    treeScript.gridX = grid.x;
                    treeScript.gridY = grid.y;
                    this.gridPanel.occupyGrid(grid.x, grid.y, tree);
                }
            }
            
            // 检查单位是否首次出现
            if (this.gameManager) {
                const unitType = treeScript.unitType || 'WarAncientTree';
                this.gameManager.checkUnitFirstAppearance(unitType, treeScript);
            }
        }

        console.debug('TowerBuilder.buildWarAncientTree: Built at', worldPosition);
    }

    /**
     * 建造月亮井
     */
    buildMoonWell(worldPosition: Vec3) {
        if (!this.moonWellPrefab) {
            console.error('TowerBuilder.buildMoonWell: moonWellPrefab is null!');
            return;
        }

        // 消耗金币
        if (this.gameManager) {
            this.gameManager.spendGold(this.moonWellCost);
        }

        // 创建月亮井
        const well = instantiate(this.moonWellPrefab);
        
        // 设置父节点
        const parent = this.moonWellContainer || this.node;
        if (parent && !parent.active) {
            parent.active = true;
        }
        
        well.setParent(parent);
        well.active = true;
        well.setPosition(0, 0, 0);
        well.setRotationFromEuler(0, 0, 0);
        well.setScale(1, 1, 1);
        well.setWorldPosition(worldPosition);

        // 设置建造成本并增加人口上限
        const wellScript = well.getComponent(MoonWell);
        if (wellScript) {
            // 先应用配置（排除 buildCost）
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                configManager.applyConfigToUnit('MoonWell', wellScript, ['buildCost']);
            }
            
            // 然后设置建造成本（覆盖配置中的值）
            wellScript.buildCost = this.moonWellCost;
            
            // 记录网格位置并标记占用
            if (this.gridPanel) {
                const grid = this.gridPanel.worldToGrid(worldPosition);
                if (grid) {
                    wellScript.gridX = grid.x;
                    wellScript.gridY = grid.y;
                    this.gridPanel.occupyGrid(grid.x, grid.y, well);
                }
            }
            
            // 调用月亮井的方法来增加人口上限
            if (wellScript.increasePopulationLimit) {
                wellScript.increasePopulationLimit();
            }
            
            // 检查单位是否首次出现
            if (this.gameManager) {
                const unitType = wellScript.unitType || 'MoonWell';
                this.gameManager.checkUnitFirstAppearance(unitType, wellScript);
            }
        }

        console.debug('TowerBuilder.buildMoonWell: Built at', worldPosition);
    }
    
    /**
     * 建造普通树木
     */
    buildTree(worldPosition: Vec3) {
        if (!this.treePrefab) {
            console.error('TowerBuilder.buildTree: treePrefab is null!');
            return;
        }

        // 消耗金币
        if (this.gameManager) {
            this.gameManager.spendGold(this.treeCost);
        }

        // 创建普通树木
        const tree = instantiate(this.treePrefab);
        
        // 设置父节点
        const parent = this.treeContainer || this.node;
        if (parent && !parent.active) {
            parent.active = true;
        }
        
        tree.setParent(parent);
        tree.active = true;
        tree.setPosition(0, 0, 0);
        tree.setRotationFromEuler(0, 0, 0);
        tree.setScale(1, 1, 1);
        tree.setWorldPosition(worldPosition);

        // 设置建造成本并检查首次出现
        const treeScript = tree.getComponent(Tree);
        if (treeScript) {
            // 先应用配置（排除 buildCost）
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                configManager.applyConfigToUnit('Tree', treeScript, ['buildCost']);
            }
            
            // 然后设置建造成本（覆盖配置中的值）
            treeScript.buildCost = this.treeCost;
            
            // 记录网格位置并标记占用
            if (this.gridPanel) {
                const grid = this.gridPanel.worldToGrid(worldPosition);
                if (grid) {
                    treeScript.gridX = grid.x;
                    treeScript.gridY = grid.y;
                    this.gridPanel.occupyGrid(grid.x, grid.y, tree);
                }
            }
            
            // 检查单位是否首次出现
            if (this.gameManager) {
                const unitType = treeScript.unitType || 'Tree';
                this.gameManager.checkUnitFirstAppearance(unitType, treeScript);
            }
        }

        console.debug('TowerBuilder.buildTree: Built at', worldPosition);
    }

    /**
     * 建造猎手大厅
     */
    buildHunterHall(worldPosition: Vec3) {
        if (!this.hunterHallPrefab) {
            console.error('TowerBuilder.buildHunterHall: hunterHallPrefab is null!');
            return;
        }

        // 消耗金币
        if (this.gameManager) {
            this.gameManager.spendGold(this.hunterHallCost);
        }

        // 创建猎手大厅
        const hall = instantiate(this.hunterHallPrefab);
        
        // 设置父节点
        const parent = this.hunterHallContainer || this.node;
        if (parent && !parent.active) {
            parent.active = true;
        }
        
        hall.setParent(parent);
        hall.active = true;
        hall.setPosition(0, 0, 0);
        hall.setRotationFromEuler(0, 0, 0);
        hall.setScale(1, 1, 1);
        hall.setWorldPosition(worldPosition);

        // 设置建造成本并检查首次出现
        const hallScript = hall.getComponent(HunterHall);
        if (hallScript) {
            hallScript.buildCost = this.hunterHallCost;
            
            // 记录网格位置并标记占用
            if (this.gridPanel) {
                const grid = this.gridPanel.worldToGrid(worldPosition);
                if (grid) {
                    hallScript.gridX = grid.x;
                    hallScript.gridY = grid.y;
                    this.gridPanel.occupyGrid(grid.x, grid.y, hall);
                }
            }
            
            // 检查单位是否首次出现
            if (this.gameManager) {
                const unitType = hallScript.unitType || 'HunterHall';
                this.gameManager.checkUnitFirstAppearance(unitType, hallScript);
            }
        }

        console.debug('TowerBuilder.buildHunterHall: Built at', worldPosition);
    }

    // 可以通过按钮调用
    onBuildButtonClick() {
        // 检查warAncientTreePrefab是否设置
        if (!this.warAncientTreePrefab) {
            console.error('TowerBuilder: Cannot enable building mode - warAncientTreePrefab is not set!');
            return;
        }
        
        // 检查targetCrystal是否设置
        if (!this.targetCrystal) {
            this.targetCrystal = find('Crystal');
            if (!this.targetCrystal) {
                console.error('TowerBuilder: Cannot find Crystal node!');
                return;
            }
        }
        
        // 取消当前的单位选择
        this.clearCurrentSelection();
        
        this.enableBuildingMode();
    }
    
    /**
     * 获取指定位置的建筑物
     */
    getBuildingAtPosition(worldPos: Vec3): Node | null {
        // 检查所有建筑物容器
        const containers = [
            this.warAncientTreeContainer,
            this.moonWellContainer,
            this.treeContainer,
            this.hunterHallContainer
        ];

        for (const container of containers) {
            if (!container) continue;
            
            for (const child of container.children) {
                if (!child.active) continue;
                
                // 检查建筑物是否在点击位置附近（考虑碰撞半径）
                const distance = Vec3.distance(worldPos, child.worldPosition);
                if (distance < 50) { // 50像素的点击范围
                    return child;
                }
            }
        }
        
        return null;
    }

    /**
     * 开始拖拽建筑物
     */
    startDraggingBuilding(building: Node) {
        if (!this.gridPanel) {
            return;
        }

        // 获取建筑物的原始网格位置
        const originalGrid = this.gridPanel.getBuildingGridPosition(building);
        if (!originalGrid) {
            return;
        }

        this.isDraggingBuilding = true;
        this.draggedBuilding = building;
        this.draggedBuildingOriginalGrid = originalGrid;

        // 临时释放网格占用（拖拽时）
        this.gridPanel.releaseGrid(originalGrid.x, originalGrid.y);

        // 清除所有选择，避免出现多选框
        this.clearCurrentSelection();

        // 显示网格面板
        this.gridPanel.show();

        console.debug(`TowerBuilder: 开始拖拽建筑物，原始位置 (${originalGrid.x}, ${originalGrid.y})`);
    }

    /**
     * 结束拖拽建筑物
     */
    endDraggingBuilding(event: EventTouch) {
        if (!this.isDraggingBuilding || !this.draggedBuilding || !this.gridPanel) {
            // 如果状态不正确，确保清除拖拽状态
            this.isDraggingBuilding = false;
            this.draggedBuilding = null!;
            this.draggedBuildingOriginalGrid = null;
            return;
        }

        // 获取触摸位置并转换为世界坐标
        const touchLocation = event.getLocation();
        const cameraNode = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
        if (!cameraNode) {
            console.warn('TowerBuilder: 无法找到Camera节点，取消拖拽');
            this.cancelDraggingBuilding();
            return;
        }
        
        const camera = cameraNode.getComponent(Camera);
        if (!camera) {
            console.warn('TowerBuilder: 无法获取Camera组件，取消拖拽');
            this.cancelDraggingBuilding();
            return;
        }

        // 将屏幕坐标转换为世界坐标
        const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
        const worldPos = new Vec3();
        camera.screenToWorld(screenPos, worldPos);
        worldPos.z = 0;

        // 检查是否在网格内
        if (!this.gridPanel.isPositionInGrid(worldPos)) {
            // 不在网格内，取消拖拽，恢复原位置
            console.debug('TowerBuilder: 拖拽结束位置不在网格内，恢复原位置');
            this.cancelDraggingBuilding();
            return;
        }

        // 获取最近的网格中心位置（确保对齐到格子中央）
        const gridCenter = this.gridPanel.getNearestGridCenter(worldPos);
        if (!gridCenter) {
            // 无法获取网格中心，取消拖拽
            console.warn('TowerBuilder: 无法获取网格中心，取消拖拽');
            this.cancelDraggingBuilding();
            return;
        }

        // 获取目标网格（使用对齐后的位置）
        const targetGrid = this.gridPanel.worldToGrid(gridCenter);
        if (!targetGrid) {
            console.warn('TowerBuilder: 无法获取目标网格，取消拖拽');
            this.cancelDraggingBuilding();
            return;
        }

        // 检查目标网格是否被其他建筑物占用
        const isOccupiedByOther = this.gridPanel.isGridOccupiedByOther(
            targetGrid.x, 
            targetGrid.y, 
            this.draggedBuilding
        );

        if (isOccupiedByOther) {
            // 目标位置有其他建筑物，交换位置
            // 注意：由于拖拽时已经释放了原始网格，所以需要通过网格单元格直接获取建筑物
            const cell = (this.gridPanel as any).gridCells[targetGrid.y][targetGrid.x];
            const otherBuilding = cell ? cell.buildingNode : null;
            
            if (otherBuilding && otherBuilding !== this.draggedBuilding) {
                // 使用保存的原始网格位置进行交换
                if (this.draggedBuildingOriginalGrid) {
                    console.debug(`TowerBuilder: 准备交换 - 建筑物1: (${this.draggedBuildingOriginalGrid.x}, ${this.draggedBuildingOriginalGrid.y}), 建筑物2: (${targetGrid.x}, ${targetGrid.y})`);
                    this.swapBuildingsWithGrid(
                        this.draggedBuilding, 
                        this.draggedBuildingOriginalGrid.x, 
                        this.draggedBuildingOriginalGrid.y,
                        otherBuilding,
                        targetGrid.x,
                        targetGrid.y
                    );
                } else {
                    // 如果找不到原始位置，恢复原位置
                    console.warn('TowerBuilder: 找不到原始网格位置，取消交换');
                    this.cancelDraggingBuilding();
                    return;
                }
            } else {
                // 找不到其他建筑物，恢复原位置
                console.warn('TowerBuilder: 找不到目标位置的建筑物，取消交换');
                this.cancelDraggingBuilding();
                return;
            }
        } else {
            // 目标位置为空，直接移动
            console.debug(`TowerBuilder: 移动建筑物到网格 (${targetGrid.x}, ${targetGrid.y})`);
            this.moveBuildingToGrid(this.draggedBuilding, targetGrid.x, targetGrid.y);
        }

        // 保存拖拽的建筑物节点引用（在清除状态前）
        const buildingToDeselect = this.draggedBuilding;
        
        // 清除拖拽状态
        this.isDraggingBuilding = false;
        this.draggedBuilding = null!;
        this.draggedBuildingOriginalGrid = null;

        // 清除高亮
        this.gridPanel.clearHighlight();
        
        // 清除建筑物的选中状态
        this.clearCurrentSelection();
        
        // 如果建筑物节点仍然有效，直接清除其选中状态
        if (buildingToDeselect && buildingToDeselect.isValid) {
            // 直接清除UnitSelectionManager中该建筑物的选中状态
            const unitSelectionManagerNode = find('UnitSelectionManager');
            if (unitSelectionManagerNode) {
                const unitSelectionManager = unitSelectionManagerNode.getComponent(UnitSelectionManager);
                if (unitSelectionManager) {
                    // 检查该建筑物是否被选中
                    if (unitSelectionManager.isUnitSelected(buildingToDeselect)) {
                        console.debug('TowerBuilder: 直接清除建筑物的选中状态');
                        unitSelectionManager.clearSelection();
                    }
                }
            }
        }
        
        console.debug('TowerBuilder: 建筑物拖拽结束，已放置');
    }

    /**
     * 取消拖拽建筑物（恢复原位置）
     */
    cancelDraggingBuilding() {
        if (!this.isDraggingBuilding || !this.draggedBuilding || !this.gridPanel || !this.draggedBuildingOriginalGrid) {
            return;
        }

        // 保存拖拽的建筑物节点引用（在清除状态前）
        const buildingToDeselect = this.draggedBuilding;

        // 恢复原网格位置
        this.moveBuildingToGrid(
            this.draggedBuilding,
            this.draggedBuildingOriginalGrid.x,
            this.draggedBuildingOriginalGrid.y
        );

        // 清除拖拽状态
        this.isDraggingBuilding = false;
        this.draggedBuilding = null!;
        this.draggedBuildingOriginalGrid = null;

        // 清除高亮
        this.gridPanel.clearHighlight();
        
        // 清除建筑物的选中状态
        this.clearCurrentSelection();
        
        // 如果建筑物节点仍然有效，直接清除其选中状态
        if (buildingToDeselect && buildingToDeselect.isValid) {
            // 直接清除UnitSelectionManager中该建筑物的选中状态
            const unitSelectionManagerNode = find('UnitSelectionManager');
            if (unitSelectionManagerNode) {
                const unitSelectionManager = unitSelectionManagerNode.getComponent(UnitSelectionManager);
                if (unitSelectionManager) {
                    // 检查该建筑物是否被选中
                    if (unitSelectionManager.isUnitSelected(buildingToDeselect)) {
                        console.debug('TowerBuilder: 取消拖拽时直接清除建筑物的选中状态');
                        unitSelectionManager.clearSelection();
                    }
                }
            }
        }
    }

    /**
     * 移动建筑物到指定网格
     */
    moveBuildingToGrid(building: Node, gridX: number, gridY: number) {
        if (!this.gridPanel) {
            return;
        }

        // 获取目标世界坐标
        const targetWorldPos = this.gridPanel.gridToWorld(gridX, gridY);
        if (!targetWorldPos) {
            return;
        }

        // 获取建筑物脚本（不同建筑物类型有不同的脚本）
        const warAncientTree = building.getComponent(WarAncientTree);
        const moonWell = building.getComponent(MoonWell);
        const tree = building.getComponent(Tree);
        const hunterHall = building.getComponent(HunterHall);

        // 更新网格占用
        const oldGrid = this.gridPanel.getBuildingGridPosition(building);
        if (oldGrid) {
            this.gridPanel.releaseGrid(oldGrid.x, oldGrid.y);
        }
        this.gridPanel.occupyGrid(gridX, gridY, building);

        // 更新建筑物位置和网格坐标
        if (warAncientTree) {
            warAncientTree.gridX = gridX;
            warAncientTree.gridY = gridY;
            if (warAncientTree.moveToGridPosition) {
                warAncientTree.moveToGridPosition(gridX, gridY);
            } else {
                building.setWorldPosition(targetWorldPos);
            }
        } else if (moonWell) {
            moonWell.gridX = gridX;
            moonWell.gridY = gridY;
            if (moonWell.moveToGridPosition) {
                moonWell.moveToGridPosition(gridX, gridY);
            } else {
                building.setWorldPosition(targetWorldPos);
            }
        } else if (tree) {
            tree.gridX = gridX;
            tree.gridY = gridY;
            if (tree.moveToGridPosition) {
                tree.moveToGridPosition(gridX, gridY);
            } else {
                building.setWorldPosition(targetWorldPos);
            }
        } else if (hunterHall) {
            hunterHall.gridX = gridX;
            hunterHall.gridY = gridY;
            if (hunterHall.moveToGridPosition) {
                hunterHall.moveToGridPosition(gridX, gridY);
            } else {
                building.setWorldPosition(targetWorldPos);
            }
        } else {
            // 如果没有找到脚本，直接设置位置
            building.setWorldPosition(targetWorldPos);
        }

        console.debug(`TowerBuilder: 建筑物移动到网格 (${gridX}, ${gridY})`);
    }

    /**
     * 交换两个建筑物的位置（使用已知的网格位置）
     */
    swapBuildingsWithGrid(
        building1: Node, 
        grid1X: number, 
        grid1Y: number,
        building2: Node,
        grid2X: number,
        grid2Y: number
    ) {
        if (!this.gridPanel) {
            return;
        }

        // 获取目标世界坐标
        const targetWorldPos1 = this.gridPanel.gridToWorld(grid2X, grid2Y);
        const targetWorldPos2 = this.gridPanel.gridToWorld(grid1X, grid1Y);
        
        if (!targetWorldPos1 || !targetWorldPos2) {
            return;
        }

        // 获取建筑物脚本
        const warAncientTree1 = building1.getComponent(WarAncientTree);
        const moonWell1 = building1.getComponent(MoonWell);
        const tree1 = building1.getComponent(Tree);
        const hunterHall1 = building1.getComponent(HunterHall);

        const warAncientTree2 = building2.getComponent(WarAncientTree);
        const moonWell2 = building2.getComponent(MoonWell);
        const tree2 = building2.getComponent(Tree);
        const hunterHall2 = building2.getComponent(HunterHall);

        // 先释放两个网格
        this.gridPanel.releaseGrid(grid1X, grid1Y);
        this.gridPanel.releaseGrid(grid2X, grid2Y);
        
        // 交换占用
        this.gridPanel.occupyGrid(grid2X, grid2Y, building1);
        this.gridPanel.occupyGrid(grid1X, grid1Y, building2);

        // 更新建筑物1的位置和网格坐标
        if (warAncientTree1) {
            warAncientTree1.gridX = grid2X;
            warAncientTree1.gridY = grid2Y;
            if (warAncientTree1.moveToGridPosition) {
                warAncientTree1.moveToGridPosition(grid2X, grid2Y);
            } else {
                building1.setWorldPosition(targetWorldPos1);
            }
        } else if (moonWell1) {
            moonWell1.gridX = grid2X;
            moonWell1.gridY = grid2Y;
            if (moonWell1.moveToGridPosition) {
                moonWell1.moveToGridPosition(grid2X, grid2Y);
            } else {
                building1.setWorldPosition(targetWorldPos1);
            }
        } else if (tree1) {
            tree1.gridX = grid2X;
            tree1.gridY = grid2Y;
            if (tree1.moveToGridPosition) {
                tree1.moveToGridPosition(grid2X, grid2Y);
            } else {
                building1.setWorldPosition(targetWorldPos1);
            }
        } else if (hunterHall1) {
            hunterHall1.gridX = grid2X;
            hunterHall1.gridY = grid2Y;
            if (hunterHall1.moveToGridPosition) {
                hunterHall1.moveToGridPosition(grid2X, grid2Y);
            } else {
                building1.setWorldPosition(targetWorldPos1);
            }
        } else {
            building1.setWorldPosition(targetWorldPos1);
        }

        // 更新建筑物2的位置和网格坐标
        if (warAncientTree2) {
            warAncientTree2.gridX = grid1X;
            warAncientTree2.gridY = grid1Y;
            if (warAncientTree2.moveToGridPosition) {
                warAncientTree2.moveToGridPosition(grid1X, grid1Y);
            } else {
                building2.setWorldPosition(targetWorldPos2);
            }
        } else if (moonWell2) {
            moonWell2.gridX = grid1X;
            moonWell2.gridY = grid1Y;
            if (moonWell2.moveToGridPosition) {
                moonWell2.moveToGridPosition(grid1X, grid1Y);
            } else {
                building2.setWorldPosition(targetWorldPos2);
            }
        } else if (tree2) {
            tree2.gridX = grid1X;
            tree2.gridY = grid1Y;
            if (tree2.moveToGridPosition) {
                tree2.moveToGridPosition(grid1X, grid1Y);
            } else {
                building2.setWorldPosition(targetWorldPos2);
            }
        } else if (hunterHall2) {
            hunterHall2.gridX = grid1X;
            hunterHall2.gridY = grid1Y;
            if (hunterHall2.moveToGridPosition) {
                hunterHall2.moveToGridPosition(grid1X, grid1Y);
            } else {
                building2.setWorldPosition(targetWorldPos2);
            }
        } else {
            building2.setWorldPosition(targetWorldPos2);
        }

        console.debug(`TowerBuilder: 交换建筑物位置 - 建筑物1: (${grid1X}, ${grid1Y}) <-> 建筑物2: (${grid2X}, ${grid2Y})`);
    }

    /**
     * 交换两个建筑物的位置（通过查找网格位置）
     */
    swapBuildings(building1: Node, building2: Node) {
        if (!this.gridPanel) {
            return;
        }

        // 获取两个建筑物的网格位置
        const grid1 = this.gridPanel.getBuildingGridPosition(building1);
        const grid2 = this.gridPanel.getBuildingGridPosition(building2);

        if (!grid1 || !grid2) {
            return;
        }

        // 使用已知网格位置进行交换
        this.swapBuildingsWithGrid(building1, grid1.x, grid1.y, building2, grid2.x, grid2.y);
    }

    /**
     * 取消当前的单位选择
     */
    clearCurrentSelection() {
        console.debug('TowerBuilder.clearCurrentSelection: 开始清除选择状态');
        
        // 清除UnitSelectionManager的选择
        const unitSelectionManagerNode = find('UnitSelectionManager');
        if (unitSelectionManagerNode) {
            const unitSelectionManager = unitSelectionManagerNode.getComponent(UnitSelectionManager);
            if (unitSelectionManager) {
                console.debug('TowerBuilder.clearCurrentSelection: 找到UnitSelectionManager，清除选择');
                unitSelectionManager.clearSelection();
                console.debug('TowerBuilder.clearCurrentSelection: UnitSelectionManager selection cleared');
            } else {
                console.warn('TowerBuilder.clearCurrentSelection: UnitSelectionManager节点存在但没有组件');
            }
        } else {
            // 如果找不到UnitSelectionManager节点，尝试在场景中查找组件
            const scene = this.node.scene;
            if (scene) {
                const unitSelectionManager = scene.getComponentInChildren(UnitSelectionManager);
                if (unitSelectionManager) {
                    console.debug('TowerBuilder.clearCurrentSelection: 在场景中找到UnitSelectionManager，清除选择');
                    unitSelectionManager.clearSelection();
                    console.debug('TowerBuilder.clearCurrentSelection: UnitSelectionManager selection cleared');
                } else {
                    console.warn('TowerBuilder.clearCurrentSelection: 无法找到UnitSelectionManager组件');
                }
            }
        }
        
        // 清除SelectionManager的选择（管理小精灵和防御塔的选择）
        const selectionManagerNode = find('SelectionManager');
        if (selectionManagerNode) {
            const selectionManager = selectionManagerNode.getComponent('SelectionManager') as any;
            if (selectionManager) {
                if (selectionManager.clearSelection) {
                    selectionManager.clearSelection();
                    console.debug('TowerBuilder.clearCurrentSelection: SelectionManager selection cleared');
                }
            }
        } else {
            // 如果找不到SelectionManager节点，尝试在场景中查找组件
            const scene = this.node.scene;
            if (scene) {
                const selectionManager = scene.getComponentInChildren('SelectionManager') as any;
                if (selectionManager && selectionManager.clearSelection) {
                    selectionManager.clearSelection();
                    console.debug('TowerBuilder.clearCurrentSelection: SelectionManager selection cleared');
                }
            }
        }
        
        console.debug('TowerBuilder.clearCurrentSelection: 清除选择状态完成');
    }
}

