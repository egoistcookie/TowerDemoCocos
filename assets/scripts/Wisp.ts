import { _decorator, Component, Node, Vec2, Vec3, Prefab, instantiate, find, Graphics, UITransform, Label, Color, EventTouch, Sprite, SpriteFrame } from 'cc';
import { GameManager, GameState } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
import { UnitSelectionManager } from './UnitSelectionManager';
import { UnitInfo } from './UnitInfoPanel';
import { GamePopup } from './GamePopup';
import { UnitType } from './WarAncientTree';
const { ccclass, property } = _decorator;

@ccclass('Wisp')
export class Wisp extends Component {
    @property
    maxHealth: number = 30; // 小精灵血量

    @property(Prefab)
    explosionEffect: Prefab = null!;

    @property(Prefab)
    damageNumberPrefab: Prefab = null!;

    @property(Prefab)
    healEffectPrefab: Prefab = null!; // 治疗特效预制体

    @property
    healAmount: number = 2; // 每次治疗恢复的血量

    @property
    healInterval: number = 1.0; // 治疗间隔（秒）

    @property
    moveSpeed: number = 80; // 移动速度（像素/秒）

    @property
    collisionRadius: number = 20; // 碰撞半径（像素）

    @property
    attachOffset: Vec3 = new Vec3(0, 30, 0); // 依附在建筑物上的偏移位置

    @property(SpriteFrame)
    cardIcon: SpriteFrame = null!; // 单位名片图片

    // 单位类型
    public unitType: UnitType = UnitType.CHARACTER;

    // 粒子特效相关属性
    @property(Prefab)
    spriteFlashEffect: Prefab = null!; // SpriteFlash粒子特效预制体
    
    @property
    enableParticleEffect: boolean = true; // 是否启用粒子特效
    
    @property
    particleEffectOffset: Vec3 = new Vec3(0, 0, 0); // 粒子特效偏移量

    // 移动动画相关属性
    @property(SpriteFrame)
    moveAnimationFrames: SpriteFrame[] = []; // 移动动画帧数组（可选）
    
    @property
    moveAnimationDuration: number = 0.3; // 移动动画时长（秒）

    private currentHealth: number = 30;
    private healthBar: HealthBar = null!;
    private healthBarNode: Node = null!;
    private isDestroyed: boolean = false;
    private gameManager: GameManager = null!;
    private spriteComponent: Sprite = null!; // Sprite组件引用
    private defaultSpriteFrame: SpriteFrame = null!; // 默认SpriteFrame
    private defaultScale: Vec3 = new Vec3(1, 1, 1); // 默认缩放，用于方向翻转
    private unitSelectionManager: UnitSelectionManager = null!; // 单位选择管理器
    private isHighlighted: boolean = false; // 是否高亮显示
    private highlightNode: Node = null!; // 高亮效果节点
    
    // 粒子特效相关
    private particleEffectNode: Node = null!; // 粒子特效节点
    
    // 依附相关
    private attachedBuilding: Node = null!; // 依附的建筑物
    private isAttached: boolean = false; // 是否已依附
    private healTimer: number = 0; // 治疗计时器
    
    // 移动相关
    private moveTarget: Vec3 | null = null!; // 移动目标位置
    private isMoving: boolean = false; // 是否正在移动
    private isPlayingMoveAnimation: boolean = false; // 是否正在播放移动动画
    private manualMoveTarget: Vec3 | null = null!; // 手动移动目标位置
    private isManuallyControlled: boolean = false; // 是否正在手动控制

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.isAttached = false;
        this.attachedBuilding = null!;
        this.healTimer = 0;
        this.isMoving = false;
        this.moveTarget = null!;
        this.manualMoveTarget = null!;
        this.isManuallyControlled = false;

        // 获取Sprite组件
        this.spriteComponent = this.node.getComponent(Sprite);
        if (this.spriteComponent) {
            // 设置Sprite的sizeMode为CUSTOM，确保所有动画帧使用相同的尺寸
            this.spriteComponent.sizeMode = Sprite.SizeMode.CUSTOM;
            // 启用trim并设置offset，确保人物始终位于中心
            this.spriteComponent.trim = true;
            if (this.spriteComponent.spriteFrame) {
                this.defaultSpriteFrame = this.spriteComponent.spriteFrame;
            }
        }
        
        // 保存默认缩放
        this.defaultScale = this.node.scale.clone();

        // 查找游戏管理器
        this.findGameManager();

        // 查找单位选择管理器
        this.findUnitSelectionManager();

        // 创建血条
        this.createHealthBar();

        // 监听点击事件
        this.node.on(Node.EventType.TOUCH_END, this.onWispClick, this);
        
        // 初始化粒子特效
        this.initParticleEffect();
    }

    onDestroy() {
        // 移除点击事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onWispClick, this);

        // 如果依附在建筑物上，通知建筑物移除小精灵
        if (this.isAttached && this.attachedBuilding && this.attachedBuilding.isValid) {
            this.detachFromBuilding();
        }

        // 清理粒子特效
        this.cleanupParticleEffect();

        // 减少人口
        if (this.gameManager) {
            this.gameManager.removePopulation(1);
        }
    }

    update(deltaTime: number) {
        if (this.isDestroyed) {
            return;
        }

        // 检查游戏状态
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                return;
            }
        }

        // 如果依附在建筑物上，更新位置并治疗
        if (this.isAttached && this.attachedBuilding && this.attachedBuilding.isValid) {
            // 更新位置（跟随建筑物）
            const buildingPos = this.attachedBuilding.worldPosition.clone();
            const attachPos = buildingPos.add(this.attachOffset);
            this.node.setWorldPosition(attachPos);

            // 治疗建筑物
            this.healTimer += deltaTime;
            if (this.healTimer >= this.healInterval) {
                this.healTimer = 0;
                this.healBuilding();
            }
        } else {
            // 优先处理手动移动
            if (this.isManuallyControlled && this.manualMoveTarget) {
                const currentPos = this.node.worldPosition.clone();
                const targetPos = this.manualMoveTarget.clone(); // 克隆目标位置，避免被修改
                const direction = new Vec3(); // 创建新的方向向量
                Vec3.subtract(direction, targetPos, currentPos); // 使用静态方法计算方向，不会修改原始向量
                const distance = direction.length();

                if (distance <= 5) {
                    // 到达目标位置
                    this.node.setWorldPosition(targetPos);
                    this.isManuallyControlled = false;
                    this.manualMoveTarget = null!;
                    
                    // 到达目标位置后，检查附近是否有建筑物，如果有则依附
                    const attached = this.checkBuildingNearbyAndAttach(targetPos);
                    
                    // 如果没有依附到建筑物，再检查是否与建筑物重叠
                    if (!attached) {
                        this.checkBuildingOverlap();
                    }
                } else {
                    // 继续移动
                    const moveDistance = this.moveSpeed * deltaTime;
                    const moveStep = direction.normalize().multiplyScalar(Math.min(moveDistance, distance));
                    const newPos = currentPos.add(moveStep);
                    this.node.setWorldPosition(newPos);
                    
                    // 根据移动方向翻转小精灵
                    if (direction.x < 0) {
                        // 向左移动，翻转
                        this.node.setScale(-Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
                        // 血条反向翻转，保持正常朝向
                        if (this.healthBarNode && this.healthBarNode.isValid) {
                            this.healthBarNode.setScale(-1, 1, 1);
                        }
                    } else {
                        // 向右移动，正常朝向
                        this.node.setScale(Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
                        // 血条保持正常朝向
                        if (this.healthBarNode && this.healthBarNode.isValid) {
                            this.healthBarNode.setScale(1, 1, 1);
                        }
                    }
                    
                    // 播放移动动画
                    if (!this.isPlayingMoveAnimation) {
                        this.playMoveAnimation();
                    }
                    
                    // 移动过程中不检查重叠，避免在移动时被依附
                }
            } else if (this.isMoving && this.moveTarget) {
                // 自动移动到目标位置
                const currentPos = this.node.worldPosition.clone();
                const targetPos = this.moveTarget.clone(); // 克隆目标位置，避免被修改
                const direction = new Vec3(); // 创建新的方向向量
                Vec3.subtract(direction, targetPos, currentPos); // 使用静态方法计算方向，不会修改原始向量
                const distance = direction.length();

                if (distance <= 5) {
                    // 到达目标位置
                    this.node.setWorldPosition(targetPos);
                    this.isMoving = false;
                    this.moveTarget = null!;
                    
                    // 到达目标位置后，检查是否与建筑物重叠
                    this.checkBuildingOverlap();
                } else {
                    // 继续移动
                    const moveDistance = this.moveSpeed * deltaTime;
                    const moveStep = direction.normalize().multiplyScalar(Math.min(moveDistance, distance));
                    const newPos = currentPos.add(moveStep);
                    this.node.setWorldPosition(newPos);
                    
                    // 根据移动方向翻转小精灵
                    if (direction.x < 0) {
                        // 向左移动，翻转
                        this.node.setScale(-Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
                        // 血条反向翻转，保持正常朝向
                        if (this.healthBarNode && this.healthBarNode.isValid) {
                            this.healthBarNode.setScale(-1, 1, 1);
                        }
                    } else {
                        // 向右移动，正常朝向
                        this.node.setScale(Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
                        // 血条保持正常朝向
                        if (this.healthBarNode && this.healthBarNode.isValid) {
                            this.healthBarNode.setScale(1, 1, 1);
                        }
                    }
                    
                    // 播放移动动画
                    if (!this.isPlayingMoveAnimation) {
                        this.playMoveAnimation();
                    }
                    
                    // 移动过程中不检查重叠，避免在移动时被依附
                }
            } else {
                // 停止移动动画
                this.stopMoveAnimation();
                // 静止状态下检查是否与建筑物重叠
                this.checkBuildingOverlap();
            }
        }
    }

    /**
     * 查找游戏管理器
     */
    findGameManager() {
        let gmNode = find('GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager);
            if (this.gameManager) {
                return;
            }
        }
        
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

    /**
     * 查找单位选择管理器
     */
    findUnitSelectionManager() {
        let managerNode = find('UnitSelectionManager');
        if (managerNode) {
            this.unitSelectionManager = managerNode.getComponent(UnitSelectionManager);
            if (this.unitSelectionManager) {
                return;
            }
        }
        
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
            this.unitSelectionManager = findInScene(scene, UnitSelectionManager);
        }
    }

    /**
     * 创建血条
     */
    createHealthBar() {
        this.healthBarNode = new Node('HealthBar');
        this.healthBarNode.setParent(this.node);
        this.healthBarNode.setPosition(0, 30, 0);

        this.healthBar = this.healthBarNode.addComponent(HealthBar);
        if (this.healthBar) {
            this.healthBar.setMaxHealth(this.maxHealth);
            this.healthBar.setHealth(this.currentHealth);
        }
    }

    /**
     * 依附到建筑物
     * @param building 要依附的建筑物
     * @param fromBuilding 是否由建筑物主动调用（用于避免循环调用）
     */
    attachToBuilding(building: Node, fromBuilding: boolean = false) {
        if (this.isAttached) {
            console.warn('Wisp: Already attached to a building!');
            return;
        }

        // 保存建筑物引用，但不立即设置依附状态
        this.attachedBuilding = building;
        this.isMoving = false;
        this.moveTarget = null!;

        // 立即更新位置
        const buildingPos = building.worldPosition.clone();
        const attachPos = buildingPos.add(this.attachOffset);
        this.node.setWorldPosition(attachPos);
        
        // 不要隐藏小精灵节点，否则update方法不会被调用，无法执行治疗逻辑
        // 保持节点active为true，让update方法继续执行治疗逻辑
        // this.node.active = false;

        // 如果是小精灵主动依附（不是由建筑物调用），需要通知建筑物添加到依附列表
        if (!fromBuilding) {
            const buildingScript = building.getComponent('WarAncientTree') as any;
            if (buildingScript && buildingScript.attachWisp) {
                buildingScript.attachWisp(this.node);
            } else {
                const moonWellScript = building.getComponent('MoonWell') as any;
                if (moonWellScript && moonWellScript.attachWisp) {
                    moonWellScript.attachWisp(this.node);
                } else {
                    const hunterHallScript = building.getComponent('HunterHall') as any;
                    if (hunterHallScript && hunterHallScript.attachWisp) {
                        hunterHallScript.attachWisp(this.node);
                    }
                }
            }
        }

        // 最后设置依附状态
        this.isAttached = true;
        
        // 依附时根据需要控制粒子特效显示
        if (this.particleEffectNode && this.particleEffectNode.isValid) {
            // 依附时可以选择隐藏粒子特效，或者继续显示，根据游戏设计调整
            this.particleEffectNode.active = this.enableParticleEffect;
        }

        console.debug('Wisp: Attached to building and disappeared into it');
    }

    /**
     * 从建筑物卸下
     */
    detachFromBuilding() {
        if (!this.isAttached) {
            return;
        }

        const building = this.attachedBuilding;
        this.attachedBuilding = null!;
        this.isAttached = false;
        this.isMoving = true; // 设置为移动状态，避免立即重新依附
        this.moveTarget = null!;

        // 小精灵重新显示
        this.node.active = true;
        
        // 从建筑物卸下时恢复粒子特效显示
        if (this.particleEffectNode && this.particleEffectNode.isValid) {
            this.particleEffectNode.active = this.enableParticleEffect;
        }
        
        // 设置位置到建筑物下方更远的位置，超出依附范围
        if (building && building.isValid) {
            const buildingPos = building.worldPosition.clone();
            // 建筑物前方位置（下方100像素，超出50像素的依附范围）
            const frontPos = new Vec3(buildingPos.x, buildingPos.y - 100, buildingPos.z);
            this.node.setWorldPosition(frontPos);
        }
        
        // 延迟重置移动状态，确保不会立即重新依附
        this.scheduleOnce(() => {
            this.isMoving = false;
        }, 1.0);

        console.debug('Wisp: Detached from building and reappeared');
    }

    /**
     * 移动到指定位置
     */
    moveToPosition(targetPos: Vec3) {
        this.moveTarget = targetPos.clone();
        this.isMoving = true;
        this.isManuallyControlled = false;
        this.manualMoveTarget = null!;
        this.playMoveAnimation();
    }

    /**
     * 播放移动动画
     */
    private playMoveAnimation() {
        // 如果正在播放移动动画，不重复播放
        if (this.isPlayingMoveAnimation) {
            return;
        }

        // 如果没有移动动画帧，使用默认SpriteFrame
        if (!this.moveAnimationFrames || this.moveAnimationFrames.length === 0) {
            return;
        }

        if (!this.spriteComponent) {
            return;
        }

        // 检查帧是否有效
        const validFrames = this.moveAnimationFrames.filter(frame => frame != null);
        if (validFrames.length === 0) {
            return;
        }

        this.isPlayingMoveAnimation = true;

        const frames = validFrames;
        const frameCount = frames.length;
        const frameDuration = this.moveAnimationDuration / frameCount;
        let animationTimer = 0;
        let lastFrameIndex = -1;

        // 立即播放第一帧
        if (frames[0]) {
            this.spriteComponent.spriteFrame = frames[0];
            lastFrameIndex = 0;
        }

        // 使用update方法逐帧播放
        const animationUpdate = (deltaTime: number) => {
            // 停止条件：如果不在移动状态且不在手动控制状态，或者组件无效，或者被销毁，或者已依附
            if ((!this.isMoving && !this.isManuallyControlled) || !this.spriteComponent || !this.spriteComponent.isValid || this.isDestroyed || this.isAttached) {
                this.isPlayingMoveAnimation = false;
                this.unschedule(animationUpdate);
                // 恢复默认SpriteFrame
                if (this.spriteComponent && this.spriteComponent.isValid && this.defaultSpriteFrame) {
                    this.spriteComponent.spriteFrame = this.defaultSpriteFrame;
                }
                return;
            }

            animationTimer += deltaTime;

            // 循环播放动画
            const targetFrameIndex = Math.floor(animationTimer / frameDuration) % frameCount;

            if (targetFrameIndex !== lastFrameIndex && frames[targetFrameIndex]) {
                this.spriteComponent.spriteFrame = frames[targetFrameIndex];
                lastFrameIndex = targetFrameIndex;
            }
        };

        // 开始动画更新
        this.schedule(animationUpdate, 0);
    }

    /**
     * 停止移动动画
     */
    private stopMoveAnimation() {
        this.isPlayingMoveAnimation = false;
        // 恢复默认SpriteFrame
        if (this.spriteComponent && this.spriteComponent.isValid && this.defaultSpriteFrame) {
            this.spriteComponent.spriteFrame = this.defaultSpriteFrame;
        }
    }

    /**
     * 设置手动移动目标位置（用于选中移动）
     * @param worldPos 世界坐标位置
     */
    setManualMoveTargetPosition(worldPos: Vec3) {
        // 如果已依附，先卸下
        if (this.isAttached) {
            this.detachFromBuilding();
        }
        
        // 设置手动移动目标
        this.manualMoveTarget = worldPos.clone();
        this.isManuallyControlled = true;
        this.isMoving = false;
        this.moveTarget = null!;
        
        console.debug(`Wisp: Manual move target set to (${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})`);
    }
    
    /**
     * 检查目标位置附近是否有建筑物，如果有则依附
     * @param targetPos 目标位置
     * @returns 是否找到并依附到建筑物
     */
    private checkBuildingNearbyAndAttach(targetPos: Vec3): boolean {
        const attachRange = 10; // 依附范围（像素），当距离建筑物10像素以内时依附
        
        // 查找战争古树
        let treesNode = find('WarAncientTrees');
        if (!treesNode && this.node.scene) {
            const findNodeRecursive = (node: Node, name: string): Node | null => {
                if (node.name === name) {
                    return node;
                }
                for (const child of node.children) {
                    const found = findNodeRecursive(child, name);
                    if (found) return found;
                }
                return null;
            };
            treesNode = findNodeRecursive(this.node.scene, 'WarAncientTrees');
        }
        
        if (treesNode) {
            const trees = treesNode.children || [];
            for (const tree of trees) {
                if (tree && tree.isValid && tree.active) {
                    const treeScript = tree.getComponent('WarAncientTree') as any;
                    if (treeScript && treeScript.isAlive && treeScript.isAlive()) {
                        const distance = Vec3.distance(targetPos, tree.worldPosition);
                        // 如果距离建筑物很近（10像素以内），立即依附
                        if (distance <= attachRange) {
                            // 依附到建筑物
                            this.attachToBuilding(tree);
                            return true;
                        }
                    }
                }
            }
        }
        
        // 查找月亮井
        let wellsNode = find('MoonWells');
        if (!wellsNode && this.node.scene) {
            const findNodeRecursive = (node: Node, name: string): Node | null => {
                if (node.name === name) {
                    return node;
                }
                for (const child of node.children) {
                    const found = findNodeRecursive(child, name);
                    if (found) return found;
                }
                return null;
            };
            wellsNode = findNodeRecursive(this.node.scene, 'MoonWells');
        }
        
        if (wellsNode) {
            const wells = wellsNode.children || [];
            for (const well of wells) {
                if (well && well.isValid && well.active) {
                    const wellScript = well.getComponent('MoonWell') as any;
                    if (wellScript && wellScript.isAlive && wellScript.isAlive()) {
                        const distance = Vec3.distance(targetPos, well.worldPosition);
                        // 如果距离建筑物很近（10像素以内），立即依附
                        if (distance <= attachRange) {
                            // 依附到建筑物
                            this.attachToBuilding(well);
                            return true;
                        }
                    }
                }
            }
        }
        
        // 查找猎手大厅
        let hunterHallsNode = find('HunterHalls');
        if (!hunterHallsNode && this.node.scene) {
            const findNodeRecursive = (node: Node, name: string): Node | null => {
                if (node.name === name) {
                    return node;
                }
                for (const child of node.children) {
                    const found = findNodeRecursive(child, name);
                    if (found) return found;
                }
                return null;
            };
            hunterHallsNode = findNodeRecursive(this.node.scene, 'HunterHalls');
        }
        
        if (hunterHallsNode) {
            const hunterHalls = hunterHallsNode.children || [];
            for (const hall of hunterHalls) {
                if (hall && hall.isValid && hall.active) {
                    const hallScript = hall.getComponent('HunterHall') as any;
                    if (hallScript && hallScript.isAlive && hallScript.isAlive()) {
                        const distance = Vec3.distance(targetPos, hall.worldPosition);
                        // 如果距离建筑物很近（10像素以内），立即依附
                        if (distance <= attachRange) {
                            // 依附到建筑物
                            this.attachToBuilding(hall);
                            return true;
                        }
                    }
                }
            }
        }
        
        // 检查剑士小屋
        let swordsmanHallsNode = find('SwordsmanHalls');
        if (!swordsmanHallsNode && this.node.scene) {
            swordsmanHallsNode = findNodeRecursive(this.node.scene, 'SwordsmanHalls');
        }
        
        if (swordsmanHallsNode) {
            const swordsmanHalls = swordsmanHallsNode.children || [];
            for (const hall of swordsmanHalls) {
                if (hall && hall.isValid && hall.active) {
                    const hallScript = hall.getComponent('SwordsmanHall') as any;
                    if (hallScript && hallScript.isAlive && hallScript.isAlive()) {
                        const distance = Vec3.distance(targetPos, hall.worldPosition);
                        // 如果距离建筑物很近（10像素以内），立即依附
                        if (distance <= attachRange) {
                            // 依附到建筑物
                            this.attachToBuilding(hall);
                            return true;
                        }
                    }
                }
            }
        }
        
        return false;
    }

    /**
     * 检查是否与建筑物重叠，如果重叠则自动依附
     */
    checkBuildingOverlap() {
        // 如果已经依附，不需要检查
        if (this.isAttached) {
            return;
        }

        // 如果正在移动，不检查重叠（避免移动时被依附）
        if (this.isMoving || this.isManuallyControlled) {
            return;
        }

        const wispPos = this.node.worldPosition;
        const attachRange = 50; // 依附范围（像素）

        // 查找战争古树
        const findNodeRecursive = (node: Node, name: string): Node | null => {
            if (node.name === name) {
                return node;
            }
            for (const child of node.children) {
                const found = findNodeRecursive(child, name);
                if (found) return found;
            }
            return null;
        };

        let treesNode = find('WarAncientTrees');
        if (!treesNode && this.node.scene) {
            treesNode = findNodeRecursive(this.node.scene, 'WarAncientTrees');
        }
        if (treesNode) {
            const trees = treesNode.children || [];
            for (const tree of trees) {
                if (tree && tree.isValid && tree.active) {
                    const treeScript = tree.getComponent('WarAncientTree') as any;
                    if (treeScript && treeScript.isAlive && treeScript.isAlive()) {
                        const distance = Vec3.distance(wispPos, tree.worldPosition);
                        if (distance <= attachRange) {
                            // 与战争古树重叠，自动依附
                            this.attachToBuilding(tree);
                            return;
                        }
                    }
                }
            }
        }

        // 查找月亮井
        let wellsNode = find('MoonWells');
        if (!wellsNode && this.node.scene) {
            wellsNode = findNodeRecursive(this.node.scene, 'MoonWells');
        }
        if (wellsNode) {
            const wells = wellsNode.children || [];
            for (const well of wells) {
                if (well && well.isValid && well.active) {
                    const wellScript = well.getComponent('MoonWell') as any;
                    if (wellScript && wellScript.isAlive && wellScript.isAlive()) {
                        const distance = Vec3.distance(wispPos, well.worldPosition);
                        if (distance <= attachRange) {
                            // 与月亮井重叠，自动依附
                            this.attachToBuilding(well);
                            return;
                        }
                    }
                }
            }
        }

        // 查找猎手大厅
        let hunterHallsNode = find('HunterHalls');
        if (!hunterHallsNode && this.node.scene) {
            hunterHallsNode = findNodeRecursive(this.node.scene, 'HunterHalls');
        }
        if (hunterHallsNode) {
            const hunterHalls = hunterHallsNode.children || [];
            for (const hall of hunterHalls) {
                if (hall && hall.isValid && hall.active) {
                    const hallScript = hall.getComponent('HunterHall') as any;
                    if (hallScript && hallScript.isAlive && hallScript.isAlive()) {
                        const distance = Vec3.distance(wispPos, hall.worldPosition);
                        if (distance <= attachRange) {
                            // 与猎手大厅重叠，自动依附
                            this.attachToBuilding(hall);
                            return;
                        }
                    }
                }
            }
        }

        // 查找剑士小屋
        let swordsmanHallsNode = find('SwordsmanHalls');
        if (!swordsmanHallsNode && this.node.scene) {
            swordsmanHallsNode = findNodeRecursive(this.node.scene, 'SwordsmanHalls');
        }
        if (swordsmanHallsNode) {
            const swordsmanHalls = swordsmanHallsNode.children || [];
            for (const hall of swordsmanHalls) {
                if (hall && hall.isValid && hall.active) {
                    const hallScript = hall.getComponent('SwordsmanHall') as any;
                    if (hallScript && hallScript.isAlive && hallScript.isAlive()) {
                        const distance = Vec3.distance(wispPos, hall.worldPosition);
                        if (distance <= attachRange) {
                            // 与剑士小屋重叠，自动依附
                            this.attachToBuilding(hall);
                            return;
                        }
                    }
                }
            }
        }
    }

    /**
     * 治疗建筑物
     */
    healBuilding() {
        if (!this.attachedBuilding || !this.attachedBuilding.isValid) {
            return;
        }

        // 根据建筑物类型调用相应的治疗/恢复方法
        const buildingScript = this.attachedBuilding.getComponent('WarAncientTree') as any;
        if (buildingScript && buildingScript.isAlive && buildingScript.isAlive()) {
            // 检查建筑物是否满血，避免不必要的治疗
            if (buildingScript.getHealth && buildingScript.getMaxHealth) {
                const currentHealth = buildingScript.getHealth();
                const maxHealth = buildingScript.getMaxHealth();
                if (currentHealth >= maxHealth) {
                    return; // 满血，不治疗
                }
            }

            let healed = false;
            if (buildingScript.heal) {
                // 保存治疗前的血量
                const beforeHealth = buildingScript.getHealth ? buildingScript.getHealth() : buildingScript.currentHealth;
                buildingScript.heal(this.healAmount);
                // 检查治疗后是否真的恢复了血量
                const afterHealth = buildingScript.getHealth ? buildingScript.getHealth() : buildingScript.currentHealth;
                healed = afterHealth > beforeHealth;
            } else if (buildingScript.getHealth && buildingScript.getMaxHealth) {
                const currentHealth = buildingScript.getHealth();
                const maxHealth = buildingScript.getMaxHealth();
                if (currentHealth < maxHealth) {
                    // 直接设置血量
                    if (buildingScript.currentHealth !== undefined) {
                        buildingScript.currentHealth = Math.min(maxHealth, currentHealth + this.healAmount);
                        if (buildingScript.healthBar) {
                            buildingScript.healthBar.setHealth(buildingScript.currentHealth);
                        }
                        healed = true;
                    }
                }
            }
            if (healed) {
                this.showHealEffect();
                this.showHealNumber();
            }
            return;
        }

        const moonWellScript = this.attachedBuilding.getComponent('MoonWell') as any;
        if (moonWellScript && moonWellScript.isAlive && moonWellScript.isAlive()) {
            // 检查建筑物是否满血，避免不必要的治疗
            if (moonWellScript.getHealth && moonWellScript.getMaxHealth) {
                const currentHealth = moonWellScript.getHealth();
                const maxHealth = moonWellScript.getMaxHealth();
                if (currentHealth >= maxHealth) {
                    return; // 满血，不治疗
                }
            }

            let healed = false;
            if (moonWellScript.heal) {
                // 保存治疗前的血量
                const beforeHealth = moonWellScript.getHealth ? moonWellScript.getHealth() : moonWellScript.currentHealth;
                moonWellScript.heal(this.healAmount);
                // 检查治疗后是否真的恢复了血量
                const afterHealth = moonWellScript.getHealth ? moonWellScript.getHealth() : moonWellScript.currentHealth;
                healed = afterHealth > beforeHealth;
            } else if (moonWellScript.getHealth && moonWellScript.getMaxHealth) {
                const currentHealth = moonWellScript.getHealth();
                const maxHealth = moonWellScript.getMaxHealth();
                if (currentHealth < maxHealth) {
                    if (moonWellScript.currentHealth !== undefined) {
                        moonWellScript.currentHealth = Math.min(maxHealth, currentHealth + this.healAmount);
                        if (moonWellScript.healthBar) {
                            moonWellScript.healthBar.setHealth(moonWellScript.currentHealth);
                        }
                        healed = true;
                    }
                }
            }
            if (healed) {
                this.showHealEffect();
                this.showHealNumber();
            }
            return;
        }

        const hunterHallScript = this.attachedBuilding.getComponent('HunterHall') as any;
        if (hunterHallScript && hunterHallScript.isAlive && hunterHallScript.isAlive()) {
            // 检查建筑物是否满血，避免不必要的治疗
            if (hunterHallScript.getHealth && hunterHallScript.getMaxHealth) {
                const currentHealth = hunterHallScript.getHealth();
                const maxHealth = hunterHallScript.getMaxHealth();
                if (currentHealth >= maxHealth) {
                    return; // 满血，不治疗
                }
            }

            let healed = false;
            if (hunterHallScript.heal) {
                // 保存治疗前的血量
                const beforeHealth = hunterHallScript.getHealth ? hunterHallScript.getHealth() : hunterHallScript.currentHealth;
                hunterHallScript.heal(this.healAmount);
                // 检查治疗后是否真的恢复了血量
                const afterHealth = hunterHallScript.getHealth ? hunterHallScript.getHealth() : hunterHallScript.currentHealth;
                healed = afterHealth > beforeHealth;
            } else if (hunterHallScript.getHealth && hunterHallScript.getMaxHealth) {
                const currentHealth = hunterHallScript.getHealth();
                const maxHealth = hunterHallScript.getMaxHealth();
                if (currentHealth < maxHealth) {
                    // 直接设置血量
                    if (hunterHallScript.currentHealth !== undefined) {
                        hunterHallScript.currentHealth = Math.min(maxHealth, currentHealth + this.healAmount);
                        if (hunterHallScript.healthBar) {
                            hunterHallScript.healthBar.setHealth(hunterHallScript.currentHealth);
                        }
                        healed = true;
                    }
                }
            }
            if (healed) {
                this.showHealEffect();
                this.showHealNumber();
            }
            return;
        }

        const swordsmanHallScript = this.attachedBuilding.getComponent('SwordsmanHall') as any;
        if (swordsmanHallScript && swordsmanHallScript.isAlive && swordsmanHallScript.isAlive()) {
            // 检查建筑物是否满血，避免不必要的治疗
            if (swordsmanHallScript.getHealth && swordsmanHallScript.getMaxHealth) {
                const currentHealth = swordsmanHallScript.getHealth();
                const maxHealth = swordsmanHallScript.getMaxHealth();
                if (currentHealth >= maxHealth) {
                    return; // 满血，不治疗
                }
            }

            let healed = false;
            if (swordsmanHallScript.heal) {
                // 保存治疗前的血量
                const beforeHealth = swordsmanHallScript.getHealth ? swordsmanHallScript.getHealth() : swordsmanHallScript.currentHealth;
                swordsmanHallScript.heal(this.healAmount);
                // 检查治疗后是否真的恢复了血量
                const afterHealth = swordsmanHallScript.getHealth ? swordsmanHallScript.getHealth() : swordsmanHallScript.currentHealth;
                healed = afterHealth > beforeHealth;
            } else if (swordsmanHallScript.getHealth && swordsmanHallScript.getMaxHealth) {
                const currentHealth = swordsmanHallScript.getHealth();
                const maxHealth = swordsmanHallScript.getMaxHealth();
                if (currentHealth < maxHealth) {
                    // 直接设置血量
                    if (swordsmanHallScript.currentHealth !== undefined) {
                        swordsmanHallScript.currentHealth = Math.min(maxHealth, currentHealth + this.healAmount);
                        if (swordsmanHallScript.healthBar) {
                            swordsmanHallScript.healthBar.setHealth(swordsmanHallScript.currentHealth);
                        }
                        healed = true;
                    }
                }
            }
            if (healed) {
                this.showHealEffect();
                this.showHealNumber();
            }
            return;
        }
    }
    
    /**
     * 显示治疗数字
     */
    private showHealNumber() {
        if (this.damageNumberPrefab && this.attachedBuilding && this.attachedBuilding.isValid) {
            const healNode = instantiate(this.damageNumberPrefab);
            const canvas = find('Canvas');
            if (canvas) {
                healNode.setParent(canvas);
            } else if (this.node.scene) {
                healNode.setParent(this.node.scene);
            }
            
            // 设置治疗数字位置（在建筑物上方）
            const buildingPos = this.attachedBuilding.worldPosition.clone();
            healNode.setWorldPosition(buildingPos.add3f(0, 50, 0));
            
            // 获取DamageNumber组件并设置治疗数值和颜色
            const healScript = healNode.getComponent('DamageNumber') as any;
            if (healScript) {
                // 设置治疗量，使用正数表示治疗
                healScript.setDamage(-this.healAmount);
                // 设置为绿色
                healScript.setColor(new Color(0, 255, 0, 255));
            }
        }
    }

    /**
     * 显示治疗特效
     */
    showHealEffect() {
        if (this.healEffectPrefab) {
            const effect = instantiate(this.healEffectPrefab);
            const canvas = find('Canvas');
            if (canvas) {
                effect.setParent(canvas);
            } else if (this.node.scene) {
                effect.setParent(this.node.scene);
            }
            effect.setWorldPosition(this.attachedBuilding.worldPosition.clone().add3f(0, 20, 0));
            effect.active = true;

            // 延迟销毁
            this.scheduleOnce(() => {
                if (effect && effect.isValid) {
                    effect.destroy();
                }
            }, 1.0);
        }
    }

    /**
     * 受到伤害
     */
    takeDamage(damage: number) {
        if (this.isDestroyed) {
            return;
        }
        
        // 依附在建筑物上时不会被攻击
        if (this.isAttached) {
            console.debug('Wisp.takeDamage: Wisp is attached to building, ignoring damage');
            return;
        }

        this.currentHealth -= damage;

        // 更新单位信息面板
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                currentHealth: Math.max(0, this.currentHealth),
                maxHealth: this.maxHealth
            });
        }

        // 显示伤害数字
        if (this.damageNumberPrefab) {
            const damageNode = instantiate(this.damageNumberPrefab);
            const canvas = find('Canvas');
            if (canvas) {
                damageNode.setParent(canvas);
            } else if (this.node.scene) {
                damageNode.setParent(this.node.scene);
            }
            damageNode.setWorldPosition(this.node.worldPosition.clone().add3f(0, 30, 0));
            const damageScript = damageNode.getComponent(DamageNumber);
            if (damageScript) {
                damageScript.setDamage(damage);
            }
        }

        // 更新血条
        if (this.healthBar) {
            this.healthBar.setHealth(this.currentHealth);
        }

        if (this.currentHealth <= 0) {
            this.die();
        }
    }
    
    /**
     * 恢复血量
     * @param amount 恢复的血量
     */
    heal(amount: number) {
        if (this.isDestroyed) {
            return;
        }
        
        // 如果满血，不恢复
        if (this.currentHealth >= this.maxHealth) {
            return;
        }
        
        // 保存治疗前的血量
        const oldHealth = this.currentHealth;
        // 恢复血量，不超过最大值
        this.currentHealth = Math.min(this.currentHealth + amount, this.maxHealth);
        
        // 更新血条
        if (this.healthBar) {
            this.healthBar.setHealth(this.currentHealth);
        }
        
        // 更新单位信息面板
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth
            });
        }
        
        // 显示治疗数字
        if (this.damageNumberPrefab) {
            const healNode = instantiate(this.damageNumberPrefab);
            const canvas = find('Canvas');
            if (canvas) {
                healNode.setParent(canvas);
            } else if (this.node.scene) {
                healNode.setParent(this.node.scene);
            }
            healNode.setWorldPosition(this.node.worldPosition.clone().add3f(0, 30, 0));
            const healScript = healNode.getComponent(DamageNumber);
            if (healScript) {
                // 使用负数表示治疗
                healScript.setDamage(-amount);
                // 设置为绿色
                healScript.setColor(new Color(0, 255, 0, 255));
            }
        }
    }

    /**
     * 死亡
     */
    die() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;

        // 如果依附在建筑物上，先卸下
        if (this.isAttached && this.attachedBuilding) {
            this.detachFromBuilding();
        }

        // 播放爆炸特效
        if (this.explosionEffect) {
            const explosion = instantiate(this.explosionEffect);
            const canvas = find('Canvas');
            if (canvas) {
                explosion.setParent(canvas);
            } else if (this.node.scene) {
                explosion.setParent(this.node.scene);
            }
            explosion.setWorldPosition(this.node.worldPosition);
            explosion.active = true;
        }

        // 销毁节点
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }, 0.5);
    }

    /**
     * 初始化粒子特效
     */
    private initParticleEffect() {
        if (this.spriteFlashEffect && this.enableParticleEffect) {
            // 创建粒子特效节点
            this.particleEffectNode = instantiate(this.spriteFlashEffect);
            // 将粒子特效节点设置为小精灵的子节点，使其跟随小精灵移动
            this.particleEffectNode.setParent(this.node);
            // 设置粒子特效偏移量
            this.particleEffectNode.setPosition(this.particleEffectOffset);
            // 激活粒子特效
            this.particleEffectNode.active = true;
        }
    }
    
    /**
     * 清理粒子特效
     */
    private cleanupParticleEffect() {
        if (this.particleEffectNode && this.particleEffectNode.isValid) {
            this.particleEffectNode.destroy();
        }
    }
    
    /**
     * 设置粒子特效启用状态
     */
    setParticleEffectEnabled(enabled: boolean) {
        this.enableParticleEffect = enabled;
        if (this.particleEffectNode && this.particleEffectNode.isValid) {
            this.particleEffectNode.active = enabled;
        } else if (enabled && this.spriteFlashEffect && !this.particleEffectNode) {
            // 如果需要启用但还没有创建粒子特效，重新初始化
            this.initParticleEffect();
        }
    }
    
    /**
     * 获取粒子特效启用状态
     */
    isParticleEffectEnabled(): boolean {
        return this.enableParticleEffect;
    }
    
    /**
     * 是否存活
     */
    isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }

    /**
     * 获取血量
     */
    getHealth(): number {
        return this.currentHealth;
    }

    /**
     * 获取最大血量
     */
    getMaxHealth(): number {
        return this.maxHealth;
    }

    /**
     * 是否已依附
     */
    getIsAttached(): boolean {
        return this.isAttached;
    }

    /**
     * 获取依附的建筑物
     */
    getAttachedBuilding(): Node | null {
        return this.attachedBuilding;
    }

    /**
     * 设置高亮显示
     */
    setHighlight(highlight: boolean) {
        this.isHighlighted = highlight;
        
        if (!this.highlightNode && highlight) {
            // 创建高亮效果节点
            this.highlightNode = new Node('Highlight');
            this.highlightNode.setParent(this.node);
            this.highlightNode.setPosition(0, 0, 0);
            
            const graphics = this.highlightNode.addComponent(Graphics);
            graphics.strokeColor = new Color(255, 255, 0, 255); // 黄色边框
            graphics.lineWidth = 3;
            graphics.circle(0, 0, this.collisionRadius);
            graphics.stroke();
        }
        
        if (this.highlightNode) {
            this.highlightNode.active = highlight;
        }
        
        // 如果取消高亮，同时清除UnitSelectionManager中的选中状态
        // 避免递归调用：检查当前选中的单位是否是自己，如果是，就不调用clearSelection
        if (!highlight && this.unitSelectionManager) {
            const currentSelectedUnit = (this.unitSelectionManager as any).currentSelectedUnit;
            if (currentSelectedUnit !== this.node) {
                if (this.unitSelectionManager.isUnitSelected(this.node)) {
                    this.unitSelectionManager.clearSelection();
                }
            }
        }
    }

    /**
     * 点击事件
     */
    onWispClick(event: EventTouch) {
        console.debug('Wisp.onWispClick: Wisp clicked, event:', event);
        // 阻止事件冒泡
        event.propagationStopped = true;

        // 检查是否处于建造模式，如果是，先退出建造模式
        console.debug('Wisp.onWispClick: Checking building mode...');
        const towerBuilderNode = find('TowerBuilder');
        if (towerBuilderNode) {
            console.debug('Wisp.onWispClick: TowerBuilder node found');
            const towerBuilder = towerBuilderNode.getComponent('TowerBuilder') as any;
            if (towerBuilder) {
                console.debug('Wisp.onWispClick: TowerBuilder component found');
                // 直接调用disableBuildingMode，不管当前是否处于建造模式
                console.debug('Wisp.onWispClick: Calling disableBuildingMode() to exit building mode');
                if (towerBuilder.disableBuildingMode) {
                    towerBuilder.disableBuildingMode();
                    console.debug('Wisp.onWispClick: disableBuildingMode() called successfully');
                } else {
                    console.debug('Wisp.onWispClick: disableBuildingMode() method not found');
                }
                
                // 直接设置isBuildingMode为false，确保建造模式被退出
                console.debug('Wisp.onWispClick: Setting isBuildingMode to false directly');
                towerBuilder.isBuildingMode = false;
                console.debug('Wisp.onWispClick: After setting, isBuildingMode is now:', towerBuilder.isBuildingMode);
            } else {
                console.debug('Wisp.onWispClick: TowerBuilder component not found');
            }
        } else {
            console.debug('Wisp.onWispClick: TowerBuilder node not found');
        }

        // 显示单位信息面板
        if (!this.unitSelectionManager) {
            console.debug('Wisp.onWispClick: Finding UnitSelectionManager');
            this.findUnitSelectionManager();
        }
        if (this.unitSelectionManager) {
            console.debug('Wisp.onWispClick: UnitSelectionManager found');
            // 检查是否已经选中了小精灵
            if (this.unitSelectionManager.isUnitSelected(this.node)) {
                console.debug('Wisp.onWispClick: Wisp already selected, clearing selection');
                // 如果已经选中，清除选择
                this.unitSelectionManager.clearSelection();
                // 同时清除SelectionManager中的选中状态
                this.clearSelectionInSelectionManager();
                return;
            }

            const unitInfo: UnitInfo = {
                name: '小精灵',
                level: 1,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth,
                attackDamage: 0, // 小精灵没有攻击能力
                populationCost: 1, // 占用1个人口
                icon: this.cardIcon || this.defaultSpriteFrame,
                collisionRadius: this.collisionRadius
            };
            console.debug('Wisp.onWispClick: Selecting wisp in UnitSelectionManager');
            this.unitSelectionManager.selectUnit(this.node, unitInfo);
            
            // 将小精灵添加到SelectionManager的选中列表中，以便后续可以移动
            console.debug('Wisp.onWispClick: Adding wisp to SelectionManager');
            this.addToSelectionManager();
        } else {
            console.debug('Wisp.onWispClick: UnitSelectionManager not found');
        }
    }
    
    /**
     * 将小精灵添加到SelectionManager的选中列表中
     */
    private addToSelectionManager() {
        console.debug('Wisp.addToSelectionManager: Adding wisp to SelectionManager');
        // 查找SelectionManager
        const selectionManager = this.findSelectionManager();
        if (selectionManager) {
            console.debug('Wisp.addToSelectionManager: SelectionManager found, clearing previous selection');
            // 清除之前的选择
            selectionManager.clearSelection();
            // 将当前小精灵添加到选中列表
            console.debug('Wisp.addToSelectionManager: Setting selected wisps to current wisp');
            selectionManager.setSelectedWisps([this]);
            // 注册移动命令
            console.debug('Wisp.addToSelectionManager: Registering move command');
            selectionManager.registerMoveCommand();
            console.debug('Wisp.addToSelectionManager: Move command registered successfully');
            
            // 检查SelectionManager的状态
            console.debug('Wisp.addToSelectionManager: After registration - selectedWisps length:', selectionManager.selectedWisps?.length || 0);
            console.debug('Wisp.addToSelectionManager: After registration - globalTouchHandler:', !!selectionManager.globalTouchHandler);
        } else {
            console.debug('Wisp.addToSelectionManager: SelectionManager not found');
        }
    }
    
    /**
     * 清除SelectionManager中的选中状态
     */
    private clearSelectionInSelectionManager() {
        console.debug('Wisp.clearSelectionInSelectionManager: Clearing selection in SelectionManager');
        const selectionManager = this.findSelectionManager();
        if (selectionManager) {
            console.debug('Wisp.clearSelectionInSelectionManager: SelectionManager found, clearing selection');
            selectionManager.clearSelection();
        } else {
            console.debug('Wisp.clearSelectionInSelectionManager: SelectionManager not found');
        }
    }
    
    /**
     * 查找SelectionManager
     */
    private findSelectionManager(): any {
        console.debug('Wisp.findSelectionManager: Finding SelectionManager');
        let managerNode = find('SelectionManager');
        if (managerNode) {
            console.debug('Wisp.findSelectionManager: SelectionManager node found');
            const selectionManager = managerNode.getComponent('SelectionManager');
            if (selectionManager) {
                console.debug('Wisp.findSelectionManager: SelectionManager component found');
                return selectionManager;
            } else {
                console.debug('Wisp.findSelectionManager: SelectionManager component not found');
            }
        } else {
            console.debug('Wisp.findSelectionManager: SelectionManager node not found, searching in scene');
        }
        
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
            const selectionManager = findInScene(scene, 'SelectionManager');
            if (selectionManager) {
                console.debug('Wisp.findSelectionManager: SelectionManager found in scene');
            } else {
                console.debug('Wisp.findSelectionManager: SelectionManager not found in scene');
            }
            return selectionManager;
        }
        console.debug('Wisp.findSelectionManager: Scene not found');
        return null;
    }
}

