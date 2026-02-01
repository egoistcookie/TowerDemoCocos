import { _decorator, Component, Node, Prefab, instantiate, Vec3, EventTouch, input, Input, Camera, find, view, UITransform, SpriteFrame, Graphics, Color, director, tween, Sprite } from 'cc';
import { GameManager } from './GameManager';
import { BuildingSelectionPanel, BuildingType } from './BuildingSelectionPanel';
import { GamePopup } from './GamePopup';
import { UnitSelectionManager } from './UnitSelectionManager';
import { WarAncientTree } from './role/WarAncientTree';
import { HunterHall } from './role/HunterHall';
import { StoneWall } from './role/StoneWall';
import { WatchTower } from './role/WatchTower';
import { IceTower } from './role/IceTower';
import { ThunderTower } from './role/ThunderTower';
import { SwordsmanHall } from './role/SwordsmanHall';
import { TalentEffectManager } from './TalentEffectManager';
import { Church } from './role/Church';
import { UnitConfigManager } from './UnitConfigManager';
import { PlayerDataManager } from './PlayerDataManager';
import { BuildingGridPanel } from './BuildingGridPanel';
import { StoneWallGridPanel } from './StoneWallGridPanel';
import { BuildingPool } from './BuildingPool';
const { ccclass, property } = _decorator;

@ccclass('TowerBuilder')
export class TowerBuilder extends Component {
    // 战争古树预制体：已经移动到分包 prefabs_sub，由 GameManager 在运行时注入
    private warAncientTreePrefab: Prefab = null!; // 战争古树预制体（运行时赋值）

    @property(SpriteFrame)
    warAncientTreeIcon: SpriteFrame = null!; // 战争古树图标



    // 猎手大厅预制体：已经移动到分包 prefabs_sub，由 GameManager 在运行时注入
    private hunterHallPrefab: Prefab = null!; // 猎手大厅预制体（运行时赋值）

    @property(SpriteFrame)
    hunterHallIcon: SpriteFrame = null!; // 猎手大厅图标

    // 石墙预制体：已经移动到分包 prefabs_sub，由 GameManager 在运行时注入
    private stoneWallPrefab: Prefab = null!; // 石墙预制体（运行时赋值）

    @property(SpriteFrame)
    stoneWallIcon: SpriteFrame = null!; // 石墙图标

    // 哨塔预制体：不再通过 Cocos 属性面板指定，而是从分包 prefabs_sub 中加载后由 GameManager 注入
    private watchTowerPrefab: Prefab = null!; // 哨塔预制体（运行时赋值）

    @property(SpriteFrame)
    watchTowerIcon: SpriteFrame = null!; // 哨塔图标

    // 冰元素塔预制体：已经移动到分包 prefabs_sub，由 GameManager 在运行时注入
    private iceTowerPrefab: Prefab = null!; // 冰元素塔预制体（运行时赋值）

    @property(SpriteFrame)
    iceTowerIcon: SpriteFrame = null!; // 冰元素塔图标

    // 雷元素塔预制体：已经移动到分包 prefabs_sub，由 GameManager 在运行时注入
    private thunderTowerPrefab: Prefab = null!; // 雷元素塔预制体（运行时赋值）

    @property(SpriteFrame)
    thunderTowerIcon: SpriteFrame = null!; // 雷元素塔图标

    // 剑士小屋预制体：已经移动到分包 prefabs_sub，由 GameManager 在运行时注入
    private swordsmanHallPrefab: Prefab = null!; // 剑士小屋预制体（运行时赋值）

    @property(SpriteFrame)
    swordsmanHallIcon: SpriteFrame = null!; // 剑士小屋图标

    // 教堂预制体：已经移动到分包 prefabs_sub，由 GameManager 在运行时注入
    private churchPrefab: Prefab = null!; // 教堂预制体（运行时赋值）

    @property(SpriteFrame)
    churchIcon: SpriteFrame = null!; // 教堂图标

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
    hunterHallContainer: Node = null!; // 猎手大厅容器

    @property(Node)
    stoneWallContainer: Node = null!; // 石墙容器

    @property(Node)
    watchTowerContainer: Node = null!; // 哨塔容器

    @property(Node)
    iceTowerContainer: Node = null!; // 冰元素塔容器

    @property(Node)
    thunderTowerContainer: Node = null!; // 雷元素塔容器

    @property(Node)
    swordsmanHallContainer: Node = null!; // 剑士小屋容器

    @property(Node)
    churchContainer: Node = null!; // 教堂容器

    @property(Node)
    buildingGridPanel: Node = null!; // 建筑物网格面板节点

    @property(Node)
    stoneWallGridPanel: Node = null!; // 石墙网格面板节点

    @property
    towerCost: number = 10; // 战争古树建造成本（10金币）



    @property
    hunterHallCost: number = 10; // 猎手大厅建造成本（10金币）

    @property
    stoneWallCost: number = 5; // 石墙建造成本（5金币）

    @property
    watchTowerCost: number = 5; // 哨塔建造成本（5金币）

    @property
    swordsmanHallCost: number = 10; // 剑士小屋建造成本（10金币）

    @property
    churchCost: number = 10; // 教堂建造成本（10金币）

    private isBuildingMode: boolean = false;
    private previewTower: Node = null!;
    private gameManager: GameManager = null!;
    private buildingPanel: BuildingSelectionPanel = null!;
    private currentSelectedBuilding: BuildingType | null = null;
    private gridPanel: BuildingGridPanel = null!; // 网格面板组件
    private stoneWallGridPanelComponent: StoneWallGridPanel = null!; // 石墙网格面板组件
    private initialStoneWallsPlaced: boolean = false; // 是否已生成初始石墙
    private initialWatchTowersPlaced: boolean = false; // 是否已生成初始哨塔
    
    // 建筑物拖拽相关
    private isDraggingBuilding: boolean = false; // 是否正在拖拽建筑物
    private draggedBuilding: Node = null!; // 当前拖拽的建筑物节点
    private draggedBuildingOriginalGrid: { x: number; y: number } | null = null; // 拖拽建筑物原始网格位置
    
    // 长按检测相关
    private longPressBuilding: Node | null = null; // 正在长按的建筑物
    private longPressStartTime: number = 0; // 长按开始时间
    private longPressThreshold: number = 0.5; // 长按阈值（秒）
    private longPressStartPos: Vec3 | null = null; // 长按开始位置
    private longPressMoveThreshold: number = 10; // 移动阈值（像素），超过此距离取消长按
    private longPressIndicator: Node | null = null; // 长按指示器节点（旋转圆弧）
    private isLongPressActive: boolean = false; // 是否正在长按检测中

    /**
     * 由 GameManager 在分包加载完毕后调用，注入分包中的预制体
     */
    public setWatchTowerPrefab(prefab: Prefab) {
        this.watchTowerPrefab = prefab;
        // 预制体更新后，尝试从中提取图标
        this.ensureIconsFromPrefabs();
    }

    public setStoneWallPrefab(prefab: Prefab) {
        this.stoneWallPrefab = prefab;
        // 预制体更新后，尝试从中提取图标
        this.ensureIconsFromPrefabs();
    }

    public setIceTowerPrefab(prefab: Prefab) {
        this.iceTowerPrefab = prefab;
        // 预制体更新后，尝试从中提取图标
        this.ensureIconsFromPrefabs();
    }

    public setThunderTowerPrefab(prefab: Prefab) {
        this.thunderTowerPrefab = prefab;
        // 预制体更新后，尝试从中提取图标
        this.ensureIconsFromPrefabs();
    }

    public setWarAncientTreePrefab(prefab: Prefab) {
        this.warAncientTreePrefab = prefab;
        // 预制体更新后，尝试从中提取图标
        this.ensureIconsFromPrefabs();
    }

    public setHunterHallPrefab(prefab: Prefab) {
        this.hunterHallPrefab = prefab;
        // 预制体更新后，尝试从中提取图标
        this.ensureIconsFromPrefabs();
    }

    public setSwordsmanHallPrefab(prefab: Prefab) {
        this.swordsmanHallPrefab = prefab;
        // 预制体更新后，尝试从中提取图标
        this.ensureIconsFromPrefabs();
    }

    public setChurchPrefab(prefab: Prefab) {
        this.churchPrefab = prefab;
        // 预制体更新后，尝试从中提取图标
        this.ensureIconsFromPrefabs();
    }

    /**
     * 在所有预制体加载完成后调用，更新建筑类型列表
     */
    public refreshBuildingTypes() {
        this.updateBuildingTypes();
    }

    /**
     * 更新建筑类型列表（当预制体被注入后调用）
     */
    private updateBuildingTypes() {
        if (!this.buildingPanel) {
            return; // 如果面板还未初始化，直接返回
        }

        const buildingTypes: BuildingType[] = [];
        const configManager = UnitConfigManager.getInstance();
        
        // 确保配置文件已加载（如果未加载，使用预制体的默认值作为后备）
        if (this.warAncientTreePrefab) {
            let cost = this.towerCost; // 默认使用预制体的值
            if (configManager.isConfigLoaded()) {
                const configCost = this.getBuildCostFromConfig('WarAncientTree');
                if (configCost > 0) {
                    cost = this.getActualBuildCost('WarAncientTree', configCost);
                }
            }
            buildingTypes.push({
                name: '弓箭手小屋',
                prefab: this.warAncientTreePrefab,
                cost: cost,
                icon: this.warAncientTreeIcon || null!,
                description: '可以生产Tower单位'
            });
        }
        if (this.hunterHallPrefab) {
            let cost = this.hunterHallCost; // 默认使用预制体的值
            if (configManager.isConfigLoaded()) {
                const configCost = this.getBuildCostFromConfig('HunterHall');
                if (configCost > 0) {
                    cost = this.getActualBuildCost('HunterHall', configCost);
                }
            }
            buildingTypes.push({
                name: '猎手大厅',
                prefab: this.hunterHallPrefab,
                cost: cost,
                icon: this.hunterHallIcon || null!,
                description: '可以生产女猎手单位'
            });
        }
        // if (this.stoneWallPrefab) {
        //     let cost = this.stoneWallCost; // 默认使用预制体的值
        //     if (configManager.isConfigLoaded()) {
        //         const configCost = this.getBuildCostFromConfig('StoneWall');
        //         if (configCost > 0) {
        //             cost = this.getActualBuildCost('StoneWall', configCost);
        //         }
        //     }
        //     buildingTypes.push({
        //         name: '石墙',
        //         prefab: this.stoneWallPrefab,
        //         cost: cost,
        //         icon: this.stoneWallIcon || null!,
        //         description: '坚固的障碍物，阻挡敌人进攻路线'
        //     });
        // }
        // 哨塔不在建造面板中显示，只能通过初始化生成
        // if (this.watchTowerPrefab) {
        //     let cost = this.watchTowerCost; // 默认使用预制体的值
        //     if (configManager.isConfigLoaded()) {
        //         const configCost = this.getBuildCostFromConfig('WatchTower');
        //         if (configCost > 0) {
        //             cost = this.getActualBuildCost('WatchTower', configCost);
        //         }
        //     }
        //     buildingTypes.push({
        //         name: '哨塔',
        //         prefab: this.watchTowerPrefab,
        //         cost: cost,
        //         icon: this.watchTowerIcon || null!,
        //         description: '可以攻击敌人的防御塔，使用弓箭攻击'
        //     });
        // }
        if (this.swordsmanHallPrefab) {
            let cost = this.swordsmanHallCost; // 默认使用预制体的值
            if (configManager.isConfigLoaded()) {
                const configCost = this.getBuildCostFromConfig('SwordsmanHall');
                if (configCost > 0) {
                    cost = this.getActualBuildCost('SwordsmanHall', configCost);
                }
            }
            buildingTypes.push({
                name: '剑士小屋',
                prefab: this.swordsmanHallPrefab,
                cost: cost,
                icon: this.swordsmanHallIcon || null!,
                description: '可以生产精灵剑士单位'
            });
        }
        if (this.churchPrefab) {
            let cost = this.churchCost; // 默认使用预制体的值
            if (configManager.isConfigLoaded()) {
                const configCost = this.getBuildCostFromConfig('Church');
                if (configCost > 0) {
                    cost = this.getActualBuildCost('Church', configCost);
                }
            }
            buildingTypes.push({
                name: '教堂',
                prefab: this.churchPrefab,
                cost: cost,
                icon: this.churchIcon || null!,
                description: '可以生产为友军治疗的牧师单位'
            });
        }
        this.buildingPanel.setBuildingTypes(buildingTypes);
    }

    /**
     * 重新开始游戏时重置内部状态，允许重新生成初始石墙和哨塔
     */
    public resetForRestart() {
        this.initialStoneWallsPlaced = false;
        this.initialWatchTowersPlaced = false;
    }

    /**
     * 从预制体的 Sprite 组件中自动提取图标（如果未在编辑器中手动指定）
     */
    private ensureIconsFromPrefabs() {
        const extractIconFromPrefab = (prefab: Prefab | null | undefined, currentIcon: SpriteFrame | null | undefined): SpriteFrame | null | undefined => {
            if (currentIcon) {
                return currentIcon;
            }
            if (!prefab || !prefab.data) {
                return currentIcon;
            }
            const root = prefab.data as Node;
            if (!root) {
                return currentIcon;
            }
            const sprite = root.getComponent(Sprite) || root.getComponentInChildren(Sprite);
            if (sprite && sprite.spriteFrame) {
                return sprite.spriteFrame;
            }
            return currentIcon;
        };

        // 石墙 / 哨塔 / 冰塔 / 雷塔 / 战争古树 / 猎手大厅 / 剑士小屋 / 教堂图标，如果未手动设置，则自动从对应预制体根节点（或子节点）的 Sprite 中提取
        this.stoneWallIcon = extractIconFromPrefab(this.stoneWallPrefab, this.stoneWallIcon) as SpriteFrame;
        this.watchTowerIcon = extractIconFromPrefab(this.watchTowerPrefab, this.watchTowerIcon) as SpriteFrame;
        this.iceTowerIcon = extractIconFromPrefab(this.iceTowerPrefab, this.iceTowerIcon) as SpriteFrame;
        this.thunderTowerIcon = extractIconFromPrefab(this.thunderTowerPrefab, this.thunderTowerIcon) as SpriteFrame;
        this.warAncientTreeIcon = extractIconFromPrefab(this.warAncientTreePrefab, this.warAncientTreeIcon) as SpriteFrame;
        this.hunterHallIcon = extractIconFromPrefab(this.hunterHallPrefab, this.hunterHallIcon) as SpriteFrame;
        this.swordsmanHallIcon = extractIconFromPrefab(this.swordsmanHallPrefab, this.swordsmanHallIcon) as SpriteFrame;
        this.churchIcon = extractIconFromPrefab(this.churchPrefab, this.churchIcon) as SpriteFrame;
    }

    start() {
        // 查找游戏管理器
        this.findGameManager();
        
        // 从分包注入的预制体中自动提取图标（如果未在编辑器中配置）
        this.ensureIconsFromPrefabs();

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

        // 创建剑士小屋容器
        if (!this.swordsmanHallContainer) {
            const existingHalls = find('SwordsmanHalls');
            if (existingHalls) {
                this.swordsmanHallContainer = existingHalls;
            } else {
                this.swordsmanHallContainer = new Node('SwordsmanHalls');
                const canvas = find('Canvas');
                if (canvas) {
                    this.swordsmanHallContainer.setParent(canvas);
                } else if (this.node.scene) {
                    this.swordsmanHallContainer.setParent(this.node.scene);
                }
            }
        }

        // 创建教堂容器
        if (!this.churchContainer) {
            const existingChurches = find('Churches');
            if (existingChurches) {
                this.churchContainer = existingChurches;
            } else {
                this.churchContainer = new Node('Churches');
                const canvas = find('Canvas');
                if (canvas) {
                    this.churchContainer.setParent(canvas);
                } else if (this.node.scene) {
                    this.churchContainer.setParent(this.node.scene);
                }
            }
        }

        // 创建哨塔容器
        if (!this.watchTowerContainer) {
            const existingWatchTowers = find('Canvas/WatchTowers');
            if (existingWatchTowers) {
                this.watchTowerContainer = existingWatchTowers;
            } else {
                this.watchTowerContainer = new Node('WatchTowers');
                const canvas = find('Canvas');
                if (canvas) {
                    this.watchTowerContainer.setParent(canvas);
                } else if (this.node.scene) {
                    this.watchTowerContainer.setParent(this.node.scene);
                }
            }
        }

        // 创建冰塔容器
        if (!this.iceTowerContainer) {
            const existingIceTowers = find('Canvas/IceTowers');
            if (existingIceTowers) {
                this.iceTowerContainer = existingIceTowers;
            } else {
                this.iceTowerContainer = new Node('IceTowers');
                const canvas = find('Canvas');
                if (canvas) {
                    this.iceTowerContainer.setParent(canvas);
                } else if (this.node.scene) {
                    this.iceTowerContainer.setParent(this.node.scene);
                }
            }
        }

        // 创建雷塔容器
        if (!this.thunderTowerContainer) {
            const existingThunderTowers = find('Canvas/ThunderTowers');
            if (existingThunderTowers) {
                this.thunderTowerContainer = existingThunderTowers;
            } else {
                this.thunderTowerContainer = new Node('ThunderTowers');
                const canvas = find('Canvas');
                if (canvas) {
                    this.thunderTowerContainer.setParent(canvas);
                } else if (this.node.scene) {
                    this.thunderTowerContainer.setParent(this.node.scene);
                }
            }
        }

        // 创建精灵剑士容器
        const existingSwordsmen = find('ElfSwordsmans');
        if (!existingSwordsmen) {
            const swordsmenContainer = new Node('ElfSwordsmans');
            const canvas = find('Canvas');
            if (canvas) {
                swordsmenContainer.setParent(canvas);
            } else if (this.node.scene) {
                swordsmenContainer.setParent(this.node.scene);
            }
        }

        // 创建石墙容器
        if (!this.stoneWallContainer) {
            const existingWalls = find('StoneWalls');
            if (existingWalls) {
                this.stoneWallContainer = existingWalls;
            } else {
                this.stoneWallContainer = new Node('StoneWalls');
                const canvas = find('Canvas');
                if (canvas) {
                    this.stoneWallContainer.setParent(canvas);
                } else if (this.node.scene) {
                    this.stoneWallContainer.setParent(this.node.scene);
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
            // 先移除可能存在的旧监听器，确保只注册一次
            canvasNode.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
            canvasNode.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            canvasNode.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
            
            // 注册事件监听器
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
        // 清除长按检测状态
        this.cancelLongPressDetection();
        
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
        this.updateBuildingTypes();

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
     * 查找石墙网格面板
     */
    findStoneWallGridPanel() {
        // 优先使用属性绑定的节点
        if (this.stoneWallGridPanel) {
            this.stoneWallGridPanelComponent = this.stoneWallGridPanel.getComponent(StoneWallGridPanel);
            if (this.stoneWallGridPanelComponent) {
                return;
            }
        }
        
        // 从编辑器节点获取（Canvas/StoneWallGridPanel）
        const stoneWallGridPanelNode = find('Canvas/StoneWallGridPanel');
        if (stoneWallGridPanelNode) {
            this.stoneWallGridPanelComponent = stoneWallGridPanelNode.getComponent(StoneWallGridPanel);
            if (this.stoneWallGridPanelComponent) {
                this.stoneWallGridPanel = stoneWallGridPanelNode;
            }
        } else {
            console.info('[TowerBuilder] findStoneWallGridPanel: 找不到Canvas/StoneWallGridPanel节点');
        }
    }

    /**
     * 触摸开始事件（检测建筑物点击，开始长按检测）
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
            // 开始长按检测
            this.startLongPressDetection(building, touchLocation);
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

        // 检查长按检测状态，如果移动距离超过阈值，取消长按
        if (this.isLongPressActive && this.longPressBuilding && this.longPressStartPos) {
            try {
                const touchLocation = event.getLocation();
                const moveDistance = Math.sqrt(
                    Math.pow(touchLocation.x - this.longPressStartPos.x, 2) + 
                    Math.pow(touchLocation.y - this.longPressStartPos.y, 2)
                );
                
                if (moveDistance > this.longPressMoveThreshold) {
                    // 移动距离超过阈值，取消长按检测
                    this.cancelLongPressDetection();
                }
            } catch (error) {
                // 如果访问 longPressStartPos 属性出错，取消长按检测
                this.cancelLongPressDetection();
            }
        }

        // 原有的建造模式处理
        if (!this.isBuildingMode || !this.currentSelectedBuilding) {
            // 不在建造模式时清除高亮
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
            if (this.stoneWallGridPanelComponent) {
                this.stoneWallGridPanelComponent.clearHighlight();
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

        // 判断是否是石墙（优先处理石墙的高亮）
        const isStoneWall = this.currentSelectedBuilding && (this.currentSelectedBuilding.name === '石墙' || this.currentSelectedBuilding.prefab === this.stoneWallPrefab);
        
        if (isStoneWall) {
            // 石墙使用石墙网格面板
            if (!this.stoneWallGridPanelComponent) {
                this.findStoneWallGridPanel();
            }
            if (this.stoneWallGridPanelComponent) {
                // 清除普通网格高亮
                if (this.gridPanel) {
                    this.gridPanel.clearHighlight();
                }
                // 高亮显示石墙网格
                this.stoneWallGridPanelComponent.highlightGrid(worldPos);
            }
        } else {
            // 普通建筑物使用普通网格面板
            if (this.gridPanel) {
                // 清除石墙网格高亮
                if (this.stoneWallGridPanelComponent) {
                    this.stoneWallGridPanelComponent.clearHighlight();
                }
                // 高亮显示网格
                this.gridPanel.highlightGrid(worldPos);
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
            if (this.gameManager) {
                return;
            }
        }
        
        // 方法3: 查找所有GameManager组件
        const sceneNodes = director.getScene()?.children || [];
        for (const child of sceneNodes) {
            this.gameManager = child.getComponent(GameManager);
            if (this.gameManager) {
                return;
            }
        }
        
        // 方法4: 查找Canvas节点下的GameManager
        const canvas = find('Canvas');
        if (canvas) {
            this.gameManager = canvas.getComponent(GameManager);
            if (this.gameManager) {
                return;
            }
            
            // 查找Canvas的子节点
            for (const child of canvas.children) {
                this.gameManager = child.getComponent(GameManager);
                if (this.gameManager) {
                    return;
                }
            }
        }
        
        // 如果还是找不到，输出警告
    }

    enableBuildingMode() {
        this.isBuildingMode = true;
        // 显示建筑物选择面板
        if (this.buildingPanel) {
            this.buildingPanel.show();
        }
        
        // 根据当前选中的建筑类型显示相应的网格面板
        if (this.currentSelectedBuilding && this.currentSelectedBuilding.name === '石墙') {
            // 显示石墙网格面板
            if (!this.stoneWallGridPanelComponent) {
                this.findStoneWallGridPanel();
            }
            if (this.stoneWallGridPanelComponent) {
                this.stoneWallGridPanelComponent.show();
            }
        } else {
            // 显示普通建筑网格面板
            if (!this.gridPanel) {
                this.findGridPanel();
            }
            if (this.gridPanel) {
                this.gridPanel.show();
            }
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
        
        // 清除普通建筑网格高亮
        if (this.gridPanel) {
            this.gridPanel.clearHighlight();
        }
        
        // 清除石墙网格高亮
        if (this.stoneWallGridPanelComponent) {
            this.stoneWallGridPanelComponent.clearHighlight();
        }
    }

    /**
     * 获取是否在建造模式下（供外部调用）
     */
    getIsBuildingMode(): boolean {
        return this.isBuildingMode;
    }

    onTouchEnd(event: EventTouch) {
        const location = event.getLocation();
        const targetNode = event.target as Node;
        
        // 无论是否在拖拽状态，都先清除网格高亮（防止残留）
        if (this.gridPanel) {
            this.gridPanel.clearHighlight();
        }
        
        // 处理建筑物拖拽结束 - 优先处理
        if (this.isDraggingBuilding && this.draggedBuilding) {
            // 立即阻止事件传播，避免SelectionManager处理
            event.propagationStopped = true;
            // 处理拖拽结束并放置建筑物
            this.endDraggingBuilding(event);
            // 清除长按检测状态
            this.cancelLongPressDetection();
            return;
        }
        
        // 如果不在拖拽状态，但draggedBuilding还存在，说明状态不一致，强制清除
        if (!this.isDraggingBuilding && this.draggedBuilding) {
            this.draggedBuilding = null!;
            this.draggedBuildingOriginalGrid = null;
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
        }

        // 处理长按检测：如果还在长按检测状态（未进入拖拽模式），则打开信息面板
        // 检查是否正在长按检测，并且触摸时间小于阈值（说明是单击，不是长按）
        if (this.isLongPressActive && this.longPressBuilding && !this.isDraggingBuilding) {
            const currentTime = Date.now();
            const elapsedTime = this.longPressStartTime > 0 ? (currentTime - this.longPressStartTime) / 1000 : 0;
            
            // 如果触摸时间小于阈值，说明是单击，打开信息面板
            if (elapsedTime < this.longPressThreshold) {
                // 先清除长按检测状态，避免定时器继续运行
                const building = this.longPressBuilding;
                // 立即停止定时器并清除状态
                this.unschedule(this.checkLongPress);
                this.isLongPressActive = false;
                this.longPressBuilding = null;
                this.longPressStartTime = 0;
                this.longPressStartPos = null;
                // 隐藏长按指示器
                this.hideLongPressIndicator();
                // 阻止事件传播，防止其他系统处理（包括建筑物的节点级别事件）
                event.propagationStopped = true;
                // 立即打开建筑物信息面板，不要延迟
                if (building && building.isValid) {
                    this.showBuildingInfoPanel(building);
                    // 标记建筑物正在显示信息面板，防止建筑物的点击事件关闭面板
                    (building as any)._showingInfoPanel = true;
                    // 延迟清除标记，给面板时间显示
                    this.scheduleOnce(() => {
                        if (building && building.isValid) {
                            (building as any)._showingInfoPanel = false;
                        }
                    }, 0.1);
                }
                return;
            }
        }

        // 只在建造模式下处理
        if (!this.isBuildingMode || !this.currentSelectedBuilding) {
            // 不在建造模式或没有选中建筑物，不阻止事件传播
            return;
        }
        
        // 判断是否是石墙（优先处理石墙的放置逻辑）
        const isStoneWall = this.currentSelectedBuilding && (this.currentSelectedBuilding.name === '石墙' || this.currentSelectedBuilding.prefab === this.stoneWallPrefab);
        
        // 对于石墙，即使在其他系统可能拦截事件的情况下，也要确保能够放置
        // 石墙是唯一可以放置在地图各处的建筑物，需要优先处理
        if (isStoneWall) {
            // 立即阻止事件传播，确保石墙放置逻辑能够执行
            event.propagationStopped = true;
        }
        
        // 检查是否点击在UI元素上（如按钮、面板），如果是则不处理
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
        // 注意：石墙已经在上面提前阻止了事件传播，这里确保其他建筑物也能阻止事件传播
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

        // 判断是否是石墙（已在上面判断过，这里使用之前的值）
        // isStoneWall 变量已在上面定义（第815行）
        
        let finalWorldPos = worldPos;
        if (isStoneWall) {
            if (!this.stoneWallGridPanelComponent) {
                this.findStoneWallGridPanel();
            }

            const stonePanel = this.stoneWallGridPanelComponent;
            if (!stonePanel) {
                return;
            }

            const gridCenter = stonePanel.getNearestGridCenter(worldPos);
            if (!gridCenter) {
                stonePanel.clearHighlight();
                return;
            }

            const grid = stonePanel.worldToGrid(gridCenter);
            if (!grid || stonePanel.isGridOccupied(grid.x, grid.y)) {
                stonePanel.clearHighlight();
                return;
            }

            finalWorldPos = gridCenter;
        } else if (this.gridPanel) {
            const gridCenter = this.gridPanel.getNearestGridCenter(worldPos);
            if (gridCenter) {
                finalWorldPos = gridCenter;
            } else {
                // 非石墙必须在普通网格内
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
        if (this.stoneWallGridPanelComponent) {
            this.stoneWallGridPanelComponent.clearHighlight();
        }
    }

    canBuildAt(position: Vec3, building: BuildingType): boolean {
        if (!this.targetCrystal || !building) {
            return false;
        }

        // 判断是否是石墙或哨塔（都使用石墙网格）
        const isStoneWall = building.name === '石墙' || building.prefab === this.stoneWallPrefab;
        const isWatchTower = building.name === '哨塔' || building.prefab === this.watchTowerPrefab;
        const useStoneWallGrid = isStoneWall || isWatchTower;

        // 石墙和哨塔必须放置在石墙网格内
        if (useStoneWallGrid) {
            if (!this.stoneWallGridPanelComponent) {
                this.findStoneWallGridPanel();
            }
            const stonePanel = this.stoneWallGridPanelComponent;
            if (!stonePanel) {
                return false;
            }

            if (!stonePanel.isPositionInGrid(position)) {
                return false;
            }

            const grid = stonePanel.worldToGrid(position);
            if (!grid || stonePanel.isGridOccupied(grid.x, grid.y)) {
                return false;
            }

            return true;
        }

        // 非石墙/哨塔：需要在普通网格内并满足距离
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

        // 其他建筑物的碰撞检测（保持原有逻辑）
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

        // 检查是否与现有教堂重叠
        const churches = this.churchContainer?.children || [];
        for (const c of churches) {
            if (c.active) {
                const d = Vec3.distance(position, c.worldPosition);
                if (d < 80) { // 教堂之间/与其他建筑的最小距离
                    return false;
                }
            }
        }

        // 检查是否与现有石墙重叠（其他建筑物不能与石墙重叠）
        const stoneWalls = this.stoneWallContainer?.children || [];
        for (const wall of stoneWalls) {
            if (wall.active) {
                const wallDistance = Vec3.distance(position, wall.worldPosition);
                if (wallDistance < 80) { // 其他建筑物与石墙的最小距离
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
        
        // 从配置文件中获取建造成本
        let buildCost = building.cost;
        const buildingNameToUnitId: Record<string, string> = {
            '弓箭手小屋': 'WarAncientTree',
            '猎手大厅': 'HunterHall',
            '石墙': 'StoneWall',
            '哨塔': 'WatchTower',
            '剑士小屋': 'SwordsmanHall',
            '教堂': 'Church'
        };
        
        const unitId = buildingNameToUnitId[building.name];
        if (unitId) {
            const configCost = this.getBuildCostFromConfig(unitId);
            if (configCost > 0) {
                buildCost = this.getActualBuildCost(unitId, configCost);
            }
        }
        
        if (this.gameManager && !this.gameManager.canAfford(buildCost)) {
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
        } else if (building.name === '猎手大厅' || building.prefab === this.hunterHallPrefab) {
            this.buildHunterHall(worldPosition);
        } else if (building.name === '石墙' || building.prefab === this.stoneWallPrefab) {
            this.buildStoneWall(worldPosition);
        } else if (building.name === '哨塔' || building.prefab === this.watchTowerPrefab) {
            this.buildWatchTower(worldPosition);
        } else if (building.name === '剑士小屋' || building.prefab === this.swordsmanHallPrefab) {
            this.buildSwordsmanHall(worldPosition);
        } else if (building.name === '教堂' || building.prefab === this.churchPrefab) {
            this.buildChurch(worldPosition);
        }

        // 只有在成功建造后才退出建造模式
        this.disableBuildingMode();
        
        // 立即清除网格高亮（绿色可放置框体）
        if (this.gridPanel) {
            this.gridPanel.clearHighlight();
        }
        
        // 清除建筑物的选中状态（只清除UnitSelectionManager，不清除SelectionManager的多选）
        const unitSelectionManagerNode = find('UnitSelectionManager');
        if (unitSelectionManagerNode) {
            const unitSelectionManager = unitSelectionManagerNode.getComponent(UnitSelectionManager);
            if (unitSelectionManager) {
                unitSelectionManager.clearSelection();
            }
        }
        
        // 延迟一帧再次清除选中状态和网格高亮，确保建筑物创建完成后清除
        this.scheduleOnce(() => {
            const unitSelectionManagerNode = find('UnitSelectionManager');
            if (unitSelectionManagerNode) {
                const unitSelectionManager = unitSelectionManagerNode.getComponent(UnitSelectionManager);
                if (unitSelectionManager) {
                    unitSelectionManager.clearSelection();
                }
            }
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
        }, 0);
    }

    /**
     * 建造战争古树
     */
    buildWarAncientTree(worldPosition: Vec3) {
        if (!this.warAncientTreePrefab) {
            return;
        }

        // 确保 gridPanel 存在
        if (!this.gridPanel) {
            this.findGridPanel();
        }

        // 从配置文件中获取建造成本（考虑单位卡片强化减少）
        const actualCost = this.getActualBuildCost('WarAncientTree');
        
        // 消耗金币
        if (this.gameManager) {
            this.gameManager.spendGold(actualCost);
        }

        // 性能优化：从对象池获取建筑物，而不是直接实例化
        const buildingPool = BuildingPool.getInstance();
        let tree: Node | null = null;
        if (buildingPool) {
            // 确保预制体已注册到对象池（如果未注册则注册）
            const stats = buildingPool.getStats();
            if (!stats['WarAncientTree']) {
                buildingPool.registerPrefab('WarAncientTree', this.warAncientTreePrefab);
            }
            tree = buildingPool.get('WarAncientTree');
        }
        
        // 如果对象池没有可用对象，降级使用instantiate
        if (!tree) {
            tree = instantiate(this.warAncientTreePrefab);
        }
        
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
            // 设置prefabName（用于对象池回收）
            treeScript.prefabName = 'WarAncientTree';
            // 先应用配置（排除 buildCost，因为需要在实例化时动态设置）
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                configManager.applyConfigToUnit('WarAncientTree', treeScript, ['buildCost']);
            }
            
            // 应用单位卡片强化
            const talentEffectManager = TalentEffectManager.getInstance();
            talentEffectManager.applyUnitEnhancements('WarAncientTree', treeScript);
            
            // 应用公共天赋增幅
            talentEffectManager.applyTalentEffects(treeScript);
            
            // 然后设置建造成本（使用实际成本）
            treeScript.buildCost = actualCost;
            
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

    }

    /**
     * 建造猎手大厅
     */
    buildHunterHall(worldPosition: Vec3) {
        if (!this.hunterHallPrefab) {
            return;
        }

        // 获取实际建造成本（考虑单位卡片强化减少）
        const actualCost = this.getActualBuildCost('HunterHall');
        
        // 消耗金币
        if (this.gameManager) {
            this.gameManager.spendGold(actualCost);
        }

        // 性能优化：从对象池获取建筑物，而不是直接实例化
        const buildingPool = BuildingPool.getInstance();
        let hall: Node | null = null;
        if (buildingPool) {
            // 确保预制体已注册到对象池（如果未注册则注册）
            const stats = buildingPool.getStats();
            if (!stats['HunterHall']) {
                buildingPool.registerPrefab('HunterHall', this.hunterHallPrefab);
            }
            hall = buildingPool.get('HunterHall');
        }
        
        // 如果对象池没有可用对象，降级使用instantiate
        if (!hall) {
            hall = instantiate(this.hunterHallPrefab);
        }
        
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
            // 设置prefabName（用于对象池回收）
            hallScript.prefabName = 'HunterHall';
            // 先应用配置（如果有）
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                (configManager as any).applyConfigToUnit?.('HunterHall', hallScript, ['buildCost']);
            }
            
            // 应用单位卡片强化
            const talentEffectManager = TalentEffectManager.getInstance();
            talentEffectManager.applyUnitEnhancements('HunterHall', hallScript);
            
            // 应用公共天赋增幅
            talentEffectManager.applyTalentEffects(hallScript);
            
            hallScript.buildCost = actualCost;
            
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

    }

    /**
     * 建造石墙
     */
    buildStoneWall(worldPosition: Vec3, skipCost: boolean = false) {
        if (!this.stoneWallPrefab) {
            return;
        }

        // 获取实际建造成本（考虑单位卡片强化减少）
        const actualCost = this.getActualBuildCost('StoneWall');
        
        // 消耗金币
        if (this.gameManager && !skipCost) {
            this.gameManager.spendGold(actualCost);
        }

        // 性能优化：从对象池获取建筑物，而不是直接实例化
        const buildingPool = BuildingPool.getInstance();
        let wall: Node | null = null;
        if (buildingPool) {
            // 确保预制体已注册到对象池（如果未注册则注册）
            const stats = buildingPool.getStats();
            if (!stats['StoneWall']) {
                buildingPool.registerPrefab('StoneWall', this.stoneWallPrefab);
            }
            wall = buildingPool.get('StoneWall');
        }
        
        // 如果对象池没有可用对象，降级使用instantiate
        if (!wall) {
            wall = instantiate(this.stoneWallPrefab);
        }
        
        // 设置父节点
        const parent = this.stoneWallContainer || this.node;
        if (parent && !parent.active) {
            parent.active = true;
        }
        
        wall.setParent(parent);
        wall.active = true;
        wall.setPosition(0, 0, 0);
        wall.setRotationFromEuler(0, 0, 0);
        wall.setScale(1, 1, 1);
        // 使用setWorldPosition确保位置正确（gridToWorld返回的坐标是相对于Canvas中心的Canvas坐标）
        // 对于UI节点，如果父节点是Canvas，setWorldPosition会将坐标正确设置
        wall.setWorldPosition(worldPosition);

        // 设置建造成本并检查首次出现
        const wallScript = wall.getComponent(StoneWall);
        if (wallScript) {
            // 设置prefabName（用于对象池回收）
            wallScript.prefabName = 'StoneWall';
            // 先应用配置（排除 buildCost 和 collisionRadius，使用预制体中的设置）
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                configManager.applyConfigToUnit('StoneWall', wallScript, ['buildCost', 'collisionRadius']);
            }
            
            // 应用单位卡片强化
            const talentEffectManager = TalentEffectManager.getInstance();
            talentEffectManager.applyUnitEnhancements('StoneWall', wallScript);
            
            // 应用公共天赋增幅
            talentEffectManager.applyTalentEffects(wallScript);
            
            // 然后设置建造成本（使用实际成本）
            wallScript.buildCost = actualCost;
            
            // 石墙只能放置在石墙网格内，占用网格
            if (!this.stoneWallGridPanelComponent) {
                this.findStoneWallGridPanel();
            }
            
            if (this.stoneWallGridPanelComponent) {
                const grid = this.stoneWallGridPanelComponent.worldToGrid(worldPosition);
                if (grid) {
                    // 检查网格是否被占用
                    if (this.stoneWallGridPanelComponent.isGridOccupied(grid.x, grid.y)) {
                        // 网格已被占用，不应该发生这种情况（应该在放置前检查）
                    } else {
                        // 占用网格
                        if (this.stoneWallGridPanelComponent.occupyGrid(grid.x, grid.y, wall)) {
                            wallScript.gridX = grid.x;
                            wallScript.gridY = grid.y;
                        } else {
                            wallScript.gridX = -1;
                            wallScript.gridY = -1;
                        }
                    }
                } else {
                    // 石墙不在石墙网格内，不应该发生这种情况（应该在放置前检查）
                    wallScript.gridX = -1;
                    wallScript.gridY = -1;
                }
            } else {
                wallScript.gridX = -1;
                wallScript.gridY = -1;
            }
            
            // 检查单位是否首次出现
            if (this.gameManager) {
                const unitType = wallScript.unitType || 'StoneWall';
                this.gameManager.checkUnitFirstAppearance(unitType, wallScript);
            }
        }

    }

    /**
     * 建造哨塔
     */
    buildWatchTower(worldPosition: Vec3, skipCost: boolean = false) {
        if (!this.watchTowerPrefab) {
            return;
        }

        // 获取实际建造成本（考虑单位卡片强化减少）
        const actualCost = this.getActualBuildCost('WatchTower');
        
        // 检查人口（哨塔占用1个人口）
        const populationCost = 1;
        if (this.gameManager) {
            // 即使skipCost=true，也需要占用人口（初始化建造的哨塔也需要占用人口）
            if (!this.gameManager.canAddPopulation(populationCost)) {
                if (!skipCost) {
                    GamePopup.showMessage('人口不足，无法建造哨塔');
                }
                return;
            }
            // 消耗金币（仅在非skipCost时）
            if (!skipCost) {
                this.gameManager.spendGold(actualCost);
            }
            // 占用人口（无论是否skipCost都需要占用）
            this.gameManager.addPopulation(populationCost);
        }

        // 确保容器已初始化
        if (!this.watchTowerContainer) {
            this.initializeContainers();
        }
        
        // 性能优化：从对象池获取建筑物，而不是直接实例化
        const buildingPool = BuildingPool.getInstance();
        let tower: Node | null = null;
        if (buildingPool) {
            // 确保预制体已注册到对象池（如果未注册则注册）
            const stats = buildingPool.getStats();
            if (!stats['WatchTower']) {
                buildingPool.registerPrefab('WatchTower', this.watchTowerPrefab);
            }
            tower = buildingPool.get('WatchTower');
        }
        
        // 如果对象池没有可用对象，降级使用instantiate
        if (!tower) {
            tower = instantiate(this.watchTowerPrefab);
        }
        
        // 检查tower是否有效
        if (!tower || !tower.isValid) {
            console.error('[TowerBuilder] buildWatchTower: 无法创建哨塔节点');
            return;
        }
        
        // 设置父节点
        const parent = this.watchTowerContainer || this.node;
        if (!parent || !parent.isValid) {
            console.error('[TowerBuilder] buildWatchTower: 父节点无效');
            if (tower && tower.isValid) {
                tower.destroy();
            }
            return;
        }
        
        if (!parent.active) {
            parent.active = true;
        }
        
        tower.setParent(parent);
        tower.active = true;
        tower.setPosition(0, 0, 0);
        tower.setRotationFromEuler(0, 0, 0);
        tower.setScale(1, 1, 1);
        tower.setWorldPosition(worldPosition);

        // 设置建造成本并检查首次出现
        const towerScript = tower.getComponent(WatchTower);
        if (towerScript) {
            // 设置prefabName（用于对象池回收）
            towerScript.prefabName = 'WatchTower';
            // 先应用配置（排除 buildCost 和 collisionRadius，使用预制体中的设置）
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                configManager.applyConfigToUnit('WatchTower', towerScript, ['buildCost', 'collisionRadius']);
            }
            
            // 应用单位卡片强化
            const talentEffectManager = TalentEffectManager.getInstance();
            talentEffectManager.applyUnitEnhancements('WatchTower', towerScript);
            
            // 应用公共天赋增幅
            talentEffectManager.applyTalentEffects(towerScript);
            
            // 然后设置建造成本（使用实际成本）
            towerScript.buildCost = actualCost;
            
            // 哨塔只能放置在石墙网格内，占用网格
            if (!this.stoneWallGridPanelComponent) {
                this.findStoneWallGridPanel();
            }
            
            if (this.stoneWallGridPanelComponent) {
                const grid = this.stoneWallGridPanelComponent.worldToGrid(worldPosition);
                if (grid) {
                    // 哨塔占据两个网格高度，需要检查两个网格是否都被占用
                    // 检查第二个网格是否存在（grid.y+1不能超出网格范围）
                    if (grid.y + 1 >= this.stoneWallGridPanelComponent.gridHeight) {
                        // 第二个网格超出范围，无法放置
                        towerScript.gridX = -1;
                        towerScript.gridY = -1;
                    } else if (this.stoneWallGridPanelComponent.isGridOccupied(grid.x, grid.y) || 
                               this.stoneWallGridPanelComponent.isGridOccupied(grid.x, grid.y + 1)) {
                        // 至少有一个网格被占用，不应该发生这种情况（应该在放置前检查）
                        towerScript.gridX = -1;
                        towerScript.gridY = -1;
                    } else {
                        // 占用两个网格
                        if (this.stoneWallGridPanelComponent.occupyGrid(grid.x, grid.y, tower) &&
                            this.stoneWallGridPanelComponent.occupyGrid(grid.x, grid.y + 1, tower)) {
                            towerScript.gridX = grid.x;
                            towerScript.gridY = grid.y;
                            // 调整位置：在原有基础上整体向下偏移 25 像素
                            const gridPos = this.stoneWallGridPanelComponent.gridToWorld(grid.x, grid.y);
                            if (gridPos) {
                                const adjustedPos = new Vec3(gridPos.x, gridPos.y, gridPos.z);
                                tower.setWorldPosition(adjustedPos);
                            }
                        } else {
                            // 占用失败，释放已占用的网格
                            this.stoneWallGridPanelComponent.releaseGrid(grid.x, grid.y);
                            this.stoneWallGridPanelComponent.releaseGrid(grid.x, grid.y + 1);
                            towerScript.gridX = -1;
                            towerScript.gridY = -1;
                        }
                    }
                } else {
                    // 哨塔不在石墙网格内，不应该发生这种情况（应该在放置前检查）
                    towerScript.gridX = -1;
                    towerScript.gridY = -1;
                }
            } else {
                towerScript.gridX = -1;
                towerScript.gridY = -1;
            }
            
            // 检查单位是否首次出现
            if (this.gameManager) {
                const unitType = towerScript.unitType || 'WatchTower';
                this.gameManager.checkUnitFirstAppearance(unitType, towerScript);
            }
        }
    }

    /**
     * 在石墙网格最上方一行随机生成指定数量的石墙（仅在游戏开始时调用一次）
     */
    spawnInitialStoneWalls(count: number = 14) {
        if (this.initialStoneWallsPlaced) {
            return;
        }
        if (!this.stoneWallGridPanelComponent) {
            this.findStoneWallGridPanel();
        }
        const panel = this.stoneWallGridPanelComponent;
        if (!panel) {
            return;
        }

        const maxCount = Math.min(count, panel.gridWidth);
        // 最上方一行（StoneWallGridPanel 以左上为0,0，向下为递增）
        const y = 9;

        // 生成并打乱x坐标
        const xs: number[] = [];
        for (let i = 0; i < panel.gridWidth; i++) {
            xs.push(i);
        }
        for (let i = xs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [xs[i], xs[j]] = [xs[j], xs[i]];
        }

        let placed = 0;
        for (const x of xs) {
            if (placed >= maxCount) break;
            // 跳过已占用格子
            if (panel.isGridOccupied(x, y)) {
                continue;
            }
            const worldPos = panel.gridToWorld(x, y);
            if (!worldPos) {
                continue;
            }
            this.buildStoneWall(worldPos, true);
            placed++;
        }

        this.initialStoneWallsPlaced = true;
    }

    /**
     * 在石墙网格中随机生成指定数量的哨塔（仅在游戏开始时调用一次）
     * 确保x坐标相差至少3格，避免太密集
     * 不生成在最上层网格（y=9）
     */
    spawnInitialWatchTowers(count: number = 3) {
        console.info('[TowerBuilder] spawnInitialWatchTowers: 开始生成初始哨塔，数量=', count);
        if (this.initialWatchTowersPlaced) {
            console.info('[TowerBuilder] spawnInitialWatchTowers: 哨塔已生成，跳过');
            return;
        }
        if (!this.stoneWallGridPanelComponent) {
            console.info('[TowerBuilder] spawnInitialWatchTowers: 查找石墙网格面板');
            this.findStoneWallGridPanel();
        }
        const panel = this.stoneWallGridPanelComponent;
        if (!panel) {
            console.info('[TowerBuilder] spawnInitialWatchTowers: 找不到石墙网格面板');
            return;
        }
        console.info('[TowerBuilder] spawnInitialWatchTowers: 找到石墙网格面板，gridWidth=', panel.gridWidth, 'gridHeight=', panel.gridHeight);

        // 排除最上层（y=9），在其他行中随机选择
        // 哨塔占据两个网格高度，所以还需要排除倒数第二层（y=8），因为y=8时y+1=9会超出范围
        const availableYs: number[] = [];
        for (let y = 0; y < panel.gridHeight - 2; y++) { // 排除最上层（y=9）和倒数第二层（y=8）
            availableYs.push(y);
        }
        console.info('[TowerBuilder] spawnInitialWatchTowers: 可用y坐标范围=', availableYs);

        // 生成所有可能的x坐标
        const availableXs: number[] = [];
        for (let x = 0; x < panel.gridWidth; x++) {
            availableXs.push(x);
        }

        // 打乱y坐标
        for (let i = availableYs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableYs[i], availableYs[j]] = [availableYs[j], availableYs[i]];
        }

        // 打乱x坐标
        for (let i = availableXs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableXs[i], availableXs[j]] = [availableXs[j], availableXs[i]];
        }

        const placedPositions: { x: number; y: number }[] = [];
        let placed = 0;
        const minXDistance = 3; // x坐标最小间距
        console.info('[TowerBuilder] spawnInitialWatchTowers: 开始尝试放置哨塔，最小x间距=', minXDistance);

        // 尝试放置哨塔
        for (const y of availableYs) {
            if (placed >= count) break;
            
            for (const x of availableXs) {
                if (placed >= count) break;
                
                // 跳过已占用的格子
                if (panel.isGridOccupied(x, y)) {
                    continue;
                }

                // 检查与已放置的哨塔x坐标距离是否足够
                let canPlace = true;
                for (const pos of placedPositions) {
                    if (Math.abs(x - pos.x) < minXDistance) {
                        canPlace = false;
                        break;
                    }
                }

                if (canPlace) {
                    const worldPos = panel.gridToWorld(x, y);
                    if (!worldPos) {
                        console.info('[TowerBuilder] spawnInitialWatchTowers: 格子(', x, ',', y, ')无法转换为世界坐标，跳过');
                        continue;
                    }
                    console.info('[TowerBuilder] spawnInitialWatchTowers: 在格子(', x, ',', y, ')生成哨塔，世界坐标=', worldPos);
                    // 使用buildWatchTower方法建造哨塔（skipCost=true，不消耗金币）
                    this.buildWatchTower(worldPos, true);
                    
                    // 记录已放置的位置
                    placedPositions.push({ x, y });
                    placed++;
                }
            }
        }

        console.info('[TowerBuilder] spawnInitialWatchTowers: 完成，共生成', placed, '个哨塔');
        this.initialWatchTowersPlaced = true;
    }

    /**
     * 建造冰元素塔
     */
    buildIceTower(worldPosition: Vec3, skipCost: boolean = false) {
        if (!this.iceTowerPrefab) {
            return;
        }

        // 获取实际建造成本（考虑单位卡片强化减少）
        const actualCost = this.getActualBuildCost('IceTower', 20); // 默认20金币
        
        // 检查人口（冰塔占用1个人口）
        const populationCost = 1;
        if (this.gameManager) {
            // 即使skipCost=true，也需要占用人口
            if (!this.gameManager.canAddPopulation(populationCost)) {
                if (!skipCost) {
                    GamePopup.showMessage('人口不足，无法建造冰塔');
                }
                return;
            }
            // 消耗金币（仅在非skipCost时）
            if (!skipCost) {
                this.gameManager.spendGold(actualCost);
            }
            // 占用人口（无论是否skipCost都需要占用）
            this.gameManager.addPopulation(populationCost);
        }

        // 性能优化：从对象池获取建筑物
        const buildingPool = BuildingPool.getInstance();
        let tower: Node | null = null;
        if (buildingPool) {
            const stats = buildingPool.getStats();
            if (!stats['IceTower']) {
                buildingPool.registerPrefab('IceTower', this.iceTowerPrefab);
            }
            tower = buildingPool.get('IceTower');
        }
        
        if (!tower) {
            tower = instantiate(this.iceTowerPrefab);
        }
        
        // 设置父节点
        const parent = this.iceTowerContainer || this.node;
        if (parent && !parent.active) {
            parent.active = true;
        }
        
        tower.setParent(parent);
        tower.active = true;
        tower.setPosition(0, 0, 0);
        tower.setRotationFromEuler(0, 0, 0);
        tower.setScale(1, 1, 1);
        tower.setWorldPosition(worldPosition);

        // 设置建造成本并检查首次出现
        const towerScript = tower.getComponent(IceTower);
        if (towerScript) {
            towerScript.prefabName = 'IceTower';
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                configManager.applyConfigToUnit('IceTower', towerScript, ['buildCost', 'collisionRadius']);
            }
            
            const talentEffectManager = TalentEffectManager.getInstance();
            talentEffectManager.applyUnitEnhancements('IceTower', towerScript);
            talentEffectManager.applyTalentEffects(towerScript);
            
            towerScript.buildCost = actualCost;
            
            // 冰塔只能放置在石墙网格内，占用网格
            if (!this.stoneWallGridPanelComponent) {
                this.findStoneWallGridPanel();
            }
            
            if (this.stoneWallGridPanelComponent) {
                const grid = this.stoneWallGridPanelComponent.worldToGrid(worldPosition);
                if (grid) {
                    // 冰塔占据两个网格高度，需要检查两个网格是否都被占用
                    // 检查上方网格是否存在（grid.y+1不能超出网格范围，Y坐标越大越在上方）
                    if (grid.y + 1 >= this.stoneWallGridPanelComponent.gridHeight) {
                        // 上方网格超出范围，无法放置
                        towerScript.gridX = -1;
                        towerScript.gridY = -1;
                    } else if (this.stoneWallGridPanelComponent.isGridOccupied(grid.x, grid.y) || 
                               this.stoneWallGridPanelComponent.isGridOccupied(grid.x, grid.y + 1)) {
                        // 至少有一个网格被占用，不应该发生这种情况（应该在放置前检查）
                        towerScript.gridX = -1;
                        towerScript.gridY = -1;
                    } else {
                        // 占用两个网格：grid.y（选中的网格，下方）和 grid.y + 1（上方网格）
                        const occupy1 = this.stoneWallGridPanelComponent.occupyGrid(grid.x, grid.y, tower);
                        const occupy2 = this.stoneWallGridPanelComponent.occupyGrid(grid.x, grid.y + 1, tower);
                        console.info('[TowerBuilder] buildIceTower 占用网格:', grid.x, grid.y, '结果:', occupy1, '上方网格:', grid.x, grid.y + 1, '结果:', occupy2);
                        if (occupy1 && occupy2) {
                            towerScript.gridX = grid.x;
                            towerScript.gridY = grid.y; // 使用下方网格的坐标（与哨塔一致）
                            console.info('[TowerBuilder] buildIceTower 成功占用两个网格，gridX:', towerScript.gridX, 'gridY:', towerScript.gridY, '(占用网格:', grid.x, grid.y, '和', grid.x, grid.y + 1, ')');
                            // 调整位置，使其居中在两个网格之间（参考哨塔的做法）
                            const gridPos = this.stoneWallGridPanelComponent.gridToWorld(grid.x, grid.y);
                            console.info('[TowerBuilder] buildIceTower 网格位置:', gridPos);
                            if (gridPos) {
                                // 向上偏移50像素（一个网格），使其居中在两个网格之间
                                const adjustedPos = new Vec3(gridPos.x, gridPos.y + 100, gridPos.z);
                                tower.setWorldPosition(adjustedPos);
                                
                                // 设置 baseY 为下方网格的底部（用于后续的 setHeightWithFixedBottom 调用）
                                const gridPanel = this.stoneWallGridPanelComponent as any;
                                const gridBottomY = gridPos.y - gridPanel.cellSize / 2;
                                (towerScript as any).baseY = gridBottomY;
                                
                                // 根据当前建造阶段更新高度（但不改变位置，因为位置已经设置好了）
                                const constructionStage = (towerScript as any).constructionStage;
                                const defaultScale = (towerScript as any).defaultScale || new Vec3(1, 1, 1);
                                const heightScale = constructionStage === 0 ? 0.5 : constructionStage === 1 ? 0.66 : 1.0;
                                
                                // 设置缩放（保持X和Z不变，只调整Y）
                                tower.setScale(defaultScale.x, defaultScale.y * heightScale, defaultScale.z);
                                
                                // 注意：不调用 setHeightWithFixedBottom，因为它会重新计算位置
                                // 位置已经设置为两个网格的中心，不需要再调整
                            }
                        } else {
                            // 占用失败，释放已占用的网格
                            console.warn('[TowerBuilder] buildIceTower 占用网格失败，释放已占用的网格');
                            if (occupy1) {
                                this.stoneWallGridPanelComponent.releaseGrid(grid.x, grid.y);
                            }
                            if (occupy2) {
                                this.stoneWallGridPanelComponent.releaseGrid(grid.x, grid.y + 1);
                            }
                            towerScript.gridX = -1;
                            towerScript.gridY = -1;
                        }
                    }
                } else {
                    // 冰塔不在石墙网格内，不应该发生这种情况（应该在放置前检查）
                    console.warn('[TowerBuilder] buildIceTower 无法转换为网格坐标');
                    towerScript.gridX = -1;
                    towerScript.gridY = -1;
                }
            } else {
                console.warn('[TowerBuilder] buildIceTower 找不到石墙网格面板');
                towerScript.gridX = -1;
                towerScript.gridY = -1;
            }
            
            // 验证网格占用情况
            if (towerScript.gridX >= 0 && towerScript.gridY >= 0 && this.stoneWallGridPanelComponent) {
                // gridY 是下方网格的坐标（选中的），上方网格是 gridY + 1
                const isOccupied1 = this.stoneWallGridPanelComponent.isGridOccupied(towerScript.gridX, towerScript.gridY);
                const isOccupied2 = this.stoneWallGridPanelComponent.isGridOccupied(towerScript.gridX, towerScript.gridY + 1);
                console.info('[TowerBuilder] buildIceTower 验证网格占用 - 下方网格:', towerScript.gridX, towerScript.gridY, '占用:', isOccupied1, '上方网格:', towerScript.gridX, towerScript.gridY + 1, '占用:', isOccupied2);
            }
            
            if (this.gameManager) {
                const unitType = towerScript.unitType || 'IceTower';
                this.gameManager.checkUnitFirstAppearance(unitType, towerScript);
            }
        }
    }

    /**
     * 建造雷元素塔
     */
    buildThunderTower(worldPosition: Vec3, skipCost: boolean = false) {
        if (!this.thunderTowerPrefab) {
            return;
        }

        // 获取实际建造成本（考虑单位卡片强化减少）
        const actualCost = this.getActualBuildCost('ThunderTower', 30); // 默认30金币
        
        // 检查人口（雷塔占用2个人口）
        const populationCost = 2;
        if (this.gameManager) {
            // 即使skipCost=true，也需要占用人口
            if (!this.gameManager.canAddPopulation(populationCost)) {
                if (!skipCost) {
                    GamePopup.showMessage('人口不足，无法建造雷塔');
                }
                return;
            }
            // 消耗金币（仅在非skipCost时）
            if (!skipCost) {
                this.gameManager.spendGold(actualCost);
            }
            // 占用人口（无论是否skipCost都需要占用）
            this.gameManager.addPopulation(populationCost);
        }

        // 性能优化：从对象池获取建筑物
        const buildingPool = BuildingPool.getInstance();
        let tower: Node | null = null;
        if (buildingPool) {
            const stats = buildingPool.getStats();
            if (!stats['ThunderTower']) {
                buildingPool.registerPrefab('ThunderTower', this.thunderTowerPrefab);
            }
            tower = buildingPool.get('ThunderTower');
        }
        
        if (!tower) {
            tower = instantiate(this.thunderTowerPrefab);
        }
        
        // 设置父节点
        const parent = this.thunderTowerContainer || this.node;
        if (parent && !parent.active) {
            parent.active = true;
        }
        
        tower.setParent(parent);
        tower.active = true;
        tower.setPosition(0, 0, 0);
        tower.setRotationFromEuler(0, 0, 0);
        tower.setScale(1, 1, 1);
        tower.setWorldPosition(worldPosition);

        // 设置建造成本并检查首次出现
        const towerScript = tower.getComponent(ThunderTower);
        if (towerScript) {
            towerScript.prefabName = 'ThunderTower';
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                configManager.applyConfigToUnit('ThunderTower', towerScript, ['buildCost', 'collisionRadius']);
            }
            
            const talentEffectManager = TalentEffectManager.getInstance();
            talentEffectManager.applyUnitEnhancements('ThunderTower', towerScript);
            talentEffectManager.applyTalentEffects(towerScript);
            
            towerScript.buildCost = actualCost;
            
            // 雷塔只能放置在石墙网格内，占用网格
            if (!this.stoneWallGridPanelComponent) {
                this.findStoneWallGridPanel();
            }
            
            if (this.stoneWallGridPanelComponent) {
                const grid = this.stoneWallGridPanelComponent.worldToGrid(worldPosition);
                if (grid) {
                    // 雷塔占据两个网格高度，需要检查两个网格是否都被占用
                    // 检查上方网格是否存在（grid.y+1不能超出网格范围，Y坐标越大越在上方）
                    if (grid.y + 1 >= this.stoneWallGridPanelComponent.gridHeight) {
                        // 上方网格超出范围，无法放置
                        towerScript.gridX = -1;
                        towerScript.gridY = -1;
                    } else if (this.stoneWallGridPanelComponent.isGridOccupied(grid.x, grid.y) || 
                               this.stoneWallGridPanelComponent.isGridOccupied(grid.x, grid.y + 1)) {
                        // 至少有一个网格被占用，不应该发生这种情况（应该在放置前检查）
                        towerScript.gridX = -1;
                        towerScript.gridY = -1;
                    } else {
                        // 占用两个网格：grid.y（选中的网格，下方）和 grid.y + 1（上方网格）
                        const occupy1 = this.stoneWallGridPanelComponent.occupyGrid(grid.x, grid.y, tower);
                        const occupy2 = this.stoneWallGridPanelComponent.occupyGrid(grid.x, grid.y + 1, tower);
                        console.info('[TowerBuilder] buildThunderTower 占用网格:', grid.x, grid.y, '结果:', occupy1, '上方网格:', grid.x, grid.y + 1, '结果:', occupy2);
                        if (occupy1 && occupy2) {
                            towerScript.gridX = grid.x;
                            towerScript.gridY = grid.y; // 使用下方网格的坐标（与哨塔一致）
                            console.info('[TowerBuilder] buildThunderTower 成功占用两个网格，gridX:', towerScript.gridX, 'gridY:', towerScript.gridY, '(占用网格:', grid.x, grid.y, '和', grid.x, grid.y + 1, ')');
                            // 调整位置，使其居中在两个网格之间（参考哨塔的做法）
                            const gridPos = this.stoneWallGridPanelComponent.gridToWorld(grid.x, grid.y);
                            if (gridPos) {
                                // 向上偏移25像素（半个网格），使其居中在两个网格之间
                                const adjustedPos = new Vec3(gridPos.x, gridPos.y + 25, gridPos.z);
                                tower.setWorldPosition(adjustedPos);
                                
                                // 设置 baseY 为下方网格的底部（用于后续的 setHeightWithFixedBottom 调用）
                                const gridPanel = this.stoneWallGridPanelComponent as any;
                                const gridBottomY = gridPos.y - gridPanel.cellSize / 2;
                                (towerScript as any).baseY = gridBottomY;
                                
                                // 根据当前建造阶段更新高度（但不改变位置，因为位置已经设置好了）
                                const constructionStage = (towerScript as any).constructionStage;
                                const defaultScale = (towerScript as any).defaultScale || new Vec3(1, 1, 1);
                                const heightScale = constructionStage === 0 ? 0.5 : constructionStage === 1 ? 0.66 : 1.0;
                                
                                // 设置缩放（保持X和Z不变，只调整Y）
                                tower.setScale(defaultScale.x, defaultScale.y * heightScale, defaultScale.z);
                                
                                // 注意：不调用 setHeightWithFixedBottom，因为它会重新计算位置
                                // 位置已经设置为两个网格的中心，不需要再调整
                            }
                        } else {
                            // 占用失败，释放已占用的网格
                            console.warn('[TowerBuilder] buildThunderTower 占用网格失败，释放已占用的网格');
                            if (occupy1) {
                                this.stoneWallGridPanelComponent.releaseGrid(grid.x, grid.y);
                            }
                            if (occupy2) {
                                this.stoneWallGridPanelComponent.releaseGrid(grid.x, grid.y + 1);
                            }
                            towerScript.gridX = -1;
                            towerScript.gridY = -1;
                        }
                    }
                } else {
                    // 雷塔不在石墙网格内，不应该发生这种情况（应该在放置前检查）
                    towerScript.gridX = -1;
                    towerScript.gridY = -1;
                }
            } else {
                towerScript.gridX = -1;
                towerScript.gridY = -1;
            }
            
            if (this.gameManager) {
                const unitType = towerScript.unitType || 'ThunderTower';
                this.gameManager.checkUnitFirstAppearance(unitType, towerScript);
            }
        }
    }

    /**
     * 建造剑士小屋
     */
    buildSwordsmanHall(worldPosition: Vec3) {
        if (!this.swordsmanHallPrefab) {
            return;
        }

        // 获取实际建造成本（考虑单位卡片强化减少）
        const actualCost = this.getActualBuildCost('SwordsmanHall');
        
        // 消耗金币
        if (this.gameManager) {
            this.gameManager.spendGold(actualCost);
        }

        // 性能优化：从对象池获取建筑物，而不是直接实例化
        const buildingPool = BuildingPool.getInstance();
        let hall: Node | null = null;
        if (buildingPool) {
            // 确保预制体已注册到对象池（如果未注册则注册）
            const stats = buildingPool.getStats();
            if (!stats['SwordsmanHall']) {
                buildingPool.registerPrefab('SwordsmanHall', this.swordsmanHallPrefab);
            }
            hall = buildingPool.get('SwordsmanHall');
        }
        
        // 如果对象池没有可用对象，降级使用instantiate
        if (!hall) {
            hall = instantiate(this.swordsmanHallPrefab);
        }
        
        // 设置父节点
        const parent = this.swordsmanHallContainer || this.node;
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
        const hallScript = hall.getComponent(SwordsmanHall);
        if (hallScript) {
            // 设置prefabName（用于对象池回收）
            hallScript.prefabName = 'SwordsmanHall';
            // 先应用配置（如果有）
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                (configManager as any).applyConfigToUnit?.('SwordsmanHall', hallScript, ['buildCost']);
            }
            
            // 应用单位卡片强化
            const talentEffectManager = TalentEffectManager.getInstance();
            talentEffectManager.applyUnitEnhancements('SwordsmanHall', hallScript);
            
            // 应用公共天赋增幅
            talentEffectManager.applyTalentEffects(hallScript);
            
            hallScript.buildCost = actualCost;
            
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
                const unitType = hallScript.unitType || 'SwordsmanHall';
                this.gameManager.checkUnitFirstAppearance(unitType, hallScript);
            }
        }

    }

    /**
     * 建造教堂
     */
    buildChurch(worldPosition: Vec3) {
        if (!this.churchPrefab) {
            return;
        }

        // 获取实际建造成本（考虑单位卡片强化减少）
        const actualCost = this.getActualBuildCost('Church');
        
        // 消耗金币
        if (this.gameManager) {
            this.gameManager.spendGold(actualCost);
        }

        // 性能优化：从对象池获取建筑物，而不是直接实例化
        const buildingPool = BuildingPool.getInstance();
        let church: Node | null = null;
        if (buildingPool) {
            // 确保预制体已注册到对象池（如果未注册则注册）
            const stats = buildingPool.getStats();
            if (!stats['Church']) {
                buildingPool.registerPrefab('Church', this.churchPrefab);
            }
            church = buildingPool.get('Church');
        }
        
        // 如果对象池没有可用对象，降级使用instantiate
        if (!church) {
            church = instantiate(this.churchPrefab);
        }

        // 设置父节点
        const parent = this.churchContainer || this.node;
        if (parent && !parent.active) {
            parent.active = true;
        }

        church.setParent(parent);
        church.active = true;
        church.setPosition(0, 0, 0);
        church.setRotationFromEuler(0, 0, 0);
        church.setScale(1, 1, 1);
        church.setWorldPosition(worldPosition);

        const churchScript = church.getComponent(Church);
        if (churchScript) {
            // 设置prefabName（用于对象池回收）
            churchScript.prefabName = 'Church';
            // 先应用配置（排除 buildCost）
            const configManager = UnitConfigManager.getInstance();
            if (configManager.isConfigLoaded()) {
                (configManager as any).applyConfigToUnit?.('Church', churchScript, ['buildCost']);
            }
            
            // 应用单位卡片强化
            const talentEffectManager = TalentEffectManager.getInstance();
            talentEffectManager.applyUnitEnhancements('Church', churchScript);
            
            // 应用公共天赋增幅
            talentEffectManager.applyTalentEffects(churchScript);

            // 然后设置建造成本（使用实际成本）
            churchScript.buildCost = actualCost;

            // 记录网格位置并标记占用
            if (this.gridPanel) {
                const grid = this.gridPanel.worldToGrid(worldPosition);
                if (grid) {
                    churchScript.gridX = grid.x;
                    churchScript.gridY = grid.y;
                    this.gridPanel.occupyGrid(grid.x, grid.y, church);
                }
            }

            // 检查首次出现
            if (this.gameManager) {
                const unitType = (churchScript as any).unitType || 'Church';
                this.gameManager.checkUnitFirstAppearance(unitType, churchScript);
            }
        }

    }

    // 可以通过按钮调用
    onBuildButtonClick() {
        // 检查warAncientTreePrefab是否设置
        if (!this.warAncientTreePrefab) {
            return;
        }
        
        // 检查targetCrystal是否设置
        if (!this.targetCrystal) {
            this.targetCrystal = find('Crystal');
            if (!this.targetCrystal) {
                return;
            }
        }
        
        // 检查面板是否显示（更准确的判断）
        const isPanelVisible = this.buildingPanel && this.buildingPanel.node && this.buildingPanel.node.active;
        
        // 如果已经在建造模式且面板显示，切换为关闭建造模式
        if (this.isBuildingMode && isPanelVisible) {
            this.disableBuildingMode();
            return;
        }
        
        // 取消当前的单位选择（只清除UnitSelectionManager，不清除SelectionManager的多选）
        const unitSelectionManagerNode = find('UnitSelectionManager');
        if (unitSelectionManagerNode) {
            const unitSelectionManager = unitSelectionManagerNode.getComponent(UnitSelectionManager);
            if (unitSelectionManager) {
                unitSelectionManager.clearSelection();
            }
        }
        
        this.enableBuildingMode();
    }
    
    /**
     * 获取指定位置的建筑物
     */
    getBuildingAtPosition(worldPos: Vec3): Node | null {
        // 检查所有建筑物容器
        const containers = [
            this.warAncientTreeContainer,
            this.hunterHallContainer,
            this.stoneWallContainer,
            this.swordsmanHallContainer,
            this.churchContainer
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
     * 开始长按检测
     */
    startLongPressDetection(building: Node, touchLocation: { x: number; y: number }) {
        // 清除之前的长按检测状态
        this.cancelLongPressDetection();
        
        // 设置长按检测状态
        this.longPressBuilding = building;
        this.longPressStartTime = Date.now();
        this.longPressStartPos = new Vec3(touchLocation.x, touchLocation.y, 0);
        this.isLongPressActive = true;
        
        // 显示长按指示器（旋转圆弧）
        this.showLongPressIndicator(building);
        
        // 启动定时器检查长按时间（每0.05秒检查一次，持续检查直到达到阈值或取消）
        this.schedule(this.checkLongPress, 0.05);
        
    }

    /**
     * 取消长按检测
     */
    cancelLongPressDetection() {
        // 清除定时器
        this.unschedule(this.checkLongPress);
        this.isLongPressActive = false;
        this.longPressBuilding = null;
        this.longPressStartTime = 0;
        this.longPressStartPos = null;
        
        // 隐藏长按指示器
        this.hideLongPressIndicator();
    }

    /**
     * 检查长按是否达到阈值（定时器回调）
     */
    checkLongPress() {
        // 如果不在长按检测状态，直接返回
        if (!this.isLongPressActive || !this.longPressBuilding || !this.longPressStartTime) {
            return;
        }

        const currentTime = Date.now();
        const elapsedTime = (currentTime - this.longPressStartTime) / 1000; // 转换为秒
        const progress = Math.min(elapsedTime / this.longPressThreshold, 1.0);

        // 更新长按指示器的进度
        if (this.longPressIndicator && this.longPressIndicator.isValid) {
            this.updateLongPressIndicator(progress);
        }

        // 如果进度达到1.0，停止定时器并进入拖拽模式
        if (progress >= 1.0) {
            // 长按时间达到阈值，进入拖拽模式
            const building = this.longPressBuilding;
            // 先停止定时器，避免继续更新
            this.unschedule(this.checkLongPress);
            this.isLongPressActive = false;
            // 确保显示完整的圆环
            if (this.longPressIndicator && this.longPressIndicator.isValid) {
                this.updateLongPressIndicator(1.0);
            }
            // 清除长按检测状态（但不隐藏指示器，因为即将进入拖拽模式）
            this.longPressBuilding = null;
            this.longPressStartTime = 0;
            this.longPressStartPos = null;
            // 进入拖拽模式
            this.startDraggingBuilding(building);
        }
    }

    /**
     * 显示建筑物信息面板
     */
    showBuildingInfoPanel(building: Node) {
        if (!building || !building.isValid) {
            return;
        }

        // 确保长按检测已取消，避免定时器继续运行
        // 注意：这里不调用clearCurrentSelection，避免清除刚打开的信息面板
        if (this.isLongPressActive) {
            this.cancelLongPressDetection();
        }


        // 根据建筑物类型调用对应的showSelectionPanel方法
        const warAncientTree = building.getComponent(WarAncientTree);
        if (warAncientTree && warAncientTree.showSelectionPanel) {
            warAncientTree.showSelectionPanel();
            return;
        }

        const hunterHall = building.getComponent(HunterHall);
        if (hunterHall && hunterHall.showSelectionPanel) {
            hunterHall.showSelectionPanel();
            return;
        }

        const swordsmanHall = building.getComponent(SwordsmanHall);
        if (swordsmanHall && swordsmanHall.showSelectionPanel) {
            swordsmanHall.showSelectionPanel();
            return;
        }

        const church = building.getComponent(Church);
        if (church && church.showSelectionPanel) {
            church.showSelectionPanel();
            return;
        }
        
        const stoneWall = building.getComponent(StoneWall);
        if (stoneWall && stoneWall.showSelectionPanel) {
            stoneWall.showSelectionPanel();
            return;
        }
        
    }

    /**
     * 显示长按指示器（旋转圆弧）
     */
    showLongPressIndicator(building: Node) {
        if (!building || !building.isValid) {
            return;
        }

        // 隐藏之前的指示器
        this.hideLongPressIndicator();

        // 创建指示器节点
        const indicator = new Node('LongPressIndicator');
        indicator.setParent(building);
        indicator.setPosition(0, 0, 0);

        // 添加UITransform
        const uiTransform = indicator.addComponent(UITransform);
        uiTransform.setContentSize(100, 100);

        // 创建Graphics组件用于绘制圆弧
        const graphics = indicator.addComponent(Graphics);
        
        // 设置初始进度为0
        this.updateLongPressIndicator(0, graphics);

        this.longPressIndicator = indicator;
    }

    /**
     * 更新长按指示器进度
     */
    updateLongPressIndicator(progress: number, graphics?: Graphics) {
        if (!this.longPressIndicator || !this.longPressIndicator.isValid) {
            return;
        }

        if (!graphics) {
            graphics = this.longPressIndicator.getComponent(Graphics);
        }

        if (!graphics) {
            return;
        }

        // 清除之前的绘制
        graphics.clear();

        // 设置绘制参数
        const radius = 50; // 圆弧半径
        const lineWidth = 5; // 线条宽度（稍微粗一点，更明显）
        const centerX = 0;
        const centerY = 0;

        // 确保进度在0-1之间
        const clampedProgress = Math.max(0, Math.min(1, progress));

        // 如果进度为0，不绘制任何内容
        if (clampedProgress <= 0) {
            return;
        }

        // 计算圆弧的起始角度和结束角度（使用弧度制）
        // 从顶部（-90度）开始，顺时针绘制
        const endAngle = -Math.PI / 2; // 从顶部开始（-90度 = -π/2）
        // 结束角度 = 起始角度 + 进度 * 360度（顺时针）
        // 当 progress = 0 时，endAngle = startAngle（不绘制）
        // 当 progress = 0.5 时，endAngle = startAngle + π（180度圆弧）
        // 当 progress = 1.0 时，endAngle = startAngle + 2π（360度，完整圆）
        const startAngle = endAngle + clampedProgress * Math.PI * 2;

        // 根据进度调整颜色（从蓝色渐变到红色）
        // 进度0-1时，颜色从蓝色(100, 200, 255)渐变到红色(255, 100, 100)
        const red = 100 + Math.floor(clampedProgress * 155);   // 100 -> 255
        const green = 200 - Math.floor(clampedProgress * 100); // 200 -> 100
        const blue = 255 - Math.floor(clampedProgress * 155); // 255 -> 100
        const colorAlpha = 150 + Math.floor(clampedProgress * 105); // 150-255
        graphics.strokeColor = new Color(red, green, blue, colorAlpha);
        graphics.lineWidth = lineWidth;

        // 绘制圆弧（从startAngle到endAngle，顺时针）
        // 当 progress = 0 时，startAngle == endAngle，不绘制（已提前返回）
        // 当 progress 增加时，endAngle 增加，圆弧延长
        // 当 progress = 1.0 时，endAngle = startAngle + 2π，绘制完整圆
        graphics.arc(centerX, centerY, radius, startAngle, endAngle, false);
        graphics.stroke();
        
        // 如果进度达到1.0，使用红色和更粗的线条重新绘制完整圆环
        if (clampedProgress >= 1.0) {
            graphics.strokeColor = new Color(255, 100, 100, 255); // 红色
            graphics.lineWidth = lineWidth + 1; // 稍微粗一点
            graphics.arc(centerX, centerY, radius, startAngle, endAngle, false);
            graphics.stroke();
        }
    }

    /**
     * 隐藏长按指示器
     */
    hideLongPressIndicator() {
        if (this.longPressIndicator && this.longPressIndicator.isValid) {
            this.longPressIndicator.destroy();
            this.longPressIndicator = null;
        }
    }

    /**
     * 开始拖拽建筑物
     */
    startDraggingBuilding(building: Node) {
        if (!this.gridPanel) {
            return;
        }

        // 隐藏长按指示器（如果还存在）
        this.hideLongPressIndicator();

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

    }

    /**
     * 结束拖拽建筑物
     */
    endDraggingBuilding(event: EventTouch) {
        
        // 如果不在拖拽状态，直接返回（避免重复处理）
        if (!this.isDraggingBuilding) {
            return;
        }
        
        if (!this.draggedBuilding || !this.gridPanel) {
            // 如果状态不正确，确保清除拖拽状态
            this.isDraggingBuilding = false;
            this.draggedBuilding = null!;
            this.draggedBuildingOriginalGrid = null;
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
            return;
        }

        // 获取触摸位置并转换为世界坐标
        const touchLocation = event.getLocation();
        
        const cameraNode = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
        if (!cameraNode) {
            this.cancelDraggingBuilding();
            return;
        }
        
        const camera = cameraNode.getComponent(Camera);
        if (!camera) {
            this.cancelDraggingBuilding();
            return;
        }

        // 将屏幕坐标转换为世界坐标
        const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
        const worldPos = new Vec3();
        camera.screenToWorld(screenPos, worldPos);
        worldPos.z = 0;

        // 判断是否是石墙
        const isStoneWall = this.draggedBuilding && this.draggedBuilding.getComponent(StoneWall) !== null;
        
        // 检查是否在网格内
        const isInGrid = this.gridPanel.isPositionInGrid(worldPos);
        if (!isInGrid) {
            // 石墙可以放置在网格外，其他建筑物必须在网格内
            if (!isStoneWall) {
                // 不在网格内，取消拖拽，恢复原位置
                this.cancelDraggingBuilding();
                return;
            }
            // 石墙不在网格内，直接使用世界坐标，不进行网格对齐
            // 对于石墙，直接移动到世界坐标位置
            this.draggedBuilding.setWorldPosition(worldPos);
            // 清除拖拽状态
            this.isDraggingBuilding = false;
            this.draggedBuilding = null!;
            this.draggedBuildingOriginalGrid = null;
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
            return;
        }
        

        // 获取最近的网格中心位置（确保对齐到格子中央）
        const gridCenter = this.gridPanel.getNearestGridCenter(worldPos);
        if (!gridCenter) {
            // 石墙可以放置在网格外，其他建筑物必须在网格内
            if (!isStoneWall) {
                // 无法获取网格中心，取消拖拽
                this.cancelDraggingBuilding();
                return;
            }
            // 石墙无法获取网格中心，直接使用世界坐标
            this.draggedBuilding.setWorldPosition(worldPos);
            // 清除拖拽状态
            this.isDraggingBuilding = false;
            this.draggedBuilding = null!;
            this.draggedBuildingOriginalGrid = null;
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
            return;
        }

        // 获取目标网格（使用对齐后的位置）
        const targetGrid = this.gridPanel.worldToGrid(gridCenter);
        if (!targetGrid) {
            // 石墙可以放置在网格外，其他建筑物必须在网格内
            if (!isStoneWall) {
                this.cancelDraggingBuilding();
                return;
            }
            // 石墙无法获取目标网格，直接使用世界坐标
            this.draggedBuilding.setWorldPosition(worldPos);
            // 清除拖拽状态
            this.isDraggingBuilding = false;
            this.draggedBuilding = null!;
            this.draggedBuildingOriginalGrid = null;
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
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
            const gridCells = (this.gridPanel as any).gridCells;
            if (!gridCells || !gridCells[targetGrid.y]) {
                // 网格数据无效，恢复原位置
                this.cancelDraggingBuilding();
                return;
            }
            
            const cell = gridCells[targetGrid.y][targetGrid.x];
            const otherBuilding = cell ? cell.buildingNode : null;
            
            // 检查建筑物节点是否有效
            if (otherBuilding && otherBuilding.isValid && otherBuilding !== this.draggedBuilding) {
                // 使用保存的原始网格位置进行交换
                if (this.draggedBuildingOriginalGrid) {
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
                    this.cancelDraggingBuilding();
                    return;
                }
            } else {
                // 找不到其他建筑物或建筑物已无效，恢复原位置
                this.cancelDraggingBuilding();
                return;
            }
        } else {
            // 目标位置为空，直接移动
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
                        unitSelectionManager.clearSelection();
                    }
                }
            }
        }
        
    }

    /**
     * 取消拖拽建筑物（恢复原位置）
     */
    cancelDraggingBuilding() {
        
        // 无论状态如何，都要清除拖拽状态，避免状态残留
        if (!this.isDraggingBuilding) {
            this.draggedBuilding = null!;
            this.draggedBuildingOriginalGrid = null;
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
            return;
        }
        
        if (!this.draggedBuilding || !this.gridPanel || !this.draggedBuildingOriginalGrid) {
            // 即使状态不正确，也要清除拖拽状态
            this.isDraggingBuilding = false;
            this.draggedBuilding = null!;
            this.draggedBuildingOriginalGrid = null;
            if (this.gridPanel) {
                this.gridPanel.clearHighlight();
            }
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
        const hunterHall = building.getComponent(HunterHall);
        const church = building.getComponent(Church);

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
        } else if (hunterHall) {
            hunterHall.gridX = gridX;
            hunterHall.gridY = gridY;
            if (hunterHall.moveToGridPosition) {
                hunterHall.moveToGridPosition(gridX, gridY);
            } else {
                building.setWorldPosition(targetWorldPos);
            }
        } else if (church) {
            church.gridX = gridX;
            church.gridY = gridY;
            if (church.moveToGridPosition) {
                church.moveToGridPosition(gridX, gridY);
            } else {
                building.setWorldPosition(targetWorldPos);
            }
        } else {
            // 如果没有找到脚本，直接设置位置
            building.setWorldPosition(targetWorldPos);
        }

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

        // 检查建筑物节点是否有效
        if (!building1 || !building1.isValid || !building2 || !building2.isValid) {
            return;
        }

        // 获取目标世界坐标
        const targetWorldPos1 = this.gridPanel.gridToWorld(grid2X, grid2Y);
        const targetWorldPos2 = this.gridPanel.gridToWorld(grid1X, grid1Y);
        
        if (!targetWorldPos1 || !targetWorldPos2) {
            return;
        }

        // 获取建筑物脚本（在节点有效的情况下）
        const warAncientTree1 = building1.isValid ? building1.getComponent(WarAncientTree) : null;
        const hunterHall1 = building1.isValid ? building1.getComponent(HunterHall) : null;
        const church1 = building1.isValid ? building1.getComponent(Church) : null;

        const warAncientTree2 = building2.isValid ? building2.getComponent(WarAncientTree) : null;
        const hunterHall2 = building2.isValid ? building2.getComponent(HunterHall) : null;
        const church2 = building2.isValid ? building2.getComponent(Church) : null;

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
        } else if (hunterHall1) {
            hunterHall1.gridX = grid2X;
            hunterHall1.gridY = grid2Y;
            if (hunterHall1.moveToGridPosition) {
                hunterHall1.moveToGridPosition(grid2X, grid2Y);
            } else {
                building1.setWorldPosition(targetWorldPos1);
            }
        } else if (church1) {
            church1.gridX = grid2X;
            church1.gridY = grid2Y;
            if (church1.moveToGridPosition) {
                church1.moveToGridPosition(grid2X, grid2Y);
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
        } else if (hunterHall2) {
            hunterHall2.gridX = grid1X;
            hunterHall2.gridY = grid1Y;
            if (hunterHall2.moveToGridPosition) {
                hunterHall2.moveToGridPosition(grid1X, grid1Y);
            } else {
                building2.setWorldPosition(targetWorldPos2);
            }
        } else if (church2) {
            church2.gridX = grid1X;
            church2.gridY = grid1Y;
            if (church2.moveToGridPosition) {
                church2.moveToGridPosition(grid1X, grid1Y);
            } else {
                building2.setWorldPosition(targetWorldPos2);
            }
        } else {
            building2.setWorldPosition(targetWorldPos2);
        }

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
        
        // 清除UnitSelectionManager的选择
        const unitSelectionManagerNode = find('UnitSelectionManager');
        if (unitSelectionManagerNode) {
            const unitSelectionManager = unitSelectionManagerNode.getComponent(UnitSelectionManager);
            if (unitSelectionManager) {
                unitSelectionManager.clearSelection();
            } else {
            }
        } else {
            // 如果找不到UnitSelectionManager节点，尝试在场景中查找组件
            const scene = this.node.scene;
            if (scene) {
                const unitSelectionManager = scene.getComponentInChildren(UnitSelectionManager);
                if (unitSelectionManager) {
                    unitSelectionManager.clearSelection();
                } else {
                }
            }
        }
        
        // 清除SelectionManager的选择（管理防御塔的选择）
        const selectionManagerNode = find('SelectionManager');
        if (selectionManagerNode) {
            const selectionManager = selectionManagerNode.getComponent('SelectionManager') as any;
            if (selectionManager) {
                if (selectionManager.clearSelection) {
                    selectionManager.clearSelection();
                }
            }
        } else {
            // 如果找不到SelectionManager节点，尝试在场景中查找组件
            const scene = this.node.scene;
            if (scene) {
                const selectionManager = scene.getComponentInChildren('SelectionManager') as any;
                if (selectionManager && selectionManager.clearSelection) {
                    selectionManager.clearSelection();
                }
            }
        }
        
    }
    
    /**
     * 从配置文件中获取建造成本
     * @param unitId 单位ID
     * @returns 建造成本，如果配置不存在则返回0
     */
    private getBuildCostFromConfig(unitId: string): number {
        const configManager = UnitConfigManager.getInstance();
        if (!configManager.isConfigLoaded()) {
            return 0;
        }
        
        const config = configManager.getUnitConfig(unitId);
        if (config && config.baseStats && config.baseStats.buildCost !== undefined) {
            return config.baseStats.buildCost;
        }
        
        return 0;
    }

    /**
     * 获取实际建造成本（考虑单位卡片强化减少）
     * @param unitId 单位ID
     * @param baseCost 基础建造成本（如果为0或未提供，则从配置文件读取）
     * @returns 实际建造成本
     */
    public getActualBuildCost(unitId: string, baseCost?: number): number {
        // 如果未提供baseCost或为0，从配置文件读取
        let actualBaseCost = baseCost || 0;
        if (actualBaseCost === 0) {
            actualBaseCost = this.getBuildCostFromConfig(unitId);
        }
        
        const playerDataManager = PlayerDataManager.getInstance();
        const enhancement = playerDataManager.getUnitEnhancement(unitId);
        
        if (enhancement && enhancement.enhancements && enhancement.enhancements.buildCost !== undefined) {
            // buildCost 是负数，表示减少的成本
            const costReduction = enhancement.enhancements.buildCost;
            const actualCost = Math.max(1, actualBaseCost + costReduction); // 最少1金币
            return actualCost;
        }
        
        return actualBaseCost;
    }
}

