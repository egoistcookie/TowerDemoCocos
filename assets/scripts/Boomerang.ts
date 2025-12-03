import { _decorator, Component, Node, Vec3, Sprite, tween, find } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Boomerang')
export class Boomerang extends Component {
    @property
    speed: number = 500; // 回旋镖飞行速度（像素/秒）

    @property
    arcHeight: number = 50; // 抛物线弧度高度（像素）

    @property
    damage: number = 10; // 初始伤害值

    @property
    maxBounces: number = 3; // 最大弹射次数

    @property
    bounceDamageMultiplier: number = 0.5; // 弹射伤害倍率

    @property
    bounceRange: number = 100; // 弹射距离阈值（像素）

    private targetNode: Node = null!;
    private startPos: Vec3 = new Vec3();
    private targetPos: Vec3 = new Vec3();
    private travelTime: number = 0;
    private elapsedTime: number = 0;
    private onHitCallback: ((damage: number) => void) | null = null;
    private isFlying: boolean = false;
    private lastPos: Vec3 = new Vec3();
    private isReturning: boolean = false; // 是否正在飞回
    private returnStartTime: Vec3 = new Vec3(); // 开始返回的位置
    private returnElapsedTime: number = 0; // 返回阶段的已用时间
    private returnTravelTime: number = 0; // 返回阶段的总飞行时间
    private ownerNode: Node = null!; // 女猎手节点（用于返回）
    private bounceCount: number = 0; // 当前弹射次数
    private enemiesHit: Set<Node> = new Set(); // 已命中的敌人集合
    private currentDamage: number = 0; // 当前伤害值
    private isBouncing: boolean = false; // 是否正在弹射
    private hasHitTarget: boolean = false; // 是否已命中目标

    /**
     * 初始化回旋镖
     * @param startPos 起始位置
     * @param targetNode 目标节点
     * @param damage 伤害值
     * @param onHit 命中回调函数
     * @param ownerNode 发射者节点（女猎手）
     */
    init(startPos: Vec3, targetNode: Node, damage: number, onHit?: (damage: number) => void, ownerNode?: Node) {
        this.startPos = startPos.clone();
        this.targetNode = targetNode;
        this.damage = damage;
        this.currentDamage = damage; // 初始化当前伤害值
        this.onHitCallback = onHit || null;
        this.ownerNode = ownerNode || null!;

        // 设置初始状态
        this.isReturning = false;
        this.isBouncing = false;
        this.hasHitTarget = false; // 初始化命中标志
        this.bounceCount = 0;
        this.enemiesHit.clear(); // 清空已命中敌人集合
        this.returnStartTime = new Vec3();
        this.returnElapsedTime = 0;
        this.returnTravelTime = 0;

        // 设置初始位置
        this.node.setWorldPosition(this.startPos);

        // 计算目标位置
        if (this.targetNode && this.targetNode.isValid) {
            this.targetPos = this.targetNode.worldPosition.clone();
        } else {
            // 如果目标无效，使用起始位置前方
            this.targetPos = this.startPos.clone();
            this.targetPos.x += 200;
        }

        // 计算飞行时间（基于距离和速度）
        const distance = Vec3.distance(this.startPos, this.targetPos);
        if (distance < 0.1) {
            console.error('Boomerang: Distance too small, cannot initialize');
            return;
        }
        
        this.travelTime = distance / this.speed;
        if (this.travelTime <= 0) {
            console.error(`Boomerang: Invalid travelTime: ${this.travelTime}, distance: ${distance}, speed: ${this.speed}`);
            return;
        }
        
        this.elapsedTime = 0;
        this.isFlying = true;
        this.lastPos = this.startPos.clone();

        // 设置初始旋转角度（指向目标）
        const initialDirection = new Vec3();
        Vec3.subtract(initialDirection, this.targetPos, this.startPos);
        if (initialDirection.length() > 0.1) {
            const angle = Math.atan2(initialDirection.y, initialDirection.x) * 180 / Math.PI;
            this.node.setRotationFromEuler(0, 0, angle);
        }
    }

    /**
     * 计算抛物线位置
     * @param ratio 进度比例 (0-1)
     */
    calculateParabolicPosition(ratio: number): Vec3 {
        const pos = new Vec3();
        
        // 线性插值计算基础位置
        Vec3.lerp(pos, this.startPos, this.targetPos, ratio);
        
        // 添加抛物线高度（使用二次函数模拟重力效果）
        const arcRatio = 4 * ratio * (1 - ratio); // 0到1再到0的曲线
        pos.y += this.arcHeight * arcRatio;
        
        return pos;
    }

    /**
     * 命中目标
     */
    hitTarget() {
        console.info('Boomerang: hitTarget called');
        
        if (this.hasHitTarget) {
            console.info('Boomerang: Already hit target, returning');
            return; // 已经命中过了
        }

        if (!this.targetNode || !this.targetNode.isValid) {
            console.info('Boomerang: Target invalid, starting return');
            // 目标无效，开始返回
            this.startReturn();
            return;
        }

        this.hasHitTarget = true;
        console.info(`Boomerang: Hit target ${this.targetNode.name} at position (${this.targetNode.worldPosition.x.toFixed(2)}, ${this.targetNode.worldPosition.y.toFixed(2)}), damage: ${this.currentDamage}`);

        // 对当前目标造成伤害
        if (this.onHitCallback) {
            // 直接获取当前目标的脚本并造成伤害，支持Enemy和OrcWarrior
            const enemyScript = this.targetNode.getComponent('Enemy') as any || this.targetNode.getComponent('OrcWarrior') as any;
            if (enemyScript && enemyScript.isAlive && enemyScript.isAlive() && enemyScript.takeDamage) {
                console.info(`Boomerang: Dealing ${this.currentDamage} damage to ${this.targetNode.name}`);
                enemyScript.takeDamage(this.currentDamage);
            } else {
                console.info(`Boomerang: Cannot deal damage to ${this.targetNode.name}, enemy invalid`);
            }
        }

        // 将当前目标添加到已命中集合
        this.enemiesHit.add(this.targetNode);
        console.info(`Boomerang: Added target to enemiesHit, count: ${this.enemiesHit.size}`);

        // 检查是否可以弹射
        if (this.bounceCount < this.maxBounces) {
            console.info(`Boomerang: Can bounce, bounceCount: ${this.bounceCount}, maxBounces: ${this.maxBounces}`);
            // 寻找附近的敌人
            const nearbyEnemies = this.findNearbyEnemies(this.targetNode, this.bounceRange);
            console.info(`Boomerang: Found ${nearbyEnemies.length} nearby enemies`);
            
            if (nearbyEnemies.length > 0) {
                // 选择最近的敌人作为下一个目标
                const nextTarget = this.findNearestEnemy(nearbyEnemies, this.targetNode.worldPosition);
                if (nextTarget) {
                    console.info(`Boomerang: Found nearest enemy ${nextTarget.name}, starting bounce`);
                    // 开始弹射
                    this.startBounce(nextTarget);
                    return;
                } else {
                    console.info('Boomerang: No nearest enemy found');
                }
            } else {
                console.info('Boomerang: No nearby enemies, cannot bounce');
            }
        } else {
            console.info(`Boomerang: Max bounces reached, bounceCount: ${this.bounceCount}`);
        }

        // 没有找到下一个目标或达到最大弹射次数，开始返回
        console.info('Boomerang: Starting return to owner');
        this.startReturn();
    }

    /**
     * 寻找附近的敌人
     * @param centerNode 中心点节点
     * @param range 搜索范围
     * @returns 附近的敌人数组
     */
    findNearbyEnemies(centerNode: Node, range: number): Node[] {
        console.info(`Boomerang: findNearbyEnemies called, centerNode: ${centerNode.name}, range: ${range}`);
        
        const nearbyEnemies: Node[] = [];
        const centerPos = centerNode.worldPosition;
        console.info(`Boomerang: Center position: (${centerPos.x.toFixed(2)}, ${centerPos.y.toFixed(2)})`);

        // 查找Enemies容器，先尝试直接查找，再尝试递归查找
        let enemiesNode = find('Enemies');
        console.info(`Boomerang: Direct find Enemies result: ${enemiesNode ? enemiesNode.name : 'null'}`);
        
        if (!enemiesNode && this.node.scene) {
            enemiesNode = this.findNodeRecursive(this.node.scene, 'Enemies');
            console.info(`Boomerang: Recursive find Enemies result: ${enemiesNode ? enemiesNode.name : 'null'}`);
        }
        
        if (!enemiesNode) {
            // 尝试从场景根节点查找
            const scene = this.node.scene;
            if (scene) {
                console.info(`Boomerang: Searching Enemies from scene root`);
                // 遍历场景根节点的子节点
                for (const child of scene.children) {
                    console.info(`Boomerang: Scene child: ${child.name}`);
                    if (child.name === 'Enemies') {
                        enemiesNode = child;
                        console.info(`Boomerang: Found Enemies from scene root`);
                        break;
                    }
                }
            }
        }
        
        if (!enemiesNode) {
            console.info('Boomerang: Enemies node not found');
            return nearbyEnemies;
        }
        
        console.info(`Boomerang: Enemies node found, children count: ${enemiesNode.children.length}`);

        // 遍历所有敌人
        const enemies = enemiesNode.children || [];
        console.info(`Boomerang: Iterating through ${enemies.length} enemies`);
        
        for (const enemy of enemies) {
            console.info(`Boomerang: Checking enemy: ${enemy ? enemy.name : 'null'}, isValid: ${enemy?.isValid}, active: ${enemy?.active}, isCenterNode: ${enemy === centerNode}`);
            
            if (enemy && enemy.isValid && enemy.active && enemy !== centerNode) {
                // 检查敌人是否已经被命中
                if (this.enemiesHit.has(enemy)) {
                    console.info(`Boomerang: Enemy ${enemy.name} already hit, skipping`);
                    continue;
                }

                // 检查敌人是否存活，支持Enemy和OrcWarrior
                const enemyScript = enemy.getComponent('Enemy') as any || enemy.getComponent('OrcWarrior') as any;
                const isAlive = enemyScript && enemyScript.isAlive && enemyScript.isAlive();
                console.info(`Boomerang: Enemy ${enemy.name}, has script: ${!!enemyScript}, isAlive: ${isAlive}`);
                
                if (isAlive) {
                    // 检查距离
                    const enemyPos = enemy.worldPosition;
                    const distance = Vec3.distance(centerPos, enemyPos);
                    console.info(`Boomerang: Enemy ${enemy.name} position: (${enemyPos.x.toFixed(2)}, ${enemyPos.y.toFixed(2)}), distance: ${distance.toFixed(2)}, range: ${range}`);
                    
                    if (distance <= range) {
                        console.info(`Boomerang: Adding enemy ${enemy.name} to nearbyEnemies`);
                        nearbyEnemies.push(enemy);
                    }
                }
            }
        }
        
        console.info(`Boomerang: Found ${nearbyEnemies.length} nearby enemies`);
        return nearbyEnemies;
    }

    /**
     * 寻找最近的敌人
     * @param enemies 敌人数组
     * @param currentPos 当前位置
     * @returns 最近的敌人
     */
    findNearestEnemy(enemies: Node[], currentPos: Vec3): Node | null {
        console.info(`Boomerang: findNearestEnemy called, enemies count: ${enemies.length}, currentPos: (${currentPos.x.toFixed(2)}, ${currentPos.y.toFixed(2)})`);
        
        if (enemies.length === 0) {
            console.info('Boomerang: No enemies to find nearest from');
            return null;
        }

        let nearestEnemy: Node | null = null;
        let minDistance = Infinity;

        for (const enemy of enemies) {
            console.info(`Boomerang: Checking enemy for nearest: ${enemy ? enemy.name : 'null'}, isValid: ${enemy?.isValid}`);
            
            if (enemy && enemy.isValid) {
                const distance = Vec3.distance(currentPos, enemy.worldPosition);
                console.info(`Boomerang: Enemy ${enemy.name} distance: ${distance.toFixed(2)}, current min: ${minDistance.toFixed(2)}`);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestEnemy = enemy;
                    console.info(`Boomerang: New nearest enemy: ${enemy.name}, distance: ${distance.toFixed(2)}`);
                }
            }
        }
        
        console.info(`Boomerang: Returning nearest enemy: ${nearestEnemy ? nearestEnemy.name : 'null'}, distance: ${minDistance.toFixed(2)}`);
        return nearestEnemy;
    }

    /**
     * 递归查找节点
     * @param node 起始节点
     * @param name 节点名称
     * @returns 找到的节点
     */
    findNodeRecursive(node: Node, name: string): Node | null {
        if (node.name === name) {
            return node;
        }
        for (const child of node.children) {
            const found = this.findNodeRecursive(child, name);
            if (found) {
                return found;
            }
        }
        return null;
    }

    /**
     * 开始弹射
     * @param nextTarget 下一个目标
     */
    startBounce(nextTarget: Node) {
        this.isBouncing = true;
        this.bounceCount++;
        this.targetNode = nextTarget;
        this.targetPos = nextTarget.worldPosition.clone();
        this.currentDamage *= this.bounceDamageMultiplier; // 更新伤害值
        this.elapsedTime = 0; // 重置计时器
        this.hasHitTarget = false; // 重置命中标志，允许命中新目标

        // 计算新的飞行时间
        const distance = Vec3.distance(this.node.worldPosition, this.targetPos);
        this.travelTime = distance / this.speed;
        if (this.travelTime <= 0) {
            this.travelTime = 0.5; // 最小飞行时间
        }
    }

    /**
     * 开始返回女猎手手中
     */
    startReturn() {
        if (!this.ownerNode || !this.ownerNode.isValid) {
            // 如果没有女猎手节点，直接销毁
            this.scheduleOnce(() => {
                if (this.node && this.node.isValid) {
                    this.node.destroy();
                }
            }, 0.1);
            return;
        }

        // 重置命中标志，允许再次命中
        this.hasHitTarget = false;
        
        this.isReturning = true;
        this.returnStartTime = this.node.worldPosition.clone();
        this.returnElapsedTime = 0;
        
        // 计算返回的飞行时间
        const returnDistance = Vec3.distance(this.returnStartTime, this.ownerNode.worldPosition);
        this.returnTravelTime = returnDistance / this.speed;
        if (this.returnTravelTime <= 0) {
            this.returnTravelTime = 0.5; // 最小返回时间
        }
        
        console.info(`Boomerang: Starting return to owner, returnDistance: ${returnDistance.toFixed(2)}, returnTravelTime: ${this.returnTravelTime.toFixed(2)}s`);
    }

    /**
     * 返回女猎手手中完成
     */
    returnComplete() {
        this.isFlying = false;
        this.isReturning = false;
        
        // 销毁弓箭节点
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }, 0.1);
    }

    /**
     * 计算返回路径位置
     * @param ratio 进度比例 (0-1)
     */
    calculateReturnPosition(ratio: number): Vec3 {
        const pos = new Vec3();
        
        // 计算返回的目标位置（女猎手位置）
        const returnTargetPos = this.ownerNode ? this.ownerNode.worldPosition.clone() : this.startPos.clone();
        
        // 线性插值计算基础位置
        Vec3.lerp(pos, this.returnStartTime, returnTargetPos, ratio);
        
        // 添加返回时的抛物线高度
        const arcRatio = 4 * ratio * (1 - ratio); // 0到1再到0的曲线
        pos.y += this.arcHeight * arcRatio * 0.5; // 返回时弧度减半
        
        return pos;
    }

    update(deltaTime: number) {
        if (!this.isFlying) {
            return;
        }

        if (this.isReturning) {
            // 返回阶段
            this.returnElapsedTime += deltaTime;
            const returnRatio = Math.min(this.returnElapsedTime / this.returnTravelTime, 1);
            
            // 计算当前返回位置
            const currentPos = this.calculateReturnPosition(returnRatio);
            this.node.setWorldPosition(currentPos);
            
            // 更新旋转角度，使箭头始终指向飞行方向
            const direction = new Vec3();
            Vec3.subtract(direction, currentPos, this.lastPos);
            if (direction.length() > 0.1) {
                const angle = Math.atan2(direction.y, direction.x) * 180 / Math.PI;
                this.node.setRotationFromEuler(0, 0, angle);
            }
            this.lastPos = currentPos.clone();
            
            // 检查是否返回女猎手手中
            if (this.ownerNode && this.ownerNode.isValid) {
                const distanceToOwner = Vec3.distance(currentPos, this.ownerNode.worldPosition);
                if (distanceToOwner < 20) {
                    // 返回完成
                    this.returnComplete();
                    return;
                }
            }
            
            // 如果返回时间过长，强制销毁
            if (this.returnElapsedTime > this.returnTravelTime * 2) {
                this.returnComplete();
                return;
            }
            
            return;
        }
        
        // 正常飞行或弹射阶段
        // 更新计时器
        this.elapsedTime += deltaTime;
        
        // 更新目标位置（目标可能在移动）
        if (this.targetNode && this.targetNode.isValid && this.targetNode.active) {
            this.targetPos = this.targetNode.worldPosition.clone();
        } else {
            // 目标无效，寻找下一个目标或开始返回
            if (this.bounceCount < this.maxBounces) {
                // 寻找附近的敌人
                const nearbyEnemies = this.findNearbyEnemies(this.node, this.bounceRange);
                if (nearbyEnemies.length > 0) {
                    // 选择最近的敌人作为下一个目标
                    const nextTarget = this.findNearestEnemy(nearbyEnemies, this.node.worldPosition);
                    if (nextTarget) {
                        // 开始弹射
                        this.startBounce(nextTarget);
                    } else {
                        // 没有找到下一个目标，开始返回
                        this.startReturn();
                    }
                } else {
                    // 没有附近敌人，开始返回
                    this.startReturn();
                }
                return;
            } else {
                // 达到最大弹射次数，开始返回
                this.startReturn();
                return;
            }
        }

        // 计算当前进度
        const currentRatio = Math.min(this.elapsedTime / this.travelTime, 1);
        
        // 计算当前在抛物线上的位置
        const currentPos = this.calculateParabolicPosition(currentRatio);
        this.node.setWorldPosition(currentPos);
        
        // 更新旋转角度，使箭头始终指向飞行方向
        const direction = new Vec3();
        Vec3.subtract(direction, currentPos, this.lastPos);
        if (direction.length() > 0.1) {
            const angle = Math.atan2(direction.y, direction.x) * 180 / Math.PI;
            this.node.setRotationFromEuler(0, 0, angle);
        }
        this.lastPos = currentPos.clone();
        
        // 检查是否命中目标
        if (this.targetNode && this.targetNode.isValid && this.targetNode.active) {
            const currentTargetPos = this.targetNode.worldPosition;
            const distance = Vec3.distance(currentPos, currentTargetPos);
            
            // 如果距离足够近，认为命中
            if (distance < 30) {
                this.hitTarget();
                return;
            }
        }
        
        // 如果飞行完成但未命中目标，尝试弹射或返回
        if (currentRatio >= 1) {
            this.hitTarget(); // 调用hitTarget来处理弹射或返回逻辑
            return;
        }
        
        // 如果飞行时间过长（超过预期时间2倍），开始返回
        if (this.elapsedTime > this.travelTime * 2) {
            this.hitTarget();
            return;
        }
    }
}