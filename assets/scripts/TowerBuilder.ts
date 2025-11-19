import { _decorator, Component, Node, Prefab, instantiate, Vec3, EventTouch, input, Input, Camera, find, view, UITransform } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('TowerBuilder')
export class TowerBuilder extends Component {
    @property(Prefab)
    towerPrefab: Prefab = null!;

    @property
    buildRange: number = 300; // 建造范围（距离水晶）

    @property
    minBuildDistance: number = 80; // 最小建造距离（距离水晶）

    @property(Node)
    targetCrystal: Node = null!;

    @property(Node)
    towerContainer: Node = null!;

    @property
    towerCost: number = 5; // 防御塔建造成本

    private isBuildingMode: boolean = false;
    private previewTower: Node = null!;
    private gameManager: GameManager = null!;

    start() {
        console.log('TowerBuilder: start() called');
        console.log('TowerBuilder: towerPrefab:', this.towerPrefab ? 'set' : 'null');
        
        // 查找游戏管理器
        this.findGameManager();
        
        // 查找水晶
        if (!this.targetCrystal) {
            this.targetCrystal = find('Crystal');
            console.log('TowerBuilder: Found crystal:', this.targetCrystal ? this.targetCrystal.name : 'null');
        }

        // 创建防御塔容器
        if (!this.towerContainer) {
            // 先尝试查找现有的Towers节点
            const existingTowers = find('Towers');
            if (existingTowers) {
                this.towerContainer = existingTowers;
                console.log('TowerBuilder: Found existing Towers container');
            } else {
                this.towerContainer = new Node('Towers');
                this.towerContainer.setParent(this.node.scene);
                console.log('TowerBuilder: Created new Towers container');
            }
        }

        // 监听触摸事件
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        console.log('TowerBuilder: Touch event listener registered');
    }

    onDestroy() {
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

    onTouchEnd(event: EventTouch) {
        console.log('TowerBuilder: Touch event received, isBuildingMode:', this.isBuildingMode);
        console.log('TowerBuilder: towerPrefab check:', this.towerPrefab ? 'exists' : 'null');
        
        if (!this.isBuildingMode) {
            console.log('TowerBuilder: Not in building mode, ignoring touch');
            return;
        }
        
        // 重新检查towerPrefab，如果为null则尝试重新获取
        if (!this.towerPrefab) {
            console.error('TowerBuilder: towerPrefab is null! Cannot build tower.');
            console.error('TowerBuilder: Please check TowerBuilder node properties - towerPrefab must be assigned!');
            // 退出建造模式，避免卡住
            this.disableBuildingMode();
            return;
        }
        
        if (!this.targetCrystal) {
            console.error('TowerBuilder: targetCrystal is null!');
            return;
        }

        // 获取触摸位置
        // 注意：在2D场景中，可能需要使用不同的坐标转换方法
        const touchLocation = event.getLocation();
        console.log('TowerBuilder: Touch location:', touchLocation);
        
        // 查找Camera节点
        const cameraNode = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
        if (!cameraNode) {
            console.error('TowerBuilder: Camera node not found!');
            return;
        }
        
        const camera = cameraNode.getComponent(Camera);
        if (!camera) {
            console.error('TowerBuilder: Camera component not found!');
            return;
        }

        // 将屏幕坐标转换为世界坐标
        // 对于2D正交相机，需要正确转换坐标
        const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
        const worldPos = new Vec3();
        
        // 使用camera的screenToWorld方法转换坐标
        // 对于2D场景，可能需要调整z值
        camera.screenToWorld(screenPos, worldPos);
        
        // 对于2D正交相机，z坐标应该保持为0或相机的z值
        // 但worldPos的z可能不是0，需要设置为0
        worldPos.z = 0;
        
        console.log('TowerBuilder: Touch screen location:', touchLocation);
        console.log('TowerBuilder: Screen pos:', screenPos);
        console.log('TowerBuilder: World pos:', worldPos);
        console.log('TowerBuilder: Crystal world pos:', this.targetCrystal.worldPosition);

        // 检查是否可以建造
        const canBuild = this.canBuildAt(worldPos);
        console.log('TowerBuilder: Can build at position:', canBuild);
        
        if (canBuild) {
            console.log('TowerBuilder: Building tower at:', worldPos);
            this.buildTower(worldPos);
        } else {
            console.log('TowerBuilder: Cannot build at this position');
        }
    }

    canBuildAt(position: Vec3): boolean {
        if (!this.targetCrystal) {
            console.log('TowerBuilder.canBuildAt: targetCrystal is null');
            return false;
        }

        // 检查距离水晶的距离
        const crystalPos = this.targetCrystal.worldPosition;
        const distance = Vec3.distance(position, crystalPos);
        console.log('TowerBuilder.canBuildAt: Distance to crystal:', distance.toFixed(2), 'min:', this.minBuildDistance, 'max:', this.buildRange);
        
        if (distance < this.minBuildDistance) {
            console.log('TowerBuilder.canBuildAt: Too close to crystal');
            return false;
        }
        
        if (distance > this.buildRange) {
            console.log('TowerBuilder.canBuildAt: Too far from crystal');
            return false;
        }

        // 检查是否与现有防御塔重叠
        const towers = this.towerContainer?.children || [];
        console.log('TowerBuilder.canBuildAt: Checking', towers.length, 'existing towers');
        for (const tower of towers) {
            if (tower.active) {
                const towerDistance = Vec3.distance(position, tower.worldPosition);
                if (towerDistance < 60) { // 防御塔之间的最小距离
                    console.log('TowerBuilder.canBuildAt: Too close to existing tower:', towerDistance.toFixed(2));
                    return false;
                }
            }
        }

        console.log('TowerBuilder.canBuildAt: Position is valid for building');
        return true;
    }

    buildTower(position: Vec3) {
        // 检查金币是否足够
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        if (this.gameManager && !this.gameManager.canAfford(this.towerCost)) {
            console.log('TowerBuilder.buildTower: Not enough gold! Need', this.towerCost, 'but have', this.gameManager.getGold());
            this.disableBuildingMode();
            return;
        }

        // 再次检查towerPrefab
        if (!this.towerPrefab) {
            console.error('TowerBuilder.buildTower: towerPrefab is null! Cannot build.');
            this.disableBuildingMode();
            return;
        }

        // 检查towerContainer
        if (!this.towerContainer) {
            console.error('TowerBuilder.buildTower: towerContainer is null! Creating new one.');
            const existingTowers = find('Towers');
            if (existingTowers) {
                this.towerContainer = existingTowers;
            } else {
                this.towerContainer = new Node('Towers');
                this.towerContainer.setParent(this.node.scene);
            }
        }

        // 消耗金币
        if (this.gameManager) {
            this.gameManager.spendGold(this.towerCost);
            console.log('TowerBuilder.buildTower: Spent', this.towerCost, 'gold. Remaining:', this.gameManager.getGold());
        }

        console.log('TowerBuilder.buildTower: Instantiating tower at:', position);
        const tower = instantiate(this.towerPrefab);
        tower.setParent(this.towerContainer || this.node);
        tower.setWorldPosition(position);
        
        // 确保防御塔节点是激活的
        tower.active = true;
        
        // 确保防御塔脚本组件存在并已初始化
        const towerScript = tower.getComponent('Tower') as any;
        if (towerScript) {
            // 设置防御塔的建造成本（用于回收和升级）
            towerScript.buildCost = this.towerCost;
            console.log('TowerBuilder.buildTower: Tower script found, tower should start attacking enemies');
        } else {
            console.error('TowerBuilder.buildTower: Tower script not found on tower prefab!');
        }
        
        console.log('TowerBuilder.buildTower: Tower created successfully at:', tower.worldPosition);
        console.log('TowerBuilder.buildTower: Tower container has', (this.towerContainer?.children.length || 0), 'towers');

        // 退出建造模式
        this.disableBuildingMode();
        console.log('TowerBuilder.buildTower: Building mode disabled');
    }

    // 可以通过按钮调用
    onBuildButtonClick() {
        console.log('TowerBuilder: onBuildButtonClick called');
        
        // 检查金币是否足够
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        if (this.gameManager && !this.gameManager.canAfford(this.towerCost)) {
            console.log('TowerBuilder: Not enough gold! Need', this.towerCost, 'but have', this.gameManager.getGold());
            return;
        }
        
        // 检查towerPrefab是否设置
        if (!this.towerPrefab) {
            console.error('TowerBuilder: Cannot enable building mode - towerPrefab is not set!');
            console.error('TowerBuilder: Please assign Tower prefab to TowerBuilder node in the editor!');
            return;
        }
        
        // 检查targetCrystal是否设置
        if (!this.targetCrystal) {
            console.warn('TowerBuilder: targetCrystal not set, trying to find it...');
            this.targetCrystal = find('Crystal');
            if (!this.targetCrystal) {
                console.error('TowerBuilder: Cannot find Crystal node!');
                return;
            }
        }
        
        this.enableBuildingMode();
        console.log('TowerBuilder: Building mode enabled:', this.isBuildingMode);
        console.log('TowerBuilder: Ready to build. Click on the map to place a tower.');
    }
}

