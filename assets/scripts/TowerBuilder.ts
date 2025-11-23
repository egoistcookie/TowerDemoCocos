import { _decorator, Component, Node, Prefab, instantiate, Vec3, EventTouch, input, Input, Camera, find, view, UITransform } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('TowerBuilder')
export class TowerBuilder extends Component {
    @property(Prefab)
    warAncientTreePrefab: Prefab = null!; // 战争古树预制体

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

    @property
    towerCost: number = 10; // 战争古树建造成本（10金币）

    private isBuildingMode: boolean = false;
    private previewTower: Node = null!;
    private gameManager: GameManager = null!;

    start() {
        // 查找游戏管理器
        this.findGameManager();
        
        // 查找水晶
        if (!this.targetCrystal) {
            this.targetCrystal = find('Crystal');
        }

        // 创建防御塔容器
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

        // 监听触摸事件 - 使用Canvas节点事件，不使用capture阶段，避免干扰SelectionManager
        const canvasNode = find('Canvas');
        if (canvasNode) {
            // 不使用capture阶段，让SelectionManager先处理，只在建造模式下才处理
            canvasNode.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        } else {
            // 如果没有Canvas，使用全局输入事件作为后备
            input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        }
    }

    onDestroy() {
        // 移除Canvas节点事件监听
        const canvasNode = find('Canvas');
        if (canvasNode) {
            canvasNode.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        }
        // 移除全局输入事件监听（如果使用了）
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
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
    }

    disableBuildingMode() {
        this.isBuildingMode = false;
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
        if (!this.isBuildingMode) {
            // 不在建造模式，不阻止事件传播，让SelectionManager处理
            return;
        }
        
        // 检查是否点击在UI元素上（如按钮），如果是则不处理
        const targetNode = event.target as Node;
        if (targetNode) {
            const nodeName = targetNode.name.toLowerCase();
            // 检查节点名称
            if (nodeName.includes('button') || 
                nodeName.includes('panel') || 
                nodeName.includes('label') ||
                nodeName.includes('selection')) {
                return;
            }
            // 检查父节点
            let parent = targetNode.parent;
            while (parent) {
                const parentName = parent.name.toLowerCase();
                if (parentName.includes('ui') || 
                    parentName.includes('panel') ||
                    parentName === 'canvas') {
                    // 检查是否是Canvas的直接子节点（UI层）
                    if (parent.name === 'Canvas') {
                        // 检查是否是UI相关的子节点
                        const uiChildren = ['UI', 'UIManager', 'HealthLabel', 'TimerLabel'];
                        if (uiChildren.some(name => targetNode.name.includes(name) || 
                            targetNode.getPathInHierarchy().includes(name))) {
                            return;
                        }
                    }
                }
                parent = parent.parent;
            }
        }
        
        if (!this.warAncientTreePrefab || !this.targetCrystal) {
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
        const canBuild = this.canBuildAt(worldPos);
        
        if (canBuild) {
            this.buildTower(worldPos);
        }
    }

    canBuildAt(position: Vec3): boolean {
        if (!this.targetCrystal) {
            return false;
        }

        // 检查距离水晶的距离
        const crystalPos = this.targetCrystal.worldPosition;
        const distance = Vec3.distance(position, crystalPos);
        
        if (distance < this.minBuildDistance || distance > this.buildRange) {
            return false;
        }

        // 检查是否与现有防御塔重叠
        const towers = this.towerContainer?.children || [];
        for (const tower of towers) {
            if (tower.active) {
                const towerDistance = Vec3.distance(position, tower.worldPosition);
                if (towerDistance < 60) { // 防御塔之间的最小距离
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

        return true;
    }

    buildTower(worldPosition: Vec3) {
        // 检查金币是否足够
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        if (this.gameManager && !this.gameManager.canAfford(this.towerCost)) {
            console.log('TowerBuilder.buildTower: Not enough gold! Need', this.towerCost, 'but have', this.gameManager.getGold());
            this.disableBuildingMode();
            return;
        }

        // 再次检查warAncientTreePrefab
        if (!this.warAncientTreePrefab) {
            console.error('TowerBuilder.buildTower: warAncientTreePrefab is null! Cannot build.');
            this.disableBuildingMode();
            return;
        }

        // 检查warAncientTreeContainer
        if (!this.warAncientTreeContainer) {
            console.error('TowerBuilder.buildTower: warAncientTreeContainer is null! Creating new one.');
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
        
        // 确保战争古树容器在Canvas下
        const containerCanvasNode = find('Canvas');
        if (containerCanvasNode && this.warAncientTreeContainer.parent !== containerCanvasNode) {
            console.warn('TowerBuilder.buildTower: WarAncientTree container is not under Canvas, moving to Canvas');
            const oldWorldPos = this.warAncientTreeContainer.worldPosition;
            this.warAncientTreeContainer.setParent(containerCanvasNode);
            this.warAncientTreeContainer.setWorldPosition(oldWorldPos);
            console.log('TowerBuilder.buildTower: Moved container to Canvas');
        }

        // 消耗金币
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        if (this.gameManager) {
            const goldBefore = this.gameManager.getGold();
            console.log('TowerBuilder.buildTower: Gold before spending:', goldBefore);
            console.log('TowerBuilder.buildTower: WarAncientTree cost:', this.towerCost);
            console.log('TowerBuilder.buildTower: Can afford:', this.gameManager.canAfford(this.towerCost));
            
            this.gameManager.spendGold(this.towerCost);
            const goldAfter = this.gameManager.getGold();
            console.log('TowerBuilder.buildTower: Spent', this.towerCost, 'gold. Before:', goldBefore, 'After:', goldAfter);
        } else {
            console.error('TowerBuilder.buildTower: Cannot spend gold - gameManager is null!');
        }

        
        if (!this.warAncientTreePrefab) {
            console.error('TowerBuilder.buildTower: warAncientTreePrefab is null! Cannot build war ancient tree.');
            return;
        }
        
        const tree = instantiate(this.warAncientTreePrefab);
        
        // 设置父节点
        const parent = this.warAncientTreeContainer || this.node;
        
        // 确保父节点是激活的
        if (parent && !parent.active) {
            parent.active = true;
        }
        
        tree.setParent(parent);
        
        // 立即激活战争古树节点
        tree.active = true;
        
        // 重置战争古树的本地位置和旋转
        tree.setPosition(0, 0, 0);
        tree.setRotationFromEuler(0, 0, 0);
        tree.setScale(1, 1, 1);
        
        // 直接使用世界坐标设置位置
        tree.setWorldPosition(worldPosition);
        
        // 确保战争古树脚本组件存在并设置建造成本
        const treeScript = tree.getComponent('WarAncientTree') as any;
        if (treeScript) {
            treeScript.buildCost = this.towerCost;
        } else {
            console.error('TowerBuilder.buildTower: WarAncientTree script not found on prefab!');
        }
        
        // 确保所有组件和子节点都是激活的
        const treeUITransform = tree.getComponent(UITransform);
        const treeSprite = tree.getComponent('Sprite') as any;
        
        if (treeUITransform) {
            treeUITransform.enabled = true;
        }
        if (treeSprite) {
            treeSprite.enabled = true;
        }
        
        const setNodeActive = (node: Node, active: boolean) => {
            node.active = active;
            for (const child of node.children) {
                setNodeActive(child, active);
            }
        };
        setNodeActive(tree, true);
        
        // 强制更新节点变换，确保立即渲染
        tree.updateWorldTransform();

        // 退出建造模式
        this.disableBuildingMode();
    }

    // 可以通过按钮调用
    onBuildButtonClick() {
        // 检查金币是否足够
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        if (this.gameManager && !this.gameManager.canAfford(this.towerCost)) {
            return;
        }
        
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
        
        this.enableBuildingMode();
    }
}

