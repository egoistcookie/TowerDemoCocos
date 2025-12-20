import { _decorator, Component, Node, Prefab, instantiate, Vec3, view, find, resources, JsonAsset } from 'cc';
import { GameManager, GameState } from './GameManager';
// 移除UIManager导入，避免循环导入
import { Enemy } from './Enemy';
import { OrcWarrior } from './OrcWarrior';
import { OrcWarlord } from './OrcWarlord';
import { TrollSpearman } from './TrollSpearman';
const { ccclass, property } = _decorator;

// 定义波次配置接口
interface EnemyConfig {
    prefabName: string;
    count: number;
    interval: number;
}

interface WaveConfig {
    id: number;
    name: string;
    description: string;
    preWaveDelay: number;
    enemies: EnemyConfig[];
}

interface WaveConfigFile {
    waves: WaveConfig[];
}

@ccclass('EnemySpawner')
export class EnemySpawner extends Component {
    @property
    spawnDistance: number = 400; // 从中心生成的距离

    @property(Node)
    targetCrystal: Node = null!;

    @property(Node)
    enemyContainer: Node = null!;

    // 敌人预制体映射，键为预制体名称
    @property({
        type: [Prefab],
        tooltip: "敌人预制体数组，名称应与配置文件中的prefabName一致"
    })
    enemyPrefabs: Prefab[] = [];

    // 测试模式：只刷新一个敌人用于测试攻击距离
    @property({
        tooltip: "测试模式：启用后只刷新一个敌人，用于测试攻击距离"
    })
    testMode: boolean = false;

    @property({
        tooltip: "测试模式下的敌人类型（Orc, OrcWarrior, OrcWarlord, TrollSpearman）",
        visible: function() { return this.testMode; }
    })
    testEnemyType: string = "Orc";

    private gameManager: GameManager = null!;
    private uiManager: any = null!;
    
    // 波次配置
    private waveConfig: WaveConfigFile | null = null;
    private currentWaveIndex: number = -1;
    private currentWave: WaveConfig | null = null;
    private isWaveActive: boolean = false;
    private isCountdownActive: boolean = false; // 倒计时是否激活
    private preWaveDelayTimer: number = 0;
    
    // 当前敌人配置
    private currentEnemyIndex: number = 0;
    private currentEnemyConfig: EnemyConfig | null = null;
    private enemiesSpawnedCount: number = 0;
    private enemySpawnTimer: number = 0;
    private pauseAfterFirstEnemy: boolean = false; // 第一只怪刷新后暂停刷新
    
    // 测试模式相关
    private testEnemySpawned: boolean = false; // 测试模式下是否已刷新敌人
    
    // 敌人预制体映射表
    private enemyPrefabMap: Map<string, Prefab> = new Map();

    start() {
        // 初始化变量
        this.currentWaveIndex = -1;
        this.isWaveActive = false;
        this.preWaveDelayTimer = 0;
        this.currentEnemyIndex = 0;
        this.enemiesSpawnedCount = 0;
        this.enemySpawnTimer = 0;
        this.testEnemySpawned = false;
        
        // 测试模式日志
        if (this.testMode) {
        }
        
        // 查找游戏管理器（使用递归查找，更可靠）
        this.findGameManager();
        
        // 查找UIManager - 尝试多种方式
        this.uiManager = null;
        
        // 方式1: 直接从场景根节点查找UIManager组件，使用字符串字面量避免循环导入
        const scene = this.node.scene;
        if (scene) {
            this.uiManager = scene.getComponentInChildren('UIManager');
        }
        
        // 方式2: 如果方式1失败，尝试查找UI节点，使用字符串字面量避免循环导入
        if (!this.uiManager) {
            const uiNode = find('UI') || find('Canvas/UI') || find('Canvas');
            if (uiNode) {
                this.uiManager = uiNode.getComponent('UIManager') || uiNode.getComponentInChildren('UIManager');
            }
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
        
        // 初始化敌人预制体映射表
        this.initEnemyPrefabMap();
        
        // 加载波次配置
        this.loadWaveConfig();
    }
    
    /**
     * 初始化敌人预制体映射表
     */
    private initEnemyPrefabMap() {
        // 清空映射表
        this.enemyPrefabMap.clear();
        
        // 将敌人预制体添加到映射表
        for (const prefab of this.enemyPrefabs) {
            // 使用预制体资源的名称作为键
            // 在Cocos Creator中，prefab.name是预制体资源的名称，prefab.data.name是根节点的名称
            // 我们需要确保配置文件中的prefabName与预制体资源名称匹配
            // 或者，我们可以假设预制体数组的顺序与配置文件中的顺序一致
            // 这里我们直接使用配置文件中的名称来命名预制体
            // 对于Enemy和OrcWarrior，我们需要确保它们的名称与配置文件中的一致
            // 我们可以手动映射，或者从预制体数据中获取
            
            // 检查预制体根节点的名称，因为在编辑器中，预制体根节点的名称通常与预制体资源名称一致
            let prefabName = prefab.data.name;
            
            // 特殊处理，确保名称匹配
            if (prefabName.toLowerCase().includes('orcwarlord') || prefabName.toLowerCase().includes('warlord')) {
                prefabName = 'OrcWarlord';
            } else if (prefabName.toLowerCase() === 'orc' || (prefabName.toLowerCase().includes('orc') && !prefabName.toLowerCase().includes('warrior') && !prefabName.toLowerCase().includes('warlord'))) {
                prefabName = 'Orc';
            } else if (prefabName.toLowerCase().includes('orcwarrior') || (prefabName.toLowerCase().includes('orc') && prefabName.toLowerCase().includes('warrior'))) {
                prefabName = 'OrcWarrior';
            } else if (prefabName.toLowerCase().includes('troll') || prefabName.toLowerCase().includes('spearman')) {
                prefabName = 'TrollSpearman';
            } else if (prefabName.toLowerCase().includes('enemy')) {
                // 兼容旧的 Enemy 名称，映射到 Orc
                prefabName = 'Orc';
            }
            
            this.enemyPrefabMap.set(prefabName, prefab);
        }
    }
    
    /**
     * 加载波次配置文件
     */
    private loadWaveConfig() {
        resources.load('waveConfig', JsonAsset, (err, jsonAsset) => {
            if (err) {
                
                // 尝试使用本地配置作为备用方案
                this.useLocalWaveConfig();
                return;
            }
            
            this.waveConfig = jsonAsset.json as WaveConfigFile;
            
            // 不立即开始第一波，只在游戏开始后才开始波次系统
        });
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
    }

    update(deltaTime: number) {
        // 检查游戏状态 - 如果GameManager不存在，尝试重新查找
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        // 检查游戏状态，只在Playing状态下刷新
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                // 游戏已结束或暂停，停止刷新
                return;
            }
        } else {
            // 如果找不到GameManager，继续尝试查找，但不停止刷新（避免误判）
            // 只在连续多次找不到时才警告
            if (Math.random() < 0.001) { // 约每1000帧一次
            }
        }

        // 只有在游戏进行中时才处理波次
        this.updateWave(deltaTime);
    }
    
    /**
     * 更新波次状态
     */
    private updateWave(deltaTime: number) {
        // 优先检查游戏状态，只有在游戏进行中时才处理波次相关逻辑
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                // 游戏未开始，完全不处理波次系统（包括初始化和计时）
                return;
            }
        }
        
        // 测试模式：只刷新一个敌人
        if (this.testMode) {
            if (!this.testEnemySpawned) {
                // 延迟一小段时间后刷新测试敌人
                this.enemySpawnTimer += deltaTime;
                if (this.enemySpawnTimer >= 1.0) { // 1秒后刷新
                    this.spawnTestEnemy();
                    this.testEnemySpawned = true;
                    this.enemySpawnTimer = 0;
                }
            }
            return; // 测试模式下不执行正常的波次逻辑
        }
        
        // 检查是否所有波次都已完成
        if (this.waveConfig === null || this.currentWaveIndex >= this.waveConfig.waves.length) {
            return;
        }
        
        // 如果currentWaveIndex为-1，初始化波次系统并立即显示第一波提示
        if (this.currentWaveIndex === -1) {
            this.currentWaveIndex = 0;
            this.currentWave = this.waveConfig.waves[0];
            this.preWaveDelayTimer = 0;
            this.isWaveActive = true;
            
            // 直接显示第一波提示，不等待延迟
            
            // 触发UI提示
            if (this.uiManager) {
                this.uiManager.showAnnouncement(`${this.currentWave.name} - ${this.currentWave.description}`);
                this.uiManager.showWarningEffect();
            }
            
            // 重置波次状态，开始生成敌人
            this.preWaveDelayTimer = 0;
            this.currentEnemyIndex = 0;
            this.enemiesSpawnedCount = 0;
            this.enemySpawnTimer = 0;
            this.currentEnemyConfig = null;
            
            // 第一波只刷新一个敌人，刷新后暂停
            // if (this.currentWave && this.currentWave.id === 1) {
            //     this.pauseAfterFirstEnemy = true;
            // } else {
            //     this.pauseAfterFirstEnemy = false;
            // }
            
            return;
        }
        
        // 如果没有当前波次，尝试获取
        if (!this.currentWave && this.currentWaveIndex >= 0) {
            this.currentWave = this.waveConfig.waves[this.currentWaveIndex];
        }
        
        // 如果没有激活的波次，开始下一波的延迟
        if (!this.isWaveActive) {
            // 如果正在倒计时，不要开始下一波
            if (this.isCountdownActive) {
                return;
            }
            
            this.preWaveDelayTimer += deltaTime;
            
            // 如果延迟时间到，开始下一波
            if (this.preWaveDelayTimer >= (this.currentWave?.preWaveDelay || 0)) {
                this.startNextWave();
            }
            return;
        }
        
        // 如果没有当前敌人配置，获取下一个敌人配置
        if (this.currentEnemyConfig === null) {
            if (!this.getCurrentEnemyConfig()) {
                // 所有敌人配置都已完成，结束当前波次
                this.endCurrentWave();
                return;
            }
        }
        
        // 如果设置了第一只怪刷新后暂停，且已经刷新了第一只怪，则暂停刷新
        if (this.pauseAfterFirstEnemy && this.enemiesSpawnedCount >= 1) {
            return;
        }
        
        // 更新敌人生成计时器
        this.enemySpawnTimer += deltaTime;
        
        // 如果到了生成间隔，生成敌人
        if (this.enemySpawnTimer >= (this.currentEnemyConfig?.interval || 0)) {
            this.spawnEnemy();
            this.enemySpawnTimer = 0;
        }
    }
    
    /**
     * 开始下一波
     */
    private startNextWave() {
        // 检查游戏状态，只有在游戏进行中时才显示波次提示
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                // 只更新波次状态，不显示UI提示
                this.currentWaveIndex++;
                return;
            }
        }
        
        // 检查是否还有波次
        if (this.waveConfig === null) {
            return;
        }
        
        // 检查是否还有波次可玩
        if (this.currentWaveIndex >= this.waveConfig.waves.length - 1) {
            return;
        }
        
        // 增加波次索引
        this.currentWaveIndex++;
        
        // 检查索引是否有效
        if (this.currentWaveIndex < 0 || this.currentWaveIndex >= this.waveConfig.waves.length) {
            return;
        }
        
        this.currentWave = this.waveConfig.waves[this.currentWaveIndex];
        
        // 重置波次状态
        this.isWaveActive = true;
        this.preWaveDelayTimer = 0;
        this.currentEnemyIndex = 0;
        this.enemiesSpawnedCount = 0;
        this.enemySpawnTimer = 0;
        this.currentEnemyConfig = null;
        
        // 输出波次信息
        
        // 触发UI提示
        if (this.uiManager) {
            this.uiManager.showAnnouncement(`${this.currentWave.name} - ${this.currentWave.description}`);
            this.uiManager.showWarningEffect();
        }
    }
    
    /**
     * 结束当前波次
     */
    private endCurrentWave() {
        this.isWaveActive = false;
        this.currentEnemyConfig = null;
        
        // 检查是否是第5、10、15波完成，每隔5波出现一次弹窗
        if (this.waveConfig && (this.currentWaveIndex + 1) % 5 === 0 && (this.currentWaveIndex + 1) < this.waveConfig.waves.length) {
            
            // 设置倒计时激活标志
            this.isCountdownActive = true;
            
            // 显示倒计时弹窗
            if (this.uiManager) {
                this.uiManager.showCountdownPopup(
                    this.onCountdownComplete.bind(this),
                    this.onCountdownManualClose.bind(this)
                );
            } else {
                // 如果UI管理器不存在，直接继续下一波
                this.continueToNextWaves();
            }
            
            // 启动一个自动继续的定时器，确保即使没有弹窗也能继续游戏
            this.scheduleOnce(() => {
                if (this.isCountdownActive) {
                    this.continueToNextWaves();
                }
            }, 60); // 60秒后自动继续
            
            return; // 暂停波次生成，等待倒计时完成
        }
        
        // 如果还有下一波，开始下一波的延迟
        if (this.waveConfig && this.currentWaveIndex < this.waveConfig.waves.length - 1) {
        } else {
        }
    }
    
    /**
     * 倒计时完成回调
     */
    private onCountdownComplete() {
        this.continueToNextWaves();
    }
    
    /**
     * 手动关闭倒计时回调
     */
    private onCountdownManualClose() {
        this.continueToNextWaves();
    }
    
    /**
     * 继续生成下一波
     */
    private continueToNextWaves() {
        // 确保波次系统继续运行
        this.isWaveActive = false;
        this.isCountdownActive = false; // 取消倒计时激活标志
        this.preWaveDelayTimer = 0;
        
        // 如果还有下一波，开始下一波的延迟
        if (this.waveConfig && this.currentWaveIndex < this.waveConfig.waves.length - 1) {
        } else {
        }
    }
    
    /**
     * 获取当前敌人配置
     * @returns 是否获取到敌人配置
     */
    private getCurrentEnemyConfig(): boolean {
        if (this.currentWave === null) {
            return false;
        }
        
        if (this.currentEnemyIndex >= this.currentWave.enemies.length) {
            return false;
        }
        
        this.currentEnemyConfig = this.currentWave.enemies[this.currentEnemyIndex];
        this.enemiesSpawnedCount = 0;
        
        // 检查敌人预制体是否存在
        const prefabName = this.currentEnemyConfig.prefabName;
        const prefab = this.enemyPrefabMap.get(prefabName);
        if (!prefab) {
            
            // 尝试获取下一个敌人配置
            this.currentEnemyIndex++;
            return this.getCurrentEnemyConfig();
        }
        
        return true;
    }

    /**
     * 测试模式：刷新测试敌人
     */
    private spawnTestEnemy() {
        
        // 再次检查游戏状态，确保游戏仍在进行
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                return;
            }
        }
        
        if (!this.targetCrystal) {
            return;
        }
        
        // 获取测试敌人预制体
        const enemyPrefab = this.enemyPrefabMap.get(this.testEnemyType);
        
        if (!enemyPrefab) {
            return;
        }

        // 从画面最上方生成敌人
        const visibleSize = view.getVisibleSize();
        const visibleOrigin = view.getVisibleOrigin();
        
        // 计算画面最上方的位置，敌人从屏幕顶部边缘生成
        const spawnPos = new Vec3(
            visibleOrigin.x + Math.random() * visibleSize.width, // x轴在屏幕宽度范围内随机
            visibleOrigin.y + visibleSize.height - 10, // y轴固定在画面最上方边缘
            0
        );

        // 实例化敌人
        const enemy = instantiate(enemyPrefab);
        enemy.setParent(this.enemyContainer || this.node);
        enemy.setWorldPosition(spawnPos);

        // 设置敌人的目标水晶
        const enemyScript = enemy.getComponent(Enemy) as any || enemy.getComponent(OrcWarrior) as any || enemy.getComponent(OrcWarlord) as any || enemy.getComponent(TrollSpearman) as any;
        if (enemyScript) {
            if (this.targetCrystal) {
                enemyScript.targetCrystal = this.targetCrystal;
            }
            
            // 检查单位是否首次出现
            if (this.gameManager) {
                const unitType = enemyScript.unitType || this.testEnemyType;
                this.gameManager.checkUnitFirstAppearance(unitType, enemyScript);
            }
        } else {
        }
    }

    spawnEnemy() {
        // 再次检查游戏状态，确保游戏仍在进行
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                return;
            }
        }
        
        if (!this.currentEnemyConfig || !this.targetCrystal) {
            return;
        }
        
        // 检查是否已经生成了足够的敌人
        if (this.enemiesSpawnedCount >= this.currentEnemyConfig.count) {
            // 本类型敌人已生成完毕，获取下一个敌人配置
            this.currentEnemyIndex++;
            this.currentEnemyConfig = null;
            this.enemiesSpawnedCount = 0;
            return;
        }
        
        // 获取敌人预制体
        const prefabName = this.currentEnemyConfig.prefabName;
        const enemyPrefab = this.enemyPrefabMap.get(prefabName);
        
        if (!enemyPrefab) {
            return;
        }

        // 从画面最上方生成敌人
        // 获取屏幕尺寸和原点
        const visibleSize = view.getVisibleSize();
        const visibleOrigin = view.getVisibleOrigin();
        
        // 计算画面最上方的位置，敌人从屏幕顶部边缘生成，而不是屏幕外
        const spawnPos = new Vec3(
            visibleOrigin.x + Math.random() * visibleSize.width, // x轴在屏幕宽度范围内随机
            visibleOrigin.y + visibleSize.height - 10, // y轴固定在画面最上方边缘，-10像素确保敌人从屏幕内顶部生成
            0
        );

        // 实例化敌人
        const enemy = instantiate(enemyPrefab);
        enemy.setParent(this.enemyContainer || this.node);
        enemy.setWorldPosition(spawnPos);

        // 设置敌人的目标水晶，支持Enemy、OrcWarrior、OrcWarlord和TrollSpearman
        // 尝试获取不同类型的敌人组件
        const enemyScript = enemy.getComponent(Enemy) as any || enemy.getComponent(OrcWarrior) as any || enemy.getComponent(OrcWarlord) as any || enemy.getComponent(TrollSpearman) as any;
        if (enemyScript) {
            if (this.targetCrystal) {
                enemyScript.targetCrystal = this.targetCrystal;
            } else {
                // 如果EnemySpawner没有设置targetCrystal，让Enemy自己查找
            }
            
            // 检查单位是否首次出现
            if (this.gameManager) {
                const unitType = enemyScript.unitType || prefabName;
                this.gameManager.checkUnitFirstAppearance(unitType, enemyScript);
            }
        } else {
        }
        
        // 增加已生成敌人计数
        this.enemiesSpawnedCount++;
        
        // 如果已生成足够的敌人，获取下一个敌人配置
        if (this.enemiesSpawnedCount >= this.currentEnemyConfig.count) {
            this.currentEnemyIndex++;
            this.currentEnemyConfig = null;
            this.enemiesSpawnedCount = 0;
        }
    }
    
    /**
     * 重置波次系统
     */
    reset() {
        this.currentWaveIndex = -1;
        this.isWaveActive = false;
        this.preWaveDelayTimer = 0;
        this.currentEnemyIndex = 0;
        this.enemiesSpawnedCount = 0;
        this.enemySpawnTimer = 0;
        this.pauseAfterFirstEnemy = false;
        this.currentWave = null;
        this.currentEnemyConfig = null;
        this.testEnemySpawned = false; // 重置测试模式标志
        
        // 重新初始化敌人预制体映射表
        this.initEnemyPrefabMap();
        
        // 重新加载配置并开始第一波
        this.loadWaveConfig();
    }
    
    /**
     * 使用本地波次配置作为备用方案
     */
    private useLocalWaveConfig() {
        
        // 创建本地波次配置
        this.waveConfig = {
            waves: [
                {
                    id: 1,
                    name: "第一波",
                    description: "基础敌人来袭",
                    preWaveDelay: 3,
                    enemies: [
                        {
                            prefabName: "Enemy",
                            count: 10,
                            interval: 1.0
                        }
                    ]
                }
            ]
        };
        
        // 不立即开始第一波，只在游戏开始后才开始波次系统
    }
}
