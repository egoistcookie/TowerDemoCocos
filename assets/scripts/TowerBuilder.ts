import { _decorator, Component, Node, Prefab, instantiate, Vec3, EventTouch, input, Input, Camera, find, view, UITransform, SpriteFrame, Graphics, Color } from 'cc';
import { GameManager } from './GameManager';
import { BuildingSelectionPanel, BuildingType } from './BuildingSelectionPanel';
import { GamePopup } from './GamePopup';
import { UnitSelectionManager } from './UnitSelectionManager';
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

    @property
    towerCost: number = 10; // 战争古树建造成本（10金币）

    @property
    moonWellCost: number = 10; // 月亮井建造成本（10金币）

    private isBuildingMode: boolean = false;
    private previewTower: Node = null!;
    private gameManager: GameManager = null!;
    private buildingPanel: BuildingSelectionPanel = null!;
    private currentSelectedBuilding: BuildingType | null = null;

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

        // 初始化建筑物选择面板
        this.initBuildingPanel();

        // 监听触摸事件 - 使用Canvas节点事件，不使用capture阶段，避免干扰SelectionManager
        const canvasNode = find('Canvas');
        if (canvasNode) {
            // 不使用capture阶段，让SelectionManager先处理，只在建造模式下才处理
            canvasNode.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            canvasNode.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        } else {
            // 如果没有Canvas，使用全局输入事件作为后备
            input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
            input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        }
    }

    onDestroy() {
        // 移除Canvas节点事件监听
        const canvasNode = find('Canvas');
        if (canvasNode) {
            canvasNode.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            canvasNode.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        }
        // 移除全局输入事件监听（如果使用了）
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
                name: '战争古树',
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
        this.buildingPanel.setBuildingTypes(buildingTypes);

        // 设置回调
        this.buildingPanel.setOnBuildingSelected((building: BuildingType) => {
            this.currentSelectedBuilding = building;
        });

        this.buildingPanel.setOnBuild((building: BuildingType, position: Vec3) => {
            this.buildBuilding(building, position);
        });
    }

    /**
     * 触摸移动事件（用于拖拽预览）
     */
    onTouchMove(event: EventTouch) {
        if (!this.isBuildingMode || !this.currentSelectedBuilding) {
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
    }

    findGameManager() {
        // 方法1: 通过节点名称查找
        let gmNode = find('GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager);
            if (this.gameManager) {
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
        }
    }

    enableBuildingMode() {
        this.isBuildingMode = true;
        // 显示建筑物选择面板
        if (this.buildingPanel) {
            this.buildingPanel.show();
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
    }

    /**
     * 获取是否在建造模式下（供外部调用）
     */
    getIsBuildingMode(): boolean {
        return this.isBuildingMode;
    }

    onTouchEnd(event: EventTouch) {
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

        // 检查是否可以建造
        const canBuild = this.canBuildAt(worldPos, this.currentSelectedBuilding);
        
        if (canBuild) {
            this.buildBuilding(this.currentSelectedBuilding, worldPos);
        }
    }

    canBuildAt(position: Vec3, building: BuildingType): boolean {
        if (!this.targetCrystal || !building) {
            return false;
        }

        // 检查距离水晶的距离
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
        const trees = this.warAncientTreeContainer?.children || [];
        for (const tree of trees) {
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
            console.log('TowerBuilder.buildBuilding: Not enough gold! Need', building.cost, 'but have', this.gameManager.getGold());
            // 显示金币不足弹窗
            GamePopup.showMessage('金币不足');
            this.disableBuildingMode();
            return;
        }

        // 检查是否可以在此位置建造
        if (!this.canBuildAt(worldPosition, building)) {
            console.log('TowerBuilder.buildBuilding: Cannot build at this position');
            // 即使不能建造，也退出建造模式
            this.disableBuildingMode();
            return;
        }

        // 根据建筑物类型选择建造方法
        if (building.name === '战争古树' || building.prefab === this.warAncientTreePrefab) {
            this.buildWarAncientTree(worldPosition);
        } else if (building.name === '月亮井' || building.prefab === this.moonWellPrefab) {
            this.buildMoonWell(worldPosition);
        } else {
            // 可以扩展其他建筑物类型
            console.warn('TowerBuilder.buildBuilding: Unknown building type:', building.name);
        }

        // 退出建造模式
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

        // 设置建造成本
        const treeScript = tree.getComponent('WarAncientTree') as any;
        if (treeScript) {
            treeScript.buildCost = this.towerCost;
        }

        console.log('TowerBuilder.buildWarAncientTree: Built at', worldPosition);
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
        const wellScript = well.getComponent('MoonWell') as any;
        if (wellScript) {
            wellScript.buildCost = this.moonWellCost;
            // 调用月亮井的方法来增加人口上限
            if (wellScript.increasePopulationLimit) {
                wellScript.increasePopulationLimit();
            }
        }

        console.log('TowerBuilder.buildMoonWell: Built at', worldPosition);
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
     * 取消当前的单位选择
     */
    clearCurrentSelection() {
        // 清除UnitSelectionManager的选择
        const unitSelectionManagerNode = find('UnitSelectionManager');
        if (unitSelectionManagerNode) {
            const unitSelectionManager = unitSelectionManagerNode.getComponent(UnitSelectionManager);
            if (unitSelectionManager) {
                unitSelectionManager.clearSelection();
                console.log('TowerBuilder.clearCurrentSelection: UnitSelectionManager selection cleared');
            }
        } else {
            // 如果找不到UnitSelectionManager节点，尝试在场景中查找组件
            const scene = this.node.scene;
            if (scene) {
                const unitSelectionManager = scene.getComponentInChildren(UnitSelectionManager);
                if (unitSelectionManager) {
                    unitSelectionManager.clearSelection();
                    console.log('TowerBuilder.clearCurrentSelection: UnitSelectionManager selection cleared');
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
                    console.log('TowerBuilder.clearCurrentSelection: SelectionManager selection cleared');
                }
            }
        } else {
            // 如果找不到SelectionManager节点，尝试在场景中查找组件
            const scene = this.node.scene;
            if (scene) {
                const selectionManager = scene.getComponentInChildren('SelectionManager') as any;
                if (selectionManager && selectionManager.clearSelection) {
                    selectionManager.clearSelection();
                    console.log('TowerBuilder.clearCurrentSelection: SelectionManager selection cleared');
                }
            }
        }
    }
}

