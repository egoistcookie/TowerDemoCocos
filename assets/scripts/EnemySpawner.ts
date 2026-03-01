import { _decorator, Component, Node, Prefab, instantiate, Vec3, view, find, resources, JsonAsset, assetManager } from 'cc';
import { GameManager, GameState } from './GameManager';
// 移除UIManager导入，避免循环导入
import { Enemy } from './enemy/Enemy';
import { OrcWarrior } from './enemy/OrcWarrior';
import { OrcWarlord } from './enemy/OrcWarlord';
import { TrollSpearman } from './enemy/TrollSpearman';
import { Boss } from './enemy/Boss';
import { EnemyPool } from './EnemyPool';
import { UnitManager } from './UnitManager';
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

interface LevelConfig {
    id: number;
    name: string;
    description: string;
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

    @property({
        tooltip: "同屏最大敌人数量，上限用于控制刷怪节奏"
    })
    maxEnemiesOnScreen: number = 50;

    private gameManager: GameManager = null!;
    private uiManager: any = null!;
    
    // 波次配置
    private currentLevel: number = 1; // 当前关卡（1-5）
    private currentLevelConfig: LevelConfig | null = null; // 当前关卡配置
    private currentWaveIndex: number = -1;
    private currentWave: WaveConfig | null = null;
    private isWaveActive: boolean = false;
    private isCountdownActive: boolean = false; // 倒计时是否激活
    private countdownAutoContinueTimer: any = null; // 倒计时自动继续定时器引用
    private preWaveDelayTimer: number = 0;
    private isConfigLoaded: boolean = false; // 配置是否已加载完成
    private isLastWaveCompleted: boolean = false; // 最后一波是否已完成刷新
    private victoryCheckTimer: number = 0; // 胜利检查计时器
    private readonly VICTORY_CHECK_INTERVAL: number = 0.5; // 每0.5秒检查一次胜利条件
    
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

    // Orc / OrcWarrior / TrollSpearman / Dragon / OrcWarlord / OrcShaman 敌人预制体（从分包懒加载并注入），减少主包体积
    private static sharedOrcPrefab: Prefab | null = null; // 所有 EnemySpawner 实例共享
    private static sharedOrcWarriorPrefab: Prefab | null = null;
    private static sharedTrollSpearmanPrefab: Prefab | null = null;
    private static sharedDragonPrefab: Prefab | null = null;
    private static sharedOrcWarlordPrefab: Prefab | null = null;
    private static sharedOrcShamanPrefab: Prefab | null = null;
    private static orcPrefabLoaded: boolean = false; // 全局标记：整个游戏过程中只加载一次
    private static orcWarriorPrefabLoaded: boolean = false;
    private static trollSpearmanPrefabLoaded: boolean = false;
    private static dragonPrefabLoaded: boolean = false;
    private static orcWarlordPrefabLoaded: boolean = false;
    private static orcShamanPrefabLoaded: boolean = false;
    
    // 对象池引用
    private enemyPool: EnemyPool = null!;

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
        
        // 初始化敌人预制体映射表（此时只包含主包里通过属性面板指定的敌人）
        this.initEnemyPrefabMap();

        // 敌人预制体：从分包懒加载 Orc / OrcWarrior / TrollSpearman / Dragon / OrcWarlord / OrcShaman，全部尝试完成后再初始化对象池和波次配置
        this.loadAllEnemyPrefabsFromSubpackage(() => {
            // 将已经加载到内存中的敌人预制体注入当前 Spawner 的映射表
            this.injectOrcPrefabToMap();
            this.injectOrcWarriorPrefabToMap();
            this.injectTrollSpearmanPrefabToMap();
            this.injectDragonPrefabToMap();
            this.injectOrcWarlordPrefabToMap();
            this.injectOrcShamanPrefabToMap();

            // 初始化对象池并加载关卡配置
            this.initEnemyPool();
            this.loadWaveConfig();
        });
    }

    /**
     * 从分包 prefabs_sub 懒加载所有需要的敌人预制体（Orc / OrcWarrior / TrollSpearman / Dragon / OrcWarlord / OrcShaman）
     * 全局每种敌人只加载一次，多个 EnemySpawner 共享。
     */
    private loadAllEnemyPrefabsFromSubpackage(onComplete: () => void) {
        // 统计本次实际上需要等待的加载次数
        let pending = 0;

        const doneOne = () => {
            pending--;
            if (pending <= 0) {
                onComplete();
            }
        };

        // 需要加载 Orc
        if (!EnemySpawner.orcPrefabLoaded) {
            pending++;
            this.loadSingleEnemyPrefabFromSubpackage(
                ['orc'],
                (prefab) => {
                    if (prefab) {
                        EnemySpawner.sharedOrcPrefab = prefab;
                        EnemySpawner.orcPrefabLoaded = true;
                    }
                    doneOne();
                }
            );
        }

        // 需要加载 OrcWarrior
        if (!EnemySpawner.orcWarriorPrefabLoaded) {
            pending++;
            this.loadSingleEnemyPrefabFromSubpackage(
                ['OrcWarrior', 'orcwarrior', 'orc_warrior', 'Orc_Warrior'],
                (prefab) => {
                    if (prefab) {
                        EnemySpawner.sharedOrcWarriorPrefab = prefab;
                        EnemySpawner.orcWarriorPrefabLoaded = true;
                    }
                    doneOne();
                }
            );
        }

        // 需要加载 TrollSpearman
        if (!EnemySpawner.trollSpearmanPrefabLoaded) {
            pending++;
            this.loadSingleEnemyPrefabFromSubpackage(
                ['TrollSpearman', 'trollSpearman', 'troll_spearman', 'trollspearman'],
                (prefab) => {
                    if (prefab) {
                        EnemySpawner.sharedTrollSpearmanPrefab = prefab;
                        EnemySpawner.trollSpearmanPrefabLoaded = true;
                    }
                    doneOne();
                }
            );
        }

        // 需要加载 Dragon
        if (!EnemySpawner.dragonPrefabLoaded) {
            pending++;
            this.loadSingleEnemyPrefabFromSubpackage(
                ['Dragon', 'dragon'],
                (prefab) => {
                    if (prefab) {
                        EnemySpawner.sharedDragonPrefab = prefab;
                        EnemySpawner.dragonPrefabLoaded = true;
                    }
                    doneOne();
                }
            );
        }

        // 需要加载 OrcWarlord
        if (!EnemySpawner.orcWarlordPrefabLoaded) {
            pending++;
            this.loadSingleEnemyPrefabFromSubpackage(
                ['OrcWarlord', 'orcwarlord', 'orc_warlord', 'Orc_Warlord'],
                (prefab) => {
                    if (prefab) {
                        EnemySpawner.sharedOrcWarlordPrefab = prefab;
                        EnemySpawner.orcWarlordPrefabLoaded = true;
                    }
                    doneOne();
                }
            );
        }

        // 需要加载 OrcShaman
        if (!EnemySpawner.orcShamanPrefabLoaded) {
            pending++;
            this.loadSingleEnemyPrefabFromSubpackage(
                ['OrcShaman', 'orcshaman', 'orc_shaman', 'Orc_Shaman'],
                (prefab) => {
                    if (prefab) {
                        EnemySpawner.sharedOrcShamanPrefab = prefab;
                        EnemySpawner.orcShamanPrefabLoaded = true;
                    }
                    doneOne();
                }
            );
        }

        // 如果本次所有敌人都已经加载过了，直接回调
        if (pending === 0) {
            onComplete();
        }
    }

    /**
     * 从分包 prefabs_sub 懒加载一种敌人预制体（根据一组可能的资源名尝试）
     * 如果从分包加载失败，会回退到使用 enemyPrefabs 数组中的预制体
     */
    private loadSingleEnemyPrefabFromSubpackage(
        tryNames: string[],
        onLoaded: (prefab: Prefab | null) => void
    ) {
       //console.info('[EnemySpawner] 开始从分包 prefabs_sub 懒加载敌人预制体，候选名称列表:', tryNames);

        assetManager.loadBundle('prefabs_sub', (err, bundle) => {
            if (err || !bundle) {
                console.warn('[EnemySpawner] 加载分包 prefabs_sub 失败，尝试从 enemyPrefabs 中查找:', err);
                // 从分包加载失败，尝试从 enemyPrefabs 中查找
                const fallbackPrefab = this.findPrefabInEnemyPrefabs(tryNames);
                if (fallbackPrefab) {
                   //console.info('[EnemySpawner] 从 enemyPrefabs 中找到预制体:', fallbackPrefab.data.name);
                    onLoaded(fallbackPrefab);
                } else {
                    console.error('[EnemySpawner] 从 enemyPrefabs 中也未找到预制体，候选名称:', tryNames);
                    onLoaded(null);
                }
                return;
            }

            let lastError: any = null;

            const tryLoadByIndex = (index: number) => {
                if (index >= tryNames.length) {
                    console.warn('[EnemySpawner] 从分包 prefabs_sub 加载敌人预制体失败，尝试的名称均未找到:', tryNames, lastError);
                    // 从分包加载失败，尝试从 enemyPrefabs 中查找
                    const fallbackPrefab = this.findPrefabInEnemyPrefabs(tryNames);
                    if (fallbackPrefab) {
                       //console.info('[EnemySpawner] 从 enemyPrefabs 中找到预制体作为回退:', fallbackPrefab.data.name);
                        onLoaded(fallbackPrefab);
                    } else {
                        console.error('[EnemySpawner] 从 enemyPrefabs 中也未找到预制体，候选名称:', tryNames);
                        onLoaded(null);
                    }
                    return;
                }

                const name = tryNames[index];
                bundle.load(name, Prefab, (err2, prefab) => {
                    if (err2 || !prefab) {
                        lastError = err2;
                        // 如果不是最后一个尝试的名称，只输出调试信息，不输出警告
                        if (index < tryNames.length - 1) {
                           //console.info('[EnemySpawner] 从分包 prefabs_sub 按名称加载敌人预制体失败，名称:', name, '继续尝试下一个');
                        } else {
                            console.warn('[EnemySpawner] 从分包 prefabs_sub 按名称加载敌人预制体失败，名称:', name, '错误:', err2);
                        }
                        tryLoadByIndex(index + 1);
                        return;
                    }

                   //console.info('[EnemySpawner] 从分包 prefabs_sub 成功加载敌人预制体，名称:', name);
                    onLoaded(prefab as Prefab);
                });
            };

            tryLoadByIndex(0);
        });
    }

    /**
     * 从 enemyPrefabs 数组中查找匹配的预制体
     * @param tryNames 尝试的名称列表
     * @returns 找到的预制体，如果未找到返回 null
     */
    private findPrefabInEnemyPrefabs(tryNames: string[]): Prefab | null {
       //console.info('[EnemySpawner.findPrefabInEnemyPrefabs] 开始查找，候选名称:', tryNames, 'enemyPrefabs数量:', this.enemyPrefabs.length);
        
        for (const prefab of this.enemyPrefabs) {
            if (!prefab) {
                continue;
            }
            
            // 检查两个可能的名称：prefab.name（资源名称）和 prefab.data.name（节点名称）
            const resourceName = prefab.name || '';
            const nodeName = (prefab.data && prefab.data.name) ? prefab.data.name : '';
            
           //console.info('[EnemySpawner.findPrefabInEnemyPrefabs] 检查预制体 - 资源名称:', resourceName, '节点名称:', nodeName);
            
            // 检查是否匹配任何一个尝试的名称
            for (const tryName of tryNames) {
                const tryNameLower = tryName.toLowerCase();
                
                // 检查资源名称
                if (resourceName) {
                    const resourceNameLower = resourceName.toLowerCase();
                    if (this.isNameMatch(resourceNameLower, tryNameLower)) {
                       //console.info('[EnemySpawner.findPrefabInEnemyPrefabs] 通过资源名称匹配成功:', resourceName, '->', tryName);
                        return prefab;
                    }
                }
                
                // 检查节点名称
                if (nodeName) {
                    const nodeNameLower = nodeName.toLowerCase();
                    if (this.isNameMatch(nodeNameLower, tryNameLower)) {
                       //console.info('[EnemySpawner.findPrefabInEnemyPrefabs] 通过节点名称匹配成功:', nodeName, '->', tryName);
                        return prefab;
                    }
                }
            }
        }
        
        console.warn('[EnemySpawner.findPrefabInEnemyPrefabs] 未找到匹配的预制体，候选名称:', tryNames);
        return null;
    }
    
    /**
     * 检查名称是否匹配
     * @param prefabName 预制体名称（已转换为小写）
     * @param tryName 尝试的名称（已转换为小写）
     * @returns 是否匹配
     */
    private isNameMatch(prefabName: string, tryName: string): boolean {
        // 精确匹配
        if (prefabName === tryName) {
            return true;
        }
        
        // 模糊匹配：检查名称是否包含尝试的名称
        // 例如：'Orc' 匹配 'Orc', 'OrcEnemy', 'EnemyOrc' 等
        if (prefabName.includes(tryName) || tryName.includes(prefabName)) {
            // 特殊处理：确保不会误匹配
            // 例如：'Orc' 不应该匹配 'OrcWarrior'
            if (tryName === 'orc') {
                // 如果尝试的是 'Orc'，确保不匹配 'OrcWarrior', 'OrcWarlord' 等
                if (!prefabName.includes('warrior') && 
                    !prefabName.includes('warlord') && 
                    !prefabName.includes('shaman')) {
                    return true;
                }
            } else {
                return true;
            }
        }
        
        return false;
    }

    /**
     * 将已加载的 Orc / OrcWarrior / TrollSpearman / Dragon / OrcWarlord / OrcShaman 预制体注入当前 EnemySpawner 的映射表
     */
    private injectOrcPrefabToMap() {
        if (EnemySpawner.sharedOrcPrefab) {
            // 将 Orc 预制体写入映射表，键名与关卡配置中的 prefabName 保持一致
            this.enemyPrefabMap.set('Orc', EnemySpawner.sharedOrcPrefab);
        }
    }

    private injectOrcWarriorPrefabToMap() {
        if (EnemySpawner.sharedOrcWarriorPrefab) {
            this.enemyPrefabMap.set('OrcWarrior', EnemySpawner.sharedOrcWarriorPrefab);
        }
    }

    private injectTrollSpearmanPrefabToMap() {
        if (EnemySpawner.sharedTrollSpearmanPrefab) {
            this.enemyPrefabMap.set('TrollSpearman', EnemySpawner.sharedTrollSpearmanPrefab);
        }
    }

    private injectDragonPrefabToMap() {
        if (EnemySpawner.sharedDragonPrefab) {
            this.enemyPrefabMap.set('Dragon', EnemySpawner.sharedDragonPrefab);
        }
    }

    private injectOrcWarlordPrefabToMap() {
        if (EnemySpawner.sharedOrcWarlordPrefab) {
            this.enemyPrefabMap.set('OrcWarlord', EnemySpawner.sharedOrcWarlordPrefab);
        }
    }

    private injectOrcShamanPrefabToMap() {
        if (EnemySpawner.sharedOrcShamanPrefab) {
            this.enemyPrefabMap.set('OrcShaman', EnemySpawner.sharedOrcShamanPrefab);
        }
    }
    
    /**
     * 初始化敌人对象池
     */
    private initEnemyPool() {
        // 查找或创建对象池节点
        let poolNode = find('EnemyPool');
        if (!poolNode) {
            poolNode = new Node('EnemyPool');
            const canvas = find('Canvas');
            if (canvas) {
                poolNode.setParent(canvas);
            } else if (this.node.scene) {
                poolNode.setParent(this.node.scene);
            }
            // 添加EnemyPool组件
            this.enemyPool = poolNode.addComponent(EnemyPool);
        } else {
            this.enemyPool = poolNode.getComponent(EnemyPool);
            if (!this.enemyPool) {
                this.enemyPool = poolNode.addComponent(EnemyPool);
            }
        }
        
        // 注册所有敌人预制体到对象池
        for (const [prefabName, prefab] of this.enemyPrefabMap.entries()) {
            if (this.enemyPool) {
                this.enemyPool.registerPrefab(prefabName, prefab);
            }
        }
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
            if (prefabName.toLowerCase().includes('dragon')) {
                prefabName = 'Dragon';
            } else if (prefabName.toLowerCase().includes('orcshaman') || prefabName.toLowerCase().includes('shaman')) {
                prefabName = 'OrcShaman';
            } else if (prefabName.toLowerCase().includes('orcwarlord') || prefabName.toLowerCase().includes('warlord')) {
                prefabName = 'OrcWarlord';
            } else if (prefabName.toLowerCase().includes('orcwarrior') || (prefabName.toLowerCase().includes('orc') && prefabName.toLowerCase().includes('warrior'))) {
                prefabName = 'OrcWarrior';
            } else if (prefabName.toLowerCase() === 'orc' || (prefabName.toLowerCase().includes('orc') && !prefabName.toLowerCase().includes('warrior') && !prefabName.toLowerCase().includes('warlord') && !prefabName.toLowerCase().includes('shaman'))) {
                prefabName = 'Orc';
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
     * 加载波次配置文件（按关卡加载对应的levelX.json文件）
     */
    private loadWaveConfig() {
        this.loadLevelConfig(this.currentLevel);
    }
    
    /**
     * 加载指定关卡的配置文件
     */
    private loadLevelConfig(level: number) {
        // 尝试多种路径加载配置文件（兼容不同平台）
        const configPaths = [
            `level${level}`,           // 默认路径（resources目录下）
            `config/level${level}`,    // 带config目录的路径
            `resources/level${level}`  // 完整路径
        ];
        
        const maxRetries = 3; // 最大重试次数
        let retryCount = 0;
        
        const tryLoadConfig = (pathIndex: number) => {
            if (pathIndex >= configPaths.length) {
                // 所有路径都失败，尝试重试
                if (retryCount < maxRetries) {
                    retryCount++;
                    console.warn(`[EnemySpawner] 所有配置文件路径加载失败，1秒后重试 (${retryCount}/${maxRetries})`);
                    // 延迟1秒后重试
                    this.scheduleOnce(() => {
                        tryLoadConfig(0);
                    }, 1);
                    return;
                }
                
                // 重试次数用完，使用本地配置作为备用方案
                console.warn(`[EnemySpawner] 关卡${level}配置文件加载失败，使用本地配置`);
                this.useLocalWaveConfig();
                // 使用本地配置后也要标记为已加载
                if (this.currentLevelConfig) {
                    this.isConfigLoaded = true;
                    console.log('[EnemySpawner] 本地配置加载成功，配置已就绪');
                } else {
                    console.error('[EnemySpawner] 本地配置加载失败');
                }
                return;
            }
            
            const configPath = configPaths[pathIndex];
            console.log(`[EnemySpawner] 尝试加载关卡${level}配置文件: ${configPath} (路径索引: ${pathIndex})`);
            
            resources.load(configPath, JsonAsset, (err, jsonAsset) => {
                if (err) {
                    console.warn(`[EnemySpawner] 加载配置文件失败 (${configPath}):`, err.message || err);
                    // 尝试下一个路径
                    tryLoadConfig(pathIndex + 1);
                    return;
                }
                
                if (!jsonAsset || !jsonAsset.json) {
                    console.warn(`[EnemySpawner] 配置文件内容为空 (${configPath})`);
                    tryLoadConfig(pathIndex + 1);
                    return;
                }
                
                console.log(`[EnemySpawner] 成功加载关卡${level}配置文件: ${configPath}`);
                
                // 直接作为LevelConfig使用（每个levelX.json文件就是一个LevelConfig）
                const levelConfig = jsonAsset.json as LevelConfig;
                
                // 验证配置数据
                if (!levelConfig || !levelConfig.waves) {
                    console.error(`[EnemySpawner] 关卡${level}配置文件格式错误，缺少waves字段`);
                    tryLoadConfig(pathIndex + 1);
                    return;
                }
                
                // 设置当前关卡配置
                this.currentLevelConfig = levelConfig;
                this.currentLevel = levelConfig.id || level; // 使用配置文件中的id，如果没有则使用传入的level
                
                // 验证关卡配置是否加载成功
                if (this.currentLevelConfig) {
                    console.log(`[EnemySpawner] 关卡${this.currentLevel}配置加载成功，波次数: ${this.currentLevelConfig.waves?.length || 0}`);
                    this.isConfigLoaded = true; // 标记配置已加载
                    console.log('[EnemySpawner] 配置加载完成，可以开始刷怪');
                } else {
                    console.error(`[EnemySpawner] 关卡${level}配置加载失败`);
                    this.isConfigLoaded = false;
                    // 如果关卡配置加载失败，尝试下一个路径
                    tryLoadConfig(pathIndex + 1);
                }
                
                // 不立即开始第一波，只在游戏开始后才开始波次系统
            });
        };
        
        // 开始尝试加载
        tryLoadConfig(0);
    }
    
    /**
     * 设置当前关卡（会重新加载对应关卡的配置文件）
     */
    setLevel(level: number) {
        if (level >= 1 && level <= 10 && level !== this.currentLevel) {
            this.currentLevel = level;
            this.currentLevelConfig = null;
            this.isConfigLoaded = false;
            // 重新加载对应关卡的配置文件
            this.loadLevelConfig(level);
        }
    }
    
    /**
     * 更新当前关卡配置（已废弃，现在直接通过loadLevelConfig加载）
     * 保留此方法以兼容可能存在的调用
     */
    private updateCurrentLevel() {
        // 不再需要从waveConfig中查找，因为现在直接加载levelX.json
        // 如果配置未加载，尝试加载
        if (!this.currentLevelConfig) {
            this.loadLevelConfig(this.currentLevel);
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
        
        // 如果最后一波已完成刷新，检查胜利条件
        if (this.isLastWaveCompleted && this.gameManager) {
            this.victoryCheckTimer += deltaTime;
            if (this.victoryCheckTimer >= this.VICTORY_CHECK_INTERVAL) {
                this.victoryCheckTimer = 0;
                if (this.checkVictoryCondition()) {
                   //console.info('[EnemySpawner] 胜利条件满足，调用endGame');
                    this.gameManager.endGame(GameState.Victory);
                    // 防止重复调用
                    this.isLastWaveCompleted = false;
                }
            }
        }
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
        
        // 检查配置是否已加载，如果没有加载完成，直接返回
        // 在小程序环境中，配置可能还在加载中，不执行刷怪逻辑
        if (!this.isConfigLoaded) {
            // 每5秒输出一次日志，提醒配置还在加载中（用于调试小程序环境）
            const timerSeconds = Math.floor(this.enemySpawnTimer);
            if (timerSeconds > 0 && timerSeconds % 5 === 0 && this.enemySpawnTimer - timerSeconds < deltaTime) {
                console.warn(`[EnemySpawner] 配置尚未加载完成，等待中... (isConfigLoaded: ${this.isConfigLoaded}, currentLevelConfig: ${this.currentLevelConfig ? '已加载' : '未加载'}, currentLevel: ${this.currentLevel})`);
            }
            this.enemySpawnTimer += deltaTime;
            return;
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
        if (this.currentLevelConfig === null || !this.currentLevelConfig.waves || 
            this.currentWaveIndex >= this.currentLevelConfig.waves.length) {
            return;
        }
        
        // 如果currentWaveIndex为-1，初始化波次系统并立即显示第一波提示
        if (this.currentWaveIndex === -1) {
            this.currentWaveIndex = 0;
            this.currentWave = this.currentLevelConfig.waves[0];
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
            this.currentWave = this.currentLevelConfig.waves[this.currentWaveIndex];
        }
        
        // 如果没有激活的波次，开始下一波的延迟
        if (!this.isWaveActive) {
            // 如果正在倒计时，不要开始下一波
            if (this.isCountdownActive) {
                return;
            }
            
            // 如果最后一波已完成，不要继续尝试开始下一波
            if (this.isLastWaveCompleted) {
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
            // 检查当前波次是否有敌人配置
            if (!this.currentWave || !this.currentWave.enemies || this.currentWave.enemies.length === 0) {
                console.warn(`[EnemySpawner.updateWave] 当前波次没有敌人配置，currentWaveIndex: ${this.currentWaveIndex}, currentWave: ${this.currentWave ? '存在' : 'null'}, enemies: ${this.currentWave && this.currentWave.enemies ? this.currentWave.enemies.length : 0}`);
                this.endCurrentWave();
                return;
            }
            
            // 如果索引超出范围，说明所有配置都已完成
            if (this.currentWave && this.currentWave.enemies && this.currentEnemyIndex >= this.currentWave.enemies.length) {
               //console.info(`[EnemySpawner.updateWave] 所有敌人配置已完成（索引超出范围），调用endCurrentWave，currentWaveIndex: ${this.currentWaveIndex}, currentEnemyIndex: ${this.currentEnemyIndex}, enemies.length: ${this.currentWave.enemies.length}`);
                this.endCurrentWave();
                return;
            }
            
            if (!this.getCurrentEnemyConfig()) {
                // 所有敌人配置都已完成，结束当前波次
                // 但需要确保至少已经生成了一些敌人，避免在游戏刚开始时就结束
                // 如果还没有生成任何敌人，说明可能是初始化问题或所有配置的预制体都不存在，不应该结束波次
                if (this.enemiesSpawnedCount === 0 && this.currentEnemyIndex === 0) {
                    console.warn(`[EnemySpawner.updateWave] 检测到异常：还没有生成任何敌人就判断配置已完成，currentEnemyIndex: ${this.currentEnemyIndex}, enemiesSpawnedCount: ${this.enemiesSpawnedCount}, currentWave.enemies.length: ${this.currentWave ? this.currentWave.enemies.length : 0}`);
                    
                    // 检查是否所有配置的预制体都不存在
                    if (this.currentWave && this.currentWave.enemies) {
                        let allPrefabsMissing = true;
                        for (let i = 0; i < this.currentWave.enemies.length; i++) {
                            const enemyConfig = this.currentWave.enemies[i];
                            const prefab = this.enemyPrefabMap.get(enemyConfig.prefabName);
                            if (prefab) {
                                allPrefabsMissing = false;
                                break;
                            }
                        }
                        if (allPrefabsMissing) {
                            console.error(`[EnemySpawner.updateWave] 当前波次所有敌人配置的预制体都不存在，无法生成敌人`);
                            // 即使所有预制体都不存在，也不应该立即结束波次，而是等待或报错
                            // 重置索引，重新尝试
                            this.currentEnemyIndex = 0;
                            this.currentEnemyConfig = null;
                            return;
                        }
                    }
                    
                    // 重置索引，重新尝试
                    this.currentEnemyIndex = 0;
                    this.currentEnemyConfig = null;
                    return;
                }
               //console.info(`[EnemySpawner.updateWave] 当前波次所有敌人配置已完成，调用endCurrentWave，currentWaveIndex: ${this.currentWaveIndex}, currentEnemyIndex: ${this.currentEnemyIndex}, enemiesSpawnedCount: ${this.enemiesSpawnedCount}`);
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
       //console.info(`[EnemySpawner] startNextWave() 被调用，currentWaveIndex=${this.currentWaveIndex}`);
        // 检查游戏状态，只有在游戏进行中时才显示波次提示
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
           //console.info(`[EnemySpawner] startNextWave() 游戏状态=${gameState}`);
            if (gameState !== GameState.Playing) {
                // 只更新波次状态，不显示UI提示
                console.warn(`[EnemySpawner] startNextWave() 游戏状态不是Playing，只更新波次索引`);
                this.currentWaveIndex++;
                return;
            }
        }
        
        // 检查是否还有波次
        if (this.currentLevelConfig === null) {
            console.warn(`[EnemySpawner] startNextWave() currentLevelConfig为null，返回`);
            return;
        }
        
        // 检查是否还有波次可玩
        if (!this.currentLevelConfig || !this.currentLevelConfig.waves) {
            console.warn(`[EnemySpawner] startNextWave() currentLevelConfig或waves不存在，返回`);
            return;
        }
        
        const totalWaves = this.currentLevelConfig.waves.length;
        if (this.currentWaveIndex >= totalWaves - 1) {
           //console.info(`[EnemySpawner] startNextWave() 已经是最后一波，currentWaveIndex=${this.currentWaveIndex}, totalWaves=${totalWaves}，设置isLastWaveCompleted=true并返回`);
            // 标记最后一波已完成，防止重复调用
            this.isLastWaveCompleted = true;
            // 确保波次状态正确
            this.isWaveActive = false;
            return;
        }
        
        // 增加波次索引
        this.currentWaveIndex++;
       //console.info(`[EnemySpawner] startNextWave() 增加波次索引到 ${this.currentWaveIndex}`);
        
        // 检查索引是否有效
        if (this.currentWaveIndex < 0 || this.currentWaveIndex >= totalWaves) {
            console.warn(`[EnemySpawner] startNextWave() 波次索引无效，currentWaveIndex=${this.currentWaveIndex}, totalWaves=${totalWaves}，返回`);
            return;
        }
        
        this.currentWave = this.currentLevelConfig.waves[this.currentWaveIndex];
       //console.info(`[EnemySpawner] startNextWave() 开始第 ${this.currentWaveIndex + 1} 波，波次名称=${this.currentWave?.name}`);
        
        // 重置波次状态
        this.isWaveActive = true;
        this.preWaveDelayTimer = 0;
        this.currentEnemyIndex = 0;
        this.enemiesSpawnedCount = 0;
        this.enemySpawnTimer = 0;
        this.currentEnemyConfig = null;
        
       //console.info(`[EnemySpawner] startNextWave() 重置波次状态，isWaveActive=${this.isWaveActive}`);
        
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
        
        // 检查是否是最后一波
        const totalWaves = this.currentLevelConfig && this.currentLevelConfig.waves ? this.currentLevelConfig.waves.length : 0;
        const isLastWave = totalWaves > 0 && (this.currentWaveIndex + 1) >= totalWaves;
        
        if (isLastWave) {
           //console.info(`[EnemySpawner] endCurrentWave() 最后一波完成，currentWaveIndex=${this.currentWaveIndex}, totalWaves=${totalWaves}，设置isLastWaveCompleted=true`);
            this.isLastWaveCompleted = true;
        }
        
        // 每完成一次波次，显示增益卡片（除了每隔5波的倒计时弹窗）
        const isSpecialWave = this.currentLevelConfig && this.currentLevelConfig.waves && 
            (this.currentWaveIndex + 1) % 5 === 0 && 
            (this.currentWaveIndex + 1) < this.currentLevelConfig.waves.length;
        
        // 检查是否是第5、10、15波完成，每隔5波出现一次弹窗
        // 使用 currentLevelConfig 而不是 waveConfig
        if (isSpecialWave) {
            
           //console.info(`[EnemySpawner] 第 ${this.currentWaveIndex + 1} 波完成，停止刷怪1分钟，显示倒计时弹窗`);
            
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
            
            // 每5波也显示增益卡片，但需要临时隐藏倒计时，卡片关闭后恢复
            if (this.gameManager) {
                // 临时隐藏倒计时弹窗（如果存在）
                // 使用 temporaryHide() 方法，只隐藏节点，不停止倒计时逻辑
                if (this.uiManager && this.uiManager.countdownPopup) {
                   //console.info(`[EnemySpawner] 准备临时隐藏倒计时弹窗，countdownPopup存在=${!!this.uiManager.countdownPopup}, isCountdownActive=${this.isCountdownActive}`);
                    this.uiManager.countdownPopup.temporaryHide();
                   //console.info(`[EnemySpawner] 显示增益卡片前，临时隐藏倒计时弹窗（倒计时继续运行）`);
                } else {
                    console.warn(`[EnemySpawner] 无法临时隐藏倒计时弹窗：uiManager=${!!this.uiManager}, countdownPopup=${!!(this.uiManager && this.uiManager.countdownPopup)}`);
                }
                
                // 显示增益卡片，卡片关闭后恢复倒计时
                this.gameManager.showBuffCards(() => {
                   //console.info(`[EnemySpawner] 增益卡片关闭回调，isCountdownActive=${this.isCountdownActive}, uiManager=${!!this.uiManager}, countdownPopup=${!!(this.uiManager && this.uiManager.countdownPopup)}`);
                    // 卡片关闭后，如果倒计时仍然激活，恢复显示倒计时
                    if (this.isCountdownActive && this.uiManager && this.uiManager.countdownPopup) {
                        // 使用 temporaryShow() 方法恢复显示，倒计时逻辑应该还在运行
                        this.uiManager.countdownPopup.temporaryShow();
                       //console.info(`[EnemySpawner] 增益卡片关闭，恢复倒计时弹窗显示`);
                    } else {
                        console.warn(`[EnemySpawner] 增益卡片关闭后未恢复倒计时：isCountdownActive=${this.isCountdownActive}, uiManager=${!!this.uiManager}, countdownPopup=${!!(this.uiManager && this.uiManager.countdownPopup)}`);
                    }
                });
            }
            
            // 取消之前的定时器（如果存在）
            if (this.countdownAutoContinueTimer) {
                this.unschedule(this.countdownAutoContinueTimer);
                this.countdownAutoContinueTimer = null;
            }
            
            // 启动一个自动继续的定时器，确保即使没有弹窗也能继续游戏
            this.countdownAutoContinueTimer = this.scheduleOnce(() => {
                if (this.isCountdownActive) {
                   //console.info(`[EnemySpawner] 倒计时1分钟完成，自动继续下一波`);
                    this.continueToNextWaves();
                }
                this.countdownAutoContinueTimer = null;
            }, 60); // 60秒后自动继续
            
            return; // 暂停波次生成，等待倒计时完成
        }
        
        // 非特殊波次，显示增益卡片
        if (this.gameManager) {
            // 显示增益卡片，卡片关闭后继续下一波
            this.gameManager.showBuffCards(() => {
                // 卡片关闭后继续下一波
                this.continueToNextWaves();
            });
            return; // 等待卡片关闭后再继续
        }
        
        // 如果没有显示增益卡片（比如没有已上场的单位），直接继续下一波
        this.continueToNextWaves();
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
       //console.info(`[EnemySpawner] onCountdownManualClose() 被调用，currentWaveIndex=${this.currentWaveIndex}`);
        this.continueToNextWaves();
    }
    
    /**
     * 继续生成下一波（点击倒计时弹窗后触发，继续下5波）
     */
    private continueToNextWaves() {
       //console.info(`[EnemySpawner] continueToNextWaves() 被调用，currentWaveIndex=${this.currentWaveIndex}, isCountdownActive=${this.isCountdownActive}`);
        
        // 取消倒计时激活标志
        this.isCountdownActive = false;
        
        // 取消60秒自动继续定时器（如果存在）
        if (this.countdownAutoContinueTimer) {
           //console.info(`[EnemySpawner] continueToNextWaves() 取消60秒自动继续定时器`);
            this.unschedule(this.countdownAutoContinueTimer);
            this.countdownAutoContinueTimer = null;
        }
        
        // 确保游戏已恢复（增益卡片可能暂停了游戏）
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
           //console.info(`[EnemySpawner] continueToNextWaves() 当前游戏状态=${gameState}`);
            if (gameState !== GameState.Playing) {
               //console.info(`[EnemySpawner] continueToNextWaves() 游戏未在运行状态，恢复游戏`);
                this.gameManager.resumeGame();
            }
        }
        
        // 隐藏倒计时弹窗（延迟执行，确保回调已经执行完毕）
        // 注意：如果用户点击倒计时弹窗，onPopupClick() 会自己调用 hide()，这里不需要再次调用
        // 只有在倒计时自动完成时才需要调用 hideCountdownPopup()
        // 但是为了安全，我们延迟一点执行，避免与 onPopupClick() 中的 hide() 冲突
        // 检查倒计时是否仍然激活，如果已经取消（用户点击），则不需要隐藏
        this.scheduleOnce(() => {
            // 只有在倒计时不再激活时才隐藏（说明是自动完成，而不是用户点击）
            // 如果用户点击，isCountdownActive 已经被设置为 false，但 onPopupClick() 已经调用了 hide()
            // 所以这里只需要检查弹窗是否仍然激活
            if (this.uiManager && this.uiManager.countdownPopup && this.uiManager.countdownPopup.node.active) {
               //console.info(`[EnemySpawner] continueToNextWaves() 延迟隐藏倒计时弹窗（自动完成或用户已点击）`);
                this.uiManager.hideCountdownPopup();
            }
        }, 0.1);
        
        // 如果还有下一波，开始下一波
        if (this.currentLevelConfig && this.currentLevelConfig.waves) {
            const totalWaves = this.currentLevelConfig.waves.length;
           //console.info(`[EnemySpawner] continueToNextWaves() 检查波次，currentWaveIndex=${this.currentWaveIndex}, totalWaves=${totalWaves}, 条件=${this.currentWaveIndex < totalWaves - 1}`);
            if (this.currentWaveIndex < totalWaves - 1) {
               //console.info(`[EnemySpawner] 继续下一波，currentWaveIndex: ${this.currentWaveIndex}, 总波数: ${totalWaves}`);
                // 调用 startNextWave 开始下一波
                this.startNextWave();
            } else {
               //console.info(`[EnemySpawner] 没有更多波次了，currentWaveIndex: ${this.currentWaveIndex}, 总波数: ${totalWaves}`);
            }
        } else {
            console.warn(`[EnemySpawner] continueToNextWaves() currentLevelConfig或waves不存在`);
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
        
        // 如果索引超出范围，说明所有配置都已完成
        if (this.currentEnemyIndex >= this.currentWave.enemies.length) {
            return false;
        }
        
        // 确保索引在有效范围内
        if (this.currentEnemyIndex < 0 || this.currentEnemyIndex >= this.currentWave.enemies.length) {
            return false;
        }
        
        // 记录起始索引，避免无限循环
        const startIndex = this.currentEnemyIndex;
        let attempts = 0;
        const maxAttempts = this.currentWave.enemies.length;
        
        // 循环查找下一个存在的预制体
        while (attempts < maxAttempts) {
            this.currentEnemyConfig = this.currentWave.enemies[this.currentEnemyIndex];
            // 获取新配置时重置计数
            // 注意：这里总是重置，因为如果重新获取同一个配置，说明之前的生成已经完成
            this.enemiesSpawnedCount = 0;
            
            // 检查敌人预制体是否存在
            const prefabName = this.currentEnemyConfig.prefabName;
            const prefab = this.enemyPrefabMap.get(prefabName);
            
            if (prefab) {
                // 找到存在的预制体，返回成功
                return true;
            }
            
            // 预制体不存在，记录警告并尝试下一个
            console.warn(`[EnemySpawner.getCurrentEnemyConfig] 预制体不存在: ${prefabName}, 索引: ${this.currentEnemyIndex}`);
            
            // 尝试下一个索引
            this.currentEnemyIndex++;
            attempts++;
            
            // 如果索引超出范围，从头开始查找
            if (this.currentEnemyIndex >= this.currentWave.enemies.length) {
                this.currentEnemyIndex = 0;
            }
            
            // 如果已经回到起始索引，说明所有配置的预制体都不存在
            if (this.currentEnemyIndex === startIndex) {
                console.error(`[EnemySpawner.getCurrentEnemyConfig] 当前波次所有敌人配置的预制体都不存在`);
                return false;
            }
        }
        
        // 如果尝试了所有配置都没有找到存在的预制体，返回失败
        console.error(`[EnemySpawner.getCurrentEnemyConfig] 无法找到存在的预制体，已尝试所有配置`);
        return false;
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

        // 性能优化：从对象池获取敌人，而不是直接实例化
        let enemy: Node | null = null;
        if (this.enemyPool) {
            enemy = this.enemyPool.get(this.testEnemyType);
        }
        
        // 如果对象池没有可用对象，降级使用instantiate
        if (!enemy) {
            enemy = instantiate(enemyPrefab);
        }
        
        enemy.setParent(this.enemyContainer || this.node);
        enemy.setWorldPosition(spawnPos);

        // 设置敌人的目标水晶，支持所有敌人类型
        const enemyScript = enemy.getComponent(Enemy) as any || enemy.getComponent(OrcWarrior) as any || enemy.getComponent(OrcWarlord) as any || enemy.getComponent(TrollSpearman) as any || enemy.getComponent(Boss) as any || enemy.getComponent('Boss') as any || enemy.getComponent('Dragon') as any;
        if (enemyScript) {
            // 设置prefabName（用于对象池回收）
            enemyScript.prefabName = this.testEnemyType;
            
            // 从配置文件加载金币和经验奖励（在设置prefabName之后）
            if (enemyScript.loadRewardsFromConfig && typeof enemyScript.loadRewardsFromConfig === 'function') {
                enemyScript.loadRewardsFromConfig();
            }
            
            // 根据关卡数强化敌人属性（在加载配置之后，确保使用原始值计算）
            this.applyLevelBuff(enemyScript);
            
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

        // 限制同屏敌人数量：若场上敌人数量达到上限，则本次不再刷怪
        let currentEnemyCount = 0;
        const unitManager = UnitManager.getInstance();
        if (unitManager) {
            const enemies = unitManager.getEnemies();
            currentEnemyCount = enemies ? enemies.length : 0;
        } else {
            // 降级方案：直接统计 Canvas/Enemies 下的激活子节点数量
            const enemiesNode = find('Canvas/Enemies');
            if (enemiesNode && enemiesNode.isValid) {
                const children = enemiesNode.children || [];
                for (let i = 0; i < children.length; i++) {
                    const node = children[i];
                    if (node && node.isValid && node.active) {
                        currentEnemyCount++;
                    }
                }
            }
        }

        if (currentEnemyCount >= this.maxEnemiesOnScreen) {
           //console.info(`[EnemySpawner.spawnEnemy] 当前敌人数量 ${currentEnemyCount} 已达到上限 ${this.maxEnemiesOnScreen}，暂停本次刷怪`);
            return;
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

        // 性能优化：从对象池获取敌人，而不是直接实例化
        let enemy: Node | null = null;
        if (this.enemyPool) {
            enemy = this.enemyPool.get(prefabName);
        }
        
        // 如果对象池没有可用对象，降级使用instantiate
        if (!enemy) {
            enemy = instantiate(enemyPrefab);
        }
        
        enemy.setParent(this.enemyContainer || this.node);
        enemy.setWorldPosition(spawnPos);

        // 设置敌人的目标水晶，支持Enemy、OrcWarrior、OrcWarlord、TrollSpearman、Dragon和Boss
        // 尝试获取不同类型的敌人组件
        const enemyScript = enemy.getComponent(Enemy) as any || enemy.getComponent(OrcWarrior) as any || enemy.getComponent(OrcWarlord) as any || enemy.getComponent(TrollSpearman) as any || enemy.getComponent('Dragon') as any || enemy.getComponent(Boss) as any || enemy.getComponent('Boss') as any;
        if (enemyScript) {
            // 设置prefabName（用于对象池回收）
            enemyScript.prefabName = prefabName;
            
            // 从配置文件加载金币和经验奖励（在设置prefabName之后）
            if (enemyScript.loadRewardsFromConfig && typeof enemyScript.loadRewardsFromConfig === 'function') {
                enemyScript.loadRewardsFromConfig();
            }
            
            // 根据关卡数强化敌人属性（在加载配置之后，确保使用原始值计算）
            this.applyLevelBuff(enemyScript);
            
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
            // 检查是否所有配置都已完成
            if (this.currentWave && this.currentEnemyIndex + 1 >= this.currentWave.enemies.length) {
                // 所有配置都已完成，结束当前波次
               //console.info(`[EnemySpawner.spawnEnemy] 所有敌人配置已完成，准备结束波次。currentEnemyIndex: ${this.currentEnemyIndex}, enemies.length: ${this.currentWave.enemies.length}`);
                this.currentEnemyIndex++;
                this.currentEnemyConfig = null;
                this.enemiesSpawnedCount = 0;
                // 延迟一帧调用 endCurrentWave，确保所有敌人都已生成
                this.scheduleOnce(() => {
                    this.endCurrentWave();
                }, 0);
                return;
            }
            
            // 还有更多配置，获取下一个
            this.currentEnemyIndex++;
            this.currentEnemyConfig = null;
            this.enemiesSpawnedCount = 0;
        }
    }
    
    /**
     * 根据当前关卡计算敌人属性增幅倍数
     * 第一关：1.0倍（无增幅）
     * 第二关：1.0倍（无增幅）
     * 第三关：1.1倍（10%增幅）
     * 第四关：1.2倍（20%增幅）
     * 以此类推：从第三关开始，1.0 + (currentLevel - 2) * 0.1
     * @returns 增幅倍数
     */
    private getLevelMultiplier(): number {
        if (this.currentLevel <= 2) {
            return 1.0; // 第一关和第二关无增幅
        }
        return 1.0 + (this.currentLevel - 2) * 0.1; // 从第三关开始增幅
    }

    /**
     * 根据关卡数强化敌人属性（生命值和攻击力）
     * @param enemyScript 敌人脚本组件
     */
    private applyLevelBuff(enemyScript: any) {
        if (!enemyScript) {
            return;
        }

        const multiplier = this.getLevelMultiplier();
        
        // 如果已经是1.0倍（第一关），不需要调整
        if (multiplier === 1.0) {
            return;
        }

        // 获取原始值（如果已经保存过，使用保存的值；否则使用当前值作为原始值）
        let originalMaxHealth = enemyScript._originalMaxHealth;
        let originalAttackDamage = enemyScript._originalAttackDamage;
        
        // 如果还没有保存原始值，保存当前值作为原始值
        if (originalMaxHealth === undefined) {
            originalMaxHealth = enemyScript.maxHealth || 0;
            enemyScript._originalMaxHealth = originalMaxHealth;
        }
        if (originalAttackDamage === undefined) {
            originalAttackDamage = enemyScript.attackDamage || 0;
            enemyScript._originalAttackDamage = originalAttackDamage;
        }

        // 应用增幅到生命值（基于原始值）
        if (originalMaxHealth > 0) {
            enemyScript.maxHealth = Math.floor(originalMaxHealth * multiplier);
            // 如果敌人已经初始化，也需要更新当前生命值
            if (enemyScript.currentHealth !== undefined) {
                enemyScript.currentHealth = enemyScript.maxHealth;
            }
        }

        // 应用增幅到攻击力（基于原始值）
        if (originalAttackDamage > 0) {
            enemyScript.attackDamage = Math.floor(originalAttackDamage * multiplier);
        }

    }

    /**
     * 检查胜利条件：场上是否还有存活的敌人
     * @returns 如果所有敌人都被消灭，返回true
     */
    private checkVictoryCondition(): boolean {
        const enemiesNode = find('Canvas/Enemies');
        if (!enemiesNode || !enemiesNode.isValid) {
            // 如果Enemies节点不存在，认为没有敌人
           //console.info('[EnemySpawner.checkVictoryCondition] Enemies节点不存在，返回true');
            return true;
        }
        
        const enemies = enemiesNode.children || [];
        let aliveCount = 0;
        
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!enemy || !enemy.isValid || !enemy.active) {
                continue;
            }
            
            // 检查敌人是否存活
            const enemyScript = enemy.getComponent('Enemy') as any || 
                               enemy.getComponent('OrcWarrior') as any || 
                               enemy.getComponent('OrcWarlord') as any || 
                               enemy.getComponent('TrollSpearman') as any;
            
            if (enemyScript) {
                // 检查是否有isAlive方法
                if (enemyScript.isAlive && typeof enemyScript.isAlive === 'function') {
                    if (enemyScript.isAlive()) {
                        aliveCount++;
                    }
                } else if (enemyScript.health !== undefined && enemyScript.health > 0) {
                    aliveCount++;
                } else if (enemyScript.currentHealth !== undefined && enemyScript.currentHealth > 0) {
                    aliveCount++;
                }
            } else {
                // 如果没有脚本，认为节点存在就是有敌人
                aliveCount++;
            }
        }
        
        if (aliveCount > 0) {
           //console.info(`[EnemySpawner.checkVictoryCondition] 还有 ${aliveCount} 个存活的敌人`);
            return false;
        }
        
        // 所有敌人都被消灭
       //console.info('[EnemySpawner.checkVictoryCondition] 所有敌人都被消灭，返回true');
        return true;
    }
    
    /**
     * 重置波次系统
     */
    reset() {
        console.log(`[EnemySpawner] 重置波次系统，当前关卡: ${this.currentLevel}`);
        
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
        this.isLastWaveCompleted = false; // 重置最后一波完成标志
        this.victoryCheckTimer = 0; // 重置胜利检查计时器
        this.isCountdownActive = false; // 重置倒计时状态
        
        // 清除倒计时自动继续定时器
        if (this.countdownAutoContinueTimer) {
            clearTimeout(this.countdownAutoContinueTimer);
            this.countdownAutoContinueTimer = null;
        }
        
        // 重新初始化敌人预制体映射表（只清空并重新添加主包预制体）
        this.initEnemyPrefabMap();
        
        // 重要：重新注入从分包加载的预制体（这些预制体已经在内存中，不需要重新加载）
        this.injectOrcPrefabToMap();
        this.injectOrcWarriorPrefabToMap();
        this.injectTrollSpearmanPrefabToMap();
        this.injectDragonPrefabToMap();
        this.injectOrcWarlordPrefabToMap();
        this.injectOrcShamanPrefabToMap();
        
        console.log(`[EnemySpawner] 预制体映射表重置完成，当前预制体数量: ${this.enemyPrefabMap.size}`);
        // 输出所有预制体名称，便于调试
        const prefabNames = Array.from(this.enemyPrefabMap.keys());
        console.log(`[EnemySpawner] 可用预制体: ${prefabNames.join(', ')}`);
        
        // 重新初始化对象池（清空并重新注册）
        if (this.enemyPool) {
            this.enemyPool.clearAllPools();
            // 重新注册所有预制体
            for (const [prefabName, prefab] of this.enemyPrefabMap.entries()) {
                this.enemyPool.registerPrefab(prefabName, prefab);
            }
            console.log(`[EnemySpawner] 对象池重置完成`);
        } else {
            this.initEnemyPool();
        }
        
        // 重新加载当前关卡配置（确保配置正确）
        console.log(`[EnemySpawner] 重新加载关卡 ${this.currentLevel} 的配置`);
        this.isConfigLoaded = false;
        this.currentLevelConfig = null;
        this.loadLevelConfig(this.currentLevel);
    }
    
    /**
     * 使用本地波次配置作为备用方案
     */
    private useLocalWaveConfig() {
        // 创建本地关卡配置（直接是LevelConfig格式）
        this.currentLevelConfig = {
            id: this.currentLevel,
            name: `关卡${this.currentLevel}`,
            description: "本地备用配置",
            waves: [
                {
                    id: 1,
                    name: "第一波",
                    description: "基础敌人来袭",
                    preWaveDelay: 3,
                    enemies: [
                        {
                            prefabName: "Orc",
                            count: 10,
                            interval: 1.0
                        }
                    ]
                }
            ]
        };
        
        // 使用本地配置后也要标记为已加载
        if (this.currentLevelConfig) {
            this.isConfigLoaded = true;
            console.log('[EnemySpawner] 使用本地配置，配置已加载');
        }
        
        // 不立即开始第一波，只在游戏开始后才开始波次系统
    }

    /**
     * 获取当前波次索引（从1开始）
     */
    public getCurrentWaveNumber(): number {
        return this.currentWaveIndex + 1;
    }

    /**
     * 获取总波次数
     */
    public getTotalWaves(): number {
        if (!this.currentLevelConfig || !this.currentLevelConfig.waves) {
            return 0;
        }
        return this.currentLevelConfig.waves.length;
    }
}
