import { _decorator, Component, Node, Vec3, Sprite, tween, find } from 'cc';
import { GameManager, GameState } from './GameManager';
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
    private gameManager: GameManager | null = null; // 游戏管理器引用

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
            return;
        }
        
        this.travelTime = distance / this.speed;
        if (this.travelTime <= 0) {
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
        
        if (this.hasHitTarget) {
            return; // 已经命中过了
        }

        if (!this.targetNode || !this.targetNode.isValid) {
            // 目标无效，开始返回
            this.startReturn();
            return;
        }

        this.hasHitTarget = true;

        // 直接对当前目标造成伤害，支持Enemy、OrcWarrior、OrcWarlord和TrollSpearman
        const enemyScript = this.targetNode.getComponent('Enemy') as any || this.targetNode.getComponent('OrcWarrior') as any || this.targetNode.getComponent('OrcWarlord') as any || this.targetNode.getComponent('TrollSpearman') as any;
        if (enemyScript && typeof enemyScript.isAlive === 'function' && enemyScript.isAlive() && typeof enemyScript.takeDamage === 'function') {
            enemyScript.takeDamage(this.currentDamage);
        } else {
        }
        
        // 调用回调函数，用于播放音效等辅助效果
        if (this.onHitCallback) {
            this.onHitCallback(this.currentDamage);
        }

        // 将当前目标添加到已命中集合
        this.enemiesHit.add(this.targetNode);

        // 检查是否可以弹射
        if (this.bounceCount < this.maxBounces) {
            // 寻找附近的敌人
            const nearbyEnemies = this.findNearbyEnemies(this.targetNode, this.bounceRange);
            
            if (nearbyEnemies.length > 0) {
                // 选择最近的敌人作为下一个目标
                const nextTarget = this.findNearestEnemy(nearbyEnemies, this.targetNode.worldPosition);
                if (nextTarget) {
                    // 开始弹射
                    this.startBounce(nextTarget);
                    return;
                } else {
                }
            } else {
            }
        } else {
        }

        // 没有找到下一个目标或达到最大弹射次数，开始返回
        this.startReturn();
    }

    /**
     * 寻找附近的敌人
     * @param centerNode 中心点节点
     * @param range 搜索范围
     * @returns 附近的敌人数组
     */
    findNearbyEnemies(centerNode: Node, range: number): Node[] {
        
        const nearbyEnemies: Node[] = [];
        const centerPos = centerNode.worldPosition;

        // 查找Enemies容器，先尝试直接查找，再尝试递归查找
        let enemiesNode = find('Enemies');
        
        if (!enemiesNode && this.node.scene) {
            enemiesNode = this.findNodeRecursive(this.node.scene, 'Enemies');
        }
        
        if (!enemiesNode) {
            // 尝试从场景根节点查找
            const scene = this.node.scene;
            if (scene) {
                // 遍历场景根节点的子节点
                for (const child of scene.children) {
                    if (child.name === 'Enemies') {
                        enemiesNode = child;
                        break;
                    }
                }
            }
        }
        
        if (!enemiesNode) {
            return nearbyEnemies;
        }
        

        // 遍历所有敌人
        const enemies = enemiesNode.children || [];
        
        for (const enemy of enemies) {
            if (enemy && enemy.isValid && enemy.active && enemy !== centerNode) {
                // 检查敌人是否已经被命中
                if (this.enemiesHit.has(enemy)) {
                    continue;
                }

                // 检查敌人是否存活，支持OrcWarlord、OrcWarrior、Enemy和TrollSpearman
                const enemyScript = enemy.getComponent('OrcWarlord') as any || enemy.getComponent('OrcWarrior') as any || enemy.getComponent('Enemy') as any || enemy.getComponent('TrollSpearman') as any;
                const isAlive = enemyScript && typeof enemyScript.isAlive === 'function' && enemyScript.isAlive();
                
                if (isAlive) {
                    // 检查距离
                    const enemyPos = enemy.worldPosition;
                    const distance = Vec3.distance(centerPos, enemyPos);
                    
                    if (distance <= range) {
                        nearbyEnemies.push(enemy);
                    }
                }
            }
        }
        
        return nearbyEnemies;
    }

    /**
     * 寻找最近的敌人
     * @param enemies 敌人数组
     * @param currentPos 当前位置
     * @returns 最近的敌人
     */
    findNearestEnemy(enemies: Node[], currentPos: Vec3): Node | null {
        if (enemies.length === 0) {
            return null;
        }

        let nearestEnemy: Node | null = null;
        let minDistance = Infinity;

        for (const enemy of enemies) {
            if (enemy && enemy.isValid) {
                const distance = Vec3.distance(currentPos, enemy.worldPosition);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestEnemy = enemy;
                }
            }
        }
        
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

        // 检查游戏状态 - 如果GameManager不存在，尝试重新查找
        if (!this.gameManager) {
            this.gameManager = find('GameManager')?.getComponent(GameManager);
        }
        
        // 检查游戏状态，如果不是Playing状态，停止飞行
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                // 游戏已暂停或结束，停止飞行
                return;
            }
        }

        if (this.isReturning) {
            // 返回阶段
            this.returnElapsedTime += deltaTime;
            const returnRatio = Math.min(this.returnElapsedTime / this.returnTravelTime, 1);
            
            // 计算当前返回位置
            const currentPos = this.calculateReturnPosition(returnRatio);
            
            // 检查路径上是否有兽人督军尸体
            if (this.checkForOrcWarlordCorpse(this.lastPos, currentPos)) {
                return;
            }
            
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
        
        // 检查路径上是否有兽人督军尸体
        if (this.checkForOrcWarlordCorpse(this.lastPos, currentPos)) {
            return;
        }
        
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
    
    /**
     * 将回旋镖插在尸体身上
     * @param corpseNode 尸体节点
     * @param startPos 起始位置
     * @param endPos 结束位置
     */
    attachToCorpse(corpseNode: Node, startPos: Vec3, endPos: Vec3): void {
        if (!this.node || !this.node.isValid || !corpseNode || !corpseNode.isValid) {
            return;
        }
        
        // 计算命中点
        const corpsePos = corpseNode.worldPosition;
        const hitPos = this.calculateHitPoint(startPos, endPos, corpsePos);
        
        // 停止飞行状态
        this.isFlying = false;
        this.isReturning = false;
        
        // 将回旋镖设为尸体的子节点
        this.node.removeFromParent();
        corpseNode.addChild(this.node);
        
        // 设置回旋镖位置（转换为局部位置）
        const localPos = corpseNode.worldPosition.clone();
        Vec3.subtract(localPos, hitPos, localPos);
        this.node.setPosition(localPos);
        
        // 调整回旋镖旋转，使其指向飞行方向
        const direction = new Vec3();
        Vec3.subtract(direction, endPos, startPos);
        if (direction.length() > 0.1) {
            const angle = Math.atan2(direction.y, direction.x) * 180 / Math.PI;
            this.node.setRotationFromEuler(0, 0, angle);
        }
        
        // 命中尸体不触发伤害回调
        // 清除回调，防止后续调用
        this.onHitCallback = null;
    }

    /**
     * 计算命中点
     * @param startPos 起始位置
     * @param endPos 结束位置
     * @param corpsePos 尸体位置
     * @returns 命中点位置
     */
    calculateHitPoint(startPos: Vec3, endPos: Vec3, corpsePos: Vec3): Vec3 {
        // 计算线段方向
        const lineDir = Vec3.subtract(new Vec3(), endPos, startPos);
        const lineLengthSqr = Vec3.lengthSqr(lineDir);
        
        if (lineLengthSqr === 0) {
            return corpsePos.clone();
        }
        
        // 计算投影点
        const t = Math.max(0, Math.min(1, Vec3.dot(Vec3.subtract(new Vec3(), corpsePos, startPos), lineDir) / lineLengthSqr));
        const projection = Vec3.add(new Vec3(), startPos, Vec3.multiplyScalar(new Vec3(), lineDir, t));
        
        return projection;
    }

    /**
     * 检查路径上是否有兽人督军尸体
     * @param startPos 起始位置
     * @param endPos 结束位置
     * @returns 是否命中尸体
     */
    checkForOrcWarlordCorpse(startPos: Vec3, endPos: Vec3): boolean {
        // 查找Enemies容器，使用与findNearbyEnemies相同的逻辑
        let enemiesNode = find('Enemies');
        
        if (!enemiesNode && this.node.scene) {
            enemiesNode = this.findNodeRecursive(this.node.scene, 'Enemies');
        }
        
        if (!enemiesNode) {
            // 尝试从场景根节点查找
            const scene = this.node.scene;
            if (scene) {
                for (const child of scene.children) {
                    if (child.name === 'Enemies') {
                        enemiesNode = child;
                        break;
                    }
                }
            }
        }
        
        if (!enemiesNode) {
            return false;
        }
        
        const enemies = enemiesNode.children || [];
        
        for (const enemy of enemies) {
            if (!enemy || !enemy.isValid) {
                continue;
            }
            
            // 检查是否是兽人督军
            const orcScript = enemy.getComponent('OrcWarlord') as any;
            if (!orcScript) {
                continue;
            }
            
            // 检查是否已经死亡
            const isAlive = orcScript.isAlive && orcScript.isAlive();
            if (!isAlive && enemy.isValid) {
                // 检查整个飞行路径是否与尸体相交
                const corpsePos = enemy.worldPosition;
                const distance = this.getDistanceFromLine(startPos, endPos, corpsePos);
                
                // 如果距离小于30像素，认为命中尸体
                if (distance < 30) {
                    // 命中尸体，插在尸体身上
                    this.attachToCorpse(enemy, startPos, endPos);
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * 计算点到线段的最短距离
     * @param lineStart 线段起点
     * @param lineEnd 线段终点
     * @param point 点
     * @returns 最短距离
     */
    getDistanceFromLine(lineStart: Vec3, lineEnd: Vec3, point: Vec3): number {
        const lineDir = Vec3.subtract(new Vec3(), lineEnd, lineStart);
        const lineLengthSqr = Vec3.lengthSqr(lineDir);
        
        if (lineLengthSqr === 0) {
            // 线段长度为0，直接返回点到起点的距离
            return Vec3.distance(point, lineStart);
        }
        
        const t = Math.max(0, Math.min(1, Vec3.dot(Vec3.subtract(new Vec3(), point, lineStart), lineDir) / lineLengthSqr));
        const projection = Vec3.add(new Vec3(), lineStart, Vec3.multiplyScalar(new Vec3(), lineDir, t));
        
        return Vec3.distance(point, projection);
    }
}