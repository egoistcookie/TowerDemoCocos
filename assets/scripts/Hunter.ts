import { _decorator, Component, Node, Vec3, Prefab, instantiate, find, Graphics, UITransform, Label, Color, tween, EventTouch, input, Input, resources, Sprite, SpriteFrame, Texture2D, Camera, AudioClip } from 'cc';
import { AudioManager } from './AudioManager';
import { GameManager, GameState } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
import { Boomerang } from './Boomerang';
import { UnitSelectionManager } from './UnitSelectionManager';
import { UnitInfo } from './UnitInfoPanel';
import { UnitType } from './WarAncientTree';
const { ccclass, property } = _decorator;

@ccclass('Hunter')
export class Hunter extends Component {
    @property
    maxHealth: number = 50;

    @property
    attackRange: number = 200;

    @property
    attackDamage: number = 10;

    @property
    attackInterval: number = 1.0;

    @property(Prefab)
    bulletPrefab: Prefab = null!;

    @property(Prefab)
    arrowPrefab: Prefab = null!; // 弓箭预制体（支持后期更新贴图）

    @property(Prefab)
    explosionEffect: Prefab = null!;

    @property(Prefab)
    damageNumberPrefab: Prefab = null!;

    @property
    buildCost: number = 5; // 建造成本（用于回收和升级）
    
    @property
    level: number = 1; // 防御塔等级

    // 攻击动画相关属性
    @property(SpriteFrame)
    attackAnimationFrames: SpriteFrame[] = []; // 攻击动画帧数组（推荐：在编辑器中手动设置）
    
    // 音效相关属性
    @property(AudioClip)
    shootSound: AudioClip = null!; // 箭矢射出时的音效
    
    @property(AudioClip)
    hitSound: AudioClip = null!; // 箭矢击中敌人时的音效

    @property(Texture2D)
    attackAnimationTexture: Texture2D = null!; // 攻击动画纹理（12帧图片）

    @property
    framesPerRow: number = 12; // 每行帧数（横向排列为12，3x4网格为3，4x3网格为4）

    @property
    totalFrames: number = 12; // 总帧数

    @property
    attackAnimationDuration: number = 0.5; // 攻击动画时长（秒）

    // 移动相关属性
    @property
    moveSpeed: number = 100; // 移动速度（像素/秒）

    @property(SpriteFrame)
    moveAnimationFrames: SpriteFrame[] = []; // 移动动画帧数组（可选）

    @property
    moveAnimationDuration: number = 0.3; // 移动动画时长（秒）

    @property
    collisionRadius: number = 30; // 碰撞半径（像素）

    @property(SpriteFrame)
    cardIcon: SpriteFrame = null!; // 单位名片图片

    // 单位类型
    public unitType: UnitType = UnitType.CHARACTER;

    private currentHealth: number = 50;
    private healthBar: HealthBar = null!;
    private healthBarNode: Node = null!;
    private selectionPanel: Node = null!; // 选择面板
    private isDestroyed: boolean = false;
    private attackTimer: number = 0;
    private currentTarget: Node = null!;
    private gameManager: GameManager = null!;
    private sprite: Sprite = null!; // Sprite组件引用
    private defaultSpriteFrame: SpriteFrame = null!; // 默认SpriteFrame（动画结束后恢复）
    private defaultScale: Vec3 = new Vec3(1, 1, 1); // 默认缩放（用于恢复翻转）
    private isPlayingAttackAnimation: boolean = false; // 是否正在播放攻击动画
    private isMoving: boolean = false; // 是否正在移动
    private moveTarget: Node = null!; // 移动目标（敌人）
    private isPlayingMoveAnimation: boolean = false; // 是否正在播放移动动画
    private avoidDirection: Vec3 = new Vec3(); // 避障方向
    private avoidTimer: number = 0; // 避障计时器
    private collisionCheckCount: number = 0; // 碰撞检测调用计数（用于调试）
    private manualMoveTarget: Vec3 | null = null!; // 手动移动目标位置
    private isManuallyControlled: boolean = false; // 是否正在手动控制
    private globalTouchHandler: ((event: EventTouch) => void) | null = null!; // 全局触摸事件处理器
    private isHighlighted: boolean = false; // 是否高亮显示
    private highlightNode: Node = null!; // 高亮效果节点
    private unitSelectionManager: UnitSelectionManager = null!; // 单位选择管理器

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        this.currentTarget = null!;
        this.isPlayingAttackAnimation = false;
        
        // 获取Sprite组件
        this.sprite = this.node.getComponent(Sprite);
        if (this.sprite) {
            // 保存默认SpriteFrame
            this.defaultSpriteFrame = this.sprite.spriteFrame;
            // 保存默认缩放
            this.defaultScale = this.node.scale.clone();
        }
        
        // 初始化攻击动画帧
        this.initAttackAnimation();
        
        // 查找游戏管理器
        this.findGameManager();
        
        // 查找单位选择管理器
        this.findUnitSelectionManager();
        
        // 创建血条
        this.createHealthBar();
        
        // 监听点击事件
        this.node.on(Node.EventType.TOUCH_END, this.onTowerClick, this);
    }

    /**
     * 查找单位选择管理器
     */
    findUnitSelectionManager() {
        // 方法1: 通过节点名称查找
        let managerNode = find('UnitSelectionManager');
        if (managerNode) {
            this.unitSelectionManager = managerNode.getComponent(UnitSelectionManager);
            if (this.unitSelectionManager) {
                return;
            }
        }
        
        // 方法2: 从场景根节点递归查找UnitSelectionManager组件
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

    initAttackAnimation() {
        // 如果已经在编辑器中设置了attackAnimationFrames，直接使用
        if (this.attackAnimationFrames && this.attackAnimationFrames.length > 0) {
            const validFrames = this.attackAnimationFrames.filter(frame => frame != null);
            if (validFrames.length < this.attackAnimationFrames.length) {
                console.warn(`Hunter: Warning - ${this.attackAnimationFrames.length - validFrames.length} frames are null or invalid!`);
            }
            return;
        }

        // 如果没有设置帧数组，尝试从纹理中加载
        if (this.attackAnimationTexture) {
            this.loadFramesFromTexture();
        } else {
            console.warn('Hunter: No attack animation frames or texture set. Attack animation will not play.');
        }
    }

    loadFramesFromTexture() {
        // 注意：Cocos Creator中，从Texture2D直接分割SpriteFrame需要手动计算
        // 这里提供一个基础实现，但推荐在编辑器中手动设置SpriteFrame数组
        
        // 如果纹理已导入为SpriteAtlas，应该使用SpriteAtlas的方式
        // 这里假设纹理是单行排列的12帧
        
        if (!this.sprite) {
            return;
        }

        // 由于Cocos Creator的API限制，从Texture2D直接创建SpriteFrame比较复杂
        // 推荐做法：在编辑器中手动设置attackAnimationFrames数组
        // 或者使用SpriteAtlas资源
        
        console.warn('Hunter: Auto-loading frames from texture is not fully supported. Please set attackAnimationFrames array in editor, or use SpriteAtlas.');
    }

    createHealthBar() {
        // 创建血条节点
        this.healthBarNode = new Node('HealthBar');
        this.healthBarNode.setParent(this.node);
        this.healthBarNode.setPosition(0, 30, 0); // 在防御塔上方
        // 确保血条初始缩放为正数（正常朝向）
        this.healthBarNode.setScale(1, 1, 1);
        
        // 添加HealthBar组件
        this.healthBar = this.healthBarNode.addComponent(HealthBar);
        if (this.healthBar) {
            this.healthBar.setMaxHealth(this.maxHealth);
            this.healthBar.setHealth(this.currentHealth);
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
    }

    update(deltaTime: number) {
        if (this.isDestroyed) {
            return;
        }

        // 检查游戏状态 - 如果GameManager不存在，尝试重新查找
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        // 检查游戏状态，如果不是Playing状态，停止攻击
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                // 游戏已结束，停止攻击
                this.currentTarget = null!;
                return;
            }
        }

        this.attackTimer += deltaTime;

        // 优先处理手动移动目标
        if (this.manualMoveTarget) {
            const distanceToManualTarget = Vec3.distance(this.node.worldPosition, this.manualMoveTarget);
            const arrivalThreshold = 10; // 到达阈值（像素）
            
            if (distanceToManualTarget <= arrivalThreshold) {
                // 到达手动移动目标，清除手动目标
                this.manualMoveTarget = null!;
                this.isManuallyControlled = false;
                this.stopMoving();
            } else {
                // 移动到手动目标位置
                this.moveToPosition(this.manualMoveTarget, deltaTime);
                return; // 手动移动时，不执行自动寻敌
            }
        }

        // 查找目标（只有在没有手动移动目标时才执行）
        if (!this.manualMoveTarget) {
            this.findTarget();
        }

        // 无论是否移动，都要检查碰撞（防止重叠）
        const currentPos = this.node.worldPosition.clone();
        const hasCollisionNow = this.checkCollisionAtPosition(currentPos);
        if (hasCollisionNow) {
            // 即使不移动，如果有碰撞也要推开
            const pushDirection = this.calculatePushAwayDirection(currentPos);
            if (pushDirection.length() > 0.1) {
                const pushDistance = this.moveSpeed * deltaTime * 1.5;
                const pushPos = new Vec3();
                Vec3.scaleAndAdd(pushPos, currentPos, pushDirection, pushDistance);
                const finalPushPos = this.checkCollisionAndAdjust(currentPos, pushPos);
                this.node.setWorldPosition(finalPushPos);
            }
        }

        // 处理移动和攻击逻辑
        if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
            const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
            
            if (distance <= this.attackRange) {
                // 在攻击范围内，停止移动并攻击
                this.stopMoving();
                
                // 根据敌人位置保持正确的朝向
                const towerPos = this.node.worldPosition;
                const enemyPos = this.currentTarget.worldPosition;
                if (enemyPos.x < towerPos.x) {
                    // 敌人在左侧，保持翻转
                    this.node.setScale(-Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
                    // 血条反向翻转，保持正常朝向
                    if (this.healthBarNode && this.healthBarNode.isValid) {
                        this.healthBarNode.setScale(-1, 1, 1);
                    }
                } else {
                    // 敌人在右侧，保持正常朝向
                    this.node.setScale(Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
                    // 血条正常朝向
                    if (this.healthBarNode && this.healthBarNode.isValid) {
                        this.healthBarNode.setScale(1, 1, 1);
                    }
                }
                
                if (this.attackTimer >= this.attackInterval) {
                    // 再次检查游戏状态，确保游戏仍在进行
                    if (this.gameManager && this.gameManager.getGameState() === GameState.Playing) {
                        this.attack();
                        this.attackTimer = 0;
                    }
                }
            } else if (distance <= this.attackRange * 2) {
                // 在2倍攻击范围内，朝敌人移动
                this.moveTowardsTarget(deltaTime);
            } else {
                // 超出2倍攻击范围，停止移动
                this.stopMoving();
            }
        } else {
            // 没有目标，停止移动
            this.stopMoving();
        }
    }

    /**
     * 移动到指定位置（用于手动控制）
     * @param targetPos 目标位置
     * @param deltaTime 时间增量
     */
    moveToPosition(targetPos: Vec3, deltaTime: number) {
        if (this.isDestroyed) {
            return;
        }

        const towerPos = this.node.worldPosition.clone();
        const distance = Vec3.distance(towerPos, targetPos);

        // 如果已经到达目标位置，停止移动
        if (distance <= 10) {
            this.stopMoving();
            return;
        }

        // 首先检查当前位置是否有碰撞，如果有，先推开
        const hasCollision = this.checkCollisionAtPosition(towerPos);
        
        if (hasCollision) {
            // 当前位置有碰撞，先推开
            const pushDirection = this.calculatePushAwayDirection(towerPos);
            if (pushDirection.length() > 0.1) {
                const pushDistance = this.moveSpeed * deltaTime * 1.5;
                const pushPos = new Vec3();
                Vec3.scaleAndAdd(pushPos, towerPos, pushDirection, pushDistance);
                const finalPushPos = this.checkCollisionAndAdjust(towerPos, pushPos);
                this.node.setWorldPosition(finalPushPos);
                return; // 先推开，下一帧再移动
            }
        }

        // 计算移动方向
        const direction = new Vec3();
        Vec3.subtract(direction, targetPos, towerPos);
        direction.normalize();

        // 应用避障逻辑
        const finalDirection = this.calculateAvoidanceDirection(towerPos, direction, deltaTime);

        // 计算移动距离
        const moveDistance = this.moveSpeed * deltaTime;
        const newPos = new Vec3();
        Vec3.scaleAndAdd(newPos, towerPos, finalDirection, moveDistance);

        // 检查新位置是否有碰撞，并调整
        const adjustedPos = this.checkCollisionAndAdjust(towerPos, newPos);

        // 更新位置
        this.node.setWorldPosition(adjustedPos);

        // 根据移动方向翻转防御塔
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
            // 血条正常朝向
            if (this.healthBarNode && this.healthBarNode.isValid) {
                this.healthBarNode.setScale(1, 1, 1);
            }
        }

        // 播放移动动画
        if (!this.isMoving) {
            this.isMoving = true;
            this.playMoveAnimation();
        }
    }

    findTarget() {
        console.log('Hunter: findTarget called');
        // 使用递归查找Enemies容器（更可靠）
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
        
        const scene = this.node.scene;
        let enemiesNode = find('Enemies');
        
        // 如果直接查找失败，尝试递归查找
        if (!enemiesNode && scene) {
            enemiesNode = findNodeRecursive(scene, 'Enemies');
        }
        
        if (!enemiesNode) {
            console.log('Hunter: Enemies node not found');
            this.currentTarget = null!;
            return;
        }
        
        console.log('Hunter: Found Enemies node with', enemiesNode.children.length, 'children');
        const enemies = enemiesNode.children || [];
        let nearestEnemy: Node = null!;
        let minDistance = Infinity;
        const detectionRange = this.attackRange * 2; // 2倍攻击范围用于检测

        for (const enemy of enemies) {
            if (enemy && enemy.active && enemy.isValid) {
                console.log('Hunter: Checking enemy', enemy.name, 'at position', enemy.worldPosition);
                // 获取敌人脚本，支持Enemy和OrcWarrior
                const enemyScript = enemy.getComponent('Enemy') as any || enemy.getComponent('OrcWarrior') as any;
                console.log('Hunter: Enemy script found:', !!enemyScript);
                // 检查敌人是否存活
                if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, enemy.worldPosition);
                    console.log('Hunter: Enemy', enemy.name, 'is alive, distance:', distance, 'detectionRange:', detectionRange);
                    // 在2倍攻击范围内，选择最近的敌人
                    if (distance <= detectionRange && distance < minDistance) {
                        console.log('Hunter: Setting', enemy.name, 'as nearest enemy, distance:', distance);
                        minDistance = distance;
                        nearestEnemy = enemy;
                    }
                } else {
                    console.log('Hunter: Enemy', enemy.name, 'is not alive or has no valid script');
                }
            }
        }

        if (nearestEnemy) {
            console.log('Hunter: Found nearest enemy:', nearestEnemy.name, 'at distance:', minDistance);
        } else {
            console.log('Hunter: No enemy found in range');
        }
        this.currentTarget = nearestEnemy;
    }

    moveTowardsTarget(deltaTime: number) {
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active || this.isDestroyed) {
            this.stopMoving();
            return;
        }

        // 检查目标是否仍然存活，支持Enemy和OrcWarrior
        const enemyScript = this.currentTarget.getComponent('Enemy') as any || this.currentTarget.getComponent('OrcWarrior') as any;
        if (!enemyScript || !enemyScript.isAlive || !enemyScript.isAlive()) {
            this.stopMoving();
            return;
        }

        const towerPos = this.node.worldPosition.clone(); // 使用clone确保获取最新位置
        const targetPos = this.currentTarget.worldPosition;
        const distance = Vec3.distance(towerPos, targetPos);
        
        // 如果已经在攻击范围内，停止移动
        if (distance <= this.attackRange) {
            this.stopMoving();
            return;
        }

        // 首先检查当前位置是否有碰撞，如果有，先推开
        const hasCollision = this.checkCollisionAtPosition(towerPos);
        
        if (hasCollision) {
            // 当前位置有碰撞，先推开
            const pushDirection = this.calculatePushAwayDirection(towerPos);
            if (pushDirection.length() > 0.1) {
                const pushDistance = this.moveSpeed * deltaTime * 1.5; // 推开速度更快
                const pushPos = new Vec3();
                Vec3.scaleAndAdd(pushPos, towerPos, pushDirection, pushDistance);
                
                // 确保推开后的位置没有碰撞
                const finalPushPos = this.checkCollisionAndAdjust(towerPos, pushPos);
                this.node.setWorldPosition(finalPushPos);
                
                return; // 先推开，下一帧再移动
            }
        }

        // 计算移动方向
        const direction = new Vec3();
        Vec3.subtract(direction, targetPos, towerPos);
        direction.normalize();

        // 应用避障逻辑（增强避障权重）
        const finalDirection = this.calculateAvoidanceDirection(towerPos, direction, deltaTime);

        // 计算移动距离
        const moveDistance = this.moveSpeed * deltaTime;
        const newPos = new Vec3();
        Vec3.scaleAndAdd(newPos, towerPos, finalDirection, moveDistance);

        // 检查新位置是否有碰撞，并调整
        const adjustedPos = this.checkCollisionAndAdjust(towerPos, newPos);

        // 更新位置
        this.node.setWorldPosition(adjustedPos);

        // 更新血条位置（血条是子节点，会自动跟随，但需要确保位置正确）
        if (this.healthBarNode && this.healthBarNode.isValid) {
            // 血条位置已经在createHealthBar中设置为相对位置，会自动跟随
        }

        // 根据移动方向翻转防御塔
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
            // 血条正常朝向
            if (this.healthBarNode && this.healthBarNode.isValid) {
                this.healthBarNode.setScale(1, 1, 1);
            }
        }

        // 播放移动动画
        if (!this.isMoving) {
            this.isMoving = true;
            this.playMoveAnimation();
        }
    }

    stopMoving() {
        if (this.isMoving) {
            this.isMoving = false;
            this.stopMoveAnimation();
        }
    }

    playMoveAnimation() {
        // 如果正在播放移动动画，不重复播放
        if (this.isPlayingMoveAnimation) {
            return;
        }

        // 如果没有移动动画帧，使用默认SpriteFrame
        if (!this.moveAnimationFrames || this.moveAnimationFrames.length === 0) {
            return;
        }

        if (!this.sprite) {
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
            this.sprite.spriteFrame = frames[0];
            lastFrameIndex = 0;
        }

        // 使用update方法逐帧播放
        const animationUpdate = (deltaTime: number) => {
            if (!this.isMoving || !this.sprite || !this.sprite.isValid || this.isDestroyed) {
                this.isPlayingMoveAnimation = false;
                this.unschedule(animationUpdate);
                // 恢复默认SpriteFrame
                if (this.sprite && this.sprite.isValid && this.defaultSpriteFrame) {
                    this.sprite.spriteFrame = this.defaultSpriteFrame;
                }
                return;
            }

            animationTimer += deltaTime;

            // 循环播放动画
            const targetFrameIndex = Math.floor(animationTimer / frameDuration) % frameCount;

            if (targetFrameIndex !== lastFrameIndex && frames[targetFrameIndex]) {
                this.sprite.spriteFrame = frames[targetFrameIndex];
                lastFrameIndex = targetFrameIndex;
            }
        };

        // 开始动画更新
        this.schedule(animationUpdate, 0);
    }

    stopMoveAnimation() {
        this.isPlayingMoveAnimation = false;
        // 恢复默认SpriteFrame
        if (this.sprite && this.sprite.isValid && this.defaultSpriteFrame) {
            this.sprite.spriteFrame = this.defaultSpriteFrame;
        }
    }

    /**
     * 检查位置是否有碰撞
     * @param position 要检查的位置
     * @returns 如果有碰撞返回true
     */
    checkCollisionAtPosition(position: Vec3): boolean {
        // 检查与水晶的碰撞
        const crystal = find('Crystal');
        if (!crystal) {
            // 尝试递归查找
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
            const scene = this.node.scene;
            if (scene) {
                const foundCrystal = findNodeRecursive(scene, 'Crystal');
                if (foundCrystal && foundCrystal.isValid && foundCrystal.active) {
                    const crystalDistance = Vec3.distance(position, foundCrystal.worldPosition);
                    const crystalRadius = 50;
                    const minDistance = this.collisionRadius + crystalRadius;
                    if (crystalDistance < minDistance) {
                        return true;
                    }
                }
            }
        } else if (crystal && crystal.isValid && crystal.active) {
            const crystalDistance = Vec3.distance(position, crystal.worldPosition);
            const crystalRadius = 50; // 增大水晶半径，确保不会太近
            const minDistance = this.collisionRadius + crystalRadius;
            if (crystalDistance < minDistance) {
                return true;
            }
        }

        // 检查与其他女猎手的碰撞
        const scene = this.node.scene;
        if (scene) {
            // 递归查找所有女猎手节点
            const findAllHunters = (node: Node) => {
                // 检查当前节点是否是女猎手
                const hunterScript = node.getComponent('Hunter') as any;
                if (hunterScript && node !== this.node && node.isValid && node.active) {
                    const towerDistance = Vec3.distance(position, node.worldPosition);
                    // 获取另一个女猎手的碰撞半径（如果有）
                    const otherRadius = hunterScript.collisionRadius ? hunterScript.collisionRadius : this.collisionRadius;
                    const minDistance = (this.collisionRadius + otherRadius) * 1.2; // 增加20%的安全距离
                    
                    if (towerDistance < minDistance) {
                        return true;
                    }
                }
                
                // 递归检查子节点
                for (const child of node.children) {
                    if (findAllHunters(child)) {
                        return true;
                    }
                }
                
                return false;
            };
            
            if (findAllHunters(scene)) {
                return true;
            }
        }

        // 检查与敌人的碰撞
        const enemiesNode = find('Enemies');
        if (enemiesNode) {
            const enemies = enemiesNode.children || [];
            for (const enemy of enemies) {
                if (enemy && enemy.isValid && enemy.active) {
                    // 获取敌人脚本，支持Enemy和OrcWarrior
                    const enemyScript = enemy.getComponent('Enemy') as any || enemy.getComponent('OrcWarrior') as any;
                    if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
                        const enemyDistance = Vec3.distance(position, enemy.worldPosition);
                        const enemyRadius = 30; // 增大敌人半径
                        const minDistance = this.collisionRadius + enemyRadius;
                        if (enemyDistance < minDistance) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    /**
     * 检查碰撞并调整位置
     * @param currentPos 当前位置
     * @param newPos 新位置
     * @returns 调整后的位置
     */
    checkCollisionAndAdjust(currentPos: Vec3, newPos: Vec3): Vec3 {
        // 如果新位置没有碰撞，直接返回
        if (!this.checkCollisionAtPosition(newPos)) {
            return newPos;
        }

        // 如果有碰撞，尝试寻找替代路径
        const direction = new Vec3();
        Vec3.subtract(direction, newPos, currentPos);
        const moveDistance = Vec3.distance(currentPos, newPos);
        
        if (moveDistance < 0.1) {
            // 移动距离太小，尝试推开
            const pushDir = this.calculatePushAwayDirection(currentPos);
            if (pushDir.length() > 0.1) {
                const pushPos = new Vec3();
                Vec3.scaleAndAdd(pushPos, currentPos, pushDir, this.collisionRadius * 0.5);
                if (!this.checkCollisionAtPosition(pushPos)) {
                    return pushPos;
                }
            }
            return currentPos;
        }

        direction.normalize();

        // 尝试多个角度偏移（更密集的角度）
        const offsetAngles = [-30, 30, -60, 60, -90, 90, -120, 120, -150, 150, 180]; // 尝试更多角度
        for (const angle of offsetAngles) {
            const rad = angle * Math.PI / 180;
            const offsetDir = new Vec3(
                direction.x * Math.cos(rad) - direction.y * Math.sin(rad),
                direction.x * Math.sin(rad) + direction.y * Math.cos(rad),
                0
            );
            offsetDir.normalize();

            // 尝试不同距离
            for (let distMultiplier = 1.0; distMultiplier >= 0.3; distMultiplier -= 0.2) {
                const testPos = new Vec3();
                Vec3.scaleAndAdd(testPos, currentPos, offsetDir, moveDistance * distMultiplier);

                if (!this.checkCollisionAtPosition(testPos)) {
                    return testPos;
                }
            }
        }

        // 如果所有方向都有碰撞，尝试推开
        const pushDir = this.calculatePushAwayDirection(currentPos);
        if (pushDir.length() > 0.1) {
            const pushPos = new Vec3();
            Vec3.scaleAndAdd(pushPos, currentPos, pushDir, this.collisionRadius * 0.3);
            if (!this.checkCollisionAtPosition(pushPos)) {
                return pushPos;
            }
        }

        // 如果所有方法都失败，保持当前位置
        return currentPos;
    }

    /**
     * 计算推开方向（当当前位置有碰撞时使用）
     * @param currentPos 当前位置
     * @returns 推开方向
     */
    calculatePushAwayDirection(currentPos: Vec3): Vec3 {
        const pushForce = new Vec3(0, 0, 0);
        let obstacleCount = 0;
        let maxPushStrength = 0;

        // 检查水晶
        const crystal = find('Crystal');
        if (crystal && crystal.isValid && crystal.active) {
            const crystalPos = crystal.worldPosition;
            const distance = Vec3.distance(currentPos, crystalPos);
            const crystalRadius = 50;
            const minDistance = this.collisionRadius + crystalRadius;
            if (distance < minDistance && distance > 0.1) {
                    const pushDir = new Vec3();
                    Vec3.subtract(pushDir, currentPos, crystalPos);
                    pushDir.normalize();
                    // 增强推力，确保能推开
                    const strength = Math.max(1.0, (minDistance - distance) / minDistance * 2.0);
                    Vec3.scaleAndAdd(pushForce, pushForce, pushDir, strength);
                    maxPushStrength = Math.max(maxPushStrength, strength);
                    obstacleCount++;
                }
        }

        // 检查其他防御塔
        const towersNode = find('Hunter');
        if (towersNode) {
            const towers = towersNode.children || [];
            for (const tower of towers) {
                if (tower && tower.isValid && tower.active && tower !== this.node) {
                    const towerPos = tower.worldPosition;
                    const distance = Vec3.distance(currentPos, towerPos);
                    // 获取另一个防御塔的碰撞半径
                    const otherTowerScript = tower.getComponent('Hunter') as any;
                    const otherRadius = otherTowerScript && otherTowerScript.collisionRadius ? otherTowerScript.collisionRadius : this.collisionRadius;
                    const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                    if (distance < minDistance && distance > 0.1) {
                    const pushDir = new Vec3();
                    Vec3.subtract(pushDir, currentPos, towerPos);
                    pushDir.normalize();
                    // 增强推力，重叠越多推力越大
                    const strength = Math.max(2.0, (minDistance - distance) / minDistance * 3.0);
                    Vec3.scaleAndAdd(pushForce, pushForce, pushDir, strength);
                    maxPushStrength = Math.max(maxPushStrength, strength);
                    obstacleCount++;
                }
                }
            }
        }

        // 检查敌人
        const enemiesNode = find('Enemies');
        if (enemiesNode) {
            const enemies = enemiesNode.children || [];
            for (const enemy of enemies) {
                if (enemy && enemy.isValid && enemy.active) {
                    // 获取敌人脚本，支持Enemy和OrcWarrior
                    const enemyScript = enemy.getComponent('Enemy') as any || enemy.getComponent('OrcWarrior') as any;
                    if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
                        const enemyPos = enemy.worldPosition;
                        const distance = Vec3.distance(currentPos, enemyPos);
                        const enemyRadius = 30;
                        const minDistance = this.collisionRadius + enemyRadius;
                        if (distance < minDistance && distance > 0.1) {
                            const pushDir = new Vec3();
                            Vec3.subtract(pushDir, currentPos, enemyPos);
                            pushDir.normalize();
                            const strength = Math.max(1.0, (minDistance - distance) / minDistance * 2.0);
                            Vec3.scaleAndAdd(pushForce, pushForce, pushDir, strength);
                            maxPushStrength = Math.max(maxPushStrength, strength);
                            obstacleCount++;
                        }
                    }
                }
            }
        }

        if (obstacleCount > 0 && pushForce.length() > 0.1) {
            pushForce.normalize();
            // 根据推力强度调整最终推力
            const finalPushForce = new Vec3();
            Vec3.multiplyScalar(finalPushForce, pushForce, Math.min(maxPushStrength, 2.0));
            return finalPushForce;
        }

        return new Vec3(0, 0, 0);
    }

    /**
     * 计算避障方向
     * @param currentPos 当前位置
     * @param desiredDirection 期望移动方向
     * @param deltaTime 时间增量
     * @returns 调整后的移动方向
     */
    calculateAvoidanceDirection(currentPos: Vec3, desiredDirection: Vec3, deltaTime: number): Vec3 {
        const avoidanceForce = new Vec3(0, 0, 0);
        let obstacleCount = 0;
        let maxStrength = 0;

        // 检测附近的障碍物并计算避障力
        const detectionRange = this.collisionRadius * 4; // 增大检测范围

        // 检查水晶
        const crystal = find('Crystal');
        if (crystal && crystal.isValid && crystal.active) {
            const crystalPos = crystal.worldPosition;
            const distance = Vec3.distance(currentPos, crystalPos);
            const crystalRadius = 40;
            const minDistance = this.collisionRadius + crystalRadius;
            if (distance < detectionRange && distance > 0.1) {
                const avoidDir = new Vec3();
                Vec3.subtract(avoidDir, currentPos, crystalPos);
                avoidDir.normalize();
                // 距离越近，避障力越强
                let strength = 1 - (distance / detectionRange);
                // 如果已经在碰撞范围内，大幅增强避障力
                if (distance < minDistance) {
                    strength = 2.0; // 强制避障
                }
                Vec3.scaleAndAdd(avoidanceForce, avoidanceForce, avoidDir, strength);
                maxStrength = Math.max(maxStrength, strength);
                obstacleCount++;
            }
        }

        // 检查其他女猎手
        const scene = this.node.scene;
        if (scene) {
            // 递归查找所有女猎手节点
            const findAllHunters = (node: Node) => {
                // 检查当前节点是否是女猎手
                const hunterScript = node.getComponent('Hunter') as any;
                if (hunterScript && node !== this.node && node.isValid && node.active) {
                    const towerPos = node.worldPosition;
                    const distance = Vec3.distance(currentPos, towerPos);
                    // 获取另一个女猎手的碰撞半径
                    const otherRadius = hunterScript.collisionRadius ? hunterScript.collisionRadius : this.collisionRadius;
                    const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                    if (distance < detectionRange && distance > 0.1) {
                        const avoidDir = new Vec3();
                        Vec3.subtract(avoidDir, currentPos, towerPos);
                        avoidDir.normalize();
                        let strength = 1 - (distance / detectionRange);
                        if (distance < minDistance) {
                            strength = 3.0; // 大幅增强避障力
                        }
                        Vec3.scaleAndAdd(avoidanceForce, avoidanceForce, avoidDir, strength);
                        maxStrength = Math.max(maxStrength, strength);
                        obstacleCount++;
                    }
                }
                
                // 递归检查子节点
                for (const child of node.children) {
                    findAllHunters(child);
                }
            };
            
            findAllHunters(scene);
        }

        // 检查敌人
        const enemiesNode = find('Enemies');
        if (enemiesNode) {
            const enemies = enemiesNode.children || [];
            for (const enemy of enemies) {
                if (enemy && enemy.isValid && enemy.active) {
                    // 获取敌人脚本，支持Enemy和OrcWarrior
                    const enemyScript = enemy.getComponent('Enemy') as any || enemy.getComponent('OrcWarrior') as any;
                    if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
                        const enemyPos = enemy.worldPosition;
                        const distance = Vec3.distance(currentPos, enemyPos);
                        const enemyRadius = 25;
                        const minDistance = this.collisionRadius + enemyRadius;
                        if (distance < detectionRange && distance > 0.1) {
                            const avoidDir = new Vec3();
                            Vec3.subtract(avoidDir, currentPos, enemyPos);
                            avoidDir.normalize();
                            let strength = 1 - (distance / detectionRange);
                            if (distance < minDistance) {
                                strength = 2.0;
                            }
                            Vec3.scaleAndAdd(avoidanceForce, avoidanceForce, avoidDir, strength);
                            maxStrength = Math.max(maxStrength, strength);
                            obstacleCount++;
                        }
                    }
                }
            }
        }

        // 如果有障碍物，应用避障力
        if (obstacleCount > 0 && avoidanceForce.length() > 0.1) {
            avoidanceForce.normalize();
            // 根据障碍物强度调整混合比例
            // 如果障碍物很近（maxStrength > 1），优先避障
            const avoidanceWeight = maxStrength > 2.0 ? 0.9 : (maxStrength > 1.0 ? 0.7 : 0.5); // 50%-90%避障
            const finalDir = new Vec3();
            Vec3.lerp(finalDir, desiredDirection, avoidanceForce, avoidanceWeight);
            finalDir.normalize();
            

            
            return finalDir;
        }

        // 没有障碍物，返回期望方向
        return desiredDirection;
    }

    attack() {
        console.log('Hunter: attack called, currentTarget:', this.currentTarget ? this.currentTarget.name : 'null');
        if (!this.currentTarget || this.isDestroyed) {
            console.log('Hunter: attack aborted - no target or destroyed');
            return;
        }

        // 再次检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            console.log('Hunter: attack aborted - target invalid or inactive');
            this.currentTarget = null!;
            return;
        }

        // 攻击时停止移动
        this.stopMoving();

        // 获取敌人脚本，支持Enemy和OrcWarrior
        const enemyScript = this.currentTarget.getComponent('Enemy') as any || this.currentTarget.getComponent('OrcWarrior') as any;
        console.log('Hunter: attack - enemyScript found:', !!enemyScript);
        if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
            console.log('Hunter: attack - enemy is alive, playing attack animation');
            // 播放攻击动画，动画完成后才射出弓箭
            this.playAttackAnimation(() => {
                console.log('Hunter: attack animation completed, executing attack');
                // 动画播放完成后的回调，在这里创建弓箭
                this.executeAttack();
            });
        } else {
            console.log('Hunter: attack aborted - enemy not alive');
            // 目标已死亡，清除目标
            this.currentTarget = null!;
        }
    }

    executeAttack() {
        // 再次检查目标是否有效
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active || this.isDestroyed) {
            return;
        }

        // 获取敌人脚本，支持Enemy和OrcWarrior
        const enemyScript = this.currentTarget.getComponent('Enemy') as any || this.currentTarget.getComponent('OrcWarrior') as any;
        if (!enemyScript || !enemyScript.isAlive || !enemyScript.isAlive()) {
            this.currentTarget = null!;
            return;
        }

        // 创建回旋镖特效（抛物线轨迹）
        if (this.arrowPrefab) {
            this.createBoomerang();
        } else if (this.bulletPrefab) {
            // 如果没有回旋镖预制体，使用旧的子弹系统
            this.createBullet();
        } else {
            // 直接伤害（无特效）
            if (enemyScript.takeDamage) {
                enemyScript.takeDamage(this.attackDamage);
            }
        }
    }

    playAttackAnimation(onComplete?: () => void) {
        // 如果正在播放动画，不重复播放
        if (this.isPlayingAttackAnimation) {
            return;
        }

        // 如果没有Sprite组件或没有动画帧，直接返回
        if (!this.sprite) {
            return;
        }

        // 如果没有设置动画帧，直接返回
        if (!this.attackAnimationFrames || this.attackAnimationFrames.length === 0) {
            return;
        }

        // 检查帧是否有效
        const validFrames = this.attackAnimationFrames.filter(frame => frame != null);
        if (validFrames.length === 0) {
            return;
        }

        // 根据敌人位置决定是否翻转
        let shouldFlip = false;
        if (this.currentTarget && this.currentTarget.isValid) {
            const towerPos = this.node.worldPosition;
            const enemyPos = this.currentTarget.worldPosition;
            // 如果敌人在左侧（敌人x < 防御塔x），需要翻转
            shouldFlip = enemyPos.x < towerPos.x;
            
            if (shouldFlip) {
                // 水平翻转：scale.x = -1
                this.node.setScale(-Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
                // 血条需要反向翻转，保持正常朝向
                if (this.healthBarNode && this.healthBarNode.isValid) {
                    const healthBarScale = this.healthBarNode.scale.clone();
                    this.healthBarNode.setScale(-Math.abs(healthBarScale.x), healthBarScale.y, healthBarScale.z);
                }
            } else {
                // 保持原样：scale.x = 1
                this.node.setScale(Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
                // 血条保持正常朝向
                if (this.healthBarNode && this.healthBarNode.isValid) {
                    const healthBarScale = this.healthBarNode.scale.clone();
                    this.healthBarNode.setScale(Math.abs(healthBarScale.x), healthBarScale.y, healthBarScale.z);
                }
            }
        }

        // 标记正在播放动画
        this.isPlayingAttackAnimation = true;

        const frames = validFrames;
        const frameCount = frames.length;
        const frameDuration = this.attackAnimationDuration / frameCount; // 每帧的时长

        // 使用update方法播放动画（更可靠）
        let animationTimer = 0;
        let lastFrameIndex = -1; // 记录上一帧的索引，避免重复设置
        
        // 立即播放第一帧
        if (frames[0]) {
            this.sprite.spriteFrame = frames[0];
            lastFrameIndex = 0;
        }
        
        // 使用update方法逐帧播放
        const animationUpdate = (deltaTime: number) => {
            if (!this.sprite || !this.sprite.isValid || this.isDestroyed) {
                this.isPlayingAttackAnimation = false;
                this.unschedule(animationUpdate);
                return;
            }

            animationTimer += deltaTime;
            
            // 计算当前应该显示的帧索引
            const targetFrameIndex = Math.min(Math.floor(animationTimer / frameDuration), frameCount - 1);
            
            // 检查动画是否完成
            if (animationTimer >= this.attackAnimationDuration) {
                // 确保播放最后一帧
                if (lastFrameIndex < frameCount - 1 && frames[frameCount - 1]) {
                    this.sprite.spriteFrame = frames[frameCount - 1];
                }
                // 动画播放完成，恢复默认SpriteFrame
                this.restoreDefaultSprite();
                this.unschedule(animationUpdate);
                
                // 调用完成回调（在恢复默认SpriteFrame之后）
                if (onComplete) {
                    onComplete();
                }
                return;
            }
            
            // 更新到当前帧（只在帧变化时更新）
            if (targetFrameIndex !== lastFrameIndex && targetFrameIndex < frameCount && frames[targetFrameIndex]) {
                this.sprite.spriteFrame = frames[targetFrameIndex];
                lastFrameIndex = targetFrameIndex;
            }
        };
        
        // 开始动画更新（每帧更新）
        this.schedule(animationUpdate, 0);
    }

    restoreDefaultSprite() {
        // 恢复默认SpriteFrame
        if (this.sprite && this.sprite.isValid && this.defaultSpriteFrame) {
            this.sprite.spriteFrame = this.defaultSpriteFrame;
        }
        // 恢复血条的正常朝向
        if (this.healthBarNode && this.healthBarNode.isValid) {
            this.healthBarNode.setScale(1, 1, 1);
        }
        this.isPlayingAttackAnimation = false;
        
        // 如果正在移动，恢复移动动画
        if (this.isMoving) {
            this.playMoveAnimation();
        }
    }

    createLaserEffect(targetPos: Vec3) {
        // 创建激光效果节点
        const laserNode = new Node('Laser');
        
        // 将激光节点添加到Canvas或场景根节点，确保在最上层显示
        const canvas = find('Canvas');
        if (canvas) {
            laserNode.setParent(canvas);
            // 如果添加到Canvas，需要UITransform组件
            const uiTransform = laserNode.addComponent(UITransform);
            if (uiTransform) {
                // 设置足够大的内容区域，确保激光线不会被裁剪
                uiTransform.setContentSize(2000, 2000);
            }
        } else {
            const scene = this.node.scene;
            if (scene) {
                laserNode.setParent(scene);
            } else {
                laserNode.setParent(this.node.parent);
            }
        }
        
        // 设置激光节点的世界位置为防御塔位置
        laserNode.setWorldPosition(this.node.worldPosition);
        
        // 添加Graphics组件用于绘制激光
        const graphics = laserNode.addComponent(Graphics);
        if (graphics) {
            // 设置激光颜色为亮红色，更醒目
            graphics.strokeColor.set(255, 0, 0, 255); // 纯红色，更明显
            graphics.lineWidth = 6; // 加粗，更容易看到
            
            // 计算起点和终点（本地坐标）
            const fromPos = new Vec3(0, 0, 0); // 本地坐标原点
            const toPos = new Vec3();
            // 将目标位置转换为激光节点的本地坐标
            Vec3.subtract(toPos, targetPos, laserNode.worldPosition);
            
            // 绘制激光线
            graphics.moveTo(fromPos.x, fromPos.y);
            graphics.lineTo(toPos.x, toPos.y);
            graphics.stroke();
            
            // 添加渐隐效果
            const startAlpha = 255;
            const fadeDuration = 0.2; // 稍微延长显示时间
            const fadeTimer = 0.02; // 每帧更新间隔
            
            let elapsed = 0;
            const fadeUpdate = () => {
                elapsed += fadeTimer;
                if (elapsed < fadeDuration && laserNode && laserNode.isValid && graphics) {
                    const alpha = Math.floor(startAlpha * (1 - elapsed / fadeDuration));
                    // Color对象的属性是只读的，需要clone后修改
                    const fadeColor = graphics.strokeColor.clone();
                    fadeColor.a = alpha;
                    graphics.strokeColor = fadeColor;
                    graphics.clear();
                    graphics.moveTo(fromPos.x, fromPos.y);
                    graphics.lineTo(toPos.x, toPos.y);
                    graphics.stroke();
                    this.scheduleOnce(fadeUpdate, fadeTimer);
                } else {
                    // 渐隐完成，销毁节点
                    if (laserNode && laserNode.isValid) {
                        laserNode.destroy();
                    }
                }
            };
            
            // 开始渐隐
            this.scheduleOnce(fadeUpdate, fadeTimer);
            
            // 备用：如果渐隐失败，0.3秒后强制销毁
            this.scheduleOnce(() => {
                if (laserNode && laserNode.isValid) {
                    laserNode.destroy();
                }
            }, 0.3);
        }
    }

    createBoomerang() {
        if (!this.arrowPrefab || !this.currentTarget) {
            return;
        }

        // 检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            return;
        }

        // 创建回旋镖节点
        const boomerang = instantiate(this.arrowPrefab);
        
        // 设置父节点（添加到场景或Canvas）
        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            boomerang.setParent(parentNode);
        } else {
            boomerang.setParent(this.node.parent);
        }

        // 设置初始位置（女猎手位置）
        const startPos = this.node.worldPosition.clone();
        boomerang.setWorldPosition(startPos);

        // 确保节点激活
        boomerang.active = true;

        // 获取或添加Boomerang组件
        let boomerangScript = boomerang.getComponent(Boomerang);
        if (!boomerangScript) {
            boomerangScript = boomerang.addComponent(Boomerang);
        }

        // 播放回旋镖射出音效
        if (this.shootSound && AudioManager.Instance) {
            AudioManager.Instance.playSFX(this.shootSound);
        }

        // 保存当前目标的引用，避免回调函数中引用失效的目标
        const targetNode = this.currentTarget;
        
        // 初始化回旋镖，设置命中回调
        boomerangScript.init(
            startPos,
            targetNode,
            this.attackDamage,
            (damage: number) => {
                // 播放回旋镖击中音效
                if (this.hitSound) {
                    AudioManager.Instance?.playSFX(this.hitSound);
                }
                
                // 检查目标是否仍然有效
                if (targetNode && targetNode.isValid && targetNode.active) {
                    // 支持Enemy和OrcWarrior
                    const enemyScript = targetNode.getComponent('Enemy') as any || targetNode.getComponent('OrcWarrior') as any;
                    if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
                        if (enemyScript.takeDamage) {
                            enemyScript.takeDamage(damage);
                        }
                    }
                }
            },
            this.node // 传递女猎手节点作为ownerNode，用于回旋镖返回
        );
    }

    createBullet() {
        if (!this.bulletPrefab || !this.currentTarget) {
            return;
        }

        const bullet = instantiate(this.bulletPrefab);
        bullet.setParent(this.node.parent);
        bullet.setWorldPosition(this.node.worldPosition);

        // 简单的子弹移动逻辑（可以创建Bullet脚本）
        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        direction.normalize();

        // 直接造成伤害（简化处理）
        const enemyScript = this.currentTarget.getComponent('Enemy') as any;
        if (enemyScript && enemyScript.takeDamage) {
            enemyScript.takeDamage(this.attackDamage);
        }

        // 销毁子弹
        this.scheduleOnce(() => {
            if (bullet && bullet.isValid) {
                bullet.destroy();
            }
        }, 0.1);
    }

    takeDamage(damage: number) {
        if (this.isDestroyed) {
            return;
        }

        // 显示伤害数字
        this.showDamageNumber(damage);

        this.currentHealth -= damage;

        // 更新血条
        if (this.healthBar) {
            this.healthBar.setHealth(this.currentHealth);
        }

        // 更新单位信息面板
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                currentHealth: Math.max(0, this.currentHealth),
                maxHealth: this.maxHealth
            });
        }

        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.destroyTower();
        }
    }

    /**
     * 恢复血量（由月亮井调用）
     * @param amount 恢复的血量
     */
    heal(amount: number) {
        if (this.isDestroyed) {
            return;
        }

        // 如果血量已满，不恢复
        if (this.currentHealth >= this.maxHealth) {
            return;
        }

        const oldHealth = this.currentHealth;
        this.currentHealth = Math.min(this.currentHealth + amount, this.maxHealth);
        const actualHeal = this.currentHealth - oldHealth;

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

        // 显示治愈特效（+号）
        if (actualHeal > 0) {
            this.showHealEffect(actualHeal);
        }
    }

    /**
     * 显示治愈特效（+号）
     * @param amount 治愈量
     */
    showHealEffect(amount: number) {
        // 创建+号特效节点
        const healNode = new Node('HealEffect');
        const canvas = find('Canvas');
        if (canvas) {
            healNode.setParent(canvas);
        } else {
            healNode.setParent(this.node.scene);
        }

        // 设置位置（在Tower上方）
        healNode.setWorldPosition(this.node.worldPosition.clone().add3f(0, 30, 0));

        // 添加Label组件显示+号
        const label = healNode.addComponent(Label);
        label.string = `+${Math.floor(amount)}`;
        label.fontSize = 20;
        label.color = Color.GREEN;

        // 添加UITransform
        const uiTransform = healNode.addComponent(UITransform);
        uiTransform.setContentSize(40, 30);

        // 动画：向上移动并淡出
        const startPos = healNode.worldPosition.clone();
        const endPos = startPos.clone();
        endPos.y += 30; // 向上移动30像素

        tween(healNode)
            .to(0.5, { 
                worldPosition: endPos,
            }, {
                onUpdate: (target: Node, ratio: number) => {
                    // 淡出效果
                    const label = target.getComponent(Label);
                    if (label) {
                        const alpha = Math.floor(255 * (1 - ratio));
                        label.color = new Color(0, 255, 0, alpha);
                    }
                }
            })
            .call(() => {
                if (healNode && healNode.isValid) {
                    healNode.destroy();
                }
            })
            .start();
    }

    showDamageNumber(damage: number) {
        // 创建伤害数字节点
        let damageNode: Node;
        if (this.damageNumberPrefab) {
            damageNode = instantiate(this.damageNumberPrefab);
        } else {
            // 如果没有预制体，创建简单的Label节点
            damageNode = new Node('DamageNumber');
            const label = damageNode.addComponent(Label);
            label.string = `-${Math.floor(damage)}`;
            label.fontSize = 20;
            label.color = Color.WHITE;
        }
        
        // 添加到Canvas或场景
        const canvas = find('Canvas');
        if (canvas) {
            damageNode.setParent(canvas);
        } else {
            damageNode.setParent(this.node.scene);
        }
        
        // 设置位置（在防御塔上方）
        damageNode.setWorldPosition(this.node.worldPosition.clone().add3f(0, 30, 0));
        
        // 如果有DamageNumber组件，设置伤害值
        const damageScript = damageNode.getComponent(DamageNumber);
        if (damageScript) {
            damageScript.setDamage(damage);
        } else {
            // 如果没有组件，手动添加动画
            const label = damageNode.getComponent(Label);
            if (label) {
                const startPos = damageNode.position.clone();
                const endPos = startPos.clone();
                endPos.y += 50;
                
                tween(damageNode)
                    .to(1.0, { position: endPos })
                    .parallel(
                        tween().to(1.0, {}, {
                            onUpdate: (target, ratio) => {
                                const color = label.color.clone();
                                color.a = 255 * (1 - ratio);
                                label.color = color;
                            }
                        })
                    )
                    .call(() => {
                        if (damageNode && damageNode.isValid) {
                            damageNode.destroy();
                        }
                    })
                    .start();
            }
        }
    }

    destroyTower() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;

        // 减少人口
        // 如果buildCost为0，说明是战争古树生产的，人口会在WarAncientTree.cleanupDeadTowers中处理
        // 如果buildCost不为0，说明是手动建造的（如果有），需要在这里减少人口
        if (!this.gameManager) {
            this.findGameManager();
        }
        if (this.gameManager && this.buildCost !== 0) {
            // 这是手动建造的Tower（如果有），减少人口
            this.gameManager.removePopulation(1);
        }
        // 如果buildCost为0，人口会在WarAncientTree.cleanupDeadTowers中处理，这里不需要处理

        // 移除点击事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onTowerClick, this);

        // 隐藏选择面板（会移除全局触摸监听）
        this.hideSelectionPanel();
        
        // 清除手动移动目标
        this.manualMoveTarget = null!;
        this.isManuallyControlled = false;
        
        // 移除高亮效果
        this.removeHighlight();

        // 触发爆炸效果
        let explosionPrefab = this.explosionEffect;
        
        // 如果explosionEffect未设置，尝试从资源中加载
        if (!explosionPrefab) {
            console.warn('Hunter: explosionEffect prefab is not set, trying to load from resources...');
            // 尝试从resources/prefabs加载Explosion预制体
            resources.load('prefabs/Explosion', Prefab, (err, prefab) => {
                if (err) {
                    console.error('Hunter: Failed to load Explosion prefab from resources:', err);
                    return;
                }
                explosionPrefab = prefab;
                this.createExplosionEffect(explosionPrefab);
            });
            return;
        }
        
        this.createExplosionEffect(explosionPrefab);
    }

    private createExplosionEffect(explosionPrefab: Prefab) {
        if (!explosionPrefab) {
            console.error('Hunter: Cannot create explosion effect, prefab is null!');
            return;
        }

        console.debug('Hunter: Creating explosion effect at position:', this.node.worldPosition);
        const explosion = instantiate(explosionPrefab);
        
        // 确保节点激活
        explosion.active = true;
        
        // 先设置父节点和位置（使用场景根节点或Canvas，确保不会被防御塔销毁影响）
        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            explosion.setParent(parentNode);
            explosion.setWorldPosition(this.node.worldPosition);
            console.debug('Hunter: Explosion effect parent set, position:', explosion.worldPosition);
        } else {
            console.error('Hunter: Cannot find parent node for explosion effect!');
            explosion.destroy();
            return;
        }
        
        // 立即设置缩放为0，确保不会显示在屏幕中央
        explosion.setScale(0, 0, 1);
        
        // 检查ExplosionEffect组件是否存在
        const explosionScript = explosion.getComponent('ExplosionEffect');
        if (explosionScript) {
            console.debug('Hunter: ExplosionEffect component found, animation should start automatically');
        } else {
            console.warn('Hunter: ExplosionEffect component not found on explosion prefab!');
        }

        // 延迟销毁爆炸效果节点（动画完成后，ExplosionEffect会自动销毁，这里作为备用）
        this.scheduleOnce(() => {
            if (explosion && explosion.isValid) {
                console.debug('Hunter: Cleaning up explosion effect');
                explosion.destroy();
            }
        }, 2.0); // 延长到2秒，确保动画完成

        // 销毁血条节点
        if (this.healthBarNode && this.healthBarNode.isValid) {
            this.healthBarNode.destroy();
        }

        // 真正销毁防御塔节点
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }, 0.1); // 延迟一小段时间，确保爆炸效果已创建
    }

    getHealth(): number {
        return this.currentHealth;
    }

    isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }

    onTowerClick(event: EventTouch) {
        // 如果游戏已结束，不显示选择面板
        if (this.gameManager && this.gameManager.getGameState() !== GameState.Playing) {
            return;
        }

        // 阻止事件冒泡
        event.propagationStopped = true;

        // 如果已有选择面板，先关闭
        if (this.selectionPanel) {
            this.hideSelectionPanel();
            return;
        }

        // 显示选择面板和信息面板
        this.showSelectionPanel();
    }

    showSelectionPanel() {
        // 创建选择面板
        const canvas = find('Canvas');
        if (!canvas) return;

        this.selectionPanel = new Node('TowerSelectionPanel');
        this.selectionPanel.setParent(canvas);

        // 添加UITransform
        const uiTransform = this.selectionPanel.addComponent(UITransform);
        uiTransform.setContentSize(120, 40);

        // 设置位置（在防御塔上方）
        const worldPos = this.node.worldPosition.clone();
        worldPos.y += 50;
        this.selectionPanel.setWorldPosition(worldPos);

        // 添加半透明背景
        const graphics = this.selectionPanel.addComponent(Graphics);
        graphics.fillColor = new Color(0, 0, 0, 180); // 半透明黑色
        graphics.rect(-60, -20, 120, 40);
        graphics.fill();

        // 创建回收按钮
        const sellBtn = new Node('SellButton');
        sellBtn.setParent(this.selectionPanel);
        const sellBtnTransform = sellBtn.addComponent(UITransform);
        sellBtnTransform.setContentSize(50, 30);
        sellBtn.setPosition(-35, 0);

        const sellLabel = sellBtn.addComponent(Label);
        sellLabel.string = '回收';
        sellLabel.fontSize = 16;
        sellLabel.color = Color.WHITE;

        // 创建升级按钮
        const upgradeBtn = new Node('UpgradeButton');
        upgradeBtn.setParent(this.selectionPanel);
        const upgradeBtnTransform = upgradeBtn.addComponent(UITransform);
        upgradeBtnTransform.setContentSize(50, 30);
        upgradeBtn.setPosition(35, 0);

        const upgradeLabel = upgradeBtn.addComponent(Label);
        upgradeLabel.string = '升级';
        upgradeLabel.fontSize = 16;
        upgradeLabel.color = Color.WHITE;

        // 添加按钮点击事件
        sellBtn.on(Node.EventType.TOUCH_END, this.onSellClick, this);
        upgradeBtn.on(Node.EventType.TOUCH_END, this.onUpgradeClick, this);

        // 显示单位信息面板和范围
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (this.unitSelectionManager) {
            const unitInfo: UnitInfo = {
                name: '弓箭手',
                level: this.level,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth,
                attackDamage: this.attackDamage,
                populationCost: 1, // Tower占用1个人口
                icon: this.cardIcon || this.defaultSpriteFrame,
                collisionRadius: this.collisionRadius,
                attackRange: this.attackRange,
                attackFrequency: 1.0 / this.attackInterval, // 攻击频率（次/秒）
                moveSpeed: this.moveSpeed,
                onUpgradeClick: () => {
                    this.onUpgradeClick();
                },
                onSellClick: () => {
                    this.onSellClick();
                }
            };
            this.unitSelectionManager.selectUnit(this.node, unitInfo);
        }

        // 点击其他地方关闭面板或设置移动目标
        this.scheduleOnce(() => {
            if (canvas) {
                // 创建全局触摸事件处理器
                this.globalTouchHandler = (event: EventTouch) => {
                    // 检查点击是否在选择面板或其子节点上
                    if (this.selectionPanel && this.selectionPanel.isValid) {
                        const targetNode = event.target as Node;
                        if (targetNode) {
                            // 检查目标节点是否是选择面板或其子节点
                            let currentNode: Node | null = targetNode;
                            while (currentNode) {
                                if (currentNode === this.selectionPanel) {
                                    // 点击在选择面板上，不处理移动
                                    return;
                                }
                                currentNode = currentNode.parent;
                            }
                        }
                    }
                    
                    // 点击不在选择面板上，设置移动目标
                    this.setManualMoveTarget(event);
                };
                
                canvas.on(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
            }
        }, 0.1);
    }

    /**
     * 设置手动移动目标位置（用于多选移动）
     * @param worldPos 世界坐标位置
     */
    setManualMoveTargetPosition(worldPos: Vec3) {
        // 智能调整目标位置，避免与单位重叠
        const adjustedPos = this.findAvailableMovePosition(worldPos);
        
        // 设置手动移动目标
        this.manualMoveTarget = adjustedPos.clone();
        this.isManuallyControlled = true;
        
        // 清除当前自动寻敌目标，优先执行手动移动
        this.currentTarget = null!;
    }

    /**
     * 设置手动移动目标（用于单选移动）
     * @param event 触摸事件
     */
    setManualMoveTarget(event: EventTouch) {
        // 阻止事件冒泡，避免触发其他点击事件
        event.propagationStopped = true;
        
        // 获取触摸位置
        const touchLocation = event.getLocation();
        
        // 查找Camera节点
        const cameraNode = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
        if (!cameraNode) {
            console.error('Hunter: Camera node not found!');
            return;
        }
        
        const camera = cameraNode.getComponent(Camera);
        if (!camera) {
            console.error('Hunter: Camera component not found!');
            return;
        }
        
        // 将屏幕坐标转换为世界坐标
        const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
        const worldPos = new Vec3();
        camera.screenToWorld(screenPos, worldPos);
        worldPos.z = 0;
        
        // 使用setManualMoveTargetPosition方法设置移动目标
        this.setManualMoveTargetPosition(worldPos);
        
        // 隐藏选择面板（这会移除全局触摸监听，确保只有一次控制机会）
        this.hideSelectionPanel();
    }

    findAvailableMovePosition(initialPos: Vec3): Vec3 {
        const checkRadius = this.collisionRadius;
        const offsetStep = 40; // 每次平移的距离
        const maxAttempts = 5; // 最多尝试5次（左右各2次）

        // 检查初始位置是否可用
        if (!this.hasUnitAtMovePosition(initialPos, checkRadius)) {
            return initialPos;
        }

        // 尝试左右平移
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // 先尝试右侧
            const rightPos = new Vec3(initialPos.x + offsetStep * attempt, initialPos.y, initialPos.z);
            if (!this.hasUnitAtMovePosition(rightPos, checkRadius)) {
                return rightPos;
            }

            // 再尝试左侧
            const leftPos = new Vec3(initialPos.x - offsetStep * attempt, initialPos.y, initialPos.z);
            if (!this.hasUnitAtMovePosition(leftPos, checkRadius)) {
                return leftPos;
            }
        }

        // 如果所有位置都被占用，返回初始位置（让Tower自己处理碰撞）
        return initialPos;
    }

    hasUnitAtMovePosition(position: Vec3, radius: number): boolean {
        // 检查与水晶的碰撞
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

        const crystal = find('Crystal');
        if (!crystal && this.node.scene) {
            const scene = this.node.scene;
            const foundCrystal = findNodeRecursive(scene, 'Crystal');
            if (foundCrystal && foundCrystal.isValid && foundCrystal.active) {
                const distance = Vec3.distance(position, foundCrystal.worldPosition);
                const crystalRadius = 50;
                if (distance < radius + crystalRadius) {
                    return true;
                }
            }
        } else if (crystal && crystal.isValid && crystal.active) {
            const distance = Vec3.distance(position, crystal.worldPosition);
            const crystalRadius = 50;
            if (distance < radius + crystalRadius) {
                return true;
            }
        }

        // 检查与其他Hunter的碰撞
        let towersNode = find('Hunter');
        if (!towersNode && this.node.scene) {
            towersNode = findNodeRecursive(this.node.scene, 'Hunter');
        }
        
        if (towersNode) {
            const towers = towersNode.children || [];
            for (const tower of towers) {
                if (tower && tower.isValid && tower.active && tower !== this.node) {
                    const towerScript = tower.getComponent('Hunter') as any;
                    if (towerScript && towerScript.isAlive && towerScript.isAlive()) {
                        const distance = Vec3.distance(position, tower.worldPosition);
                        const otherRadius = towerScript.collisionRadius || radius;
                        if (distance < radius + otherRadius) {
                            return true;
                        }
                    }
                }
            }
        }

        // 检查与战争古树的碰撞
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
                        const distance = Vec3.distance(position, tree.worldPosition);
                        const treeRadius = 50; // 战争古树的半径
                        if (distance < radius + treeRadius) {
                            return true;
                        }
                    }
                }
            }
        }

        // 检查与敌人的碰撞
        let enemiesNode = find('Enemies');
        if (!enemiesNode && this.node.scene) {
            enemiesNode = findNodeRecursive(this.node.scene, 'Enemies');
        }
        
        if (enemiesNode) {
            const enemies = enemiesNode.children || [];
            for (const enemy of enemies) {
                if (enemy && enemy.isValid && enemy.active) {
                    const enemyScript = enemy.getComponent('Enemy') as any;
                    if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
                        const distance = Vec3.distance(position, enemy.worldPosition);
                        const enemyRadius = 30;
                        if (distance < radius + enemyRadius) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    hideSelectionPanel() {
        // 移除全局触摸事件监听
        if (this.globalTouchHandler) {
            const canvas = find('Canvas');
            if (canvas) {
                canvas.off(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
            }
            this.globalTouchHandler = null!;
        }
        
        if (this.selectionPanel && this.selectionPanel.isValid) {
            this.selectionPanel.destroy();
            this.selectionPanel = null!;
        }

        // 清除单位信息面板和范围显示
        if (this.unitSelectionManager) {
            // 检查是否当前选中的是这个单位
            if (this.unitSelectionManager.isUnitSelected(this.node)) {
                this.unitSelectionManager.clearSelection();
            }
        }
        
        // 注意：不清除手动移动目标，让防御单位继续移动到目标位置
        // 只有在到达目标位置后才会清除
    }

    onSellClick(event?: EventTouch) {
        if (event) {
            event.propagationStopped = true;
        }
        
        if (!this.gameManager) {
            this.findGameManager();
        }

        if (this.gameManager) {
            // 回收80%金币
            const refund = Math.floor(this.buildCost * 0.8);
            this.gameManager.addGold(refund);
        }

        // 隐藏面板
        this.hideSelectionPanel();
        
        // 销毁防御塔（会真正从场景中移除）
        this.destroyTower();
    }

    onUpgradeClick(event?: EventTouch) {
        if (event) {
            event.propagationStopped = true;
        }
        
        if (!this.gameManager) {
            this.findGameManager();
        }

        if (!this.gameManager) {
            return;
        }

        // 升级成本是建造成本的2倍
        const upgradeCost = this.buildCost * 2;
        
        if (!this.gameManager.canAfford(upgradeCost)) {
            return;
        }

        // 消耗金币
        this.gameManager.spendGold(upgradeCost);

        // 升级防御塔
        this.level++;
        this.attackDamage = Math.floor(this.attackDamage * 1.5); // 攻击力增加50%
        this.attackInterval = this.attackInterval / 1.5; // 攻击速度增加50%（间隔减少）

        // 更新单位信息面板
        if (this.unitSelectionManager && this.unitSelectionManager.isUnitSelected(this.node)) {
            this.unitSelectionManager.updateUnitInfo({
                level: this.level,
                attackDamage: this.attackDamage,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth,
                attackFrequency: 1.0 / this.attackInterval,
                moveSpeed: this.moveSpeed
            });
        }

        // 隐藏面板
        this.hideSelectionPanel();
    }

    /**
     * 设置高亮显示
     * @param highlight 是否高亮
     */
    setHighlight(highlight: boolean) {
        if (this.isHighlighted === highlight) {
            return; // 状态相同，不需要更新
        }

        this.isHighlighted = highlight;

        if (highlight) {
            // 创建高亮效果
            this.createHighlight();
        } else {
            // 移除高亮效果
            this.removeHighlight();
        }
    }

    /**
     * 创建高亮效果
     */
    createHighlight() {
        if (this.highlightNode && this.highlightNode.isValid) {
            return; // 已经存在高亮节点
        }

        // 创建高亮节点
        this.highlightNode = new Node('Highlight');
        this.highlightNode.setParent(this.node);
        this.highlightNode.setPosition(0, 0, 0);

        // 添加Graphics组件绘制高亮边框
        const graphics = this.highlightNode.addComponent(Graphics);
        graphics.strokeColor.set(100, 200, 255, 255); // 亮蓝色边框
        graphics.lineWidth = 3;

        // 绘制圆形高亮边框（根据防御单位的碰撞半径）
        const radius = this.collisionRadius + 5; // 稍微大一点
        graphics.circle(0, 0, radius);
        graphics.stroke();

        // 添加半透明填充
        graphics.fillColor.set(100, 200, 255, 50); // 半透明蓝色
        graphics.circle(0, 0, radius);
        graphics.fill();
    }

    /**
     * 移除高亮效果
     */
    removeHighlight() {
        if (this.highlightNode && this.highlightNode.isValid) {
            this.highlightNode.destroy();
            this.highlightNode = null!;
        }
    }

    /**
     * 获取是否高亮
     */
    getIsHighlighted(): boolean {
        return this.isHighlighted;
    }
}

