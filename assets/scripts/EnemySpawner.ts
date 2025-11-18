import { _decorator, Component, Node, Prefab, instantiate, Vec3, view, find } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('EnemySpawner')
export class EnemySpawner extends Component {
    @property(Prefab)
    enemyPrefab: Prefab = null!;

    @property
    spawnInterval: number = 2.5; // 生成间隔（秒）

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
        
        // 查找游戏管理器
        const gmNode = find('GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager);
        }

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

    update(deltaTime: number) {
        // 检查游戏状态
        if (this.gameManager && this.gameManager.getGameState() !== 0) { // 0 = Playing
            return;
        }

        this.spawnTimer += deltaTime;

        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnEnemy();
            this.spawnTimer = 0;
        }
    }

    spawnEnemy() {
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

