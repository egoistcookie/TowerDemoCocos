import { _decorator, Component, Node, Vec3, Prefab, instantiate, find, Graphics, UITransform, Label, Color, tween, EventTouch, input, Input, resources, Sprite, SpriteFrame, Texture2D, Camera, AudioClip, Animation, AnimationState } from 'cc';
import { AudioManager } from './AudioManager';
import { GameManager, GameState } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
import { Arrow } from './Arrow';
import { UnitSelectionManager } from './UnitSelectionManager';
import { UnitInfo } from './UnitInfoPanel';
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
    private unitSelectionManager: UnitSelectionManager = null!; // 单位选择管理器
    private globalTouchHandler: ((event: EventTouch) => void) | null = null; // 全局触摸事件处理器
    private isHighlighted: boolean = false; // 是否高亮显示
    private highlightNode: Node | null = null; // 高亮效果节点

    start() {
        console.info('Hunter: Starting, node name:', this.node.name);
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        this.manualMoveTarget = null;
        console.info('Hunter: Initialized manualMoveTarget to null');
        
        // 获取Sprite组件
        this.sprite = this.node.getComponent(Sprite);
        if (this.sprite && this.sprite.spriteFrame) {
            this.defaultSpriteFrame = this.sprite.spriteFrame;
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
        this.node.on(Node.EventType.TOUCH_END, this.onHunterClick, this);
        console.info('Hunter: Start method completed');
    }

    onDestroy() {
        // 移除点击事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onHunterClick, this);
        
        // 移除全局触摸事件监听
        if (this.globalTouchHandler) {
            const canvas = find('Canvas');
            if (canvas) {
                canvas.off(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
            }
            this.globalTouchHandler = null;
        }
    }

    /**
     * 查找游戏管理器
     */
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

    /**
     * 创建血条
     */
    createHealthBar() {
        this.healthBarNode = new Node('HealthBar');
        this.healthBarNode.setParent(this.node);
        this.healthBarNode.setPosition(0, 50, 0);
        
        this.healthBar = this.healthBarNode.addComponent(HealthBar);
        if (this.healthBar) {
            this.healthBar.setMaxHealth(this.maxHealth);
            this.healthBar.setHealth(this.currentHealth);
        }
    }

    /**
     * 更新方法
     */
    update(deltaTime: number) {
        console.debug('Hunter.update: Entering update method, isDestroyed:', this.isDestroyed, 'node name:', this.node.name);
        if (this.isDestroyed) {
            console.debug('Hunter.update: isDestroyed is true, returning');
            return;
        }
        
        // 更新攻击计时器
        this.attackTimer += deltaTime;
        
        // 更新避障计时器
        if (this.avoidTimer > 0) {
            this.avoidTimer -= deltaTime;
        }
        
        // 优先处理手动移动目标
        console.debug('Hunter.update: Checking manualMoveTarget:', this.manualMoveTarget ? `(${this.manualMoveTarget.x.toFixed(1)}, ${this.manualMoveTarget.y.toFixed(1)})` : 'null');
        if (this.manualMoveTarget) {
            console.debug('Hunter.update: manualMoveTarget exists, calling moveToManualTarget');
            // 手动移动目标位置
            this.moveToManualTarget(deltaTime);
            console.debug('Hunter.update: Calling updateAnimation after manual move');
            // 手动移动时，也需要更新动画
            this.updateAnimation(deltaTime);
            console.debug('Hunter.update: Exiting after manual move');
            return; // 手动移动时，不执行自动寻敌
        }
        
        // 查找目标（只有在没有手动移动目标时才执行）
        this.findTarget();
        
        // 处理移动
        if (this.currentTarget) {
            // 有攻击目标，检查距离
            const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
            if (distance <= this.attackRange) {
                // 在攻击范围内，停止移动并攻击
                this.isMoving = false;
                this.stopMoveAnimation();
                this.attack();
            } else if (distance <= this.attackRange * 2) {
                // 在2倍攻击范围内，移动到目标位置
                this.isMoving = true;
                this.moveToTarget(deltaTime);
            } else {
                // 超出2倍攻击范围，停止移动
                this.isMoving = false;
                this.stopMoveAnimation();
            }
        } else {
            // 没有目标，停止移动
            this.isMoving = false;
            this.stopMoveAnimation();
        }
        
        // 更新动画
        this.updateAnimation(deltaTime);
        console.debug('Hunter.update: Exiting update method');
    }

    /**
     * 查找目标
     */
    findTarget() {
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
        
        let enemiesNode = find('Enemies');
        
        // 如果直接查找失败，尝试递归查找
        if (!enemiesNode && this.node.scene) {
            enemiesNode = findNodeRecursive(this.node.scene, 'Enemies');
        }
        
        if (enemiesNode) {
            const enemies = enemiesNode.children;
            let nearestEnemy: Node = null!;
            let minDistance = Infinity;
            const detectionRange = this.attackRange * 2; // 2倍攻击范围用于检测
            
            for (const enemy of enemies) {
                if (enemy && enemy.active && enemy.isValid) {
                    const enemyScript = enemy.getComponent('Enemy') as any;
                    if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
                        const distance = Vec3.distance(this.node.worldPosition, enemy.worldPosition);
                        if (distance <= detectionRange && distance < minDistance) {
                            minDistance = distance;
                            nearestEnemy = enemy;
                        }
                    }
                }
            }
            
            this.currentTarget = nearestEnemy;
        }
    }

    /**
     * 移动到目标位置
     */
    moveToTarget(deltaTime: number) {
        if (!this.currentTarget) {
            return;
        }
        
        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        const distance = direction.length();
        
        if (distance > 0.1) {
            direction.normalize();
            
            // 检查是否需要避障
            if (this.avoidTimer > 0) {
                // 正在避障，使用避障方向
                direction.add(this.avoidDirection);
                direction.normalize();
            } else {
                // 检查碰撞
                if (this.checkCollision(direction)) {
                    // 检测到碰撞，计算避障方向
                    this.calculateAvoidDirection();
                    direction.add(this.avoidDirection);
                    direction.normalize();
                }
            }
            
            const newPos = new Vec3();
            Vec3.scaleAndAdd(newPos, this.node.worldPosition, direction, this.moveSpeed * deltaTime);
            this.node.setWorldPosition(newPos);
            
            // 根据移动方向翻转
            this.flipDirection(direction);
            
            // 播放移动动画
            this.playMoveAnimation();
        }
    }

    /**
     * 移动到手动设置的目标位置
     */
    moveToManualTarget(deltaTime: number) {
        if (!this.manualMoveTarget) {
            console.info('Hunter: moveToManualTarget called but manualMoveTarget is null');
            return;
        }
        
        console.info(`Hunter: moveToManualTarget called, current position: (${this.node.worldPosition.x.toFixed(1)}, ${this.node.worldPosition.y.toFixed(1)}), target: (${this.manualMoveTarget.x.toFixed(1)}, ${this.manualMoveTarget.y.toFixed(1)})`);
        
        const direction = new Vec3();
        Vec3.subtract(direction, this.manualMoveTarget, this.node.worldPosition);
        const distance = direction.length();
        
        console.info(`Hunter: Distance to target: ${distance.toFixed(1)}`);
        
        if (distance <= 10) {
            // 到达目标位置
            console.info('Hunter: Reached manual move target, clearing target');
            this.manualMoveTarget = null;
            this.isMoving = false;
            this.stopMoveAnimation();
            return;
        }
        
        direction.normalize();
        console.info(`Hunter: Calculated move direction: (${direction.x.toFixed(2)}, ${direction.y.toFixed(2)})`);
        
        // 检查是否需要避障
        if (this.avoidTimer > 0) {
            console.info(`Hunter: Currently avoiding, avoidTimer: ${this.avoidTimer.toFixed(2)}, avoidDirection: (${this.avoidDirection.x.toFixed(2)}, ${this.avoidDirection.y.toFixed(2)})`);
            // 正在避障，使用避障方向
            direction.add(this.avoidDirection);
            direction.normalize();
            console.info(`Hunter: Updated direction after avoidance: (${direction.x.toFixed(2)}, ${direction.y.toFixed(2)})`);
        } else {
            // 检查碰撞
            const hasCollision = this.checkCollision(direction);
            console.info(`Hunter: Collision check result: ${hasCollision}`);
            if (hasCollision) {
                // 检测到碰撞，计算避障方向
                this.calculateAvoidDirection();
                console.info(`Hunter: Calculated new avoidDirection: (${this.avoidDirection.x.toFixed(2)}, ${this.avoidDirection.y.toFixed(2)}), avoidTimer: ${this.avoidTimer}`);
                direction.add(this.avoidDirection);
                direction.normalize();
                console.info(`Hunter: Updated direction after collision avoidance: (${direction.x.toFixed(2)}, ${direction.y.toFixed(2)})`);
            }
        }
        
        const moveDistance = this.moveSpeed * deltaTime;
        console.info(`Hunter: Move speed: ${this.moveSpeed}, deltaTime: ${deltaTime.toFixed(4)}, moveDistance: ${moveDistance.toFixed(2)}`);
        
        const newPos = new Vec3();
        Vec3.scaleAndAdd(newPos, this.node.worldPosition, direction, moveDistance);
        console.info(`Hunter: Moving from (${this.node.worldPosition.x.toFixed(1)}, ${this.node.worldPosition.y.toFixed(1)}) to (${newPos.x.toFixed(1)}, ${newPos.y.toFixed(1)})`);
        
        // 检查新位置是否有效
        if (isNaN(newPos.x) || isNaN(newPos.y)) {
            console.error('Hunter: Invalid new position calculated:', newPos);
            return;
        }
        
        this.node.setWorldPosition(newPos);
        console.info(`Hunter: Successfully updated position to: (${this.node.worldPosition.x.toFixed(1)}, ${this.node.worldPosition.y.toFixed(1)})`);
        
        // 根据移动方向翻转
        this.flipDirection(direction);
        
        // 播放移动动画
        this.playMoveAnimation();
        console.info('Hunter: moveToManualTarget completed');
    }

    /**
     * 检查碰撞
     */
    checkCollision(direction: Vec3): boolean {
        // 检查与其他单位的碰撞
        const checkRadius = this.collisionRadius;
        const checkPos = new Vec3();
        Vec3.scaleAndAdd(checkPos, this.node.worldPosition, direction, checkRadius * 1.5);
        
        // 检查与水晶的碰撞
        const crystal = find('Crystal');
        if (crystal && crystal.isValid && crystal.active) {
            const distance = Vec3.distance(checkPos, crystal.worldPosition);
            const crystalRadius = 50;
            if (distance < checkRadius + crystalRadius) {
                return true;
            }
        }
        
        // 检查与其他Hunter的碰撞
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
        
        let huntersNode = find('Hunters');
        if (!huntersNode && this.node.scene) {
            huntersNode = findNodeRecursive(this.node.scene, 'Hunters');
        }
        
        if (huntersNode) {
            const hunters = huntersNode.children;
            for (const hunter of hunters) {
                if (hunter && hunter.isValid && hunter.active && hunter !== this.node) {
                    const hunterScript = hunter.getComponent('Hunter') as any;
                    if (hunterScript && hunterScript.isAlive && hunterScript.isAlive()) {
                        const distance = Vec3.distance(checkPos, hunter.worldPosition);
                        const otherRadius = hunterScript.collisionRadius || checkRadius;
                        if (distance < checkRadius + otherRadius) {
                            return true;
                        }
                    }
                }
            }
        }
        
        // 检查与战争古树的碰撞
        let warAncientTrees = find('WarAncientTrees');
        if (!warAncientTrees && this.node.scene) {
            warAncientTrees = findNodeRecursive(this.node.scene, 'WarAncientTrees');
        }
        
        if (warAncientTrees) {
            const trees = warAncientTrees.children;
            for (const tree of trees) {
                if (tree && tree.isValid && tree.active) {
                    const treeScript = tree.getComponent('WarAncientTree') as any;
                    if (treeScript && treeScript.isAlive && treeScript.isAlive()) {
                        const distance = Vec3.distance(checkPos, tree.worldPosition);
                        const treeRadius = 50;
                        if (distance < checkRadius + treeRadius) {
                            return true;
                        }
                    }
                }
            }
        }
        
        // 检查与猎手大厅的碰撞
        let hunterHalls = find('HunterHalls');
        if (!hunterHalls && this.node.scene) {
            hunterHalls = findNodeRecursive(this.node.scene, 'HunterHalls');
        }
        
        if (hunterHalls) {
            const halls = hunterHalls.children;
            for (const hall of halls) {
                if (hall && hall.isValid && hall.active) {
                    const hallScript = hall.getComponent('HunterHall') as any;
                    if (hallScript && hallScript.isAlive && hallScript.isAlive()) {
                        const distance = Vec3.distance(checkPos, hall.worldPosition);
                        const hallRadius = 50;
                        if (distance < checkRadius + hallRadius) {
                            return true;
                        }
                    }
                }
            }
        }
        
        // 检查与普通树木的碰撞
        let treesNode = find('Trees');
        if (!treesNode && this.node.scene) {
            treesNode = findNodeRecursive(this.node.scene, 'Trees');
        }
        
        if (treesNode) {
            const trees = treesNode.children;
            for (const tree of trees) {
                if (tree && tree.isValid && tree.active) {
                    const treeScript = tree.getComponent('Tree') as any;
                    if (treeScript && treeScript.isAlive && treeScript.isAlive()) {
                        const distance = Vec3.distance(checkPos, tree.worldPosition);
                        const treeRadius = 30;
                        if (distance < checkRadius + treeRadius) {
                            return true;
                        }
                    }
                }
            }
        }
        
        return false;
    }

    /**
     * 计算避障方向
     */
    calculateAvoidDirection() {
        // 随机生成一个避障方向
        const angle = Math.random() * Math.PI * 2;
        this.avoidDirection.x = Math.cos(angle);
        this.avoidDirection.y = Math.sin(angle);
        this.avoidDirection.z = 0;
        this.avoidDirection.normalize();
        
        // 设置避障时间
        this.avoidTimer = 0.5;
    }

    /**
     * 翻转方向
     */
    flipDirection(direction: Vec3) {
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
    }

    /**
     * 攻击
     */
    attack() {
        if (!this.currentTarget || this.isDestroyed) {
            return;
        }
        
        // 再次检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }
        
        // 检查攻击计时器
        if (this.attackTimer < this.attackInterval) {
            return;
        }
        
        // 重置攻击计时器
        this.attackTimer = 0;
        
        // 播放攻击动画
        this.playAttackAnimation();
        
        // 创建弓箭
        if (this.arrowPrefab) {
            this.createArrow();
        } else {
            // 直接伤害
            const enemyScript = this.currentTarget.getComponent('Enemy') as any;
            if (enemyScript && enemyScript.takeDamage) {
                enemyScript.takeDamage(this.attackDamage);
            }
        }
    }

    /**
     * 创建弓箭
     */
    createArrow() {
        if (!this.arrowPrefab || !this.currentTarget) {
            return;
        }
        
        const arrow = instantiate(this.arrowPrefab);
        const canvas = find('Canvas');
        if (canvas) {
            arrow.setParent(canvas);
        } else if (this.node.scene) {
            arrow.setParent(this.node.scene);
        }
        
        const startPos = this.node.worldPosition.clone();
        arrow.setWorldPosition(startPos);
        arrow.active = true;
        
        let arrowScript = arrow.getComponent(Arrow);
        if (!arrowScript) {
            arrowScript = arrow.addComponent(Arrow);
        }
        
        arrowScript.init(
            startPos,
            this.currentTarget,
            this.attackDamage,
            (damage: number) => {
                const enemyScript = this.currentTarget?.getComponent('Enemy') as any;
                if (enemyScript && enemyScript.takeDamage) {
                    enemyScript.takeDamage(damage);
                }
            }
        );
    }

    /**
     * 播放攻击动画
     */
    playAttackAnimation() {
        if (this.isPlayingAttackAnimation) {
            return;
        }
        
        this.isPlayingAttackAnimation = true;
        
        // 如果没有动画帧，直接返回
        if (this.attackAnimationFrames.length === 0) {
            this.isPlayingAttackAnimation = false;
            return;
        }
        
        // 重置动画帧索引
        this.currentAnimationFrameIndex = 0;
        this.animationTimer = 0;
    }

    /**
     * 播放移动动画
     */
    playMoveAnimation() {
        if (this.isPlayingMoveAnimation || this.isPlayingAttackAnimation) {
            return;
        }
        
        this.isPlayingMoveAnimation = true;
        
        // 如果没有动画帧，直接返回
        if (this.moveAnimationFrames.length === 0) {
            this.isPlayingMoveAnimation = false;
            return;
        }
        
        // 重置动画帧索引
        this.currentAnimationFrameIndex = 0;
        this.animationTimer = 0;
    }

    /**
     * 停止移动动画
     */
    stopMoveAnimation() {
        this.isPlayingMoveAnimation = false;
        // 恢复默认精灵帧
        this.restoreDefaultSprite();
    }

    /**
     * 恢复默认精灵帧
     */
    restoreDefaultSprite() {
        if (this.sprite && this.defaultSpriteFrame) {
            this.sprite.spriteFrame = this.defaultSpriteFrame;
        }
    }

    // 动画相关属性
    private currentAnimationFrameIndex: number = 0;
    private animationTimer: number = 0;

    /**
     * 更新动画
     */
    updateAnimation(deltaTime: number) {
        if (!this.sprite) {
            return;
        }
        
        this.animationTimer += deltaTime;
        
        if (this.isPlayingAttackAnimation) {
            // 更新攻击动画
            const frameDuration = this.attackAnimationDuration / this.attackAnimationFrames.length;
            const frameIndex = Math.floor(this.animationTimer / frameDuration);
            
            if (frameIndex < this.attackAnimationFrames.length) {
                if (frameIndex !== this.currentAnimationFrameIndex) {
                    this.currentAnimationFrameIndex = frameIndex;
                    this.sprite.spriteFrame = this.attackAnimationFrames[frameIndex];
                }
            } else {
                // 动画播放完成
                this.isPlayingAttackAnimation = false;
                this.restoreDefaultSprite();
            }
        } else if (this.isPlayingMoveAnimation) {
            // 更新移动动画
            const frameDuration = this.moveAnimationDuration / this.moveAnimationFrames.length;
            const frameIndex = Math.floor(this.animationTimer / frameDuration) % this.moveAnimationFrames.length;
            
            if (frameIndex !== this.currentAnimationFrameIndex) {
                this.currentAnimationFrameIndex = frameIndex;
                this.sprite.spriteFrame = this.moveAnimationFrames[frameIndex];
            }
        }
    }

    /**
     * 受到伤害
     */
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
            this.die();
        }
    }

    /**
     * 显示伤害数字
     */
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
        
        // 设置位置（在女猎手上方）
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
        
        // 给玩家奖励金币
        if (this.gameManager) {
            this.gameManager.addGold(2);
        }
        
        // 销毁节点
        this.node.destroy();
    }

    /**
     * 是否存活
     */
    isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }

    /**
     * 设置手动移动目标位置
     */
    setManualMoveTargetPosition(position: Vec3) {
        console.info(`Hunter.setManualMoveTargetPosition: Setting manual move target to (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
        console.info(`Hunter.setManualMoveTargetPosition: Current position: (${this.node.worldPosition.x.toFixed(1)}, ${this.node.worldPosition.y.toFixed(1)})`);
        this.manualMoveTarget = position;
        this.isMoving = true;
        console.info(`Hunter.setManualMoveTargetPosition: manualMoveTarget set, isMoving: ${this.isMoving}`);
    }

    /**
     * 女猎手点击事件
     */
    onHunterClick(event: EventTouch) {
        // 不阻止事件冒泡，让SelectionManager也能处理
        // event.propagationStopped = true;
        
        // 显示单位信息面板
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        
        if (this.unitSelectionManager) {
            // 检查是否已经选中了女猎手
            if (this.unitSelectionManager.isUnitSelected(this.node)) {
                // 如果已经选中，清除选择
                this.unitSelectionManager.clearSelection();
            } else {
                const unitInfo: UnitInfo = {
                    name: '女猎手',
                    level: this.level,
                    currentHealth: this.currentHealth,
                    maxHealth: this.maxHealth,
                    attackDamage: this.attackDamage,
                    populationCost: 1,
                    icon: this.cardIcon || this.defaultSpriteFrame,
                    collisionRadius: this.collisionRadius,
                    attackRange: this.attackRange
                };
                this.unitSelectionManager.selectUnit(this.node, unitInfo);
            }
        }
    }
    
    /**
     * 设置高亮显示
     */
    setHighlight(highlighted: boolean) {
        if (this.isHighlighted === highlighted) {
            return; // 状态相同，无需更新
        }
        
        this.isHighlighted = highlighted;
        
        if (highlighted) {
            this.createHighlight();
        } else {
            this.removeHighlight();
        }
    }
    
    /**
     * 创建高亮效果
     */
    private createHighlight() {
        if (this.highlightNode && this.highlightNode.isValid) {
            return; // 已经存在高亮效果
        }
        
        // 创建高亮节点
        this.highlightNode = new Node('Highlight');
        this.highlightNode.setParent(this.node);
        this.highlightNode.setPosition(0, 0, 0);
        
        // 添加Graphics组件
        const graphics = this.highlightNode.addComponent(Graphics);
        if (graphics) {
            // 绘制高亮边框
            graphics.strokeColor = new Color(100, 200, 255, 255); // 亮蓝色边框
            graphics.lineWidth = 3;
            graphics.circle(0, 0, this.collisionRadius + 5); // 半径为碰撞半径+5
            graphics.stroke();
            
            // 绘制半透明填充
            graphics.fillColor = new Color(100, 200, 255, 50); // 半透明蓝色填充
            graphics.circle(0, 0, this.collisionRadius + 5);
            graphics.fill();
        }
    }
    
    /**
     * 移除高亮效果
     */
    private removeHighlight() {
        if (this.highlightNode && this.highlightNode.isValid) {
            this.highlightNode.destroy();
            this.highlightNode = null;
        }
    }
}