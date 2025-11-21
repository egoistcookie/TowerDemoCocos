import { _decorator, Component, Node, Prefab, instantiate, Vec3, view, find } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('EnemySpawner')
export class EnemySpawner extends Component {
    @property(Prefab)
    enemyPrefab: Prefab = null!;

    @property
    spawnInterval: number = 1.5; // 生成间隔（秒）

    @property
    spawnDistance: number = 400; // 从中心生成的距离

    @property(Node)
    targetCrystal: Node = null!;

    @property(Node)
    enemyContainer: Node = null!;

    private spawnTimer: number = 0;
    private gameManager: GameManager = null!;

    start() {
        this.spawnTimer = 0;
        
        // 查找游戏管理器（使用递归查找，更可靠）
        this.findGameManager();

        // 查找水晶
        if (!this.targetCrystal) {
            this.targetCrystal = find('Crystal');
        }

        // 创建敌人容器
        if (!this.enemyContainer) {
            this.enemyContainer = new Node('Enemies');
            this.enemyContainer.setParent(this.node.scene);
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
            if (this.gameManager) {
                return;
            }
        }
        
        // 如果还是找不到，输出警告但不阻止运行
        console.warn('EnemySpawner: GameManager not found, will continue trying to find it');
    }

    update(deltaTime: number) {
        // 检查游戏状态 - 如果GameManager不存在，尝试重新查找
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        // 检查游戏状态，如果不是Playing状态，停止刷新
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                // 游戏已结束，停止刷新
                // 重置计时器，防止累积
                this.spawnTimer = 0;
                return;
            }
        } else {
            // 如果找不到GameManager，继续尝试查找，但不停止刷新（避免误判）
            // 只在连续多次找不到时才警告
            if (Math.random() < 0.001) { // 约每1000帧一次
                console.warn('EnemySpawner: GameManager not found, continuing to search...');
            }
            // 继续运行，允许生成敌人（如果GameManager真的不存在，游戏本身就有问题）
        }

        this.spawnTimer += deltaTime;

        if (this.spawnTimer >= this.spawnInterval) {
            // 再次检查游戏状态，确保在spawnEnemy调用前游戏仍在进行
            if (this.gameManager && this.gameManager.getGameState() === GameState.Playing) {
                this.spawnEnemy();
            } else if (!this.gameManager) {
                // 如果还是没有GameManager，但仍然允许生成敌人（避免完全停止）
                this.spawnEnemy();
            }
            this.spawnTimer = 0;
        }
    }

    spawnEnemy() {
        // 再次检查游戏状态，确保游戏仍在进行
        if (this.gameManager && this.gameManager.getGameState() !== GameState.Playing) {
            console.log('EnemySpawner: Game ended, canceling enemy spawn');
            return;
        }
        
        if (!this.enemyPrefab || !this.targetCrystal) {
            return;
        }

        // 随机生成角度
        const angle = Math.random() * Math.PI * 2;
        
        // 计算生成位置（在屏幕边缘）
        const spawnPos = new Vec3(
            Math.cos(angle) * this.spawnDistance,
            Math.sin(angle) * this.spawnDistance,
            0
        );

        // 如果有水晶，以水晶为中心
        if (this.targetCrystal) {
            Vec3.add(spawnPos, this.targetCrystal.worldPosition, spawnPos);
        }

        // 实例化敌人
        const enemy = instantiate(this.enemyPrefab);
        enemy.setParent(this.enemyContainer || this.node);
        enemy.setWorldPosition(spawnPos);

        // 设置敌人的目标水晶
        const enemyScript = enemy.getComponent('Enemy') as any;
        if (enemyScript) {
            if (this.targetCrystal) {
                enemyScript.targetCrystal = this.targetCrystal;
                console.log('EnemySpawner: Set targetCrystal for enemy:', this.targetCrystal.name, 'at', this.targetCrystal.worldPosition);
            } else {
                // 如果EnemySpawner没有设置targetCrystal，让Enemy自己查找
                console.warn('EnemySpawner: targetCrystal not set, Enemy will try to find it');
            }
            console.log('EnemySpawner: Spawned enemy at:', spawnPos);
        } else {
            console.error('EnemySpawner: Enemy script not found on enemy prefab');
        }
    }
}

