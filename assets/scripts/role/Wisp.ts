import { _decorator, Component, Node, Vec2, Vec3, Prefab, instantiate, find, Graphics, UITransform, Label, Color, EventTouch, Sprite, SpriteFrame, resources } from 'cc';
import { GameManager, GameState } from '../GameManager';
import { HealthBar } from '../HealthBar';
import { DamageNumber } from '../DamageNumber';
import { UnitSelectionManager } from '../UnitSelectionManager';
import { UnitInfo } from '../UnitInfoPanel';
import { GamePopup } from '../GamePopup';
import { Role } from './Role';
import { ForestGridPanel } from '../ForestGridPanel';
import { UnitType } from '../UnitType';
const { ccclass, property } = _decorator;

@ccclass('Wisp')
export class Wisp extends Role {
    @property(Prefab)
    healEffectPrefab: Prefab = null!; // 治疗特效预制体

    @property
    healAmount: number = 2; // 每次治疗恢复的血量

    @property
    healInterval: number = 0.5; // 治疗间隔（秒），改为每0.5秒维修一次

    @property
    attachOffset: Vec3 = new Vec3(0, 30, 0); // 依附在建筑物上的偏移位置
    
    @property
    repairRange: number = 20; // 维修范围（必须在20以内才能维修）
    
    @property
    searchRange: number = 200; // 搜索范围（自动寻找200范围内的建筑物）
    
    @property({ type: [SpriteFrame] })
    repairAnimationFrames: SpriteFrame[] = []; // 维修动画帧数组
    
    @property
    repairAnimationDuration: number = 1.0; // 维修动画时长（秒），调慢一半
    
    // 依附相关
    private attachedBuilding: Node = null!; // 依附的建筑物
    private isAttached: boolean = false; // 是否已依附
    private healTimer: number = 0; // 治疗计时器
    
    // 维修相关
    private repairTarget: Node = null!; // 当前维修目标（防御塔或石墙）
    private isRepairing: boolean = false; // 是否正在维修
    private manualControlActive: boolean = false; // 手动控制激活标志
    private isPlayingRepairAnimation: boolean = false; // 是否正在播放维修动画

    // 树林隐蔽效果相关
    private isInForestArea: boolean = false;
    private originalSpriteColor: Color | null = null;
    
    start() {
        // 设置单位类型为CHARACTER
        this.unitType = UnitType.CHARACTER;
        
        // 调用父类初始化（血量、血条、选择、对话等）
        super.start();

        // 小精灵是辅助单位，没有攻击能力
        this.attackDamage = 0;
        this.attackRange = 0;

        // 初始化依附状态
        this.isAttached = false;
        this.attachedBuilding = null!;
        this.healTimer = 0;
        
        // 初始化维修状态
        this.isRepairing = false;
        this.repairTarget = null!;
        this.manualControlActive = false;
        this.isPlayingRepairAnimation = false;

        // 设置默认名称（如果未在编辑器中配置）
        if (!this.unitName || this.unitName === '') {
            this.unitName = '小精灵';
        }

        // 小精灵的 Sprite 使用自定义尺寸并启用裁剪
        if (this.sprite) {
            this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            this.sprite.trim = true;
            this.originalSpriteColor = this.sprite.color.clone();
        }
        
        // 如果伤害数字预制体未设置，尝试加载
        if (!this.damageNumberPrefab) {
            this.loadDamageNumberPrefab();
        }
    }
    
    /**
     * 加载伤害数字预制体
     */
    private loadDamageNumberPrefab() {
        resources.load('prefabs/DamageNumber', Prefab, (err, prefab) => {
            if (!err && prefab) {
                this.damageNumberPrefab = prefab;
            } else {
                console.warn('[Wisp] Failed to load DamageNumber prefab:', err);
            }
        });
    }

    onDestroy() {
        // 减少人口
        if (this.gameManager) {
            this.gameManager.removePopulation(1);
        }
    }

    update(deltaTime: number) {
        if (this.isDestroyed) {
            return;
        }

        // 在调用父类update之前，检查并保存手动控制状态
        const wasManuallyControlled = this.isManuallyControlled || this.manualMoveTarget != null;
        
        if (wasManuallyControlled) {
            if (!this.manualControlActive) {
                console.log('[Wisp] ===== MANUAL CONTROL ACTIVATED =====');
                console.log('[Wisp] isManuallyControlled:', this.isManuallyControlled);
                console.log('[Wisp] manualMoveTarget:', this.manualMoveTarget);
                this.manualControlActive = true;
                this.repairTarget = null!;
                this.isRepairing = false;
            }
        }

        // 调用父类处理移动、选中、碰撞等通用逻辑
        super.update(deltaTime);

        // 在父类update之后，再次检查手动控制状态
        // 如果之前是手动控制，但现在标志被清空了，保持manualControlActive为true
        const isStillManuallyControlled = this.isManuallyControlled || this.manualMoveTarget != null;
        
        if (!isStillManuallyControlled && this.manualControlActive) {
            // 父类可能已经完成了移动，现在可以停用手动控制
            console.log('[Wisp] ===== MANUAL CONTROL DEACTIVATED =====');
            this.manualControlActive = false;
        }

        // 移除依附功能，只保留维修功能
        if (!this.manualControlActive) {
            // 只有在非手动控制状态下才执行维修逻辑
            this.updateRepairLogic(deltaTime);
        }

        // 更新树林隐蔽效果
        this.updateForestStealthState();
    }
    
    /**
     * 更新维修逻辑
     */
    private updateRepairLogic(deltaTime: number) {
        // 如果正在手动控制移动，不执行维修逻辑（手动控制优先级最高）
        if (this.isManuallyControlled || this.manualMoveTarget) {
            this.repairTarget = null!;
            this.isRepairing = false;
            return;
        }
        
        // 更新维修计时器
        this.healTimer += deltaTime;

        // 查找需要维修的目标
        if (!this.repairTarget || !this.repairTarget.isValid || !this.repairTarget.active) {
            this.findRepairTarget();
        }

        // 如果有维修目标
        if (this.repairTarget) {
            const distance = Vec3.distance(this.node.worldPosition, this.repairTarget.worldPosition);
            
            // 如果在维修范围内
            if (distance <= this.repairRange) {
                // 不要设置 isMoving = false，让父类的移动逻辑继续工作
                this.isRepairing = true;
                
                // 执行维修
                if (this.healTimer >= this.healInterval) {
                    this.healTimer = 0;
                    this.repairBuilding();
                }
            } else if (distance <= this.searchRange) {
                // 如果在搜索范围内但不在维修范围内，移动到目标附近
                this.isRepairing = true;
                this.moveToRepairTarget(this.repairTarget, deltaTime);
            } else {
                // 目标超出搜索范围，清除目标
                this.repairTarget = null!;
                this.isRepairing = false;
            }
        } else {
            this.isRepairing = false;
        }
    }
    
    /**
     * 查找需要维修的目标（防御塔或石墙）
     */
    private findRepairTarget() {
        const containers = [
            'Canvas/Towers',
            'Canvas/WarAncientTrees',
            'Canvas/HunterHalls',
            'Canvas/StoneWalls',
            'Canvas/WatchTowers',
            'Canvas/IceTowers',
            'Canvas/ThunderTowers',
            'Canvas/SwordsmanHalls',
            'Canvas/Churches'
        ];

        let nearestTarget: Node = null!;
        let minDistance = Infinity;

        for (const containerPath of containers) {
            const container = this.findNodeByPath(containerPath);
            if (!container) continue;

            for (const building of container.children) {
                if (!building || !building.active || !building.isValid) continue;

                // 获取建筑物脚本
                const buildingScript = this.getBuildingScript(building);
                if (!buildingScript) continue;

                // 检查建筑物是否存活
                if (buildingScript.isAlive && !buildingScript.isAlive()) continue;

                // 检查是否需要维修（生命值未满）
                const currentHealth = buildingScript.currentHealth || buildingScript.getHealth?.();
                const maxHealth = buildingScript.maxHealth || buildingScript.getMaxHealth?.();
                
                if (currentHealth !== undefined && maxHealth !== undefined && currentHealth < maxHealth) {
                    const distance = Vec3.distance(this.node.worldPosition, building.worldPosition);
                    if (distance <= this.searchRange && distance < minDistance) {
                        minDistance = distance;
                        nearestTarget = building;
                    }
                }
            }
        }

        this.repairTarget = nearestTarget;
    }
    
    /**
     * 维修建筑物
     */
    private repairBuilding() {
        if (!this.repairTarget || this.isDestroyed) {
            return;
        }

        if (!this.repairTarget.isValid || !this.repairTarget.active) {
            this.repairTarget = null!;
            this.isRepairing = false;
            return;
        }

        // 获取建筑物脚本
        const buildingScript = this.getBuildingScript(this.repairTarget);
        if (!buildingScript) {
            this.repairTarget = null!;
            this.isRepairing = false;
            return;
        }

        // 检查建筑物是否存活
        if (buildingScript.isAlive && !buildingScript.isAlive()) {
            this.repairTarget = null!;
            this.isRepairing = false;
            return;
        }

        // 获取当前生命值和最大生命值
        const currentHealth = buildingScript.currentHealth || buildingScript.getHealth?.();
        const maxHealth = buildingScript.maxHealth || buildingScript.getMaxHealth?.();

        // 检查是否需要维修
        if (currentHealth >= maxHealth) {
            this.repairTarget = null!;
            this.isRepairing = false;
            return;
        }

        // 播放维修动画
        this.playRepairAnimation();

        // 恢复生命值
        const healAmount = Math.min(this.healAmount, maxHealth - currentHealth);
        
        if (buildingScript.heal) {
            buildingScript.heal(healAmount);
        } else if (buildingScript.currentHealth !== undefined) {
            buildingScript.currentHealth = Math.min(maxHealth, currentHealth + healAmount);
            // 更新血条
            if (buildingScript.updateHealthBar) {
                buildingScript.updateHealthBar();
            } else if (buildingScript.healthBar) {
                buildingScript.healthBar.setHealth(buildingScript.currentHealth);
            }
        }

        // 显示治疗特效和数字
        this.showRepairEffect(this.repairTarget);
        this.showRepairNumber(this.repairTarget, healAmount);
    }
    
    /**
     * 播放维修动画
     */
    private playRepairAnimation() {
        if (this.isPlayingRepairAnimation) {
            return;
        }

        if (!this.sprite) {
            this.sprite = this.node.getComponent(Sprite);
            if (!this.sprite) {
                return;
            }
        }

        if (!this.repairAnimationFrames || this.repairAnimationFrames.length === 0) {
            return;
        }

        const validFrames = this.repairAnimationFrames.filter(frame => frame != null);
        if (validFrames.length === 0) {
            return;
        }

        this.isPlayingRepairAnimation = true;

        const frames = validFrames;
        const frameCount = frames.length;
        const frameDuration = this.repairAnimationDuration / frameCount;
        let animationTimer = 0;
        let lastFrameIndex = -1;

        if (frames[0]) {
            this.sprite.spriteFrame = frames[0];
            lastFrameIndex = 0;
        }

        const animationUpdate = (deltaTime: number) => {
            if (!this.sprite || !this.sprite.isValid || this.isDestroyed) {
                this.isPlayingRepairAnimation = false;
                this.unschedule(animationUpdate);
                return;
            }

            animationTimer += deltaTime;

            if (animationTimer >= this.repairAnimationDuration) {
                // 动画播放完成，恢复默认精灵
                if (this.defaultSpriteFrame) {
                    this.sprite.spriteFrame = this.defaultSpriteFrame;
                }
                this.isPlayingRepairAnimation = false;
                this.unschedule(animationUpdate);
                return;
            }

            const targetFrameIndex = Math.min(Math.floor(animationTimer / frameDuration), frameCount - 1);
            if (targetFrameIndex !== lastFrameIndex && targetFrameIndex < frameCount && frames[targetFrameIndex]) {
                this.sprite.spriteFrame = frames[targetFrameIndex];
                lastFrameIndex = targetFrameIndex;
            }
        };

        this.unschedule(animationUpdate);
        this.schedule(animationUpdate, 0);
    }
    
    /**
     * 移动到维修目标附近
     */
    private moveToRepairTarget(target: Node, deltaTime: number) {
        if (!target || !target.isValid) {
            return;
        }

        const currentPos = this.node.worldPosition;
        const targetPos = target.worldPosition;
        
        // 计算方向
        const direction = new Vec3();
        Vec3.subtract(direction, targetPos, currentPos);
        direction.normalize();

        // 计算新位置
        const moveDistance = this.moveSpeed * deltaTime;
        const newPos = new Vec3();
        Vec3.scaleAndAdd(newPos, currentPos, direction, moveDistance);

        // 更新位置
        this.node.setWorldPosition(newPos);
        // 不设置 isMoving = true，避免影响手动控制判断

        // 根据移动方向翻转精灵
        if (direction.x < 0) {
            this.node.setScale(-Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
        } else {
            this.node.setScale(Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
        }
    }
    
    /**
     * 获取建筑物脚本
     */
    private getBuildingScript(building: Node): any {
        const scriptNames = [
            'WarAncientTree',
            'HunterHall',
            'StoneWall',
            'WatchTower',
            'IceTower',
            'ThunderTower',
            'SwordsmanHall',
            'Church',
            'MoonWell'
        ];

        for (const scriptName of scriptNames) {
            const script = building.getComponent(scriptName as any);
            if (script) {
                return script;
            }
        }

        return null;
    }
    
    /**
     * 根据路径查找节点
     */
    private findNodeByPath(path: string): Node | null {
        const parts = path.split('/');
        let current: Node | null = null;
        
        // 先尝试直接查找
        current = find(path);
        if (current) return current;
        
        // 如果直接查找失败，尝试递归查找
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
        
        // 从场景根节点开始查找最后一个部分
        if (this.node.scene && parts.length > 0) {
            const targetName = parts[parts.length - 1];
            return findNodeRecursive(this.node.scene, targetName);
        }
        
        return null;
    }
    
    /**
     * 显示维修特效
     */
    private showRepairEffect(target: Node) {
        if (this.healEffectPrefab && target && target.isValid) {
            const effect = instantiate(this.healEffectPrefab);
            const canvas = find('Canvas');
            if (canvas) {
                effect.setParent(canvas);
            } else if (this.node.scene) {
                effect.setParent(this.node.scene);
            }
            effect.setWorldPosition(target.worldPosition.clone().add3f(0, 20, 0));
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
     * 显示维修数字
     */
    private showRepairNumber(target: Node, amount: number) {
        if (this.damageNumberPrefab && target && target.isValid) {
            const healNode = instantiate(this.damageNumberPrefab);
            const canvas = find('Canvas');
            if (canvas) {
                healNode.setParent(canvas);
            } else if (this.node.scene) {
                healNode.setParent(this.node.scene);
            }
            
            // 设置治疗数字位置（在建筑物上方）
            const targetPos = target.worldPosition.clone();
            healNode.setWorldPosition(targetPos.add3f(0, 50, 0));
            healNode.active = true;
            
            // 获取DamageNumber组件并设置治疗数值和颜色
            const healScript = healNode.getComponent('DamageNumber' as any) as any;
            if (healScript) {
                // 设置治疗量，使用负数表示治疗
                healScript.setDamage(-amount);
                // 设置为绿色
                healScript.setColor(new Color(0, 255, 0, 255));
            }
        }
    }

    /**
     * 更新小精灵在树林网格中的半透明隐身效果：
     * - 进入任意一片树林网格：身体变淡到 50% 不透明度
     * - 离开所有树林网格：恢复原始不透明度
     */
    private updateForestStealthState() {
        if (!this.sprite || !this.node || !this.node.isValid) {
            return;
        }

        const worldPos = this.node.worldPosition.clone();
        let inForest = false;

        // 左侧树林
        const leftNode = find('Canvas/ForestGridLeft') || find('ForestGridLeft');
        if (leftNode) {
            const panel = leftNode.getComponent(ForestGridPanel);
            if (panel && panel.worldToGrid(worldPos)) {
                inForest = true;
            }
        }

        // 右侧树林（如果左侧未命中）
        if (!inForest) {
            const rightNode = find('Canvas/ForestGridRight') || find('ForestGridRight');
            if (rightNode) {
                const panel = rightNode.getComponent(ForestGridPanel);
                if (panel && panel.worldToGrid(worldPos)) {
                    inForest = true;
                }
            }
        }

        if (inForest === this.isInForestArea) {
            // 状态未变化，无需重复设置
            return;
        }

        this.isInForestArea = inForest;

        if (!this.originalSpriteColor) {
            this.originalSpriteColor = this.sprite.color.clone();
        }

        if (this.isInForestArea) {
            // 进入树林：将透明度降到 50%
            const c = this.originalSpriteColor;
            this.sprite.color = new Color(c.r, c.g, c.b, 128);
        } else {
            // 离开树林：恢复原有颜色（包含原始透明度）
            this.sprite.color = this.originalSpriteColor.clone();
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
                }
            }
        }

        // 最后设置依附状态
        this.isAttached = true;

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
     * 设置手动移动目标位置（用于选中移动）
     * 覆盖父类实现：清除维修目标
     * @param worldPos 世界坐标位置
     */
    setManualMoveTargetPosition(worldPos: Vec3) {
        // 清除维修目标
        this.repairTarget = null!;
        this.isRepairing = false;
        
        // 调用父类的手动移动逻辑（带智能分散/避让）
        super.setManualMoveTargetPosition(worldPos);
        
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

        // 如果正在维修，不检查重叠（避免维修时被依附）
        if (this.isRepairing) {
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
     * 覆盖父类的索敌逻辑：小精灵不索敌、不攻击敌人
     */
    findTarget() {
        this.currentTarget = null!;
    }

    /**
     * 覆盖父类的攻击逻辑：小精灵不能攻击敌人
     */
    attack() {
        // 小精灵是辅助单位，没有攻击能力，这里什么都不做
    }

    /**
     * 覆盖父类的实际攻击执行逻辑，确保不会发射子弹/箭矢
     */
    executeAttack() {
        // 空实现，避免父类创建子弹或箭矢
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
     * 重写碰撞检测方法：小精灵不受任何障碍物阻挡
     * @param position 要检测的位置
     * @returns 始终返回 false，表示没有碰撞
     */
    checkCollisionAtPosition(position: Vec3): boolean {
        // 小精灵可以穿过所有障碍物，不进行碰撞检测
        return false;
    }

    // 选择和高亮逻辑由父类 Role 和 UnitSelectionManager 统一管理
}

